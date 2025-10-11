<template>
  <div class="monitor-share-page">
    <!-- 现代化页面头部 -->
    <div class="share-header">
      <div class="header-content">
        <div class="logo-section">
          <div class="logo-container">
            <img src="/mail.png" alt="Cloud Mail" class="logo" />
            <div class="logo-glow"></div>
          </div>
          <div class="title-section">
            <h1 class="title">验证码邮件分享</h1>
            <p class="subtitle">实时接收验证码邮件</p>
          </div>
        </div>
        <div class="config-info" v-if="monitorConfig">
          <div class="config-card">
            <div class="config-item">
              <div class="config-icon">📧</div>
              <div class="config-details">
                <span class="label">监控邮箱</span>
                <span class="value">{{ monitorConfig.emailAddress }}</span>
              </div>
            </div>
            <div class="config-item">
              <div class="config-icon">🔗</div>
              <div class="config-details">
                <span class="label">匹配类型</span>
                <span class="value">{{ getAliasTypeText(monitorConfig.aliasType) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div v-loading="true" element-loading-text="加载中...">
        <div style="height: 200px;"></div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <div class="error-content">
        <el-icon class="error-icon" size="48">
          <Warning />
        </el-icon>
        <h2>访问失败</h2>
        <p>{{ error }}</p>
        <el-button type="primary" @click="retry">重试</el-button>
      </div>
    </div>

    <!-- 邮件列表 -->
    <div v-else class="emails-container">
      <!-- 分屏布局容器 -->
      <SplitPaneLayout class="split-container">
        <!-- 邮件列表 -->
        <template #list>
          <div class="emails-header">
            <div class="header-left">
              <h2>📨 验证码邮件</h2>
              <div class="email-count" v-if="emailsList.length > 0">
                共 {{ emailsList.length }} 封邮件
              </div>
            </div>
            <div class="header-actions">
              <LayoutModeSelector />
              <el-button
                @click="refreshEmails"
                :loading="refreshing"
                class="refresh-btn"
                type="primary"
                :icon="Refresh"
              >
                刷新
              </el-button>
              <el-button
                type="success"
                @click="simulateNewEmail"
                :loading="simulating"
                v-if="isDevelopment"
                :icon="Message"
              >
                测试邮件
              </el-button>
            </div>
          </div>

          <!-- 现代化邮件卡片列表 -->
          <div class="emails-container" @scroll="handleTableScroll">
            <div v-if="emailsLoading && emailsList.length === 0" class="loading-state">
              <div class="loading-spinner"></div>
              <p>正在加载验证码邮件...</p>
            </div>

            <div v-else-if="emailsList.length === 0" class="empty-state">
              <div class="empty-icon">📭</div>
              <h3>暂无验证码邮件</h3>
              <p>等待接收新的验证码邮件</p>
            </div>

            <div v-else class="emails-grid">
              <div
                v-for="email in emailsList"
                :key="email.emailId"
                class="email-card"
                @click="viewEmailDetail(email)"
                :class="{ 'selected': selectedEmail?.emailId === email.emailId }"
              >
                <div class="email-card-header">
                  <div class="sender-info">
                    <div class="sender-avatar">
                      {{ (email.name || email.sendEmail || 'U').charAt(0).toUpperCase() }}
                    </div>
                    <div class="sender-details">
                      <div class="sender-name">{{ email.name || email.sendEmail || '未知发件人' }}</div>
                      <div class="sender-email">{{ email.sendEmail }}</div>
                    </div>
                  </div>
                  <div class="email-time">
                    {{ formatDateTime(email.createTime) }}
                  </div>
                </div>

                <div class="email-card-body">
                  <div class="email-subject">
                    {{ email.subject || '(无主题)' }}
                  </div>

                  <!-- 验证码高亮显示 -->
                  <div class="verification-codes" v-if="getVerificationCodes(email).length > 0">
                    <div class="codes-label">🔐 验证码</div>
                    <div class="codes-list">
                      <div
                        v-for="code in getVerificationCodes(email)"
                        :key="code"
                        class="verification-code"
                        @click.stop="handleCodeClick(code)"
                      >
                        {{ code }}
                      </div>
                    </div>
                  </div>

                  <!-- 邮件内容预览 -->
                  <div class="email-preview" v-html="getContentPreview(email)"></div>
                </div>

                <div class="email-card-footer">
                  <div class="email-tags">
                    <el-tag size="small" :type="getMatchTypeColor(email.matchType)">
                      {{ getMatchTypeText(email.matchType) }}
                    </el-tag>
                    <el-tag v-if="email.isTestEmail" type="info" size="small">
                      🧪 测试
                    </el-tag>
                  </div>
                  <div class="email-actions">
                    <el-button size="small" type="primary" @click.stop="viewEmailDetail(email)">
                      查看详情
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 加载更多指示器 -->
            <div class="load-more-indicator" v-if="hasMore && loadingMore">
              <div class="loading-spinner"></div>
              <span>正在加载更多邮件...</span>
            </div>

            <div class="no-more-indicator" v-else-if="emailsList.length > 0 && !hasMore">
              <div class="no-more-icon">✅</div>
              <span>已显示全部邮件</span>
            </div>
          </div>
        </template>

        <!-- 邮件详情 -->
        <template #detail>
          <EmailDetailPane v-if="showDetailPane" />
        </template>
      </SplitPaneLayout>
    </div>

    <!-- 邮件详情对话框 -->
    <el-dialog 
      v-model="showEmailDetail" 
      title="邮件详情" 
      width="70%"
      :before-close="closeEmailDetail"
    >
      <div v-if="currentEmail" class="email-detail">
        <div class="email-meta">
          <div class="meta-row">
            <label>主题：</label>
            <span>{{ currentEmail.subject || '(无主题)' }}</span>
          </div>
          <div class="meta-row">
            <label>发件人：</label>
            <span>{{ currentEmail.sendEmail }} ({{ currentEmail.name }})</span>
          </div>
          <div class="meta-row">
            <label>收件人：</label>
            <span>{{ formatRecipients(currentEmail.recipient) }}</span>
          </div>
          <div class="meta-row">
            <label>时间：</label>
            <span>{{ formatDateTime(currentEmail.createTime) }}</span>
          </div>
          <div class="meta-row">
            <label>匹配地址：</label>
            <el-tag size="small" :type="getMatchTypeColor(currentEmail.matchType)">
              {{ currentEmail.matchedAddress }}
            </el-tag>
          </div>
        </div>
        
        <el-divider />
        
        <div class="email-content">
          <div class="content-header">
            <span>邮件内容：</span>
          </div>
          <div class="content-body" 
               v-html="getHighlightedContent(currentEmail)" 
               @click="handleEmailContentClick">
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 自动刷新状态指示器 -->
    <div class="auto-refresh-indicator" :class="{ active: autoRefreshTimer }">
      <div class="refresh-dot"></div>
      <span>{{ autoRefreshTimer ? '自动刷新中' : '自动刷新已停止' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Warning, Refresh, Message, Loading, Check } from '@element-plus/icons-vue';
import { useEmailStore } from '@/store/email.js';
import { getShareInfo, getShareEmails } from '@/request/share.js';
import { highlightEmailContent, extractHighlightValue, isHighlightElement, extractVerificationCodes } from '@/utils/email-highlight-utils.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';
import SplitPaneLayout from '@/components/SplitPaneLayout.vue';
import LayoutModeSelector from '@/components/LayoutModeSelector.vue';
import EmailDetailPane from '@/components/EmailDetailPane.vue';
import DOMPurify from 'dompurify';

// 路由参数
const route = useRoute();
const shareToken = route.params.token;

// 邮件状态管理
const emailStore = useEmailStore();

// 响应式数据
const loading = ref(true);
const error = ref('');
const monitorConfig = ref(null);
const emailsList = ref([]);
const emailsLoading = ref(false);
const refreshing = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const lastEmailId = ref(0);

// 邮件详情
const showEmailDetail = ref(false);
const currentEmail = ref(null);

// 自动刷新相关
const autoRefreshTimer = ref(null);
const autoRefreshInterval = ref(30); // 30秒自动刷新（将从后端配置读取）
const existIds = new Set();

// SSE 实时推送相关
const eventSource = ref(null);
const useSSE = ref(true); // 是否使用 SSE 实时推送
const sseConnected = ref(false);

// 测试功能相关
const simulating = ref(false);
const testingTemplate = ref(false);
const isDevelopment = computed(() => {
  // 检测是否为开发环境
  return import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
});

// 分屏布局相关
const splitMode = computed(() => emailStore.splitLayout?.mode || 'none');
const showDetailPane = computed(() => emailStore.splitLayout?.showDetailPane || false);
const selectedEmail = computed(() => emailStore.splitLayout?.selectedEmail);

// 修复滚动功能
const initScrollFix = () => {
  if (typeof window === 'undefined') return;

  nextTick(() => {
    const emailsTable = document.querySelector('.emails-table');
    if (!emailsTable) return;

    // 添加鼠标滚轮事件监听器
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY;
      const currentScrollTop = emailsTable.scrollTop;
      const newScrollTop = Math.max(0, Math.min(
        emailsTable.scrollHeight - emailsTable.clientHeight,
        currentScrollTop + delta
      ));

      // 使用 scrollTo 的 instant 行为（已验证可用）
      emailsTable.scrollTo({ top: newScrollTop, behavior: 'instant' });
    };

    // 添加键盘事件监听器
    const handleKeydown = (e) => {
      if (!emailsTable.contains(document.activeElement) && document.activeElement !== emailsTable) {
        return;
      }

      const currentScrollTop = emailsTable.scrollTop;
      const clientHeight = emailsTable.clientHeight;
      const scrollHeight = emailsTable.scrollHeight;
      let newScrollTop = currentScrollTop;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newScrollTop = Math.min(scrollHeight - clientHeight, currentScrollTop + 40);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newScrollTop = Math.max(0, currentScrollTop - 40);
          break;
        case 'PageDown':
          e.preventDefault();
          newScrollTop = Math.min(scrollHeight - clientHeight, currentScrollTop + clientHeight * 0.8);
          break;
        case 'PageUp':
          e.preventDefault();
          newScrollTop = Math.max(0, currentScrollTop - clientHeight * 0.8);
          break;
        case 'Home':
          e.preventDefault();
          newScrollTop = 0;
          break;
        case 'End':
          e.preventDefault();
          newScrollTop = scrollHeight - clientHeight;
          break;
      }

      if (newScrollTop !== currentScrollTop) {
        emailsTable.scrollTo({ top: newScrollTop, behavior: 'instant' });
      }
    };

    // 确保表格可以获得焦点
    emailsTable.tabIndex = 0;

    // 添加事件监听器
    emailsTable.addEventListener('wheel', handleWheel, { passive: false });
    emailsTable.addEventListener('keydown', handleKeydown);

    // 存储清理函数
    emailsTable._scrollCleanup = () => {
      emailsTable.removeEventListener('wheel', handleWheel);
      emailsTable.removeEventListener('keydown', handleKeydown);
    };
  });
};

// SSE 连接函数
const connectSSE = () => {
  if (!useSSE.value || !shareToken) return;

  try {
    // 关闭现有连接
    if (eventSource.value) {
      eventSource.value.close();
    }

    // 创建新的 SSE 连接
    const url = `/api/share/stream/${shareToken}`;
    eventSource.value = new EventSource(url);

    eventSource.value.onopen = () => {
      sseConnected.value = true;
      console.log('SSE 连接已建立');
    };

    eventSource.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          // 连接成功，更新刷新间隔
          if (data.refreshInterval) {
            autoRefreshInterval.value = data.refreshInterval;
          }
        } else if (data.type === 'new_emails') {
          // 收到新邮件，更新列表
          if (data.emails && data.emails.length > 0) {
            // 合并新邮件到列表
            const newEmails = data.emails.filter(email => !existIds.has(email.emailId));
            if (newEmails.length > 0) {
              emailsList.value = [...newEmails, ...emailsList.value];
              newEmails.forEach(email => existIds.add(email.emailId));
              ElMessage.success(`收到 ${newEmails.length} 封新邮件`);
            }
          }
        } else if (data.type === 'error') {
          console.error('SSE 错误:', data.message);
        }
      } catch (err) {
        console.error('解析 SSE 消息失败:', err);
      }
    };

    eventSource.value.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      sseConnected.value = false;

      // 连接失败，降级到轮询模式
      if (eventSource.value) {
        eventSource.value.close();
        eventSource.value = null;
      }

      // 启动轮询作为备用方案
      if (!autoRefreshTimer.value) {
        startAutoRefresh();
      }
    };

  } catch (error) {
    console.error('创建 SSE 连接失败:', error);
    useSSE.value = false;
    startAutoRefresh(); // 降级到轮询
  }
};

