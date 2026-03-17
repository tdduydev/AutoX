// ============================================================
// AdminLayout - Multi-tenant style administration dashboard
// ============================================================

import React, { useState } from 'react';
import { useAppStore } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { HealthDashboard } from '@/components/dashboard/HealthDashboard';
import { SkillsPanel } from '@/components/skills/SkillsPanel';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { ResourcesDashboard } from '@/components/resources/ResourcesDashboard';
import { Settings } from '@/components/settings/Settings';
import { UserManagement } from '@/components/admin/UserManagement';
import { ChannelManagement } from '@/components/admin/ChannelManagement';
import { ApiKeyManager } from '@/components/admin/ApiKeyManager';
import { ModelManagement } from '@/components/admin/ModelManagement';
import { AuditLog } from '@/components/admin/AuditLog';
import { Analytics } from '@/components/admin/Analytics';
import { MCPPanel } from '@/components/admin/MCPPanel';
import { AgentHub } from '@/components/agent-hub/AgentHub';
import { SkillHub } from '@/components/skill-hub/SkillHub';
import { DataQualityOverview } from '@/components/admin/DataQualityOverview';
import { DoctorProfiles } from '@/components/admin/DoctorProfiles';
import { LearningDataReview } from '@/components/admin/LearningDataReview';
import { FineTuningStudio } from '@/components/admin/FineTuningStudio';
import { ChatAnalysis } from '@/components/admin/ChatAnalysis';
import {
    MessageSquare, Workflow, HeartPulse, Puzzle,
    Database, BarChart3, Users, Radio, Key,
    Settings as SettingsIcon, LogOut, Shield,
    ChevronLeft, ChevronRight, Bell, Search,
    LayoutDashboard, ChevronDown, Brain, ScrollText, TrendingUp, Plug,
    UserCog, BookOpen, Sparkles, MessageSquareText, ShieldCheck,
    Store,
} from 'lucide-react';

// ── Nav config ──────────────────────────────────────────────

type NavSection = {
    title: string;
    items: { id: string; label: string; icon: React.ElementType; badge?: string }[];
};

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'OVERVIEW',
        items: [
            { id: 'resources', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'health-dashboard', label: 'Health Monitor', icon: HeartPulse },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        ],
    },
    {
        title: 'OPERATIONS',
        items: [
            { id: 'agent-hub', label: 'Agent Hub', icon: Store, badge: 'NEW' },
            { id: 'skill-hub', label: 'Skill Hub', icon: Puzzle, badge: 'NEW' },
            { id: 'chat', label: 'Chat Console', icon: MessageSquare },
            { id: 'knowledge', label: 'Knowledge Base', icon: Database },
            { id: 'workflows', label: 'Workflows', icon: Workflow },
            { id: 'skills', label: 'Skills & Tools', icon: Puzzle },
            { id: 'models', label: 'Models', icon: Brain },
            { id: 'mcp-servers', label: 'MCP Integrations', icon: Plug },
        ],
    },
    {
        title: 'DOCTOR MANAGEMENT',
        items: [
            { id: 'doctor-profiles', label: 'Doctor Profiles', icon: UserCog },
            { id: 'learning-data', label: 'Learning Data', icon: BookOpen },
            { id: 'data-quality', label: 'Data Quality', icon: ShieldCheck },
            { id: 'finetune-studio', label: 'Fine-Tuning Studio', icon: Sparkles },
            { id: 'chat-analysis', label: 'Chat Analysis', icon: MessageSquareText },
        ],
    },
    {
        title: 'ADMINISTRATION',
        items: [
            { id: 'users', label: 'Users', icon: Users },
            { id: 'channels', label: 'Channels', icon: Radio },
            { id: 'api-keys', label: 'API Keys', icon: Key },
            { id: 'audit-log', label: 'Audit Log', icon: ScrollText },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ],
    },
];

