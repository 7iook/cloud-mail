<template>
  <el-dialog
    v-model="visible"
    title="邮箱白名单管理"
    width="1000px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="whitelist-dialog"
  >
    <div class="whitelist-content">
      <div class="whitelist-header">
        <div class="header-info">
          <p>管理可用于分享的邮箱白名单，只有在白名单中的邮箱才能创建分享链接。</p>
          <p class="tip">建议预设100个左右的邮箱地址，支持批量添加。</p>
        </div>
        <div class="header-actions">
          <el-button @click="showBatchAdd = true">
            <Icon icon="material-symbols:add-box" />
            批量添加
          </el-button>
          <el-button @click="addSingleEmail">
            <Icon icon="material-symbols:add" />
            添加邮箱
          </el-button>
        </div>
      </div>

      <div class="whitelist-list">
        <div class="list-header">
          <span>邮箱地址 ({{ emailList.length }})</span>
          <el-button 
            type="danger" 
            size="small" 
            @click="clearAll"
            :disabled="emailList.length === 0"
          >
            清空全部
          </el-button>
        </div>
        
        <div class="email-tags">
          <el-tag
            v-for="(email, index) in emailList"
            :key="index"
            closable
            @close="removeEmail(index)"
            class="email-tag"
            size="large"
            type="info"
          >
            <Icon icon="material-symbols:email" class="tag-icon" />
            {{ email }}
          </el-tag>
          
          <div v-if="emailList.length === 0" class="empty-state">
            <el-empty description="暂无邮箱，点击上方按钮添加" />
          </div>
        </div>
      </div>
    </div>

    <!-- 批量添加对话框 -->
    <el-dialog
      v-model="showBatchAdd"
      title="批量添加邮箱"
      width="500px"
      append-to-body
    >
      <el-form>
        <el-form-item label="邮箱列表">
          <el-input
            v-model="batchEmails"
            type="textarea"
            :rows="10"
            placeholder="请输入邮箱地址，每行一个：&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
          />
          <div class="form-tip">
            每行输入一个邮箱地址，系统会自动验证格式并去重
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showBatchAdd = false">取消</el-button>
        <el-button type="primary" @click="handleBatchAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          保存设置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { getShareWhitelist, updateShareWhitelist } from '@/request/share.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'updated']);

// 响应式数据
const visible = ref(false);
const saving = ref(false);
const emailList = ref([]);
const showBatchAdd = ref(false);
const batchEmails = ref('');

// 监听显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    loadWhitelist();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 加载白名单
const loadWhitelist = async () => {
  try {
    emailList.value = await getShareWhitelist();
  } catch (error) {
    ElMessage.error('加载白名单失败');
  }
};

// 添加单个邮箱
const addSingleEmail = async () => {
  try {
    const { value: email } = await ElMessageBox.prompt(
      '请输入邮箱地址',
      '添加邮箱',
      {
        inputPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        inputErrorMessage: '请输入有效的邮箱地址'
      }
    );
    
    if (emailList.value.includes(email)) {
      ElMessage.warning('该邮箱已存在');
      return;
    }
    
    emailList.value.push(email);
    ElMessage.success('添加成功');
  } catch (error) {
    // 用户取消
  }
};

// 批量添加邮箱
const handleBatchAdd = () => {
  const emails = batchEmails.value
    .split('\n')
    .map(email => email.trim())
    .filter(email => email)
    .filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email));
  
  if (emails.length === 0) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }
  
  // 去重并添加
  const newEmails = emails.filter(email => !emailList.value.includes(email));
  emailList.value.push(...newEmails);
  
  ElMessage.success(`成功添加 ${newEmails.length} 个邮箱`);
  showBatchAdd.value = false;
  batchEmails.value = '';
};

// 移除邮箱
const removeEmail = (index) => {
  emailList.value.splice(index, 1);
};

// 清空全部
const clearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有邮箱吗？此操作不可恢复。',
      '确认清空',
      { type: 'warning' }
    );
    
    emailList.value = [];
    ElMessage.success('已清空所有邮箱');
  } catch (error) {
    // 用户取消
  }
};

// 保存设置
const handleSave = async () => {
  saving.value = true;
  try {
    await updateShareWhitelist(emailList.value);
    emit('updated');
    handleClose();
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

// 处理关闭
const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.whitelist-dialog {
  --el-dialog-width: 1000px;
}

.whitelist-content {
  max-height: 600px;
  overflow-y: auto;
}

.whitelist-header {
  margin-bottom: 20px;
}

.header-info {
  margin-bottom: 16px;
}

.header-info p {
  margin: 0 0 8px 0;
  color: var(--el-text-color-regular);
}

.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 500;
}

.email-tags {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  min-height: 120px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.email-tag {
  margin: 0;
  height: 44px;
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  transition: all 0.2s;
}

.email-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tag-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.empty-state {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
