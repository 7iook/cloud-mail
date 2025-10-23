import KvConst from '../const/kv-const';
import setting from '../entity/setting';
import announcementRead from '../entity/announcement-read';
import orm from '../entity/orm';
import { verifyRecordType } from '../const/entity-const';
import fileUtils from '../utils/file-utils';
import r2Service from './r2-service';
import emailService from './email-service';
import accountService from './account-service';
import userService from './user-service';
import constant from '../const/constant';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n'
import verifyRecordService from './verify-record-service';
import { eq, and } from 'drizzle-orm';

const settingService = {

	async refresh(c) {
		const settingRow = await orm(c).select().from(setting).get();
		console.log('[DEBUG refresh] 从数据库读取的设置:', {
			title: settingRow.globalAnnouncementTitle,
			content: settingRow.globalAnnouncementContent ? settingRow.globalAnnouncementContent.substring(0, 50) : null
		});
		settingRow.resendTokens = JSON.parse(settingRow.resendTokens);
		c.set('setting', settingRow);
		// 优雅处理 KV 不可用的情况
		if (c.env.kv) {
			try {
				await c.env.kv.put(KvConst.SETTING, JSON.stringify(settingRow));
				console.log('[DEBUG refresh] KV 写入成功');
			} catch (error) {
				console.warn('KV 写入失败:', error.message);
			}
		} else {
			console.warn('[DEBUG refresh] KV 不可用');
		}
	},

	// 清除缓存
	async clearCache(c) {
		console.log('[DEBUG clearCache] 清除缓存');
		c.set('setting', null);
		if (c.env.kv) {
			try {
				await c.env.kv.delete(KvConst.SETTING);
				console.log('[DEBUG clearCache] KV 缓存已删除');
			} catch (error) {
				console.warn('KV 缓存删除失败:', error.message);
			}
		}
	},

	async query(c) {

		if (c.get?.('setting')) {
			return c.get('setting')
		}

		// 优雅处理 KV 不可用的情况 - 先尝试从 KV 读取，失败则从数据库读取
		let settingData = null;
		if (c.env.kv) {
			try {
				settingData = await c.env.kv.get(KvConst.SETTING, { type: 'json' });
			} catch (error) {
				console.warn('KV 读取失败，将从数据库读取:', error.message);
			}
		}

		// 如果 KV 不可用或读取失败，从数据库读取
		if (!settingData) {
			const settingRow = await orm(c).select().from(setting).get();
			if (settingRow && settingRow.resendTokens) {
				settingRow.resendTokens = JSON.parse(settingRow.resendTokens);
			}
			settingData = settingRow;
		}

		let domainList = c.env.domain;

		if (typeof domainList === 'string') {
			try {
				domainList = JSON.parse(domainList)
			} catch (error) {
				throw new BizError(t('notJsonDomain'));
			}
		}

		if (!c.env.domain) {
			throw new BizError(t('noDomainVariable'));
		}

		domainList = domainList.map(item => '@' + item);
		settingData.domainList = domainList;
		c.set?.('setting', settingData);
		return settingData;
	},

	async get(c, showSiteKey = false) {

		const [settingRow, recordList] = await Promise.all([
			await this.query(c),
			verifyRecordService.selectListByIP(c)
		]);


		if (!showSiteKey) {
			settingRow.siteKey = settingRow.siteKey ? `${settingRow.siteKey.slice(0, 12)}******` : null;
		}

		settingRow.secretKey = settingRow.secretKey ? `${settingRow.secretKey.slice(0, 12)}******` : null;

		Object.keys(settingRow.resendTokens).forEach(key => {
			settingRow.resendTokens[key] = `${settingRow.resendTokens[key].slice(0, 12)}******`;
		});

		settingRow.s3AccessKey = settingRow.s3AccessKey ? `${settingRow.s3AccessKey.slice(0, 12)}******` : null;
		settingRow.s3SecretKey = settingRow.s3SecretKey ? `${settingRow.s3SecretKey.slice(0, 12)}******` : null;
		settingRow.hasR2 = !!c.env.r2

		let regVerifyOpen = false
		let addVerifyOpen = false

		recordList.forEach(row => {
			if (row.type === verifyRecordType.REG) {
				regVerifyOpen = row.count >= settingRow.regVerifyCount
			}
			if (row.type === verifyRecordType.ADD) {
				addVerifyOpen = row.count >= settingRow.addVerifyCount
			}
		})

		settingRow.regVerifyOpen = regVerifyOpen
		settingRow.addVerifyOpen = addVerifyOpen

		return settingRow;
	},

	async set(c, params) {
		const settingData = await this.query(c);
		let resendTokens = { ...settingData.resendTokens, ...params.resendTokens };
		Object.keys(resendTokens).forEach(domain => {
			if (!resendTokens[domain]) delete resendTokens[domain];
		});
		params.resendTokens = JSON.stringify(resendTokens);
		await orm(c).update(setting).set({ ...params }).returning().get();
		await this.refresh(c);
	},

	// 获取全局公告
	async getGlobalAnnouncement(c) {
		const settingData = await this.query(c);

		const title = settingData.globalAnnouncementTitle || '';
		const content = settingData.globalAnnouncementContent;
		const displayMode = settingData.globalAnnouncementDisplayMode || 'always';
		const images = settingData.globalAnnouncementImages ? JSON.parse(settingData.globalAnnouncementImages) : [];

		return {
			title,
			content,
			version: settingData.globalAnnouncementVersion,
			enabled: settingData.globalAnnouncementEnabled === 1,
			displayMode,
			images,
			overrideShareAnnouncement: settingData.globalAnnouncementOverrideShareAnnouncement === 1,
			autoApplyNewShare: settingData.globalAnnouncementAutoApplyNewShare === 1
		};
	},

	// 设置全局公告
	async setGlobalAnnouncement(c, params) {
		try {
			const { title, content, enabled, displayMode, images, overrideShareAnnouncement, autoApplyNewShare } = params;

			console.log('[DEBUG setGlobalAnnouncement] 接收到的参数:', {
				title,
				content,
				enabled,
				displayMode,
				images,
				overrideShareAnnouncement,
				autoApplyNewShare
			});

		// 验证标题长度
		if (title !== null && title !== undefined) {
			if (typeof title !== 'string') {
				throw new BizError('公告标题必须是字符串或null', 400);
			}
			if (title.length > 100) {
				throw new BizError('公告标题不能超过100字符', 400);
			}
		}

		// 验证公告内容长度
		if (content !== null && content !== undefined) {
			if (typeof content !== 'string') {
				throw new BizError('公告内容必须是字符串或null', 400);
			}
			if (content.length > 1000) {
				throw new BizError('公告内容不能超过1000字符', 400);
			}
		}

		// 验证展示模式
		const validDisplayModes = ['always', 'once'];
		if (displayMode && !validDisplayModes.includes(displayMode)) {
			throw new BizError('展示模式必须是 always 或 once', 400);
		}

		// 验证图片
		let imagesJson = '[]';
		if (images && Array.isArray(images)) {
			if (images.length > 10) {
				throw new BizError('图片数量不能超过10张', 400);
			}
			imagesJson = JSON.stringify(images);
		}

		const updateData = {
			globalAnnouncementTitle: title || '',
			globalAnnouncementContent: content || null,
			globalAnnouncementVersion: content ? Date.now() : null,
			globalAnnouncementEnabled: enabled ? 1 : 0,
			globalAnnouncementDisplayMode: displayMode || 'always',
			globalAnnouncementImages: imagesJson,
			globalAnnouncementOverrideShareAnnouncement: overrideShareAnnouncement ? 1 : 0,
			globalAnnouncementAutoApplyNewShare: autoApplyNewShare !== false ? 1 : 0
		};

		console.log('[DEBUG setGlobalAnnouncement] 准备更新的数据:', updateData);

		// 使用.returning().get()执行update操作
		await orm(c).update(setting).set(updateData).returning().get();

		console.log('[DEBUG setGlobalAnnouncement] Update执行完成');

		// 清除缓存，强制重新读取数据库
		await this.clearCache(c);
		await this.refresh(c);

		const result = await this.getGlobalAnnouncement(c);
		console.log('[DEBUG setGlobalAnnouncement] 返回的结果:', result);

		return result;
		} catch (error) {
			console.error('[ERROR setGlobalAnnouncement]:', error);
			throw error;
		}
	},

	async setBackground(c, params) {

		const settingRow = await this.query(c);

		let { background } = params

		if (background && !background.startsWith('http')) {

			if (!await r2Service.hasOSS(c)) {
				throw new BizError(t('noOsUpBack'));
			}

			if (!settingRow.r2Domain) {
				throw new BizError(t('noOsDomainUpBack'));
			}

			const file = fileUtils.base64ToFile(background)

			const arrayBuffer = await file.arrayBuffer();
			background = constant.BACKGROUND_PREFIX + await fileUtils.getBuffHash(arrayBuffer) + fileUtils.getExtFileName(file.name);


			await r2Service.putObj(c, background, arrayBuffer, {
				contentType: file.type,
				cacheControl: `public, max-age=31536000, immutable`,
				contentDisposition: `inline; filename="${file.name}"`
			});

		}

		if (settingRow.background) {
			try {
				await r2Service.delete(c, settingRow.background);
			} catch (e) {
				console.error(e)
			}
		}

		await orm(c).update(setting).set({ background }).run();
		await this.refresh(c);
		return background;
	},

	async websiteConfig(c) {

		const settingRow = await this.get(c, true)

		return {
			register: settingRow.register,
			title: settingRow.title,
			manyEmail: settingRow.manyEmail,
			addEmail: settingRow.addEmail,
			autoRefreshTime: settingRow.autoRefreshTime,
			addEmailVerify: settingRow.addEmailVerify,
			registerVerify: settingRow.registerVerify,
			send: settingRow.send,
			r2Domain: settingRow.r2Domain,
			siteKey: settingRow.siteKey,
			background: settingRow.background,
			loginOpacity: settingRow.loginOpacity,
			domainList: settingRow.domainList,
			regKey: settingRow.regKey,
			regVerifyOpen: settingRow.regVerifyOpen,
			addVerifyOpen: settingRow.addVerifyOpen,
			noticeTitle: settingRow.noticeTitle,
			noticeContent: settingRow.noticeContent,
			noticeType: settingRow.noticeType,
			noticeDuration: settingRow.noticeDuration,
			noticePosition: settingRow.noticePosition,
			noticeWidth: settingRow.noticeWidth,
			noticeOffset: settingRow.noticeOffset,
			notice: settingRow.notice,
			loginDomain: settingRow.loginDomain,
			shareWhitelist: settingRow.shareWhitelist
		};
	},

	// 标记公告为已读
	async markAnnouncementAsRead(c, userId, announcementVersion) {
		try {
			if (!userId || !announcementVersion) {
				throw new BizError('用户ID和公告版本号不能为空', 400);
			}

			// 尝试插入，如果已存在则忽略（UNIQUE 约束）
			await orm(c).insert(announcementRead).values({
				userId: userId,
				announcementVersion: announcementVersion
			}).run();

			return { success: true, message: '公告已标记为已读' };
		} catch (error) {
			// 如果是 UNIQUE 约束冲突，说明已经标记过，返回成功
			if (error.message && error.message.includes('UNIQUE')) {
				return { success: true, message: '公告已标记为已读' };
			}
			throw error;
		}
	},

	// 检查公告是否已读
	async checkAnnouncementRead(c, userId, announcementVersion) {
		try {
			if (!userId || !announcementVersion) {
				return { isRead: false };
			}

			const record = await orm(c).select().from(announcementRead).where(
				and(
					eq(announcementRead.userId, userId),
					eq(announcementRead.announcementVersion, announcementVersion)
				)
			).get();

			return { isRead: !!record };
		} catch (error) {
			console.error('检查公告已读状态失败:', error);
			return { isRead: false };
		}
	}
};

export default settingService;
