'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Session = {
  id: string;
  rw_score: number;
  math_score: number;
  composite_score: number;
  rw_higher_path: boolean;
  math_higher_path: boolean;
  total_time_seconds: number;
  domain_scores: Record<string, { correct: number; total: number }>;
  answers: { domain: string; difficulty: string; is_correct: boolean }[];
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function ScoreBadge({ score, max = 800 }: { score: number; max?: number }) {
  const pct = score / max;
  const color = pct >= 0.85 ? 'text-green-600' : pct >= 0.65 ? 'text-yellow-600' : 'text-red-500';
  return <span className={`text-3xl font-black ${color}`}>{score}</span>;
}

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      supabase
        .from('user_test_sessions')
        .select('*')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data: rows, error }) => {
          if (!error && rows) setSessions(rows as Session[]);
          setLoading(false);
        });
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#FBFBF2] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#004de6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const bestComposite = sessions.length > 0 ? Math.max(...sessions.map(s => s.composite_score)) : null;
  const avgComposite = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + s.composite_score, 0) / sessions.length)
    : null;

  return (
    <div className="min-h-screen bg-[#FBFBF2] text-[#0D0D0D]">
      {/* Nav */}
      <nav className="w-full h-[70px] flex items-center justify-between px-6 sm:px-10 border-b border-black/5 bg-[#FBFBF2]/90 backdrop-blur-md sticky top-0 z-50">
        <a href="/" className="font-serif text-2xl font-black tracking-tighter">SAT Engine</a>
        <div className="flex items-center gap-4">
          <a href="/test/session" className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full text-sm font-bold hover:bg-black transition-all">
            New Test →
          </a>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tighter mb-1">Score History</h1>
          <p className="text-gray-500 text-sm">
            {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'} · {sessions.length} test{sessions.length !== 1 ? 's' : ''} taken
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-bold text-xl mb-2">No tests yet</p>
            <p className="text-gray-500 text-sm mb-6">Complete a full adaptive test to see your results here.</p>
            <a href="/test/session" className="inline-block px-8 py-3 bg-[#004de6] text-white font-bold rounded-full hover:bg-blue-800 transition-colors">
              Start Your First Test
            </a>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Best Score', val: bestComposite, suffix: '/ 1600' },
                { label: 'Avg Score', val: avgComposite, suffix: '/ 1600' },
                { label: 'Tests Taken', val: sessions.length, suffix: '' },
              ].map(({ label, val, suffix }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm">
                  <p className="text-3xl font-black text-[#004de6]">{val}</p>
                  {suffix && <p className="text-xs text-gray-400 mt-0.5">{suffix}</p>}
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-3">
              {sessions.map((s) => {
                const isOpen = expanded === s.id;
                const correct = s.answers?.filter(a => a.is_correct).length ?? 0;
                const total = s.answers?.length ?? 0;
                const domains = Object.entries(s.domain_scores || {}).sort((a, b) => {
                  const pa = a[1].total > 0 ? a[1].correct / a[1].total : 0;
                  const pb = b[1].total > 0 ? b[1].correct / b[1].total : 0;
                  return pa - pb;
                });

                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                      className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[60px]">
                          <ScoreBadge score={s.composite_score} max={1600} />
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Composite</p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="font-bold text-gray-700">{s.rw_score}</span>
                            <span className="text-gray-400 text-xs ml-1">R&W</span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-700">{s.math_score}</span>
                            <span className="text-gray-400 text-xs ml-1">Math</span>
                          </div>
                        </div>
                        <div className="hidden sm:block text-xs text-gray-400">
                          {correct}/{total} correct · {formatTime(s.total_time_seconds)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 hidden sm:block">{formatDate(s.created_at)}</span>
                        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-6 pb-6 pt-4 bg-white">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Domain Breakdown</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {domains.map(([domain, stats]) => {
                            const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                            const color = pct >= 70 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';
                            return (
                              <div key={domain} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                                <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">{domain}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-gray-400">{stats.correct}/{stats.total}</span>
                                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
