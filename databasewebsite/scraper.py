"""
scraper.py — SAT Foundation Question Pipeline v7
=================================================
Fetches REAL SAT questions from cracksat.net,
entity-swaps via Groq, validates against adaptive
system requirements, triple-deduplicates, then
inserts into Supabase.

Adaptive system targets:
  Easy:   300 per domain  (Module 1 + M2 Easy path)
  Medium: 400 per domain  (All modules — highest priority)
  Hard:   200 per domain  (Module 1 + M2 Hard path)

Total target: 8 domains × 900 = 7,200 questions
"""

import os, json, logging, random, time, re, hashlib
from typing import Optional
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from groq import Groq

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Credentials ─────────────────────────────────────────────────────────────
SUPABASE_URL  = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
GROQ_API_KEY  = os.environ["GROQ_API_KEY"]

MODEL              = "llama-3.3-70b-versatile"
QUESTIONS_PER_RUN  = 15   # max per run — respects Groq rate limits

# ── Adaptive system targets per domain ───────────────────────────────────────
TARGETS = {"Easy": 300, "Medium": 400, "Hard": 200}

# ── Domain / Module mappings ─────────────────────────────────────────────────
RW_DOMAINS = {
    "Information and Ideas", "Craft and Structure",
    "Expression of Ideas",   "Standard English Conventions",
}
MATH_DOMAINS = {
    "Algebra", "Advanced Math",
    "Problem-solving and Data Analysis", "Geometry and Trigonometry",
}
VALID_DOMAINS      = RW_DOMAINS | MATH_DOMAINS
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
DOMAIN_TO_MODULE   = {d: "Reading_Writing" for d in RW_DOMAINS}
DOMAIN_TO_MODULE.update({d: "Math" for d in MATH_DOMAINS})

