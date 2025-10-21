import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';
import userService from '../service/user-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
import shareService from '../service/share-service';
import shareAccessLogService from '../service/share-access-log-service';
import emailTemplateService from '../service/email-template-service';
import emailUtils from '../utils/email-utils';
import verifyUtils from '../utils/verify-utils'; // Fix P0-1: 添加邮箱验证工具
import sanitizeUtils from '../utils/sanitize-utils'; // Fix P0-5: 添加输入清理工具
import BizError from '../error/biz-error';
import dayjs from 'dayjs';
import { shareRateLimitMiddleware } from '../middleware/rate-limiter';
import { share } from '../entity/share';
import { account } from '../entity/account';
import { email } from '../entity/email';
import { shareAccessLog } from '../entity/share-access-log';
import orm from '../entity/orm';
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import { isDel } from '../const/entity-const';
import shareCaptchaService from '../service/share-captcha-service';

// 创建邮箱验证码分享
app.post('/share/create', async (c) => {
	try {
		const requestBody = await c.req.json();

		const {
			// 支持新旧两种参数格式
			targetEmail,
			targetEmails,
			authorizedEmails,
			shareName,
			shareDomain,
			domain, // 新格式参数
			keywordFilter,
			expireTime,
			expiresAt, // 新格式参数
			rateLimitPerSecond,
			autoRecoverySeconds,
			shareType,
			verificationCodeLimit,
			verificationCodeLimitEnabled,
			otpLimitDaily,
			otpLimitEnabled,
			maxEmailCount, // 新格式参数
			maxAccessCount, // 新格式参数
			// 新增参数：邮件数量限制和自动刷新功能
			latestEmailCount,
			autoRefreshEnabled,
			autoRefreshInterval,
			// 新增参数：模板匹配功能
			filterMode,
			templateId,
			showFullEmail,
			// 新增参数：冷却功能配置
			cooldownEnabled,
			cooldownSeconds,
			// 新增参数：人机验证功能
			enableCaptcha,
			captchaToken,
			// 新增参数：公告弹窗功能
			announcementContent
		} = requestBody;
		const userId = userContext.getUserId(c);

		// 参数格式兼容处理
		const finalTargetEmail = targetEmail || (targetEmails && targetEmails[0]);
		const finalShareDomain = shareDomain || domain;
		const finalExpireTime = expireTime || expiresAt;
		const finalMaxEmailCount = verificationCodeLimit || maxEmailCount;
		const finalMaxAccessCount = otpLimitDaily || maxAccessCount;
		
		// 确保 shareType 是数字类型
		let finalShareType = shareType;
		if (typeof shareType === 'string') {
			if (shareType === 'single') {
				finalShareType = 1;
			} else if (shareType === 'input') {
				finalShareType = 2;
			} else {
				finalShareType = parseInt(shareType) || 1;
			}
		}
		// Fix P0-5: 清理用户输入，防止 XSS 攻击
		const cleanedTargetEmail = sanitizeUtils.sanitizeEmail(finalTargetEmail);
		const cleanedShareName = sanitizeUtils.sanitizeInput(shareName, 200);
		const cleanedKeywordFilter = sanitizeUtils.sanitizeInput(keywordFilter, 500);

		// Fix P0-1: 使用标准邮箱验证替代简陋的 includes('@') 检查
		// Fix P1-26: 检查targetEmail是否为空或只有空格
		if (!cleanedTargetEmail || !cleanedTargetEmail.trim() || !verifyUtils.isEmail(cleanedTargetEmail)) {
			throw new BizError('请输入有效的邮箱地址', 400);
		}

		// Fix P1-1: 输入长度限制
		const MAX_SHARE_NAME_LENGTH = 200;
		const MAX_KEYWORD_FILTER_LENGTH = 500;
		const MAX_AUTHORIZED_EMAILS = 50;

		if (shareName && shareName.length > MAX_SHARE_NAME_LENGTH) {
			throw new BizError(`分享名称不能超过 ${MAX_SHARE_NAME_LENGTH} 个字符`, 400);
		}

		if (keywordFilter && keywordFilter.length > MAX_KEYWORD_FILTER_LENGTH) {
			throw new BizError(`关键词过滤器不能超过 ${MAX_KEYWORD_FILTER_LENGTH} 个字符`, 400);
		}

		// Fix P1-2: 数值范围验证（允许0值表示禁用频率限制）
		const MIN_RATE_LIMIT = 0; // 0表示禁用频率限制
		const MAX_RATE_LIMIT_PER_SECOND = 100;
		const MAX_AUTO_RECOVERY_SECONDS = 3600;

		if (rateLimitPerSecond !== undefined) {
			const rate = parseInt(rateLimitPerSecond);
			if (isNaN(rate) || rate < MIN_RATE_LIMIT || rate > MAX_RATE_LIMIT_PER_SECOND) {
				throw new BizError(`每秒频率限制必须在 ${MIN_RATE_LIMIT}-${MAX_RATE_LIMIT_PER_SECOND} 之间（0表示禁用）`, 400);
			}
		}

		if (autoRecoverySeconds !== undefined) {
			const seconds = parseInt(autoRecoverySeconds);
			if (isNaN(seconds) || seconds < MIN_RATE_LIMIT || seconds > MAX_AUTO_RECOVERY_SECONDS) {
				throw new BizError(`自动恢复时间必须在 ${MIN_RATE_LIMIT}-${MAX_AUTO_RECOVERY_SECONDS} 秒之间（0表示禁用自动恢复）`, 400);
			}
		}

		// 新增：邮件数量限制验证
		if (latestEmailCount !== undefined && latestEmailCount !== null) {
			const count = parseInt(latestEmailCount);
			if (isNaN(count) || count < 1 || count > 100) {
				throw new BizError('最新邮件显示数量必须在 1-100 之间', 400);
			}
		}

		// 新增：自动刷新参数验证
		if (autoRefreshEnabled !== undefined && autoRefreshEnabled !== null) {
			// 处理布尔值和数字值
			const enabled = typeof autoRefreshEnabled === 'boolean'
				? (autoRefreshEnabled ? 1 : 0)
				: parseInt(autoRefreshEnabled);
			if (enabled !== 0 && enabled !== 1) {
				throw new BizError('自动刷新开关参数无效', 400);
			}
		}

		if (autoRefreshInterval !== undefined) {
			const interval = parseInt(autoRefreshInterval);
			if (isNaN(interval) || interval < 10 || interval > 3600) {
				throw new BizError('自动刷新间隔必须在 10-3600 秒之间', 400);
			}
		}

		// Fix P1-3: expireTime 验证
		const MIN_EXPIRE_HOURS = 1;
		const MAX_EXPIRE_DAYS = 365;

		if (finalExpireTime) {
			const expireDate = dayjs(finalExpireTime);
			const now = dayjs();
			
			if (!expireDate.isValid()) {
				throw new BizError('过期时间格式错误', 400);
			}
			
			if (expireDate.isBefore(now.add(MIN_EXPIRE_HOURS, 'hour'))) {
				throw new BizError(`过期时间必须至少在 ${MIN_EXPIRE_HOURS} 小时后`, 400);
			}
			
			if (expireDate.isAfter(now.add(MAX_EXPIRE_DAYS, 'day'))) {
				throw new BizError(`过期时间不能超过 ${MAX_EXPIRE_DAYS} 天`, 400);
			}
		}

		// Fix P1-4: shareType 验证
		const VALID_SHARE_TYPES = [1, 2];

		if (finalShareType !== undefined && !VALID_SHARE_TYPES.includes(finalShareType)) {
			throw new BizError('无效的分享类型，必须为 1 或 2', 400);
		}

		// Fix P1-4: 确保 Type 2 分享必须提供 authorizedEmails
		if (finalShareType === 2 && (!authorizedEmails || authorizedEmails.length === 0)) {
			throw new BizError('Type 2 分享必须提供至少一个授权邮箱', 400);
		}

		// Fix P1-9: 对于 Type 2 分享，targetEmail 必须在 authorizedEmails 中
		if (finalShareType === 2 && authorizedEmails) {
			const targetEmailLower = cleanedTargetEmail.toLowerCase();
			const isTargetInAuthorized = authorizedEmails.some(email =>
				sanitizeUtils.sanitizeEmail(email).toLowerCase() === targetEmailLower
			);
			if (!isTargetInAuthorized) {
				throw new BizError('主邮箱必须在授权邮箱列表中', 400);
			}
		}

		// 对于 Type 2 分享，验证 authorizedEmails
		if (finalShareType === 2 && authorizedEmails) {
			if (!Array.isArray(authorizedEmails)) {
				throw new BizError('授权邮箱列表必须是数组格式', 400);
			}

			// Fix P1-28: 检查authorizedEmails是否为空数组
			if (authorizedEmails.length === 0) {
				throw new BizError('授权邮箱列表不能为空', 400);
			}

			// Fix P1-1: 限制授权邮箱数量
			if (authorizedEmails.length > MAX_AUTHORIZED_EMAILS) {
				throw new BizError(`授权邮箱数量不能超过 ${MAX_AUTHORIZED_EMAILS} 个`, 400);
			}

			// Fix P0-1: 使用标准邮箱验证
			// Fix P1-19: 验证邮箱长度
			// Fix P1-25: 验证邮箱不为空或只有空格
			// Fix P1-30: 在验证阶段检测重复邮箱
			const MAX_EMAIL_LENGTH = 254; // RFC standard
			const normalizedEmailsSet = new Set();
			for (const email of authorizedEmails) {
				// 检查邮箱是否为空或只有空格
				if (!email || !email.trim()) {
					throw new BizError('授权邮箱列表中包含空邮箱地址', 400);
				}
				if (!verifyUtils.isEmail(email)) {
					throw new BizError(`无效的邮箱地址: ${email}`, 400);
				}
				if (email.length > MAX_EMAIL_LENGTH) {
					throw new BizError(`邮箱地址过长: ${email}`, 400);
				}

				// 检查是否有重复的邮箱（规范化后比较）
				const normalizedEmail = sanitizeUtils.sanitizeEmail(email);
				if (normalizedEmailsSet.has(normalizedEmail)) {
					throw new BizError(`授权邮箱列表中包含重复的邮箱: ${email}`, 400);
				}
				normalizedEmailsSet.add(normalizedEmail);
			}
		}

		// Fix P0-5: 使用清理后的邮箱地址
		// 检查当前用户是否为管理员
		const currentUser = await userService.selectById(c, userId);
		const isAdmin = currentUser && (currentUser.email === c.env.admin || currentUser.role === 'admin');

		// 验证邮箱域名是否在允许的域名列表中（管理员可以绕过此限制）
		if (!isAdmin && !c.env.domain.includes(emailUtils.getDomain(cleanedTargetEmail))) {
			throw new BizError('该邮箱域名不在系统支持的域名列表中', 403);
		}

		// Fix: 移除邮箱存在性检查
		// 原因：这是一个域名邮箱转发系统，任何 [字符串]@[域名] 组合都是有效的转发地址
		// 邮箱不需要预先存在于 accounts 表中，只需要验证格式和域名有效性
		// 尝试获取现有账户信息（用于后续权限检查），但不强制要求存在
		let existingAccount = await accountService.selectByEmailIncludeDel(c, cleanedTargetEmail);

		// Fix: 移除授权邮箱存在性检查
		// 原因：这是一个域名邮箱转发系统，授权邮箱不需要预先存在于 accounts 表中
		// 邮箱格式和域名验证已在第 232-249 行进行，无需再检查数据库存在性
		// 对于 Type 2 分享，授权邮箱列表已经过格式验证，可以直接使用
		if (finalShareType === 2 && authorizedEmails && authorizedEmails.length > 0) {
			// Fix P1-10: 对授权邮箱进行去重处理
			const uniqueAuthorizedEmails = [...new Set(
				authorizedEmails.map(email => sanitizeUtils.sanitizeEmail(email).toLowerCase())
			)];

			// 验证每个授权邮箱的域名是否在允许列表中
			for (const authorizedEmail of uniqueAuthorizedEmails) {
				const cleanedAuthEmail = authorizedEmail; // 已经清理和转换为小写

				// 只验证域名，不检查邮箱是否存在于数据库
				if (!isAdmin && !c.env.domain.includes(emailUtils.getDomain(cleanedAuthEmail))) {
					throw new BizError(`授权邮箱 ${cleanedAuthEmail} 的域名不在系统支持的域名列表中`, 403);
				}
			}
		}

		// Fix: 调整权限检查逻辑
		// 原因：邮箱可能不存在于 accounts 表中，只在邮箱存在时进行权限检查
		// 管理员可以分享任何邮箱，普通用户只能分享自己的邮箱（如果邮箱存在）
		if (!isAdmin) {
			// 如果邮箱存在于系统中，检查所有权
			if (existingAccount && existingAccount.userId !== userId) {
				throw new BizError('您没有权限分享此邮箱', 403);
			}
			// 如果邮箱不存在，普通用户可以创建分享（邮箱将作为转发地址使用）
		} else {
			// 管理员权限：可以分享任何邮箱，包括系统中的其他邮箱
		}

		// Fix P0-5: 使用清理后的输入创建分享记录
		// 验证模板匹配参数
		if (filterMode === 2 && !templateId) {
			throw new BizError('使用模板匹配模式时必须选择模板', 400);
		}

		// Fix P1-29: 规范化authorizedEmails，确保存储的邮箱格式一致
		let normalizedAuthorizedEmails = authorizedEmails;
		if (finalShareType === 2 && authorizedEmails && Array.isArray(authorizedEmails)) {
			normalizedAuthorizedEmails = authorizedEmails.map(email =>
				sanitizeUtils.sanitizeEmail(email)
			);
		}

		// 验证 Turnstile token（如果启用了人机验证）
		if (enableCaptcha && captchaToken) {
			const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
			await shareCaptchaService.verifyCaptchaToken(c, captchaToken, clientIp, 'create');
		}

		// 创建分享记录到数据库
		const shareData = {
			targetEmail: cleanedTargetEmail,
			shareName: cleanedShareName || `${cleanedTargetEmail}的验证码接收`,
			shareDomain: finalShareDomain, // 用户指定的域名
			keywordFilter: cleanedKeywordFilter || '验证码|verification|code|otp',
			expireTime: finalExpireTime || dayjs().add(7, 'day').toISOString(),
			// 修复: 使用 !== undefined 来正确处理0值（0表示禁用频率限制）
			rateLimitPerSecond: rateLimitPerSecond !== undefined ? rateLimitPerSecond : 5,
			autoRecoverySeconds: autoRecoverySeconds !== undefined ? autoRecoverySeconds : 60,
			shareType: finalShareType, // 使用处理后的数字类型
			authorizedEmails: normalizedAuthorizedEmails, // 直接传递数组，由 service 层处理 JSON 转换
			// 显示数量限制
			verificationCodeLimit: finalMaxEmailCount !== undefined ? finalMaxEmailCount : 100,
			verificationCodeLimitEnabled: verificationCodeLimitEnabled !== undefined ? (verificationCodeLimitEnabled ? 1 : 0) : 1,
			// 访问次数限制
			otpLimitDaily: finalMaxAccessCount !== undefined ? finalMaxAccessCount : 100,
			otpLimitEnabled: otpLimitEnabled !== undefined ? (otpLimitEnabled ? 1 : 0) : 1,
			// 新增：邮件数量限制和自动刷新功能
			latestEmailCount: latestEmailCount !== undefined && latestEmailCount !== null ? parseInt(latestEmailCount) : null,
			autoRefreshEnabled: autoRefreshEnabled !== undefined ? (autoRefreshEnabled ? 1 : 0) : 0,
			autoRefreshInterval: autoRefreshInterval !== undefined ? parseInt(autoRefreshInterval) : 30,
			// 新增：模板匹配功能
			filterMode: filterMode || 1, // 1=关键词过滤, 2=模板匹配
			templateId: templateId || null,
			showFullEmail: showFullEmail !== undefined ? (showFullEmail ? 1 : 0) : 1, // 默认显示完整邮件
			// 新增：冷却功能配置
			cooldownEnabled: cooldownEnabled !== undefined ? (cooldownEnabled ? 1 : 0) : 1, // 默认启用冷却
			cooldownSeconds: cooldownSeconds !== undefined ? parseInt(cooldownSeconds) : 10, // 默认10秒
			// 新增：人机验证功能
			enableCaptcha: enableCaptcha !== undefined ? (enableCaptcha ? 1 : 0) : 0, // 默认禁用
			// 新增：公告弹窗功能
			announcementContent: announcementContent || null, // 公告内容，NULL表示没有公告
			announcementVersion: announcementContent ? Date.now() : null // 公告版本号（时间戳），用于检测公告更新
		};

		const shareRecord = await shareService.create(c, shareData, userId);

		return c.json(result.ok(shareRecord));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('创建分享失败'), 500);
	}
});

