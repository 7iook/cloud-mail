import { share } from '../entity/share';
import orm from '../entity/orm';
import { eq, and, desc, sql, inArray, like, or, gte, lte, between } from 'drizzle-orm';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import cryptoUtils from '../utils/crypto-utils';
import dayjs from 'dayjs';
import CacheManager from '../utils/cache-manager';
import verifyUtils from '../utils/verify-utils';
import sanitizeUtils from '../utils/sanitize-utils';

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
	// 添加高级筛选条件的辅助方法
	addAdvancedFilterConditions(conditions, searchParams) {
		const {
			createTimeStart,
			createTimeEnd,
			expireTimeStart,
			expireTimeEnd,
			otpLimitMin,
			otpLimitMax,
			verificationCodeLimitMin,
			verificationCodeLimitMax,
			shareTypes,
			otpLimitEnabled,
			verificationCodeLimitEnabled
		} = searchParams;

		// 创建时间范围筛选
		if (createTimeStart && createTimeEnd) {
			conditions.push(
				and(
					gte(share.createTime, createTimeStart + ' 00:00:00'),
					lte(share.createTime, createTimeEnd + ' 23:59:59')
				)
			);
		} else if (createTimeStart) {
			conditions.push(gte(share.createTime, createTimeStart + ' 00:00:00'));
		} else if (createTimeEnd) {
			conditions.push(lte(share.createTime, createTimeEnd + ' 23:59:59'));
		}

		// 过期时间范围筛选
		if (expireTimeStart && expireTimeEnd) {
			conditions.push(
				and(
					gte(share.expireTime, expireTimeStart + ' 00:00:00'),
					lte(share.expireTime, expireTimeEnd + ' 23:59:59')
				)
			);
		} else if (expireTimeStart) {
			conditions.push(gte(share.expireTime, expireTimeStart + ' 00:00:00'));
		} else if (expireTimeEnd) {
			conditions.push(lte(share.expireTime, expireTimeEnd + ' 23:59:59'));
		}

		// 访问限制范围筛选
		if (otpLimitMin !== undefined && otpLimitMax !== undefined) {
			conditions.push(between(share.otpLimitDaily, parseInt(otpLimitMin), parseInt(otpLimitMax)));
		} else if (otpLimitMin !== undefined) {
			conditions.push(gte(share.otpLimitDaily, parseInt(otpLimitMin)));
		} else if (otpLimitMax !== undefined) {
			conditions.push(lte(share.otpLimitDaily, parseInt(otpLimitMax)));
		}

		// 显示限制范围筛选
		if (verificationCodeLimitMin !== undefined && verificationCodeLimitMax !== undefined) {
			conditions.push(between(share.verificationCodeLimit, parseInt(verificationCodeLimitMin), parseInt(verificationCodeLimitMax)));
		} else if (verificationCodeLimitMin !== undefined) {
			conditions.push(gte(share.verificationCodeLimit, parseInt(verificationCodeLimitMin)));
		} else if (verificationCodeLimitMax !== undefined) {
			conditions.push(lte(share.verificationCodeLimit, parseInt(verificationCodeLimitMax)));
		}

		// 分享类型筛选
		if (shareTypes) {
			const typeArray = shareTypes.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
			if (typeArray.length > 0) {
				conditions.push(inArray(share.shareType, typeArray));
			}
		}

		// 访问限制启用状态筛选
		if (otpLimitEnabled !== undefined) {
			conditions.push(eq(share.otpLimitEnabled, parseInt(otpLimitEnabled)));
		}

		// 显示限制启用状态筛选
		if (verificationCodeLimitEnabled !== undefined) {
			conditions.push(eq(share.verificationCodeLimitEnabled, parseInt(verificationCodeLimitEnabled)));
		}
	},

	// 创建分享
	async create(c, params, userId) {
		const {
			targetEmail,
			shareName,
			shareDomain,
			keywordFilter,
			expireTime,
			rateLimitPerSecond,
			autoRecoverySeconds,
			shareType,
			authorizedEmails,
			verificationCodeLimit,
			verificationCodeLimitEnabled,
			otpLimitDaily,
			otpLimitEnabled,
			// 新增：模板匹配功能
			filterMode,
			templateId,
			showFullEmail,
			// 新增：冷却功能配置
			cooldownEnabled,
			cooldownSeconds,
			// 新增：邮件数量限制和自动刷新功能
			latestEmailCount,
			autoRefreshEnabled,
			autoRefreshInterval,
			// 新增：公告弹窗功能
			announcementContent
		} = params;

		// 生成分享token
		const shareToken = cryptoUtils.genRandomStr(32);

		// 处理 authorizedEmails：确保存储为 JSON 字符串
		let authorizedEmailsJson = '[]';
		if (authorizedEmails) {
			if (typeof authorizedEmails === 'string') {
				// Fix P1-14: 如果已经是字符串，验证其有效性
				try {
					const parsed = JSON.parse(authorizedEmails);
					if (!Array.isArray(parsed)) {
						throw new BizError('授权邮箱列表必须是数组格式', 400);
					}
					authorizedEmailsJson = authorizedEmails;
				} catch (error) {
					if (error instanceof BizError) throw error;
					throw new BizError('授权邮箱列表JSON格式无效', 400);
				}
			} else if (Array.isArray(authorizedEmails)) {
				// 如果是数组，转换为 JSON 字符串
				// Fix P1-23: 添加JSON.stringify错误处理
				try {
					authorizedEmailsJson = JSON.stringify(authorizedEmails);
				} catch (error) {
					console.error('JSON.stringify authorizedEmails 失败:', error);
					throw new BizError('授权邮箱列表序列化失败', 500);
				}
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
			// 修复: 使用 !== undefined 来正确处理0值
			rateLimitPerSecond: rateLimitPerSecond !== undefined ? rateLimitPerSecond : 5,
			autoRecoverySeconds: autoRecoverySeconds !== undefined ? autoRecoverySeconds : 60,
			shareType: shareType || 1,
			authorizedEmails: authorizedEmailsJson,
			// 显示数量限制
			verificationCodeLimit: verificationCodeLimit !== undefined ? verificationCodeLimit : 100,
			verificationCodeLimitEnabled: verificationCodeLimitEnabled !== undefined ? verificationCodeLimitEnabled : 1,
			// 访问次数限制
			otpLimitDaily: otpLimitDaily !== undefined ? otpLimitDaily : 100,
			otpLimitEnabled: otpLimitEnabled !== undefined ? otpLimitEnabled : 1,
			// 模板匹配功能
			filterMode: filterMode || 1,
			templateId: templateId || null,
			showFullEmail: showFullEmail !== undefined ? showFullEmail : 1,
			// 冷却功能配置
			cooldownEnabled: cooldownEnabled !== undefined ? cooldownEnabled : 1,
			cooldownSeconds: cooldownSeconds !== undefined ? cooldownSeconds : 10,
			// 邮件数量限制和自动刷新功能
			latestEmailCount: latestEmailCount !== undefined ? latestEmailCount : null,
			autoRefreshEnabled: autoRefreshEnabled !== undefined ? (autoRefreshEnabled ? 1 : 0) : 0,
			autoRefreshInterval: autoRefreshInterval !== undefined ? autoRefreshInterval : 30,
			// 公告弹窗功能
			announcementContent: announcementContent || null
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
		// 修复：验证shareToken是否有效，防止undefined导致的数据库查询错误
		if (!shareToken || typeof shareToken !== 'string' || !shareToken.trim()) {
			throw new BizError('分享令牌无效', 400);
		}

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

	// 获取用户的分享列表（支持状态筛选和搜索）
	async getUserShares(c, userId, page = 1, pageSize = 20, status, searchParams = {}) {
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
		} else {
			// 全部状态：只显示isActive=1的记录（过滤掉已删除的分享）
			conditions.push(eq(share.isActive, 1));
		}

		// 添加搜索条件
		const { query, searchType } = searchParams;
		if (query && query.trim()) {
			const searchQuery = `%${query.trim()}%`;

			switch (searchType) {
				case 'shareName':
					conditions.push(like(share.shareName, searchQuery));
					break;
				case 'targetEmail':
					conditions.push(like(share.targetEmail, searchQuery));
					break;
				case 'shareToken':
					conditions.push(like(share.shareToken, searchQuery));
					break;
				case 'all':
				default:
					// 搜索所有字段
					conditions.push(
						or(
							like(share.shareName, searchQuery),
							like(share.targetEmail, searchQuery),
							like(share.shareToken, searchQuery)
						)
					);
					break;
			}
		}

		// 添加高级筛选条件
		this.addAdvancedFilterConditions(conditions, searchParams);

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

	// 获取分享总数（支持状态筛选和搜索）
	async getUserShareCount(c, userId, status, searchParams = {}) {
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
		} else if (status !== undefined) {
			// 全部状态（status为空字符串）：只显示isActive=1的记录（过滤掉已删除的分享）
			conditions.push(eq(share.isActive, 1));
		}
		// status为undefined时：不添加任何isActive筛选（用于统计所有记录）

		// 添加搜索条件
		const { query, searchType } = searchParams;
		if (query && query.trim()) {
			const searchQuery = `%${query.trim()}%`;

			switch (searchType) {
				case 'shareName':
					conditions.push(like(share.shareName, searchQuery));
					break;
				case 'targetEmail':
					conditions.push(like(share.targetEmail, searchQuery));
					break;
				case 'shareToken':
					conditions.push(like(share.shareToken, searchQuery));
					break;
				case 'all':
				default:
					// 搜索所有字段
					conditions.push(
						or(
							like(share.shareName, searchQuery),
							like(share.targetEmail, searchQuery),
							like(share.shareToken, searchQuery)
						)
					);
					break;
			}
		}

		// 添加高级筛选条件
		this.addAdvancedFilterConditions(conditions, searchParams);

		const result = await orm(c).select({ count: sql`count(*)` }).from(share)
			.where(and(...conditions))
			.get();

		return result.count;
	},

	// 删除分享
	async delete(c, shareId, userId) {
		console.log('=== SHARE SERVICE DELETE DEBUG START ===');
		console.log('Input shareId:', shareId, 'type:', typeof shareId);
		console.log('Input userId:', userId, 'type:', typeof userId);

		const shareRow = await orm(c).select().from(share)
			.where(and(
				eq(share.shareId, shareId),
				eq(share.userId, userId),
				eq(share.isActive, 1)
			))
			.get();

		console.log('Query result:', shareRow);

		if (!shareRow) {
			console.error('ERROR: Share not found or permission denied');
			console.error('Checking if share exists without userId filter...');

			const shareWithoutUserFilter = await orm(c).select().from(share)
				.where(eq(share.shareId, shareId))
				.get();

			console.log('Share exists (without user filter):', shareWithoutUserFilter);

			if (shareWithoutUserFilter) {
				console.error('Share exists but userId mismatch!');
				console.error('Share userId:', shareWithoutUserFilter.userId, 'type:', typeof shareWithoutUserFilter.userId);
				console.error('Current userId:', userId, 'type:', typeof userId);
			}

			throw new BizError('分享不存在或无权限删除', 404);
		}

		console.log('Permission check passed, proceeding with delete...');

		await orm(c).update(share)
			.set({ isActive: 0 })
			.where(eq(share.shareId, shareId))
			.run();

		// 清除缓存（修复缓存一致性问题）
		console.log('清除缓存...');
		try {
			const cacheManager = new CacheManager(c);
			await cacheManager.delete(`share:${shareRow.shareToken}`);
			console.log('缓存清除成功');
		} catch (cacheError) {
			console.error('缓存清除失败:', cacheError);
			// 缓存清除失败不影响主要功能，但记录错误
		}

		console.log('=== SHARE SERVICE DELETE DEBUG END: SUCCESS ===');
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

		// 清除旧Token缓存
		const cacheManager = new CacheManager(c);
		try {
			await cacheManager.delete(`share:${shareRow.shareToken}`);
		} catch (cacheError) {
			console.error('清除旧Token缓存失败:', cacheError);
			// 继续执行，不影响主要功能
		}

		// 创建新的分享记录对象（包含新Token）
		const updatedShareRow = {
			...shareRow,
			shareToken: newToken
		};

		// 将新Token的分享记录添加到缓存中，确保立即可用
		try {
			await cacheManager.set(`share:${newToken}`, updatedShareRow, 3600); // 缓存1小时
		} catch (cacheError) {
			console.error('设置新Token缓存失败:', cacheError);
			// 缓存设置失败不影响主要功能，但可能影响性能
		}

		// 返回新的分享信息（包含所有必要字段）
		// 重要：使用保存的shareDomain确保刷新后的链接域名与原始链接一致
		const baseUrl = getBaseUrl(c, shareRow.shareDomain);
		return {
			shareId: shareId,
			shareToken: newToken,
			targetEmail: shareRow.targetEmail,
			shareName: shareRow.shareName,
			shareUrl: `${baseUrl}/share/${newToken}`,
			// 返回完整的分享对象以支持前端更新
			...updatedShareRow
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
			case 'updateAdvancedSettings':
				// 批量更新高级设置
				const settings = options.settings || {};

				// 验证设置参数（允许0值表示禁用频率限制）
				if (settings.rateLimitPerSecond !== undefined && (settings.rateLimitPerSecond < 0 || settings.rateLimitPerSecond > 100)) {
					throw new BizError('每秒限制必须在0-100之间（0表示禁用）', 400);
				}
				if (settings.autoRecoverySeconds !== undefined && (settings.autoRecoverySeconds < 0 || settings.autoRecoverySeconds > 3600)) {
					throw new BizError('自动恢复时间必须在0-3600秒之间（0表示禁用自动恢复）', 400);
				}
				if (settings.latestEmailCount !== undefined && settings.latestEmailCount !== null) {
					const count = parseInt(settings.latestEmailCount);
					if (isNaN(count) || count < 1 || count > 100) {
						throw new BizError('最新邮件显示数量必须在 1-100 之间', 400);
					}
				}
				if (settings.autoRefreshEnabled !== undefined) {
					const enabled = parseInt(settings.autoRefreshEnabled);
					if (enabled !== 0 && enabled !== 1) {
						throw new BizError('自动刷新开关参数无效', 400);
					}
				}
				if (settings.autoRefreshInterval !== undefined) {
					const interval = parseInt(settings.autoRefreshInterval);
					if (isNaN(interval) || interval < 10 || interval > 3600) {
						throw new BizError('自动刷新间隔必须在 10-3600 秒之间', 400);
					}
				}

				// 构建更新数据
				updateData = {};
				Object.keys(settings).forEach(key => {
					if (settings[key] !== undefined) {
						updateData[key] = settings[key];
					}
				});

				if (Object.keys(updateData).length === 0) {
					throw new BizError('没有要更新的设置项', 400);
				}
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
			try {
				await cacheManager.delete(`share:${shareRow.shareToken}`);
			} catch (cacheError) {
				console.error(`清除分享 ${shareRow.shareId} 缓存失败:`, cacheError);
				// 继续处理其他分享的缓存清理
			}
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
		console.log('=== shareService.updateAdvancedSettings 开始 ===');
		console.log('输入参数:', { shareId, settings });

		// 🔥 FIX: 获取分享信息用于缓存清除（修复shareRow未定义的错误）
		const shareRow = await this.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}
		console.log('获取分享信息成功:', { shareId, shareToken: shareRow.shareToken });

		const {
			rateLimitPerSecond,
			autoRecoverySeconds,
			keywordFilter,
			verificationCodeLimit,
			verificationCodeLimitEnabled,
			otpLimitEnabled,
			// 新增字段
			latestEmailCount,
			autoRefreshEnabled,
			autoRefreshInterval,
			// 冷却功能配置
			cooldownEnabled,
			cooldownSeconds,
			// 需求 4：支持修改授权邮箱
			authorizedEmails,
			// 人机验证功能
			enableCaptcha,
			// 公告弹窗功能
			announcementContent,
			// 过滤模式和模板字段
			filterMode,
			templateId,
			showFullEmail,
			// 域名选择字段
			shareDomain
		} = settings;

		console.log('解构后的参数:', {
			rateLimitPerSecond,
			autoRecoverySeconds,
			keywordFilter,
			verificationCodeLimit,
			verificationCodeLimitEnabled,
			otpLimitEnabled,
			latestEmailCount,
			autoRefreshEnabled,
			autoRefreshInterval,
			cooldownEnabled,
			cooldownSeconds
		});

		// 验证参数（频率限制：0表示禁用，1-100表示启用）
		console.log('开始参数验证...');
		if (rateLimitPerSecond !== undefined && rateLimitPerSecond !== null && (rateLimitPerSecond < 0 || rateLimitPerSecond > 100)) {
			throw new BizError('每秒限制必须在0-100之间（0表示禁用）', 400);
		}
		if (autoRecoverySeconds !== undefined && autoRecoverySeconds !== null && (autoRecoverySeconds < 0 || autoRecoverySeconds > 3600)) {
			throw new BizError('自动恢复时间必须在0-3600秒之间（0表示禁用自动恢复）', 400);
		}
		// 新增：邮件数量限制验证
		if (latestEmailCount !== undefined && latestEmailCount !== null) {
			const count = parseInt(latestEmailCount);
			console.log('邮件数量验证:', { latestEmailCount, count, isNaN: isNaN(count) });
			if (isNaN(count) || count < 1 || count > 100) {
				throw new BizError('最新邮件显示数量必须在 1-100 之间', 400);
			}
		}
		// 新增：自动刷新参数验证
		if (autoRefreshEnabled !== undefined) {
			const enabled = parseInt(autoRefreshEnabled);
			console.log('自动刷新开关验证:', { autoRefreshEnabled, enabled });
			if (enabled !== 0 && enabled !== 1) {
				throw new BizError('自动刷新开关参数无效', 400);
			}
		}
		if (autoRefreshInterval !== undefined) {
			const interval = parseInt(autoRefreshInterval);
			console.log('自动刷新间隔验证:', { autoRefreshInterval, interval, isNaN: isNaN(interval) });
			if (isNaN(interval) || interval < 10 || interval > 3600) {
				throw new BizError('自动刷新间隔必须在 10-3600 秒之间', 400);
			}
		}
		// 新增：冷却功能参数验证
		if (cooldownEnabled !== undefined) {
			const enabled = parseInt(cooldownEnabled);
			console.log('冷却功能开关验证:', { cooldownEnabled, enabled });
			if (enabled !== 0 && enabled !== 1) {
				throw new BizError('冷却功能开关参数无效', 400);
			}
		}
		if (cooldownSeconds !== undefined) {
			const seconds = parseInt(cooldownSeconds);
			console.log('冷却时间验证:', { cooldownSeconds, seconds, isNaN: isNaN(seconds) });
			if (isNaN(seconds) || seconds < 1 || seconds > 300) {
				throw new BizError('冷却时间必须在 1-300 秒之间', 400);
			}
		}

		// 需求 4：验证 authorizedEmails（仅对 Type 2 分享）
		if (authorizedEmails !== undefined) {
			if (shareRow.shareType !== 2) {
				throw new BizError('只有多邮箱分享（Type 2）才能修改授权邮箱列表', 400);
			}

			// 验证 authorizedEmails 格式
			let authorizedEmailsArray = [];
			if (typeof authorizedEmails === 'string') {
				try {
					authorizedEmailsArray = JSON.parse(authorizedEmails);
				} catch (error) {
					throw new BizError('授权邮箱列表JSON格式无效', 400);
				}
			} else if (Array.isArray(authorizedEmails)) {
				authorizedEmailsArray = authorizedEmails;
			} else {
				throw new BizError('授权邮箱列表必须是数组或JSON字符串', 400);
			}

			// 验证数组不为空
			if (!Array.isArray(authorizedEmailsArray) || authorizedEmailsArray.length === 0) {
				throw new BizError('授权邮箱列表不能为空', 400);
			}

			// 验证每个邮箱
			const MAX_EMAIL_LENGTH = 254;
			const normalizedEmailsSet = new Set();
			for (const email of authorizedEmailsArray) {
				if (!email || !email.trim()) {
					throw new BizError('授权邮箱列表中包含空邮箱地址', 400);
				}
				if (!verifyUtils.isEmail(email)) {
					throw new BizError(`无效的邮箱地址: ${email}`, 400);
				}
				if (email.length > MAX_EMAIL_LENGTH) {
					throw new BizError(`邮箱地址过长: ${email}`, 400);
				}

				// 检查重复邮箱
				const normalizedEmail = sanitizeUtils.sanitizeEmail(email);
				if (normalizedEmailsSet.has(normalizedEmail)) {
					throw new BizError(`授权邮箱列表中包含重复的邮箱: ${email}`, 400);
				}
				normalizedEmailsSet.add(normalizedEmail);
			}

			console.log('授权邮箱验证通过:', { count: authorizedEmailsArray.length });
		}

		console.log('参数验证通过');

		// 分享信息已在方法开始时获取，无需重复获取

		// 构建更新数据
		console.log('构建更新数据...');
		const updateData = {};
		if (rateLimitPerSecond !== undefined) {
			updateData.rateLimitPerSecond = rateLimitPerSecond;
		}
		if (autoRecoverySeconds !== undefined) {
			updateData.autoRecoverySeconds = autoRecoverySeconds;
		}
		if (keywordFilter !== undefined) {
			updateData.keywordFilter = keywordFilter;
		}
		if (verificationCodeLimit !== undefined) {
			updateData.verificationCodeLimit = verificationCodeLimit;
		}
		if (verificationCodeLimitEnabled !== undefined) {
			updateData.verificationCodeLimitEnabled = verificationCodeLimitEnabled;
		}
		if (otpLimitEnabled !== undefined) {
			updateData.otpLimitEnabled = otpLimitEnabled;
		}
		// 新增字段更新
		if (latestEmailCount !== undefined) {
			updateData.latestEmailCount = latestEmailCount;
		}
		if (autoRefreshEnabled !== undefined) {
			updateData.autoRefreshEnabled = autoRefreshEnabled;
		}
		if (autoRefreshInterval !== undefined) {
			updateData.autoRefreshInterval = autoRefreshInterval;
		}
		// 冷却功能配置更新
		if (cooldownEnabled !== undefined) {
			updateData.cooldownEnabled = cooldownEnabled;
		}
		if (cooldownSeconds !== undefined) {
			updateData.cooldownSeconds = cooldownSeconds;
		}
		// 需求 4：授权邮箱更新
		if (authorizedEmails !== undefined) {
			let authorizedEmailsArray = [];
			if (typeof authorizedEmails === 'string') {
				authorizedEmailsArray = JSON.parse(authorizedEmails);
			} else if (Array.isArray(authorizedEmails)) {
				authorizedEmailsArray = authorizedEmails;
			}
			updateData.authorizedEmails = JSON.stringify(authorizedEmailsArray);
		}

		// 人机验证功能 - 仅在字段存在时更新
		// 注意：enable_captcha 列可能在某些数据库中不存在，所以这里不更新
		// if (enableCaptcha !== undefined) {
		//	updateData.enableCaptcha = enableCaptcha ? 1 : 0;
		// }

		// 公告弹窗功能（支持版本控制和图片）
		if (announcementContent !== undefined) {
			// 验证和处理公告内容
			if (announcementContent !== null) {
				// 支持两种格式：纯文本字符串 或 JSON对象
				let processedContent = announcementContent;

				if (typeof announcementContent === 'string') {
					// 如果是字符串，检查是否是JSON格式
					if (announcementContent.startsWith('{')) {
						try {
							const parsed = JSON.parse(announcementContent);
							// 验证JSON结构
							if (parsed.type === 'rich') {
								// 验证图片数组
								if (parsed.images && Array.isArray(parsed.images)) {
									// 计算总大小
									let totalSize = 0;
									parsed.images.forEach(img => {
										if (img.base64) {
											// Base64大小估算：(字符串长度 * 3) / 4
											totalSize += Math.ceil(img.base64.length * 3 / 4);
										}
									});
									// 验证总大小不超过5MB
									if (totalSize > 5 * 1024 * 1024) {
										throw new BizError('公告图片总大小不能超过5MB', 400);
									}
									// 验证图片数量不超过10张
									if (parsed.images.length > 10) {
										throw new BizError('公告图片数量不能超过10张', 400);
									}
								}
								processedContent = JSON.stringify(parsed);
							} else {
								throw new BizError('公告JSON格式无效', 400);
							}
						} catch (error) {
							if (error instanceof BizError) throw error;
							// 如果不是有效的JSON，当作纯文本处理
							if (announcementContent.length > 5000) {
								throw new BizError('公告内容不能超过5000字符', 400);
							}
						}
					} else {
						// 纯文本格式
						if (announcementContent.length > 5000) {
							throw new BizError('公告内容不能超过5000字符', 400);
						}
					}
				} else if (typeof announcementContent === 'object') {
					// 如果是对象，转换为JSON字符串
					if (announcementContent.type === 'rich') {
						// 验证图片数组
						if (announcementContent.images && Array.isArray(announcementContent.images)) {
							let totalSize = 0;
							announcementContent.images.forEach(img => {
								if (img.base64) {
									totalSize += Math.ceil(img.base64.length * 3 / 4);
								}
							});
							if (totalSize > 5 * 1024 * 1024) {
								throw new BizError('公告图片总大小不能超过5MB', 400);
							}
							if (announcementContent.images.length > 10) {
								throw new BizError('公告图片数量不能超过10张', 400);
							}
						}
						processedContent = JSON.stringify(announcementContent);
					} else {
						throw new BizError('公告JSON格式无效', 400);
					}
				}

				updateData.announcementContent = processedContent;
			} else {
				updateData.announcementContent = null;
			}

			// 当公告内容更新时，自动更新版本号（使用当前时间戳）
			// 这样前端可以通过比较版本号来判断是否需要重新显示公告
			if (announcementContent !== null) {
				updateData.announcementVersion = Math.floor(Date.now() / 1000);
			} else {
				// 如果公告内容被清空，也清空版本号
				updateData.announcementVersion = null;
			}
		}

		// 过滤模式和模板字段更新
		if (filterMode !== undefined) {
			// 验证过滤模式（1: 关键词过滤, 2: 模板匹配）
			if (filterMode !== 1 && filterMode !== 2) {
				throw new BizError('过滤模式必须为1（关键词过滤）或2（模板匹配）', 400);
			}
			updateData.filterMode = filterMode;
		}
		if (templateId !== undefined) {
			updateData.templateId = templateId || null;
		}
		if (showFullEmail !== undefined) {
			updateData.showFullEmail = showFullEmail;
		}

		// 域名选择字段更新
		if (shareDomain !== undefined) {
			updateData.shareDomain = shareDomain || null;
		}

		console.log('构建的更新数据:', updateData);

		// 如果没有要更新的数据，直接返回
		if (Object.keys(updateData).length === 0) {
			console.log('没有要更新的数据，直接返回');
			return { success: true };
		}

		// 更新数据库
		console.log('开始更新数据库...');
		try {
			await orm(c).update(share)
				.set(updateData)
				.where(eq(share.shareId, shareId))
				.run();
			console.log('数据库更新成功');
		} catch (dbError) {
			console.error('数据库更新失败:', dbError);
			throw dbError;
		}

		// 清除缓存
		console.log('清除缓存...');
		try {
			const cacheManager = new CacheManager(c);
			await cacheManager.delete(`share:${shareRow.shareToken}`);
			console.log('缓存清除成功');
		} catch (cacheError) {
			console.error('缓存清除失败:', cacheError);
			// 缓存清除失败不影响主要功能
		}

		console.log('=== shareService.updateAdvancedSettings 结束 ===');
		return { success: true };
	}
};

export default shareService;
