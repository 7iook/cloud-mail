<template>
  <div class="access-logs-container">
    <!-- 筛选条件 -->
    <div class="filter-section">
      <el-form :model="filterForm" inline>
        <el-form-item label="分享记录">
          <el-select
            ref="shareSelectRef"
            v-model="filterForm.shareId"
            placeholder="选择分享记录"
            clearable
            filterable
            default-first-option
            @change="handleShareChange"
            style="width: 300px"
            :key="shareSelectKey"
          >
            <el-option label="全部" :value="''" />
            <el-option
              v-for="share in shareList"
              :key="share.shareId"
              :label="`${share.shareName} (${share.targetEmail})`"
              :value="share.shareId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="访问结果">
          <el-select 
            v-model="filterForm.accessResult" 
            placeholder="选择访问结果" 
            clearable 
            @change="loadAccessLogs"
            style="width: 150px"
          >
            <el-option label="全部" :value="''" />
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
            <el-option label="被拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="访问邮箱">
          <el-input v-model="filterForm.accessEmail" placeholder="输入访问邮箱" clearable @change="loadAccessLogs" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filterForm.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            @change="loadAccessLogs"
          />
        </el-form-item>
        <el-form-item>
          <el-button @click="refreshLogs">
            <Icon icon="ion:reload" width="18" height="18" />
            刷新
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 异常警告 -->
    <el-alert
      v-if="selectedShareStats?.anomalyStats && hasAnomalies"
      title="⚠️ 异常访问警告"
      type="warning"
      :closable="false"
      show-icon
      class="anomaly-alert"
    >
      <template #default>
        <div class="anomaly-details">
          <p><strong>检测到以下异常访问行为：</strong></p>
          <ul>
            <li v-if="selectedShareStats.anomalyStats.highFreqIpCount > 0">
              🔴 高频IP访问：<strong>{{ selectedShareStats.anomalyStats.highFreqIpCount }}</strong> 个
              （5分钟内访问超过10次）
            </li>
            <li v-if="selectedShareStats.anomalyStats.highFreqShareCount > 0">
              🔴 高频分享记录访问：<strong>{{ selectedShareStats.anomalyStats.highFreqShareCount }}</strong> 个
              （5分钟内访问超过20次）
            </li>
            <li v-if="selectedShareStats.anomalyStats.abnormalFailIpCount > 0">
              🔴 异常失败IP：<strong>{{ selectedShareStats.anomalyStats.abnormalFailIpCount }}</strong> 个
              （5分钟内失败超过5次）
            </li>
          </ul>
        </div>
      </template>
    </el-alert>

    <!-- 访问统计 -->
    <div class="stats-section" v-if="selectedShareStats">
      <el-row :gutter="20">
        <el-col :span="4" v-if="selectedShareStats.totalShares !== undefined">
          <el-statistic title="总分享记录" :value="selectedShareStats.totalShares" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="总访问次数" :value="selectedShareStats.totalAccess" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="成功访问" :value="selectedShareStats.successAccess" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="失败访问" :value="selectedShareStats.failedAccess" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="被拒绝访问" :value="selectedShareStats.rejectedAccess" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="独立IP数" :value="selectedShareStats.uniqueIps" />
        </el-col>
        <el-col :span="4">
          <el-statistic title="成功率" :value="selectedShareStats.successRate" suffix="%" />
        </el-col>
      </el-row>
    </div>

    <!-- 访问日志表格 -->
    <div class="logs-table">
      <el-table 
        :data="accessLogs" 
        style="width: 100%" 
        v-loading="loading"
        :row-class-name="getRowClassName"
      >
        <el-table-column prop="accessTime" label="访问时间" width="180">
          <template #default="scope">
            <div class="time-cell">
              <Icon v-if="scope.row.isAnomaly" icon="material-symbols:warning" color="#f56c6c" width="16" />
              {{ tzDayjs(scope.row.accessTime).format('YYYY-MM-DD HH:mm:ss') }}
            </div>
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
              class="view-codes-btn"
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
        <el-table-column prop="responseTime" label="响应时间" width="100">
          <template #default="scope">
            {{ scope.row.responseTime }}ms
          </template>
        </el-table-column>
        <el-table-column prop="userAgent" label="User-Agent" min-width="200" show-overflow-tooltip />
        <el-table-column prop="errorMessage" label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.errorMessage" class="error-message">
              {{ scope.row.errorMessage }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.accessResult === 'success'"
              size="small"
              type="primary"
              @click="handleViewApi(scope.row)"
              :loading="loadingShareId === scope.row.shareId"
            >
              查看 API
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 高级设置编辑对话框 -->
    <ShareAdvancedEditDialog
      v-model="showAdvancedEditDialog"
      :share-data="currentEditShare"
      @updated="handleAdvancedSettingsUpdated"
    />

    <!-- 验证码详情对话框 -->
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
              {{ tzDayjs(currentAccessLog.accessTime).format('YYYY-MM-DD HH:mm:ss') }}
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
            <el-descriptions-item label="响应时间">
              {{ currentAccessLog.responseTime }}ms
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed, nextTick, getCurrentInstance } from 'vue';
import { ElMessage, ElNotification } from 'element-plus';
import { Icon } from '@iconify/vue';
import { tzDayjs } from '@/utils/day.js';
import { getShareList, getShareLogs, getShareStats, getGlobalShareStats, getAccessDetail } from '@/request/share.js';
import ShareAdvancedEditDialog from './ShareAdvancedEditDialog.vue';
import emailScroll from '@/components/email-scroll/index.vue';
import EmailDetailPane from '@/components/EmailDetailPane.vue';
import { useEmailStore } from '@/store/email.js';

