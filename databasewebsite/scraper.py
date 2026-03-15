"""
scraper.py — SAT Question Generator v5 (Groq-powered, schema-correct)
=============================================================================
Runs every 15 min via GitHub Actions.
Generates self-contained, Bluebook-style SAT questions using Groq's Llama 3.3.
NO external URL scraping. NO JSON garbage. Only real question patterns.

Schema columns used (MUST match sat_question_bank CHECK constraints):
  module        : 'Math' | 'Reading_Writing'
  domain        : space-format (e.g. 'Information and Ideas', 'Algebra')
  difficulty    : 'Easy' | 'Medium' | 'Hard'
  is_spr        : False (always for generated MCQ)
  source_method : 'Automated_Pipeline'
  rationale     : required NOT NULL explanation
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

QUESTIONS_PER_RUN = 20
MODEL = "llama-3.3-70b-versatile"

# ── Valid domain values MUST match schema.sql CHECK constraint (space format) ──
RW_DOMAINS = {
    "Information and Ideas",
    "Craft and Structure",
    "Expression of Ideas",
    "Standard English Conventions",
}
MATH_DOMAINS = {
    "Algebra",
    "Advanced Math",
    "Problem-solving and Data Analysis",
    "Geometry and Trigonometry",
}
VALID_DOMAINS = RW_DOMAINS | MATH_DOMAINS
VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}

# Module mapping
DOMAIN_TO_MODULE = {d: "Reading_Writing" for d in RW_DOMAINS}
DOMAIN_TO_MODULE.update({d: "Math" for d in MATH_DOMAINS})

# ── All buckets: (domain, difficulty) ──────────────────────────────────────────
ALL_BUCKETS = [
    # Reading & Writing
    ("Information and Ideas",           "Easy"),   ("Information and Ideas",           "Medium"), ("Information and Ideas",           "Hard"),
    ("Craft and Structure",              "Easy"),   ("Craft and Structure",              "Medium"), ("Craft and Structure",              "Hard"),
    ("Expression of Ideas",             "Easy"),   ("Expression of Ideas",             "Medium"), ("Expression of Ideas",             "Hard"),
    ("Standard English Conventions",    "Easy"),   ("Standard English Conventions",    "Medium"), ("Standard English Conventions",    "Hard"),
    # Math
    ("Algebra",                          "Easy"),   ("Algebra",                          "Medium"), ("Algebra",                          "Hard"),
    ("Advanced Math",                    "Easy"),   ("Advanced Math",                    "Medium"), ("Advanced Math",                    "Hard"),
    ("Problem-solving and Data Analysis","Easy"),   ("Problem-solving and Data Analysis","Medium"), ("Problem-solving and Data Analysis","Hard"),
    ("Geometry and Trigonometry",        "Easy"),   ("Geometry and Trigonometry",        "Medium"), ("Geometry and Trigonometry",        "Hard"),
]

TARGET_PER_BUCKET = 500

# ── Rich sub-domain prompts for each domain ────────────────────────────────────
SUBDOMAINS = {
    "Information and Ideas": [
        "Central Ideas and Details — identify the main claim of a short passage",
        "Command of Evidence (Textual) — select the quote that best supports a given claim",
        "Command of Evidence (Quantitative) — interpret data from a table or graph to answer a question",
        "Inferences — draw a logical conclusion from evidence provided in a passage",
    ],
    "Craft and Structure": [
        "Words in Context — determine the most precise meaning of an underlined word in context",
        "Text Structure and Purpose — identify why the author included a particular sentence or detail",
        "Cross-Text Connections — compare the perspectives of two short passages on the same topic",
    ],
    "Expression of Ideas": [
        "Rhetorical Synthesis — combine information from notes into one grammatically correct sentence",
        "Transitions — select the most logical transition word or phrase to connect two sentences",
    ],
    "Standard English Conventions": [
        "Sentence Boundaries — fix comma splices, run-ons, or fragments",
        "Subject-Verb Agreement — correct agreement errors in complex sentence structures",
        "Pronoun Reference — fix ambiguous or incorrect pronoun antecedents",
        "Verb Tense and Form — select the correct tense for context",
        "Punctuation — use commas, semicolons, colons, and dashes correctly",
        "Parallel Structure — maintain parallel form across a list or comparison",
    ],
    "Algebra": [
        "Linear equations in one variable — solve or interpret ax + b = c",
        "Linear equations in two variables — write the equation of a line from context",
        "Systems of two linear equations — solve by substitution or elimination",
        "Linear inequalities in one or two variables — solve and interpret on a number line or graph",
        "Linear functions — identify slope, y-intercept, and rate of change from a table or graph",
    ],
    "Advanced Math": [
        "Equivalent expressions — factor, expand, or simplify polynomial and rational expressions",
        "Nonlinear equations in one variable — solve quadratic equations by factoring or the quadratic formula",
        "Nonlinear functions — analyze the graph of a parabola or exponential function",
        "Systems of equations with one nonlinear equation — solve algebraically and interpret solutions",
    ],
    "Problem-solving and Data Analysis": [
        "Ratios, rates, and proportional relationships — set up and solve a proportion from context",
        "Percentages — calculate percent change, markups, or percent of a whole",
        "One-variable data: distributions and measures of center — mean, median, range, IQR",
        "Two-variable data: scatterplots and lines of best fit — interpret slope and y-intercept in context",
        "Probability and conditional probability — calculate from a two-way frequency table",
        "Statistical inference — evaluate claims based on sample data and margin of error",
    ],
    "Geometry and Trigonometry": [
        "Area and volume — apply formulas for circles, triangles, rectangles, cylinders, and cones",
        "Lines, angles, and triangles — use parallel line angle relationships and triangle sum theorem",
        "Right triangles and trigonometry — apply SOH-CAH-TOA and the Pythagorean theorem",
        "Circles — arc length, sector area, central and inscribed angle theorems",
        "Coordinate geometry — distance formula, midpoint, and equation of a circle",
    ],
}

RW_PASSAGE_SEEDS = [
    "a 19th-century naturalist studying bird migration patterns in South America",
    "a contemporary marine biologist researching deep-sea bioluminescence",
    "an archaeologist analyzing pottery shards from an ancient Mediterranean civilization",
    "a historian examining the economic impact of railroad expansion in 19th-century America",
    "a literary critic discussing the narrative structure of Victorian novels",
    "a sociologist studying community cohesion in post-industrial cities",
    "an astronomer comparing the atmospheric composition of gas giant planets",
    "a linguist documenting the evolution of creole languages in the Caribbean",
    "a neuroscientist investigating the role of sleep in memory consolidation",
    "a philosopher analyzing the ethical implications of artificial intelligence",
    "an environmental economist quantifying the cost of coastal erosion",
    "a botanist studying the mycorrhizal networks connecting trees in old-growth forests",
]

MATH_CONTEXT_SEEDS = [
    "a car rental company's pricing model",
    "a school fundraiser selling two types of items",
    "the trajectory of a ball thrown from a rooftop",
    "a company's quarterly profit growth",
    "a swimming pool being filled and drained simultaneously",
    "the relationship between study hours and test scores",
    "a farmer dividing land into rectangular plots",
    "the depreciation of a vehicle's value over time",
    "a scientist diluting a chemical solution",
    "a city's population growth modeled by an exponential function",
    "the speed of two cyclists traveling toward each other",
    "the dimensions of a triangular sail on a yacht",
]


# ─────────────────────────────────────────────────────────────
# SELF-BALANCING QUEUE BUILDER
# ─────────────────────────────────────────────────────────────
def build_queue(supabase: Client) -> list:
    log.info("Querying inventory for self-balancing analysis…")
    existing: dict = {}
    try:
        rows = supabase.table("sat_question_bank").select("domain, difficulty").execute()
        for r in rows.data:
            key = (r["domain"], r["difficulty"])
            existing[key] = existing.get(key, 0) + 1
    except Exception as e:
        log.warning(f"Could not read inventory: {e}")

    scores = []
    for bucket in ALL_BUCKETS:
        actual = existing.get(bucket, 0)
        deficit = max(0, TARGET_PER_BUCKET - actual) + 1
        scores.append((bucket[0], bucket[1], deficit))
        log.info(f"  {bucket[0]} | {bucket[1]} → {actual} (deficit {deficit})")

    total_deficit = sum(s[2] for s in scores)
    queue = []
    for domain, difficulty, deficit in scores:
        slots = max(1, round((deficit / total_deficit) * QUESTIONS_PER_RUN))
        for _ in range(slots):
            queue.append((domain, difficulty))

    random.shuffle(queue)
    queue = queue[:QUESTIONS_PER_RUN]
    while len(queue) < QUESTIONS_PER_RUN:
        queue.append(random.choice(queue))

    log.info(f"Queue: {len(queue)} questions across {len(set(queue))} unique buckets.")
    return queue


# ─────────────────────────────────────────────────────────────
# PROMPT BUILDER — pure pattern, no external scraping
# ─────────────────────────────────────────────────────────────
def build_prompt(domain: str, difficulty: str) -> tuple[str, str]:
    sub = random.choice(SUBDOMAINS.get(domain, ["General"]))
    is_math = domain in MATH_DOMAINS

    if is_math:
        seed = random.choice(MATH_CONTEXT_SEEDS)
        passage_seed = f"Context: {seed}"
        difficulty_guidance = {
            "Easy":   "one or two steps, straightforward computation, no tricks",
            "Medium": "multi-step, requires setting up an equation or interpreting a graph",
            "Hard":   "complex multi-step, requires combining two concepts, abstract reasoning",
        }[difficulty]

        system = f"""You are a senior Digital SAT Math question writer for the 2026 exam.

