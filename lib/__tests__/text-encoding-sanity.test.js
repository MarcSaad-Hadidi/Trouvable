import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(process.cwd());
const SOURCE_ROOTS = ['app', 'features', 'components', 'lib'];
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['.git', '.next', 'archive', 'node_modules', '__tests__']);
const FORBIDDEN_PATTERNS = [
    { label: 'U+00C3', value: '\u00C3' },
    { label: 'U+00C2', value: '\u00C2' },
    { label: 'mojibake apostrophe', value: '\u00E2\u20AC\u2122' },
    { label: 'mojibake opening quote', value: '\u00E2\u20AC\u0153' },
    { label: 'mojibake closing quote', value: '\u00E2\u20AC\u009D' },
    { label: 'mojibake dash', value: '\u00E2\u20AC\u201C' },
    { label: 'replacement character', value: '\uFFFD' },
];

function collectSourceFiles(dir, bucket = []) {
    if (!fs.existsSync(dir)) return bucket;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            collectSourceFiles(fullPath, bucket);
            continue;
        }

        if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
            bucket.push(fullPath);
        }
    }

    return bucket;
}

describe('active source files', () => {
    it('stay free of common mojibake patterns', { timeout: 30_000 }, () => {
        const offenders = [];

        for (const sourceRoot of SOURCE_ROOTS) {
            const fullRoot = path.join(ROOT_DIR, sourceRoot);
            const files = collectSourceFiles(fullRoot);

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf8');
                const matches = FORBIDDEN_PATTERNS.filter(({ value }) => content.includes(value)).map(({ label }) => label);

                if (matches.length > 0) {
                    offenders.push(`${path.relative(ROOT_DIR, file)} -> ${matches.join(', ')}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
