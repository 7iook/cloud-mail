/**
 * Environment Detector
 * 环境检测工具 - 支持 Cloudflare Workers 和云服务器部署
 */

/**
 * 检测是否在 Cloudflare Workers 环境
 */
export function isCloudflareWorkers(c) {
	// 检测 Cloudflare 特定的全局对象和 API
	return !!(
		c.env && (
			c.env.ASSETS ||
			c.env.db ||
			c.env.kv ||
			c.env.r2 ||
			typeof caches !== 'undefined'
		)
	);
}

/**
 * 检测是否在 Node.js 环境
 */
export function isNodeJS() {
	return !!(typeof process !== 'undefined' &&
	       process.versions &&
	       process.versions.node);
}

/**
 * 获取环境类型
 */
export function getEnvironmentType(c) {
	if (isCloudflareWorkers(c)) {
		return 'cloudflare';
	} else if (isNodeJS()) {
		return 'nodejs';
	} else {
		return 'unknown';
	}
}

/**
 * 检测是否支持 Cloudflare Cache API
 */
export function supportsCacheAPI() {
	return typeof caches !== 'undefined';
}

/**
 * 检测是否支持 Cloudflare Rate Limiting API
 */
export function supportsRateLimitingAPI(c) {
	return !!(c.env && (
		c.env.STRICT_RATE_LIMITER ||
		c.env.MODERATE_RATE_LIMITER ||
		c.env.LOOSE_RATE_LIMITER
	));
}

/**
 * 检测是否支持 Cloudflare KV
 */
export function supportsKV(c) {
	return !!(c.env && c.env.kv);
}

/**
 * 检测是否支持 Cloudflare R2
 */
export function supportsR2(c) {
	return !!(c.env && c.env.r2);
}

/**
 * 检测是否支持 Cloudflare D1
 */
export function supportsD1(c) {
	return !!(c.env && c.env.db);
}

/**
 * 获取环境信息摘要
 */
export function getEnvironmentInfo(c) {
	return {
		type: getEnvironmentType(c),
		isCloudflare: isCloudflareWorkers(c),
		isNodeJS: isNodeJS(),
		features: {
			cacheAPI: supportsCacheAPI(),
			rateLimiting: supportsRateLimitingAPI(c),
			kv: supportsKV(c),
			r2: supportsR2(c),
			d1: supportsD1(c)
		}
	};
}

export default {
	isCloudflareWorkers,
	isNodeJS,
	getEnvironmentType,
	supportsCacheAPI,
	supportsRateLimitingAPI,
	supportsKV,
	supportsR2,
	supportsD1,
	getEnvironmentInfo
};

