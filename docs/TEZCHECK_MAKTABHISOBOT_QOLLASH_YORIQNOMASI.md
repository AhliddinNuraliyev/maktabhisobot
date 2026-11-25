# TEZCHECK.UZ → MAKTABHISOBOT.UZ qo‘llash (integratsiya) yo‘riqnomasi

**Hujjat holati:** tadqiqot va tayyorgarlik. **Hech narsa joriy qilinmadi, kod o‘zgartirilmadi, deploy qilinmadi.**
**Tayyorlangan sana:** 21.11.2026
**Manbalar:** `https://tezcheck.uz` (asosiy sahifa, API hujjatlari, huquqiy hujjatlar, yordam, status), `https://maktabhisobot.uz` (tirik sayt) va ish maydonidagi haqiqiy manba kod (`index.html`, `api/*`, `supabase-encrypt-setup.ps1`).

> Muhim: `index.html` ning mahalliy nusxasi bilan tirik saytdagi nusxasi MD5 bo‘yicha bir xil (`733320c4...`). Demak, pastdagi tahlil aynan hozir ishlab turgan tizimga tegishli.

---

## 0. Qisqa xulosa

| Savol | Javob |
|---|---|
| Tezcheck.uz nima? | O‘zbekistondagi to‘lov agregatori: Click, Payme, Uzcard/Humo va boshqa provayderlarni **bitta REST API + imzolangan webhook** orqali qabul qilish platformasi. |
| Maktabhisobot.uz nima? | Maktab o‘qituvchilari uchun elektron hisobot tizimi (BSB, CHSB, LI, kuratorlik, choraklik hisobotlar; emaktab.uz jurnalidan Excel import; PDF/Excel eksport). |
| Ikkisini nima bog‘laydi? | **To‘lov → huquq (Premium tarif)** oqimi. Hozir maktabhisobot.uz da to‘lov kodi yo‘q: `premium` ni faqat admin qo‘lda `/api/admin/premium` orqali yoqadi. |
| Integratsiya qanday ishlashi kerak? | Foydalanuvchi saytda “Premium sotib olish” tugmasini bosadi → **bizning serverimiz** Tezcheck API orqali hisob (bill) yaratadi → `payment_url` ga o‘tadi → to‘lovdan keyin Tezcheck **imzolangan webhook** yuboradi → server uni tekshirib, `mh_users.is_premium = true` qiladi. |
| Eng katta xavf nima? | Tezcheckning **“Foydalanish shartlari” va “Savdogar shartlari” hali placeholder** matn (`Publish the approved ... before this platform accepts real money`). Haqiqiy pul qabul qilishdan oldin bu hujjatlar tasdiqlanishi shart. |
| Hozir nima qilish kerak? | Faqat Tezcheckda ro‘yxatdan o‘tib, kassa/API kalit/webhook uchun ma’lumotlarni olish. Keyin birga joriy qilamiz. |

---

## 1. TEZCHECK.UZ chuqur tahlili

### 1.1. Platforma haqida

- **Asosiy manzil:** `https://tezcheck.uz`
- **API manzili:** `https://api.tezcheck.uz/api/merchant/v1`
- **API hujjatlari (hisobsiz ochiq):** `https://tezcheck.uz/api-docs`
- **Tizim holati (hisobsiz ochiq):** `https://tezcheck.uz/status`
- **Monitoring:** `GET /api/merchant/v1/health` — kalit talab qilmaydi
- **Yordam:** `https://tezcheck.uz/help`; Telegram: `@call_menejer`, kanal: `@tezcheck`
- **E-pochta:** `info@tezcheck.uz`
- **Tillar:** uz / ru / en
- **Huquqiy shaxs:** O‘O‘BQ “Olloyor Mamasaidov” (Farg‘ona viloyati, Quva tumani)
- **Huquqiy hujjatlar versiyasi:** `2026-09.1`, kuchga kirgan `17.09.2026`
  - `/legal/public_offer`, `/legal/intermediary_agreement`, `/legal/privacy`, `/legal/consent`, `/legal/terms`, `/legal/merchant_terms`, `/legal/gift_agreement`

Asosiy sahifadagi va’dalar: karta ma’lumotlari platformada saqlanmaydi; to‘lov faqat provayder tasdig‘i bilan yakunlanadi; maxfiy kalitlar interfeysda ko‘rsatilmaydi; har bir amal audit iziga tushadi.

### 1.2. Imkoniyatlar

- To‘lov havolalari: bir martalik yoki qayta ishlatiladigan, belgilangan yoki mijoz kiritadigan summa.
- Moslashgan to‘lov sahifasi (`payment_url`).
- Kassalar: har bir savdo nuqtasi/kanal uchun alohida kassa va alohida hisobot.
- Ikkitaliq yozuv (ledger), cheklar (7 kun ochiladi), audit izi.
- REST API + imzolangan webhook + idempotency.
- «Test provider» — alohida kalitsiz sinov to‘lovlari.

### 1.3. Ro‘yxatdan o‘tish va faollashtirish (siz hozir qilayotgan bosqich)

`https://tezcheck.uz/register` dagi 3 bosqich:

1. **Ma’lumotlar:** ism, familiya, telefon (`+998`) **yoki** e-pochta, shartlarga rozilik. Google orqali ham kirish mumkin.
2. **Tasdiqlash:** telefon SMS kod bilan, yoki e-pochta orqali. Telefonni keyinroq tasdiqlash mumkin, **lekin kassa ochishdan oldin majburiy**.
3. **Parol** + ikki bosqichli himoyani yoqish (tavsiya qilinadi).

