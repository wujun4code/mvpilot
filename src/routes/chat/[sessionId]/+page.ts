import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { sessionId } = params;
  const res = await fetch(`/api/session/${sessionId}`);
  if (!res.ok) return { sessionId, session: null, messages: [] };
  const data = await res.json();
  return { sessionId, session: data.session, messages: data.messages };
};
