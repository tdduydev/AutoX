import { randomUUID } from 'node:crypto';
import { DocumentProcessor, type RagDocument, type DocumentChunk, type ChunkingOptions } from './document-processor.js';
import { type EmbeddingProvider, LocalEmbeddingProvider } from './embedding-provider.js';
import { InMemoryVectorStore, type VectorStore, type VectorSearchResult } from './vector-store.js';

// ─── Types ──────────────────────────────────────────────────

export interface RagConfig {
  chunkingOptions?: ChunkingOptions;
  topK?: number;
  scoreThreshold?: number;
}

export interface RetrievalResult {
  chunks: VectorSearchResult[];
  context: string;
  query: string;
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  totalCollections: number;
  totalEnabledDocuments: number;
  documents: Array<{
    id: string;
    title: string;
    source: string;
    chunkCount: number;
    createdAt: string;
  }>;
}

export interface KBCollection {
  id: string;
  name: string;
  description: string;
  color: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMeta {
  enabled: boolean;
  tags: string[];
  collectionId: string | null;
  customMetadata: Record<string, string>;
  chunkingOptions: ChunkingOptions;
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  processingError?: string;
  wordCount: number;
  charCount: number;
}

export interface QueryHistoryEntry {
  id: string;
  query: string;
  resultCount: number;
  avgScore: number;
  topScore: number;
  timestamp: string;
  collectionId?: string | null;
}

export interface KBAnalytics {
  totalQueries: number;
  avgResultCount: number;
  avgScore: number;
  topQueries: Array<{ query: string; count: number; avgScore: number }>;
  recentQueries: QueryHistoryEntry[];
  documentsBySource: Record<string, number>;
  documentsByCollection: Record<string, number>;
  chunkSizeDistribution: { min: number; max: number; avg: number; median: number };
}

// ─── RAG Engine ─────────────────────────────────────────────

export class RagEngine {
  private processor: DocumentProcessor;
  private embeddings: EmbeddingProvider;
  private vectorStore: VectorStore;
  private documents = new Map<string, RagDocument>();
  private documentMeta = new Map<string, DocumentMeta>();
  private collections = new Map<string, KBCollection>();
  private queryHistory: QueryHistoryEntry[] = [];
  private config: Required<RagConfig>;