// 获取用户的分享列表 - 必须在 :shareToken 路由之前
app.get('/share/list', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const queryParams = c.req.query();
		const {
			page = 1,
			pageSize = 20,
			status,
			query,
			searchType,
			// 高级筛选参数
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
		} = queryParams;

		// 构建搜索参数
		const searchParams = {};
		if (query && query.trim()) {
			searchParams.query = query.trim();
			searchParams.searchType = searchType || 'all';
		}

		// 添加高级筛选参数
		if (createTimeStart) searchParams.createTimeStart = createTimeStart;
		if (createTimeEnd) searchParams.createTimeEnd = createTimeEnd;
		if (expireTimeStart) searchParams.expireTimeStart = expireTimeStart;
		if (expireTimeEnd) searchParams.expireTimeEnd = expireTimeEnd;
		if (otpLimitMin !== undefined) searchParams.otpLimitMin = otpLimitMin;
		if (otpLimitMax !== undefined) searchParams.otpLimitMax = otpLimitMax;
		if (verificationCodeLimitMin !== undefined) searchParams.verificationCodeLimitMin = verificationCodeLimitMin;
		if (verificationCodeLimitMax !== undefined) searchParams.verificationCodeLimitMax = verificationCodeLimitMax;
		if (shareTypes) searchParams.shareTypes = shareTypes;
		if (otpLimitEnabled !== undefined) searchParams.otpLimitEnabled = otpLimitEnabled;
		if (verificationCodeLimitEnabled !== undefined) searchParams.verificationCodeLimitEnabled = verificationCodeLimitEnabled;

		const shares = await shareService.getUserShares(c, userId, parseInt(page), parseInt(pageSize), status, searchParams);
		const total = await shareService.getUserShareCount(c, userId, status, searchParams);

		// 返回各状态的统计数据（用于前端标签显示）
		// 注意：统计数据不受搜索影响，始终显示全部数据的统计
		const stats = {
			total: await shareService.getUserShareCount(c, userId),
			active: await shareService.getUserShareCount(c, userId, 'active'),
			expired: await shareService.getUserShareCount(c, userId, 'expired'),
			disabled: await shareService.getUserShareCount(c, userId, 'disabled')
		};

		return c.json(result.ok({
			list: shares,
			total: total,
			stats: stats,
			page: parseInt(page),
			pageSize: parseInt(pageSize),
			searchParams: searchParams // 返回搜索参数供前端确认
		}));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取分享列表失败'), 500);
	}
});

