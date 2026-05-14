import { Hono } from 'hono';
import { getDb } from '$lib/db';
import { sessions, messages, aiModels } from '$lib/db/schema';
import { eq, asc, and, desc, sql } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';
import { getSystemPrompt } from '$lib/ai/prompts';
import { nanoid } from 'nanoid';
import { generateId, parseMvpPlan } from '$lib/utils';
import type { RequestHandler } from '@sveltejs/kit';

type Env = {
  DB?: D1Database;
  DEMO_QUEUE?: Queue;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  ADMIN_TOKEN?: string;
  PUBLIC_BASE_URL?: string;
};
type Variables = Record<string, never>;
const app = new Hono<{ Bindings: Env }>().basePath('/api');

// ── POST /api/session/start ─────────────────────────────────────
app.post('/session/start', async (c) => {
  const { locale = 'en' } = await c.req.json().catch(() => ({}));
  const id = generateId();
  const db = getDb(c.env?.DB);
  await db.insert(sessions).values({ id, locale });
  return c.json({ sessionId: id });
});

// ── GET /api/session/:id ────────────────────────────────────────
app.get('/session/:id', async (c) => {
  const db = getDb(c.env?.DB);
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
  const db = getDb(c.env?.DB);
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

  const db = getDb(c.env?.DB);
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

  const { client, model } = await getAIClient(modelId, c.env?.DB);
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
          // Send the appended block to client so its fullContent stays in sync
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: appendBlock })}

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

// ── POST /api/confirm-plan ─────────────────────────────────────
// User confirmed the plan — enqueue demo generation
app.post('/confirm-plan', async (c) => {
  const { sessionId } = await c.req.json();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const db = getDb(c.env?.DB);
  await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));

  if (c.env?.DEMO_QUEUE) {
    await c.env.DEMO_QUEUE.send({ type: 'demo-gen', sessionId });
  } else {
    // local dev fallback
    const { generateDemo } = await import('$lib/ai/demo-gen');
    c.executionCtx.waitUntil(
      generateDemo(sessionId, undefined, c.env?.DB).catch((e: unknown) => console.error('[demo-gen]', e))
    );
  }

  return c.json({ ok: true });
});

// ── POST /api/confirm ───────────────────────────────────────────
// User is happy with demo — save contact + notify founder
app.post('/confirm', async (c) => {
  const { sessionId, contactEmail, contactWechat, contactTelegram, contactQq, contactNote } = await c.req.json();

  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);
  const db = getDb(c.env?.DB);

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Session not found' }, 404);

  await db
    .update(sessions)
    .set({
      completedAt: new Date().toISOString(),
      contactEmail: contactEmail ?? null,
      contactWechat: contactWechat ?? null,
      contactTelegram: contactTelegram ?? null,
      contactQq: contactQq ?? null,
      contactNote: contactNote ?? null,
    })
    .where(eq(sessions.id, sessionId));

  // Notify founder via Telegram
  const telegramToken = c.env?.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = c.env?.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;

  if (telegramToken && telegramChatId) {
    const plan = session.planJson ? JSON.parse(session.planJson) : null;
    const base = (c.env?.PUBLIC_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const chatUrl  = `${base}/chat/${sessionId}`;
    const demoUrl  = `${base}/demo/${sessionId}`;
    const storyUrl = `${base}/story/${sessionId}`;
    // Use HTML parse mode to avoid Markdown v1 issues with special chars (_, *, etc.)
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const text = [
      '🚀 <b>New MVPilot Lead</b>',
      '',
      plan ? `💡 <b>Idea:</b> ${esc(plan.problem)}` : '',
      plan?.user ? `👤 <b>Target:</b> ${esc(plan.user)}` : '',
      '',
      contactEmail    ? `📧 Email: ${esc(contactEmail)}`           : '',
      contactWechat   ? `💬 WeChat: ${esc(contactWechat)}`       : '',
      contactTelegram ? `✈️ Telegram: ${esc(contactTelegram)}` : '',
      contactQq       ? `💬 QQ: ${esc(contactQq)}`               : '',
      contactNote     ? `📝 Note: ${esc(contactNote)}`           : '',
      '',
      `🗨️ Chat: ${chatUrl}`,
      session.demoStatus === 'ready'  ? `🖥️ Demo: ${demoUrl}`   : '',
      session.storyStatus === 'ready' ? `📊 Story: ${storyUrl}` : '',
      '',
      `🆔 Session: <code>${sessionId}</code>`,
    ]
      .filter(Boolean)
      .join('\n');

    const tgRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: 'HTML' }),
    }).catch((err: unknown) => {
      console.error('[confirm] Telegram fetch error:', err);
      return null;
    });

    if (tgRes) {
      const tgJson = await tgRes.json().catch(() => ({})) as { ok?: boolean; description?: string };
      if (!tgRes.ok || !tgJson.ok) {
        console.error('[confirm] Telegram notify failed:', JSON.stringify(tgJson));
      } else {
        await db
          .update(sessions)
          .set({ notifiedAt: new Date().toISOString() })
          .where(eq(sessions.id, sessionId));
      }
    }
  }

  return c.json({ ok: true });
});

