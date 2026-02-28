import { z, ZodError } from 'zod';
import { AppError, type FieldErrors } from '$lib/errors/appError';
import type { CreateProjectInput, DeleteProjectInput, Project, UpdateProjectInput } from '$lib/projects/contracts';
import { getDb } from '$lib/server/db';
import type { ServiceContext } from '$lib/server/services/context';

const projectStatusSchema = z.enum(['active', 'archived']);

const nameSchema = z
	.string()
	.trim()
	.min(1, 'Project name is required')
	.max(120, 'Project name must be 120 characters or fewer');

const descriptionSchema = z
	.string()
	.trim()
	.max(500, 'Description must be 500 characters or fewer');

export const createProjectInputSchema = z.object({
	name: nameSchema,
	description: descriptionSchema.optional()
});

export const updateProjectInputSchema = z
	.object({
		id: z.string().uuid('Project id must be a valid UUID'),
		name: nameSchema.optional(),
		description: descriptionSchema.optional(),
		status: projectStatusSchema.optional()
	})
	.superRefine((value, refinement) => {
		if (value.name === undefined && value.description === undefined && value.status === undefined) {
			refinement.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['id'],
				message: 'Provide at least one field to update'
			});
		}
	});

export const deleteProjectInputSchema = z.object({
	id: z.string().uuid('Project id must be a valid UUID')
});

interface ProjectRow {
	id: string;
	owner_user_id: string;
	name: string;
	description: string;
	status: 'active' | 'archived';
	created_at: string;
	updated_at: string;
}

const rowToProject = (row: ProjectRow): Project => ({
	id: row.id,
	name: row.name,
	description: row.description,
	status: row.status,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	ownerUserId: row.owner_user_id
});

const toFieldErrors = (zodError: ZodError): FieldErrors => {
	const fieldErrors: FieldErrors = {};

	for (const issue of zodError.issues) {
		const field = String(issue.path[0] ?? 'form');
		if (!fieldErrors[field]) {
			fieldErrors[field] = [];
		}
		fieldErrors[field].push(issue.message);
	}

	return fieldErrors;
};

const mapZodError = (error: ZodError): AppError =>
	new AppError({
		code: 'VALIDATION',
		httpStatus: 400,
		message: 'Input validation failed',
		retriable: false,
		fieldErrors: toFieldErrors(error)
	});

const assertAuthorized = (context: ServiceContext): void => {
	if (!context.userId) {
		throw new AppError({
			code: 'AUTH_UNAUTHORIZED',
			httpStatus: 401,
			message: 'Authentication required',
			retriable: false
		});
	}
};

const auditMutation = (
	context: ServiceContext,
	action: 'create' | 'update' | 'delete',
	projectId: string
): void => {
	console.info(
		JSON.stringify({
			event: 'project.audit',
			action,
			projectId,
			userId: context.userId,
			requestId: context.requestId,
			at: new Date().toISOString()
		})
	);
};

const isUniqueConstraintError = (error: unknown): boolean => {
	if (!error || typeof error !== 'object') return false;
	const code = 'code' in error ? String(error.code) : '';
	return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
};

const asCreateInput = (input: unknown): CreateProjectInput => {
	try {
		return createProjectInputSchema.parse(input);
	} catch (error) {
		if (error instanceof ZodError) {
			throw mapZodError(error);
		}
		throw error;
	}
};

const asUpdateInput = (input: unknown): UpdateProjectInput => {
	try {
		return updateProjectInputSchema.parse(input);
	} catch (error) {
		if (error instanceof ZodError) {
			throw mapZodError(error);
		}
		throw error;
	}
};

const asDeleteInput = (input: unknown): DeleteProjectInput => {
	try {
		return deleteProjectInputSchema.parse(input);
	} catch (error) {
		if (error instanceof ZodError) {
			throw mapZodError(error);
		}
		throw error;
	}
};

