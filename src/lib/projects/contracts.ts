export type ProjectStatus = 'active' | 'archived';

export interface Project {
	id: string;
	name: string;
	description: string;
	status: ProjectStatus;
	createdAt: string;
	updatedAt: string;
	ownerUserId: string;
}

export interface CreateProjectInput {
	name: string;
	description?: string;
}

export interface UpdateProjectInput {
	id: string;
	name?: string;
	description?: string;
	status?: ProjectStatus;
}

export interface DeleteProjectInput {
	id: string;
}
