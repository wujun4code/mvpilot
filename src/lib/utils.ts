import { nanoid } from 'nanoid';

export function generateId(): string {
  return nanoid();
}

export function parseMvpPlan(content: string): object | null {
  const match = content.match(/```mvp-plan\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function parseQuickReplies(content: string): string[] {
  const match = content.match(/```quick-replies\n([\s\S]*?)```/);
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
    .replace(/```quick-replies[\s\S]*?```/g, '')
    .replace(/```mvp-plan[\s\S]*?```/g, '')
    .trim();
}
