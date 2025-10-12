$loginResponse = Invoke-RestMethod -Uri 'http://localhost:8787/api/login' -Method POST -ContentType 'application/json' -Body '{"email": "admin@mornglow.top", "password": "14700Max"}'
$token = $loginResponse.data.token
Write-Host "Login successful"

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

$emailData = @{
    userId = 1
    accountId = 1
    sendEmail = "test1@example.com"
    name = "Test User 1"
    subject = "Verification Code 1"
    content = "<p>Your verification code is: <strong>123456</strong></p>"
    text = "Your verification code is: 123456"
    recipient = "test1@example.com"
    toEmail = "test1@example.com"
    toName = "Test User 1"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri 'http://localhost:8787/api/email/receive' -Method POST -Headers $headers -Body $emailData
Write-Host "Email created successfully"
