import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	isCloudflareWorkers,
	isNodeJS,
	getEnvironmentType,
	supportsCacheAPI,
	supportsRateLimitingAPI,
	supportsKV,
	supportsR2,
	supportsD1,
	getEnvironmentInfo
} from './env-detector.js';

describe('env-detector - Real Unit Tests', () => {
	let originalGlobal;
	let mockContext;

	beforeEach(() => {
		originalGlobal = global;
		mockContext = {
			env: {}
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('isCloudflareWorkers', () => {
		it('should return false when env is not available', () => {
			const context = {};
			expect(isCloudflareWorkers(context)).toBe(false);
		});

		it('should return true when ASSETS is available', () => {
			mockContext.env.ASSETS = {};
			expect(isCloudflareWorkers(mockContext)).toBe(true);
		});

		it('should return true when db is available', () => {
			mockContext.env.db = {};
			expect(isCloudflareWorkers(mockContext)).toBe(true);
		});

		it('should return true when kv is available', () => {
			mockContext.env.kv = {};
			expect(isCloudflareWorkers(mockContext)).toBe(true);
		});

		it('should return true when r2 is available', () => {
			mockContext.env.r2 = {};
			expect(isCloudflareWorkers(mockContext)).toBe(true);
		});

		it('should return true when caches is available', () => {
			global.caches = {};
			expect(isCloudflareWorkers(mockContext)).toBe(true);
			delete global.caches;
		});

		it('should return false when no Cloudflare features are available', () => {
			expect(isCloudflareWorkers(mockContext)).toBe(false);
		});
	});

	describe('isNodeJS', () => {
		it('should return true in Node.js environment', () => {
			expect(isNodeJS()).toBe(true);
		});

		it('should return false when process is undefined', () => {
			const originalProcess = global.process;
			delete global.process;

			const result = isNodeJS();

			global.process = originalProcess;
			expect(result).toBe(false);
		});

		it('should return false when process.versions is undefined', () => {
			const originalProcess = global.process;
			global.process = {};

			const result = isNodeJS();

			global.process = originalProcess;
			expect(result).toBe(false);
		});

		it('should return false when process.versions.node is undefined', () => {
			const originalProcess = global.process;
			global.process = { versions: {} };

			const result = isNodeJS();

			global.process = originalProcess;
			expect(result).toBe(false);
		});
	});

	describe('getEnvironmentType', () => {
		it('should return cloudflare when Cloudflare features are available', () => {
			mockContext.env.kv = {};
			expect(getEnvironmentType(mockContext)).toBe('cloudflare');
		});

		it('should return nodejs when in Node.js environment', () => {
			const context = { env: {} };
			expect(getEnvironmentType(context)).toBe('nodejs');
		});

		it('should return unknown when no environment is detected', () => {
			const originalProcess = global.process;
			delete global.process;

			const result = getEnvironmentType({ env: {} });

			global.process = originalProcess;
			expect(result).toBe('unknown');
		});

		it('should prioritize Cloudflare over Node.js', () => {
			mockContext.env.kv = {};
			expect(getEnvironmentType(mockContext)).toBe('cloudflare');
		});
	});

	describe('supportsCacheAPI', () => {
		it('should return true when caches is available', () => {
			global.caches = {};
			expect(supportsCacheAPI()).toBe(true);
			delete global.caches;
		});

		it('should return false when caches is not available', () => {
			const originalCaches = global.caches;
			delete global.caches;

			const result = supportsCacheAPI();

			if (originalCaches) {
				global.caches = originalCaches;
			}
			expect(result).toBe(false);
		});
	});

	describe('supportsRateLimitingAPI', () => {
		it('should return true when STRICT_RATE_LIMITER is available', () => {
			mockContext.env.STRICT_RATE_LIMITER = {};
			expect(supportsRateLimitingAPI(mockContext)).toBe(true);
		});

		it('should return true when MODERATE_RATE_LIMITER is available', () => {
			mockContext.env.MODERATE_RATE_LIMITER = {};
			expect(supportsRateLimitingAPI(mockContext)).toBe(true);
		});

		it('should return true when LOOSE_RATE_LIMITER is available', () => {
			mockContext.env.LOOSE_RATE_LIMITER = {};
			expect(supportsRateLimitingAPI(mockContext)).toBe(true);
		});

		it('should return false when no rate limiter is available', () => {
			expect(supportsRateLimitingAPI(mockContext)).toBe(false);
		});

		it('should return false when env is not available', () => {
			expect(supportsRateLimitingAPI({})).toBe(false);
		});
	});

	describe('supportsKV', () => {
		it('should return true when kv is available', () => {
			mockContext.env.kv = {};
			expect(supportsKV(mockContext)).toBe(true);
		});

		it('should return false when kv is not available', () => {
			expect(supportsKV(mockContext)).toBe(false);
		});

		it('should return false when env is not available', () => {
			expect(supportsKV({})).toBe(false);
		});
	});

	describe('supportsR2', () => {
		it('should return true when r2 is available', () => {
			mockContext.env.r2 = {};
			expect(supportsR2(mockContext)).toBe(true);
		});

		it('should return false when r2 is not available', () => {
			expect(supportsR2(mockContext)).toBe(false);
		});

		it('should return false when env is not available', () => {
			expect(supportsR2({})).toBe(false);
		});
	});

	describe('supportsD1', () => {
		it('should return true when db is available', () => {
			mockContext.env.db = {};
			expect(supportsD1(mockContext)).toBe(true);
		});

		it('should return false when db is not available', () => {
			expect(supportsD1(mockContext)).toBe(false);
		});

		it('should return false when env is not available', () => {
			expect(supportsD1({})).toBe(false);
		});
	});

	describe('getEnvironmentInfo', () => {
		it('should return complete environment info for Cloudflare', () => {
			mockContext.env.kv = {};
			mockContext.env.db = {};
			mockContext.env.r2 = {};
			global.caches = {};

			const info = getEnvironmentInfo(mockContext);

			expect(info).toHaveProperty('type');
			expect(info).toHaveProperty('isCloudflare');
			expect(info).toHaveProperty('isNodeJS');
			expect(info).toHaveProperty('features');
			expect(info.type).toBe('cloudflare');
			expect(info.isCloudflare).toBe(true);
			expect(info.features.kv).toBe(true);
			expect(info.features.d1).toBe(true);
			expect(info.features.r2).toBe(true);

			delete global.caches;
		});

		it('should return complete environment info for Node.js', () => {
			const context = { env: {} };
			const info = getEnvironmentInfo(context);

			expect(info.type).toBe('nodejs');
			expect(info.isNodeJS).toBe(true);
		});

		it('should have all required feature properties', () => {
			const info = getEnvironmentInfo(mockContext);

			expect(info.features).toHaveProperty('cacheAPI');
			expect(info.features).toHaveProperty('rateLimiting');
			expect(info.features).toHaveProperty('kv');
			expect(info.features).toHaveProperty('r2');
			expect(info.features).toHaveProperty('d1');
		});

		it('should correctly report disabled features', () => {
			const info = getEnvironmentInfo(mockContext);

			expect(info.features.kv).toBe(false);
			expect(info.features.r2).toBe(false);
			expect(info.features.d1).toBe(false);
		});
	});

	describe('Integration Tests', () => {
		it('should correctly detect full Cloudflare environment', () => {
			mockContext.env.kv = {};
			mockContext.env.db = {};
			mockContext.env.r2 = {};
			mockContext.env.STRICT_RATE_LIMITER = {};
			global.caches = {};

			expect(isCloudflareWorkers(mockContext)).toBe(true);
			expect(getEnvironmentType(mockContext)).toBe('cloudflare');
			expect(supportsKV(mockContext)).toBe(true);
			expect(supportsD1(mockContext)).toBe(true);
			expect(supportsR2(mockContext)).toBe(true);
			expect(supportsRateLimitingAPI(mockContext)).toBe(true);
			expect(supportsCacheAPI()).toBe(true);

			delete global.caches;
		});

		it('should correctly detect minimal Cloudflare environment', () => {
			mockContext.env.kv = {};

			expect(isCloudflareWorkers(mockContext)).toBe(true);
			expect(getEnvironmentType(mockContext)).toBe('cloudflare');
			expect(supportsKV(mockContext)).toBe(true);
			expect(supportsD1(mockContext)).toBe(false);
		});
	});
});

