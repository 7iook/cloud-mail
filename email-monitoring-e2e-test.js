#!/usr/bin/env node

/**
 * 邮件监控功能端到端测试脚本
 * 
 * 功能：
 * 1. 创建测试监控配置
 * 2. 模拟邮件数据插入
 * 3. 验证监控匹配逻辑
 * 4. 检查数据库记录
 * 5. 验证前端界面显示
 * 6. 清理测试数据
 */

const https = require('https');
const http = require('http');

class EmailMonitoringE2ETest {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:8787';
        this.apiPrefix = config.apiPrefix || '/api';
        this.testResults = {
            startTime: new Date().toISOString(),
            endTime: null,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            testDetails: []
        };
    }

    // HTTP请求工具方法
    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + this.apiPrefix + path);
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'EmailMonitoringE2ETest/1.0'
                }
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const client = url.protocol === 'https:' ? https : http;
            const req = client.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve({
                            statusCode: res.statusCode,
                            data: parsed
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            data: responseData
                        });
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    // 日志输出
    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    // 执行完整的端到端测试
    async runCompleteTest() {
        this.log('开始执行邮件监控功能端到端测试');

        try {
            // 步骤1: 准备测试环境
            await this.prepareTestEnvironment();

            // 步骤2: 创建测试监控配置
            await this.createTestMonitorConfigs();

            // 步骤3: 执行综合监控测试
            await this.executeComprehensiveTest();

            // 步骤4: 验证数据库记录
            await this.verifyDatabaseRecords();

            // 步骤5: 测试前端API
            await this.testFrontendAPIs();

            // 步骤6: 清理测试数据
            await this.cleanupTestData();

            this.testResults.endTime = new Date().toISOString();
            this.generateTestReport();

        } catch (error) {
            this.log(`测试执行失败: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    // 准备测试环境
    async prepareTestEnvironment() {
        this.log('准备测试环境...');
        
        // 清理之前的测试数据
        try {
            await this.makeRequest('DELETE', '/test/monitoring/cleanup');
            this.log('清理旧测试数据完成');
        } catch (error) {
            this.log(`清理旧数据失败: ${error.message}`, 'WARN');
        }
    }

    // 创建测试监控配置
    async createTestMonitorConfigs() {
        this.log('创建测试监控配置...');

        const testConfigs = [
            {
                emailAddress: 'test@example.com',
                aliasType: 'exact',
                filterConfig: {}
            },
            {
                emailAddress: 'test+monitoring@gmail.com',
                aliasType: 'gmail_alias',
                filterConfig: {}
            },
            {
                emailAddress: '*@example.com',
                aliasType: 'domain_wildcard',
                filterConfig: {}
            }
        ];

        for (const config of testConfigs) {
            try {
                const response = await this.makeRequest('POST', '/monitor/create', config);
                if (response.statusCode === 200) {
                    this.log(`监控配置创建成功: ${config.emailAddress}`);
                } else {
                    this.log(`监控配置创建失败: ${config.emailAddress} - ${JSON.stringify(response.data)}`, 'WARN');
                }
            } catch (error) {
                this.log(`创建监控配置异常: ${config.emailAddress} - ${error.message}`, 'ERROR');
            }
        }
    }

    // 执行综合监控测试
    async executeComprehensiveTest() {
        this.log('执行综合监控测试...');

        try {
            const response = await this.makeRequest('POST', '/test/monitoring/comprehensive');
            
            if (response.statusCode === 200 && response.data.success) {
                const testResults = response.data.data;
                this.log(`综合测试完成 - 总计: ${testResults.summary.total}, 通过: ${testResults.summary.passed}, 失败: ${testResults.summary.failed}`);
                
                // 记录详细结果
                for (const scenario of testResults.scenarios) {
                    this.testResults.totalTests++;
                    if (scenario.passed) {
                        this.testResults.passedTests++;
                        this.log(`✓ ${scenario.description} - 通过`);
                    } else {
                        this.testResults.failedTests++;
                        this.log(`✗ ${scenario.description} - 失败: ${scenario.errors.join(', ')}`, 'ERROR');
                    }
                    
                    this.testResults.testDetails.push({
                        name: scenario.name,
                        description: scenario.description,
                        passed: scenario.passed,
                        emailId: scenario.emailId,
                        matchCount: scenario.monitorMatches.length,
                        errors: scenario.errors
                    });
                }

                // 保存测试结果供后续验证使用
                this.comprehensiveTestResults = testResults;
                
            } else {
                throw new Error(`综合测试失败: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            this.log(`综合测试执行异常: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    // 验证数据库记录
    async verifyDatabaseRecords() {
        this.log('验证数据库记录...');

        if (!this.comprehensiveTestResults) {
            this.log('跳过数据库验证 - 无综合测试结果', 'WARN');
            return;
        }

        for (const scenario of this.comprehensiveTestResults.scenarios) {
            if (scenario.emailId) {
                try {
                    const response = await this.makeRequest('GET', `/test/monitoring/verify/${scenario.emailId}`);
                    
                    if (response.statusCode === 200 && response.data.success) {
                        const verification = response.data.data;
                        this.log(`数据库验证 - ${scenario.name}: 邮件ID ${verification.emailId}, 匹配数量 ${verification.summary.totalMatches}`);
                        
                        // 验证数据完整性
                        if (verification.emailDetails && verification.emailDetails.recipient) {
                            this.log(`  收件人数据格式正确: ${JSON.stringify(verification.emailDetails.recipient)}`);
                        }
                        
                        if (verification.monitorMatches.length > 0) {
                            for (const match of verification.monitorMatches) {
                                this.log(`  匹配记录: ${match.matchedAddress} (${match.matchType})`);
                            }
                        }
                        
                    } else {
                        this.log(`数据库验证失败 - ${scenario.name}: ${JSON.stringify(response.data)}`, 'ERROR');
                    }
                } catch (error) {
                    this.log(`数据库验证异常 - ${scenario.name}: ${error.message}`, 'ERROR');
                }
            }
        }
    }

    // 测试前端API
    async testFrontendAPIs() {
        this.log('测试前端API...');

        try {
            // 测试监控配置列表API
            const listResponse = await this.makeRequest('GET', '/monitor/list?size=10');
            if (listResponse.statusCode === 200) {
                this.log('监控配置列表API测试通过');
            } else {
                this.log(`监控配置列表API测试失败: ${JSON.stringify(listResponse.data)}`, 'ERROR');
            }

            // 测试分享token API（需要先获取配置）
            if (listResponse.statusCode === 200 && listResponse.data.success) {
                const configs = listResponse.data.data;
                if (configs.length > 0) {
                    const config = configs[0];
                    if (config.shareToken) {
                        const shareResponse = await this.makeRequest('GET', `/monitor/share/${config.shareToken}`);
                        if (shareResponse.statusCode === 200) {
                            this.log('分享token API测试通过');
                            
                            // 测试分享邮件列表API
                            const emailsResponse = await this.makeRequest('GET', `/monitor/share/${config.shareToken}/emails?size=10`);
                            if (emailsResponse.statusCode === 200) {
                                this.log('分享邮件列表API测试通过');
                            } else {
                                this.log(`分享邮件列表API测试失败: ${JSON.stringify(emailsResponse.data)}`, 'ERROR');
                            }
                        } else {
                            this.log(`分享token API测试失败: ${JSON.stringify(shareResponse.data)}`, 'ERROR');
                        }
                    }
                }
            }

        } catch (error) {
            this.log(`前端API测试异常: ${error.message}`, 'ERROR');
        }
    }

    // 清理测试数据
    async cleanupTestData() {
        this.log('清理测试数据...');

        try {
            const response = await this.makeRequest('DELETE', '/test/monitoring/cleanup');
            if (response.statusCode === 200) {
                this.log(`测试数据清理完成: ${JSON.stringify(response.data.data)}`);
            } else {
                this.log(`测试数据清理失败: ${JSON.stringify(response.data)}`, 'WARN');
            }
        } catch (error) {
            this.log(`测试数据清理异常: ${error.message}`, 'WARN');
        }
    }

    // 生成测试报告
    generateTestReport() {
        this.log('生成测试报告...');

        const duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);
        const successRate = this.testResults.totalTests > 0 ? 
            (this.testResults.passedTests / this.testResults.totalTests * 100).toFixed(2) : 0;

        console.log('\n' + '='.repeat(80));
        console.log('邮件监控功能端到端测试报告');
        console.log('='.repeat(80));
        console.log(`开始时间: ${this.testResults.startTime}`);
        console.log(`结束时间: ${this.testResults.endTime}`);
        console.log(`测试耗时: ${duration}ms`);
        console.log(`总测试数: ${this.testResults.totalTests}`);
        console.log(`通过测试: ${this.testResults.passedTests}`);
        console.log(`失败测试: ${this.testResults.failedTests}`);
        console.log(`成功率: ${successRate}%`);
        console.log('\n详细结果:');
        
        for (const detail of this.testResults.testDetails) {
            const status = detail.passed ? '✓ 通过' : '✗ 失败';
            console.log(`  ${status} - ${detail.description}`);
            if (detail.emailId) {
                console.log(`    邮件ID: ${detail.emailId}, 匹配数量: ${detail.matchCount}`);
            }
            if (detail.errors.length > 0) {
                console.log(`    错误: ${detail.errors.join(', ')}`);
            }
        }
        
        console.log('='.repeat(80));
        
        if (this.testResults.failedTests === 0) {
            console.log('🎉 所有测试通过！邮件监控功能工作正常。');
        } else {
            console.log('⚠️  部分测试失败，请检查上述错误信息。');
        }
    }
}

// 主执行函数
async function main() {
    const config = {
        baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8787',
        apiPrefix: process.env.TEST_API_PREFIX || '/api'
    };

    const tester = new EmailMonitoringE2ETest(config);
    
    try {
        await tester.runCompleteTest();
        process.exit(0);
    } catch (error) {
        console.error('测试执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = EmailMonitoringE2ETest;
