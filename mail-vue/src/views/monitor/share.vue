<template>
  <div class="share-page">
    <!-- 简化的页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h2>📨 验证码邮件分享</h2>
        <div class="config-info" v-if="monitorConfig">
          <span class="email-address">{{ monitorConfig.emailAddress }}</span>
          <el-tag size="small" type="info">{{ getShareTypeText(shareInfo?.shareType) }}</el-tag>
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

    <!-- 人机验证提示 -->
    <div v-if="captchaRequired" class="captcha-container">
      <div class="captcha-box">
        <Icon icon="material-symbols:verified-user" class="captcha-icon" />
        <div class="captcha-content">
          <h3>安全验证</h3>
          <p>为了保护您的账户安全，请完成人机验证</p>
          <div class="turnstile-widget">
            <div id="cf-turnstile"></div>
          </div>
          <el-button
            type="primary"
            @click="handleCaptchaVerify"
            :loading="captchaVerifying"
            :disabled="!captchaToken"
          >
            验证并继续
          </el-button>
        </div>
      </div>
    </div>

    <!-- 频率限制错误提示 -->
    <div v-else-if="rateLimitError" class="rate-limit-error-container">
      <div class="rate-limit-error">
        <Icon icon="material-symbols:schedule" class="error-icon" />
        <div class="error-content">
          <h3>访问过于频繁</h3>
          <p>{{ rateLimitError }}</p>
          <p class="retry-countdown" v-if="rateLimitRetryAfter > 0">
            将在 <strong>{{ rateLimitRetryAfter }}</strong> 秒后自动重试...
          </p>
        </div>
      </div>
    </div>

    <!-- 🔒 安全策略：移除错误状态渲染 -->
    <!-- 禁用/无效的分享链接不应该渲染任何内容，后端会直接返回404 -->
    <div v-else-if="error" style="display: none;">
      <!-- 此区域已禁用渲染，防止域名信息泄露 -->
    </div>

    <!-- 邮件列表 - 直接复用全部邮件页面的实现 -->
    <div v-if="!loading && !captchaRequired && !rateLimitError && !error" class="emails-container">
      <!-- 公告按钮（顶部 - 在邮件列表之前显示） -->
      <div v-if="shareInfo?.announcementContent" class="announcement-button-container">
        <el-button
          type="primary"
          text
          @click="showAnnouncementDialog = true"
          class="announcement-button"
        >
          <Icon icon="material-symbols:info" />
          查看公告
        </el-button>
      </div>
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
            v-if="shareInfo"
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

    <!-- 公告弹窗（支持图片轮播） -->
    <el-dialog
      v-model="showAnnouncementDialog"
      :title="parsedAnnouncement?.title || '公告'"
      width="600px"
      :close-on-click-modal="false"
      @close="handleAnnouncementClose"
      class="announcement-dialog"
    >
      <div class="announcement-content">
        <!-- 图片轮播 -->
        <div v-if="parsedAnnouncement?.images && parsedAnnouncement.images.length > 0" class="images-carousel">
          <el-carousel :autoplay="false" class="carousel" @change="currentImageIndex = $event">
            <el-carousel-item v-for="(image, index) in parsedAnnouncement.images" :key="index">
              <div class="carousel-item">
                <img
                  :src="image.base64"
                  :alt="`Image ${index + 1}`"
                  @click="viewImageFullscreen(index)"
                  title="点击查看全屏"
                />
                <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
              </div>
            </el-carousel-item>
          </el-carousel>
          <div class="carousel-info">
            {{ currentImageIndex + 1 }} / {{ parsedAnnouncement.images.length }}
          </div>
        </div>

        <!-- 文本内容 -->
        <div v-if="parsedAnnouncement?.content" class="announcement-text" @click="handleAnnouncementLinkClick">
          <div v-html="renderAnnouncementContent(parsedAnnouncement.content)" />
        </div>

        <!-- 纯文本公告（向后兼容） -->
        <div v-if="!parsedAnnouncement && shareInfo?.announcementContent" class="announcement-text">
          {{ shareInfo.announcementContent }}
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleAnnouncementClose">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 图片全屏查看器 -->
    <el-image-viewer
      v-if="showImageViewer && parsedAnnouncement?.images"
      :url-list="parsedAnnouncement.images.map(img => img.base64)"
      :initial-index="currentImageIndex"
      @close="showImageViewer = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useEmailStore } from "@/store/email.js"
