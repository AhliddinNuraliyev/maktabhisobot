const fs = require('fs');
const src = fs.readFileSync('C:/Users/user/Desktop/HISOBOT/HISOBOT sayt uchun 4.html', 'utf8');
const m = src.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('inline script not found');
let js = m[1];
const reps = [
  ['const $ = id => document.getElementById(id);', "const $ = id => document.getElementById('q_' + id);"],
  ['id="page1"', 'id="q_page1"'],
  ['id="page2"', 'id="q_page2"'],
  ["overlay.className = 'busy';", "overlay.className = 'q-busy';"],
  [
    "    a.click();\n    setTimeout(() => URL.revokeObjectURL(a.href), 4000);",
    "    a.click();\n    if (typeof window.bumpDownload === 'function') window.bumpDownload('xlsx');\n    setTimeout(() => URL.revokeObjectURL(a.href), 4000);"
  ],
  [
    "if (!window.ExcelJS) throw new Error('Excel yozish kutubxonasi yuklanmadi. Internetga ulanib, sahifani qayta oching.');",
    "if (!window.ExcelJS && typeof window.loadExcelJS === 'function') { try { await window.loadExcelJS(); } catch (e) {} }\n    if (!window.ExcelJS) throw new Error('Excel yozish kutubxonasi yuklanmadi. Internetga ulanib, sahifani qayta oching.');"
  ]
];
for (const [a, b] of reps) {
  if (!js.includes(a)) throw new Error('missing replacement target: ' + a);
  js = js.split(a).join(b);
}
const out = "/* Choraklik hisobot: integrated from 'HISOBOT sayt uchun 4.html' */\n" +
  "(function () {\n'use strict';\n" + js + "\n" +
  "window.qPrint = function () {\n" +
  "  document.body.classList.add('q-print');\n" +
  "  try { window.print(); } catch (e) {}\n" +
  "  setTimeout(function () { document.body.classList.remove('q-print'); }, 300);\n" +
  "  window.addEventListener('afterprint', function () { document.body.classList.remove('q-print'); }, { once: true });\n" +
  "};\n" +
  "})();\n";
fs.writeFileSync('C:/Users/user/Downloads/NEW PROJECT/choraklik.js', out);
console.log('choraklik.js bytes:', Buffer.byteLength(out));
