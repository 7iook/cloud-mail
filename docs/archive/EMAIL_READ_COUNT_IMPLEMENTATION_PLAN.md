# 邮件读取次数功能实现计划

## 📋 需求分析

### 参考网站
**999-sms.com** - 接码平台的读取次数功能

**观察到的功能**：
- 表格显示短信记录，包含"读取次数"列
- 每次用户成功读取验证码，计数 +1
- 实时显示读取次数

### 对应到邮件系统

| 999-sms.com | 我们的邮件系统 |
|-------------|---------------|
| 短信记录 | 邮件记录 |
| 验证码 | 邮件内容 |
| 读取次数 | 邮件查看次数 |

---

## 🎯 功能目标

1. ✅ 记录每封邮件被查看的次数
2. ✅ 每次访问邮件详情时自动增加计数
3. ✅ 在邮件列表和详情页显示读取次数
4. ✅ 支持公开分享邮件的访问计数
5. ✅ 防止恶意刷计数（可选）

---

## 🗄️ 数据库设计

### 新增字段

**表名**: `email`

**字段定义**:
```sql
read_count INTEGER DEFAULT 0 NOT NULL
```

**字段说明**:
- `read_count`: 邮件读取次数
- 默认值: `0`（未读取）
- 类型: `INTEGER`
- 约束: `NOT NULL`

### 与 is_read 的区别

| 字段 | 类型 | 用途 | 值范围 |
|------|------|------|--------|
| `is_read` | INTEGER | 标记是否已读 | 0（未读）/ 1（已读） |
| `read_count` | INTEGER | 记录读取次数 | 0, 1, 2, 3, ... |

**两者关系**:
- `is_read` 是布尔状态（已读/未读）
- `read_count` 是累计计数（查看次数）
- 可以共存，提供不同维度的数据

---

## 🔧 技术实现方案

### 方案选择

**方案 A（推荐）**: 自动增加计数
- 在获取邮件详情时自动增加 `read_count`
- 修改 `emailService.detail()` 方法
- 优点：简单、自动化、不会遗漏
- 缺点：无法区分"预览"和"真正阅读"

**方案 B**: 手动增加计数
- 创建独立的 `incrementReadCount()` API
- 前端在显示邮件时手动调用
- 优点：更灵活，可以控制何时计数
- 缺点：需要前端额外调用，可能遗漏

**最终选择**: **方案 A**（与 999-sms.com 行为一致）

---

## 📝 详细实施步骤

### Step 1: 数据库迁移

#### 1.1 更新 Schema 定义

**文件**: `mail-worker/src/entity/email.js`

```javascript
export const email = sqliteTable('email', {
	// ... 其他字段
	isDel: integer('is_del').default(0).notNull(),
	isRead: integer('is_read').default(0).notNull(),
	readCount: integer('read_count').default(0).notNull()  // ✅ 新增
});
```

#### 1.2 创建迁移方法

**文件**: `mail-worker/src/init/init.js`

```javascript
async v2_5DB(c) {
	// 添加邮件读取次数字段
	try {
		await c.env.db.prepare(`
			ALTER TABLE email 
			ADD COLUMN read_count INTEGER DEFAULT 0 NOT NULL;
		`).run();
		console.log('邮件读取次数字段添加成功');
	} catch (e) {
		console.warn(`跳过邮件读取次数字段添加，原因：${e.message}`);
	}
}
```

#### 1.3 更新 init 方法

```javascript
async init(c) {
	// ... 其他初始化
	await this.v2_4DB(c); // 添加邮件已读状态字段
	await this.v2_5DB(c); // ✅ 添加邮件读取次数字段
	await settingService.refresh(c);
	return c.text(t('initSuccess'));
}
```

#### 1.4 生产数据库迁移

**执行方式**: 通过 Cloudflare Dashboard 控制台

```sql
ALTER TABLE email ADD COLUMN read_count INTEGER DEFAULT 0 NOT NULL;
```

#### 1.5 创建迁移文档

**文件**: `mail-worker/migrations/005_add_email_read_count.sql`

