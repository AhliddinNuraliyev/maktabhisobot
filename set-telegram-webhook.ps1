<#
.SYNOPSIS
Telegram bot webhook'ini ulaydi — kirish tasdiq xabarlari bot orqali kelishi uchun.

.NOTE
Bu skriptni O'ZINGIZNING PowerShell oynangizda ishga tushuring.
1) Bot tokeni yashirincha so'raladi (suhbatga/faylga yozilmaydi).
2) Webhook uchun maxfiy kalit generatsiya qilinadi va Vercelga yoziladi.
3) Sayt qayta deploy qilinadi (env kuchga kirishi uchun).
4) Keyin setWebhook chaqiriladi.

PowerShell 5.1:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
  .\set-telegram-webhook.ps1

.PARAMETER SiteUrl
Saytning to'liq manzili. Standart: https://maktabhisobot.uz
MUHIM: www.maktabhisobot.uz -> maktabhisobot.uz ga 307 redirect qiladi,
Telegram esa redirect'ni kuzatmaydi. Shu sabab webhook uchun faqat asosiy
domen (www siz) ishlatiladi — skript www ni avtomatik olib tashlaydi.
#>
param(
    [string]$SiteUrl = 'https://maktabhisobot.uz'
)

$ErrorActionPreference = 'Stop'

function Invoke-VercelNative {
    param(
        [string[]]$Arguments,
        [string]$StdinValue = $null,
        [switch]$IgnoreFailure
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($null -ne $StdinValue) {
            $StdinValue | & vercel @Arguments 2>&1 | Out-Null
        } else {
            & vercel @Arguments 2>&1 | Out-Null
        }
        $code = $LASTEXITCODE
        if ($code -ne 0 -and -not $IgnoreFailure) {
            throw "Vercel buyrug'i muvaffaqiyatsiz (exit code $code): vercel $($Arguments -join ' ')"
        }
        return $code
    } finally {
        $ErrorActionPreference = $previous
    }
}

$secure = Read-Host 'Telegram bot access token (@BotFather -> /token)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if ([string]::IsNullOrWhiteSpace($plain)) { throw "Token bo'sh." }

Write-Host 'Token Telegram orqali tekshirilayabdi...' -ForegroundColor DarkGray
try {
    $me = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$plain/getMe" -TimeoutSec 30
} catch {
    $plain = $null
    $secure.Dispose()
    throw "Token Telegram tomonidan qabul qilinmadi."
}
if (-not $me.ok -or -not $me.result.username) {
    $plain = $null
    $secure.Dispose()
    throw "Token yaroqsiz yoki bot username topilmadi."
}
$botUsername = [string]$me.result.username
Write-Host "Bot tasdiqlandi: @$botUsername" -ForegroundColor Green

# Webhook maxfiy kaliti: 32 baytlik tasodifiy hex.
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
$rng.Dispose()

$SiteUrl = $SiteUrl.TrimEnd('/')
# www -> asosiy domen 307 redirect qiladi, Telegram esa redirect kuzatmaydi.
# Shu sabab webhook manzilida www bo'lmasligi shart.
$SiteUrl = $SiteUrl -replace '^https://www\.', 'https://'
# Hobby rejasida 12 ta funksiya limiti bor: webhook mavjud telegram-login
# funksiyasiga action=bot_webhook bilan keladi (mantiq api/_bot.js da).
$webhookUrl = "$SiteUrl/api/telegram-login?action=bot_webhook"

Write-Host "Vercelga o'zgaruvchilar yozilayabdi..." -ForegroundColor DarkGray
$null = Invoke-VercelNative -Arguments @('env', 'rm', 'TELEGRAM_WEBHOOK_SECRET', 'production', '--yes') -IgnoreFailure
$null = Invoke-VercelNative -Arguments @('env', 'add', 'TELEGRAM_WEBHOOK_SECRET', 'production') -StdinValue $secret
$null = Invoke-VercelNative -Arguments @('env', 'rm', 'TELEGRAM_BOT_USERNAME', 'production', '--yes') -IgnoreFailure
$null = Invoke-VercelNative -Arguments @('env', 'add', 'TELEGRAM_BOT_USERNAME', 'production') -StdinValue $botUsername
$null = Invoke-VercelNative -Arguments @('env', 'rm', 'PUBLIC_SITE_URL', 'production', '--yes') -IgnoreFailure
$null = Invoke-VercelNative -Arguments @('env', 'add', 'PUBLIC_SITE_URL', 'production') -StdinValue $SiteUrl

Write-Host "`nSayt qayta deploy qilinayabdi (env kuchga kirishi uchun)..." -ForegroundColor DarkGray
# Vercel env o'zgarishi darhol ko'rinmasligi mumkin: deploy env'ni eski qiymat bilan
# olib qolsa, webhook secret mos kelmay 401 qaytadi. Shu sabab qisqa kutamiz.
Start-Sleep -Seconds 4
$null = Invoke-VercelNative -Arguments @('--prod', '--yes')

