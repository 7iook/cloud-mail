<template>
  <el-dialog
    v-model="visible"
    title="邮件模板管理"
    width="900px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" @click="handleCreate">
          <Icon icon="material-symbols:add" />
          创建模板
        </el-button>
        <el-button @click="loadTemplates">
          <Icon icon="ion:reload" />
          刷新
        </el-button>
        <el-button
          type="success"
          @click="handleInitializePresets"
          :loading="initializing"
        >
          <Icon icon="material-symbols:stars" />
          加载预设模板
        </el-button>
      </div>

      <!-- 批量操作 -->
      <div class="toolbar-right" v-if="selectedTemplates.length > 0">
        <span class="selected-count">已选择 {{ selectedTemplates.length }} 个模板</span>
        <el-button size="small" @click="handleBatchEnable">批量启用</el-button>
        <el-button size="small" @click="handleBatchDisable">批量禁用</el-button>
      </div>
    </div>

    <!-- 模板列表 -->
    <el-table
      :data="templates"
      v-loading="loading"
      stripe
      style="width: 100%; margin-top: 16px;"
      max-height="500px"
      @selection-change="handleSelectionChange"
    >
      <!-- 选择列 -->
      <el-table-column type="selection" width="55" />

      <el-table-column prop="name" label="模板名称" min-width="150">
        <template #default="{ row }">
          <div class="template-name">
            {{ row.name }}
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />

      <el-table-column prop="codeFormat" label="验证码格式" min-width="100" show-overflow-tooltip />

      <!-- 启用状态列 -->
      <el-table-column label="启用状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.isActive === 1"
            @change="handleToggleActive(row)"
            :loading="row._toggling"
          />
        </template>
      </el-table-column>

      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            size="small"
            @click="handleEdit(row)"
            link
          >
            编辑
          </el-button>
          <el-button
            type="danger"
            size="small"
            @click="handleDelete(row)"
            link
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态 -->
    <div v-if="!loading && templates.length === 0" class="empty-state">
      <Icon icon="material-symbols:inbox-outline" width="64" height="64" />
      <p>暂无模板</p>
      <div class="empty-actions">
        <el-button type="primary" @click="handleCreate">创建模板</el-button>
        <el-button type="success" @click="handleInitializePresets" :loading="initializing">
          <Icon icon="material-symbols:stars" />
          加载预设模板
        </el-button>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 模板表单对话框 -->
  <TemplateFormDialog
    v-model="showFormDialog"
    :mode="formMode"
    :template-data="currentTemplate"
    @created="handleTemplateCreated"
    @updated="handleTemplateUpdated"
  />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { getUserTemplates, deleteTemplate, initializePresetTemplates, toggleTemplateActive, batchUpdateTemplateActive } from '@/request/email-template.js';
import TemplateFormDialog from './TemplateFormDialog.vue';
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
const loading = ref(false);
const initializing = ref(false);
const templates = ref([]);
const showFormDialog = ref(false);
const formMode = ref('create'); // 'create' | 'edit'
const currentTemplate = ref(null);
const selectedTemplates = ref([]); // 批量选择的模板

// 监听 modelValue 变化
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    loadTemplates();
  }
});

// 监听 visible 变化
watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
};

// 加载模板列表
const loadTemplates = async () => {
  loading.value = true;
  try {
    const response = await getUserTemplates();
    const result = response.data || response;
    const newTemplates = result.data || result || [];

    console.log('Load templates response:', result);
    console.log('New templates count:', newTemplates.length);

    // 强制更新响应式数据
    templates.value = [...newTemplates];

    console.log('Templates updated:', templates.value.length);
  } catch (error) {
    console.error('Load templates error:', error);
    ElMessage.error('加载模板列表失败');
  } finally {
    loading.value = false;
  }
};

// 初始化预设模板
const handleInitializePresets = async () => {
  initializing.value = true;
  try {
    // axios拦截器已经解包了响应,直接使用result
    const result = await initializePresetTemplates();
    console.log('Initialize presets response:', result);

    if (result && result.success) {
      ElMessage.success(`成功加载 ${result.count} 个预设模板`);
      // 强制刷新模板列表
      await loadTemplates();
      emit('updated'); // 通知父组件刷新模板列表
    } else if (result && result.message) {
      // 已存在模板,显示提示信息
      ElMessage.info(result.message);
      await loadTemplates();
    } else {
      ElMessage.error('加载预设模板失败');
    }
  } catch (error) {
    console.error('Initialize presets error:', error);
    ElMessage.error(error.message || '加载预设模板失败');
  } finally {
    initializing.value = false;
  }
};

