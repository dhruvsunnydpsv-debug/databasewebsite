"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { calculateModuleWeightedScore, calculateSectionScaledScore } from "@/lib/scoring-logic";
import { createClient } from "@supabase/supabase-js";

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
    section?: string;
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

function makePlaceholder(section: string, difficulty: string, domain: string, index: number): Question {
    return {
        id: `placeholder-${section}-${domain}-${difficulty}-${index}`,
        question_text: "",
        options: null,
        correct_answer: "",
        domain,
        difficulty,
        section,
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

// ─── Direct Supabase Client Fetcher (NO 400 ERRORS) ───────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchQuestions(stage: Stage, module1Score?: number, seenIds?: Set<string>): Promise<Question[]> {
    const cfg = STAGE_CONFIG[stage];
    const isMath = cfg.subject === "math";
    const total = cfg.count;

    let data, error;

    if (isMath) {
        const res = await supabase
            .from('sat_question_bank')
            .select('*')
            .in('domain', ['Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry'])
            .limit(total * 4); // fetch extra to shuffle
        data = res.data;
        error = res.error;
    } else {
        const res = await supabase
            .from('sat_question_bank')
            .select('*')
            .in('domain', ['Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'])
            .limit(total * 4); // fetch extra to shuffle
        data = res.data;
        error = res.error;
    }

    if (error || !data) {
        console.error("Supabase Error:", error);
        throw new Error("Failed to fetch questions from database.");
    }

    const typedData = data as Question[];
    const freshRows = seenIds ? typedData.filter(r => !seenIds.has(r.id)) : typedData;
    const shuffledRows = shuffleArray(freshRows);
    const results = shuffledRows.slice(0, total);

    let placeholderIdx = 0;
    while (results.length < total) {
        results.push(makePlaceholder(isMath ? "Math" : "Reading_Writing", "Medium", "General", placeholderIdx++));
    }

    return results;
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
            const sec = cfg.subject === "math" ? "Math" : "Reading_Writing";
            const fallback: Question[] = Array.from({ length: cfg.count }, (_, i) =>
                makePlaceholder(sec, "Medium", "General", i)
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
        <div className="flex flex-col h-screen w-screen bg-white font-sans overflow-hidden select-none">
            {/* 1. BLUEBOOK HEADER */}
            <header className="h-[52px] bg-[#1E2532] flex items-center justify-between px-6 text-white shrink-0 shadow-md z-10 relative">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm cursor-pointer hover:bg-[#2D3646] px-2 py-1 rounded transition-colors">Directions ▼</span>
                    <span className="text-gray-300 text-sm border-l border-[#3A4556] pl-3 py-1 font-medium tracking-wide">{cfg.label}</span>
                </div>

                {/* Timer Area */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                    {!timerHidden && (
                        <span className="font-bold text-lg tracking-widest">{formatTime(timerSec)}</span>
                    )}
                    <button
                        onClick={() => setTimerHidden(!timerHidden)}
                        className="bg-transparent border border-[#3A4556] hover:bg-[#2D3646] px-2 py-0.5 rounded text-xs font-semibold tracking-wide text-gray-300 transition-colors"
                    >
                        {timerHidden ? "Show" : "Hide"}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {isMathStage && (
                        <button onClick={() => setDesmosOpen(!desmosOpen)} className="bg-transparent hover:bg-[#2D3646] border border-[#3A4556] px-3 py-1.5 rounded text-sm font-semibold transition-colors flex items-center gap-2">
                            Calculator
                        </button>
                    )}
                    <button
                        onClick={() => setMarked(prev => {
                            const n = new Set(prev);
                            n.has(currentIndex) ? n.delete(currentIndex) : n.add(currentIndex);
                            return n;
                        })}
                        className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors flex items-center gap-2 border ${marked.has(currentIndex) ? 'bg-[#c23934] hover:bg-[#a62b27] border-[#c23934] text-white' : 'bg-transparent hover:bg-[#2D3646] border-[#3A4556]'}`}
                    >
                        <span className="text-base">{marked.has(currentIndex) ? "🚩" : "⚑"}</span>
                        Mark for Review
                    </button>
                </div>
            </header>

            {/* 2. SPLIT SCREEN BODY */}
            <main className="flex-1 flex overflow-hidden border-t-2 border-black">
                {/* Left Pane: Passage */}
                <div className="w-1/2 overflow-y-auto border-r-2 border-gray-300 bg-white">
                    <div className="p-10 max-w-2xl mx-auto h-full">
                        <div className="text-[1.1rem] leading-relaxed text-[#1a1a1a] font-serif select-text text-justify">
                            {currentQ.rationale || currentQ.raw_original_text || "Read the following text and answer the question."}
                        </div>
                    </div>
                </div>

                {/* Right Pane: Question & Options */}
                <div className="w-1/2 overflow-y-auto bg-white relative">
                    <div className="p-10 max-w-2xl mx-auto h-full">
                        <div className="flex items-baseline gap-3 mb-6">
                            <span className="text-sm font-bold bg-black text-white px-3 py-1 pb-1.5 rounded inline-block shadow-sm">
                                {currentIndex + 1}
                            </span>
                        </div>

                        {!currentQ.is_placeholder && (
                            <div className="text-[1.05rem] font-medium leading-relaxed mb-8 text-[#1a1a1a] select-text">
                                {currentQ.question_text}
                            </div>
                        )}

                        {currentQ.is_placeholder ? (
                            <div className="border border-red-300 rounded p-6 bg-red-50 text-red-700 font-bold max-w-sm">
                                ⚠ Error: Missing Array Data
                            </div>
                        ) : currentQ.options && currentQ.options.length > 0 ? (
                            <fieldset className="space-y-3">
                                {currentQ.options.map((opt: string, idx: number) => {
                                    const letter = ['A', 'B', 'C', 'D'][idx];
                                    const selected = answers[currentIndex] === letter;
                                    return (
                                        <label
                                            key={idx}
                                            className={`flex items-start p-4 rounded-xl cursor-pointer transition-all border-2 group shadow-sm ${selected ? 'bg-[#f4f7fb] border-[#0c59a4]' : 'bg-white border-gray-300 hover:border-[#8cbced]'}`}
                                        >
                                            <input type="radio" name="answer" className="hidden" onChange={() => setAnswers(prev => ({ ...prev, [currentIndex]: letter }))} checked={selected} />
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-4 shrink-0 transition-colors shadow-sm ${selected ? 'bg-[#0c59a4] text-white border-[#0c59a4]' : 'border-gray-400 text-gray-700 bg-gray-50 group-hover:bg-[#ebf3fa] group-hover:border-[#0c59a4] group-hover:text-[#0c59a4]'}`}>
                                                {letter}
                                            </div>
                                            <span className="text-base text-[#1a1a1a] leading-snug pt-1 select-text">
                                                {opt}
                                            </span>
                                        </label>
                                    );
                                })}
                            </fieldset>
                        ) : (
                            <div className="border border-gray-300 rounded p-6 bg-gray-50 max-w-sm">
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Student-Produced Response</label>
                                <input
                                    type="text"
                                    value={freeText[currentIndex] ?? ""}
                                    onChange={e => setFreeText(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                                    placeholder="Enter your answer"
                                    maxLength={5}
                                    className="w-full px-4 py-3 border-2 border-gray-400 rounded text-xl text-center outline-none focus:border-[#0c59a4] focus:ring-1 focus:ring-[#0c59a4] font-semibold tracking-widest shadow-inner select-text"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* 3. THE "PACK" (Bottom Navigation Grid) */}
            <footer className="h-[72px] bg-white flex items-center justify-between px-6 shrink-0 border-t border-gray-300 z-10 w-full relative">
                <div className="flex items-center sm:w-1/4">
                    <span className="font-semibold text-[#1E2532] text-sm tracking-wide bg-gray-100 px-3 py-1 rounded hidden sm:inline-block">Student</span>
                </div>

                {/* The Bluebook Square Nav */}
                <div className="flex gap-1.5 overflow-x-auto px-4 w-full sm:w-1/2 justify-center pb-2 pt-2 items-center flex-nowrap scrollbar-hide">
                    {questions.map((q, idx) => {
                        const isAnswered = q.options ? !!answers[idx] : !!freeText[idx];
                        const isMarked = marked.has(idx);
                        const isCurrent = currentIndex === idx;

                        return (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-[34px] h-[34px] flex items-center justify-center text-xs font-bold transition-all relative shrink-0 
                                     ${isCurrent ? 'bg-black text-white outline outline-2 outline-offset-2 outline-black shadow-md z-10' : ''} 
                                     ${!isCurrent && isAnswered ? 'bg-[#d8e6f3] text-[#0c59a4]' : ''}
                                     ${!isCurrent && !isAnswered ? 'bg-white text-gray-600 border border-gray-400 border-dashed hover:bg-gray-100' : ''}
                                     ${isMarked && !isCurrent ? 'outline outline-2 outline-offset-1 outline-[#c23934]' : ''}
                                 `}
                                style={{ borderRadius: isCurrent ? '0px' : '2px' }}
                            >
                                {idx + 1}
                                {isMarked && (
                                    <span className="absolute -top-1.5 -right-1.5 text-[#c23934] text-[10px] drop-shadow-sm">🚩</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-3 sm:w-1/4 justify-end">
                    <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        className="px-6 py-1.5 bg-transparent border-2 border-transparent text-[#0c59a4] font-bold rounded-md hover:bg-[#ebf3fa] disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-sm hidden sm:inline-block"
                        disabled={currentIndex === 0}
                    >
                        Back
                    </button>

                    {currentIndex === questions.length - 1 ? (
                        <button
                            onClick={handleModuleEnd}
                            className="px-8 py-1.5 bg-[#0c59a4] text-white font-bold rounded-md hover:bg-[#094784] shadow-md transition-colors text-sm"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                            className="px-8 py-1.5 bg-[#0c59a4] text-white font-bold rounded-md hover:bg-[#094784] shadow-md transition-colors text-sm flex items-center gap-1 shrink-0"
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
