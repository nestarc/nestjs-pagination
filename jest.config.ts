import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.type.ts',
    '!**/index.ts',
    '!**/__tests__/**',
    '!**/testing/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
