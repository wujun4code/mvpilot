<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const sessionId = data.sessionId;
  const locale = (data.locale ?? 'en') as 'en' | 'zh';

  let status = $state<string | null>(data.initialStatus ?? null);
  let productType = $state<string>(data.productType ?? 'saas');
  let pollTimer: ReturnType<typeof setInterval>;

  // Iterate
  let iterateInput = $state('');
  let iterating = $state(false);
  let iterateError = $state('');

  // Contact
  let showContact = $state(false);
  let contactEmail = $state('');
  let contactWechat = $state('');
  let contactSubmitted = $state(false);

  onMount(() => {
    if (status !== 'ready' && status !== 'failed') {
      pollTimer = setInterval(checkStatus, 3000);
    }
  });
  let demoSaved = $state(false);
  let shareUrl = $state('');
  let storyStatus = $state<string | null>(null);
  let storyPollTimer: ReturnType<typeof setInterval>;

  async function saveDemo() {
    const res = await fetch('/api/save-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    demoSaved = true;
    shareUrl = `${window.location.origin}/demo/${sessionId}`;
    storyStatus = 'generating';
    storyPollTimer = setInterval(async () => {
      const r = await fetch(`/api/story/${sessionId}/status`);
      const d = await r.json();
      storyStatus = d.status;
      if (storyStatus === 'ready' || storyStatus === 'failed') clearInterval(storyPollTimer);
    }, 4000);
  }

  function copyShareUrl() {
    navigator.clipboard?.writeText(shareUrl);
  }

  onDestroy(() => { clearInterval(pollTimer); clearInterval(storyPollTimer); });

  async function checkStatus() {
    const res = await fetch(`/api/demo/${sessionId}/status`);
    if (!res.ok) return;
    const data = await res.json();
    status = data.status;
    productType = data.productType ?? 'saas';
    if (status === 'ready' || status === 'failed') clearInterval(pollTimer);
  }

  async function iterate() {
    if (!iterateInput.trim() || iterating) return;
    iterating = true;
    iterateError = '';
    try {
      const res = await fetch(`/api/demo/${sessionId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: iterateInput }),
      });
      if (!res.ok) throw new Error('Failed');
      iterateInput = '';
      status = 'generating';
      pollTimer = setInterval(checkStatus, 3000);
    } catch {
      iterateError = '生成失败，请重试';
    } finally {
      iterating = false;
    }
  }

  async function submitContact() {
    if (!contactEmail && !contactWechat) return;
    await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, contactEmail, contactWechat }),
    });
    contactSubmitted = true;
  }

  const isMobile = $derived(productType === 'mobile' || productType === 'wechat');
  const isWechat = $derived(productType === 'wechat');
</script>

<svelte:head>
  <title>MVPilot — Demo Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="min-h-screen bg-[#0a0a0f] flex flex-col">

  <!-- Header -->
  <header class="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
    <a href="/" class="font-extrabold text-base tracking-tight no-underline text-white">MVP<span class="text-[#7c6cfa]">ilot</span></a>
    <div class="flex items-center gap-3">
      <span class="text-xs text-[#555566]">Demo Preview</span>
      <a href="/chat/{sessionId}" class="text-xs text-[#7c6cfa] hover:underline">← Back to chat</a>
    </div>
  </header>

  <!-- Content -->
  <div class="flex-1 flex items-center justify-center p-6">

    {#if status === null || status === 'generating'}
      <!-- Generating state -->
      <div class="text-center space-y-6 max-w-sm">
        <div class="relative mx-auto w-20 h-20">
          <div class="absolute inset-0 rounded-full border-2 border-[#7c6cfa]/20 animate-ping"></div>
          <div class="absolute inset-2 rounded-full border-2 border-[#7c6cfa]/40 animate-ping" style="animation-delay:0.3s"></div>
          <div class="absolute inset-0 flex items-center justify-center text-3xl">🚀</div>
        </div>
        <div>
          <p class="font-bold text-white text-lg mb-1">Building your demo…</p>
          <p class="text-sm text-[#888899]">AI is generating a live prototype based on your MVP plan. This takes about 30–60 seconds.</p>
        </div>
        <div class="flex justify-center gap-1">
          {#each [0,1,2,3,4] as i}
            <div class="w-1.5 h-1.5 rounded-full bg-[#7c6cfa]/40 animate-pulse" style="animation-delay:{i*200}ms"></div>
          {/each}
        </div>
      </div>

    {:else if status === 'failed'}
      <div class="text-center space-y-4">
        <div class="text-4xl">😢</div>
        <p class="text-white font-semibold">Demo generation failed</p>
        <p class="text-sm text-[#888899]">Something went wrong. Please go back and try again.</p>
        <a href="/chat/{sessionId}" class="inline-block px-5 py-2.5 bg-[#7c6cfa] text-white text-sm font-semibold rounded-xl no-underline hover:bg-[#6a5ae8]">← Back to chat</a>
      </div>

    {:else if status === 'ready'}
      <div class="w-full flex flex-col items-center gap-4">

        <!-- Label -->
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse"></span>
          <span class="text-sm text-[#4ade80] font-medium">Live Demo</span>
          {#if isWechat}
            <span class="text-xs bg-[#07c160]/15 text-[#07c160] border border-[#07c160]/30 rounded-full px-2 py-0.5">WeChat Mini App</span>
          {:else if isMobile}
            <span class="text-xs bg-[#7c6cfa]/15 text-[#7c6cfa] border border-[#7c6cfa]/30 rounded-full px-2 py-0.5">Mobile App</span>
          {:else}
            <span class="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-2 py-0.5">Web App</span>
          {/if}
        </div>

        {#if isMobile}
          <!-- Phone shell -->
          <div class="relative" style="width:375px">
            <!-- Phone frame -->
            <div class="absolute inset-0 rounded-[44px] border-[8px] border-[#1e1e2e] shadow-2xl shadow-black/60 pointer-events-none z-10"></div>
            <!-- Status bar -->
            <div class="absolute top-0 left-0 right-0 h-10 rounded-t-[36px] z-10 flex items-center justify-between px-6 {isWechat ? 'bg-white' : 'bg-[#1e1e2e]'}">
              <span class="text-xs font-semibold {isWechat ? 'text-black' : 'text-white'}">9:41</span>
              <div class="flex items-center gap-1">
                <span class="text-xs {isWechat ? 'text-black' : 'text-white'}">●●●</span>
              </div>
            </div>
            <!-- Notch -->
            <div class="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1e1e2e] rounded-full z-20 {isWechat ? 'hidden' : ''}"></div>
            <!-- iframe -->
            <iframe
              src="/api/demo/{sessionId}/html"
              title="Demo Preview"
              class="w-full rounded-[36px] border-0 block"
              style="height:780px"
            ></iframe>
          </div>

        {:else}
          <!-- Browser shell -->
          <div class="w-full max-w-4xl rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
            <!-- Browser chrome -->
            <div class="bg-[#1a1a28] px-4 py-2.5 flex items-center gap-3 border-b border-white/5">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div class="w-3 h-3 rounded-full bg-[#28c840]"></div>
              </div>
              <div class="flex-1 bg-[#0a0a0f] rounded-md px-3 py-1 text-xs text-[#555566]">
                mvpilot.demo / preview
              </div>
            </div>
            <!-- iframe -->
            <iframe
              src="/api/demo/{sessionId}/html"
              title="Demo Preview"
              class="w-full border-0 block"
              style="height:640px"
            ></iframe>
          </div>
        {/if}

        <!-- Iterate + Contact -->
        <div class="w-full max-w-2xl space-y-3">

          {#if !contactSubmitted}
            <!-- Save + Share bar -->
            {#if !demoSaved}
              <div class="bg-[#13131a] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">{locale === 'zh' ? '喜欢这个 Demo？' : 'Like this demo?'}</p>
                  <p class="text-xs text-[#888899] mt-0.5">{locale === 'zh' ? '保存后可生成 Pitch Story PPT' : 'Save to generate a Pitch Story'}</p>
                </div>
                <button onclick={saveDemo}
                  class="px-4 py-2 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white text-sm font-semibold rounded-xl cursor-pointer shrink-0 transition-all">
                  {locale === 'zh' ? '💾 保存' : '💾 Save'}
                </button>
              </div>
            {:else}
              <!-- Saved state -->
              <div class="bg-[#13131a] border border-[rgba(74,222,128,0.2)] rounded-xl px-4 py-3 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-[#4ade80]">✓</span>
                    <span class="text-sm font-semibold">{locale === 'zh' ? 'Demo 已保存' : 'Demo saved'}</span>
                  </div>
                  <button onclick={copyShareUrl}
                    class="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                    🔗 {locale === 'zh' ? '复制分享链接' : 'Copy link'}
                  </button>
                </div>

                <!-- Story generation status -->
                {#if storyStatus === 'generating'}
                  <div class="flex items-center gap-3 bg-[#7c6cfa]/10 border border-[#7c6cfa]/20 rounded-xl px-4 py-3">
                    <div class="flex gap-1">
                      {#each [0,150,300] as d}
                        <span class="w-1.5 h-1.5 bg-[#7c6cfa] rounded-full animate-bounce" style="animation-delay:{d}ms"></span>
                      {/each}
                    </div>
                    <div>
                      <p class="text-sm text-[#7c6cfa] font-semibold">{locale === 'zh' ? '正在生成 Pitch Story…' : 'Generating Pitch Story…'}</p>
                      <p class="text-xs text-[#7c6cfa]/60 mt-0.5">{locale === 'zh' ? 'AI 正在制作你的投资人演示文稿' : 'AI is building your investor presentation'}</p>
                    </div>
                  </div>
                {:else if storyStatus === 'ready'}
                  <a href="/story/{sessionId}" target="_blank"
                    class="flex items-center justify-between bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 rounded-xl px-4 py-3.5 no-underline transition-opacity">
                    <div>
                      <p class="text-white font-bold text-sm">{locale === 'zh' ? '📊 查看 Pitch Story' : '📊 View Pitch Story'}</p>
                      <p class="text-white/70 text-xs mt-0.5">{locale === 'zh' ? '投资人/团队沟通演示文稿' : 'Investor & team presentation'}</p>
                    </div>
                    <span class="text-white text-xl">→</span>
                  </a>
                {:else if storyStatus === 'failed'}
                  <p class="text-xs text-[#ff6b6b]">{locale === 'zh' ? 'Pitch Story 生成失败，请稍后重试' : 'Story generation failed'}</p>
                {/if}
              </div>
            {/if}

            <!-- Iterate input -->
            <div class="bg-[#13131a] border border-white/5 rounded-xl p-4">
              <p class="text-xs text-[#888899] mb-2">🛠 想调整什么？直接说</p>
              <div class="flex gap-2">
                <input
                  bind:value={iterateInput}
                  placeholder="如：把主色换成蓝色，加一个购物车功能…"
                  class="flex-1 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa]/50"
                  onkeydown={(e) => e.key === 'Enter' && iterate()}
                />
                <button
                  onclick={iterate}
                  disabled={iterating || !iterateInput.trim()}
                  class="px-4 py-2 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-30 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer shrink-0"
                >
                  {iterating ? '生成中…' : '应用'}
                </button>
              </div>
              {#if iterateError}<p class="text-xs text-[#ff6b6b] mt-1">{iterateError}</p>{/if}
            </div>

            <!-- Happy CTA -->
            {#if !showContact}
              <button
                onclick={() => showContact = true}
                class="w-full py-3.5 bg-gradient-to-r from-[#7c6cfa] to-[#c084fc] hover:opacity-90 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                🎉 满意了，联系创始人一起落地 →
              </button>
            {:else}
              <!-- Contact form -->
              <div class="bg-[#13131a] border border-[rgba(124,108,250,0.35)] rounded-xl p-5 space-y-3">
                <p class="font-semibold text-sm">🎉 太好了！留下联系方式</p>
                <p class="text-xs text-[#888899]">创始人会主动联系你，一起把这个想法真正落地</p>
                <div class="space-y-2">
                  <input bind:value={contactEmail} type="email" placeholder="邮箱"
                    class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa]/50" />
                  <input bind:value={contactWechat} type="text" placeholder="微信 ID"
                    class="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa]/50" />
                </div>
                <button onclick={submitContact} disabled={!contactEmail && !contactWechat}
                  class="w-full py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-30 text-white font-semibold rounded-xl text-sm cursor-pointer">
                  通知创始人 →
                </button>
              </div>
            {/if}

          {:else}
            <div class="bg-[#13131a] border border-[rgba(74,222,128,0.3)] rounded-xl p-5 text-center space-y-2">
              <p class="text-[#4ade80] font-bold">🎉 搮到了！</p>
              <p class="text-sm text-white/60">创始人已收到通知，马上联系你。</p>
            </div>
          {/if}

          <div class="flex gap-2 justify-center">
            <a href="/chat/{sessionId}" class="text-xs text-[#444455] hover:text-white no-underline transition-colors">← 返回对话</a>
            <span class="text-[#333344]">·</span>
            <a href="/api/demo/{sessionId}/html" target="_blank" class="text-xs text-[#444455] hover:text-white no-underline transition-colors">全屏打开 ↗</a>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>
