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

		// 验证邮箱匹配
		if (userEmail && userEmail.toLowerCase() !== shareRecord.targetEmail.toLowerCase()) {
			throw new BizError('输入的邮箱与分享邮箱不匹配', 400);
		}

		// 验证白名单
		const { shareWhitelist } = await settingService.query(c);
		const whitelistEmails = shareWhitelist ? shareWhitelist.split(',').filter(email => email.trim()) : [];
		if (whitelistEmails.length > 0) {
			const isInWhitelist = whitelistEmails.some(whiteEmail =>
				whiteEmail.trim().toLowerCase() === shareRecord.targetEmail.toLowerCase()
			);
			if (!isInWhitelist) {
				throw new BizError('该邮箱不在可分享的邮箱白名单中', 403);
			}
		}

		// 获取目标账户
		const targetAccount = await accountService.selectByEmailIncludeDel(c, shareRecord.targetEmail);
		if (!targetAccount) {
			throw new BizError('目标邮箱不存在', 404);
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

