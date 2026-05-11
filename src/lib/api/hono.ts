import { Hono } from 'hono';
import { db } from '$lib/db';
import { sessions, messages, aiModels } from '$lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';
import { getSystemPrompt } from '$lib/ai/prompts';
import { generateId, parseMvpPlan } from '$lib/utils';
import { generateDemo, iterateDemo } from '$lib/ai/demo-gen';
import { generateStory } from '$lib/ai/story-gen';
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
// User confirmed the plan — kick off demo generation, no contact yet
app.post('/confirm-plan', async (c) => {
  const { sessionId } = await c.req.json();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);
  // Use setImmediate to ensure response is sent before starting heavy async work
  setImmediate(() => {
    generateDemo(sessionId).then(() => {
      console.log('[demo-gen] done for', sessionId);
    }).catch((e) => console.error('[demo-gen] error:', e));
  });
  return c.json({ ok: true });
});

// ── POST /api/confirm ───────────────────────────────────────────
// User is happy with demo — save contact + notify founder
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

// ── GET /api/demo/:sessionId/status ──────────────────────────────
app.get('/demo/:sessionId/status', async (c) => {
  const sessionId = c.req.param('sessionId');
  const [session] = await db
    .select({ demoStatus: sessions.demoStatus, productType: sessions.productType })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  return c.json({ status: session.demoStatus, productType: session.productType });
});

// ── GET /api/demo/:sessionId/html ───────────────────────────────
app.get('/demo/:sessionId/html', async (c) => {
  const sessionId = c.req.param('sessionId');
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

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session?.demoHtml) return c.json({ error: 'No demo to iterate' }, 404);

  // Kick off async iteration
  iterateDemo(sessionId, instruction, session.demoHtml).catch((e) =>
    console.error('[demo-iter] error:', e)
  );

  return c.json({ ok: true });
});

// ── POST /api/save-demo ──────────────────────────────────────────
app.post('/save-demo', async (c) => {
  const { sessionId } = await c.req.json();
  if (!sessionId) return c.json({ error: 'sessionId required' }, 400);

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session?.demoHtml) return c.json({ error: 'No demo to save' }, 404);

  const slug = session.shareSlug ?? nanoid(8);
  await db.update(sessions).set({
    savedAt: new Date().toISOString(),
    shareSlug: slug,
  }).where(eq(sessions.id, sessionId));

  // Kick off story generation
  setImmediate(() => {
    generateStory(sessionId).catch((e) => console.error('[story-gen] error:', e));
  });

  return c.json({ ok: true, slug });
});

// ── GET /api/story/:sessionId/status ───────────────────────────
app.get('/story/:sessionId/status', async (c) => {
  const sessionId = c.req.param('sessionId');
  const [session] = await db
    .select({ storyStatus: sessions.storyStatus, savedAt: sessions.savedAt })
    .from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!session) return c.json({ error: 'Not found' }, 404);
  return c.json({ status: session.storyStatus, savedAt: session.savedAt });
});

// ── GET /api/story/:sessionId/html ────────────────────────────
app.get('/story/:sessionId/html', async (c) => {
  const sessionId = c.req.param('sessionId');
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
