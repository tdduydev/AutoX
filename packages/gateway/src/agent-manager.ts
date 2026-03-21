import { Agent } from '@xclaw-ai/core';
import type { LLMAdapter } from '@xclaw-ai/core';
import type { AgentConfig } from '@xclaw-ai/shared';
import { agentConfigsCollection, type MongoAgentConfig } from '@xclaw-ai/db';

/**
 * AgentManager — converts MongoAgentConfig → Agent instances with caching.
 * Shares LLM adapters across all agents. Falls back to the default global agent.
 */
export class AgentManager {
  private agents = new Map<string, Agent>();
  private adapters: LLMAdapter[] = [];
  private defaultAgent: Agent;

  constructor(defaultAgent: Agent) {
    this.defaultAgent = defaultAgent;
    this.agents.set('default-agent', defaultAgent);
  }

  /** Register an LLM adapter that will be shared with all dynamically created agents */
  registerAdapter(adapter: LLMAdapter): void {
    this.adapters.push(adapter);
  }

  /** Get the default/global agent */
  getDefault(): Agent {
    return this.defaultAgent;
  }

  /** Get an agent by config ID, loading from MongoDB if needed */
  async getAgent(configId: string | undefined, tenantId = 'default'): Promise<Agent> {
    if (!configId || configId === 'default-agent') {
      return this.defaultAgent;
    }

    // Check cache
    const cached = this.agents.get(configId);
    if (cached) return cached;

    // Load from MongoDB
    const configs = agentConfigsCollection();
    const mongoConfig = await configs.findOne({ _id: configId, tenantId });
    if (!mongoConfig) {
      return this.defaultAgent;
    }

    return this.createAgentFromConfig(mongoConfig);
  }

  /** Get the default agent for a tenant */
  async getDefaultForTenant(tenantId: string): Promise<Agent> {
    const configs = agentConfigsCollection();
    const mongoConfig = await configs.findOne({ tenantId, isDefault: true });
    if (!mongoConfig) {
      return this.defaultAgent;
    }

    const cached = this.agents.get(mongoConfig._id);
    if (cached) return cached;

    return this.createAgentFromConfig(mongoConfig);
  }

  /** Invalidate cached agent (call after config update/delete) */
  invalidate(configId: string): void {
    if (configId !== 'default-agent') {
      this.agents.delete(configId);
    }
  }

  /** Convert MongoAgentConfig → AgentConfig */
  private toRuntimeConfig(mongo: MongoAgentConfig): AgentConfig {
    const llm = mongo.llmConfig || {};
    return {
      id: mongo._id,
      name: mongo.name,
      persona: mongo.persona || mongo.name,
      systemPrompt: mongo.systemPrompt || '',
      llm: {
        provider: llm.provider || 'openai',
        model: llm.model || 'gpt-4o-mini',
        apiKey: llm.apiKey,
        baseUrl: llm.baseUrl,
        temperature: llm.temperature,
        maxTokens: llm.maxTokens,
        capabilities: llm.capabilities,
      },
      enabledSkills: mongo.enabledSkills || [],
      memory: {
        enabled: mongo.memoryConfig?.enabled ?? true,
        maxEntries: mongo.memoryConfig?.maxEntries ?? 1000,
      },
      security: {
        requireApprovalForShell: mongo.securityConfig?.requireApprovalForShell ?? true,
        requireApprovalForNetwork: mongo.securityConfig?.requireApprovalForNetwork ?? false,
        blockedCommands: mongo.securityConfig?.blockedCommands,
      },
      maxToolIterations: mongo.maxToolIterations ?? 10,
      toolTimeout: mongo.toolTimeout ?? 30000,
      isDefault: mongo.isDefault,
    };
  }

  /** Create an Agent from MongoAgentConfig, register adapters, and cache it */
  private createAgentFromConfig(mongoConfig: MongoAgentConfig): Agent {
    const runtimeConfig = this.toRuntimeConfig(mongoConfig);
    const agent = new Agent(runtimeConfig);

    // Register all shared adapters
    for (const adapter of this.adapters) {
      agent.llm.registerAdapter(adapter);
    }

    // Copy tools from default agent
    for (const tool of this.defaultAgent.tools.getDefinitions()) {
      const registered = this.defaultAgent.tools.get(tool.name);
      if (registered) {
        agent.tools.register(tool, registered.handler);
      }
    }

    this.agents.set(mongoConfig._id, agent);
    return agent;
  }
}
