'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Module = 'RW_M1' | 'RW_M2_Easy' | 'RW_M2_Hard' | 'MATH_M1' | 'MATH_M2_Easy' | 'MATH_M2_Hard' | 'COMPLETE';

const RW_DOMAINS = ['Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'];
const MATH_DOMAINS = ['Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry'];

export default function AdaptiveBluebookSession() {
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [currentModule, setCurrentModule] = useState<Module>('RW_M1');
    const [finalScores, setFinalScores] = useState<{ rw: number; math: number } | null>(null);

    useEffect(() => {
        if (currentModule === 'COMPLETE') return;

        async function fetchModule() {
            setLoading(true);

            let domains: string[] = [];
            let limit = 27;
            let difficulty: string | null = null;

            switch (currentModule) {
                case 'RW_M1':
                    domains = RW_DOMAINS;
                    limit = 27;
                    break;
                case 'RW_M2_Easy':
                    domains = RW_DOMAINS;
                    difficulty = 'Easy';
                    limit = 27;
                    break;
                case 'RW_M2_Hard':
                    domains = RW_DOMAINS;
                    difficulty = 'Hard';
                    limit = 27;
                    break;
                case 'MATH_M1':
                    domains = MATH_DOMAINS;
                    limit = 22;
                    break;
                case 'MATH_M2_Easy':
                    domains = MATH_DOMAINS;
                    difficulty = 'Easy';
                    limit = 22;
                    break;
                case 'MATH_M2_Hard':
                    domains = MATH_DOMAINS;
                    difficulty = 'Hard';
                    limit = 22;
                    break;
            }

            let query = supabase.from('sat_question_bank').select('*').in('domain', domains);
            if (difficulty) query = query.eq('difficulty', difficulty);

            const { data, error } = await query.limit(limit * 3);

            if (error) {
                console.error('Supabase Fetch Error:', error);
                setLoading(false);
                return;
            }

            const uniqueQuestions: any[] = [];
            const seenText = new Set<string>();

            for (const q of data || []) {
                if (!seenText.has(q.question_text)) {
                    seenText.add(q.question_text);
                    if (Array.isArray(q.options)) {
                        q.options = q.options.map((opt: string) =>
                            opt.replace(/^[a-dA-D][\)\.\-]\s*/, '').trim()
                        );
                    }
                    uniqueQuestions.push(q);
                }
            }

            setQuestions(uniqueQuestions.slice(0, limit));
            setCurrentIndex(0);
            setUserAnswers({});
            setLoading(false);
        }

        fetchModule();
    }, [currentModule]);

    const handleAnswerSelect = (answer: string) => {
        setUserAnswers(prev => ({ ...prev, [currentIndex]: answer }));
    };

    const gradeModule = () => {
        let correct = 0;
        questions.forEach((q, idx) => {
            if (userAnswers[idx] === q.correct_answer) correct++;
        });
        return correct;
    };

    const submitModule = () => {
        const score = gradeModule();

        if (currentModule === 'RW_M1') {
            setCurrentModule(score >= 15 ? 'RW_M2_Hard' : 'RW_M2_Easy');
        } else if (currentModule === 'RW_M2_Easy' || currentModule === 'RW_M2_Hard') {
            setCurrentModule('MATH_M1');
        } else if (currentModule === 'MATH_M1') {
            setCurrentModule(score >= 12 ? 'MATH_M2_Hard' : 'MATH_M2_Easy');
        } else if (currentModule === 'MATH_M2_Easy' || currentModule === 'MATH_M2_Hard') {
            setFinalScores(prev => ({ rw: prev?.rw ?? 0, math: score }));
            setCurrentModule('COMPLETE');
        }
    };

    // ── Complete Screen ────────────────────────────────────────────────────
    if (currentModule === 'COMPLETE') {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F3F4F6] text-black gap-6">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 flex flex-col items-center gap-4 max-w-md w-full">
                    <h1 className="text-3xl font-bold text-[#242b35]">Test Complete</h1>
                    <p className="text-gray-500 text-sm">Full Adaptive SAT Finished</p>
                    <div className="w-full border-t border-gray-200 my-2" />
                    <div className="flex justify-around w-full">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-4xl font-black text-[#004de6]">{finalScores?.rw ?? '—'}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Reading &amp; Writing</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-4xl font-black text-[#004de6]">{finalScores?.math ?? '—'}</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Math</span>
                        </div>
                    </div>
                    <button
                        onClick={() => { setCurrentModule('RW_M1'); setFinalScores(null); }}
                        className="mt-4 px-8 py-3 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 transition-colors"
                    >
                        Retake Test
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#F3F4F6] text-black">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[#004de6] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-gray-500">Loading Secure Test Environment…</span>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#F3F4F6]">
                <div className="bg-white rounded-xl p-8 border border-red-200 text-center max-w-sm">
                    <p className="text-red-600 font-bold text-lg mb-2">No Questions Found</p>
                    <p className="text-gray-500 text-sm">The database returned 0 questions for module <strong>{currentModule}</strong>. Check your Supabase domain values and environment variables.</p>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const moduleLabel = currentModule.replace(/_/g, ' ').replace('RW', 'R&W');
    const isLastQuestion = currentIndex === questions.length - 1;

    return (
        <div className="h-screen w-screen flex flex-col bg-[#F3F4F6] overflow-hidden font-sans text-black">

            {/* ── Header ── */}
            <header className="h-[60px] bg-[#242b35] text-white flex justify-between items-center px-6 shrink-0 shadow-md z-10">
                <span className="text-gray-300 text-xs font-bold tracking-widest uppercase">
                    {moduleLabel}
                </span>
                <span className="text-gray-400 text-xs font-medium">
                    {currentIndex + 1} / {questions.length}
                </span>
            </header>

            {/* ── Split Body ── */}
            <main className="flex-1 flex flex-row w-full max-w-[1600px] mx-auto p-4 gap-4 overflow-hidden">

                {/* Left Pane — Passage */}
                <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto p-8">
                    <p className="text-base leading-[1.9] text-gray-800 whitespace-pre-wrap">
                        {currentQ.raw_original_text || 'Read the following and answer the question.'}
                    </p>
                </div>

                {/* Right Pane — Question + Options */}
                <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto p-8 flex flex-col">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#242b35] text-white text-sm font-bold mb-6 shrink-0">
                        {currentIndex + 1}
                    </div>

                    <p className="text-lg font-medium leading-relaxed mb-8">{currentQ.question_text}</p>

                    <div className="flex flex-col gap-3">
                        {currentQ.options?.map((opt: string, idx: number) => {
                            const letters = ['A', 'B', 'C', 'D'];
                            const isSelected = userAnswers[currentIndex] === opt;
                            return (
                                <label
                                    key={idx}
                                    className={`group flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                        isSelected
                                            ? 'border-[#004de6] bg-[#f0f5ff]'
                                            : 'border-gray-300 hover:border-[#004de6] bg-white'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="answer"
                                        className="hidden"
                                        onChange={() => handleAnswerSelect(opt)}
                                        checked={isSelected}
                                        readOnly
                                    />
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-4 shrink-0 text-sm transition-all ${
                                        isSelected
                                            ? 'border-solid border-[#004de6] bg-[#004de6] text-white'
                                            : 'border-dashed border-gray-400 text-black group-hover:border-solid group-hover:border-[#004de6]'
                                    }`}>
                                        {letters[idx]}
                                    </div>
                                    <span className="text-base pt-0.5 leading-relaxed">{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="h-[72px] bg-white border-t border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">

                {/* User name */}
                <div className="w-32 font-semibold text-gray-700 text-sm tracking-wide shrink-0">
                    Dhruv Shah
                </div>

                {/* Question grid */}
                <div className="flex-1 flex justify-center items-center gap-1 overflow-x-auto px-4">
                    {questions.map((_, idx) => {
                        const isAnswered = !!userAnswers[idx];
                        const isCurrent = currentIndex === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-[3px] border transition-colors shrink-0 ${
                                    isCurrent
                                        ? 'bg-[#004de6] text-white border-[#004de6]'
                                        : isAnswered
                                            ? 'bg-gray-200 text-black border-gray-400'
                                            : 'bg-white text-gray-700 border-gray-400 border-dashed hover:border-solid hover:border-gray-600'
                                }`}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>

                {/* Navigation */}
                <div className="w-32 flex justify-end items-center gap-3 shrink-0">
                    {currentIndex > 0 && (
                        <button
                            onClick={() => setCurrentIndex(prev => prev - 1)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-full text-sm hover:bg-gray-200 transition-colors"
                        >
                            Back
                        </button>
                    )}
                    {isLastQuestion ? (
                        <button
                            onClick={submitModule}
                            className="px-6 py-2 bg-green-600 text-white font-bold rounded-full text-sm hover:bg-green-700 shadow-md transition-colors"
                        >
                            Submit
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => prev + 1)}
                            className="px-6 py-2 bg-[#004de6] text-white font-bold rounded-full text-sm hover:bg-blue-800 shadow-md transition-colors"
                        >
                            Next
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
