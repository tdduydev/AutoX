// ============================================================
// UserLayout - Clean user-facing interface
// ============================================================

import React, { useEffect } from 'react';
import { useAppStore, guardViewForRole } from '@/stores';
import { useAuthStore } from '@/stores/auth-store';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { ApiKeyManager } from '@/components/admin/ApiKeyManager';
import { MyLearning } from '@/components/doctor/MyLearning';
import { AgentHub } from '@/components/agent-hub/AgentHub';
import { SkillHub } from '@/components/skill-hub/SkillHub';
import {
    MessageSquare, Database, Key, LogOut, Brain, Store, Puzzle,
} from 'lucide-react';

const USER_NAV = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'agent-hub', label: 'Agent Hub', icon: Store },
    { id: 'skill-hub', label: 'Skill Hub', icon: Puzzle },
    { id: 'knowledge', label: 'Knowledge', icon: Database },
    { id: 'my-learning', label: 'My Learning', icon: Brain },
    { id: 'api-keys', label: 'API Keys', icon: Key },
] as const;

export function UserLayout() {
    const currentView = useAppStore(s => s.currentView);
    const setView = useAppStore(s => s.setView);
    const user = useAuthStore(s => s.user)!;
    const logout = useAuthStore(s => s.logout);

    // Guard: if hash points to an admin route, reset to chat
    useEffect(() => { guardViewForRole(user.role); }, []);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Top bar - Glassmorphism */}
            <header className="flex items-center justify-between px-6 h-16 bg-background/60 backdrop-blur-xl border-b border-white/5 flex-shrink-0 z-10 shadow-sm">
                {/* Left: Logo + Nav */}
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="xClaw" className="w-8 h-8 object-contain" />
                        <span className="font-bold text-xl text-foreground tracking-tight">xClaw</span>
                    </div>

                    <nav className="flex items-center gap-2">
                        {USER_NAV.map(item => {
                            const active = currentView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setView(item.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${active
                                        ? 'bg-primary/10 text-primary-light shadow-sm ring-1 ring-primary/20'
                                        : 'text-foreground-muted hover:bg-background-hover/50 hover:text-foreground'
                                        }`}
                                >
                                    <item.icon size={18} className={`${active ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: User info */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-full border border-border bg-background-soft/50">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-accent to-secondary flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-accent/20">
                            {user.displayName[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground">{user.displayName}</span>
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 text-foreground-muted hover:text-white hover:bg-destructive/80 transition-colors rounded-lg"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {currentView === 'chat' && <ChatPanel />}
                {currentView === 'agent-hub' && <AgentHub />}
                {currentView === 'skill-hub' && <SkillHub />}
                {currentView === 'knowledge' && <KnowledgeBase />}
                {currentView === 'my-learning' && <MyLearning />}
                {currentView === 'api-keys' && <ApiKeyManager />}
            </main>
        </div>
    );
}
