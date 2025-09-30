import orm from '../entity/orm';
import { shareAccessLog } from '../entity/share-access-log';
import { eq, and, desc, sql, like, gte, lte } from 'drizzle-orm';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import dayjs from 'dayjs';

const shareAccessLogService = {

	// 记录访问日志
	async recordAccess(c, logData) {
		const {
			shareId,
			shareToken,
			accessIp,
			userAgent,
			accessEmail,
			extractedCodes = [],
			accessResult,
			errorMessage = '',
			responseTime = 0,
			emailCount = 0
		} = logData;

		const logRecord = {
			shareId,
			shareToken,
			accessIp,
			userAgent: userAgent || '',
			accessEmail,
			extractedCodes: JSON.stringify(extractedCodes),
			accessResult,
			errorMessage,
			responseTime,
			emailCount
		};

		return await orm(c).insert(shareAccessLog).values(logRecord).returning().get();
	},

	// 获取分享的访问日志列表
	async getAccessLogs(c, params) {
		const {
			shareId,
			shareToken,
			accessResult,
			accessEmail,
			startDate,
			endDate,
			page = 1,
			pageSize = 20
		} = params;

		const offset = (page - 1) * pageSize;
		let whereConditions = [];

		// 构建查询条件
		if (shareId) {
			whereConditions.push(eq(shareAccessLog.shareId, shareId));
		}
		if (shareToken) {
			whereConditions.push(eq(shareAccessLog.shareToken, shareToken));
		}
		if (accessResult) {
			whereConditions.push(eq(shareAccessLog.accessResult, accessResult));
		}
		if (accessEmail) {
			whereConditions.push(like(shareAccessLog.accessEmail, `%${accessEmail}%`));
		}
		if (startDate) {
			whereConditions.push(gte(shareAccessLog.accessTime, startDate));
		}
		if (endDate) {
			whereConditions.push(lte(shareAccessLog.accessTime, endDate));
		}

		// 查询日志列表
		const logs = await orm(c).select().from(shareAccessLog)
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
			.orderBy(desc(shareAccessLog.accessTime))
			.limit(pageSize)
			.offset(offset)
			.all();

		// 查询总数
		const totalResult = await orm(c).select({ count: sql`count(*)` }).from(shareAccessLog)
			.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
			.get();

		// 解析提取的验证码
		const logsWithParsedCodes = logs.map(log => ({
			...log,
			extractedCodes: JSON.parse(log.extractedCodes || '[]')
		}));

		return {
			list: logsWithParsedCodes,
			total: totalResult.count,
			page: parseInt(page),
			pageSize: parseInt(pageSize)
		};
	},

	// 获取访问统计数据
	async getAccessStats(c, params) {
		const { shareId, shareToken, days = 7 } = params;
		const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD HH:mm:ss');

		let whereConditions = [
			gte(shareAccessLog.accessTime, startDate)
		];

		if (shareId) {
			whereConditions.push(eq(shareAccessLog.shareId, shareId));
		}
		if (shareToken) {
			whereConditions.push(eq(shareAccessLog.shareToken, shareToken));
		}

		// 总访问次数
		const totalAccess = await orm(c).select({ count: sql`count(*)` }).from(shareAccessLog)
			.where(and(...whereConditions))
			.get();

		// 成功访问次数
		const successAccess = await orm(c).select({ count: sql`count(*)` }).from(shareAccessLog)
			.where(and(...whereConditions, eq(shareAccessLog.accessResult, 'success')))
			.get();

		// 失败访问次数
		const failedAccess = await orm(c).select({ count: sql`count(*)` }).from(shareAccessLog)
			.where(and(...whereConditions, eq(shareAccessLog.accessResult, 'failed')))
			.get();

		// 被拒绝访问次数
		const rejectedAccess = await orm(c).select({ count: sql`count(*)` }).from(shareAccessLog)
			.where(and(...whereConditions, eq(shareAccessLog.accessResult, 'rejected')))
			.get();

		// 独立IP数量
		const uniqueIps = await orm(c).select({ 
			count: sql`count(distinct ${shareAccessLog.accessIp})` 
		}).from(shareAccessLog)
			.where(and(...whereConditions))
			.get();

		// 平均响应时间
		const avgResponseTime = await orm(c).select({ 
			avg: sql`avg(${shareAccessLog.responseTime})` 
		}).from(shareAccessLog)
			.where(and(...whereConditions, eq(shareAccessLog.accessResult, 'success')))
			.get();

		return {
			totalAccess: totalAccess.count,
			successAccess: successAccess.count,
			failedAccess: failedAccess.count,
			rejectedAccess: rejectedAccess.count,
			uniqueIps: uniqueIps.count,
			avgResponseTime: Math.round(avgResponseTime.avg || 0),
			successRate: totalAccess.count > 0 ? 
				Math.round((successAccess.count / totalAccess.count) * 100) : 0
		};
	},

	// 清理过期日志（可选，用于定期清理）
	async cleanupOldLogs(c, daysToKeep = 30) {
		const cutoffDate = dayjs().subtract(daysToKeep, 'day').format('YYYY-MM-DD HH:mm:ss');
		
		const result = await orm(c).delete(shareAccessLog)
			.where(lte(shareAccessLog.accessTime, cutoffDate))
			.run();

		return result.changes || 0;
	}
};

export default shareAccessLogService;
