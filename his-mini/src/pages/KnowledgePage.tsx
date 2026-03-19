import { useState, useEffect, useCallback, useRef } from 'react';
import {
    BookOpen, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    FolderPlus, Folder, Trash2, Edit3, X, Check, Filter, Pill, AlertTriangle,
    FileText, Loader2, ChevronDown, ChevronUp, Plus, Package,
} from 'lucide-react';
import {
    getKnowledgeDrugs, getKnowledgeInteractions, getKnowledgeICD10,
    getKnowledgeCollections, createKnowledgeCollection, updateKnowledgeCollection,
    deleteKnowledgeCollection, getKnowledgeStats,
} from '../api';

type Tab = 'drugs' | 'interactions' | 'icd10';

interface Drug {
    id: string; brandName: string; genericName: string;
    substances: { name: string; rxnorm: string; strength: string }[];
    pharmacoGroup: string; atcCode: string; dosageForm: string;
    commonDosage: string; bhyt: boolean; manufacturer?: string;
}

interface Interaction {
    id: string;
    drugA: { code: string; display: string };
    drugB: { code: string; display: string };
    severity: string; description: string; mechanism?: string;
}

interface ICD10 {
    code: string; title: string; titleEn: string; chapter: string;
}

interface Collection {
    id: string; name: string; description: string;
    type: 'drug' | 'interaction' | 'icd10';
    itemIds: string[];
    createdAt: string; updatedAt: string;
}

interface KnowledgeStats {
    drugs: number; interactions: number; icd10: number; collections: number;
}

