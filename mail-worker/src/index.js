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
					
					// Token无效，返回404页面（不暴露域名）
					return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>404 - Page Not Found</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .error-container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #e74c3c; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>404</h1>
        <p>The requested page could not be found.</p>
        <p>Please check the URL and try again.</p>
    </div>
</body>
</html>`, {
						status: 404,
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
							'Cache-Control': 'no-cache, no-store, must-revalidate'
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
