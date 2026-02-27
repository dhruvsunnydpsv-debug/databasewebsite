import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are an elite, high-precision data parser for a Digital SAT database. I will provide a source SAT question. Your strictly enforced job is 'Entity Swapping'. You will leave the 'Engine' of the question untouched and only change the 'Paint'.

RULES:
1. DO NOT change a single number, mathematical operator, variable ($x$, $y$), or equation.
2. DO NOT alter the core grammatical structure, sentence length, or punctuation logic.
3. YOU MUST swap all proper nouns (e.g., change 'Michael' to 'Sarah', 'New York' to 'London').
4. YOU MUST swap superficial objects and scenarios (e.g., change 'selling 5 apples' to 'buying 5 notebooks').
5. Update the question text, the correct answer, and the 4 multiple-choice options to reflect the new nouns.
6. Output strictly in valid JSON matching our database schema: { "module", "domain", "difficulty", "question_text", "options", "correct_answer", "rationale" }.

The schema output MUST adhere exactly to this format (do not include markdown wrapping or \`\`\`json):
{
  "module": "Math" | "Reading_Writing",
  "domain": "Heart_of_Algebra" | "Advanced_Math" | "Problem_Solving_Data" | "Geometry_Trigonometry" | "Information_and_Ideas" | "Craft_and_Structure" | "Expression_of_Ideas" | "Standard_English_Conventions",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question_text": "...",
  "options": ["A", "B", "C", "D"] | null,
  "correct_answer": "...",
  "rationale": "..."
}
`;

export async function generateSyntheticQuestion(imageBase64: string, mimeType: string) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: SYSTEM_PROMPT },
                        {
                            inlineData: {
                                data: imageBase64,
                                mimeType: mimeType
                            }
                        }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const jsonText = response.text;
        if (!jsonText) {
            throw new Error("No text returned from Gemini API");
        }

        const data = JSON.parse(jsonText);
        return data;
    } catch (error) {
        console.error("Error in generateSyntheticQuestion:", error);
        throw error;
    }
}