// 分享访问验证（添加频率限制 - 仅限制恶意用户）
app.get('/share/info/:shareToken', shareRateLimitMiddleware, async (c) => {
	try {
		const shareToken = c.req.param('shareToken');

		// 从数据库获取分享信息
		const shareRecord = await shareService.getByToken(c, shareToken);

		return c.json(result.ok({
			targetEmail: shareRecord.targetEmail,
			shareName: shareRecord.shareName,
			keywordFilter: shareRecord.keywordFilter,
			createTime: shareRecord.createTime,
			expireTime: shareRecord.expireTime,
			shareType: shareRecord.shareType || 1,
			// 新增：自动刷新配置
			autoRefreshEnabled: shareRecord.autoRefreshEnabled || 0,
			autoRefreshInterval: shareRecord.autoRefreshInterval || 30,
			latestEmailCount: shareRecord.latestEmailCount,
			// 新增：冷却配置
			cooldownEnabled: shareRecord.cooldownEnabled !== undefined ? shareRecord.cooldownEnabled : 1,
			cooldownSeconds: shareRecord.cooldownSeconds || 10,
			// 新增：公告弹窗功能（包含版本控制）
			announcementContent: shareRecord.announcementContent || null,
			announcementVersion: shareRecord.announcementVersion || null
		}));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('访问分享链接失败'), 500);
	}
});

