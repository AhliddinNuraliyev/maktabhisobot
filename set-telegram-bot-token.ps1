<#
.SYNOPSIS
Telegram bot tokenini Vercelga xavfsiz o'rnatadi va saytni qayta deploy qiladi.
.NOTE
Bu skriptni O'ZINGIZNING PowerShell oynangizda ishga tushuring.
Token yashirincha so'raladi, suhbatga va faylga yozilmaydi.
Token manbasi: @BotFather -> /token -> kerakli botni tanlang.
PowerShell 5.1 da ishga tushirish uchun:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
  .\set-telegram-bot-token.ps1
.PATH
  C:\Users\user\Downloads\NEW PROJECT\set-telegram-bot-token.ps1
#>
$ErrorActionPreference = 'Stop'

# Vercel CLI banner'ni stderr'ga yozadi; PS 5.1 buni xato deb hisoblamasligi uchun.
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

$secure = Read-Host 'Telegram bot access token' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if ([string]::IsNullOrWhiteSpace($plain)) { throw "Token bo'sh." }

# Token bilan Telegram'ga murojaat qilib, haqiqiyligini va bot username'ini tekshiramiz.
Write-Host 'Token Telegram orqali tekshirilayabdi...' -ForegroundColor DarkGray
try {
    $me = Invoke-RestMethod -Method Get -Uri "https://api.telegram.org/bot$plain/getMe" -TimeoutSec 30
} catch {
    $plain = $null
    $secure.Dispose()
    throw "Token Telegram tomonidan qabul qilinmadi. @BotFather -> /token dan to'g'ri tokenni oling."
}
if (-not $me.ok -or -not $me.result.username) {
    $plain = $null
    $secure.Dispose()
    throw "Token yaroqsiz yoki bot username topilmadi."
}
$botUsername = [string]$me.result.username
$botName = [string]$me.result.first_name
Write-Host "Bot tasdiqlandi: @$botUsername ($botName)" -ForegroundColor Green

# Eski o'zgaruvchi yo'q bo'lishi mumkin - shuning uchun xatosini e'tiborsiz qoldiramiz.
Write-Host "Vercelga o'rnatilayabdi..." -ForegroundColor DarkGray
$null = Invoke-VercelNative -Arguments @('env', 'rm', 'TELEGRAM_BOT_TOKEN', 'production', '--yes') -IgnoreFailure
$null = Invoke-VercelNative -Arguments @('env', 'add', 'TELEGRAM_BOT_TOKEN', 'production') -StdinValue $plain
$plain = $null
$secure.Dispose()

Write-Host "`nSayt qayta deploy qilinayabdi..." -ForegroundColor DarkGray
$null = Invoke-VercelNative -Arguments @('--prod', '--yes')

Write-Host "`nTayyor." -ForegroundColor Green
Write-Host "KEYIN: @BotFather ga borib /setdomain buyrug'ini yuboring va"
Write-Host "       bot uchun domenni kiriting: maktabhisobot.uz" -ForegroundColor Cyan
Write-Host "       (https:// siz, www siz, faqat domen nomi)" -ForegroundColor Cyan
Write-Host "`nKeyin menga 'boldi' deb yozing, kirish tugmasini tekshirib beraman." -ForegroundColor Green
