"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function Home() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user));
        const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
            setUser(session?.user ?? null);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    const handleStartTest = () => {
        if (user) router.push("/dashboard");
        else setShowSignInModal(true);
    };

    return (
        <div className="min-h-screen bg-[#F8F7F2] text-[#0A0A0A] font-sans flex flex-col items-center w-full overflow-x-hidden">

            {/* Sign-in Gate Modal */}
            {showSignInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSignInModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 bg-[#0A0A0A] rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <h2 className="font-serif text-2xl font-black text-[#0A0A0A] mb-2">Create a free account</h2>
                        <p className="text-sm text-gray-500 mb-7 leading-relaxed">Sign in to take adaptive tests, track your progress, and compete on the global leaderboard.</p>
                        <a href="/login" className="block w-full py-3 bg-[#0A0A0A] text-white font-bold rounded-xl hover:bg-black transition-colors text-sm mb-3">
                            Sign In or Register — Free →
                        </a>
                        <button onClick={() => setShowSignInModal(false)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                            Not now
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className={`w-full h-[64px] flex items-center justify-between px-6 sm:px-12 sticky top-0 z-40 transition-all duration-300 ${scrolled ? "bg-[#F8F7F2]/95 backdrop-blur-md border-b border-black/8 shadow-sm" : "bg-transparent"}`}>
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-black tracking-tighter">SF</span>
                    </div>
                    <span className="font-serif text-lg font-black tracking-tight">SAT Foundation</span>
                </div>
                <div className="hidden md:flex items-center gap-1 text-sm font-medium text-gray-500">
                    <a href="#how-it-works" className="px-3 py-2 rounded-lg hover:bg-black/5 hover:text-black transition-all">How it works</a>
                    <a href="#curriculum" className="px-3 py-2 rounded-lg hover:bg-black/5 hover:text-black transition-all">Curriculum</a>
                    <a href="/leaderboard" className="px-3 py-2 rounded-lg hover:bg-black/5 hover:text-black transition-all">Leaderboard</a>
                    {user && <a href="/history" className="px-3 py-2 rounded-lg hover:bg-black/5 hover:text-black transition-all">My Scores</a>}
                </div>
                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            <button onClick={handleStartTest} className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
                                Dashboard →
                            </button>
                            <button onClick={() => supabase.auth.signOut().then(() => router.refresh())} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-2 transition-colors font-medium">
                                Sign out
                            </button>
                        </>
                    ) : (
                        <>
                            <a href="/login" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">Sign in</a>
                            <a href="/login" className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
                                Register Free →
                            </a>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero */}
            <section className="w-full max-w-7xl px-6 sm:px-12 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Left */}
                <div className="flex flex-col">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-black/8 rounded-full text-[11px] font-bold uppercase tracking-widest text-gray-500 w-fit mb-8 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Digital SAT Competition Platform
                    </div>
                    <h1 className="font-serif text-5xl sm:text-6xl font-black leading-[1.07] tracking-tight text-[#0A0A0A] mb-6">
                        The SAT competition
                        <br />
                        <span className="italic font-light text-[#444]">built to win.</span>
                    </h1>
                    <p className="text-lg text-gray-500 leading-relaxed max-w-lg mb-10">
                        SAT Foundation delivers the most authentic adaptive SAT practice available. Expert-crafted questions. Full Bluebook interface. Real multistage adaptive routing. Track every domain, every attempt.
                    </p>
                    <div className="flex flex-wrap gap-3 mb-12">
                        <button onClick={handleStartTest}
                            className="px-8 py-3.5 bg-[#0A0A0A] text-white font-bold rounded-full hover:-translate-y-0.5 hover:shadow-lg transition-all text-sm">
                            {user ? "Go to Dashboard →" : "Start Competing — Free →"}
                        </button>
                        <a href="#how-it-works"
                            className="px-8 py-3.5 bg-white border border-black/10 text-[#0A0A0A] font-bold rounded-full hover:-translate-y-0.5 hover:shadow-md transition-all text-sm">
                            See How It Works
                        </a>
                    </div>
                    {/* Trust strip */}
                    <div className="flex items-center gap-6 flex-wrap">
                        {[
                            { n: "4", l: "Modules" },
                            { n: "8", l: "Domains" },
                            { n: "MST", l: "Adaptive" },
                            { n: "1:1", l: "Bluebook" },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col">
                                <span className="font-mono text-xl font-black text-[#0A0A0A]">{s.n}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.l}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — Bluebook UI Mockup */}
                <div className="relative hidden lg:block">
                    <div className="absolute -inset-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl -z-10" />
                    <div className="rounded-2xl overflow-hidden shadow-2xl border border-black/10">
                        {/* Bluebook top bar */}
                        <div className="bg-[#1e2533] px-4 py-3 flex items-center justify-between">
                            <span className="text-white/80 text-xs font-semibold">Section 1, Module 1: Reading and Writing</span>
                            <div className="flex items-center gap-3">
                                <span className="bg-white/10 text-white font-mono text-xs px-2.5 py-1 rounded-md">31:42</span>
                                <span className="text-white/40 text-xs">Q 12 of 27</span>
                            </div>
                        </div>
                        {/* Question strip */}
                        <div className="bg-[#242b35] px-4 py-2 flex items-center justify-between border-t border-white/5">
                            <div className="flex gap-1 flex-wrap max-w-[70%]">
                                {Array.from({ length: 27 }).map((_, i) => (
                                    <div key={i} className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold
                                        ${i < 11 ? "bg-[#4a9eff] text-white" : i === 11 ? "bg-white text-[#1e2533] ring-2 ring-white" : "bg-white/15 text-white/40"}`}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 text-white/50 text-[10px] font-medium">
                                <span>⚑ Flag</span>
                                <span>ABC</span>
                            </div>
                        </div>
                        {/* Split pane */}
                        <div className="flex bg-white" style={{ minHeight: 220 }}>
                            <div className="w-1/2 p-5 border-r-2 border-gray-200">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Passage</p>
                                <p className="text-[11px] text-gray-600 leading-relaxed">
                                    The researcher observed significant variation in canopy density across forest plots. In plots with dense undergrowth, photosynthesis rates declined by nearly 40%, while open-canopy plots showed markedly higher rates of carbon assimilation over the same period...
                                </p>
                            </div>
                            <div className="w-1/2 p-5 bg-[#F8F9FA]">
                                <p className="text-[11px] font-semibold text-gray-800 leading-snug mb-4">
                                    Which finding, if true, would most directly support the researcher's conclusion?
                                </p>
                                <div className="flex flex-col gap-2">
                                    {[
                                        { l: "A", t: "Dense canopies increase undergrowth competition for nutrients.", sel: false, out: true },
                                        { l: "B", t: "Open canopies correlate with higher photosynthesis rates.", sel: true, out: false },
                                        { l: "C", t: "Carbon assimilation varies by species, not by light.", sel: false, out: false },
                                        { l: "D", t: "Forest plots with high biodiversity show mixed results.", sel: false, out: false },
                                    ].map(opt => (
                                        <div key={opt.l} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-[10px] transition-all
                                            ${opt.sel ? "bg-blue-50 border-blue-400" : "border-gray-200 bg-white"}
                                            ${opt.out ? "opacity-35" : ""}`}>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-px text-[7px] font-black
                                                ${opt.sel ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-400"}`}>
                                                {opt.l}
                                            </div>
                                            <span className={`leading-tight ${opt.out ? "line-through text-gray-400" : opt.sel ? "text-blue-900" : "text-gray-600"}`}>{opt.t}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Bottom bar */}
                        <div className="bg-white border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                            <button className="text-xs text-gray-400 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">← Back</button>
                            <span className="text-[10px] text-gray-400 font-medium">Review answers before submitting</span>
                            <button className="text-xs font-bold text-white bg-[#1a73e8] px-4 py-1.5 rounded-lg">Next →</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="w-full bg-white border-y border-black/6 py-24 px-6 sm:px-12 flex flex-col items-center">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">The Process</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight">How the competition works.</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                        {[
                            {
                                step: "01",
                                title: "Take Module 1",
                                desc: "Begin with the standard difficulty module. Your score here determines which Module 2 you receive — the harder or easier adaptive path."
                            },
                            {
                                step: "02",
                                title: "Adaptive Routing",
                                desc: "SAT Foundation's MST engine routes you to the correct Module 2 in both Reading & Writing and Math — exactly as the real College Board algorithm does."
                            },
                            {
                                step: "03",
                                title: "Score & Analyse",
                                desc: "Receive a 200–800 scaled score per section, domain-by-domain accuracy breakdown, and a full answer review with expert explanations."
                            },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col items-center text-center bg-[#F8F7F2] rounded-2xl p-8 relative z-10">
                                <div className="font-mono text-xs font-black text-gray-300 mb-4 bg-white border border-black/6 rounded-full w-10 h-10 flex items-center justify-center">{s.step}</div>
                                <h3 className="font-semibold text-[#0A0A0A] text-lg mb-3">{s.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="w-full bg-[#F8F7F2] py-24 px-6 sm:px-12 flex flex-col items-center">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-14">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Platform Features</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight">Every detail. Exactly right.</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                ),
                                title: "Multistage Adaptive",
                                desc: "Module 1 performance routes you to Easy or Hard Module 2 — the real MST format used by College Board on test day.",
                                accent: "bg-blue-50 text-blue-600",
                            },
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                                ),
                                title: "Desmos Calculator",
                                desc: "Full graphing calculator embedded on Math modules. Draggable, full-featured, identical to what you use on test day.",
                                accent: "bg-green-50 text-green-600",
                            },
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                ),
                                title: "Detailed Score Report",
                                desc: "200–800 per section. Eight domain breakdowns. Full answer key with expert-written rationales for every question.",
                                accent: "bg-purple-50 text-purple-600",
                            },
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/><line x1="12" y1="15" x2="12" y2="15"/></svg>
                                ),
                                title: "Answer Elimination",
                                desc: "Strike through choices you've ruled out — the identical cross-out mechanic from the official Bluebook app.",
                                accent: "bg-orange-50 text-orange-600",
                            },
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                                ),
                                title: "Flag for Review",
                                desc: "Mark any question and return to it before submitting. Full review screen with answered/unanswered/flagged overview.",
                                accent: "bg-yellow-50 text-yellow-600",
                            },
                            {
                                icon: (
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ),
                                title: "Real Countdown Timer",
                                desc: "32 minutes R&W, 35 minutes Math. Auto-submits when time runs out — the exact pressure of test day, in practice.",
                                accent: "bg-red-50 text-red-600",
                            },
                        ].map((f, i) => (
                            <div key={i} className="bg-white border border-black/5 rounded-2xl p-7 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 ${f.accent}`}>
                                    {f.icon}
                                </div>
                                <h3 className="font-semibold text-[#0A0A0A] text-base mb-2">{f.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Score Report Preview */}
            <section className="w-full bg-white border-y border-black/6 py-24 px-6 sm:px-12 flex flex-col items-center">
                <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">After Every Test</p>
                        <h2 className="font-serif text-4xl font-black text-[#0A0A0A] tracking-tight leading-tight mb-6">
                            A score report that actually tells you something.
                        </h2>
                        <p className="text-gray-500 leading-relaxed mb-6">
                            Our report goes beyond a single number. See exactly which domains are holding you back, compare your R&W and Math trajectories over time, and review every question with a full explanation.
                        </p>
                        <ul className="flex flex-col gap-3">
                            {[
                                "200–800 scaled scores for R&W and Math",
                                "Per-domain accuracy across all 8 official domains",
                                "Full answer review with expert rationales",
                                "Score history and improvement tracking",
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {/* Score report mockup */}
                    <div className="bg-[#F8F7F2] rounded-2xl border border-black/6 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-0.5">Your Score</p>
                                <p className="font-mono text-4xl font-black text-[#0A0A0A]">1340</p>
                                <p className="text-xs text-gray-400 mt-0.5">out of 1600</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="font-mono text-2xl font-black text-blue-600">680</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">R&amp;W</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-2xl font-black text-purple-600">660</p>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Math</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Domain Breakdown</p>
                        <div className="flex flex-col gap-2">
                            {[
                                { d: "Algebra", pct: 88, c: "bg-emerald-500" },
                                { d: "Information & Ideas", pct: 75, c: "bg-blue-500" },
                                { d: "Standard English Conventions", pct: 64, c: "bg-yellow-500" },
                                { d: "Advanced Math", pct: 57, c: "bg-orange-500" },
                                { d: "Craft & Structure", pct: 50, c: "bg-red-400" },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-[11px] text-gray-600 w-40 truncate flex-shrink-0">{row.d}</span>
                                    <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${row.c}`} style={{ width: `${row.pct}%` }} />
                                    </div>
                                    <span className="font-mono text-[11px] font-bold text-gray-500 w-8 text-right">{row.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Curriculum */}
            <section id="curriculum" className="w-full bg-[#F8F7F2] py-24 px-6 sm:px-12 flex flex-col items-center">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-12">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">The Curriculum</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0A0A0A] tracking-tight">
                            All 8 official domains.<br />
                            <span className="italic font-light text-gray-400">Easy, Medium, and Hard.</span>
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Math */}
                        <div className="bg-white rounded-2xl border border-black/6 overflow-hidden">
                            <div className="bg-[#F0FBF0] border-b border-black/5 px-6 py-4 flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">Math</span>
                                <span className="text-xs text-gray-400">4 domains · 44 questions</span>
                            </div>
                            <div className="divide-y divide-black/4">
                                {[
                                    { n: "Algebra", d: "Linear equations, inequalities, systems of equations, linear functions" },
                                    { n: "Advanced Math", d: "Quadratics, polynomials, exponentials, non-linear functions" },
                                    { n: "Problem-solving & Data Analysis", d: "Ratios, proportions, statistics, probability, data interpretation" },
                                    { n: "Geometry & Trigonometry", d: "Area, volume, angles, trig ratios, the unit circle" },
                                ].map((d, i) => (
                                    <div key={i} className="px-6 py-4">
                                        <p className="font-semibold text-sm text-[#0A0A0A] mb-1">{d.n}</p>
                                        <p className="text-xs text-gray-400 leading-relaxed">{d.d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* R&W */}
                        <div className="bg-white rounded-2xl border border-black/6 overflow-hidden">
                            <div className="bg-[#F5F0FB] border-b border-black/5 px-6 py-4 flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full">Reading &amp; Writing</span>
                                <span className="text-xs text-gray-400">4 domains · 54 questions</span>
                            </div>
                            <div className="divide-y divide-black/4">
                                {[
                                    { n: "Information & Ideas", d: "Central ideas, inferences, command of evidence, data synthesis" },
                                    { n: "Craft & Structure", d: "Words in context, text structure and purpose, cross-text connections" },
                                    { n: "Expression of Ideas", d: "Rhetorical synthesis, transitions, note-based writing tasks" },
                                    { n: "Standard English Conventions", d: "Sentence boundaries, agreement, punctuation, verb tense" },
                                ].map((d, i) => (
                                    <div key={i} className="px-6 py-4">
                                        <p className="font-semibold text-sm text-[#0A0A0A] mb-1">{d.n}</p>
                                        <p className="text-xs text-gray-400 leading-relaxed">{d.d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Founder / About */}
            <section className="w-full bg-white border-y border-black/6 py-24 px-6 sm:px-12 flex flex-col items-center">
                <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-5 gap-12 items-start">
                    <div className="md:col-span-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Our Story</p>
                        <h2 className="font-serif text-4xl font-black text-[#0A0A0A] leading-tight mb-6">
                            Founded by a student who wanted better.
                        </h2>
                        <p className="text-gray-500 leading-relaxed mb-4 text-base">
                            SAT Foundation was built by <strong className="text-[#0A0A0A] font-semibold">Dhruv Shah</strong> — a student who couldn't find a practice platform that truly replicated what test day feels like. Every existing tool was either too generic, too expensive, or didn't adapt the way the real SAT does.
                        </p>
                        <p className="text-gray-500 leading-relaxed mb-4 text-base">
                            So he built one. Every question in the bank is hand-reviewed for accuracy and difficulty alignment. The interface mirrors Bluebook in every detail. The scoring methodology follows College Board's published framework.
                        </p>
                        <p className="text-gray-500 leading-relaxed text-base">
                            SAT Foundation is not a shortcut. It's the closest thing to test day you can get without sitting in the room.
                        </p>
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-3">
                        {[
                            { label: "Questions hand-reviewed", value: "Every one" },
                            { label: "Adaptive routing method", value: "Real MST" },
                            { label: "Score methodology", value: "CB-aligned" },
                            { label: "Cost", value: "Free" },
                            { label: "Founded", value: "2025" },
                        ].map((row, i) => (
                            <div key={i} className="flex justify-between items-center bg-[#F8F7F2] border border-black/5 rounded-xl px-5 py-3.5">
                                <span className="text-sm text-gray-500">{row.label}</span>
                                <span className="text-sm font-black text-[#0A0A0A] font-mono">{row.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="w-full py-28 px-6 bg-[#0A0A0A] flex flex-col items-center text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 mb-6">SAT Foundation · Est. 2025 · By Dhruv Shah</p>
                <h2 className="font-serif text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
                    Test day comes once.<br />
                    <span className="italic font-light text-white/40">Practise like it matters.</span>
                </h2>
                <p className="text-white/40 text-base max-w-md mb-10 leading-relaxed">
                    Free to join. No time limit. Start your first full adaptive test in minutes.
                </p>
                <button onClick={handleStartTest}
                    className="px-12 py-4 bg-white text-[#0A0A0A] font-bold text-base rounded-full hover:-translate-y-0.5 hover:shadow-xl transition-all">
                    {user ? "Go to Dashboard →" : "Get Started Free →"}
                </button>
            </section>

            {/* Footer */}
            <footer className="w-full bg-[#0A0A0A] border-t border-white/5 px-6 sm:px-12 py-10">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center">
                            <span className="text-white text-[9px] font-black">SF</span>
                        </div>
                        <span className="font-serif text-sm font-black text-white/50">SAT Foundation</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-white/25 font-medium">
                        <a href="/leaderboard" className="hover:text-white/60 transition-colors">Leaderboard</a>
                        <a href="/history" className="hover:text-white/60 transition-colors">My Scores</a>
                        <a href="/login" className="hover:text-white/60 transition-colors">Sign In</a>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-white/20">© {new Date().getFullYear()} SAT Foundation. Founded by Dhruv Shah.</p>
                        <p className="text-xs text-white/15 italic">Not affiliated with or endorsed by the College Board.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
