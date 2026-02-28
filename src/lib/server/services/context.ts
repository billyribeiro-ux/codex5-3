import type { RequestEvent } from '@sveltejs/kit';
import { AppError } from '$lib/errors/appError';
import { requireAuthenticatedUser, type AuthUser } from '$lib/server/auth';

export interface ServiceContext {
	requestId: string;
	userId: string;
	userRole: AuthUser['role'];
}

export const createServiceContext = (event: RequestEvent): ServiceContext => {
	const user = requireAuthenticatedUser(event);

	if (!event.locals.requestId) {
		throw new AppError({
			code: 'INTERNAL',
			httpStatus: 500,
			message: 'Missing request id on server context',
			retriable: true
		});
	}

	return {
		requestId: event.locals.requestId,
		userId: user.id,
		userRole: user.role
	};
};

export const createSystemServiceContext = (requestId: string): ServiceContext => ({
	requestId,
	userId: 'atlas-webhook-system',
	userRole: 'admin'
});
