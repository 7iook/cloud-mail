import app from '../hono/hono';
import orm from '../entity/orm';
import monitorConfig from '../entity/monitor-config';
import monitorEmail from '../entity/monitor-email';
import email from '../entity/email';
import result from '../model/result';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import { isDel } from '../const/entity-const';

/**
 * 监控系统健康检查API
 * 提供监控功能状态、性能指标和故障诊断信息
 */

// 监控系统健康检查
app.get('/monitor/health', async (c) => {
	try {
		const healthChecks = {
			timestamp: new Date().toISOString(),
			status: 'healthy',
			checks: {
				database: { status: 'unknown', details: {} },
				monitorConfigs: { status: 'unknown', details: {} },
				recentMatches: { status: 'unknown', details: {} },
				indexes: { status: 'unknown', details: {} }
			},
			metrics: {
				totalConfigs: 0,
				activeConfigs: 0,
				recentMatches: 0,
				avgMatchDelay: null
			}
		};

		// 检查1: 数据库连接
		try {
			await c.env.db.prepare('SELECT 1').first();
			healthChecks.checks.database.status = 'healthy';
		} catch (error) {
			healthChecks.checks.database.status = 'unhealthy';
			healthChecks.checks.database.details.error = error.message;
			healthChecks.status = 'unhealthy';
		}

		// 检查2: 监控配置状态
		try {
			const configStats = await orm(c).select({
				total: count(),
			}).from(monitorConfig)
			.where(eq(monitorConfig.isDel, isDel.NORMAL))
			.get();

			const activeStats = await orm(c).select({
				active: count(),
			}).from(monitorConfig)
			.where(and(
				eq(monitorConfig.isDel, isDel.NORMAL),
				eq(monitorConfig.isActive, 1)
			))
			.get();

			healthChecks.metrics.totalConfigs = configStats.total;
			healthChecks.metrics.activeConfigs = activeStats.active;
			healthChecks.checks.monitorConfigs.status = 'healthy';
			healthChecks.checks.monitorConfigs.details = {
				totalConfigs: configStats.total,
				activeConfigs: activeStats.active
			};
		} catch (error) {
			healthChecks.checks.monitorConfigs.status = 'unhealthy';
			healthChecks.checks.monitorConfigs.details.error = error.message;
			healthChecks.status = 'unhealthy';
		}

		// 检查3: 最近的监控匹配活动
		try {
			const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
			
			const recentMatches = await orm(c).select({
				count: count(),
			}).from(monitorEmail)
			.where(and(
				eq(monitorEmail.isDel, isDel.NORMAL),
				gte(monitorEmail.createTime, oneDayAgo)
			))
			.get();

			healthChecks.metrics.recentMatches = recentMatches.count;
			healthChecks.checks.recentMatches.status = 'healthy';
			healthChecks.checks.recentMatches.details = {
				last24Hours: recentMatches.count
			};
		} catch (error) {
			healthChecks.checks.recentMatches.status = 'unhealthy';
			healthChecks.checks.recentMatches.details.error = error.message;
		}

		// 检查4: 数据库索引状态
		try {
			const indexes = await c.env.db.prepare(`
				SELECT name FROM sqlite_master 
				WHERE type='index' AND name LIKE 'idx_monitor%'
			`).all();

			const expectedIndexes = [
				'idx_monitor_config_active',
				'idx_monitor_config_active_lookup',
				'idx_monitor_email_config_id',
				'idx_monitor_email_email_id',
				'idx_monitor_email_create_time',
				'idx_monitor_email_lookup'
			];

			const existingIndexes = indexes.results.map(idx => idx.name);
			const missingIndexes = expectedIndexes.filter(idx => !existingIndexes.includes(idx));

			if (missingIndexes.length === 0) {
				healthChecks.checks.indexes.status = 'healthy';
			} else {
				healthChecks.checks.indexes.status = 'warning';
				healthChecks.checks.indexes.details.missingIndexes = missingIndexes;
			}

			healthChecks.checks.indexes.details.existingIndexes = existingIndexes;
		} catch (error) {
			healthChecks.checks.indexes.status = 'unhealthy';
			healthChecks.checks.indexes.details.error = error.message;
		}

		// 计算整体健康状态
		const checkStatuses = Object.values(healthChecks.checks).map(check => check.status);
		if (checkStatuses.includes('unhealthy')) {
			healthChecks.status = 'unhealthy';
		} else if (checkStatuses.includes('warning')) {
			healthChecks.status = 'warning';
		}

		return c.json(result.ok(healthChecks));

	} catch (error) {
		console.error('Monitor health check failed:', error);
		return c.json(result.fail({
			message: 'Health check failed',
			error: error.message,
			timestamp: new Date().toISOString()
		}));
	}
});

