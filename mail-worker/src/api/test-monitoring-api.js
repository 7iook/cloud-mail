import app from '../hono/hono';
import emailService from '../service/email-service';
import monitorService from '../service/monitor-service';
import orm from '../entity/orm';
import monitorEmail from '../entity/monitor-email';
import email from '../entity/email';
import monitorConfig from '../entity/monitor-config';
import result from '../model/result';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import { isDel } from '../const/entity-const';

// 环境变量控制的调试开关中间件 - 增强版
const debugModeMiddleware = async (c, next) => {
	// 检查是否启用调试模式
	const debugEnabled = c.env.DEBUG_MODE === 'true' || c.env.DEBUG_MODE === true;

	if (!debugEnabled) {
		// 生产环境下提供友好的错误信息和降级数据
		const errorResponse = {
			success: false,
			message: 'Debug endpoints are disabled in production environment',
			code: 'DEBUG_DISABLED',
			environment: 'production',
			suggestion: 'Please use production APIs instead of debug endpoints',
			fallbackData: {
				testResults: {
					testId: 'fallback-' + Date.now(),
					timestamp: new Date().toISOString(),
					scenarios: [],
					summary: { total: 0, passed: 0, failed: 0 },
					fallback: true
				}
			},
			timestamp: new Date().toISOString()
		};

		console.warn(`[PRODUCTION] Debug API access blocked: ${c.req.method} ${c.req.url}`);
		return c.json(result.fail(errorResponse), 403);
	}

	// 记录调试API访问
	console.log(`[DEBUG] Test API accessed: ${c.req.method} ${c.req.url} at ${new Date().toISOString()}`);

	await next();
};

// 初始化测试监控配置
app.post('/test/monitoring/init-configs', debugModeMiddleware, async (c) => {
	try {
		// 确保测试所需的监控配置存在
		const testConfigs = [
			{
				emailAddress: 'test@example.com',
				aliasType: 'exact',
				description: '精确匹配测试配置'
			},
			{
				emailAddress: 'test@gmail.com',
				aliasType: 'gmail_alias',
				description: 'Gmail别名匹配测试配置'
			},
			{
				emailAddress: '*@example.com',
				aliasType: 'domain_wildcard',
				description: '域名通配符匹配测试配置'
			}
		];

		const createdConfigs = [];

		for (const configData of testConfigs) {
			try {
				// 检查配置是否已存在
				const existing = await orm(c).select().from(monitorConfig)
					.where(and(
						eq(monitorConfig.emailAddress, configData.emailAddress),
						eq(monitorConfig.aliasType, configData.aliasType),
						eq(monitorConfig.isDel, isDel.NORMAL)
					))
					.get();

				if (!existing) {
					// 创建新配置
					const newConfig = await monitorService.create(c, {
						emailAddress: configData.emailAddress,
						aliasType: configData.aliasType,
						filterConfig: {},
						expiresAt: null
					}, 1); // 使用测试用户ID 1

					createdConfigs.push({
						...newConfig,
						description: configData.description,
						created: true
					});
				} else {
					createdConfigs.push({
						...existing,
						description: configData.description,
						created: false
					});
				}
			} catch (error) {
				console.error(`Failed to create config ${configData.emailAddress}:`, error);
			}
		}

		return c.json(result.ok({
			message: 'Test monitoring configs initialized',
			configs: createdConfigs
		}));

	} catch (error) {
		console.error('Init test configs error:', error);
		return c.json(result.fail(error.message || 'Failed to initialize test configs'));
	}
});

