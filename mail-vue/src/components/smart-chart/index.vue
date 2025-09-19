<template>
  <div 
    class="smart-chart-container"
    :class="{ 'is-loading': loading, 'has-prediction': showPrediction }"
  >
    <!-- 图表头部 -->
    <div class="chart-header">
      <div class="chart-title-section">
        <h3 class="chart-title">{{ title }}</h3>
        <p v-if="subtitle" class="chart-subtitle">{{ subtitle }}</p>
      </div>
      
      <div class="chart-controls">
        <!-- 时间范围选择器 -->
        <el-select 
          v-if="showTimeRange" 
          v-model="selectedTimeRange" 
          size="small"
          @change="handleTimeRangeChange"
        >
          <el-option 
            v-for="range in timeRanges" 
            :key="range.value"
            :label="range.label" 
            :value="range.value"
          />
        </el-select>
        
        <!-- 图表类型切换 -->
        <el-button-group v-if="showChartTypeToggle" size="small">
          <el-button 
            v-for="type in chartTypes"
            :key="type.value"
            :type="selectedChartType === type.value ? 'primary' : ''"
            @click="handleChartTypeChange(type.value)"
          >
            <Icon :icon="type.icon" width="16" height="16" />
          </el-button>
        </el-button-group>
        
        <!-- 刷新按钮 -->
        <el-button 
          size="small" 
          :loading="loading"
          @click="handleRefresh"
        >
          <Icon icon="mdi:refresh" width="16" height="16" />
        </el-button>
      </div>
    </div>
    
    <!-- 图表内容区域 -->
    <div class="chart-content" :style="{ height: chartHeight + 'px' }">
      <!-- 加载状态 -->
      <div v-if="loading" class="chart-loading">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="rect" style="width: 100%; height: 200px;" />
          </template>
        </el-skeleton>
      </div>
      
      <!-- 错误状态 -->
      <div v-else-if="error" class="chart-error">
        <Icon icon="mdi:alert-circle" width="48" height="48" />
        <p>{{ error }}</p>
        <el-button size="small" @click="handleRefresh">重试</el-button>
      </div>
      
      <!-- 空数据状态 -->
      <div v-else-if="!hasData" class="chart-empty">
        <Icon icon="mdi:chart-line" width="48" height="48" />
        <p>暂无数据</p>
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
      </div>
      
      <!-- 预测指示器 -->
      <div v-if="showPrediction && predictionData" class="prediction-info">
        <Icon icon="mdi:crystal-ball" width="14" height="14" />
        <span>包含预测数据</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useElementSize, useResizeObserver } from '@vueuse/core';
import * as echarts from 'echarts';

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
    required: true
  },
  chartType: {
    type: String,
    default: 'line',
    validator: (value) => ['line', 'bar', 'pie', 'scatter'].includes(value)
  },
  chartHeight: {
    type: Number,
    default: 300
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  showTimeRange: {
    type: Boolean,
    default: true
  },
  showChartTypeToggle: {
    type: Boolean,
    default: true
  },
  showFooter: {
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
  theme: {
    type: String,
    default: 'light'
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['time-range-change', 'chart-type-change', 'refresh', 'chart-ready']);

// 响应式引用
const chartRef = ref(null);
const chartInstance = ref(null);
const selectedTimeRange = ref('7d');
const selectedChartType = ref(props.chartType);
const lastUpdate = ref(new Date());

// 时间范围选项
const timeRanges = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '最近90天', value: '90d' },
  { label: '最近1年', value: '1y' }
];

// 图表类型选项
const chartTypes = [
  { label: '折线图', value: 'line', icon: 'mdi:chart-line' },
  { label: '柱状图', value: 'bar', icon: 'mdi:chart-bar' },
  { label: '散点图', value: 'scatter', icon: 'mdi:chart-scatter-plot' }
];

// 计算属性
const hasData = computed(() => {
  return props.data && props.data.length > 0;
});

const dataCount = computed(() => {
  return props.data ? props.data.length : 0;
});

