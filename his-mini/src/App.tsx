import { useState, useEffect } from 'react';
import {
    Users, Pill, AlertTriangle, LayoutDashboard, MessageSquare, Activity,
    Stethoscope, BookOpen, UserCog, LogOut, Eye, EyeOff,
} from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { PrescribePage } from './pages/PrescribePage';
import { AlertsPage } from './pages/AlertsPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { EncounterPage } from './pages/EncounterPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { XClawWidget } from './components/XClawWidget';
import { hisLogin, hisLogout, hisGetMe, setAuthToken } from './api';

export interface PatientContext {
    id: string;
    name: string;
    gender: string;
    birthDate: string;
    allergies: string[];
    prescriptions: string[];
}

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: string;
    roleName: string;
    department: string;
    permissions: string[];
    status: string;
}

type Page = 'dashboard' | 'patients' | 'encounter' | 'prescribe' | 'alerts' | 'knowledge' | 'chatbot' | 'users';

const NAV: { id: Page; label: string; icon: typeof Users; permission?: string }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'patients', label: 'Bệnh nhân', icon: Users, permission: 'patients.read' },
    { id: 'encounter', label: 'Khám bệnh (SOAP)', icon: Stethoscope, permission: 'encounters.read' },
    { id: 'prescribe', label: 'Kê đơn thuốc', icon: Pill, permission: 'prescriptions.read' },
    { id: 'alerts', label: 'Cảnh báo lâm sàng', icon: AlertTriangle, permission: 'alerts.read' },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, permission: 'knowledge.read' },
    { id: 'chatbot', label: 'AI Trợ lý', icon: MessageSquare, permission: 'chat.use' },
    { id: 'users', label: 'Quản lý người dùng', icon: UserCog, permission: 'users.read' },
];

function hasPermission(user: AuthUser, perm: string): boolean {
    return user.permissions.includes(perm) || user.permissions.includes('system.admin');
}

// ─── Login Screen ───

