import { useState, useEffect } from 'react';
import {
    BarChart3, TrendingUp, Clock, Users, Download,
    MessageSquare, Zap, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { getAnalyticsOverview, getAnalyticsPerformance, exportAnalyticsCSV } from '../lib/api';

interface OverviewData {
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
    platformBreakdown: Record<string, number>;
    dailyVolume: Array<{ date: string; count: number; conversations: number }>;
    peakHours: Array<{ hour: number; count: number }>;
    avgSessionDurationMs: number;
}

interface PerformanceData {
    totalInteractions: number;
    avgLatencyMs: number;
    toolCallRate: number;
    escalationRate: number;
    tokenUsage: { prompt: number; completion: number; total: number };
    costUsd: number;
    modelBreakdown: Array<{ provider: string; model: string; calls: number; avgLatency: number; cost: number }>;
    errorRate: number;
}

export function AnalyticsPage() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [performance, setPerformance] = useState<PerformanceData | null>(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'performance'>('overview');

    const load = async () => {
        setLoading(true);
        try {
            const [ov, perf] = await Promise.all([
                getAnalyticsOverview(days),
                getAnalyticsPerformance(days),
            ]);
            setOverview(ov);
            setPerformance(perf);
        } catch { /* handled by empty state */ }
        setLoading(false);
    };

    useEffect(() => { load(); }, [days]);

    const handleExport = async (type: 'conversations' | 'llm') => {
        const blob = await exportAnalyticsCSV(type);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xclaw-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>Analytics</h1>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button onClick={load} className="p-2 rounded-lg hover:opacity-80" style={{ background: 'var(--color-bg-secondary)' }}>
                        <RefreshCw className="w-4 h-4" style={{ color: 'var(--color-fg-muted)' }} />
                    </button>
                    <button
                        onClick={() => handleExport('conversations')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                {(['overview', 'performance'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="flex-1 px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors"
                        style={{
                            background: tab === t ? 'var(--color-bg)' : 'transparent',
                            color: tab === t ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                </div>
            ) : tab === 'overview' && overview ? (
                <div className="space-y-6">
                    {/* Stat cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={MessageSquare} label="Conversations" value={(overview.totalConversations ?? 0).toLocaleString()} />
                        <StatCard icon={Zap} label="Messages" value={(overview.totalMessages ?? 0).toLocaleString()} />
                        <StatCard icon={TrendingUp} label="Avg Messages/Conv" value={(overview.avgMessagesPerConversation ?? 0).toFixed(1)} />
                        <StatCard icon={Clock} label="Avg Duration" value={formatDuration(overview.avgSessionDurationMs ?? 0)} />
                    </div>

                    {/* Daily volume chart (simple bar visualization) */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>Daily Conversation Volume</h3>
                        <div className="flex items-end gap-1 h-40">
                            {(overview.dailyVolume ?? []).slice(-30).map((d) => {
                                const max = Math.max(...(overview.dailyVolume ?? []).map((x) => x.conversations ?? x.count ?? 0), 1);
                                const pct = ((d.conversations ?? d.count ?? 0) / max) * 100;
                                return (
                                    <div
                                        key={d.date}
                                        className="flex-1 rounded-t transition-all hover:opacity-80 group relative"
                                        style={{ height: `${Math.max(pct, 2)}%`, background: 'var(--color-primary)' }}
                                        title={`${d.date}: ${d.conversations ?? d.count ?? 0}`}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                            <span>{overview.dailyVolume[0]?.date}</span>
                            <span>{overview.dailyVolume[overview.dailyVolume.length - 1]?.date}</span>
                        </div>
                    </div>

                    {/* Platform breakdown + Peak hours */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                            <h3 className="font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Platform Breakdown</h3>
                            <div className="space-y-2">
                                {Object.entries(overview.platformBreakdown).map(([platform, count]) => (
                                    <div key={platform} className="flex items-center justify-between">
                                        <span className="text-sm capitalize" style={{ color: 'var(--color-fg)' }}>{platform}</span>
                                        <span className="text-sm font-mono" style={{ color: 'var(--color-fg-muted)' }}>{count}</span>
                                    </div>
                                ))}
                                {Object.keys(overview.platformBreakdown).length === 0 && (
                                    <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>No data</p>
                                )}
                            </div>
                        </div>
                        <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                            <h3 className="font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Peak Hours</h3>
                            <div className="flex items-end gap-0.5 h-24">
                                {overview.peakHours.map((h) => {
                                    const max = Math.max(...overview.peakHours.map((x) => x.count), 1);
                                    const pct = (h.count / max) * 100;
                                    return (
                                        <div
                                            key={h.hour}
                                            className="flex-1 rounded-t"
                                            style={{ height: `${Math.max(pct, 2)}%`, background: 'var(--color-primary)', opacity: 0.7 }}
                                            title={`${h.hour}:00 — ${h.count} messages`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : tab === 'performance' && performance ? (
                <div className="space-y-6">
                    {/* Performance stat cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Zap} label="Total Interactions" value={(performance.totalInteractions ?? 0).toLocaleString()} />
                        <StatCard icon={Clock} label="Avg Latency" value={formatDuration(performance.avgLatencyMs ?? 0)} />
                        <StatCard icon={AlertTriangle} label="Error Rate" value={`${((performance.errorRate ?? 0) * 100).toFixed(1)}%`} />
                        <StatCard icon={TrendingUp} label="Total Cost" value={`$${(performance.costUsd ?? 0).toFixed(2)}`} />
                    </div>

                    {/* Token usage */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        <h3 className="font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Token Usage</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{((performance.tokenUsage?.prompt ?? 0) / 1000).toFixed(0)}K</p>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Prompt Tokens</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{((performance.tokenUsage?.completion ?? 0) / 1000).toFixed(0)}K</p>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Completion Tokens</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{((performance.tokenUsage?.total ?? 0) / 1000).toFixed(0)}K</p>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Total</p>
                            </div>
                        </div>
                    </div>

                    {/* Model breakdown */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                        <h3 className="font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Model Breakdown</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ color: 'var(--color-fg-muted)' }}>
                                        <th className="text-left py-2 font-medium">Provider</th>
                                        <th className="text-left py-2 font-medium">Model</th>
                                        <th className="text-right py-2 font-medium">Calls</th>
                                        <th className="text-right py-2 font-medium">Avg Latency</th>
                                        <th className="text-right py-2 font-medium">Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(performance.modelBreakdown ?? []).map((m, i) => (
                                        <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                            <td className="py-2" style={{ color: 'var(--color-fg)' }}>{m.provider}</td>
                                            <td className="py-2 font-mono text-xs" style={{ color: 'var(--color-fg)' }}>{m.model}</td>
                                            <td className="py-2 text-right" style={{ color: 'var(--color-fg-muted)' }}>{m.calls}</td>
                                            <td className="py-2 text-right" style={{ color: 'var(--color-fg-muted)' }}>{formatDuration(m.avgLatency)}</td>
                                            <td className="py-2 text-right" style={{ color: 'var(--color-fg-muted)' }}>${m.cost.toFixed(4)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Rates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <RateCard label="Tool Call Rate" value={performance.toolCallRate ?? 0} />
                        <RateCard label="Escalation Rate" value={performance.escalationRate ?? 0} />
                    </div>
                </div>
            ) : (
                <p className="text-center py-12" style={{ color: 'var(--color-fg-muted)' }}>No data available</p>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
    return (
        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>{value}</p>
        </div>
    );
}

function RateCard({ label, value }: { label: string; value: number }) {
    const pct = (value * 100).toFixed(1);
    return (
        <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--color-fg-muted)' }}>{label}</p>
            <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%`, background: 'var(--color-primary)' }} />
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>{pct}%</span>
            </div>
        </div>
    );
}
