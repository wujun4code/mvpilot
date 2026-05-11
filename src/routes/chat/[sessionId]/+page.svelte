<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { PageData } from './$types';
  import {
    OPENING_MESSAGE_EN, OPENING_MESSAGE_ZH,
    OPENING_QUICK_REPLIES_EN, OPENING_QUICK_REPLIES_ZH,
  } from '$lib/ai/prompts';
  import { parseMvpPlan, parseQuickReplies, stripBlocks } from '$lib/utils';

  let { data }: { data: PageData } = $props();

  type Msg = { role: 'user' | 'assistant'; content: string; id?: string };
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
  let submitted = $state(false);

  // model picker
  let models = $state<AIModel[]>([]);
  let selectedModelId = $state<string | null>(null);
  let showModelPicker = $state(false);

  const t = {
    en: {
      placeholder: 'Type or pick an option above…',
      send: 'Send',
      thinking: 'Thinking…',
      planTitle: '📋 Your MVP Plan',
      confirmBtn: 'Looks good, let\'s go! →',
      contactTitle: '🎉 Ready to move forward!',
      contactSub: 'Leave your contact info and the founder will reach out.',
      emailLabel: 'Email',
      wechatLabel: 'WeChat',
      submitBtn: 'Notify the founder →',
      doneTitle: '🎉 Done!',
      doneMsg: 'The founder has been notified and will reach out shortly.',
      backBtn: '← Start a new conversation',
      modelLabel: 'AI Model',
    },
    zh: {
      placeholder: '点击上方选项或直接输入…',
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
      modelLabel: 'AI 模型',
    },
  };
  const c = t[locale];

  // Last assistant message's quick replies (shown above input)
  let currentQuickReplies = $state<string[]>([]);

  onMount(async () => {
    // Load models
    const res = await fetch('/api/models');
    if (res.ok) {
      models = await res.json();
      selectedModelId = models.find((m) => m.isDefault)?.id ?? models[0]?.id ?? null;
    }

    // Load or init messages
    if (data.messages && data.messages.length > 0) {
      messages = data.messages.filter((m: any) => m.role !== 'system');
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        currentQuickReplies = parseQuickReplies(last.content);
      }
    } else {
      const opening = locale === 'zh' ? OPENING_MESSAGE_ZH : OPENING_MESSAGE_EN;
      messages = [{ role: 'assistant', content: opening }];
      currentQuickReplies = locale === 'zh' ? OPENING_QUICK_REPLIES_ZH : OPENING_QUICK_REPLIES_EN;
    }

    await scrollToBottom();
    inputEl?.focus();
  });

  async function scrollToBottom() {
    await tick();
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    input = '';
    currentQuickReplies = [];
    messages = [...messages, { role: 'user', content: text }];
    loading = true;
    streamingContent = '';
    await scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content: text, modelId: selectedModelId }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.delta) {
              streamingContent += json.delta;
              await scrollToBottom();
            }
            if (json.done) {
              const fullContent = streamingContent;
              messages = [...messages, { role: 'assistant', content: fullContent, id: json.msgId }];
              streamingContent = '';
              currentQuickReplies = parseQuickReplies(fullContent);
            }
          } catch {}
        }
      }
    } catch {
      messages = [...messages, { role: 'assistant', content: '⚠️ Connection error. Please try again.' }];
    } finally {
      loading = false;
      await scrollToBottom();
      inputEl?.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
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
    await scrollToBottom();
  }

  function renderMsg(content: string) {
    return {
      plain: stripBlocks(content),
      plan: parseMvpPlan(content),
    };
  }

  const selectedModelName = $derived(models.find((m) => m.id === selectedModelId)?.name ?? '');
</script>

