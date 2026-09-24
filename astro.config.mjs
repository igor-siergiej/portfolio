import { mkdirSync, writeFileSync } from 'node:fs';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Custom keystatic integration for Cloud mode with static output
const keystatic = () => {
    return {
        name: 'keystatic',
        hooks: {
            'astro:config:setup': ({ updateConfig, config }) => {
                // Server config for keystatic dev mode
                updateConfig({
                    server: config.server.host
                        ? {}
                        : {
                              host: '127.0.0.1',
                          },
                    vite: {
                        plugins: [
                            {
                                name: 'keystatic',
                                resolveId(id) {
                                    if (id === 'virtual:keystatic-config') {
                                        return this.resolve('./keystatic.config', './a');
                                    }
                                    return null;
                                },
                            },
                        ],
                        optimizeDeps: {
                            entries: ['keystatic.config.*', '.astro/keystatic-imports.js'],
                        },
                    },
                });

                // Create keystatic-imports file
                const dotAstroDir = new URL('./.astro/', config.root);
                mkdirSync(dotAstroDir, { recursive: true });
                writeFileSync(
                    new URL('keystatic-imports.js', dotAstroDir),
                    `import "@keystatic/astro/ui";\nimport "@keystatic/core/ui";\n`
                );
            },
        },
    };
};

// https://astro.build/config
export default defineConfig({
    // `|| ` (not `??`): an unset `vars.SITE_URL` in CI is passed through as `''`, not
    // undefined — `??` wouldn't fall back for that, and astro build fails on `site: ''`.
    site: process.env.SITE_URL || 'http://localhost:4321',
    output: 'static',
    integrations: [
        react(),
        markdoc(),
        keystatic(),
        // The Keystatic admin isn't content — robots.txt disallows it too, so keep it out
        // of the sitemap or Search Console reports "Submitted URL blocked by robots.txt".
        sitemap({ filter: (page) => !page.includes('/keystatic') }),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});
