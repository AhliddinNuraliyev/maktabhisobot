<#
.SYNOPSIS
Supabase kalitlarini Windows DPAPI bilan shifrlab, faqat shu foydalanuvchi uchun saqlaydi.
.NOTE
Bu skriptni O'ZINGIZNING PowerShell oynangizda ishga tushuring.
Kiritgan qiymatlar ekranga chiqmaydi, ochiq faylga yozilmaydi va suhbatga yuborilmaydi.
.PATH
  C:\Users\user\Downloads\NEW PROJECT\save-supabase-secrets.ps1
.EXAMPLE
  .\save-supabase-secrets.ps1
.NOTE
  Agar "running scripts is disabled" xatosi chiqsa:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  keyin yana: .\save-supabase-secrets.ps1
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$folder = Join-Path $env:LOCALAPPDATA 'maktabhisobot'
if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
$path = Join-Path $folder 'supabase.secrets'

function ConvertFrom-SecureStringValue([System.Security.SecureString]$s) {
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Write-Host "Kalitlar faqat shu Windows foydalanuvchisi uchun shifrlanadi." -ForegroundColor Cyan
$url  = Read-Host 'Supabase URL (masalan https://xxx.supabase.co)'
$anon = Read-Host 'Anon key' -AsSecureString
$tok  = Read-Host 'Access token (sbp_...)' -AsSecureString
$db   = Read-Host 'Postgres connection string (paroli bilan)' -AsSecureString

$cfg = [ordered]@{
    SupabaseUrl    = $url.Trim()
    AnonKey        = ConvertFrom-SecureStringValue $anon
    AccessToken    = ConvertFrom-SecureStringValue $tok
    PostgresSqlUrl = ConvertFrom-SecureStringValue $db
}

$json  = $cfg | ConvertTo-Json -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($json)
$enc   = [Security.Cryptography.ProtectedData]::Protect(
    $bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes($path, $enc)

# Xotiradagi ochiq qiymatlarni tozalaymiz
$anon.Dispose(); $tok.Dispose(); $db.Dispose()
$cfg['AnonKey'] = ''; $cfg['AccessToken'] = ''; $cfg['PostgresSqlUrl'] = ''
$json = $null; $bytes = $null; $enc = $null

Write-Host "`nSaqlandi: $path" -ForegroundColor Green
Write-Host "Endi: .\\supabase-encrypt-setup.ps1" -ForegroundColor Green
