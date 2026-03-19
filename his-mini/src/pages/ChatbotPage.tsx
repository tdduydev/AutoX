import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Bot, Send, User, Loader2, Wifi, WifiOff, Plus, Trash2,
    MessageSquare, ThumbsUp, ThumbsDown, Copy, Check, RotateCcw,
    BarChart3, History, X, Sparkles,
} from 'lucide-react';
import {
    loginXClaw, chatXClaw, getChatSessions, createChatSession,
    deleteChatSession, getChatMessages, saveChatMessage, rateChatMessage,
    getChatContext, getChatStats,
} from '../api';

// ─── Types ───

interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    rating?: number;
}

interface ChatSession {
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface ChatStatsData {
    totalSessions: number;
    totalMessages: number;
    ratedMessages: number;
    avgRating: number;
    thumbsUp: number;
    thumbsDown: number;
}

// ─── Mermaid Renderer ───

function MermaidBlock({ code }: { code: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const mermaid = (await import('mermaid')).default;
                mermaid.initialize({
                    startOnLoad: false, theme: 'neutral',
                    flowchart: { htmlLabels: true, curve: 'basis' },
                    themeVariables: { fontSize: '12px' },
                });
                const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
                const { svg: rendered } = await mermaid.render(id, code);
                if (!cancelled) setSvg(rendered);
            } catch (e) {
                if (!cancelled) setError(String(e));
            }
        })();
        return () => { cancelled = true; };
    }, [code]);

    if (error) {
        return (
            <div className="rounded-lg p-3 text-[11px] font-mono overflow-x-auto"
                style={{ background: 'var(--his-danger-soft)', color: 'var(--his-danger)', border: '1px solid var(--his-danger)' }}>
                <div className="font-semibold mb-1">Diagram Error</div>
                <pre className="whitespace-pre-wrap">{code}</pre>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className="flex items-center gap-2 py-3 text-[11px]" style={{ color: 'var(--his-fg-muted)' }}>
                <Loader2 size={12} className="animate-spin" /> Đang vẽ sơ đồ...
            </div>
        );
    }

    return (
        <div ref={containerRef}
            className="rounded-lg p-3 overflow-x-auto my-2"
            style={{ background: '#fafbfc', border: '1px solid var(--his-border)' }}
            dangerouslySetInnerHTML={{ __html: svg }} />
    );
}

// ─── Markdown-like renderer with mermaid support ───

