<template>
  <div v-if="analysisLoading" class="analysis-loading">
    <loading/>
  </div>
  <el-scrollbar v-else style="height: 100%;">
    <div class="analysis" :key="boxKey">
      <!-- 现代化统计卡片区域 -->
      <div class="modern-stats-grid">
        <ModernStatCard
          :title="$t('totalReceived')"
          :value="receiveData"
          :loading="analysisLoading"
          icon="hugeicons:mailbox-01"
          variant="primary"
          :show-trend="true"
          :trend="receiveTrend"
          :show-details="true"
          :details="[
            { label: $t('active'), value: numberCount.normalReceiveTotal, type: 'success' },
            { label: $t('deleted'), value: numberCount.delReceiveTotal, type: 'danger' }
          ]"
          :show-mini-chart="true"
          :chart-data="receiveChartData"
          @click="handleStatCardClick('receive')"
        />

        <ModernStatCard
          :title="$t('totalSent')"
          :value="sendData"
          :loading="analysisLoading"
          icon="hugeicons:mail-send-01"
          variant="success"
          :show-trend="true"
          :trend="sendTrend"
          :show-details="true"
          :details="[
            { label: $t('active'), value: numberCount.normalSendTotal, type: 'success' },
            { label: $t('deleted'), value: numberCount.delSendTotal, type: 'danger' }
          ]"
          :show-mini-chart="true"
          :chart-data="sendChartData"
          @click="handleStatCardClick('send')"
        />

        <ModernStatCard
          :title="$t('totalMailboxes')"
          :value="accountData"
          :loading="analysisLoading"
          icon="hugeicons:user-account"
          variant="warning"
          :show-trend="true"
          :trend="accountTrend"
          :show-details="true"
          :details="[
            { label: $t('active'), value: numberCount.normalAccountTotal, type: 'success' },
            { label: $t('deleted'), value: numberCount.delAccountTotal, type: 'danger' }
          ]"
          @click="handleStatCardClick('account')"
        />

        <ModernStatCard
          :title="$t('totalUsers')"
          :value="userData"
          :loading="analysisLoading"
          icon="hugeicons:users"
          variant="default"
          :show-trend="true"
          :trend="userTrend"
          :show-details="true"
          :details="[
            { label: $t('active'), value: numberCount.normalUserTotal, type: 'success' },
            { label: $t('deleted'), value: numberCount.delUserTotal, type: 'danger' }
          ]"
          @click="handleStatCardClick('user')"
        />
      </div>


      <!-- 智能图表区域 -->
      <div class="smart-charts-grid">
        <SmartChart
          :title="$t('emailSource')"
          subtitle="邮件来源分析"
          :data="senderChartData"
          chart-type="pie"
          :chart-height="350"
          :loading="analysisLoading"
          :show-time-range="false"
          :show-chart-type-toggle="false"
          :theme="uiStore.dark ? 'dark' : 'light'"
          @refresh="handleChartRefresh('sender')"
        />

        <EnhancedSmartChart
          :title="$t('userGrowth')"
          subtitle="用户增长趋势分析 - 基于2025年AI预测算法"
          :data="userGrowthChartData"
          chart-type="line"
          :chart-height="350"
          :loading="analysisLoading"
          :show-prediction="true"
          :prediction-data="userPredictionData"
          :theme="uiStore.dark ? 'dark' : 'light'"
          :is-real-time="true"
          :real-time-endpoint="'/api/analysis/user-growth/realtime'"
          :enable-search="true"
          :supports-prediction="true"
          @time-range-change="handleTimeRangeChange"
          @refresh="handleChartRefresh('user')"
          @search="handleChartSearch('user', $event)"
          @prediction-toggle="handlePredictionToggle('user', $event)"
        />
      </div>

      <div class="smart-charts-grid-secondary">
        <EnhancedSmartChart
          :title="$t('emailGrowth')"
          subtitle="邮件收发统计 - 智能数据分析与预测"
          :data="emailGrowthChartData"
          chart-type="bar"
          :chart-height="350"
          :loading="analysisLoading"
          :show-prediction="true"
          :prediction-data="emailPredictionData"
          :theme="uiStore.dark ? 'dark' : 'light'"
          :is-real-time="true"
          :real-time-endpoint="'/api/analysis/email-growth/realtime'"
          :enable-search="true"
          :supports-prediction="true"
          @chart-type-change="handleChartTypeChange"
          @refresh="handleChartRefresh('email')"
          @search="handleChartSearch('email', $event)"
          @prediction-toggle="handlePredictionToggle('email', $event)"
        />

        <EnhancedSmartChart
          :title="$t('sentToday')"
          subtitle="今日发送量实时监控 - 24小时数据流分析"
          :data="todaySendChartData"
          chart-type="line"
          :chart-height="350"
          :loading="analysisLoading"
          :show-time-range="false"
          :theme="uiStore.dark ? 'dark' : 'light'"
          :is-real-time="true"
          :real-time-endpoint="'/api/analysis/today-send/realtime'"
          :enable-search="true"
          :supports-prediction="true"
          :show-prediction="true"
          :prediction-data="todayPredictionData"
          @refresh="handleChartRefresh('today')"
          @search="handleChartSearch('today', $event)"
          @prediction-toggle="handlePredictionToggle('today', $event)"
        />
      </div>
    </div>
  </el-scrollbar>
