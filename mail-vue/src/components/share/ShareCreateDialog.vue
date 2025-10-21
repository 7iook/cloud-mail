<template>
  <el-dialog
    v-model="visible"
    title="创建邮箱分享"
    width="1200px"
    :close-on-click-modal="false"
    @close="handleClose"
    class="create-share-dialog"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      @submit.prevent
    >
      <el-form-item label="分享类型" prop="shareType">
        <el-radio-group v-model="form.shareType" @change="handleShareTypeChange">
          <el-radio :value="1">
            <div class="share-type-option">
              <div class="option-title">单邮箱分享</div>
              <div class="option-desc">为指定邮箱创建专用分享链接</div>
            </div>
          </el-radio>
          <el-radio :value="2">
            <div class="share-type-option">
              <div class="option-title">邮箱输入分享</div>
              <div class="option-desc">访问者需输入指定邮箱进行验证</div>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="目标邮箱" prop="targetEmails">
        <div class="email-select-container">
          <!-- 邮箱选择方式 -->
          <div class="email-selection-mode">
            <el-radio-group v-model="emailSelectionMode" @change="handleSelectionModeChange">
              <el-radio value="fromAllEmails">从全部邮件选择</el-radio>
              <el-radio value="batchInput">批量输入</el-radio>
              <el-radio value="singleInput">单个输入</el-radio>
            </el-radio-group>
          </div>

          <div class="select-actions" v-if="emailSelectionMode === 'fromAllEmails'">
            <el-button size="small" @click="selectAll" :disabled="loadingAllEmails">
              <Icon icon="material-symbols:select-all" />
              全选
            </el-button>
            <el-button size="small" @click="clearAll" :disabled="loadingAllEmails">
              <Icon icon="material-symbols:clear-all" />
              清空
            </el-button>
            <span class="selected-count">已选择 {{ form.targetEmails.length }} 个邮箱</span>
          </div>

          <!-- 已选择的邮箱展示区域 - 始终显示，避免界面跳动 -->
          <div class="selected-emails-display">
            <div class="selected-emails-header">
              <span class="header-title">已选择的邮箱 ({{ form.targetEmails.length }})</span>
            </div>
            <div class="selected-emails-grid">
              <el-tag
                v-for="email in form.targetEmails"
                :key="email"
                closable
                @close="removeSelectedEmail(email)"
                class="selected-email-tag"
                size="large"
                type="primary"
              >
                <Icon icon="material-symbols:email" class="email-icon" />
                {{ email }}
              </el-tag>
              <!-- 空状态提示 -->
              <div v-if="form.targetEmails.length === 0" class="empty-selection-hint">
                <Icon icon="material-symbols:info-outline" />
                <span>请从下方列表中选择邮箱</span>
              </div>
            </div>
          </div>

          <!-- 从全部邮件选择 -->
          <div v-if="emailSelectionMode === 'fromAllEmails'" class="email-selector">
            <div class="search-bar">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索邮箱地址..."
                clearable
                @input="handleSearch"
                class="search-input"
              >
                <template #prefix>
                  <Icon icon="material-symbols:search" />
                </template>
              </el-input>
              <el-select v-model="sortBy" @change="loadAllEmails" class="sort-select">
                <el-option label="按邮箱排序" value="email" />
                <el-option label="按邮件数量排序" value="count" />
              </el-select>
            </div>

            <div class="email-list">
              <!-- 骨架屏加载状态 -->
              <div v-if="loadingAllEmails" class="skeleton-grid">
                <div v-for="i in 10" :key="`skeleton-${i}`" class="skeleton-item">
                  <div class="skeleton-checkbox"></div>
                  <div class="skeleton-content">
                    <div class="skeleton-email"></div>
                    <div class="skeleton-stats">
                      <div class="skeleton-stat"></div>
                      <div class="skeleton-stat"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 实际邮箱列表 -->
              <el-checkbox-group v-else v-model="selectedEmailsFromAll" @change="handleEmailSelectionChange">
                <div
                  v-for="(item, index) in displayEmails"
                  :key="item.email"
                  class="email-item"
                  :class="{ 'selected': selectedEmailsFromAll.includes(item.email) }"
                  tabindex="0"
                  role="checkbox"
                  :aria-checked="selectedEmailsFromAll.includes(item.email)"
                  :aria-label="`${item.email}, ${item.emailCount} 封邮件`"
                  @keydown.space.prevent="toggleEmailSelection(item.email)"
                  @keydown.enter.prevent="toggleEmailSelection(item.email)"
                >
                  <el-checkbox :label="item.email">
                    <div class="email-item-content">
                      <div class="email-address">
                        <Icon icon="material-symbols:email" class="email-icon" />
                        <span class="email-text">{{ item.email }}</span>
                      </div>
                      <div class="email-stats">
                        <span class="stat-item">
                          <Icon icon="material-symbols:mail" />
                          {{ item.emailCount }} 封邮件
                        </span>
                        <span class="stat-item">
                          <Icon icon="material-symbols:schedule" />
                          {{ formatTime(item.latestReceiveTime) }}
                        </span>
                      </div>
                    </div>
                  </el-checkbox>
                </div>
              </el-checkbox-group>
            </div>

            <el-pagination
              v-if="totalEmails > pageSize"
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="totalEmails"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @current-change="handlePageChange"
              @size-change="handleSizeChange"
              class="pagination"
            />
          </div>

          <!-- 批量输入 -->
          <div v-if="emailSelectionMode === 'batchInput'" class="batch-input-container">
            <div class="batch-input-header">
              <span class="batch-input-title">邮箱列表</span>
              <el-button
                type="primary"
                size="small"
                @click="showRandomGeneratorDialog = true"
                :icon="Icon"
              >
                <Icon icon="material-symbols:auto-awesome" />
                随机生成
              </el-button>
            </div>
            <el-input
              v-model="batchEmailInput"
              type="textarea"
              :rows="8"
              placeholder="请输入邮箱地址，一行一个：&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
              @blur="processBatchEmails"
            />
            <div class="batch-input-tip">
              <Icon icon="material-symbols:info" />
              支持粘贴多个邮箱地址，一行一个，系统会自动去重和格式验证
            </div>
          </div>

          <!-- 单个输入 -->
          <div v-if="emailSelectionMode === 'singleInput'" class="single-input-container">
            <el-input
              v-model="singleEmailInput"
              placeholder="请输入邮箱地址，如：user@example.com"
              @blur="processSingleEmail"
            >
              <template #prefix>
                <Icon icon="material-symbols:email" />
              </template>
              <template #append>
                <el-button @click="addSingleEmail" :disabled="!isValidEmail(singleEmailInput)">
                  添加
                </el-button>
              </template>
            </el-input>
          </div>
        </div>
        <div class="form-tip">
          <span v-if="form.shareType === 1">从邮箱白名单中选择要分享的邮箱。如需添加新邮箱，请点击"管理邮箱白名单"按钮。</span>
          <span v-else>选择允许访问的目标邮箱。访问者需要输入这些邮箱地址才能查看验证码。</span>
        </div>
      </el-form-item>

      <el-form-item label="分享名称" prop="shareName">
        <el-input
          v-model="form.shareName"
          placeholder="留空将自动生成分享名称"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="域名选择方式">
        <el-radio-group v-model="domainSelectionMode">
          <el-radio value="auto">自动匹配邮箱域名</el-radio>
          <el-radio value="manual">手动选择域名</el-radio>
        </el-radio-group>
        <div class="form-tip">
          自动模式：从邮箱列表中自动选择最频繁的域名；手动模式：手动选择分享链接的域名
        </div>
      </el-form-item>

      <el-form-item v-if="domainSelectionMode === 'manual'" label="分享域名" prop="shareDomain">
        <el-select
          v-model="form.shareDomain"
          placeholder="选择分享链接的域名"
          style="width: 100%"
        >
          <el-option
            v-for="domain in availableDomains"
            :key="domain.value"
            :label="domain.label"
            :value="domain.value"
          />
        </el-select>
        <div class="form-tip">
          选择生成分享链接使用的域名。本地开发时会自动检测端口。
        </div>
      </el-form-item>

      <!-- 过滤模式选择 -->
      <el-form-item label="过滤模式" prop="filterMode">
        <el-radio-group v-model="form.filterMode" @change="onFilterModeChange">
          <el-radio :label="1">关键词过滤</el-radio>
          <el-radio :label="2">模板匹配</el-radio>
        </el-radio-group>
        <div class="form-tip">
          关键词过滤：通过关键词匹配邮件内容；模板匹配：使用预定义模板精确提取验证码
        </div>
      </el-form-item>

      <!-- 关键词过滤配置 -->
      <el-form-item v-if="form.filterMode === 1" label="关键词过滤" prop="keywordFilter">
        <el-input
          v-model="form.keywordFilter"
          placeholder="验证码|verification|code|otp"
          maxlength="200"
        />
        <div class="form-tip">
          用于过滤包含特定关键词的邮件，多个关键词用"|"分隔
        </div>
      </el-form-item>

      <!-- 模板匹配配置 -->
      <div v-if="form.filterMode === 2">
        <el-form-item label="选择模板" prop="templateId">
          <div class="template-selector-container">
            <el-select
              v-model="form.templateId"
              placeholder="请选择邮件模板"
              class="template-select"
              @change="onTemplateChange"
            >
              <el-option
                v-for="template in availableTemplates"
                :key="template.id"
                :label="template.name"
                :value="template.id"
              >
                <div>
                  <div>{{ template.name }}</div>
                  <div style="font-size: 12px; color: #999;">{{ template.description }}</div>
                </div>
              </el-option>
            </el-select>
            <el-button type="primary" class="manage-template-btn" @click="showTemplateManagement = true">管理模板</el-button>
          </div>
          <div class="form-tip">
            选择预定义的邮件模板进行精确匹配和验证码提取
          </div>
        </el-form-item>

        <el-form-item label="显示选项">
          <el-checkbox v-model="form.showFullEmail">显示完整邮件内容</el-checkbox>
          <div class="form-tip">
            取消勾选时，仅显示提取的验证码，不显示完整邮件内容
          </div>
        </el-form-item>
      </div>

      <el-form-item label="过期时间" prop="expireTime">
        <el-date-picker
          v-model="form.expireTime"
          type="datetime"
          placeholder="选择过期时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          style="width: 100%"
        />
        <div class="form-tip">
          不设置则默认7天后过期
        </div>
      </el-form-item>

      <el-form-item label="频率限制">
        <div class="limit-control">
          <el-switch
            v-model="form.rateLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="unit-text" style="margin-left: 12px;">启用后可设置访问频率限制</span>
        </div>
        <div v-if="form.rateLimitEnabled" style="display: flex; gap: 20px; align-items: center; margin-top: 12px;">
          <div style="flex: 1;">
            <el-input-number
              v-model="form.rateLimitPerSecond"
              :min="1"
              :max="100"
              placeholder="每秒最大请求数"
              style="width: 100%;"
            />
            <div class="form-tip">每秒最大请求数（默认5次，防止极端恶意攻击）</div>
          </div>
          <div style="flex: 1;">
            <el-input-number
              v-model="form.autoRecoverySeconds"
              :min="0"
              :max="3600"
              placeholder="自动恢复时间"
              style="width: 100%;"
            />
            <div class="form-tip">触发限制后需等待的秒数（默认60秒，0表示禁用自动恢复）</div>
          </div>
        </div>
        <div class="form-tip">
          禁用频率限制后，访问者可以无限制地请求验证码。建议仅在信任环境中禁用。
        </div>
      </el-form-item>

      <!-- 显示数量限制 -->
      <el-form-item label="显示数量限制">
        <div class="limit-control">
          <el-switch
            v-model="form.verificationCodeLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="form.verificationCodeLimit"
            :min="1"
            :max="1000"
            :step="10"
            :disabled="!form.verificationCodeLimitEnabled"
            style="width: 150px; margin-left: 12px"
          />
          <span class="unit-text">条</span>
        </div>
        <div class="form-tip">
          控制每次访问最多显示的验证码数量。禁用后显示全部验证码。
        </div>
      </el-form-item>

      <!-- 访问次数限制 -->
      <el-form-item label="访问次数限制">
        <div class="limit-control">
          <el-switch
            v-model="form.otpLimitEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="form.otpLimitDaily"
            :min="1"
            :max="10000"
            :step="10"
            :disabled="!form.otpLimitEnabled"
            style="width: 150px; margin-left: 12px"
          />
          <span class="unit-text">次/天</span>
        </div>
        <div class="form-tip">
          控制每天最多可以访问的次数。禁用后无限制访问。
        </div>
      </el-form-item>

      <!-- 新增：最新邮件数量限制 -->
      <el-form-item label="最新邮件显示数量">
        <div class="limit-control">
          <el-input-number
            v-model="form.latestEmailCount"
            :min="1"
            :max="100"
            :step="1"
            placeholder="留空显示全部"
            style="width: 200px"
            clearable
          />
          <span class="unit-text">封</span>
        </div>
        <div class="form-tip">
          控制分享链接最多显示多少封最新邮件。留空表示显示全部邮件。
        </div>
      </el-form-item>

      <!-- 新增：自动刷新功能 -->
      <el-form-item label="自动刷新">
        <div class="limit-control">
          <el-switch
            v-model="form.autoRefreshEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-select
            v-model="form.autoRefreshInterval"
            :disabled="!form.autoRefreshEnabled"
            style="width: 120px; margin-left: 12px"
            @change="handleAutoRefreshIntervalChange"
          >
            <el-option label="5秒" :value="5" />
            <el-option label="10秒" :value="10" />
            <el-option label="19秒" :value="19" />
            <el-option label="30秒" :value="30" />
            <el-option label="60秒" :value="60" />
            <el-option label="120秒" :value="120" />
            <el-option label="300秒" :value="300" />
            <el-option label="自定义" :value="0" />
          </el-select>
          <span class="unit-text">间隔</span>
          <!-- 自定义输入框 -->
          <el-input
            v-if="form.autoRefreshInterval === 0 && form.autoRefreshEnabled"
            v-model.number="customAutoRefreshInterval"
            type="number"
            placeholder="输入秒数(1-3600)"
            style="width: 120px; margin-left: 12px"
            :min="1"
            :max="3600"
            @input="validateCustomAutoRefreshInterval"
          />
        </div>
        <div class="form-tip">
          启用后，访问者的页面会自动刷新获取最新邮件。自定义间隔范围：1-3600秒。
        </div>
        <div v-if="autoRefreshIntervalError" class="form-error">
          {{ autoRefreshIntervalError }}
        </div>
      </el-form-item>

      <!-- 新增：冷却功能配置 -->
      <el-form-item label="获取验证码冷却">
        <div class="limit-control">
          <el-switch
            v-model="form.cooldownEnabled"
            active-text="启用"
            inactive-text="禁用"
          />
          <el-input-number
            v-model="form.cooldownSeconds"
            :min="1"
            :max="300"
            :step="1"
            :disabled="!form.cooldownEnabled"
            style="width: 120px; margin-left: 12px"
          />
          <span class="unit-text">秒</span>
        </div>
        <div class="form-tip">
          控制点击"获取最新验证码"按钮后的冷却时间。禁用后可无限制点击。
        </div>
      </el-form-item>

      <!-- 新增：人机验证功能 -->
      <el-form-item label="人机验证">
        <div class="limit-control">
          <el-switch
            v-model="form.enableCaptcha"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="unit-text" style="margin-left: 12px;">启用后触发频率限制时需要进行人机验证</span>
        </div>
        <div class="form-tip">
          启用Cloudflare Turnstile人机验证，防止恶意访问。当访问频率超过限制时，访问者需要完成验证才能继续访问。
        </div>
      </el-form-item>

      <!-- 新增：公告弹窗功能（支持图片） -->
      <el-form-item label="公告内容" prop="announcementContent">
        <div class="announcement-editor">
          <!-- 展示次数选项 -->
          <div class="announcement-section">
            <label class="section-label">展示次数</label>
            <el-radio-group v-model="announcementData.displayMode">
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
                v-model="announcementData.title"
                placeholder="输入公告标题"
                maxlength="100"
                show-word-limit
              />
            </div>
            <el-button
              type="primary"
              @click="showAnnouncementPreview = true"
              style="align-self: flex-end; margin-bottom: 0"
            >
              预览公告
            </el-button>
          </div>

          <!-- 文本内容 -->
          <div class="announcement-section">
            <label class="section-label">公告文本（支持粘贴图片）</label>
            <el-input
              v-model="announcementData.content"
              type="textarea"
              placeholder="输入公告内容（可选）或粘贴图片"
              maxlength="5000"
              show-word-limit
              :rows="3"
              @paste="handlePaste"
            />
          </div>

          <!-- 图片上传 -->
          <div class="announcement-section">
            <label class="section-label">公告图片（可选，最多10张）</label>

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
            <div v-if="announcementData.images && announcementData.images.length > 0" class="images-list">
              <div
                v-for="(image, index) in announcementData.images"
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
                    v-if="index < announcementData.images.length - 1"
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
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          创建分享
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 公告预览抽屉 -->
  <el-drawer
    v-model="showAnnouncementPreview"
    title="公告预览"
    direction="rtl"
    size="500px"
    class="announcement-preview-drawer"
  >
    <div class="preview-content">
      <!-- 预览标题 -->
      <div v-if="announcementData.title" class="preview-title">
        {{ announcementData.title }}
      </div>

      <!-- 预览图片轮播 -->
      <div v-if="announcementData.images && announcementData.images.length > 0" class="preview-images-carousel">
        <el-carousel :autoplay="false" class="carousel">
          <el-carousel-item v-for="(image, index) in announcementData.images" :key="index">
            <div class="carousel-item">
              <img :src="image.base64" :alt="`Image ${index + 1}`" />
              <div v-if="image.caption" class="image-caption">{{ image.caption }}</div>
            </div>
          </el-carousel-item>
        </el-carousel>
        <div class="carousel-info">
          {{ previewImageIndex + 1 }} / {{ announcementData.images.length }}
        </div>
      </div>

      <!-- 预览文本内容 -->
      <div v-if="announcementData.content" class="preview-text">
        {{ announcementData.content }}
      </div>

      <!-- 空状态提示 -->
      <div v-if="!announcementData.title && !announcementData.content && (!announcementData.images || announcementData.images.length === 0)" class="preview-empty">
        <el-empty description="暂无公告内容" />
      </div>
    </div>
  </el-drawer>

  <!-- 邮箱白名单管理对话框 -->
  <ShareWhitelistDialog
    v-model="showWhitelistDialog"
    @updated="handleWhitelistUpdated"
  />

  <!-- 模板管理对话框 -->
  <TemplateManagementDialog
    v-model="showTemplateManagement"
    @updated="handleTemplateManagementUpdated"
  />

  <!-- 随机邮箱生成对话框 -->
  <el-dialog
    v-model="showRandomGeneratorDialog"
    title="随机生成邮箱"
    width="500px"
    @close="resetRandomGenerator"
  >
    <div class="random-generator-content">
      <el-form :model="randomGeneratorForm" label-width="100px">
        <el-form-item label="选择域名">
          <el-select
            v-model="randomGeneratorForm.domain"
            placeholder="选择域名"
            style="width: 100%"
          >
            <el-option
              v-for="domain in availableDomains"
              :key="domain.value"
              :label="domain.label"
              :value="domain.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="生成数量">
          <el-radio-group v-model="randomGeneratorForm.count">
            <el-radio :value="10">10个</el-radio>
            <el-radio :value="20">20个</el-radio>
            <el-radio :value="100">100个</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="showRandomGeneratorDialog = false">取消</el-button>
        <el-button type="primary" @click="handleGenerateRandomEmails">
          生成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, nextTick, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { createShare } from '@/request/share.js';
