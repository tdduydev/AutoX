import React from 'react';
import { Search } from 'lucide-react';

// ── Input ───────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-semibold tracking-wide text-foreground-muted">{label}</label>}
            <input
                id={fieldId}
                className={`w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 ${error ? 'border-destructive' : 'border-border hover:border-border-hover'} ${className}`}
                {...rest}
            />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>
    );
}

// ── Textarea ────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({ label, error, className = '', id, ...rest }: TextareaProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-semibold tracking-wide text-foreground-muted">{label}</label>}
            <textarea
                id={fieldId}
                className={`w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 resize-none ${error ? 'border-destructive' : 'border-border hover:border-border-hover'} ${className}`}
                {...rest}
            />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
        </div>
    );
}

// ── Select ──────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', id, ...rest }: SelectProps) {
    const fieldId = id ?? label?.toLowerCase().replace(/\s/g, '-');
    return (
        <div className="space-y-1.5">
            {label && <label htmlFor={fieldId} className="block text-xs font-semibold tracking-wide text-foreground-muted">{label}</label>}
            <select
                id={fieldId}
                className={`w-full bg-background border border-border hover:border-border-hover rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 ${className}`}
                {...rest}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── SearchInput ─────────────────────────────────────────────

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    onSearch?: (value: string) => void;
}

export function SearchInput({ className = '', onSearch, onChange, ...rest }: SearchInputProps) {
    return (
        <div className={`relative group ${className}`}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted group-focus-within:text-primary transition-colors" />
            <input
                type="text"
                className="w-full bg-background border border-border hover:border-border-hover rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200"
                onChange={(e) => { onChange?.(e); onSearch?.(e.target.value); }}
                {...rest}
            />
        </div>
    );
}
