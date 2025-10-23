<template>
  <div class="email-list-box">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <!-- 搜索和筛选控件 -->
        <el-input
            v-model="searchValue"
            :placeholder="searchPlaceholder"
            class="search-input"
            clearable
            @input="handleSearchInput"
            @clear="handleSearchClear"
        >
          <template #prefix>
            <div @click.stop="openSelect">
              <el-select
                  ref="mySelect"
                  v-model="params.searchType"
                  :placeholder="$t('select')"
                  class="select"
                  @change="handleSearchTypeChange"
              >
                <el-option key="5" :label="$t('allContent')" :value="'allContent'"/>
                <el-option key="3" :label="$t('sender')" :value="'name'"/>
                <el-option key="4" :label="$t('subject')" :value="'subject'"/>
                <el-option key="1" :label="$t('user')" :value="'user'"/>
                <el-option key="2" :label="$t('selectEmail')" :value="'account'"/>
              </el-select>
              <div class="search-type">
                <span>{{ selectTitle }}</span>
                <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
              </div>
            </div>
          </template>
          <template #suffix v-if="searchValue">
            <div class="search-info">
              <span v-if="searchResultCount > 0" class="result-count">
                {{ $t('foundEmails', { count: searchResultCount }) }}
              </span>
              <el-icon v-if="isSearching" class="is-loading">
                <Loading />
              </el-icon>
            </div>
          </template>
        </el-input>
        <el-select v-model="params.type" placeholder="Select" class="status-select" @change="typeSelectChange">
          <el-option key="1" :label="$t('all')" value="all"/>
          <el-option key="3" :label="$t('received')" value="receive"/>
          <el-option key="2" :label="$t('sent')" value="send"/>
          <el-option key="4" :label="$t('selectDeleted')" value="delete"/>
          <el-option key="4" :label="$t('noRecipientTitle')" value="noone"/>
        </el-select>
        <Icon class="icon" icon="iconoir:search" @click="search" width="20" height="20"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
              v-if="params.timeSort === 0" width="28" height="28"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
              width="28" height="28"/>
        <Icon class="icon clear" icon="fluent:broom-sparkle-16-regular" width="22" height="22" @click="openBathDelete"/>
      </div>
      <div class="header-right">
        <LayoutModeSelector />
      </div>
    </div>

    <!-- 分屏布局容器 -->
    <SplitPaneLayout class="split-container">
      <!-- 邮件列表 -->
      <template #list>
        <emailScroll ref="sysEmailScroll"
                     :get-emailList="getEmailList"
                     :email-delete="allEmailDelete"
                     :star-add="starAdd"
                     :star-cancel="starCancel"
                     :show-star="false"
                     show-user-info
                     show-status
                     actionLeft="4px"
                     :show-account-icon="false"
                     @jump="handleEmailSelect"
                     @refresh-before="refreshBefore"
                     :type="'all-email'"
        />
      </template>

      <!-- 邮件详情 -->
      <template #detail>
        <EmailDetailPane v-if="emailStore.splitLayout?.showDetailPane" />
      </template>
    </SplitPaneLayout>
    <el-dialog v-model="showBathDelete" :title="$t('clearEmail')" width="335"
               @closed="closedClear">
      <div class="clear-email">
        <el-input v-model="clearParams.sendName" :placeholder="$t('sender')"/>
        <el-input v-model="clearParams.subject" :placeholder="$t('subject')"/>
        <el-input v-model="clearParams.sendEmail" :placeholder="$t('sendEmailAddress')"/>
        <el-input v-model="clearParams.toEmail" :placeholder="$t('toEmail')"/>
        <el-date-picker popper-class="my-date-picker"
                        v-model="clearTime"
                        type="daterange"
                        :teleported="false"
                        unlink-panels
                        :range-separator="t('to')"
                        size="default"
        />
        <div class="clear-button">
          <el-select v-model="clearParams.type" style="width: 200px">
            <el-option key="eq" :label="t('equal')" value="eq"/>
            <el-option key="left" :label="t('leading')" value="left"/>
            <el-option key="include" :label="t('include')" value="include"/>
          </el-select>
          <el-button :loading="clearLoading" type="primary" @click="batchDelete">{{ t('clear') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import {starAdd, starCancel} from "@/request/star.js";
import emailScroll from "@/components/email-scroll/index.vue"
import SplitPaneLayout from "@/components/SplitPaneLayout.vue"
import LayoutModeSelector from "@/components/LayoutModeSelector.vue"
import EmailDetailPane from "@/components/EmailDetailPane.vue"
import {computed, defineOptions, onMounted, reactive, ref, watch} from "vue";
import {useSettingStore} from "@/store/setting.js";
import {sleep} from "@/utils/time-utils.js";
import {useEmailStore} from "@/store/email.js";
import {
  allEmailList,
  allEmailDelete,
  allEmailBatchDelete,
  allEmailLatest
} from "@/request/all-email.js";
import {Icon} from "@iconify/vue";
import router from "@/router/index.js";
import {useI18n} from 'vue-i18n';
import {toUtc} from "@/utils/day.js";
import safeStorage from '@/utils/safeStorage.js';

defineOptions({
  name: 'all-email'
})

const {t} = useI18n();
const emailStore = useEmailStore();
const settingStore = useSettingStore();
const clearTime = ref('')
const sysEmailScroll = ref({})
const searchValue = ref('')
const mySelect = ref()
const showBathDelete = ref(false)
const clearLoading = ref(false)
const isSearching = ref(false)
const searchResultCount = ref(0)
const searchDebounceTimer = ref(null)

const openSelect = () => {
  mySelect.value.toggleMenu()
}

const params = reactive({
  timeSort: 0,
  type: 'receive',
  userEmail: null,
  accountEmail: null,
  name: null,
  subject: null,
  allContent: null,
  searchType: 'allContent'
})

const clearParams = reactive({
  subject: '',
  sendEmail: '',
  sendName: '',
  startTime: '',
  toEmail: '',
  endTime: '',
  type: 'eq',
})

function resetClearParams() {
  clearParams.subject = ''
  clearParams.sendEmail = ''
  clearParams.sendName = ''
  clearParams.startTime = ''
  clearParams.toEmail = ''
  clearParams.endTime = ''
}

function closedClear() {
  resetClearParams()
  clearParams.type = 'eq'
  clearParams.endTime = ''
  clearTime.value = null
}

const selectTitle = computed(() => {
  if (params.searchType === 'user') return t('user')
  if (params.searchType === 'account') return t('selectEmail')
  if (params.searchType === 'name') return t('sender')
  if (params.searchType === 'subject') return t('subject')
  if (params.searchType === 'allContent') return t('allContent')
})

const searchPlaceholder = computed(() => {
  if (params.searchType === 'allContent') return t('searchAllContent')
  return t('searchByContent')
})

const paramsStar = safeStorage.getJSON('all-email-params')
if (paramsStar) {
  params.type = paramsStar.type
  params.timeSort = paramsStar.timeSort
  params.status = paramsStar.status
  params.searchType = paramsStar.searchType
}

// 防抖定时器
let paramsDebounceTimer = null

watch(() => params, async () => {
  // 清除之前的定时器
  if (paramsDebounceTimer) {
    clearTimeout(paramsDebounceTimer)
  }
  
  // 使用 500ms 防抖延迟，避免频繁保存到 localStorage
  paramsDebounceTimer = setTimeout(async () => {
    await safeStorage.setJSON('all-email-params', params)
  }, 500)
}, {
  deep: true
})

function openBathDelete() {
  showBathDelete.value = true
}

function batchDelete() {

  if (clearTime.value) {
    clearParams.startTime = toUtc(clearTime.value[0]).format("YYYY-MM-DD HH:mm:ss")
    clearParams.endTime = toUtc(clearTime.value[1]).add(1, 'day').format("YYYY-MM-DD HH:mm:ss")
  }

  if (!clearParams.sendEmail && !clearParams.sendName && !clearParams.subject && !clearParams.toEmail && !clearTime.value) {
    showBathDelete.value = false
    return
  }

  ElMessageBox.confirm(
      t('delAllEmailConfirm'),
      {
        confirmButtonText: t('confirm'),
        cancelButtonText: t('cancel'),
        type: 'warning',
      }
  ).then(() => {
    clearLoading.value = true

    allEmailBatchDelete(clearParams).then(() => {
      ElMessage({
        message: t('clearSuccess'),
        type: "success",
        plain: true
      })
      resetClearParams()
      sysEmailScroll.value.refreshList();
    }).finally(() => {
      clearLoading.value = false
    })
  })
}

function refreshBefore() {
  searchValue.value = null
  params.timeSort = 0
  params.type = 'receive'
  params.userEmail = null
  params.accountEmail = null
  params.name = null
  params.subject = null
  params.allContent = null
  params.searchType = 'allContent'
  searchResultCount.value = 0
}

function search() {
  // 清空所有搜索参数
  params.userEmail = null
  params.accountEmail = null
  params.name = null
  params.subject = null
  params.allContent = null

  // 根据搜索类型设置对应参数
  if (params.searchType === 'user') {
    params.userEmail = searchValue.value
  }

  if (params.searchType === 'account') {
    params.accountEmail = searchValue.value
  }

  if (params.searchType === 'name') {
    params.name = searchValue.value
  }

  if (params.searchType === 'subject') {
    params.subject = searchValue.value
  }

  if (params.searchType === 'allContent') {
    params.allContent = searchValue.value
  }

  sysEmailScroll.value.refreshList();
}

// 实时搜索处理函数
function handleSearchInput(value) {
  // 清除之前的定时器
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }

  // 如果搜索值为空，立即清空结果
  if (!value || value.trim() === '') {
    handleSearchClear()
    return
  }

  // 设置搜索状态
  isSearching.value = true

  // 设置300ms防抖
  searchDebounceTimer.value = setTimeout(() => {
    search()
    isSearching.value = false
  }, 300)
}

// 清除搜索处理函数
function handleSearchClear() {
  searchValue.value = ''
  searchResultCount.value = 0
  isSearching.value = false

  // 清除防抖定时器
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
    searchDebounceTimer.value = null
  }

  // 清空搜索参数并刷新列表
  params.userEmail = null
  params.accountEmail = null
  params.name = null
  params.subject = null
  params.allContent = null

  sysEmailScroll.value.refreshList()
}