Keyingi bosqichlar (kabinetda):

4. **Shaxsni tasdiqlash** — odam ko‘rib chiqadi, odatda bir necha ish kuni. Tasdiqlanmaguncha savdo arizasini yuborib bo‘lmaydi.
5. **Savdogar arizasi** → tasdiqlangach kassa ochish ruxsati.
6. **Kassa yaratish:** nom, valyuta (faqat UZS), to‘lov usullari, `return_url` ruxsat ro‘yxati, IP oq ro‘yxati (IPv4/IPv6/CIDR).
7. **API kalit yaratish:** tashkilot darajasida (barcha kassalar) yoki bitta kassaga biriktirilgan. Kalit faqat bir marta to‘liq ko‘rsatiladi/keyin qayta nusxalanadi.
8. **Webhook endpoint qo‘shish:** HTTPS, tashqi tarmoqdan ochiq bo‘lishi shart; imzo maxfiy kaliti (`whsec_...`) bir marta ko‘rsatiladi.
9. **Sinov:** «Test provider» orqali to‘lov. `endpoint: "test"` / `livemode: false` bilan keladi, balansga tushmaydi, 1 kundan keyin bekor qilingan holatda qoladi.

### 1.4. Autentifikatsiya va xavfsizlik

Har bir so‘rovda ikki qiymat:

| Qiymat | Qayerda | Ma’nosi |
|---|---|---|
| API kalit (`aps_...`) | `Authorization: Bearer ...` | **Sir.** Kim chaqirayotgani. |
| Kassa kodi (`cdk_...`) | `X-Cash-Desk-Code: ...` | Sir emas. Qaysi kassa haqida ekani. Yolg‘iz huquq bermaydi. |

Muhim qoidalar:

- API’ni **faqat serverdan** chaqirish kerak, brauzerdan emas.
- Kalit tashkilot darajasida bo‘lsa, `X-Cash-Desk-Code` shart; bitta kassaga biriktirilgan bo‘lsa, boshqa kassa kodi → `auth.permission_denied`.
- Kalit almashtirilganda **eskisi 24 soat yashaydi**. Shoshilinch bo‘lsa “eskisini darhol o‘chirish” belgisini qo‘yish kerak.
- IP ro‘yxati bo‘sh bo‘lsa, hech qanday manzil cheklanmaydi; to‘ldirilsa, ruxsat etilmagan IP dan `auth.forbidden`.
- **Ixtiyoriy imzolangan so‘rovlar:** `X-TezCheck-Timestamp` (unix soniya) va `X-TezCheck-Signature: v1=<hex>`:
  ```
  {timestamp}.{METHOD}.{path+query}.{sha256_hex(body)}
  ```
  HMAC-SHA256, kalit bilan. Vaqt ±300 s. Har bir imzo **bir marta** ishlaydi → har bir retry yangi vaqt bilan qayta imzolanadi. Ikkala headerdan biri kelsa, ikkalasi ham to‘g‘ri bo‘lishi shart. Kabinetda “faqat imzolangan” yoqilsa, imzosiz so‘rov `request.signature_invalid (signature.required)`.
- **Idempotency-Key:** `POST /bills`, `/cancel`, `/reissue` uchun. 1–128 ASCII belgi. 24 soat eslab qolinadi. Qayta yuborsangiz birinchi javob `Idempotent-Replayed: true` bilan qaytadi, ikkinchi hisob yaratilmaydi. Boshqa tana/yo‘l bilan same kalit → `409 request.idempotency_key_reused`.

### 1.5. Summalar

- Hammasi **tiyin** da, butun son: `1 so‘m = 100 tiyin`. `150 000 so‘m = 15 000 000`.
- Kasr yubormang — yaxlitlanadi.
- Faqat **UZS**. So‘rovda `currency` yuborilmaydi, javobda har doim `UZS`.
- Standart minimal summa `100 000` tiyin = **1 000 so‘m**; chegaradan chiqsa `422 payment_link.amount_out_of_range`.

### 1.6. Endpointlar to‘liq ro‘yxati

Bazaviy URL: `https://api.tezcheck.uz/api/merchant/v1`

| # | Endpoint | Auth | Kassa | Vazifa |
|---|---|---|---|---|
| 1 | `GET /me` | ha | ixtiyoriy | Kalit/kassa bog‘lanishini tekshirish. `token_hint`, `request_signed`, `signed_requests_required`. |
| 2 | `POST /cash-desks` | ha | **yo‘q** | Kalit ko‘radigan kassalar ro‘yxati va `code` larni olish. |
| 3 | `POST /bills` | ha | ha | Buyurtma uchun hisob yaratish, `payment_url` olish. |
| 4 | `POST /bills/{bill}` | ha | ha | Hisob va to‘lov holatini so‘rab olish (webhookni tekshirish uchun). |
| 5 | `POST /bills/{bill}/cancel` | ha | ha | Havolani o‘chirish (qaytarib bo‘lmaydi). |
| 6 | `POST /transactions` | ha | ha | Kassaning to‘lovlar oqimi, kursorli sahifalash. |
| 7 | `POST /balance` | ha | ha | Tashkilot balansi (kassaga emas). |
| 8 | `POST /stats` | ha | ha | Bugun/kecha/7 kun/30 kun statistikasi (`Asia/Tashkent`). |
| 9 | `POST /payment-methods` | ha | ha | Haqiqatda tanlab bo‘ladigan to‘lov usullari. |
| 10 | `POST /bills/{bill}/reissue` | ha | ha | Yo‘qolgan havolani **yangisiga almashtirish** (eskisi o‘ladi). |
| 11 | `GET /health` | yo‘q | yo‘q | Monitoring: `{"data":{"status":"ok"}}` |