defineOptions({
  name: 'ShareAccessLogs'
});

// 获取当前组件实例
const instance = getCurrentInstance();

// 获取 emailStore
const emailStore = useEmailStore();

// 组件引用
const shareSelectRef = ref(null);
const emailScrollRef = ref(null);

// 强制更新key
const shareSelectKey = ref(0);

// 响应式数据
const loading = ref(false);
const shareList = ref([]);
const accessLogs = ref([]);
const selectedShareStats = ref(null);
const globalStats = ref(null);

// 高级设置对话框相关状态
const showAdvancedEditDialog = ref(false);
const currentEditShare = ref(null);
const loadingShareId = ref(null);

// 验证码详情对话框相关状态
const showCodesDetailDialog = ref(false);
const currentAccessLog = ref(null);
const accessDetailLoading = ref(false);
const accessDetailData = ref(null);

// 邮件详情对话框相关状态 - 使用 emailStore 的分屏布局
const showDetailPane = computed(() => emailStore.splitLayout?.showDetailPane || false);

// 计算属性：是否有异常
const hasAnomalies = computed(() => {
  if (!selectedShareStats.value?.anomalyStats) return false;
  const { highFreqIpCount, highFreqShareCount, abnormalFailIpCount } = selectedShareStats.value.anomalyStats;
  return (highFreqIpCount + highFreqShareCount + abnormalFailIpCount) > 0;
});

// 筛选表单
const filterForm = reactive({
  shareId: '',
  accessResult: '',
  accessEmail: '',
  dateRange: null
});

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

// 监听shareList变化，确保下拉框正确显示
watch(() => shareList.value, async (newList) => {
  if (newList && newList.length > 0) {
    // 使用nextTick确保DOM更新
    await nextTick();

    // 如果当前选中的shareId不在新列表中，重置为空字符串
    if (filterForm.shareId !== '') {
      const exists = newList.some(share => share.shareId === filterForm.shareId);
      if (!exists) {
        filterForm.shareId = '';
      }
    }
  }
}, { immediate: true });



// 监听数据变化 - 用于调试下拉框显示问题
// watch(() => shareList.value, (newShareList, oldShareList) => {
//   console.log('shareList变化:', newShareList.length, '项');
// }, { deep: true });

// watch(() => filterForm.shareId, (newShareId, oldShareId) => {
//   console.log('filterForm.shareId变化:', newShareId);
// });

// 页面加载
onMounted(() => {
  // 组件挂载时加载数据
  loadShareList();
  loadAccessLogs();
});

// 防抖定时器
let shareChangeDebounceTimer = null;

// 处理分享记录选择变化（添加防抖，防止频繁切换导致存储失败）
const handleShareChange = (shareId) => {
  // 清除之前的定时器
  if (shareChangeDebounceTimer) {
    clearTimeout(shareChangeDebounceTimer);
  }

  // 确保数据类型一致性
  const normalizedShareId = shareId === null || shareId === undefined || shareId === '' ? '' : shareId;
  
  // 300ms防抖延迟
  shareChangeDebounceTimer = setTimeout(async () => {
    try {
      if (!normalizedShareId) {
        // 选择"全部" - 加载全局统计
        await loadGlobalStats();
      } else {
        // 选择特定分享记录
        await loadShareStats(normalizedShareId);
      }
      // 重新加载访问日志
      await loadAccessLogs();
      
      // 使用nextTick确保DOM更新
      await nextTick();
    } catch (error) {
      console.error('Handle share change error:', error);
      ElMessage.error('切换分享记录失败');
    }
  }, 300);
};