Write-Host "`nWebhook ulanayabdi: $webhookUrl" -ForegroundColor DarkGray
$body = @{
    url                  = $webhookUrl
    secret_token         = $secret
    allowed_updates      = @('message', 'callback_query')
    drop_pending_updates = $true
    max_connections      = 40
} | ConvertTo-Json -Depth 4

try {
    $set = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$plain/setWebhook" `
        -ContentType 'application/json' -Body $body -TimeoutSec 30
} catch {
    $plain = $null
    $secure.Dispose()
    throw
}

if (-not $set.ok) {
    $plain = $null
    $secure.Dispose()
    throw "setWebhook bajarilmadi: $($set.description)"
}

Write-Host "`nWebhook holati:" -ForegroundColor DarkGray
try {
    $info = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$plain/getWebhookInfo" -TimeoutSec 30
    if ($info -and $info.ok) {
        Write-Host ("  url: " + $info.result.url)
        Write-Host ("  pending: " + $info.result.pending_update_count)
        if ($info.result.url -and $info.result.url -ne $webhookUrl) {
            Write-Host "  DIQQAT: kutilgan manzildan farq qiladi -> $webhookUrl" -ForegroundColor Yellow
        }
        if ($info.result.last_error_message) {
            Write-Host ("  oxirgi xato: " + $info.result.last_error_message) -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host '  getWebhookInfo olinmadi (muhim emas).' -ForegroundColor Yellow
}

# Buyruqlar Telegramning "/" menyusida chiqishi uchun ro'yxatdan o'tkazamiz.
$cmdBody = @{
    commands = @(
        @{ command = 'start';      description = 'Botni ishga tushirish' },
        @{ command = 'profil';     description = 'Hisob ma''lumoti va kreditlar' },
        @{ command = 'statistika'; description = 'Hisobotlar statistikasi' },
        @{ command = 'aloqa';      description = 'Administrator bilan bog''lanish' },
        @{ command = 'qollanma';   description = 'Batafsil yo''riqnoma' },
        @{ command = 'menu';       description = 'Tugmalar menyusi' },
        @{ command = 'help';       description = 'Yordam' }
    )
} | ConvertTo-Json -Depth 5

try {
    $cmdRes = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$plain/setMyCommands" `
        -ContentType 'application/json' -Body $cmdBody -TimeoutSec 30
    if ($cmdRes.ok) {
        Write-Host '  buyruqlar ro''yxatga olindi: /profil /statistika /aloqa /qollanma /menu /help' -ForegroundColor Green
    } else {
        Write-Host ("  buyruqlar ro''yxatga olinmadi: " + $cmdRes.description) -ForegroundColor Yellow
    }
} catch {
    Write-Host '  buyruqlar ro''yxatga olinmadi (muhim emas).' -ForegroundColor Yellow
}

# Manzil haqiqatan javob beryaptimi va secret mos keladimi?
# 401 = manzil ishlaydi, lekin deploy hali eski secret bilan ishlayapti -> qayta deploy.
function Test-Webhook {
    param([string]$Url, [string]$Secret)
    try {
        $r = Invoke-WebRequest -Method Post -Uri $Url -ContentType 'application/json' `
            -Headers @{ 'x-telegram-bot-api-secret-token' = $Secret } -Body '{}' `
            -MaximumRedirection 0 -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

$code = Test-Webhook -Url $webhookUrl -Secret $secret
if ($code -eq 401) {
    Write-Host "  secret hali eski deploymentda - qayta deploy qilinayabdi..." -ForegroundColor Yellow
    $null = Invoke-VercelNative -Arguments @('--prod', '--yes')
    Start-Sleep -Seconds 6
    $code = Test-Webhook -Url $webhookUrl -Secret $secret
}

if ($code -eq 200) {
    Write-Host "  endpoint: HTTP 200 (secret mos, webhook ishlayapti)" -ForegroundColor Green
} elseif ($code -eq 401) {
    Write-Host "  endpoint: HTTP 401 - secret mos emas! Skriptni yana bir marta ishga tushiring." -ForegroundColor Red
} elseif ($code) {
    Write-Host ("  endpoint: HTTP " + $code + " - webhook ishlamaydi!") -ForegroundColor Red
} else {
    Write-Host "  endpoint tekshirilmadi (muhim emas)." -ForegroundColor Yellow
}

$plain = $null
$secure.Dispose()

Write-Host "`nTayyor." -ForegroundColor Green
Write-Host "Endi saytda «Telegram orqali kirish» -> «Telegram botda tasdiqlash» ni sinab ko'ring." -ForegroundColor Cyan
Write-Host "Tasdiq xabari @$botUsername dan kelishi kerak." -ForegroundColor Cyan
