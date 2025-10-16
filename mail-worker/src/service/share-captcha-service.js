import BizError from '../error/biz-error';
import settingService from './setting-service';
import { t } from '../i18n/i18n';

const shareCaptchaService = {
	/**
	 * 检查是否需要进行人机验证
	 * @param {*} c - Hono context
	 * @param {*} shareRecord - 分享记录
	 * @param {string} ip - 客户端IP
	 * @returns {boolean} 是否需要验证
	 */
	async checkCaptchaRequired(c, shareRecord, ip) {
		// 如果分享未启用人机验证，则不需要验证
		if (!shareRecord.enableCaptcha) {
			return false;
		}

		// 检查IP是否已在白名单中
		const isWhitelisted = await this.isIpWhitelisted(c, ip, shareRecord.shareToken);
		if (isWhitelisted) {
			return false;
		}

		return true;
	},

	/**
	 * 检查IP是否在白名单中
	 * @param {*} c - Hono context
	 * @param {string} ip - 客户端IP
	 * @param {string} shareToken - 分享token
	 * @returns {boolean} 是否在白名单中
	 */
	async isIpWhitelisted(c, ip, shareToken) {
		try {
			const key = `captcha_verified:${ip}:${shareToken}`;
			const value = await c.env.KV.get(key);
			return value !== null;
		} catch (error) {
			console.error('检查IP白名单失败:', error);
			// 如果KV查询失败，为了安全起见，返回false（需要验证）
			return false;
		}
	},

	/**
	 * 验证Turnstile token并将IP加入白名单
	 * @param {*} c - Hono context
	 * @param {string} token - Turnstile token
	 * @param {string} ip - 客户端IP
	 * @param {string} shareToken - 分享token
	 * @returns {boolean} 验证是否成功
	 */
	async verifyCaptchaToken(c, token, ip, shareToken) {
		if (!token) {
			throw new BizError('验证码token不能为空', 400);
		}

		const settingRow = await settingService.query(c);

		// 调用Cloudflare Turnstile API验证
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: settingRow.secretKey,
				response: token,
				remoteip: ip
			})
		});

		const result = await res.json();

		if (!result.success) {
			throw new BizError('人机验证失败，请重试', 400);
		}

		// 验证成功，将IP加入白名单（5分钟TTL）
		try {
			const key = `captcha_verified:${ip}:${shareToken}`;
			await c.env.KV.put(key, '1', { expirationTtl: 300 }); // 300秒 = 5分钟
			console.log(`✅ IP ${ip} 已加入分享 ${shareToken} 的白名单`);
		} catch (error) {
			console.error('将IP加入白名单失败:', error);
			// KV写入失败不应该导致验证失败，继续处理
		}

		return true;
	}
};

export default shareCaptchaService;

