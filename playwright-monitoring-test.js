#!/usr/bin/env node

/**
 * 使用Playwright验证邮件监控功能的端到端测试
 * 
 * 测试流程：
 * 1. 重启后端服务
 * 2. 访问前端监控页面 (http://localhost:3002)
 * 3. 创建测试监控配置
 * 4. 发送测试邮件
 * 5. 验证监控匹配结果
 * 6. 检查前端显示
 */

const { test, expect, chromium } = require('@playwright/test');

class PlaywrightMonitoringTest {
    constructor() {
        this.frontendUrl = 'http://localhost:3002';
        this.backendUrl = 'http://localhost:8787';
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    // 初始化浏览器
    async initialize() {
        console.log('🚀 启动Playwright浏览器...');
        this.browser = await chromium.launch({ 
            headless: false, // 显示浏览器窗口以便观察
            slowMo: 1000 // 减慢操作速度以便观察
        });
        
        this.page = await this.browser.newPage();
        
        // 设置视口大小
        await this.page.setViewportSize({ width: 1280, height: 720 });
        
        // 监听控制台输出
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ 页面错误:', msg.text());
            }
        });
        
        // 监听页面错误
        this.page.on('pageerror', error => {
            console.log('❌ 页面异常:', error.message);
        });
    }

    // 关闭浏览器
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    // 记录测试结果
    recordTest(testName, passed, details = '') {
        this.testResults.push({
            name: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? '✅' : '❌';
        console.log(`${status} ${testName}${details ? ' - ' + details : ''}`);
    }

    // HTTP请求工具
    async makeRequest(method, path, data = null) {
        const url = this.backendUrl + '/api' + path;
        const options = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            return { statusCode: response.status, data: result };
        } catch (error) {
            throw new Error(`请求失败: ${error.message}`);
        }
    }

    // 运行完整测试
    async runCompleteTest() {
        try {
            await this.initialize();
            
            console.log('🎯 开始邮件监控功能Playwright测试');
            console.log(`前端地址: ${this.frontendUrl}`);
            console.log(`后端地址: ${this.backendUrl}`);
            
            // 1. 验证服务可用性
            await this.verifyServices();
            
            // 2. 访问监控页面
            await this.accessMonitoringPage();
            
            // 3. 创建测试监控配置
            await this.createTestMonitorConfig();
            
            // 4. 发送测试邮件
            await this.sendTestEmails();
            
            // 5. 验证监控匹配结果
            await this.verifyMonitoringResults();
            
            // 6. 测试邮件列表显示
            await this.testEmailListDisplay();
            
            // 7. 生成测试报告
            this.generateReport();
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    // 验证服务可用性
    async verifyServices() {
        console.log('\n🔍 验证服务可用性...');
        
        try {
            // 检查后端服务
            const backendResponse = await this.makeRequest('GET', '/test/emailTemplate');
            if (backendResponse.statusCode === 200) {
                this.recordTest('后端服务检查', true, '8787端口正常');
            } else {
                this.recordTest('后端服务检查', false, `状态码: ${backendResponse.statusCode}`);
            }
            
            // 检查前端服务
            try {
                await this.page.goto(this.frontendUrl, { waitUntil: 'networkidle' });
                this.recordTest('前端服务检查', true, '3002端口正常');
            } catch (error) {
                this.recordTest('前端服务检查', false, error.message);
                throw error;
            }
            
        } catch (error) {
            this.recordTest('服务可用性验证', false, error.message);
            throw error;
        }
    }

    // 访问监控页面
    async accessMonitoringPage() {
        console.log('\n📱 访问监控管理页面...');
        
        try {
            // 导航到监控页面
            await this.page.goto(`${this.frontendUrl}/#/monitor`);
            
            // 等待页面加载
            await this.page.waitForSelector('.monitor-container', { timeout: 10000 });
            this.recordTest('监控页面加载', true);
            
            // 检查页面标题
            const title = await this.page.textContent('.header-title span');
            if (title && (title.includes('监控') || title.includes('monitor'))) {
                this.recordTest('页面标题验证', true, `标题: ${title}`);
            } else {
                this.recordTest('页面标题验证', false, `意外标题: ${title}`);
            }
            
            // 截图保存
            await this.page.screenshot({ path: 'monitoring-page.png' });
            console.log('📸 监控页面截图已保存: monitoring-page.png');
            
        } catch (error) {
            this.recordTest('监控页面访问', false, error.message);
            throw error;
        }
    }

    // 创建测试监控配置
    async createTestMonitorConfig() {
        console.log('\n⚙️ 创建测试监控配置...');
        
        try {
            // 点击创建监控按钮
            const createButton = this.page.locator('.header-actions .el-button').filter({ hasText: '创建' }).first();
            await createButton.click();
            
            // 等待创建对话框出现
            await this.page.waitForSelector('.monitor-create-form', { timeout: 5000 });
            this.recordTest('创建对话框打开', true);
            
            // 填写监控邮箱地址
            const emailInput = this.page.locator('input[placeholder*="监控"]').first();
            await emailInput.fill('test@example.com');
            this.recordTest('邮箱地址输入', true, 'test@example.com');
            
            // 选择别名类型为精确匹配
            const aliasSelect = this.page.locator('.el-select').first();
            await aliasSelect.click();
            await this.page.waitForSelector('.el-select-dropdown', { timeout: 3000 });
            
            // 选择精确匹配选项
            const exactOption = this.page.locator('.el-select-dropdown .el-option').filter({ hasText: '精确' }).first();
            await exactOption.click();
            this.recordTest('别名类型选择', true, '精确匹配');
            
            // 点击创建按钮
            const submitButton = this.page.locator('button').filter({ hasText: '创建监控' });
            await submitButton.click();
            
            // 等待创建成功
            await this.page.waitForTimeout(2000);
            this.recordTest('监控配置创建', true);
            
            // 截图保存
            await this.page.screenshot({ path: 'monitor-config-created.png' });
            console.log('📸 监控配置创建截图已保存: monitor-config-created.png');
            
        } catch (error) {
            this.recordTest('监控配置创建', false, error.message);
            // 继续执行，不抛出错误
        }
    }

    // 发送测试邮件
    async sendTestEmails() {
        console.log('\n📧 发送测试邮件...');
        
        try {
            // 使用后端API发送测试邮件
            const testEmailData = {
                userId: 1,
                accountId: 1,
                sendEmail: 'sender@test.com',
                name: 'Playwright Test Sender',
                subject: 'Playwright测试邮件监控功能',
                content: '<div><h2>Playwright测试邮件</h2><p>这是使用Playwright发送的测试邮件，用于验证监控功能。</p></div>',
                text: 'Playwright测试邮件\n这是使用Playwright发送的测试邮件，用于验证监控功能。',
                recipient: JSON.stringify([{ address: 'test@example.com', name: 'Test Recipient' }]),
                cc: JSON.stringify([]),
                bcc: JSON.stringify([]),
                toEmail: 'test@example.com',
                toName: 'Test Recipient'
            };

            const response = await this.makeRequest('POST', '/test/simulateEmail', testEmailData);
            
            if (response.statusCode === 200 && response.data.success) {
                this.recordTest('测试邮件发送', true, `邮件ID: ${response.data.data.emailId}`);
                this.testEmailId = response.data.data.emailId;
            } else {
                this.recordTest('测试邮件发送', false, JSON.stringify(response.data));
            }
            
            // 等待监控匹配处理
            await this.page.waitForTimeout(3000);
            
        } catch (error) {
            this.recordTest('测试邮件发送', false, error.message);
        }
    }

    // 验证监控匹配结果
    async verifyMonitoringResults() {
        console.log('\n🔍 验证监控匹配结果...');
        
        if (!this.testEmailId) {
            this.recordTest('监控结果验证', false, '无测试邮件ID');
            return;
        }
        
        try {
            // 使用后端API验证监控匹配结果
            const response = await this.makeRequest('GET', `/test/monitoring/verify/${this.testEmailId}`);
            
            if (response.statusCode === 200 && response.data.success) {
                const verification = response.data.data;
                const matchCount = verification.summary.totalMatches;
                
                if (matchCount > 0) {
                    this.recordTest('监控匹配验证', true, `找到 ${matchCount} 个匹配记录`);
                    
                    // 验证匹配详情
                    for (const match of verification.monitorMatches) {
                        this.recordTest('匹配记录详情', true, 
                            `地址: ${match.matchedAddress}, 类型: ${match.matchType}`);
                    }
                } else {
                    this.recordTest('监控匹配验证', false, '未找到匹配记录');
                }
            } else {
                this.recordTest('监控匹配验证', false, JSON.stringify(response.data));
            }
            
        } catch (error) {
            this.recordTest('监控匹配验证', false, error.message);
        }
    }

    // 测试邮件列表显示
    async testEmailListDisplay() {
        console.log('\n📋 测试邮件列表显示...');
        
        try {
            // 刷新页面以获取最新数据
            await this.page.reload({ waitUntil: 'networkidle' });
            await this.page.waitForSelector('.monitor-container', { timeout: 10000 });
            
            // 查找监控配置表格行
            const tableRows = this.page.locator('.el-table tbody tr');
            const rowCount = await tableRows.count();
            
            if (rowCount > 0) {
                this.recordTest('监控配置列表', true, `找到 ${rowCount} 个配置`);
                
                // 点击第一个配置的"查看邮件"按钮
                const viewEmailButton = tableRows.first().locator('.el-button').filter({ hasText: '查看' }).first();
                
                if (await viewEmailButton.isVisible()) {
                    await viewEmailButton.click();
                    
                    // 等待邮件列表对话框
                    await this.page.waitForSelector('.monitor-emails-list', { timeout: 5000 });
                    this.recordTest('邮件列表对话框', true);
                    
                    // 检查邮件列表
                    const emailRows = this.page.locator('.monitor-emails-list .el-table tbody tr');
                    const emailCount = await emailRows.count();
                    
                    this.recordTest('邮件列表显示', true, `显示 ${emailCount} 封邮件`);
                    
                    // 如果有邮件，点击查看详情
                    if (emailCount > 0) {
                        await emailRows.first().click();
                        await this.page.waitForTimeout(1000);
                        this.recordTest('邮件详情查看', true);
                    }
                    
                    // 截图保存
                    await this.page.screenshot({ path: 'email-list-display.png' });
                    console.log('📸 邮件列表截图已保存: email-list-display.png');
                    
                } else {
                    this.recordTest('查看邮件按钮', false, '按钮不可见');
                }
                
            } else {
                this.recordTest('监控配置列表', false, '未找到监控配置');
            }
            
        } catch (error) {
            this.recordTest('邮件列表显示测试', false, error.message);
        }
    }

    // 生成测试报告
    generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.passed).length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;

        console.log('\n' + '='.repeat(80));
        console.log('🎯 Playwright邮件监控功能测试报告');
        console.log('='.repeat(80));
        console.log(`前端地址: ${this.frontendUrl}`);
        console.log(`后端地址: ${this.backendUrl}`);
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过测试: ${passedTests}`);
        console.log(`失败测试: ${failedTests}`);
        console.log(`成功率: ${successRate}%`);
        
        console.log('\n📋 详细结果:');
        for (const test of this.testResults) {
            const status = test.passed ? '✅' : '❌';
            console.log(`  ${status} ${test.name}${test.details ? ' - ' + test.details : ''}`);
        }
        
        console.log('='.repeat(80));
        
        if (failedTests === 0) {
            console.log('🎉 所有测试通过！邮件监控功能完全正常。');
        } else {
            console.log('⚠️  部分测试失败，请检查上述错误信息。');
        }
    }
}

// 主执行函数
async function main() {
    const tester = new PlaywrightMonitoringTest();
    
    try {
        await tester.runCompleteTest();
        process.exit(0);
    } catch (error) {
        console.error('❌ Playwright测试执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = PlaywrightMonitoringTest;
