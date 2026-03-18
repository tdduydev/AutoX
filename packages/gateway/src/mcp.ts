import { Hono } from 'hono';
import type { DomainPack } from '@xclaw/domains';

// ─── MCP Server Registry ────────────────────────────────────
// Manages connections to external MCP servers (chrome-devtools, github, etc.)
// and exposes xClaw tools as MCP-compatible endpoints

export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;    // for stdio
  args?: string[];     // for stdio
  url?: string;        // for sse/http
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  lastPing?: string;
  description?: string;
}

// In-memory MCP server registry
const mcpServers: MCPServerConfig[] = [
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-chrome-devtools'],
    enabled: false,
    status: 'disconnected',
    toolCount: 25,
    description: 'Control Chrome browser: navigate, click, screenshot, evaluate JS, network inspection',
  },
  {
    id: 'github',
    name: 'GitHub',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-github'],
    enabled: false,
    status: 'disconnected',
    toolCount: 40,
    description: 'GitHub integration: repos, issues, PRs, code search, branch management',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-postgresql'],
    enabled: false,
    status: 'disconnected',
    toolCount: 12,
    description: 'Query PostgreSQL databases, inspect schemas, run migrations',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-filesystem', '/app'],
    enabled: false,
    status: 'disconnected',
    toolCount: 8,
    description: 'Read/write files, list directories, search for files',
  },
];

// Custom user-added MCP servers
const customMcpServers: MCPServerConfig[] = [];

function getAllServers(): MCPServerConfig[] {
  return [...mcpServers, ...customMcpServers];
}

export function createMCPRoutes(domainPacks?: DomainPack[]) {
  const app = new Hono();

  // ─── MCP Server Management ──────────────────────────────

  // GET /mcp/servers — List all registered MCP servers
  app.get('/servers', (c) => {
    return c.json({
      servers: getAllServers(),
      total: getAllServers().length,
      connected: getAllServers().filter((s) => s.status === 'connected').length,
    });
  });

  // GET /mcp/servers/:id — Get a single MCP server config
  app.get('/servers/:id', (c) => {
    const id = c.req.param('id');
    const server = getAllServers().find((s) => s.id === id);
    if (!server) return c.json({ error: 'MCP server not found' }, 404);
    return c.json(server);
  });

  // POST /mcp/servers — Register a new custom MCP server
  app.post('/servers', async (c) => {
    const body = await c.req.json<{
      name: string;
      type: 'stdio' | 'sse' | 'http';
      command?: string;
      args?: string[];
      url?: string;
      description?: string;
    }>();

    if (!body.name || !body.type) {
      return c.json({ error: 'name and type are required' }, 400);
    }

    const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (getAllServers().find((s) => s.id === id)) {
      return c.json({ error: 'Server with this ID already exists' }, 409);
    }

    const server: MCPServerConfig = {
      id,
      name: body.name,
      type: body.type,
      command: body.command,
      args: body.args,
      url: body.url,
      enabled: false,
      status: 'disconnected',
      toolCount: 0,
      description: body.description || '',
    };
    customMcpServers.push(server);
    return c.json({ ok: true, server }, 201);
  });

  // PUT /mcp/servers/:id/toggle — Enable/disable an MCP server
  app.put('/servers/:id/toggle', (c) => {
    const id = c.req.param('id');
    const server = getAllServers().find((s) => s.id === id);
    if (!server) return c.json({ error: 'MCP server not found' }, 404);

    server.enabled = !server.enabled;
    server.status = server.enabled ? 'connected' : 'disconnected';
    server.lastPing = server.enabled ? new Date().toISOString() : undefined;
    return c.json({ ok: true, server });
  });

  // DELETE /mcp/servers/:id — Remove a custom MCP server
  app.delete('/servers/:id', (c) => {
    const id = c.req.param('id');
    // Can only delete custom servers
    if (mcpServers.find((s) => s.id === id)) {
      return c.json({ error: 'Cannot delete built-in MCP server' }, 400);
    }
    const idx = customMcpServers.findIndex((s) => s.id === id);
    if (idx === -1) return c.json({ error: 'MCP server not found' }, 404);
    customMcpServers.splice(idx, 1);
    return c.json({ ok: true });
  });

  // ─── MCP xClaw Tool Exposure ────────────────────────────
  // Expose xClaw domain tools as MCP-compatible format

  // GET /mcp/tools — List all available tools in MCP format
  app.get('/tools', (c) => {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      domain: string;
      skill: string;
    }> = [];

    if (domainPacks) {
      for (const domain of domainPacks) {
        for (const skill of domain.skills) {
          for (const tool of skill.tools) {
            tools.push({
              name: `${domain.id}__${skill.id}__${tool.name}`,
              description: `[${domain.name}/${skill.name}] ${tool.description}`,
              inputSchema: tool.parameters || { type: 'object', properties: {} },
              domain: domain.id,
              skill: skill.id,
            });
          }
        }
      }
    }

    return c.json({ tools, total: tools.length });
  });

  // POST /mcp/tools/call — Call a tool in MCP format
  app.post('/tools/call', async (c) => {
    const body = await c.req.json<{ name: string; arguments?: Record<string, unknown> }>();
    if (!body.name) return c.json({ error: 'Tool name is required' }, 400);

    // Parse tool name: domain__skill__toolName
    const parts = body.name.split('__');
    if (parts.length !== 3) {
      return c.json({ error: 'Invalid tool name format. Expected: domain__skill__toolName' }, 400);
    }
    const [domainId, skillId, toolName] = parts;

    if (!domainPacks) return c.json({ error: 'No domain packs loaded' }, 500);

    const domain = domainPacks.find((d) => d.id === domainId);
    if (!domain) return c.json({ error: `Domain '${domainId}' not found` }, 404);

    const skill = domain.skills.find((s) => s.id === skillId);
    if (!skill) return c.json({ error: `Skill '${skillId}' not found` }, 404);

    const tool = skill.tools.find((t) => t.name === toolName);
    if (!tool) return c.json({ error: `Tool '${toolName}' not found` }, 404);

    try {
      const result = await tool.execute(body.arguments || {});
      return c.json({
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      });
    } catch (err: any) {
      return c.json({
        content: [{ type: 'text', text: err.message || 'Tool execution failed' }],
        isError: true,
      }, 500);
    }
  });

  // ─── MCP Server Info ──────────────────────────────────
  app.get('/info', (c) => {
    return c.json({
      name: 'xClaw',
      version: '2.1.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: false },
      },
      serverInfo: {
        name: 'xClaw AI Agent Platform',
        version: '2.1.0',
      },
    });
  });

  return app;
}
