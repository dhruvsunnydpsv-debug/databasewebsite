#!/usr/bin/env python3
"""
seed_db.py — Direct database seeder
Inserts Bluebook-pattern SAT questions directly via Supabase REST API.
Run once to populate the database with starter questions.
All questions follow the exact sat_question_bank schema.
"""

import urllib.request
import urllib.error
import json
import os
from dotenv import load_dotenv

try:
    from dotenv import load_dotenv
    load_dotenv()
    if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
        load_dotenv("databasewebsite/.env")
except ImportError:
    pass

SUPABASE_URL = str(os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://sihgnmrxdbhzjefeceqo.supabase.co"))

# Initialize headers after env load
def get_headers():
    k = str(os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "")
    return {
        "Content-Type": "application/json",
        "apikey": k,
        "Authorization": f"Bearer {k}",
        "Prefer": "return=minimal",
    }

# --- EXAMPLE ACT QUESTION ---
# {
#     "exam_type": "ACT",
#     "section": "Math",
#     "module": "Math",  -- existing column, reused
#     "domain": "Algebra",
#     "difficulty": "Medium",
#     "question_text": "Solve for x: 3x + 5 = 20",
#     "correct_answer": "5",
#     "is_spr": True
# }

SEED_QUESTIONS = [
    # ── INFORMATION AND IDEAS ──────────────────────────────────────────────
    {
        "module": "Reading_Writing",
        "domain": "Information and Ideas",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The following text is adapted from a science article.\n\n"
            "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide "
            "to produce glucose and oxygen. This process occurs primarily in the chloroplasts, where "
            "chlorophyll absorbs light energy and converts it into chemical energy stored in glucose molecules.\n\n"
            "Which choice best states the main idea of the text?"
        ),
        "options": [
            "Plants produce chlorophyll specifically to protect themselves from excess sunlight.",
            "Photosynthesis converts light energy into chemical energy stored as glucose.",
            "Carbon dioxide is the most important raw material required for photosynthesis.",
            "Chloroplasts are found in all living organisms that require energy to survive.",
        ],
        "correct_answer": "Photosynthesis converts light energy into chemical energy stored as glucose.",
        "rationale": "The passage describes photosynthesis as a process that uses light to produce glucose, so energy conversion is the central idea.",
        "raw_original_text": (
            "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide "
            "to produce glucose and oxygen. This process occurs primarily in the chloroplasts, where "
            "chlorophyll absorbs light energy and converts it into chemical energy stored in glucose molecules."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Information and Ideas",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The following text is adapted from a 2023 ecology study.\n\n"
            "Researchers examining 15 cities found that species richness—the total count of distinct bird "
            "species—rose consistently with green space per capita. However, this relationship was nonlinear: "
            "cities exceeding 25% green-space coverage showed diminishing returns, with species richness "
            "plateauing even as green space continued to expand.\n\n"
            "Which finding, if true, would most directly support the researchers' conclusion about diminishing returns?"
        ),
        "options": [
            "Cities with 30% green space had the same average species richness as cities with 40% green space.",
            "Cities with 10% green space had significantly fewer bird species than cities with 20% green space.",
            "The most common urban birds are generalists that thrive regardless of green-space percentage.",
            "Researchers counted more individual birds in cities with greater total green-space area.",
        ],
        "correct_answer": "Cities with 30% green space had the same average species richness as cities with 40% green space.",
        "rationale": "A plateau in species richness between 30% and 40% green space directly supports the claim that gains diminish beyond the 25% threshold.",
        "raw_original_text": (
            "Researchers examining 15 cities found that species richness rose consistently with green space "
            "per capita. However, cities exceeding 25% green-space coverage showed diminishing returns, "
            "with species richness plateauing even as green space continued to expand."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Information and Ideas",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "Text 1\n"
            "Ecologist Dr. Priya Anand argues that rewilding programs—reintroducing apex predators to "
            "ecosystems from which they were eliminated—produce measurable biodiversity improvements within "
            "a decade. She cites a 1995 wolf reintroduction that triggered a trophic cascade, ultimately "
            "altering the course of rivers by reducing overgrazing near riverbanks.\n\n"
            "Text 2\n"
            "Historian Dr. Marcus Webb cautions that rewilding studies often use metrics that favor visible, "
            "charismatic changes. He argues that hydrological shifts attributed to predators may instead "
            "reflect concurrent changes in regional precipitation patterns.\n\n"
            "Based on the texts, how would Dr. Webb most likely respond to Dr. Anand's river-change claim?"
        ),
        "options": [
            "He would agree that apex predators are essential for maintaining healthy river ecosystems.",
            "He would suggest that precipitation shifts, not predator behavior, may explain the river changes.",
            "He would claim that rewilding programs never successfully increase biodiversity.",
            "He would argue that the decade-long timeframe is too brief to evaluate rewilding outcomes.",
        ],
        "correct_answer": "He would suggest that precipitation shifts, not predator behavior, may explain the river changes.",
        "rationale": "Webb specifically proposes that concurrent precipitation changes, rather than predator reintroduction, may explain the hydrological effects Anand attributes to wolves.",
        "raw_original_text": (
            "Text 1: Dr. Priya Anand argues rewilding programs produce biodiversity improvements within a decade, "
            "citing a 1995 wolf reintroduction that altered river courses via trophic cascade.\n"
            "Text 2: Dr. Marcus Webb argues that hydrological shifts attributed to predators may reflect "
            "concurrent changes in regional precipitation patterns."
        ),
    },
    # ── CRAFT AND STRUCTURE ───────────────────────────────────────────────
    {
        "module": "Reading_Writing",
        "domain": "Craft and Structure",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The following text is from a nature essay.\n\n"
            "The ancient redwood trees of Northern California have stood for thousands of years, their massive "
            "trunks rising above the forest floor like cathedral pillars. These giants endure drought, fire, "
            "and storms that fell lesser trees, their resilience encoded in bark nearly a foot thick.\n\n"
            "As used in the text, what does the word \"resilience\" most nearly mean?"
        ),
        "options": [
            "Flexibility",
            "Ability to withstand and recover from hardship",
            "Physical size and mass",
            "Age and longevity",
        ],
        "correct_answer": "Ability to withstand and recover from hardship",
        "rationale": "In context, resilience describes the redwoods' capacity to survive drought, fire, and storms—hardships that destroy other trees—making 'ability to withstand and recover from hardship' correct.",
        "raw_original_text": (
            "The ancient redwood trees of Northern California have stood for thousands of years, their massive "
            "trunks rising above the forest floor like cathedral pillars. These giants endure drought, fire, "
            "and storms that fell lesser trees, their resilience encoded in bark nearly a foot thick."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Craft and Structure",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The following text is from a contemporary novel.\n\n"
            "Every morning, Lena opened her notebook before the coffee finished brewing. She did not write "
            "sentences—she made lists: groceries, grievances, unanswered questions. The lists never helped "
            "her decide anything, but they made the chaos feel named, and named things were, in her experience, "
            "slightly less terrifying.\n\n"
            "Which choice best describes the function of the last sentence?"
        ),
        "options": [
            "It reveals that Lena is unable to make decisions without external guidance.",
            "It explains the psychological benefit Lena derives from her list-making habit.",
            "It suggests that Lena's lists are ultimately ineffective as a coping mechanism.",
            "It introduces a conflict between Lena's rational mind and her emotional responses.",
        ],
        "correct_answer": "It explains the psychological benefit Lena derives from her list-making habit.",
        "rationale": "The final sentence clarifies why Lena makes lists despite their uselessness for decision-making: naming chaos makes it less frightening, which is the psychological payoff of her habit.",
        "raw_original_text": (
            "Every morning, Lena opened her notebook before the coffee finished brewing. She did not write "
            "sentences—she made lists: groceries, grievances, unanswered questions. The lists never helped "
            "her decide anything, but they made the chaos feel named, and named things were, in her experience, "
            "slightly less terrifying."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Craft and Structure",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The following text is adapted from a literary essay.\n\n"
            "Toni Morrison's prose does not so much describe grief as enact it. Her sentences fragment under "
            "emotional weight, clauses interrupting themselves mid-thought as though the language itself cannot "
            "bear to continue. A reader finishing Beloved does not merely understand loss—she has been made "
            "to experience its texture.\n\n"
            "Which choice best describes the overall structure of the passage?"
        ),
        "options": [
            "It presents a thesis about Morrison's technique and then supports it with textual evidence.",
            "It summarizes the plot of Beloved and analyzes its central themes.",
            "It compares Morrison's prose style favorably to the styles of her literary contemporaries.",
            "It proposes a theory about grief and illustrates it using Morrison as an example.",
        ],
        "correct_answer": "It presents a thesis about Morrison's technique and then supports it with textual evidence.",
        "rationale": "The first sentence asserts that Morrison's prose 'enacts' grief rather than describing it; the remaining sentences support this claim with specific observations about fragmented syntax and reader experience.",
        "raw_original_text": (
            "Toni Morrison's prose does not so much describe grief as enact it. Her sentences fragment under "
            "emotional weight, clauses interrupting themselves mid-thought as though the language itself cannot "
            "bear to continue. A reader finishing Beloved does not merely understand loss—she has been made "
            "to experience its texture."
        ),
    },
    # ── EXPRESSION OF IDEAS ────────────────────────────────────────────────
    {
        "module": "Reading_Writing",
        "domain": "Expression of Ideas",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "While researching urban farming, a student found the following notes:\n"
            "- Rooftop gardens in New York City reduce building cooling costs by up to 15%.\n"
            "- They capture stormwater, reducing runoff into city drains.\n"
            "- A 2022 study found rooftop gardens improve air quality by filtering particulates.\n\n"
            "The student wants to emphasize the environmental benefits of rooftop gardens. "
            "Which choice most effectively uses the notes to accomplish this goal?"
        ),
        "options": [
            "Rooftop gardens are popular in New York City because they reduce cooling costs for building owners.",
            "By capturing stormwater and filtering particulates, rooftop gardens offer significant environmental advantages for cities.",
            "A 2022 study examined the effects of rooftop gardens on air quality in urban settings.",
            "Rooftop gardens reduce cooling costs, capture stormwater, and have been studied since 2022.",
        ],
        "correct_answer": "By capturing stormwater and filtering particulates, rooftop gardens offer significant environmental advantages for cities.",
        "rationale": "This choice emphasizes the two explicitly environmental benefits—stormwater capture and air filtration—rather than the economic benefit (cooling cost reduction), best fulfilling the stated goal.",
        "raw_original_text": (
            "Notes on rooftop gardens: reduce building cooling costs 15%, capture stormwater reducing runoff, "
            "and a 2022 study found they improve air quality by filtering particulates."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Expression of Ideas",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A student is writing a paper arguing that urban heat islands worsen public health outcomes. "
            "The paper currently states: 'Studies consistently link higher urban temperatures to increased "
            "rates of heat stroke and cardiovascular stress. Cities with the most severe heat island effects "
            "show correspondingly higher emergency room visits during summer months.'\n\n"
            "The student wants to add a sentence acknowledging a limitation of the current research while "
            "maintaining the overall argument. Which sentence best accomplishes this goal?"
        ),
        "options": [
            "However, some researchers note that socioeconomic factors correlate with both heat exposure and healthcare access, complicating direct attribution to temperature alone.",
            "Nevertheless, urban heat islands are unquestionably the leading cause of premature death in major American cities.",
            "It should be noted that not all cities experience heat island effects to the same degree.",
            "Despite these findings, many city governments have been slow to implement heat mitigation strategies.",
        ],
        "correct_answer": "However, some researchers note that socioeconomic factors correlate with both heat exposure and healthcare access, complicating direct attribution to temperature alone.",
        "rationale": "This choice introduces a genuine methodological limitation (confounding variables) without undermining the core argument that heat islands correlate with worse health outcomes.",
        "raw_original_text": (
            "Studies consistently link higher urban temperatures to increased rates of heat stroke and "
            "cardiovascular stress. Cities with the most severe heat island effects show correspondingly "
            "higher emergency room visits during summer months."
        ),
    },
    # ── STANDARD ENGLISH CONVENTIONS ──────────────────────────────────────
    {
        "module": "Reading_Writing",
        "domain": "Standard English Conventions",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "Which choice completes the text so that it conforms to the conventions of Standard English?\n\n"
            "After months of preparation, the research team finally _______ their findings at the annual conference."
        ),
        "options": ["presented", "presenting", "presents", "have presented"],
        "correct_answer": "presented",
        "rationale": "The context requires simple past tense because the action occurred after 'months of preparation,' and 'presented' is the correct simple past form for a singular or plural subject.",
        "raw_original_text": "After months of preparation, the research team finally _______ their findings at the annual conference.",
    },
    {
        "module": "Reading_Writing",
        "domain": "Standard English Conventions",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "Which choice completes the text with the most appropriate punctuation?\n\n"
            "The architect's design incorporated three sustainable features _______ solar panels integrated "
            "into the roof, a rainwater collection basin beneath the foundation, and exterior walls built "
            "from recycled shipping containers."
        ),
        "options": ["features:", "features,", "features;", "features—"],
        "correct_answer": "features:",
        "rationale": "A colon follows an independent clause to introduce a list; 'The architect's design incorporated three sustainable features' is a complete clause, making the colon correct.",
        "raw_original_text": (
            "The architect's design incorporated three sustainable features _______ solar panels integrated "
            "into the roof, a rainwater collection basin beneath the foundation, and exterior walls built "
            "from recycled shipping containers."
        ),
    },
    {
        "module": "Reading_Writing",
        "domain": "Standard English Conventions",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "Which choice completes the text so that it conforms to the conventions of Standard English?\n\n"
            "The interdisciplinary research team, _______ members included specialists in marine biology, "
            "climate science, and policy analysis, released a landmark report on ocean acidification."
        ),
        "options": ["whose", "who's", "which", "that"],
        "correct_answer": "whose",
        "rationale": "'Whose' is the correct possessive relative pronoun for referring to the team's members; 'who's' is a contraction, and 'which' cannot show possession without an apostrophe construction.",
        "raw_original_text": (
            "The interdisciplinary research team, _______ members included specialists in marine biology, "
            "climate science, and policy analysis, released a landmark report on ocean acidification."
        ),
    },
    # ── ALGEBRA ───────────────────────────────────────────────────────────
    {
        "module": "Math",
        "domain": "Algebra",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A bike rental shop charges a flat fee of $5 plus $3 per hour. If Maya paid $17 total, "
            "how many hours did she rent the bike?"
        ),
        "options": ["3", "4", "5", "6"],
        "correct_answer": "4",
        "rationale": "Setting up 5 + 3h = 17, subtracting 5 gives 3h = 12, so h = 4 hours.",
        "raw_original_text": "A bike rental shop charges a flat fee of $5 plus $3 per hour. Maya paid $17 total.",
    },
    {
        "module": "Math",
        "domain": "Algebra",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A school is selling adult tickets for $8 and student tickets for $5 for a theater performance. "
            "The school sold 200 tickets and collected $1,300 in total. How many adult tickets were sold?"
        ),
        "options": ["50", "75", "100", "150"],
        "correct_answer": "100",
        "rationale": "Setting a + s = 200 and 8a + 5s = 1300; substituting s = 200 - a gives 8a + 5(200 - a) = 1300, so 3a = 300, a = 100.",
        "raw_original_text": "A school sold adult tickets for $8 and student tickets for $5, selling 200 tickets and collecting $1,300 total.",
    },
    {
        "module": "Math",
        "domain": "Algebra",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "In the xy-plane, line m passes through the points (2, 7) and (5, 1). Line n is perpendicular "
            "to line m and passes through the point (4, 3). What is the y-intercept of line n?"
        ),
        "options": ["-5", "-3", "1", "3"],
        "correct_answer": "1",
        "rationale": "Slope of m = (1-7)/(5-2) = -2; slope of n = 1/2 (negative reciprocal). Using point-slope: y - 3 = (1/2)(x - 4), so y = x/2 + 1. At x=0: y = 1.",
        "raw_original_text": "Line m passes through (2, 7) and (5, 1). Line n is perpendicular to m and passes through (4, 3).",
    },
    # ── ADVANCED MATH ─────────────────────────────────────────────────────
    {
        "module": "Math",
        "domain": "Advanced Math",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "Which of the following is equivalent to (x + 3)(x - 5)?"
        ),
        "options": [
            "x² - 2x - 15",
            "x² + 2x - 15",
            "x² - 2x + 15",
            "x² - 8x - 15",
        ],
        "correct_answer": "x² - 2x - 15",
        "rationale": "Expanding: x·x + x·(-5) + 3·x + 3·(-5) = x² - 5x + 3x - 15 = x² - 2x - 15.",
        "raw_original_text": "Expand (x + 3)(x - 5).",
    },
    {
        "module": "Math",
        "domain": "Advanced Math",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "What are the solutions to x² - 5x + 6 = 0?"
        ),
        "options": ["x = 2 and x = 3", "x = -2 and x = -3", "x = 1 and x = 6", "x = -1 and x = 6"],
        "correct_answer": "x = 2 and x = 3",
        "rationale": "Factoring: (x - 2)(x - 3) = 0, so x = 2 or x = 3.",
        "raw_original_text": "Solve x² - 5x + 6 = 0.",
    },
    {
        "module": "Math",
        "domain": "Advanced Math",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "The function f is defined by f(x) = 2x² - 8x + 3. "
            "Which of the following is an equivalent form of f(x) that displays the vertex of the parabola as a constant or coefficient?"
        ),
        "options": [
            "f(x) = 2(x - 2)² - 5",
            "f(x) = 2(x - 4)² - 5",
            "f(x) = 2(x - 2)² + 3",
            "f(x) = (x - 2)² - 5",
        ],
        "correct_answer": "f(x) = 2(x - 2)² - 5",
        "rationale": "Completing the square: 2(x² - 4x) + 3 = 2(x² - 4x + 4 - 4) + 3 = 2(x-2)² - 8 + 3 = 2(x-2)² - 5. Vertex is at (2, -5).",
        "raw_original_text": "f(x) = 2x² - 8x + 3. Rewrite in vertex form.",
    },
    # ── PROBLEM-SOLVING AND DATA ANALYSIS ─────────────────────────────────
    {
        "module": "Math",
        "domain": "Problem-solving and Data Analysis",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A car travels 240 miles on 8 gallons of gasoline. At this rate, how many gallons would "
            "the car need to travel 360 miles?"
        ),
        "options": ["10", "12", "14", "15"],
        "correct_answer": "12",
        "rationale": "Rate = 240/8 = 30 miles per gallon. Gallons needed = 360/30 = 12.",
        "raw_original_text": "A car travels 240 miles on 8 gallons. How many gallons for 360 miles?",
    },
    {
        "module": "Math",
        "domain": "Problem-solving and Data Analysis",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A store marks up all items by 40% above cost and then offers a 25% discount on the marked-up price. "
            "If an item costs the store $80, what is the final selling price?"
        ),
        "options": ["$80", "$84", "$88", "$92"],
        "correct_answer": "$84",
        "rationale": "Marked-up price = 80 × 1.40 = $112. Final price after 25% discount = 112 × 0.75 = $84.",
        "raw_original_text": "Store marks up items 40% then offers 25% discount. Item costs $80.",
    },
    {
        "module": "Math",
        "domain": "Problem-solving and Data Analysis",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "In a survey of 200 students, 120 play sports, 80 play a musical instrument, and 40 do both. "
            "A student is selected at random. What is the probability that the student plays sports "
            "given that they play a musical instrument?"
        ),
        "options": ["1/5", "2/5", "1/2", "3/5"],
        "correct_answer": "1/2",
        "rationale": "P(sports | instrument) = P(both) / P(instrument) = (40/200) / (80/200) = 40/80 = 1/2.",
        "raw_original_text": "200 students: 120 play sports, 80 play instrument, 40 do both. P(sports | instrument)?",
    },
    # ── GEOMETRY AND TRIGONOMETRY ──────────────────────────────────────────
    {
        "module": "Math",
        "domain": "Geometry and Trigonometry",
        "difficulty": "Easy",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "A circle has a radius of 6. What is the area of the circle, in terms of π?"
        ),
        "options": ["12π", "36π", "24π", "6π"],
        "correct_answer": "36π",
        "rationale": "Area = π × r² = π × 6² = 36π.",
        "raw_original_text": "Circle with radius 6. Find area in terms of π.",
    },
    {
        "module": "Math",
        "domain": "Geometry and Trigonometry",
        "difficulty": "Medium",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "In right triangle ABC, angle C is 90°, AC = 5, and BC = 12. What is sin(A)?"
        ),
        "options": ["5/13", "12/13", "5/12", "13/12"],
        "correct_answer": "12/13",
        "rationale": "Hypotenuse AB = √(5² + 12²) = √169 = 13. sin(A) = opposite/hypotenuse = BC/AB = 12/13.",
        "raw_original_text": "Right triangle ABC, angle C = 90°, AC = 5, BC = 12. Find sin(A).",
    },
    {
        "module": "Math",
        "domain": "Geometry and Trigonometry",
        "difficulty": "Hard",
        "is_spr": False,
        "source_method": "Automated_Pipeline",
        "question_text": (
            "In the xy-plane, the equation of a circle is x² + y² - 6x + 4y - 12 = 0. "
            "What is the radius of the circle?"
        ),
        "options": ["3", "4", "5", "7"],
        "correct_answer": "5",
        "rationale": "Completing the square: (x-3)² - 9 + (y+2)² - 4 - 12 = 0, so (x-3)² + (y+2)² = 25. Radius = √25 = 5.",
        "raw_original_text": "Circle equation: x² + y² - 6x + 4y - 12 = 0. Find radius.",
    },
]


