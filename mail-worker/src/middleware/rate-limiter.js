/**
 * Rate Limiter Middleware
 * 访问频率限制中间件 - 仅限制恶意用户
 * 
 * 支持两种模式：
 * 1. Cloudflare Workers Rate Limiting API（生产环境）
 * 2. 内存缓存滑动窗口算法（云服务器部署备用方案）
 */

import BizError from '../error/biz-error';

// 内存缓存（备用方案）
const memoryCache = new Map();

// 清理过期缓存（延迟初始化，避免全局作用域执行）
let cleanupInterval = null;
function initCleanup() {
	if (cleanupInterval) return;
	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, value] of memoryCache.entries()) {
			if (value.resetTime < now) {
				memoryCache.delete(key);
			}
		}
	}, 60000); // 每分钟清理一次
}

/**
 * 内存缓存频率限制器（备用方案）
 */
class MemoryRateLimiter {
	constructor(limit, period) {
		this.limit = limit;
		this.period = period * 1000; // 转换为毫秒
	}

	async limit(key) {
		initCleanup(); // 初始化清理定时器
		const now = Date.now();
		const cacheKey = `rate_limit:${key}`;
		const data = memoryCache.get(cacheKey);

		if (!data) {
			// 首次访问
			memoryCache.set(cacheKey, {
				count: 1,
				resetTime: now + this.period
			});
			return { success: true };
		}

		// 检查是否超过限制
		if (data.count >= this.limit) {
			return { success: false };
		}

		// 增加计数
		data.count++;
		memoryCache.set(cacheKey, data);
		return { success: true };
	}
}

/**
 * Cloudflare Workers Rate Limiter（生产环境）
 */
class CloudflareRateLimiter {
	constructor(env, limiterName) {
		this.limiter = env[limiterName];
	}

	async limit(key) {
		if (!this.limiter) {
			throw new Error('Rate limiter not configured');
		}
		return await this.limiter.limit({ key });
	}
}

/**
 * 统一的频率限制器接口
 */
class RateLimiter {
	constructor(c, config = {}) {
		this.c = c;
		this.config = {
			// 严格限制：1秒内最多5次（防止极端恶意）
			strict: config.strict || { limit: 5, period: 1 },
			// 中等限制：10秒内最多20次（防止持续恶意）
			moderate: config.moderate || { limit: 20, period: 10 },
			// 宽松限制：60秒内最多60次（正常用户不受影响）
			loose: config.loose || { limit: 60, period: 60 }
		};

		// 检测环境
		this.isCloudflare = this.detectCloudflare(c);
	}

	detectCloudflare(c) {
		// 检测是否在 Cloudflare Workers 环境
		return c.env && (
			c.env.STRICT_RATE_LIMITER || 
			c.env.MODERATE_RATE_LIMITER || 
			c.env.LOOSE_RATE_LIMITER
		);
	}

	async checkLimit(identifier, level = 'moderate') {
		const config = this.config[level];
		if (!config) {
			throw new Error(`Invalid rate limit level: ${level}`);
		}

		let limiter;
		if (this.isCloudflare) {
			// 使用 Cloudflare Rate Limiting API
			const limiterName = `${level.toUpperCase()}_RATE_LIMITER`;
			limiter = new CloudflareRateLimiter(this.c.env, limiterName);
		} else {
			// 使用内存缓存备用方案
			limiter = new MemoryRateLimiter(config.limit, config.period);
		}

		return await limiter.limit(identifier);
	}
}

/**
 * 分享访问频率限制中间件（支持自定义配置）
 * 仅限制恶意用户，正常用户不受影响
 */
export async function shareRateLimitMiddleware(c, next) {
	try {
		// 获取客户端 IP
		const clientIp = c.req.header('cf-connecting-ip') ||
		                 c.req.header('x-forwarded-for') ||
		                 c.req.header('x-real-ip') ||
		                 'unknown';

		// 尝试从分享记录获取自定义频率限制配置
		const shareToken = c.req.param('shareToken');
		let customConfig = null;

		if (shareToken) {
			try {
				// 从数据库获取分享记录的频率限制配置
				const shareService = (await import('../service/share-service.js')).default;
				const shareRecord = await shareService.getByToken(c, shareToken);

				// 向后兼容性检查：确保字段存在且有效
				if (shareRecord) {
					const perSecond = shareRecord.rateLimitPerSecond || shareRecord.rate_limit_per_second;
					const perMinute = shareRecord.rateLimitPerMinute || shareRecord.rate_limit_per_minute;

					if (perSecond && perMinute) {
						customConfig = {
							strict: { limit: perSecond, period: 1 },
							loose: { limit: perMinute, period: 60 }
						};
					}
				}
			} catch (err) {
				// 获取配置失败，使用默认配置
				console.warn('Failed to get custom rate limit config:', err);
			}
		}

		const rateLimiter = new RateLimiter(c, customConfig);

		// 第一层：严格限制（默认1秒5次，可自定义）
		const strictResult = await rateLimiter.checkLimit(clientIp, 'strict');
		if (!strictResult.success) {
			throw new BizError('请求过于频繁，请稍后再试', 429);
		}

		// 第二层：宽松限制（默认60秒60次，可自定义）
		const looseResult = await rateLimiter.checkLimit(clientIp, 'loose');
		if (!looseResult.success) {
			throw new BizError('访问次数超限，请稍后再试', 429);
		}

		// 通过所有检查，继续处理请求
		await next();

	} catch (error) {
		if (error instanceof BizError) {
			throw error;
		}
		// 如果频率限制器出错，记录日志但不阻止请求（降级策略）
		console.error('Rate limiter error:', error);
		await next();
	}
}

/**
 * 创建自定义频率限制中间件
 */
export function createRateLimitMiddleware(config) {
	return async (c, next) => {
		const clientIp = c.req.header('cf-connecting-ip') || 
		                 c.req.header('x-forwarded-for') || 
		                 'unknown';

		const rateLimiter = new RateLimiter(c, config);
		
		for (const [level, levelConfig] of Object.entries(config)) {
			const result = await rateLimiter.checkLimit(clientIp, level);
			if (!result.success) {
				throw new BizError(
					levelConfig.message || '访问频率过高，请稍后再试', 
					429
				);
			}
		}

		await next();
	};
}

export default RateLimiter;

