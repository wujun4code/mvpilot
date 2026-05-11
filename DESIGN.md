# DESIGN.md — MVPilot Product & Technical Design

## 1. Problem Statement

In the AI era, the barrier to building software has dropped dramatically. Yet most aspiring indie hackers still fail to launch — not because they can't code, but because they can't clearly define *what* to build.

Common failure modes:
- Idea is too vague ("I want to build an AI app")
- Scope is too large ("it should do everything")
- No validation ("I'll figure out users later")
- Analysis paralysis ("maybe I should add more features first")

**MVPilot solves the clarity problem before the first line of code is written.**

---

## 2. Target User

**Primary:** Solo developers / indie hackers who have a rough idea but need structured thinking.

**Secondary:** Non-technical founders who want to evaluate an idea's feasibility before hiring engineers.

**NOT:** Enterprise product managers (too simple). Existing products (no idea-stage problem).

---

## 3. Core User Flow

```
Landing Page
    ↓
"Start with your idea" (no login required)
    ↓
AI Conversation — 7-10 turns:
  Turn 1: What's your idea? (free form)
  Turn 2: Who is the user? What pain do they have now?
  Turn 3: How do they solve this today? Why is that bad?
  Turn 4: What makes your approach different?
  Turn 5: What do you have? (skills, time, budget)
  Turn 6: What would "done" look like in 4 weeks?
  Turn 7: AI challenges assumptions, asks hard questions
  Turn 8: AI proposes MVP scope
    ↓
MVP Plan Output:
  - Problem statement (1 sentence)
  - Target user (specific)
  - MVP feature set (3-5 items max)
  - What's explicitly OUT of scope
  - Top 3 risks
  - Suggested first action
    ↓
User Review → Adjust → Confirm
    ↓
"Connect with founder" → Email/WeChat capture → Telegram notification
```

---

## 4. AI Design

### Model Strategy

MVPilot uses an **OpenAI-compatible API client** with DB-managed model config.
The admin can switch providers (DeepSeek, Kimi, Gemini, OpenAI) without code changes.

```ts
// lib/ai/client.ts
export async function getAIClient() {
  const model = await db.select().from(aiModels)
    .where(eq(aiModels.isDefault, true))
    .limit(1);
  return new OpenAI({
    apiKey: model[0].apiKey,
    baseURL: model[0].apiEndpoint,
  });
}
```

### Conversation State Machine

```
IDLE → EXPLORING → SCOPING → CHALLENGING → PROPOSING → CONFIRMED
```

Each state has a dedicated system prompt segment. The AI knows which stage it's in and steers accordingly.

### Prompt Philosophy

- Ask one question at a time (no overwhelming lists)
- Challenge vague answers with follow-ups ("what does 'better' mean here?")
- Redirect scope creep ("that sounds like v2 — let's park it")
- Be direct about risks, not encouraging for the sake of it

---

## 5. Data Schema (Drizzle / SQLite)

```ts
// Sessions — one per user conversation
sessions {
  id: text (cuid)
  createdAt: timestamp
  completedAt: timestamp | null
  contactEmail: text | null
  contactWechat: text | null
  notifiedAt: timestamp | null
  planJson: text | null   // final MVP plan as JSON
}

// Messages — conversation turns
messages {
  id: text (cuid)
  sessionId: text → sessions.id
  role: 'user' | 'assistant' | 'system'
  content: text
  createdAt: timestamp
}

// AI Models — admin-managed
aiModels {
  id: text (cuid)
  name: text              // "DeepSeek V4 Flash"
  apiEndpoint: text       // "https://api.deepseek.com/v1"
  apiKey: text            // encrypted
  apiModel: text          // "deepseek-chat"
  enabled: boolean
  isDefault: boolean
  sortOrder: integer
}
```

---

## 6. API Routes (Hono)

```
POST /api/chat          — Send message, get streaming AI response
POST /api/session/start — Create new session
POST /api/confirm       — User confirms plan, capture contact, notify founder
GET  /api/session/:id   — Load existing session (resume)

Admin (auth protected):
GET  /api/admin/models       — List AI models
POST /api/admin/models       — Add model
PUT  /api/admin/models/:id   — Update model
DEL  /api/admin/models/:id   — Delete model
```

---

## 7. Notification Design

When user confirms:

1. Save plan + contact to DB
2. POST to Telegram Bot API → message to founder's chat
3. Message format:
   ```
   🚀 New MVPilot Lead

   Idea: {one-line summary}
   Contact: {email or wechat}
   Time: {timestamp}

   [View Full Plan] → link to admin dashboard
   ```

---

## 8. Deployment

```
Cloudflare Pages  — SvelteKit frontend + API (Hono on Workers)
Turso             — SQLite database (edge-native)
GitHub Pages      — Landing / docs site (docs/ folder)
```

---

## 9. What We're NOT Building (Phase 1)

- User accounts / auth
- Payment
- Admin UI (model config via direct DB for now)
- Analytics dashboard
- Mobile app / mini program

These are all post-validation scope.
