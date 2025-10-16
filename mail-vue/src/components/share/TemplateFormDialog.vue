<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'create' ? '创建邮件模板' : '编辑邮件模板'"
    width="700px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="140px"
      @submit.prevent
    >
      <!-- 基本信息 -->
      <el-form-item label="模板名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="例如: GitHub验证码"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="模板描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="简要描述此模板的用途"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <!-- 匹配规则 -->
      <el-divider content-position="left">匹配规则 (可选)</el-divider>

      <el-form-item label="发件人匹配规则" prop="senderPattern">
        <el-input
          v-model="form.senderPattern"
          placeholder="例如: noreply@github\\.com"
        />
        <div class="form-tip">
          使用正则表达式匹配发件人邮箱,留空表示不限制
        </div>
      </el-form-item>

      <el-form-item label="主题匹配规则" prop="subjectPattern">
        <el-input
          v-model="form.subjectPattern"
          placeholder="例如: verification|verify|code"
        />
        <div class="form-tip">
          使用正则表达式匹配邮件主题,留空表示不限制
        </div>
      </el-form-item>

      <el-form-item label="正文匹配规则" prop="bodyPattern">
        <el-input
          v-model="form.bodyPattern"
          placeholder="例如: verification code|验证码"
        />
        <div class="form-tip">
          使用正则表达式匹配邮件正文,留空表示不限制
        </div>
      </el-form-item>

      <!-- 验证码提取 -->
      <el-divider content-position="left">验证码提取 (必填)</el-divider>

      <el-form-item label="提取正则表达式" prop="extractionRegex">
        <el-input
          v-model="form.extractionRegex"
          placeholder="例如: \\b\\d{6}\\b"
        />
        <div class="form-tip">
          用于从邮件正文中提取验证码的正则表达式
        </div>
      </el-form-item>

      <el-form-item label="验证码格式说明" prop="codeFormat">
        <el-input
          v-model="form.codeFormat"
          placeholder="例如: 6位数字"
        />
        <div class="form-tip">
          描述验证码的格式,帮助用户理解
        </div>
      </el-form-item>

      <!-- 示例 -->
      <el-divider content-position="left">示例 (可选)</el-divider>

      <el-form-item label="示例邮件内容" prop="exampleEmail">
        <el-input
          v-model="form.exampleEmail"
          type="textarea"
          :rows="3"
          placeholder="粘贴一封示例邮件的内容"
        />
      </el-form-item>

      <el-form-item label="示例验证码" prop="exampleCode">
        <el-input
          v-model="form.exampleCode"
          placeholder="例如: 123456"
        />
      </el-form-item>

      <!-- 状态 -->
      <el-form-item label="启用状态" prop="isActive">
        <el-switch
          v-model="form.isActive"
          :active-value="1"
          :inactive-value="0"
        />
        <span class="form-tip" style="margin-left: 12px;">
          {{ form.isActive === 1 ? '已启用' : '已禁用' }}
        </span>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ mode === 'create' ? '创建' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { createTemplate, updateTemplate } from '@/request/email-template.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create', // 'create' | 'edit'
    validator: (value) => ['create', 'edit'].includes(value)
  },
  templateData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'created', 'updated']);

// 响应式数据
const visible = ref(false);
const formRef = ref();
const submitting = ref(false);

// 表单数据
const form = reactive({
  name: '',
  description: '',
  senderPattern: '',
  subjectPattern: '',
  bodyPattern: '',
  extractionRegex: '',
  codeFormat: '',
  exampleEmail: '',
  exampleCode: '',
  isActive: 1
});

// 正则表达式验证器
const validateRegex = (rule, value, callback) => {
  if (!value) {
    callback();
    return;
  }
  try {
    new RegExp(value);
    callback();
  } catch (e) {
    callback(new Error('请输入有效的正则表达式'));
  }
};

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  extractionRegex: [
    { required: true, message: '请输入提取正则表达式', trigger: 'blur' },
    { validator: validateRegex, trigger: 'blur' }
  ],
  senderPattern: [
    { validator: validateRegex, trigger: 'blur' }
  ],
  subjectPattern: [
    { validator: validateRegex, trigger: 'blur' }
  ],
  bodyPattern: [
    { validator: validateRegex, trigger: 'blur' }
  ]
};

// 监听 modelValue 变化
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    initForm();
  }
});

// 监听 visible 变化
watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 初始化表单
const initForm = () => {
  if (props.templateData) {
    // 编辑模式或使用预设模板,填充数据
    Object.assign(form, {
      name: props.templateData.name || '',
      description: props.templateData.description || '',
      senderPattern: props.templateData.senderPattern || '',
      subjectPattern: props.templateData.subjectPattern || '',
      bodyPattern: props.templateData.bodyPattern || '',
      extractionRegex: props.templateData.extractionRegex || '',
      codeFormat: props.templateData.codeFormat || '',
      exampleEmail: props.templateData.exampleEmail || '',
      exampleCode: props.templateData.exampleCode || '',
      isActive: props.templateData.isActive ?? 1
    });
  } else {
    // 创建模式且无预设数据,重置表单
    resetForm();
  }
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 重置表单
const resetForm = () => {
  form.name = '';
  form.description = '';
  form.senderPattern = '';
  form.subjectPattern = '';
  form.bodyPattern = '';
  form.extractionRegex = '';
  form.codeFormat = '';
  form.exampleEmail = '';
  form.exampleCode = '';
  form.isActive = 1;
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    submitting.value = true;
    
    const templateData = {
      name: form.name,
      description: form.description || null,
      senderPattern: form.senderPattern || null,
      subjectPattern: form.subjectPattern || null,
      bodyPattern: form.bodyPattern || null,
      extractionRegex: form.extractionRegex,
      codeFormat: form.codeFormat || null,
      exampleEmail: form.exampleEmail || null,
      exampleCode: form.exampleCode || null,
      isActive: form.isActive
    };

    if (props.mode === 'create') {
      await createTemplate(templateData);
      ElMessage.success('模板创建成功');
      emit('created');
    } else {
      await updateTemplate(props.templateData.id, templateData);
      ElMessage.success('模板更新成功');
      emit('updated');
    }
    
    handleClose();
  } catch (error) {
    console.error('Submit template error:', error);
    if (error.message && !error.message.includes('validation')) {
      ElMessage.error(error.message || '操作失败');
    }
  } finally {
    submitting.value = false;
  }
};

// 关闭对话框
const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-divider__text) {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>

