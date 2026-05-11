<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';

  const sessionId = $page.params.sessionId;

  let status = $state<'generating' | 'ready' | 'failed' | null>(null);
  let productType = $state<string>('saas');
  let pollTimer: ReturnType<typeof setInterval>;

  onMount(() => {
    checkStatus();
    pollTimer = setInterval(checkStatus, 3000);
  });
  onDestroy(() => clearInterval(pollTimer));

  async function checkStatus() {
    const res = await fetch(`/api/demo/${sessionId}/status`);
    if (!res.ok) return;
    const data = await res.json();
    status = data.status;
    productType = data.productType ?? 'saas';
    if (status === 'ready' || status === 'failed') {
      clearInterval(pollTimer);
    }
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
              sandbox="allow-scripts allow-same-origin allow-forms"
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
              sandbox="allow-scripts allow-same-origin allow-forms"
            ></iframe>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex gap-3 flex-wrap justify-center">
          <a href="/chat/{sessionId}" class="px-5 py-2.5 border border-white/10 bg-[#13131a] hover:bg-white/5 text-white text-sm font-semibold rounded-xl no-underline transition-all">
            ← Back to chat
          </a>
          <a href="/api/demo/{sessionId}/html" target="_blank"
            class="px-5 py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white text-sm font-semibold rounded-xl no-underline transition-all">
            Open full screen ↗
          </a>
        </div>

        <p class="text-xs text-[#333344] text-center max-w-md">
          This is an AI-generated prototype for illustration purposes. All data is fictional.
          Ready to build the real thing? Go back to chat and connect with the founder.
        </p>
      </div>
    {/if}

  </div>
</div>
