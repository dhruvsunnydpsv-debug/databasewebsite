import os
import json
import logging
import random
import time
from typing import Optional
from supabase import create_client, Client
from groq import Groq
from dotenv import load_dotenv

# Load env from .env in parent or current dir
load_dotenv()
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv("databasewebsite/.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
GROQ_API_KEY = os.environ["GROQ_API_KEY"]

QUESTIONS_PER_RUN = 5
MODEL = "llama-3.1-8b-instant"

# ONLY MATH BUCKETS
MATH_BUCKETS = [
    ("Math", "Algebra",                           "Easy",   False),
    ("Math", "Algebra",                           "Medium", False),
    ("Math", "Algebra",                           "Hard",   False),
    ("Math", "Algebra",                           "Hard",   True),
    ("Math", "Advanced Math",                     "Easy",   False),
    ("Math", "Advanced Math",                     "Medium", False),
    ("Math", "Advanced Math",                     "Hard",   False),
    ("Math", "Advanced Math",                     "Hard",   True),
    ("Math", "Problem-solving and Data Analysis", "Easy",   False),
    ("Math", "Problem-solving and Data Analysis", "Medium", False),
    ("Math", "Problem-solving and Data Analysis", "Hard",   False),
    ("Math", "Geometry and Trigonometry",         "Easy",   False),
    ("Math", "Geometry and Trigonometry",         "Medium", False),
    ("Math", "Geometry and Trigonometry",         "Hard",   False),
]

SUBDOMAINS = {
    "Algebra": ["Linear equations in one variable", "Linear equations in two variables", "Linear functions", "Systems of two linear equations", "Linear inequalities"],
    "Advanced Math": ["Equivalent expressions", "Nonlinear equations in one variable", "Systems of equations in two variables", "Nonlinear functions"],
    "Problem-solving and Data Analysis": ["Ratios, rates, proportional relationships", "Percentages", "One-variable data", "Two-variable data", "Probability and conditional probability"],
    "Geometry and Trigonometry": ["Area and volume formulae", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"],
}

def build_prompt(module: str, domain: str, difficulty: str, is_spr: bool) -> str:
    sub_choices = SUBDOMAINS.get(domain, [])
    sd = random.choice(sub_choices) if sub_choices else "General"
    spr_note = "SPR / Grid-in. NO options. Numeric answer." if is_spr else "Multiple-choice. 4 distinct options (A, B, C, D)."

    return f"""You are an elite Digital SAT content creator for the 2026 Syllabus.
TASK: Generate ONE high-fidelity Math question. {random.random()}
  Module    : {module}
  Domain    : {domain}
  Sub-domain: {sd}
  Difficulty: {difficulty}
  Format    : {spr_note}
  
  CONTEXT: Focus on a unique scenario involving {random.choice(['agriculture', 'space travel', 'digital art', 'renewable energy', 'urban planning', 'marine biology', 'robotics'])}.

{json.dumps({
  "module": module,
  "domain": domain,
  "sub_domain": sd,
  "difficulty": difficulty,
  "is_spr": is_spr,
  "question_text": "...",
  "options": None if is_spr else ["A", "B", "C", "D"],
  "correct_answer": "...",
  "rationale": "..."
}, indent=2)}

RULES:
1. ENTITY SWAP: Use randomized names/scenarios.
2. LOGIC CHECK: Ensure the answer is mathematically flawless.
3. JSON ONLY: Response must be JSON only."""

def generate_question(client: Groq, bucket: tuple) -> Optional[dict]:
    m, d, diff, spr = bucket
    prompt = build_prompt(m, d, diff, spr)
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            return json.loads(response.choices[0].message.content.strip())
        except Exception as e:
            err_msg = str(e).lower()
            if "rate_limit" in err_msg or "429" in err_msg:
                # Exponential backoff + jitter
                wait_time = min(60, (2 ** attempt)) + random.uniform(1, 4)
                log.warning(f"Rate limit hit. Retrying in {wait_time:.2f}s... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                log.error(f"Error generating question: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return None
    return None

def main():
    print("--- STARTING MATH BOOSTER ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    groq_client = Groq(api_key=GROQ_API_KEY)

    # Simple round-robin through buckets for this boost
    inserted = 0
    for _ in range(QUESTIONS_PER_RUN):
        bucket = random.choice(MATH_BUCKETS)
        data = generate_question(groq_client, bucket)
        if data:
            try:
                # Add source method and raw text placeholder
                insert_data = {
                    "module": data.get("module"),
                    "domain": data.get("domain"),
                    "difficulty": data.get("difficulty"),
                    "question_text": data.get("question_text"),
                    "is_spr": data.get("is_spr", False),
                    "options": data.get("options"),
                    "correct_answer": data.get("correct_answer"),
                    "rationale": data.get("rationale"),
                    "source_method": "Automated_Pipeline",
                    "raw_original_text": "[Math Booster Synthesis]"
                }
                supabase.table("sat_question_bank").insert(insert_data).execute()
                print(f"✅ Added Math Question: {bucket[1]} ({bucket[2]})")
                inserted += 1
            except Exception as e:
                log.error(f"Insert failed: {e}")
        time.sleep(3) # Respect rate limits

    print(f"Boost complete. Added {inserted} Math questions.")

if __name__ == "__main__":
    main()
