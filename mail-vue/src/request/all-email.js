import http from '@/axios/index.js';

export function allEmailList(params) {
    return http.get('/allEmail/list', {params: {...params}})
}

export function allEmailDelete(emailIds) {
    return http.delete('/allEmail/delete?emailIds=' + emailIds)
}

export function allEmailBatchDelete(params) {
    return http.delete('/allEmail/batchDelete', {params: params} )
}

export function allEmailLatest(emailId) {
    return http.get('/allEmail/latest', {params: {emailId}, noMsg: true })
}

/**
 * 获取所有唯一收件邮箱地址(用于白名单导入)
 * @param {Object} params - 查询参数
 * @param {string} params.search - 搜索关键词(可选)
 * @param {number} params.page - 页码(可选，默认1)
 * @param {number} params.pageSize - 每页数量(可选，默认100)
 * @param {string} params.orderBy - 排序方式(可选，'email'|'count')
 * @returns {Promise} 返回唯一邮箱列表
 */
export function getUniqueRecipients(params = {}) {
    return http.get('/allEmail/uniqueRecipients', { params })
}
