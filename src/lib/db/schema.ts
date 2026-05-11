import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

// AI Models — admin-managed, switch provider without code changes
export const aiModels = sqliteTable('ai_models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),               // "DeepSeek V4 Flash"
  apiEndpoint: text('api_endpoint').notNull(), // "https://api.deepseek.com/v1"
  apiKey: text('api_key').notNull(),           // "sk-xxx"
  apiModel: text('api_model').notNull(),       // "deepseek-chat"
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// Sessions — one per user conversation
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
  contactEmail: text('contact_email'),
  contactWechat: text('contact_wechat'),
  contactNote: text('contact_note'),
  notifiedAt: text('notified_at'),
  planJson: text('plan_json'),
  demoStatus: text('demo_status'),   // null | 'generating' | 'ready' | 'failed'
  demoHtml: text('demo_html'),
  prdMarkdown: text('prd_markdown'),
  productType: text('product_type'),  // saas | mobile | wechat | marketplace | ai_tool
  locale: text('locale').notNull().default('en'),
});

// Messages — conversation turns
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export type AiModel = typeof aiModels.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
