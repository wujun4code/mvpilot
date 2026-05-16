<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const sessionId = data.sessionId;
  let status = $state<string | null>(data.storyStatus ?? null);
  let pollTimer: ReturnType<typeof setInterval>;

  // Iteration
  let iterateInput = $state('');
  let iterating = $state(false);
  let iterateError = $state('');

  // Iframe key to force reload when story is regenerated
  let iframeKey = $state(0);

  onMount(() => {
    if (status !== 'ready' && status !== 'failed') {
      pollTimer = setInterval(check, 3000);
    }
  });
  onDestroy(() => clearInterval(pollTimer));

  async function check() {
    const res = await fetch(`/api/story/${sessionId}/status`);
    if (!res.ok) return;
    const d = await res.json();
    status = d.status;
    if (status === 'ready' || status === 'failed') clearInterval(pollTimer);
    if (status === 'ready') iframeKey++;
  }

  async function regenerate() {
    status = 'generating';
    const res = await fetch(`/api/story/${sessionId}/regenerate`, { method: 'POST' });
    if (!res.ok) { status = 'failed'; return; }
    pollTimer = setInterval(check, 3000);
  }

  async function iterate() {
    if (!iterateInput.trim() || iterating) return;
    iterating = true;
    iterateError = '';
    try {
      const res = await fetch(`/api/story/${sessionId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: iterateInput }),
      });
      if (!res.ok) throw new Error('Failed');
      iterateInput = '';
      status = 'generating';
      pollTimer = setInterval(check, 3000);
    } catch {
      iterateError = '生成失败，请重试';
    } finally {
      iterating = false;
    }
  }
</script>

<svelte:head>
  <title>MVPilot — Pitch Story</title>
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
        <button onclick={regenerate}
          class="px-5 py-2.5 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
          🔄 重新生成
        </button>
      </div>

    {:else if status === 'ready'}
      <div class="w-full flex flex-col items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse"></span>
          <span class="text-sm text-[#4ade80] font-medium">Pitch Story Ready</span>
        </div>

        <!-- Open full-screen story directly (bypasses iframe issues) -->
        <div class="w-full max-w-2xl bg-[#0f0f18] border border-white/10 rounded-xl p-8 text-center space-y-4">
          <div class="text-5xl">📊</div>
          <p class="text-white font-semibold text-lg">Pitch Story 已生成</p>
          <p class="text-sm text-[#888899]">全屏模式下浏览效果最佳，支持键盘 ← → 切换幻灯片</p>
          <a href="/api/story/{sessionId}/html"
            class="inline-block px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 text-white font-bold rounded-xl no-underline transition-all">
            🖥️ 打开 Pitch Story
          </a>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3 flex-wrap justify-center">
          <button onclick={regenerate}
            class="px-4 py-2 border border-white/10 bg-[#13131a] hover:bg-white/5 text-white text-sm font-semibold rounded-xl cursor-pointer transition-all">
            🔄 重新生成
          </button>
          <a href="/demo/{sessionId}" class="px-4 py-2 border border-white/10 bg-[#13131a] hover:bg-white/5 text-white text-sm font-semibold rounded-xl no-underline transition-all">
            ← Back to demo
          </a>
        </div>

        <!-- AI iteration -->
        <div class="w-full max-w-2xl bg-[#13131a] border border-white/5 rounded-xl p-4">
          <p class="text-xs text-[#888899] mb-2">🤖 告诉 AI 你想怎么优化这个 Pitch Story</p>
          <div class="flex gap-2">
            <input bind:value={iterateInput}
              placeholder="如：把主色调换成蓝色，增加市场数据图表，调整文案语气…"
              class="flex-1 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#444455] focus:outline-none focus:border-[#7c6cfa]/50" />
            <button onclick={iterate} disabled={!iterateInput.trim() || iterating}
              class="px-4 py-2 bg-[#7c6cfa] hover:bg-[#6a5ae8] disabled:opacity-30 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer shrink-0">
              {iterating ? '生成中…' : '应用'}
            </button>
          </div>
          {#if iterateError}
            <p class="text-xs text-red-400 mt-2">{iterateError}</p>
          {/if}
        </div>
      </div>
    {/if}

  </div>
</div>
