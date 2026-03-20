import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import {
  Agent,
  LLMRouter,
  OpenAIAdapter,
  AnthropicAdapter,
  OllamaAdapter,
  RagEngine,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
  WorkflowEngine,
  MonitoringService,
  ImageGenService,
} from '@xclaw/core';
import { createGateway } from '@xclaw/gateway';
import { IntegrationRegistry, allIntegrations } from '@xclaw/integrations';
import { allDomainPacks } from '@xclaw/domains';
import { MLEngine } from '@xclaw/ml';
import { PluginManager } from '@xclaw/core';
import type { AgentConfig, GatewayConfig } from '@xclaw/shared';
import { loadKnowledgePacks } from './knowledge-loader.js';
import { runMigrations, seedInitialData, connectMongo, getMongo, mongoMonitoringStore } from '@xclaw/db';

dotenv.config();

// Load env
const {
  PORT = '3000',
  HOST = '0.0.0.0',
  CORS_ORIGINS = 'http://localhost:5173,http://localhost:5174,http://localhost:5175',
  JWT_SECRET = 'xclaw-dev-secret-change-me',
  LLM_PROVIDER = 'openai',
  LLM_MODEL: LLM_MODEL_ENV,
  OPENAI_API_KEY = '',
  ANTHROPIC_API_KEY = '',
  OLLAMA_BASE_URL = 'http://localhost:11434/v1',
  AGENT_NAME = 'xClaw Assistant',
  AGENT_SYSTEM_PROMPT = '',
  IMAGE_GEN_PROVIDER = 'placeholder',
  GEMINI_API_KEY = '',
  REPLICATE_API_KEY = '',
  TOGETHER_API_KEY = '',
  COMFYUI_URL = 'http://localhost:8188',
} = process.env;

// Auto-detect default model based on provider
const LLM_MODEL = LLM_MODEL_ENV || (LLM_PROVIDER === 'ollama' ? 'llama3.1:8b' : 'gpt-4o-mini');

// Vietnamese system prompt for doctor support
const DEFAULT_SYSTEM_PROMPT = `You are xClaw, an open-source AI agent platform that adapts to any industry. You are highly capable, helpful, and concise.

You can operate with different domain packs (healthcare, developer, finance, marketing, education, research, devops, legal, HR, sales, e-commerce) and integrate with external services (Gmail, GitHub, Slack, Notion, etc.).

When a user activates a domain pack, adopt that domain's persona and skills. By default, you are a versatile general-purpose assistant.

Respond in the user's language. Be accurate and honest about your limitations.`;

const SYSTEM_PROMPT = AGENT_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

