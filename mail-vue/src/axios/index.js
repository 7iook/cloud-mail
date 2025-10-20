import axios from "axios";
import router from "@/router";
import i18n from "@/i18n/index.js";
import {useSettingStore} from "@/store/setting.js";
import safeStorage from '@/utils/safeStorage.js';

let http = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL
});

http.interceptors.request.use(config => {
    const { lang } = useSettingStore();
    const token = safeStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['accept-language'] = lang
    return config
})

http.interceptors.response.use((res) => {

        return new Promise((resolve, reject) => {

            const showMsg = res.config.noMsg;
            const data = res.data

            if (showMsg) {

                data.code === 200 ? resolve(data.data) : reject(data)

            } else if (data.code === 401) {
                // 检查是否是分享页面的请求
                if (res.config && res.config.sharePageRequest) {
                    // 分享页面的401错误，显示友好提示，不跳转登录页面
                    ElMessage({
                        message: '分享链接已失效或权限不足',
                        type: 'warning',
                        plain: true,
                        grouping: true,
                        repeatNum: -4,
                    })
                    return Promise.reject(data)
                }

                ElMessage({
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                safeStorage.removeItem('token')
                router.push('/login')
                reject(data)
            } else if (data.code === 403) {
                // 检查是否是分享页面的请求
                if (res.config && res.config.sharePageRequest) {
                    // 分享页面的403错误，显示友好提示，不跳转登录页面
                    ElMessage({
                        message: '分享链接已被禁用或权限被拒绝',
                        type: 'warning',
                        plain: true,
                        grouping: true,
                        repeatNum: -4,
                    })
                    return Promise.reject(data)
                }

                ElMessage({
                    message: data.message,
                    type: 'warning',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)

            } else if (data.code === 502) {
                ElMessage({
                    dangerouslyUseHTMLString: true,
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)
            } else if (data.code !== 200) {
                ElMessage({
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                reject(data)
            }
            resolve(data.data)
        })
    },
    (error) => {

        // 处理 HTTP 429 频率限制错误
        if (error.response && error.response.status === 429) {
            // 检查是否是分享页面的请求
            if (error.config && error.config.sharePageRequest) {
                // 分享页面的429错误，不显示消息，让页面自己处理
                const retryAfter = error.response.headers['retry-after'] || 60
                const err = new Error('Rate limit exceeded')
                err.status = 429
                err.code = 429
                err.retryAfter = parseInt(retryAfter)
                return Promise.reject(err)
            }

            // 非分享页面的429错误，显示提示
            ElMessage({
                message: '请求过于频繁，请稍后再试',
                type: 'warning',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
            return Promise.reject(error)
        }

        if (error.response && error.response.status === 403) {
            // 检查是否是分享页面的请求
            if (error.config && error.config.sharePageRequest) {
                // 分享页面的403错误，显示友好提示，不跳转登录页面
                ElMessage({
                    message: '请求过于频繁，请稍后再试',
                    type: 'warning',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                return Promise.reject(error)
            }

            // 非分享页面的403错误，执行原有逻辑
            ElMessage({
                message: i18n.global.t('accessDeniedMsg') || '访问被拒绝，请重新登录',
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
            // 清除token并重定向到登录页
            safeStorage.removeItem('token')
            router.push('/login')
            return Promise.reject(error)
        }

        const showMsg = error.config.noMsg;

        if (showMsg) {
            return Promise.reject(error)
        } else if (error.message.includes('Network Error')) {
            ElMessage({
                message: i18n.global.t('networkErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        } else if (error.code === 'ECONNABORTED') {
            ElMessage({
                message: i18n.global.t('timeoutErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true
            })
            ElMessage.error('')
        } else if (error.response) {
            ElMessage({
                message: i18n.global.t('serverBusyErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        } else {
            ElMessage({
                message: i18n.global.t('reqFailErrorMsg'),
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
        }
        return Promise.reject(error)
    })

export default http


