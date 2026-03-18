import { useState, useEffect } from 'react';
import {
    Brain, Cpu, Loader2, Play, BarChart3, Zap, Database,
    ChevronDown, ChevronRight, CheckCircle, AlertCircle, Settings,
} from 'lucide-react';
import { getMLAlgorithms, getMLModels, trainMLModel, runAutoML } from '../lib/api';

type Tab = 'algorithms' | 'train' | 'automl' | 'models';

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
    { id: 'algorithms', label: 'Algorithms', icon: Brain },
    { id: 'train', label: 'Train Model', icon: Play },
    { id: 'automl', label: 'AutoML', icon: Zap },
    { id: 'models', label: 'Model Registry', icon: Database },
];

export function MLPage() {
    const [activeTab, setActiveTab] = useState<Tab>('algorithms');
    const [algorithms, setAlgorithms] = useState<any[]>([]);
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getMLAlgorithms().catch(() => ({ algorithms: [] })),
            getMLModels().catch(() => ({ models: [] })),
        ]).then(([a, m]) => {
            if (a.algorithms) setAlgorithms(a.algorithms);
            if (m.models) setModels(m.models);
            setLoading(false);
        });
    }, []);

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <div className="px-6 pt-5 pb-0">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <Brain size={18} style={{ color: 'var(--color-primary)' }} />
                        <h1 className="text-xl font-bold" style={{ color: 'var(--color-fg)' }}>ML / AutoML</h1>
                    </div>
                    <p className="text-xs mb-4" style={{ color: 'var(--color-fg-muted)' }}>
                        Machine Learning toolkit — {algorithms.length} algorithms · {models.length} trained models
                    </p>

                    {/* Tabs */}
                    <div className="flex gap-0.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer -mb-px"
                                style={{
                                    borderColor: activeTab === id ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === id ? 'var(--color-primary-light)' : 'var(--color-fg-muted)',
                                }}
                            >
                                <Icon size={13} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
                <div className="max-w-5xl mx-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : (
                        <>
                            {activeTab === 'algorithms' && <AlgorithmsTab algorithms={algorithms} />}
                            {activeTab === 'train' && <TrainTab algorithms={algorithms} onTrained={() => getMLModels().then(m => { if (m.models) setModels(m.models); }).catch(() => { })} />}
                            {activeTab === 'automl' && <AutoMLTab onTrained={() => getMLModels().then(m => { if (m.models) setModels(m.models); }).catch(() => { })} />}
                            {activeTab === 'models' && <ModelsTab models={models} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Algorithms Tab ───────────────────────────────── */
function AlgorithmsTab({ algorithms }: { algorithms: any[] }) {
    const taskTypes = [...new Set(algorithms.map((a) => a.taskType || a.type || 'general'))];

    return (
        <div className="space-y-4">
            {taskTypes.map((type) => {
                const algs = algorithms.filter((a) => (a.taskType || a.type || 'general') === type);
                return (
                    <div key={type} className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <Brain size={14} style={{ color: 'var(--color-primary)' }} />
                            <h3 className="text-xs font-semibold capitalize" style={{ color: 'var(--color-fg)' }}>
                                {type} ({algs.length})
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {algs.map((a) => (
                                <div key={a.id || a.name} className="p-2.5 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                                    <p className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>{a.name}</p>
                                    {a.description && (
                                        <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-fg-muted)' }}>{a.description}</p>
                                    )}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {a.hyperparameters && Object.keys(a.hyperparameters).slice(0, 3).map((hp) => (
                                            <span key={hp} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                                                style={{ background: 'var(--color-bg-surface)', color: 'var(--color-fg-muted)' }}
                                            >
                                                {hp}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            {algorithms.length === 0 && (
                <p className="text-xs py-10 text-center" style={{ color: 'var(--color-fg-muted)' }}>No algorithms available.</p>
            )}
        </div>
    );
}

/* ─── Train Tab ────────────────────────────────────── */
function TrainTab({ algorithms, onTrained }: { algorithms: any[]; onTrained: () => void }) {
    const [algorithm, setAlgorithm] = useState('');
    const [datasetText, setDatasetText] = useState('');
    const [target, setTarget] = useState('');
    const [training, setTraining] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const parseCSV = (text: string, targetCol: string) => {
        const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim()));
        if (lines.length < 2) throw new Error('Need header + at least 1 row');
        const headers = lines[0];
        const tIdx = headers.findIndex(h => h.toLowerCase() === targetCol.toLowerCase());
        if (tIdx === -1) throw new Error(`Column "${targetCol}" not found. Available: ${headers.join(', ')}`);
        const featureNames = headers.filter((_, i) => i !== tIdx);
        const features: number[][] = [];
        const labels: (string | number)[] = [];
        for (let r = 1; r < lines.length; r++) {
            const row = lines[r];
            if (row.length !== headers.length) continue;
            labels.push(isNaN(Number(row[tIdx])) ? row[tIdx] : Number(row[tIdx]));
            features.push(row.filter((_, i) => i !== tIdx).map(v => Number(v) || 0));
        }
        return { features, labels, featureNames };
    };

    const handleTrain = async () => {
        if (!algorithm || !datasetText || !target) return;
        setTraining(true);
        setResult(null);
        setError('');
        try {
            const dataset = parseCSV(datasetText, target);
            const res = await trainMLModel({ algorithm, dataset });
            setResult(res);
            onTrained();
        } catch (err: any) {
            setError(err.message || 'Training failed');
        }
        setTraining(false);
    };

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <Play size={14} style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Train a Model</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Algorithm</label>
                        <select
                            value={algorithm}
                            onChange={(e) => setAlgorithm(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        >
                            <option value="">Select algorithm...</option>
                            {algorithms.map((a) => (
                                <option key={a.id || a.name} value={a.id || a.name}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Target Column</label>
                        <input
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="e.g. species, price..."
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Dataset (CSV format)</label>
                        <textarea
                            value={datasetText}
                            onChange={(e) => setDatasetText(e.target.value)}
                            placeholder={"sepal_length,sepal_width,petal_length,petal_width,species\n5.1,3.5,1.4,0.2,setosa\n7.0,3.2,4.7,1.4,versicolor"}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono resize-y"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                </div>
                <button
                    onClick={handleTrain}
                    disabled={training || !algorithm || !datasetText || !target}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                >
                    {training ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    {training ? 'Training...' : 'Start Training'}
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-lg border flex items-center gap-2" style={{ borderColor: 'var(--color-destructive)', background: 'rgba(239,68,68,0.1)' }}>
                    <AlertCircle size={14} style={{ color: 'var(--color-destructive)' }} />
                    <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>
                </div>
            )}

            {result && (
                <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                        <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>Training Complete</h3>
                    </div>
                    <pre className="text-[11px] p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ─── AutoML Tab ───────────────────────────────────── */
function AutoMLTab({ onTrained }: { onTrained: () => void }) {
    const [datasetText, setDatasetText] = useState('');
    const [target, setTarget] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const parseCSV = (text: string, targetCol: string) => {
        const lines = text.trim().split('\n').map(l => l.split(',').map(c => c.trim()));
        if (lines.length < 2) throw new Error('Need header + at least 1 row');
        const headers = lines[0];
        const tIdx = headers.findIndex(h => h.toLowerCase() === targetCol.toLowerCase());
        if (tIdx === -1) throw new Error(`Column "${targetCol}" not found`);
        const featureNames = headers.filter((_, i) => i !== tIdx);
        const features: number[][] = [];
        const labels: (string | number)[] = [];
        for (let r = 1; r < lines.length; r++) {
            const row = lines[r];
            if (row.length !== headers.length) continue;
            labels.push(isNaN(Number(row[tIdx])) ? row[tIdx] : Number(row[tIdx]));
            features.push(row.filter((_, i) => i !== tIdx).map(v => Number(v) || 0));
        }
        return { features, labels, featureNames };
    };

    const handleRun = async () => {
        if (!datasetText || !target) return;
        setRunning(true);
        setResult(null);
        setError('');
        try {
            const dataset = parseCSV(datasetText, target);
            const res = await runAutoML({ dataset });
            setResult(res);
            onTrained();
        } catch (err: any) {
            setError(err.message || 'AutoML failed');
        }
        setRunning(false);
    };

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>AutoML Pipeline</h3>
                </div>
                <p className="text-[11px] mb-3" style={{ color: 'var(--color-fg-muted)' }}>
                    Automatically selects the best algorithm and hyperparameters for your dataset.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="col-span-2">
                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Dataset (CSV format)</label>
                        <textarea
                            value={datasetText}
                            onChange={(e) => setDatasetText(e.target.value)}
                            placeholder={"col1,col2,target\n1.0,2.0,A\n3.0,4.0,B"}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none font-mono resize-y"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--color-fg-muted)' }}>Target Column</label>
                        <input
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="e.g. species, price..."
                            className="w-full px-3 py-2 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                        />
                    </div>
                </div>
                <button
                    onClick={handleRun}
                    disabled={running || !datasetText || !target}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                    style={{ background: 'var(--color-accent)', color: 'white' }}
                >
                    {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {running ? 'Running AutoML...' : 'Run AutoML'}
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-lg border flex items-center gap-2" style={{ borderColor: 'var(--color-destructive)', background: 'rgba(239,68,68,0.1)' }}>
                    <AlertCircle size={14} style={{ color: 'var(--color-destructive)' }} />
                    <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>
                </div>
            )}

            {result && (
                <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                        <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>AutoML Results</h3>
                    </div>
                    <pre className="text-[11px] p-2 rounded-lg overflow-x-auto" style={{ background: 'var(--color-bg)', color: 'var(--color-fg-muted)' }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ─── Models Tab ───────────────────────────────────── */
function ModelsTab({ models }: { models: any[] }) {
    return (
        <div className="space-y-4">
            <div className="p-4 rounded-xl border" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <Database size={14} style={{ color: 'var(--color-primary)' }} />
                    <h3 className="text-xs font-semibold" style={{ color: 'var(--color-fg)' }}>
                        Trained Models ({models.length})
                    </h3>
                </div>
                {models.length === 0 ? (
                    <p className="text-xs py-8 text-center" style={{ color: 'var(--color-fg-muted)' }}>
                        No trained models yet. Train a model or run AutoML to get started.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {models.map((m, i) => (
                            <div key={m.id || i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: 'var(--color-primary-soft)' }}
                                >
                                    <BarChart3 size={14} style={{ color: 'var(--color-primary)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-fg)' }}>
                                        {m.name || m.algorithm || `Model #${i + 1}`}
                                    </p>
                                    <p className="text-[10px]" style={{ color: 'var(--color-fg-muted)' }}>
                                        {m.algorithm && `${m.algorithm} · `}
                                        {m.accuracy ? `Accuracy: ${(m.accuracy * 100).toFixed(1)}%` : ''}
                                        {m.trainedAt && ` · ${new Date(m.trainedAt).toLocaleDateString()}`}
                                    </p>
                                </div>
                                {m.accuracy && (
                                    <span className="text-[11px] px-2 py-0.5 rounded font-bold"
                                        style={{
                                            background: m.accuracy > 0.9 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                            color: m.accuracy > 0.9 ? 'var(--color-success)' : '#f59e0b',
                                        }}
                                    >
                                        {(m.accuracy * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