```sql
-- 添加邮件读取次数字段
-- Migration: v2.5
-- Date: 2025-10-15
-- Description: 为 email 表添加 read_count 字段，记录邮件被查看的次数

ALTER TABLE email ADD COLUMN read_count INTEGER DEFAULT 0 NOT NULL;

-- 字段说明：
-- read_count: 邮件读取次数
--   默认值: 0（未读取）
--   每次访问邮件详情时自动 +1

-- 注意：
-- 1. 与 is_read 字段不同，read_count 记录累计查看次数
-- 2. 支持多次查看同一邮件
-- 3. 使用原子操作确保并发安全
```

---

### Step 2: 后端实现

#### 2.1 修改邮件详情服务

**文件**: `mail-worker/src/service/email-service.js`

**修改 `detail()` 方法**:

```javascript
async detail(c, emailId, userId) {
	emailId = Number(emailId);
	
	// 1. 验证邮件权限
	const emailRow = await orm(c).select().from(email)
		.where(and(
			eq(email.emailId, emailId),
			eq(email.userId, userId),
			eq(email.isDel, isDel.NORMAL)
		))
		.get();

	if (!emailRow) {
		throw new BizError(t('noUserEmail'));
	}

	// 2. 原子操作增加读取次数
	await orm(c).update(email)
		.set({ 
			readCount: sql`${email.readCount} + 1`,  // ✅ 原子操作
			isRead: 1  // 同时标记为已读
		})
		.where(eq(email.emailId, emailId))
		.run();

	// 3. 获取更新后的邮件详情
	const updatedEmail = await orm(c).select().from(email)
		.where(eq(email.emailId, emailId))
		.get();

	// 4. 获取附件信息
	const attachmentList = await orm(c).select().from(attachments)
		.where(eq(attachments.emailId, emailId))
		.all();

	return {
		...updatedEmail,
		attachments: attachmentList
	};
}
```

**关键点**:
- ✅ 使用 `sql\`${email.readCount} + 1\`` 确保原子操作
- ✅ 同时更新 `isRead` 和 `readCount`
- ✅ 返回更新后的数据（包含最新的 readCount）

#### 2.2 更新查询方法

**文件**: `mail-worker/src/service/public-service.js`

```javascript
const query = orm(c).select({
	emailId: email.emailId,
	// ... 其他字段
	isDel: email.isDel,
	isRead: email.isRead,
	readCount: email.readCount,  // ✅ 新增
}).from(email)
```

#### 2.3 可选：创建独立查询 API

**文件**: `mail-worker/src/service/email-service.js`

```javascript
/**
 * 获取邮件读取次数（不增加计数）
 * @param {Object} c - Hono context
 * @param {number|string} emailId - 邮件ID
 * @returns {Promise<number>}
 */
async getReadCount(c, emailId) {
	emailId = Number(emailId);
	
	const result = await orm(c).select({ readCount: email.readCount })
		.from(email)
		.where(eq(email.emailId, emailId))
		.get();
	
	return result?.readCount || 0;
}
```

**对应 API 端点**:

**文件**: `mail-worker/src/api/email-api.js`

```javascript
// 获取邮件读取次数（不增加计数）
app.get('/email/readCount', async (c) => {
	const { emailId } = c.req.query();
	const count = await emailService.getReadCount(c, emailId);
	return c.json(result.ok({ readCount: count }));
});
```

---

### Step 3: 前端实现

#### 3.1 更新 API 请求方法

**文件**: `mail-vue/src/request/email.js`

```javascript
// 获取邮件读取次数
export function getEmailReadCount(emailId) {
    return http.get(`/email/readCount?emailId=${emailId}`)
}
```

#### 3.2 邮件列表组件

**文件**: `mail-vue/src/views/email/index.vue`

**添加表格列**:

