import orm from '../entity/orm';
import { share } from '../entity/share';
import { eq, and, desc, sql } from 'drizzle-orm';
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
		const { targetEmail, shareName, keywordFilter, expireTime } = params;
		
		// 生成分享token
		const shareToken = cryptoUtils.genRandomStr(32);
		
		const shareData = {
			shareToken,
			targetEmail,
			shareName,
			keywordFilter: keywordFilter || '验证码|verification|code|otp',
			expireTime,
			userId
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
				eq(share.isActive, 1)
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
	}
};

export default shareService;
