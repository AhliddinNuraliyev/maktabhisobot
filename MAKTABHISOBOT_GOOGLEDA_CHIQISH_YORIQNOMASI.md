# Maktabhisobot.uz ni Google’da chiqadigan qilish — bosqichma-bosqich yo‘riqnoma

**Tayyorlandi:** 2026-11-21  
**Holat:** faqat tashxis + yo‘riqnoma. Hech narsa o‘zgartirilmadi, deploy qilinmadi.

---

## 0. Avvalo: sayt o‘chgan emas

Siz Google’da `maktabhisobot.uz` deb yozganda AI Overview “active yoki publicly indexed emas” deb chiqardi. Bu **sayt ishlamayapti** degani emas. Mana men tekshirib ko‘rgan haqiqiy holat:

| Tekshiruv | Natija | Izoh |
|---|---|---|
| `https://maktabhisobot.uz/` | **HTTP 200** | Sayt tirik, Vercel serverida |
| SSL sertifikat | **To‘g‘ri** | `maktabhisobot.uz` uchun, 19.11.2026 – 17.02.2027 |
| Googlebot ko‘zi bilan ochish | **HTTP 200** | Google uni o‘qiy oladi, texik blok yo‘q |
| Sahifa matni | **Bor** | `Maktab Hisobot — Elektron hisobotlar tizimi` va bo‘limlar HTML ichida |
| `noindex` tegi | **Yo‘q** | Indekslashni taqiqlovchi narsa yo‘q |
| `robots.txt` | ❌ **Yo‘q** | So‘ralsa `index.html` (HTML) qaytadi |
| `sitemap.xml` | ❌ **Yo‘q** | So‘ralsa `index.html` (HTML) qaytadi |
| `www.maktabhisobot.uz` | ❌ **SSL xatosi** | Sertifikat faqat apex (www siz) domen uchun |
| Google Search Console | ❌ **Qo‘shilmagan** | Asosiy sabab shuki, Google saytni hech kim chaqirmagan |

**Xulosa:** muammo “sayt o‘chgan”da emas, **“Google uni hali topmagan/indekslamagan”**da. Domen juda yangi — SSL 2 kun oldin chiqarilgan. Google yangi saytlarni o‘z-o‘zidan kashf qilishi kunlar, ba’zan haftalar oladi. Bu vaqtni qisqartirish uchun Search Console kerak.

> ⚠️ Muhim: Google’da chiqish = avval **indekslanish**, keyin **qidiruv natijasi**. Indekslanmagan sayt hech qachon chiqmaydi, uzoq kutsangiz ham. Shuning uchun 1–4-bosqichlar shart.

---

## 1-BOSQICH — Google Search Console’ga qo‘shish (eng muhim qadam)

Bu qadamni **faqat siz** qilasiz — Google akkauntingiz va domen boshqaruv paneli kerak. Taxminan 10–15 daqiqa.

### 1.1. Kirish

1. Brauzerda oching: **https://search.google.com/search-console**
2. Google akkauntingiz bilan kiring (sayt qaysi akkauntga bog‘lanishini o‘ylab tanlang — keyinchalik shundan foydalanasiz).
3. Ochiq ekranda **“Add property”** (Xususiyat qo‘shish) tugmasini bosing.

### 1.2. Property turini tanlash

Ikki variant chiqadi:

| Variant | Afzalligi | Kamchiligi |
|---|---|---|
| **Domain** (tavsiya etiladi) | `maktabhisobot.uz` va `www.maktabhisobot.uz` ni birga qamrab oladi | DNS ga TXT yozish kerak |
| **URL prefix** | HTML fayl yoki meta tag bilan tasdiqlash oson | Faqat bitta version (www yoki www siz) |

**✅ Domain variantini tanlang** — chunki sizda `www` SSL muammosi bor va bu variant ikkala versiyani ham qamrab oladi.

- “Domain” qatoriga: `maktabhisobot.uz` yozing (http/https **yozmang**)
- **Continue** bosing.

### 1.3. Domen egasini tasdiqlash (DNS TXT)

