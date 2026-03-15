"""
scraper.py — SAT Real-Source Scraper v6
========================================
Fetches REAL SAT questions from cracksat.net (public practice tests),
applies Groq Entity Swap to change names/numbers/entities while keeping
all math logic and reasoning structure identical, then inserts into DB.

NO generated questions. Only real questions, entity-swapped.

Flow per run:
  1. Pick thin buckets from DB inventory
  2. Fetch real SAT question page from cracksat.net
  3. Submit form → get correct answer key from results.php
  4. Pass raw text + answer key to Groq → parse into structured questions
     AND apply entity swap in one step
  5. Validate all required columns
  6. Deduplicate + insert into Supabase
"""

import os
import json
import logging
import random
import time
import re
from typing import Optional
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from groq import Groq

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]

MODEL = "llama-3.3-70b-versatile"
QUESTIONS_PER_RUN = 15
TARGET_PER_BUCKET = 500

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# ── Domain / Module mappings ────────────────────────────────────────────────
RW_DOMAINS = {"Information and Ideas", "Craft and Structure", "Expression of Ideas", "Standard English Conventions"}
MATH_DOMAINS = {"Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry"}
VALID_DOMAINS = RW_DOMAINS | MATH_DOMAINS
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
DOMAIN_TO_MODULE = {d: "Reading_Writing" for d in RW_DOMAINS}
DOMAIN_TO_MODULE.update({d: "Math" for d in MATH_DOMAINS})

ALL_BUCKETS = [
    ("Information and Ideas", "Easy"), ("Information and Ideas", "Medium"), ("Information and Ideas", "Hard"),
    ("Craft and Structure", "Easy"), ("Craft and Structure", "Medium"), ("Craft and Structure", "Hard"),
    ("Expression of Ideas", "Easy"), ("Expression of Ideas", "Medium"), ("Expression of Ideas", "Hard"),
    ("Standard English Conventions", "Easy"), ("Standard English Conventions", "Medium"), ("Standard English Conventions", "Hard"),
    ("Algebra", "Easy"), ("Algebra", "Medium"), ("Algebra", "Hard"),
    ("Advanced Math", "Easy"), ("Advanced Math", "Medium"), ("Advanced Math", "Hard"),
    ("Problem-solving and Data Analysis", "Easy"), ("Problem-solving and Data Analysis", "Medium"), ("Problem-solving and Data Analysis", "Hard"),
    ("Geometry and Trigonometry", "Easy"), ("Geometry and Trigonometry", "Medium"), ("Geometry and Trigonometry", "Hard"),
]

