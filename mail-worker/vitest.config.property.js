import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['**/*.test.js'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.js',
				'**/index.js'
			],
			lines: 80,
			functions: 80,
			branches: 80,
			statements: 80
		},
		testTimeout: 30000,
		hookTimeout: 30000,
		teardownTimeout: 10000,
		isolate: true,
		threads: true,
		maxThreads: 4,
		minThreads: 1,
		// fast-check specific settings
		reporters: ['verbose'],
		outputFile: {
			json: './test-results.json',
			html: './test-results.html'
		}
	}
});

