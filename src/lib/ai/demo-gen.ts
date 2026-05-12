import OpenAI from 'openai';
import { getDb } from '$lib/db';
import { sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';

export function detectProductType(plan: any): string {
  const text = JSON.stringify(plan).toLowerCase();
  if (text.includes('小程序') || text.includes('miniprogram')) return 'wechat';
  if (text.includes('mobile app') || text.includes('移动 app') || text.includes('手机 app')) return 'mobile';
  if (text.includes('marketplace') || text.includes('双边') || text.includes('撮合平台')) return 'marketplace';
  if (text.includes('ai工具') || text.includes('ai agent') || text.includes('chatbot')) return 'ai_tool';
  return 'saas';
}

// ── Single-step demo generation ─────────────────────────────────
async function buildHtml(plan: any, productType: string, locale: string, client: OpenAI, model: string): Promise<string> {
  const isZh = locale === 'zh';
  const isWechat = productType === 'wechat';
  const isMobile = productType === 'mobile' || isWechat;

  const styleGuide = isWechat
    ? '微信小程序风格：绿色#07c160主色，白色背景，顶部固定导航栏，底部TabBar用emoji做图标'
    : isMobile
    ? '移动App风格：深色主题或白色背景，375px宽，顶部导航，底部TabBar'
    : 'Web SaaS风格：左侧边栏导航或顶部导航，响应式布局';

  const prompt = `生成一个**完整可运行的单文件HTML Demo**，展示以下产品的核心交互流程。

产品信息：
- 问题：${plan.problem}
- 用户：${plan.user}  
- 核心功能：${(plan.features || []).slice(0, 3).join('、')}
- 第一步：${plan.firstAction}

风格：${styleGuide}

严格要求：
1. 只输出HTML，从<!DOCTYPE html>到</html>，不加任何说明
2. 所有CSS和JS内联，**禁止任何外部资源**（无CDN无外链）
3. 实现2-3个核心页面用tab切换
4. 用假数据（张三李四），默认已登录
5. 核心操作可点击并有反馈
6. CSS极简，**总行数控制在400行以内**，无复杂动画
7. 微信小程序风格则加顶部导航栏和底部TabBar

输出完整HTML：`;

  // Use streaming to avoid timeout on slow models
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3500,
    stream: true,
  });

  let raw = '';
  for await (const chunk of stream) {
    raw += chunk.choices[0]?.delta?.content ?? '';
  }
  return raw
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

// ── Main entry ───────────────────────────────────────────────────
export async function generateDemo(sessionId: string, modelId?: string, d1?: D1Database): Promise<void> {
  const db = getDb(d1);
  await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));

  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!session?.planJson) throw new Error('No plan found');

    const plan = JSON.parse(session.planJson);
    const productType = detectProductType(plan);
    const locale = session.locale as 'en' | 'zh';

    const { client, model } = await getAIClient(modelId, d1);
    console.log(`[demo-gen] start sessionId=${sessionId} model=${model}`);

    const html = await buildHtml(plan, productType, locale, client, model);

    if (!html || html.length < 200 || !html.includes('<!DOCTYPE')) {
      throw new Error(`Invalid HTML generated (length=${html.length})`);
    }

    console.log(`[demo-gen] done sessionId=${sessionId} htmlLen=${html.length}`);

    await db.update(sessions).set({
      demoStatus: 'ready',
      demoHtml: html,
      productType,
    }).where(eq(sessions.id, sessionId));

  } catch (err: any) {
    console.error('[demo-gen] failed:', err?.message ?? err);
    await db.update(sessions).set({ demoStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}

// ── Iterate existing demo ────────────────────────────────────────
export async function iterateDemo(sessionId: string, instruction: string, currentHtml: string, d1?: D1Database): Promise<void> {
  const db = getDb(d1);
  await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));
  try {
    const { client, model } = await getAIClient(undefined, d1);
    console.log(`[demo-iter] start sessionId=${sessionId}`);

    const prompt = `修改以下HTML Demo，执行用户指令：${instruction}

只输出修改后的完整HTML，从<!DOCTYPE html>开始，不加说明，不用markdown代码块。

当前HTML（前8000字符）：
${currentHtml.slice(0, 8000)}`;

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3500,
      stream: true,
    });
    let raw = '';
    for await (const chunk of stream) {
      raw += chunk.choices[0]?.delta?.content ?? '';
    }
    const cleanHtml = raw
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    if (!cleanHtml || cleanHtml.length < 200) throw new Error('Empty iteration result');

    console.log(`[demo-iter] done sessionId=${sessionId} htmlLen=${cleanHtml.length}`);
    await db.update(sessions).set({ demoStatus: 'ready', demoHtml: cleanHtml }).where(eq(sessions.id, sessionId));
  } catch (err: any) {
    console.error('[demo-iter] failed:', err?.message ?? err);
    await db.update(sessions).set({ demoStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}
