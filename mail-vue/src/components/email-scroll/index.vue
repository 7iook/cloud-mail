<template>
  <div class="email-container">
    <div class="header-actions">
      <el-checkbox
          v-model="checkAll"
          :indeterminate="isIndeterminate"
          :disabled="!emailList.length || loading"
          @change="handleCheckAllChange"
      >
      </el-checkbox>
      <div class="header-left" :style="'padding-left:' + actionLeft">

        <slot name="first"></slot>
        <Icon class="icon reload" icon="ion:reload" width="18" height="18" @click="refresh"/>
        <Icon v-perm="'email:delete'" class="icon" icon="uiw:delete" width="16" height="16"
              v-if="getSelectedMailsIds().length > 0"
              @click="handleDelete"/>
      </div>

      <div class="header-right">
        <span class="email-count" v-if="total">{{ $t('emailCount', {total: total}) }}</span>
        <Icon v-if="showAccountIcon" class="more-icon icon" width="16" height="16" icon="akar-icons:dot-grid-fill"
              @click="changeAccountShow"/>
      </div>
    </div>

    <div ref="scroll" class="scroll">
      <el-scrollbar ref="scrollbarRef" style="height: 100%">
        <div class="scroll-box" :infinite-scroll-immediate="false" v-infinite-scroll="loadData"
             infinite-scroll-distance="600">
          <div v-if="(skeleton && !loading)" v-for="item in emailList" :key="item.emailId">
            <div class="email-row"
                 :data-checked="item.checked"
                 @click="handleEmailRowClick($event, item)"
                 @mouseenter="handleMouseEnterEnhanced(item)"
                 @mouseleave="handleMouseLeaveEnhanced(item)"
            >
              <el-checkbox :class=" props.type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
                           v-model="item.checked" @click.stop></el-checkbox>
              <div @click.stop="starChange(item)" class="pc-star" v-if="showStar">
                <Icon v-if="item.isStar" icon="fluent-color:star-16" width="20" height="20"/>
                <Icon v-else icon="solar:star-line-duotone" width="18" height="18"/>
              </div>
              <div v-if="!showStar"></div>
              <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

                <div class="email-sender" :style=" showStatus ? 'gap: 10px;' : ''">
                  <div class="email-status" v-if="showStatus">
                    <el-tooltip v-if="item.status ===  0" effect="dark" :content="$t('received')">
                      <Icon icon="ic:round-mark-email-read" style="color: #51C76B" width="20" height="20"/>
                      />
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  1" effect="dark" :content="$t('sent')">
                      <Icon icon="bi:send-arrow-up-fill" style="color: #51C76B" width="20" height="20"/>
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  2" effect="dark" :content="$t('delivered')">
                      <Icon icon="bi:send-check-fill" style="color: #51C76B" width="20" height="20"/>
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  3" effect="dark" :content="$t('bounced')">
                      <Icon icon="bi:send-x-fill" style="color: #F56C6C" width="20" height="20"/>
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  4" effect="dark" :content="$t('complained')">
                      <Icon icon="bi:send-exclamation-fill" style="color:#FBBD08" width="20" height="20"/>
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  5" effect="dark" :content="$t('delayed')">
                      <Icon icon="bi:send-arrow-up-fill" style="color:#FBBD08" width="20" height="20"/>
                    </el-tooltip>
                    <el-tooltip v-if="item.status ===  7" effect="dark" :content="$t('noRecipient')">
                      <Icon icon="ic:round-mark-email-read" style="color:#FBBD08" width="20" height="20"/>
                    </el-tooltip>
                    <div class="del-status" v-if="item.isDel">
                      <el-tooltip effect="dark" :content="$t('selectDeleted')">
                        <Icon class="icon" icon="mdi:email-remove" width="20" height="20"/>
                      </el-tooltip>
                    </div>
                  </div>
                  <div v-else></div>
                  <span class="name">
                    <span>
                      <slot name="name" :email="item"> {{ item.name }}</slot>
                    </span>
                    <span>
                      <Icon v-if="item.isStar" icon="fluent-color:star-16" width="18" height="18"/>
                    </span>
                  </span>
                  <span class="phone-time">{{ fromNow(item.createTime) }}</span>
                </div>
                <div>
                  <div class="email-text">
                    <span class="email-subject">
                      <slot name="subject" :email="item">
                        {{ item.subject || '\u200B' }}
                      </slot>
                    </span>
                    <span class="email-content" v-html="getHighlightedContent(item)"></span>
                  </div>
                  <div class="user-info" v-if="showUserInfo">
                    <div class="user">
                      <span>
                        <Icon icon="mynaui:user" width="20" height="20"/>
                      </span>
                      <span>{{ item.userEmail }}</span>
                    </div>
                    <div class="account">
                      <span>
                        <Icon icon="mdi-light:email" width="20" height="20"/>
                      </span>
                      <span
                        class="email-address-display"
                        :title="`点击复制邮箱地址: ${item.type === 0 ? item.toEmail : item.sendEmail}`"
                        @click.stop="handleEmailAddressClick(item.type === 0 ? item.toEmail : item.sendEmail)"
                      >
                        {{ item.type === 0 ? item.toEmail : item.sendEmail }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="email-right" :style="showUserInfo ? 'align-self: start;':''">
                <span class="email-time">{{ fromNow(item.createTime) }}</span>
              </div>
            </div>
          </div>
          <template v-if="skeleton">
            <skeletonBlock v-if="firstLoad && showFirstLoading"
                           :rows="20"
                           :showStar="showStar"
                           :accountShow="accountShow"
                           :showStatus="showStatus"
                           :showUserInfo="showUserInfo"
                           :type="type"/>
            <skeletonBlock v-if="loading"
                           :rows="skeletonRows"
                           :showStar="showStar"
                           :accountShow="accountShow"
                           :showStatus="showStatus"
                           :showUserInfo="showUserInfo"
                           :type="type"/>
            <skeletonBlock v-if="followLoading"
                           :rows="isMobile ? 1 : 2"
                           :showStar="showStar"
                           :accountShow="accountShow"
                           :showStatus="showStatus"
                           :showUserInfo="showUserInfo"
                           :type="type"/>
          </template>
          <template v-else>
            <div></div>
            <div class="loading" :class="loading ? 'loading-show' : 'loading-hide'"
                 :style="firstLoad ? 'background: transparent' : ''">
              <Loading/>
            </div>
            <div class="follow-loading" v-if="followLoading">
              <Loading/>
            </div>
          </template>
          <div class="noLoading" v-if="noLoading && emailList.length > 0 && !(skeleton && loading)">
            <div>{{ $t('noMoreData') }}</div>
          </div>
          <div class="empty" v-if="noLoading && emailList.length === 0 && !(skeleton && loading)">
            <el-empty :image-size="isMobile ? 120 : 0" :description="$t('noMessagesFound')"/>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 空格键预览组件 -->
    <EmailPreview
      v-model="previewVisible"
      :email="previewEmail"
      @view-details="handlePreviewViewDetails"
      @closed="handlePreviewClosed"
    />
  </div>
</template>

<script setup>
import Loading from "@/components/loading/index.vue";
import {Icon} from "@iconify/vue";
import skeletonBlock from "@/components/email-scroll/skeleton/index.vue"
import {computed, onActivated, reactive, ref, watch} from "vue";
import {onBeforeRouteLeave} from "vue-router";
import {useEmailStore} from "@/store/email.js";
import {useUiStore} from "@/store/ui.js";
import {useSettingStore} from "@/store/setting.js";
import {sleep} from "@/utils/time-utils.js"
import {fromNow} from "@/utils/day.js";
import {useI18n} from "vue-i18n";
import {highlightEmailContent, extractHighlightValue, isHighlightElement} from "@/utils/email-highlight-utils.js";
import {copyTextWithFeedback} from "@/utils/clipboard-utils.js";
import {useSpacePreview} from "@/composables/useSpacePreview.js";
import EmailPreview from "@/components/email-preview/index.vue";

const props = defineProps({
  getEmailList: Function,
  emailDelete: Function,
  starAdd: Function,
  starCancel: Function,
  cancelSuccess: Function,
  starSuccess: Function,
  actionLeft: {
    type: String,
    default: '0'
  },
  timeSort: {
    type: Number,
    default: 0,
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showAccountIcon: {
    type: Boolean,
    default: true,
  },
  showUserInfo: {
    type: Boolean,
    default: false
  },
  showStar: {
    type: Boolean,
    default: true
  },
  allowStar: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    default: ''
  },
  skeleton: {
    type: Boolean,
    default: true
  },
  showFirstLoading: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['jump', 'refresh-before', 'delete-draft'])
const {t} = useI18n()
const settingStore = useSettingStore()
const uiStore = useUiStore();
const emailStore = useEmailStore();

// 空格键预览功能
const {
  hoveredEmail,
  previewVisible,
  previewEmail,
  handleMouseEnter,
  handleMouseLeave,
  handleEmailChange
} = useSpacePreview();
const loading = ref(false);
const followLoading = ref(false);
const noLoading = ref(false);
const emailList = reactive([])
const total = ref(0);
const checkAll = ref(false);
const isIndeterminate = ref(false);
const scroll = ref(null)
const firstLoad = ref(true)
let scrollTop = 0
const latestEmail = ref(null)
const scrollbarRef = ref(null)
let reqLock = false
let isMobile = innerWidth < 1367
let skeletonRows = 0
const queryParam = reactive({
  emailId: 0,
  size: 30,
});

defineExpose({
  refreshList,
  deleteEmail,
  addItem,
  emailList,
  firstLoad,
  latestEmail,
  noLoading,
  total
})

onActivated(() => {
  scroll.value.scrollTop = scrollTop
})

getEmailList()

onBeforeRouteLeave(() => {
  scrollTop = scroll.value.scrollTop
})

watch(
    () => emailList.map(item => item.checked),
    () => {
      if (emailList.length > 0) {
        updateCheckStatus();
      }
    },
    {deep: true}
);


watch(() => emailStore.deleteIds, () => {
  if (emailStore.deleteIds) {
    deleteEmail(emailStore.deleteIds)
  }
})

watch(() => emailStore.cancelStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.cancelStarEmailId) {
      email.isStar = 0
    }
  })
})

