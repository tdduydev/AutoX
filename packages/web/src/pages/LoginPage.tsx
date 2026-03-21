import { useState, type FormEvent } from 'react';
import { Loader2, Sparkles, Zap, Shield, Globe } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';

const FEATURES = [
    { icon: Sparkles, label: 'Multi-LLM AI Engine', desc: 'OpenAI, Anthropic, Ollama & more' },
    { icon: Zap, label: 'RAG-Powered Search', desc: 'Semantic knowledge retrieval' },
    { icon: Shield, label: 'Enterprise Security', desc: 'RBAC with 60+ permissions' },
    { icon: Globe, label: '13 Domain Packs', desc: 'Industry-specialized solutions' },
];

export function LoginPage() {
    const { login } = useAuth();
    const { t } = useI18n();
    const [email, setEmail] = useState('admin@xclaw.io');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch {
            setError(t('auth.invalidCredentials'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-bg flex items-center justify-center">
            {/* Animated gradient blobs */}
            <div className="login-blob login-blob-1" />
            <div className="login-blob login-blob-2" />
            <div className="login-blob login-blob-3" />
            <div className="login-blob login-blob-4" />

            {/* Floating orbs */}
            <div className="login-orb login-orb-1" />
            <div className="login-orb login-orb-2" />
            <div className="login-orb login-orb-3" />
            <div className="login-orb login-orb-4" />
            <div className="login-orb login-orb-5" />

            {/* Main content */}
            <div className="relative z-10 w-full max-w-[920px] mx-4 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">

                {/* Left — Branding panel */}
                <div
                    className="hidden md:flex flex-col justify-center p-10"
                    style={{ animation: 'hero-text-appear 0.6s ease-out' }}
                >
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <img
                            src="/logo.png"
                            alt="xClaw Logo"
                            className="w-12 h-12 rounded-2xl"
                            style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)' }}
                        />
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#f4f4f5' }}>
                                xClaw
                            </h1>
                            <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                style={{
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#818cf8',
                                }}
                            >
                                v2.0
                            </span>
                        </div>
                    </div>

                    <h2
                        className="text-lg font-semibold mb-2"
                        style={{ color: '#f4f4f5' }}
                    >
                        AI Agent Platform
                    </h2>
                    <p
                        className="text-sm leading-relaxed mb-8"
                        style={{ color: '#a1a1aa' }}
                    >
                        Open-source, multi-industry AI platform with RAG, workflow automation, and enterprise-grade security.
                    </p>

                    {/* Feature list */}
                    <div className="space-y-4">
                        {FEATURES.map((f, i) => (
                            <div
                                key={f.label}
                                className="flex items-center gap-3"
                                style={{
                                    animation: `hero-text-appear 0.5s ease-out ${0.2 + i * 0.1}s both`,
                                }}
                            >
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'rgba(99, 102, 241, 0.1)' }}
                                >
                                    <f.icon size={16} style={{ color: '#818cf8' }} />
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium" style={{ color: '#e4e4e7' }}>
                                        {f.label}
                                    </p>
                                    <p className="text-[11px]" style={{ color: '#71717a' }}>
                                        {f.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — Login card */}
                <div className="flex items-center justify-center p-4 md:p-6">
                    <div className="login-card w-full max-w-sm rounded-2xl p-8 transition-all duration-500">
                        {/* Mobile logo (hidden on md+) */}
                        <div className="flex flex-col items-center mb-8 md:hidden">
                            <img
                                src="/logo.png"
                                alt="xClaw Logo"
                                className="w-14 h-14 rounded-2xl mb-3"
                                style={{ boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)' }}
                            />
                            <h1 className="text-xl font-bold" style={{ color: '#f4f4f5' }}>xClaw</h1>
                        </div>

                        {/* Desktop card header */}
                        <div className="hidden md:block mb-8">
                            <h2 className="text-lg font-bold" style={{ color: '#f4f4f5' }}>
                                {t('auth.signIn')}
                            </h2>
                            <p className="text-[13px] mt-1" style={{ color: '#71717a' }}>
                                {t('auth.platform')}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label
                                    className="block text-[11px] font-semibold tracking-wider mb-2"
                                    style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                    {t('auth.email')}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                    placeholder="admin@xclaw.io"
                                    required
                                />
                            </div>
                            <div>
                                <label
                                    className="block text-[11px] font-semibold tracking-wider mb-2"
                                    style={{ color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                    {t('auth.password')}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="login-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            {error && (
                                <div
                                    className="text-sm px-4 py-3 rounded-xl flex items-center gap-2"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.15)',
                                    }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="login-btn w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin mx-auto" />
                                ) : (
                                    t('auth.signIn')
                                )}
                            </button>
                        </form>

                        {/* Bottom decoration */}
                        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p className="text-[11px] text-center" style={{ color: '#52525b' }}>
                                Powered by xClaw AI Platform • v2.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
