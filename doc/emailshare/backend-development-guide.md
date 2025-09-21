# 邮件模板扩展系统 - 后端开发指导文档

## 📋 开发概览

### 技术栈
- **Hono.js 4.9.6** + Cloudflare Workers
- **Drizzle ORM 0.42.0** + D1 数据库
- **JWT认证** + KV存储缓存
- **TypeScript** + 现有业务逻辑复用

### 项目结构规范
```
mail-worker/src/
├── api/template-*.js        # 模板相关API
├── service/template-*.js    # 模板业务服务
├── entity/template.js       # 模板数据实体
└── utils/template-utils.js  # 模板工具函数
```

## 🎯 开发任务清单

### 阶段一：数据库设计与迁移（1天）

#### 1.1 数据表设计
**新建文件**: `src/entity/template.js`
```javascript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const emailTemplate = sqliteTable('email_template', {
    templateId: integer('template_id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    templateName: text('template_name').notNull(),
    templateType: integer('template_type').default(0), // 0:用户自定义 1:系统预定义
    senderPattern: text('sender_pattern').notNull(),
    subjectPattern: text('subject_pattern').default('.*'),
    verificationCodePattern: text('verification_code_pattern').default('(\\d{4,8})'),
    contentStructure: text('content_structure').default('{}'),
    extractRules: text('extract_rules').default('{}'),
    validationRules: text('validation_rules').default('{}'),
    priority: integer('priority').default(0),
    isActive: integer('is_active').default(1),
    usageCount: integer('usage_count').default(0),
    successRate: real('success_rate').default(0.0),
    createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`),
    updateTime: text('update_time').default(sql`CURRENT_TIMESTAMP`),
    isDel: integer('is_del').default(0)
});