function MessageContent({ content }: { content: string }) {
    const segments = useMemo(() => {
        const result: { type: 'text' | 'mermaid'; content: string }[] = [];
        const regex = /```(mermaid|chart)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                result.push({ type: 'text', content: content.slice(lastIndex, match.index) });
            }
            result.push({ type: 'mermaid', content: match[2].trim() });
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            result.push({ type: 'text', content: content.slice(lastIndex) });
        }

        return result;
    }, [content]);

    if (segments.length === 1 && segments[0].type === 'text') {
        return <span className="whitespace-pre-wrap">{content}</span>;
    }

    return (
        <>
            {segments.map((seg, i) => {
                if (seg.type === 'mermaid') return <MermaidBlock key={i} code={seg.content} />;
                return <span key={i} className="whitespace-pre-wrap">{seg.content}</span>;
            })}
        </>
    );
}

// ─── Message Actions (grouped icons) ───

function MessageActions({ message, onRate, onCopy, onRetry }: {
    message: Message;
    onRate?: (rating: number) => void;
    onCopy: () => void;
    onRetry?: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex items-center gap-0.5 mt-1.5">
            <div className="inline-flex items-center rounded-md"
                style={{ background: 'var(--his-surface-alt)', border: '1px solid var(--his-border)' }}>
                {/* Copy */}
                <button onClick={handleCopy} title="Sao chép"
                    className="p-1.5 hover:bg-white/60 rounded-l-md transition-colors cursor-pointer">
                    {copied ? <Check size={12} style={{ color: 'var(--his-success)' }} /> : <Copy size={12} style={{ color: 'var(--his-fg-muted)' }} />}
                </button>

                {/* Rate (only for assistant) */}
                {message.role === 'assistant' && onRate && (
                    <>
                        <button onClick={() => onRate(5)} title="Hữu ích"
                            className="p-1.5 hover:bg-white/60 transition-colors cursor-pointer"
                            style={{ color: message.rating === 5 ? 'var(--his-success)' : 'var(--his-fg-muted)' }}>
                            <ThumbsUp size={12} />
                        </button>
                        <button onClick={() => onRate(1)} title="Không hữu ích"
                            className="p-1.5 hover:bg-white/60 transition-colors cursor-pointer"
                            style={{ color: message.rating === 1 ? 'var(--his-danger)' : 'var(--his-fg-muted)' }}>
                            <ThumbsDown size={12} />
                        </button>
                    </>
                )}

                {/* Retry (only for user messages) */}
                {message.role === 'user' && onRetry && (
                    <button onClick={onRetry} title="Hỏi lại"
                        className="p-1.5 hover:bg-white/60 transition-colors cursor-pointer">
                        <RotateCcw size={12} style={{ color: 'var(--his-fg-muted)' }} />
                    </button>
                )}

                {/* Chart hint */}
                {message.role === 'assistant' && onCopy && (
                    <button onClick={onCopy} title="Vẽ sơ đồ từ nội dung"
                        className="p-1.5 hover:bg-white/60 rounded-r-md transition-colors cursor-pointer">
                        <BarChart3 size={12} style={{ color: 'var(--his-fg-muted)' }} />
                    </button>
                )}
            </div>

            {/* Rating badge */}
            {message.rating != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1"
                    style={{
                        background: message.rating === 5 ? 'var(--his-success-soft)' : 'var(--his-danger-soft)',
                        color: message.rating === 5 ? 'var(--his-success)' : 'var(--his-danger)',
                    }}>
                    {message.rating === 5 ? 'Hữu ích' : 'Không hữu ích'}
                </span>
            )}
        </div>
    );
}

// ─── Quick Prompts ───

const QUICK_PROMPTS = [
    { label: 'Tương tác thuốc', prompt: 'Kiểm tra tương tác giữa các thuốc phổ biến', icon: '💊' },
    { label: 'Vẽ sơ đồ', prompt: 'Vẽ sơ đồ flowchart quy trình khám bệnh bằng mermaid', icon: '📊' },
    { label: 'Liều dùng', prompt: 'Hướng dẫn liều dùng thuốc thông dụng cho người lớn', icon: '💉' },
    { label: 'ICD-10', prompt: 'Tra cứu mã ICD-10 cho các bệnh thường gặp', icon: '📋' },
];

// ═══════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════

export function ChatbotPage() {
    // Auth - auto-login to xClaw
    const [token, setToken] = useState<string | null>(null);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    // Sessions
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [xclawSessionId, setXclawSessionId] = useState<string | undefined>();

    // Stats
    const [chatStats, setChatStats] = useState<ChatStatsData | null>(null);
    const [showStats, setShowStats] = useState(false);

    // ─── Load sessions ───
    const loadSessions = useCallback(async () => {
        try {
            const res = await getChatSessions();
            setSessions(res.sessions || []);
        } catch { /* ignore */ }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const res = await getChatStats();
            setChatStats(res);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadSessions(); loadStats(); }, [loadSessions, loadStats]);

    // ─── Auto-login to xClaw ───
    useEffect(() => {
        (async () => {
            try {
                const res = await loginXClaw('doctor@his.local', 'doctor123');
                if ('token' in res && res.token) {
                    setToken(res.token);
                }
            } catch { /* xClaw not available */ }
        })();
    }, []);

    // ─── Load messages for active session ───
    useEffect(() => {
        if (!activeSessionId) return;
        (async () => {
            try {
                const res = await getChatMessages(activeSessionId);
                setMessages((res.messages || []).map((m: { id: string; role: string; content: string; rating?: number; createdAt: string }) => ({
                    id: m.id, role: m.role as Message['role'], content: m.content,
                    rating: m.rating, timestamp: new Date(m.createdAt),
                })));
            } catch { /* ignore */ }
        })();
    }, [activeSessionId]);

    // ─── Auto-scroll ───
    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, sending]);

    // ─── New session ───
    const startNewSession = async () => {
        const id = `chat-${Date.now().toString(36)}`;
        setActiveSessionId(id);
        setXclawSessionId(undefined);
        setMessages([{
            role: 'assistant',
            content: 'Xin chào! Tôi là trợ lý AI của xClaw. Tôi có thể giúp bạn:\n\n• Tra cứu thông tin thuốc & tương tác\n• Kiểm tra mã ICD-10\n• Vẽ sơ đồ quy trình (flowchart, sequence diagram...)\n• Trả lời câu hỏi y khoa\n\nBạn có thể yêu cầu tôi vẽ sơ đồ bằng cách nói "vẽ sơ đồ..." hoặc "tạo flowchart..."',
            timestamp: new Date(),
        }]);
        await loadSessions();
    };

    // ─── Delete session ───
    const handleDeleteSession = async (sid: string) => {
        await deleteChatSession(sid);
        if (activeSessionId === sid) {
            setActiveSessionId(null);
            setMessages([]);
        }
        loadSessions();
        loadStats();
    };

    // ─── Send message ───
    const send = async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || sending) return;
        if (!token) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Chưa kết nối được tới xClaw AI. Hãy kiểm tra xClaw server đang chạy (port 3000).',
                timestamp: new Date(),
            }]);
            return;
        }

        setInput('');

        let sid = activeSessionId;
        if (!sid) {
            sid = `chat-${Date.now().toString(36)}`;
            setActiveSessionId(sid);
        }

        const userMsg: Message = { role: 'user', content: msg, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setSending(true);

        try {
            // Save user message to server
            const savedUser = await saveChatMessage(sid, { role: 'user', content: msg });
            userMsg.id = savedUser.message?.id;

            // Get context from history for better AI understanding
            let contextPrefix = '';
            try {
                const ctx = await getChatContext(sid, 6);
                if (ctx.messages && ctx.messages.length > 1) {
                    contextPrefix = '[Lịch sử hội thoại gần đây]\n' + ctx.contextText + '\n\n[Câu hỏi mới]: ';
                }
            } catch { /* ignore */ }

            // Auto-detect diagram requests
            const wantsDiagram = /vẽ|sơ đồ|flowchart|diagram|chart|sequence|biểu đồ|graph/i.test(msg);
            const enhancedMsg = wantsDiagram
                ? `${contextPrefix}${msg}\n\nHãy trả lời bằng mermaid code block (\`\`\`mermaid). Nếu cần giải thích thêm thì viết bên ngoài code block.`
                : `${contextPrefix}${msg}`;

            const res = await chatXClaw(token, enhancedMsg, xclawSessionId);
            setXclawSessionId(res.sessionId);

            const assistantMsg: Message = {
                role: 'assistant', content: res.content || '(Không có phản hồi)', timestamp: new Date(),
            };

            // Save assistant message
            const savedAssistant = await saveChatMessage(sid, { role: 'assistant', content: assistantMsg.content });
            assistantMsg.id = savedAssistant.message?.id;

            setMessages(prev => [...prev, assistantMsg]);
            loadSessions();
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Không thể kết nối tới xClaw AI. Kiểm tra server hoặc đăng nhập lại.',
                timestamp: new Date(),
            }]);
        } finally {
            setSending(false);
        }
    };

    // ─── Rate ───
    const handleRate = async (messageId: string | undefined, rating: number) => {
        if (!messageId) return;
        await rateChatMessage(messageId, rating);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, rating } : m));
        loadStats();
    };

    // ─── Retry ───
    const handleRetry = (content: string) => { send(content); };

    // ─── Request diagram from assistant content ───
    const handleDrawChart = (content: string) => {
        send(`Dựa trên nội dung sau, hãy vẽ sơ đồ mermaid phù hợp:\n\n${content.slice(0, 500)}`);
    };

    return (
        <div className="flex h-full">
            {/* ─── Sidebar: Sessions ─── */}
            <div className="w-[260px] shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--his-border)', background: 'var(--his-surface)' }}>
                {/* New Chat button */}
                <div className="p-3">
                    <button onClick={startNewSession}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer"
                        style={{ background: 'var(--his-primary)', color: '#fff' }}>
                        <Plus size={15} /> Cuộc trò chuyện mới
                    </button>
                </div>

                {/* Session list */}
                <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                    {sessions.map(s => (
                        <div key={s.id}
                            className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                            style={{
                                background: activeSessionId === s.id ? 'var(--his-primary-soft)' : 'transparent',
                                color: activeSessionId === s.id ? 'var(--his-primary)' : 'var(--his-fg-secondary)',
                            }}
                            onClick={() => setActiveSessionId(s.id)}>
                            <MessageSquare size={14} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-medium truncate">{s.title}</div>
                                <div className="text-[10px] opacity-60">{s.messageCount} tin nhắn</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all cursor-pointer">
                                <Trash2 size={12} style={{ color: 'var(--his-danger)' }} />
                            </button>
                        </div>
                    ))}

                    {sessions.length === 0 && (
                        <div className="text-center py-8 text-[11px]" style={{ color: 'var(--his-fg-muted)' }}>
                            <History size={24} className="mx-auto mb-2 opacity-40" />
                            Chưa có lịch sử hội thoại
                        </div>
                    )}
                </div>

                {/* Stats footer */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--his-border)' }}>
                    <button onClick={() => setShowStats(!showStats)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-gray-50 transition-all cursor-pointer"
                        style={{ color: 'var(--his-fg-muted)' }}>
                        <BarChart3 size={12} className="inline mr-1.5" />
                        {chatStats ? `${chatStats.totalMessages} tin nhắn • ${chatStats.thumbsUp}👍 ${chatStats.thumbsDown}👎` : 'Thống kê'}
                    </button>

                    {showStats && chatStats && (
                        <div className="mt-2 p-2.5 rounded-lg text-[11px] space-y-1"
                            style={{ background: 'var(--his-surface-alt)', border: '1px solid var(--his-border)' }}>
                            <div className="flex justify-between"><span>Tổng phiên:</span><span className="font-semibold">{chatStats.totalSessions}</span></div>
                            <div className="flex justify-between"><span>Tổng tin nhắn:</span><span className="font-semibold">{chatStats.totalMessages}</span></div>
                            <div className="flex justify-between"><span>Đã đánh giá:</span><span className="font-semibold">{chatStats.ratedMessages}</span></div>
                            <div className="flex justify-between"><span>Điểm TB:</span>
                                <span className="font-semibold" style={{ color: chatStats.avgRating >= 3 ? 'var(--his-success)' : 'var(--his-danger)' }}>
                                    {chatStats.avgRating || '—'}/5
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Main Chat Area ─── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--his-border)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--his-primary-soft)' }}>
                        <Bot size={18} style={{ color: 'var(--his-primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[13px] font-bold" style={{ color: 'var(--his-fg)' }}>xClaw AI Assistant</h1>
                        <p className="text-[10px]" style={{ color: 'var(--his-fg-muted)' }}>
                            Trợ lý AI dược & y khoa • Hỗ trợ vẽ sơ đồ
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {token ? (
                            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full"
                                style={{ background: 'var(--his-success-soft)', color: 'var(--his-success)' }}>
                                <Wifi size={10} /> Đã kết nối xClaw
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full"
                                style={{ background: 'var(--his-danger-soft)', color: 'var(--his-danger)' }}>
                                <WifiOff size={10} /> xClaw chưa kết nối
                            </span>
                        )}
                    </div>
                </div>

                {/* Messages Area */}
                <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4">
                    {messages.length === 0 && !activeSessionId ? (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                style={{ background: 'var(--his-primary-soft)' }}>
                                <Sparkles size={28} style={{ color: 'var(--his-primary)' }} />
                            </div>
                            <h2 className="text-[15px] font-bold mb-1.5" style={{ color: 'var(--his-fg)' }}>AI Trợ lý xClaw</h2>
                            <p className="text-[12px] max-w-sm mb-6" style={{ color: 'var(--his-fg-muted)' }}>
                                Tra cứu thuốc, kiểm tra tương tác, vẽ sơ đồ quy trình & nhiều hơn nữa
                            </p>

                            {/* Quick prompts */}
                            <div className="grid grid-cols-2 gap-2 max-w-md">
                                {QUICK_PROMPTS.map((qp, i) => (
                                    <button key={i} onClick={() => { if (!activeSessionId) startNewSession().then(() => setTimeout(() => send(qp.prompt), 100)); else send(qp.prompt); }}
                                        className="text-left px-3 py-2.5 rounded-xl text-[12px] transition-all cursor-pointer hover:shadow-sm"
                                        style={{ background: 'var(--his-surface)', border: '1px solid var(--his-border)', color: 'var(--his-fg-secondary)' }}>
                                        <span className="text-[16px] mr-1.5">{qp.icon}</span> {qp.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Message list */
                        <div className="space-y-4 max-w-3xl mx-auto">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                    {m.role !== 'user' && (
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                            style={{ background: m.role === 'system' ? 'var(--his-success-soft)' : 'var(--his-primary-soft)' }}>
                                            <Bot size={14} style={{ color: m.role === 'system' ? 'var(--his-success)' : 'var(--his-primary)' }} />
                                        </div>
                                    )}
                                    <div className="max-w-[75%] min-w-0">
                                        <div className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
                                            style={{
                                                background: m.role === 'user' ? 'var(--his-primary)' : m.role === 'system' ? 'var(--his-success-soft)' : 'var(--his-surface)',
                                                color: m.role === 'user' ? '#fff' : 'var(--his-fg)',
                                                border: m.role === 'assistant' ? '1px solid var(--his-border)' : 'none',
                                                borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                            }}>
                                            <MessageContent content={m.content} />
                                        </div>

                                        {/* Action icons (grouped) */}
                                        {m.role !== 'system' && (
                                            <MessageActions
                                                message={m}
                                                onRate={m.role === 'assistant' ? (r) => handleRate(m.id, r) : undefined}
                                                onCopy={() => handleDrawChart(m.content)}
                                                onRetry={m.role === 'user' ? () => handleRetry(m.content) : undefined}
                                            />
                                        )}
                                    </div>
                                    {m.role === 'user' && (
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--his-fg)', color: '#fff' }}>
                                            <User size={14} />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Typing indicator */}
                            {sending && (
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--his-primary-soft)' }}>
                                        <Bot size={14} style={{ color: 'var(--his-primary)' }} />
                                    </div>
                                    <div className="rounded-2xl px-4 py-3 text-[13px] flex items-center gap-2"
                                        style={{ background: 'var(--his-surface)', border: '1px solid var(--his-border)', color: 'var(--his-fg-muted)', borderRadius: '20px 20px 20px 4px' }}>
                                        <span className="flex gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--his-primary)', animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--his-primary)', animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--his-primary)', animationDelay: '300ms' }} />
                                        </span>
                                        Đang suy nghĩ...
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--his-border)' }}>
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-end gap-2 p-2 rounded-2xl"
                            style={{ background: 'var(--his-surface)', border: '1px solid var(--his-border)', boxShadow: 'var(--his-shadow)' }}>
                            <textarea
                                className="flex-1 resize-none bg-transparent border-none outline-none text-[13px] px-2 py-1.5 min-h-[36px] max-h-[120px]"
                                style={{ color: 'var(--his-fg)' }}
                                placeholder={token ? 'Nhập tin nhắn... (hỗ trợ vẽ sơ đồ — hãy thử "vẽ flowchart...")' : 'Đăng nhập để bắt đầu trò chuyện...'}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                                rows={1}
                            />
                            <button onClick={() => send()} disabled={sending || !input.trim()}
                                className="p-2 rounded-xl transition-all cursor-pointer shrink-0"
                                style={{
                                    background: sending || !input.trim() ? 'var(--his-surface-alt)' : 'var(--his-primary)',
                                    color: sending || !input.trim() ? 'var(--his-fg-muted)' : '#fff',
                                }}>
                                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                        {!token && (
                            <p className="text-[10px] mt-2 text-center flex items-center justify-center gap-1" style={{ color: 'var(--his-fg-muted)' }}>
                                <WifiOff size={10} /> Chưa kết nối — nhấn Đăng nhập để kết nối xClaw AI
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
