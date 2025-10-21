# 📋 测试改进路线图

## 当前状态 vs 目标状态

| 方面 | 当前 | 目标 |
|------|------|------|
| 测试类型 | 仅 fast-check（不适合） | 单元 + 集成 + E2E |
| 代码覆盖 | 10% | 80%+ |
| 真实性 | 虚假通过 | 真实验证 |
| 发现 bug 能力 | 0% | 85%+ |
| 执行时间 | 2.75s | <5s |

---

## 第一阶段：诊断和规划（1-2 天）

### 1.1 删除虚假测试
```bash
# 备份当前测试（以防需要参考）
mv src/**/*.test.js src/**/*.test.js.backup

# 保留配置文件
# vitest.config.property.js 可以删除或改名
```

### 1.2 建立测试环境
```bash
# 安装必要的依赖
npm install --save-dev \
  @cloudflare/workers-types \
  miniflare \
  better-sqlite3 \
  @vitest/ui

# 创建测试配置
# vitest.config.integration.js
# vitest.config.unit.js
```

### 1.3 分析代码结构
- [ ] 识别所有需要测试的函数
- [ ] 分类：纯函数 vs 依赖外部服务
- [ ] 识别关键业务逻辑
- [ ] 识别安全关键代码

---

## 第二阶段：单元测试（3-5 天）

### 2.1 纯函数单元测试

**优先级 P0（关键）：**
- [ ] `shareService.getBaseUrl()` - 协议和域名检测
- [ ] `shareService.validateEmail()` - 邮箱验证
- [ ] `shareService.generateToken()` - Token 生成
- [ ] `verifyUtils.*` - 验证工具函数
- [ ] `sanitizeUtils.*` - 数据清理函数

**示例：**
```javascript
describe('shareService.getBaseUrl', () => {
  it('should detect HTTPS for production', () => {
    const url = shareService.getBaseUrl(mockContext);
    expect(url).toMatch(/^https:\/\//);
  });
  
  it('should use HTTP for localhost', () => {
    mockContext.env.domain = ['localhost:3000'];
    const url = shareService.getBaseUrl(mockContext);
    expect(url).toMatch(/^http:\/\//);
  });
});
```

### 2.2 业务逻辑单元测试

**优先级 P1（重要）：**
- [ ] 邮箱列表解析和去重
- [ ] 过期时间计算
- [ ] 频率限制参数验证
- [ ] Token 唯一性验证

---

## 第三阶段：集成测试（5-7 天）

### 3.1 数据库集成测试

**使用 SQLite + Drizzle ORM：**
```javascript
describe('shareService - Database Integration', () => {
  let db;
  
  beforeAll(async () => {
    db = new Database(':memory:');
    // 运行迁移
    await runMigrations(db);
  });
  
  it('should create share record in database', async () => {
    const result = await shareService.createShare(mockContext, {
      title: 'Test Share',
      emails: ['user@example.com']
    });
    
    expect(result.id).toBeDefined();
    
    // 验证数据库中确实有记录
    const record = db.query('SELECT * FROM share WHERE id = ?')
      .get(result.id);
    expect(record).toBeDefined();
  });
});
```

### 3.2 KV 存储集成测试

**使用 Miniflare 模拟 Cloudflare Workers：**
```javascript
describe('shareCaptchaService - KV Integration', () => {
  let mf;
  
  beforeAll(() => {
    mf = new Miniflare({
      kvNamespaces: ['KV']
    });
  });
  
  it('should store and retrieve whitelisted IPs', async () => {
    const kv = await mf.getKVNamespace('KV');
    
    await shareCaptchaService.verifyCaptchaToken(
      { env: { KV: kv } },
      validToken,
      '192.168.1.1',
      'token123'
    );
    
    // 验证 KV 中确实有数据
    const value = await kv.get('captcha_verified:192.168.1.1:token123');
    expect(value).toBe('1');
  });
});
```

### 3.3 API 集成测试

**测试完整的 API 流程：**
```javascript
describe('Share API - Integration', () => {
  it('should create share and return token', async () => {
    const response = await app.request(
      new Request('http://localhost/api/share/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test',
          emails: ['user@example.com']
        })
      })
    );
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shareToken).toBeDefined();
  });
});
```

---

## 第四阶段：E2E 测试（可选，第二阶段）

### 4.1 完整用户流程测试
- [ ] 创建分享 → 获取链接 → 访问分享
- [ ] 启用验证码 → 触发限制 → 验证 → 访问
- [ ] 管理分享 → 更新设置 → 验证更改

---

## 第五阶段：安全测试（持续）

### 5.1 安全漏洞测试

**SQL 注入防护：**
```javascript
it('should prevent SQL injection', async () => {
  const maliciousInput = "'; DROP TABLE share; --";
  
  const result = await shareService.createShare(mockContext, {
    title: maliciousInput,
    emails: ['user@example.com']
  });
  
  // 应该安全处理，不执行 SQL
  expect(result.title).toBe(maliciousInput);
  
  // 验证表仍然存在
  const tables = db.query(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all();
  expect(tables.some(t => t.name === 'share')).toBe(true);
});
```

**XSS 防护：**
```javascript
it('should prevent XSS attacks', async () => {
  const xssPayload = '<script>alert("xss")</script>';
  
  const result = await shareService.createShare(mockContext, {
    title: xssPayload,
    emails: ['user@example.com']
  });
  
  // 应该被转义或清理
  expect(result.title).not.toContain('<script>');
});
```

---

## 实施时间表

| 阶段 | 任务 | 时间 | 优先级 |
|------|------|------|--------|
| 1 | 诊断和规划 | 1-2 天 | P0 |
| 2 | 单元测试 | 3-5 天 | P0 |
| 3 | 集成测试 | 5-7 天 | P0 |
| 4 | E2E 测试 | 3-5 天 | P1 |
| 5 | 安全测试 | 持续 | P0 |

**总计：** 12-20 天

---

## 成功指标

- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试覆盖率 ≥ 60%
- [ ] 所有测试通过
- [ ] 执行时间 < 10 秒
- [ ] 能够发现真实的 bug
- [ ] 代码质量评分 ≥ 85/100

---

## 工具和资源

### 推荐工具
- **Vitest**: 测试框架
- **Miniflare**: Cloudflare Workers 模拟
- **better-sqlite3**: SQLite 数据库
- **@vitest/ui**: 测试 UI
- **c8**: 代码覆盖率

### 参考资源
- [Vitest 文档](https://vitest.dev/)
- [Miniflare 文档](https://miniflare.dev/)
- [Drizzle ORM 测试指南](https://orm.drizzle.team/)
- [OWASP 安全测试指南](https://owasp.org/www-project-web-security-testing-guide/)

---

## 关键决策

### ❌ 不再使用 fast-check
- 原因：不适合测试依赖外部服务的代码
- 替代：单元 + 集成 + E2E 测试

### ✅ 优先级
1. 单元测试（快速反馈）
2. 集成测试（真实验证）
3. E2E 测试（用户流程）
4. 安全测试（持续进行）

### ✅ 测试环境
- 本地：SQLite + Miniflare
- CI/CD：Docker + 真实数据库

