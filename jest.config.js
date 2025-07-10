/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: [
        '**/__tests__/**/*.ts',
        '**/?(*.)+(spec|test).ts'
    ],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**/*'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    coverageReporters: ['text', 'lcov', 'html'],
    coverageDirectory: 'coverage',
    moduleFileExtensions: ['ts', 'js', 'json'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/test/mocks/vscode.ts'
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    testTimeout: 10000,
    verbose: true
};