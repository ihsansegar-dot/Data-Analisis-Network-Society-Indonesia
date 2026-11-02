// Menghitung metrik dengan src/core.js untuk data uji (tests/out/sample.csv).
const fs = require('fs'), path = require('path');
global.SENT = require('../src/sentiment.js');
const S = require('../src/core.js');
const csv = path.join(__dirname, 'out', 'sample.csv');
if (!fs.existsSync(csv)) require('child_process').execSync('python3 ' + path.join(__dirname, 'gen_data.py'), { cwd: path.join(__dirname, '..') });
const { records } = S.toRecords(S.parseCSV(fs.readFileSync(csv, 'utf8')));
const out = {};
for (const ty of ['retweet', 'reply']) { const g = S.buildGraph(records, ty); out[ty] = { labels: g.labels, m: S.analyze(g, { seed: 42 }) }; }
fs.writeFileSync(path.join(__dirname, 'out', 'metrics.json'), JSON.stringify(out));
console.log('metrics.json ditulis');