import { getUniqueRecipients } from '@/request/all-email.js';
import { getAvailableTemplates } from '@/request/email-template.js';
import dayjs from 'dayjs';
import { Icon } from '@iconify/vue';
import { UploadFilled, ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue';
import ShareWhitelistDialog from './ShareWhitelistDialog.vue';
import TemplateManagementDialog from './TemplateManagementDialog.vue';
import { useSettingStore } from '@/store/setting.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'created']);

// Store
const settingStore = useSettingStore();

// 响应式数据
const visible = ref(false);
const formRef = ref();
const submitting = ref(false);
const showWhitelistDialog = ref(false);

// 邮箱选择相关
const emailSelectionMode = ref('fromAllEmails'); // 'fromAllEmails', 'batchInput', 'singleInput'
const loadingAllEmails = ref(false);

// 模板相关数据
const availableTemplates = ref([]);
const showTemplateManagement = ref(false);
const loadingTemplates = ref(false);
const displayEmails = ref([]);
const selectedEmailsFromAll = ref([]);
const totalEmails = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const searchKeyword = ref('');
const sortBy = ref('email');

// 批量输入相关
const batchEmailInput = ref('');

// 单个输入相关
const singleEmailInput = ref('');

// 随机生成相关
const showRandomGeneratorDialog = ref(false);
const randomGeneratorForm = reactive({
  domain: '',
  count: 10
});

// 域名选择模式
const domainSelectionMode = ref('auto'); // 'auto' 或 'manual'

// 自动刷新相关
const customAutoRefreshInterval = ref(null);
const autoRefreshIntervalError = ref('');

// 公告相关
const showAnnouncementPreview = ref(false);
const previewImageIndex = ref(0);
const announcementData = reactive({
  title: '',
  content: '',
  images: [],
  displayMode: 'always' // 展示次数：'always' 每次显示，'once' 仅显示一次
});

// 表单数据
const form = reactive({
  shareType: 1, // 1=单邮箱分享, 2=白名单验证分享
  targetEmails: [],
  shareName: '',
  shareDomain: '', // 分享域名
  keywordFilter: '验证码|verification|code|otp',
  expireTime: '',
  rateLimitEnabled: true, // 频率限制开关，默认启用
  rateLimitPerSecond: 5,
  autoRecoverySeconds: 60,
  // 显示数量限制
  verificationCodeLimit: 100,
  verificationCodeLimitEnabled: true,
  // 访问次数限制
  otpLimitDaily: 100,
  otpLimitEnabled: true,
  // 模板匹配功能
  filterMode: 1, // 1=关键词过滤, 2=模板匹配
  templateId: '',
  showFullEmail: true,
  // 新增：邮件数量限制和自动刷新功能
  latestEmailCount: null, // null表示显示全部，数字表示显示最新N封
  autoRefreshEnabled: false, // 自动刷新开关
  autoRefreshInterval: 30, // 自动刷新间隔（秒）
  // 新增：冷却功能配置
  cooldownEnabled: true, // 冷却功能开关，默认启用
  cooldownSeconds: 10, // 冷却时间（秒），默认10秒
  // 新增：人机验证功能
  enableCaptcha: false, // 人机验证开关，默认禁用
  // 新增：公告弹窗功能
  announcementContent: '' // 公告内容，空字符串表示不显示公告
});

// 表单验证规则
const rules = computed(() => ({
  shareType: [
    { required: true, message: '请选择分享类型', trigger: 'change' }
  ],
  targetEmails: [
    { required: true, message: '请选择目标邮箱', trigger: 'change' },
    { type: 'array', min: 1, message: '至少选择一个邮箱', trigger: 'change' }
  ],
  shareName: [
    { max: 100, message: '分享名称长度不能超过 100 个字符', trigger: 'blur' }
  ],
  cooldownSeconds: [
    { type: 'number', min: 1, max: 300, message: '冷却时间必须在 1-300 秒之间', trigger: 'blur' }
  ]
}));

// 计算属性
const availableEmails = computed(() => {
  return displayEmails.value.filter(item => !form.targetEmails.includes(item.email));
});

// 监听显示状态
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    resetForm();
    // 初始化默认域名（在resetForm之后）
    nextTick(() => {
      if (availableDomains.value.length > 0) {
        form.shareDomain = availableDomains.value[0].value;
        console.log('初始化默认域名:', form.shareDomain);
      }
    });
    if (emailSelectionMode.value === 'fromAllEmails') {
      loadAllEmails();
    }
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

// 加载全部邮件中的邮箱
const loadAllEmails = async () => {
  loadingAllEmails.value = true;
  try {
    const response = await getUniqueRecipients({
      search: searchKeyword.value,
      page: currentPage.value,
      pageSize: pageSize.value,
      orderBy: sortBy.value
    });
    const data = response.data || response;
    displayEmails.value = data.list || [];
    totalEmails.value = data.total || 0;
  } catch (error) {
    console.error('Load emails error:', error);
    ElMessage.error('加载邮箱列表失败');
  } finally {
    loadingAllEmails.value = false;
  }
};

// 邮箱选择方式变更处理
const handleSelectionModeChange = (mode) => {
  // 清空当前选择
  form.targetEmails = [];
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';

  // 根据模式加载数据
  if (mode === 'fromAllEmails') {
    loadAllEmails();
  }
};

// 处理从全部邮件中的选择变更
const handleEmailSelectionChange = (selectedEmails) => {
  // Fix P1-43: 验证从全部邮件中选择的邮箱
  const validatedEmails = selectedEmails.filter(email => {
    if (!isValidEmail(email)) {
      ElMessage.warning(`邮箱格式无效: ${email}`);
      return false;
    }
    return true;
  });
  form.targetEmails = [...validatedEmails];
};

// 选择所有邮箱（从全部邮件）
const selectAll = () => {
  if (emailSelectionMode.value === 'fromAllEmails') {
    selectedEmailsFromAll.value = displayEmails.value.map(item => item.email);
    form.targetEmails = [...selectedEmailsFromAll.value];
  }
};

// 键盘支持：切换邮箱选中状态
const toggleEmailSelection = (email) => {
  const index = selectedEmailsFromAll.value.indexOf(email);
  if (index > -1) {
    // 已选中，取消选中
    selectedEmailsFromAll.value.splice(index, 1);
  } else {
    // 未选中，添加选中
    selectedEmailsFromAll.value.push(email);
  }
  // 同步到form
  form.targetEmails = [...selectedEmailsFromAll.value];
};

// 清空所有选择
const clearAll = () => {
  form.targetEmails = [];
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';
};

// 邮箱格式验证
const isValidEmail = (email) => {
  // Fix P1-35: 添加邮箱长度验证
  const MAX_EMAIL_LENGTH = 254; // RFC standard
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// 可用域名列表
const availableDomains = computed(() => {
  const domains = [];

  // 添加配置的域名
  if (settingStore.domainList && settingStore.domainList.length > 0) {
    settingStore.domainList.forEach(domain => {
      const cleanDomain = domain.replace(/^@/, '');
      domains.push({
        label: `https://${cleanDomain}`,
        value: cleanDomain
      });
    });
  }

  // 本地开发环境：自动检测当前域名和端口
  if (import.meta.env.DEV) {
    const currentHost = window.location.host;
    if (!domains.some(d => d.value === currentHost)) {
      domains.unshift({
        label: `${window.location.protocol}//${currentHost} (本地开发)`,
        value: currentHost
      });
    }
  }

  // 如果没有任何域名，使用当前域名作为默认值
  if (domains.length === 0) {
    const currentHost = window.location.host;
    domains.push({
      label: `${window.location.protocol}//${currentHost} (默认)`,
      value: currentHost
    });
  }

  return domains;
});

// 生成随机分享名称
const generateRandomShareName = (shareType, emailCount = 1) => {
  const adjectives = ['快速', '安全', '便捷', '智能', '高效', '专业', '可靠', '简单'];
  const nouns = ['验证码', '邮件', '分享', '服务', '通道', '接收'];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const timestamp = new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/[\/\s:]/g, '');

  if (shareType === 2) {
    return `${randomAdjective}${randomNoun}分享-${emailCount}邮箱-${timestamp}`;
  } else {
    return `${randomAdjective}${randomNoun}接收-${timestamp}`;
  }
};

// 处理批量输入
const processBatchEmails = () => {
  if (!batchEmailInput.value.trim()) return;

  const MAX_EMAIL_LENGTH = 254; // RFC standard
  const emails = batchEmailInput.value
    .split('\n')
    .map(email => email.trim())
    .filter(email => email)
    .filter(email => {
      // Fix P1-36: 在批量输入时检查邮箱长度
      if (email.length > MAX_EMAIL_LENGTH) {
        ElMessage.warning(`邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）: ${email}`);
        return false;
      }
      return isValidEmail(email);
    });

  if (emails.length === 0) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }

  // 去重并添加
  const newEmails = emails.filter(email => !form.targetEmails.includes(email));
  form.targetEmails.push(...newEmails);

  ElMessage.success(`成功添加 ${newEmails.length} 个邮箱`);
};