**`POST /bills` tanasi:**

```json
{
  "amount_minor": 15000000,
  "title": "Premium obuna",
  "description": "...",
  "external_reference": "mh:<user-id>:premium-30d:<timestamp>",
  "return_url": "https://maktabhisobot.uz/malumotlarim",
  "allowed_provider_codes": ["click", "payme"]
}
```

Javobda: `bill.id` (`link_...`), `bill.reference`, `bill.state`, `available_until`, va **`payment_url` — faqat bir marta qaytariladi**. Uni darhol bazaga saqlash kerak; yo‘qotsa `reissue` yangi token beradi va eskisini o‘chiradi.

**`POST /bills/{bill}` javobining muhim qismlari:**

- `bill.paid`, `bill.livemode`, `bill.environment`, `bill.unavailability_reason`
- `payment.state`, `payment.amount_minor`, `payment.fee_minor`, `payment.net_minor`, `payment.succeeded_at`
- `payment_url` bu yerda **har doim `null`** — bu normal.
- **To‘langanligini `bill.state` ga qarab emas, `bill.paid` ga qarab tekshirish kerak**: to‘langan hisob keyinchalik `expired` bo‘lib qolishi mumkin, lekin pul kelgan.

**To‘lov holatlari:** `draft`, `open`, `requires_action`, `processing`, `succeeded`, `failed`, `canceled`, `expired`, `partially_refunded`, `refunded`, `disputed`, `charged_back`.
**Hisob holatlari:** `draft`, `active`, `paused`, `expired`, `exhausted`, `revoked`.
**Kassa holatlari:** `draft`, `active`, `paused`, `suspended`, `archived`.

### 1.7. Webhook — eng muhim qism

**Headerlar:**

```
POST /webhooks/tezcheck HTTP/1.1
Content-Type: application/json
User-Agent: Checkout-Webhooks/1.0
Cache-Control: no-store
X-Checkout-Event: payment.succeeded
X-Checkout-Event-Id: oev_...
X-Checkout-Delivery: whd_...
X-Checkout-Timestamp: 1786000000
X-Checkout-Signature: v1=...,v1=...
```

**Imzo:** `HMAC-SHA256(secret, "{timestamp}.{delivery_id}.{raw_body}")`, natija `v1=<hex>`.

- **Xom body** hashlanadi: `json_decode` qilib qayta `encode` qilish mumkin emas (kalit tartibi/slash/unicode o‘zgaradi).
- `v1=` prefiksini tekshirish kerak (kelajakdagi `v2` jimgina qabul qilinib ketmasligi uchun).
- Vaqt 5 minutdan eski bo‘lsa rad etish kerak.
- Kalit almashuvi paytida headerda **ikki imzo** vergul bilan keladi → har birini tekshirish, `hash_equals` ishlatish.
- **Dedup qilish `X-Checkout-Event-Id` bo‘yicha emas, tanadagi `id` bo‘yicha.** Qayta yuborishda header yangi, tana `id` bir xil bo‘ladi.
- `X-Checkout-Delivery` faqat qo‘llab-quvvatlash uchun; u bo‘yicha dedup qilish noto‘g‘ri.

**Tana (muvaffaqiyatli):**

```json
{
  "id": "oev_...",
  "type": "payment.succeeded",
  "schema_version": 1,
  "created_at": "...",
  "mode": "test",
  "organization_id": "90010",
  "cash_desk_id": "90001",
  "data": {
    "payment_id": "pay_...",
    "state": "succeeded",
    "previous_state": "processing",
    "amount_minor": 15000000,
    "currency": "UZS",
    "cash_desk_public_id": "90001",
    "external_reference": "mh:...",
    "bill_id": "link_...",
    "payment_channel": "web",
    "fee_minor": 150000,
    "net_minor": 14850000,
    "succeeded_at": "...",
    "provider_code": "payme",
    "environment": "live",
    "reason_code": null,
    "problem": null,
    "sequence": 4
  }
}
```

> **Tuzoq:** yuqoridagi `mode` barcha hodisalarda `test` bo‘lishi mumkin (bu konvert xususiyati). Ishonchli qiymat — **`data.environment`** (`live` / `test`).

**Hodisa turlari:** `payment.draft`, `open`, `requires_action`, `processing`, `succeeded`, `failed`, `canceled`, `expired`, `partially_refunded`, `refunded`, `disputed`, `charged_back`.

**Yetkazib berish:**

- Standart: **1 urinish**, qayta urinish yo‘q. Kabinetda yoqsangiz: jami 3 urinish (0s / 5s / 5s, ±25% tasodifiy siljish).
- Qayta urinadi: `5xx`, timeout, tarmoq xatoliklari, `429`.
- Qayta urinmaydi: boshqa `4xx` (jumladan `408`), `3xx` (redirect kuzatilmaydi).
- Oxirgi urinish ham o‘tmasa → `dead_lettered`, keyin qo‘lda qayta yuborish.
- Endpoint **2xx** qaytarishi shart; ulanish 5 s, umumiy 10 s chegara; TLS haqiqiy bo‘lishi shart.

