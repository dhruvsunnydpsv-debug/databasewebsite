"use client";

import { useState, useCallback } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function IngestionPage() {
    const [isDragging, setIsDragging] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successData, setSuccessData] = useState<any | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please drop a valid image file (.png, .jpg).");
            return;
        }
        setError(null);
        setSuccessData(null);
        setIsSpinning(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/spin", {
                method: "POST",
                body: formData,
            });

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
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem' }}>

            {/* ── Page Header ─────────────────────────────────── */}
            <div style={{ marginBottom: '2.5rem' }}>
                <span style={{
                    display: 'inline-block',
                    backgroundColor: '#E6D5F8',
                    border: '1px solid #0D0D0D',
                    borderRadius: '9999px',
                    padding: '0.2rem 0.75rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '1rem',
                }}>
                    Admin — Ingestion Engine
                </span>
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    color: '#0D0D0D',
                    marginBottom: '0.75rem',
                }}>
                    Question Dropzone
                </h1>
                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.9rem',
                    lineHeight: 1.7,
                    color: '#555550',
                    maxWidth: '520px',
                }}>
                    Drop a raw SAT screenshot below. The Synthetic Spin engine will apply
                    the <em>Paint vs. Engine</em> doctrine and insert a copyright-free variant into the database.
                </p>
            </div>

            {/* ── Dropzone ─────────────────────────────────────── */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3.5rem 2rem',
                    border: isDragging ? '2px dashed #7C4DFF' : '2px dashed #0D0D0D',
                    borderRadius: '12px',
                    backgroundColor: isDragging ? '#F0E8FF' : '#FAFAF2',
                    cursor: 'default',
                    transition: 'all 0.2s ease',
                    marginBottom: '1.5rem',
                }}
            >
                {isSpinning ? (
                    <Loader2
                        style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            color: '#7C4DFF',
                            animation: 'spin 1s linear infinite',
                        }}
                    />
                ) : (
                    <UploadCloud style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        color: isDragging ? '#7C4DFF' : '#888880',
                        marginBottom: '1rem',
                        transition: 'color 0.2s ease',
                    }} />
                )}

                <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: '#0D0D0D',
                    marginBottom: '0.25rem',
                }}>
                    {isSpinning ? "Synthesizing variant…" : "Drag & drop a question screenshot"}
                </p>

                {!isSpinning && (
                    <>
                        <p style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '0.75rem',
                            color: '#888880',
                            marginBottom: '1.5rem',
                        }}>
                            PNG, JPG, WEBP — up to 5 MB
                        </p>
                        <div>
                            <label
                                htmlFor="file-upload"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#E6D5F8',
                                    color: '#0D0D0D',
                                    border: '1px solid #0D0D0D',
                                    borderRadius: '9999px',
                                    padding: '0.55rem 1.5rem',
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: '0.825rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                }}
                            >
                                Browse Files
                            </label>
                            <input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* ── Error State ──────────────────────────────────── */}
            {error && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem 1.25rem',
                    backgroundColor: '#FFF5F5',
                    border: '1px solid #0D0D0D',
                    borderRadius: '10px',
                    marginBottom: '1.5rem',
                }}>
                    <AlertCircle style={{ width: '1.1rem', height: '1.1rem', color: '#C0392B', flexShrink: 0, marginTop: '1px' }} />
                    <div>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#0D0D0D', marginBottom: '0.15rem' }}>
                            Processing Error
                        </p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#555550' }}>{error}</p>
                    </div>
                </div>
            )}

            {/* ── Success Output ───────────────────────────────── */}
            {successData && (
                <div style={{
                    padding: '1.5rem',
                    border: '1px solid #0D0D0D',
                    borderRadius: '12px',
                    backgroundColor: '#F5FFF7',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem', color: '#2ECC71' }} />
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#0D0D0D' }}>
                            Synthesized & inserted into database
                        </p>
                    </div>

                    {/* Meta Badges */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        {[successData.module, successData.difficulty, successData.domain].filter(Boolean).map((tag: string) => (
                            <span key={tag} style={{
                                display: 'inline-block',
                                backgroundColor: '#E6D5F8',
                                border: '1px solid #0D0D0D',
                                borderRadius: '9999px',
                                padding: '0.15rem 0.65rem',
                                fontSize: '0.65rem',
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Question Text */}
                    <p style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '1rem',
                        fontWeight: 500,
                        lineHeight: 1.65,
                        color: '#0D0D0D',
                        marginBottom: '1.25rem',
                    }}>
                        {successData.question_text}
                    </p>

                    {/* Options */}
                    {successData.options && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {successData.options.map((opt: string, i: number) => (
                                <li key={i} style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: '0.625rem',
                                    padding: '0.6rem 0.875rem',
                                    border: '1px solid #D0D0C8',
                                    borderRadius: '8px',
                                    backgroundColor: '#FDFDF5',
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: '0.85rem',
                                    color: '#0D0D0D',
                                }}>
                                    <span style={{ fontWeight: 700, minWidth: '1.2rem' }}>{String.fromCharCode(65 + i)}.</span>
                                    {opt}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Correct Answer */}
                    {successData.correct_answer && (
                        <div style={{
                            paddingTop: '1rem',
                            borderTop: '1px solid #D0D0C8',
                        }}>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#0D0D0D' }}>
                                <strong>Correct Answer:</strong> {successData.correct_answer}
                            </p>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
