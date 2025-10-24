<template>
  <div class="announcement-editor">
    <!-- 展示次数选项 -->
    <div class="announcement-section">
      <label class="section-label">展示次数</label>
      <el-radio-group v-model="localData.displayMode">
        <el-radio label="always">每次访问都显示</el-radio>
        <el-radio label="once">仅显示一次</el-radio>
      </el-radio-group>
      <div class="form-tip">选择"仅显示一次"时，用户关闭公告后不会再看到</div>
    </div>

    <!-- 标题和预览按钮 -->
    <div class="announcement-header">
      <div class="announcement-section" style="flex: 1">
        <label class="section-label">公告标题（可选）</label>
        <el-input
          v-model="localData.title"
          placeholder="输入公告标题"
          maxlength="100"
          show-word-limit
        />
      </div>
      <el-button
        type="primary"
        @click="showPreview = true"
        style="align-self: flex-end; margin-bottom: 0"
      >
        预览公告
      </el-button>
    </div>

    <!-- 文本内容 -->
    <div class="announcement-section">
      <label class="section-label">公告文本（支持粘贴图片）</label>

      <!-- 文本格式化工具栏 -->
      <div class="editor-toolbar">
        <el-button-group>
          <el-button size="small" @click="insertLink" title="插入链接">
            <Icon icon="material-symbols:link" /> 链接
          </el-button>
          <el-dropdown @command="handleColorCommand" trigger="click">
            <el-button size="small" title="文本颜色">
              <Icon icon="material-symbols:palette" /> 颜色
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="color in colorPresets"
                  :key="color.value"
                  :command="color"
                >
                  <span
                    class="color-swatch"
                    :style="{ backgroundColor: color.value }"
                  />
                  {{ color.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" @click="insertBold" title="加粗">
            <Icon icon="material-symbols:format-bold" /> 加粗
          </el-button>
          <el-dropdown @command="handleSizeCommand" trigger="click">
            <el-button size="small" title="字体大小">
              <Icon icon="material-symbols:text-fields" /> 大小
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="large">
                  <span class="size-preview" style="font-size: 18px;">大</span>
                </el-dropdown-item>
                <el-dropdown-item command="xlarge">
                  <span class="size-preview" style="font-size: 22px;">特大</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" @click="insertHighlight" title="高亮">
            <Icon icon="material-symbols:highlight" /> 高亮
          </el-button>
        </el-button-group>
      </div>

      <!-- 文本编辑区 -->
      <el-input
        ref="contentInput"
        v-model="localData.content"
        type="textarea"
        placeholder="输入公告内容（可选）或粘贴图片。支持 [link]URL[/link]、[red]文本[/red]、[bold]文本[/bold] 等标记"
        :maxlength="maxContentLength"
        show-word-limit
        :rows="5"
        @paste="handlePaste"
        class="announcement-content-input"
      />
    </div>

    <!-- 图片上传 -->
    <div class="announcement-section">
      <label class="section-label">公告图片（可选，最多{{ maxImages }}张）</label>

      <!-- 上传区域 -->
      <div class="upload-area" @dragover.prevent @drop.prevent="handleDrop">
        <div class="upload-content">
          <el-icon class="upload-icon"><upload-filled /></el-icon>
          <div class="upload-text">
            <div>拖拽图片到此处或</div>
            <el-button link type="primary" @click="$refs.fileInput.click()">
              点击选择文件
            </el-button>
          </div>
          <div class="upload-hint">支持 PNG、JPG、GIF、WebP 格式，单张≤500KB，总大小≤5MB</div>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          style="display: none"
          @change="handleFileSelect"
        />
      </div>

      <!-- 图片列表 -->
      <div v-if="localData.images && localData.images.length > 0" class="images-list">
        <div
          v-for="(image, index) in localData.images"
          :key="index"
          class="image-item"
        >
          <div class="image-preview">
            <img :src="image.base64" :alt="`Image ${index + 1}`" />
          </div>
          <div class="image-info">
            <el-input
              v-model="image.caption"
              placeholder="图片说明（可选）"
              maxlength="100"
              show-word-limit
            />
          </div>
          <div class="image-actions">
            <el-button
              v-if="index > 0"
              link
              type="primary"
              @click="moveImageUp(index)"
              title="向上移动"
            >
              <el-icon><arrow-up /></el-icon>
            </el-button>
            <el-button
              v-if="index < localData.images.length - 1"
              link
              type="primary"
              @click="moveImageDown(index)"
              title="向下移动"
            >
              <el-icon><arrow-down /></el-icon>
            </el-button>
            <el-button
              link
              type="danger"
              @click="removeImage(index)"
              title="删除"
            >
              <el-icon><delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div class="form-tip">
        支持拖拽上传、点击选择或粘贴图片。图片会自动压缩。访问者可以关闭公告，同一设备不会再次显示。
      </div>
    </div>

    <!-- 公告预览抽屉 -->
    <el-drawer
      v-model="showPreview"
      title="公告预览"
      direction="rtl"
      size="500px"
      class="announcement-preview-drawer"
    >
      <div class="preview-content">
        <!-- 预览标题 -->
        <div v-if="localData.title" class="preview-title">
          {{ localData.title }}
        </div>

        <!-- 预览图片轮播 -->
        <div v-if="localData.images && localData.images.length > 0" class="preview-images-carousel">
          <el-carousel :autoplay="false" class="carousel">
            <el-carousel-item v-for="(image, index) in localData.images" :key="index">
              <div class="carousel-item">
                <img :src="image.base64" :alt="`Image ${index + 1}`" />
                <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
              </div>
            </el-carousel-item>
          </el-carousel>
          <div class="carousel-info">
            {{ previewImageIndex + 1 }} / {{ localData.images.length }}
          </div>
        </div>

        <!-- 预览文本内容 -->
        <div v-if="localData.content" class="preview-text" v-html="renderContent(localData.content)"></div>

        <!-- 空状态提示 -->
        <div v-if="!localData.title && !localData.content && (!localData.images || localData.images.length === 0)" class="preview-empty">
          <el-empty description="暂无公告内容" />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { UploadFilled, ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      title: '',
      content: '',
      images: [],
      displayMode: 'always'
    })
  },
  maxImages: {
    type: Number,
    default: 10
  },
  maxContentLength: {
    type: Number,
    default: 5000
  }
})

