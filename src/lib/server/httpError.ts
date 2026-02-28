import { error, json } from '@sveltejs/kit';
import { toAppErrorData } from '$lib/errors/appError';

export const throwHttpAppError = (cause: unknown): never => {
	const appError = toAppErrorData(cause);
	throw error(appError.httpStatus, appError);
};

export const appErrorJson = (cause: unknown): Response => {
	const appError = toAppErrorData(cause);
	return json(appError, { status: appError.httpStatus });
};
