<template>
  <div class="share-container" @click="handlePageClick">
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

            <!-- 选中提示 - 增强信息显示 -->
            <span v-if="selectedRows.length > 0" class="selected-tip">
              已选择 <strong>{{ selectedRows.length }}</strong> / {{ shareList.length }} 项
            </span>
          </div>
        </div>

        <!-- 分享列表 - 参考截图的表格设计 -->
        <div class="share-content">
          <el-table
            ref="tableRef"
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

            <!-- 分享名称 - 支持内联编辑 -->
            <el-table-column label="分享名称" min-width="150">
              <template #default="scope">
                <div 
                  v-if="!scope.row.editingName" 
                  @dblclick="startEditName(scope.row)"
                  class="editable-cell"
                  :title="scope.row.shareName"
                >
                  {{ scope.row.shareName }}
                  <Icon icon="material-symbols:edit" class="edit-icon" />
                </div>
                <el-input
                  v-else
                  v-model="scope.row.tempShareName"
                  size="small"
                  @blur="saveShareName(scope.row)"
                  @keyup.enter="saveShareName(scope.row)"
                  @keyup.esc="cancelEditName(scope.row)"
                  ref="nameInput"
                  maxlength="100"
                  show-word-limit
                />
              </template>
            </el-table-column>

            <!-- 今日访问统计 - 支持内联编辑限制 -->
            <el-table-column label="今日访问" width="170" align="center">
              <template #default="scope">
                <div v-if="scope.row.otpLimitEnabled === 1">
                  <el-progress
                    :percentage="getOtpPercentage(scope.row)"
                    :color="getProgressColor(scope.row)"
                    :stroke-width="12"
                    :show-text="false"
                  />
                  <div class="otp-count">
                    {{ scope.row.otpCountDaily || 0 }} /

                    <!-- 查看模式 -->
                    <span
                      v-if="!scope.row.editingLimit"
                      @click.stop="startEditLimit(scope.row)"
                      class="editable-limit"
                      :title="'单击编辑每日访问限制'"
                    >
                      {{ scope.row.otpLimitDaily || 100 }}
                      <Icon
                        icon="material-symbols:edit"
                        class="edit-icon-small"
                      />
                    </span>

                    <!-- 编辑模式 -->
                    <div v-else class="inline-edit-wrapper">
                      <el-input-number
                        v-model="scope.row.tempOtpLimit"
                        size="default"
                        :min="1"
                        :max="10000"
                        :loading="scope.row.savingLimit"
                        @keyup.enter="saveOtpLimit(scope.row)"
                        @keyup.esc="cancelEditLimit(scope.row)"
                        ref="limitInput"
                        style="width: 150px;"
                        class="inline-edit-input"
                      />
                      <div class="inline-edit-actions-below">
                        <el-button
                          size="small"
                          @click="cancelEditLimit(scope.row)"
                          class="action-btn-below"
                          :icon="''"
                          title="取消编辑 (Esc)"
                        >
                          <Icon icon="material-symbols:close" style="font-size: 14px;" />
                        </el-button>
                        <el-button
                          size="small"
                          type="primary"
                          @click="saveOtpLimit(scope.row)"
                          :loading="scope.row.savingLimit"
                          class="action-btn-below"
                          :icon="''"
                          title="保存 (Enter)"
                        >
                          <Icon icon="material-symbols:check" style="font-size: 14px;" />
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="limit-disabled">
                  <el-tag type="info" size="small">无限制</el-tag>
                  <div class="otp-count-text">{{ scope.row.otpCountDaily || 0 }} 次</div>
                </div>
              </template>
            </el-table-column>

            <!-- 显示限制 - 支持内联编辑 -->
            <el-table-column label="显示限制" width="140" align="center">
              <template #default="scope">
                <div v-if="scope.row.verificationCodeLimitEnabled === 1">
                  <!-- 查看模式 -->
                  <div
                    v-if="!scope.row.editingDisplayLimit"
                    class="inline-edit-container"
                    @click.stop="startEditDisplayLimit(scope.row)"
                    :title="'单击编辑显示限制'"
                    style="cursor: pointer;"
                  >
                    <el-tag
                      type="success"
                      size="small"
                      class="editable-tag"
                    >
                      最多 {{ scope.row.verificationCodeLimit || 100 }} 条
                      <Icon
                        icon="material-symbols:edit"
                        class="edit-icon-small"
                      />
                    </el-tag>
                  </div>

                  <!-- 编辑模式 -->
                  <div v-else class="inline-edit-active">
                    <el-input-number
                      v-model="scope.row.tempDisplayLimit"
                      size="default"
                      :min="1"
                      :max="1000"
                      :loading="scope.row.savingDisplayLimit"
                      @keyup.enter="saveDisplayLimit(scope.row)"
                      @keyup.esc="cancelEditDisplayLimit(scope.row)"
                      ref="displayLimitInput"
                      style="width: 150px;"
                      class="inline-edit-input"
                    />
                    <div class="inline-edit-actions-below">
                      <el-button
                        size="small"
                        @click="cancelEditDisplayLimit(scope.row)"
                        class="action-btn-below"
                        :icon="''"
                        title="取消编辑 (Esc)"
                      >
                        <Icon icon="material-symbols:close" style="font-size: 14px;" />
                      </el-button>
                      <el-button
                        size="small"
                        type="primary"
                        @click="saveDisplayLimit(scope.row)"
                        :loading="scope.row.savingDisplayLimit"
                        class="action-btn-below"
                        :icon="''"
                        title="保存 (Enter)"
                      >
                        <Icon icon="material-symbols:check" style="font-size: 14px;" />
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else>
                  <el-tag type="info" size="small">显示全部</el-tag>
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

            <!-- 过期时间 - 支持内联编辑 -->
            <el-table-column label="过期时间" width="200">
              <template #default="scope">
                <div 
                  v-if="!scope.row.editingExpire"
                  @dblclick="startEditExpire(scope.row)"
                  class="editable-cell"
                  :class="{'expire-warning': isExpiringSoon(scope.row)}"
                  :title="'双击编辑过期时间'"
                >
                  {{ tzDayjs(scope.row.expireTime).format('YYYY-MM-DD HH:mm') }}
                  <Icon icon="material-symbols:edit" class="edit-icon" />
                </div>
                <el-date-picker
                  v-else
                  v-model="scope.row.tempExpireTime"
                  type="datetime"
                  size="small"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  @blur="saveExpireTime(scope.row)"
                  @change="saveExpireTime(scope.row)"
                  ref="expireInput"
                  style="width: 180px;"
                  :disabled-date="(date) => date < new Date()"
                />
              </template>
            </el-table-column>

            <!-- 分享链接 - 超链接化 -->
            <el-table-column label="分享链接" min-width="280">
              <template #default="scope">
                <div class="share-url-cell">
                  <div class="share-url-container">
                    <a
                      :href="scope.row.shareUrl"
                      target="_blank"
                      class="share-url-link"
                      :title="'点击在新标签页中打开分享页面'"
                    >
                      {{ scope.row.shareUrl }}
                    </a>
                  </div>
                  <el-button
                    size="small"
                    @click="copyShareUrl(scope.row.shareUrl)"
                    class="copy-btn"
                    :title="'复制分享链接'"
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

                <!-- 编辑高级参数 -->
                <el-button
                  size="small"
                  type="warning"
                  @click="editAdvancedSettings(scope.row)"
                  v-perm="'share:create'"
                  :icon="Setting"
                >
                  高级设置
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

    <!-- 高级设置编辑对话框 -->
    <ShareAdvancedEditDialog
      v-model="showAdvancedEditDialog"
      :share-data="currentEditShare"
      @updated="handleAdvancedSettingsUpdated"
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
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { Refresh, Delete, Setting } from '@element-plus/icons-vue';
import { tzDayjs } from '@/utils/day.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';
import {
  getShareList,
  deleteShare,
  refreshShareToken,
  batchOperateShares,
  updateShareName,
  updateShareLimit,
  updateShareExpireTime,
  updateShareDisplayLimit
} from '@/request/share.js';
import ShareCreateDialog from '@/components/share/ShareCreateDialog.vue';
import ShareAdvancedEditDialog from '@/components/share/ShareAdvancedEditDialog.vue';
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
const showAdvancedEditDialog = ref(false);
const currentEditShare = ref(null);

