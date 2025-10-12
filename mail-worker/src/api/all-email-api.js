import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import userContext from '../security/user-context';

app.get('/allEmail/list',async (c) => {
	const data = await emailService.allList(c, c.req.query());
	return c.json(result.ok(data));
})

app.get('/allEmail/latest',async (c) => {
	const list = await emailService.allLatest(c, c.req.query());
	return c.json(result.ok(list));
})

app.delete('/allEmail/delete',async (c) => {
	const list = await emailService.physicsDelete(c, c.req.query());
	return c.json(result.ok(list));
})

app.delete('/allEmail/batchDelete',async (c) => {
	await emailService.batchDelete(c, c.req.query());
	return c.json(result.ok());
})

// 获取所有唯一收件邮箱地址(用于白名单导入)
app.get('/allEmail/uniqueRecipients', async (c) => {
	console.log('[DEBUG API] uniqueRecipients endpoint called');
	try {
		console.log('[DEBUG API] Getting user context...');
		const userId = userContext.getUserId(c);
		console.log('[DEBUG API] userId from context:', userId);
		const params = {
			userId,
			...c.req.query()
		};
		console.log('[DEBUG API] params:', JSON.stringify(params));
		
		console.log('[DEBUG API] Calling emailService.getUniqueRecipients...');
		const data = await emailService.getUniqueRecipients(c, params);
		console.log('[DEBUG API] Service returned data:', JSON.stringify(data));
		return c.json(result.ok(data));
	} catch (error) {
		console.error('Get unique recipients API error:', error);
		return c.json(result.fail(error.message || '获取唯一邮箱列表失败'), 500);
	}
})
