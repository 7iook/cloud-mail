<template>
  <el-dialog
    v-model="visible"
    title="批量修改高级设置"
    width="700px"
    :before-close="handleClose"
  >
    <div class="batch-info">
      <el-alert
        :title="`将对 ${shareCount} 个分享链接应用以下设置`"
        type="info"
        :closable="false"
        show-icon
      />
    </div>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="140px"
      label-position="left"
      style="margin-top: 20px"
    >
      <!-- 频率限制设置 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.rateLimit">频率限制</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.rateLimit }">
          <div class="limit-control">
            <el-input-number
              v-model="formData.rateLimitPerSecond"
              :min="1"
              :max="100"
              :step="1"
              :disabled="!enabledFields.rateLimit"
              style="width: 120px"
            />
            <span class="unit-text">次/秒</span>
            <el-input-number
              v-model="formData.autoRecoverySeconds"
              :min="0"
              :max="3600"
              :step="1"
              :disabled="!enabledFields.rateLimit"
              style="width: 120px; margin-left: 12px"
            />
            <span class="unit-text">秒（恢复时间）</span>
          </div>
          <div class="form-tip">控制访问者的请求频率限制和自动恢复时间</div>
        </div>
      </el-form-item>

      <!-- 邮件数量限制 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.emailCount">邮件数量限制</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.emailCount }">
          <div class="limit-control">
            <el-input-number
              v-model="formData.latestEmailCount"
              :min="1"
              :max="100"
              :step="1"
              :disabled="!enabledFields.emailCount"
              placeholder="留空显示全部"
              style="width: 200px"
              clearable
            />
            <span class="unit-text">封</span>
          </div>
          <div class="form-tip">
            控制分享链接最多显示多少封最新邮件。留空表示显示全部邮件。
          </div>
        </div>
      </el-form-item>

      <!-- 自动刷新设置 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.autoRefresh">自动刷新</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.autoRefresh }">
          <div class="limit-control">
            <el-switch
              v-model="formData.autoRefreshEnabled"
              active-text="启用"
              inactive-text="禁用"
              :disabled="!enabledFields.autoRefresh"
            />
            <el-select
              v-model="formData.autoRefreshInterval"
              :disabled="!enabledFields.autoRefresh || !formData.autoRefreshEnabled"
              style="width: 120px; margin-left: 12px"
            >
              <el-option label="30秒" :value="30" />
              <el-option label="60秒" :value="60" />
              <el-option label="120秒" :value="120" />
              <el-option label="300秒" :value="300" />
            </el-select>
            <span class="unit-text">间隔</span>
          </div>
          <div class="form-tip">
            启用后，访问者的页面会自动刷新获取最新邮件。建议间隔不少于30秒。
          </div>
        </div>
      </el-form-item>

      <!-- 关键词过滤 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.keywordFilter">关键词过滤</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.keywordFilter }">
          <el-input
            v-model="formData.keywordFilter"
            type="textarea"
            :rows="3"
            placeholder="输入关键词，用逗号分隔，如：验证码,code,otp"
            maxlength="500"
            show-word-limit
            :disabled="!enabledFields.keywordFilter"
          />
          <div class="form-tip">只显示包含这些关键词的邮件，留空表示显示所有邮件</div>
        </div>
      </el-form-item>

      <!-- 显示数量限制 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.verificationCodeLimit">显示数量限制</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.verificationCodeLimit }">
          <div class="limit-control">
            <el-switch
              v-model="formData.verificationCodeLimitEnabled"
              active-text="启用"
              inactive-text="禁用"
              :disabled="!enabledFields.verificationCodeLimit"
            />
            <el-input-number
              v-model="formData.verificationCodeLimit"
              :min="1"
              :max="1000"
              :step="10"
              :disabled="!enabledFields.verificationCodeLimit || !formData.verificationCodeLimitEnabled"
              style="width: 150px; margin-left: 12px"
            />
            <span class="unit-text">封</span>
          </div>
          <div class="form-tip">控制每次访问最多显示的验证码数量</div>
        </div>
      </el-form-item>

      <!-- 访问次数限制 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.otpLimit">访问次数限制</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.otpLimit }">
          <div class="limit-control">
            <el-switch
              v-model="formData.otpLimitEnabled"
              active-text="启用"
              inactive-text="禁用"
              :disabled="!enabledFields.otpLimit"
            />
            <el-input-number
              v-model="formData.otpLimitDaily"
              :min="1"
              :max="10000"
              :step="10"
              :disabled="!enabledFields.otpLimit || !formData.otpLimitEnabled"
              style="width: 150px; margin-left: 12px"
            />
            <span class="unit-text">次/天</span>
          </div>
          <div class="form-tip">控制每天最多可以访问的次数</div>
        </div>
      </el-form-item>

      <!-- 冷却功能 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.cooldown">获取验证码冷却</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.cooldown }">
          <div class="limit-control">
            <el-switch
              v-model="formData.cooldownEnabled"
              active-text="启用"
              inactive-text="禁用"
              :disabled="!enabledFields.cooldown"
            />
            <el-input-number
              v-model="formData.cooldownSeconds"
              :min="1"
              :max="300"
              :step="1"
              :disabled="!enabledFields.cooldown || !formData.cooldownEnabled"
              style="width: 120px; margin-left: 12px"
            />
            <span class="unit-text">秒</span>
          </div>
          <div class="form-tip">控制点击"获取最新验证码"按钮后的冷却时间</div>
        </div>
      </el-form-item>

      <!-- 人机验证 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.captcha">人机验证</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.captcha }">
          <el-switch
            v-model="formData.enableCaptcha"
            active-text="启用"
            inactive-text="禁用"
            :disabled="!enabledFields.captcha"
          />
          <div class="form-tip">启用后触发频率限制时需要进行人机验证</div>
        </div>
      </el-form-item>

      <!-- 过滤模式 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.filterMode">过滤模式</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.filterMode }">
          <el-radio-group v-model="formData.filterMode" :disabled="!enabledFields.filterMode">
            <el-radio :label="1">关键词过滤</el-radio>
            <el-radio :label="2">模板匹配</el-radio>
          </el-radio-group>
          <div class="form-tip">选择邮件过滤方式</div>
        </div>
      </el-form-item>

      <!-- 模板选择 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.template">邮件模板</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.template }">
          <el-select
            v-model="formData.templateId"
            placeholder="选择邮件模板"
            :disabled="!enabledFields.template"
            clearable
            style="width: 100%"
          >
            <el-option label="模板1" value="template1" />
            <el-option label="模板2" value="template2" />
            <el-option label="模板3" value="template3" />
          </el-select>
          <div class="form-tip">选择邮件显示模板</div>
        </div>
      </el-form-item>

      <!-- 显示完整邮件 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.showFullEmail">显示完整邮件</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.showFullEmail }">
          <el-switch
            v-model="formData.showFullEmail"
            active-text="启用"
            inactive-text="禁用"
            :disabled="!enabledFields.showFullEmail"
          />
          <div class="form-tip">启用后显示邮件的完整内容</div>
        </div>
      </el-form-item>

      <!-- 域名选择 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.shareDomain">分享域名</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.shareDomain }">
          <el-select
            v-model="formData.shareDomain"
            placeholder="选择分享域名"
            :disabled="!enabledFields.shareDomain"
            clearable
            style="width: 100%"
          >
            <el-option label="example.com" value="example.com" />
            <el-option label="example2.com" value="example2.com" />
            <el-option label="example3.com" value="example3.com" />
          </el-select>
          <div class="form-tip">选择分享链接使用的域名</div>
        </div>
      </el-form-item>

      <!-- 公告内容 -->
      <el-form-item>
        <template #label>
          <el-checkbox v-model="enabledFields.announcement">公告内容</el-checkbox>
        </template>
        <div class="setting-group" :class="{ disabled: !enabledFields.announcement }">
          <div class="announcement-editor">
            <!-- 标题 -->
            <div class="announcement-section">
              <label class="section-label">公告标题（可选）</label>
              <el-input
                v-model="announcementData.title"
                placeholder="输入公告标题"
                maxlength="100"
                show-word-limit
                :disabled="!enabledFields.announcement"
              />
            </div>

            <!-- 文本内容 -->
            <div class="announcement-section">
              <label class="section-label">公告文本（支持粘贴图片）</label>
              <el-input
                v-model="announcementData.content"
                type="textarea"
                placeholder="输入公告内容（可选）或粘贴图片"
                maxlength="5000"
                show-word-limit
                :rows="3"
                :disabled="!enabledFields.announcement"
                @paste="handlePaste"
              />
            </div>

            <!-- 图片上传 -->
            <div class="announcement-section">
              <label class="section-label">公告图片（可选，最多10张）</label>

              <!-- 上传区域 -->
              <div
                v-if="enabledFields.announcement"
                class="upload-area"
                @dragover.prevent
                @drop.prevent="handleDrop"
              >
                <div class="upload-content">
                  <el-icon class="upload-icon"><upload-filled /></el-icon>
                  <div class="upload-text">
                    <div>拖拽图片到此处或</div>
                    <el-button link type="primary" @click="$refs.fileInput.click()">
                      点击选择文件
                    </el-button>
                  </div>
                  <div class="upload-hint">支持 PNG、JPG、GIF、WebP 格式，单张≤500KB，总大小≤5MB</div>
                </div>
                <input
                  ref="fileInput"
                  type="file"
                  multiple
                  accept="image/*"
                  style="display: none"
                  @change="handleFileSelect"
                />
              </div>

              <!-- 图片列表 -->
              <div v-if="announcementData.images && announcementData.images.length > 0" class="images-list">
                <div
                  v-for="(image, index) in announcementData.images"
                  :key="index"
                  class="image-item"
                >
                  <div class="image-preview">
                    <img :src="image.base64" :alt="`Image ${index + 1}`" />
                  </div>
                  <div class="image-info">
                    <el-input
                      v-model="image.caption"
                      placeholder="图片说明（可选）"
                      maxlength="100"
                      show-word-limit
                      :disabled="!enabledFields.announcement"
                    />
                  </div>
                  <div class="image-actions">
                    <el-button
                      v-if="index > 0"
                      link
                      type="primary"
                      @click="moveImageUp(index)"
                      title="向上移动"
                      :disabled="!enabledFields.announcement"
                    >
                      <el-icon><arrow-up /></el-icon>
                    </el-button>
                    <el-button
                      v-if="index < announcementData.images.length - 1"
                      link
                      type="primary"
                      @click="moveImageDown(index)"
                      title="向下移动"
                      :disabled="!enabledFields.announcement"
                    >
                      <el-icon><arrow-down /></el-icon>
                    </el-button>
                    <el-button
                      link
                      type="danger"
                      @click="removeImage(index)"
                      title="删除"
                      :disabled="!enabledFields.announcement"
                    >
                      <el-icon><delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </div>

              <div class="form-tip">
                支持拖拽上传、点击选择或粘贴图片。图片会自动压缩。
              </div>
            </div>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          批量应用设置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchOperateShares } from '@/request/share.js'