const emit = defineEmits(['update:modelValue'])

// 颜色预设
const colorPresets = [
  { label: '红色', value: '#FF0000', tag: 'red' },
  { label: '绿色', value: '#00AA00', tag: 'green' },
  { label: '蓝色', value: '#0066FF', tag: 'blue' },
  { label: '黄色', value: '#FFAA00', tag: 'yellow' }
]

const showPreview = ref(false)
const previewImageIndex = ref(0)
const contentInput = ref(null)
const localData = reactive({
  title: props.modelValue.title || '',
  content: props.modelValue.content || '',
  images: [...(props.modelValue.images || [])],
  displayMode: props.modelValue.displayMode || 'always'
})

// Watch for external changes - simplified to avoid constant assignment errors
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Use Object.assign to update properties safely
    Object.assign(localData, {
      title: newVal.title || '',
      content: newVal.content || '',
      displayMode: newVal.displayMode || 'always'
    })
    // Update images array using splice to maintain reactivity
    if (Array.isArray(newVal.images)) {
      const newImages = newVal.images.map(img => ({...img}))
      localData.images.splice(0, localData.images.length, ...newImages)
    } else {
      localData.images.splice(0, localData.images.length)
    }
  }
}, { deep: true })

// Watch for local changes
watch(localData, (newVal) => {
  emit('update:modelValue', {
    title: newVal.title,
    content: newVal.content,
    images: newVal.images,
    displayMode: newVal.displayMode
  })
}, { deep: true })

const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  await processFiles(files)
  event.target.value = ''
}

const handleDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
  await processFiles(files)
}

const processFiles = async (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  if (imageFiles.length === 0) {
    ElMessage.warning('请选择图片文件')
    return
  }

  if (localData.images.length + imageFiles.length > props.maxImages) {
    ElMessage.error(`公告图片最多${props.maxImages}张，当前已有 ${localData.images.length} 张`)
    return
  }

  for (const file of imageFiles) {
    if (file.size > 500 * 1024) {
      ElMessage.error(`图片 ${file.name} 超过500KB限制`)
      continue
    }

    try {
      const base64 = await fileToBase64(file)
      localData.images.push({
        base64,
        caption: ''
      })
    } catch (error) {
      ElMessage.error(`处理图片 ${file.name} 失败: ${error.message}`)
    }
  }
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const handlePaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  const files = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    await processFiles(files)
  }
}

