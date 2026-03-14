import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const SYSTEM_PROMPT = `You are an elite Digital SAT content creator (2026 Syllabus).
TASK: Convert the provided RAW text into a high-fidelity SAT question.

JSON Schema:
{
  "module": "Reading_Writing OR Math",
  "domain": "One of: Algebra, Advanced Math, Problem-solving and Data Analysis, Geometry and Trigonometry, Craft and Structure, Information and Ideas, Standard English Conventions, Expression of Ideas",
  "sub_domain": "Specific skill name (e.g., 'Words in Context')",
  "difficulty": "Easy, Medium, Hard",
  "question_text": "Sophisticated text. For RW, must be a 3-5 sentence passage. NO raw JSON or code.",
  "is_spr": false,
  "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
  "correct_answer": "Exact correct choice text",
  "rationale": "One sentence explanation",
  "module": "Math or Reading_Writing"
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

                // Sanity Check: Reject if question_text looks like JSON/Code
                const qText = parsed.question_text || "";
                const looksLikeJson = qText.trim().startsWith('{') || qText.trim().startsWith('[') || (qText.includes('{') && qText.includes(':'));
                const hasMetadata = qText.includes('api.') || qText.includes('.org') || qText.includes('http');
                
                if (looksLikeJson || hasMetadata) {
                    console.error("Inbound question rejected: Detected JSON/Metadata leakage.");
                    return NextResponse.json({ error: "Validation failed: Inbound content contains code snippets or metadata." }, { status: 400 });
                }

                const dbPayload = {
                    module: parsed.module || "Math",
                    domain: parsed.domain,
                    sub_domain: parsed.sub_domain,
                    difficulty: parsed.difficulty,
                    question_text: qText,
                    is_spr: !!parsed.is_spr,
                    options: parsed.options,
                    correct_answer: parsed.correct_answer,
                    rationale: parsed.rationale,
                    raw_original_text: text.slice(0, 1000),
                    source_method: "Admin_Dropzone"
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