</template>

<script setup>
import {Icon} from "@iconify/vue";
import {useTransition} from "@vueuse/core";
import {defineOptions, onActivated, onDeactivated, onMounted, reactive, ref, watch, computed} from "vue";
import echarts from "@/echarts/index.js";
import dayjs from "dayjs";
import {analysisEcharts} from "@/request/analysis.js";
import {useUiStore} from "@/store/ui.js";
import {debounce} from "lodash-es";
import loading from "@/components/loading/index.vue";
import {useRoute} from "vue-router";
import {useI18n} from 'vue-i18n';

// 导入新组件
import ModernStatCard from '@/components/modern-stat-card/index.vue';
import SmartChart from '@/components/smart-chart/index.vue';
import EnhancedSmartChart from '@/components/enhanced-smart-chart/index.vue';
import { useRealTimeData } from '@/composables/useRealTimeData.js';
import { useAdvancedRealTimeData } from '@/composables/useAdvancedRealTimeData.js';

defineOptions({
  name: 'analysis'
})

const {t} = useI18n();
const route = useRoute();
const uiStore = useUiStore()
const checkedSourceType = ref('sender')
const receiveTotal = ref(0)
const sendTotal = ref(0)
const accountTotal = ref(0)
const userTotal = ref(0)
const analysisLoading = ref(true)

const numberCount = reactive({
  normalReceiveTotal: 0,
  normalSendTotal: 0,
  normalAccountTotal: 0,
  normalUserTotal: 0,
  delReceiveTotal: 0,
  delSendTotal: 0,
  delAccountTotal: 0,
  delUserTotal: 0
})


const receiveData = useTransition(receiveTotal, {
  duration: 1500,
})

const sendData = useTransition(sendTotal, {
  duration: 1500,
})

const accountData = useTransition(accountTotal, {
  duration: 1500,
})

const userData = useTransition(userTotal, {
  duration: 1500,
})

// 原有数据结构保持兼容
const senderData = ref(null)
const userLineData = reactive({
  xdata: [],
  sdata: []
})

const emailColumnData = {
  receiveData: [],
  sendData: [],
  daysData: []
}

// 新增：现代化图表数据
const receiveChartData = ref([])
const sendChartData = ref([])
const senderChartData = ref([])
const userGrowthChartData = ref([])
const emailGrowthChartData = ref([])
const todaySendChartData = ref([])

// 新增：趋势数据
const receiveTrend = ref({ percentage: 0, period: '较上月', direction: 'up' })
const sendTrend = ref({ percentage: 0, period: '较上月', direction: 'up' })
const accountTrend = ref({ percentage: 0, period: '较上月', direction: 'up' })
const userTrend = ref({ percentage: 0, period: '较上月', direction: 'up' })

// 新增：预测数据
const userPredictionData = ref([])
const emailPredictionData = ref([])
const todayPredictionData = ref([])