// Table ref for Element Plus API access
const tableRef = ref();
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

      // 优先使用后端返回的统计数据
      if (response.data.stats) {
        stats.total = response.data.stats.total;
        stats.active = response.data.stats.active;
        stats.expired = response.data.stats.expired;
        stats.disabled = response.data.stats.disabled;
        console.log('Using backend stats:', response.data.stats);
      }
    } else if (response.list) {
      list = response.list;
    } else if (Array.isArray(response)) {
      list = response;
    }

    console.log('Processed share list:', list);

    // 前端计算状态（如果后端未返回）
    list = list.map(item => reactive({
      ...item,
      status: item.status || calculateStatus(item),
      daysRemaining: item.daysRemaining !== undefined
        ? item.daysRemaining
        : calculateDaysRemaining(item),
      // 初始化所有编辑状态属性，确保响应式追踪的完整性
      // 分享名称编辑状态
      editingName: false,
      tempShareName: item.shareName || '',
      // 每日访问限制编辑状态
      editingLimit: false,
      savingLimit: false,
      tempOtpLimit: item.otpLimitDaily || 100,  // 修正：使用 tempOtpLimit 而不是 tempLimit
      // 显示限制编辑状态
      editingDisplayLimit: false,
      savingDisplayLimit: false,
      tempDisplayLimit: item.verificationCodeLimit || 100,
      // 过期时间编辑状态
      editingExpire: false,
      tempExpireTime: item.expireTime || null
    }));

    shareList.value = list;

    // 如果后端没有返回统计数据，使用前端计算（向后兼容）
    if (!response.data?.stats) {
      updateStats(list);
      console.log('Using frontend stats calculation');
    }
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

