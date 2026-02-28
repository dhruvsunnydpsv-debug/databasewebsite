"use client";
export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    Upload, 
    FileText, 
    CheckCircle, 
    XCircle, 
    AlertTriangle,
    Info,
    ArrowRight
} from 'lucide-react';

interface ValidationResult {
    total: number;
    validRows: any[];
    errors: string[];
}

export default function BulkUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile);
            setResult(null);
            setSuccess(null);
        } else {
            alert('Please select a valid CSV file.');
        }
    };

    const parseCSV = (content: string) => {
        const lines = content.split(/\r?\n/);
        if (lines.length < 2) return { headers: [], rows: [] };
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Basic CSV parser (handles quoted values)
            const row: string[] = [];
            let inQuotes = false;
            let currentValue = '';
            
            for (let char of lines[i]) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    row.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            row.push(currentValue.trim());
            
            const obj: any = {};
            headers.forEach((h, idx) => {
                obj[h] = row[idx];
            });
            rows.push(obj);
        }
        return { headers, rows };
    };

    const validateData = async () => {
        if (!file) return;
        setParsing(true);
        
        const text = await file.text();
        const { rows } = parseCSV(text);
        
        const validRows: any[] = [];
        const errors: string[] = [];
        
        rows.forEach((row, index) => {
            const lineNum = index + 2;
            const required = ['module', 'domain', 'difficulty', 'question_text', 'correct_answer'];
            const missing = required.filter(f => !row[f]);
            
            if (missing.length > 0) {
                errors.push(`Row ${lineNum}: Missing required fields (${missing.join(', ')})`);
                return;
            }

            // Validate Module
            if (!['Math', 'Reading_Writing'].includes(row.module)) {
                errors.push(`Row ${lineNum}: Invalid module '${row.module}'`);
                return;
            }

            // Validate Difficulty
            if (!['Easy', 'Medium', 'Hard'].includes(row.difficulty)) {
                errors.push(`Row ${lineNum}: Invalid difficulty '${row.difficulty}'`);
                return;
            }

            // Options parsing (assume comma-separated or JSON string)
            let options = null;
            if (row.is_spr !== 'true' && row.is_spr !== '1') {
                if (row.options) {
                    try {
                        options = row.options.startsWith('[') ? JSON.parse(row.options) : row.options.split('|').map((o: string) => o.trim());
                    } catch (e) {
                        errors.push(`Row ${lineNum}: Failed to parse options JSON`);
                        return;
                    }
                }
            }

            validRows.push({
                module: row.module,
                domain: row.domain,
                difficulty: row.difficulty,
                question_text: row.question_text,
                is_spr: row.is_spr === 'true' || row.is_spr === '1',
                options: options,
                correct_answer: row.correct_answer,
                rationale: row.rationale || '',
                source_method: 'Admin_Dropzone'
            });
        });

        setResult({ total: rows.length, validRows, errors });
        setParsing(false);
    };

    const handleUpload = async () => {
        if (!result || result.validRows.length === 0) return;
        setUploading(true);
        
        const { error } = await supabase
            .from('sat_question_bank')
            .insert(result.validRows);

        if (error) {
            alert('Upload failed: ' + error.message);
        } else {
            setSuccess(`Successfully uploaded ${result.validRows.length} questions!`);
            setResult(null);
            setFile(null);
        }
        setUploading(false);
    };

    return (
        <div>
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>Bulk Ingestion</h1>
                <p style={{ color: '#888880', fontSize: '0.95rem' }}>Upload CSV files to populate thousands of questions instantly.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '3rem' }}>
                {/* Upload Zone */}
                <div>
                    {!success && !result && (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed #D0D0C8',
                                borderRadius: '24px',
                                padding: '4rem 2rem',
                                textAlign: 'center',
                                backgroundColor: '#FAFAF2',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginBottom: '2rem'
                            }}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept=".csv" 
                                style={{ display: 'none' }} 
                            />
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: '#FFF',
                                border: '1px solid #D0D0C8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: '#888880'
                            }}>
                                <Upload size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{file ? file.name : 'Click to Upload CSV'}</h3>
                            <p style={{ fontSize: '0.85rem', color: '#888880' }}>Only .csv files are supported. Max file size: 10MB.</p>
                        </div>
                    )}

                    {file && !result && !success && (
                        <button 
                            onClick={validateData}
                            disabled={parsing}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                backgroundColor: '#0D0D0D',
                                color: '#FBFBF2',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            {parsing ? 'Parsing Data...' : 'Validate and Preview'}
                        </button>
                    )}

                    {result && (
                        <div style={{ 
                            backgroundColor: '#FFF', 
                            border: '1px solid #D0D0C8', 
                            borderRadius: '16px', 
                            padding: '1.5rem' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Validation Results</h3>
                                <button 
                                    onClick={() => setResult(null)} 
                                    style={{ background: 'none', border: 'none', color: '#888880', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                    Cancel
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                                <div style={{ flex: 1, padding: '1rem', backgroundColor: '#F5F5ED', borderRadius: '12px' }}>
                                    <p style={{ fontSize: '0.7rem', color: '#888880', margin: '0 0 0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Total Found</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{result.total}</p>
                                </div>
                                <div style={{ flex: 1, padding: '1rem', backgroundColor: '#EFFFF4', borderRadius: '12px', border: '1px solid #2ECC71' }}>
                                    <p style={{ fontSize: '0.7rem', color: '#27AE60', margin: '0 0 0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Valid Rows</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#27AE60', margin: 0 }}>{result.validRows.length}</p>
                                </div>
                            </div>

                            {result.errors.length > 0 && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#E74C3C', marginBottom: '0.75rem' }}>
                                        <XCircle size={18} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Found {result.errors.length} Errors</span>
                                    </div>
                                    <div style={{ 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        backgroundColor: '#FFF8F8', 
                                        padding: '1rem', 
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        color: '#C0392B',
                                        lineHeight: 1.6
                                    }}>
                                        {result.errors.map((err, i) => <div key={i}>• {err}</div>)}
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleUpload}
                                disabled={uploading || result.validRows.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    backgroundColor: result.validRows.length > 0 ? '#0D0D0D' : '#D0D0C8',
                                    color: '#FBFBF2',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    cursor: uploading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {uploading ? 'Processing Transaction...' : `Confirm Upload (${result.validRows.length} items)`}
                            </button>
                        </div>
                    )}

                    {success && (
                        <div style={{ 
                            backgroundColor: '#EFFFF4', 
                            border: '1px solid #2ECC71', 
                            borderRadius: '16px', 
                            padding: '3rem',
                            textAlign: 'center'
                        }}>
                            <CheckCircle size={48} color="#27AE60" style={{ margin: '0 auto 1.5rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Upload Complete</h3>
                            <p style={{ color: '#27AE60', marginBottom: '2rem' }}>{success}</p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button onClick={() => setSuccess(null)} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #2ECC71', backgroundColor: 'transparent', color: '#27AE60', cursor: 'pointer' }}>Upload Another</button>
                                <button onClick={() => window.location.href = '/admin/questions'} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#2ECC71', color: '#FFF', cursor: 'pointer' }}>View Questions</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                <div>
                    <div style={{ backgroundColor: '#FFF', padding: '2rem', borderRadius: '16px', border: '1px solid #D0D0C8' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info size={20} />
                            Ingestion Standards
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#555550', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                            To maintain database integrity, your CSV must follow the official schema. Incorrect modules or domains will be rejected by the validation engine.
                        </p>
                        
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ minWidth: '80px', fontWeight: 700 }}>module</div>
                                <div style={{ color: '#888880' }}>"Math" or "Reading_Writing"</div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ minWidth: '80px', fontWeight: 700 }}>difficulty</div>
                                <div style={{ color: '#888880' }}>"Easy", "Medium", "Hard"</div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ minWidth: '80px', fontWeight: 700 }}>options</div>
                                <div style={{ color: '#888880' }}>Pipe-separated list: "Option A | Option B | Option C | Option D"</div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ minWidth: '80px', fontWeight: 700 }}>is_spr</div>
                                <div style={{ color: '#888880' }}>"true" for Student-Produced Response</div>
                            </div>
                        </div>

                        <div style={{ 
                            marginTop: '2rem', 
                            padding: '1rem', 
                            backgroundColor: '#F5F5ED', 
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FileText size={20} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sample Template</span>
                            </div>
                            <button style={{ 
                                padding: '0.4rem 0.8rem', 
                                border: '1px solid #0D0D0D', 
                                background: 'transparent',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