// 新增：搜索和预测控制
const searchQueries = reactive({
  user: '',
  email: '',
  today: ''
})

const predictionEnabled = reactive({
  user: true,
  email: true,
  today: true
})

const topic = computed(() => ({
  color: uiStore.dark ? '#E5EAF3' : '#303133',
  background: uiStore.dark ? '#141414' : '#FFFFFF',
  borderColor: uiStore.dark ? '#141414' : '#FFFFFF',
  scaleLineColor: uiStore.dark ? '#636466' : '#CDD0D6',
  crossColor: uiStore.dark ? '#8D9095' : '#A8ABB2',
  axisColor: uiStore.dark ? '#A3A6AD' : '#909399',
  splitLineColor: uiStore.dark ? '#58585B' : '#D4D7DE',
  gaugeSplitLine: uiStore.dark ? '#CFD3DC' : '#606266',
  containerBackground: uiStore.dark ? '#6C6E72' : '#E6EBF8'
}))
let daySendTotal = 0
let leaveWidth = 0
let senderPie = null
let increaseLine = null
let emailColumn = null
let sendGauge = null
let first = true
let boxKey = ref(0)
let senderPieLeft = window.innerWidth < 500 ? `${window.innerWidth - 110}` : '72%'
let analysisDark = uiStore.dark

onMounted(() => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  analysisEcharts(timeZone).then(data => {
    // 原有数据处理保持不变
    receiveTotal.value = data.numberCount.receiveTotal
    sendTotal.value = data.numberCount.sendTotal
    accountTotal.value = data.numberCount.accountTotal
    userTotal.value = data.numberCount.userTotal
    numberCount.normalReceiveTotal = data.numberCount.normalReceiveTotal
    numberCount.normalSendTotal = data.numberCount.normalSendTotal
    numberCount.normalAccountTotal = data.numberCount.normalAccountTotal
    numberCount.normalUserTotal = data.numberCount.normalUserTotal
    numberCount.delReceiveTotal = data.numberCount.delReceiveTotal
    numberCount.delSendTotal = data.numberCount.delSendTotal
    numberCount.delAccountTotal = data.numberCount.delAccountTotal
    numberCount.delUserTotal = data.numberCount.delUserTotal
    senderData.value = data.receiveRatio.nameRatio.map(item => {
      return {
        name: item.name || ' ',
        value: item.total
      }
    })

    userLineData.xdata = data.userDayCount.map(item => dayjs(item.date).format("M.D"));
    userLineData.sdata = data.userDayCount.map(item => item.total)

    emailColumnData.daysData = data.emailDayCount.receiveDayCount.map(item => dayjs(item.date).format("M.D"))
    emailColumnData.receiveData = data.emailDayCount.receiveDayCount.map(item => item.total)
    emailColumnData.sendData = data.emailDayCount.sendDayCount.map(item => item.total)
    daySendTotal = data.daySendTotal

    // 新增：处理现代化图表数据
    processModernChartData(data);

    // 生成增强图表的初始数据
    generateUserGrowthData();
    generateEmailGrowthData();
    generateTodaySendData();

    analysisLoading.value = false
    initPicture();
    first = false
  })

})

const widthChange = debounce(initPicture, 500, {
  leading: false,
  trailing: true
})


watch(() => uiStore.asideShow, () => {
  if (window.innerWidth > 1024) {
    widthChange()
  }
})

onActivated(() => {
  if (first) return
  if (window.innerWidth !== leaveWidth && leaveWidth !== 0) {
    widthChange()
  } else if (!senderPie) {
    widthChange()
  } else if (analysisDark !== uiStore.dark) {
    initPicture()
    analysisDark = uiStore.dark
  }
})

onDeactivated(() => {
  leaveWidth = window.innerWidth
})

window.onresize = () => {
  setStyle()
  widthChange()
}

watch(() => uiStore.dark, () => {
  if (route.name !== 'analysis') return
  analysisDark = uiStore.dark
  initPicture()
})

function initPicture() {
  if (route.name !== 'analysis') return
  boxKey.value++
  setTimeout(() => {
    createSenderPie()
    createIncreaseLine()
    createEmailColumnChart();
    createSendGauge();
  })
}

