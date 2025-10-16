/**
 * 安全存储包装器
 * 解决localStorage频繁操作导致的"Storage access denied"错误
 * 支持Storage Access API和多级降级策略
 */

// 内存存储降级方案
const memoryStorage = new Map()

/**
 * 检查Storage Access API支持
 */
async function checkStorageAccess() {
  if (typeof document !== 'undefined' && document.hasStorageAccess) {
    try {
      const hasAccess = await document.hasStorageAccess()
      if (!hasAccess) {
        await document.requestStorageAccess()
      }
      return true
    } catch (error) {
      console.warn('Storage Access API failed:', error)
      return false
    }
  }
  return true // 假设支持，如果不支持API
}

/**
 * 安全的localStorage操作包装器
 */
class SafeStorage {
  constructor() {
    this.storageType = 'localStorage' // 当前使用的存储类型
    this.isAvailable = this.checkAvailability()
  }

  /**
   * 检查存储可用性
   */
  checkAvailability() {
    try {
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (error) {
      console.warn('localStorage not available, falling back to sessionStorage')
      this.storageType = 'sessionStorage'
      
      try {
        const testKey = '__storage_test__'
        sessionStorage.setItem(testKey, 'test')
        sessionStorage.removeItem(testKey)
        return true
      } catch (sessionError) {
        console.warn('sessionStorage not available, falling back to memory storage')
        this.storageType = 'memory'
        return true
      }
    }
  }

  /**
   * 安全设置存储项
   */
  async setItem(key, value) {
    // 检查Storage Access API
    await checkStorageAccess()
    
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    
    try {
      switch (this.storageType) {
        case 'localStorage':
          localStorage.setItem(key, stringValue)
          break
        case 'sessionStorage':
          sessionStorage.setItem(key, stringValue)
          break
        case 'memory':
          memoryStorage.set(key, stringValue)
          break
      }
      return true
    } catch (error) {
      return this.handleStorageError(error, key, stringValue)
    }
  }

  /**
   * 安全获取存储项
   */
  getItem(key) {
    try {
      switch (this.storageType) {
        case 'localStorage':
          return localStorage.getItem(key)
        case 'sessionStorage':
          return sessionStorage.getItem(key)
        case 'memory':
          return memoryStorage.get(key) || null
        default:
          return null
      }
    } catch (error) {
      console.warn(`Failed to get item ${key}:`, error)
      return null
    }
  }

  /**
   * 安全移除存储项
   */
  removeItem(key) {
    try {
      switch (this.storageType) {
        case 'localStorage':
          localStorage.removeItem(key)
          break
        case 'sessionStorage':
          sessionStorage.removeItem(key)
          break
        case 'memory':
          memoryStorage.delete(key)
          break
      }
      return true
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error)
      return false
    }
  }

  /**
   * 清空存储
   */
  clear() {
    try {
      switch (this.storageType) {
        case 'localStorage':
          localStorage.clear()
          break
        case 'sessionStorage':
          sessionStorage.clear()
          break
        case 'memory':
          memoryStorage.clear()
          break
      }
      return true
    } catch (error) {
      console.warn('Failed to clear storage:', error)
      return false
    }
  }

  /**
   * 处理存储错误
   */
  async handleStorageError(error, key, value) {
    console.warn(`Storage error for key ${key}:`, error)
    
    // 如果是配额错误，尝试清理旧数据
    if (error.name === 'QuotaExceededError') {
      const cleaned = await this.cleanupOldData()
      if (cleaned) {
        // 重试一次
        try {
          switch (this.storageType) {
            case 'localStorage':
              localStorage.setItem(key, value)
              break
            case 'sessionStorage':
              sessionStorage.setItem(key, value)
              break
            case 'memory':
              memoryStorage.set(key, value)
              break
          }
          return true
        } catch (retryError) {
          console.warn('Retry after cleanup failed:', retryError)
        }
      }
      
      // 降级到下一级存储
      return this.fallbackToNextStorage(key, value)
    }
    
    // 其他错误也尝试降级
    return this.fallbackToNextStorage(key, value)
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData() {
    try {
      const storage = this.storageType === 'localStorage' ? localStorage : sessionStorage
      if (this.storageType === 'memory') return false
      
      // 查找带时间戳的缓存数据并清理
      const keysToRemove = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && (key.startsWith('api_cache_') || key.includes('temp_'))) {
          keysToRemove.push(key)
        }
      }
      
      // 移除最多5个旧缓存项
      const removeCount = Math.min(keysToRemove.length, 5)
      for (let i = 0; i < removeCount; i++) {
        storage.removeItem(keysToRemove[i])
      }
      
      return removeCount > 0
    } catch (error) {
      console.warn('Failed to cleanup old data:', error)
      return false
    }
  }

  /**
   * 降级到下一级存储
   */
  async fallbackToNextStorage(key, value) {
    if (this.storageType === 'localStorage') {
      console.warn('Falling back to sessionStorage')
      this.storageType = 'sessionStorage'
      try {
        sessionStorage.setItem(key, value)
        return true
      } catch (error) {
        console.warn('sessionStorage also failed, falling back to memory')
        this.storageType = 'memory'
        memoryStorage.set(key, value)
        return true
      }
    } else if (this.storageType === 'sessionStorage') {
      console.warn('Falling back to memory storage')
      this.storageType = 'memory'
      memoryStorage.set(key, value)
      return true
    }
    
    return false
  }

  /**
   * 获取当前存储类型
   */
  getStorageType() {
    return this.storageType
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo() {
    try {
      let used = 0
      let total = 0
      
      if (this.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
        // 估算已使用空间
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            used += localStorage[key].length + key.length
          }
        }
        total = 5 * 1024 * 1024 // 5MB 估算
      } else if (this.storageType === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
        for (let key in sessionStorage) {
          if (sessionStorage.hasOwnProperty(key)) {
            used += sessionStorage[key].length + key.length
          }
        }
        total = 5 * 1024 * 1024 // 5MB 估算
      } else if (this.storageType === 'memory') {
        for (let [key, value] of memoryStorage) {
          used += value.length + key.length
        }
        total = Infinity // 内存存储理论上无限制
      }
      
      return {
        used,
        total,
        available: total - used,
        usagePercentage: total === Infinity ? 0 : (used / total) * 100
      }
    } catch (error) {
      console.warn('Failed to get storage info:', error)
      return { used: 0, total: 0, available: 0, usagePercentage: 0 }
    }
  }
}

// 创建单例实例
const safeStorage = new SafeStorage()

// 导出兼容localStorage API的接口
export default {
  setItem: (key, value) => safeStorage.setItem(key, value),
  getItem: (key) => safeStorage.getItem(key),
  removeItem: (key) => safeStorage.removeItem(key),
  clear: () => safeStorage.clear(),
  getStorageType: () => safeStorage.getStorageType(),
  getStorageInfo: () => safeStorage.getStorageInfo(),
  
  // 额外的工具方法
  setJSON: async (key, obj) => {
    try {
      return await safeStorage.setItem(key, JSON.stringify(obj))
    } catch (error) {
      console.warn(`Failed to set JSON for key ${key}:`, error)
      return false
    }
  },
  
  getJSON: (key) => {
    try {
      const value = safeStorage.getItem(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.warn(`Failed to parse JSON for key ${key}:`, error)
      return null
    }
  }
}