**“Muammoli to‘lov” qoidasi (eng muhim biznes qoidasi):**

| Holat | Nima qilish |
|---|---|
| `problem == null`, `state == succeeded`, `livemode == true` | Pul kelgan — huquqni bering. |
| `problem` bor, `unknown_reason == null` | Aniq rad etish — buyurtmani bekor qiling, mijozga ayting. |
| `problem` bor, `unknown_reason != null` | **Natija noma’lum** — hech narsa qilmang: na bering, na bekor qiling, na qayta pul yechishga undang. `POST /bills/{bill}` yoki keyingi webhookni kuting. |
| `requires_action` / `processing`, `problem` yo‘q | Mijoz hali tugatmagan — kuting. |

`problem.category` ochiq ro‘yxat (`insufficient_funds`, `provider_declined`, `timeout`, `network`, `unknown` va h.k.) → kodda “qolgan hollar” tarmog‘i bo‘lishi shart. `unknown_reason` qiymatiga **qarab emas, mavjudligiga qarab** tarmoqlanish kerak.

### 1.8. Xato kodlari (qisqa)

| Kod | HTTP | Retry |
|---|---|---|
| `auth.unauthenticated`, `request.signature_invalid`, `request.timestamp_out_of_window`, `request.nonce_replayed` | 401 | yo‘q |
| `auth.permission_denied`, `auth.forbidden`, `merchant.suspended` | 403 | yo‘q |
| `resource.not_found`, `resource.state_invalid`, `request.idempotency_key_reused`, `resource.conflict` | 404/409 | yo‘q |
| `request.validation_failed`, `payment_link.amount_out_of_range`, `payment.currency_unsupported` | 422 | yo‘q |
| `request.rate_limited` | 429 | ha |
| `server.internal_error` | 500 | ha |

Har bir javobda `X-Request-Id` bor — qo‘llab-quvvatlashga yozganda shu qiymatni qo‘shish kerak.

### 1.9. Cheklovlar

- **300 so‘rov / daqiqa**
- `POST /transactions`: standart 25, maksimum 200 yozuv; kursorli sahifalash (`meta.next_cursor === null` bo‘lguncha)
- Webhook: 1 (yoki yoqilsa 3) urinish; 10 s umumiy vaqt
- Kalit almashuvi: 24 soat

### 1.10. Iqtisodiy va huquqiy shartlar

**`/legal/intermediary_agreement` (Vositachilik shartnomasi):**

| To‘lov turi | Miqdor |
|---|---|
| Xizmat komissiyasi | **3% – 5%** (alohida kelishuv bilan belgilanadi) |
| Integratsiya to‘lovi | **0 so‘m** |
| “Rasmiy” belgisi | 9 900 so‘m (bir marta) |
| Penalti (kechiktirilgan o‘tkazma) | **0.03% / kun** |
| Pul o‘tkazish muddati | topshiriq bajarilgandan keyin **1–5 ish kuni** |

Pul yechib olish **qo‘lda so‘rov** bilan amalga oshiriladi: “Muvaffaqiyatli to‘langan to‘lovlarni yechib olish uchun mijoz Vositachini xabardor qilishi shart”.

**`/legal/public_offer`:** platformaga ro‘yxatdan o‘tish orqali oferta qabul qilingan hisoblanadi; shartlarni saytda e’lon qilish orqali bir tomonlama o‘zgartirish mumkin (15 kalendar kungacha); nizo: Termiz tumanlararo sudi yoki javobgar joyi bo‘yicha sud; aloqa: `info@tezcheck.uz`.

**`/legal/privacy`:** shaxsga doir ma’lumotlar O‘zbekiston qonuni (`O‘RQ-547`, 02.07.2019) bo‘yicha qayta ishlanadi; ma’lumot so‘rovi 30 kun (zarur bo‘lsa 60 kun) ichida ko‘rib chiqiladi; ma’lumotlar O‘zbekiston ichida va tashqarisida, jumladan vakolatli tashkilotlarga uzatilishi mumkin; karta ma’lumotlari to‘lov tizimida qayta ishlanadi.

**⚠️ Kritik:** `/legal/terms` va `/legal/merchant_terms` sahifalarida hali **placeholder** matn turibdi:

> “Placeholder text. Publish the approved Foydalanish shartlari as a new version before this platform accepts real money.”
> “Placeholder text. Publish the approved Savdogar shartlari as a new version before this platform accepts real money.”

**Haqiqiy pul qabul qilishdan oldin bu ikki hujjatning tasdiqlangan nashri chiqarilishini talab qilish kerak.**

**⚠️ Komissiya ziddiyati:** shartnomada 3–5% yozilgan, API hujjatlaridagi namunada `fee_minor = 150000` / `amount_minor = 15000000` = **1%**. Aniq stavkani yozma ravishda tasdiqlash va hisoblashda **har doim webhook dagi `net_minor` dan foydalanish** kerak.

---

## 2. MAKTABHISOBOT.UZ chuqur tahlili

### 2.1. Arxitektura

