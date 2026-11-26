const crypto = require('crypto');
const L = require('./_lib');

// Telegram bot webhook'i.
// Vazifasi: sayt yaratgan bir martalik havolani (t.me/<bot>?start=login_<nonce>)
// qabul qilib, foydalanuvchining telegram_id sini yozib qo'yish va
// tasdiq xabarini AYNAN SHU BOT orqali yuborish.
//
// Webhookni ulash: set-telegram-webhook.ps1 ga qarang.
// Eslatma: Vercel Hobby rejasida 12 ta Serverless Function limiti bor.
// Bu fayl "_" bilan boshlanganligi uchun alohida funksiya hisoblanmaydi:
// uni /api/telegram-login?action=bot_webhook ichidan chaqiramiz.

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (!ba.length || ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function displayName(from) {
  const n = [from && from.first_name, from && from.last_name].filter(Boolean).join(' ').trim();
  return n || (from && from.username ? '@' + from.username : 'Foydalanuvchi');
}

// Nonce ni telegram_id bilan bog'laydi. Faqat hali tasdiqlanmagan,
// ishlatilmagan va muddati o'tmagan yozuv yangilanadi — shu bilan
// ikki marta bosish yoki eski havola bilan kirish mumkin bo'lmaydi.
// Qaytaradi: 'ok' | 'already' (shu odam tasdiqlagan, hali ishlatilmagan)
//            | 'used' (sessiya allaqachon olingan) | 'expired'
async function confirmLogin(nonce, from) {
  const nowIso = new Date().toISOString();
  const filter = '/rest/v1/mh_bot_logins?nonce=eq.' + encodeURIComponent(nonce) +
    '&confirmed_at=is.null&used_at=is.null&expires_at=gt.' + encodeURIComponent(nowIso);
  const body = {
    telegram_id: String(from.id),
    username: String(from.username || ''),
    first_name: String(from.first_name || ''),
    last_name: String(from.last_name || ''),
    photo_url: String(from.photo_url || ''),
    confirmed_at: nowIso
  };
  try {
    const rows = await L.sb(filter, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    if (Array.isArray(rows) && rows.length) return 'ok';
  } catch (e) {
    console.error('[bot] confirm login failed:', e && e.message);
    return 'expired';
  }
  // Nega yangilanmadi? «Start» ikki marta bosilgan bo'lsa — havola hali yaroqli,
  // uni «eskirgan» deb aytish noto'g'ri bo'lardi.
  try {
    const rows = await L.sb('/rest/v1/mh_bot_logins?nonce=eq.' + encodeURIComponent(nonce) +
      '&select=telegram_id,confirmed_at,used_at,expires_at&limit=1');
    const r = rows && rows[0];
    if (!r) return 'expired';
    if (r.used_at) return 'used';
    if (r.confirmed_at && String(r.telegram_id) === String(from.id)) return 'already';
    return 'expired';
  } catch (e) {
    return 'expired';
  }
}

async function send(chatId, text, buttons) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true };
  if (buttons && buttons.length) payload.reply_markup = { inline_keyboard: buttons };
  return L.botApi('sendMessage', payload);
}

function openButton(url, label) {
  // Telegram inline_keyboard — qatorlar massivi: [[tugma]] bo'lishi shart.
  return [[{ text: label || '🌐 Saytni ochish', url: url }]];
}

// ---- Yangi bo'limlar: profil, statistika, aloqa, qo'llanma ----

// Barcha bo'limlarga o'tish tugmalari. callback_data faqat xavfsiz route nomi.
function menuKeyboard(base) {
  const rows = [
    [
      { text: '👤 Profil', callback_data: 'menu:profil' },
      { text: '📊 Statistika', callback_data: 'menu:statistika' }
    ],
    [
      { text: '📞 Aloqa', callback_data: 'menu:aloqa' },
      { text: '📖 Qo‘llanma', callback_data: 'menu:qollanma' }
    ]
  ];
  const last = [{ text: '📋 Menyu', callback_data: 'menu:menu' }];
  if (base) last.push({ text: '🌐 Saytni ochish', url: base });
  rows.push(last);
  return rows;
}

// Tashqi xabar yuborishlodagi shovqinni oldini oladi: "message not modified"
// kabi xatolar jurnallarga yozilmaydi, muvaffaqiyatsiz bo'lsa null qaytadi.
async function quietApi(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  if (!token) return null;
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const j = await r.json().catch(() => null);
    return j && j.ok ? j.result : null;
  } catch (e) { return null; }
}

