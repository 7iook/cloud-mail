# 邮件模板扩展系统技术架构文档

## 1. 项目概述与需求分析

### 1.1 现有系统分析

基于代码分析，现有邮件模板系统具备以下特性：

**现有模板结构**（基于 `mail-vue/src/views/monitor/share.vue`）：
```javascript
const augmentCodeTemplate = {
  name: 'Augment Code 验证码邮件',
  senderPattern: /^Augment Code$/i,
  subjectPattern: /^Welcome to Augment Code$/i,
  verificationCodePattern: /Your verification code is:\s*(\d{6})/i,
  extractVerificationCode: (content) => { /* 提取逻辑 */ },
  validateEmail: (email) => { /* 验证逻辑 */ }
};
```

**现有模板管理器**：
```javascript
const emailTemplateManager = {
  templates: commonEmailTemplates,
  addTemplate: (template) => { /* 添加模板 */ },
  matchTemplate: (email) => { /* 匹配模板 */ },
  extractVerificationCode: (email) => { /* 提取验证码 */ },
  analyzeEmail: (email) => { /* 分析邮件 */ }
};
```

### 1.2 扩展需求分析

**核心扩展目标**：
1. **固定模板库扩展**：增加更多预定义邮件模板
2. **用户自定义模板**：支持JSON格式模板导入和管理
3. **智能字段提取**：增强验证码和关键信息提取能力
4. **模板管理界面**：提供完整的前端管理功能

**技术约束**：
- 基于现有 `emailTemplateManager` 架构
- 兼容现有验证码提取逻辑
- 遵循 Vue3 + Element Plus + Hono.js 技术栈
- 确保数据隔离和权限控制

## 2. 系统架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    邮件模板扩展系统                              │
├─────────────────────────────────────────────────────────────────┤
│  前端层 (Vue3 + Element Plus)                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   模板管理界面    │  │   模板导入向导    │  │   字段映射配置    │  │
│  │ TemplateManager │  │ TemplateImport  │  │ FieldMapping    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  API层 (Hono.js)                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │template-api.js  │  │template-import- │  │template-field-  │  │
│  │                 │  │    api.js       │  │    api.js       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  服务层 (Business Logic)                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │template-service │  │template-import- │  │field-extract-   │  │
│  │                 │  │   service       │  │   service       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  存储层                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  D1 Database    │  │   KV Storage    │  │  前端LocalDB    │  │
│  │- email_template │  │- 模板缓存       │  │- 用户偏好设置    │  │
│  │- template_field │  │- 提取规则缓存    │  │- 临时导入数据    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 与现有系统集成方案

**无侵入式扩展**：
- 保持现有 `emailTemplateManager` 接口不变
- 通过扩展方式添加新功能
- 兼容现有验证码提取逻辑

**集成点**：
1. **前端集成**：在现有监控页面添加模板管理标签页
2. **API集成**：在 `mail-worker/src/hono/webs.js` 中添加模板相关API
3. **权限集成**：扩展现有RBAC权限系统
4. **存储集成**：使用现有D1数据库和KV存储

## 3. 数据库设计

### 3.1 新增数据表结构

#### 3.1.1 邮件模板表 (email_template)

```sql
CREATE TABLE email_template (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    template_name TEXT NOT NULL,
    template_type INTEGER DEFAULT 0, -- 0:用户自定义 1:系统预定义
    sender_pattern TEXT NOT NULL,
    subject_pattern TEXT DEFAULT '.*',
    verification_code_pattern TEXT DEFAULT '(\\d{4,8})',
    content_structure TEXT DEFAULT '{}', -- JSON格式的内容结构定义
    extract_rules TEXT DEFAULT '{}', -- JSON格式的提取规则
    validation_rules TEXT DEFAULT '{}', -- JSON格式的验证规则
    priority INTEGER DEFAULT 0, -- 模板优先级，数字越大优先级越高
    is_active INTEGER DEFAULT 1, -- 是否启用
    usage_count INTEGER DEFAULT 0, -- 使用次数统计
    success_rate REAL DEFAULT 0.0, -- 成功率统计
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    update_time TEXT DEFAULT CURRENT_TIMESTAMP,
    is_del INTEGER DEFAULT 0
);
```

#### 3.1.2 模板字段映射表 (template_field)

```sql
CREATE TABLE template_field (
    field_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    field_name TEXT NOT NULL, -- 字段名称（如：verificationCode, otp, pin等）
    field_type TEXT NOT NULL, -- 字段类型（code, email, phone, url等）
    extract_pattern TEXT NOT NULL, -- 提取正则表达式
    extract_method TEXT DEFAULT 'regex', -- 提取方法：regex, position, keyword
    validation_rule TEXT DEFAULT '', -- 验证规则
    is_required INTEGER DEFAULT 1, -- 是否必需字段
    sort_order INTEGER DEFAULT 0, -- 排序顺序
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES email_template(template_id)
);
```

#### 3.1.3 模板使用统计表 (template_usage_log)

```sql
CREATE TABLE template_usage_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    email_id INTEGER, -- 关联的邮件ID
    match_result INTEGER DEFAULT 0, -- 匹配结果：0失败 1成功
    extracted_fields TEXT DEFAULT '{}', -- JSON格式的提取结果
    confidence_score REAL DEFAULT 0.0, -- 置信度分数
    processing_time INTEGER DEFAULT 0, -- 处理时间（毫秒）
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES email_template(template_id)
);
```

