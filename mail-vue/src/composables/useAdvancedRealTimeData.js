/**
 * 2025年现代化实时数据管理组合式函数
 * 支持WebSocket、Server-Sent Events (SSE)和轮询三种数据获取方式
 * 集成智能预测、数据流分析和性能监控
 */

import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';

export function useAdvancedRealTimeData(apiEndpoint, options = {}) {
  const {
    interval = 30000, // 轮询间隔（毫秒）
    enableWebSocket = false, // 是否启用WebSocket
    enableSSE = false, // 是否启用Server-Sent Events
    wsEndpoint = null, // WebSocket端点
    sseEndpoint = null, // SSE端点
    maxDataPoints = 100, // 最大数据点数量
    autoStart = true, // 是否自动开始
    onError = null, // 错误回调
    onDataUpdate = null, // 数据更新回调
    retryAttempts = 3, // 重试次数
    retryDelay = 5000, // 重试延迟
    enablePrediction = true, // 启用预测功能
    predictionWindow = 10, // 预测窗口大小
    enablePerformanceMonitoring = true, // 启用性能监控
    dataTransform = null, // 数据转换函数
    enableDataValidation = true, // 启用数据验证
    compressionThreshold = 1000 // 数据压缩阈值
  } = options;

  // 响应式状态
  const data = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isConnected = ref(false);
  const lastUpdate = ref(null);
  const predictionData = ref([]);
  const performanceMetrics = reactive({
    latency: 0,
    throughput: 0,
    errorRate: 0,
    connectionUptime: 0,
    dataQuality: 100
  });
  
  // 内部状态
  let ws = null;
  let eventSource = null;
  let pollingTimer = null;
  let retryCount = 0;
  let reconnectTimer = null;
  let performanceTimer = null;
  let connectionStartTime = null;
  let requestCount = 0;
  let errorCount = 0;

  // 计算属性
  const dataCount = computed(() => data.value.length);
  const hasData = computed(() => data.value.length > 0);
  const connectionStatus = computed(() => {
    if (enableWebSocket || enableSSE) {
      return isConnected.value ? 'connected' : 'disconnected';
    }
    return 'polling';
  });

  const dataQuality = computed(() => {
    if (!hasData.value) return 0;
    const validPoints = data.value.filter(point => point && typeof point === 'object').length;
    return (validPoints / data.value.length) * 100;
  });

  /**
   * 数据验证函数
   */
  const validateData = (newData) => {
    if (!enableDataValidation) return true;
    
    if (Array.isArray(newData)) {
      return newData.every(item => item && (typeof item === 'object' || typeof item === 'number'));
    }
    
    return newData && (typeof newData === 'object' || typeof newData === 'number');
  };

  /**
   * 智能预测算法（基于线性回归和移动平均）
   */
  const generatePrediction = (dataPoints) => {
    if (!enablePrediction || dataPoints.length < predictionWindow) {
      return [];
    }

    const recentData = dataPoints.slice(-predictionWindow);
    const predictions = [];
    
    // 简单线性回归预测
    const n = recentData.length;
    const sumX = recentData.reduce((sum, _, i) => sum + i, 0);
    const sumY = recentData.reduce((sum, point) => sum + (point.value || point.y || point), 0);
    const sumXY = recentData.reduce((sum, point, i) => sum + i * (point.value || point.y || point), 0);
    const sumXX = recentData.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 生成未来3个数据点的预测
    for (let i = 1; i <= 3; i++) {
      const predictedValue = slope * (n + i - 1) + intercept;
      predictions.push({
        x: new Date(Date.now() + i * interval).toISOString(),
        y: Math.max(0, predictedValue), // 确保预测值非负
        isPrediction: true,
        confidence: Math.max(0.3, 1 - (i * 0.2)) // 置信度递减
      });
    }
    
    return predictions;
  };

  /**
   * 性能监控
   */
  const updatePerformanceMetrics = () => {
    if (!enablePerformanceMonitoring) return;
    
    const now = Date.now();
    if (connectionStartTime) {
      performanceMetrics.connectionUptime = now - connectionStartTime;
    }
    
    if (requestCount > 0) {
      performanceMetrics.errorRate = (errorCount / requestCount) * 100;
      performanceMetrics.throughput = requestCount / (performanceMetrics.connectionUptime / 1000 / 60); // 每分钟请求数
    }
    
    performanceMetrics.dataQuality = dataQuality.value;
  };

  /**
   * 获取数据
   */
  const fetchData = async () => {
    const startTime = Date.now();
    
    try {
      isLoading.value = true;
      error.value = null;
      requestCount++;
      
      const response = await fetch(apiEndpoint, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      
      // 数据验证
      if (!validateData(rawData)) {
        throw new Error('数据格式验证失败');
      }
      
      // 数据转换
      const transformedData = dataTransform ? dataTransform(rawData) : rawData;
      
      updateData(transformedData);
      
      // 更新性能指标
      performanceMetrics.latency = Date.now() - startTime;
      retryCount = 0; // 重置重试计数
      
    } catch (err) {
      console.error('🚨 [AdvancedRealTimeData] 数据获取失败:', err);
      error.value = err.message;
      errorCount++;
      
      if (onError) {
        onError(err);
      }
      
      // 自动重试
      if (retryCount < retryAttempts) {
        retryCount++;
        console.log(`🔄 [AdvancedRealTimeData] 重试 ${retryCount}/${retryAttempts}...`);
        setTimeout(fetchData, retryDelay);
      }
      
    } finally {
      isLoading.value = false;
      updatePerformanceMetrics();
    }
  };

  /**
   * 更新数据
   */
  const updateData = (newData) => {
    if (Array.isArray(newData)) {
      // 数据压缩：如果数据量过大，进行智能采样
      if (newData.length > compressionThreshold) {
        const step = Math.ceil(newData.length / maxDataPoints);
        data.value = newData.filter((_, index) => index % step === 0);
        console.log(`📊 [AdvancedRealTimeData] 数据已压缩: ${newData.length} -> ${data.value.length}`);
      } else if (newData.length > maxDataPoints) {
        data.value = newData.slice(-maxDataPoints);
      } else {
        data.value = newData;
      }
    } else {
      // 单个数据点，添加到数组
      data.value.push(newData);
      if (data.value.length > maxDataPoints) {
        data.value = data.value.slice(-maxDataPoints);
      }
    }
    
    // 生成预测数据
    if (enablePrediction) {
      predictionData.value = generatePrediction(data.value);
    }
    
    lastUpdate.value = new Date();
    
    if (onDataUpdate) {
      onDataUpdate(data.value, predictionData.value);
    }
    
    console.log(`📊 [AdvancedRealTimeData] 数据已更新，当前数据点: ${data.value.length}，预测点: ${predictionData.value.length}`);
  };

  /**
   * 初始化WebSocket连接
   */
  const initWebSocket = () => {
    if (!wsEndpoint) {
      console.warn('⚠️ [AdvancedRealTimeData] WebSocket端点未配置');
      return;
    }

    try {
      ws = new WebSocket(wsEndpoint);
      connectionStartTime = Date.now();
      
      ws.onopen = () => {
        console.log('🔗 [AdvancedRealTimeData] WebSocket连接已建立');
        isConnected.value = true;
        error.value = null;
        retryCount = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);
          if (validateData(newData)) {
            const transformedData = dataTransform ? dataTransform(newData) : newData;
            updateData(transformedData);
          }
        } catch (err) {
          console.error('🚨 [AdvancedRealTimeData] WebSocket数据解析失败:', err);
          errorCount++;
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 [AdvancedRealTimeData] WebSocket连接已关闭');
        isConnected.value = false;
        
        // 自动重连
        if (retryCount < retryAttempts) {
          retryCount++;
          console.log(`🔄 [AdvancedRealTimeData] WebSocket重连 ${retryCount}/${retryAttempts}...`);
          reconnectTimer = setTimeout(initWebSocket, retryDelay);
        } else {
          console.log('🚫 [AdvancedRealTimeData] WebSocket重连次数已达上限，切换到轮询模式');
          startPolling();
        }
      };
      
      ws.onerror = (err) => {
        console.error('🚨 [AdvancedRealTimeData] WebSocket错误:', err);
        error.value = 'WebSocket连接错误';
        errorCount++;
      };
      
    } catch (err) {
      console.error('🚨 [AdvancedRealTimeData] WebSocket初始化失败:', err);
      error.value = err.message;
    }
  };

  /**
   * 初始化Server-Sent Events连接
   */
  const initSSE = () => {
    if (!sseEndpoint) {
      console.warn('⚠️ [AdvancedRealTimeData] SSE端点未配置');
      return;
    }

    try {
      eventSource = new EventSource(sseEndpoint);
      connectionStartTime = Date.now();
      
      eventSource.onopen = () => {
        console.log('🔗 [AdvancedRealTimeData] SSE连接已建立');
        isConnected.value = true;
        error.value = null;
        retryCount = 0;
      };
      
      eventSource.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);
          if (validateData(newData)) {
            const transformedData = dataTransform ? dataTransform(newData) : newData;
            updateData(transformedData);
          }
        } catch (err) {
          console.error('🚨 [AdvancedRealTimeData] SSE数据解析失败:', err);
          errorCount++;
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('🚨 [AdvancedRealTimeData] SSE错误:', err);
        isConnected.value = false;
        error.value = 'SSE连接错误';
        errorCount++;
        
        // 自动重连
        if (retryCount < retryAttempts) {
          retryCount++;
          console.log(`🔄 [AdvancedRealTimeData] SSE重连 ${retryCount}/${retryAttempts}...`);
          eventSource.close();
          reconnectTimer = setTimeout(initSSE, retryDelay);
        }
      };
      
    } catch (err) {
      console.error('🚨 [AdvancedRealTimeData] SSE初始化失败:', err);
      error.value = err.message;
    }
  };

  /**
   * 开始轮询
   */
  const startPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    console.log(`🔄 [AdvancedRealTimeData] 开始轮询，间隔: ${interval}ms`);
    connectionStartTime = Date.now();

    // 立即获取一次数据
    fetchData();

    // 设置定时轮询
    pollingTimer = setInterval(fetchData, interval);
  };

  /**
   * 停止轮询
   */
  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
      console.log('⏹️ [AdvancedRealTimeData] 轮询已停止');
    }
  };

  /**
   * 开始数据获取
   */
  const start = () => {
    if (enableWebSocket) {
      initWebSocket();
    } else if (enableSSE) {
      initSSE();
    } else {
      startPolling();
    }

    // 启动性能监控
    if (enablePerformanceMonitoring) {
      performanceTimer = setInterval(updatePerformanceMetrics, 10000); // 每10秒更新一次
    }
  };

  /**
   * 停止数据获取
   */
  const stop = () => {
    // 关闭WebSocket
    if (ws) {
      ws.close();
      ws = null;
    }

    // 关闭SSE
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // 停止轮询
    stopPolling();

    // 清理定时器
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (performanceTimer) {
      clearInterval(performanceTimer);
      performanceTimer = null;
    }

    isConnected.value = false;
    console.log('🛑 [AdvancedRealTimeData] 数据获取已停止');
  };

  /**
   * 手动刷新数据
   */
  const refresh = () => {
    console.log('🔄 [AdvancedRealTimeData] 手动刷新数据');
    fetchData();
  };

  /**
   * 清空数据
   */
  const clear = () => {
    data.value = [];
    predictionData.value = [];
    error.value = null;
    lastUpdate.value = null;
    requestCount = 0;
    errorCount = 0;
    console.log('🗑️ [AdvancedRealTimeData] 数据已清空');
  };

  // 监听数据变化，自动更新预测
  watch(data, (newData) => {
    if (enablePrediction && newData.length >= predictionWindow) {
      predictionData.value = generatePrediction(newData);
    }
  }, { deep: true });

  // 生命周期管理
  onMounted(() => {
    if (autoStart) {
      start();
    }
  });

  onUnmounted(() => {
    stop();
  });

  return {
    // 响应式数据
    data,
    isLoading,
    error,
    isConnected,
    lastUpdate,
    predictionData,
    performanceMetrics,

    // 计算属性
    dataCount,
    hasData,
    connectionStatus,
    dataQuality,

    // 控制方法
    start,
    stop,
    refresh,
    clear,
    fetchData
  };
}
