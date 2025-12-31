import adapter from '@sveltejs/adapter-auto';
import type { Config } from '@sveltejs/kit';

const config: Config = {
	kit: {
		adapter: adapter()
	},
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'control-shift'
		}
	}
};

export default config;
