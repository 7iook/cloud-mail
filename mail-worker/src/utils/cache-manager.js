/**
 * Cache Manager - Cloudflare Cache API Wrapper
 * 缓存管理器 - 避免使用 KV（1000次/天限制）
 * 
 * 支持两种模式：
 * 1. Cloudflare Cache API（生产环境）
 * 2. 内存缓存（云服务器部署备用方案）
 */

// 内存缓存（备用方案）
const memoryCache = new Map();

// 清理过期缓存（延迟初始化，避免全局作用域执行）
let cleanupInterval = null;
function initCleanup() {
	if (cleanupInterval) return;
	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, value] of memoryCache.entries()) {
			if (value.expireTime && value.expireTime < now) {
				memoryCache.delete(key);
			}
		}
	}, 60000); // 每分钟清理一次
}

/**
 * 缓存管理器
 */
class CacheManager {
	constructor(c) {
		this.c = c;
		this.isCloudflare = typeof caches !== 'undefined';
		this.cache = this.isCloudflare ? caches.default : null;
	}

	/**
	 * 生成缓存键
	 */
	generateCacheKey(key) {
		return new Request(`https://cache/${key}`, {
			method: 'GET'
		});
	}

	/**
	 * 获取缓存
	 */
	async get(key) {
		if (this.isCloudflare && this.cache) {
			// 使用 Cloudflare Cache API
			const cacheKey = this.generateCacheKey(key);
			const response = await this.cache.match(cacheKey);

			if (response) {
				const data = await response.json();
				return data;
			}
			return null;
		} else {
			// 使用内存缓存
			initCleanup(); // 初始化清理定时器
			const cached = memoryCache.get(key);
			if (cached && (!cached.expireTime || cached.expireTime > Date.now())) {
				return cached.data;
			}
			return null;
		}
	}

	/**
	 * 设置缓存
	 */
	async set(key, data, ttl = 300) {
		if (this.isCloudflare && this.cache) {
			// 使用 Cloudflare Cache API
			const cacheKey = this.generateCacheKey(key);
			const response = new Response(JSON.stringify(data), {
				headers: {
					'Cache-Control': `max-age=${ttl}`,
					'Content-Type': 'application/json'
				}
			});
			await this.cache.put(cacheKey, response);
		} else {
			// 使用内存缓存
			memoryCache.set(key, {
				data,
				expireTime: Date.now() + (ttl * 1000)
			});
		}
	}

	/**
	 * 删除缓存
	 */
	async delete(key) {
		if (this.isCloudflare && this.cache) {
			const cacheKey = this.generateCacheKey(key);
			await this.cache.delete(cacheKey);
		} else {
			memoryCache.delete(key);
		}
	}

	/**
	 * 清空所有缓存
	 */
	async clear() {
		if (!this.isCloudflare) {
			memoryCache.clear();
		}
		// Cloudflare Cache API 不支持清空所有缓存
	}
}

export default CacheManager;

