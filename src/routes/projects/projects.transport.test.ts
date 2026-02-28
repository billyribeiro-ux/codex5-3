import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import { actions } from './+page.server';
import type { RequestEvent } from '@sveltejs/kit';

const locals = {
	requestId: 'integration-request-id',
	user: {
		id: 'integration-user-id',
		role: 'admin' as const
	}
};

const asEvent = (request: Request): RequestEvent =>
	({
		request,
		locals
	} as unknown as RequestEvent);

describe('projects transports integration', () => {
	it('creates project via +server fallback endpoint', async () => {
		const request = new Request('http://localhost/projects', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				operation: 'create',
				payload: {
					name: 'Endpoint Created Project',
					description: 'created through endpoint test'
				}
			})
		});

		const response = await POST(asEvent(request));
		expect(response.status).toBe(200);

		const body = (await response.json()) as { project: { name: string } };
		expect(body.project.name).toBe('Endpoint Created Project');
	});

	it('creates project via form action transport', async () => {
		const formData = new FormData();
		formData.set('name', 'Action Created Project');
		formData.set('description', 'created through action test');

		const request = new Request('http://localhost/projects?/create', {
			method: 'POST',
			body: formData
		});

		const result = await actions.create(asEvent(request));
		expect(result).toBeTypeOf('object');
		expect(result).toHaveProperty('project');
		expect((result as { project: { name: string } }).project.name).toBe('Action Created Project');
	});
});