// 获取分享邮箱的验证码邮件（添加频率限制 - 仅限制恶意用户）
app.get('/share/emails/:shareToken', shareRateLimitMiddleware, async (c) => {
	const startTime = Date.now();
	let accessResult = 'failed';
	let errorMessage = '';
	let extractedCodes = [];
	let emailCount = 0;

	try {
		const shareToken = c.req.param('shareToken');
		const { userEmail } = c.req.query();

		// 从数据库获取分享信息
		const shareRecord = await shareService.getByToken(c, shareToken);

		// Fix P1-21: 验证shareRecord的shareType是否有效
		const VALID_SHARE_TYPES = [1, 2];
		if (!VALID_SHARE_TYPES.includes(shareRecord.shareType)) {
			errorMessage = '分享配置错误：无效的分享类型';
			accessResult = 'failed';
			throw new BizError(errorMessage, 500);
		}

		// 根据分享类型进行不同的验证
		if (shareRecord.shareType === 2) {
			// 类型2：多邮箱验证分享
			// Fix P1-27: 严格检查userEmail，防止空字符串或只有空格的字符串
			if (!userEmail || !userEmail.trim()) {
				errorMessage = '请输入邮箱地址进行验证';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}

			// Fix P1-17: 验证邮箱格式
			if (!verifyUtils.isEmail(userEmail)) {
				errorMessage = '请输入有效的邮箱地址';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}

			// Fix P1-41: 验证邮箱长度
			const MAX_EMAIL_LENGTH = 254; // RFC standard
			if (userEmail.length > MAX_EMAIL_LENGTH) {
				errorMessage = `邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`;
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}

			// Fix P0-3: JSON 解析失败时应拒绝访问而非静默失败
			let authorizedEmails = [];
			try {
				if (!shareRecord.authorizedEmails) {
					throw new BizError('授权邮箱列表配置错误', 500);
				}
				authorizedEmails = JSON.parse(shareRecord.authorizedEmails);
				
				if (!Array.isArray(authorizedEmails) || authorizedEmails.length === 0) {
					throw new BizError('授权邮箱列表格式错误', 500);
				}
			} catch (error) {
				errorMessage = '分享配置错误，请联系管理员';
				accessResult = 'failed';

				// 不在这里记录访问日志，让外层catch统一处理
				throw new BizError(errorMessage, 500);
			}

			// Fix P1-11: 使用 sanitizeUtils 规范化邮箱进行比较，确保一致性
			const normalizedUserEmail = sanitizeUtils.sanitizeEmail(userEmail);
			const isAuthorized = authorizedEmails.some(authorizedEmail =>
				sanitizeUtils.sanitizeEmail(authorizedEmail) === normalizedUserEmail
			);

			if (!isAuthorized) {
				errorMessage = '该邮箱不在此分享的授权列表中';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 403);
			}

			// Fix P0-6: 使用新变量而非直接修改查询结果对象
			// 验证通过，使用输入的邮箱作为有效目标邮箱
		} else {
			// 类型1：单邮箱分享（原有逻辑）
			// Fix P1-13: 使用 sanitizeUtils 规范化邮箱进行比较，确保一致性
			// Fix P1-22: 严格检查userEmail，防止空字符串或只有空格的字符串
			if (userEmail && userEmail.trim()) {
				// Fix P1-18: 验证邮箱格式
				if (!verifyUtils.isEmail(userEmail)) {
					errorMessage = '请输入有效的邮箱地址';
					accessResult = 'rejected';
					throw new BizError(errorMessage, 400);
				}

				// Fix P1-44: 验证邮箱长度（Type 1）
				const MAX_EMAIL_LENGTH = 254; // RFC standard
				if (userEmail.length > MAX_EMAIL_LENGTH) {
					errorMessage = `邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`;
					accessResult = 'rejected';
					throw new BizError(errorMessage, 400);
				}

				const normalizedUserEmail = sanitizeUtils.sanitizeEmail(userEmail);
				if (normalizedUserEmail !== shareRecord.targetEmail.toLowerCase()) {
					errorMessage = '输入的邮箱与分享邮箱不匹配';
					accessResult = 'rejected';
					throw new BizError(errorMessage, 400);
				}
			}
		}

		// Fix P0-6: 根据分享类型确定有效的目标邮箱
		// Fix P1-12: 对 Type 2 分享的 userEmail 进行规范化处理，确保与数据库中的邮箱格式一致
		const effectiveTargetEmail = shareRecord.shareType === 2 ? sanitizeUtils.sanitizeEmail(userEmail) : shareRecord.targetEmail;

		// Fix P1-20: 验证数据库中的targetEmail是否有效
		if (!verifyUtils.isEmail(effectiveTargetEmail)) {
			errorMessage = '分享配置错误：邮箱地址无效';
			accessResult = 'failed';
			throw new BizError(errorMessage, 500);
		}

		// Fix: 移除访问分享时的域名验证 - 本地开发环境优化
		// 原因: 分享链接应该是公开访问的，不应该依赖当前的域名配置
		// 域名验证已经在创建分享时进行(第 216 行)，访问时不需要再次验证
		// 这样确保本地开发环境的分享链接可以正常访问，不受域名列表变更影响
		/*
		if (!c.env.domain.includes(emailUtils.getDomain(effectiveTargetEmail))) {
			errorMessage = '该邮箱域名不在系统支持的域名列表中';
			accessResult = 'rejected';
			throw new BizError(errorMessage, 403);
		}
		*/

		// Fix P0-6: 使用 effectiveTargetEmail 而非 shareRecord.targetEmail
		// 获取该邮箱的账户信息
		let targetAccount = await accountService.selectByEmailIncludeDel(c, effectiveTargetEmail);

		// Fix P1-5: 对于 Type 2 分享，邮箱必须已经存在（在创建分享时已创建）
		if (!targetAccount) {
			if (shareRecord.shareType === 2) {
				// Type 2 分享的邮箱应该在创建分享时已经创建，不应该自动创建
				errorMessage = '邮箱账户不存在，请联系管理员';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 500);
			}

			// Type 1 分享：如果邮箱账户不存在，使用分享创建者的userId自动创建
			try {
				targetAccount = await accountService.add(c, { email: effectiveTargetEmail }, shareRecord.userId);
			} catch (error) {
				errorMessage = '邮箱账户创建失败';
				accessResult = 'failed';
				throw new BizError(errorMessage, 500);
			}
		}

		// Fix P1-6: 检查账户是否被删除
		if (targetAccount && targetAccount.isDel === isDel.DELETE) {
			errorMessage = '邮箱账户已被删除，无法访问';
			accessResult = 'rejected';
			throw new BizError(errorMessage, 403);
		}

		// 获取该邮箱的最新邮件
		let emails = await emailService.latest(c, {
			emailId: 0,
			accountId: targetAccount.accountId
		}, targetAccount.userId);

		let filteredEmails = [];
		
		// 根据过滤模式处理邮件
		let keywords = []; // 声明在外部，避免作用域问题

		if (shareRecord.filterMode === 2 && shareRecord.templateId) {
			// 模板匹配模式
			const template = await emailTemplateService.getById(c, shareRecord.templateId);

			if (!template) {
				throw new BizError('模板不存在', 404);
			}

			// 使用模板匹配和提取验证码
			filteredEmails = emails.map((email) => {
				const emailContent = {
					subject: email.subject || '',
					from: email.sendEmail || '',
					body: (email.text || '') + ' ' + (email.content || '')
				};

				const extractionResult = emailTemplateService.extractVerificationCode(emailContent, template);

				if (extractionResult.success) {
					// 记录提取的验证码
					extractedCodes.push(extractionResult.verificationCode);

					return {
						emailId: email.emailId,
						subject: email.subject,
						sendEmail: email.sendEmail,
						text: email.text,
						content: shareRecord.showFullEmail ? email.content : null,
						createTime: email.createTime,
						extractedCode: extractionResult.verificationCode,
						isVerificationEmail: true,
						templateMatched: true,
						extractionReason: 'template_match'
					};
				}
				return null;
			}).filter(email => email !== null);
		} else {
			// 关键词过滤模式（原有逻辑）
			const userKeywords = shareRecord.keywordFilter || '验证码|verification|code|otp';
			keywords = userKeywords.split('|').map(k => k.trim().toLowerCase()).filter(k => k);

			// 增强的验证码检测正则表达式（支持字母数字混合）
			const verificationCodePatterns = [
				/\b[A-Z0-9]{6}\b/g,    // 6位字母数字混合（如 5PCPCC）
				/\b[A-Z0-9]{5}\b/g,    // 5位字母数字混合
				/\b[A-Z0-9]{4}\b/g,    // 4位字母数字混合
				/\b\d{6}\b/g,          // 6位纯数字
				/\b\d{5}\b/g,          // 5位纯数字
				/\b\d{4}\b/g,          // 4位纯数字
				/verification.*?code.*?([A-Z0-9]{4,6})/gi,  // 包含verification code的
				/验证码.*?([A-Z0-9]{4,6})/gi,              // 中文验证码
				/code.*?([A-Z0-9]{4,6})/gi                 // 包含code的
			];

			// 使用用户配置的关键词过滤邮件
			filteredEmails = emails.filter(email => {
				const content = (email.subject + ' ' + email.text + ' ' + email.content).toLowerCase();

				// 检查是否匹配用户配置的任何关键词
				return keywords.some(keyword => content.includes(keyword));
			}).map(email => {
				// 智能提取验证码（支持字母数字混合）
				const fullContent = email.subject + ' ' + email.text + ' ' + email.content;
				let extractedCode = '';

				// 优先从HTML内容中查找验证码（更准确）
				const htmlContent = email.content || '';

				// 查找HTML中的验证码（通常在特定的标签或样式中）
				const htmlCodeMatch = htmlContent.match(/<td[^>]*>([A-Z0-9]{4,6})<\/td>/gi) ||
									  htmlContent.match(/>([A-Z0-9]{4,6})</gi);

				if (htmlCodeMatch && htmlCodeMatch.length > 0) {
					// 提取HTML标签中的验证码
					const codeMatch = htmlCodeMatch[0].match(/([A-Z0-9]{4,6})/);
					if (codeMatch) {
						extractedCode = codeMatch[1];
					}
				} else {
					// 回退到正则表达式匹配
					for (const pattern of verificationCodePatterns) {
						const matches = fullContent.match(pattern);
						if (matches && matches.length > 0) {
							extractedCode = matches[0];
							break;
						}
					}
				}

				// 记录提取的验证码
				if (extractedCode) {
					extractedCodes.push(extractedCode);
				}

				return {
					emailId: email.emailId,
					subject: email.subject,
					sendEmail: email.sendEmail,
					text: email.text,
					content: email.content,
					createTime: email.createTime,
					extractedCode: extractedCode,
					isVerificationEmail: true,
					templateMatched: false,
					extractionReason: 'keyword_match'
				};
			});
		}

		// 检查访问次数限制（如果启用）
		if (shareRecord.otpLimitEnabled === 1) {
			const today = dayjs().format('YYYY-MM-DD');

			// 如果是新的一天，重置计数
			if (shareRecord.lastResetDate !== today) {
				await shareService.resetDailyCount(c, shareRecord.shareId, today);
				shareRecord.otpCountDaily = 0;
			}

			// 检查是否达到每日限制
			if (shareRecord.otpCountDaily >= shareRecord.otpLimitDaily) {
				errorMessage = `今日访问次数已达上限（${shareRecord.otpLimitDaily}次）`;
				accessResult = 'rejected';
				throw new BizError(errorMessage, 429);
			}

			// 增加访问计数
			await shareService.incrementDailyCount(c, shareRecord.shareId);
		}

		// 应用显示数量限制（优先使用新的 latestEmailCount 字段）
		let latestFilteredEmails;

		// 新功能：最新邮件数量限制（优先级最高）
		if (shareRecord.latestEmailCount !== null && shareRecord.latestEmailCount !== undefined) {
			latestFilteredEmails = filteredEmails.slice(0, shareRecord.latestEmailCount);
		}
		// 兼容旧功能：验证码数量限制
		else if (shareRecord.verificationCodeLimitEnabled === 1) {
			latestFilteredEmails = filteredEmails.slice(0, shareRecord.verificationCodeLimit || 100);
		}
		// 默认：显示全部
		else {
			latestFilteredEmails = filteredEmails;
		}

		emailCount = latestFilteredEmails.length;
		accessResult = 'success';

		// 提取邮件ID列表
		const emailIds = latestFilteredEmails.map(email => email.emailId);

		// 记录访问日志
		const responseTime = Date.now() - startTime;
		await shareAccessLogService.recordAccess(c, {
			shareId: shareRecord.shareId,
			shareToken: shareToken,
			accessIp: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
			userAgent: c.req.header('user-agent') || '',
			accessEmail: userEmail || shareRecord.targetEmail,
			extractedCodes: extractedCodes,
			accessResult: accessResult,
			errorMessage: '',
			responseTime: responseTime,
			emailCount: emailCount,
			emailIds: emailIds // 保存访问时返回的邮件ID列表
		});

		return c.json(result.ok({
			emails: latestFilteredEmails,
			total: latestFilteredEmails.length,
			targetEmail: shareRecord.targetEmail,
			message: latestFilteredEmails.length > 0 ? '找到匹配邮件' : '暂无匹配邮件',
			// Fix: 只在关键词过滤模式下返回 filterKeywords 和 filterInfo
			// 模板匹配模式(filterMode === 2)下不返回这些字段
			...(shareRecord.filterMode !== 2 && keywords.length > 0 && {
				filterKeywords: keywords,  // 返回实际使用的过滤关键词
				filterInfo: `使用关键词: ${keywords.join(', ')}`  // 过滤信息说明
			}),

		}));

	} catch (error) {
		// 记录失败的访问日志
		try {
			const responseTime = Date.now() - startTime;
			const shareToken = c.req.param('shareToken');
			const { userEmail } = c.req.query();

			// 尝试获取分享信息用于日志记录
			let shareId = null;
			try {
				const shareRecord = await shareService.getByToken(c, shareToken);
				shareId = shareRecord.shareId;
			} catch (e) {
				// 如果无法获取分享信息，使用默认值
			}

			await shareAccessLogService.recordAccess(c, {
				shareId: shareId,
				shareToken: shareToken,
				accessIp: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
				userAgent: c.req.header('user-agent') || '',
				accessEmail: userEmail || 'unknown',
				extractedCodes: extractedCodes,
				accessResult: accessResult,
				errorMessage: errorMessage || error.message,
				responseTime: responseTime,
				emailCount: emailCount
			});
		} catch (logError) {
		}

		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取验证码邮件失败'), 500);
	}
});

