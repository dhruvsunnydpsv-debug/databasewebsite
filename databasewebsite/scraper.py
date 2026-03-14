"""
scraper.py — SAT Automated Scraper v3 (Groq-powered)
=========================================================
Runs every 15 min via GitHub Actions.
Uses Groq's free API (Llama 3.3-70b) — 14,400 req/day free, no credit card.

Per run:
  1. Reads sat_question_bank to compute per-bucket deficits (self-balancing).
  2. Builds a 25-question queue weighted toward thinnest domain/difficulty buckets.
  3. Calls Groq API (llama-3.3-70b-versatile) to synthesize + entity-swap each question.
  4. Validates JSON schema and inserts into Supabase.
"""

import os
import json
import logging
import random
import time
from typing import Optional
from supabase import create_client, Client
from groq import Groq

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]

QUESTIONS_PER_RUN = 25        # 25q × 96 runs/day = 2,400/day
MODEL = "llama-3.3-70b-versatile"

# ── Rotation Sources for clean text context ──────────────
EXTERNAL_SOURCES = [
    "https://gutendex.com/books/?topic=science&page=",
    "https://gutendex.com/books/?topic=history&page=",
    "https://gutendex.com/books/?topic=literature&page=",
    "https://newsapi.org/v2/everything?q=technology&pageSize=5&page=", # Note: Needs key if used, otherwise fallback
]

# ── All 16 core question buckets (module, domain, difficulty, is_spr) ───────────
ALL_BUCKETS = [
    # Math — Algebra (~35%)
    ("Math", "Algebra",                           "Easy",   False),
    ("Math", "Algebra",                           "Medium", False),
    ("Math", "Algebra",                           "Hard",   False),
    ("Math", "Algebra",                           "Hard",   True),
    # Math — Advanced Math (~35%)
    ("Math", "Advanced Math",                     "Easy",   False),
    ("Math", "Advanced Math",                     "Medium", False),
    ("Math", "Advanced Math",                     "Hard",   False),
    ("Math", "Advanced Math",                     "Hard",   True),
    # Math — Problem-solving and Data Analysis (~15%)
    ("Math", "Problem-solving and Data Analysis", "Easy",   False),
    ("Math", "Problem-solving and Data Analysis", "Medium", False),
    ("Math", "Problem-solving and Data Analysis", "Hard",   False),
    # Math — Geometry and Trigonometry (~15%)
    ("Math", "Geometry and Trigonometry",         "Easy",   False),
    ("Math", "Geometry and Trigonometry",         "Medium", False),
    ("Math", "Geometry and Trigonometry",         "Hard",   False),

    # Reading & Writing — Craft and Structure (~28%)
    ("Reading_Writing", "Craft and Structure",          "Easy",   False),
    ("Reading_Writing", "Craft and Structure",          "Medium", False),
    ("Reading_Writing", "Craft and Structure",          "Hard",   False),
    # Reading & Writing — Information and Ideas (~26%)
    ("Reading_Writing", "Information and Ideas",        "Easy",   False),
    ("Reading_Writing", "Information_and_Ideas",        "Medium", False),
    ("Reading_Writing", "Information and Ideas",        "Hard",   False),
    # Reading & Writing — Standard English Conventions (~26%)
    ("Reading_Writing", "Standard English Conventions", "Easy",   False),
    ("Reading_Writing", "Standard English Conventions", "Medium", False),
    ("Reading_Writing", "Standard English Conventions", "Hard",   False),
    # Reading & Writing — Expression of Ideas (~20%)
    ("Reading_Writing", "Expression of Ideas",          "Easy",   False),
    ("Reading_Writing", "Expression of Ideas",          "Medium", False),
    ("Reading_Writing", "Expression of Ideas",          "Hard",   False),
]

TARGET_PER_BUCKET = 500  # Long-term target; drives deficit weighting

