import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { sessionId } = params;
  try {
    const res = await fetch(`/api/story/${sessionId}/status`);
    if (res.ok) {
      const data = await res.json();
      return { sessionId, storyStatus: data.status ?? null, savedAt: data.savedAt ?? null };
    }
  } catch {}
  return { sessionId, storyStatus: null, savedAt: null };
};