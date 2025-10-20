import orm from '../entity/orm';
import { shareAccessLog } from '../entity/share-access-log';
import { share } from '../entity/share';
import { eq, and, desc, sql, like, gte, lte, inArray } from 'drizzle-orm';
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
			emailCount = 0,
			emailIds = [] // 新增：访问时返回的邮件ID列表
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
			emailCount,
			emailIds: JSON.stringify(emailIds) // 保存邮件ID列表
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

		// Fix P1-15: 安全解析JSON字段，处理解析失败的情况
		const logsWithParsedCodes = logs.map(log => {
			let extractedCodes = [];
			let emailIds = [];

			try {
				extractedCodes = JSON.parse(log.extractedCodes || '[]');
				if (!Array.isArray(extractedCodes)) {
					extractedCodes = [];
				}
			} catch (error) {
				console.error('Failed to parse extractedCodes:', log.extractedCodes, error);
				extractedCodes = [];
			}

			try {
				emailIds = JSON.parse(log.emailIds || '[]');
				if (!Array.isArray(emailIds)) {
					emailIds = [];
				}
			} catch (error) {
				console.error('Failed to parse emailIds:', log.emailIds, error);
				emailIds = [];
			}

			return {
				...log,
				extractedCodes,
				emailIds
			};
		});

		return {
			list: logsWithParsedCodes,
			total: totalResult.count,
			page: parseInt(page),
			pageSize: parseInt(pageSize)
		};
	},

	// 获取访问统计数据
	async getAccessStats(c, params) {
		console.error('=== getAccessStats called ===');
		console.error('Params:', params);

		try {
			const { shareId, shareToken, days = 7 } = params;
			const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD HH:mm:ss');

			console.error('Parsed params:', { shareId, shareToken, days, startDate });

			// 构建时间条件
			let whereConditions = [];
			whereConditions.push(gte(shareAccessLog.accessTime, startDate));

			if (shareId) {
				whereConditions.push(eq(shareAccessLog.shareId, shareId));
			}
			if (shareToken) {
				whereConditions.push(eq(shareAccessLog.shareToken, shareToken));
			}

			console.error('Where conditions count:', whereConditions.length);

			// 构建基础条件（使用安全的条件组合方式）
			const baseCondition = whereConditions.length > 0 ? and(...whereConditions) : undefined;

			console.error('Base condition:', baseCondition ? 'defined' : 'undefined');

			// 总访问次数
			console.error('Querying total access...');
			let totalAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
			if (baseCondition) {
				totalAccessQuery = totalAccessQuery.where(baseCondition);
			}
			const totalAccess = await totalAccessQuery.get();
			console.error('Step 3a: totalAccess result:', totalAccess);
			console.error('Total access result:', totalAccess);

		// 成功访问次数
		console.error('Querying success access...');
		let successAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const successConditions = [];
		if (baseCondition) {
			successConditions.push(baseCondition);
		}
		successConditions.push(eq(shareAccessLog.accessResult, 'success'));
		if (successConditions.length > 0) {
			successAccessQuery = successAccessQuery.where(and(...successConditions));
		}
		const successAccess = await successAccessQuery.get();
		console.error('Success access result:', successAccess);

		// 失败访问次数
		console.error('Querying failed access...');
		let failedAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const failedConditions = [];
		if (baseCondition) {
			failedConditions.push(baseCondition);
		}
		failedConditions.push(eq(shareAccessLog.accessResult, 'failed'));
		if (failedConditions.length > 0) {
			failedAccessQuery = failedAccessQuery.where(and(...failedConditions));
		}
		const failedAccess = await failedAccessQuery.get();
		console.error('Failed access result:', failedAccess);

		// 被拒绝访问次数
		console.error('Querying rejected access...');
		let rejectedAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const rejectedConditions = [];
		if (baseCondition) {
			rejectedConditions.push(baseCondition);
		}
		rejectedConditions.push(eq(shareAccessLog.accessResult, 'rejected'));
		if (rejectedConditions.length > 0) {
			rejectedAccessQuery = rejectedAccessQuery.where(and(...rejectedConditions));
		}
		const rejectedAccess = await rejectedAccessQuery.get();
		console.error('Rejected access result:', rejectedAccess);

		// 独立IP数量
		console.error('Querying unique IPs...');
		let uniqueIpsQuery = orm(c).select({
			count: sql`count(distinct ${shareAccessLog.accessIp})`
		}).from(shareAccessLog);
		if (baseCondition) {
			uniqueIpsQuery = uniqueIpsQuery.where(baseCondition);
		}
		const uniqueIps = await uniqueIpsQuery.get();
		console.error('Unique IPs result:', uniqueIps);

		// 平均响应时间
		console.error('Querying avg response time...');
		let avgResponseTimeQuery = orm(c).select({
			avg: sql`avg(${shareAccessLog.responseTime})`
		}).from(shareAccessLog);
		const avgConditions = [];
		if (baseCondition) {
			avgConditions.push(baseCondition);
		}
		avgConditions.push(eq(shareAccessLog.accessResult, 'success'));
		if (avgConditions.length > 0) {
			avgResponseTimeQuery = avgResponseTimeQuery.where(and(...avgConditions));
		}
		const avgResponseTime = await avgResponseTimeQuery.get();
		console.error('Avg response time result:', avgResponseTime);

			const result = {
				totalAccess: totalAccess.count,
				successAccess: successAccess.count,
				failedAccess: failedAccess.count,
				rejectedAccess: rejectedAccess.count,
				uniqueIps: uniqueIps.count,
				avgResponseTime: Math.round(avgResponseTime.avg || 0),
				successRate: totalAccess.count > 0 ?
					Math.round((successAccess.count / totalAccess.count) * 100) : 0
			};

			console.error('=== getAccessStats result ===', result);
			return result;
		} catch (error) {
			console.error('=== getAccessStats error ===');
			console.error('Error message:', error.message);
			console.error('Error stack:', error.stack);
			console.error('Error object:', error);
			throw error;
		}
	},

	// 获取全局统计（所有分享记录的汇总）- 简化版本
	async getGlobalStats(c, params) {
		console.error('=== getGlobalStats called (simplified version) ===');
		console.error('Params:', params);

		try {
			const {
				userId,
				isAdmin,
				days: daysParam = 7,
				startDate,
				endDate,
				page: pageParam = 1,
				pageSize: pageSizeParam = 20
			} = params;

			const days = parseInt(daysParam);
			const page = parseInt(pageParam);
			const pageSize = parseInt(pageSizeParam);

			console.error('Parsed params:', { userId, isAdmin, days, page, pageSize });

			// 构建时间条件
			let timeCondition = null;
			if (startDate) {
				timeCondition = gte(shareAccessLog.accessTime, startDate);
			} else if (days && days > 0) {
				const cutoffDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD HH:mm:ss');
				timeCondition = gte(shareAccessLog.accessTime, cutoffDate);
			}

			console.error('Time condition built:', timeCondition ? 'has condition' : 'no condition');

			// 1. 基础统计 - 简化查询
			console.error('Step 1: Starting basic statistics...');

			// 总访问次数
			let totalAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
			if (timeCondition) {
				totalAccessQuery = totalAccessQuery.where(timeCondition);
			}
			const totalAccess = await totalAccessQuery.get();
			console.error('Total access result:', totalAccess);

		// 成功访问次数
		let successAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const successConditions = [];
		if (timeCondition) {
			successConditions.push(timeCondition);
		}
		successConditions.push(eq(shareAccessLog.accessResult, 'success'));
		if (successConditions.length > 0) {
			successAccessQuery = successAccessQuery.where(and(...successConditions));
		}
		const successAccess = await successAccessQuery.get();
		console.error('Success access result:', successAccess);

		// 失败访问次数
		let failedAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const failedConditions = [];
		if (timeCondition) {
			failedConditions.push(timeCondition);
		}
		failedConditions.push(eq(shareAccessLog.accessResult, 'failed'));
		if (failedConditions.length > 0) {
			failedAccessQuery = failedAccessQuery.where(and(...failedConditions));
		}
		const failedAccess = await failedAccessQuery.get();
		console.error('Failed access result:', failedAccess);

		// 拒绝访问次数
		let rejectedAccessQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		const rejectedConditions = [];
		if (timeCondition) {
			rejectedConditions.push(timeCondition);
		}
		rejectedConditions.push(eq(shareAccessLog.accessResult, 'rejected'));
		if (rejectedConditions.length > 0) {
			rejectedAccessQuery = rejectedAccessQuery.where(and(...rejectedConditions));
		}
		const rejectedAccess = await rejectedAccessQuery.get();
		console.error('Rejected access result:', rejectedAccess);

		// 唯一IP数量
		let uniqueIpsQuery = orm(c).select({ count: sql`count(distinct ${shareAccessLog.accessIp})` }).from(shareAccessLog);
		if (timeCondition) {
			uniqueIpsQuery = uniqueIpsQuery.where(timeCondition);
		}
		const uniqueIps = await uniqueIpsQuery.get();
		console.error('Unique IPs result:', uniqueIps);

		// 总分享数量
		let totalSharesQuery = orm(c).select({ count: sql`count(distinct ${shareAccessLog.shareId})` }).from(shareAccessLog);
		if (timeCondition) {
			totalSharesQuery = totalSharesQuery.where(timeCondition);
		}
		const totalShares = await totalSharesQuery.get();
		console.error('Total shares result:', totalShares);

		// 2. 获取访问日志总数（用于分页）
		console.error('Step 2a: Getting total logs count...');
		let totalLogsQuery = orm(c).select({ count: sql`count(*)` }).from(shareAccessLog);
		if (timeCondition) {
			totalLogsQuery = totalLogsQuery.where(timeCondition);
		}
		const totalLogsResult = await totalLogsQuery.get();
		const totalLogsCount = totalLogsResult.count;
		console.error('Total logs count:', totalLogsCount);

		// 2b. 获取访问日志（分页）
		console.error('Step 2b: Getting access logs...');
		const offset = (page - 1) * pageSize;
		let logsQuery = orm(c).select({
			logId: shareAccessLog.logId,
			shareId: shareAccessLog.shareId,
			shareToken: shareAccessLog.shareToken,
			accessIp: shareAccessLog.accessIp,
			userAgent: shareAccessLog.userAgent,
			accessEmail: shareAccessLog.accessEmail,
			extractedCodes: shareAccessLog.extractedCodes,
			accessResult: shareAccessLog.accessResult,
			errorMessage: shareAccessLog.errorMessage,
			accessTime: shareAccessLog.accessTime,
			responseTime: shareAccessLog.responseTime,
			emailCount: shareAccessLog.emailCount
		}).from(shareAccessLog);
		if (timeCondition) {
			logsQuery = logsQuery.where(timeCondition);
		}
		const logs = await logsQuery
			.orderBy(desc(shareAccessLog.accessTime))
			.limit(pageSize)
			.offset(offset)
			.all();
		console.error('Access logs result count:', logs.length);

		// 3. 处理访问日志数据
		const logsWithParsedCodes = logs.map(log => {
			// 安全解析JSON字段
			let extractedCodes = [];
			try {
				extractedCodes = JSON.parse(log.extractedCodes || '[]');
			} catch (error) {
				console.error('Failed to parse extractedCodes:', log.extractedCodes, error);
				extractedCodes = [];
			}

			return {
				...log,
				extractedCodes
			};
		});

		// 4. 计算成功率
		const successRate = totalAccess.count > 0 ?
			Math.round((successAccess.count / totalAccess.count) * 100) : 0;

		console.error('Step 3: Returning simplified results...');
		return {
			// 基础统计
			totalShares: totalShares.count,
			totalAccess: totalAccess.count,
			successAccess: successAccess.count,
			failedAccess: failedAccess.count,
			rejectedAccess: rejectedAccess.count,
			uniqueIps: uniqueIps.count,
			successRate,

			// 简化的异常统计（暂时为空）
			anomalyStats: {
				highFreqIpCount: 0,
				highFreqShareCount: 0,
				abnormalFailIpCount: 0,
				highFreqIps: [],
				highFreqShares: [],
				abnormalFailIps: []
			},

			// 访问日志
			accessLogs: logsWithParsedCodes,
			total: totalLogsCount,
			page: parseInt(page),
			pageSize: parseInt(pageSize)
		};
	} catch (error) {
		console.error('=== getGlobalStats ERROR ===');
		console.error('Error message:', error.message);
		console.error('Error stack:', error.stack);
		console.error('Error details:', error);
		throw error;
	}
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