// Tugma bosilganda xabarni qayta yubormay, o'zini tahrirlaymiz.
// Xabar eskirgan bo'lsa (yoki o'zgarmagan bo'lsa) yangi xabar yuboramiz.
async function show(chatId, messageId, view) {
  const payload = {
    chat_id: chatId,
    text: view.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: view.buttons }
  };
  if (messageId) {
    const edited = await quietApi('editMessageText', Object.assign({ message_id: messageId }, payload));
    if (edited) return;
  }
  await L.botApi('sendMessage', payload);
}

function dateText(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString('uz-UZ', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tashkent'
    });
  } catch (e) { return d.toISOString().slice(0, 10); }
}

async function userRow(tid) {
  try {
    // Faqat ko'rsatiladigan ustunlar — select=* keraksiz egress qaytaradi.
    const rows = await L.sb('/rest/v1/mh_users?telegram_id=eq.' +
      encodeURIComponent(String(tid)) +
      '&select=id,first_name,last_name,username,is_premium,download_credits,download_count,viloyat,tuman,maktab,oqituvchi&limit=1');
    return rows && rows.length ? rows[0] : null;
  } catch (e) {
    console.error('[bot] user lookup failed:', e && e.message);
    return null;
  }
}

async function paymentStats(uid) {
  const out = { count: 0, credits: 0, amount: 0 };
  if (!uid) return out;
  try {
    const rows = await L.sb('/rest/v1/mh_payments?user_id=eq.' +
      encodeURIComponent(String(uid)) + '&select=state,credits_granted,amount_minor&limit=200');
    (rows || []).forEach(function (p) {
      if (String(p.state || '') === 'succeeded') {
        out.count += 1;
        out.credits += +(p.credits_granted || 0);
        out.amount += +(p.amount_minor || 0);
      }
    });
  } catch (e) {
    console.warn('[bot] payment stats unavailable:', e && e.message);
  }
  return out;
}

function notRegistered(from, base) {
  return {
    text: '👤 Assalomu alaykum, ' + esc(displayName(from)) + '!\n\n' +
      'Bu ma\'lumotlarni ko\'rish uchun avval saytga kiring: «Telegram orqali kirish» tugmasini bosing.\n\n' +
      '🆔 Telegram ID: <code>' + esc(String(from.id)) + '</code>',
    buttons: base ? openButton(base, '🌐 Saytni ochish') : []
  };
}

async function profileView(from, base) {
  const u = await userRow(from.id);
  if (!u) return notRegistered(from, base);

  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || displayName(from);
  const parts = [
    '👤 <b>Sizning profilingiz</b>\n',
    '🆔 Telegram ID: <code>' + esc(String(from.id)) + '</code>',
    '👤 Ism: ' + esc(fullName),
    '🔗 Username: ' + (u.username ? '@' + esc(String(u.username)) : '—'),
    '💎 Status: ' + (u.is_premium ? '<b>Premium</b> ⭐' : 'Oddiy'),
    '🎁 Kreditlar: <b>' + esc(String(+(u.download_credits || 0))) + '</b>',
    '📥 Yuklab olingan hisobotlar: ' + esc(String(+(u.download_count || 0)))
  ];
  const loc = [
    u.viloyat ? '📍 Viloyat: ' + esc(String(u.viloyat)) : '',
    u.tuman ? '📍 Tuman: ' + esc(String(u.tuman)) : '',
    u.maktab ? '🏫 Maktab: ' + esc(String(u.maktab)) : '',
    u.oqituvchi ? '👨‍🏫 O‘qituvchi: ' + esc(String(u.oqituvchi)) : ''
  ].filter(Boolean);
  if (loc.length) parts.push('\n<b>Ma\'lumotlar:</b>', ...loc);
  return { text: parts.join('\n'), buttons: menuKeyboard(base) };
}

async function statsView(from, base) {
  const u = await userRow(from.id);
  if (!u) return notRegistered(from, base);

  const pay = await paymentStats(u.id);
  const parts = [
    '📊 <b>Statistika</b>\n',
    '📥 Jami yuklab olishlar: ' + esc(String(+(u.download_count || 0))),
    '🎁 Qolgan kreditlar: <b>' + esc(String(+(u.download_credits || 0))) + '</b>',
    '💎 Premium: ' + (u.is_premium ? 'Ha ⭐' : 'Yo‘q'),
    '💸 Muvaffaqiyatli to‘lovlar: ' + esc(String(pay.count)),
    '➕ To‘lov bilan olingan kreditlar: ' + esc(String(pay.credits))
  ];
  if (pay.count) parts.push('💰 Jami to‘langan: ' + esc(String(Math.round(pay.amount / 100))) + ' so‘m');
  return { text: parts.join('\n'), buttons: menuKeyboard(base) };
}