import { useSettingStore } from "@/store/setting.js"
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

// 系统设置管理
const settingStore = useSettingStore()

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

// 新增：人机验证相关状态
const captchaRequired = ref(false)
const captchaToken = ref('')
const captchaVerifying = ref(false)

// 按钮冷却机制
const cooldownTime = ref(0)
const isCooldown = computed(() => cooldownTime.value > 0)
let cooldownTimer = null

// 频率限制状态
const rateLimitError = ref(null)
const rateLimitRetryAfter = ref(0)
let rateLimitRetryTimer = null

// SpacePreview功能
const {
  hoveredEmail,
  previewVisible,
  previewEmail,
  openPreview,
  closePreview
} = useSpacePreview()

// 公告弹窗相关状态
const showAnnouncementDialog = ref(false)
const announcementShown = ref(false) // 标记是否已显示过公告
const announcementVersionInfo = ref(null) // 存储公告版本信息 {version, shownAt}
const parsedAnnouncement = ref(null) // 解析后的公告数据
const currentImageIndex = ref(0) // 当前图片索引
const showImageViewer = ref(false) // 图片全屏查看器显示状态

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

// Fix P2-50: 获取分享类型文本
const getShareTypeText = (shareType) => {
  const typeMap = {
    1: '单邮箱分享',
    2: '邮箱输入分享'
  }
  return typeMap[shareType] || '未知类型'
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

    // 清除频率限制错误
    rateLimitError.value = null
    rateLimitRetryAfter.value = 0

    // 显示公告弹窗（支持版本控制和展示次数控制）
    if (info.announcementContent) {
      // 解析公告内容以获取 displayMode
      parseAnnouncementContent(info.announcementContent)
      const displayMode = parsedAnnouncement.value?.displayMode || 'always'

      const announcementKey = `announcement_version_${shareToken}`
      const viewedKey = `announcement_viewed_${shareToken}`
      let shouldShowAnnouncement = false

      if (displayMode === 'always') {
        // 每次访问都显示模式：直接显示，不检查localStorage
        shouldShowAnnouncement = true
      } else if (displayMode === 'once') {
        // 仅显示一次模式：检查是否已显示过
        const viewedInfo = localStorage.getItem(viewedKey)
        shouldShowAnnouncement = !viewedInfo
      } else {
        // 默认行为：每次显示
        shouldShowAnnouncement = true
      }

      if (shouldShowAnnouncement) {
        nextTick(() => {
          showAnnouncementDialog.value = true
          announcementShown.value = true
          currentImageIndex.value = 0
        })
      }
    } else if (!info.announcementContent) {
      // 如果公告内容为空，清除localStorage中的记录
      const viewedKey = `announcement_viewed_${shareToken}`
      localStorage.removeItem(viewedKey)
    }

    loading.value = false
  } catch (err) {
    console.error('加载分享信息失败:', err)

    // 处理 HTTP 403 需要人机验证错误
    if ((err.status === 403 || err.code === 403) && err.headers?.['x-captcha-required'] === 'true') {
      console.log('检测到需要人机验证')
      captchaRequired.value = true
      loading.value = false

      // 加载Turnstile脚本
      nextTick(() => {
        loadTurnstileScript()
      })
      return
    }

    // 处理 HTTP 429 频率限制错误
    if (err.status === 429 || err.code === 429) {
      const retryAfter = err.retryAfter || 60
      rateLimitError.value = `访问过于频繁，请在 ${retryAfter} 秒后重试`
      rateLimitRetryAfter.value = retryAfter

      // 启动倒计时
      if (rateLimitRetryTimer) clearInterval(rateLimitRetryTimer)
      rateLimitRetryTimer = setInterval(() => {
        rateLimitRetryAfter.value--
        if (rateLimitRetryAfter.value <= 0) {
          clearInterval(rateLimitRetryTimer)
          // 自动重试
          loadShareInfo()
        }
      }, 1000)

      loading.value = false
      return
    }

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
            // Fix P1-49: 检查scroll.value是否有addItem方法，防止emailScroll组件未渲染时出错
            if (scroll.value && typeof scroll.value.addItem === 'function') {
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
            } else {
              console.warn('emailScroll组件未正确初始化，无法添加新邮件')
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

// 加载Turnstile脚本
const loadTurnstileScript = () => {
  // 从系统设置获取 siteKey，如果不存在则使用环境变量作为备选
  const siteKey = settingStore.settings?.siteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY

  if (!siteKey) {
    ElMessage.error('Turnstile siteKey 未配置，请联系管理员')
    return
  }

  if (window.turnstile) {
    // 脚本已加载，直接渲染
    window.turnstile.render('#cf-turnstile', {
      sitekey: siteKey,
      theme: 'light',
      callback: handleTurnstileCallback,
      'error-callback': handleTurnstileError
    })
  } else {
    // 加载Turnstile脚本
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.turnstile.render('#cf-turnstile', {
        sitekey: siteKey,
        theme: 'light',
        callback: handleTurnstileCallback,
        'error-callback': handleTurnstileError
      })
    }
    document.head.appendChild(script)
  }
}

// Turnstile验证成功回调
const handleTurnstileCallback = (token) => {
  console.log('Turnstile验证成功，token:', token)
  captchaToken.value = token
}

// Turnstile验证失败回调
const handleTurnstileError = () => {
  console.error('Turnstile验证失败')
  ElMessage.error('人机验证失败，请重试')
}

// 处理人机验证
const handleCaptchaVerify = async () => {
  if (!captchaToken.value) {
    ElMessage.error('请先完成人机验证')
    return
  }

  try {
    captchaVerifying.value = true

    // 调用后端验证端点
    const response = await fetch('/api/share/verify-captcha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: captchaToken.value,
        shareToken: shareToken
      })
    })

    if (!response.ok) {
      throw new Error('验证失败')
    }

    const data = await response.json()
    if (data.code === 0 || data.success) {
      ElMessage.success('验证成功，正在加载...')
      captchaRequired.value = false
      captchaToken.value = ''

      // 重新加载分享信息
      await loadShareInfo()
    } else {
      throw new Error(data.message || '验证失败')
    }
  } catch (error) {
    console.error('验证错误:', error)
    ElMessage.error('验证失败: ' + error.message)

    // 重置Turnstile
    if (window.turnstile) {
      window.turnstile.reset()
    }
    captchaToken.value = ''
  } finally {
    captchaVerifying.value = false
  }
}

