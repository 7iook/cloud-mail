/**
 * API错误处理中间件
 * 统一处理API请求错误，提供降级和重试机制
 */

import result from '../model/result';

/**
 * 环境检测中间件
 * 检测调试模式API在生产环境的访问
 */
export const debugModeMiddleware = async (c, next) => {
  // 检查是否启用调试模式
  const debugEnabled = c.env.DEBUG_MODE === 'true' || c.env.DEBUG_MODE === true;

  if (!debugEnabled) {
    // 生产环境下提供友好的错误信息
    const errorResponse = {
      success: false,
      message: 'Debug endpoints are disabled in production environment',
      code: 'DEBUG_DISABLED',
      environment: 'production',
      suggestion: 'Please use production APIs instead of debug endpoints',
      timestamp: new Date().toISOString()
    };
    
    console.warn(`[PRODUCTION] Debug API access blocked: ${c.req.method} ${c.req.url}`);
    return c.json(result.fail(errorResponse), 403);
  }

  // 记录调试API访问
  console.log(`[DEBUG] Test API accessed: ${c.req.method} ${c.req.url} at ${new Date().toISOString()}`);

  await next();
};

/**
 * API降级处理中间件
 * 当API不可用时提供降级响应
 */
export const fallbackMiddleware = async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', error);
    
    // 根据错误类型提供不同的降级响应
    const fallbackResponse = generateFallbackResponse(c, error);
    return c.json(fallbackResponse.data, fallbackResponse.status);
  }
};

/**
 * 生成降级响应
 */
function generateFallbackResponse(c, error) {
  const path = c.req.path;
  const method = c.req.method;
  
  // 根据API路径提供特定的降级数据
  if (path.includes('/monitor/') && method === 'GET') {
    return {
      data: result.ok({
        data: [],
        total: 0,
        fallback: true,
        message: '监控数据暂时不可用，请稍后重试'
      }),
      status: 200
    };
  }
  
  if (path.includes('/email/') && method === 'GET') {
    return {
      data: result.ok({
        data: [],
        total: 0,
        fallback: true,
        message: '邮件数据暂时不可用，请稍后重试'
      }),
      status: 200
    };
  }
  
  // 默认降级响应
  return {
    data: result.fail({
      message: error.message || 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
      fallback: true,
      timestamp: new Date().toISOString()
    }),
    status: 503
  };
}

/**
 * 请求重试中间件
 * 为失败的请求提供重试机制
 */
export const retryMiddleware = (maxRetries = 3, baseDelay = 1000) => {
  return async (c, next) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await next();
        return; // 成功则直接返回
      } catch (error) {
        lastError = error;
        
        // 最后一次尝试失败
        if (attempt === maxRetries) {
          console.error(`Request failed after ${maxRetries} attempts:`, error);
          throw error;
        }
        
        // 计算重试延迟（指数退避）
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`Request attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };
};

/**
 * 健康检查中间件
 * 检查系统关键组件的健康状态
 */
export const healthCheckMiddleware = async (c, next) => {
  try {
    // 检查数据库连接
    if (c.env.db) {
      await c.env.db.prepare('SELECT 1').first();
    }
    
    // 检查KV存储
    if (c.env.kv) {
      await c.env.kv.get('health_check_test');
    }
    
    await next();
  } catch (error) {
    console.error('Health check failed:', error);
    
    // 如果是健康检查请求，返回详细状态
    if (c.req.path.includes('/health')) {
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: c.env.db ? 'unknown' : 'unavailable',
          kv: c.env.kv ? 'unknown' : 'unavailable'
        },
        error: error.message
      }, 503);
    }
    
    throw error;
  }
};

/**
 * 请求日志中间件
 * 记录API请求的详细信息
 */
export const requestLogMiddleware = async (c, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  // 记录请求开始
  console.log(`[${requestId}] ${c.req.method} ${c.req.url} - Start`);
  
  try {
    await next();
    
    // 记录成功响应
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ${c.req.method} ${c.req.url} - Success (${duration}ms)`);
  } catch (error) {
    // 记录错误响应
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ${c.req.method} ${c.req.url} - Error (${duration}ms):`, error.message);
    throw error;
  }
};

/**
 * CORS错误处理中间件
 * 处理跨域请求错误
 */
export const corsErrorMiddleware = async (c, next) => {
  try {
    await next();
  } catch (error) {
    // 如果是CORS相关错误，提供特殊处理
    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
      return c.json(result.fail({
        message: 'Cross-origin request blocked',
        code: 'CORS_ERROR',
        suggestion: 'Please check your domain configuration',
        timestamp: new Date().toISOString()
      }), 403);
    }
    
    throw error;
  }
};

/**
 * 组合中间件
 * 将多个中间件组合成一个
 */
export const createApiMiddleware = (options = {}) => {
  const {
    enableDebugMode = true,
    enableFallback = true,
    enableRetry = false,
    enableHealthCheck = true,
    enableRequestLog = false,
    enableCorsError = true,
    retryOptions = { maxRetries: 3, baseDelay: 1000 }
  } = options;
  
  const middlewares = [];
  
  if (enableRequestLog) middlewares.push(requestLogMiddleware);
  if (enableCorsError) middlewares.push(corsErrorMiddleware);
  if (enableHealthCheck) middlewares.push(healthCheckMiddleware);
  if (enableRetry) middlewares.push(retryMiddleware(retryOptions.maxRetries, retryOptions.baseDelay));
  if (enableFallback) middlewares.push(fallbackMiddleware);
  if (enableDebugMode) middlewares.push(debugModeMiddleware);
  
  return async (c, next) => {
    let index = 0;
    
    const dispatch = async () => {
      if (index >= middlewares.length) {
        return await next();
      }
      
      const middleware = middlewares[index++];
      return await middleware(c, dispatch);
    };
    
    return await dispatch();
  };
};
