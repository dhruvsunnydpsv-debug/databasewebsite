"""
scraper.py — SAT Automated Harvester v2
=======================================
Runs every 15 minutes via GitHub Actions.
Per run:
  1. Queries Supabase view_inventory to find under-represented domain/difficulty buckets.
  2. Builds a TARGET QUEUE of ~100 questions, weighted toward the thinnest buckets.
  3. Generates questions using Gemini API (no raw scraping needed — Gemini synthesizes
     College-Board-style questions directly for each bucket).
  4. Issues entity-swap + categorization in one combined prompt.
  5. Inserts validated records into sat_question_bank.

Anti-ban / rate-limit controls:
  - Random delay between Gemini calls (1.5–4.0 s).
  - Gemini API has per-minute quota; we respect it with delays.
  - Each call generates 1 question → 100 calls / run.
"""

import os
import json
import logging
import random
import time
from typing import Optional
from supabase import create_client, Client
from google import genai

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]

QUESTIONS_PER_RUN = 100

# ── Domain meta ──────────────────────────────────────────────
ALL_BUCKETS = [
    # (module, domain, difficulty, is_spr_possible, target_ratio)
    # Math — 70% of run → 70 q
    ("Math", "Heart_of_Algebra",        "Easy",   False, 0.044),
    ("Math", "Heart_of_Algebra",        "Medium", False, 0.062),
    ("Math", "Heart_of_Algebra",        "Hard",   False, 0.044),
    ("Math", "Heart_of_Algebra",        "Hard",   True,  0.018),  # SPR Hard
    ("Math", "Advanced_Math",           "Easy",   False, 0.044),
    ("Math", "Advanced_Math",           "Medium", False, 0.062),
    ("Math", "Advanced_Math",           "Hard",   False, 0.044),
    ("Math", "Advanced_Math",           "Hard",   True,  0.018),  # SPR Hard
    ("Math", "Problem_Solving_Data",    "Easy",   False, 0.025),
    ("Math", "Problem_Solving_Data",    "Medium", False, 0.038),
    ("Math", "Problem_Solving_Data",    "Hard",   False, 0.025),
    ("Math", "Geometry_Trigonometry",   "Easy",   False, 0.025),
    ("Math", "Geometry_Trigonometry",   "Medium", False, 0.038),
    ("Math", "Geometry_Trigonometry",   "Hard",   False, 0.025),
    # RW — 30% of run → 30 q
    ("Reading_Writing", "Information_and_Ideas",         "Easy",   False, 0.025),
    ("Reading_Writing", "Information_and_Ideas",         "Medium", False, 0.038),
    ("Reading_Writing", "Information_and_Ideas",         "Hard",   False, 0.025),
    ("Reading_Writing", "Craft_and_Structure",           "Easy",   False, 0.025),
    ("Reading_Writing", "Craft_and_Structure",           "Medium", False, 0.038),
    ("Reading_Writing", "Craft_and_Structure",           "Hard",   False, 0.025),
    ("Reading_Writing", "Expression_of_Ideas",           "Easy",   False, 0.019),
    ("Reading_Writing", "Expression_of_Ideas",           "Medium", False, 0.025),
    ("Reading_Writing", "Expression_of_Ideas",           "Hard",   False, 0.019),
    ("Reading_Writing", "Standard_English_Conventions",  "Easy",   False, 0.019),
    ("Reading_Writing", "Standard_English_Conventions",  "Medium", False, 0.025),
    ("Reading_Writing", "Standard_English_Conventions",  "Hard",   False, 0.019),
]

# ─────────────────────────────────────────────────────────────
# COMBINED CATEGORIZATION + ENTITY SWAP PROMPT
# ─────────────────────────────────────────────────────────────
def build_prompt(module: str, domain: str, difficulty: str, is_spr: bool) -> str:
    domain_display = domain.replace("_", " ")
    module_display = "Math" if module == "Math" else "Reading & Writing"
    spr_note = (
        "This question is a Student-Produced Response (SPR / grid-in). "
        "There are NO multiple-choice options. The student must calculate and enter the answer. "
        "Set is_spr=true and options=null."
    ) if is_spr else (
        "This question has 4 multiple-choice options (A, B, C, D). "
        "Set is_spr=false and provide exactly 4 distinct options."
    )

    return f"""You are an elite Digital SAT question architect and copyright-sanitization engine.

TASK:
Generate one brand-new Digital SAT question with these EXACT attributes:
  - Section  : {module_display}
  - Domain   : {domain_display}
  - Difficulty: {difficulty}
  - {spr_note}

ENTITY SWAP RULES (mandatory):
1. Use entirely fictional names, places, companies, and scenarios.
2. Do NOT copy any question, sentence, or passage verbatim from any real SAT exam.
3. Preserve all mathematical logic, equation structures, and grammar conventions exactly as the College Board would.
4. The difficulty MUST match {difficulty}: Easy = single-step, Medium = 2-3 steps, Hard = multi-concept or trap answers.

OUTPUT FORMAT — respond with ONLY a JSON object, no markdown, no extra text:
{{
  "module": "{module}",
  "domain": "{domain}",
  "difficulty": "{difficulty}",
  "is_spr": {str(is_spr).lower()},
  "question_text": "<full question text, including any passage for RW>",
  "options": {("null" if is_spr else '["<option A>", "<option B>", "<option C>", "<option D>"]')},
  "correct_answer": "<exact text of correct option OR exact numeric value for SPR>",
  "rationale": "<1–2 sentence explanation of why the answer is correct>"
}}"""