watch(() => emailStore.addStarEmailId, () => {
  emailList.forEach(email => {
    if (email.emailId === emailStore.addStarEmailId) {
      email.isStar = 1
    }
  })
})

function getSkeletonRows() {
  if (emailList.length > 20) return skeletonRows = 20
  if (emailList.length === 0) return skeletonRows = 1
  skeletonRows = emailList.length
}

const accountShow = computed(() => {
  return uiStore.accountShow && settingStore.settings.manyEmail === 0
})

function htmlToText(email) {
  if (email.content) {

    const tempDiv = document.createElement('div');

    tempDiv.innerHTML = email.content.replace(
        /<(img|iframe|object|embed|video|audio|source|link)[^>]*>/gi, ''
    );

    const scriptsAndStyles = tempDiv.querySelectorAll('script, style, title');
    scriptsAndStyles.forEach(el => el.remove());
    let text = tempDiv.textContent || tempDiv.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    return cleanSpace(text)
  }

  if (email.text) {
    return cleanSpace(email.text)
  } else {
    return ''
  }

}

function cleanSpace(text) {
  return text
      .replace(/[\u200B-\u200F\uFEFF\u034F\u200B-\u200F\u00A0\u3000\u00AD]/g, '')// 移除零宽空格
      .replace(/\s+/g, ' ')                   // 多空白合并成一个空格
      .trim();
}


