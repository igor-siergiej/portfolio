import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
let directory: string;

function command(binary: string, args: string[]) {
    const result = spawnSync(binary, args, {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, NO_COLOR: '1' },
    });

    if (result.error) throw result.error;

    return { status: result.status, output: result.stdout + result.stderr };
}

function succeeds(binary: string, args: string[]) {
    const result = command(binary, args);
    expect(result.status, result.output).toBe(0);
}

function put(path: string, content: string) {
    const file = join(directory, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);

    return file;
}

describe('tooling boundaries', () => {
    beforeEach(() => {
        mkdirSync(join(root, '.factory'), { recursive: true });
        directory = mkdtempSync(join(root, '.factory', 'boundaries-'));

        for (const file of ['package.json', 'oxlint.config.mts', 'oxfmt.config.mts', '.gitignore']) {
            cpSync(join(root, file), join(directory, file));
        }

        cpSync(join(root, 'scripts'), join(directory, 'scripts'), { recursive: true });

        symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
        succeeds('git', ['init', '--quiet']);
        succeeds('bun', ['run', 'format']);
    });

    afterEach(() => {
        if (directory) rmSync(directory, { recursive: true, force: true });
    });

    it.each([
        'dist/generated.ts',
        '.astro/types.d.ts',
        'coverage/generated.ts',
        'test-results/result.ts',
        'playwright-report/result.ts',
        'markdoc.config.timestamp-123.mjs',
        '.factory/probe.ts',
        '.claude/probe.ts',
        '.playwright-mcp/probe.ts',
        '.superpowers/probe.ts',
        'docs/superpowers/probe.ts',
    ])('leaves generated or agent file %s untouched', (path) => {
        const bytes = 'export const invalid = ;\n';
        const file = put(path, bytes);
        succeeds('bun', ['run', 'lint:fix']);
        succeeds('bun', ['run', 'lint']);
        expect(readFileSync(file, 'utf8')).toBe(bytes);
    });

    it('applies the staged hook to source and Markdown but not generated output', () => {
        const source = put('src/probe.ts', 'export function answer() { let value = 42; return value; }\n');
        const markdown = put('notes.md', '# Notes\n\n-   first\n');
        const generated = put('dist/generated.ts', 'export const invalid = ;\n');
        succeeds('git', ['add', '--force', 'dist/generated.ts']);
        succeeds('git', [
            '-c',
            'user.name=Tooling test',
            '-c',
            'user.email=tooling@example.invalid',
            '-c',
            'core.hooksPath=/dev/null',
            'commit',
            '--quiet',
            '-m',
            'test: track generated fixture',
        ]);
        succeeds('git', ['add', 'src/probe.ts', 'notes.md']);
        succeeds('git', ['add', '--force', 'dist/generated.ts']);
        succeeds('bunx', ['--no-install', 'lint-staged', '--no-stash']);
        expect(readFileSync(source, 'utf8')).toBe(
            'export function answer() {\n    const value = 42;\n\n    return value;\n}\n'
        );
        expect(readFileSync(markdown, 'utf8')).toBe('# Notes\n\n- first\n');
        expect(readFileSync(generated, 'utf8')).toBe('export const invalid = ;\n');
    });

    it('lints Astro frontmatter while leaving its disabled formatting unchanged', () => {
        const bytes = '---\nlet answer = 42;\n---\n<h1>{answer}</h1>\n';
        const file = put('src/probe.astro', bytes);
        const result = command('bun', ['run', 'lint']);
        expect(result.status, result.output).not.toBe(0);
        expect(result.output).toContain('prefer-const');
        succeeds('bun', ['run', 'format']);
        expect(readFileSync(file, 'utf8')).toBe(bytes);
        succeeds('bun', ['run', 'lint:fix']);
        expect(readFileSync(file, 'utf8')).toContain('const answer = 42;');
        writeFileSync(file, bytes);
        succeeds('git', ['add', 'src/probe.astro']);
        succeeds('bunx', ['--no-install', 'lint-staged', '--no-stash']);
        expect(readFileSync(file, 'utf8')).toContain('const answer = 42;');
    });
});