import { UploadFilled, ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  selectedShares: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'updated'])

// 响应式数据
const visible = ref(false)
const saving = ref(false)
const formRef = ref()

// 选中的分享数量
const shareCount = computed(() => props.selectedShares.length)

// 启用的字段控制
const enabledFields = reactive({
  rateLimit: false,
  emailCount: false,
  autoRefresh: false,
  keywordFilter: false,
  verificationCodeLimit: false,
  otpLimit: false,
  cooldown: false,
  captcha: false,
  filterMode: false,
  template: false,
  showFullEmail: false,
  shareDomain: false,
  announcement: false
})

// 公告相关
const announcementData = reactive({
  title: '',
  content: '',
  images: []
})

// 表单数据
const formData = reactive({
  rateLimitPerSecond: 5,
  autoRecoverySeconds: 60,
  latestEmailCount: null,
  autoRefreshEnabled: false,
  autoRefreshInterval: 30,
  keywordFilter: '',
  verificationCodeLimit: 100,
  verificationCodeLimitEnabled: true,
  otpLimitDaily: 100,
  otpLimitEnabled: true,
  cooldownEnabled: true,
  cooldownSeconds: 10,
  enableCaptcha: false,
  filterMode: 1,
  templateId: '',
  showFullEmail: true,
  shareDomain: ''
})