// 解析公告内容（支持新旧格式）
const parseAnnouncementContent = (content) => {
  parsedAnnouncement.value = null

  if (!content) return

  try {
    // 尝试解析为JSON（新格式）
    if (typeof content === 'string' && content.startsWith('{')) {
      const parsed = JSON.parse(content)
      if (parsed.type === 'rich') {
        parsedAnnouncement.value = {
          title: parsed.title || '',
          content: parsed.content || '',
          images: parsed.images || [],
          displayMode: parsed.displayMode || 'always'
        }
        return
      }
    }
  } catch (error) {
    console.error('解析公告JSON失败:', error)
  }

  // 如果不是JSON格式，当作纯文本处理
  // parsedAnnouncement.value 保持为 null，使用纯文本显示
}

// 处理公告弹窗关闭
const handleAnnouncementClose = () => {
  showAnnouncementDialog.value = false

  // 如果公告设置为"仅显示一次"，记录到 localStorage
  if (parsedAnnouncement.value?.displayMode === 'once') {
    const viewedKey = `announcement_viewed_${shareToken}`
    localStorage.setItem(viewedKey, JSON.stringify({
      viewedAt: new Date().toISOString(),
      version: parsedAnnouncement.value.version || 0
    }))
  }
}

// 渲染公告内容（支持链接识别和标记语法）
const renderAnnouncementContent = (content) => {
  if (!content) return ''

  let html = content
    // 转义 HTML 特殊字符
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // 处理链接标记
  html = html.replace(/\[link\](.*?)\[\/link\]/g, '<a href="$1" target="_blank" style="color: #0066FF; text-decoration: underline; cursor: pointer;" class="announcement-link" data-url="$1">$1</a>')

  // 自动识别 URL 链接（http/https/www）
  html = html.replace(/(?<!<a[^>]*>)(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)(?![^<]*<\/a>)/g, (match) => {
    const url = match.startsWith('www.') ? 'https://' + match : match
    return `<a href="${url}" target="_blank" style="color: #0066FF; text-decoration: underline; cursor: pointer;" class="announcement-link" data-url="${url}">${match}</a>`
  })

  // 处理颜色标记
  html = html.replace(/\[red\](.*?)\[\/red\]/g, '<span style="color: #FF0000;">$1</span>')
  html = html.replace(/\[green\](.*?)\[\/green\]/g, '<span style="color: #00AA00;">$1</span>')
  html = html.replace(/\[blue\](.*?)\[\/blue\]/g, '<span style="color: #0066FF;">$1</span>')
  html = html.replace(/\[yellow\](.*?)\[\/yellow\]/g, '<span style="color: #FFAA00;">$1</span>')

  // 处理高亮标记
  html = html.replace(/\[highlight\](.*?)\[\/highlight\]/g, '<mark style="background-color: #FFFF00; padding: 2px 4px;">$1</mark>')

  // 处理换行
  html = html.replace(/\n/g, '<br>')

  return html
}

