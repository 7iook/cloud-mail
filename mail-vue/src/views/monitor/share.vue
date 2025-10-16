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
        <!-- 自动刷新状态显示 -->
        <div v-if="autoRefreshEnabled" class="auto-refresh-status">
          <div v-if="autoRefreshActive && !autoRefreshPaused" class="refresh-active">
            <Icon icon="material-symbols:refresh" class="rotating" />
            <span>自动刷新中 ({{ autoRefreshInterval }}s)</span>
            <el-button size="small" text @click="pauseAutoRefresh">暂停</el-button>
          </div>
          <div v-else-if="autoRefreshPaused" class="refresh-paused">
            <Icon icon="material-symbols:pause" />
            <span>已暂停</span>
            <el-button size="small" type="primary" @click="resumeAutoRefresh">恢复</el-button>
          </div>
          <div v-if="newEmailsCount > 0" class="new-emails-badge">
            {{ newEmailsCount }} 封新邮件
          </div>
        </div>
        <LayoutModeSelector />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div v-loading="true" element-loading-text="加载中...">
        <div style="height: 200px;"></div>
      </div>
    </div>

    <!-- 🔒 安全策略：移除错误状态渲染 -->
    <!-- 禁用/无效的分享链接不应该渲染任何内容，后端会直接返回404 -->
    <div v-else-if="error" style="display: none;">
      <!-- 此区域已禁用渲染，防止域名信息泄露 -->
    </div>

    <!-- 邮件列表 - 直接复用全部邮件页面的实现 -->
    <div v-else class="emails-container">
      <!-- 白名单验证输入框 (仅类型2分享显示) -->
      <div v-if="shareInfo?.shareType === 2" class="email-verification-section">
        <div class="verification-header">
          <h3>邮箱验证</h3>
          <p>请输入您的邮箱地址以获取最新验证码</p>
        </div>
        <div class="verification-form">
          <el-input
            v-model="verificationEmail"
            placeholder="请输入邮箱地址"
            size="large"
            :disabled="verifying"
            @keyup.enter="handleEmailVerification"
            class="email-input"
          >
            <template #prefix>
              <Icon icon="material-symbols:email" />
            </template>
          </el-input>
          <el-button
            type="primary"
            size="large"
            :loading="verifying"
            @click="handleEmailVerification"
            :disabled="!verificationEmail || (shareInfo?.cooldownEnabled && isCooldown)"
          >
            {{ (shareInfo?.cooldownEnabled && isCooldown) ? `请等待 ${cooldownTime} 秒` : '获取最新验证码' }}
          </el-button>
        </div>
        <div v-if="verificationError" class="verification-error">
          <Icon icon="material-symbols:error" />
          {{ verificationError }}
        </div>
      </div>

      <SplitPaneLayout class="split-container">
        <!-- 邮件列表 -->
        <template #list>
          <emailScroll
            ref="scroll"
            :getEmailList="getEmailList"
            :time-sort="0"
            actionLeft="4px"
            :show-star="false"
            :allow-star="false"
            :allow-delete="false"
            :show-account-icon="false"
            @jump="handleEmailSelect"
          />
        </template>

        <!-- 邮件详情 -->
        <template #detail>
          <EmailDetailPane v-if="emailStore.splitLayout?.showDetailPane" />
        </template>
      </SplitPaneLayout>

      <!-- 空格键预览窗口 -->
      <EmailPreview
        v-model="previewVisible"
        :email="previewEmail"
        @closed="closePreview"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useEmailStore } from "@/store/email.js"
import { getShareInfo, getShareEmails } from '@/request/share.js'
import emailScroll from "@/components/email-scroll/index.vue"
import SplitPaneLayout from '@/components/SplitPaneLayout.vue'
import LayoutModeSelector from '@/components/LayoutModeSelector.vue'
import EmailDetailPane from '@/components/EmailDetailPane.vue'
import EmailPreview from '@/components/email-preview/index.vue'
import { useSpacePreview } from '@/composables/useSpacePreview.js'
import router from "@/router/index.js"

