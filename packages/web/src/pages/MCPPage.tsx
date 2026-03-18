import { useState, useEffect } from 'react';
import {
    Plug, Plus, Trash2, Power, PowerOff, RefreshCw, Server,
    Wrench, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import { getMCPServers, toggleMCPServer, addMCPServer, removeMCPServer, getMCPTools, getMCPInfo } from '../lib/api';

interface MCPServer {
    id: string;
    name: string;
    type: 'stdio' | 'sse' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    toolCount: number;
    lastPing?: string;
    description?: string;
    builtIn?: boolean;
}

interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

export function MCPPage() {
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [tools, setTools] = useState<MCPTool[]>([]);
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [expandedTools, setExpandedTools] = useState(false);
    const [tab, setTab] = useState<'servers' | 'tools' | 'info'>('servers');

    // Add form state
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'stdio' | 'sse' | 'http'>('stdio');
    const [newCommand, setNewCommand] = useState('');
    const [newArgs, setNewArgs] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [srvRes, toolRes, infoRes] = await Promise.all([
                getMCPServers(), getMCPTools(), getMCPInfo(),
            ]);
            setServers(srvRes.servers || []);
            setTools(toolRes.tools || []);
            setInfo(infoRes);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggle = async (id: string) => {
        try {
            await toggleMCPServer(id);
            fetchData();
        } catch { }
    };

    const handleRemove = async (id: string) => {
        try {
            await removeMCPServer(id);
            fetchData();
        } catch { }
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        try {
            await addMCPServer({
                name: newName,
                type: newType,
                command: newType === 'stdio' ? newCommand : undefined,
                args: newType === 'stdio' && newArgs ? newArgs.split(',').map(a => a.trim()) : undefined,
                url: newType !== 'stdio' ? newUrl : undefined,
                description: newDesc || undefined,
            });
            setShowAddForm(false);
            setNewName(''); setNewCommand(''); setNewArgs(''); setNewUrl(''); setNewDesc('');
            fetchData();
        } catch { }
    };

    const connectedCount = servers.filter(s => s.status === 'connected').length;

    return (
        <div className="h-full overflow-auto" style={{ background: 'var(--color-bg)' }}>
            <div className="max-w-5xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl" style={{ background: 'var(--color-primary-soft)' }}>
                            <Plug size={24} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>MCP Servers</h1>
                            <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                Model Context Protocol — {servers.length} servers, {connectedCount} connected
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchData}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}
                        >
                            <RefreshCw size={13} /> Refresh
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                            <Plus size={13} /> Add Server
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--color-bg-soft)' }}>
                    {(['servers', 'tools', 'info'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                            style={{
                                background: tab === t ? 'var(--color-bg-surface)' : 'transparent',
                                color: tab === t ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            {t === 'servers' ? `Servers (${servers.length})` : t === 'tools' ? `Tools (${tools.length})` : 'MCP Info'}
                        </button>
                    ))}
                </div>

                {/* Add Server Form */}
                {showAddForm && (
                    <div className="mb-4 p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>Add Custom MCP Server</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Name *</label>
                                <input
                                    value={newName} onChange={e => setNewName(e.target.value)}
                                    placeholder="My MCP Server"
                                    className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Type *</label>
                                <select
                                    value={newType} onChange={e => setNewType(e.target.value as any)}
                                    className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none cursor-pointer"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                >
                                    <option value="stdio">stdio (local command)</option>
                                    <option value="sse">SSE (Server-Sent Events)</option>
                                    <option value="http">HTTP (REST endpoint)</option>
                                </select>
                            </div>
                            {newType === 'stdio' ? (
                                <>
                                    <div>
                                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Command</label>
                                        <input
                                            value={newCommand} onChange={e => setNewCommand(e.target.value)}
                                            placeholder="npx, node, python..."
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Args (comma-separated)</label>
                                        <input
                                            value={newArgs} onChange={e => setNewArgs(e.target.value)}
                                            placeholder="-y, @anthropic/mcp-server"
                                            className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2">
                                    <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>URL</label>
                                    <input
                                        value={newUrl} onChange={e => setNewUrl(e.target.value)}
                                        placeholder="http://localhost:8080/mcp"
                                        className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Description</label>
                                <input
                                    value={newDesc} onChange={e => setNewDesc(e.target.value)}
                                    placeholder="What does this server do?"
                                    className="w-full px-3 py-1.5 rounded-lg text-xs border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>Cancel</button>
                            <button onClick={handleAdd} className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: 'var(--color-primary)', color: '#fff' }}>Add Server</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--color-fg-muted)' }} />
                    </div>
                ) : tab === 'servers' ? (
                    /* Servers Tab */
                    <div className="space-y-3">
                        {servers.map(srv => (
                            <div
                                key={srv.id}
                                className="p-4 rounded-xl border transition-all"
                                style={{
                                    background: 'var(--color-bg-surface)',
                                    borderColor: srv.status === 'connected' ? 'var(--color-primary)' : 'var(--color-border)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="p-2 rounded-lg"
                                        style={{
                                            background: srv.status === 'connected' ? 'var(--color-primary-soft)' : 'var(--color-bg-soft)',
                                        }}
                                    >
                                        <Server size={18} style={{
                                            color: srv.status === 'connected' ? 'var(--color-primary)' : 'var(--color-fg-muted)',
                                        }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{srv.name}</h3>
                                            <span
                                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                                style={{
                                                    background: srv.status === 'connected' ? '#064e3b22' : '#78350f22',
                                                    color: srv.status === 'connected' ? '#10b981' : '#f59e0b',
                                                }}
                                            >
                                                {srv.status}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-soft)', color: 'var(--color-fg-muted)' }}>
                                                {srv.type}
                                            </span>
                                            {srv.builtIn && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                                    built-in
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-fg-muted)' }}>
                                            {srv.description || (srv.command ? `${srv.command} ${(srv.args || []).join(' ')}` : srv.url)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] mr-2" style={{ color: 'var(--color-fg-muted)' }}>
                                            {srv.toolCount} tools
                                        </span>
                                        <button
                                            onClick={() => handleToggle(srv.id)}
                                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                            style={{ background: 'var(--color-bg-soft)' }}
                                            title={srv.enabled ? 'Disconnect' : 'Connect'}
                                        >
                                            {srv.enabled
                                                ? <Power size={14} style={{ color: '#10b981' }} />
                                                : <PowerOff size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                            }
                                        </button>
                                        {!srv.builtIn && (
                                            <button
                                                onClick={() => handleRemove(srv.id)}
                                                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                                style={{ background: 'var(--color-bg-soft)' }}
                                                title="Remove"
                                            >
                                                <Trash2 size={14} style={{ color: '#ef4444' }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : tab === 'tools' ? (
                    /* Tools Tab */
                    <div className="space-y-2">
                        {tools.length === 0 ? (
                            <div className="text-center py-10 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                                No MCP tools available. Install and connect domain packs to expose tools.
                            </div>
                        ) : (
                            tools.map((tool, i) => (
                                <div
                                    key={i}
                                    className="p-3 rounded-xl border"
                                    style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Wrench size={13} style={{ color: 'var(--color-primary)' }} />
                                        <span className="text-xs font-mono font-medium" style={{ color: 'var(--color-fg)' }}>{tool.name}</span>
                                    </div>
                                    <p className="text-[11px] mt-1 ml-5" style={{ color: 'var(--color-fg-muted)' }}>{tool.description}</p>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Info Tab */
                    info && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>MCP Server Information</h3>
                            <div className="space-y-2">
                                {Object.entries(info).map(([key, val]) => (
                                    <div key={key} className="flex items-start gap-3 text-xs">
                                        <span className="font-medium w-32 shrink-0" style={{ color: 'var(--color-fg-muted)' }}>{key}</span>
                                        <span className="font-mono" style={{ color: 'var(--color-fg)' }}>
                                            {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
