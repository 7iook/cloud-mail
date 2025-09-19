<template>
  <div 
    class="enhanced-smart-chart-container"
    :class="{ 
      'is-loading': loading, 
      'has-prediction': showPrediction,
      'is-real-time': isRealTime,
      'theme-dark': theme === 'dark'
    }"
  >
    <!-- 图表头部 -->
    <div class="chart-header">
      <div class="chart-title-section">
        <h3 class="chart-title">
          <Icon :icon="chartIcon" width="20" height="20" />
          {{ title }}
        </h3>
        <p v-if="subtitle" class="chart-subtitle">{{ subtitle }}</p>
        
        <!-- 实时状态指示器 -->
        <div v-if="isRealTime" class="real-time-indicator">
          <div class="status-dot" :class="connectionStatus"></div>
          <span class="status-text">{{ getStatusText() }}</span>
        </div>
      </div>
      
      <div class="chart-controls">
        <!-- 数据源搜索 -->
        <el-input
          v-if="enableSearch"
          v-model="searchQuery"
          size="small"
          placeholder="搜索数据..."
          :prefix-icon="Search"
          clearable
          @input="handleSearch"
          style="width: 200px; margin-right: 8px;"
        />
        
        <!-- 时间范围选择器 -->
        <el-select 
          v-if="showTimeRange" 
          v-model="selectedTimeRange" 
          size="small"
          @change="handleTimeRangeChange"
          style="width: 120px; margin-right: 8px;"
        >
          <el-option 
            v-for="range in timeRanges" 
            :key="range.value"
            :label="range.label" 
            :value="range.value"
          />
        </el-select>
        
        <!-- 图表类型切换 -->
        <el-button-group v-if="showChartTypeToggle" size="small" style="margin-right: 8px;">
          <el-button 
            v-for="type in availableChartTypes"
            :key="type.value"
            :type="selectedChartType === type.value ? 'primary' : ''"
            @click="handleChartTypeChange(type.value)"
            :title="type.label"
          >
            <Icon :icon="type.icon" width="16" height="16" />
          </el-button>
        </el-button-group>
        
        <!-- 预测开关 -->
        <el-switch
          v-if="supportsPrediction"
          v-model="predictionEnabled"
          size="small"
          active-text="预测"
          @change="handlePredictionToggle"
          style="margin-right: 8px;"
        />
        
        <!-- 刷新按钮 -->
        <el-button 
          size="small" 
          :loading="loading"
          @click="handleRefresh"
          :title="isRealTime ? '手动刷新' : '刷新数据'"
        >
          <Icon icon="mdi:refresh" width="16" height="16" />
        </el-button>
        
        <!-- 全屏按钮 -->
        <el-button 
          size="small"
          @click="toggleFullscreen"
          title="全屏显示"
        >
          <Icon icon="mdi:fullscreen" width="16" height="16" />
        </el-button>
      </div>
    </div>
    
    <!-- 图表内容区域 -->
    <div class="chart-content" :style="{ height: chartHeight + 'px' }">
      <!-- 加载状态 -->
      <div v-if="loading" class="chart-loading">
        <el-skeleton animated>
          <template #template>
            <div class="loading-content">
              <el-skeleton-item variant="rect" style="width: 100%; height: 200px;" />
              <div class="loading-text">
                <Icon icon="mdi:chart-line-variant" width="24" height="24" />
                <span>正在加载图表数据...</span>
              </div>
            </div>
          </template>
        </el-skeleton>
      </div>
      
      <!-- 错误状态 -->
      <div v-else-if="error" class="chart-error">
        <Icon icon="mdi:alert-circle" width="48" height="48" />
        <p class="error-title">数据加载失败</p>
        <p class="error-message">{{ error }}</p>
        <el-button size="small" type="primary" @click="handleRefresh">重新加载</el-button>
      </div>
      
      <!-- 空数据状态 -->
      <div v-else-if="!hasData" class="chart-empty">
        <Icon icon="mdi:chart-line" width="48" height="48" />
        <p class="empty-title">暂无数据</p>
        <p class="empty-message">{{ getEmptyMessage() }}</p>
        <el-button size="small" @click="handleRefresh">刷新数据</el-button>
      </div>
      
      <!-- ECharts图表 -->
      <div 
        v-else
        ref="chartRef" 
        class="chart-instance"
        :style="{ width: '100%', height: '100%' }"
      ></div>
    </div>
    
    <!-- 图表底部信息 -->
    <div v-if="showFooter" class="chart-footer">
      <div class="chart-stats">
        <span class="stat-item">
          <Icon icon="mdi:clock" width="14" height="14" />
          最后更新: {{ formatTime(lastUpdate) }}
        </span>
        <span v-if="dataCount" class="stat-item">
          <Icon icon="mdi:database" width="14" height="14" />
          数据点: {{ dataCount }}
        </span>
        <span v-if="isRealTime && performanceMetrics" class="stat-item">
          <Icon icon="mdi:speedometer" width="14" height="14" />
          延迟: {{ performanceMetrics.latency }}ms
        </span>
        <span v-if="searchQuery" class="stat-item">
          <Icon icon="mdi:magnify" width="14" height="14" />
          搜索: "{{ searchQuery }}"
        </span>
      </div>
      
      <!-- 预测指示器 -->
      <div v-if="showPrediction && predictionData && predictionData.length > 0" class="prediction-info">
        <Icon icon="mdi:crystal-ball" width="14" height="14" />
        <span>预测数据 ({{ predictionData.length }}点)</span>
        <el-tag size="small" type="info">置信度: {{ averageConfidence }}%</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { Search } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { debounce } from 'lodash-es';