# ─────────────────────────────────────────────────────────────
# SELF-BALANCING QUEUE BUILDER
# ─────────────────────────────────────────────────────────────
def build_target_queue(supabase: Client) -> list:
    log.info("Querying inventory for self-balancing analysis…")

    existing: dict = {}
    try:
        rows = supabase.table("sat_question_bank").select("module, domain, difficulty, is_spr").execute()
        for r in rows.data:
            key = (r["module"], r["domain"], r["difficulty"], bool(r.get("is_spr", False)))
            existing[key] = existing.get(key, 0) + 1
    except Exception as e:
        log.warning(f"Could not read inventory (table may be empty): {e}")

    # Score each bucket by deficit — emptier = higher weight
    scores = []
    for bucket in ALL_BUCKETS:
        module, domain, difficulty, is_spr = bucket
        actual = existing.get(bucket, 0)
        deficit = max(0, TARGET_PER_BUCKET - actual) + 1
        scores.append((module, domain, difficulty, is_spr, deficit))
        log.info(f"  {module} | {domain} | {difficulty} | SPR={is_spr} → {actual} (deficit {deficit})")

    total_deficit = sum(s[4] for s in scores)
    queue = []
    for module, domain, difficulty, is_spr, deficit in scores:
        slots = max(1, round((deficit / total_deficit) * QUESTIONS_PER_RUN))
        for _ in range(slots):
            queue.append((module, domain, difficulty, is_spr))

    random.shuffle(queue)
    queue = queue[:QUESTIONS_PER_RUN]
    while len(queue) < QUESTIONS_PER_RUN:
        queue.append(random.choice(queue))

    log.info(f"Queue built: {len(queue)} questions across {len(set(queue))} unique buckets.")
    return queue