// 计算是否全选状态
const isAllSelected = computed(() => {
  return shareList.value.length > 0 && selectedRows.value.length === shareList.value.length;
});

// 全选/取消全选功能
const toggleSelectAll = () => {
  if (!tableRef.value) return;
  
  if (isAllSelected.value) {
    // 取消全选
    tableRef.value.clearSelection();
  } else {
    // 全选当前页面所有行
    shareList.value.forEach(row => {
      tableRef.value.toggleRowSelection(row, true);
    });
  }
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

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #409EFF;">批量延长操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>延长 ${selectedRows.value.length} 个分享的有效期</p>
  <p style="margin: 8px 0;"><strong>延长时间：</strong>${days} 天</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的过期时间将延后 ${days} 天</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #f5f7fa; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #909399; font-size: 12px;">
    💡 提示：此操作可以撤销，您可以随时调整分享的有效期
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量延长',
      {
        type: 'info',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `延长 ${days} 天`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('extend', shareIds, { extendDays: days });

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功延长 ${affectedCount} 个分享的有效期`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
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

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #E6A23C;">批量禁用操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>禁用 ${selectedRows.value.length} 个分享</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的访问链接将立即失效</p>
  <p style="margin: 8px 0;"><strong>用户影响：</strong>访问者将无法通过分享链接查看邮件</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #fdf6ec; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #E6A23C; font-size: 12px;">
    ⚠️ 注意：禁用后可以重新启用，但访问者需要重新获取链接
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量禁用',
      {
        type: 'warning',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `禁用 ${selectedRows.value.length} 个分享`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('disable', shareIds);

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功禁用 ${affectedCount} 个分享`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
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

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #67C23A;">批量启用操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>启用 ${selectedRows.value.length} 个分享</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的访问链接将立即生效</p>
  <p style="margin: 8px 0;"><strong>用户影响：</strong>访问者可以通过分享链接查看邮件内容</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #67C23A; font-size: 12px;">
    ✅ 提示：启用后分享链接将立即可用，请确保内容适合公开访问
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量启用',
      {
        type: 'success',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `启用 ${selectedRows.value.length} 个分享`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('enable', shareIds);

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功启用 ${affectedCount} 个邮件分享链接`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
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

// ========== 内联编辑功能 ==========

// 开始编辑分享名称
const startEditName = (row) => {
  row.editingName = true;
  row.tempShareName = row.shareName;
  // 下一帧聚焦输入框
  nextTick(() => {
    const input = document.querySelector(`[data-share-id="${row.shareId}"] .el-input__inner`);
    if (input) input.focus();
  });
};

// 保存分享名称
const saveShareName = async (row) => {
  if (!row.tempShareName || row.tempShareName.trim() === '') {
    ElMessage.warning('分享名称不能为空');
    return;
  }

  if (row.tempShareName.trim() === row.shareName) {
    cancelEditName(row);
    return;
  }

  try {
    await updateShareName(row.shareId, row.tempShareName.trim());
    row.shareName = row.tempShareName.trim();
    row.editingName = false;
    ElMessage.success('分享名称更新成功');
  } catch (error) {
    console.error('Update share name error:', error);
    ElMessage.error('更新分享名称失败');
  }
};

// 取消编辑分享名称
const cancelEditName = (row) => {
  row.editingName = false;
  row.tempShareName = row.shareName;
};

// 开始编辑每日限制
const startEditLimit = (row) => {
  row.editingLimit = true;
  row.tempOtpLimit = row.otpLimitDaily || 100;
  row.savingLimit = false;

  // 下一帧聚焦输入框
  nextTick(() => {
    if (limitInput.value && limitInput.value.focus) {
      limitInput.value.focus();
    }
  });
};

// 保存每日限制
const saveOtpLimit = async (row) => {
  if (!row.tempOtpLimit || row.tempOtpLimit < 1) {
    ElMessage.warning('每日限制必须大于0');
    return;
  }

  if (row.tempOtpLimit === row.otpLimitDaily) {
    cancelEditLimit(row);
    return;
  }

  // 添加加载状态
  row.savingLimit = true;

  try {
    const response = await updateShareLimit(row.shareId, row.tempOtpLimit);

    row.otpLimitDaily = row.tempOtpLimit;
    row.editingLimit = false;
    row.savingLimit = false;
    ElMessage.success('每日限制更新成功');
  } catch (error) {
    row.savingLimit = false;
    console.error('Update limit error:', error);

    // 改进的错误处理
    let errorMessage = '更新每日限制失败';
    if (error.response?.data?.message) {
      errorMessage += ': ' + error.response.data.message;
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }

    ElMessage.error(errorMessage);

    // 保持编辑状态，让用户可以重试
    // row.editingLimit = false; // 注释掉，保持编辑状态
  }
};

// 取消编辑每日限制
const cancelEditLimit = (row) => {
  row.editingLimit = false;
  row.savingLimit = false;
  row.tempOtpLimit = row.otpLimitDaily || 100;
};

// ========== 显示限制内联编辑功能 ==========

// Ref管理 - 简化版本
const limitInput = ref(null);
const displayLimitInput = ref(null);

// 开始编辑显示限制
const startEditDisplayLimit = (row) => {
  row.editingDisplayLimit = true;
  row.tempDisplayLimit = row.verificationCodeLimit || 100;
  row.savingDisplayLimit = false;

  // 下一帧聚焦输入框
  nextTick(() => {
    if (displayLimitInput.value && displayLimitInput.value.focus) {
      displayLimitInput.value.focus();
    }
  });
};

// 保存显示限制
const saveDisplayLimit = async (row) => {
  if (!row.tempDisplayLimit || row.tempDisplayLimit < 1) {
    ElMessage.warning('显示限制必须大于0');
    return;
  }

  if (row.tempDisplayLimit === row.verificationCodeLimit) {
    cancelEditDisplayLimit(row);
    return;
  }

  // 添加加载状态
  row.savingDisplayLimit = true;

  try {
    const response = await updateShareDisplayLimit(row.shareId, row.tempDisplayLimit);

    row.verificationCodeLimit = row.tempDisplayLimit;
    row.editingDisplayLimit = false;
    row.savingDisplayLimit = false;
    ElMessage.success('显示限制更新成功');
  } catch (error) {
    row.savingDisplayLimit = false;
    console.error('Update display limit error:', error);

    // 改进的错误处理
    let errorMessage = '更新显示限制失败';
    if (error.response?.data?.message) {
      errorMessage += ': ' + error.response.data.message;
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }

    ElMessage.error(errorMessage);

    // 保持编辑状态，让用户可以重试
    // row.editingDisplayLimit = false; // 注释掉，保持编辑状态
  }
};

// 取消编辑显示限制
const cancelEditDisplayLimit = (row) => {
  row.editingDisplayLimit = false;
  row.savingDisplayLimit = false;
  row.tempDisplayLimit = row.verificationCodeLimit || 100;
};

// 处理页面点击事件，触发自动保存
const handlePageClick = (event) => {
  // 检查是否点击在空白区域（不是输入框或按钮）
  const target = event.target;
  const isInputArea = target.closest('.el-input-number') ||
                     target.closest('.el-button') ||
                     target.closest('.el-dialog') ||
                     target.closest('.el-select') ||
                     target.closest('.el-date-picker');

  if (!isInputArea) {
    // 查找当前正在编辑的行并保存
    const editingOtpRow = shareList.value.find(row => row.editingLimit);
    if (editingOtpRow) {
      saveOtpLimit(editingOtpRow);
    }

    const editingDisplayRow = shareList.value.find(row => row.editingDisplayLimit);
    if (editingDisplayRow) {
      saveDisplayLimit(editingDisplayRow);
    }
  }
};

// 编辑高级设置
const editAdvancedSettings = (row) => {
  currentEditShare.value = { ...row };
  showAdvancedEditDialog.value = true;
};

// 处理高级设置更新
const handleAdvancedSettingsUpdated = () => {
  loadShareList();
  ElMessage.success('高级设置更新成功');
};

// 开始编辑过期时间
const startEditExpire = (row) => {
  row.editingExpire = true;
  row.tempExpireTime = row.expireTime;
};

// 保存过期时间
const saveExpireTime = async (row) => {
  if (!row.tempExpireTime) {
    ElMessage.warning('过期时间不能为空');
    return;
  }

  if (row.tempExpireTime === row.expireTime) {
    cancelEditExpire(row);
    return;
  }

  // 验证过期时间必须在未来
  const expireDate = new Date(row.tempExpireTime);
  if (expireDate <= new Date()) {
    ElMessage.warning('过期时间必须在未来');
    return;
  }

  try {
    await updateShareExpireTime(row.shareId, row.tempExpireTime);
    row.expireTime = row.tempExpireTime;
    row.editingExpire = false;
    ElMessage.success('过期时间更新成功');
  } catch (error) {
    console.error('Update share expire time error:', error);
    ElMessage.error('更新过期时间失败');
  }
};

// 取消编辑过期时间
const cancelEditExpire = (row) => {
  row.editingExpire = false;
  row.tempExpireTime = row.expireTime;
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

.share-url-container {
  flex: 1;
  overflow: hidden;
}

.share-url-link {
  color: #409eff;
  text-decoration: none;
  font-size: 13px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.share-url-link:hover {
  background-color: #ecf5ff;
  text-decoration: underline;
}

.share-url-input {
  flex: 1;
}

.copy-btn {
  flex-shrink: 0;
}

/* 内联编辑样式 */
.editable-cell {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
  display: inline-block;
  min-width: 100px;
}

.editable-cell:hover {
  background-color: var(--el-fill-color-light);
}

.editable-cell .edit-icon {
  opacity: 0;
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
  transition: opacity 0.2s;
}

.editable-cell:hover .edit-icon {
  opacity: 1;
}

.editable-limit {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: all 0.2s;
  position: relative;
  display: inline-block;
}

.editable-limit:hover {
  background-color: var(--el-fill-color-light);
}

.editable-limit .edit-icon-small {
  opacity: 0;
  margin-left: 4px;
  font-size: 10px;
  color: var(--el-color-primary);
  transition: opacity 0.2s;
}

.editable-limit:hover .edit-icon-small {
  opacity: 1;
}

.limit-disabled {
  text-align: center;
}

.otp-count-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* 内联编辑优化样式 - 2025 现代设计 */
.inline-edit-container {
  position: relative;
}

.editable-tag {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.editable-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 编辑模式容器 - 垂直布局设计，居中对齐 */
.inline-edit-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  /* 垂直布局，按钮在输入框下方，居中对齐 */
}

.inline-edit-wrapper {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  /* 垂直布局，按钮在输入框下方，居中对齐 */
}

/* 输入框样式 - 简洁设计，通过输入框本身提供视觉反馈 */
.inline-edit-input {
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.inline-edit-input:hover {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1) !important;
}

.inline-edit-input:focus,
.inline-edit-input:focus-within {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15) !important;
}

/* 按钮容器 */
.inline-edit-actions {
  display: flex;
  gap: 6px;
}

.inline-edit-actions-mini {
  display: flex;
  gap: 6px;
  margin-left: 4px;
}

/* 按钮样式 - 简洁扁平化设计 */
.save-btn, .save-btn-mini {
  min-width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.save-btn:hover, .save-btn-mini:hover {
  transform: scale(1.05) !important;
}

.save-btn:active, .save-btn-mini:active {
  transform: scale(0.95) !important;
}

.cancel-btn, .cancel-btn-mini {
  min-width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.cancel-btn:hover, .cancel-btn-mini:hover {
  transform: scale(1.05) !important;
  background-color: var(--el-color-danger-light-9) !important;
  border-color: var(--el-color-danger-light-5) !important;
}

.cancel-btn:active, .cancel-btn-mini:active {
  transform: scale(0.95) !important;
}

/* 输入框下方的按钮容器 - 横向布局，居中对齐 */
.inline-edit-actions-below {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

/* 输入框下方的操作按钮 - 统一样式 */
.action-btn-below {
  min-width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.action-btn-below:hover {
  transform: scale(1.05) !important;
}

.action-btn-below:active {
  transform: scale(0.95) !important;
}

/* 旧样式保留（向后兼容） */
.cancel-btn-below {
  height: 24px !important;
  padding: 0 8px !important;
  font-size: 12px !important;
  color: var(--el-text-color-secondary) !important;
  border: none !important;
  background: transparent !important;
  transition: all 0.2s ease !important;
}

.cancel-btn-below:hover {
  color: var(--el-color-danger) !important;
  background-color: var(--el-color-danger-light-9) !important;
}

.cancel-btn-below:active {
  transform: scale(0.95) !important;
}

/* 加载状态样式 */
.inline-edit-input.is-loading {
  opacity: 0.7;
  cursor: wait;
}

/* 错误状态样式 */
.inline-edit-error {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 4px rgba(245, 108, 108, 0.2) !important;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
</style>