// 加载分享列表
const loadShareList = async () => {
  try {
    const response = await getShareList({ page: 1, pageSize: 100 });
    shareList.value = response.data?.list || response.list || [];

    // 使用nextTick确保DOM更新后再设置默认值
    await nextTick();

    // 确保filterForm.shareId初始值为空字符串（显示"全部"）
    if (filterForm.shareId === undefined) {
      filterForm.shareId = '';
    }

    // 强制更新下拉框组件以解决显示问题
    shareSelectKey.value += 1;
    await nextTick();

    // 强制重新渲染组件
    if (instance && instance.proxy) {
      instance.proxy.$forceUpdate();
    }

    // 默认显示所有记录的统计
    if (shareList.value.length > 0) {
      await loadGlobalStats();
    }
  } catch (error) {
    console.error('Load share list error:', error);
    ElMessage.error('加载分享列表失败');
  }
};

// 加载访问日志
const loadAccessLogs = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filterForm
    };

    // 处理时间范围
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0];
      params.endDate = filterForm.dateRange[1];
    }
    delete params.dateRange;

    // 如果shareId为空，从参数中移除它，这样getShareLogs会调用全局统计API
    if (!params.shareId) {
      delete params.shareId;
      console.log('调用全局统计API获取访问日志，参数:', params);
    } else {
      console.log('调用特定分享记录API获取访问日志，shareId:', params.shareId, '参数:', params);
    }

    const response = await getShareLogs(params);
    console.log('getShareLogs API响应:', response);

    const data = response.data || response;
    console.log('处理后的数据:', data);

    accessLogs.value = data.list || [];
    pagination.total = data.total || 0;

    console.log('设置访问日志数据:', accessLogs.value.length, '条记录，总数:', pagination.total);
  } catch (error) {
    console.error('Load access logs error:', error);
    ElMessage.error('加载访问日志失败');
  } finally {
    loading.value = false;
  }
};

// 加载分享统计
const loadShareStats = async (shareId) => {
  try {
    const response = await getShareStats(shareId, { days: 7 });
    // 添加安全检查，防止response.data为undefined
    if (response && response.data) {
      selectedShareStats.value = response.data;
    } else if (response) {
      selectedShareStats.value = response;
    } else {
      selectedShareStats.value = null;
    }
  } catch (error) {
    console.error('Load share stats error:', error);
    // 不显示错误提示，因为可能是权限问题或分享不存在
    selectedShareStats.value = null;
  }
};

// 加载全局统计（所有分享记录的汇总）
const loadGlobalStats = async () => {
  loading.value = true;
  try {
    const response = await getGlobalShareStats({ 
      days: 7
    });
    const data = response.data || response;
    
    // 更新统计数据
    selectedShareStats.value = {
      totalShares: data.totalShares,
      totalAccess: data.totalAccess,
      successAccess: data.successAccess,
      failedAccess: data.failedAccess,
      rejectedAccess: data.rejectedAccess,
      uniqueIps: data.uniqueIps,
      successRate: data.successRate,
      anomalyStats: data.anomalyStats
    };
    
    // 重置分页状态
    pagination.page = 1;
    pagination.total = 0;
    
    // 显示异常警告
    if (data.anomalyStats) {
      const { highFreqIpCount, highFreqShareCount, abnormalFailIpCount } = data.anomalyStats;
      const totalAnomalies = highFreqIpCount + highFreqShareCount + abnormalFailIpCount;
      
      if (totalAnomalies > 0) {
        ElNotification({
          title: '⚠️ 异常访问警告',
          message: `检测到 ${totalAnomalies} 个异常访问行为`,
          type: 'warning',
          duration: 5000
        });
      }
    }
  } catch (error) {
    console.error('Load global stats error:', error);
    ElMessage.error('加载全局统计失败');
    selectedShareStats.value = null;
  } finally {
    loading.value = false;
  }
};

// 刷新日志 - 完整刷新所有数据
const refreshLogs = async () => {
  try {
    // 重置分页到第一页
    pagination.page = 1;
    
    // 重新加载分享列表
    await loadShareList();
    
    // 根据当前选择的分享记录重新加载统计数据
    if (!filterForm.shareId) {
      await loadGlobalStats();
    } else {
      await loadShareStats(filterForm.shareId);
    }
    
    // 重新加载访问日志
    await loadAccessLogs();
    
    ElMessage.success('数据刷新成功');
  } catch (error) {
    console.error('Refresh logs error:', error);
    ElMessage.error('刷新失败，请重试');
  }
};

// 分页处理
const handleSizeChange = (val) => {
  pagination.pageSize = val;
  pagination.page = 1;
  loadAccessLogs();
};

const handleCurrentChange = (val) => {
  pagination.page = val;
  loadAccessLogs();
};

// 获取表格行类名（用于异常高亮）
const getRowClassName = ({ row }) => {
  return row.isAnomaly ? 'anomaly-row' : '';
};

// 获取结果标签类型
const getResultTagType = (result) => {
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
};

