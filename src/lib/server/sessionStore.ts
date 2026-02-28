import type { AuthUser } from '$lib/server/auth';

const DEMO_SESSION_TOKEN = 'dev-session-token';

const sessions = new Map<string, AuthUser>([
	[
		DEMO_SESSION_TOKEN,
		{
			id: 'atlas-demo-user',
			role: 'admin'
		}
	]
]);

export const defaultSessionToken = DEMO_SESSION_TOKEN;

export const getUserBySessionToken = (token: string | undefined): AuthUser | null => {
	if (!token) return null;
	return sessions.get(token) ?? null;
};