import { useAdvancedRealTimeData } from '@/composables/useAdvancedRealTimeData.js';

// Props定义
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  data: {
    type: Array,
    default: () => []
  },
  chartType: {
    type: String,
    default: 'line',
    validator: (value) => ['line', 'bar', 'pie', 'scatter', 'area'].includes(value)
  },
  chartHeight: {
    type: Number,
    default: 350
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  },
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value)
  },
  showTimeRange: {
    type: Boolean,
    default: true
  },
  showChartTypeToggle: {
    type: Boolean,
    default: true
  },
  showPrediction: {
    type: Boolean,
    default: false
  },
  predictionData: {
    type: Array,
    default: () => []
  },
  showFooter: {
    type: Boolean,
    default: true
  },
  enableSearch: {
    type: Boolean,
    default: true
  },
  isRealTime: {
    type: Boolean,
    default: false
  },
  realTimeEndpoint: {
    type: String,
    default: null
  },
  supportsPrediction: {
    type: Boolean,
    default: true
  }
});

// Emits定义
const emit = defineEmits([
  'refresh',
  'time-range-change',
  'chart-type-change',
  'search',
  'prediction-toggle',
  'fullscreen'
]);

// 响应式数据
const chartRef = ref(null);
const chartInstance = ref(null);
const selectedTimeRange = ref('7d');
const selectedChartType = ref(props.chartType);
const searchQuery = ref('');
const predictionEnabled = ref(props.showPrediction);
const isFullscreen = ref(false);

// 实时数据管理
const realTimeData = props.isRealTime && props.realTimeEndpoint 
  ? useAdvancedRealTimeData(props.realTimeEndpoint, {
      enablePrediction: props.supportsPrediction,
      onDataUpdate: (data, predictions) => {
        updateChart(data, predictions);
      }
    })
  : null;

// 计算属性
const hasData = computed(() => {
  return props.data && props.data.length > 0;
});

const dataCount = computed(() => {
  return props.data ? props.data.length : 0;
});

const lastUpdate = computed(() => {
  return realTimeData?.lastUpdate.value || new Date();
});

