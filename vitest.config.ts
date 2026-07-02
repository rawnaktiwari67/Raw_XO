import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts', 'server/src/**/*.test.ts', 'client/src/**/*.test.ts'],
        environment: 'node',
    },
});
