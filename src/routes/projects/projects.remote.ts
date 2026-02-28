import { command, getRequestEvent, query } from '$app/server';
import type { CreateProjectInput, DeleteProjectInput, Project, UpdateProjectInput } from '$lib/projects/contracts';
import { throwHttpAppError } from '$lib/server/httpError';
import { createServiceContext } from '$lib/server/services/context';
import { projectService } from '$lib/server/services/projectService';

const withServiceContext = <T>(operation: (context: ReturnType<typeof createServiceContext>) => T): T => {
	const event = getRequestEvent();
	const context = createServiceContext(event);
	return operation(context);
};

const runSafely = <T>(operation: () => T): T => {
	try {
		return operation();
	} catch (error) {
		throwHttpAppError(error);
		throw error;
	}
};

export const listProjectsRemote = query(async (): Promise<Project[]> =>
	runSafely(() => withServiceContext((context) => projectService.listProjects(context)))
);

export const createProjectRemote = command('unchecked', async (input: CreateProjectInput): Promise<Project> =>
	runSafely(() => withServiceContext((context) => projectService.createProject(context, input)))
);

export const updateProjectRemote = command('unchecked', async (input: UpdateProjectInput): Promise<Project> =>
	runSafely(() => withServiceContext((context) => projectService.updateProject(context, input)))
);

export const deleteProjectRemote = command(
	'unchecked',
	async (input: DeleteProjectInput): Promise<{ deletedId: string }> =>
		runSafely(() => withServiceContext((context) => projectService.deleteProject(context, input)))
);
