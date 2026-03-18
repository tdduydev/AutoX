import type { LLMConfig, LLMMessage, LLMResponse, ToolDefinition, StreamEvent } from '@xclaw/shared';

export interface LLMAdapter {
  readonly provider: string;
  chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent>;
}

export class LLMRouter {
  private adapters = new Map<string, LLMAdapter>();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  registerAdapter(adapter: LLMAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  setConfig(config: LLMConfig): void {
    this.config = config;
  }

  getAdapter(): LLMAdapter {
    const adapter = this.adapters.get(this.config.provider);
    if (!adapter) {
      throw new Error(
        `No adapter registered for provider "${this.config.provider}". ` +
        `Available: ${[...this.adapters.keys()].join(', ')}`,
      );
    }
    return adapter;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    return this.getAdapter().chat(messages, tools);
  }

  async *chatStream(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamEvent> {
    yield* this.getAdapter().chatStream(messages, tools);
  }
}
