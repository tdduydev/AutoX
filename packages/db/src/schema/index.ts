import { pgTable, text, timestamp, integer, boolean, jsonb, index, varchar, serial, uniqueIndex } from 'drizzle-orm/pg-core';

// ─── Tenants ────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(), // e.g. 'hospital-abc', 'clinic-xyz'
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // URL-friendly identifier
  plan: text('plan').notNull().default('free'), // free | starter | pro | enterprise
  status: text('status').notNull().default('active'), // active | suspended | deleted
  metadata: jsonb('metadata').notNull().default({}), // org info, address, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Tenant Settings (per-tenant configuration) ─────────────

export const tenantSettings = pgTable('tenant_settings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // LLM Configuration
  llmProvider: text('llm_provider').notNull().default('openai'), // openai | anthropic | ollama
  llmModel: text('llm_model').notNull().default('gpt-4o-mini'),
  llmApiKey: text('llm_api_key'), // encrypted — tenant's own API key
  llmBaseUrl: text('llm_base_url'), // for ollama / custom endpoints
  llmTemperature: integer('llm_temperature'), // stored as integer x100 (e.g. 70 = 0.7)
  llmMaxTokens: integer('llm_max_tokens'),
  // Agent persona
  agentName: text('agent_name').notNull().default('xClaw Assistant'),
  systemPrompt: text('system_prompt'), // null = use platform default
  // Language
  aiLanguage: text('ai_language').notNull().default('auto'),
  aiLanguageCustom: text('ai_language_custom'),
  // Features
  enableWebSearch: boolean('enable_web_search').notNull().default(true),
  enableRag: boolean('enable_rag').notNull().default(true),
  enableWorkflows: boolean('enable_workflows').notNull().default(true),
  enabledDomains: jsonb('enabled_domains').notNull().default([]), // ['healthcare', 'developer']
  enabledIntegrations: jsonb('enabled_integrations').notNull().default([]),
  // Limits
  maxUsersPerTenant: integer('max_users_per_tenant').notNull().default(10),
  maxSessionsPerUser: integer('max_sessions_per_user').notNull().default(100),
  maxMessagesPerDay: integer('max_messages_per_day').notNull().default(1000),
  // Search
  tavilyApiKey: text('tavily_api_key'), // tenant's own Tavily key
  // Custom branding
  branding: jsonb('branding').notNull().default({}), // { logo, primaryColor, appTitle }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tenant_settings_tenant_id_idx').on(table.tenantId),
]);

// ─── Users ──────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // owner | admin | user
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
]);

// ─── Sessions ───────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  platform: text('platform').notNull().default('web'),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  index('sessions_tenant_id_idx').on(table.tenantId),
]);

// ─── Messages ───────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user | assistant | system
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  toolResults: jsonb('tool_results'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('messages_session_id_idx').on(table.sessionId),
]);

// ─── Memory Entries ─────────────────────────────────────────

export const memoryEntries = pgTable('memory_entries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // fact | preference | conversation | context | skill-data
  content: text('content').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  source: text('source').notNull(),
  tags: jsonb('tags').notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  index('memory_entries_type_idx').on(table.type),
  index('memory_entries_tenant_id_idx').on(table.tenantId),
]);

// ─── Agent Configs ──────────────────────────────────────────

export const agentConfigs = pgTable('agent_configs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  persona: text('persona').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  llmConfig: jsonb('llm_config').notNull(),
  enabledSkills: jsonb('enabled_skills').notNull().default([]),
  memoryConfig: jsonb('memory_config').notNull(),
  securityConfig: jsonb('security_config').notNull(),
  maxToolIterations: integer('max_tool_iterations').notNull().default(10),
  toolTimeout: integer('tool_timeout').notNull().default(30000),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('agent_configs_tenant_id_idx').on(table.tenantId),
]);

// ─── Workflows ──────────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  version: integer('version').notNull().default(1),
  definition: jsonb('definition').notNull(), // nodes + edges + variables + trigger
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('workflows_tenant_id_idx').on(table.tenantId),
]);

// ─── Workflow Executions ────────────────────────────────────

export const workflowExecutions = pgTable('workflow_executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull().references(() => workflows.id),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed | cancelled
  nodeResults: jsonb('node_results').notNull().default({}),
  variables: jsonb('variables').notNull().default({}),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('workflow_executions_workflow_id_idx').on(table.workflowId),
]);

// ─── Integration Connections ────────────────────────────────

export const integrationConnections = pgTable('integration_connections', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  integrationId: text('integration_id').notNull(), // e.g. 'gmail', 'github', 'slack-api'
  credentials: jsonb('credentials').notNull().default({}), // encrypted API keys, tokens
  oauthTokens: jsonb('oauth_tokens'), // { accessToken, refreshToken, expiresAt }
  status: text('status').notNull().default('active'), // active | revoked | expired | error
  metadata: jsonb('metadata').notNull().default({}),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => [
  index('integration_connections_user_id_idx').on(table.userId),
  index('integration_connections_tenant_id_idx').on(table.tenantId),
  index('integration_connections_integration_id_idx').on(table.integrationId),
]);

// ─── Webhooks ───────────────────────────────────────────────

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  integrationId: text('integration_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  triggerName: text('trigger_name').notNull(),
  secret: text('secret').notNull(),
  url: text('url').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('webhooks_user_id_idx').on(table.userId),
  index('webhooks_tenant_id_idx').on(table.tenantId),
  index('webhooks_integration_id_idx').on(table.integrationId),
]);

// ─── User Domain Preferences ────────────────────────────────

export const userDomainPreferences = pgTable('user_domain_preferences', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activeDomains: jsonb('active_domains').notNull().default([]), // ['general', 'developer', 'healthcare']
  defaultDomain: text('default_domain').notNull().default('general'),
  customPersona: text('custom_persona'), // user-defined override persona
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('user_domain_preferences_user_id_idx').on(table.userId),
  index('user_domain_preferences_tenant_id_idx').on(table.tenantId),
]);
