<template>
  <div class="content-box" ref="contentBox">
    <div ref="container" class="content-html"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { highlightEmailContent, extractHighlightValue, isHighlightElement } from '@/utils/email-highlight-utils.js'
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const container = ref(null)
const contentBox = ref(null)
let shadowRoot = null

// 确保字体在 Shadow DOM 中可用
function loadFontInShadow() {
  const style = document.createElement('style')
  document.head.appendChild(style)
}

function updateContent() {
  if (!shadowRoot) return;

  // 1. 提取 <body> 的 style 属性（如果存在）
  const bodyStyleRegex = /<body[^>]*style="([^"]*)"[^>]*>/i;
  const bodyStyleMatch = props.html.match(bodyStyleRegex);
  const bodyStyle = bodyStyleMatch ? bodyStyleMatch[1] : '';

  // 2. 移除 <body> 标签（保留内容）
  let cleanedHtml = props.html.replace(/<\/?body[^>]*>/gi, '');

  // 3. 应用高亮处理
  cleanedHtml = highlightEmailContent(cleanedHtml, {
    highlightEmails: true,
    highlightCodes: true
  });

  // 4. 将 body 的 style 应用到 .shadow-content
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        font-size: 14px;
        color: #13181D;
        word-break: break-word;
      }

      .shadow-content {
        background: #FFFFFF;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
        ${bodyStyle ? bodyStyle : ''} /* 注入 body 的 style */
      }

      img:not(table img) {
        max-width: 100% !important;
        height: auto !important;
      }

      /* 高亮样式 - 在 Shadow DOM 中定义 */
      .email-highlight {
        color: #1976d2;
        background-color: rgba(25, 118, 210, 0.12);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 2px 4px;
        border-radius: 3px;
        position: relative;
        font-weight: 600;
      }

      .email-highlight:hover {
        color: #1565c0;
        background-color: rgba(25, 118, 210, 0.2);
        transform: translateY(-1px);
      }

      .code-highlight {
        color: #ff9800;
        background-color: rgba(255, 152, 0, 0.12);
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-weight: 600;
        position: relative;
      }

      .code-highlight:hover {
        color: #f57c00;
        background-color: rgba(255, 152, 0, 0.2);
        transform: translateY(-1px);
      }

    </style>
    <div class="shadow-content">
      ${cleanedHtml}
    </div>
  `;

  // 5. 添加点击事件处理
  addClickHandlers();
}

// 添加点击事件处理函数
function addClickHandlers() {
  if (!shadowRoot) return;

  const shadowContent = shadowRoot.querySelector('.shadow-content');
  if (!shadowContent) return;

  shadowContent.addEventListener('click', (event) => {
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
  });
}

function autoScale() {
  if (!shadowRoot || !contentBox.value) return

  const parent = contentBox.value
  const shadowContent = shadowRoot.querySelector('.shadow-content')

  if (!shadowContent) return

  const parentWidth = parent.offsetWidth
  const parentHeight = parent.offsetHeight

  const childWidth = shadowContent.scrollWidth
  const childHeight = shadowContent.scrollHeight

  if (childWidth === 0 || childHeight === 0) return

  const scaleX = parentWidth / childWidth
  const scaleY = parentHeight / childHeight
  const scale = Math.min(scaleX, scaleY)

  const hostElement = shadowRoot.host
  hostElement.style.zoom = scale
}

onMounted(() => {
  loadFontInShadow() // 预加载字体
  shadowRoot = container.value.attachShadow({ mode: 'open' })
  updateContent()
  autoScale()
})

watch(() => props.html, () => {
  updateContent()
  autoScale()
})
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'HarmonyOS', -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.content-html {
  width: 100%;
  height: 100%;
}
</style>
