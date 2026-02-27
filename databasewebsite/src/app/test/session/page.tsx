"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const DesmosCalculator = dynamic(() => import("../DesmosCalculator"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────
interface Question {
    id: string;
    question_text: string;
    options: string[] | null;
    correct_answer: string;
    rationale?: string;
    domain?: string;
    difficulty?: string;
    module?: string;
    is_placeholder?: boolean;  // true when bank is empty for this bucket
}

type Stage = 1 | 2 | 3 | 4;
type Phase = "loading" | "testing" | "between" | "complete";

const STAGE_CONFIG = {
    1: { label: "Reading & Writing — Module 1", count: 27, seconds: 32 * 60, subject: "rw" },
    2: { label: "Reading & Writing — Module 2", count: 27, seconds: 32 * 60, subject: "rw" },
    3: { label: "Math — Module 1", count: 22, seconds: 35 * 60, subject: "math" },
    4: { label: "Math — Module 2", count: 22, seconds: 35 * 60, subject: "math" },
} as const;

// ─── Placeholder generator (used when DB bucket is empty) ───
function makePlaceholder(moduleFilter: string, difficulty: string, domain: string, index: number): Question {
    return {
        id: `placeholder-${moduleFilter}-${domain}-${difficulty}-${index}`,
        question_text: `[Question Bank Building] This slot is reserved for a ${difficulty} question in the "${domain.replace(/_/g, ' ')}" domain (${moduleFilter.replace('_', ' ')}).\n\nOur automated harvester is currently generating questions for this topic. This placeholder will be replaced automatically within the next 15 minutes.`,
        options: ["Continue", "Mark for Review", "Skip", "Next Question"],
        correct_answer: "Continue",
        domain,
        difficulty,
        module: moduleFilter,
        is_placeholder: true,
    };
}

