<template>
  <div class="share-container" @click="handlePageClick">
    <!-- 选项卡布局 -->
    <el-tabs v-model="activeTab" class="share-tabs">
      <!-- 分享管理选项卡 -->
      <el-tab-pane label="分享管理" name="management">
        <!-- 页面头部 - 参考截图的工具栏设计 -->
        <div class="share-header">
          <!-- 搜索栏 -->
          <div class="search-section">
            <el-input
              v-model="searchState.query"
              placeholder="搜索分享名称、目标邮箱、分享令牌..."
              clearable
              @input="handleSearchInput"
              @clear="handleSearchClear"
              class="search-input"
              :loading="searchState.isSearching"
            >
              <template #prefix>
                <el-select
                  v-model="searchState.searchType"
                  @change="handleSearchTypeChange"
                  style="width: 120px"
                  size="small"
                >
                  <el-option label="全部内容" value="all"/>
                  <el-option label="分享名称" value="shareName"/>
                  <el-option label="目标邮箱" value="targetEmail"/>
                  <el-option label="分享令牌" value="shareToken"/>
                </el-select>
              </template>
              <template #suffix>
                <span v-if="searchState.searchResultCount > 0" class="search-result-count">
                  找到 {{ searchState.searchResultCount }} 条结果
                </span>
              </template>
            </el-input>
          </div>

          <!-- 内联高级筛选面板 -->
          <el-collapse-transition>
            <div v-show="showAdvancedFilter" class="advanced-filter-panel">
              <div class="filter-panel-header">
                <div class="filter-title">
                  <Icon icon="material-symbols:filter-list" />
                  <span>高级筛选</span>
                </div>
                <div class="filter-actions">
                  <el-button v-if="hasActiveFilters" type="text" @click="clearAllFilters" class="clear-all-btn">
                    清除全部
                  </el-button>
                  <el-button type="text" @click="showAdvancedFilter = false" class="close-btn">
                    <Icon icon="material-symbols:close" />
                  </el-button>
                </div>
              </div>

              <!-- 已应用筛选标签 -->
              <div v-if="hasActiveFilters" class="applied-filters-section">
                <div class="applied-filters-label">已应用筛选：</div>
                <div class="filter-tags">
                  <el-tag
                    v-for="tag in activeFilterTags"
                    :key="tag.key"
                    closable
                    @close="removeFilter(tag.key)"
                    class="filter-tag"

                  >
                    {{ tag.label }}
                  </el-tag>
                </div>
              </div>

              <!-- 筛选控件网格布局 -->
              <div class="filter-grid">
                <el-row :gutter="24">
                  <!-- 时间筛选列 -->
                  <el-col :xs="24" :sm="12" :md="8" class="filter-column">
                    <div class="filter-group">
                      <h4 class="filter-group-title">时间筛选</h4>

                      <div class="filter-item">
                        <label class="filter-label">创建时间</label>
                        <el-date-picker
                          v-model="filterState.createTimeRange"
                          type="daterange"
                          range-separator="至"
                          start-placeholder="开始日期"
                          end-placeholder="结束日期"
                          format="YYYY-MM-DD"
                          value-format="YYYY-MM-DD"
                          @change="handleFilterChange"
                          style="width: 100%"
                        />
                        <div class="quick-time-buttons">
                          <el-button @click="setQuickTime('today')" class="quick-time-btn">今天</el-button>
                          <el-button @click="setQuickTime('week')" class="quick-time-btn">本周</el-button>
                          <el-button @click="setQuickTime('month')" class="quick-time-btn">本月</el-button>
                          <el-button @click="setQuickTime('30days')" class="quick-time-btn">最近30天</el-button>
                        </div>
                      </div>

                      <div class="filter-item">
                        <label class="filter-label">过期时间</label>
                        <el-date-picker
                          v-model="filterState.expireTimeRange"
                          type="daterange"
                          range-separator="至"
                          start-placeholder="开始日期"
                          end-placeholder="结束日期"
                          format="YYYY-MM-DD"
                          value-format="YYYY-MM-DD"
                          @change="handleFilterChange"
                          style="width: 100%"
                        />
                      </div>
                    </div>
                  </el-col>

                  <!-- 数值范围筛选列 -->
                  <el-col :xs="24" :sm="12" :md="8" class="filter-column">
                    <div class="filter-group">
                      <h4 class="filter-group-title">数值范围</h4>

                      <div class="filter-item">
                        <label class="filter-label">每日访问限制</label>
                        <div class="range-inputs">
                          <el-input-number
                            v-model="filterState.otpLimitRange.min"
                            placeholder="最小值"
                            :min="0"
                            :max="10000"
                            @change="handleFilterChange"
                            style="width: 48%"
                          />
                          <span class="range-separator">-</span>
                          <el-input-number
                            v-model="filterState.otpLimitRange.max"
                            placeholder="最大值"
                            :min="0"
                            :max="10000"
                            @change="handleFilterChange"
                            style="width: 48%"
                          />
                        </div>
                      </div>

                      <div class="filter-item">
                        <label class="filter-label">显示数量限制</label>
                        <div class="range-inputs">
                          <el-input-number
                            v-model="filterState.verificationCodeLimitRange.min"
                            placeholder="最小值"
                            :min="0"
                            :max="1000"
                            @change="handleFilterChange"
                            style="width: 48%"
                          />
                          <span class="range-separator">-</span>
                          <el-input-number
                            v-model="filterState.verificationCodeLimitRange.max"
                            placeholder="最大值"
                            :min="0"
                            :max="1000"
                            @change="handleFilterChange"
                            style="width: 48%"
                          />
                        </div>
                      </div>
                    </div>
                  </el-col>

                  <!-- 状态筛选列 -->
                  <el-col :xs="24" :sm="24" :md="8" class="filter-column">
                    <div class="filter-group">
                      <h4 class="filter-group-title">状态筛选</h4>

                      <div class="filter-item">
                        <label class="filter-label">分享类型</label>
                        <el-checkbox-group v-model="filterState.shareTypes" @change="handleFilterChange" class="checkbox-group">
                          <el-checkbox :label="1">单邮箱分享</el-checkbox>
                          <el-checkbox :label="2">多邮箱分享</el-checkbox>
                        </el-checkbox-group>
                      </div>

                      <div class="filter-item">
                        <label class="filter-label">限制启用状态</label>
                        <div class="checkbox-group">
                          <el-checkbox
                            v-model="filterState.otpLimitEnabled"
                            @change="handleFilterChange"
                            :indeterminate="filterState.otpLimitEnabled === null"
                          >
                            访问限制启用
                          </el-checkbox>
                          <el-checkbox
                            v-model="filterState.verificationCodeLimitEnabled"
                            @change="handleFilterChange"
                            :indeterminate="filterState.verificationCodeLimitEnabled === null"
                          >
                            显示限制启用
                          </el-checkbox>
                        </div>
                      </div>
                    </div>
                  </el-col>
                </el-row>
              </div>

              <!-- 筛选面板底部操作 -->
              <div class="filter-panel-footer">
                <div class="filter-summary">
                  <span v-if="hasActiveFilters">已应用 {{ activeFilterCount }} 个筛选条件</span>
                  <span v-else>未应用任何筛选条件</span>
                </div>
                <div class="filter-footer-actions">
                  <el-button @click="clearAllFilters" :disabled="!hasActiveFilters">重置</el-button>
                  <el-button type="primary" @click="applyFilters">应用筛选</el-button>
                </div>
              </div>
            </div>
          </el-collapse-transition>

          <!-- 状态筛选器 -->
          <div class="filter-section">
            <el-radio-group v-model="filterStatus" @change="loadShareList" size="small">
              <el-radio-button label="">
                全部 <span class="count">({{ stats.total }})</span>
              </el-radio-button>
              <el-radio-button label="active">
                活跃 <span class="count">({{ stats.active }})</span>
              </el-radio-button>
              <el-radio-button label="expired">
                已过期 <span class="count">({{ stats.expired }})</span>
              </el-radio-button>
              <el-radio-button label="disabled">
                已禁用 <span class="count">({{ stats.disabled }})</span>
              </el-radio-button>
            </el-radio-group>
          </div>

          <!-- 批量操作工具栏 - 参考截图的按钮组 -->
          <div class="header-actions">
            <el-button type="primary" @click="showCreateDialog = true" v-perm="'share:create'">
              <Icon icon="material-symbols:share" />
              创建分享
            </el-button>

            <el-divider direction="vertical" />

            <!-- 高级筛选按钮 -->
            <el-button @click="showAdvancedFilter = !showAdvancedFilter" :type="showAdvancedFilter || hasActiveFilters ? 'primary' : 'default'">
              <Icon icon="material-symbols:filter-list" />
              高级筛选
              <el-badge v-if="activeFilterCount > 0" :value="activeFilterCount" class="filter-badge" />
            </el-button>

            <el-divider direction="vertical" />

            <!-- 批量操作按钮组 - 优化为下拉菜单 -->
            <el-dropdown
              @command="handleBatchExtendCommand"
              :disabled="selectedRows.length === 0"
              v-perm="'share:create'"
            >
              <el-button :disabled="selectedRows.length === 0">
                <Icon icon="material-symbols:calendar-add-on" />
                批量延长
                <Icon icon="ep:arrow-down" style="margin-left: 4px" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="7">
                    <Icon icon="material-symbols:calendar-today" />
                    延长 7 天
                  </el-dropdown-item>
                  <el-dropdown-item command="30">
                    <Icon icon="material-symbols:calendar-month" />
                    延长 30 天
                  </el-dropdown-item>
                  <el-dropdown-item command="90">
                    <Icon icon="material-symbols:date-range" />
                    延长 90 天
                  </el-dropdown-item>
                  <el-dropdown-item command="custom" divided>
                    <Icon icon="material-symbols:edit-calendar" />
                    自定义天数...
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-button
              :disabled="selectedRows.length === 0"
              @click="handleBatchDisable"
              type="warning"
              v-perm="'share:delete'"
            >
              <Icon icon="material-symbols:block" />
              批量禁用
            </el-button>

            <el-button
              :disabled="selectedRows.length === 0"
              @click="handleBatchEnable"
              type="success"
              v-perm="'share:create'"
            >
              <Icon icon="material-symbols:check-circle" />
              批量启用
            </el-button>

            <!-- 新增：批量高级设置下拉菜单 -->
            <el-dropdown
              @command="handleBatchSettingsCommand"
              :disabled="selectedRows.length === 0"
              v-perm="'share:create'"
            >
              <el-button :disabled="selectedRows.length === 0" type="info">
                <Icon icon="material-symbols:settings" />
                批量设置
                <Icon icon="ep:arrow-down" style="margin-left: 4px" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="advanced">
                    <Icon icon="material-symbols:tune" />
                    高级参数设置
                  </el-dropdown-item>
                  <el-dropdown-item command="rateLimit">
                    <Icon icon="material-symbols:speed" />
                    频率限制设置
                  </el-dropdown-item>
                  <el-dropdown-item command="emailCount">
                    <Icon icon="material-symbols:mail" />
                    邮件数量限制
                  </el-dropdown-item>
                  <el-dropdown-item command="autoRefresh">
                    <Icon icon="material-symbols:refresh" />
                    自动刷新设置
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-divider direction="vertical" />

            <el-button @click="refreshList">
              <Icon icon="ion:reload" width="18" height="18" />
              刷新
            </el-button>

            <!-- 选中提示 - 增强信息显示 -->
            <span v-if="selectedRows.length > 0" class="selected-tip">
              已选择 <strong>{{ selectedRows.length }}</strong> / {{ shareList.length }} 项
            </span>
          </div>
        </div>

        <!-- 分享列表 - 参考截图的表格设计 -->
        <div class="share-content">
          <el-table
            ref="tableRef"
            :data="groupedShares"
            style="width: 100%"
            v-loading="loading"
            @selection-change="handleSelectionChange"
            @expand-change="handleExpandChange"
            row-key="groupKey"
          >
            <!-- 展开列 - 显示分组内的分享 -->
            <el-table-column type="expand" width="50">
              <template #default="scope">
                <div v-if="scope.row.count > 1" class="group-expand-content">
                  <el-table
                    :data="scope.row.shares"
                    style="width: 100%"
                    :show-header="true"
                    row-key="shareId"
                  >
                    <!-- 状态列 -->
                    <el-table-column label="状态" width="120">
                      <template #default="innerScope">
                        <generic>
                          <generic>{{ innerScope.row.status === 'active' ? '使用中' : innerScope.row.status === 'expired' ? '已过期' : '已禁用' }}</generic>
                          <generic v-if="innerScope.row.daysRemaining !== null">
                            {{ innerScope.row.daysRemaining === 0 ? '今天到期' : `还剩 ${innerScope.row.daysRemaining} 天` }}
                          </generic>
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 分享类型列 -->
                    <el-table-column label="分享类型" width="100">
                      <template #default="innerScope">
                        {{ innerScope.row.shareType === 1 ? '单邮箱分享' : '多邮箱分享' }}
                      </template>
                    </el-table-column>

                    <!-- 目标邮箱列 -->
                    <el-table-column label="目标邮箱" min-width="150">
                      <template #default="innerScope">
                        <generic v-if="innerScope.row.shareType === 1">
                          {{ innerScope.row.targetEmail }}
                        </generic>
                        <generic v-else>
                          <generic>
                            {{ getGroupDisplayName(innerScope.row) }}
                          </generic>
                          <el-button
                            link
                            type="primary"
                            size="small"
                            @click="showAuthorizedEmails(innerScope.row)"
                          >
                            查看详情
                          </el-button>
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 分享名称列 -->
                    <el-table-column prop="shareName" label="分享名称" min-width="150">
                      <template #default="innerScope">
                        <generic
                          :title="innerScope.row.shareName"
                          @click="copyToClipboard(innerScope.row.shareName)"
                          style="cursor: pointer"
                        >
                          {{ innerScope.row.shareName }}
                          <Icon icon="material-symbols:content-copy" style="font-size: 14px; margin-left: 4px" />
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 今日访问列 -->
                    <el-table-column label="今日访问" width="120">
                      <template #default="innerScope">
                        <generic>
                          <el-progress
                            :percentage="innerScope.row.todayAccessCount && innerScope.row.otpLimit ? Math.round((innerScope.row.todayAccessCount / innerScope.row.otpLimit) * 100) : 0"
                            :color="customProgressColor"
                          />
                          <generic style="margin-top: 4px">
                            {{ innerScope.row.todayAccessCount || 0 }} /
                            <generic
                              @click="editOtpLimit(innerScope.row)"
                              style="cursor: pointer; color: #409eff"
                              title="单击编辑每日访问限制"
                            >
                              {{ innerScope.row.otpLimit || 100 }}
                              <Icon icon="material-symbols:edit" style="font-size: 12px; margin-left: 2px" />
                            </generic>
                          </generic>
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 显示限制列 -->
                    <el-table-column label="显示限制" width="120">
                      <template #default="innerScope">
                        <generic
                          @click="editVerificationCodeLimit(innerScope.row)"
                          style="cursor: pointer; color: #409eff"
                          title="单击编辑显示限制"
                        >
                          最多 {{ innerScope.row.verificationCodeLimit || 100 }} 条
                          <Icon icon="material-symbols:edit" style="font-size: 12px; margin-left: 2px" />
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- Token列 -->
                    <el-table-column label="Token令牌" width="120">
                      <template #default="innerScope">
                        <code
                          @click="copyToClipboard(innerScope.row.shareToken)"
                          style="cursor: pointer"
                        >
                          {{ innerScope.row.shareToken.substring(0, 12) }}...
                        </code>
                      </template>
                    </el-table-column>

                    <!-- 创建时间列 -->
                    <el-table-column label="创建时间" width="160">
                      <template #default="innerScope">
                        {{ tzDayjs(innerScope.row.createTime).format('YYYY-MM-DD HH:mm') }}
                      </template>
                    </el-table-column>

                    <!-- 过期时间列 -->
                    <el-table-column label="过期时间" width="160">
                      <template #default="innerScope">
                        <generic
                          @dblclick="editExpireTime(innerScope.row)"
                          style="cursor: pointer; color: #409eff"
                          title="双击编辑过期时间"
                        >
                          {{ tzDayjs(innerScope.row.expireTime).format('YYYY-MM-DD HH:mm') }}
                          <Icon icon="material-symbols:edit" style="font-size: 12px; margin-left: 2px" />
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 分享链接列 -->
                    <el-table-column label="分享链接" min-width="200">
                      <template #default="innerScope">
                        <generic>
                          <a :href="innerScope.row.shareUrl" target="_blank">
                            {{ innerScope.row.shareUrl }}
                          </a>
                          <el-button
                            link
                            type="primary"
                            size="small"
                            @click="copyShareLink(innerScope.row)"
                          >
                            <Icon icon="material-symbols:content-copy" style="font-size: 14px" />
                          </el-button>
                        </generic>
                      </template>
                    </el-table-column>

                    <!-- 操作列 -->
                    <el-table-column label="操作" width="200" align="right" fixed="right">
                      <template #default="innerScope">
                        <el-button
                          size="small"
                          @click="refreshToken(innerScope.row)"
                          v-perm="'share:create'"
                        >
                          <Icon icon="material-symbols:refresh" style="font-size: 14px; margin-right: 4px" />
                          刷新Token
                        </el-button>
                        <el-button
                          size="small"
                          @click="editAdvancedSettings(innerScope.row)"
                          v-perm="'share:create'"
                        >
                          <Icon icon="material-symbols:settings" style="font-size: 14px; margin-right: 4px" />
                          高级设置
                        </el-button>
                        <el-button
                          size="small"
                          @click="showAccessLogs(innerScope.row)"
                        >
                          访问日志
                        </el-button>
                        <el-button
                          type="danger"
                          size="small"
                          @click="handleDeleteShare(innerScope.row)"
                          v-perm="'share:delete'"
                        >
                          <Icon icon="material-symbols:delete" style="font-size: 14px; margin-right: 4px" />
                          删除
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <!-- 多选列 - 参考截图第一列 -->
            <el-table-column type="selection" width="55" />

            <!-- ID列 - 显示分组内最新分享的ID -->
            <el-table-column label="ID" width="80">
              <template #default="scope">
                <div class="group-info">
                  <div class="group-count" v-if="scope.row.count > 1">
                    {{ scope.row.count }}个分享
                  </div>
                  <div class="latest-id">{{ scope.row.latestShare.shareId }}</div>
                </div>
              </template>
            </el-table-column>

            <!-- 状态列 - 显示分组内最新分享的状态 -->
            <el-table-column label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.latestShare)" size="small">
                  {{ getStatusText(scope.row.latestShare) }}
                </el-tag>
                <!-- 剩余天数提示 -->
                <div class="expire-tip" v-if="scope.row.latestShare.daysRemaining !== undefined">
                  {{ getExpireTip(scope.row.latestShare) }}
                </div>
              </template>
            </el-table-column>

            <!-- 分享类型列 - 需求 1-2 -->
            <el-table-column label="分享类型" width="120" align="center">
              <template #default="scope">
                <el-tag
                  :type="scope.row.shareType === 1 ? 'primary' : 'success'"
                  size="small"
                >
                  {{ scope.row.shareType === 1 ? '单邮箱分享' : '多邮箱分享' }}
                </el-tag>
              </template>
            </el-table-column>

            <!-- 目标邮箱 - 需求 3：多邮箱显示优化 -->
            <el-table-column label="目标邮箱" min-width="200">
              <template #default="scope">
                <div v-if="scope.row.shareType === 1" class="email-cell">
                  {{ scope.row.displayName }}
                </div>
                <div v-else class="email-cell multi-email">
                  <span class="email-count">{{ getAuthorizedEmailCount(scope.row.latestShare) }}个授权邮箱</span>
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click="openAuthorizedEmailsDialog(scope.row.latestShare)"
                  >
                    查看详情
                  </el-button>
                </div>
              </template>
            </el-table-column>

            <!-- 分享名称 - 显示分组内最新分享的名称 -->
            <el-table-column label="分享名称" min-width="150">
              <template #default="scope">
                <div 
                  v-if="!scope.row.latestShare.editingName" 
                  @dblclick="startEditName(scope.row.latestShare)"
                  class="editable-cell"
                  :title="scope.row.latestShare.shareName"
                >
                  {{ scope.row.latestShare.shareName }}
                  <Icon icon="material-symbols:edit" class="edit-icon" />
                </div>
                <el-input
                  v-else
                  v-model="scope.row.latestShare.tempShareName"
                  size="small"
                  @blur="saveShareName(scope.row.latestShare)"
                  @keyup.enter="saveShareName(scope.row.latestShare)"
                  @keyup.esc="cancelEditName(scope.row.latestShare)"
                  ref="nameInput"
                  maxlength="100"
                  show-word-limit
                />
              </template>
            </el-table-column>

            <!-- 今日访问统计 - 显示分组内最新分享的访问统计 -->
            <el-table-column label="今日访问" width="170" align="center">
              <template #default="scope">
                <div v-if="scope.row.latestShare.otpLimitEnabled === 1">
                  <el-progress
                    :percentage="getOtpPercentage(scope.row.latestShare)"
                    :color="getProgressColor(scope.row.latestShare)"
                    :stroke-width="12"
                    :show-text="false"
                  />
                  <div class="otp-count">
                    {{ scope.row.latestShare.otpCountDaily || 0 }} /

                    <!-- 查看模式 -->
                    <span
                      v-if="!scope.row.latestShare.editingLimit"
                      @click.stop="startEditLimit(scope.row.latestShare)"
                      class="editable-limit"
                      :title="'单击编辑每日访问限制'"
                    >
                      {{ scope.row.latestShare.otpLimitDaily || 100 }}
                      <Icon
                        icon="material-symbols:edit"
                        class="edit-icon-small"
                      />
                    </span>

                    <!-- 编辑模式 -->
                    <div v-else class="inline-edit-wrapper">
                      <el-input-number
                        v-model="scope.row.latestShare.tempOtpLimit"
                        size="default"
                        :min="1"
                        :max="10000"
                        :loading="scope.row.latestShare.savingLimit"
                        @keyup.enter="saveOtpLimit(scope.row.latestShare)"
                        @keyup.esc="cancelEditLimit(scope.row.latestShare)"
                        ref="limitInput"
                        style="width: 150px;"
                        class="inline-edit-input"
                      />
                      <div class="inline-edit-actions-below">
                        <el-button
                          size="small"
                          @click="cancelEditLimit(scope.row.latestShare)"
                          class="action-btn-below"
                          :icon="''"
                          title="取消编辑 (Esc)"
                        >
                          <Icon icon="material-symbols:close" style="font-size: 14px;" />
                        </el-button>
                        <el-button
                          size="small"
                          type="primary"
                          @click="saveOtpLimit(scope.row.latestShare)"
                          :loading="scope.row.latestShare.savingLimit"
                          class="action-btn-below"
                          :icon="''"
                          title="保存 (Enter)"
                        >
                          <Icon icon="material-symbols:check" style="font-size: 14px;" />
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="limit-disabled">
                  <el-tag type="info" size="small">无限制</el-tag>
                  <div class="otp-count-text">{{ scope.row.latestShare.otpCountDaily || 0 }} 次</div>
                </div>
              </template>
            </el-table-column>

            <!-- 显示限制 - 显示分组内最新分享的显示限制 -->
            <el-table-column label="显示限制" width="140" align="center">
              <template #default="scope">
                <div v-if="scope.row.latestShare.verificationCodeLimitEnabled === 1">
                  <!-- 查看模式 -->
                  <div
                    v-if="!scope.row.latestShare.editingDisplayLimit"
                    class="inline-edit-container"
                    @click.stop="startEditDisplayLimit(scope.row.latestShare)"
                    :title="'单击编辑显示限制'"
                    style="cursor: pointer;"
                  >
                    <el-tag
                      type="success"
                      size="small"
                      class="editable-tag"
                    >
                      最多 {{ scope.row.latestShare.verificationCodeLimit || 100 }} 条
                      <Icon
                        icon="material-symbols:edit"
                        class="edit-icon-small"
                      />
                    </el-tag>
                  </div>

                  <!-- 编辑模式 -->
                  <div v-else class="inline-edit-active">
                    <el-input-number
                      v-model="scope.row.latestShare.tempDisplayLimit"
                      size="default"
                      :min="1"
                      :max="1000"
                      :loading="scope.row.latestShare.savingDisplayLimit"
                      @keyup.enter="saveDisplayLimit(scope.row.latestShare)"
                      @keyup.esc="cancelEditDisplayLimit(scope.row.latestShare)"
                      ref="displayLimitInput"
                      style="width: 150px;"
                      class="inline-edit-input"
                    />
                    <div class="inline-edit-actions-below">
                      <el-button
                        size="small"
                        @click="cancelEditDisplayLimit(scope.row.latestShare)"
                        class="action-btn-below"
                        :icon="''"
                        title="取消编辑 (Esc)"
                      >
                        <Icon icon="material-symbols:close" style="font-size: 14px;" />
                      </el-button>
                      <el-button
                        size="small"
                        type="primary"
                        @click="saveDisplayLimit(scope.row.latestShare)"
                        :loading="scope.row.latestShare.savingDisplayLimit"
                        class="action-btn-below"
                        :icon="''"
                        title="保存 (Enter)"
                      >
                        <Icon icon="material-symbols:check" style="font-size: 14px;" />
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else>
                  <el-tag type="info" size="small">显示全部</el-tag>
                </div>
              </template>
            </el-table-column>

            <!-- Token令牌 - 显示分组内最新分享的token -->
            <el-table-column label="Token令牌" width="150">
              <template #default="scope">
                <el-tooltip :content="scope.row.latestShare.shareToken" placement="top">
                  <code class="token-display">{{ scope.row.latestShare.shareToken?.substring(0, 12) }}...</code>
                </el-tooltip>
              </template>
            </el-table-column>

            <!-- 创建时间 - 显示分组内最新分享的创建时间 -->
            <el-table-column label="创建时间" width="180">
              <template #default="scope">
                {{ tzDayjs(scope.row.latestShare.createTime).format('YYYY-MM-DD HH:mm') }}
              </template>
            </el-table-column>

            <!-- 过期时间 - 显示分组内最新分享的过期时间 -->
            <el-table-column label="过期时间" width="200">
              <template #default="scope">
                <div 
                  v-if="!scope.row.latestShare.editingExpire"
                  @dblclick="startEditExpire(scope.row.latestShare)"
                  class="editable-cell"
                  :class="{'expire-warning': isExpiringSoon(scope.row.latestShare)}"
                  :title="'双击编辑过期时间'"
                >
                  {{ tzDayjs(scope.row.latestShare.expireTime).format('YYYY-MM-DD HH:mm') }}
                  <Icon icon="material-symbols:edit" class="edit-icon" />
                </div>
                <el-date-picker
                  v-else
                  v-model="scope.row.latestShare.tempExpireTime"
                  type="datetime"
                  size="small"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  @blur="saveExpireTime(scope.row.latestShare)"
                  @change="saveExpireTime(scope.row.latestShare)"
                  ref="expireInput"
                  style="width: 180px;"
                  :disabled-date="(date) => date < new Date()"
                />
              </template>
            </el-table-column>

            <!-- 分享链接 - 显示分组内最新分享的链接 -->
            <el-table-column label="分享链接" min-width="280">
              <template #default="scope">
                <div class="share-url-cell">
                  <div class="share-url-container">
                    <a
                      :href="scope.row.latestShare.shareUrl"
                      target="_blank"
                      class="share-url-link"
                      :title="'点击在新标签页中打开分享页面'"
                    >
                      {{ scope.row.latestShare.shareUrl }}
                    </a>
                  </div>
                  <el-button
                    size="small"
                    @click="copyShareUrl(scope.row.latestShare.shareUrl)"
                    class="copy-btn"
                    :title="'复制分享链接'"
                  >
                    <Icon icon="material-symbols:content-copy" />
                  </el-button>
                </div>
              </template>
            </el-table-column>

            <!-- 操作列 - 参考截图的操作按钮 -->
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <!-- 刷新Token按钮 - 对应截图的"更换Token" -->
                <el-button
                  size="small"
                  type="primary"
                  @click="handleRefreshToken(scope.row.latestShare)"
                  v-perm="'share:create'"
                  :icon="Refresh"
                >
                  刷新Token
                </el-button>

                <!-- 编辑高级参数 -->
                <el-button
                  size="small"
                  type="warning"
                  @click="editAdvancedSettings(scope.row.latestShare)"
                  v-perm="'share:create'"
                  :icon="Setting"
                >
                  高级设置
                </el-button>

                <!-- 访问日志 -->
                <el-button
                  size="small"
                  @click="viewAccessLogs(scope.row.latestShare)"
                  v-perm="'share:create'"
                >
                  访问日志
                </el-button>

                <!-- 删除 -->
                <el-button
                  type="danger"
                  size="small"
                  @click="handleDeleteShare(scope.row.latestShare)"
                  v-perm="'share:delete'"
                  :icon="Delete"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 访问日志选项卡 -->
      <el-tab-pane label="访问日志" name="logs">
        <ShareAccessLogs />
      </el-tab-pane>
    </el-tabs>

    <!-- 创建分享对话框 -->
    <ShareCreateDialog
      v-model="showCreateDialog"
      @created="handleShareCreated"
    />

    <!-- 邮箱白名单管理对话框 -->
    <ShareWhitelistDialog
      v-model="showWhitelistDialog"
      @updated="handleWhitelistUpdated"
    />

    <!-- 高级设置编辑对话框 -->
    <ShareAdvancedEditDialog
      v-model="showAdvancedEditDialog"
      :share-data="currentEditShare"
      @updated="handleAdvancedSettingsUpdated"
    />

    <!-- 批量高级设置对话框 -->
    <ShareBatchAdvancedDialog
      v-model="showBatchAdvancedDialog"
      :selected-shares="selectedRows"
      @updated="handleBatchAdvancedSettingsUpdated"
    />

    <!-- 需求 3：授权邮箱列表对话框 -->
    <el-dialog
      v-model="showAuthorizedEmailsDialog"
      title="授权邮箱列表"
      width="500px"
      @close="closeAuthorizedEmailsDialog"
    >
      <div v-if="currentAuthorizedEmailsShare" class="authorized-emails-container">
        <div class="share-info">
          <p><strong>分享名称：</strong>{{ currentAuthorizedEmailsShare.shareName }}</p>
          <p><strong>分享类型：</strong>多邮箱验证分享</p>
          <p><strong>授权邮箱数：</strong>{{ getAuthorizedEmailCount(currentAuthorizedEmailsShare) }}</p>
        </div>
        <div class="emails-list">
          <h4>授权邮箱列表：</h4>
          <div class="email-tags">
            <el-tag
              v-for="(email, index) in getAuthorizedEmails(currentAuthorizedEmailsShare)"
              :key="index"
              closable
              @close="handleRemoveAuthorizedEmail(index)"
              @click="handleCopyAuthorizedEmail(email)"
              class="email-tag"
              style="cursor: pointer;"
              :title="`点击复制: ${email}`"
            >
              {{ email }}
            </el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeAuthorizedEmailsDialog">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 自定义延长天数对话框 -->
    <el-dialog
      v-model="showCustomDaysDialog"
      title="自定义延长天数"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="延长天数">
          <el-input-number
            v-model="customDays"
            :min="1"
            :max="365"
            :step="1"
            placeholder="请输入天数"
          />
          <span style="margin-left: 10px; color: var(--el-text-color-secondary)">天</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCustomDaysDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmCustomExtend">确定</el-button>
      </template>
    </el-dialog>

    <!-- 访问日志对话框 -->
    <ShareAccessLogDialog
      v-model="showAccessLogDialog"
      :share-data="currentAccessLogShare"
      @closed="currentAccessLogShare = null"
    />

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { Refresh, Delete, Setting } from '@element-plus/icons-vue';
import { tzDayjs } from '@/utils/day.js';
import { copyTextWithFeedback } from '@/utils/clipboard-utils.js';
import {
  getShareList,
  deleteShare,
  refreshShareToken,
  batchOperateShares,
  updateShareName,
  updateShareLimit,
  updateShareExpireTime,
  updateShareDisplayLimit
} from '@/request/share.js';
import ShareCreateDialog from '@/components/share/ShareCreateDialog.vue';
import ShareAdvancedEditDialog from '@/components/share/ShareAdvancedEditDialog.vue';
import ShareBatchAdvancedDialog from '@/components/share/ShareBatchAdvancedDialog.vue';
import ShareWhitelistDialog from '@/components/share/ShareWhitelistDialog.vue';
import ShareAccessLogs from '@/components/share/ShareAccessLogs.vue';
import ShareAccessLogDialog from '@/components/share/ShareAccessLogDialog.vue';

