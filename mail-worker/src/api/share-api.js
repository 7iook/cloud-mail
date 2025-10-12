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
import BizError from '../error/biz-error';
import dayjs from 'dayjs';
import { shareRateLimitMiddleware } from '../middleware/rate-limiter';

// 创建邮箱验证码分享
app.post('/share/create', async (c) => {
	try {
		const { targetEmail, shareName, keywordFilter, expireTime, rateLimitPerSecond, rateLimitPerMinute, shareType } = await c.req.json();
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

		// 验证邮箱域名是否在允许的域名列表中
		if (!c.env.domain.includes(emailUtils.getDomain(targetEmail))) {
			throw new BizError('该邮箱域名不在系统支持的域名列表中', 403);
		}

		// 检查当前用户是否为管理员
		const currentUser = await userService.selectById(c, userId);
		const isAdmin = currentUser && (currentUser.email === c.env.admin || currentUser.role === 'admin');

		// 验证邮箱是否存在于系统中，如果不存在则按需创建（仅管理员可以）
		let existingAccount = await accountService.selectByEmailIncludeDel(c, targetEmail);
		if (!existingAccount) {
			if (!isAdmin) {
				throw new BizError('该邮箱不存在于系统中，只有管理员可以为新邮箱创建分享', 403);
			}

			// 管理员可以为白名单中的邮箱按需创建账户
			try {
				existingAccount = await accountService.add(c, { email: targetEmail }, userId);
				console.log(`管理员为邮箱 ${targetEmail} 自动创建了账户记录`);
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
		}

		// 创建分享记录到数据库
		const shareData = {
			targetEmail: targetEmail,
			shareName: shareName || `${targetEmail}的验证码接收`,
			keywordFilter: keywordFilter || '验证码|verification|code|otp',
			expireTime: expireTime || dayjs().add(7, 'day').toISOString(),
			rateLimitPerSecond: rateLimitPerSecond || 5,
			rateLimitPerMinute: rateLimitPerMinute || 60,
			shareType: shareType || 1 // 默认为类型1（单邮箱分享）
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
			// 类型2：白名单验证分享
			if (!userEmail) {
				errorMessage = '请输入邮箱地址进行验证';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}

			// 获取邮箱白名单配置
			const { shareWhitelist } = await settingService.query(c);
			const whitelistEmails = shareWhitelist ? shareWhitelist.split(',').filter(email => email.trim()) : [];

			// 验证邮箱是否在白名单中
			const isInWhitelist = whitelistEmails.some(whiteEmail =>
				whiteEmail.trim().toLowerCase() === userEmail.toLowerCase()
			);

			if (!isInWhitelist) {
				errorMessage = '该邮箱不在访问白名单中';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 403);
			}

			// 白名单验证通过，使用输入的邮箱作为目标邮箱
			shareRecord.targetEmail = userEmail;
		} else {
			// 类型1：单邮箱分享（原有逻辑）
			if (userEmail && userEmail.toLowerCase() !== shareRecord.targetEmail.toLowerCase()) {
				errorMessage = '输入的邮箱与分享邮箱不匹配';
				accessResult = 'rejected';
				throw new BizError(errorMessage, 400);
			}
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

		// 获取该邮箱的账户信息，如果不存在则按需创建
		let targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);
		if (!targetAccount) {
			// 如果邮箱账户不存在，使用分享创建者的userId自动创建
			try {
				targetAccount = await accountService.add(c, { email: shareRecord.targetEmail }, shareRecord.userId);
				console.log(`为分享访问自动创建邮箱账户: ${shareRecord.targetEmail}`);
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