```vue
<template>
  <el-table :data="emailList">
    <!-- 其他列 -->
    <el-table-column label="已读状态" width="100">
      <template #default="{ row }">
        <el-tag :type="row.isRead ? 'success' : 'info'">
          {{ row.isRead ? '已读' : '未读' }}
        </el-tag>
      </template>
    </el-table-column>
    
    <!-- ✅ 新增：读取次数列 -->
    <el-table-column label="读取次数" width="100" align="center">
      <template #default="{ row }">
        <el-badge :value="row.readCount" :max="99" class="read-count-badge">
          <el-icon :size="20" :color="row.readCount > 0 ? '#409EFF' : '#909399'">
            <View />
          </el-icon>
        </el-badge>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.read-count-badge {
  cursor: pointer;
}
</style>
```

#### 3.3 邮件详情组件

**文件**: `mail-vue/src/views/email/detail.vue`

```vue
<template>
  <div class="email-detail">
    <div class="email-header">
      <h2>{{ email.subject }}</h2>
      <div class="email-meta">
        <el-tag :type="email.isRead ? 'success' : 'info'">
          {{ email.isRead ? '已读' : '未读' }}
        </el-tag>
        
        <!-- ✅ 新增：读取次数显示 -->
        <el-tag type="info" class="read-count-tag">
          <el-icon><View /></el-icon>
          <span>已查看 {{ email.readCount }} 次</span>
        </el-tag>
      </div>
    </div>
    
    <!-- 邮件内容 -->
    <div class="email-content" v-html="email.content"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getEmailDetail } from '@/request/email'
import { View } from '@element-plus/icons-vue'

const email = ref({})

onMounted(async () => {
  // 获取邮件详情（会自动增加 readCount）
  const res = await getEmailDetail(emailId)
  email.value = res.data
  
  // 注意：此时 email.readCount 已经是增加后的值
  console.log(`本次是第 ${email.value.readCount} 次查看`)
})
</script>

<style scoped>
.read-count-tag {
  margin-left: 10px;
}
</style>
```

#### 3.4 可选：实时更新

**使用轮询**:

```javascript
// 每 30 秒刷新一次读取次数
const refreshReadCount = async () => {
  const res = await getEmailReadCount(emailId)
  email.value.readCount = res.data.readCount
}

onMounted(() => {
  const timer = setInterval(refreshReadCount, 30000)
  onUnmounted(() => clearInterval(timer))
})
```

---

### Step 4: 安全性和性能优化

#### 4.1 防止恶意刷计数（可选）

**方案 1**: IP 限制
```javascript
// 记录每个 IP 的访问时间
const lastAccessTime = await getLastAccessTime(ip, emailId)
const now = Date.now()

if (now - lastAccessTime < 5000) {  // 5秒内不重复计数
  return emailRow  // 直接返回，不增加计数
}

// 更新访问时间
await setLastAccessTime(ip, emailId, now)
```

**方案 2**: 用户限制
```javascript
// 同一用户 5 秒内不重复计数
const cacheKey = `read_count:${userId}:${emailId}`
const cached = await cache.get(cacheKey)

if (cached) {
  return emailRow  // 直接返回，不增加计数
}

await cache.set(cacheKey, '1', 5)  // 5秒过期
```

#### 4.2 性能优化

**异步更新计数**:
```javascript
// 不等待计数更新完成，直接返回邮件详情
const updateCountPromise = orm(c).update(email)
	.set({ readCount: sql`${email.readCount} + 1` })
	.where(eq(email.emailId, emailId))
	.run()

// 立即返回邮件详情
const emailRow = await getEmailDetail(emailId)

// 后台更新计数
updateCountPromise.catch(err => console.error('Update read count failed:', err))

return emailRow
```

---

## 📊 数据展示设计

### 邮件列表

```
┌─────────────────────────────────────────────────────────────┐
│ 序号 │ 主题        │ 发件人    │ 时间       │ 状态 │ 读取次数 │
├─────────────────────────────────────────────────────────────┤
│ 1    │ 验证码邮件  │ noreply   │ 10:30     │ 已读 │    3     │
│ 2    │ 欢迎邮件    │ admin     │ 09:15     │ 未读 │    0     │
│ 3    │ 通知邮件    │ system    │ 昨天      │ 已读 │    1     │
└─────────────────────────────────────────────────────────────┘
```

