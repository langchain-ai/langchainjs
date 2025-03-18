import { vi } from 'vitest';

// Mock node:crypto module
vi.mock('node:crypto', () => {
  return {
    webcrypto: {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
  };
});

// Add more node: imports as needed
