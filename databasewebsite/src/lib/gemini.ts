import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are an elite Digital SAT curriculum engineer. I will provide a raw SAT question. You must isolate the core mathematical concept, logical reasoning structure, or grammatical rule being tested. Then, generate a completely new, synthetic version of this question. You MUST change all names, numbers, scenarios, equations, and phrasing to ensure the new question is 100% original and copyright-free. Keep the exact same difficulty and SAT domain. Output the result strictly as a JSON object matching our database schema.

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

        const jsonText = response.text();
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