defineOptions({
  name: 'share-mvp'
});

// 响应式数据
const loading = ref(false);
const shareList = ref([]);
const selectedRows = ref([]);
const showCreateDialog = ref(false);
const showWhitelistDialog = ref(false);
const showCustomDaysDialog = ref(false);
const customDays = ref(7);
const activeTab = ref('management');
const showAdvancedEditDialog = ref(false);
const currentEditShare = ref(null);
const showBatchAdvancedDialog = ref(false);
const showAccessLogDialog = ref(false);
const currentAccessLogShare = ref(null);

// 需求 3：授权邮箱列表对话框
const showAuthorizedEmailsDialog = ref(false);
const currentAuthorizedEmailsShare = ref(null);

// 需求 4：分组显示功能
const groupExpandedState = reactive(new Map()); // 存储分组的展开/折叠状态

// Table ref for Element Plus API access
const tableRef = ref();
const filterStatus = ref(''); // '', 'active', 'expired', 'disabled'

// 搜索状态管理（基于all-email页面的成功模式）
const searchState = reactive({
  query: '',
  searchType: 'all', // 'all', 'shareName', 'targetEmail', 'shareToken'
  isSearching: false,
  searchResultCount: 0,
  debounceTimer: null
});

// 高级筛选状态管理
const showAdvancedFilter = ref(false);
const filterState = reactive({
  createTimeRange: null, // [startDate, endDate]
  expireTimeRange: null,
  otpLimitRange: { min: null, max: null },
  verificationCodeLimitRange: { min: null, max: null },
  shareTypes: [], // [1, 2]
  otpLimitEnabled: null, // null=不筛选, true=启用, false=禁用
  verificationCodeLimitEnabled: null,
  filterDebounceTimer: null
});

