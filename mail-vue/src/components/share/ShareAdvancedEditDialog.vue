<template>
  <el-dialog
    v-model="visible"
    title="高级设置"
    width="1000px"
    :before-close="handleClose"
    class="advanced-settings-dialog"
  >
    <el-tabs tab-position="left" style="height: 600px;" class="advanced-tabs">
      <!-- 基础设置标签页 -->
      <el-tab-pane label="基础设置">
        <el-form :model="formData" :rules="rules" label-width="120px">
          <el-form-item label="分享名称" prop="shareName">
            <el-input v-model="formData.shareName" placeholder="请输入分享名称" />
          </el-form-item>

          <el-form-item label="过期时间">
            <el-date-picker
              v-model="formData.expireTime"
              type="datetime"
              placeholder="选择过期时间"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
            />
          </el-form-item>

          <el-divider />

          <el-form-item label="分享类型">
            <el-radio-group v-model="formData.shareType">
              <el-radio :label="1">单个邮箱</el-radio>
              <el-radio :label="2">邮箱验证</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="formData.shareType === 2" label="授权邮箱">
            <div class="authorized-emails-container">
              <div class="email-input-group">
                <el-input
                  v-model="newAuthorizedEmail"
                  placeholder="输入邮箱地址"
                  @keyup.enter="addAuthorizedEmail"
                />
                <el-button type="primary" @click="addAuthorizedEmail">添加</el-button>
              </div>

              <div v-if="formData.authorizedEmails.length > 0" class="email-list">
                <el-tag
                  v-for="(email, index) in formData.authorizedEmails"
                  :key="index"
                  closable
                  @close="removeAuthorizedEmail(index)"
                >
                  {{ email }}
                </el-tag>
              </div>
              <div v-else class="form-tip">暂无授权邮箱</div>
            </div>
          </el-form-item>

          <el-divider />

          <el-form-item label="分享域名">
            <el-select v-model="formData.shareDomain" placeholder="选择分享域名">
              <el-option label="使用默认域名" :value="''" />
              <el-option
                v-for="domain in availableDomains"
                :key="domain"
                :label="domain"
                :value="domain"
              />
            </el-select>
            <div class="form-tip">选择此分享链接使用的域名</div>
          </el-form-item>

          <el-form-item label="分享链接">
            <div class="share-url-display">
              <el-input v-model="formData.shareUrl" readonly />
              <el-button type="primary" @click="copyShareUrl">复制链接</el-button>
            </div>
          </el-form-item>

          <el-form-item label="刷新 Token">
            <el-button type="warning" @click="handleRefreshToken">刷新 Token</el-button>
            <div class="form-tip">刷新后旧链接将失效，请谨慎操作</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 访问控制标签页 -->
      <el-tab-pane label="访问控制">
        <el-form :model="formData" label-width="120px">
          <el-form-item label="每日访问限额">
            <el-input-number
              v-model="formData.otpLimitDaily"
              :min="1"
              :max="10000"
              placeholder="请输入每日访问限额"
            />
          </el-form-item>

          <el-form-item label="启用每日限额">
            <el-switch v-model="formData.otpLimitEnabled" />
          </el-form-item>

          <el-divider />

          <el-form-item label="启用频率限制">
            <el-switch v-model="formData.rateLimitEnabled" />
          </el-form-item>

          <el-form-item v-if="formData.rateLimitEnabled" label="每秒限制">
            <el-input-number
              v-model="formData.rateLimitPerSecond"
              :min="0"
              :max="100"
              placeholder="请输入每秒限制数"
            />
            <div class="form-tip">0 表示禁用频率限制</div>
          </el-form-item>

          <el-form-item v-if="formData.rateLimitEnabled" label="自动恢复时间">
            <el-input-number
              v-model="formData.autoRecoverySeconds"
              :min="0"
              :max="3600"
              placeholder="请输入自动恢复时间（秒）"
            />
            <div class="form-tip">0 表示禁用自动恢复</div>
          </el-form-item>

          <el-divider />

          <el-form-item label="启用冷却">
            <el-switch v-model="formData.cooldownEnabled" />
            <div class="form-tip">启用后，用户访问后需要等待一段时间才能再次访问</div>
          </el-form-item>

          <el-form-item v-if="formData.cooldownEnabled" label="冷却时间（秒）" prop="cooldownSeconds">
            <el-input-number
              v-model="formData.cooldownSeconds"
              :min="1"
              :max="300"
              placeholder="请输入冷却时间"
            />
          </el-form-item>

          <el-divider />

          <el-form-item label="启用人机验证">
            <el-switch v-model="formData.enableCaptcha" />
            <div class="form-tip">启用后，用户需要完成人机验证才能访问</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 邮件显示标签页 -->
      <el-tab-pane label="邮件显示">
        <el-form :model="formData" label-width="120px">
          <el-form-item label="过滤模式">
            <el-radio-group v-model="formData.filterMode">
              <el-radio :label="1">关键词过滤</el-radio>
              <el-radio :label="2">模板匹配</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="formData.filterMode === 1" label="过滤关键词">
            <el-input
              v-model="formData.keywordFilter"
              type="textarea"
              placeholder="请输入过滤关键词，多个关键词用 | 分隔"
              rows="3"
            />
            <div class="form-tip">例如：验证码|verification|code|otp</div>
          </el-form-item>

          <el-form-item v-if="formData.filterMode === 2" label="选择模板">
            <el-select v-model="formData.templateId" placeholder="请选择模板">
              <el-option
                v-for="template in availableTemplates"
                :key="template.templateId"
                :label="template.templateName"
                :value="template.templateId"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="显示完整邮件">
            <el-switch v-model="formData.showFullEmail" />
            <div class="form-tip">关闭时只显示提取的验证码</div>
          </el-form-item>

          <el-form-item label="验证码显示限制">
            <el-input-number
              v-model="formData.verificationCodeLimit"
              :min="1"
              :max="1000"
              placeholder="请输入显示数量限制"
            />
          </el-form-item>

          <el-form-item label="启用显示限制">
            <el-switch v-model="formData.verificationCodeLimitEnabled" />
          </el-form-item>

          <el-divider />

          <el-form-item label="最新邮件数">
            <el-input-number
              v-model="formData.latestEmailCount"
              :min="1"
              :max="1000"
              placeholder="不限制"
            />
            <div class="form-tip">为空表示不限制，显示所有匹配的邮件</div>
          </el-form-item>

          <el-form-item label="启用自动刷新">
            <el-switch v-model="formData.autoRefreshEnabled" />
          </el-form-item>

          <el-form-item v-if="formData.autoRefreshEnabled" label="刷新间隔（秒）">
            <el-input-number
              v-model="formData.autoRefreshInterval"
              :min="5"
              :max="300"
              @change="handleAutoRefreshIntervalChange"
            />
          </el-form-item>

          <el-divider />

          <el-form-item label="展示次数">
            <el-radio-group v-model="announcementData.displayMode">
              <el-radio label="always">每次访问都显示</el-radio>
              <el-radio label="once">仅显示一次</el-radio>
            </el-radio-group>
            <div class="form-tip">选择"仅显示一次"时，用户关闭公告后不会再看到</div>
          </el-form-item>

          <el-form-item label="公告标题">
            <el-input
              v-model="announcementData.title"
              placeholder="请输入公告标题（可选）"
              maxlength="100"
            />
          </el-form-item>

          <el-form-item label="公告内容">
            <el-input
              v-model="announcementData.content"
              type="textarea"
              placeholder="请输入公告内容或粘贴图片"
              rows="3"
              maxlength="1000"
              @paste="handlePaste"
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
    </template>

    <!-- 公告预览抽屉 -->
    <el-drawer
      v-model="showAnnouncementPreview"
      title="公告预览"
      direction="rtl"
      size="50%"
    >
      <div class="announcement-preview">
        <!-- 公告标题 -->
        <div v-if="announcementData.title" class="preview-title">
          {{ announcementData.title }}
        </div>

        <!-- 图片轮播 -->
        <div v-if="announcementData.images && announcementData.images.length > 0" class="preview-carousel">
          <el-carousel :autoplay="false">
            <el-carousel-item
              v-for="(image, index) in announcementData.images"
              :key="index"
            >
              <img :src="image.base64" :alt="`Image ${index + 1}`" class="carousel-image" />
              <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
            </el-carousel-item>
          </el-carousel>
        </div>

        <!-- 公告内容 -->
        <div v-if="announcementData.content" class="preview-content">
          {{ announcementData.content }}
        </div>

        <!-- 空状态提示 -->
        <div v-if="!announcementData.title && !announcementData.content && (!announcementData.images || announcementData.images.length === 0)" class="preview-empty">
          <el-empty description="暂无公告内容" />
        </div>
      </div>
    </el-drawer>

  </el-dialog>