  constructor(
    embeddings?: EmbeddingProvider,
    vectorStore?: VectorStore,
    config?: RagConfig,
  ) {
    this.processor = new DocumentProcessor();
    this.embeddings = embeddings ?? new LocalEmbeddingProvider();
    this.vectorStore = vectorStore ?? new InMemoryVectorStore();
    this.config = {
      chunkingOptions: config?.chunkingOptions ?? { chunkSize: 512, chunkOverlap: 50, separator: '\n\n' },
      topK: config?.topK ?? 5,
      scoreThreshold: config?.scoreThreshold ?? 0.1,
    };

    const defaultCol: KBCollection = {
      id: 'default',
      name: 'General',
      description: 'Default knowledge collection',
      color: '#6366f1',
      documentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.collections.set('default', defaultCol);
  }

  // ─── Collections ────────────────────────────────────────

  createCollection(name: string, description?: string, color?: string): KBCollection {
    const col: KBCollection = {
      id: randomUUID(),
      name,
      description: description ?? '',
      color: color ?? '#6366f1',
      documentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.collections.set(col.id, col);
    return col;
  }

  updateCollection(id: string, updates: { name?: string; description?: string; color?: string }): KBCollection | null {
    const col = this.collections.get(id);
    if (!col) return null;
    if (updates.name !== undefined) col.name = updates.name;
    if (updates.description !== undefined) col.description = updates.description;
    if (updates.color !== undefined) col.color = updates.color;
    col.updatedAt = new Date().toISOString();
    return col;
  }

  deleteCollection(id: string): boolean {
    if (id === 'default') return false;
    for (const [, meta] of this.documentMeta) {
      if (meta.collectionId === id) meta.collectionId = 'default';
    }
    this.collections.delete(id);
    this.refreshCollectionCounts();
    return true;
  }

  listCollections(): KBCollection[] {
    this.refreshCollectionCounts();
    return Array.from(this.collections.values());
  }

  getCollection(id: string): KBCollection | undefined {
    return this.collections.get(id);
  }

  private refreshCollectionCounts() {
    for (const col of this.collections.values()) col.documentCount = 0;
    for (const meta of this.documentMeta.values()) {
      const col = this.collections.get(meta.collectionId ?? 'default');
      if (col) col.documentCount++;
    }
  }

  // ─── Document Ingestion ─────────────────────────────────

  async ingestText(
    text: string,
    title: string,
    source?: string,
    options?: {
      tags?: string[];
      collectionId?: string;
      customMetadata?: Record<string, string>;
      chunkingOptions?: ChunkingOptions;
    },
  ): Promise<RagDocument> {
    const chunkOpts = options?.chunkingOptions ?? this.config.chunkingOptions;
    const meta: DocumentMeta = {
      enabled: true,
      tags: options?.tags ?? [],
      collectionId: options?.collectionId ?? 'default',
      customMetadata: options?.customMetadata ?? {},
      chunkingOptions: chunkOpts,
      processingStatus: 'processing',
      wordCount: text.split(/\s+/).length,
      charCount: text.length,
    };

    const doc = this.processor.processText(text, title, source ?? 'upload', chunkOpts);
    this.documents.set(doc.id, doc);
    this.documentMeta.set(doc.id, meta);

    try {
      const chunkTexts = doc.chunks.map((c) => c.content);
      if (chunkTexts.length > 0) {
        const embeddings = await this.embeddings.embed(chunkTexts);
        for (let i = 0; i < doc.chunks.length; i++) {
          doc.chunks[i].embedding = embeddings[i];
        }
      }
      await this.vectorStore.add(doc.chunks);
      meta.processingStatus = 'completed';
    } catch (err) {
      meta.processingStatus = 'error';
      meta.processingError = err instanceof Error ? err.message : String(err);
    }

    this.refreshCollectionCounts();
    return doc;
  }

  async ingestUrl(url: string, title?: string, options?: {
    tags?: string[];
    collectionId?: string;
    customMetadata?: Record<string, string>;
    chunkingOptions?: ChunkingOptions;
  }): Promise<RagDocument> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
    const html = await res.text();
    const text = this.htmlToText(html);
    const pageTitle = title ?? this.extractTitle(html) ?? new URL(url).hostname;

    return this.ingestText(text, pageTitle, url, {
      ...options,
      customMetadata: { ...options?.customMetadata, sourceUrl: url, importType: 'web' },
    });
  }

  private htmlToText(html: string): string {
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text.split('\n').filter((l) => l.trim().length > 2).join('\n');
  }

  private extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  }

  // ─── Document Management ────────────────────────────────

  async reindexDocument(documentId: string, newChunkingOptions?: ChunkingOptions): Promise<RagDocument | null> {
    const doc = this.documents.get(documentId);
    const meta = this.documentMeta.get(documentId);
    if (!doc || !meta) return null;

    await this.vectorStore.remove(documentId);
    const chunkOpts = newChunkingOptions ?? meta.chunkingOptions;
    meta.chunkingOptions = chunkOpts;
    meta.processingStatus = 'processing';

    doc.chunks = this.processor.chunkText(doc.content, doc.id, doc.title, doc.source, chunkOpts);
    doc.updatedAt = new Date().toISOString();
    doc.metadata = { ...doc.metadata, charCount: doc.content.length, chunkCount: doc.chunks.length };

    try {
      const chunkTexts = doc.chunks.map((c) => c.content);
      if (chunkTexts.length > 0) {
        const embeddings = await this.embeddings.embed(chunkTexts);
        for (let i = 0; i < doc.chunks.length; i++) {
          doc.chunks[i].embedding = embeddings[i];
        }
      }
      await this.vectorStore.add(doc.chunks);
      meta.processingStatus = 'completed';
    } catch (err) {
      meta.processingStatus = 'error';
      meta.processingError = err instanceof Error ? err.message : String(err);
    }

    return doc;
  }

