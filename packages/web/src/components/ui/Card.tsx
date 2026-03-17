import React from 'react';
import type { LucideIcon } from 'lucide-react';

// ── Card ────────────────────────────────────────────────────

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
    return (
        <div className={`glass-panel rounded-xl shadow-glass-sm ${padding ? 'p-5' : ''} ${className}`}>
            {children}
        </div>
    );
}

// ── StatCard ────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    iconColor?: string;
    change?: string;
    changeType?: 'up' | 'down' | 'neutral';
    className?: string;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-primary-light', change, changeType = 'neutral', className = '' }: StatCardProps) {
    const changeColors = { up: 'text-emerald-400', down: 'text-destructive', neutral: 'text-foreground-muted' };
    return (
        <div className={`glass-panel rounded-xl p-5 shadow-glass-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-glow hover:shadow-primary/5 ${className}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-foreground-muted font-bold tracking-wide uppercase mb-1">{label}</p>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
                    {change && (
                        <p className={`text-xs mt-1.5 font-medium ${changeColors[changeType]}`}>{change}</p>
                    )}
                </div>
                {Icon && (
                    <div className={`p-2.5 rounded-xl bg-background/50 border border-border/50 shadow-inner ${iconColor}`}>
                        <Icon size={20} />
                    </div>
                )}
            </div>
        </div>
    );
}
