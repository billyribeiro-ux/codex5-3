<script lang="ts">
	import {
		callWithFallback,
		createActionFallback,
		createEndpointFallback,
		type TransportPath
	} from '$lib/client/callWithFallback';
	import { toAppErrorData, type AppErrorData } from '$lib/errors/appError';
	import type { Project } from '$lib/projects/contracts';
	import {
		createProjectRemote,
		deleteProjectRemote,
		listProjectsRemote,
		updateProjectRemote
	} from './projects.remote';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let projects = $state<Project[]>([...data.projects]);
	let isBusy = $state(false);
	let simulateTransportFailure = $state(false);
	let lastTransport = $state<TransportPath | null>(null);
	let remoteAttempts = $state(0);

	let initialError: AppErrorData | null = null;
	if (form && typeof form === 'object' && 'appError' in form) {
		initialError = ((form as { appError?: AppErrorData }).appError ?? null) as AppErrorData | null;
	}
	let globalError = $state<AppErrorData | null>(initialError);

	const withOptionalTransportFailure = <T>(operation: () => Promise<T>): (() => Promise<T>) => {
		return async () => {
			if (simulateTransportFailure) {
				throw new TypeError('Simulated transport failure');
			}

			return operation();
		};
	};

	const setTransportMeta = (transport: TransportPath, attempts: number): void => {
		lastTransport = transport;
		remoteAttempts = attempts;
	};

	const parseProjectResponse = (payload: unknown): Project => {
		if (!payload || typeof payload !== 'object' || !('project' in payload)) {
			throw {
				code: 'INTERNAL',
				httpStatus: 500,
				message: 'Invalid project payload from fallback response',
				retriable: false
			};
		}

		return (payload as { project: Project }).project;
	};

	const parseDeleteResponse = (payload: unknown): { deletedId: string } => {
		if (!payload || typeof payload !== 'object' || !('deletedId' in payload)) {
			throw {
				code: 'INTERNAL',
				httpStatus: 500,
				message: 'Invalid delete payload from fallback response',
				retriable: false
			};
		}

		return payload as { deletedId: string };
	};

	const parseListResponse = (payload: unknown): Project[] => {
		if (!payload || typeof payload !== 'object' || !('projects' in payload)) {
			throw {
				code: 'INTERNAL',
				httpStatus: 500,
				message: 'Invalid list payload from fallback response',
				retriable: false
			};
		}

		return (payload as { projects: Project[] }).projects;
	};

	const upsertProject = (project: Project): void => {
		const exists = projects.some((entry) => entry.id === project.id);
		projects = exists
			? projects.map((entry) => (entry.id === project.id ? project : entry))
			: [project, ...projects];
	};

	const removeProject = (projectId: string): void => {
		projects = projects.filter((entry) => entry.id !== projectId);
	};

	const refreshProjects = async (): Promise<void> => {
		globalError = null;
		isBusy = true;

		try {
			const result = await callWithFallback<Project[]>({
				remote: withOptionalTransportFailure(() => listProjectsRemote()),
				fallback: createEndpointFallback({
					url: '/projects',
					body: { operation: 'list' },
					parse: parseListResponse
				})
			});

			projects = result.data;
			setTransportMeta(result.transport, result.remoteAttempts);
		} catch (error) {
			globalError = toAppErrorData(error);
		} finally {
			isBusy = false;
		}
	};

	const onCreateSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		globalError = null;

		const formElement = event.currentTarget as HTMLFormElement;
		const formData = new FormData(formElement);
		const name = String(formData.get('name') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || undefined;
		const input = { name, description };
		let optimisticId = '';

		isBusy = true;
		try {
			const result = await callWithFallback<Project>({
				remote: withOptionalTransportFailure(() => createProjectRemote(input)),
				fallback: createActionFallback({
					action: '?/create',
					formData: () => {
						const fallbackForm = new FormData();
						fallbackForm.set('name', input.name);
						if (input.description) fallbackForm.set('description', input.description);
						return fallbackForm;
					},
					parseSuccess: parseProjectResponse
				}),
				optimistic: {
					apply: () => {
						optimisticId = `optimistic-${crypto.randomUUID()}`;
						const now = new Date().toISOString();
						projects = [
							{
								id: optimisticId,
								name: input.name,
								description: input.description ?? '',
								status: 'active',
								createdAt: now,
								updatedAt: now,
								ownerUserId: 'optimistic-client'
							},
							...projects
						];
						return () => removeProject(optimisticId);
					}
				}
			});

			upsertProject(result.data);
			removeProject(optimisticId);
			setTransportMeta(result.transport, result.remoteAttempts);
			formElement.reset();
		} catch (error) {
			globalError = toAppErrorData(error);
		} finally {
			isBusy = false;
		}
	};

	const onToggleStatus = async (project: Project): Promise<void> => {
		globalError = null;
		const nextStatus = project.status === 'active' ? 'archived' : 'active';
		const original = { ...project };
		isBusy = true;

		try {
			const result = await callWithFallback<Project>({
				remote: withOptionalTransportFailure(() =>
					updateProjectRemote({
						id: project.id,
						status: nextStatus
					})
				),
				fallback: createEndpointFallback({
					url: '/projects',
					body: {
						operation: 'update',
						payload: {
							id: project.id,
							status: nextStatus
						}
					},
					parse: parseProjectResponse
				}),
				optimistic: {
					apply: () => {
						upsertProject({ ...project, status: nextStatus, updatedAt: new Date().toISOString() });
						return () => upsertProject(original);
					}
				}
			});

			upsertProject(result.data);
			setTransportMeta(result.transport, result.remoteAttempts);
		} catch (error) {
			globalError = toAppErrorData(error);
		} finally {
			isBusy = false;
		}
	};

	const onDeleteProject = async (project: Project): Promise<void> => {
		globalError = null;
		const snapshot = [...projects];
		isBusy = true;

		try {
			const result = await callWithFallback<{ deletedId: string }>({
				remote: withOptionalTransportFailure(() => deleteProjectRemote({ id: project.id })),
				fallback: createEndpointFallback({
					url: '/projects',
					body: {
						operation: 'delete',
						payload: { id: project.id }
					},
					parse: parseDeleteResponse
				}),
				optimistic: {
					apply: () => {
						removeProject(project.id);
						return () => {
							projects = snapshot;
						};
					}
				}
			});

			removeProject(result.data.deletedId);
			setTransportMeta(result.transport, result.remoteAttempts);
		} catch (error) {
			globalError = toAppErrorData(error);
		} finally {
			isBusy = false;
		}
	};