// 处理单个输入
const processSingleEmail = () => {
  if (singleEmailInput.value.trim() && isValidEmail(singleEmailInput.value.trim())) {
    addSingleEmail();
  }
};

// 添加单个邮箱
const addSingleEmail = () => {
  const email = singleEmailInput.value.trim();
  const MAX_EMAIL_LENGTH = 254; // RFC standard

  // Fix P1-37: 在添加单个邮箱时检查长度
  if (!email) {
    ElMessage.warning('请输入邮箱地址');
    return;
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    ElMessage.warning(`邮箱地址过长（最多${MAX_EMAIL_LENGTH}个字符）`);
    return;
  }

  if (!isValidEmail(email)) {
    ElMessage.warning('请输入有效的邮箱地址');
    return;
  }

  if (form.targetEmails.includes(email)) {
    ElMessage.warning('该邮箱已存在');
    return;
  }

  form.targetEmails.push(email);
  singleEmailInput.value = '';
  ElMessage.success('邮箱添加成功');
};

// 移除选中的邮箱
const removeSelectedEmail = (email) => {
  const index = form.targetEmails.indexOf(email);
  if (index > -1) {
    form.targetEmails.splice(index, 1);
  }
  // 同时从选择列表中移除
  const selectedIndex = selectedEmailsFromAll.value.indexOf(email);
  if (selectedIndex > -1) {
    selectedEmailsFromAll.value.splice(selectedIndex, 1);
  }
};