// 删除分享
app.delete('/share/:shareId', async (c) => {
	try {
		// 检查用户上下文
		const user = c.get('user');
		if (!user) {
			console.error('ERROR: User context is undefined!');
			return c.json(result.fail('用户未认证'), 401);
		}

		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		await shareService.delete(c, shareId, userId);
		return c.json(result.ok());

	} catch (error) {
		console.error('=== DELETE SHARE API DEBUG END: ERROR ===');


		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('删除分享失败: ' + error.message), 500);
	}
});

// 获取分享访问日志
app.get('/share/logs/:shareId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const shareId = parseInt(c.req.param('shareId'));
		const params = c.req.query();

		// 验证分享是否属于当前用户（允许查询禁用的分享）
		const shareRecord = await orm(c).select().from(share)
			.where(eq(share.shareId, shareId))
			.get();

		if (!shareRecord || shareRecord.userId !== userId) {
			throw new BizError('无权限查看此分享的访问日志', 403);
		}

		const logData = await shareAccessLogService.getAccessLogs(c, {
			shareId: shareId,
			...params
		});

		return c.json(result.ok(logData));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取访问日志失败'), 500);
	}
});

// 获取分享访问统计
app.get('/share/stats/:shareId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const shareId = parseInt(c.req.param('shareId'));
		const { days = 7 } = c.req.query();
		// 验证分享是否属于当前用户（允许查询禁用的分享）
		const shareRecord = await orm(c).select().from(share)
			.where(eq(share.shareId, shareId))
			.get();
		if (shareRecord) {
		}

		if (!shareRecord || shareRecord.userId !== userId) {
			throw new BizError('无权限查看此分享的统计数据', 403);
		}

		console.error('Calling getAccessStats with params:', { shareId, days: parseInt(days) });
		const statsData = await shareAccessLogService.getAccessStats(c, {
			shareId: shareId,
			days: parseInt(days)
		});

		console.error('Stats data retrieved successfully');
		return c.json(result.ok(statsData));

	} catch (error) {
		console.error('=== Get share stats error ===');


		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		// Return detailed error information for debugging
		return c.json(result.fail(`获取访问统计失败: ${error.message}\n\nStack: ${error.stack}`), 500);
	}
});

