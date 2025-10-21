# 🔒 安全配置指南

> **文档状态**: 活跃维护中
> **最后更新**: 2025-01-14
> **相关修复**: [BUGFIX-ADMIN-SHARE-PERMISSION.md](./BUGFIX-ADMIN-SHARE-PERMISSION.md)

## ⚠️ 重要安全提醒

**此项目包含配置模板，请务必在部署前替换所有示例值为你自己的配置！**

## 🔧 必须修改的配置项

### 1. 域名配置
在 `wrangler.toml` 中修改：
```toml
domain = ["your-domain.com", "your-domain2.com"]
```

### 2. 管理员邮箱
```toml
admin = "admin@your-domain.com"
```

### 3. JWT密钥
**生成安全的随机字符串**：
```bash
# 使用 openssl 生成
openssl rand -hex 32

# 或使用 node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

然后在配置中使用：
```toml
jwt_secret = "your-generated-secure-jwt-secret"
```

### 4. 数据库ID
替换为你的实际数据库ID：
```toml
[[d1_databases]]
database_id = "your-actual-d1-database-id"

[[kv_namespaces]]
id = "your-actual-kv-namespace-id"
```

## 📁 配置文件说明

- `wrangler.toml.example` - 配置模板，复制并重命名为 `wrangler.toml`
- `wrangler-dev.toml` - 开发环境配置
- `wrangler-production.toml` - 生产环境配置
- `wrangler-test.toml` - 测试环境配置

## 🚫 不要提交的文件

确保以下文件不被提交到版本控制：
- `wrangler.toml` (包含真实配置)
- 任何包含真实域名、密码、密钥的文件

## 🔐 环境变量最佳实践

1. **开发环境**: 使用 `example.com` 等示例域名
2. **生产环境**: 使用你的真实域名
3. **JWT密钥**: 每个环境使用不同的安全密钥
4. **数据库**: 开发和生产使用不同的数据库实例

## ✅ 部署前检查清单

- [ ] 已替换所有示例域名为真实域名
- [ ] 已设置安全的JWT密钥
- [ ] 已配置正确的数据库ID
- [ ] 已设置管理员邮箱
- [ ] 已检查没有硬编码的敏感信息
- [ ] 已确保配置文件不会被意外提交

## 🛡️ 安全建议

1. **定期轮换JWT密钥**
2. **使用强密码策略**
3. **限制管理员权限**
4. **监控异常访问**
5. **定期备份数据**

## 📞 支持

如有安全相关问题，请通过安全渠道联系项目维护者。
