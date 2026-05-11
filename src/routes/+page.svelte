<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let lang = $state<'en' | 'zh'>('en');

  onMount(() => {
    const saved = localStorage.getItem('mvpilot-lang');
    const browser = navigator.language.startsWith('zh') ? 'zh' : 'en';
    lang = (saved as 'en' | 'zh') || browser;
  });

  function setLang(l: 'en' | 'zh') {
    lang = l;
    localStorage.setItem('mvpilot-lang', l);
  }

  async function startChat() {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: lang }),
    });
    const { sessionId } = await res.json();
    goto(`/chat/${sessionId}`);
  }

  const t = {
    en: {
      badge: '🚀 Open Source · In Development',
      h1a: 'Your idea deserves',
      h1b: 'a real plan',
      sub: 'MVPilot is an AI co-pilot that guides you from a vague product idea to a clear, actionable MVP spec — through structured conversation, in under 30 minutes.',
      cta: 'Start for free →',
      gh: '⭐ Star on GitHub',
      how: 'How it works',
      problemLabel: 'The Problem',
      problemH2: 'Most ideas die before they\'re built',
      problemSub: 'Not because people can\'t code. Because they can\'t get clear on what to build.',
      quotes: [
        'I have an idea but I don\'t know if it\'s worth building.',
        'I want to try an MVP but I don\'t know where to start.',
        'I\'ve talked to 5 people about my idea and got 5 different opinions.',
        'I keep adding features in my head. I can\'t figure out what the MVP actually is.',
      ],
      howLabel: 'How It Works',
      howH2: 'Clarity in 30 minutes',
      howSub: 'A structured AI conversation that asks the right questions — and challenges you when your answers are vague.',
      steps: [
        { n: '1', t: 'Share your idea', d: 'Start with whatever you have. Rough is fine. The AI knows how to dig deeper.' },
        { n: '2', t: 'Answer 7–10 questions', d: 'Who\'s the user? What pain? How do they solve it today? Why is your approach different?' },
        { n: '3', t: 'Get challenged', d: 'The AI pushes back on vague scope and identifies real risks.' },
        { n: '4', t: 'Receive your MVP plan', d: 'A structured plan: problem, user, features, scope, risks, first action.' },
        { n: '5', t: 'Connect with the founder', d: 'A real human reaches out to help you ship.' },
      ],
      ctaH2: 'Ready to get clear?',
      ctaSub: 'No login required. Start a conversation now.',
      ctaBtn: 'Start for free →',
    },
    zh: {
      badge: '🚀 开源 · 开发中',
      h1a: '你的想法值得',
      h1b: '一份真正的计划',
      sub: 'MVPilot 是你的 AI 产品副驾驶。通过结构化对话，在 30 分钟内把模糊的想法变成清晰可执行的 MVP 方案。',
      cta: '免费开始 →',
      gh: '⭐ Star on GitHub',
      how: '产品流程',
      problemLabel: '痛点',
      problemH2: '大多数想法，死在动手之前',
      problemSub: '不是因为不会写代码，而是因为根本没搞清楚要做什么。',
      quotes: [
        '我有个想法，但不知道值不值得做。',
        '想做 MVP，但不知道从哪里下手。',
        '跟 5 个人讲了我的想法，得到了 5 种不同的意见。',
        '脑子里一直在加功能，就是想不清楚 MVP 到底是什么。',
      ],
      howLabel: '产品流程',
      howH2: '30 分钟，从模糊到清晰',
      howSub: '结构化 AI 对话，问你真正该想清楚的问题——并在你回答含糊时直接追问。',
      steps: [
        { n: '1', t: '说出你的想法', d: '有什么说什么，哪怕很粗糙，AI 会引导你深入挖掘。' },
        { n: '2', t: '回答 7–10 个问题', d: '用户是谁？什么痛点？现在怎么解决的？你的差异化在哪？' },
        { n: '3', t: '被追问和质疑', d: 'AI 不会一味迎合，会对模糊范围提出质疑，指出真实风险。' },
        { n: '4', t: '获得 MVP 方案', d: '结构清晰的方案：问题、用户、功能范围、边界、风险、第一步。' },
        { n: '5', t: '联系创始人', d: '确认方案后，真人创始人会主动联系你，帮你把产品落地。' },
      ],
      ctaH2: '准备好想清楚了吗？',
      ctaSub: '无需注册，立刻开始对话。',
      ctaBtn: '免费开始 →',
    },
  };

  let c = $derived(t[lang]);
</script>

<svelte:head>
  <title>MVPilot — Turn your idea into a real plan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</svelte:head>

