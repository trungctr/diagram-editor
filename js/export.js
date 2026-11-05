/* =========================================================================
 * Xuất SVG / PNG (chỉ là ảnh). Định dạng để lưu & mở lại là JSON.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc, f } = DE;

  DE.exportSVG = function (doc, opt = {}) {
    const pad = opt.padding ?? 24;
    const bg = opt.background ?? '#ffffff';
    const b = DE.docBounds(doc) || { x: 0, y: 0, w: 200, h: 120 };
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    const body = (doc.nodes.map(DE.renderNode).join('') + doc.edges.map((e) => DE.renderEdge(e, nodes)).join(''))
      .replace(/ data-(kind|id)="[^"]*"/g, '')
      .replace(/<(rect|path) class="hit"[^>]*\/>/g, '');
    const x = b.x - pad, y = b.y - pad, w = Math.ceil(b.w + pad * 2), h = Math.ceil(b.h + pad * 2);
    return (
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${f(x)} ${f(y)} ${w} ${h}">` +
      `<title>${esc(doc.meta?.name || 'diagram')}</title><defs>${DE.svgDefs()}</defs>` +
      (bg ? `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${h}" fill="${esc(bg)}"/>` : '') +
      body +
      '</svg>'
    );
  };

  // ------------------------------------------------------- nhúng Markdown
  const b64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  /** SVG tự chứa (không khai báo XML, id duy nhất, co giãn theo khung, 1 dòng) */
  DE.inlineSVG = function (doc) {
    const uid = 'de' + Math.random().toString(36).slice(2, 8);
    const name = esc(doc.meta?.name || 'diagram');
    return DE.exportSVG(doc)
      .replace(/^<\?xml[^>]*\?>\s*/, '')
      .replace(/de-shadow/g, uid + '-shadow')
      .replace('<svg ', `<svg role="img" aria-label="${name}" style="max-width:100%;height:auto" `)
      .replace(/\s*\r?\n\s*/g, ' ');
  };

  DE.svgDataURI = (doc) => 'data:image/svg+xml;base64,' + b64(DE.exportSVG(doc));

  /**
   * Đoạn mã dán thẳng vào Markdown (Promise<string>).
   *  'inline' : <div><svg>…</svg></div> trên MỘT dòng – CommonMark coi là khối HTML (type 6)
   *             cho tới dòng trống, nên không được có dòng trống bên trong.
   *  'png'    : ![tên](data:image/png;base64,…) – cú pháp ảnh Markdown thuần.
   *             (Không dùng data:image/svg+xml vì markdown-it – bộ render của VS Code… – chặn
   *             data URI SVG, chỉ cho phép png/jpeg/gif/webp.)
   */
  DE.markdownEmbed = async function (doc, format = 'inline') {
    if (format === 'png') {
      const alt = String(doc.meta?.name || 'diagram').replace(/[[\]\\\n]/g, ' ');
      // scale 1: ảnh hiển thị đúng kích thước thật (Markdown không có cú pháp đặt width)
      return `![${alt}](${await DE.pngDataURI(doc, 1)})`;
    }
    return `<div>${DE.inlineSVG(doc)}</div>`;
  };

  DE.pngDataURI = (doc, scale = 2) =>
    DE.exportPNG(doc, scale).then(
      (blob) =>
        new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => reject(new Error('Không đọc được PNG'));
          r.readAsDataURL(blob);
        })
    );

  DE.exportPNG = function (doc, scale = 2) {
    return new Promise((resolve, reject) => {
      const svgStr = DE.exportSVG(doc);
      const m = svgStr.match(/width="(\d+)" height="(\d+)"/);
      const w = +m[1], h = +m[2];
      const k = Math.min(scale, 16000 / w, 16000 / h);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(w * k);
        c.height = Math.ceil(h * k);
        const ctx = c.getContext('2d');
        ctx.scale(k, k);
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được PNG'))), 'image/png');
      };
      img.onerror = () => reject(new Error('Không render được SVG thành ảnh'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  };

})(window.DE);