  setDocumentEnabled(documentId: string, enabled: boolean): boolean {
    const meta = this.documentMeta.get(documentId);
    if (!meta) return false;
    meta.enabled = enabled;
    return true;
  }

  updateDocumentMeta(documentId: string, updates: {
    title?: string;
    tags?: string[];
    collectionId?: string;
    customMetadata?: Record<string, string>;
  }): boolean {
    const doc = this.documents.get(documentId);
    const meta = this.documentMeta.get(documentId);
    if (!doc || !meta) return false;

    if (updates.title !== undefined) doc.title = updates.title;
    if (updates.tags !== undefined) meta.tags = updates.tags;
    if (updates.collectionId !== undefined) meta.collectionId = updates.collectionId;
    if (updates.customMetadata !== undefined) meta.customMetadata = { ...meta.customMetadata, ...updates.customMetadata };
    doc.updatedAt = new Date().toISOString();
    this.refreshCollectionCounts();
    return true;
  }

  // ─── Chunk Management ───────────────────────────────────

  getDocumentChunks(documentId: string): DocumentChunk[] | null {
    const doc = this.documents.get(documentId);
    return doc ? doc.chunks.map((c) => ({ ...c, embedding: undefined })) : null;
  }

  async updateChunk(documentId: string, chunkId: string, content: string): Promise<boolean> {
    const doc = this.documents.get(documentId);
    if (!doc) return false;
    const chunk = doc.chunks.find((c) => c.id === chunkId);
    if (!chunk) return false;

    chunk.content = content;
    try {
      const [embedding] = await this.embeddings.embed([content]);
      chunk.embedding = embedding;
      await this.vectorStore.remove(documentId);
      await this.vectorStore.add(doc.chunks);
    } catch { /* non-fatal */ }

    doc.updatedAt = new Date().toISOString();
    return true;
  }

  async deleteChunk(documentId: string, chunkId: string): Promise<boolean> {
    const doc = this.documents.get(documentId);
    if (!doc) return false;
    const idx = doc.chunks.findIndex((c) => c.id === chunkId);
    if (idx === -1) return false;

    doc.chunks.splice(idx, 1);
    doc.chunks.forEach((c, i) => {
      c.metadata.chunkIndex = i;
      c.metadata.totalChunks = doc.chunks.length;
    });

    await this.vectorStore.remove(documentId);
    if (doc.chunks.length > 0) await this.vectorStore.add(doc.chunks);

    doc.updatedAt = new Date().toISOString();
    doc.metadata = { ...doc.metadata, chunkCount: doc.chunks.length };
    return true;
  }

  async addChunk(documentId: string, content: string): Promise<DocumentChunk | null> {
    const doc = this.documents.get(documentId);
    if (!doc) return null;

    const chunk: DocumentChunk = {
      id: randomUUID(),
      documentId,
      content,
      metadata: {
        source: doc.source,
        title: doc.title,
        chunkIndex: doc.chunks.length,
        totalChunks: doc.chunks.length + 1,
        charStart: 0,
        charEnd: content.length,
        createdAt: new Date().toISOString(),
        manual: true,
      },
    };

    try {
      const [embedding] = await this.embeddings.embed([content]);
      chunk.embedding = embedding;
    } catch { /* non-fatal */ }

    doc.chunks.push(chunk);
    doc.chunks.forEach((c) => { c.metadata.totalChunks = doc.chunks.length; });

    await this.vectorStore.remove(documentId);
    await this.vectorStore.add(doc.chunks);

    doc.updatedAt = new Date().toISOString();
    doc.metadata = { ...doc.metadata, chunkCount: doc.chunks.length };
    return { ...chunk, embedding: undefined };
  }

  // ─── Retrieval ──────────────────────────────────────────