function contactView(base) {
  const rows = [[{ text: '✉️ Administratorga yozish', url: 'https://t.me/AHLIDDIN_NURALIYEV' }]];
  const last = [{ text: '📋 Menyu', callback_data: 'menu:menu' }];
  if (base) last.push({ text: '🌐 Saytni ochish', url: base });
  rows.push(last);
  return {
    text: '📞 <b>Aloqa</b>\n\n' +
      'Savol, taklif yoki muammo yuzaga kelsa, administrator bilan bog‘laning.\n\n' +
      '👤 @AHLIDDIN_NURALIYEV\n' +
      '🌐 Sayt: ' + (base ? esc(base) : 'maktabhisobot.uz'),
    buttons: rows
  };
}

function guideView(base) {
  return {
    text: '📖 <b>Qo‘llanma</b>\n\n' +
      '<b>1. Kirish</b>\nSaytda «Telegram orqali kiring» tugmasini bosing, so‘ng botdagi havolani ochib «Start» bosing.\n\n' +
      '<b>2. Hisobot olish</b>\nMa\'lumotlaringizni kiriting va PDF yoki Excel qilib yuklab oling. Tayyor faylni shu chatga ham yuborish mumkin.\n\n' +
      '<b>3. Kreditlar</b>\nYangi foydalanuvchiga 3 ta bepul kredit beriladi. Har bir yuklab olish 1 kredit sarflaydi. Premium orqali qo‘shimcha kredit olish mumkin.\n\n' +
      '<b>4. Buyruqlar</b>\n' +
      '/start — botni ishga tushirish\n' +
      '/profil — hisob ma\'lumoti\n' +
      '/statistika — hisobotlar statistikasi\n' +
      '/aloqa — administrator bilan bog‘lanish\n' +
      '/qollanma — bu ko‘rsatma\n' +
      '/menu — tugmalar menyusi',
    buttons: menuKeyboard(base)
  };
}

function menuView(from, base) {
  return {
    text: '📋 <b>Menyu</b>\n\nAssalomu alaykum, ' + esc(displayName(from)) + '!\nKerakli bo‘limni tanlang:',
    buttons: menuKeyboard(base)
  };
}

