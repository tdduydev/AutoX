import { useState, useEffect } from 'react';
import { Activity, Database, MessageSquare, Cpu, FileText, Zap } from 'lucide-react';
import { getHealth, getKnowledge } from '../lib/api';

interface HealthData {
    status: string;
    version: string;
    uptime: number;
    timestamp: string;
}

interface KBData {
    stats: { totalDocuments: number; totalChunks: number };
}

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

export function DashboardPage() {
    const [health, setHealth] = useState<HealthData | null>(null);
    const [kb, setKB] = useState<KBData | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        getHealth().then(setHealth).catch(() => setError('Server unreachable'));
        getKnowledge().then(setKB).catch(() => { });
    }, []);

    const cards = [
        {
            icon: Activity,
            label: 'Status',
            value: health?.status === 'ok' ? 'Online' : 'Offline',
            color: health?.status === 'ok' ? 'var(--color-success)' : 'var(--color-destructive)',
            bg: health?.status === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        },
        {
            icon: Cpu,
            label: 'Uptime',
            value: health ? formatUptime(health.uptime) : '—',
            color: 'var(--color-secondary)',
            bg: 'rgba(6,182,212,0.12)',
        },
        {
            icon: FileText,
            label: 'Documents',
            value: kb?.stats?.totalDocuments?.toString() ?? '0',
            color: 'var(--color-primary)',
            bg: 'var(--color-primary-soft)',
        },
        {
            icon: Database,
            label: 'KB Chunks',
            value: kb?.stats?.totalChunks?.toString() ?? '0',
            color: 'var(--color-accent)',
            bg: 'rgba(16,185,129,0.12)',
        },
    ];

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>Dashboard</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-fg-muted)' }}>
                        xClaw AI Agent Platform — System Overview
                    </p>
                </div>

                {error && (
                    <div className="mb-6 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                        {error}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {cards.map((card) => (
                        <div
                            key={card.label}
                            className="p-4 rounded-xl border animate-fade-in"
                            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                                    <card.icon size={18} style={{ color: card.color }} />
                                </div>
                                <span className="text-xs font-medium" style={{ color: 'var(--color-fg-muted)' }}>{card.label}</span>
                            </div>
                            <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <QuickAction
                        icon={MessageSquare}
                        title="Chat with AI"
                        desc="Start a conversation with your AI assistant"
                        href="/chat"
                        color="var(--color-primary)"
                    />
                    <QuickAction
                        icon={Database}
                        title="Upload Documents"
                        desc="Add knowledge to your RAG pipeline"
                        href="/knowledge"
                        color="var(--color-accent)"
                    />
                    <QuickAction
                        icon={Zap}
                        title="Search Knowledge"
                        desc="Test RAG retrieval with semantic search"
                        href="/search"
                        color="var(--color-secondary)"
                    />
                </div>

                {/* System Info */}
                {health && (
                    <div
                        className="p-5 rounded-xl border"
                        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                    >
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>
                            System Information
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <InfoRow label="Version" value={health.version} />
                            <InfoRow label="Status" value={health.status} />
                            <InfoRow label="Uptime" value={formatUptime(health.uptime)} />
                            <InfoRow label="Last Check" value={new Date(health.timestamp).toLocaleTimeString()} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function QuickAction({ icon: Icon, title, desc, href, color }: {
    icon: typeof Activity;
    title: string;
    desc: string;
    href: string;
    color: string;
}) {
    return (
        <a
            href={href}
            className="block p-5 rounded-xl border transition-all hover:scale-[1.01]"
            style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
        >
            <Icon size={22} style={{ color }} className="mb-3" />
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-fg)' }}>{title}</h3>
            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{desc}</p>
        </a>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
            <p className="font-medium" style={{ color: 'var(--color-fg)' }}>{value}</p>
        </div>
    );
}
