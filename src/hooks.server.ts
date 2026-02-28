import type { Handle } from '@sveltejs/kit';
import { defaultSessionToken, getUserBySessionToken } from '$lib/server/sessionStore';

export const handle: Handle = async ({ event, resolve }) => {
	const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID();
	event.locals.requestId = requestId;

	const existingSession = event.cookies.get('atlas_session');
	const sessionToken = existingSession ?? defaultSessionToken;

	if (!existingSession) {
		event.cookies.set('atlas_session', sessionToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 7
		});
	}

	event.locals.user = getUserBySessionToken(sessionToken);

	const response = await resolve(event);
	response.headers.set('x-request-id', requestId);
	return response;
};
