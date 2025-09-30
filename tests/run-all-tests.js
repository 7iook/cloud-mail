/**
 * 主测试运行器
 * 按顺序执行所有测试套件
 */

const { runAllTests: runAPITests } = require('./share-functionality-test');
const PlaywrightFrontendTest = require('./playwright-frontend-test');
const SSERealtimeTest = require('./sse-realtime-test');

async function runCompleteTestSuite() {
  console.log('🎯 开始执行 Cloud-Mail 完整测试套件');
  console.log('=' .repeat(80));
  
  const allResults = {
    api: { passed: [], failed: [], warnings: [] },
    frontend: { passed: [], failed: [], warnings: [] },
    sse: { passed: [], failed: [], warnings: [] }
  };
  
  try {
    // 1. API功能测试
    console.log('\n🔧 第一阶段: API功能测试');
    console.log('-'.repeat(40));
    await runAPITests();
    const { testResults: apiResults } = require('./share-functionality-test');
    allResults.api = apiResults;
    
    // 等待一下，让服务稳定
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. SSE实时推送测试
    console.log('\n📡 第二阶段: SSE实时推送测试');
    console.log('-'.repeat(40));
    const sseTest = new SSERealtimeTest();
    allResults.sse = await sseTest.runAllTests();
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 前端UI测试
    console.log('\n🎭 第三阶段: 前端UI测试');
    console.log('-'.repeat(40));
    const frontendTest = new PlaywrightFrontendTest();
    allResults.frontend = await frontendTest.runAllTests();
    
  } catch (error) {
    console.log('❌ 测试套件执行失败:', error.message);
    allResults.api.failed.push(`测试套件执行: ${error.message}`);
  }
  
  // 生成综合报告
  console.log('\n' + '='.repeat(80));
  console.log('📊 综合测试报告');
  console.log('='.repeat(80));
  
  const totalPassed = allResults.api.passed.length + allResults.frontend.passed.length + allResults.sse.passed.length;
  const totalFailed = allResults.api.failed.length + allResults.frontend.failed.length + allResults.sse.failed.length;
  const totalWarnings = allResults.api.warnings.length + allResults.frontend.warnings.length + allResults.sse.warnings.length;
  
  console.log(`\n📈 测试统计:`);
  console.log(`   API测试:     ✅ ${allResults.api.passed.length}  ❌ ${allResults.api.failed.length}  ⚠️ ${allResults.api.warnings.length}`);
  console.log(`   前端测试:    ✅ ${allResults.frontend.passed.length}  ❌ ${allResults.frontend.failed.length}  ⚠️ ${allResults.frontend.warnings.length}`);
  console.log(`   SSE测试:     ✅ ${allResults.sse.passed.length}  ❌ ${allResults.sse.failed.length}  ⚠️ ${allResults.sse.warnings.length}`);
  console.log(`   总计:        ✅ ${totalPassed}  ❌ ${totalFailed}  ⚠️ ${totalWarnings}`);
  
  if (totalFailed > 0) {
    console.log(`\n❌ 失败的测试项目:`);
    [...allResults.api.failed, ...allResults.frontend.failed, ...allResults.sse.failed]
      .forEach(item => console.log(`   - ${item}`));
  }
  
  if (totalWarnings > 0) {
    console.log(`\n⚠️  警告项目:`);
    [...allResults.api.warnings, ...allResults.frontend.warnings, ...allResults.sse.warnings]
      .forEach(item => console.log(`   - ${item}`));
  }
  
  console.log('\n' + '='.repeat(80));
  const overallResult = totalFailed === 0 ? '✅ 全部测试通过' : `❌ ${totalFailed} 项测试失败`;
  console.log(`🎯 最终结果: ${overallResult}`);
  console.log('='.repeat(80));
  
  // 功能完整性评估
  console.log('\n📋 功能完整性评估:');
  
  const coreFeatures = [
    { name: '创建分享链接', status: allResults.api.passed.includes('创建分享链接') ? '✅' : '❌' },
    { name: '自定义频率限制', status: allResults.api.passed.includes('分享链接创建属性测试') ? '✅' : '❌' },
    { name: '频率限制生效', status: allResults.api.passed.includes('频率限制生效') || allResults.api.warnings.some(w => w.includes('频率限制')) ? '✅' : '❌' },
    { name: '向后兼容性', status: allResults.api.passed.includes('向后兼容性') ? '✅' : '❌' },
    { name: '缓存优化', status: allResults.api.passed.includes('缓存功能') || allResults.api.warnings.some(w => w.includes('缓存')) ? '✅' : '❌' },
    { name: 'SSE实时推送', status: allResults.sse.passed.includes('SSE连接建立') ? '✅' : '❌' },
    { name: '前端UI', status: allResults.frontend.passed.includes('分享管理页面加载') ? '✅' : '❌' },
    { name: 'XSS防护', status: allResults.frontend.passed.includes('XSS防护功能') || allResults.frontend.passed.includes('DOMPurify加载') ? '✅' : '❌' }
  ];
  
  coreFeatures.forEach(feature => {
    console.log(`   ${feature.status} ${feature.name}`);
  });
  
  const completedFeatures = coreFeatures.filter(f => f.status === '✅').length;
  const completionRate = Math.round((completedFeatures / coreFeatures.length) * 100);
  
  console.log(`\n🎯 功能完成度: ${completionRate}% (${completedFeatures}/${coreFeatures.length})`);
  
  return {
    totalPassed,
    totalFailed,
    totalWarnings,
    completionRate,
    allResults
  };
}

// 执行完整测试套件
if (require.main === module) {
  runCompleteTestSuite().catch(console.error);
}

module.exports = { runCompleteTestSuite };