- **Frontend:** bitta `index.html` (Tailwind CDN), `choraklik.js`, vanilla JS. Vercel static + serverless (`vercel.json`: `/api/` dan boshqalari `index.html` ga rewrite).
- **Backend:** Node.js serverless funksiyalar: `api/_lib.js`, `me.js`, `telegram-login.js`, `logout.js`, `profile.js`, `event.js`, `send.js`, `admin/users.js`, `admin/premium.js`.
- **Ma’lumotlar bazasi:** Supabase/Postgres, bitta jadval `mh_users`.
- **Sessiya:** `mh_session` cookie (HttpOnly, Secure, SameSite=Lax, 30 kun), JWT HS256 (`SESSION_SECRET`).
- **Kirish:** Telegram Login Widget (`data-request-access=write`), server hashni `TELEGRAM_BOT_TOKEN` bilan tekshiradi.
- **Bot username:** `maktabhisobotuz_bot` (`/api/me` orqali ochiq ma’lumot).

### 2.2. `mh_users` jadvali

```sql
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
```

RLS yoqilgan, `service_role` ga to‘liq huquq. Hisoblagich uchun `mh_bump(p_uid uuid, p_kind text)` RPC bor.

### 2.3. Mavjud API’lar

| Endpoint | Vazifa |
|---|---|
| `GET /api/me` | `authenticated`, `user`, `profile`, `stats {downloads, premium}`, `premium`, `isAdmin`, `botUsername` |
| `POST /api/telegram-login` | Telegram widget ma’lumotini tekshirib, foydalanuvchi yaratadi/yangilaydi, cookie o‘rnatadi |
| `POST /api/logout` | Cookieni o‘chiradi |
| `POST /api/profile` | `viloyat`, `tuman`, `maktab`, `oqituvchi` ni bulutga saqlaydi |
| `POST /api/event` | `kind`: `download_pdf`, `download_xlsx`, `import_excel` → `mh_bump` |
| `GET /api/admin/users` | Faqat admin: foydalanuvchilar va statistikasi |
| `POST /api/admin/premium` | Faqat admin: `id` (UUID) + `premium` boolean → `is_premium` ni o‘zgartiradi |
| `POST /api/send` | Faylni Telegram bot orqali `chat_id` ga yuboradi (**avtorizatsiya yo‘q** — xavf) |

### 2.4. Modullar va foydalanuvchi oqimi

`home`, `bsb`, `chsb`, `li`, `kuratorlik`, `choraklik`, `malumotlarim`, `admin`.

BSB oqimi:
1. Hisobot ma’lumotlari (sinf, harf, fan, chorak, tartib raqami).
2. O‘quvchilar ro‘yxati — emaktab.uz dan eksport qilingan `.xls/.xlsx` yoki qo‘lda qo‘shish; `localStorage['bsb1']` da saqlanadi.
3. Ballar: savollar soni (1–16), har savol uchun mezon, “5/4/3” foiz chegaralari (standart 86/66/30).
4. Hisobot: PDF / Excel eksport, diagrammalar.

Eksport oldidan **ikki bosqichli tekshiruv**: doimiy profil (`viloyat`, `tuman`, `maktab`, `o‘qituvchi`) + hisobot maydonlari (`sinf`, `harf`, `fan`, `chorak`, `bsb`).

### 2.5. “Premium” hozir nima qiladi?

**Faqat ko‘rinishda:** “Hisob holati” kartasida `Premium / Oddiy`, “Barcha imkoniyatlar yoqilgan / Standart hisob” va ism yonida `PRO` badge.

Kodda `AUTH.premium` hech qayerda funksiyalarni ochib/yopib turmaydi. Ya’ni **hozir Premium uchun pul oladigan narsa aniqlanmagan**. Bu integratsiyadan oldin hal qilinishi shart.

### 2.6. Maktabhisobot tarafdagi xavflar

1. **`POST /api/send` ochiq** — istalgan kishi istalgan `chat_id` ga bot orqali fayl yuborishi mumkin. Pul oqimi qo‘shilishdan oldin sessiya tekshiruvi qo‘yish kerak.
2. **`BOT_TOKEN` / `TELEGRAM_BOT_TOKEN` nomlarining mos kelmasligi:** `_lib.js` ikkalasini qabul qiladi, `send.js` faqat `BOT_TOKEN` ni ishlatadi.
3. **`ADMIN_TELEGRAM_IDS` mahalliy `.env.local` da yo‘q** — ishlab chiqarishda Vercel tarafida o‘rnatilgan bo‘lishi kerak.
4. **Foydalanuvchi hisobot ma’lumotlari faqat brauzerda** (`localStorage`), bulutda faqat profil va hisoblagich bor. To‘lov bilan bog‘lashda shaxsga doir ma’lumotlarni `external_reference`/`description` ga yozish mumkin emas — faqat ichki UUID va tarif kodi.

---

## 3. Taklif etiladigan integratsiya arxitekturasi

```
[O‘qituvchi] ──(1) “Premium sotib olish”──> [maktabhisobot.uz serveri]
                                                  │ (2) POST /bills
                                                  ▼
                                             [Tezcheck API]
                                                  │ payment_url
                                                  ▼
[O‘qituvchi] ──(3) karta/Click/Payme──> [To‘lov provayderi]
                                                  │ (4) imzolangan hodisa
                                                  ▼
[maktabhisobot.uz /api/billing/webhook/tezcheck]
        (5) imzo + vaqt + dedup + environment + problem tekshiruvi
                                                  │ (6) tranzaksiya ichida
                                                  ▼
                                     [mh_users.is_premium = true]
                                                  │
                                                  ▼
                              (7) UI: PRO badge yangilanadi, xabar yuboriladi
```

