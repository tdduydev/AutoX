// ============================================================
// ExecutionHistory - List of past workflow executions
// ============================================================

import React, { useState, useEffect } from 'react';
import {
    History, CheckCircle2, XCircle, Clock, ChevronRight, RefreshCw,
} from 'lucide-react';

interface ExecutionRecord {
    id: string;
    workflowId: string;
    workflowName: string;
    status: 'completed' | 'failed' | 'running';
    startTime: string;
    endTime?: string;
    nodeCount: number;
    completedNodes: number;
    error?: string;
}

interface ExecutionHistoryProps {
    workflowId?: string | null;
    onReplay?: (executionId: string) => void;
    onViewDetails?: (executionId: string) => void;
}

export function ExecutionHistory({ workflowId, onReplay, onViewDetails }: ExecutionHistoryProps) {
    const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // For demo / initial state, use empty list.
    // In production, this would fetch from the server.
    useEffect(() => {
        if (!workflowId) {
            setExecutions([]);
            return;
        }
        // Placeholder: load executions from localStorage or API
        const stored = localStorage.getItem(`xclaw:exec:${workflowId}`);
        if (stored) {
            try {
                setExecutions(JSON.parse(stored));
            } catch { /* ignore */ }
        }
    }, [workflowId]);

    const addExecution = (exec: ExecutionRecord) => {
        setExecutions(prev => {
            const next = [exec, ...prev].slice(0, 50); // keep last 50
            if (workflowId) {
                localStorage.setItem(`xclaw:exec:${workflowId}`, JSON.stringify(next));
            }
            return next;
        });
    };

    // Expose addExecution via a stable ref (parent can call via ref)
    (ExecutionHistory as any)._addExecution = addExecution;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700">
                <History size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-white flex-1">Execution History</span>
                <span className="text-[10px] text-slate-500">{executions.length} runs</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {executions.length === 0 ? (
                    <div className="px-3 py-8 text-xs text-slate-500 text-center">
                        No executions yet. Click Run to execute the workflow.
                    </div>
                ) : (
                    executions.map(exec => (
                        <button
                            key={exec.id}
                            onClick={() => onViewDetails?.(exec.id)}
                            className="w-full text-left px-3 py-2.5 border-b border-dark-800 hover:bg-dark-800 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <ExecStatusIcon status={exec.status} />
                                <span className="flex-1 text-xs text-white truncate">
                                    {new Date(exec.startTime).toLocaleString()}
                                </span>
                                <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400" />
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-5">
                                <span className="text-[10px] text-slate-500">
                                    {exec.completedNodes}/{exec.nodeCount} nodes
                                </span>
                                {exec.endTime && (
                                    <span className="text-[10px] text-slate-500">
                                        {formatElapsed(new Date(exec.startTime), new Date(exec.endTime))}
                                    </span>
                                )}
                                {exec.error && (
                                    <span className="text-[10px] text-red-400 truncate max-w-[120px]">
                                        {exec.error}
                                    </span>
                                )}
                            </div>
                            {onReplay && exec.status !== 'running' && (
                                <button
                                    onClick={e => { e.stopPropagation(); onReplay(exec.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white"
                                    title="Replay"
                                >
                                    <RefreshCw size={12} />
                                </button>
                            )}
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

function ExecStatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 size={12} className="text-green-400 shrink-0" />;
        case 'failed':
            return <XCircle size={12} className="text-red-400 shrink-0" />;
        default:
            return <Clock size={12} className="text-blue-400 shrink-0" />;
    }
}

function formatElapsed(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}
