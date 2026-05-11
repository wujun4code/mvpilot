import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid();
}

export function parseMvpPlan(content: string): object | null {
  const match = content.match(/`{3}mvp-plan\s*([\s\S]*?)`{3}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

export function parseFlowAnimation(content: string): string | null {
  const match = content.match(/`{3}flow-animation\s*([\s\S]*?)`{3}/);
  if (!match) return null;
  return match[1].trim() || null;
}


  const match = content.match(/`{3}quick-replies\s*([\s\S]*?)`{3}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1].trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stripBlocks(content: string): string {
  return content
    .replace(/`{3}quick-replies[\s\S]*?`{3}/g, '')
    .replace(/`{3}mvp-plan[\s\S]*?`{3}/g, '')
    .replace(/`{3}flow-animation[\s\S]*?`{3}/g, '')
    .trim();
}