Write exactly ONE original SAT-style question with these specs:
  Domain      : {domain}
  Sub-domain  : {sub}
  Difficulty  : {difficulty} ({difficulty_guidance})
  Context seed: {seed}

Rules:
- The question must be self-contained. Include all numbers and context needed.
- For Hard questions, involve at least two mathematical steps or a non-obvious setup.
- Four answer choices. Exactly one is correct. Distractors must reflect common errors.
- correct_answer must be the EXACT TEXT of the correct option.
- rationale: one clear sentence explaining why the correct answer is correct.

Return ONLY this JSON object. No markdown, no extra fields:
{{
  "domain": "{domain}",
  "difficulty": "{difficulty}",
  "question_text": "Full question stem with all numbers included.",
  "options": ["option text A", "option text B", "option text C", "option text D"],
  "correct_answer": "Exact text of the correct option",
  "rationale": "One sentence explaining why the correct answer is correct."
}}"""

    else:
        seed = random.choice(RW_PASSAGE_SEEDS)
        passage_seed = f"Topic: {seed}"
        difficulty_guidance = {
            "Easy":   "short 2-sentence passage, direct inference, obvious answer",
            "Medium": "3-4 sentence passage, requires understanding of author's purpose or word nuance",
            "Hard":   "4-5 sentence passage with complex syntax, subtle distinction between answer choices",
        }[difficulty]

        system = f"""You are a senior Digital SAT Reading & Writing question writer for the 2026 exam.

