<template>
  <div class="share-page">
    <!-- 简化的页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>📨 验证码邮件分享</h2>
        <div class="config-info" v-if="monitorConfig">
          <span class="email-address">{{ monitorConfig.emailAddress }}</span>
          <el-tag size="small" type="info">{{ getAliasTypeText(monitorConfig.aliasType) }}</el-tag>
        </div>
      </div>
      <div class="header-right">
        <LayoutModeSelector />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div v-loading="true" element-loading-text="加载中...">
        <div style="height: 200px;"></div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <div class="error-content">
        <el-icon class="error-icon" size="48">
          <Warning />
        </el-icon>
        <h2>访问失败</h2>
        <p class="error-message">{{ error }}</p>
        <div class="error-actions">
          <el-button type="primary" @click="retry">
            <Icon icon="material-symbols:refresh" />
            重试
          </el-button>
          <el-button @click="goHome">
            <Icon icon="material-symbols:home" />
            返回首页
          </el-button>
          <el-button @click="copyCurrentUrl" v-if="shareToken">
            <Icon icon="material-symbols:content-copy" />
            复制链接
          </el-button>
        </div>
      </div>
    </div>

    <!-- 邮件列表 - 直接复用全部邮件页面的实现 -->
    <div v-else class="emails-container">
      <SplitPaneLayout class="split-container">
        <!-- 邮件列表 -->
        <template #list>
          <emailScroll
            ref="scroll"
            :getEmailList="getEmailList"
            :time-sort="0"
            actionLeft="4px"
            @jump="handleEmailSelect"
          />
        </template>

        <!-- 邮件详情 -->
        <template #detail>
          <EmailDetailPane v-if="emailStore.splitLayout?.showDetailPane" />
        </template>
      </SplitPaneLayout>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useEmailStore } from "@/store/email.js"
import { getShareInfo, getShareEmails } from '@/request/share.js'
import emailScroll from "@/components/email-scroll/index.vue"
import SplitPaneLayout from '@/components/SplitPaneLayout.vue'
import LayoutModeSelector from '@/components/LayoutModeSelector.vue'
import EmailDetailPane from '@/components/EmailDetailPane.vue'
import router from "@/router/index.js"

// 路由参数
const route = useRoute()
const shareToken = route.params.token

// 邮件状态管理
const emailStore = useEmailStore()

// 响应式数据
const loading = ref(true)
const error = ref('')
const monitorConfig = ref(null)
const scroll = ref({})

// 获取别名类型文本
const getAliasTypeText = (aliasType) => {
  const typeMap = {
    'exact': '精确匹配',
    'prefix': '前缀匹配',
    'suffix': '后缀匹配',
    'wildcard': '通配符匹配'
  }
  return typeMap[aliasType] || '未知类型'
}

// 处理邮件选择
const handleEmailSelect = (email) => {
  const { splitLayout } = emailStore

  if (splitLayout.mode === 'none' || (typeof window !== 'undefined' && window.innerWidth < 1025)) {
    // 无分屏模式或移动端，保持原有路由跳转
    jumpContent(email)
  } else {
    // 分屏模式下选择邮件
    emailStore.selectEmail(email)
  }
}

// 原有的跳转逻辑
const jumpContent = (email) => {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

// 获取邮件列表（适配emailScroll组件）
const getEmailList = (emailId, size) => {
  return getShareEmails(shareToken, {
    emailId: emailId || 0,
    size: size || 20
  }).then(response => {
    // 修复：返回emailScroll组件期望的数据格式
    return {
      list: response.emails || [],
      total: response.total || 0,
      latestEmail: response.emails && response.emails.length > 0 ? response.emails[0] : null
    }
  })
}



// 获取友好的错误提示信息
const getFriendlyErrorMessage = (err) => {
  const status = err.status || err.code
  const message = err.message || ''
  
  // 根据不同错误类型提供友好提示
  if (status === 404 || message.includes('不存在')) {
    return '分享链接无效，请检查链接是否正确或联系分享者获取新链接'
  } else if (status === 410 || message.includes('过期')) {
    return '此分享链接已过期，请联系分享者获取新链接'
  } else if (status === 429 || message.includes('频繁') || message.includes('超限')) {
    return '访问过于频繁，请稍后再试'
  } else if (status === 403 || message.includes('权限') || message.includes('白名单')) {
    return '访问被拒绝，该邮箱可能不在分享白名单中'
  } else if (!navigator.onLine) {
    return '网络连接失败，请检查网络后重试'
  } else if (status >= 500) {
    return '服务器暂时不可用，请稍后重试'
  } else {
    return message || '加载失败，请检查分享链接是否有效'
  }
}

// 加载分享信息
const loadShareInfo = async () => {
  try {
    const info = await getShareInfo(shareToken)
    monitorConfig.value = info
    loading.value = false
  } catch (err) {
    console.error('加载分享信息失败:', err)
    error.value = getFriendlyErrorMessage(err)
    loading.value = false
  }
}

// 重试加载
const retry = () => {
  error.value = ''
  loading.value = true
  loadShareInfo()
}

// 返回首页
const goHome = () => {
  router.push('/')
}

// 复制当前链接
const copyCurrentUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('链接已复制到剪贴板')
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动复制链接')
  }
}

// 初始化
onMounted(async () => {
  emailStore.emailScroll = scroll
  // 从 localStorage 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage()
  await loadShareInfo()
})

// 清理资源
onUnmounted(() => {
  // 清理资源
})
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
}

.page-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 24px 20px;
  position: relative;
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 95vw;
  margin: 0 auto;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-left h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.config-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.email-address {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
}

.loading-container,
.error-container {
  max-width: 95vw;
  margin: 40px auto;
  padding: 0 20px;
  text-align: center;
}

.error-content {
  background: white;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.error-icon {
  color: #f56c6c;
  margin-bottom: 16px;
}

.emails-container {
  max-width: 95vw;
  margin: 20px auto;
  padding: 0 20px;
  height: calc(100vh - 200px);
  min-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.split-container {
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    padding: 16px;
  }
  
  .emails-container {
    max-width: none;
    margin: 0;
    padding: 0;
    height: calc(100vh - 140px);
    min-height: 500px;
  }
  
  .split-container {
    border-radius: 0;
    box-shadow: none;
  }
}

/* PC端大屏幕优化 */
@media (min-width: 1400px) {
  .page-header {
    max-width: 98vw;
    padding: 24px 1vw;
  }
  
  .emails-container {
    max-width: 98vw;
    padding: 0 1vw;
  }
}

@media (min-width: 1920px) {
  .page-header {
    max-width: 99vw;
    padding: 24px 0.5vw;
  }
  
  .emails-container {
    max-width: 99vw;
    padding: 0 0.5vw;
  }
}

/* 错误页面样式 */
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.error-content {
  text-align: center;
  max-width: 500px;
}

.error-icon {
  color: #f56c6c;
  margin-bottom: 20px;
}

.error-content h2 {
  color: #303133;
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: 500;
}

.error-message {
  color: #606266;
  margin-bottom: 24px;
  font-size: 16px;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.error-actions .el-button {
  min-width: 100px;
}
</style>