// 表单验证规则
const rules = {
  rateLimitPerSecond: [
    { type: 'number', min: 1, max: 100, message: '每秒限制必须在 1-100 之间', trigger: 'blur' }
  ],
  autoRecoverySeconds: [
    { type: 'number', min: 0, max: 3600, message: '自动恢复时间必须在 0-3600 秒之间', trigger: 'blur' }
  ],
  latestEmailCount: [
    { type: 'number', min: 1, max: 100, message: '邮件数量必须在 1-100 之间', trigger: 'blur' }
  ]
}

// 监听显示状态
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 关闭对话框
const handleClose = () => {
  visible.value = false
  // 重置表单
  nextTick(() => {
    formRef.value?.resetFields()
    // 重置启用状态
    Object.keys(enabledFields).forEach(key => {
      enabledFields[key] = false
    })
    // 重置公告数据
    announcementData.title = ''
    announcementData.content = ''
    announcementData.images = []
  })
}

// 构建公告内容（支持新旧格式）
const buildAnnouncementContent = () => {
  // 如果没有标题、内容和图片，返回null
  if (!announcementData.title && !announcementData.content && announcementData.images.length === 0) {
    return null
  }

  // 如果只有纯文本内容（没有标题和图片），返回纯文本
  if (!announcementData.title && announcementData.images.length === 0 && announcementData.content) {
    return announcementData.content
  }

  // 否则返回JSON格式
  const richContent = {
    type: 'rich',
    title: announcementData.title || '',
    content: announcementData.content || '',
    images: announcementData.images || []
  }

  return JSON.stringify(richContent)
}