# ─────────────────────────────────────────────────────────────
# TARGET QUEUE BUILDER (self-balancing)
# ─────────────────────────────────────────────────────────────
def build_target_queue(supabase: Client) -> list[tuple]:
    """
    Queries view_inventory to determine which buckets are thinnest.
    Returns a list of (module, domain, difficulty, is_spr) tuples totalling ~QUESTIONS_PER_RUN.
    Thinner buckets receive proportionally more weight.
    """
    log.info("Querying view_inventory for self-balancing analysis...")
    
    # Fetch current counts
    existing: dict[tuple, int] = {}
    try:
        rows = supabase.table("sat_question_bank").select("module, domain, difficulty, is_spr").execute()
        for r in rows.data:
            key = (r["module"], r["domain"], r["difficulty"], r.get("is_spr", False))
            existing[key] = existing.get(key, 0) + 1
    except Exception as e:
        log.warning(f"Could not read inventory (table might be empty): {e}")

    # Compute deficit score for each bucket
    # deficit = max(0, expected_count - actual_count) + 1
    # Higher deficit → more questions this run
    TARGET_TOTAL = 500  # long-term target per bucket
    scores = []
    for bucket in ALL_BUCKETS:
        module, domain, difficulty, is_spr, _ = bucket
        key = (module, domain, difficulty, is_spr)
        actual = existing.get(key, 0)
        deficit = max(0, TARGET_TOTAL - actual) + 1
        scores.append((module, domain, difficulty, is_spr, deficit))
        log.info(f"  {module} | {domain} | {difficulty} | SPR={is_spr} → {actual} questions (deficit {deficit})")

    # Normalize deficits into slot allocations summing to QUESTIONS_PER_RUN
    total_deficit = sum(s[4] for s in scores)
    queue: list[tuple] = []
    for module, domain, difficulty, is_spr, deficit in scores:
        slots = max(1, round((deficit / total_deficit) * QUESTIONS_PER_RUN))
        for _ in range(slots):
            queue.append((module, domain, difficulty, is_spr))

    # Trim or pad to exact QUESTIONS_PER_RUN
    random.shuffle(queue)
    queue = queue[:QUESTIONS_PER_RUN]
    while len(queue) < QUESTIONS_PER_RUN:
        queue.append(random.choice(queue))

    log.info(f"Target queue built: {len(queue)} questions across {len(set(queue))} unique buckets.")
    return queue

# ─────────────────────────────────────────────────────────────
# GEMINI GENERATION
# ─────────────────────────────────────────────────────────────
def generate_question(ai: genai.Client, module: str, domain: str, difficulty: str, is_spr: bool) -> Optional[dict]:
    prompt = build_prompt(module, domain, difficulty, is_spr)
    try:
        response = ai.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )
        raw = response.text.strip()
        # Strip markdown fences if Gemini wraps in ```json
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return data
    except json.JSONDecodeError as je:
        log.error(f"JSON parse error: {je} | Raw: {response.text[:200]}")
        return None
    except Exception as e:
        log.error(f"Gemini error: {e}")
        return None

# ─────────────────────────────────────────────────────────────
# VALIDATION
# ─────────────────────────────────────────────────────────────
VALID_MODULES  = {"Math", "Reading_Writing"}
VALID_DOMAINS  = {
    "Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry",
    "Information_and_Ideas", "Craft_and_Structure", "Expression_of_Ideas", "Standard_English_Conventions",
}
VALID_DIFFS = {"Easy", "Medium", "Hard"}

def validate(data: dict, expected_module: str, expected_domain: str, expected_diff: str, expected_spr: bool) -> Optional[dict]:
    if not isinstance(data, dict):
        return None
    if data.get("module") not in VALID_MODULES:
        data["module"] = expected_module
    if data.get("domain") not in VALID_DOMAINS:
        data["domain"] = expected_domain
    if data.get("difficulty") not in VALID_DIFFS:
        data["difficulty"] = expected_diff
    if not data.get("question_text"):
        return None
    if not data.get("correct_answer"):
        return None
    # Enforce is_spr consistency
    is_spr = bool(data.get("is_spr", expected_spr))
    data["is_spr"] = is_spr
    if is_spr:
        data["options"] = None
    else:
        opts = data.get("options")
        if not isinstance(opts, list) or len(opts) != 4:
            log.warning("Options malformed; skipping.")
            return None
    data["source_method"] = "Automated_Pipeline"
    # Remove any stray id field Gemini may hallucinate
    data.pop("id", None)
    return data

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    log.info("=== SAT Harvester v2 starting ===")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    ai = genai.Client(api_key=GEMINI_API_KEY)

    queue = build_target_queue(supabase)
    log.info(f"Processing {len(queue)} questions this run...")

    inserted = 0
    skipped  = 0

    for i, (module, domain, difficulty, is_spr) in enumerate(queue):
        log.info(f"[{i+1}/{len(queue)}] Generating: {module} | {domain} | {difficulty} | SPR={is_spr}")
        
        data = generate_question(ai, module, domain, difficulty, is_spr)
        
        if data:
            validated = validate(data, module, domain, difficulty, is_spr)
        else:
            validated = None

        if validated:
            try:
                supabase.table("sat_question_bank").insert(validated).execute()
                log.info(f"  ✓ Inserted: {validated['question_text'][:60]}…")
                inserted += 1
            except Exception as e:
                log.error(f"  ✗ Insert failed: {e}")
                skipped += 1
        else:
            log.warning(f"  ✗ Validation failed; skipping.")
            skipped += 1

        # ── Anti-rate-limit delay: 1.5–4.0 s between calls ──────
        delay = random.uniform(1.5, 4.0)
        log.debug(f"  Sleeping {delay:.2f}s…")
        time.sleep(delay)

    log.info(f"=== Run complete: {inserted} inserted, {skipped} skipped ===")


if __name__ == "__main__":
    main()