// ── GET /api/demo/:sessionId/status ──────────────────────────────
app.get('/demo/:sessionId/status', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = getDb(c.env?.DB);
  const [session] = await db
    .select({ demoStatus: sessions.demoStatus, productType: sessions.productType, locale: sessions.locale })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  return c.json({ status: session.demoStatus, productType: session.productType, locale: session.locale });
});

// ── GET /api/demo/:sessionId/html ───────────────────────────────
app.get('/demo/:sessionId/html', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = getDb(c.env?.DB);
  const [session] = await db
    .select({ demoHtml: sessions.demoHtml, demoStatus: sessions.demoStatus })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.demoStatus !== 'ready' || !session.demoHtml) {
    return c.json({ error: 'Demo not ready' }, 404);
  }
  return new Response(session.demoHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// ── POST /api/demo/:sessionId/iterate ───────────────────────────
app.post('/demo/:sessionId/iterate', async (c) => {
  const sessionId = c.req.param('sessionId');
  const { instruction } = await c.req.json();
  if (!instruction) return c.json({ error: 'instruction required' }, 400);
  const db = getDb(c.env?.DB);

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session?.demoHtml) return c.json({ error: 'No demo to iterate' }, 404);

  // Kick off async iteration via Queue
  if (c.env?.DEMO_QUEUE) {
    await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));
    await c.env.DEMO_QUEUE.send({ type: 'demo-iter', sessionId, instruction, currentHtml: session.demoHtml });
  } else {
    const { iterateDemo } = await import('$lib/ai/demo-gen');
    c.executionCtx.waitUntil(
      iterateDemo(sessionId, instruction, session.demoHtml, c.env?.DB).catch((e: unknown) => console.error('[demo-iter]', e))
    );
  }

  return c.json({ ok: true });
});

// ── POST /api/save-demo ──────────────────────────────────────────
app.post('/save-demo', async (c) => {
  const { sessionId } = await c.req.json();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);
  const db = getDb(c.env?.DB);

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session?.demoHtml) return c.json({ error: 'No demo to save' }, 404);

  const slug = session.shareSlug ?? nanoid(8);
  await db.update(sessions).set({
    savedAt: new Date().toISOString(),
    shareSlug: slug,
  }).where(eq(sessions.id, sessionId));

  // Kick off story generation via Queue
  if (c.env?.DEMO_QUEUE) {
    await c.env.DEMO_QUEUE.send({ type: 'story-gen', sessionId });
  } else {
    const { generateStory } = await import('$lib/ai/story-gen');
    c.executionCtx.waitUntil(
      generateStory(sessionId, c.env?.DB).catch((e: unknown) => console.error('[story-gen]', e))
    );
  }

  return c.json({ ok: true, slug });
});

// ── GET /api/story/:sessionId/status ───────────────────────────
app.get('/story/:sessionId/status', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = getDb(c.env?.DB);
  const [session] = await db
    .select({ storyStatus: sessions.storyStatus, savedAt: sessions.savedAt })
    .from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  return c.json({ status: session.storyStatus, savedAt: session.savedAt });
});

