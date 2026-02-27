"use client";

export default function Home() {
    return (
        <div style={{ backgroundColor: '#FBFBF2', minHeight: 'calc(100vh - 3.5rem)', overflow: 'hidden' }}>

            {/* ── Hero Section ─────────────────────────────────────── */}
            <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>

                {/* Floating Pill Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '3rem', justifyContent: 'center' }}>
                    {['Entity Swapping', 'Gemini Vision AI', 'College Board Compliant', 'Zero Copyright'].map(tag => (
                        <span key={tag} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: '#E6D5F8',
                            border: '1px solid #0D0D0D',
                            borderRadius: '9999px',
                            padding: '0.25rem 0.875rem',
                            fontSize: '0.7rem',
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase' as const,
                            color: '#0D0D0D',
                        }}>
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Main Headline */}
                <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 2rem' }}>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
                        fontWeight: 900,
                        lineHeight: 1.05,
                        letterSpacing: '-0.02em',
                        color: '#0D0D0D',
                        marginBottom: '1.5rem',
                    }}>
                        Don&apos;t copy,<br />
                        <span style={{ fontStyle: 'italic', color: '#0D0D0D' }}>just synthesize.</span>
                    </h1>
                    <p style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '1.05rem',
                        lineHeight: 1.7,
                        color: '#555550',
                        maxWidth: '560px',
                        margin: '0 auto',
                    }}>
                        Upload a screenshot of any SAT question. Our engine swaps the{' '}
                        <em>paint</em> while preserving the <em>engine</em> — producing a
                        100% original, copyright-free variant with identical difficulty.
                    </p>
                </div>

                {/* CTA Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '5rem' }}>
                    <a
                        href="/admin/ingestion"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#E6D5F8',
                            color: '#0D0D0D',
                            border: '1px solid #0D0D0D',
                            borderRadius: '9999px',
                            padding: '0.75rem 1.75rem',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'transform 0.15s ease, background-color 0.15s ease',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#D4BFEF';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#E6D5F8';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        Open Ingestion Engine →
                    </a>
                    <a
                        href="#how-it-works"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: 'transparent',
                            color: '#0D0D0D',
                            border: '1px solid #0D0D0D',
                            borderRadius: '9999px',
                            padding: '0.75rem 1.75rem',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            textDecoration: 'none',
                            transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(13,13,13,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        How it works
                    </a>
                </div>

                {/* Decorative Visual Strip */}
                <div style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '1rem',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}>
                    {[
                        { num: '∞', label: 'Questions Generated' },
                        { num: '0%', label: 'Copyright Risk' },
                        { num: '100%', label: 'Difficulty Preserved' },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            textAlign: 'center',
                            padding: '1.75rem 2.5rem',
                            border: '1px solid #0D0D0D',
                            borderRadius: '12px',
                            backgroundColor: '#F5F5EC',
                            minWidth: '160px',
                            flex: '0 1 auto',
                        }}>
                            <p style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '2.5rem',
                                fontWeight: 900,
                                color: '#0D0D0D',
                                marginBottom: '0.25rem',
                                lineHeight: 1,
                            }}>
                                {stat.num}
                            </p>
                            <p style={{
                                fontFamily: "'Inter', sans-serif",
                                fontSize: '0.72rem',
                                color: '#888880',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                fontWeight: 500,
                            }}>
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────── */}
            <section id="how-it-works" style={{
                borderTop: '1px solid #D0D0C8',
                padding: '5rem 1.5rem',
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <p style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#888880',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                    }}>
                        The Engine
                    </p>
                    <h2 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 'clamp(1.8rem, 4vw, 3rem)',
                        fontWeight: 700,
                        textAlign: 'center',
                        marginBottom: '3.5rem',
                        letterSpacing: '-0.01em',
                    }}>
                        Paint vs. Engine doctrine
                    </h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1.25rem',
                    }}>
                        {[
                            {
                                icon: '🎨',
                                title: 'Paint (Swapped)',
                                desc: 'Names, places, companies, and surface-level scenarios are completely replaced with new entities.',
                                tag: 'Changed',
                                tagColor: '#E6D5F8',
                            },
                            {
                                icon: '⚙️',
                                title: 'Engine (Preserved)',
                                desc: 'Mathematical values, grammar traps, logical structures, and difficulty anchors stay 100% identical.',
                                tag: 'Untouched',
                                tagColor: '#D4EFD4',
                            },
                            {
                                icon: '🧠',
                                title: 'Gemini Vision',
                                desc: 'Gemini 1.5 Flash reads the screenshot, parses the question, and executes the swap in one shot.',
                                tag: 'AI-Powered',
                                tagColor: '#FBE9D5',
                            },
                        ].map(card => (
                            <div key={card.title} style={{
                                padding: '1.75rem',
                                border: '1px solid #0D0D0D',
                                borderRadius: '12px',
                                backgroundColor: '#FAFAF2',
                            }}>
                                <div style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>{card.icon}</div>
                                <span style={{
                                    display: 'inline-block',
                                    backgroundColor: card.tagColor,
                                    border: '1px solid #0D0D0D',
                                    borderRadius: '9999px',
                                    padding: '0.15rem 0.6rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    marginBottom: '0.75rem',
                                    fontFamily: "'Inter', sans-serif",
                                }}>
                                    {card.tag}
                                </span>
                                <h3 style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: '1.15rem',
                                    fontWeight: 700,
                                    marginBottom: '0.5rem',
                                }}>
                                    {card.title}
                                </h3>
                                <p style={{
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: '0.85rem',
                                    lineHeight: 1.65,
                                    color: '#555550',
                                }}>
                                    {card.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

        </div>
    )
}
