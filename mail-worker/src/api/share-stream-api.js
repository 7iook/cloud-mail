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

// SSE 实时推送端点
app.get('/share/stream/:shareToken', shareRateLimitMiddleware, async (c) => {
	try {
		const shareToken = c.req.param('shareToken');
		const { userEmail } = c.req.query();

		// 验证分享链接
		const shareRecord = await shareService.getByToken(c, shareToken);

		// 根据分享类型进行不同的验证
		if (shareRecord.shareType === 2) {
			// 类型2：多邮箱验证分享
			if (!userEmail) {
				throw new BizError('请输入邮箱地址进行验证', 400);
			}

			// 获取该分享的授权邮箱列表
			let authorizedEmails = [];
			try {
				authorizedEmails = shareRecord.authorizedEmails ? JSON.parse(shareRecord.authorizedEmails) : [];
			} catch (error) {
				console.error('解析授权邮箱列表失败:', error);
				authorizedEmails = [];
			}

			// 验证邮箱是否在该分享的授权列表中
			const isAuthorized = authorizedEmails.some(authorizedEmail =>
				authorizedEmail.trim().toLowerCase() === userEmail.toLowerCase()
			);

			if (!isAuthorized) {
				throw new BizError('该邮箱不在此分享的授权列表中', 403);
			}

			// 验证通过，使用输入的邮箱作为目标邮箱
			shareRecord.targetEmail = userEmail;
		} else {
			// 类型1：单邮箱分享（原有逻辑）
			if (userEmail && userEmail.toLowerCase() !== shareRecord.targetEmail.toLowerCase()) {
				throw new BizError('输入的邮箱与分享邮箱不匹配', 400);
			}
		}

		// 获取目标账户，如果不存在则按需创建
		let targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);
		if (!targetAccount) {
			// 如果邮箱账户不存在，使用分享创建者的userId自动创建
			try {
				targetAccount = await accountService.add(c, { email: shareRecord.targetEmail }, shareRecord.userId);
				console.log(`为SSE流访问自动创建邮箱账户: ${shareRecord.targetEmail}`);
			} catch (error) {
				console.error('SSE流访问时自动创建邮箱账户失败:', error);
				throw new BizError('邮箱账户创建失败', 500);
			}
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

