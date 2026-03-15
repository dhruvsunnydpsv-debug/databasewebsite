'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { calculateModuleWeightedScore, calculateSectionScaledScore } from '@/lib/scoring-logic';

type Module = 'RW_M1' | 'RW_M2_Easy' | 'RW_M2_Hard' | 'MATH_M1' | 'MATH_M2_Easy' | 'MATH_M2_Hard' | 'COMPLETE';

const RW_DOMAINS = ['Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions'];
const MATH_DOMAINS = ['Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry'];

type AccumulatedAnswer = {
  question_id: string;
  question_text: string;
  raw_original_text: string | null;
  domain: string;
  difficulty: string;
  options: string[];
  user_answer: string | null;
  correct_answer: string;
  rationale: string;
  is_correct: boolean;
  time_seconds: number;
  module_label: string;
};

function DomainBreakdown({ answers }: { answers: AccumulatedAnswer[] }) {
  const domains = Array.from(new Set(answers.map(a => a.domain))).sort();
  return (
    <div className="w-full">
      <h3 className="text-lg font-black text-[#242b35] mb-4 uppercase tracking-wider text-sm">Domain Breakdown</h3>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Domain</th>
              <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Correct</th>
              <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Total</th>
              <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Score</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain, i) => {
              const domainAnswers = answers.filter(a => a.domain === domain);
              const correct = domainAnswers.filter(a => a.is_correct).length;
              const total = domainAnswers.length;
              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
              const color = pct >= 70 ? 'text-green-600 bg-green-50' : pct >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
              return (
                <tr key={domain} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="py-3 px-4 font-medium text-gray-800">{domain}</td>
                  <td className="py-3 px-4 text-center font-bold text-gray-700">{correct}</td>
                  <td className="py-3 px-4 text-center text-gray-500">{total}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${color}`}>{pct}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnswerReview({ answers }: { answers: AccumulatedAnswer[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  return (
    <div className="w-full">
      <h3 className="text-lg font-black text-[#242b35] mb-4 uppercase tracking-wider text-sm">Full Answer Review</h3>
      <div className="flex flex-col gap-3">
        {answers.map((a, i) => {
          const isOpen = !!expanded[i];
          return (
            <div key={i} className={`rounded-xl border ${a.is_correct ? 'border-green-200' : 'border-red-200'} overflow-hidden`}>
              {/* Question header — always visible */}
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50 transition-colors text-left gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${a.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.is_correct ? '✓' : '✗'}
                  </span>
                  <span className="font-semibold text-gray-800 text-sm truncate">{i + 1}. {a.question_text.slice(0, 80)}{a.question_text.length > 80 ? '…' : ''}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden sm:block">{a.domain}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${a.difficulty === 'Hard' ? 'bg-red-50 text-red-500' : a.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{a.difficulty}</span>
                  <span className="text-[10px] text-gray-400 font-medium">{a.time_seconds}s</span>
                  <span className="text-gray-400 ml-1">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-5 pb-5 bg-white border-t border-gray-100">
                  {/* Passage if present */}
                  {a.raw_original_text && (
                    <div className="mt-3 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {a.raw_original_text}
                    </div>
                  )}
                  {/* Question text */}
                  <p className="text-sm font-medium text-gray-800 mt-3 mb-4 leading-relaxed">{a.question_text}</p>
                  {/* Options */}
                  <div className="flex flex-col gap-2">
                    {a.options.map((opt, oi) => {
                      const letters = ['A', 'B', 'C', 'D'];
                      const isCorrect = opt === a.correct_answer;
                      const isUserWrong = !a.is_correct && opt === a.user_answer;
                      return (
                        <div key={oi} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                          isCorrect ? 'bg-green-50 border border-green-200' :
                          isUserWrong ? 'bg-red-50 border border-red-200' :
                          'bg-gray-50 border border-transparent'
                        }`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCorrect ? 'bg-green-500 text-white' :
                            isUserWrong ? 'bg-red-400 text-white' :
                            'bg-gray-200 text-gray-600'
                          }`}>{letters[oi]}</span>
                          <span className={`leading-relaxed pt-0.5 ${isCorrect ? 'font-semibold text-green-800' : isUserWrong ? 'text-red-700' : 'text-gray-600'}`}>{opt}</span>
                          {isCorrect && <span className="ml-auto text-green-600 text-xs font-bold shrink-0">✓ Correct</span>}
                          {isUserWrong && <span className="ml-auto text-red-500 text-xs font-bold shrink-0">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {/* Rationale */}
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
    </div>
  );
}

export default function AdaptiveBluebookSession() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [currentModule, setCurrentModule] = useState<Module>('RW_M1')
  const [finalScores, setFinalScores] = useState<{ rw: number; math: number } | null>(null)
  const [rwM1Score, setRwM1Score] = useState(0)
  const [rwIsHigherPath, setRwIsHigherPath] = useState(false)
  const [mathM1Score, setMathM1Score] = useState(0)
  const [mathIsHigherPath, setMathIsHigherPath] = useState(false)

  // Time tracking
  const questionStartTime = useRef<number>(Date.now())
  const questionTimes = useRef<Record<number, number>>({})
  const testStartTime = useRef<number>(Date.now())

  // Accumulate answers across all modules for results
  const allAnswers = useRef<AccumulatedAnswer[]>([])

  // Results tab
  const [resultsTab, setResultsTab] = useState<'domains' | 'review'>('domains')

  // Get user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const recordCurrentQuestionTime = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000)
    questionTimes.current[currentIndex] = (questionTimes.current[currentIndex] || 0) + elapsed
    questionStartTime.current = Date.now()
  }, [currentIndex])

  const navigateTo = (idx: number) => {
    recordCurrentQuestionTime()
    setCurrentIndex(idx)
    questionStartTime.current = Date.now()
  }

  useEffect(() => {
    if (currentModule === 'COMPLETE') return

    async function fetchModule() {
      setLoading(true)
      let domains: string[] = []
      let limit = 27
      let difficulty: string | null = null

      switch (currentModule) {
        case 'RW_M1': domains = RW_DOMAINS; limit = 27; break
        case 'RW_M2_Easy': domains = RW_DOMAINS; difficulty = 'Easy'; limit = 27; break
        case 'RW_M2_Hard': domains = RW_DOMAINS; difficulty = 'Hard'; limit = 27; break
        case 'MATH_M1': domains = MATH_DOMAINS; limit = 22; break
        case 'MATH_M2_Easy': domains = MATH_DOMAINS; difficulty = 'Easy'; limit = 22; break
        case 'MATH_M2_Hard': domains = MATH_DOMAINS; difficulty = 'Hard'; limit = 22; break
      }

      let query = supabase.from('sat_question_bank').select('*').in('domain', domains)
      if (difficulty) query = query.eq('difficulty', difficulty)
      const { data, error } = await query.limit(limit * 3)

      if (error) {
        console.error('Fetch error:', error)
        setLoading(false)
        return
      }

      const unique: any[] = []
      const seen = new Set<string>()
      for (const q of data || []) {
        if (!seen.has(q.question_text)) {
          seen.add(q.question_text)
          if (Array.isArray(q.options)) {
            q.options = q.options.map((opt: string) =>
              opt.replace(/^[a-dA-D][\)\.\-]\s*/, '').trim()
            )
          }
          unique.push(q)
        }
      }

      setQuestions(unique.slice(0, limit))
      setCurrentIndex(0)
      setUserAnswers({})
      questionTimes.current = {}
      questionStartTime.current = Date.now()
      setLoading(false)
    }

    fetchModule()
  }, [currentModule])

  const submitModule = () => {
    // Record time for last question
    recordCurrentQuestionTime()

    // Accumulate answers for this module
    const moduleLabel = currentModule.replace(/_/g, ' ').replace('RW', 'R&W')
    const moduleAnswers: AccumulatedAnswer[] = questions.map((q, i) => {
      const userAns = userAnswers[i] ?? null
      const isCorrect = userAns === q.correct_answer
      return {
        question_id: q.id,
        question_text: q.question_text,
        raw_original_text: q.raw_original_text || null,
        domain: q.domain,
        difficulty: q.difficulty,
        options: q.options || [],
        user_answer: userAns,
        correct_answer: q.correct_answer,
        rationale: q.rationale || '',
        is_correct: isCorrect,
        time_seconds: questionTimes.current[i] || 0,
        module_label: moduleLabel,
      }
    })
    allAnswers.current = [...allAnswers.current, ...moduleAnswers]

    const weighted = calculateModuleWeightedScore(questions, userAnswers, {}, questions.length)

    if (currentModule === 'RW_M1') {
      const simpleCount = questions.filter((q, i) => userAnswers[i] === q.correct_answer).length
      const higherPath = simpleCount >= 15
      setRwM1Score(weighted)
      setRwIsHigherPath(higherPath)
      setCurrentModule(higherPath ? 'RW_M2_Hard' : 'RW_M2_Easy')
    } else if (currentModule === 'RW_M2_Easy' || currentModule === 'RW_M2_Hard') {
      const rwScaled = calculateSectionScaledScore(rwM1Score, weighted, rwIsHigherPath)
      setFinalScores(prev => ({ rw: rwScaled, math: prev?.math ?? 0 }))
      setCurrentModule('MATH_M1')
    } else if (currentModule === 'MATH_M1') {
      const simpleCount = questions.filter((q, i) => userAnswers[i] === q.correct_answer).length
      const higherPath = simpleCount >= 12
      setMathM1Score(weighted)
      setMathIsHigherPath(higherPath)
      setCurrentModule(higherPath ? 'MATH_M2_Hard' : 'MATH_M2_Easy')
    } else if (currentModule === 'MATH_M2_Easy' || currentModule === 'MATH_M2_Hard') {
      const mathScaled = calculateSectionScaledScore(mathM1Score, weighted, mathIsHigherPath)
      setFinalScores(prev => ({ rw: prev?.rw ?? 0, math: mathScaled }))
      setCurrentModule('COMPLETE')
    }
  }

  // Save results when test completes
  useEffect(() => {
    if (currentModule !== 'COMPLETE' || !finalScores) return
    if (!user) return

    const totalTime = Math.round((Date.now() - testStartTime.current) / 1000)
    const domainScores: Record<string, { correct: number; total: number }> = {}
    for (const a of allAnswers.current) {
      if (!domainScores[a.domain]) domainScores[a.domain] = { correct: 0, total: 0 }
      domainScores[a.domain].total++
      if (a.is_correct) domainScores[a.domain].correct++
    }

    supabase.from('user_test_sessions').insert({
      user_id: user.id,
      rw_score: finalScores.rw,
      math_score: finalScores.math,
      composite_score: finalScores.rw + finalScores.math,
      rw_higher_path: rwIsHigherPath,
      math_higher_path: mathIsHigherPath,
      total_time_seconds: totalTime,
      answers: allAnswers.current,
      domain_scores: domainScores,
    }).then(({ error }) => {
      if (error) console.error('Failed to save session:', error)
    })
  }, [currentModule, finalScores, user])

  // ── Complete Screen ─────────────────────────────────────────────────────
  if (currentModule === 'COMPLETE') {
    const answers = allAnswers.current
    const totalTime = Math.round((Date.now() - testStartTime.current) / 1000)
    const totalMins = Math.floor(totalTime / 60)
    const totalSecs = totalTime % 60
    const totalCorrect = answers.filter(a => a.is_correct).length
    const composite = finalScores ? finalScores.rw + finalScores.math : 0

    const resetTest = () => {
      allAnswers.current = []
      questionTimes.current = {}
      testStartTime.current = Date.now()
      setFinalScores(null)
      setRwM1Score(0)
      setMathM1Score(0)
      setCurrentModule('RW_M1')
    }

    return (
      <div className="min-h-screen bg-[#F3F4F6] text-black">
        {/* Results Header */}
        <div className="bg-[#242b35] text-white py-8 px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Full Adaptive SAT Complete</p>
          <h1 className="text-4xl font-black">Your Score Report</h1>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">

          {/* Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Reading &amp; Writing</p>
              <p className="text-6xl font-black text-[#004de6]">{finalScores?.rw ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-1">/ 800 &nbsp;·&nbsp; {rwIsHigherPath ? 'Higher Path' : 'Lower Path'}</p>
            </div>
            <div className="bg-[#f0f5ff] rounded-2xl border border-[#004de6]/20 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#004de6]/60 mb-2">Composite</p>
              <p className="text-6xl font-black text-[#004de6]">{composite}</p>
              <p className="text-xs text-[#004de6]/50 mt-1">/ 1600</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Math</p>
              <p className="text-6xl font-black text-[#004de6]">{finalScores?.math ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-1">/ 800 &nbsp;·&nbsp; {mathIsHigherPath ? 'Higher Path' : 'Lower Path'}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Questions Answered', val: answers.length },
              { label: 'Correct', val: `${totalCorrect} / ${answers.length}` },
              { label: 'Total Time', val: `${totalMins}m ${totalSecs}s` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-gray-800">{val}</p>
                <p className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {(['domains', 'review'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setResultsTab(tab)}
                className={`px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors ${
                  resultsTab === tab
                    ? 'bg-white border border-b-white border-gray-200 text-[#004de6]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'domains' ? 'Domain Breakdown' : `Answer Review (${answers.length})`}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            {resultsTab === 'domains' && <DomainBreakdown answers={answers} />}
            {resultsTab === 'review' && <AnswerReview answers={answers} />}
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center pb-8">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-50 transition-colors"
            >
              ← Back to Home
            </button>
            <button
              onClick={resetTest}
              className="px-8 py-3 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 transition-colors shadow-md"
            >
              Retake Test
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F3F4F6] text-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#004de6] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-gray-500">Loading Secure Test Environment…</span>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F3F4F6]">
        <div className="bg-white rounded-xl p-8 border border-red-200 text-center max-w-sm">
          <p className="text-red-600 font-bold text-lg mb-2">No Questions Found</p>
          <p className="text-gray-500 text-sm">
            The question bank returned 0 questions for <strong>{currentModule}</strong>.
            The scraper adds new questions every 15 minutes — try again shortly.
          </p>
          <button onClick={() => setCurrentModule('RW_M1')} className="mt-4 px-6 py-2 bg-[#004de6] text-white font-bold rounded-full text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentIndex]
  const moduleLabel = currentModule.replace(/_/g, ' ').replace('RW', 'R&W')
  const isLastQuestion = currentIndex === questions.length - 1
  const hasPassage = !!(currentQ.raw_original_text && currentQ.raw_original_text.trim().length > 20)
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F3F4F6] overflow-hidden font-sans text-black">

      {/* Header */}
      <header className="h-[60px] bg-[#242b35] text-white flex justify-between items-center px-6 shrink-0 shadow-md z-10">
        <span className="text-gray-300 text-xs font-bold tracking-widest uppercase">{moduleLabel}</span>
        <span className="text-gray-400 text-xs font-medium">{currentIndex + 1} / {questions.length}</span>
      </header>

      {/* Split Body */}
      <main className="flex-1 flex flex-row w-full max-w-[1600px] mx-auto p-4 gap-4 overflow-hidden">

        {/* Left Pane — Passage (only when passage exists) */}
        {hasPassage && (
          <div className="w-1/2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto p-8">
            <p className="text-base leading-[1.9] text-gray-800 whitespace-pre-wrap">{currentQ.raw_original_text}</p>
          </div>
        )}

        {/* Right Pane — Question + Options (full width if no passage) */}
        <div className={`${hasPassage ? 'w-1/2' : 'w-full max-w-3xl mx-auto'} bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto p-8 flex flex-col`}>
          <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-[#242b35] text-white text-sm font-bold mb-6 shrink-0">
            {currentIndex + 1}
          </div>

          <p className="text-lg font-medium leading-relaxed mb-8">{currentQ.question_text}</p>

          <div className="flex flex-col gap-3">
            {currentQ.options?.map((opt: string, idx: number) => {
              const letters = ['A', 'B', 'C', 'D']
              const isSelected = userAnswers[currentIndex] === opt
              return (
                <label
                  key={idx}
                  className={`group flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    isSelected ? 'border-[#004de6] bg-[#f0f5ff]' : 'border-gray-300 hover:border-[#004de6] bg-white'
                  }`}
                >
                  <input type="radio" name="answer" className="hidden" onChange={() => setUserAnswers(prev => ({ ...prev, [currentIndex]: opt }))} checked={isSelected} readOnly />
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold mr-4 shrink-0 text-sm transition-all ${
                    isSelected ? 'border-solid border-[#004de6] bg-[#004de6] text-white' : 'border-dashed border-gray-400 text-black group-hover:border-solid group-hover:border-[#004de6]'
                  }`}>
                    {letters[idx]}
                  </div>
                  <span className="text-base pt-0.5 leading-relaxed">{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-[72px] bg-white border-t border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="w-32 font-semibold text-gray-700 text-sm tracking-wide shrink-0 truncate">{userName}</div>

        {/* Question grid */}
        <div className="flex-1 flex justify-center items-center gap-1 overflow-x-auto px-4">
          {questions.map((_, idx) => {
            const isAnswered = !!userAnswers[idx]
            const isCurrent = currentIndex === idx
            return (
              <button
                key={idx}
                onClick={() => navigateTo(idx)}
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-[3px] border transition-colors shrink-0 ${
                  isCurrent ? 'bg-[#004de6] text-white border-[#004de6]' :
                  isAnswered ? 'bg-gray-200 text-black border-gray-400' :
                  'bg-white text-gray-700 border-gray-400 border-dashed hover:border-solid hover:border-gray-600'
                }`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="w-32 flex justify-end items-center gap-3 shrink-0">
          {currentIndex > 0 && (
            <button onClick={() => navigateTo(currentIndex - 1)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-full text-sm hover:bg-gray-200 transition-colors">
              Back
            </button>
          )}
          {isLastQuestion ? (
            <button onClick={submitModule} className="px-6 py-2 bg-green-600 text-white font-bold rounded-full text-sm hover:bg-green-700 shadow-md transition-colors">
              Submit
            </button>
          ) : (
            <button onClick={() => navigateTo(currentIndex + 1)} className="px-6 py-2 bg-[#004de6] text-white font-bold rounded-full text-sm hover:bg-blue-800 shadow-md transition-colors">
              Next
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
