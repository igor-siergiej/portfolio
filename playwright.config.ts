import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // Build inline so the suite always runs against the current source rather than a stale
    // `dist/` left over from an earlier run.
    webServer: {
        command: 'bun run build && bun run preview',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
    },
    use: {
        baseURL: 'http://localhost:4321',
    },
});
