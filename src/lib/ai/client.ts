import OpenAI from 'openai';
import { db } from '$lib/db';
import { aiModels } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getAIClient(modelId?: string): Promise<{ client: OpenAI; model: string }> {
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