// 路由参数
const route = useRoute()
const shareToken = route.params.token

// 邮件状态管理
const emailStore = useEmailStore()

// 初始化分享页面的分屏布局
onMounted(() => {
  // 确保分享页面使用右侧分屏模式，以便显示邮件详情
  if (!emailStore.splitLayout || emailStore.splitLayout.mode === 'none') {
    emailStore.setSplitMode('right')
  }
})

// 响应式数据
const loading = ref(true)
const error = ref('')
const monitorConfig = ref(null)
const scroll = ref({})
const shareInfo = ref(null)
const verificationEmail = ref('')
const verifying = ref(false)
const verificationError = ref('')
const emailsVerified = ref(false)
// Fix P1-47: 添加已验证邮箱存储，防止清理输入框后无法获取邮件
const verifiedEmail = ref('')

// 新增：自动刷新相关状态
const autoRefreshEnabled = ref(false)
const autoRefreshInterval = ref(30)
const autoRefreshActive = ref(false)
const autoRefreshPaused = ref(false)
const newEmailsCount = ref(0)
let autoRefreshTimer = null

// 按钮冷却机制
const cooldownTime = ref(0)
const isCooldown = computed(() => cooldownTime.value > 0)
let cooldownTimer = null

// SpacePreview功能
const {
  hoveredEmail,
  previewVisible,
  previewEmail,
  openPreview,
  closePreview
} = useSpacePreview()

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

// 处理邮件选择 - 分享页面专用逻辑，不跳转到后台
const handleEmailSelect = (email) => {
  const { splitLayout } = emailStore

  // 检查是否为无窗格模式或移动端
  if (splitLayout.mode === 'none' || (typeof window !== 'undefined' && window.innerWidth < 1025)) {
    // 无窗格模式：触发空格键预览逻辑，显示悬浮窗预览
    openPreview(email)
  } else {
    // 分屏模式：在当前页面内显示邮件详情，不跳转到后台
    emailStore.selectEmail(email)
  }
}



// 获取邮件列表（适配emailScroll组件）
const getEmailList = (emailId, size) => {
  // 类型2分享且未验证邮箱时，返回空列表
  if (shareInfo.value?.shareType === 2 && !emailsVerified.value) {
    return Promise.resolve({
      list: [],
      total: 0,
      latestEmail: null
    })
  }

  // 构建请求参数
  const params = {
    emailId: emailId || 0,
    size: size || 20
  }

  // Fix P1-48: 使用已验证的邮箱而不是输入框中的邮箱
  // 类型2分享需要添加验证邮箱参数
  if (shareInfo.value?.shareType === 2 && verifiedEmail.value) {
    params.userEmail = verifiedEmail.value
  }

  return getShareEmails(shareToken, params).then(response => {
    // 修复：返回emailScroll组件期望的数据格式
    return {
      list: response.emails || [],
      total: response.total || 0,
      latestEmail: response.emails && response.emails.length > 0 ? response.emails[0] : null
    }
  })
}



// 🔒 安全策略：移除友好错误提示函数
// 禁用的分享链接不应该提供任何错误信息，避免域名和系统信息泄露

// 加载分享信息
const loadShareInfo = async () => {
  try {
    const info = await getShareInfo(shareToken)
    shareInfo.value = info
    monitorConfig.value = info

    // 设置自动刷新配置
    autoRefreshEnabled.value = info.autoRefreshEnabled === 1
    autoRefreshInterval.value = info.autoRefreshInterval || 30

    // 如果是类型1分享，直接显示邮件
    if (info.shareType === 1) {
      emailsVerified.value = true

      // 启动自动刷新（如果启用）
      if (autoRefreshEnabled.value) {
        nextTick(() => {
          startAutoRefresh()
        })
      }
    }

    loading.value = false
  } catch (err) {
    console.error('加载分享信息失败:', err)

    // 🔒 安全策略：404错误不渲染任何内容
    // 禁用/无效的分享链接应该由后端直接返回404，前端不应该渲染
    if (err.status === 404 || err.code === 404) {
      // 404错误：直接跳转到浏览器的404页面，不渲染任何自定义内容
      window.location.href = '/404-not-found-page-that-does-not-exist'
      return
    }

    // 其他错误也不渲染，避免信息泄露
    error.value = ''
    loading.value = false

    // 直接跳转到404页面
    window.location.href = '/404-not-found-page-that-does-not-exist'
  }
}