<svelte:head>
  <title>MVPilot — Chat</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">

  <!-- ── Header ─────────────────────────────────────────── -->
  <header class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur z-20">
    <a href="/" class="font-extrabold text-base tracking-tight no-underline text-white">
      MVP<span class="text-[#7c6cfa]">ilot</span>
    </a>

    <!-- Model picker -->
    <div class="relative">
      <button
        onclick={() => showModelPicker = !showModelPicker}
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-[#13131a] hover:bg-[#1e1e2e] transition-colors text-xs font-medium text-white/70 hover:text-white"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
        {selectedModelName || c.modelLabel}
        <svg class="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {#if showModelPicker}
        <!-- backdrop -->
        <button class="fixed inset-0 z-10" onclick={() => showModelPicker = false}></button>
        <div class="absolute right-0 top-full mt-1.5 z-20 bg-[#1a1a25] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
          {#each models as m}
            <button
              onclick={() => { selectedModelId = m.id; showModelPicker = false; }}
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-white/5 {selectedModelId === m.id ? 'text-[#7c6cfa]' : 'text-white/70'}"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0 {selectedModelId === m.id ? 'bg-[#7c6cfa]' : 'bg-white/20'}"></span>
              {m.name}
              {#if selectedModelId === m.id}
                <svg class="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </header>

  <!-- ── Messages ───────────────────────────────────────── -->
  <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-5">
    <div class="max-w-2xl mx-auto space-y-4">

      {#each messages as msg}
        <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
          {#if msg.role === 'assistant'}
            {@const { plain, plan } = renderMsg(msg.content)}
            <div class="max-w-[88%] space-y-3">
              {#if plain}
                <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {plain}
                </div>
              {/if}

              {#if plan}
                {@const p = plan as any}
                <div class="bg-[#13131a] border border-[rgba(124,108,250,0.35)] rounded-2xl p-5 space-y-3">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-[#7c6cfa]">{c.planTitle}</p>

                  <div class="space-y-2.5 text-sm">
                    <div>
                      <p class="text-[11px] text-[#666677] mb-0.5">{locale === 'zh' ? '💬 问题' : '💬 Problem'}</p>
                      <p class="text-white/90">{p.problem}</p>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#666677] mb-0.5">{locale === 'zh' ? '👤 目标用户' : '👤 Target User'}</p>
                      <p class="text-white/90">{p.user}</p>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#666677] mb-1">{locale === 'zh' ? '✅ 核心功能' : '✅ Features'}</p>
                      <ul class="space-y-1">
                        {#each p.features as f}
                          <li class="flex gap-2 items-start"><span class="text-[#4ade80] mt-0.5 shrink-0">✓</span><span class="text-white/90">{f}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#666677] mb-1">{locale === 'zh' ? '🚫 不做' : '🚫 Out of Scope'}</p>
                      <ul class="space-y-1">
                        {#each p.outOfScope as o}
                          <li class="flex gap-2 items-start"><span class="text-[#444455] mt-0.5 shrink-0">✗</span><span class="text-white/50">{o}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div>
                      <p class="text-[11px] text-[#666677] mb-1">{locale === 'zh' ? '⚠️ 风险' : '⚠️ Risks'}</p>
                      <ul class="space-y-1">
                        {#each p.risks as r}
                          <li class="flex gap-2 items-start"><span class="text-yellow-500 mt-0.5 shrink-0">⚠</span><span class="text-white/80">{r}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div class="pt-2 border-t border-white/5">
                      <p class="text-[11px] text-[#666677] mb-0.5">{locale === 'zh' ? '🚀 第一步' : '🚀 First Action'}</p>
                      <p class="text-[#7c6cfa] font-semibold">{p.firstAction}</p>
                    </div>
                  </div>

                  {#if !showContactForm && !submitted}
                    <button
                      onclick={() => { showContactForm = true; scrollToBottom(); }}
                      class="mt-2 w-full py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl transition-all cursor-pointer text-sm"
                    >
                      {c.confirmBtn}
                    </button>
                  {/if}
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

      <!-- Streaming bubble -->
      {#if streamingContent}
        <div class="flex justify-start">
          <div class="max-w-[88%] bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
            {stripBlocks(streamingContent)}<span class="inline-block w-1.5 h-4 bg-[#7c6cfa] animate-pulse ml-0.5 align-middle rounded-sm"></span>
          </div>
        </div>
      {/if}

      <!-- Loading dots -->
      {#if loading && !streamingContent}
        <div class="flex justify-start">
          <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-1.5">
            {#each [0, 150, 300] as delay}
              <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:{delay}ms"></span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Contact form -->
      {#if showContactForm && !submitted}
        <div class="flex justify-start">
          <div class="w-full max-w-sm bg-[#13131a] border border-[rgba(124,108,250,0.35)] rounded-2xl p-5 space-y-4">
            <div>
              <p class="font-semibold text-sm mb-1">{c.contactTitle}</p>
              <p class="text-xs text-[#888899]">{c.contactSub}</p>
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-[#666677] block mb-1">{c.emailLabel}</label>
                <input bind:value={contactEmail} type="email" placeholder="you@example.com"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa] transition-colors" />
              </div>
              <div>
                <label class="text-xs text-[#666677] block mb-1">{c.wechatLabel}</label>
                <input bind:value={contactWechat} type="text" placeholder="WeChat ID"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa] transition-colors" />
              </div>
              <button onclick={handleSubmitContact} disabled={!contactEmail && !contactWechat}
                class="w-full py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer">
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
            <p class="text-sm text-white/70">{c.doneMsg}</p>
            <a href="/" class="inline-block mt-2 text-xs text-[#555566] hover:text-white no-underline transition-colors">{c.backBtn}</a>
          </div>
        </div>
      {/if}

    </div>
  </div>

  <!-- ── Quick replies + Input ──────────────────────────── -->
  <div class="shrink-0 border-t border-white/5 bg-[#0a0a0f] px-4 pt-3 pb-4">
    <div class="max-w-2xl mx-auto space-y-2.5">

      <!-- Quick reply chips -->
      {#if currentQuickReplies.length > 0 && !loading && !submitted}
        <div class="flex flex-wrap gap-2">
          {#each currentQuickReplies as option}
            <button
              onclick={() => sendMessage(option)}
              class="px-3.5 py-2 rounded-xl border border-white/10 bg-[#13131a] hover:bg-[#7c6cfa]/20 hover:border-[#7c6cfa]/50 text-sm text-white/70 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              {option}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Text input row -->
      <div class="flex gap-2.5 items-end">
        <textarea
          bind:this={inputEl}
          bind:value={input}
          onkeydown={handleKeydown}
          oninput={autoResize}
          rows={1}
          disabled={loading || submitted}
          placeholder={c.placeholder}
          class="flex-1 bg-[#13131a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[#444455] resize-none focus:outline-none focus:border-[#7c6cfa]/60 disabled:opacity-40 transition-colors leading-relaxed"
          style="max-height:140px"
        ></textarea>
        <button
          onclick={() => sendMessage(input)}
          disabled={loading || !input.trim() || submitted}
          class="px-4 py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-30 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shrink-0"
        >
          {c.send}
        </button>
      </div>

    </div>
  </div>

</div>