// 注意：根据业务逻辑，用户不需要输入验证码进行验证
// 用户只需要通过分享链接直接查看邮箱收到的验证码邮件
// 因此移除了验证码生成和验证接口，简化为直接访问模式

// 测试 API 端点
app.get('/share/test', async (c) => {
	console.error('=== Test API called ===');
	return c.json(result.ok({ message: 'Test successful' }));
});

// 获取全局分享统计（所有分享记录的汇总）
app.get('/share/globalStats', async (c) => {
	console.error('=== Global stats API called ===');
	try {
		// 使用统一的认证方式获取userId
		const userId = userContext.getUserId(c);
		const params = c.req.query();

		// 从Hono context中获取用户信息(已经在认证中间件中设置)
		const user = c.get('user');
		const isAdmin = user && (user.email === c.env.admin || user.role === 'admin');

		console.error('=== Get global stats started ===');



		// 获取全局统计数据
		// 管理员可以看到所有用户的访问日志，普通用户只能看到自己的
		const globalStats = await shareAccessLogService.getGlobalStats(c, {
			...params,
			userId,    // 传递userId
			isAdmin    // 传递管理员标志
		});

		console.error('=== Get global stats success ===');
		return c.json(result.ok(globalStats));

	} catch (error) {
		console.error('=== Get global share stats error ===');

		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取全局统计失败'), 500);
	}
});

// 刷新分享Token
app.post('/share/:shareId/refresh-token', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const shareId = parseInt(c.req.param('shareId'));
		const refreshResult = await shareService.refreshToken(c, shareId, userId);
		return c.json(result.ok(refreshResult));

	} catch (error) {

		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('刷新Token失败'), 500);
	}
});

// 批量操作分享
app.post('/share/batch', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const requestBody = await c.req.json();
		console.log('Request body:', JSON.stringify(requestBody));
		
		const { action, shareIds, ...options } = requestBody;

		if (!action || !shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
			throw new BizError('参数错误：需要提供action和shareIds', 400);
		}
		const operationResult = await shareService.batchOperate(c, action, shareIds, userId, options);
		return c.json(result.ok(operationResult));

	} catch (error) {

		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('批量操作失败'), 500);
	}
});



// 更新分享每日限额
app.post('/share/:shareId/update-limit', async (c) => {
	try {
		// 从认证中间件获取用户信息
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}

		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { otpLimitDaily } = await c.req.json();

		if (typeof otpLimitDaily !== 'number' || otpLimitDaily < 0) {
			throw new BizError('参数错误：otpLimitDaily必须是非负整数', 400);
		}

		// 调用service方法
		const updateResult = await shareService.updateLimit(c, shareId, userId, otpLimitDaily);

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新限额失败'), 500);
	}
});

