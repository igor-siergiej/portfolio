import shared from '@imapps/oxc-config/oxfmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
    ...shared,
    ignorePatterns: [
        ...(shared.ignorePatterns ?? []),
        '.factory/**',
        'CHANGELOG.md',
        'dist/**',
        '.astro/**',
        'coverage/**',
        'test-results/**',
        'playwright-report/**',
        'markdoc.config.timestamp-*.mjs',
    ],
    overrides: [...(shared.overrides ?? []), { files: ['**/*.{yml,yaml}'], options: { tabWidth: 2 } }],
});
