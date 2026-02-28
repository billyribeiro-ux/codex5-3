import type { RequestEvent } from '@sveltejs/kit';
import { AppError } from '$lib/errors/appError';

export interface AuthUser {
	id: string;
	role: 'admin' | 'member';
}

export const requireAuthenticatedUser = (event: RequestEvent): AuthUser => {
	const user = event.locals.user;
	if (!user) {
		throw new AppError({
			code: 'AUTH_UNAUTHORIZED',
			httpStatus: 401,
			message: 'Authentication required',
			retriable: false
		});
	}

	return user;
};