// 统计数据
const stats = reactive({
  total: 0,
  active: 0,
  expired: 0,
  disabled: 0
});

// 筛选相关计算属性
const hasActiveFilters = computed(() => {
  return !!(
    filterState.createTimeRange ||
    filterState.expireTimeRange ||
    filterState.otpLimitRange.min !== null ||
    filterState.otpLimitRange.max !== null ||
    filterState.verificationCodeLimitRange.min !== null ||
    filterState.verificationCodeLimitRange.max !== null ||
    filterState.shareTypes.length > 0 ||
    filterState.otpLimitEnabled !== null ||
    filterState.verificationCodeLimitEnabled !== null
  );
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (filterState.createTimeRange) count++;
  if (filterState.expireTimeRange) count++;
  if (filterState.otpLimitRange.min !== null || filterState.otpLimitRange.max !== null) count++;
  if (filterState.verificationCodeLimitRange.min !== null || filterState.verificationCodeLimitRange.max !== null) count++;
  if (filterState.shareTypes.length > 0) count++;
  if (filterState.otpLimitEnabled !== null) count++;
  if (filterState.verificationCodeLimitEnabled !== null) count++;
  return count;
});

const activeFilterTags = computed(() => {
  const tags = [];

  if (filterState.createTimeRange) {
    tags.push({
      key: 'createTimeRange',
      label: `创建时间: ${filterState.createTimeRange[0]} 至 ${filterState.createTimeRange[1]}`
    });
  }

  if (filterState.expireTimeRange) {
    tags.push({
      key: 'expireTimeRange',
      label: `过期时间: ${filterState.expireTimeRange[0]} 至 ${filterState.expireTimeRange[1]}`
    });
  }

  if (filterState.otpLimitRange.min !== null || filterState.otpLimitRange.max !== null) {
    const min = filterState.otpLimitRange.min || '不限';
    const max = filterState.otpLimitRange.max || '不限';
    tags.push({
      key: 'otpLimitRange',
      label: `访问限制: ${min} - ${max}`
    });
  }

  if (filterState.verificationCodeLimitRange.min !== null || filterState.verificationCodeLimitRange.max !== null) {
    const min = filterState.verificationCodeLimitRange.min || '不限';
    const max = filterState.verificationCodeLimitRange.max || '不限';
    tags.push({
      key: 'verificationCodeLimitRange',
      label: `显示限制: ${min} - ${max}`
    });
  }

  if (filterState.shareTypes.length > 0) {
    const typeLabels = filterState.shareTypes.map(type => type === 1 ? '单邮箱' : '多邮箱');
    tags.push({
      key: 'shareTypes',
      label: `分享类型: ${typeLabels.join(', ')}`
    });
  }

  if (filterState.otpLimitEnabled !== null) {
    tags.push({
      key: 'otpLimitEnabled',
      label: `访问限制: ${filterState.otpLimitEnabled ? '启用' : '禁用'}`
    });
  }

  if (filterState.verificationCodeLimitEnabled !== null) {
    tags.push({
      key: 'verificationCodeLimitEnabled',
      label: `显示限制: ${filterState.verificationCodeLimitEnabled ? '启用' : '禁用'}`
    });
  }

  return tags;
});