// 搜索处理
const handleSearch = () => {
  currentPage.value = 1;
  loadAllEmails();
};

// 分页处理
const handlePageChange = (page) => {
  currentPage.value = page;
  loadAllEmails();
};

// 页面大小变更处理
const handleSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadAllEmails();
};

// 时间格式化
const formatTime = (timeStr) => {
  if (!timeStr) return '未知';
  return dayjs(timeStr).format('MM-DD HH:mm');
};

// 处理白名单更新（保留兼容性）
const handleWhitelistUpdated = () => {
  if (emailSelectionMode.value === 'fromAllEmails') {
    loadAllEmails();
  }
  ElMessage.success('邮箱白名单更新成功');
};

// 处理分享类型变更
const handleShareTypeChange = (type) => {
  // 不再清空目标邮箱选择，两种类型都需要选择目标邮箱
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 从邮箱列表中提取域名并返回最频繁的域名
const extractMostFrequentDomain = (emails) => {
  if (!emails || emails.length === 0) {
    return null;
  }

  const domainCounts = {};
  emails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });

  // 找到出现次数最多的域名
  let maxDomain = null;
  let maxCount = 0;
  for (const [domain, count] of Object.entries(domainCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxDomain = domain;
    }
  }

  return maxDomain;
};

// 检测邮箱列表中的所有不同域名
const detectAllDomains = (emails) => {
  if (!emails || emails.length === 0) {
    return [];
  }

  const domains = new Set();
  emails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      domains.add(domain);
    }
  });

  return Array.from(domains).sort();
};

