import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { AppError } from '$lib/errors/appError';
import { appErrorJson } from '$lib/server/httpError';
import { createSystemServiceContext } from '$lib/server/services/context';
import { projectService } from '$lib/server/services/projectService';

const webhookSchema = z.object({
	event: z.enum(['project.created', 'project.updated', 'project.deleted']),
	payload: z.unknown()
});

const authorizeWebhook = (request: Request): void => {
	const configuredSecret = env.ATLAS_WEBHOOK_SECRET;
	if (!configuredSecret) {
		throw new AppError({
			code: 'INTERNAL',
			httpStatus: 500,
			message: 'ATLAS_WEBHOOK_SECRET is not configured',
			retriable: false
		});
	}

	const incoming = request.headers.get('x-atlas-webhook-secret');
	if (incoming !== configuredSecret) {
		throw new AppError({
			code: 'AUTH_FORBIDDEN',
			httpStatus: 403,
			message: 'Webhook signature validation failed',
			retriable: false
		});
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		authorizeWebhook(event.request);
		const input = webhookSchema.parse(await event.request.json());
		const context = createSystemServiceContext(event.locals.requestId);

		switch (input.event) {
			case 'project.created': {
				const project = projectService.createProject(context, input.payload);
				return json({ ok: true, project });
			}
			case 'project.updated': {
				const project = projectService.updateProject(context, input.payload);
				return json({ ok: true, project });
			}
			case 'project.deleted': {
				const deleted = projectService.deleteProject(context, input.payload);
				return json({ ok: true, ...deleted });
			}
		}
	} catch (error) {
		return appErrorJson(error);
	}
};
