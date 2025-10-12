<template>
  <el-dialog
    v-model="visible"
    title="邮箱白名单管理"
    width="1200px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="whitelist-dialog"
  >
    <div class="whitelist-content">
      <!-- 白名单说明 -->
      <el-alert 
        type="info" 
        :closable="false"
        class="info-alert"
      >
        <template #title>
          <div class="alert-title">
            <Icon icon="material-symbols:security" class="alert-icon" />
            <span>白名单安全控制说明</span>
          </div>
        </template>
        <div class="alert-content">
          <p>• <strong>核心作用</strong>: 只有白名单中的邮箱才能创建验证码分享链接,保护验证码安全</p>
          <p>• <strong>访问控制</strong>: 分享链接访问时会二次验证白名单,防止未授权访问</p>
          <p>• <strong>使用建议</strong>: 仅添加需要接收验证码的邮箱,建议100个左右</p>
        </div>
      </el-alert>

      <!-- 操作区域 -->
      <div class="whitelist-header">
        <div class="header-actions">
          <el-button @click="showBatchAddDialog = true">
            <Icon icon="material-symbols:add-box" />
            批量添加
          </el-button>
          <el-button @click="addSingleEmail">
            <Icon icon="material-symbols:add" />
            添加邮箱
          </el-button>
          <el-button 
            type="primary" 
            @click="showImportDialog = true"
            :loading="importing"
          >
            <Icon icon="material-symbols:mail-outline" />
            从全部邮件导入
          </el-button>
        </div>
      </div>

      <!-- 白名单列表 -->
      <div class="whitelist-list">
        <div class="list-header">
          <span>已添加邮箱 ({{ emailList.length }})</span>
          <el-button 
            type="danger" 
            size="small" 
            @click="clearAll"
            :disabled="emailList.length === 0"
          >
            <Icon icon="material-symbols:delete-outline" />
            清空全部
          </el-button>
        </div>
        
        <div class="email-tags">
          <el-tag
            v-for="(email, index) in emailList"
            :key="index"
            closable
            @close="removeEmail(index)"
            class="email-tag"
            size="large"
            type="info"
          >
            <Icon icon="material-symbols:email" class="tag-icon" />
            {{ email }}
          </el-tag>
          
          <div v-if="emailList.length === 0" class="empty-state">
            <el-empty description="暂无邮箱,点击上方按钮添加" />
          </div>
        </div>
      </div>
    </div>

    <!-- 批量添加对话框 -->
    <el-dialog
      v-model="showBatchAddDialog"
      title="批量添加邮箱"
      width="600px"
      append-to-body
    >
      <el-form>
        <el-form-item label="邮箱列表">
          <el-input
            v-model="batchEmails"
            type="textarea"
            :rows="10"
            placeholder="请输入邮箱地址,每行一个:&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
          />
          <div class="form-tip">
            每行输入一个邮箱地址,系统会自动验证格式并去重
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showBatchAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleBatchAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 从全部邮件导入对话框 -->
    <el-dialog
      v-model="showImportDialog"
      title="从全部邮件导入邮箱"
      width="900px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="import-container">
        <!-- 搜索栏 -->
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
          <el-select v-model="sortBy" @change="loadEmails" class="sort-select">
            <el-option label="按邮箱排序" value="email" />
            <el-option label="按邮件数量排序" value="count" />
          </el-select>
        </div>

        <!-- 批量操作按钮 -->
        <div class="batch-actions">
          <el-checkbox 
            v-model="selectAll" 
            @change="handleSelectAll"
            :indeterminate="isIndeterminate"
          >
            全选本页
          </el-checkbox>
          <span class="selected-info">
            已选择 {{ selectedEmails.size }} / {{ totalEmails }} 个邮箱
          </span>
          <el-button 
            type="primary" 
            size="small"
            @click="addSelectedToWhitelist"
            :disabled="selectedEmails.size === 0"
          >
            <Icon icon="material-symbols:add" />
            添加选中项 ({{ selectedEmails.size }})
          </el-button>
        </div>

        <!-- 邮箱列表 -->
        <div v-loading="loadingEmails" class="email-list">
          <el-checkbox-group v-model="selectedEmailsArray" @change="handleSelectionChange">
            <div 
              v-for="item in displayEmails" 
              :key="item.email"
              class="email-item"
              :class="{ 
                'in-whitelist': emailList.includes(item.email),
                'selected': selectedEmails.has(item.email)
              }"
            >
              <el-checkbox 
                :label="item.email"
                :disabled="emailList.includes(item.email)"
              >
                <div class="email-item-content">
                  <div class="email-address">
                    <Icon icon="material-symbols:email" class="email-icon" />
                    <span class="email-text">{{ item.email }}</span>
                    <el-tag 
                      v-if="emailList.includes(item.email)" 
                      size="small" 
                      type="success"
                    >
                      已在白名单
                    </el-tag>
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

          <div v-if="displayEmails.length === 0" class="empty-result">
            <el-empty description="未找到符合条件的邮箱" />
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200]"
            :total="totalEmails"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showImportDialog = false">关闭</el-button>
        <el-button 
          type="primary" 
          @click="addSelectedToWhitelist"
          :disabled="selectedEmails.size === 0"
        >
          添加选中项 ({{ selectedEmails.size }})
        </el-button>
      </template>
    </el-dialog>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存设置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { getShareWhitelist, updateShareWhitelist } from '@/request/share.js';
