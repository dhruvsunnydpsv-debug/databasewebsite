"use client";

import { useState, useCallback } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ShieldAlert } from "lucide-react";

export default function AdminIngestPage() {
    const [isDragging, setIsDragging] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<any | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
    }, []);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please drop a valid image file (.png, .jpg).");
            return;
        }
        setError(null); setSuccessData(null); setIsSpinning(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/spin", { method: "POST", body: formData });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to process image");
            setSuccessData(json.data);
            setTimeout(() => setSuccessData(null), 6000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSpinning(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 1.5rem' }}>

            {/* ── Admin Portal Banner ──────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                backgroundColor: '#FFF0F0', border: '1px solid #C0392B',
                borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '2rem',
            }}>
                <ShieldAlert style={{ width: '1rem', height: '1rem', color: '#C0392B', flexShrink: 0 }} />
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C0392B', margin: 0 }}>
                    ADMIN PORTAL — INGESTION ENGINE — SECURE ZONE
                </p>
            </div>

            {/* ── Page Header ─────────────────────────────────── */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(1.8rem, 5vw, 2.75rem)',
                    fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#0D0D0D', marginBottom: '0.6rem',
                }}>
                    Question Dropzone
                </h1>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', lineHeight: 1.7, color: '#555550', maxWidth: '520px' }}>
                    Drop a source screenshot below. The pipeline will generate a canonical variant and persist it to the question bank.
                </p>
            </div>

            {/* ── Dropzone ─────────────────────────────────────── */}
            <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '3.5rem 2rem',
                    border: isDragging ? '2px dashed #7C4DFF' : '2px dashed #0D0D0D',
                    borderRadius: '12px',
                    backgroundColor: isDragging ? '#F0E8FF' : '#FAFAF2',
                    transition: 'all 0.2s ease', marginBottom: '1.5rem', cursor: 'default',
                }}
            >
                {isSpinning ? (
                    <Loader2 style={{ width: '2.5rem', height: '2.5rem', color: '#7C4DFF', animation: 'spin 1s linear infinite' }} />
                ) : (
                    <UploadCloud style={{ width: '2.5rem', height: '2.5rem', color: isDragging ? '#7C4DFF' : '#888880', marginBottom: '1rem', transition: 'color 0.2s ease' }} />
                )}
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.9rem', fontWeight: 500, color: '#0D0D0D', marginBottom: '0.25rem' }}>
                    {isSpinning ? "Processing…" : "Drag & drop a question screenshot"}
                </p>
                {!isSpinning && (
                    <>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#888880', marginBottom: '1.5rem' }}>PNG, JPG, WEBP — up to 5 MB</p>
                        <div>
                            <label htmlFor="file-upload" style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: '#E6D5F8', color: '#0D0D0D', border: '1px solid #0D0D0D',
                                borderRadius: '9999px', padding: '0.55rem 1.5rem',
                                fontFamily: "'Inter', sans-serif", fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer',
                            }}>
                                Browse Files
                            </label>
                            <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </div>
                    </>
                )}
            </div>

            {/* ── Error ─────────────────────────────────────────── */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.25rem', backgroundColor: '#FFF5F5', border: '1px solid #0D0D0D', borderRadius: '10px', marginBottom: '1.5rem' }}>
                    <AlertCircle style={{ width: '1.1rem', height: '1.1rem', color: '#C0392B', flexShrink: 0, marginTop: '1px' }} />
                    <div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#0D0D0D', marginBottom: '0.15rem' }}>Error</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#555550' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* ── Success ───────────────────────────────────────── */}
            {successData && (
                <div style={{ padding: '1.5rem', border: '1px solid #0D0D0D', borderRadius: '12px', backgroundColor: '#F5FFF7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem', color: '#2ECC71' }} />
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#0D0D0D' }}>Inserted into question bank</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                        {[successData.module, successData.difficulty, successData.domain].filter(Boolean).map((tag: string) => (
                            <span key={tag} style={{ backgroundColor: '#E6D5F8', border: '1px solid #0D0D0D', borderRadius: '9999px', padding: '0.1rem 0.6rem', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>{tag}</span>
                        ))}
                    </div>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 500, lineHeight: 1.65, color: '#0D0D0D', marginBottom: '1rem' }}>{successData.question_text}</p>
                    {successData.options && (
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                            {successData.options.map((opt: string, i: number) => (
                                <li key={i} style={{ padding: '0.55rem 0.875rem', border: '1px solid #D0D0C8', borderRadius: '7px', backgroundColor: '#FDFDF5', fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', color: '#0D0D0D' }}>
                                    <strong style={{ marginRight: '0.5rem' }}>{String.fromCharCode(65 + i)}.</strong>{opt}
                                </li>
                            ))}
                        </ul>
                    )}
                    {successData.correct_answer && (
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#0D0D0D', borderTop: '1px solid #D0D0C8', paddingTop: '0.875rem' }}>
                            <strong>Answer:</strong> {successData.correct_answer}
                        </p>
                    )}
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
