'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase-browser';
import { calculateModuleWeightedScore, calculateSectionScaledScore } from '@/lib/scoring-logic';

const DesmosCalculator = dynamic(() => import('../DesmosCalculator'), { ssr: false });

type Module = 'RW_M1' | 'RW_M2_Easy' | 'RW_M2_Hard' | 'MATH_M1' | 'MATH_M2_Easy' | 'MATH_M2_Hard' | 'COMPLETE';

const RW_DOMAINS = ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'];
const MATH_DOMAINS = ['Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry'];

const MODULE_TIME: Record<string, number> = {
  RW_M1: 32 * 60, RW_M2_Easy: 32 * 60, RW_M2_Hard: 32 * 60,
  MATH_M1: 35 * 60, MATH_M2_Easy: 35 * 60, MATH_M2_Hard: 35 * 60,
};
const MODULE_LABEL: Record<string, string> = {
  RW_M1: 'Reading and Writing — Module 1',
  RW_M2_Easy: 'Reading and Writing — Module 2',
  RW_M2_Hard: 'Reading and Writing — Module 2',
  MATH_M1: 'Math — Module 1',
  MATH_M2_Easy: 'Math — Module 2',
  MATH_M2_Hard: 'Math — Module 2',
};

type AccumulatedAnswer = {
  question_id: string; question_text: string; raw_original_text: string | null;
  domain: string; difficulty: string; options: string[]; user_answer: string | null;
  correct_answer: string; rationale: string; is_correct: boolean;
  time_seconds: number; module_label: string;
};

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ReferenceSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900">Math Reference Sheet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { title: 'Circle', formulas: ['A = πr²', 'C = 2πr'] },
            { title: 'Rectangle', formulas: ['A = lw'] },
            { title: 'Triangle', formulas: ['A = ½bh'] },
            { title: 'Pythagorean Theorem', formulas: ['a² + b² = c²'] },
            { title: 'Special Triangles', formulas: ['30-60-90: sides 1, √3, 2', '45-45-90: sides 1, 1, √2'] },
            { title: 'Cylinder', formulas: ['V = πr²h'] },
            { title: 'Sphere', formulas: ['V = (4/3)πr³'] },
            { title: 'Cone', formulas: ['V = (1/3)πr²h'] },
            { title: 'Rectangular Prism', formulas: ['V = lwh'] },
            { title: 'Quadratic Formula', formulas: ['x = (−b ± √(b²−4ac)) / 2a'] },
          ].map(({ title, formulas }) => (
            <div key={title} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-1">{title}</p>
              {formulas.map(f => <p key={f} className="font-mono text-gray-800 text-sm">{f}</p>)}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400 text-center">360 degrees in a circle · 2π radians in a circle</p>
      </div>
    </div>
  );
}

