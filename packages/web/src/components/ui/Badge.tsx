import React from 'react';

// ── Badge ───────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const badgeStyles: Record<BadgeVariant, string> = {
    default: 'bg-background-soft/80 text-foreground-muted border-border',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-md border ${badgeStyles[variant]} ${className}`}>
            {children}
        </span>
    );
}

// ── StatusDot ───────────────────────────────────────────────

interface StatusDotProps {
    status: 'healthy' | 'unhealthy' | 'warning' | 'unknown' | 'active' | 'inactive';
    size?: number;
    pulse?: boolean;
}

const dotColors: Record<string, string> = {
    healthy: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    active: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    unhealthy: 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    inactive: 'bg-destructive',
    warning: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
    unknown: 'bg-foreground-muted',
};

export function StatusDot({ status, size = 8, pulse = false }: StatusDotProps) {
    return (
        <span className="relative inline-flex">
            <span
                className={`inline-block rounded-full ${dotColors[status] ?? 'bg-foreground-muted'}`}
                style={{ width: size, height: size }}
            />
            {pulse && (status === 'healthy' || status === 'active') && (
                <span
                    className={`absolute inset-0 rounded-full ${dotColors[status].split(' ')[0]} animate-ping opacity-75`}
                    style={{ width: size, height: size }}
                />
            )}
        </span>
    );
}
