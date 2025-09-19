import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';

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