// 处理公告链接点击（复制链接）
const handleAnnouncementLinkClick = (event) => {
  const target = event.target
  if (target.classList.contains('announcement-link')) {
    event.preventDefault()
    const url = target.getAttribute('data-url')
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        ElMessage.success('链接已复制到剪贴板')
      }).catch(() => {
        ElMessage.error('复制失败，请手动复制')
      })
    }
  }
}

// 全屏查看图片
const viewImageFullscreen = (index) => {
  currentImageIndex.value = index
  showImageViewer.value = true
}

// 初始化
onMounted(async () => {
  emailStore.emailScroll = scroll
  // 从 localStorage 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage()

  // 检查是否已显示过公告
  const announcementKey = `announcement_shown_${shareToken}`
  if (localStorage.getItem(announcementKey)) {
    announcementShown.value = true
  }

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
  background: #ffffff;
  position: relative;
}

.page-header {
  background: #ffffff;
  backdrop-filter: none;
  border-bottom: 2px solid #ff9800;
  padding: 24px 20px;
  position: relative;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  color: #333333;
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

  /* 公告按钮移动端优化 */
  .announcement-button-container {
    padding: 12px 16px;
    margin-bottom: 16px;

    .announcement-button {
      width: 100%;
      justify-content: center;
      padding: 10px 16px;
      font-size: 15px;
      min-height: 44px;
    }
  }

  /* 公告弹窗移动端优化 */
  .announcement-dialog {
    :deep(.el-dialog) {
      width: 95vw !important;
      max-width: 95vw;
      margin: 0 auto;
    }

    :deep(.el-dialog__body) {
      padding: 16px;
    }
  }

  .announcement-content {
    padding: 12px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;

    .images-carousel {
      margin-bottom: 16px;

      .carousel {
        height: 400px;
        border-radius: 8px;
        overflow: hidden;
        background: #f5f7fa;

        :deep(.el-carousel__container) {
          height: 100%;
        }

        :deep(.el-carousel__item) {
          height: 100%;
        }

        .carousel-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #f5f7fa;
          padding: 20px;

          img {
            max-width: 100%;
            max-height: 350px;
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.3s ease;

            &:hover {
              transform: scale(1.02);
            }
          }

          .image-caption {
            margin-top: 12px;
            font-size: 14px;
            color: #606266;
            text-align: center;
            padding: 0 12px;
            word-break: break-word;
            max-width: 100%;
          }
        }
      }

      .carousel-info {
        font-size: 12px;
        margin-top: 8px;
        text-align: center;
        color: #909399;
      }
    }

    .announcement-text {
      padding: 10px;
      font-size: 14px;
      line-height: 1.5;
    }
  }

  /* 人机验证移动端优化 */
  .captcha-container {
    min-height: calc(100vh - 100px);
    padding: 20px;
  }

  .captcha-box {
    padding: 24px 16px;
    max-width: 100%;
    border-radius: 8px;
  }

  .captcha-icon {
    font-size: 36px;
    margin-bottom: 16px;
  }

  .captcha-content h3 {
    font-size: 18px;
    margin-bottom: 10px;
  }

  .captcha-content p {
    font-size: 13px;
    margin-bottom: 20px;
  }

  /* 频率限制错误移动端优化 */
  .rate-limit-error-container {
    min-height: 300px;
    padding: 16px;
  }

  .rate-limit-error {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    max-width: 100%;

    .error-icon {
      font-size: 36px;
    }

    .error-content {
      h3 {
        font-size: 16px;
      }

      p {
        font-size: 13px;
      }
    }
  }

  /* 邮件验证表单移动端优化 */
  .verification-form {
    flex-direction: column;
    max-width: 100%;

    .email-input {
      width: 100%;
    }

    .el-button {
      width: 100%;
    }
  }

  .verification-error {
    font-size: 13px;
    max-width: 100%;
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

/* 人机验证容器 */
.captcha-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.captcha-box {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  text-align: center;
}

.captcha-icon {
  font-size: 48px;
  color: #409eff;
  margin-bottom: 20px;
}

.captcha-content h3 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 20px;
  font-weight: 600;
}

.captcha-content p {
  margin: 0 0 24px 0;
  color: #606266;
  font-size: 14px;
}

.turnstile-widget {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}

/* 频率限制错误容器 */
.rate-limit-error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 24px;
}

