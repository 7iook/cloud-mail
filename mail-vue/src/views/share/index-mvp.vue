<template>
  <div class="share-container">
    <!-- 选项卡布局 -->
    <el-tabs v-model="activeTab" class="share-tabs">
      <!-- 分享管理选项卡 -->
      <el-tab-pane label="分享管理" name="management">
        <!-- 页面头部 - 参考截图的工具栏设计 -->
        <div class="share-header">
          <!-- 状态筛选器 -->
          <div class="filter-section">
            <el-radio-group v-model="filterStatus" @change="loadShareList" size="small">
              <el-radio-button label="">
                全部 <span class="count">({{ stats.total }})</span>
              </el-radio-button>
              <el-radio-button label="active">
                活跃 <span class="count">({{ stats.active }})</span>
              </el-radio-button>
              <el-radio-button label="expired">
                已过期 <span class="count">({{ stats.expired }})</span>
              </el-radio-button>
              <el-radio-button label="disabled">
                已禁用 <span class="count">({{ stats.disabled }})</span>
              </el-radio-button>
            </el-radio-group>
          </div>

          <!-- 批量操作工具栏 - 参考截图的按钮组 -->
          <div class="header-actions">
            <el-button type="primary" @click="showCreateDialog = true" v-perm="'share:create'">
              <Icon icon="material-symbols:share" />
              创建分享
            </el-button>

            <el-divider direction="vertical" />

            <!-- 批量操作按钮组 - 优化为下拉菜单 -->
            <el-dropdown
              @command="handleBatchExtendCommand"
              :disabled="selectedRows.length === 0"
              v-perm="'share:create'"
            >
              <el-button :disabled="selectedRows.length === 0">
                <Icon icon="material-symbols:calendar-add-on" />
                批量延长
                <Icon icon="ep:arrow-down" style="margin-left: 4px" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="7">
                    <Icon icon="material-symbols:calendar-today" />
                    延长 7 天
                  </el-dropdown-item>
                  <el-dropdown-item command="30">
                    <Icon icon="material-symbols:calendar-month" />
                    延长 30 天
                  </el-dropdown-item>
                  <el-dropdown-item command="90">
                    <Icon icon="material-symbols:date-range" />
                    延长 90 天
                  </el-dropdown-item>
                  <el-dropdown-item command="custom" divided>
                    <Icon icon="material-symbols:edit-calendar" />
                    自定义天数...
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-button
              :disabled="selectedRows.length === 0"
              @click="handleBatchDisable"
              type="warning"
              v-perm="'share:delete'"
            >
              <Icon icon="material-symbols:block" />
              批量禁用
            </el-button>

            <el-button
              :disabled="selectedRows.length === 0"
              @click="handleBatchEnable"
              type="success"
              v-perm="'share:create'"
            >
              <Icon icon="material-symbols:check-circle" />
              批量启用
            </el-button>

            <el-divider direction="vertical" />

            <el-button @click="refreshList">
              <Icon icon="ion:reload" width="18" height="18" />
              刷新
            </el-button>

            <!-- 选中提示 -->
            <span v-if="selectedRows.length > 0" class="selected-tip">
              已选择 <strong>{{ selectedRows.length }}</strong> 项
            </span>
          </div>
        </div>

        <!-- 分享列表 - 参考截图的表格设计 -->
        <div class="share-content">
          <el-table
            :data="shareList"
            style="width: 100%"
            v-loading="loading"
            @selection-change="handleSelectionChange"
            row-key="shareId"
          >
            <!-- 多选列 - 参考截图第一列 -->
            <el-table-column type="selection" width="55" />

            <!-- ID列 -->
            <el-table-column prop="shareId" label="ID" width="80" />

            <!-- 状态列 - 参考截图的状态显示 -->
            <el-table-column label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row)" size="small">
                  {{ getStatusText(scope.row) }}
                </el-tag>
                <!-- 剩余天数提示 -->
                <div class="expire-tip" v-if="scope.row.daysRemaining !== undefined">
                  {{ getExpireTip(scope.row) }}
                </div>
              </template>
            </el-table-column>

            <!-- 目标邮箱 -->
            <el-table-column prop="targetEmail" label="目标邮箱" min-width="200" show-overflow-tooltip />

            <!-- 分享名称 -->
            <el-table-column prop="shareName" label="分享名称" min-width="150" show-overflow-tooltip />

            <!-- 每日邮件统计 - 新增MVP功能 -->
            <el-table-column label="今日邮件" width="130" align="center">
              <template #default="scope">
                <el-progress
                  :percentage="getOtpPercentage(scope.row)"
                  :color="getProgressColor(scope.row)"
                  :stroke-width="12"
                  :show-text="false"
                />
                <div class="otp-count">
                  {{ scope.row.otp_count_daily || 0 }} / {{ scope.row.otp_limit_daily || 100 }}
                </div>
              </template>
            </el-table-column>

            <!-- Token令牌 - 参考截图显示部分token -->
            <el-table-column label="Token令牌" width="150">
              <template #default="scope">
                <el-tooltip :content="scope.row.shareToken" placement="top">
                  <code class="token-display">{{ scope.row.shareToken?.substring(0, 12) }}...</code>
                </el-tooltip>
              </template>
            </el-table-column>

            <!-- 创建时间 -->
            <el-table-column prop="createTime" label="创建时间" width="180">
              <template #default="scope">
                {{ tzDayjs(scope.row.createTime).format('YYYY-MM-DD HH:mm') }}
              </template>
            </el-table-column>

            <!-- 过期时间 -->
            <el-table-column prop="expireTime" label="过期时间" width="180">
              <template #default="scope">
                <span :class="{'expire-warning': isExpiringSoon(scope.row)}">
                  {{ tzDayjs(scope.row.expireTime).format('YYYY-MM-DD HH:mm') }}
                </span>
              </template>
            </el-table-column>

            <!-- 分享链接 -->
            <el-table-column label="分享链接" min-width="280">
              <template #default="scope">
                <div class="share-url-cell">
                  <el-input
                    :value="scope.row.shareUrl"
                    readonly
                    size="small"
                    class="share-url-input"
                  />
                  <el-button
                    size="small"
                    @click="copyShareUrl(scope.row.shareUrl)"
                    class="copy-btn"
                  >
                    <Icon icon="material-symbols:content-copy" />
                  </el-button>
                </div>
              </template>
            </el-table-column>

            <!-- 操作列 - 参考截图的操作按钮 -->
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <!-- 刷新Token按钮 - 对应截图的"更换Token" -->
                <el-button
                  size="small"
                  type="primary"
                  @click="handleRefreshToken(scope.row)"
                  v-perm="'share:create'"
                  :icon="Refresh"
                >
                  刷新Token
                </el-button>

                <!-- 访问日志 -->
                <el-button
                  size="small"
                  @click="viewAccessLogs(scope.row)"
                  v-perm="'share:create'"
                >
                  访问日志
                </el-button>

                <!-- 删除 -->
                <el-button
                  type="danger"
                  size="small"
                  @click="handleDeleteShare(scope.row)"
                  v-perm="'share:delete'"
                  :icon="Delete"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 访问日志选项卡 -->
      <el-tab-pane label="访问日志" name="logs">
        <ShareAccessLogs />
      </el-tab-pane>
    </el-tabs>

    <!-- 创建分享对话框 -->
    <ShareCreateDialog
      v-model="showCreateDialog"
      @created="handleShareCreated"
    />

    <!-- 邮箱白名单管理对话框 -->
    <ShareWhitelistDialog
      v-model="showWhitelistDialog"
      @updated="handleWhitelistUpdated"
    />

    <!-- 自定义延长天数对话框 -->
    <el-dialog
      v-model="showCustomDaysDialog"
      title="自定义延长天数"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="延长天数">
          <el-input-number
            v-model="customDays"
            :min="1"
            :max="365"
            :step="1"
            placeholder="请输入天数"
          />
          <span style="margin-left: 10px; color: var(--el-text-color-secondary)">天</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCustomDaysDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCustomExtend">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { Refresh, Delete } from '@element-plus/icons-vue';
