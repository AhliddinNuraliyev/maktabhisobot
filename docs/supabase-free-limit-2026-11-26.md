# Supabase free limiti va ortiqcha so'rovlar — tahlil va optimallashtirish

**Sana:** 2026-11-26
**Qamrov:** `index.html`, `api/**`, `supabase-*.sql`, `vercel.json`

---

## 1. Eng muhim tuzatish: asosiy faraz noto'g'ri

Supabase rasmiy narxlar sahifasida (tekshirildi: `https://supabase.com/pricing`) Free reja uchun:

> **"Unlimited API requests"** — API so'rovlari cheksiz.

Demak, "keraksiz so'rovlar bilan free limitni to'ldirib qo'yamiz" degan xavf **yo'q**. So'rov soni qancha bo'lsa ham hisobga olinmaydi (faqat haddan tashqari abuse bo'lsa, infratuzilmani himoya qilish uchun 429 qaytarilishi mumkin, lekin bu kvota emas).

**Free rejada haqiqatan tugashi mumkin bo'lgan narsalar:**

| Resurs | Free limit | Loyihamiz uchun dolzarbmi? |
|---|---|---|
| Database hajmi | **500 MB** | ✅ Ha — asl xavf shu |
| Egress | **5 GB** | ⚠️ Kichik, lekin `select=*` bilan oshadi |
| Log ingestion | **1 GB** (kunlik retention) | ⚠️ So'rov ko'p bo'lsa, log ham ko'p |
| Auth MAU | 50 000 | ❌ Yo'q — biz Supabase Auth **ishlatmaymiz** (o'z HMAC sessiyamiz) |
| Edge Functions invocations | 500 000/oy | ❌ Yo'q — funksiyalar **Vercel** da |
| Storage | 1 GB | ❌ Yo'q — fayllar Telegram'ga yuboriladi |
| Realtime | 2 M xabar | ❌ Yo'q |
| Faollik | **1 hafta harakatsizlikdan keyin project pause** | ⚠️ E'tibor: cron bor, muammo yo'q |

**Xulosa:** optimallashtirish maqsadi "so'rov sonini kamaytirish" emas, balki:
1. jadvallarning cheksiz o'sishini to'xtatish (500 MB),
2. egress va log hajmini kamaytirish,
3. suiiste'mol (skript/loop) natijasida Vercel funksiyalari va Supabase yozuvlarining ko'payishini oldini olish.

---

## 2. Allaqachon to'g'ri qilingan (o'zgartirmang)

