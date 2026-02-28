"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function Home() {
    const marqueeRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div style={{ backgroundColor: '#FBFBF2', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>

            {/* ── Glassmorphic Navigation ────────────────────────── */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0,
                height: '70px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 2.5rem',
                backgroundColor: scrolled ? 'rgba(251, 251, 242, 0.85)' : 'transparent',
                backdropFilter: scrolled ? 'blur(12px)' : 'none',
                borderBottom: scrolled ? '1px solid rgba(13, 13, 13, 0.08)' : '1px solid transparent',
                zIndex: 100,
                transition: 'all 0.3s ease',
            }}>
                <div style={{
                    fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 900,
                    letterSpacing: '-0.02em', color: '#0D0D0D'
                }}>
                    Verix
                </div>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <a href="#domains" style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 500, color: '#555A', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#0D0D0D'} onMouseLeave={e => e.currentTarget.style.color = '#555A'}>Curriculum</a>
                    <a href="#architecture" style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 500, color: '#555A', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#0D0D0D'} onMouseLeave={e => e.currentTarget.style.color = '#555A'}>Methodology</a>
                    <Link href="/test/session" style={{
                        padding: '0.55rem 1.4rem',
                        backgroundColor: '#1A1A1A', color: '#FBFBF2',
                        borderRadius: '9999px',
                        fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                        textDecoration: 'none', transition: 'transform 0.15s, background-color 0.15s'
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.backgroundColor = '#000'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = '#1A1A1A'; }}
                    >
                        Sign In →
                    </Link>
                </div>
            </nav>

            {/* ── Rotating Circle Badge (Top Left) ─────────────── */}
            <div style={{
                position: 'absolute',
                top: '6rem',
                left: '2.5rem',
                width: '130px',
                height: '130px',
                zIndex: 5,
                pointerEvents: 'none',
                opacity: 0.8
            }}>
                <svg viewBox="0 0 130 130" width="130" height="130">
                    <defs>
                        <path id="circle-path" d="M 65,65 m -50,0 a 50,50 0 1,1 100,0 a 50,50 0 1,1 -100,0" />
                    </defs>
                    <g style={{ animation: 'spin 22s linear infinite', transformOrigin: '65px 65px' }}>
                        <text style={{ fontSize: '10.5px', fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.22em', fill: '#0D0D0D', textTransform: 'uppercase' }}>
                            <textPath href="#circle-path">
                                ELITE DIGITAL SAT PREP • FULL FORMAT TESTS •{' '}
                            </textPath>
                        </text>
                        {/* Center dot */}
                        <circle cx="65" cy="65" r="5" fill="#0D0D0D" />
                    </g>
                </svg>
            </div>

            {/* ── Background Soft Glows ────────────────────────── */}
            <div style={{
                position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
                width: '80vw', height: '60vh',
                background: 'radial-gradient(ellipse at top, rgba(230,213,248,0.4) 0%, rgba(251,251,242,0) 70%)',
                pointerEvents: 'none', zIndex: 0
            }} />

            {/* ── Hero Section ──────────────────────────────────── */}
            <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '12rem 1.5rem 6rem', textAlign: 'center', position: 'relative', zIndex: 10 }}>

                {/* Kicker */}
                <div style={{
                    display: 'inline-block',
                    padding: '0.4rem 1rem',
                    border: '1px solid rgba(13,13,13,0.1)',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    fontFamily: "'Inter', sans-serif", fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555',
                    marginBottom: '2rem',
                    backdropFilter: 'blur(4px)'
                }}>
                    The Gold Standard in Digital SAT Preparation
                </div>

                {/* Main Headline */}
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(3.5rem, 8vw, 7rem)',
                    fontWeight: 900,
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                    color: '#0D0D0D',
                    marginBottom: '2.5rem',
                }}>
                    Stop guessing.<br />
                    <span style={{ fontStyle: 'italic', color: '#3A3A35' }}>Just practice.</span>
                </h1>

                {/* Sub-headline */}
                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '1.25rem',
                    lineHeight: 1.6,
                    color: '#555550',
                    maxWidth: '650px',
                    margin: '0 auto 3.5rem',
                    fontWeight: 400
                }}>
                    Access a proprietary database of 10,000+ hand-crafted Digital SAT questions. Expertly curated and perfectly calibrated to official College Board difficulty.
                </p>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                        href="/test/session"
                        style={{
                            display: 'inline-flex', alignItems: 'center',
                            backgroundColor: '#E6D5F8', color: '#0D0D0D',
                            border: '1px solid #0D0D0D', borderRadius: '9999px',
                            padding: '1rem 2.5rem',
                            fontFamily: "'Inter', sans-serif", fontSize: '1rem', fontWeight: 600,
                            textDecoration: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(230,213,248,0.4), inset 0 -2px 0 rgba(0,0,0,0.1)',
                            transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(230,213,248,0.6), inset 0 -2px 0 rgba(0,0,0,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(230,213,248,0.4), inset 0 -2px 0 rgba(0,0,0,0.1)'; }}
                    >
                        View Question Bank →
                    </Link>
                </div>
            </section>

            {/* ── Elite Stats Strip ──────────────────────────────────── */}
            <section style={{
                borderTop: '1px solid rgba(13,13,13,0.1)',
                borderBottom: '1px solid rgba(13,13,13,0.1)',
                backgroundColor: '#ffffff',
                padding: '3rem 1.5rem',
                position: 'relative', zIndex: 10
            }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'center' }}>
                    {[
                        { num: '10,000+', label: 'Curated Questions' },
                        { num: '4', label: 'Official Domains' },
                        { num: 'MST', label: 'Adaptive Algorithm' },
                        { num: '1:1', label: 'Bluebook Interface' },
                    ].map((s, i) => (
                        <div key={s.label} style={{
                            padding: '1rem',
                            position: 'relative'
                        }}>
                            {i !== 0 && <div style={{ position: 'absolute', left: '-1rem', top: '20%', bottom: '20%', width: '1px', backgroundColor: 'rgba(13,13,13,0.1)' }} className="hidden sm:block" />}
                            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 900, color: '#0D0D0D', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>{s.num}</p>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Interactive Bento Domains ──────────────────────────────── */}
            <section id="domains" style={{ padding: '8rem 1.5rem', backgroundColor: '#FBFBF2' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#A0A096', marginBottom: '1.5rem' }}>
                            The Curriculum
                        </p>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0D0D0D' }}>
                            Every domain. Every difficulty.
                        </h2>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {[
                            { domain: 'Heart of Algebra', module: 'Math', count: '2,500', icon: '∑', desc: 'Linear equations, inequalities, and graphing deeply analyzed.', color: '#D4EFD4' },
                            { domain: 'Advanced Math', module: 'Math', count: '2,200', icon: 'ƒ', desc: 'Quadratics, polynomials, and complex non-linear functions.', color: '#D4EFD4' },
                            { domain: 'Craft & Structure', module: 'Reading & Writing', count: '1,800', icon: '¶', desc: 'Words in context, text purpose, and dual-passage synthesis.', color: '#E6D5F8' },
                            { domain: 'Expression of Ideas', module: 'Reading & Writing', count: '1,900', icon: '✎', desc: 'Rhetorical synthesis and transition mechanics.', color: '#E6D5F8' },
                            { domain: 'Geometry & Trig', module: 'Math', count: '1,600', icon: '△', desc: 'Area, volume, trigonometry, and circle theorems.', color: '#D4EFD4' },
                            { domain: 'Information & Ideas', module: 'Reading & Writing', count: '2,100', icon: '◉', desc: 'Central ideas, inferences, and quantitative command of evidence.', color: '#E6D5F8' },
                        ].map(d => (
                            <div
                                key={d.domain}
                                style={{
                                    padding: '2.5rem 2rem',
                                    border: '1px solid rgba(13,13,13,0.1)',
                                    borderRadius: '16px',
                                    backgroundColor: '#FFFFFF',
                                    transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-8px)';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(13,13,13,0.3)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.02)';
                                    e.currentTarget.style.borderColor = 'rgba(13,13,13,0.1)';
                                }}
                            >
                                {/* Decorative Hover Gradient */}
                                <div style={{
                                    position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
                                    background: `radial-gradient(circle at top right, ${d.color}, transparent)`,
                                    opacity: 0.3, borderRadius: '50%', transform: 'translate(40%, -40%)',
                                    pointerEvents: 'none'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                    <div style={{ fontSize: '2rem', color: '#0D0D0D' }}>{d.icon}</div>
                                    <span style={{
                                        backgroundColor: d.color,
                                        border: '1px solid rgba(13,13,13,0.1)',
                                        borderRadius: '9999px',
                                        padding: '0.3rem 0.8rem',
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        fontFamily: "'Inter', sans-serif",
                                    }}>
                                        {d.module}
                                    </span>
                                </div>
                                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem', color: '#0D0D0D' }}>{d.domain}</h3>
                                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', color: '#666', lineHeight: 1.5, marginBottom: '1.5rem' }}>{d.desc}</p>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    borderTop: '1px solid rgba(13,13,13,0.08)', paddingTop: '1.25rem'
                                }}>
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#0D0D0D' }}>{d.count}+</span>
                                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#888' }}>curated variants</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Angled Bottom-Right Marquee ───────────────────── */}
            <div style={{
                position: 'fixed',
                bottom: '4rem',
                right: '-40px',
                width: '550px',
                backgroundColor: '#0D0D0D',
                color: '#FBFBF2',
                padding: '0.8rem 0',
                transform: 'rotate(-6deg)',
                transformOrigin: 'bottom right',
                overflow: 'hidden',
                zIndex: 50,
                pointerEvents: 'none',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                borderTop: '1px solid rgba(255,255,255,0.2)',
                borderBottom: '1px solid rgba(255,255,255,0.2)'
            }}>
                <div style={{
                    display: 'flex',
                    whiteSpace: 'nowrap',
                    animation: 'marquee 25s linear infinite',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    gap: '2.5rem',
                }}>
                    {Array(5).fill('Heart of Algebra • Craft & Structure • Advanced Math • Expression of Ideas • ').join('')}
                </div>
            </div>

            {/* ── Footer ──────────────────────────────────── */}
            <footer style={{ padding: '4rem 2.5rem', borderTop: '1px solid rgba(13,13,13,0.1)', backgroundColor: '#FFFFFF', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', color: '#888' }}>
                    © {new Date().getFullYear()} Verix. Engineered by Dhruv Shah. Not affiliated with the College Board.
                </p>
            </footer>

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
                html { scroll-behavior: smooth; }
            `}</style>
        </div>
    );
}