import { tzDayjs } from '@/utils/day.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';
import {
  getShareList,
  deleteShare,
  refreshShareToken,
  batchOperateShares
} from '@/request/share.js';
import ShareCreateDialog from '@/components/share/ShareCreateDialog.vue';
import ShareWhitelistDialog from '@/components/share/ShareWhitelistDialog.vue';
import ShareAccessLogs from '@/components/share/ShareAccessLogs.vue';

defineOptions({
  name: 'share-mvp'
});

// 响应式数据
const loading = ref(false);
const shareList = ref([]);
const selectedRows = ref([]);
const showCreateDialog = ref(false);
const showWhitelistDialog = ref(false);
const showCustomDaysDialog = ref(false);
const customDays = ref(7);
const activeTab = ref('management');
const filterStatus = ref(''); // '', 'active', 'expired', 'disabled'

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  expired: 0,
  disabled: 0
});

// 页面加载
onMounted(() => {
  loadShareList();
});

// 加载分享列表
const loadShareList = async () => {
  loading.value = true;
  try {
    console.log('Loading share list with filter:', filterStatus.value);
    const response = await getShareList({
      page: 1,
      pageSize: 100,
      status: filterStatus.value || undefined
    });

    // 处理响应数据
    let list = [];
    if (response.data && response.data.list) {
      list = response.data.list;
    } else if (response.list) {
      list = response.list;
    } else if (Array.isArray(response)) {
      list = response;
    }

    console.log('Processed share list:', list);

    // 前端计算状态（如果后端未返回）
    list = list.map(item => ({
      ...item,
      status: item.status || calculateStatus(item),
      daysRemaining: item.daysRemaining !== undefined
        ? item.daysRemaining
        : calculateDaysRemaining(item)
    }));

    shareList.value = list;

    // 更新统计
    updateStats(list);
  } catch (error) {
    console.error('Load share list error:', error);
    ElMessage.error(`加载分享列表失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

// 计算状态（前端逻辑，后端应该返回）
const calculateStatus = (share) => {
  if (share.isActive === 0) return 'disabled';
  if (tzDayjs().isAfter(tzDayjs(share.expireTime))) return 'expired';
  return 'active';
};

// 计算剩余天数
const calculateDaysRemaining = (share) => {
  const now = tzDayjs();
  const expire = tzDayjs(share.expireTime);
  return expire.diff(now, 'day');
};

// 更新统计数据
const updateStats = (list) => {
  stats.total = list.length;
  stats.active = list.filter(item => item.status === 'active').length;
  stats.expired = list.filter(item => item.status === 'expired').length;
  stats.disabled = list.filter(item => item.status === 'disabled').length;
};

// 获取状态显示文本
const getStatusText = (row) => {
  const statusMap = {
    'active': '使用中',
    'expired': '已过期',
    'disabled': '已禁用'
  };
  return statusMap[row.status] || '未知';
};

// 获取状态标签类型
const getStatusType = (row) => {
  const typeMap = {
    'active': 'success',
    'expired': 'danger',
    'disabled': 'info'
  };
  return typeMap[row.status] || 'warning';
};

// 获取过期提示
const getExpireTip = (row) => {
  if (row.status === 'expired') {
    return '已过期';
  }
  if (row.daysRemaining <= 0) {
    return '今天到期';
  }
  if (row.daysRemaining <= 3) {
    return `还剩 ${row.daysRemaining} 天`;
  }
  return '';
};

// 判断是否即将过期
const isExpiringSoon = (row) => {
  return row.status === 'active' && row.daysRemaining <= 3;
};

// 获取每日邮件百分比
const getOtpPercentage = (row) => {
  const daily = row.otp_count_daily || 0;
  const limit = row.otp_limit_daily || 100;
  return Math.min((daily / limit) * 100, 100);
};

// 获取进度条颜色
const getProgressColor = (row) => {
  const percentage = getOtpPercentage(row);
  if (percentage >= 90) return '#f56c6c'; // 红色
  if (percentage >= 70) return '#e6a23c'; // 橙色
  return '#67c23a'; // 绿色
};

// 刷新列表
const refreshList = () => {
  loadShareList();
};

// 复制分享链接
const copyShareUrl = (url) => {
  copyTextWithFeedback(url, {
    successMessage: '分享链接已复制到剪贴板',
    errorMessage: '复制失败，请重试'
  });
};

// 处理选择变更
const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
};

// 刷新Token
const handleRefreshToken = async (share) => {
  try {
    await ElMessageBox.confirm(
      `确定要刷新"${share.shareName}"的Token吗？刷新后旧的分享链接将失效！`,
      '确认刷新Token',
      {
        type: 'warning',
        confirmButtonText: '确认刷新',
        cancelButtonText: '取消'
      }
    );

    const result = await refreshShareToken(share.shareId);
    ElMessage.success('Token刷新成功，新链接已生成');

    // 自动复制新链接
    if (result.shareUrl) {
      copyShareUrl(result.shareUrl);
    }

    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Refresh token error:', error);
      ElMessage.error('刷新Token失败');
    }
  }
};

// 处理批量延长下拉菜单命令
const handleBatchExtendCommand = (command) => {
  if (command === 'custom') {
    // 显示自定义天数对话框
    customDays.value = 7;
    showCustomDaysDialog.value = true;
  } else {
    // 直接延长指定天数
    handleBatchExtend(parseInt(command));
  }
};

// 确认自定义延长
const confirmCustomExtend = () => {
  if (customDays.value < 1 || customDays.value > 365) {
    ElMessage.warning('请输入1-365之间的天数');
    return;
  }
  showCustomDaysDialog.value = false;
  handleBatchExtend(customDays.value);
};

// 批量延长有效期
const handleBatchExtend = async (days) => {
  if (selectedRows.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要为选中的 ${selectedRows.value.length} 个分享延长 ${days} 天有效期吗？`,
      '确认批量延长',
      {
        type: 'info'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    await batchOperateShares('extend', shareIds, { extendDays: days });

    ElMessage.success(`成功延长 ${selectedRows.value.length} 个分享的有效期`);
    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch extend error:', error);
      ElMessage.error('批量延长失败');
    }
  }
};

// 批量禁用
const handleBatchDisable = async () => {
  if (selectedRows.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要禁用选中的 ${selectedRows.value.length} 个分享吗？禁用后访问链接将无法访问。`,
      '确认批量禁用',
      {
        type: 'warning'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    await batchOperateShares('disable', shareIds);

    ElMessage.success(`成功禁用 ${selectedRows.value.length} 个分享`);
    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch disable error:', error);
      ElMessage.error('批量禁用失败');
    }
  }
};

// 批量启用
const handleBatchEnable = async () => {
  if (selectedRows.value.length === 0) return;

  try {
    await ElMessageBox.confirm(
      `确定要启用选中的 ${selectedRows.value.length} 个分享吗？`,
      '确认批量启用',
      {
        type: 'success'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    await batchOperateShares('enable', shareIds);

    ElMessage.success(`成功启用 ${selectedRows.value.length} 个分享`);
    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch enable error:', error);
      ElMessage.error('批量启用失败');
    }
  }
};

// 查看访问日志
const viewAccessLogs = (shareRecord) => {
  activeTab.value = 'logs';
};

// 删除分享
const handleDeleteShare = async (share) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分享"${share.shareName}"吗？`,
      '确认删除',
      {
        type: 'warning'
      }
    );

    await deleteShare(share.shareId);
    ElMessage.success('删除成功');
    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete share error:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 处理分享创建成功
const handleShareCreated = (results) => {
  loadShareList();
};

// 处理白名单更新
const handleWhitelistUpdated = () => {
  ElMessage.success('邮箱白名单更新成功');
};
</script>

<style scoped>
.share-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.share-header {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
}

.filter-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-section .count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.selected-tip {
  margin-left: auto;
  color: var(--el-color-primary);
  font-size: 14px;
}

.selected-tip strong {
  font-size: 16px;
}

.share-content {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 20px;
}

.expire-tip {
  font-size: 12px;
  color: var(--el-color-warning);
  margin-top: 4px;
}

.expire-warning {
  color: var(--el-color-danger);
  font-weight: 500;
}

.otp-count {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
  text-align: center;
}

.token-display {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.share-url-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share-url-input {
  flex: 1;
}

.copy-btn {
  flex-shrink: 0;
}
</style>
