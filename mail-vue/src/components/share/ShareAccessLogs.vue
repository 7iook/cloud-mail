<template>
  <div class="access-logs-container">
    <!-- 筛选条件 -->
    <div class="filter-section">
      <el-form :model="filterForm" inline>
        <el-form-item label="分享记录">
          <el-select v-model="filterForm.shareId" placeholder="选择分享记录" clearable @change="loadAccessLogs">
            <el-option
              v-for="share in shareList"
              :key="share.shareId"
              :label="`${share.shareName} (${share.targetEmail})`"
              :value="share.shareId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="访问结果">
          <el-select v-model="filterForm.accessResult" placeholder="选择访问结果" clearable @change="loadAccessLogs">
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

    <!-- 访问统计 -->
    <div class="stats-section" v-if="selectedShareStats">
      <el-row :gutter="20">
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
      <el-table :data="accessLogs" style="width: 100%" v-loading="loading">
        <el-table-column prop="accessTime" label="访问时间" width="180">
          <template #default="scope">
            {{ tzDayjs(scope.row.accessTime).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
        </el-table-column>
        <el-table-column prop="accessIp" label="访问IP" width="140" />
        <el-table-column prop="accessEmail" label="访问邮箱" width="200" />
        <el-table-column prop="extractedCodes" label="提取的验证码" width="150">
          <template #default="scope">
            <el-tag
              v-for="code in scope.row.extractedCodes"
              :key="code"
              size="small"
              class="code-tag"
            >
              {{ code }}
            </el-tag>
            <span v-if="scope.row.extractedCodes.length === 0" class="no-code">无</span>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { tzDayjs } from '@/utils/day.js';
import { getShareList, getShareLogs, getShareStats } from '@/request/share.js';

defineOptions({
  name: 'ShareAccessLogs'
});

// 响应式数据
const loading = ref(false);
const shareList = ref([]);
const accessLogs = ref([]);
const selectedShareStats = ref(null);

// 筛选表单
const filterForm = reactive({
  shareId: null,
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

// 页面加载
onMounted(() => {
  loadShareList();
  loadAccessLogs();
});

// 监听分享记录选择变化
watch(() => filterForm.shareId, (newShareId) => {
  if (newShareId) {
    loadShareStats(newShareId);
  } else {
    selectedShareStats.value = null;
  }
});

// 加载分享列表
const loadShareList = async () => {
  try {
    const response = await getShareList({ page: 1, pageSize: 100 });
    shareList.value = response.data?.list || response.list || [];

    // 如果没有选择分享记录且有分享记录，默认选择第一个
    if (!filterForm.shareId && shareList.value.length > 0) {
      filterForm.shareId = shareList.value[0].shareId;
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

    const response = await getShareLogs(params);
    const data = response.data || response;
    
    accessLogs.value = data.list || [];
    pagination.total = data.total || 0;
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

// 刷新日志
const refreshLogs = () => {
  loadAccessLogs();
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

.code-tag {
  margin-right: 5px;
  margin-bottom: 2px;
}

.no-code {
  color: #999;
  font-style: italic;
}

.error-message {
  color: #f56c6c;
}
</style>