# ─────────────────────────────────────────────────────────────
# PROMPT BUILDER
# ─────────────────────────────────────────────────────────────
# ── Sub-domain Map (Syllabus 2026) ──────────────
SUBDOMAINS = {
    "Algebra": ["Linear equations in one variable", "Linear equations in two variables", "Linear functions", "Systems of two linear equations", "Linear inequalities"],
    "Advanced Math": ["Equivalent expressions", "Nonlinear equations in one variable", "Systems of equations in two variables", "Nonlinear functions"],
    "Problem-solving and Data Analysis": ["Ratios, rates, proportional relationships", "Percentages", "One-variable data", "Two-variable data", "Probability and conditional probability"],
    "Geometry and Trigonometry": ["Area and volume formulae", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"],
    "Craft and Structure": ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"],
    "Information and Ideas": ["Central Ideas and Details", "Command of Evidence (Textual)", "Command of Evidence (Quantitative)"],
    "Standard English Conventions": ["Boundaries", "Form, Structure, and Sense"],
    "Expression of Ideas": ["Rhetorical Synthesis", "Transitions"]
}

def build_prompt(module: str, domain: str, difficulty: str, is_spr: bool, raw_source: str) -> str:
    sub_choices = SUBDOMAINS.get(domain, [])
    sd = random.choice(sub_choices) if sub_choices else "General"
    
    spr_note = (
        "SPR / Grid-in. NO options. Numeric answer."
    ) if is_spr else (
        "Multiple-choice. 4 distinct options (A, B, C, D)."
    )

    return f"""You are an elite Digital SAT content creator for the 2026 Syllabus.
TASK: Generate ONE high-fidelity question based on these constraints:
  Module    : {module}
  Domain    : {domain}
  Sub-domain: {sd}
  Difficulty: {difficulty}
  Format    : {spr_note}

JSON Schema:
{{
  "module": "{module}",
  "domain": "{domain}",
  "sub_domain": "{sd}",
  "difficulty": "{difficulty}",
  "is_spr": {str(is_spr).lower()},
  "question_text": "The full question text. For RW, must include a high-quality passage.",
  "options": {("null" if is_spr else '["Choice A", "Choice B", "Choice C", "Choice D"]')},
  "correct_answer": "The exact correct response string.",
  "rationale": "Logical explanation of why this is correct."
}}

RULES:
1. PASSAGE QUALITY: If RW, write a sophisticated 3-5 sentence passage. DO NOT use JSON, code, or metadata in texts.
2. ENTITY SWAP: If using the provided RAW_SOURCE, change all names, dates, and locations.
3. LOGIC CHECK: Ensure the correct_answer is mathematically or grammatically flawless.
4. JSON ONLY: Your entire response must be the JSON object. No preamble.

RAW SOURCE MATERIAL (Scraped context):
---
{raw_source}
---"""


# ─────────────────────────────────────────────────────────────
# GROQ GENERATION (Entity Swap / Synthesis)
# ─────────────────────────────────────────────────────────────
def generate_question(client: Groq, module: str, domain: str, difficulty: str, is_spr: bool, seed_page: int, raw_source: str) -> Optional[dict]:
    # We pass the seed_page implicitly into the prompt to ensure the LLM starts from a randomized trajectory
    prompt = build_prompt(module, domain, difficulty, is_spr, raw_source) + f"\n\nRandomization Seed Offset: {seed_page}"
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.8,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            log.error(f"JSON parse error (attempt {attempt+1}): {e}")
            return None
        except Exception as e:
            err = str(e)
            if "rate_limit" in err.lower() or "429" in err:
                wait = 10 * (2 ** attempt)  # 10s, 20s, 40s
                log.warning(f"Rate limit hit (attempt {attempt+1}). Waiting {wait}s…")
                time.sleep(wait)
            else:
                log.error(f"Groq error: {e}")
                return None
    log.error("All retries exhausted.")
    return None

# ─────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────
VALID_MODULES = {"Math", "Reading_Writing"}
VALID_DOMAINS = {
    "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry",
    "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas",
}
VALID_DIFFS = {"Easy", "Medium", "Hard"}

def is_valid_text(txt: str) -> bool:
    """Detects if the text looks like raw JSON, code, or metadata."""
    if not txt: return False
    # Heuristics for JSON/Code leakage
    if txt.strip().startswith("{") or txt.strip().startswith("["): return False
    if "{" in txt and "}" in txt and ":" in txt: return False # Potential object snippet
    if "http://" in txt or "https://" in txt: return False # No URLs in SAT questions
    if "api." in txt or ".org" in txt: return False # Metadata leakage
    return True

def validate(data: dict, exp_module: str, exp_domain: str, exp_diff: str, exp_spr: bool) -> Optional[dict]:
    if not isinstance(data, dict): return None
    # Hard validation of text quality
    q_text = data.get("question_text", "")
    if not is_valid_text(q_text):
        log.warning("Detected JSON/Code leakage in question_text — rejecting row.")
        return None

    # Pin to expected values if Groq drifts
    data["module"]     = data.get("module")     if data.get("module")     in VALID_MODULES else exp_module
    data["domain"]     = data.get("domain")     if data.get("domain")     in VALID_DOMAINS else exp_domain
    data["difficulty"] = data.get("difficulty") if data.get("difficulty") in VALID_DIFFS   else exp_diff
    
    if not q_text or not data.get("correct_answer"): return None
    
    is_spr = bool(data.get("is_spr", exp_spr))
    data["is_spr"] = is_spr
    if is_spr:
        data["options"] = None
    else:
        opts = data.get("options")
        if not isinstance(opts, list) or len(opts) != 4:
            log.warning("Options malformed — skipping.")
            return None
    data["source_method"] = "Automated_Pipeline"
    data.pop("id", None)
    return data

# ─────────────────────────────────────────────────────────────
# MAIN EXECUTION CORE
# ─────────────────────────────────────────────────────────────
def main():
    print("--- STARTING HARVESTER RUN ---")
    
    # 1. DYNAMIC PAGINATION
    seed = random.randint(1, 1000)
    target_url = random.choice(EXTERNAL_SOURCES) + str(seed)
    print(f"Targeting URL: {target_url}")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    groq_client = Groq(api_key=GROQ_API_KEY)

    queue = build_target_queue(supabase)
    log.info(f"Processing {len(queue)} questions based on current inventory deficits…")

    inserted = 0
    skipped  = 0

    # Fetch raw source snippet
    import urllib.request
    try:
        req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            raw_html = response.read()[:3000].decode("utf-8", errors="ignore")
    except Exception as e:
        log.warning(f"Could not scrape target URL: {e}. Passing empty raw text.")
        raw_html = "(Simulated random conceptual math or reading text due to network block)"

    for i, (module, domain, difficulty, is_spr) in enumerate(queue):
        # Generate question using the LLM Entity Swap
        data = generate_question(groq_client, module, domain, difficulty, is_spr, seed + i, raw_html)
        validated = validate(data, module, domain, difficulty, is_spr) if data else None

        if validated:
            validated['raw_original_text'] = raw_html
            q_text = validated['question_text']
            # 2. DUPLICATE AVOIDANCE
            try:
                # Check if exact question already exists to avoid throwing raw database constraints
                existing = supabase.table("sat_question_bank").select("id").eq("question_text", q_text).limit(1).execute()
                if existing.data and len(existing.data) > 0:
                    skipped += 1
                    continue
                
                # Insert the deduplicated payload
                supabase.table("sat_question_bank").insert(validated).execute()
                print(f"Successfully Synthesized: {domain} | {difficulty}")
                inserted += 1
            except Exception as e:
                log.error(f"  ✗ Insert failed: {e}")
                skipped += 1
        else:
            skipped += 1

        time.sleep(random.uniform(2.0, 3.5))

    print(f"RUN COMPLETE. Successfully injected {inserted} new questions into Supabase. Skipped {skipped} duplicates.")

    # ── AUTO-REPAIR SWEEP ────────────────────────────────────
    # After every harvest run, scan the entire DB for rows with
    # broken domain tags or missing raw_original_text and fix them.
    auto_repair_untagged(supabase, groq_client)


# ─────────────────────────────────────────────────────────────
# AUTO-REPAIR: Fix rows with invalid tags or missing raw text
# ─────────────────────────────────────────────────────────────
def auto_repair_untagged(supabase: Client, groq_client: Groq):
    """
    Automatically called at the end of every scraper run.
    Finds questions whose domain is NOT in the strict Enum list
    and re-classifies them via Groq.
    """
    print("--- AUTO-REPAIR SWEEP STARTING ---")

    # Fetch ALL rows — we'll filter client-side for broken tags
    try:
        response = supabase.table("sat_question_bank") \
            .select("id, module, domain, difficulty, question_text, raw_original_text") \
            .limit(1000) \
            .execute()
        rows = response.data or []
    except Exception as e:
        log.error(f"Auto-repair: could not fetch rows: {e}")
        return

    broken = [r for r in rows if r.get("domain") not in VALID_DOMAINS or r.get("module") not in VALID_MODULES]

    if not broken:
        print("Auto-repair: All rows have valid tags. Nothing to fix.")
        return

    # Cap at 20 repairs per run to stay within the 10-min GitHub Actions timeout.
    # Over successive 15-min cron runs, all broken rows will eventually be fixed.
    REPAIR_BATCH_SIZE = 10
    batch = broken[:REPAIR_BATCH_SIZE]
    print(f"Auto-repair: Found {len(broken)} rows with invalid tags. Repairing batch of {len(batch)}…")

    repaired = 0
    failed = 0

    for row in batch:
        rid = row["id"]
        qtext = row.get("question_text", "")

        repair_prompt = f"""You are a strict database evaluation engine.
Below is a SAT question. Categorize it using EXACTLY these Allowed Enums.
DO NOT make up your own tags. Pick the single best match.

ALLOWED MODULES: "Math", "Reading_Writing"
ALLOWED DOMAINS:
  For Math: "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry"
  For Reading_Writing: "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"
ALLOWED DIFFICULTIES: "Easy", "Medium", "Hard"

QUESTION TEXT:
{qtext}

Respond in plain JSON only (no markdown):
{{"module": "<module>", "domain": "<domain>", "difficulty": "<difficulty>"}}"""

        try:
            resp = groq_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": repair_prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            tags = json.loads(resp.choices[0].message.content.strip())
            m = tags.get("module")
            d = tags.get("domain")
            df = tags.get("difficulty")

            if m in VALID_MODULES and d in VALID_DOMAINS and df in VALID_DIFFS:
                update = {"module": m, "domain": d, "difficulty": df}
                # Also backfill raw_original_text if it's missing
                if not row.get("raw_original_text"):
                    update["raw_original_text"] = f"[Auto-backfilled] Original question text before entity swap was not captured for this legacy row."
                supabase.table("sat_question_bank").update(update).eq("id", rid).execute()
                print(f"  ✓ Repaired ID {rid}: {m} | {d} | {df}")
                repaired += 1
            else:
                log.warning(f"  ✗ Groq returned invalid tags for ID {rid}: {m} | {d} | {df}")
                failed += 1
        except Exception as e:
            log.error(f"  ✗ Repair failed for ID {rid}: {e}")
            failed += 1

        time.sleep(1.5)  # Rate limit buffer

    print(f"--- AUTO-REPAIR COMPLETE: Fixed {repaired}, Failed {failed} ---")


if __name__ == "__main__":
    main()