import { getUniqueRecipients } from '@/request/all-email.js';
import dayjs from 'dayjs';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'updated']);

// 响应式数据
const visible = ref(false);
const saving = ref(false);
const emailList = ref([]);
const showBatchAddDialog = ref(false);
const batchEmails = ref('');

// 导入对话框相关
const showImportDialog = ref(false);
const importing = ref(false);
const loadingEmails = ref(false);
const searchKeyword = ref('');
const sortBy = ref('email');
const currentPage = ref(1);
const pageSize = ref(50);
const totalEmails = ref(0);
const allEmails = ref([]);
const displayEmails = ref([]);
const selectedEmails = ref(new Set());
const selectedEmailsArray = ref([]);
const selectAll = ref(false);

// 计算属性
const isIndeterminate = computed(() => {
  const selectedCount = selectedEmailsArray.value.length;
  return selectedCount > 0 && selectedCount < displayEmails.value.length;
});

// 监听显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    loadWhitelist();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 监听导入对话框打开
watch(showImportDialog, (val) => {
  if (val) {
    loadEmails();
  } else {
    // 重置状态
    searchKeyword.value = '';
    currentPage.value = 1;
    selectedEmails.value.clear();
    selectedEmailsArray.value = [];
  }
});

// 加载白名单
const loadWhitelist = async () => {
  try {
    emailList.value = await getShareWhitelist();
  } catch (error) {
    ElMessage.error('加载白名单失败');
  }
};

// 加载全部邮件的唯一邮箱
const loadEmails = async () => {
  loadingEmails.value = true;
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

    // 更新全选状态
    updateSelectAllState();
  } catch (error) {
    console.error('Load emails error:', error);
    ElMessage.error('加载邮箱列表失败');
  } finally {
    loadingEmails.value = false;
  }
};

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1;
  loadEmails();
};

// 分页处理
const handlePageChange = () => {
  loadEmails();
};

const handleSizeChange = () => {
  currentPage.value = 1;
  loadEmails();
};

// 全选/取消全选
const handleSelectAll = () => {
  if (selectAll.value) {
    // 全选当前页
    displayEmails.value.forEach(item => {
      if (!emailList.value.includes(item.email)) {
        selectedEmails.value.add(item.email);
        if (!selectedEmailsArray.value.includes(item.email)) {
          selectedEmailsArray.value.push(item.email);
        }
      }
    });
  } else {
    // 取消全选当前页
    displayEmails.value.forEach(item => {
      selectedEmails.value.delete(item.email);
      const index = selectedEmailsArray.value.indexOf(item.email);
      if (index > -1) {
        selectedEmailsArray.value.splice(index, 1);
      }
    });
  }
};

