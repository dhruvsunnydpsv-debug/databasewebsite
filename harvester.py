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

# ── SUBDOMAINS MAP (Syllabus 2026) ──────────────
SUBDOMAINS = {
    "Algebra": ["Linear equations", "Linear functions", "Systems of linear equations", "Linear inequalities"],
    "Advanced Math": ["Equivalent expressions", "Nonlinear equations", "Nonlinear functions"],
    "Problem-solving and Data Analysis": ["Ratios and rates", "Percentages", "Data distributions", "Probability"],
    "Geometry and Trigonometry": ["Area and volume", "Lines and angles", "Triangles", "Right triangles", "Circles"],
    "Craft and Structure": ["Words in Context", "Text Structure", "Cross-Text Connections"],
    "Information and Ideas": ["Central Ideas", "Command of Evidence"],
    "Standard English Conventions": ["Boundaries", "Form and Usage", "Punctuation"],
    "Expression of Ideas": ["Rhetorical Synthesis", "Transitions"]
}

def generate_sat_question(client: Groq, raw_text: str):
    """
    Takes a raw source and has Groq synthesize a structured SAT question.
    """
    prompt = f"""You are a senior SAT editor for the 2026 Digital syllabus.
    SOURCE: "{raw_text}"
    
    TASK: Write a new Digital SAT question based on the content of the source above.
    
    JSON Schema:
    {{
      "module": "Reading_Writing OR Math",
      "domain": "One of: Algebra, Advanced Math, Problem-solving and Data Analysis, Geometry and Trigonometry, Craft and Structure, Information and Ideas, Standard English Conventions, Expression of Ideas",
      "sub_domain": "Specific skill name",
      "difficulty": "Easy, Medium, or Hard",
      "question_text": "Clean text only. No code. No JSON leakage.",
      "is_spr": false,
      "options": ["A", "B", "C", "D"],
      "correct_answer": "Correct text",
      "rationale": "One sentence explaining logic."
    }}
    
    Strictly output JSON."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)

        # Database Insertion
        db_payload = {
            "module": data.get("module"),
            "domain": data.get("domain"),
            "sub_domain": data.get("sub_domain"),
            "difficulty": data.get("difficulty"),
            "question_text": data.get("question_text"),
            "is_spr": data.get("is_spr", False),
            "options": data.get("options"),
            "correct_answer": data.get("correct_answer"),
            "rationale": data.get("rationale"),
            "raw_original_text": raw_text[:1000],
            "source_method": "AI_HARVEST"
        }

        result = supabase.table("sat_question_bank").insert(db_payload).execute()
        print(f"Added: {data.get('domain')} - {data.get('difficulty')}")
        return result
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    # Example harvest
    sample_text = "Scientists have long debated the origin of the Moon. The leading theory suggests a giant impact..."
    generate_sat_question(groq_client, sample_text)