  async retrieve(query: string, topK?: number, collectionId?: string | null): Promise<RetrievalResult> {
    const k = topK ?? this.config.topK;
    const [queryEmbedding] = await this.embeddings.embed([query]);
    let results = await this.vectorStore.search(queryEmbedding, k * 3);

    results = results.filter((r) => {
      const meta = this.documentMeta.get(r.chunk.documentId);
      return meta?.enabled !== false;
    });

    if (collectionId) {
      results = results.filter((r) => {
        const meta = this.documentMeta.get(r.chunk.documentId);
        return meta?.collectionId === collectionId;
      });
    }

    const filtered = results
      .filter((r) => r.score >= this.config.scoreThreshold)
      .slice(0, k);

    const context = filtered
      .map((r, i) => `[Source ${i + 1}: ${r.chunk.metadata.title}]\n${r.chunk.content}`)
      .join('\n\n---\n\n');

    const entry: QueryHistoryEntry = {
      id: randomUUID(),
      query,
      resultCount: filtered.length,
      avgScore: filtered.length > 0 ? filtered.reduce((s, r) => s + r.score, 0) / filtered.length : 0,
      topScore: filtered.length > 0 ? filtered[0].score : 0,
      timestamp: new Date().toISOString(),
      collectionId,
    };
    this.queryHistory.push(entry);
    if (this.queryHistory.length > 500) this.queryHistory.shift();

    return { chunks: filtered, context, query };
  }

  buildRagPrompt(basePrompt: string, context: string): string {
    if (!context) return basePrompt;
    return `${basePrompt}

## Knowledge Base Context
The following information was retrieved from the knowledge base. Use it to answer the user's question accurately.

${context}

## Instructions
- Answer based on the provided context when relevant
- Cite sources when possible (e.g., [Source 1])
- If the context is insufficient, use your general knowledge but mention this
- Be concise and accurate`;
  }

  // ─── Document CRUD ──────────────────────────────────────

  async removeDocument(documentId: string): Promise<boolean> {
    if (!this.documents.has(documentId)) return false;
    await this.vectorStore.remove(documentId);
    this.documents.delete(documentId);
    this.documentMeta.delete(documentId);
    this.refreshCollectionCounts();
    return true;
  }

  async batchRemoveDocuments(documentIds: string[]): Promise<number> {
    let removed = 0;
    for (const id of documentIds) {
      if (await this.removeDocument(id)) removed++;
    }
    return removed;
  }

  async batchSetEnabled(documentIds: string[], enabled: boolean): Promise<number> {
    let updated = 0;
    for (const id of documentIds) {
      if (this.setDocumentEnabled(id, enabled)) updated++;
    }
    return updated;
  }

  async batchReindex(documentIds: string[], chunkingOptions?: ChunkingOptions): Promise<number> {
    let reindexed = 0;
    for (const id of documentIds) {
      if (await this.reindexDocument(id, chunkingOptions)) reindexed++;
    }
    return reindexed;
  }

  async batchMoveToCollection(documentIds: string[], collectionId: string): Promise<number> {
    if (!this.collections.has(collectionId)) return 0;
    let moved = 0;
    for (const id of documentIds) {
      const meta = this.documentMeta.get(id);
      if (meta) { meta.collectionId = collectionId; moved++; }
    }
    this.refreshCollectionCounts();
    return moved;
  }

  // ─── Stats & Analytics ─────────────────────────────────