// 获取域名的出现次数统计
const getDomainStatistics = (emails) => {
  if (!emails || emails.length === 0) {
    return {};
  }

  const domainCounts = {};
  emails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });

  return domainCounts;
};

// 处理自动刷新间隔变更
const handleAutoRefreshIntervalChange = () => {
  autoRefreshIntervalError.value = '';
  if (form.autoRefreshInterval === 0) {
    // 选择自定义，清空错误信息
    customAutoRefreshInterval.value = null;
  }
};

// 验证自定义自动刷新间隔
const validateCustomAutoRefreshInterval = () => {
  autoRefreshIntervalError.value = '';

  if (customAutoRefreshInterval.value === null || customAutoRefreshInterval.value === '') {
    autoRefreshIntervalError.value = '请输入刷新间隔';
    return false;
  }

  const value = parseInt(customAutoRefreshInterval.value);

  if (isNaN(value)) {
    autoRefreshIntervalError.value = '请输入有效的数字';
    return false;
  }

  if (value < 1 || value > 3600) {
    autoRefreshIntervalError.value = '刷新间隔必须在1-3600秒之间';
    return false;
  }

  return true;
};

// 获取最终的自动刷新间隔
const getFinalAutoRefreshInterval = () => {
  if (form.autoRefreshInterval === 0) {
    // 自定义模式
    if (!validateCustomAutoRefreshInterval()) {
      throw new Error(autoRefreshIntervalError.value);
    }
    return parseInt(customAutoRefreshInterval.value);
  }
  return form.autoRefreshInterval;
};

// 重置表单
const resetForm = () => {
  form.shareType = 1;
  form.targetEmails = [];
  form.shareName = '';
  form.shareDomain = ''; // 重置域名选择
  form.keywordFilter = '验证码|verification|code|otp';
  form.expireTime = '';
  form.verificationCodeLimit = 100;
  form.verificationCodeLimitEnabled = true;
  form.otpLimitDaily = 100;
  form.otpLimitEnabled = true;
  // 新增字段重置
  form.latestEmailCount = null;
  form.autoRefreshEnabled = false;
  form.autoRefreshInterval = 30;
  customAutoRefreshInterval.value = null;
  autoRefreshIntervalError.value = '';
  // 模板匹配功能重置
  form.filterMode = 1;
  form.templateId = '';
  form.showFullEmail = true;
  // 域名选择模式重置
  domainSelectionMode.value = 'auto';
  selectedEmailsFromAll.value = [];
  batchEmailInput.value = '';
  singleEmailInput.value = '';
  // 公告弹窗功能重置
  form.announcementContent = '';
  announcementData.title = '';
  announcementData.content = '';
  announcementData.images = [];
  showAnnouncementPreview.value = false;
  previewImageIndex.value = 0;

  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 构建公告内容（支持新旧格式）
const buildAnnouncementContent = () => {
  // 如果没有标题、内容和图片，返回null
  if (!announcementData.title && !announcementData.content && announcementData.images.length === 0) {
    return null
  }

  // 如果只有纯文本内容（没有标题和图片），返回纯文本
  if (!announcementData.title && announcementData.images.length === 0 && announcementData.content) {
    return announcementData.content
  }

  // 否则返回JSON格式
  const richContent = {
    type: 'rich',
    title: announcementData.title || '',
    content: announcementData.content || '',
    images: announcementData.images || [],
    displayMode: announcementData.displayMode || 'always'
  }

  return JSON.stringify(richContent)
};

// 图片处理方法
const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files)
  await processFiles(files)
  // 重置文件输入
  event.target.value = ''
};

const handleDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
  await processFiles(files)
};

const processFiles = async (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  if (imageFiles.length === 0) {
    ElMessage.warning('请选择图片文件')
    return
  }

  // 检查图片数量限制
  if (announcementData.images.length + imageFiles.length > 10) {
    ElMessage.error('公告图片最多10张，当前已有 ' + announcementData.images.length + ' 张')
    return
  }

  for (const file of imageFiles) {
    // 检查单个文件大小（500KB）
    if (file.size > 500 * 1024) {
      ElMessage.error(`图片 ${file.name} 超过500KB限制`)
      continue
    }

    try {
      const base64 = await fileToBase64(file)
      announcementData.images.push({
        base64,
        caption: ''
      })
    } catch (error) {
      ElMessage.error(`处理图片 ${file.name} 失败: ${error.message}`)
    }
  }
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
};

