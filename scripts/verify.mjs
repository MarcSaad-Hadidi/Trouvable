import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) {
    console.error('Run this command with npm run verify.');
    process.exit(1);
}

const steps = [
    'format:check',
    'lint',
    'typecheck',
    'test',
    'test:tooling',
    'test:hibernation',
    'build',
    'check:hibernation',
    'check:repository',
];

for (const step of steps) {
    console.log('\n> ' + step);
    const result = spawnSync(process.execPath, [npmCli, 'run', step], {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
    });
    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }
    if (result.status !== 0) process.exit(result.status || 1);
}

const diff = spawnSync('git', ['diff', '--check'], { cwd: root, stdio: 'inherit' });
if (diff.error) console.error(diff.error.message);
process.exit(diff.status ?? 1);
