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
    raise ValueError("GROQ_API_KEY environment variable is not set correctly.")

# Support single or multiple comma-separated keys
GROQ_KEYS = [k.strip() for k in os.environ.get("GROQ_API_KEY", "").split(",") if k.strip()]

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
MODEL = "llama-3.1-8b-instant"

def repair_tags(row_id: str, question_text: str):
    prompt = f"""You are a strict database evaluation engine.
Below is a SAT question. You must categorize it strictly using the exact Allowed Enums below. DO NOT make up your own tags.

ALLOWED MODULES:
"Math"
"Reading_Writing"

ALLOWED DOMAINS (Choose exactly one based on the module):
For Math: "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry"
For Reading_Writing: "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"

ALLOWED DIFFICULTIES:
"Easy", "Medium", "Hard"

QUESTION TEXT:
{question_text}

Respond in plain JSON only (no markdown code blocks, no trailing commas):
{{
  "module": "<module>",
  "domain": "<domain>",
  "difficulty": "<difficulty>"
}}"""

    max_retries = len(GROQ_KEYS) * 2
    for attempt in range(max_retries):
        current_key = GROQ_KEYS[attempt % len(GROQ_KEYS)]
        try:
            temp_client = Groq(api_key=current_key)
            response = temp_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            return data
        except Exception as e:
            err_msg = str(e).lower()
            if "rate_limit" in err_msg or "429" in err_msg:
                if len(GROQ_KEYS) > 1:
                    log.warning(f"Rate limit hit on key {attempt % len(GROQ_KEYS) + 1}. Rotating...")
                    time.sleep(1)
                else:
                    wait = 5 * (attempt + 1)
                    log.warning(f"Rate limit hit. Waiting {wait}s...")
                    time.sleep(wait)
            else:
                log.error(f"Groq API error on attempt {attempt+1}: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
    return None

def main():
    log.info("Fetching all rows from sat_question_bank...")
    
    # Fetch all records, paginated if necessary. We use limit 1000 since there's ~174 corrupted items.
    response = supabase.table("sat_question_bank").select("id, module, domain, difficulty, question_text").limit(1000).execute()
    rows = response.data

    if not rows:
        log.info("No rows found. Database is empty.")
        return

    log.info(f"Found {len(rows)} rows to evaluate and repair.")

    fixed_count = 0
    failed_count = 0

    for i, row in enumerate(rows):
        rid = row["id"]
        qtext = row["question_text"]
        
        log.info(f"[{i+1}/{len(rows)}] Evaluating Row ID: {rid}")
        
        # Call Groq to re-evaluate the tags
        new_tags = repair_tags(rid, qtext)
        
        if new_tags:
            module = new_tags.get("module")
            domain = new_tags.get("domain")
            difficulty = new_tags.get("difficulty")
            
            # Simple validation to ensure the tags match the strict enums exactly
            valid_modules = ["Math", "Reading_Writing"]
            valid_domains = [
                "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry",
                "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"
            ]
            valid_diffs = ["Easy", "Medium", "Hard"]
            
            if module in valid_modules and domain in valid_domains and difficulty in valid_diffs:
                # Issue the UPDATE
                update_payload = {
                    "module": module,
                    "domain": domain,
                    "difficulty": difficulty
                }
                
                try:
                    supabase.table("sat_question_bank").update(update_payload).eq("id", rid).execute()
                    log.info(f" ✓ Repaired ID: {rid} -> {module} | {domain} | {difficulty}")
                    fixed_count += 1
                except Exception as e:
                    log.error(f" ✗ Database update failed for ID {rid}: {e}")
                    failed_count += 1
            else:
                log.warning(f" ✗ Groq returned invalid tags for ID {rid}: {module} | {domain} | {difficulty}")
                failed_count += 1
        else:
            log.error(f" ✗ Failed to get Groq response for ID {rid}")
            failed_count += 1
            
        # Groq strict rate limits buffer
        time.sleep(1.5)

    log.info(f"=== REPAIR COMPLETE: Fixed {fixed_count}, Failed {failed_count} ===")

if __name__ == "__main__":
    main()
