import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Absolute path for .env
env_path = r"c:\Users\hemin\Desktop\HTML\databasewebsite\databasewebsite\.env"
load_dotenv(env_path)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

ACT_QUESTIONS = [
    {
        "exam_type": "ACT",
        "section": "Science",
        "domain": "Interpretation of Data",
        "difficulty": "Medium",
        "question_text": "A scientist measures the boiling point of four unknown liquids. Liquid A boils at 78°C, B at 100°C, C at 56°C, and D at 126°C. Which liquid has the highest vapor pressure at room temperature (25°C)?",
        "options": ["Liquid A", "Liquid B", "Liquid C", "Liquid D"],
        "correct_answer": "Liquid C",
        "rationale": "Liquids with lower boiling points typically have higher vapor pressures because their intermolecular forces are weaker, allowing molecules to escape into the gas phase more easily at a given temperature. Liquid C has the lowest boiling point (56°C).",
        "is_spr": False,
        "source_method": "Initial_ACT_Seed",
        "module": None
    },
    {
        "exam_type": "ACT",
        "section": "Math",
        "domain": "Pre-Algebra",
        "difficulty": "Easy",
        "question_text": "What is the least common multiple of 12, 15, and 20?",
        "options": ["30", "60", "120", "150"],
        "correct_answer": "60",
        "rationale": "Multiples of 20: 20, 40, 60, 80... Multiples of 15: 15, 30, 45, 60... Multiples of 12: 12, 24, 36, 48, 60. The smallest number in all lists is 60.",
        "is_spr": False,
        "source_method": "Initial_ACT_Seed",
        "module": None
    },
    {
        "exam_type": "ACT",
        "section": "English",
        "domain": "Production of Writing",
        "difficulty": "Medium",
        "question_text": "The artist, whose work has been exhibited globally, decided to open a small gallery in his hometown. Which of the following is the most effective way to punctuate the underlined portion?",
        "options": ["artist whose work", "artist; whose work", "artist, whose work,", "artist—whose work"],
        "correct_answer": "artist, whose work,",
        "rationale": "The non-restrictive clause 'whose work has been exhibited globally' provides extra information and must be set off by commas on both sides.",
        "is_spr": False,
        "source_method": "Initial_ACT_Seed",
        "module": None
    },
    {
        "exam_type": "ACT",
        "section": "Reading",
        "domain": "Social Science",
        "difficulty": "Hard",
        "question_text": "The author's primary purpose in the passage is to:",
        "options": ["Analyze the economic causes of the French Revolution.", "Argue that individual agency is more important than structural factors.", "Compare the historiography of different revolutionary eras.", "Examine the role of the printing press in spreading Enlightenment ideals."],
        "correct_answer": "Examine the role of the printing press in spreading Enlightenment ideals.",
        "rationale": "The passage focuses extensively on how the availability of cheap pamphlets influenced public opinion leading up to the revolution.",
        "is_spr": False,
        "source_method": "Initial_ACT_Seed",
        "module": None
    }
]

def seed():
    headers = {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
    
    print(f"--- Seeding {len(ACT_QUESTIONS)} ACT Questions ---")
    
    total_success = 0
    for q in ACT_QUESTIONS:
        try:
            req = urllib.request.Request(f"{url}/rest/v1/sat_question_bank", 
                                         data=json.dumps(q).encode(), 
                                         headers=headers, 
                                         method="POST")
            with urllib.request.urlopen(req) as r:
                if r.status in [200, 201]:
                    total_success += 1
                    print(f"SUCCESS: Seeded {q['section']} ({q['difficulty']})")
        except urllib.error.HTTPError as e:
            print(f"ERROR: {e.code} - {e.read().decode()}")
            
    print(f"\nSeeding complete! {total_success}/{len(ACT_QUESTIONS)} questions added.")

if __name__ == "__main__":
    seed()
