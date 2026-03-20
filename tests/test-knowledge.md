# xClaw Platform Documentation

## About xClaw

xClaw is a multi-industry AI Agent Platform developed by xDev Asia. The platform version is 2.0.0. It supports multiple domains including healthcare, finance, education, legal, e-commerce, manufacturing, real estate, agriculture, logistics, tourism, energy, and retail.

## Architecture

xClaw uses a monorepo architecture with the following packages:

- **@xclaw-ai/core**: Agent engine, LLM adapters (OpenAI, Anthropic, Ollama, Google), streaming
- **@xclaw-ai/shared**: TypeScript types, Zod schemas, constants
- **@xclaw-ai/gateway**: Hono-based REST API server with JWT authentication
- **@xclaw-ai/server**: Application bootstrap and configuration
- **@xclaw-ai/web**: React 19 frontend with Tailwind CSS
- **@xclaw-ai/ml**: Machine Learning and AutoML engine
- **@xclaw-ai/skill-hub**: Skill marketplace and management

## Key Features

1. **RAG (Retrieval-Augmented Generation)**: Upload documents to knowledge base, automatic chunking and vector embedding, semantic search for context-aware responses.
2. **Multi-Domain Support**: 13 domain packs with specialized prompts and knowledge.
3. **Web Search**: Chat can search the web for real-time information using DuckDuckGo.
4. **Debug Mode**: Toggle debug panel per message to see RAG context, web search results, timing, and token usage.
5. **File Attachments**: Upload images, PDFs, documents up to 10MB per file.
6. **Streaming**: Server-Sent Events (SSE) for real-time response streaming.

## Configuration

- Default LLM: Ollama with llama3.1:8b model
- Server port: 3000
- Web port: 5173
- JWT secret configured via environment variable
- CORS origins: configurable

## Company Info

xDev Asia is a software development company based in Vietnam. The team develops xClaw platform for enterprise AI solutions. Contact: <contact@xdev.asia>. Website: <https://xdev.asia>

## Pricing

xClaw offers three tiers:

- **Community**: Free, open-source, self-hosted, includes core features
- **Pro**: $49/month per seat, includes advanced features, priority support
- **Enterprise**: Custom pricing, dedicated support, SLA, on-premise deployment

## Technical Requirements

- Node.js 20+
- TypeScript 5.5+
- Ollama for local LLM (recommended)
- PostgreSQL for production database (optional, SQLite for development)
