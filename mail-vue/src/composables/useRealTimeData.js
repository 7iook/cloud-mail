/**
 * 实时数据流管理组合式函数
 * 基于2025年最新的实时数据可视化标准
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useIntervalFn } from '@vueuse/core';

export function useRealTimeData(apiEndpoint, options = {}) {
  const {
    interval = 30000, // 30秒更新间隔
    maxDataPoints = 50, // 最大数据点数量
    enableWebSocket = false, // 是否启用WebSocket
    wsEndpoint = null,
    onDataUpdate = null,
    onError = null
  } = options;

  // 响应式数据状态
  const data = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const lastUpdate = ref(null);
  const connectionStatus = ref('disconnected');

  // WebSocket连接
  let ws = null;

  /**
   * 获取数据的通用方法
   */
  async function fetchData() {
    if (isLoading.value) return;
    
    try {
      isLoading.value = true;
      error.value = null;
      
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const newData = await response.json();
      updateData(newData);
      
    } catch (err) {
      error.value = err.message;
      onError?.(err);
      console.error('实时数据获取失败:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 更新数据并维护数据点限制
   */
  function updateData(newData) {
    if (Array.isArray(newData)) {
      // 数组数据：保持最新的maxDataPoints个数据点
      data.value = [...data.value, ...newData].slice(-maxDataPoints);
    } else {
      // 单个数据点：添加时间戳并限制数量
      const dataPoint = {
        ...newData,
        timestamp: new Date().toISOString(),
        id: Date.now()
      };
      data.value = [...data.value, dataPoint].slice(-maxDataPoints);
    }
    
    lastUpdate.value = new Date();
    onDataUpdate?.(data.value);
  }

  /**
   * 初始化WebSocket连接
   */
  function initWebSocket() {
    if (!enableWebSocket || !wsEndpoint) return;
    
    try {
      ws = new WebSocket(wsEndpoint);
      
      ws.onopen = () => {
        connectionStatus.value = 'connected';
        console.log('🔗 WebSocket连接已建立');
      };
      
      ws.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data);
          updateData(newData);
        } catch (err) {
          console.error('WebSocket数据解析失败:', err);
        }
      };
      
      ws.onclose = () => {
        connectionStatus.value = 'disconnected';
        console.log('🔌 WebSocket连接已断开');
        
        // 自动重连机制
        setTimeout(() => {
          if (connectionStatus.value === 'disconnected') {
            initWebSocket();
          }
        }, 5000);
      };
      
      ws.onerror = (err) => {
        connectionStatus.value = 'error';
        error.value = 'WebSocket连接错误';
        console.error('WebSocket错误:', err);
      };
      
    } catch (err) {
      console.error('WebSocket初始化失败:', err);
      connectionStatus.value = 'error';
    }
  }

  /**
   * 关闭WebSocket连接
   */
  function closeWebSocket() {
    if (ws) {
      ws.close();
      ws = null;
      connectionStatus.value = 'disconnected';
    }
  }

  // 定时轮询（当WebSocket不可用时的备选方案）
  const { pause: pausePolling, resume: resumePolling } = useIntervalFn(
    fetchData,
    interval,
    { immediate: false }
  );

  /**
   * 启动数据流
   */
  function start() {
    if (enableWebSocket) {
      initWebSocket();
    } else {
      resumePolling();
    }
    
    // 立即获取一次数据
    fetchData();
  }

  /**
   * 停止数据流
   */
  function stop() {
    pausePolling();
    closeWebSocket();
  }

  /**
   * 手动刷新数据
   */
  function refresh() {
    fetchData();
  }

  /**
   * 清空数据
   */
  function clear() {
    data.value = [];
    error.value = null;
    lastUpdate.value = null;
  }

  // 计算属性
  const latestData = computed(() => {
    return data.value.length > 0 ? data.value[data.value.length - 1] : null;
  });

  const dataCount = computed(() => data.value.length);

  const hasError = computed(() => !!error.value);

  const isConnected = computed(() => {
    return enableWebSocket 
      ? connectionStatus.value === 'connected'
      : !isLoading.value && !error.value;
  });

  // 生命周期管理
  onMounted(() => {
    start();
  });

  onUnmounted(() => {
    stop();
  });

  return {
    // 数据状态
    data,
    latestData,
    dataCount,
    isLoading,
    error,
    hasError,
    lastUpdate,
    connectionStatus,
    isConnected,
    
    // 控制方法
    start,
    stop,
    refresh,
    clear,
    
    // 内部方法（高级用法）
    updateData,
    fetchData
  };
}
