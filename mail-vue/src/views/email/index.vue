<template>
  <div class="email-page">
    <!-- 布局模式选择器 -->
    <div class="page-header">
      <div class="header-left">
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-down-outline"
              v-if="params.timeSort === 0" width="28" height="28"/>
        <Icon class="icon" @click="changeTimeSort" icon="material-symbols-light:timer-arrow-up-outline" v-else
              width="28" height="28"/>
      </div>
      <div class="header-right">
        <LayoutModeSelector />
      </div>
    </div>

    <!-- 分屏布局容器 -->
    <SplitPaneLayout class="split-container">
      <!-- 邮件列表 -->
      <template #list>
        <emailScroll ref="scroll"
                     :cancel-success="cancelStar"
                     :star-success="addStar"
                     :getEmailList="getEmailList"
                     :emailDelete="emailDelete"
                     :star-add="starAdd"
                     :star-cancel="starCancel"
                     :time-sort="params.timeSort"
                     actionLeft="4px"
                     @jump="handleEmailSelect"
        />
      </template>

      <!-- 邮件详情 -->
      <template #detail>
        <EmailDetailPane v-if="emailStore.splitLayout?.showDetailPane" />
      </template>
    </SplitPaneLayout>
  </div>
</template>

<script setup>
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useSettingStore} from "@/store/setting.js";
import emailScroll from "@/components/email-scroll/index.vue"
import SplitPaneLayout from "@/components/SplitPaneLayout.vue"
import LayoutModeSelector from "@/components/LayoutModeSelector.vue"
import EmailDetailPane from "@/components/EmailDetailPane.vue"
import {emailList, emailDelete, emailLatest} from "@/request/email.js";
import {starAdd, starCancel} from "@/request/star.js";
import {defineOptions, onMounted, reactive, ref, watch} from "vue";
import {sleep} from "@/utils/time-utils.js";
import router from "@/router/index.js";
import {Icon} from "@iconify/vue";

defineOptions({
  name: 'email'
})

const emailStore = useEmailStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const scroll = ref({})
const params = reactive({
  timeSort: 0,
})

onMounted(() => {
  emailStore.emailScroll = scroll;
  // 从 localStorage 加载分屏布局设置
  emailStore.loadSplitLayoutFromStorage();
  latest()
})

watch(() => accountStore.currentAccountId, () => {
  scroll.value.refreshList();
})

function changeTimeSort() {
  params.timeSort = params.timeSort ? 0 : 1
  scroll.value.refreshList();
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
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  router.push('/message')
}

const existIds = new Set();

async function latest() {
  while (true) {
    const latestId = scroll.value.latestEmail?.emailId || 0

    if (!scroll.value.firstLoad && settingStore.settings.autoRefreshTime) {
      try {
        const accountId = accountStore.currentAccountId
        const curTimeSort = params.timeSort
        const list = await emailLatest(latestId, accountId)
        if (accountId === accountStore.currentAccountId && params.timeSort === curTimeSort) {
          if (list.length > 0) {

            list.forEach(email => {
              existIds.add(email.emailId)
              scroll.value.addItem(email)
            })

          }

        }
      } catch (e) {
        console.error(e)
      }
    }
    await sleep(settingStore.settings.autoRefreshTime * 1000)
  }
}

function addStar(email) {
  emailStore.starScroll?.addItem(email)
}

function cancelStar(email) {
  emailStore.starScroll?.deleteEmail([email.emailId])
}

function getEmailList(emailId, size) {
  return emailList(accountStore.currentAccountId, emailId, params.timeSort, size, 0)
}

</script>
<style scoped>
.email-page {
  height: 100%;
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
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
}

.split-container {
  flex: 1;
  overflow: hidden;
}

.icon {
  cursor: pointer;
  color: #606266;
  transition: color 0.3s;
}

.icon:hover {
  color: #409eff;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .page-header {
    padding: 8px 12px;
  }
}
</style>
