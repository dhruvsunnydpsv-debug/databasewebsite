import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Domain values MUST match the actual DB CHECK constraint (space format)
const SYSTEM_PROMPT = `You are an elite Digital SAT content creator (2026 Syllabus).
TASK: Apply the Entity Swap technique to the provided RAW text. Keep the core logic/math/structure identical, swap out names and surface entities.

Return ONLY valid JSON. No extra fields, no markdown, no explanation.

{
  "module": "MUST be exactly: Reading_Writing OR Math",
  "domain": "MUST be exactly one of: Information and Ideas | Craft and Structure | Expression of Ideas | Standard English Conventions | Algebra | Advanced Math | Problem-solving and Data Analysis | Geometry and Trigonometry",
  "difficulty": "Easy | Medium | Hard",
  "question_text": "The synthesized question text. No JSON, no code, no URLs.",
  "options": ["Option text A", "Option text B", "Option text C", "Option text D"],
  "correct_answer": "Exact text of the correct option (must match one of the options strings exactly)",
  "rationale": "One sentence explanation of why the correct answer is correct."
}`;

// Real DB domain values (space format matching schema.sql CHECK constraint)
const RW_DOMAINS = new Set(['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions']);
const MATH_DOMAINS = new Set(['Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry']);
const VALID_MODULES = new Set(['Reading_Writing', 'Math']);
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

// Normalizer for AI returning wrong format
const DOMAIN_NORMALIZER: Record<string, string> = {
    'Information and Ideas': 'Information and Ideas',
    'Information_Ideas': 'Information and Ideas',
    'Craft and Structure': 'Craft and Structure',
    'Craft_Structure': 'Craft and Structure',
    'Expression of Ideas': 'Expression of Ideas',
    'Expression_Ideas': 'Expression of Ideas',
    'Standard English Conventions': 'Standard English Conventions',
    'Standard_English': 'Standard English Conventions',
    'Algebra': 'Algebra',
    'Heart_of_Algebra': 'Algebra',
    'Heart of Algebra': 'Algebra',
    'Advanced Math': 'Advanced Math',
    'Advanced_Math': 'Advanced Math',
    'Problem-solving and Data Analysis': 'Problem-solving and Data Analysis',
    'Problem_Solving_Data': 'Problem-solving and Data Analysis',
    'Problem Solving and Data Analysis': 'Problem-solving and Data Analysis',
    'Geometry and Trigonometry': 'Geometry and Trigonometry',
    'Geometry_Trigonometry': 'Geometry and Trigonometry',
};

const MODULE_FROM_DOMAIN = (domain: string): string => {
    if (RW_DOMAINS.has(domain)) return 'Reading_Writing';
    if (MATH_DOMAINS.has(domain)) return 'Math';
    return '';
};

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const rawFileText = await file.text();
        const rawQuestions = rawFileText.split(/\n\s*\n/).map(q => q.trim()).filter(q => q.length > 10);

        if (rawQuestions.length === 0) {
            return NextResponse.json({ error: 'No valid question blocks found in file' }, { status: 400 });
        }

        const groqKeys = (process.env.GROQ_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean);
        if (groqKeys.length === 0) {
           return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
        }

        const results = [];

        for (let i = 0; i < rawQuestions.length; i++) {
            const raw_q = rawQuestions[i];
            const currentKey = groqKeys[i % groqKeys.length];
            const groqClient = new Groq({ apiKey: currentKey });

            try {
                const completion = await groqClient.chat.completions.create({
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
                try { parsed = JSON.parse(rawResponse); } catch { continue; }

                const qText: string = (parsed.question_text || "").trim();
                if (!qText || qText.startsWith('{') || qText.startsWith('[') || qText.includes('http')) {
                    console.error("Rejected: bad question_text:", qText.slice(0, 80));
                    continue;
                }

                const normalizedDomain: string = DOMAIN_NORMALIZER[parsed.domain] || "";
                if (!normalizedDomain) {
                    console.error("Rejected: unknown domain:", parsed.domain);
                    continue;
                }

                const difficulty: string = parsed.difficulty || "Medium";
                if (!VALID_DIFFICULTIES.has(difficulty)) continue;

                if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
                    console.error("Rejected: options must be 4-element array");
                    continue;
                }

                const correctAnswer: string = (parsed.correct_answer || "").trim();
                if (!parsed.options.includes(correctAnswer)) {
                    console.error("Rejected: correct_answer not in options:", correctAnswer);
                    continue;
                }

                // Derive module from domain — required NOT NULL column
                const module = MODULE_FROM_DOMAIN(normalizedDomain);
                if (!module) { console.error("Rejected: could not determine module from domain:", normalizedDomain); continue; }

                // Build payload matching ALL required columns in schema.sql
                const dbPayload = {
                    module,
                    domain: normalizedDomain,
                    difficulty,
                    question_text: qText,
                    options: parsed.options,
                    correct_answer: correctAnswer,
                    rationale: (parsed.rationale || '').trim() || `The correct answer is: ${correctAnswer}`,
                    is_spr: false,
                    source_method: 'Admin_Dropzone',
                    raw_original_text: raw_q,
                };

                const { data: insertedData, error: dbError } = await supabase
                    .from('sat_question_bank')
                    .insert(dbPayload)
                    .select('id, module, domain, difficulty, question_text, options, correct_answer')
                    .single();

                if (dbError) {
                    console.error("Supabase Insertion Error:", dbError.message);
                } else {
                    results.push(insertedData);
                }
            } catch (err: any) {
                console.error("Error processing block:", err.message);
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
