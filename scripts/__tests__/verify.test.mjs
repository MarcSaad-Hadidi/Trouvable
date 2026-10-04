import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixtures = [];
function run(failStep, npmConfigured = true) {
    const root = mkdtempSync(path.join(tmpdir(), 'trouvable-verify-'));
    fixtures.push(root);
    mkdirSync(path.join(root, 'scripts'));
    copyFileSync(fileURLToPath(new URL('../verify.mjs', import.meta.url)), path.join(root, 'scripts/verify.mjs'));
    const log = path.join(root, 'steps.log');
    const npmCli = path.join(root, 'npm-fixture.mjs');
    writeFileSync(
        npmCli,
        "import {appendFileSync} from 'node:fs'; const step=process.argv[3]; appendFileSync(process.env.VERIFY_STEPS, step+'\\n'); if(step===process.env.VERIFY_FAIL_STEP) process.exit(7);",
    );
    const env = { ...process.env, VERIFY_STEPS: log, VERIFY_FAIL_STEP: failStep };
    if (npmConfigured) env.npm_execpath = npmCli;
    else delete env.npm_execpath;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/verify.mjs')], { env, encoding: 'utf8' });
    return { result, steps: readFileSync(log, { encoding: 'utf8', flag: 'a+' }).trim().split('\n') };
}
afterEach(() => {
    for (const root of fixtures.splice(0)) {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('trouvable-verify-'));
        rmSync(root, { recursive: true, force: true });
    }
});

test('stops before type generation when lint fails', () => {
    const { result, steps } = run('lint');
    assert.equal(result.status, 7);
    assert.deepEqual(steps, ['format:check', 'lint']);
});

test('runs application and native tests before build without scheduling later steps on failure', () => {
    const { result, steps } = run('build');
    assert.equal(result.status, 7);
    assert.deepEqual(steps, ['format:check', 'lint', 'typecheck', 'test', 'test:tooling', 'test:hibernation', 'build']);
});

test('gives a useful error when invoked outside npm', () => {
    const { result } = run('', false);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /npm run verify/);
});
