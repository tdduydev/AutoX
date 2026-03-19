import { useState, useEffect, useCallback } from 'react';
import {
    Users, Plus, Search, Edit2, Trash2, Shield, Lock,
    ChevronLeft, ChevronRight, X, Check, Eye, EyeOff, UserCog,
} from 'lucide-react';
import {
    getUsers, createUser, updateUser, deleteUser,
    getRoles, getPermissions, createRole, updateRole, deleteRole,
} from '../api';

// ─── Types ───

interface UserItem {
    id: string;
    name: string;
    email: string;
    role: string;
    roleName: string;
    department: string;
    status: 'active' | 'inactive' | 'locked';
    permissions: string[];
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}

interface RoleItem {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: string;
}

type TabId = 'users' | 'roles';

// ─── Status badge ───

function StatusBadge({ status }: { status: string }) {
    const color = status === 'active' ? '#16a34a' : status === 'locked' ? '#dc2626' : '#94a3b8';
    const label = status === 'active' ? 'Hoạt động' : status === 'locked' ? 'Bị khóa' : 'Vô hiệu';
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
        </span>
    );
}

// ─── Main Component ───

export function UserManagementPage() {
    const [tab, setTab] = useState<TabId>('users');

    // Users state
    const [users, setUsers] = useState<UserItem[]>([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [usersPage, setUsersPage] = useState(1);
    const [usersTotalPages, setUsersTotalPages] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [departments, setDepartments] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Roles state
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [permGroups, setPermGroups] = useState<Record<string, { key: string; label: string }[]>>({});

    // Modals
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'user' | 'role'; id: string; name: string } | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState('role-doctor');
    const [formDepartment, setFormDepartment] = useState('');
    const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'locked'>('active');
    const [formError, setFormError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Role form state
    const [roleFormName, setRoleFormName] = useState('');
    const [roleFormDesc, setRoleFormDesc] = useState('');
    const [roleFormPerms, setRoleFormPerms] = useState<string[]>([]);
    const [roleFormError, setRoleFormError] = useState('');

    // ─── Load Users ───
    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getUsers({
                q: userSearch || undefined,
                role: roleFilter || undefined,
                status: statusFilter || undefined,
                page: usersPage,
                limit: 15,
            });
            setUsers(res.data || []);
            setUsersTotal(res.total || 0);
            setUsersTotalPages(res.totalPages || 1);
            setDepartments(res.departments || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [userSearch, roleFilter, statusFilter, usersPage]);

    // ─── Load Roles ───
    const loadRoles = useCallback(async () => {
        try {
            const res = await getRoles();
            setRoles(res.roles || []);
        } catch { /* ignore */ }
    }, []);

    // ─── Load Permissions ───
    const loadPermissions = useCallback(async () => {
        try {
            const res = await getPermissions();
            setPermGroups(res.permissions || {});
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { loadRoles(); loadPermissions(); }, [loadRoles, loadPermissions]);

    // ─── User actions ───
    const openCreateUser = () => {
        setEditingUser(null);
        setFormName(''); setFormEmail(''); setFormPassword('');
        setFormRole('role-doctor'); setFormDepartment(''); setFormStatus('active');
        setFormError(''); setShowPassword(false);
        setShowUserModal(true);
    };

    const openEditUser = (u: UserItem) => {
        setEditingUser(u);
        setFormName(u.name); setFormEmail(u.email); setFormPassword('');
        setFormRole(u.role); setFormDepartment(u.department); setFormStatus(u.status);
        setFormError(''); setShowPassword(false);
        setShowUserModal(true);
    };

    const saveUser = async () => {
        setFormError('');
        if (!formName.trim() || !formEmail.trim()) {
            setFormError('Tên và email là bắt buộc');
            return;
        }
        if (!editingUser && !formPassword.trim()) {
            setFormError('Mật khẩu là bắt buộc khi tạo mới');
            return;
        }

        try {
            if (editingUser) {
                const data: Record<string, string> = {
                    name: formName, email: formEmail, role: formRole,
                    department: formDepartment, status: formStatus,
                };
                if (formPassword.trim()) data.password = formPassword;
                const res = await updateUser(editingUser.id, data);
                if (res.error) { setFormError(res.error); return; }
            } else {
                const res = await createUser({
                    name: formName, email: formEmail, password: formPassword,
                    role: formRole, department: formDepartment, status: formStatus,
                });
                if (res.error) { setFormError(res.error); return; }
            }
            setShowUserModal(false);
            loadUsers();
        } catch {
            setFormError('Lỗi khi lưu');
        }
    };

    const handleDeleteUser = async () => {
        if (!showDeleteConfirm || showDeleteConfirm.type !== 'user') return;
        try {
            const res = await deleteUser(showDeleteConfirm.id);
            if (res.error) { setFormError(res.error); return; }
            setShowDeleteConfirm(null);
            loadUsers();
        } catch { /* ignore */ }
    };

    // ─── Role actions ───
    const openCreateRole = () => {
        setEditingRole(null);
        setRoleFormName(''); setRoleFormDesc(''); setRoleFormPerms([]);
        setRoleFormError('');
        setShowRoleModal(true);
    };

    const openEditRole = (r: RoleItem) => {
        setEditingRole(r);
        setRoleFormName(r.name); setRoleFormDesc(r.description);
        setRoleFormPerms([...r.permissions]); setRoleFormError('');
        setShowRoleModal(true);
    };

    const saveRole = async () => {
        setRoleFormError('');
        if (!roleFormName.trim()) { setRoleFormError('Tên vai trò là bắt buộc'); return; }

        try {
            if (editingRole) {
                const res = await updateRole(editingRole.id, {
                    name: roleFormName, description: roleFormDesc,
                    permissions: roleFormPerms,
                });
                if (res.error) { setRoleFormError(res.error); return; }
            } else {
                const res = await createRole({
                    name: roleFormName, description: roleFormDesc,
                    permissions: roleFormPerms,
                });
                if (res.error) { setRoleFormError(res.error); return; }
            }
            setShowRoleModal(false);
            loadRoles();
        } catch {
            setRoleFormError('Lỗi khi lưu');
        }
    };

    const handleDeleteRole = async () => {
        if (!showDeleteConfirm || showDeleteConfirm.type !== 'role') return;
        try {
            const res = await deleteRole(showDeleteConfirm.id);
            if (res.error) { alert(res.error); setShowDeleteConfirm(null); return; }
            setShowDeleteConfirm(null);
            loadRoles();
        } catch { /* ignore */ }
    };

    const togglePerm = (perm: string) => {
        setRoleFormPerms(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
    };

    // ─── Render ───
    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--his-fg)' }}>
                        Quản lý người dùng
                    </h1>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--his-fg-muted)' }}>
                        Quản lý tài khoản, vai trò và phân quyền hệ thống
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-lg" style={{ background: 'var(--his-primary-soft)', color: 'var(--his-primary)' }}>
                    <Users size={14} />
                    {usersTotal} người dùng • {roles.length} vai trò
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg w-fit" style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}>
                {([
                    { id: 'users' as TabId, label: 'Người dùng', icon: Users },
                    { id: 'roles' as TabId, label: 'Vai trò & Quyền', icon: Shield },
                ] as const).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer"
                        style={{
                            background: tab === t.id ? 'var(--his-primary)' : 'transparent',
                            color: tab === t.id ? '#fff' : 'var(--his-fg-muted)',
                        }}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Users Tab ─── */}
            {tab === 'users' && (
                <div>
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-lg"
                            style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}>
                            <Search size={14} style={{ color: 'var(--his-fg-muted)' }} />
                            <input
                                className="flex-1 bg-transparent text-[13px] outline-none"
                                style={{ color: 'var(--his-fg)' }}
                                placeholder="Tìm tên, email, khoa..."
                                value={userSearch}
                                onChange={e => { setUserSearch(e.target.value); setUsersPage(1); }}
                            />
                        </div>

                        <select
                            className="px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer"
                            style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                            value={roleFilter}
                            onChange={e => { setRoleFilter(e.target.value); setUsersPage(1); }}
                        >
                            <option value="">Tất cả vai trò</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>

                        <select
                            className="px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer"
                            style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setUsersPage(1); }}
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Hoạt động</option>
                            <option value="inactive">Vô hiệu</option>
                            <option value="locked">Bị khóa</option>
                        </select>

                        <button
                            onClick={openCreateUser}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
                            style={{ background: 'var(--his-primary)' }}
                        >
                            <Plus size={14} /> Thêm người dùng
                        </button>
                    </div>

                    {/* Table */}
                    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}>
                        <table className="w-full">
                            <thead>
                                <tr style={{ background: 'var(--his-bg)', borderBottom: '1px solid var(--his-border)' }}>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Người dùng</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Vai trò</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Khoa</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Trạng thái</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Đăng nhập lần cuối</th>
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--his-fg-muted)' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--his-fg-muted)' }}>Đang tải...</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--his-fg-muted)' }}>Không tìm thấy người dùng</td></tr>
                                ) : users.map(u => (
                                    <tr key={u.id} className="transition-colors"
                                        style={{ borderBottom: '1px solid var(--his-border)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--his-bg)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                                                    style={{ background: 'var(--his-primary)' }}>
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-medium" style={{ color: 'var(--his-fg)' }}>{u.name}</div>
                                                    <div className="text-[11px]" style={{ color: 'var(--his-fg-muted)' }}>{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                                                style={{ background: 'var(--his-primary-soft)', color: 'var(--his-primary)' }}>
                                                <Shield size={10} /> {u.roleName}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--his-fg)' }}>{u.department || '—'}</td>
                                        <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                                        <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--his-fg-muted)' }}>
                                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => openEditUser(u)}
                                                    className="p-1.5 rounded-md transition-colors cursor-pointer"
                                                    style={{ color: 'var(--his-fg-muted)' }}
                                                    title="Sửa">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => setShowDeleteConfirm({ type: 'user', id: u.id, name: u.name })}
                                                    className="p-1.5 rounded-md transition-colors cursor-pointer"
                                                    style={{ color: 'var(--his-danger)' }}
                                                    title="Xóa">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {usersTotalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--his-border)' }}>
                                <span className="text-[12px]" style={{ color: 'var(--his-fg-muted)' }}>
                                    Trang {usersPage}/{usersTotalPages} • {usersTotal} kết quả
                                </span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage <= 1}
                                        className="p-1.5 rounded cursor-pointer disabled:opacity-30" style={{ color: 'var(--his-fg-muted)' }}>
                                        <ChevronLeft size={14} />
                                    </button>
                                    <button onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))} disabled={usersPage >= usersTotalPages}
                                        className="p-1.5 rounded cursor-pointer disabled:opacity-30" style={{ color: 'var(--his-fg-muted)' }}>
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Roles Tab ─── */}
            {tab === 'roles' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-[13px]" style={{ color: 'var(--his-fg-muted)' }}>
                            {roles.length} vai trò • Vai trò hệ thống không thể xóa
                        </div>
                        <button
                            onClick={openCreateRole}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
                            style={{ background: 'var(--his-primary)' }}
                        >
                            <Plus size={14} /> Thêm vai trò
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roles.map(r => {
                            const userCount = users.filter(u => u.role === r.id).length;
                            return (
                                <div key={r.id} className="rounded-xl p-4"
                                    style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Shield size={16} style={{ color: 'var(--his-primary)' }} />
                                                <span className="text-[14px] font-semibold" style={{ color: 'var(--his-fg)' }}>{r.name}</span>
                                            </div>
                                            <p className="text-[12px] mt-1" style={{ color: 'var(--his-fg-muted)' }}>{r.description}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEditRole(r)}
                                                className="p-1.5 rounded-md cursor-pointer"
                                                style={{ color: 'var(--his-fg-muted)' }} title="Sửa">
                                                <Edit2 size={13} />
                                            </button>
                                            {!r.isSystem && (
                                                <button onClick={() => setShowDeleteConfirm({ type: 'role', id: r.id, name: r.name })}
                                                    className="p-1.5 rounded-md cursor-pointer"
                                                    style={{ color: 'var(--his-danger)' }} title="Xóa">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3 text-[11px]" style={{ color: 'var(--his-fg-muted)' }}>
                                        <Users size={12} /> {userCount} người dùng
                                        {r.isSystem && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                                style={{ background: 'var(--his-warning-soft)', color: 'var(--his-warning)' }}>
                                                HỆ THỐNG
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-1">
                                        {r.permissions.slice(0, 6).map(p => (
                                            <span key={p} className="px-1.5 py-0.5 rounded text-[10px]"
                                                style={{ background: 'var(--his-bg)', color: 'var(--his-fg-muted)', border: '1px solid var(--his-border)' }}>
                                                {p}
                                            </span>
                                        ))}
                                        {r.permissions.length > 6 && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px]"
                                                style={{ background: 'var(--his-primary-soft)', color: 'var(--his-primary)' }}>
                                                +{r.permissions.length - 6}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── User Modal ─── */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowUserModal(false)}>
                    <div className="rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl"
                        style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[16px] font-bold" style={{ color: 'var(--his-fg)' }}>
                                {editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}
                            </h2>
                            <button onClick={() => setShowUserModal(false)} className="p-1 cursor-pointer" style={{ color: 'var(--his-fg-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {formError && (
                            <div className="mb-4 p-3 rounded-lg text-[13px]" style={{ background: 'var(--his-danger-soft)', color: 'var(--his-danger)', border: '1px solid var(--his-danger)' }}>
                                {formError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Họ tên *</label>
                                <input className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                                    style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                    value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nguyễn Văn A" />
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Email *</label>
                                <input type="email" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                                    style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                    value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="user@his.local" />
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>
                                    Mật khẩu {editingUser ? '(bỏ trống nếu không đổi)' : '*'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full px-3 py-2 pr-10 rounded-lg text-[13px] outline-none"
                                        style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                        value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="••••••" />
                                    <button
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                                        style={{ color: 'var(--his-fg-muted)' }} type="button">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Vai trò</label>
                                    <select className="w-full px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer"
                                        style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                        value={formRole} onChange={e => setFormRole(e.target.value)}>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Trạng thái</label>
                                    <select className="w-full px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer"
                                        style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                        value={formStatus} onChange={e => setFormStatus(e.target.value as 'active' | 'inactive' | 'locked')}>
                                        <option value="active">Hoạt động</option>
                                        <option value="inactive">Vô hiệu</option>
                                        <option value="locked">Bị khóa</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Khoa / Phòng</label>
                                <input className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                                    style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                    value={formDepartment} onChange={e => setFormDepartment(e.target.value)}
                                    placeholder="Nội khoa" list="dept-list" />
                                <datalist id="dept-list">
                                    {departments.map(d => <option key={d} value={d} />)}
                                </datalist>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowUserModal(false)}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer"
                                style={{ color: 'var(--his-fg-muted)', border: '1px solid var(--his-border)' }}>
                                Hủy
                            </button>
                            <button onClick={saveUser}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
                                style={{ background: 'var(--his-primary)' }}>
                                <span className="flex items-center gap-2">
                                    <Check size={14} /> {editingUser ? 'Cập nhật' : 'Tạo mới'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Role Modal ─── */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowRoleModal(false)}>
                    <div className="rounded-xl p-6 w-[560px] max-h-[90vh] overflow-y-auto shadow-2xl"
                        style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-[16px] font-bold" style={{ color: 'var(--his-fg)' }}>
                                {editingRole ? 'Sửa vai trò' : 'Tạo vai trò mới'}
                            </h2>
                            <button onClick={() => setShowRoleModal(false)} className="p-1 cursor-pointer" style={{ color: 'var(--his-fg-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {roleFormError && (
                            <div className="mb-4 p-3 rounded-lg text-[13px]" style={{ background: 'var(--his-danger-soft)', color: 'var(--his-danger)', border: '1px solid var(--his-danger)' }}>
                                {roleFormError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Tên vai trò *</label>
                                <input className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                                    style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                    value={roleFormName} onChange={e => setRoleFormName(e.target.value)} placeholder="Tên vai trò" />
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Mô tả</label>
                                <input className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                                    style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                    value={roleFormDesc} onChange={e => setRoleFormDesc(e.target.value)} placeholder="Mô tả vai trò" />
                            </div>

                            {/* Permission Matrix */}
                            <div>
                                <label className="block text-[12px] font-medium mb-3" style={{ color: 'var(--his-fg-muted)' }}>
                                    Phân quyền ({roleFormPerms.length} quyền đã chọn)
                                </label>
                                <div className="space-y-3">
                                    {Object.entries(permGroups).map(([group, perms]) => (
                                        <div key={group} className="rounded-lg p-3"
                                            style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)' }}>
                                            <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--his-fg)' }}>{group}</div>
                                            <div className="flex flex-wrap gap-2">
                                                {perms.map(p => {
                                                    const selected = roleFormPerms.includes(p.key);
                                                    return (
                                                        <button
                                                            key={p.key}
                                                            onClick={() => togglePerm(p.key)}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all"
                                                            style={{
                                                                background: selected ? 'var(--his-primary)' : 'var(--his-bg-card)',
                                                                color: selected ? '#fff' : 'var(--his-fg-muted)',
                                                                border: `1px solid ${selected ? 'var(--his-primary)' : 'var(--his-border)'}`,
                                                            }}
                                                        >
                                                            {selected && <Check size={10} />}
                                                            {p.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowRoleModal(false)}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer"
                                style={{ color: 'var(--his-fg-muted)', border: '1px solid var(--his-border)' }}>
                                Hủy
                            </button>
                            <button onClick={saveRole}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-opacity hover:opacity-90"
                                style={{ background: 'var(--his-primary)' }}>
                                <span className="flex items-center gap-2">
                                    <Check size={14} /> {editingRole ? 'Cập nhật' : 'Tạo mới'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Delete Confirm ─── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="rounded-xl p-6 w-[400px] shadow-2xl"
                        style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--his-danger-soft)' }}>
                                <Trash2 size={20} style={{ color: 'var(--his-danger)' }} />
                            </div>
                            <div>
                                <div className="text-[15px] font-bold" style={{ color: 'var(--his-fg)' }}>Xác nhận xóa</div>
                                <div className="text-[13px]" style={{ color: 'var(--his-fg-muted)' }}>
                                    Bạn có chắc muốn xóa {showDeleteConfirm.type === 'user' ? 'người dùng' : 'vai trò'} <strong>{showDeleteConfirm.name}</strong>?
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer"
                                style={{ color: 'var(--his-fg-muted)', border: '1px solid var(--his-border)' }}>
                                Hủy
                            </button>
                            <button onClick={showDeleteConfirm.type === 'user' ? handleDeleteUser : handleDeleteRole}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer"
                                style={{ background: 'var(--his-danger)' }}>
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
