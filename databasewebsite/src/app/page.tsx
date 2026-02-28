"use client";

import { useEffect, useRef } from 'react';

export default function Home() {
    const marqueeRef = useRef<HTMLDivElement>(null);

    return (
        <div style={{ backgroundColor: '#FBFBF2', minHeight: 'calc(100vh - 3.5rem)', overflow: 'hidden', position: 'relative' }}>

            {/* ── Rotating Circle Badge (Top Left) ─────────────── */}
            <div style={{
                position: 'absolute',
                top: '3rem',
                left: '3rem',
                width: '130px',
                height: '130px',
                zIndex: 5,
                pointerEvents: 'none',
            }}>
                <svg viewBox="0 0 130 130" width="130" height="130">
                    <defs>
                        <path id="circle-path" d="M 65,65 m -50,0 a 50,50 0 1,1 100,0 a 50,50 0 1,1 -100,0" />
                    </defs>
                    <g style={{ animation: 'spin 22s linear infinite', transformOrigin: '65px 65px' }}>
                        <text style={{ fontSize: '10.5px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.22em', fill: '#0D0D0D', textTransform: 'uppercase' }}>
                            <textPath href="#circle-path">
                                DIGITAL SAT PREP • FULL FORMAT TESTS •{' '}
                            </textPath>
                        </text>
                        {/* Center dot */}
                        <circle cx="65" cy="65" r="6" fill="#0D0D0D" />
                    </g>
                </svg>
            </div>

            {/* ── Hero Section ──────────────────────────────────── */}
            <section style={{ maxWidth: '900px', margin: '0 auto', padding: '7rem 1.5rem 5rem', textAlign: 'center' }}>

                {/* Kicker */}
                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#888880',
                    marginBottom: '1.5rem',
                }}>
                    The Gold Standard in Digital SAT Preparation
                </p>

                {/* Main Headline */}
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(3rem, 8vw, 6.5rem)',
                    fontWeight: 900,
                    lineHeight: 1.02,
                    letterSpacing: '-0.025em',
                    color: '#0D0D0D',
                    marginBottom: '2rem',
                }}>
                    Don't run out of practice.<br />
                    <span style={{ fontStyle: 'italic' }}>Just generate.</span>
                </h1>

                {/* Sub-headline */}
                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '1.1rem',
                    lineHeight: 1.75,
                    color: '#555550',
                    maxWidth: '580px',
                    margin: '0 auto 2.5rem',
                }}>
                    The AI-powered engine that synthesizes infinite, perfectly calibrated Digital SAT questions. Never take the same test twice.
                </p>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a
                        href="/test/session"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            backgroundColor: '#E6D5F8', color: '#0D0D0D',
                            border: '1px solid #0D0D0D', borderRadius: '9999px',
                            padding: '0.8rem 2rem',
                            fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', fontWeight: 600,
                            textDecoration: 'none', cursor: 'pointer',
                            transition: 'background-color 0.15s ease, transform 0.1s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#D4BFEF'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#E6D5F8'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        Start Practicing →
                    </a>
                    <a
                        href="#domains"
                        style={{
                            display: 'inline-flex', alignItems: 'center',
                            backgroundColor: 'transparent', color: '#0D0D0D',
                            border: '1px solid #0D0D0D', borderRadius: '9999px',
                            padding: '0.8rem 2rem',
                            fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', fontWeight: 500,
                            textDecoration: 'none',
                            transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(13,13,13,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        Explore Domains
                    </a>
                </div>
            </section>

            {/* ── Stats Strip ──────────────────────────────────── */}
            <section style={{
                borderTop: '1px solid #0D0D0D',
                borderBottom: '1px solid #0D0D0D',
                backgroundColor: '#FBFBF2',
                padding: '2rem 1.5rem',
            }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0', textAlign: 'center' }}>
                    {[
                        { num: '10,000+', label: 'Questions' },
                        { num: '4', label: 'Official Domains' },
                        { num: 'Adaptive', label: 'MST Algorithm' },
                        { num: 'Timed', label: 'Exam Format' },
                    ].map((s, i) => (
                        <div key={s.label} style={{
                            padding: '1.5rem 1rem',
                            borderRight: i < 3 ? '1px solid #D0D0C8' : 'none',
                        }}>
                            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 900, color: '#0D0D0D', marginBottom: '0.2rem' }}>{s.num}</p>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#888880', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Domains Section ──────────────────────────────── */}
            <section id="domains" style={{ padding: '5rem 1.5rem' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888880', marginBottom: '1rem', textAlign: 'center' }}>
                        Coverage
                    </p>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 700, textAlign: 'center', marginBottom: '3rem', letterSpacing: '-0.01em' }}>
                        Every domain. Every difficulty level.
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        {[
                            { domain: 'Heart of Algebra', module: 'Math', count: '2,500+', icon: '∑' },
                            { domain: 'Advanced Math', module: 'Math', count: '2,200+', icon: 'ƒ' },
                            { domain: 'Craft & Structure', module: 'Reading & Writing', count: '1,800+', icon: '¶' },
                            { domain: 'Expression of Ideas', module: 'Reading & Writing', count: '1,900+', icon: '✎' },
                            { domain: 'Geometry & Trig', module: 'Math', count: '1,600+', icon: '△' },
                            { domain: 'Information & Ideas', module: 'Reading & Writing', count: '2,100+', icon: '◉' },
                        ].map(d => (
                            <div key={d.domain} style={{
                                padding: '1.5rem',
                                border: '1px solid #0D0D0D',
                                borderRadius: '10px',
                                backgroundColor: '#FAFAF2',
                            }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>{d.icon}</div>
                                <span style={{
                                    display: 'inline-block',
                                    backgroundColor: d.module === 'Math' ? '#D4EFD4' : '#E6D5F8',
                                    border: '1px solid #0D0D0D',
                                    borderRadius: '9999px',
                                    padding: '0.1rem 0.55rem',
                                    fontSize: '0.6rem',
                                    fontWeight: 600,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    marginBottom: '0.6rem',
                                    fontFamily: "'Inter', sans-serif",
                                }}>
                                    {d.module}
                                </span>
                                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 700, marginTop: '0.4rem', marginBottom: '0.3rem' }}>{d.domain}</h3>
                                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#888880' }}>{d.count} questions</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Angled Bottom-Right Marquee ───────────────────── */}
            <div style={{
                position: 'fixed',
                bottom: '3rem',
                right: '-20px',
                width: '420px',
                backgroundColor: '#0D0D0D',
                color: '#FBFBF2',
                padding: '0.55rem 0',
                transform: 'rotate(-8deg)',
                transformOrigin: 'bottom right',
                overflow: 'hidden',
                zIndex: 5,
                pointerEvents: 'none',
            }}>
                <div style={{
                    display: 'flex',
                    whiteSpace: 'nowrap',
                    animation: 'marquee 18s linear infinite',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    gap: '2rem',
                }}>
                    {Array(4).fill('Heart of Algebra • Craft & Structure • Advanced Math • Expression of Ideas • ').join('')}
                </div>
            </div>

            {/* ── CSS Keyframes ─────────────────────────────────── */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes marquee {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
