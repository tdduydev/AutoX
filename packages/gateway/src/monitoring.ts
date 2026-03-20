// ============================================================
// Monitoring Routes — Logs, audit trail, system metrics
// ============================================================

import { Hono } from 'hono';
import type { MonitoringService } from '@xclaw-ai/core';

export function createMonitoringRoutes(monitoring: MonitoringService) {
  const app = new Hono();

  // ─── System Metrics ──────────────────────────────────────

  app.get('/metrics', async (c) => {
    try {
      const metrics = monitoring.getMetrics();
      return c.json({ ok: true, metrics });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Audit Logs ──────────────────────────────────────────

  app.get('/audit', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const { userId, action, resource, from, to, limit, offset } = c.req.query();

      const result = await monitoring.getAuditLogs({
        tenantId,
        userId: userId || undefined,
        action: action || undefined,
        resource: resource || undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return c.json({ ok: true, logs: result.logs, total: result.total });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── System Logs ─────────────────────────────────────────

  app.get('/logs', async (c) => {
    try {
      const { level, source, search, from, to, limit, offset } = c.req.query();

      const result = await monitoring.getSystemLogs({
        level: (level as import('@xclaw-ai/shared').LogLevel) || undefined,
        source: source || undefined,
        search: search || undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        limit: limit ? parseInt(limit, 10) : 100,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return c.json({ ok: true, logs: result.logs, total: result.total });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  // ─── Health Dashboard ────────────────────────────────────

  app.get('/dashboard', async (c) => {
    try {
      const tenantId = c.get('tenantId') as string;
      const metrics = monitoring.getMetrics();

      // Recent errors (last 10)
      const recentErrors = await monitoring.getSystemLogs({
        level: ['error', 'fatal'],
        limit: 10,
      });

      // Recent audit activity (last 10)
      const recentAudit = await monitoring.getAuditLogs({
        tenantId,
        limit: 10,
      });

      return c.json({
        ok: true,
        dashboard: {
          metrics,
          recentErrors: recentErrors.logs,
          recentAudit: recentAudit.logs,
        },
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
    }
  });

  return app;
}
