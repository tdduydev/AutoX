import { useState, useEffect, useCallback } from 'react';
import {
    Bot, Wand2, Plus, X, GripVertical, Save, Trash2,
    Settings2, MessageSquare, Zap, Brain, ChevronDown, Eye, Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────

interface SkillBlock {
    id: string;
    name: string;
    description: string;
    domainId: string;
    enabled: boolean;
}

interface ToolBlock {
    id: string;
    name: string;
    description: string;
    source: string; // 'mcp' | 'builtin' | 'custom'
}

interface AgentConfig {
    name: string;
    description: string;
    persona: string;
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    skills: SkillBlock[];
    tools: ToolBlock[];
    knowledgeCollections: string[];
}

const DEFAULT_CONFIG: AgentConfig = {
    name: 'New Agent',
    description: '',
    persona: 'A helpful AI assistant.',
    systemPrompt: '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    skills: [],
    tools: [],
    knowledgeCollections: [],
};

// ─── Main Page Component ────────────────────────────────────

export function AgentBuilderPage() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<AgentConfig>({ ...DEFAULT_CONFIG });
    const [availableSkills, setAvailableSkills] = useState<SkillBlock[]>([]);
    const [availableTools, setAvailableTools] = useState<ToolBlock[]>([]);
    const [saving, setSaving] = useState(false);
    const [activePanel, setActivePanel] = useState<'persona' | 'skills' | 'tools' | 'settings'>('persona');
    const [dragOverZone, setDragOverZone] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        // Load available skills from domains
        fetch('/api/marketplace/skills', {
            headers: { Authorization: `Bearer ${localStorage.getItem('xclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => {
                setAvailableSkills(
                    (data.skills || []).map((s: Record<string, unknown>) => ({
                        id: s.id as string,
                        name: s.name as string,
                        description: s.description as string,
                        domainId: s.domainId as string,
                        enabled: true,
                    })),
                );
            })
            .catch(() => { });

        // Load available MCP tools
        fetch('/api/mcp/tools', {
            headers: { Authorization: `Bearer ${localStorage.getItem('xclaw_token')}` },
        })
            .then((r) => r.json())
            .then((data) => {
                setAvailableTools(
                    (data.tools || []).map((t: Record<string, unknown>) => ({
                        id: t.name as string,
                        name: (t.name as string).split('__').pop() || (t.name as string),
                        description: t.description as string,
                        source: 'mcp',
                    })),
                );
            })
            .catch(() => { });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('xclaw_token')}`,
                },
                body: JSON.stringify({
                    name: config.name,
                    description: config.description,
                    config: {
                        persona: config.persona,
                        systemPrompt: config.systemPrompt,
                        model: config.model,
                        temperature: config.temperature,
                        maxTokens: config.maxTokens,
                        skills: config.skills.map((s) => s.id),
                        tools: config.tools.map((t) => t.id),
                        knowledgeCollections: config.knowledgeCollections,
                    },
                }),
            });
            if (res.ok) navigate('/agents');
        } catch { /* ignore */ }
        setSaving(false);
    };

    const addSkill = useCallback((skill: SkillBlock) => {
        setConfig((prev) => {
            if (prev.skills.find((s) => s.id === skill.id)) return prev;
            return { ...prev, skills: [...prev.skills, { ...skill }] };
        });
    }, []);

    const removeSkill = useCallback((id: string) => {
        setConfig((prev) => ({ ...prev, skills: prev.skills.filter((s) => s.id !== id) }));
    }, []);

    const addTool = useCallback((tool: ToolBlock) => {
        setConfig((prev) => {
            if (prev.tools.find((t) => t.id === tool.id)) return prev;
            return { ...prev, tools: [...prev.tools, { ...tool }] };
        });
    }, []);

    const removeTool = useCallback((id: string) => {
        setConfig((prev) => ({ ...prev, tools: prev.tools.filter((t) => t.id !== id) }));
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, zone: 'skills' | 'tools') => {
        e.preventDefault();
        setDragOverZone(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (zone === 'skills' && data.type === 'skill') addSkill(data.item);
            if (zone === 'tools' && data.type === 'tool') addTool(data.item);
        } catch { /* ignore */ }
    }, [addSkill, addTool]);

    const handleDragOver = (e: React.DragEvent, zone: string) => {
        e.preventDefault();
        setDragOverZone(zone);
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* Left Panel — Configuration */}
            <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg)' }}>
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-soft)' }}>
                                <Wand2 size={20} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>Agent Builder</h1>
                                <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>Design your agent with persona, skills, and tools</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPreviewOpen(!previewOpen)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border cursor-pointer"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg-muted)' }}>
                                <Eye size={14} /> Preview
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                                style={{ background: 'var(--color-primary)' }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Agent
                            </button>
                        </div>
                    </div>

                    {/* Agent Name & Description */}
                    <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                            className="w-full text-lg font-bold bg-transparent outline-none"
                            style={{ color: 'var(--color-fg)' }}
                            placeholder="Agent Name"
                        />
                        <input
                            type="text"
                            value={config.description}
                            onChange={(e) => setConfig((p) => ({ ...p, description: e.target.value }))}
                            className="w-full text-sm bg-transparent outline-none"
                            style={{ color: 'var(--color-fg-muted)' }}
                            placeholder="Short description..."
                        />
                    </div>

                    {/* Panel Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg-surface)' }}>
                        {([
                            { key: 'persona', icon: MessageSquare, label: 'Persona' },
                            { key: 'skills', icon: Brain, label: 'Skills' },
                            { key: 'tools', icon: Zap, label: 'Tools' },
                            { key: 'settings', icon: Settings2, label: 'Settings' },
                        ] as const).map(({ key, icon: Icon, label }) => (
                            <button
                                key={key}
                                onClick={() => setActivePanel(key)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-colors"
                                style={{
                                    background: activePanel === key ? 'var(--color-bg)' : 'transparent',
                                    color: activePanel === key ? 'var(--color-fg)' : 'var(--color-fg-muted)',
                                }}
                            >
                                <Icon size={13} /> {label}
                            </button>
                        ))}
                    </div>

                    {/* Persona Panel */}
                    {activePanel === 'persona' && (
                        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <MessageSquare size={14} /> Persona
                            </h3>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Personality / Role</label>
                                <textarea
                                    value={config.persona}
                                    onChange={(e) => setConfig((p) => ({ ...p, persona: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder="Describe the agent's personality and role..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>System Prompt (optional override)</label>
                                <textarea
                                    value={config.systemPrompt}
                                    onChange={(e) => setConfig((p) => ({ ...p, systemPrompt: e.target.value }))}
                                    rows={5}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none font-mono"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder="Custom system prompt..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Skills Panel */}
                    {activePanel === 'skills' && (
                        <div className="space-y-4">
                            {/* Active Skills Drop Zone */}
                            <div
                                className="rounded-xl border p-4 min-h-[120px] transition-colors"
                                style={{
                                    background: dragOverZone === 'skills' ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                    borderColor: dragOverZone === 'skills' ? 'var(--color-primary)' : 'var(--color-border)',
                                    borderStyle: config.skills.length === 0 ? 'dashed' : 'solid',
                                }}
                                onDrop={(e) => handleDrop(e, 'skills')}
                                onDragOver={(e) => handleDragOver(e, 'skills')}
                                onDragLeave={() => setDragOverZone(null)}
                            >
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Active Skills ({config.skills.length})
                                </h3>
                                {config.skills.length === 0 ? (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                        Drag skills here or click + to add
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {config.skills.map((skill) => (
                                            <div key={skill.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                                                <GripVertical size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                                <Brain size={14} style={{ color: 'var(--color-primary)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{skill.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{skill.description}</p>
                                                </div>
                                                <button onClick={() => removeSkill(skill.id)} className="p-1 cursor-pointer" style={{ color: 'var(--color-destructive)' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Available Skills */}
                            <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Available Skills
                                </h3>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                    {availableSkills.filter((s) => !config.skills.find((cs) => cs.id === s.id)).map((skill) => (
                                        <div
                                            key={skill.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'skill', item: skill }))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Brain size={13} style={{ color: 'var(--color-fg-muted)' }} />
                                            <span className="text-xs truncate flex-1" style={{ color: 'var(--color-fg)' }}>{skill.name}</span>
                                            <button onClick={() => addSkill(skill)} className="p-0.5 cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tools Panel */}
                    {activePanel === 'tools' && (
                        <div className="space-y-4">
                            <div
                                className="rounded-xl border p-4 min-h-[120px] transition-colors"
                                style={{
                                    background: dragOverZone === 'tools' ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                    borderColor: dragOverZone === 'tools' ? 'var(--color-primary)' : 'var(--color-border)',
                                    borderStyle: config.tools.length === 0 ? 'dashed' : 'solid',
                                }}
                                onDrop={(e) => handleDrop(e, 'tools')}
                                onDragOver={(e) => handleDragOver(e, 'tools')}
                                onDragLeave={() => setDragOverZone(null)}
                            >
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Active Tools ({config.tools.length})
                                </h3>
                                {config.tools.length === 0 ? (
                                    <p className="text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                        Drag tools here or click + to add
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {config.tools.map((tool) => (
                                            <div key={tool.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                                                <GripVertical size={14} style={{ color: 'var(--color-fg-muted)' }} />
                                                <Zap size={14} style={{ color: 'var(--color-accent)' }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>{tool.name}</p>
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--color-fg-muted)' }}>{tool.description}</p>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>{tool.source}</span>
                                                <button onClick={() => removeTool(tool.id)} className="p-1 cursor-pointer" style={{ color: 'var(--color-destructive)' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border p-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                                    Available Tools (MCP)
                                </h3>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                    {availableTools.filter((t) => !config.tools.find((ct) => ct.id === t.id)).map((tool) => (
                                        <div
                                            key={tool.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'tool', item: tool }))}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)] transition-colors"
                                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                                        >
                                            <Zap size={13} style={{ color: 'var(--color-fg-muted)' }} />
                                            <span className="text-xs truncate flex-1" style={{ color: 'var(--color-fg)' }}>{tool.name}</span>
                                            <button onClick={() => addTool(tool)} className="p-0.5 cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {availableTools.length === 0 && (
                                        <p className="col-span-2 text-xs text-center py-4" style={{ color: 'var(--color-fg-muted)' }}>
                                            No MCP tools available. Connect MCP servers first.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Settings Panel */}
                    {activePanel === 'settings' && (
                        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-fg)' }}>
                                <Settings2 size={14} /> Model Settings
                            </h3>
                            <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Model</label>
                                <input
                                    type="text"
                                    value={config.model}
                                    onChange={(e) => setConfig((p) => ({ ...p, model: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    placeholder="gpt-4o-mini, claude-3.5-sonnet, etc."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>
                                        Temperature: {config.temperature}
                                    </label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        value={config.temperature}
                                        onChange={(e) => setConfig((p) => ({ ...p, temperature: Number(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-fg-muted)' }}>Max Tokens</label>
                                    <input
                                        type="number"
                                        value={config.maxTokens}
                                        onChange={(e) => setConfig((p) => ({ ...p, maxTokens: Number(e.target.value) }))}
                                        min={256}
                                        max={128000}
                                        step={256}
                                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel — Preview */}
            {previewOpen && (
                <div className="w-80 shrink-0 border-l overflow-y-auto p-4 space-y-4" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Agent Preview</h3>
                        <button onClick={() => setPreviewOpen(false)} className="p-1 cursor-pointer" style={{ color: 'var(--color-fg-muted)' }}>
                            <X size={14} />
                        </button>
                    </div>

                    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                            <Bot size={20} style={{ color: 'var(--color-primary)' }} />
                            <span className="font-semibold text-sm" style={{ color: 'var(--color-fg)' }}>{config.name || 'Unnamed Agent'}</span>
                        </div>
                        {config.description && <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>{config.description}</p>}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>MODEL</p>
                        <p className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-fg)' }}>{config.model}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>SKILLS ({config.skills.length})</p>
                        {config.skills.map((s) => (
                            <div key={s.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-light)' }}>
                                <Brain size={10} /> {s.name}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>TOOLS ({config.tools.length})</p>
                        {config.tools.map((t) => (
                            <div key={t.id} className="text-xs px-2 py-1 rounded flex items-center gap-1.5" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                                <Zap size={10} /> {t.name}
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>PERSONA</p>
                        <p className="text-xs italic" style={{ color: 'var(--color-fg-soft)' }}>
                            "{config.persona || 'No persona set'}"
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