// 断开 SSE 连接
const disconnectSSE = () => {
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
    sseConnected.value = false;
  }
};

// XSS 防护：清理 HTML 内容
const sanitizeHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['span', 'div', 'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['class', 'style', 'href', 'target'],
    ALLOW_DATA_ATTR: false
  });
};

// 初始化
onMounted(async () => {
  // 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage();

  await loadMonitorConfig();
  if (monitorConfig.value) {
    await loadMonitorEmails();

    // 优先使用 SSE，失败则降级到轮询
    if (useSSE.value) {
      connectSSE();
    } else {
      startAutoRefresh();
    }

    // 初始化滚动优化
    initScrollOptimization();

    // 修复滚动功能
    initScrollFix();
  }
});

// 清理定时器和连接
onUnmounted(() => {
  stopAutoRefresh();
  disconnectSSE();

  // 清理滚动监听器
  if (scrollObserver) {
    scrollObserver.disconnect();
  }

  // 清理滚动修复事件监听器
  const emailsTable = document.querySelector('.emails-table');
  if (emailsTable && emailsTable._scrollCleanup) {
    emailsTable._scrollCleanup();
  }
});

// 2025年滚动性能优化
let scrollObserver = null;



// 初始化滚动优化
const initScrollOptimization = () => {
  if (typeof window === 'undefined') return;
  
  // 使用Intersection Observer优化滚动性能
  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 元素进入视口时启用动画
        entry.target.style.willChange = 'transform, opacity';
      } else {
        // 元素离开视口时禁用动画以节省性能
        entry.target.style.willChange = 'auto';
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.1
  });
  
  // 监听邮件行
  nextTick(() => {
    const emailRows = document.querySelectorAll('.el-table__row');
    emailRows.forEach(row => {
      scrollObserver?.observe(row);
    });
  });
};

// 加载监控配置
const loadMonitorConfig = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    const response = await getShareInfo(shareToken);
    monitorConfig.value = response;
    
  } catch (err) {
    console.error('加载监控配置失败:', err);
    error.value = err.message || '加载监控配置失败，请检查分享链接是否有效';
  } finally {
    loading.value = false;
  }
};

// 加载监控邮件列表
const loadMonitorEmails = async (reset = true) => {
  try {
    emailsLoading.value = reset;
    
    const params = {
      size: 20
    };
    
    if (!reset && lastEmailId.value > 0) {
      params.emailId = lastEmailId.value;
    }
    
    const response = await getShareEmails(shareToken, params);
    const newEmails = response.emails || [];
    
    if (reset) {
      emailsList.value = newEmails;
    } else {
      emailsList.value.push(...newEmails);
    }
    
    // 更新分页状态
    if (newEmails.length > 0) {
      lastEmailId.value = newEmails[newEmails.length - 1].emailId;
      hasMore.value = newEmails.length === 20;
    } else {
      hasMore.value = false;
    }
    
  } catch (err) {
    console.error('加载邮件列表失败:', err);
    ElMessage.error('加载邮件列表失败');
  } finally {
    emailsLoading.value = false;
    loadingMore.value = false;
  }
};

// 刷新邮件列表
const refreshEmails = async () => {
  refreshing.value = true;
  lastEmailId.value = 0;
  hasMore.value = true;
  await loadMonitorEmails(true);
  refreshing.value = false;
  ElMessage.success('刷新成功');
};

// 加载更多邮件
const loadMoreEmails = async () => {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  await loadMonitorEmails(false);
  loadingMore.value = false;
};

// 处理表格滚动事件 - 自动加载更多
const handleTableScroll = (event) => {
  const { scrollTop, scrollHeight, clientHeight } = event.target;

  // 当滚动到距离底部100px时自动加载更多
  if (scrollHeight - scrollTop - clientHeight < 100 && hasMore.value && !loadingMore.value) {
    loadMoreEmails();
  }
};



// 重试加载
const retry = async () => {
  await loadMonitorConfig();
  if (monitorConfig.value) {
    await loadMonitorEmails();
  }
};

// 查看邮件详情
const viewEmailDetail = (email) => {
  if (splitMode.value === 'none') {
    // 无分屏模式：使用对话框显示
    currentEmail.value = email;
    showEmailDetail.value = true;
  } else {
    // 分屏模式：在分屏面板中显示
    emailStore.selectEmail(email);
  }
};

