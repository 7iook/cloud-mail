import { share } from '../entity/share';
import orm from '../entity/orm';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import cryptoUtils from '../utils/crypto-utils';
import dayjs from 'dayjs';
import CacheManager from '../utils/cache-manager';

// 获取基础URL，支持用户指定域名
function getBaseUrl(c, userSpecifiedDomain = null) {
	try {
		// 智能协议检测：根据请求环境自动选择HTTP或HTTPS
		const getProtocol = () => {
			// 优先从请求URL中获取协议
			if (c.req && c.req.url) {
				const url = new URL(c.req.url);
				return url.protocol.replace(':', '');
			}

			// 检查是否为开发环境（localhost或127.0.0.1）
			const isLocalDev = (domain) => {
				return domain.includes('localhost') ||
				       domain.includes('127.0.0.1') ||
				       domain.includes('0.0.0.0') ||
				       /:\d+$/.test(domain); // 包含端口号通常是开发环境
			};

			// 如果有用户指定域名，检查是否为开发环境
			if (userSpecifiedDomain && isLocalDev(userSpecifiedDomain)) {
				return 'http';
			}

			// 检查环境变量域名
			const domains = c.env.domain;
			if (domains && Array.isArray(domains) && domains.length > 0) {
				const domain = domains[0].trim();
				if (domain && isLocalDev(domain)) {
					return 'http';
				}
			}

			// 默认使用HTTPS（生产环境）
			return 'https';
		};

		const protocol = getProtocol();
		console.log(`[ShareService] Detected protocol: ${protocol}`);

		// 优先使用用户指定的域名
		if (userSpecifiedDomain && userSpecifiedDomain.trim()) {
			const domain = userSpecifiedDomain.trim();
			console.log(`[ShareService] Using user specified domain: ${domain}`);
			// 如果用户域名已包含协议，直接使用；否则添加检测到的协议
			if (domain.startsWith('http://') || domain.startsWith('https://')) {
				return domain.replace(/\/$/, ''); // 移除末尾斜杠
			} else {
				return `${protocol}://${domain}`;
			}
		}

		// 回退到环境变量配置的域名
		const domains = c.env.domain;
		if (domains && Array.isArray(domains) && domains.length > 0) {
			const domain = domains[0].trim();
			if (domain) {
				console.log(`[ShareService] Using configured domain: ${domain}`);
				return `${protocol}://${domain}`;
			}
		}

		// 回退到请求URL
		if (c.req && c.req.url) {
			const urlParts = c.req.url.split('/');
			if (urlParts.length >= 3) {
				const baseUrl = urlParts.slice(0, 3).join('/');
				console.log(`[ShareService] Using request URL as base: ${baseUrl}`);
				return baseUrl;
			}
		}

		// 最后的回退：使用默认值（这种情况不应该发生）
		console.error('[ShareService] Failed to determine base URL, using default');
		return `${protocol}://localhost`;
	} catch (error) {
		console.error('[ShareService] Error in getBaseUrl:', error);
		return 'http://localhost';
	}
}