Google sizga **TXT record** ko‘rsatadi (taxminan `google-site-verification=...` ko‘rinishida uzun qiymat).

1. Domeningiz qayerdan olingan bo‘lsa, shuning **DNS boshqaruv paneli**ga kiring:
   - Agar domen Reg.ru / Naunet / Uzdomain / Godaddy / Namecheap kabi registrar’da bo‘lsa → shu yerdan
   - Agar domen Cloudflare orqali boshqarilsa → Cloudflare DNS
   - Agar Vercel’da bo‘lsa → Vercel → Project → Settings → Domains
2. **Yangi TXT yozuv** qo‘shing:
   - **Name/Host:** `@` (yoki bo‘sh qoldiring — ba’zi panellar `maktabhisobot.uz` deb yozishni so‘raydi)
   - **Type:** `TXT`
   - **Value:** Googledan bergan to‘liq `google-site-verification=...` qiymati
   - **TTL:** 3600 (yoki default)
3. Saqlang.
4. Google oynasiga qaytib **Verify** bosing.

> Agar tasdiqlanmasa: DNS tarqalishi 5–60 daqiqa davom etadi. Kutib yana **Verify** bosing. `nslookup -type=TXT maktabhisobot.uz` bilan yozuv chiqqan-chiqmaganni tekshiring.

### 1.4. Sitemap yuborish

Tasdiqlangandan keyin Search Console chap menyusida:

1. **Sitemaps** bo‘limiga o‘ting.
2. “Enter a sitemap URL” maydoniga: `sitemap.xml` yozing.
3. **Submit** bosing.

> ⚠️ Hozir `sitemap.xml` yo‘q — 2-bosqichda uni yaratamiz. **Sitemap yuborishni fayl tayyor bo‘lgandan keyin qiling**, aks holda Google “Couldn’t fetch” xatosi beradi. Shuning uchun avval 2-bosqich, keyin 1.4 ga qayting.

### 1.5. Asosiy sahifani indekslashga so‘rash

1. Chap menyuda **URL Inspection** (URL tekshirish).
2. Maydonga: `https://maktabhisobot.uz/` kiriting va Enter.
3. Google sahifani tekshiradi (10–30 soniya).
4. **“URL is on Google”** deb chiqsa — tayyor.
5. **“URL is not on Google”** deb chiqsa → **Request Indexing** (Indekslashni so‘rash) tugmasini bosing.
6. 1–3 kun kuting, keyin yana URL Inspection’da tekshiring.

---

## 2-BOSQICH — `robots.txt` va `sitemap.xml` yaratish

Hozir bu ikki fayl yo‘q. Google ularni so‘raganda `index.html` olyapti — bu indekslashni sekinlashtiradi va Search Console’da xato ko‘rsatadi.

### 2.1. `robots.txt`