### 3.1. Asosiy printsiplar

1. **API kalit hech qachon brauzerga tushmaydi.** Faqat server tomonida `process.env.TEZCHECK_API_KEY`.
2. **To‘lov haqiqatining yagona manbai — webhook yoki server tomonidan so‘ralgan `POST /bills/{bill}`.** Brauzerning `return_url` ga qaytishi hech qachon huquq bermaydi.
3. **Idempotency har ikki tomonda:** Tezcheckga `Idempotency-Key`, bizning webhook handlerimizda hodisa `id` bo‘yicha dedup.
4. **Faqat `data.environment === "live"` bo‘lganda haqiqiy huquq berish.** Test to‘lovda `paid: true` bo‘ladi, lekin `livemode: false`.
5. **`net_minor` bilan ishlash**, `amount_minor` bilan emas (komissiya shartnomadagi 3–5% yoki API namunasidagi 1% bo‘lishidan qat’i nazar).
6. **`unknown_reason` bo‘lsa hech qanday harakat qilmaslik** — keyingi hodisa yoki so‘rov hal qiladi.

### 3.2. Ma’lumotlar modeliga qo‘shish taklifi (keyinchi bosqich)

Yangi jadval `mh_payments` (yoki `mh_orders`):

| Ustun | Ma’nosi |
|---|---|
| `id uuid pk` | ichki buyurtma |
| `user_id uuid` → `mh_users.id` | kim sotib oldi |
| `plan_code text` | masalan `premium_30d` |
| `amount_minor int` | so‘ralgan summa |
| `currency text` | `UZS` |
| `bill_id text` | Tezcheck `link_...` |
| `bill_reference text` | `BILL-...` |
| `payment_id text` | `pay_...` (kelgach) |
| `external_reference text unique` | `mh:<user_uuid>:<plan>:<timestamp>` |
| `payment_url text` | bir marta olingan havola |
| `state text` | `created / paid / failed / canceled / refunded` |
| `net_minor`, `fee_minor int` | webhookdan |
| `environment text` | `live / test` |
| `raw_event jsonb` | audit uchun xom hodisa |
| `created_at`, `paid_at` | vaqtlar |

Yangi jadval `mh_webhook_events`:

| Ustun | Ma’nosi |
|---|---|
| `event_id text primary key` | tana ichidagi `id` — dedup kaliti |
| `type text`, `delivery_id text` | ma’lumot |
| `processed_at timestamptz` | qachon qayta ishlangan |

`mh_users` ga qo‘shish taklifi: `premium_until timestamptz` (agar obuna muddatli bo‘lsa). Hozircha `is_premium` yetarli, lekin muddatli tarif sotish uchun `premium_until` kerak bo‘ladi.

### 3.3. Yangi server endpointlari (tavsiya)

| Endpoint | Auth | Vazifa |
|---|---|---|
| `POST /api/billing/create-payment` | `mh_session` cookie majburiy | Foydalanuvchi ichki buyurtmasini yaratadi, Tezcheckga `/bills` chaqiradi, `payment_url` qaytaradi. |
| `POST /api/billing/webhook/tezcheck` | **yo‘q** (faqat HMAC) | Imzo/vaqt/dedup tekshiradi, `mh_payments` va `mh_users` ni atomik yangilaydi. |
| `GET /api/billing/status?ref=...` | cookie | Foydalanuvchi o‘z buyurtmasi holatini ko‘radi (webhook kutmadan). |
| `POST /api/billing/reconcile` | faqat admin/cron | `POST /transactions` orqali kun oxirida solishtirish. |

### 3.4. Hisob yaratish namunasi (keyin joriy qilish uchun)

```bash
curl -X POST https://api.tezcheck.uz/api/merchant/v1/bills \
  -H "Authorization: Bearer $TEZCHECK_API_KEY" \
  -H "X-Cash-Desk-Code: $TEZCHECK_CASH_DESK_CODE" \
  -H "Idempotency-Key: order-mh-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_minor": 4900000,
    "title": "Maktab Hisobot — Premium 30 kun",
    "external_reference": "mh:9b1f...:premium_30d:1795260000",
    "return_url": "https://maktabhisobot.uz/malumotlarim?payment=returned"
  }'
```

> Eslatma: `return_url` kassaning ruxsat ro‘yxatiga kiritilgan bo‘lishi shart, aks holda checkout qaytarmaydi.

### 3.5. Webhook tekshiruvi namunasi (Node.js, mavjud `_lib.js` uslubida)

```js
const crypto = require('crypto');
const SECRET = process.env.TEZCHECK_WEBHOOK_SECRET || '';

function verify(rawBody, headers) {
  const ts = String(headers['x-checkout-timestamp'] || '');
  const delivery = String(headers['x-checkout-delivery'] || '');
  const sig = String(headers['x-checkout-signature'] || '');

  if (!ts || !delivery || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;

  const expected = 'v1=' + crypto
    .createHmac('sha256', SECRET)
    .update(ts + '.' + delivery + '.' + rawBody)
    .digest('hex');

  // Kalit almashuvi paytida bir nechta v1 keladi
  return sig.split(',').some(candidate =>
    crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(candidate.trim())
    )
  );
}

// Muhim: rawBody ni o'zgartirmang (json parse qilib qayta stringify qilmang).
// Muhim: dedup — event.id (tanadagi id), headerdagi X-Checkout-Event-Id emas.
// Muhim: 200 ni faqat bazaga yozgandan keyin qaytaring; xatolik bo'lsa 5xx qaytaring.
```

