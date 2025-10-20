import http from '@/axios/index.js';

// 创建邮箱分享
export function createShare(data) {
    return http.post('/share/create', data);
}

// 获取分享信息
export function getShareInfo(shareToken) {
    return http.get(`/share/info/${shareToken}`, { sharePageRequest: true });
}

// 获取分享邮件列表
export function getShareEmails(shareToken, params) {
    return http.get(`/share/emails/${shareToken}`, { params, sharePageRequest: true });
}

// 获取分享列表
export function getShareList(params) {
    return http.get('/share/list', { params });
}

// 删除分享
export function deleteShare(shareId) {
    return http.delete(`/share/${shareId}`);
}

// 获取邮箱白名单
export function getShareWhitelist() {
    return http.get('/setting/query').then(response => {
        const settings = response.data || response;
        const whitelist = settings.shareWhitelist || '';
        return whitelist.split(',').filter(email => email.trim());
    });
}

// 更新邮箱白名单
export function updateShareWhitelist(emails) {
    const shareWhitelist = emails.join(',');
    return http.put('/setting/set', { shareWhitelist });
}

// 获取分享访问日志
export function getShareLogs(params) {
    const { shareId, ...queryParams } = params;
    if (shareId) {
        return http.get(`/share/logs/${shareId}`, { params: queryParams });
    } else {
        // 如果没有指定shareId，查询全局访问日志
        return http.get('/share/globalStats', { params: queryParams }).then(response => {
            // axios拦截器已经解包了data.data，所以response直接就是数据对象
            console.log('全局统计API响应:', response);
            console.log('response.accessLogs:', response?.accessLogs);

            // 将全局统计API的响应格式转换为访问日志格式
            if (response && response.accessLogs) {
                console.log('找到accessLogs，数据长度:', response.accessLogs.length);
                return {
                    data: {
                        list: response.accessLogs,
                        total: response.total || response.accessLogs.length,
                        page: response.page || 1,
                        pageSize: response.pageSize || 20
                    }
                };
            }
            console.log('accessLogs不存在，返回空数据');
            return { data: { list: [], total: 0 } };
        });
    }
}

// 获取分享访问统计
export function getShareStats(shareId, params = {}) {
    return http.get(`/share/stats/${shareId}`, { params });
}

// 刷新分享Token
export function refreshShareToken(shareId) {
    return http.post(`/share/${shareId}/refresh-token`);
}

// 批量操作分享（延长有效期、禁用、启用）
export function batchOperateShares(action, shareIds, options = {}) {
    return http.post('/share/batch', {
        action,
        shareIds,
        ...options
    });
}

// 更新分享状态
export function updateShareStatus(shareId, status) {
    return http.patch(`/share/${shareId}/status`, { status });
}

// 更新分享每日限额
export function updateShareLimit(shareId, otpLimitDaily) {
    return http.post(`/share/${shareId}/update-limit`, { otpLimitDaily });
}

// 更新分享显示限制
export function updateShareDisplayLimit(shareId, verificationCodeLimit) {
    return http.post(`/share/${shareId}/update-display-limit`, { verificationCodeLimit });
}

export function updateShareName(shareId, shareName) {
    return http.patch(`/share/${shareId}/name`, { shareName });
}

export function updateShareExpireTime(shareId, expireTime) {
    return http.patch(`/share/${shareId}/expire`, { expireTime });
}

// 更新分享高级设置（频率限制和关键词过滤）
export function updateShareAdvancedSettings(shareId, settings) {
    return http.patch(`/share/${shareId}/advanced-settings`, settings);
}

// 获取全局分享统计（所有分享记录的汇总）
export function getGlobalShareStats(params) {
    return http.get('/share/globalStats', { params });
}

// 获取访问详情（验证码和邮件列表）
export function getAccessDetail(logId) {
    return http.get(`/share/access-detail/${logId}`);
}