export const templateField = sqliteTable('template_field', {
    fieldId: integer('field_id').primaryKey({ autoIncrement: true }),
    templateId: integer('template_id').notNull(),
    fieldName: text('field_name').notNull(),
    fieldType: text('field_type').notNull(),
    extractPattern: text('extract_pattern').notNull(),
    extractMethod: text('extract_method').default('regex'),
    validationRule: text('validation_rule').default(''),
    isRequired: integer('is_required').default(1),
    sortOrder: integer('sort_order').default(0),
    createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`)
});

export const templateUsageLog = sqliteTable('template_usage_log', {
    logId: integer('log_id').primaryKey({ autoIncrement: true }),
    templateId: integer('template_id').notNull(),
    userId: integer('user_id').notNull(),
    emailId: integer('email_id'),
    matchResult: integer('match_result').default(0),
    extractedFields: text('extracted_fields').default('{}'),
    confidenceScore: real('confidence_score').default(0.0),
    processingTime: integer('processing_time').default(0),
    createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`)
});
```

#### 1.2 数据库迁移脚本
**修改文件**: `src/init/init.js`
```javascript
// 在现有版本升级方法后添加
async v2_2DB(c) {
    console.log('开始迁移到版本 2.2 - 邮件模板系统...');
    
    // 创建邮件模板表
    await c.env.db.prepare(`
        CREATE TABLE IF NOT EXISTS email_template (
            template_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            template_name TEXT NOT NULL,
            template_type INTEGER DEFAULT 0,
            sender_pattern TEXT NOT NULL,
            subject_pattern TEXT DEFAULT '.*',
            verification_code_pattern TEXT DEFAULT '(\\\\d{4,8})',
            content_structure TEXT DEFAULT '{}',
            extract_rules TEXT DEFAULT '{}',
            validation_rules TEXT DEFAULT '{}',
            priority INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            usage_count INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 0.0,
            create_time TEXT DEFAULT CURRENT_TIMESTAMP,
            update_time TEXT DEFAULT CURRENT_TIMESTAMP,
            is_del INTEGER DEFAULT 0
        )
    `).run();

    // 创建模板字段映射表
    await c.env.db.prepare(`
        CREATE TABLE IF NOT EXISTS template_field (
            field_id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            field_type TEXT NOT NULL,
            extract_pattern TEXT NOT NULL,
            extract_method TEXT DEFAULT 'regex',
            validation_rule TEXT DEFAULT '',
            is_required INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            create_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 创建使用统计表
    await c.env.db.prepare(`
        CREATE TABLE IF NOT EXISTS template_usage_log (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            email_id INTEGER,
            match_result INTEGER DEFAULT 0,
            extracted_fields TEXT DEFAULT '{}',
            confidence_score REAL DEFAULT 0.0,
            processing_time INTEGER DEFAULT 0,
            create_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();

    // 创建索引
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_template_user_active ON email_template(user_id, is_active, is_del)',
        'CREATE INDEX IF NOT EXISTS idx_template_type_priority ON email_template(template_type, priority DESC)',
        'CREATE INDEX IF NOT EXISTS idx_field_template ON template_field(template_id, sort_order)',
        'CREATE INDEX IF NOT EXISTS idx_usage_template_time ON template_usage_log(template_id, create_time DESC)'
    ];

    for (const indexSql of indexes) {
        await c.env.db.prepare(indexSql).run();
    }

    // 初始化系统预定义模板
    await this.initSystemTemplates(c);
    
    console.log('版本 2.2 迁移完成');
}

async initSystemTemplates(c) {
    const systemTemplates = [
        {
            userId: 0,
            templateName: 'GitHub 验证码邮件',
            templateType: 1,
            senderPattern: 'github|noreply@github\\.com',
            subjectPattern: 'verification code|sign.in|two.factor',
            verificationCodePattern: '(\\d{6})',
            priority: 90
        },
        {
            userId: 0,
            templateName: '微信验证码邮件',
            templateType: 1,
            senderPattern: 'wechat|weixin|腾讯',
            subjectPattern: '验证码|verification',
            verificationCodePattern: '验证码[：:]\\s*(\\d{4,6})',
            priority: 85
        }
    ];

    for (const template of systemTemplates) {
        await orm(c).insert(emailTemplate).values(template).run();
    }
}
```

### 阶段二：API接口开发（2天）

#### 2.1 模板管理API
**新建文件**: `src/api/template-api.js`
```javascript
import app from '../hono/hono';
import templateService from '../service/template-service';
import userContext from '../security/user-context';
import result from '../model/result';

// 获取模板列表
app.get('/template/list', async (c) => {
    const data = await templateService.list(c, c.req.query(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 创建模板
app.post('/template/create', async (c) => {
    const data = await templateService.create(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 更新模板
app.put('/template/update', async (c) => {
    await templateService.update(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok());
});

// 删除模板
app.delete('/template/delete', async (c) => {
    await templateService.delete(c, c.req.query(), userContext.getUserId(c));
    return c.json(result.ok());
});

// 测试模板
app.post('/template/test', async (c) => {
    const data = await templateService.testTemplate(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 更新模板状态
app.put('/template/status', async (c) => {
    await templateService.updateStatus(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok());
});
```

#### 2.2 模板导入导出API
**新建文件**: `src/api/template-import-api.js`
```javascript
import app from '../hono/hono';
import templateImportService from '../service/template-import-service';
import userContext from '../security/user-context';
import result from '../model/result';

// 验证导入文件
app.post('/template/import/validate', async (c) => {
    const data = await templateImportService.validateImport(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 执行导入
app.post('/template/import/execute', async (c) => {
    const data = await templateImportService.executeImport(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 导出模板
app.get('/template/export', async (c) => {
    const data = await templateImportService.exportTemplates(c, c.req.query(), userContext.getUserId(c));
    return c.json(result.ok(data));
});
```

#### 2.3 字段提取API
**新建文件**: `src/api/template-field-api.js`
```javascript
import app from '../hono/hono';
import fieldExtractService from '../service/field-extract-service';
import userContext from '../security/user-context';
import result from '../model/result';

// 智能字段提取
app.post('/template/extract-fields', async (c) => {
    const data = await fieldExtractService.extractFields(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});

// 批量字段提取
app.post('/template/batch-extract', async (c) => {
    const data = await fieldExtractService.batchExtract(c, await c.req.json(), userContext.getUserId(c));
    return c.json(result.ok(data));
});
```

### 阶段三：业务服务开发（2天）

#### 3.1 模板核心服务
**新建文件**: `src/service/template-service.js`
```javascript
import { orm } from '../db/db';
import { emailTemplate, templateField, templateUsageLog } from '../entity/template';
import { eq, and, desc, like, or, count } from 'drizzle-orm';
import BizError from '../model/biz-error';
import { t } from '../utils/i18n-utils';

const templateService = {
    // 获取模板列表（带权限控制）
    async list(c, params, userId) {
        const { page = 1, pageSize = 10, templateType, isActive, keyword } = params;
        const offset = (page - 1) * pageSize;

        let whereConditions = [eq(emailTemplate.isDel, 0)];

        // 权限控制：用户只能看到自己的模板和系统模板
        if (userId !== 0) {
            whereConditions.push(
                or(
                    eq(emailTemplate.userId, userId),
                    eq(emailTemplate.templateType, 1)
                )
            );
        }

        if (templateType !== undefined) {
            whereConditions.push(eq(emailTemplate.templateType, templateType));
        }

        if (isActive !== undefined) {
            whereConditions.push(eq(emailTemplate.isActive, isActive));
        }

        if (keyword) {
            whereConditions.push(
                or(
                    like(emailTemplate.templateName, `%${keyword}%`),
                    like(emailTemplate.senderPattern, `%${keyword}%`)
                )
            );
        }

        const templates = await orm(c).select()
            .from(emailTemplate)
            .where(and(...whereConditions))
            .orderBy(desc(emailTemplate.priority), desc(emailTemplate.createTime))
            .limit(pageSize)
            .offset(offset)
            .all();

        const total = await orm(c).select({ count: count() })
            .from(emailTemplate)
            .where(and(...whereConditions))
            .get();

        return {
            templates,
            pagination: {
                total: total.count,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(total.count / pageSize)
            }
        };
    },

    // 创建模板（带安全验证）
    async create(c, params, userId) {
        const {
            templateName,
            senderPattern,
            subjectPattern = '.*',
            verificationCodePattern = '(\\d{4,8})',
            contentStructure = {},
            extractRules = {},
            validationRules = {},
            priority = 0,
            fields = []
        } = params;

        // 验证模板名称唯一性
        const existingTemplate = await orm(c).select()
            .from(emailTemplate)
            .where(
                and(
                    eq(emailTemplate.templateName, templateName),
                    eq(emailTemplate.userId, userId),
                    eq(emailTemplate.isDel, 0)
                )
            ).get();

        if (existingTemplate) {
            throw new BizError(t('templateNameExists'), 400);
        }

        // 验证正则表达式安全性
        this.validateRegexSafety(senderPattern);
        this.validateRegexSafety(subjectPattern);
        this.validateRegexSafety(verificationCodePattern);

        // 创建模板
        const templateData = {
            userId,
            templateName,
            templateType: 0,
            senderPattern,
            subjectPattern,
            verificationCodePattern,
            contentStructure: JSON.stringify(contentStructure),
            extractRules: JSON.stringify(extractRules),
            validationRules: JSON.stringify(validationRules),
            priority
        };

        const result = await orm(c).insert(emailTemplate)
            .values(templateData)
            .returning()
            .get();

        // 创建字段映射
        if (fields && fields.length > 0) {
            const fieldData = fields.map((field, index) => ({
                templateId: result.templateId,
                fieldName: field.fieldName,
                fieldType: field.fieldType,
                extractPattern: field.extractPattern,
                extractMethod: field.extractMethod || 'regex',
                validationRule: field.validationRule || '',
                isRequired: field.isRequired ? 1 : 0,
                sortOrder: index
            }));

            await orm(c).insert(templateField).values(fieldData).run();
        }

        return result;
    },

    // 正则表达式安全验证
    validateRegexSafety(pattern) {
        // 检查危险模式
        const dangerousPatterns = [
            /\(\?\=.*\)\+/,           // 正向前瞻 + 量词
            /\(\?\!.*\)\+/,           // 负向前瞻 + 量词
            /\(\.\*\)\+/,             // (.*)+
            /\(\.\+\)\+/,             // (.+)+
            /\(\w\*\)\+/,             // (\w*)+
            /\(\w\+\)\+/              // (\w+)+
        ];
        
        for (const dangerous of dangerousPatterns) {
            if (dangerous.test(pattern)) {
                throw new BizError('检测到潜在的危险正则表达式模式', 400);
            }
        }
        
        // 长度限制
        if (pattern.length > 500) {
            throw new BizError('正则表达式长度不能超过500字符', 400);
        }
        
        // 复杂度检查
        const complexityScore = (pattern.match(/[\(\)\[\]\{\}\*\+\?]/g) || []).length;
        if (complexityScore > 50) {
            throw new BizError('正则表达式过于复杂', 400);
        }
    },

    // 测试模板
    async testTemplate(c, params, userId) {
        const { templateData, testEmail } = params;
        
        const startTime = Date.now();
        
        // 执行模板匹配和字段提取
        const extractionResult = await this.executeTemplateExtraction(c, templateData, testEmail);
        
        const processingTime = Date.now() - startTime;
        
        return {
            ...extractionResult,
            processingTime
        };
    },

    // 执行模板提取
    async executeTemplateExtraction(c, template, email) {
        const extractRules = typeof template.extractRules === 'string' 
            ? JSON.parse(template.extractRules || '{}') 
            : template.extractRules || {};
        
        const result = {
            templateMatched: false,
            templateId: template.templateId || 0,
            templateName: template.templateName,
            confidenceScore: 0,
            extractedFields: {},
            success: false
        };

        // 验证邮件是否匹配模板
        const senderMatch = new RegExp(template.senderPattern, 'i').test(email.sender || '');
        const subjectMatch = new RegExp(template.subjectPattern, 'i').test(email.subject || '');

        if (!senderMatch && !subjectMatch) {
            return result;
        }

        result.templateMatched = true;
        result.confidenceScore = (senderMatch ? 0.6 : 0) + (subjectMatch ? 0.4 : 0);

        // 提取字段
        const content = email.content || email.text || '';
        const plainText = content.replace(/<[^>]*>/g, '');

        for (const [fieldName, rules] of Object.entries(extractRules)) {
            const fieldResult = await this.extractField(plainText, rules);
            if (fieldResult.value) {
                result.extractedFields[fieldName] = fieldResult;
            }
        }

        result.success = Object.keys(result.extractedFields).length > 0;
        
        return result;
    },

    // 提取单个字段
    async extractField(content, rules) {
        const { patterns, priority = [] } = rules;
        
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const regex = new RegExp(pattern, 'gi');
            const match = content.match(regex);
            
            if (match && match[0]) {
                const codeMatch = match[0].match(/([A-Za-z0-9]{4,8})/);
                if (codeMatch) {
                    return {
                        value: codeMatch[1],
                        confidence: 1.0 - (i * 0.1),
                        pattern: pattern,
                        position: {
                            start: content.indexOf(match[0]),
                            end: content.indexOf(match[0]) + match[0].length
                        }
                    };
                }
            }
        }
        
        return { value: null, confidence: 0 };
    }
};

export default templateService;
```

### 阶段四：系统集成与优化（1天）

#### 4.1 权限系统集成
**修改文件**: `src/security/security.js`
```javascript
// 在 premKey 对象中添加模板权限
const premKey = {
    // 现有权限...
    'template:create': ['/template/create'],
    'template:query': ['/template/list', '/template/test'],
    'template:update': ['/template/update', '/template/status'],
    'template:delete': ['/template/delete'],
    'template:import': ['/template/import/validate', '/template/import/execute'],
    'template:export': ['/template/export'],
    'template:extract': ['/template/extract-fields', '/template/batch-extract']
};
```

#### 4.2 API模块注册
**修改文件**: `src/hono/webs.js`
```javascript
// 添加模板相关API导入
import '../api/template-api';
import '../api/template-import-api';
import '../api/template-field-api';
```

#### 4.3 定时任务集成
**修改文件**: `src/index.js`
```javascript
// 在 scheduled 函数中添加模板清理任务
async scheduled(c, env, ctx) {
    // 现有任务...
    await verifyRecordService.clearRecord({env});
    await userService.resetDaySendCount({ env });
    
    // 新增模板清理任务
    await templateService.cleanExpiredTemplates({ env });
    await templateService.cleanOldUsageLogs({ env });
}
```

## 🔧 现有代码修改点

### 1. 权限初始化
**修改文件**: `src/init/init.js`
```javascript
// 在权限初始化中添加模板相关权限
async initPermissions(c) {
    const templatePerms = [
        { name: '模板管理', permKey: 'template:query', pid: 0, type: 1 },
        { name: '创建模板', permKey: 'template:create', pid: templateQueryId, type: 2 },
        { name: '编辑模板', permKey: 'template:update', pid: templateQueryId, type: 2 },
        { name: '删除模板', permKey: 'template:delete', pid: templateQueryId, type: 2 },
        { name: '导入模板', permKey: 'template:import', pid: templateQueryId, type: 2 },
        { name: '导出模板', permKey: 'template:export', pid: templateQueryId, type: 2 }
    ];
    
    for (const perm of templatePerms) {
        await orm(c).insert(permission).values(perm).run();
    }
}
```

### 2. 错误处理扩展
**修改文件**: `src/hono/hono.js`
```javascript
// 在错误处理中添加模板相关错误
app.onError((err, c) => {
    // 现有错误处理...
    
    // 模板相关错误
    if (err.message.includes('template')) {
        console.error('Template operation failed:', err);
    }
    
    // 正则表达式错误
    if (err.message.includes('Invalid regular expression')) {
        return c.json(result.fail('正则表达式格式错误'), 400);
    }
    
    return c.json(result.fail(err.message, err.code));
});
```

## ⚠️ 安全性与性能注意事项

### 安全性要求
1. **权限验证**: 所有API都要进行用户权限检查
2. **数据隔离**: 用户只能操作自己的模板
3. **输入验证**: 严格验证所有用户输入
4. **正则安全**: 防止ReDoS攻击的正则表达式检查
5. **JSON安全**: 防止恶意JSON注入

### 性能优化
1. **数据库索引**: 为常用查询字段创建索引
2. **分页查询**: 大数据量时使用分页
3. **缓存策略**: 系统模板使用KV缓存
4. **批量操作**: 支持批量创建和更新
5. **异步处理**: 大文件导入使用异步处理

### 错误处理
1. **统一错误格式**: 使用现有的 result.fail() 格式
2. **详细错误日志**: 记录详细的错误信息
3. **用户友好提示**: 提供清晰的错误提示
4. **降级策略**: 关键功能失败时的降级方案

## 🚀 开发时间规划

### 第1天：数据库设计
- 上午：表结构设计、实体定义
- 下午：迁移脚本、索引优化

### 第2天：API开发
- 上午：模板管理API、权限集成
- 下午：导入导出API、字段提取API

### 第3天：业务服务
- 上午：核心服务逻辑、安全验证
- 下午：导入服务、字段提取服务

### 第4天：集成优化
- 上午：系统集成、错误处理
- 下午：性能优化、测试验证

## 📝 交付物检查清单

- [ ] 数据库表结构创建完成
- [ ] 数据迁移脚本测试通过
- [ ] 所有API接口开发完成
- [ ] 权限控制正确配置
- [ ] 业务服务逻辑完善
- [ ] 安全验证机制完成
- [ ] 错误处理完善
- [ ] 性能优化完成
- [ ] 单元测试编写完成
- [ ] API文档更新完成
