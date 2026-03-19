import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { streamToSSE } from '@xclaw/core';
import { ChatRequestSchema } from '@xclaw/shared';
import type { StreamEvent } from '@xclaw/shared';
import type { GatewayContext } from './gateway.js';
import { getInstalledDomainIds } from './domains.js';
import { getLanguageInstruction } from './settings.js';
import { tavilyWebSearch } from '@xclaw/integrations';
import { getTenantLanguageInstruction } from './tenant.js';
import type { TenantSettingsInfo } from './tenant.js';

// In-memory attachment store (per session)
const attachmentStore = new Map<string, Array<{ id: string; name: string; mimeType: string; size: number; dataUrl: string }>>();

// ─── Conversation History Store ─────────────────────────────
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

const conversationStore = new Map<string, Conversation>();

function getOrCreateConversation(sessionId: string, firstMessage?: string): Conversation {
  if (conversationStore.has(sessionId)) {
    return conversationStore.get(sessionId)!;
  }
  const conv: Conversation = {
    id: sessionId,
    title: firstMessage ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '...' : '') : 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  conversationStore.set(sessionId, conv);

  // Limit total conversations (keep last 100)
  if (conversationStore.size > 100) {
    const keys = [...conversationStore.keys()];
    for (let i = 0; i < keys.length - 100; i++) {
      conversationStore.delete(keys[i]);
    }
  }

  return conv;
}

function addMessageToConversation(sessionId: string, msg: ConversationMessage): void {
  const conv = conversationStore.get(sessionId);
  if (conv) {
    conv.messages.push(msg);
    conv.updatedAt = new Date().toISOString();
  }
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

// Web search using Tavily API (falls back to Bing scraping if no API key)
const TAVILY_API_KEY_GLOBAL = process.env.TAVILY_API_KEY || '';

async function bingFallback(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://www.bing.com/search?q=${encoded}&count=${maxResults}&setlang=vi&mkt=vi-VN&cc=VN`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const resultBlocks = html.split('class="b_algo"');
    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];

      let url = '';
      const urlMatch = block.match(/u=a1([^&"]+)/);
      if (urlMatch) {
        try { url = Buffer.from(urlMatch[1], 'base64').toString(); } catch { /* skip */ }
      }
      if (!url) {
        const hrefMatch = block.match(/href="(https?:\/\/(?!www\.bing\.com)[^"]+)"/);
        if (hrefMatch) url = hrefMatch[1];
      }

      let title = '';
      const h2Match = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (h2Match) {
        title = decodeHtmlEntities(h2Match[1].replace(/<[^>]*>/g, '').trim());
      }
      if (!title) {
        const ariaMatch = block.match(/aria-label="([^"]+)"/);
        if (ariaMatch) title = decodeHtmlEntities(ariaMatch[1]);
      }

      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const snippet = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, '').trim()).slice(0, 300)
        : '';

      if (title || url) {
        results.push({ title: title || url, url, snippet });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function webSearch(query: string, maxResults = 5, tenantSettings?: TenantSettingsInfo): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // Use tenant's Tavily key, or fall back to global env key
  const apiKey = tenantSettings?.tavilyApiKey || TAVILY_API_KEY_GLOBAL;
  if (apiKey) {
    const results = await tavilyWebSearch(query, apiKey, maxResults);
    if (results.length > 0) return results;
    // Fallback to Bing if Tavily returns nothing
  }
  return bingFallback(query, maxResults);
}

