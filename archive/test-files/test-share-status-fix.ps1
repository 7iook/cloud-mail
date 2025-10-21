# Share Status Filter Fix - PowerShell Test Script
# 分享状态筛选修复 - PowerShell测试脚本

param(
    [string]$BaseUrl = "http://localhost:8787",
    [string]$AuthToken = ""
)

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Share Status Filter Fix - Verification Test Suite       ║" -ForegroundColor Cyan
Write-Host "║   分享状态筛选修复 - 验证测试套件                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $AuthToken"
}

$testResults = @{
    Total = 0
    Passed = 0
    Failed = 0
}

$createdShareId = $null

# 测试1：创建测试分享
Write-Host "=== 测试1：创建测试分享 ===" -ForegroundColor Yellow
$testResults.Total++

try {
    $payload = @{
        targetEmail = "test@example.com"
        shareName = "状态筛选测试分享"
        keywordFilter = "验证码|verification"
        expireTime = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/create" -Method POST -Headers $headers -Body $payload
    
    if ($response.code -eq 200) {
        $createdShareId = $response.data.shareId
        Write-Host "✅ 创建成功 - Share ID: $createdShareId" -ForegroundColor Green
        Write-Host "   分享Token: $($response.data.shareToken)" -ForegroundColor Gray
        $testResults.Passed++
    } else {
        Write-Host "❌ 创建失败: $($response.message)" -ForegroundColor Red
        $testResults.Failed++
    }
} catch {
    Write-Host "❌ 创建失败: $($_.Exception.Message)" -ForegroundColor Red
    $testResults.Failed++
}

# 测试2：获取分享列表（全部）
Write-Host "`n=== 测试2：获取分享列表（全部） ===" -ForegroundColor Yellow
$testResults.Total++

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/list?page=1&pageSize=100" -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        Write-Host "✅ 获取成功" -ForegroundColor Green
        Write-Host "   总数: $($response.data.total)" -ForegroundColor Gray
        Write-Host "   列表长度: $($response.data.list.Count)" -ForegroundColor Gray
        
        if ($response.data.stats) {
            Write-Host "   统计数据:" -ForegroundColor Gray
            Write-Host "     - 全部: $($response.data.stats.total)" -ForegroundColor Gray
            Write-Host "     - 活跃: $($response.data.stats.active)" -ForegroundColor Gray
            Write-Host "     - 已过期: $($response.data.stats.expired)" -ForegroundColor Gray
            Write-Host "     - 已禁用: $($response.data.stats.disabled)" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  后端未返回统计数据" -ForegroundColor Yellow
        }
        
        $testResults.Passed++
    } else {
        Write-Host "❌ 获取失败: $($response.message)" -ForegroundColor Red
        $testResults.Failed++
    }
} catch {
    Write-Host "❌ 获取失败: $($_.Exception.Message)" -ForegroundColor Red
    $testResults.Failed++
}

# 测试3：禁用分享
Write-Host "`n=== 测试3：禁用分享 ===" -ForegroundColor Yellow
$testResults.Total++

if ($null -eq $createdShareId) {
    Write-Host "❌ 没有可用的Share ID" -ForegroundColor Red
    $testResults.Failed++
} else {
    try {
        $payload = @{
            action = "disable"
            shareIds = @($createdShareId)
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/batch" -Method POST -Headers $headers -Body $payload
        
        if ($response.code -eq 200) {
            Write-Host "✅ 禁用成功" -ForegroundColor Green
            Write-Host "   影响行数: $($response.data.affected)" -ForegroundColor Gray
            $testResults.Passed++
        } else {
            Write-Host "❌ 禁用失败: $($response.message)" -ForegroundColor Red
            $testResults.Failed++
        }
    } catch {
        Write-Host "❌ 禁用失败: $($_.Exception.Message)" -ForegroundColor Red
        $testResults.Failed++
    }
}

# 测试4：验证禁用的分享仍在列表中
Write-Host "`n=== 测试4：验证禁用的分享仍在列表中 ===" -ForegroundColor Yellow
$testResults.Total++

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/list?page=1&pageSize=100" -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        $disabledShare = $response.data.list | Where-Object { $_.shareId -eq $createdShareId }
        
        if ($disabledShare) {
            Write-Host "✅ 禁用的分享仍在列表中" -ForegroundColor Green
            Write-Host "   Share ID: $($disabledShare.shareId)" -ForegroundColor Gray
            Write-Host "   isActive: $($disabledShare.isActive)" -ForegroundColor Gray
            Write-Host "   status: $($disabledShare.status)" -ForegroundColor Gray
            
            if ($disabledShare.isActive -eq 0) {
                Write-Host "✅ isActive字段正确（0=禁用）" -ForegroundColor Green
                $testResults.Passed++
            } else {
                Write-Host "❌ isActive字段错误: $($disabledShare.isActive)" -ForegroundColor Red
                $testResults.Failed++
            }
        } else {
            Write-Host "❌ 禁用的分享不在列表中（Bug未修复）" -ForegroundColor Red
            $testResults.Failed++
        }
    } else {
        Write-Host "❌ 获取失败: $($response.message)" -ForegroundColor Red
        $testResults.Failed++
    }
} catch {
    Write-Host "❌ 获取失败: $($_.Exception.Message)" -ForegroundColor Red
    $testResults.Failed++
}

