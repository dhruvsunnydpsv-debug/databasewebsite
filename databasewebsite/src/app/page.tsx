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
        if (user) { router.push("/test/session"); }
        else { setShowSignInModal(true); }
    };

    return (
        <div className="min-h-screen bg-[#FAFAF5] text-[#0D0D0D] font-sans flex flex-col items-center justify-start w-full overflow-x-hidden">

            {/* ── Sign-in Gate Modal ── */}
            {showSignInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSignInModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-[#0D0D0D] rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <span className="text-white text-xl font-black">S</span>
                        </div>
                        <h2 className="font-serif text-2xl font-black text-[#0D0D0D] mb-2">Sign in to begin</h2>
                        <p className="text-sm text-gray-500 mb-7 leading-relaxed">Create a free account to take full adaptive tests, track your progress, and see your domain-level scores.</p>
                        <a href="/login" className="block w-full py-3 bg-[#1A1A1A] text-white font-bold rounded-xl hover:bg-black transition-colors text-sm mb-3">
                            Sign In or Create Account →
                        </a>
                        <button onClick={() => setShowSignInModal(false)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                            Not now
                        </button>
                    </div>
                </div>
            )}

            {/* ── Navigation ── */}
            <nav className={`w-full h-[68px] flex items-center justify-between px-6 sm:px-10 sticky top-0 z-40 transition-all duration-300 ${scrolled ? "bg-[#FAFAF5]/95 backdrop-blur-md border-b border-black/8 shadow-sm" : "bg-transparent"}`}>
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-[#0D0D0D] rounded-md flex items-center justify-center">
                        <span className="text-white text-xs font-black">S</span>
                    </div>
                    <span className="font-serif text-xl font-black tracking-tight text-[#0D0D0D]">SAT Foundation</span>
                </div>
                <div className="flex items-center gap-2">
                    <a href="#about" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">About</a>
                    <a href="#curriculum" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">Curriculum</a>
                    {user ? (
                        <>
                            <a href="/history" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">My Scores</a>
                            <button onClick={handleStartTest}
                                className="px-6 py-2 bg-[#0D0D0D] text-white rounded-full text-sm font-bold hover:bg-[#2a2a2a] transition-all">
                                Take a Test →
                            </button>
                            <button onClick={() => supabase.auth.signOut().then(() => router.refresh())} className="text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium px-2">
                                Sign out
                            </button>
                        </>
                    ) : (
                        <a href="/login" className="px-6 py-2 bg-[#0D0D0D] text-white rounded-full text-sm font-bold hover:bg-[#2a2a2a] transition-all">
                            Sign In →
                        </a>
                    )}
                </div>
            </nav>

            {/* ── Hero ── */}
            <main className="w-full max-w-5xl flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-black/10 rounded-full bg-white text-[10px] font-black tracking-[0.18em] uppercase text-gray-500 shadow-sm mb-8">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    Digital SAT Competition Platform · By SAT Foundation
                </div>

                <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-[#0D0D0D] mb-6">
                    The SAT Competition<br />
                    <span className="italic font-light text-[#3A3A35]">built for champions.</span>
                </h1>

                <p className="max-w-2xl text-lg text-gray-500 leading-relaxed font-normal mb-10">
                    SAT Foundation hosts the most rigorous adaptive SAT competition available online. Expert-crafted questions, full multistage adaptive testing, and a Bluebook-identical interface — so your score here means something on test day.
                </p>

                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={handleStartTest}
                        className="px-10 py-4 bg-[#0D0D0D] text-white font-bold text-base rounded-full hover:-translate-y-0.5 hover:shadow-xl transition-all active:translate-y-0">
                        {user ? "Enter the Competition →" : "Start Competing — Free →"}
                    </button>
                    {user && (
                        <a href="/history" className="px-10 py-4 bg-white text-black font-bold text-base rounded-full border border-black/12 hover:-translate-y-0.5 transition-all hover:shadow-md">
                            View My Scores
                        </a>
                    )}
                </div>
            </main>

            {/* ── Stats strip ── */}
            <section className="w-full border-y border-black/8 bg-white py-10 px-6">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    {[
                        { num: "4", label: "Adaptive Modules" },
                        { num: "8", label: "Official Domains" },
                        { num: "MST", label: "Adaptive Format" },
                        { num: "1:1", label: "Bluebook Format" },
                    ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center py-3">
                            <p className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight mb-1">{s.num}</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── About Dhruv / Foundation ── */}
            <section id="about" className="w-full bg-[#FAFAF5] py-24 px-6 flex flex-col items-center border-b border-black/5">
                <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">Our Story</p>
                        <h2 className="font-serif text-4xl font-black text-[#0D0D0D] leading-tight mb-6">
                            Founded by a student,<br />for students.
                        </h2>
                        <p className="text-gray-500 leading-relaxed mb-4">
                            SAT Foundation was created by <strong className="text-[#0D0D0D] font-semibold">Dhruv Shah</strong> — a student who recognised that the most effective way to prepare for the SAT is to practise under the exact same conditions as the real test.
                        </p>
                        <p className="text-gray-500 leading-relaxed mb-4">
                            Every question in our bank has been hand-reviewed and carefully crafted to reflect the style, difficulty, and content of the real Digital SAT. No shortcuts, no filler — just the material that matters.
                        </p>
                        <p className="text-gray-500 leading-relaxed">
                            Our competition format pushes you to perform under genuine pressure, so that test day feels familiar, not frightening.
                        </p>
                    </div>
                    <div className="flex flex-col gap-5">
                        {[
                            { label: "Questions reviewed by hand", value: "Every single one" },
                            { label: "Adaptive difficulty routing", value: "Real MST format" },
                            { label: "Score methodology", value: "College Board aligned" },
                            { label: "Founded", value: "2025" },
                        ].map((item, i) => (
                            <div key={i} className="bg-white border border-black/6 rounded-2xl px-6 py-4 flex justify-between items-center">
                                <span className="text-sm text-gray-500 font-medium">{item.label}</span>
                                <span className="text-sm font-black text-[#0D0D0D]">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Competition Features ── */}
            <section className="w-full bg-white py-24 px-6 flex flex-col items-center">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-14">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">The Platform</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight">Everything the real test has.<br /><span className="italic font-light text-gray-400">Nothing it doesn't.</span></h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: "⚡",
                                title: "Multistage Adaptive",
                                desc: "Your Module 1 performance routes you to the harder or easier Module 2 — exactly how College Board's real MST algorithm works."
                            },
                            {
                                icon: "🧮",
                                title: "Desmos Calculator",
                                desc: "Full graphing calculator available on Math modules. Draggable, resizable, identical to what you'll see on test day."
                            },
                            {
                                icon: "📊",
                                title: "Detailed Score Report",
                                desc: "200–800 scaled scores. Domain-by-domain accuracy. Full answer review with expert explanations after every test."
                            },
                            {
                                icon: "✏️",
                                title: "Answer Elimination",
                                desc: "Strike through choices you've ruled out. The same cross-out tool that appears in the official Bluebook app."
                            },
                            {
                                icon: "⚑",
                                title: "Flag for Review",
                                desc: "Mark questions to revisit before submitting each module — the exact workflow from the real digital test."
                            },
                            {
                                icon: "⏱️",
                                title: "Real Timed Modules",
                                desc: "32 minutes for Reading & Writing, 35 minutes for Math. Auto-submits when time expires, just like the real exam."
                            },
                        ].map((f, i) => (
                            <div key={i} className="border border-black/6 rounded-2xl p-7 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 bg-[#FAFAF5]">
                                <div className="text-2xl mb-4">{f.icon}</div>
                                <h3 className="font-semibold text-[#0D0D0D] text-base mb-2">{f.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Curriculum / Domains ── */}
            <section id="curriculum" className="w-full bg-[#FAFAF5] py-24 px-6 flex flex-col items-center border-t border-black/5">
                <div className="max-w-5xl w-full">
                    <div className="text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">The Curriculum</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight">All 8 official domains.<br /><span className="italic font-light text-gray-400">All three difficulty levels.</span></h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-3xl border border-black/5 p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-[#D4EFD4] text-green-800">Math</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {[
                                    { name: "Algebra", desc: "Linear equations, inequalities, systems" },
                                    { name: "Advanced Math", desc: "Quadratics, polynomials, non-linear functions" },
                                    { name: "Problem-solving & Data Analysis", desc: "Ratios, statistics, probability, scatterplots" },
                                    { name: "Geometry & Trigonometry", desc: "Area, volume, trig ratios, circle theorems" },
                                ].map((d, i) => (
                                    <div key={i} className="flex flex-col border-b border-black/4 pb-4 last:border-0 last:pb-0">
                                        <span className="font-semibold text-sm text-[#0D0D0D]">{d.name}</span>
                                        <span className="text-xs text-gray-400 mt-0.5">{d.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl border border-black/5 p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-[#E6D5F8] text-purple-800">Reading &amp; Writing</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {[
                                    { name: "Information & Ideas", desc: "Central ideas, inferences, evidence tables" },
                                    { name: "Craft & Structure", desc: "Words in context, text purpose, connections" },
                                    { name: "Expression of Ideas", desc: "Rhetorical synthesis, transitions, notes" },
                                    { name: "Standard English Conventions", desc: "Grammar, punctuation, sentence structure" },
                                ].map((d, i) => (
                                    <div key={i} className="flex flex-col border-b border-black/4 pb-4 last:border-0 last:pb-0">
                                        <span className="font-semibold text-sm text-[#0D0D0D]">{d.name}</span>
                                        <span className="text-xs text-gray-400 mt-0.5">{d.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="w-full py-28 px-6 bg-[#0D0D0D] flex flex-col items-center text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 mb-5">SAT Foundation · Est. 2025</p>
                <h2 className="font-serif text-4xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
                    Serious preparation<br />
                    <span className="italic font-light text-gray-400">starts here.</span>
                </h2>
                <p className="text-gray-400 text-base mb-10 max-w-md leading-relaxed">
                    Join SAT Foundation and take your first full adaptive competition test today. No cost, no catch.
                </p>
                <button onClick={handleStartTest}
                    className="px-12 py-4 bg-white text-[#0D0D0D] font-bold text-base rounded-full hover:-translate-y-0.5 hover:shadow-xl transition-all">
                    {user ? "Enter Competition →" : "Get Started Free →"}
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full py-10 px-6 bg-[#0D0D0D] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">S</span>
                    </div>
                    <span className="font-serif text-sm font-black text-white/60">SAT Foundation</span>
                </div>
                <p className="text-xs text-gray-600">© {new Date().getFullYear()} SAT Foundation. Founded by Dhruv Shah.</p>
                <p className="text-xs text-gray-600 italic">Not affiliated with or endorsed by the College Board.</p>
            </footer>
        </div>
    );
}
