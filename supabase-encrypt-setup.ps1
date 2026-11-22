<#
.SYNOPSIS
Supabase loyihasida maydon darajasidagi AES-256 shifrlashni o'rnatadi.
.DESCRIPTION
- Supabase disk darajasida allaqachon shifrlaydi. Bu skript QO'SHIMCHA himoya qo'yadi.
- Shifrlash kaliti tasodifiy yaratilib, FAQAT Supabase Vault ichida saqlanadi.
- Bajarish uchun psql (PostgreSQL client) o'rnatilgan bo'lishi kerak.
.PATH
  C:\Users\user\Downloads\NEW PROJECT\supabase-encrypt-setup.ps1
.EXAMPLE
  .\supabase-encrypt-setup.ps1
.NOTE
  Agar "running scripts is disabled" xatosi chiqsa:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#>

$ErrorActionPreference = 'Stop'

# ====== 1) KALITLARNI SHIFRLANGAN XAZINADAN O'QIYMIZ ======
# Avval o'zingizning PowerShell oynangizda: .\save-supabase-secrets.ps1
# ni ishga tushirib 4 ta qiymatni kirting. Ular DPAPI bilan shifrlanadi.
$secretPath = Join-Path $env:LOCALAPPDATA 'maktabhisobot\supabase.secrets'
if (-not (Test-Path $secretPath)) {
    throw "Kalitlar topilmadi. Avval .\save-supabase-secrets.ps1 ni ishga tushiring."
}
Add-Type -AssemblyName System.Security
try {
    $encBytes   = [IO.File]::ReadAllBytes($secretPath)
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
        $encBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $cfg = [Text.Encoding]::UTF8.GetString($plainBytes) | ConvertFrom-Json
} catch {
    throw "Shifrlangan kalitlar ochilmadi. Qaytadan kiriting: .\save-supabase-secrets.ps1"
}
$plainBytes = $null; $encBytes = $null

$SupabaseUrl    = [string]$cfg.SupabaseUrl
$AnonKey        = [string]$cfg.AnonKey
$AccessToken    = [string]$cfg.AccessToken
$PostgresSqlUrl = [string]$cfg.PostgresSqlUrl

foreach ($p in @(
    @('SupabaseUrl', $SupabaseUrl),
    @('AnonKey', $AnonKey),
    @('AccessToken', $AccessToken),
    @('PostgresSqlUrl', $PostgresSqlUrl)
)) {
    if ([string]::IsNullOrWhiteSpace($p[1])) {
        throw "$($p[0]) bo'sh. Qaytadan kiriting: .\save-supabase-secrets.ps1"
    }
}

# Postgres ulanish havolasini tarkibiy qismlarga ajratamiz (parol ekranga chiqmaydi)
try { $u = [Uri]$PostgresSqlUrl } catch { throw "PostgresSqlUrl noto'g'ri formatda." }
$DbHost    = $u.Host
$Port      = $u.Port
if ($Port -le 0) { $Port = 5432 }
$userInfo  = $u.UserInfo -split ':', 2
$DbUser    = [Uri]::UnescapeDataString($userInfo[0])
$plainPass = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
$DbName    = $u.AbsolutePath.TrimStart('/')
if ([string]::IsNullOrWhiteSpace($plainPass)) { throw "PostgresSqlUrl ichida parol yo'q." }

$projectRef = ''
if ($DbHost -match '^db\.([^.]+)\.supabase\.co$') { $projectRef = $Matches[1] }
elseif ($SupabaseUrl -match '^https://([^.]+)\.supabase\.co/?$') { $projectRef = $Matches[1] }

# Ba'zi Supabase hostlari faqat IPv6 (AAAA) yozuviga ega. Bunday holda
# Management API dan regionni olib, IPv4 bo'lgan pooler orqali ulanamiz.
$projInfo = $null
if ($projectRef -and $AccessToken) {
    try {
        $projInfo = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef" `
            -Headers @{ Authorization = "Bearer $AccessToken" } -TimeoutSec 20
    } catch { $projInfo = $null }
}
if ($projInfo -and $projInfo.region) {
    $aRecords = @()
    try { $aRecords = @(Resolve-DnsName -Name $DbHost -Type A -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress }) } catch {}
    if ($aRecords.Count -eq 0) {
        $DbHost = "aws-0-$($projInfo.region).pooler.supabase.com"
        $Port = 5432
        $DbUser = "postgres.$projectRef"
        Write-Host "To'g'ridan-to'g'ri host IPv6 only -> pooler ishlatiladi: $DbHost" -ForegroundColor Yellow
    }
}