// 需求 4：分组显示功能 - 标准化邮箱列表用于分组
const normalizeEmails = (emails) => {
  if (!emails) return '';
  try {
    const emailArray = typeof emails === 'string' ? JSON.parse(emails) : emails;
    if (!Array.isArray(emailArray)) return '';
    return JSON.stringify(
      emailArray
        .map(e => (e || '').toLowerCase().trim())
        .filter(e => e)
        .sort()
    );
  } catch {
    return '';
  }
};

// 需求 4：获取分组键
const getGroupKey = (share) => {
  if (share.shareType === 1) {
    return `type1_${share.targetEmail}`;
  } else {
    return `type2_${normalizeEmails(share.authorizedEmails)}`;
  }
};

// 需求 4：获取分组显示名称
const getGroupDisplayName = (share) => {
  if (share.shareType === 1) {
    return share.targetEmail;
  } else {
    try {
      const emails = typeof share.authorizedEmails === 'string'
        ? JSON.parse(share.authorizedEmails)
        : share.authorizedEmails;
      if (!Array.isArray(emails) || emails.length === 0) return '无授权邮箱';
      if (emails.length <= 5) {
        return emails.join(', ');
      } else {
        return `${emails.slice(0, 5).join(', ')} 及其他 ${emails.length - 5} 个邮箱`;
      }
    } catch {
      return '多邮箱分享';
    }
  }
};

// 需求 4：分组计算属性
const groupedShares = computed(() => {
  if (!shareList.value || shareList.value.length === 0) return [];

  const groups = new Map();

  // 按分组键分组
  shareList.value.forEach(share => {
    const key = getGroupKey(share);
    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        shareType: share.shareType,
        displayName: getGroupDisplayName(share),
        shares: [],
        expanded: groupExpandedState.get(key) || false
      });
    }
    groups.get(key).shares.push(share);
  });

  // 对每个分组内的分享按创建时间倒序排列
  groups.forEach(group => {
    group.shares.sort((a, b) =>
      new Date(b.createTime) - new Date(a.createTime)
    );
    group.latestShare = group.shares[0];
    group.count = group.shares.length;
  });

  // 转换为数组并按最新分享时间倒序排列
  return Array.from(groups.values()).sort((a, b) =>
    new Date(b.latestShare.createTime) - new Date(a.latestShare.createTime)
  );
});

// 需求 4：切换分组展开状态
const toggleGroupExpand = (groupKey) => {
  const currentState = groupExpandedState.get(groupKey) || false;
  groupExpandedState.set(groupKey, !currentState);
};

// 页面加载
onMounted(() => {
  loadShareList();
});

