/* global jest */
// Mock node: imports
jest.mock('node:crypto', () => {
  return {
    webcrypto: {
      getRandomValues: array => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
  };
});

// Add more node: imports as needed
