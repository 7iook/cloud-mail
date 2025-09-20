/**
 * 邮件内容识别和高亮工具
 * 基于2025年最新的邮件内容解析标准
 */

// 邮箱地址识别正则表达式 (RFC 5322标准)
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// 验证码识别正则表达式 (支持多种常见格式) - 2025年增强版
const VERIFICATION_CODE_PATTERNS = [
  // 基础数字验证码
  /\b\d{4,8}\b/g,                           // 4-8位纯数字
  /\b\d{3}-\d{3}\b/g,                       // 带连字符的6位数字 (123-456)

  // 字母数字组合
  /\b[A-Z0-9]{4,8}\b/g,                     // 4-8位大写字母数字组合
  /\b[a-zA-Z0-9]{4,8}\b/g,                  // 4-8位字母数字组合
  /\b[A-Z]{2}\d{4,6}\b/g,                   // 字母开头+数字 (AB1234)
  /\b\d{2,4}[A-Z]{2,4}\b/g,                 // 数字开头+字母 (12AB)

  // 带标识的验证码
  /验证码[：:\s]*([A-Za-z0-9]{4,8})/gi,      // 中文验证码标识
  /verification code[：:\s]*([A-Za-z0-9]{4,8})/gi, // 英文验证码标识
  /code[：:\s]*([A-Za-z0-9]{4,8})/gi,       // 简化英文标识
  /OTP[：:\s]*([A-Za-z0-9]{4,8})/gi,        // OTP标识
  /PIN[：:\s]*([A-Za-z0-9]{4,8})/gi,        // PIN标识
  /token[：:\s]*([A-Za-z0-9]{4,8})/gi,      // Token标识

  // 特殊格式
  /\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g,          // 带连字符的8位码 (ABCD-1234)
  /\b[A-Z0-9]{3}\s[A-Z0-9]{3}\b/g,         // 带空格的6位码 (ABC 123)
];

/**
 * 识别文本中的邮箱地址
 * @param {string} text - 要识别的文本
 * @returns {Array} 邮箱地址数组
 */
export function extractEmails(text) {
  if (!text || typeof text !== 'string') return [];
  
  const matches = text.match(EMAIL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * 识别文本中的验证码 - 2025年增强版
 * @param {string} text - 要识别的文本
 * @returns {Array} 验证码数组
 */
export function extractVerificationCodes(text) {
  if (!text || typeof text !== 'string') return [];

  const codes = new Set();

  VERIFICATION_CODE_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // 提取验证码部分（去除标识文字）
        let codeMatch;

        // 处理带标识的验证码
        if (match.includes('验证码') || match.includes('code') || match.includes('OTP') ||
            match.includes('PIN') || match.includes('token')) {
          codeMatch = match.match(/[A-Za-z0-9]{4,8}/);
        } else {
          // 直接匹配的验证码
          codeMatch = [match];
        }

        if (codeMatch && codeMatch[0]) {
          const code = codeMatch[0];
          // 过滤掉过于简单或明显不是验证码的内容
          if (code.length >= 4 && !isCommonWord(code)) {
            codes.add(code);
          }
        }
      });
    }
  });

  return Array.from(codes);
}

/**
 * 检查是否为常见单词（避免误识别）
 * @param {string} text - 要检查的文本
 * @returns {boolean} 是否为常见单词
 */
function isCommonWord(text) {
  const commonWords = [
    'FROM', 'MAIL', 'SEND', 'DEAR', 'BEST', 'TEAM', 'INFO', 'HELP',
    'USER', 'NAME', 'TIME', 'DATE', 'YEAR', 'MONTH', 'WEEK', 'DAYS'
  ];
  return commonWords.includes(text.toUpperCase());
}

/**
 * 为文本添加高亮标记 - 完全重写修复HTML属性泄露问题
 * @param {string} text - 原始文本
 * @param {Object} options - 配置选项
 * @returns {string} 带高亮标记的HTML
 */
export function highlightEmailContent(text, options = {}) {
  if (!text || typeof text !== 'string') return text;

  const { highlightEmails = true, highlightCodes = true } = options;

  // 首先清理已存在的高亮标签，避免重复处理
  let cleanText = text
    .replace(/<span[^>]*class="[^"]*highlight[^"]*"[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/"\s*title="[^"]*">/g, ''); // 清理泄露的HTML属性

  // 高亮邮箱地址
  if (highlightEmails) {
    cleanText = cleanText.replace(EMAIL_REGEX, (match) => {
      const escapedMatch = match.replace(/"/g, '&quot;');
      return `<span class="email-highlight" data-type="email" data-value="${escapedMatch}" title="点击复制邮箱地址">${match}</span>`;
    });
  }

  // 高亮验证码
  if (highlightCodes) {
    const simpleCodePatterns = [
      /\b[A-Z0-9]{4,8}\b/g,                     // 4-8位大写字母数字组合
      /\b\d{4,8}\b/g,                           // 4-8位纯数字
    ];

    simpleCodePatterns.forEach(pattern => {
      cleanText = cleanText.replace(pattern, (match) => {
        // 过滤掉常见单词，并确保不在已有的HTML标签内
        if (!isCommonWord(match) && match.length >= 4) {
          const escapedMatch = match.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          return `<span class="code-highlight" data-type="code" data-value="${escapedMatch}" title="点击复制验证码">${match}</span>`;
        }
        return match;
      });
    });
  }

  return cleanText;
}

/**
 * 检查文本是否包含可高亮内容
 * @param {string} text - 要检查的文本
 * @returns {Object} 检查结果
 */
export function hasHighlightableContent(text) {
  if (!text || typeof text !== 'string') {
    return { hasEmails: false, hasCodes: false, hasAny: false };
  }
  
  const hasEmails = EMAIL_REGEX.test(text);
  const hasCodes = VERIFICATION_CODE_PATTERNS.some(pattern => pattern.test(text));
  
  return {
    hasEmails,
    hasCodes,
    hasAny: hasEmails || hasCodes
  };
}

/**
 * 从HTML元素中提取高亮内容的值
 * @param {HTMLElement} element - 点击的元素
 * @returns {string|null} 提取的值
 */
export function extractHighlightValue(element) {
  let targetElement = null;

  // 检查是否是高亮元素
  if (element.classList.contains('email-highlight') || element.classList.contains('code-highlight')) {
    targetElement = element;
  } else {
    // 检查父元素
    targetElement = element.closest('.email-highlight, .code-highlight');
  }

  if (targetElement) {
    // 优先使用 data-value 属性
    const dataValue = targetElement.getAttribute('data-value');
    if (dataValue) {
      return dataValue;
    }

    // 回退到使用元素的文本内容
    const textContent = targetElement.textContent?.trim();
    if (textContent) {
      return textContent;
    }
  }

  return null;
}

/**
 * 判断点击是否在高亮区域
 * @param {HTMLElement} element - 点击的元素
 * @returns {boolean} 是否在高亮区域
 */
export function isHighlightElement(element) {
  return element.classList.contains('email-highlight') || 
         element.classList.contains('code-highlight') ||
         element.closest('.email-highlight, .code-highlight') !== null;
}