async function renderRoute(route, from, base) {
  switch (route) {
    case 'profil': return profileView(from, base);
    case 'statistika': return statsView(from, base);
    case 'aloqa': return contactView(base);
    case 'qollanma': return guideView(base);
    default: return menuView(from, base);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, description: 'method not allowed' });

  // Telegram webhookni maxfiy sarlavha bilan chaqiradi (setWebhook -> secret_token).
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '');
  if (secret) {
    const got = String((req.headers && req.headers['x-telegram-bot-api-secret-token']) || '');
    if (!safeEqual(got, secret)) {
      console.warn('[bot] webhook secret mos emas');
      return res.status(401).json({ ok: false });
    }
  } else {
    console.warn('[bot] TELEGRAM_WEBHOOK_SECRET sozlanmagan — webhook himoyasi zaif');
  }

  let update = {};
  try { update = L.parseBody(req) || {}; } catch (e) { update = {}; }

  // Inline tugmalar bosilganda Telegram callback_query yuboradi.
  const cq = update.callback_query || null;
  if (cq) {
    const cqFrom = cq.from;
    const cqChat = cq.message && cq.message.chat;
    const cqChatId = cqChat && cqChat.id;
    if (!cqFrom || cqFrom.is_bot || !cqChatId || String(cqChatId) !== String(cqFrom.id)) {
      return res.status(200).json({ ok: true });
    }
    await quietApi('answerCallbackQuery', { callback_query_id: cq.id });
    const data = String(cq.data || '');
    if (data.indexOf('menu:') === 0) {
      const view = await renderRoute(data.slice(5), cqFrom, L.siteUrl(req));
      await show(cqChatId, cq.message.message_id, view);
    }
    return res.status(200).json({ ok: true });
  }

  const msg = update.message || update.edited_message || null;
  // Faqat shaxsiy chatdagi matnli xabarlar. Botlardan kelganini e'tiborsiz qoldiramiz.
  if (!msg || !msg.from || msg.from.is_bot) return res.status(200).json({ ok: true });
  const chatId = msg.chat && msg.chat.id;
  const fromId = msg.from.id;
  if (!chatId || String(chatId) !== String(fromId)) return res.status(200).json({ ok: true });

  const text = String(msg.text || '').trim();
  if (!text) return res.status(200).json({ ok: true });

  const base = L.siteUrl(req);
  const name = displayName(msg.from);

  const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (startMatch) {
    const payload = String(startMatch[1] || '').trim();
    if (/^login_/i.test(payload)) {
      const nonce = payload.slice(6).replace(/[^a-f0-9]/gi, '');
      const result = nonce ? await confirmLogin(nonce, msg.from) : 'expired';
      console.log('[bot] login_ tasdiqlash:', result);
      if (result === 'ok' || result === 'already') {
        // «already» — foydalanuvchi «Start» ni ikki marta bosgan. Havola hali
        // yaroqli, shuning uchun o'sha muvaffaqiyat xabarini qaytaramiz.
        await send(chatId,
          '✅ <b>Saytga kirdingiz</b>\n\n' +
          '👤 ' + esc(name) + '\n' +
          '🆔 Telegram ID: <code>' + esc(String(fromId)) + '</code>\n\n' +
          'Endi brauzerga qayting — sahifa o‘zi yangilanadi.\n' +
          'Yangilanmasa, pastdagi tugmani bosing.',
          openButton(base + '/?tglogin=' + nonce, '🌐 Saytga qaytish'));
      } else if (result === 'used') {
        await send(chatId,
          'ℹ️ <b>Bu havola allaqachon ishlatilgan</b>\n\n' +
          'Bu kirish havolasi bir martalik — u bilan allaqachon kirilgan.\n' +
          'Saytni ochib, kerak bo‘lsa «Telegram orqali kirish» tugmasini qaytadan bosing.',
          base ? openButton(base, '🌐 Saytni ochish') : null);
      } else {
        await send(chatId,
          '⚠️ <b>Havola eskirgan</b>\n\n' +
          'Bu kirish havolasi 10 daqiqada eskiradi.\n' +
          'Saytga qaytib, «Telegram orqali kirish» tugmasini qaytadan bosing.',
          base ? openButton(base, '🌐 Saytni ochish') : null);
      }
      return res.status(200).json({ ok: true });
    }

    // Oddiy /start — bot bilan tanishuv.
    await send(chatId,
      'Assalomu alaykum, ' + esc(name) + '! 👋\n\n' +
      'Bu — <b>Maktab Hisobot</b> boti.\n' +
      'Saytga kirish uchun saytdagi «Telegram orqali kirish» tugmasini bosing — ' +
      'tasdiqlash shu bot orqali bo‘ladi.\n\n' +
      'Tayyor hisobotni PDF yoki Excel qilib shu chatga ham yuborish mumkin.\n' +
      'Pastdagi tugmalar orqali profil, statistika va boshqa bo‘limlarga o‘ting.',
      menuKeyboard(base));
    return res.status(200).json({ ok: true });
  }

  // Yangi bo'limlar: ham komanda, ham tugma orqali ishlaydi.
  const routes = {
    profil: /^\/profil(?:@\w+)?$/i,
    statistika: /^\/statistika(?:@\w+)?$/i,
    aloqa: /^\/aloqa(?:@\w+)?$/i,
    qollanma: /^\/qollanma(?:@\w+)?$/i,
    menu: /^\/menu(?:@\w+)?$/i
  };
  for (const route of Object.keys(routes)) {
    if (routes[route].test(text)) {
      const view = await renderRoute(route, msg.from, base);
      await show(chatId, null, view);
      return res.status(200).json({ ok: true });
    }
  }

  if (/^\/help(?:@\w+)?$/i.test(text)) {
    await send(chatId,
      '<b>Yordam</b>\n\n' +
      '1. Saytga kiring: ' + (base ? esc(base) : 'maktabhisobot.uz') + '\n' +
      '2. «Telegram orqali kirish» tugmasini bosing.\n' +
      '3. Botda «Start» (yoki «Tasdiqlash») tugmasini bosing — shu bilan hisobingiz tasdiqlanadi.\n\n' +
      '<b>Buyruqlar:</b>\n' +
      '/profil — hisob ma\'lumoti\n' +
      '/statistika — hisobotlar statistikasi\n' +
      '/aloqa — administrator bilan bog\'lanish\n' +
      '/qollanma — batafsil yo\'riqnoma\n' +
      '/menu — tugmalar menyusi\n\n' +
      'Savollar uchun: @AHLIDDIN_NURALIYEV',
      menuKeyboard(base));
    return res.status(200).json({ ok: true });
  }

  // Boshqa xabarlarga javob bermaymiz — botni suhbat uchun ishlatmaymiz.
  return res.status(200).json({ ok: true });
};
