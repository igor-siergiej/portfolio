import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // `|| ` (not `??`): an unset `vars.SITE_URL` in CI is passed through as `''`, not
    // undefined — `??` wouldn't fall back for that, and astro build fails on `site: ''`.
    site: process.env.SITE_URL || 'http://localhost:4321',
    output: 'static',
    integrations: [react(), markdoc(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
});