// 图片处理方法
const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  await processFiles(files)
  // 重置文件输入
  event.target.value = ''
}

const handleDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
  await processFiles(files)
}

const processFiles = async (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  if (imageFiles.length === 0) {
    ElMessage.warning('请选择图片文件')
    return
  }

  // 检查图片数量限制
  if (announcementData.images.length + imageFiles.length > 10) {
    ElMessage.error('公告图片最多10张，当前已有 ' + announcementData.images.length + ' 张')
    return
  }

  for (const file of imageFiles) {
    // 检查单个文件大小（500KB）
    if (file.size > 500 * 1024) {
      ElMessage.error(`图片 ${file.name} 超过500KB限制`)
      continue
    }

    try {
      const base64 = await fileToBase64(file)
      announcementData.images.push({
        base64,
        caption: ''
      })
    } catch (error) {
      ElMessage.error(`处理图片 ${file.name} 失败: ${error.message}`)
    }
  }
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 粘贴事件处理 - 只处理图片
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

const removeImage = (index) => {
  announcementData.images.splice(index, 1)
}

const moveImageUp = (index) => {
  if (index > 0) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index - 1]
    announcementData.images[index - 1] = temp
  }
}

const moveImageDown = (index) => {
  if (index < announcementData.images.length - 1) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index + 1]
    announcementData.images[index + 1] = temp
  }
}