function starChange(email) {

  if (!email.isStar) {

    if (!props.allowStar) return;

    email.isStar = 1;
    props.starAdd(email.emailId).then(() => {
      email.isStar = 1;
      props.starSuccess(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 0
    })
  } else {

    email.isStar = 0;
    props.starCancel(email.emailId).then(() => {
      email.isStar = 0;
      props.cancelSuccess?.(email)
    }).catch(e => {
      console.error(e)
      email.isStar = 1;
    })
  }
}

function changeAccountShow() {
  uiStore.accountShow = !uiStore.accountShow;
}

const handleDelete = () => {
  ElMessageBox.confirm(t('delEmailsConfirm'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {

    if (props.type === 'draft') {
      const draftIds = getSelectedDraftsIds();
      emit('delete-draft', draftIds);
      return;
    }

    const emailIds = getSelectedMailsIds();
    props.emailDelete(emailIds).then(() => {
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true
      })
      emailStore.deleteIds = emailIds;
    })
  })
}

function deleteEmail(emailIds) {
  emailIds.forEach(emailId => {
    emailList.forEach((item, index) => {
      if (emailId === item.emailId) {
        emailList.splice(index, 1);
      }
    })
  })
  if (emailList.length < queryParam.size && !noLoading.value) {
    getEmailList()
  }
}

