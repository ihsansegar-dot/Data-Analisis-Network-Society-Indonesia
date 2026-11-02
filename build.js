// Menyusun index.html (satu file mandiri) dari src/ + pustaka d3 & jsPDF.
// Pemakaian: npm install && npm run build
const fs = require('fs'), path = require('path');
const rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const lib = (p) => fs.readFileSync(path.join(__dirname, 'node_modules', p), 'utf8');
let html = rd('src/app.html');
const feat = ['feat.js', 'ui2.js', 'ent.js', 'vos.js', 'proj.js'].map((f) => rd('src/' + f)).join('\n');
// gunakan fungsi pengganti agar karakter "$" di kode tidak ditafsirkan oleh String.replace
html = html
  .replace('/*__FEAT__*/', () => feat)
  .replace('/*__PDF__*/', () => rd('src/pdf2.js'))
  .replace('<!--LIBS-->', () => '<script>' + lib('d3/dist/d3.min.js') + '</script>\n<script>' + lib('jspdf/dist/jspdf.umd.min.js') + '</script>')
  .replace('/*__SENT__*/', () => rd('src/sentiment.js'))
  .replace('/*__CORE__*/', () => rd('src/core.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html ditulis (' + (html.length / 1024).toFixed(0) + ' KB)');