// Wraps agent stream with meta events for debug info
async function* wrapStreamWithMeta(
  ctx: GatewayContext,
  sid: string,
  fullMessage: string,
  message: string,
  ragContext: string,
  enableWebSearch: boolean,
  tenantSettings?: TenantSettingsInfo,
): AsyncGenerator<StreamEvent> {
  const timing: Record<string, number> = {};

  // Emit RAG context as meta if available
  if (ragContext) {
    yield { type: 'meta', key: 'rag', data: { context: ragContext.slice(0, 2000), hasContext: true } };
  } else {
    yield { type: 'meta', key: 'rag', data: { context: '', hasContext: false } };
  }

  // Web search if enabled
  let searchResults: Array<{ title: string; url: string; snippet: string }> = [];
  if (enableWebSearch) {
    const searchStart = Date.now();
    searchResults = await webSearch(message, 5, tenantSettings);
    timing.searchMs = Date.now() - searchStart;

    yield { type: 'meta', key: 'search', data: { results: searchResults, query: message } };

    // Append search results to context for the LLM with citation instructions
    if (searchResults.length > 0) {
      const searchContext = searchResults
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
        .join('\n\n');
      fullMessage = `You have access to the following web search results. Use them to answer the user's question. IMPORTANT: Always cite your sources using [1], [2], etc. at the end of relevant sentences. At the end of your answer, list all sources used with their titles and URLs in a "Sources:" section.\n\nWeb search results:\n${searchContext}\n\n---\n\nUser question: ${fullMessage}`;
    }
  }

  // Stream from agent
  const llmStart = Date.now();
  const generator = ctx.agent.chatStream(sid, fullMessage, ragContext);

  for await (const event of generator) {
    if (event.type === 'finish') {
      timing.llmMs = Date.now() - llmStart;
      yield { type: 'meta', key: 'timing', data: timing };
    }
    yield event;
  }
}

