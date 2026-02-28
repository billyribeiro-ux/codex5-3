import { z } from 'zod';

export const appErrorCodeSchema = z.enum([
	'AUTH_UNAUTHORIZED',
	'AUTH_FORBIDDEN',
	'VALIDATION',
	'CONFLICT',
	'NOT_FOUND',
	'TRANSPORT_FAILURE',
	'INTERNAL'
]);

export const appErrorSchema = z.object({
	code: appErrorCodeSchema,
	httpStatus: z.number().int().min(400).max(599),
	message: z.string(),
	retriable: z.boolean(),
	fieldErrors: z.record(z.string(), z.array(z.string())).optional()
});

export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;
export type AppErrorData = z.infer<typeof appErrorSchema>;
export type FieldErrors = NonNullable<AppErrorData['fieldErrors']>;

const FALLBACK_INTERNAL_ERROR: AppErrorData = {
	code: 'INTERNAL',
	httpStatus: 500,
	message: 'An unexpected error occurred',
	retriable: true
};

export class AppError extends Error {
	readonly data: AppErrorData;

	constructor(data: AppErrorData) {
		super(data.message);
		this.name = 'AppError';
		this.data = data;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

export const isAppErrorData = (value: unknown): value is AppErrorData =>
	appErrorSchema.safeParse(value).success;

export function toAppErrorData(error: unknown): AppErrorData {
	if (error instanceof AppError) {
		return error.data;
	}

	if (isAppErrorData(error)) {
		return error;
	}

	if (isRecord(error) && isAppErrorData(error.body)) {
		return error.body;
	}

	if (isRecord(error)) {
		const status = typeof error.status === 'number' ? error.status : undefined;
		const message = typeof error.message === 'string' ? error.message : undefined;

		if (status && status >= 500) {
			return {
				code: 'TRANSPORT_FAILURE',
				httpStatus: status,
				message: message ?? 'Remote transport failed',
				retriable: true
			};
		}
	}

	if (error instanceof TypeError) {
		return {
			code: 'TRANSPORT_FAILURE',
			httpStatus: 503,
			message: error.message || 'Network transport failure',
			retriable: true
		};
	}

	return FALLBACK_INTERNAL_ERROR;
}

export const isAuthFailure = (error: AppErrorData): boolean =>
	error.code === 'AUTH_UNAUTHORIZED' || error.code === 'AUTH_FORBIDDEN';

export const isValidationFailure = (error: AppErrorData): boolean =>
	error.code === 'VALIDATION' || error.httpStatus === 400;

export const isConflictFailure = (error: AppErrorData): boolean =>
	error.code === 'CONFLICT' || error.httpStatus === 409;

export function isRetriableTransportFailure(error: unknown): boolean {
	const appError = toAppErrorData(error);
	if (appError.code === 'TRANSPORT_FAILURE') return true;
	return appError.retriable && appError.httpStatus >= 500;
}
