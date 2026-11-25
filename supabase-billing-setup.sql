-- TEZCHECK integratsiyasi + kredit xavfsizligi
-- Bu SQL ni Supabase Dashboard -> SQL Editor da bir marta bajarish kerak.
-- Takroran bajarish xavfsiz (drop/create or replace / if not exists).
begin;

-- 1) mh_users ga to'lov kreditlari ustunini qo'shamiz
alter table public.mh_users
  add column if not exists download_credits integer not null default 0;

-- 2) To'lovlar jadvali
create table if not exists public.mh_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.mh_users(id) on delete restrict,
  reference text not null unique,
  bill_id text,
  payment_id text,
  amount_minor integer not null,
  net_minor integer,
  fee_minor integer,
  currency text not null default 'UZS',
  environment text not null default 'test',
  state text not null default 'pending',
  credits_granted integer not null default 0,
  problem_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mh_payments_user_idx on public.mh_payments(user_id);
create index if not exists mh_payments_reference_idx on public.mh_payments(reference);

-- 3) Webhook hodisalari (dedup uchun)
create table if not exists public.mh_webhook_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now()
);

-- 3b) Bir marta ishlatiladigan Telegram kirish imzolari (replay oldini olish)
create table if not exists public.mh_auth_nonces (
  hash text primary key,
  telegram_id text not null,
  auth_date integer not null,
  created_at timestamptz not null default now()
);
create index if not exists mh_auth_nonces_created_idx on public.mh_auth_nonces(created_at);

-- 4) RLS va ruxsatlar
alter table public.mh_payments enable row level security;
alter table public.mh_webhook_events enable row level security;
alter table public.mh_auth_nonces enable row level security;
grant all on public.mh_payments to service_role;
grant all on public.mh_webhook_events to service_role;
grant all on public.mh_auth_nonces to service_role;

-- 5) Atomik va idempotent kredit qo'shish funksiyasi.
-- Qator FOR UPDATE bilan qulflanadi: webhook va ?check=1 bir vaqtda kelsa ham
-- kredit faqat bir marta beriladi. Qaytaradigan qiymat — berilgan kreditlar soni.
-- Eski versiyasi returns void edi: PostgreSQL qaytish turini CREATE OR REPLACE
-- bilan o'zgartirishga yo'l qo'ymaydi (42P13). Shuning uchun barcha eski
-- overload'larni nomi bo'yicha o'chiramiz, keyin yangisini yaratamiz.
do $$
declare r record;
begin
  for r in
    select p.oid from pg_proc p
    where p.proname = 'mh_grant_payment'
      and p.pronamespace = 'public'::regnamespace
  loop
    execute 'drop function public.mh_grant_payment(' ||
      pg_get_function_identity_arguments(r.oid) || ')';
  end loop;
end $$;

create or replace function public.mh_grant_payment(
  p_reference text,
  p_user_id uuid,
  p_bill_id text,
  p_payment_id text,
  p_amount_minor integer,
  p_net_minor integer,
  p_fee_minor integer,
  p_environment text,
  p_credits integer,
  p_problem_category text default null,
  p_state text default null,
  p_succeeded boolean default null
)
returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.mh_payments%rowtype;
  v_granted integer := 0;
begin
  select * into v_row from public.mh_payments where reference = p_reference for update;
  if not found or v_row.user_id <> p_user_id then
    return 0;
  end if;

  update public.mh_payments
     set bill_id = coalesce(p_bill_id, bill_id),
         payment_id = coalesce(p_payment_id, payment_id),
         amount_minor = p_amount_minor,
         net_minor = p_net_minor,
         fee_minor = p_fee_minor,
         environment = p_environment,
         -- Faqat aniq muvaffaqiyatli hodisa 'succeeded' bo'ladi. processing/open/
          -- refunded/canceled kabi hodisalarda problem null bo'ladi, lekin ular
          -- to'lov tugagan degani emas.
          state = case
                    when coalesce(p_succeeded, false) then 'succeeded'
                    when p_problem_category is not null then 'failed'
                    else coalesce(nullif(p_state, ''), v_row.state)
                  end,
         problem_category = p_problem_category,
         updated_at = now()
   where reference = p_reference;

  -- Faqat muvaffaqiyatli, jonli va hali kredit olinmagan to'lovda huquq beramiz
  if coalesce(p_succeeded, false) and p_environment = 'live' and p_credits > 0
     and coalesce(v_row.credits_granted, 0) = 0 then
    update public.mh_users
       set is_premium = true,
           download_credits = coalesce(download_credits, 0) + p_credits
     where id = p_user_id;
    update public.mh_payments set credits_granted = p_credits where reference = p_reference;
    v_granted := p_credits;
  end if;
  return v_granted;
