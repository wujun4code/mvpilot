<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { PageData } from './$types';
  import {
    OPENING_MESSAGE_EN, OPENING_MESSAGE_ZH,
    OPENING_QUICK_REPLIES_EN, OPENING_QUICK_REPLIES_ZH,
    FLOW_TEMPLATES,
  } from '$lib/ai/prompts';
  import { parseMvpPlan, parseQuickReplies, parseFlowAnimation, stripBlocks } from '$lib/utils';

  let { data }: { data: PageData } = $props();

  type Msg = {
    role: 'user' | 'assistant';
    content: string;
    id?: string;
    quickReplies?: string[];
    flowKey?: string | null;
  };
  type AIModel = { id: string; name: string; isDefault: boolean };

  const locale = (data.session?.locale ?? 'en') as 'en' | 'zh';
  const sessionId = data.sessionId;

  let messages = $state<Msg[]>([]);
  let input = $state('');
  let loading = $state(false);
  let streamingContent = $state('');
  let scrollEl = $state<HTMLDivElement>();
  let inputEl = $state<HTMLTextAreaElement>();
  let showContactForm = $state(false);
  let contactEmail = $state('');
  let contactWechat = $state('');
  let confirmed = $state(false); // plan confirmed, demo generating/ready
  let submitted = $state(false); // contact submitted

  let models = $state<AIModel[]>([]);
  let selectedModelId = $state<string | null>(null);
  let showModelPicker = $state(false);

  const t = {
    en: {
      placeholder: 'Or type your own message…',
      send: 'Send',
      thinking: 'Thinking…',
      planTitle: '📋 Your MVP Plan',
      confirmBtn: 'Looks good, let\'s go! →',
      contactTitle: '🎉 Ready to move forward!',
      contactSub: 'Leave your contact and the founder will reach out.',
      emailLabel: 'Email',
      wechatLabel: 'WeChat',
      submitBtn: 'Notify the founder →',
      doneTitle: '🎉 Done!',
      doneMsg: 'The founder has been notified and will reach out shortly.',
      backBtn: '← Start a new conversation',
      modelLabel: 'Model',
      flowLabel: { saas: 'SaaS Flow', mobile: 'App Flow', marketplace: 'Platform Flow', ai_tool: 'AI Tool Flow' } as Record<string, string>,
    },
    zh: {
      placeholder: '或者直接输入…',
      send: '发送',
      thinking: '思考中…',
      planTitle: '📋 你的 MVP 方案',
      confirmBtn: '就这样，开始吧！→',
      contactTitle: '🎉 准备好推进了！',
      contactSub: '留下联系方式，创始人会主动联系你。',
      emailLabel: '邮箱',
      wechatLabel: '微信',
      submitBtn: '通知创始人 →',
      doneTitle: '🎉 搞定！',
      doneMsg: '创始人已收到通知，马上联系你。',
      backBtn: '← 重新开始',
      modelLabel: '模型',
      flowLabel: { saas: 'SaaS 流程', mobile: 'App 流程', marketplace: '平台流程', ai_tool: 'AI 工具流程' } as Record<string, string>,
    },
  };
  const c = t[locale];

  const selectedModelName = $derived(models.find((m) => m.id === selectedModelId)?.name ?? '');

  onMount(async () => {
    const res = await fetch('/api/models');
    if (res.ok) {
      models = await res.json();
      selectedModelId = models.find((m) => m.isDefault)?.id ?? models[0]?.id ?? null;
    }

    if (data.messages && data.messages.length > 0) {
      messages = data.messages
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
          ...m,
          quickReplies: m.role === 'assistant' ? parseQuickReplies(m.content) : [],
          flowKey: m.role === 'assistant' ? parseFlowAnimation(m.content) : null,
        }));
    } else {
      const opening = locale === 'zh' ? OPENING_MESSAGE_ZH : OPENING_MESSAGE_EN;
      const qr = locale === 'zh' ? OPENING_QUICK_REPLIES_ZH : OPENING_QUICK_REPLIES_EN;
      messages = [{ role: 'assistant', content: opening, quickReplies: qr, flowKey: null }];
    }

    // Check if demo already saved/generated
    const summaryRes = await fetch(`/api/session/${sessionId}/summary`);
    if (summaryRes.ok) {
      const s = await summaryRes.json();
      if (s.savedAt) savedDemo = { savedAt: s.savedAt, storyStatus: s.storyStatus };
      if (s.demoStatus === 'ready' || s.demoStatus === 'generating') demoStatus = s.demoStatus;
      if (s.demoStatus === 'generating') demoPollTimer = setInterval(pollDemoStatus, 3000);
    }

    await scrollToBottom();
    inputEl?.focus();
  });

  async function scrollToBottom() {
    await tick();
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  }

  const CONFIRM_PHRASES = [
    '就这样，开始吧', "looks good, let's go", 'let\'s do it', '开始吧', 'confirm', '确认'
  ];

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // If user confirms the plan, trigger demo generation directly (no contact form yet)
    const hasPlan = messages.some((m) => m.role === 'assistant' && parseMvpPlan(m.content) !== null);
    if (hasPlan && !confirmed && CONFIRM_PHRASES.some((p) => trimmed.toLowerCase().includes(p.toLowerCase()))) {
      messages = [...messages, { role: 'user', content: trimmed }];
      confirmed = true;
      demoStatus = 'generating';
      // Fire demo generation (no contact needed yet)
      await fetch('/api/confirm-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      demoPollTimer = setInterval(pollDemoStatus, 3000);
      await scrollToBottom();
      return;
    }
    input = '';
    // Silence chips on previous last message
    messages = messages.map((m, i) =>
      i === messages.length - 1 && m.role === 'assistant'
        ? { ...m, quickReplies: [] }
        : m
    );
    messages = [...messages, { role: 'user', content: trimmed }];
    loading = true;
    streamingContent = '';
    await scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content: trimmed, modelId: selectedModelId }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.delta) {
              fullContent += json.delta;
              streamingContent = fullContent;
              await scrollToBottom();
            }
            if (json.done) {
              streamingContent = '';
              messages = [
                ...messages,
                {
                  role: 'assistant',
                  content: fullContent,
                  id: json.msgId,
                  quickReplies: parseQuickReplies(fullContent),
                  flowKey: parseFlowAnimation(fullContent),
                },
              ];
            }
          } catch {}
        }
      }
    } catch {
      messages = [...messages, { role: 'assistant', content: '⚠️ Connection error. Please try again.', quickReplies: [], flowKey: null }];
    } finally {
      loading = false;
      await scrollToBottom();
      inputEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  let demoStatus = $state<string | null>(null);
  let demoPollTimer: ReturnType<typeof setInterval>;
  let savedDemo = $state<{ savedAt: string; storyStatus: string | null } | null>(null);

  async function pollDemoStatus() {
    const res = await fetch(`/api/demo/${sessionId}/status`);
    if (!res.ok) return;
    const data = await res.json();
    demoStatus = data.status;
    if (demoStatus === 'ready' || demoStatus === 'failed') {
      clearInterval(demoPollTimer);
    }
  }

  function openDemo() {
    window.location.assign(`/demo/${sessionId}`);
  }

  async function handleSubmitContact() {
    if (!contactEmail && !contactWechat) return;
    await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, contactEmail, contactWechat }),
    });
    submitted = true;
    showContactForm = false;
    // Start polling for demo
    demoStatus = 'generating';
    demoPollTimer = setInterval(pollDemoStatus, 3000);
    await scrollToBottom();
  }

  // Cleanup poll on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => clearInterval(demoPollTimer));

  function animateFlow(node: HTMLElement) {
    const steps = node.querySelectorAll<HTMLElement>('[data-i]');
    let i = 0;
    function next() {
      if (i < steps.length) {
        steps[i].classList.add('show');
        i++;
        setTimeout(next, 360);
      }
    }
    setTimeout(next, 200);
    return {};
  }

  function renderMsg(content: string) {
    return { plain: stripBlocks(content), plan: parseMvpPlan(content) };
  }
