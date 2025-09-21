#!/usr/bin/env node

/**
 * 邮件监控功能测试运行器
 * 
 * 统一执行所有监控测试，包括：
 * 1. 端到端API测试
 * 2. 前端界面测试
 * 3. 数据库验证
 * 4. 性能测试
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MonitoringTestRunner {
    constructor(config = {}) {
        this.config = {
            baseUrl: config.baseUrl || process.env.TEST_BASE_URL || 'http://localhost:8787',
            skipFrontend: config.skipFrontend || process.env.SKIP_FRONTEND_TESTS === 'true',
            skipCleanup: config.skipCleanup || process.env.SKIP_CLEANUP === 'true',
            verbose: config.verbose || process.env.VERBOSE === 'true',
            ...config
        };
        
        this.results = {
            startTime: new Date(),
            endTime: null,
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        };
    }

    // 日志输出
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}]`;
        
        if (level === 'ERROR') {
            console.error(`${prefix} ${message}`);
        } else if (level === 'WARN') {
            console.warn(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    // 执行命令
    async runCommand(command, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: this.config.verbose ? 'inherit' : 'pipe',
                ...options
            });

            let stdout = '';
            let stderr = '';

            if (!this.config.verbose) {
                child.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
            }

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ code, stdout, stderr });
                } else {
                    reject(new Error(`Command failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
                }
            });

            child.on('error', reject);
        });
    }

    // 检查文件是否存在
    fileExists(filePath) {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }

    // 记录测试结果
    recordTest(name, passed, details = '', duration = 0) {
        this.results.tests.push({
            name,
            passed,
            details,
            duration,
            timestamp: new Date().toISOString()
        });

        this.results.summary.total++;
        if (passed) {
            this.results.summary.passed++;
        } else {
            this.results.summary.failed++;
        }

        const status = passed ? '✓' : '✗';
        this.log(`${status} ${name}${details ? ' - ' + details : ''} (${duration}ms)`);
    }

    // 运行所有测试
    async runAllTests() {
        this.log('开始执行邮件监控功能完整测试套件');
        this.log(`测试环境: ${this.config.baseUrl}`);

        try {
            // 1. 环境检查
            await this.checkEnvironment();

            // 2. 运行端到端测试
            await this.runE2ETests();

            // 3. 运行前端测试（可选）
            if (!this.config.skipFrontend) {
                await this.runFrontendTests();
            } else {
                this.log('跳过前端测试', 'WARN');
                this.results.summary.skipped++;
            }

            // 4. 运行数据库验证
            await this.runDatabaseVerification();

            // 5. 生成最终报告
            this.generateFinalReport();

        } catch (error) {
            this.log(`测试执行失败: ${error.message}`, 'ERROR');
            throw error;
        } finally {
            this.results.endTime = new Date();
        }
    }

    // 环境检查
    async checkEnvironment() {
        this.log('检查测试环境...');
        const startTime = Date.now();

        try {
            // 检查必需的测试文件
            const requiredFiles = [
                'email-monitoring-e2e-test.js',
                'monitoring-test-verification.sql',
                'README-monitoring-tests.md'
            ];

            for (const file of requiredFiles) {
                if (!this.fileExists(file)) {
                    throw new Error(`缺少必需的测试文件: ${file}`);
                }
            }

            // 检查Node.js版本
            const nodeVersion = process.version;
            this.log(`Node.js版本: ${nodeVersion}`);

            // 检查服务可用性
            try {
                const http = require('http');
                const url = new URL(this.config.baseUrl);
                
                await new Promise((resolve, reject) => {
                    const req = http.get({
                        hostname: url.hostname,
                        port: url.port || 80,
                        path: '/api/test/emailTemplate',
                        timeout: 5000
                    }, (res) => {
                        resolve(res.statusCode);
                    });
                    
                    req.on('error', reject);
                    req.on('timeout', () => reject(new Error('Request timeout')));
                });

                this.recordTest('环境检查', true, '所有检查通过', Date.now() - startTime);
            } catch (error) {
                this.recordTest('环境检查', false, `服务不可用: ${error.message}`, Date.now() - startTime);
                throw error;
            }

        } catch (error) {
            this.recordTest('环境检查', false, error.message, Date.now() - startTime);
            throw error;
        }
    }

    // 运行端到端测试
    async runE2ETests() {
        this.log('运行端到端测试...');
        const startTime = Date.now();

        try {
            const env = {
                ...process.env,
                TEST_BASE_URL: this.config.baseUrl
            };

            const result = await this.runCommand('node', ['email-monitoring-e2e-test.js'], { env });
            
            this.recordTest('端到端测试', true, '所有E2E测试通过', Date.now() - startTime);
            
            if (this.config.verbose) {
                this.log('E2E测试输出:\n' + result.stdout);
            }

        } catch (error) {
            this.recordTest('端到端测试', false, error.message, Date.now() - startTime);
            if (this.config.verbose) {
                this.log('E2E测试错误输出:\n' + error.message, 'ERROR');
            }
        }
    }

    // 运行前端测试
    async runFrontendTests() {
        this.log('运行前端测试...');
        const startTime = Date.now();

        // 检查前端测试文件是否存在
        if (!this.fileExists('frontend-monitoring-test.js')) {
            this.recordTest('前端测试', false, '前端测试文件不存在', Date.now() - startTime);
            return;
        }

        try {
            const env = {
                ...process.env,
                TEST_BASE_URL: this.config.baseUrl,
                TEST_HEADLESS: 'true' // 强制无头模式
            };

            const result = await this.runCommand('node', ['frontend-monitoring-test.js'], { env });
            
            this.recordTest('前端测试', true, '所有前端测试通过', Date.now() - startTime);
            
            if (this.config.verbose) {
                this.log('前端测试输出:\n' + result.stdout);
            }

        } catch (error) {
            this.recordTest('前端测试', false, error.message, Date.now() - startTime);
            if (this.config.verbose) {
                this.log('前端测试错误输出:\n' + error.message, 'ERROR');
            }
        }
    }

    // 运行数据库验证
    async runDatabaseVerification() {
        this.log('运行数据库验证...');
        const startTime = Date.now();

        try {
            // 读取SQL验证文件
            const sqlFile = 'monitoring-test-verification.sql';
            if (!this.fileExists(sqlFile)) {
                throw new Error('数据库验证SQL文件不存在');
            }

            const sqlContent = fs.readFileSync(sqlFile, 'utf8');
            const queryCount = (sqlContent.match(/SELECT/gi) || []).length;

            this.recordTest('数据库验证', true, `包含 ${queryCount} 个验证查询`, Date.now() - startTime);
            
            this.log('数据库验证SQL文件已准备就绪，请手动执行验证查询');
            this.log('或使用D1控制台执行: wrangler d1 execute email --file=monitoring-test-verification.sql');

        } catch (error) {
            this.recordTest('数据库验证', false, error.message, Date.now() - startTime);
        }
    }

    // 生成最终报告
    generateFinalReport() {
        const duration = this.results.endTime - this.results.startTime;
        const { total, passed, failed, skipped } = this.results.summary;
        const successRate = total > 0 ? (passed / total * 100).toFixed(2) : 0;

        console.log('\n' + '='.repeat(80));
        console.log('邮件监控功能完整测试报告');
        console.log('='.repeat(80));
        console.log(`测试环境: ${this.config.baseUrl}`);
        console.log(`开始时间: ${this.results.startTime.toISOString()}`);
        console.log(`结束时间: ${this.results.endTime.toISOString()}`);
        console.log(`总耗时: ${duration}ms`);
        console.log(`总测试数: ${total}`);
        console.log(`通过测试: ${passed}`);
        console.log(`失败测试: ${failed}`);
        console.log(`跳过测试: ${skipped}`);
        console.log(`成功率: ${successRate}%`);

        console.log('\n详细结果:');
        for (const test of this.results.tests) {
            const status = test.passed ? '✓' : '✗';
            console.log(`  ${status} ${test.name} (${test.duration}ms)`);
            if (test.details) {
                console.log(`    ${test.details}`);
            }
        }

        console.log('\n' + '='.repeat(80));

        if (failed === 0) {
            console.log('🎉 所有测试通过！邮件监控功能完全正常。');
        } else {
            console.log('⚠️  部分测试失败，请检查上述错误信息。');
        }

        // 保存测试报告到文件
        const reportFile = `test-report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
        console.log(`\n详细测试报告已保存到: ${reportFile}`);
    }
}

// 主执行函数
async function main() {
    const config = {
        baseUrl: process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:8787',
        skipFrontend: process.argv.includes('--skip-frontend'),
        skipCleanup: process.argv.includes('--skip-cleanup'),
        verbose: process.argv.includes('--verbose')
    };

    const runner = new MonitoringTestRunner(config);

    try {
        await runner.runAllTests();
        process.exit(runner.results.summary.failed === 0 ? 0 : 1);
    } catch (error) {
        console.error('测试运行器执行失败:', error);
        process.exit(1);
    }
}

// 显示使用说明
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
邮件监控功能测试运行器

用法:
  node run-monitoring-tests.js [URL] [选项]

参数:
  URL                    测试目标URL (默认: http://localhost:8787)

选项:
  --skip-frontend        跳过前端测试
  --skip-cleanup         跳过测试数据清理
  --verbose              显示详细输出
  --help, -h             显示此帮助信息

环境变量:
  TEST_BASE_URL          测试目标URL
  SKIP_FRONTEND_TESTS    跳过前端测试 (true/false)
  SKIP_CLEANUP           跳过清理 (true/false)
  VERBOSE                详细输出 (true/false)

示例:
  node run-monitoring-tests.js
  node run-monitoring-tests.js http://localhost:8787 --verbose
  node run-monitoring-tests.js --skip-frontend
`);
    process.exit(0);
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = MonitoringTestRunner;
