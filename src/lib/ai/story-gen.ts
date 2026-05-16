import { getDb } from '$lib/db';
import { sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';

interface Scene {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  visual: string; // description for AI to render as SVG/animation
  duration: number; // seconds
}

interface Storyboard {
  productName: string;
  tagline: string;
  scenes: Scene[];
}

async function generateStoryboard(plan: any, locale: string, d1?: D1Database): Promise<Storyboard> {
  const isZh = locale === 'zh';
  const { client, model } = await getAIClient(undefined, d1);

  const prompt = isZh ? `
基于以下 MVP 方案，生成一份投资人/团队沟通用的 Pitch Story 大纲（JSON 格式）。

MVP 方案：
问题：${plan.problem}
目标用户：${plan.user}
核心功能：${(plan.features || []).join('、')}
主要风险：${(plan.risks || []).join('、')}
第一步行动：${plan.firstAction}

输出严格的 JSON，格式如下：
{
  "productName": "产品名称（2-4字）",
  "tagline": "一句话 slogan",
  "scenes": [
    { "id": 1, "title": "标题", "subtitle": "副标题", "content": "正文（1-2句话，简练）", "visual": "视觉元素描述（如：展示一个困惑的用户、流程图、数据图表）", "duration": 6 }
  ]
}

包含以下 6 个场景：
1. Hook - 引发共鸣的痛点
2. Problem - 现状与痛点细化
3. Solution - 产品如何解决
4. How it works - 核心流程（3步）
5. Traction / Why now - 市场时机
6. Call to Action - 下一步

每个场景 duration 4-8 秒。只输出 JSON，不加任何说明。` : `
Based on this MVP plan, create a Pitch Story storyboard (JSON).

Plan:
Problem: ${plan.problem}
User: ${plan.user}
Features: ${(plan.features || []).join(', ')}
Risks: ${(plan.risks || []).join(', ')}
First action: ${plan.firstAction}

Output strict JSON:
{
  "productName": "Short product name",
  "tagline": "One-line slogan",
  "scenes": [
    { "id": 1, "title": "Title", "subtitle": "Subtitle", "content": "Body (1-2 sentences)", "visual": "Visual description", "duration": 6 }
  ]
}

6 scenes: Hook, Problem, Solution, How it works, Traction/Why now, CTA.
Duration 4-8s each. Output JSON only.`;

  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    stream: true,
  });

  let raw = '';
  for await (const chunk of stream) raw += chunk.choices[0]?.delta?.content ?? '';

  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(clean) as Storyboard;
}

