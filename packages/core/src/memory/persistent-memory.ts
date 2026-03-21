import { randomUUID } from 'node:crypto';
import type { MemoryStore } from './memory-manager.js';

/**
 * Persistent Memory — Cross-session user preferences, facts, and learned context.
 *
 * Stores structured entries that persist across sessions, enabling:
 * - User preferences (language, tone, domain interests)
 * - Learned facts ("User works at company X", "User prefers concise answers")
 * - Context carryover ("We discussed project Y last time")
 */

export interface PersistentEntry {
  id: string;
  userId: string;
  tenantId: string;
  type: 'preference' | 'fact' | 'context' | 'instruction';
  key: string;
  value: string;
  confidence: number; // 0-1 confidence score
  source: 'explicit' | 'inferred'; // user explicitly said it vs. AI inferred
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // optional TTL for context entries
}

export interface PersistentMemoryConfig {
  maxEntries: number;
  autoExtract: boolean; // auto-extract facts from conversations
  minConfidence: number; // minimum confidence to store inferred facts
}

const DEFAULT_CONFIG: PersistentMemoryConfig = {
  maxEntries: 200,
  autoExtract: true,
  minConfidence: 0.7,
};

/**
 * Persistent Memory Manager.
 * Manages cross-session user knowledge that persists beyond individual conversations.
 */
export class PersistentMemory {
  private entries: Map<string, PersistentEntry[]> = new Map();
  private config: PersistentMemoryConfig;

  constructor(config?: Partial<PersistentMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all persistent entries for a user.
   */
  async getEntries(userId: string, tenantId: string): Promise<PersistentEntry[]> {
    const key = `${tenantId}:${userId}`;
    const entries = this.entries.get(key) ?? [];
    // Filter out expired
    const now = new Date();
    return entries.filter((e) => !e.expiresAt || e.expiresAt > now);
  }

  /**
   * Get entries by type.
   */
  async getByType(userId: string, tenantId: string, type: PersistentEntry['type']): Promise<PersistentEntry[]> {
    const all = await this.getEntries(userId, tenantId);
    return all.filter((e) => e.type === type);
  }

  /**
   * Store a persistent entry.
   */
  async store(entry: Omit<PersistentEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PersistentEntry> {
    const key = `${entry.tenantId}:${entry.userId}`;
    if (!this.entries.has(key)) {
      this.entries.set(key, []);
    }

    const entries = this.entries.get(key)!;

    // Check for existing entry with same key — update instead of duplicate
    const existingIdx = entries.findIndex((e) => e.key === entry.key && e.type === entry.type);
    const now = new Date();

    if (existingIdx >= 0) {
      entries[existingIdx] = {
        ...entries[existingIdx],
        value: entry.value,
        confidence: Math.max(entries[existingIdx].confidence, entry.confidence),
        source: entry.source,
        updatedAt: now,
        expiresAt: entry.expiresAt,
      };
      return entries[existingIdx];
    }

    // Enforce max entries
    if (entries.length >= this.config.maxEntries) {
      // Remove lowest confidence inferred entry
      const inferredIdx = entries.findIndex((e) => e.source === 'inferred');
      if (inferredIdx >= 0) entries.splice(inferredIdx, 1);
      else entries.shift(); // remove oldest
    }

    const full: PersistentEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    entries.push(full);
    return full;
  }

  /**
   * Remove a persistent entry.
   */
  async remove(userId: string, tenantId: string, entryId: string): Promise<boolean> {
    const key = `${tenantId}:${userId}`;
    const entries = this.entries.get(key);
    if (!entries) return false;

    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx < 0) return false;
    entries.splice(idx, 1);
    return true;
  }

  /**
   * Clear all persistent entries for a user.
   */
  async clear(userId: string, tenantId: string): Promise<void> {
    const key = `${tenantId}:${userId}`;
    this.entries.delete(key);
  }

  /**
   * Build a system prompt fragment with user's persistent context.
   */
  async buildContextPrompt(userId: string, tenantId: string): Promise<string> {
    const entries = await this.getEntries(userId, tenantId);
    if (entries.length === 0) return '';

    const preferences = entries.filter((e) => e.type === 'preference');
    const facts = entries.filter((e) => e.type === 'fact');
    const instructions = entries.filter((e) => e.type === 'instruction');

    const parts: string[] = [];

    if (preferences.length > 0) {
      parts.push('User Preferences:\n' + preferences.map((p) => `- ${p.key}: ${p.value}`).join('\n'));
    }
    if (facts.length > 0) {
      parts.push('Known Facts:\n' + facts.map((f) => `- ${f.value}`).join('\n'));
    }
    if (instructions.length > 0) {
      parts.push('Standing Instructions:\n' + instructions.map((i) => `- ${i.value}`).join('\n'));
    }

    return parts.join('\n\n');
  }

  /**
   * Extract facts from a conversation message (auto-extract mode).
   */
  async extractFromMessage(userId: string, tenantId: string, content: string): Promise<PersistentEntry[]> {
    if (!this.config.autoExtract) return [];

    const extracted: PersistentEntry[] = [];

    // Simple pattern-based extraction (in production, use LLM for better extraction)
    const patterns = [
      { regex: /(?:my name is|i(?:'m| am)) (\w+)/i, type: 'fact' as const, key: 'user_name' },
      { regex: /i (?:work|am working) (?:at|for) ([^.!?,]+)/i, type: 'fact' as const, key: 'workplace' },
      { regex: /i prefer (\w+) (?:language|mode)/i, type: 'preference' as const, key: 'language' },
      { regex: /please (?:always|remember to) ([^.!]+)/i, type: 'instruction' as const, key: 'instruction' },
      { regex: /i speak (\w+)/i, type: 'preference' as const, key: 'spoken_language' },
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern.regex);
      if (match) {
        const entry = await this.store({
          userId,
          tenantId,
          type: pattern.type,
          key: pattern.key,
          value: match[1].trim(),
          confidence: 0.8,
          source: 'inferred',
        });
        extracted.push(entry);
      }
    }

    return extracted;
  }
}