`req.body` allaqachon parse qilingan bo‘lsa, xom body `.rawBody` yoki Vercel `req` config orqali olinishi kerak — buni joriy qilishda alohida tekshirish kerak.

### 3.6. Huquq berish qoidasi (pseudokod)

```text
hodisa = parse(rawBody)

agar event.id allaqachon mh_webhook_events da -> 200 (hech narsa qilma)

agar verify() == false                       -> 401
agar hodisa.type "payment." bilan boshlanmagan -> 200 (e'tiborsiz)
agar data.environment != "live"               -> 200 (test, huquq yo'q)
agar data.problem != null                     -> 200 (buyurtmani "failed" qil, huquq yo'q)
agar data.state != "succeeded"                -> 200 (kutishda)
agar data.net_minor < buyurtma.amount_minor   -> 200 (ogohlantirish + audit)

tranzaksiya boshlash:
  mh_payments ni payment_id/bill_id bo'yicha yangilash (state=paid, net, fee)
  mh_users.is_premium = true (yoki premium_until = now() + 30 kun)
  mh_webhook_events ga event.id ni kiritish
tranzaksiya tugash

200 qaytarish + (ixtiyoriy) Telegram orqali xabar
```

---

## 4. Bosqichma-bosqich yo‘l xaritasi (hali boshlanmadi)

### Bosqich 0 — Qarorlar (siz bilan kelishish kerak)

- [ ] Premium nima ochadi? (PDF/Excel cheksiz yuklab olishmi? CHSB/LI/kuratorlik modullarini ochishmi? Obuna muddati bormi?)
- [ ] Narx(lar): masalan Premium 30 kun = 49 000 so‘m (`4 900 000` tiyin). Minimum 1 000 so‘m.
- [ ] Sotuvchi kim: O‘qituvchimi, maktabmi, yoki loyiha egasining O‘O‘BQ sifatidami?
- [ ] Qaytarish (refund) siyosati: `refunded` / `charged_back` kelganda premium o‘chiriladimi?
- [ ] `PREMIUM_UNLOCKS` ro‘yxati aniqlandimi?

### Bosqich 1 — Tezcheck hisobini tayyorlash (siz qilyapsiz)

- [ ] Ro‘yxatdan o‘tish (telefon/email OTP), 2FA yoqish.
- [ ] Shaxsni tasdiqlash (bir necha ish kuni).
- [ ] Savdogar arizasi tasdiqlanishi.
- [ ] **Kassa yaratish** — sinov va jonli to‘lovlar uchun alohida kassalar tavsiya etiladi.
- [ ] Kassada to‘lov usullarini yoqish (Click, Payme va h.k.), `payment-methods` bilan ro‘yxatni solishtirish.
- [ ] `return_url` = `https://maktabhisobot.uz/malumotlarim` ni ruxsat ro‘yxatiga kiritish.
- [ ] Server IP manzillarini IP oq ro‘yxatiga kiritish (Vercel serverless da chiqish IP lari o‘zgaruvchan bo‘lishi mumkin — **bu muhim cheklov**).
- [ ] API kalit yaratish (`aps_...`) va kassa kodi (`cdk_...`) ni olish.
- [ ] Webhook endpoint manzilini ro‘yxatdan o‘tkazish (keyin: `https://maktabhisobot.uz/api/billing/webhook/tezcheck`), `whsec_...` ni olish.
- [ ] Komissiya stavkasini va pul yechish tartibini yozma tasdiqlash.
- [ ] Placeholder hujjatlar (`terms`, `merchant_terms`)ning tasdiqlangan versiyasini so‘rash.

**Menga keyin beradigan ma’lumotlar (maxfiy bo‘lsa ham, faqat server `.env` ga yoziladi, javobda chiqarilmaydi):**

```text
TEZCHECK_API_KEY=aps_...
TEZCHECK_CASH_DESK_CODE=cdk_...
TEZCHECK_WEBHOOK_SECRET=whsec_...
TEZCHECK_ORGANIZATION_ID=...
TEZCHECK_CASH_DESK_ID=...
```

### Bosqich 2 — Sinov (joriy qilishdan oldin)

1. `GET /me` — kalit va kassa bir-biriga tegishli ekanini tasdiqlash.
2. `POST /cash-desks` — kassa kodini olish, `accepts_payments: true` ekanini tekshirish.
3. `POST /payment-methods` — tanlab bo‘ladigan usullar ro‘yxati.
4. `POST /bills` — sinov havolasi yaratish, `payment_url` ni saqlash.
5. «Test provider» orqali to‘lov qilish.
6. Webhook kelganini tekshirish: `data.environment === "test"` → **premium berilmasligi kerak**.
7. `POST /bills/{bill}` bilan so‘rab tekshirish.
8. Idempotency: bir xil `Idempotency-Key` bilan ikki marta yuborish → bitta hisob.
9. Takroriy webhook: bir xil tana ikki marta kelsa → bitta yozuv.
10. Noto‘g‘ri imzo, eski timestamp, `v2` prefiks → rad etilishi kerak.

### Bosqich 3 — Kod va baza (keyinchalik, birga)

