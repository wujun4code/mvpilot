<script lang="ts">
  import '../app.css';
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';

  // Global locale store
  const locale = writable<'en' | 'zh'>('en');
  setContext('locale', locale);

  let { children } = $props();
</script>

{@render children()}
