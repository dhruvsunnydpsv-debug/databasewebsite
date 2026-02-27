import os
import json
import logging
from supabase import create_client, Client
from google import genai

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONFIGURATION ---
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY or not GEMINI_API_KEY:
    logging.warning("Missing required environment variables. Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are set.")

# Initialize clients
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    ai = genai.Client(api_key=GEMINI_API_KEY)
except Exception as e:
    logging.error(f"Failed to initialize clients: {e}")

SYSTEM_PROMPT = """
You are an elite, high-precision data parser for a Digital SAT database. I will provide a source SAT question. Your strictly enforced job is 'Entity Swapping'. You will leave the 'Engine' of the question untouched and only change the 'Paint'.

RULES:
1. DO NOT change a single number, mathematical operator, variable ($x$, $y$), or equation.
2. DO NOT alter the core grammatical structure, sentence length, or punctuation logic.
3. YOU MUST swap all proper nouns (e.g., change 'Michael' to 'Sarah', 'New York' to 'London').
4. YOU MUST swap superficial objects and scenarios (e.g., change 'selling 5 apples' to 'buying 5 notebooks').
5. Update the question text, the correct answer, and the 4 multiple-choice options to reflect the new nouns.
6. Output strictly in valid JSON matching our database schema: { "module", "domain", "difficulty", "question_text", "options", "correct_answer", "rationale" }.

The schema output MUST adhere exactly to this format (do not include markdown wrapping or ```json):
{
  "module": "Math" | "Reading_Writing",
  "domain": "Heart_of_Algebra" | "Advanced_Math" | "Problem_Solving_Data" | "Geometry_Trigonometry" | "Information_and_Ideas" | "Craft_and_Structure" | "Expression_of_Ideas" | "Standard_English_Conventions",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question_text": "...",
  "options": ["A", "B", "C", "D"] | null,
  "correct_answer": "...",
  "rationale": "..."
}
"""

def get_target_domain() -> str:
    """
    Query Supabase to check inventory and determine which domain needs questions most.
    This is the 'Self-Balancing Logic'.
    """
    logging.info("Analyzing inventory for self-balancing logic...")
    DOMAINS = [
        "Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry",
        "Information_and_Ideas", "Craft_and_Structure", "Expression_of_Ideas", "Standard_English_Conventions"
    ]
    
    domain_counts = {domain: 0 for domain in DOMAINS}
    
    try:
        response = supabase.table("sat_question_bank").select("domain").execute()
        for row in response.data:
            domain = row.get("domain")
            if domain in domain_counts:
                domain_counts[domain] += 1
                
        # Find the domain with the minimum count
        target_domain = min(domain_counts, key=domain_counts.get)
        logging.info(f"Inventory status: {domain_counts}")
        logging.info(f"Targeting domain: {target_domain} (Count: {domain_counts[target_domain]})")
        return target_domain
    except Exception as e:
        logging.error(f"Error querying inventory: {e}")
        return DOMAINS[0] # Fallback to first domain


def harvest_raw_question(target_domain: str) -> str:
    """
    Simulate pinging an open-source API or scraping raw HTML for the targeted domain.
    """
    logging.info(f"Harvesting raw questions for domain: {target_domain}...")
    
    # Mocking a harvested question based on domain
    if target_domain in ["Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry"]:
        return "John buys 4 apples for $12. How much does 1 apple cost?"
    else:
        return "The pack of wolves, which hunts at night, is aggressive."


def perform_entity_swap(raw_question: str) -> dict:
    """
    Send the raw text to Gemini API for 'Entity Swapping'
    """
    logging.info("Sending to Gemini 1.5 Flash for Entity Swapping...")
    
    try:
        response = ai.models.generate_content(
            model='gemini-2.5-flash',
            contents=[SYSTEM_PROMPT, raw_question],
            config={
                'response_mime_type': 'application/json'
            }
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        logging.error(f"Error during generative entity swap: {e}")
        return None

def main():
    if not SUPABASE_URL or not SUPABASE_KEY or not GEMINI_API_KEY:
        return
        
    target_domain = get_target_domain()
    raw_question = harvest_raw_question(target_domain)
    
    swapped_data = perform_entity_swap(raw_question)
    
    if swapped_data:
        logging.info(f"Successfully swapped entity. Parsed JSON: {swapped_data.get('question_text')[:50]}...")
        
        # Add source method
        swapped_data['source_method'] = 'Automated_Pipeline'
        
        # Insert into Supabase
        try:
            response = supabase.table("sat_question_bank").insert(swapped_data).execute()
            logging.info("Successfully inserted into Supabase!")
        except Exception as e:
            logging.error(f"Failed to insert into Supabase: {e}")
            
if __name__ == "__main__":
    main()
