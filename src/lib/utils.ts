import { nanoid } from 'nanoid';

const BT = '`'; // single backtick — avoids template literal escaping issues in Svelte/Vite
const FENCE = BT + BT + BT; // ```

export function generateId(): string {
  return nanoid();
}

export function parseMvpPlan(content: string): object | null {
  const open = FENCE + 'mvp-plan';
  const start = content.indexOf(open);
  if (start === -1) return null;
  const after = content.indexOf('\n', start) + 1;
  const end = content.indexOf(FENCE, after);
  if (end === -1) return null;
  try {
    return JSON.parse(content.slice(after, end).trim());
  } catch {
    return null;
  }
}

export function parseQuickReplies(content: string): string[] {
  const open = FENCE + 'quick-replies';
  const start = content.indexOf(open);
  if (start === -1) return [];
  const after = content.indexOf('\n', start) + 1;
  const end = content.indexOf(FENCE, after);
  if (end === -1) return [];
  try {
    const parsed = JSON.parse(content.slice(after, end).trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseFlowAnimation(content: string): string | null {
  const open = FENCE + 'flow-animation';
  const start = content.indexOf(open);
  if (start === -1) return null;
  const after = content.indexOf('\n', start) + 1;
  const end = content.indexOf(FENCE, after);
  if (end === -1) return null;
  return content.slice(after, end).trim() || null;
}

export function stripBlocks(content: string): string {
  const tags = ['mvp-plan', 'quick-replies', 'flow-animation'];
  let result = content;
  for (const tag of tags) {
    const open = FENCE + tag;
    while (true) {
      const start = result.indexOf(open);
      if (start === -1) break;
      const end = result.indexOf(FENCE, start + open.length + 1);
      if (end === -1) break;
      result = result.slice(0, start) + result.slice(end + FENCE.length);
    }
  }
  return result.trim();
}
