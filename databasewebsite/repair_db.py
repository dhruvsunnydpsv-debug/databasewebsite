import os
import json
import logging
import time
from supabase import create_client, Client
from groq import Groq

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

if not all([SUPABASE_URL, SUPABASE_KEY, GROQ_API_KEY]):
    raise ValueError("Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON), GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

def repair_tags(row_id: str, question_text: str):
    prompt = f"""You are a strict database evaluation engine.
Below is a SAT question. You must categorize it strictly using the exact Allowed Enums below. DO NOT make up your own tags.

ALLOWED MODULES:
"Math"
"Reading_Writing"

ALLOWED DOMAINS (Choose exactly one based on the module):
For Math: "Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry"
For Reading_Writing: "Information_Ideas", "Craft_Structure", "Expression_Ideas", "Standard_English"

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

    for attempt in range(3):
        try:
            response = groq_client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            return data
        except Exception as e:
            if "rate_limit" in str(e).lower() or "429" in str(e):
                time.sleep(2 * (attempt + 1))
            else:
                log.error(f"Groq API error on attempt {attempt+1}: {e}")
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
            valid_domains = ["Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry", "Information_Ideas", "Craft_Structure", "Expression_Ideas", "Standard_English"]
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