// 关闭邮件详情
const closeEmailDetail = () => {
  showEmailDetail.value = false;
  currentEmail.value = null;
};

// 工具函数
const getAliasTypeText = (type) => {
  const typeMap = {
    'exact': '精确匹配',
    'gmail_alias': 'Gmail别名',
    'domain_wildcard': '域名通配符'
  };
  return typeMap[type] || type;
};

const getMatchTypeText = (type) => {
  const typeMap = {
    'exact': '精确',
    'gmail_alias': 'Gmail别名',
    'gmail_base': 'Gmail基础',
    'domain_wildcard': '域名通配符'
  };
  return typeMap[type] || type;
};

const getMatchTypeColor = (type) => {
  const colorMap = {
    'exact': 'success',
    'gmail_alias': 'primary',
    'gmail_base': 'info',
    'domain_wildcard': 'warning'
  };
  return colorMap[type] || 'default';
};

const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleString('zh-CN');
};

const formatRecipients = (recipientJson) => {
  try {
    const recipients = JSON.parse(recipientJson || '[]');
    return recipients.map(r => r.address || r).join(', ');
  } catch {
    return recipientJson || '';
  }
};

// 获取邮件内容预览（带验证码高亮）
const getContentPreview = (email) => {
  const content = email.content || email.text || '';
  if (!content) return '';
  
  // 提取前100个字符作为预览
  const preview = content.replace(/<[^>]*>/g, '').substring(0, 100);
  if (!preview.trim()) return '';
  
  // 应用验证码和邮箱高亮
  return highlightEmailContent(preview, {
    highlightEmails: true,
    highlightCodes: true
  });
};

// 获取完整的高亮内容（添加 XSS 防护）
const getHighlightedContent = (email) => {
  if (!email) return '(无内容)';

  const content = email.content || email.text || '';
  if (!content) return '(无内容)';

  // 应用验证码和邮箱高亮
  const highlighted = highlightEmailContent(content, {
    highlightEmails: true,
    highlightCodes: true
  });

  // 使用 DOMPurify 清理 HTML，防止 XSS 攻击
  return sanitizeHTML(highlighted);
};

// 邮件模板系统 - Augment Code 专用模板
const augmentCodeTemplate = {
  name: 'Augment Code 验证码邮件',
  senderPattern: /^Augment Code$/i,
  subjectPattern: /^Welcome to Augment Code$/i,
  verificationCodePattern: /Your verification code is:\s*(\d{6})/i,
  contentStructure: {
    greeting: /Your verification code is:/,
    verificationCode: /(\d{6})/,
    supportInfo: /If you are having any issues with your account/,
    signature: /Thanks!\s*Augment Code/,
    securityNotice: /Never share this one-time code with anyone/
  },
  extractVerificationCode: (content) => {
    const match = content.match(/Your verification code is:\s*(\d{6})/i);
    return match ? match[1] : null;
  },
  validateEmail: (email) => {
    const sender = email.sendEmail || email.name || '';
    const subject = email.subject || '';
    const content = email.content || email.text || '';

    return (
      /^Augment Code$/i.test(sender) &&
      /^Welcome to Augment Code$/i.test(subject) &&
      /Your verification code is:\s*\d{6}/i.test(content)
    );
  }
};

// 增强的验证码提取函数 - 支持 Augment Code 模板
const extractVerificationCodesWithTemplate = (content, senderName = '') => {
  if (!content) return [];

  // 提取纯文本内容
  const plainText = content.replace(/<[^>]*>/g, '');

  // 如果是 Augment Code 邮件，使用专用模板
  if (/Augment Code/i.test(senderName)) {
    const code = augmentCodeTemplate.extractVerificationCode(plainText);
    return code ? [code] : [];
  }

  // 通用验证码提取模式
  const patterns = [
    /Your verification code is:\s*(\d{4,8})/gi,  // Augment Code 格式
    /验证码[：:]\s*(\d{4,8})/gi,  // 中文验证码
    /code[：:]\s*([A-Z0-9]{4,8})/gi,  // 英文验证码
    /\b(\d{6})\b/g,  // 6位数字验证码
    /\b(\d{4})\b/g   // 4位数字验证码
  ];

  const codes = [];
  patterns.forEach(pattern => {
    const matches = plainText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const codeMatch = match.match(/(\d{4,8})/);
        if (codeMatch) {
          codes.push(codeMatch[1]);
        }
      });
    }
  });

  // 去重并限制数量
  return [...new Set(codes)].slice(0, 3);
};

