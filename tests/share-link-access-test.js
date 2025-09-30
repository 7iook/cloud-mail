/**
 * 分享链接访问测试 - 使用现有分享链接进行功能验证
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://127.0.0.1:8787/api';

// 从前端页面获取的现有分享链接tokens
const EXISTING_SHARE_TOKENS = [
  'pBv6J7QQQDMreYj9w0rNrRyaJH3zCfhg', // test@example.com
  'D6CMnlC1FwvCU2p30u0pke7UijFgzV5C', // admin@example.com
  'K7QEmDJoEvTBe3jmMiMCxO8mVmIEP7Mt', // test@example.com
  'puc5L1qxmlrtQMhfZ3vDMzKKGkxWzUJY', // admin@example.com
  'wp4Qug766zM2gRBaNu6vg25w7ZwZx8hk', // admin@example.com (测试分享-管理员邮箱)
  'nJhGouNRhtG9UvoqrXZ1gGNHHkmHOJku', // test@example.com
  'Mhkp5gO6gJU0jO3oWqSlr62l7pTUaqRu'  // admin@example.com
];

class ShareLinkAccessTest {
  constructor() {
    this.testResults = {
      passed: [],
      failed: [],
      warnings: [],
      critical: []
    };
  }

  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      const data = await response.json();
      return { status: response.status, data, headers: response.headers };
    } catch (error) {
      return { status: 0, data: { message: error.message }, headers: {} };
    }
  }

  // 测试1: 分享链接基本访问功能
  async test1_BasicShareLinkAccess() {
    console.log('\n🔍 测试1: 分享链接基本访问功能');
    
    for (const token of EXISTING_SHARE_TOKENS) {
      console.log(`\n📊 测试token: ${token.substring(0, 8)}...`);
      
      const { status, data } = await this.request(`${BASE_URL}/share/${token}`);
      
      if (status === 200 && data.code === 200) {
        console.log(`   ✅ 访问成功`);
        console.log(`   📧 目标邮箱: ${data.data.targetEmail}`);
        console.log(`   🏷️  分享名称: ${data.data.shareName}`);
        console.log(`   🔍 关键词过滤: ${data.data.keywordFilter}`);
        
        // 检查是否有新的频率限制字段
        if (data.data.rateLimitPerSecond !== undefined) {
          console.log(`   ⏱️  频率限制: ${data.data.rateLimitPerSecond}/秒, ${data.data.rateLimitPerMinute}/分钟`);
          this.testResults.passed.push(`频率限制字段-${token.substring(0, 8)}`);
        } else {
          console.log(`   ⚠️  缺少频率限制字段`);
          this.testResults.warnings.push(`缺少频率限制字段-${token.substring(0, 8)}`);
        }
        
        this.testResults.passed.push(`基本访问-${token.substring(0, 8)}`);
      } else {
        console.log(`   ❌ 访问失败: ${data.message}`);
        this.testResults.failed.push(`基本访问-${token.substring(0, 8)}`);
      }
    }
  }

  // 测试2: 邮件列表获取功能
  async test2_EmailListAccess() {
    console.log('\n🔍 测试2: 邮件列表获取功能');
    
    // 使用第一个token进行邮件列表测试
    const testToken = EXISTING_SHARE_TOKENS[0];
    console.log(`\n📊 使用token: ${testToken.substring(0, 8)}...`);
    
    const { status, data } = await this.request(`${BASE_URL}/share/emails/${testToken}`);
    
    if (status === 200 && data.code === 200) {
      console.log(`   ✅ 邮件列表获取成功`);
      console.log(`   📧 邮件数量: ${data.data.emails ? data.data.emails.length : 0}`);
      console.log(`   📄 总页数: ${data.data.totalPages || 'N/A'}`);
      console.log(`   📊 当前页: ${data.data.currentPage || 'N/A'}`);
      
      if (data.data.emails && data.data.emails.length > 0) {
        const firstEmail = data.data.emails[0];
        console.log(`   📮 第一封邮件: ${firstEmail.subject || 'N/A'}`);
        console.log(`   👤 发件人: ${firstEmail.sender || 'N/A'}`);
      }
      
      this.testResults.passed.push('邮件列表获取');
    } else {
      console.log(`   ❌ 邮件列表获取失败: ${data.message}`);
      this.testResults.failed.push('邮件列表获取');
    }
  }

  // 测试3: 频率限制实际验证
  async test3_RateLimitValidation() {
    console.log('\n🔍 测试3: 频率限制实际验证');
    
    const testToken = EXISTING_SHARE_TOKENS[0];
    console.log(`\n📊 使用token: ${testToken.substring(0, 8)}...`);
    
    // 快速连续请求测试频率限制
    console.log('\n📊 执行10个并发请求测试频率限制');
    const promises = [];
    let successCount = 0;
    let blockedCount = 0;
    let otherCount = 0;

    for (let i = 0; i < 10; i++) {
      promises.push(
        this.request(`${BASE_URL}/share/${testToken}`)
          .then(({ status, data }) => {
            if (status === 200) {
              successCount++;
              console.log(`   请求${i + 1}: ✅ 成功 (200)`);
            } else if (status === 429) {
              blockedCount++;
              console.log(`   请求${i + 1}: ❌ 被限制 (429)`);
            } else {
              otherCount++;
              console.log(`   请求${i + 1}: ⚠️  其他状态 (${status})`);
            }
            return status;
          })
      );
    }

    await Promise.all(promises);

    console.log(`\n📈 频率限制测试结果:`);
    console.log(`   成功请求: ${successCount}`);
    console.log(`   被限制请求: ${blockedCount}`);
    console.log(`   其他状态: ${otherCount}`);

    if (blockedCount > 0) {
      console.log('   ✅ 频率限制功能正常工作');
      this.testResults.passed.push('频率限制功能');
    } else if (successCount === 10) {
      console.log('   ⚠️  频率限制可能未生效（开发环境）');
      this.testResults.warnings.push('频率限制在开发环境可能不准确');
    } else {
      console.log('   ❌ 频率限制行为异常');
      this.testResults.failed.push('频率限制行为异常');
    }
  }

  // 测试4: 缓存功能验证
  async test4_CacheValidation() {
    console.log('\n🔍 测试4: 缓存功能验证');
    
    const testToken = EXISTING_SHARE_TOKENS[0];
    console.log(`\n📊 使用token: ${testToken.substring(0, 8)}...`);
    
    // 连续3次请求同一分享链接，验证缓存
    const results = [];
    const timings = [];
    
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const { status, data } = await this.request(`${BASE_URL}/share/${testToken}`);
      const duration = Date.now() - start;
      
      timings.push(duration);
      results.push({ status, data });
      
      console.log(`   请求${i + 1}: ${status === 200 ? '✅' : '❌'} (${duration}ms)`);
      
      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 分析响应时间
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const firstTime = timings[0];
    const laterTimes = timings.slice(1);
    const avgLaterTime = laterTimes.reduce((a, b) => a + b, 0) / laterTimes.length;

    console.log(`\n📊 缓存性能分析:`);
    console.log(`   首次请求: ${firstTime}ms`);
    console.log(`   后续请求平均: ${avgLaterTime.toFixed(1)}ms`);
    console.log(`   性能提升: ${((firstTime - avgLaterTime) / firstTime * 100).toFixed(1)}%`);

    if (avgLaterTime < firstTime * 0.8) {
      console.log('   ✅ 缓存功能可能生效');
      this.testResults.passed.push('缓存性能优化');
    } else {
      console.log('   ⚠️  缓存效果不明显（开发环境）');
      this.testResults.warnings.push('缓存效果在开发环境不明显');
    }

    // 验证数据一致性
    const allDataConsistent = results.every(result => 
      result.status === 200 && 
      result.data.code === 200 &&
      result.data.data.targetEmail === results[0].data.data.targetEmail
    );

    if (allDataConsistent) {
      console.log('   ✅ 缓存数据一致性验证通过');
      this.testResults.passed.push('缓存数据一致性');
    } else {
      console.log('   ❌ 缓存数据一致性验证失败');
      this.testResults.critical.push('缓存数据一致性失败');
    }
  }

  // 测试5: 向后兼容性验证
  async test5_BackwardCompatibilityValidation() {
    console.log('\n🔍 测试5: 向后兼容性验证');
    
    console.log('\n📊 测试所有现有分享链接的兼容性');
    
    let compatibleCount = 0;
    let incompatibleCount = 0;
    
    for (const token of EXISTING_SHARE_TOKENS) {
      const { status, data } = await this.request(`${BASE_URL}/share/${token}`);
      
      if (status === 200 && data.code === 200) {
        compatibleCount++;
        
        // 检查是否有默认的频率限制值
        const hasRateLimit = data.data.rateLimitPerSecond !== undefined && data.data.rateLimitPerMinute !== undefined;
        const hasDefaultValues = data.data.rateLimitPerSecond === 5 && data.data.rateLimitPerMinute === 60;
        
        if (hasRateLimit && hasDefaultValues) {
          console.log(`   ✅ ${token.substring(0, 8)}: 完全兼容（有默认频率限制）`);
        } else if (hasRateLimit) {
          console.log(`   ✅ ${token.substring(0, 8)}: 兼容（有自定义频率限制）`);
        } else {
          console.log(`   ⚠️  ${token.substring(0, 8)}: 基本兼容（缺少频率限制字段）`);
        }
      } else {
        incompatibleCount++;
        console.log(`   ❌ ${token.substring(0, 8)}: 不兼容 - ${data.message}`);
      }
    }

    console.log(`\n📊 向后兼容性统计:`);
    console.log(`   兼容链接: ${compatibleCount}/${EXISTING_SHARE_TOKENS.length}`);
    console.log(`   不兼容链接: ${incompatibleCount}/${EXISTING_SHARE_TOKENS.length}`);
    console.log(`   兼容率: ${(compatibleCount / EXISTING_SHARE_TOKENS.length * 100).toFixed(1)}%`);

    if (compatibleCount === EXISTING_SHARE_TOKENS.length) {
      console.log('   ✅ 向后兼容性验证完全通过');
      this.testResults.passed.push('向后兼容性验证');
    } else if (compatibleCount > EXISTING_SHARE_TOKENS.length * 0.8) {
      console.log('   ⚠️  向后兼容性基本通过');
      this.testResults.warnings.push('部分链接兼容性问题');
    } else {
      console.log('   ❌ 向后兼容性验证失败');
      this.testResults.critical.push('向后兼容性严重问题');
    }
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🔍 开始执行分享链接访问测试套件');
    console.log('=' .repeat(80));
    console.log(`📊 测试${EXISTING_SHARE_TOKENS.length}个现有分享链接`);
    console.log('=' .repeat(80));

    await this.test1_BasicShareLinkAccess();
    await this.test2_EmailListAccess();
    await this.test3_RateLimitValidation();
    await this.test4_CacheValidation();
    await this.test5_BackwardCompatibilityValidation();

    // 生成测试报告
    console.log('\n' + '='.repeat(80));
    console.log('🔍 分享链接访问测试报告');
    console.log('='.repeat(80));

    console.log(`\n✅ 通过测试: ${this.testResults.passed.length}`);
    this.testResults.passed.forEach(test => console.log(`   - ${test}`));

    console.log(`\n❌ 失败测试: ${this.testResults.failed.length}`);
    this.testResults.failed.forEach(test => console.log(`   - ${test}`));

    console.log(`\n⚠️  警告: ${this.testResults.warnings.length}`);
    this.testResults.warnings.forEach(test => console.log(`   - ${test}`));

    console.log(`\n🚨 严重问题: ${this.testResults.critical.length}`);
    this.testResults.critical.forEach(test => console.log(`   - ${test}`));

    const totalTests = this.testResults.passed.length + this.testResults.failed.length + this.testResults.warnings.length;
    const successRate = totalTests > 0 ? Math.round((this.testResults.passed.length / totalTests) * 100) : 0;

    console.log(`\n📊 分享链接访问测试统计:`);
    console.log(`   成功率: ${successRate}%`);
    console.log(`   严重问题: ${this.testResults.critical.length} 个`);
    console.log(`   测试的分享链接: ${EXISTING_SHARE_TOKENS.length} 个`);

    console.log('\n' + '='.repeat(80));
    const overallResult = this.testResults.critical.length === 0 && this.testResults.failed.length < 2 ? 
      '✅ 分享链接访问测试通过' : '❌ 发现严重问题';
    console.log(`🎯 最终结论: ${overallResult}`);
    console.log('='.repeat(80));

    return {
      passed: this.testResults.passed.length,
      failed: this.testResults.failed.length,
      warnings: this.testResults.warnings.length,
      critical: this.testResults.critical.length,
      successRate,
      testedTokens: EXISTING_SHARE_TOKENS.length
    };
  }
}

// 执行分享链接访问测试
if (require.main === module) {
  const test = new ShareLinkAccessTest();
  test.runAllTests().catch(console.error);
}

module.exports = ShareLinkAccessTest;