# psql ni topamiz: avval PATH, keyin odatiy o'rnatish papkalari
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
    $roots = @("$env:ProgramFiles\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL")
    foreach ($root in $roots) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        foreach ($ver in @('19','18','17','16','15','14')) {
            $candidate = Join-Path $root "$ver\bin\psql.exe"
            if (Test-Path $candidate) { $psqlCmd = $candidate; break }
        }
        if ($psqlCmd) { break }
    }
}
if (-not $psqlCmd) {
    $psqlExe = $null
    Write-Host "[!] psql topilmadi - Management API ishlatiladi." -ForegroundColor DarkGray
} else {
    if ($psqlCmd -is [string]) { $psqlExe = $psqlCmd } else { $psqlExe = $psqlCmd.Source }
    Write-Host "psql: $psqlExe" -ForegroundColor DarkGray
}

$sql = @'
\set ON_ERROR_STOP on

-- 1) Kengaytma: pgcrypto (AES-256 funksiyalari)
create extension if not exists pgcrypto with schema extensions;
-- supabase_vault odatda yoqilgan; yo'q bo'lsa Dashboard > Database > Extensions dan yoqing.

-- 2) Kalit: faqat bir marta, tasodifiy 32 bayt, Vault ichida shifrlanadi.
--    Kalitning o'zi kodga, o'zgaruvchiga yoki logga yozilmaydi.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'mh_field_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'mh_field_key',
      'AES-256 field encryption key'
    );
  end if;
end
$$;

-- 3) Kalitni faqat server tomoni (postgres/service_role) o'qiy oladi
revoke all on vault.decrypted_secrets from public, anon, authenticated;

create schema if not exists secure;

create or replace function secure.get_key()
returns text language sql stable security definer
set search_path = vault, public, pg_temp
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'mh_field_key' limit 1
$$;

revoke all on function secure.get_key() from public, anon, authenticated;
grant execute on function secure.get_key() to service_role;

-- 4) Shifrlash / deskrifrlash (AES-256, base64)
create or replace function secure.enc(p_text text)
returns text language plpgsql security definer
set search_path = extensions, public, pg_temp
as $$
begin
  if p_text is null then return null; end if;
  return encode(
    extensions.pgp_sym_encrypt(p_text, secure.get_key(), 'cipher-algo=aes256, compress-algo=none'),
    'base64'
  );
end;
$$;

create or replace function secure.dec(p_data text)
returns text language plpgsql security definer
set search_path = extensions, public, pg_temp
as $$
begin
  if p_data is null then return null; end if;
  return extensions.pgp_sym_decrypt(
    decode(p_data, 'base64'), secure.get_key(), 'cipher-algo=aes256, compress-algo=none'
  );
end;
$$;

revoke all on function secure.enc(text) from public;
grant execute on function secure.enc(text) to authenticated, service_role;
revoke all on function secure.dec(text) from public, anon, authenticated;
grant execute on function secure.dec(text) to service_role;

-- 5) PostgREST / supabase-js uchun qulay RPC nomlari
create or replace function public.mh_enc(p_text text)
returns text language sql stable security definer
set search_path = public, secure, pg_temp
as $$ select secure.enc(p_text) $$;

create or replace function public.mh_dec(p_data text)
returns text language sql stable security definer
set search_path = public, secure, pg_temp
as $$ select secure.dec(p_data) $$;

revoke all on function public.mh_enc(text) from public;
grant execute on function public.mh_enc(text) to anon, authenticated, service_role;
revoke all on function public.mh_dec(text) from public, anon, authenticated;
grant execute on function public.mh_dec(text) to service_role;

-- 6) Namuna jadval olib tashlandi: endi faqat bitta mh_users jadvali ishlatiladi.

-- 7) Yagona jadval: profil + premium + hisoblagichlar
create table if not exists public.mh_users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  viloyat text,
  tuman text,
  maktab text,
  oqituvchi text,
  is_premium boolean not null default false,
  download_count integer not null default 0
);