ALL_BUCKETS = [
    (d, diff)
    for d in [
        "Information and Ideas", "Craft and Structure",
        "Expression of Ideas",   "Standard English Conventions",
        "Algebra", "Advanced Math",
        "Problem-solving and Data Analysis", "Geometry and Trigonometry",
    ]
    for diff in ["Easy", "Medium", "Hard"]
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# ── CrackSAT sources ─────────────────────────────────────────────────────────
CRACKSAT_SOURCES = [
    ("https://www.cracksat.net/sat/math-multiple-choice/test-1.html",  "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-2.html",  "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-3.html",  "Math",    "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-4.html",  "Math",    "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-5.html",  "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-6.html",  "Math",    "Easy"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-7.html",  "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-8.html",  "Math",    "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-9.html",  "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-10.html", "Math",    "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-11.html", "Math",    "Easy"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-12.html", "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-13.html", "Math",    "Hard"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-14.html", "Math",    "Medium"),
    ("https://www.cracksat.net/sat/math-multiple-choice/test-15.html", "Math",    "Easy"),
    ("https://www.cracksat.net/sat/grammar/test-1.html",               "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-2.html",               "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-3.html",               "Writing", "Hard"),
    ("https://www.cracksat.net/sat/grammar/test-4.html",               "Writing", "Easy"),
    ("https://www.cracksat.net/sat/grammar/test-5.html",               "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-6.html",               "Writing", "Hard"),
    ("https://www.cracksat.net/sat/grammar/test-7.html",               "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-8.html",               "Writing", "Easy"),
    ("https://www.cracksat.net/sat/grammar/test-9.html",               "Writing", "Medium"),
    ("https://www.cracksat.net/sat/grammar/test-10.html",              "Writing", "Hard"),
]

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: FETCH QUESTIONS + ANSWER KEY FROM CRACKSAT
# ─────────────────────────────────────────────────────────────────────────────
def fetch_cracksat_page(url: str) -> tuple[str, dict]:
    r = requests.get(url, headers={**HEADERS, "Referer": url}, timeout=15)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    mc = soup.find("div", class_="mcontent")
    if not mc:
        raise ValueError(f"No mcontent at {url}")

    raw_text = mc.get_text(separator="\n")

    form = soup.find("form", action="/results.php")
    if not form:
        return raw_text, {}

    hidden     = {i.get("name"): i.get("value") for i in form.find_all("input", type="hidden") if i.get("name")}
    radio_names = list(dict.fromkeys(i.get("name") for i in form.find_all("input", type="radio") if i.get("name")))
    post_data   = {**hidden, **{q: "A" for q in radio_names}}

    r2 = requests.post(
        "https://www.cracksat.net/results.php",
        data=post_data,
        headers={**HEADERS, "Referer": url, "Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    soup2     = BeautifulSoup(r2.text, "html.parser")
    mc2       = soup2.find("div", class_="mcontent")
    correct_map = {}
    if mc2:
        for row in mc2.find_all("tr")[1:]:
            cols = [c.get_text(strip=True) for c in row.find_all("td")]
            if len(cols) >= 2 and cols[0].isdigit():
                correct_map[cols[0]] = cols[1]

    log.info(f"  Fetched {len(correct_map)} answers from {url.split('/')[-1]}")
    return raw_text, correct_map


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: GROQ — PARSE + ENTITY SWAP
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a Digital SAT question processor for SAT Foundation.

INPUT: Raw text from a real SAT practice test + the correct answer key.

YOUR JOBS:
A) Parse into individual questions with 4 options each.
B) Entity Swap — change names, companies, places, dollar amounts, and numbers
   in word problems. Keep ALL math logic, grammar rules, and reasoning structure
   completely identical. Do NOT change variable names in equations.
C) Assign difficulty according to these strict criteria:
   - Easy:   Single-step reasoning. Basic vocabulary. Straightforward grammar rule.
   - Medium: 2–3 step reasoning. Moderate inference required. Moderate math.
   - Hard:   Multi-step reasoning. Complex passage synthesis. Advanced vocabulary.
             Non-obvious math requiring multiple concepts.

Return a JSON array of objects. Each object:
{
  "domain": "MUST be exactly one of: Information and Ideas | Craft and Structure | Expression of Ideas | Standard English Conventions | Algebra | Advanced Math | Problem-solving and Data Analysis | Geometry and Trigonometry",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "Entity-swapped question. For reading questions include the passage THEN a blank line THEN the question stem.",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correct_answer": "Exact text of correct option — must match one of the options strings character for character",
  "rationale": "One sentence explaining why the correct answer is correct and why the others are wrong.",
  "raw_original_text": "Original passage/question text BEFORE entity swap"
}

SKIP any question that:
- Relies on an image or diagram
- Has blank or near-identical options
- Has fewer than 4 distinct answer choices

Return ONLY the JSON array. No markdown fences. No extra text."""


def parse_and_swap(groq_client: Groq, raw_text: str, answer_map: dict,
                   subject_hint: str, difficulty_hint: str) -> list[dict]:
    answer_str = ", ".join(
        f"{k}:{v}" for k, v in sorted(answer_map.items(),
        key=lambda x: int(x[0]) if x[0].isdigit() else 999)
    )
    user_msg = (
        f"Subject: {subject_hint} | Difficulty hint: {difficulty_hint}\n"
        f"Correct answers: {answer_str}\n\n"
        f"Raw test text:\n{raw_text[:3500]}"
    )

    for attempt in range(3):
        try:
            resp = groq_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=4096,
            )
            raw  = resp.choices[0].message.content.strip()
            data = json.loads(raw)
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
                wait = 25 * (2 ** attempt)
                log.warning(f"Rate limit — waiting {wait}s…")
                time.sleep(wait)
            else:
                log.error(f"Groq error: {e}")
                return []
    return []


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: VALIDATE — quality + difficulty calibration
# ─────────────────────────────────────────────────────────────────────────────
BANNED_CONTENT = ["{", "http://", "https://", "api.", "status:", "undefined",
                  "[object", "null", "N/A", "Option A", "Option B", "Choice 1",
                  "Answer here", "placeholder"]

def validate(q: dict) -> Optional[dict]:
    if not isinstance(q, dict):
        return None

    q_text = (q.get("question_text") or "").strip()
    if len(q_text) < 40:
        log.warning(f"question_text too short ({len(q_text)} chars)")
        return None
    if any(s in q_text for s in BANNED_CONTENT) or q_text.startswith("["):
        log.warning(f"Banned content in question_text: {q_text[:80]}")
        return None

    domain = (q.get("domain") or "").strip()
    if domain not in VALID_DOMAINS:
        log.warning(f"Invalid domain: {domain!r}")
        return None

    difficulty = (q.get("difficulty") or "Medium").strip()
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = "Medium"

    # Difficulty calibration — override obvious mismatches
    lower_q = q_text.lower()
    if difficulty == "Hard" and len(q_text) < 150 and "which" in lower_q and "most nearly mean" in lower_q:
        difficulty = "Easy"   # vocabulary questions are never Hard
    if difficulty == "Easy" and q_text.count("\n") > 6 and len(q_text) > 600:
        difficulty = "Medium" # long passage questions are at least Medium

    module = DOMAIN_TO_MODULE.get(domain)
    if not module:
        return None

    options = q.get("options")
    if not isinstance(options, list) or len(options) != 4:
        log.warning("Options not a 4-element array")
        return None

    # Clean option prefixes (A. B. C. D.)
    options = [re.sub(r"^[A-Da-d][\.\)\-]\s*", "", str(o)).strip() for o in options]

    # Each option must be substantive
    if any(len(o) < 5 for o in options):
        log.warning("Option too short")
        return None

    # No duplicate options
    if len(set(options)) < 4:
        log.warning("Duplicate options detected")
        return None

    # No banned content in options
    if any(b in opt for b in BANNED_CONTENT for opt in options):
        log.warning("Banned content in options")
        return None

    correct = (q.get("correct_answer") or "").strip()
    correct = re.sub(r"^[A-Da-d][\.\)\-]\s*", "", correct).strip()

    if correct not in options:
        letter_map = {"A": options[0], "B": options[1], "C": options[2], "D": options[3]}
        if correct.upper() in letter_map:
            correct = letter_map[correct.upper()]
        else:
            log.warning(f"correct_answer not in options: {correct!r}")
            return None

    rationale = (q.get("rationale") or "").strip()
    if len(rationale) < 20:
        rationale = f"The correct answer is '{correct}'."

    raw = (q.get("raw_original_text") or "").strip()

    return {
        "module":            module,
        "domain":            domain,
        "difficulty":        difficulty,
        "question_text":     q_text,
        "options":           options,
        "correct_answer":    correct,
        "rationale":         rationale,
        "is_spr":            False,
        "source_method":     "Automated_Pipeline",
        "raw_original_text": raw or None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: TRIPLE DEDUPLICATION
# ─────────────────────────────────────────────────────────────────────────────
def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation for fuzzy matching."""
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text

def _fingerprint(payload: dict) -> str:
    """Hash of options — catches same question with different entity swap."""
    combined = "".join(sorted(_normalize(o) for o in payload["options"]))
    return hashlib.md5(combined.encode()).hexdigest()

def is_duplicate(supabase: Client, payload: dict) -> bool:
    q_text = payload["question_text"]
    raw    = payload.get("raw_original_text") or ""

    # Check 1 — exact question_text match
    r1 = supabase.table("sat_question_bank") \
        .select("id").eq("question_text", q_text).limit(1).execute()
    if r1.data:
        log.info("  DUPLICATE (exact text match)")
        return True

    # Check 2 — first 120 characters match (catches minor rewording)
    prefix = q_text[:120]
    r2 = supabase.table("sat_question_bank") \
        .select("id").like("question_text", prefix + "%").limit(1).execute()
    if r2.data:
        log.info("  DUPLICATE (prefix match)")
        return True

    # Check 3 — same raw_original_text (same source question, different swap)
    if raw and len(raw) > 30:
        r3 = supabase.table("sat_question_bank") \
            .select("id").eq("raw_original_text", raw).limit(1).execute()
        if r3.data:
            log.info("  DUPLICATE (raw_original_text match — same source question)")
            return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: INVENTORY + PRIORITY QUEUE
# ─────────────────────────────────────────────────────────────────────────────
def get_inventory(supabase: Client) -> dict:
    try:
        rows = supabase.table("sat_question_bank").select("domain, difficulty").execute()
        counts: dict = {}
        for r in rows.data:
            k = (r["domain"], r["difficulty"])
            counts[k] = counts.get(k, 0) + 1
        return counts
    except Exception as e:
        log.warning(f"Inventory read failed: {e}")
        return {}

def print_inventory(counts: dict):
    log.info("── INVENTORY ─────────────────────────────────")
    total = sum(counts.values())
    for domain in sorted(VALID_DOMAINS):
        for diff in ["Easy", "Medium", "Hard"]:
            have   = counts.get((domain, diff), 0)
            target = TARGETS[diff]
            bar    = "█" * min(20, int(have / target * 20))
            log.info(f"  {domain[:35]:<35} {diff:<6} {have:>3}/{target} {bar}")
    log.info(f"  TOTAL: {total}")
    log.info("───────────────────────────────────────────────")

def build_priority_queue(counts: dict) -> list:
    """
    Returns a list of (domain, difficulty) pairs weighted by deficit.
    Highest deficit = most runs allocated.
    Buckets already at target are excluded.
    """
    deficits = []
    for bucket in ALL_BUCKETS:
        domain, diff = bucket
        have    = counts.get(bucket, 0)
        target  = TARGETS[diff]
        deficit = max(0, target - have)
        if deficit > 0:
            deficits.append((domain, diff, deficit))

    if not deficits:
        log.info("All buckets at target — nothing to do.")
        return []

    total_deficit = sum(d[2] for d in deficits)
    queue = []
    for domain, diff, deficit in deficits:
        slots = max(1, round((deficit / total_deficit) * QUESTIONS_PER_RUN))
        for _ in range(slots):
            queue.append((domain, diff))

    random.shuffle(queue)
    return queue[:QUESTIONS_PER_RUN]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    log.info("═══════════════════════════════════════════")
    log.info("SAT FOUNDATION SCRAPER RUN START")
    log.info("═══════════════════════════════════════════")

    supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)
    groq_client  = Groq(api_key=GROQ_API_KEY)

    # Inventory
    counts = get_inventory(supabase)
    print_inventory(counts)

    # Priority queue
    queue = build_priority_queue(counts)
    if not queue:
        log.info("All buckets satisfied — exiting.")
        return

    log.info(f"Priority queue: {queue[:5]}…")

    # Pick sources that match needed subjects
    needs_math = any(d in MATH_DOMAINS for d, _ in queue)
    needs_rw   = any(d in RW_DOMAINS   for d, _ in queue)

    sources = []
    if needs_math:
        math_src = [(u, s, d) for u, s, d in CRACKSAT_SOURCES if s == "Math"]
        sources.extend(random.sample(math_src, min(3, len(math_src))))
    if needs_rw:
        rw_src = [(u, s, d) for u, s, d in CRACKSAT_SOURCES if s == "Writing"]
        sources.extend(random.sample(rw_src, min(3, len(rw_src))))
    if not sources:
        sources = random.sample(CRACKSAT_SOURCES, 4)
    random.shuffle(sources)

    inserted   = 0
    dup_skip   = 0
    qual_skip  = 0

    for url, subject, difficulty_hint in sources:
        if inserted >= QUESTIONS_PER_RUN:
            break

        log.info(f"\nFetching {url.split('/')[-1]} ({subject})…")
        try:
            raw_text, answer_map = fetch_cracksat_page(url)
        except Exception as e:
            log.error(f"Fetch failed: {e}")
            qual_skip += 1
            time.sleep(2)
            continue

        if not answer_map:
            log.warning("No answer key — skipping page")
            continue

        log.info(f"Parsing {len(answer_map)} questions via Groq…")
        questions = parse_and_swap(groq_client, raw_text, answer_map, subject, difficulty_hint)
        log.info(f"Groq returned {len(questions)} questions")

        for q_raw in questions:
            if inserted >= QUESTIONS_PER_RUN:
                break

            # Validate
            payload = validate(q_raw)
            if not payload:
                qual_skip += 1
                continue

            # Triple deduplication
            try:
                if is_duplicate(supabase, payload):
                    dup_skip += 1
                    continue
            except Exception as e:
                log.error(f"Dedup check error: {e}")
                continue

            # Insert
            try:
                supabase.table("sat_question_bank").insert(payload).execute()
                log.info(
                    f"  ✓ INSERTED: {payload['domain']} | "
                    f"{payload['difficulty']} | "
                    f"correct='{payload['correct_answer'][:30]}…'"
                )
                inserted += 1
            except Exception as e:
                log.error(f"  ✗ Insert failed: {e}")
                qual_skip += 1

        time.sleep(random.uniform(3.0, 5.0))

    # Final report
    final_counts  = get_inventory(supabase)
    final_total   = sum(final_counts.values())
    still_thin    = sorted(
        [(d, diff, TARGETS[diff] - final_counts.get((d, diff), 0))
         for d, diff in ALL_BUCKETS
         if final_counts.get((d, diff), 0) < TARGETS[diff]],
        key=lambda x: x[2], reverse=True
    )

    log.info("\n═══════════════════════════════════════════")
    log.info("RUN COMPLETE — SUMMARY")
    log.info(f"  Inserted this run:        {inserted}")
    log.info(f"  Skipped (duplicates):     {dup_skip}")
    log.info(f"  Skipped (quality/errors): {qual_skip}")
    log.info(f"  Total in DB now:          {final_total}")
    log.info(f"  Remaining deficit:        {sum(x[2] for x in still_thin)}")
    log.info("  Top 5 under-stocked buckets:")
    for domain, diff, deficit in still_thin[:5]:
        have = final_counts.get((domain, diff), 0)
        log.info(f"    {domain[:35]:<35} {diff:<6} {have}/{TARGETS[diff]} (need +{deficit})")
    log.info("═══════════════════════════════════════════")


if __name__ == "__main__":
    main()
