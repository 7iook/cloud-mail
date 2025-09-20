<template>
  <el-dialog
    v-model="visible"
    :title="email?.subject || '(无主题)'"
    width="70%"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="true"
    class="email-preview-dialog"
    @closed="handleClosed"
  >
    <div v-if="email" class="email-preview-content">
      <!-- 邮件基本信息 -->
      <div class="email-info-section">
        <div class="email-info-row">
          <span class="info-label">发件人：</span>
          <span class="info-value">
            <span class="sender-name">{{ email.name }}</span>
            <span class="sender-email">&lt;{{ email.sendEmail }}&gt;</span>
          </span>
        </div>
        
        <div class="email-info-row">
          <span class="info-label">收件人：</span>
          <span class="info-value">{{ formatRecipient(email.recipient) }}</span>
        </div>
        
        <div class="email-info-row">
          <span class="info-label">时间：</span>
          <span class="info-value">{{ formatDetailDate(email.createTime) }}</span>
        </div>
        
        <!-- 邮件状态提示 -->
        <div v-if="email.status === 3" class="status-alert error">
          <Icon icon="bi:exclamation-triangle-fill" width="16" height="16" />
          <span>邮件发送失败</span>
        </div>
        <div v-if="email.status === 4" class="status-alert warning">
          <Icon icon="bi:exclamation-triangle-fill" width="16" height="16" />
          <span>邮件被投诉</span>
        </div>
        <div v-if="email.status === 5" class="status-alert warning">
          <Icon icon="bi:clock-fill" width="16" height="16" />
          <span>邮件发送延迟</span>
        </div>
      </div>
      
      <!-- 邮件内容 -->
      <div class="email-content-section">
        <el-scrollbar class="content-scrollbar" max-height="400px">
          <!-- HTML内容 -->
          <div v-if="email.content" class="html-content" v-html="formatEmailContent(email.content)" @click="handleContentClick"></div>
          <!-- 纯文本内容 -->
          <pre v-else class="text-content" v-html="formatEmailContent(email.text || '(无内容)')" @click="handleContentClick"></pre>
        </el-scrollbar>
      </div>
      
      <!-- 附件信息 -->
      <div v-if="email.attList && email.attList.length > 0" class="attachments-section">
        <div class="attachments-header">
          <Icon icon="bi:paperclip" width="16" height="16" />
          <span>附件 ({{ email.attList.length }})</span>
        </div>
        <div class="attachments-list">
          <div v-for="att in email.attList" :key="att.attId" class="attachment-item">
            <Icon icon="bi:file-earmark" width="16" height="16" />
            <span class="attachment-name">{{ att.filename }}</span>
            <span class="attachment-size">{{ formatBytes(att.size) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" @click="handleViewDetails">查看详情</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { formatDetailDate } from '@/utils/day.js';
import { highlightEmailContent, extractHighlightValue, isHighlightElement } from '@/utils/email-highlight-utils.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  email: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'view-details', 'closed']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 处理对话框关闭
function handleClose() {
  visible.value = false;
}

function handleClosed() {
  emit('closed');
}

// 查看详情
function handleViewDetails() {
  emit('view-details', props.email);
  handleClose();
}

// 格式化收件人
function formatRecipient(recipient) {
  if (!recipient) return '';
  try {
    const recipients = JSON.parse(recipient);
    if (Array.isArray(recipients)) {
      return recipients.map(r => r.email || r).join(', ');
    }
    return recipient;
  } catch {
    return recipient;
  }
}

// 格式化邮件内容
function formatEmailContent(content) {
  if (!content) return '';

  // 简单的HTML清理，移除危险标签
  const cleanedContent = content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '');

  // 应用高亮处理
  return highlightEmailContent(cleanedContent, {
    highlightEmails: true,
    highlightCodes: true
  });
}

// 处理内容点击事件
function handleContentClick(event) {
  const clickedElement = event.target;

  // 检查是否点击了高亮元素
  if (isHighlightElement(clickedElement)) {
    event.stopPropagation();
    const value = extractHighlightValue(clickedElement);
    const type = clickedElement.getAttribute('data-type') ||
                 clickedElement.closest('.email-highlight, .code-highlight')?.getAttribute('data-type');

    if (value) {
      // 根据类型显示不同的成功消息
      let successMessage;
      if (type === 'email') {
        successMessage = `📧 已复制邮箱: ${value}`;
      } else if (type === 'code') {
        successMessage = `🔐 已复制验证码: ${value}`;
      } else {
        successMessage = `📋 已复制: ${value}`;
      }

      // 复制高亮内容到剪贴板
      copyTextWithFeedback(value, {
        successMessage,
        errorMessage: '❌ 复制失败，请重试',
        duration: 3000
      });
    }
  }
}

// 格式化文件大小
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>

<style scoped>
.email-preview-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.email-info-section {
  border-bottom: 1px solid var(--el-border-color-light);
  padding-bottom: 16px;
}

.email-info-row {
  display: flex;
  margin-bottom: 8px;
  align-items: flex-start;
}

.info-label {
  font-weight: 600;
  color: var(--el-text-color-regular);
  min-width: 80px;
  flex-shrink: 0;
}

.info-value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.sender-name {
  font-weight: 500;
  margin-right: 8px;
}

.sender-email {
  color: var(--el-text-color-regular);
}

.status-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 12px;
  font-size: 14px;
}

.status-alert.error {
  background-color: var(--el-color-error-light-9);
  color: var(--el-color-error);
  border: 1px solid var(--el-color-error-light-7);
}

.status-alert.warning {
  background-color: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-7);
}

.email-content-section {
  flex: 1;
}

.content-scrollbar {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.html-content {
  padding: 16px;
  line-height: 1.6;
  word-wrap: break-word;
}

.text-content {
  padding: 16px;
  margin: 0;
  font-family: inherit;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.attachments-section {
  border-top: 1px solid var(--el-border-color-light);
  padding-top: 16px;
}

.attachments-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
}

.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.attachment-name {
  flex: 1;
  color: var(--el-text-color-primary);
}

.attachment-size {
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .html-content,
  .text-content {
    background-color: var(--el-bg-color-page);
  }
}
</style>

<style>
/* 全局样式，用于调整对话框 */
.email-preview-dialog .el-dialog {
  margin-top: 5vh !important;
  max-height: 85vh;
}

.email-preview-dialog .el-dialog__body {
  max-height: 60vh;
  overflow: hidden;
}
</style>