// 加载分享列表
const loadShareList = async () => {
  loading.value = true;
  try {
    console.log('Loading share list with filter:', filterStatus.value, 'search:', searchState.query);

    // 构建查询参数
    const params = {
      page: 1,
      pageSize: 100,
      status: filterStatus.value || undefined
    };

    // 添加搜索参数
    if (searchState.query && searchState.query.trim()) {
      params.query = searchState.query.trim();
      params.searchType = searchState.searchType;
    }

    // 添加高级筛选参数
    if (hasActiveFilters.value) {
      if (filterState.createTimeRange) {
        params.createTimeStart = filterState.createTimeRange[0];
        params.createTimeEnd = filterState.createTimeRange[1];
      }

      if (filterState.expireTimeRange) {
        params.expireTimeStart = filterState.expireTimeRange[0];
        params.expireTimeEnd = filterState.expireTimeRange[1];
      }

      if (filterState.otpLimitRange.min !== null) {
        params.otpLimitMin = filterState.otpLimitRange.min;
      }
      if (filterState.otpLimitRange.max !== null) {
        params.otpLimitMax = filterState.otpLimitRange.max;
      }

      if (filterState.verificationCodeLimitRange.min !== null) {
        params.verificationCodeLimitMin = filterState.verificationCodeLimitRange.min;
      }
      if (filterState.verificationCodeLimitRange.max !== null) {
        params.verificationCodeLimitMax = filterState.verificationCodeLimitRange.max;
      }

      if (filterState.shareTypes.length > 0) {
        params.shareTypes = filterState.shareTypes.join(',');
      }

      if (filterState.otpLimitEnabled !== null) {
        params.otpLimitEnabled = filterState.otpLimitEnabled ? 1 : 0;
      }

      if (filterState.verificationCodeLimitEnabled !== null) {
        params.verificationCodeLimitEnabled = filterState.verificationCodeLimitEnabled ? 1 : 0;
      }
    }

    const response = await getShareList(params);

    // 处理响应数据
    let list = [];
    // axios拦截器已经返回data.data，所以response就是data对象
    if (response && response.list) {
      list = response.list;

      // 优先使用后端返回的统计数据
      if (response.stats) {
        stats.total = response.stats.total;
        stats.active = response.stats.active;
        stats.expired = response.stats.expired;
        stats.disabled = response.stats.disabled;
        console.log('Using backend stats:', response.stats);
      }
    } else if (Array.isArray(response)) {
      list = response;
    }

    console.log('Processed share list:', list);

    // 前端计算状态（如果后端未返回）
    list = list.map(item => reactive({
      ...item,
      status: item.status || calculateStatus(item),
      daysRemaining: item.daysRemaining !== undefined
        ? item.daysRemaining
        : calculateDaysRemaining(item),
      // 初始化所有编辑状态属性，确保响应式追踪的完整性
      // 分享名称编辑状态
      editingName: false,
      tempShareName: item.shareName || '',
      // 每日访问限制编辑状态
      editingLimit: false,
      savingLimit: false,
      tempOtpLimit: item.otpLimitDaily || 100,  // 修正：使用 tempOtpLimit 而不是 tempLimit
      // 显示限制编辑状态
      editingDisplayLimit: false,
      savingDisplayLimit: false,
      tempDisplayLimit: item.verificationCodeLimit || 100,
      // 过期时间编辑状态
      editingExpire: false,
      tempExpireTime: item.expireTime || null
    }));

    shareList.value = list;

    // 如果后端没有返回统计数据，使用前端计算（向后兼容）
    if (!response?.stats) {
      updateStats(list);
    }

    // 更新搜索结果计数
    searchState.searchResultCount = list.length;
  } catch (error) {
    console.error('Load share list error:', error);
    ElMessage.error(`加载分享列表失败: ${error.message || '未知错误'}`);
    searchState.searchResultCount = 0;
  } finally {
    loading.value = false;
  }
};

// 计算状态（前端逻辑，后端应该返回）
const calculateStatus = (share) => {
  if (share.isActive === 0) return 'disabled';
  if (tzDayjs().isAfter(tzDayjs(share.expireTime))) return 'expired';
  return 'active';
};

// 计算剩余天数
const calculateDaysRemaining = (share) => {
  const now = tzDayjs();
  const expire = tzDayjs(share.expireTime);
  return expire.diff(now, 'day');
};

// 更新统计数据
const updateStats = (list) => {
  stats.total = list.length;
  stats.active = list.filter(item => item.status === 'active').length;
  stats.expired = list.filter(item => item.status === 'expired').length;
  stats.disabled = list.filter(item => item.status === 'disabled').length;
};

// 获取状态显示文本
const getStatusText = (row) => {
  const statusMap = {
    'active': '使用中',
    'expired': '已过期',
    'disabled': '已禁用'
  };
  return statusMap[row.status] || '未知';
};

// 获取状态标签类型
const getStatusType = (row) => {
  const typeMap = {
    'active': 'success',
    'expired': 'danger',
    'disabled': 'info'
  };
  return typeMap[row.status] || 'warning';
};

// 获取过期提示
const getExpireTip = (row) => {
  if (row.status === 'expired') {
    return '已过期';
  }
  if (row.daysRemaining <= 0) {
    return '今天到期';
  }
  if (row.daysRemaining <= 3) {
    return `还剩 ${row.daysRemaining} 天`;
  }
  return '';
};

// 判断是否即将过期
const isExpiringSoon = (row) => {
  return row.status === 'active' && row.daysRemaining <= 3;
};

// 获取每日邮件百分比
const getOtpPercentage = (row) => {
  const daily = row.otp_count_daily || 0;
  const limit = row.otp_limit_daily || 100;
  return Math.min((daily / limit) * 100, 100);
};

// 获取进度条颜色
const getProgressColor = (row) => {
  const percentage = getOtpPercentage(row);
  if (percentage >= 90) return '#f56c6c'; // 红色
  if (percentage >= 70) return '#e6a23c'; // 橙色
  return '#67c23a'; // 绿色
};

// 需求 3：获取授权邮箱数量
const getAuthorizedEmailCount = (row) => {
  if (row.shareType !== 2 || !row.authorizedEmails) {
    return 0;
  }
  try {
    const emails = typeof row.authorizedEmails === 'string'
      ? JSON.parse(row.authorizedEmails)
      : row.authorizedEmails;
    return Array.isArray(emails) ? emails.length : 0;
  } catch (error) {
    console.error('解析授权邮箱列表失败:', error);
    return 0;
  }
};

// 需求 3：显示授权邮箱列表对话框
const openAuthorizedEmailsDialog = (row) => {
  currentAuthorizedEmailsShare.value = row;
  showAuthorizedEmailsDialog.value = true;
};

// 需求 3：关闭授权邮箱列表对话框
const closeAuthorizedEmailsDialog = () => {
  showAuthorizedEmailsDialog.value = false;
  currentAuthorizedEmailsShare.value = null;
};

// 需求 3：获取授权邮箱列表
const getAuthorizedEmails = (row) => {
  if (!row.authorizedEmails) {
    return [];
  }
  try {
    const emails = typeof row.authorizedEmails === 'string'
      ? JSON.parse(row.authorizedEmails)
      : row.authorizedEmails;
    return Array.isArray(emails) ? emails : [];
  } catch (error) {
    console.error('解析授权邮箱列表失败:', error);
    return [];
  }
};

// 需求 3：移除授权邮箱（仅在对话框中显示，不实际删除）
const handleRemoveAuthorizedEmail = (index) => {
  ElMessage.info('如需修改授权邮箱，请使用高级设置功能');
};

// Fix P1-52: 需求 3：复制授权邮箱地址
const handleCopyAuthorizedEmail = (email) => {
  if (!email) return;

  navigator.clipboard.writeText(email).then(() => {
    ElMessage.success(`已复制邮箱: ${email}`);
  }).catch(() => {
    ElMessage.error('复制失败，请重试');
  });
};

// 搜索处理函数（基于all-email页面的300ms防抖模式）
const handleSearchInput = (value) => {
  if (searchState.debounceTimer) {
    clearTimeout(searchState.debounceTimer);
  }

  if (!value || value.trim() === '') {
    handleSearchClear();
    return;
  }

  searchState.isSearching = true;

  searchState.debounceTimer = setTimeout(() => {
    performSearch();
    searchState.isSearching = false;
  }, 300);
};

// 执行搜索
const performSearch = () => {
  loadShareList();
};

// 清除搜索
const handleSearchClear = () => {
  searchState.query = '';
  searchState.searchResultCount = 0;
  searchState.isSearching = false;
  if (searchState.debounceTimer) {
    clearTimeout(searchState.debounceTimer);
  }
  loadShareList();
};

// 搜索类型变更
const handleSearchTypeChange = () => {
  if (searchState.query && searchState.query.trim()) {
    performSearch();
  }
};

// 筛选处理函数
const handleFilterChange = () => {
  if (filterState.filterDebounceTimer) {
    clearTimeout(filterState.filterDebounceTimer);
  }

  filterState.filterDebounceTimer = setTimeout(() => {
    loadShareList();
  }, 300);
};

// 快速时间设置
const setQuickTime = (type) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (type) {
    case 'today':
      filterState.createTimeRange = [
        today.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      ];
      break;
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      filterState.createTimeRange = [
        weekStart.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      ];
      break;
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      filterState.createTimeRange = [
        monthStart.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      ];
      break;
    case '30days':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      filterState.createTimeRange = [
        thirtyDaysAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      ];
      break;
  }
  handleFilterChange();
};

// 移除单个筛选
const removeFilter = (filterKey) => {
  switch (filterKey) {
    case 'createTimeRange':
      filterState.createTimeRange = null;
      break;
    case 'expireTimeRange':
      filterState.expireTimeRange = null;
      break;
    case 'otpLimitRange':
      filterState.otpLimitRange = { min: null, max: null };
      break;
    case 'verificationCodeLimitRange':
      filterState.verificationCodeLimitRange = { min: null, max: null };
      break;
    case 'shareTypes':
      filterState.shareTypes = [];
      break;
    case 'otpLimitEnabled':
      filterState.otpLimitEnabled = null;
      break;
    case 'verificationCodeLimitEnabled':
      filterState.verificationCodeLimitEnabled = null;
      break;
  }
  handleFilterChange();
};

