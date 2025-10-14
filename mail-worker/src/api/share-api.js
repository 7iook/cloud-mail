import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';
import userService from '../service/user-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
import shareService from '../service/share-service';
import shareAccessLogService from '../service/share-access-log-service';
import emailUtils from '../utils/email-utils';
import verifyUtils from '../utils/verify-utils'; // Fix P0-1: 添加邮箱验证工具
import sanitizeUtils from '../utils/sanitize-utils'; // Fix P0-5: 添加输入清理工具
import BizError from '../error/biz-error';
import dayjs from 'dayjs';
import { shareRateLimitMiddleware } from '../middleware/rate-limiter';
import { share } from '../entity/share';
import { account } from '../entity/account';
import orm from '../entity/orm';
import { eq } from 'drizzle-orm';

// 创建邮箱验证码分享
app.post('/share/create', async (c) => {
	try {
		const { targetEmail, authorizedEmails, shareName, shareDomain, keywordFilter, expireTime, rateLimitPerSecond, rateLimitPerMinute, shareType, verificationCodeLimit, verificationCodeLimitEnabled, otpLimitDaily, otpLimitEnabled } = await c.req.json();
		const userId = userContext.getUserId(c);

	// 调试日志：打印接收到的域名参数
	console.log('=== 后端接收分享创建请求 ===');
	console.log('接收到的shareDomain:', shareDomain);
	console.log('请求体:', { targetEmail, shareName, shareDomain, shareType });

		// Fix P0-5: 清理用户输入，防止 XSS 攻击
		const cleanedTargetEmail = sanitizeUtils.sanitizeEmail(targetEmail);
		const cleanedShareName = sanitizeUtils.sanitizeInput(shareName, 200);
		const cleanedKeywordFilter = sanitizeUtils.sanitizeInput(keywordFilter, 500);

		// Fix P0-1: 使用标准邮箱验证替代简陋的 includes('@') 检查
		if (!cleanedTargetEmail || !verifyUtils.isEmail(cleanedTargetEmail)) {
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

		// Fix P1-2: 数值范围验证
		const MIN_RATE_LIMIT = 1;
		const MAX_RATE_LIMIT_PER_SECOND = 100;
		const MAX_RATE_LIMIT_PER_MINUTE = 1000;

		if (rateLimitPerSecond !== undefined) {
			const rate = parseInt(rateLimitPerSecond);
			if (isNaN(rate) || rate < MIN_RATE_LIMIT || rate > MAX_RATE_LIMIT_PER_SECOND) {
				throw new BizError(`每秒频率限制必须在 ${MIN_RATE_LIMIT}-${MAX_RATE_LIMIT_PER_SECOND} 之间`, 400);
			}
		}

		if (rateLimitPerMinute !== undefined) {
			const rate = parseInt(rateLimitPerMinute);
			if (isNaN(rate) || rate < MIN_RATE_LIMIT || rate > MAX_RATE_LIMIT_PER_MINUTE) {
				throw new BizError(`每分钟频率限制必须在 ${MIN_RATE_LIMIT}-${MAX_RATE_LIMIT_PER_MINUTE} 之间`, 400);
			}
		}

		// Fix P1-3: expireTime 验证
		const MIN_EXPIRE_HOURS = 1;
		const MAX_EXPIRE_DAYS = 365;

		if (expireTime) {
			const expireDate = dayjs(expireTime);
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

		if (shareType !== undefined && !VALID_SHARE_TYPES.includes(shareType)) {
			throw new BizError('无效的分享类型，必须为 1 或 2', 400);
		}

		// Fix P1-4: 确保 Type 2 分享必须提供 authorizedEmails
		if (shareType === 2 && (!authorizedEmails || authorizedEmails.length === 0)) {
			throw new BizError('Type 2 分享必须提供至少一个授权邮箱', 400);
		}

		// 对于 Type 2 分享，验证 authorizedEmails
		if (shareType === 2 && authorizedEmails) {
			if (!Array.isArray(authorizedEmails)) {
				throw new BizError('授权邮箱列表必须是数组格式', 400);
			}

			// Fix P1-1: 限制授权邮箱数量
			if (authorizedEmails.length > MAX_AUTHORIZED_EMAILS) {
				throw new BizError(`授权邮箱数量不能超过 ${MAX_AUTHORIZED_EMAILS} 个`, 400);
			}

			// Fix P0-1: 使用标准邮箱验证
			for (const email of authorizedEmails) {
				if (!email || !verifyUtils.isEmail(email)) {
					throw new BizError(`无效的邮箱地址: ${email}`, 400);
				}
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

		// 验证邮箱是否存在于系统中，如果不存在则按需创建（仅管理员可以）
		let existingAccount = await accountService.selectByEmailIncludeDel(c, cleanedTargetEmail);
		if (!existingAccount) {
			if (!isAdmin) {
				throw new BizError('该邮箱不存在于系统中，只有管理员可以为新邮箱创建分享', 403);
			}

			// Fix: 管理员可以为任何域名的邮箱创建账户，绕过域名限制
			try {
				// 直接插入账户记录，绕过 accountService.add 的域名验证
				const accountData = {
					email: cleanedTargetEmail,
					userId: userId,
					name: cleanedTargetEmail.split('@')[0] // 使用邮箱前缀作为名称
				};

				existingAccount = await orm(c).insert(account).values(accountData).returning().get();
				console.log(`管理员为邮箱 ${cleanedTargetEmail} 自动创建了账户记录`);
			} catch (error) {
				console.error('自动创建邮箱账户失败:', error);
				throw new BizError('创建邮箱账户失败: ' + error.message, 500);
			}
		}

		// 验证用户是否有权限分享此邮箱
		// 管理员可以分享任何邮箱，普通用户只能分享自己的邮箱
		if (!isAdmin) {
			const isOwner = existingAccount.userId === userId;
			if (!isOwner) {
				throw new BizError('您没有权限分享此邮箱', 403);
			}
		} else {
			// 管理员权限：可以分享任何邮箱，包括系统中的其他邮箱
			console.log(`管理员 ${currentUser.email} 为邮箱 ${cleanedTargetEmail} 创建分享`);
		}

		// Fix P0-5: 使用清理后的输入创建分享记录
		// 创建分享记录到数据库
		const shareData = {
			targetEmail: cleanedTargetEmail,
			shareName: cleanedShareName || `${cleanedTargetEmail}的验证码接收`,
			shareDomain: shareDomain, // 用户指定的域名
			keywordFilter: cleanedKeywordFilter || '验证码|verification|code|otp',
			expireTime: expireTime || dayjs().add(7, 'day').toISOString(),
			rateLimitPerSecond: rateLimitPerSecond || 5,
			rateLimitPerMinute: rateLimitPerMinute || 60,
			shareType: shareType || 1, // 默认为类型1（单邮箱分享）
			authorizedEmails: authorizedEmails, // 直接传递数组，由 service 层处理 JSON 转换
			// 显示数量限制
			verificationCodeLimit: verificationCodeLimit !== undefined ? verificationCodeLimit : 100,
			verificationCodeLimitEnabled: verificationCodeLimitEnabled !== undefined ? (verificationCodeLimitEnabled ? 1 : 0) : 1,
			// 访问次数限制
			otpLimitDaily: otpLimitDaily !== undefined ? otpLimitDaily : 100,
			otpLimitEnabled: otpLimitEnabled !== undefined ? (otpLimitEnabled ? 1 : 0) : 1
		};

		const shareRecord = await shareService.create(c, shareData, userId);

		return c.json(result.ok(shareRecord));

	} catch (error) {
		console.error('Create share error:', error);
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
		const { page = 1, pageSize = 20, status } = c.req.query();

		const shares = await shareService.getUserShares(c, userId, parseInt(page), parseInt(pageSize), status);
		const total = await shareService.getUserShareCount(c, userId, status);

		// 返回各状态的统计数据（用于前端标签显示）
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
			pageSize: parseInt(pageSize)
		}));

	} catch (error) {
		console.error('Get share list error:', error);
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
			shareType: shareRecord.shareType || 1
		}));

	} catch (error) {
		console.error('Share access error:', error);
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

		// 根据分享类型进行不同的验证
		if (shareRecord.shareType === 2) {
			// 类型2：多邮箱验证分享
			if (!userEmail) {
				errorMessage = '请输入邮箱地址进行验证';
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
				console.error('解析授权邮箱列表失败:', error);
				errorMessage = '分享配置错误，请联系管理员';
				accessResult = 'failed';
				
				// 记录访问日志
				await shareAccessLogService.create(c, {
					shareId: shareRecord.shareId,
					accessIp: clientIp,
					accessEmail: userEmail || '',
					accessResult: accessResult,
					errorMessage: errorMessage,
					extractedCodes: '[]'
				});
				
				throw new BizError(errorMessage, 500);
			}

			// 验证邮箱是否在该分享的授权列表中
			const isAuthorized = authorizedEmails.some(authorizedEmail =>
				authorizedEmail.trim().toLowerCase() === userEmail.toLowerCase()
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
			if (userEmail && userEmail.toLowerCase() !== shareRecord.targetEmail.toLowerCase()) {
				errorMessage = '输入的邮箱与分享邮箱不匹配';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}
		}

		// Fix P0-6: 根据分享类型确定有效的目标邮箱
		const effectiveTargetEmail = shareRecord.shareType === 2 ? userEmail : shareRecord.targetEmail;

		// 验证邮箱域名是否在系统支持的域名列表中
		if (!c.env.domain.includes(emailUtils.getDomain(effectiveTargetEmail))) {
			errorMessage = '该邮箱域名不在系统支持的域名列表中';
			accessResult = 'rejected';
			throw new BizError(errorMessage, 403);
		}

		// Fix P0-6: 使用 effectiveTargetEmail 而非 shareRecord.targetEmail
		// 获取该邮箱的账户信息，如果不存在则按需创建
		let targetAccount = await accountService.selectByEmailIncludeDel(c, effectiveTargetEmail);
		if (!targetAccount) {
			// 如果邮箱账户不存在，使用分享创建者的userId自动创建
			try {
				targetAccount = await accountService.add(c, { email: effectiveTargetEmail }, shareRecord.userId);
				console.log(`为分享访问自动创建邮箱账户: ${effectiveTargetEmail}`);
			} catch (error) {
				console.error('访问分享时自动创建邮箱账户失败:', error);
				errorMessage = '邮箱账户创建失败';
				accessResult = 'failed';
				throw new BizError(errorMessage, 500);
			}
		}

		// 获取该邮箱的最新邮件
		let emails = await emailService.latest(c, {
			emailId: 0,
			accountId: targetAccount.accountId
		}, shareRecord.userId);

		// 使用用户配置的关键词过滤器
		const userKeywords = shareRecord.keywordFilter || '验证码|verification|code|otp';
		const keywords = userKeywords.split('|').map(k => k.trim().toLowerCase()).filter(k => k);

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
		const filteredEmails = emails.filter(email => {
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
				isVerificationEmail: true
			};
		});

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

		// 应用显示数量限制（如果启用）
		let latestFilteredEmails;
		if (shareRecord.verificationCodeLimitEnabled === 1) {
			latestFilteredEmails = filteredEmails.slice(0, shareRecord.verificationCodeLimit || 100);
		} else {
			latestFilteredEmails = filteredEmails; // 禁用时显示全部
		}

		emailCount = latestFilteredEmails.length;
		accessResult = 'success';

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
			emailCount: emailCount
		});

		return c.json(result.ok({
			emails: latestFilteredEmails,
			total: latestFilteredEmails.length,
			targetEmail: shareRecord.targetEmail,
			message: latestFilteredEmails.length > 0 ? '找到匹配邮件' : '暂无匹配邮件',
			filterKeywords: keywords,  // 返回实际使用的过滤关键词
			filterInfo: `使用关键词: ${keywords.join(', ')}`  // 过滤信息说明
		}));

	} catch (error) {
		console.error('Get verification emails error:', error);

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
			console.error('Failed to record access log:', logError);
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
		const userId = userContext.getUserId(c);
		const shareId = parseInt(c.req.param('shareId'));

		await shareService.delete(c, shareId, userId);

		return c.json(result.ok());

	} catch (error) {
		console.error('Delete share error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('删除分享失败'), 500);
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
		console.error('Get share logs error:', error);
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

		if (!shareRecord || shareRecord.userId !== userId) {
			throw new BizError('无权限查看此分享的统计数据', 403);
		}

		const statsData = await shareAccessLogService.getAccessStats(c, {
			shareId: shareId,
			days: parseInt(days)
		});

		return c.json(result.ok(statsData));

	} catch (error) {
		console.error('Get share stats error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取访问统计失败'), 500);
	}
});