const removeImage = (index) => {
  localData.images.splice(index, 1)
}

const moveImageUp = (index) => {
  if (index > 0) {
    const temp = localData.images[index]
    localData.images[index] = localData.images[index - 1]
    localData.images[index - 1] = temp
  }
}

const moveImageDown = (index) => {
  if (index < localData.images.length - 1) {
    const temp = localData.images[index]
    localData.images[index] = localData.images[index + 1]
    localData.images[index + 1] = temp
  }
}

// 文本格式化函数
const insertLink = () => {
  const url = prompt('请输入链接地址:')
  if (url) {
    localData.content += `[link]${url}[/link]`
    nextTick(() => {
      contentInput.value?.focus()
    })
  }
}

const handleColorCommand = (color) => {
  const colorTag = `[${color.tag}]文本[/${color.tag}]`
  localData.content += colorTag
  nextTick(() => {
    contentInput.value?.focus()
  })
}

const insertBold = () => {
  const boldTag = `[bold]文本[/bold]`
  localData.content += boldTag
  nextTick(() => {
    contentInput.value?.focus()
  })
}

const handleSizeCommand = (size) => {
  const sizeTag = `[${size}]文本[/${size}]`
  localData.content += sizeTag
  nextTick(() => {
    contentInput.value?.focus()
  })
}

const insertHighlight = () => {
  const text = prompt('请输入要高亮的文本:')
  if (text) {
    localData.content += `[highlight]${text}[/highlight]`
    nextTick(() => {
      contentInput.value?.focus()
    })
  }
}

// 渲染内容（处理标记）
const renderContent = (content) => {
  if (!content) return ''

  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // 处理加粗标记
  html = html.replace(/\[bold\](.*?)\[\/bold\]/g, '<strong>$1</strong>')

  // 处理字体大小标记
  html = html.replace(/\[large\](.*?)\[\/large\]/g, '<span style="font-size: 18px;">$1</span>')
  html = html.replace(/\[xlarge\](.*?)\[\/xlarge\]/g, '<span style="font-size: 22px;">$1</span>')

  // 处理颜色标记
  html = html.replace(/\[red\](.*?)\[\/red\]/g, '<span style="color: #FF0000;">$1</span>')
  html = html.replace(/\[green\](.*?)\[\/green\]/g, '<span style="color: #00AA00;">$1</span>')
  html = html.replace(/\[blue\](.*?)\[\/blue\]/g, '<span style="color: #0066FF;">$1</span>')
  html = html.replace(/\[yellow\](.*?)\[\/yellow\]/g, '<span style="color: #FFAA00;">$1</span>')

  // 处理高亮标记
  html = html.replace(/\[highlight\](.*?)\[\/highlight\]/g, '<mark style="background-color: #FFFF00; padding: 2px 4px;">$1</mark>')

  // 处理链接标记
  html = html.replace(/\[link\](.*?)\[\/link\]/g, '<a href="$1" target="_blank" style="color: #0066FF; text-decoration: underline;">$1</a>')

  // 处理换行
  html = html.replace(/\n/g, '<br>')

  return html
}
</script>

<style scoped>
.announcement-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.announcement-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-weight: 500;
  color: #333;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  flex-shrink: 0;
}

.editor-toolbar :deep(.el-button-group) {
  display: flex;
}

.color-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
}

.size-preview {
  display: inline-block;
  min-width: 40px;
}

.announcement-content-input {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.announcement-content-input :deep(.el-textarea__inner) {
  height: 100% !important;
  resize: none;
}

.announcement-header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.upload-icon {
  font-size: 32px;
  color: #909399;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

.images-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.image-item {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image-preview {
  width: 100%;
  height: 120px;
  overflow: hidden;
  background-color: #f5f7fa;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-info {
  padding: 8px;
  flex: 1;
}

.image-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid #dcdfe6;
  justify-content: center;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.preview-images-carousel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.carousel {
  width: 100%;
  height: 300px;
}

.carousel-item {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.carousel-item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 8px;
  font-size: 12px;
  text-align: center;
}

.carousel-info {
  text-align: center;
  font-size: 12px;
  color: #909399;
}

.preview-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
  line-height: 1.6;
}

.preview-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
</style>

