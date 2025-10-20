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

      <!-- 关键词过滤 -->
      <el-form-item label="关键词过滤" prop="keywordFilter">
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

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, Refresh } from '@element-plus/icons-vue'
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
  // 新增：TOKEN 相关字段
  shareToken: '',
  shareUrl: '',
  // 需求 4：授权邮箱
  shareType: 1,
  authorizedEmails: []
})

// 需求 4：新增授权邮箱输入框
const newAuthorizedEmail = ref('')

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
      // TOKEN 相关字段填充
      shareToken: props.shareData.shareToken || '',
      shareUrl: props.shareData.shareUrl || '',
      // 需求 4：授权邮箱填充
      shareType: props.shareData.shareType || 1,
      authorizedEmails: authorizedEmails
    })

    // 清空新邮箱输入框
    newAuthorizedEmail.value = ''
  }
})

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

    // 更新高级设置（频率限制、关键词过滤、显示数量限制、邮件数量限制、自动刷新）
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
          enableCaptcha: formData.enableCaptcha ? 1 : 0
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
</style>