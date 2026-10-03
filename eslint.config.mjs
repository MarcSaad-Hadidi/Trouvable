import next from 'eslint-config-next';

export default [
    ...next,
    {
        ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'dist/**', 'public/**', 'archive/**'],
    },
    {
        files: ['**/*.{js,jsx,mjs,ts,tsx}'],
        rules: {
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-script-url': 'error',
            'no-console': ['warn', { allow: ['error', 'warn'] }],
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'eqeqeq': ['warn', 'always'],
            'prefer-const': 'warn',
            'no-var': 'warn',
        },
    },
];