### 邮件详情

```
┌─────────────────────────────────────────────────────────────┐
│ 验证码邮件                                    [已读] [👁 3次] │
├─────────────────────────────────────────────────────────────┤
│ 发件人: noreply@example.com                                 │
│ 时间: 2025-10-15 10:30:25                                   │
│ 本次是第 3 次查看                                            │
├─────────────────────────────────────────────────────────────┤
│ 您的验证码是：123456                                         │
│ 请在 5 分钟内使用。                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 测试计划

### 单元测试

```javascript
describe('Email Read Count', () => {
  it('should increment read count on detail view', async () => {
    const email = await createTestEmail()
    expect(email.readCount).toBe(0)
    
    await emailService.detail(c, email.emailId, userId)
    const updated = await getEmail(email.emailId)
    expect(updated.readCount).toBe(1)
  })
  
  it('should handle concurrent access', async () => {
    const email = await createTestEmail()
    
    // 并发访问 10 次
    await Promise.all([...Array(10)].map(() => 
      emailService.detail(c, email.emailId, userId)
    ))
    
    const updated = await getEmail(email.emailId)
    expect(updated.readCount).toBe(10)
  })
})
```

### 集成测试

1. ✅ 访问邮件详情，验证 read_count 增加
2. ✅ 刷新页面，验证 read_count 再次增加
3. ✅ 多用户访问同一邮件，验证计数累加
4. ✅ 邮件列表显示正确的 read_count
5. ✅ 公开分享邮件的计数功能

---

## 📚 API 文档

### 获取邮件详情（自动增加计数）

```
GET /email/detail?emailId=123
Authorization: Bearer {token}

Response:
{
  "code": 0,
  "data": {
    "emailId": 123,
    "subject": "验证码邮件",
    "content": "您的验证码是：123456",
    "isRead": 1,
    "readCount": 3,  // ✅ 已增加后的值
    ...
  }
}
```

### 获取读取次数（不增加计数）

```
GET /email/readCount?emailId=123
Authorization: Bearer {token}

Response:
{
  "code": 0,
  "data": {
    "readCount": 3
  }
}
```

---

## 📁 文件清单

### 后端文件
- ✅ `mail-worker/src/entity/email.js` - Schema 定义
- ✅ `mail-worker/src/init/init.js` - 数据库初始化
- ✅ `mail-worker/src/service/email-service.js` - 邮件服务
- ✅ `mail-worker/src/service/public-service.js` - 公共服务
- ✅ `mail-worker/src/api/email-api.js` - API 端点（可选）
- ✅ `mail-worker/migrations/005_add_email_read_count.sql` - 迁移脚本

### 前端文件
- ⏳ `mail-vue/src/request/email.js` - API 请求方法
- ⏳ `mail-vue/src/views/email/index.vue` - 邮件列表组件
- ⏳ `mail-vue/src/views/email/detail.vue` - 邮件详情组件

---

## ⚠️ 注意事项

1. **原子操作**: 必须使用 SQL 原子操作 `read_count = read_count + 1` 避免并发问题
2. **性能影响**: 每次查看邮件都会执行一次 UPDATE 操作，需要考虑性能
3. **防刷机制**: 建议添加 IP 或用户限制，防止恶意刷计数
4. **数据一致性**: 确保 read_count 和 is_read 的逻辑一致
5. **向后兼容**: 现有邮件的 read_count 默认为 0

---

## 🚀 实施优先级

### P0（立即实施）
1. ✅ 数据库添加 read_count 字段
2. ✅ 后端自动增加计数
3. ✅ 前端显示计数

### P1（重要）
4. ✅ 原子操作确保并发安全
5. ✅ 权限验证
6. ✅ 完整测试

### P2（可选）
7. ⏳ 防刷机制
8. ⏳ 实时更新
9. ⏳ 统计分析

---

## 📞 参考资料

- 参考网站: https://999-sms.com/receive/record
- 已读状态实现: `EMAIL_READ_STATUS_IMPLEMENTATION.md`
- Drizzle ORM 文档: https://orm.drizzle.team/

