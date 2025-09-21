# 邮件模板扩展系统 - 前端开发指导文档

## 📋 开发概览

### 技术栈
- **Vue 3.5.13** + Composition API
- **Element Plus 2.9.11** + 自动导入
- **Pinia 3.0.2** + 持久化插件
- **Vue Router 4.5.0** + 权限控制
- **Iconify Vue** + Element Plus Icons
- **Vite** + 自动导入配置

### 项目结构规范
```
mail-vue/src/
├── views/template/           # 模板管理页面
├── components/template/      # 模板相关组件
├── request/template.js       # 模板API请求
├── store/template.js         # 模板状态管理
└── utils/template-utils.js   # 模板工具函数
```

## 🎯 开发任务清单

### 阶段一：基础架构搭建（1天）

#### 1.1 路由配置
**文件位置**: `src/perm/perm.js`
```javascript
// 在 routers 对象中添加模板权限路由
'template:query': [{
    path: '/templates',
    name: 'template',
    component: () => import('@/views/template/index.vue'),
    meta: {
        title: 'emailTemplates',
        name: 'template',
        menu: true
    }
}]
```

#### 1.2 侧边栏菜单
**文件位置**: `src/layout/aside/index.vue`
```vue
<!-- 在权限管理菜单附近添加 -->
<el-menu-item @click="router.push({name: 'template'})" index="template" 
              v-perm="'template:query'" :class="route.meta.name === 'template' ? 'choose-item' : ''">
  <Icon icon="material-symbols:template-add" width="22" height="22" />
  <span class="menu-name" style="margin-left: 20px">{{$t('emailTemplates')}}</span>
</el-menu-item>
```

#### 1.3 API请求封装
**新建文件**: `src/request/template.js`
```javascript
import http from '@/axios/index.js';

// 模板管理API
export function templateList(params) {
    return http.get('/template/list', { params });
}

export function templateCreate(data) {
    return http.post('/template/create', data);
}

export function templateUpdate(data) {
    return http.put('/template/update', data);
}

export function templateDelete(params) {
    return http.delete('/template/delete', { params });
}

export function templateTest(data) {
    return http.post('/template/test', data);
}

// 导入导出API
export function templateImportValidate(data) {
    return http.post('/template/import/validate', data);
}

export function templateImportExecute(data) {
    return http.post('/template/import/execute', data);
}

export function templateExport(params) {
    return http.get('/template/export', { params });
}

// 字段提取API
export function templateExtractFields(data) {
    return http.post('/template/extract-fields', data);
}
```

#### 1.4 状态管理
**新建文件**: `src/store/template.js`
```javascript
import { defineStore } from 'pinia';

export const useTemplateStore = defineStore('template', {
    state: () => ({
        templateList: [],
        currentTemplate: null,
        importProgress: {
            visible: false,
            step: 0,
            total: 0,
            current: 0
        },
        testResult: null
    }),
    
    actions: {
        setTemplateList(list) {
            this.templateList = list;
        },
        
        setCurrentTemplate(template) {
            this.currentTemplate = template;
        },
        
        updateImportProgress(progress) {
            this.importProgress = { ...this.importProgress, ...progress };
        }
    },
    
    persist: {
        pick: ['currentTemplate']
    }
});
```

### 阶段二：核心组件开发（2天）

#### 2.1 模板管理主页面
**新建文件**: `src/views/template/index.vue`

**关键功能点**:
- 表格展示：模板列表、状态切换、优先级显示
- 搜索过滤：关键词搜索、类型筛选、状态筛选
- 批量操作：多选、批量删除、批量导出
- 分页处理：使用 Element Plus 分页组件

**复用现有组件**:
- 表格布局参考 `src/views/user/index.vue`
- 搜索过滤参考 `src/views/role/index.vue`
- 分页组件直接使用 `el-pagination`

#### 2.2 模板创建/编辑对话框
**新建文件**: `src/components/template/TemplateCreateDialog.vue`

**关键功能点**:
- 标签页设计：基本信息、字段提取、高级设置、测试验证
- 表单验证：正则表达式验证、必填项检查
- 动态字段：字段规则的增删改
- 实时测试：模板测试和结果展示

**复用现有组件**:
- 对话框布局参考 `src/layout/write/index.vue`
- 表单验证参考现有表单组件
- 标签页使用 `el-tabs`

#### 2.3 模板导入向导
**新建文件**: `src/components/template/TemplateImportDialog.vue`

**关键功能点**:
- 步骤向导：文件选择 → 验证检查 → 导入确认 → 完成反馈
- 文件处理：JSON文件读取、格式验证
- 进度显示：导入进度条、结果统计
- 错误处理：验证失败提示、导入错误处理

**复用现有组件**:
- 文件上传参考 `src/layout/write/index.vue` 的附件处理
- 步骤条使用 `el-steps`
- 进度条使用 `el-progress`

#### 2.4 模板测试对话框
**新建文件**: `src/components/template/TemplateTestDialog.vue`

**关键功能点**:
- 测试邮件输入：发送者、主题、内容
- 示例数据加载：预设测试邮件
- 结果展示：匹配结果、提取字段、置信度
- 性能指标：处理时间、成功率

### 阶段三：高级功能开发（1天）

#### 3.1 字段映射配置组件
**新建文件**: `src/components/template/FieldMappingConfig.vue`