// Title map for the top header
const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
    resources: { title: 'Dashboard', subtitle: 'System overview and metrics' },
    'health-dashboard': { title: 'Health Monitor', subtitle: 'Service status and performance' },
    analytics: { title: 'Analytics', subtitle: 'Usage statistics and insights' },
    chat: { title: 'Chat Console', subtitle: 'AI conversation interface' },
    'agent-hub': { title: 'Agent Hub', subtitle: 'Browse & install AI agents' },
    'skill-hub': { title: 'Skill Hub', subtitle: 'Browse, import & manage skills marketplace' },
    knowledge: { title: 'Knowledge Base', subtitle: 'Document collections and RAG' },
    workflows: { title: 'Workflows', subtitle: 'Automation pipeline builder' },
    skills: { title: 'Skills & Tools', subtitle: 'Manage agent capabilities' },
    models: { title: 'Model Management', subtitle: 'LLM model registry and providers' },
    users: { title: 'User Management', subtitle: 'Accounts, roles and permissions' },
    channels: { title: 'Channel Management', subtitle: 'Telegram, Discord and integrations' },
    'api-keys': { title: 'API Keys', subtitle: 'Access tokens and embed widgets' },
    'audit-log': { title: 'Audit Log', subtitle: 'System activity and security events' },
    'mcp-servers': { title: 'MCP Integrations', subtitle: 'External tools & data sources via MCP' },
    'doctor-profiles': { title: 'Doctor Profiles', subtitle: 'Per-doctor AI personalization' },
    'learning-data': { title: 'Learning Data', subtitle: 'Review auto-extracted learning entries' },
    'data-quality': { title: 'Data Quality', subtitle: 'Learning data quality metrics' },
    'finetune-studio': { title: 'Fine-Tuning Studio', subtitle: 'Datasets, samples, and training jobs' },
    'chat-analysis': { title: 'Chat Analysis', subtitle: 'Per-doctor conversation insights' },
    settings: { title: 'Settings', subtitle: 'Agent configuration' },
};

// ── Component ───────────────────────────────────────────────

