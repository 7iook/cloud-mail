<template>
  <el-dialog
    v-model="visible"
    title="编辑高级参数"
    width="600px"
    :before-close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="left"
    >
      <!-- 基本信息 -->
      <el-form-item label="分享名称" prop="shareName">
        <el-input
          v-model="formData.shareName"
          placeholder="请输入分享名称"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <!-- 域名选择方式 -->
      <el-form-item label="域名选择方式">
        <el-radio-group v-model="domainSelectionMode">
          <el-radio value="auto">自动匹配邮箱域名</el-radio>
          <el-radio value="manual">手动选择域名</el-radio>
        </el-radio-group>
        <div class="form-tip">
          自动模式：从邮箱列表中自动选择最频繁的域名；手动模式：手动选择分享链接的域名
        </div>
      </el-form-item>

      <el-form-item v-if="domainSelectionMode === 'manual'" label="分享域名" prop="shareDomain">
        <el-select
          v-model="formData.shareDomain"
          placeholder="选择分享链接的域名"
          style="width: 100%"
        >
          <el-option
            v-for="domain in availableDomains"
            :key="domain.value"
            :label="domain.label"
            :value="domain.value"
          />
        </el-select>
        <div class="form-tip">
          选择生成分享链接使用的域名。本地开发时会自动检测端口。
        </div>
      </el-form-item>

      <!-- 过期时间 -->
      <el-form-item label="过期时间" prop="expireTime">
        <el-date-picker
          v-model="formData.expireTime"
          type="datetime"
          placeholder="选择过期时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          style="width: 100%"
        />
        <div class="form-tip">留空表示永不过期</div>
      </el-form-item>

      <!-- 需求 4：授权邮箱编辑（仅对 Type 2 分享） -->
      <el-form-item v-if="formData.shareType === 2" label="授权邮箱" prop="authorizedEmails">
        <div class="authorized-emails-editor">
          <div class="email-input-group">
            <el-input
              v-model="newAuthorizedEmail"
              placeholder="输入邮箱地址"
              @keyup.enter="handleAddAuthorizedEmail"
              clearable
            />
            <el-button
              type="primary"
              @click="handleAddAuthorizedEmail"
              :disabled="!newAuthorizedEmail.trim()"
            >
              添加
            </el-button>
          </div>
          <div v-if="formData.authorizedEmails && formData.authorizedEmails.length > 0" class="email-tags">
            <el-tag
              v-for="(email, index) in formData.authorizedEmails"
              :key="index"
              closable
              @close="handleRemoveAuthorizedEmail(index)"
              class="email-tag"
            >
              {{ email }}
            </el-tag>
          </div>
          <div v-else class="form-tip">
            还没有添加授权邮箱，请添加至少一个邮箱
          </div>
        </div>
      </el-form-item>

      <!-- 访问次数限制 -->
      <el-form-item label="访问次数限制">
        <div class="limit-control">
          <el-switch
            v-model="formData.otpLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="formData.otpLimitDaily"
            :min="1"
            :max="10000"
            :step="10"
            :disabled="!formData.otpLimitEnabled"
            style="width: 150px; margin-left: 12px"
          />
          <span class="unit-text">次/天</span>
        </div>
        <div class="form-tip">每天最多可以访问的次数（不是显示数量）。禁用后无限制访问。</div>
      </el-form-item>

      <!-- 显示数量限制 -->
      <el-form-item label="显示数量限制">
        <div class="limit-control">
          <el-switch
            v-model="formData.verificationCodeLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="formData.verificationCodeLimit"
            :min="1"
            :max="1000"
            :step="10"
            :disabled="!formData.verificationCodeLimitEnabled"
            style="width: 150px; margin-left: 12px"
          />
          <span class="unit-text">条</span>
        </div>
        <div class="form-tip">每次访问最多显示的验证码数量。禁用后显示全部。</div>
      </el-form-item>

      <!-- 频率限制 -->
      <el-form-item label="频率限制">
        <div class="limit-control">
          <el-switch
            v-model="formData.rateLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="unit-text" style="margin-left: 12px;">启用后可设置访问频率限制</span>
        </div>
        <div v-if="formData.rateLimitEnabled" class="rate-limit-group" style="margin-top: 12px;">
          <div class="rate-limit-item">
            <label>每秒限制：</label>
            <el-input-number
              v-model="formData.rateLimitPerSecond"
              :min="1"
              :max="100"
              :step="1"
              style="width: 120px"
            />
            <span class="unit-text">次/秒</span>
          </div>
          <div class="rate-limit-item">
            <label>自动恢复时间：</label>
            <el-input-number
              v-model="formData.autoRecoverySeconds"
              :min="0"
              :max="3600"
              :step="1"
              style="width: 120px"
            />
            <span class="unit-text">秒（触发限制后需等待的时间）</span>
          </div>
        </div>
        <div class="form-tip">
          禁用频率限制后，访问者可以无限制地请求验证码。建议仅在信任环境中禁用。
        </div>
      </el-form-item>

      <!-- 过滤模式选择 -->
      <el-form-item label="过滤模式" prop="filterMode">
        <el-radio-group v-model="formData.filterMode" @change="onFilterModeChange">
          <el-radio :label="1">关键词过滤</el-radio>
          <el-radio :label="2">模板匹配</el-radio>
        </el-radio-group>
        <div class="form-tip">
          关键词过滤：通过关键词匹配邮件内容；模板匹配：使用预定义模板精确提取验证码
        </div>
      </el-form-item>

      <!-- 关键词过滤 -->
      <el-form-item v-if="formData.filterMode === 1" label="关键词过滤" prop="keywordFilter">
        <el-input
          v-model="formData.keywordFilter"
          type="textarea"
          :rows="3"
          placeholder="输入关键词，用逗号分隔，如：验证码,code,otp"
          maxlength="500"
          show-word-limit
        />
        <div class="form-tip">只显示包含这些关键词的邮件，留空表示显示所有邮件</div>
      </el-form-item>

      <!-- 模板匹配配置 -->
      <div v-if="formData.filterMode === 2">
        <el-form-item label="选择模板" prop="templateId">
          <div class="template-selector-container">
            <el-select
              v-model="formData.templateId"
              placeholder="请选择邮件模板"
              class="template-select"
              @change="onTemplateChange"
            >
              <el-option
                v-for="template in availableTemplates"
                :key="template.id"
                :label="template.name"
                :value="template.id"
              >
                <div>
                  <div>{{ template.name }}</div>
                  <div style="font-size: 12px; color: #999;">{{ template.description }}</div>
                </div>
              </el-option>
            </el-select>
          </div>
          <div class="form-tip">
            选择预定义的邮件模板进行精确匹配和验证码提取
          </div>
        </el-form-item>

        <el-form-item label="显示选项">
          <el-checkbox v-model="formData.showFullEmail">显示完整邮件内容</el-checkbox>
          <div class="form-tip">
            取消勾选时，仅显示提取的验证码，不显示完整邮件内容
          </div>
        </el-form-item>
      </div>

      <!-- 新增：最新邮件数量限制 -->
      <el-form-item label="最新邮件显示数量">
        <div class="limit-control">
          <el-input-number
            v-model="formData.latestEmailCount"
            :min="1"
            :max="100"
            :step="1"
            placeholder="留空显示全部"
            style="width: 200px"
            clearable
          />
          <span class="unit-text">封</span>
        </div>
        <div class="form-tip">
          控制分享链接最多显示多少封最新邮件。留空表示显示全部邮件。
        </div>
      </el-form-item>

      <!-- 新增：自动刷新功能 -->
      <el-form-item label="自动刷新">
        <div class="limit-control">
          <el-switch
            v-model="formData.autoRefreshEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-select
            v-model="formData.autoRefreshInterval"
            :disabled="!formData.autoRefreshEnabled"
            style="width: 120px; margin-left: 12px"
            @change="handleAutoRefreshIntervalChange"
          >
            <el-option label="5秒" :value="5" />
            <el-option label="10秒" :value="10" />
            <el-option label="19秒" :value="19" />
            <el-option label="30秒" :value="30" />
            <el-option label="60秒" :value="60" />
            <el-option label="120秒" :value="120" />
            <el-option label="300秒" :value="300" />
            <el-option label="自定义" :value="0" />
          </el-select>
          <span class="unit-text">间隔</span>
          <!-- 自定义输入框 -->
          <el-input
            v-if="formData.autoRefreshInterval === 0 && formData.autoRefreshEnabled"
            v-model.number="customAutoRefreshInterval"
            type="number"
            placeholder="输入秒数(1-3600)"
            style="width: 120px; margin-left: 12px"
            :min="1"
            :max="3600"
            @input="validateCustomAutoRefreshInterval"
          />
        </div>
        <div class="form-tip">
          启用后，访问者的页面会自动刷新获取最新邮件。自定义间隔范围：1-3600秒。
        </div>
        <div v-if="autoRefreshIntervalError" class="form-error">
          {{ autoRefreshIntervalError }}
        </div>
      </el-form-item>

      <!-- 新增：冷却功能配置 -->
      <el-form-item label="获取验证码冷却">
        <div class="limit-control">
          <el-switch
            v-model="formData.cooldownEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="formData.cooldownSeconds"
            :min="1"
            :max="300"
            :step="1"
            :disabled="!formData.cooldownEnabled"
            style="width: 120px; margin-left: 12px"
          />
          <span class="unit-text">秒</span>
        </div>
        <div class="form-tip">
          控制点击"获取最新验证码"按钮后的冷却时间。禁用后可无限制点击。
        </div>
      </el-form-item>

      <!-- 新增：人机验证功能 -->
      <el-form-item label="人机验证">
        <div class="limit-control">
          <el-switch
            v-model="formData.enableCaptcha"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="unit-text" style="margin-left: 12px;">启用后触发频率限制时需要进行人机验证</span>
        </div>
        <div class="form-tip">
          启用Cloudflare Turnstile人机验证，防止恶意访问。当访问频率超过限制时，访问者需要完成验证才能继续访问。
        </div>
      </el-form-item>

      <!-- 新增：公告弹窗功能（支持图片） -->
      <el-form-item label="公告内容" prop="announcementContent">
        <div class="announcement-editor">
          <!-- 标题和预览按钮 -->
          <div class="announcement-header">
            <div class="announcement-section" style="flex: 1">
              <label class="section-label">公告标题（可选）</label>
              <el-input
                v-model="announcementData.title"
                placeholder="输入公告标题"
                maxlength="100"
                show-word-limit
              />
            </div>
            <el-button
              type="primary"
              @click="showAnnouncementPreview = true"
              style="align-self: flex-end; margin-bottom: 0"
            >
              预览公告
            </el-button>
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
              @paste="handlePaste"
            />
          </div>

          <!-- 图片上传 -->
          <div class="announcement-section">
            <label class="section-label">公告图片（可选，最多10张）</label>

            <!-- 上传区域 -->
            <div class="upload-area" @dragover.prevent @drop.prevent="handleDrop">
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
                  />
                </div>
                <div class="image-actions">
                  <el-button
                    v-if="index > 0"
                    link
                    type="primary"
                    @click="moveImageUp(index)"
                    title="向上移动"
                  >
                    <el-icon><arrow-up /></el-icon>
                  </el-button>
                  <el-button
                    v-if="index < announcementData.images.length - 1"
                    link
                    type="primary"
                    @click="moveImageDown(index)"
                    title="向下移动"
                  >
                    <el-icon><arrow-down /></el-icon>
                  </el-button>
                  <el-button
                    link
                    type="danger"
                    @click="removeImage(index)"
                    title="删除"
                  >
                    <el-icon><delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>

            <div class="form-tip">
              支持拖拽上传、点击选择或粘贴图片。图片会自动压缩。访问者可以关闭公告，同一设备不会再次显示。
            </div>
          </div>
        </div>
      </el-form-item>

      <!-- 新增：TOKEN 管理 -->
      <el-form-item label="API Token 管理">
        <div class="token-management">
          <!-- Token 显示 -->
          <div class="token-display">
            <div class="token-item">
              <label>Token:</label>
              <div class="token-value">
                <el-input
                  :value="formData.shareToken"
                  readonly
                  placeholder="Token 将在这里显示"
                  style="flex: 1"
                >
                  <template #append>
                    <el-button
                      @click="copyToClipboard(formData.shareToken, 'Token')"
                      :disabled="!formData.shareToken"
                      title="复制 Token (Ctrl+C)"
                    >
                      <el-icon><document-copy /></el-icon>
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>

            <div class="token-item">
              <label>分享链接:</label>
              <div class="token-value">
                <div class="share-url-container">
                  <el-link
                    v-if="formData.shareUrl"
                    :href="formData.shareUrl"
                    target="_blank"
                    type="primary"
                    class="share-url-link"
                    :title="formData.shareUrl"
                  >
                    {{ formData.shareUrl }}
                  </el-link>
                  <span v-else class="share-url-placeholder">
                    分享链接将在这里显示
                  </span>
                  <el-button
                    @click="copyToClipboard(formData.shareUrl, '分享链接')"
                    :disabled="!formData.shareUrl"
                    title="复制分享链接"
                    size="small"
                    class="copy-button"
                  >
                    <el-icon><document-copy /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- Token 操作按钮 -->
          <div class="token-actions">
            <el-button
              type="warning"
              @click="handleRefreshToken"
              :loading="refreshingToken"
              :disabled="!formData.shareId"
            >
              <el-icon><refresh /></el-icon>
              刷新 Token
            </el-button>
            <div class="form-tip">
              刷新后旧的 Token 将失效，请及时更新使用新的 Token 和链接
            </div>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <!-- 公告预览抽屉 -->
    <el-drawer
      v-model="showAnnouncementPreview"
      title="公告预览"
      direction="rtl"
      size="500px"
      class="announcement-preview-drawer"
    >
      <div class="preview-content">
        <!-- 预览标题 -->
        <div v-if="announcementData.title" class="preview-title">
          {{ announcementData.title }}
        </div>

        <!-- 预览图片轮播 -->
        <div v-if="announcementData.images && announcementData.images.length > 0" class="preview-images-carousel">
          <el-carousel :autoplay="false" class="carousel">
            <el-carousel-item v-for="(image, index) in announcementData.images" :key="index">
              <div class="carousel-item">
                <img :src="image.base64" :alt="`Image ${index + 1}`" />
                <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
              </div>
            </el-carousel-item>
          </el-carousel>
          <div class="carousel-info">
            {{ previewImageIndex + 1 }} / {{ announcementData.images.length }}
          </div>
        </div>

        <!-- 预览文本内容 -->
        <div v-if="announcementData.content" class="preview-text">
          {{ announcementData.content }}
        </div>

        <!-- 空状态提示 -->
        <div v-if="!announcementData.title && !announcementData.content && (!announcementData.images || announcementData.images.length === 0)" class="preview-empty">
          <el-empty description="暂无公告内容" />
        </div>
      </div>
    </el-drawer>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 公告预览抽屉 -->
  <el-drawer
    v-model="showAnnouncementPreview"
    title="公告预览"
    direction="rtl"
    size="500px"
    class="announcement-preview-drawer"
  >
    <div class="preview-content">
      <!-- 预览标题 -->
      <div v-if="announcementData.title" class="preview-title">
        {{ announcementData.title }}
      </div>

      <!-- 预览图片轮播 -->
      <div v-if="announcementData.images && announcementData.images.length > 0" class="preview-images-carousel">
        <el-carousel :autoplay="false" class="carousel">
          <el-carousel-item v-for="(image, index) in announcementData.images" :key="index">
            <div class="carousel-item">
              <img :src="image.base64" :alt="`Image ${index + 1}`" />
              <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
            </div>
          </el-carousel-item>
        </el-carousel>
        <div class="carousel-info">
          {{ previewImageIndex + 1 }} / {{ announcementData.images.length }}
        </div>
      </div>

      <!-- 预览文本内容 -->
      <div v-if="announcementData.content" class="preview-text">
        {{ announcementData.content }}
      </div>

      <!-- 空状态提示 -->
      <div v-if="!announcementData.title && !announcementData.content && (!announcementData.images || announcementData.images.length === 0)" class="preview-empty">
        <el-empty description="暂无公告内容" />
      </div>
    </div>
  </el-drawer>

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