### 3.2 数据库索引优化

```sql
-- 模板查询优化索引
CREATE INDEX idx_template_user_active ON email_template(user_id, is_active, is_del);
CREATE INDEX idx_template_type_priority ON email_template(template_type, priority DESC);
CREATE INDEX idx_template_usage ON email_template(usage_count DESC, success_rate DESC);

-- 字段映射查询索引
CREATE INDEX idx_field_template ON template_field(template_id, sort_order);
CREATE INDEX idx_field_type ON template_field(field_type, is_required);

-- 使用统计查询索引
CREATE INDEX idx_usage_template_time ON template_usage_log(template_id, create_time DESC);
CREATE INDEX idx_usage_user_result ON template_usage_log(user_id, match_result);
```

### 3.3 数据迁移方案

在 `mail-worker/src/init/init.js` 中添加版本升级方法：

```javascript
async v2_2DB(c) {
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
}

async initSystemTemplates(c) {
    const systemTemplates = [
        {
            templateName: 'GitHub 验证码邮件',
            templateType: 1,
            senderPattern: 'github|noreply@github\\.com',
            subjectPattern: 'verification code|sign.in|two.factor',
            verificationCodePattern: '(\\d{6})',
            contentStructure: JSON.stringify({
                greeting: 'verification code:',
                codeSection: '\\d{6}',
                footer: 'github'
            }),
            extractRules: JSON.stringify({
                verificationCode: {
                    patterns: [
                        'verification code:\\s*(\\d{6})',
                        'your code is:\\s*(\\d{6})',
                        '\\b(\\d{6})\\b'
                    ],
                    priority: [1, 2, 3]
                }
            }),
            priority: 90
        },
        {
            templateName: '微信验证码邮件',
            templateType: 1,
            senderPattern: 'wechat|weixin|腾讯',
            subjectPattern: '验证码|verification',
            verificationCodePattern: '验证码[：:]\\s*(\\d{4,6})',
            contentStructure: JSON.stringify({
                greeting: '您好',
                codeSection: '验证码[：:]\\s*\\d{4,6}',
                warning: '请勿泄露'
            }),
            extractRules: JSON.stringify({
                verificationCode: {
                    patterns: [
                        '验证码[：:]\\s*(\\d{4,6})',
                        'verification code[：:]\\s*(\\d{4,6})',
                        '您的验证码是[：:]\\s*(\\d{4,6})'
                    ],
                    priority: [1, 2, 3]
                }
            }),
            priority: 85
        }
    ];

    for (const template of systemTemplates) {
        await orm(c).insert(emailTemplate).values({
            userId: 0, // 系统模板
            ...template,
            contentStructure: template.contentStructure,
            extractRules: template.extractRules
        }).run();
    }
}
```

## 4. API接口设计

### 4.1 模板管理API

基于现有API设计规范，定义以下接口：

#### 4.1.1 模板CRUD操作

```javascript
// mail-worker/src/api/template-api.js

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
```

#### 4.1.2 模板导入API

```javascript
// mail-worker/src/api/template-import-api.js

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

### 4.2 字段提取API

```javascript
// mail-worker/src/api/template-field-api.js

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

// 字段提取规则管理
app.get('/template/field-rules', async (c) => {
    const data = await fieldExtractService.getFieldRules(c, c.req.query(), userContext.getUserId(c));
    return c.json(result.ok(data));
});
```

### 4.3 请求/响应格式规范

#### 4.3.1 创建模板请求格式

```json
{
    "templateName": "自定义验证码模板",
    "senderPattern": "example\\.com|noreply@example\\.com",
    "subjectPattern": "验证码|verification",
    "verificationCodePattern": "验证码[：:]\\s*(\\d{6})",
    "contentStructure": {
        "greeting": "尊敬的用户",
        "codeSection": "验证码[：:]\\s*\\d{6}",
        "footer": "感谢使用"
    },
    "extractRules": {
        "verificationCode": {
            "patterns": [
                "验证码[：:]\\s*(\\d{6})",
                "code[：:]\\s*(\\d{6})"
            ],
            "priority": [1, 2]
        },
        "expireTime": {
            "patterns": [
                "(\\d+)分钟内有效",
                "有效期(\\d+)分钟"
            ],
            "priority": [1, 2]
        }
    },
    "validationRules": {
        "verificationCode": {
            "minLength": 4,
            "maxLength": 8,
            "pattern": "^\\d+$"
        }
    },
    "priority": 50
}
```

#### 4.3.2 模板列表响应格式

```json
{
    "success": true,
    "data": {
        "templates": [
            {
                "templateId": 1,
                "templateName": "GitHub 验证码邮件",
                "templateType": 1,
                "senderPattern": "github|noreply@github\\.com",
                "subjectPattern": "verification code|sign.in",
                "priority": 90,
                "isActive": 1,
                "usageCount": 156,
                "successRate": 0.95,
                "createTime": "2024-01-01 10:00:00",
                "updateTime": "2024-01-15 14:30:00"
            }
        ],
        "pagination": {
            "total": 25,
            "page": 1,
            "pageSize": 10,
            "totalPages": 3
        },
        "statistics": {
            "totalTemplates": 25,
            "activeTemplates": 22,
            "userTemplates": 15,
            "systemTemplates": 10
        }
    }
}
```

#### 4.3.3 字段提取响应格式

```json
{
    "success": true,
    "data": {
        "extractionResult": {
            "templateMatched": true,
            "templateId": 1,
            "templateName": "GitHub 验证码邮件",
            "confidenceScore": 0.95,
            "processingTime": 45,
            "extractedFields": {
                "verificationCode": {
                    "value": "123456",
                    "confidence": 0.98,
                    "pattern": "verification code:\\s*(\\d{6})",
                    "position": {
                        "start": 125,
                        "end": 131
                    }
                },
                "expireTime": {
                    "value": "10",
                    "confidence": 0.85,
                    "pattern": "(\\d+)分钟内有效",
                    "position": {
                        "start": 200,
                        "end": 202
                    }
                }
            },
            "validationResults": {
                "verificationCode": {
                    "isValid": true,
                    "errors": []
                },
                "expireTime": {
                    "isValid": true,
                    "errors": []
                }
            }
        }
    }
}
```

## 5. 后端服务实现

### 5.1 模板服务核心实现

```javascript
// mail-worker/src/service/template-service.js
import { orm } from '../db/db';
import { emailTemplate, templateField, templateUsageLog } from '../entity/template';
import { eq, and, desc, asc } from 'drizzle-orm';
import BizError from '../model/biz-error';
import { t } from '../utils/i18n-utils';

