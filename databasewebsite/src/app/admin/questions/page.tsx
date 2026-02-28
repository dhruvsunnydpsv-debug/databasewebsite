"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
    Search, 
    Filter, 
    Plus, 
    MoreVertical, 
    ChevronLeft, 
    ChevronRight,
    Edit3,
    Trash2,
    Eye,
    CheckCircle,
    XCircle,
    Copy
} from 'lucide-react';

// --- Constants ---
const MODULES = ['Math', 'Reading_Writing'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const DOMAINS: Record<string, string[]> = {
    'Math': ['Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry'],
    'Reading_Writing': ['Information_and_Ideas', 'Craft_and_Structure', 'Expression_of_Ideas', 'Standard_English_Conventions']
};

interface Question {
    id: string;
    module: string;
    domain: string;
    difficulty: string;
    question_text: string;
    options: string[] | null;
    correct_answer: string;
    is_spr: boolean;
    is_enabled: boolean;
    created_at: string;
}

export default function QuestionsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <QuestionsList />
        </Suspense>
    );
}

function QuestionsList() {
    const searchParams = useSearchParams();
    const router = useRouter();
    
    // --- State ---
    const [questions, setQuestions] = useState<Question[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(15);
    
    // Filters
    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [domainFilter, setDomainFilter] = useState('');

    // --- Fetch Data ---
    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('sat_question_bank')
            .select('*', { count: 'exact' });

        if (search) query = query.ilike('question_text', `%${search}%`);
        if (moduleFilter) query = query.eq('module', moduleFilter);
        if (difficultyFilter) query = query.eq('difficulty', difficultyFilter);
        if (domainFilter) query = query.eq('domain', domainFilter);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count: totalCount } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (data) {
            setQuestions(data as Question[]);
            setCount(totalCount || 0);
        }
        setLoading(false);
    }, [page, pageSize, search, moduleFilter, difficultyFilter, domainFilter]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    // --- Actions ---
    const toggleEnabled = async (id: string, current: boolean) => {
        const { error } = await supabase
            .from('sat_question_bank')
            .update({ is_enabled: !current })
            .eq('id', id);
        
        if (!error) fetchQuestions();
    };

    const deleteQuestion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this question?')) return;
        const { error } = await supabase
            .from('sat_question_bank')
            .delete()
            .eq('id', id);
        
        if (!error) fetchQuestions();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Question Repository</h1>
                    <p style={{ color: '#888880', fontSize: '0.95rem' }}>Manage and monitor the scale of your question bank ({count.toLocaleString()} items).</p>
                </div>
                <button 
                    onClick={() => alert('CMS Modal for Create not implemented yet - use Bulk Upload or SQL for now')}
                    style={{
                        backgroundColor: '#0D0D0D',
                        color: '#FBFBF2',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '9999px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={20} />
                    New Question
                </button>
            </div>

            {/* --- Filters Bar --- */}
            <div style={{ 
                backgroundColor: '#FFF', 
                border: '1px solid #D0D0C8', 
                padding: '1rem', 
                borderRadius: '12px', 
                display: 'flex', 
                gap: '1rem', 
                marginBottom: '2rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#888880' }} />
                    <input 
                        type="text" 
                        placeholder="Search question text..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.625rem 1rem 0.625rem 2.5rem',
                            border: '1px solid #D0D0C8',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    />
                </div>
                
                <select 
                    value={moduleFilter}
                    onChange={(e) => { setModuleFilter(e.target.value); setDomainFilter(''); }}
                    style={{ padding: '0.625rem', border: '1px solid #D0D0C8', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                    <option value="">All Modules</option>
                    {MODULES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>

                <select 
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                    style={{ padding: '0.625rem', border: '1px solid #D0D0C8', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                    <option value="">All Difficulties</option>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                {moduleFilter && (
                    <select 
                        value={domainFilter}
                        onChange={(e) => setDomainFilter(e.target.value)}
                        style={{ padding: '0.625rem', border: '1px solid #D0D0C8', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                        <option value="">All Domains</option>
                        {DOMAINS[moduleFilter].map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                    </select>
                )}
            </div>

            {/* --- Table --- */}
            <div style={{ 
                backgroundColor: '#FFF', 
                border: '1px solid #D0D0C8', 
                borderRadius: '16px', 
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F5F5ED', borderBottom: '1px solid #D0D0C8' }}>
                        <tr>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#888880' }}>Question Content</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#888880' }}>Category</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#888880' }}>Difficulty</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#888880' }}>Status</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#888880' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#888880' }}>Loading content...</td></tr>
                        ) : questions.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#888880' }}>No questions found matching criteria.</td></tr>
                        ) : questions.map((q) => (
                            <tr key={q.id} style={{ borderBottom: '1px solid #F0F0F0', transition: 'background 0.2s' }}>
                                <td style={{ padding: '1.25rem 1.5rem', maxWidth: '400px' }}>
                                    <div style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        fontSize: '0.875rem',
                                        lineHeight: 1.5,
                                        marginBottom: '0.5rem'
                                    }}>
                                        {q.question_text}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#D0D0C8', fontFamily: 'monospace' }}>{q.id}</span>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block' }}>{q.module.replace('_', ' ')}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#888880' }}>{q.domain.replace(/_/g, ' ')}</span>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <span style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 700, 
                                        backgroundColor: q.difficulty === 'Hard' ? '#FFE0E0' : q.difficulty === 'Medium' ? '#FFF3D0' : '#D5F0E6',
                                        color: q.difficulty === 'Hard' ? '#C0392B' : q.difficulty === 'Medium' ? '#D35400' : '#27AE60',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '9999px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {q.difficulty}
                                    </span>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <button 
                                        onClick={() => toggleEnabled(q.id, q.is_enabled)}
                                        style={{
                                            border: 'none',
                                            background: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            cursor: 'pointer',
                                            color: q.is_enabled !== false ? '#2ECC71' : '#E74C3C',
                                            fontWeight: 600,
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {q.is_enabled !== false ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                        {q.is_enabled !== false ? 'Active' : 'Disabled'}
                                    </button>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button title="Preview" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888880' }}><Eye size={18} /></button>
                                        <button title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888880' }}><Edit3 size={18} /></button>
                                        <button onClick={() => deleteQuestion(q.id)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#E74C3C' }}><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- Pagination --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#888880' }}>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, count)} of {count.toLocaleString()} results
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        style={{
                            padding: '0.5rem',
                            border: '1px solid #D0D0C8',
                            backgroundColor: '#FFF',
                            borderRadius: '8px',
                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                            opacity: page === 1 ? 0.5 : 1
                        }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                        disabled={page * pageSize >= count}
                        onClick={() => setPage(p => p + 1)}
                        style={{
                            padding: '0.5rem',
                            border: '1px solid #D0D0C8',
                            backgroundColor: '#FFF',
                            borderRadius: '8px',
                            cursor: page * pageSize >= count ? 'not-allowed' : 'pointer',
                            opacity: page * pageSize >= count ? 0.5 : 1
                        }}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
