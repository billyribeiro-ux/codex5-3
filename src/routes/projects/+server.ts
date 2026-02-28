import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import type { ProjectsEndpointRequest, ProjectsEndpointResponse } from '$lib/projects/transport';
import { appErrorJson } from '$lib/server/httpError';
import { createServiceContext } from '$lib/server/services/context';
import { projectService } from '$lib/server/services/projectService';

const endpointRequestSchema = z.object({
	operation: z.enum(['list', 'create', 'update', 'delete']),
	payload: z.unknown().optional()
});

export const POST: RequestHandler = async (event) => {
	try {
		const parsed = endpointRequestSchema.parse((await event.request.json()) as ProjectsEndpointRequest);
		const context = createServiceContext(event);

		let response: ProjectsEndpointResponse;
		switch (parsed.operation) {
			case 'list':
				response = { projects: projectService.listProjects(context) };
				break;
			case 'create':
				response = { project: projectService.createProject(context, parsed.payload) };
				break;
			case 'update':
				response = { project: projectService.updateProject(context, parsed.payload) };
				break;
			case 'delete':
				response = projectService.deleteProject(context, parsed.payload);
				break;
			default:
				throw new Error('Unsupported projects endpoint operation');
		}

		return json(response, {
			headers: {
				'x-request-id': event.locals.requestId
			}
		});
	} catch (error) {
		return appErrorJson(error);
	}
};
