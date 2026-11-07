// Helpers de fidelidade palavra-a-palavra (.md oficial x HTML gerado), usados por guia.test.js e estrategia.test.js.
const BLOCK = 'h[1-6]|p|li|ul|ol|div|section|table|thead|tbody|tr|th|td|blockquote';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function htmlWords(html) {
  return decode(html.replace(new RegExp('</?(?:' + BLOCK + ')\\b[^>]*>', 'g'), ' ').replace(/<[^>]+>/g, '')).split(/\s+/).filter(Boolean);
}

function mdWords(md) {
  const words = [];
  md.split(/\r?\n/).forEach((raw) => {
    if (/^\s*\|[\s|:-]+\|\s*$/.test(raw)) return;
    const isHeading = /^#{1,3}\s/.test(raw);
    let l = raw.replace(/^#{1,3}\s+/, '').replace(/^>\s?/, '');
    if (!isHeading) l = l.replace(/^\s*(?:-|\d+\.)\s+/, '');
    l = l.replace(/\|/g, ' ').replace(/\*/g, '');
    words.push(...l.split(/\s+/).filter(Boolean));
  });
  return words;
}

function mdTables(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\|/.test(lines[i]) && /^\|[\s|:-]+\|\s*$/.test(lines[i + 1] || '')) {
      let j = i + 2;
      while (j < lines.length && /^\|/.test(lines[j])) j++;
      out.push({ cols: lines[i].replace(/^\||\|\s*$/g, '').split('|').length, rows: j - i - 2 });
      i = j;
    }
  }
  return out;
}

const lf = (s) => s.split(String.fromCharCode(13)).join('');

module.exports = { decode, htmlWords, mdWords, mdTables, lf };
