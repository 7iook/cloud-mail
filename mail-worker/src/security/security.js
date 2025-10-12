import BizError from '../error/biz-error';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import dayjs from 'dayjs';
import userService from '../service/user-service';
import permService from '../service/perm-service';
import { t } from '../i18n/i18n'
import app from '../hono/hono';

const exclude = [
	'/login',
	'/register',
	'/file',
	'/setting/websiteConfig',
	'/webhooks',
	'/init',
	'/public/genToken',
	'/public/emailList',
	'/share/access',
	'/share/emails'
];

const requirePerms = [
	'/email/send',
	'/email/delete',
	'/account/list',
	'/account/delete',
	'/account/add',
	'/my/delete',
	'/role/add',
	'/role/list',
	'/role/delete',
	'/role/tree',
	'/role/set',
	'/role/setDefault',
	'/allEmail/list',
	'/allEmail/delete',
	'/setting/setBackground',
	'/setting/set',
	'/setting/query',
	'/user/delete',
	'/user/setPwd',
	'/user/setStatus',
	'/user/setType',
	'/user/list',
	'/user/resetSendCount',
	'/user/add',
	'/regKey/add',
	'/regKey/list',
	'/regKey/delete',
	'/regKey/clearNotUse',
	'/share/create',
	'/regKey/history'
];

const premKey = {
	'email:delete': ['/email/delete'],
	'email:send': ['/email/send'],
	'account:add': ['/account/add'],
	'account:query': ['/account/list'],
	'account:delete': ['/account/delete'],
	'my:delete': ['/my/delete'],
	'role:add': ['/role/add'],
	'role:set': ['/role/set','/role/setDefault'],
	'role:query': ['/role/list', '/role/tree'],
	'role:delete': ['/role/delete'],
	'user:query': ['/user/list'],
	'user:add': ['/user/add'],
	'user:reset-send': ['/user/resetSendCount'],
	'user:set-pwd': ['/user/setPwd'],
	'user:set-status': ['/user/setStatus'],
	'user:set-type': ['/user/setType'],
	'user:delete': ['/user/delete'],
	'all-email:query': ['/allEmail/list'],
	'all-email:delete': ['/allEmail/delete','/allEmail/batchDelete'],
	'setting:query': ['/setting/query'],
	'setting:set': ['/setting/set', '/setting/setBackground'],
	'analysis:query': ['/analysis/echarts'],
	'reg-key:add': ['/regKey/add'],
	'reg-key:query': ['/regKey/list','/regKey/history'],
	'reg-key:delete': ['/regKey/delete','/regKey/clearNotUse'],
};

app.use('*', async (c, next) => {

	const path = c.req.path;

	if (path.startsWith('/test')) {
		return await next();
	}

	const index = exclude.findIndex(item => {
		return path.startsWith(item);
	});

	if (index > -1) {
		return await next();
	}

	// 处理分享token直接访问（如 /share/wp4Qug766zM2gRBaNu6vg25w7ZwZx8hk）
	if (path.startsWith('/share/') && path.length > 7 && !path.includes('/list') && !path.includes('/create') && !path.includes('/logs') && !path.includes('/stats') && !path.includes('/batch') && !path.includes('/refresh-token') && !path.includes('/update-limit') && !path.includes('/name') && !path.includes('/expire') && !path.includes('/status')) {
		return await next();
	}

	if (path.startsWith('/public')) {
		const authHeader = c.req.header(constant.TOKEN_HEADER);

		// Extract token from Bearer format
		let publicToken = authHeader;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			publicToken = authHeader.substring(7);
		}

		// Check if JWT optimization is enabled
		const useJwtOptimization = c.env.ENABLE_JWT_OPTIMIZATION === 'true';

		if (useJwtOptimization) {
			// Try JWT verification first
			try {
				const decoded = await jwtUtils.verifyToken(c, publicToken);
				if (decoded && decoded.type === 'public_api') {
					return await next();
				}
			} catch (error) {
				console.error('JWT verification failed, trying legacy:', error);
				// JWT verification failed, try legacy verification as fallback
			}
		}

		// Legacy token verification (fallback)
		const userPublicToken = await c.env.kv.get(KvConst.PUBLIC_KEY);
		if (publicToken !== userPublicToken) {
			throw new BizError(t('publicTokenFail'), 401);
		}
		return await next();
	}


	const authHeader = c.req.header(constant.TOKEN_HEADER);

	// Extract JWT token from Bearer format
	let jwt = authHeader;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		jwt = authHeader.substring(7);
	}

	const result = await jwtUtils.verifyToken(c, jwt);

	if (!result) {
		throw new BizError(t('authExpired'), 401);
	}

	const { userId, token } = result;
	const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });

	if (!authInfo) {
		throw new BizError(t('authExpired'), 401);
	}

	if (!authInfo.tokens.includes(token)) {
		throw new BizError(t('authExpired'), 401);
	}

	const permIndex = requirePerms.findIndex(item => {
		return path.startsWith(item);
	});

	if (permIndex > -1) {

		const permKeys = await permService.userPermKeys(c, authInfo.user.userId);

		const userPaths = permKeyToPaths(permKeys);

		const userPermIndex = userPaths.findIndex(item => {
			return path.startsWith(item);
		});

		if (userPermIndex === -1 && authInfo.user.email !== c.env.admin) {
			throw new BizError(t('unauthorized'), 403);
		}

	}

	const refreshTime = dayjs(authInfo.refreshTime).startOf('day');
	const nowTime = dayjs().startOf('day')

	if (!nowTime.isSame(refreshTime)) {
		authInfo.refreshTime = dayjs().toISOString();
		await userService.updateUserInfo(c, authInfo.user.userId);
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	}

	c.set('user',authInfo.user)

	return await next();
});

function permKeyToPaths(permKeys) {
	const paths = [];
	for (const key of permKeys) {
		const routeList = premKey[key];
		if (routeList && Array.isArray(routeList)) {
			paths.push(...routeList);
		}
	}
	return paths;
}
