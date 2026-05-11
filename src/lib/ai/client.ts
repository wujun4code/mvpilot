import OpenAI from 'openai';
import { db } from '$lib/db';
import { aiModels } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get an OpenAI-compatible client using the default enabled model from DB.
 * Swap provider any time via admin — zero code changes.
 */
export async function getAIClient(): Promise<{ client: OpenAI; model: string }> {
  const [model] = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.enabled, true), eq(aiModels.isDefault, true)))
    .limit(1);

  if (!model) {
    // Fallback: first enabled model
    const [fallback] = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.enabled, true))
      .orderBy(aiModels.sortOrder)
      .limit(1);

    if (!fallback) {
      throw new Error('No AI model configured. Add one via /admin/models.');
    }

    return {
      client: new OpenAI({ apiKey: fallback.apiKey, baseURL: fallback.apiEndpoint }),
      model: fallback.apiModel,
    };
  }

  return {
    client: new OpenAI({ apiKey: model.apiKey, baseURL: model.apiEndpoint }),
    model: model.apiModel,
  };
}