// 粘贴事件处理 - 只处理图片
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
};

const removeImage = (index) => {
  announcementData.images.splice(index, 1)
};

const moveImageUp = (index) => {
  if (index > 0) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index - 1]
    announcementData.images[index - 1] = temp
  }
};

const moveImageDown = (index) => {
  if (index < announcementData.images.length - 1) {
    const temp = announcementData.images[index]
    announcementData.images[index] = announcementData.images[index + 1]
    announcementData.images[index + 1] = temp
  }
};

// 处理提交
const handleSubmit = async () => {
  try {
    await formRef.value.validate();

    submitting.value = true;

    // 调试日志：打印用户选择的域名
    console.log('=== 创建分享调试信息 ===');
    console.log('域名选择模式:', domainSelectionMode.value);
    console.log('用户选择的域名:', form.shareDomain);
    console.log('可用域名列表:', availableDomains.value);
    console.log('表单数据:', JSON.stringify(form, null, 2));

    const expireTime = form.expireTime || dayjs().add(7, 'day').toISOString();
    const results = [];

    // 获取最终的自动刷新间隔（支持自定义）
    let finalAutoRefreshInterval = form.autoRefreshInterval;
    if (form.autoRefreshEnabled && form.autoRefreshInterval === 0) {
      try {
        finalAutoRefreshInterval = getFinalAutoRefreshInterval();
      } catch (error) {
        ElMessage.error(error.message);
        return;
      }
    }

    if (form.shareType === 2) {
      // 类型2：多邮箱验证分享，创建一个包含授权邮箱列表的分享
      if (form.targetEmails.length === 0) {
        ElMessage.warning('请至少选择一个邮箱');
        return;
      }

      // Fix P1-24: 前端邮箱去重，防止重复的邮箱被发送到后端
      const uniqueEmails = [...new Set(
        form.targetEmails.map(email => email.trim().toLowerCase())
      )];

      // Fix P1-31: 检查去重后是否还有邮箱
      if (uniqueEmails.length === 0) {
        ElMessage.warning('去重后没有有效的邮箱');
        return;
      }

      // 检测邮箱列表中的所有域名
      const allDomains = detectAllDomains(uniqueEmails);
      const domainStats = getDomainStatistics(uniqueEmails);
      const hasMultipleDomains = allDomains.length > 1;

      // 智能域名匹配：根据选择模式确定最终使用的域名
      let finalDomain = form.shareDomain;
      if (domainSelectionMode.value === 'auto') {
        const extractedDomain = extractMostFrequentDomain(uniqueEmails);
        if (extractedDomain) {
          // 查找对应的完整域名值（包含协议和端口）
          const matchedDomain = availableDomains.value.find(d => d.value.includes(extractedDomain));
          if (matchedDomain) {
            finalDomain = matchedDomain.value;
            console.log('自动匹配域名:', extractedDomain, '-> 完整值:', finalDomain);

            // 如果检测到多个域名，显示警告信息
            if (hasMultipleDomains) {
              const domainInfo = allDomains.map(d => `${d} (${domainStats[d]}个)`).join('、');
              ElMessage.warning({
                message: `检测到多个邮箱域名: ${domainInfo}。系统将使用最频繁的域名 "${extractedDomain}" 作为分享链接域名，其他域名的邮箱也可以正常访问。`,
                duration: 5000
              });
            }
          }
        }
      } else {
        // 手动选择模式下，如果检测到多个域名，也显示提示
        if (hasMultipleDomains) {
          const domainInfo = allDomains.map(d => `${d} (${domainStats[d]}个)`).join('、');
          ElMessage.info({
            message: `邮箱列表包含多个域名: ${domainInfo}。所有域名的邮箱都可以访问此分享链接。`,
            duration: 4000
          });
        }
      }

      const shareData = {
        targetEmail: uniqueEmails[0], // 使用第一个邮箱作为主邮箱（向后兼容）
        authorizedEmails: uniqueEmails, // 授权邮箱列表（已去重）
        shareName: form.shareName || generateRandomShareName(2, uniqueEmails.length), // Fix P1-32: 使用去重后的邮箱数量
        shareDomain: finalDomain, // 使用智能匹配或手动选择的域名
        keywordFilter: form.keywordFilter,
        expireTime: expireTime,
        shareType: 2,
        rateLimitPerSecond: form.rateLimitEnabled ? form.rateLimitPerSecond : 0,
        autoRecoverySeconds: form.autoRecoverySeconds,
        verificationCodeLimit: form.verificationCodeLimit,
        verificationCodeLimitEnabled: form.verificationCodeLimitEnabled,
        otpLimitDaily: form.otpLimitDaily,
        otpLimitEnabled: form.otpLimitEnabled,
        // 新增：邮件数量限制和自动刷新功能
        latestEmailCount: form.latestEmailCount,
        autoRefreshEnabled: form.autoRefreshEnabled,
        autoRefreshInterval: finalAutoRefreshInterval,
        // 模板匹配功能
        filterMode: form.filterMode,
        templateId: form.templateId,
        showFullEmail: form.showFullEmail,
        // 冷却功能配置
        cooldownEnabled: form.cooldownEnabled,
        cooldownSeconds: form.cooldownSeconds,
        // 公告弹窗功能（支持图片）
        announcementContent: buildAnnouncementContent()
      };

      try {
        const result = await createShare(shareData);
        results.push({ email: `多邮箱分享 (${form.targetEmails.length}个)`, success: true, result });
      } catch (error) {
        results.push({ email: '多邮箱分享', success: false, error: error.message });
      }
    } else {
      // 类型1：为每个选中的邮箱创建分享
      for (const email of form.targetEmails) {
        const shareData = {
          targetEmail: email,
          shareName: form.shareName || generateRandomShareName(1),
          shareDomain: form.shareDomain, // 用户选择的域名
          keywordFilter: form.keywordFilter,
          expireTime: expireTime,
          shareType: 1,
          verificationCodeLimit: form.verificationCodeLimit,
          verificationCodeLimitEnabled: form.verificationCodeLimitEnabled,
          otpLimitDaily: form.otpLimitDaily,
          otpLimitEnabled: form.otpLimitEnabled,
          // 新增：邮件数量限制和自动刷新功能
          latestEmailCount: form.latestEmailCount,
          autoRefreshEnabled: form.autoRefreshEnabled,
          autoRefreshInterval: finalAutoRefreshInterval,
          // 模板匹配功能
          filterMode: form.filterMode,
          templateId: form.templateId,
          showFullEmail: form.showFullEmail,
          // 频率限制配置
          rateLimitPerSecond: form.rateLimitEnabled ? form.rateLimitPerSecond : 0,
          autoRecoverySeconds: form.autoRecoverySeconds,
          // 冷却功能配置
          cooldownEnabled: form.cooldownEnabled,
          cooldownSeconds: form.cooldownSeconds,
          // 公告弹窗功能（支持图片）
          announcementContent: buildAnnouncementContent()
        };

        try {
          console.log('发送给后端的数据:', JSON.stringify(shareData, null, 2));
          const result = await createShare(shareData);
          results.push({ email, success: true, result });
        } catch (error) {
          console.error('创建分享失败:', error);
          results.push({ email, success: false, error: error.message });
        }
      }
    }

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      ElMessage.success(`成功创建 ${successCount} 个邮箱分享`);
    }
    if (failCount > 0) {
      ElMessage.warning(`${failCount} 个邮箱分享创建失败`);
    }

    emit('created', results);
    handleClose();
  } catch (error) {
    if (error.message) {
      ElMessage.error(error.message);
    }
  } finally {
    submitting.value = false;
  }
};