Write exactly ONE original SAT-style question with these specs:
  Domain      : {domain}
  Sub-domain  : {sub}
  Difficulty  : {difficulty} ({difficulty_guidance})
  Topic seed  : {seed}

Rules:
- Write an original passage appropriate to the difficulty. Use real academic/literary register.
- The passage must NOT contain any JSON, code, URLs, or metadata.
- question_text = the PASSAGE TEXT followed by a blank line then the question stem.
- Four answer choices. Exactly one is correct. Wrong choices must be plausible but distinguishable.
- correct_answer must be the EXACT TEXT of the correct option.
- rationale: one clear sentence explaining why the correct answer is correct.
- raw_original_text = the passage text ONLY (no question stem).

Return ONLY this JSON object. No markdown, no extra fields:
{{
  "domain": "{domain}",
  "difficulty": "{difficulty}",
  "question_text": "PASSAGE TEXT\\n\\nQUESTION STEM",
  "options": ["option text A", "option text B", "option text C", "option text D"],
  "correct_answer": "Exact text of the correct option",
  "rationale": "One sentence explaining why the correct answer is correct.",
  "raw_original_text": "PASSAGE TEXT ONLY"
}}"""

    return system, passage_seed


# ─────────────────────────────────────────────────────────────
# GENERATION
# ─────────────────────────────────────────────────────────────
def generate_question(client: Groq, domain: str, difficulty: str) -> Optional[dict]:
    system_prompt, seed = build_prompt(domain, difficulty)
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": system_prompt}],
                response_format={"type": "json_object"},
                temperature=0.75,
                max_tokens=1200,
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            data["_seed"] = seed
            return data
        except json.JSONDecodeError as e:
            log.error(f"JSON parse error (attempt {attempt+1}): {e}")
        except Exception as e:
            err = str(e)
            if "rate_limit" in err.lower() or "429" in err:
                wait = 15 * (2 ** attempt)
                log.warning(f"Rate limit. Waiting {wait}s…")
                time.sleep(wait)
            else:
                log.error(f"Groq error: {e}")
                return None
    return None


# ─────────────────────────────────────────────────────────────
# VALIDATION — strict, schema-correct
# ─────────────────────────────────────────────────────────────
def validate_and_build_payload(data: dict, exp_domain: str, exp_difficulty: str) -> Optional[dict]:
    if not isinstance(data, dict):
        return None

    q_text = (data.get("question_text") or "").strip()
    if not q_text:
        log.warning("Empty question_text — rejecting")
        return None

    bad_signals = ["{", "http://", "https://", "api.", "status:", "message-type"]
    if any(s in q_text for s in bad_signals) or q_text.startswith("["):
        log.warning(f"JSON/code leakage detected — rejecting: {q_text[:80]}")
        return None

    domain = data.get("domain", exp_domain)
    if domain not in VALID_DOMAINS:
        domain = exp_domain

    difficulty = data.get("difficulty", exp_difficulty)
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = exp_difficulty

    module = DOMAIN_TO_MODULE.get(domain)
    if not module:
        log.warning(f"Cannot determine module for domain: {domain}")
        return None

    options = data.get("options")
    if not isinstance(options, list) or len(options) != 4:
        log.warning("Options malformed — rejecting")
        return None

    correct_answer = (data.get("correct_answer") or "").strip()
    if not correct_answer:
        log.warning("Missing correct_answer — rejecting")
        return None

    if correct_answer not in options:
        letter_map = {chr(65 + i): options[i] for i in range(4)}
        if correct_answer.upper() in letter_map:
            correct_answer = letter_map[correct_answer.upper()]
        else:
            log.warning(f"correct_answer '{correct_answer}' not in options — rejecting")
            return None

    rationale = (data.get("rationale") or "").strip()
    if not rationale:
        rationale = f"The correct answer is '{correct_answer}'."

    raw = (data.get("raw_original_text") or data.get("_seed") or "").strip()

    # Build payload using ALL required sat_question_bank columns
    return {
        "module": module,
        "domain": domain,
        "difficulty": difficulty,
        "question_text": q_text,
        "options": options,
        "correct_answer": correct_answer,
        "rationale": rationale,
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "raw_original_text": raw if raw else None,
    }


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    log.info("=== SCRAPER RUN START ===")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    groq_client = Groq(api_key=GROQ_API_KEY)

    queue = build_queue(supabase)
    inserted = 0
    skipped = 0

    for i, (domain, difficulty) in enumerate(queue):
        log.info(f"[{i+1}/{len(queue)}] Generating {domain} | {difficulty}…")

        data = generate_question(groq_client, domain, difficulty)
        if not data:
            skipped += 1
            continue

        payload = validate_and_build_payload(data, domain, difficulty)
        if not payload:
            skipped += 1
            continue

        try:
            existing = supabase.table("sat_question_bank") \
                .select("id") \
                .eq("question_text", payload["question_text"]) \
                .limit(1).execute()
            if existing.data:
                log.info("  Duplicate skipped.")
                skipped += 1
                continue

            supabase.table("sat_question_bank").insert(payload).execute()
            log.info(f"  ✓ Inserted: {domain} | {difficulty}")
            inserted += 1
        except Exception as e:
            log.error(f"  ✗ Insert failed: {e}")
            skipped += 1

        time.sleep(random.uniform(2.0, 3.0))

    log.info(f"=== RUN COMPLETE: {inserted} inserted, {skipped} skipped ===")


if __name__ == "__main__":
    main()