const connectionStatus = computed(() => {
  return realTimeData?.connectionStatus.value || 'disconnected';
});

const performanceMetrics = computed(() => {
  return realTimeData?.performanceMetrics || null;
});

const averageConfidence = computed(() => {
  if (!props.predictionData || props.predictionData.length === 0) return 0;
  const total = props.predictionData.reduce((sum, item) => sum + (item.confidence || 0), 0);
  return Math.round((total / props.predictionData.length) * 100);
});

// 图表配置
const chartIcon = computed(() => {
  const icons = {
    line: 'mdi:chart-line',
    bar: 'mdi:chart-bar',
    pie: 'mdi:chart-pie',
    scatter: 'mdi:chart-scatter-plot',
    area: 'mdi:chart-areaspline'
  };
  return icons[selectedChartType.value] || 'mdi:chart-line';
});

const timeRanges = [
  { label: '1小时', value: '1h' },
  { label: '24小时', value: '24h' },
  { label: '7天', value: '7d' },
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' }
];

const availableChartTypes = [
  { label: '折线图', value: 'line', icon: 'mdi:chart-line' },
  { label: '柱状图', value: 'bar', icon: 'mdi:chart-bar' },
  { label: '面积图', value: 'area', icon: 'mdi:chart-areaspline' },
  { label: '散点图', value: 'scatter', icon: 'mdi:chart-scatter-plot' }
];

// 方法定义
const getStatusText = () => {
  const statusMap = {
    connected: '实时连接',
    disconnected: '连接断开',
    polling: '轮询模式',
    error: '连接错误'
  };
  return statusMap[connectionStatus.value] || '未知状态';
};

const getEmptyMessage = () => {
  if (searchQuery.value) {
    return `没有找到包含"${searchQuery.value}"的数据`;
  }
  return '请检查数据源或刷新页面';
};

const formatTime = (time) => {
  if (!time) return '--';
  return new Date(time).toLocaleTimeString();
};

// 事件处理
const handleRefresh = () => {
  if (realTimeData) {
    realTimeData.refresh();
  }
  emit('refresh');
};

const handleTimeRangeChange = (value) => {
  selectedTimeRange.value = value;
  emit('time-range-change', value);
};

const handleChartTypeChange = (type) => {
  selectedChartType.value = type;
  emit('chart-type-change', type);
  nextTick(() => {
    updateChart();
  });
};

const handleSearch = debounce((query) => {
  emit('search', query);
}, 300);

const handlePredictionToggle = (enabled) => {
  predictionEnabled.value = enabled;
  emit('prediction-toggle', enabled);
  nextTick(() => {
    updateChart();
  });
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  emit('fullscreen', isFullscreen.value);
};

/**
 * 更新图表
 */
const updateChart = (data = props.data, predictions = props.predictionData) => {
  if (!chartInstance.value || !data) return;

  try {
    const option = generateChartOption(data, predictions);
    chartInstance.value.setOption(option, true);
  } catch (error) {
    console.error('图表更新失败:', error);
  }
};

/**
 * 生成图表配置
 */
const generateChartOption = (data, predictions = []) => {
  const baseOption = {
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: props.theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: props.theme === 'dark' ? '#404040' : '#e4e7ed',
      textStyle: {
        color: props.theme === 'dark' ? '#ffffff' : '#303133'
      },
      formatter: (params) => {
        let html = `<div style="margin-bottom: 4px; font-weight: 600;">${params[0].axisValue}</div>`;
        params.forEach(param => {
          const color = param.color;
          const isPrediction = param.data.isPrediction;
          const confidence = param.data.confidence;
          html += `
            <div style="display: flex; align-items: center; margin: 2px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%; margin-right: 8px;"></span>
              <span style="flex: 1;">${param.seriesName}: ${param.value}</span>
              ${isPrediction ? `<span style="color: #909399; font-size: 12px; margin-left: 8px;">预测 (${Math.round(confidence * 100)}%)</span>` : ''}
            </div>
          `;
        });
        return html;
      }
    },
    legend: {
      show: true,
      top: 10,
      textStyle: {
        color: props.theme === 'dark' ? '#ffffff' : '#303133'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    }
  };

  // 根据图表类型生成特定配置
  switch (selectedChartType.value) {
    case 'line':
    case 'area':
      return generateLineAreaOption(baseOption, data, predictions);
    case 'bar':
      return generateBarOption(baseOption, data, predictions);
    case 'pie':
      return generatePieOption(baseOption, data);
    case 'scatter':
      return generateScatterOption(baseOption, data, predictions);
    default:
      return generateLineAreaOption(baseOption, data, predictions);
  }
};

