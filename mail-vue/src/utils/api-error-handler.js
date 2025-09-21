/**
 * 前端API错误处理工具
 * 统一处理API请求错误，提供重试和降级机制
 */

import { ElMessage, ElNotification } from 'element-plus'

/**
 * API错误类型枚举
 */
export const API_ERROR_TYPES = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  DEBUG_DISABLED: 'DEBUG_DISABLED',
  CORS: 'CORS',
  UNKNOWN: 'UNKNOWN'
}

/**
 * 错误严重程度枚举
 */
export const ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
}

/**
 * 分析API错误类型
 * @param {Error|Response} error - 错误对象或响应对象
 * @returns {object} 错误分析结果
 */
export function analyzeApiError(error) {
  const analysis = {
    type: API_ERROR_TYPES.UNKNOWN,
    severity: ERROR_SEVERITY.MEDIUM,
    message: '未知错误',
    suggestion: '请稍后重试',
    retryable: true,
    fallbackAvailable: false
  }

  // 网络错误
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    analysis.type = API_ERROR_TYPES.NETWORK
    analysis.severity = ERROR_SEVERITY.HIGH
    analysis.message = '网络连接失败'
    analysis.suggestion = '请检查网络连接后重试'
    analysis.retryable = true
  }
  // 超时错误
  else if (error.name === 'AbortError' || error.message.includes('timeout')) {
    analysis.type = API_ERROR_TYPES.TIMEOUT
    analysis.severity = ERROR_SEVERITY.MEDIUM
    analysis.message = '请求超时'
    analysis.suggestion = '服务器响应较慢，请稍后重试'
    analysis.retryable = true
  }
  // HTTP状态码错误
  else if (error.status) {
    if (error.status >= 400 && error.status < 500) {
      analysis.type = API_ERROR_TYPES.CLIENT
      analysis.severity = error.status === 403 ? ERROR_SEVERITY.HIGH : ERROR_SEVERITY.MEDIUM
      
      if (error.status === 403) {
        analysis.message = '访问被拒绝'
        analysis.suggestion = '您可能没有权限访问此功能'
        analysis.retryable = false
      } else if (error.status === 404) {
        analysis.message = '请求的资源不存在'
        analysis.suggestion = '请检查功能是否可用'
        analysis.retryable = false
        analysis.fallbackAvailable = true
      } else {
        analysis.message = '请求参数错误'
        analysis.suggestion = '请检查输入信息'
        analysis.retryable = false
      }
    } else if (error.status >= 500) {
      analysis.type = API_ERROR_TYPES.SERVER
      analysis.severity = ERROR_SEVERITY.HIGH
      analysis.message = '服务器内部错误'
      analysis.suggestion = '服务器暂时不可用，请稍后重试'
      analysis.retryable = true
      analysis.fallbackAvailable = true
    }
  }
  // 调试模式被禁用
  else if (error.message && error.message.includes('Debug endpoints are disabled')) {
    analysis.type = API_ERROR_TYPES.DEBUG_DISABLED
    analysis.severity = ERROR_SEVERITY.LOW
    analysis.message = '调试功能在生产环境中被禁用'
    analysis.suggestion = '这是正常的安全措施，不影响正常使用'
    analysis.retryable = false
    analysis.fallbackAvailable = true
  }
  // CORS错误
  else if (error.message && error.message.includes('CORS')) {
    analysis.type = API_ERROR_TYPES.CORS
    analysis.severity = ERROR_SEVERITY.HIGH
    analysis.message = '跨域请求被阻止'
    analysis.suggestion = '请联系管理员检查域名配置'
    analysis.retryable = false
  }

  return analysis
}

/**
 * 带重试的API请求函数
 * @param {Function} apiCall - API调用函数
 * @param {object} options - 重试选项
 * @returns {Promise} API响应
 */
