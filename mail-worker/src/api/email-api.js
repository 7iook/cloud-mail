import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';
import userContext from '../security/user-context';
import attService from '../service/att-service';

app.get('/email/list', async (c) => {
	const data = await emailService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.get('/email/latest', async (c) => {
	const list = await emailService.latest(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(list));
});

app.delete('/email/delete', async (c) => {
	await emailService.delete(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/email/attList', async (c) => {
	const attList = await attService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(attList));
});

app.post('/email/send', async (c) => {
	const email = await emailService.send(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok(email));
});

// 标记邮件为已读
app.put('/email/markAsRead', async (c) => {
	const { emailId } = c.req.query();
	await emailService.markAsRead(c, emailId, userContext.getUserId(c));
	return c.json(result.ok());
});

// 标记邮件为未读
app.put('/email/markAsUnread', async (c) => {
	const { emailId } = c.req.query();
	await emailService.markAsUnread(c, emailId, userContext.getUserId(c));
	return c.json(result.ok());
});

// 批量标记邮件已读/未读状态
app.put('/email/batchMarkReadStatus', async (c) => {
	const { emailIds, isRead } = await c.req.json();
	await emailService.batchMarkReadStatus(c, emailIds, userContext.getUserId(c), isRead);
	return c.json(result.ok());
});

