import type { Config } from 'jest';

/**
 * Root Jest configuration — handles srv/ tests.
 * Uses ts-jest in CommonJS mode (srv is not an ESM package).
 */
const config: Config = {
  preset          : 'ts-jest',
  testEnvironment : 'node',
  testMatch       : ['**/srv/__tests__/**/*.test.ts', '**/srv/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: './srv/tsconfig.test.json' },
    ],
  },
  moduleNameMapper : {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  passWithNoTests : true,
};

export default config;