// 更新分享显示限制
app.post('/share/:shareId/update-display-limit', async (c) => {
	try {
		// 从认证中间件获取用户信息
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}

		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { verificationCodeLimit } = await c.req.json();

		if (typeof verificationCodeLimit !== 'number' || verificationCodeLimit < 1 || verificationCodeLimit > 1000) {
			throw new BizError('参数错误：显示限制必须是1-1000之间的整数', 400);
		}

		// 调用service方法
		const updateResult = await shareService.updateDisplayLimit(c, shareId, userId, verificationCodeLimit);

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新显示限制失败'), 500);
	}
});

// 更新分享名称
app.patch('/share/:shareId/name', async (c) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}
		
		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { shareName } = await c.req.json();

		if (!shareName || typeof shareName !== 'string' || shareName.trim().length === 0) {
			throw new BizError('参数错误：shareName不能为空', 400);
		}

		const updateResult = await shareService.updateName(c, shareId, userId, shareName.trim());

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新分享名称失败'), 500);
	}
});

// 更新分享过期时间
app.patch('/share/:shareId/expire', async (c) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}
		
		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { expireTime } = await c.req.json();

		if (!expireTime || typeof expireTime !== 'string') {
			throw new BizError('参数错误：expireTime不能为空', 400);
		}

		const updateResult = await shareService.updateExpireTime(c, shareId, userId, expireTime);

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新过期时间失败'), 500);
	}
});

// 更新分享高级设置
app.patch('/share/:shareId/advanced-settings', async (c) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}

		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const settings = await c.req.json();
		if (!shareId || isNaN(shareId)) {
			throw new BizError('参数错误：shareId不能为空', 400);
		}

		// 验证权限（使用与内联编辑相同的简单权限检查）
		const shareRow = await shareService.getById(c, shareId);
		if (!shareRow) {
			throw new BizError('分享不存在', 404);
		}

		// 简化权限检查：只检查分享所有者
		if (shareRow.userId !== userId) {
			throw new BizError('无权限操作此分享', 403);
		}
		// 更新高级设置
		const updateResult = await shareService.updateAdvancedSettings(c, shareId, settings);

		return c.json(result.ok(updateResult));
	} catch (error) {

		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code);
		}
		return c.json(result.fail('更新高级设置失败'), 500);
	}
});

// 更新分享公告内容
app.patch('/share/:shareId/announcement', async (c) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}

		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { announcementContent } = await c.req.json();

		if (!shareId || isNaN(shareId)) {
			throw new BizError('参数错误：shareId不能为空', 400);
		}

		// 验证公告内容长度
		if (announcementContent !== null && announcementContent !== undefined) {
			if (typeof announcementContent !== 'string') {
				throw new BizError('参数错误：announcementContent必须是字符串或null', 400);
			}
			if (announcementContent.length > 5000) {
				throw new BizError('公告内容不能超过5000字符', 400);
			}
		}

		const updateData = {
			announcementContent,
			announcementVersion: announcementContent ? Date.now() : null // 更新公告时，更新版本号
		};
		const updateResult = await shareService.updateAdvancedSettings(c, shareId, updateData);

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新公告内容失败'), 500);
	}
});

// 更新分享状态
app.patch('/share/:shareId/status', async (c) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json(result.fail('用户未认证'), 401);
		}
		
		const userId = user.userId;
		const shareId = parseInt(c.req.param('shareId'));
		const { status } = await c.req.json();

		if (!status || typeof status !== 'string') {
			throw new BizError('参数错误：status不能为空', 400);
		}

		const updateResult = await shareService.updateStatus(c, shareId, userId, status);

		return c.json(result.ok(updateResult));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新状态失败'), 500);
	}
});

// ============================================
// 邮件模板管理 API
// ============================================

// 获取用户的模板列表
app.get('/email-template/list', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const { page = 1, pageSize = 20 } = c.req.query();
		
		const templates = await emailTemplateService.getUserTemplates(c, userId, parseInt(page), parseInt(pageSize));
		return c.json(result.ok(templates));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取模板列表失败'), 500);
	}
});

// 获取所有可用模板（包括系统预设）
app.get('/email-template/available', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templates = await emailTemplateService.getAvailableTemplates(c, userId);
		return c.json(result.ok(templates));
	} catch (error) {
		return c.json(result.fail('获取可用模板失败'), 500);
	}
});

// 初始化系统预设模板
app.post('/email-template/initialize-presets', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const initResult = await emailTemplateService.initializePresetTemplates(c, userId);
		return c.json(result.ok(initResult));
	} catch (error) {
		return c.json(result.fail('初始化预设模板失败'), 500);
	}
});

// 获取模板详情
app.get('/email-template/:templateId', async (c) => {
	try {
		const templateId = c.req.param('templateId');
		const template = await emailTemplateService.getById(c, templateId);
		
		if (!template) {
			return c.json(result.fail('模板不存在'), 404);
		}
		
		return c.json(result.ok(template));
	} catch (error) {
		return c.json(result.fail('获取模板详情失败'), 500);
	}
});

// 创建新模板
app.post('/email-template/create', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const params = await c.req.json();
		
		// 验证必填字段
		if (!params.name || !params.extractionRegex) {
			throw new BizError('模板名称和提取正则表达式为必填项', 400);
		}
		
		const template = await emailTemplateService.create(c, params, userId);
		return c.json(result.ok(template));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('创建模板失败'), 500);
	}
});

// 更新模板
app.put('/email-template/:templateId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templateId = c.req.param('templateId');
		const params = await c.req.json();
		
		await emailTemplateService.update(c, templateId, params, userId);
		return c.json(result.ok({ success: true }));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新模板失败'), 500);
	}
});

// 删除模板
app.delete('/email-template/:templateId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templateId = c.req.param('templateId');
		
		await emailTemplateService.delete(c, templateId, userId);
		return c.json(result.ok({ success: true }));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('删除模板失败'), 500);
	}
});

// 测试模板
app.post('/email-template/:templateId/test', async (c) => {
	try {
		const templateId = c.req.param('templateId');
		const { testEmail } = await c.req.json();

		if (!testEmail || !testEmail.subject || !testEmail.body) {
			throw new BizError('测试邮件内容不完整', 400);
		}

		const testResult = await emailTemplateService.testTemplate(c, templateId, testEmail);
		return c.json(result.ok(testResult));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('测试模板失败'), 500);
	}
});

// 切换模板启用状态
app.post('/email-template/:templateId/toggle-active', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templateId = c.req.param('templateId');

		const toggleResult = await emailTemplateService.toggleActive(c, templateId, userId);
		return c.json(result.ok(toggleResult));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('切换模板状态失败'), 500);
	}
});

