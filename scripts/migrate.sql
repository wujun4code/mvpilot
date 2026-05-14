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
);
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
  demo_status TEXT,
  demo_html TEXT,
  prd_markdown TEXT,
  product_type TEXT,
  saved_at TEXT,
  share_slug TEXT,
  story_status TEXT,
  story_html TEXT,
  locale TEXT NOT NULL DEFAULT 'en'
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