// 搜索类型变更处理函数
function handleSearchTypeChange() {
  if (searchValue.value && searchValue.value.trim() !== '') {
    // 如果有搜索内容，立即执行搜索
    search()
  }
}

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  search()
}

function typeSelectChange() {
  search()
}

// 处理邮件选择
function handleEmailSelect(email) {
  const { splitLayout } = emailStore

  if (splitLayout.mode === 'none' || (typeof window !== 'undefined' && window.innerWidth < 1025)) {
    // 无分屏模式或移动端，保持原有路由跳转
    jumpContent(email)
  } else {
    // 分屏模式下选择邮件
    emailStore.selectEmail(email)
  }
}

// 原有的跳转逻辑
function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'physics'
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  router.push({name: 'content'})
}


function getEmailList(emailId, size) {
  return allEmailList({emailId, size, ...params}).then(response => {
    // 更新搜索结果计数
    if (response && response.total !== undefined) {
      searchResultCount.value = response.total
    }
    return response
  })
}

onMounted(() => {
  // 从 localStorage 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage();
  latest()
})

const existIds = new Set();

async function latest() {
  while (true) {
    const latestId = sysEmailScroll.value.latestEmail?.emailId || 0

    if (!sysEmailScroll.value.firstLoad && settingStore.settings.autoRefreshTime) {
      try {
        const list = await allEmailLatest(latestId)
        if (list.length > 0) {
          list.forEach(email => {
            existIds.add(email.emailId)
            sysEmailScroll.value.addItem(email)
          })
        }
      } catch (e) {
        console.error(e)
      }
    }
    await sleep(settingStore.settings.autoRefreshTime * 1000)
  }
}
</script>
<style>