const templateService = {
    // 获取模板列表
    async list(c, params, userId) {
        const { page = 1, pageSize = 10, templateType, isActive, keyword } = params;
        const offset = (page - 1) * pageSize;

        let whereConditions = [
            eq(emailTemplate.isDel, 0)
        ];

        // 权限控制：用户只能看到自己的模板和系统模板
        if (userId !== 0) { // 非管理员
            whereConditions.push(
                or(
                    eq(emailTemplate.userId, userId),
                    eq(emailTemplate.templateType, 1) // 系统模板
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

    // 创建模板
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

        // 验证正则表达式有效性
        try {
            new RegExp(senderPattern);
            new RegExp(subjectPattern);
            new RegExp(verificationCodePattern);
        } catch (error) {
            throw new BizError(t('invalidRegexPattern'), 400);
        }

        // 创建模板
        const templateData = {
            userId,
            templateName,
            templateType: 0, // 用户自定义
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

    // 测试模板
    async testTemplate(c, params, userId) {
        const { templateId, testEmail } = params;

        // 获取模板
        const template = await this.getTemplateById(c, templateId, userId);
        if (!template) {
            throw new BizError(t('templateNotFound'), 404);
        }

        const startTime = Date.now();

        // 执行模板匹配和字段提取
        const extractionResult = await this.executeTemplateExtraction(c, template, testEmail);

        const processingTime = Date.now() - startTime;

        // 记录测试日志
        await this.logTemplateUsage(c, templateId, userId, null,
            extractionResult.success ? 1 : 0, extractionResult.extractedFields,
            extractionResult.confidenceScore, processingTime);

        return {
            ...extractionResult,
            processingTime
        };
    },

    // 执行模板提取
    async executeTemplateExtraction(c, template, email) {
        const extractRules = JSON.parse(template.extractRules || '{}');
        const validationRules = JSON.parse(template.validationRules || '{}');
        const contentStructure = JSON.parse(template.contentStructure || '{}');

        const result = {
            templateMatched: false,
            templateId: template.templateId,
            templateName: template.templateName,
            confidenceScore: 0,
            extractedFields: {},
            validationResults: {},
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

                // 验证字段
                if (validationRules[fieldName]) {
                    result.validationResults[fieldName] = this.validateField(
                        fieldResult.value,
                        validationRules[fieldName]
                    );
                }
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
                        confidence: 1.0 - (i * 0.1), // 优先级越高置信度越高
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
    },

    // 验证字段值
    validateField(value, rules) {
        const errors = [];

        if (rules.minLength && value.length < rules.minLength) {
            errors.push(`字段长度不能少于${rules.minLength}位`);
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`字段长度不能超过${rules.maxLength}位`);
        }

        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
            errors.push('字段格式不符合要求');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    // 记录使用日志
    async logTemplateUsage(c, templateId, userId, emailId, matchResult, extractedFields, confidenceScore, processingTime) {
        await orm(c).insert(templateUsageLog).values({
            templateId,
            userId,
            emailId,
            matchResult,
            extractedFields: JSON.stringify(extractedFields),
            confidenceScore,
            processingTime
        }).run();

        // 更新模板使用统计
        await this.updateTemplateStats(c, templateId, matchResult);
    },

    // 更新模板统计
    async updateTemplateStats(c, templateId, matchResult) {
        const template = await orm(c).select()
            .from(emailTemplate)
            .where(eq(emailTemplate.templateId, templateId))
            .get();

        if (template) {
            const newUsageCount = template.usageCount + 1;
            const successCount = matchResult ?
                Math.round(template.successRate * template.usageCount) + 1 :
                Math.round(template.successRate * template.usageCount);
            const newSuccessRate = successCount / newUsageCount;

            await orm(c).update(emailTemplate)
                .set({
                    usageCount: newUsageCount,
                    successRate: newSuccessRate,
                    updateTime: new Date().toISOString()
                })
                .where(eq(emailTemplate.templateId, templateId))
                .run();
        }
    }
};

export default templateService;
```

### 5.2 模板导入服务实现

```javascript
// mail-worker/src/service/template-import-service.js
import templateService from './template-service';
import BizError from '../model/biz-error';
import { t } from '../utils/i18n-utils';

const templateImportService = {
    // 验证导入数据
    async validateImport(c, params, userId) {
        const { importData } = params;

        if (!importData || !importData.templates || !Array.isArray(importData.templates)) {
            throw new BizError(t('invalidImportFormat'), 400);
        }

        const validationResults = [];
        const errors = [];

        for (let i = 0; i < importData.templates.length; i++) {
            const template = importData.templates[i];
            const templateErrors = [];

            // 必需字段验证
            if (!template.templateName) {
                templateErrors.push('模板名称不能为空');
            }
            if (!template.senderPattern) {
                templateErrors.push('发送者模式不能为空');
            }

            // 正则表达式验证
            try {
                if (template.senderPattern) new RegExp(template.senderPattern);
                if (template.subjectPattern) new RegExp(template.subjectPattern);
                if (template.verificationCodePattern) new RegExp(template.verificationCodePattern);
            } catch (error) {
                templateErrors.push('正则表达式格式错误');
            }

            // JSON格式验证
            try {
                if (template.contentStructure && typeof template.contentStructure === 'string') {
                    JSON.parse(template.contentStructure);
                }
                if (template.extractRules && typeof template.extractRules === 'string') {
                    JSON.parse(template.extractRules);
                }
                if (template.validationRules && typeof template.validationRules === 'string') {
                    JSON.parse(template.validationRules);
                }
            } catch (error) {
                templateErrors.push('JSON格式错误');
            }

            validationResults.push({
                index: i,
                templateName: template.templateName,
                isValid: templateErrors.length === 0,
                errors: templateErrors
            });

            if (templateErrors.length > 0) {
                errors.push(...templateErrors.map(err => `模板${i + 1}: ${err}`));
            }
        }

        return {
            isValid: errors.length === 0,
            totalTemplates: importData.templates.length,
            validTemplates: validationResults.filter(r => r.isValid).length,
            invalidTemplates: validationResults.filter(r => !r.isValid).length,
            validationResults,
            errors
        };
    },

    // 执行导入
    async executeImport(c, params, userId) {
        const { importData, overwriteExisting = false } = params;

        // 先验证数据
        const validation = await this.validateImport(c, { importData }, userId);
        if (!validation.isValid) {
            throw new BizError(t('importValidationFailed'), 400);
        }

        const importResults = [];
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const template of importData.templates) {
            try {
                // 检查是否存在同名模板
                const existing = await orm(c).select()
                    .from(emailTemplate)
                    .where(
                        and(
                            eq(emailTemplate.templateName, template.templateName),
                            eq(emailTemplate.userId, userId),
                            eq(emailTemplate.isDel, 0)
                        )
                    ).get();

                if (existing && !overwriteExisting) {
                    importResults.push({
                        templateName: template.templateName,
                        status: 'skipped',
                        message: '模板已存在，跳过导入'
                    });
                    skipCount++;
                    continue;
                }

                // 准备模板数据
                const templateData = {
                    templateName: template.templateName,
                    senderPattern: template.senderPattern,
                    subjectPattern: template.subjectPattern || '.*',
                    verificationCodePattern: template.verificationCodePattern || '(\\d{4,8})',
                    contentStructure: template.contentStructure || {},
                    extractRules: template.extractRules || {},
                    validationRules: template.validationRules || {},
                    priority: template.priority || 0,
                    fields: template.fields || []
                };

                if (existing && overwriteExisting) {
                    // 更新现有模板
                    await templateService.update(c, {
                        templateId: existing.templateId,
                        ...templateData
                    }, userId);

                    importResults.push({
                        templateName: template.templateName,
                        status: 'updated',
                        message: '模板已更新'
                    });
                } else {
                    // 创建新模板
                    await templateService.create(c, templateData, userId);

                    importResults.push({
                        templateName: template.templateName,
                        status: 'created',
                        message: '模板已创建'
                    });
                }

                successCount++;

            } catch (error) {
                importResults.push({
                    templateName: template.templateName,
                    status: 'error',
                    message: error.message
                });
                errorCount++;
            }
        }

        return {
            summary: {
                total: importData.templates.length,
                success: successCount,
                skipped: skipCount,
                errors: errorCount
            },
            results: importResults
        };
    },

    // 导出模板
    async exportTemplates(c, params, userId) {
        const { templateIds } = params;

        let whereConditions = [
            eq(emailTemplate.isDel, 0),
            eq(emailTemplate.userId, userId)
        ];

        if (templateIds && templateIds.length > 0) {
            whereConditions.push(inArray(emailTemplate.templateId, templateIds));
        }

        const templates = await orm(c).select()
            .from(emailTemplate)
            .where(and(...whereConditions))
            .all();

        // 获取字段映射
        for (const template of templates) {
            const fields = await orm(c).select()
                .from(templateField)
                .where(eq(templateField.templateId, template.templateId))
                .orderBy(asc(templateField.sortOrder))
                .all();

            template.fields = fields;
        }

        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            templates: templates.map(template => ({
                templateName: template.templateName,
                senderPattern: template.senderPattern,
                subjectPattern: template.subjectPattern,
                verificationCodePattern: template.verificationCodePattern,
                contentStructure: JSON.parse(template.contentStructure || '{}'),
                extractRules: JSON.parse(template.extractRules || '{}'),
                validationRules: JSON.parse(template.validationRules || '{}'),
                priority: template.priority,
                fields: template.fields.map(field => ({
                    fieldName: field.fieldName,
                    fieldType: field.fieldType,
                    extractPattern: field.extractPattern,
                    extractMethod: field.extractMethod,
                    validationRule: field.validationRule,
                    isRequired: field.isRequired === 1
                }))
            }))
        };

        return exportData;
    }
};

export default templateImportService;
```

## 6. 前端组件实现

### 6.1 模板管理主界面

```vue
<!-- mail-vue/src/views/template/index.vue -->
<template>
  <div class="template-manager">
    <div class="template-header">
      <div class="header-actions">
        <el-button type="primary" @click="showCreateDialog = true" v-perm="'template:create'">
          <Icon icon="material-symbols:add" />
          创建模板
        </el-button>
        <el-button @click="showImportDialog = true" v-perm="'template:import'">
          <Icon icon="material-symbols:upload" />
          导入模板
        </el-button>
        <el-button @click="handleExport" v-perm="'template:export'">
          <Icon icon="material-symbols:download" />
          导出模板
        </el-button>
      </div>

      <div class="header-filters">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索模板名称或发送者模式"
          @input="handleSearch"
          clearable
          style="width: 300px;"
        >
          <template #prefix>
            <Icon icon="material-symbols:search" />
          </template>
        </el-input>

        <el-select v-model="filterType" @change="handleFilter" placeholder="模板类型" style="width: 150px;">
          <el-option label="全部" :value="undefined" />
          <el-option label="用户自定义" :value="0" />
          <el-option label="系统预定义" :value="1" />
        </el-select>

        <el-select v-model="filterStatus" @change="handleFilter" placeholder="状态" style="width: 120px;">
          <el-option label="全部" :value="undefined" />
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </div>
    </div>

    <div class="template-content">
      <el-table
        :data="templateList"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="55" />

        <el-table-column prop="templateName" label="模板名称" min-width="200">
          <template #default="{ row }">
            <div class="template-name">
              <span>{{ row.templateName }}</span>
              <el-tag v-if="row.templateType === 1" type="info" size="small">系统</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="senderPattern" label="发送者模式" min-width="250" show-overflow-tooltip />

        <el-table-column prop="priority" label="优先级" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">
              {{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="使用统计" width="120" align="center">
          <template #default="{ row }">
            <div class="usage-stats">
              <div>{{ row.usageCount }}次</div>
              <div class="success-rate">
                成功率: {{ (row.successRate * 100).toFixed(1) }}%
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="isActive" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.isActive"
              :active-value="1"
              :inactive-value="0"
              @change="handleStatusChange(row)"
              :disabled="row.templateType === 1"
            />
          </template>
        </el-table-column>

        <el-table-column prop="createTime" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleTest(row)">
              <Icon icon="material-symbols:play-arrow" />
              测试
            </el-button>
            <el-button link type="primary" @click="handleEdit(row)" v-if="row.templateType === 0">
              <Icon icon="material-symbols:edit" />
              编辑
            </el-button>
            <el-button link type="primary" @click="handleView(row)">
              <Icon icon="material-symbols:visibility" />
              查看
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)" v-if="row.templateType === 0">
              <Icon icon="material-symbols:delete" />
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 创建/编辑模板对话框 -->
    <TemplateCreateDialog
      v-model="showCreateDialog"
      :template-data="editingTemplate"
      @created="handleTemplateCreated"
      @updated="handleTemplateUpdated"
    />

    <!-- 导入模板对话框 -->
    <TemplateImportDialog
      v-model="showImportDialog"
      @imported="handleTemplateImported"
    />

    <!-- 测试模板对话框 -->
    <TemplateTestDialog
      v-model="showTestDialog"
      :template-data="testingTemplate"
    />

    <!-- 模板详情对话框 -->
    <TemplateDetailDialog
      v-model="showDetailDialog"
      :template-data="viewingTemplate"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { templateList as getTemplateList, templateDelete, templateUpdateStatus } from '@/request/template';
import { formatDate } from '@/utils/day';
import TemplateCreateDialog from '@/components/template/TemplateCreateDialog.vue';
import TemplateImportDialog from '@/components/template/TemplateImportDialog.vue';
import TemplateTestDialog from '@/components/template/TemplateTestDialog.vue';
import TemplateDetailDialog from '@/components/template/TemplateDetailDialog.vue';

// 响应式数据
const loading = ref(false);
const templateList = ref([]);
const selectedTemplates = ref([]);
const searchKeyword = ref('');
const filterType = ref(undefined);
const filterStatus = ref(undefined);

// 对话框状态
const showCreateDialog = ref(false);
const showImportDialog = ref(false);
const showTestDialog = ref(false);
const showDetailDialog = ref(false);

// 编辑相关数据
const editingTemplate = ref(null);
const testingTemplate = ref(null);
const viewingTemplate = ref(null);

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
});

// 计算属性
const getPriorityType = computed(() => (priority) => {
  if (priority >= 80) return 'danger';
  if (priority >= 50) return 'warning';
  return 'info';
});

// 生命周期
onMounted(() => {
  loadTemplateList();
});

// 方法
const loadTemplateList = async () => {
  try {
    loading.value = true;
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      templateType: filterType.value,
      isActive: filterStatus.value,
      keyword: searchKeyword.value
    };

    const response = await getTemplateList(params);
    templateList.value = response.data.templates;
    pagination.total = response.data.pagination.total;
  } catch (error) {
    ElMessage.error('加载模板列表失败');
  } finally {
    loading.value = false;
  }
};

const handleSearch = debounce(() => {
  pagination.page = 1;
  loadTemplateList();
}, 500);

const handleFilter = () => {
  pagination.page = 1;
  loadTemplateList();
};

const handleSelectionChange = (selection) => {
  selectedTemplates.value = selection;
};

const handleStatusChange = async (row) => {
  try {
    await templateUpdateStatus({
      templateId: row.templateId,
      isActive: row.isActive
    });
    ElMessage.success('状态更新成功');
  } catch (error) {
    // 恢复原状态
    row.isActive = row.isActive === 1 ? 0 : 1;
    ElMessage.error('状态更新失败');
  }
};

const handleEdit = (row) => {
  editingTemplate.value = { ...row };
  showCreateDialog.value = true;
};

const handleTest = (row) => {
  testingTemplate.value = row;
  showTestDialog.value = true;
};

const handleView = (row) => {
  viewingTemplate.value = row;
  showDetailDialog.value = true;
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板"${row.templateName}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await templateDelete({ templateId: row.templateId });
    ElMessage.success('删除成功');
    loadTemplateList();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const handleExport = async () => {
  if (selectedTemplates.value.length === 0) {
    ElMessage.warning('请选择要导出的模板');
    return;
  }

  try {
    const templateIds = selectedTemplates.value.map(t => t.templateId);
    const response = await templateExport({ templateIds });

    // 下载文件
    const blob = new Blob([JSON.stringify(response.data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-templates-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    ElMessage.success('导出成功');
  } catch (error) {
    ElMessage.error('导出失败');
  }
};

const handleTemplateCreated = () => {
  showCreateDialog.value = false;
  editingTemplate.value = null;
  loadTemplateList();
  ElMessage.success('模板创建成功');
};

const handleTemplateUpdated = () => {
  showCreateDialog.value = false;
  editingTemplate.value = null;
  loadTemplateList();
  ElMessage.success('模板更新成功');
};

const handleTemplateImported = (result) => {
  showImportDialog.value = false;
  loadTemplateList();
  ElMessage.success(`导入完成：成功${result.summary.success}个，跳过${result.summary.skipped}个，失败${result.summary.errors}个`);
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadTemplateList();
};

const handleSizeChange = (size) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadTemplateList();
};

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
</script>

<style scoped>
.template-manager {
  padding: 20px;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.header-filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.template-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.template-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.usage-stats {
  font-size: 12px;
}

.success-rate {
  color: #909399;
  margin-top: 2px;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
```

### 6.2 模板创建/编辑对话框

```vue
<!-- mail-vue/src/components/template/TemplateCreateDialog.vue -->
<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑模板' : '创建模板'"
    width="800px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      @submit.prevent
    >
      <el-tabs v-model="activeTab" type="border-card">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form-item label="模板名称" prop="templateName">
            <el-input
              v-model="form.templateName"
              placeholder="请输入模板名称"
              maxlength="100"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="发送者模式" prop="senderPattern">
            <el-input
              v-model="form.senderPattern"
              placeholder="请输入发送者正则表达式，如：github|noreply@github\.com"
              type="textarea"
              :rows="2"
            />
            <div class="form-tip">
              支持正则表达式，用于匹配邮件发送者地址或名称
            </div>
          </el-form-item>

          <el-form-item label="主题模式" prop="subjectPattern">
            <el-input
              v-model="form.subjectPattern"
              placeholder="请输入主题正则表达式，如：verification|verify|code"
              type="textarea"
              :rows="2"
            />
            <div class="form-tip">
              支持正则表达式，用于匹配邮件主题，留空表示匹配所有主题
            </div>
          </el-form-item>

          <el-form-item label="验证码模式" prop="verificationCodePattern">
            <el-input
              v-model="form.verificationCodePattern"
              placeholder="请输入验证码正则表达式，如：验证码[：:]\s*(\d{6})"
            />
            <div class="form-tip">
              用于提取验证码的正则表达式，括号内为捕获组
            </div>
          </el-form-item>

          <el-form-item label="优先级" prop="priority">
            <el-input-number
              v-model="form.priority"
              :min="0"
              :max="100"
              placeholder="0-100，数字越大优先级越高"
            />
            <div class="form-tip">
              模板匹配优先级，数字越大优先级越高
            </div>
          </el-form-item>
        </el-tab-pane>

        <!-- 字段提取规则 -->
        <el-tab-pane label="字段提取" name="fields">
          <div class="fields-section">
            <div class="section-header">
              <h4>字段提取规则</h4>
              <el-button type="primary" size="small" @click="addField">
                <Icon icon="material-symbols:add" />
                添加字段
              </el-button>
            </div>

            <div v-if="form.fields.length === 0" class="empty-fields">
              <el-empty description="暂无字段规则，点击上方按钮添加" />
            </div>

            <div v-else class="fields-list">
              <div
                v-for="(field, index) in form.fields"
                :key="index"
                class="field-item"
              >
                <div class="field-header">
                  <span class="field-index">{{ index + 1 }}</span>
                  <el-input
                    v-model="field.fieldName"
                    placeholder="字段名称"
                    style="width: 150px;"
                  />
                  <el-select
                    v-model="field.fieldType"
                    placeholder="字段类型"
                    style="width: 120px;"
                  >
                    <el-option label="验证码" value="code" />
                    <el-option label="邮箱" value="email" />
                    <el-option label="电话" value="phone" />
                    <el-option label="链接" value="url" />
                    <el-option label="文本" value="text" />
                    <el-option label="数字" value="number" />
                  </el-select>
                  <el-switch
                    v-model="field.isRequired"
                    active-text="必需"
                    inactive-text="可选"
                  />
                  <el-button
                    type="danger"
                    size="small"
                    @click="removeField(index)"
                  >
                    <Icon icon="material-symbols:delete" />
                  </el-button>
                </div>

                <div class="field-content">
                  <el-form-item label="提取模式">
                    <el-input
                      v-model="field.extractPattern"
                      placeholder="正则表达式，如：验证码[：:]\s*(\d{6})"
                      type="textarea"
                      :rows="2"
                    />
                  </el-form-item>

                  <el-form-item label="验证规则">
                    <el-input
                      v-model="field.validationRule"
                      placeholder="验证规则，如：^\\d{6}$"
                    />
                  </el-form-item>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 高级设置 -->
        <el-tab-pane label="高级设置" name="advanced">
          <el-form-item label="内容结构">
            <el-input
              v-model="contentStructureText"
              type="textarea"
              :rows="6"
              placeholder="JSON格式的内容结构定义"
            />
            <div class="form-tip">
              JSON格式，定义邮件内容的结构特征，用于提高匹配准确性
            </div>
          </el-form-item>

          <el-form-item label="提取规则">
            <el-input
              v-model="extractRulesText"
              type="textarea"
              :rows="6"
              placeholder="JSON格式的字段提取规则"
            />
            <div class="form-tip">
              JSON格式，定义各字段的提取规则和优先级
            </div>
          </el-form-item>

          <el-form-item label="验证规则">
            <el-input
              v-model="validationRulesText"
              type="textarea"
              :rows="4"
              placeholder="JSON格式的字段验证规则"
            />
            <div class="form-tip">
              JSON格式，定义各字段的验证规则
            </div>
          </el-form-item>
        </el-tab-pane>

        <!-- 测试验证 -->
        <el-tab-pane label="测试验证" name="test">
          <div class="test-section">
            <el-form-item label="测试邮件">
              <el-input
                v-model="testEmail.sender"
                placeholder="发送者"
                style="margin-bottom: 10px;"
              />
              <el-input
                v-model="testEmail.subject"
                placeholder="邮件主题"
                style="margin-bottom: 10px;"
              />
              <el-input
                v-model="testEmail.content"
                type="textarea"
                :rows="8"
                placeholder="邮件内容"
              />
            </el-form-item>

            <div class="test-actions">
              <el-button type="primary" @click="testTemplate" :loading="testing">
                <Icon icon="material-symbols:play-arrow" />
                测试模板
              </el-button>
              <el-button @click="loadSampleEmail">
                <Icon icon="material-symbols:auto-fix" />
                加载示例
              </el-button>
            </div>

            <div v-if="testResult" class="test-result">
              <h4>测试结果</h4>
              <div class="result-item">
                <span class="label">模板匹配:</span>
                <el-tag :type="testResult.templateMatched ? 'success' : 'danger'">
                  {{ testResult.templateMatched ? '匹配' : '不匹配' }}
                </el-tag>
              </div>
              <div class="result-item">
                <span class="label">置信度:</span>
                <span>{{ (testResult.confidenceScore * 100).toFixed(1) }}%</span>
              </div>
              <div class="result-item">
                <span class="label">处理时间:</span>
                <span>{{ testResult.processingTime }}ms</span>
              </div>
              <div v-if="Object.keys(testResult.extractedFields).length > 0" class="extracted-fields">
                <h5>提取字段:</h5>
                <div
                  v-for="(field, name) in testResult.extractedFields"
                  :key="name"
                  class="field-result"
                >
                  <span class="field-name">{{ name }}:</span>
                  <el-tag type="success">{{ field.value }}</el-tag>
                  <span class="confidence">(置信度: {{ (field.confidence * 100).toFixed(1) }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? '更新' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { templateCreate, templateUpdate, templateTest } from '@/request/template';

// Props
const props = defineProps({
  modelValue: Boolean,
  templateData: Object
});

// Emits
const emit = defineEmits(['update:modelValue', 'created', 'updated']);

// 响应式数据
const formRef = ref();
const activeTab = ref('basic');
const submitting = ref(false);
const testing = ref(false);
const testResult = ref(null);

// 表单数据
const form = reactive({
  templateName: '',
  senderPattern: '',
  subjectPattern: '.*',
  verificationCodePattern: '(\\d{4,8})',
  priority: 50,
  fields: []
});

// 高级设置文本
const contentStructureText = ref('{}');
const extractRulesText = ref('{}');
const validationRulesText = ref('{}');

// 测试邮件数据
const testEmail = reactive({
  sender: '',
  subject: '',
  content: ''
});

// 表单验证规则
const rules = {
  templateName: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  senderPattern: [
    { required: true, message: '请输入发送者模式', trigger: 'blur' },
    { validator: validateRegex, trigger: 'blur' }
  ],
  subjectPattern: [
    { validator: validateRegex, trigger: 'blur' }
  ],
  verificationCodePattern: [
    { required: true, message: '请输入验证码模式', trigger: 'blur' },
    { validator: validateRegex, trigger: 'blur' }
  ]
};

// 计算属性
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const isEdit = computed(() => !!props.templateData?.templateId);

// 监听器
watch(() => props.templateData, (newData) => {
  if (newData) {
    Object.assign(form, {
      templateName: newData.templateName || '',
      senderPattern: newData.senderPattern || '',
      subjectPattern: newData.subjectPattern || '.*',
      verificationCodePattern: newData.verificationCodePattern || '(\\d{4,8})',
      priority: newData.priority || 50,
      fields: newData.fields || []
    });

    contentStructureText.value = JSON.stringify(
      JSON.parse(newData.contentStructure || '{}'), null, 2
    );
    extractRulesText.value = JSON.stringify(
      JSON.parse(newData.extractRules || '{}'), null, 2
    );
    validationRulesText.value = JSON.stringify(
      JSON.parse(newData.validationRules || '{}'), null, 2
    );
  }
}, { immediate: true });

// 方法
function validateRegex(rule, value, callback) {
  if (!value) {
    callback();
    return;
  }

  try {
    new RegExp(value);
    callback();
  } catch (error) {
    callback(new Error('正则表达式格式错误'));
  }
}

const addField = () => {
  form.fields.push({
    fieldName: '',
    fieldType: 'code',
    extractPattern: '',
    extractMethod: 'regex',
    validationRule: '',
    isRequired: true
  });
};

const removeField = (index) => {
  form.fields.splice(index, 1);
};

const loadSampleEmail = () => {
  testEmail.sender = 'noreply@github.com';
  testEmail.subject = 'Your GitHub verification code';
  testEmail.content = `Hi there,

Your verification code is: 123456

This code will expire in 10 minutes.

Thanks,
GitHub`;
};

const testTemplate = async () => {
  try {
    testing.value = true;

    // 构建测试数据
    const templateData = {
      ...form,
      contentStructure: JSON.parse(contentStructureText.value || '{}'),
      extractRules: JSON.parse(extractRulesText.value || '{}'),
      validationRules: JSON.parse(validationRulesText.value || '{}')
    };

    const response = await templateTest({
      templateData,
      testEmail: testEmail
    });

    testResult.value = response.data;
  } catch (error) {
    ElMessage.error('测试失败: ' + error.message);
  } finally {
    testing.value = false;
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();

    submitting.value = true;

    const submitData = {
      ...form,
      contentStructure: JSON.parse(contentStructureText.value || '{}'),
      extractRules: JSON.parse(extractRulesText.value || '{}'),
      validationRules: JSON.parse(validationRulesText.value || '{}')
    };

    if (isEdit.value) {
      submitData.templateId = props.templateData.templateId;
      await templateUpdate(submitData);
      emit('updated');
    } else {
      await templateCreate(submitData);
      emit('created');
    }
  } catch (error) {
    if (error.message) {
      ElMessage.error(error.message);
    }
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  // 重置表单
  Object.assign(form, {
    templateName: '',
    senderPattern: '',
    subjectPattern: '.*',
    verificationCodePattern: '(\\d{4,8})',
    priority: 50,
    fields: []
  });

  contentStructureText.value = '{}';
  extractRulesText.value = '{}';
  validationRulesText.value = '{}';
  testResult.value = null;
  activeTab.value = 'basic';

  emit('update:modelValue', false);
};
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.fields-section {
  min-height: 300px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  margin: 0;
  color: #303133;
}

.empty-fields {
  text-align: center;
  padding: 40px 0;
}

.field-item {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 12px;
  background: #fafafa;
}

.field-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.field-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.field-content {
  padding-left: 36px;
}

.test-section {
  min-height: 400px;
}

.test-actions {
  margin: 16px 0;
  text-align: center;
}

.test-result {
  margin-top: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.test-result h4 {
  margin: 0 0 12px 0;
  color: #303133;
}

.result-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.result-item .label {
  width: 80px;
  font-weight: bold;
  color: #606266;
}

.extracted-fields {
  margin-top: 16px;
}

.extracted-fields h5 {
  margin: 0 0 8px 0;
  color: #303133;
}

.field-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.field-name {
  font-weight: bold;
  color: #606266;
  min-width: 100px;
}

.confidence {
  font-size: 12px;
  color: #909399;
}

.dialog-footer {
  text-align: right;
}
</style>
```
```
```