// 响应式数据
const visible = ref(false)
const saving = ref(false)
const refreshingToken = ref(false)
const formRef = ref()

// 自动刷新相关
const customAutoRefreshInterval = ref(null)
const autoRefreshIntervalError = ref('')

// 域名选择相关
const domainSelectionMode = ref('auto')
const availableDomains = ref([
  { value: 'example.com', label: 'example.com' },
  { value: 'example2.com', label: 'example2.com' },
  { value: 'example3.com', label: 'example3.com' },
  { value: 'example4.com', label: 'example4.com' }
])

// 模板相关
const availableTemplates = ref([])

// 表单数据
const formData = reactive({
  shareId: '',
  shareName: '',
  expireTime: '',
  otpLimitDaily: 100,
  otpLimitEnabled: true,
  rateLimitEnabled: true, // 频率限制开关，默认启用
  rateLimitPerSecond: 5,
  autoRecoverySeconds: 60,
  keywordFilter: '',
  verificationCodeLimit: 100,
  verificationCodeLimitEnabled: true,
  // 新增：邮件数量限制和自动刷新功能
  latestEmailCount: null,
  autoRefreshEnabled: false,
  autoRefreshInterval: 30,
  // 新增：冷却功能配置
  cooldownEnabled: true,
  cooldownSeconds: 10,
  // 新增：人机验证功能
  enableCaptcha: false,
  // 新增：公告弹窗功能
  announcementContent: '',
  // 新增：TOKEN 相关字段
  shareToken: '',
  shareUrl: '',
  // 需求 4：授权邮箱
  shareType: 1,
  authorizedEmails: [],
  // 新增：过滤模式和模板相关字段
  filterMode: 1, // 1: 关键词过滤, 2: 模板匹配
  templateId: '',
  showFullEmail: true,
  // 新增：域名选择
  shareDomain: ''
})

