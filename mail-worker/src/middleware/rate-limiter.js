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
		this.maxLimit = limit;  // 重命名避免与方法名冲突
		this.period = period * 1000; // 转换为毫秒
	}

	async limit(key, shareToken = null, autoRecoverySeconds = 0) {
		console.log(`🔧 MemoryRateLimiter.limit 被调用:`, {
			key,
			shareToken,
			maxLimit: this.maxLimit,
			period: this.period,
			autoRecoverySeconds,
			methodExists: typeof this.limit === 'function'
		});

		initCleanup(); // 初始化清理定时器
		const now = Date.now();
		// 修复：缓存键必须包含 shareToken，以隔离不同分享的频率限制
		const cacheKey = shareToken ? `rate_limit:${shareToken}:${key}` : `rate_limit:${key}`;
		let data = memoryCache.get(cacheKey);

		// 检查时间窗口是否已过期
		if (data && data.resetTime < now) {
			console.log(`⏰ 时间窗口已过期，重置计数器`);
			data = null;
		}

		if (!data) {
			// 首次访问或时间窗口已过期
			memoryCache.set(cacheKey, {
				count: 1,
				resetTime: now + this.period,
				triggerTime: null // 触发限制的时间戳
			});
			console.log(`✅ 首次访问，允许通过 (count: 1/${this.maxLimit})`);
			return { success: true };
		}

		// 检查是否已触发限制（count >= maxLimit）
		if (data.count >= this.maxLimit) {
			// 如果启用了自动恢复，检查是否可以恢复
			if (autoRecoverySeconds > 0) {
				// 如果还没有记录触发时间，现在记录
				if (!data.triggerTime) {
					data.triggerTime = now;
					memoryCache.set(cacheKey, data);
					console.log(`📍 首次触发限制，记录触发时间`);
				}

				const elapsedSeconds = (now - data.triggerTime) / 1000;
				console.log(`⏱️ 自动恢复检查: 已过时间=${elapsedSeconds.toFixed(2)}秒, 需要时间=${autoRecoverySeconds}秒`);

				if (elapsedSeconds >= autoRecoverySeconds) {
					// 恢复访问权限
					console.log(`✅ 自动恢复时间已到，重置限制`);
					memoryCache.set(cacheKey, {
						count: 1,
						resetTime: now + this.period,
						triggerTime: null
					});
					return { success: true };
				} else {
					// 仍在恢复期内
					const remainingSeconds = Math.ceil(autoRecoverySeconds - elapsedSeconds);
					console.log(`❌ 仍在恢复期内，剩余等待时间: ${remainingSeconds}秒`);
					return { success: false, retryAfter: remainingSeconds };
				}
			}

			// 没有启用自动恢复，直接返回限制
			console.log(`❌ 超过限制: ${data.count} >= ${this.maxLimit}`);
			return { success: false };
		}

		// 未超过限制，增加计数
		data.count++;
		memoryCache.set(cacheKey, data);
		console.log(`✅ 计数增加: ${data.count}/${this.maxLimit}`);
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
	constructor(c, config = {}, shareToken = null) {
		this.c = c;
		this.shareToken = shareToken; // 添加 shareToken 属性
		// 关键修复：不使用默认值，直接使用传入的config
		// 这样当config中的strict或loose为null时，就不会应用限制
		this.config = config;

		// 检测环境
		this.isCloudflare = this.detectCloudflare(c);
	}

	detectCloudflare(c) {
		// 检测是否在 Cloudflare Workers 环境且配置了 Rate Limiter
		const hasRateLimiters = c.env && (
			c.env.STRICT_RATE_LIMITER ||
			c.env.MODERATE_RATE_LIMITER ||
			c.env.LOOSE_RATE_LIMITER
		);

		console.log('🔍 Cloudflare Rate Limiter 检测:', {
			hasEnv: !!c.env,
			hasStrictLimiter: !!(c.env && c.env.STRICT_RATE_LIMITER),
			hasModerateLimiter: !!(c.env && c.env.MODERATE_RATE_LIMITER),
			hasLooseLimiter: !!(c.env && c.env.LOOSE_RATE_LIMITER),
			result: hasRateLimiters
		});

		return hasRateLimiters;
	}

	async checkLimit(identifier, level = 'moderate', autoRecoverySeconds = 0) {
		const config = this.config[level];
		// 关键修复：如果config为null或undefined，表示该级别的限制已禁用，直接返回成功
		if (!config) {
			console.log(`⚠️ 频率限制级别 [${level}] 配置为null，跳过检查`);
			return { success: true };
		}

		console.log(`🚦 频率限制检查 [${level}]:`, {
			identifier,
			shareToken: this.shareToken,
			config,
			autoRecoverySeconds,
			isCloudflare: this.isCloudflare
		});

		let limiter;
		if (this.isCloudflare) {
			// 使用 Cloudflare Rate Limiting API
			const limiterName = `${level.toUpperCase()}_RATE_LIMITER`;
			console.log(`☁️ 使用 Cloudflare Rate Limiter: ${limiterName}`);
			limiter = new CloudflareRateLimiter(this.c.env, limiterName);
		} else {
			// 使用内存缓存备用方案
			console.log(`💾 使用内存缓存 Rate Limiter: limit=${config.limit}, period=${config.period}`);
			limiter = new MemoryRateLimiter(config.limit, config.period);
		}

		// 修复：传递 shareToken 和 autoRecoverySeconds 到 limit 方法
		const result = await limiter.limit(identifier, this.shareToken, autoRecoverySeconds);
		console.log(`📊 频率限制结果:`, result);
		return result;
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

		// 修复：只有当shareToken存在且有效时才尝试获取配置
		if (shareToken && typeof shareToken === 'string' && shareToken.trim()) {
			try {
				// 从数据库获取分享记录的频率限制配置
				const shareService = (await import('../service/share-service.js')).default;
				let shareRecord = null;

				try {
					shareRecord = await shareService.getByToken(c, shareToken);
				} catch (getByTokenError) {
					// Fix P0-1: 如果分享不存在或已过期，不应该在中间件中抛出错误
					// 应该让请求继续到主处理器，由主处理器返回适当的错误消息
					console.log('获取分享记录失败（这是正常的，分享可能不存在或已过期）:', getByTokenError.message);
					// 不设置customConfig，让频率限制被禁用，允许请求继续
					shareRecord = null;
				}

				if (shareRecord) {
					console.log('=== 频率限制配置调试 ===');
					console.log('shareToken:', shareToken);
					console.log('shareRecord:', {
						shareId: shareRecord.shareId,
						rateLimitPerSecond: shareRecord.rateLimitPerSecond,
						autoRecoverySeconds: shareRecord.autoRecoverySeconds,
						rate_limit_per_second: shareRecord.rate_limit_per_second,
						auto_recovery_seconds: shareRecord.auto_recovery_seconds
					});

					// 向后兼容性检查：确保字段存在且有效
					const perSecond = shareRecord.rateLimitPerSecond !== undefined ? shareRecord.rateLimitPerSecond : shareRecord.rate_limit_per_second;
					const recoverySeconds = shareRecord.autoRecoverySeconds !== undefined ? shareRecord.autoRecoverySeconds : shareRecord.auto_recovery_seconds;

					console.log('提取的频率限制值:', { perSecond, recoverySeconds, type_perSecond: typeof perSecond, type_recoverySeconds: typeof recoverySeconds });
					console.log('原始shareRecord值:', { rateLimitPerSecond: shareRecord.rateLimitPerSecond, autoRecoverySeconds: shareRecord.autoRecoverySeconds, rate_limit_per_second: shareRecord.rate_limit_per_second, auto_recovery_seconds: shareRecord.auto_recovery_seconds });

					// 频率限制由开关控制，最小值为1
					// 如果有有效的频率限制值，创建配置
					// Fix: 使用显式的 !== 检查而不是依赖 falsy 值，确保当 perSecond === 0 时正确禁用频率限制
					if (perSecond !== undefined && perSecond !== null && perSecond > 0) {
						customConfig = {
							strict: { limit: perSecond, period: 1 },
							autoRecoverySeconds: recoverySeconds || 60
						};
						console.log('✅ 使用自定义频率限制配置:', customConfig);
					} else {
						console.log('⚠️ 频率限制字段无效或未设置（perSecond=' + perSecond + '），customConfig保持为null');
						customConfig = null;
					}
				} else {
					console.log('⚠️ 未找到分享记录，使用默认配置');
				}
			} catch (err) {
				// 获取配置失败，使用默认配置
				console.warn('❌ 获取自定义频率限制配置失败:', err);
			}
		}

		// 检查是否禁用频率限制
		if (customConfig === null) {
			console.log('✅ 频率限制已禁用，跳过限制检查');
			await next();
			return;
		}

		// 修复：传递 shareToken 到 RateLimiter，以隔离不同分享的频率限制
		const rateLimiter = new RateLimiter(c, customConfig, shareToken);

		// 频率限制检查（每秒限制）
		// 只有当strict配置存在时才检查
		if (customConfig && customConfig.strict) {
			const autoRecoverySeconds = customConfig.autoRecoverySeconds || 60;
			const strictResult = await rateLimiter.checkLimit(clientIp, 'strict', autoRecoverySeconds);
			if (!strictResult.success) {
				// 如果有剩余等待时间，添加到响应头
				if (strictResult.retryAfter) {
					c.header('Retry-After', strictResult.retryAfter.toString());
				}

				// 检查是否需要人机验证
				try {
					const shareService = (await import('../service/share-service.js')).default;
					const shareCaptchaService = (await import('../service/share-captcha-service.js')).default;

					if (shareToken && typeof shareToken === 'string' && shareToken.trim()) {
						const shareRecord = await shareService.getByToken(c, shareToken);
						const needsCaptcha = await shareCaptchaService.checkCaptchaRequired(c, shareRecord, clientIp);

						if (needsCaptcha) {
							// 返回403状态码和特殊头部，告诉前端需要进行人机验证
							c.header('X-Captcha-Required', 'true');
							throw new BizError('需要进行人机验证', 403);
						}
					}
				} catch (captchaError) {
					console.error('检查人机验证需求失败:', captchaError);
					// 如果检查失败，继续返回原始的频率限制错误
				}

				throw new BizError('请求过于频繁，请稍后再试', 429);
			}
		} else {
			console.log('✅ 频率限制已禁用，跳过检查');
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