// 清除所有筛选
const clearAllFilters = () => {
  filterState.createTimeRange = null;
  filterState.expireTimeRange = null;
  filterState.otpLimitRange = { min: null, max: null };
  filterState.verificationCodeLimitRange = { min: null, max: null };
  filterState.shareTypes = [];
  filterState.otpLimitEnabled = null;
  filterState.verificationCodeLimitEnabled = null;
  handleFilterChange();
};

// 应用筛选
const applyFilters = () => {
  loadShareList();
};

// 刷新列表
const refreshList = () => {
  loadShareList();
};

// 复制分享链接
const copyShareUrl = (url) => {
  copyTextWithFeedback(url, {
    successMessage: '分享链接已复制到剪贴板',
    errorMessage: '复制失败，请重试'
  });
};

// 防抖函数 - 用于展开行时的滚动优化
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 处理展开行变更 - 展开时向下滚动到展开行
const handleExpandChange = (row, expandedRows) => {
  if (expandedRows.length > 0) {
    // 使用防抖延迟滚动，确保DOM已更新
    const scrollToExpandedRow = debounce(() => {
      nextTick(() => {
        const tableBody = document.querySelector('.el-table__body-wrapper');
        if (tableBody && row) {
          // 找到展开行对应的DOM元素
          const expandedRow = document.querySelector(`[data-key="${row.groupKey}"]`);
          if (expandedRow) {
            // 计算滚动位置，使展开行的内容在视口中间
            const rowTop = expandedRow.offsetTop;
            const rowHeight = expandedRow.offsetHeight;
            const viewportHeight = tableBody.clientHeight;
            const scrollTop = rowTop + rowHeight - viewportHeight / 2;

            // 平滑滚动到展开行
            tableBody.scrollTo({
              top: Math.max(0, scrollTop),
              behavior: 'smooth'
            });
          }
        }
      });
    }, 100);

    scrollToExpandedRow();
  }
};

// 处理选择变更
const handleSelectionChange = (selection) => {
  selectedRows.value = selection;
};

// 计算是否全选状态
const isAllSelected = computed(() => {
  return shareList.value.length > 0 && selectedRows.value.length === shareList.value.length;
});

// 全选/取消全选功能
const toggleSelectAll = () => {
  if (!tableRef.value) return;
  
  if (isAllSelected.value) {
    // 取消全选
    tableRef.value.clearSelection();
  } else {
    // 全选当前页面所有行
    shareList.value.forEach(row => {
      tableRef.value.toggleRowSelection(row, true);
    });
  }
};

// 刷新Token
const handleRefreshToken = async (share) => {
  try {
    await ElMessageBox.confirm(
      `确定要刷新"${share.shareName}"的Token吗？刷新后旧的分享链接将失效！`,
      '确认刷新Token',
      {
        type: 'warning',
        confirmButtonText: '确认刷新',
        cancelButtonText: '取消'
      }
    );

    const result = await refreshShareToken(share.shareId);
    const responseData = result.data || result;

    ElMessage.success('Token刷新成功，新链接已生成');

    // 自动复制新链接
    if (responseData.shareUrl) {
      copyShareUrl(responseData.shareUrl);
    }

    // 立即更新表格中的数据，而不是重新加载整个列表
    const index = shareList.value.findIndex(item => item.shareId === share.shareId);
    if (index !== -1) {
      shareList.value[index].shareToken = responseData.shareToken;
      shareList.value[index].shareUrl = responseData.shareUrl;
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Refresh token error:', error);
      ElMessage.error('刷新Token失败');
    }
  }
};

// 处理批量延长下拉菜单命令
const handleBatchExtendCommand = (command) => {
  if (command === 'custom') {
    // 显示自定义天数对话框
    customDays.value = 7;
    showCustomDaysDialog.value = true;
  } else {
    // 直接延长指定天数
    handleBatchExtend(parseInt(command));
  }
};

// 处理批量设置下拉菜单命令
const handleBatchSettingsCommand = (command) => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要修改的分享链接');
    return;
  }

  switch (command) {
    case 'advanced':
      // 显示批量高级设置对话框
      showBatchAdvancedDialog.value = true;
      break;
    case 'rateLimit':
      // 快速设置频率限制
      handleQuickRateLimit();
      break;
    case 'emailCount':
      // 快速设置邮件数量限制
      handleQuickEmailCount();
      break;
    case 'autoRefresh':
      // 快速设置自动刷新
      handleQuickAutoRefresh();
      break;
    default:
      showBatchAdvancedDialog.value = true;
  }
};

// 确认自定义延长
const confirmCustomExtend = () => {
  if (customDays.value < 1 || customDays.value > 365) {
    ElMessage.warning('请输入1-365之间的天数');
    return;
  }
  showCustomDaysDialog.value = false;
  handleBatchExtend(customDays.value);
};

// 批量延长有效期
const handleBatchExtend = async (days) => {
  if (selectedRows.value.length === 0) return;

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #409EFF;">批量延长操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>延长 ${selectedRows.value.length} 个分享的有效期</p>
  <p style="margin: 8px 0;"><strong>延长时间：</strong>${days} 天</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的过期时间将延后 ${days} 天</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #f5f7fa; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #909399; font-size: 12px;">
    💡 提示：此操作可以撤销，您可以随时调整分享的有效期
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量延长',
      {
        type: 'info',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `延长 ${days} 天`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('extend', shareIds, { extendDays: days });

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功延长 ${affectedCount} 个分享的有效期`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch extend error:', error);
      ElMessage.error('批量延长失败');
    }
  }
};

// 批量禁用
const handleBatchDisable = async () => {
  if (selectedRows.value.length === 0) return;

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #E6A23C;">批量禁用操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>禁用 ${selectedRows.value.length} 个分享</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的访问链接将立即失效</p>
  <p style="margin: 8px 0;"><strong>用户影响：</strong>访问者将无法通过分享链接查看邮件</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #fdf6ec; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #E6A23C; font-size: 12px;">
    ⚠️ 注意：禁用后可以重新启用，但访问者需要重新获取链接
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量禁用',
      {
        type: 'warning',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `禁用 ${selectedRows.value.length} 个分享`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('disable', shareIds);

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功禁用 ${affectedCount} 个分享`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch disable error:', error);
      ElMessage.error('批量禁用失败');
    }
  }
};

// 批量启用
const handleBatchEnable = async () => {
  if (selectedRows.value.length === 0) return;

  // 构建详细的确认信息
  const selectedSharesInfo = selectedRows.value.map(share => 
    `• ID ${share.shareId}: ${share.targetEmail} (${share.shareName || '未命名'})`
  ).join('\n');

  const confirmMessage = `
<div style="text-align: left;">
  <h4 style="margin: 0 0 12px 0; color: #67C23A;">批量启用操作确认</h4>
  <p style="margin: 8px 0;"><strong>操作内容：</strong>启用 ${selectedRows.value.length} 个分享</p>
  <p style="margin: 8px 0;"><strong>操作影响：</strong>所选分享的访问链接将立即生效</p>
  <p style="margin: 8px 0;"><strong>用户影响：</strong>访问者可以通过分享链接查看邮件内容</p>
  
  <details style="margin: 12px 0;">
    <summary style="cursor: pointer; color: #606266;">查看受影响的分享 (${selectedRows.value.length} 项)</summary>
    <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px; font-size: 12px; max-height: 120px; overflow-y: auto;">
      ${selectedSharesInfo}
    </div>
  </details>
  
  <p style="margin: 8px 0 0 0; color: #67C23A; font-size: 12px;">
    ✅ 提示：启用后分享链接将立即可用，请确保内容适合公开访问
  </p>
</div>`;

  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量启用',
      {
        type: 'success',
        dangerouslyUseHTMLString: true,
        confirmButtonText: `启用 ${selectedRows.value.length} 个分享`,
        cancelButtonText: '取消操作'
      }
    );

    const shareIds = selectedRows.value.map(row => row.shareId);
    // Fix: 使用后端返回的实际影响行数
    const result = await batchOperateShares('enable', shareIds);

    // Fix: 等待列表刷新完成后再显示成功消息，确保UI已更新
    await loadShareList();

    // Fix: 使用后端返回的实际数量，而不是前端选中的数量
    const affectedCount = result?.affected || 0;
    ElMessage.success(`成功启用 ${affectedCount} 个邮件分享链接`);

    // Fix: 清空选中项，避免UI状态不一致
    selectedRows.value = [];
    if (tableRef.value) {
      tableRef.value.clearSelection();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Batch enable error:', error);
      ElMessage.error('批量启用失败');
    }
  }
};

// 查看访问日志
const viewAccessLogs = (shareRecord) => {
  currentAccessLogShare.value = shareRecord;
  showAccessLogDialog.value = true;
};

