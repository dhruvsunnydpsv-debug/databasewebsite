"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-[#FBFBF2] text-[#0D0D0D] font-sans flex flex-col items-center justify-start w-full overflow-x-hidden">
            {/* ── Navigation ── */}
            <nav
                className={`w-full h-[70px] flex items-center justify-between px-6 sm:px-10 sticky top-0 z-50 transition-all duration-300 ${scrolled
                        ? "bg-[#FBFBF2]/90 backdrop-blur-md border-b border-black/10 shadow-sm"
                        : "bg-transparent border-b border-transparent"
                    }`}
            >
                <div className="font-serif text-2xl font-black tracking-tighter text-[#0D0D0D]">
                    SAT Engine
                </div>
                <div className="flex items-center gap-6">
                    <a
                        href="#domains"
                        className="hidden sm:block text-sm font-medium text-gray-500 hover:text-black transition-colors"
                    >
                        Curriculum
                    </a>
                    <Link
                        href="/test/session"
                        className="px-6 py-2 bg-[#1A1A1A] text-[#FBFBF2] rounded-full text-sm font-bold hover:bg-black hover:-translate-y-0.5 transition-all shadow-md"
                    >
                        Sign In →
                    </Link>
                </div>
            </nav>

            {/* ── Hero Section ── */}
            <main className="w-full max-w-5xl flex flex-col items-center justify-center text-center px-6 pt-32 pb-24 gap-8 z-10">
                <div className="px-5 py-2 border border-black/10 rounded-full bg-white/60 backdrop-blur-sm text-xs font-bold tracking-widest uppercase text-gray-500 shadow-sm">
                    The Gold Standard in Digital SAT Preparation
                </div>

                <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight text-[#0D0D0D] w-full">
                    Stop guessing.<br />
                    <span className="italic text-[#3A3A35] font-light">Just practice.</span>
                </h1>

                <p className="max-w-2xl text-lg sm:text-xl text-gray-600 leading-relaxed font-medium px-4">
                    Access a proprietary database of 10,000+ hand-crafted Digital SAT questions. Expertly curated and perfectly calibrated to official College Board difficulty.
                </p>

                <div className="flex flex-wrap gap-4 justify-center mt-6">
                    <Link
                        href="/test/session"
                        className="px-10 py-4 bg-[#E6D5F8] text-black font-bold text-lg rounded-full border border-black shadow-[0_4px_14px_rgba(230,213,248,0.4),inset_0_-2px_0_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(230,213,248,0.6),inset_0_-2px_0_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all active:translate-y-0"
                    >
                        View Question Bank →
                    </Link>
                </div>
            </main>

            {/* ── Elite Stats Grid ── */}
            <section className="w-full border-y border-black/10 bg-white py-12 px-6 shadow-sm z-10 relative">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-0 md:divide-x divide-black/10">
                    {[
                        { num: "10k+", label: "Curated Questions" },
                        { num: "4", label: "Official Domains" },
                        { num: "MST", label: "Adaptive Engine" },
                        { num: "1:1", label: "Bluebook Interface" },
                    ].map((stat, i) => (
                        <div key={i} className="flex flex-col items-center justify-center p-4">
                            <p className="font-serif text-4xl sm:text-5xl font-black text-[#0D0D0D] tracking-tight mb-2">
                                {stat.num}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Domains Section ── */}
            <section id="domains" className="w-full bg-[#FBFBF2] py-32 px-6 flex flex-col items-center z-10 relative">
                <div className="max-w-6xl w-full flex flex-col items-center">
                    <div className="text-center mb-16">
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
                            The Curriculum
                        </p>
                        <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-black text-[#0D0D0D] tracking-tight">
                            Every domain. Every difficulty.
                        </h2>
                    </div>

                    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { domain: "Heart of Algebra", module: "Math", icon: "∑", desc: "Linear equations, inequalities, and graphing deeply analyzed.", color: "bg-[#D4EFD4]" },
                            { domain: "Advanced Math", module: "Math", icon: "ƒ", desc: "Quadratics, polynomials, and complex non-linear functions.", color: "bg-[#D4EFD4]" },
                            { domain: "Geometry & Trig", module: "Math", icon: "△", desc: "Area, volume, trigonometry, and circle theorems.", color: "bg-[#D4EFD4]" },
                            { domain: "Craft & Structure", module: "Reading & Writing", icon: "¶", desc: "Words in context, text purpose, and dual-passage synthesis.", color: "bg-[#E6D5F8]" },
                            { domain: "Expression of Ideas", module: "Reading & Writing", icon: "✎", desc: "Rhetorical synthesis and transition mechanics.", color: "bg-[#E6D5F8]" },
                            { domain: "Information & Ideas", module: "Reading & Writing", icon: "◉", desc: "Central ideas, inferences, and quantitative command of evidence.", color: "bg-[#E6D5F8]" },
                        ].map((d, i) => (
                            <div
                                key={i}
                                className="group flex flex-col p-8 bg-white border border-black/10 rounded-2xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:border-black/30 transition-all duration-300 ease-out relative overflow-hidden"
                            >
                                {/* Decorative Gradient */}
                                <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-0 group-hover:opacity-40 blur-3xl transition-opacity duration-300 ${d.color}`} />

                                <div className="flex justify-between items-start mb-8 z-10">
                                    <div className="text-4xl text-[#0D0D0D] font-light">{d.icon}</div>
                                    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border border-black/10 ${d.color} shadow-sm`}>
                                        {d.module}
                                    </span>
                                </div>

                                <h3 className="font-serif text-2xl font-bold text-[#0D0D0D] mb-3 z-10">
                                    {d.domain}
                                </h3>
                                <p className="text-gray-600 leading-relaxed font-medium z-10 text-sm">
                                    {d.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full py-16 px-6 bg-white border-t border-black/10 flex flex-col items-center justify-center text-center z-10 relative">
                <div className="font-serif text-2xl font-black tracking-tighter text-[#0D0D0D] mb-4">
                    SAT Engine
                </div>
                <p className="text-sm font-medium text-gray-500">
                    © {new Date().getFullYear()} SAT Prep Engine. Engineered for excellence.
                </p>
                <p className="text-xs text-gray-400 mt-2 italic">
                    Not affiliated with or endorsed by the College Board.
                </p>
            </footer>
        </div>
    );
}