async function main() {
  console.log('🐾 xClaw v2.1.0 — Open Platform Starting...');

  // Run PostgreSQL migrations (idempotent)
  try {
    await runMigrations();
    console.log('   PostgreSQL: migrations applied');
  } catch (err) {
    console.warn('⚠️  Migration skipped:', (err as Error).message);
  }

  // Connect MongoDB (sessions, messages, memory)
  try {
    await connectMongo();
    console.log('   MongoDB:    connected (sessions, messages, memory)');
  } catch (err) {
    console.warn('⚠️  MongoDB skipped:', (err as Error).message);
  }

  // Seed default data (idempotent — skips if already seeded)
  try {
    await seedInitialData();
  } catch (err) {
    console.warn('⚠️  Seed skipped (DB may not be ready):', (err as Error).message);
  }

  // Agent config
  const agentConfig: AgentConfig = {
    id: 'default-agent',
    name: AGENT_NAME,
    persona: AGENT_NAME,
    systemPrompt: SYSTEM_PROMPT,
    llm: {
      provider: LLM_PROVIDER as AgentConfig['llm']['provider'],
      model: LLM_MODEL,
      apiKey: LLM_PROVIDER === 'openai' ? OPENAI_API_KEY : ANTHROPIC_API_KEY,
      baseUrl: LLM_PROVIDER === 'ollama' ? OLLAMA_BASE_URL : undefined,
    },
    enabledSkills: [],
    memory: { enabled: true, maxEntries: 1000 },
    security: {
      requireApprovalForShell: true,
      requireApprovalForNetwork: false,
    },
    maxToolIterations: 10,
    toolTimeout: 30000,
  };

  // Create agent
  const agent = new Agent(agentConfig);

  // Register LLM adapters
  let ollamaAdapter: OllamaAdapter | undefined;

  if (LLM_PROVIDER === 'ollama') {
    // Use native Ollama adapter for multi-model management
    const ollamaBaseUrl = OLLAMA_BASE_URL.replace(/\/v1\/?$/, '');
    ollamaAdapter = new OllamaAdapter({
      baseUrl: ollamaBaseUrl,
      model: LLM_MODEL,
    });
    agent.llm.registerAdapter(ollamaAdapter);
    console.log(`   Ollama:   ${ollamaBaseUrl} (model: ${LLM_MODEL})`);
  }

  if (OPENAI_API_KEY && LLM_PROVIDER !== 'ollama') {
    agent.llm.registerAdapter(
      new OpenAIAdapter({
        apiKey: OPENAI_API_KEY,
        model: LLM_MODEL,
      }),
    );
  }
  if (ANTHROPIC_API_KEY) {
    agent.llm.registerAdapter(
      new AnthropicAdapter({
        apiKey: ANTHROPIC_API_KEY,
        model: LLM_PROVIDER === 'anthropic' ? LLM_MODEL : 'claude-sonnet-4-20250514',
      }),
    );
  }

  // RAG Engine
  const embeddingProvider = OPENAI_API_KEY
    ? new OpenAIEmbeddingProvider({ apiKey: OPENAI_API_KEY })
    : new LocalEmbeddingProvider();
  const rag = new RagEngine(embeddingProvider, undefined, {
    chunkingOptions: { chunkSize: 512, chunkOverlap: 50 },
    topK: 5,
    scoreThreshold: 0.1,
  });

  // Auto-load knowledge packs into RAG
  const knowledgeCount = await loadKnowledgePacks(rag);
  if (knowledgeCount > 0) {
    console.log(`   Knowledge: ${knowledgeCount} documents loaded from knowledge packs`);
  }

  // Integration Registry
  const integrationRegistry = new IntegrationRegistry();
  integrationRegistry.registerAll(allIntegrations);
  console.log(`   Integrations: ${allIntegrations.length} registered`);
  console.log(`   Domains: ${allDomainPacks.length} domain packs loaded`);

  // ML Engine
  const mlEngine = new MLEngine();
  console.log(`   ML Engine: ${mlEngine.listAlgorithms().length} algorithms available`);

  // Workflow Engine
  const workflowEngine = new WorkflowEngine(agent.tools, agent.llm, agent.events);
  console.log('   Workflow:  engine ready (16 node types)');

  // Monitoring Service
  const monitoring = new MonitoringService(agent.events);
  monitoring.setStore(mongoMonitoringStore as any);
  console.log('   Monitoring: audit logs + system logs + metrics active');

  // Plugin Manager
  const imageGen = new ImageGenService({
    provider: IMAGE_GEN_PROVIDER as 'gemini' | 'replicate' | 'together' | 'comfyui' | 'placeholder',
    apiKey: IMAGE_GEN_PROVIDER === 'gemini' ? GEMINI_API_KEY
      : IMAGE_GEN_PROVIDER === 'replicate' ? REPLICATE_API_KEY
      : TOGETHER_API_KEY,
    baseUrl: IMAGE_GEN_PROVIDER === 'comfyui' ? COMFYUI_URL : undefined,
  });
  console.log(`   ImageGen:  ${IMAGE_GEN_PROVIDER} provider`);

  const pluginManager = new PluginManager({
    getMongoDb: () => {
      try { return getMongo(); } catch { return null; }
    },
    llm: agent.llm,
    tools: agent.tools,
    events: agent.events,
    rag,
    imageGen,
  });

  // Plugins are loaded from external submodule (xclaw-plugins)
  console.log(`   Plugins:   ${pluginManager.listActive().length} loaded`);

  // Gateway config
  const gatewayConfig: GatewayConfig = {
    port: parseInt(PORT, 10),
    host: HOST,
    corsOrigins: CORS_ORIGINS.split(',').map((s) => s.trim()),
    jwtSecret: JWT_SECRET,
  };

  // Create Hono app
  const app = createGateway({
    agent,
    rag,
    config: gatewayConfig,
    ollamaAdapter,
    integrationRegistry,
    domainPacks: allDomainPacks,
    mlEngine,
    workflowEngine,
    monitoring,
    pluginManager,
  });

  // Start server
  serve(
    { fetch: app.fetch, hostname: gatewayConfig.host, port: gatewayConfig.port },
    (info) => {
      console.log(`🚀 xClaw server running at http://${info.address}:${info.port}`);
      console.log(`   Provider: ${LLM_PROVIDER} / Model: ${LLM_MODEL}`);
      console.log(`   Health:   http://${info.address}:${info.port}/health`);
      console.log(`   RAG:      ${OPENAI_API_KEY ? 'OpenAI embeddings' : 'Local embeddings (dev mode)'}`);
    },
  );
}

main().catch((err) => {
  console.error('❌ Failed to start xClaw:', err);
  process.exit(1);
});
