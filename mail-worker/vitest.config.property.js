import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		globals: true,
		include: ['**/*.test.js'],
		exclude: ['node_modules', 'dist'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
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
		// fast-check specific settings
		reporters: ['verbose'],
		outputFile: {
			json: './test-results.json',
			html: './test-results.html'
		}
	}
});

