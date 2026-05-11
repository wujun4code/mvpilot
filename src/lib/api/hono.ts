import { Hono } from 'hono';
import { db } from '$lib/db';
import { sessions, messages, aiModels } from '$lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';
import { getSystemPrompt } from '$lib/ai/prompts';
import { generateId, parseMvpPlan } from '$lib/utils';
import type { RequestHandler } from '@sveltejs/kit';

const app = new Hono().basePath('/api');

// ── POST /api/session/start ─────────────────────────────────────
app.post('/session/start', async (c) => {
  const { locale = 'en' } = await c.req.json().catch(() => ({}));
  const id = generateId();
  await db.insert(sessions).values({ id, locale });
  return c.json({ sessionId: id });
});

// ── GET /api/session/:id ────────────────────────────────────────
app.get('/session/:id', async (c) => {
  const id = c.req.param('id');
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(asc(messages.createdAt));

  return c.json({ session, messages: msgs });
});

// ── GET /api/models ───────────────────────────────────────────
app.get('/models', async (c) => {
  const models = await db
    .select({ id: aiModels.id, name: aiModels.name, isDefault: aiModels.isDefault })
    .from(aiModels)
    .where(eq(aiModels.enabled, true))
    .orderBy(asc(aiModels.sortOrder));
  return c.json(models);
});

// ── POST /api/chat ──────────────────────────────────────────────
// Streaming AI chat — returns SSE stream
app.post('/chat', async (c) => {
  const { sessionId, content, modelId } = await c.req.json();

  if (!sessionId || !content) {
    return c.json({ error: 'sessionId and content required' }, 400);
  }

  // Load session
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  // Save user message
  const userMsgId = generateId();
  await db.insert(messages).values({
    id: userMsgId,
    sessionId,
    role: 'user',
    content,
  });

  // Load conversation history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  const { client, model } = await getAIClient(modelId);
  const locale = (session.locale as 'en' | 'zh') ?? 'en';

  const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: getSystemPrompt(locale) },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Stream response
  const stream = await client.chat.completions.create({
    model,
    messages: chatMessages,
    stream: true,
    temperature: 0.7,
    max_tokens: 600,
  });

  const assistantMsgId = generateId();
  let fullContent = '';

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            fullContent += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }

        // Fallback: if AI didn't include quick-replies block, append generic ones
        const hasQuickReplies = /`{3}quick-replies[\s\S]*?`{3}/.test(fullContent);
        const isContactAsk = /联系方式|contact info|email|wechat/i.test(fullContent);
        const isPlan = parseMvpPlan(fullContent) !== null;

        if (!hasQuickReplies && !isContactAsk) {
          const fallback = locale === 'zh'
            ? isPlan
              ? ['就这样，开始吧！', '我想调整一下', '重新开始']
              : ['是的，就是这样', '不完全是，让我补充', '换个方向']
            : isPlan
              ? ["Looks good, let's go!", 'I want to adjust something', 'Start over']
              : ['Yes, exactly', 'Not quite, let me clarify', 'Different direction'];
          const appendBlock = `\n\`\`\`quick-replies\n${JSON.stringify(fallback)}\n\`\`\``;
          fullContent += appendBlock;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: '' })}

`));
        }

        // Save assistant message
        await db.insert(messages).values({
          id: assistantMsgId,
          sessionId,
          role: 'assistant',
          content: fullContent,
        });

        // Check if plan was proposed — save it
        const plan = parseMvpPlan(fullContent);
        if (plan) {
          await db
            .update(sessions)
            .set({ planJson: JSON.stringify(plan) })
            .where(eq(sessions.id, sessionId));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, msgId: assistantMsgId })}\n\n`));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

// ── POST /api/confirm ───────────────────────────────────────────
app.post('/confirm', async (c) => {
  const { sessionId, contactEmail, contactWechat, contactNote } = await c.req.json();

  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  await db
    .update(sessions)
    .set({
      completedAt: new Date().toISOString(),
      contactEmail: contactEmail ?? null,
      contactWechat: contactWechat ?? null,
      contactNote: contactNote ?? null,
    })
    .where(eq(sessions.id, sessionId));

  // Notify founder via Telegram
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (telegramToken && telegramChatId) {
    const plan = session.planJson ? JSON.parse(session.planJson) : null;
    const text = [
      '🚀 *New MVPilot Lead*',
      '',
      plan ? `💡 *Idea:* ${plan.problem}` : '',
      contactEmail ? `📧 Email: ${contactEmail}` : '',
      contactWechat ? `💬 WeChat: ${contactWechat}` : '',
      contactNote ? `📝 Note: ${contactNote}` : '',
      '',
      `🔗 Session: \`${sessionId}\``,
    ]
      .filter(Boolean)
      .join('\n');

    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: 'Markdown' }),
    }).catch(() => {}); // best-effort

    await db
      .update(sessions)
      .set({ notifiedAt: new Date().toISOString() })
      .where(eq(sessions.id, sessionId));
  }

  return c.json({ ok: true });
});

// ── Admin: GET /api/admin/models ────────────────────────────────
app.get('/admin/models', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== process.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);
  const models = await db.select().from(aiModels).orderBy(asc(aiModels.sortOrder));
  return c.json(models);
});

// ── Admin: POST /api/admin/models ───────────────────────────────
app.post('/admin/models', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== process.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const id = generateId();
  await db.insert(aiModels).values({ id, ...body });
  return c.json({ id });
});

// ── Admin: PUT /api/admin/models/:id ────────────────────────────
app.put('/admin/models/:id', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== process.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  await db.update(aiModels).set(body).where(eq(aiModels.id, id));
  return c.json({ ok: true });
});

// ── Admin: DELETE /api/admin/models/:id ─────────────────────────
app.delete('/admin/models/:id', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== process.env.ADMIN_TOKEN) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  await db.delete(aiModels).where(eq(aiModels.id, id));
  return c.json({ ok: true });
});

export const honoHandler: RequestHandler = async ({ request }) => {
  return app.fetch(request);
};
