<template>
  <el-dialog
    v-model="visible"
    title="创建邮箱分享"
    width="1200px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="create-share-dialog"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      @submit.prevent
    >
      <el-form-item label="目标邮箱" prop="targetEmails">
        <div class="email-select-container">
          <div class="select-actions">
            <el-button size="small" @click="selectAll" :disabled="loadingWhitelist">
              <Icon icon="material-symbols:select-all" />
              全选
            </el-button>
            <el-button size="small" @click="clearAll" :disabled="loadingWhitelist">
              <Icon icon="material-symbols:clear-all" />
              清空
            </el-button>
            <span class="selected-count">已选择 {{ form.targetEmails.length }} 个邮箱</span>
            <el-button size="small" type="primary" @click="openWhitelistManager" style="margin-left: auto;">
              <Icon icon="material-symbols:settings" />
              管理邮箱白名单
            </el-button>
          </div>

          <!-- 已选择的邮箱展示区域 -->
          <div v-if="form.targetEmails.length > 0" class="selected-emails-display">
            <div class="selected-emails-header">
              <span class="header-title">已选择的邮箱 ({{ form.targetEmails.length }})</span>
            </div>
            <div class="selected-emails-grid">
              <el-tag
                v-for="email in form.targetEmails"
                :key="email"
                closable
                @close="removeSelectedEmail(email)"
                class="selected-email-tag"
                size="large"
                type="primary"
              >
                <Icon icon="material-symbols:email" class="email-icon" />
                {{ email }}
              </el-tag>
            </div>
          </div>

          <!-- 邮箱选择下拉框 -->
          <div class="email-selector">
            <el-select
              v-model="tempSelectedEmails"
              multiple
              placeholder="从白名单中选择邮箱添加到分享列表"
              filterable
              clearable
              style="width: 100%;"
              :loading="loadingWhitelist"
              @change="addSelectedEmails"
            >
              <el-option
                v-for="email in availableEmails"
                :key="email"
                :label="email"
                :value="email"
              >
                <div class="email-option">
                  <Icon icon="material-symbols:email" class="option-icon" />
                  <span>{{ email }}</span>
                </div>
              </el-option>
            </el-select>
          </div>

          <div v-if="whitelistEmails.length === 0" class="empty-tip">
            <Icon icon="material-symbols:warning" />
            暂无可分享的邮箱，请先<el-button type="text" @click="openWhitelistManager">管理邮箱白名单</el-button>
          </div>
        </div>
        <div class="form-tip">
          从邮箱白名单中选择要分享的邮箱。如需添加新邮箱，请点击"管理邮箱白名单"按钮。
        </div>
      </el-form-item>

      <el-form-item label="分享名称" prop="shareName">
        <el-input
          v-model="form.shareName"
          placeholder="请输入分享名称"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="关键词过滤" prop="keywordFilter">
        <el-input
          v-model="form.keywordFilter"
          placeholder="验证码|verification|code|otp"
          maxlength="200"
        />
        <div class="form-tip">
          用于过滤包含特定关键词的邮件，多个关键词用"|"分隔
        </div>
      </el-form-item>

      <el-form-item label="过期时间" prop="expireTime">
        <el-date-picker
          v-model="form.expireTime"
          type="datetime"
          placeholder="选择过期时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          style="width: 100%"
        />
        <div class="form-tip">
          不设置则默认7天后过期
        </div>
      </el-form-item>

      <el-form-item label="频率限制">
        <div style="display: flex; gap: 20px; align-items: center;">
          <div style="flex: 1;">
            <el-input-number
              v-model="form.rateLimitPerSecond"
              :min="1"
              :max="100"
              placeholder="每秒最大请求数"
              style="width: 100%;"
            />
            <div class="form-tip">每秒最大请求数（默认5次，防止极端恶意攻击）</div>
          </div>
          <div style="flex: 1;">
            <el-input-number
              v-model="form.rateLimitPerMinute"
              :min="10"
              :max="1000"
              placeholder="每分钟最大请求数"
              style="width: 100%;"
            />
            <div class="form-tip">每分钟最大请求数（默认60次，正常用户不受影响）</div>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          创建分享
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 邮箱白名单管理对话框 -->
  <ShareWhitelistDialog
    v-model="showWhitelistDialog"
    @updated="handleWhitelistUpdated"
  />
</template>

