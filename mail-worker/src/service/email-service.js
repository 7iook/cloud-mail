import orm from '../entity/orm';
import email from '../entity/email';
import { attConst, emailConst, isDel, settingConst } from '../const/entity-const';
import { and, desc, eq, gt, inArray, lt, count, asc, sql, ne, or, like, lte, gte } from 'drizzle-orm';
import { star } from '../entity/star';
import settingService from './setting-service';
import accountService from './account-service';
import BizError from '../error/biz-error';
import emailUtils from '../utils/email-utils';
import { Resend } from 'resend';
import attService from './att-service';
import { parseHTML } from 'linkedom';
import userService from './user-service';
import roleService from './role-service';
import user from '../entity/user';
import starService from './star-service';
import dayjs from 'dayjs';
import kvConst from '../const/kv-const';
import { t } from '../i18n/i18n'
import r2Service from './r2-service';
import domainUtils from '../utils/domain-uitls';

const emailService = {

	async list(c, params, userId) {

		let { emailId, type, accountId, size, timeSort } = params;

		size = Number(size);
		emailId = Number(emailId);
		timeSort = Number(timeSort);

		if (size > 30) {
			size = 30;
		}

		if (!emailId) {

			if (timeSort) {
				emailId = 0;
			} else {
				emailId = 9999999999;
			}

		}


		const query = orm(c)
			.select({
				...email,
				starId: star.starId
			})
			.from(email)
			.leftJoin(
				star,
				and(
					eq(star.emailId, email.emailId),
					eq(star.userId, userId)
				)
			)
			.where(
				and(
					eq(email.userId, userId),
					eq(email.accountId, accountId),
					timeSort ? gt(email.emailId, emailId) : lt(email.emailId, emailId),
					eq(email.type, type),
					eq(email.isDel, isDel.NORMAL)
				)
			);

		if (timeSort) {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		const listQuery = query.limit(size).all();

		const totalQuery = orm(c).select({ total: count() }).from(email).where(
			and(
				eq(email.accountId, accountId),
				eq(email.userId, userId),
				eq(email.type, type),
				eq(email.isDel, isDel.NORMAL)
			)
		).get();

		const latestEmailQuery = orm(c).select().from(email).where(
			and(
				eq(email.accountId, accountId),
				eq(email.userId, userId),
				eq(email.type, type),
				eq(email.isDel, isDel.NORMAL)
			))
			.orderBy(desc(email.emailId)).limit(1).get();

		let [list, totalRow, latestEmail] = await Promise.all([listQuery, totalQuery, latestEmailQuery]);

		list = list.map(item => ({
			...item,
			isStar: item.starId != null ? 1 : 0
		}));

		const emailIds = list.map(item => item.emailId);

		const attsList = await attService.selectByEmailIds(c, emailIds);

		list.forEach(emailRow => {
			const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
			emailRow.attList = atts;
		});

		return { list, total: totalRow.total, latestEmail };
	},

	async delete(c, params, userId) {
		const { emailIds } = params;
		const emailIdList = emailIds.split(',').map(Number);
		await orm(c).update(email).set({ isDel: isDel.DELETE }).where(
			and(
				eq(email.userId, userId),
				inArray(email.emailId, emailIdList)))
			.run();
	},

	receive(c, params, cidAttList, r2domain) {
		// 添加HTML清理逻辑，移除样式标签和属性
		if (params.content) {
			params.content = this.cleanHtmlContent(params.content);
		}

		params.content = this.imgReplace(params.content, cidAttList, r2domain)
		return orm(c).insert(email).values({ ...params }).returning().get();
	},

	async send(c, params, userId) {

		let {
			accountId,
			name,
			sendType,
			emailId,
			receiveEmail,
			manyType,
			text,
			content,
			subject,
			attachments
		} = params;

		const { resendTokens, r2Domain, send } = await settingService.query(c);

		let { attDataList, html } = await attService.toImageUrlHtml(c, content, r2Domain);

		if (send === settingConst.send.CLOSE) {
			throw new BizError(t('disabledSend'), 403);
		}

		const userRow = await userService.selectById(c, userId);
		const roleRow = await roleService.selectById(c, userRow.type);

		if (c.env.admin !== userRow.email && roleRow.sendType === 'ban') {
			throw new BizError(t('bannedSend'), 403);
		}

		if (c.env.admin !== userRow.email && roleRow.sendCount) {

			if (userRow.sendCount >= roleRow.sendCount) {
				if (roleRow.sendType === 'day') throw new BizError(t('daySendLimit'), 403);
				if (roleRow.sendType === 'count') throw new BizError(t('totalSendLimit'), 403);
			}

			if (userRow.sendCount + receiveEmail.length > roleRow.sendCount) {
				if (roleRow.sendType === 'day') throw new BizError(t('daySendLack'), 403);
				if (roleRow.sendType === 'count') throw new BizError(t('totalSendLack'), 403);
			}

		}


		if (attDataList.length > 0 && !r2Domain) {
			throw new BizError(t('noOsDomainSendPic'));
		}

		if (attDataList.length > 0 && !await r2Service.hasOSS(c)) {
			throw new BizError(t('noOsSendPic'));
		}

		if (attachments.length > 0 && !r2Domain) {
			throw new BizError(t('noOsDomainSendAtt'));
		}

		if (attachments.length > 0 && !await r2Service.hasOSS(c)) {
			throw new BizError(t('noOsSendAtt'));
		}

		if (attachments.length > 0 && manyType === 'divide') {
			throw new BizError(t('noSeparateSend'));
		}


		const accountRow = await accountService.selectById(c, accountId);

		if (!accountRow) {
			throw new BizError(t('senderAccountNotExist'));
		}

		if (accountRow.userId !== userId) {
			throw new BizError(t('sendEmailNotCurUser'));
		}

		if (c.env.admin !== userRow.email) {

			if(!roleService.hasAvailDomainPerm(roleRow.availDomain, accountRow.email)) {
				throw new BizError(t('noDomainPermSend'),403)
			}

		}

		const domain = emailUtils.getDomain(accountRow.email);
		const resendToken = resendTokens[domain];

		if (!resendToken) {
			throw new BizError(t('noResendToken'));
		}


		if (!name) {
			name = emailUtils.getName(accountRow.email);
		}

		let emailRow = {
			messageId: null
		};

		if (sendType === 'reply') {

			emailRow = await this.selectById(c, emailId);

			if (!emailRow) {
				throw new BizError(t('notExistEmailReply'));
			}

		}

		let resendResult = null;

		const resend = new Resend(resendToken);

		if (manyType === 'divide') {

			let sendFormList = [];

			receiveEmail.forEach(email => {
				const sendForm = {
					from: `${name} <${accountRow.email}>`,
					to: [email],
					subject: subject,
					text: text,
					html: html
				};

				if (sendType === 'reply') {
					sendForm.headers = {
						'in-reply-to': emailRow.messageId,
						'references': emailRow.messageId
					};
				}

				sendFormList.push(sendForm);
			});

			resendResult = await resend.batch.send(sendFormList);

		} else {

			const sendForm = {
				from: `${name} <${accountRow.email}>`,
				to: [...receiveEmail],
				subject: subject,
				text: text,
				html: html,
				attachments: attachments
			};

			if (sendType === 'reply') {
				sendForm.headers = {
					'in-reply-to': emailRow.messageId,
					'references': emailRow.messageId
				};
			}

			resendResult = await resend.emails.send(sendForm);

		}

		const { data, error } = resendResult;


		if (error) {
			throw new BizError(error.message);
		}

		html = this.imgReplace(html, null, r2Domain);

		const emailData = {};
		emailData.sendEmail = accountRow.email;
		emailData.name = name;
		emailData.subject = subject;
		emailData.content = html;
		emailData.text = text;
		emailData.accountId = accountId;
		emailData.type = emailConst.type.SEND;
		emailData.userId = userId;
		emailData.status = emailConst.status.SENT;

		const emailDataList = [];

		if (manyType === 'divide') {

			receiveEmail.forEach((item, index) => {
				const emailDataItem = { ...emailData };
				emailDataItem.resendEmailId = data.data[index].id;
				emailDataItem.recipient = JSON.stringify([{ address: item, name: '' }]);
				emailDataList.push(emailDataItem);
			});

		} else {

			emailData.resendEmailId = data.id;

			const recipient = [];

			receiveEmail.forEach(item => {
				recipient.push({ address: item, name: '' });
			});

			emailData.recipient = JSON.stringify(recipient);

			emailDataList.push(emailData);
		}

		if (sendType === 'reply') {
			emailDataList.forEach(emailData => {
				emailData.inReplyTo = emailRow.messageId;
				emailData.relation = emailRow.messageId;
			});
		}


		if (roleRow.sendCount) {
			await userService.incrUserSendCount(c, receiveEmail.length, userId);
		}

		const emailRowList = await Promise.all(
			emailDataList.map(async (emailData) => {
				const emailRow = await orm(c).insert(email).values(emailData).returning().get();

				if (attDataList.length > 0) {
					await attService.saveArticleAtt(c, attDataList, userId, accountId, emailRow.emailId);
				}

				if (attachments?.length > 0 && await r2Service.hasOSS(c)) {
					await attService.saveSendAtt(c, attachments, userId, accountId, emailRow.emailId);
				}

				const attsList = await attService.selectByEmailIds(c, [emailRow.emailId]);
				emailRow.attList = attsList;

				return emailRow;
			})
		);

		const dateStr = dayjs().format('YYYY-MM-DD');

		let daySendTotal = await c.env.kv.get(kvConst.SEND_DAY_COUNT + dateStr);

		if (!daySendTotal) {
			await c.env.kv.put(kvConst.SEND_DAY_COUNT + dateStr, JSON.stringify(receiveEmail.length), { expirationTtl: 60 * 60 * 24 });
		} else  {
			daySendTotal = Number(daySendTotal) + receiveEmail.length
			await c.env.kv.put(kvConst.SEND_DAY_COUNT + dateStr, JSON.stringify(daySendTotal), { expirationTtl: 60 * 60 * 24 });
		}

		return emailRowList;
	},

	imgReplace(content, cidAttList, r2domain) {

		if (!content) {
			return ''
		}

		const { document } = parseHTML(content);

		const images = Array.from(document.querySelectorAll('img'));

		const useAtts = []

		for (const img of images) {

			const src = img.getAttribute('src');
			if (src && src.startsWith('cid:') && cidAttList) {

				const cid = src.replace(/^cid:/, '');
				const attCidIndex = cidAttList.findIndex(cidAtt => cidAtt.contentId.replace(/^<|>$/g, '') === cid);

				if (attCidIndex > -1) {
					const cidAtt = cidAttList[attCidIndex];
					img.setAttribute('src', '{{domain}}' + cidAtt.key);
					useAtts.push(cidAtt)
				}

			}

			r2domain = domainUtils.toOssDomain(r2domain)

			if (src && src.startsWith(r2domain + '/')) {
				img.setAttribute('src', src.replace(r2domain + '/', '{{domain}}'));
			}

		}

		useAtts.forEach(att => {
			att.type = attConst.type.EMBED
		})

		return document.toString();
	},

	selectById(c, emailId) {
		return orm(c).select().from(email).where(
			and(eq(email.emailId, emailId),
				eq(email.isDel, isDel.NORMAL)))
			.get();
	},

	async latest(c, params, userId) {
		let { emailId, accountId } = params;


		const list = await orm(c).select().from(email).where(
			and(
				eq(email.userId, userId),
				eq(email.isDel, isDel.NORMAL),
				eq(email.accountId, accountId),
				eq(email.type, emailConst.type.RECEIVE),
				gt(email.emailId, emailId)
			))
			.orderBy(desc(email.emailId))
			.limit(20);



		const emailIds = list.map(item => item.emailId);

		if (emailIds.length > 0) {

			const attsList = await attService.selectByEmailIds(c, emailIds);

			list.forEach(emailRow => {
				const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
				emailRow.attList = atts;
			});
		}

		return list;
	},

	async latestByTargetEmail(c, params, userId) {
		let { emailId, targetEmail } = params;

		// 调试日志
		console.log('[DEBUG latestByTargetEmail] Input params:', {
			emailId,
			targetEmail,
			userId,
			targetEmailLower: targetEmail.toLowerCase()
		});

		// 修复：移除 user_id 过滤
		// 原因：这是一个临时邮箱转发系统，分享链接本身就是访问控制机制
		// 分享类型2已经通过 authorizedEmails 进行了邮箱验证
		// 不需要再通过 user_id 进行额外的权限过滤
		// 这样可以支持所有 user_id 的邮件（包括 user_id = 0 和 user_id = 1）
		const list = await orm(c).select().from(email).where(
			and(
				eq(email.isDel, isDel.NORMAL),
				sql`LOWER(${email.toEmail}) = LOWER(${targetEmail})`,
				eq(email.type, emailConst.type.RECEIVE),
				gt(email.emailId, emailId)
			))
			.orderBy(desc(email.emailId))
			.limit(20);

		console.log('[DEBUG latestByTargetEmail] Query result count:', list.length);
		if (list.length > 0) {
			console.log('[DEBUG latestByTargetEmail] First email to_email:', list[0].toEmail);
		}

		const emailIds = list.map(item => item.emailId);

		if (emailIds.length > 0) {
			const attsList = await attService.selectByEmailIds(c, emailIds);

			list.forEach(emailRow => {
				const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
				emailRow.attList = atts;
			});
		}

		return list;
	},

	async allLatest(c, params) {
		let { emailId } = params;
		emailId = Number(emailId);

		const list = await orm(c).select({ ...email, userEmail: user.email })
			.from(email)
			.leftJoin(user, eq(email.userId, user.userId))
			.where(
				and(
					eq(email.isDel, isDel.NORMAL),
					ne(email.status, emailConst.status.SAVING),
					gt(email.emailId, emailId)
				))
			.orderBy(desc(email.emailId))
			.limit(20);

		const emailIds = list.map(item => item.emailId);

		if (emailIds.length > 0) {
			const attsList = await attService.selectByEmailIds(c, emailIds);

			list.forEach(emailRow => {
				const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
				emailRow.attList = atts;
			});
		}

		return list;
	},

	async physicsDelete(c, params) {
		let { emailIds } = params;
		emailIds = emailIds.split(',').map(Number);
		await attService.removeByEmailIds(c, emailIds);
		await starService.removeByEmailIds(c, emailIds);
		await orm(c).delete(email).where(inArray(email.emailId, emailIds)).run();
	},

	async physicsDeleteUserIds(c, userIds) {
		await attService.removeByUserIds(c, userIds);
		await orm(c).delete(email).where(inArray(email.userId, userIds)).run();
	},

	updateEmailStatus(c, params) {
		const { status, resendEmailId, message } = params;
		return orm(c).update(email).set({
			status: status,
			message: message
		}).where(eq(email.resendEmailId, resendEmailId)).returning().get();
	},

	async selectUserEmailCountList(c, userIds, type, del = isDel.NORMAL) {
		const result = await orm(c)
			.select({
				userId: email.userId,
				count: count(email.emailId)
			})
			.from(email)
			.where(and(
				inArray(email.userId, userIds),
				eq(email.type, type),
				eq(email.isDel, del)
			))
			.groupBy(email.userId);
		return result;
	},

	async allList(c, params) {

		let { emailId, size, name, subject, accountEmail, userEmail, type, timeSort, allContent } = params;

		size = Number(size);

		emailId = Number(emailId);
		timeSort = Number(timeSort);

		if (size > 30) {
			size = 30;
		}

		if (!emailId) {

			if (timeSort) {
				emailId = 0;
			} else {
				emailId = 9999999999;
			}

		}

		const conditions = [];


		if (type === 'send') {
			conditions.push(eq(email.type, emailConst.type.SEND));
		}

		if (type === 'receive') {
			conditions.push(eq(email.type, emailConst.type.RECEIVE));
		}

		if (type === 'delete') {
			conditions.push(eq(email.isDel, isDel.DELETE));
		}

		if (type === 'noone') {
			conditions.push(eq(email.status, emailConst.status.NOONE));
		}

		if (userEmail) {
			conditions.push(sql`${user.email} COLLATE NOCASE LIKE ${'%' + userEmail + '%'}`);
		}

		if (accountEmail) {
			conditions.push(
				or(
					sql`${email.toEmail} COLLATE NOCASE LIKE ${'%' + accountEmail + '%'}`,
					sql`${email.sendEmail} COLLATE NOCASE LIKE ${'%' + accountEmail + '%'}`,
				)
			)
		}

		if (name) {
			conditions.push(sql`${email.name} COLLATE NOCASE LIKE ${'%' + name + '%'}`);
		}

		if (subject) {
			conditions.push(sql`${email.subject} COLLATE NOCASE LIKE ${'%' + subject + '%'}`);
		}

		// 新增：全内容搜索功能
		if (allContent) {
			const searchPattern = `%${allContent}%`;
			conditions.push(
				or(
					sql`${email.subject} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.name} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.sendEmail} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.toEmail} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.toName} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.text} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${email.content} COLLATE NOCASE LIKE ${searchPattern}`,
					sql`${user.email} COLLATE NOCASE LIKE ${searchPattern}`
				)
			);
		}

		conditions.push(ne(email.status, emailConst.status.SAVING));

		const countConditions = [...conditions];

		if (timeSort) {
			conditions.push(gt(email.emailId, emailId));
		} else {
			conditions.push(lt(email.emailId, emailId));
		}

		const query = orm(c).select({ ...email, userEmail: user.email })
			.from(email)
			.leftJoin(user, eq(email.userId, user.userId))
			.where(and(...conditions));

		const queryCount = orm(c).select({ total: count() })
			.from(email)
			.leftJoin(user, eq(email.userId, user.userId))
			.where(and(...countConditions));

		if (timeSort) {
			query.orderBy(asc(email.emailId));
		} else {
			query.orderBy(desc(email.emailId));
		}

		const listQuery = await query.limit(size).all();
		const totalQuery = await queryCount.get();

		const [list, totalRow] = await Promise.all([listQuery, totalQuery]);

		const emailIds = list.map(item => item.emailId);
		const attsList = await attService.selectByEmailIds(c, emailIds);

		list.forEach(emailRow => {
			const atts = attsList.filter(attsRow => attsRow.emailId === emailRow.emailId);
			emailRow.attList = atts;
		});

		return { list: list, total: totalRow.total };
	},

	async restoreByUserId(c, userId) {
		await orm(c).update(email).set({ isDel: isDel.NORMAL }).where(eq(email.userId, userId)).run();
	},

	async completeReceive(c, status, emailId) {
		return await orm(c).update(email).set({
			isDel: isDel.NORMAL,
			status: status
		}).where(eq(email.emailId, emailId)).returning().get();
	},

	async batchDelete(c, params) {
		let { sendName, sendEmail, toEmail, subject, startTime, endTime, type  } = params

		let right = type === 'left' || type === 'include'
		let left = type === 'include'

		const conditions = []

		if (sendName) {
			conditions.push(like(email.name,`${left ? '%' : ''}${sendName}${right ? '%' : ''}`))
		}

		if (subject) {
			conditions.push(like(email.subject,`${left ? '%' : ''}${subject}${right ? '%' : ''}`))
		}

		if (sendEmail) {
			conditions.push(like(email.sendEmail,`${left ? '%' : ''}${sendEmail}${right ? '%' : ''}`))
		}

		if (toEmail) {
			conditions.push(like(email.toEmail,`${left ? '%' : ''}${toEmail}${right ? '%' : ''}`))
		}

		if (startTime && endTime) {
			conditions.push(gte(email.createTime,`${startTime}`))
			conditions.push(lte(email.createTime,`${endTime}`))
		}

		if (conditions.length === 0) {
			return;
		}

		const emailIdsRow = await orm(c).select({emailId: email.emailId}).from(email).where(conditions.length > 1 ? and(...conditions) : conditions[0]).all();

		const emailIds = emailIdsRow.map(row => row.emailId);

		if (emailIds.length === 0){
			return;
		}

		await attService.removeByEmailIds(c, emailIds);

		await orm(c).delete(email).where(conditions.length > 1 ? and(...conditions) : conditions[0]).run();
	},

	/**
	 * 清理HTML内容，移除样式标签和属性，防止CSS样式泄露
	 * @param {string} content - 原始HTML内容
	 * @returns {string} - 清理后的HTML内容
	 */
	cleanHtmlContent(content) {
		if (!content || typeof content !== 'string') {
			return content;
		}

		try {
			const { document } = parseHTML(content);

			// 移除所有style、script、title标签及其内容
			document.querySelectorAll('style, script, title').forEach(el => el.remove());

			// 移除所有元素的style属性，防止内联样式泄露
			document.querySelectorAll('*[style]').forEach(el => {
				el.removeAttribute('style');
			});

			// 移除其他可能导致样式泄露的属性
			document.querySelectorAll('*[class]').forEach(el => {
				// 保留一些安全的class，移除可能有问题的class
				const className = el.getAttribute('class');
				if (className && className.includes('External')) {
					el.removeAttribute('class');
				}
			});

			return document.toString();
		} catch (error) {
			console.error('HTML清理失败:', error);
			// 如果解析失败，返回原内容，避免邮件丢失
			return content;
		}
	},

	/**
	 * 获取所有唯一收件邮箱地址(用于白名单导入)
	 * 高性能SQL查询，支持分页和搜索
	 * @param {Object} c - Context
	 * @param {Object} params - 查询参数
	 * @returns {Promise<Object>} - 唯一邮箱列表及统计信息
	 */
	async getUniqueRecipients(c, params = {}) {
		const { userId, search = '', page = 1, pageSize = 100, orderBy = 'email' } = params;

		console.log('[DEBUG SERVICE] userId:', userId, 'typeof:', typeof userId);

		try {
			// 分页计算
			const offset = (parseInt(page) - 1) * parseInt(pageSize);
			const limit = parseInt(pageSize);

			// 构建WHERE条件
			let whereClause = `
				is_del = 0 
				AND type = 0
				AND to_email IS NOT NULL 
				AND to_email != ''
			`;

			// 暂时移除用户ID过滤以测试
			// TODO: 确认是否需要userId过滤
			// if (userId) {
			// 	whereClause += ` AND user_id = ${userId}`;
			// }

			// 添加搜索条件
			// Fix P1-51: 改为子字符串匹配，支持搜索 "abc" 匹配 "test.abc@gmail.com"
			if (search) {
				whereClause += ` AND to_email LIKE '%${search}%'`;
			}

			// 排序字段
			let orderField = 'email ASC';
			if (orderBy === 'count') {
				orderField = 'emailCount DESC';
			} else if (orderBy === 'time') {
				orderField = 'latestReceiveTime DESC';
			}

			// SQL查询：使用DISTINCT去重，按邮箱分组统计邮件数
			const querySQL = `
				SELECT 
					to_email as email,
					COUNT(*) as emailCount,
					MAX(create_time) as latestReceiveTime
				FROM email
				WHERE ${whereClause}
				GROUP BY to_email
				ORDER BY ${orderField}
				LIMIT ${limit} OFFSET ${offset}
			`;

			// 总数查询
			const countSQL = `
				SELECT COUNT(DISTINCT to_email) as total
				FROM email
				WHERE ${whereClause}
			`;

			console.log('[DEBUG] querySQL:', querySQL);
			console.log('[DEBUG] countSQL:', countSQL);

			const [results, countResult] = await Promise.all([
				c.env.db.prepare(querySQL).all(),
				c.env.db.prepare(countSQL).first()
			]);

			console.log('[DEBUG] results:', JSON.stringify(results));
			console.log('[DEBUG] countResult:', JSON.stringify(countResult));
			console.log('[DEBUG] results.results length:', results.results ? results.results.length : 'undefined');
			console.log('[DEBUG] countResult.total:', countResult?.total);

			return {
				list: results.results || [],
				total: countResult?.total || 0,
				page: parseInt(page),
				pageSize: limit
			};

		} catch (error) {
			console.error('Get unique recipients error:', error);
			throw new BizError('获取唯一邮箱列表失败: ' + error.message);
		}
	},

	/**
	 * 标记邮件为已读
	 * @param {Object} c - Hono context
	 * @param {number|string} emailId - 邮件ID
	 * @param {number} userId - 用户ID
	 * @returns {Promise<void>}
	 */
	async markAsRead(c, emailId, userId) {
		emailId = Number(emailId);

		// 验证邮件是否属于当前用户
		const emailRow = await orm(c).select().from(email)
			.where(and(
				eq(email.emailId, emailId),
				eq(email.userId, userId),
				eq(email.isDel, isDel.NORMAL)
			))
			.get();

		if (!emailRow) {
			throw new BizError(t('noUserEmail'));
		}

		// 更新为已读状态，同时增加读取次数
		await orm(c).update(email)
			.set({ 
				isRead: 1,
				readCount: sql`${email.readCount} + 1`
			})
			.where(eq(email.emailId, emailId))
			.run();
	},

	/**
	 * 标记邮件为未读
	 * @param {Object} c - Hono context
	 * @param {number|string} emailId - 邮件ID
	 * @param {number} userId - 用户ID
	 * @returns {Promise<void>}
	 */
	async markAsUnread(c, emailId, userId) {
		emailId = Number(emailId);

		// 验证邮件是否属于当前用户
		const emailRow = await orm(c).select().from(email)
			.where(and(
				eq(email.emailId, emailId),
				eq(email.userId, userId),
				eq(email.isDel, isDel.NORMAL)
			))
			.get();

		if (!emailRow) {
			throw new BizError(t('noUserEmail'));
		}

		// 更新为未读状态
		await orm(c).update(email)
			.set({ isRead: 0 })
			.where(eq(email.emailId, emailId))
			.run();
	},

	/**
	 * 批量标记邮件已读/未读
	 * @param {Object} c - Hono context
	 * @param {Array<number>} emailIds - 邮件ID数组
	 * @param {number} userId - 用户ID
	 * @param {number} isRead - 已读状态 (0=未读, 1=已读)
	 * @returns {Promise<void>}
	 */
	async batchMarkReadStatus(c, emailIds, userId, isRead) {
		if (!Array.isArray(emailIds) || emailIds.length === 0) {
			throw new BizError('邮件ID列表不能为空');
		}

		const emailIdNumbers = emailIds.map(id => Number(id));

		// 验证所有邮件都属于当前用户
		const emails = await orm(c).select({ emailId: email.emailId })
			.from(email)
			.where(and(
				inArray(email.emailId, emailIdNumbers),
				eq(email.userId, userId),
				eq(email.isDel, isDel.NORMAL)
			))
			.all();

		if (emails.length !== emailIdNumbers.length) {
			throw new BizError('部分邮件不存在或无权限操作');
		}

		// 批量更新已读状态
		await orm(c).update(email)
			.set({ isRead: isRead ? 1 : 0 })
			.where(inArray(email.emailId, emailIdNumbers))
			.run();
	}
};

export default emailService;
