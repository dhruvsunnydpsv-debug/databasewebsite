import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function check() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { count, error } = await supabase.from('sat_question_bank').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error fetching count:', error);
        return;
    }
    console.log('Total questions:', count);

    const { data: samples, error: sError } = await supabase.from('sat_question_bank').select('module, domain, question_text').limit(5);
    if (sError) {
        console.error('Error fetching samples:', sError);
        return;
    }
    console.log('Samples:', JSON.stringify(samples, null, 2));
}

check();
