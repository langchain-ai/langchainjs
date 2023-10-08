/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        watch: false,
        include: ["**/*.vitest.ts"],
        testTimeout: 10000
    },
});