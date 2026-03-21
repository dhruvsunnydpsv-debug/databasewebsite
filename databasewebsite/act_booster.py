import os
import json
import logging
import random
import time
from typing import Optional
from supabase import create_client, Client
from groq import Groq
from dotenv import load_dotenv

# Load env variables
# Load env variables (try multiple common locations)
load_dotenv()
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv(".env")
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv("databasewebsite/.env")
if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
    load_dotenv("../.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

# Support single or multiple comma-separated keys
GROQ_KEYS = [k.strip() for k in os.environ.get("GROQ_API_KEY", "").split(",") if k.strip()]
if not GROQ_KEYS:
    raise ValueError("GROQ_API_KEY environment variable is not set correctly.")

QUESTIONS_PER_RUN = 5
MODEL = "llama-3.3-70b-versatile" # Higher quality for ACT complexity

# ACT BUCKETS (Section, Domain, Difficulty)
ACT_BUCKETS = [
    # ENGLISH
    ("English", "Production of Writing", "Easy"),
    ("English", "Production of Writing", "Medium"),
    ("English", "Knowledge of Language", "Medium"),
    ("English", "Conventions of Standard English", "Medium"),
    ("English", "Conventions of Standard English", "Hard"),
    # MATH
    ("Math", "Pre-Algebra / Elementary Algebra", "Easy"),
    ("Math", "Intermediate Algebra / Coordinate Geometry", "Medium"),
    ("Math", "Plane Geometry / Trigonometry", "Medium"),
    ("Math", "Plane Geometry / Trigonometry", "Hard"),
    # READING
    ("Reading", "Key Ideas and Details", "Easy"),
    ("Reading", "Key Ideas and Details", "Medium"),
    ("Reading", "Craft and Structure", "Medium"),
    ("Reading", "Craft and Structure", "Hard"),
    ("Reading", "Integration of Knowledge and Ideas", "Hard"),
    # SCIENCE
    ("Science", "Interpretation of Data", "Easy"),
    ("Science", "Interpretation of Data", "Medium"),
    ("Science", "Scientific Investigation", "Medium"),
    ("Science", "Scientific Investigation", "Hard"),
    ("Science", "Evaluation of Models, Inferences, and Experimental Results", "Medium"),
    ("Science", "Evaluation of Models, Inferences, and Experimental Results", "Hard"),
]

def build_prompt(section: str, domain: str, difficulty: str) -> str:
    return f"""You are an elite ACT content creator.
TASK: Generate ONE high-fidelity ACT question. {random.random()}
  Exam Type : ACT
  Section   : {section}
  Domain    : {domain}
  Difficulty: {difficulty}
  
  CONTEXT: Focus on a unique scenario involving {random.choice(['biotechnology', 'climatology', 'historical linguistics', 'quantum computing', 'sustainable architecture', 'social psychology'])}.

{json.dumps({
  "exam_type": "ACT",
  "section": section,
  "domain": domain,
  "difficulty": difficulty,
  "question_text": "For English/Reading, include the passage/sentence context.",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Exact text of correct option",
  "rationale": "Logical explanation.",
  "is_spr": False,
  "module": None
}, indent=2)}

RULES:
1. ACT FORMAT: Ensure the question mimics official ACT style, tone, and complexity. 
2. LOGIC CHECK: Ensure the answer is flawless.
3. JSON ONLY: Response must be JSON only. No markdown fences."""

def generate_act_question(bucket: tuple) -> Optional[dict]:
    s, d, diff = bucket
    prompt = build_prompt(s, d, diff)
    
    max_retries = len(GROQ_KEYS) * 3
    for attempt in range(max_retries):
        current_key = GROQ_KEYS[attempt % len(GROQ_KEYS)]
        try:
            temp_client = Groq(api_key=current_key)
            response = temp_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            return json.loads(response.choices[0].message.content.strip())
        except Exception as e:
            err_msg = str(e).lower()
            if "rate_limit" in err_msg or "429" in err_msg:
                if len(GROQ_KEYS) > 1:
                    log.warning(f"Rate limit hit on key {attempt % len(GROQ_KEYS) + 1}. Rotating...")
                    time.sleep(2)
                else:
                    wait_time = min(70, 30 * (2 ** attempt)) + random.uniform(5, 10)
                    log.warning(f"Rate limit hit. Retrying in {wait_time:.2f}s... (Attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
            else:
                log.error(f"Error generating ACT question: {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)
                    continue
                return None
    return None

def main():
    log.info("--- STARTING ACT BOOSTER ---")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    inserted = 0
    for _ in range(QUESTIONS_PER_RUN):
        bucket = random.choice(ACT_BUCKETS)
        log.info(f"Generating for {bucket}...")
        data = generate_act_question(bucket)
        
        if data:
            try:
                # Force correct structure for ACT
                insert_data = {
                    "exam_type": "ACT",
                    "section": data.get("section") or bucket[0],
                    "domain": data.get("domain") or bucket[1],
                    "difficulty": data.get("difficulty") or bucket[2],
                    "question_text": data.get("question_text"),
                    "is_spr": False,
                    "options": data.get("options"),
                    "correct_answer": data.get("correct_answer"),
                    "rationale": data.get("rationale"),
                    "module": None, # CRITICAL: ACT must have NULL module
                    "source_method": "AI_Generator",
                    "raw_original_text": "[ACT Booster Synthesis]"
                }
                supabase.table("sat_question_bank").insert(insert_data).execute()
                log.info(f"✅ Added ACT Question: {insert_data['section']} ({insert_data['difficulty']})")
                inserted += 1
            except Exception as e:
                log.error(f"Insert failed: {e}")
        
        time.sleep(3) # Respect 3 RPM for common Groq free tier

    log.info(f"ACT Boost complete. Added {inserted} questions.")

if __name__ == "__main__":
    main()
