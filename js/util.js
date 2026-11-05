/* =========================================================================
 * Diagram Editor – tiện ích chung
 * Tất cả module gắn vào namespace toàn cục window.DE (không dùng ES module
 * để có thể mở trực tiếp index.html qua file:// mà không cần web server).
 * ========================================================================= */
window.DE = window.DE || {};

(function (DE) {
  'use strict';

  const FONT = "Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif";
  DE.FONT = FONT;

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape chuỗi để chèn an toàn vào SVG/HTML */
  DE.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  /** Làm tròn 2 chữ số thập phân cho toạ độ SVG gọn hơn */
  DE.f = (v) => Math.round((+v || 0) * 100) / 100;
  DE.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  DE.clone = (o) => JSON.parse(JSON.stringify(o));

  let seq = 0;
  DE.uid = (p = 'id') =>
    p + '_' + (Date.now() % 1e8).toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

  DE.debounce = (fn, ms) => {
    let t = 0;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  DE.download = (filename, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ---------------------------------------------------------------- đo chữ
  const ctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  DE.measure = function (text, size = 14, weight = 'normal', italic = false) {
    const key = size + '|' + weight + '|' + (italic ? 1 : 0) + '|' + text;
    let w = mcache.get(key);
    if (w === undefined) {
      ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
      w = ctx.measureText(text).width;
      if (mcache.size > 8000) mcache.clear();
      mcache.set(key, w);
    }
    return w;
  };

  function wrapParagraph(par, maxW, m) {
    const lines = [];
    let line = '';
    for (const word of par.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (m(test) <= maxW) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (m(word) <= maxW) {
        line = word;
        continue;
      }
      // từ quá dài -> cắt theo ký tự
      let chunk = '';
      for (const ch of word) {
        if (chunk && m(chunk + ch) > maxW) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
    return lines;
  }

  /** Ngắt dòng văn bản theo độ rộng tối đa */
  DE.wrap = function (text, maxW, size = 14, weight = 'normal', italic = false) {
    const out = [];
    const m = (t) => DE.measure(t, size, weight, italic);
    String(text ?? '')
      .split('\n')
      .forEach((par) => {
        if (!(maxW > 4)) out.push(par);
        else out.push(...wrapParagraph(par, maxW, m));
      });
    return out;
  };

  // --------------------------------------------------------- text trong SVG
  /** Một dòng chữ tại (x, y) – y là tâm dòng */
  DE.textAt = function (t, x, y, s, anchor = 'middle', o = {}) {
    const size = o.size || +s.fontSize || 14;
    const weight = o.weight || 'normal';
    return (
      `<text x="${DE.f(x)}" y="${DE.f(y + size * 0.35)}" font-family="${FONT}" font-size="${DE.f(size)}"` +
      ` fill="${DE.esc(s.textColor || '#0f172a')}" text-anchor="${anchor}" xml:space="preserve"` +
      (weight !== 'normal' ? ` font-weight="${weight}"` : '') +
      (o.italic ? ' font-style="italic"' : '') +
      (o.underline ? ' text-decoration="underline"' : '') +
      `>${DE.esc(t)}</text>`
    );
  };

  /** Khối văn bản nhiều dòng, tự ngắt dòng trong box {x,y,w,h,align,valign} */
  DE.textBlock = function (text, box, s) {
    if (text == null || text === '') return '';
    const fs = +s.fontSize || 14;
    const lh = fs * 1.25;
    const weight = s.fontWeight === 'bold' ? 'bold' : 'normal';
    const italic = s.fontStyle === 'italic';
    const lines = DE.wrap(String(text), box.w, fs, weight, italic);
    const total = lines.length * lh;
    const va = box.valign || 'middle';
    const y0 = va === 'top' ? box.y : va === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
    const al = box.align || 'center';
    const x = al === 'left' ? box.x : al === 'right' ? box.x + box.w : box.x + box.w / 2;
    const anchor = al === 'left' ? 'start' : al === 'right' ? 'end' : 'middle';
    let out =
      `<text font-family="${FONT}" font-size="${DE.f(fs)}" fill="${DE.esc(s.textColor || '#0f172a')}"` +
      ` text-anchor="${anchor}" xml:space="preserve"` +
      (weight === 'bold' ? ' font-weight="bold"' : '') +
      (italic ? ' font-style="italic"' : '') +
      (s.textDecoration ? ` text-decoration="${DE.esc(s.textDecoration)}"` : '') +
      '>';
    lines.forEach((l, i) => {
      out += `<tspan x="${DE.f(x)}" y="${DE.f(y0 + i * lh + lh / 2 + fs * 0.35)}">${DE.esc(l)}</tspan>`;
    });
    return out + '</text>';
  };
})(window.DE);
