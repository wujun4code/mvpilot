// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				DB?: D1Database;
				DEMO_QUEUE?: Queue;
				ADMIN_TOKEN?: string;
				TELEGRAM_BOT_TOKEN?: string;
				TELEGRAM_CHAT_ID?: string;
				PUBLIC_BASE_URL?: string;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
