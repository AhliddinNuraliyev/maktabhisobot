# Supabase hisoboti — murojaatlarni kamaytirish (2026-11-26)

Sayt: **maktabhisobot.uz** · Reja: **Free** · Maqsad: baza tez to'lib qolmasin va **to'lov qabul qilish hech qachon to'xtamasin**.

---

## 1. Qisqa xulosa

Bitta foydalanuvchi sessiyasida (kirish + 3 ta yuklab olish) Supabase'ga ketadigan so'rovlar
**~167 tadan ~25 tagacha** tushdi (≈ **85% kamayish**). Yuklab olishda 4 so'rov o'rniga 1 ta,
`/api/me` da 2 o'rniga 1 ta, login oynasidagi poll 150 o'rniga ~20 ta.

Bundan tashqari **kunlik cron** qo'shildi: u ham jadvallarni tozalaydi, ham Supabase loyihasi
"7 kun harakatsizlik" sababli **pauza bo'lib qolishining oldini oladi** — bu to'lov qabul qilishning
to'xtab qolishiga olib keladigan eng ehtimoliy sabab edi.

---

## 2. Har bir amalda nechta so'rov ketadi

| Amal | Oldin | Endi | Izoh |
|------|------:|-----:|------|
| Sahifa ochilishi (`/api/me`) | 2 | **1** | `select=*` → faqat kerakli ustunlar; statistika o'sha qatordan |
| Tab/fokus almashishi (60 s ichida) | 2 | **0** | 60 soniyalik kesh |
| Bot orqali kirish (mavjud user) | 3 (SELECT+PATCH+bonus) | **1** | haqiqiy upsert + bonus faqat kerak bo'lsa |
| Bot orqali kirish (yangi user) | 1 | **2** | upsert + bonus RPC |
| Login oynasidagi poll (10 daqiqa) | ~150 | **~20** | 2 s → 4 s + tab yashiringanda pauza |
| **Yuklab olish (PDF/Excel)** | **4** | **1** | `mh_download` RPC: kredit + hisoblagich + statistika |
| Profil saqlash | 2 | **1** | uid tokendan olinadi |
| To'lov yaratish | 2 | **1** | uid tokendan; xato bo'lsa `failed` belgisi |
| To'lov holati | 3 | **2** | |
| Telegram bot menyusi | 1–2 | 1–2 | o'zgarmadi |

**Yuklab olishdagi 4 → 1** eng katta yutuq: ilgari `userIdFromToken` + `mh_consume_credit` +
`mh_bump` + `getUserStats` ketardi.

---

## 3. Free plan: qaysi limit birinchi tugaydi

| Limit | Qiymat | Bu loyihada xavf |
|-------|--------|------------------|
| Database | 500 MB | **Asosiy xavf** — jadvallar tozalanmasa o'sadi |
| Egress (trafik) | 5 GB/oy | `select=*` va admin ro'yxati (1000 qator) yeydi |
| MAU | 50 000 | Hozircha muammo emas |
| Harakatsizlik | 7 kun → **pauza** | **To'lovni to'xtatadi** |
| Backup | Yo'q | Ma'lumot yo'qolsa tiklash imkoni cheklangan |

### Jadvallar hajmi (taxminan)

| Jadval | 1 qator | O'sish manbasi | Tozalash |
|--------|--------:|----------------|----------|
| `mh_users` | ~0.5 KB | real foydalanuvchi | kerak emas |
| `mh_payments` | ~0.5 KB | har to'lov urinishi | saqlanadi (moliya) |
| `mh_bot_logins` | ~0.3 KB | **har "Kirish" bosishi** | 1 kundan keyin o'chadi |
| `mh_auth_nonces` | ~0.2 KB | har widget logini | 7 kundan keyin o'chadi |
| `mh_webhook_events` | ~0.1 KB | har to'lov hodisasi | 30 kundan keyin o'chadi |