.rate-limit-error {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 32px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-color-warning);
  border-radius: 12px;
  max-width: 500px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

  .error-icon {
    font-size: 48px;
    color: var(--el-color-warning);
    flex-shrink: 0;
  }

  .error-content {
    flex: 1;

    h3 {
      margin: 0 0 8px 0;
      color: var(--el-text-color-primary);
      font-size: 18px;
      font-weight: 600;
    }

    p {
      margin: 0 0 8px 0;
      color: var(--el-text-color-regular);
      font-size: 14px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .retry-countdown {
      color: var(--el-color-warning);
      font-weight: 500;

      strong {
        color: var(--el-color-warning);
        font-size: 16px;
      }
    }
  }
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

/* 公告按钮容器 */
.announcement-button-container {
  padding: 8px 0;
  display: flex;
  justify-content: center;
  margin-bottom: 12px;

  .announcement-button {
    color: #409eff;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    padding: 6px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      color: #66b1ff;
      background-color: #ecf5ff;
    }
  }
}

/* 公告弹窗样式 */
.announcement-dialog {
  :deep(.el-dialog__header) {
    border-bottom: 1px solid #ebeef5;
  }
}

.announcement-content {
  padding: 20px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
  max-height: 600px;
  overflow-y: auto;

  .images-carousel {
    margin-bottom: 20px;

    .carousel {
      border-radius: 8px;
      overflow: hidden;
      background: #f5f7fa;
      height: 400px;

      :deep(.el-carousel__container) {
        height: 100%;
      }

      :deep(.el-carousel__item) {
        height: 100%;
      }

      .carousel-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #f5f7fa;
        padding: 20px;

        img {
          max-width: 100%;
          max-height: 350px;
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 4px;
        }

        .image-caption {
          margin-top: 12px;
          font-size: 14px;
          color: #606266;
          text-align: center;
          padding: 0 12px;
          word-break: break-word;
        }
      }
    }

    .carousel-info {
      text-align: center;
      font-size: 12px;
      color: #909399;
      margin-top: 8px;
    }
  }

  .announcement-text {
    white-space: pre-wrap;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    border-left: 3px solid #409eff;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

/* 公告链接样式 */
.announcement-text :deep(.announcement-link) {
  color: #0066FF;
  text-decoration: underline;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.announcement-text :deep(.announcement-link):hover {
  color: #0052CC;
  text-decoration: underline;
  opacity: 0.8;
}

.announcement-text :deep(.announcement-link):active {
  opacity: 0.6;
}
</style>
