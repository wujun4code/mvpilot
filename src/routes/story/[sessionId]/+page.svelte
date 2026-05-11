<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';

  const sessionId = $page.params.sessionId;
  let status = $state<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval>;

  onMount(() => {
    check();
    pollTimer = setInterval(check, 3000);
  });
  onDestroy(() => clearInterval(pollTimer));

  async function check() {
    const res = await fetch(`/api/story/${sessionId}/status`);
    if (!res.ok) return;
    const d = await res.json();
    status = d.status;
    if (status === 'ready' || status === 'failed') clearInterval(pollTimer);
  }
</script>

<svelte:head>
  <title>MVPilot — Pitch Story</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<div class="min-h-screen bg-[#0a0a0f] flex flex-col">
  <header class="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
    <a href="/" class="font-extrabold text-base tracking-tight no-underline text-white">MVP<span class="text-[#7c6cfa]">ilot</span></a>
    <div class="flex items-center gap-3">
      <span class="text-xs text-[#555566]">Pitch Story</span>
      <a href="/demo/{sessionId}" class="text-xs text-[#7c6cfa] hover:underline">← Back to demo</a>
    </div>
  </header>

  <div class="flex-1 flex items-center justify-center p-6">

    {#if status === null || status === 'generating'}
      <div class="text-center space-y-6 max-w-sm">
        <div class="relative mx-auto w-20 h-20">
          <div class="absolute inset-0 rounded-full border-2 border-[#7c6cfa]/20 animate-ping"></div>
          <div class="absolute inset-2 rounded-full border-2 border-[#7c6cfa]/40 animate-ping" style="animation-delay:0.4s"></div>
          <div class="absolute inset-0 flex items-center justify-center text-3xl">📊</div>
        </div>
        <div>
          <p class="font-bold text-white text-lg mb-1">生成 Pitch Story 中…</p>
          <p class="text-sm text-[#888899]">AI 正在为你制作投资人演示文稿，约 30-60 秒。</p>
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
        <p class="text-white font-semibold">生成失败</p>
        <a href="/demo/{sessionId}" class="inline-block px-5 py-2.5 bg-[#7c6cfa] text-white text-sm font-semibold rounded-xl no-underline">← 返回 Demo</a>
      </div>

    {:else if status === 'ready'}
      <div class="w-full flex flex-col items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse"></span>
          <span class="text-sm text-[#4ade80] font-medium">Pitch Story Ready</span>
        </div>

        <!-- Browser chrome wrapper -->
        <div class="w-full max-w-5xl rounded-xl overflow-hidden border border-white/10 shadow-2xl">
          <div class="bg-[#1a1a28] px-4 py-2.5 flex items-center gap-3 border-b border-white/5">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
              <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div class="w-3 h-3 rounded-full bg-[#28c840]"></div>
            </div>
            <div class="flex-1 bg-[#0a0a0f] rounded-md px-3 py-1 text-xs text-[#555566]">
              mvpilot.story / pitch
            </div>
          </div>
          <iframe
            src="/api/story/{sessionId}/html"
            title="Pitch Story"
            class="w-full border-0 block"
            style="height:600px"
          ></iframe>
        </div>

        <div class="flex gap-3 flex-wrap justify-center">
          <a href="/demo/{sessionId}" class="px-5 py-2.5 border border-white/10 bg-[#13131a] hover:bg-white/5 text-white text-sm font-semibold rounded-xl no-underline transition-all">
            ← Back to demo
          </a>
          <a href="/api/story/{sessionId}/html" target="_blank"
            class="px-5 py-2.5 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 text-white text-sm font-semibold rounded-xl no-underline transition-all">
            全屏查看 ↗
          </a>
        </div>

        <p class="text-xs text-[#333344] text-center max-w-md">
          AI 生成的演示文稿，基于你的 MVP 方案。点击幻灯片或按键盘方向键切换。
        </p>
      </div>
    {/if}

  </div>
</div>