// ─── Supabase Adaptive Fetch ───────────────────────────────────
async function fetchQuestions(stage: Stage, module1Score?: number): Promise<Question[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cfg = STAGE_CONFIG[stage];
    const isMath = cfg.subject === "math";
    const moduleFilter = isMath ? "Math" : "Reading_Writing";
    const total = cfg.count;

    // Domain distribution for this module
    const mathDomains = ["Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry"];
    const rwDomains = ["Information_and_Ideas", "Craft_and_Structure", "Expression_of_Ideas", "Standard_English_Conventions"];
    const domains = isMath ? mathDomains : rwDomains;

    // Difficulty distribution
    let tiers: { difficulty: string; count: number }[];
    if (stage === 1 || stage === 3) {
        tiers = [
            { difficulty: "Easy", count: Math.round(total * 0.30) },
            { difficulty: "Medium", count: Math.round(total * 0.40) },
            { difficulty: "Hard", count: total - Math.round(total * 0.30) - Math.round(total * 0.40) },
        ];
    } else {
        const upperRouting = (module1Score ?? 0) > 65;
        if (upperRouting) {
            tiers = [
                { difficulty: "Easy", count: Math.round(total * 0.10) },
                { difficulty: "Medium", count: Math.round(total * 0.35) },
                { difficulty: "Hard", count: total - Math.round(total * 0.10) - Math.round(total * 0.35) },
            ];
        } else {
            tiers = [
                { difficulty: "Easy", count: Math.round(total * 0.45) },
                { difficulty: "Medium", count: Math.round(total * 0.40) },
                { difficulty: "Hard", count: total - Math.round(total * 0.45) - Math.round(total * 0.40) },
            ];
        }
    }

    const results: Question[] = [];
    let placeholderIdx = 0;

    for (const tier of tiers) {
        if (tier.count <= 0) continue;

        // Spread questions across domains for this difficulty tier
        const perDomain = Math.ceil(tier.count / domains.length);
        let tierRemaining = tier.count;

        for (const domain of domains) {
            if (tierRemaining <= 0) break;
            const fetchCount = Math.min(perDomain, tierRemaining);

            try {
                const url = `${supabaseUrl}/rest/v1/sat_question_bank?module=eq.${moduleFilter}&domain=eq.${domain}&difficulty=eq.${tier.difficulty}&limit=${fetchCount}&order=random()`;
                const res = await fetch(url, {
                    headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` }
                });
                if (res.ok) {
                    const rows: Question[] = await res.json();
                    if (rows.length > 0) {
                        results.push(...rows.slice(0, fetchCount));
                        tierRemaining -= rows.length;
                    } else {
                        // No questions yet — generate placeholders so test always loads
                        for (let p = 0; p < fetchCount; p++) {
                            results.push(makePlaceholder(moduleFilter, tier.difficulty, domain, placeholderIdx++));
                        }
                        tierRemaining -= fetchCount;
                    }
                } else {
                    for (let p = 0; p < fetchCount; p++) {
                        results.push(makePlaceholder(moduleFilter, tier.difficulty, domain, placeholderIdx++));
                    }
                    tierRemaining -= fetchCount;
                }
            } catch {
                for (let p = 0; p < fetchCount; p++) {
                    results.push(makePlaceholder(moduleFilter, tier.difficulty, domain, placeholderIdx++));
                }
                tierRemaining -= fetchCount;
            }
        }
    }

    // Final safety net: always return exactly `total` questions
    while (results.length < total) {
        results.push(makePlaceholder(moduleFilter, "Medium", "General", placeholderIdx++));
    }
    return results.slice(0, total);
}

// ─── Timer Display ────────────────────────────────────────────
function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// ─── Main Component ───────────────────────────────────────────
export default function TestSessionPage() {
    const [stage, setStage] = useState<Stage>(1);
    const [phase, setPhase] = useState<Phase>("loading");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [freeText, setFreeText] = useState<Record<number, string>>({});
    const [marked, setMarked] = useState<Set<number>>(new Set());
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timerSec, setTimerSec] = useState(STAGE_CONFIG[1].seconds);
    const [timerHidden, setTimerHidden] = useState(false);
    const [desmosOpen, setDesmosOpen] = useState(false);
    const [desmosPos, setDesmosPos] = useState({ x: 120, y: 80 });
    const [module1Score, setModule1Score] = useState<number>(0);
    const [totalScore, setTotalScore] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadStage = useCallback(async (s: Stage, score?: number) => {
        setPhase("loading");
        setCurrentIdx(0);
        setAnswers({});
        setFreeText({});
        setMarked(new Set());
        const qs = await fetchQuestions(s, score);
        setQuestions(qs);
        setTimerSec(STAGE_CONFIG[s].seconds);
        setPhase("testing");
    }, []);

    useEffect(() => { loadStage(1); }, []);

    // ─── Countdown Timer ─────────────────────────────────────
    useEffect(() => {
        if (phase !== "testing") { if (timerRef.current) clearInterval(timerRef.current); return; }
        timerRef.current = setInterval(() => {
            setTimerSec(t => {
                if (t <= 1) { clearInterval(timerRef.current!); handleModuleEnd(); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    // ─── Module Submit Logic ──────────────────────────────────
    const handleModuleEnd = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        // Grade current module
        let correct = 0;
        questions.forEach((q, i) => {
            const ans = q.options ? answers[i] : freeText[i];
            if (ans && ans.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()) correct++;
        });
        const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

        if (stage === 1 || stage === 3) {
            setModule1Score(pct);
            setPhase("between");
        } else if (stage === 2) {
            setTotalScore(prev => prev + correct);
            setPhase("between"); // Transition to Math
        } else {
            setTotalScore(prev => prev + correct);
            setPhase("complete");
        }
    };

    const handleNextModule = () => {
        const next = (stage + 1) as Stage;
        if (next > 4) { setPhase("complete"); return; }
        setStage(next);
        loadStage(next, module1Score);
    };

    const q = questions[currentIdx];
    const isLastQ = currentIdx === questions.length - 1;
    const isMathStage = stage === 3 || stage === 4;
    const cfg = STAGE_CONFIG[stage];

    // ─── LOADING SCREEN ──────────────────────────────────────
    if (phase === "loading") return (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", zIndex: 9999 }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem", animation: "pulse 1.5s ease-in-out infinite" }}>●</div>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Preparing your test…</p>
            <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
        </div>
    );

    // ─── BETWEEN MODULES SCREEN ──────────────────────────────
    if (phase === "between") return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "2rem" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.75rem" }}>Section Complete</p>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>{cfg.label}</h2>
            <p style={{ color: "#94a3b8", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Module {stage % 2 === 1 ? "1" : "2"} score: <strong style={{ color: "#e2e8f0" }}>{module1Score}%</strong></p>
            {stage < 4 && <p style={{ color: "#64748b", marginBottom: "2rem", fontSize: "0.85rem" }}>
                {stage === 1 ? "Next: Reading & Writing Module 2" : stage === 2 ? "Next: Math Module 1" : "Next: Math Module 2"}
                {(stage === 1 || stage === 3) && <span style={{ color: module1Score >= 65 ? "#4ade80" : "#f87171", marginLeft: "0.5rem" }}>({module1Score >= 65 ? "Upper" : "Lower"} routing)</span>}
            </p>}
            {stage < 4 ? (
                <button onClick={handleNextModule} style={{ backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", padding: "0.8rem 2rem", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}>
                    Begin Next Module →
                </button>
            ) : (
                <button onClick={() => setPhase("complete")} style={{ backgroundColor: "#4ade80", color: "#0f172a", border: "none", borderRadius: "8px", padding: "0.8rem 2rem", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}>
                    View Results →
                </button>
            )}
        </div>
    );

    // ─── COMPLETE SCREEN ─────────────────────────────────────
    if (phase === "complete") return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "2rem" }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.75rem" }}>Test Complete</p>
            <h2 style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: "2rem" }}>🎉 Well Done</h2>
            <p style={{ color: "#94a3b8", fontSize: "1rem", marginBottom: "2rem" }}>You have completed all 4 modules of this Digital SAT practice session.</p>
            <a href="/" style={{ backgroundColor: "#E6D5F8", color: "#0D0D0D", border: "none", borderRadius: "9999px", padding: "0.8rem 2rem", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
                Return Home
            </a>
        </div>
    );

    // ─── MAIN TESTING UI ─────────────────────────────────────
    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8fafc", fontFamily: "'Inter', Arial, sans-serif", overflow: "hidden" }}>

            {/* ══════════ HEADER ══════════ */}
            <header style={{
                height: "48px", backgroundColor: "#1a1a2e", color: "#e2e8f0",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 1.25rem", flexShrink: 0, zIndex: 10,
                borderBottom: "1px solid #2d3748",
            }}>
                {/* Left: Section label & Directions */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <details style={{ position: "relative" }}>
                        <summary style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.02em", color: "#e2e8f0", listStyle: "none", padding: "0.25rem 0.6rem", borderRadius: "4px", border: "1px solid #4a5568" }}>
                            Directions ▾
                        </summary>
                        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", backgroundColor: "#1a1a2e", border: "1px solid #4a5568", borderRadius: "6px", padding: "1rem", width: "300px", zIndex: 50, fontSize: "0.78rem", lineHeight: 1.65, color: "#cbd5e0" }}>
                            For each question, select the best answer from the choices provided. Some questions may have a data or passage context in the left pane. For Student-Produced Responses (SPR), type your answer in the box.
                        </div>
                    </details>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500 }}>{cfg.label}</span>
                </div>

                {/* Center: Timer */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {!timerHidden && (
                        <span style={{
                            fontFamily: "monospace", fontSize: "1.25rem", fontWeight: 700, letterSpacing: "0.05em",
                            color: timerSec < 300 ? "#f87171" : "#e2e8f0",
                            minWidth: "5rem", textAlign: "center",
                        }}>
                            {formatTime(timerSec)}
                        </span>
                    )}
                    <button onClick={() => setTimerHidden(h => !h)} style={{ fontSize: "0.68rem", color: "#94a3b8", background: "none", border: "1px solid #4a5568", borderRadius: "4px", padding: "0.15rem 0.5rem", cursor: "pointer" }}>
                        {timerHidden ? "Show" : "Hide"}
                    </button>
                </div>

                {/* Right: Tools */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {isMathStage && (
                        <button
                            onClick={() => setDesmosOpen(o => !o)}
                            title="Calculator"
                            style={{ background: desmosOpen ? "#3b82f6" : "none", border: "1px solid #4a5568", borderRadius: "6px", color: "#e2e8f0", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                        >
                            📊 <span style={{ fontSize: "0.72rem" }}>Calc</span>
                        </button>
                    )}
                    <button title="Annotate" style={{ background: "none", border: "1px solid #4a5568", borderRadius: "6px", color: "#e2e8f0", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.82rem" }}>
                        ✏️
                    </button>
                </div>
            </header>

            {/* ══════════ CANVAS (50/50) ══════════ */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Left Pane — Passage/Context */}
                <div style={{
                    width: "50%", height: "100%", overflowY: "auto",
                    borderRight: "1px solid #e2e8f0", backgroundColor: "#fff",
                    padding: "2rem 1.75rem",
                }}>
                    {q?.rationale ? (
                        <div>
                            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "1rem" }}>Context / Passage</p>
                            <p style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", lineHeight: 1.8, color: "#1e293b" }}>{q.rationale}</p>
                        </div>
                    ) : (
                        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#cbd5e0" }}>
                            <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.5 }}>📄</div>
                            <p style={{ fontSize: "0.85rem", textAlign: "center" }}>No passage for this question</p>
                        </div>
                    )}
                </div>

                {/* Right Pane — Question */}
                <div style={{
                    width: "50%", height: "100%", overflowY: "auto",
                    backgroundColor: "#fff", padding: "2rem 1.75rem",
                }}>
                    {q ? (
                        <>
                            {/* Question number badge */}
                            <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8", marginBottom: "0.75rem" }}>
                                Question {currentIdx + 1} of {questions.length}
                                {q.domain && <span style={{ marginLeft: "0.5rem", color: "#cbd5e0" }}>· {q.domain}</span>}
                                {q.difficulty && <span style={{ marginLeft: "0.5rem", color: q.difficulty === "Hard" ? "#f87171" : q.difficulty === "Easy" ? "#4ade80" : "#fbbf24" }}>· {q.difficulty}</span>}
                            </p>

                            {/* Question text */}
                            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "#1e293b", marginBottom: "1.75rem", fontFamily: "Arial, 'Inter', sans-serif" }}>
                                {q.question_text}
                            </p>

                            {/* Options, SPR, or Placeholder */}
                            {q.is_placeholder ? (
                                // ── Placeholder card (bank building) ──────────
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", textAlign: "center", padding: "1.5rem 1rem" }}>
                                    <div style={{ fontSize: "2.5rem", marginBottom: "1.25rem" }}>⏳</div>
                                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                                        <span style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "9999px", padding: "0.2rem 0.75rem", fontSize: "0.72rem", fontWeight: 700 }}>
                                            {q.module?.replace(/_/g, " ")}
                                        </span>
                                        <span style={{ backgroundColor: q.difficulty === "Hard" ? "#fef2f2" : q.difficulty === "Easy" ? "#f0fdf4" : "#fffbeb", color: q.difficulty === "Hard" ? "#dc2626" : q.difficulty === "Easy" ? "#16a34a" : "#d97706", border: `1px solid ${q.difficulty === "Hard" ? "#fecaca" : q.difficulty === "Easy" ? "#bbf7d0" : "#fde68a"}`, borderRadius: "9999px", padding: "0.2rem 0.75rem", fontSize: "0.72rem", fontWeight: 700 }}>
                                            {q.difficulty}
                                        </span>
                                        <span style={{ backgroundColor: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: "9999px", padding: "0.2rem 0.75rem", fontSize: "0.72rem", fontWeight: 600 }}>
                                            {q.domain?.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" }}>Question Bank Building…</p>
                                    <p style={{ fontSize: "0.83rem", color: "#64748b", lineHeight: 1.6, maxWidth: "320px" }}>
                                        Our engine is generating <strong>{q.difficulty}</strong> questions for <strong>{q.domain?.replace(/_/g, " ")}</strong>. Auto-fills within 15 minutes.
                                    </p>
                                    <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>Use Next → to continue.</p>
                                </div>
                            ) : q.options && q.options.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {q.options.map((opt: string, i: number) => {
                                        const letter = String.fromCharCode(65 + i);
                                        const selected = answers[currentIdx] === letter;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setAnswers(prev => ({ ...prev, [currentIdx]: letter }))}
                                                style={{
                                                    display: "flex", alignItems: "flex-start", gap: "0.75rem",
                                                    padding: "0.75rem 1rem", textAlign: "left",
                                                    border: selected ? "2px solid #3b82f6" : "1.5px solid #e2e8f0",
                                                    borderRadius: "8px",
                                                    backgroundColor: selected ? "#eff6ff" : "#fff",
                                                    cursor: "pointer", transition: "all 0.1s ease",
                                                    fontFamily: "Arial, 'Inter', sans-serif", fontSize: "0.9rem", color: "#1e293b",
                                                }}
                                            >
                                                <span style={{
                                                    flexShrink: 0, width: "1.6rem", height: "1.6rem",
                                                    borderRadius: "50%", border: selected ? "2px solid #3b82f6" : "2px solid #94a3b8",
                                                    backgroundColor: selected ? "#3b82f6" : "transparent",
                                                    color: selected ? "#fff" : "#64748b",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: "0.75rem", fontWeight: 700,
                                                }}>
                                                    {letter}
                                                </span>
                                                <span style={{ paddingTop: "0.1rem" }}>{opt}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                // Student Produced Response
                                <div>
                                    <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.5rem" }}>Student-Produced Response — Enter your answer:</p>
                                    <input
                                        type="text"
                                        value={freeText[currentIdx] ?? ""}
                                        onChange={e => setFreeText(prev => ({ ...prev, [currentIdx]: e.target.value }))}
                                        placeholder="Type answer here…"
                                        style={{ padding: "0.6rem 0.875rem", border: "1.5px solid #3b82f6", borderRadius: "8px", fontFamily: "Arial, sans-serif", fontSize: "1rem", color: "#1e293b", outline: "none", width: "200px" }}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No questions loaded.</p>
                    )}
                </div>
            </div>

            {/* ══════════ FOOTER ══════════ */}
            <footer style={{
                height: "60px", backgroundColor: "#f1f5f9",
                borderTop: "1px solid #e2e8f0",
                display: "flex", alignItems: "center", padding: "0 1.25rem", gap: "1rem",
                flexShrink: 0, zIndex: 10,
            }}>
                {/* Question Grid */}
                <div style={{ display: "flex", gap: "3px", overflowX: "auto", flex: 1, alignItems: "center" }}>
                    {questions.map((_, i) => {
                        const isAnswered = q?.options ? !!answers[i] : !!freeText[i];
                        const isMarked = marked.has(i);
                        const isCurrent = i === currentIdx;
                        return (
                            <button
                                key={i}
                                onClick={() => setCurrentIdx(i)}
                                title={`Question ${i + 1}${isMarked ? " (Marked)" : ""}`}
                                style={{
                                    width: "26px", height: "26px", flexShrink: 0,
                                    border: isCurrent ? "2px solid #1d4ed8" : "1.5px solid #cbd5e0",
                                    borderRadius: "4px",
                                    backgroundColor: isCurrent ? "#1d4ed8" : isMarked ? "#fef3c7" : isAnswered ? "#dbeafe" : "#fff",
                                    color: isCurrent ? "#fff" : "#475569",
                                    fontSize: "0.6rem", fontWeight: 700, cursor: "pointer",
                                    position: "relative",
                                }}
                            >
                                {i + 1}
                                {isMarked && <span style={{ position: "absolute", top: "-3px", right: "-3px", fontSize: "0.5rem" }}>🚩</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Mark for Review */}
                <button
                    onClick={() => setMarked(prev => {
                        const n = new Set(prev);
                        n.has(currentIdx) ? n.delete(currentIdx) : n.add(currentIdx);
                        return n;
                    })}
                    style={{
                        display: "flex", alignItems: "center", gap: "0.35rem",
                        background: "none", border: "1.5px solid #94a3b8", borderRadius: "6px",
                        padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                        color: marked.has(currentIdx) ? "#d97706" : "#475569",
                        borderColor: marked.has(currentIdx) ? "#d97706" : "#94a3b8",
                        whiteSpace: "nowrap", flexShrink: 0,
                    }}
                >
                    🚩 {marked.has(currentIdx) ? "Marked" : "Mark for Review"}
                </button>

                {/* Back / Next / Submit */}
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <button
                        onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                        disabled={currentIdx === 0}
                        style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1.5px solid #94a3b8", backgroundColor: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: currentIdx === 0 ? "default" : "pointer", opacity: currentIdx === 0 ? 0.4 : 1, color: "#475569" }}
                    >
                        ← Back
                    </button>
                    {isLastQ ? (
                        <button
                            onClick={handleModuleEnd}
                            style={{ padding: "0.4rem 1.25rem", borderRadius: "6px", border: "none", backgroundColor: "#1d4ed8", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                        >
                            Submit Module ✓
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                            style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "none", backgroundColor: "#1d4ed8", color: "#fff", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                        >
                            Next →
                        </button>
                    )}
                </div>
            </footer>

            {/* ══════════ DRAGGABLE DESMOS ══════════ */}
            {desmosOpen && isMathStage && (
                <DesmosCalculator
                    position={desmosPos}
                    onMove={setDesmosPos}
                    onClose={() => setDesmosOpen(false)}
                />
            )}
        </div>
    );
}
