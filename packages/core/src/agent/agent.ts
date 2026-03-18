import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  LLMMessage,
  LLMResponse,
  ToolCall,
  ToolResult,
  StreamEvent,
} from '@xclaw/shared';
import { EventBus } from './event-bus.js';
import { LLMRouter } from '../llm/llm-router.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { Tracer } from '../tracing/tracer.js';

export class Agent {
  readonly config: AgentConfig;
  readonly events: EventBus;
  readonly llm: LLMRouter;
  readonly memory: MemoryManager;
  readonly tools: ToolRegistry;
  readonly tracer: Tracer;

  constructor(config: AgentConfig) {
    this.config = config;
    this.events = new EventBus();
    this.llm = new LLMRouter(config.llm);
    this.memory = new MemoryManager();
    this.tools = new ToolRegistry();
    this.tracer = new Tracer();
  }

  /**
   * Chat with the agent (non-streaming). Returns full response.
   */
  async chat(sessionId: string, userMessage: string, ragContext?: string): Promise<string> {
    const span = this.tracer.startSpan('agent:chat', 'agent');

    // Save user message to history
    await this.memory.addMessage(sessionId, {
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Build messages
    await this.memory.loadHistory(sessionId, 20);
    const messages = this.buildMessages(sessionId, userMessage, ragContext);

    // Tool-calling loop
    let response: LLMResponse;
    let iterations = 0;

    while (iterations < this.config.maxToolIterations) {
      iterations++;
      response = await this.llm.chat(messages, this.tools.getDefinitions());

      if (!response.toolCalls?.length) {
        // No tool calls — we have the final answer
        await this.memory.addMessage(sessionId, {
          id: randomUUID(),
          sessionId,
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
        });

        this.tracer.endSpan(span.id, { iterations, usage: response.usage });
        await this.events.emit({
          type: 'agent:response',
          payload: { sessionId, content: response.content, usage: response.usage },
          source: this.config.id,
          timestamp: new Date().toISOString(),
        });

        return response.content;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(response.toolCalls);

      // Add assistant message with tool calls + results to context
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      for (const result of toolResults) {
        messages.push({
          role: 'tool',
          content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
          toolCallId: result.toolCallId,
        });
      }
    }

    // Max iterations reached
    this.tracer.endSpan(span.id, { iterations, maxReached: true });
    return 'I reached the maximum number of tool iterations. Here is what I have so far.';
  }

  /**
   * Stream chat response via async generator.
   */
  async *chatStream(sessionId: string, userMessage: string, ragContext?: string): AsyncGenerator<StreamEvent> {
    const span = this.tracer.startSpan('agent:chatStream', 'agent');

    await this.memory.addMessage(sessionId, {
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    await this.memory.loadHistory(sessionId, 20);
    const messages = this.buildMessages(sessionId, userMessage, ragContext);
    let iterations = 0;

    while (iterations < this.config.maxToolIterations) {
      iterations++;

      const stream = this.llm.chatStream(messages, this.tools.getDefinitions());

      let fullContent = '';
      const toolCalls: ToolCall[] = [];

      for await (const event of stream) {
        if (event.type === 'text-delta') {
          fullContent += event.delta;
          yield event;
        } else if (event.type === 'tool-call-start') {
          toolCalls.push({ id: event.toolCallId, name: event.toolName, arguments: {} });
          yield event;
        } else if (event.type === 'tool-call-args') {
          yield event;
        } else if (event.type === 'tool-call-end') {
          yield event;
        } else if (event.type === 'finish') {
          if (toolCalls.length === 0) {
            // Final response
            await this.memory.addMessage(sessionId, {
              id: randomUUID(),
              sessionId,
              role: 'assistant',
              content: fullContent,
              timestamp: new Date().toISOString(),
            });
            this.tracer.endSpan(span.id, { iterations });
            yield event;
            return;
          }
        } else if (event.type === 'error') {
          this.tracer.failSpan(span.id, event.error);
          yield event;
          return;
        }
      }

      // Execute tool calls if any
      if (toolCalls.length > 0) {
        const results = await this.executeToolCalls(toolCalls);

        for (const result of results) {
          yield { type: 'tool-result', toolCallId: result.toolCallId, result };
        }

        // Feed results back
        messages.push({
          role: 'assistant',
          content: fullContent,
          toolCalls,
        });
        for (const result of results) {
          messages.push({
            role: 'tool',
            content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
            toolCallId: result.toolCallId,
          });
        }
      }
    }

    yield { type: 'error', error: 'Max tool iterations reached' };
  }

  private buildMessages(sessionId: string, userMessage: string, ragContext?: string): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // System prompt (augmented with RAG context if available)
    let systemPrompt = this.config.systemPrompt || this.config.persona;
    if (ragContext) {
      systemPrompt = `${systemPrompt}\n\n## Knowledge Base Context\nThe following information was retrieved from the knowledge base. Use it to answer accurately. Cite sources when possible.\n\n${ragContext}`;
    }
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Conversation history (from cache)
    const history = this.memory.getHistorySync(sessionId);
    for (const msg of history) {
      messages.push({
        role: msg.role as LLMMessage['role'],
        content: msg.content,
        toolCalls: msg.toolCalls,
      });
    }

    return messages;
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      await this.events.emit({
        type: 'tool:started',
        payload: { name: call.name, arguments: call.arguments },
        source: this.config.id,
        timestamp: new Date().toISOString(),
      });

      const result = await this.tools.execute(call);
      results.push(result);

      await this.events.emit({
        type: result.success ? 'tool:completed' : 'tool:failed',
        payload: { name: call.name, result: result.result, duration: result.duration },
        source: this.config.id,
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }
}