export function AdminLayout() {
    const currentView = useAppStore(s => s.currentView);
    const setView = useAppStore(s => s.setView);
    const user = useAuthStore(s => s.user)!;
    const logout = useAuthStore(s => s.logout);
    const [collapsed, setCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const viewInfo = VIEW_TITLES[currentView] ?? { title: 'xClaw', subtitle: '' };

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-background">
            {/* ─── Sidebar ─── */}
            <aside
                className={`flex flex-col bg-background-surface/95 backdrop-blur-xl border-r border-border transition-all duration-300 flex-shrink-0 z-20 ${collapsed ? 'w-[68px]' : 'w-64'
                    }`}
            >
                {/* Brand */}
                <div className="flex items-center gap-3 px-5 h-16 border-b border-border flex-shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary p-0.5 flex items-center justify-center flex-shrink-0 shadow-glow shadow-primary/20">
                        <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="xClaw" className="w-6 h-6 object-contain" />
                        </div>
                    </div>
                    {!collapsed && (
                        <div className="flex flex-col min-w-0 animate-fade-in">
                            <span className="font-bold text-sm text-foreground tracking-tight leading-tight">xClaw</span>
                            <span className="text-[10px] text-primary-light font-medium tracking-wide leading-tight uppercase">Admin Console</span>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 overflow-y-auto px-3">
                    {NAV_SECTIONS.map(section => (
                        <div key={section.title} className="mb-6">
                            {!collapsed && (
                                <div className="px-3 mb-2 text-[10px] font-bold tracking-widest text-foreground-muted uppercase">
                                    {section.title}
                                </div>
                            )}
                            {collapsed && <div className="mx-3 mb-2 border-t border-border" />}
                            <div className="space-y-1">
                                {section.items.map(item => {
                                    const active = currentView === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setView(item.id as any)}
                                            className={`group w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                                                } ${active
                                                    ? 'bg-primary/10 text-primary-light shadow-sm shadow-primary/5 ring-1 ring-primary/20'
                                                    : 'text-foreground-muted hover:bg-background-hover/50 hover:text-foreground'
                                                }`}
                                            title={collapsed ? item.label : undefined}
                                        >
                                            <item.icon
                                                size={collapsed ? 20 : 18}
                                                className={`flex-shrink-0 transition-all duration-200 ${active ? 'text-primary-light drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-foreground-muted group-hover:text-foreground group-hover:scale-110'
                                                    }`}
                                            />
                                            {!collapsed && (
                                                <span className="truncate">{item.label}</span>
                                            )}
                                            {!collapsed && item.badge && (
                                                <span className="ml-auto text-[10px] bg-accent/20 border border-accent/20 text-accent px-1.5 py-0.5 rounded-md font-bold">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Sidebar footer - Collapse + User */}
                <div className="border-t border-border flex-shrink-0 p-3">
                    {/* Collapse toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-hover/50 transition duration-200 text-xs font-medium mb-3"
                    >
                        {collapsed ? <ChevronRight size={16} /> : (
                            <>
                                <ChevronLeft size={16} />
                                <span>Collapse Menu</span>
                            </>
                        )}
                    </button>

                    {/* User card */}
                    <div className="p-3 bg-background-soft/50 rounded-xl border border-border">
                        {collapsed ? (
                            <button
                                onClick={logout}
                                className="w-full flex justify-center"
                                title="Logout"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-accent to-secondary flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-accent/20 hover:scale-105 transition-transform">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-accent to-secondary flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-accent/20 flex-shrink-0">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-foreground truncate">{user.displayName}</div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Shield size={10} className="text-accent" />
                                        <span className="text-[10px] text-accent font-medium uppercase tracking-wide">Administrator</span>
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-1.5 rounded-lg text-foreground-muted hover:text-white hover:bg-destructive/80 transition-colors"
                                    title="Logout"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* ─── Main area ─── */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background decorative glow */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
                
                {/* Top header bar - Glassmorphism */}
                <header className="h-16 flex items-center justify-between px-6 bg-background/60 backdrop-blur-xl border-b border-white/5 z-10 flex-shrink-0 shadow-sm">
                    {/* Left: Page title */}
                    <div className="animate-fade-in">
                        <h1 className="text-base font-bold text-foreground leading-tight">{viewInfo.title}</h1>
                        <p className="text-xs text-foreground-muted mt-0.5 font-medium leading-tight">{viewInfo.subtitle}</p>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition">
                            <Search size={16} />
                        </button>
                        {/* Notifications */}
                        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition">
                            <Bell size={16} />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-400 rounded-full" />
                        </button>
                        {/* Separator */}
                        <div className="w-px h-6 bg-dark-700 mx-1" />
                        {/* User dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-800 transition"
                            >
                                <div className="w-7 h-7 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-300 text-xs font-bold">
                                    {user.displayName[0].toUpperCase()}
                                </div>
                                <span className="text-xs text-slate-300 hidden sm:block">{user.displayName}</span>
                                <ChevronDown size={12} className="text-slate-500" />
                            </button>
                            {userMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 py-1">
                                        <div className="px-3 py-2 border-b border-dark-700">
                                            <div className="text-xs font-medium text-white">{user.displayName}</div>
                                            <div className="text-[10px] text-amber-400">Administrator</div>
                                        </div>
                                        <button
                                            onClick={() => { setView('settings' as any); setUserMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-dark-700 transition flex items-center gap-2"
                                        >
                                            <SettingsIcon size={12} /> Settings
                                        </button>
                                        <button
                                            onClick={logout}
                                            className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-dark-700 transition flex items-center gap-2"
                                        >
                                            <LogOut size={12} /> Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {currentView === 'chat' && <ChatPanel />}
                    {currentView === 'agent-hub' && <AgentHub />}
                    {currentView === 'skill-hub' && <SkillHub />}
                    {currentView === 'knowledge' && <KnowledgeBase />}
                    {currentView === 'api-keys' && <ApiKeyManager />}
                    {currentView === 'workflows' && <WorkflowCanvas />}
                    {currentView === 'skills' && <SkillsPanel />}
                    {currentView === 'resources' && <ResourcesDashboard />}
                    {currentView === 'health-dashboard' && <HealthDashboard />}
                    {currentView === 'users' && <UserManagement />}
                    {currentView === 'channels' && <ChannelManagement />}
                    {currentView === 'models' && <ModelManagement />}
                    {currentView === 'audit-log' && <AuditLog />}
                    {currentView === 'analytics' && <Analytics />}
                    {currentView === 'mcp-servers' && <MCPPanel />}
                    {currentView === 'doctor-profiles' && <DoctorProfiles />}
                    {currentView === 'learning-data' && <LearningDataReview />}
                    {currentView === 'data-quality' && <DataQualityOverview />}
                    {currentView === 'finetune-studio' && <FineTuningStudio />}
                    {currentView === 'chat-analysis' && <ChatAnalysis />}
                    {currentView === 'settings' && <Settings />}
                </main>
            </div>
        </div>
    );
}
