# Quick Test Script for Token Expiration Fix
# 快速测试脚本 - 验证失效令牌404响应

param(
    [string]$BaseUrl = "http://localhost:8787",
    [string]$InvalidToken = "abcdefghijklmnopqrstuvwxyz123456"
)

Write-Host "`n=== Token Expiration Fix - Quick Test ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host "Invalid Token: $InvalidToken`n" -ForegroundColor Gray

$testUrl = "$BaseUrl/share/$InvalidToken"
Write-Host "Testing URL: $testUrl" -ForegroundColor Yellow

try {
    # 发送HTTP请求
    $response = Invoke-WebRequest -Uri $testUrl -Method GET -ErrorAction Stop
    
    Write-Host "`n❌ FAILED: Expected 404, got $($response.StatusCode)" -ForegroundColor Red
    Write-Host "Response Body: $($response.Content)" -ForegroundColor Red
    exit 1
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 404) {
        Write-Host "`n✅ Status Code: 404 (Correct)" -ForegroundColor Green
        
        # 获取响应体
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        Write-Host "✅ Response Body: '$responseBody'" -ForegroundColor Green
        Write-Host "✅ Body Length: $($responseBody.Length) bytes" -ForegroundColor Green
        
        # 验证响应体
        if ($responseBody -eq "Not Found") {
            Write-Host "`n🎉 TEST PASSED: Invalid token returns plain text 404!" -ForegroundColor Green
            
            # 检查Content-Type
            $contentType = $_.Exception.Response.ContentType
            Write-Host "Content-Type: $contentType" -ForegroundColor Gray
            
            if ($contentType -like "*text/plain*") {
                Write-Host "✅ Content-Type is text/plain (Correct)" -ForegroundColor Green
            } else {
                Write-Host "⚠️  WARNING: Content-Type is not text/plain" -ForegroundColor Yellow
            }
            
            exit 0
        } else {
            Write-Host "`n❌ FAILED: Expected 'Not Found', got '$responseBody'" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "`n❌ FAILED: Expected 404, got $statusCode" -ForegroundColor Red
        exit 1
    }
}