// 批量更新模板启用状态
app.post('/email-template/batch-update-active', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const { templateIds, isActive } = await c.req.json();

		if (!Array.isArray(templateIds) || templateIds.length === 0) {
			throw new BizError('模板ID列表不能为空', 400);
		}
		if (typeof isActive !== 'boolean') {
			throw new BizError('isActive参数必须为布尔值', 400);
		}

		const batchResult = await emailTemplateService.batchUpdateActive(c, templateIds, isActive, userId);
		return c.json(result.ok(batchResult));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('批量更新模板状态失败'), 500);
	}
});

// 获取访问详情（验证码和邮件列表）
app.get('/share/access-detail/:logId', async (c) => {
	try {
		// 使用统一的认证方式获取userId
		const userId = userContext.getUserId(c);
		const logId = parseInt(c.req.param('logId'));

		if (isNaN(logId)) {
			throw new BizError('无效的访问日志ID', 400);
		}

		const accessLog = await orm(c).select().from(shareAccessLog)
			.where(eq(shareAccessLog.logId, logId))
			.get();

		if (!accessLog) {
			throw new BizError('访问日志不存在', 404);
		}

		const shareRecord = await orm(c).select().from(share)
			.where(eq(share.shareId, accessLog.shareId))
			.get();

		if (!shareRecord || shareRecord.userId !== userId) {
			throw new BizError('无权限查看此访问日志详情', 403);
		}

		// 复用分享访问API中完全相同的邮件过滤逻辑
		let emails = [];

		// 获取目标邮箱的账户信息
		const targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);
		if (targetAccount) {
			// 获取该邮箱的最新邮件（与分享访问API相同）
			const allEmails = await emailService.latest(c, {
				emailId: 0,
				accountId: targetAccount.accountId
			}, targetAccount.userId);

			let filteredEmails = [];
			let keywords = [];

			// 根据过滤模式处理邮件（完全复用分享访问API的逻辑）
			if (shareRecord.filterMode === 2 && shareRecord.templateId) {
				// 模板匹配模式
				const template = await emailTemplateService.getById(c, shareRecord.templateId);
				if (template) {
					filteredEmails = allEmails.map((email) => {
						const emailContent = {
							subject: email.subject || '',
							from: email.sendEmail || '',
							body: (email.text || '') + ' ' + (email.content || '')
						};

						const extractionResult = emailTemplateService.extractVerificationCode(emailContent, template);

						if (extractionResult.success) {
							return {
								emailId: email.emailId,
								subject: email.subject,
								sendEmail: email.sendEmail,
								text: email.text,
								content: shareRecord.showFullEmail ? email.content : null,
								createTime: email.createTime,
								extractedCode: extractionResult.verificationCode,
								isVerificationEmail: true,
								templateMatched: true,
								extractionReason: 'template_match'
							};
						}
						return null;
					}).filter(email => email !== null);
				}
			} else {
				// 关键词过滤模式（与分享访问API完全相同的逻辑）
				const userKeywords = shareRecord.keywordFilter || '验证码|verification|code|otp';
				keywords = userKeywords.split('|').map(k => k.trim().toLowerCase()).filter(k => k);

				// 增强的验证码检测正则表达式（与分享访问API相同）
				const verificationCodePatterns = [
					/\b[A-Z0-9]{6}\b/g,
					/\b[A-Z0-9]{5}\b/g,
					/\b[A-Z0-9]{4}\b/g,
					/\b\d{6}\b/g,
					/\b\d{5}\b/g,
					/\b\d{4}\b/g,
					/verification.*?code.*?([A-Z0-9]{4,6})/gi,
					/验证码.*?([A-Z0-9]{4,6})/gi,
					/code.*?([A-Z0-9]{4,6})/gi
				];

				// 使用用户配置的关键词过滤邮件
				filteredEmails = allEmails.filter(email => {
					const content = (email.subject + ' ' + email.text + ' ' + email.content).toLowerCase();
					return keywords.some(keyword => content.includes(keyword));
				}).map(email => {
					// 智能提取验证码（与分享访问API相同的逻辑）
					const fullContent = email.subject + ' ' + email.text + ' ' + email.content;
					let extractedCode = '';

					// 优先从HTML内容中查找验证码
					const htmlContent = email.content || '';
					const htmlCodeMatch = htmlContent.match(/<td[^>]*>([A-Z0-9]{4,6})<\/td>/gi) ||
										  htmlContent.match(/>([A-Z0-9]{4,6})</gi);

					if (htmlCodeMatch && htmlCodeMatch.length > 0) {
						const codeMatch = htmlCodeMatch[0].match(/([A-Z0-9]{4,6})/);
						if (codeMatch) {
							extractedCode = codeMatch[1];
						}
					} else {
						// 回退到正则表达式匹配
						for (const pattern of verificationCodePatterns) {
							const matches = fullContent.match(pattern);
							if (matches && matches.length > 0) {
								extractedCode = matches[0];
								break;
							}
						}
					}

					return {
						emailId: email.emailId,
						subject: email.subject,
						sendEmail: email.sendEmail,
						text: email.text,
						content: email.content,
						createTime: email.createTime,
						extractedCode: extractedCode,
						isVerificationEmail: true,
						templateMatched: false,
						extractionReason: 'keyword_match'
					};
				});
			}

			// 应用显示数量限制（与分享访问API完全相同的逻辑）
			if (shareRecord.latestEmailCount !== null && shareRecord.latestEmailCount !== undefined) {
				emails = filteredEmails.slice(0, shareRecord.latestEmailCount);
			} else if (shareRecord.verificationCodeLimitEnabled === 1) {
				emails = filteredEmails.slice(0, shareRecord.verificationCodeLimit || 100);
			} else {
				emails = filteredEmails;
			}
		}

		const detailData = {
			accessLog: {
				logId: accessLog.logId,
				shareId: accessLog.shareId,
				accessTime: accessLog.accessTime,
				accessIp: accessLog.accessIp,
				accessEmail: accessLog.accessEmail,
				accessResult: accessLog.accessResult,
				emailCount: accessLog.emailCount,
				responseTime: accessLog.responseTime
				// 删除 extractedCodes 字段
			},
			emails: emails // 返回实际的邮件详情而不是验证码
		};

		return c.json(result.ok(detailData));

	} catch (error) {
		const errorMessage = error instanceof BizError ? error.message : '获取访问详情失败';
		const errorCode = error instanceof BizError ? (error.code || 400) : 500;
		return c.json(result.fail(errorMessage), errorCode);
	}
});

// 验证人机验证码
app.post('/share/verify-captcha', async (c) => {
	try {
		const { token, shareToken } = await c.req.json();

		if (!token || !shareToken) {
			throw new BizError('验证码token和分享token不能为空', 400);
		}

		// 获取客户端IP
		const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

		// 验证Turnstile token并将IP加入白名单
		await shareCaptchaService.verifyCaptchaToken(c, token, clientIp, shareToken);

		return c.json(result.ok({ success: true, message: '人机验证成功' }));

	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('人机验证失败'), 500);
	}
});