// 需求 4：新增授权邮箱输入框
const newAuthorizedEmail = ref('')

// 公告数据（支持图片）
const announcementData = reactive({
  title: '',
  content: '',
  images: []
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
    // 解析授权邮箱
    let authorizedEmails = []
    if (props.shareData.authorizedEmails) {
      try {
        const parsed = typeof props.shareData.authorizedEmails === 'string'
          ? JSON.parse(props.shareData.authorizedEmails)
          : props.shareData.authorizedEmails
        authorizedEmails = Array.isArray(parsed) ? parsed : []
      } catch (error) {
        console.error('解析授权邮箱失败:', error)
      }
    }

    // 填充表单数据
    Object.assign(formData, {
      shareId: props.shareData.shareId,
      shareName: props.shareData.shareName || '',
      expireTime: props.shareData.expireTime || '',
      otpLimitDaily: props.shareData.otpLimitDaily || 100,
      otpLimitEnabled: props.shareData.otpLimitEnabled !== undefined ? props.shareData.otpLimitEnabled === 1 : true,
      // 修复: 只有当值为0时才认为是禁用状态
      rateLimitEnabled: props.shareData.rateLimitPerSecond !== 0,
      rateLimitPerSecond: props.shareData.rateLimitPerSecond || 5,
      autoRecoverySeconds: props.shareData.autoRecoverySeconds || 60,
      keywordFilter: props.shareData.keywordFilter || '',
      verificationCodeLimit: props.shareData.verificationCodeLimit || 100,
      verificationCodeLimitEnabled: props.shareData.verificationCodeLimitEnabled !== undefined ? props.shareData.verificationCodeLimitEnabled === 1 : true,
      // 新增字段填充
      latestEmailCount: props.shareData.latestEmailCount || null,
      autoRefreshEnabled: props.shareData.autoRefreshEnabled === 1,
      autoRefreshInterval: props.shareData.autoRefreshInterval || 30,
      // 冷却配置字段填充
      cooldownEnabled: props.shareData.cooldownEnabled !== undefined ? props.shareData.cooldownEnabled === 1 : true,
      cooldownSeconds: props.shareData.cooldownSeconds || 10,
      // 人机验证字段填充
      enableCaptcha: props.shareData.enableCaptcha !== undefined ? props.shareData.enableCaptcha === 1 : false,
      // 公告弹窗功能字段填充
      announcementContent: props.shareData.announcementContent || '',
      // TOKEN 相关字段填充
      shareToken: props.shareData.shareToken || '',
      shareUrl: props.shareData.shareUrl || '',
      // 需求 4：授权邮箱填充
      shareType: props.shareData.shareType || 1,
      authorizedEmails: authorizedEmails,
      // 过滤模式和模板字段填充
      filterMode: props.shareData.filterMode || 1,
      templateId: props.shareData.templateId || '',
      showFullEmail: props.shareData.showFullEmail !== undefined ? props.shareData.showFullEmail === 1 : true,
      // 域名选择字段填充
      shareDomain: props.shareData.shareDomain || ''
    })

    // 清空新邮箱输入框
    newAuthorizedEmail.value = ''

    // 解析公告数据
    parseAnnouncementContent(props.shareData.announcementContent)
  }
})

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
        return
      }
    }
  } catch (error) {
    console.error('解析公告JSON失败:', error)
  }

  // 如果不是JSON格式，当作纯文本处理
  announcementData.content = content
}

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 处理自动刷新间隔变更
const handleAutoRefreshIntervalChange = () => {
  autoRefreshIntervalError.value = ''
  if (formData.autoRefreshInterval === 0) {
    // 选择自定义，清空错误信息
    customAutoRefreshInterval.value = null
  }
}

