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
