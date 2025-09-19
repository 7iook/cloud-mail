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
 * 复制文本并显示现代化反馈提示
 * @param {string} text - 要复制的文本
 * @param {Object} options - 配置选项
 * @returns {Promise} 复制结果
 */
export async function copyTextWithFeedback(text, options = {}) {
    const {
        successMessage = '复制成功',
        errorMessage = '复制失败',
        showToast = true,
        duration = 2000
    } = options;

    try {
        await copyText(text);

        if (showToast) {
            showCopyFeedback(successMessage, 'success', duration);
        }

        return { success: true, text };
    } catch (error) {
        console.error('Copy failed:', error);

        if (showToast) {
            showCopyFeedback(errorMessage, 'error', duration);
        }

        return { success: false, error };
    }
}

/**
 * 显示2025年现代化复制反馈提示 - 增强版
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型 (success/error)
 * @param {number} duration - 显示时长
 */
function showCopyFeedback(message, type = 'success', duration = 2000) {
    // 移除现有的反馈提示，避免重叠
    const existingFeedback = document.querySelector('.copy-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }

    // 创建反馈元素
    const feedback = document.createElement('div');
    feedback.className = `copy-feedback copy-feedback-${type}`;

    // 支持HTML内容（如emoji）
    feedback.innerHTML = message;

    // 添加关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'copy-feedback-close';
    closeBtn.onclick = () => closeFeedback(feedback);
    feedback.appendChild(closeBtn);

    // 添加到页面
    document.body.appendChild(feedback);

    // 触发动画
    requestAnimationFrame(() => {
        feedback.classList.add('copy-feedback-show');
    });

    // 自动移除
    const autoCloseTimer = setTimeout(() => {
        closeFeedback(feedback);
    }, duration);

    // 鼠标悬停时暂停自动关闭
    feedback.addEventListener('mouseenter', () => {
        clearTimeout(autoCloseTimer);
    });

    feedback.addEventListener('mouseleave', () => {
        setTimeout(() => closeFeedback(feedback), 1000);
    });
}

/**
 * 关闭反馈提示
 * @param {HTMLElement} feedback - 反馈元素
 */
function closeFeedback(feedback) {
    if (feedback && feedback.parentNode) {
        feedback.classList.add('copy-feedback-hide');
        setTimeout(() => {
            if (feedback.parentNode) {
                document.body.removeChild(feedback);
            }
        }, 300);
    }
}