- `service_role` kaliti **faqat serverda** (`api/_lib.js`); frontendda Supabase kaliti yo'q.
- Foydalanuvchi ID si **imzolangan token ichida** (`uidFromPayload`) — har endpointga `userIdFromToken` SELECT'i ketmaydi (faqat eski tokenlar uchun zaxira).
- `mh_download` bitta RPC bilan: kredit −1, hisoblagich +1, statistika qaytadi (ilgari 4 so'rov ketardi).
- `upsertTelegramUser` — bitta PostgREST upsert (`Prefer: resolution=merge-duplicates`), ilgari SELECT + INSERT edi.
- `/api/me` — 60 soniyalik frontend keshi + faqat kerakli ustunlar (`select=id,telegram_id,...`).
- `mh_purge_expired()` + Vercel cron (`15 3 * * *`, `vercel.json`) + pg_cron zaxirasi — vaqtinchalik jadvallar tozalanadi.
- Barcha jadballarda RLS yoqilgan; `security definer` funksiyalarda `revoke ... from public, anon, authenticated` + `grant ... to service_role` to'g'ri o'rnatilgan.
- `git status` toza, `.vercelignore` da `*.sql`, `skills-lock.json`, `*.lock` bor (sxema ommaviy emas).

---

## 3. Topilgan ortiqcha so'rov manbalari va qilingan o'zgartirishlar

| # | Muammo | Oldin | Keyin | Holat |
|---|---|---|---|---|
| 1 | **Bot login polling** (`index.html`) | Har 4 s, jami 150 urinish = **150 ta Supabase SELECT** (10 daqiqa). Hech kim «Start» bosmasa ham to'xtamaydi. | 45 urinish, progressiv 4s → 6s → 10s (~5 daqiqa). Tab yashirin bo'lsa to'xtaydi. Botdagi «Saytga qaytish» tugmasi (`?tglogin=`) ishlashda davom etadi. | ✅ Joriy qilindi |
| 2 | **Sahifa ochilganda ikki marta `/api/me`** | `loadMe()` + LI bo'limidagi mustaqil `fetch('/api/me')` = 2 SELECT | `loadMe()` faqat bittasini qiladi; LI profilni lokal `mh:profile` eventi orqali oladi | ✅ Joriy qilindi |
| 3 | `select=*` (egress) | `_bot.js:userRow`, `billing/status.js` dagi payments | Faqat ishlatiladigan ustunlar | ✅ Joriy qilindi |
| 4 | `/api/send` da limit yo'q | Har chaqiruv = 1 ta `mh_use_auth_hash` RPC yozuvi | IP uchun 15 so'rov/daqiqa (maktablar uchun yumshoq) | ✅ Joriy qilindi |
| 5 | In-process `rateLimit()` serverless'da ishonchsiz | Har instansning o'z `Map`i | — | ⚠️ Tavsiya (pastda) |
| 6 | Poll GET endpointida server tomonda limit yo'q | To'g'ridan-to'g'ri skript bilan cheksiz SELECT | — | ⚠️ Tavsiya (pastda) |

### Miqdor bo'yicha misol (36 o'quvchi)

| Stsenariy | Oldin | Keyin |
|---|---|---|
| Hamma bot havolasini ochib, «Start» bosmadi | 36 × 150 = **5 400 SELECT** | 36 × 45 = **1 620 SELECT** |
| Hamma 30 s ichida tasdiqladi | ~36 × 8 = 288 | ~36 × 8 = 288 (o'zgarmadi) |

E'tibor: SELECT jadval o'sishiga ta'sir qilmaydi, lekin **log ingestion** va Vercel function invocations ko'payadi. Yozuv qo'shadigan so'rovlar (`bot_start`, login replay, payment) asl 500 MB xavfini yaratadi.

---

## 4. 500 MB limitini himoya qilish (asl xavf)

| Jadval | Qachon qator qo'shiladi | Himoya |
|---|---|---|
| `mh_bot_logins` | har `bot_start` | IP limiti 20/min (`_lib.js`) + `mh_purge_expired()` kunlik (1 kundan eski) |
| `mh_auth_nonces` | har login va har Mini App `/api/send` | replay RPC + tozalash (7 kun) |
| `mh_webhook_events` | har Tezcheck webhook | dedup + tozalash (30 kun) |
| `mh_payments` | har to'lov urinishi | foydalanuvchi uchun 5 ta/10 min |

500 MB ga yetish uchun **millionlab** qator kerak — oddiy foydalanishda bu sodir bo'lmaydi. Xavf faqat skript hujumida. Shuning uchun asosiy himoya — **haqiqiy (distributed) rate limit**.

---

## 5. Keyingi qadamlar (joriy qilinmadi, tavsiya)

### 5.1 SQL ning haqiqatan bajarilganligini tasdiqlang (ENG MUHIM)
`supabase-optimize.sql` bajarilmagan bo'lsa, har yuklab olish **1 ta o'rniga 3 ta RPC + 1 SELECT** yuboradi:

```sql
select proname from pg_proc
where proname in ('mh_download','mh_refund_credit','mh_purge_expired',
                  'mh_grant_signup_bonus','mh_use_auth_hash');

select column_name from information_schema.columns
where table_name='mh_users' and column_name='last_consume_at';

-- cron jadvali (pg_cron o'rnatilgan bo'lsa)
select jobname, schedule from cron.job;
```

### 5.2 Cron ishlayotganligini tekshiring
`vercel.json` dagi cron `/api/billing/health` ga tushadi. U faqat `CRON_SECRET` muhit o'zgaruvchisi **Vercel'da o'rnatilgan** bo'lsagina ishlaydi (Vercel o'zi `Authorization: Bearer <CRON_SECRET>` qo'yadi). Yo'q bo'lsa, har kuni 401 qaytadi va jadvallar to'planadi.

Qo'lda tekshirish:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://maktabhisobot.uz/api/billing/health?cron=1
# kutiladi: {"ok":true,"purged":...}
```

### 5.3 Distributed rate limit (ixtiyoriy, lekin to'g'ri yechim)
`api/_lib.js` dagi `rateLimit()` jarayon ichidagi `Map`. Vercel serverless'da har so'rov boshqa instansga tushishi mumkin, shuning uchun skript uni osongina aylanib o'tadi. Upstash Redis / Vercel KV bilan almashtirish kerak:
- `bot_start` — 10/min/IP
- `/api/telegram-login` (widget) — 20/min/IP
- `/api/telegram-login?state=` (poll) — 40/min/**nonce** (IP bo'yicha qilmaslik kerak: maktabda 36 o'quvchi bitta IP dan chiqadi)
- `/api/send` — 15/min/IP ✅ (allaqachon qo'shildi)

### 5.4 Monitoring
- Supabase Dashboard → **Usage**: Database size, Egress, Log ingestion (1 GB).
- Vercel → Functions → invocations. Agarda bir kunda keskin o'sish bo'lsa, demak biror skript polling yoki login endpointini urib yapti.
- Free project **1 hafta harakatsizlikdan keyin to'xtatiladi** — kunlik cron bu muammoni oldini oladi, lekin `CRON_SECRET` yo'q bo'lsa bu ham ishlamaydi.

---

## 6. Joriy qilingan o'zgartirishlar ro'yxati

- `index.html`: progressiv bot-login polling (45 urinish), `stopTgPoll`/`tgPollResume`/`tgPollPause` timeout'ga o'tkazildi.
- `index.html`: `loadMe()` ichida `mh:profile` eventi; mustaqil `/api/me` fetch olib tashlandi.
- `api/_bot.js`: `userRow()` da aniq ustunlar.
- `api/billing/status.js`: `mh_payments` so'rovlarida aniq ustunlar.
- `api/send.js`: 15 so'rov/min/IP cheklovi.

Barcha o'zgartirilgan JS fayllar `node --check` dan o'tdi; `index.html` ichidagi inline script bloklari ham sintaksis tekshiruvidan o'tdi.

**Deploy qilishdan oldin:** `git diff` ni ko'rib chiqing va yuqoridagi 5.1 / 5.2 tekshiruvlarini bajaring.
