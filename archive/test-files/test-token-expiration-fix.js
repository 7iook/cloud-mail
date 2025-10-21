/**
 * Token Expiration Fix Verification Test
 * 验证失效令牌返回纯文本404响应
 * 
 * 测试场景：
 * 1. 访问失效的分享令牌
 * 2. 验证返回404状态码
 * 3. 验证响应体为纯文本"Not Found"
 * 4. 验证不包含任何HTML标签
 * 5. 验证缓存控制头正确设置
 */

const TEST_CONFIG = {
    // 测试用的失效令牌（32字符随机字符串）
    INVALID_TOKEN: 'abcdefghijklmnopqrstuvwxyz123456',
    
    // 后端API基础URL（根据实际环境调整）
    BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:8787',
    
    // 测试超时时间
    TIMEOUT: 10000
};

/**
 * 测试失效令牌返回404纯文本响应
 */
async function testInvalidTokenResponse() {
    console.log('\n=== 测试1: 失效令牌404响应验证 ===');
    
    const url = `${TEST_CONFIG.BASE_URL}/share/${TEST_CONFIG.INVALID_TOKEN}`;
    console.log(`请求URL: ${url}`);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Token-Expiration-Test/1.0'
            }
        });
        
        // 验证1: HTTP状态码必须是404
        console.log(`\n✓ HTTP状态码: ${response.status}`);
        if (response.status !== 404) {
            throw new Error(`期望状态码404，实际收到${response.status}`);
        }
        
        // 验证2: Content-Type必须是text/plain
        const contentType = response.headers.get('Content-Type');
        console.log(`✓ Content-Type: ${contentType}`);
        if (!contentType || !contentType.includes('text/plain')) {
            throw new Error(`期望Content-Type为text/plain，实际为${contentType}`);
        }
        
        // 验证3: 缓存控制头
        const cacheControl = response.headers.get('Cache-Control');
        console.log(`✓ Cache-Control: ${cacheControl}`);
        if (!cacheControl || !cacheControl.includes('no-store')) {
            console.warn(`⚠ 警告: Cache-Control未包含no-store`);
        }
        
        // 验证4: 响应体必须是纯文本"Not Found"
        const responseText = await response.text();
        console.log(`✓ 响应体: "${responseText}"`);
        console.log(`✓ 响应体长度: ${responseText.length} 字节`);
        
        if (responseText !== 'Not Found') {
            throw new Error(`期望响应体为"Not Found"，实际为"${responseText}"`);
        }
        
        // 验证5: 不包含任何HTML标签
        const hasHtmlTags = /<[^>]+>/.test(responseText);
        if (hasHtmlTags) {
            throw new Error(`响应体包含HTML标签，违反纯文本要求`);
        }
        console.log(`✓ 响应体不包含HTML标签`);
        
        // 验证6: 不包含敏感信息
        const sensitiveKeywords = ['domain', 'server', 'cloudflare', 'worker', 'error'];
        const foundKeywords = sensitiveKeywords.filter(keyword => 
            responseText.toLowerCase().includes(keyword)
        );
        if (foundKeywords.length > 0) {
            console.warn(`⚠ 警告: 响应体包含敏感关键词: ${foundKeywords.join(', ')}`);
        } else {
            console.log(`✓ 响应体不包含敏感信息`);
        }
        
        console.log('\n✅ 测试1通过: 失效令牌正确返回纯文本404响应\n');
        return true;
        
    } catch (error) {
        console.error(`\n❌ 测试1失败: ${error.message}\n`);
        throw error;
    }
}

/**
 * 测试多个失效令牌格式
 */
async function testMultipleInvalidTokens() {
    console.log('\n=== 测试2: 多种失效令牌格式验证 ===');
    
    const invalidTokens = [
        'invalidtoken123456789012345678',  // 32字符
        'short',                            // 短令牌
        '12345678901234567890123456789012', // 纯数字
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'  // 纯大写
    ];
    
    let passCount = 0;
    
    for (const token of invalidTokens) {
        console.log(`\n测试令牌: ${token}`);
        const url = `${TEST_CONFIG.BASE_URL}/share/${token}`;
        
        try {
            const response = await fetch(url);
            const text = await response.text();
            
            if (response.status === 404 && text === 'Not Found') {
                console.log(`✓ 令牌"${token}"正确返回404`);
                passCount++;
            } else {
                console.warn(`⚠ 令牌"${token}"返回异常: ${response.status} - ${text}`);
            }
        } catch (error) {
            console.error(`❌ 令牌"${token}"测试失败: ${error.message}`);
        }
    }
    
    console.log(`\n✅ 测试2完成: ${passCount}/${invalidTokens.length} 个令牌测试通过\n`);
    return passCount === invalidTokens.length;
}

/**
 * 测试缓存行为
 */
async function testCacheBehavior() {
    console.log('\n=== 测试3: 缓存行为验证 ===');
    
    const url = `${TEST_CONFIG.BASE_URL}/share/${TEST_CONFIG.INVALID_TOKEN}`;
    
    try {
        // 第一次请求
        const response1 = await fetch(url);
        const text1 = await response1.text();
        const headers1 = Object.fromEntries(response1.headers.entries());
        
        // 等待1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 第二次请求
        const response2 = await fetch(url);
        const text2 = await response2.text();
        
        // 验证两次请求结果一致
        if (text1 === text2 && text1 === 'Not Found') {
            console.log(`✓ 两次请求结果一致`);
        } else {
            throw new Error(`两次请求结果不一致`);
        }
        
        // 验证缓存控制头
        const cacheHeaders = ['Cache-Control', 'Pragma', 'Expires'];
        console.log('\n缓存相关响应头:');
        cacheHeaders.forEach(header => {
            const value = response1.headers.get(header);
            console.log(`  ${header}: ${value || '(未设置)'}`);
        });
        
        console.log('\n✅ 测试3通过: 缓存行为正确\n');
        return true;
        
    } catch (error) {
        console.error(`\n❌ 测试3失败: ${error.message}\n`);
        throw error;
    }
}

/**
 * 主测试函数
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Token Expiration Fix - Verification Test Suite          ║');
    console.log('║   令牌过期修复 - 验证测试套件                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n测试配置:`);
    console.log(`  基础URL: ${TEST_CONFIG.BASE_URL}`);
    console.log(`  测试令牌: ${TEST_CONFIG.INVALID_TOKEN}`);
    console.log(`  超时时间: ${TEST_CONFIG.TIMEOUT}ms`);
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    const tests = [
        { name: '失效令牌404响应验证', fn: testInvalidTokenResponse },
        { name: '多种失效令牌格式验证', fn: testMultipleInvalidTokens },
        { name: '缓存行为验证', fn: testCacheBehavior }
    ];
    
    for (const test of tests) {
        results.total++;
        try {
            await test.fn();
            results.passed++;
        } catch (error) {
            results.failed++;
            console.error(`测试"${test.name}"失败:`, error.message);
        }
    }
    
    // 输出测试总结
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     测试结果总结                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n总测试数: ${results.total}`);
    console.log(`通过: ${results.passed} ✅`);
    console.log(`失败: ${results.failed} ❌`);
    console.log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
    
    if (results.failed === 0) {
        console.log('\n🎉 所有测试通过！修复验证成功！');
        process.exit(0);
    } else {
        console.log('\n⚠️  部分测试失败，请检查修复实现。');
        process.exit(1);
    }
}

// 执行测试
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('\n💥 测试执行出错:', error);
        process.exit(1);
    });
}

module.exports = {
    testInvalidTokenResponse,
    testMultipleInvalidTokens,
    testCacheBehavior
};
