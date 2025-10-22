import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.js',
				'**/*.spec.js',
				'**/test/**',
				'**/tests/**'
			],
			lines: 80,
			functions: 80,
			branches: 75,
			statements: 80,
			all: true,
			skipFull: false,
			perFile: true,
			lines: 80,
			functions: 80,
			branches: 75,
			statements: 80
		}
	}
});

