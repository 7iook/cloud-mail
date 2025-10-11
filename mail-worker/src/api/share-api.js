import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
import shareService from '../service/share-service';
import shareAccessLogService from '../service/share-access-log-service';
import BizError from '../error/biz-error';
import dayjs from 'dayjs';
import { shareRateLimitMiddleware } from '../middleware/rate-limiter';

// 创建邮箱验证码分享
app.post('/share/create', async (c) => {
	try {
		const { targetEmail, shareName, keywordFilter, expireTime, rateLimitPerSecond, rateLimitPerMinute } = await c.req.json();
		const userId = userContext.getUserId(c);

		// 验证目标邮箱格式
		if (!targetEmail || !targetEmail.includes('@')) {
			throw new BizError('请输入有效的邮箱地址', 400);
		}

		// 获取邮箱白名单配置
		const { shareWhitelist } = await settingService.query(c);
		const whitelistEmails = shareWhitelist ? shareWhitelist.split(',').filter(email => email.trim()) : [];

		// 验证邮箱是否在白名单中
		if (whitelistEmails.length > 0) {
			const isInWhitelist = whitelistEmails.some(whiteEmail =>
				whiteEmail.trim().toLowerCase() === targetEmail.toLowerCase()
			);
			if (!isInWhitelist) {
				throw new BizError('该邮箱不在可分享的邮箱白名单中', 403);
			}
		}

		// 验证邮箱是否存在于系统中
		const existingAccount = await accountService.selectByEmailIncludeDel(c, targetEmail);
		if (!existingAccount) {
			throw new BizError('指定的邮箱不存在于系统中', 404);
		}

		// 验证用户是否有权限分享此邮箱
		// 对于邮箱验证码接码服务，管理员可以分享系统中的任何邮箱
		// 检查当前用户是否为管理员或邮箱所有者
		const currentUser = await accountService.selectById(c, userId);
		const isAdmin = currentUser && (currentUser.email === 'admin@example.com' || currentUser.role === 'admin');
		const isOwner = existingAccount.userId === userId;

		if (!isAdmin && !isOwner) {
			throw new BizError('您没有权限分享此邮箱', 403);
		}

		// 创建分享记录到数据库
		const shareData = {
			targetEmail: targetEmail,
			shareName: shareName || `${targetEmail}的验证码接收`,
			keywordFilter: keywordFilter || '验证码|verification|code|otp',
			expireTime: expireTime || dayjs().add(7, 'day').toISOString(),
			rateLimitPerSecond: rateLimitPerSecond || 5,
			rateLimitPerMinute: rateLimitPerMinute || 60
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
		const { page = 1, pageSize = 20 } = c.req.query();

		const shares = await shareService.getUserShares(c, userId, parseInt(page), parseInt(pageSize));
		const total = await shareService.getUserShareCount(c, userId);

		return c.json(result.ok({
			list: shares,
			total: total,
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
			expireTime: shareRecord.expireTime
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

		// 验证用户输入的邮箱是否与分享的邮箱匹配
		if (userEmail && userEmail.toLowerCase() !== shareRecord.targetEmail.toLowerCase()) {
			errorMessage = '输入的邮箱与分享邮箱不匹配';
			accessResult = 'rejected';
			throw new BizError(errorMessage, 400);
		}

		// 再次验证邮箱白名单（防止绕过）
		const { shareWhitelist } = await settingService.query(c);
		const whitelistEmails = shareWhitelist ? shareWhitelist.split(',').filter(email => email.trim()) : [];

		if (whitelistEmails.length > 0) {
			const isInWhitelist = whitelistEmails.some(whiteEmail =>
				whiteEmail.trim().toLowerCase() === shareRecord.targetEmail.toLowerCase()
			);
			if (!isInWhitelist) {
				errorMessage = '该邮箱不在可分享的邮箱白名单中';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 403);
			}
		}

		// 获取该邮箱的账户信息
		const targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);
		if (!targetAccount) {
			errorMessage = '目标邮箱不存在';
			accessResult = 'failed';
			throw new BizError(errorMessage, 404);
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

		// 限制最新3封过滤后的邮件
		const latestFilteredEmails = filteredEmails.slice(0, 3);
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

		// 验证分享是否属于当前用户
		const shareRecord = await shareService.getById(c, shareId);
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

		// 验证分享是否属于当前用户
		const shareRecord = await shareService.getById(c, shareId);
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