function DomainBreakdown({ answers }: { answers: AccumulatedAnswer[] }) {
  const domains = Array.from(new Set(answers.map(a => a.domain))).sort();
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Domain</th>
            <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Correct</th>
            <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Total</th>
            <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">%</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((domain, i) => {
            const da = answers.filter(a => a.domain === domain);
            const correct = da.filter(a => a.is_correct).length;
            const pct = da.length > 0 ? Math.round((correct / da.length) * 100) : 0;
            const color = pct >= 70 ? 'text-green-600 bg-green-50' : pct >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
            return (
              <tr key={domain} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <td className="py-3 px-4 font-medium text-gray-800">{domain}</td>
                <td className="py-3 px-4 text-center font-bold text-gray-700">{correct}</td>
                <td className="py-3 px-4 text-center text-gray-500">{da.length}</td>
                <td className="py-3 px-4 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${color}`}>{pct}%</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnswerReview({ answers }: { answers: AccumulatedAnswer[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  return (
    <div className="flex flex-col gap-3">
      {answers.map((a, i) => {
        const isOpen = !!expanded[i];
        return (
          <div key={i} className={`rounded-xl border overflow-hidden ${a.is_correct ? 'border-green-200' : 'border-red-200'}`}>
            <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
              className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50 transition-colors text-left gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${a.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {a.is_correct ? '✓' : '✗'}
                </span>
                <span className="font-semibold text-gray-800 text-sm truncate">{i + 1}. {a.question_text.slice(0, 80)}{a.question_text.length > 80 ? '…' : ''}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.difficulty === 'Hard' ? 'bg-red-50 text-red-500' : a.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{a.difficulty}</span>
                <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 bg-white border-t border-gray-100">
                {a.raw_original_text && (
                  <div className="mt-3 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">{a.raw_original_text}</div>
                )}
                <p className="text-sm font-medium text-gray-800 mt-3 mb-4 leading-relaxed">{a.question_text}</p>
                <div className="flex flex-col gap-2">
                  {a.options.map((opt, oi) => {
                    const isCorrect = opt === a.correct_answer;
                    const isWrong = !a.is_correct && opt === a.user_answer;
                    return (
                      <div key={oi} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${isCorrect ? 'bg-green-50 border border-green-200' : isWrong ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? 'bg-green-500 text-white' : isWrong ? 'bg-red-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {['A','B','C','D'][oi]}
                        </span>
                        <span className={`leading-relaxed pt-0.5 ${isCorrect ? 'font-semibold text-green-800' : isWrong ? 'text-red-700' : 'text-gray-600'}`}>{opt}</span>
                        {isCorrect && <span className="ml-auto text-green-600 text-xs font-bold shrink-0">✓ Correct</span>}
                        {isWrong && <span className="ml-auto text-red-500 text-xs font-bold shrink-0">Your answer</span>}
                      </div>
                    );
                  })}
                </div>
                {a.rationale && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-wider mb-1">Explanation</p>
                    <p className="text-sm text-blue-900 leading-relaxed">{a.rationale}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdaptiveBluebookSession() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [crossedOut, setCrossedOut] = useState<Record<number, Set<string>>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [eliminateMode, setEliminateMode] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module>('RW_M1');
  const [finalScores, setFinalScores] = useState<{ rw: number; math: number } | null>(null);
  const [rwM1Score, setRwM1Score] = useState(0);
  const [rwIsHigherPath, setRwIsHigherPath] = useState(false);
  const [mathM1Score, setMathM1Score] = useState(0);
  const [mathIsHigherPath, setMathIsHigherPath] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [resultsTab, setResultsTab] = useState<'domains' | 'review'>('domains');
  const [timeLeft, setTimeLeft] = useState(MODULE_TIME['RW_M1']);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartTime = useRef<number>(Date.now());
  const questionTimes = useRef<Record<number, number>>({});
  const testStartTime = useRef<number>(Date.now());
  const allAnswers = useRef<AccumulatedAnswer[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (currentModule === 'COMPLETE') return;
    setTimeLeft(MODULE_TIME[currentModule] || 32 * 60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentModule]);

  const recordCurrentQuestionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
    questionTimes.current[currentIndex] = (questionTimes.current[currentIndex] || 0) + elapsed;
    questionStartTime.current = Date.now();
  }, [currentIndex]);

  const navigateTo = (idx: number) => {
    recordCurrentQuestionTime();
    setCurrentIndex(idx);
    setEliminateMode(false);
    questionStartTime.current = Date.now();
  };

  useEffect(() => {
    if (currentModule === 'COMPLETE') return;
    async function fetchModule() {
      setLoading(true);
      let domains: string[] = [];
      let limit = 27;
      let difficulty: string | null = null;
      switch (currentModule) {
        case 'RW_M1': domains = RW_DOMAINS; limit = 27; break;
        case 'RW_M2_Easy': domains = RW_DOMAINS; difficulty = 'Easy'; limit = 27; break;
        case 'RW_M2_Hard': domains = RW_DOMAINS; difficulty = 'Hard'; limit = 27; break;
        case 'MATH_M1': domains = MATH_DOMAINS; limit = 22; break;
        case 'MATH_M2_Easy': domains = MATH_DOMAINS; difficulty = 'Easy'; limit = 22; break;
        case 'MATH_M2_Hard': domains = MATH_DOMAINS; difficulty = 'Hard'; limit = 22; break;
      }
      let query = supabase.from('sat_question_bank').select('*').in('domain', domains);
      if (difficulty) query = query.eq('difficulty', difficulty);
      let { data, error } = await query.limit(limit * 3);
      if (error) { console.error(error); setLoading(false); return; }
      if (difficulty && (!data || data.length < limit)) {
        const fallback = await supabase.from('sat_question_bank').select('*').in('domain', domains).limit(limit * 3);
        if (!fallback.error && fallback.data && fallback.data.length > 0) {
          data = fallback.data;
        }
      }
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const q of data || []) {
        if (!seen.has(q.question_text)) {
          seen.add(q.question_text);
          if (Array.isArray(q.options)) {
            q.options = q.options.map((o: string) => o.replace(/^[a-dA-D][\)\.\-]\s*/, '').trim());
          }
          unique.push(q);
        }
      }
      setQuestions(unique.slice(0, limit));
      setCurrentIndex(0);
      setUserAnswers({});
      setCrossedOut({});
      setFlagged(new Set());
      questionTimes.current = {};
      questionStartTime.current = Date.now();
      setLoading(false);
    }
    fetchModule();
  }, [currentModule]);

  const submitModule = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recordCurrentQuestionTime();
    const moduleLabel = MODULE_LABEL[currentModule] || currentModule;
    const moduleAnswers: AccumulatedAnswer[] = questions.map((q, i) => ({
      question_id: q.id, question_text: q.question_text,
      raw_original_text: q.raw_original_text || null,
      domain: q.domain, difficulty: q.difficulty, options: q.options || [],
      user_answer: userAnswers[i] ?? null, correct_answer: q.correct_answer,
      rationale: q.rationale || '',
      is_correct: userAnswers[i] === q.correct_answer,
      time_seconds: questionTimes.current[i] || 0, module_label: moduleLabel,
    }));
    allAnswers.current = [...allAnswers.current, ...moduleAnswers];
    const weighted = calculateModuleWeightedScore(questions, userAnswers, {}, questions.length);
    const simpleCorrect = questions.filter((q, i) => userAnswers[i] === q.correct_answer).length;
    if (currentModule === 'RW_M1') {
      const higher = simpleCorrect >= 15;
      setRwM1Score(weighted); setRwIsHigherPath(higher);
      setCurrentModule(higher ? 'RW_M2_Hard' : 'RW_M2_Easy');
    } else if (currentModule === 'RW_M2_Easy' || currentModule === 'RW_M2_Hard') {
      const rwScaled = calculateSectionScaledScore(rwM1Score, weighted, rwIsHigherPath);
      setFinalScores(prev => ({ rw: rwScaled, math: prev?.math ?? 0 }));
      setCurrentModule('MATH_M1');
    } else if (currentModule === 'MATH_M1') {
      const higher = simpleCorrect >= 12;
      setMathM1Score(weighted); setMathIsHigherPath(higher);
      setCurrentModule(higher ? 'MATH_M2_Hard' : 'MATH_M2_Easy');
    } else if (currentModule === 'MATH_M2_Easy' || currentModule === 'MATH_M2_Hard') {
      const mathScaled = calculateSectionScaledScore(mathM1Score, weighted, mathIsHigherPath);
      setFinalScores(prev => ({ rw: prev?.rw ?? 0, math: mathScaled }));
      setCurrentModule('COMPLETE');
    }
    setShowReview(false);
  }, [currentModule, questions, userAnswers, rwM1Score, rwIsHigherPath, mathM1Score, mathIsHigherPath]);

  useEffect(() => {
    if (currentModule !== 'COMPLETE' || !finalScores || !user) return;
    const totalTime = Math.round((Date.now() - testStartTime.current) / 1000);
    const domainScores: Record<string, { correct: number; total: number }> = {};
    for (const a of allAnswers.current) {
      if (!domainScores[a.domain]) domainScores[a.domain] = { correct: 0, total: 0 };
      domainScores[a.domain].total++;
      if (a.is_correct) domainScores[a.domain].correct++;
    }
    supabase.from('user_test_sessions').insert({
      user_id: user.id, rw_score: finalScores.rw, math_score: finalScores.math,
      composite_score: finalScores.rw + finalScores.math,
      rw_higher_path: rwIsHigherPath, math_higher_path: mathIsHigherPath,
      total_time_seconds: totalTime, answers: allAnswers.current, domain_scores: domainScores,
    }).then(({ error }) => { if (error) console.error('Save error:', error); });
  }, [currentModule, finalScores, user]);

  // ── COMPLETE screen ──────────────────────────────────────────────────────
  if (currentModule === 'COMPLETE') {
    const resetTest = () => {
      allAnswers.current = []; setFinalScores(null);
      setCurrentModule('RW_M1'); testStartTime.current = Date.now();
    };
    const answers = allAnswers.current;
    const composite = (finalScores?.rw ?? 0) + (finalScores?.math ?? 0);
    const totalCorrect = answers.filter(a => a.is_correct).length;
    const totalTime = Math.round((Date.now() - testStartTime.current) / 1000);
    return (
      <div className="min-h-screen bg-[#F3F4F6] font-sans">
        <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Test Complete</p>
            <h1 className="text-4xl font-black text-[#242b35]">Your SAT Score Report</h1>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">R&amp;W</p>
              <p className="text-5xl font-black text-[#004de6]">{finalScores?.rw ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-1">/ 800 · {rwIsHigherPath ? 'Hard path' : 'Standard'}</p>
            </div>
            <div className="bg-[#004de6] rounded-2xl p-6 text-center shadow-lg">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">Composite</p>
              <p className="text-6xl font-black text-white">{composite}</p>
              <p className="text-xs text-blue-200 mt-1">/ 1600</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Math</p>
              <p className="text-5xl font-black text-[#004de6]">{finalScores?.math ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-1">/ 800 · {mathIsHigherPath ? 'Hard path' : 'Standard'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: 'Questions', val: answers.length }, { label: 'Correct', val: `${totalCorrect} / ${answers.length}` }, { label: 'Time', val: `${Math.floor(totalTime/60)}m ${totalTime%60}s` }].map(({ label, val }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-gray-800">{val}</p>
                <p className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-b border-gray-200">
            {(['domains', 'review'] as const).map(tab => (
              <button key={tab} onClick={() => setResultsTab(tab)}
                className={`px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors ${resultsTab === tab ? 'bg-white border border-b-white border-gray-200 text-[#004de6]' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab === 'domains' ? 'Domain Breakdown' : `Answer Review (${answers.length})`}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            {resultsTab === 'domains' && <DomainBreakdown answers={answers} />}
            {resultsTab === 'review' && <AnswerReview answers={answers} />}
          </div>
          <div className="flex gap-3 justify-center pb-8">
            <button onClick={() => router.push('/')} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-50 transition-colors text-sm">← Home</button>
            <button onClick={() => router.push('/history')} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-50 transition-colors text-sm">Score History</button>
            <button onClick={resetTest} className="px-6 py-3 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 transition-colors shadow-md text-sm">Retake Test</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F3F4F6]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#004de6] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-500">Loading Test Environment…</span>
      </div>
    </div>
  );

  if (questions.length === 0) return (
    <div className="h-screen flex items-center justify-center bg-[#F3F4F6]">
      <div className="bg-white rounded-xl p-8 border border-red-200 text-center max-w-sm">
        <p className="text-red-600 font-bold text-lg mb-2">No Questions Available</p>
        <p className="text-gray-500 text-sm mb-4">The question bank is being populated. Try again shortly.</p>
        <button onClick={() => setCurrentModule('RW_M1')} className="px-6 py-2 bg-[#004de6] text-white font-bold rounded-full text-sm">Retry</button>
      </div>
    </div>
  );

  const currentQ = questions[currentIndex];
  const isMathModule = MATH_DOMAINS.includes(currentQ?.domain || '');
  const hasPassage = !!(currentQ?.raw_original_text && currentQ.raw_original_text.trim().length > 30);
  const timerWarning = timeLeft <= 300;
  const timerCritical = timeLeft <= 60;

  // ── Review screen ────────────────────────────────────────────────────────
  if (showReview) {
    const unanswered = questions.length - Object.keys(userAnswers).length;
    return (
      <div className="h-screen flex flex-col bg-[#F3F4F6] font-sans">
        <header className="h-[52px] bg-[#242b35] text-white flex items-center justify-between px-6 shrink-0">
          <span className="text-sm font-bold">{MODULE_LABEL[currentModule]}</span>
          <span className={`font-mono text-sm ${timerCritical ? 'text-red-400' : timerWarning ? 'text-yellow-400' : 'text-gray-300'}`}>{formatTime(timeLeft)}</span>
        </header>
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-2xl w-full shadow-sm">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Review Answers</h2>
            <p className="text-gray-500 text-sm mb-6">
              {unanswered > 0 ? `${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. You can still go back.` : 'All questions answered. Ready to submit?'}
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {questions.map((_, idx) => (
                <button key={idx} onClick={() => { setShowReview(false); navigateTo(idx); }}
                  className={`w-10 h-10 rounded text-sm font-bold border transition-colors ${
                    flagged.has(idx) ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                    : userAnswers[idx] ? 'bg-gray-200 border-gray-400 text-gray-800'
                    : 'bg-white border-dashed border-gray-400 text-gray-400'
                  }`}>{idx + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
              <span><span className="inline-block w-4 h-4 bg-gray-200 border border-gray-400 rounded mr-1 align-middle" />Answered</span>
              <span><span className="inline-block w-4 h-4 bg-white border-dashed border border-gray-400 rounded mr-1 align-middle" />Unanswered</span>
              <span><span className="inline-block w-4 h-4 bg-yellow-100 border border-yellow-400 rounded mr-1 align-middle" />Flagged</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-50 text-sm">
                ← Go Back
              </button>
              <button onClick={submitModule} className="px-6 py-2.5 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 text-sm shadow-md">
                Submit Section →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main test view ────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col bg-[#F3F4F6] overflow-hidden font-sans text-black" style={{ position: 'relative' }}>

      {showCalculator && <DesmosCalculator onClose={() => setShowCalculator(false)} />}
      {showReference && <ReferenceSheet onClose={() => setShowReference(false)} />}

      {/* ── Bluebook Header ─────────────────────────────────────────────── */}
      <header className="h-[52px] bg-[#242b35] text-white flex items-center shrink-0 z-20">
        <div className="flex-1 px-5">
          <span className="text-sm font-semibold text-gray-200">{MODULE_LABEL[currentModule]}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-5 ${timerCritical ? 'text-red-400' : timerWarning ? 'text-yellow-400' : 'text-gray-300'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-mono text-[15px] font-bold">{formatTime(timeLeft)}</span>
        </div>
        <div className="flex items-center gap-2 px-5 border-l border-white/10">
          {isMathModule && (
            <button onClick={() => setShowCalculator(c => !c)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${showCalculator ? 'bg-white text-[#242b35]' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>
              Calculator
            </button>
          )}
          {isMathModule && (
            <button onClick={() => setShowReference(r => !r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${showReference ? 'bg-white text-[#242b35]' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Reference
            </button>
          )}
        </div>
      </header>

      {/* ── Sub-bar: question number + tools ─────────────────────────────── */}
      <div className="h-[36px] bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0 z-10">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 text-xs">Question</span>
          <span className="font-black text-gray-800">{currentIndex + 1}</span>
          <span className="text-gray-400 text-xs">of {questions.length}</span>
          {flagged.has(currentIndex) && <span className="ml-2 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">⚑ Flagged</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEliminateMode(e => !e)}
            title="Eliminate answer choices"
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded border transition-colors ${eliminateMode ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500'}`}>
            <span className={eliminateMode ? 'font-bold' : 'line-through opacity-50'}>ABC</span>
            <span className="ml-1 opacity-80">{eliminateMode ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={() => setFlagged(prev => { const n = new Set(prev); n.has(currentIndex) ? n.delete(currentIndex) : n.add(currentIndex); return n; })}
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded border transition-colors ${flagged.has(currentIndex) ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500'}`}>
            ⚑ {flagged.has(currentIndex) ? 'Unflag' : 'Flag for Review'}
          </button>
        </div>
      </div>

      {/* ── Main body ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-row w-full overflow-hidden">

        {/* LEFT PANE — Passage */}
        {hasPassage && (
          <div className="w-[48%] bg-white border-r-2 border-[#e5e7eb] overflow-y-auto">
            <div className="p-8 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100">Passage</p>
              <div className="text-[15px] leading-[2] text-gray-800 whitespace-pre-wrap font-serif">{currentQ.raw_original_text}</div>
            </div>
          </div>
        )}

        {/* RIGHT PANE — Question + Answer Choices */}
        <div className={`${hasPassage ? 'w-[52%]' : 'w-full'} bg-[#F8F9FA] overflow-y-auto`}>
          <div className={`${hasPassage ? 'p-8 pt-6' : 'max-w-[720px] mx-auto p-8 pt-6'}`}>

            {/* Question number */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded bg-[#242b35] text-white text-sm font-black flex items-center justify-center shrink-0">{currentIndex + 1}</div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded">{currentQ.domain}</span>
            </div>

            {/* Question */}
            <p className="text-[16px] font-medium leading-[1.8] text-gray-900 mb-7 whitespace-pre-wrap">{currentQ.question_text}</p>

            {/* Answer choices */}
            <div className="flex flex-col gap-2.5">
              {currentQ.options?.map((opt: string, idx: number) => {
                const letters = ['A', 'B', 'C', 'D'];
                const isSelected = userAnswers[currentIndex] === opt;
                const isCrossed = (crossedOut[currentIndex] || new Set()).has(opt);

                if (eliminateMode) {
                  return (
                    <button key={idx} onClick={() => {
                      setCrossedOut(prev => {
                        const cur = new Set(prev[currentIndex] || []);
                        cur.has(opt) ? cur.delete(opt) : cur.add(opt);
                        return { ...prev, [currentIndex]: cur };
                      });
                    }}
                      className={`flex items-center p-4 border-2 rounded-xl text-left gap-3 transition-all ${isCrossed ? 'opacity-35 bg-gray-50 border-gray-100' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0 text-sm relative ${isCrossed ? 'border-gray-300 text-gray-300' : 'border-gray-400 text-gray-600'}`}>
                        {letters[idx]}
                        {isCrossed && <div className="absolute w-full h-0.5 bg-gray-500 rotate-12" />}
                      </div>
                      <span className={`text-[15px] leading-relaxed ${isCrossed ? 'line-through text-gray-300' : 'text-gray-800'}`}>{opt}</span>
                    </button>
                  );
                }

                return (
                  <label key={idx}
                    className={`group flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all select-none ${
                      isSelected ? 'border-[#004de6] bg-[#EBF0FF]'
                      : isCrossed ? 'opacity-35 bg-gray-50 border-gray-100'
                      : 'border-gray-200 bg-white hover:border-[#004de6]/40 hover:bg-[#F5F8FF]'
                    }`}>
                    <input type="radio" name="answer" className="hidden" onChange={() => setUserAnswers(prev => ({ ...prev, [currentIndex]: opt }))} checked={isSelected} readOnly />
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0 text-sm transition-all ${
                      isSelected ? 'bg-[#004de6] border-[#004de6] text-white' : 'border-gray-400 text-gray-600 group-hover:border-[#004de6]'
                    }`}>{letters[idx]}</div>
                    <span className={`ml-4 text-[15px] leading-relaxed ${isSelected ? 'text-[#004de6] font-semibold' : 'text-gray-800'}`}>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ── Bluebook Footer ───────────────────────────────────────────────── */}
      <footer className="h-[58px] bg-white border-t border-gray-200 flex items-center shrink-0 z-10 px-4 gap-2">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {questions.map((_, idx) => {
            const answered = !!userAnswers[idx];
            const isCurrent = currentIndex === idx;
            const isFl = flagged.has(idx);
            return (
              <button key={idx} onClick={() => navigateTo(idx)}
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-[3px] border shrink-0 transition-colors ${
                  isCurrent ? 'bg-[#004de6] text-white border-[#004de6]'
                  : isFl ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                  : answered ? 'bg-[#dee2e6] text-gray-800 border-[#adb5bd]'
                  : 'bg-white text-gray-500 border-dashed border-[#adb5bd] hover:border-solid hover:border-gray-600'
                }`}>{idx + 1}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
          {currentIndex > 0 && (
            <button onClick={() => navigateTo(currentIndex - 1)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-full text-sm hover:bg-gray-50 transition-colors">
              ← Back
            </button>
          )}
          {currentIndex < questions.length - 1 ? (
            <button onClick={() => navigateTo(currentIndex + 1)} className="px-5 py-2 bg-[#004de6] text-white font-bold rounded-full text-sm hover:bg-blue-800 shadow-sm transition-colors">
              Next →
            </button>
          ) : (
            <button onClick={() => setShowReview(true)} className="px-5 py-2 bg-green-600 text-white font-bold rounded-full text-sm hover:bg-green-700 shadow-md transition-colors">
              Review &amp; Submit
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
