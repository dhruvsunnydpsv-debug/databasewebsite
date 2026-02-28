"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const DesmosCalculator = dynamic(() => import("../DesmosCalculator"), { ssr: false });
import { calculateModuleWeightedScore, calculateSectionScaledScore } from "@/lib/scoring-logic";

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
    1: { label: "Reading & Writing — Module 1", count: 24, seconds: 32 * 60, subject: "rw" },
    2: { label: "Reading & Writing — Module 2", count: 24, seconds: 32 * 60, subject: "rw" },
    3: { label: "Math — Module 1", count: 24, seconds: 35 * 60, subject: "math" },
    4: { label: "Math — Module 2", count: 24, seconds: 35 * 60, subject: "math" },
} as const;

// ─── Placeholder generator (used when DB bucket is empty) ───
function makePlaceholder(moduleFilter: string, difficulty: string, domain: string, index: number): Question {
    return {
        id: `placeholder-${moduleFilter}-${domain}-${difficulty}-${index}`,
        question_text: "",
        options: null,
        correct_answer: "",
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
        // Module 1: 30% Easy, 40% Medium, 30% Hard
        tiers = [
            { difficulty: "Easy", count: Math.floor(total * 0.30) },
            { difficulty: "Medium", count: Math.floor(total * 0.40) },
            { difficulty: "Hard", count: total - Math.floor(total * 0.30) - Math.floor(total * 0.40) },
        ];
    } else {
        // Module 2 Routing: Accuracy check (15.4/22 rounded is 16)
        const isHigherPath = (module1Score ?? 0) >= 16;
        if (isHigherPath) {
            // Higher: 15% Easy, 35% Medium, 50% Hard
            tiers = [
                { difficulty: "Easy", count: Math.floor(total * 0.15) },
                { difficulty: "Medium", count: Math.floor(total * 0.35) },
                { difficulty: "Hard", count: total - Math.floor(total * 0.15) - Math.floor(total * 0.35) },
            ];
        } else {
            // Lower: 45% Easy, 40% Medium, 15% Hard
            tiers = [
                { difficulty: "Easy", count: Math.floor(total * 0.45) },
                { difficulty: "Medium", count: Math.floor(total * 0.40) },
                { difficulty: "Hard", count: total - Math.floor(total * 0.45) - Math.floor(total * 0.40) },
            ];
        }
    }

    const results: Question[] = [];
    let placeholderIdx = 0;

    for (const tier of tiers) {
        if (tier.count <= 0) continue;

        const perDomain = Math.ceil(tier.count / domains.length);
        let tierRemaining = tier.count;

        // Collect fetch promises for this tier to run in parallel
        const tierPromises: Promise<Question[]>[] = [];

        for (const domain of domains) {
            if (tierRemaining <= 0) break;
            const fetchCount = Math.min(perDomain, tierRemaining);
            tierRemaining -= fetchCount;

            tierPromises.push((async () => {
                const fetched: Question[] = [];
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s strict timeout
                    const url = `${supabaseUrl}/rest/v1/sat_question_bank?module=eq.${moduleFilter}&domain=eq.${domain}&difficulty=eq.${tier.difficulty}&limit=${fetchCount}&order=random()`;
                    const res = await fetch(url, {
                        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        const rows: Question[] = await res.json();
                        fetched.push(...rows.slice(0, fetchCount));
                    }
                } catch {
                    // Ignore error, will fill with placeholders
                }

                // Fill any missing spots with placeholders
                while (fetched.length < fetchCount) {
                    fetched.push(makePlaceholder(moduleFilter, tier.difficulty, domain, placeholderIdx++));
                }
                return fetched;
            })());
        }

        // Wait for all domain fetches in this tier to complete
        const tierResults = await Promise.all(tierPromises);
        for (const tr of tierResults) {
            results.push(...tr);
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
    
    // Scoring engine
    const [moduleCorrectCounts, setModuleCorrectCounts] = useState<Record<number, number>>({});
    const [moduleWeightedScores, setModuleWeightedScores] = useState<Record<number, number>>({});
    
    const [finalRWScore, setFinalRWScore] = useState(0); 
    const [finalMathScore, setFinalMathScore] = useState(0);
    const [finalOverallScore, setFinalOverallScore] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadStage = useCallback(async (s: Stage, routingVal?: number) => {
        setPhase("loading");
        setCurrentIdx(0);
        setAnswers({});
        setFreeText({});
        setMarked(new Set());
        try {
            const qs = await fetchQuestions(s, routingVal);
            setQuestions(qs);
        } catch {
            // Absolute worst-case: fill with placeholders so it never stays stuck
            const cfg = STAGE_CONFIG[s];
            const isMath = cfg.subject === "math";
            const mod = isMath ? "Math" : "Reading_Writing";
            const fallback: Question[] = Array.from({ length: cfg.count }, (_, i) =>
                makePlaceholder(mod, "Medium", "General", i)
            );
            setQuestions(fallback);
        } finally {
            setTimerSec(STAGE_CONFIG[s].seconds);
            setPhase("testing");  // ALWAYS advance — never stuck on loading
        }
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
        
        // 1. Grade scored questions (indices 0-21)
        let correctRaw = 0;
        for (let i = 0; i < 22; i++) {
          const q = questions[i];
          const ans = q.options ? answers[i] : freeText[i];
          if (ans && ans.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()) {
            correctRaw++;
          }
        }
        
        const weighted = calculateModuleWeightedScore(questions, answers, freeText);
        
        setModuleCorrectCounts(prev => ({ ...prev, [stage]: correctRaw }));
        setModuleWeightedScores(prev => ({ ...prev, [stage]: weighted }));

        if (stage === 1 || stage === 3) {
            setPhase("between");
        } else if (stage === 2) {
            const isHigher = (moduleCorrectCounts[1] || 0) >= 15.4; 
            const scaled = calculateSectionScaledScore(moduleWeightedScores[1] || 0, weighted, isHigher);
            setFinalRWScore(scaled);
            setPhase("between");
        } else {
            const isHigher = (moduleCorrectCounts[3] || 0) >= 15.4;
            const scaled = calculateSectionScaledScore(moduleWeightedScores[3] || 0, weighted, isHigher);
            const math = scaled;
            setFinalMathScore(math);
            setFinalOverallScore(finalRWScore + math);
            setPhase("complete");
        }
    };

    const handleNextModule = () => {
        const next = (stage + 1) as Stage;
        if (next > 4) { setPhase("complete"); return; }
        setStage(next);
        loadStage(next, moduleCorrectCounts[stage]);
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
            <p style={{ color: "#94a3b8", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Correct Scored Questions: <strong style={{ color: "#e2e8f0" }}>{moduleCorrectCounts[stage] || 0} / 22</strong></p>
            {stage < 4 && <p style={{ color: "#64748b", marginBottom: "2rem", fontSize: "0.85rem" }}>
                {stage === 1 ? "Next: RW Module 2" : stage === 2 ? "Next: Math Module 1" : "Next: Math Module 2"}
                {(stage === 1 || stage === 3) && <span style={{ color: (moduleCorrectCounts[stage] || 0) >= 15.4 ? "#4ade80" : "#f87171", marginLeft: "0.5rem" }}>({(moduleCorrectCounts[stage] || 0) >= 15.4 ? "High" : "Low"} Difficulty Routing)</span>}
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
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.75rem" }}>Test Comprehensive Result</p>
            <h2 style={{ fontSize: "4.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>{finalOverallScore || (finalRWScore + finalMathScore)}</h2>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "2rem" }}>TOTAL PRACTICE SCORE (400–1600)</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2.5rem", width: "100%", maxWidth: "480px" }}>
                <div style={{ padding: "1.25rem", backgroundColor: "#1e293b", borderRadius: "10px", border: "1px solid #334155" }}>
                    <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>{finalRWScore}</p>
                    <p style={{ fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase" }}>Reading & Writing</p>
                </div>
                <div style={{ padding: "1.25rem", backgroundColor: "#1e293b", borderRadius: "10px", border: "1px solid #334155" }}>
                    <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>{finalMathScore}</p>
                    <p style={{ fontSize: "0.65rem", color: "#94a3b8", textTransform: "uppercase" }}>Mathematics</p>
                </div>
            </div>

            <div style={{ maxWidth: "600px", backgroundColor: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "6px", border: "1px dashed #334155", marginBottom: "2rem" }}>
                <p style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.5, textAlign: "left" }}>
                  <strong>Note:</strong> Difficulty mix affects points (Easy: 1.0, Medium: 1.5, Hard: 2.0). 
                  Scaling adjusts based on the adaptive path taken (Higher vs Lower). 
                  This implementation follows a research-based multistage adaptive model and does not claim to match the College Board's proprietary algorithm.
                </p>
            </div>

            <a href="/" style={{ backgroundColor: "#E6D5F8", color: "#0D0D0D", border: "none", borderRadius: "9999px", padding: "0.8rem 2.5rem", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
                Return to Home
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
                                {currentIdx + 1}
                            </p>

                            {/* Question text (hidden if placeholder) */}
                            {!q.is_placeholder && (
                                <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "#1e293b", marginBottom: "1.75rem", fontFamily: "Arial, 'Inter', sans-serif" }}>
                                    {q.question_text}
                                </p>
                            )}

                            {/* Options, SPR, or Placeholder */}
                            {q.is_placeholder ? (
                                // ── Clinical Error State (Missing Data) ──────────
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "250px", textAlign: "center", padding: "1.5rem 1rem", fontFamily: "'Inter', Arial, sans-serif" }}>
                                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#334155", marginBottom: "0.75rem" }}>
                                        Error: Insufficient Question Bank Data.
                                    </p>
                                    <p style={{ fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6 }}>
                                        Attempted to fetch:<br />
                                        <span style={{ fontWeight: 600, color: "#475569" }}>
                                            {q.module?.replace(/_/g, " ")} • {q.domain?.replace(/_/g, " ")} • {q.difficulty}
                                        </span>
                                    </p>
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
                    onClose={() => setDesmosOpen(false)}
                />
            )}
        </div>
    );
}
