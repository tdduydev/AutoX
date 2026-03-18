// ============================================================
// @xclaw/core — Agent Engine
// ============================================================

// Agent
export { Agent } from './agent/agent.js';
export { EventBus } from './agent/event-bus.js';

// LLM
export { LLMRouter } from './llm/llm-router.js';
export type { LLMAdapter } from './llm/llm-router.js';
export { OpenAIAdapter } from './llm/openai-adapter.js';
export { AnthropicAdapter } from './llm/anthropic-adapter.js';
export { OllamaAdapter } from './llm/ollama-adapter.js';
export type { OllamaModel, OllamaModelInfo, OllamaHealthStatus } from './llm/ollama-adapter.js';

// Streaming
export { streamToSSE, collectStreamText, withHeartbeat } from './streaming/stream-writer.js';

// Memory
export { MemoryManager } from './memory/memory-manager.js';
export type { MemoryStore } from './memory/memory-manager.js';

// Tools
export { ToolRegistry } from './tools/tool-registry.js';
export type { ToolHandler } from './tools/tool-registry.js';

// Skills
export { SkillManager, defineSkill } from './skills/skill-manager.js';
export type { SkillDefinition } from './skills/skill-manager.js';

// Graph / Workflow
export { GraphEngine } from './graph/graph-engine.js';

// RAG
export { RagEngine } from './rag/rag-engine.js';
export type { RagConfig, RetrievalResult, KnowledgeBaseStats, KBCollection, DocumentMeta, QueryHistoryEntry, KBAnalytics } from './rag/rag-engine.js';
export { DocumentProcessor } from './rag/document-processor.js';
export type { RagDocument, DocumentChunk, ChunkMetadata, ChunkingOptions } from './rag/document-processor.js';
export { OpenAIEmbeddingProvider, LocalEmbeddingProvider } from './rag/embedding-provider.js';
export type { EmbeddingProvider } from './rag/embedding-provider.js';
export { InMemoryVectorStore } from './rag/vector-store.js';
export type { VectorStore, VectorSearchResult } from './rag/vector-store.js';

// Tracing
export { Tracer } from './tracing/tracer.js';