// 综合邮件监控测试端点
app.post('/test/monitoring/comprehensive', debugModeMiddleware, async (c) => {
	try {
		// 首先初始化测试配置
		await fetch(`${c.req.url.replace('/comprehensive', '/init-configs')}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		const testResults = {
			testId: uuidv4(),
			timestamp: new Date().toISOString(),
			scenarios: [],
			summary: {
				total: 0,
				passed: 0,
				failed: 0
			}
		};

		// 测试场景配置
		const testScenarios = [
			{
				name: 'exact_match_test',
				description: '精确匹配测试',
				emailData: {
					userId: 1,
					accountId: 1,
					sendEmail: 'sender@test.com',
					name: 'Test Sender',
					subject: '测试邮件监控功能 - 精确匹配',
					content: '<div><h2>精确匹配测试邮件</h2><p>这是一封用于测试精确邮箱地址匹配的邮件。</p></div>',
					text: '精确匹配测试邮件\n这是一封用于测试精确邮箱地址匹配的邮件。',
					recipient: JSON.stringify([{ address: 'test@example.com', name: 'Test Recipient' }]),
					cc: JSON.stringify([]),
					bcc: JSON.stringify([]),
					toEmail: 'test@example.com',
					toName: 'Test Recipient'
				},
				expectedMatches: ['test@example.com'],
				expectedMatchType: 'exact'
			},
			{
				name: 'gmail_alias_test',
				description: 'Gmail别名匹配测试',
				emailData: {
					userId: 1,
					accountId: 1,
					sendEmail: 'sender@test.com',
					name: 'Test Sender',
					subject: '测试邮件监控功能 - Gmail别名',
					content: '<div><h2>Gmail别名测试邮件</h2><p>这是一封用于测试Gmail别名匹配的邮件。</p></div>',
					text: 'Gmail别名测试邮件\n这是一封用于测试Gmail别名匹配的邮件。',
					recipient: JSON.stringify([{ address: 'test+monitoring@gmail.com', name: 'Test Gmail User' }]),
					cc: JSON.stringify([]),
					bcc: JSON.stringify([]),
					toEmail: 'test+monitoring@gmail.com',
					toName: 'Test Gmail User'
				},
				expectedMatches: ['test+monitoring@gmail.com'],
				expectedMatchType: 'gmail_alias'
			},
			{
				name: 'domain_wildcard_test',
				description: '域名通配符匹配测试',
				emailData: {
					userId: 1,
					accountId: 1,
					sendEmail: 'sender@test.com',
					name: 'Test Sender',
					subject: '测试邮件监控功能 - 域名通配符',
					content: '<div><h2>域名通配符测试邮件</h2><p>这是一封用于测试域名通配符匹配的邮件。</p></div>',
					text: '域名通配符测试邮件\n这是一封用于测试域名通配符匹配的邮件。',
					recipient: JSON.stringify([{ address: 'anything@example.com', name: 'Any User' }]),
					cc: JSON.stringify([]),
					bcc: JSON.stringify([]),
					toEmail: 'anything@example.com',
					toName: 'Any User'
				},
				expectedMatches: ['anything@example.com'],
				expectedMatchType: 'domain_wildcard'
			},
			{
				name: 'multiple_recipients_test',
				description: '多收件人匹配测试',
				emailData: {
					userId: 1,
					accountId: 1,
					sendEmail: 'sender@test.com',
					name: 'Test Sender',
					subject: '测试邮件监控功能 - 多收件人',
					content: '<div><h2>多收件人测试邮件</h2><p>这是一封用于测试多收件人匹配的邮件。</p></div>',
					text: '多收件人测试邮件\n这是一封用于测试多收件人匹配的邮件。',
					recipient: JSON.stringify([
						{ address: 'test@example.com', name: 'Test User 1' },
						{ address: 'nomatch@other.com', name: 'No Match User' }
					]),
					cc: JSON.stringify([{ address: 'test+cc@gmail.com', name: 'CC User' }]),
					bcc: JSON.stringify([]),
					toEmail: 'test@example.com',
					toName: 'Test User 1'
				},
				expectedMatches: ['test@example.com', 'test+cc@gmail.com'],
				expectedMatchType: ['exact', 'gmail_alias']
			},
			{
				name: 'no_match_test',
				description: '无匹配测试',
				emailData: {
					userId: 1,
					accountId: 1,
					sendEmail: 'sender@test.com',
					name: 'Test Sender',
					subject: '测试邮件监控功能 - 无匹配',
					content: '<div><h2>无匹配测试邮件</h2><p>这是一封不应该匹配任何监控配置的邮件。</p></div>',
					text: '无匹配测试邮件\n这是一封不应该匹配任何监控配置的邮件。',
					recipient: JSON.stringify([{ address: 'nomatch@nowhere.com', name: 'No Match User' }]),
					cc: JSON.stringify([]),
					bcc: JSON.stringify([]),
					toEmail: 'nomatch@nowhere.com',
					toName: 'No Match User'
				},
				expectedMatches: [],
				expectedMatchType: null
			}
		];

		// 执行每个测试场景
		for (const scenario of testScenarios) {
			const scenarioResult = await executeTestScenario(c, scenario);
			testResults.scenarios.push(scenarioResult);
			testResults.summary.total++;
			if (scenarioResult.passed) {
				testResults.summary.passed++;
			} else {
				testResults.summary.failed++;
			}
		}

		return c.json(result.ok(testResults));

	} catch (error) {
		console.error('Comprehensive monitoring test error:', error);
		return c.json(result.fail(error.message || 'Failed to execute comprehensive monitoring test'));
	}
});

// 执行单个测试场景
async function executeTestScenario(c, scenario) {
	const scenarioResult = {
		name: scenario.name,
		description: scenario.description,
		passed: false,
		emailId: null,
		monitorMatches: [],
		errors: [],
		details: {}
	};

	try {
		// 步骤1: 插入测试邮件
		const emailData = {
			...scenario.emailData,
			createTime: new Date().toISOString(),
			messageId: `<test-${Date.now()}-${scenario.name}@example.com>`,
			type: 0,
			status: 0,
			isDel: 0
		};

		const emailResult = await emailService.receive(c, emailData, [], null);
		scenarioResult.emailId = emailResult.emailId;
		scenarioResult.details.emailInserted = true;

		// 步骤2: 等待监控匹配完成（给异步处理一些时间）
		await new Promise(resolve => setTimeout(resolve, 1000));

		// 步骤3: 验证监控匹配结果
		const monitorMatches = await orm(c).select({
			monitorEmailId: monitorEmail.monitorEmailId,
			configId: monitorEmail.configId,
			emailId: monitorEmail.emailId,
			matchedAddress: monitorEmail.matchedAddress,
			matchType: monitorEmail.matchType,
			filterResult: monitorEmail.filterResult
		})
		.from(monitorEmail)
		.where(eq(monitorEmail.emailId, emailResult.emailId))
		.all();

		scenarioResult.monitorMatches = monitorMatches.map(match => ({
			...match,
			filterResult: JSON.parse(match.filterResult || '{}')
		}));

		// 步骤4: 验证匹配结果是否符合预期
		const expectedMatches = scenario.expectedMatches || [];
		const actualMatches = scenarioResult.monitorMatches.map(m => m.matchedAddress);

		if (expectedMatches.length === 0) {
			// 预期无匹配
			scenarioResult.passed = actualMatches.length === 0;
			if (!scenarioResult.passed) {
				scenarioResult.errors.push(`Expected no matches, but found: ${actualMatches.join(', ')}`);
			}
		} else {
			// 预期有匹配
			const allExpectedFound = expectedMatches.every(expected => 
				actualMatches.includes(expected)
			);
			const noUnexpectedMatches = actualMatches.every(actual => 
				expectedMatches.includes(actual)
			);

			scenarioResult.passed = allExpectedFound && noUnexpectedMatches;
			
			if (!allExpectedFound) {
				const missing = expectedMatches.filter(expected => !actualMatches.includes(expected));
				scenarioResult.errors.push(`Missing expected matches: ${missing.join(', ')}`);
			}
			
			if (!noUnexpectedMatches) {
				const unexpected = actualMatches.filter(actual => !expectedMatches.includes(actual));
				scenarioResult.errors.push(`Unexpected matches found: ${unexpected.join(', ')}`);
			}
		}

		scenarioResult.details.matchVerification = true;

	} catch (error) {
		scenarioResult.errors.push(`Execution error: ${error.message}`);
		scenarioResult.details.executionError = error.message;
	}

	return scenarioResult;
}

// 数据库验证查询端点
app.get('/test/monitoring/verify/:emailId', debugModeMiddleware, async (c) => {
	try {
		const emailId = parseInt(c.req.param('emailId'));
		
		// 查询邮件详情
		const emailDetails = await orm(c).select().from(email)
			.where(eq(email.emailId, emailId))
			.get();

		if (!emailDetails) {
			return c.json(result.fail('Email not found'));
		}

		// 查询监控匹配记录
		const monitorMatches = await orm(c).select({
			monitorEmailId: monitorEmail.monitorEmailId,
			configId: monitorEmail.configId,
			matchedAddress: monitorEmail.matchedAddress,
			matchType: monitorEmail.matchType,
			filterResult: monitorEmail.filterResult,
			createTime: monitorEmail.createTime,
			// 关联监控配置信息
			configEmailAddress: monitorConfig.emailAddress,
			configAliasType: monitorConfig.aliasType,
			configIsActive: monitorConfig.isActive
		})
		.from(monitorEmail)
		.innerJoin(monitorConfig, eq(monitorEmail.configId, monitorConfig.configId))
		.where(and(
			eq(monitorEmail.emailId, emailId),
			eq(monitorEmail.isDel, isDel.NORMAL)
		))
		.orderBy(desc(monitorEmail.createTime))
		.all();

		const verification = {
			emailId,
			emailDetails: {
				...emailDetails,
				recipient: JSON.parse(emailDetails.recipient || '[]'),
				cc: JSON.parse(emailDetails.cc || '[]'),
				bcc: JSON.parse(emailDetails.bcc || '[]')
			},
			monitorMatches: monitorMatches.map(match => ({
				...match,
				filterResult: JSON.parse(match.filterResult || '{}')
			})),
			summary: {
				totalMatches: monitorMatches.length,
				matchTypes: [...new Set(monitorMatches.map(m => m.matchType))],
				matchedAddresses: monitorMatches.map(m => m.matchedAddress)
			}
		};

		return c.json(result.ok(verification));

	} catch (error) {
		console.error('Verification error:', error);
		return c.json(result.fail(error.message || 'Failed to verify monitoring results'));
	}
});

// 模拟分享页面的新邮件接收（用于测试实时更新）
app.post('/test/monitoring/simulate-new-email', debugModeMiddleware, async (c) => {
	try {
		const { shareToken, emailData } = await c.req.json();

		// 输入验证
		if (!shareToken || !emailData) {
			return c.json(result.fail('Missing shareToken or emailData'), 400);
		}

		// 验证分享token并获取监控配置
		const config = await monitorService.getByShareToken(c, shareToken);
		if (!config) {
			return c.json(result.fail('Invalid share token'), 404);
		}

		// 构造完整的邮件数据
		const fullEmailData = {
			userId: 1, // 测试用户ID
			accountId: 1, // 测试账户ID
			sendEmail: emailData.fromEmail || 'test-sender@example.com',
			name: emailData.fromName || 'Test Sender',
			subject: emailData.subject || '测试邮件 - 实时更新验证',
			content: emailData.content || `<div><h2>测试邮件内容</h2><p>这是一封用于验证分享页面实时更新功能的测试邮件。</p><p>发送时间：${new Date().toLocaleString()}</p></div>`,
			text: emailData.text || `测试邮件内容\n这是一封用于验证分享页面实时更新功能的测试邮件。\n发送时间：${new Date().toLocaleString()}`,
			recipient: JSON.stringify([{
				address: emailData.toEmail || config.emailAddress,
				name: emailData.toName || 'Test Recipient'
			}]),
			cc: JSON.stringify(emailData.cc || []),
			bcc: JSON.stringify(emailData.bcc || []),
			toEmail: emailData.toEmail || config.emailAddress,
			toName: emailData.toName || 'Test Recipient',
			createTime: new Date().toISOString(),
			messageId: `<test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com>`,
			type: 0,
			status: 0,
			isDel: 0
		};

		// 插入邮件到数据库
		const emailResult = await emailService.receive(c, fullEmailData, [], null);

		// 等待监控匹配处理完成
		await new Promise(resolve => setTimeout(resolve, 500));

		// 查询匹配结果
		const monitorMatches = await orm(c).select({
			monitorEmailId: monitorEmail.monitorEmailId,
			configId: monitorEmail.configId,
			emailId: monitorEmail.emailId,
			matchedAddress: monitorEmail.matchedAddress,
			matchType: monitorEmail.matchType,
			filterResult: monitorEmail.filterResult
		})
		.from(monitorEmail)
		.where(and(
			eq(monitorEmail.emailId, emailResult.emailId),
			eq(monitorEmail.configId, config.configId)
		))
		.all();

		return c.json(result.ok({
			success: true,
			emailId: emailResult.emailId,
			configId: config.configId,
			monitorMatches: monitorMatches.length,
			message: `成功模拟新邮件，邮件ID: ${emailResult.emailId}，匹配到 ${monitorMatches.length} 个监控配置`
		}));

	} catch (error) {
		console.error('Simulate new email error:', error);
		return c.json(result.fail(error.message || 'Failed to simulate new email'));
	}
});

// 清理测试数据端点
app.delete('/test/monitoring/cleanup', debugModeMiddleware, async (c) => {
	try {
		const { testId, olderThan } = c.req.query();
		
		let whereCondition;
		if (testId) {
			// 清理特定测试的数据
			whereCondition = `message_id LIKE '%${testId}%'`;
		} else if (olderThan) {
			// 清理指定时间之前的测试数据
			whereCondition = `create_time < '${olderThan}' AND message_id LIKE '%test-%'`;
		} else {
			// 清理所有测试数据
			whereCondition = `message_id LIKE '%test-%'`;
		}

		// 删除测试邮件的监控记录
		await c.env.db.prepare(`
			DELETE FROM monitor_email 
			WHERE email_id IN (
				SELECT email_id FROM email WHERE ${whereCondition}
			)
		`).run();

		// 删除测试邮件
		const deleteResult = await c.env.db.prepare(`
			DELETE FROM email WHERE ${whereCondition}
		`).run();

		return c.json(result.ok({
			message: 'Test data cleaned up successfully',
			deletedEmails: deleteResult.changes || 0
		}));

	} catch (error) {
		console.error('Cleanup error:', error);
		return c.json(result.fail(error.message || 'Failed to cleanup test data'));
	}
});
