import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { checkRepository } from '../check-repository.mjs';

const fixtures = [];
function fixture(contents) {
    const root = mkdtempSync(path.join(tmpdir(), 'trouvable-repository-'));
    fixtures.push(root);
    for (const [file, content] of Object.entries(contents)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return checkRepository(root, Object.keys(contents));
}
afterEach(() => {
    for (const root of fixtures.splice(0)) {
        assert.equal(path.dirname(root), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('trouvable-repository-'));
        rmSync(root, { recursive: true, force: true });
    }
});

test('resolves static, reexport, dynamic and mock imports with exact tracked casing', () => {
    const report = fixture({
        'src/lib/a.js': "export const a = 1;",
        'src/lib/b.js': "export { a } from './a';",
        'src/app/page.jsx': "import { a } from '@/lib/b'; export default () => a; import('@/lib/a');",
        'src/lib/__tests__/a.test.js': "vi.mock('@/lib/a', () => ({}));",
    });
    assert.equal(report.imports, 4);
    assert.deepEqual(report.errors, []);
});

test('fails on imports that work only on a case-insensitive filesystem', () => {
    const report = fixture({
        'src/lib/Metric.js': "export const metric = 0;",
        'src/app/page.js': "import { metric } from '@/lib/metric'; export default metric;",
    });
    assert.equal(report.errors[0].kind, 'import-case');
    assert.equal(report.errors[0].actual, 'src/lib/Metric.js');
});

test('reports missing imports and real production cycles', () => {
    const report = fixture({
        'src/lib/a.js': "import './b'; import './missing';",
        'src/lib/b.js': "import './a';",
    });
    assert.ok(report.errors.some((error) => error.kind === 'missing-import'));
    assert.ok(report.errors.some((error) => error.kind === 'production-cycle'));
});

test('checks relative documentation targets and duplicate heading anchors, excluding examples', () => {
    const report = fixture({
        'README.md': '[guide](docs/guide.md#same-1)\n\n```md\n[example](missing.md)\n```\n',
        'docs/guide.md': '# Same\n\n# Same\n',
    });
    assert.equal(report.docLinks, 1);
    assert.deepEqual(report.errors, []);
    const broken = fixture({ 'README.md': '[missing](no.md) [anchor](#absent)\n' });
    assert.deepEqual(broken.errors.map((error) => error.kind), ['missing-doc-link', 'missing-doc-anchor']);
});

test('checks literal JSX assets and rejects tracked generated browser output', () => {
    const report = fixture({
        'src/app/page.jsx': 'export default () => <img src="/logo.svg" />;',
        'public/logo.svg': '<svg />',
        'test-results/trace.zip': '',
    });
    assert.equal(report.assetReferences, 1);
    assert.deepEqual(report.errors.map((error) => error.kind), ['generated-artifact']);
});

test('reports computed imports as a coverage limit instead of pretending to resolve them', () => {
    const report = fixture({ 'src/lib/a.js': 'export const load = (name) => import(name);' });
    assert.equal(report.computedImports, 1);
    assert.deepEqual(report.errors, []);
});