// 保存设置
const handleSave = async () => {
  try {
    // 检查是否至少选择了一个设置项
    const hasEnabledFields = Object.values(enabledFields).some(enabled => enabled)
    if (!hasEnabledFields) {
      ElMessage.warning('请至少选择一个要修改的设置项')
      return
    }

    // 表单验证
    await formRef.value.validate()
    
    // 构建确认信息
    const enabledFieldNames = []
    if (enabledFields.rateLimit) enabledFieldNames.push('频率限制')
    if (enabledFields.emailCount) enabledFieldNames.push('邮件数量限制')
    if (enabledFields.autoRefresh) enabledFieldNames.push('自动刷新')
    if (enabledFields.keywordFilter) enabledFieldNames.push('关键词过滤')
    if (enabledFields.verificationCodeLimit) enabledFieldNames.push('显示数量限制')
    if (enabledFields.otpLimit) enabledFieldNames.push('访问次数限制')
    if (enabledFields.cooldown) enabledFieldNames.push('获取验证码冷却')
    if (enabledFields.captcha) enabledFieldNames.push('人机验证')
    if (enabledFields.filterMode) enabledFieldNames.push('过滤模式')
    if (enabledFields.template) enabledFieldNames.push('邮件模板')
    if (enabledFields.showFullEmail) enabledFieldNames.push('显示完整邮件')
    if (enabledFields.shareDomain) enabledFieldNames.push('分享域名')
    if (enabledFields.announcement) enabledFieldNames.push('公告内容')

    const confirmMessage = `
      <div style="text-align: left;">
        <p><strong>将对 ${shareCount.value} 个分享链接批量修改以下设置：</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${enabledFieldNames.map(name => `<li>${name}</li>`).join('')}
        </ul>
        <p style="color: #e6a23c; font-size: 13px;">⚠️ 此操作不可撤销，请确认后继续</p>
      </div>
    `

    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量修改高级设置',
      {
        type: 'warning',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `修改 ${shareCount.value} 个分享`,
        cancelButtonText: '取消操作'
      }
    )

    saving.value = true

    // 构建要更新的设置数据
    const settings = {}
    if (enabledFields.rateLimit) {
      settings.rateLimitPerSecond = formData.rateLimitPerSecond
      settings.autoRecoverySeconds = formData.autoRecoverySeconds
    }
    if (enabledFields.emailCount) {
      settings.latestEmailCount = formData.latestEmailCount
    }
    if (enabledFields.autoRefresh) {
      settings.autoRefreshEnabled = formData.autoRefreshEnabled ? 1 : 0
      settings.autoRefreshInterval = formData.autoRefreshInterval
    }
    if (enabledFields.keywordFilter) {
      settings.keywordFilter = formData.keywordFilter
    }
    if (enabledFields.verificationCodeLimit) {
      settings.verificationCodeLimit = formData.verificationCodeLimit
      settings.verificationCodeLimitEnabled = formData.verificationCodeLimitEnabled ? 1 : 0
    }
    if (enabledFields.otpLimit) {
      settings.otpLimitDaily = formData.otpLimitDaily
      settings.otpLimitEnabled = formData.otpLimitEnabled ? 1 : 0
    }
    if (enabledFields.cooldown) {
      settings.cooldownEnabled = formData.cooldownEnabled ? 1 : 0
      settings.cooldownSeconds = formData.cooldownSeconds
    }
    if (enabledFields.captcha) {
      settings.enableCaptcha = formData.enableCaptcha ? 1 : 0
    }
    if (enabledFields.filterMode) {
      settings.filterMode = formData.filterMode
    }
    if (enabledFields.template) {
      settings.templateId = formData.templateId || null
    }
    if (enabledFields.showFullEmail) {
      settings.showFullEmail = formData.showFullEmail ? 1 : 0
    }
    if (enabledFields.shareDomain) {
      settings.shareDomain = formData.shareDomain || null
    }
    if (enabledFields.announcement) {
      settings.announcementContent = buildAnnouncementContent()
    }

    // 调用批量操作API
    const shareIds = props.selectedShares.map(share => share.shareId)
    const result = await batchOperateShares('updateAdvancedSettings', shareIds, { settings })

    const affectedCount = result?.affected || 0
    ElMessage.success(`成功修改 ${affectedCount} 个分享的高级设置`)
    
    emit('updated')
    handleClose()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch update advanced settings error:', error)
      ElMessage.error('批量修改高级设置失败')
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.batch-info {
  margin-bottom: 20px;
}

.setting-group {
  transition: opacity 0.3s ease;
}

.setting-group.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.limit-control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.unit-text {
  color: var(--el-text-color-regular);
  font-size: 14px;
  white-space: nowrap;
}

.form-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

:deep(.el-checkbox) {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:deep(.el-form-item__label) {
  font-weight: normal;
}

/* 公告编辑器样式 */
.announcement-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.announcement-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

/* 上传区域样式 */
.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 30px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  font-size: 32px;
  color: #909399;
}

.upload-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #606266;
  font-size: 13px;
}

