-- TEZCHECK integratsiyasi uchun jadvallar
-- Bu SQL ni Supabase Dashboard -> SQL Editor da bir marta bajarish kerak.

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

-- 4) RLS va ruxsatlar
alter table public.mh_payments enable row level security;
alter table public.mh_webhook_events enable row level security;
grant all on public.mh_payments to service_role;
grant all on public.mh_webhook_events to service_role;

-- 5) Atomik kredit qo'shish funksiyasi
-- To'lov tasdiqlanganda: mh_payments ni yangilaydi, foydalanuvchiga kredit va premium beradi.
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
  p_problem_category text default null
)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- To'lov yozuvini yangilaymiz
  update public.mh_payments
     set bill_id = coalesce(p_bill_id, bill_id),
         payment_id = coalesce(p_payment_id, payment_id),
         amount_minor = p_amount_minor,
         net_minor = p_net_minor,
         fee_minor = p_fee_minor,
         environment = p_environment,
         state = case when p_problem_category is null then 'succeeded' else 'failed' end,
         problem_category = p_problem_category,
         credits_granted = case when p_problem_category is null then p_credits else 0 end,
         updated_at = now()
   where reference = p_reference;

  -- Faqat muvaffaqiyatli va jonli to'lovda huquq beramiz
  if p_problem_category is null and p_environment = 'live' and p_credits > 0 then
    update public.mh_users
       set is_premium = true,
           download_credits = download_credits + p_credits
     where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.mh_grant_payment(text, uuid, text, text, integer, integer, integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.mh_grant_payment(text, uuid, text, text, integer, integer, integer, text, integer, text) to service_role;

-- 6) Yuklab olishda kreditni kamaytiradigan funksiya
create or replace function public.mh_consume_credit(p_uid uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare ok boolean := false;
begin
  update public.mh_users
     set download_credits = download_credits - 1
   where id = p_uid
     and is_premium = true
     and download_credits > 0
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.mh_consume_credit(uuid) from public, anon, authenticated;
grant execute on function public.mh_consume_credit(uuid) to service_role;
