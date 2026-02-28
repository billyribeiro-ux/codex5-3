import { fail } from '@sveltejs/kit';
import type { Actions, RequestEvent, ServerLoad } from '@sveltejs/kit';
import { toAppErrorData } from '$lib/errors/appError';
import { throwHttpAppError } from '$lib/server/httpError';
import { createServiceContext } from '$lib/server/services/context';
import { projectService } from '$lib/server/services/projectService';

const isActionFailureStatus = (status: number): boolean => status >= 400 && status < 500;

export const load: ServerLoad = async (event: RequestEvent) => {
	try {
		const context = createServiceContext(event);
		return {
			projects: projectService.listProjects(context),
			requestId: event.locals.requestId
		};
	} catch (error) {
		throwHttpAppError(error);
	}
};

export const actions: Actions = {
	create: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const input = {
			name: String(formData.get('name') ?? ''),
			description: String(formData.get('description') ?? '').trim() || undefined
		};

		try {
			const context = createServiceContext(event);
			return {
				project: projectService.createProject(context, input)
			};
		} catch (error) {
			const appError = toAppErrorData(error);
			if (isActionFailureStatus(appError.httpStatus)) {
				return fail(appError.httpStatus, { appError });
			}
			throwHttpAppError(appError);
		}
	},

	update: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const input = {
			id: String(formData.get('id') ?? ''),
			name: String(formData.get('name') ?? '').trim() || undefined,
			description: String(formData.get('description') ?? '').trim() || undefined,
			status: String(formData.get('status') ?? '').trim() || undefined
		};

		try {
			const context = createServiceContext(event);
			return {
				project: projectService.updateProject(context, input)
			};
		} catch (error) {
			const appError = toAppErrorData(error);
			if (isActionFailureStatus(appError.httpStatus)) {
				return fail(appError.httpStatus, { appError });
			}
			throwHttpAppError(appError);
		}
	},

	delete: async (event: RequestEvent) => {
		const formData = await event.request.formData();
		const input = {
			id: String(formData.get('id') ?? '')
		};

		try {
			const context = createServiceContext(event);
			return projectService.deleteProject(context, input);
		} catch (error) {
			const appError = toAppErrorData(error);
			if (isActionFailureStatus(appError.httpStatus)) {
				return fail(appError.httpStatus, { appError });
			}
			throwHttpAppError(appError);
		}
	}
};
