import { randomUUID } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  source: string;
  title: string;
  chunkIndex: number;
  totalChunks: number;
  charStart: number;
  charEnd: number;
  createdAt: string;
  [key: string]: unknown;
}

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  mimeType: string;
  source: string;
  chunks: DocumentChunk[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ChunkingOptions {
  chunkSize?: number;       // default 512 chars
  chunkOverlap?: number;    // default 50 chars
  separator?: string;       // default '\n\n'
}

// ─── Document Processor ─────────────────────────────────────

export class DocumentProcessor {
  private defaultOptions: Required<ChunkingOptions> = {
    chunkSize: 512,
    chunkOverlap: 50,
    separator: '\n\n',
  };

  /**
   * Process raw text into a RagDocument with chunks.
   */
  processText(
    text: string,
    title: string,
    source: string,
    options?: ChunkingOptions,
  ): RagDocument {
    const docId = randomUUID();
    const now = new Date().toISOString();
    const chunks = this.chunkText(text, docId, title, source, options);

    return {
      id: docId,
      title,
      content: text,
      mimeType: 'text/plain',
      source,
      chunks,
      createdAt: now,
      updatedAt: now,
      metadata: { charCount: text.length, chunkCount: chunks.length },
    };
  }

  /**
   * Split text into overlapping chunks using recursive splitting.
   */
  chunkText(
    text: string,
    documentId: string,
    title: string,
    source: string,
    options?: ChunkingOptions,
  ): DocumentChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const { chunkSize, chunkOverlap } = opts;

    // Recursive separators: paragraph → sentence → word → char
    const separators = ['\n\n', '\n', '. ', ' ', ''];
    const rawChunks = this.recursiveSplit(text, separators, chunkSize, chunkOverlap);

    const now = new Date().toISOString();
    let charOffset = 0;

    return rawChunks.map((chunk, idx) => {
      const charStart = text.indexOf(chunk, charOffset);
      const actualStart = charStart >= 0 ? charStart : charOffset;
      charOffset = actualStart + chunk.length - chunkOverlap;

      return {
        id: randomUUID(),
        documentId,
        content: chunk.trim(),
        metadata: {
          source,
          title,
          chunkIndex: idx,
          totalChunks: rawChunks.length,
          charStart: actualStart,
          charEnd: actualStart + chunk.length,
          createdAt: now,
        },
      };
    });
  }

  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number,
    overlap: number,
  ): string[] {
    if (text.length <= chunkSize) return [text];

    const sep = separators.find((s) => text.includes(s)) ?? '';
    const parts = sep ? text.split(sep) : [text];
    const chunks: string[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length > chunkSize && current) {
        chunks.push(current);
        // Keep overlap from end of current
        const overlapText = current.slice(-overlap);
        current = overlapText + sep + part;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);

    // If any chunk is still too large, split further
    const result: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length > chunkSize * 1.5 && separators.length > 1) {
        result.push(...this.recursiveSplit(chunk, separators.slice(1), chunkSize, overlap));
      } else {
        result.push(chunk);
      }
    }

    return result;
  }
}