function addItem(email) {

  const existIndex = emailList.findIndex(item => item.emailId === email.emailId)

  if (existIndex > -1) {
    return
  }

  if (props.timeSort) {
    if (noLoading.value) {
      emailList.push(email)
      latestEmail.value = email
      total.value++
    } else {
      total.value++
    }
    return;
  }

  const index = emailList.findIndex(item => item.emailId < email.emailId)

  if (index !== -1) {
    emailList.splice(index, 0, email);
  } else {
    if (noLoading.value) {
      emailList.push(email)
    }
  }

  total.value++
}

function handleCheckAllChange(val) {
  emailList.forEach(item => item.checked = val);
  isIndeterminate.value = false;
}

// 获取选中的邮件列表id
function getSelectedMailsIds() {
  return emailList.filter(item => item.checked).map(item => item.emailId);
}

function getSelectedDraftsIds() {
  return emailList.filter(item => item.checked).map(item => item.draftId);
}

function updateCheckStatus() {
  const checkedCount = emailList.filter(item => item.checked).length;
  checkAll.value = checkedCount === emailList.length;
  isIndeterminate.value = checkedCount > 0 && checkedCount < emailList.length;
}

function jumpDetails(email) {
  emit('jump', email)
}

/**
 * 处理邮件行点击事件 - 实现双重点击逻辑 (2025年增强版)
 * @param {Event} event - 点击事件
 * @param {Object} email - 邮件对象
 */
function handleEmailRowClick(event, email) {
  const clickedElement = event.target;

  // 检查是否点击了高亮元素
  if (isHighlightElement(clickedElement)) {
    event.stopPropagation();
    const value = extractHighlightValue(clickedElement);
    const type = clickedElement.getAttribute('data-type') ||
                 clickedElement.closest('.email-highlight, .code-highlight')?.getAttribute('data-type');

    if (value) {
      // 根据类型显示不同的成功消息
      let successMessage;
      if (type === 'email') {
        successMessage = `📧 已复制邮箱: ${value}`;
      } else if (type === 'code') {
        successMessage = `🔐 已复制验证码: ${value}`;
      } else {
        successMessage = `📋 已复制: ${value}`;
      }

      // 复制高亮内容到剪贴板，使用增强的Toast通知
      copyTextWithFeedback(value, {
        successMessage,
        errorMessage: '❌ 复制失败，请重试',
        duration: 3000
      });

      // 添加点击反馈动画
      addClickFeedback(clickedElement);
    }
    return;
  }

  // 默认行为：跳转到详情页
  jumpDetails(email);
}

/**
 * 添加点击反馈动画
 * @param {HTMLElement} element - 被点击的元素
 */
