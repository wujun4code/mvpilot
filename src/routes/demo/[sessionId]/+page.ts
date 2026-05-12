import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const { sessionId } = params;
  try {
    const res = await fetch(`/api/demo/${sessionId}/status`);
    if (res.ok) {
      const data = await res.json();
      return { sessionId, initialStatus: data.status, productType: data.productType ?? 'saas', locale: data.locale ?? 'en' };
    }
  } catch {}
  return { sessionId, initialStatus: null, productType: 'saas', locale: 'en' };
};
