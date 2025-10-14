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
        <div class="rate-limit-group">
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
            <label>每分钟限制：</label>
            <el-input-number
              v-model="formData.rateLimitPerMinute"
              :min="1"
              :max="1000"
              :step="1"
              style="width: 120px"
            />
            <span class="unit-text">次/分钟</span>
          </div>
        </div>
        <div class="form-tip">控制访问频率，防止滥用</div>
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
import { 
  updateShareName, 
  updateShareExpireTime, 
  updateShareLimit,
  updateShareAdvancedSettings 
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
const formRef = ref()

// 表单数据
const formData = reactive({
  shareId: '',
  shareName: '',
  expireTime: '',
  otpLimitDaily: 100,
  otpLimitEnabled: true,
  rateLimitPerSecond: 5,
  rateLimitPerMinute: 60,
  keywordFilter: '',
  verificationCodeLimit: 100,
  verificationCodeLimitEnabled: true
})

// 表单验证规则
const rules = {
  shareName: [
    { required: true, message: '请输入分享名称', trigger: 'blur' },
    { min: 1, max: 50, message: '分享名称长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  otpLimitDaily: [
    { required: true, message: '请输入每日限额', trigger: 'blur' },
    { type: 'number', min: 1, max: 10000, message: '每日限额必须在 1 到 10000 之间', trigger: 'blur' }
  ]
}

// 监听显示状态
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal && props.shareData) {
    // 填充表单数据
    Object.assign(formData, {
      shareId: props.shareData.shareId,
      shareName: props.shareData.shareName || '',
      expireTime: props.shareData.expireTime || '',
      otpLimitDaily: props.shareData.otpLimitDaily || 100,
      otpLimitEnabled: props.shareData.otpLimitEnabled !== undefined ? props.shareData.otpLimitEnabled === 1 : true,
      rateLimitPerSecond: props.shareData.rateLimitPerSecond || 5,
      rateLimitPerMinute: props.shareData.rateLimitPerMinute || 60,
      keywordFilter: props.shareData.keywordFilter || '',
      verificationCodeLimit: props.shareData.verificationCodeLimit || 100,
      verificationCodeLimitEnabled: props.shareData.verificationCodeLimitEnabled !== undefined ? props.shareData.verificationCodeLimitEnabled === 1 : true
    })
  }
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
  })
}

// 保存设置
const handleSave = async () => {
  try {
    // 表单验证
    await formRef.value.validate()
    
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
    
    // 更新每日限额和访问限制开关
    if (formData.otpLimitDaily !== props.shareData.otpLimitDaily ||
        (formData.otpLimitEnabled ? 1 : 0) !== props.shareData.otpLimitEnabled) {
      promises.push(updateShareLimit(formData.shareId, formData.otpLimitDaily))
    }

    // 更新高级设置（频率限制、关键词过滤、显示数量限制）
    const needsAdvancedUpdate =
      formData.rateLimitPerSecond !== props.shareData.rateLimitPerSecond ||
      formData.rateLimitPerMinute !== props.shareData.rateLimitPerMinute ||
      formData.keywordFilter !== props.shareData.keywordFilter ||
      formData.verificationCodeLimit !== props.shareData.verificationCodeLimit ||
      (formData.verificationCodeLimitEnabled ? 1 : 0) !== props.shareData.verificationCodeLimitEnabled ||
      (formData.otpLimitEnabled ? 1 : 0) !== props.shareData.otpLimitEnabled

    if (needsAdvancedUpdate) {
      // 如果API不存在，则提示用户
      if (typeof updateShareAdvancedSettings === 'function') {
        promises.push(updateShareAdvancedSettings(formData.shareId, {
          rateLimitPerSecond: formData.rateLimitPerSecond,
          rateLimitPerMinute: formData.rateLimitPerMinute,
          keywordFilter: formData.keywordFilter,
          verificationCodeLimit: formData.verificationCodeLimit,
          verificationCodeLimitEnabled: formData.verificationCodeLimitEnabled ? 1 : 0,
          otpLimitEnabled: formData.otpLimitEnabled ? 1 : 0
        }))
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
</style>