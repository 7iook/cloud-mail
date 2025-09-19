<template>
  <div 
    class="modern-stat-card"
    :class="[
      `variant-${variant}`,
      { 'is-loading': loading, 'has-trend': showTrend }
    ]"
    @click="handleClick"
  >
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
    
    <!-- 卡片内容 -->
    <div class="card-content">
      <!-- 头部区域 -->
      <div class="card-header">
        <div class="title-section">
          <h3 class="card-title">{{ title }}</h3>
          <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
        </div>
        
        <div class="icon-section" v-if="icon">
          <div class="icon-container" :style="{ backgroundColor: iconBgColor }">
            <Icon :icon="icon" :width="iconSize" :height="iconSize" />
          </div>
        </div>
      </div>
      
      <!-- 主要数值区域 -->
      <div class="value-section">
        <div class="main-value">
          <span class="value-number">
            {{ formattedValue }}
          </span>
          <span v-if="unit" class="value-unit">{{ unit }}</span>
        </div>
        
        <!-- 趋势指示器 -->
        <div v-if="showTrend && trend" class="trend-indicator" :class="trendClass">
          <Icon 
            :icon="trendIcon" 
            width="16" 
            height="16" 
            class="trend-icon"
          />
          <span class="trend-value">{{ Math.abs(trend.percentage) }}%</span>
          <span class="trend-period">{{ trend.period }}</span>
        </div>
      </div>
      
      <!-- 底部详情区域 -->
      <div v-if="showDetails" class="details-section">
        <div class="detail-item" v-for="detail in details" :key="detail.label">
          <span class="detail-label">{{ detail.label }}</span>
          <span class="detail-value" :class="detail.type">{{ detail.value }}</span>
        </div>
      </div>
      
      <!-- 迷你图表区域 -->
      <div v-if="showMiniChart && chartData" class="mini-chart-section">
        <canvas 
          ref="miniChartRef" 
          class="mini-chart"
          :width="chartWidth"
          :height="chartHeight"
        ></canvas>
      </div>
    </div>
    
    <!-- 交互提示 -->
    <div v-if="clickable" class="click-hint">
      <Icon icon="mdi:chevron-right" width="16" height="16" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useTransition, useElementSize } from '@vueuse/core';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  value: {
    type: [Number, String],
    required: true
  },
  unit: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  },
  iconSize: {
    type: [Number, String],
    default: 24
  },
  iconBgColor: {
    type: String,
    default: 'var(--el-color-primary-light-9)'
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'success', 'warning', 'danger'].includes(value)
  },
  loading: {
    type: Boolean,
    default: false
  },
  clickable: {
    type: Boolean,
    default: false
  },
  showTrend: {
    type: Boolean,
    default: false
  },
  trend: {
    type: Object,
    default: null
    // { percentage: 12.5, period: '较上月', direction: 'up' }
  },
  showDetails: {
    type: Boolean,
    default: false
  },
  details: {
    type: Array,
    default: () => []
    // [{ label: '活跃', value: '1,234', type: 'success' }]
  },
  showMiniChart: {
    type: Boolean,
    default: false
  },
  chartData: {
    type: Array,
    default: () => []
  },
  formatter: {
    type: Function,
    default: (value) => {
      if (typeof value === 'number') {
        return value.toLocaleString();
      }
      return String(value);
    }
  }
});

const emit = defineEmits(['click', 'chart-ready']);

// 响应式引用
const miniChartRef = ref(null);
const { width: chartWidth, height: chartHeight } = useElementSize(miniChartRef);

// 数值动画
const numericValue = computed(() => {
  const num = parseFloat(props.value);
  return isNaN(num) ? 0 : num;
});

const animatedValue = useTransition(numericValue, {
  duration: 1200,
  transition: [0.25, 0.46, 0.45, 0.94] // cubic-bezier缓动
});

// 格式化数值
const formattedValue = computed(() => {
  if (props.loading) return '--';
  
  const value = typeof props.value === 'number' ? animatedValue.value : props.value;
  return props.formatter(value);
});

