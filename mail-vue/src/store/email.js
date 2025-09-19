import { defineStore } from 'pinia'

export const useEmailStore = defineStore('email', {
    state: () => ({
        deleteIds: 0,
        starScroll: null,
        emailScroll: null,
        cancelStarEmailId: 0,
        addStarEmailId: 0,
        contentData: {
            email: null,
            delType: null,
            showStar: true,
            showReply: true,
        },
        sendScroll: null,
        // 分屏布局相关状态
        splitLayout: {
            mode: 'none', // 'none' | 'right' | 'bottom'
            selectedEmail: null, // 当前选中的邮件
            showDetailPane: false, // 是否显示详情面板
            paneSizes: {
                right: [40, 60], // 右侧分屏比例 [列表, 详情]
                bottom: [60, 40] // 底部分屏比例 [列表, 详情]
            }
        }
    }),
    actions: {
        // 设置分屏模式
        setSplitMode(mode) {
            this.splitLayout.mode = mode

            // 如果切换到无分屏模式，隐藏详情面板
            if (mode === 'none') {
                this.splitLayout.showDetailPane = false
                this.splitLayout.selectedEmail = null
            }

            // 保存到 localStorage
            this.saveSplitLayoutToStorage()
        },

        // 选择邮件
        selectEmail(email) {
            this.splitLayout.selectedEmail = email

            // 如果是分屏模式，显示详情面板
            if (this.splitLayout.mode !== 'none') {
                this.splitLayout.showDetailPane = true
            }

            // 保存到 localStorage
            this.saveSplitLayoutToStorage()
        },

        // 关闭详情面板
        closeDetailPane() {
            this.splitLayout.showDetailPane = false
            this.splitLayout.selectedEmail = null
            this.saveSplitLayoutToStorage()
        },

        // 保存分屏布局到 localStorage
        saveSplitLayoutToStorage() {
            localStorage.setItem('emailSplitLayout', JSON.stringify(this.splitLayout))
        },

        // 从 localStorage 加载分屏布局
        loadSplitLayoutFromStorage() {
            const saved = localStorage.getItem('emailSplitLayout')
            if (saved) {
                try {
                    const parsed = JSON.parse(saved)
                    this.splitLayout = { ...this.splitLayout, ...parsed }
                } catch (error) {
                    console.warn('Failed to parse split layout from localStorage:', error)
                }
            }
        }
    },
    persist: {
        pick: ['contentData'],
    },
})