# ── CrackSAT source pages: (url, subject_hint, difficulty_hint) ─────────────
# These are real SAT practice tests from cracksat.net
CRACKSAT_SOURCES = [
    # Math Multiple Choice (verified working with form + answers)
    ("https://www.cracksat.net/sat/math-multiple-choice/test-1.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-2.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-3.html", "Math", "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-4.html", "Math", "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-5.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-6.html", "Math", "Easy"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-7.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-8.html", "Math", "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-9.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-10.html", "Math", "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-11.html", "Math", "Easy"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-12.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-13.html", "Math", "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-14.html", "Math", "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-15.html", "Math", "Easy"),
    # Grammar / Writing (verified working: /sat/grammar/ path)
    ("https://www.cracksat.net/sat/grammar/test-1.html", "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-2.html", "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-3.html", "Writing", "Hard"),
    ("https://www.cracksat.net/sat/grammar/test-4.html", "Writing", "Easy"),
    ("https://www.cracksat.net/sat/grammar/test-5.html", "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-6.html", "Writing", "Hard"),
    ("https://www.cracksat.net/sat/grammar/test-7.html", "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-8.html", "Writing", "Easy"),
    ("https://www.cracksat.net/sat/grammar/test-9.html", "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-10.html", "Writing", "Hard"),
]


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: FETCH QUESTIONS + ANSWERS FROM CRACKSAT
# ─────────────────────────────────────────────────────────────────────────────
def fetch_cracksat_page(url: str) -> tuple[str, dict]:
    """
    Returns (raw_question_text, correct_answer_map)
    correct_answer_map: {"1": "A", "2": "D", ...}
    """
    r = requests.get(url, headers={**HEADERS, "Referer": url}, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    mc = soup.find("div", class_="mcontent")
    if not mc:
        raise ValueError(f"No mcontent found at {url}")

    raw_text = mc.get_text(separator="\n")

    # Get answer key by submitting the form
    form = soup.find("form", action="/results.php")
    if not form:
        return raw_text, {}

    hidden = {i.get("name"): i.get("value") for i in form.find_all("input", type="hidden") if i.get("name")}
    radio_names = list(dict.fromkeys(
        i.get("name") for i in form.find_all("input", type="radio") if i.get("name")
    ))

    post_data = {**hidden, **{q: "A" for q in radio_names}}
    r2 = requests.post(
        "https://www.cracksat.net/results.php",
        data=post_data,
        headers={**HEADERS, "Referer": url, "Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    soup2 = BeautifulSoup(r2.text, "html.parser")
    mc2 = soup2.find("div", class_="mcontent")

    correct_map = {}
    if mc2:
        for row in mc2.find_all("tr")[1:]:  # skip header row
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) >= 2 and cols[0].isdigit():
                correct_map[cols[0]] = cols[1]

    log.info(f"  Fetched {len(correct_map)} answers from {url.split('/')[-1]}")
    return raw_text, correct_map


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: GROQ — PARSE + ENTITY SWAP IN ONE CALL
# ─────────────────────────────────────────────────────────────────────────────
PARSE_AND_SWAP_PROMPT = """You are a Digital SAT question processor. You will receive:
1. Raw text from a real SAT practice test
2. The correct answer key (question number → letter A/B/C/D)

Your job:
A. Parse the raw text into individual questions (question text + 4 options + correct answer letter)
B. Apply Entity Swap to each question:
   - Keep ALL math logic, grammar rules, reasoning structure IDENTICAL
   - Change: people's names, company names, place names, dollar amounts, specific numbers in word problems, product names
   - Do NOT change: mathematical operations, grammar rules being tested, logical structure, variable names in equations

Return a JSON array. Each element:
{
  "domain": "MUST be exactly one of: Information and Ideas | Craft and Structure | Expression of Ideas | Standard English Conventions | Algebra | Advanced Math | Problem-solving and Data Analysis | Geometry and Trigonometry",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "The entity-swapped question stem (for reading questions, include the passage THEN a blank line THEN the question)",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correct_answer": "exact text of correct option (must match one of the options strings exactly)",
  "rationale": "one sentence explaining why the correct answer is correct",
  "raw_original_text": "the original question text before entity swap (passage + stem for reading questions)"
}

Rules:
- Skip any question that relies on a diagram or image you cannot read
- Skip questions with blank/missing option text
- correct_answer must be exact text from the options array, NOT a letter
- Return ONLY the JSON array. No markdown, no extra text."""


def parse_and_swap(groq_client: Groq, raw_text: str, answer_map: dict, subject_hint: str, difficulty_hint: str) -> list[dict]:
    answer_str = ", ".join(f"{k}:{v}" for k, v in sorted(answer_map.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999))
    user_msg = (
        f"Subject: {subject_hint} | Difficulty hint: {difficulty_hint}\n"
        f"Correct answers: {answer_str}\n\n"
        f"Raw test text:\n{raw_text[:3000]}"
    )

    for attempt in range(3):
        try:
            resp = groq_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": PARSE_AND_SWAP_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=4000,
            )
            raw = resp.choices[0].message.content.strip()
            data = json.loads(raw)
            # Handle both {"questions": [...]} and [...] responses
            if isinstance(data, dict):
                questions = data.get("questions") or data.get("data") or list(data.values())[0]
            else:
                questions = data
            if isinstance(questions, list):
                return questions
        except json.JSONDecodeError as e:
            log.error(f"JSON parse error attempt {attempt+1}: {e}")
        except Exception as e:
            err = str(e)
            if "rate_limit" in err.lower() or "429" in err:
                wait = 20 * (2 ** attempt)
                log.warning(f"Rate limit, waiting {wait}s...")
                time.sleep(wait)
            else:
                log.error(f"Groq error: {e}")
                return []
    return []


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: VALIDATE
# ─────────────────────────────────────────────────────────────────────────────
def validate(q: dict) -> Optional[dict]:
    if not isinstance(q, dict):
        return None

    q_text = (q.get("question_text") or "").strip()
    if not q_text or len(q_text) < 20:
        return None

    bad = ["{", "http://", "https://", "api.", "status:", "message-type", "undefined"]
    if any(s in q_text for s in bad) or q_text.startswith("["):
        log.warning(f"Bad question_text content: {q_text[:80]}")
        return None

    domain = (q.get("domain") or "").strip()
    if domain not in VALID_DOMAINS:
        log.warning(f"Invalid domain: {domain}")
        return None

    difficulty = (q.get("difficulty") or "Medium").strip()
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = "Medium"

    module = DOMAIN_TO_MODULE.get(domain)
    if not module:
        return None

    options = q.get("options")
    if not isinstance(options, list) or len(options) != 4:
        log.warning("Options not 4-element array")
        return None

    # Clean options — strip any A./B./C./D. prefixes
    options = [re.sub(r"^[A-Da-d][\.\)]\s*", "", str(o)).strip() for o in options]
    if any(not o for o in options):
        return None

    correct = (q.get("correct_answer") or "").strip()
    correct = re.sub(r"^[A-Da-d][\.\)]\s*", "", correct).strip()

    if correct not in options:
        # Try letter→option resolution
        letter_map = {"A": options[0], "B": options[1], "C": options[2], "D": options[3]}
        if correct.upper() in letter_map:
            correct = letter_map[correct.upper()]
        else:
            log.warning(f"correct_answer not in options: {correct!r}")
            return None

    rationale = (q.get("rationale") or "").strip()
    if not rationale:
        rationale = f"The correct answer is '{correct}'."

    raw = (q.get("raw_original_text") or "").strip()

    return {
        "module": module,
        "domain": domain,
        "difficulty": difficulty,
        "question_text": q_text,
        "options": options,
        "correct_answer": correct,
        "rationale": rationale,
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "raw_original_text": raw or None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# INVENTORY + QUEUE
# ─────────────────────────────────────────────────────────────────────────────
def build_queue(supabase: Client) -> list:
    existing = {}
    try:
        rows = supabase.table("sat_question_bank").select("domain, difficulty").execute()
        for r in rows.data:
            k = (r["domain"], r["difficulty"])
            existing[k] = existing.get(k, 0) + 1
    except Exception as e:
        log.warning(f"Inventory read failed: {e}")

    scores = []
    for bucket in ALL_BUCKETS:
        actual = existing.get(bucket, 0)
        deficit = max(0, TARGET_PER_BUCKET - actual) + 1
        scores.append((bucket[0], bucket[1], deficit))

    total = sum(s[2] for s in scores)
    queue = []
    for domain, diff, deficit in scores:
        slots = max(1, round((deficit / total) * QUESTIONS_PER_RUN))
        for _ in range(slots):
            queue.append((domain, diff))

    random.shuffle(queue)
    return queue[:QUESTIONS_PER_RUN]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    log.info("=== REAL-SOURCE SCRAPER RUN START ===")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    groq_client = Groq(api_key=GROQ_API_KEY)

    # Pick a random selection of source pages, weighted toward thin buckets
    queue = build_queue(supabase)
    needs_math = any(d in MATH_DOMAINS for d, _ in queue)
    needs_rw = any(d in RW_DOMAINS for d, _ in queue)

    sources_to_use = []
    if needs_math:
        math_sources = [(u, s, d) for u, s, d in CRACKSAT_SOURCES if s == "Math"]
        sources_to_use.extend(random.sample(math_sources, min(3, len(math_sources))))
    if needs_rw:
        rw_sources = [(u, s, d) for u, s, d in CRACKSAT_SOURCES if s in ("Reading", "Writing")]
        sources_to_use.extend(random.sample(rw_sources, min(3, len(rw_sources))))

    if not sources_to_use:
        sources_to_use = random.sample(CRACKSAT_SOURCES, 4)

    random.shuffle(sources_to_use)

    inserted = 0
    skipped = 0

    for url, subject, difficulty_hint in sources_to_use:
        if inserted >= QUESTIONS_PER_RUN:
            break

        log.info(f"Fetching {url.split('/')[-1]} ({subject})...")
        try:
            raw_text, answer_map = fetch_cracksat_page(url)
        except Exception as e:
            log.error(f"Fetch failed for {url}: {e}")
            skipped += 1
            time.sleep(2)
            continue

        if not answer_map:
            log.warning(f"No answer key obtained for {url}")
            skipped += 1
            continue

        log.info(f"Parsing + entity-swapping {len(answer_map)} questions via Groq...")
        questions = parse_and_swap(groq_client, raw_text, answer_map, subject, difficulty_hint)
        log.info(f"Groq returned {len(questions)} questions")

        for q_raw in questions:
            if inserted >= QUESTIONS_PER_RUN:
                break

            payload = validate(q_raw)
            if not payload:
                skipped += 1
                continue

            try:
                # Dedup check
                existing = supabase.table("sat_question_bank") \
                    .select("id") \
                    .eq("question_text", payload["question_text"]) \
                    .limit(1).execute()
                if existing.data:
                    log.info("  Duplicate — skipping")
                    skipped += 1
                    continue

                supabase.table("sat_question_bank").insert(payload).execute()
                log.info(f"  ✓ Inserted: {payload['domain']} | {payload['difficulty']}")
                inserted += 1
            except Exception as e:
                log.error(f"  ✗ Insert failed: {e}")
                skipped += 1

        time.sleep(random.uniform(3.0, 5.0))

    log.info(f"=== DONE: {inserted} inserted, {skipped} skipped ===")


if __name__ == "__main__":
    main()