function addClickFeedback(element) {
  const targetElement = element.closest('.email-highlight, .code-highlight') || element;

  // 添加点击动画类
  targetElement.classList.add('highlight-clicked');

  // 移除动画类
  setTimeout(() => {
    targetElement.classList.remove('highlight-clicked');
  }, 200);
}

/**
 * 处理邮箱地址点击事件
 * @param {string} emailAddress - 邮箱地址
 */
function handleEmailAddressClick(emailAddress) {
  if (emailAddress) {
    copyTextWithFeedback(emailAddress, {
      successMessage: `📧 已复制邮箱地址: ${emailAddress}`,
      errorMessage: '❌ 复制失败，请重试',
      duration: 3000
    });
  }
}

/**
 * 增强的鼠标进入处理 - 集成空格键预览
 * @param {Object} email - 邮件对象
 */
function handleMouseEnterEnhanced(email) {
  // 调用空格键预览的鼠标进入处理
  handleMouseEnter(email);

  // 处理邮件变更逻辑
  if (hoveredEmail.value && email) {
    handleEmailChange(email);
  }
}

/**
 * 增强的鼠标离开处理 - 集成空格键预览
 * @param {Object} email - 邮件对象
 */
function handleMouseLeaveEnhanced(email) {
  // 调用空格键预览的鼠标离开处理
  handleMouseLeave(email);
}

/**
 * 获取高亮处理后的邮件内容
 * @param {Object} email - 邮件对象
 * @returns {string} 高亮处理后的HTML内容
 */
function getHighlightedContent(email) {
  const plainText = htmlToText(email);
  if (!plainText || plainText === '\u200B') {
    return '\u200B';
  }

  // 应用高亮处理
  return highlightEmailContent(plainText, {
    highlightEmails: true,
    highlightCodes: true
  });
}

/**
 * 处理预览窗口查看详情
 * @param {Object} email - 邮件对象
 */
function handlePreviewViewDetails(email) {
  if (email && email.emailId) {
    jumpDetails(email);
  }
}

/**
 * 处理预览窗口关闭
 */
function handlePreviewClosed() {
  // 预览窗口关闭时的清理工作
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 [EmailScroll] 预览窗口已关闭');
  }
}


function getEmailList(refresh = false) {

  if (reqLock) return;

  reqLock = true

  if (!refresh) {

    if (loading.value || noLoading.value) {
      reqLock = false
      return
    }

  } else {
    getSkeletonRows()
    loading.value = true
  }

  if (emailList.length === 0) {
    loading.value = true
  } else {
    followLoading.value = !refresh;
  }
  let start = Date.now();
  props.getEmailList(queryParam.emailId, queryParam.size).then(async data => {
    let end = Date.now();
    let duration = end - start;
    if (duration < 500 && !queryParam.emailId) {
        await sleep(500 - duration)
    }
    firstLoad.value = false

    let list = data.list.map(item => ({
      ...item,
      checked: false
    }));


    if (refresh) {
      emailList.length = 0
    }

    latestEmail.value = data.latestEmail
    emailList.push(...list);

    if (refresh) scrollbarRef.value?.setScrollTop(0);

    noLoading.value = data.list.length < queryParam.size;
    followLoading.value = data.list.length >= queryParam.size;

    total.value = data.total;
    queryParam.emailId = data.list.length > 0 ? data.list.at(-1).emailId : 0
  }).finally(() => {
    loading.value = false
    reqLock = false
  })
}

function refresh() {
  emit('refresh-before')
  if (props.skeleton) {
    scrollbarRef.value.setScrollTop(0)
  }
  refreshList()
}

function refreshList() {
  checkAll.value = false;
  isIndeterminate.value = false;
  queryParam.emailId = 0;
  getEmailList(true);
}

function loadData() {
  getEmailList()
}

</script>
<style lang="scss" scoped>

.email-container {
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  height: 100%;
}