// 监控性能指标
app.get('/monitor/metrics', async (c) => {
	try {
		const metrics = {
			timestamp: new Date().toISOString(),
			performance: {},
			activity: {},
			errors: {}
		};

		// 性能指标：平均匹配延迟
		try {
			const recentMatches = await c.env.db.prepare(`
				SELECT 
					AVG(ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2)) as avg_delay_seconds,
					COUNT(*) as total_matches
				FROM monitor_email me
				JOIN email e ON me.email_id = e.email_id
				WHERE me.create_time >= datetime('now', '-1 hour')
				AND me.is_del = 0
			`).first();

			metrics.performance.avgMatchDelaySeconds = recentMatches.avg_delay_seconds;
			metrics.performance.recentMatchesCount = recentMatches.total_matches;
		} catch (error) {
			metrics.errors.performanceMetrics = error.message;
		}

		// 活动指标：按时间段统计
		try {
			const activityStats = await c.env.db.prepare(`
				SELECT 
					DATE(create_time) as date,
					COUNT(*) as matches_count
				FROM monitor_email 
				WHERE create_time >= datetime('now', '-7 days')
				AND is_del = 0
				GROUP BY DATE(create_time)
				ORDER BY date DESC
			`).all();

			metrics.activity.last7Days = activityStats.results;
		} catch (error) {
			metrics.errors.activityStats = error.message;
		}

		// 配置使用统计
		try {
			const configUsage = await c.env.db.prepare(`
				SELECT 
					mc.email_address,
					mc.alias_type,
					COUNT(me.monitor_email_id) as match_count,
					MAX(me.create_time) as last_match
				FROM monitor_config mc
				LEFT JOIN monitor_email me ON mc.config_id = me.config_id AND me.is_del = 0
				WHERE mc.is_del = 0 AND mc.is_active = 1
				GROUP BY mc.config_id
				ORDER BY match_count DESC
				LIMIT 10
			`).all();

			metrics.activity.topConfigs = configUsage.results;
		} catch (error) {
			metrics.errors.configUsage = error.message;
		}

		return c.json(result.ok(metrics));

	} catch (error) {
		console.error('Monitor metrics failed:', error);
		return c.json(result.fail({
			message: 'Metrics collection failed',
			error: error.message
		}));
	}
});

// 监控故障诊断
app.get('/monitor/diagnostics', async (c) => {
	try {
		const diagnostics = {
			timestamp: new Date().toISOString(),
			issues: [],
			recommendations: []
		};

		// 检查是否有长时间未匹配的活跃配置
		try {
			const staleConfigs = await c.env.db.prepare(`
				SELECT 
					mc.config_id,
					mc.email_address,
					mc.create_time,
					MAX(me.create_time) as last_match
				FROM monitor_config mc
				LEFT JOIN monitor_email me ON mc.config_id = me.config_id AND me.is_del = 0
				WHERE mc.is_del = 0 AND mc.is_active = 1
				AND mc.create_time < datetime('now', '-7 days')
				GROUP BY mc.config_id
				HAVING (last_match IS NULL OR last_match < datetime('now', '-7 days'))
				ORDER BY mc.create_time ASC
			`).all();

			if (staleConfigs.results.length > 0) {
				diagnostics.issues.push({
					type: 'stale_configs',
					severity: 'warning',
					message: `Found ${staleConfigs.results.length} monitoring configs with no recent matches`,
					details: staleConfigs.results
				});
				
				diagnostics.recommendations.push({
					type: 'review_configs',
					message: 'Review monitoring configurations that haven\'t matched any emails recently'
				});
			}
		} catch (error) {
			diagnostics.issues.push({
				type: 'diagnostic_error',
				severity: 'error',
				message: 'Failed to check for stale configurations',
				error: error.message
			});
		}

		// 检查是否有异常的匹配延迟
		try {
			const slowMatches = await c.env.db.prepare(`
				SELECT 
					e.email_id,
					e.subject,
					me.create_time as match_time,
					e.create_time as email_time,
					ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2) as delay_seconds
				FROM monitor_email me
				JOIN email e ON me.email_id = e.email_id
				WHERE me.create_time >= datetime('now', '-1 hour')
				AND me.is_del = 0
				AND ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2) > 10
				ORDER BY delay_seconds DESC
				LIMIT 5
			`).all();

			if (slowMatches.results.length > 0) {
				diagnostics.issues.push({
					type: 'slow_matches',
					severity: 'warning',
					message: `Found ${slowMatches.results.length} matches with delays > 10 seconds`,
					details: slowMatches.results
				});
				
				diagnostics.recommendations.push({
					type: 'performance_optimization',
					message: 'Consider optimizing monitoring performance or checking system load'
				});
			}
		} catch (error) {
			diagnostics.issues.push({
				type: 'diagnostic_error',
				severity: 'error',
				message: 'Failed to check match delays',
				error: error.message
			});
		}

		return c.json(result.ok(diagnostics));

	} catch (error) {
		console.error('Monitor diagnostics failed:', error);
		return c.json(result.fail({
			message: 'Diagnostics failed',
			error: error.message
		}));
	}
});
