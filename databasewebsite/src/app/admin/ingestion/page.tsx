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

            if (!res.ok) {
                throw new Error(json.error || "Failed to process image");
            }

            setSuccessData(json.data);

            // Auto clear after 4 seconds to allow rapid scanning
            setTimeout(() => {
                setSuccessData(null);
            }, 4000);

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
        if (file) {
            processFile(file);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Ingestion Dropzone</h1>
                <p className="text-muted-foreground mt-2">
                    Drag and drop a raw SAT question screenshot here. The Synthetic Spin engine will automatically generate a new variant and insert it into the database.
                </p>
            </div>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center p-12 mt-8 border-2 border-dashed rounded-xl transition-all duration-200 ${isDragging
                        ? "border-primary bg-primary/5"
                        : "border-slate-300 hover:border-primary/50 bg-white"
                    }`}
            >
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    {isSpinning ? (
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    ) : (
                        <UploadCloud className={`h-12 w-12 ${isDragging ? "text-primary" : "text-slate-400"}`} />
                    )}

                    <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-700">
                            {isSpinning ? "Synthesizing new question..." : "Drag & drop an image here"}
                        </p>
                        {!isSpinning && (
                            <p className="text-xs text-slate-500">
                                PNG, JPG, WEBP up to 5MB
                            </p>
                        )}
                    </div>

                    {!isSpinning && (
                        <div className="mt-4">
                            <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input bg-background hover:bg-slate-100 h-9 px-4 py-2">
                                Browse Files
                            </label>
                            <input
                                id="file-upload"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Status Messages */}
            {
                error && (
                    <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-medium text-red-800">Processing Error</h3>
                            <p className="mt-1 text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                )
            }

            {
                successData && (
                    <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-start space-x-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-emerald-800">
                                    Successfully synthesized and inserted!
                                </h3>

                                <div className="mt-4 bg-white rounded border border-emerald-100 p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                                            {successData.module} | {successData.difficulty}
                                        </span>
                                        <span className="text-xs text-slate-500">{successData.domain}</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-900 mt-2">{successData.question_text}</p>

                                    {successData.options && (
                                        <ul className="mt-4 space-y-2">
                                            {successData.options.map((opt: string, i: number) => (
                                                <li key={i} className="text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                                    <span className="font-medium mr-2">{String.fromCharCode(65 + i)})</span> {opt}
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-sm text-emerald-700">
                                            <span className="font-semibold">Correct Answer:</span> {successData.correct_answer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
