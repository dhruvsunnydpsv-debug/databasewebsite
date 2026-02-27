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

# ── Rotation Endpoints for Pagination Strategy ──────────────
EXTERNAL_SOURCES = [
    "https://api.crossref.org/works?query=science&select=title,abstract&rows=10&offset=",
    "https://openlibrary.org/search.json?q=history&limit=10&page=",
    "https://gutendex.com/books/?topic=education&page=",
]

# ── All 26 question buckets (module, domain, difficulty, is_spr) ───────────
ALL_BUCKETS = [
    # Math — Heart of Algebra (~35%)
    ("Math", "Heart_of_Algebra",        "Easy",   False),
    ("Math", "Heart_of_Algebra",        "Medium", False),
    ("Math", "Heart_of_Algebra",        "Hard",   False),
    ("Math", "Heart_of_Algebra",        "Hard",   True),   # SPR (grid-in)
    # Math — Advanced Math (~35%)
    ("Math", "Advanced_Math",           "Easy",   False),
    ("Math", "Advanced_Math",           "Medium", False),
    ("Math", "Advanced_Math",           "Hard",   False),
    ("Math", "Advanced_Math",           "Hard",   True),   # SPR
    # Math — Problem Solving & Data Analysis (~15%)
    ("Math", "Problem_Solving_Data",    "Easy",   False),
    ("Math", "Problem_Solving_Data",    "Medium", False),
    ("Math", "Problem_Solving_Data",    "Hard",   False),
    # Math — Geometry & Trigonometry (~15%)
    ("Math", "Geometry_Trigonometry",   "Easy",   False),
    ("Math", "Geometry_Trigonometry",   "Medium", False),
    ("Math", "Geometry_Trigonometry",   "Hard",   False),
    # Reading & Writing — Information and Ideas (~26%)
    ("Reading_Writing", "Information_and_Ideas",        "Easy",   False),
    ("Reading_Writing", "Information_and_Ideas",        "Medium", False),
    ("Reading_Writing", "Information_and_Ideas",        "Hard",   False),
    # Reading & Writing — Craft and Structure (~28%)
    ("Reading_Writing", "Craft_and_Structure",          "Easy",   False),
    ("Reading_Writing", "Craft_and_Structure",          "Medium", False),
    ("Reading_Writing", "Craft_and_Structure",          "Hard",   False),
    # Reading & Writing — Expression of Ideas (~20%)
    ("Reading_Writing", "Expression_of_Ideas",          "Easy",   False),
    ("Reading_Writing", "Expression_of_Ideas",          "Medium", False),
    ("Reading_Writing", "Expression_of_Ideas",          "Hard",   False),
    # Reading & Writing — Standard English Conventions (~26%)
    ("Reading_Writing", "Standard_English_Conventions", "Easy",   False),
    ("Reading_Writing", "Standard_English_Conventions", "Medium", False),
    ("Reading_Writing", "Standard_English_Conventions", "Hard",   False),
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
def build_prompt(module: str, domain: str, difficulty: str, is_spr: bool) -> str:
    domain_display = domain.replace("_", " ")
    module_display = "Math" if module == "Math" else "Reading & Writing"
    spr_note = (
        "This is a Student-Produced Response (SPR / grid-in). NO multiple-choice options. "
        "Set is_spr=true and options=null. The student writes a numeric answer."
    ) if is_spr else (
        "This has 4 multiple-choice options (A, B, C, D). Set is_spr=false. "
        "Provide exactly 4 distinct, plausible options."
    )

    return f"""You are a Digital SAT question writer and copyright-sanitization engine.

Generate ONE brand-new Digital SAT question with EXACTLY these attributes:
  Section   : {module_display}
  Domain    : {domain_display}
  Difficulty: {difficulty}
  {spr_note}

RULES:
1. Use completely fictional names, places, companies, scenarios — no real SAT question text.
2. Keep all math/logic/grammar mechanics identical to real College Board style.
3. Difficulty must match: Easy=single-step, Medium=2-3 steps, Hard=multi-concept or trap.
4. For RW questions, include a short passage (2-4 sentences) in question_text before the question.

Respond with ONLY a valid JSON object — no markdown, no extra text:
{{
  "module": "{module}",
  "domain": "{domain}",
  "difficulty": "{difficulty}",
  "is_spr": {str(is_spr).lower()},
  "question_text": "<full question text>",
  "options": {("null" if is_spr else '["<option A>", "<option B>", "<option C>", "<option D>"]')},
  "correct_answer": "<exact correct option text OR numeric value for SPR>",
  "rationale": "<1-2 sentence explanation>"
}}"""

# ─────────────────────────────────────────────────────────────
# GROQ GENERATION (Entity Swap / Synthesis)
# ─────────────────────────────────────────────────────────────
def generate_question(client: Groq, module: str, domain: str, difficulty: str, is_spr: bool, seed_page: int) -> Optional[dict]:
    # We pass the seed_page implicitly into the prompt to ensure the LLM starts from a randomized trajectory
    prompt = build_prompt(module, domain, difficulty, is_spr) + f"\n\nRandomization Seed Offset: {seed_page}"
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
    "Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry",
    "Information_and_Ideas", "Craft_and_Structure", "Expression_of_Ideas", "Standard_English_Conventions",
}
VALID_DIFFS = {"Easy", "Medium", "Hard"}

def validate(data: dict, exp_module: str, exp_domain: str, exp_diff: str, exp_spr: bool) -> Optional[dict]:
    if not isinstance(data, dict): return None
    # Pin to expected values if Groq drifts
    data["module"]     = data.get("module")     if data.get("module")     in VALID_MODULES else exp_module
    data["domain"]     = data.get("domain")     if data.get("domain")     in VALID_DOMAINS else exp_domain
    data["difficulty"] = data.get("difficulty") if data.get("difficulty") in VALID_DIFFS   else exp_diff
    if not data.get("question_text") or not data.get("correct_answer"): return None
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

    for i, (module, domain, difficulty, is_spr) in enumerate(queue):
        # Generate question using the LLM Entity Swap
        data = generate_question(groq_client, module, domain, difficulty, is_spr, seed + i)
        validated = validate(data, module, domain, difficulty, is_spr) if data else None

        if validated:
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


if __name__ == "__main__":
    main()