// 验证自定义自动刷新间隔
const validateCustomAutoRefreshInterval = () => {
  autoRefreshIntervalError.value = ''

  if (customAutoRefreshInterval.value === null || customAutoRefreshInterval.value === '') {
    autoRefreshIntervalError.value = '请输入刷新间隔'
    return false
  }

  const value = parseInt(customAutoRefreshInterval.value)

  if (isNaN(value)) {
    autoRefreshIntervalError.value = '请输入有效的数字'
    return false
  }

  if (value < 1 || value > 3600) {
    autoRefreshIntervalError.value = '刷新间隔必须在1-3600秒之间'
    return false
  }

  return true
}

// 获取最终的自动刷新间隔
const getFinalAutoRefreshInterval = () => {
  if (formData.autoRefreshInterval === 0) {
    // 自定义模式
    if (!validateCustomAutoRefreshInterval()) {
      throw new Error(autoRefreshIntervalError.value)
    }
    return parseInt(customAutoRefreshInterval.value)
  }
  return formData.autoRefreshInterval
}

// 过滤模式变更处理
const onFilterModeChange = () => {
  // 当切换到模板匹配时，清空关键词过滤
  if (formData.filterMode === 2) {
    formData.keywordFilter = ''
  }
}

// 模板变更处理
const onTemplateChange = () => {
  // 模板变更时的处理逻辑
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

// 关闭对话框
const handleClose = () => {
  visible.value = false
  // 重置表单
  nextTick(() => {
    formRef.value?.resetFields()
  })
}

// 保存设置
const handleSave = async () => {
  try {
    // 表单验证
    await formRef.value.validate()

    // 获取最终的自动刷新间隔（支持自定义）
    let finalAutoRefreshInterval = formData.autoRefreshInterval
    if (formData.autoRefreshEnabled && formData.autoRefreshInterval === 0) {
      try {
        finalAutoRefreshInterval = getFinalAutoRefreshInterval()
      } catch (error) {
        ElMessage.error(error.message)
        return
      }
    }

    saving.value = true

    // 分别调用不同的API更新各项设置
    const promises = []

    // 更新分享名称
    if (formData.shareName !== props.shareData.shareName) {
      promises.push(updateShareName(formData.shareId, formData.shareName))
    }

    // 更新过期时间
    if (formData.expireTime !== props.shareData.expireTime) {
      promises.push(updateShareExpireTime(formData.shareId, formData.expireTime))
    }

    // 更新每日限额（仅当数值发生变化时）
    if (formData.otpLimitDaily !== props.shareData.otpLimitDaily) {
      promises.push(updateShareLimit(formData.shareId, formData.otpLimitDaily))
    }

    // 问题 1 修复：计算授权邮箱是否发生变化
    let authorizedEmailsChanged = false
    if (formData.shareType === 2) {
      // 比较授权邮箱列表是否发生变化
      const currentEmails = formData.authorizedEmails || []
      let originalEmails = []
      if (props.shareData.authorizedEmails) {
        try {
          const parsed = typeof props.shareData.authorizedEmails === 'string'
            ? JSON.parse(props.shareData.authorizedEmails)
            : props.shareData.authorizedEmails
          originalEmails = Array.isArray(parsed) ? parsed : []
        } catch (error) {
          console.error('解析原始授权邮箱失败:', error)
        }
      }
      // 检查邮箱列表是否发生变化（使用 [...array] 创建副本，避免修改原数组）
      authorizedEmailsChanged = JSON.stringify([...currentEmails].sort()) !== JSON.stringify([...originalEmails].sort())
    }

    // 更新高级设置（频率限制、关键词过滤、显示数量限制、邮件数量限制、自动刷新、过滤模式、模板、域名）
    const needsAdvancedUpdate =
      (formData.rateLimitEnabled ? formData.rateLimitPerSecond : 0) !== props.shareData.rateLimitPerSecond ||
      formData.autoRecoverySeconds !== props.shareData.autoRecoverySeconds ||
      formData.keywordFilter !== props.shareData.keywordFilter ||
      formData.verificationCodeLimit !== props.shareData.verificationCodeLimit ||
      (formData.verificationCodeLimitEnabled ? 1 : 0) !== props.shareData.verificationCodeLimitEnabled ||
      (formData.otpLimitEnabled ? 1 : 0) !== props.shareData.otpLimitEnabled ||
      formData.latestEmailCount !== props.shareData.latestEmailCount ||
      (formData.autoRefreshEnabled ? 1 : 0) !== props.shareData.autoRefreshEnabled ||
      finalAutoRefreshInterval !== props.shareData.autoRefreshInterval ||
      (formData.cooldownEnabled ? 1 : 0) !== props.shareData.cooldownEnabled ||
      formData.cooldownSeconds !== props.shareData.cooldownSeconds ||
      (formData.enableCaptcha ? 1 : 0) !== props.shareData.enableCaptcha ||
      formData.announcementContent !== (props.shareData.announcementContent || '') ||
      formData.filterMode !== props.shareData.filterMode ||
      formData.templateId !== (props.shareData.templateId || '') ||
      (formData.showFullEmail ? 1 : 0) !== props.shareData.showFullEmail ||
      formData.shareDomain !== (props.shareData.shareDomain || '') ||
      authorizedEmailsChanged

    if (needsAdvancedUpdate) {
      // 如果API不存在，则提示用户
      if (typeof updateShareAdvancedSettings === 'function') {
        const advancedSettings = {
          rateLimitPerSecond: formData.rateLimitEnabled ? parseInt(formData.rateLimitPerSecond) : 0,
          autoRecoverySeconds: parseInt(formData.autoRecoverySeconds) || 60,
          keywordFilter: formData.keywordFilter,
          verificationCodeLimit: parseInt(formData.verificationCodeLimit) || 100,
          verificationCodeLimitEnabled: formData.verificationCodeLimitEnabled ? 1 : 0,
          otpLimitEnabled: formData.otpLimitEnabled ? 1 : 0,
          // 新增字段
          latestEmailCount: formData.latestEmailCount ? parseInt(formData.latestEmailCount) : null,
          autoRefreshEnabled: formData.autoRefreshEnabled ? 1 : 0,
          autoRefreshInterval: finalAutoRefreshInterval,
          // 冷却配置字段
          cooldownEnabled: formData.cooldownEnabled ? 1 : 0,
          cooldownSeconds: parseInt(formData.cooldownSeconds) || 10,
          // 人机验证字段
          enableCaptcha: formData.enableCaptcha ? 1 : 0,
          // 公告弹窗功能（支持图片）
          announcementContent: buildAnnouncementContent(),
          // 过滤模式和模板字段
          filterMode: formData.filterMode,
          templateId: formData.templateId || null,
          showFullEmail: formData.showFullEmail ? 1 : 0,
          // 域名选择字段
          shareDomain: formData.shareDomain || null
        }

        // 问题 1 修复：添加授权邮箱到高级设置（仅当发生变化时）
        if (authorizedEmailsChanged) {
          advancedSettings.authorizedEmails = formData.authorizedEmails
        }

        promises.push(updateShareAdvancedSettings(formData.shareId, advancedSettings))
      } else {
        ElMessage.warning('高级设置功能暂未支持修改，请联系管理员')
      }
    }

    // 等待所有更新完成
    await Promise.all(promises)

    ElMessage.success('高级设置更新成功')
    emit('updated')
    handleClose()

  } catch (error) {
    console.error('更新高级设置失败:', error)
    ElMessage.error('更新失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// 刷新 Token
const handleRefreshToken = async () => {
  if (!formData.shareId) {
    ElMessage.error('分享记录不存在')
    return
  }

  try {
    refreshingToken.value = true

    const response = await refreshShareToken(formData.shareId)
    // 正确处理API响应结构
    const result = response.data || response

    // 验证响应数据有效性
    if (!result.shareToken) {
      throw new Error('刷新Token失败：返回数据无效')
    }

    // 更新表单数据中的 Token 信息
    formData.shareToken = result.shareToken
    formData.shareUrl = result.shareUrl

    // 同时更新targetEmail确保数据一致性
    if (result.targetEmail) {
      formData.targetEmail = result.targetEmail
    }

    ElMessage.success('Token 刷新成功')

    // 通知父组件更新
    emit('updated')

  } catch (error) {
    console.error('刷新 Token 失败:', error)
    ElMessage.error('刷新 Token 失败: ' + (error.message || '未知错误'))
  } finally {
    refreshingToken.value = false
  }
}

// 需求 4：添加授权邮箱
const handleAddAuthorizedEmail = () => {
  const email = newAuthorizedEmail.value.trim()

  if (!email) {
    ElMessage.warning('请输入邮箱地址')
    return
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    ElMessage.error('请输入有效的邮箱地址')
    return
  }

  // 检查邮箱长度
  if (email.length > 254) {
    ElMessage.error('邮箱地址过长')
    return
  }

  // 检查是否已存在（大小写不敏感）
  const normalizedEmail = email.toLowerCase()
  const exists = formData.authorizedEmails.some(
    e => e.toLowerCase() === normalizedEmail
  )

  if (exists) {
    ElMessage.warning('该邮箱已添加')
    return
  }

  // 添加邮箱
  formData.authorizedEmails.push(email)
  newAuthorizedEmail.value = ''
  ElMessage.success('邮箱已添加')
}

// 需求 4：移除授权邮箱
const handleRemoveAuthorizedEmail = (index) => {
  formData.authorizedEmails.splice(index, 1)
  ElMessage.success('邮箱已移除')
}

// 复制到剪贴板
const copyToClipboard = async (text, label) => {
  if (!text) {
    ElMessage.warning(`${label} 为空，无法复制`)
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`${label} 已复制到剪贴板`)
  } catch (error) {
    console.error('复制失败:', error)
    // 降级方案：使用传统的复制方法
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      ElMessage.success(`${label} 已复制到剪贴板`)
    } catch (fallbackError) {
      console.error('降级复制也失败:', fallbackError)
      ElMessage.error('复制失败，请手动复制')
    }
  }
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.unit-text {
  margin-left: 8px;
  color: #606266;
  font-size: 14px;
}

.rate-limit-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rate-limit-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rate-limit-item label {
  min-width: 80px;
  font-size: 14px;
  color: #606266;
}

.limit-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-footer {
  text-align: right;
}

/* TOKEN 管理样式 */
.token-management {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 16px;
  background-color: #fafafa;
}

.token-display {
  margin-bottom: 16px;
}

.token-item {
  margin-bottom: 12px;
}

.token-item:last-child {
  margin-bottom: 0;
}

.token-item label {
  display: block;
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
  font-weight: 500;
}

.token-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-actions {
  border-top: 1px solid #e4e7ed;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.token-actions .form-tip {
  margin-top: 0;
  color: #f56c6c;
  font-weight: 500;
}

/* 分享链接容器样式 */
.share-url-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #ffffff;
  min-height: 32px;
}

.share-url-link {
  flex: 1;
  word-break: break-all;
  text-decoration: none;
  font-size: 14px;
}

.share-url-link:hover {
  text-decoration: underline;
}

.share-url-placeholder {
  flex: 1;
  color: #c0c4cc;
  font-size: 14px;
}

.copy-button {
  flex-shrink: 0;
}

/* 需求 4：授权邮箱编辑器样式 */
.authorized-emails-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.email-input-group {
  display: flex;
  gap: 8px;

  :deep(.el-input) {
    flex: 1;
  }

  .el-button {
    min-width: 80px;
  }
}

.email-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .email-tag {
    cursor: pointer;
    user-select: none;
  }
}

.announcement-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .announcement-section {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .section-label {
      font-weight: 500;
      font-size: 14px;
      color: #333;
    }
  }

  .upload-area {
    border: 2px dashed #dcdfe6;
    border-radius: 4px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background-color: #fafafa;

    &:hover {
      border-color: #409eff;
      background-color: #f5f7fa;
    }

    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .upload-icon {
        font-size: 32px;
        color: #909399;
      }

      .upload-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        div {
          color: #606266;
          font-size: 14px;
        }
      }

      .upload-hint {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }

  .images-list {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .image-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      background-color: #fafafa;

      .image-preview {
        flex-shrink: 0;
        width: 80px;
        height: 80px;
        border-radius: 4px;
        overflow: hidden;
        background-color: #fff;
        border: 1px solid #ebeef5;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .image-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .image-actions {
        flex-shrink: 0;
        display: flex;
        gap: 4px;
        align-items: center;
      }
    }
  }
}

