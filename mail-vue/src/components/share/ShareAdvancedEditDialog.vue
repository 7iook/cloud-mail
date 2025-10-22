<template>
  <el-dialog
    v-model="visible"
    title="高级设置"
    width="50%"
    max-height="90vh"
    :before-close="handleClose"
    class="advanced-settings-dialog"
  >
    <!-- 选项卡导航 -->
    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- 基础设置选项卡 -->
      <el-tab-pane label="基础设置" name="basic">
        <div class="tab-content">
          <el-form :model="formData" :rules="rules" label-width="140px" size="default">
            <!-- 基础设置部分 -->
            <div class="settings-section">
              <h3 class="section-title">基础设置</h3>
              
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
            </div>

            <el-divider />

            <!-- 访问控制部分 -->
            <div class="settings-section">
              <h3 class="section-title">访问控制</h3>
              
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

              <el-divider style="margin: 10px 0;" />

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

              <el-divider style="margin: 10px 0;" />

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

              <el-divider style="margin: 10px 0;" />

              <el-form-item label="启用人机验证">
                <el-switch v-model="formData.enableCaptcha" />
                <div class="form-tip">启用后，用户需要完成人机验证才能访问</div>
              </el-form-item>
            </div>

            <el-divider />

            <!-- 邮件显示部分 -->
            <div class="settings-section">
              <h3 class="section-title">邮件显示</h3>
              
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

              <el-divider style="margin: 10px 0;" />

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
            </div>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 公告设置选项卡 -->
      <el-tab-pane label="公告设置" name="announcement">
        <div class="announcement-tab-content">
          <div class="announcement-editor-container">
            <!-- 左侧编辑区域 -->
            <div class="announcement-editor">
              <el-form :model="announcementData" label-width="120px" size="default">
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
                    show-word-limit
                  />
                </el-form-item>

                <el-form-item label="公告内容">
                  <div class="content-editor-wrapper">
                    <!-- 工具栏 -->
                    <div class="editor-toolbar">
                      <el-button-group>
                        <el-button size="small" @click="insertLink">
                          <Icon icon="material-symbols:link" /> 插入链接
                        </el-button>
                        <el-button size="small" @click="showColorPicker = true">
                          <Icon icon="material-symbols:palette" /> 颜色
                        </el-button>
                        <el-button size="small" @click="insertHighlight">
                          <Icon icon="material-symbols:highlight" /> 高亮
                        </el-button>
                      </el-button-group>
                    </div>

                    <!-- 颜色选择器 -->
                    <el-popover
                      v-model:visible="showColorPicker"
                      placement="bottom"
                      :width="200"
                      trigger="click"
                    >
                      <div class="color-picker-container">
                        <div class="color-presets">
                          <div
                            v-for="color in colorPresets"
                            :key="color.value"
                            class="color-preset"
                            :style="{ backgroundColor: color.value }"
                            :title="color.label"
                            @click="insertColor(color)"
                          />
                        </div>
                      </div>
                    </el-popover>

                    <!-- 文本编辑区 -->
                    <el-input
                      v-model="announcementData.content"
                      type="textarea"
                      placeholder="请输入公告内容（支持 [link]URL[/link]、[red]文本[/red] 等标记）"
                      rows="8"
                      maxlength="1000"
                      show-word-limit
                      @paste="handlePaste"
                    />
                  </div>
                </el-form-item>

                <el-form-item label="图片">
                  <div class="image-upload-area">
                    <el-button @click="triggerFileInput">
                      <Icon icon="material-symbols:image-add" /> 上传图片
                    </el-button>
                    <input
                      ref="fileInput"
                      type="file"
                      multiple
                      accept="image/*"
                      style="display: none"
                      @change="handleFileSelect"
                    />
                    <div class="form-tip">支持 PNG、JPG 格式，单张不超过 500KB，总大小不超过 5MB，最多 10 张</div>
                  </div>

                  <!-- 图片列表 -->
                  <div v-if="announcementData.images.length > 0" class="image-list">
                    <div
                      v-for="(image, index) in announcementData.images"
                      :key="index"
                      class="image-item"
                    >
                      <img :src="image.base64" :alt="`Image ${index + 1}`" class="image-thumbnail" />
                      <div class="image-actions">
                        <el-button
                          v-if="index > 0"
                          size="small"
                          type="primary"
                          text
                          @click="moveImageUp(index)"
                        >
                          <Icon icon="material-symbols:arrow-upward" />
                        </el-button>
                        <el-button
                          v-if="index < announcementData.images.length - 1"
                          size="small"
                          type="primary"
                          text
                          @click="moveImageDown(index)"
                        >
                          <Icon icon="material-symbols:arrow-downward" />
                        </el-button>
                        <el-button
                          size="small"
                          type="danger"
                          text
                          @click="removeImage(index)"
                        >
                          <Icon icon="material-symbols:delete" />
                        </el-button>
                      </div>
                    </div>
                  </div>
                </el-form-item>
              </el-form>
            </div>

            <!-- 右侧预览区域 -->
            <div class="announcement-preview-container">
              <div class="preview-header">
                <h3>公告预览</h3>
              </div>
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
                    </el-carousel-item>
                  </el-carousel>
                </div>

                <!-- 公告内容 -->
                <div v-if="announcementData.content" class="preview-content">
                  <div v-html="renderAnnouncementContent(announcementData.content)" />
                </div>

                <!-- 空状态提示 -->
                <div v-if="!announcementData.title && !announcementData.content && (!announcementData.images || announcementData.images.length === 0)" class="preview-empty">
                  <el-empty description="暂无公告内容" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
    </template>

  </el-dialog>