<script setup>
import { ref, reactive, watch, nextTick, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { createShare, getShareWhitelist, updateShareWhitelist } from '@/request/share.js';
import dayjs from 'dayjs';
import { Icon } from '@iconify/vue';
import ShareWhitelistDialog from './ShareWhitelistDialog.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'created']);

// 响应式数据
const visible = ref(false);
const formRef = ref();
const submitting = ref(false);
const loadingWhitelist = ref(false);
const whitelistEmails = ref([]);
const tempSelectedEmails = ref([]);
const showWhitelistDialog = ref(false);

// 表单数据
const form = reactive({
  targetEmails: [],
  shareName: '',
  keywordFilter: '验证码|verification|code|otp',
  expireTime: '',
  rateLimitPerSecond: 5,
  rateLimitPerMinute: 60
});

// 表单验证规则
const rules = {
  targetEmails: [
    { required: true, message: '请选择目标邮箱', trigger: 'change' },
    { type: 'array', min: 1, message: '至少选择一个邮箱', trigger: 'change' }
  ],
  shareName: [
    { required: true, message: '请输入分享名称', trigger: 'blur' },
    { min: 2, max: 100, message: '分享名称长度在 2 到 100 个字符', trigger: 'blur' }
  ]
};

// 计算属性
const availableEmails = computed(() => {
  return whitelistEmails.value.filter(email => !form.targetEmails.includes(email));
});

// 监听显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    loadWhitelistEmails();
    resetForm();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 加载邮箱白名单
const loadWhitelistEmails = async () => {
  loadingWhitelist.value = true;
  try {
    whitelistEmails.value = await getShareWhitelist();
  } catch (error) {
    ElMessage.error('加载邮箱白名单失败');
  } finally {
    loadingWhitelist.value = false;
  }
};

// 全选邮箱
const selectAll = () => {
  form.targetEmails = [...whitelistEmails.value];
};

// 清空选择
const clearAll = () => {
  form.targetEmails = [];
  tempSelectedEmails.value = [];
};

// 添加选中的邮箱（多选）
const addSelectedEmails = (emails) => {
  if (emails && emails.length > 0) {
    // 添加新选中的邮箱，避免重复
    emails.forEach(email => {
      if (!form.targetEmails.includes(email)) {
        form.targetEmails.push(email);
      }
    });
  }
  // 清空临时选择
  tempSelectedEmails.value = [];
};

// 移除选中的邮箱
const removeSelectedEmail = (email) => {
  const index = form.targetEmails.indexOf(email);
  if (index > -1) {
    form.targetEmails.splice(index, 1);
  }
};

// 打开邮箱白名单管理器
const openWhitelistManager = () => {
  showWhitelistDialog.value = true;
};

// 处理白名单更新
const handleWhitelistUpdated = () => {
  loadWhitelistEmails(); // 重新加载白名单
  ElMessage.success('邮箱白名单更新成功');
};

// 重置表单
const resetForm = () => {
  form.targetEmails = [];
  form.shareName = '';
  form.keywordFilter = '验证码|verification|code|otp';
  form.expireTime = '';
  tempSelectedEmails.value = [];

  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 处理提交
const handleSubmit = async () => {
  try {
    await formRef.value.validate();

    submitting.value = true;

    const expireTime = form.expireTime || dayjs().add(7, 'day').toISOString();
    const results = [];

    // 为每个选中的邮箱创建分享
    for (const email of form.targetEmails) {
      const shareData = {
        targetEmail: email,
        shareName: form.shareName || `${email}的验证码接收`,
        keywordFilter: form.keywordFilter,
        expireTime: expireTime
      };

      try {
        const result = await createShare(shareData);
        results.push({ email, success: true, result });
      } catch (error) {
        results.push({ email, success: false, error: error.message });
      }
    }

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      ElMessage.success(`成功创建 ${successCount} 个邮箱分享`);
    }
    if (failCount > 0) {
      ElMessage.warning(`${failCount} 个邮箱分享创建失败`);
    }

    emit('created', results);
    handleClose();
  } catch (error) {
    if (error.message) {
      ElMessage.error(error.message);
    }
  } finally {
    submitting.value = false;
  }
};

// 处理关闭
const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.create-share-dialog {
  --el-dialog-width: 1200px;
}

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

.email-select-container {
  width: 100%;
}

.select-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.selected-count {
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.selected-emails-display {
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--el-fill-color-extra-light);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.selected-emails-header {
  margin-bottom: 12px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.selected-emails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.selected-email-tag {
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  transition: all 0.2s;
}

.selected-email-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.email-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.email-selector {
  margin-bottom: 16px;
}

.email-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-icon {
  font-size: 16px;
  color: var(--el-color-primary);
}

.email-tabs {
  margin-bottom: 8px;
}

.whitelist-manage {
  padding: 8px 0;
}

.manage-actions {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.email-list {
  min-height: 60px;
  padding: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: var(--el-fill-color-lighter);
}

.empty-tip {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 20px;
  font-size: 14px;
}
</style>