/* 公告编辑头部 */
.announcement-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

/* 公告预览抽屉 */
.announcement-preview-drawer {
  :deep(.el-drawer__header) {
    border-bottom: 1px solid #ebeef5;
    margin-bottom: 20px;
  }
}

.preview-content {
  padding: 0 20px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
  max-height: calc(100vh - 120px);
  overflow-y: auto;

  .preview-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    color: #1f2937;
    padding-bottom: 12px;
    border-bottom: 2px solid #667eea;
  }

  .preview-images-carousel {
    margin-bottom: 20px;

    .carousel {
      border-radius: 8px;
      overflow: hidden;
      background: #f5f7fa;

      .carousel-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        background: #f5f7fa;

        img {
          max-width: 100%;
          max-height: 400px;
          object-fit: contain;
          border-radius: 4px;
        }

        .image-caption {
          margin-top: 12px;
          font-size: 14px;
          color: #606266;
          text-align: center;
          padding: 0 12px;
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

  .preview-text {
    white-space: pre-wrap;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    border-left: 3px solid #409eff;
    font-size: 14px;
    line-height: 1.8;
  }

  .preview-empty {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
  }
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
    gap: 10px;
  }

  .announcement-section {
    gap: 4px;
  }

  .section-label {
    font-size: 12px;
  }

  .upload-area {
    padding: 20px 12px;
    border-radius: 4px;
  }

  .upload-icon {
    font-size: 24px;
  }

  .upload-text {
    font-size: 12px;
    gap: 2px;
  }

  .upload-hint {
    font-size: 10px;
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
    padding: 4px 6px;
  }

  /* 预览抽屉移动端优化 */
  .announcement-preview-drawer {
    :deep(.el-drawer) {
      width: 100% !important;
    }

    :deep(.el-drawer__body) {
      padding: 12px;
    }
  }

  .preview-content {
    padding: 12px;
    max-height: calc(100vh - 150px);
    font-size: 13px;
  }

  .preview-title {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .preview-images-carousel {
    margin-bottom: 12px;
  }

  .carousel-item {
    min-height: 200px;

    img {
      max-height: 250px;
    }

    .image-caption {
      margin-top: 6px;
      font-size: 12px;
      padding: 0 6px;
    }
  }

  .carousel-info {
    font-size: 10px;
    margin-top: 4px;
  }

  .preview-text {
    padding: 8px;
    font-size: 12px;
    line-height: 1.5;
  }

  /* 表单字段移动端优化 */
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
  }

  :deep(.el-input__wrapper) {
    padding: 4px 8px;
  }

  :deep(.el-input) {
    font-size: 13px;
  }

  :deep(.el-textarea__inner) {
    font-size: 13px;
    padding: 6px 8px;
  }

  :deep(.el-button) {
    padding: 6px 12px;
    font-size: 13px;
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
    padding: 16px 8px;
  }

  .image-preview {
    width: 40px;
    height: 40px;
  }

  .preview-content {
    padding: 8px;
    font-size: 12px;
  }

  .preview-title {
    font-size: 14px;
  }

  .carousel-item {
    min-height: 150px;

    img {
      max-height: 200px;
    }
  }
}
</style>