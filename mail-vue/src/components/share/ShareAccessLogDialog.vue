<template>
  <el-dialog
    v-model="visible"
    :title="`访问日志 - ${shareData?.shareName || '未知分享'}`"
    width="80%"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="true"
    class="share-access-log-dialog"
    @closed="handleClosed"
  >
    <div v-if="shareData" class="access-log-content">
      <!-- 分享基本信息 -->
      <div class="share-info-section">
        <div class="share-info-row">
          <span class="info-label">分享名称：</span>
          <span class="info-value">{{ shareData.shareName }}</span>
        </div>
        <div class="share-info-row">
          <span class="info-label">目标邮箱：</span>
          <span class="info-value">{{ shareData.targetEmail }}</span>
        </div>
        <div class="share-info-row">
          <span class="info-label">创建时间：</span>
          <span class="info-value">{{ formatDate(shareData.createTime) }}</span>
        </div>
      </div>

      <!-- 访问日志表格 -->
      <div class="logs-table-section">
        <el-table 
          :data="accessLogs" 
          style="width: 100%" 
          v-loading="loading"
          max-height="400px"
        >
          <el-table-column prop="accessTime" label="访问时间" width="180">
            <template #default="scope">
              {{ formatDate(scope.row.accessTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="accessIp" label="访问IP" width="140" />
          <el-table-column prop="accessEmail" label="访问邮箱" width="200" />
          <el-table-column label="邮件详情" width="120">
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                link
                @click="handleViewCodes(scope.row)"
              >
                查看邮件
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="accessResult" label="访问结果" width="100">
            <template #default="scope">
              <el-tag 
                :type="getResultTagType(scope.row.accessResult)"
                size="small"
              >
                {{ getResultText(scope.row.accessResult) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="emailCount" label="邮件数量" width="100" />
          <el-table-column prop="userAgent" label="用户代理" min-width="200" show-overflow-tooltip />
        </el-table>

        <!-- 分页 -->
        <div class="pagination-wrapper" v-if="total > 0">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && accessLogs.length === 0" class="empty-state">
          <el-empty description="暂无访问日志" />
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 验证码详情对话框 - 复用 ShareAccessLogs 的实现 -->
  <el-dialog
    v-model="showCodesDetailDialog"
    title="访问详情"
    width="80%"
    :before-close="() => showCodesDetailDialog = false"
    class="access-detail-dialog"
  >
    <div v-loading="accessDetailLoading" class="access-detail-content">
      <div v-if="currentAccessLog" class="access-info">
        <h4>访问信息</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="访问时间">
            {{ formatDate(currentAccessLog.accessTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="访问IP">
            {{ currentAccessLog.accessIp }}
          </el-descriptions-item>
          <el-descriptions-item label="访问邮箱">
            {{ currentAccessLog.accessEmail }}
          </el-descriptions-item>
          <el-descriptions-item label="访问结果">
            <el-tag :type="getResultTagType(currentAccessLog.accessResult)" size="small">
              {{ getResultText(currentAccessLog.accessResult) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="邮件数量">
            {{ currentAccessLog.emailCount }}
          </el-descriptions-item>
          <el-descriptions-item label="User-Agent">
            {{ currentAccessLog.userAgent }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div v-if="accessDetailData && accessDetailData.emails" class="emails-section">
        <h4>邮件列表</h4>
        <div v-if="accessDetailData.emails.length > 0" class="email-scroll-container">
          <!-- 复用"全部邮件"页面的 emailScroll 组件 -->
          <emailScroll
            ref="emailScrollRef"
            :get-emailList="getAccessDetailEmails"
            :show-star="false"
            show-user-info
            show-status
            actionLeft="4px"
            :show-account-icon="false"
            @jump="handleEmailSelect"
            :type="'access-detail'"
          />
        </div>
        <div v-else class="no-emails">
          <el-empty description="该时间段内没有邮件" />
        </div>
      </div>
    </div>
  </el-dialog>

  <!-- 邮件详情面板 - 复用 EmailDetailPane 组件 -->
  <el-dialog
    v-model="showDetailPane"
    :title="emailStore.splitLayout?.selectedEmail?.subject || '邮件详情'"
    width="70%"
    :close-on-click-modal="false"
    class="email-detail-dialog"
    @close="closeEmailDetailPane"
  >
    <EmailDetailPane v-if="showDetailPane" />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, reactive, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { tzDayjs } from '@/utils/day.js';
import { getShareLogs, getAccessDetail } from '@/request/share.js';
import emailScroll from '@/components/email-scroll/index.vue';
import EmailDetailPane from '@/components/EmailDetailPane.vue';
import { useEmailStore } from '@/store/email.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  shareData: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'closed']);

// 邮件状态管理
const emailStore = useEmailStore();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 响应式数据
const loading = ref(false);
const accessLogs = ref([]);
const total = ref(0);

// 邮件详情相关
const showCodesDetailDialog = ref(false);
const showDetailPane = ref(false);
const accessDetailLoading = ref(false);
const currentAccessLog = ref(null);
const accessDetailData = ref(null);
const emailScrollRef = ref();

// 分页参数
const pagination = reactive({
  page: 1,
  pageSize: 20
});

// 监听对话框打开，加载数据
watch(() => props.modelValue, (val) => {
  if (val && props.shareData) {
    loadAccessLogs();
  }
});

// 加载访问日志
const loadAccessLogs = async () => {
  if (!props.shareData?.shareId) {
    ElMessage.error('分享记录信息不完整');
    return;
  }

  loading.value = true;
  try {
    const params = {
      shareId: props.shareData.shareId,
      page: pagination.page,
      pageSize: pagination.pageSize
    };

    const response = await getShareLogs(params);
    const data = response.data || response;
    
    accessLogs.value = data.list || [];
    total.value = data.total || 0;
  } catch (error) {
    console.error('Load access logs error:', error);
    ElMessage.error('加载访问日志失败');
  } finally {
    loading.value = false;
  }
};

// 处理分页大小变化
const handleSizeChange = (val) => {
  pagination.pageSize = val;
  pagination.page = 1;
  loadAccessLogs();
};

// 处理页码变化
const handleCurrentChange = (val) => {
  pagination.page = val;
  loadAccessLogs();
};

// 处理对话框关闭
function handleClose() {
  visible.value = false;
}

function handleClosed() {
  // 重置数据
  accessLogs.value = [];
  total.value = 0;
  pagination.page = 1;
  pagination.pageSize = 20;
  emit('closed');
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return tzDayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

// 获取访问结果标签类型
function getResultTagType(result) {
  switch (result) {
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    case 'rejected':
      return 'warning';
    default:
      return 'info';
  }
}

// 获取访问结果文本
function getResultText(result) {
  switch (result) {
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'rejected':
      return '拒绝';
    default:
      return '未知';
  }
}

// 查看验证码详情 - 复用 ShareAccessLogs 的实现
const handleViewCodes = async (logRow) => {
  if (!logRow.logId) {
    ElMessage.error('无法获取访问日志信息');
    return;
  }

  try {
    accessDetailLoading.value = true;
    currentAccessLog.value = logRow;

    // 调用API获取访问详情
    const response = await getAccessDetail(logRow.logId);
    accessDetailData.value = response;

    // 初始化 emailStore 的分屏布局(如果不存在)
    if (!emailStore.splitLayout) {
      emailStore.splitLayout = {
        mode: 'none',
        selectedEmail: null,
        showDetailPane: false,
        paneSizes: { right: [40, 60], bottom: [60, 40] }
      };
    }

    showCodesDetailDialog.value = true;

    // 如果有邮件数据,刷新 emailScroll 组件
    if (response.emails && response.emails.length > 0) {
      await nextTick();
      if (emailScrollRef.value) {
        emailScrollRef.value.refreshList();
      }
    }
  } catch (error) {
    console.error('获取访问详情失败:', error);
    ElMessage.error('获取访问详情失败，请重试');
  } finally {
    accessDetailLoading.value = false;
  }
};

// 为 emailScroll 组件提供邮件数据获取方法
const getAccessDetailEmails = async (emailId, size) => {
  const emails = accessDetailData.value?.emails || [];
  return {
    list: emails,
    total: emails.length,
    latestEmail: emails.length > 0 ? emails[0] : null
  };
};

// 处理邮件选择 - 复用"全部邮件"页面的逻辑
const handleEmailSelect = (email) => {
  if (emailStore.splitLayout) {
    emailStore.splitLayout.selectedEmail = email;
    emailStore.splitLayout.showDetailPane = true;
  }
  showDetailPane.value = true;
};

// 关闭邮件详情面板
const closeEmailDetailPane = () => {
  showDetailPane.value = false;
  if (emailStore.splitLayout) {
    emailStore.splitLayout.showDetailPane = false;
    emailStore.splitLayout.selectedEmail = null;
  }
};
</script>

<style scoped>
.access-log-content {
  padding: 0;
}

.share-info-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.share-info-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.share-info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-weight: 500;
  color: var(--el-text-color-regular);
  min-width: 80px;
}

.info-value {
  color: var(--el-text-color-primary);
}

.logs-table-section {
  background: #fff;
  border-radius: 8px;
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: right;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 邮件详情相关样式 */
.access-detail-content {
  padding: 0;
}

.access-info {
  margin-bottom: 20px;
}

.access-info h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.emails-section {
  margin-top: 20px;
}

.emails-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.email-scroll-container {
  height: 400px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}

.email-scroll-container :deep(.scroll) {
  height: 100%;
}

.email-scroll-container :deep(.el-scrollbar) {
  height: 100%;
}

.no-emails {
  padding: 40px 0;
  text-align: center;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .share-info-section {
    background-color: var(--el-bg-color-page);
  }

  .email-scroll-container {
    border-color: var(--el-border-color);
  }
}
</style>

<style>
/* 全局样式，用于调整对话框 */
.share-access-log-dialog .el-dialog {
  margin-top: 5vh !important;
  max-height: 85vh;
}

.share-access-log-dialog .el-dialog__body {
  max-height: 60vh;
  overflow: hidden;
}
</style>
