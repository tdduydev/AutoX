# Architecture Design Document (ADD)

## xClaw v2.1 — Open AI Agent Platform (Multi-Industry + Multi-Integration)

**Version:** 2.1.0  
**Date:** 2026-03-18  
**Author:** xClaw Team / xDev.asia  
**Status:** Draft  
**Inspired by:** OpenClaw, n8n, Zapier, Mastra, Vercel AI SDK  

---

## Mục lục

1. [Tầm nhìn & Triết lý](#1-tầm-nhìn--triết-lý)
2. [So sánh v2.0 → v2.1](#2-so-sánh-v20--v21)
3. [Architecture Overview](#3-architecture-overview)
4. [Integration Layer (★ MỚI)](#4-integration-layer--mới)
5. [Domain Packs — Skills theo ngành](#5-domain-packs--skills-theo-ngành)
6. [Channel Architecture (Nâng cấp)](#6-channel-architecture-nâng-cấp)
7. [Package Structure v2.1](#7-package-structure-v21)
8. [Integration Registry & OAuth](#8-integration-registry--oauth)
9. [Webhook Engine](#9-webhook-engine)
10. [Agent Marketplace Vision](#10-agent-marketplace-vision)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Tầm nhìn & Triết lý

### 1.1 Tầm nhìn

xClaw v2.0 ban đầu có focus vào y tế (medical assistant). Từ v2.1:

> **xClaw = Open-source AI Agent Platform kết nối mọi thứ.**  
> Medical chỉ là 1 domain pack nhỏ. Platform hỗ trợ mọi ngành, mọi use case.

Tương tự OpenClaw/n8n nhưng **AI-native**:

- **n8n/Zapier** = No-code automation (connect apps)
- **xClaw** = AI Agent + Automation + Integrations (AI hiểu context, tự chọn tool, tự kết nối)

### 1.2 Mô hình 3 lớp

```
┌──────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                            │
│   Web UI · CLI · Telegram Bot · Discord Bot · API             │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    AI AGENT BRAIN                              │
│   Multi-Agent · LLM Router · Memory · RAG · Graph Engine      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│               INTEGRATIONS + DOMAIN PACKS                     │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Messaging   │  │ Productivity│  │  Developer  │          │
│  │             │  │             │  │             │          │
│  │ • Telegram  │  │ • Gmail     │  │ • GitHub    │          │
│  │ • iMessage  │  │ • Calendar  │  │ • GitLab    │          │
│  │ • WhatsApp  │  │ • Notion    │  │ • Shell     │          │
│  │ • Zalo      │  │ • Sheets    │  │ • Docker    │          │
│  │ • Messenger │  │ • Drive     │  │ • CI/CD     │          │
│  │ • Slack     │  │ • Trello    │  │ • AWS/GCP   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Healthcare  │  │  Finance    │  │  E-Commerce │          │
│  │             │  │             │  │             │          │
│  │ • ICD-10    │  │ • Banking   │  │ • Shopify   │          │
│  │ • Drug DB   │  │ • Crypto    │  │ • WooCommerce│         │
│  │ • FHIR      │  │ • Stocks    │  │ • Inventory │          │
│  │ • HL7       │  │ • Invoicing │  │ • Payments  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Marketing  │  │  Education  │  │    IoT      │          │
│  │             │  │             │  │             │          │
│  │ • Social    │  │ • LMS       │  │ • Smart Home│          │
│  │ • SEO       │  │ • Quiz Gen  │  │ • Sensors   │          │
│  │ • Analytics │  │ • Grading   │  │ • Automation│          │
│  │ • Email Mkt │  │ • Tutoring  │  │ • Monitoring│          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Nguyên tắc bổ sung (thêm vào v2.0)

| # | Nguyên tắc | Giải thích |
|---|---|---|
| 9 | **Integration-rich** | Platform mạnh nhờ số lượng + chất lượng integrations. Dễ thêm mới |
| 10 | **Domain-agnostic core** | Core engine không biết domain nào. Skills/Integrations mang nghiệp vụ |
| 11 | **OAuth-aware** | Hỗ trợ OAuth 2.0 flows cho mọi third-party service |
| 12 | **Webhook-native** | Nhận events từ bên ngoài (GitHub push, Gmail new email, Shopify order) |
| 13 | **Community-first** | Mọi integration có thể do community đóng góp, publish lên Hub |

---

## 2. So sánh v2.0 → v2.1

| Khía cạnh | v2.0 | v2.1 |
|---|---|---|
| **Focus** | AI Agent Platform (lệch medical) | **General-purpose AI Platform** (mọi ngành) |
| **Medical** | Core use case | **1 domain pack** trong nhiều domain packs |
| **Integrations** | 2 channels (Telegram, Discord) | **30+ integrations** qua Integration Layer |
| **Skills** | 12 skill categories (flat) | **Domain Packs** (hierarchical, per-industry) |
| **External APIs** | Chỉ LLM APIs | **Gmail, Calendar, iMessage, Shopify, GitHub, ...** |
| **OAuth** | Không có | **OAuth 2.0 flow với token refresh** |
| **Webhooks** | Chỉ workflow trigger | **Webhook Engine** (nhận events, route to agent) |
| **System prompt** | Hardcoded Vietnamese medical | **Dynamic per-agent, per-domain** |
| **Knowledge packs** | icd10, vn-drug (medical only) | **Multi-domain knowledge packs** |

---

## 3. Architecture Overview

### 3.1 High-Level Architecture v2.1

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                      │
│                                                                          │
│  ┌─────────┐ ┌─────┐ ┌──────────┐ ┌─────────┐ ┌──────┐ ┌───────┐     │
│  │ Web UI  │ │ CLI │ │ Telegram │ │ Discord │ │ REST │ │  MCP  │     │
│  │(React19)│ │     │ │   Bot    │ │   Bot   │ │ API  │ │Client │     │
│  └────┬────┘ └──┬──┘ └────┬─────┘ └────┬────┘ └──┬───┘ └──┬────┘     │
└───────┼─────────┼─────────┼────────────┼─────────┼────────┼──────────┘
        │         │         │            │         │        │
        ▼         ▼         ▼            ▼         ▼        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       GATEWAY LAYER (Hono)                                │
│                                                                          │
│  ┌──────────┐ ┌───────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐     │
│  │ REST API │ │ WebSocket │ │   SSE   │ │MCP Server │ │  Auth   │     │
│  └──────────┘ └───────────┘ └─────────┘ └───────────┘ └─────────┘     │
│  ┌──────────────┐ ┌───────────────┐ ┌─────────────────────────────┐    │
│  │ Webhook      │ │ OAuth Callback│ │ Integration Router          │    │
│  │ Receiver ★   │ │ Handler ★     │ │ (route to integration) ★    │    │
│  └──────────────┘ └───────────────┘ └─────────────────────────────┘    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    Agent Coordinator                                 ││
│  │                                                                     ││
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐                    ││
│  │   │  Router  │    │ Planner  │    │ Executor │                    ││
│  │   │  Agent   │───▶│  Agent   │───▶│  Agent   │                    ││
│  │   └──────────┘    └──────────┘    └──────────┘                    ││
│  │                                                                     ││
│  │   Agent Registry (specialist pool):                                 ││
│  │   healthcare · code · research · finance · marketing · ecommerce   ││
│  │   education · devops · sales · legal · hr · custom                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────┐ │
│  │ Graph Engine       │  │ Workflow Registry  │  │ Webhook Engine ★    │ │
│  │ (Stateful DAG)     │  │ (triggers, cron)   │  │ (inbound events)   │ │
│  └───────────────────┘  └───────────────────┘  └─────────────────────┘ │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          CORE ENGINE                                      │
│  (Giữ nguyên từ v2.0: LLM Router, Memory, Tools, Streaming, Tracing)    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   ★ INTEGRATION LAYER (MỚI)                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  Integration Registry                             │   │
│  │                                                                   │   │
│  │  register() · connect() · disconnect() · execute() · listAll()   │   │
│  └──────────────────┬───────────────────────────────────────────────┘   │
│                     │                                                    │
│    ┌────────────────┼─────────────────┬──────────────────┐              │
│    │                │                 │                   │              │
│    ▼                ▼                 ▼                   ▼              │
│  ┌────────┐  ┌───────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │Messaging│  │Productivity│  │  Developer   │  │  Commerce     │       │
│  │         │  │            │  │              │  │               │       │
│  │Telegram │  │ Gmail      │  │ GitHub       │  │ Shopify       │       │
│  │iMessage │  │ GCalendar  │  │ GitLab       │  │ Stripe        │       │
│  │WhatsApp │  │ G.Sheets   │  │ Jira         │  │ WooCommerce   │       │
│  │Zalo     │  │ G.Drive    │  │ Linear       │  │ PayPal        │       │
│  │Slack    │  │ Notion     │  │ Bitbucket    │  │               │       │
│  │Messenger│  │ Trello     │  │ Vercel       │  │               │       │
│  │Line     │  │ Airtable   │  │ AWS          │  │               │       │
│  │Viber    │  │ Todoist    │  │ Docker       │  │               │       │
│  └────────┘  └───────────┘  └──────────────┘  └───────────────┘       │
│                                                                          │
│  ┌────────┐  ┌───────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │Social  │  │ Analytics │  │  AI / Data   │  │  Healthcare   │       │
│  │        │  │           │  │              │  │               │       │
│  │Twitter │  │ GA4       │  │ HuggingFace  │  │ FHIR          │       │
│  │Facebook│  │ Mixpanel  │  │ Replicate    │  │ HL7           │       │
│  │Insta   │  │ PostHog   │  │ Pinecone     │  │ OpenFDA       │       │
│  │TikTok  │  │ Plausible │  │ Weaviate     │  │ PubMed        │       │
│  │YouTube │  │ Amplitude │  │ Browserless  │  │ DrugBank      │       │
│  │LinkedIn│  │ Sentry    │  │ Firecrawl    │  │               │       │
│  └────────┘  └───────────┘  └──────────────┘  └───────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   DOMAIN PACKS (Skills theo ngành) ★                      │
│                                                                          │
│  Mỗi domain pack = collection of tools + system prompts + knowledge      │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Healthcare│ │ Finance  │ │E-Commerce│ │Marketing │ │Education │     │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤     │
│  │symptom   │ │portfolio │ │inventory │ │seo_audit │ │quiz_gen  │     │
│  │drug_check│ │invoice   │ │orders    │ │social    │ │grading   │     │
│  │icd_lookup│ │tax_calc  │ │pricing   │ │email_mkt │ │tutoring  │     │
│  │clinical  │ │budget    │ │shipping  │ │analytics │ │flashcard │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Developer │ │  DevOps  │ │ Research │ │  Legal   │ │   HR     │     │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤     │
│  │code_gen  │ │deploy    │ │web_search│ │contract  │ │resume    │     │
│  │git_ops   │ │monitor   │ │paper     │ │compliance│ │interview │     │
│  │test_gen  │ │ci_cd     │ │summarize │ │nda_gen   │ │onboarding│     │
│  │refactor  │ │infra     │ │citation  │ │gdpr      │ │payroll   │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Phân biệt Channel vs Integration

| | **Channel** | **Integration** |
|---|---|---|
| **Mục đích** | Giao tiếp 2 chiều với user | Kết nối API bên ngoài để agent thao tác |
| **Ví dụ** | Telegram Bot, Discord Bot, Web Chat | Gmail API, Google Calendar, GitHub API |
| **Workflow** | User ↔ Agent qua channel | Agent gọi API để thực hiện hành động |
| **Package** | `@xclaw/channel-*` | `@xclaw/integration-*` |
| **Trigger** | User gửi message | Agent quyết định hoặc webhook event |
| **Auth** | Bot token | OAuth 2.0 hoặc API key |

**Ví dụ use case:**

- User gửi tin nhắn trên **Telegram** (channel) → Agent đọc email từ **Gmail** (integration) → Agent tạo event trên **Google Calendar** (integration) → Agent reply trên **Telegram** (channel)
- User nói "Khi có email mới từ boss, forward lên Slack" → **Gmail webhook** trigger → Agent xử lý → **Slack integration** post message

---

## 4. Integration Layer (★ MỚI)

### 4.1 Integration Definition

```typescript
// packages/integrations/src/base/integration.ts

interface IntegrationDefinition {
  id: string;                          // 'gmail', 'google-calendar', 'github'
  name: string;                        // 'Gmail'
  description: string;                 // 'Send, read, and manage emails'
  icon: string;                        // URL or emoji
  category: IntegrationCategory;       // 'messaging' | 'productivity' | ...
  
  // Authentication
  auth: IntegrationAuth;               // OAuth2, API Key, Basic, None
  
  // Actions this integration can perform (= Tools cho Agent)
  actions: IntegrationAction[];
  
  // Triggers this integration can emit (= Webhook events)
  triggers?: IntegrationTrigger[];
  
  // Lifecycle
  onConnect?: (credentials: Credentials) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  healthCheck?: () => Promise<boolean>;
}

type IntegrationCategory = 
  | 'messaging'        // Telegram, WhatsApp, iMessage, Slack, Zalo
  | 'email'            // Gmail, Outlook, SendGrid
  | 'productivity'     // Google Calendar, Notion, Trello, Todoist
  | 'storage'          // Google Drive, Dropbox, S3
  | 'developer'        // GitHub, GitLab, Jira, Linear
  | 'social'           // Twitter/X, Facebook, Instagram, LinkedIn, TikTok
  | 'commerce'         // Shopify, Stripe, PayPal, WooCommerce
  | 'analytics'        // Google Analytics, Mixpanel, PostHog
  | 'ai'              // HuggingFace, Replicate, Pinecone
  | 'healthcare'       // FHIR, HL7, OpenFDA, PubMed
  | 'finance'          // Banking APIs, Crypto, Stock APIs
  | 'communication'    // Twilio (SMS/Voice), SendGrid
  | 'crm'             // HubSpot, Salesforce, Pipedrive
  | 'cloud'           // AWS, GCP, Azure, Vercel, Cloudflare
  | 'other';
```

### 4.2 Integration Auth

```typescript
type IntegrationAuth = 
  | { type: 'none' }
  | { type: 'api-key';  fields: AuthField[] }
  | { type: 'basic';    fields: AuthField[] }
  | { type: 'bearer';   fields: AuthField[] }
  | { type: 'oauth2';   config: OAuth2Config };

interface OAuth2Config {
  authorizationUrl: string;            // 'https://accounts.google.com/o/oauth2/v2/auth'
  tokenUrl: string;                    // 'https://oauth2.googleapis.com/token'
  scopes: string[];                    // ['gmail.readonly', 'gmail.send']
  clientIdEnv: string;                 // env var name: 'GOOGLE_CLIENT_ID'
  clientSecretEnv: string;             // env var name: 'GOOGLE_CLIENT_SECRET'
  refreshable: boolean;                // Auto-refresh token khi hết hạn
}

interface AuthField {
  key: string;                         // 'apiKey'
  label: string;                       // 'API Key'
  type: 'string' | 'secret';
  required: boolean;
  envVar?: string;                     // Load from env: 'GITHUB_TOKEN'
}
```

### 4.3 Integration Action (= Agent Tool)

```typescript
interface IntegrationAction {
  name: string;                        // 'gmail_send_email'
  description: string;                 // 'Send an email via Gmail'
  parameters: ZodSchema;               // Zod schema
  execute: (args: unknown, ctx: IntegrationContext) => Promise<ActionResult>;
  
  riskLevel?: 'safe' | 'moderate' | 'dangerous';
  requiresApproval?: boolean;
}

// Khi integration được kích hoạt, tất cả actions tự động đăng ký 
// vào ToolRegistry với prefix: integration_{id}_{action_name}
// Ví dụ: "integration_gmail_send_email", "integration_github_create_issue"
```

### 4.4 Integration Trigger (= Webhook Event)

```typescript
interface IntegrationTrigger {
  name: string;                        // 'gmail_new_email'
  description: string;                 // 'Fires when a new email arrives'
  
  // Webhook setup
  subscribe?: (webhookUrl: string) => Promise<void>;     // Register webhook
  unsubscribe?: (webhookUrl: string) => Promise<void>;   // Cleanup
  
  // Alternatively: poll-based trigger
  poll?: (lastPollTime: Date) => Promise<TriggerEvent[]>;
  pollInterval?: number;               // ms, default 60000
  
  // Event schema
  eventSchema: ZodSchema;             // Shape of the trigger event data
}

// Triggers feed into Workflow Graph Engine as trigger nodes
// Ví dụ: Gmail new email → trigger workflow → AI xử lý → reply
```

### 4.5 Ví dụ: Gmail Integration

```typescript
// packages/integrations/src/email/gmail.ts

import { defineIntegration } from '../base/define-integration';
import { z } from 'zod';

export const gmailIntegration = defineIntegration({
  id: 'gmail',
  name: 'Gmail',
  description: 'Read, send, and manage emails with Gmail',
  icon: '📧',
  category: 'email',
  
  auth: {
    type: 'oauth2',
    config: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      refreshable: true,
    },
  },
  
  actions: [
    {
      name: 'send_email',
      description: 'Send an email via Gmail',
      parameters: z.object({
        to: z.string().email().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body (HTML or plain text)'),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
      }),
      riskLevel: 'moderate',
      requiresApproval: true,
      execute: async (args, ctx) => {
        const gmail = ctx.getClient();  // Pre-authenticated Google API client
        // ... send email logic
      },
    },
    {
      name: 'read_emails',
      description: 'Read recent emails from Gmail inbox',
      parameters: z.object({
        query: z.string().optional().describe('Gmail search query (e.g., "from:boss is:unread")'),
        maxResults: z.number().default(10),
        labelIds: z.array(z.string()).optional(),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        // ... read emails logic
      },
    },
    {
      name: 'create_draft',
      description: 'Create a draft email',
      parameters: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        // ... create draft logic
      },
    },
  ],
  
  triggers: [
    {
      name: 'new_email',
      description: 'Fires when a new email arrives',
      poll: async (lastPollTime) => {
        // Gmail push notifications hoặc polling
        // ... check for new emails since lastPollTime
      },
      pollInterval: 30000,  // 30 seconds
      eventSchema: z.object({
        messageId: z.string(),
        from: z.string(),
        subject: z.string(),
        snippet: z.string(),
        receivedAt: z.string(),
      }),
    },
  ],
});
```

### 4.6 Ví dụ: Apple iMessage Integration

```typescript
// packages/integrations/src/messaging/imessage.ts

export const imessageIntegration = defineIntegration({
  id: 'imessage',
  name: 'Apple iMessage',
  description: 'Send and read iMessages (macOS only, via AppleScript)',
  icon: '💬',
  category: 'messaging',
  
  auth: { type: 'none' },  // Chạy local trên macOS, dùng AppleScript
  
  actions: [
    {
      name: 'send_message',
      description: 'Send an iMessage to a contact',
      parameters: z.object({
        to: z.string().describe('Phone number or Apple ID'),
        message: z.string().describe('Message content'),
      }),
      riskLevel: 'moderate',
      requiresApproval: true,
      execute: async (args, ctx) => {
        // Chạy AppleScript:
        // tell application "Messages"
        //   send "{message}" to buddy "{to}" of service "iMessage"
        // end tell
      },
    },
    {
      name: 'read_recent_messages',
      description: 'Read recent iMessages from a contact',
      parameters: z.object({
        from: z.string().optional().describe('Filter by sender'),
        limit: z.number().default(20),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        // Read from ~/Library/Messages/chat.db (SQLite)
        // hoặc AppleScript
      },
    },
  ],
  
  healthCheck: async () => {
    // Check macOS + Messages.app available
    return process.platform === 'darwin';
  },
});
```

### 4.7 Danh sách Integrations (Roadmap)

#### Phase 1 — Core (v2.1.0)

| Category | Integration | Auth | Ưu tiên |
|---|---|---|---|
| **Email** | Gmail | OAuth2 | ★★★ |
| **Email** | Outlook / Microsoft 365 | OAuth2 | ★★ |
| **Messaging** | Telegram (API, không phải bot) | API Key | ★★★ |
| **Messaging** | Slack | OAuth2 | ★★★ |
| **Messaging** | Apple iMessage | None (macOS) | ★★ |
| **Messaging** | Zalo | OAuth2 | ★★ (VN market) |
| **Productivity** | Google Calendar | OAuth2 | ★★★ |
| **Productivity** | Google Sheets | OAuth2 | ★★ |
| **Productivity** | Google Drive | OAuth2 | ★★ |
| **Productivity** | Notion | API Key / OAuth2 | ★★★ |
| **Developer** | GitHub | OAuth2 / Token | ★★★ |
| **Developer** | Shell / Local System | None | ★★★ |
| **Search** | Brave Search | API Key | ★★★ |
| **Search** | Firecrawl (Web Scraper) | API Key | ★★ |

#### Phase 2 — Extended (v2.2.0)

| Category | Integration | Auth |
|---|---|---|
| **Messaging** | WhatsApp Business | OAuth2 |
| **Messaging** | Facebook Messenger | OAuth2 |
| **Messaging** | Discord (API) | Bot Token |
| **Messaging** | Line | OAuth2 |
| **Social** | Twitter/X | OAuth2 |
| **Social** | Facebook Pages | OAuth2 |
| **Social** | Instagram | OAuth2 |
| **Social** | LinkedIn | OAuth2 |
| **Social** | YouTube | OAuth2 |
| **Productivity** | Trello | API Key |
| **Productivity** | Todoist | API Key |
| **Productivity** | Airtable | API Key |
| **Developer** | GitLab | OAuth2 |
| **Developer** | Jira | OAuth2 |
| **Developer** | Linear | API Key |
| **Commerce** | Shopify | OAuth2 |
| **Commerce** | Stripe | API Key |
| **Analytics** | Google Analytics 4 | OAuth2 |
| **Analytics** | PostHog | API Key |
| **CRM** | HubSpot | OAuth2 |
| **Communication** | Twilio (SMS/Voice) | API Key |
| **Communication** | SendGrid | API Key |

#### Phase 3 — Industry-specific (v2.3.0)

| Category | Integration |
|---|---|
| **Healthcare** | FHIR R4 API, OpenFDA, PubMed, DrugBank |
| **Finance** | Plaid (Banking), CoinGecko (Crypto), Alpha Vantage (Stocks) |
| **Cloud** | AWS SDK, GCP, Azure, Vercel, Cloudflare Workers |
| **IoT** | Home Assistant, MQTT |
| **Education** | Canvas LMS, Google Classroom |

---

## 5. Domain Packs — Skills theo ngành

### 5.1 Khái niệm

Domain Pack = **Collection of skills + system prompts + knowledge data cho 1 ngành cụ thể**.

Khác với v2.0 "12 flat skills":

- Mỗi domain có **chuyên gia riêng** (specialist agent)
- Mỗi domain có **knowledge data riêng** (knowledge pack)
- Domain packs có thể **depend on integrations** (ví dụ: healthcare pack dùng FHIR integration)

### 5.2 Domain Pack Structure

```typescript
// packages/domains/src/base/domain-pack.ts

interface DomainPack {
  id: string;                          // 'healthcare'
  name: string;                        // 'Healthcare & Medical'
  description: string;
  icon: string;                        // '🏥'
  
  // Skills trong domain này
  skills: SkillManifest[];
  
  // System prompt for specialist agent
  agentPersona: string;
  
  // Integrations mà domain này thường dùng
  recommendedIntegrations: string[];   // ['fhir', 'openfda', 'pubmed']
  
  // Knowledge packs (optional)
  knowledgePacks?: string[];           // ['icd10-drug-interactions', 'vn-drug-formulary']
}
```

### 5.3 Domain Pack Registry

```
packages/domains/
├── src/
│   ├── index.ts                      # Export all domain packs
│   ├── base/
│   │   └── domain-pack.ts            # DomainPack interface + helpers
│   │
│   ├── healthcare/                   # 🏥 Healthcare & Medical
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── symptom-checker.ts
│   │   │   ├── drug-interaction.ts
│   │   │   ├── clinical-decision.ts
│   │   │   ├── icd-lookup.ts
│   │   │   └── patient-notes.ts
│   │   ├── persona.ts               # System prompt for healthcare agent
│   │   └── knowledge/               # Embedded knowledge (or references)
│   │       ├── icd10-common.json
│   │       └── drug-interactions.json
│   │
│   ├── developer/                    # 💻 Software Development
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── code-generator.ts
│   │   │   ├── git-operations.ts
│   │   │   ├── shell-executor.ts
│   │   │   ├── test-generator.ts
│   │   │   ├── code-reviewer.ts
│   │   │   └── file-manager.ts
│   │   └── persona.ts
│   │
│   ├── finance/                      # 💰 Finance & Accounting
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── budget-tracker.ts
│   │   │   ├── invoice-generator.ts
│   │   │   ├── tax-calculator.ts
│   │   │   ├── portfolio-analyzer.ts
│   │   │   └── expense-report.ts
│   │   └── persona.ts
│   │
│   ├── ecommerce/                    # 🛒 E-Commerce
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── inventory-manager.ts
│   │   │   ├── order-processor.ts
│   │   │   ├── pricing-optimizer.ts
│   │   │   ├── product-writer.ts
│   │   │   └── customer-support.ts
│   │   └── persona.ts
│   │
│   ├── marketing/                    # 📣 Marketing & Growth
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── seo-analyzer.ts
│   │   │   ├── social-scheduler.ts
│   │   │   ├── email-campaign.ts
│   │   │   ├── content-writer.ts
│   │   │   └── analytics-reporter.ts
│   │   └── persona.ts
│   │
│   ├── education/                    # 📚 Education & Learning
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── quiz-generator.ts
│   │   │   ├── flashcard-maker.ts
│   │   │   ├── lesson-planner.ts
│   │   │   ├── grading-assistant.ts
│   │   │   └── tutoring.ts
│   │   └── persona.ts
│   │
│   ├── research/                     # 🔬 Research & Analysis
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── web-researcher.ts
│   │   │   ├── paper-summarizer.ts
│   │   │   ├── data-analyzer.ts
│   │   │   ├── citation-manager.ts
│   │   │   └── report-generator.ts
│   │   └── persona.ts
│   │
│   ├── devops/                       # 🔧 DevOps & Infrastructure
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── deployment.ts
│   │   │   ├── monitoring.ts
│   │   │   ├── ci-cd.ts
│   │   │   ├── docker-manager.ts
│   │   │   └── infra-as-code.ts
│   │   └── persona.ts
│   │
│   ├── legal/                        # ⚖️ Legal & Compliance
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── contract-analyzer.ts
│   │   │   ├── compliance-checker.ts
│   │   │   ├── nda-generator.ts
│   │   │   └── gdpr-advisor.ts
│   │   └── persona.ts
│   │
│   ├── hr/                           # 👥 Human Resources
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── resume-reviewer.ts
│   │   │   ├── interview-prep.ts
│   │   │   ├── onboarding.ts
│   │   │   └── payroll.ts
│   │   └── persona.ts
│   │
│   ├── sales/                        # 📈 Sales & CRM
│   │   ├── index.ts
│   │   ├── skills/
│   │   │   ├── lead-scoring.ts
│   │   │   ├── proposal-writer.ts
│   │   │   ├── pipeline-manager.ts
│   │   │   └── contract-negotiator.ts
│   │   └── persona.ts
│   │
│   └── general/                      # 🤖 General Assistant (no domain)
│       ├── index.ts
│       ├── skills/
│       │   ├── web-search.ts
│       │   ├── calculator.ts
│       │   ├── translator.ts
│       │   ├── summarizer.ts
│       │   └── image-generator.ts
│       └── persona.ts
```

### 5.4 Tương tác Domain Pack ↔ Integration

```
┌──────────────────────────────────────────────────────────────┐
│                    Healthcare Domain Pack                      │
│                                                               │
│  Skills: symptom_checker, drug_interaction, icd_lookup, ...   │
│  Persona: "You are a medical AI assistant..."                 │
│                                                               │
│  Recommended Integrations:                                    │
│    ├── fhir (FHIR R4 API) → read patient records              │
│    ├── openfda (Drug database) → lookup drug info             │
│    ├── pubmed (Research) → search medical papers              │
│    └── gmail (Email) → send reports to doctors                │
│                                                               │
│  Knowledge Packs:                                             │
│    ├── icd10-drug-interactions                                │
│    └── vn-drug-formulary                                      │
└──────────────────────────────────────────────────────────────┘

User: "Bệnh nhân dùng Metformin + Aspirin có sao không?"
  │
  └─▶ Healthcare Agent activated
       │
       ├─ drug_interaction skill → check local knowledge pack
       ├─ integration_openfda_search → query FDA database
       ├─ integration_pubmed_search → find relevant papers
       └─ Response: "Không có tương tác nghiêm trọng, nhưng..."
```

---

## 6. Channel Architecture (Nâng cấp)

### 6.1 Channel = Bidirectional Messaging Interface

Channels giữ nguyên khái niệm v2.0 nhưng thêm advanced features:

```typescript
interface ChannelPlugin {
  readonly id: string;
  readonly name: string;
  readonly platform: 'telegram' | 'discord' | 'slack' | 'web' | 'cli';
  
  start(config: ChannelConfig): Promise<void>;
  stop(): Promise<void>;
  
  onMessage(handler: MessageHandler): void;
  send(target: string, message: OutgoingMessage): Promise<void>;
  
  // ★ NEW: Rich features
  sendRichMessage?(target: string, message: RichMessage): Promise<void>;
  
  // ★ NEW: File upload support
  sendFile?(target: string, file: Buffer, filename: string): Promise<void>;
  
  // ★ NEW: Inline buttons/actions
  sendInteractive?(target: string, message: InteractiveMessage): Promise<void>;
}

// Ngoài 2 channel cũ (Telegram Bot, Discord Bot), v2.1 thêm:
// - Slack Bot
// - WhatsApp Business Bot  
// - Web Widget (embeddable)
```

### 6.2 Channel vs Integration cho cùng 1 platform

| Platform | As Channel (Bot) | As Integration (API) |
|---|---|---|
| **Telegram** | User ↔ Bot conversation | Agent gọi Telegram API (send to group, read history) |
| **Discord** | User ↔ Bot conversation | Agent manage server, roles, channels |
| **Slack** | User ↔ Bot conversation | Agent post to channels, read messages, manage |
| **Gmail** | ❌ (không phải chat) | Agent đọc/gửi email |
| **iMessage** | ❌ (không phải bot) | Agent gửi/đọc iMessage via AppleScript |

---

## 7. Package Structure v2.1

```
xclaw/
├── packages/
│   ├── shared/                     # @xclaw/shared — Foundation (giữ nguyên)
│   ├── db/                         # @xclaw/db — Database (giữ nguyên + thêm tables)
│   ├── core/                       # @xclaw/core — Engine (giữ nguyên)
│   │
│   ├── integrations/               # ★ NEW: @xclaw/integrations
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts            # Export all integrations
│   │       ├── base/
│   │       │   ├── integration.ts  # IntegrationDefinition interface
│   │       │   ├── define-integration.ts  # defineIntegration() helper
│   │       │   ├── registry.ts     # IntegrationRegistry class
│   │       │   └── oauth.ts        # OAuth 2.0 flow helper
│   │       ├── email/
│   │       │   ├── gmail.ts
│   │       │   └── outlook.ts
│   │       ├── messaging/
│   │       │   ├── telegram-api.ts # Telegram API (not bot)
│   │       │   ├── slack-api.ts
│   │       │   ├── imessage.ts
│   │       │   ├── zalo.ts
│   │       │   └── whatsapp.ts
│   │       ├── productivity/
│   │       │   ├── google-calendar.ts
│   │       │   ├── google-sheets.ts
│   │       │   ├── google-drive.ts
│   │       │   ├── notion.ts
│   │       │   └── trello.ts
│   │       ├── developer/
│   │       │   ├── github.ts
│   │       │   ├── gitlab.ts
│   │       │   └── jira.ts
│   │       ├── social/
│   │       │   ├── twitter.ts
│   │       │   ├── facebook.ts
│   │       │   └── youtube.ts
│   │       ├── commerce/
│   │       │   ├── shopify.ts
│   │       │   └── stripe.ts
│   │       ├── analytics/
│   │       │   ├── google-analytics.ts
│   │       │   └── posthog.ts
│   │       ├── search/
│   │       │   ├── brave-search.ts
│   │       │   └── firecrawl.ts
│   │       ├── healthcare/
│   │       │   ├── fhir.ts
│   │       │   ├── openfda.ts
│   │       │   └── pubmed.ts
│   │       └── communication/
│   │           ├── twilio.ts
│   │           └── sendgrid.ts
│   │
│   ├── domains/                    # ★ RENAMED from skills: @xclaw/domains
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── base/
│   │       │   └── domain-pack.ts
│   │       ├── healthcare/
│   │       ├── developer/
│   │       ├── finance/
│   │       ├── ecommerce/
│   │       ├── marketing/
│   │       ├── education/
│   │       ├── research/
│   │       ├── devops/
│   │       ├── legal/
│   │       ├── hr/
│   │       ├── sales/
│   │       └── general/
│   │
│   ├── skill-hub/                  # @xclaw/skill-hub (giữ nguyên)
│   ├── gateway/                    # @xclaw/gateway (thêm routes)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── integrations.ts # ★ NEW: /api/integrations/*
│   │       │   ├── oauth.ts        # ★ NEW: /api/oauth/callback
│   │       │   ├── webhooks.ts     # ★ NEW: /api/webhooks/*
│   │       │   └── domains.ts      # ★ NEW: /api/domains/*
│   │       └── ...
│   │
│   ├── server/                     # @xclaw/server
│   ├── cli/                        # @xclaw/cli
│   ├── channels/                   # @xclaw/channel-* (giữ nguyên + thêm)
│   │   ├── telegram/
│   │   ├── discord/
│   │   ├── slack/                  # ★ NEW
│   │   └── whatsapp/               # ★ NEW
│   │
│   ├── knowledge-packs/            # Giữ nguyên, thêm multi-domain
│   │   ├── icd10-drug-interactions/
│   │   ├── vn-drug-formulary/
│   │   ├── tax-vietnam/            # ★ NEW
│   │   └── legal-templates/        # ★ NEW
│   │
│   └── web/                        # @xclaw/web (thêm pages)
│       └── src/
│           ├── components/
│           │   ├── integrations/   # ★ NEW: Integration management UI
│           │   ├── domains/        # ★ NEW: Domain pack browser
│           │   └── ...
│           └── pages/
│               ├── IntegrationsPage.tsx  # ★ NEW
│               └── ...
│
├── docker-compose.yml
├── Dockerfile
└── package.json                    # Thêm packages/integrations, packages/domains
```

---

## 8. Integration Registry & OAuth

### 8.1 Integration Registry

```typescript
// packages/integrations/src/base/registry.ts

class IntegrationRegistry {
  private integrations: Map<string, IntegrationDefinition>;
  private connections: Map<string, IntegrationConnection>;
  
  // Register integration definition
  register(integration: IntegrationDefinition): void;
  
  // Connect to integration (authenticate)
  async connect(integrationId: string, credentials: Credentials): Promise<void>;
  
  // Disconnect
  async disconnect(integrationId: string): Promise<void>;
  
  // Get connection status
  getStatus(integrationId: string): 'connected' | 'disconnected' | 'error';
  
  // List all registered integrations
  listAll(): IntegrationDefinition[];
  
  // List connected integrations only
  listConnected(): IntegrationConnection[];
  
  // Get integration actions as ToolDefinitions (for Agent)
  getTools(integrationId: string): ToolDefinition[];
  
  // Bridge tất cả integration actions vào Agent ToolRegistry
  bridgeToToolRegistry(toolRegistry: ToolRegistry): void;
}

// Flow khi user kích hoạt 1 integration:
// 1. User chọn "Gmail" trên UI
// 2. Nếu OAuth2: redirect user tới Google consent → callback → save tokens
// 3. Nếu API Key: user nhập key → validate → save encrypted
// 4. Integration actions tự động thêm vào Agent's ToolRegistry
// 5. Agent giờ có thể gọi "integration_gmail_send_email" trong chat
```

### 8.2 OAuth 2.0 Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Web UI  │     │ Gateway  │     │   OAuth      │     │ Google/GitHub │
│          │     │          │     │   Handler    │     │ Auth Server  │
└─────┬────┘     └─────┬────┘     └──────┬───────┘     └──────┬───────┘
      │                │                 │                     │
      │ Click "Connect │                 │                     │
      │  Gmail"        │                 │                     │
      │───────────────▶│                 │                     │
      │                │ GET /api/oauth/ │                     │
      │                │ gmail/authorize │                     │
      │                │────────────────▶│                     │
      │                │                 │  Redirect URL       │
      │◀───────────────│◀────────────────│                     │
      │  Redirect to   │                 │                     │
      │  Google consent│                 │                     │
      │─────────────────────────────────────────────────────▶│
      │                │                 │                     │
      │                │                 │    User consents     │
      │◀─────────────────────────────────│◀────────────────────│
      │  Callback with │                 │    ?code=abc123     │
      │  auth code     │                 │                     │
      │───────────────▶│ GET /api/oauth/ │                     │
      │                │ callback?code=  │                     │
      │                │────────────────▶│                     │
      │                │                 │ Exchange code for    │
      │                │                 │ access + refresh     │
      │                │                 │────────────────────▶│
      │                │                 │◀────────────────────│
      │                │                 │ Save encrypted tokens│
      │                │                 │ to PostgreSQL        │
      │                │◀────────────────│                     │
      │◀───────────────│ "Gmail connected │                     │
      │  Success!      │  successfully"  │                     │
      │                │                 │                     │
```

### 8.3 Token Storage

```sql
-- Thêm vào PostgreSQL schema

CREATE TABLE integration_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  integration_id    VARCHAR(100) NOT NULL,      -- 'gmail', 'github', 'notion'
  status            VARCHAR(20) DEFAULT 'connected', -- connected, disconnected, error
  
  -- Credentials (encrypted with AES-256-GCM)
  credentials_enc   BYTEA NOT NULL,             -- Encrypted JSON
  
  -- OAuth specific
  access_token_enc  BYTEA,
  refresh_token_enc BYTEA,
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[],
  
  -- Metadata
  account_info      JSONB DEFAULT '{}',         -- { email, name, avatar }
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ,
  error_message     TEXT
);

CREATE UNIQUE INDEX idx_integration_user 
  ON integration_connections(user_id, integration_id);
```

---

## 9. Webhook Engine

### 9.1 Concept

Webhook Engine nhận events từ bên ngoài và route chúng tới:

1. **Workflow triggers** → Start a workflow
2. **Agent processing** → AI xử lý event
3. **Integration callbacks** → Cập nhật integration state

### 9.2 Architecture

```
External Service (GitHub, Gmail, Shopify, Stripe, ...)
│
│  POST /api/webhooks/{integrationId}/{userId}/{hookId}
│
▼
┌───────────────────────────────────────────────────────┐
│                  Webhook Engine                        │
│                                                       │
│  1. Validate signature (HMAC, etc.)                   │
│  2. Parse event payload                               │
│  3. Match to registered triggers                      │
│  4. Fan-out to subscribers:                           │
│     ├── Workflow Graph Engine (trigger node)           │
│     ├── Agent (direct processing)                     │
│     └── Event Bus (internal events)                   │
└───────────────────────────────────────────────────────┘
```

### 9.3 Gateway Routes

```
/api/webhooks/
├── /:integrationId/:hookId    POST    Receive webhook event
├── /                          GET     List registered webhooks
├── /:id                       POST    Create webhook subscription
└── /:id                       DELETE  Remove webhook subscription

/api/oauth/
├── /:integrationId/authorize  GET     Start OAuth flow (redirect)
├── /callback                  GET     OAuth callback handler
└── /:integrationId/revoke     POST    Revoke access

/api/integrations/
├── /                          GET     List all integrations (catalog)
├── /connected                 GET     List user's connected integrations
├── /:id                       GET     Integration details
├── /:id/connect               POST    Connect (non-OAuth: API key)
├── /:id/disconnect            POST    Disconnect
├── /:id/actions               GET     List available actions
├── /:id/actions/:name/execute POST    Execute action manually
└── /:id/triggers              GET     List available triggers

/api/domains/
├── /                          GET     List all domain packs
├── /:id                       GET     Domain pack details
├── /:id/activate              POST    Activate domain for agent
├── /:id/deactivate            POST    Deactivate domain
└── /:id/skills                GET     List skills in domain
```

---

## 10. Agent Marketplace Vision

### 10.1 Pre-built Agent Templates

Khi user tạo agent mới, có thể chọn template:

| Template | Domain | Integrations | Description |
|---|---|---|---|
| **General Assistant** | general | brave-search | Trợ lý đa năng |
| **Developer** | developer, devops | github, shell | Code, debug, deploy |
| **Healthcare** | healthcare | fhir, openfda | Tư vấn y tế |
| **Finance Manager** | finance | google-sheets | Quản lý tài chính |
| **Marketing** | marketing | twitter, ga4 | Marketing automation |
| **E-Commerce** | ecommerce | shopify, stripe | Quản lý shop |
| **Research** | research | brave-search, pubmed | Nghiên cứu, phân tích |
| **Executive Assistant** | general | gmail, gcalendar, slack | Trợ lý cá nhân |
| **HR Manager** | hr | gmail, notion | Tuyển dụng, onboarding |
| **Legal Advisor** | legal | google-drive | Hợp đồng, compliance |

### 10.2 Community Agents

Users có thể share agent configurations lên Hub:

- Agent template = domain packs + integrations + custom tools + system prompt
- Rating, reviews, install count
- Version control

---

## 11. Implementation Plan

### 11.1 Phase Map

```
Phase 0: Foundation Restructure              ← HIỆN TẠI
├── Tạo packages/integrations/ scaffold
├── Tạo packages/domains/ (rename skills)
├── Thêm types: Integration, DomainPack vào shared
├── Thêm DB tables: integration_connections, webhooks
├── Update package.json workspaces
└── Remove medical-specific code from server

Phase 1: Core Integrations (v2.1.0)
├── defineIntegration() helper
├── IntegrationRegistry class
├── OAuth 2.0 flow (Google suite)
├── Gmail integration (send, read, draft)
├── Google Calendar integration
├── Telegram API integration (beyond bot)
├── GitHub integration
├── Brave Search integration
├── Webhook Engine (basic)
├── Gateway routes: /api/integrations, /api/oauth
└── Web UI: Integration catalog + connect

Phase 2: Domain Packs (v2.1.0)
├── defineDomainPack() helper
├── General domain (search, calc, translate)
├── Developer domain (code, git, shell, test)
├── Healthcare domain (migrate from medical)
├── Finance domain (basic)
├── Marketing domain (basic)
├── Agent templates (preset configs)
└── Web UI: Domain browser + agent templates

Phase 3: Extended Integrations (v2.2.0)
├── Slack integration
├── Apple iMessage integration (macOS)
├── Notion integration
├── Zalo integration (VN market)
├── WhatsApp Business integration
├── Google Sheets + Drive
├── Shopify + Stripe
├── PostHog analytics
├── Firecrawl web scraper
└── More domain packs: education, legal, HR, sales

Phase 4: Advanced Features (v2.3.0)
├── Community integration submissions (Hub)
├── Integration marketplace (install/uninstall)
├── Advanced webhook engine (filters, transforms)
├── Multi-platform agent (1 agent, many channels)
├── Agent-to-agent integration sharing
└── Industry-specific knowledge packs
```

### 11.2 File Changes Summary

| Action | Files |
|---|---|
| **CREATE** | `packages/integrations/` (entire package) |
| **CREATE** | `packages/domains/` (rename + restructure from skills) |
| **MODIFY** | `packages/shared/src/types/` — Add integration, domain types |
| **MODIFY** | `packages/db/src/schema/` — Add integration_connections, webhooks tables |
| **MODIFY** | `packages/gateway/src/routes/` — Add integrations, oauth, webhooks, domains routes |
| **MODIFY** | `packages/gateway/src/gateway.ts` — Register new routes |
| **MODIFY** | `packages/server/src/index.ts` — Remove medical hardcoding, add integration init |
| **MODIFY** | `packages/web/src/` — Add integration UI, domain browser pages |
| **MODIFY** | `package.json` — Add packages/integrations, packages/domains workspaces |
| **MODIFY** | `packages/core/src/agent/` — Integration-aware agent |
| **KEEP** | `packages/skill-hub/` — Evolve to include integrations |
| **KEEP** | `packages/channels/` — Keep as-is, add more channels later |
| **KEEP** | `packages/knowledge-packs/` — Keep, add more later |

---

*Tài liệu này bổ sung cho ADD v2.0. Mọi phần v2.0 không đề cập ở đây (Core Engine, LLM Layer, Memory, Graph Engine, Tracing, etc.) vẫn giữ nguyên.*

---

*END OF DOCUMENT*
