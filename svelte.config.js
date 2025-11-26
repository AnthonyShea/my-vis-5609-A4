import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build', // Output directory for static pages
      assets: 'build', // Output directory for assets
      fallback: null, // No fallback page (not an SPA)
      precompress: false // Optional: Compress output files
    }),
    prerender: {
      entries: ['*'] // Prerender all routes
    },
    // Optional: If deploying to GitHub Pages with a custom base path
    // Replace 'my-vis-5609' with your repository name
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/my-vis-5609' : ''
    }
  }
};

export default config;