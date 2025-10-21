# Share Status Filter Fix - Simple Test
param(
    [string]$BaseUrl = "http://localhost:8787",
    [string]$AuthToken = ""
)

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $AuthToken"
}

$passed = 0
$failed = 0
$createdShareId = $null

Write-Host "`n=== Test 1: Create Share ===" -ForegroundColor Yellow

try {
    $payload = @{
        targetEmail = "test@example.com"
        shareName = "Test Share"
        keywordFilter = "code"
        expireTime = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/create" -Method POST -Headers $headers -Body $payload
    
    if ($response.code -eq 200) {
        $createdShareId = $response.data.shareId
        Write-Host "PASS - Created Share ID: $createdShareId" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "FAIL - $($response.message)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n=== Test 2: Get All Shares ===" -ForegroundColor Yellow

try {
    $uri = "$BaseUrl/api/share/list?page=1&pageSize=100"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        Write-Host "PASS - Total: $($response.data.total)" -ForegroundColor Green
        if ($response.data.stats) {
            Write-Host "  Stats - Total: $($response.data.stats.total), Active: $($response.data.stats.active), Disabled: $($response.data.stats.disabled)" -ForegroundColor Gray
        }
        $passed++
    } else {
        Write-Host "FAIL - $($response.message)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n=== Test 3: Disable Share ===" -ForegroundColor Yellow

if ($null -eq $createdShareId) {
    Write-Host "SKIP - No Share ID" -ForegroundColor Yellow
    $failed++
} else {
    try {
        $payload = @{
            action = "disable"
            shareIds = @($createdShareId)
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/batch" -Method POST -Headers $headers -Body $payload
        
        if ($response.code -eq 200) {
            Write-Host "PASS - Disabled Share ID: $createdShareId" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAIL - $($response.message)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Test 4: Verify Disabled Share Still Visible ===" -ForegroundColor Yellow

try {
    $uri = "$BaseUrl/api/share/list?page=1&pageSize=100"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        $disabledShare = $response.data.list | Where-Object { $_.shareId -eq $createdShareId }
        
        if ($disabledShare) {
            if ($disabledShare.isActive -eq 0) {
                Write-Host "PASS - Disabled share is visible with isActive=0" -ForegroundColor Green
                $passed++
            } else {
                Write-Host "FAIL - isActive is not 0: $($disabledShare.isActive)" -ForegroundColor Red
                $failed++
            }
        } else {
            Write-Host "FAIL - Disabled share not found in list (BUG NOT FIXED)" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "FAIL - $($response.message)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n=== Test 5: Filter Disabled Shares ===" -ForegroundColor Yellow

try {
    $uri = "$BaseUrl/api/share/list?page=1&pageSize=100&status=disabled"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        $allDisabled = ($response.data.list | Where-Object { $_.isActive -ne 0 }).Count -eq 0
        if ($allDisabled) {
            Write-Host "PASS - All returned shares are disabled" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAIL - Some shares are not disabled" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "FAIL - $($response.message)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n=== Test 6: Enable Disabled Share ===" -ForegroundColor Yellow

if ($null -eq $createdShareId) {
    Write-Host "SKIP - No Share ID" -ForegroundColor Yellow
    $failed++
} else {
    try {
        $payload = @{
            action = "enable"
            shareIds = @($createdShareId)
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/batch" -Method POST -Headers $headers -Body $payload
        
        if ($response.code -eq 200) {
            Write-Host "PASS - Enabled Share ID: $createdShareId" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAIL - $($response.message)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Test 7: Verify Stats Accuracy ===" -ForegroundColor Yellow

try {
    $uri = "$BaseUrl/api/share/list?page=1&pageSize=100"
    $response = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers
    
    if ($response.code -eq 200) {
        if ($response.data.stats) {
            Write-Host "PASS - Backend returned stats" -ForegroundColor Green
            Write-Host "  Total: $($response.data.stats.total), Active: $($response.data.stats.active), Expired: $($response.data.stats.expired), Disabled: $($response.data.stats.disabled)" -ForegroundColor Gray
            $passed++
        } else {
            Write-Host "FAIL - No stats returned" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "FAIL - $($response.message)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Cleanup
Write-Host "`n=== Cleanup ===" -ForegroundColor Yellow
if ($null -ne $createdShareId) {
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/share/$createdShareId" -Method DELETE -Headers $headers
        Write-Host "Deleted Share ID: $createdShareId" -ForegroundColor Gray
    } catch {
        Write-Host "Cleanup failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Summary
$total = $passed + $failed
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Total: $total, Passed: $passed, Failed: $failed" -ForegroundColor White
Write-Host "Success Rate: $([math]::Round(($passed / $total) * 100, 2))%`n" -ForegroundColor White

if ($failed -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed!" -ForegroundColor Yellow
    exit 1
}
