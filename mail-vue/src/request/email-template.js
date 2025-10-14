import request from '@/axios';

// 获取用户的模板列表
export function getUserTemplates(params = {}) {
  return request({
    url: '/api/email-template/user-templates',
    method: 'get',
    params
  });
}

// 获取所有可用模板（包括系统预设）
export function getAvailableTemplates() {
  return request({
    url: '/api/email-template/available-templates',
    method: 'get'
  });
}

// 根据ID获取模板详情
export function getTemplateById(templateId) {
  return request({
    url: `/api/email-template/${templateId}`,
    method: 'get'
  });
}

// 创建新模板
export function createTemplate(data) {
  return request({
    url: '/api/email-template',
    method: 'post',
    data
  });
}

// 更新模板
export function updateTemplate(templateId, data) {
  return request({
    url: `/api/email-template/${templateId}`,
    method: 'put',
    data
  });
}

// 删除模板
export function deleteTemplate(templateId) {
  return request({
    url: `/api/email-template/${templateId}`,
    method: 'delete'
  });
}

// 测试模板匹配
export function testTemplate(templateId, testEmail) {
  return request({
    url: `/api/email-template/${templateId}/test`,
    method: 'post',
    data: { testEmail }
  });
}
