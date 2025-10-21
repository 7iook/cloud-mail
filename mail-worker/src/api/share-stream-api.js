/**
 * Share Stream API - Server-Sent Events (SSE) for Real-time Push
 * 分享实时推送 API - 使用 SSE 替代轮询
 */

import app from '../hono/hono';
import shareService from '../service/share-service';
import accountService from '../service/account-service';
import emailService from '../service/email-service';
import settingService from '../service/setting-service';
import BizError from '../error/biz-error';
import { shareRateLimitMiddleware } from '../middleware/rate-limiter';
import { isDel } from '../const/entity-const';
import sanitizeUtils from '../utils/sanitize-utils';
import verifyUtils from '../utils/verify-utils'; // Fix P1-38: 添加邮箱验证工具

// SSE 实时推送端点
app.get('/share/stream/:shareToken', shareRateLimitMiddleware, async (c) => {
	try {
		const shareToken = c.req.param('shareToken');
		const { userEmail } = c.req.query();

		// 验证分享链接
		const shareRecord = await shareService.getByToken(c, shareToken);

		// Fix P1-21: 验证shareRecord的shareType是否有效
		const VALID_SHARE_TYPES = [1, 2];
		if (!VALID_SHARE_TYPES.includes(shareRecord.shareType)) {
			throw new BizError('分享配置错误：无效的分享类型', 500);
		}

		// 根据分享类型进行不同的验证
		if (shareRecord.shareType === 2) {
			// 类型2：多邮箱验证分享
			// Fix P1-27: 严格检查userEmail，防止空字符串或只有空格的字符串
			if (!userEmail || !userEmail.trim()) {
				throw new BizError('请输入邮箱地址进行验证', 400);
			}

			// Fix P1-17: 验证邮箱格式
			if (!verifyUtils.isEmail(userEmail)) {
				throw new BizError('请输入有效的邮箱地址', 400);
			}

			// Fix P1-42: 验证邮箱长度
			const MAX_EMAIL_LENGTH = 254; // RFC standard
			if (userEmail.length > MAX_EMAIL_LENGTH) {
				throw new BizError(`邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`, 400);
			}

			// 获取该分享的授权邮箱列表
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
				throw new BizError('分享配置错误，请联系管理员', 500);
			}

			// Fix P1-11: 使用 sanitizeUtils 规范化邮箱进行比较，确保一致性
			const normalizedUserEmail = sanitizeUtils.sanitizeEmail(userEmail);
			const isAuthorized = authorizedEmails.some(authorizedEmail =>
				sanitizeUtils.sanitizeEmail(authorizedEmail) === normalizedUserEmail
			);

			if (!isAuthorized) {
				throw new BizError('该邮箱不在此分享的授权列表中', 403);
			}

			// 验证通过，使用输入的邮箱作为目标邮箱
			// Fix P1-12: 对 userEmail 进行规范化处理，确保与数据库中的邮箱格式一致
			shareRecord.targetEmail = sanitizeUtils.sanitizeEmail(userEmail);
		} else {
			// 类型1：单邮箱分享（原有逻辑）
			// Fix P1-13: 使用 sanitizeUtils 规范化邮箱进行比较，确保一致性
			// Fix P1-22: 严格检查userEmail，防止空字符串或只有空格的字符串
			if (userEmail && userEmail.trim()) {
				// Fix P1-18: 验证邮箱格式
				if (!verifyUtils.isEmail(userEmail)) {
					throw new BizError('请输入有效的邮箱地址', 400);
				}

				// Fix P1-45: 验证邮箱长度（Type 1）
				const MAX_EMAIL_LENGTH = 254; // RFC standard
				if (userEmail.length > MAX_EMAIL_LENGTH) {
					throw new BizError(`邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`, 400);
				}

				const normalizedUserEmail = sanitizeUtils.sanitizeEmail(userEmail);
				if (normalizedUserEmail !== shareRecord.targetEmail.toLowerCase()) {
					throw new BizError('输入的邮箱与分享邮箱不匹配', 400);
				}
			}
		}

		// Fix P1-20: 验证数据库中的targetEmail是否有效
		if (!verifyUtils.isEmail(shareRecord.targetEmail)) {
			throw new BizError('分享配置错误：邮箱地址无效', 500);
		}

		// 获取目标账户
		let targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);

		// Fix P1-5: 对于 Type 2 分享，邮箱必须已经存在（在创建分享时已创建）
		if (!targetAccount) {
			if (shareRecord.shareType === 2) {
				// Type 2 分享的邮箱应该在创建分享时已经创建，不应该自动创建
				throw new BizError('邮箱账户不存在，请联系管理员', 500);
			}

			// Type 1 分享：如果邮箱账户不存在，使用分享创建者的userId自动创建
			try {
				targetAccount = await accountService.add(c, { email: shareRecord.targetEmail }, shareRecord.userId);
				console.log(`为SSE流访问自动创建邮箱账户: ${shareRecord.targetEmail}`);
			} catch (error) {
				console.error('SSE流访问时自动创建邮箱账户失败:', error);
				throw new BizError('邮箱账户创建失败', 500);
			}
		}

		// Fix P1-6: 检查账户是否被删除
		if (targetAccount && targetAccount.isDel === isDel.DELETE) {
			throw new BizError('邮箱账户已被删除，无法访问', 403);
		}

		// 获取自动刷新配置
		const { autoRefreshTime } = await settingService.query(c);
		const refreshInterval = (autoRefreshTime || 30) * 1000; // 转换为毫秒

		// 创建 SSE 流
		let lastEmailId = 0;
		let intervalId;

		const stream = new ReadableStream({
			async start(controller) {
				// 发送初始连接消息
				const encoder = new TextEncoder();
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({
					type: 'connected',
					message: '连接成功',
					refreshInterval: refreshInterval / 1000
				})}\n\n`));

				// 定期检查新邮件
				intervalId = setInterval(async () => {
					try {
						// 获取最新邮件
						const emails = await emailService.latest(c, {
							emailId: lastEmailId,
							accountId: targetAccount.accountId
						}, shareRecord.userId);

						// 过滤验证码邮件
						const verificationCodePatterns = [
							/\b\d{6}\b/g,
							/\b\d{4}\b/g,
							/\b\d{5}\b/g,
							/verification.*?code.*?(\d{4,6})/gi,
							/验证码.*?(\d{4,6})/gi,
							/code.*?(\d{4,6})/gi
						];

						const verificationEmails = emails.filter(email => {
							const content = (email.subject + ' ' + email.text + ' ' + email.content).toLowerCase();
							return verificationCodePatterns.some(pattern => pattern.test(content)) ||
								   content.includes('验证码') || content.includes('verification') ||
								   content.includes('code') || content.includes('otp');
						}).map(email => {
							// 提取验证码
							const fullContent = email.subject + ' ' + email.text + ' ' + email.content;
							let extractedCode = '';

							for (const pattern of verificationCodePatterns) {
								const matches = fullContent.match(pattern);
								if (matches && matches.length > 0) {
									extractedCode = matches[0];
									break;
								}
							}

							return {
								...email,
								extractedCode: extractedCode || '未识别'
							};
						});

						// 如果有新邮件，推送更新
						if (verificationEmails.length > 0) {
							lastEmailId = Math.max(...verificationEmails.map(e => e.emailId));
							
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({
								type: 'new_emails',
								emails: verificationEmails,
								count: verificationEmails.length
							})}\n\n`));
						}

					} catch (error) {
						console.error('SSE stream error:', error);
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({
							type: 'error',
							message: error.message || '获取邮件失败'
						})}\n\n`));
					}
				}, refreshInterval);

				// 监听连接关闭
				c.req.raw.signal.addEventListener('abort', () => {
					clearInterval(intervalId);
					controller.close();
				});
			},

			cancel() {
				if (intervalId) {
					clearInterval(intervalId);
				}
			}
		});

		// 返回 SSE 响应
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'X-Accel-Buffering': 'no' // 禁用 Nginx 缓冲
			}
		});

	} catch (error) {
		console.error('SSE connection error:', error);
		if (error instanceof BizError) {
			return c.json({ error: error.message }, error.code || 400);
		}
		return c.json({ error: '建立 SSE 连接失败' }, 500);
	}
});

export default app;