// 更新全选状态
const updateSelectAllState = () => {
  const availableEmails = displayEmails.value.filter(item => 
    !emailList.value.includes(item.email)
  );
  const selectedInPage = availableEmails.filter(item => 
    selectedEmails.value.has(item.email)
  );
  selectAll.value = availableEmails.length > 0 && 
    selectedInPage.length === availableEmails.length;
};

// 选择变更处理
const handleSelectionChange = (values) => {
  // 同步Set和Array
  selectedEmails.value.clear();
  values.forEach(email => selectedEmails.value.add(email));
  updateSelectAllState();
};

// 添加选中项到白名单
const addSelectedToWhitelist = () => {
  const newEmails = Array.from(selectedEmails.value).filter(
    email => !emailList.value.includes(email)
  );

  if (newEmails.length === 0) {
    ElMessage.warning('没有可添加的新邮箱');
    return;
  }

  emailList.value.push(...newEmails);
  ElMessage.success(`成功添加 ${newEmails.length} 个邮箱到白名单`);

  // 清空选择
  selectedEmails.value.clear();
  selectedEmailsArray.value = [];
  selectAll.value = false;

  // 刷新列表
  loadEmails();
};

// 添加单个邮箱
const addSingleEmail = async () => {
  try {
    const { value: email } = await ElMessageBox.prompt(
      '请输入邮箱地址',
      '添加邮箱',
      {
        inputPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        inputErrorMessage: '请输入有效的邮箱地址'
      }
    );
    
    if (emailList.value.includes(email)) {
      ElMessage.warning('该邮箱已存在');
      return;
    }
    
    emailList.value.push(email);
    ElMessage.success('添加成功');
  } catch (error) {
    // 用户取消
  }
};

// 批量添加邮箱
const handleBatchAdd = () => {
  const emails = batchEmails.value
    .split('\n')
    .map(email => email.trim())
    .filter(email => email)
    .filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email));
  
  if (emails.length === 0) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }
  
  // 去重并添加
  const newEmails = emails.filter(email => !emailList.value.includes(email));
  emailList.value.push(...newEmails);
  
  ElMessage.success(`成功添加 ${newEmails.length} 个邮箱`);
  showBatchAddDialog.value = false;
  batchEmails.value = '';
};

// 移除邮箱
const removeEmail = (index) => {
  emailList.value.splice(index, 1);
};

// 清空全部
const clearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有邮箱吗?此操作不可恢复。',
      '确认清空',
      { type: 'warning' }
    );
    
    emailList.value = [];
    ElMessage.success('已清空所有邮箱');
  } catch (error) {
    // 用户取消
  }
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-';
  return dayjs(time).format('YYYY-MM-DD HH:mm');
};

// 保存设置
const handleSave = async () => {
  saving.value = true;
  try {
    await updateShareWhitelist(emailList.value);
    emit('updated');
    ElMessage.success('保存成功');
    handleClose();
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

// 处理关闭
const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.whitelist-dialog {
  --el-dialog-width: 1200px;
}

.whitelist-content {
  max-height: 600px;
  overflow-y: auto;
}

/* 信息提示 */
.info-alert {
  margin-bottom: 20px;
}

.alert-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.alert-icon {
  font-size: 20px;
}

.alert-content {
  margin-top: 8px;
  line-height: 1.8;
}

.alert-content p {
  margin: 4px 0;
}

/* 操作区域 */
.whitelist-header {
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 列表区域 */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 500;
}

.email-tags {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 120px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.email-tag {
  margin: 0;
  height: 44px;
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  transition: all 0.2s;
}

.email-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tag-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.empty-state {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}

/* 导入对话框 */
.import-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-bar {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
}

.sort-select {
  width: 180px;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.selected-info {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.email-list {
  min-height: 400px;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 12px;
}

.email-item {
  padding: 12px 16px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition: all 0.2s;
}

.email-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-fill-color-extra-light);
}

.email-item.selected {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.email-item.in-whitelist {
  background-color: var(--el-color-success-light-9);
  opacity: 0.6;
}

.email-item-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.email-address {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.email-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.email-text {
  flex: 1;
}

.email-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-result {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.pagination {
  display: flex;
  justify-content: center;
  padding-top: 12px;
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
</style>
