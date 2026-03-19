import { Hono } from 'hono';
import { TenantService, getTenantLanguageInstruction, LANGUAGE_MAP } from './tenant.js';
import type { TenantSettingsInfo } from './tenant.js';

// ─── Per-tenant settings (DB-backed via TenantService) ──────

/**
 * @deprecated Use getTenantLanguageInstruction(settings) with per-tenant settings instead.
 * Kept for backward compatibility during migration.
 */
export function getLanguageInstruction(): string {
  return ''; // returns empty — callers should migrate to per-tenant version
}

export function createSettingsRoutes() {
  const app = new Hono();

  // GET /settings — Get current tenant's settings
  app.get('/', async (c) => {
    const tenantId = c.get('tenantId');
    const settings = c.get('tenantSettings');
    return c.json({
      aiLanguage: settings.aiLanguage,
      aiLanguageCustom: settings.aiLanguageCustom,
      agentName: settings.agentName,
      enableWebSearch: settings.enableWebSearch,
      enableRag: settings.enableRag,
      enableWorkflows: settings.enableWorkflows,
      languages: Object.entries(LANGUAGE_MAP).map(([code, name]) => ({ code, name })),
    });
  });

  // PUT /settings — Update current tenant's settings
  app.put('/', async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');
    if (user.role !== 'admin' && user.role !== 'owner') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const body = await c.req.json<Partial<TenantSettingsInfo>>();
    const allowedKeys: (keyof TenantSettingsInfo)[] = [
      'aiLanguage', 'aiLanguageCustom', 'agentName', 'systemPrompt',
      'enableWebSearch', 'enableRag', 'enableWorkflows',
      'llmProvider', 'llmModel', 'llmApiKey', 'llmBaseUrl',
      'llmTemperature', 'llmMaxTokens', 'tavilyApiKey',
      'enabledDomains', 'enabledIntegrations', 'branding',
    ];

    const filtered: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in body) {
        filtered[key] = body[key];
      }
    }

    // Validate language
    if (filtered.aiLanguage !== undefined) {
      const lang = String(filtered.aiLanguage).toLowerCase().trim();
      if (lang !== 'auto' && !(lang in LANGUAGE_MAP)) {
        return c.json({ error: 'Invalid language code' }, 400);
      }
      filtered.aiLanguage = lang;
    }

    await TenantService.updateSettings(tenantId, filtered as Partial<TenantSettingsInfo>);
    return c.json({ ok: true });
  });

  return app;
}