/**
 * 生成折线图/面积图配置
 */
const generateLineAreaOption = (baseOption, data, predictions) => {
  const series = [{
    name: '实际数据',
    type: 'line',
    data: data.map(item => ({
      value: item.value || item.y || item,
      timestamp: item.timestamp || item.x,
      isPrediction: false
    })),
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: {
      width: 3,
      color: '#409eff'
    },
    areaStyle: selectedChartType.value === 'area' ? {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
        ]
      }
    } : null
  }];

  // 添加预测数据系列
  if (predictionEnabled.value && predictions && predictions.length > 0) {
    series.push({
      name: '预测数据',
      type: 'line',
      data: predictions.map(item => ({
        value: item.value || item.y || item,
        timestamp: item.timestamp || item.x,
        isPrediction: true,
        confidence: item.confidence || 0.5
      })),
      smooth: true,
      symbol: 'diamond',
      symbolSize: 4,
      lineStyle: {
        width: 2,
        type: 'dashed',
        color: '#f56c6c'
      },
      itemStyle: {
        color: '#f56c6c',
        opacity: 0.7
      }
    });
  }

  return {
    ...baseOption,
    xAxis: {
      type: 'category',
      data: [...data, ...(predictions || [])].map(item =>
        item.timestamp || item.x || new Date().toLocaleTimeString()
      ),
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      },
      splitLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#f5f7fa'
        }
      }
    },
    series
  };
};

/**
 * 生成柱状图配置
 */
const generateBarOption = (baseOption, data, predictions) => {
  return {
    ...baseOption,
    xAxis: {
      type: 'category',
      data: data.map(item => item.name || item.x || '未知'),
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      },
      splitLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#f5f7fa'
        }
      }
    },
    series: [{
      name: '数据',
      type: 'bar',
      data: data.map(item => item.value || item.y || item),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#66b1ff' }
          ]
        },
        borderRadius: [4, 4, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: '#337ecc'
        }
      }
    }]
  };
};

/**
 * 生成饼图配置
 */
const generatePieOption = (baseOption, data) => {
  return {
    ...baseOption,
    series: [{
      name: '数据分布',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      data: data.map(item => ({
        name: item.name || item.x || '未知',
        value: item.value || item.y || item
      })),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: true,
        formatter: '{b}: {c} ({d}%)',
        color: props.theme === 'dark' ? '#ffffff' : '#303133'
      },
      labelLine: {
        show: true,
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      }
    }]
  };
};

/**
 * 生成散点图配置
 */
const generateScatterOption = (baseOption, data, predictions) => {
  const series = [{
    name: '实际数据',
    type: 'scatter',
    data: data.map(item => [
      item.x || Math.random() * 100,
      item.value || item.y || item
    ]),
    symbolSize: 8,
    itemStyle: {
      color: '#409eff',
      opacity: 0.8
    }
  }];

  if (predictionEnabled.value && predictions && predictions.length > 0) {
    series.push({
      name: '预测数据',
      type: 'scatter',
      data: predictions.map(item => [
        item.x || Math.random() * 100,
        item.value || item.y || item
      ]),
      symbolSize: 6,
      itemStyle: {
        color: '#f56c6c',
        opacity: 0.6
      }
    });
  }

  return {
    ...baseOption,
    xAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      },
      splitLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#f5f7fa'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#e4e7ed'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ffffff' : '#606266'
      },
      splitLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#4c4d4f' : '#f5f7fa'
        }
      }
    },
    series
  };
};

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return;

  try {
    chartInstance.value = echarts.init(chartRef.value, props.theme);
    updateChart();

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);
  } catch (error) {
    console.error('图表初始化失败:', error);
  }
};

