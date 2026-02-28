// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			code: string;
			httpStatus: number;
			message: string;
			retriable: boolean;
			fieldErrors?: Record<string, string[]>;
		}

		interface Locals {
			requestId: string;
			user: {
				id: string;
				role: 'admin' | 'member';
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
