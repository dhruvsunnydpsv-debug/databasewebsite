import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
    console.log("🔍 Scanning for fake 'Simulated' injection records...");

    // 1. Check for the string "Simulated" in raw_original_text
    const { data: simulatedData, error: simError } = await supabase
        .from('sat_question_bank')
        .select('id, raw_original_text, question_text')
        .ilike('raw_original_text', '%Simulated%');

    if (simError) {
        console.error("Supabase Error:", simError);
        return;
    }

    console.log(`Found ${simulatedData.length} fake records in 'raw_original_text'.`);

    // Also check for "Azura" duplicates in the output text to be safe
    const { data: azuraData, error: azError } = await supabase
        .from('sat_question_bank')
        .select('id')
        .ilike('question_text', '%Azura%');

    console.log(`Found ${azuraData ? azuraData.length : 0} duplicate 'Azura' generated records.`);

    const idsToDelete = new Set([
        ...simulatedData.map(d => d.id),
        ...(azuraData || []).map(d => d.id)
    ]);

    if (idsToDelete.size > 0) {
        console.log(`🧹 Cleaning ${idsToDelete.size} corrupted/fake rows from database...`);
        const { error: delError } = await supabase
            .from('sat_question_bank')
            .delete()
            .in('id', Array.from(idsToDelete));

        if (delError) {
            console.error("Failed to delete corrupted rows:", delError);
        } else {
            console.log("✅ Successfully purged fake and duplicate ingestion records.");
        }
    } else {
        console.log("✅ Database is already clean. No simulated records found.");
    }

    // Double check that we get 0 simulated records back
    const { data: verifyData } = await supabase
        .from('sat_question_bank')
        .select('id')
        .ilike('raw_original_text', '%Simulated%');

    if (verifyData && verifyData.length === 0) {
        console.log("✅ Verification Passed: raw_original_text no longer contains 'Simulated'.");
    } else {
        console.error("❌ Verification Failed: simulated records still exist.");
    }
}

runVerification();
