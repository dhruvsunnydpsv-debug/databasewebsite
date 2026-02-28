"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { calculateModuleWeightedScore, calculateSectionScaledScore } from "@/lib/scoring-logic";

const DesmosCalculator = dynamic(() => import("../DesmosCalculator"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────
interface Question {
    id: string;
    question_text: string;
    options: string[] | null;
    correct_answer: string;
    raw_original_text?: string;
    rationale?: string;
    domain?: string;
    difficulty?: string;
    module?: string;
    is_placeholder?: boolean;
}

type Stage = 1 | 2 | 3 | 4;
type Phase = "loading" | "testing" | "between" | "complete";

const STAGE_CONFIG = {
    1: { label: "Reading & Writing — Module 1", count: 27, seconds: 32 * 60, subject: "rw" },
    2: { label: "Reading & Writing — Module 2", count: 27, seconds: 32 * 60, subject: "rw" },
    3: { label: "Math — Module 1", count: 22, seconds: 35 * 60, subject: "math" },
    4: { label: "Math — Module 2", count: 22, seconds: 35 * 60, subject: "math" },
} as const;

function makePlaceholder(mod: string, difficulty: string, domain: string, index: number): Question {
    return {
        id: `placeholder-${mod}-${domain}-${difficulty}-${index}`,
        question_text: "",
        options: null,
        correct_answer: "",
        domain,
        difficulty,
        module: mod,
        is_placeholder: true,
    };
}

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ─── Supabase Adaptive Fetch ───────────────────────────────────
async function fetchQuestions(stage: Stage, module1Score?: number, seenIds?: Set<string>): Promise<Question[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const cfg = STAGE_CONFIG[stage];
    const isMath = cfg.subject === "math";
    const modString = isMath ? "Math" : "Reading_Writing";
    const total = cfg.count;

    const mathDomains = ["Heart_of_Algebra", "Advanced_Math", "Problem_Solving_Data", "Geometry_Trigonometry"];
    const rwDomains = ["Information_Ideas", "Craft_Structure", "Expression_Ideas", "Standard_English"];
    const domains = isMath ? mathDomains : rwDomains;

    let tiers: { difficulty: string; count: number }[];
    if (stage === 1 || stage === 3) {
        tiers = [
            { difficulty: "Easy", count: Math.floor(total * 0.30) },
            { difficulty: "Medium", count: Math.floor(total * 0.40) },
            { difficulty: "Hard", count: total - Math.floor(total * 0.30) - Math.floor(total * 0.40) },
        ];
    } else {
        const isHigherPath = (module1Score ?? 0) >= 65;
        if (isHigherPath) {
            tiers = [
                { difficulty: "Medium", count: Math.floor(total * 0.40) },
                { difficulty: "Hard", count: total - Math.floor(total * 0.40) },
            ];
        } else {
            tiers = [
                { difficulty: "Easy", count: Math.floor(total * 0.60) },
                { difficulty: "Medium", count: total - Math.floor(total * 0.60) },
            ];
        }
    }

    const results: Question[] = [];
    let placeholderIdx = 0;

    for (const tier of tiers) {
        if (tier.count <= 0) continue;
        const perDomain = Math.ceil(tier.count / domains.length);
        let tierRemaining = tier.count;
        const tierPromises: Promise<Question[]>[] = [];

        for (const domain of domains) {
            if (tierRemaining <= 0) break;
            const fetchCount = Math.min(perDomain, tierRemaining);
            tierRemaining -= fetchCount;

            tierPromises.push((async () => {
                const fetched: Question[] = [];
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    const url = `${supabaseUrl}/rest/v1/sat_question_bank?module=eq.${modString}&domain=eq.${domain}&difficulty=eq.${tier.difficulty}&limit=400`;
                    const res = await fetch(url, {
                        headers: { "apikey": supabaseKey, "Authorization": `Bearer ${supabaseKey}` },
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        const rows: Question[] = await res.json();
                        const freshRows = seenIds ? rows.filter((r: Question) => !seenIds.has(r.id)) : rows;
                        const shuffledRows = shuffleArray(freshRows);
                        fetched.push(...shuffledRows.slice(0, fetchCount));
                    }
                } catch {
                    // Ignore error
                }
                while (fetched.length < fetchCount) {
                    fetched.push(makePlaceholder(modString, tier.difficulty, domain, placeholderIdx++));
                }
                return fetched;
            })());
        }

        const tierResults = await Promise.all(tierPromises);
        for (const tr of tierResults) {
            results.push(...tr);
        }
    }

    while (results.length < total) {
        results.push(makePlaceholder(modString, "Medium", "General", placeholderIdx++));
    }
    return shuffleArray(results).slice(0, total);
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

export default function BluebookSession() {
    const [stage, setStage] = useState<Stage>(1);
    const [phase, setPhase] = useState<Phase>("loading");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [freeText, setFreeText] = useState<Record<number, string>>({});
    const [marked, setMarked] = useState<Set<number>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timerSec, setTimerSec] = useState(STAGE_CONFIG[1].seconds);
    const [timerHidden, setTimerHidden] = useState(false);
    const [desmosOpen, setDesmosOpen] = useState(false);
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

    const [moduleCorrectCounts, setModuleCorrectCounts] = useState<Record<number, number>>({});
    const [moduleWeightedScores, setModuleWeightedScores] = useState<Record<number, number>>({});
    const [finalRWScore, setFinalRWScore] = useState(0);
    const [finalMathScore, setFinalMathScore] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadStage = useCallback(async (s: Stage, routingVal?: number, currentSeenIds?: Set<string>) => {
        setPhase("loading");
        setCurrentIndex(0);
        setAnswers({});
        setFreeText({});
        setMarked(new Set());
        try {
            const qs = await fetchQuestions(s, routingVal, currentSeenIds);
            setQuestions(qs);
        } catch {
            const cfg = STAGE_CONFIG[s];
            const mod = cfg.subject === "math" ? "Math" : "Reading_Writing";
            const fallback: Question[] = Array.from({ length: cfg.count }, (_, i) =>
                makePlaceholder(mod, "Medium", "General", i)
            );
            setQuestions(fallback);
        } finally {
            setTimerSec(STAGE_CONFIG[s].seconds);
            setPhase("testing");
        }
    }, []);

    useEffect(() => { loadStage(1, undefined, new Set()); }, [loadStage]);

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

    const handleModuleEnd = () => {
        if (timerRef.current) clearInterval(timerRef.current);

        const cfg = STAGE_CONFIG[stage];
        // The College Board uses unscored operational questions (usually 2 per module).
        // For our simplified grading, we grade all answered questions but weight them.
        let correctRaw = 0;
        for (let i = 0; i < cfg.count; i++) {
            const q = questions[i];
            const ansLetter = (q.options ? answers[i] : freeText[i] || "").trim().toLowerCase();
            const dbAns = (q.correct_answer || "").trim().toLowerCase();

            if (!ansLetter || !dbAns) continue;

            let isCorrect = false;

            if (q.options && q.options.length > 0) {
                const userIdx = ['a', 'b', 'c', 'd'].indexOf(ansLetter);
                const optText = userIdx >= 0 ? (q.options[userIdx] || "").trim().toLowerCase() : "";

                if (
                    ansLetter === dbAns ||
                    dbAns === `choice ${ansLetter}` ||
                    dbAns === `option ${ansLetter}` ||
                    (optText && optText === dbAns)
                ) {
                    isCorrect = true;
                }
            } else {
                if (ansLetter === dbAns) isCorrect = true;
            }

            if (isCorrect) correctRaw++;
        }

        const weighted = calculateModuleWeightedScore(questions, answers, freeText, cfg.count);
        setModuleCorrectCounts(prev => ({ ...prev, [stage]: correctRaw }));
        setModuleWeightedScores(prev => ({ ...prev, [stage]: weighted }));

        if (stage === 1 || stage === 3) {
            setPhase("between");
        } else if (stage === 2) {
            const m1Correct = moduleCorrectCounts[1] || 0;
            const isHigher = (m1Correct / STAGE_CONFIG[1].count) >= 0.65;
            const scaled = calculateSectionScaledScore(moduleWeightedScores[1] || 0, weighted, isHigher);
            setFinalRWScore(scaled);
            setPhase("between");
        } else if (stage === 4) {
            const m3Correct = moduleCorrectCounts[3] || 0;
            const isHigher = (m3Correct / STAGE_CONFIG[3].count) >= 0.65;
            const mathScaled = calculateSectionScaledScore(moduleWeightedScores[3] || 0, weighted, isHigher);
            setFinalMathScore(mathScaled);
            setPhase("complete");
        }
    };

    const handleNextModule = () => {
        const next = (stage + 1) as Stage;
        if (next > 4) { setPhase("complete"); return; }
        const accuracyPct = Math.round(((moduleCorrectCounts[stage] || 0) / STAGE_CONFIG[stage].count) * 100);
        setStage(next);

        const newSeen = new Set(seenIds);
        questions.forEach((q: Question) => {
            if (!q.is_placeholder) newSeen.add(q.id);
        });
        setSeenIds(newSeen);

        loadStage(next, accuracyPct, newSeen);
    };

    if (phase === "loading") {
        return <div className="h-screen w-screen flex items-center justify-center bg-white text-black text-xl font-sans">Loading Secure Test Environment...</div>;
    }

    if (phase === "between") {
        const cfg = STAGE_CONFIG[stage];
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-black font-sans text-center p-8">
                <p className="text-sm tracking-widest uppercase text-gray-500 mb-3">Section Complete</p>
                <h2 className="text-3xl font-bold mb-4">{cfg.label}</h2>
                <p className="text-gray-600 mb-8">Take a moment to rest. The next module will adjust to your performance.</p>
                {stage < 4 ? (
                    <button onClick={handleNextModule} className="bg-blue-600 text-white border-none rounded-md px-8 py-3 text-lg font-bold cursor-pointer hover:bg-blue-700">
                        Begin Next Module →
                    </button>
                ) : (
                    <button onClick={() => setPhase("complete")} className="bg-green-500 text-white border-none rounded-md px-8 py-3 text-lg font-bold cursor-pointer hover:bg-green-600">
                        View Results →
                    </button>
                )}
            </div>
        );
    }

    if (phase === "complete") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black font-sans text-center p-8">
                <p className="text-xs tracking-widest uppercase text-gray-500 mb-3">Practice Performance</p>
                <h2 className="text-8xl font-black mb-0 leading-none tracking-tighter">{finalRWScore + finalMathScore}</h2>
                <p className="text-sm text-gray-500 mb-8 uppercase tracking-widest">Total Scaled Score (400–1600)</p>

                <div className="grid grid-cols-2 gap-8 mb-12 w-full max-w-xl">
                    <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 border-l-4 border-l-blue-500 shadow-sm">
                        <p className="text-4xl font-extrabold m-0">{finalRWScore}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold mt-2">Reading & Writing</p>
                    </div>
                    <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 border-l-4 border-l-red-500 shadow-sm">
                        <p className="text-4xl font-extrabold m-0">{finalMathScore}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold mt-2">Mathematics</p>
                    </div>
                </div>

                <a href="/" className="bg-[#E6D5F8] text-black border border-black rounded-full px-10 py-3 text-base font-bold cursor-pointer no-underline hover:bg-[#D4BFEF] transition-colors">
                    Return to Home
                </a>
            </div>
        );
    }

    if (questions.length === 0) {
        return <div className="h-screen w-screen flex items-center justify-center bg-white text-red-600 text-xl font-bold font-sans">Error: Question Bank Empty or 400 Bad Request.</div>;
    }

    const currentQ = questions[currentIndex];
    const isMathStage = stage === 3 || stage === 4;
    const cfg = STAGE_CONFIG[stage];

    return (
        <div className="h-screen w-screen flex flex-col bg-white overflow-hidden font-sans text-black select-none">

            {/* 1. BLUEBOOK HEADER (Dark Slate) */}
            <header className="h-14 bg-[#1E2532] text-white flex justify-between items-center px-6 shrink-0 relative z-20">
                <div className="flex items-center space-x-4">
                    <span className="font-semibold text-sm cursor-pointer">Directions ▼</span>
                    <span className="text-gray-300 text-sm border-l border-gray-600 pl-4">{cfg.label}</span>
                </div>

                <div className="flex items-center space-x-4 absolute left-1/2 transform -translate-x-1/2">
                    {!timerHidden && (
                        <span className="text-xl font-bold tracking-widest">{formatTime(timerSec)}</span>
                    )}
                    <button onClick={() => setTimerHidden(!timerHidden)} className="text-xs text-gray-400 hover:text-white cursor-pointer ml-2">
                        {timerHidden ? "Show" : "Hide"}
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    {isMathStage && (
                        <button onClick={() => setDesmosOpen(!desmosOpen)} className="bg-[#2D3646] hover:bg-[#3A4556] px-3 py-1 rounded text-sm font-medium transition-colors">Calculator</button>
                    )}
                    <button
                        onClick={() => setMarked(prev => {
                            const n = new Set(prev);
                            n.has(currentIndex) ? n.delete(currentIndex) : n.add(currentIndex);
                            return n;
                        })}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${marked.has(currentIndex) ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#2D3646] hover:bg-[#3A4556]'}`}
                    >
                        {marked.has(currentIndex) ? "🚩 Marked" : "Mark for Review"}
                    </button>
                </div>
            </header>

            {/* 2. SPLIT SCREEN BODY */}
            <main className="flex-1 flex flex-row overflow-hidden border-b border-gray-300 relative z-10">

                {/* Left Pane: Passage (Always visible in Bluebook) */}
                <div className="w-1/2 p-10 overflow-y-auto border-r border-gray-300">
                    <div className="text-lg leading-relaxed text-gray-900 border-l-4 border-gray-800 pl-4 font-serif select-text">
                        {currentQ.rationale || currentQ.raw_original_text || "Read the following text and answer the question."}
                    </div>
                </div>

                {/* Right Pane: Question & Options */}
                <div className="w-1/2 p-10 overflow-y-auto bg-gray-50">
                    <div className="flex items-center space-x-2 mb-6 text-sm font-bold bg-black text-white w-fit px-3 py-1 rounded">
                        <span>{currentIndex + 1}</span>
                    </div>

                    {!currentQ.is_placeholder && (
                        <div className="text-xl mb-8 font-medium leading-snug select-text">{currentQ.question_text}</div>
                    )}

                    {currentQ.is_placeholder ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded text-red-700">
                            <p className="font-bold mb-2">Error: Insufficient Data</p>
                            <p className="text-sm">Attempted fetching: {currentQ.module} • {currentQ.domain} • {currentQ.difficulty}</p>
                        </div>
                    ) : currentQ.options && currentQ.options.length > 0 ? (
                        <div className="space-y-3">
                            {currentQ.options?.map((opt: string, idx: number) => {
                                const letters = ['A', 'B', 'C', 'D'];
                                const letter = letters[idx];
                                const selected = answers[currentIndex] === letter;
                                return (
                                    <label key={idx} className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors group ${selected ? 'bg-blue-50 border-blue-600' : 'bg-white border-gray-400 hover:bg-blue-50 hover:border-blue-600'}`}>
                                        <input type="radio" name="answer" className="hidden" onChange={() => setAnswers(prev => ({ ...prev, [currentIndex]: letter }))} checked={selected} />
                                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold mr-4 shrink-0 transition-colors ${selected ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'}`}>
                                            {letter}
                                        </div>
                                        <span className="text-lg select-text">{opt}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div>
                            <p className="text-sm text-gray-500 mb-2 font-bold uppercase tracking-wide">Student-Produced Response</p>
                            <input
                                type="text"
                                value={freeText[currentIndex] ?? ""}
                                onChange={e => setFreeText(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                                placeholder="Enter answer..."
                                className="px-4 py-3 border-2 border-blue-600 rounded-lg text-lg w-48 outline-none focus:ring-2 focus:ring-blue-500 font-bold select-text"
                            />
                        </div>
                    )}
                </div>
            </main>

            {/* 3. THE "PACK" (Bottom Navigation Grid) */}
            <footer className="h-20 bg-white flex items-center justify-between px-6 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] relative z-20 overflow-hidden">
                <div className="flex items-center space-x-4 sm:w-1/4">
                    <span className="font-semibold text-gray-700 hidden sm:inline-block">Dhruv Shah</span>
                </div>

                {/* The Bluebook Square Nav */}
                <div className="flex space-x-1 overflow-x-auto px-4 w-full sm:w-1/2 justify-center pb-2 pt-2 scrollbar-hide">
                    {questions.map((q, idx) => {
                        const isAnswered = q.options ? !!answers[idx] : !!freeText[idx];
                        const isMarked = marked.has(idx);
                        return (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-9 h-9 flex items-center justify-center text-sm font-bold border transition-colors shrink-0 relative ${currentIndex === idx
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : isAnswered
                                        ? 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                                        : 'bg-white text-gray-800 border-gray-400 hover:bg-gray-200'
                                    }`}
                            >
                                {idx + 1}
                                {isMarked && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-white"></span>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex space-x-4 sm:w-1/4 justify-end">
                    <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        className="px-6 py-2 border border-blue-600 text-blue-600 font-bold rounded hover:bg-blue-50 disabled:opacity-50 transition-colors hidden sm:inline-block"
                        disabled={currentIndex === 0}
                    >
                        Back
                    </button>

                    {currentIndex === questions.length - 1 ? (
                        <button
                            onClick={handleModuleEnd}
                            className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 transition-colors"
                        >
                            Submit
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors shrink-0"
                        >
                            Next
                        </button>
                    )}
                </div>
            </footer>

            {/* Desmos Calculator Float */}
            {desmosOpen && isMathStage && (
                <DesmosCalculator onClose={() => setDesmosOpen(false)} />
            )}
        </div>
    );
}
