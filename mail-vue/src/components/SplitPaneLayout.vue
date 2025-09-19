<template>
  <div class="split-pane-container">
    <!-- 分屏模式 -->
    <Splitpanes 
      v-if="splitMode !== 'none'" 
      class="default-theme" 
      :horizontal="splitMode === 'bottom'"
      @resize="handlePaneResize"
    >
      <!-- 邮件列表面板 -->
      <Pane :size="paneSize[0]" min-size="30">
        <div class="email-list-pane">
          <slot name="list" />
        </div>
      </Pane>
      
      <!-- 邮件详情面板 -->
      <Pane :size="paneSize[1]" min-size="30">
        <div class="email-detail-pane">
          <slot name="detail" />
        </div>
      </Pane>
    </Splitpanes>
    
    <!-- 无分屏模式 -->
    <div v-else class="single-pane">
      <slot name="list" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useEmailStore } from '@/store/email'

const emailStore = useEmailStore()

// 计算属性
const splitMode = computed(() => emailStore.splitLayout?.mode || 'none')
const showDetailPane = computed(() => emailStore.splitLayout?.showDetailPane || false)

// 分屏比例
const paneSize = computed(() => {
  const sizes = emailStore.splitLayout?.paneSizes || { right: [40, 60], bottom: [60, 40] }
  return splitMode.value === 'right' ? sizes.right : sizes.bottom
})

// 处理分屏大小调整
const handlePaneResize = (sizes) => {
  if (!emailStore.splitLayout) {
    emailStore.splitLayout = {
      mode: 'none',
      selectedEmail: null,
      showDetailPane: false,
      paneSizes: { right: [40, 60], bottom: [60, 40] }
    }
  }
  
  if (splitMode.value === 'right') {
    emailStore.splitLayout.paneSizes.right = sizes
  } else if (splitMode.value === 'bottom') {
    emailStore.splitLayout.paneSizes.bottom = sizes
  }
  
  // 保存到 localStorage
  localStorage.setItem('emailSplitLayout', JSON.stringify(emailStore.splitLayout))
}

// 监听窗口大小变化，移动端自动切换为无分屏模式
const isMobile = computed(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 1025
  }
  return false
})

watch(isMobile, (mobile) => {
  if (mobile && splitMode.value !== 'none') {
    emailStore.setSplitMode('none')
  }
}, { immediate: true })
</script>

<style scoped>
.split-pane-container {
  height: 100%;
  width: 100%;
}

.single-pane {
  height: 100%;
  width: 100%;
}

.email-list-pane,
.email-detail-pane {
  height: 100%;
  overflow: hidden;
}

/* splitpanes 主题样式 */
:deep(.splitpanes.default-theme .splitpanes__pane) {
  background-color: transparent;
}

:deep(.splitpanes.default-theme .splitpanes__splitter) {
  background-color: #f0f0f0;
  border: none;
  position: relative;
}

:deep(.splitpanes.default-theme .splitpanes__splitter:before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  transition: opacity 0.4s;
  background-color: #409eff;
  opacity: 0;
  z-index: 1;
}

:deep(.splitpanes.default-theme .splitpanes__splitter:hover:before) {
  opacity: 1;
}

/* 水平分屏 */
:deep(.splitpanes.default-theme.splitpanes--vertical > .splitpanes__splitter) {
  width: 4px;
  cursor: col-resize;
}

:deep(.splitpanes.default-theme.splitpanes--vertical > .splitpanes__splitter:before) {
  width: 2px;
  height: 100%;
  left: 1px;
}

/* 垂直分屏 */
:deep(.splitpanes.default-theme.splitpanes--horizontal > .splitpanes__splitter) {
  height: 4px;
  cursor: row-resize;
}

:deep(.splitpanes.default-theme.splitpanes--horizontal > .splitpanes__splitter:before) {
  height: 2px;
  width: 100%;
  top: 1px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .split-pane-container {
    /* 移动端强制单面板模式 */
  }
}
</style>
