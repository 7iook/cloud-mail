export async function copyText(text) {
    const value = text == null ? '' : String(text)

    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
        return await navigator.clipboard.writeText(value)
    }

    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea')
            ta.value = value
            ta.setAttribute('readonly', '')

            // 避免页面抖动、滚动与可视影响
            const s = ta.style
            s.position = 'fixed'
            s.top = '0'
            s.left = '0'
            s.width = '1px'
            s.height = '1px'
            s.padding = '0'
            s.border = '0'
            s.outline = 'none'
            s.boxShadow = 'none'
            s.background = 'transparent'
            s.opacity = '0'

            document.body.appendChild(ta)

            // 选择内容
            ta.focus()
            ta.select()

            let ok = false
            try {
                ok = document.execCommand('copy')
            } catch (err) {
                return reject(err)
            } finally {
                document.body.removeChild(ta)
            }
            ok ? resolve() : reject(new Error('Copy command unsuccessful'))
        } catch (e) {
            reject(e)
        }
    })
}

/**
 * 复制文本并显示现代化反馈提示 - 2025年增强版
 * @param {string} text - 要复制的文本
 * @param {Object} options - 配置选项
 * @returns {Promise} 复制结果
 */
export async function copyTextWithFeedback(text, options = {}) {
    const {
        successMessage = '复制成功',
        errorMessage = '复制失败',
        showToast = true,
        duration = 3000,
        type = 'success',
        position = 'top-right',
        showProgress = true,
        pauseOnHover = true
    } = options;

    try {
        await copyText(text);

        if (showToast) {
            showModernToast({
                type: 'success',
                message: successMessage,
                duration,
                position,
                showProgress,
                pauseOnHover
            });
        }

        return { success: true, text };
    } catch (error) {
        console.error('Copy failed:', error);

        if (showToast) {
            showModernToast({
                type: 'error',
                message: errorMessage,
                duration: duration + 1000, // 错误消息显示更久
                position,
                showProgress,
                pauseOnHover
            });
        }

        return { success: false, error };
    }
}

/**
 * 现代化 Toast 通知系统 - 基于 2025 年最佳实践
 */
let toastContainer = null;
let toastCounter = 0;

/**
 * 初始化 Toast 容器
 */
function initToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'modern-toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-label', 'Notifications');

        // 设置容器样式 - 优化为顶部中间显示，避免与浏览器UI冲突
        Object.assign(toastContainer.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: '320px',
            width: 'auto'
        });

        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * 显示现代化 Toast 通知
 * @param {Object} options - 配置选项
 */
function showModernToast(options = {}) {
    const {
        type = 'success',
        message = '',
        duration = 3000,
        showProgress = true,
        pauseOnHover = true,
        closable = true
    } = options;

    const container = initToastContainer();
    const toastId = `toast-${Date.now()}-${++toastCounter}`;

    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = `modern-toast modern-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('data-toast-id', toastId);

    // 设置基础样式 - 缩小尺寸，优化显示效果
    Object.assign(toast.style, {
        background: '#ffffff',
        color: '#1f2937',
        padding: '12px 16px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        fontSize: '13px',
        fontWeight: '500',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '240px',
        maxWidth: '320px',
        wordWrap: 'break-word',
        borderLeft: '3px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    // 设置类型特定样式
    const typeStyles = {
        success: {
            borderLeftColor: '#10b981',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))'
        },
        error: {
            borderLeftColor: '#ef4444',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))'
        },
        warning: {
            borderLeftColor: '#f59e0b',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))'
        },
        info: {
            borderLeftColor: '#3b82f6',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))'
        }
    };

    Object.assign(toast.style, typeStyles[type] || typeStyles.info);

    // 创建内容
    const content = createToastContent(type, message, closable, showProgress);
    toast.innerHTML = content;

    // 添加到容器
    container.appendChild(toast);

    // 绑定事件
    bindToastEvents(toast, toastId, duration, pauseOnHover, showProgress);

    // 触发显示动画 - 从顶部滑入
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        // 添加特殊动画效果
        if (type === 'error') {
            toast.style.animation = 'shake 0.5s ease-in-out';
        } else if (type === 'success') {
            toast.style.animation = 'slideInDown 0.4s ease-out';
        }
    });

    return toastId;
}

/**
 * 创建 Toast 内容
 * @param {string} type - Toast 类型
 * @param {string} message - 消息内容
 * @param {boolean} closable - 是否可关闭
 * @param {boolean} showProgress - 是否显示进度条
 * @returns {string} HTML 内容
 */
function createToastContent(type, message, closable, showProgress) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    let content = `
        <div class="toast-icon" style="font-size: 18px; flex-shrink: 0;">
            ${icons[type] || icons.info}
        </div>
        <div class="toast-content" style="flex: 1; line-height: 1.5;">
            ${message}
        </div>
    `;

    if (closable) {
        content += `
            <button class="toast-close" style="
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                border: none;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: #6b7280;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(0, 0, 0, 0.2)'"
               onmouseout="this.style.background='rgba(0, 0, 0, 0.1)'">
                ×
            </button>
        `;
    }

    if (showProgress) {
        content += `
            <div class="toast-progress" style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: currentColor;
                opacity: 0.3;
                transition: width linear;
                width: 100%;
            "></div>
        `;
    }

    return content;
}

/**
 * 绑定 Toast 事件
 * @param {HTMLElement} toast - Toast 元素
 * @param {string} toastId - Toast ID
 * @param {number} duration - 持续时间
 * @param {boolean} pauseOnHover - 悬停时暂停
 * @param {boolean} showProgress - 显示进度条
 */
function bindToastEvents(toast, toastId, duration, pauseOnHover, showProgress) {
    let timer = null;
    let startTime = null;
    let remainingTime = duration;
    let isPaused = false;

    // 关闭按钮事件
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => removeToast(toast));
    }

    // 点击整个 toast 关闭
    toast.addEventListener('click', () => removeToast(toast));
    toast.style.cursor = 'pointer';

    // 开始计时器
    function startTimer() {
        if (duration > 0) {
            startTime = Date.now();
            timer = setTimeout(() => {
                removeToast(toast);
            }, remainingTime);

            // 更新进度条
            if (showProgress) {
                const progressBar = toast.querySelector('.toast-progress');
                if (progressBar) {
                    progressBar.style.transition = `width ${remainingTime}ms linear`;
                    requestAnimationFrame(() => {
                        progressBar.style.width = '0%';
                    });
                }
            }
        }
    }

    // 暂停计时器
    function pauseTimer() {
        if (timer && !isPaused) {
            clearTimeout(timer);
            remainingTime -= Date.now() - startTime;
            isPaused = true;

            // 暂停进度条
            if (showProgress) {
                const progressBar = toast.querySelector('.toast-progress');
                if (progressBar) {
                    progressBar.style.transition = 'none';
                }
            }
        }
    }

    // 恢复计时器
    function resumeTimer() {
        if (isPaused && remainingTime > 0) {
            startTimer();
            isPaused = false;
        }
    }

    // 悬停暂停功能
    if (pauseOnHover) {
        toast.addEventListener('mouseenter', pauseTimer);
        toast.addEventListener('mouseleave', resumeTimer);
    }

    // 键盘支持
    toast.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            removeToast(toast);
        }
    });

    // 开始计时
    startTimer();
}

/**
 * 移除 Toast
 * @param {HTMLElement} toast - Toast 元素
 */
function removeToast(toast) {
    if (toast && toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

