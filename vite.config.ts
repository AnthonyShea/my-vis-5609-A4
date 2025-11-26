import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],  // Adjust if needed
	base: '/my-vis-5609-A1/',  // For GitHub Pages
	server: {
	  fs: {
		allow: ['..', './']  // Allow parent and root dirs (covers static/ safely)
	  }
	}
  });
