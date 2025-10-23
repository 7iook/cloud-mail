import app from '../hono/hono';
import result from '../model/result';
import settingService from '../service/setting-service';
import BizError from '../error/biz-error';

app.put('/setting/set', async (c) => {
	await settingService.set(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/setting/query', async (c) => {
	const setting = await settingService.get(c);
	return c.json(result.ok(setting));
});

app.get('/setting/websiteConfig', async (c) => {
	const setting = await settingService.websiteConfig(c);
	return c.json(result.ok(setting));
})

app.put('/setting/setBackground', async (c) => {
	const key = await settingService.setBackground(c, await c.req.json());
	return c.json(result.ok(key));
});

// 获取全局公告
app.get('/setting/global-announcement', async (c) => {
	try {
		const announcement = await settingService.getGlobalAnnouncement(c);
		return c.json(result.ok(announcement));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('获取全局公告失败'), 500);
	}
});

// 设置全局公告
app.put('/setting/global-announcement', async (c) => {
	try {
		console.log('[API] PUT /setting/global-announcement 请求到达');
		const { title, content, enabled, displayMode, images, overrideShareAnnouncement, autoApplyNewShare } = await c.req.json();
		console.log('[API] 接收到的参数:', { title, content, enabled, displayMode, images, overrideShareAnnouncement, autoApplyNewShare });
		const announcement = await settingService.setGlobalAnnouncement(c, {
			title,
			content,
			enabled,
			displayMode,
			images,
			overrideShareAnnouncement,
			autoApplyNewShare
		});
		console.log('[API] setGlobalAnnouncement 返回:', announcement);
		return c.json(result.ok(announcement));
	} catch (error) {
		console.error('[API] 错误:', error);
		console.error('[API] 错误堆栈:', error.stack);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('设置全局公告失败: ' + error.message), 500);
	}
});

// 标记公告为已读
app.post('/setting/announcement/mark-read', async (c) => {
	try {
		const { userId, announcementVersion } = await c.req.json();
		const result_data = await settingService.markAnnouncementAsRead(c, userId, announcementVersion);
		return c.json(result.ok(result_data));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('标记公告为已读失败'), 500);
	}
});

// 检查公告是否已读
app.get('/setting/announcement/check-read', async (c) => {
	try {
		const userId = c.req.query('userId');
		const announcementVersion = c.req.query('announcementVersion');
		const read_status = await settingService.checkAnnouncementRead(c, parseInt(userId), parseInt(announcementVersion));
		return c.json(result.ok(read_status));
	} catch (error) {
		if (error instanceof BizError) {
			return c.json(result.fail(error.message), error.code || 400);
		}
		return c.json(result.fail('检查公告已读状态失败'), 500);
	}
});
