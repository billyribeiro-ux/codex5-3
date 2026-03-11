<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<main>
	<h1>Atlas Transport Architecture</h1>
	<p>Open the projects module demo:</p>
	<p><a href={resolve('/projects')}>/projects</a></p>
</main>

<style>
	main {
		max-width: 680px;
		margin: 4rem auto;
		padding: 0 1rem;
		font-family: 'IBM Plex Sans', 'Avenir Next', sans-serif;
	}

	a {
		color: #146c79;
		font-weight: 600;
	}
</style>
