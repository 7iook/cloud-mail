import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import shareService from './service/share-service';

console.log('=== INDEX.JS MODULE LOADED ===');
export default {
	 async fetch(req, env, ctx) {
		console.log('=== FETCH FUNCTION CALLED ===');
		const url = new URL(req.url)
		
		console.log(`=== INDEX.JS: ${req.method} ${url.pathname} ===`);

		if (url.pathname.startsWith('/api/')) {
			console.log(`=== API REQUEST: ${req.method} ${url.pathname} -> ${url.pathname.replace('/api', '')} ===`);
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		// 处理分享链接路由 - 在返回前端SPA前验证token
		if (url.pathname.startsWith('/share/') && url.pathname.length > 7) {
			const shareToken = url.pathname.split('/share/')[1];
			
			// 只处理直接的分享token访问，排除API路径
			if (shareToken && !shareToken.includes('/') && shareToken.length === 32) {
				try {
					console.log(`=== SHARE TOKEN VALIDATION: ${shareToken} ===`);
					
					// 验证分享token是否有效
					await shareService.getByToken({ env }, shareToken);
					
					// Token有效，返回前端SPA
					console.log(`=== SHARE TOKEN VALID: ${shareToken} ===`);
					return env.assets ? env.assets.fetch(req) : new Response('Not Found', { status: 404 });
					
				} catch (error) {
					console.log(`=== SHARE TOKEN INVALID: ${shareToken}, Error: ${error.message} ===`);

					// Token无效，返回纯文本404响应（激进式安全策略）
					// 完全不渲染任何HTML内容，防止域名和系统信息泄露
					return new Response('Not Found', {
						status: 404,
						headers: {
							'Content-Type': 'text/plain; charset=utf-8',
							'Cache-Control': 'no-store, no-cache, must-revalidate',
							'Pragma': 'no-cache',
							'Expires': '0'
						}
					});
				}
			}
		}

		// 所有其他路径都路由到前端 SPA
		return env.assets ? env.assets.fetch(req) : new Response('Not Found', { status: 404 });
	},
	email: email,
	async scheduled(c, env, ctx) {
		await verifyRecordService.clearRecord({env})
		await userService.resetDaySendCount({ env })
	},
};