export async function apiWithRetry(apiCall, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    backoffMultiplier = 2,
    enableFallback = true,
    silentMode = false
  } = options

  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiCall()
      
      // 成功响应
      if (response && response.ok !== false) {
        return response
      }
      
      // API返回错误但有响应
      throw new Error(response.message || 'API request failed')
      
    } catch (error) {
      lastError = error
      const analysis = analyzeApiError(error)
      
      // 如果不可重试，直接抛出错误
      if (!analysis.retryable || attempt === maxRetries) {
        if (!silentMode) {
          handleApiError(error, analysis, enableFallback)
        }
        
        // 如果有降级数据，返回降级响应
        if (enableFallback && analysis.fallbackAvailable) {
          return generateFallbackResponse(error)
        }
        
        throw error
      }
      
      // 计算重试延迟
      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1)
      
      if (!silentMode) {
        console.warn(`API请求失败，${delay}ms后进行第${attempt + 1}次重试:`, error.message)
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

/**
 * 处理API错误
 * @param {Error} error - 错误对象
 * @param {object} analysis - 错误分析结果
 * @param {boolean} enableFallback - 是否启用降级
 */
export function handleApiError(error, analysis, enableFallback = true) {
  // 根据错误严重程度选择不同的通知方式
  switch (analysis.severity) {
    case ERROR_SEVERITY.CRITICAL:
      ElNotification({
        title: '严重错误',
        message: `${analysis.message}\n${analysis.suggestion}`,
        type: 'error',
        duration: 0, // 不自动关闭
        showClose: true
      })
      break
      
    case ERROR_SEVERITY.HIGH:
      ElNotification({
        title: '错误',
        message: `${analysis.message}\n${analysis.suggestion}`,
        type: 'error',
        duration: 8000
      })
      break
      
    case ERROR_SEVERITY.MEDIUM:
      ElMessage({
        message: `${analysis.message} - ${analysis.suggestion}`,
        type: 'warning',
        duration: 5000,
        showClose: true
      })
      break
      
    case ERROR_SEVERITY.LOW:
      if (analysis.type !== API_ERROR_TYPES.DEBUG_DISABLED) {
        ElMessage({
          message: analysis.message,
          type: 'info',
          duration: 3000
        })
      }
      break
  }
  
  // 如果有降级数据可用，显示提示
  if (enableFallback && analysis.fallbackAvailable) {
    setTimeout(() => {
      ElMessage({
        message: '已切换到离线模式，部分功能可能受限',
        type: 'info',
        duration: 4000
      })
    }, 1000)
  }
}

/**
 * 生成降级响应
 * @param {Error} error - 原始错误
 * @returns {object} 降级响应数据
 */
export function generateFallbackResponse(error) {
  const fallbackData = {
    success: true,
    data: [],
    total: 0,
    fallback: true,
    message: '数据暂时不可用，显示缓存数据',
    timestamp: new Date().toISOString(),
    originalError: error.message
  }
  
  // 尝试从localStorage获取缓存数据
  try {
    const cacheKey = `api_cache_${window.location.pathname}`
    const cachedData = localStorage.getItem(cacheKey)
    
    if (cachedData) {
      const parsed = JSON.parse(cachedData)
      fallbackData.data = parsed.data || []
      fallbackData.total = parsed.total || 0
      fallbackData.message = '显示缓存数据，可能不是最新的'
    }
  } catch (cacheError) {
    console.warn('Failed to load cached data:', cacheError)
  }
  
  return fallbackData
}

/**
 * API响应缓存工具
 * @param {string} key - 缓存键
 * @param {object} data - 要缓存的数据
 * @param {number} ttl - 缓存时间（毫秒）
 */
export function cacheApiResponse(key, data, ttl = 5 * 60 * 1000) {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl
    }
    
    localStorage.setItem(`api_cache_${key}`, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('Failed to cache API response:', error)
  }
}

/**
 * 获取缓存的API响应
 * @param {string} key - 缓存键
 * @returns {object|null} 缓存的数据或null
 */
export function getCachedApiResponse(key) {
  try {
    const cached = localStorage.getItem(`api_cache_${key}`)
    if (!cached) return null
    
    const cacheData = JSON.parse(cached)
    const now = Date.now()
    
    // 检查是否过期
    if (now - cacheData.timestamp > cacheData.ttl) {
      localStorage.removeItem(`api_cache_${key}`)
      return null
    }
    
    return cacheData.data
  } catch (error) {
    console.warn('Failed to get cached API response:', error)
    return null
  }
}

/**
 * 创建增强的API调用函数
 * @param {Function} originalApiCall - 原始API调用函数
 * @param {object} options - 配置选项
 * @returns {Function} 增强的API调用函数
 */
export function createEnhancedApiCall(originalApiCall, options = {}) {
  const {
    enableRetry = true,
    enableCache = false,
    cacheKey = null,
    cacheTtl = 5 * 60 * 1000,
    enableFallback = true,
    silentMode = false
  } = options
  
  return async (...args) => {
    // 尝试从缓存获取数据
    if (enableCache && cacheKey) {
      const cached = getCachedApiResponse(cacheKey)
      if (cached) {
        return cached
      }
    }
    
    // 执行API调用
    const apiCall = () => originalApiCall(...args)
    
    if (enableRetry) {
      const response = await apiWithRetry(apiCall, {
        enableFallback,
        silentMode
      })
      
      // 缓存成功响应
      if (enableCache && cacheKey && response && !response.fallback) {
        cacheApiResponse(cacheKey, response, cacheTtl)
      }
      
      return response
    } else {
      try {
        const response = await apiCall()
        
        // 缓存成功响应
        if (enableCache && cacheKey && response && !response.fallback) {
          cacheApiResponse(cacheKey, response, cacheTtl)
        }
        
        return response
      } catch (error) {
        const analysis = analyzeApiError(error)
        
        if (!silentMode) {
          handleApiError(error, analysis, enableFallback)
        }
        
        if (enableFallback && analysis.fallbackAvailable) {
          return generateFallbackResponse(error)
        }
        
        throw error
      }
    }
  }
}
