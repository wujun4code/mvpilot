export function getSystemPrompt(locale: 'en' | 'zh'): string {
  if (locale === 'zh') return SYSTEM_ZH;
  return SYSTEM_EN;
}

// ─── Flow animation templates ─────────────────────────────────────────────────
// AI inlines these when it has enough context to show a visual flow.
// Each is a self-contained inline SVG/CSS animation rendered inside the chat bubble.

export const FLOW_TEMPLATES: Record<string, { label_en: string; label_zh: string; html: string }> = {
  saas: {
    label_en: 'SaaS / Web Tool',
    label_zh: 'SaaS / Web 工具',
    html: `<div class="flow-anim" style="font-family:system-ui;padding:16px 0;overflow:hidden">
  <style>
    .fa-step{display:flex;align-items:center;gap:10px;margin:6px 0;opacity:0;transform:translateX(-16px);transition:opacity .4s,transform .4s}
    .fa-step.show{opacity:1;transform:none}
    .fa-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
    .fa-line{width:2px;height:18px;background:rgba(124,108,250,.3);margin-left:13px}
    .fa-text{font-size:13px;line-height:1.4}
    .fa-sub{font-size:11px;color:#888899;margin-top:2px}
  </style>
  <div class="fa-step" data-i="0"><div class="fa-dot" style="background:rgba(124,108,250,.2);color:#7c6cfa">💡</div><div class="fa-text"><div>用户发现痛点</div><div class="fa-sub">Pain → Problem</div></div></div>
  <div class="fa-line"></div>
  <div class="fa-step" data-i="1"><div class="fa-dot" style="background:rgba(74,222,128,.15);color:#4ade80">🔍</div><div class="fa-text"><div>搜索 / 注册 / 试用</div><div class="fa-sub">Acquisition</div></div></div>
  <div class="fa-line"></div>
  <div class="fa-step" data-i="2"><div class="fa-dot" style="background:rgba(251,191,36,.15);color:#fbbf24">⚡</div><div class="fa-text"><div>完成核心任务（Aha moment）</div><div class="fa-sub">Activation</div></div></div>
  <div class="fa-line"></div>
  <div class="fa-step" data-i="3"><div class="fa-dot" style="background:rgba(244,114,182,.15);color:#f472b6">🔄</div><div class="fa-text"><div>重复使用 → 留存</div><div class="fa-sub">Retention</div></div></div>
  <div class="fa-line"></div>
  <div class="fa-step" data-i="4"><div class="fa-dot" style="background:rgba(124,108,250,.2);color:#7c6cfa">💰</div><div class="fa-text"><div>升级付费</div><div class="fa-sub">Revenue</div></div></div>
  <script>
    (function(){var steps=document.querySelectorAll('.fa-step');var i=0;function next(){if(i<steps.length){steps[i].classList.add('show');i++;setTimeout(next,350)}}setTimeout(next,200)})();
  </script>
</div>`,
  },
  mobile: {
    label_en: 'Mobile App',
    label_zh: '移动 App',
    html: `<div class="flow-anim" style="font-family:system-ui;padding:16px 0">
  <style>
    .fa2-step{display:flex;align-items:center;gap:10px;margin:6px 0;opacity:0;transform:translateY(12px);transition:opacity .4s,transform .4s}
    .fa2-step.show{opacity:1;transform:none}
    .fa2-dot{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
    .fa2-line{width:2px;height:14px;background:rgba(124,108,250,.25);margin-left:13px}
    .fa2-text{font-size:13px;line-height:1.4}
    .fa2-sub{font-size:11px;color:#888899}
  </style>
  <div class="fa2-step" data-i="0"><div class="fa2-dot" style="background:rgba(251,191,36,.15);color:#fbbf24">📱</div><div class="fa2-text"><div>下载 / 打开</div><div class="fa2-sub">Store → Install</div></div></div>
  <div class="fa2-line"></div>
  <div class="fa2-step" data-i="1"><div class="fa2-dot" style="background:rgba(124,108,250,.2);color:#7c6cfa">✨</div><div class="fa2-text"><div>Onboarding — 3 步上手</div><div class="fa2-sub">First-run experience</div></div></div>
  <div class="fa2-line"></div>
  <div class="fa2-step" data-i="2"><div class="fa2-dot" style="background:rgba(74,222,128,.15);color:#4ade80">🎯</div><div class="fa2-text"><div>完成第一个核心操作</div><div class="fa2-sub">Core loop</div></div></div>
  <div class="fa2-line"></div>
  <div class="fa2-step" data-i="3"><div class="fa2-dot" style="background:rgba(244,114,182,.15);color:#f472b6">🔔</div><div class="fa2-text"><div>Push 通知召回</div><div class="fa2-sub">Re-engagement</div></div></div>
  <div class="fa2-line"></div>
  <div class="fa2-step" data-i="4"><div class="fa2-dot" style="background:rgba(124,108,250,.2);color:#7c6cfa">⭐</div><div class="fa2-text"><div>分享 / 评分 / 口碑传播</div><div class="fa2-sub">Referral</div></div></div>
  <script>
    (function(){var steps=document.querySelectorAll('.fa2-step');var i=0;function next(){if(i<steps.length){steps[i].classList.add('show');i++;setTimeout(next,350)}}setTimeout(next,200)})();
  </script>
</div>`,
  },
  marketplace: {
    label_en: 'Marketplace / Platform',
    label_zh: '平台 / 市场',
    html: `<div class="flow-anim" style="font-family:system-ui;padding:16px 0">
  <style>
    .fa3-row{display:flex;gap:10px;margin:8px 0;opacity:0;transform:translateY(10px);transition:opacity .4s,transform .4s}
    .fa3-row.show{opacity:1;transform:none}
    .fa3-side{width:80px;font-size:11px;text-align:center;padding:6px 4px;border-radius:8px;flex-shrink:0}
    .fa3-arrow{font-size:16px;line-height:32px;color:#666677}
    .fa3-label{font-size:12px;color:#888899;line-height:1.4;padding-top:4px}
  </style>
  <div class="fa3-row" data-i="0">
    <div class="fa3-side" style="background:rgba(124,108,250,.15);color:#7c6cfa">供给方<br/>Seller</div>
    <div style="flex:1;text-align:center">
      <div style="font-size:12px;color:#f0f0f5;padding:6px 8px;background:#1e1e2e;border-radius:8px">发布 / 提供服务</div>
      <div class="fa3-label">供给冷启动</div>
    </div>
  </div>
  <div class="fa3-row" data-i="1">
    <div class="fa3-side" style="background:rgba(74,222,128,.12);color:#4ade80">需求方<br/>Buyer</div>
    <div style="flex:1;text-align:center">
      <div style="font-size:12px;color:#f0f0f5;padding:6px 8px;background:#1e1e2e;border-radius:8px">搜索 / 匹配 / 下单</div>
      <div class="fa3-label">获客与转化</div>
    </div>
  </div>
  <div class="fa3-row" data-i="2">
    <div class="fa3-side" style="background:rgba(251,191,36,.12);color:#fbbf24">平台<br/>Platform</div>
    <div style="flex:1;text-align:center">
      <div style="font-size:12px;color:#f0f0f5;padding:6px 8px;background:#1e1e2e;border-radius:8px">撮合 + 抽佣 + 信用</div>
      <div class="fa3-label">平台飞轮</div>
    </div>
  </div>
  <div class="fa3-row" data-i="3">
    <div class="fa3-side" style="background:rgba(244,114,182,.12);color:#f472b6">双方<br/>Both</div>
    <div style="flex:1;text-align:center">
      <div style="font-size:12px;color:#f0f0f5;padding:6px 8px;background:#1e1e2e;border-radius:8px">评价 → 信任 → 增长</div>
      <div class="fa3-label">网络效应</div>
    </div>
  </div>
  <script>
    (function(){var rows=document.querySelectorAll('.fa3-row');var i=0;function next(){if(i<rows.length){rows[i].classList.add('show');i++;setTimeout(next,400)}}setTimeout(next,200)})();
  </script>
</div>`,
  },
  ai_tool: {
    label_en: 'AI Tool / Agent',
    label_zh: 'AI 工具 / Agent',
    html: `<div class="flow-anim" style="font-family:system-ui;padding:16px 0">
  <style>
    .fa4-step{display:flex;align-items:flex-start;gap:10px;margin:8px 0;opacity:0;transform:translateX(-12px);transition:opacity .35s,transform .35s}
    .fa4-step.show{opacity:1;transform:none}
    .fa4-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:1px}
    .fa4-body{flex:1}
    .fa4-title{font-size:13px;font-weight:600;color:#f0f0f5}
    .fa4-desc{font-size:11px;color:#888899;margin-top:2px}
    .fa4-conn{display:flex;align-items:center;gap:6px;margin:2px 0 2px 40px;font-size:11px;color:#444455}
  </style>
  <div class="fa4-step" data-i="0"><div class="fa4-icon" style="background:rgba(124,108,250,.2)">🧠</div><div class="fa4-body"><div class="fa4-title">用户输入 → 意图理解</div><div class="fa4-desc">NLP / Embedding / Routing</div></div></div>
  <div class="fa4-conn">↓ 分类路由</div>
  <div class="fa4-step" data-i="1"><div class="fa4-icon" style="background:rgba(74,222,128,.15)">⚙️</div><div class="fa4-body"><div class="fa4-title">调用工具 / 检索知识</div><div class="fa4-desc">RAG / Function Call / API</div></div></div>
  <div class="fa4-conn">↓ 生成结果</div>
  <div class="fa4-step" data-i="2"><div class="fa4-icon" style="background:rgba(251,191,36,.15)">✨</div><div class="fa4-body"><div class="fa4-title">输出答案 / 执行动作</div><div class="fa4-desc">Streaming / Structured Output</div></div></div>
  <div class="fa4-conn">↓ 反馈学习</div>
  <div class="fa4-step" data-i="3"><div class="fa4-icon" style="background:rgba(244,114,182,.15)">📈</div><div class="fa4-body"><div class="fa4-title">用户反馈 → 模型迭代</div><div class="fa4-desc">RLHF / Fine-tune / Prompt opt</div></div></div>
  <script>
    (function(){var steps=document.querySelectorAll('.fa4-step');var i=0;function next(){if(i<steps.length){steps[i].classList.add('show');i++;setTimeout(next,380)}}setTimeout(next,150)})();
  </script>
</div>`,
  },
};

