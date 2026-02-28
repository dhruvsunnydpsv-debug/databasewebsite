import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
import Link from 'next/link';

interface AuditRow {
    id: string;
    module: string;
    domain: string;
    difficulty: string;
    source_method: string;
    question_text: string;
    options: string[] | null;
    correct_answer: string;
    raw_original_text: string | null;
    created_at: string;
}

export default async function AdminAuditPage() {
    // Server-side Supabase client — no client-side fetch needed
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
        .from('sat_question_bank')
        .select('id, module, domain, difficulty, source_method, question_text, options, correct_answer, raw_original_text, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

    const rows: AuditRow[] = data || [];

    const tagColor = (source: string) =>
        source === 'Admin_Dropzone'
            ? { bg: '#E6D5F8', border: '#7C4DFF' }
            : { bg: '#D5F0E6', border: '#2ECC71' };

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '3rem 1.5rem', fontFamily: "'Inter', sans-serif" }}>

            {/* ── Admin Portal Banner ──────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                backgroundColor: '#FFF0F0', border: '1px solid #C0392B',
                borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '1.5rem',
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C0392B', margin: 0 }}>
                    ADMIN PORTAL — AUDIT LOG — SECURE ZONE
                </p>
            </div>

            {/* ── Navigation Toggle ───────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <Link href="/admin/ingest" style={{
                    padding: '0.5rem 1.25rem', borderRadius: '9999px',
                    border: '1px solid #0D0D0D', backgroundColor: '#FAFAF2',
                    color: '#0D0D0D', fontSize: '0.8rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.15s ease',
                }}>
                    Ingestion Dropzone
                </Link>
                <Link href="/admin/audit" style={{
                    padding: '0.5rem 1.25rem', borderRadius: '9999px',
                    border: '1px solid #0D0D0D', backgroundColor: '#0D0D0D',
                    color: '#FBFBF2', fontSize: '0.8rem', fontWeight: 600,
                    textDecoration: 'none',
                }}>
                    Audit Logs
                </Link>
            </div>

            {/* ── Page Header ─────────────────────────────────── */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(1.8rem, 5vw, 2.75rem)',
                    fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#0D0D0D', marginBottom: '0.6rem',
                }}>
                    Entity Swap Audit
                </h1>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#555550', maxWidth: '620px' }}>
                    Side-by-side comparison of raw source material vs. synthesized output.
                    Verify that the Engine (math/logic) is unchanged while the Paint (names/entities) has been swapped.
                </p>
            </div>

            {/* ── Error ──────────────────────────────────────── */}
            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#FFF5F5', border: '1px solid #C0392B', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.8rem', color: '#C0392B', margin: 0 }}>Error: {error.message}</p>
                </div>
            )}

            {/* ── Empty State ────────────────────────────────── */}
            {rows.length === 0 && !error && (
                <p style={{ fontSize: '0.9rem', color: '#888880', textAlign: 'center', padding: '3rem 0' }}>
                    No questions in the database yet.
                </p>
            )}

            {/* ── Comparison Cards ─────────────────────────────── */}
            {rows.map((row) => {
                const sc = tagColor(row.source_method || 'Automated_Pipeline');
                return (
                    <div key={row.id} style={{
                        border: '1px solid #D0D0C8', borderRadius: '12px',
                        marginBottom: '1.5rem', overflow: 'hidden',
                        backgroundColor: '#FBFBF2',
                    }}>
                        {/* ── Top Bar ── */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                            padding: '0.75rem 1.25rem',
                            borderBottom: '1px solid #D0D0C8',
                            backgroundColor: '#F5F5ED',
                        }}>
                            <span style={{
                                backgroundColor: sc.bg, border: `1px solid ${sc.border}`,
                                borderRadius: '9999px', padding: '0.1rem 0.6rem',
                                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                            }}>
                                {row.source_method === 'Admin_Dropzone' ? 'Manual' : 'Automated'}
                            </span>
                            <span style={{
                                backgroundColor: '#E8E8E0', borderRadius: '9999px',
                                padding: '0.1rem 0.6rem', fontSize: '0.6rem', fontWeight: 600,
                                letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>
                                {row.domain?.replace(/_/g, ' ')}
                            </span>
                            <span style={{
                                backgroundColor: row.difficulty === 'Hard' ? '#FFE0E0' : row.difficulty === 'Medium' ? '#FFF3D0' : '#D5F0E6',
                                borderRadius: '9999px', padding: '0.1rem 0.6rem',
                                fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>
                                {row.difficulty}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#888880' }}>
                                {new Date(row.created_at).toLocaleString()}
                            </span>
                        </div>

                        {/* ── Side-by-Side Columns ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', minHeight: '140px' }}>

                            {/* LEFT: Original Raw Source */}
                            <div style={{ padding: '1.25rem', backgroundColor: 'rgba(0,0,0,0.03)' }}>
                                <p style={{
                                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: '#888880', marginBottom: '0.75rem',
                                }}>
                                    Original Raw Source
                                </p>
                                {row.raw_original_text ? (
                                    <p style={{
                                        fontSize: '0.82rem', lineHeight: 1.65, color: '#333',
                                        fontFamily: "'Courier New', monospace",
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    }}>
                                        {row.raw_original_text.substring(0, 500)}
                                        {row.raw_original_text.length > 500 ? '…' : ''}
                                    </p>
                                ) : (
                                    <p style={{ fontSize: '0.82rem', color: '#C0392B', fontStyle: 'italic' }}>
                                        No raw source captured for this question.
                                    </p>
                                )}
                            </div>

                            {/* CENTER: Arrow Divider */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 0.5rem', borderLeft: '1px solid #D0D0C8', borderRight: '1px solid #D0D0C8',
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C4DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                            </div>

                            {/* RIGHT: Synthesized Output */}
                            <div style={{ padding: '1.25rem', backgroundColor: '#fff' }}>
                                <p style={{
                                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', color: '#888880', marginBottom: '0.75rem',
                                }}>
                                    Synthesized Output
                                </p>
                                <p style={{
                                    fontSize: '0.85rem', lineHeight: 1.65, color: '#0D0D0D',
                                    fontFamily: "'Playfair Display', serif",
                                    marginBottom: '0.75rem',
                                }}>
                                    {row.question_text}
                                </p>
                                {row.options && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {row.options.map((opt: string, i: number) => (
                                            <span key={i} style={{
                                                display: 'inline-block', padding: '0.35rem 0.65rem',
                                                border: opt === row.correct_answer ? '2px solid #2ECC71' : '1px solid #D0D0C8',
                                                borderRadius: '6px', fontSize: '0.78rem',
                                                backgroundColor: opt === row.correct_answer ? '#EAFFF0' : '#FDFDF5',
                                            }}>
                                                <strong style={{ marginRight: '0.35rem' }}>{String.fromCharCode(65 + i)}.</strong>{opt}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
