/* Maktab Hisobot — ko'p tilli interfeys (O'zbek / Русский / Қарақалпақша)
   Barcha matnlar asl o'zbekcha kalit bilan saqlanadi; til almashganda DOM
   avtomatik qayta tarjima qilinadi. Foydalanuvchi ma'lumotlari (ismlar va h.k.)
   tarjima qilinmaydi — faqat lug'atda bor iboralar o'zgartiriladi. */
(function () {
  'use strict';

  var norm = function (s) {
    return String(s == null ? '' : s)
      .replace(/[‘’ʼ`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  // [o'zbekcha, ruscha, qoraqalpoqcha]
  var PAIRS = [
    // Umumiy / header
    ['Kirish', 'Вход', 'Кириў'], ['Chiqish', 'Выход', 'Шығыў'], ['Yordam', 'Помощь', 'Жәрдем'],
    ['Bildirishnomalar', 'Уведомления', 'Хабарлар'], ['Yangi bildirishnomalar yo’q', 'Новых уведомлений нет', 'Жаңа хабар жоқ'],
    ['Yangi bildirishnomalar yo\'q', 'Новых уведомлений нет', 'Жаңа хабар жоқ'],
    ['Tizim ma\'lumoti', 'Информация о системе', 'Система ҳаққында'],
    ['O\'zbekiston Respublikasi Maktabgacha va maktab ta\'limi tizimi', 'Система дошкольного и школьного образования Республики Узбекистан', 'Өзбекстан Республикасы Мектепке шекемги ҳәм мектеп таlimи системасы'],
    ['Yordam bo\'limi tez orada ishga tushiriladi', 'Раздел помощи скоро будет доступен', 'Жәрдем бөлими тез арада ислейди'],
    ['Tizimdan chiqish tasdiqlandi', 'Выход из системы подтверждён', 'Системадан шығыў тастықланды'],
    ['O\'quv yili: 2026–2027', 'Учебный год: 2026–2027', 'Оқыў жылы: 2026–2027'],
    ['Kirilmagan', 'Не авторизован', 'Кирмеген'], ['Foydalanuvchi', 'Пользователь', 'Пайдаланушы'],
    ['Premium', 'Премиум', 'Премиум'], ['Premium faol', 'Премиум активен', 'Премиум актив'],
    ['Barcha imkoniyatlar ochilgan · Qolgan kredit:', 'Все возможности открыты · Осталось кредитов:', 'Барлық имканиятлар ашық · Қалған кредит:'],
    ['Ma\'lumotlarim', 'Мои данные', 'Мағлыўматларым'], ['Boshqa Telegram akkaunti', 'Другой аккаунт Telegram', 'Басқа Telegram аккаунты'],
    ['BSB HISOBOT', 'BSB ОТЧЁТ', 'BSB ҲИСОБАТЫ'], ['CHSB HISOBOT', 'CHSB ОТЧЁТ', 'CHSB ҲИСОБАТЫ'],
    ['LI HISOBOT', 'LI ОТЧЁТ', 'LI ҲИСОБАТЫ'], ['KURATORLIK HISOBOT', 'КУРАТОРСКИЙ ОТЧЁТ', 'КУРАТОР ҲИСОБАТЫ'],
    ['Jadval keng — qolgan ustunlarni ko\'rish uchun chapga suring 👉', 'Таблица широкая — смахните влево, чтобы увидеть остальные столбцы 👉', 'Кесте кең — қалған бағаналарды көриў ушын шапқа сүйрең 👉'],
    ['CHORAKLIK HISOBOT', 'ЧЕТВЕРТНОЙ ОТЧЁТ', 'ШЕРЕК ҲИСОБАТЫ'],
    ['MA\'LUMOTLARIM', 'МОИ ДАННЫЕ', 'МАҒЛЫЎМАТЛАРЫМ'], ['ADMIN', 'АДМИН', 'АДМИН'],
    ['Admin', 'Админ', 'Админ'], ['Admin panel', 'Панель администратора', 'Админ панели'],
    ['Til o\'zgartirildi', 'Язык изменён', 'Тил өзгертти'],
    ['Til o\'zgartirildi: O\'zbekcha', 'Язык изменён: Русский', 'Тил өзгертти: Қарақалпақша'],
    ['O\'zbekcha', 'O\'zbekcha', 'O\'zbekcha'], ['Русский', 'Русский', 'Русский'], ['Қарақалпақша', 'Қарақалпақша', 'Қарақалпақша'],

    // Asosiy sahifa
    ['Maktablar uchun elektron hisobot', 'Электронный отчёт для школ', 'Мектеплер ушын электрон ҳисобат'],
    ['BSB, CHSB va choraklik hisobotlarni bir necha daqiqada tayyorlang', 'Подготовьте отчёты BSB, CHSB и за четверть за несколько минут', 'BSB, CHSB ҳәм шерек ҳисобатларын бирнеше минутта тайынлаң'],
    ['emaktab.uz jurnalini yuklang — baholar, foizlar va sifat ko\'rsatkichlari o\'zi hisoblanadi.', 'Загрузите журнал emaktab.uz — оценки, проценты и показатели качества рассчитаются автоматически.', 'emaktab.uz журналын жүклең — баҳалар, процентлер ҳәм сапат көрсеткишлери өзи есапланады.'],
    ['BSB hisobotni boshlash', 'Начать отчёт BSB', 'BSB ҳисобатын баслаў'],
    ['Choraklik hisobot', 'Четвертной отчёт', 'Шерек ҳисобаты'],
    ['Telegram orqali kirish • Ma\'lumotlar brauzerda • PDF/Excel eksport', 'Вход через Telegram • Данные в браузере • Экспорт PDF/Excel', 'Telegram арқалы кириў • Мағлыўматлар браузерде • PDF/Excel экспорт'],
    ['Hisobot Telegram botda ham saqlanadi', 'Отчёт сохраняется и в Telegram-боте', 'Ҳисобат Telegram ботта да сақланады'],
    ['Yuklagan hisobotingiz botimizga ham yuboriladi — keyinroq tuzatish kerak bo\'lsa, o\'sha yerda turadi.', 'Скачанный отчёт отправляется и в нашего бота — если позже понадобится правка, он будет там.', 'Жүклеген ҳисобатыңыз ботимизге де жибериледи — кейинирек түзетиў керек болса, сол жерде турады.'],
    ['Excel import', 'Импорт Excel', 'Excel импорты'],
    ['emaktab.uz jurnalini bir tugma bilan yuklang.', 'Загрузите журнал emaktab.uz одной кнопкой.', 'emaktab.uz журналын бир басыў менен жүклең.'],
    ['Avtomatik baholash', 'Автоматическая оценка', 'Автоматик баҳалаў'],
    ['Mezon va foiz asosida 5/4/3/2 baholar o\'zi qo\'yiladi.', 'Оценки 5/4/3/2 выставляются по критерию и проценту.', 'Өлшем ҳәм процент тийкарында 5/4/3/2 баҳалар өзи қойылады.'],
    ['Tayyor hisobot', 'Готовый отчёт', 'Тайын ҳисобат'],
    ['Statistika bilan PDF yoki Excel fayl.', 'PDF или Excel файл со статистикой.', 'Статистика менен PDF яки Excel файл.'],
    ['Choraklik tahlil', 'Анализ за четверть', 'Шереклик талдаў'],
    ['BSB, CHSB, LI va FB asosida jadval hamda diagramma.', 'Таблицы и диаграммы на основе BSB, CHSB, LI и FB.', 'BSB, CHSB, LI ҳәм FB тийкарында кесте ҳәм диаграмма.'],
    ['Qanday ishlaydi?', 'Как это работает?', 'Қалай ислейди?'],
    ['Jurnalni yuklang', 'Загрузите журнал', 'Журналды жүклең'],
    ['emaktab.uz dan Excelga eksport qiling.', 'Экспортируйте из emaktab.uz в Excel.', 'emaktab.uz дан Excel ǵа экспортлаң.'],
    ['Ma\'lumotlarni tekshiring', 'Проверьте данные', 'Мағлыўматларды тексериң'],
    ['Sinf, fan, chorak va mezonlarni kiriting.', 'Введите класс, предмет, четверть и критерии.', 'Клас, пән, шерек ҳәм өлшемлерди киргизиң.'],
    ['Yuklab oling', 'Скачайте', 'Жүклеп алың'],
    ['PDF yoki Excel qilib saqlang — botga ham tushadi.', 'Сохраните в PDF или Excel — файл придёт и в бота.', 'PDF яки Excel етип сақлаң — ботқа да түседи.'],
    ['Ko\'p so\'raladigan savollar', 'Часто задаваемые вопросы', 'Көп соралатуғын сораўлар'],
    ['Qanday fayl yuklashim kerak?', 'Какой файл нужно загрузить?', 'Қандай файл жүклеү керек?'],
    ['emaktab.uz dan eksport qilingan .xls yoki .xlsx jurnal.', 'Журнал .xls или .xlsx, экспортированный из emaktab.uz.', 'emaktab.uz дан экспортланған .xls яки .xlsx журнал.'],
    ['Telegram orqali kirish shartmi?', 'Обязателен ли вход через Telegram?', 'Telegram арқалы кириў шарт па?'],
    ['Yo\'q. Hisoblash brauzerda ishlaydi. Yuklab olish va botga yuborish uchun kirish kerak.', 'Нет. Расчёт идёт в браузере. Вход нужен для скачивания и отправки в бота.', 'Яқ. Есаплаў браузерде ислейди. Жүклеп алыў ҳәм ботқа жибериў ушын кириў керек.'],
    ['Hisobotni keyinroq tuzatsam bo\'ladimi?', 'Можно ли позже исправить отчёт?', 'Ҳисобатты кейинирек түзетсем болады ма?'],
    ['Ha. Yuklagan hisobot botimizda saqlanadi — o\'sha yerdan qayta ochib tuzatishingiz mumkin.', 'Да. Скачанный отчёт сохраняется в нашем боте — оттуда его можно открыть и исправить.', 'Ийе. Жүклеген ҳисобат ботимизде сақланады — сол жерден қайта ашып түзетиўиңиз мүмкин.'],
    ['Ma\'lumotlarim qayerda saqlanadi?', 'Где хранятся мои данные?', 'Мағлыўматларым қайда сақланады?'],
    ['Kiritilgan ma\'lumotlar brauzerda, hisob ma\'lumotlari serverda saqlanadi.', 'Введённые данные — в браузере, данные аккаунта — на сервере.', 'Киргизилген мағлыўматлар браузерде, ҳисоб мағлыўматлары серверде сақланады.'],
    ['To\'lov qanday amalga oshiriladi?', 'Как производится оплата?', 'Төлем қалай әмелге асырылады?'],
    ['Premium 40 000 so\'m — 40 ta yuklab olish. Click, Payme, Uzcard yoki Humo.', 'Premium 40 000 сум — 40 скачиваний. Click, Payme, Uzcard или Humo.', 'Premium 40 000 сум — 40 жүклеп алыў. Click, Payme, Uzcard яки Humo.'],

    // BSB / LI umumiy
    ['1. Hisobot ma\'lumotlari', '1. Данные отчёта', '1. Ҳисобат мағлыўматлары'],
    ['2. O\'quvchilar ro\'yxati', '2. Список учеников', '2. Оқыўшылар дизими'],
    ['3. Ballarni kiriting', '3. Введите баллы', '3. Байларды киргизиң'],
    ['4. Hisobot', '4. Отчёт', '4. Ҳисобат'],
    ['3. Savollar soni, mezon va ballar', '3. Количество вопросов, критерии и баллы', '3. Сораўлар саны, өлшем ҳәм байлары'],
    ['Excel faylni tanlash', 'Выбрать Excel-файл', 'Excel файлын таңлаў'],
    ['+ O\'quvchi qo\'shish', '+ Добавить ученика', '+ Оқыўшы қосыў'],
    ['Hammasini tozalash', 'Очистить всё', 'Ҳаммесин тазалаў'],
    ['Excel faylni ', 'Excel-файл ', 'Excel файлын '],
    ['platformasidan kerakli sinf jurnalini eksport qilib yuklang. Yangi fayl yuklansa, kiritilgan ballar o\'chadi.', 'экспортируйте нужный классный журнал с платформы. При загрузке нового файла введённые баллы удалятся.', 'платформасынан керекли клас журналын экспортлап жүклең. Жаңа файл жүкленсе, киргизилген байлар өшириледи.'],
    ['Excel faylni emaktab.uz dan eksport qilib yuklang. Yangi fayl yuklansa, ballar o\'chadi.', 'Загрузите файл, экспортированный с emaktab.uz. При загрузке нового файла баллы удалятся.', 'Excel файлды emaktab.uz дан экспортлап жүклең. Жаңа файл жүкленсе, байлар өшириледи.'],
    ['Savollar soni', 'Количество вопросов', 'Сораўлар саны'],
    ['"5" baho (% dan)', 'Оценка "5" (от %)', '"5" баҳа (% ден)'],
    ['"4" baho (% dan)', 'Оценка "4" (от %)', '"4" баҳа (% ден)'],
    ['"3" baho (% dan)', 'Оценка "3" (от %)', '"3" баҳа (% ден)'],
    ['Har bir savol uchun mezon ballini yozing.', 'Для каждого вопроса укажите критерий (максимальный балл).', 'Ҳәр бир сораў ушын өлшем байын жазың.'],
    ['O\'quvchi yo\'q — Excel yuklang yoki qo\'lda qo\'shing.', 'Учеников нет — загрузите Excel или добавьте вручную.', 'Оқыўшы жоқ — Excel жүклең яки қолда қосың.'],
    ['PDF yuklab olish', 'Скачать PDF', 'PDF жүклеп алыў'],
    ['Excel yuklab olish', 'Скачать Excel', 'Excel жүклеп алыў'],
    ['Chop etish', 'Печать', 'Басып шығарыў'],
    ['Yuklab olish bu ko\'rinishda mavjud emas.', 'Скачивание в этом режиме недоступно.', 'Жүклеп алыў бу көринисте жоқ.'],
    ['Ball kiritilmagan o\'quvchi hisobotga kirmaydi. Izoh ustuniga har bir o\'quvchi uchun qisqa izoh yozing.', 'Ученик без баллов не включается в отчёт. В столбец примечаний впишите краткий комментарий для каждого ученика.', 'Бай киргизилмеген оқыўшы ҳисобатқа кирмейди. Изох бағанына ҳәр бир оқыўшы ушын қысқаша түсиндириў жазың.'],
    ['Choraklik hisob bo\'limi tez orada ishga tushiriladi.', 'Раздел четвертного отчёта скоро будет доступен.', 'Шерек ҳисобаты бөлими тез арада ислейди.'],

    // LI
    ['Loyiha ishi (LI) natijalari hisobchisi', 'Калькулятор результатов проектной работы (LI)', 'Лойиҳа иси (LI) нәтийжелери ҳисоблағышы'],
    ['Ro\'yxatni yuklang, savollar soni va mezon ballarini kiriting — jami ball, foiz, baho, izoh va sinf hisoboti o\'zi chiqadi.', 'Загрузите список, введите количество вопросов и критерии — общий балл, процент, оценка, комментарий и отчёт класса рассчитаются автоматически.', 'Дизимди жүклең, сораўлар саны ҳәм өлшем байларын киргизиң — жамий бай, процент, баҳа, түсиндириў ҳәм клас ҳисобаты өзи шығады.'],
    ['1. Loyiha va hisobot ma\'lumotlari', '1. Данные проекта и отчёта', '1. Лойиҳа ҳәм ҳисобат мағлыўматлары'],

    // Kuratorlik
    ['Kuratorlik hisoboti', 'Кураторский отчёт', 'Куратор ҳисобаты'],
    ['1. Sinf ma\'lumotlari', '1. Данные класса', '1. Клас мағлыўматлары'],
    ['Ustunlarni tiklash', 'Восстановить столбцы', 'Бағанларды қайта тиклеў'],
    ['Excel faylni <b>emaktab.uz</b> jurnalidan (B ustun, 11-qatordan) yuklang yoki tayyor guvohnoma ro\'yxatini yuklang — barcha ustunlar avtomatik to\'ldiriladi. Istalgan ustun sarlavhasiga bosing va tasdiqlang: ustun o\'chiriladi.', 'Загрузите Excel-файл из журнала <b>emaktab.uz</b> (столбец B, с 11-й строки) или готовый список свидетельств — все столбцы заполнятся автоматически. Нажмите на заголовок любого столбца и подтвердите: столбец будет удалён.', 'Excel файлды <b>emaktab.uz</b> журналынан (В бағаны, 11-қатардан) яки тайын гуўаҳатнама дизiminен жүклең — барлық бағанлар өзи толтырылады. Ҳәр қандай баған басына басып, тастықлаң: баған өшириледи.'],
    ['Yuklab olganda fayl kompyuteringizga saqlanadi va bot orqali Telegram\'ga ham yuboriladi; qolgan kredit 1 ga kamayadi.', 'При скачивании файл сохраняется на компьютере и также отправляется в Telegram через бота; оставшийся кредит уменьшается на 1.', 'Жүклеп алғанда файл компьютериңизге сақланады ҳәм бот арқалы Telegram ǵа да жибериледи; қалған кредит 1ге азаяды.'],

    // Choraklik
    ['Emaktab jurnalini yuklang (.xls / .xlsx). BSB, CHSB, LI, FB, Ballar va chorak baholari asosida hisobot jadvali hamda diagrammalar avtomatik hosil bo\'ladi.', 'Загрузите журнал emaktab (.xls / .xlsx). Таблица отчёта и диаграммы формируются автоматически на основе оценок BSB, CHSB, LI, FB, баллов и четвертных оценок.', 'Emaktab журналын жүклең (.xls / .xlsx). BSB, CHSB, LI, FB, байлар ҳәм шерек баҳалары тийкарында ҳисобат кестеси ҳәм диаграммалар өзи пайда болады.'],
    ['Jurnal tanlash (.xls / .xlsx)', 'Выбрать журнал (.xls / .xlsx)', 'Журнал таңлаў (.xls / .xlsx)'],
    ['📊 Excel yuklab olish', '📊 Скачать Excel', '📊 Excel жүклеп алыў'],
    ['🖨 Chop etish', '🖨 Печать', '🖨 Басып шығарыў'],

    // Ma'lumotlarim / hisob
    ['O\'qituvchi ma\'lumotlari', 'Данные учителя', 'Оқытыўшы мағлыўматлары'],
    ['Ma\'lumotlarni saqlash', 'Сохранить данные', 'Мағлыўматларды сақлаў'],
    ['Tozalash', 'Очистить', 'Тазалаў'],
    ['Hisob holati', 'Состояние аккаунта', 'Ҳисоб жағдайы'],
    ['Tarifingiz va hisobingiz bo\'yicha qisqa ma\'lumot.', 'Краткая информация о вашем тарифе и аккаунте.', 'Тарифиңиз ҳәм ҳисобиңиз бойынша қысқаша мағлыўмат.'],
    ['Tarif', 'Тариф', 'Тариф'], ['Yuklab olishlar', 'Скачивания', 'Жүклеп алыўлар'],
    ['Qolgan kredit', 'Осталось кредитов', 'Қалған кредит'],
    ['PDF va Excel hisobotlari soni', 'Количество PDF и Excel отчётов', 'PDF ҳәм Excel ҳисобатлары саны'],
    ['Telegram orqali kiring', 'Войдите через Telegram', 'Telegram арқалы кириң'],
    ['Tarifni ko\'rish uchun Telegram orqali kiring', 'Войдите через Telegram, чтобы увидеть тариф', 'Тарифти көриў ушын Telegram арқалы кириң'],
    ['Premium sotib olinganda 40 ta qo\'shiladi', 'При покупке Premium добавляется 40', 'Premium сатып алғанда 40 қосылады'],
    ['Hisobot yuklaganingizda 1 ta kamayadi (bepul kreditlaringiz bor)', 'Уменьшается на 1 при скачивании отчёта (есть бесплатные кредиты)', 'Ҳисобат жүклегенде 1ге азаяды (тегин кредитлериңиз бар)'],
    ['Oddiy', 'Обычный', 'Әдиyy'], ['Barcha imkoniyatlar yoqilgan', 'Все возможности включены', 'Барлық имканиятлар қосылған'],
    ['Standart hisob', 'Стандартный аккаунт', 'Стандарт ҳисоб'],
    ['40 ta yuklab olish huquqi', '40 прав на скачивание', '40 жүклеп алыў ҳуқуқы'],
    ['Click · Payme · Uzcard · Humo — xavfsiz to\'lov', 'Click · Payme · Uzcard · Humo — безопасная оплата', 'Click · Payme · Uzcard · Humo — қәўипсиз төлем'],
    ['Premium sotib olish', 'Купить Premium', 'Premium сатып алыў'],
    ['40 000 so\'m', '40 000 сум', '40 000 сум'],
    ['To\'lovdan keyin kreditlar avtomatik qo\'shiladi. Sahifani yangilang.', 'После оплаты кредиты добавляются автоматически. Обновите страницу.', 'Төлемнен кейин кредитлер өзи қосылады. Бетти жаңалаң.'],

    // Modallar / xabarlar
    ['Xabar', 'Сообщение', 'Хабар'],
    ['O\'quvchini o\'chirish', 'Удаление ученика', 'Оқыўшыны өшириў'],
    ['Ushbu o\'quvchi ro\'yxatdan o\'chirilsinmi?', 'Удалить этого ученика из списка?', 'Бу оқыўшы дизимнен өширилсинми?'],
    ['Yo\'q, qoldirish', 'Нет, оставить', 'Яқ, қалдырыў'],
    ['Ha, o\'chirish', 'Да, удалить', 'Ҳәа, өшириў'],
    ['Tasdiqlash', 'Подтверждение', 'Тастықлаў'],
    ['Ustunni o\'chirish', 'Удаление столбца', 'Бағанды өшириў'],
    ['Premium sotib oling', 'Купите Premium', 'Premium сатып алың'],
    ['3 ta bepul hisobot ishlatib bo\'lingan', 'Использовано 3 бесплатных отчёта', '3 тегин ҳисобат пайдаланылды'],
    ['Yana hisobot yuklab olish uchun premium kreditlari kerak. Barcha hisobot turlari — BSB, CHSB, LI, Kuratorlik va Choraklik.', 'Для скачивания следующих отчётов нужны premium-кредиты. Все виды отчётов — BSB, CHSB, LI, кураторский и четвертной.', 'Және ҳисобат жүклеп алыў ушын премиум кредитлери керек. Барлық ҳисобат түрлери — BSB, CHSB, LI, кураторлық ҳәм шереклик.'],
    ['Premium — 40 ta hisobot', 'Premium — 40 отчётов', 'Premium — 40 ҳисобат'],
    ['Click, Payme, Uzcard yoki Humo orqali to\'lash', 'Оплата через Click, Payme, Uzcard или Humo', 'Click, Payme, Uzcard яки Humo арқалы төлеў'],
    ['40 000 so‘m', '40 000 сум', '40 000 сум'],
    ['To\'lov sahifasiga o\'tish', 'Перейти к оплате', 'Төлем бетине өтиў'],
    ['Keyinroq', 'Позже', 'Кейин'],
    ['Kirish bilan 3 ta bepul hisobot', '3 бесплатных отчёта при входе', 'Киргенде 3 тегин ҳисобат'],
    ['Telegram orqali kiring', 'Войдите через Telegram', 'Telegram арқалы кириң'],
    ['Hisobotlarni yuklab olish va saqlash uchun Telegram akkauntingiz bilan kiring.', 'Войдите со своим аккаунтом Telegram, чтобы скачивать и сохранять отчёты.', 'Ҳисобатларды жүклеп алыў ҳәм сақлаў ушын Telegram аккаунтыңыз бенен кириң.'],
    ['Telegram hisobingiz bilan kiring. Telefon raqamingiz faqat Telegram tomonidan tasdiqlanadi — sayt uni saqlamaydi.', 'Войдите со своим аккаунтом Telegram. Номер телефона подтверждается только Telegram — сайт его не сохраняет.', 'Telegram аккаунтыңыз бенен кириң. Телефон номериңиз тек Telegram тәрепинен тастықланады — сайт оны сақламайды.'],
    ['Boshqa Telegram akkaunti bilan kirish', 'Войти с другим аккаунтом Telegram', 'Басқа Telegram аккаунты менен кириў'],
    ['Yopish', 'Закрыть', 'Жабыў'],
    ['Bot username hali sozlanmagan. Keyinroq urinib ko\'ring.', 'Имя бота ещё не настроено. Попробуйте позже.', 'Бот аты ҳәли соzlанбаған. Кейинирек ҳәрекет етиң.'],
    ['Yuklab olish uchun Telegram orqali kiring', 'Войдите через Telegram для скачивания', 'Жүклеп алыў ушын Telegram арқалы кириң'],
    ['Premium sotib olish uchun avval Telegram orqali kiring', 'Сначала войдите через Telegram для покупки Premium', 'Premium сатып алыў ушын дәслеп Telegram арқалы кириң'],
    ['To\'lov havolasi tayyorlanmoqda...', 'Подготовка ссылки на оплату...', 'Төлем ссылкасы тайынланып атыр...'],
    ['Xatolik yuz berdi', 'Произошла ошибка', 'Қателик жүз берди'],
    ['Kirish amalga oshmadi: ', 'Вход не выполнен: ', 'Кириў әмелге аспады: '],
    ['Kirish xatosi: ', 'Ошибка входа: ', 'Кириў қатеси: '],
    ['Telegram orqali kirdingiz — 3 ta bepul kredit qo\'shildi', 'Вы вошли через Telegram — добавлено 3 бесплатных кредита', 'Telegram арқалы кирдиңиз — 3 тегин кредит қосылды'],
    ['Telegram orqali kirdingiz', 'Вы вошли через Telegram', 'Telegram арқалы кирдиңиз'],
    ['Chiqdingiz', 'Вы вышли', 'Шықтыңыз'],
    ['Premium yoqildi', 'Premium включён', 'Premium қосылды'],
    ['Premium o\'chirildi', 'Premium выключен', 'Premium өширилди'],
    ['O\'zgartirilmadi', 'Не изменено', 'Өзгертилмеди'],
    ['Ruxsat yo\'q yoki xato', 'Нет доступа или ошибка', 'Рухсат жоқ яки қателик'],
    ['Profilni bulutga saqlash uchun Telegram orqali kiring', 'Войдите через Telegram для сохранения профиля в облаке', 'Профилди булутқа сақлаў ушын Telegram арқалы кириң'],
    ['Ma\'lumotlar saqlandi', 'Данные сохранены', 'Мағлыўматлар сақланды'],
    ['Saqlashda xato', 'Ошибка сохранения', 'Сақлаўда қателик'],
    ['Maydonlarni to\'ldiring: ', 'Заполните поля: ', 'Қатарларды толтырың: '],
    ['Ma\'lumotlar shu akkauntga saqlandi', 'Данные сохранены для этого аккаунта', 'Мағлыўматлар бу аккаунтқа сақланды'],
    ['Avval Telegram orqali kiring', 'Сначала войдите через Telegram', 'Дәслеп Telegram арқалы кириң'],
    ["Bu akkaunt uchun saqlangan ma'lumotlaringiz quyida keltirilgan. Tekshirib chiqing va kerak bo'lsa o'zgartiring — ular faqat shu akkauntga tegishli.", 'Сохранённые данные этого аккаунта приведены ниже. Проверьте и при необходимости измените — они относятся только к этому аккаунту.', 'Бу аккаунт ушын сақланған мағлыўматларыңыз төменде келтирилген. Тексерип, керек болса өзгертиң — олар тек бу аккаунтқа тийисли.'],
    ["Bu Telegram akkaunti uchun ma'lumotlaringiz topilmadi yoki to'liq emas. Viloyat, tuman, maktab raqami va F.I.Sh.ni kiriting — ular faqat shu akkauntga saqlanadi.", 'Данные для этого Telegram-аккаунта не найдены или неполны. Введите область, район, номер школы и ФИО — они сохраняются только для этого аккаунта.', 'Бу Telegram аккаунты ушын мағлыўматларыңыз табылмады яки толық емес. Уәлаят, район, мектеп номери ҳәм А.Ф.И.ди киргизиң — олар тек бу аккаунтқа сақланады.'],
    ['Ma\'lumotlar doimiy saqlanadi va har bir hisobotning boshiga avtomatik qo\'yiladi. Sinf, fan, chorak kabi o\'zgaruvchi ma\'lumotlarni BSB hisoboti ichida kiriting.', 'Данные сохраняются постоянно и автоматически добавляются в начало каждого отчёта. Переменные данные (класс, предмет, четверть) вводятся в отчёте BSB.', 'Мағлыўматлар дайым сақланады ҳәм ҳәр бир ҳисобаттың басына өзи қойылады. Клас, пән, шерек сыяқлы өзгеретуғын мағлыўматларды BSB ҳисобаты ишинде киргизиң.'],
    ["Telegram'dagi eski akkaunt chiqarildi. Endi kerakli akkaunt bilan kiring: Telegram oynasida boshqa akkauntni tanlashingiz mumkin.", 'Старый аккаунт в Telegram отключён. Войдите с нужным аккаунтом: в окне Telegram можно выбрать другой аккаунт.', 'Telegram ǵағы ески аккаунт шығарылды. Енди керекли аккаунт бенен кириң: Telegram терезесинде басқа аккаунтты таңлаўыңыз мүмкин.'],
    ['To\'lov tasdiqlandi — kreditlar qo\'shildi', 'Оплата подтверждена — кредиты добавлены', 'Төлем тастықланды — кредитлер қосылды'],

    // Maydonlar / jadval
    ['Sinf (raqami)', 'Класс (номер)', 'Клас (номери)'], ['Sinf harfi (A, B, D...)', 'Буква класса (A, B, D...)', 'Клас ҳәрпи (A, B, D...)'],
    ['Fan', 'Предмет', 'Пән'], ['Chorak', 'Четверть', 'Шерек'], ['Baholash turi', 'Вид оценки', 'Баҳалаў түри'],
    ['Tartib raqami', 'Порядковый номер', 'Тәртип нOMERи'], ['Sana', 'Дата', 'Сәне'],
    ['Tanlang...', 'Выберите...', 'Таңлаң...'], ['Harf...', 'Буква...', 'Ҳәрип...'], ['Fanni tanlang...', 'Выберите предмет...', 'Пәнди таңлаң...'],
    ['Viloyat / Hudud', 'Область / Регион', 'Уәлаят / Аймақ'], ['Hududni tanlang...', 'Выберите регион...', 'Аймақты таңлаң...'],
    ['Tuman / Shahar', 'Район / Город', 'Район / Қала'], ['Avval viloyatni tanlang', 'Сначала выберите область', 'Дәслеп уәлаятты таңлаң'],
    ['Maktab raqami', 'Номер школы', 'Мектеп нOMERи'], ['masalan: 12', 'например: 12', 'мысалы: 12'],
    ['O\'qituvchi F.I.Sh.', 'ФИО учителя', 'Оқытыўшы А.Ф.И.'], ['masalan: Nuraliyev A.N.', 'например: Nuraliyev A.N.', 'мысалы: Nuraliyev A.N.'],
    ['Loyiha nomi / mavzusi', 'Название / тема проекта', 'Лойиҳа аты / темасы'], ['masalan: Suvni tejash loyihasi', 'например: Проект по экономии воды', 'мысалы: Суўды тежеў лойиҳасы'],
    ['Sinf rahbari F.I.Sh.', 'ФИО классного руководителя', 'Клас басшысы А.Ф.И.'], ['masalan: Karimova A.B.', 'например: Karimova A.B.', 'мысалы: Karimova A.B.'],
    ['Sinf', 'Класс', 'Клас'], ['Harf', 'Буква', 'Ҳәрип'], ['B', 'B', 'B'],
    ['Doimiy ma\'lumotlar: ', 'Постоянные данные: ', 'Дайым мағлыўматлар: '],
    [' — «Ma\'lumotlarim» bo\'limida o\'zgartiring.', ' — измените в разделе «Мои данные».', ' — «Мағлыўматларым» бөлиминде өзгертиң.'],
    ["Viloyat, tuman, maktab va o'qituvchi «Ma'lumotlarim» bo'limida kiritiladi.", 'Область, район, школа и учитель вводятся в разделе «Мои данные».', 'Уәлаят, район, мектеп ҳәм оқытыўшы «Мағлыўматларым» бөлиминде киргизиледи.'],
    ["Viloyat, tuman va maktab raqami «Ma'lumotlarim» bo'limida kiritiladi.", 'Область, район и номер школы вводятся в разделе «Мои данные».', 'Уәлаят, район ҳәм мектеп нOMERи «Мағлыўматларым» бөлиминде киргизиледи.'],
    ['-maktab', '-школа', '-мектеп'], ['-sonli umumiy o\'rta ta\'lim maktabi', '-я средняя общеобразовательная школа', '-санлы орта билим мектеби'],
    ["umumiy o'rta ta'lim maktabi", 'средняя общеобразовательная школа', 'орта билим мектеби'],
    ['Maktabgacha va maktab ta\'limi bo\'limi tasarrufidagi', 'в ведении отдела дошкольного и школьного образования', 'Мектепке шекемги ҳәм мектеп таlimи бөлими қарамағындағы'],
    ["o'quvchilarining", 'учеников', 'оқыўшыларының'], ['fanidan', 'по предмету', 'пәнинен'],
    ['chorakda olingan', 'за четверть получены', 'шеректе алынған'], ['natijalari', 'результаты', 'нәтийжелери'],
    ['fan o\'qituvchisi', 'учитель предмета', 'пән оқытыўшысы'], ['Sana: ', 'Дата: ', 'Сәне: '],
    ['sinf', 'класс', 'клас'], ['fan', 'предмет', 'пән'], ['Kuratorlik', 'Кураторский', 'Кураторлық'],
    ['T/R', '№', '№'], ['№', '№', '№'], ["O'quvchilar F.I.SH", 'ФИО учеников', 'Оқыўшылар А.Ф.И.'],
    ['F.I.SH', 'ФИО', 'А.Ф.И.'], ['FISH', 'ФИО', 'АФИ'],
    ["To'plagan ball", 'Набранный балл', 'Жыйнаған бай'], ['Jami ball', 'Общий балл', 'Жамий бай'],
    ['Jami: ', 'Всего: ', 'Жамий: '], ['Foiz (%)', 'Процент (%)', 'Процент (%)'], ['Foiz', 'Процент', 'Процент'],
    ['Baho', 'Оценка', 'Баҳа'], ['Izoh', 'Примечание', 'Түсиндириў'], ['Mezon ball', 'Критерий (балл)', 'Өлшем байы'],
    ['Mezon:', 'Критерий:', 'Өлшем:'], ['Ball:', 'Балл:', 'Бай:'],
    ['-savol', '-вопрос', '-сораў'], ['1-savol', '1-вопрос', '1-сораў'],
    ["O'quvchilar to'plagan o'rtacha ballar", 'Средние баллы учеников', 'Оқыўшылардың орташа байлары'],
    ['O\'rtacha ballar', 'Средние баллы', 'Орташа байлар'],
    ['O\'rtacha foiz', 'Средний процент', 'Орташа процент'],
    ["O'zlashtirish ko'rsatkichi (3, 4, 5 olganlar)", 'Показатель успеваемости (получившие 3, 4, 5)', 'Өзлестириў көрсеткиши (3, 4, 5 алғанлар)'],
    ["Sifat ko'rsatkichi (4 va 5 olganlar)", 'Показатель качества (получившие 4 и 5)', 'Сапат көрсеткиши (4 ҳәм 5 алғанлар)'],
    ["Ball kiritilgan o'quvchilar", 'Ученики с введёнными баллами', 'Бай киргизилген оқыўшылар'],
    ["O'zlashtirish", 'Успеваемость', 'Өзлестириў'], ['Sifat ko\'rsatkichi', 'Показатель качества', 'Сапат көрсеткиши'],
    ['Ball', 'Балл', 'Бай'], ['baho', 'оценка', 'баҳа'], ['baholar', 'оценки', 'баҳалар'],
    ['5 baho', 'оценка 5', '5 баҳа'], ['4 baho', 'оценка 4', '4 баҳа'], ['3 baho', 'оценка 3', '3 баҳа'], ['2 baho', 'оценка 2', '2 баҳа'],
    ['1-chorak', '1-четверть', '1-шерек'], ['2-chorak', '2-четверть', '2-шерек'], ['3-chorak', '3-четверть', '3-шерек'], ['4-chorak', '4-четверть', '4-шерек'],
    ['Hisobot', 'Отчёт', 'Ҳисобат'], ['Yuklanmoqda...', 'Загрузка...', 'Жүкленип атыр...'],
    ['Foydalanuvchilar', 'Пользователи', 'Пайдаланушылар'], ['Yuklanmoqda...', 'Загрузка...', 'Жүкленип атыр...'],
    ['Hozircha foydalanuvchi yo\'q', 'Пока нет пользователей', 'Ҳәзирше пайдаланушы жоқ'],
    ['Yangilash', 'Обновить', 'Жаңалаў'], ['Bu bo\'lim faqat administrator uchun', 'Этот раздел только для администратора', 'Бу бөлим тек администратор ушын'],
    ['Viloyat / Tuman / Maktab', 'Область / Район / Школа', 'Уәлаят / Район / Мектеп'],

    // Xabarlar (dinamik)
    ["O'quvchi ro'yxatdan o'chirildi", 'Ученик удалён из списка', 'Оқыўшы дизимнен өширилди'],
    ['Ustun o\'chirildi', 'Столбец удалён', 'Баған өширилди'], ["Ro'yxat tozalandi", 'Список очищен', 'Дизим тазаланды'],
    ['Ustunlar tiklandi', 'Столбцы восстановлены', 'Бағанлар қайта тикленди'],
    ["Ma'lumotlar tozalandi", 'Данные очищены', 'Мағлыўматлар тазаланды'],
    ['Aniq tozalansinmi? Yana bosing', 'Точно очистить? Нажмите ещё раз', 'Анық тазалансынми? Және басың'],
    ['Excel kutubxonasi yuklanmadi. Internetni tekshiring.', 'Библиотека Excel не загрузилась. Проверьте интернет.', 'Excel китапханасы жүкленбеди. Интернетти тексериң.'],
    ['Excel kutubxonasi yuklanmadi', 'Библиотека Excel не загрузилась', 'Excel китапханасы жүкленбеди'],
    ['B ustunda 11-qatordan boshlab ismlar topilmadi. Fayl shaklini tekshiring.', 'В столбце B начиная с 11-й строки имена не найдены. Проверьте формат файла.', 'В бағанынан 11-қатардан баслап атлар табылмады. Файл форматын тексериң.'],
    ["O'quvchi ismlari topilmadi. Fayl shaklini tekshiring.", 'Имена учеников не найдены. Проверьте формат файла.', 'Оқыўшы атлары табылмады. Файл форматын тексериң.'],
    ["Fayldan o'quvchilar topilmadi. FISH ustuni yoki B ustun 11-qatorni tekshiring.", 'В файле не найдены ученики. Проверьте столбец ФИО или столбец B, строку 11.', 'Файлдан оқыўшылар табылмады. АФИ бағаны яки В бағаны 11-қатарды тексериң.'],
    ['Faylni o\'qib bo\'lmadi: ', 'Не удалось прочитать файл: ', 'Файлды оқып болмады: '],
    ['Excel tayyorlanmoqda...', 'Подготовка Excel...', 'Excel тайынланып атыр...'],
    ['Excel tayyorlanmoqda, biroz kuting…', 'Подготовка Excel, немного подождите…', 'Excel тайынланып атыр, бир аз күтиң…'],
    ['Excel tayyorlashda xato: ', 'Ошибка при подготовке Excel: ', 'Excel тайынлаўда қателик: '],
    ['PDF kutubxonasi yuklanmadi.', 'Библиотека PDF не загружена.', 'PDF китапханасы жүкленбеди.'],
    ['PDF tayyorlanmoqda...', 'Подготовка PDF...', 'PDF тайынланып атыр...'],
    ['PDF kutubxonasi yuklanmoqda...', 'Загружается библиотека PDF...', 'PDF kitapxanası júklenip atır...'],
    ['PDF tayyorlashda xato: ', 'Ошибка при подготовке PDF: ', 'PDF тайынлаўда қателик: '],
    ['Baho noto\'g\'ri!', 'Неверная оценка!', 'Баҳа надурыс!'],
    ['Baho noto\'g\'ri', 'Неверная оценка', 'Баҳа надурыс'],
    ['Diqqat: ', 'Внимание: ', 'Диққат: '],
    [' ta baho mezondan yuqori!', ' оценки превышают критерий!', ' баҳа өлшемнен артық!'],
    [' va yuqori', ' и выше', ' ҳәм одан жоқары'],
    [' dan', ' от', ' ден'], [' undan past — ', ' ниже — ', ' одан төмен — '],
    ['Chegaralar tuzatildi: ', 'Границы исправлены: ', 'Шегаралар түзетилди: '],
    ['Baho chegaralari tuzatildi: ', 'Границы оценок исправлены: ', 'Баҳа шегаралары түзетилди: '],
    ['Baho chegaralari: ', 'Границы оценок: ', 'Баҳа шегаралары: '],
    ['Yuklab olindi', 'Скачано', 'Жүклеп алынды'],
    ['yuklab olindi', 'скачано', 'жүклеп алынды'],
    ['Yuklab bo\'lmadi: ', 'Не удалось скачать: ', 'Жүклеп болмады: '],
    [' · Telegram botga ham yuborildi', ' · также отправлено через Telegram-бота', ' · Telegram боты арқалы да жиберилди'],
    ['Fayl Telegram botga ham yuborildi', 'Файл также отправлен через Telegram-бота', 'Файл Telegram боты арқалы да жиберилди'],
    ['Ta\'lim', 'Образование', 'Талим'],
    ['Shaxsiy hisob', 'Личный кабинет', 'Жеке ҳисоб'],
    ['Ro\'yxat', 'Список', 'Дизим'],
    ['query', 'запрос', 'сораў'],
    ['Hisob', 'Счёт', 'Ҳисоб'],

    // Fanlar (select va hisobotlarda)
    ['Ona tili', 'Родной язык', 'Ана тили'], ['O\'zbek tili', 'Узбекский язык', 'Өзбек тили'],
    ['Rus tili', 'Русский язык', 'Рус тили'], ['Ingliz tili', 'Английский язык', 'Инглиз тили'],
    ['Nemis tili', 'Немецкий язык', 'Немис тили'], ['Fransuz tili', 'Французский язык', 'Француз тили'],
    ['Adabiyot', 'Литература', 'Әдебият'], ['Matematika', 'Математика', 'Математика'],
    ['Algebra', 'Алгебра', 'Алгебра'], ['Geometriya', 'Геометрия', 'Геометрия'],
    ['Informatika va AT', 'Информатика и ИТ', 'Информатика ҳәм ИТ'], ['Fizika', 'Физика', 'Физика'],
    ['Kimyo', 'Химия', 'Химия'], ['Biologiya', 'Биология', 'Биология'],
    ['Geografiya', 'География', 'География'], ['Tarix', 'История', 'Тарих'],
    ['O\'zbekiston tarixi', 'История Узбекистана', 'Өзбекстан тарихы'], ['Jahon tarixi', 'Всемирная история', 'Жаҳон тарихы'],
    ['Huquq', 'Право', 'Ҳуқуқ'], ['Iqtisodiy bilim asoslari', 'Основы экономических знаний', 'Экономикалық билим негизлери'],
    ['Tarbiya', 'Воспитание', 'Тәрбия'], ['Musiqa', 'Музыка', 'Музыка'],
    ['Tasviriy san\'at', 'Изобразительное искусство', 'Сүўретлеў өнери'], ['Texnologiya', 'Технология', 'Технология'],
    ['Jismoniy tarbiya', 'Физическая культура', 'Физикалық тәрбия'],
    ['Chaqiriqqa qadar harbiy ta\'lim', 'Военное образование до призыва', 'Чақырыққа шекемги ҳәрбий талим'],

    // Kuratorlik ustunlari
    ['Tug\'ilgan kun,oy,yil', 'День,месяц,год рождения', 'Туўылған күн,ай,жыл'],
    ['Manzili', 'Адрес', 'Адреси'], ['Otasining FISH', 'ФИО отца', 'Әкесиниң А.Ф.И.'],
    ['Onasining FISH', 'ФИО матери', 'Анасыниң А.Ф.И.'], ['Telefon raqami', 'Номер телефона', 'Телефон нOMERи'],
    ['Tug\'ilganligi haqida guvohnoma seriya', 'Серия свидетельства о рождении', 'Туўылғаны ҳаққында гуўаҳатнама сериясы'],
    ['O\'quvchi soni', 'Количество учеников', 'Оқыўшылар саны'],
    ['Ustun soni', 'Количество столбцов', 'Бағанлар саны'],
    ['Sinf rahbari: ', 'Классный руководитель: ', 'Клас басшысы: '],
    ['Sahifa ', 'Страница ', 'Бет '],
    ['O\'quvchilar ro\'yxati', 'Список учеников', 'Оқыўшылар дизими'],
    ['to\'liq ro\'yxat', 'полный список', 'толық дизим'],
    ['(B ustun, 11-qatordan)', '(столбец B, с 11-й строки)', '(В бағаны, 11-қатардан)'],

    // Choraklik ichki matnlari
    ['Sinf:', 'Класс:', 'Клас:'], ['Fan:', 'Предмет:', 'Пән:'],
    ['o\'qituvchining FIO:', 'ФИО учителя:', 'оқытыўшы А.Ф.И.:'],
    ['X/X №', '№ п/п', '№ п/п'], ['O\'quvchining ism va familiyasi', 'Фамилия и имя ученика', 'Оқыўшының ат-фамилиясы'],
    ['Ism va familiya', 'Фамилия и имя', 'Ат-фамилия'],
    ['Ko\'rsatkich', 'Показатель', 'Көрсеткиш'],
    ['Jami o\'quvchilar', 'Всего учеников', 'Жамий оқыўшылар'],
    ['5 baho olgan o\'quvchilar', 'Ученики с оценкой 5', '5 баҳа алған оқыўшылар'],
    ['4 baho olgan o\'quvchilar', 'Ученики с оценкой 4', '4 баҳа алған оқыўшылар'],
    ['3 baho olgan o\'quvchilar', 'Ученики с оценкой 3', '3 баҳа алған оқыўшылар'],
    ['2 baho olgan o\'quvchilar', 'Ученики с оценкой 2', '2 баҳа алған оқыўшылар'],
    ['1 baho olgan o\'quvchilar', 'Ученики с оценкой 1', '1 баҳа алған оқыўшылар'],
    ['Baho yo\'q (T/O, OZ va h.k.)', 'Без оценки (Т/О, ОЗ и др.)', 'Баҳа жоқ (Т/О, ОЗ ҳ.к.)'],
    ['Choraklik baholar diagrammasi', 'Диаграмма четвертных оценок', 'Шерек баҳалары диаграммасы'],
    ['O\'quvchilar bo\'yicha umumiy ball (JAMI)', 'Общий балл по ученикам (Итого)', 'Оқыўшылар бойынша жамий бай'],
    ['Diqqat: chorak ustuni topilmadi.', 'Внимание: столбец четверти не найден.', 'Диққат: шерек бағаны табылмады.'],
    ['Ro\'yxatda o\'quvchi qolmadi: BSB, CHSB va chorak kataklari bo\'sh.', 'В списке не осталось учеников: ячейки BSB, CHSB и четверти пусты.', 'Дизимде оқыўшы қалмады: BSB, CHSB ҳәм шерек қатарлары бос.'],
    ['Excel o\'qish kutubxonasi yuklanmadi. Internetga ulanib, sahifani qayta oching.', 'Библиотека чтения Excel не загружена. Подключитесь к интернету и обновите страницу.', 'Excel оқыў китапханасы жүкленбеди. Интернетке уланып, бетти қайта ашың.'],
    ['Excel yozish kutubxonasi yuklanmadi. Internetga ulanib, sahifani qayta oching.', 'Библиотека записи Excel не загружена. Подключитесь к интернету и обновите страницу.', 'Excel жазыў китапханасы жүкленбеди. Интернетке уланып, бетти қайта ашың.'],
    ['Avval jurnal faylini tanlang.', 'Сначала выберите файл журнала.', 'Дәслеп журнал файлын таңлаң.'],
    ['Jadval boshi ("X/X №" yoki "№ п/п") topilmadi. Bu e-maktab jurnali emasga o‘xshaydi.', 'Заголовок таблицы ("№ п/п") не найден. Похоже, это не журнал e-maktab.', 'Кесте басы ("№ п/п") табылмады. Бу e-maktab журналы емес сыяқлы.'],
    ['Diagrammani rasmga aylantirib bo\'lmadi.', 'Не удалось преобразовать диаграмму в изображение.', 'Диаграмманы сүўретке айландырып болмады.'],
    ['JAMI', 'ИТОГО', 'ЖАМИЙ'], ['BSB', 'BSB', 'BSB'], ['CHSB', 'CHSB', 'CHSB'], ['LI', 'LI', 'LI'], ['FB', 'FB', 'FB'],
    ['baho olgan', 'с оценкой', 'баҳа алған'], ['nafar o\'quvchi', 'учеников', 'оқыўшы'],
    ['Va', 'И', 'Ҳәм'], ['va', 'и', 'ҳәм'], ['yoki', 'или', 'яки'], ['bu', 'это', 'бу'],
    ['Barcha', 'Все', 'Барлық'], ['haqida', 'о', 'ҳаққында'], ['uchun', 'для', 'ушын'],
    ['bilan', 'с', 'менен'], ['dan', 'из', 'ден'], ['ga', 'в', 'ǵа'], ['ni', '', 'ды'],
    ['Maktab Hisobot', 'Maktab Hisobot', 'Maktab Hisobot'],

    // Bot orqali kirish oynasi va kiritilgan xabarlar
    ['Telegram botda tasdiqlash', 'Подтвердить через Telegram-бот', 'Telegram bot arqalı tasdiqlaw'],
    ['Boshqa usul bilan kirish', 'Другой способ входа', 'Basqa usıl menen kiriw'],
    ['Yopish', 'Закрыть', 'Jabıw'],
    ['Telegram orqali kiring', 'Войдите через Telegram', 'Telegram arqalı kiriń'],
    ['Hisobotlarni yuklab olish va saqlash uchun Telegram akkauntingiz bilan kiring.', 'Войдите через Telegram, чтобы скачивать отчёты и сохранять аккаунт.', 'Hisobatlardı júklep alıw hám saqlaw ushın Telegram akkauntıńız benen kiriń.'],
    ['Tugmani bosing — Telegramda', 'Нажмите кнопку — в Telegram откроется', 'Túymeni basıń — Telegramda ashıladı'],
    ['ochiladi. Unda «Start» tugmasini bosing va shu sahifaga qayting. Tasdiq xabari shu botdan keladi.', 'откройте «Start» и вернитесь на эту страницу. Подтверждение придёт от этого бота.', '«Start» túymesin basıp, sol betke qaytıń. Tasdıq xabarı sol bottan keledi.'],
    ['Bot username hali sozlanmagan. Keyinroq urinib ko‘ring.', 'Имя бота ещё не настроено. Попробуйте позже.', 'Bot atı ele sazlanbaǵan. Keyinirek qarań.'],
    ['Zaxira usul: Telegram Login Widget. Bu usulda tasdiq xabari Telegram xizmat akkauntidan keladi.', 'Запасной способ: Telegram Login Widget. Подтверждение придёт от служебного аккаунта Telegram.', 'Zapastı usıl: Telegram Login Widget. Bul usılda tasdıq xabarı Telegram xızmet akkauntınan keledi.'],
    ['Havola tayyorlanmoqda...', 'Готовится ссылка...', 'Silteme tayarlanıwatır...'],
    ['Havola yaratilmadi. Keyinroq urinib ko‘ring.', 'Не удалось создать ссылку. Попробуйте позже.', 'Silteme jaratılmadı. Keyinirek qarań.'],
    ['Telegramda «Start» tugmasini bosing. Tasdiqlangach bu sahifa o‘zi yangilanadi.', 'Нажмите «Start» в Telegram. После подтверждения эта страница обновится автоматически.', 'Telegramda «Start» túymesin basıń. Tasdıqlanǵannan keyin bet ózi jańalanadı.'],
    ['Server bilan aloqa yo‘q. Qaytadan urinib ko‘ring.', 'Нет связи с сервером. Попробуйте ещё раз.', 'Server menen baylanıw joq. Qayta qarań.'],
    ['Bu havola allaqachon ishlatilgan. Qaytadan urinib ko‘ring.', 'Эта ссылка уже использована. Попробуйте ещё раз.', 'Bul silteme burın isletilgen. Qayta qarań.'],
    ['Bu havola allaqachon ishlatilgan — ehtimol siz boshqa oynada kirdingiz. «Telegram botda tasdiqlash» tugmasini qaytadan bosing.', 'Эта ссылка уже использована — возможно, вы вошли в другом окне. Нажмите «Подтвердить через Telegram-бот» ещё раз.', 'Bul silteme burın isletilgen — bálkim siz basqa aynada kirgensingiz. «Telegram bot arqalı tasdiqlaw» túymesin qayta basıń.'],
    ['Havola eskirgan', 'Ссылка устарела', 'Silteme eskirgen'],
    ['Havola eskirgan. «Telegram botda tasdiqlash» tugmasini qaytadan bosing.', 'Ссылка устарела. Нажмите «Подтвердить через Telegram-бот» снова.', 'Silteme eskirgen. «Telegram bot arqalı tasdiqlaw» túymesin qayta basıń.'],
    ['Vaqt tugadi. Qaytadan urinib ko‘ring.', 'Время истекло. Попробуйте ещё раз.', 'Waǵıt tawısıldı. Qayta qarań.'],
    ['Telegram tasdiqlanishi tekshirilmoqda...', 'Проверяется подтверждение Telegram...', 'Telegram tasdıqlanıwı tekseriliwatır...'],

    // Qo'shimcha xabarlar va yangilangan FAQ
    ['PDF kutubxonasi yuklanmadi. Internetni tekshiring.', 'Библиотека PDF не загрузилась. Проверьте интернет.', 'PDF kitapxanası júklenbedi. Internetti tekseriń.'],
    ['Maktab raqami faqat raqamlardan iborat bo\'lishi kerak', 'Номер школы должен содержать только цифры', 'Mektep nomeri tek sanlardan turıwı kerek'],
    ['Avval o\'quvchilarni kiriting yoki Excel fayl yuklang', 'Сначала введите учеников или загрузите Excel-файл', 'Dáslep oqıwshılardı kirgiziń yaki Excel faylın júkleń'],
    ['CHSB hisobot bo\'limi tez orada ishga tushiriladi.', 'Раздел отчёта CHSB скоро будет доступен.', 'CHSB hisobatı bólimi tez arada isleydi.'],
    ['Hisobotlarni hisoblash brauzerda ishlaydi, lekin tayyor faylni yuklab olish va hisobingizni saqlash uchun Telegram orqali kirish kerak. Kirish bilan 3 ta bepul kredit beriladi.', 'Отчёты рассчитываются в браузере, но для скачивания готового файла и сохранения аккаунта требуется вход через Telegram. При входе даётся 3 бесплатных отчёта.', 'Hisobatlar brauzerde esaplanadı, biraq tayın fayldı júklep alıw hám akkauntıńızdı saqlaw ushın Telegram arqalı kiriw kerek. Kirgende 3 tegin hisobat beriledi.'],

    // <b> ichida bo'lingan matn va kichik yorliqlar
    ['Sinf harfi', 'Буква класса', 'Klas harpi'],
    ['Menyuni ochish', 'Открыть меню', 'Meniwdi ashıw'],
    ['Asosiy menyu', 'Главное меню', 'Bas menu'],
    ['Muallif:', 'Автор:', 'Avtor:'],
    ['Telegram profilim', 'Мой профиль Telegram', 'Telegram profilim'],
    ['Tepaga qaytish', 'Наверх', 'Joqarıǵa qaytıw'],
    ['Ustunni o\'chirish uchun bosing', 'Нажмите, чтобы удалить столбец', 'Baǵandı óshiriw ushın basıń'],
    ['BSB · CHSB · LI · Kuratorlik · Choraklik hisobotlari', 'Отчёты BSB · CHSB · LI · кураторский · четвертной', 'BSB · CHSB · LI · kuratorlıq · sherek hisobatları']
  ];

  var DICT = {uz: Object.create(null), ru: Object.create(null), kk: Object.create(null)};
  PAIRS.forEach(function (p) {
    var k = norm(p[0]);
    if (!k) return;
    DICT.uz[k] = p[0];
    DICT.ru[k] = p[1] || p[0];
    DICT.kk[k] = p[2] || p[0];
  });

  // Dinamik iboralar uchun qoidalar: [regex, ruscha shablon, qoraqalpoqcha shablon]
  var PATTERNS = [
    [/^(\d+) ta o'?quvchi yuklandi(?: \((.+)\))?$/, function (m) { return m[1] + ' учеников загружено' + (m[2] ? ' (' + m[2] + ')' : ''); }, function (m) { return m[1] + ' оқыўшы жүкленди' + (m[2] ? ' (' + m[2] + ')' : ''); }],
    [/^(\d+) ta o'?quvchi yuklandi$/, function (m) { return m[1] + ' учеников загружено'; }, function (m) { return m[1] + ' оқыўшы жүкленди'; }],
    [/^(\d+) nafar$/, function (m) { return m[1] + ' чел.'; }, function (m) { return m[1] + ' адам'; }],
    [/^(\d+) ta$/, function (m) { return m[1] + ' шт.'; }, function (m) { return m[1] + ' дана'; }],
    [/^«(.+)» o'?quvchisini ro'?yxatdan o'?chirishni tasdiqlaysizmi\?$/, function (m) { return 'Подтвердите удаление ученика «' + m[1] + '» из списка?'; }, function (m) { return '«' + m[1] + '» оқыўшыны дизимнен өшириўди тастықлайсызба?'; }],
    [/^«(.+)» ustunini jadvaldan o'?chirishni tasdiqlaysizmi\?$/, function (m) { return 'Подтвердите удаление столбца «' + m[1] + '» из таблицы?'; }, function (m) { return '«' + m[1] + '» бағанын кестеден өшириўди тастықлайсызба?'; }],
    [/^(.+)-o'?quvchi$/, function (m) { return m[1] + '-ученик'; }, function (m) { return m[1] + '-оқыўшы'; }],
    [/^Baho noto'?g'?ri! (\d+)-savol mezoni: (.+)$/, function (m) { return 'Неверная оценка! Критерий вопроса ' + m[1] + ': ' + m[2]; }, function (m) { return 'Баҳа надурыс! ' + m[1] + '-сораў өлшеми: ' + m[2]; }],
    [/^Diqqat: (\d+) ta baho mezondan yuqori!$/, function (m) { return 'Внимание: ' + m[1] + ' оценок превышают критерий!'; }, function (m) { return 'Диққат: ' + m[1] + ' баҳа өлшемнен артық!'; }],
    [/^Maydonlarni to'?ldiring: (.+)$/, function (m) { return 'Заполните поля: ' + m[1]; }, function (m) { return 'Қатарларды толтырың: ' + m[1]; }],
    [/^Avval «Ma'?lumotlarim» bo'?limini to'?ldiring: (.+)$/, function (m) { return 'Сначала заполните раздел «Мои данные»: ' + m[1]; }, function (m) { return 'Дәслеп «Мағлыўматларым» бөлимин толтырың: ' + m[1]; }],
    [/^BSB hisoboti boshida maydonlarni to'?ldiring: (.+)$/, function (m) { return 'Заполните поля в начале отчёта BSB: ' + m[1]; }, function (m) { return 'BSB ҳисобатының басындағы қатарларды толтырың: ' + m[1]; }],
    [/^Baho chegaralari tuzatildi: (.+)$/, function (m) { return 'Границы оценок исправлены: ' + m[1]; }, function (m) { return 'Баҳа шегаралары түзетилди: ' + m[1]; }],
    [/^Chegaralar tuzatildi: (.+)$/, function (m) { return 'Границы исправлены: ' + m[1]; }, function (m) { return 'Шегаралар түзетилди: ' + m[1]; }],
    [/^Baho chegaralari: (.+)$/, function (m) { return 'Границы оценок: ' + m[1]; }, function (m) { return 'Баҳа шегаралары: ' + m[1]; }],
    [/^(.+) yuklab olindi$/, function (m) { return m[1] + ' скачано'; }, function (m) { return m[1] + ' жүклеп алынды'; }],
    [/^(.+) · Telegram botga ham yuborildi$/, function (m) { return m[1] + ' · также отправлено через Telegram-бота'; }, function (m) { return m[1] + ' · Telegram боты арқалы да жиберилди'; }],
    [/^Faylni o'?qib bo'?lmadi: (.+)$/, function (m) { return 'Не удалось прочитать файл: ' + m[1]; }, function (m) { return 'Файлды оқып болмады: ' + m[1]; }],
    [/^Excel tayyorlashda xato: (.+)$/, function (m) { return 'Ошибка при подготовке Excel: ' + m[1]; }, function (m) { return 'Excel тайынлаўда қателик: ' + m[1]; }],
    [/^PDF tayyorlashda xato: (.+)$/, function (m) { return 'Ошибка при подготовке PDF: ' + m[1]; }, function (m) { return 'PDF тайынлаўда қателик: ' + m[1]; }],
    [/^Kirish amalga oshmadi: (.+)$/, function (m) { return 'Вход не выполнен: ' + m[1]; }, function (m) { return 'Кириў әмелге аспады: ' + m[1]; }],
    [/^Kirish xatosi: (.+)$/, function (m) { return 'Ошибка входа: ' + m[1]; }, function (m) { return 'Кириў қатеси: ' + m[1]; }],
    [/^Yuklab bo'?lmadi: (.+)$/, function (m) { return 'Не удалось скачать: ' + m[1]; }, function (m) { return 'Жүклеп болмады: ' + m[1]; }],
    [/^Til o'?zgartirildi: (.+)$/, function (m) { return 'Язык изменён: ' + m[1]; }, function (m) { return 'Тил өзгертти: ' + m[1]; }]
  ];

  var lang = 'uz';
  try { lang = localStorage.getItem('mh_lang') || 'uz'; } catch (e) {}
  if (!DICT[lang]) lang = 'uz';

  function translate(text) {
    var s = String(text == null ? '' : text);
    if (!s || lang === 'uz') return s;
    var n = norm(s);
    if (!n) return s;
    var lead = (s.match(/^\s*/) || [''])[0], trail = (s.match(/\s*$/) || [''])[0];
    var hit = DICT[lang][n];
    if (hit != null) return lead + hit + trail;
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = n.match(PATTERNS[i][0]);
      if (m) return lead + (lang === 'ru' ? PATTERNS[i][1](m) : PATTERNS[i][2](m)) + trail;
    }
    return s;
  }

  // --- DOM ni tarjima qilish -------------------------------------------------
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var origText = new WeakMap();     // text node -> asl (kiritilgan) matn
  var lastOut = new WeakMap();      // text node -> oxirgi tarjima natijasi
  var origAttr = new WeakMap();     // element -> {attr: asl matn}
  var known = new WeakSet();        // biz o'zgartirgan node'lar (loop oldini olish)
  var knownEl = new WeakSet();
  var applying = false;

  function setText(node, raw) {
    var out = translate(raw);
    if (!origText.has(node)) origText.set(node, raw);
    lastOut.set(node, out);
    known.add(node);
    if (node.nodeValue !== out) node.nodeValue = out;
  }

  function translateNode(node) {
    if (!node || node.nodeType !== 3) return;
    var raw = node.nodeValue;
    if (!raw || !/\S/.test(raw)) return;
    // O'zimiz yozgan tarjima bo'lsa — qayta ishlamaymiz
    if (known.has(node) && raw === lastOut.get(node)) return;
    // JS tomonidan yangilangan bo'lsa, yangi matnni asl deb qabul qilamiz
    if (known.has(node)) origText.set(node, raw);
    setText(node, raw);
  }

  function translateAttrs(el) {
    if (!el || el.nodeType !== 1) return;
    var map = origAttr.get(el) || {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var raw = el.getAttribute(a);
      if (!norm(raw)) continue;
      // O'zimiz yozgan tarjima bo'lsa — o'tkazamiz
      if (knownEl.has(el) && map[a] != null && raw === translate(map[a])) continue;
      var out = translate(raw);
      if (out === raw) continue;
      if (!(a in map)) map[a] = raw;
      origAttr.set(el, map);
      el.setAttribute(a, out);
    }
    knownEl.add(el);
  }

  function walk(root) {
    if (!root) return;
    // O'zbekcha — asl til: tarjima qilish shart emas. Bu tekshiruv jadval
    // qayta chizilganda butun DOMni aylanishning oldini oladi (mobil tezlik).
    if (lang === 'uz') return;
    if (root.nodeType === 3) { translateNode(root); return; }
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    // Dastlabki skanerlashda tugunlar "known" bo'lib qolmasligi uchun faqat observer'da belgilaymiz
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateNode(node);
      else translateAttrs(node);
    }
  }

  function restoreAndApply() {
    applying = true;
    try {
      // Avvalgi tarjimalarni asl holatga qaytaramiz
      document.querySelectorAll('*').forEach(function (el) {
        var map = origAttr.get(el);
        if (!map) return;
        Object.keys(map).forEach(function (a) { el.setAttribute(a, map[a]); });
      });
      var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var t;
      while ((t = tw.nextNode())) {
        if (origText.has(t)) t.nodeValue = origText.get(t);
      }
      known = new WeakSet();
      knownEl = new WeakSet();
      walk(document.body);
    } finally {
      applying = false;
    }
  }

  function setLang(next) {
    if (!DICT[next]) return;
    lang = next;
    try { localStorage.setItem('mh_lang', lang); } catch (e) {}
    try { document.documentElement.setAttribute('lang', lang === 'kk' ? 'kaa' : lang); } catch (e) {}
    document.querySelectorAll('[data-lang-code]').forEach(function (b) {
      var on = b.getAttribute('data-lang-code') === lang;
      b.classList.toggle('font-semibold', on);
      b.classList.toggle('bg-blue-50/50', on);
      b.classList.toggle('text-[#0072bc]', on);
      b.classList.toggle('text-gray-600', !on);
    });
    restoreAndApply();
    try { window.dispatchEvent(new CustomEvent('mh:lang', {detail: {lang: lang}})); } catch (e) {}
  }

  function init() {
    try { document.documentElement.setAttribute('lang', lang === 'kk' ? 'kaa' : lang); } catch (e) {}
    document.querySelectorAll('[data-lang-code]').forEach(function (b) {
      var on = b.getAttribute('data-lang-code') === lang;
      b.classList.toggle('font-semibold', on);
      b.classList.toggle('bg-blue-50/50', on);
      b.classList.toggle('text-[#0072bc]', on);
      b.classList.toggle('text-gray-600', !on);
    });
    walk(document.body);
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(function (records) {
        if (applying) return;
        records.forEach(function (r) {
          if (r.type === 'childList') {
            r.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) walk(n); });
          } else if (r.type === 'characterData') {
            translateNode(r.target);
          }
        });
      });
      mo.observe(document.body, {childList: true, subtree: true, characterData: true});
    }
  }

  window.MH_I18N = {
    t: translate,
    getLang: function () { return lang; },
    setLang: setLang,
    has: function (s) { return DICT[lang][norm(s)] != null; }
  };
  window.MH_T = translate;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
