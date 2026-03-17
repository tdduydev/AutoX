// ============================================================
// ExecutionMonitor - Real-time workflow execution status panel
// ============================================================

import React, { useState, useEffect } from 'react';
import {
    Activity, CheckCircle2, XCircle, Clock, Loader2,
    ChevronDown, ChevronRight, X,
} from 'lucide-react';

export interface NodeExecStatus {
    nodeId: string;
    nodeName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    result?: unknown;
    error?: string;
}

export interface ExecutionState {
    executionId: string;
    status: 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    nodeStatuses: Map<string, NodeExecStatus>;
}

interface ExecutionMonitorProps {
    execution: ExecutionState | null;
    onClose: () => void;
    onNodeClick?: (nodeId: string) => void;
}

export function ExecutionMonitor({ execution, onClose, onNodeClick }: ExecutionMonitorProps) {
    const [expandedNode, setExpandedNode] = useState<string | null>(null);

    if (!execution) return null;

    const nodeList = Array.from(execution.nodeStatuses.values());
    const completed = nodeList.filter(n => n.status === 'completed').length;
    const failed = nodeList.filter(n => n.status === 'failed').length;
    const running = nodeList.filter(n => n.status === 'running').length;
    const elapsed = (execution.endTime ?? Date.now()) - execution.startTime;

    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-dark-900 border-l border-dark-700 shadow-xl z-40 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-dark-700">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-blue-400" />
                    <span className="text-sm font-semibold text-white">Execution Monitor</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-dark-700">
                <StatusBadge
                    icon={execution.status === 'running' ? Loader2 : execution.status === 'completed' ? CheckCircle2 : XCircle}
                    label={execution.status}
                    color={execution.status === 'running' ? 'text-blue-400' : execution.status === 'completed' ? 'text-green-400' : 'text-red-400'}
                    spin={execution.status === 'running'}
                />
                <MiniStat label="Done" value={completed} color="text-green-400" />
                <MiniStat label="Failed" value={failed} color="text-red-400" />
                <MiniStat label="Time" value={formatDuration(elapsed)} color="text-slate-300" />
            </div>

            {/* Node List */}
            <div className="flex-1 overflow-y-auto">
                {nodeList.map(node => (
                    <div key={node.nodeId} className="border-b border-dark-800">
                        <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-800 transition-colors"
                            onClick={() => {
                                setExpandedNode(expandedNode === node.nodeId ? null : node.nodeId);
                                onNodeClick?.(node.nodeId);
                            }}
                        >
                            <NodeStatusIcon status={node.status} />
                            <span className="flex-1 text-xs text-slate-300 truncate">{node.nodeName}</span>
                            {node.startTime && node.endTime && (
                                <span className="text-[10px] text-slate-500">
                                    {formatDuration(node.endTime - node.startTime)}
                                </span>
                            )}
                            {expandedNode === node.nodeId ? (
                                <ChevronDown size={12} className="text-slate-500" />
                            ) : (
                                <ChevronRight size={12} className="text-slate-500" />
                            )}
                        </button>

                        {expandedNode === node.nodeId && (
                            <div className="px-3 py-2 bg-dark-950 text-[11px]">
                                {node.error && (
                                    <div className="text-red-400 mb-1">Error: {node.error}</div>
                                )}
                                {node.result != null && (
                                    <pre className="text-slate-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                                        {typeof node.result === 'string' ? node.result : JSON.stringify(node.result, null, 2)}
                                    </pre>
                                )}
                                {!node.error && node.result == null && (
                                    <span className="text-slate-600 italic">No output yet</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                {nodeList.length === 0 && (
                    <div className="px-3 py-8 text-xs text-slate-500 text-center">
                        Waiting for execution data...
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="px-3 py-2 border-t border-dark-700">
                <div className="w-full bg-dark-800 rounded-full h-1.5">
                    <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${execution.status === 'failed' ? 'bg-red-500' :
                                execution.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                        style={{
                            width: nodeList.length ? `${((completed + failed) / nodeList.length) * 100}%` : '0%',
                        }}
                    />
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">
                    {completed + failed}/{nodeList.length} nodes processed
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────

function NodeStatusIcon({ status }: { status: NodeExecStatus['status'] }) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 size={14} className="text-green-400 shrink-0" />;
        case 'failed':
            return <XCircle size={14} className="text-red-400 shrink-0" />;
        case 'running':
            return <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />;
        case 'skipped':
            return <Clock size={14} className="text-slate-600 shrink-0" />;
        default:
            return <Clock size={14} className="text-slate-500 shrink-0" />;
    }
}

function StatusBadge({ icon: Icon, label, color, spin }: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    color: string;
    spin?: boolean;
}) {
    return (
        <div className="flex flex-col items-center">
            <Icon size={14} className={`${color} ${spin ? 'animate-spin' : ''}`} />
            <span className={`text-[10px] mt-0.5 capitalize ${color}`}>{label}</span>
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className={`text-xs font-semibold ${color}`}>{value}</span>
            <span className="text-[10px] text-slate-500">{label}</span>
        </div>
    );
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}