const BLOCKS_INSTRUCTION_EN = `
## Output Blocks (REQUIRED FORMAT)

Every response must include exactly these blocks at the end, in this order:

### 1. Quick Replies (always required except when asking for contact info)
Provide 2-4 tappable options relevant to your question. Max 25 chars each.
\`\`\`quick-replies
["option 1", "option 2", "option 3"]
\`\`\`

### 2. Flow Animation (situational)
When you've identified the product type (after 1-2 exchanges), include ONE of these keys to show a relevant flow visualization:
- \`saas\` → for web tools, SaaS, subscription products
- \`mobile\` → for mobile apps
- \`marketplace\` → for 2-sided platforms, marketplaces
- \`ai_tool\` → for AI tools, agents, chatbots

Output as:
\`\`\`flow-animation
saas
\`\`\`

Only include flow-animation ONCE — when you first identify the product type. Do NOT repeat it in subsequent messages.
`;

const BLOCKS_INSTRUCTION_ZH = `
## 输出块（必须格式）

每条回复末尾必须按以下顺序包含这些块：

### 1. 快捷回复（除询问联系方式外，始终必须）
提供 2-4 个与你问题相关的可点击选项，每个不超过 15 字。
\`\`\`quick-replies
["选项1", "选项2", "选项3"]
\`\`\`

### 2. 流程动画（按情况）
当你识别出产品类型后（1-2 轮对话后），输出一个流程动画键，帮助用户直观理解产品的核心流程：
- \`saas\` → Web 工具、SaaS、订阅产品
- \`mobile\` → 移动 App
- \`marketplace\` → 双边平台、市场、撮合类
- \`ai_tool\` → AI 工具、Agent、对话机器人

格式：
\`\`\`flow-animation
saas
\`\`\`

流程动画只输出一次——在你第一次识别产品类型时。后续消息不再重复。
`;

