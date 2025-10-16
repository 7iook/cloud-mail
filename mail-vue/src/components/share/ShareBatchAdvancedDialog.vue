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
  captcha: false
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
  enableCaptcha: false
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
  })
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
</style>
