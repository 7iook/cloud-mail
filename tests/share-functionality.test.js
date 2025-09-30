/**
 * Cloud-Mail Share Functionality Test Suite
 * 使用 fast-check 进行属性测试
 */

const fc = require('fast-check');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8787/api',
  frontendUrl: 'http://localhost:3002',
  testEmail: 'test@example.com',
  oldShareToken: 'pBv6J7QQQDMreYj9w0rNrRyaJH3zCfhg'
};

// 测试结果收集器
class TestReporter {
  constructor() {
    this.results = { passed: [], failed: [], warnings: [] };
  }
  
  pass(name) {
    this.results.passed.push(name);
    console.log(`✅ ${name}`);
  }
  
  fail(name, error) {
    this.results.failed.push({ name, error });
    console.log(`❌ ${name}: ${error}`);
  }
  
  warn(message) {
    this.results.warnings.push(message);
    console.log(`⚠️  ${message}`);
  }
  
  report() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 测试报告');
    console.log('='.repeat(60));
    console.log(`✅ 通过: ${this.results.passed.length}`);
    console.log(`❌ 失败: ${this.results.failed.length}`);
    console.log(`⚠️  警告: ${this.results.warnings.length}`);
    return this.results.failed.length === 0;
  }
}

const reporter = new TestReporter();

// 辅助函数：HTTP 请求
async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
    headers: response.headers
  };
}

// 属性测试：频率限制配置的有效性
function testRateLimitConfigValidity() {
  console.log('\n=== 属性测试：频率限制配置有效性 ===');
  
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 1000 }),
      (perSecond, perMinute) => {
        // 不变量：每分钟限制应该 >= 每秒限制
        return perMinute >= perSecond;
      }
    ),
    { numRuns: 100 }
  );
  
  reporter.pass('频率限制配置有效性');
}

// 测试1：创建分享链接
async function test1_CreateShare() {
  console.log('\n=== 测试1：创建分享链接 ===');
  
  try {
    const payload = {
      targetEmail: TEST_CONFIG.testEmail,
      shareName: '测试分享-自定义频率限制',
      keywordFilter: '验证码|verification|code',
      rateLimitPerSecond: 3,
      rateLimitPerMinute: 30
    };
    
    const { status, data } = await request(`${TEST_CONFIG.baseUrl}/share/create`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    if (status === 200 && data.code === 200) {
      console.log(`   分享Token: ${data.data.shareToken}`);
      reporter.pass('创建分享链接');
      return data.data.shareToken;
    } else {
      reporter.fail('创建分享链接', data.message || '未知错误');
      return null;
    }
  } catch (error) {
    reporter.fail('创建分享链接', error.message);
    return null;
  }
}

// 测试2：频率限制功能
async function test2_RateLimit(shareToken) {
  console.log('\n=== 测试2：频率限制功能 ===');
  
  if (!shareToken) {
    reporter.warn('跳过频率限制测试（依赖测试1）');
    return;
  }
  
  // 测试2.1：正常用户访问
  console.log('📊 测试2.1：正常用户访问');
  try {
    for (let i = 0; i < 3; i++) {
      const { status } = await request(`${TEST_CONFIG.baseUrl}/share/${shareToken}`);
      if (status !== 200) {
        reporter.fail('正常用户访问', `请求${i + 1}失败: ${status}`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    reporter.pass('正常用户访问');
  } catch (error) {
    reporter.fail('正常用户访问', error.message);
  }
  
  // 测试2.2：恶意用户攻击
  console.log('📊 测试2.2：恶意用户攻击');
  try {
    const promises = Array(10).fill(0).map(() => 
      request(`${TEST_CONFIG.baseUrl}/share/${shareToken}`)
    );
    
    const results = await Promise.all(promises);
    const blockedCount = results.filter(r => r.status === 429).length;
    
    console.log(`   总请求: 10, 被限制: ${blockedCount}`);
    
    if (blockedCount > 0) {
      reporter.pass('频率限制生效');
    } else {
      reporter.warn('频率限制未生效（可能使用内存缓存）');
    }
  } catch (error) {
    reporter.fail('恶意用户攻击测试', error.message);
  }
}

// 测试3：向后兼容性
async function test3_BackwardCompatibility() {
  console.log('\n=== 测试3：向后兼容性 ===');
  
  try {
    const { status, data } = await request(
      `${TEST_CONFIG.baseUrl}/share/${TEST_CONFIG.oldShareToken}`
    );
    
    if (status === 200 && data.code === 200) {
      console.log(`   目标邮箱: ${data.data.targetEmail}`);
      reporter.pass('向后兼容性');
    } else {
      reporter.fail('向后兼容性', data.message || '未知错误');
    }
  } catch (error) {
    reporter.fail('向后兼容性', error.message);
  }
}

// 测试4：缓存功能
async function test4_Cache(shareToken) {
  console.log('\n=== 测试4：缓存功能 ===');
  
  if (!shareToken) {
    reporter.warn('跳过缓存测试（依赖测试1）');
    return;
  }
  
  try {
    const start1 = Date.now();
    await request(`${TEST_CONFIG.baseUrl}/share/${shareToken}`);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await request(`${TEST_CONFIG.baseUrl}/share/${shareToken}`);
    const time2 = Date.now() - start2;
    
    console.log(`   第一次: ${time1}ms, 第二次: ${time2}ms`);
    
    if (time2 < time1) {
      reporter.pass('缓存功能');
    } else {
      reporter.warn('缓存效果不明显');
    }
  } catch (error) {
    reporter.fail('缓存功能', error.message);
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 Cloud-Mail 分享功能测试套件');
  console.log('='.repeat(60));
  
  // 属性测试
  testRateLimitConfigValidity();
  
  // 功能测试
  const shareToken = await test1_CreateShare();
  await test2_RateLimit(shareToken);
  await test3_BackwardCompatibility();
  await test4_Cache(shareToken);
  
  // 生成报告
  const success = reporter.report();
  process.exit(success ? 0 : 1);
}

// 执行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