</script>

<svelte:head>
  <title>MVPilot</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">

  <!-- Header -->
  <header class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur z-20">
    <a href="/" class="font-extrabold text-base tracking-tight no-underline text-white">MVP<span class="text-[#7c6cfa]">ilot</span></a>
    <div class="flex items-center gap-2">
      {#if savedDemo}
        <a href="/demo/{sessionId}" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.05)] text-[#4ade80] text-xs font-medium no-underline transition-all hover:bg-[rgba(74,222,128,0.12)]">
          <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
          {locale === 'zh' ? '查看 Demo' : 'Demo'}
        </a>
        {#if savedDemo.storyStatus === 'ready'}
          <a href="/story/{sessionId}" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[rgba(124,108,250,0.3)] bg-[rgba(124,108,250,0.05)] text-[#7c6cfa] text-xs font-medium no-underline transition-all hover:bg-[rgba(124,108,250,0.12)]">
            📊 Pitch
          </a>
        {/if}
      {/if}
      <div class="relative">
      <button
        onclick={() => showModelPicker = !showModelPicker}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#13131a] hover:bg-[#1a1a28] transition-colors text-xs font-medium text-white/60 hover:text-white"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80] shrink-0"></span>
        {selectedModelName || c.modelLabel}
        <svg class="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {#if showModelPicker}
        <button class="fixed inset-0 z-10" onclick={() => showModelPicker = false}></button>
        <div class="absolute right-0 top-full mt-1.5 z-20 bg-[#1a1a28] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[190px]">
          {#each models as m}
            <button
              onclick={() => { selectedModelId = m.id; showModelPicker = false; }}
              class="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors hover:bg-white/5 {selectedModelId === m.id ? 'text-[#7c6cfa]' : 'text-white/60'}"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0 {selectedModelId === m.id ? 'bg-[#7c6cfa]' : 'bg-white/15'}"></span>
              {m.name}
              {#if selectedModelId === m.id}<svg class="w-3 h-3 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>{/if}
            </button>
          {/each}
        </div>
      {/if}
      </div>
    </div>
  </header>

  <!-- Messages -->
  <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-5 pb-4">
    <div class="max-w-2xl mx-auto space-y-4">

      {#each messages as msg, idx}
        <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">

          {#if msg.role === 'assistant'}
            {@const { plain, plan } = renderMsg(msg.content)}
            <div class="max-w-[90%] space-y-2.5" style="min-width:0">

              <!-- Text bubble -->
              {#if plain}
                <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {plain}
                </div>
              {/if}

              <!-- Flow animation card -->
              {#if msg.flowKey && FLOW_TEMPLATES[msg.flowKey]}
                {@const tpl = FLOW_TEMPLATES[msg.flowKey]}
                <div class="bg-[#13131a] border border-[rgba(124,108,250,0.2)] rounded-2xl overflow-hidden">
                  <div class="flex items-center gap-2 px-4 pt-3 pb-1">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-[#7c6cfa]">
                      {locale === 'zh' ? tpl.label_zh : tpl.label_en}
                    </span>
                  </div>
                  <div class="px-4 pb-3" use:animateFlow>
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html tpl.html}
                  </div>
                </div>
              {/if}

              <!-- MVP plan card -->
              {#if plan}
                {@const p = plan as any}
                <div class="bg-[#13131a] border border-[rgba(124,108,250,0.35)] rounded-2xl p-5 space-y-3">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-[#7c6cfa]">{c.planTitle}</p>
                  <div class="space-y-2.5 text-sm">
                    <div><p class="text-[11px] text-[#555566] mb-0.5">{locale==='zh'?'💬 问题':'💬 Problem'}</p><p class="text-white/90">{p.problem}</p></div>
                    <div><p class="text-[11px] text-[#555566] mb-0.5">{locale==='zh'?'👤 目标用户':'👤 Target User'}</p><p class="text-white/90">{p.user}</p></div>
                    <div>
                      <p class="text-[11px] text-[#555566] mb-1">{locale==='zh'?'✅ 核心功能':'✅ Features'}</p>
                      <ul class="space-y-1">{#each p.features as f}<li class="flex gap-2"><span class="text-[#4ade80] shrink-0">✓</span><span class="text-white/90">{f}</span></li>{/each}</ul>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#555566] mb-1">{locale==='zh'?'🚫 不做':'🚫 Out of Scope'}</p>
                      <ul class="space-y-1">{#each p.outOfScope as o}<li class="flex gap-2"><span class="text-[#333344] shrink-0">✗</span><span class="text-white/40">{o}</span></li>{/each}</ul>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#555566] mb-1">{locale==='zh'?'⚠️ 风险':'⚠️ Risks'}</p>
                      <ul class="space-y-1">{#each p.risks as r}<li class="flex gap-2"><span class="text-yellow-500 shrink-0">⚠</span><span class="text-white/80">{r}</span></li>{/each}</ul>
                    </div>
                    <div class="pt-2 border-t border-white/5">
                      <p class="text-[11px] text-[#555566] mb-0.5">{locale==='zh'?'🚀 第一步':'🚀 First Action'}</p>
                      <p class="text-[#7c6cfa] font-semibold">{p.firstAction}</p>
                    </div>
                  </div>
                  {#if !confirmed && !submitted}
                    <button
                      onclick={async () => {
                        messages = [...messages, { role: 'user', content: locale === 'zh' ? '就这样，开始吧！' : "Let's go!" }];
                        confirmed = true;
                        demoStatus = 'generating';
                        await fetch('/api/confirm-plan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionId }) });
                        demoPollTimer = setInterval(pollDemoStatus, 3000);
                        scrollToBottom();
                      }}
                      class="mt-1 w-full py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl text-sm transition-all cursor-pointer">
                      {c.confirmBtn}
                    </button>
                  {/if}
                </div>
              {/if}

              <!-- Quick reply chips — INSIDE the bubble area, below content -->
              {#if msg.quickReplies && msg.quickReplies.length > 0 && idx === messages.length - 1 && !loading && !submitted}
                <div class="flex flex-wrap gap-2 pt-0.5">
                  {#each msg.quickReplies as option}
                    <button
                      onclick={() => sendMessage(option)}
                      class="px-3.5 py-2 rounded-xl border border-white/10 bg-[#13131a] hover:bg-[#7c6cfa]/20 hover:border-[#7c6cfa]/40 text-sm text-white/60 hover:text-white transition-all cursor-pointer active:scale-95"
                    >
                      {option}
                    </button>
                  {/each}
                </div>
              {/if}

            </div>

          {:else}
            <div class="max-w-[75%] bg-[#7c6cfa]/20 border border-[rgba(124,108,250,0.2)] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </div>
          {/if}

        </div>
      {/each}

      <!-- Streaming -->
      {#if streamingContent}
        <div class="flex justify-start">
          <div class="max-w-[90%] bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
            {stripBlocks(streamingContent)}<span class="inline-block w-1 h-4 bg-[#7c6cfa] animate-pulse ml-0.5 align-middle rounded-sm"></span>
          </div>
        </div>
      {/if}

      <!-- Typing dots -->
      {#if loading && !streamingContent}
        <div class="flex justify-start">
          <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1">
            {#each [0,150,300] as d}
              <span class="w-1.5 h-1.5 bg-[#7c6cfa]/70 rounded-full animate-bounce" style="animation-delay:{d}ms"></span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Demo generating / ready card (after plan confirmed) -->
      {#if confirmed && !submitted}
        <div class="flex justify-start">
          <div class="bg-[#13131a] border border-[rgba(124,108,250,0.3)] rounded-2xl p-5 space-y-3 w-full max-w-sm">
            {#if demoStatus === 'generating'}
              <div class="flex items-center gap-3">
                <div class="flex gap-1">
                  {#each [0,150,300] as d}
                    <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:{d}ms"></span>
                  {/each}
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">{locale === 'zh' ? '正在生成你的 Demo…' : 'Building your demo…'}</p>
                  <p class="text-xs text-[#888899] mt-0.5">{locale === 'zh' ? 'AI 正在写 PRD 并开发原型，约 30–60 秒' : 'AI is writing PRD and building prototype, ~30-60s'}</p>
                </div>
              </div>
            {:else if demoStatus === 'ready'}
              <button
                type="button"
                onclick={openDemo}
                class="relative z-10 w-full flex items-center justify-between bg-gradient-to-r from-[#7c6cfa] to-[#c084fc] rounded-xl px-4 py-3.5 text-left no-underline hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                <div>
                  <p class="text-white font-bold text-sm">{locale === 'zh' ? '🚀 查看你的 Demo 原型' : '🚀 View your live demo'}</p>
                  <p class="text-white/70 text-xs mt-0.5">{locale === 'zh' ? '点击预览并进行调试迭代' : 'Preview and iterate with AI'}</p>
                </div>
                <span class="text-white text-xl">→</span>
              </button>
            {:else if demoStatus === 'failed'}
              <p class="text-sm text-[#ff6b6b]">{locale === 'zh' ? 'Demo 生成失败，请联系创始人获取支持。' : 'Demo generation failed. Contact the founder for help.'}</p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Contact form and done state -->
      {#if showContactForm && !submitted}
        <div class="flex justify-start">
          <div class="w-full max-w-sm bg-[#13131a] border border-[rgba(124,108,250,0.3)] rounded-2xl p-5 space-y-4">
            <div>
              <p class="font-semibold text-sm">{c.contactTitle}</p>
              <p class="text-xs text-[#888899] mt-1">{c.contactSub}</p>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-[#555566] block mb-1">{c.emailLabel}</label>
                <input bind:value={contactEmail} type="email" placeholder="you@example.com"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333344] focus:outline-none focus:border-[#7c6cfa]/60 transition-colors" />
              </div>
              <div>
                <label class="text-xs text-[#555566] block mb-1">{c.wechatLabel}</label>
                <input bind:value={contactWechat} type="text" placeholder="WeChat ID"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#333344] focus:outline-none focus:border-[#7c6cfa]/60 transition-colors" />
              </div>
              <button onclick={handleSubmitContact} disabled={!contactEmail && !contactWechat}
                class="w-full py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-30 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer">
                {c.submitBtn}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Done -->
      {#if submitted}
        <div class="flex justify-start">
          <div class="bg-[#13131a] border border-[rgba(74,222,128,0.3)] rounded-2xl p-5 space-y-2">
            <p class="text-[#4ade80] font-bold">{c.doneTitle}</p>
            <p class="text-sm text-white/60">{c.doneMsg}</p>
            <a href="/" class="inline-block mt-2 text-xs text-[#444455] hover:text-white no-underline transition-colors">{c.backBtn}</a>
          </div>
        </div>
      {/if}

      <!-- Bottom spacer so last message isn't hidden behind input bar -->
      <div class="h-4"></div>

    </div>
  </div>

  <!-- Input bar — minimal, only text + send -->
  <div class="shrink-0 border-t border-white/5 bg-[#0a0a0f] px-4 pt-3 pb-4">
    <div class="max-w-2xl mx-auto flex gap-2.5 items-end">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKeydown}
        oninput={autoResize}
        rows={1}
        disabled={loading || submitted}
        placeholder={c.placeholder}
        class="flex-1 bg-[#13131a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[#333344] resize-none focus:outline-none focus:border-[#7c6cfa]/50 disabled:opacity-30 transition-colors leading-relaxed"
        style="max-height:140px"
      ></textarea>
      <button
        onclick={() => sendMessage(input)}
        disabled={loading || !input.trim() || submitted}
        class="px-4 py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-25 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shrink-0"
      >
        {c.send}
      </button>
    </div>
  </div>

</div>
