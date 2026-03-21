import os, json, logging, random, time, re, hashlib
from typing import Optional
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from groq import Groq
from dotenv import load_dotenv

# Load env variables
load_dotenv()
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv(".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Credentials ─────────────────────────────────────────────────────────────
SUPABASE_URL  = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

# Support single or multiple comma-separated keys
GROQ_KEYS = [k.strip() for k in os.environ.get("GROQ_API_KEY", "").split(",") if k.strip()]
if not GROQ_KEYS:
    raise ValueError("GROQ_API_KEY environment variable is not set correctly.")

MODEL              = "llama-3.3-70b-versatile"
QUESTIONS_PER_RUN  = 10

CACHE_FILE = "act_scraper_cache.json"

def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            log.warning(f"Could not load cache: {e}")
    return {}

def save_cache(cache: dict):
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        log.warning(f"Could not save cache: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# SOURCES
# ─────────────────────────────────────────────────────────────────────────────
CRACKAB_SOURCES = [
    ("https://www.crackab.com/act/english/test301.html", "English", "Medium"),
    ("https://www.crackab.com/act/english/test302.html", "English", "Medium"),
    ("https://www.crackab.com/act/math/test201.html",    "Math",    "Medium"),
    ("https://www.crackab.com/act/math/test202.html",    "Math",    "Hard"),
    ("https://www.crackab.com/act/reading/test401.html", "Reading", "Medium"),
    ("https://www.crackab.com/act/science/test501.html", "Science", "Hard"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: FETCH QUESTIONS + ANSWERS
# ─────────────────────────────────────────────────────────────────────────────
def fetch_crackab_page(url: str) -> tuple[str, dict]:
    log.info(f"Fetching {url}...")
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # The passage is target-passage, questions are in myquestion
    passage_div = soup.find("div", id="target-passage")
    question_div = soup.find("div", id="myquestion")

    passage_text = passage_div.get_text(separator="\n", strip=True) if passage_div else ""
    question_text = question_div.get_text(separator="\n", strip=True) if question_div else ""
    
    full_text = f"PASSAGE:\n{passage_text}\n\nQUESTIONS:\n{question_text}"

    # Get answer key via results.php logic
    # Find hidden inputs
    hidden_inputs = soup.find_all("input", type="hidden")
    form_data = {i.get("name"): i.get("value") for i in hidden_inputs if i.get("name")}
    
    # Just POST to results.php to get the answer key
    r2 = requests.post("https://www.crackab.com/results.php", data=form_data, headers={**HEADERS, "Referer": url})
    soup2 = BeautifulSoup(r2.text, "html.parser")
    
    answer_map = {}
    table = soup2.find("table")
    if table:
        for row in table.find_all("tr")[1:]:
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) >= 2 and cols[0].isdigit():
                answer_map[cols[0]] = cols[1]

    return full_text, answer_map

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: GROQ PARSE
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an elite ACT question processor.
INPUT: Raw text from a real ACT test + answer key.
YOUR JOBS:
A) Parse into individual ACT questions.
B) Entity Swap — change names, numbers, and scenarios but keep the logic/structure identical.
C) Assign difficulty based on ACT standards.

Return a JSON array of objects:
{
  "section": "English | Math | Reading | Science",
  "domain": "ACT domain name",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "...",
  "options": ["...", "...", "...", "..."],
  "correct_answer": "...",
  "rationale": "...",
  "raw_original_text": "..."
}
No markdown fences."""

def parse_with_backoff(groq_client: Groq, text: str, answers: dict, section: str) -> list[dict]:
    
    # Split answers into chunks of 3
    ans_items = sorted(answers.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999)
    chunks = [ans_items[i:i + 3] for i in range(0, len(ans_items), 3)]
    
    all_questions = []
    
    for chunk_idx, chunk in enumerate(chunks):
        ans_str = ", ".join(f"{k}:{v}" for k, v in chunk)
        user_msg = (
            f"Section: {section} | Chunk: {chunk_idx+1}/{len(chunks)}\n"
            f"PROCESS ONLY THESE QUESTIONS: {ans_str}\n\n"
            f"Content Context:\n{text[:6000]}"
        )
        
        max_retries = len(GROQ_KEYS) * 3
        chunk_questions = []
        for attempt in range(max_retries):
            current_key = GROQ_KEYS[attempt % len(GROQ_KEYS)]
            try:
                temp_client = Groq(api_key=current_key)
                resp = temp_client.chat.completions.create(
                    model=MODEL,
                    messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_msg}],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                data = json.loads(resp.choices[0].message.content)
                q_list = data.get("questions") or data.get("data") or list(data.values())[0] if isinstance(data, dict) else data
                
                if isinstance(q_list, list):
                    chunk_questions = q_list
                    break
            except Exception as e:
                err = str(e).lower()
                if "rate_limit" in err or "429" in err:
                    if len(GROQ_KEYS) > 1:
                        log.warning(f"Rate limit hit on key {attempt % len(GROQ_KEYS) + 1}. Rotating...")
                        time.sleep(2)
                    else:
                        wait = min(70, 30 * (2 ** attempt)) + random.uniform(5, 10)
                        log.warning(f"Rate limit hit. Waiting {wait:.2f}s...")
                        time.sleep(wait)
                else:
                    log.error(f"Groq error in chunk {chunk_idx+1}: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(5)
                        continue
                    break
        
        if chunk_questions:
            all_questions.extend(chunk_questions)
            time.sleep(5) # Increased delay
            
    return all_questions

def main():
    log.info("--- STARTING ACT SCRAPER (CrackAB) ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    cache = load_cache()
    sources = random.sample(CRACKAB_SOURCES, min(2, len(CRACKAB_SOURCES)))
    inserted = 0

    for url, section, diff_hint in sources:
        if inserted >= QUESTIONS_PER_RUN: break
        
        url_hash = hashlib.md5(url.encode()).hexdigest()
        if url_hash in cache:
            log.info(f"Using cached questions for {url.split('/')[-1]}...")
            questions = cache[url_hash]
        else:
            try:
                raw_text, answers = fetch_crackab_page(url)
                if not answers: continue
                
                questions = parse_with_backoff(groq_client, raw_text, answers, section)
                if questions:
                    cache[url_hash] = questions
                    save_cache(cache)
                    log.info(f"Got {len(questions)} questions from {url}")
            except Exception as e:
                log.error(f"Failed to process {url}: {e}")
                continue
            
        try:
            for q in questions:
                    if inserted >= QUESTIONS_PER_RUN: break
                    
                    payload = {
                        "exam_type": "ACT",
                        "section": q.get("section") or section,
                        "domain": q.get("domain") or "General",
                        "difficulty": q.get("difficulty") or diff_hint,
                        "question_text": q.get("question_text"),
                        "options": q.get("options"),
                        "correct_answer": q.get("correct_answer"),
                        "rationale": q.get("rationale"),
                        "is_spr": False,
                        "source_method": "Automated_Scraper_CrackAB",
                        "raw_original_text": q.get("raw_original_text") or "[CrackAB Synthesis]"
                    }
                    
                    try:
                        supabase.table("sat_question_bank").insert(payload).execute()
                        log.info(f"  ✓ Inserted: {payload['section']} ({payload['difficulty']})")
                        inserted += 1
                    except Exception as e:
                        log.error(f"Insert failed: {e}")
        except Exception as e:
            log.error(f"Failed to process questions from {url}: {e}")

    log.info(f"ACT Scraper complete. Inserted {inserted} questions.")

if __name__ == "__main__":
    main()
