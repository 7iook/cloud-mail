/**
 * 空格键预览功能的组合式函数
 * 提供邮件列表的空格键预览交互逻辑
 */

import { ref, onMounted, onUnmounted } from 'vue';

export function useSpacePreview() {
  // 当前悬停的邮件对象
  const hoveredEmail = ref(null);
  
  // 预览窗口显示状态
  const previewVisible = ref(false);
  
  // 当前预览的邮件对象
  const previewEmail = ref(null);
  
  // 是否启用预览功能
  const previewEnabled = ref(true);

  /**
   * 处理鼠标悬停事件
   * @param {Object} email - 邮件对象
   */
  function handleMouseEnter(email) {
    if (!previewEnabled.value) return;

    // 验证邮件数据
    if (!validateEmailData(email)) return;

    // 避免重复设置相同邮件
    if (hoveredEmail.value && hoveredEmail.value.emailId === email.emailId) {
      return;
    }

    // 严格的邮件ID匹配，确保数据一致性
    // 只复制必要的字段以优化内存使用
    hoveredEmail.value = {
      emailId: email.emailId,
      subject: email.subject,
      name: email.name,
      sendEmail: email.sendEmail,
      recipient: email.recipient,
      content: email.content,
      text: email.text,
      createTime: email.createTime,
      status: email.status,
      attList: email.attList || []
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('🖱️ [SpacePreview] 鼠标悬停邮件:', {
        emailId: email.emailId,
        subject: email.subject,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 处理鼠标离开事件
   * @param {Object} email - 邮件对象
   */
  function handleMouseLeave(email) {
    if (!previewEnabled.value) return;
    
    // 只有当离开的邮件与当前悬停邮件匹配时才清除
    if (hoveredEmail.value && email && hoveredEmail.value.emailId === email.emailId) {
      hoveredEmail.value = null;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🖱️ [SpacePreview] 鼠标离开邮件:', {
          emailId: email.emailId,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * 处理空格键预览逻辑
   */
  function handleSpacePreview() {
    if (!previewEnabled.value) return;
    
    // 如果预览窗口已打开，则关闭
    if (previewVisible.value) {
      closePreview();
      return;
    }
    
    // 如果有悬停的邮件，则打开预览
    if (hoveredEmail.value) {
      openPreview(hoveredEmail.value);
    }
  }

  /**
   * 打开预览窗口
   * @param {Object} email - 要预览的邮件对象
   */
  function openPreview(email) {
    if (!validateEmailData(email)) {
      console.warn('⚠️ [SpacePreview] 尝试预览无效邮件对象');
      return;
    }

    // 防止重复打开相同邮件的预览
    if (previewVisible.value && previewEmail.value && previewEmail.value.emailId === email.emailId) {
      return;
    }

    // 确保预览的邮件数据与悬停邮件完全一致
    // 只复制必要的字段以优化性能
    previewEmail.value = {
      emailId: email.emailId,
      subject: email.subject,
      name: email.name,
      sendEmail: email.sendEmail,
      recipient: email.recipient,
      content: email.content,
      text: email.text,
      createTime: email.createTime,
      status: email.status,
      attList: email.attList || []
    };

    previewVisible.value = true;

    if (process.env.NODE_ENV === 'development') {
      console.log('👁️ [SpacePreview] 打开邮件预览:', {
        emailId: email.emailId,
        subject: email.subject,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 关闭预览窗口
   */
  function closePreview() {
    previewVisible.value = false;
    previewEmail.value = null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ [SpacePreview] 关闭邮件预览');
    }
  }

  /**
   * 键盘事件处理器
   * @param {KeyboardEvent} event - 键盘事件
   */
  function handleKeyDown(event) {
    // 检查是否在输入框中
    const target = event.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return;
    }

    // 处理空格键
    if (event.code === 'Space') {
      event.preventDefault();
      handleSpacePreview();
      return;
    }

    // 处理Escape键关闭预览
    if (event.key === 'Escape' && previewVisible.value) {
      event.preventDefault();
      closePreview();
      return;
    }
  }

  /**
   * 处理鼠标移动到其他邮件时的逻辑
   * @param {Object} newEmail - 新悬停的邮件
   */
  function handleEmailChange(newEmail) {
    // 如果预览窗口打开且鼠标移动到不同邮件，关闭预览
    if (previewVisible.value && previewEmail.value && newEmail) {
      if (previewEmail.value.emailId !== newEmail.emailId) {
        closePreview();
      }
    }
  }

  /**
   * 验证邮件数据完整性
   * @param {Object} email - 邮件对象
   * @returns {boolean} 是否有效
   */
  function validateEmailData(email) {
    if (!email) return false;
    
    // 必须有emailId作为唯一标识
    if (!email.emailId) {
      console.warn('⚠️ [SpacePreview] 邮件对象缺少emailId');
      return false;
    }
    
    return true;
  }

  /**
   * 启用预览功能
   */
  function enablePreview() {
    previewEnabled.value = true;
  }

  /**
   * 禁用预览功能
   */
  function disablePreview() {
    previewEnabled.value = false;
    closePreview();
    hoveredEmail.value = null;
  }

  // 生命周期管理
  onMounted(() => {
    // 添加全局键盘事件监听
    document.addEventListener('keydown', handleKeyDown);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 [SpacePreview] 空格键预览功能已启用');
    }
  });

  onUnmounted(() => {
    // 清理事件监听器
    document.removeEventListener('keydown', handleKeyDown);
    
    // 清理状态
    hoveredEmail.value = null;
    previewEmail.value = null;
    previewVisible.value = false;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 [SpacePreview] 空格键预览功能已清理');
    }
  });

  return {
    // 状态
    hoveredEmail,
    previewVisible,
    previewEmail,
    previewEnabled,
    
    // 方法
    handleMouseEnter,
    handleMouseLeave,
    handleSpacePreview,
    openPreview,
    closePreview,
    handleEmailChange,
    validateEmailData,
    enablePreview,
    disablePreview
  };
}
