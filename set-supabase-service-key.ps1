<#
.SYNOPSIS
To'g'ri Supabase loyihasining service_role / secret kalitini Vercelga o'rnatadi.
.NOTE
Bu skriptni O'ZINGIZNING PowerShell oynangizda ishga tushuring.
Kalit yashirincha so'raladi va suhbatga/faylga yozilmaydi.
Kalitni: Supabase Dashboard > Project Settings > API Keys dan oling.
Yangicha interfeysda "Settings > API" sahifasi yo'q - faqat "API Keys".
.PATH
  C:\Users\user\Downloads\NEW PROJECT\set-supabase-service-key.ps1
.EXAMPLE
  .\set-supabase-service-key.ps1
#>
$ErrorActionPreference = 'Stop'

# Vercel CLI banner'ni stderr'ga yozadi. PowerShell 5.1 buni xato deb hisoblab,
# $ErrorActionPreference='Stop' bilan skriptni to'xtatib qoyadi. Shu sabab
# mahalliy ravishda xato rejimini 'Continue' ga almashtiramiz.
function Invoke-VercelNative {
    param(
        [string[]]$Arguments,
        [string]$StdinValue = $null
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($null -ne $StdinValue) {
            $StdinValue | & vercel @Arguments 2>&1 | Out-Null
        } else {
            & vercel @Arguments 2>&1 | Out-Null
        }
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
}

$secure = Read-Host 'Supabase service_role kaliti' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if ([string]::IsNullOrWhiteSpace($plain)) { throw "Kalit bo'sh." }
if ($plain -notmatch '^(eyJ|sb_secret_)') {
    throw "Kalit formati noto'g'ri. Supabase Dashboard > Project Settings > API Keys sahifasidagi service_role yoki sb_secret_ kalitini kiriting."
}

# Kalitni Vercelga yozishdan oldin to'g'ri loyihaga ishlayotganini tekshiramiz.
$supabaseUrl = 'https://ylglulitdsfrgykpdzqs.supabase.co'
try {
    $null = Invoke-RestMethod -Method Get `
        -Uri "$supabaseUrl/rest/v1/mh_users?select=id&limit=1" `
        -Headers @{ apikey = $plain; Authorization = "Bearer $plain" } `
        -TimeoutSec 30
} catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'X' }
    $plain = $null
    $secure.Dispose()
    throw "Kiritilgan kalit ishlamadi (HTTP $code). Eski sozlama o'zgarishsiz qoldi. Supabase Dashboard > Project Settings > API Keys sahifasidagi service_role yoki sb_secret_ kalitini qayta kopi qiling."
}

Write-Host 'Kalit tekshirildi. Eski SUPABASE_SERVICE_ROLE_KEY ochiriladi...' -ForegroundColor DarkGray
$rmCode = Invoke-VercelNative -Arguments @('env', 'rm', 'SUPABASE_SERVICE_ROLE_KEY', 'production', '--yes')
if ($rmCode -ne 0) { throw "Eski kalit ochirilmadi (exit code $rmCode)." }

Write-Host 'Yangi kalit saqlanadi...' -ForegroundColor DarkGray
$addCode = Invoke-VercelNative -Arguments @('env', 'add', 'SUPABASE_SERVICE_ROLE_KEY', 'production') -StdinValue $plain
$plain = $null
$secure.Dispose()
if ($addCode -ne 0) { throw "Yangi kalit saqlanmadi (exit code $addCode)." }

Write-Host "`nSayt qayta deploy qilinayabdi..." -ForegroundColor DarkGray
$deployCode = Invoke-VercelNative -Arguments @('--prod', '--yes')
if ($deployCode -ne 0) { throw "Deploy muvaffaqiyatsiz (exit code $deployCode)." }

Write-Host "`nTayyor. Endi menga 'boldi' deb yozing, men tekshirib tugataman." -ForegroundColor Green