<!-- NAV -->
<nav class="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#0a0a0f]/85 backdrop-blur-md z-50">
  <div class="font-extrabold text-lg tracking-tight">MVP<span class="text-[#7c6cfa]">ilot</span></div>
  <div class="flex items-center gap-4">
    <a href="#how" class="text-sm text-[#888899] hover:text-white transition-colors no-underline">{t[lang].how}</a>
    <a href="https://github.com/wujun4code/mvpilot" target="_blank" class="text-sm text-[#888899] hover:text-white transition-colors no-underline">GitHub</a>
    <!-- lang switch -->
    <div class="flex border border-white/10 rounded-lg overflow-hidden">
      <button onclick={() => setLang('en')} class="px-3 py-1.5 text-xs font-semibold transition-all {lang === 'en' ? 'bg-[#7c6cfa] text-white' : 'text-[#888899] hover:text-white'}">EN</button>
      <button onclick={() => setLang('zh')} class="px-3 py-1.5 text-xs font-semibold transition-all {lang === 'zh' ? 'bg-[#7c6cfa] text-white' : 'text-[#888899] hover:text-white'}">中文</button>
    </div>
  </div>
</nav>

<!-- HERO -->
<section class="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
  <div class="inline-flex items-center gap-2 bg-[rgba(124,108,250,0.15)] text-[#7c6cfa] border border-[rgba(124,108,250,0.3)] rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
    {t[lang].badge}
  </div>
  <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-5">
    {t[lang].h1a}<br/>
    <em class="not-italic bg-gradient-to-br from-[#7c6cfa] to-[#c084fc] bg-clip-text text-transparent">{t[lang].h1b}</em>
  </h1>
  <p class="text-lg text-[#888899] max-w-xl mx-auto mb-8">{t[lang].sub}</p>
  <div class="flex gap-3 justify-center flex-wrap">
    <button onclick={startChat} class="px-6 py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl transition-all cursor-pointer">
      {t[lang].cta}
    </button>
    <a href="https://github.com/wujun4code/mvpilot" target="_blank" class="px-6 py-3 border border-white/10 hover:bg-white/5 text-white font-semibold rounded-xl transition-all no-underline">
      {t[lang].gh}
    </a>
  </div>
</section>

<hr class="border-white/5" />

<!-- PROBLEM -->
<section class="max-w-4xl mx-auto px-6 py-16">
  <p class="text-xs font-bold uppercase tracking-widest text-[#7c6cfa] mb-3">{t[lang].problemLabel}</p>
  <h2 class="text-3xl font-bold tracking-tight mb-3">{t[lang].problemH2}</h2>
  <p class="text-[#888899] mb-8">{t[lang].problemSub}</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {#each t[lang].quotes as q}
      <div class="bg-[#13131a] border border-white/5 rounded-xl p-5">
        <p class="text-sm italic text-white/80">&ldquo;{q}</p>
      </div>
    {/each}
  </div>
</section>

<hr class="border-white/5" />

<!-- HOW IT WORKS -->
<section id="how" class="max-w-4xl mx-auto px-6 py-16">
  <p class="text-xs font-bold uppercase tracking-widest text-[#7c6cfa] mb-3">{t[lang].howLabel}</p>
  <h2 class="text-3xl font-bold tracking-tight mb-3">{t[lang].howH2}</h2>
  <p class="text-[#888899] mb-8">{t[lang].howSub}</p>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each t[lang].steps as step}
      <div class="bg-[#13131a] border border-white/5 rounded-xl p-5">
        <div class="w-8 h-8 rounded-lg bg-[rgba(124,108,250,0.15)] text-[#7c6cfa] font-bold text-sm flex items-center justify-center mb-4">{step.n}</div>
        <h3 class="font-semibold mb-1.5">{step.t}</h3>
        <p class="text-sm text-[#888899]">{step.d}</p>
      </div>
    {/each}
  </div>
</section>

<hr class="border-white/5" />

<!-- CTA -->
<section class="max-w-lg mx-auto px-6 py-20 text-center">
  <h2 class="text-3xl font-bold tracking-tight mb-3">{t[lang].ctaH2}</h2>
  <p class="text-[#888899] mb-8">{t[lang].ctaSub}</p>
  <button onclick={startChat} class="px-8 py-3 bg-[#7c6cfa] hover:bg-[#6a5ae8] text-white font-semibold rounded-xl transition-all cursor-pointer text-lg">
    {t[lang].ctaBtn}
  </button>
</section>

<!-- FOOTER -->
<footer class="border-t border-white/5 py-6 text-center text-xs text-[#888899]">
  Built in public by <a href="https://github.com/wujun4code" target="_blank" class="text-[#888899] hover:text-white">@wujun4code</a> ·
  <a href="https://github.com/wujun4code/mvpilot" target="_blank" class="text-[#888899] hover:text-white no-underline">GitHub</a> ·
  MIT License
</footer>
