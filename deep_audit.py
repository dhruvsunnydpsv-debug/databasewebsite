import os
import json
import logging
import time
from supabase import create_client, Client
from groq import Groq
from dotenv import load_dotenv

# Load credentials from .env (search in current and parent dir)
load_dotenv()
if not os.environ.get("GROQ_API_KEY"):
    load_dotenv("../.env")

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Use environment variables
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY]):
    raise ValueError("Missing required environment variables. Ensure .env is loaded.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama-3.1-8b-instant"

# 2026 Syllabus Mapping
VALID_MODULES = ["Math", "Reading_Writing"]
VALID_DOMAINS = [
    "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry",
    "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"
]

def analyze_and_fix_question(row):
    """
    1. Checks if the answer is correct.
    2. Maps to 2026 Syllabus domains.
    3. Detects JSON leakage.
    """
    q_text = row.get("question_text", "")
    options = row.get("options", [])
    correct_actual = row.get("correct_answer", "")
    
    prompt = f"""You are an elite SAT Auditor. 
Analyze this question for:
1. Correctness: Is the answer '{correct_actual}' actually correct? If not, identify the right one.
2. 2026 Mapping: Map it to one of these: {VALID_DOMAINS}.
3. Quality: Is there any raw JSON or code leakage?

QUESTION:
{q_text}
OPTIONS: {options}
CURRENT_ANSWER: {correct_actual}

Respond in STRICT JSON:
{{
  "is_correct": true/false,
  "correct_answer": "The actual correct option text or letter",
  "domain": "One of {VALID_DOMAINS}",
  "has_json_leakage": true/false,
  "rationale": "Why?"
}}
"""
    try:
        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        log.error(f"Audit fail: {e}")
        return None

def main():
    log.info("Starting Deep Audit of 1,000 Questions...")
    
    # Fetch all records
    res = supabase.table("sat_question_bank").select("*").execute()
    rows = res.data
    
    wrong_count = 0
    corrupted_count = 0
    fixed_count = 0

    for i, row in enumerate(rows):
        # SKIP if already mapped to 2026 Syllabus and looks clean
        if row.get("domain") in VALID_DOMAINS and "{" not in (row.get("question_text") or ""):
            continue

        log.info(f"[{i+1}/{len(rows)}] Auditing ID: {row['id']}")
        
        audit = analyze_and_fix_question(row)
        if not audit:
            continue
            
        # 1. Handle JSON Leakage (Delete if corrupted)
        if audit.get("has_json_leakage") or "{" in (row.get('question_text') or ""):
            log.warning(f"  ❌ DELETING CORRUPTED (JSON LEAKAGE): {row['id']}")
            supabase.table("sat_question_bank").delete().eq("id", row['id']).execute()
            corrupted_count += 1
            continue

        # 2. Update metadata to 2026 Syllabus
        update_data = {
            "domain": audit.get("domain"),
            "correct_answer": audit.get("correct_answer") if not audit.get("is_correct") else row.get('correct_answer')
        }
        
        if not audit.get("is_correct"):
            log.warning(f"  ⚠️ FIXED WRONG ANSWER: {row.get('correct_answer')} -> {audit['correct_answer']}")
            wrong_count += 1
            
        supabase.table("sat_question_bank").update(update_data).eq("id", row['id']).execute()
        fixed_count += 1
        
        # Rate limit safety (More conservative for Free Tier)
        time.sleep(2.5)

    log.info(f"""
    === AUDIT COMPLETE ===
    TOTAL PROCESSED: {len(rows)}
    DELETED (CORRUPTED): {corrupted_count}
    FIXED WRONG ANSWERS: {wrong_count}
    MIGRATED TO 2026 SYLLABUS: {fixed_count}
    """)

if __name__ == "__main__":
    main()
