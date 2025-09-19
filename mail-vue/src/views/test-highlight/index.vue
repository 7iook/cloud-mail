<template>
  <div class="test-highlight-container">
    <h2>邮件列表UI增强功能测试</h2>
    
    <div class="test-section">
      <h3>测试内容识别</h3>
      <div class="test-content">
        <p>测试邮箱地址：user@example.com 和 test.email+tag@domain.co.uk</p>
        <p>验证码测试：您的验证码是 123456，请在5分钟内使用。</p>
        <p>英文验证码：Your verification code: ABC123</p>
        <p>混合内容：请联系 support@company.com 获取验证码 789012 进行验证。</p>
      </div>
    </div>
    
    <div class="test-section">
      <h3>高亮内容测试</h3>
      <div class="highlighted-content" v-html="highlightedTestContent" @click="handleTestClick"></div>
    </div>
    
    <div class="test-section">
      <h3>功能说明</h3>
      <ul>
        <li>✅ 邮箱地址高亮显示（蓝色下划线）</li>
        <li>✅ 验证码高亮显示（红色下划线）</li>
        <li>✅ 点击高亮内容自动复制到剪贴板</li>
        <li>✅ 现代化复制成功反馈提示</li>
        <li>✅ 深色模式兼容</li>
        <li>✅ 空格键预览功能（鼠标悬停+空格键）</li>
      </ul>
    </div>

    <div class="test-section">
      <h3>空格键预览测试</h3>
      <div class="preview-instructions">
        <p><strong>使用说明：</strong></p>
        <ol>
          <li>访问邮件列表页面（/inbox）</li>
          <li>将鼠标悬停在任意邮件条目上</li>
          <li>按下空格键打开预览窗口</li>
          <li>再次按空格键或ESC键关闭预览</li>
          <li>鼠标移动到其他邮件时自动关闭当前预览</li>
        </ol>
        <p><strong>数据一致性保证：</strong></p>
        <ul>
          <li>严格的邮件ID匹配机制</li>
          <li>防止大数据量场景下的数据错乱</li>
          <li>确保预览内容与悬停邮件完全一致</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { highlightEmailContent, extractHighlightValue, isHighlightElement } from '@/utils/email-highlight-utils.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';

const testContent = `
测试邮箱地址：user@example.com 和 test.email+tag@domain.co.uk
验证码测试：您的验证码是 123456，请在5分钟内使用。
英文验证码：Your verification code: ABC123
混合内容：请联系 support@company.com 获取验证码 789012 进行验证。
更多测试：admin@test.org, code: XYZ789, info@company.net
`;

const highlightedTestContent = computed(() => {
  return highlightEmailContent(testContent, {
    highlightEmails: true,
    highlightCodes: true
  });
});

function handleTestClick(event) {
  const clickedElement = event.target;
  
  if (isHighlightElement(clickedElement)) {
    event.stopPropagation();
    const value = extractHighlightValue(clickedElement);
    
    if (value) {
      copyTextWithFeedback(value, {
        successMessage: `已复制: ${value}`,
        errorMessage: '复制失败，请重试'
      });
    }
  }
}
</script>

<style scoped>
.test-highlight-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.test-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.test-content, .highlighted-content {
  line-height: 1.6;
  font-size: 14px;
}

.highlighted-content {
  background: white;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #ddd;
  cursor: default;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  padding: 5px 0;
  font-size: 14px;
}

.preview-instructions {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.preview-instructions p {
  margin-bottom: 12px;
  font-weight: 500;
}

.preview-instructions ol,
.preview-instructions ul {
  margin-left: 20px;
  margin-bottom: 12px;
}

.preview-instructions ol li,
.preview-instructions ul li {
  margin-bottom: 4px;
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .test-section {
    background: #2a2a2a;
    border-color: #444;
  }
  
  .test-section h3 {
    color: #fff;
  }
  
  .highlighted-content {
    background: #1a1a1a;
    border-color: #444;
    color: #fff;
  }
}
</style>
