import { share } from '../entity/share';
import orm from '../entity/orm';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import cryptoUtils from '../utils/crypto-utils';
import dayjs from 'dayjs';
import CacheManager from '../utils/cache-manager';

// 获取基础URL，优先使用环境变量中的域名
function getBaseUrl(c) {
	const domains = c.env.domain;
	if (domains && domains.length > 0) {
		// 使用第一个域名作为默认域名
		return `https://${domains[0]}`;
	}
	// 回退到请求URL
	return c.req.url.split('/').slice(0, 3).join('/');
}

const shareService = {

	// 创建分享
	async create(c, params, userId) {
		const {
			targetEmail,
			shareName,
			keywordFilter,
			expireTime,
			rateLimitPerSecond,
			rateLimitPerMinute,
			shareType,
			authorizedEmails
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
			keywordFilter: keywordFilter || '验证码|verification|code|otp',
			expireTime,
			userId,
			rateLimitPerSecond: rateLimitPerSecond || 5,
			rateLimitPerMinute: rateLimitPerMinute || 60,
			shareType: shareType || 1,
			authorizedEmails: authorizedEmailsJson
		};

		const shareRow = await orm(c).insert(share).values(shareData).returning().get();

		// 生成分享URL，优先使用环境变量中的域名
		const baseUrl = getBaseUrl(c);

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
			// 检查缓存的数据是否过期
			if (!dayjs().isAfter(dayjs(cached.expireTime))) {
				return cached;
			}
			// 缓存过期，删除缓存
			await cacheManager.delete(cacheKey);
		}

		// 从数据库获取
		const shareRow = await orm(c).select().from(share)
			.where(and(
				eq(share.shareToken, shareToken),
				eq(share.isActive, 1),
				eq(share.status, 'active')
			))
			.get();

		if (!shareRow) {
			throw new BizError('分享不存在或已失效', 404);
		}

		// 检查是否过期
		if (dayjs().isAfter(dayjs(shareRow.expireTime))) {
			throw new BizError('分享已过期', 410);
		}

		// 缓存分享信息（5分钟 TTL）
		await cacheManager.set(cacheKey, shareRow, 300);

		return shareRow;
	},

	// 获取用户的分享列表
	async getUserShares(c, userId, page = 1, pageSize = 20) {
		const offset = (page - 1) * pageSize;
		
		const shares = await orm(c).select().from(share)
			.where(and(
				eq(share.userId, userId),
				eq(share.isActive, 1)
			))
			.orderBy(desc(share.createTime))
			.limit(pageSize)
			.offset(offset)
			.all();
			
		// 添加分享URL，优先使用环境变量中的域名
		const baseUrl = getBaseUrl(c);
		return shares.map(shareRow => ({
			...shareRow,
			shareUrl: `${baseUrl}/share/${shareRow.shareToken}`
		}));
	},

	// 获取分享总数
	async getUserShareCount(c, userId) {
		const result = await orm(c).select({ count: sql`count(*)` }).from(share)
			.where(and(
				eq(share.userId, userId),
				eq(share.isActive, 1)
			))
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
		// 验证所有分享都属于当前用户
		const shares = await orm(c).select().from(share)
			.where(and(
				inArray(share.shareId, shareIds),
				eq(share.userId, userId),
				eq(share.isActive, 1)
			))
			.all();

		if (shares.length !== shareIds.length) {
			throw new BizError('部分分享不存在或无权限操作', 403);
		}

		let updateData = {};
		switch (action) {
			case 'extend':
				// 延长有效期 - 兼容 days 和 extendDays 两种参数名
				const days = options.days || options.extendDays || 7;
				// 使用 sql.raw 避免参数绑定问题
				updateData = {
					expireTime: sql.raw(`datetime(expireTime, '+${days} days')`)
				};
				break;
			case 'disable':
				// 禁用
				updateData = { isActive: 0 };
				break;
			case 'enable':
				// 启用
				updateData = { isActive: 1 };
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
