import axios from "axios";
import router from "@/router";
import i18n from "@/i18n/index.js";
import {useSettingStore} from "@/store/setting.js";

let http = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL
});

http.interceptors.request.use(config => {
    const { lang } = useSettingStore();
    const token = localStorage.getItem('token');
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
                ElMessage({
                    message: data.message,
                    type: 'error',
                    plain: true,
                    grouping: true,
                    repeatNum: -4,
                })
                localStorage.removeItem('token')
                router.push('/login')
                reject(data)
            } else if (data.code === 403) {
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

        if (error.status === 403) {
            // 不刷新页面，避免无限循环
            ElMessage({
                message: i18n.global.t('accessDeniedMsg') || '访问被拒绝，请重新登录',
                type: 'error',
                plain: true,
                grouping: true,
                repeatNum: -4,
            })
            // 清除token并重定向到登录页
            localStorage.removeItem('token')
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


