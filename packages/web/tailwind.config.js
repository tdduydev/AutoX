/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // Backgrounds (deep sophisticated darks)
                background: {
                    DEFAULT: '#09090b', // zinc-950
                    surface: '#18181b', // zinc-900
                    soft: '#27272a',    // zinc-800
                    hover: '#3f3f46',   // zinc-700
                },
                
                // Foreground / Text
                foreground: {
                    DEFAULT: '#f4f4f5', // zinc-100
                    muted: '#a1a1aa',   // zinc-400
                    soft: '#d4d4d8',    // zinc-300
                },
                
                // Primary accents (xClaw brand gradients: Indigo -> Cyan -> Emerald)
                primary: {
                    DEFAULT: '#6366f1', // indigo-500
                    hover: '#4f46e5',   // indigo-600
                    light: '#818cf8',   // indigo-400
                    soft: 'rgba(99, 102, 241, 0.15)',
                },
                secondary: {
                    DEFAULT: '#06b6d4', // cyan-500
                },
                accent: {
                    DEFAULT: '#10b981', // emerald-500
                },
                
                // Semantic
                destructive: {
                    DEFAULT: '#ef4444',
                    soft: 'rgba(239, 68, 68, 0.15)',
                },
                success: {
                    DEFAULT: '#22c55e',
                    soft: 'rgba(34, 197, 94, 0.15)',
                },
                warning: {
                    DEFAULT: '#f59e0b',
                    soft: 'rgba(245, 158, 11, 0.15)',
                },
                
                // Borders
                border: {
                    DEFAULT: '#27272a', // zinc-800
                    soft: '#18181b',    // zinc-900
                    glow: 'rgba(99, 102, 241, 0.3)',
                }
            },
            boxShadow: {
                'glow': '0 0 20px rgba(99, 102, 241, 0.3)',
                'glow-lg': '0 0 30px rgba(99, 102, 241, 0.5)',
                'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
                'glass-sm': '0 4px 15px 0 rgba(0, 0, 0, 0.25)',
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            },
            keyframes: {
                'accordion-down': {
                    from: { height: 0 },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: 0 },
                },
                'fade-in': {
                    '0%': { opacity: 0 },
                    '100%': { opacity: 1 },
                },
                'slide-up': {
                    '0%': { opacity: 0, transform: 'translateY(10px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
                'shimmer': {
                    '100%': { transform: 'translateX(100%)' },
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in': 'fade-in 0.3s ease-in-out',
                'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                'float': 'float 3s ease-in-out infinite',
                'shimmer': 'shimmer 2s infinite',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};
