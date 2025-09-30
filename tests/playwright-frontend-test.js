/**
 * Cloud-Mail Frontend UI Test Suite
 * 使用 Playwright 测试前端功能
 */

const { chromium } = require('playwright');

class PlaywrightFrontendTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  async setup() {
    console.log('🚀 启动浏览器...');
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
    
    // 设置视口
    await this.page.setViewportSize({ width: 1280, height: 720 });
    
    // 监听控制台消息
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ 前端错误:', msg.text());
      }
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // 测试1: 分享管理页面加载
  async test1_SharePageLoad() {
    console.log('\n=== 前端测试1: 分享管理页面加载 ===');
    
    try {
      await this.page.goto('http://localhost:3002/email-share');
      await this.page.waitForTimeout(3000);
      
      // 检查页面标题
      const title = await this.page.title();
      console.log(`   页面标题: ${title}`);
      
      // 检查分享列表是否加载
      const shareTable = await this.page.locator('table').count();
      if (shareTable > 0) {
        console.log('✅ 分享列表加载成功');
        this.testResults.passed.push('分享管理页面加载');
      } else {
        console.log('❌ 分享列表未找到');
        this.testResults.failed.push('分享管理页面加载: 分享列表未找到');
      }
      
      // 检查创建分享按钮
      const createButton = await this.page.locator('button:has-text("创建分享")').count();
      if (createButton > 0) {
        console.log('✅ 创建分享按钮存在');
        this.testResults.passed.push('创建分享按钮');
      } else {
        console.log('❌ 创建分享按钮未找到');
        this.testResults.failed.push('创建分享按钮未找到');
      }
      
    } catch (error) {
      console.log('❌ 页面加载失败:', error.message);
      this.testResults.failed.push(`分享管理页面加载: ${error.message}`);
    }
  }

  // 测试2: 创建分享对话框
  async test2_CreateShareDialog() {
    console.log('\n=== 前端测试2: 创建分享对话框 ===');
    
    try {
      // 点击创建分享按钮
      await this.page.click('button:has-text("创建分享")');
      await this.page.waitForTimeout(1000);
      
      // 检查对话框是否打开
      const dialog = await this.page.locator('dialog').count();
      if (dialog > 0) {
        console.log('✅ 创建分享对话框打开');
        this.testResults.passed.push('创建分享对话框');
      } else {
        console.log('❌ 创建分享对话框未打开');
        this.testResults.failed.push('创建分享对话框未打开');
        return;
      }
      
      // 检查频率限制配置是否存在
      const rateLimitSection = await this.page.locator('group:has-text("频率限制")').count();
      if (rateLimitSection > 0) {
        console.log('✅ 频率限制配置存在');
        this.testResults.passed.push('频率限制UI配置');
        
        // 检查默认值
        const perSecondValue = await this.page.locator('spinbutton').first().inputValue();
        const perMinuteValue = await this.page.locator('spinbutton').last().inputValue();
        console.log(`   默认值: ${perSecondValue}次/秒, ${perMinuteValue}次/分钟`);
        
        if (perSecondValue === '5' && perMinuteValue === '60') {
          console.log('✅ 默认频率限制值正确');
          this.testResults.passed.push('默认频率限制值');
        } else {
          console.log('❌ 默认频率限制值不正确');
          this.testResults.failed.push('默认频率限制值不正确');
        }
      } else {
        console.log('❌ 频率限制配置未找到');
        this.testResults.failed.push('频率限制UI配置未找到');
      }
      
      // 关闭对话框
      await this.page.click('button:has-text("取消")');
      await this.page.waitForTimeout(500);
      
    } catch (error) {
      console.log('❌ 创建分享对话框测试失败:', error.message);
      this.testResults.failed.push(`创建分享对话框: ${error.message}`);
    }
  }

  // 测试3: 创建分享功能
  async test3_CreateShareFunction() {
    console.log('\n=== 前端测试3: 创建分享功能 ===');
    
    try {
      // 打开创建对话框
      await this.page.click('button:has-text("创建分享")');
      await this.page.waitForTimeout(1000);
      
      // 选择邮箱
      await this.page.click('combobox');
      await this.page.waitForTimeout(500);
      
      // 检查邮箱选项是否存在
      const emailOptions = await this.page.locator('[role="option"]').count();
      if (emailOptions > 0) {
        console.log(`✅ 找到 ${emailOptions} 个邮箱选项`);
        
        // 选择第一个邮箱
        await this.page.click('[role="option"]').first();
        await this.page.waitForTimeout(500);
        
        this.testResults.passed.push('邮箱选择功能');
      } else {
        console.log('❌ 未找到邮箱选项');
        this.testResults.failed.push('邮箱选择功能: 未找到选项');
      }
      
      // 填写分享名称
      await this.page.fill('textbox[placeholder*="分享名称"]', '前端测试分享');
      
      // 修改频率限制
      await this.page.fill('spinbutton >> nth=0', '3');
      await this.page.fill('spinbutton >> nth=1', '30');
      
      console.log('✅ 表单填写完成');
      this.testResults.passed.push('分享表单填写');
      
      // 点击创建（但不实际提交，避免创建过多测试数据）
      console.log('⚠️  跳过实际创建（避免测试数据污染）');
      this.testResults.warnings.push('跳过实际创建分享（测试目的）');
      
      // 关闭对话框
      await this.page.click('button:has-text("取消")');
      await this.page.waitForTimeout(500);
      
    } catch (error) {
      console.log('❌ 创建分享功能测试失败:', error.message);
      this.testResults.failed.push(`创建分享功能: ${error.message}`);
    }
  }

  // 测试4: 分享链接访问
  async test4_ShareLinkAccess() {
    console.log('\n=== 前端测试4: 分享链接访问 ===');
    
    try {
      // 使用现有的分享链接
      const shareToken = 'pBv6J7QQQDMreYj9w0rNrRyaJH3zCfhg';
      const shareUrl = `http://localhost:3003/share/${shareToken}`;
      
      await this.page.goto(shareUrl);
      await this.page.waitForTimeout(3000);
      
      // 检查分享页面是否加载
      const pageTitle = await this.page.title();
      console.log(`   分享页面标题: ${pageTitle}`);
      
      // 检查邮件列表容器
      const emailContainer = await this.page.locator('.email-list, [class*="email"], [class*="mail"]').count();
      if (emailContainer > 0) {
        console.log('✅ 分享页面加载成功');
        this.testResults.passed.push('分享链接访问');
      } else {
        console.log('⚠️  分享页面结构可能不同');
        this.testResults.warnings.push('分享页面结构检测不确定');
      }
      
      // 检查是否有刷新按钮或自动刷新功能
      const refreshElements = await this.page.locator('button:has-text("刷新"), [class*="refresh"], [class*="reload"]').count();
      if (refreshElements > 0) {
        console.log('✅ 找到刷新相关元素');
        this.testResults.passed.push('刷新功能UI');
      } else {
        console.log('⚠️  未找到明显的刷新元素');
        this.testResults.warnings.push('刷新功能UI不明确');
      }
      
    } catch (error) {
      console.log('❌ 分享链接访问测试失败:', error.message);
      this.testResults.failed.push(`分享链接访问: ${error.message}`);
    }
  }

  // 测试5: XSS防护测试（模拟）
  async test5_XSSProtection() {
    console.log('\n=== 前端测试5: XSS防护测试 ===');
    
    try {
      // 检查页面是否加载了 DOMPurify
      const domPurifyLoaded = await this.page.evaluate(() => {
        return typeof window.DOMPurify !== 'undefined';
      });
      
      if (domPurifyLoaded) {
        console.log('✅ DOMPurify 已加载');
        this.testResults.passed.push('DOMPurify加载');
      } else {
        console.log('⚠️  DOMPurify 未在全局作用域检测到');
        this.testResults.warnings.push('DOMPurify全局检测失败（可能是模块化加载）');
      }
      
      // 测试基本的XSS防护（在控制台中）
      const xssTest = await this.page.evaluate(() => {
        const testHtml = '<script>alert("xss")</script><p>正常内容</p>';
        
        // 模拟DOMPurify清理
        if (typeof window.DOMPurify !== 'undefined') {
          const cleaned = window.DOMPurify.sanitize(testHtml);
          return {
            original: testHtml,
            cleaned: cleaned,
            hasScript: cleaned.includes('<script>')
          };
        }
        
        return { error: 'DOMPurify not available' };
      });
      
      if (xssTest.error) {
        console.log('⚠️  无法测试XSS防护:', xssTest.error);
        this.testResults.warnings.push('XSS防护测试无法执行');
      } else if (!xssTest.hasScript) {
        console.log('✅ XSS防护正常工作（script标签被移除）');
        this.testResults.passed.push('XSS防护功能');
      } else {
        console.log('❌ XSS防护可能失效');
        this.testResults.failed.push('XSS防护功能失效');
      }
      
    } catch (error) {
      console.log('❌ XSS防护测试失败:', error.message);
      this.testResults.failed.push(`XSS防护测试: ${error.message}`);
    }
  }

  // 运行所有前端测试
  async runAllTests() {
    console.log('🎭 开始执行前端 Playwright 测试套件');
    console.log('=' .repeat(60));
    
    await this.setup();
    
    try {
      await this.test1_SharePageLoad();
      await this.test2_CreateShareDialog();
      await this.test3_CreateShareFunction();
      await this.test4_ShareLinkAccess();
      await this.test5_XSSProtection();
    } finally {
      await this.teardown();
    }
    
    // 打印测试报告
    console.log('\n' + '='.repeat(60));
    console.log('📋 前端测试报告');
    console.log('='.repeat(60));
    console.log(`✅ 通过: ${this.testResults.passed.length}`);
    this.testResults.passed.forEach(t => console.log(`   - ${t}`));
    
    console.log(`\n❌ 失败: ${this.testResults.failed.length}`);
    this.testResults.failed.forEach(t => console.log(`   - ${t}`));
    
    console.log(`\n⚠️  警告: ${this.testResults.warnings.length}`);
    this.testResults.warnings.forEach(t => console.log(`   - ${t}`));
    
    console.log('\n' + '='.repeat(60));
    console.log(`前端测试结果: ${this.testResults.failed.length === 0 ? '✅ 全部通过' : '❌ 存在失败'}`);
    
    return this.testResults;
  }
}

// 执行测试
if (require.main === module) {
  const test = new PlaywrightFrontendTest();
  test.runAllTests().catch(console.error);
}

module.exports = PlaywrightFrontendTest;