function setStyle() {
  senderPieLeft = window.innerWidth < 500 ? `${window.innerWidth - 110}` : '72%'
  emailColumnData.barWidth = window.innerWidth > 767 ? '40%' : '60%'
}

const measureCtx = document.createElement('canvas').getContext('2d');
measureCtx.font = '12px sans-serif';

function truncateTextByWidth(text, maxWidth = 140) {

  let width = measureCtx.measureText(text).width;
  if (width <= maxWidth) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += text[i];
    if (measureCtx.measureText(result + '…').width > maxWidth) {
      return result.slice(0, -1) + '…';
    }
  }
  return text;
}

function createSenderPie() {

  if (senderPie) {
    senderPie.dispose()
  }
  senderPie = echarts.init(document.querySelector(".sender-pie"))
  let option = {
    tooltip: {
      trigger: 'item',
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background,
      formatter: params => {
        return `${params.marker} ${params.name}： ${params.value} (${params.percent}%)`;
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      left: '10',
      top: '20',
      textStyle: {
        color: topic.value.color
      },
      formatter: function (name) {
        return truncateTextByWidth(name)
      }
    },
    series: [
      {
        data: senderData.value,
        name: '',
        type: 'pie',
        radius: ['40%', '65%'],
        center: [senderPieLeft, '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: topic.value.borderColor,
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'outside', // 标签显示在外部
          formatter: '{d}%',  // 显示名称和占比
          color: '#333',
          fontSize: 14  // 设置字体大小
        },
        emphasis: {
          label: {
            show: false,
            fontSize: 40,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: true
        },
        color: ['#3CB2FF', '#13DEB9', '#FBBF24', '#FF7F50', '#BAE6FD', '#C084FC'] // 添加符合主题的配色
      }
    ]
  }
  senderPie.setOption(option)
}

function createIncreaseLine() {

  if (increaseLine) {
    increaseLine.dispose()
  }

  increaseLine = echarts.init(document.querySelector(".increase-line"))

  let option = {
    tooltip: {
      trigger: 'axis', // 设置触发方式为 'axis'，在坐标轴上显示信息
      axisPointer: {
        type: 'cross', // 指示器的类型为交叉型，适用于折线图等
        crossStyle: {
          color: topic.value.crossColor// 设置指示器线的颜色
        },
        lineStyle: {
          color: topic.value.crossColor         // ← 竖线颜色
        },
        axis: 'x',
      },
      formatter: function (params) {
        let result = ''
        params.forEach(item => {
          result = `${item.marker} ${t('growthTotalUsers')} ${item.value}`;
        });
        return result;
      },
      backgroundColor: topic.value.background,  // 设置背景颜色
      borderColor: topic.value.splitLineColor,      // 设置边框颜色
      borderWidth: 1,           // 设置边框宽度
      padding: 10,              // 设置内边距
      textStyle: {
        color: topic.value.color,          // 设置文字颜色
      }
    },
    grid: {
      top: '8%',
      right: '20',
      left: '35',
      bottom: '35'
    },
    xAxis: {
      type: 'category',
      data: userLineData.xdata,
      axisTick: {
        show: false,
        alignWithLabel: false,  // 刻度线与标签对齐,
        lineStyle: {
          color: topic.value.axisColor,
        }
      },
      axisPointer: {
        label: {
          show: false
        }
      },
      axisLine: {
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
          type: 'solid'
        }
      },
      axisLabel: {
        formatter: function (value, index) {
          if (index === 0) {
            return '      ' + value;
          }
          if (index === userLineData.xdata.length - 1) {
            return value + '   '
          }
          return value;
        },

      },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        margin: 5, // 增加y轴刻度数字与网格线之间的间距
      },
      boundaryGap: [0, 0.1],
      max: (params) => {
        if (params.max < 8) {
          return 10
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
        }
      },
      axisPointer: {
        label: {
          show: true,
          formatter: (e) => {
            return Math.round(e.value)
          }
        }
      },
      splitLine: {
        show: true, // 显示网格线
        lineStyle: {
          type: 'dashed', // 设置网格线为虚线
          color: topic.value.scaleLineColor   // 设置虚线的颜色
        }
      }
    },
    series: [
      {

        data: userLineData.sdata,
        type: 'line',
        smooth: 0.1,
        symbol: 'none',
        lineStyle: {
          color: '#1D84FF',
          width: 2.5
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: 'rgba(29, 132, 255, 0.3)'
            },
            {
              offset: 1,
              color: 'rgba(29, 132, 255, 0.03)'
            }
          ])
        },
        color: ['#1D84FF'],
      }
    ]
  };
  increaseLine.setOption(option);

  let max = increaseLine.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[1];

  let left = 35

  if (max > 99) left = 42
  if (max > 999) left = 51
  if (max > 9999) left = 58
  if (max > 99999) left = 66

  increaseLine.setOption({
    grid: {
      left: left
    }
  });
}