@media (max-width: 767px) {
  .el-date-range-picker .el-picker-panel__body {
    min-width: auto;

  }

  .my-date-picker::after {
    content: "";
    position: absolute; /* 脱离文档流，不会撑开 */
    left: 0;
    right: 0;
    height: 20px;
    background: transparent; /* 方便看效果 */
  }

  .el-date-range-picker__content {
    width: 100%;
  }

  .el-date-range-picker {
    width: 300px;
  }

  .el-tooltip .el-picker_popper {
    padding-bottom: 200px;
  }

  .el-date-range-picker__content.is-left {
    border-right: 0;
  }
}

</style>
<style scoped lang="scss">
.email-list-box {
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  align-items: center;
}

.split-container {
  flex: 1;
  overflow: hidden;
}


.search {
  padding-top: 5px;
  padding-bottom: 5px;
}

.select {
  position: absolute;
  width: 40px;
  opacity: 0;
  pointer-events: none;
}

.search-type {
  display: flex;
  color: var(--el-text-color-regular);
}

:deep(.header-actions) {
  padding-top: 8px;
  padding-bottom: 8px;
}

.search-input {
  width: 100%;
  max-width: 280px;
  height: 28px;

  .setting-icon {
    position: relative;
    top: 3px;
  }

  .search-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .result-count {
      font-size: 12px;
      color: var(--el-color-success);
      white-space: nowrap;
    }

    .is-loading {
      color: var(--el-color-primary);
      animation: rotating 2s linear infinite;
    }
  }
}

@keyframes rotating {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.clear-email {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.clear-button {
  display: flex;
  align-items: center;
  gap: 15px;

  .el-button {
    width: 100%;
  }
}

.status-select {
  margin-bottom: 2px;
  width: 102px;

  :deep(.el-select__wrapper) {
    min-height: 28px;
  }
}

.input-with-select {
  max-width: 200px;
  border-radius: 0 4px 4px 0;
}

:deep(.input-with-select .el-input-group__append) {
  background-color: var(--el-fill-color-blank);
}

:deep(.el-select__wrapper) {
  padding: 2px 10px;
  min-height: 28px;
}

:deep(.el-date-editor.el-input__wrapper) {
  width: 303px;
}

.icon {
  cursor: pointer;
  color: #606266;
  transition: color 0.3s;

  &:hover {
    color: #409eff;
  }
}

.clear {
  @media (max-width: 407px) {
    position: absolute;
    top: 41px;
    left: 242px;
  }
}

:deep(.reload) {
  @media (max-width: 407px) {
    position: absolute;
    top: 42px;
    left: 208px;
  }
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .page-header {
    padding: 8px 12px;
  }

  .header-left {
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-left {
    justify-content: space-between;
  }

  .header-right {
    justify-content: center;
  }
}
</style>
