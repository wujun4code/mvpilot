import { generateDemo, iterateDemo } from '../src/lib/ai/demo-gen';
import { generateStory, iterateStory } from '../src/lib/ai/story-gen';

export interface Env {
  DB: D1Database;
}

export type QueueMessage =
  | { type: 'demo-gen';  sessionId: string; modelId?: string }
  | { type: 'demo-iter'; sessionId: string; instruction: string; currentHtml: string }
  | { type: 'story-gen';  sessionId: string }
  | { type: 'story-iter'; sessionId: string; instruction: string; currentHtml: string };

export default {
  async fetch(): Promise<Response> {
    return new Response('mvpilot-consumer', { status: 200 });
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const data = msg.body;
      try {
        if (data.type === 'demo-gen') {
          console.log('[consumer] demo-gen', data.sessionId);
          await generateDemo(data.sessionId, data.modelId, env.DB);
          msg.ack();
        } else if (data.type === 'demo-iter') {
          console.log('[consumer] demo-iter', data.sessionId);
          await iterateDemo(data.sessionId, data.instruction, data.currentHtml, env.DB);
          msg.ack();
        } else if (data.type === 'story-gen') {
          console.log('[consumer] story-gen', data.sessionId);
          await generateStory(data.sessionId, env.DB);
          msg.ack();
        } else if (data.type === 'story-iter') {
          console.log('[consumer] story-iter', data.sessionId);
          await iterateStory(data.sessionId, data.instruction, data.currentHtml, env.DB);
          msg.ack();
        } else {
          msg.ack(); // unknown type, discard
        }
      } catch (err) {
        console.error('[consumer] failed, will retry:', err);
        msg.retry();
      }
    }
  },
};