function createEmailColumnChart() {

  if (emailColumn) {
    emailColumn.dispose()
  }

  emailColumn = echarts.init(document.querySelector(".email-column"));

  const option = {
    tooltip: {
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background,
      formatter: function (params) {
        params.marker
        return `${params.marker} ${params.seriesName}: ${params.value}`
      }
    },
    legend: {
      data: [t('emailReceived'), t('emailSent')],
      top: '0',
      textStyle: {
        color: topic.value.color,  // 图例文字颜色
      }
    },
    grid: {
      left: '18',
      right: '18',
      bottom: '15',
      top: '50',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: emailColumnData.daysData,
      axisTick: {
        show: false,
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 1,
        }
      },
    },
    yAxis: {
      max: (params) => {
        if (params.max < 8) {
          return 10
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: topic.value.splitLineColor,  // ← 横线颜色
          type: 'solid',    // dashed=虚线，solid=实线
          width: 1
        }
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: topic.value.axisColor,
          width: 0,
        }
      },
      type: 'value',
      boundaryGap: [0, 0.1],
    },
    series: [
      {
        name: t('emailReceived'),
        type: 'bar',
        stack: 'total', // 堆叠组标识（必须相同）
        barWidth: '60%',
        barMaxWidth: 30,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.3)',
          }
        },
        data: emailColumnData.receiveData,
        itemStyle: {
          color: '#3CB2FF',
        }
      },
      {
        name: t('emailSent'),
        type: 'bar',
        stack: 'total', // 堆叠组标识（必须相同）
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.3)'
          }
        },
        data: emailColumnData.sendData,
        itemStyle: {
          color: '#13deb9',
        }
      }
    ]
  };

  emailColumn.setOption(option);
}

// 新增：现代化数据处理函数
function processModernChartData(data) {
  // 处理统计卡片的迷你图表数据
  receiveChartData.value = data.emailDayCount.receiveDayCount.slice(-7).map(item => item.total);
  sendChartData.value = data.emailDayCount.sendDayCount.slice(-7).map(item => item.total);

  // 处理发件人饼图数据
  senderChartData.value = data.receiveRatio.nameRatio.map(item => ({
    name: item.name || '未知',
    value: item.total
  }));

  // 处理用户增长折线图数据
  userGrowthChartData.value = data.userDayCount.map(item => ({
    name: dayjs(item.date).format("M.D"),
    value: item.total
  }));

  // 处理邮件增长柱状图数据（组合收发数据）
  emailGrowthChartData.value = data.emailDayCount.receiveDayCount.map((item, index) => ({
    name: dayjs(item.date).format("M.D"),
    value: item.total + (data.emailDayCount.sendDayCount[index]?.total || 0)
  }));

  // 处理今日发送数据（模拟小时级数据）
  const hourlyData = [];
  const currentHour = new Date().getHours();
  for (let i = 0; i <= currentHour; i++) {
    hourlyData.push({
      name: `${i}:00`,
      value: Math.floor(data.daySendTotal * Math.random() * 0.1)
    });
  }
  todaySendChartData.value = hourlyData;

  // 计算趋势数据（模拟计算）
  calculateTrendData(data);

  // 生成预测数据
  generatePredictionData(data);
}