-- Mavjud jadvalga yetishmayotgan ustunlarni qo'shamiz
alter table public.mh_users add column if not exists viloyat text;
alter table public.mh_users add column if not exists tuman text;
alter table public.mh_users add column if not exists maktab text;
alter table public.mh_users add column if not exists oqituvchi text;
alter table public.mh_users add column if not exists is_premium boolean not null default false;
alter table public.mh_users add column if not exists download_count integer not null default 0;

-- Eski ortiqcha ustunlarni olib tashlaymiz
alter table public.mh_users drop column if exists login_count;
alter table public.mh_users drop column if exists created_at;
alter table public.mh_users drop column if exists last_login_at;
alter table public.mh_users drop column if exists pdf_count;
alter table public.mh_users drop column if exists xlsx_count;
alter table public.mh_users drop column if exists download_adjustment;
alter table public.mh_users drop column if exists profile_updated_at;

alter table public.mh_users enable row level security;
grant usage on schema public to service_role;
grant all on public.mh_users to service_role;

create or replace function public.mh_bump(p_uid uuid, p_kind text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind in ('pdf', 'xlsx') then
    update public.mh_users set download_count = download_count + 1 where id = p_uid;
  end if;
end;
$$;
revoke all on function public.mh_bump(uuid, text) from public, anon, authenticated;
grant execute on function public.mh_bump(uuid, text) to service_role;

-- Eski jadvallar va view'larni olib tashlaymiz - faqat mh_users qoladi
drop view if exists public.mh_user_stats;
drop table if exists public.mh_user_data;
drop table if exists public.mh_events;
drop table if exists public.mh_reports;
drop view if exists public.secure_records_view;
drop table if exists public.secure_records;

-- 9) Tekshirish: natija 'shifrlash ishlayapti' bo'lishi kerak
select name, length(decrypted_secret) as key_length
from vault.decrypted_secrets where name = 'mh_field_key';

select public.mh_dec(public.mh_enc('shifrlash ishlayapti')) as test_natija;
'@

$env:PGPASSWORD = $plainPass
try {
    if ($AccessToken -and $projectRef) {
        # Asosiy usul: Supabase Management API (IPv4, psql ga bog'liq emas)
        $apiSql = ($sql -split "`r?`n" | Where-Object { $_ -notmatch '^\\set ' }) -join "`n"
        $body = @{ query = $apiSql } | ConvertTo-Json -Compress -Depth 5
        $apiResult = Invoke-RestMethod -Method Post `
            -Uri "https://api.supabase.com/v1/projects/$projectRef/database/query" `
            -Headers @{ Authorization = "Bearer $AccessToken"; 'Content-Type' = 'application/json' } `
            -Body $body -TimeoutSec 120
        Write-Host "`n[OK] SQL Management API orqali o'rnatildi." -ForegroundColor Green
        if ($apiResult) {
            Write-Host "[OK] ichki test: $($apiResult | ConvertTo-Json -Compress -Depth 5)" -ForegroundColor Green
        }
    } elseif ($psqlExe) {
        # Zaxira usul: mahalliy psql
        $sql | & $psqlExe "host=$DbHost port=$Port dbname=$DbName user=$DbUser sslmode=require" -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { throw "psql/SQL muvaffaqiyatsiz (exit code $LASTEXITCODE)." }
        Write-Host "`n[OK] SQL psql orqali o'rnatildi." -ForegroundColor Green
    } else {
        throw "SQL bajarish uchun access token yoki psql kerak."
    }
    Write-Host "[OK] Kalit Vault ichida, kodda emas." -ForegroundColor Green

    if ($projInfo) {
        Write-Host "[OK] Loyiha: $($projInfo.name) | region: $($projInfo.region)" -ForegroundColor Green
    }

    # Anon key bilan RPC ishlashini tekshirish
    try {
        $rpc = Invoke-RestMethod -Method Post `
            -Uri "$SupabaseUrl/rest/v1/rpc/mh_enc" `
            -Headers @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey"; "Content-Type" = "application/json" } `
            -Body '{"p_text":"shifrlash ishlayapti"}' -TimeoutSec 20
        Write-Host "[OK] Anon RPC ishlaydi. Shifrlangan natija: $rpc" -ForegroundColor Green
    } catch {
        Write-Host "[!] Anon RPC tekshiruvi xato (schema cache yangilanishini kuting): $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host "`nTayyor. Endi mh_enc funksiyasini chaqirib malumot shifrlang." -ForegroundColor Cyan
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $plainPass = $null
}