end;
$$;

revoke all on function public.mh_grant_payment(text, uuid, text, text, integer, integer, integer, text, integer, text, text, boolean) from public, anon, authenticated;
grant execute on function public.mh_grant_payment(text, uuid, text, text, integer, integer, integer, text, integer, text, text, boolean) to service_role;

-- 6) Yuklab olishda kreditni atomik kamaytirish.
-- Bepul kreditlar ham ishlashi uchun is_premium sharti olib tashlandi.
create or replace function public.mh_consume_credit(p_uid uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare ok boolean := false;
begin
  update public.mh_users
     set download_credits = download_credits - 1
   where id = p_uid
     and download_credits > 0
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.mh_consume_credit(uuid) from public, anon, authenticated;
grant execute on function public.mh_consume_credit(uuid) to service_role;

-- 7) Bir marta beriladigan 3 ta bepul kredit (atomik).
-- Faqat kredit va yuklab olishlar ikkisi ham 0 bo'lgan oddiy akkauntga beriladi.
create or replace function public.mh_grant_signup_bonus(p_uid uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare ok boolean := false;
begin
  update public.mh_users
     set download_credits = 3
   where id = p_uid
     and coalesce(is_premium, false) = false
     and coalesce(download_credits, 0) = 0
     and coalesce(download_count, 0) = 0
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.mh_grant_signup_bonus(uuid) from public, anon, authenticated;
grant execute on function public.mh_grant_signup_bonus(uuid) to service_role;

-- 8) Yuklab olish/yuklash hisoblagichi (mh_bump RPC ilgari yo'q edi)
create or replace function public.mh_bump(p_uid uuid, p_kind text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_kind in ('pdf', 'xlsx') then
    update public.mh_users
       set download_count = coalesce(download_count, 0) + 1
     where id = p_uid;
  end if;
end;
$$;

revoke all on function public.mh_bump(uuid, text) from public, anon, authenticated;
grant execute on function public.mh_bump(uuid, text) to service_role;

-- 9) Telegram kirish imzosini bir marta ishlatish.
-- insert ... on conflict do nothing atomik: ikki parallel so'rovdan faqat bittasi true oladi.
create or replace function public.mh_use_auth_hash(
  p_hash text,
  p_telegram_id text,
  p_auth_date integer
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.mh_auth_nonces (hash, telegram_id, auth_date)
  values (p_hash, p_telegram_id, p_auth_date)
  on conflict (hash) do nothing;
  return found;
end;
$$;

revoke all on function public.mh_use_auth_hash(text, text, integer) from public, anon, authenticated;
grant execute on function public.mh_use_auth_hash(text, text, integer) to service_role;

-- Kirish boshqa sabab bilan muvaffaqiyatsiz bo'lsa, imzoni qayta ishlatishga ruxsat beramiz
create or replace function public.mh_release_auth_hash(p_hash text, p_telegram_id text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.mh_auth_nonces where hash = p_hash and telegram_id = p_telegram_id;
end;
$$;

revoke all on function public.mh_release_auth_hash(text, text) from public, anon, authenticated;
grant execute on function public.mh_release_auth_hash(text, text) to service_role;

-- Eski imzolar bazada yig'ilib qolmasligi uchun (ixtiyoriy, haftalik cron):
-- delete from public.mh_auth_nonces where created_at < now() - interval '7 days';

-- 10) Bot orqali kirish (deep-link) uchun bir martalik so'rovlar.
-- Sayt nonce yaratadi -> foydalanuvchi t.me/<bot>?start=login_<nonce> ni ochadi
-- -> bot webhook nonce ni telegram_id bilan tasdiqlaydi -> sayt sessiya oladi.
-- Nonce bir marta ishlatiladi va 10 daqiqada eskiradi.
create table if not exists public.mh_bot_logins (
  nonce text primary key,
  telegram_id text,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists mh_bot_logins_expires_idx on public.mh_bot_logins(expires_at);

alter table public.mh_bot_logins enable row level security;
grant all on public.mh_bot_logins to service_role;

-- Eski so'rovlarni tozalash (ixtiyoriy, kunlik cron):
-- delete from public.mh_bot_logins where expires_at < now() - interval '1 day';

commit;