// 获取结果文本
const getResultText = (result) => {
  switch (result) {
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'rejected':
      return '被拒绝';
    default:
      return result;
  }
};

// 查看 API 设置
const handleViewApi = async (logRow) => {
  if (!logRow.shareId) {
    ElMessage.error('无法获取分享记录信息');
    return;
  }

  try {
    loadingShareId.value = logRow.shareId;

    // 获取分享列表，然后找到对应的分享记录
    const response = await getShareList({ page: 1, pageSize: 100 });
    const shareListData = response.data?.list || response.list || [];

    // 根据 shareId 找到对应的分享记录
    const shareRecord = shareListData.find(share => share.shareId === logRow.shareId);

    if (!shareRecord) {
      ElMessage.error('分享记录不存在或已被删除');
      return;
    }

    // 设置当前编辑的分享记录并显示对话框
    currentEditShare.value = { ...shareRecord };
    showAdvancedEditDialog.value = true;

  } catch (error) {
    console.error('获取分享记录失败:', error);
    ElMessage.error('获取分享记录失败，请重试');
  } finally {
    loadingShareId.value = null;
  }
};

// 处理高级设置更新
const handleAdvancedSettingsUpdated = () => {
  ElMessage.success('API 设置更新成功');
  // 刷新分享列表数据，确保TOKEN更新后的分享链接能同步显示
  loadShareList();
  // 刷新访问日志列表
  loadAccessLogs();
};

// 查看验证码详情
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
    // axios拦截器已经解包了data.data,所以response直接就是{ accessLog: {...}, emails: [...] }
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
  // emailScroll 组件需要返回 { list, total, latestEmail } 格式的数据
  const emails = accessDetailData.value?.emails || [];

  return {
    list: emails,
    total: emails.length,
    latestEmail: emails.length > 0 ? emails[0] : null
  };
};

// 处理邮件选择 - 复用"全部邮件"页面的逻辑
const handleEmailSelect = (email) => {
  // 在对话框中,直接显示邮件详情
  if (emailStore.splitLayout) {
    emailStore.splitLayout.selectedEmail = email;
    emailStore.splitLayout.showDetailPane = true;
  }
};

// 关闭邮件详情面板
const closeEmailDetailPane = () => {
  if (emailStore.splitLayout) {
    emailStore.splitLayout.showDetailPane = false;
    emailStore.splitLayout.selectedEmail = null;
  }
};
</script>

<style scoped>
.access-logs-container {
  padding: 20px;
}

.filter-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.stats-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logs-table {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: right;
}

.codes-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.codes-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-codes-btn {
  padding: 0;
  height: auto;
  font-size: 12px;
}

.no-code {
  color: #999;
  font-style: italic;
}

/* 访问详情对话框样式 */
.access-detail-dialog :deep(.el-dialog__body) {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.access-detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.access-info {
  margin-bottom: 0;
}

.access-info h4,
.codes-section h4,
.emails-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.codes-section {
  margin-bottom: 0;
}

.codes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.code-item {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  letter-spacing: 1px;
}

.emails-section {
  margin-top: 0;
}

/* emailScroll 组件容器样式 */
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

.emails-table {
  cursor: pointer;
}

.emails-table :deep(.el-table__row) {
  cursor: pointer;
  transition: background-color 0.2s;
}

.emails-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}

.email-subject,
.email-sender,
.email-time {
  display: flex;
  align-items: center;
}

.no-emails {
  padding: 40px 0;
  text-align: center;
}

.error-message {
  color: #f56c6c;
}

/* 邮件详情对话框样式 */
.email-detail-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.email-detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.email-info-section {
  margin-bottom: 0;
}

.email-content-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.email-html-content {
  padding: 16px;
  background: #f9f9f9;
  border-radius: 4px;
  line-height: 1.6;
  word-wrap: break-word;
}

.email-html-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.email-text-content {
  padding: 16px;
  background: #f9f9f9;
  border-radius: 4px;
  white-space: pre-wrap;
  line-height: 1.6;
  font-family: monospace;
}

.no-content {
  padding: 40px 0;
  text-align: center;
}

/* 异常警告样式 */
.anomaly-alert {
  margin-bottom: 20px;
}

.anomaly-details {
  font-size: 14px;
}

.anomaly-details p {
  margin-bottom: 10px;
}

.anomaly-details ul {
  margin: 0;
  padding-left: 20px;
}

.anomaly-details li {
  margin-bottom: 8px;
  line-height: 1.6;
}

/* 异常日志高亮 */
:deep(.el-table__row.anomaly-row) {
  background-color: #fef0f0 !important;
}

:deep(.el-table__row.anomaly-row:hover) {
  background-color: #fde2e2 !important;
}

:deep(.el-table__row.anomaly-row td) {
  color: #f56c6c;
  font-weight: 500;
}
</style>
