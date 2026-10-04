import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourceExtensions = [
    '',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.json',
    '.css',
    '/index.js',
    '/index.jsx',
    '/index.ts',
    '/index.tsx',
];
const codePattern = /\.[cm]?[jt]sx?$/;
const isProduction = (file) =>
    (/^src\/(app|features|components|lib)\//.test(file) && !/(?:__tests__|__fixtures__|fixtures)\//.test(file)) ||
    file === 'src/proxy.js';

function headingIds(markdown) {
    const occurrences = new Map();
    const ids = new Set();
    for (const line of markdown.split('\n')) {
        const match = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
        if (!match) continue;
        const base = match[1]
            .toLowerCase()
            .replace(/<[^>]*>/g, '')
            .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
            .replace(/\s/g, '-');
        const count = occurrences.get(base) || 0;
        ids.add(base + (count ? '-' + count : ''));
        occurrences.set(base, count + 1);
    }
    return ids;
}

/** Check tracked paths only; generated output is never used to satisfy imports. */
export function checkRepository(root, trackedFiles) {
    const files =
        trackedFiles ||
        execFileSync('git', ['ls-files', '-z'], {
            cwd: root,
            maxBuffer: 16 * 1024 * 1024,
        })
            .toString()
            .split('\0')
            .filter(Boolean);
    const tracked = new Set(files);
    const folded = new Map(files.map((file) => [file.toLowerCase(), file]));
    const graph = new Map();
    const errors = [];
    let imports = 0;
    let computedImports = 0;
    let docLinks = 0;
    let assetReferences = 0;

    function targetExists(target) {
        return tracked.has(target) || files.some((file) => file.startsWith(target.replace(/\/$/, '') + '/'));
    }
    function inspectPath(from, target, kind) {
        if (targetExists(target)) return true;
        const actual = folded.get(target.toLowerCase());
        errors.push({ from, kind, target, ...(actual ? { actual } : {}) });
        return false;
    }
    function resolveImport(from, specifier) {
        const base = specifier.startsWith('@/')
            ? 'src/' + specifier.slice(2)
            : specifier.startsWith('.')
              ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
              : null;
        if (base === null) return;
        imports++;
        const candidates = sourceExtensions.map((extension) => base + extension);
        const exact = candidates.find((candidate) => tracked.has(candidate));
        if (exact) {
            graph.get(from).add(exact);
            return;
        }
        const wrongCase = candidates.map((candidate) => folded.get(candidate.toLowerCase())).find(Boolean);
        errors.push({
            from,
            kind: wrongCase ? 'import-case' : 'missing-import',
            target: specifier,
            ...(wrongCase ? { actual: wrongCase } : {}),
        });
    }

    for (const file of files) {
        if (!codePattern.test(file) && !/\.md$/.test(file)) continue;
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        if (codePattern.test(file) && file !== 'next-env.d.ts') {
            graph.set(file, new Set());
            const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
            function walk(node) {
                if (
                    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
                    node.moduleSpecifier &&
                    ts.isStringLiteral(node.moduleSpecifier)
                ) {
                    resolveImport(file, node.moduleSpecifier.text);
                }
                if (ts.isCallExpression(node)) {
                    const literal = node.arguments[0] && ts.isStringLiteral(node.arguments[0]);
                    const dynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
                    const requireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require';
                    const mock =
                        ts.isPropertyAccessExpression(node.expression) &&
                        ['mock', 'doMock', 'importActual'].includes(node.expression.name.text);
                    if (literal && (dynamic || requireCall || mock)) resolveImport(file, node.arguments[0].text);
                    else if (dynamic) computedImports++;
                }
                if (
                    ts.isJsxAttribute(node) &&
                    node.name.getText(ast) === 'src' &&
                    node.initializer &&
                    ts.isStringLiteral(node.initializer) &&
                    node.initializer.text.startsWith('/') &&
                    !node.initializer.text.startsWith('//')
                ) {
                    assetReferences++;
                    inspectPath(file, 'public' + node.initializer.text.split(/[?#]/)[0], 'missing-asset');
                }
                ts.forEachChild(node, walk);
            }
            walk(ast);
        }
        if (/\.md$/.test(file)) {
            const stripped = text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
            for (const match of stripped.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
                const href = match[1].replace(/^<|>$/g, '');
                if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) continue;
                docLinks++;
                const [pathname, fragment] = href.split('#');
                const decoded = decodeURIComponent(pathname || '');
                const target = pathname
                    ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded))
                    : file;
                if (!inspectPath(file, target, 'missing-doc-link')) continue;
                if (
                    fragment &&
                    /\.md$/.test(target) &&
                    tracked.has(target) &&
                    !headingIds(fs.readFileSync(path.join(root, target), 'utf8')).has(decodeURIComponent(fragment))
                ) {
                    errors.push({ from: file, kind: 'missing-doc-anchor', target: href });
                }
            }
        }
    }

    const visited = new Set();
    const stack = [];
    const active = new Set();
    const cycles = [];
    function visit(file) {
        if (active.has(file)) {
            cycles.push([...stack.slice(stack.indexOf(file)), file]);
            return;
        }
        if (visited.has(file)) return;
        active.add(file);
        stack.push(file);
        for (const target of graph.get(file) || []) if (isProduction(target)) visit(target);
        stack.pop();
        active.delete(file);
        visited.add(file);
    }
    for (const file of files) if (isProduction(file)) visit(file);
    for (const cycle of cycles) errors.push({ kind: 'production-cycle', files: cycle });

    const artifacts = files.filter(
        (file) =>
            /(?:^|\/)(test-results|playwright-report)\//.test(file) ||
            /(?:^|\/)(?:trace\.zip|.*\.tsbuildinfo|scanner-temp\.js)$/.test(file),
    );
    for (const file of artifacts) errors.push({ kind: 'generated-artifact', target: file });
    return { files: files.length, imports, computedImports, docLinks, assetReferences, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = checkRepository(fileURLToPath(new URL('..', import.meta.url)));
    for (const error of report.errors) console.error(JSON.stringify(error));
    console.log(JSON.stringify({ ...report, errors: report.errors.length }));
    if (report.errors.length) process.exitCode = 1;
}