</script>

<svelte:head>
	<title>Atlas Projects</title>
</svelte:head>

<main class="atlas-page">
	<header class="hero">
		<h1>Atlas Transport Architecture</h1>
		<p>
			Request ID: <code>{data.requestId}</code>
		</p>
		<div class="meta">
			<p>Last transport: <strong>{lastTransport ?? 'none yet'}</strong></p>
			<p>Remote attempts: <strong>{remoteAttempts}</strong></p>
		</div>
	</header>

	<section class="controls card">
		<label class="toggle">
			<input type="checkbox" bind:checked={simulateTransportFailure} />
			<span>Simulate remote transport failures (to verify fallback behavior)</span>
		</label>
		<button type="button" onclick={refreshProjects} disabled={isBusy}>Refresh projects</button>
	</section>

	<section class="card">
		<h2>Create project (remote-first, action fallback)</h2>
		<form method="POST" action="?/create" onsubmit={onCreateSubmit}>
			<label>
				Name
				<input name="name" maxlength="120" required />
			</label>
			<label>
				Description
				<textarea name="description" rows="3" maxlength="500"></textarea>
			</label>
			<button type="submit" disabled={isBusy}>Create project</button>
		</form>
		<noscript>
			<p>JavaScript is disabled. The form will submit directly to the create action.</p>
		</noscript>
	</section>

	{#if globalError}
		<section class="card error">
			<h2>{globalError.code}</h2>
			<p>{globalError.message}</p>
			<p>HTTP {globalError.httpStatus} · retriable: {String(globalError.retriable)}</p>
			{#if globalError.fieldErrors}
				<ul>
					{#each Object.entries(globalError.fieldErrors) as [field, messages]}
						<li><strong>{field}:</strong> {messages.join(', ')}</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<section class="card">
		<h2>Projects ({projects.length})</h2>
		{#if projects.length === 0}
			<p>No projects yet.</p>
		{:else}
			<ul class="project-list">
				{#each projects as project (project.id)}
					<li>
						<div>
							<h3>{project.name}</h3>
							<p>{project.description || 'No description'}</p>
							<p class="small">Status: {project.status}</p>
						</div>
						<div class="actions">
							<button type="button" onclick={() => onToggleStatus(project)} disabled={isBusy}>
								{project.status === 'active' ? 'Archive' : 'Activate'}
							</button>
							<button type="button" class="danger" onclick={() => onDeleteProject(project)} disabled={isBusy}>
								Delete
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'IBM Plex Sans', 'Avenir Next', sans-serif;
		background: radial-gradient(circle at 20% 20%, #f2f8ff 0%, #eef6f2 45%, #fdfbf7 100%);
		color: #1c2a2f;
	}

	.atlas-page {
		max-width: 920px;
		margin: 2rem auto;
		display: grid;
		gap: 1rem;
		padding: 0 1rem 2rem;
	}

	.hero h1 {
		margin: 0 0 0.35rem;
		font-size: clamp(1.6rem, 2.4vw, 2.2rem);
	}

	.hero p {
		margin: 0.1rem 0;
	}

	.meta {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.card {
		background: rgb(255 255 255 / 82%);
		border: 1px solid rgb(16 43 53 / 10%);
		backdrop-filter: blur(4px);
		border-radius: 12px;
		padding: 1rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}

	input,
	textarea,
	button {
		font: inherit;
	}

	input,
	textarea {
		padding: 0.55rem;
		border-radius: 8px;
		border: 1px solid #b9c8cf;
	}

	button {
		border: none;
		padding: 0.5rem 0.8rem;
		border-radius: 8px;
		background: #146c79;
		color: #fff;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.error {
		border-color: rgb(201 32 36 / 35%);
		background: rgb(255 241 241 / 90%);
	}

	.project-list {
		display: grid;
		gap: 0.8rem;
		padding: 0;
		list-style: none;
	}

	.project-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem;
		border-radius: 10px;
		border: 1px solid rgb(25 57 54 / 16%);
		background: rgb(255 255 255 / 75%);
	}

	.project-list h3 {
		margin: 0;
	}

	.small {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.actions {
		display: grid;
		gap: 0.4rem;
		align-content: center;
	}

	.danger {
		background: #af2f30;
	}

	@media (max-width: 640px) {
		.project-list li {
			flex-direction: column;
		}

		.actions {
			display: flex;
			gap: 0.6rem;
		}
	}
</style>