// 删除分享
const handleDeleteShare = async (share) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除分享"${share.shareName}"吗？`,
      '确认删除',
      {
        type: 'warning'
      }
    );

    await deleteShare(share.shareId);
    ElMessage.success('删除成功');
    loadShareList();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Delete share error:', error);
      ElMessage.error('删除失败');
    }
  }
};

// 处理分享创建成功
const handleShareCreated = (results) => {
  loadShareList();
};

// 处理白名单更新
const handleWhitelistUpdated = () => {
  ElMessage.success('邮箱白名单更新成功');
};

// ========== 内联编辑功能 ==========

// 开始编辑分享名称
const startEditName = (row) => {
  row.editingName = true;
  row.tempShareName = row.shareName;
  // 下一帧聚焦输入框
  nextTick(() => {
    const input = document.querySelector(`[data-share-id="${row.shareId}"] .el-input__inner`);
    if (input) input.focus();
  });
};

// 保存分享名称
const saveShareName = async (row) => {
  if (!row.tempShareName || row.tempShareName.trim() === '') {
    ElMessage.warning('分享名称不能为空');
    return;
  }

  if (row.tempShareName.trim() === row.shareName) {
    cancelEditName(row);
    return;
  }

  try {
    await updateShareName(row.shareId, row.tempShareName.trim());
    row.shareName = row.tempShareName.trim();
    row.editingName = false;
    ElMessage.success('分享名称更新成功');
  } catch (error) {
    console.error('Update share name error:', error);
    ElMessage.error('更新分享名称失败');
  }
};

// 取消编辑分享名称
const cancelEditName = (row) => {
  row.editingName = false;
  row.tempShareName = row.shareName;
};

// 开始编辑每日限制
const startEditLimit = (row) => {
  row.editingLimit = true;
  row.tempOtpLimit = row.otpLimitDaily || 100;
  row.savingLimit = false;

  // 下一帧聚焦输入框
  nextTick(() => {
    if (limitInput.value && limitInput.value.focus) {
      limitInput.value.focus();
    }
  });
};

// 保存每日限制
const saveOtpLimit = async (row) => {
  if (!row.tempOtpLimit || row.tempOtpLimit < 1) {
    ElMessage.warning('每日限制必须大于0');
    return;
  }

  if (row.tempOtpLimit === row.otpLimitDaily) {
    cancelEditLimit(row);
    return;
  }

  // 添加加载状态
  row.savingLimit = true;

  try {
    const response = await updateShareLimit(row.shareId, row.tempOtpLimit);

    row.otpLimitDaily = row.tempOtpLimit;
    row.editingLimit = false;
    row.savingLimit = false;
    ElMessage.success('每日限制更新成功');
  } catch (error) {
    row.savingLimit = false;
    console.error('Update limit error:', error);

    // 改进的错误处理
    let errorMessage = '更新每日限制失败';
    if (error.response?.data?.message) {
      errorMessage += ': ' + error.response.data.message;
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }

    ElMessage.error(errorMessage);

    // 保持编辑状态，让用户可以重试
    // row.editingLimit = false; // 注释掉，保持编辑状态
  }
};

// 取消编辑每日限制
const cancelEditLimit = (row) => {
  row.editingLimit = false;
  row.savingLimit = false;
  row.tempOtpLimit = row.otpLimitDaily || 100;
};

// ========== 显示限制内联编辑功能 ==========

// Ref管理 - 简化版本
const limitInput = ref(null);
const displayLimitInput = ref(null);

// 开始编辑显示限制
const startEditDisplayLimit = (row) => {
  row.editingDisplayLimit = true;
  row.tempDisplayLimit = row.verificationCodeLimit || 100;
  row.savingDisplayLimit = false;

  // 下一帧聚焦输入框
  nextTick(() => {
    if (displayLimitInput.value && displayLimitInput.value.focus) {
      displayLimitInput.value.focus();
    }
  });
};

// 保存显示限制
const saveDisplayLimit = async (row) => {
  if (!row.tempDisplayLimit || row.tempDisplayLimit < 1) {
    ElMessage.warning('显示限制必须大于0');
    return;
  }

  if (row.tempDisplayLimit === row.verificationCodeLimit) {
    cancelEditDisplayLimit(row);
    return;
  }

  // 添加加载状态
  row.savingDisplayLimit = true;

  try {
    const response = await updateShareDisplayLimit(row.shareId, row.tempDisplayLimit);

    row.verificationCodeLimit = row.tempDisplayLimit;
    row.editingDisplayLimit = false;
    row.savingDisplayLimit = false;
    ElMessage.success('显示限制更新成功');
  } catch (error) {
    row.savingDisplayLimit = false;
    console.error('Update display limit error:', error);

    // 改进的错误处理
    let errorMessage = '更新显示限制失败';
    if (error.response?.data?.message) {
      errorMessage += ': ' + error.response.data.message;
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    }

    ElMessage.error(errorMessage);

    // 保持编辑状态，让用户可以重试
    // row.editingDisplayLimit = false; // 注释掉，保持编辑状态
  }
};

// 取消编辑显示限制
const cancelEditDisplayLimit = (row) => {
  row.editingDisplayLimit = false;
  row.savingDisplayLimit = false;
  row.tempDisplayLimit = row.verificationCodeLimit || 100;
};

// 处理页面点击事件，触发自动保存
const handlePageClick = (event) => {
  // 检查是否点击在空白区域（不是输入框或按钮）
  const target = event.target;
  const isInputArea = target.closest('.el-input-number') ||
                     target.closest('.el-button') ||
                     target.closest('.el-dialog') ||
                     target.closest('.el-select') ||
                     target.closest('.el-date-picker');

  if (!isInputArea) {
    // 查找当前正在编辑的行并保存
    const editingOtpRow = shareList.value.find(row => row.editingLimit);
    if (editingOtpRow) {
      saveOtpLimit(editingOtpRow);
    }

    const editingDisplayRow = shareList.value.find(row => row.editingDisplayLimit);
    if (editingDisplayRow) {
      saveDisplayLimit(editingDisplayRow);
    }
  }
};

// 编辑高级设置
const editAdvancedSettings = (row) => {
  currentEditShare.value = { ...row };
  showAdvancedEditDialog.value = true;
};

// 处理高级设置更新
const handleAdvancedSettingsUpdated = () => {
  loadShareList();
  ElMessage.success('高级设置更新成功');
};

// 处理批量高级设置更新
const handleBatchAdvancedSettingsUpdated = () => {
  loadShareList();
  // 清空选中项
  selectedRows.value = [];
  if (tableRef.value) {
    tableRef.value.clearSelection();
  }
};

// 快速设置频率限制
const handleQuickRateLimit = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入新的频率限制（格式：每秒次数,自动恢复秒数，如：5,60）',
      '快速设置频率限制',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^\d+,\d+$/,
        inputErrorMessage: '请输入正确格式：数字,数字'
      }
    );

    const [perSecond, recoverySeconds] = value.split(',').map(v => parseInt(v.trim()));

    if (perSecond < 1 || perSecond > 100 || recoverySeconds < 0 || recoverySeconds > 3600) {
      ElMessage.error('频率限制超出范围（每秒1-100，恢复时间0-3600秒）');
      return;
    }

    const shareIds = selectedRows.value.map(share => share.shareId);
    await batchOperateShares('updateAdvancedSettings', shareIds, {
      settings: {
        rateLimitPerSecond: perSecond,
        autoRecoverySeconds: recoverySeconds
      }
    });

    ElMessage.success(`成功设置 ${shareIds.length} 个分享的频率限制`);
    handleBatchAdvancedSettingsUpdated();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Quick rate limit error:', error);
      ElMessage.error('设置频率限制失败');
    }
  }
};

// 快速设置邮件数量限制
const handleQuickEmailCount = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入最新邮件显示数量（1-100，留空表示显示全部）',
      '快速设置邮件数量限制',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^(\d+)?$/,
        inputErrorMessage: '请输入1-100之间的数字或留空'
      }
    );

    const count = value ? parseInt(value) : null;

    if (count !== null && (count < 1 || count > 100)) {
      ElMessage.error('邮件数量必须在1-100之间');
      return;
    }

    const shareIds = selectedRows.value.map(share => share.shareId);
    await batchOperateShares('updateAdvancedSettings', shareIds, {
      settings: {
        latestEmailCount: count
      }
    });

    const message = count ? `成功设置 ${shareIds.length} 个分享显示最新 ${count} 封邮件` : `成功设置 ${shareIds.length} 个分享显示全部邮件`;
    ElMessage.success(message);
    handleBatchAdvancedSettingsUpdated();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Quick email count error:', error);
      ElMessage.error('设置邮件数量限制失败');
    }
  }
};

// 快速设置自动刷新
const handleQuickAutoRefresh = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入自动刷新间隔（秒，10-3600，输入0表示禁用）',
      '快速设置自动刷新',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^\d+$/,
        inputErrorMessage: '请输入数字'
      }
    );

    const interval = parseInt(value);

    if (interval !== 0 && (interval < 10 || interval > 3600)) {
      ElMessage.error('刷新间隔必须在10-3600秒之间，或输入0禁用');
      return;
    }

    const shareIds = selectedRows.value.map(share => share.shareId);
    await batchOperateShares('updateAdvancedSettings', shareIds, {
      settings: {
        autoRefreshEnabled: interval > 0 ? 1 : 0,
        autoRefreshInterval: interval > 0 ? interval : 30
      }
    });

    const message = interval > 0 ?
      `成功设置 ${shareIds.length} 个分享自动刷新间隔为 ${interval} 秒` :
      `成功禁用 ${shareIds.length} 个分享的自动刷新`;
    ElMessage.success(message);
    handleBatchAdvancedSettingsUpdated();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Quick auto refresh error:', error);
      ElMessage.error('设置自动刷新失败');
    }
  }
};

// 开始编辑过期时间
const startEditExpire = (row) => {
  row.editingExpire = true;
  row.tempExpireTime = row.expireTime;
};

// 保存过期时间
const saveExpireTime = async (row) => {
  if (!row.tempExpireTime) {
    ElMessage.warning('过期时间不能为空');
    return;
  }

  if (row.tempExpireTime === row.expireTime) {
    cancelEditExpire(row);
    return;
  }

  // 验证过期时间必须在未来
  const expireDate = new Date(row.tempExpireTime);
  if (expireDate <= new Date()) {
    ElMessage.warning('过期时间必须在未来');
    return;
  }

  try {
    await updateShareExpireTime(row.shareId, row.tempExpireTime);
    row.expireTime = row.tempExpireTime;
    row.editingExpire = false;
    ElMessage.success('过期时间更新成功');
  } catch (error) {
    console.error('Update share expire time error:', error);
    ElMessage.error('更新过期时间失败');
  }
};

// 取消编辑过期时间
const cancelEditExpire = (row) => {
  row.editingExpire = false;
  row.tempExpireTime = row.expireTime;
};
</script>

<style scoped>
.share-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.share-header {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
}

.search-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.search-input {
  width: 100%;
  max-width: 600px;
}

.search-result-count {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-right: 8px;
}

.filter-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-section .count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.selected-tip {
  margin-left: auto;
  color: var(--el-color-primary);
  font-size: 14px;
}

.selected-tip strong {
  font-size: 16px;
}

.share-content {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 20px;
}

.expire-tip {
  font-size: 12px;
  color: var(--el-color-warning);
  margin-top: 4px;
}

.expire-warning {
  color: var(--el-color-danger);
  font-weight: 500;
}

.otp-count {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 4px;
  text-align: center;
}

.token-display {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.share-url-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share-url-container {
  flex: 1;
  overflow: hidden;
}

.share-url-link {
  color: #409eff;
  text-decoration: none;
  font-size: 13px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.share-url-link:hover {
  background-color: #ecf5ff;
  text-decoration: underline;
}

.share-url-input {
  flex: 1;
}

.copy-btn {
  flex-shrink: 0;
}

/* 移动端分享链接优化 */
@media (max-width: 768px) {
  .share-url-cell {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }

  .share-url-container {
    width: 100%;
  }

  .share-url-link {
    font-size: 12px;
    padding: 8px 6px;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    min-height: 32px;
    display: flex;
    align-items: center;
    word-break: break-word;
  }

  .copy-btn {
    width: 100%;
    min-height: 32px;
  }

  :deep(.el-table-column--selection .el-table__cell) {
    padding: 8px 2px;
  }

  :deep(.el-table__cell) {
    padding: 8px 4px;
  }
}

/* 内联编辑样式 */
.editable-cell {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
  display: inline-block;
  min-width: 100px;
}

.editable-cell:hover {
  background-color: var(--el-fill-color-light);
}

.editable-cell .edit-icon {
  opacity: 0;
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
  transition: opacity 0.2s;
}

.editable-cell:hover .edit-icon {
  opacity: 1;
}

.editable-limit {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: all 0.2s;
  position: relative;
  display: inline-block;
}

.editable-limit:hover {
  background-color: var(--el-fill-color-light);
}

.editable-limit .edit-icon-small {
  opacity: 0;
  margin-left: 4px;
  font-size: 10px;
  color: var(--el-color-primary);
  transition: opacity 0.2s;
}

.editable-limit:hover .edit-icon-small {
  opacity: 1;
}

.limit-disabled {
  text-align: center;
}

.otp-count-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* 内联编辑优化样式 - 2025 现代设计 */
.inline-edit-container {
  position: relative;
}

.editable-tag {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.editable-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 编辑模式容器 - 垂直布局设计，居中对齐 */
.inline-edit-active {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  /* 垂直布局，按钮在输入框下方，居中对齐 */
}

.inline-edit-wrapper {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  /* 垂直布局，按钮在输入框下方，居中对齐 */
}

/* 输入框样式 - 简洁设计，通过输入框本身提供视觉反馈 */
.inline-edit-input {
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.inline-edit-input:hover {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1) !important;
}

.inline-edit-input:focus,
.inline-edit-input:focus-within {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15) !important;
}

/* 按钮容器 */
.inline-edit-actions {
  display: flex;
  gap: 6px;
}

.inline-edit-actions-mini {
  display: flex;
  gap: 6px;
  margin-left: 4px;
}

/* 按钮样式 - 简洁扁平化设计 */
.save-btn, .save-btn-mini {
  min-width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.save-btn:hover, .save-btn-mini:hover {
  transform: scale(1.05) !important;
}

.save-btn:active, .save-btn-mini:active {
  transform: scale(0.95) !important;
}

.cancel-btn, .cancel-btn-mini {
  min-width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.cancel-btn:hover, .cancel-btn-mini:hover {
  transform: scale(1.05) !important;
  background-color: var(--el-color-danger-light-9) !important;
  border-color: var(--el-color-danger-light-5) !important;
}

.cancel-btn:active, .cancel-btn-mini:active {
  transform: scale(0.95) !important;
}

/* 输入框下方的按钮容器 - 横向布局，居中对齐 */
.inline-edit-actions-below {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

/* 输入框下方的操作按钮 - 统一样式 */
.action-btn-below {
  min-width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.action-btn-below:hover {
  transform: scale(1.05) !important;
}

.action-btn-below:active {
  transform: scale(0.95) !important;
}

/* 旧样式保留（向后兼容） */
.cancel-btn-below {
  height: 24px !important;
  padding: 0 8px !important;
  font-size: 12px !important;
  color: var(--el-text-color-secondary) !important;
  border: none !important;
  background: transparent !important;
  transition: all 0.2s ease !important;
}

.cancel-btn-below:hover {
  color: var(--el-color-danger) !important;
  background-color: var(--el-color-danger-light-9) !important;
}

.cancel-btn-below:active {
  transform: scale(0.95) !important;
}

/* 加载状态样式 */
.inline-edit-input.is-loading {
  opacity: 0.7;
  cursor: wait;
}

/* 错误状态样式 */
.inline-edit-error {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 4px rgba(245, 108, 108, 0.2) !important;
  animation: shake 0.3s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* 高级筛选样式 */
.filter-badge {
  margin-left: 8px;
}

/* 内联筛选面板样式 */
.advanced-filter-panel {
  margin: 20px 0;
  padding: 32px;
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.advanced-filter-panel:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  border-color: var(--el-color-primary-light-7);
}

.filter-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--el-border-color-lighter);
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.clear-all-btn, .close-btn {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--el-color-primary);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.clear-all-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.close-btn {
  color: var(--el-text-color-secondary);
}

.close-btn:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

/* 已应用筛选标签区域 */
.applied-filters-section {
  margin-bottom: 28px;
  padding: 16px 20px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.applied-filters-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  font-weight: 500;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-tag {
  margin: 0;
  font-size: 13px;
  padding: 6px 12px;
}

/* 筛选控件网格布局 */
.filter-grid {
  margin-bottom: 28px;
}

.filter-column {
  margin-bottom: 24px;
}

.filter-group {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  transition: all 0.2s ease;
}

.filter-group:hover {
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.filter-group-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 12px;
  border-bottom: 2px solid var(--el-color-primary);
  position: relative;
}

.filter-group-title::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 30px;
  height: 2px;
  background: var(--el-color-primary);
  border-radius: 1px;
}

.filter-item {
  margin-bottom: 20px;
}

.filter-item:last-child {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.quick-time-buttons {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.quick-time-btn {
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.quick-time-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-separator {
  color: var(--el-text-color-secondary);
  font-size: 16px;
  font-weight: 600;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 筛选面板底部 */
.filter-panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 2px solid var(--el-border-color-lighter);
  margin-top: 8px;
}

.filter-summary {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.filter-footer-actions {
  display: flex;
  gap: 16px;
}

.filter-footer-actions .el-button {
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.filter-footer-actions .el-button--primary {
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
}

.filter-footer-actions .el-button--primary:hover {
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.4);
  transform: translateY(-1px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .advanced-filter-panel {
    margin: 16px 0;
    padding: 24px;
  }

  .filter-panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
  }

  .filter-actions {
    align-self: flex-end;
  }

  .filter-group {
    padding: 16px;
    margin-bottom: 16px;
  }

  .filter-group-title {
    font-size: 15px;
    margin-bottom: 16px;
  }

  .quick-time-buttons {
    justify-content: space-between;
    gap: 8px;
  }

  .quick-time-btn {
    flex: 1;
    font-size: 12px;
    padding: 8px 6px;
  }

  .range-inputs {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .range-separator {
    text-align: center;
    margin: 8px 0;
    font-size: 14px;
  }

  .filter-panel-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding-top: 20px;
  }

  .filter-summary {
    text-align: center;
    font-size: 13px;
  }

  .filter-footer-actions {
    justify-content: center;
    gap: 12px;
  }

  .filter-footer-actions .el-button {
    flex: 1;
    padding: 12px 16px;
  }
}

/* 选择框优化 - 缩小尺寸 */
:deep(.el-checkbox) {
  /* 设置选择框尺寸为 18x18px（更合适的尺寸） */
  .el-checkbox__input {
    .el-checkbox__inner {
      width: 18px;
      height: 18px;
      border-width: 1px;
    }

    /* 选中状态的对勾图标也需要调整 */
    &.is-checked .el-checkbox__inner::after {
      width: 5px;
      height: 9px;
      left: 5px;
      top: 1px;
    }
  }

  /* 增加 label 与 checkbox 之间的间距 */
  .el-checkbox__label {
    padding-left: 8px;
    font-size: 14px;
  }
}

/* 表格选择框优化 */
:deep(.el-table) {
  .el-checkbox {
    /* 保持合适的可点击区域 */
    .el-checkbox__input {
      padding: 8px;
      margin: -8px;

      .el-checkbox__inner {
        width: 18px;
        height: 18px;
        border-width: 1px;
      }

      &.is-checked .el-checkbox__inner::after {
        width: 5px;
        height: 9px;
        left: 5px;
        top: 1px;
      }
    }
  }

  /* 表头选择框居中对齐 */
  .el-table__header .el-checkbox {
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

/* Hover 和 Focus 状态优化 */
:deep(.el-checkbox__input) {
  &:hover .el-checkbox__inner {
    border-color: var(--el-color-primary);
    transform: scale(1.05);
    transition: all 0.2s ease;
  }
  
  &:focus-within .el-checkbox__inner {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 2px;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  :deep(.el-checkbox) {
    .el-checkbox__input {
      /* 移动端增大到 44x44px */
      .el-checkbox__inner {
        width: 28px;
        height: 28px;
      }

      &.is-checked .el-checkbox__inner::after {
        width: 7px;
        height: 14px;
        left: 9px;
        top: 3px;
      }
    }
  }
}

/* 需求 3：授权邮箱列表对话框样式 */
.authorized-emails-container {
  padding: 16px 0;
}

.share-info {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;

  p {
    margin: 8px 0;
    font-size: 14px;

    strong {
      color: #333;
      margin-right: 8px;
    }
  }
}

.emails-list {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #333;
  }
}

.email-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .email-tag {
    cursor: pointer;
    user-select: none;
  }
}

.email-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  &.multi-email {
    .email-count {
      color: #606266;
      font-size: 14px;
    }
  }
}

/* 需求 4：分组显示样式 */
.group-expand-content {
  padding: 12px 0;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.group-item-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-item-time {
  font-size: 12px;
  color: #909399;
}

.group-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.group-count {
  font-size: 12px;
  color: #409eff;
  font-weight: 500;
}

.latest-id {
  font-size: 14px;
  color: #333;
}
</style>