// ── GET /api/story/:sessionId/html ────────────────────────────
app.get('/story/:sessionId/html', async (c) => {
  const sessionId = c.req.param('sessionId');
  const db = getDb(c.env?.DB);
  const [session] = await db
    .select({ storyHtml: sessions.storyHtml, storyStatus: sessions.storyStatus })
    .from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.storyStatus !== 'ready' || !session.storyHtml) {
    return c.json({ error: 'Story not ready' }, 404);
  }
  return new Response(session.storyHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

// ── GET /api/session/:id/summary ──────────────────────────────
// Returns saved demo/story status for chat page
app.get('/session/:id/summary', async (c) => {
  const db = getDb(c.env?.DB);
  const id = c.req.param('id');
  const [s] = await db
    .select({
      demoStatus: sessions.demoStatus,
      storyStatus: sessions.storyStatus,
      savedAt: sessions.savedAt,
      shareSlug: sessions.shareSlug,
      productType: sessions.productType,
    })
    .from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!s) return c.json({ error: 'Not found' }, 404);
  return c.json(s);
});

// ── Admin: GET /api/admin/leads ──────────────────────────────────
// Returns sessions that have been notified (completed + contact submitted)
app.get('/admin/leads', async (c) => {
  const adminToken = c.req.header('x-admin-token');
  const leadsKey = c.req.query('key');
  const expectedAdmin = c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN;
  const expectedLeadsKey = c.env?.LEADS_API_KEY ?? process.env.LEADS_API_KEY;
  const authorized = (adminToken && adminToken === expectedAdmin) || (leadsKey && leadsKey === expectedLeadsKey);
  if (!authorized) return c.json({ error: 'Unauthorized' }, 401);

  const since = c.req.query('since'); // ISO timestamp, optional
  const db = getDb(c.env?.DB);
  const conditions = [sql`${sessions.notifiedAt} IS NOT NULL`];
  if (since) conditions.push(sql`${sessions.notifiedAt} > ${since}`);

  const rows = await db
    .select({
      id: sessions.id,
      notifiedAt: sessions.notifiedAt,
      completedAt: sessions.completedAt,
      contactEmail: sessions.contactEmail,
      contactWechat: sessions.contactWechat,
      contactTelegram: sessions.contactTelegram,
      contactQq: sessions.contactQq,
      planJson: sessions.planJson,
      demoStatus: sessions.demoStatus,
      storyStatus: sessions.storyStatus,
    })
    .from(sessions)
    .where(and(...conditions))
    .orderBy(desc(sessions.notifiedAt))
    .limit(10);

  return c.json(rows);
});

// ── Admin: GET /api/admin/models ────────────────────────────────
app.get('/admin/models', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== (c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  const db = getDb(c.env?.DB);
  const models = await db.select().from(aiModels).orderBy(asc(aiModels.sortOrder));
  return c.json(models);
});

// ── Admin: POST /api/admin/models ───────────────────────────────
app.post('/admin/models', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== (c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  const db = getDb(c.env?.DB);

  const body = await c.req.json();
  const id = generateId();
  await db.insert(aiModels).values({ id, ...body });
  return c.json({ id });
});

// ── Admin: PUT /api/admin/models/:id ────────────────────────────
app.put('/admin/models/:id', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== (c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  const db = getDb(c.env?.DB);

  const id = c.req.param('id');
  const body = await c.req.json();
  await db.update(aiModels).set(body).where(eq(aiModels.id, id));
  return c.json({ ok: true });
});

// ── Admin: DELETE /api/admin/models/:id ─────────────────────────
app.delete('/admin/models/:id', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== (c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  const db = getDb(c.env?.DB);

  const id = c.req.param('id');
  await db.delete(aiModels).where(eq(aiModels.id, id));
  return c.json({ ok: true });
});

// ── Admin: POST /api/admin/session/:id/reset-demo ───────────────
app.post('/admin/session/:id/reset-demo', async (c) => {
  const token = c.req.header('x-admin-token');
  if (token !== (c.env?.ADMIN_TOKEN ?? process.env.ADMIN_TOKEN)) return c.json({ error: 'Unauthorized' }, 401);
  const db = getDb(c.env?.DB);
  const id = c.req.param('id');
  await db.update(sessions).set({ demoStatus: null, demoHtml: null }).where(eq(sessions.id, id));
  return c.json({ ok: true });
});
export const honoHandler: RequestHandler = async ({ request, platform }) => {
  const env = (platform as any)?.env ?? {};
  const ctx = (platform as any)?.context ?? { waitUntil: (p: Promise<unknown>) => p };
  return app.fetch(request, env, ctx);
};