// 监听邮箱输入框变化，清除错误信息
watch(verificationEmail, () => {
  // 当用户修改输入框时，清除之前的错误信息
  if (verificationError.value) {
    verificationError.value = ''
  }
})

// 启动按钮冷却机制
const startCooldown = () => {
  // 检查是否启用冷却功能
  if (!shareInfo.value?.cooldownEnabled) {
    return // 冷却功能已禁用，直接返回
  }

  // 使用配置的冷却时间，默认10秒
  const cooldownSeconds = shareInfo.value?.cooldownSeconds || 10
  cooldownTime.value = cooldownSeconds

  cooldownTimer = setInterval(() => {
    cooldownTime.value--
    if (cooldownTime.value <= 0) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

// 处理邮箱验证
const handleEmailVerification = async () => {
  // Fix P1-33: 严格检查邮箱是否为空或只有空格
  if (!verificationEmail.value || !verificationEmail.value.trim()) {
    verificationError.value = '请输入邮箱地址'
    return
  }

  // Fix P1-16: 前端邮箱格式验证
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(verificationEmail.value.trim())) {
    verificationError.value = '请输入有效的邮箱地址'
    return
  }

  // Fix P1-34: 前端邮箱长度验证
  const MAX_EMAIL_LENGTH = 254; // RFC standard
  if (verificationEmail.value.trim().length > MAX_EMAIL_LENGTH) {
    verificationError.value = `邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`
    return
  }

  verifying.value = true
  verificationError.value = ''

  try {
    // Fix P1-39: 规范化邮箱地址（转换为小写）
    const normalizedEmail = verificationEmail.value.trim().toLowerCase()
    // 使用输入的邮箱调用邮件获取API进行验证
    await getShareEmails(shareToken, { userEmail: normalizedEmail })

    // 验证成功，更新状态
    emailsVerified.value = true
    // Fix P1-47: 保存已验证的邮箱
    verifiedEmail.value = normalizedEmail
    monitorConfig.value.emailAddress = verificationEmail.value

    // 修复时序问题：等待Vue响应式更新完成
    await nextTick()

    // 刷新邮件列表
    if (scroll.value?.refresh) {
      scroll.value.refresh()
    }

    // 启动自动刷新（如果启用）
    if (autoRefreshEnabled.value) {
      nextTick(() => {
        startAutoRefresh()
      })
    }

    // 启动按钮冷却机制
    startCooldown()

    // Fix P1-40: 验证成功后清理输入框
    verificationEmail.value = ''

    ElMessage.success('邮箱验证成功')
  } catch (err) {
    console.error('Email verification failed:', err)
    // Fix P1-46: 改进错误消息显示，提供有用的反馈
    // 根据错误类型提供不同的错误信息
    if (err.message && err.message.includes('不在此分享的授权列表中')) {
      verificationError.value = '该邮箱不在授权列表中'
    } else if (err.message && err.message.includes('邮箱地址无效')) {
      verificationError.value = '邮箱地址无效'
    } else if (err.message && err.message.includes('邮箱地址过长')) {
      verificationError.value = '邮箱地址过长'
    } else if (err.message && err.message.includes('已被删除')) {
      verificationError.value = '邮箱账户已被删除'
    } else {
      verificationError.value = '验证失败，请重试'
    }
  } finally {
    verifying.value = false
  }
}

// 自动刷新功能
const startAutoRefresh = () => {
  if (!shareInfo.value?.autoRefreshEnabled || autoRefreshActive.value) {
    return
  }

  autoRefreshActive.value = true
  autoRefreshPaused.value = false

  const refreshLoop = async () => {
    while (autoRefreshActive.value && !autoRefreshPaused.value) {
      try {
        // 等待刷新间隔
        await new Promise(resolve => {
          autoRefreshTimer = setTimeout(resolve, autoRefreshInterval.value * 1000)
        })

        // 检查是否仍然需要刷新
        if (!autoRefreshActive.value || autoRefreshPaused.value) {
          break
        }

        // 获取最新邮件
        const latestId = scroll.value.latestEmail?.emailId || 0
        const params = {
          emailId: latestId,
          size: 20
        }

        // Fix P1-48: 使用已验证的邮箱而不是输入框中的邮箱
        // 类型2分享需要添加验证邮箱参数
        if (shareInfo.value?.shareType === 2 && verifiedEmail.value) {
          params.userEmail = verifiedEmail.value
        }

        const response = await getShareEmails(shareToken, params)

        if (response.emails && response.emails.length > 0) {
          // 检查是否有新邮件
          const currentLatestId = scroll.value.latestEmail?.emailId || 0
          const hasNewEmails = response.emails.some(email => email.emailId > currentLatestId)

          if (hasNewEmails) {
            // 更新邮件列表
            response.emails.forEach(email => {
              if (email.emailId > currentLatestId) {
                scroll.value.addItem(email)
                newEmailsCount.value++
              }
            })

            // 显示新邮件通知
            if (newEmailsCount.value > 0) {
              ElMessage.success(`收到 ${newEmailsCount.value} 封新邮件`)
              // 3秒后重置计数
              setTimeout(() => {
                newEmailsCount.value = 0
              }, 3000)
            }
          }
        }
      } catch (error) {
        console.error('自动刷新失败:', error)
        // 网络错误时暂停自动刷新
        if (error.message.includes('网络') || error.message.includes('timeout')) {
          pauseAutoRefresh()
          ElMessage.warning('网络连接异常，已暂停自动刷新')
        }
      }
    }
  }

  refreshLoop()
}

const pauseAutoRefresh = () => {
  autoRefreshPaused.value = true
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

const resumeAutoRefresh = () => {
  if (autoRefreshActive.value) {
    autoRefreshPaused.value = false
    startAutoRefresh()
  }
}

const stopAutoRefresh = () => {
  autoRefreshActive.value = false
  autoRefreshPaused.value = false
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

// 🔒 安全策略：移除重试、返回首页、复制链接等功能
// 这些功能会暴露系统信息，禁用的分享链接不应该提供任何交互

// 初始化
onMounted(async () => {
  emailStore.emailScroll = scroll
  // 从 localStorage 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage()
  await loadShareInfo()
})

// 清理资源
onUnmounted(() => {
  // 停止自动刷新
  stopAutoRefresh()

  // 清理冷却定时器
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
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

.email-verification-section {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
}

.verification-header {
  text-align: center;
  margin-bottom: 20px;

  h3 {
    margin: 0 0 8px 0;
    color: var(--el-text-color-primary);
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: var(--el-text-color-regular);
    font-size: 14px;
  }
}

.verification-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto;

  .email-input {
    flex: 1;
  }
}

.verification-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--el-color-error-light-9);
  border: 1px solid var(--el-color-error-light-7);
  border-radius: 4px;
  color: var(--el-color-error);
  font-size: 14px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* 自动刷新状态样式 */
.auto-refresh-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
}

.refresh-active,
.refresh-paused {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.refresh-active {
  color: #67c23a;
}

.refresh-paused {
  color: #e6a23c;
}

.rotating {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.new-emails-badge {
  background: #f56c6c;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  animation: pulse 1s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    opacity: 0.8;
  }
  to {
    opacity: 1;
  }
}
</style>