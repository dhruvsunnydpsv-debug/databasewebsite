import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Domain values MUST match sat_question_bank.domain exactly (underscore format)
const SYSTEM_PROMPT = `You are an elite Digital SAT content creator (2026 Syllabus).
TASK: Apply the Entity Swap technique to the provided RAW text. Keep the core logic/math/structure identical, but swap out names, locations, and surface-level entities.

Return ONLY valid JSON matching this exact schema. No extra fields, no markdown, no explanation.

{
  "domain": "MUST be exactly one of: Information_Ideas | Craft_Structure | Expression_Ideas | Standard_English | Heart_of_Algebra | Advanced_Math | Problem_Solving_Data | Geometry_Trigonometry",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "The synthesized question text. No JSON, no code, no URLs.",
  "options": ["Option text A", "Option text B", "Option text C", "Option text D"],
  "correct_answer": "Exact text of the correct option (must match one of the options strings exactly)"
}`;

// Map AI output domain to valid DB domain in case AI still returns wrong format
const DOMAIN_NORMALIZER: Record<string, string> = {
    'Information_Ideas': 'Information_Ideas',
    'Information and Ideas': 'Information_Ideas',
    'Craft_Structure': 'Craft_Structure',
    'Craft and Structure': 'Craft_Structure',
    'Expression_Ideas': 'Expression_Ideas',
    'Expression of Ideas': 'Expression_Ideas',
    'Standard_English': 'Standard_English',
    'Standard English Conventions': 'Standard_English',
    'Heart_of_Algebra': 'Heart_of_Algebra',
    'Algebra': 'Heart_of_Algebra',
    'Heart of Algebra': 'Heart_of_Algebra',
    'Advanced_Math': 'Advanced_Math',
    'Advanced Math': 'Advanced_Math',
    'Problem_Solving_Data': 'Problem_Solving_Data',
    'Problem-solving and Data Analysis': 'Problem_Solving_Data',
    'Problem Solving and Data Analysis': 'Problem_Solving_Data',
    'Geometry_Trigonometry': 'Geometry_Trigonometry',
    'Geometry and Trigonometry': 'Geometry_Trigonometry',
};

const VALID_DOMAINS = new Set(Object.values(DOMAIN_NORMALIZER));
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const rawFileText = await file.text();

        // Split on double newlines — each block is one source question
        const rawQuestions = rawFileText.split(/\n\s*\n/).map(q => q.trim()).filter(q => q.length > 10);

        if (rawQuestions.length === 0) {
            return NextResponse.json({ error: 'No valid question blocks found in file' }, { status: 400 });
        }

        const results = [];

        for (const raw_q of rawQuestions) {
            try {
                const completion = await groq.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: `Raw source material:\n\n${raw_q}` }
                    ],
                    temperature: 0.4,
                    response_format: { type: "json_object" }
                });

                const rawResponse = completion.choices[0]?.message?.content;
                if (!rawResponse) continue;

                let parsed: any;
                try {
                    parsed = JSON.parse(rawResponse);
                } catch {
                    console.error("JSON parse failed for response:", rawResponse);
                    continue;
                }

                const qText: string = (parsed.question_text || "").trim();

                // Reject if question_text is empty or looks like leaked JSON/code
                if (!qText || qText.startsWith('{') || qText.startsWith('[') || qText.includes('http')) {
                    console.error("Rejected: question_text looks like JSON or metadata:", qText.slice(0, 100));
                    continue;
                }

                // Normalize domain to DB-valid underscore format
                const normalizedDomain: string = DOMAIN_NORMALIZER[parsed.domain] || "";
                if (!VALID_DOMAINS.has(normalizedDomain)) {
                    console.error("Rejected: unknown domain value:", parsed.domain);
                    continue;
                }

                // Normalize difficulty
                const difficulty: string = parsed.difficulty || "Medium";
                if (!VALID_DIFFICULTIES.has(difficulty)) {
                    console.error("Rejected: unknown difficulty value:", difficulty);
                    continue;
                }

                // Validate options array
                if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
                    console.error("Rejected: options must be array of 4 strings");
                    continue;
                }

                // Validate correct_answer matches one of the options
                const correctAnswer: string = (parsed.correct_answer || "").trim();
                if (!parsed.options.includes(correctAnswer)) {
                    console.error("Rejected: correct_answer does not match any option:", correctAnswer);
                    continue;
                }

                // Build payload using ONLY columns that exist in sat_question_bank
                const dbPayload = {
                    domain: normalizedDomain,
                    difficulty,
                    question_text: qText,
                    options: parsed.options,
                    correct_answer: correctAnswer,
                    raw_original_text: raw_q,
                };

                const { data: insertedData, error: dbError } = await supabase
                    .from('sat_question_bank')
                    .insert(dbPayload)
                    .select('id, domain, difficulty, question_text, options, correct_answer')
                    .single();

                if (dbError) {
                    console.error("Supabase Insertion Error:", dbError.message, "Payload:", JSON.stringify(dbPayload));
                } else {
                    results.push(insertedData);
                }
            } catch (err: any) {
                console.error("Error processing question block:", err.message);
            }
        }

        if (results.length === 0) {
            return NextResponse.json({ error: 'No questions were successfully processed. Check server logs.' }, { status: 422 });
        }

        return NextResponse.json({ success: true, count: results.length, data: results });
    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