.scroll {
  margin: 0;
  overflow: auto;
  height: 100%;
  position: relative;

  .scroll-box {
    height: 100%;
  }

  .empty {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
  }

  .noLoading {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px 0;
    color: var(--secondary-text-color);
  }

  .follow-loading {
    height: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--loadding-background);
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
  }

  .loading-show {
    transition: all 200ms ease 200ms;
    opacity: 1;
  }

  .loading-hide {
    pointer-events: none;
    transition: var(--loading-hide-transition);
    opacity: 0;
  }
}

:deep(.email-row) {
  display: flex;
  padding: 8px 0;
  justify-content: space-between;
  box-shadow: var(--header-actions-border);
  cursor: pointer;
  align-items: center;
  position: relative;
  transition: background 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  .user-info {
    display: flex;
    flex-wrap: wrap;
    column-gap: 10px;
    margin-top: 5px;
    margin-bottom: 2px;
    color: var(--email-scroll-content-color);
    @media (max-width: 1366px) {
      flex-direction: column;
    }

    .user, .account {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      transition: all 300ms;
      line-height: 12px;
      max-width: 300px;
      min-width: 0;

      @media (max-width: 1223px) {
        max-width: 280px;
      }

      span:first-child {
        position: relative;
      }

      span:last-child {
        margin-left: 5px;
        position: relative;
        bottom: 5px;
      }
    }
  }

  .checkbox {
    display: flex;
    padding-left: 15px;
    padding-right: 20px;
    justify-content: center;
  }

  .all-email-checkbox {
    display: flex;
    padding-left: 15px;
    padding-right: 20px;
    justify-content: center;
    @media (min-width: 1367px) {
      justify-content: start;
      height: 100%;
      align-self: start;
      padding-top: 3px;
    }
  }

  .title-column {
    @media (max-width: 1366px) {
      grid-template-columns: 1fr !important;
      gap: 4px !important;
    }
  }

  .title {
    flex: 1;
    display: grid;
    grid-template-columns: 240px 1fr;
    @media (max-width: 1366px) {
      padding-right: 15px;
    }
    @media (max-width: 1366px) {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .email-sender {
      font-weight: bold;;
      color: var(--el-text-color-primary);
      display: grid;
      grid-template-columns: auto 1fr auto;

      .email-status {
        display: flex;
        flex-direction: column;
        align-content: center;
        @media (max-width: 1366px) {
          flex-direction: row;
          gap: 5px;
        }
      }

      .name {
        display: grid;
        gap: 5px;
        grid-template-columns: auto 1fr;
        @media (min-width: 1366px) {
          grid-template-columns: 1fr;
          > span:last-child {
            display: none;
          }
        }

        > span:first-child {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .name-skeleton {
          width: 150px;
          height: 1rem;
          @media (max-width: 767px) {
            width: 130px;
          }
        }
      }

      .phone-time {
        font-weight: normal;
        font-size: 12px;
        @media (min-width: 1367px) {
          display: none;
        }
      }
    }

    .email-text-skeleton {
      .text-skeleton-one {
        width: 80%;
        height: 16px;
        @media (max-width: 1366px) {
          width: 40%;
        }
        @media (max-width: 767px) {
          width: 70%;
        }
      }

      .text-skeleton-two {
        width: min(300px, 100%);
        height: 16px;
        @media (min-width: 1367px) {
          display: none;
        }
        @media (max-width: 1366px) {
          width: 100%;
        }
      }
    }

    .email-text {
      display: grid;
      grid-template-columns: auto 1fr;
      @media (max-width: 1366px) {
        grid-template-columns: 1fr;
      }

      .email-subject {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        @media (min-width: 1367px) {
          padding-left: 5px;
        }
      }

      .email-content {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding-left: 10px;
        color: var(--email-scroll-content-color);
        @media (max-width: 1366px) {
          padding-left: 0;
          margin-top: 0;
        }
      }
    }
  }


  .email-right {
    text-align: right;
    font-size: 12px;
    white-space: nowrap;
    display: flex;
    padding-left: 15px;
    align-items: center;
    @media (max-width: 1366px) {
      display: none;
    }
  }

  .email-right-skeleton {
    @media (max-width: 1366px) {
      display: none;
    }
  }

  &:hover {
    background-color: var(--email-hover-background);
    z-index: 0;
  }

  /*&[data-checked="true"] {
    background-color: #c2dbff;
  }*/
}


.phone-star {
  display: none;
}

.pc-star {
  display: flex;
  width: 40px;
}

@media (max-width: 1366px) {
  .pc-star {
    display: none;
  }
  .phone-star {
    display: block;
    align-self: end;
    padding-right: 16px;
    padding-top: 8px;
  }
  .star-pd {
    padding-top: 6px !important;
  }
}

.email-time {
  padding-right: 16px !important;
}

:deep(.el-scrollbar__view) {
  height: 100%;
}

.header-actions {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 15px;
  padding: 3px 15px;
  box-shadow: var(--header-actions-border);

  .header-left {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    position: relative;
    column-gap: 18px;
    row-gap: 8px;
    padding-left: 2px;
    color: var(--el-text-color-primary);;
  }

  .header-right {
    display: grid;
    grid-template-columns: auto auto;
    align-items: start;
    height: 100%;
    color: var(--el-text-color-primary);;

    .email-count {
      white-space: nowrap;
      margin-top: 6px;
    }
  }

  .icon {
    font-size: 18px;
    cursor: pointer;
  }

  .more-icon {
    margin-top: 8px;
    margin-left: 15px;
  }
}

.del-status {
  color: var(--el-color-info);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  bottom: 1px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 邮箱地址高亮样式 - 简洁设计 */
:deep(.email-highlight) {
  color: #409EFF;
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

:deep(.email-highlight:hover) {
  color: #337ecc;
  text-decoration-style: solid;
  background-color: rgba(64, 158, 255, 0.1);
  border-radius: 3px;
  padding: 1px 2px;
}

/* 验证码高亮样式 - 简洁设计 */
:deep(.code-highlight) {
  color: #67C23A;
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

:deep(.code-highlight:hover) {
  color: #529b2e;
  text-decoration-style: solid;
  background-color: rgba(103, 194, 58, 0.1);
  border-radius: 3px;
  padding: 1px 2px;
}

/* 点击反馈动画 */
:deep(.highlight-clicked) {
  animation: highlightPulse 0.2s ease-out;
}

@keyframes highlightPulse {
  0% {
    transform: scale(1);
    background-color: rgba(64, 158, 255, 0.2);
  }
  50% {
    transform: scale(1.05);
    background-color: rgba(64, 158, 255, 0.3);
  }
  100% {
    transform: scale(1);
    background-color: rgba(64, 158, 255, 0.1);
  }
}

/* 邮箱地址显示样式 */
:deep(.email-address-display) {
  color: #409EFF;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 3px;
  padding: 2px 4px;
  margin: -2px -4px;
}

:deep(.email-address-display:hover) {
  background-color: rgba(64, 158, 255, 0.1);
  color: #337ecc;
}

/* Toast通知样式 */
:deep(.copy-feedback) {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 40px 12px 20px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateX(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 300px;
  word-break: break-all;
  position: relative;
  cursor: default;
}

:deep(.copy-feedback-close) {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

:deep(.copy-feedback-close:hover) {
  opacity: 1;
}

:deep(.copy-feedback-success) {
  background: linear-gradient(135deg, #67C23A, #85ce61);
}

:deep(.copy-feedback-error) {
  background: linear-gradient(135deg, #F56C6C, #f78989);
}

:deep(.copy-feedback-show) {
  transform: translateX(0);
  opacity: 1;
}

:deep(.copy-feedback-hide) {
  transform: translateX(100%);
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  :deep(.copy-feedback) {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
    transform: translateY(-100%);
  }

  :deep(.copy-feedback-show) {
    transform: translateY(0);
  }

  :deep(.copy-feedback-hide) {
    transform: translateY(-100%);
  }
}

</style>
