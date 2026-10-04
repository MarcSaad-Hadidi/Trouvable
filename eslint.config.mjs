import next from 'eslint-config-next';
import nextTypeScript from 'eslint-config-next/typescript';

const typeScriptPlugins = nextTypeScript.find((config) => config.plugins?.['@typescript-eslint']).plugins;

const eslintConfig = [
    ...next,
    {
        ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'dist/**', 'public/**'],
    },
    {
        files: ['**/*.{js,jsx,mjs,ts,tsx}'],
        rules: {
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-script-url': 'error',
            'no-console': ['warn', { allow: ['error', 'warn'] }],
            'no-unused-vars': ['warn', { args: 'after-used', ignoreRestSiblings: true }],
            // A null guard intentionally accepts both null and undefined.
            eqeqeq: ['warn', 'always', { null: 'ignore' }],
            'prefer-const': 'warn',
            'no-var': 'warn',
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: typeScriptPlugins,
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { args: 'after-used', ignoreRestSiblings: true }],
        },
    },
    {
        // These command-line programs write their results to stdout.
        files: ['scripts/**/*.mjs'],
        rules: { 'no-console': 'off' },
    },
];

export default eslintConfig;
