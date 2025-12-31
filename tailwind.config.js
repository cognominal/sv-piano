import { skeleton } from '@skeletonlabs/tw-plugin';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	plugins: [
		skeleton({
			themes: {
				preset: [{ name: 'modern', enhancements: true }]
			}
		})
	]
};
