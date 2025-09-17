/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/test/mocks/vscode.ts'
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: '<rootDir>/test/tsconfig.json',
            isolatedModules: true
        }]
    },
    testTimeout: 30000,
    maxWorkers: 1
};