Loyiha ildiziga (`C:\Users\user\Downloads\NEW PROJECT\`) **`robots.txt`** nomli fayl yarating, ichiga:

```txt
User-agent: *
Allow: /

Sitemap: https://maktabhisobot.uz/sitemap.xml
```

### 2.2. `sitemap.xml`

Yana bir fayl: **`sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://maktabhisobot.uz/</loc>
    <lastmod>2026-11-21</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

> Sahifaga `/haqimizda`, `/yordam` kabi yangi yo‘llar qo‘shsangiz, ularni ham `<url>` sifatida ichiga qo‘shing.

### 2.3. Nima uchun bu fayllar ishlaydi?

`vercel.json` da catch-all qoida bor:

```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

Lekin men tekshirdim: `maktabhisobot_icon.svg.png`, `choraklik.js` kabi **haqiqiy fayllar to‘g‘ri xizmat qilinmoqda** — demak Vercel avval mavjud faylni beradi, keyin rewrite ishlaydi. Shuning uchun `robots.txt` va `sitemap.xml` ni ildizga qo‘yish kifoya, `vercel.json` ni o‘zgartirish shart emas.

### 2.4. Deploy qilgandan keyin tekshirish

```bash
curl -I https://maktabhisobot.uz/robots.txt
curl -I https://maktabhisobot.uz/sitemap.xml
```

Ikkalasi ham `Content-Type: text/plain` va `application/xml` bo‘lib, `200` qaytishi kerak. HTML qaytsa — fayl ildizga qo‘yilmagan yoki deploy o‘tmagan.

---

## 3-BOSQICH — Meta teglar qo‘shish (snippet sifati uchun)

Indekslashni bloklamaydi, lekin Google qidiruvda chiqqanda **sarlavha va tavsif** chiroyli ko‘rinishi uchun kerak.

`index.html` ning `<head>` qismiga (7–9-satrlar orasiga) qo‘shing:

```html
<meta name="description" content="Maktab Hisobot — maktablar uchun elektron hisobotlar tizimi. Choraklik baholar, davomat va statistik hisobotlarni bir joyda yuriting.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://maktabhisobot.uz/">
<meta property="og:type" content="website">
<meta property="og:title" content="Maktab Hisobot — Elektron hisobotlar tizimi">
<meta property="og:description" content="Maktablar uchun elektron hisobotlar tizimi. Baholar, davomat va statistika.">
<meta property="og:url" content="https://maktabhisobot.uz/">
<meta property="og:image" content="https://maktabhisobot.uz/maktabhisobot_logo_horizontal.svg.png">
<meta name="theme-color" content="#0072bc">
```

`canonical` aynan `https://maktabhisobot.uz/` bo‘lishi kerak — bu Google’ga “asosiy versiya www siz” deb aytadi.

---

## 4-BOSQICH — `www` versiyasining SSL muammosini tuzatish

Hozir:

- `maktabhisobot.uz` → `64.29.17.1` ✅ sertifikat bor
- `www.maktabhisobot.uz` → `cname.vercel-dns.com` → sertifikat **faqat apex uchun**, shuning uchun `NET::ERR_CERT_COMMON_NAME_INVALID`

Google ba’zan `www` versiyasini ham krawl qiladi va xato oladi. Ikki yechim:

### Variant A — `www` ni Vercel’ga qo‘shish (tavsiya)

1. https://vercel.com/dashboard → project **`bsbtahlil`** ni oching.
2. **Settings → Domains**.
3. `www.maktabhisobot.uz` ni qo‘shing.
4. Vercel avtomatik sertifikat chiqaradi (1–2 daqiqa).
5. So‘ng **Settings → Domains** da `www` dan `maktabhisobot.uz` ga **301 redirect** o‘rnating.

### Variant B — `www` ni butunlay o‘chirish

DNS panelida `www` CNAME yozuvini o‘chiring. Faqat `maktabhisobot.uz` ishlaydi. Bu ham to‘g‘ri, chunki `canonical` apex ga qaratingan.

> Ikkala holatda ham 1-bosqichda **Domain property** tanlagan bo‘lsangiz, tasdiqlash saqlanib qoladi.

---

## 5-BOSQICH — Google’ga kashf qilish signali berish

Search Console’siz ham, bilan ham foydali. Google yangi domenni boshqa saytlardan kelgan havolalar orqali ham topadi:

1. **Telegram** — bot yoki kanalda `https://maktabhisobot.uz/` havolasini post qiling.
2. **Boshqa saytlar** — agar sizda boshqa domenlar bo‘lsa, ulardan bir havola qo‘ying.
3. **Ijtimoiy tarmoqlar** — Facebook/Instagram bio yoki post.
4. **Google Business Profile** — agar tashkilot sifatida ro‘yxatdan o‘tgan bo‘lsangiz.

> ❗ Havolalar **sahifa ichida matn yoki `<a href>`** bo‘lishi kerak. Faqat address bar’ga yozib kirish Google’ga signal bermaydi.

---

## 6-BOSQICH — Natijani tekshirish va kutish

### 6.1. Tekshirish tartibi

| Vaqt | Nima qilish | Kutiladigan natija |
|---|---|---|
| 1–2 soat | `curl -I https://maktabhisobot.uz/robots.txt` | `text/plain`, 200 |
| 1–3 kun | URL Inspection | “URL is on Google” |
| 3–7 kun | Google’da `site:maktabhisobot.uz` | Sahifa chiqadi |
| 1–2 hafta | Google’da `maktabhisobot.uz` | Domen chiqadi |

### 6.2. To‘g‘ri qidiruv so‘rovi

- ✅ `site:maktabhisobot.uz` — eng aniq tekshiruv
- ✅ `maktabhisobot.uz` — brauzer to‘g‘ridan-to‘g‘ri saytga o‘tishni taklif qilishi mumkin (bu ham yaxshi)
- ❌ Google AI Overview hali ham eski ma’lumot ko‘rsatishi mumkin — bu vaqt o‘tishi bilan yangilanadi

### 6.3. Agar 2 haftadan keyin ham chiqmasa

1. Search Console → **Pages** bo‘limiga kiring — qanday xatolar bor?
   - `Excluded by 'noindex'` → meta teg qolgan
   - `Blocked by robots.txt` → robots.txt noto‘g‘ri
   - `Discovered – currently not indexed` → navbat kutmoqda, kuting
   - `Crawled – currently not indexed` → sifat signali zaif, 3- va 5-bosqichlarni kuchaytiring
2. URL Inspection → **Test Live URL** → “View crawled page” — Google ko‘rgan sahifani tekshiring.
3. **Request Indexing** ni yana bir marta bosing (kuniga 1 martadan ko‘p emas).

---

## Xatoliklar jadvali

| Belgi | Sabab | Yechim |
|---|---|---|
| `Couldn't fetch sitemap` | `sitemap.xml` yo‘q yoki HTML qaytadi | 2-bosqich bajarilmagan — fayl qo‘shib deploy qiling |
| `Verify failed` (TXT) | DNS tarqalmagan yoki noto‘g‘ri host | 5–60 min kuting; `nslookup -type=TXT maktabhisobot.uz` |
| `URL is not on Google` | Hali so‘ralmagan | Request Indexing bosing |
| `www` ochilmaydi | SSL faqat apex uchun | 4-bosqich |
| `Crawled – currently not indexed` | Yangi domen, zaif signal | 3- va 5-bosqich, kuting 1–2 hafta |
| AI Overview “not active” | Google ma’lumot bazasi eski | Indekslanganidan keyin o‘zgaradi |

---

## Kim nima qiladi

| Bosqich | Kim bajaradi |
|---|---|
| 1. Search Console + DNS TXT + Request Indexing | **Faqat siz** (Google akkaunt va domen paneli kerak) |
| 2. `robots.txt`, `sitemap.xml` | Men tayyorlab beraman yoki siz qo‘shasiz → **deploy kerak** |
| 3. Meta teglar | Men qo‘shib beraman → **deploy kerak** |
| 4. `www` SSL / redirect | Siz (Vercel dashboard) |
| 5. Havolalar | Siz |
| 6. Tekshirish | Birgalikda |

---

## Eng qisqa tartib (xulosa)

1. ☐ Google Search Console → Domain property `maktabhisobot.uz` → DNS TXT bilan tasdiqlang
2. ☐ `robots.txt` va `sitemap.xml` ni ildizga qo‘shib, Vercel’ga deploy qiling
3. ☐ `index.html` ga meta description + canonical qo‘shib, deploy qiling
4. ☐ Vercel’da `www` ni qo‘shib, apex ga redirect qiling (yoki DNS’dan o‘chiring)
5. ☐ Search Console → Sitemaps → `sitemap.xml` → Submit
6. ☐ URL Inspection → `https://maktabhisobot.uz/` → **Request Indexing**
7. ☐ Telegram/boshqa saytlarda havola qo‘ying
8. ☐ 3–7 kundan keyin `site:maktabhisobot.uz` bilan tekshiring

---

**Eslatma:** Hozir kod yozilmadi, fayl o‘zgartirilmadi, deploy qilinmadi. 2 va 3-bosqichdagi fayllarni men bir zumda qo‘shib beraman — lekin avval siz “qo‘sh” deganingizdan keyin. Deploy esa sizning Vercel hisobingiz bilan amalga oshiriladi.
