'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AdaptiveBluebookSession() {
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

    const [currentModule, setCurrentModule] = useState<'RW_M1' | 'RW_M2_Easy' | 'RW_M2_Hard' | 'MATH_M1'>('RW_M1');
    const [moduleScore, setModuleScore] = useState(0);

    const supabase = createClientComponentClient();

    useEffect(() => {
        async function fetchModule() {
            setLoading(true);
            let domainsToFetch: string[] = [];
            let questionLimit = 27;
            let difficultyFilter = null;

            if (currentModule === 'RW_M1') {
                domainsToFetch = ['Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'];
                questionLimit = 27;
            } else if (currentModule === 'RW_M2_Easy') {
                domainsToFetch = ['Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'];
                difficultyFilter = 'Easy';
                questionLimit = 27;
            } else if (currentModule === 'RW_M2_Hard') {
                domainsToFetch = ['Information_Ideas', 'Craft_Structure', 'Expression_Ideas', 'Standard_English'];
                difficultyFilter = 'Hard';
                questionLimit = 27;
            } else if (currentModule === 'MATH_M1') {
                domainsToFetch = ['Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry'];
                questionLimit = 22;
            }

            // Fix: Querying by 'domain' instead of 'section' to prevent the 400 error
            let query = supabase.from('sat_question_bank').select('*').in('domain', domainsToFetch);
            if (difficultyFilter) {
                query = query.eq('difficulty', difficultyFilter);
            }

            const { data, error } = await query.limit(questionLimit * 3);

            if (error) {
                console.error("Supabase Fetch Error:", error);
                setLoading(false);
                return;
            }

            // Deduplication and Text Cleanup
            const uniqueQuestions = [];
            const seenText = new Set();

            for (const q of data || []) {
                if (!seenText.has(q.question_text)) {
                    seenText.add(q.question_text);
                    if (Array.isArray(q.options)) {
                        // Strips "A) " or "B. " from options
                        q.options = q.options.map((opt: string) => opt.replace(/^[a-dA-D][\)\.\-]\s*/, '').trim());
                    }
                    uniqueQuestions.push(q);
                }
            }

            setQuestions(uniqueQuestions.slice(0, questionLimit));
            setCurrentIndex(0);
            setUserAnswers({});
            setLoading(false);
        }

        fetchModule();
    }, [currentModule, supabase]);

    const handleAnswerSelect = (answer: string) => {
        setUserAnswers(prev => ({ ...prev, [currentIndex]: answer }));
    };

    const submitModule = () => {
        let correctCount = 0;
        questions.forEach((q, idx) => {
            if (userAnswers[idx] === q.correct_answer) {
                correctCount++;
            }
        });
        setModuleScore(correctCount);

        if (currentModule === 'RW_M1') {
            if (correctCount >= 15) {
                setCurrentModule('RW_M2_Hard');
            } else {
                setCurrentModule('RW_M2_Easy');
            }
        } else if (currentModule === 'RW_M2_Easy' || currentModule === 'RW_M2_Hard') {
            setCurrentModule('MATH_M1');
        } else {
            alert(`Test Complete! Final Math Score: ${correctCount}`);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-[#F3F4F6] text-black">Loading Secure Test Environment...</div>;
    if (questions.length === 0) return <div className="h-screen flex items-center justify-center bg-[#F3F4F6] text-red-600">Error: Not enough questions in database.</div>;

    const currentQ = questions[currentIndex];

    return (
        <div className="h-screen w-screen flex flex-col bg-[#F3F4F6] overflow-hidden font-sans text-black">

            <header className="h-[60px] bg-[#242b35] text-white flex justify-between items-center px-4 shrink-0 shadow-md z-10">
                <div className="flex items-center space-x-3">
                    <span className="text-gray-300 text-sm font-bold pl-2 tracking-widest uppercase">
                        {currentModule.replace('_', ' — ')}
                    </span>
                </div>
            </header>

            <main className="flex-1 flex flex-row w-full max-w-[1600px] mx-auto p-4 gap-4 overflow-hidden">
                <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-300 overflow-y-auto p-8 relative">
                    <div className="text-lg leading-[1.8] text-gray-900">
                        {currentQ.raw_original_text || "Read the following text and answer the question."}
                    </div>
                </div>

                <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-300 overflow-y-auto p-8 relative flex flex-col">
                    <div className="flex items-center space-x-2 mb-6 text-sm font-bold bg-[#242b35] text-white w-fit px-3 py-1 rounded">
                        <span>{currentIndex + 1}</span>
                    </div>

                    <div className="text-xl mb-8 font-medium leading-relaxed">{currentQ.question_text}</div>

                    <div className="flex flex-col space-y-3 mt-auto">
                        {currentQ.options?.map((opt: string, idx: number) => {
                            const letters = ['A', 'B', 'C', 'D'];
                            const isSelected = userAnswers[currentIndex] === opt;
                            return (
                                <label key={idx} className={`group relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all bg-white ${isSelected ? 'border-[#004de6] bg-[#f0f5ff]' : 'border-gray-300 hover:border-[#004de6]'}`}>
                                    <input type="radio" name="answer" className="hidden" onChange={() => handleAnswerSelect(opt)} checked={isSelected} />
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-4 shrink-0 ${isSelected ? 'border-solid border-[#004de6] bg-[#004de6] text-white' : 'border-dashed border-gray-400 text-black group-hover:border-solid group-hover:border-[#004de6]'}`}>
                                        {letters[idx]}
                                    </div>
                                    <span className="text-lg pt-0.5">{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </main>

            <footer className="h-[80px] bg-white border-t border-gray-300 flex items-center justify-between px-6 shrink-0 z-10">
                <div className="w-1/4 font-semibold text-gray-800 tracking-wide">Dhruv Shah</div>

                <div className="flex-1 flex justify-center space-x-1 overflow-x-auto px-4">
                    {questions.map((_, idx) => {
                        const isAnswered = !!userAnswers[idx];
                        return (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-9 h-9 flex items-center justify-center text-sm font-bold border rounded-[3px] transition-colors ${currentIndex === idx
                                        ? 'bg-[#004de6] text-white border-[#004de6]'
                                        : isAnswered ? 'bg-gray-200 text-black border-gray-400' : 'bg-white text-gray-800 border-gray-400 border-dashed hover:border-solid hover:border-gray-500'
                                    }`}
                            >
                                {idx + 1}
                            </button>
                        )
                    })}
                </div>

                <div className="w-1/4 flex justify-end space-x-4">
                    {currentIndex === questions.length - 1 ? (
                        <button onClick={submitModule} className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-full hover:bg-green-700 shadow-md transition-colors">
                            Submit Module
                        </button>
                    ) : (
                        <button onClick={() => setCurrentIndex(prev => prev + 1)} className="px-8 py-2.5 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 shadow-md transition-colors">
                            Next
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