const getExistingProject = (context: ServiceContext, id: string): ProjectRow | undefined => {
	const db = getDb();
	const select = db.prepare(
		`SELECT id, owner_user_id, name, description, status, created_at, updated_at
		 FROM projects
		 WHERE id = ? AND owner_user_id = ?`
	);
	return select.get(id, context.userId) as ProjectRow | undefined;
};

export const projectService = {
	listProjects(context: ServiceContext): Project[] {
		assertAuthorized(context);
		const db = getDb();
		const rows = db
			.prepare(
				`SELECT id, owner_user_id, name, description, status, created_at, updated_at
				 FROM projects
				 WHERE owner_user_id = ?
				 ORDER BY created_at DESC`
			)
			.all(context.userId) as ProjectRow[];
		return rows.map(rowToProject);
	},

	createProject(context: ServiceContext, rawInput: unknown): Project {
		assertAuthorized(context);
		const input = asCreateInput(rawInput);
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		const description = input.description ?? '';
		const db = getDb();

		try {
			db.prepare(
				`INSERT INTO projects (id, owner_user_id, name, description, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, 'active', ?, ?)`
			).run(id, context.userId, input.name, description, now, now);
		} catch (error) {
			if (isUniqueConstraintError(error)) {
				throw new AppError({
					code: 'CONFLICT',
					httpStatus: 409,
					message: 'A project with this name already exists',
					retriable: false,
					fieldErrors: { name: ['A project with this name already exists'] }
				});
			}
			throw error;
		}

		auditMutation(context, 'create', id);
		return rowToProject({
			id,
			owner_user_id: context.userId,
			name: input.name,
			description,
			status: 'active',
			created_at: now,
			updated_at: now
		});
	},

	updateProject(context: ServiceContext, rawInput: unknown): Project {
		assertAuthorized(context);
		const input = asUpdateInput(rawInput);
		const existing = getExistingProject(context, input.id);

		if (!existing) {
			throw new AppError({
				code: 'NOT_FOUND',
				httpStatus: 404,
				message: 'Project was not found',
				retriable: false
			});
		}

		const updatedRow: ProjectRow = {
			...existing,
			name: input.name ?? existing.name,
			description: input.description ?? existing.description,
			status: input.status ?? existing.status,
			updated_at: new Date().toISOString()
		};

		const db = getDb();
		try {
			db.prepare(
				`UPDATE projects
				 SET name = ?, description = ?, status = ?, updated_at = ?
				 WHERE id = ? AND owner_user_id = ?`
			).run(
				updatedRow.name,
				updatedRow.description,
				updatedRow.status,
				updatedRow.updated_at,
				updatedRow.id,
				context.userId
			);
		} catch (error) {
			if (isUniqueConstraintError(error)) {
				throw new AppError({
					code: 'CONFLICT',
					httpStatus: 409,
					message: 'A project with this name already exists',
					retriable: false,
					fieldErrors: { name: ['A project with this name already exists'] }
				});
			}
			throw error;
		}

		auditMutation(context, 'update', updatedRow.id);
		return rowToProject(updatedRow);
	},

	deleteProject(context: ServiceContext, rawInput: unknown): { deletedId: string } {
		assertAuthorized(context);
		if (context.userRole !== 'admin') {
			throw new AppError({
				code: 'AUTH_FORBIDDEN',
				httpStatus: 403,
				message: 'Only administrators can delete projects',
				retriable: false
			});
		}

		const input = asDeleteInput(rawInput);
		const db = getDb();
		const result = db
			.prepare('DELETE FROM projects WHERE id = ? AND owner_user_id = ?')
			.run(input.id, context.userId);

		if (result.changes === 0) {
			throw new AppError({
				code: 'NOT_FOUND',
				httpStatus: 404,
				message: 'Project was not found',
				retriable: false
			});
		}

		auditMutation(context, 'delete', input.id);
		return { deletedId: input.id };
	}
};
