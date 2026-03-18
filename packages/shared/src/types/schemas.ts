import { z } from 'zod';

// ─── Runtime Validation Schemas (Zod) ───────────────────────

export const LLMProviderSchema = z.enum([
  'openai', 'anthropic', 'ollama', 'google', 'groq', 'mistral', 'custom',
]);

export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1, 'message is required'),
  stream: z.boolean().optional().default(false),
  webSearch: z.boolean().optional().default(false),
  domainId: z.string().optional(),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  persona: z.string(),
  systemPrompt: z.string(),
  llm: LLMConfigSchema,
  enabledSkills: z.array(z.string()),
  memory: z.object({
    enabled: z.boolean(),
    maxEntries: z.number().positive(),
  }),
  security: z.object({
    requireApprovalForShell: z.boolean(),
    requireApprovalForNetwork: z.boolean(),
    blockedCommands: z.array(z.string()).optional(),
  }),
  maxToolIterations: z.number().positive().default(10),
  toolTimeout: z.number().positive().default(30000),
});

// ─── Auth Schemas ───────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