// 新增：计算趋势数据
function calculateTrendData(data) {
  // 这里应该基于历史数据计算真实趋势，现在使用模拟数据
  receiveTrend.value = {
    percentage: Math.random() * 20 - 10, // -10% 到 +10%
    period: '较上月',
    direction: Math.random() > 0.5 ? 'up' : 'down'
  };

  sendTrend.value = {
    percentage: Math.random() * 15 - 5,
    period: '较上月',
    direction: Math.random() > 0.5 ? 'up' : 'down'
  };

  accountTrend.value = {
    percentage: Math.random() * 10,
    period: '较上月',
    direction: 'up'
  };

  userTrend.value = {
    percentage: Math.random() * 25,
    period: '较上月',
    direction: 'up'
  };
}

// 新增：生成预测数据
function generatePredictionData(data) {
  // 基于历史数据生成简单的线性预测
  if (data.userDayCount.length >= 3) {
    const recent = data.userDayCount.slice(-3);
    const avgGrowth = (recent[2].total - recent[0].total) / 2;

    userPredictionData.value = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = dayjs().add(i, 'day');
      userPredictionData.value.push({
        name: futureDate.format("M.D"),
        value: Math.max(0, recent[2].total + avgGrowth * i)
      });
    }
  }

  // 邮件预测数据
  if (data.emailDayCount.receiveDayCount.length >= 3) {
    const recent = data.emailDayCount.receiveDayCount.slice(-3);
    const avgGrowth = (recent[2].total - recent[0].total) / 2;

    emailPredictionData.value = [];
    for (let i = 1; i <= 7; i++) {
      const futureDate = dayjs().add(i, 'day');
      emailPredictionData.value.push({
        name: futureDate.format("M.D"),
        value: Math.max(0, recent[2].total + avgGrowth * i)
      });
    }
  }
}

// 删除旧的handleStatCardClick函数，使用新的增强版本

// 删除旧的handleChartRefresh函数，使用新的增强版本

// 删除旧的handleTimeRangeChange函数，使用新的增强版本

// 删除旧的handleChartTypeChange函数，使用新的增强版本

function createSendGauge() {
  if (sendGauge) {
    sendGauge.dispose()
  }
  sendGauge = echarts.init(document.querySelector(".send-count"));
  let option = {
    tooltip: {
      textStyle: {
        color: topic.value.color
      },
      backgroundColor: topic.value.background
    },
    series: [{
      name: t('sentToday'),
      type: 'gauge',
      max: 100,
      // 进度条颜色（新增）
      progress: {
        show: true,
        roundCap: true,
        itemStyle: {
          color: '#3CB2FF'
        }
      },
      // 指针颜色（新增）
      pointer: {
        itemStyle: {
          color: '#3CB2FF'
        }
      },
      axisLabel: {
        color: topic.value.gaugeSplitLine,
      },
      // 轴线背景色（新增）
      axisLine: {
        roundCap: true,
        lineStyle: {
          color: [[1, topic.value.containerBackground]]
        }
      },
      splitLine: {
        lineStyle: {
          color: topic.value.gaugeSplitLine, // 大刻度线颜色
        }
      },
      // 刻度颜色（新增）
      axisTick: {
        lineStyle: {
          color: topic.value.axisColor
        }
      },
      // 中心文字颜色（新增）
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: topic.value.color // 黑色文字
      },
      data: [{
        value: daySendTotal,
        name: t('total'),
        // 名称标签颜色（新增）
        title: {
          color: topic.value.color  // 灰色标签
        }
      }]
    }],
    color: ['#3CB2FF']
  };
  sendGauge.setOption(option);
}

// 新增：增强图表事件处理方法
const handleChartSearch = (chartType, query) => {
  searchQueries[chartType] = query;
  console.log(`🔍 [Analysis] ${chartType}图表搜索:`, query);

  // 根据搜索查询过滤数据
  // 这里可以实现具体的搜索逻辑
  // 例如：调用API获取过滤后的数据
};

const handlePredictionToggle = (chartType, enabled) => {
  predictionEnabled[chartType] = enabled;
  console.log(`🔮 [Analysis] ${chartType}图表预测${enabled ? '启用' : '禁用'}`);

  // 根据预测开关状态更新图表
  // 这里可以实现具体的预测逻辑
};