// 随机邮箱生成相关方法
const generateRandomString = (length) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateRandomEmails = (domain, count) => {
  const emails = new Set();
  const maxAttempts = count * 10; // 防止无限循环
  let attempts = 0;

  while (emails.size < count && attempts < maxAttempts) {
    // 随机长度 4-25 个字符
    const length = Math.floor(Math.random() * (25 - 4 + 1)) + 4;
    const randomStr = generateRandomString(length);
    const email = `${randomStr}@${domain}`;
    emails.add(email);
    attempts++;
  }

  return Array.from(emails);
};

const handleGenerateRandomEmails = () => {
  if (!randomGeneratorForm.domain) {
    ElMessage.warning('请选择域名');
    return;
  }

  try {
    const generatedEmails = generateRandomEmails(randomGeneratorForm.domain, randomGeneratorForm.count);

    // 将生成的邮箱添加到批量输入框
    const currentEmails = batchEmailInput.value.trim() ? batchEmailInput.value.trim().split('\n') : [];
    const allEmails = [...currentEmails, ...generatedEmails];

    // 去重
    const uniqueEmails = [...new Set(allEmails.map(e => e.toLowerCase()))];

    batchEmailInput.value = uniqueEmails.join('\n');

    // 处理批量邮箱
    processBatchEmails();

    ElMessage.success(`成功生成 ${generatedEmails.length} 个随机邮箱`);
    showRandomGeneratorDialog.value = false;
  } catch (error) {
    ElMessage.error('生成随机邮箱失败: ' + error.message);
  }
};

const resetRandomGenerator = () => {
  randomGeneratorForm.domain = '';
  randomGeneratorForm.count = 10;
};

// 模板相关方法
const loadAvailableTemplates = async () => {
  loadingTemplates.value = true;
  try {
    const response = await getAvailableTemplates();
    const result = response.data || response;
    availableTemplates.value = result.data || result || [];
  } catch (error) {
    console.error('Load templates error:', error);
    ElMessage.error('加载模板列表失败');
  } finally {
    loadingTemplates.value = false;
  }
};

// 过滤模式变更处理
const onFilterModeChange = (mode) => {
  if (mode === 2) {
    // 切换到模板匹配模式时，加载可用模板
    loadAvailableTemplates();
  } else {
    // 切换到关键词模式时，清空模板选择
    form.templateId = '';
  }
};

// 模板选择变更处理
const onTemplateChange = (templateId) => {
  // 可以在这里添加模板选择后的逻辑
  console.log('Selected template:', templateId);
};

// 模板管理更新处理
const handleTemplateManagementUpdated = () => {
  // 模板管理对话框中有增删改操作时,重新加载可用模板列表
  loadAvailableTemplates();
};