// 常用网站邮件模板库
const commonEmailTemplates = [
  augmentCodeTemplate,

  // GitHub 验证码模板
  {
    name: 'GitHub 验证码邮件',
    senderPattern: /github|noreply@github\.com/i,
    subjectPattern: /verification code|sign.in|two.factor/i,
    verificationCodePattern: /(\d{6})/,
    extractVerificationCode: (content) => {
      const patterns = [
        /verification code:\s*(\d{6})/i,
        /your code is:\s*(\d{6})/i,
        /\b(\d{6})\b/
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    validateEmail: (email) => {
      const sender = email.sendEmail || email.name || '';
      const subject = email.subject || '';
      return /github/i.test(sender) && /verification|sign.in|code/i.test(subject);
    }
  },

  // 微信验证码模板
  {
    name: '微信验证码邮件',
    senderPattern: /wechat|weixin|腾讯/i,
    subjectPattern: /验证码|verification/i,
    verificationCodePattern: /验证码[：:]\s*(\d{4,6})/,
    extractVerificationCode: (content) => {
      const patterns = [
        /验证码[：:]\s*(\d{4,6})/,
        /verification code[：:]\s*(\d{4,6})/i,
        /您的验证码是[：:]\s*(\d{4,6})/
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    validateEmail: (email) => {
      const sender = email.sendEmail || email.name || '';
      const content = email.content || email.text || '';
      return /wechat|weixin|腾讯/i.test(sender) && /验证码/i.test(content);
    }
  },

  // 通用验证码模板
  {
    name: '通用验证码邮件',
    senderPattern: /.*/,
    subjectPattern: /verification|verify|code|验证/i,
    verificationCodePattern: /(\d{4,8})/,
    extractVerificationCode: (content) => {
      const patterns = [
        /verification code[：:]\s*(\d{4,8})/i,
        /verify code[：:]\s*(\d{4,8})/i,
        /code[：:]\s*(\d{4,8})/i,
        /验证码[：:]\s*(\d{4,8})/,
        /\b(\d{6})\b/,
        /\b(\d{4})\b/
      ];
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1];
      }
      return null;
    },
    validateEmail: (email) => {
      const subject = email.subject || '';
      const content = email.content || email.text || '';
      return /verification|verify|code|验证/i.test(subject) || /verification|verify|code|验证码/i.test(content);
    }
  }
];

// 邮件模板管理系统
const emailTemplateManager = {
  templates: commonEmailTemplates,

  // 添加新模板
  addTemplate: (template) => {
    emailTemplateManager.templates.push(template);
  },

  // 根据邮件内容匹配模板
  matchTemplate: (email) => {
    for (const template of emailTemplateManager.templates) {
      if (template.validateEmail(email)) {
        return template;
      }
    }
    return null;
  },

  // 提取验证码（使用匹配的模板）
  extractVerificationCode: (email) => {
    const template = emailTemplateManager.matchTemplate(email);
    if (template) {
      const content = email.content || email.text || '';
      return template.extractVerificationCode(content);
    }

    // 如果没有匹配的模板，使用通用提取
    return extractVerificationCodesWithTemplate(email.content || email.text || '', email.sendEmail || email.name || '');
  },

  // 获取邮件分析结果
  analyzeEmail: (email) => {
    const template = emailTemplateManager.matchTemplate(email);
    const verificationCode = emailTemplateManager.extractVerificationCode(email);

    return {
      hasTemplate: !!template,
      templateName: template ? template.name : null,
      verificationCode: verificationCode,
      isVerificationEmail: !!verificationCode,
      confidence: template ? 1.0 : 0.5
    };
  },

  // 导出模板配置
  exportTemplates: () => {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      templates: emailTemplateManager.templates.map(template => ({
        name: template.name,
        senderPattern: template.senderPattern.source,
        subjectPattern: template.subjectPattern.source,
        verificationCodePattern: template.verificationCodePattern.source
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // 导入模板配置
  importTemplates: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          if (importData.templates && Array.isArray(importData.templates)) {
            // 验证并添加导入的模板
            importData.templates.forEach(templateData => {
              if (templateData.name && templateData.senderPattern) {
                const template = {
                  name: templateData.name,
                  senderPattern: new RegExp(templateData.senderPattern, 'i'),
                  subjectPattern: new RegExp(templateData.subjectPattern || '.*', 'i'),
                  verificationCodePattern: new RegExp(templateData.verificationCodePattern || '(\\d{4,8})', 'i'),
                  extractVerificationCode: (content) => {
                    const match = content.match(new RegExp(templateData.verificationCodePattern || '(\\d{4,8})', 'i'));
                    return match ? match[1] : null;
                  },
                  validateEmail: (email) => {
                    const sender = email.sendEmail || email.name || '';
                    const subject = email.subject || '';
                    return new RegExp(templateData.senderPattern, 'i').test(sender);
                  }
                };
                emailTemplateManager.addTemplate(template);
              }
            });
            resolve(importData.templates.length);
          } else {
            reject(new Error('Invalid template file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  }
};

// 获取邮件中的验证码（优先使用API返回的extractedCode）
const getVerificationCodes = (email) => {
  // 优先使用API返回的验证码
  if (email.extractedCode) {
    return [email.extractedCode];
  }

  // 如果API没有返回验证码，使用前端提取逻辑作为备用
  const content = email.content || email.text || '';
  const sender = email.sendEmail || email.name || '';

  if (!content) return [];

  // 使用邮件模板管理系统
  const analysis = emailTemplateManager.analyzeEmail(email);
  return analysis.verificationCode ? [analysis.verificationCode] : extractVerificationCodesWithTemplate(content, sender);
};



// 获取完整邮件内容（用于新的内容列）- 优化版本
const getFullEmailContent = (email) => {
  const content = email.content || email.text || '';
  if (!content) return '<span class="no-content">无内容</span>';

  // 提取纯文本内容，保留换行符以支持多行显示
  let plainText = content.replace(/<[^>]*>/g, '').trim();

  // 根据屏幕尺寸和可用空间动态调整内容长度
  // 目标：显示4-5行内容，每行约60-80个字符
  let maxLength;
  const screenWidth = window.innerWidth;

  if (screenWidth <= 320) {
    maxLength = 120; // 小屏手机：约2行
  } else if (screenWidth <= 375) {
    maxLength = 160; // 标准手机：约2-3行
  } else if (screenWidth <= 414) {
    maxLength = 200; // 大屏手机：约3行
  } else if (screenWidth <= 768) {
    maxLength = 280; // 平板：约3-4行
  } else {
    maxLength = 400; // 桌面：约4-5行，充分利用1020px的列宽
  }

  // 智能截断：优先在句号、换行符等自然断点截断
  if (plainText.length > maxLength) {
    let truncated = plainText.substring(0, maxLength);

    // 寻找最近的自然断点
    const breakPoints = ['\n', '。', '！', '？', '. ', '! ', '? '];
    let bestBreakPoint = -1;

    for (const breakPoint of breakPoints) {
      const lastIndex = truncated.lastIndexOf(breakPoint);
      if (lastIndex > maxLength * 0.7) { // 至少保留70%的内容
        bestBreakPoint = Math.max(bestBreakPoint, lastIndex + breakPoint.length);
      }
    }

    if (bestBreakPoint > 0) {
      plainText = truncated.substring(0, bestBreakPoint).trim() + '...';
    } else {
      plainText = truncated.trim() + '...';
    }
  }

  // 应用验证码和邮箱高亮
  return highlightEmailContent(plainText, {
    highlightEmails: true,
    highlightCodes: true
  });
};

// 获取纯文本内容（用于tooltip显示）
const getPlainTextContent = (email) => {
  const content = email.content || email.text || '';
  if (!content) return '无内容';
  
  // 提取纯文本内容
  return content.replace(/<[^>]*>/g, '').trim();
};

// 处理验证码点击事件
const handleCodeClick = (code) => {
  copyTextWithFeedback(code, {
    successMessage: `🔐 已复制验证码: ${code}`,
    errorMessage: '❌ 复制失败，请重试',
    duration: 3000
  });
};

// 自动刷新功能
const startAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value);
  }
  
  // 开始自动刷新
  autoRefreshTimer.value = setInterval(async () => {
    await checkForNewEmails();
  }, autoRefreshInterval.value * 1000);
  
  console.log(`🔄 [MonitorShare] 自动刷新已启动，间隔: ${autoRefreshInterval.value}秒`);
};

const stopAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value);
    autoRefreshTimer.value = null;
    console.log('⏹️ [MonitorShare] 自动刷新已停止');
  }
};

// 检查新邮件
const checkForNewEmails = async () => {
  if (emailsLoading.value || !monitorConfig.value) return;
  
  try {
    const latestEmailId = emailsList.value.length > 0 ? emailsList.value[0].emailId : 0;
    
    const params = {
      size: 20,
      emailId: latestEmailId
    };
    
    const response = await getShareEmails(shareToken, params);
    const newEmails = response.emails || [];
    
    if (newEmails.length > 0) {
      // 过滤掉已存在的邮件
      const filteredEmails = newEmails.filter(email => !existIds.has(email.emailId));
      
      if (filteredEmails.length > 0) {
        // 添加新邮件到列表顶部
        filteredEmails.forEach(email => {
          existIds.add(email.emailId);
          emailsList.value.unshift(email);
        });
        
        console.log(`📧 [MonitorShare] 发现 ${filteredEmails.length} 封新邮件`);
        
        // 显示新邮件提示
        ElMessage({
          message: `📧 收到 ${filteredEmails.length} 封新邮件`,
          type: 'success',
          duration: 3000
        });
      }
    }
  } catch (err) {
    console.error('检查新邮件失败:', err);
  }
};

// Augment Code 邮件测试数据生成器
const augmentCodeTestDataGenerator = {
  // 生成随机6位数字验证码
  generateVerificationCode: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // 生成标准 Augment Code 邮件内容
  generateEmailContent: (verificationCode) => {
    return `Your verification code is: ${verificationCode}

If you are having any issues with your account, please don't hesitate to contact us by replying to this mail.

Thanks!
Augment Code

If you did not make this request, you can safely ignore this email. Never share this one-time code with anyone - Augment support will never ask for your verification code. Your account remains secure and no action is needed.`;
  },

  // 生成 HTML 格式的邮件内容
  generateHtmlContent: (verificationCode) => {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333333; font-size: 24px; margin: 0;">Augment Code</h1>
      </div>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #333333; margin: 0 0 15px 0;">Your verification code is:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #007AFF; background-color: #ffffff; padding: 15px 25px; border-radius: 8px; border: 2px solid #e9ecef; letter-spacing: 3px; font-family: monospace;">${verificationCode}</span>
        </div>
      </div>

      <p style="font-size: 14px; color: #666666; line-height: 1.5; margin-bottom: 15px;">
        If you are having any issues with your account, please don't hesitate to contact us by replying to this mail.
      </p>

      <p style="font-size: 14px; color: #333333; margin-bottom: 20px;">
        Thanks!<br>
        <strong>Augment Code</strong>
      </p>

      <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
        <p style="font-size: 12px; color: #999999; line-height: 1.4; margin: 0;">
          If you did not make this request, you can safely ignore this email. Never share this one-time code with anyone - Augment support will never ask for your verification code. Your account remains secure and no action is needed.
        </p>
      </div>
    </div>`;
  },

  // 生成完整的 Augment Code 测试邮件数据
  generateTestEmail: (targetEmail, recipientName = 'User') => {
    const verificationCode = augmentCodeTestDataGenerator.generateVerificationCode();
    const textContent = augmentCodeTestDataGenerator.generateEmailContent(verificationCode);
    const htmlContent = augmentCodeTestDataGenerator.generateHtmlContent(verificationCode);

    return {
      fromEmail: 'noreply@augmentcode.com',
      fromName: 'Augment Code',
      subject: 'Welcome to Augment Code',
      content: htmlContent,
      text: textContent,
      toEmail: targetEmail,
      toName: recipientName,
      cc: [],
      bcc: [],
      verificationCode: verificationCode, // 用于测试验证
      templateType: 'augment-code' // 标识邮件类型
    };
  },

  // 生成多个测试场景
  generateTestScenarios: (targetEmail) => {
    return [
      // 场景1：标准 Augment Code 验证码邮件
      {
        name: 'Augment Code 标准验证码邮件',
        data: augmentCodeTestDataGenerator.generateTestEmail(targetEmail, 'Test User'),
        description: '标准的 Augment Code 验证码邮件，应该被模板系统正确识别'
      },

      // 场景2：不同验证码的 Augment Code 邮件
      {
        name: 'Augment Code 验证码邮件 (不同验证码)',
        data: augmentCodeTestDataGenerator.generateTestEmail(targetEmail, 'Developer'),
        description: '使用不同验证码的 Augment Code 邮件，测试验证码提取功能'
      },

      // 场景3：模拟真实用户场景
      {
        name: 'Augment Code 真实用户场景',
        data: (() => {
          const email = augmentCodeTestDataGenerator.generateTestEmail(targetEmail, 'John Doe');
          // 添加一些真实场景的变化
          email.fromEmail = 'support@augmentcode.com';
          return email;
        })(),
        description: '模拟真实用户注册场景的 Augment Code 验证码邮件'
      }
    ];
  }
};

// 模拟新邮件接收（测试功能）
const simulateNewEmail = async () => {
  if (simulating.value || !monitorConfig.value) return;

  try {
    simulating.value = true;

    // 随机选择测试场景
    const testScenarios = [
      // 原有的测试邮件
      {
        name: '通用测试邮件',
        data: {
          fromEmail: 'test-sender@example.com',
          fromName: 'Test Sender',
          subject: `测试邮件 - 实时更新验证 ${new Date().toLocaleString()}`,
          content: `<div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #007AFF;">🧪 测试邮件 - 实时更新验证</h2>
            <p>这是一封用于验证分享页面实时更新功能的测试邮件。</p>
            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>📧 收件人：</strong> ${monitorConfig.value.emailAddress}</p>
              <p><strong>🏷️ 匹配类型：</strong> ${getAliasTypeText(monitorConfig.value.aliasType)}</p>
              <p><strong>⏰ 发送时间：</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p>如果您在分享页面看到这封邮件，说明实时更新功能正常工作！</p>
            <div style="margin-top: 20px; padding: 10px; background: #e8f5e8; border-left: 4px solid #4CAF50;">
              <p style="margin: 0;"><strong>✅ 测试验证码：</strong> <span style="background: #fff; padding: 2px 6px; border-radius: 4px; font-family: monospace;">123456</span></p>
            </div>
          </div>`,
          text: `测试邮件 - 实时更新验证\n\n这是一封用于验证分享页面实时更新功能的测试邮件。\n\n收件人：${monitorConfig.value.emailAddress}\n匹配类型：${getAliasTypeText(monitorConfig.value.aliasType)}\n发送时间：${new Date().toLocaleString()}\n\n如果您在分享页面看到这封邮件，说明实时更新功能正常工作！\n\n测试验证码：123456`,
          toEmail: monitorConfig.value.emailAddress,
          toName: 'Test Recipient',
          cc: [],
          bcc: []
        },
        description: '通用测试邮件，用于验证基本功能'
      },

      // Augment Code 测试场景
      ...augmentCodeTestDataGenerator.generateTestScenarios(monitorConfig.value.emailAddress)
    ];

    // 随机选择一个测试场景
    const randomScenario = testScenarios[Math.floor(Math.random() * testScenarios.length)];
    const testEmailData = randomScenario.data;

    // 在本地测试环境中，直接模拟邮件数据而不调用API
    if (isDevelopment.value) {
      // 本地测试：直接添加到邮件列表
      const simulatedEmail = {
        emailId: Date.now(), // 使用时间戳作为唯一ID
        sendEmail: testEmailData.fromEmail,
        name: testEmailData.fromName,
        subject: testEmailData.subject,
        content: testEmailData.content,
        text: testEmailData.text,
        toEmail: testEmailData.toEmail,
        toName: testEmailData.toName,
        matchedAddress: testEmailData.toEmail,
        matchType: '精确',
        emailTime: new Date().toISOString(),
        createTime: new Date().toISOString(),
        // 添加测试相关信息
        isTestEmail: true,
        testScenario: randomScenario.name,
        testDescription: randomScenario.description
      };

      // 如果是 Augment Code 测试邮件，添加验证码信息用于验证
      if (testEmailData.templateType === 'augment-code') {
        simulatedEmail.expectedVerificationCode = testEmailData.verificationCode;
        simulatedEmail.templateType = 'augment-code';
      }

      // 添加到邮件列表顶部
      emailsList.value.unshift(simulatedEmail);

      // 测试邮件模板系统
      if (typeof emailTemplateManager !== 'undefined') {
        const analysis = emailTemplateManager.analyzeEmail(simulatedEmail);
        console.log('📧 邮件模板分析结果:', {
          email: randomScenario.name,
          hasTemplate: analysis.hasTemplate,
          templateName: analysis.templateName,
          verificationCode: analysis.verificationCode,
          expectedCode: simulatedEmail.expectedVerificationCode,
          isCorrect: analysis.verificationCode === simulatedEmail.expectedVerificationCode,
          confidence: analysis.confidence
        });

        // 显示测试结果
        if (testEmailData.templateType === 'augment-code') {
          const isCorrect = analysis.verificationCode === simulatedEmail.expectedVerificationCode;
          const message = isCorrect
            ? `✅ ${randomScenario.name} - 模板识别成功！验证码: ${analysis.verificationCode}`
            : `⚠️ ${randomScenario.name} - 验证码提取${analysis.verificationCode ? '不准确' : '失败'}`;

          if (isCorrect) {
            ElMessage.success(message);
          } else {
            ElMessage.warning(message);
          }
        } else {
          ElMessage.success(`✅ ${randomScenario.name} - 测试邮件已添加`);
        }
      } else {
        ElMessage.success(`✅ ${randomScenario.name} - 测试邮件已添加`);
      }

      return;
    }

    // 生产环境：调用测试API
    const response = await fetch('/test/monitoring/simulate-new-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shareToken: shareToken,
        emailData: testEmailData,
        testScenario: randomScenario.name
      })
    });

    const result = await response.json();

    if (result.success && result.data) {
      ElMessage.success(`✅ ${randomScenario.name} - ${result.data.message}`);

      // 等待一下然后检查新邮件
      setTimeout(async () => {
        await checkForNewEmails();
      }, 1000);
    } else {
      throw new Error(result.message || '模拟邮件发送失败');
    }

  } catch (error) {
    console.error('模拟新邮件失败:', error);
    ElMessage.error(`❌ 模拟新邮件失败: ${error.message}`);
  } finally {
    simulating.value = false;
  }
};

// 专门测试 Augment Code 邮件模板的功能
const testAugmentCodeTemplate = async () => {
  if (testingTemplate.value || !monitorConfig.value) return;

  try {
    testingTemplate.value = true;

    // 生成多个 Augment Code 测试场景
    const testScenarios = augmentCodeTestDataGenerator.generateTestScenarios(monitorConfig.value.emailAddress);

    // 添加额外的边界测试场景
    const edgeTestScenarios = [
      // 测试场景：验证码在不同位置
      {
        name: 'Augment Code 验证码位置变化测试',
        data: (() => {
          const code = augmentCodeTestDataGenerator.generateVerificationCode();
          return {
            fromEmail: 'noreply@augmentcode.com',
            fromName: 'Augment Code',
            subject: 'Welcome to Augment Code',
            content: `<p>Welcome to Augment Code!</p><p>Your verification code is: ${code}</p><p>Please use this code to complete your registration.</p>`,
            text: `Welcome to Augment Code!\n\nYour verification code is: ${code}\n\nPlease use this code to complete your registration.`,
            toEmail: monitorConfig.value.emailAddress,
            toName: 'Edge Test User',
            cc: [],
            bcc: [],
            verificationCode: code,
            templateType: 'augment-code'
          };
        })(),
        description: '测试验证码在不同位置时的提取能力'
      },

      // 测试场景：主题变化
      {
        name: 'Augment Code 主题变化测试',
        data: (() => {
          const code = augmentCodeTestDataGenerator.generateVerificationCode();
          return {
            fromEmail: 'support@augmentcode.com',
            fromName: 'Augment Code',
            subject: 'Welcome to Augment Code - Verification Required',
            content: augmentCodeTestDataGenerator.generateHtmlContent(code),
            text: augmentCodeTestDataGenerator.generateEmailContent(code),
            toEmail: monitorConfig.value.emailAddress,
            toName: 'Subject Test User',
            cc: [],
            bcc: [],
            verificationCode: code,
            templateType: 'augment-code'
          };
        })(),
        description: '测试主题轻微变化时的模板匹配能力'
      }
    ];

    // 合并所有测试场景
    const allTestScenarios = [...testScenarios, ...edgeTestScenarios];

    // 测试结果统计
    const testResults = [];

    // 逐个测试每个场景
    for (let i = 0; i < allTestScenarios.length; i++) {
      const scenario = allTestScenarios[i];
      const testEmailData = scenario.data;

      // 创建模拟邮件对象
      const simulatedEmail = {
        emailId: Date.now() + i, // 确保唯一ID
        sendEmail: testEmailData.fromEmail,
        name: testEmailData.fromName,
        subject: testEmailData.subject,
        content: testEmailData.content,
        text: testEmailData.text,
        toEmail: testEmailData.toEmail,
        toName: testEmailData.toName,
        matchedAddress: testEmailData.toEmail,
        matchType: '精确',
        emailTime: new Date().toISOString(),
        createTime: new Date().toISOString(),
        isTestEmail: true,
        testScenario: scenario.name,
        testDescription: scenario.description,
        expectedVerificationCode: testEmailData.verificationCode,
        templateType: 'augment-code'
      };

      // 添加到邮件列表
      emailsList.value.unshift(simulatedEmail);

      // 测试邮件模板系统
      let testResult = {
        scenario: scenario.name,
        description: scenario.description,
        expectedCode: testEmailData.verificationCode,
        success: false,
        hasTemplate: false,
        templateName: null,
        extractedCode: null,
        confidence: 0
      };

      if (typeof emailTemplateManager !== 'undefined') {
        const analysis = emailTemplateManager.analyzeEmail(simulatedEmail);
        testResult = {
          ...testResult,
          hasTemplate: analysis.hasTemplate,
          templateName: analysis.templateName,
          extractedCode: analysis.verificationCode,
          confidence: analysis.confidence,
          success: analysis.verificationCode === testEmailData.verificationCode && analysis.hasTemplate
        };
      }

      testResults.push(testResult);

      // 短暂延迟，避免界面卡顿
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 显示测试结果摘要
    const successCount = testResults.filter(r => r.success).length;
    const totalCount = testResults.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);

    console.log('🧪 Augment Code 邮件模板测试结果:', {
      总测试数: totalCount,
      成功数: successCount,
      成功率: `${successRate}%`,
      详细结果: testResults
    });

    // 显示用户友好的测试结果
    if (successCount === totalCount) {
      ElMessage.success(`🎉 Augment Code 模板测试完美通过！(${successCount}/${totalCount}) - 成功率: ${successRate}%`);
    } else if (successCount > totalCount * 0.8) {
      ElMessage.warning(`⚠️ Augment Code 模板测试大部分通过 (${successCount}/${totalCount}) - 成功率: ${successRate}%`);
    } else {
      ElMessage.error(`❌ Augment Code 模板测试需要改进 (${successCount}/${totalCount}) - 成功率: ${successRate}%`);
    }

    // 显示详细的失败案例
    const failedTests = testResults.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.warn('❌ 失败的测试案例:', failedTests);
    }

  } catch (error) {
    console.error('Augment Code 模板测试失败:', error);
    ElMessage.error(`❌ 模板测试失败: ${error.message}`);
  } finally {
    testingTemplate.value = false;
  }
};

// 处理邮件内容点击事件（验证码高亮和复制）
const handleEmailContentClick = (event) => {
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
};






</script>

<style scoped>
.monitor-share-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
}

.monitor-share-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.share-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 24px 0;
  position: relative;
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 95vw;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* PC端大屏幕头部优化 */
@media (min-width: 1400px) {
  .header-content {
    max-width: 98vw;
    padding: 0 1vw;
  }
}

@media (min-width: 1920px) {
  .header-content {
    max-width: 99vw;
    padding: 0 0.5vw;
  }
}

/* 移动端全屏宽度 */
@media (max-width: 768px) {
  .header-content {
    max-width: none;
    padding: 0 16px;
  }
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 2;
}

.logo-glow {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  background: linear-gradient(45deg, #667eea, #764ba2);
  border-radius: 16px;
  opacity: 0.3;
  filter: blur(8px);
  z-index: 1;
}

.title-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #666;
  font-weight: 400;
}

.config-info {
  display: flex;
  gap: 16px;
}

.config-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  gap: 16px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  font-size: 16px;
}

.config-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-details .label {
  color: #666;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-details .value {
  color: #333;
  font-weight: 600;
  font-size: 14px;
}

.loading-container,
.error-container {
  max-width: 95vw;
  margin: 40px auto;
  padding: 0 20px;
  text-align: center;
}

/* PC端大屏幕加载/错误容器优化 */
@media (min-width: 1400px) {
  .loading-container,
  .error-container {
    max-width: 98vw;
    padding: 0 1vw;
  }
}

@media (min-width: 1920px) {
  .loading-container,
  .error-container {
    max-width: 99vw;
    padding: 0 0.5vw;
  }
}

/* 移动端全屏宽度 */
@media (max-width: 768px) {
  .loading-container,
  .error-container {
    max-width: none;
    margin: 20px 0;
    padding: 0 16px;
  }
}

.error-content {
  background: white;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.error-icon {
  color: #f56c6c;
  margin-bottom: 16px;
}

.emails-container {
  max-width: 95vw;
  margin: 20px auto;
  padding: 0 20px;
  height: calc(100vh - 200px);
  min-height: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* PC端大屏幕优化 */
@media (min-width: 1400px) {
  .emails-container {
    max-width: 98vw;
    padding: 0 1vw;
  }
}

@media (min-width: 1920px) {
  .emails-container {
    max-width: 99vw;
    padding: 0 0.5vw;
  }
}

/* 移动端全屏宽度和滚动优化 */
@media (max-width: 768px) {
  .emails-container {
    max-width: none;
    margin: 0;
    padding: 0;
    height: calc(100vh - 140px);
    min-height: 500px;
    /* 2025年移动端滚动优化 */
    -webkit-overflow-scrolling: touch; /* iOS惯性滚动 */
    overscroll-behavior: contain; /* 防止滚动链 */
    scroll-behavior: smooth; /* 平滑滚动 */
  }
}

.split-container {
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  
  /* 2025年移动端优化 */
  contain: layout style paint;
  will-change: transform;
}

/* 窗格切换动画和滚动优化 */
.split-container :deep(.splitpanes) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
}

.split-container :deep(.splitpanes__pane) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 分屏模式滚动优化 */
.split-container :deep(.splitpanes__pane:first-child) {
  /* 邮件列表面板 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.split-container :deep(.splitpanes__pane:last-child) {
  /* 邮件详情面板 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

/* 底部阅读窗格特殊优化 */
.split-container :deep(.splitpanes--horizontal .splitpanes__pane:first-child) {
  /* 底部分屏模式的上面板（邮件列表） */
  overflow: visible; /* 修复：允许滚动 */
  display: flex;
  flex-direction: column;
}

.split-container :deep(.splitpanes--horizontal .splitpanes__pane:first-child .emails-table) {
  /* 底部分屏模式的邮件表格 */
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  max-height: 100%;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.split-container :deep(.splitpanes--horizontal .splitpanes__pane:last-child) {
  /* 底部分屏模式的下面板（邮件详情） */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

/* 单面板模式动画 */
.single-pane {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateZ(0); /* 启用硬件加速 */
}

/* 邮件详情面板进入/退出动画 */
.email-detail-pane {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateZ(0); /* 启用硬件加速 */
}

/* 布局切换时的淡入淡出效果 */
.layout-transition-enter-active,
.layout-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.layout-transition-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.layout-transition-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.emails-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.emails-header h2 {
  margin: 0;
  color: white;
  font-size: 24px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.email-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.refresh-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.emails-table {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 16px;

  /* 2025年移动端滚动优化 */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 transparent;

  /* 优化：最大化垂直空间利用 */
  min-height: 0;
  max-height: calc(100vh - 300px); /* 动态计算最大高度，减去头部和其他元素高度 */
  height: auto;
}

/* 2025年现代化滚动条样式 */
.emails-table::-webkit-scrollbar {
  width: 4px;
}

.emails-table::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.emails-table::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #007AFF 0%, #5856D6 100%);
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  opacity: 0.6;
}

.emails-table::-webkit-scrollbar-thumb:hover {
  opacity: 1;
  background: linear-gradient(180deg, #0056CC 0%, #4A4A9F 100%);
}

/* 移动端滚动指示器 */
@media (max-width: 768px) {
  .emails-table::-webkit-scrollbar {
    width: 2px;
  }
  
  .emails-table::-webkit-scrollbar-thumb {
    background: rgba(0, 122, 255, 0.5);
    border-radius: 1px;
  }
  
  /* 滚动时显示指示器 */
  .emails-table {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 122, 255, 0.5) transparent;
  }
  
  /* 移动端滚动手势优化 */
  .emails-table {
    /* 启用硬件加速 */
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
    
    /* 优化滚动性能 */
    contain: layout style paint;
    content-visibility: auto;
    
    /* iOS 17风格的滚动阻尼 */
    scroll-snap-type: y proximity;
    scroll-padding: 16px;
  }
  
  /* 邮件行滚动优化 */
  :deep(.el-table__row) {
    contain: layout style paint;
    content-visibility: auto;
    contain-intrinsic-size: 0 60px;
  }
  
  /* 表格头部固定优化 */
  :deep(.el-table__header-wrapper) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}

.load-more,
.no-more {
  text-align: center;
  margin: 20px 0;
}

.no-more span {
  color: #909399;
  font-size: 14px;
}

.email-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.email-meta {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  margin-bottom: 8px;
  align-items: center;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-row label {
  min-width: 80px;
  color: #606266;
  font-weight: 500;
}

.content-header {
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

.content-body {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 16px;
  background: #fafafa;
  max-height: 400px;
  overflow-y: auto;
}

/* 邮件内容列样式 - 最大化空间利用率 */
.email-content-cell {
  max-width: none; /* 移除最大宽度限制，充分利用可用空间 */
  overflow: hidden;
  line-height: 1.3; /* 稍微紧凑的行高以容纳更多行 */
  padding: 4px 8px; /* 增加水平内边距以更好利用空间 */
}

/* 自动加载指示器样式 */
.auto-load-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #606266;
  font-size: 14px;
}

.auto-load-indicator .el-icon {
  font-size: 16px;
}

/* 邮件内容文字优化 - 提高可读性 */
.full-email-content {
  /* 增强文字对比度 */
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.1);

  /* 优化字体渲染 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* 确保文字不会被背景影响 */
  position: relative;
  z-index: 1;
}

/* 验证码高亮在小字号下的优化 */
.full-email-content :deep(.highlight-code) {
  font-weight: 600; /* 增强验证码的字重 */
  font-size: 1.1em; /* 稍微放大验证码 */
  text-shadow: 0 0 2px rgba(255, 193, 7, 0.3); /* 添加微妙的阴影 */
}

/* 邮箱地址高亮在小字号下的优化 */
.full-email-content :deep(.highlight-email) {
  font-weight: 500; /* 适中的字重 */
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

/* 发件人列单行显示优化 */
.sender-cell {
  /* 确保单行显示 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* 固定高度确保行高一致性 */
  height: 24px;
  line-height: 24px;

  /* 内边距优化 */
  padding: 0 4px;

  /* 字体优化 */
  font-size: 13px;
  font-weight: 400;

  /* 确保内容垂直居中 */
  display: flex;
  align-items: center;
}

.sender-cell span {
  /* 继承父容器的单行约束 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* 确保span占满容器宽度 */
  width: 100%;

  /* 文字渲染优化 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* 颜色和对比度优化 */
  color: var(--el-text-color-primary);

  /* 微妙的文字阴影提高可读性 */
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.05);
}

/* 发件人列悬停效果 */
.sender-cell:hover span {
  color: var(--el-color-primary);
  transition: color 0.2s ease;
}

/* 长邮箱地址的特殊处理 */
.sender-cell span[title] {
  cursor: help;
}

.sender-cell .long-email {
  /* 长邮箱地址的特殊标识 */
  position: relative;
}

.sender-cell .long-email::after {
  /* 为长邮箱地址添加微妙的视觉提示 */
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 3px;
  background: var(--el-color-primary);
  border-radius: 50%;
  opacity: 0.6;
}

/* 表格整体文字优化 */
:deep(.el-table) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

:deep(.el-table .el-table__header-wrapper .el-table__header) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

:deep(.el-table .el-table__body-wrapper .el-table__body) {
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

:deep(.el-table .el-table__cell) {
  padding: 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

/* 无阅读窗格模式表格优化 */
.single-pane :deep(.el-table .el-table__body-wrapper .el-table__body) {
  font-size: 14px;
  line-height: 1.6;
  font-weight: 500;
}

.single-pane :deep(.el-table .el-table__cell) {
  padding: 14px 10px;
}

.full-email-content {
  font-size: 12px; /* 缩小字号以提高信息密度 */
  line-height: 1.4; /* 优化行高以容纳更多行 */
  color: var(--el-text-color-primary);
  font-weight: 400; /* 减轻字重以提高可读性 */
  cursor: pointer;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 4; /* 增加到4行显示 */
  -webkit-box-orient: vertical;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 6px 10px; /* 稍微增加水平内边距 */
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.04) 0%, rgba(64, 158, 255, 0.02) 100%);
  border: 1px solid rgba(64, 158, 255, 0.08);
  margin: 2px 0;
  max-height: 72px; /* 4行 × 18px行高 = 72px */
  white-space: pre-wrap; /* 保留换行符以支持多行显示 */
}

.full-email-content:hover {
  color: var(--el-color-primary-dark-2);
  background: linear-gradient(135deg, var(--el-color-primary-light-8) 0%, var(--el-color-primary-light-7) 100%);
  border-color: var(--el-color-primary-light-4);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(64, 158, 255, 0.15);
}

/* 无阅读窗格模式特殊优化 - 最大化空间利用 */
.single-pane .full-email-content {
  font-size: 13px; /* 稍微缩小字号但保持可读性 */
  line-height: 1.5; /* 优化行高 */
  color: var(--el-text-color-primary);
  font-weight: 500; /* 适中的字重 */
  -webkit-line-clamp: 5; /* 增加到5行显示 */
  max-height: 97px; /* 5行 × 19.5px行高 = 97px */

  /* 最大化空间利用 */
  width: 100%; /* 充分利用整个列宽空间 */
  max-width: 800px; /* 设置合理的最大宽度以保持可读性 */
  padding: 8px 16px; /* 增加水平内边距以更好利用空间 */

  background: linear-gradient(135deg, rgba(64, 158, 255, 0.06) 0%, rgba(64, 158, 255, 0.03) 100%);
  border: 1px solid rgba(64, 158, 255, 0.12);
  margin: 4px 0;
  letter-spacing: 0.2px; /* 稍微减少字符间距 */
  white-space: pre-wrap; /* 保留换行符 */
}

.single-pane .full-email-content:hover {
  color: var(--el-color-primary-dark-2);
  background: linear-gradient(135deg, var(--el-color-primary-light-7) 0%, var(--el-color-primary-light-6) 100%);
  border-color: var(--el-color-primary-light-3);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(64, 158, 255, 0.25);
}

.no-content {
  color: #c0c4cc;
  font-style: italic;
}

/* 保留验证码样式用于内容中的高亮 */
.verification-codes-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.codes-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.verification-code-item {
  display: inline-block;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  border: 1px solid #ffb74d;
}

.verification-code-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(245, 124, 0, 0.3);
}

.no-code {
  color: #c0c4cc;
  font-size: 12px;
  font-style: italic;
}

/* 验证码和邮箱高亮样式 */
:deep(.email-highlight) {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  color: #1976d2;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: underline;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid #90caf9;
}

:deep(.email-highlight:hover) {
  background: linear-gradient(135deg, #bbdefb 0%, #90caf9 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

:deep(.code-highlight) {
  background: linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%);
  color: #f57c00;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: underline;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  transition: all 0.2s ease;
  border: 1px solid #ffb74d;
}

:deep(.code-highlight:hover) {
  background: linear-gradient(135deg, #ffcc02 0%, #ffa000 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(245, 124, 0, 0.3);
}

/* 点击反馈动画 */
:deep(.highlight-clicked) {
  animation: highlightPulse 0.3s ease;
}

@keyframes highlightPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

/* 内容预览样式 */
.content-preview {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
  max-height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subject-cell {
  display: flex;
  flex-direction: column;
}

.subject-text {
  font-weight: 500;
  color: #303133;
}

/* 自动刷新状态指示器 */
.auto-refresh-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 6px;
}

.auto-refresh-indicator.active {
  background: rgba(67, 160, 71, 0.9);
}

.refresh-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 移动端断点优化 */
@media (max-width: 320px) {
  /* 小屏手机 */
  .emails-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
    padding: 8px 12px;
    margin-bottom: 0;
  }
  
  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  
  .split-container {
    border-radius: 0;
    box-shadow: none;
  }
  
  .emails-table {
    padding: 0 4px;
  }
  
  .email-content-cell {
    max-width: 200px; /* 移动端增加宽度以显示更多内容 */
  }

  .full-email-content {
    font-size: 10px; /* 稍微增大字号提高可读性 */
    line-height: 1.3; /* 优化行高 */
    -webkit-line-clamp: 3; /* 增加到3行 */
    max-height: 39px; /* 3行 × 13px行高 = 39px */
    padding: 4px 6px; /* 减少内边距节省空间 */
  }

  /* 小屏手机发件人列优化 */
  .sender-cell {
    height: 20px;
    line-height: 20px;
    font-size: 11px;
    padding: 0 2px;
  }
  
  .content-preview {
    display: none;
  }
  
  /* 表格优化 */
  :deep(.el-table .el-table__cell) {
    padding: 6px 2px;
    font-size: 11px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:first-child),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:first-child) {
    min-width: 100px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:nth-child(2)),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:nth-child(2)) {
    width: 80px;
    min-width: 80px;
  }
}

@media (min-width: 321px) and (max-width: 375px) {
  /* 标准手机 */
  .emails-header {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    padding: 10px 14px;
    margin-bottom: 0;
  }
  
  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  
  .split-container {
    border-radius: 0;
    box-shadow: none;
  }
  
  .emails-table {
    padding: 0 6px;
  }
  
  .email-content-cell {
    max-width: 220px; /* 标准手机进一步增加宽度 */
  }

  .full-email-content {
    font-size: 11px; /* 增大字号 */
    line-height: 1.3; /* 优化行高 */
    -webkit-line-clamp: 3; /* 增加到3行 */
    max-height: 43px; /* 3行 × 14.3px行高 = 43px */
    padding: 4px 8px; /* 适当的内边距 */
  }

  /* 标准手机发件人列优化 */
  .sender-cell {
    height: 22px;
    line-height: 22px;
    font-size: 12px;
    padding: 0 3px;
  }
  
  .content-preview {
    display: none;
  }
  
  /* 表格优化 */
  :deep(.el-table .el-table__cell) {
    padding: 7px 3px;
    font-size: 12px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:first-child),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:first-child) {
    min-width: 120px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:nth-child(2)),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:nth-child(2)) {
    width: 100px;
    min-width: 100px;
  }
}

@media (min-width: 376px) and (max-width: 414px) {
  /* 大屏手机 */
  .emails-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    padding: 12px 16px;
    margin-bottom: 0;
  }
  
  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  
  .split-container {
    border-radius: 0;
    box-shadow: none;
  }
  
  .emails-table {
    padding: 0 8px;
  }
  
  .email-content-cell {
    max-width: 250px; /* 大屏手机进一步增加宽度 */
  }

  .full-email-content {
    font-size: 11px; /* 增大字号 */
    line-height: 1.4; /* 优化行高 */
    -webkit-line-clamp: 4; /* 增加到4行 */
    max-height: 62px; /* 4行 × 15.4px行高 = 62px */
    padding: 5px 8px; /* 适当的内边距 */
  }

  /* 大屏手机发件人列优化 */
  .sender-cell {
    height: 23px;
    line-height: 23px;
    font-size: 12px;
    padding: 0 4px;
  }
  
  .content-preview {
    display: none;
  }
  
  /* 表格优化 */
  :deep(.el-table .el-table__cell) {
    padding: 8px 4px;
    font-size: 12px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:first-child),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:first-child) {
    min-width: 140px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:nth-child(2)),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:nth-child(2)) {
    width: 120px;
    min-width: 120px;
  }
}

@media (min-width: 415px) and (max-width: 768px) {
  /* 平板竖屏 */
  .emails-header {
    flex-direction: row;
    gap: 16px;
    align-items: center;
    padding: 16px 20px;
    margin-bottom: 0;
  }
  
  .header-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;
  }
  
  .split-container {
    border-radius: 4px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
  }
  
  .emails-table {
    padding: 0 12px;
  }
  
  .email-content-cell {
    max-width: 320px; /* 平板竖屏最大化内容显示空间 */
  }

  .full-email-content {
    font-size: 12px; /* 接近桌面端字号 */
    line-height: 1.4; /* 优化行高 */
    -webkit-line-clamp: 4; /* 增加到4行 */
    max-height: 67px; /* 4行 × 16.8px行高 = 67px */
    padding: 6px 10px; /* 适当的内边距 */
  }

  /* 平板竖屏发件人列优化 */
  .sender-cell {
    height: 24px;
    line-height: 24px;
    font-size: 13px;
    padding: 0 4px;
  }
  
  /* 表格优化 */
  :deep(.el-table .el-table__cell) {
    padding: 10px 6px;
    font-size: 13px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:first-child),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:first-child) {
    min-width: 160px;
  }
  
  :deep(.el-table .el-table__header-wrapper .el-table__header .el-table__cell:nth-child(2)),
  :deep(.el-table .el-table__body-wrapper .el-table__body .el-table__cell:nth-child(2)) {
    width: 150px;
    min-width: 150px;
  }
}

/* 2025年移动端触摸交互优化 */
@media (hover: none) and (pointer: coarse) {
  /* 根容器触摸优化 */
  .monitor-share-page {
    touch-action: pan-y pinch-zoom;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  
  /* 邮件表格滚动优化 */
  .emails-table {
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    
    /* iOS 17风格的橡皮筋效果 */
    scroll-snap-type: y proximity;
    scroll-padding-top: 20px;
  }
  
  /* 增强的可点击区域 */
  :deep(.el-table .el-table__row) {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }
  
  /* iOS 17风格的触摸反馈 */
  :deep(.el-table .el-table__row::before) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at center, rgba(0, 122, 255, 0.1) 0%, transparent 70%);
    opacity: 0;
    transform: scale(0);
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    pointer-events: none;
  }
  
  :deep(.el-table .el-table__row:active::before) {
    opacity: 1;
    transform: scale(1);
  }
  
  :deep(.el-table .el-table__row:active) {
    background-color: rgba(0, 122, 255, 0.05);
    transform: scale(0.995);
  }
  
  /* Android 14风格的按钮触摸优化 */
  .header-actions .el-button {
    min-height: 48px;
    min-width: 48px;
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }
  
  .header-actions .el-button::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.4s ease, height 0.4s ease;
    pointer-events: none;
  }
  
  .header-actions .el-button:active::before {
    width: 120px;
    height: 120px;
  }
  
  .header-actions .el-button:active {
    transform: scale(0.96);
    background-color: var(--el-color-primary-light-3);
  }
  
  /* 邮件内容现代化触摸反馈 */
  .full-email-content {
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  
  .full-email-content:active {
    background-color: rgba(0, 122, 255, 0.08);
    transform: scale(0.98);
    border-radius: 6px;
  }
  
  /* 布局切换按钮增强触摸反馈 */
  :deep(.layout-mode-selector .el-button) {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }
  
  :deep(.layout-mode-selector .el-button::after) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.6s ease;
    pointer-events: none;
  }
  
  :deep(.layout-mode-selector .el-button:active::after) {
    transform: translateX(100%);
  }
}

/* 现代化邮件卡片样式 */
.emails-container {
  max-width: 95vw;
  margin: 0 auto;
  padding: 0 20px 40px;
  position: relative;
  z-index: 5;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  opacity: 0.8;
  font-size: 14px;
}

.emails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.email-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.email-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.email-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.email-card.selected {
  border-color: #667eea;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
}

.email-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.sender-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.sender-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.sender-details {
  flex: 1;
  min-width: 0;
}

.sender-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sender-email {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-time {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
}

.email-card-body {
  margin-bottom: 16px;
}

.email-subject {
  font-weight: 600;
  color: #333;
  font-size: 16px;
  margin-bottom: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.verification-codes {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}

.codes-label {
  color: white;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.9;
}

.codes-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.verification-code {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 6px 12px;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.verification-code:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.email-preview {
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.email-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.email-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.email-actions {
  flex-shrink: 0;
}

.load-more-indicator, .no-more-indicator {
  text-align: center;
  padding: 20px;
  color: white;
  margin-top: 20px;
}

.no-more-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .emails-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .email-card {
    padding: 16px;
  }

  .email-card-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .sender-info {
    width: 100%;
  }

  .email-time {
    align-self: flex-end;
  }
}

@media (max-width: 480px) {
  .emails-container {
    padding: 0 16px 40px;
  }

  .verification-code {
    font-size: 14px;
    padding: 4px 8px;
  }
}
</style>