**关键功能点**:
- 拖拽排序：字段优先级调整
- 规则编辑：正则表达式编辑器
- 实时预览：规则效果预览
- 验证规则：字段验证配置

#### 3.2 模板详情查看
**新建文件**: `src/components/template/TemplateDetailDialog.vue`

**关键功能点**:
- 只读展示：模板配置详情
- 使用统计：成功率、使用次数
- 历史记录：使用日志查看

#### 3.3 工具函数
**新建文件**: `src/utils/template-utils.js`
```javascript
// 正则表达式验证
export function validateRegex(pattern) {
    try {
        new RegExp(pattern);
        return true;
    } catch (error) {
        return false;
    }
}

// 模板优先级颜色
export function getPriorityColor(priority) {
    if (priority >= 80) return 'danger';
    if (priority >= 50) return 'warning';
    return 'info';
}

// JSON格式化
export function formatJson(obj) {
    return JSON.stringify(obj, null, 2);
}

// 文件下载
export function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
```

## 🔧 现有代码修改点

### 1. 国际化配置
**文件位置**: `src/i18n/`
```javascript
// 添加模板相关翻译
emailTemplates: '邮件模板',
templateName: '模板名称',
senderPattern: '发送者模式',
verificationCode: '验证码',
templateTest: '模板测试',
importTemplate: '导入模板',
exportTemplate: '导出模板'
```

### 2. 权限配置扩展
**文件位置**: `src/perm/perm.js`
```javascript
// 添加模板相关权限
'template:create': [...],
'template:update': [...],
'template:delete': [...],
'template:import': [...],
'template:export': [...]
```

### 3. 监控页面集成
**文件位置**: `src/views/monitor/share.vue`
```javascript
// 在现有 emailTemplateManager 基础上扩展
// 添加数据库模板加载功能
async loadDatabaseTemplates() {
    const response = await templateList({ templateType: 1 });
    const dbTemplates = response.data.templates.map(t => ({
        name: t.templateName,
        senderPattern: new RegExp(t.senderPattern, 'i'),
        subjectPattern: new RegExp(t.subjectPattern, 'i'),
        extractVerificationCode: (content) => {
            // 使用数据库中的提取规则
        }
    }));
    
    // 合并到现有模板管理器
    emailTemplateManager.templates.push(...dbTemplates);
}
```

## 🎨 UI/UX设计要求

### 设计原则
1. **一致性**: 遵循现有Element Plus设计规范
2. **易用性**: 直观的操作流程和清晰的信息层次
3. **响应式**: 支持桌面和平板设备
4. **无障碍**: 支持键盘导航和屏幕阅读器

### 样式规范
```scss
// 模板管理页面样式
.template-manager {
    padding: 20px;
    
    .template-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--el-bg-color-page);
        border-radius: 8px;
    }
    
    .template-content {
        background: var(--el-bg-color);
        border-radius: 8px;
        padding: 20px;
    }
}

// 字段配置样式
.field-item {
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 12px;
    background: var(--el-bg-color-page);
}

// 测试结果样式
.test-result {
    padding: 16px;
    background: var(--el-bg-color-page);
    border-radius: 6px;
    
    .result-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
    }
}
```

### 交互设计
1. **加载状态**: 使用 Element Plus 的 loading 指令
2. **错误提示**: 使用 ElMessage 进行错误反馈
3. **确认对话框**: 删除操作使用 ElMessageBox 确认
4. **表单验证**: 实时验证和错误提示

## ⚠️ 注意事项与风险点

### 开发注意事项
1. **权限控制**: 所有操作按钮都要添加 `v-perm` 指令
2. **错误处理**: API调用要有完整的 try-catch 处理
3. **数据验证**: 前端要进行基础数据验证
4. **性能优化**: 大列表使用虚拟滚动或分页
5. **内存管理**: 及时清理事件监听器和定时器

### 潜在风险点
1. **正则表达式安全**: 用户输入的正则表达式可能导致性能问题
2. **文件上传安全**: JSON文件解析要防止恶意代码
3. **数据量过大**: 模板列表过多时的性能问题
4. **浏览器兼容**: 确保在主流浏览器中正常工作

### 测试要点
1. **功能测试**: 所有CRUD操作的完整流程
2. **权限测试**: 不同权限用户的功能可见性
3. **边界测试**: 大文件导入、特殊字符处理
4. **兼容性测试**: 不同浏览器和设备的兼容性

## 🚀 开发时间规划

### 第1天：基础架构
- 上午：路由配置、API封装、状态管理
- 下午：主页面框架、基础表格展示

### 第2天：核心功能
- 上午：创建/编辑对话框、表单验证
- 下午：导入向导、文件处理

### 第3天：高级功能
- 上午：测试功能、字段配置
- 下午：样式优化、交互完善

### 第4天：集成测试
- 上午：前后端联调、bug修复
- 下午：用户体验优化、文档完善

## 📝 交付物检查清单

- [ ] 模板管理主页面完成
- [ ] 创建/编辑对话框完成
- [ ] 导入/导出功能完成
- [ ] 测试功能完成
- [ ] 权限控制正确配置
- [ ] 国际化翻译完成
- [ ] 样式符合设计规范
- [ ] 错误处理完善
- [ ] 性能优化完成
- [ ] 浏览器兼容性测试通过
