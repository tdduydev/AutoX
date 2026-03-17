import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

interface ToastCtx {
    toast: (message: string, variant?: ToastVariant) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

// ── Context ─────────────────────────────────────────────────

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
    return ctx;
}

// ── Config ──────────────────────────────────────────────────

const ICONS: Record<ToastVariant, React.ReactNode> = {
    info: <Info size={16} className="text-cyan-400 shrink-0" />,
    success: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
    error: <XCircle size={16} className="text-destructive shrink-0" />,
};

const BG: Record<ToastVariant, string> = {
    info: 'border-cyan-500/30 bg-background-surface/95 shadow-[0_0_15px_rgba(6,182,212,0.1)]',
    success: 'border-emerald-500/30 bg-background-surface/95 shadow-[0_0_15px_rgba(52,211,153,0.1)]',
    warning: 'border-amber-500/30 bg-background-surface/95 shadow-[0_0_15px_rgba(251,191,36,0.1)]',
    error: 'border-destructive/30 bg-background-surface/95 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
};

const DURATION = 4000;

// ── Provider ────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts(ts => ts.filter(t => t.id !== id));
    }, []);

    const push = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = ++counter.current;
        setToasts(ts => [...ts, { id, message, variant }]);
        setTimeout(() => dismiss(id), DURATION);
    }, [dismiss]);

    const ctx: ToastCtx = {
        toast: push,
        success: (m) => push(m, 'success'),
        error: (m) => push(m, 'error'),
        warning: (m) => push(m, 'warning'),
        info: (m) => push(m, 'info'),
    };

    return (
        <Ctx.Provider value={ctx}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl text-sm text-foreground animate-slide-up ${BG[t.variant]}`}
                    >
                        {ICONS[t.variant]}
                        <span className="flex-1 font-medium">{t.message}</span>
                        <button onClick={() => dismiss(t.id)} className="text-foreground-muted hover:text-foreground transition-colors shrink-0">
                            <X size={15} />
                        </button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}
