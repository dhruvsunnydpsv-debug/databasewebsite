import { NextResponse } from 'next/server';
import { generateSyntheticQuestion } from '../../../lib/gemini';
import { supabase } from '../../../lib/supabase';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');

        // 1. Send image to Gemini API
        const generatedQuestion = await generateSyntheticQuestion(base64Image, file.type);

        // 2. Format data for Supabase
        const dbPayload = {
            ...generatedQuestion,
            source_method: 'Admin_Dropzone'
        };

        // 3. Insert into Supabase
        const { data: insertedData, error: dbError } = await supabase
            .from('sat_question_bank')
            .insert(dbPayload)
            .select()
            .single();

        if (dbError) {
            console.error("Supabase Insertion Error:", dbError);
            return NextResponse.json({ error: dbError.message, details: dbError }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: insertedData });
    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