// 创建模板
const handleCreate = () => {
  formMode.value = 'create';
  currentTemplate.value = null;
  showFormDialog.value = true;
};

// 编辑模板
const handleEdit = (template) => {
  formMode.value = 'edit';
  currentTemplate.value = { ...template };
  showFormDialog.value = true;
};

// 删除模板
const handleDelete = async (template) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name}" 吗?此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await deleteTemplate(template.id);
    ElMessage.success('模板删除成功');
    loadTemplates();
    emit('updated'); // 通知父组件刷新模板列表
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete template error:', error);
      ElMessage.error(error.message || '删除模板失败');
    }
  }
};

// 切换模板启用状态
const handleToggleActive = async (template) => {
  // 添加临时loading状态
  template._toggling = true;

  try {
    // axios拦截器已经解包了响应,直接使用response
    const result = await toggleTemplateActive(template.id);
    console.log('Toggle result:', result);

    if (result && result.success) {
      // 更新本地状态
      template.isActive = result.isActive;
      ElMessage.success(result.isActive === 1 ? '模板已启用' : '模板已禁用');
      await loadTemplates();
      emit('updated'); // 通知父组件刷新模板列表
    } else {
      console.error('Toggle failed:', result);
      ElMessage.error('切换状态失败');
      // 恢复原状态
      await loadTemplates();
    }
  } catch (error) {
    console.error('Toggle active error:', error);
    ElMessage.error(error.message || '切换状态失败');
    // 恢复原状态
    await loadTemplates();
  } finally {
    template._toggling = false;
  }
};

// 批量选择变化
const handleSelectionChange = (selection) => {
  selectedTemplates.value = selection;
};

// 批量启用
const handleBatchEnable = async () => {
  if (selectedTemplates.value.length === 0) {
    ElMessage.warning('请先选择要启用的模板');
    return;
  }

  try {
    const templateIds = selectedTemplates.value.map(t => t.id);
    console.log('Batch enable IDs:', templateIds);

    // axios拦截器已经解包了响应,直接使用result
    const result = await batchUpdateTemplateActive(templateIds, true);
    console.log('Batch enable result:', result);

    if (result && result.success) {
      ElMessage.success(`成功启用 ${result.count} 个模板`);
      await loadTemplates();
      selectedTemplates.value = [];
      emit('updated');
    } else {
      console.error('Batch enable failed:', result);
      ElMessage.error('批量启用失败');
    }
  } catch (error) {
    console.error('Batch enable error:', error);
    ElMessage.error(error.message || '批量启用失败');
  }
};

// 批量禁用
const handleBatchDisable = async () => {
  if (selectedTemplates.value.length === 0) {
    ElMessage.warning('请先选择要禁用的模板');
    return;
  }

  try {
    const templateIds = selectedTemplates.value.map(t => t.id);
    console.log('Batch disable IDs:', templateIds);

    // axios拦截器已经解包了响应,直接使用result
    const result = await batchUpdateTemplateActive(templateIds, false);
    console.log('Batch disable result:', result);

    if (result && result.success) {
      ElMessage.success(`成功禁用 ${result.count} 个模板`);
      await loadTemplates();
      selectedTemplates.value = [];
      emit('updated');
    } else {
      console.error('Batch disable failed:', result);
      ElMessage.error('批量禁用失败');
    }
  } catch (error) {
    console.error('Batch disable error:', error);
    ElMessage.error(error.message || '批量禁用失败');
  }
};

// 模板创建成功
const handleTemplateCreated = () => {
  loadTemplates();
  emit('updated'); // 通知父组件刷新模板列表
};

// 模板更新成功
const handleTemplateUpdated = () => {
  loadTemplates();
  emit('updated'); // 通知父组件刷新模板列表
};

// 关闭对话框
const handleClose = () => {
  visible.value = false;
};

// 组件挂载时加载模板
onMounted(() => {
  if (visible.value) {
    loadTemplates();
  }
});
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.selected-count {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-right: 8px;
}

.template-name {
  display: flex;
  align-items: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
}

.empty-state svg {
  color: var(--el-text-color-placeholder);
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0 0 16px 0;
  font-size: 14px;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>

