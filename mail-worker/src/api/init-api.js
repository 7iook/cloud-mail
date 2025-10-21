import app from '../hono/hono';
import initService from '../init/init';

app.get('/init/:secret', (c) => {
	return initService.init(c);
});

// 数据库迁移API - 添加email_ids字段
app.post('/migrate/add-email-ids/:secret', async (c) => {
	try {
		const secret = c.req.param('secret');
		// 简单的安全检查
		if (secret !== 'migration-2025') {
			return c.json({ success: false, message: '无效的密钥' }, 403);
		}

		const result = await initService.migrateAddEmailIds(c);
		return c.json(result);
	} catch (error) {
		return c.json({ success: false, message: '迁移失败: ' + error.message }, 500);
	}
});

// 数据库迁移API - 添加冷却配置字段
app.post('/migrate/add-cooldown-config/:secret', async (c) => {
	try {
		const secret = c.req.param('secret');
		// 简单的安全检查
		if (secret !== 'migration-2025') {
			return c.json({ success: false, message: '无效的密钥' }, 403);
		}

		const result = await initService.migrateCooldownConfig(c);
		return c.json(result);
	} catch (error) {
		return c.json({ success: false, message: '迁移失败: ' + error.message }, 500);
	}
});