.upload-hint {
  font-size: 11px;
  color: #909399;
}

/* 图片列表样式 */
.images-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.image-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.image-preview {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #fff;
  border: 1px solid #dcdfe6;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-info {
  flex: 1;
  min-width: 0;
}

.image-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* 移动端优化 */
@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 95vw !important;
    max-width: 95vw;
  }

  :deep(.el-dialog__body) {
    padding: 12px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }

  /* 公告编辑器移动端优化 */
  .announcement-editor {
    gap: 8px;
  }

  .announcement-section {
    gap: 4px;
  }

  .section-label {
    font-size: 12px;
  }

  .upload-area {
    padding: 16px 10px;
    border-radius: 4px;
  }

  .upload-icon {
    font-size: 20px;
  }

  .upload-text {
    font-size: 11px;
    gap: 2px;
  }

  .upload-hint {
    font-size: 9px;
  }

  .images-list {
    gap: 6px;
  }

  .image-item {
    gap: 6px;
    padding: 6px;
  }

  .image-preview {
    width: 50px;
    height: 50px;
  }

  .image-actions {
    gap: 0;
  }

  .image-actions .el-button {
    padding: 2px 4px;
  }

  /* 表单字段移动端优化 */
  :deep(.el-form-item) {
    margin-bottom: 10px;
  }

  :deep(.el-form-item__label) {
    font-size: 12px;
  }

  :deep(.el-input__wrapper) {
    padding: 4px 8px;
  }

  :deep(.el-input) {
    font-size: 12px;
  }

  :deep(.el-textarea__inner) {
    font-size: 12px;
    padding: 6px 8px;
  }

  :deep(.el-button) {
    padding: 6px 12px;
    font-size: 12px;
    min-height: 32px;
  }

  :deep(.el-button--primary) {
    width: 100%;
  }

  /* 对话框底部按钮 */
  .dialog-footer {
    flex-direction: column;
    gap: 8px;

    .el-button {
      width: 100%;
    }
  }

  /* 批量信息提示 */
  .batch-info {
    margin-bottom: 12px;
  }

  .batch-info :deep(.el-alert) {
    padding: 8px 12px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  :deep(.el-dialog) {
    width: 100vw !important;
    max-width: 100vw;
    margin: 0 !important;
  }

  :deep(.el-dialog__header) {
    padding: 12px;
  }

  :deep(.el-dialog__title) {
    font-size: 14px;
  }

  :deep(.el-dialog__close) {
    font-size: 16px;
  }

  .upload-area {
    padding: 12px 8px;
  }

  .image-preview {
    width: 40px;
    height: 40px;
  }

  .limit-control {
    flex-direction: column;
    gap: 6px;
  }

  .unit-text {
    font-size: 12px;
  }
}
</style>
