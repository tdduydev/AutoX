import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
    primary: 'bg-gradient-to-r from-primary to-secondary hover:from-primary-600 hover:to-secondary-600 text-white shadow-glow shadow-primary/20 border border-white/10 hover:shadow-primary/30',
    secondary: 'bg-background-surface hover:bg-background-hover text-foreground border border-border shadow-sm',
    danger: 'bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 shadow-sm',
    ghost: 'hover:bg-background-hover text-foreground-muted hover:text-foreground',
};

const sizeStyles: Record<Size, string> = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
};

export function Button({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading,
    disabled,
    children,
    className = '',
    ...rest
}: ButtonProps) {
    const iconSize = size === 'sm' ? 14 : 16;
    return (
        <button
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...rest}
        >
            {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} />}
            {children}
            {IconRight && !loading && <IconRight size={iconSize} />}
        </button>
    );
}
