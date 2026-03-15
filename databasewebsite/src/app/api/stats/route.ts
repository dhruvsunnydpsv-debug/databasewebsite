import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (!url || !key) throw new Error("Missing Supabase credentials");

    const supabase = createClient(url, key);

    const domains = [
        "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry",
        "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"
    ];

    const { count: total, error: e1 } = await supabase.from('sat_question_bank').select('*', { count: 'exact', head: true });
    const { count: migrated, error: e2 } = await supabase.from('sat_question_bank').select('*', { count: 'exact', head: true }).in('domain', domains);
    
    if (e1 || e2) throw new Error("Database connection failed");

    const distribution = [];
    for (const d of domains) {
      const { count } = await supabase.from('sat_question_bank').select('*', { count: 'exact', head: true }).eq('domain', d);
      distribution.push({ name: d, count: count || 0 });
    }

    return NextResponse.json({
      total: total || 0,
      migrated: migrated || 0,
      distribution
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
