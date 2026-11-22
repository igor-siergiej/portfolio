import { spawnSync } from 'node:child_process';

const files = process.argv.slice(2);

function run(binary, args) {
    const result = spawnSync(binary, args, { stdio: 'inherit' });

    if (result.error) throw result.error;

    return result.status ?? 1;
}

// Native fixes (e.g. prefer-const) can expose JS-plugin spacing fixes on the next pass.
run('oxlint', ['--fix', ...files]);

const fixed = run('oxlint', ['--fix', ...files]);

if (fixed !== 0) process.exit(fixed);

const formatted = run('oxfmt', ['--write', '--no-error-on-unmatched-pattern', ...files]);

if (formatted !== 0) process.exit(formatted);

process.exit(run('oxlint', files));