</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, Refresh, UploadFilled, ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue'
import {
  updateShareName,
  updateShareExpireTime,
  updateShareLimit,
  updateShareAdvancedSettings,
  refreshShareToken
} from '@/request/share.js'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  shareData: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// 显示状态
const visible = ref(false)
const saving = ref(false)

// 可用域名列表
const availableDomains = ref([])

// 模板相关
const availableTemplates = ref([])

// 表单数据
const formData = reactive({
  shareId: '',
  shareName: '',
  expireTime: '',
  otpLimitDaily: 100,
  otpLimitEnabled: true,
  rateLimitEnabled: true,
  rateLimitPerSecond: 5,
  autoRecoverySeconds: 60,
  keywordFilter: '',
  verificationCodeLimit: 100,
  verificationCodeLimitEnabled: true,
  latestEmailCount: null,
  autoRefreshEnabled: false,
  autoRefreshInterval: 30,
  cooldownEnabled: true,
  cooldownSeconds: 10,
  enableCaptcha: false,
  announcementContent: '',
  shareToken: '',
  shareUrl: '',
  shareType: 1,
  authorizedEmails: [],
  filterMode: 1,
  templateId: '',
  showFullEmail: true,
  shareDomain: ''
})

// 需求 4：新增授权邮箱输入框
const newAuthorizedEmail = ref('')

