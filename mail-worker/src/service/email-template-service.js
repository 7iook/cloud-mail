import { emailTemplate } from '../entity/email-template';
import orm from '../entity/orm';
import { eq, and, desc, sql } from 'drizzle-orm';
import BizError from '../error/biz-error';
import cryptoUtils from '../utils/crypto-utils';
import dayjs from 'dayjs';

const emailTemplateService = {

	// 获取用户的模板列表
	async getUserTemplates(c, userId, page = 1, pageSize = 20) {
		const offset = (page - 1) * pageSize;
		
		const templates = await orm(c).select().from(emailTemplate)
			.where(and(
				eq(emailTemplate.userId, userId),
				eq(emailTemplate.isActive, 1)
			))
			.orderBy(desc(emailTemplate.createdAt))
			.limit(pageSize)
			.offset(offset)
			.all();
			
		return templates;
	},

	// 获取所有可用模板（包括系统预设）
	async getAvailableTemplates(c, userId) {
		const templates = await orm(c).select().from(emailTemplate)
			.where(and(
				eq(emailTemplate.isActive, 1)
			))
			.orderBy(desc(emailTemplate.createdAt))
			.all();
			
		return templates;
	},

	// 根据ID获取模板
	async getById(c, templateId) {
		return await orm(c).select().from(emailTemplate)
			.where(and(
				eq(emailTemplate.id, templateId),
				eq(emailTemplate.isActive, 1)
			))
			.get();
	},

	// 创建新模板
	async create(c, params, userId) {
		const {
			name,
			senderPattern,
			subjectPattern,
			bodyPattern,
			extractionRegex,
			codeFormat,
			description,
			exampleEmail,
			exampleCode
		} = params;

		// 生成模板ID
		const templateId = `template_${cryptoUtils.genRandomStr(16)}`;

		const templateData = {
			id: templateId,
			name,
			senderPattern: senderPattern || '',
			subjectPattern: subjectPattern || '',
			bodyPattern: bodyPattern || '',
			extractionRegex,
			codeFormat: codeFormat || '',
			userId,
			description: description || '',
			exampleEmail: exampleEmail || '',
			exampleCode: exampleCode || '',
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString()
		};

		const templateRow = await orm(c).insert(emailTemplate).values(templateData).returning().get();
		return templateRow;
	},

	// 更新模板
	async update(c, templateId, params, userId) {
		// 验证模板是否存在且属于当前用户
		const templateRow = await this.getById(c, templateId);
		if (!templateRow) {
			throw new BizError('模板不存在', 404);
		}
		if (templateRow.userId !== userId && templateRow.userId !== 1) { // 系统模板(userId=1)不允许修改
			throw new BizError('无权限操作此模板', 403);
		}
		if (templateRow.userId === 1) {
			throw new BizError('系统预设模板不允许修改', 403);
		}

		const updateData = {
			...params,
			updatedAt: dayjs().toISOString()
		};

		await orm(c).update(emailTemplate)
			.set(updateData)
			.where(eq(emailTemplate.id, templateId))
			.run();

		return { success: true };
	},

	// 删除模板
	async delete(c, templateId, userId) {
		// 验证模板是否存在且属于当前用户
		const templateRow = await this.getById(c, templateId);
		if (!templateRow) {
			throw new BizError('模板不存在', 404);
		}
		if (templateRow.userId !== userId && templateRow.userId !== 1) {
			throw new BizError('无权限操作此模板', 403);
		}
		if (templateRow.userId === 1) {
			throw new BizError('系统预设模板不允许删除', 403);
		}

		await orm(c).update(emailTemplate)
			.set({ isActive: 0 })
			.where(eq(emailTemplate.id, templateId))
			.run();

		return { success: true };
	},

	// 测试模板匹配
	async testTemplate(c, templateId, testEmail) {
		const template = await this.getById(c, templateId);
		if (!template) {
			throw new BizError('模板不存在', 404);
		}

		const result = this.extractVerificationCode(testEmail, template);
		return {
			template: template,
			testEmail: testEmail,
			extractionResult: result
		};
	},

	// 验证码提取核心算法
	extractVerificationCode(emailContent, template) {
		try {
			const { subject = '', from = '', body = '' } = emailContent;
			const { senderPattern, subjectPattern, bodyPattern, extractionRegex } = template;

			// 1. 发件人匹配检查
			if (senderPattern && senderPattern.trim()) {
				const senderRegex = new RegExp(senderPattern, 'i');
				if (!senderRegex.test(from)) {
					return {
						success: false,
						reason: 'sender_mismatch',
						message: '发件人不匹配模板规则'
					};
				}
			}

			// 2. 主题匹配检查
			if (subjectPattern && subjectPattern.trim()) {
				const subjectRegex = new RegExp(subjectPattern, 'i');
				if (!subjectRegex.test(subject)) {
					return {
						success: false,
						reason: 'subject_mismatch',
						message: '邮件主题不匹配模板规则'
					};
				}
			}

			// 3. 邮件正文匹配检查
			if (bodyPattern && bodyPattern.trim()) {
				const bodyRegex = new RegExp(bodyPattern, 'i');
				if (!bodyRegex.test(body)) {
					return {
						success: false,
						reason: 'body_mismatch',
						message: '邮件正文不匹配模板规则'
					};
				}
			}

			// 4. 验证码提取
			const codeRegex = new RegExp(extractionRegex, 'gi');
			const matches = body.match(codeRegex);
			
			if (!matches || matches.length === 0) {
				return {
					success: false,
					reason: 'code_not_found',
					message: '未找到验证码'
				};
			}

			// 提取第一个匹配的验证码
			const fullMatch = matches[0];
			const codeMatch = fullMatch.match(new RegExp(extractionRegex, 'i'));
			const verificationCode = codeMatch && codeMatch[1] ? codeMatch[1] : fullMatch;

			return {
				success: true,
				verificationCode: verificationCode.trim(),
				fullMatch: fullMatch,
				matchCount: matches.length,
				extractedAt: dayjs().toISOString()
			};

		} catch (error) {
			return {
				success: false,
				reason: 'extraction_error',
				message: `提取过程出错: ${error.message}`
			};
		}
	}
};

export default emailTemplateService;
