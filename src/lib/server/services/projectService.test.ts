import { describe, expect, it } from 'vitest';
import { AppError } from '$lib/errors/appError';
import { projectService } from '$lib/server/services/projectService';
import type { ServiceContext } from '$lib/server/services/context';

const context = (overrides?: Partial<ServiceContext>): ServiceContext => ({
	requestId: 'test-request-id',
	userId: 'test-user-id',
	userRole: 'admin',
	...overrides
});

describe('projectService', () => {
	it('maps invalid create input to VALIDATION AppError', () => {
		expect(() =>
			projectService.createProject(context(), {
				name: '',
				description: 'invalid'
			})
		).toThrowError(AppError);

		try {
			projectService.createProject(context(), { name: '' });
		} catch (error) {
			expect(error).toBeInstanceOf(AppError);
			const appError = (error as AppError).data;
			expect(appError.code).toBe('VALIDATION');
			expect(appError.httpStatus).toBe(400);
			expect(appError.fieldErrors?.name?.[0]).toContain('required');
		}
	});

	it('maps sqlite uniqueness violations to CONFLICT AppError', () => {
		projectService.createProject(context(), {
			name: 'Alpha',
			description: 'first'
		});

		expect(() =>
			projectService.createProject(context(), {
				name: 'Alpha',
				description: 'duplicate'
			})
		).toThrowError(AppError);

		try {
			projectService.createProject(context(), { name: 'Alpha' });
		} catch (error) {
			const appError = (error as AppError).data;
			expect(appError.code).toBe('CONFLICT');
			expect(appError.httpStatus).toBe(409);
			expect(appError.retriable).toBe(false);
		}
	});
});