// 公告数据（支持图片）
const announcementData = reactive({
  title: '',
  content: '',
  images: [],
  displayMode: 'always' // 展示次数：'always' 每次显示，'once' 仅显示一次
})

// 公告预览相关
const showAnnouncementPreview = ref(false)
const previewImageIndex = ref(0)

// 文件输入引用
const fileInput = ref(null)

// 表单验证规则
const rules = {
  shareName: [
    { required: true, message: '请输入分享名称', trigger: 'blur' },
    { min: 1, max: 50, message: '分享名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  otpLimitDaily: [
    { required: true, message: '请输入每日限额', trigger: 'blur' },
    { type: 'number', min: 1, max: 10000, message: '每日限额必须在 1 到 10000 之间', trigger: 'blur' }
  ],
  cooldownSeconds: [
    { type: 'number', min: 1, max: 300, message: '冷却时间必须在 1-300 秒之间', trigger: 'blur' }
  ]
}

// 监听显示状态
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal && props.shareData) {
    loadFormData()
  }
})

// 监听 shareData 变化（修复数据持久化问题）
watch(() => props.shareData, (newVal) => {
  if (visible.value && newVal) {
    loadFormData()
  }
}, { deep: true })

// 加载表单数据
const loadFormData = () => {
  // 解析授权邮箱
  let authorizedEmails = []
  if (props.shareData.authorizedEmails) {
    try {
      const parsed = typeof props.shareData.authorizedEmails === 'string'
        ? JSON.parse(props.shareData.authorizedEmails)
        : props.shareData.authorizedEmails
      authorizedEmails = Array.isArray(parsed) ? parsed : []
    } catch (error) {
      // 解析失败，使用空数组
    }
  }

  // 填充表单数据
  Object.assign(formData, {
    shareId: props.shareData.shareId,
    shareName: props.shareData.shareName || '',
    expireTime: props.shareData.expireTime || '',
    otpLimitDaily: props.shareData.otpLimitDaily || 100,
    otpLimitEnabled: props.shareData.otpLimitEnabled !== undefined ? props.shareData.otpLimitEnabled === 1 : true,
    rateLimitEnabled: props.shareData.rateLimitPerSecond !== 0,
    rateLimitPerSecond: props.shareData.rateLimitPerSecond || 5,
    autoRecoverySeconds: props.shareData.autoRecoverySeconds || 60,
    keywordFilter: props.shareData.keywordFilter || '',
    verificationCodeLimit: props.shareData.verificationCodeLimit || 100,
    verificationCodeLimitEnabled: props.shareData.verificationCodeLimitEnabled !== undefined ? props.shareData.verificationCodeLimitEnabled === 1 : true,
    latestEmailCount: props.shareData.latestEmailCount || null,
    autoRefreshEnabled: props.shareData.autoRefreshEnabled === 1,
    autoRefreshInterval: props.shareData.autoRefreshInterval || 30,
    cooldownEnabled: props.shareData.cooldownEnabled !== undefined ? props.shareData.cooldownEnabled === 1 : true,
    cooldownSeconds: props.shareData.cooldownSeconds || 10,
    enableCaptcha: props.shareData.enableCaptcha !== undefined ? props.shareData.enableCaptcha === 1 : false,
    announcementContent: props.shareData.announcementContent || '',
    shareToken: props.shareData.shareToken || '',
    shareUrl: props.shareData.shareUrl || '',
    shareType: props.shareData.shareType || 1,
    authorizedEmails: authorizedEmails,
    filterMode: props.shareData.filterMode || 1,
    templateId: props.shareData.templateId || '',
    showFullEmail: props.shareData.showFullEmail !== undefined ? props.shareData.showFullEmail === 1 : true,
    shareDomain: props.shareData.shareDomain || ''
  })

  // 清空新邮箱输入框
  newAuthorizedEmail.value = ''

  // 解析公告数据
  parseAnnouncementContent(props.shareData.announcementContent)
}

