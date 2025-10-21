# 邮件监控功能端到端测试系统

## 概述

本测试系统提供了完整的邮件监控功能验证，从邮件接收到监控匹配再到前端展示的全链路测试。

## 测试组件

### 1. 增强测试API (`mail-worker/src/api/test-monitoring-api.js`)

提供以下测试端点：

- `POST /test/monitoring/comprehensive` - 综合监控测试
- `GET /test/monitoring/verify/:emailId` - 数据库验证查询
- `DELETE /test/monitoring/cleanup` - 清理测试数据

#### 测试场景

1. **精确匹配测试** - 验证 `test@example.com` 精确匹配
2. **Gmail别名测试** - 验证 `test+monitoring@gmail.com` 别名匹配
3. **域名通配符测试** - 验证 `*@example.com` 通配符匹配
4. **多收件人测试** - 验证多个收件人的匹配逻辑
5. **无匹配测试** - 验证不匹配任何配置的邮件

### 2. 端到端测试脚本 (`email-monitoring-e2e-test.js`)

Node.js脚本，执行完整的测试流程：

```bash
# 基本运行
node email-monitoring-e2e-test.js

# 指定测试环境
TEST_BASE_URL=http://localhost:8787 node email-monitoring-e2e-test.js
```

#### 测试流程

1. **环境准备** - 清理旧测试数据
2. **配置创建** - 创建测试监控配置
3. **综合测试** - 执行所有测试场景
4. **数据验证** - 验证数据库记录
5. **API测试** - 测试前端API
6. **数据清理** - 清理测试数据
7. **报告生成** - 生成详细测试报告

### 3. 数据库验证查询 (`monitoring-test-verification.sql`)

包含15个SQL查询，用于验证：

- 监控配置状态
- 邮件数据完整性
- 匹配记录正确性
- JSON格式验证
- 性能分析
- 数据一致性检查

### 4. 前端自动化测试 (`frontend-monitoring-test.js`)

使用Puppeteer进行前端界面测试：

```bash
# 安装依赖
npm install puppeteer

# 运行前端测试
node frontend-monitoring-test.js

# 有头模式运行（显示浏览器）
TEST_HEADLESS=false node frontend-monitoring-test.js
```

#### 前端测试内容

- 监控管理页面加载
- 监控配置创建界面
- 邮件列表显示
- 邮件详情查看
- 分享链接功能

## 快速开始

### 1. 准备环境

确保以下服务正在运行：
- Cloudflare Workers (mail-worker)
- 前端应用 (mail-vue)
- D1数据库

### 2. 添加测试API

将测试API文件添加到项目中：

```javascript
// 在 mail-worker/src/index.js 中引入
import './api/test-monitoring-api.js';
```

### 3. 创建监控配置

在运行测试前，确保有以下监控配置：

```javascript
// 通过API或前端界面创建
{
  "emailAddress": "test@example.com",
  "aliasType": "exact"
}
{
  "emailAddress": "test+monitoring@gmail.com", 
  "aliasType": "gmail_alias"
}
{
  "emailAddress": "*@example.com",
  "aliasType": "domain_wildcard"
}
```

### 4. 运行完整测试

```bash
# 1. 运行端到端测试
node email-monitoring-e2e-test.js

# 2. 运行前端测试
node frontend-monitoring-test.js

# 3. 执行数据库验证查询
# 使用D1控制台或数据库工具执行 monitoring-test-verification.sql
```

## 测试结果解读

### 成功指标

- ✅ 所有测试场景通过
- ✅ 监控匹配记录正确创建
- ✅ JSON数据格式正确
- ✅ 前端界面正常显示
- ✅ API响应正常

### 常见问题

#### 1. 监控匹配失败

**症状**: 邮件插入成功但无监控记录
**排查**:
```sql
-- 检查监控配置是否激活
SELECT * FROM monitor_config WHERE is_active = 1 AND is_del = 0;

-- 检查邮件收件人格式
SELECT email_id, recipient FROM email WHERE message_id LIKE '%test-%';
```

#### 2. 前端显示异常

**症状**: 前端无法显示监控邮件
**排查**:
- 检查shareToken是否正确
- 验证API响应格式
- 查看浏览器控制台错误

#### 3. 数据库连接问题

**症状**: 测试API返回数据库错误
**排查**:
- 检查D1数据库配置
- 验证wrangler.toml设置
- 确认数据库表结构

## 性能基准

### 预期性能指标

- **邮件插入**: < 100ms
- **监控匹配**: < 1000ms  
- **API响应**: < 500ms
- **前端加载**: < 2000ms

### 监控指标

```sql
-- 查看匹配延迟
SELECT 
    AVG(ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2)) as avg_delay_seconds
FROM email e
JOIN monitor_email me ON e.email_id = me.email_id
WHERE e.message_id LIKE '%test-%';
```

## 扩展测试

### 添加新测试场景

1. 在 `test-monitoring-api.js` 中添加新场景：

```javascript
{
  name: 'custom_test',
  description: '自定义测试场景',
  emailData: {
    // 邮件数据
  },
  expectedMatches: ['expected@email.com'],
  expectedMatchType: 'exact'
}
```

2. 更新验证逻辑
3. 添加对应的SQL验证查询

### 压力测试

```javascript
// 批量测试示例
for (let i = 0; i < 100; i++) {
  await makeRequest('POST', '/test/simulateEmail', {
    recipient: JSON.stringify([{address: `test${i}@example.com`}])
  });
}
```

## 故障排除

### 日志查看

```bash
# Cloudflare Workers日志
wrangler tail

# 前端控制台
# 打开浏览器开发者工具查看
```

### 数据清理

```sql
-- 清理所有测试数据
DELETE FROM monitor_email WHERE email_id IN (
  SELECT email_id FROM email WHERE message_id LIKE '%test-%'
);
DELETE FROM email WHERE message_id LIKE '%test-%';
```

## 最佳实践

1. **测试隔离** - 使用唯一的测试标识符
2. **数据清理** - 测试后及时清理数据
3. **错误处理** - 完善的错误捕获和报告
4. **性能监控** - 关注响应时间和资源使用
5. **文档更新** - 及时更新测试文档

## 联系支持

如遇到问题，请检查：
1. 系统日志
2. 数据库状态  
3. 网络连接
4. 配置文件

提供详细的错误信息和测试环境描述以便快速定位问题。
