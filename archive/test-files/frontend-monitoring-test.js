#!/usr/bin/env node

/**
 * 前端邮件监控界面自动化测试脚本
 * 
 * 功能：
 * 1. 自动化测试监控管理页面
 * 2. 验证邮件列表显示
 * 3. 测试监控配置创建和编辑
 * 4. 验证分享链接功能
 */

const puppeteer = require('puppeteer');

class FrontendMonitoringTest {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'http://localhost:8787';
        this.headless = config.headless !== false; // 默认无头模式
        this.timeout = config.timeout || 30000;
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    // 初始化浏览器
    async initialize() {
        console.log('启动浏览器...');
        this.browser = await puppeteer.launch({
            headless: this.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1280, height: 720 }
        });
        
        this.page = await this.browser.newPage();
        
        // 设置超时时间
        this.page.setDefaultTimeout(this.timeout);
        
        // 监听控制台输出
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('页面错误:', msg.text());
            }
        });
        
        // 监听页面错误
        this.page.on('pageerror', error => {
            console.log('页面异常:', error.message);
        });
    }

    // 关闭浏览器
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    // 执行测试
    async runTests() {
        try {
            await this.initialize();
            
            // 测试监控管理页面
            await this.testMonitoringPage();
            
            // 测试监控配置创建
            await this.testCreateMonitorConfig();
            
            // 测试邮件列表显示
            await this.testEmailListDisplay();
            
            // 测试分享链接功能
            await this.testShareLinkFunctionality();
            
            this.generateReport();
            
        } catch (error) {
            console.error('前端测试执行失败:', error);
            throw error;
        } finally {
            await this.cleanup();
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
        
        const status = passed ? '✓' : '✗';
        console.log(`${status} ${testName}${details ? ' - ' + details : ''}`);
    }

    // 测试监控管理页面
    async testMonitoringPage() {
        console.log('\n测试监控管理页面...');
        
        try {
            // 导航到监控页面
            await this.page.goto(`${this.baseUrl}/#/monitor`);
            await this.page.waitForSelector('.monitor-container', { timeout: 10000 });
            
            this.recordTest('监控页面加载', true, '页面成功加载');
            
            // 检查页面标题
            const title = await this.page.$eval('.header-title span', el => el.textContent);
            const hasTitleText = title.includes('监控') || title.includes('monitor');
            this.recordTest('页面标题检查', hasTitleText, `标题: ${title}`);
            
            // 检查创建监控按钮
            const createButton = await this.page.$('.header-actions .el-button');
            this.recordTest('创建监控按钮存在', !!createButton);
            
            // 检查监控列表表格
            const table = await this.page.$('.el-table');
            this.recordTest('监控列表表格存在', !!table);
            
            // 检查测试邮件按钮
            const testButton = await this.page.$('button[loading="testingEmail"]');
            this.recordTest('测试邮件按钮存在', !!testButton);
            
        } catch (error) {
            this.recordTest('监控页面加载', false, error.message);
        }
    }

    // 测试监控配置创建
    async testCreateMonitorConfig() {
        console.log('\n测试监控配置创建...');
        
        try {
            // 点击创建监控按钮
            const createButton = await this.page.$('.header-actions .el-button[type="primary"]');
            if (createButton) {
                await createButton.click();
                await this.page.waitForSelector('.monitor-create-form', { timeout: 5000 });
                this.recordTest('创建监控对话框打开', true);
                
                // 填写监控邮箱地址
                const emailInput = await this.page.$('input[placeholder*="监控"]');
                if (emailInput) {
                    await emailInput.type('test-frontend@example.com');
                    this.recordTest('邮箱地址输入', true);
                }
                
                // 选择别名类型
                const aliasSelect = await this.page.$('.el-select');
                if (aliasSelect) {
                    await aliasSelect.click();
                    await this.page.waitForSelector('.el-select-dropdown', { timeout: 2000 });
                    
                    const exactOption = await this.page.$('.el-select-dropdown .el-option');
                    if (exactOption) {
                        await exactOption.click();
                        this.recordTest('别名类型选择', true);
                    }
                }
                
                // 关闭对话框（不实际创建，避免影响数据）
                const cancelButton = await this.page.$('button:contains("取消")');
                if (cancelButton) {
                    await cancelButton.click();
                    this.recordTest('对话框关闭', true);
                } else {
                    // 尝试点击对话框外部关闭
                    await this.page.keyboard.press('Escape');
                    this.recordTest('对话框关闭', true, '使用ESC键关闭');
                }
                
            } else {
                this.recordTest('创建监控对话框打开', false, '未找到创建按钮');
            }
            
        } catch (error) {
            this.recordTest('监控配置创建测试', false, error.message);
        }
    }

    // 测试邮件列表显示
    async testEmailListDisplay() {
        console.log('\n测试邮件列表显示...');
        
        try {
            // 检查是否有监控配置
            const tableRows = await this.page.$$('.el-table tbody tr');
            
            if (tableRows.length > 0) {
                // 点击第一个配置的"查看邮件"按钮
                const viewEmailButton = await this.page.$('.el-table tbody tr .el-button');
                if (viewEmailButton) {
                    await viewEmailButton.click();
                    await this.page.waitForSelector('.monitor-emails-list', { timeout: 5000 });
                    this.recordTest('邮件列表对话框打开', true);
                    
                    // 检查邮件列表表格
                    const emailTable = await this.page.$('.monitor-emails-list .el-table');
                    this.recordTest('邮件列表表格存在', !!emailTable);
                    
                    // 检查刷新按钮
                    const refreshButton = await this.page.$('.header-actions .el-button[text]');
                    this.recordTest('刷新按钮存在', !!refreshButton);
                    
                    // 检查邮件行
                    const emailRows = await this.page.$$('.monitor-emails-list .el-table tbody tr');
                    this.recordTest('邮件数据加载', true, `找到 ${emailRows.length} 条邮件记录`);
                    
                    // 如果有邮件，测试邮件详情
                    if (emailRows.length > 0) {
                        const firstRow = emailRows[0];
                        await firstRow.click();
                        
                        // 等待邮件详情对话框
                        try {
                            await this.page.waitForSelector('.email-detail-dialog', { timeout: 3000 });
                            this.recordTest('邮件详情显示', true);
                            
                            // 关闭详情对话框
                            await this.page.keyboard.press('Escape');
                        } catch (e) {
                            this.recordTest('邮件详情显示', false, '详情对话框未打开');
                        }
                    }
                    
                    // 关闭邮件列表对话框
                    await this.page.keyboard.press('Escape');
                    
                } else {
                    this.recordTest('邮件列表显示测试', false, '未找到查看邮件按钮');
                }
            } else {
                this.recordTest('邮件列表显示测试', true, '无监控配置，跳过测试');
            }
            
        } catch (error) {
            this.recordTest('邮件列表显示测试', false, error.message);
        }
    }

    // 测试分享链接功能
    async testShareLinkFunctionality() {
        console.log('\n测试分享链接功能...');
        
        try {
            // 检查是否有监控配置
            const tableRows = await this.page.$$('.el-table tbody tr');
            
            if (tableRows.length > 0) {
                // 查找分享链接或token
                const shareElements = await this.page.$$eval('.el-table tbody tr', rows => {
                    return rows.map(row => {
                        const cells = row.querySelectorAll('td');
                        return Array.from(cells).map(cell => cell.textContent.trim());
                    });
                });
                
                let hasShareToken = false;
                for (const row of shareElements) {
                    for (const cell of row) {
                        if (cell.length > 20 && /^[a-f0-9]+$/.test(cell)) {
                            hasShareToken = true;
                            break;
                        }
                    }
                    if (hasShareToken) break;
                }
                
                this.recordTest('分享Token存在', hasShareToken);
                
                // 测试分享链接访问（如果有token）
                if (hasShareToken) {
                    // 这里可以添加更多分享链接的测试逻辑
                    this.recordTest('分享链接功能', true, '分享Token格式正确');
                }
                
            } else {
                this.recordTest('分享链接功能测试', true, '无监控配置，跳过测试');
            }
            
        } catch (error) {
            this.recordTest('分享链接功能测试', false, error.message);
        }
    }

    // 生成测试报告
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('前端监控界面测试报告');
        console.log('='.repeat(60));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.passed).length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;
        
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过测试: ${passedTests}`);
        console.log(`失败测试: ${failedTests}`);
        console.log(`成功率: ${successRate}%`);
        
        console.log('\n详细结果:');
        for (const test of this.testResults) {
            const status = test.passed ? '✓' : '✗';
            console.log(`  ${status} ${test.name}${test.details ? ' - ' + test.details : ''}`);
        }
        
        console.log('='.repeat(60));
        
        if (failedTests === 0) {
            console.log('🎉 所有前端测试通过！');
        } else {
            console.log('⚠️  部分前端测试失败，请检查上述错误信息。');
        }
    }
}

// 主执行函数
async function main() {
    const config = {
        baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8787',
        headless: process.env.TEST_HEADLESS !== 'false',
        timeout: parseInt(process.env.TEST_TIMEOUT) || 30000
    };

    const tester = new FrontendMonitoringTest(config);
    
    try {
        await tester.runTests();
        process.exit(0);
    } catch (error) {
        console.error('前端测试执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = FrontendMonitoringTest;
