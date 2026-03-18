# Architecture Design Document (ADD)

## xClaw v2.0 — AI Agent Platform

**Version:** 2.0.0  
**Date:** 2026-03-17  
**Author:** xClaw Team / xDev.asia  
**Status:** Draft  
**Inspired by:** OpenClaw, Mastra, LangGraph.js, Vercel AI SDK, VoltAgent

---

## Mục lục

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Package Structure](#3-package-structure)
4. [Core Engine](#4-core-engine)
5. [LLM Layer](#5-llm-layer)
6. [Streaming Architecture](#6-streaming-architecture)
7. [Multi-Agent Orchestration](#7-multi-agent-orchestration)
8. [Graph Engine (Workflow)](#8-graph-engine-workflow)
9. [Tool System & MCP](#9-tool-system--mcp)
10. [Memory System](#10-memory-system)
11. [Gateway Layer](#11-gateway-layer)
12. [Observability & Tracing](#12-observability--tracing)
13. [Data Layer](#13-data-layer)
14. [Authentication & Authorization](#14-authentication--authorization)
15. [Plugin & Skill System](#15-plugin--skill-system)
16. [Channel Architecture](#16-channel-architecture)
17. [Web Frontend](#17-web-frontend)
18. [CLI Interface](#18-cli-interface)
19. [Security Model](#19-security-model)
20. [Deployment Architecture](#20-deployment-architecture)
21. [Migration từ v0.2](#21-migration-từ-v02)
22. [Technology Decisions](#22-technology-decisions)

---

## 1. Design Philosophy

### 1.1 Nguyên tắc thiết kế

| # | Nguyên tắc | Giải thích |
|---|---|---|
| 1 | **Streaming-first** | Mọi LLM response đều stream token-by-token. Không bao giờ đợi full response |
| 2 | **Simple & Composable** | Dùng composable patterns thay vì framework phức tạp (theo triết lý Anthropic) |
| 3 | **Provider-agnostic** | Swap LLM provider bằng 1 dòng code. Không vendor lock-in |
| 4 | **Event-driven** | Hệ thống giao tiếp qua events, async, decoupled |
| 5 | **MCP-native** | Hỗ trợ Model Context Protocol (server + client) như first-class citizen |
| 6 | **Observable** | Mọi agent action đều có trace, span, metrics |
| 7 | **Database-backed** | Persistent state. Không in-memory ngoại trừ cache |
| 8 | **Type-safe** | TypeScript strict mode + Zod runtime validation tại mọi boundary |

### 1.2 Không-dùng (Anti-patterns)

| Tránh | Lý do |
|---|---|
| LangChain.js / LangGraph.js dependency | Over-abstraction, bundle bloat, breaking changes. Tự build, lấy pattern |
| Express.js | Nặng, legacy API. Thay bằng Hono (nhẹ 10x, edge-ready) |
| In-memory state cho production | Mất data khi restart. Dùng PostgreSQL + Redis |
| Monolithic agent | Khó scale. Dùng multi-agent coordinator pattern |
| Unstructured LLM output | Unreliable. Dùng Zod schema validation |

### 1.3 Tham chiếu từ best-in-class frameworks (2026)

| Pattern | Lấy từ | Cách áp dụng |
|---|---|---|
| Unified provider interface, `streamText()`, `generateObject()` | Vercel AI SDK | `@xclaw/core/llm/` — 1 interface cho mọi provider |
| Stateful graph, checkpointing, conditional edges | LangGraph.js | `@xclaw/core/graph/` — custom graph engine |
| Agent observability, spans, traces | VoltAgent | `@xclaw/core/tracing/` |
| Tool definition, MCP integration, RAG pipelines | Mastra | `@xclaw/core/tools/`, `@xclaw/core/memory/` |
| Multi-agent orchestration patterns | CrewAI, AutoGen | `@xclaw/core/agent/coordinator.ts` |
| MCP Server/Client protocol | Anthropic MCP SDK | `@xclaw/gateway/mcp-server.ts`, `@xclaw/core/tools/mcp-client.ts` |

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│                                                                     │
│  ┌─────────┐ ┌─────┐ ┌──────────┐ ┌─────────┐ ┌──────┐ ┌───────┐│
│  │ Web UI  │ │ CLI │ │ Telegram │ │ Discord │ │ REST │ │  MCP  ││
│  │(React19)│ │     │ │ (grammY) │ │(disc.js)│ │ API  │ │Client ││
│  └────┬────┘ └──┬──┘ └────┬─────┘ └────┬────┘ └──┬───┘ └──┬────┘│
└───────┼─────────┼─────────┼────────────┼─────────┼────────┼──────┘
        │         │         │            │         │        │
        ▼         ▼         ▼            ▼         ▼        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       GATEWAY LAYER (Hono)                          │
│                                                                     │
│  ┌──────────┐ ┌───────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐│
│  │ REST API │ │ WebSocket │ │   SSE   │ │MCP Server │ │  Auth   ││
│  │ /api/*   │ │ /ws       │ │/stream  │ │/mcp       │ │JWT+RBAC ││
│  └──────────┘ └───────────┘ └─────────┘ └───────────┘ └─────────┘│
│  ┌──────────────┐ ┌────────────┐ ┌──────────────────────────────┐ │
│  │ Rate Limiter │ │  Sessions  │ │ Channel Router               │ │
│  │  (sliding)   │ │  (Redis)   │ │ (Telegram, Discord, Web)     │ │
│  └──────────────┘ └────────────┘ └──────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                               │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Agent Coordinator                            │ │
│  │                                                                │ │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐               │ │
│  │   │  Router  │    │ Planner  │    │ Executor │               │ │
│  │   │  Agent   │───▶│  Agent   │───▶│  Agent   │               │ │
│  │   └──────────┘    └──────────┘    └──────────┘               │ │
│  │                                                                │ │
│  │   ┌─────────────────┐  ┌──────────────────────────────────┐  │ │
│  │   │ Handoff Protocol │  │ Agent Registry (specialist pool) │  │ │
│  │   │ (agent ↔ agent)  │  │ healthcare, code, research, ...  │  │ │
│  │   └─────────────────┘  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────┐  ┌─────────────────────────────────────┐    │
│  │ Graph Engine       │  │ Workflow Registry                   │    │
│  │ (Stateful DAG,     │  │ (saved workflows, triggers, cron)  │    │
│  │  checkpointing)    │  │                                     │    │
│  └───────────────────┘  └─────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CORE ENGINE                                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐│
│  │  LLM Router  │  │ Tool Registry│  │     Memory Manager        ││
│  │              │  │              │  │                           ││
│  │ ┌──────────┐│  │ ┌──────────┐│  │ ┌──────────┐ ┌──────────┐││
│  │ │ OpenAI   ││  │ │ Built-in ││  │ │ Short    │ │ Long     │││
│  │ │ Anthropic││  │ │ MCP Tools││  │ │ Term     │ │ Term     │││
│  │ │ Google   ││  │ │ User     ││  │ │ (Redis)  │ │(PG+vec) │││
│  │ │ Ollama   ││  │ │ Tools    ││  │ └──────────┘ └──────────┘││
│  │ │ Groq     ││  │ └──────────┘│  └───────────────────────────┘│
│  │ │ Mistral  ││  │              │                               │
│  │ └──────────┘│  │ MCP Client   │  ┌───────────────────────────┐│
│  │              │  │ (connect to  │  │  Structured Output        ││
│  │ Streaming   │  │  external    │  │  (Zod schemas)            ││
│  │ Engine      │  │  MCP servers)│  │                           ││
│  └──────────────┘  └──────────────┘  └───────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY LAYER                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐│
│  │   Tracer     │  │   Logger     │  │    Metrics                ││
│  │  (Spans,     │  │ (Structured  │  │  (Tokens, Latency,       ││
│  │   Traces)    │  │   JSON)      │  │   Cost, Error Rate)      ││
│  └──────────────┘  └──────────────┘  └───────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────────┐│
│  │ Event Bus (Async, Wildcard patterns, Replay, Dead-letter)     ││
│  └────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                  │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌───────────────┐ │
│  │PostgreSQL │  │   Redis   │  │  pgvector  │  │  S3 / Local   │ │
│  │           │  │           │  │            │  │   Storage     │ │
│  │• Users    │  │• Sessions │  │• Embeddings│  │• File uploads │ │
│  │• Agents   │  │• Cache    │  │• RAG index │  │• Documents    │ │
│  │• Workflows│  │• PubSub   │  │• Memory    │  │• Exports      │ │
│  │• Traces   │  │• Rate     │  │• Similarity│  │               │ │
│  │• Skills   │  │  limits   │  │  search    │  │               │ │
│  │• Auth     │  │• Queues   │  │            │  │               │ │
│  └───────────┘  └───────────┘  └────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Dependency Graph

```
@xclaw/shared          ← Foundation (types, schemas, constants)
    ↓
@xclaw/db              ← Drizzle ORM, migrations, queries
    ↓
@xclaw/core            ← Agent engine, LLM, memory, tools, graph, tracing
    ↓
@xclaw/skills          ← Industry skill packs (programming, healthcare, ...)
@xclaw/skill-hub       ← Marketplace, Anthropic/MCP adapters
    ↓
@xclaw/gateway         ← Hono HTTP/WS/SSE + MCP Server + Auth
    ↓
@xclaw/server          ← Entry point, bootstraps everything
@xclaw/cli             ← CLI commands
@xclaw/channel-*       ← Telegram, Discord channel plugins
@xclaw/web             ← React frontend (standalone, API client)
```

---

## 3. Package Structure

```
xclaw/
├── packages/
│   ├── shared/                     # @xclaw/shared — Foundation
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       │   ├── agent.ts        # AgentConfig, AgentState
│   │       │   ├── llm.ts          # LLMProvider, LLMMessage, LLMResponse
│   │       │   ├── tool.ts         # ToolDefinition, ToolCall, ToolResult
│   │       │   ├── skill.ts        # SkillManifest, SkillCategory
│   │       │   ├── workflow.ts     # WorkflowNode, WorkflowEdge, Execution
│   │       │   ├── memory.ts       # MemoryEntry, ConversationMessage
│   │       │   ├── channel.ts      # ChannelPlugin, IncomingMessage
│   │       │   ├── auth.ts         # User, Role, Permission
│   │       │   ├── trace.ts        # Span, Trace, TraceEvent
│   │       │   └── mcp.ts          # MCPServerConfig, MCPToolSchema
│   │       ├── schemas/            # ★ NEW: Zod runtime schemas
│   │       │   ├── chat.schema.ts
│   │       │   ├── tool.schema.ts
│   │       │   ├── workflow.schema.ts
│   │       │   └── config.schema.ts
│   │       └── constants/
│   │           ├── defaults.ts
│   │           └── errors.ts
│   │
│   ├── db/                         # ★ NEW: @xclaw/db — Database layer
│   │   └── src/
│   │       ├── index.ts
│   │       ├── client.ts           # Drizzle + PostgreSQL connection
│   │       ├── redis.ts            # Redis client (ioredis)
│   │       ├── schema/             # Drizzle table schemas
│   │       │   ├── users.ts
│   │       │   ├── agents.ts
│   │       │   ├── sessions.ts
│   │       │   ├── workflows.ts
│   │       │   ├── memories.ts
│   │       │   ├── traces.ts
│   │       │   ├── skills.ts
│   │       │   └── mcp-servers.ts
│   │       ├── migrations/         # Drizzle migration files
│   │       └── queries/            # Pre-built query helpers
│   │           ├── user.queries.ts
│   │           ├── agent.queries.ts
│   │           └── workflow.queries.ts
│   │
│   ├── core/                       # @xclaw/core — Engine
│   │   └── src/
│   │       ├── index.ts
│   │       ├── agent/
│   │       │   ├── agent.ts        # Agent class — central orchestrator
│   │       │   ├── coordinator.ts  # ★ NEW: Multi-agent coordinator
│   │       │   ├── specialist.ts   # ★ NEW: Specialist agent factory
│   │       │   ├── handoff.ts      # ★ NEW: Agent handoff protocol
│   │       │   ├── event-bus.ts    # Pub/sub with wildcard + replay
│   │       │   └── agent-rpc.ts    # Remote procedure calls
│   │       ├── llm/
│   │       │   ├── llm-router.ts   # Provider-agnostic router
│   │       │   ├── provider.ts     # Base provider interface
│   │       │   ├── openai.ts       # OpenAI adapter (also Ollama, Groq)
│   │       │   ├── anthropic.ts    # Anthropic Claude adapter
│   │       │   ├── google.ts       # ★ NEW: Google Gemini adapter
│   │       │   └── failover.ts     # Auto-failover between providers
│   │       ├── streaming/          # ★ NEW: Streaming infrastructure
│   │       │   ├── stream-text.ts  # streamText() — SSE token streaming
│   │       │   ├── stream-object.ts# streamObject() — structured streaming
│   │       │   ├── sse.ts          # SSE transport utilities
│   │       │   └── readable.ts     # ReadableStream helpers
│   │       ├── tools/
│   │       │   ├── tool-registry.ts# Tool registration, execution, approval
│   │       │   ├── mcp-client.ts   # ★ NEW: MCP client (connect external servers)
│   │       │   └── mcp-bridge.ts   # ★ NEW: Bridge MCP tools → ToolRegistry
│   │       ├── memory/
│   │       │   ├── memory-manager.ts  # Orchestrator (short + long term)
│   │       │   ├── conversation.ts    # Conversation history (Redis/PG)
│   │       │   ├── vector-store.ts    # ★ NEW: pgvector embeddings
│   │       │   └── rag.ts            # ★ NEW: RAG pipeline
│   │       ├── graph/              # ★ NEW: Stateful Graph Engine
│   │       │   ├── graph-engine.ts # DAG execution with checkpointing
│   │       │   ├── state.ts        # Graph state management
│   │       │   ├── checkpoint.ts   # Checkpoint / resume / replay
│   │       │   ├── nodes/          # Built-in node handlers
│   │       │   │   ├── trigger.ts
│   │       │   │   ├── llm-call.ts
│   │       │   │   ├── tool-call.ts
│   │       │   │   ├── condition.ts
│   │       │   │   ├── loop.ts
│   │       │   │   ├── http-request.ts
│   │       │   │   ├── code.ts
│   │       │   │   ├── transform.ts
│   │       │   │   ├── memory-rw.ts
│   │       │   │   ├── wait.ts
│   │       │   │   ├── merge.ts
│   │       │   │   ├── switch.ts
│   │       │   │   ├── notification.ts
│   │       │   │   ├── sub-workflow.ts
│   │       │   │   └── output.ts
│   │       │   └── edges/
│   │       │       ├── conditional.ts
│   │       │       └── default.ts
│   │       ├── tracing/            # ★ NEW: Observability
│   │       │   ├── tracer.ts       # Span creation, trace tree
│   │       │   ├── span.ts         # Span data model
│   │       │   ├── metrics.ts      # Token/latency/cost aggregation
│   │       │   └── exporter.ts     # Export to DB / console / OTLP
│   │       ├── skills/
│   │       │   ├── skill-manager.ts
│   │       │   └── skill-config-store.ts
│   │       └── plugins/
│   │           └── plugin-loader.ts
│   │
│   ├── skills/                     # @xclaw/skills — Skill packs
│   │   └── src/
│   │       ├── index.ts
│   │       ├── programming/        # Shell, Git, files, tests
│   │       ├── healthcare/         # Symptoms, medications, clinical
│   │       ├── model-management/   # LLM config, Ollama, RAG
│   │       ├── data-analytics/
│   │       ├── devops/
│   │       ├── content-writer/
│   │       ├── research/
│   │       ├── sales-crm/
│   │       ├── project-manager/
│   │       ├── learning/
│   │       ├── finance/
│   │       └── design/
│   │
│   ├── gateway/                    # @xclaw/gateway — HTTP/WS/MCP Server
│   │   └── src/
│   │       ├── index.ts
│   │       ├── gateway.ts          # Hono app setup
│   │       ├── routes/
│   │       │   ├── chat.ts         # POST /api/chat, GET /api/chat/stream
│   │       │   ├── skills.ts       # /api/skills/*
│   │       │   ├── tools.ts        # /api/tools/*
│   │       │   ├── workflows.ts    # /api/workflows/*
│   │       │   ├── agents.ts       # ★ NEW: /api/agents/*
│   │       │   ├── traces.ts       # ★ NEW: /api/traces/*
│   │       │   ├── auth.ts         # ★ NEW: /api/auth/*
│   │       │   ├── health.ts       # /api/health
│   │       │   └── hub.ts          # /api/hub/*
│   │       ├── ws/
│   │       │   ├── ws-handler.ts   # WebSocket upgrade + message routing
│   │       │   └── ws-events.ts    # Event type definitions
│   │       ├── mcp/
│   │       │   └── mcp-server.ts   # ★ NEW: xClaw as MCP Server
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT verification middleware
│   │       │   ├── rate-limit.ts   # Sliding window rate limiter
│   │       │   ├── cors.ts
│   │       │   └── trace.ts        # Request tracing middleware
│   │       ├── session-manager.ts
│   │       └── channel-manager.ts
│   │
│   ├── server/                     # @xclaw/server — Entry point
│   │   └── src/
│   │       └── index.ts            # Bootstrap Agent + Gateway + Channels
│   │
│   ├── cli/                        # @xclaw/cli — CLI interface
│   │   └── src/
│   │       ├── index.ts
│   │       └── commands/
│   │           ├── gateway.ts
│   │           ├── chat.ts
│   │           ├── skills.ts
│   │           ├── hub.ts
│   │           ├── doctor.ts
│   │           ├── update.ts
│   │           ├── agent.ts        # ★ NEW: agent management commands
│   │           └── trace.ts        # ★ NEW: trace inspection commands
│   │
│   ├── channels/
│   │   ├── telegram/               # @xclaw/channel-telegram
│   │   │   └── src/index.ts        # grammY bot
│   │   └── discord/                # @xclaw/channel-discord
│   │       └── src/index.ts        # discord.js bot
│   │
│   ├── skill-hub/                  # @xclaw/skill-hub — Marketplace
│   │   └── src/
│   │       ├── hub-service.ts
│   │       ├── hub-store.ts
│   │       ├── scaffold.ts
│   │       └── adapters/
│   │           ├── anthropic-adapter.ts
│   │           └── mcp-adapter.ts
│   │
│   ├── knowledge-packs/            # Distributable data plugins
│   │   ├── icd10-drug-interactions/
│   │   └── vn-drug-formulary/
│   │
│   └── web/                        # @xclaw/web — React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── chat/           # Chat interface (streaming)
│       │   │   ├── workflow/       # React Flow workflow builder
│       │   │   ├── agent-hub/      # Agent discovery
│       │   │   ├── skill-hub/      # Skill marketplace
│       │   │   ├── dashboard/      # Main dashboard
│       │   │   ├── traces/         # ★ NEW: Trace viewer UI
│       │   │   ├── agents/         # ★ NEW: Agent management UI
│       │   │   ├── settings/
│       │   │   ├── auth/
│       │   │   ├── admin/
│       │   │   └── ui/             # Generic components
│       │   ├── stores/             # Zustand stores
│       │   ├── hooks/              # ★ NEW: useChat(), useStream()
│       │   └── utils/
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── docker-compose.yml              # PG + Redis + App
├── Dockerfile                      # Multi-stage build
├── .env.example
├── package.json                    # Monorepo root
├── tsconfig.json
└── drizzle.config.ts               # ★ NEW: Drizzle ORM config
```

---

## 4. Core Engine

### 4.1 Agent — Central Orchestrator

Agent là trung tâm điều phối tất cả subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent                                    │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ EventBus │  │ LLMRouter│  │ Memory   │  │  Tool    │       │
│  │          │  │          │  │ Manager  │  │ Registry │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Skill    │  │ Graph    │  │ Tracer   │  │ MCP      │       │
│  │ Manager  │  │ Engine   │  │          │  │ Client   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Chat Loop Algorithm (v2 — Streaming)

```
1. User message arrives (REST/WS/Channel)
2. Create trace span: "chat:request"
3. Save message to conversation history (Redis)
4. Build system prompt:
   a. Agent persona
   b. Active skill instructions
   c. Relevant memories (vector search)
   d. MCP tool descriptions (if connected)
5. Load conversation history (last N messages from Redis)
6. Start streaming response:
   a. Call LLM via streamText() — SSE token stream begins
   b. IF LLM returns tool_calls:
      i.   Create child span: "tool:execute"
      ii.  Execute tools (parallel if independent)
      iii. Feed tool results back to LLM
      iv.  Continue streaming (max 10 iterations)
   c. ELSE: stream final text tokens to client
7. Save assistant response to history
8. Auto-memorize if relevant (background)
9. Close trace span with metrics (tokens, latency, cost)
10. Emit event: "agent:response:complete"
```

### 4.3 Event Bus (Enhanced)

```typescript
interface EventBus {
  // Pub/sub with wildcard
  on(pattern: string, handler: EventHandler): void;      // 'tool:*', 'agent:response'
  off(pattern: string, handler: EventHandler): void;
  emit(event: string, payload: unknown): void;
  
  // ★ NEW: Async events (non-blocking)
  emitAsync(event: string, payload: unknown): Promise<void>;
  
  // ★ NEW: Event replay (for debugging/recovery)
  replay(fromTimestamp: number): AsyncIterator<Event>;
  
  // ★ NEW: Dead-letter queue (failed event handlers)
  onDeadLetter(handler: DeadLetterHandler): void;
}
```

**Event categories:**

| Pattern | Events | Emitter |
|---|---|---|
| `agent:*` | `agent:response`, `agent:error`, `agent:thinking` | Agent |
| `tool:*` | `tool:started`, `tool:completed`, `tool:failed`, `tool:approved` | ToolRegistry |
| `workflow:*` | `workflow:started`, `workflow:node:*`, `workflow:completed` | GraphEngine |
| `skill:*` | `skill:activated`, `skill:deactivated`, `skill:error` | SkillManager |
| `trace:*` | `trace:span:start`, `trace:span:end` | Tracer |
| `mcp:*` | `mcp:connected`, `mcp:tool:discovered`, `mcp:error` | MCPClient |
| `channel:*` | `channel:message:in`, `channel:message:out` | ChannelManager |

---

## 5. LLM Layer

### 5.1 Unified Provider Interface (Vercel AI SDK Pattern)

```typescript
// core/llm/provider.ts

interface LLMProvider {
  readonly id: string;                    // 'openai', 'anthropic', 'google', 'ollama'
  readonly name: string;
  
  // ★ Text generation (non-streaming)
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  
  // ★ Streaming text generation  
  streamText(params: StreamTextParams): ReadableStream<TextStreamPart>;
  
  // ★ Structured object generation (Zod schema)
  generateObject<T>(params: GenerateObjectParams<T>): Promise<T>;
  
  // ★ Streaming structured output
  streamObject<T>(params: StreamObjectParams<T>): ReadableStream<ObjectStreamPart<T>>;
  
  // ★ Embeddings
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
}

interface GenerateTextParams {
  model: string;                          // 'gpt-4o', 'claude-sonnet-4-20250514', 'llama3.1'
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  schema?: ZodSchema;                     // ★ For structured output
}

interface StreamTextParams extends GenerateTextParams {
  onToken?: (token: string) => void;      // Per-token callback
  onToolCall?: (call: ToolCall) => void;   // Tool call detected
  onFinish?: (result: StreamResult) => void;
  signal?: AbortSignal;                    // Cancellation
}
```

### 5.2 LLM Router

```typescript
// core/llm/llm-router.ts

class LLMRouter {
  private providers: Map<string, LLMProvider>;
  private activeProvider: string;
  private activeModel: string;
  private failoverChain: string[];         // ★ NEW: Auto-failover

  // Swap provider with 1 line
  use(provider: string, model: string): void;
  
  // Route to active provider
  streamText(params): ReadableStream<TextStreamPart>;
  generateText(params): Promise<GenerateTextResult>;
  generateObject<T>(params): Promise<T>;
  
  // ★ NEW: Auto-failover
  // If primary fails → try next in chain
  // e.g., ['openai:gpt-4o', 'anthropic:claude-sonnet-4-20250514', 'ollama:llama3.1']
  setFailoverChain(chain: string[]): void;
}
```

### 5.3 Provider Adapters

| Provider | Adapter | Models | Notes |
|---|---|---|---|
| **OpenAI** | `openai.ts` | gpt-4o, gpt-4o-mini, o1, o3 | Native tool calling, streaming |
| **Anthropic** | `anthropic.ts` | claude-sonnet-4-20250514, claude-3.5-haiku, claude-3-opus | Native tool use, extended thinking |
| **Google** | `google.ts` | gemini-2.0-flash, gemini-1.5-pro | Large context (1M tokens) |
| **Ollama** | Via `openai.ts` | llama3.1, mistral, phi3, qwen | OpenAI-compatible API |
| **Groq** | Via `openai.ts` | llama3-70b, mixtral | OpenAI-compatible, ultra-fast |
| **Mistral** | Via `openai.ts` | mistral-large, codestral | OpenAI-compatible |

---

## 6. Streaming Architecture

### 6.1 End-to-End Streaming Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client   │     │ Gateway  │     │  Agent   │     │ LLM API  │
│ (Browser) │     │ (Hono)   │     │  Core    │     │(Provider)│
└─────┬────┘     └─────┬────┘     └─────┬────┘     └─────┬────┘
      │                │                │                │
      │ POST /api/chat │                │                │
      │ Accept: text/  │                │                │
      │ event-stream   │                │                │
      │───────────────▶│                │                │
      │                │ agent.stream() │                │
      │                │───────────────▶│                │
      │                │                │ streamText()   │
      │                │                │───────────────▶│
      │                │                │                │
      │                │                │  ◄──token──    │
      │                │  ◄──token──    │  ◄──token──    │
      │  ◄──SSE──      │  ◄──token──    │  ◄──token──    │
      │  ◄──SSE──      │               │                │
      │  ◄──SSE──      │               │  ◄──tool_call──│
      │                │               │                │
      │                │               │  execute tool   │
      │                │               │─────┐           │
      │  ◄──SSE──      │  ◄──status──  │◄────┘           │
      │  (tool status) │               │                │
      │                │               │  feed result───▶│
      │                │               │                │
      │                │               │  ◄──token──    │
      │  ◄──SSE──      │  ◄──token──   │  ◄──token──    │
      │  ◄──SSE──      │              │  ◄──done──     │
      │  ◄──SSE(done)  │              │                │
      │                │                │                │
```

### 6.2 SSE Event Types

```typescript
// Server-Sent Event types
type SSEEvent = 
  | { type: 'text-delta';    data: { delta: string } }          // Text token
  | { type: 'tool-call';     data: ToolCall }                   // Tool invocation
  | { type: 'tool-result';   data: ToolResult }                 // Tool result
  | { type: 'thinking';      data: { content: string } }       // Agent reasoning
  | { type: 'usage';         data: TokenUsage }                 // Token metrics
  | { type: 'error';         data: { message: string } }       // Error
  | { type: 'done';          data: { finishReason: string } }; // Stream end
```

### 6.3 Client-side Hook (React)

```typescript
// web/hooks/useChat.ts

function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTools, setCurrentTools] = useState<ToolCall[]>([]);
  
  async function sendMessage(content: string) {
    // 1. Add user message optimistically
    // 2. Open SSE connection to /api/chat/stream
    // 3. Process events:
    //    text-delta   → append to assistant message
    //    tool-call    → show tool status
    //    tool-result  → update tool result
    //    done         → finalize message
    // 4. AbortController for cancellation
  }
  
  return { messages, sendMessage, isStreaming, currentTools, abort };
}
```

---

## 7. Multi-Agent Orchestration

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Coordinator                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Router Agent                                             │    │
│  │ "Phân tích request, chọn specialist phù hợp"            │    │
│  │                                                          │    │
│  │ Input: user message + context                            │    │
│  │ Output: { agent: "healthcare", reason: "..." }          │    │
│  └──────────────┬──────────────────────────────────────────┘    │
│                 │                                                │
│    ┌────────────┼────────────┬────────────┬──────────┐          │
│    ▼            ▼            ▼            ▼          ▼          │
│  ┌──────┐  ┌──────┐  ┌──────────┐  ┌────────┐  ┌────────┐    │
│  │Code  │  │Health│  │ Research │  │ General│  │ Custom │    │
│  │Agent │  │Agent │  │  Agent   │  │ Agent  │  │ Agent  │    │
│  │      │  │      │  │          │  │        │  │        │    │
│  │Skills│  │Skills│  │ Skills:  │  │No spec.│  │User-   │    │
│  │prog, │  │health│  │ research,│  │skills  │  │defined │    │
│  │devops│  │care  │  │ web      │  │        │  │        │    │
│  └──┬───┘  └──┬───┘  └────┬─────┘  └───┬────┘  └───┬────┘    │
│     │         │           │            │           │           │
│     └─────────┴───────────┴────────────┴───────────┘           │
│                           │                                      │
│                    ┌──────▼──────┐                               │
│                    │   Handoff   │                               │
│                    │  Protocol   │                               │
│                    │             │                               │
│                    │ Agent A ──▶ Agent B                         │
│                    │ with context transfer                       │
│                    └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Orchestration Patterns

| Pattern | Mô tả | Use case |
|---|---|---|
| **Router** | 1 Router agent phân công → 1 Specialist agent thực thi | Default. Mỗi request route tới agent phù hợp |
| **Sequential** | Agent A → Agent B → Agent C (pipeline) | Nghiên cứu → phân tích → báo cáo |
| **Parallel** | Agent A + Agent B chạy đồng thời → merge kết quả | Tìm kiếm multi-source |
| **Generator-Critic** | Agent A tạo output → Agent B đánh giá → lặp | Code review, content quality |
| **Hierarchical** | Manager agent điều phối team of agents | Complex projects |
| **Handoff** | Agent A chuyển giao cho Agent B khi ngoài khả năng | "Tôi không biết y khoa, chuyển cho Health Agent" |

### 7.3 Handoff Protocol

```typescript
interface HandoffRequest {
  fromAgent: string;            // "code-agent"
  toAgent: string;              // "healthcare-agent"  
  reason: string;               // "User asked about medication interactions"
  context: {
    messages: LLMMessage[];     // Conversation so far
    variables: Record<string, unknown>;  // Accumulated state
    traceId: string;            // Maintain trace continuity
  };
}

// Handoff flow:
// 1. Agent A determines it can't handle request
// 2. Agent A emits handoff request with context
// 3. Coordinator validates and routes to Agent B
// 4. Agent B receives full context, continues conversation
// 5. User sees seamless transition
```

### 7.4 Agent Definition

```typescript
interface AgentDefinition {
  id: string;                     // 'healthcare-agent'
  name: string;                   // 'Healthcare Specialist'
  description: string;            // For Router agent to understand capability
  systemPrompt: string;           // Persona + instructions
  skills: string[];               // ['healthcare', 'model-management']
  tools: string[];                // Additional standalone tools
  model?: string;                 // Override default model (e.g. claude for medical)
  maxIterations?: number;         // Tool call limit for this agent
  canHandoffTo?: string[];        // Which agents it can delegate to
}
```

---

## 8. Graph Engine (Workflow)

### 8.1 Architecture (LangGraph-inspired)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Graph Engine                                │
│                                                                  │
│  ┌───────────┐   ┌──────────────┐   ┌───────────────────────┐  │
│  │ Graph     │   │ State        │   │ Checkpoint Store      │  │
│  │ Definition│   │ Manager      │   │ (PostgreSQL)          │  │
│  │  (DAG)    │   │              │   │                       │  │
│  │ nodes[]   │   │ Immutable    │   │ Save/restore at       │  │
│  │ edges[]   │   │ state per    │   │ each node boundary    │  │
│  │ entryPoint│   │ execution    │   │                       │  │
│  └───────────┘   └──────────────┘   └───────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Execution Engine                                          │   │
│  │                                                           │   │
│  │  1. Start at entry node                                   │   │
│  │  2. Execute node handler                                  │   │
│  │  3. Evaluate outgoing edges (conditions)                  │   │
│  │  4. Route to next node(s)                                 │   │
│  │  5. ★ Checkpoint state (for pause/resume)                 │   │
│  │  6. Repeat until output/end node                          │   │
│  │                                                           │   │
│  │  ★ Supports: parallel branches, loops, human-in-the-loop │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 vs v0.2: Key Improvements

| Feature | v0.2 (Backup) | v2.0 |
|---|---|---|
| Traversal | BFS only | BFS + DFS + Parallel branches |
| State | Variables object (no persistence) | Immutable state + PostgreSQL checkpoints |
| Resume | Not supported | Checkpoint → resume at any node |
| Human-in-the-loop | Not supported | Pause at approval nodes, resume via API |
| Loops | Basic `maxIterations` | Conditional loops with break/continue |
| Sub-workflows | Basic | Full state isolation + result mapping |
| Error handling | Try/catch per node | Retry policies, fallback edges, dead-letter |

### 8.3 Node Types (18 types — extended from 16)

| Category | Type | Description |
|---|---|---|
| **Trigger** | `trigger` | Entry point — manual, cron, webhook, event, message |
| **AI** | `llm-call` | Call LLM with streaming support |
| **AI** | `agent-call` | ★ NEW: Invoke a specialist agent |
| **Action** | `tool-call` | Execute registered tool |
| **Action** | `http-request` | HTTP API call |
| **Action** | `code` | Sandboxed JavaScript execution |
| **Action** | `notification` | Send notification (email, Slack, etc.) |
| **Control** | `condition` | If/else branch |
| **Control** | `loop` | Repeat with condition |
| **Control** | `switch` | Multi-branch routing |
| **Control** | `wait` | Pause execution |
| **Control** | `merge` | Merge parallel branches |
| **Control** | `approval` | ★ NEW: Human-in-the-loop pause |
| **Data** | `transform` | Data transformation (templates) |
| **Data** | `memory-read` | Read from agent memory |
| **Data** | `memory-write` | Write to agent memory |
| **Data** | `sub-workflow` | Call another workflow |
| **Output** | `output` | Terminal node — final output |

### 8.4 Checkpoint & Resume

```typescript
interface Checkpoint {
  id: string;                      // UUID
  executionId: string;             // Workflow execution ID
  nodeId: string;                  // Which node was just completed
  state: GraphState;               // Full state snapshot (immutable)
  timestamp: Date;
  metadata: {
    nodesCompleted: string[];
    nextNodes: string[];
    duration: number;              // ms since execution start
  };
}

// Use cases:
// 1. Pause at "approval" node → save checkpoint → resume when approved
// 2. Error at node → rewind to last checkpoint → retry
// 3. Long-running workflow → checkpoint periodically → survive restarts
// 4. Debug: replay execution step by step
```

---

## 9. Tool System & MCP

### 9.1 Tool Registry (Enhanced)

```typescript
interface ToolDefinition {
  name: string;                              // Unique name
  description: string;                       // For LLM to understand
  parameters: ZodSchema;                     // ★ Zod schema (not JSON Schema)
  execute: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
  
  // Metadata
  category?: string;                         // 'file', 'network', 'database'
  source?: 'builtin' | 'skill' | 'mcp' | 'user';
  requiresApproval?: boolean;
  timeout?: number;                          // ms, default 30000
  
  // ★ NEW: Safety
  riskLevel?: 'safe' | 'moderate' | 'dangerous';
  blocklist?: string[];                      // Blocked patterns (e.g., 'rm -rf')
}
```

### 9.2 MCP Architecture (Dual-role)

xClaw đóng vai trò **vừa MCP Server vừa MCP Client**:

```
                          MCP Ecosystem
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                   │
            ▼                  │                   ▼
   ┌─────────────────┐        │        ┌─────────────────┐
   │ External MCP    │        │        │ External MCP    │
   │ Clients         │        │        │ Servers         │
   │                 │        │        │                 │
   │ • Claude Desktop│        │        │ • GitHub MCP    │
   │ • Cursor        │        │        │ • Chrome MCP    │
   │ • VS Code       │        │        │ • PostgreSQL MCP│
   │ • Custom apps   │        │        │ • Brave Search  │
   └────────┬────────┘        │        └────────┬────────┘
            │                 │                  │
            ▼                 │                  ▼
   ┌─────────────────┐        │        ┌─────────────────┐
   │ xClaw as        │        │        │ xClaw as        │
   │ MCP SERVER      │◄───────┼───────▶│ MCP CLIENT      │
   │                 │        │        │                  │
   │ Exposes:        │        │        │ Connects to:     │
   │ • All registered│        │        │ • External MCP   │
   │   tools         │        │        │   servers        │
   │ • Chat API      │        │        │ • Bridge tools   │
   │ • Workflow API   │        │        │   into Agent     │
   │ • Memory API    │        │        │   ToolRegistry   │
   └─────────────────┘        │        └─────────────────┘
                              │
                       ┌──────┴──────┐
                       │   xClaw     │
                       │   Agent     │
                       │   Platform  │
                       └─────────────┘
```

### 9.3 MCP Server (xClaw exposes tools)

```typescript
// gateway/mcp/mcp-server.ts
// Cho phép Claude Desktop, Cursor, etc. gọi xClaw tools

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

class XClawMCPServer {
  private server: McpServer;
  
  constructor(toolRegistry: ToolRegistry) {
    this.server = new McpServer({ name: 'xclaw', version: '2.0.0' });
    
    // Auto-register all Agent tools as MCP tools
    for (const tool of toolRegistry.listAll()) {
      this.server.tool(
        tool.name,
        tool.description,
        tool.parameters,  // Zod schema → auto JSON Schema
        async (args) => toolRegistry.execute({ name: tool.name, arguments: args })
      );
    }
  }
  
  // Transports: stdio (CLI), streamable-http (Gateway)
  async serveStdio(): Promise<void>;
  async serveHTTP(path: string): Promise<void>;
}
```

### 9.4 MCP Client (xClaw connects to external servers)

```typescript
// core/tools/mcp-client.ts

class MCPClientManager {
  private clients: Map<string, MCPClient>;
  
  // Register & connect to external MCP server
  async register(config: MCPServerConfig): Promise<void>;
  
  // Discover tools from connected server
  async discoverTools(serverId: string): Promise<ToolDefinition[]>;
  
  // Bridge: inject MCP tools into Agent's ToolRegistry
  async bridge(serverId: string, toolRegistry: ToolRegistry): Promise<void>;
  
  // Tool names are prefixed: mcp_{serverName}_{toolName}
  // e.g., "mcp_github_create_issue", "mcp_brave_web_search"
}
```

---

## 10. Memory System

### 10.1 Dual-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Manager                               │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │   SHORT-TERM MEMORY      │  │    LONG-TERM MEMORY           │ │
│  │   (Redis)                │  │    (PostgreSQL + pgvector)     │ │
│  │                          │  │                                │ │
│  │  • Conversation history  │  │  • Semantic memories           │ │
│  │    (per sessionId)       │  │  • Vector embeddings           │ │
│  │  • Last N messages       │  │  • Cosine similarity search    │ │
│  │  • TTL: 24h default      │  │  • Tags, metadata filtering   │ │
│  │  • Fast read/write       │  │  • Permanent until deleted     │ │
│  │                          │  │                                │ │
│  │  Operations:             │  │  Operations:                   │ │
│  │  • getHistory(sessionId) │  │  • remember(content, tags)     │ │
│  │  • addMessage(msg)       │  │  • recall(query, limit)        │ │
│  │  • clearSession()        │  │  • forget(id)                  │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │   RAG Pipeline                                                ││
│  │                                                               ││
│  │   Upload doc → Parse → Chunk → Embed → Store in pgvector     ││
│  │                                                               ││
│  │   Query → Embed query → Vector search → Re-rank → Inject     ││
│  │            context into LLM prompt                            ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 vs v0.2 Memory

| Feature | v0.2 | v2.0 |
|---|---|---|
| Conversation storage | In-memory Map | Redis (fast, TTL, survives restart) |
| Long-term memory | In-memory array + cosine | PostgreSQL + pgvector (persistent, indexed) |
| RAG | MongoDB-based | pgvector (simpler stack, no Mongo required) |
| Embeddings | Custom cosine similarity | pgvector `<=>` operator (HNSW index) |
| Scalability | Single process, lost on restart | Distributed, persistent |

### 10.3 pgvector Schema

```sql
-- memories table
CREATE TABLE memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES agents(id),
  content     TEXT NOT NULL,
  type        VARCHAR(50) DEFAULT 'general',    -- 'fact', 'preference', 'knowledge'
  tags        TEXT[] DEFAULT '{}',
  embedding   vector(1536),                      -- OpenAI ada-002 dimension
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON memories 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Semantic search query
SELECT id, content, tags, 
       1 - (embedding <=> $1::vector) AS similarity
FROM memories
WHERE agent_id = $2
  AND ($3::text[] IS NULL OR tags && $3)   -- Optional tag filter
ORDER BY embedding <=> $1::vector
LIMIT $4;
```

---

## 11. Gateway Layer

### 11.1 Hono (thay Express)

**Lý do chọn Hono:**

| Tiêu chí | Express | Hono |
|---|---|---|
| Bundle size | ~200KB | ~14KB |
| Performance | Baseline | ~3.5x faster |
| TypeScript | Cần @types | Native TS |
| Edge-ready | No | Yes (Cloudflare, Deno, Bun) |
| SSE support | Manual | Built-in |
| Middleware | callback-based | Composable, type-safe |

### 11.2 Route Structure

```
/api/
├── /health                   GET     Health check
├── /auth/
│   ├── /register             POST    Create account
│   ├── /login                POST    Get JWT token
│   ├── /refresh              POST    Refresh token
│   └── /me                   GET     Current user info
├── /chat                     POST    Send message (non-streaming)
├── /chat/stream              POST    Send message (SSE streaming) ★
├── /agents/
│   ├── /                     GET     List agents
│   ├── /:id                  GET     Agent details
│   ├── /                     POST    Create agent
│   └── /:id/chat             POST    Chat with specific agent ★
├── /skills/
│   ├── /                     GET     List all skills
│   ├── /active               GET     Active skills
│   ├── /:id/activate         POST    Activate skill
│   └── /:id/deactivate       POST    Deactivate skill
├── /tools/
│   ├── /                     GET     List available tools
│   └── /:name/execute        POST    Execute tool (with approval)
├── /workflows/
│   ├── /                     GET/POST List/create workflows
│   ├── /:id                  GET/PUT  Get/update workflow
│   ├── /:id/execute          POST     Execute workflow
│   ├── /:id/executions       GET      Execution history
│   └── /:id/executions/:eid  GET      Execution details + checkpoints ★
├── /mcp/
│   ├── /                     MCP      MCP Server endpoint (stdio-over-http) ★
│   ├── /servers               GET     List connected MCP servers
│   └── /servers/:id/tools     GET     Tools from specific MCP server
├── /traces/                           ★ NEW
│   ├── /                     GET     List traces
│   ├── /:id                  GET     Trace details (span tree)
│   └── /metrics              GET     Aggregated metrics
├── /hub/
│   ├── /skills               GET     Browse skill marketplace
│   ├── /import/anthropic     POST    Import Anthropic skill
│   └── /submit               POST    Submit community skill
├── /version                  GET     Version info
└── /version/check            GET     Check for updates

/ws                           WS      WebSocket real-time events ★
/mcp                          MCP     MCP Server (streamable-http) ★
```

### 11.3 WebSocket Events

```typescript
// Client → Server
type ClientEvent =
  | { type: 'chat:send';       data: { sessionId: string; message: string } }
  | { type: 'workflow:execute'; data: { workflowId: string; trigger: unknown } }
  | { type: 'agent:select';    data: { agentId: string } }
  | { type: 'ping' };

// Server → Client
type ServerEvent =
  | { type: 'chat:token';      data: { delta: string } }
  | { type: 'chat:tool';       data: ToolCall }
  | { type: 'chat:done';       data: { usage: TokenUsage } }
  | { type: 'workflow:node';    data: NodeExecutionResult }
  | { type: 'workflow:done';    data: WorkflowResult }
  | { type: 'trace:span';      data: SpanEvent }
  | { type: 'error';           data: { message: string } }
  | { type: 'pong' };
```

---

## 12. Observability & Tracing

### 12.1 Trace Model (VoltAgent-Inspired)

```
Trace (1 user request)
│
├── Span: "gateway:request" (12ms)
│   └── metadata: { method: POST, path: /api/chat/stream, ip: ... }
│
├── Span: "agent:chat" (2340ms)
│   ├── Span: "memory:recall" (45ms)
│   │   └── metadata: { query: "...", results: 3 }
│   │
│   ├── Span: "llm:stream" (1800ms)
│   │   └── metadata: { provider: openai, model: gpt-4o, tokens_in: 420, tokens_out: 380 }
│   │
│   ├── Span: "tool:execute:web_search" (350ms)
│   │   └── metadata: { args: {...}, result: {...}, approval: false }
│   │
│   └── Span: "llm:stream" (900ms)  [2nd call after tool result]
│       └── metadata: { provider: openai, tokens_in: 850, tokens_out: 220 }
│
└── Span: "memory:save" (15ms)
    └── metadata: { type: 'conversation', sessionId: ... }

Total: 3162ms | Tokens: 1870 | Cost: $0.0043
```

### 12.2 Tracer API

```typescript
// core/tracing/tracer.ts

class Tracer {
  // Create root trace for a request
  startTrace(name: string, metadata?: Record<string, unknown>): Trace;
  
  // Create child span within a trace
  startSpan(trace: Trace, name: string, parent?: Span): Span;
  
  // End span with result
  endSpan(span: Span, result?: { status: 'ok' | 'error'; metadata?: unknown }): void;
  
  // Query traces (for UI)
  listTraces(filter: TraceFilter): Promise<Trace[]>;
  getTrace(id: string): Promise<TraceDetail>;
  
  // Metrics aggregation
  getMetrics(timeRange: TimeRange): Promise<AgentMetrics>;
}

interface AgentMetrics {
  totalRequests: number;
  avgLatency: number;              // ms
  totalTokens: { input: number; output: number };
  totalCost: number;               // USD
  errorRate: number;               // 0-1
  topTools: { name: string; count: number; avgDuration: number }[];
  modelUsage: { model: string; requests: number; tokens: number }[];
}
```

### 12.3 Trace Storage

```sql
CREATE TABLE traces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  status      VARCHAR(20) DEFAULT 'running',   -- running, completed, error
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata    JSONB DEFAULT '{}',
  
  -- Aggregated metrics
  total_tokens_in   INTEGER DEFAULT 0,
  total_tokens_out  INTEGER DEFAULT 0,
  total_cost        DECIMAL(10,6) DEFAULT 0,
  tool_calls_count  INTEGER DEFAULT 0,
  error_count       INTEGER DEFAULT 0
);

CREATE TABLE spans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id    UUID REFERENCES traces(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES spans(id),      -- NULL for root spans
  name        VARCHAR(255) NOT NULL,           -- 'llm:stream', 'tool:execute:shell_exec'
  status      VARCHAR(20) DEFAULT 'running',
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata    JSONB DEFAULT '{}'               -- tokens, model, args, result, etc.
);

CREATE INDEX idx_spans_trace ON spans(trace_id);
CREATE INDEX idx_spans_parent ON spans(parent_id);
CREATE INDEX idx_traces_started ON traces(started_at DESC);
```

---

## 13. Data Layer

### 13.1 Technology Stack

| Technology | Role | Justification |
|---|---|---|
| **PostgreSQL 16+** | Primary database | ACID, relations, pgvector, JSON, reliable |
| **pgvector** | Vector embeddings | Same DB, no extra service. HNSW index for fast similarity search |
| **Redis 7+** | Cache, sessions, pub/sub | Sub-ms reads, TTL, native pub/sub for WS events |
| **Drizzle ORM** | Database toolkit | Type-safe, lightweight, push-based migrations, SQL-like API |

### 13.2 Tại sao bỏ MongoDB (so với v0.2)

| Lý do | Giải thích |
|---|---|
| Giảm infrastructure | 1 database (PG) thay vì 2 (PG + Mongo). Đơn giản hơn cho deploy |
| pgvector thay MongoDB Atlas Vector Search | pgvector đủ mạnh, không cần Atlas (cloud-only) |
| JSONB | PostgreSQL JSONB thay Mongo documents cho unstructured data |
| Drizzle ORM | 1 ORM cho tất cả, không cần 2 clients (pg + mongoose) |
| Operational simplicity | 1 backup, 1 monitoring, 1 connection pool |

> **Lưu ý:** Nếu project scale lên cần MongoDB cho specific use cases (chat logs cực lớn, time-series), có thể thêm sau. Architecture cho phép.

### 13.3 PostgreSQL Schema Overview

```sql
-- ============ CORE ============
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255),
  role          VARCHAR(50) DEFAULT 'user',     -- 'user', 'admin'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  system_prompt TEXT,
  model         VARCHAR(100),                    -- Override default model
  skills        TEXT[] DEFAULT '{}',             -- Activated skill IDs
  tools         TEXT[] DEFAULT '{}',             -- Additional tool IDs
  config        JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES users(id),
  is_public     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  agent_id      UUID REFERENCES agents(id),
  title         VARCHAR(255),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_active   TIMESTAMPTZ DEFAULT NOW()
);

-- ============ CONVERSATIONS (JSONB thay Mongo) ============
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL,            -- 'user', 'assistant', 'system', 'tool'
  content       TEXT,
  tool_calls    JSONB,                           -- [{name, args, result}]
  metadata      JSONB DEFAULT '{}',              -- tokens, model, latency
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);

-- ============ WORKFLOWS ============
CREATE TABLE workflows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  nodes         JSONB NOT NULL,                  -- WorkflowNode[]
  edges         JSONB NOT NULL,                  -- WorkflowEdge[]
  config        JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES users(id),
  version       INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'running',   -- running, completed, failed, paused
  trigger_data  JSONB,
  result        JSONB,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_ms   INTEGER
);

CREATE TABLE workflow_checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id       VARCHAR(255) NOT NULL,
  state         JSONB NOT NULL,                  -- Full state snapshot
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============ MEMORIES (pgvector) ============
-- (See section 10.3)

-- ============ TRACES ============
-- (See section 12.3)

-- ============ SKILLS ============
CREATE TABLE skill_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      VARCHAR(100) UNIQUE NOT NULL,
  is_active     BOOLEAN DEFAULT false,
  config        JSONB DEFAULT '{}',
  activated_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============ MCP SERVERS ============
CREATE TABLE mcp_servers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(50),                     -- 'code', 'web', 'data', etc.
  transport     VARCHAR(20) NOT NULL,            -- 'stdio', 'sse', 'streamable-http'
  command       TEXT,                            -- For stdio transport
  url           TEXT,                            -- For SSE/HTTP transport
  env           JSONB DEFAULT '{}',              -- Environment variables (encrypted)
  enabled       BOOLEAN DEFAULT true,
  auto_connect  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mcp_tools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  input_schema  JSONB,                           -- JSON Schema
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 13.4 Redis Usage

| Key Pattern | Purpose | TTL |
|---|---|---|
| `session:{id}` | Session metadata | 24h |
| `history:{sessionId}` | Conversation messages (list) | 24h |
| `rate:{ip}:{endpoint}` | Rate limiting counter | 1min sliding |
| `cache:llm:{hash}` | LLM response cache | 1h |
| `lock:{resource}` | Distributed locks | 30s |

**Pub/Sub channels:**

| Channel | Events |
|---|---|
| `ws:{sessionId}` | Stream tokens, tool status → WebSocket |
| `workflow:{executionId}` | Node completion events |
| `trace:{traceId}` | Live trace span events |

---

## 14. Authentication & Authorization

### 14.1 JWT + RBAC

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client   │────▶│ Gateway  │────▶│   Auth   │
│           │     │          │     │  Service │
│ Bearer    │     │ Verify   │     │          │
│ {token}   │     │ JWT      │     │ Users DB │
└──────────┘     └──────────┘     └──────────┘
```

### 14.2 Flow

```
1. POST /api/auth/register { email, password, name }
   → Hash password (argon2id)
   → Insert user to PostgreSQL
   → Return { userId }

2. POST /api/auth/login { email, password }
   → Verify password
   → Generate JWT (access: 15min, refresh: 7days)
   → Return { accessToken, refreshToken }

3. All subsequent requests:
   → Header: Authorization: Bearer {accessToken}
   → Middleware verifies JWT signature + expiry
   → Attach user to request context

4. POST /api/auth/refresh { refreshToken }
   → Verify refresh token
   → Generate new access token
   → Return { accessToken }
```

### 14.3 RBAC Roles

| Role | Permissions |
|---|---|
| `user` | Chat, use active skills, create workflows, view own traces |
| `admin` | All of user + manage skills, agents, users, MCP servers, view all traces |

---

## 15. Plugin & Skill System

### 15.1 Skill Definition (giữ nguyên pattern v0.2)

```typescript
// defineSkill() helper — type-safe skill definition
const programmingSkill = defineSkill({
  id: 'programming',
  name: 'Programming & DevOps',
  version: '2.0.0',
  category: 'programming',
  description: 'Shell, Git, file management, testing tools',
  
  tools: {
    shell_exec: {
      description: 'Execute a shell command',
      parameters: z.object({
        command: z.string().describe('Command to execute'),
        cwd: z.string().optional(),
      }),
      riskLevel: 'dangerous',
      requiresApproval: true,
      execute: async (args, ctx) => { /* ... */ },
    },
    // ... more tools
  },
  
  // ★ NEW: Skill system prompt injection
  systemPrompt: `You have access to programming tools. When asked to write code,
                  prefer using file_write. When asked about git, use git_* tools.`,
  
  // ★ NEW: Lifecycle hooks
  onActivate: async (ctx) => { /* setup */ },
  onDeactivate: async (ctx) => { /* cleanup */ },
});
```

### 15.2 Plugin Manifest (xclaw.plugin.json)

```json
{
  "name": "@xclaw/channel-telegram",
  "version": "2.0.0",
  "description": "Telegram channel plugin",
  "type": "channel",
  "entry": "dist/index.js",
  "platforms": ["telegram"],
  "config": [
    { "key": "botToken", "type": "secret", "required": true },
    { "key": "allowedChatIds", "type": "string[]", "required": false }
  ],
  "permissions": ["network"],
  "minXClawVersion": "2.0.0"
}
```

---

## 16. Channel Architecture

### 16.1 Channel Interface

```typescript
interface ChannelPlugin {
  readonly id: string;              // 'telegram', 'discord'
  readonly name: string;
  
  start(config: ChannelConfig): Promise<void>;
  stop(): Promise<void>;
  
  // Handle incoming messages from users
  onMessage(handler: (msg: IncomingMessage) => Promise<OutgoingMessage>): void;
  
  // Send message to specific channel/user
  send(target: string, message: OutgoingMessage): Promise<void>;
}
```

### 16.2 Message Flow

```
User sends message on Telegram
        │
        ▼
┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│ Telegram Bot  │────▶│ Channel      │────▶│ Gateway      │
│ (grammY)      │     │ Manager      │     │ Chat Route   │
│               │     │              │     │              │
│ Parse message │     │ Normalize to │     │ Route to     │
│ Extract meta  │     │ IncomingMsg  │     │ Agent        │
└───────────────┘     └──────────────┘     └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │    Agent     │
                                            │  (streaming) │
                                            │              │
                                            │  Process +   │
                                            │  Stream back │
                                            └──────┬───────┘
                                                   │
                                                   ▼
┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│ Telegram Bot  │◀────│ Channel      │◀────│ Gateway      │
│ Send reply    │     │ Manager      │     │ Respond      │
└───────────────┘     └──────────────┘     └──────────────┘
```

---

## 17. Web Frontend

### 17.1 Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 6 | Build tool |
| Tailwind CSS | 4 | Styling |
| @xyflow/react | 12 | Workflow builder canvas |
| Zustand | 5 | State management |
| Lucide React | — | Icons |
| Recharts | — | Dashboard charts |
| react-markdown | — | Markdown rendering in chat |

### 17.2 Key Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Overview metrics, recent chats, active agents |
| Chat | `/chat/:sessionId?` | Streaming chat interface |
| Agents | `/agents` | Agent management (create, configure, test) |
| Workflows | `/workflows` | Workflow builder (React Flow canvas) |
| Skills | `/skills` | Skill activation, configuration |
| Skill Hub | `/hub` | Marketplace (browse, import, submit) |
| Traces | `/traces` | ★ Trace viewer (span tree, metrics) |
| Settings | `/settings` | LLM config, profile, API keys |
| Admin | `/admin` | User management, system settings |

### 17.3 Streaming Chat UI

```typescript
// Xử lý SSE stream trong React
function ChatView() {
  const { messages, sendMessage, isStreaming, abort } = useChat({
    endpoint: '/api/chat/stream',
    sessionId: currentSession,
  });
  
  return (
    <div>
      {messages.map(msg => (
        <ChatMessage 
          key={msg.id} 
          message={msg}
          showToolCalls={true}    // Show tool execution in real-time
          showThinking={true}     // Show agent reasoning (if available)
        />
      ))}
      {isStreaming && <StreamingIndicator onCancel={abort} />}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
```

---

## 18. CLI Interface

### 18.1 Commands

```bash
xclaw [command] [options]

Commands:
  xclaw gateway              Start the Gateway server
  xclaw chat [message]       Chat with agent (interactive or one-shot)
  xclaw agent list           List configured agents
  xclaw agent create         Create new specialist agent
  xclaw skills list          List all skills (active/inactive)
  xclaw skills activate      Activate a skill
  xclaw hub browse           Browse skill marketplace
  xclaw hub import           Import skill from source
  xclaw trace list           List recent traces ★ NEW
  xclaw trace show <id>      Show trace detail (span tree) ★ NEW  
  xclaw doctor               System health check
  xclaw update               Check for updates

Options:
  --provider <name>          LLM provider (openai/anthropic/ollama)
  --model <name>             Model name
  --session <id>             Session ID for chat continuity
  --stream                   Enable streaming output (default: true)
  --json                     Output as JSON
  --verbose                  Verbose logging
```

---

## 19. Security Model

| Layer | Mechanism | Details |
|---|---|---|
| **Auth** | JWT (access + refresh tokens) | argon2id password hashing, 15min access TTL |
| **RBAC** | Role-based access control | user, admin roles with permission gating |
| **API Keys** | AES-256-GCM encryption | Provider API keys encrypted at rest in PostgreSQL |
| **Tool Execution** | Approval + blocklist | `requiresApproval` flag, dangerous command blocklist |
| **Shell Commands** | Blocklist + sandbox | Block `rm -rf /`, `mkfs`, format commands |
| **Rate Limiting** | Sliding window (Redis) | Per-IP, per-user rate limits on API endpoints |
| **LLM Safety** | Max iterations | 10 tool call iterations max to prevent infinite loops |
| **Code Execution** | Sandboxed | `new Function()` with limited context in workflow code nodes |
| **MCP** | Transport validation | MCP server connections validated, env vars encrypted |
| **CORS** | Configurable origins | Whitelist allowed origins via `CORS_ORIGINS` env |
| **Input Validation** | Zod schemas | All API inputs validated with Zod at gateway boundary |
| **SQL Injection** | Drizzle ORM | Parameterized queries via ORM, no raw SQL concatenation |

---

## 20. Deployment Architecture

### 20.1 Docker Compose (Development)

```yaml
services:
  xclaw:
    build: .
    ports:
      - "18789:18789"      # Gateway (HTTP + WS + SSE + MCP)
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://xclaw:xclaw@postgres:5432/xclaw
      REDIS_URL: redis://redis:6379
      GATEWAY_PORT: "18789"

  postgres:
    image: pgvector/pgvector:pg16   # PostgreSQL 16 + pgvector
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: xclaw
      POSTGRES_PASSWORD: xclaw
      POSTGRES_DB: xclaw
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: pg_isready -U xclaw
      interval: 5s

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redisdata:/data]
    healthcheck:
      test: redis-cli ping
      interval: 5s

  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: web
    ports: ["3000:3000"]

volumes:
  pgdata:
  redisdata:
```

### 20.2 Docker Multi-Stage Build

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/*/package.json ./packages/
RUN npm ci --ignore-scripts

# Stage 2: Build all packages
FROM base AS builder
COPY . .
RUN npm run build

# Stage 3: Server runtime (minimal)
FROM node:20-alpine AS server
WORKDIR /app
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/packages/*/package.json ./packages/
COPY --from=builder /app/package.json ./
RUN npm ci --omit=dev --ignore-scripts
CMD ["node", "packages/server/dist/index.js"]

# Stage 4: Web (static files via nginx)
FROM nginx:alpine AS web
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
```

### 20.3 Production Architecture

```
                    ┌──────────────┐
                    │   Nginx /    │
                    │   Cloudflare │
                    │   (Reverse   │
                    │    Proxy)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ xClaw    │ │ xClaw    │ │ xClaw    │
        │ Server 1 │ │ Server 2 │ │ Server N │
        └─────┬────┘ └─────┬────┘ └─────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │PostgreSQL│ │  Redis   │ │  S3 /    │
        │+ pgvector│ │ Cluster  │ │  MinIO   │
        └──────────┘ └──────────┘ └──────────┘
```

---

## 21. Migration từ v0.2

### 21.1 Những gì giữ nguyên

| Component | Status | Notes |
|---|---|---|
| `defineSkill()` pattern | **Giữ nguyên** | Proven pattern, dễ dùng |
| Skill packs (12 skills) | **Migrate** | Chỉ update tool parameters sang Zod |
| Event bus concept | **Giữ + nâng cấp** | Thêm async, replay, dead-letter |
| Plugin manifest (xclaw.plugin.json) | **Giữ nguyên** | |
| Channel interface (Telegram, Discord) | **Giữ nguyên** | |
| CLI commands | **Giữ + thêm** | Thêm agent, trace commands |
| Web UI components | **Migrate** | Thêm streaming, traces, agents pages |
| Workflow node types (16) | **Giữ + thêm 2** | Thêm agent-call, approval |

### 21.2 Những gì thay đổi

| Component | v0.2 | v2.0 |
|---|---|---|
| HTTP framework | Express 5 | **Hono** |
| Database | In-memory / MongoDB | **PostgreSQL + pgvector + Redis** |
| ORM | Raw pg/mongo drivers | **Drizzle ORM** |
| Auth | In-memory basic | **JWT + RBAC** |
| Chat | Non-streaming | **Streaming-first (SSE)** |
| Agent model | Single agent | **Multi-agent coordinator** |
| Workflow state | In-memory variables | **PostgreSQL checkpoints** |
| LLM output | Unstructured text | **Zod structured output** |
| Tool parameters | JSON Schema-like | **Zod schemas** |
| MCP | Adapter only | **Full MCP Server + Client** |
| Observability | None | **Built-in tracing** |

### 21.3 Migration Steps

```
Phase 1: Foundation
  ├── Create @xclaw/shared (types + Zod schemas)
  ├── Create @xclaw/db (Drizzle + PostgreSQL + Redis)
  └── Setup monorepo root (package.json, tsconfig, docker-compose)

Phase 2: Core Engine
  ├── Migrate @xclaw/core/llm/ (add unified interface + streaming)
  ├── Migrate @xclaw/core/tools/ (Zod params + MCP client)
  ├── Create @xclaw/core/streaming/ (SSE + ReadableStream)
  ├── Create @xclaw/core/tracing/ (tracer, spans, metrics)
  ├── Migrate @xclaw/core/memory/ (Redis short-term + pgvector)
  ├── Create @xclaw/core/agent/coordinator.ts (multi-agent)
  └── Migrate @xclaw/core/graph/ (upgrade workflow engine)

Phase 3: Gateway + Web
  ├── Rewrite @xclaw/gateway with Hono
  ├── Add JWT auth middleware
  ├── Add SSE streaming endpoint
  ├── Add MCP server endpoint
  ├── Migrate @xclaw/web (add streaming chat, traces UI)
  └── Create useChat() hook

Phase 4: Skills + Channels
  ├── Migrate 12 skill packs (JSON Schema → Zod)
  ├── Migrate Telegram + Discord channels
  ├── Migrate @xclaw/skill-hub
  └── Migrate @xclaw/cli

Phase 5: Polish
  ├── Multi-agent orchestration (router, specialists)
  ├── Workflow checkpointing + human-in-the-loop
  ├── Trace viewer UI
  ├── MCP server presets
  └── Documentation
```

---

## 22. Technology Decisions

### 22.1 Decision Log

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| HTTP Framework | **Hono** | Express, Fastify, Elysia | Lightest, edge-ready, native TS, SSE built-in |
| Database | **PostgreSQL** | MongoDB, SQLite, Turso | Mature, pgvector, JSONB, Drizzle support |
| Vector DB | **pgvector** | Pinecone, Weaviate, Qdrant | Same DB as primary, no extra infra, good enough for our scale |
| Cache/PubSub | **Redis** | KeyDB, Dragonfly, in-memory | Proven, fast, native pub/sub for WS events |
| ORM | **Drizzle** | Prisma, Kysely, TypeORM | Lightweight, SQL-like API, push migrations, type-safe |
| LLM Integration | **Custom adapters** | LangChain.js, Vercel AI SDK | Full control, no deps bloat, pattern from AI SDK |
| Schema Validation | **Zod** | io-ts, Ajv, Yup | TS-native, used by AI SDK/Drizzle, runtime + compile |
| Graph Engine | **Custom (LangGraph-inspired)** | LangGraph.js | No external dep, tailored to xClaw workflow builder |
| MCP | **@modelcontextprotocol/sdk** | Custom implementation | Official SDK, protocol compliance |
| Monorepo | **npm workspaces** | Turborepo, Nx, pnpm | Already proven in v0.2, simple, no extra tooling |
| Frontend | **React 19 + Vite 6** | Next.js, SvelteKit | Already built, Vite fast, no SSR needed |
| State Management | **Zustand** | Redux, Jotai, Recoil | Simple, lightweight, already in v0.2 |

### 22.2 Key Dependencies

```json
{
  "core": {
    "openai": "^4.x",
    "@anthropic-ai/sdk": "^1.x",
    "@google/generative-ai": "^1.x",
    "@modelcontextprotocol/sdk": "^1.x",
    "zod": "^3.x"
  },
  "db": {
    "drizzle-orm": "^0.38.x",
    "postgres": "^3.x",
    "ioredis": "^5.x"
  },
  "gateway": {
    "hono": "^4.x",
    "ws": "^8.x",
    "jose": "^5.x"
  },
  "web": {
    "react": "^19.x",
    "@xyflow/react": "^12.x",
    "zustand": "^5.x",
    "tailwindcss": "^4.x",
    "vite": "^6.x"
  },
  "channels": {
    "grammy": "^1.x",
    "discord.js": "^14.x"
  }
}
```

---

## Appendix A: Environment Variables

```ini
# ── Server ──
GATEWAY_PORT=18789
GATEWAY_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# ── Database ──
DATABASE_URL=postgresql://xclaw:xclaw@localhost:5432/xclaw
REDIS_URL=redis://localhost:6379

# ── LLM Providers ──
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OLLAMA_URL=http://localhost:11434

# ── Auth ──
JWT_SECRET=your-256-bit-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
ENCRYPTION_KEY=your-aes-256-key

# ── Agent ──
AGENT_PERSONA=You are xClaw, a helpful AI assistant.
MAX_TOOL_ITERATIONS=10
TOOL_TIMEOUT=30000
MEMORY_ENABLED=true
MAX_HISTORY=20

# ── Channels (optional) ──
TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=

# ── MCP (optional) ──
GITHUB_TOKEN=
```

---

## Appendix B: API Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "path": "message", "message": "Required" }
    ]
  }
}
```

| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body/params invalid |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `LLM_ERROR` | 502 | LLM provider error |
| `TOOL_TIMEOUT` | 504 | Tool execution timeout |

---

*END OF DOCUMENT*