- `mh_payments`, `mh_webhook_events` jadvallari; kerak bo‘lsa `premium_until`.
- `api/billing/*.js` fayllari.
- `index.html` ga “Tarif sotib olish” tugmasi va holat ko‘rsatkichi.
- `/api/send` ga avtorizatsiya qo‘yish.
- Vercel muhitiga 3 ta yangi secret qo‘yish.

### Bosqich 4 — Jonli sinov va ishga tushirish

- Kichik haqiqiy summa bilan bir to‘lov (masalan 1 000 so‘m).
- `data.environment === "live"` ekanini va premium yoqilganini tekshirish.
- Webhook qayta urinishlarini yoqish (3 urinish).
- Kunlik `POST /transactions` solishtirish cron jobi.
- Monitoring: `GET /health`, `https://tezcheck.uz/status`.

---

## 5. Sinov nazorat ro‘yxati (checklist)

| # | Tekshiruv | Kutilgan natija |
|---|---|---|
| 1 | `GET /api/merchant/v1/health` | `status: ok`, kalitsiz |
| 2 | `GET /me` noto‘g‘ri kalit bilan | `401 auth.unauthenticated` |
| 3 | `POST /cash-desks` kassa headersiz | barcha ruxsat etilgan kassalar |
| 4 | `POST /bills` 999 so‘m | `422 payment_link.amount_out_of_range` |
| 5 | `POST /bills` 1 000 so‘m | muvaffaqiyat, `payment_url` |
| 6 | Ikki marta bir xil `Idempotency-Key` | bitta hisob, `Idempotent-Replayed: true` |
| 7 | `payment_url` ni ikkinchi marta olish | imkon yo‘q; `reissue` yangi havola beradi, eskisi o‘ladi |
| 8 | Test provider to‘lovi | `paid: true`, lekin `livemode: false` → **premium yo‘q** |
| 9 | Jonli to‘lov webhooki | `environment: live`, `problem: null` → premium bor |
| 10 | Webhook ikki marta kelsa | bitta yozuv (dedup bo‘yicha `id`) |
| 11 | Noto‘g‘ri imzo | `401` va hech qanday o‘zgarish yo‘q |
| 12 | 5 daqiqadan eski timestamp | rad etiladi |
| 13 | `unknown_reason` to‘ldirilgan hodisa | hech qanday harakat yo‘q |
| 14 | `refunded` hodisa | premium qaytarib olinadi (siyosat bo‘yicha) |
| 15 | Kassa asosiy havolasi pauzada | `409 cash_desk.default_link_not_active` |
| 16 | Kalit almashtirish | eski kalit 24 soat ishlaydi, ikki imzo qabul qilinadi |
| 17 | `POST /transactions` sahifalash | `next_cursor === null` bo‘lguncha o‘qiladi |
| 18 | `POST /api/send` avtorizatsiyasiz | keyin **rad etilishi** kerak |

---

## 6. Ochiq savollar va xavflar (birga hal qilamiz)

1. **Huquqiy hujjatlar tayyor emas.** `terms` va `merchant_terms` placeholder. Bu haqiqiy pul uchun to‘siq.
2. **Komissiya 3–5% yoki 1%?** Shartnoma va API namunasi ziddiyatli. `net_minor` ni ishlatamiz, lekin tijoriy shartni tasdiqlash kerak.
3. **Pul yechish qo‘lda.** Admin tasdiqlashi va 1–5 ish kuni. Maktablar uchun pul oqimini hisobga olish kerak.
4. **Funds flow model.** API `meta.funds_flow_model: "direct_to_merchant"` bo‘lishi mumkin — bunda platformada yechib olinadigan balans yo‘q (`available_minor: null`). Qaysi model bizga tegishli ekanini Tezcheckdan so‘rash kerak.
5. **IP oq ro‘yxati va Vercel.** Serverless muhitda statik chiqish IP yo‘q. IP cheklovini yoqmaslik yoki boshqa yechim (proxy) kerak bo‘lishi mumkin.
6. **Premium nima ochadi?** Hozir hech narsa ochmaydi — bu eng muhim mahsulot qarori.
7. **`/api/send` ochiq.** To‘lov qo‘shishdan oldin yopish kerak.
8. **Webhook standart 1 urinish.** Qayta urinishni yoqish + `POST /transactions` bilan kunlik solishtirish shart.
9. **Shaxsga doir ma’lumotlar.** `external_reference`, `title`, `description` ga o‘quvchi ismi, telefon raqami yoki maktab ma’lumoti yozilmaydi — faqat ichki identifikator.
10. **Cheklovlar:** 300 so‘rov/daqiqa, sahifa 200, webhook 10 s. Bularni hisobga olib navbat/kesh dizayni kerak.

---

## 7. Keyingi qadam

Siz Tezcheckda ro‘yxatdan o‘tib, kassa va API kalitlarini olganingizdan keyin menga xabar bering. Men:

1. Olingan ma’lumotlarga qarab ushbu yo‘riqnomani yakunlayman;
2. `mh_payments` / `mh_webhook_events` sxemasini va endpointlarning aniq kodini taklif qilaman;
3. Avval sinov muhitida, keyin sizning nazoratingiz bilan joriy qilamiz.

**Hozir hech qanday fayl o‘zgartirilmadi, hech qanday API chaqiruvi yuborilmadi, hech qanday deploy qilinmadi.**