const shareService = {

	// 创建分享
	async create(c, params, userId) {
		const {
			targetEmail,
			shareName,
			shareDomain,
			keywordFilter,
			expireTime,
			rateLimitPerSecond,
			rateLimitPerMinute,
			shareType,
			authorizedEmails,
			verificationCodeLimit,
			verificationCodeLimitEnabled,
			otpLimitDaily,
			otpLimitEnabled
		} = params;

		// 生成分享token
		const shareToken = cryptoUtils.genRandomStr(32);

		// 处理 authorizedEmails：确保存储为 JSON 字符串
		let authorizedEmailsJson = '[]';
		if (authorizedEmails) {
			if (typeof authorizedEmails === 'string') {
				// 如果已经是字符串，直接使用
				authorizedEmailsJson = authorizedEmails;
			} else if (Array.isArray(authorizedEmails)) {
				// 如果是数组，转换为 JSON 字符串
				authorizedEmailsJson = JSON.stringify(authorizedEmails);
			}
		}

		const shareData = {
			shareToken,
			targetEmail,
			shareName,
			shareDomain: shareDomain || null, // 保存用户选择的域名，NULL表示使用默认域名
			keywordFilter: keywordFilter || '验证码|verification|code|otp',
			expireTime,
			userId,
			rateLimitPerSecond: rateLimitPerSecond || 5,
			rateLimitPerMinute: rateLimitPerMinute || 60,
			shareType: shareType || 1,
			authorizedEmails: authorizedEmailsJson,
			// 显示数量限制
			verificationCodeLimit: verificationCodeLimit !== undefined ? verificationCodeLimit : 100,
			verificationCodeLimitEnabled: verificationCodeLimitEnabled !== undefined ? verificationCodeLimitEnabled : 1,
			// 访问次数限制
			otpLimitDaily: otpLimitDaily !== undefined ? otpLimitDaily : 100,
			otpLimitEnabled: otpLimitEnabled !== undefined ? otpLimitEnabled : 1
		};

		const shareRow = await orm(c).insert(share).values(shareData).returning().get();

		// 生成分享URL，优先使用用户指定的域名
		console.log('=== 生成分享URL调试信息 ===');
		console.log('传入的shareDomain:', shareDomain);
		const baseUrl = getBaseUrl(c, shareDomain);
		console.log('生成的baseUrl:', baseUrl);
		console.log('最终分享URL:', `${baseUrl}/share/${shareToken}`);

		return {
			...shareRow,
			shareUrl: `${baseUrl}/share/${shareToken}`
		};
	},

	// 根据token获取分享信息（添加缓存优化）
	async getByToken(c, shareToken) {
		// 尝试从缓存获取
		const cacheManager = new CacheManager(c);
		const cacheKey = `share:${shareToken}`;
		const cached = await cacheManager.get(cacheKey);

		if (cached) {
			// Fix: 检查缓存的数据是否有效（启用状态）
			// 禁用的分享不应该被访问
			const isDisabled = cached.isActive === 0;

			if (!isDisabled) {
				// 缓存有效且分享未禁用，返回缓存数据
				// 注意：不在这里检查过期，让调用方决定如何处理过期分享
				return cached;
			}

			// 分享已禁用，删除缓存并抛出错误
			await cacheManager.delete(cacheKey);
			throw new BizError('分享已被禁用', 403);
		}

		// Fix: 从数据库获取 - 只检查 isActive，不检查 status
		// 这样已过期的分享也能被获取，由调用方决定如何处理
		const shareRow = await orm(c).select().from(share)
			.where(and(
				eq(share.shareToken, shareToken),
				eq(share.isActive, 1)
			))
			.get();

		if (!shareRow) {
			throw new BizError('分享不存在或已失效', 404);
		}

		// Fix: 检查是否过期 - 返回更友好的错误消息
		if (dayjs().isAfter(dayjs(shareRow.expireTime))) {
			// 仍然缓存过期的分享，避免重复查询数据库
			await cacheManager.set(cacheKey, shareRow, 300);
			throw new BizError('分享已过期', 410);
		}

		// 缓存分享信息（5分钟 TTL）
		await cacheManager.set(cacheKey, shareRow, 300);

		return shareRow;
	},

	// 获取用户的分享列表（支持状态筛选）
	async getUserShares(c, userId, page = 1, pageSize = 20, status) {
		const offset = (page - 1) * pageSize;

		// 构建查询条件
		const conditions = [eq(share.userId, userId)];

		// 根据status参数添加筛选条件
		if (status === 'active') {
			// 活跃状态：isActive=1 且 status='active'
			conditions.push(eq(share.isActive, 1));
			conditions.push(eq(share.status, 'active'));
		} else if (status === 'expired') {
			// 已过期状态：isActive=1 且 status='expired'
			conditions.push(eq(share.isActive, 1));
			conditions.push(eq(share.status, 'expired'));
		} else if (status === 'disabled') {
			// 已禁用状态：isActive=0
			conditions.push(eq(share.isActive, 0));
		}
		// 如果status为空或其他值，不添加额外筛选条件（返回所有状态）

		const shares = await orm(c).select().from(share)
			.where(and(...conditions))
			.orderBy(desc(share.createTime))
			.limit(pageSize)
			.offset(offset)
			.all();

		// 添加分享URL，优先使用保存的用户域名，然后回退到环境变量中的域名
		return shares.map(shareRow => {
			const baseUrl = getBaseUrl(c, shareRow.shareDomain);
			return {
				...shareRow,
				shareUrl: `${baseUrl}/share/${shareRow.shareToken}`
			};
		});
	},

	// 获取分享总数（支持状态筛选）
	async getUserShareCount(c, userId, status) {
		// 构建查询条件
		const conditions = [eq(share.userId, userId)];

		// 根据status参数添加筛选条件
		if (status === 'active') {
			conditions.push(eq(share.isActive, 1));
			conditions.push(eq(share.status, 'active'));
		} else if (status === 'expired') {
			conditions.push(eq(share.isActive, 1));
			conditions.push(eq(share.status, 'expired'));
		} else if (status === 'disabled') {
			conditions.push(eq(share.isActive, 0));
		}

		const result = await orm(c).select({ count: sql`count(*)` }).from(share)
			.where(and(...conditions))
			.get();

		return result.count;
	},

	// 删除分享
	async delete(c, shareId, userId) {
		const shareRow = await orm(c).select().from(share)
			.where(and(
				eq(share.shareId, shareId),
				eq(share.userId, userId),
				eq(share.isActive, 1)
			))
			.get();
			
		if (!shareRow) {
			throw new BizError('分享不存在或无权限删除', 404);
		}
		
		await orm(c).update(share)
			.set({ isActive: 0 })
			.where(eq(share.shareId, shareId))
			.run();
			
		return true;
	},

	// 根据ID获取分享
	async getById(c, shareId) {
		return await orm(c).select().from(share)
			.where(and(
				eq(share.shareId, shareId),
				eq(share.isActive, 1)
			))
			.get();
	},

	// 刷新分享Token
	async refreshToken(c, shareId, userId) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 生成新的token
		const newToken = cryptoUtils.genRandomStr(32);

		// 更新数据库
		await orm(c).update(share)
			.set({ shareToken: newToken })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		// 返回新的分享信息
		const baseUrl = getBaseUrl(c);
		return {
			...shareRow,
			shareToken: newToken,
			shareUrl: `${baseUrl}/share/${newToken}`
		};
	},

	// 批量操作分享
	async batchOperate(c, action, shareIds, userId, options = {}) {
		// 验证所有分享都属于当前用户（移除isActive限制，允许操作禁用的分享）
		const shares = await orm(c).select().from(share)
			.where(and(
				inArray(share.shareId, shareIds),
				eq(share.userId, userId)
			))
			.all();

		if (shares.length !== shareIds.length) {
			throw new BizError('部分分享不存在或无权限操作', 403);
		}

		let updateData = {};
		switch (action) {
			case 'extend':
				// 延长有效期 - 兼容 days 和 extendDays 两种参数名
				const days = parseInt(options.days || options.extendDays || 7);

				// 验证天数范围
				if (isNaN(days) || days < 1 || days > 365) {
					throw new BizError('延长天数必须在1-365之间', 400);
				}

				// Fix: 使用 sql 模板标签而不是 sql.raw，避免SQL注入和语法错误
				// SQLite的datetime函数需要正确的列引用
				updateData = {
					expireTime: sql`datetime(${share.expireTime}, '+' || ${days} || ' days')`
				};
				break;
			case 'disable':
				// Fix: 禁用时同时更新 isActive 和 status 字段，保持数据一致性
				updateData = {
					isActive: 0,
					status: 'disabled'
				};
				break;
			case 'enable':
				// Fix: 启用时同时更新 isActive 和 status 字段
				// 需要重新计算status（可能是active或expired）
				updateData = {
					isActive: 1,
					// 使用SQL CASE表达式根据过期时间设置正确的status
					status: sql`CASE
						WHEN datetime(${share.expireTime}) < datetime('now') THEN 'expired'
						ELSE 'active'
					END`
				};
				break;
			default:
				throw new BizError('不支持的操作类型', 400);
		}

		// 执行批量更新
		await orm(c).update(share)
			.set(updateData)
			.where(inArray(share.shareId, shareIds))
			.run();

		// 清除相关缓存
		const cacheManager = new CacheManager(c);
		for (const shareRow of shares) {
			await cacheManager.delete(`share:${shareRow.shareToken}`);
		}

		return { success: true, affected: shares.length };
	},



	// 更新分享每日限额
	async updateLimit(c, shareId, userId, otpLimitDaily) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 更新每日限额
		await orm(c).update(share)
			.set({ otpLimitDaily })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	},

	// 更新分享显示限制
	async updateDisplayLimit(c, shareId, userId, verificationCodeLimit) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 更新显示限制
		await orm(c).update(share)
			.set({ verificationCodeLimit })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	},

	// 增加每日访问计数
	async incrementDailyCount(c, shareId) {
		await orm(c).update(share)
			.set({ otpCountDaily: sql`${share.otpCountDaily} + 1` })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		const shareRow = await this.getById(c, shareId);
		await cacheManager.delete(`share:${shareRow.shareToken}`);
	},

	// 重置每日访问计数
	async resetDailyCount(c, shareId, today) {
		await orm(c).update(share)
			.set({ otpCountDaily: 0, lastResetDate: today })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		const shareRow = await this.getById(c, shareId);
		await cacheManager.delete(`share:${shareRow.shareToken}`);
	},

	// 更新分享名称
	async updateName(c, shareId, userId, shareName) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 更新分享名称
		await orm(c).update(share)
			.set({ shareName })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	},

	// 更新分享过期时间
	async updateExpireTime(c, shareId, userId, expireTime) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 更新过期时间
		await orm(c).update(share)
			.set({ expireTime })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	},

	// 更新分享状态
	async updateStatus(c, shareId, userId, status) {
		// 验证分享是否存在且属于当前用户
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}

		// 更新状态
		await orm(c).update(share)
			.set({ status })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	},

	// 更新分享高级设置
	async updateAdvancedSettings(c, shareId, settings) {
		const { rateLimitPerSecond, rateLimitPerMinute, keywordFilter } = settings;

		// 验证参数
		if (rateLimitPerSecond !== undefined && (rateLimitPerSecond < 1 || rateLimitPerSecond > 100)) {
			throw new BizError('每秒限制必须在1-100之间', 400);
		}
		if (rateLimitPerMinute !== undefined && (rateLimitPerMinute < 1 || rateLimitPerMinute > 1000)) {
			throw new BizError('每分钟限制必须在1-1000之间', 400);
		}

		// 获取分享信息
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}

		// 构建更新数据
		const updateData = {};
		if (rateLimitPerSecond !== undefined) {
			updateData.rateLimitPerSecond = rateLimitPerSecond;
		}
		if (rateLimitPerMinute !== undefined) {
			updateData.rateLimitPerMinute = rateLimitPerMinute;
		}
		if (keywordFilter !== undefined) {
			updateData.keywordFilter = keywordFilter;
		}

		// 如果没有要更新的数据，直接返回
		if (Object.keys(updateData).length === 0) {
			return { success: true };
		}

		// 更新数据库
		await orm(c).update(share)
			.set(updateData)
			.where(eq(share.shareId, shareId));

		// 清除缓存
		const cacheManager = new CacheManager(c);
		await cacheManager.delete(`share:${shareRow.shareToken}`);

		return { success: true };
	}
};

export default shareService;