function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await hisLogin(email, password);
            if (res.token && res.user) {
                setAuthToken(res.token);
                onLogin(res.user);
            } else {
                setError(res.error || 'Đăng nhập thất bại');
            }
        } catch {
            setError('Không thể kết nối tới server');
        }
        setLoading(false);
    };

    return (
        <div className="h-screen flex items-center justify-center" style={{ background: 'var(--his-sidebar)' }}>
            <div className="w-[400px] rounded-2xl p-8 shadow-2xl" style={{ background: 'var(--his-bg-card)', border: '1px solid var(--his-border)' }}>
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--his-primary)' }}>
                        <Activity size={28} color="#fff" />
                    </div>
                    <div>
                        <div className="text-xl font-bold" style={{ color: 'var(--his-fg)' }}>HIS Mini</div>
                        <div className="text-[11px] font-medium" style={{ color: 'var(--his-primary)' }}>Hospital Information System</div>
                    </div>
                </div>

                <h2 className="text-[16px] font-bold text-center mb-1" style={{ color: 'var(--his-fg)' }}>Đăng nhập hệ thống</h2>
                <p className="text-[13px] text-center mb-6" style={{ color: 'var(--his-fg-muted)' }}>Nhập tài khoản để tiếp tục</p>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-[13px] text-center"
                        style={{ background: 'var(--his-danger-soft)', color: 'var(--his-danger)', border: '1px solid var(--his-danger)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Email</label>
                        <input
                            type="email"
                            className="w-full px-4 py-2.5 rounded-lg text-[13px] outline-none"
                            style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                            value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="doctor@his.local"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--his-fg-muted)' }}>Mật khẩu</label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                className="w-full px-4 py-2.5 pr-10 rounded-lg text-[13px] outline-none"
                                style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)', color: 'var(--his-fg)' }}
                                value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="••••••"
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 cursor-pointer"
                                style={{ color: 'var(--his-fg-muted)' }}>
                                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg text-[14px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--his-primary)' }}
                    >
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>

                {/* Demo accounts */}
                <div className="mt-6 p-3 rounded-lg" style={{ background: 'var(--his-bg)', border: '1px solid var(--his-border)' }}>
                    <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--his-fg-muted)' }}>Tài khoản demo:</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]" style={{ color: 'var(--his-fg-muted)' }}>
                        {[
                            { email: 'admin@his.local', pw: 'admin123', role: 'Admin' },
                            { email: 'doctor@his.local', pw: 'doctor123', role: 'Bác sĩ' },
                            { email: 'nurse@his.local', pw: 'nurse123', role: 'Điều dưỡng' },
                            { email: 'pharmacist@his.local', pw: 'pharma123', role: 'Dược sĩ' },
                        ].map(a => (
                            <button key={a.email}
                                onClick={() => { setEmail(a.email); setPassword(a.pw); }}
                                className="text-left px-2 py-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ background: 'var(--his-bg-card)' }}>
                                <div className="font-medium" style={{ color: 'var(--his-primary)' }}>{a.role}</div>
                                <div>{a.email}</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main App ───

export function App() {
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [authChecking, setAuthChecking] = useState(true);
    const [page, setPage] = useState<Page>('dashboard');
    const [currentPatient, setCurrentPatient] = useState<PatientContext | null>(null);

    // Check saved token on mount
    useEffect(() => {
        const savedToken = sessionStorage.getItem('his_token');
        if (savedToken) {
            setAuthToken(savedToken);
            hisGetMe().then(res => {
                if (res.user) {
                    setAuthUser(res.user);
                } else {
                    setAuthToken(null);
                }
                setAuthChecking(false);
            }).catch(() => {
                setAuthToken(null);
                setAuthChecking(false);
            });
        } else {
            setAuthChecking(false);
        }
    }, []);

    const handleLogin = (user: AuthUser) => {
        setAuthUser(user);
    };

    const handleLogout = async () => {
        await hisLogout();
        setAuthUser(null);
        setPage('dashboard');
    };

    // Show loading while checking auth
    if (authChecking) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'var(--his-sidebar)' }}>
                <div className="text-center">
                    <Activity size={40} className="mx-auto mb-3 animate-pulse" style={{ color: 'var(--his-primary)' }} />
                    <div className="text-[13px]" style={{ color: 'rgba(148,163,184,0.8)' }}>Đang kiểm tra đăng nhập...</div>
                </div>
            </div>
        );
    }

    // Show login screen if not authenticated
    if (!authUser) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    // Filter nav items by permission
    const visibleNav = NAV.filter(item => !item.permission || hasPermission(authUser, item.permission));

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Dark Sidebar */}
            <aside
                className="flex flex-col w-[240px] shrink-0"
                style={{ background: 'var(--his-sidebar)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-5 h-16" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--his-primary)' }}>
                        <Activity size={18} color="#fff" />
                    </div>
                    <div>
                        <span className="text-sm font-bold text-white">HIS Mini</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: 'rgba(14,165,233,0.15)', color: 'var(--his-primary-light)' }}>FHIR R5</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {visibleNav.map((item) => {
                        const active = page === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setPage(item.id)}
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer"
                                style={{
                                    background: active ? 'rgba(14,165,233,0.12)' : 'transparent',
                                    color: active ? 'var(--his-sidebar-text-active)' : 'var(--his-sidebar-text)',
                                }}
                            >
                                <item.icon size={18} style={{ color: active ? 'var(--his-primary-light)' : 'var(--his-sidebar-text)' }} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                {/* User info + Logout */}
                <div className="px-3 pb-2">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                            style={{ background: 'var(--his-primary)' }}>
                            {authUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-white truncate">{authUser.name}</div>
                            <div className="text-[10px] truncate" style={{ color: 'rgba(148,163,184,0.7)' }}>
                                {authUser.roleName}
                            </div>
                        </div>
                        <button onClick={handleLogout}
                            className="p-1.5 rounded-md cursor-pointer transition-opacity hover:opacity-80"
                            style={{ color: 'rgba(148,163,184,0.6)' }}
                            title="Đăng xuất">
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 text-[10px]" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.6)' }}>
                    HL7 FHIR R5 Compliant<br />
                    HIS Mini v1.0 — xClaw
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto" style={{ background: 'var(--his-bg)' }}>
                {page === 'dashboard' && <DashboardPage onNavigate={(p) => setPage(p as Page)} />}
                {page === 'patients' && <PatientsPage onPatientSelect={setCurrentPatient} />}
                {page === 'encounter' && <EncounterPage />}
                {page === 'prescribe' && <PrescribePage />}
                {page === 'alerts' && <AlertsPage />}
                {page === 'knowledge' && <KnowledgePage />}
                {page === 'chatbot' && <ChatbotPage />}
                {page === 'users' && <UserManagementPage />}
            </main>

            {/* xClaw Floating Widget */}
            <XClawWidget patientContext={currentPatient} />
        </div>
    );
}
