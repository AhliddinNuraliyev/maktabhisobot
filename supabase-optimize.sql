-- ============================================================
--  Maktab Hisobot — Supabase optimallashtirish (2026-11-26)
--  Supabase Dashboard -> SQL Editor da bir marta bajaring.
--  Takroran bajarish xavfsiz (if not exists / create or replace).
--
--  Maqsad: ilova Supabase'ga kamroq murojaat qilsin (free plan) va
--  yuklab olishda kredit generatsiyadan OLDIN rezerv qilinsin.
-- ============================================================
begin;

-- 1) Oxirgi kredit sarflangan vaqt — "refund" faqat shu oynada ishlaydi.
alter table public.mh_users
  add column if not exists last_consume_at timestamptz;

-- 2) YUKLAB OLISH: kreditni kamaytirish + hisoblagichni oshirish + statistika
--    BITTA so'rovda. Ilgari 4 ta so'rov ketardi (userIdFromToken + consume +
--    bump + getUserStats). Endi 1 ta.
create or replace function public.mh_download(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_credits integer;
  v_downloads integer;
  v_premium boolean;
begin
  update public.mh_users
     set download_credits = download_credits - 1,
         download_count = coalesce(download_count, 0) + 1,
         last_consume_at = now()
   where id = p_uid
     and download_credits > 0
  returning download_credits, coalesce(download_count, 0), coalesce(is_premium, false)
       into v_credits, v_downloads, v_premium;

  if found then
    return jsonb_build_object('ok', true, 'credits', v_credits,
                              'downloads', v_downloads, 'premium', v_premium);
  end if;

  -- Kredit tugagan (yoki foydalanuvchi yo'q): joriy holatni qaytaramiz.
  select coalesce(download_credits, 0), coalesce(download_count, 0), coalesce(is_premium, false)
    into v_credits, v_downloads, v_premium
    from public.mh_users where id = p_uid;

  return jsonb_build_object('ok', false, 'credits', coalesce(v_credits, 0),
                            'downloads', coalesce(v_downloads, 0),
                            'premium', coalesce(v_premium, false));
end;
$$;

revoke all on function public.mh_download(uuid) from public, anon, authenticated;
grant execute on function public.mh_download(uuid) to service_role;

-- 3) REFUND: generatsiya muvaffaqiyatsiz bo'lsa kreditni qaytarish.
--    Suiiste'molni to'sish: faqat oxirgi 2 daqiqa ichida sarflangan kredit va
--    faqat BIR MARTA qaytariladi (last_consume_at null qilinadi).
create or replace function public.mh_refund_credit(p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean := false;
begin
  update public.mh_users
     set download_credits = download_credits + 1,
         download_count = greatest(coalesce(download_count, 0) - 1, 0),
         last_consume_at = null
   where id = p_uid
     and last_consume_at is not null
     and last_consume_at > now() - interval '2 minutes'
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.mh_refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.mh_refund_credit(uuid) to service_role;

-- 4) TOZALASH: muddati o'tgan bir martalik havolalar va eski imzolar.
--    Ilgari bu jadvallar cheksiz o'sardi.
create or replace function public.mh_purge_expired()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer := 0;
  m integer := 0;
begin
  delete from public.mh_bot_logins where expires_at < now() - interval '1 day';
  get diagnostics n = row_count;

  delete from public.mh_auth_nonces where created_at < now() - interval '7 days';
  get diagnostics m = row_count;

  return n + m;
end;
$$;

revoke all on function public.mh_purge_expired() from public, anon, authenticated;
grant execute on function public.mh_purge_expired() to service_role;

-- 5) Tozalashni baza o'zi bajarishi uchun pg_cron (agar mavjud bo'lsa).
--    Bo'lmasa — bu blok shunchaki ogohlantirish berib o'tib ketadi
--    (zaxira yo'l: /api/billing/health?cron=1 + CRON_SECRET).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron o''rnatilmadi: %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'mh-purge') then
      perform cron.unschedule('mh-purge');
    end if;
    perform cron.schedule('mh-purge', '15 3 * * *', $cron$select public.mh_purge_expired();$cron$);
    raise notice 'pg_cron: mh-purge kunlik 03:15 ga sozlandi';
  end if;
exception when others then
  raise notice 'pg_cron sozlanmadi: %', sqlerrm;
end $$;

commit;

-- ============================================================
--  Tekshirish (ixtiyoriy):
--    select public.mh_download('<user-uuid>'::uuid);   -- kredit 1 ga kamayadi
--    select public.mh_refund_credit('<user-uuid>'::uuid);
--    select public.mh_purge_expired();
-- ============================================================
