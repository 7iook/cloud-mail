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
      <el-form-item label="分享类型" prop="shareType">
        <el-radio-group v-model="form.shareType" @change="handleShareTypeChange">
          <el-radio :value="1">
            <div class="share-type-option">
              <div class="option-title">单邮箱分享</div>
              <div class="option-desc">为指定邮箱创建专用分享链接</div>
            </div>
          </el-radio>
          <el-radio :value="2">
            <div class="share-type-option">
              <div class="option-title">白名单验证分享</div>
              <div class="option-desc">访问者需输入白名单邮箱进行验证</div>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.shareType === 1" label="目标邮箱" prop="targetEmails">
        <div class="email-select-container">
          <!-- 邮箱选择方式 -->
          <div class="email-selection-mode">
            <el-radio-group v-model="emailSelectionMode" @change="handleSelectionModeChange">
              <el-radio value="fromAllEmails">从全部邮件选择</el-radio>
              <el-radio value="batchInput">批量输入</el-radio>
              <el-radio value="singleInput">单个输入</el-radio>
            </el-radio-group>
          </div>

          <div class="select-actions" v-if="emailSelectionMode === 'fromAllEmails'">
            <el-button size="small" @click="selectAll" :disabled="loadingAllEmails">
              <Icon icon="material-symbols:select-all" />
              全选
            </el-button>
            <el-button size="small" @click="clearAll" :disabled="loadingAllEmails">
              <Icon icon="material-symbols:clear-all" />
              清空
            </el-button>
            <span class="selected-count">已选择 {{ form.targetEmails.length }} 个邮箱</span>
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

          <!-- 从全部邮件选择 -->
          <div v-if="emailSelectionMode === 'fromAllEmails'" class="email-selector">
            <div class="search-bar">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索邮箱地址..."
                clearable
                @input="handleSearch"
                class="search-input"
              >
                <template #prefix>
                  <Icon icon="material-symbols:search" />
                </template>
              </el-input>
              <el-select v-model="sortBy" @change="loadAllEmails" class="sort-select">
                <el-option label="按邮箱排序" value="email" />
                <el-option label="按邮件数量排序" value="count" />
              </el-select>
            </div>

            <div v-loading="loadingAllEmails" class="email-list">
              <el-checkbox-group v-model="selectedEmailsFromAll" @change="handleEmailSelectionChange">
                <div
                  v-for="item in displayEmails"
                  :key="item.email"
                  class="email-item"
                  :class="{ 'selected': selectedEmailsFromAll.includes(item.email) }"
                >
                  <el-checkbox :label="item.email">
                    <div class="email-item-content">
                      <div class="email-address">
                        <Icon icon="material-symbols:email" class="email-icon" />
                        <span class="email-text">{{ item.email }}</span>
                      </div>
                      <div class="email-stats">
                        <span class="stat-item">
                          <Icon icon="material-symbols:mail" />
                          {{ item.emailCount }} 封邮件
                        </span>
                        <span class="stat-item">
                          <Icon icon="material-symbols:schedule" />
                          {{ formatTime(item.latestReceiveTime) }}
                        </span>
                      </div>
                    </div>
                  </el-checkbox>
                </div>
              </el-checkbox-group>
            </div>

            <el-pagination
              v-if="totalEmails > pageSize"
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="totalEmails"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @current-change="handlePageChange"
              @size-change="handleSizeChange"
              class="pagination"
            />
          </div>

          <!-- 批量输入 -->
          <div v-if="emailSelectionMode === 'batchInput'" class="batch-input-container">
            <el-input
              v-model="batchEmailInput"
              type="textarea"
              :rows="8"
              placeholder="请输入邮箱地址，一行一个：&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
              @blur="processBatchEmails"
            />
            <div class="batch-input-tip">
              <Icon icon="material-symbols:info" />
              支持粘贴多个邮箱地址，一行一个，系统会自动去重和格式验证
            </div>
          </div>

          <!-- 单个输入 -->
          <div v-if="emailSelectionMode === 'singleInput'" class="single-input-container">
            <el-input
              v-model="singleEmailInput"
              placeholder="请输入邮箱地址，如：user@example.com"
              @blur="processSingleEmail"
            >
              <template #prefix>
                <Icon icon="material-symbols:email" />
              </template>
              <template #append>
                <el-button @click="addSingleEmail" :disabled="!isValidEmail(singleEmailInput)">
                  添加
                </el-button>
              </template>
            </el-input>
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
import { createShare } from '@/request/share.js';
import { getUniqueRecipients } from '@/request/all-email.js';
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
const showWhitelistDialog = ref(false);

