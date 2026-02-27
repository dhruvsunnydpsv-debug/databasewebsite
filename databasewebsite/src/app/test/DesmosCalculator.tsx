"use client";

import { useEffect, useRef, useState } from "react";

interface DesmosCalculatorProps {
    position: { x: number; y: number };
    onMove: (pos: { x: number; y: number }) => void;
    onClose: () => void;
}

declare global {
    interface Window {
        Desmos: any;
    }
}

export default function DesmosCalculator({ position, onMove, onClose }: DesmosCalculatorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const calcRef = useRef<any>(null);
    const dragState = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({
        dragging: false, startX: 0, startY: 0, originX: 0, originY: 0,
    });
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Load Desmos script once
        if (document.getElementById("desmos-script")) {
            initDesmos();
            return;
        }
        const script = document.createElement("script");
        script.id = "desmos-script";
        script.src = "https://www.desmos.com/api/v1.9/calculator.js?apiKey=8070e617ff6145e8ab4d323341f3d29d";
        script.async = true;
        script.onload = () => initDesmos();
        document.head.appendChild(script);
        return () => {
            if (calcRef.current) { calcRef.current.destroy(); calcRef.current = null; }
        };
    }, []);

    const initDesmos = () => {
        if (!containerRef.current || calcRef.current) return;
        try {
            calcRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
                keypad: true, expressions: true, settingsMenu: false, zoomButtons: true,
            });
            setLoaded(true);
        } catch (e) {
            console.error("Desmos init failed:", e);
        }
    };

    // ── Drag logic ──────────────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
        const onMouseMove = (ev: MouseEvent) => {
            if (!dragState.current.dragging) return;
            const dx = ev.clientX - dragState.current.startX;
            const dy = ev.clientY - dragState.current.startY;
            onMove({ x: dragState.current.originX + dx, y: dragState.current.originY + dy });
        };
        const onMouseUp = () => {
            dragState.current.dragging = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    return (
        <div
            style={{
                position: "fixed",
                left: position.x,
                top: position.y,
                zIndex: 1000,
                boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #2d3748",
                width: "600px",
                userSelect: "none",
            }}
        >
            {/* ── Drag Handle Bar ─────────────────────────── */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    backgroundColor: "#1a1a2e",
                    color: "#e2e8f0",
                    padding: "0.5rem 0.875rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "grab",
                    userSelect: "none",
                    fontSize: "0.8rem",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                }}
            >
                <span>📊 Graphing Calculator</span>
                <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={onClose}
                    style={{ background: "none", border: "none", color: "#e2e8f0", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 2px" }}
                    aria-label="Close calculator"
                >
                    ✕
                </button>
            </div>
            {/* ── Desmos Mount Point ────────────────────── */}
            <div
                ref={containerRef}
                style={{ width: "600px", height: "420px", backgroundColor: "#fff" }}
            />
            {!loaded && (
                <div style={{
                    position: "absolute", inset: "40px 0 0 0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: "#f8f9fa", color: "#555", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem",
                }}>
                    Loading calculator…
                </div>
            )}
        </div>
    );
}
