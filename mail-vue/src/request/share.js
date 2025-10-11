import http from '@/axios/index.js';

// 创建邮箱分享
export function createShare(data) {
    return http.post('/share/create', data);
}

// 获取分享信息
export function getShareInfo(shareToken) {
    return http.get(`/api/share/info/${shareToken}`);
}

// 获取分享邮件列表
export function getShareEmails(shareToken, params) {
    return http.get(`/share/emails/${shareToken}`, { params });
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
        // 如果没有指定shareId，返回空结果
        return Promise.resolve({ data: { list: [], total: 0 } });
    }
}

// 获取分享访问统计
export function getShareStats(shareId, params = {}) {
    return http.get(`/share/stats/${shareId}`, { params });
}