// 邮箱选择相关
const emailSelectionMode = ref('fromAllEmails'); // 'fromAllEmails', 'batchInput', 'singleInput'
const loadingAllEmails = ref(false);
const displayEmails = ref([]);
const selectedEmailsFromAll = ref([]);
const totalEmails = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const searchKeyword = ref('');
const sortBy = ref('email');

// 批量输入相关
const batchEmailInput = ref('');

// 单个输入相关
const singleEmailInput = ref('');

// 表单数据
const form = reactive({
  shareType: 1, // 1=单邮箱分享, 2=白名单验证分享
  targetEmails: [],
  shareName: '',
  keywordFilter: '验证码|verification|code|otp',
  expireTime: '',
  rateLimitPerSecond: 5,
  rateLimitPerMinute: 60
});

// 表单验证规则
const rules = computed(() => ({
  shareType: [
    { required: true, message: '请选择分享类型', trigger: 'change' }
  ],
  targetEmails: form.shareType === 1 ? [
    { required: true, message: '请选择目标邮箱', trigger: 'change' },
    { type: 'array', min: 1, message: '至少选择一个邮箱', trigger: 'change' }
  ] : [],
  shareName: [
    { required: true, message: '请输入分享名称', trigger: 'blur' },
    { min: 2, max: 100, message: '分享名称长度在 2 到 100 个字符', trigger: 'blur' }
  ]
}));

// 计算属性
const availableEmails = computed(() => {
  return displayEmails.value.filter(item => !form.targetEmails.includes(item.email));
});

// 监听显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    resetForm();
    if (emailSelectionMode.value === 'fromAllEmails') {
      loadAllEmails();
    }
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 加载全部邮件中的邮箱
const loadAllEmails = async () => {
  loadingAllEmails.value = true;
  try {
    const response = await getUniqueRecipients({
      search: searchKeyword.value,
      page: currentPage.value,
      pageSize: pageSize.value,
      orderBy: sortBy.value
    });
    const data = response.data || response;
    displayEmails.value = data.list || [];
    totalEmails.value = data.total || 0;
  } catch (error) {
    console.error('Load emails error:', error);
    ElMessage.error('加载邮箱列表失败');
  } finally {
    loadingAllEmails.value = false;
  }
};

// 邮箱选择方式变更处理
const handleSelectionModeChange = (mode) => {
  // 清空当前选择
  form.targetEmails = [];
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';

  // 根据模式加载数据
  if (mode === 'fromAllEmails') {
    loadAllEmails();
  }
};

// 处理从全部邮件中的选择变更
const handleEmailSelectionChange = (selectedEmails) => {
  form.targetEmails = [...selectedEmails];
};

// 选择所有邮箱（从全部邮件）
const selectAll = () => {
  if (emailSelectionMode.value === 'fromAllEmails') {
    selectedEmailsFromAll.value = displayEmails.value.map(item => item.email);
    form.targetEmails = [...selectedEmailsFromAll.value];
  }
};

// 清空所有选择
const clearAll = () => {
  form.targetEmails = [];
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';
};

// 邮箱格式验证
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// 处理批量输入
const processBatchEmails = () => {
  if (!batchEmailInput.value.trim()) return;

  const emails = batchEmailInput.value
    .split('\n')
    .map(email => email.trim())
    .filter(email => email)
    .filter(email => isValidEmail(email));

  if (emails.length === 0) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }

  // 去重并添加
  const newEmails = emails.filter(email => !form.targetEmails.includes(email));
  form.targetEmails.push(...newEmails);

  ElMessage.success(`成功添加 ${newEmails.length} 个邮箱`);
};

