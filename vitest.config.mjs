import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            '@': `${rootDir}/src`,
            '@/': `${rootDir}/src/`,
        },
    },
    test: {
        environment: 'node',
        include: ['**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    },
});
