import os
import json
import time
from groq import Groq
from supabase import create_client

# --- CONFIGURATION ---
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role Key for writing!

# Initialize Clients
groq_client = Groq(api_key=GROQ_API_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# THE SOURCE MATERIAL (Add your raw questions here)
RAW_QUESTIONS = [
    "If 3x + 5 = 20, what is the value of 2x - 1?",
    "The sum of two numbers is 10 and their difference is 4. What is the larger number?",
    # ... paste your 100 questions here ...
]

def generate_sat_question(raw_text):
    """
    Forces Llama 3.1 70B to rewrite the question while keeping logic identical.
    """
    prompt = f"""
    You are an expert SAT content developer.
    TASK: perform an 'Entity Swap' on the following question.
    - Change names, locations, and objects (The 'Paint').
    - DO NOT change the numbers, logic, or correct answer (The 'Engine').
    - STRICTLY output valid JSON.

    Raw Question: "{raw_text}"

    JSON Schema:
    {{
        "domain": "String (MUST be one of: Heart_of_Algebra, Advanced_Math, Problem_Solving_Data, Geometry_Trigonometry, Information_Ideas, Craft_Structure, Expression_Ideas, Standard_English)",
        "question_text": "The new re-written question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": "The correct option text",
        "difficulty": "Medium"
    }}
    """
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"Skipping question due to AI error: {e}")
        return None

print("Starting Harvest...")

for raw_q in RAW_QUESTIONS:
    print(f"Processing: {raw_q[:30]}...")
    new_data = generate_sat_question(raw_q)
    if new_data:
        payload = {
            "domain": new_data["domain"],
            "question_text": new_data["question_text"],
            "options": new_data["options"],
            "correct_answer": new_data["correct_answer"],
            "difficulty": new_data["difficulty"],
            "raw_original_text": raw_q,
            "created_at": "now()"
        }
        try:
            data, count = supabase.table("sat_question_bank").insert(payload).execute()
            print("✅ Saved!")
        except Exception as e:
            print(f"❌ Database Error: {e}")
    time.sleep(1)

print("Harvest Complete.")
