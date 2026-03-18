import { useState, type FormEvent } from 'react';
import { PawPrint, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
    const { login } = useAuth();
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
            setError('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="flex items-center justify-center min-h-screen"
            style={{ background: 'var(--color-bg)' }}
        >
            <div
                className="w-full max-w-sm p-8 rounded-2xl border animate-slide-up"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
                <div className="flex flex-col items-center mb-8">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'var(--color-primary-soft)' }}
                    >
                        <PawPrint size={28} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>xClaw</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                        AI Agent Platform
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                            style={{
                                background: 'var(--color-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-fg)',
                            }}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-fg-muted)' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
                            style={{
                                background: 'var(--color-bg)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-fg)',
                            }}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