const SYSTEM_EN = `You are MVPilot, an expert product advisor helping indie hackers and solo developers scope their MVP.

Your job: guide users from a vague idea to a clear MVP plan through structured conversation.

## Stages
1. **EXPLORING** — understand the raw idea
2. **SCOPING** — define user, pain, alternatives  
3. **VALIDATING** — challenge assumptions, surface risks
4. **PROPOSING** — output structured MVP plan

## Rules
- Ask ONE question per message
- Be direct. Challenge vague answers
- Redirect scope creep ("that's v2 — let's park it")
- Be honest about risks
- Keep message text under 80 words (excluding blocks)
- After ~7 exchanges, move to PROPOSING

## MVP Plan Format
\`\`\`mvp-plan
{
  "problem": "one sentence — who has what pain",
  "user": "specific target user",
  "features": ["feature 1", "feature 2", "feature 3"],
  "outOfScope": ["thing 1", "thing 2"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "firstAction": "single most important next step"
}
\`\`\`

After the plan block, ask if it captures their vision. Include quick-replies: ["Looks good, let's go!", "I want to adjust something", "Start over"].

When user confirms, say: "Great! I'll notify the founder now. Please leave your contact info (email or WeChat) so they can reach you." — then NO quick-replies.

${BLOCKS_INSTRUCTION_EN}`;

