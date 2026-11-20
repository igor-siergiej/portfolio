import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
let directory: string;

function run(command: string) {
    const result = spawnSync('bun', ['run', command], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, NO_COLOR: '1' },
    });

    if (result.error) throw result.error;

    return { status: result.status, output: result.stdout + result.stderr };
}

function succeeds(command: string) {
    const result = run(command);
    expect(result.status, result.output).toBe(0);
}

describe('contributor tooling commands', () => {
    beforeEach(() => {
        // Keep command/config resolution real, without rewriting the checkout under test.
        const fixtures = join(root, '.factory');
        mkdirSync(fixtures, { recursive: true });
        directory = mkdtempSync(join(fixtures, 'tooling-'));

        const excluded = {
            '.git': true,
            '.factory': true,
            node_modules: true,
            src: true,
            e2e: true,
            public: true,
            infra: true,
            docs: true,
            '.astro': true,
            dist: true,
            coverage: true,
            'test-results': true,
            'playwright-report': true,
        };

        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (Object.hasOwn(excluded, entry.name) || entry.name.startsWith('.env')) continue;
            cpSync(join(root, entry.name), join(directory, entry.name), { recursive: true });
        }

        symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
        mkdirSync(join(directory, 'src'));
        const git = spawnSync('git', ['init', '--quiet'], { cwd: directory, encoding: 'utf8' });
        expect(git.status, git.stderr).toBe(0);
        succeeds('format');
    });

    afterEach(() => {
        if (directory) rmSync(directory, { recursive: true, force: true });
    });

    it('checks formatting without writing, formats Markdown, and fixes lint without touching generated files', () => {
        const markdown = join(directory, 'README.md');
        const unformatted = '# Tooling\n\n-   first\n-   second\n';
        writeFileSync(markdown, unformatted);

        const checked = run('lint');
        expect(readFileSync(markdown, 'utf8')).toBe(unformatted);
        expect(checked.status, checked.output).not.toBe(0);
        expect(checked.output).toContain('README.md');

        succeeds('format');
        expect(readFileSync(markdown, 'utf8')).toBe('# Tooling\n\n- first\n- second\n');

        const source = join(directory, 'src/probe.ts');
        writeFileSync(source, 'export function answer() { let value = 42; return value; }\n');
        succeeds('format');
        const formatted = readFileSync(source, 'utf8');
        const linted = run('lint');
        expect(linted.status, linted.output).not.toBe(0);
        expect(linted.output).toMatch(/prefer.const|useConst/);
        expect(readFileSync(source, 'utf8')).toBe(formatted);

        mkdirSync(join(directory, 'dist'));
        const generated = join(directory, 'dist/generated.ts');
        const generatedBytes = 'export const broken = ;\n';
        writeFileSync(generated, generatedBytes);
        succeeds('lint:fix');
        expect(readFileSync(source, 'utf8')).toMatch(/const value = 42/);
        succeeds('format');
        expect(readFileSync(generated, 'utf8')).toBe(generatedBytes);
        succeeds('lint');
        const stable = readFileSync(source, 'utf8');
        succeeds('format');
        succeeds('lint');
        expect(readFileSync(source, 'utf8')).toBe(stable);
    });

    it('reports the shared anti-slop rule through lint and stays clean after formatting twice', () => {
        const source = join(directory, 'src/probe.ts');
        writeFileSync(
            source,
            'export const positiveDoubles = [1, -2, 3].filter((value) => value > 0).map((value) => value * 2);\n'
        );
        succeeds('format');
        const formatted = readFileSync(source, 'utf8');
        const result = run('lint');
        expect(result.output).toContain('no-array-filter-map');
        expect(result.output).toContain('probe.ts');
        expect(result.status, result.output).not.toBe(0);
        expect(readFileSync(source, 'utf8')).toBe(formatted);

        writeFileSync(
            source,
            'export const positiveDoubles = [1, -2, 3].flatMap((value) => value > 0 ? [value * 2] : []);\n'
        );
        succeeds('lint:fix');
        succeeds('format');
        succeeds('lint');
        const stable = readFileSync(source, 'utf8');
        succeeds('format');
        succeeds('lint');
        expect(readFileSync(source, 'utf8')).toBe(stable);
    });
});
