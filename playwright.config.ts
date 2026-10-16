import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // Build inline so the suite always runs against the current source rather than a stale
    // `dist/` left over from an earlier run. `--ignore-lock` opts out of the lockfile *and*
    // of Astro 7.2+'s agent-detected background mode, which would otherwise detach the preview
    // server and exit the foreground before Playwright could health-check it
    // (https://github.com/withastro/astro/issues/17721).
    webServer: {
        command: 'bun run build && bun run preview --ignore-lock',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
    },
    use: {
        baseURL: 'http://localhost:4321',
    },
});
