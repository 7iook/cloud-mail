<template>
  <div class="email-detail-pane">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="8" animated />
    </div>
    
    <!-- 无选中邮件 -->
    <div v-else-if="!selectedEmail" class="empty-state">
      <el-empty description="请选择一封邮件查看详情" />
    </div>
    
    <!-- 邮件详情内容 -->
    <div v-else class="email-content">
      <!-- 邮件头部 -->
      <div class="email-header">
        <div class="header-actions">
          <el-button 
            type="text" 
            icon="Close" 
            size="small"
            @click="closeDetailPane"
            class="close-btn"
          />
        </div>
        
        <div class="email-meta">
          <h3 class="email-subject">{{ selectedEmail.subject || '(无主题)' }}</h3>
          
          <div class="email-info">
            <div class="sender-info">
              <span class="label">发件人：</span>
              <span class="value">{{ selectedEmail.fromEmail || selectedEmail.userEmail }}</span>
            </div>
            
            <div class="recipient-info">
              <span class="label">收件人：</span>
              <span class="value">{{ selectedEmail.toEmail || '未知' }}</span>
            </div>
            
            <div class="time-info">
              <span class="label">时间：</span>
              <span class="value">{{ formatTime(selectedEmail.createTime) }}</span>
            </div>
            
            <div v-if="selectedEmail.attachments?.length" class="attachment-info">
              <span class="label">附件：</span>
              <span class="value">{{ selectedEmail.attachments.length }} 个附件</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 邮件正文 -->
      <div class="email-body">
        <div class="content-wrapper">
          <div 
            v-if="selectedEmail.content" 
            class="email-text"
            v-html="formatEmailContent(selectedEmail.content)"
          />
          <div v-else class="no-content">
            <el-empty description="邮件内容为空" />
          </div>
        </div>
      </div>
      
      <!-- 附件列表 -->
      <div v-if="selectedEmail.attachments?.length" class="attachments-section">
        <h4>附件 ({{ selectedEmail.attachments.length }})</h4>
        <div class="attachment-list">
          <div 
            v-for="(attachment, index) in selectedEmail.attachments" 
            :key="index"
            class="attachment-item"
          >
            <el-icon><Document /></el-icon>
            <span class="attachment-name">{{ attachment.name || `附件${index + 1}` }}</span>
            <span class="attachment-size">{{ formatFileSize(attachment.size) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useEmailStore } from '@/store/email'
import { Document } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

const emailStore = useEmailStore()
const loading = ref(false)

// 选中的邮件
const selectedEmail = computed(() => emailStore.splitLayout?.selectedEmail)

// 关闭详情面板
const closeDetailPane = () => {
  if (emailStore.splitLayout) {
    emailStore.splitLayout.showDetailPane = false
    emailStore.splitLayout.selectedEmail = null
  }
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '未知时间'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// 格式化邮件内容
const formatEmailContent = (content) => {
  if (!content) return ''
  
  // 简单的HTML清理和格式化
  return content
    .replace(/\n/g, '<br>')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
}

// 监听选中邮件变化，模拟加载过程
watch(selectedEmail, (newEmail) => {
  if (newEmail) {
    loading.value = true
    setTimeout(() => {
      loading.value = false
    }, 300) // 模拟加载延迟
  }
}, { immediate: true })
</script>

<style scoped>
.email-detail-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e4e7ed;
}

.loading-container,
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.email-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.email-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.close-btn {
  color: #909399;
}

.close-btn:hover {
  color: #409eff;
}

.email-subject {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}

.email-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.email-info > div {
  display: flex;
  align-items: center;
}

.label {
  font-weight: 500;
  color: #606266;
  min-width: 60px;
  margin-right: 8px;
}

.value {
  color: #303133;
  flex: 1;
}

.email-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.content-wrapper {
  max-width: 100%;
}

.email-text {
  line-height: 1.6;
  color: #303133;
  word-wrap: break-word;
}

.email-text :deep(img) {
  max-width: 100%;
  height: auto;
}

.no-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.attachments-section {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  background: #fafafa;
}

.attachments-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.attachment-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
}

.attachment-name {
  flex: 1;
  color: #303133;
  font-size: 14px;
}

.attachment-size {
  color: #909399;
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .email-header {
    padding: 12px;
  }
  
  .email-subject {
    font-size: 16px;
  }
  
  .email-body {
    padding: 12px;
  }
  
  .email-info {
    font-size: 14px;
  }
}
</style>
