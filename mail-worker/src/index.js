import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';

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

		// 所有其他路径（包括 /share/:token）都路由到前端 SPA
		return env.assets ? env.assets.fetch(req) : new Response('Not Found', { status: 404 });
	},
	email: email,
	async scheduled(c, env, ctx) {
		await verifyRecordService.clearRecord({env})
		await userService.resetDaySendCount({ env })
	},
};
