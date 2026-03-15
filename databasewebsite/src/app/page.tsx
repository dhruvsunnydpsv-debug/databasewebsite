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
        <div className="min-h-screen bg-[#FBFBF2] text-[#0D0D0D] font-sans flex flex-col items-center justify-start w-full overflow-x-hidden">

            {/* ── Sign-in Gate Modal ── */}
            {showSignInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSignInModal(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-[#E6D5F8] rounded-full flex items-center justify-center mx-auto mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B21A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <h2 className="font-serif text-2xl font-black text-[#0D0D0D] mb-2">Sign in to practice</h2>
                        <p className="text-sm text-gray-500 mb-7 leading-relaxed">Create a free account to take adaptive tests, track your score history, and see detailed breakdowns.</p>
                        <a href="/login" className="block w-full py-3 bg-[#1A1A1A] text-white font-bold rounded-xl hover:bg-black transition-colors text-sm mb-3">
                            Sign In or Create Account
                        </a>
                        <button onClick={() => setShowSignInModal(false)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                            Maybe later
                        </button>
                    </div>
                </div>
            )}

            {/* ── Navigation ── */}
            <nav className={`w-full h-[70px] flex items-center justify-between px-6 sm:px-10 sticky top-0 z-40 transition-all duration-300 ${scrolled ? "bg-[#FBFBF2]/90 backdrop-blur-md border-b border-black/5 shadow-sm" : "bg-transparent border-b border-transparent"}`}>
                <div className="font-serif text-2xl font-black tracking-tighter text-[#0D0D0D]">SAT Engine</div>
                <div className="flex items-center gap-3">
                    <a href="#domains" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors rounded-full px-4 py-2 hover:bg-black/5">
                        Curriculum
                    </a>
                    {user ? (
                        <>
                            <a href="/history" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors rounded-full px-4 py-2 hover:bg-black/5">
                                My Scores
                            </a>
                            <button onClick={handleStartTest}
                                className="px-7 py-2.5 bg-[#1A1A1A] text-[#FBFBF2] rounded-full text-sm font-bold hover:bg-black hover:-translate-y-0.5 transition-all shadow-lg active:scale-95">
                                Start Test →
                            </button>
                            <button onClick={() => supabase.auth.signOut().then(() => router.refresh())} className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium px-2">
                                Sign out
                            </button>
                        </>
                    ) : (
                        <a href="/login" className="px-7 py-2.5 bg-[#1A1A1A] text-[#FBFBF2] rounded-full text-sm font-bold hover:bg-black hover:-translate-y-0.5 transition-all shadow-lg active:scale-95">
                            Sign In →
                        </a>
                    )}
                </div>
            </nav>

            {/* ── Hero ── */}
            <main className="w-full max-w-5xl flex flex-col items-center justify-center text-center px-6 pt-28 pb-20 gap-8">
                <div className="px-5 py-2 border border-black/8 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-black tracking-[0.2em] uppercase text-gray-400 shadow-sm">
                    Adaptive Digital SAT · Bluebook Interface · Real Questions
                </div>
                <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-[#0D0D0D]">
                    Train on real SAT.<br />
                    <span className="italic text-[#3A3A35] font-light">Score higher.</span>
                </h1>
                <p className="max-w-xl text-lg text-gray-500 leading-relaxed font-medium">
                    Adaptive tests modeled exactly on Bluebook. Real questions, entity-decopywritten for originality. Detailed score reports. Track every domain.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={handleStartTest}
                        className="px-10 py-4 bg-[#E6D5F8] text-black font-bold text-lg rounded-full border border-black shadow-[0_4px_14px_rgba(230,213,248,0.4),inset_0_-2px_0_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(230,213,248,0.6)] hover:-translate-y-1 transition-all active:translate-y-0">
                        {user ? "Start Practice Test →" : "Get Started — Free →"}
                    </button>
                    {user && (
                        <a href="/history" className="px-10 py-4 bg-white text-black font-bold text-lg rounded-full border border-black/15 hover:-translate-y-1 transition-all hover:shadow-lg">
                            View My Scores
                        </a>
                    )}
                </div>
            </main>

            {/* ── Stats strip ── */}
            <section className="w-full border-y border-black/8 bg-white py-10 px-6 shadow-sm">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x-0 md:divide-x divide-black/8">
                    {[
                        { num: "4", label: "Adaptive Modules" },
                        { num: "8", label: "Official Domains" },
                        { num: "MST", label: "Adaptive Engine" },
                        { num: "1:1", label: "Bluebook Layout" },
                    ].map((s, i) => (
                        <div key={i} className="flex flex-col items-center p-3">
                            <p className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight mb-1">{s.num}</p>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Feature highlights ── */}
            <section className="w-full bg-[#FBFBF2] py-20 px-6 flex flex-col items-center">
                <div className="max-w-5xl w-full">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-3 text-center">How It Works</p>
                    <h2 className="font-serif text-4xl sm:text-5xl font-black text-center text-[#0D0D0D] tracking-tight mb-14">Built exactly like Bluebook.</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: "⚡", title: "Multistage Adaptive", desc: "Module 1 sets difficulty. Score determines whether Module 2 is the harder or easier version — exactly like the real test." },
                            { icon: "🧮", title: "Desmos Calculator", desc: "Built-in graphing calculator available on all Math modules. Draggable, full-featured, identical to test day." },
                            { icon: "📊", title: "Score Report", desc: "200–800 scaled scores per section. Domain-by-domain accuracy breakdown. Full answer key with explanations." },
                            { icon: "✏️", title: "Answer Elimination", desc: "Cross out answer choices you've ruled out, just like the real Bluebook interface." },
                            { icon: "⚑", title: "Flag for Review", desc: "Flag any question and return to it before submitting — exactly like the real digital SAT." },
                            { icon: "🔒", title: "Real Questions", desc: "All questions sourced from real SAT practice material, then entity-swapped to ensure originality." },
                        ].map((f, i) => (
                            <div key={i} className="bg-white border border-black/5 rounded-[2rem] p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                                <div className="text-3xl mb-4">{f.icon}</div>
                                <h3 className="font-serif text-xl font-black text-[#0D0D0D] mb-2">{f.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Domains ── */}
            <section id="domains" className="w-full bg-[#FBFBF2] py-20 px-6 flex flex-col items-center border-t border-black/5">
                <div className="max-w-6xl w-full">
                    <div className="text-center mb-12">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-3">The Curriculum</p>
                        <h2 className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight">Every domain. Every difficulty.</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { domain: "Algebra", module: "Math", icon: "∑", desc: "Linear equations, inequalities, systems, graphs.", color: "bg-[#D4EFD4]" },
                            { domain: "Advanced Math", module: "Math", icon: "ƒ", desc: "Quadratics, polynomials, non-linear functions.", color: "bg-[#D4EFD4]" },
                            { domain: "Problem-solving & Data", module: "Math", icon: "◈", desc: "Ratios, statistics, scatterplots, probability.", color: "bg-[#D4EFD4]" },
                            { domain: "Geometry & Trig", module: "Math", icon: "△", desc: "Area, volume, trig ratios, circle theorems.", color: "bg-[#D4EFD4]" },
                            { domain: "Craft & Structure", module: "R&W", icon: "¶", desc: "Words in context, text purpose, dual passages.", color: "bg-[#E6D5F8]" },
                            { domain: "Expression of Ideas", module: "R&W", icon: "✎", desc: "Rhetorical synthesis and transitions.", color: "bg-[#E6D5F8]" },
                            { domain: "Information & Ideas", module: "R&W", icon: "◉", desc: "Central ideas, inferences, evidence tables.", color: "bg-[#E6D5F8]" },
                            { domain: "Standard English", module: "R&W", icon: "Aa", desc: "Grammar, punctuation, sentence structure.", color: "bg-[#E6D5F8]" },
                        ].map((d, i) => (
                            <div key={i} className="flex flex-col p-7 bg-white border border-black/5 rounded-[2.5rem] hover:-translate-y-1 hover:shadow-lg transition-all duration-400 relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-7">
                                    <div className="text-3xl font-light text-[#0D0D0D]">{d.icon}</div>
                                    <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border border-black/5 ${d.color}`}>{d.module}</span>
                                </div>
                                <h3 className="font-serif text-lg font-black text-[#0D0D0D] mb-2">{d.domain}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{d.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="w-full py-24 px-6 bg-[#0D0D0D] flex flex-col items-center text-center">
                <h2 className="font-serif text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">Ready to practice?</h2>
                <p className="text-gray-400 text-lg mb-10 max-w-md">Create a free account and take your first adaptive test in under 2 hours.</p>
                <button onClick={handleStartTest}
                    className="px-12 py-4 bg-[#E6D5F8] text-black font-bold text-lg rounded-full hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(230,213,248,0.3)] transition-all">
                    {user ? "Start Test →" : "Get Started Free →"}
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full py-12 px-6 bg-white border-t border-black/8 flex flex-col items-center text-center">
                <div className="font-serif text-xl font-black tracking-tighter text-[#0D0D0D] mb-3">SAT Engine</div>
                <p className="text-sm font-medium text-gray-400">© {new Date().getFullYear()} SAT Engine. Built for serious test prep.</p>
                <p className="text-xs text-gray-300 mt-1 italic">Not affiliated with or endorsed by the College Board.</p>
            </footer>
        </div>
    );
}
