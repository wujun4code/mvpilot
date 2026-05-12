import OpenAI from 'openai';
import { getDb } from '$lib/db';
import { aiModels } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getAIClient(modelId?: string, d1?: D1Database): Promise<{ client: OpenAI; model: string }> {
  const db = getDb(d1);
  let row = null;

  if (modelId) {
    [row] = await db.select().from(aiModels)
      .where(and(eq(aiModels.id, modelId), eq(aiModels.enabled, true)))
      .limit(1);
  }

  if (!row) {
    [row] = await db.select().from(aiModels)
      .where(and(eq(aiModels.enabled, true), eq(aiModels.isDefault, true)))
      .limit(1);
  }

  if (!row) {
    [row] = await db.select().from(aiModels)
      .where(eq(aiModels.enabled, true))
      .orderBy(aiModels.sortOrder)
      .limit(1);
  }

  if (!row) throw new Error('No AI model configured.');

  return {
    client: new OpenAI({ apiKey: row.apiKey, baseURL: row.apiEndpoint }),
    model: row.apiModel,
  };
}