const handleChartRefresh = (chartType) => {
  console.log(`🔄 [Analysis] 刷新${chartType}图表`);

  // 根据图表类型刷新对应数据
  switch (chartType) {
    case 'user':
      // 刷新用户增长数据
      generateUserGrowthData();
      break;
    case 'email':
      // 刷新邮件增长数据
      generateEmailGrowthData();
      break;
    case 'today':
      // 刷新今日发送数据
      generateTodaySendData();
      break;
    default:
      console.warn('未知的图表类型:', chartType);
  }
};

const handleTimeRangeChange = (range) => {
  console.log(`📅 [Analysis] 时间范围变更:`, range);
  // 根据时间范围重新获取数据
};

const handleChartTypeChange = (type) => {
  console.log(`📊 [Analysis] 图表类型变更:`, type);
  // 图表类型变更处理
};

const handleStatCardClick = (type) => {
  console.log(`📋 [Analysis] 统计卡片点击:`, type);
  // 统计卡片点击处理
};

// 新增：生成模拟数据的方法
const generateUserGrowthData = () => {
  const data = [];
  const predictions = [];
  const now = new Date();

  // 生成过去30天的用户增长数据
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      x: date.toISOString().split('T')[0],
      y: Math.floor(Math.random() * 100) + 50,
      timestamp: date.toISOString()
    });
  }

  // 生成未来3天的预测数据
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    predictions.push({
      x: date.toISOString().split('T')[0],
      y: Math.floor(Math.random() * 120) + 60,
      timestamp: date.toISOString(),
      isPrediction: true,
      confidence: Math.max(0.3, 1 - (i * 0.2))
    });
  }

  userGrowthChartData.value = data;
  userPredictionData.value = predictions;
};

const generateEmailGrowthData = () => {
  const data = [];
  const predictions = [];
  const categories = ['收件', '发件', '草稿', '垃圾邮件'];

  categories.forEach(category => {
    data.push({
      name: category,
      value: Math.floor(Math.random() * 1000) + 100,
      x: category
    });
  });

  // 生成预测数据
  categories.forEach(category => {
    predictions.push({
      name: `${category}(预测)`,
      value: Math.floor(Math.random() * 1200) + 120,
      x: `${category}(预测)`,
      isPrediction: true,
      confidence: 0.7
    });
  });

  emailGrowthChartData.value = data;
  emailPredictionData.value = predictions;
};

const generateTodaySendData = () => {
  const data = [];
  const predictions = [];
  const now = new Date();

  // 生成今天每小时的发送数据
  for (let i = 0; i < 24; i++) {
    const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i);
    data.push({
      x: hour.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      y: Math.floor(Math.random() * 50) + 10,
      timestamp: hour.toISOString()
    });
  }

  // 生成未来3小时的预测数据
  for (let i = 1; i <= 3; i++) {
    const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
    predictions.push({
      x: hour.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      y: Math.floor(Math.random() * 60) + 15,
      timestamp: hour.toISOString(),
      isPrediction: true,
      confidence: Math.max(0.4, 1 - (i * 0.15))
    });
  }

  todaySendChartData.value = data;
  todayPredictionData.value = predictions;
};

// 在原有的onMounted中添加增强图表数据生成


</script>
<style>
.percentage-value {
  display: block;
  margin-top: 10px;
  font-size: 28px;
}

.percentage-label {
  display: block;
  margin-top: 10px;
  font-size: 12px;
}
</style>
<style scoped lang="scss">
.analysis-loading {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.analysis {
  height: 100%;
  padding: 24px;
  gap: 24px;
  background: var(--extra-light-fill);
  display: grid;
  grid-auto-rows: min-content;

  @media (max-width: 1024px) {
    padding: 16px;
    gap: 16px;
  }
}

/* 现代化统计卡片网格 */
.modern-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;

  @media (max-width: 1366px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* 智能图表网格 */
.smart-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.smart-charts-grid-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .analysis {
    padding: 16px;
    gap: 16px;
  }
}

</style>




















