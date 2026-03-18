import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as jose from 'jose';
import type { GatewayContext } from './gateway.js';

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
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
      });
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  };
}

export function createAuthRoutes(ctx: GatewayContext) {
  const app = new Hono();
  const secret = new TextEncoder().encode(ctx.config.jwtSecret);

  // POST /auth/login
  app.post('/login', async (c) => {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // TODO: Validate against DB when db layer is wired
    // For now, issue a dev token
    const token = await new jose.SignJWT({ email, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(email)
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return c.json({ token, expiresIn: 86400 });
  });

  // GET /auth/me
  app.get('/me', authMiddleware(ctx.config.jwtSecret), async (c) => {
    const user = c.get('user');
    return c.json(user);
  });

  return app;
}
