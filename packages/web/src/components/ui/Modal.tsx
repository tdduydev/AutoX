import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

// ── Modal ───────────────────────────────────────────────────

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className={`w-full ${sizeMap[size]} bg-background-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden`}>
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border/50">
                    <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
                        {subtitle && <p className="text-sm font-medium text-foreground-muted mt-1">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 ml-4 rounded-lg text-foreground-muted hover:text-white hover:bg-background-hover/50 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                {/* Body */}
                <div className="p-6 max-h-[65vh] overflow-y-auto custom-scrollbar">{children}</div>
                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50 bg-background/50">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── ConfirmDialog ───────────────────────────────────────────

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', variant = 'danger', loading }: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm" footer={
            <>
                <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
            </>
        }>
            <p className="text-sm font-medium text-foreground-muted">{description}</p>
        </Modal>
    );
}