// 趋势相关计算
const trendClass = computed(() => {
  if (!props.trend) return '';
  
  const { direction, percentage } = props.trend;
  if (direction === 'up' || percentage > 0) return 'trend-up';
  if (direction === 'down' || percentage < 0) return 'trend-down';
  return 'trend-neutral';
});

const trendIcon = computed(() => {
  if (!props.trend) return '';
  
  const { direction, percentage } = props.trend;
  if (direction === 'up' || percentage > 0) return 'mdi:trending-up';
  if (direction === 'down' || percentage < 0) return 'mdi:trending-down';
  return 'mdi:trending-neutral';
});

// 事件处理
function handleClick() {
  if (props.clickable && !props.loading) {
    emit('click');
  }
}

// 迷你图表渲染
function renderMiniChart() {
  if (!props.showMiniChart || !props.chartData.length || !miniChartRef.value) {
    return;
  }
  
  const canvas = miniChartRef.value;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 数据处理
  const data = props.chartData;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  // 绘制路径
  ctx.beginPath();
  ctx.strokeStyle = 'var(--el-color-primary)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  data.forEach((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // 填充渐变
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(64, 158, 255, 0.1)');
  gradient.addColorStop(1, 'rgba(64, 158, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  emit('chart-ready', { canvas, ctx, data });
}

// 监听图表数据变化
watch(() => props.chartData, () => {
  nextTick(renderMiniChart);
}, { deep: true });

watch([chartWidth, chartHeight], () => {
  nextTick(renderMiniChart);
});

onMounted(() => {
  nextTick(renderMiniChart);
});
</script>

<style scoped>
.modern-stat-card {
  position: relative;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.modern-stat-card:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.modern-stat-card.clickable {
  cursor: pointer;
}

.modern-stat-card.is-loading {
  pointer-events: none;
}

/* 变体样式 */
.variant-primary {
  border-color: var(--el-color-primary-light-8);
  background: linear-gradient(135deg, var(--el-color-primary-light-9) 0%, var(--el-bg-color) 100%);
}

.variant-success {
  border-color: var(--el-color-success-light-8);
  background: linear-gradient(135deg, var(--el-color-success-light-9) 0%, var(--el-bg-color) 100%);
}

.variant-warning {
  border-color: var(--el-color-warning-light-8);
  background: linear-gradient(135deg, var(--el-color-warning-light-9) 0%, var(--el-bg-color) 100%);
}

.variant-danger {
  border-color: var(--el-color-danger-light-8);
  background: linear-gradient(135deg, var(--el-color-danger-light-9) 0%, var(--el-bg-color) 100%);
}

/* 加载状态 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--el-color-primary-light-8);
  border-top: 2px solid var(--el-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 卡片布局 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.title-section {
  flex: 1;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin: 0 0 4px 0;
}

.card-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.icon-container {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
}

/* 数值区域 */
.value-section {
  margin-bottom: 16px;
}

.main-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.value-number {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.value-unit {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

/* 趋势指示器 */
.trend-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}

.trend-up {
  color: var(--el-color-success);
}

.trend-down {
  color: var(--el-color-danger);
}

.trend-neutral {
  color: var(--el-text-color-secondary);
}

.trend-period {
  color: var(--el-text-color-secondary);
}

/* 详情区域 */
.details-section {
  display: flex;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
}

.detail-value.success {
  color: var(--el-color-success);
}

.detail-value.danger {
  color: var(--el-color-danger);
}

/* 迷你图表 */
.mini-chart-section {
  margin-top: 16px;
  height: 40px;
}

.mini-chart {
  width: 100%;
  height: 100%;
}

/* 点击提示 */
.click-hint {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  transition: opacity 0.2s;
}

.modern-stat-card.clickable:hover .click-hint {
  opacity: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modern-stat-card {
    padding: 16px;
  }
  
  .value-number {
    font-size: 24px;
  }
  
  .icon-container {
    width: 40px;
    height: 40px;
  }
}
</style>
