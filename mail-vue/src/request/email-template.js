import http from '@/axios/index.js';

// 获取用户的模板列表
export const getUserTemplates = (params = {}) => {
  return http.get('/email-template/list', { params });
};

// 获取所有可用模板（包括系统预设）
export const getAvailableTemplates = () => {
  return http.get('/email-template/available');
};

// 获取模板详情
export const getTemplateById = (templateId) => {
  return http.get(`/email-template/${templateId}`);
};

// 创建新模板
export const createTemplate = (data) => {
  return http.post('/email-template/create', data);
};

// 更新模板
export const updateTemplate = (templateId, data) => {
  return http.put(`/email-template/${templateId}`, data);
};

// 删除模板
export const deleteTemplate = (templateId) => {
  return http.delete(`/email-template/${templateId}`);
};

// 测试模板
export const testTemplate = (templateId, testEmail) => {
  return http.post(`/email-template/${templateId}/test`, { testEmail });
};

// 初始化系统预设模板
export const initializePresetTemplates = () => {
  return http.post('/email-template/initialize-presets');
};

// 切换模板启用状态
export const toggleTemplateActive = (templateId) => {
  return http.post(`/email-template/${templateId}/toggle-active`);
};

// 批量更新模板启用状态
export const batchUpdateTemplateActive = (templateIds, isActive) => {
  return http.post('/email-template/batch-update-active', { templateIds, isActive });
};