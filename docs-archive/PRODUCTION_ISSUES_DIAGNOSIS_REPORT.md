# 🔍 生产环境邮件分享系统故障诊断报告

**诊断日期**: 2025-10-14  
**诊断环境**: https://7ix.asia/email-share  
**诊断方法**: Playwright 浏览器自动化测试 + 代码审查

---

## 📋 问题总结

### ✅ 问题1: Token刷新逻辑 - **无问题**
**状态**: 代码审查通过,逻辑正确  
**结论**: JWT验证和Token刷新逻辑实现正确,无需修复

### ❌ 问题2: 创建邮件分享失败 - **已复现**
**状态**: 500 Internal Server Error  
**错误信息**: "服务器繁忙,请稍后重试"  
**影响**: 用户无法创建新的邮件分享

### ❌ 问题3: 分享链接域名错误 - **已确认**
**状态**: 数据库数据损坏  
**错误格式**: `https://share_domain/share/4I42NAooS1GA...`  
**正确格式**: `https://7ix.asia/share/4I42NAooS1GA...`  
**影响**: 所有11个现有分享链接无法访问

---

## 🔬 详细诊断过程

### 问题3诊断: 分享链接域名错误

#### 1. 浏览器测试结果
使用 Playwright 访问 https://7ix.asia/email-share,发现所有分享链接显示为:
```
https://share_domain/share/4I42NAooS1GAiiuVqNIy4Oxk2xDiZ4dC
https://share_domain/share/oHmazEtdyQ6Q7R5uTMqz60vaIos0LXWe
https://share_domain/share/TnFhSkrAZOAkpQyOQ2mkQyyEasjsH5Ty
... (共11条记录)
```

#### 2. 根本原因分析

**数据库字段值错误**:
- 数据库表 `share` 中的 `share_domain` 字段存储了字面字符串 `"share_domain"`
- 正确的值应该是实际域名(如 `"7ix.asia"`)或 `NULL`(使用默认域名)

**代码逻辑正确**:
- `getBaseUrl()` 函数实现正确(mail-worker/src/service/share-service.js:11-89)
- 前端域名选择逻辑正确(mail-vue/src/components/share/ShareCreateDialog.vue:527-560)
- 后端保存逻辑正确(mail-worker/src/api/share-api.js:177)

**数据损坏原因推测**:
1. 可能在某次数据库迁移时,使用了错误的 SQL 语句
2. 可能在测试时使用了占位符 `"share_domain"` 并意外提交到生产环境
3. 可能在代码部署时,环境变量配置错误导致数据写入异常

#### 3. 影响评估

**严重程度**: 🔴 **阻塞性问题**

**用户影响**:
1. ❌ 所有现有分享链接完全无法访问(404错误)
2. ❌ 用户无法通过分享链接查看验证码邮件
3. ❌ 分享功能完全失效,影响核心业务流程

**业务逻辑影响**:
1. ❌ 违背了系统核心设计意图:分享链接应该可访问
2. ❌ 影响了用户体验和系统可用性
3. ❌ 可能导致用户流失和信任度下降

---

### 问题2诊断: 创建分享失败

#### 1. 浏览器测试结果

**测试步骤**:
1. 访问 https://7ix.asia/email-share
2. 点击"创建分享"按钮
3. 选择邮箱 `3wrs4@7ix.asia`
4. 点击"创建分享"按钮

**错误现象**:
- 前端提示: "服务器繁忙,请稍后重试"
- 控制台错误: `Failed to load resource: the server responded with a status of 500`
- 网络请求: `POST /api/share/create` 返回 500 状态码

#### 2. 可能原因分析

**后端代码审查** (mail-worker/src/api/share-api.js:22-203):

可能的错误原因:
1. **数据库约束违反**: `share_token` 字段有 UNIQUE 约束,可能生成了重复的 token
2. **必填字段缺失**: 虽然代码中有默认值,但可能在某些情况下未正确设置
3. **数据类型不匹配**: 布尔值转整数时可能出现问题
4. **环境变量缺失**: `c.env.domain` 可能未正确配置

**需要检查的日志**:
- Cloudflare Workers 日志中的详细错误堆栈
- 数据库操作失败的具体原因
- `console.error('Create share error:', error)` 的输出

#### 3. 影响评估

**严重程度**: 🔴 **阻塞性问题**

**用户影响**:
1. ❌ 无法创建新的邮件分享
2. ❌ 核心功能完全不可用
3. ❌ 用户体验严重受损

---

## 🛠️ 修复方案

### 修复问题3: 分享链接域名错误

#### 方案1: 数据库修复脚本(推荐)

**文件**: `mail-worker/migrations/005_fix_share_domain_data.sql`

**执行步骤**:
```bash
# 1. 备份数据库(重要!)
npx wrangler d1 backup create cloud-mail-db

# 2. 执行修复脚本
npx wrangler d1 execute cloud-mail-db --remote --file=./mail-worker/migrations/005_fix_share_domain_data.sql

# 3. 验证修复结果
npx wrangler d1 execute cloud-mail-db --remote --command="SELECT share_id, target_email, share_domain FROM share LIMIT 5"
```

**修复逻辑**:
```sql
-- 将所有错误的 share_domain 值更新为 NULL
UPDATE share 
SET share_domain = NULL 
WHERE share_domain = 'share_domain';
```

**预期结果**:
- 所有分享链接将使用默认域名 `7ix.asia`
- 链接格式变为: `https://7ix.asia/share/4I42NAooS1GA...`
- 所有分享链接恢复可访问状态