// ─── Debounce hook ───
function useDebounce(value: string, delay: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

export function KnowledgePage() {
    const [tab, setTab] = useState<Tab>('drugs');
    const [stats, setStats] = useState<KnowledgeStats | null>(null);

    useEffect(() => { getKnowledgeStats().then(setStats); }, []);

    const TABS: { id: Tab; label: string; icon: typeof Pill; count?: number }[] = [
        { id: 'drugs', label: 'Danh mục thuốc', icon: Pill, count: stats?.drugs },
        { id: 'interactions', label: 'Tương tác thuốc', icon: AlertTriangle, count: stats?.interactions },
        { id: 'icd10', label: 'ICD-10', icon: FileText, count: stats?.icd10 },
    ];

    return (
        <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--his-info-soft)', color: 'var(--his-info)' }}>
                        <BookOpen size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold" style={{ color: 'var(--his-fg)' }}>Knowledge Base</h1>
                        <p className="text-xs" style={{ color: 'var(--his-fg-muted)' }}>
                            Quản lý danh mục thuốc, tương tác, mã ICD-10
                            {stats && <span className="ml-2">• {stats.collections} collections</span>}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer"
                        style={{
                            background: tab === t.id ? 'var(--his-primary-soft)' : 'var(--his-surface)',
                            color: tab === t.id ? 'var(--his-primary)' : 'var(--his-fg-secondary)',
                            border: `1px solid ${tab === t.id ? 'var(--his-primary)' : 'var(--his-border)'}`,
                        }}>
                        <t.icon size={15} />
                        {t.label}
                        {t.count != null && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{
                                background: tab === t.id ? 'var(--his-primary)' : 'var(--his-surface-alt)',
                                color: tab === t.id ? '#fff' : 'var(--his-fg-muted)',
                            }}>{t.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === 'drugs' && <DrugTable />}
            {tab === 'interactions' && <InteractionTable />}
            {tab === 'icd10' && <ICD10Table />}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// Drug DataTable with Collections
// ═══════════════════════════════════════════════════

function DrugTable() {
    const [data, setData] = useState<Drug[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [groups, setGroups] = useState<string[]>([]);
    const [filterGroup, setFilterGroup] = useState('');
    const [filterBhyt, setFilterBhyt] = useState('');
    const [sortBy, setSortBy] = useState('brandName');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Collections
    const [collections, setCollections] = useState<Collection[]>([]);
    const [activeCollection, setActiveCollection] = useState('');
    const [showCollections, setShowCollections] = useState(false);
    const [showCreateCollection, setShowCreateCollection] = useState(false);
    const [editingCollection, setEditingCollection] = useState<string | null>(null);
    const [collectionForm, setCollectionForm] = useState({ name: '', description: '' });

    // Selected rows for adding to collection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Expanded row
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getKnowledgeDrugs({
                q: debouncedSearch || undefined, page, limit,
                group: filterGroup || undefined,
                bhyt: filterBhyt || undefined,
                collectionId: activeCollection || undefined,
                sortBy, sortDir,
            });
            setData(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
            if (res.groups) setGroups(res.groups);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, page, limit, filterGroup, filterBhyt, activeCollection, sortBy, sortDir]);

    const fetchCollections = useCallback(() => {
        getKnowledgeCollections('drug').then(res => setCollections(res.collections));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchCollections(); }, [fetchCollections]);
    useEffect(() => { setPage(1); }, [debouncedSearch, filterGroup, filterBhyt, activeCollection]);

    const toggleSort = (col: string) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(data.map(d => d.id)));
    };

    const handleCreateCollection = async () => {
        if (!collectionForm.name.trim()) return;
        await createKnowledgeCollection({
            name: collectionForm.name, description: collectionForm.description,
            type: 'drug', itemIds: [...selectedIds],
        });
        setCollectionForm({ name: '', description: '' });
        setShowCreateCollection(false);
        setSelectedIds(new Set());
        fetchCollections();
    };

    const handleAddToCollection = async (colId: string) => {
        const col = collections.find(c => c.id === colId);
        if (!col) return;
        const merged = [...new Set([...col.itemIds, ...selectedIds])];
        await updateKnowledgeCollection(colId, { itemIds: merged });
        setSelectedIds(new Set());
        fetchCollections();
        fetchData();
    };

    const handleDeleteCollection = async (colId: string) => {
        await deleteKnowledgeCollection(colId);
        if (activeCollection === colId) setActiveCollection('');
        fetchCollections();
    };

    const handleRenameCollection = async (colId: string) => {
        if (!collectionForm.name.trim()) return;
        await updateKnowledgeCollection(colId, { name: collectionForm.name, description: collectionForm.description });
        setEditingCollection(null);
        setCollectionForm({ name: '', description: '' });
        fetchCollections();
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortBy !== col) return <ChevronDown size={12} className="opacity-30" />;
        return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    };

    return (
        <div className="flex gap-4">
            {/* Collections Sidebar */}
            <div className="w-[220px] shrink-0 space-y-2">
                <div className="his-card p-3">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--his-fg-muted)' }}>
                            <Folder size={13} className="inline mr-1" />Collections
                        </span>
                        <button onClick={() => { setShowCreateCollection(true); setCollectionForm({ name: '', description: '' }); }}
                            className="p-1 rounded hover:bg-gray-100 cursor-pointer" title="Tạo collection mới">
                            <FolderPlus size={14} style={{ color: 'var(--his-primary)' }} />
                        </button>
                    </div>

                    {/* All items */}
                    <button onClick={() => setActiveCollection('')}
                        className="w-full text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium mb-1 cursor-pointer transition-all"
                        style={{
                            background: !activeCollection ? 'var(--his-primary-soft)' : 'transparent',
                            color: !activeCollection ? 'var(--his-primary)' : 'var(--his-fg-secondary)',
                        }}>
                        <Package size={13} className="inline mr-1.5" />
                        Tất cả ({total})
                    </button>

                    {/* Collection list */}
                    {collections.map(col => (
                        <div key={col.id} className="group flex items-center gap-1">
                            {editingCollection === col.id ? (
                                <div className="flex-1 flex gap-1">
                                    <input className="his-input !py-1 !px-2 !text-[11px]" value={collectionForm.name}
                                        onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleRenameCollection(col.id)} autoFocus />
                                    <button onClick={() => handleRenameCollection(col.id)} className="p-0.5 cursor-pointer"><Check size={12} style={{ color: 'var(--his-success)' }} /></button>
                                    <button onClick={() => setEditingCollection(null)} className="p-0.5 cursor-pointer"><X size={12} /></button>
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => setActiveCollection(activeCollection === col.id ? '' : col.id)}
                                        className="flex-1 text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all"
                                        style={{
                                            background: activeCollection === col.id ? 'var(--his-primary-soft)' : 'transparent',
                                            color: activeCollection === col.id ? 'var(--his-primary)' : 'var(--his-fg-secondary)',
                                        }}>
                                        <Folder size={13} className="inline mr-1.5" />
                                        {col.name}
                                        <span className="ml-1 text-[10px] opacity-60">({col.itemIds.length})</span>
                                    </button>
                                    <button onClick={() => { setEditingCollection(col.id); setCollectionForm({ name: col.name, description: col.description }); }}
                                        className="p-0.5 opacity-0 group-hover:opacity-100 cursor-pointer"><Edit3 size={11} /></button>
                                    <button onClick={() => handleDeleteCollection(col.id)}
                                        className="p-0.5 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 size={11} style={{ color: 'var(--his-danger)' }} /></button>
                                </>
                            )}
                        </div>
                    ))}

                    {/* Create collection form */}
                    {showCreateCollection && (
                        <div className="mt-2 p-2 rounded-lg" style={{ background: 'var(--his-surface-alt)', border: '1px solid var(--his-border)' }}>
                            <input className="his-input !py-1.5 !text-[12px] mb-1.5" placeholder="Tên collection"
                                value={collectionForm.name} onChange={e => setCollectionForm(f => ({ ...f, name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleCreateCollection()} autoFocus />
                            <input className="his-input !py-1.5 !text-[12px] mb-2" placeholder="Mô tả (tùy chọn)"
                                value={collectionForm.description} onChange={e => setCollectionForm(f => ({ ...f, description: e.target.value }))} />
                            <div className="flex gap-1">
                                <button onClick={handleCreateCollection}
                                    className="flex-1 px-2 py-1 rounded-md text-[11px] font-medium text-white cursor-pointer" style={{ background: 'var(--his-primary)' }}>
                                    {selectedIds.size > 0 ? `Tạo (${selectedIds.size} thuốc)` : 'Tạo rỗng'}
                                </button>
                                <button onClick={() => setShowCreateCollection(false)}
                                    className="px-2 py-1 rounded-md text-[11px] cursor-pointer" style={{ border: '1px solid var(--his-border)' }}>Hủy</button>
                            </div>
                        </div>
                    )}

                    {/* Add selected to existing collection */}
                    {selectedIds.size > 0 && collections.length > 0 && !showCreateCollection && (
                        <div className="mt-2 p-2 rounded-lg" style={{ background: 'var(--his-info-soft)', border: '1px solid var(--his-info)' }}>
                            <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--his-info)' }}>
                                <Plus size={12} className="inline mr-1" />
                                Thêm {selectedIds.size} thuốc vào:
                            </p>
                            {collections.map(col => (
                                <button key={col.id} onClick={() => handleAddToCollection(col.id)}
                                    className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-white/50 cursor-pointer">
                                    {col.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Table */}
            <div className="flex-1 min-w-0 space-y-3">
                {/* Toolbar */}
                <div className="his-card p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--his-fg-muted)' }} />
                            <input className="his-input !pl-9 !py-2 !text-[13px]" placeholder="Tìm thuốc (tên, hoạt chất, ATC)..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        {/* Group filter */}
                        <select className="his-input !w-auto !py-2 !pr-8 !text-[12px]" value={filterGroup}
                            onChange={e => setFilterGroup(e.target.value)}>
                            <option value="">Tất cả nhóm</option>
                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {/* BHYT filter */}
                        <select className="his-input !w-auto !py-2 !pr-8 !text-[12px]" value={filterBhyt}
                            onChange={e => setFilterBhyt(e.target.value)}>
                            <option value="">BHYT: Tất cả</option>
                            <option value="true">Có BHYT</option>
                            <option value="false">Không BHYT</option>
                        </select>
                        {/* Active collection badge */}
                        {activeCollection && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                                style={{ background: 'var(--his-primary-soft)', color: 'var(--his-primary)' }}>
                                <Filter size={11} />
                                {collections.find(c => c.id === activeCollection)?.name}
                                <button onClick={() => setActiveCollection('')} className="ml-1 cursor-pointer"><X size={11} /></button>
                            </span>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="his-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr style={{ background: 'var(--his-surface-alt)', borderBottom: '1px solid var(--his-border)' }}>
                                    <th className="px-3 py-2.5 text-left w-8">
                                        <input type="checkbox" checked={data.length > 0 && selectedIds.size === data.length}
                                            onChange={toggleSelectAll} className="accent-sky-500" />
                                    </th>
                                    <ThSortable label="Biệt dược" col="brandName" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                                    <ThSortable label="Hoạt chất" col="genericName" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                                    <ThSortable label="Nhóm dược lý" col="pharmacoGroup" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>ATC</th>
                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Dạng bào chế</th>
                                    <th className="px-3 py-2.5 text-center font-semibold" style={{ color: 'var(--his-fg-muted)' }}>BHYT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={7} className="text-center py-12">
                                        <Loader2 size={20} className="animate-spin inline mr-2" style={{ color: 'var(--his-primary)' }} />
                                        <span style={{ color: 'var(--his-fg-muted)' }}>Đang tải...</span>
                                    </td></tr>
                                )}
                                {!loading && data.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--his-fg-muted)' }}>
                                        Không tìm thấy kết quả
                                    </td></tr>
                                )}
                                {!loading && data.map(drug => (
                                    <DrugRow key={drug.id} drug={drug}
                                        selected={selectedIds.has(drug.id)}
                                        expanded={expandedId === drug.id}
                                        onSelect={() => toggleSelect(drug.id)}
                                        onExpand={() => setExpandedId(expandedId === drug.id ? null : drug.id)} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
                        loading={loading} onPageChange={setPage} />
                </div>
            </div>
        </div>
    );
}

// ─── Drug Row ───
function DrugRow({ drug, selected, expanded, onSelect, onExpand }: {
    drug: Drug; selected: boolean; expanded: boolean;
    onSelect: () => void; onExpand: () => void;
}) {
    return (
        <>
            <tr className="cursor-pointer hover:bg-sky-50/30 transition-colors"
                style={{ borderBottom: '1px solid var(--his-border-light)' }}
                onClick={onExpand}>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected} onChange={onSelect} className="accent-sky-500" />
                </td>
                <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--his-fg)' }}>{drug.brandName}</td>
                <td className="px-3 py-2.5" style={{ color: 'var(--his-fg-secondary)' }}>{drug.genericName}</td>
                <td className="px-3 py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--his-surface-alt)', color: 'var(--his-fg-secondary)' }}>
                        {drug.pharmacoGroup}
                    </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px]" style={{ color: 'var(--his-fg-muted)' }}>{drug.atcCode}</td>
                <td className="px-3 py-2.5" style={{ color: 'var(--his-fg-secondary)' }}>{drug.dosageForm}</td>
                <td className="px-3 py-2.5 text-center">
                    {drug.bhyt
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--his-success-soft)', color: 'var(--his-success)' }}>BHYT</span>
                        : <span className="text-[10px]" style={{ color: 'var(--his-fg-muted)' }}>—</span>}
                </td>
            </tr>
            {expanded && (
                <tr style={{ background: 'var(--his-surface-alt)' }}>
                    <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4 text-[12px]">
                            <div>
                                <div className="font-semibold mb-1" style={{ color: 'var(--his-fg-muted)' }}>Thành phần hoạt chất</div>
                                {drug.substances.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span style={{ color: 'var(--his-fg)' }}>{s.name}</span>
                                        <span style={{ color: 'var(--his-fg-muted)' }}>{s.strength}</span>
                                        <span className="font-mono text-[10px]" style={{ color: 'var(--his-fg-muted)' }}>RxNorm: {s.rxnorm}</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div className="font-semibold mb-1" style={{ color: 'var(--his-fg-muted)' }}>Liều dùng thường</div>
                                <p style={{ color: 'var(--his-fg)' }}>{drug.commonDosage}</p>
                                {drug.manufacturer && (
                                    <div className="mt-2">
                                        <span className="font-semibold" style={{ color: 'var(--his-fg-muted)' }}>NSX: </span>
                                        <span style={{ color: 'var(--his-fg)' }}>{drug.manufacturer}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════
// Interaction DataTable
// ═══════════════════════════════════════════════════

function InteractionTable() {
    const [data, setData] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [filterSeverity, setFilterSeverity] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getKnowledgeInteractions({
                q: debouncedSearch || undefined, page, limit,
                severity: filterSeverity || undefined,
            });
            setData(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        } finally { setLoading(false); }
    }, [debouncedSearch, page, limit, filterSeverity]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(1); }, [debouncedSearch, filterSeverity]);

    const severityColor = (s: string) => {
        if (s === 'critical' || s === 'high') return { bg: 'var(--his-danger-soft)', color: 'var(--his-danger)' };
        if (s === 'moderate') return { bg: 'var(--his-warning-soft)', color: 'var(--his-warning)' };
        return { bg: 'var(--his-surface-alt)', color: 'var(--his-fg-muted)' };
    };

    return (
        <div className="space-y-3">
            <div className="his-card p-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--his-fg-muted)' }} />
                        <input className="his-input !pl-9 !py-2 !text-[13px]" placeholder="Tìm tương tác thuốc..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="his-input !w-auto !py-2 !pr-8 !text-[12px]" value={filterSeverity}
                        onChange={e => setFilterSeverity(e.target.value)}>
                        <option value="">Tất cả mức độ</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="moderate">Moderate</option>
                        <option value="low">Low</option>
                    </select>
                </div>
            </div>

            <div className="his-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr style={{ background: 'var(--his-surface-alt)', borderBottom: '1px solid var(--his-border)' }}>
                                <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Thuốc A</th>
                                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: 'var(--his-fg-muted)' }}>⇄</th>
                                <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Thuốc B</th>
                                <th className="px-3 py-2.5 text-center font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Mức độ</th>
                                <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Mô tả</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={5} className="text-center py-12">
                                    <Loader2 size={20} className="animate-spin inline mr-2" style={{ color: 'var(--his-primary)' }} />
                                    <span style={{ color: 'var(--his-fg-muted)' }}>Đang tải...</span>
                                </td></tr>
                            )}
                            {!loading && data.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-12" style={{ color: 'var(--his-fg-muted)' }}>Không tìm thấy kết quả</td></tr>
                            )}
                            {!loading && data.map(item => {
                                const sc = severityColor(item.severity);
                                return (
                                    <tr key={item.id}
                                        className="cursor-pointer hover:bg-sky-50/30 transition-colors"
                                        style={{ borderBottom: '1px solid var(--his-border-light)' }}
                                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                                        <td className="px-3 py-2.5 font-medium capitalize" style={{ color: 'var(--his-fg)' }}>{item.drugA.display}</td>
                                        <td className="px-3 py-2.5 text-center" style={{ color: 'var(--his-fg-muted)' }}>⇄</td>
                                        <td className="px-3 py-2.5 font-medium capitalize" style={{ color: 'var(--his-fg)' }}>{item.drugB.display}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                                                style={{ background: sc.bg, color: sc.color }}>{item.severity}</span>
                                        </td>
                                        <td className="px-3 py-2.5 max-w-xs truncate" style={{ color: 'var(--his-fg-secondary)' }}>{item.description}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
                    loading={loading} onPageChange={setPage} />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// ICD-10 DataTable
// ═══════════════════════════════════════════════════

function ICD10Table() {
    const [data, setData] = useState<ICD10[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [chapters, setChapters] = useState<string[]>([]);
    const [filterChapter, setFilterChapter] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getKnowledgeICD10({
                q: debouncedSearch || undefined, page, limit,
                chapter: filterChapter || undefined,
            });
            setData(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
            if (res.chapters) setChapters(res.chapters);
        } finally { setLoading(false); }
    }, [debouncedSearch, page, limit, filterChapter]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(1); }, [debouncedSearch, filterChapter]);

    return (
        <div className="space-y-3">
            <div className="his-card p-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--his-fg-muted)' }} />
                        <input className="his-input !pl-9 !py-2 !text-[13px]" placeholder="Tìm mã bệnh ICD-10 (mã, tên VN, tên EN)..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="his-input !w-auto !py-2 !pr-8 !text-[12px]" value={filterChapter}
                        onChange={e => setFilterChapter(e.target.value)}>
                        <option value="">Tất cả chương</option>
                        {chapters.map(ch => <option key={ch} value={ch}>Chương {ch}</option>)}
                    </select>
                </div>
            </div>

            <div className="his-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr style={{ background: 'var(--his-surface-alt)', borderBottom: '1px solid var(--his-border)' }}>
                                <th className="px-3 py-2.5 text-left font-semibold w-24" style={{ color: 'var(--his-fg-muted)' }}>Mã ICD-10</th>
                                <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Tên bệnh (VN)</th>
                                <th className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--his-fg-muted)' }}>Tên bệnh (EN)</th>
                                <th className="px-3 py-2.5 text-center font-semibold w-24" style={{ color: 'var(--his-fg-muted)' }}>Chương</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={4} className="text-center py-12">
                                    <Loader2 size={20} className="animate-spin inline mr-2" style={{ color: 'var(--his-primary)' }} />
                                    <span style={{ color: 'var(--his-fg-muted)' }}>Đang tải...</span>
                                </td></tr>
                            )}
                            {!loading && data.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-12" style={{ color: 'var(--his-fg-muted)' }}>Không tìm thấy kết quả</td></tr>
                            )}
                            {!loading && data.map(item => (
                                <tr key={item.code} className="hover:bg-sky-50/30 transition-colors"
                                    style={{ borderBottom: '1px solid var(--his-border-light)' }}>
                                    <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: 'var(--his-primary)' }}>{item.code}</td>
                                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--his-fg)' }}>{item.title}</td>
                                    <td className="px-3 py-2.5" style={{ color: 'var(--his-fg-secondary)' }}>{item.titleEn}</td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--his-surface-alt)', color: 'var(--his-fg-secondary)' }}>
                                            {item.chapter}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
                    loading={loading} onPageChange={setPage} />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════

function ThSortable({ label, col, sortBy, sortDir, onToggle }: {
    label: string; col: string; sortBy: string; sortDir: string; onToggle: (col: string) => void;
}) {
    return (
        <th className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none"
            style={{ color: 'var(--his-fg-muted)' }} onClick={() => onToggle(col)}>
            <span className="inline-flex items-center gap-1">
                {label}
                {sortBy === col
                    ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                    : <ChevronDown size={12} className="opacity-30" />}
            </span>
        </th>
    );
}

function Pagination({ page, totalPages, total, limit, loading, onPageChange }: {
    page: number; totalPages: number; total: number; limit: number; loading: boolean;
    onPageChange: (p: number) => void;
}) {
    if (totalPages <= 1 && total <= limit) return null;
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    return (
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--his-border)' }}>
            <span className="text-[12px]" style={{ color: 'var(--his-fg-muted)' }}>
                Hiển thị {start}–{end} / {total} kết quả
            </span>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(1)} disabled={page <= 1 || loading}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronsLeft size={14} /></button>
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronLeft size={14} /></button>
                <span className="text-[12px] px-3 font-medium" style={{ color: 'var(--his-fg-secondary)' }}>
                    {page} / {totalPages}
                </span>
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronRight size={14} /></button>
                <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages || loading}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 cursor-pointer"><ChevronsRight size={14} /></button>
            </div>
        </div>
    );
}