// 生成图表配置
const chartOptions = computed(() => {
  if (!hasData.value) return {};
  
  const baseOptions = {
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: 'transparent',
      textStyle: {
        color: '#fff'
      },
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999'
        }
      }
    },
    legend: {
      data: [],
      top: 10,
      textStyle: {
        color: props.theme === 'dark' ? '#fff' : '#333'
      }
    },
    xAxis: {
      type: 'category',
      data: props.data.map(item => item.name || item.x),
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#444' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ccc' : '#666'
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#444' : '#e0e0e0'
        }
      },
      axisLabel: {
        color: props.theme === 'dark' ? '#ccc' : '#666'
      },
      splitLine: {
        lineStyle: {
          color: props.theme === 'dark' ? '#333' : '#f0f0f0'
        }
      }
    }
  };
  
  // 根据图表类型生成series配置
  const series = generateSeriesConfig();
  
  return {
    ...baseOptions,
    series,
    ...props.options
  };
});

// 生成系列配置
function generateSeriesConfig() {
  const series = [];
  
  // 主数据系列
  const mainSeries = {
    name: '实际数据',
    type: selectedChartType.value,
    data: props.data.map(item => item.value || item.y),
    smooth: selectedChartType.value === 'line',
    itemStyle: {
      color: '#409EFF'
    }
  };

  // 如果是折线图，可以添加面积样式
  if (selectedChartType.value === 'line' && props.chartType === 'area') {
    mainSeries.areaStyle = {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
          { offset: 1, color: 'rgba(64, 158, 255, 0.1)' }
        ]
      }
    };
  }
  
  series.push(mainSeries);
  
  // 预测数据系列
  if (props.showPrediction && props.predictionData.length > 0) {
    series.push({
      name: '预测数据',
      type: 'line',
      data: props.predictionData.map(item => item.value || item.y),
      smooth: true,
      lineStyle: {
        type: 'dashed',
        color: '#E6A23C'
      },
      itemStyle: {
        color: '#E6A23C'
      }
    });
  }
  
  return series;
}

// 初始化图表
function initChart() {
  if (!chartRef.value) return;
  
  // 销毁现有实例
  if (chartInstance.value) {
    chartInstance.value.dispose();
  }
  
  // 创建新实例
  chartInstance.value = echarts.init(chartRef.value, props.theme);
  
  // 设置配置
  chartInstance.value.setOption(chartOptions.value);
  
  // 添加事件监听
  chartInstance.value.on('click', (params) => {
    console.log('图表点击:', params);
  });
  
  emit('chart-ready', chartInstance.value);
}

// 更新图表
function updateChart() {
  if (chartInstance.value && hasData.value) {
    chartInstance.value.setOption(chartOptions.value, true);
    lastUpdate.value = new Date();
  }
}

// 事件处理
function handleTimeRangeChange(value) {
  emit('time-range-change', value);
}

function handleChartTypeChange(type) {
  selectedChartType.value = type;
  emit('chart-type-change', type);
}

function handleRefresh() {
  emit('refresh');
}

// 工具函数
function formatTime(date) {
  if (!date) return '--';
  return date.toLocaleTimeString();
}

// 监听器
watch(() => props.data, updateChart, { deep: true });
watch(() => props.theme, initChart);
watch(selectedChartType, updateChart);

// 响应式处理
useResizeObserver(chartRef, () => {
  if (chartInstance.value) {
    chartInstance.value.resize();
  }
});

// 生命周期
onMounted(() => {
  nextTick(initChart);
});

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose();
  }
});
</script>

<style scoped>
.smart-chart-container {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.chart-title-section {
  flex: 1;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 4px 0;
}

.chart-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-content {
  position: relative;
  padding: 20px;
}

.chart-loading,
.chart-error,
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.chart-error {
  color: var(--el-color-danger);
}

.chart-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--el-fill-color-light);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.chart-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.prediction-info {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-warning);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .chart-controls {
    justify-content: flex-end;
  }
  
  .chart-footer {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