// 注意：根据业务逻辑，用户不需要输入验证码进行验证
// 用户只需要通过分享链接直接查看邮箱收到的验证码邮件
// 因此移除了验证码生成和验证接口，简化为直接访问模式

// 刷新分享Token
app.post('/share/:shareId/refresh-token', async (c) => {
	try {
		console.log('=== Refresh token started ===');
		const userId = userContext.getUserId(c);
		const shareId = parseInt(c.req.param('shareId'));
		console.log('User ID:', userId, 'Share ID:', shareId);

		const refreshResult = await shareService.refreshToken(c, shareId, userId);
		console.log('Refresh result:', refreshResult);

		return c.json(result.ok(refreshResult));

	} catch (error) {
		console.error('Refresh share token error:', error);
		console.error('Error stack:', error.stack);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('刷新Token失败'), 500);
	}
});

// 批量操作分享
app.post('/share/batch', async (c) => {
	try {
		console.log('=== Batch operation started ===');
		const userId = userContext.getUserId(c);
		console.log('User ID:', userId);
		
		const requestBody = await c.req.json();
		console.log('Request body:', JSON.stringify(requestBody));
		
		const { action, shareIds, ...options } = requestBody;

		if (!action || !shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
			throw new BizError('参数错误：需要提供action和shareIds', 400);
		}

		console.log('Calling batchOperate with:', { action, shareIds, userId, options });
		const operationResult = await shareService.batchOperate(c, action, shareIds, userId, options);
		console.log('Operation result:', operationResult);

		return c.json(result.ok(operationResult));

	} catch (error) {
		console.error('Batch operate shares error:', error);
		console.error('Error stack:', error.stack);
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
		console.error('Update share limit error:', error);
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
		console.error('Update share display limit error:', error);
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
		console.error('Update share name error:', error);
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
		console.error('Update share expire time error:', error);
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

		// 验证权限
		const share = await shareService.selectById(c, shareId);
		if (!share) {
			throw new BizError('分享不存在', 404);
		}

		// 检查权限（只有创建者或管理员可以修改）
		const currentUser = await userService.selectById(c, userId);
		const isAdmin = currentUser && (currentUser.email === c.env.admin || currentUser.role === 'admin');
		const isOwner = share.userId === userId;

		if (!isAdmin && !isOwner) {
			throw new BizError('您没有权限修改此分享', 403);
		}

		// 更新高级设置
		await shareService.updateAdvancedSettings(c, shareId, settings);

		return c.json(result.success('高级设置更新成功'));
	} catch (error) {
		console.error('更新高级设置失败:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code);
		}
		return c.json(result.fail('更新高级设置失败'), 500);
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
		console.error('Update share status error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('更新状态失败'), 500);
	}
});