</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import {
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
const activeTab = ref('basic')
const showColorPicker = ref(false)

// 可用域名列表
const availableDomains = ref([])

// 模板相关
const availableTemplates = ref([])

// 颜色预设
const colorPresets = [
  { label: '红色', value: '#FF0000' },
  { label: '绿色', value: '#00AA00' },
  { label: '蓝色', value: '#0066FF' },
  { label: '黄色', value: '#FFAA00' }
]

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

// 新增授权邮箱输入框
const newAuthorizedEmail = ref('')

// 公告数据（支持图片）
const announcementData = reactive({
  title: '',
  content: '',
  images: [],
  displayMode: 'always'
})

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

// 监听 shareData 变化
watch(() => props.shareData, (newVal) => {
  if (visible.value && newVal) {
    loadFormData()
  }
}, { deep: true })

// 加载表单数据
const loadFormData = () => {
  let authorizedEmails = []
  if (props.shareData.authorizedEmails) {
    try {
      const parsed = typeof props.shareData.authorizedEmails === 'string'
        ? JSON.parse(props.shareData.authorizedEmails)
        : props.shareData.authorizedEmails
      authorizedEmails = Array.isArray(parsed) ? parsed : []
    } catch (error) {
      // 解析失败
    }
  }

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

  newAuthorizedEmail.value = ''
  parseAnnouncementContent(props.shareData.announcementContent)
}

// 解析公告内容
const parseAnnouncementContent = (content) => {
  announcementData.title = ''
  announcementData.content = ''
  announcementData.images = []

  if (!content) return

  try {
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
    // 解析失败
  }

  announcementData.content = content
}

// 渲染公告内容（支持标记语法）
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
  html = html.replace(/\[link\](.*?)\[\/link\]/g, '<a href="$1" target="_blank" style="color: #0066FF; text-decoration: underline;">$1</a>')

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

// 插入链接
const insertLink = () => {
  const url = prompt('请输入链接地址:')
  if (url) {
    const text = prompt('请输入链接文本:') || url
    announcementData.content += `[link]${url}[/link]`
  }
}

// 插入颜色
const insertColor = (color) => {
  const text = prompt('请输入要着色的文本:')
  if (text) {
    const colorName = color.label.toLowerCase()
    announcementData.content += `[${colorName}]${text}[/${colorName}]`
  }
  showColorPicker.value = false
}

// 插入高亮
const insertHighlight = () => {
  const text = prompt('请输入要高亮的文本:')
  if (text) {
    announcementData.content += `[highlight]${text}[/highlight]`
  }
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

// 处理粘贴事件
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

// 处理自动刷新间隔变更
const handleAutoRefreshIntervalChange = () => {
  if (formData.autoRefreshInterval < 5) {
    formData.autoRefreshInterval = 5
  }
  if (formData.autoRefreshInterval > 300) {
    formData.autoRefreshInterval = 300
  }
}

// 添加授权邮箱
const addAuthorizedEmail = () => {
  const email = newAuthorizedEmail.value.trim()
  if (!email) {
    ElMessage.warning('请输入邮箱地址')
    return
  }

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

// 移除授权邮箱
const removeAuthorizedEmail = (index) => {
  formData.authorizedEmails.splice(index, 1)
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
const copyShareUrl = async () => {
  if (!formData.shareUrl) {
    ElMessage.warning('分享链接为空，无法复制')
    return
  }

  try {
    await navigator.clipboard.writeText(formData.shareUrl)
    ElMessage.success('分享链接已复制到剪贴板')
  } catch (error) {
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

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})
</script>

<style scoped>
/* 对话框自适应 */
:deep(.advanced-settings-dialog) {
  display: flex;
  flex-direction: column;
}

:deep(.advanced-settings-dialog .el-dialog__body) {
  flex: 1;
  overflow: hidden;
  padding: 0;
  max-height: calc(100vh - 200px);
}

/* 选项卡样式 */
.settings-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.settings-tabs .el-tabs__content) {
  flex: 1;
  overflow: hidden;
}

:deep(.settings-tabs .el-tab-pane) {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  max-width: 1200px;
}

/* 部分标题 */
.settings-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid #409eff;
}

/* 表单提示 */
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

/* 授权邮箱容器 */
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

/* 分享链接显示 */
.share-url-display {
  display: flex;
  gap: 8px;
}

.share-url-display :deep(.el-input) {
  flex: 1;
}

/* 公告编辑器容器 */
.announcement-tab-content {
  height: 100%;
  overflow: hidden;
}

.announcement-editor-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.announcement-editor {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.announcement-preview-container {
  width: 100%;
  max-height: 300px;
  border-top: 1px solid #e4e7eb;
  padding-top: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 编辑器工具栏 */
.content-editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.editor-toolbar :deep(.el-button-group) {
  display: flex;
}

/* 颜色选择器 */
.color-picker-container {
  padding: 12px;
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.color-preset {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid #e4e7eb;
  transition: all 0.3s;
}

.color-preset:hover {
  border-color: #409eff;
  transform: scale(1.1);
}

/* 图片上传区域 */
.image-upload-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.image-item {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f7fa;
}

.image-thumbnail {
  width: 100%;
  height: 100px;
  object-fit: cover;
  display: block;
}

.image-actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-item:hover .image-actions {
  opacity: 1;
}

/* 预览区域 */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7eb;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.announcement-preview {
  flex: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.preview-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #303133;
}

.preview-carousel {
  margin-bottom: 12px;
  border-radius: 4px;
  overflow: hidden;
}

.carousel-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.preview-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #606266;
  line-height: 1.6;
  font-size: 14px;
}

.preview-empty {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

/* 移动端适配 */
@media (max-width: 1200px) {
  .announcement-editor-container {
    flex-direction: column;
    height: auto;
  }

  .announcement-preview-container {
    width: 100%;
    border-left: none;
    border-top: 1px solid #e4e7eb;
    padding-left: 0;
    padding-top: 20px;
    margin-top: 20px;
  }

  .announcement-editor {
    padding-right: 0;
  }
}

@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 95vw !important;
  }

  :deep(.el-dialog__body) {
    padding: 12px;
    max-height: calc(100vh - 200px);
  }

  .announcement-editor-container {
    gap: 12px;
  }

  :deep(.el-form) {
    label-width: 100px !important;
  }

  .image-list {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  .image-thumbnail {
    height: 80px;
  }

  .carousel-image {
    height: 150px;
  }

  .preview-title {
    font-size: 16px;
  }
}
</style>