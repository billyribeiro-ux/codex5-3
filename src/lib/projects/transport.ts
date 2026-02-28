import type { Project } from '$lib/projects/contracts';

export type ProjectsEndpointOperation = 'list' | 'create' | 'update' | 'delete';

export interface ProjectsEndpointRequest {
	operation: ProjectsEndpointOperation;
	payload?: unknown;
}

export interface ProjectsEndpointResponseMap {
	list: { projects: Project[] };
	create: { project: Project };
	update: { project: Project };
	delete: { deletedId: string };
}

export type ProjectsEndpointResponse =
	| ProjectsEndpointResponseMap['list']
	| ProjectsEndpointResponseMap['create']
	| ProjectsEndpointResponseMap['update']
	| ProjectsEndpointResponseMap['delete'];