  getStats(): KnowledgeBaseStats {
    const docs = Array.from(this.documents.values()).map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      chunkCount: d.chunks.length,
      createdAt: d.createdAt,
    }));

    return {
      totalDocuments: this.documents.size,
      totalChunks: this.vectorStore.count(),
      totalCollections: this.collections.size,
      totalEnabledDocuments: Array.from(this.documentMeta.values()).filter((m) => m.enabled).length,
      documents: docs,
    };
  }

  getDocument(id: string): RagDocument | undefined {
    return this.documents.get(id);
  }

  getDocumentMeta(id: string): DocumentMeta | undefined {
    return this.documentMeta.get(id);
  }

  listDocuments(options?: {
    collectionId?: string;
    tag?: string;
    source?: string;
    enabled?: boolean;
    search?: string;
  }): Array<Omit<RagDocument, 'chunks'> & { chunkCount: number; meta: DocumentMeta }> {
    let docs = Array.from(this.documents.entries());

    if (options?.collectionId) {
      docs = docs.filter(([id]) => this.documentMeta.get(id)?.collectionId === options.collectionId);
    }
    if (options?.tag) {
      docs = docs.filter(([id]) => this.documentMeta.get(id)?.tags.includes(options.tag!));
    }
    if (options?.source) {
      docs = docs.filter(([, d]) => d.source === options.source);
    }
    if (options?.enabled !== undefined) {
      docs = docs.filter(([id]) => this.documentMeta.get(id)?.enabled === options.enabled);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      docs = docs.filter(([, d]) =>
        d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q),
      );
    }

    return docs.map(([id, d]) => ({
      id: d.id,
      title: d.title,
      content: d.content.slice(0, 300) + (d.content.length > 300 ? '...' : ''),
      mimeType: d.mimeType,
      source: d.source,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      metadata: d.metadata,
      chunkCount: d.chunks.length,
      meta: this.documentMeta.get(id)!,
    }));
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const meta of this.documentMeta.values()) {
      for (const tag of meta.tags) tags.add(tag);
    }
    return Array.from(tags).sort();
  }

  getAnalytics(): KBAnalytics {
    const totalQueries = this.queryHistory.length;
    const avgResultCount = totalQueries > 0
      ? this.queryHistory.reduce((s, q) => s + q.resultCount, 0) / totalQueries : 0;
    const avgScore = totalQueries > 0
      ? this.queryHistory.reduce((s, q) => s + q.avgScore, 0) / totalQueries : 0;

    const queryMap = new Map<string, { count: number; totalScore: number }>();
    for (const entry of this.queryHistory) {
      const existing = queryMap.get(entry.query);
      if (existing) { existing.count++; existing.totalScore += entry.avgScore; }
      else queryMap.set(entry.query, { count: 1, totalScore: entry.avgScore });
    }
    const topQueries = Array.from(queryMap.entries())
      .map(([query, d]) => ({ query, count: d.count, avgScore: d.totalScore / d.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const docsBySource: Record<string, number> = {};
    for (const doc of this.documents.values()) {
      docsBySource[doc.source] = (docsBySource[doc.source] ?? 0) + 1;
    }

    const docsByCol: Record<string, number> = {};
    for (const meta of this.documentMeta.values()) {
      const col = this.collections.get(meta.collectionId ?? 'default');
      const name = col?.name ?? 'Unknown';
      docsByCol[name] = (docsByCol[name] ?? 0) + 1;
    }

    const chunkSizes: number[] = [];
    for (const doc of this.documents.values()) {
      for (const chunk of doc.chunks) chunkSizes.push(chunk.content.length);
    }
    chunkSizes.sort((a, b) => a - b);

    return {
      totalQueries,
      avgResultCount: Math.round(avgResultCount * 10) / 10,
      avgScore: Math.round(avgScore * 1000) / 1000,
      topQueries,
      recentQueries: this.queryHistory.slice(-20).reverse(),
      documentsBySource: docsBySource,
      documentsByCollection: docsByCol,
      chunkSizeDistribution: chunkSizes.length > 0
        ? {
          min: chunkSizes[0],
          max: chunkSizes[chunkSizes.length - 1],
          avg: Math.round(chunkSizes.reduce((s, v) => s + v, 0) / chunkSizes.length),
          median: chunkSizes[Math.floor(chunkSizes.length / 2)],
        }
        : { min: 0, max: 0, avg: 0, median: 0 },
    };
  }

  getQueryHistory(limit = 20): QueryHistoryEntry[] {
    return this.queryHistory.slice(-limit).reverse();
  }
}