// 解析公告内容（支持新旧格式）
const parseAnnouncementContent = (content) => {
  announcementData.title = ''
  announcementData.content = ''
  announcementData.images = []

  if (!content) return

  try {
    // 尝试解析为JSON（新格式）
    if (typeof content === 'string' && content.startsWith('{')) {
      const parsed = JSON.parse(content)
      if (parsed.type === 'rich') {
        announcementData.title = parsed.title || ''
        announcementData.content = parsed.content || ''
        announcementData.images = parsed.images || []
        announcementData.displayMode = parsed.displayMode || 'always'
        return
      }
    }
  } catch (error) {
    // 解析失败，当作纯文本处理
  }

  // 如果不是JSON格式，当作纯文本处理
  announcementData.content = content
}

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 处理自动刷新间隔变更
const handleAutoRefreshIntervalChange = () => {
  if (formData.autoRefreshInterval < 5) {
    formData.autoRefreshInterval = 5
  }
  if (formData.autoRefreshInterval > 300) {
    formData.autoRefreshInterval = 300
  }
}

// 需求 4：添加授权邮箱
const addAuthorizedEmail = () => {
  const email = newAuthorizedEmail.value.trim()
  if (!email) {
    ElMessage.warning('请输入邮箱地址')
    return
  }

  // 简单的邮箱验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    ElMessage.warning('请输入有效的邮箱地址')
    return
  }

  if (formData.authorizedEmails.includes(email)) {
    ElMessage.warning('该邮箱已添加')
    return
  }

  formData.authorizedEmails.push(email)
  newAuthorizedEmail.value = ''
}

// 需求 4：移除授权邮箱
const removeAuthorizedEmail = (index) => {
  formData.authorizedEmails.splice(index, 1)
}

// 触发文件输入
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files || [])
  await processFiles(files)
  event.target.value = ''
}

