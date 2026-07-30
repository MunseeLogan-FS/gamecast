import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

function deploymentCacheHeaders(): Plugin {
	return {
		name: 'deployment-cache-headers',
		configurePreviewServer(server) {
			server.middlewares.use((request, response, next) => {
				const path = (request as { url?: string }).url?.split('?')[0] ?? '/';
				response.setHeader(
					'Cache-Control',
					path.startsWith('/_app/immutable/') ? 'public, max-age=31536000, immutable' : 'no-store'
				);
				next();
			});
		}
	};
}

export default defineConfig({
	plugins: [
		deploymentCacheHeaders(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		})
	],
	server: {
		host: true,
		port: 8081,
		strictPort: true,
		allowedHosts: ['pirates.munsee.dev']
	},
	preview: {
		host: true,
		port: 8081,
		strictPort: true,
		allowedHosts: ['pirates.munsee.dev']
	}
});
