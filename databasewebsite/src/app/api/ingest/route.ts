import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const SYSTEM_PROMPT = `You are an expert SAT content developer.
TASK: perform an 'Entity Swap' on the following question.
- Change names, locations, and objects (The 'Paint').
- DO NOT change the numbers, logic, or correct answer (The 'Engine').
- STRICTLY output valid JSON.

JSON Schema:
{
    "domain": "String (MUST be one of: Heart_of_Algebra, Advanced_Math, Problem_Solving_Data, Geometry_Trigonometry, Information_Ideas, Craft_Structure, Expression_Ideas, Standard_English)",
    "question_text": "The new re-written question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "The correct option text",
    "difficulty": "Medium",
    "rationale": "",
    "module": 1
}`;

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const text = await file.text();

        // Simple heuristic to split questions: assume each non-empty line or block separated by double newlines is a question.
        const rawQuestions = text.split(/\n\s*\n/).map(q => q.trim()).filter(q => q.length > 10);

        if (rawQuestions.length === 0) {
            return NextResponse.json({ error: 'No valid questions found in file' }, { status: 400 });
        }

        const results = [];

        for (const raw_q of rawQuestions) {
            try {
                const completion = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `Raw Question: "${raw_q}"` }
                    ],
                    temperature: 0.5,
                    response_format: { type: "json_object" }
                });

                const rawResponse = completion.choices[0]?.message?.content;
                if (!rawResponse) continue;

                const parsed = JSON.parse(rawResponse);

                const dbPayload = {
                    domain: parsed.domain,
                    question_text: parsed.question_text,
                    options: parsed.options,
                    correct_answer: parsed.correct_answer,
                    difficulty: parsed.difficulty,
                    rationale: parsed.rationale || "",
                    module: parsed.module || 1,
                    raw_original_text: raw_q, // Ensuring original text goes straight to UI Audit Log
                    source_method: 'Admin_Dropzone'
                };

                const { data: insertedData, error: dbError } = await supabase
                    .from('sat_question_bank')
                    .insert(dbPayload)
                    .select()
                    .single();

                if (dbError) {
                    console.error("Supabase Insertion Error:", dbError);
                } else {
                    results.push(insertedData);
                }
            } catch (err: any) {
                console.error("Error processing question:", err);
            }
        }

        return NextResponse.json({ success: true, count: results.length, data: results });
    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
