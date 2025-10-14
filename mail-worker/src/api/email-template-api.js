import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import emailTemplateService from '../service/email-template-service';
import BizError from '../error/biz-error';

// 获取用户的模板列表
app.get('/email-template/user-templates', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const page = parseInt(c.req.query('page')) || 1;
		const pageSize = parseInt(c.req.query('pageSize')) || 20;

		const templates = await emailTemplateService.getUserTemplates(c, userId, page, pageSize);

		return c.json(result.success(templates));
	} catch (error) {
		console.error('Get user templates error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('获取模板列表失败', 500));
	}
});

// 获取所有可用模板（包括系统预设）
app.get('/email-template/available-templates', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templates = await emailTemplateService.getAvailableTemplates(c, userId);

		return c.json(result.success(templates));
	} catch (error) {
		console.error('Get available templates error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('获取可用模板失败', 500));
	}
});

// 根据ID获取模板详情
app.get('/email-template/:templateId', async (c) => {
	try {
		const templateId = c.req.param('templateId');
		const template = await emailTemplateService.getById(c, templateId);

		if (!template) {
			return c.json(result.fail('模板不存在', 404));
		}

		return c.json(result.success(template));
	} catch (error) {
		console.error('Get template error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('获取模板详情失败', 500));
	}
});

// 创建新模板
app.post('/email-template', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const params = await c.req.json();

		// 验证必填字段
		if (!params.name || !params.extractionRegex) {
			return c.json(result.fail('模板名称和提取正则表达式为必填项', 400));
		}

		const template = await emailTemplateService.create(c, params, userId);

		return c.json(result.success(template, '模板创建成功'));
	} catch (error) {
		console.error('Create template error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('创建模板失败', 500));
	}
});

// 更新模板
app.put('/email-template/:templateId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templateId = c.req.param('templateId');
		const params = await c.req.json();

		await emailTemplateService.update(c, templateId, params, userId);

		return c.json(result.success(null, '模板更新成功'));
	} catch (error) {
		console.error('Update template error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('更新模板失败', 500));
	}
});

// 删除模板
app.delete('/email-template/:templateId', async (c) => {
	try {
		const userId = userContext.getUserId(c);
		const templateId = c.req.param('templateId');

		await emailTemplateService.delete(c, templateId, userId);

		return c.json(result.success(null, '模板删除成功'));
	} catch (error) {
		console.error('Delete template error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('删除模板失败', 500));
	}
});

// 测试模板匹配
app.post('/email-template/:templateId/test', async (c) => {
	try {
		const templateId = c.req.param('templateId');
		const { testEmail } = await c.req.json();

		if (!testEmail) {
			return c.json(result.fail('请提供测试邮件内容', 400));
		}

		const testResult = await emailTemplateService.testTemplate(c, templateId, testEmail);

		return c.json(result.success(testResult));
	} catch (error) {
		console.error('Test template error:', error);
		if (error instanceof BizError) {
			return c.json(result.fail(error.message, error.status));
		}
		return c.json(result.fail('测试模板失败', 500));
	}
});
