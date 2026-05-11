<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import { OPENING_MESSAGE_EN, OPENING_MESSAGE_ZH } from '$lib/ai/prompts';
  import { parseMvpPlan } from '$lib/utils';

  let { data }: { data: PageData } = $props();

  type Msg = { role: 'user' | 'assistant'; content: string; id?: string };

  let messages = $state<Msg[]>([]);
  let input = $state('');
  let loading = $state(false);
  let streamingContent = $state('');
  let scrollEl = $state<HTMLDivElement>();
  let inputEl = $state<HTMLTextAreaElement>();
  let confirmed = $state(false);
  let showContactForm = $state(false);
  let contactEmail = $state('');
  let contactWechat = $state('');
  let submitted = $state(false);

  const locale = (data.session?.locale ?? 'en') as 'en' | 'zh';
  const sessionId = data.sessionId;

  const t = {
    en: {
      placeholder: 'Type your message...',
      send: 'Send',
      thinking: 'Thinking...',
      planTitle: '📋 Your MVP Plan',
      confirmBtn: 'Looks good! Let\'s do it →',
      contactTitle: 'Great! Leave your contact info',
      emailLabel: 'Email',
      wechatLabel: 'WeChat',
      submitBtn: 'Notify the founder →',
      doneTitle: '🎉 Done!',
      doneMsg: 'The founder has been notified and will reach out to you shortly.',
      backBtn: '← Start over',
    },
    zh: {
      placeholder: '输入你的消息...',
      send: '发送',
      thinking: '思考中...',
      planTitle: '📋 你的 MVP 方案',
      confirmBtn: '就这样！开始推进 →',
      contactTitle: '太好了！留下你的联系方式',
      emailLabel: '邮箱',
      wechatLabel: '微信',
      submitBtn: '通知创始人 →',
      doneTitle: '🎉 完成！',
      doneMsg: '创始人已收到通知，会主动联系你。',
      backBtn: '← 重新开始',
    },
  };

  const c = t[locale];

  onMount(async () => {
    // Load existing messages or show opening
    if (data.messages && data.messages.length > 0) {
      messages = data.messages.filter((m: any) => m.role !== 'system');
    } else {
      // Add AI opening message
      const opening = locale === 'zh' ? OPENING_MESSAGE_ZH : OPENING_MESSAGE_EN;
      messages = [{ role: 'assistant', content: opening }];
    }
    await scrollToBottom();
    inputEl?.focus();
  });

  async function scrollToBottom() {
    await tick();
    scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    input = '';
    messages = [...messages, { role: 'user', content: text }];
    loading = true;
    streamingContent = '';
    await scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content: text }),
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
              messages = [...messages, { role: 'assistant', content: streamingContent, id: json.msgId }];
              streamingContent = '';
              // Check if plan was proposed
              if (parseMvpPlan(messages[messages.length - 1].content)) {
                confirmed = false;
              }
            }
          } catch {}
        }
      }
    } catch (e) {
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
      send();
    }
  }

  async function handleConfirm() {
    showContactForm = true;
    await scrollToBottom();
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

  // Render MVP plan from JSON block
  function renderPlan(content: string): { plain: string; plan: any | null } {
    const plan = parseMvpPlan(content);
    const plain = content.replace(/```mvp-plan[\s\S]*?```/, '').trim();
    return { plain, plan };
  }

  function autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }
</script>

