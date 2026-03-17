// ============================================================
// WorkflowToolbar - Save, Load, Validate, Execute, Export
// ============================================================

import React, { useState, useRef } from 'react';
import {
    Save, FolderOpen, Play, CheckCircle, Download, Upload,
    AlertTriangle, Loader2, FileJson, RotateCcw, RotateCw,
    List, X,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores';
import { api } from '@/utils/api';

interface ValidationError {
    nodeId?: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
}

interface WorkflowToolbarProps {
    onExecutionStart?: (executionId: string) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
}

export function WorkflowToolbar({ onExecutionStart, canUndo, canRedo, onUndo, onRedo }: WorkflowToolbarProps) {
    const nodes = useWorkflowStore(s => s.nodes);
    const edges = useWorkflowStore(s => s.edges);
    const workflowId = useWorkflowStore(s => s.workflowId);
    const workflowName = useWorkflowStore(s => s.workflowName);
    const isDirty = useWorkflowStore(s => s.isDirty);
    const setWorkflowMeta = useWorkflowStore(s => s.setWorkflowMeta);
    const setNodes = useWorkflowStore(s => s.setNodes);
    const setEdges = useWorkflowStore(s => s.setEdges);
    const markClean = useWorkflowStore(s => s.markClean);

    const [saving, setSaving] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [showValidation, setShowValidation] = useState(false);
    const [showLoadList, setShowLoadList] = useState(false);
    const [savedWorkflows, setSavedWorkflows] = useState<{ id: string; name: string }[]>([]);
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showStatus = (msg: string) => {
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(''), 3000);
    };

    // ─── Validate ─────────────────────────────────────────

    const validate = (): ValidationError[] => {
        const errors: ValidationError[] = [];

        if (nodes.length === 0) {
            errors.push({ message: 'Workflow has no nodes', severity: 'error' });
            return errors;
        }

        const triggers = nodes.filter(n => n.data.nodeType === 'trigger');
        if (triggers.length === 0) {
            errors.push({ message: 'Workflow has no trigger node', severity: 'error' });
        }

        // Check orphan nodes
        const connected = new Set<string>();
        edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
        nodes.forEach(n => {
            if (n.data.nodeType === 'trigger') return;
            if (!connected.has(n.id)) {
                errors.push({ nodeId: n.id, message: `"${n.data.label}" is not connected`, severity: 'warning' });
            }
        });

        // Check required config
        nodes.forEach(n => {
            switch (n.data.nodeType) {
                case 'llm-call':
                    if (!n.data.config.prompt) errors.push({ nodeId: n.id, field: 'prompt', message: `"${n.data.label}" missing prompt`, severity: 'error' });
                    break;
                case 'tool-call':
                    if (!n.data.config.toolName) errors.push({ nodeId: n.id, field: 'toolName', message: `"${n.data.label}" missing tool name`, severity: 'error' });
                    break;
                case 'condition':
                    if (!n.data.config.expression) errors.push({ nodeId: n.id, field: 'expression', message: `"${n.data.label}" missing condition`, severity: 'error' });
                    break;
                case 'http-request':
                    if (!n.data.config.url) errors.push({ nodeId: n.id, field: 'url', message: `"${n.data.label}" missing URL`, severity: 'error' });
                    break;
            }
        });

        setValidationErrors(errors);
        setShowValidation(errors.length > 0);
        return errors;
    };

    // ─── Save ─────────────────────────────────────────────

    const handleSave = async () => {
        setSaving(true);
        try {
            const workflow = buildWorkflowPayload();
            const saved = await api.saveWorkflow(workflow);
            setWorkflowMeta(saved.id, saved.name);
            markClean();
            showStatus('Saved!');
        } catch (err) {
            showStatus('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    // ─── Load ─────────────────────────────────────────────

    const handleLoadList = async () => {
        try {
            const { workflows } = await api.getWorkflows();
            setSavedWorkflows(workflows.map((w: any) => ({ id: w.id, name: w.name })));
            setShowLoadList(true);
        } catch {
            showStatus('Failed to load workflow list');
        }
    };

    const handleLoadWorkflow = async (id: string) => {
        try {
            const wf = await api.getWorkflow(id);
            // Convert workflow nodes → React Flow WFNodes
            const rfNodes = (wf.nodes ?? []).map((n: any) => ({
                id: n.id,
                type: 'custom',
                position: n.position ?? { x: 0, y: 0 },
                data: {
                    label: n.data?.label ?? n.type,
                    description: n.data?.description,
                    nodeType: n.type,
                    config: n.data?.config ?? {},
                    color: n.data?.color,
                },
            }));
            const rfEdges = (wf.edges ?? []).map((e: any) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourcePort,
                targetHandle: e.targetPort,
                animated: true,
                style: { stroke: '#475569' },
            }));
            setNodes(rfNodes);
            setEdges(rfEdges);
            setWorkflowMeta(wf.id, wf.name);
            markClean();
            setShowLoadList(false);
            showStatus(`Loaded "${wf.name}"`);
        } catch {
            showStatus('Failed to load workflow');
        }
    };

    // ─── Execute ──────────────────────────────────────────

    const handleExecute = async () => {
        const errs = validate();
        if (errs.some(e => e.severity === 'error')) {
            showStatus('Fix validation errors before executing');
            return;
        }

        // Save first if dirty
        if (isDirty || !workflowId) {
            await handleSave();
        }

        setExecuting(true);
        try {
            const result = await api.executeWorkflow(workflowId!);
            onExecutionStart?.(result.id);
            showStatus(result.status === 'completed' ? 'Execution completed!' : `Execution ${result.status}`);
        } catch (err) {
            showStatus('Execution failed: ' + (err instanceof Error ? err.message : 'Unknown'));
        } finally {
            setExecuting(false);
        }
    };

    // ─── Export / Import ──────────────────────────────────

    const handleExport = () => {
        const workflow = buildWorkflowPayload();
        const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wf = JSON.parse(e.target?.result as string);
                const rfNodes = (wf.nodes ?? []).map((n: any) => ({
                    id: n.id,
                    type: 'custom',
                    position: n.position ?? { x: 0, y: 0 },
                    data: {
                        label: n.data?.label ?? n.type,
                        description: n.data?.description,
                        nodeType: n.type ?? n.data?.nodeType,
                        config: n.data?.config ?? {},
                        color: n.data?.color,
                    },
                }));
                const rfEdges = (wf.edges ?? []).map((e: any) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourcePort ?? e.sourceHandle,
                    targetHandle: e.targetPort ?? e.targetHandle,
                    animated: true,
                    style: { stroke: '#475569' },
                }));
                setNodes(rfNodes);
                setEdges(rfEdges);
                setWorkflowMeta(null, wf.name ?? 'Imported Workflow');
                showStatus('Imported successfully');
            } catch {
                showStatus('Invalid workflow JSON file');
            }
        };
        reader.readAsText(file);
        // Reset the input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ─── Helpers ──────────────────────────────────────────

    const buildWorkflowPayload = () => ({
        id: workflowId,
        name: workflowName,
        description: '',
        nodes: nodes.map(n => ({
            id: n.id,
            type: n.data.nodeType,
            position: n.position,
            data: { label: n.data.label, description: n.data.description, config: n.data.config, color: n.data.color },
            inputs: [], outputs: [],
        })),
        edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            sourcePort: e.sourceHandle ?? 'output',
            target: e.target,
            targetPort: e.targetHandle ?? 'input',
        })),
        variables: [],
        trigger: { id: 'trigger', type: 'manual', name: 'Manual', description: '', config: {} },
        enabled: true,
    });

    // ─── Render ───────────────────────────────────────────

    return (
        <div className="relative">
            <div className="flex items-center gap-1 bg-dark-900 border-b border-dark-700 px-3 py-1.5">
                {/* Workflow Name */}
                <input
                    type="text"
                    value={workflowName}
                    onChange={e => setWorkflowMeta(workflowId, e.target.value)}
                    className="bg-transparent text-white text-sm font-semibold w-48 px-2 py-1 rounded hover:bg-dark-800 focus:bg-dark-800 focus:outline-none border border-transparent focus:border-dark-600"
                    placeholder="Workflow name..."
                />

                {isDirty && <span className="text-xs text-amber-400 ml-1">●</span>}

                <div className="w-px h-5 bg-dark-700 mx-2" />

                {/* Undo / Redo */}
                <ToolbarButton icon={RotateCcw} title="Undo" onClick={onUndo} disabled={!canUndo} />
                <ToolbarButton icon={RotateCw} title="Redo" onClick={onRedo} disabled={!canRedo} />

                <div className="w-px h-5 bg-dark-700 mx-2" />

                {/* Save */}
                <ToolbarButton
                    icon={saving ? Loader2 : Save}
                    title="Save"
                    onClick={handleSave}
                    disabled={saving}
                    spin={saving}
                />

                {/* Load */}
                <ToolbarButton icon={FolderOpen} title="Load" onClick={handleLoadList} />

                {/* Validate */}
                <ToolbarButton
                    icon={CheckCircle}
                    title="Validate"
                    onClick={() => { validate(); setShowValidation(true); }}
                    badge={validationErrors.filter(e => e.severity === 'error').length || undefined}
                />

                <div className="w-px h-5 bg-dark-700 mx-2" />

                {/* Execute */}
                <button
                    onClick={handleExecute}
                    disabled={executing || nodes.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                    {executing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    Run
                </button>

                <div className="flex-1" />

                {/* Export / Import */}
                <ToolbarButton icon={Download} title="Export JSON" onClick={handleExport} />
                <ToolbarButton icon={Upload} title="Import JSON" onClick={() => fileInputRef.current?.click()} />
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

                {/* Status Message */}
                {statusMessage && (
                    <span className="ml-2 text-xs text-slate-300 bg-dark-800 px-2 py-1 rounded animate-fade-in">
                        {statusMessage}
                    </span>
                )}
            </div>

            {/* Validation Panel */}
            {showValidation && validationErrors.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-dark-900 border-b border-dark-700 shadow-xl max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-700">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-400" />
                            <span className="text-xs font-semibold text-white">
                                {validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <button onClick={() => setShowValidation(false)} className="text-slate-400 hover:text-white">
                            <X size={14} />
                        </button>
                    </div>
                    {validationErrors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-dark-800 last:border-0">
                            <span className={err.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                                {err.severity === 'error' ? '✕' : '⚠'}
                            </span>
                            <span className="text-slate-300">{err.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Load Workflow List */}
            {showLoadList && (
                <div className="absolute top-full left-0 right-0 z-50 bg-dark-900 border-b border-dark-700 shadow-xl max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-700">
                        <div className="flex items-center gap-2">
                            <List size={14} className="text-blue-400" />
                            <span className="text-xs font-semibold text-white">
                                Saved Workflows ({savedWorkflows.length})
                            </span>
                        </div>
                        <button onClick={() => setShowLoadList(false)} className="text-slate-400 hover:text-white">
                            <X size={14} />
                        </button>
                    </div>
                    {savedWorkflows.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-slate-500 text-center">No saved workflows</div>
                    ) : savedWorkflows.map(w => (
                        <button
                            key={w.id}
                            onClick={() => handleLoadWorkflow(w.id)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-dark-800 border-b border-dark-800 last:border-0"
                        >
                            <FileJson size={14} className="inline mr-2 text-slate-500" />
                            {w.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Shared Button Component ────────────────────────────────

function ToolbarButton({ icon: Icon, title, onClick, disabled, spin, badge }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    spin?: boolean;
    badge?: number;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="relative p-1.5 rounded text-slate-400 hover:text-white hover:bg-dark-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
            <Icon size={16} className={spin ? 'animate-spin' : ''} />
            {badge != null && badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                    {badge}
                </span>
            )}
        </button>
    );
}
