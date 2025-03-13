export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^node:(.*)$': '$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@dmitryrechkin/json-schema-to-zod|pkce-challenge|@modelcontextprotocol)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
