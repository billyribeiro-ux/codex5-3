import { deserialize } from '$app/forms';
import type { ActionResult } from '@sveltejs/kit';
import {
	isAuthFailure,
	isConflictFailure,
	isRetriableTransportFailure,
	isValidationFailure,
	toAppErrorData,
	type AppErrorData
} from '$lib/errors/appError';

export type TransportPath = 'remote' | 'fallback-endpoint' | 'fallback-action';

interface RetryPolicy {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
}

interface OptimisticConfig {
	apply: () => () => void;
}

export interface FallbackTransport<T> {
	kind: 'endpoint' | 'action';
	execute: () => Promise<T>;
}

export interface CallWithFallbackResult<T> {
	data: T;
	transport: TransportPath;
	remoteAttempts: number;
}

export interface CallWithFallbackOptions<T> {
	remote: () => Promise<T>;
	fallback?: FallbackTransport<T>;
	retry?: Partial<RetryPolicy>;
	optimistic?: OptimisticConfig;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
	maxAttempts: 3,
	baseDelayMs: 120,
	maxDelayMs: 900
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const nextDelay = (retry: RetryPolicy, attempt: number): number => {
	const exponential = retry.baseDelayMs * 2 ** Math.max(attempt - 1, 0);
	return Math.min(exponential, retry.maxDelayMs);
};

const shouldBlockFallback = (error: AppErrorData): boolean =>
	isAuthFailure(error) || isValidationFailure(error) || isConflictFailure(error);

const resolveRetryPolicy = (input?: Partial<RetryPolicy>): RetryPolicy => ({
	maxAttempts: input?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
	baseDelayMs: input?.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
	maxDelayMs: input?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs
});

const toFallbackError = (result: ActionResult<Record<string, unknown>, Record<string, unknown>>): unknown => {
	if (result.type === 'failure') {
		const maybeAppError = result.data?.appError;
		if (maybeAppError) {
			return maybeAppError;
		}

		return {
			code: 'INTERNAL',
			httpStatus: result.status,
			message: 'Form action failed without a typed app error',
			retriable: false
		};
	}

	if (result.type === 'error') {
		return result.error;
	}

	if (result.type === 'redirect') {
		return {
			code: 'INTERNAL',
			httpStatus: result.status,
			message: `Fallback action redirected to ${result.location}`,
			retriable: false
		};
	}

	return {
		code: 'INTERNAL',
		httpStatus: 500,
		message: 'Unexpected action response type',
		retriable: false
	};
};

export function createEndpointFallback<T>(options: {
	url: string;
	body: unknown;
	parse: (payload: unknown) => T;
}): FallbackTransport<T> {
	return {
		kind: 'endpoint',
		execute: async () => {
			const response = await fetch(options.url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify(options.body)
			});

			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw payload ?? {
					code: 'TRANSPORT_FAILURE',
					httpStatus: response.status,
					message: 'Endpoint fallback failed',
					retriable: response.status >= 500
				};
			}

			return options.parse(payload);
		}
	};
}

export function createActionFallback<T>(options: {
	action: string;
	formData: () => FormData;
	parseSuccess: (payload: unknown) => T;
}): FallbackTransport<T> {
	return {
		kind: 'action',
		execute: async () => {
			const response = await fetch(options.action, {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'x-sveltekit-action': 'true'
				},
				body: options.formData()
			});

			const serialized = await response.text();
			const result = deserialize(serialized);

			if (result.type !== 'success') {
				throw toFallbackError(result);
			}

			return options.parseSuccess(result.data);
		}
	};
}

export async function callWithFallback<T>(
	options: CallWithFallbackOptions<T>
): Promise<CallWithFallbackResult<T>> {
	const retryPolicy = resolveRetryPolicy(options.retry);
	let rollback = options.optimistic?.apply();
	const rollbackOnce = (): void => {
		if (!rollback) return;
		rollback();
		rollback = undefined;
	};

	let latestError: unknown = null;

	for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
		try {
			const data = await options.remote();
			return {
				data,
				transport: 'remote',
				remoteAttempts: attempt
			};
		} catch (error) {
			latestError = error;
			const mappedError = toAppErrorData(error);

			if (shouldBlockFallback(mappedError)) {
				rollbackOnce();
				throw mappedError;
			}

			if (!isRetriableTransportFailure(mappedError)) {
				rollbackOnce();
				throw mappedError;
			}

			if (attempt < retryPolicy.maxAttempts) {
				await sleep(nextDelay(retryPolicy, attempt));
			}
		}
	}

	if (!options.fallback) {
		rollbackOnce();
		throw toAppErrorData(latestError);
	}

	try {
		const data = await options.fallback.execute();
		return {
			data,
			transport: options.fallback.kind === 'endpoint' ? 'fallback-endpoint' : 'fallback-action',
			remoteAttempts: retryPolicy.maxAttempts
		};
	} catch (error) {
		rollbackOnce();
		throw toAppErrorData(error);
	}
}