export function createChatRoutes(ctx: GatewayContext) {
  const app = new Hono();

  // POST /api/chat/upload — Upload file attachment
  app.post('/upload', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string || 'default';

    if (!file) {
      return c.json({ error: 'file is required' }, 400);
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    const attachment = {
      id: randomUUID(),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      dataUrl,
    };

    // Store in session
    if (!attachmentStore.has(sessionId)) {
      attachmentStore.set(sessionId, []);
    }
    attachmentStore.get(sessionId)!.push(attachment);

    // Clean up old sessions (keep last 50)
    if (attachmentStore.size > 50) {
      const keys = [...attachmentStore.keys()];
      for (let i = 0; i < keys.length - 50; i++) {
        attachmentStore.delete(keys[i]);
      }
    }

    return c.json({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
    });
  });

  // POST /api/chat — non-streaming (and streaming if stream=true)
  app.post('/', async (c) => {
    const body = await c.req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { message, sessionId, stream, webSearch: enableWebSearch, domainId } = parsed.data;
    const sid = sessionId || randomUUID();

    // Resolve domain persona if a domain is selected and installed
    let domainPersona = '';
    if (domainId && domainId !== 'general' && ctx.domainPacks) {
      const installedIds = getInstalledDomainIds();
      if (installedIds.has(domainId)) {
        const domain = ctx.domainPacks.find((d) => d.id === domainId);
        if (domain?.agentPersona) {
          domainPersona = domain.agentPersona;
        }
      }
    }

    // Track conversation — save user message
    getOrCreateConversation(sid, message);
    addMessageToConversation(sid, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Build message with attachment context
    let fullMessage = message;
    const attachmentIds: string[] = (body.attachmentIds as string[]) || [];
    if (attachmentIds.length > 0) {
      const sessionAttachments = attachmentStore.get(sid) || [];
      const matchedAttachments = sessionAttachments.filter((a) => attachmentIds.includes(a.id));
      if (matchedAttachments.length > 0) {
        const attachmentInfo = matchedAttachments
          .map((a) => `[Attached file: ${a.name} (${a.mimeType}, ${Math.round(a.size / 1024)}KB)]`)
          .join('\n');
        fullMessage = `${attachmentInfo}\n\n${message}`;
      }
    }

    // RAG: retrieve relevant context
    let ragContext = '';
    try {
      const retrieval = await ctx.rag.retrieve(message);
      if (retrieval.context) {
        ragContext = retrieval.context;
      }
    } catch {
      // RAG retrieval failure is non-fatal
    }

    // Prepend domain persona to message for domain-aware responses
    if (domainPersona) {
      fullMessage = `[System instruction — Domain specialist mode]\n${domainPersona}\n\n[User message]\n${fullMessage}`;
    }

    // Inject per-tenant language instruction
    const tSettings = c.get('tenantSettings');
    const langInstruction = tSettings ? getTenantLanguageInstruction(tSettings) : getLanguageInstruction();
    if (langInstruction) {
      fullMessage = `[Language instruction]\n${langInstruction}\n\n${fullMessage}`;
    }

    if (stream) {
      const generator = wrapStreamWithMeta(ctx, sid, fullMessage, message, ragContext, enableWebSearch, tSettings);
      const sseStream = streamToSSE(generator);

      return new Response(sseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const response = await ctx.agent.chat(sid, fullMessage, ragContext);
    // Track assistant response
    addMessageToConversation(sid, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    });
    return c.json({ sessionId: sid, content: response });
  });

  // POST /api/chat/stream — dedicated streaming endpoint
  app.post('/stream', async (c) => {
    const body = await c.req.json();
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { message, sessionId, webSearch: enableWebSearch, domainId: streamDomainId } = parsed.data;
    const sid = sessionId || randomUUID();

    // Resolve domain persona
    let streamMessage = message;
    if (streamDomainId && streamDomainId !== 'general' && ctx.domainPacks) {
      const installedIds = getInstalledDomainIds();
      if (installedIds.has(streamDomainId)) {
        const domain = ctx.domainPacks.find((d) => d.id === streamDomainId);
        if (domain?.agentPersona) {
          streamMessage = `[System instruction — Domain specialist mode]\n${domain.agentPersona}\n\n[User message]\n${message}`;
        }
      }
    }

    // Inject per-tenant language instruction
    const streamTSettings = c.get('tenantSettings');
    const streamLangInstruction = streamTSettings ? getTenantLanguageInstruction(streamTSettings) : getLanguageInstruction();
    if (streamLangInstruction) {
      streamMessage = `[Language instruction]\n${streamLangInstruction}\n\n${streamMessage}`;
    }

    // RAG: retrieve relevant context
    let ragContext = '';
    try {
      const retrieval = await ctx.rag.retrieve(message);
      if (retrieval.context) {
        ragContext = retrieval.context;
      }
    } catch {
      // RAG retrieval failure is non-fatal
    }

    const generator = wrapStreamWithMeta(ctx, sid, streamMessage, message, ragContext, enableWebSearch, streamTSettings);
    const sseStream = streamToSSE(generator);

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });

  // POST /api/chat/save-search — Save web search results to knowledge base
  app.post('/save-search', async (c) => {
    const body = await c.req.json();
    const { results, query, collectionId } = body as {
      results: Array<{ title: string; url: string; snippet: string }>;
      query: string;
      collectionId?: string;
    };

    if (!results?.length || !query) {
      return c.json({ error: 'results and query are required' }, 400);
    }

    // Build a text document from the search results
    const textContent = results
      .map((r, i) => `## [${i + 1}] ${r.title}\nSource: ${r.url}\n\n${r.snippet}`)
      .join('\n\n---\n\n');

    const title = `Web Search: ${query}`;
    const source = 'web-search';

    try {
      const doc = await ctx.rag.ingestText(textContent, title, source, {
        tags: ['web-search', 'auto-saved'],
        collectionId,
        customMetadata: { query, savedAt: new Date().toISOString(), resultCount: String(results.length) },
      });

      return c.json({
        id: doc.id,
        title: doc.title,
        chunkCount: doc.chunks.length,
      }, 201);
    } catch (err) {
      return c.json({ error: 'Failed to save search results' }, 500);
    }
  });

  // POST /api/chat/feedback — Self-learning from user corrections
  app.post('/feedback', async (c) => {
    const body = await c.req.json();
    const { originalQuestion, aiAnswer, feedback, correction } = body as {
      originalQuestion: string;
      aiAnswer: string;
      feedback: 'positive' | 'negative';
      correction?: string;
    };

    if (!aiAnswer || !feedback) {
      return c.json({ error: 'aiAnswer and feedback are required' }, 400);
    }

    // When user provides a correction, ingest it into KB so the system learns
    if (feedback === 'negative' && correction?.trim()) {
      try {
        const textContent = [
          `## Correction`,
          `**Question:** ${originalQuestion}`,
          `**Correct Answer:** ${correction.trim()}`,
          `**Previous Incorrect Answer:** ${aiAnswer}`,
          `**Corrected at:** ${new Date().toISOString()}`,
        ].join('\n\n');

        await ctx.rag.ingestText(textContent, `Correction: ${originalQuestion.slice(0, 80)}`, 'user-feedback', {
          tags: ['feedback', 'correction', 'self-learning'],
          customMetadata: {
            feedbackType: 'negative',
            correctedAt: new Date().toISOString(),
          },
        });

        return c.json({ success: true, learned: true });
      } catch (err) {
        return c.json({ error: 'Failed to save correction' }, 500);
      }
    }

    return c.json({ success: true, learned: false });
  });

  // POST /api/chat/generate-image — Generate image via Pollinations.ai (free, no API key)
  app.post('/generate-image', async (c) => {
    const body = await c.req.json();
    const { prompt, sessionId, width, height } = body as {
      prompt: string;
      sessionId?: string;
      width?: number;
      height?: number;
    };

    if (!prompt?.trim()) {
      return c.json({ error: 'prompt is required' }, 400);
    }

    const w = Math.min(width || 1024, 1536);
    const h = Math.min(height || 1024, 1536);
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(prompt.trim());
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${w}&height=${h}&seed=${seed}&nologo=true`;

    // Track in conversation
    if (sessionId) {
      getOrCreateConversation(sessionId, `🎨 ${prompt.slice(0, 50)}`);
      addMessageToConversation(sessionId, {
        id: `u-${Date.now()}`,
        role: 'user',
        content: `🎨 Generate image: ${prompt}`,
        timestamp: new Date().toISOString(),
      });
      addMessageToConversation(sessionId, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `![Generated Image](${imageUrl})`,
        timestamp: new Date().toISOString(),
      });
    }

    return c.json({
      imageUrl,
      prompt: prompt.trim(),
      width: w,
      height: h,
      seed,
    });
  });

  // POST /api/chat/save-message — Save completed assistant message from streaming
  app.post('/save-message', async (c) => {
    const body = await c.req.json();
    const { sessionId, content } = body as { sessionId: string; content: string };
    if (!sessionId || !content) {
      return c.json({ error: 'sessionId and content required' }, 400);
    }
    addMessageToConversation(sessionId, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    });
    return c.json({ success: true });
  });

  // ─── Conversation History Endpoints ─────────────────────────

  // GET /api/chat/conversations — List all conversations
  app.get('/conversations', (c) => {
    const conversations = [...conversationStore.values()]
      .map(({ id, title, createdAt, updatedAt, messages }) => ({
        id,
        title,
        createdAt,
        updatedAt,
        messageCount: messages.length,
        lastMessage: messages.length > 0 ? messages[messages.length - 1].content.slice(0, 100) : '',
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return c.json(conversations);
  });

  // GET /api/chat/conversations/:id — Get conversation with messages
  app.get('/conversations/:id', (c) => {
    const id = c.req.param('id');
    const conv = conversationStore.get(id);
    if (!conv) return c.json({ error: 'Conversation not found' }, 404);
    return c.json(conv);
  });

  // PUT /api/chat/conversations/:id — Rename conversation
  app.put('/conversations/:id', async (c) => {
    const id = c.req.param('id');
    const conv = conversationStore.get(id);
    if (!conv) return c.json({ error: 'Conversation not found' }, 404);
    const body = await c.req.json();
    if (body.title) conv.title = String(body.title).slice(0, 100);
    conv.updatedAt = new Date().toISOString();
    return c.json({ success: true });
  });

  // DELETE /api/chat/conversations/:id — Delete conversation
  app.delete('/conversations/:id', (c) => {
    const id = c.req.param('id');
    conversationStore.delete(id);
    return c.json({ success: true });
  });

  return app;
}
