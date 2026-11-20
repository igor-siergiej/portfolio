import shared from '@imapps/oxc-config/oxlint';
import { defineConfig } from 'oxlint';

export default defineConfig({
    ...shared,
    ignorePatterns: [
        ...(shared.ignorePatterns ?? []),
        '.factory/**',
        'dist/**',
        '.astro/**',
        'coverage/**',
        'test-results/**',
        'playwright-report/**',
        'markdoc.config.timestamp-*.mjs',
    ],
    rules: {
        ...shared.rules,
        'one-var': ['error', 'never'],
    },
    overrides: [
        ...(shared.overrides ?? []),
        {
            files: ['src/**/*'],
            rules: {
                'typescript/no-explicit-any': 'off',
                'no-unused-vars': 'off',
                'typescript/no-non-null-assertion': 'off',
            },
        },
        {
            files: ['src/content.config.ts'],
            rules: { 'typescript/ban-ts-comment': 'off' },
        },
    ],
});
