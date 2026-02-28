import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'placeholder' });

const SYSTEM_PROMPT = `You are an elite SAT data parser. I will provide a raw SAT question.
RULE 1 (Entity Swap): You must perform strict 'Entity Swapping'. DO NOT change any mathematical formulas, numbers, equations, or core logic. You must ONLY swap the 'paint': proper nouns, names, cities, and superficial objects (e.g., change 'John buying 5 apples' to 'Sarah buying 5 notebooks'). Keep the difficulty identical.
RULE 2 (Strict Tags): You must output strictly in JSON. For the 'section', 'domain', and 'difficulty' keys, you MUST pick exactly one string from this list (NO SPACES ALLOWED):
Sections: 'Math', 'Reading_Writing'
Math Domains: 'Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry'
RW Domains: 'Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'
Difficulties: 'Easy', 'Medium', 'Hard'
Output Schema: { "module": "<section>", "domain": "<domain>", "difficulty": "<difficulty>", "question_text": "<swapped question>", "is_spr": false, "options": ["A","B","C","D"]|null, "correct_answer": "<answer>", "rationale": "<1 sentence>", "raw_original_text": "<exact original text BEFORE entity swap>" }`;

export async function generateSyntheticQuestion(imageBase64: string, _mimeType: string) {
    const userPrompt = `Here is the base64-encoded image of a SAT question. Extract the text, then perform an Entity Swap as described in the system prompt. Return strict JSON only.\n\n[IMAGE_DATA]\n${imageBase64.substring(0, 2000)}...\n[/IMAGE_DATA]`;

    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) throw new Error("No response from Groq API");

    return JSON.parse(raw);
}