// 处理关闭
const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.create-share-dialog {
  --el-dialog-width: 1200px;
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

.email-select-container {
  width: 100%;
}

.select-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.selected-count {
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

/* 已选邮箱展示区域 - 固定高度避免跳动 */
.selected-emails-display {
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--el-fill-color-extra-light);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  /* 固定高度，避免界面跳动 */
  min-height: 120px;
  max-height: 120px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.selected-emails-header {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.selected-emails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}

.selected-email-tag {
  height: 40px;
  padding: 8px 12px;
  font-size: 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  transition: all 0.2s;
}

.selected-email-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.email-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* 空状态提示 */
.empty-selection-hint {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.empty-selection-hint svg {
  font-size: 18px;
}

.share-type-option {
  .option-title {
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
  }

  .option-desc {
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1.4;
  }
}

.el-radio {
  margin-right: 24px;
  margin-bottom: 16px;

  &:last-child {
    margin-right: 0;
  }
}

.email-selector {
  margin-bottom: 16px;
}

.email-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-icon {
  font-size: 16px;
  color: var(--el-color-primary);
}

.email-tabs {
  margin-bottom: 8px;
}

.whitelist-manage {
  padding: 8px 0;
}

.manage-actions {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

/* 搜索栏样式 */
.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
}

.sort-select {
  width: 180px;
}

/* 邮箱列表 - 网格布局 */
.email-list {
  min-height: 200px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background-color: var(--el-bg-color);
  max-height: 600px;
  overflow-y: auto;
}

.email-list :deep(.el-checkbox-group) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  width: 100%;
}

/* 响应式断点 - 长方形卡片布局 */
@media (min-width: 1400px) {
  .email-list :deep(.el-checkbox-group) {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1200px) and (max-width: 1399px) {
  .email-list :deep(.el-checkbox-group) {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 900px) and (max-width: 1199px) {
  .email-list :deep(.el-checkbox-group) {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 600px) and (max-width: 899px) {
  .email-list :deep(.el-checkbox-group) {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 599px) {
  .email-list :deep(.el-checkbox-group) {
    grid-template-columns: 1fr;
  }
}

/* 邮箱卡片样式 - 长方形设计（横向长方形）*/
.email-item {
  position: relative;
  border: 2px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  min-height: 80px;
  max-height: 80px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 渐入动画 */
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.email-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}

.email-item.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  /* 选中时的微动画 */
  animation: selectPulse 0.4s ease-out;
}

/* 键盘焦点指示器 - 符合WCAG 2.1标准 */
.email-item:focus {
  outline: none; /* 移除默认outline */
}

.email-item:focus-visible {
  outline: 3px solid var(--el-color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.25);
  border-color: var(--el-color-primary);
}

/* 暗色模式下的焦点指示器 */
html.dark .email-item:focus-visible {
  outline-color: var(--el-color-primary-light-3);
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.4);
}

/* 骨架屏样式 */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  width: 100%;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  min-height: 80px;
  max-height: 80px;
}

.skeleton-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-email {
  height: 16px;
  width: 70%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-stats {
  display: flex;
  gap: 12px;
}

.skeleton-stat {
  height: 12px;
  width: 80px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* 暗色模式下的骨架屏 */
html.dark .skeleton-checkbox,
html.dark .skeleton-email,
html.dark .skeleton-stat {
  background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
  background-size: 200% 100%;
}

html.dark .skeleton-item {
  border-color: var(--el-border-color);
  background: var(--el-fill-color-darker);
}

/* 暗色模式优化 */
html.dark .email-item {
  background: var(--el-fill-color-darker);
  border-color: var(--el-border-color);
}

html.dark .email-item:hover {
  background: var(--el-fill-color-dark);
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

html.dark .email-item.selected {
  background: rgba(64, 158, 255, 0.15);
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

html.dark .email-address {
  color: var(--el-text-color-primary);
}

html.dark .email-stats {
  color: var(--el-text-color-secondary);
}

html.dark .stat-item svg {
  color: var(--el-text-color-placeholder);
}

/* 已选邮箱标签暗色模式 */
html.dark .selected-email-tag {
  background: rgba(64, 158, 255, 0.2);
  border-color: var(--el-color-primary-light-3);
  color: var(--el-color-primary-light-3);
}

html.dark .empty-selection-hint {
  color: var(--el-text-color-secondary);
}

/* 搜索栏暗色模式 */
html.dark .search-input :deep(.el-input__wrapper) {
  background: var(--el-fill-color-darker);
  border-color: var(--el-border-color);
}

html.dark .sort-select :deep(.el-input__wrapper) {
  background: var(--el-fill-color-darker);
  border-color: var(--el-border-color);
}

.email-item.selected:hover {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

@keyframes selectPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* 隐藏默认的checkbox，使用整个卡片作为点击区域 */
.email-item :deep(.el-checkbox) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.email-item :deep(.el-checkbox__input) {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  z-index: 1;
}

.email-item :deep(.el-checkbox__inner) {
  border-radius: 4px;
  width: 16px;
  height: 16px;
}

.email-item :deep(.el-checkbox__label) {
  flex: 1;
  padding-left: 0;
  width: 100%;
}

/* 邮箱内容区域 */
.email-item-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  justify-content: space-between;
}

.email-address {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.email-address .email-icon {
  font-size: 16px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.email-text {
  flex: 1;
  line-height: 1.3;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 统计信息 - 横向紧凑布局 */
.email-stats {
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: center;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-item svg {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

/* 空状态提示 */
.empty-tip {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
}

/* 分页样式优化 */
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

/* 限制控制样式 */
.limit-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.unit-text {
  color: #606266;
  font-size: 14px;
  margin-left: 8px;
}

/* 模板选择器容器样式 */
.template-selector-container {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.template-select {
  flex: 1;
  min-width: 0; /* 允许flex项目收缩 */
}

.manage-template-btn {
  flex-shrink: 0; /* 防止按钮被压缩 */
  white-space: nowrap;
}

/* 修复所有复选框的对齐问题 */
:deep(.el-checkbox) {
  display: flex;
  align-items: center;
}

:deep(.el-checkbox__input) {
  display: flex;
  align-items: center;
}

:deep(.el-checkbox__inner) {
  border-radius: 4px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-checkbox__label) {
  display: flex;
  align-items: center;
  line-height: 1.4;
}

/* 批量输入头部样式 */
.batch-input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

.batch-input-title {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

/* 随机生成对话框样式 */
.random-generator-content {
  padding: 20px 0;
}

.random-generator-content :deep(.el-form-item) {
  margin-bottom: 20px;
}

.random-generator-content :deep(.el-form-item__label) {
  font-weight: 500;
}

/* 公告编辑器样式 */
.announcement-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.announcement-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.announcement-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 上传区域样式 */
.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 48px;
  color: #909399;
}

.upload-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #606266;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

/* 图片列表样式 */
.images-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.image-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.image-preview {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  background-color: #fff;
  border: 1px solid #dcdfe6;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-info {
  flex: 1;
  min-width: 0;
}

.image-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* 预览抽屉样式 */
.announcement-preview-drawer {
  :deep(.el-drawer__header) {
    border-bottom: 1px solid #ebeef5;
  }
}

.preview-content {
  padding: 20px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
  max-height: 600px;
  overflow-y: auto;
}

.preview-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #333;
}

.preview-images-carousel {
  margin-bottom: 20px;
}

.carousel {
  border-radius: 8px;
  overflow: hidden;
  background: #f5f7fa;
}

.carousel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: #f5f7fa;
}

.carousel-item img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 4px;
}

.image-caption {
  margin-top: 12px;
  font-size: 14px;
  color: #606266;
  text-align: center;
  padding: 0 12px;
}

.carousel-info {
  text-align: center;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

.preview-text {
  white-space: pre-wrap;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.preview-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

/* 移动端优化 */
@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 95vw !important;
    max-width: 95vw;
  }

  :deep(.el-dialog__body) {
    padding: 12px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }

  /* 公告编辑器移动端优化 */
  .announcement-editor {
    gap: 10px;
  }

  .announcement-section {
    gap: 4px;
  }

  .section-label {
    font-size: 12px;
  }

  .upload-area {
    padding: 20px 12px;
    border-radius: 4px;
  }

  .upload-icon {
    font-size: 24px;
  }

  .upload-text {
    font-size: 12px;
    gap: 2px;
  }

  .upload-hint {
    font-size: 10px;
  }

  .images-list {
    gap: 6px;
  }

  .image-item {
    gap: 6px;
    padding: 6px;
  }

  .image-preview {
    width: 50px;
    height: 50px;
  }

  .image-actions {
    gap: 0;
  }

  .image-actions .el-button {
    padding: 4px 6px;
  }

  /* 预览抽屉移动端优化 */
  .announcement-preview-drawer {
    :deep(.el-drawer) {
      width: 100% !important;
    }

    :deep(.el-drawer__body) {
      padding: 12px;
    }
  }

  .preview-content {
    padding: 12px;
    max-height: calc(100vh - 150px);
    font-size: 13px;
  }

  .preview-title {
    font-size: 16px;
    margin-bottom: 12px;
  }

  .preview-images-carousel {
    margin-bottom: 12px;
  }

  .carousel-item {
    min-height: 200px;

    img {
      max-height: 250px;
    }

    .image-caption {
      margin-top: 6px;
      font-size: 12px;
      padding: 0 6px;
    }
  }

  .carousel-info {
    font-size: 10px;
    margin-top: 4px;
  }

  .preview-text {
    padding: 8px;
    font-size: 12px;
    line-height: 1.5;
  }

  /* 表单字段移动端优化 */
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
  }

  :deep(.el-input__wrapper) {
    padding: 4px 8px;
  }

  :deep(.el-input) {
    font-size: 13px;
  }

  :deep(.el-textarea__inner) {
    font-size: 13px;
    padding: 6px 8px;
  }

  :deep(.el-button) {
    padding: 6px 12px;
    font-size: 13px;
    min-height: 32px;
  }

  :deep(.el-button--primary) {
    width: 100%;
  }

  /* 对话框底部按钮 */
  .dialog-footer {
    flex-direction: column;
    gap: 8px;

    .el-button {
      width: 100%;
    }
  }
}

@media (max-width: 480px) {
  :deep(.el-dialog) {
    width: 100vw !important;
    max-width: 100vw;
    margin: 0 !important;
  }

  :deep(.el-dialog__header) {
    padding: 12px;
  }

  :deep(.el-dialog__title) {
    font-size: 14px;
  }

  :deep(.el-dialog__close) {
    font-size: 16px;
  }

  .upload-area {
    padding: 16px 8px;
  }

  .image-preview {
    width: 40px;
    height: 40px;
  }

  .preview-content {
    padding: 8px;
    font-size: 12px;
  }

  .preview-title {
    font-size: 14px;
  }

  .carousel-item {
    min-height: 150px;

    img {
      max-height: 200px;
    }
  }
}
</style>
