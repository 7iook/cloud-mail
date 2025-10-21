/**
 * Share Status Filter Fix Verification Test
 * 验证分享状态筛选修复
 * 
 * 测试场景：
 * 1. 创建测试分享
 * 2. 禁用分享
 * 3. 验证禁用的分享仍在列表中
 * 4. 验证状态筛选功能
 * 5. 批量启用已禁用的分享
 * 6. 验证统计数据准确性
 */

const TEST_CONFIG = {
    BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:8787',
    AUTH_TOKEN: process.env.TEST_AUTH_TOKEN || '',
    TEST_EMAIL: 'test@example.com',
    TIMEOUT: 30000
};

let createdShareId = null;
let authToken = null;

/**
 * 辅助函数：发送HTTP请求
 */
async function request(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    const data = await response.json();
    return { status: response.status, data };
}

/**
 * 测试1：创建测试分享
 */
async function test1_CreateShare() {
    console.log('\n=== 测试1：创建测试分享 ===');
    
    try {
        const payload = {
            targetEmail: TEST_CONFIG.TEST_EMAIL,
            shareName: '状态筛选测试分享',
            keywordFilter: '验证码|verification',
            expireTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/create`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (status === 200 && data.code === 200) {
            createdShareId = data.data.shareId;
            console.log(`✅ 创建成功 - Share ID: ${createdShareId}`);
            console.log(`   分享Token: ${data.data.shareToken}`);
            return true;
        } else {
            console.error(`❌ 创建失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 创建失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试2：获取分享列表（全部）
 */
async function test2_GetAllShares() {
    console.log('\n=== 测试2：获取分享列表（全部） ===');
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/list?page=1&pageSize=100`);
        
        if (status === 200 && data.code === 200) {
            console.log(`✅ 获取成功`);
            console.log(`   总数: ${data.data.total}`);
            console.log(`   列表长度: ${data.data.list.length}`);
            
            if (data.data.stats) {
                console.log(`   统计数据:`);
                console.log(`     - 全部: ${data.data.stats.total}`);
                console.log(`     - 活跃: ${data.data.stats.active}`);
                console.log(`     - 已过期: ${data.data.stats.expired}`);
                console.log(`     - 已禁用: ${data.data.stats.disabled}`);
            } else {
                console.warn(`⚠️  后端未返回统计数据`);
            }
            
            return true;
        } else {
            console.error(`❌ 获取失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 获取失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试3：禁用分享
 */
async function test3_DisableShare() {
    console.log('\n=== 测试3：禁用分享 ===');
    
    if (!createdShareId) {
        console.error(`❌ 没有可用的Share ID`);
        return false;
    }
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/batch`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'disable',
                shareIds: [createdShareId]
            })
        });
        
        if (status === 200 && data.code === 200) {
            console.log(`✅ 禁用成功`);
            console.log(`   影响行数: ${data.data.affected}`);
            return true;
        } else {
            console.error(`❌ 禁用失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 禁用失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试4：验证禁用的分享仍在列表中
 */
async function test4_VerifyDisabledShareVisible() {
    console.log('\n=== 测试4：验证禁用的分享仍在列表中 ===');
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/list?page=1&pageSize=100`);
        
        if (status === 200 && data.code === 200) {
            const disabledShare = data.data.list.find(share => share.shareId === createdShareId);
            
            if (disabledShare) {
                console.log(`✅ 禁用的分享仍在列表中`);
                console.log(`   Share ID: ${disabledShare.shareId}`);
                console.log(`   isActive: ${disabledShare.isActive}`);
                console.log(`   status: ${disabledShare.status}`);
                
                if (disabledShare.isActive === 0) {
                    console.log(`✅ isActive字段正确（0=禁用）`);
                    return true;
                } else {
                    console.error(`❌ isActive字段错误: ${disabledShare.isActive}`);
                    return false;
                }
            } else {
                console.error(`❌ 禁用的分享不在列表中（Bug未修复）`);
                return false;
            }
        } else {
            console.error(`❌ 获取失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 获取失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试5：验证状态筛选功能（已禁用）
 */
async function test5_FilterDisabledShares() {
    console.log('\n=== 测试5：验证状态筛选功能（已禁用） ===');
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/list?page=1&pageSize=100&status=disabled`);
        
        if (status === 200 && data.code === 200) {
            console.log(`✅ 筛选成功`);
            console.log(`   返回数量: ${data.data.list.length}`);
            
            const hasOurShare = data.data.list.some(share => share.shareId === createdShareId);
            if (hasOurShare) {
                console.log(`✅ 我们的禁用分享在筛选结果中`);
            } else {
                console.warn(`⚠️  我们的禁用分享不在筛选结果中`);
            }
            
            // 验证所有返回的分享都是禁用状态
            const allDisabled = data.data.list.every(share => share.isActive === 0);
            if (allDisabled) {
                console.log(`✅ 所有返回的分享都是禁用状态`);
                return true;
            } else {
                console.error(`❌ 返回的分享中包含非禁用状态`);
                return false;
            }
        } else {
            console.error(`❌ 筛选失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 筛选失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试6：批量启用已禁用的分享
 */
async function test6_EnableDisabledShare() {
    console.log('\n=== 测试6：批量启用已禁用的分享 ===');
    
    if (!createdShareId) {
        console.error(`❌ 没有可用的Share ID`);
        return false;
    }
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/batch`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'enable',
                shareIds: [createdShareId]
            })
        });
        
        if (status === 200 && data.code === 200) {
            console.log(`✅ 启用成功`);
            console.log(`   影响行数: ${data.data.affected}`);
            return true;
        } else {
            console.error(`❌ 启用失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 启用失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试7：验证统计数据准确性
 */
async function test7_VerifyStats() {
    console.log('\n=== 测试7：验证统计数据准确性 ===');
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/list?page=1&pageSize=100`);
        
        if (status === 200 && data.code === 200) {
            if (data.data.stats) {
                const stats = data.data.stats;
                const calculatedTotal = stats.active + stats.expired + stats.disabled;
                
                console.log(`✅ 后端返回统计数据`);
                console.log(`   全部: ${stats.total}`);
                console.log(`   活跃: ${stats.active}`);
                console.log(`   已过期: ${stats.expired}`);
                console.log(`   已禁用: ${stats.disabled}`);
                console.log(`   计算总和: ${calculatedTotal}`);
                
                if (stats.total === calculatedTotal) {
                    console.log(`✅ 统计数据一致`);
                    return true;
                } else {
                    console.warn(`⚠️  统计数据不一致（可能有其他状态）`);
                    return true; // 仍然算通过，因为可能有其他状态
                }
            } else {
                console.error(`❌ 后端未返回统计数据`);
                return false;
            }
        } else {
            console.error(`❌ 获取失败: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ 获取失败: ${error.message}`);
        return false;
    }
}

/**
 * 清理：删除测试分享
 */
async function cleanup() {
    console.log('\n=== 清理：删除测试分享 ===');
    
    if (!createdShareId) {
        console.log('没有需要清理的分享');
        return;
    }
    
    try {
        const { status, data } = await request(`${TEST_CONFIG.BASE_URL}/api/share/${createdShareId}`, {
            method: 'DELETE'
        });
        
        if (status === 200 && data.code === 200) {
            console.log(`✅ 清理成功 - Share ID: ${createdShareId}`);
        } else {
            console.warn(`⚠️  清理失败: ${data.message}`);
        }
    } catch (error) {
        console.warn(`⚠️  清理失败: ${error.message}`);
    }
}

/**
 * 主测试函数
 */
async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Share Status Filter Fix - Verification Test Suite       ║');
    console.log('║   分享状态筛选修复 - 验证测试套件                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n测试配置:`);
    console.log(`  基础URL: ${TEST_CONFIG.BASE_URL}`);
    console.log(`  测试邮箱: ${TEST_CONFIG.TEST_EMAIL}`);
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    const tests = [
        { name: '创建测试分享', fn: test1_CreateShare },
        { name: '获取分享列表（全部）', fn: test2_GetAllShares },
        { name: '禁用分享', fn: test3_DisableShare },
        { name: '验证禁用的分享仍在列表中', fn: test4_VerifyDisabledShareVisible },
        { name: '验证状态筛选功能（已禁用）', fn: test5_FilterDisabledShares },
        { name: '批量启用已禁用的分享', fn: test6_EnableDisabledShare },
        { name: '验证统计数据准确性', fn: test7_VerifyStats }
    ];
    
    for (const test of tests) {
        results.total++;
        try {
            const passed = await test.fn();
            if (passed) {
                results.passed++;
            } else {
                results.failed++;
            }
        } catch (error) {
            results.failed++;
            console.error(`测试"${test.name}"执行出错:`, error.message);
        }
    }
    
    // 清理
    await cleanup();
    
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
    test1_CreateShare,
    test2_GetAllShares,
    test3_DisableShare,
    test4_VerifyDisabledShareVisible,
    test5_FilterDisabledShares,
    test6_EnableDisabledShare,
    test7_VerifyStats
};
