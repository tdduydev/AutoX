import { pgTable, text, timestamp, integer, boolean, jsonb, index, varchar, serial } from 'drizzle-orm/pg-core';

// ─── Users ──────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // admin | user
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Sessions ───────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  platform: text('platform').notNull().default('web'),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
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
]);

// ─── Agent Configs ──────────────────────────────────────────

export const agentConfigs = pgTable('agent_configs', {
  id: text('id').primaryKey(),
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
});

// ─── Workflows ──────────────────────────────────────────────

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  version: integer('version').notNull().default(1),
  definition: jsonb('definition').notNull(), // nodes + edges + variables + trigger
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
  index('integration_connections_integration_id_idx').on(table.integrationId),
]);

// ─── Webhooks ───────────────────────────────────────────────

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
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
  index('webhooks_integration_id_idx').on(table.integrationId),
]);

// ─── User Domain Preferences ────────────────────────────────

export const userDomainPreferences = pgTable('user_domain_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activeDomains: jsonb('active_domains').notNull().default([]), // ['general', 'developer', 'healthcare']
  defaultDomain: text('default_domain').notNull().default('general'),
  customPersona: text('custom_persona'), // user-defined override persona
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('user_domain_preferences_user_id_idx').on(table.userId),
]);
