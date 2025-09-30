<template>
  <div class="share-container">
    <!-- 选项卡布局 -->
    <el-tabs v-model="activeTab" class="share-tabs">
      <!-- 分享管理选项卡 -->
      <el-tab-pane label="分享管理" name="management">
        <!-- 页面头部 -->
        <div class="share-header">
          <div class="header-actions">
            <el-button type="primary" @click="showCreateDialog = true" v-perm="'share:create'">
              <Icon icon="material-symbols:share" />
              创建分享
            </el-button>
            <el-button @click="refreshList">
              <Icon icon="ion:reload" width="18" height="18" />
              刷新
            </el-button>
          </div>
        </div>

        <!-- 分享列表 -->
        <div class="share-content">
          <el-table :data="shareList" style="width: 100%" v-loading="loading">
            <el-table-column prop="targetEmail" label="目标邮箱" min-width="200" />
            <el-table-column prop="shareName" label="分享名称" min-width="150" />
            <el-table-column prop="createTime" label="创建时间" width="180">
              <template #default="scope">
                {{ tzDayjs(scope.row.createTime).format('YYYY-MM-DD HH:mm') }}
              </template>
            </el-table-column>
            <el-table-column prop="expireTime" label="过期时间" width="180">
              <template #default="scope">
                {{ tzDayjs(scope.row.expireTime).format('YYYY-MM-DD HH:mm') }}
              </template>
            </el-table-column>
            <el-table-column label="分享链接" min-width="300">
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
                    复制
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  @click="viewAccessLogs(scope.row)"
                  v-perm="'share:create'"
                >
                  访问日志
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  @click="handleDeleteShare(scope.row)"
                  v-perm="'share:delete'"
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { tzDayjs } from '@/utils/day.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';
import { getShareList, deleteShare } from '@/request/share.js';
import ShareCreateDialog from '@/components/share/ShareCreateDialog.vue';
import ShareWhitelistDialog from '@/components/share/ShareWhitelistDialog.vue';
import ShareAccessLogs from '@/components/share/ShareAccessLogs.vue';

defineOptions({
  name: 'share'
});

// 响应式数据
const loading = ref(false);
const shareList = ref([]);
const showCreateDialog = ref(false);
const showWhitelistDialog = ref(false);
const activeTab = ref('management');

// 页面加载
onMounted(() => {
  loadShareList();
});

// 加载分享列表
const loadShareList = async () => {
  loading.value = true;
  try {
    console.log('Loading share list...');
    const response = await getShareList({ page: 1, pageSize: 100 });
    console.log('Share list response:', response);

    // 更详细的数据处理
    let list = [];
    if (response.data && response.data.list) {
      list = response.data.list;
    } else if (response.list) {
      list = response.list;
    } else if (Array.isArray(response)) {
      list = response;
    }

    console.log('Processed share list:', list);
    shareList.value = list;
  } catch (error) {
    console.error('Load share list error:', error);
    ElMessage.error(`加载分享列表失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
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

// 查看访问日志
const viewAccessLogs = (shareRecord) => {
  // 切换到访问日志选项卡，并传递分享记录信息
  activeTab.value = 'logs';
  // 可以通过事件或状态管理传递选中的分享记录
  // 这里暂时切换到日志选项卡，具体的日志筛选功能在ShareAccessLogs组件中实现
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
  // 重新加载分享列表以获取最新数据
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

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.share-content {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 20px;
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