Ilgari bu uchtasi **hech qachon** tozalanmasdi. Endi `mh_purge_expired()` kunlik ishlaydi.

---

## 4. To'lov qabul qilishni to'xtatadigan 3 holat va yechim

### 4.1. Loyiha pauza bo'lishi (7 kun harakatsizlik)
**Natija:** barcha `/api/*` 500 qaytaradi; Tezcheck webhook'i yetib bormaydi; kredit berilmaydi.

**Yechim (qilindi):** `vercel.json` ga kunlik cron qo'shildi —
`/api/billing/health` har kuni 03:15 (UTC) da `mh_purge_expired()` ni chaqiradi.
Har kuni baza bilan ishlash pauzani oldini oladi.

**Siz qilishingiz kerak:** Vercel'da `CRON_SECRET` env qo'shish (cron shusiz 401 oladi):
```
vercel env add CRON_SECRET production
```
va shu qiymatni saqlab qo'yish.

### 4.2. Baza 500 MB ga yetishi
**Natija:** `INSERT` ishlamaydi → to'lov yozilmaydi → kredit berilmaydi.

**Yechim (qilindi):** kunlik tozalash + rate limit (spam `bot_start` endi cheklangan:
IP uchun 20/daqiqa) + `create-payment` uchun 5/10 daqiqa.
**Qo'shimcha:** oyda bir marta `mh_payments` ni arxivlash (3 oydan eski qatorlarni CSV ga chiqarib o'chirish).

### 4.3. Webhook vaqtincha ishlamasa
**Yechim (bor edi, saqlandi):** `mh_grant_payment` `FOR UPDATE` bilan atomik; webhook xato bo'lsa
**5xx** qaytaradi (200 emas) — Tezcheck qayta yuboradi. Qo'shimcha: foydalanuvchi
"To'lovni tekshirish" bosganda `/api/billing/status?check=1` Tezcheckdan holatni so'rab, kreditni tiklaydi.

---

## 5. Nima qilish kerak (qadamlar)

1. **SQL migratsiyasini bajarish** — `supabase-optimize.sql` (Supabase → SQL Editor).
   Busiz hammasi ishlaydi, lekin yuklab olishda 4 so'rov qoladi (zaxira yo'l ishlatiladi).
   Migratsiya quyidagilarni yaratadi: `mh_download`, `mh_refund_credit`, `mh_purge_expired`
   va `pg_cron` orqali kunlik tozalash.
2. **`CRON_SECRET`** ni Vercel'ga qo'shish (4.1 ga qarang).
3. **Monitoring:** oyda bir marta Supabase → Settings → Usage:
   Database size, Egress, API requests. 70% dan oshsa — chora ko'rish.

---

## 6. Yana nima qilsa bo'ladi (keyingi bosqich)

- **Admin ro'yxati** 1000 qatorni bir so'rovda oladi (`/api/admin/users`) — sahifalash qo'shilsa egress kamayadi.
- **`mh_users` dan ortiqcha ustunlar** (agar bo'lsa) olib tashlash.
- **Supabase loglarini** uzoq saqlamaslik (Dashboard → Logs retention).
- Agar foydalanuvchi 5 000+ bo'lsa: **Pro plan** ($25/oy) — 8 GB baza, 250 GB egress, kunlik backup.
  Free planda backup yo'qligi — moliyaviy ma'lumot uchun eng katta xavf.

---

## 7. Tekshirilgan natijalar (jonli)

```
/api/me                       -> 200, 1 DB so'rov
/api/event (yuklab olish)     -> 200, 1 DB so'rov (mh_download bor bo'lsa)
/api/event (migratsiyasiz)    -> 200, 4 DB so'rov (zaxira yo'l, avtomatik)
/api/event (kredit 0)         -> 402, fayl yaratilmaydi
/api/event (refund)           -> 200, kredit qaytadi
/supabase-optimize.sql        -> text/html (fayl ommaviy emas)
```
