import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

let _devDb: ReturnType<typeof drizzleLibsql<typeof schema>> | null = null;

function getDevDb() {
  if (!_devDb) {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? 'file:./local.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    _devDb = drizzleLibsql(client, { schema });
  }
  return _devDb;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(d1?: D1Database | null): any {
  if (d1) return drizzleD1(d1, { schema });
  return getDevDb();
}

// Convenience proxy for local dev (used by legacy db imports in hono.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = new Proxy({} as ReturnType<typeof getDevDb>, {
  get(_target, prop) {
    return getDevDb()[prop as keyof ReturnType<typeof getDevDb>];
  },
});