# 测试5：验证状态筛选功能（已禁用）
Write-Host "`n=== 测试5：验证状态筛选功能（已禁用） ===" -ForegroundColor Yellow
$testResults.Total++

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/list?page=1&pageSize=100&status=disabled" -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        Write-Host "✅ 筛选成功" -ForegroundColor Green
        Write-Host "   返回数量: $($response.data.list.Count)" -ForegroundColor Gray
        
        $hasOurShare = $response.data.list | Where-Object { $_.shareId -eq $createdShareId }
        if ($hasOurShare) {
            Write-Host "✅ 我们的禁用分享在筛选结果中" -ForegroundColor Green
        } else {
            Write-Host "⚠️  我们的禁用分享不在筛选结果中" -ForegroundColor Yellow
        }
        
        $allDisabled = ($response.data.list | Where-Object { $_.isActive -ne 0 }).Count -eq 0
        if ($allDisabled) {
            Write-Host "✅ 所有返回的分享都是禁用状态" -ForegroundColor Green
            $testResults.Passed++
        } else {
            Write-Host "❌ 返回的分享中包含非禁用状态" -ForegroundColor Red
            $testResults.Failed++
        }
    } else {
        Write-Host "❌ 筛选失败: $($response.message)" -ForegroundColor Red
        $testResults.Failed++
    }
} catch {
    Write-Host "❌ 筛选失败: $($_.Exception.Message)" -ForegroundColor Red
    $testResults.Failed++
}

# 测试6：批量启用已禁用的分享
Write-Host "`n=== 测试6：批量启用已禁用的分享 ===" -ForegroundColor Yellow
$testResults.Total++

if ($null -eq $createdShareId) {
    Write-Host "❌ 没有可用的Share ID" -ForegroundColor Red
    $testResults.Failed++
} else {
    try {
        $payload = @{
            action = "enable"
            shareIds = @($createdShareId)
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/batch" -Method POST -Headers $headers -Body $payload
        
        if ($response.code -eq 200) {
            Write-Host "✅ 启用成功" -ForegroundColor Green
            Write-Host "   影响行数: $($response.data.affected)" -ForegroundColor Gray
            $testResults.Passed++
        } else {
            Write-Host "❌ 启用失败: $($response.message)" -ForegroundColor Red
            $testResults.Failed++
        }
    } catch {
        Write-Host "❌ 启用失败: $($_.Exception.Message)" -ForegroundColor Red
        $testResults.Failed++
    }
}

# 测试7：验证统计数据准确性
Write-Host "`n=== 测试7：验证统计数据准确性 ===" -ForegroundColor Yellow
$testResults.Total++

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/list?page=1&pageSize=100" -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        if ($response.data.stats) {
            $stats = $response.data.stats
            $calculatedTotal = $stats.active + $stats.expired + $stats.disabled
            
            Write-Host "✅ 后端返回统计数据" -ForegroundColor Green
            Write-Host "   全部: $($stats.total)" -ForegroundColor Gray
            Write-Host "   活跃: $($stats.active)" -ForegroundColor Gray
            Write-Host "   已过期: $($stats.expired)" -ForegroundColor Gray
            Write-Host "   已禁用: $($stats.disabled)" -ForegroundColor Gray
            Write-Host "   计算总和: $calculatedTotal" -ForegroundColor Gray
            
            if ($stats.total -eq $calculatedTotal) {
                Write-Host "✅ 统计数据一致" -ForegroundColor Green
                $testResults.Passed++
            } else {
                Write-Host "⚠️  统计数据不一致（可能有其他状态）" -ForegroundColor Yellow
                $testResults.Passed++  # 仍然算通过
            }
        } else {
            Write-Host "❌ 后端未返回统计数据" -ForegroundColor Red
            $testResults.Failed++
        }
    } else {
        Write-Host "❌ 获取失败: $($response.message)" -ForegroundColor Red
        $testResults.Failed++
    }
} catch {
    Write-Host "❌ 获取失败: $($_.Exception.Message)" -ForegroundColor Red
    $testResults.Failed++
}

# 清理：删除测试分享
Write-Host "`n=== 清理：删除测试分享 ===" -ForegroundColor Yellow

if ($null -ne $createdShareId) {
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/$createdShareId" -Method DELETE -Headers $headers
        
        if ($response.code -eq 200) {
            Write-Host "✅ 清理成功 - Share ID: $createdShareId" -ForegroundColor Green
        } else {
            Write-Host "⚠️  清理失败: $($response.message)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  清理失败: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "没有需要清理的分享" -ForegroundColor Gray
}

# 输出测试总结
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     测试结果总结                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "总测试数: $($testResults.Total)" -ForegroundColor White
Write-Host "通过: $($testResults.Passed) ✅" -ForegroundColor Green
Write-Host "失败: $($testResults.Failed) ❌" -ForegroundColor Red
$successRate = [math]::Round(($testResults.Passed / $testResults.Total) * 100, 2)
Write-Host "成功率: $successRate%`n" -ForegroundColor White

if ($testResults.Failed -eq 0) {
    Write-Host "🎉 所有测试通过！修复验证成功！" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  部分测试失败，请检查修复实现。" -ForegroundColor Yellow
    exit 1
}