// 处理窗口大小变化
const handleResize = debounce(() => {
  if (chartInstance.value) {
    chartInstance.value.resize();
  }
}, 100);

// 监听器
watch(() => props.data, () => {
  updateChart();
}, { deep: true });

watch(() => props.theme, () => {
  if (chartInstance.value) {
    chartInstance.value.dispose();
    initChart();
  }
});

// 生命周期
onMounted(() => {
  nextTick(() => {
    initChart();
  });
});

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose();
  }
  window.removeEventListener('resize', handleResize);

  if (realTimeData) {
    realTimeData.stop();
  }
});
</script>

<style scoped>
.enhanced-smart-chart-container {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.enhanced-smart-chart-container:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary);
}

.enhanced-smart-chart-container.theme-dark {
  background: #1a1a1a;
  border-color: #404040;
}

.enhanced-smart-chart-container.is-real-time::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    var(--el-color-primary) 0%,
    var(--el-color-success) 50%,
    var(--el-color-primary) 100%);
  animation: realtime-pulse 2s ease-in-out infinite;
}

@keyframes realtime-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}

.chart-title-section {
  flex: 1;
  min-width: 0;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.real-time-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: status-blink 2s ease-in-out infinite;
}

.status-dot.connected {
  background: var(--el-color-success);
}

.status-dot.disconnected {
  background: var(--el-color-danger);
}

.status-dot.polling {
  background: var(--el-color-warning);
}

.status-dot.error {
  background: var(--el-color-danger);
  animation: status-error 1s ease-in-out infinite;
}

@keyframes status-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes status-error {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chart-content {
  position: relative;
  width: 100%;
  min-height: 200px;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}

.loading-content {
  text-align: center;
  width: 100%;
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.chart-error,
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  text-align: center;
  color: var(--el-text-color-regular);
}

.chart-error .iconify,
.chart-empty .iconify {
  color: var(--el-text-color-placeholder);
  margin-bottom: 16px;
}

.error-title,
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px 0;
}

.error-message,
.empty-message {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0 0 16px 0;
  max-width: 300px;
  line-height: 1.5;
}

.chart-instance {
  transition: all 0.3s ease;
}

.chart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-regular);
  gap: 16px;
}

.chart-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.prediction-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .chart-controls {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .chart-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .chart-stats {
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .prediction-info {
    justify-content: center;
  }
}

/* 全屏模式 */
.enhanced-smart-chart-container.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border-radius: 0;
  padding: 24px;
}

.enhanced-smart-chart-container.is-fullscreen .chart-content {
  height: calc(100vh - 200px) !important;
}

/* 深色主题适配 */
.theme-dark .chart-header {
  border-bottom-color: #404040;
}

.theme-dark .chart-footer {
  border-top-color: #404040;
}

.theme-dark .status-text {
  color: #cccccc;
}

/* 动画效果 */
.chart-instance {
  opacity: 0;
  animation: chart-fade-in 0.6s ease-out forwards;
}

@keyframes chart-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 预测数据样式 */
.has-prediction .chart-instance::after {
  content: '';
  position: absolute;
  top: 10px;
  right: 10px;
  width: 8px;
  height: 8px;
  background: var(--el-color-info);
  border-radius: 50%;
  animation: prediction-indicator 2s ease-in-out infinite;
}

@keyframes prediction-indicator {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>