// 处理粘贴事件 - 只处理图片
const handlePaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  const files = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    await processFiles(files)
  }
}

// 处理粘贴图片（按钮方式 - 保留用于兼容）
const handlePasteImage = async () => {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
        const blob = await item.getType('image/png') || await item.getType('image/jpeg')
        await processFiles([blob])
      }
    }
  } catch (error) {
    ElMessage.warning('无法读取剪贴板中的图片')
  }
}

// 处理文件
const processFiles = async (files) => {
  if (announcementData.images.length >= 10) {
    ElMessage.warning('最多只能上传10张图片')
    return
  }

  let totalSize = announcementData.images.reduce((sum, img) => {
    const base64Size = img.base64.length * 0.75
    return sum + base64Size
  }, 0)

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      const fileName = file.name || 'image'
      ElMessage.warning(`${fileName} 不是图片文件`)
      continue
    }

    if (file.size > 500 * 1024) {
      const fileName = file.name || 'image'
      ElMessage.warning(`${fileName} 超过500KB限制`)
      continue
    }

    totalSize += file.size
    if (totalSize > 5 * 1024 * 1024) {
      ElMessage.warning('图片总大小超过5MB限制')
      break
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      announcementData.images.push({
        base64: e.target.result,
        caption: ''
      })
    }
    reader.readAsDataURL(file)
  }
}

// 移除图片
const removeImage = (index) => {
  announcementData.images.splice(index, 1)
}

// 上移图片
const moveImageUp = (index) => {
  if (index > 0) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index - 1]
    announcementData.images[index - 1] = temp
  }
}

// 下移图片
const moveImageDown = (index) => {
  if (index < announcementData.images.length - 1) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index + 1]
    announcementData.images[index + 1] = temp
  }
}

// 构建公告内容
const buildAnnouncementContent = () => {
  if (!announcementData.title && !announcementData.content && announcementData.images.length === 0) {
    return null
  }

  return JSON.stringify({
    type: 'rich',
    title: announcementData.title || '',
    content: announcementData.content || '',
    images: announcementData.images || [],
    displayMode: announcementData.displayMode || 'always'
  })
}

// 处理关闭
const handleClose = () => {
  visible.value = false
}

// 处理保存
const handleSave = async () => {
  saving.value = true
  try {
    const settings = {
      shareName: formData.shareName,
      expireTime: formData.expireTime,
      otpLimitDaily: formData.otpLimitDaily,
      otpLimitEnabled: formData.otpLimitEnabled ? 1 : 0,
      rateLimitPerSecond: formData.rateLimitEnabled ? formData.rateLimitPerSecond : 0,
      autoRecoverySeconds: formData.autoRecoverySeconds,
      keywordFilter: formData.keywordFilter,
      verificationCodeLimit: formData.verificationCodeLimit,
      verificationCodeLimitEnabled: formData.verificationCodeLimitEnabled ? 1 : 0,
      latestEmailCount: formData.latestEmailCount,
      autoRefreshEnabled: formData.autoRefreshEnabled ? 1 : 0,
      autoRefreshInterval: formData.autoRefreshInterval,
      cooldownEnabled: formData.cooldownEnabled ? 1 : 0,
      cooldownSeconds: formData.cooldownSeconds,
      enableCaptcha: formData.enableCaptcha ? 1 : 0,
      announcementContent: buildAnnouncementContent(),
      shareType: formData.shareType,
      filterMode: formData.filterMode,
      templateId: formData.templateId,
      showFullEmail: formData.showFullEmail ? 1 : 0,
      shareDomain: formData.shareDomain
    }

    // Fix: 只在多邮箱分享（Type 2）时才发送 authorizedEmails 字段
    // 原因：后端会验证 authorizedEmails 只能用于 Type 2 分享
    if (formData.shareType === 2) {
      settings.authorizedEmails = formData.authorizedEmails
    }

    await updateShareAdvancedSettings(formData.shareId, settings)
    ElMessage.success('高级设置更新成功')
    emit('updated')
    handleClose()
  } catch (error) {
    ElMessage.error('更新失败，请重试')
  } finally {
    saving.value = false
  }
}