async function generateStoryHTML(storyboard: Storyboard, plan: any, locale: string, d1?: D1Database): Promise<string> {
  const { client, model } = await getAIClient(undefined, d1);
  const isZh = locale === 'zh';

  const scenesJson = JSON.stringify(storyboard.scenes, null, 2);

  const prompt = `你是一个专业的前端开发者，擅长制作视觉震撼的 HTML 演示。

生成一个**完整可运行的单文件 HTML Pitch Deck**，基于以下 storyboard。

产品：${storyboard.productName}
Slogan：${storyboard.tagline}

Scenes：
${scenesJson}

技术要求：
- 单文件 HTML，所有 CSS/JS 内联，**禁止任何外部资源**（无 CDN、无外链、无 Google Fonts）
- 全屏幻灯片效果，每页铺满屏幕
- 深色主题（背景 #0a0a0f），渐变紫色主色调（#7c6cfa → #c084fc）
- 每个场景是一个全屏 slide，支持点击/键盘切换
- 每个 slide 有入场动画（fade + slide up）
- 底部显示进度条和 slide 编号
- ${isZh ? '文字用中文' : 'Text in English'}
- 每个 slide 根据 visual 字段，用纯 CSS/SVG 生成对应的视觉元素（图表、流程图、图标等），**每个 slide 都要有丰富的 SVG 可视元素**
- **不要用占位符，要真实渲染内容，每个slide占满可视区域**
- 最后一页（CTA）加一个"联系我们"大按钮

输出要求：
- 只输出 HTML，从 <!DOCTYPE html> 到 </html>
- 不加任何说明文字，不用 markdown 代码块
- CSS 精简，总代码量控制在 800 行以内`;

  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 12000,
    stream: true,
  });

  let raw = '';
  for await (const chunk of stream) raw += chunk.choices[0]?.delta?.content ?? '';

  return raw
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export async function generateStory(sessionId: string, d1?: D1Database): Promise<void> {
  const db = getDb(d1);
  await db.update(sessions).set({ storyStatus: 'generating' }).where(eq(sessions.id, sessionId));

  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!session?.planJson) throw new Error('No plan found');

    const plan = JSON.parse(session.planJson);
    const locale = session.locale as 'en' | 'zh';

    console.log(`[story-gen] start sessionId=${sessionId}`);

    const storyboard = await generateStoryboard(plan, locale, d1);
    console.log(`[story-gen] storyboard ready: ${storyboard.scenes.length} scenes`);

    const html = await generateStoryHTML(storyboard, plan, locale, d1);

    if (!html || html.length < 500 || !html.includes('<!DOCTYPE')) {
      throw new Error(`Invalid story HTML (length=${html.length})`);
    }

    console.log(`[story-gen] done sessionId=${sessionId} htmlLen=${html.length}`);

    await db.update(sessions).set({
      storyStatus: 'ready',
      storyHtml: html,
    }).where(eq(sessions.id, sessionId));

  } catch (err: any) {
    console.error('[story-gen] failed:', err?.message ?? err);
    await db.update(sessions).set({ storyStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}

// ── Iterate existing story ────────────────────────────────────────
export async function iterateStory(sessionId: string, instruction: string, currentHtml: string, d1?: D1Database): Promise<void> {
  const db = getDb(d1);
  await db.update(sessions).set({ storyStatus: 'generating' }).where(eq(sessions.id, sessionId));
  try {
    const { client, model } = await getAIClient(undefined, d1);
    console.log(`[story-iter] start sessionId=${sessionId}`);

    const prompt = `修改以下 Pitch Story HTML，执行用户指令：${instruction}

只输出修改后的完整HTML，从<!DOCTYPE html>开始，不加说明，不用markdown代码块。HTML必须以</html>结束，确保JS交互代码完整。

当前HTML（前20000字符）：
${currentHtml.slice(0, 20000)}`;

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 12000,
      stream: true,
    });
    let raw = '';
    for await (const chunk of stream) {
      raw += chunk.choices[0]?.delta?.content ?? '';
    }
    let cleanHtml = raw
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Truncation recovery
    if (cleanHtml.length > 100 && !cleanHtml.endsWith('</html>')) {
      console.log(`[story-iter] output truncated at ${cleanHtml.length} chars, continuing...`);
      const tailContext = cleanHtml.slice(-3000);
      const continuePrompt = `The HTML above was cut off mid-generation. Continue from where it stopped and finish the remaining HTML. Return ONLY the missing parts. Final must end with </html>.\n\nLast ~3000 chars:\n${tailContext}`;
      const stream2 = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: continuePrompt }],
        max_tokens: 6000,
        stream: true,
      });
      let cont = '';
      for await (const chunk of stream2) {
        cont += chunk.choices[0]?.delta?.content ?? '';
      }
      cleanHtml += cont
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    }

    if (!cleanHtml || cleanHtml.length < 500) throw new Error('Empty iteration result');

    console.log(`[story-iter] done sessionId=${sessionId} htmlLen=${cleanHtml.length}`);
    await db.update(sessions).set({ storyStatus: 'ready', storyHtml: cleanHtml }).where(eq(sessions.id, sessionId));
  } catch (err: any) {
    console.error('[story-iter] failed:', err?.message ?? err);
    await db.update(sessions).set({ storyStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}
