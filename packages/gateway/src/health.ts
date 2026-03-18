import { Hono } from 'hono';

export function createHealthRoutes() {
  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: '2.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (c) => {
    return c.json({
      name: 'xClaw AI Agent Platform',
      version: '2.0.0',
      docs: '/health',
    });
  });

  return app;
}
