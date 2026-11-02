// Menyusun index.html (satu file mandiri) dari src/ + pustaka d3 & jsPDF.
// Pemakaian: npm install && npm run build
const fs = require('fs'), path = require('path');
const rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const lib = (p) => fs.readFileSync(path.join(__dirname, 'node_modules', p), 'utf8');
let html = rd('src/app.html');
const feat = ['feat.js', 'ui2.js', 'ent.js', 'vos.js', 'proj.js', 'kat.js', 'real.js'].map((f) => rd('src/' + f)).join('\n');
// gunakan fungsi pengganti agar karakter "$" di kode tidak ditafsirkan oleh String.replace
html = html
  .replace('/*__FEAT__*/', () => feat)
  .replace('/*__PDF__*/', () => rd('src/pdf2.js'))
  .replace('<!--LIBS-->', () => '<script>' + lib('d3/dist/d3.min.js') + '</script>\n<script>' + lib('jspdf/dist/jspdf.umd.min.js') + '</script>')
  .replace('/*__SENT__*/', () => rd('src/sentiment.js'))
  .replace('/*__CORE__*/', () => rd('src/core.js'))
  // data nyata hanya disisipkan di build pribadi (artifact); repo publik tidak memuat teks berita
  // Data nyata hanya disisipkan di build pribadi (artifact). Repo publik tidak memuat teks berita.
  // REALDATA_JSON=path/ke/realdata.json node build.js  -> menyisipkan window.REALDATA
  .replace('<!--REALDATA-->', () => process.env.REALDATA_JSON
    ? '<script>window.REALDATA=' + fs.readFileSync(process.env.REALDATA_JSON, 'utf8').replace(/<\//g, '<\\/') + ';</script>'
    : '');
const outFile = process.env.OUT_FILE || path.join(__dirname, 'index.html');
fs.writeFileSync(outFile, html);
console.log(outFile + ' ditulis (' + (html.length / 1024).toFixed(0) + ' KB)');
