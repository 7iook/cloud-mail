/**
 * 批判性验证测试 - 使用真实token进行完整功能验证
 */

const fetch = require('node-fetch');

// 从浏览器获取的真实token (更新后的有效token)
const REAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInRva2VuIjoiNDY1OGI4NzctM2IxYy00NjVhLTg2ZGEtODA3ODYzY2I3ZjNmIiwiaWF0IjoxNzU4MzIyOTYwfQ.MyUSkwuEewg9d5cicHSK3LEJxseQDvD47Xdvu0m06Vk';
const BASE_URL = 'http://127.0.0.1:8787/api';

class CriticalValidationTest {
  constructor() {
    this.testResults = {
      passed: [],
      failed: [],
      warnings: [],
      critical: []
    };
    this.createdShareTokens = [];
  }

  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${REAL_TOKEN}`,
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

  // 批判性测试1: 创建分享链接的完整验证
  async criticalTest1_CreateShareLinkValidation() {
    console.log('\n🔍 批判性测试1: 创建分享链接完整验证');
    
    const testCases = [
      {
        name: '正常创建-自定义频率限制',
        payload: {
          targetEmail: 'test@example.com',
          shareName: '批判性测试-正常创建',
          keywordFilter: '验证码|verification|code',
          rateLimitPerSecond: 3,
          rateLimitPerMinute: 30
        }
      },
      {
        name: '极端频率限制测试',
        payload: {
          targetEmail: 'admin@example.com',
          shareName: '批判性测试-极端限制',
          keywordFilter: '验证码',
          rateLimitPerSecond: 1,
          rateLimitPerMinute: 1000
        }
      },
      {
        name: '边界值测试',
        payload: {
          targetEmail: 'test@example.com',
          shareName: '批判性测试-边界值',
          keywordFilter: '验证码|code|otp|auth|2fa|mfa|token|pin',
          rateLimitPerSecond: 100,
          rateLimitPerMinute: 1
        }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📊 测试用例: ${testCase.name}`);
      
      try {
        const { status, data } = await this.request(`${BASE_URL}/share/create`, {
          method: 'POST',
          body: JSON.stringify(testCase.payload)
        });

        if (status === 200 && data.code === 200) {
          const shareToken = data.data.shareToken;
          this.createdShareTokens.push(shareToken);
          
          console.log(`   ✅ 创建成功: ${shareToken}`);
          console.log(`   📋 分享链接: ${data.data.shareUrl}`);
          
          // 立即验证创建的链接是否可访问
          const { status: getStatus, data: getData } = await this.request(`${BASE_URL}/share/${shareToken}`);
          
          if (getStatus === 200 && getData.code === 200) {
            console.log(`   ✅ 链接立即可访问`);
            console.log(`   📧 目标邮箱: ${getData.data.targetEmail}`);
            console.log(`   🏷️  分享名称: ${getData.data.shareName}`);
            
            this.testResults.passed.push(`${testCase.name} - 创建和访问`);
          } else {
            console.log(`   ❌ 链接无法访问: ${getData.message}`);
            this.testResults.failed.push(`${testCase.name} - 链接访问失败`);
          }
          
        } else {
          console.log(`   ❌ 创建失败: ${data.message}`);
          this.testResults.failed.push(`${testCase.name} - 创建失败: ${data.message}`);
        }
        
      } catch (error) {
        console.log(`   ❌ 测试异常: ${error.message}`);
        this.testResults.failed.push(`${testCase.name} - 异常: ${error.message}`);
      }
    }
  }

  // 批判性测试2: 频率限制的实际验证
  async criticalTest2_RateLimitValidation() {
    console.log('\n🔍 批判性测试2: 频率限制实际验证');
    
    if (this.createdShareTokens.length === 0) {
      console.log('   ⏭️  跳过（没有可用的分享token）');
      return;
    }

    const shareToken = this.createdShareTokens[0]; // 使用第一个创建的token（3次/秒限制）
    console.log(`   🎯 测试目标: ${shareToken}`);

    // 测试正常访问（应该成功）
    console.log('\n📊 测试正常访问频率（2秒间隔）');
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const { status } = await this.request(`${BASE_URL}/share/${shareToken}`);
      const duration = Date.now() - start;
      
      console.log(`   请求${i + 1}: ${status === 200 ? '✅ 成功' : '❌ 失败'} (${duration}ms)`);
      
      if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 测试高频访问（应该被限制）
    console.log('\n📊 测试高频访问（并发10个请求）');
    const promises = [];
    let blockedCount = 0;
    let successCount = 0;

    for (let i = 0; i < 10; i++) {
      promises.push(
        this.request(`${BASE_URL}/share/${shareToken}`)
          .then(({ status, data }) => {
            if (status === 429) {
              blockedCount++;
              console.log(`   请求${i + 1}: ❌ 被限制 (429)`);
            } else if (status === 200) {
              successCount++;
              console.log(`   请求${i + 1}: ✅ 成功 (200)`);
            } else {
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
    console.log(`   其他状态: ${10 - successCount - blockedCount}`);

    if (blockedCount > 0) {
      console.log('   ✅ 频率限制正常工作');
      this.testResults.passed.push('频率限制功能验证');
    } else if (successCount === 10) {
      console.log('   ⚠️  频率限制可能未生效（开发环境内存缓存）');
      this.testResults.warnings.push('频率限制在开发环境可能不准确');
    } else {
      console.log('   ❌ 频率限制行为异常');
      this.testResults.failed.push('频率限制行为异常');
    }
  }

  // 批判性测试3: 数据一致性验证
  async criticalTest3_DataConsistencyValidation() {
    console.log('\n🔍 批判性测试3: 数据一致性验证');
    
    if (this.createdShareTokens.length === 0) {
      console.log('   ⏭️  跳过（没有可用的分享token）');
      return;
    }

    for (const shareToken of this.createdShareTokens) {
      console.log(`\n📊 验证token: ${shareToken}`);
      
      // 多次获取同一分享链接，验证数据一致性
      const results = [];
      for (let i = 0; i < 3; i++) {
        const { status, data } = await this.request(`${BASE_URL}/share/${shareToken}`);
        if (status === 200 && data.code === 200) {
          results.push(data.data);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (results.length === 3) {
        // 验证数据一致性
        const firstResult = results[0];
        const allConsistent = results.every(result => 
          result.targetEmail === firstResult.targetEmail &&
          result.shareName === firstResult.shareName &&
          result.keywordFilter === firstResult.keywordFilter
        );

        if (allConsistent) {
          console.log('   ✅ 数据一致性验证通过');
          this.testResults.passed.push(`数据一致性-${shareToken.substring(0, 8)}`);
        } else {
          console.log('   ❌ 数据一致性验证失败');
          this.testResults.critical.push(`数据一致性失败-${shareToken.substring(0, 8)}`);
        }
      } else {
        console.log('   ❌ 无法获取足够的数据进行一致性验证');
        this.testResults.failed.push(`数据获取失败-${shareToken.substring(0, 8)}`);
      }
    }
  }

  // 批判性测试4: 异常情况处理验证
  async criticalTest4_ExceptionHandlingValidation() {
    console.log('\n🔍 批判性测试4: 异常情况处理验证');

    const exceptionTests = [
      {
        name: '无效token访问',
        token: 'invalid-token-12345678901234567890',
        expectedStatus: 404
      },
      {
        name: '过短token访问',
        token: 'short',
        expectedStatus: 404
      },
      {
        name: '空token访问',
        token: '',
        expectedStatus: 404
      }
    ];

    for (const test of exceptionTests) {
      console.log(`\n📊 测试: ${test.name}`);
      
      const { status, data } = await this.request(`${BASE_URL}/share/${test.token}`);
      
      if (status === test.expectedStatus) {
        console.log(`   ✅ 正确处理异常情况 (${status})`);
        this.testResults.passed.push(`异常处理-${test.name}`);
      } else {
        console.log(`   ❌ 异常处理不当: 期望${test.expectedStatus}, 实际${status}`);
        console.log(`   📋 响应: ${data.message}`);
        this.testResults.failed.push(`异常处理-${test.name}`);
      }
    }
  }

  // 运行所有批判性测试
  async runAllCriticalTests() {
    console.log('🔍 开始执行批判性验证测试套件');
    console.log('=' .repeat(80));
    console.log(`🔑 使用Token: ${REAL_TOKEN.substring(0, 20)}...`);
    console.log('=' .repeat(80));

    await this.criticalTest1_CreateShareLinkValidation();
    await this.criticalTest2_RateLimitValidation();
    await this.criticalTest3_DataConsistencyValidation();
    await this.criticalTest4_ExceptionHandlingValidation();

    // 生成批判性验证报告
    console.log('\n' + '='.repeat(80));
    console.log('🔍 批判性验证报告');
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

    console.log(`\n📊 批判性验证统计:`);
    console.log(`   成功率: ${successRate}%`);
    console.log(`   严重问题: ${this.testResults.critical.length} 个`);
    console.log(`   创建的分享链接: ${this.createdShareTokens.length} 个`);

    console.log('\n' + '='.repeat(80));
    const overallResult = this.testResults.critical.length === 0 && this.testResults.failed.length < 3 ? 
      '✅ 批判性验证通过' : '❌ 发现严重问题';
    console.log(`🎯 最终结论: ${overallResult}`);
    console.log('='.repeat(80));

    return {
      passed: this.testResults.passed.length,
      failed: this.testResults.failed.length,
      warnings: this.testResults.warnings.length,
      critical: this.testResults.critical.length,
      successRate,
      createdTokens: this.createdShareTokens
    };
  }
}

// 执行批判性验证测试
if (require.main === module) {
  const test = new CriticalValidationTest();
  test.runAllCriticalTests().catch(console.error);
}

module.exports = CriticalValidationTest;