def insert_one(row, exam_type='SAT', section=None):
    # Avoid mutating the original input row
    row = dict(row)
    
    # Set default exam_type and normalize
    row['exam_type'] = str(row.get('exam_type') or exam_type or 'SAT').upper()
    
    # Apply ACT-specific rules
    if row['exam_type'] == 'ACT':
        if section:
            row.setdefault('section', section)
        if 'section' not in row:
            raise ValueError("ACT questions must have a 'section' defined (English, Math, Reading, or Science)")
        # Clean for ACT
        row.pop('module', None)
    
    # Apply SAT-specific rules
    if row['exam_type'] == 'SAT':
        row.setdefault('module', 'Math')
        # Ensure section is absent/NULL for SAT
        row.pop('section', None)
        
    payload = json.dumps([row]).encode()
    url = f"{SUPABASE_URL}/rest/v1/sat_question_bank"
    req = urllib.request.Request(url, data=payload, headers=get_headers(), method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    print(f"Seeding {len(SEED_QUESTIONS)} questions...")
    ok = 0
    fail = 0
    for i, q in enumerate(SEED_QUESTIONS):
        status, err = insert_one(q)
        if err:
            print(f"  Q{i+1} FAIL [{q['domain']} | {q['difficulty']}]: {status} — {err[:300]}")
            fail += 1
        else:
            print(f"  Q{i+1} OK: {q['domain']} | {q['difficulty']}")
            ok += 1
    print(f"\nDone: {ok} inserted, {fail} failed.")


if __name__ == "__main__":
    main()
