-- ⚠️ DIQQAT: bu SQL mh_users jadvalidagi 3 ta ustunni butunlay o'chiradi (qaytarib bo'lmaydi).
-- Supabase -> SQL Editor -> New query ichida ishga tushiring.
-- Avval zaxira olishni xohlasangiz, quyidagi satrni izohdan chiqarib biring:
-- CREATE TABLE public.mh_users_backup_20261120 AS SELECT * FROM public.mh_users;

ALTER TABLE public.mh_users
  DROP COLUMN IF EXISTS login_count,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS created_at;

-- login hisobi endi yuritilmaydi: mh_bump faqat yuklab olishlarni hisoblaydi
CREATE OR REPLACE FUNCTION public.mh_bump(p_uid uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_kind IN ('pdf', 'xlsx') THEN
    UPDATE public.mh_users SET download_count = download_count + 1 WHERE id = p_uid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mh_bump(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mh_bump(uuid, text) TO service_role;