const SYSTEM_ZH = `你是 MVPilot，专注于帮助独立开发者和创业者梳理 MVP 的产品顾问。

你的任务：通过结构化对话，引导用户从模糊想法走到清晰可执行的 MVP 方案。

## 阶段
1. **探索** — 了解原始想法
2. **聚焦** — 明确用户、痛点、替代方案
3. **质疑** — 挑战假设，识别风险
4. **输出** — 结构化 MVP 方案

## 规则
- 每条消息只问一个问题
- 直接具体，对模糊回答追问
- 遇到功能蔓延说："这是 v2 的事，先搁置"
- 对风险诚实
- 消息正文不超过 80 字（不含块）
- 约 7 轮后进入输出阶段

## MVP 方案格式
\`\`\`mvp-plan
{
  "problem": "一句话——谁有什么痛点",
  "user": "具体目标用户",
  "features": ["功能 1", "功能 2", "功能 3"],
  "outOfScope": ["不做 1", "不做 2"],
  "risks": ["风险 1", "风险 2", "风险 3"],
  "firstAction": "最重要的下一步"
}
\`\`\`

输出方案后问用户是否符合预期，快捷回复固定为：["就这样，开始吧！", "我想调整一下", "重新开始"]。

用户确认方案后说："太好了！我来通知创始人，你已经准备好推进了。请留下你的联系方式（邮箱或微信），他会主动联系你。" — 之后不加快捷回复。

${BLOCKS_INSTRUCTION_ZH}`;

export const OPENING_MESSAGE_EN = `Hey! I'm MVPilot 👋

Tell me about your idea — rough is totally fine. What are you thinking of building?`;

export const OPENING_MESSAGE_ZH = `你好！我是 MVPilot 👋

跟我说说你的想法吧，哪怕很粗糙也没关系。你想做什么？`;

export const OPENING_QUICK_REPLIES_EN = [
  'A mobile app',
  'A web tool / SaaS',
  'An AI product',
  'A marketplace',
];

export const OPENING_QUICK_REPLIES_ZH = [
  '移动 App',
  'Web 工具 / SaaS',
  'AI 产品',
  '平台 / 市场',
];
