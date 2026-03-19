import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as jose from 'jose';
import { getDB, users, tenants, eq, and } from '@xclaw/db';
import type { GatewayContext } from './gateway.js';

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export function authMiddleware(jwtSecret: string) {
  const secret = new TextEncoder().encode(jwtSecret);

  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    try {
      const { payload } = await jose.jwtVerify(token, secret);
      c.set('user', {
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        tenantId: payload.tenantId as string,
      });
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  };
}

// hash helper (using Web Crypto)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createAuthRoutes(ctx: GatewayContext) {
  const app = new Hono();
  const secret = new TextEncoder().encode(ctx.config.jwtSecret);

  // POST /auth/login
  app.post('/login', async (c) => {
    const body = await c.req.json();
    const { email, password, tenantSlug } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const db = getDB();

    // Resolve tenant (optional slug — if not provided, find user's tenant)
    let user: typeof users.$inferSelect | undefined;

    if (tenantSlug) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
      if (!tenant || tenant.status !== 'active') {
        return c.json({ error: 'Tenant not found or inactive' }, 404);
      }
      const [found] = await db.select().from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.email, email)))
        .limit(1);
      user = found;
    } else {
      // Find first matching user by email (single-tenant shortcut)
      const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      user = found;
    }

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const hashed = await hashPassword(password);
    if (hashed !== user.passwordHash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await new jose.SignJWT({
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return c.json({
      token,
      expiresIn: 86400,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
    });
  });

  // POST /auth/register — self-registration (creates tenant + owner)
  app.post('/register', async (c) => {
    const body = await c.req.json();
    const { name, email, password, tenantName, tenantSlug } = body;

    if (!name || !email || !password || !tenantName || !tenantSlug) {
      return c.json({ error: 'name, email, password, tenantName, and tenantSlug are required' }, 400);
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenantSlug)) {
      return c.json({ error: 'tenantSlug must be lowercase alphanumeric with hyphens' }, 400);
    }

    const db = getDB();

    // Check slug availability
    const [existingTenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
    if (existingTenant) {
      return c.json({ error: 'Tenant slug already taken' }, 409);
    }

    const now = new Date();
    const tenantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    // Create tenant
    await db.insert(tenants).values({
      id: tenantId, name: tenantName, slug: tenantSlug,
      plan: 'free', status: 'active', metadata: {},
      createdAt: now, updatedAt: now,
    });

    // Create default settings
    const { tenantSettings } = await import('@xclaw/db');
    await db.insert(tenantSettings).values({
      id: crypto.randomUUID(), tenantId,
      createdAt: now, updatedAt: now,
    });

    // Create owner user
    await db.insert(users).values({
      id: userId, tenantId, name, email, passwordHash,
      role: 'owner', createdAt: now, updatedAt: now,
    });

    const token = await new jose.SignJWT({ email, role: 'owner', tenantId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return c.json({
      token,
      expiresIn: 86400,
      user: { id: userId, name, email, role: 'owner', tenantId },
      tenant: { id: tenantId, name: tenantName, slug: tenantSlug },
    }, 201);
  });

  // GET /auth/me
  app.get('/me', authMiddleware(ctx.config.jwtSecret), async (c) => {
    const user = c.get('user');
    return c.json(user);
  });

  return app;
}
