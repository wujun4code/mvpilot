#!/usr/bin/env bun
/**
 * Seed script — creates tables and inserts a default AI model.
 * Run: bun scripts/seed.ts
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { aiModels } from '../src/lib/db/schema';
import { nanoid } from 'nanoid';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:./local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

// Create tables
await client.execute(`
  CREATE TABLE IF NOT EXISTS ai_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_model TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    contact_email TEXT,
    contact_wechat TEXT,
    contact_telegram TEXT,
    contact_qq TEXT,
    contact_note TEXT,
    notified_at TEXT,
    plan_json TEXT,
    locale TEXT NOT NULL DEFAULT 'en'
  )
`);

await client.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed default AI model (DeepSeek — change to your preferred provider)
const existing = await client.execute('SELECT id FROM ai_models WHERE is_default = 1');
if (existing.rows.length === 0) {
  await db.insert(aiModels).values({
    id: nanoid(),
    name: 'DeepSeek V4 Flash',
    apiEndpoint: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY ?? 'your-api-key-here',
    apiModel: 'deepseek-chat',
    enabled: true,
    isDefault: true,
    sortOrder: 0,
  });
  console.log('✅ Seeded default AI model: DeepSeek V4 Flash');
} else {
  console.log('ℹ️ Default AI model already exists, skipping.');
}

console.log('✅ Database ready.');
process.exit(0);
