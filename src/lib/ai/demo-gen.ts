import OpenAI from 'openai';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAIClient } from '$lib/ai/client';

// ── Detect product type from plan ───────────────────────────────
export function detectProductType(plan: any, locale: string): string {
  const text = JSON.stringify(plan).toLowerCase();
  if (text.includes('小程序') || text.includes('wechat mini') || text.includes('miniprogram')) return 'wechat';
  if (text.includes('mobile') || text.includes('app') || text.includes('移动') || text.includes('手机')) return 'mobile';
  if (text.includes('marketplace') || text.includes('平台') || text.includes('撮合')) return 'marketplace';
  if (text.includes('ai') || text.includes('agent') || text.includes('chatbot')) return 'ai_tool';
  return 'saas';
}

// ── Generate PRD ─────────────────────────────────────────────────
async function generatePRD(plan: any, locale: string, client: OpenAI, model: string): Promise<string> {
  const isZh = locale === 'zh';
  const prompt = isZh
    ? `根据以下 MVP 方案，生成一份简洁的产品需求文档（PRD）。

方案：
${JSON.stringify(plan, null, 2)}

PRD 格式（markdown）：
# 产品名称

## 一句话定位

## 核心用户故事（3-5条）
- 作为 [用户]，我想要 [功能]，以便 [价值]

## 核心功能模块
每个模块：名称、说明、包含的页面/交互

## 页面清单
列出所有需要的页面/屏幕，每个页面的核心内容

## 数据结构（简化）
关键实体和字段

要求：简洁，只写 MVP 范围内的内容，不超过 500 字。`
    : `Based on this MVP plan, write a concise PRD.

Plan:
${JSON.stringify(plan, null, 2)}

PRD format (markdown):
# Product Name

## One-liner

## Core User Stories (3-5)
- As a [user], I want to [feature] so that [value]

## Core Feature Modules
Each: name, description, pages/interactions included

## Page List
All screens needed with core content per screen

## Data Model (simplified)
Key entities and fields

Keep it concise, MVP scope only, under 500 words.`;

  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 1200,
  });
  return resp.choices[0].message.content ?? '';
}

// ── Generate Demo HTML ───────────────────────────────────────────
async function generateDemoHTML(
  plan: any,
  prd: string,
  productType: string,
  locale: string,
  client: OpenAI,
  model: string
): Promise<string> {
  const isZh = locale === 'zh';
  const isWechat = productType === 'wechat';
  const isMobile = productType === 'mobile' || isWechat;

  const frameDesc = isWechat
    ? '微信小程序风格（顶部导航栏 + 底部 TabBar，白色背景，微信设计规范）'
    : isMobile
    ? '移动 App 风格（iOS/Android 风格，375px 宽）'
    : 'Web SaaS 风格（桌面端，响应式）';

  const prompt = `你是一个专业的前端开发者。根据以下 PRD，生成一个**完整可运行的单文件 HTML Demo**。

## PRD
${prd}

## MVP 方案摘要
问题：${plan.problem}
核心功能：${plan.features?.join('、')}

## 要求

### 技术要求
- 单个 HTML 文件，内联所有 CSS 和 JavaScript
- 不依赖任何外部资源（无 CDN、无图片 URL）
- 使用 Tailwind CSS CDN（唯一允许的外部资源）
- 用原生 JavaScript（无框架）
- 响应式，针对 ${frameDesc}

### 内容要求
- 实现所有 PRD 中列出的页面，用 tab/button 切换
- 所有数据用假数据（张三、李四、王五等中文名；或 Alice、Bob、Charlie）
- 用户登录直接默认已登录（显示"张三"已登录），无需真实登录
- 所有按钮/操作都要有合理的反馈（弹窗、状态变化、列表更新等）
- 界面要**接近真实产品**的视觉效果，不能只是占位符
${isWechat ? `- 模拟微信小程序 UI：顶部固定导航栏（显示页面标题），底部 TabBar，页面内容区域滚动
- 配色参考微信风格：主色 #07c160（绿色），白色背景，灰色边框
- TabBar 图标用 emoji 替代` : ''}

### 交互要求
- 核心操作流程必须可以完整走通（比如：创建→查看→操作→反馈）
- 状态用 JavaScript 变量维护，操作后 DOM 更新
- 有加载状态动画（模拟 AI 处理等）

### 输出
只输出完整 HTML，从 <!DOCTYPE html> 开始，到 </html> 结束。
不要输出任何解释文字，不要用 markdown 代码块包裹。`;

  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 6000,
  });
  return resp.choices[0].message.content ?? '';
}

// ── Main entry — called async after confirm ──────────────────────
export async function generateDemo(sessionId: string, modelId?: string): Promise<void> {
  // Mark as generating
  await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));

  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!session?.planJson) throw new Error('No plan found');

    const plan = JSON.parse(session.planJson);
    const locale = session.locale as 'en' | 'zh';
    const productType = detectProductType(plan, locale);

    const { client, model } = await getAIClient(modelId);

    // Step 1: PRD
    const prd = await generatePRD(plan, locale, client, model);

    // Step 2: Demo HTML
    const html = await generateDemoHTML(plan, prd, productType, locale, client, model);

    // Clean up — remove any markdown wrapping
    const cleanHtml = html
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    await db.update(sessions).set({
      demoStatus: 'ready',
      demoHtml: cleanHtml,
      prdMarkdown: prd,
      productType,
    }).where(eq(sessions.id, sessionId));

  } catch (err) {
    console.error('[demo-gen] failed:', err);
    await db.update(sessions).set({ demoStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}

// ── Iterate existing demo ─────────────────────────────────────────
export async function iterateDemo(
  sessionId: string,
  instruction: string,
  currentHtml: string
): Promise<void> {
  await db.update(sessions).set({ demoStatus: 'generating' }).where(eq(sessions.id, sessionId));
  try {
    const { client, model } = await getAIClient();
    const prompt = `You are given an existing HTML demo and a user instruction to modify it.

User instruction: ${instruction}

Apply the instruction to the HTML. Return ONLY the complete modified HTML file from <!DOCTYPE html> to </html>. No explanations, no markdown fences.

Current HTML:
${currentHtml.slice(0, 12000)}`;

    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 6000,
    });

    const raw = resp.choices[0].message.content ?? '';
    const cleanHtml = raw
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    await db.update(sessions)
      .set({ demoStatus: 'ready', demoHtml: cleanHtml })
      .where(eq(sessions.id, sessionId));
  } catch (err) {
    console.error('[demo-iter] failed:', err);
    await db.update(sessions).set({ demoStatus: 'failed' }).where(eq(sessions.id, sessionId));
  }
}