// 处理单个输入
const processSingleEmail = () => {
  if (singleEmailInput.value.trim() && isValidEmail(singleEmailInput.value.trim())) {
    addSingleEmail();
  }
};

// 添加单个邮箱
const addSingleEmail = () => {
  const email = singleEmailInput.value.trim();
  if (!email || !isValidEmail(email)) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }

  if (form.targetEmails.includes(email)) {
    ElMessage.warning('该邮箱已存在');
    return;
  }

  form.targetEmails.push(email);
  singleEmailInput.value = '';
  ElMessage.success('邮箱添加成功');
};

// 移除选中的邮箱
const removeSelectedEmail = (email) => {
  const index = form.targetEmails.indexOf(email);
  if (index > -1) {
    form.targetEmails.splice(index, 1);
  }
  // 同时从选择列表中移除
  const selectedIndex = selectedEmailsFromAll.value.indexOf(email);
  if (selectedIndex > -1) {
    selectedEmailsFromAll.value.splice(selectedIndex, 1);
  }
};

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1;
  loadAllEmails();
};

// 分页处理
const handlePageChange = (page) => {
  currentPage.value = page;
  loadAllEmails();
};

// 页面大小变更处理
const handleSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadAllEmails();
};

// 时间格式化
const formatTime = (timeStr) => {
  if (!timeStr) return '未知';
  return dayjs(timeStr).format('MM-DD HH:mm');
};

// 处理白名单更新（保留兼容性）
const handleWhitelistUpdated = () => {
  if (emailSelectionMode.value === 'fromAllEmails') {
    loadAllEmails();
  }
  ElMessage.success('邮箱白名单更新成功');
};

// 处理分享类型变更
const handleShareTypeChange = (type) => {
  if (type === 2) {
    // 切换到白名单验证分享时，清空目标邮箱选择
    form.targetEmails = [];
    selectedEmailsFromAll.value = [];
  }
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 重置表单
const resetForm = () => {
  form.shareType = 1;
  form.targetEmails = [];
  form.shareName = '';
  form.keywordFilter = '验证码|verification|code|otp';
  form.expireTime = '';
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';

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

    if (form.shareType === 2) {
      // 类型2：多邮箱验证分享，创建一个包含授权邮箱列表的分享
      if (form.targetEmails.length === 0) {
        ElMessage.warning('请至少选择一个邮箱');
        return;
      }

      const shareData = {
        targetEmail: form.targetEmails[0], // 使用第一个邮箱作为主邮箱（向后兼容）
        authorizedEmails: form.targetEmails, // 授权邮箱列表
        shareName: form.shareName || `多邮箱验证分享 (${form.targetEmails.length}个邮箱)`,
        keywordFilter: form.keywordFilter,
        expireTime: expireTime,
        shareType: 2,
        rateLimitPerSecond: form.rateLimitPerSecond,
        rateLimitPerMinute: form.rateLimitPerMinute
      };

      try {
        const result = await createShare(shareData);
        results.push({ email: `多邮箱分享 (${form.targetEmails.length}个)`, success: true, result });
      } catch (error) {
        results.push({ email: '多邮箱分享', success: false, error: error.message });
      }
    } else {
      // 类型1：为每个选中的邮箱创建分享
      for (const email of form.targetEmails) {
        const shareData = {
          targetEmail: email,
          shareName: form.shareName || `${email}的验证码接收`,
          keywordFilter: form.keywordFilter,
          expireTime: expireTime,
          shareType: 1
        };

        try {
          const result = await createShare(shareData);
          results.push({ email, success: true, result });
        } catch (error) {
          results.push({ email, success: false, error: error.message });
        }
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

.share-type-option {
  .option-title {
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
  }

  .option-desc {
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1.4;
  }
}

.el-radio {
  margin-right: 24px;
  margin-bottom: 16px;

  &:last-child {
    margin-right: 0;
  }
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