// 刷新 Token
const handleRefreshToken = async () => {
  try {
    const result = await refreshShareToken(formData.shareId)
    formData.shareToken = result.shareToken
    formData.shareUrl = result.shareUrl
    ElMessage.success('Token 已刷新')
  } catch (error) {
    ElMessage.error('刷新失败，请重试')
  }
}

// 复制分享链接
const copyShareUrl = async (text, label) => {
  if (!formData.shareUrl) {
    ElMessage.warning('分享链接为空，无法复制')
    return
  }

  try {
    await navigator.clipboard.writeText(formData.shareUrl)
    ElMessage.success('分享链接已复制到剪贴板')
  } catch (error) {
    // 降级方案：使用传统的复制方法
    try {
      const textArea = document.createElement('textarea')
      textArea.value = formData.shareUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      ElMessage.success('分享链接已复制到剪贴板')
    } catch (fallbackError) {
      ElMessage.error('复制失败，请手动复制')
    }
  }
}
</script>

<style scoped>
/* 垂直选项卡布局优化 */
:deep(.el-tabs--left) {
  display: flex;
  height: 100%;
}

:deep(.el-tabs__nav-wrap--left) {
  width: 120px;
  border-right: 1px solid #e4e7eb;
}

:deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

:deep(.el-tab-pane) {
  padding: 0;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.authorized-emails-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.email-input-group {
  display: flex;
  gap: 8px;
}

.email-input-group :deep(.el-input) {
  flex: 1;
}

.email-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-url-display {
  display: flex;
  gap: 8px;
}

.share-url-display :deep(.el-input) {
  flex: 1;
}

.announcement-container {
  padding: 20px;
}

.announcement-editor {
  max-width: 600px;
}

.image-upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  background-color: #f5f7fa;
}

.upload-button-group {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 12px;
}

.image-preview-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.image-item {
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f7fa;
}

.image-item img {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.image-actions {
  padding: 8px;
  background-color: white;
}

.image-actions :deep(.el-input) {
  margin-bottom: 4px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.action-buttons :deep(.el-button) {
  flex: 1;
  padding: 4px 8px;
}

.announcement-preview {
  padding: 20px;
}

.preview-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #303133;
}

.preview-carousel {
  margin-bottom: 16px;
  border-radius: 4px;
  overflow: hidden;
}

.carousel-image {
  width: 100%;
  height: 300px;
  object-fit: cover;
  display: block;
}

.image-caption {
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 12px;
  text-align: center;
}

.preview-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #606266;
  line-height: 1.6;
}

.preview-empty {
  text-align: center;
  padding: 40px 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  :deep(.advanced-tabs) {
    height: auto !important;
  }

  :deep(.el-tabs--left) {
    flex-direction: column;
  }

  :deep(.el-tabs__nav-wrap--left) {
    width: 100% !important;
    margin-bottom: 16px;
  }

  :deep(.el-tabs__nav--left) {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }

  :deep(.el-tabs__item--left) {
    text-align: center;
    flex-shrink: 0;
  }

  :deep(.el-tabs__content) {
    width: 100% !important;
  }

  :deep(.el-dialog) {
    width: 95vw !important;
    max-width: 95vw;
  }

  :deep(.el-dialog__body) {
    padding: 12px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }

  :deep(.el-form) {
    label-width: 100px !important;
  }

  :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .image-preview-list {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  .image-item img {
    height: 80px;
  }

  .carousel-image {
    height: 200px;
  }

  .upload-button-group {
    flex-direction: column;
  }

  .email-input-group {
    flex-direction: column;
  }

  .share-url-display {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .el-dialog :deep(.el-dialog) {
    width: 95vw !important;
  }

  .image-preview-list {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  }

  .image-item img {
    height: 60px;
  }

  .carousel-image {
    height: 150px;
  }

  .preview-title {
    font-size: 16px;
  }
}
</style>