<svelte:head>
  <title>MVPilot — Chat</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="flex flex-col h-screen bg-[#0a0a0f]">
  <!-- Header -->
  <header class="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur z-10">
    <a href="/" class="font-extrabold text-base tracking-tight no-underline text-white">
      MVP<span class="text-[#7c6cfa]">ilot</span>
    </a>
    <span class="text-xs text-[#555566] font-mono">{sessionId.slice(0, 8)}</span>
  </header>

  <!-- Messages -->
  <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
    <div class="max-w-2xl mx-auto space-y-4">
      {#each messages as msg}
        <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
          {#if msg.role === 'assistant'}
            {@const { plain, plan } = renderPlan(msg.content)}
            <div class="max-w-[85%]">
              {#if plain}
                <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {plain}
                </div>
              {/if}

              {#if plan}
                <!-- MVP Plan Card -->
                <div class="mt-3 bg-[#13131a] border border-[rgba(124,108,250,0.3)] rounded-2xl p-5">
                  <p class="text-xs font-bold uppercase tracking-widest text-[#7c6cfa] mb-4">{c.planTitle}</p>
                  <div class="space-y-3 text-sm">
                    <div>
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '问题' : 'Problem'}</p>
                      <p class="text-white">{plan.problem}</p>
                    </div>
                    <div>
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '目标用户' : 'Target User'}</p>
                      <p class="text-white">{plan.user}</p>
                    </div>
                    <div>
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '核心功能' : 'Features'}</p>
                      <ul class="space-y-1">
                        {#each plan.features as f}
                          <li class="flex gap-2"><span class="text-[#4ade80]">✓</span><span class="text-white">{f}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div>
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '不做的事' : 'Out of Scope'}</p>
                      <ul class="space-y-1">
                        {#each plan.outOfScope as o}
                          <li class="flex gap-2"><span class="text-[#888899]">✗</span><span class="text-[#888899]">{o}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div>
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '主要风险' : 'Risks'}</p>
                      <ul class="space-y-1">
                        {#each plan.risks as r}
                          <li class="flex gap-2"><span class="text-yellow-400">⚠</span><span class="text-white">{r}</span></li>
                        {/each}
                      </ul>
                    </div>
                    <div class="pt-2 border-t border-white/5">
                      <p class="text-[#888899] text-xs mb-1">{locale === 'zh' ? '第一步行动' : 'First Action'}</p>
                      <p class="text-[#7c6cfa] font-semibold">{plan.firstAction}</p>
                    </div>
                  </div>

                  {#if !showContactForm && !submitted}
                    <button onclick={handleConfirm} class="mt-5 w-full py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl transition-all cursor-pointer text-sm">
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

      <!-- Streaming -->
      {#if streamingContent}
        <div class="flex justify-start">
          <div class="max-w-[85%] bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
            {streamingContent}<span class="inline-block w-1.5 h-4 bg-[#7c6cfa] animate-pulse ml-0.5 align-middle"></span>
          </div>
        </div>
      {/if}

      <!-- Loading dots -->
      {#if loading && !streamingContent}
        <div class="flex justify-start">
          <div class="bg-[#13131a] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-3 text-[#888899] text-sm flex items-center gap-2">
            <span class="flex gap-1">
              <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:0ms"></span>
              <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:150ms"></span>
              <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:300ms"></span>
            </span>
            {c.thinking}
          </div>
        </div>
      {/if}

      <!-- Contact form -->
      {#if showContactForm && !submitted}
        <div class="flex justify-start">
          <div class="max-w-[85%] bg-[#13131a] border border-[rgba(124,108,250,0.3)] rounded-2xl p-5 w-full">
            <p class="text-sm font-semibold mb-4">{c.contactTitle}</p>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-[#888899] block mb-1">{c.emailLabel}</label>
                <input bind:value={contactEmail} type="email" placeholder="you@example.com"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#7c6cfa]" />
              </div>
              <div>
                <label class="text-xs text-[#888899] block mb-1">{c.wechatLabel}</label>
                <input bind:value={contactWechat} type="text" placeholder="WeChat ID"
                  class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#7c6cfa]" />
              </div>
              <button onclick={handleSubmitContact}
                class="w-full py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl text-sm transition-all cursor-pointer">
                {c.submitBtn}
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Done state -->
      {#if submitted}
        <div class="flex justify-start">
          <div class="max-w-[85%] bg-[#13131a] border border-[rgba(74,222,128,0.3)] rounded-2xl p-5">
            <p class="text-[#4ade80] font-bold mb-1">{c.doneTitle}</p>
            <p class="text-sm text-white/80">{c.doneMsg}</p>
            <a href="/" class="inline-block mt-4 text-sm text-[#888899] hover:text-white no-underline">{c.backBtn}</a>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Input -->
  <div class="border-t border-white/5 bg-[#0a0a0f] px-4 py-4">
    <div class="max-w-2xl mx-auto flex gap-3 items-end">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKeydown}
        oninput={autoResize}
        rows={1}
        disabled={loading || submitted}
        placeholder={c.placeholder}
        class="flex-1 bg-[#13131a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[#555566] resize-none focus:outline-none focus:border-[#7c6cfa] disabled:opacity-50 transition-colors leading-relaxed"
        style="max-height:160px"
      ></textarea>
      <button
        onclick={send}
        disabled={loading || !input.trim() || submitted}
        class="px-4 py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shrink-0"
      >
        {c.send}
      </button>
    </div>
    <p class="text-center text-xs text-[#333344] mt-2">Press Enter to send · Shift+Enter for new line</p>
  </div>
</div>
