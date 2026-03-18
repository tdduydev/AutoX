import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDB(databaseUrl?: string) {
  if (db) return db;

  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  client = postgres(url);
  db = drizzle(client, { schema });
  return db;
}

export async function closeDB() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export type DB = ReturnType<typeof getDB>;

// Re-export schema and drizzle helpers
export * from './schema/index.js';
export { eq, and, or, desc, asc, sql, like, inArray } from 'drizzle-orm';
