module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@squash/contracts$': '<rootDir>/../contracts/src/index.ts',
    '^@squash/db/schema$': '<rootDir>/../db/src/schema.ts',
    '^@squash/domain$': '<rootDir>/../domain/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
};
