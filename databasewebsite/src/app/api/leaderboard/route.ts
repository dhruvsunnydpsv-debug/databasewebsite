import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get top 20 scores (one best per user)
    const { data, error } = await supabase
        .from('user_test_sessions')
        .select('user_id, composite_score, rw_score, math_score, created_at')
        .order('composite_score', { ascending: false })
        .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicate — keep only best score per user
    const seen = new Map<string, typeof data[0]>()
    for (const row of data ?? []) {
        if (!seen.has(row.user_id) || row.composite_score > seen.get(row.user_id)!.composite_score) {
            seen.set(row.user_id, row)
        }
    }

    const top = Array.from(seen.values())
        .sort((a, b) => b.composite_score - a.composite_score)
        .slice(0, 20)

    // Get user emails via admin API
    const enriched = await Promise.all(top.map(async (row) => {
        try {
            const { data: userData } = await supabase.auth.admin.getUserById(row.user_id)
            const email = userData?.user?.email ?? ''
            const name = userData?.user?.user_metadata?.full_name ?? ''
            // Mask email: dh***@gmail.com
            const masked = email
                ? email.replace(/^(.{2}).*?(@.*)$/, (_, a, b) => `${a}***${b}`)
                : 'Anonymous'
            return {
                user_id: row.user_id,
                display: name ? name.split(' ')[0] + ' ' + (name.split(' ')[1]?.[0] ?? '') + '.' : masked,
                composite_score: row.composite_score,
                rw_score: row.rw_score,
                math_score: row.math_score,
                created_at: row.created_at,
            }
        } catch {
            return {
                user_id: row.user_id,
                display: 'Anonymous',
                composite_score: row.composite_score,
                rw_score: row.rw_score,
                math_score: row.math_score,
                created_at: row.created_at,
            }
        }
    }))

    return NextResponse.json({ data: enriched })
}
