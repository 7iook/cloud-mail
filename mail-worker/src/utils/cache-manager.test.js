import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import CacheManager from './cache-manager.js';

describe('CacheManager - Real Unit Tests', () => {
	let cacheManager;
	let mockContext;

	beforeEach(() => {
		mockContext = {
			env: {}
		};
		// 模拟非 Cloudflare 环境（使用内存缓存）
		global.caches = undefined;
		cacheManager = new CacheManager(mockContext);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Memory Cache Mode', () => {
		describe('set and get', () => {
			it('should set and get cache value', async () => {
				const key = 'test-key';
				const data = { userId: '123', name: 'Test User' };

				await cacheManager.set(key, data, 300);
				const result = await cacheManager.get(key);

				expect(result).toEqual(data);
			});

			it('should return null for non-existent key', async () => {
				const result = await cacheManager.get('non-existent-key');
				expect(result).toBeNull();
			});

			it('should handle different data types', async () => {
				const testCases = [
					{ key: 'string-key', data: 'test string' },
					{ key: 'number-key', data: 42 },
					{ key: 'boolean-key', data: true },
					{ key: 'array-key', data: [1, 2, 3] },
					{ key: 'object-key', data: { nested: { value: 'test' } } }
				];

				for (const { key, data } of testCases) {
					await cacheManager.set(key, data, 300);
					const result = await cacheManager.get(key);
					expect(result).toEqual(data);
				}
			});

			it('should use default TTL of 300 seconds', async () => {
				const key = 'default-ttl-key';
				const data = { test: 'data' };

				await cacheManager.set(key, data);
				const result = await cacheManager.get(key);

				expect(result).toEqual(data);
			});

			it('should use custom TTL', async () => {
				const key = 'custom-ttl-key';
				const data = { test: 'data' };

				await cacheManager.set(key, data, 600);
				const result = await cacheManager.get(key);

				expect(result).toEqual(data);
			});
		});

		describe('delete', () => {
			it('should delete cache entry', async () => {
				const key = 'delete-test-key';
				const data = { test: 'data' };

				await cacheManager.set(key, data, 300);
				expect(await cacheManager.get(key)).toEqual(data);

				await cacheManager.delete(key);
				expect(await cacheManager.get(key)).toBeNull();
			});

			it('should handle deleting non-existent key', async () => {
				await expect(cacheManager.delete('non-existent-key')).resolves.not.toThrow();
			});
		});

		describe('clear', () => {
			it('should clear all cache entries', async () => {
				const keys = ['key1', 'key2', 'key3'];
				const data = { test: 'data' };

				for (const key of keys) {
					await cacheManager.set(key, data, 300);
				}

				await cacheManager.clear();

				for (const key of keys) {
					expect(await cacheManager.get(key)).toBeNull();
				}
			});

			it('should handle clearing empty cache', async () => {
				await expect(cacheManager.clear()).resolves.not.toThrow();
			});
		});

		describe('TTL and Expiration', () => {
			it('should return null for expired cache', async () => {
				const key = 'expiring-key';
				const data = { test: 'data' };

				// Set cache with 1 second TTL
				await cacheManager.set(key, data, 1);

				// Should be available immediately
				expect(await cacheManager.get(key)).toEqual(data);

				// Wait for expiration
				await new Promise(resolve => setTimeout(resolve, 1100));

				// Should be expired
				expect(await cacheManager.get(key)).toBeNull();
			});

			it('should handle zero TTL', async () => {
				const key = 'zero-ttl-key';
				const data = { test: 'data' };

				await cacheManager.set(key, data, 0);

				// Should be immediately expired
				await new Promise(resolve => setTimeout(resolve, 10));
				expect(await cacheManager.get(key)).toBeNull();
			});

			it('should handle very large TTL', async () => {
				const key = 'large-ttl-key';
				const data = { test: 'data' };

				// Set cache with 1 year TTL
				await cacheManager.set(key, data, 365 * 24 * 60 * 60);

				expect(await cacheManager.get(key)).toEqual(data);
			});
		});

		describe('Cache Key Generation', () => {
			it('should generate valid cache key', () => {
				const key = 'test-key';
				const cacheKey = cacheManager.generateCacheKey(key);

				expect(cacheKey).toBeInstanceOf(Request);
				expect(cacheKey.url).toContain('cache/test-key');
				expect(cacheKey.method).toBe('GET');
			});

			it('should handle special characters in key', () => {
				const key = 'test-key-with-special-chars-!@#$%';
				const cacheKey = cacheManager.generateCacheKey(key);

				expect(cacheKey).toBeInstanceOf(Request);
				expect(cacheKey.url).toContain('cache/');
			});
		});

		describe('Concurrent Operations', () => {
			it('should handle concurrent set operations', async () => {
				const operations = [];
				for (let i = 0; i < 10; i++) {
					operations.push(
						cacheManager.set(`key-${i}`, { value: i }, 300)
					);
				}

				await Promise.all(operations);

				for (let i = 0; i < 10; i++) {
					const result = await cacheManager.get(`key-${i}`);
					expect(result).toEqual({ value: i });
				}
			});

			it('should handle concurrent get operations', async () => {
				const key = 'concurrent-get-key';
				const data = { test: 'data' };

				await cacheManager.set(key, data, 300);

				const operations = [];
				for (let i = 0; i < 10; i++) {
					operations.push(cacheManager.get(key));
				}

				const results = await Promise.all(operations);

				results.forEach(result => {
					expect(result).toEqual(data);
				});
			});

			it('should handle mixed concurrent operations', async () => {
				const operations = [];

				// Set operations
				for (let i = 0; i < 5; i++) {
					operations.push(
						cacheManager.set(`key-${i}`, { value: i }, 300)
					);
				}

				// Get operations
				for (let i = 0; i < 5; i++) {
					operations.push(
						cacheManager.get(`key-${i}`)
					);
				}

				await Promise.all(operations);

				// Verify all values are set
				for (let i = 0; i < 5; i++) {
					const result = await cacheManager.get(`key-${i}`);
					expect(result).toEqual({ value: i });
				}
			});
		});

		describe('Edge Cases', () => {
			it('should handle null data', async () => {
				const key = 'null-data-key';
				await cacheManager.set(key, null, 300);
				const result = await cacheManager.get(key);
				expect(result).toBeNull();
			});

			it('should handle undefined data', async () => {
				const key = 'undefined-data-key';
				await cacheManager.set(key, undefined, 300);
				const result = await cacheManager.get(key);
				expect(result).toBeUndefined();
			});

			it('should handle empty string key', async () => {
				const key = '';
				const data = { test: 'data' };

				await cacheManager.set(key, data, 300);
				const result = await cacheManager.get(key);

				expect(result).toEqual(data);
			});

			it('should handle very long key', async () => {
				const key = 'a'.repeat(1000);
				const data = { test: 'data' };

				await cacheManager.set(key, data, 300);
				const result = await cacheManager.get(key);

				expect(result).toEqual(data);
			});

			it('should handle very large data', async () => {
				const key = 'large-data-key';
				const largeData = {
					items: Array(1000).fill({ id: 1, name: 'test', value: 'x'.repeat(100) })
				};

				await cacheManager.set(key, largeData, 300);
				const result = await cacheManager.get(key);

				expect(result).toEqual(largeData);
			});
		});
	});

	describe('Cache Manager Initialization', () => {
		it('should detect non-Cloudflare environment', () => {
			expect(cacheManager.isCloudflare).toBe(false);
			expect(cacheManager.cache).toBeNull();
		});

		it('should accept context parameter', () => {
			expect(cacheManager.c).toEqual(mockContext);
		});
	});
});

