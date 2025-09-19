<template>
  <div class="layout-mode-selector">
    <el-tooltip 
      v-for="mode in layoutModes" 
      :key="mode.value"
      :content="mode.tooltip"
      placement="bottom"
    >
      <el-button
        :type="currentMode === mode.value ? 'primary' : 'default'"
        :icon="mode.icon"
        size="small"
        circle
        @click="handleModeChange(mode.value)"
        :class="{ 'active-mode': currentMode === mode.value }"
      />
    </el-tooltip>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useEmailStore } from '@/store/email'

const emailStore = useEmailStore()

// 布局模式配置
const layoutModes = [
  {
    value: 'none',
    icon: 'View',
    tooltip: '无阅读窗格 - 点击邮件跳转到详情页'
  },
  {
    value: 'right',
    icon: 'Grid',
    tooltip: '右侧阅读窗格 - 邮件列表在左，详情在右'
  },
  {
    value: 'bottom',
    icon: 'Menu',
    tooltip: '底部阅读窗格 - 邮件列表在上，详情在下'
  }
]

// 当前模式
const currentMode = computed(() => emailStore.splitLayout?.mode || 'none')

// 处理模式切换
const handleModeChange = (mode) => {
  // 检查移动端限制
  if (typeof window !== 'undefined' && window.innerWidth < 1025 && mode !== 'none') {
    ElMessage.warning('移动端仅支持无阅读窗格模式')
    return
  }
  
  emailStore.setSplitMode(mode)
  
  // 如果切换到分屏模式且有选中的邮件，显示详情面板
  if (mode !== 'none' && emailStore.splitLayout?.selectedEmail) {
    emailStore.splitLayout.showDetailPane = true
  }
  
  // 保存到 localStorage
  localStorage.setItem('emailSplitLayout', JSON.stringify(emailStore.splitLayout))
  
  ElMessage.success(`已切换到${layoutModes.find(m => m.value === mode)?.tooltip}`)
}
</script>

<style scoped>
.layout-mode-selector {
  display: flex;
  gap: 8px;
  align-items: center;
}

.active-mode {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
}

.el-button + .el-button {
  margin-left: 0;
}

/* 移动端隐藏分屏选项 */
@media (max-width: 1024px) {
  .layout-mode-selector :deep(.el-button:not(:first-child)) {
    display: none;
  }
}
</style>