#### 方案2: 手动SQL修复(备选)

如果无法执行迁移脚本,可以通过 Cloudflare Dashboard 手动执行:

1. 登录 Cloudflare Dashboard
2. 进入 D1 数据库 `cloud-mail-db`
3. 执行以下 SQL:
```sql
UPDATE share SET share_domain = NULL WHERE share_domain = 'share_domain';
```

---

### 修复问题2: 创建分享失败

#### 步骤1: 查看生产环境日志

**Cloudflare Workers 日志查看**:
```bash
npx wrangler tail --env production
```

**关键日志位置**:
- `mail-worker/src/api/share-api.js:197` - 捕获的错误信息
- `mail-worker/src/service/share-service.js:146` - 数据库插入操作

#### 步骤2: 验证环境变量配置

**检查 `wrangler-production.toml`**:
```toml
[env.production.vars]
domain = '["7ix.asia"]'  # 确保格式正确
admin = "admin@7ix.asia"
```

#### 步骤3: 测试Token生成唯一性

**可能的修复代码** (如果是 token 重复问题):
```javascript
// mail-worker/src/service/share-service.js:112
// 添加重试逻辑
let shareToken;
let retries = 0;
const MAX_RETRIES = 5;

while (retries < MAX_RETRIES) {
    shareToken = cryptoUtils.genRandomStr(32);
    
    // 检查 token 是否已存在
    const existing = await orm(c).select().from(share)
        .where(eq(share.shareToken, shareToken))
        .get();
    
    if (!existing) {
        break; // Token 唯一,退出循环
    }
    
    retries++;
    console.warn(`Token collision detected, retry ${retries}/${MAX_RETRIES}`);
}

if (retries >= MAX_RETRIES) {
    throw new BizError('无法生成唯一的分享Token,请稍后重试', 500);
}
```

---

## 📊 验证清单

### 问题3修复验证

- [ ] 执行数据库修复脚本
- [ ] 刷新分享列表页面
- [ ] 验证所有分享链接格式为 `https://7ix.asia/share/...`
- [ ] 点击任意分享链接,确认可以正常访问
- [ ] 创建新的分享,验证域名字段正确保存

### 问题2修复验证

- [ ] 查看 Cloudflare Workers 日志,确认具体错误原因
- [ ] 修复代码或配置问题
- [ ] 重新部署到生产环境
- [ ] 尝试创建新的分享,验证成功
- [ ] 检查数据库中新创建的分享记录

---

## 🚀 部署步骤

### 1. 执行数据库修复

```bash
# 备份数据库
npx wrangler d1 backup create cloud-mail-db

# 执行修复脚本
npx wrangler d1 execute cloud-mail-db --remote --file=./mail-worker/migrations/005_fix_share_domain_data.sql
```

### 2. 验证修复结果

```bash
# 查询修复后的数据
npx wrangler d1 execute cloud-mail-db --remote --command="
SELECT 
    share_id,
    target_email,
    share_domain,
    CASE 
        WHEN share_domain IS NULL THEN '使用默认域名'
        WHEN share_domain = 'share_domain' THEN '错误数据'
        ELSE '自定义域名: ' || share_domain
    END as domain_status
FROM share 
ORDER BY create_time DESC 
LIMIT 10
"
```

### 3. 刷新浏览器验证

1. 访问 https://7ix.asia/email-share
2. 刷新页面(Ctrl+F5 强制刷新)
3. 检查所有分享链接是否显示为 `https://7ix.asia/share/...`
4. 点击任意链接验证可访问性

---

## 📝 后续建议

### 1. 添加数据验证

**在创建分享时验证域名格式**:
```javascript
// mail-worker/src/api/share-api.js
if (shareDomain && shareDomain.trim()) {
    // 验证域名格式
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}(:\d+)?$/i;
    if (!domainRegex.test(shareDomain)) {
        throw new BizError('无效的域名格式', 400);
    }
    
    // 防止保存占位符
    if (shareDomain === 'share_domain' || shareDomain.includes('{{')) {
        throw new BizError('域名不能包含占位符', 400);
    }
}
```

### 2. 添加数据库约束

```sql
-- 添加 CHECK 约束防止错误数据
ALTER TABLE share ADD CONSTRAINT check_share_domain 
CHECK (share_domain IS NULL OR (share_domain != 'share_domain' AND share_domain NOT LIKE '%{{%'));
```

### 3. 添加监控告警

- 监控分享创建失败率
- 监控分享链接访问404率
- 设置告警阈值,及时发现问题

---

## 🎯 总结

### 问题根本原因

1. **问题3**: 数据库中 `share_domain` 字段被错误地设置为字面字符串 `"share_domain"`
2. **问题2**: 需要查看生产环境日志才能确定具体原因(可能是 token 重复或环境变量问题)

### 修复优先级

1. 🔴 **P0**: 立即执行数据库修复脚本,恢复现有分享链接
2. 🔴 **P0**: 查看生产日志,定位创建分享失败的具体原因
3. 🟡 **P1**: 添加数据验证和约束,防止类似问题再次发生
4. 🟢 **P2**: 添加监控告警,提高系统可观测性

### 预计修复时间

- 问题3修复: 5分钟(执行SQL脚本)
- 问题2诊断: 10-30分钟(查看日志+定位问题)
- 问题2修复: 10-60分钟(取决于具体原因)
- 总计: 25-95分钟

---

**报告生成时间**: 2025-10-14 17:15:00  
**诊断工具**: Playwright Browser Automation + Code Review  
**测试环境**: https://7ix.asia/email-share

