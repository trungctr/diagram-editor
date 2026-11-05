/* =========================================================================
 * Thư viện hình chuẩn: Basic/Whiteboard, Flowchart, BPMN 2.0, UML, ERD
 * và các kiểu đường nối (connector) chuẩn.
 *
 * Mỗi định nghĩa hình (shape definition):
 *   type        : mã loại, dùng trong JSON (node.type)
 *   cat, name   : nhóm & tên hiển thị trong thư viện
 *   w, h, text  : kích thước & nội dung mặc định
 *   style       : style mặc định (ghi đè DE.DEFAULT_STYLE)
 *   render(n, s, a)  -> chuỗi SVG trong toạ độ cục bộ (0..w, 0..h)
 *                       s = style đã merge, a(o) = chuỗi thuộc tính fill/stroke
 *   textBox(n)  -> vùng đặt chữ {x,y,w,h,align,valign}
 *   renderText(n,s) -> tự vẽ chữ (tuỳ chọn)
 *   customText  : true nếu render() đã tự vẽ chữ
 *   ports(n)    -> điểm nối {top,right,bottom,left} (toạ độ cục bộ)
 *   container   : hình chứa (pool, lane, package...) – luôn nằm phía sau
 *   hollow      : rỗng – chỉ chọn được khi bấm vào viền/tiêu đề
 *   lineAnchor  : 'center' | 'side' – điểm nối tự do theo trục dọc (sequence)
 *   keepAspect  : giữ tỉ lệ khi resize
 * ========================================================================= */
(function (DE) {
  'use strict';
  const S = {};
  const CATS = [];
  const f = DE.f;
  const esc = DE.esc;

  function cat(id, name) {
    CATS.push({ id, name });
  }
  function def(type, o) {
    S[type] = Object.assign({ type, w: 120, h: 60, text: '' }, o);
  }

  // ------------------------------------------------------------- primitives
  const rect = (w, h, a, rx = 0, x = 0, y = 0) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${a}/>`;
  const poly = (pts, a) => `<polygon points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}" ${a}/>`;
  const path = (d, a) => `<path d="${d}" ${a}/>`;
  const ell = (cx, cy, rx, ry, a) =>
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(Math.max(0, rx))}" ry="${f(Math.max(0, ry))}" ${a}/>`;
  const sc = (s) => esc(s.stroke);
  const ln = (x1, y1, x2, y2, s, sw, extra = '') =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${sc(s)}" stroke-width="${sw ?? s.strokeWidth}" stroke-linecap="round"${extra}/>`;
  const below = (n) => ({ x: -50, y: n.h + 4, w: n.w + 100, h: 36, valign: 'top' });
  const inset = (l, t, r, b) => (n) => ({ x: l, y: t, w: n.w - l - r, h: n.h - t - b });
  const C = (n) => ({ cx: n.w / 2, cy: n.h / 2, r: Math.min(n.w, n.h) / 2 });
  const diamond = (n, a) => poly([[n.w / 2, 0], [n.w, n.h / 2], [n.w / 2, n.h], [0, n.h / 2]], a());
  const ellipseFull = (n, s, a) => ell(n.w / 2, n.h / 2, n.w / 2, n.h / 2, a());
  const docPath = (x, y, w, h) =>
    `M${f(x)},${f(y)} H${f(x + w)} V${f(y + h * 0.85)} Q${f(x + w * 0.75)},${f(y + h * 0.7)} ${f(x + w / 2)},${f(y + h * 0.85)} T${f(x)},${f(y + h * 0.85)} Z`;

  function cylinder(n, a) {
    const w = n.w, h = n.h;
    const ry = Math.min(h * 0.15, w * 0.25, 16);
    return (
      path(`M0,${f(ry)} A${f(w / 2)},${f(ry)} 0 0 1 ${f(w)},${f(ry)} V${f(h - ry)} A${f(w / 2)},${f(ry)} 0 0 1 0,${f(h - ry)} Z`, a()) +
      path(`M0,${f(ry)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(w)},${f(ry)}`, a({ fill: 'none' }))
    );
  }
  const cylRy = (n) => Math.min(n.h * 0.15, n.w * 0.25, 16);

  /** Hình người (actor) */
  function stick(w, h, s, a) {
    const cx = w / 2;
    const hr = Math.min(w * 0.22, h * 0.12);
    const neck = hr * 2 + 1, hip = h * 0.62, arm = h * 0.36;
    return (
      ell(cx, hr + 1, hr, hr, a()) +
      ln(cx, neck, cx, hip, s) +
      ln(w * 0.05, arm, w * 0.95, arm, s) +
      ln(cx, hip, w * 0.12, h, s) +
      ln(cx, hip, w * 0.88, h, s)
    );
  }

  /** Hình có nhiều ngăn (UML class, state, ERD table). Ngăn cách bằng dòng "--" */
  function compartments(n, s, a, o = {}) {
    const parts = [[]];
    String(n.text ?? '')
      .split('\n')
      .forEach((l) => {
        if (/^\s*-{2,}\s*$/.test(l)) parts.push([]);
        else parts[parts.length - 1].push(l);
      });
    const fs = +s.fontSize || 14, lh = fs * 1.3, pad = 5, w = n.w;
    let body = rect(w, n.h, a(), o.rx || 0);
    let txt = '';
    let y = pad;
    if (parts.length === 1) {
      // không có ngăn con -> căn giữa phần tên theo chiều dọc
      const lines = (o.stereo ? 1 : 0) + parts[0].flatMap((l) => DE.wrap(l, w - 12, fs, 'bold', o.italic)).length;
      y = Math.max(pad, (n.h - lines * lh) / 2);
    }
    if (o.stereo) {
      txt += DE.textAt(`«${o.stereo}»`, w / 2, y + lh / 2, s, 'middle', { size: fs * 0.85 });
      y += lh;
    }
    const nameLines = parts[0].flatMap((l) => DE.wrap(l, w - 12, fs, 'bold', o.italic));
    nameLines.forEach((l) => {
      txt += DE.textAt(l, w / 2, y + lh / 2, s, 'middle', { weight: 'bold', italic: o.italic, underline: o.underline });
      y += lh;
    });
    y += pad;
    if (o.headerFill) body += rect(w, Math.min(y, n.h), `fill="${sc(s)}" fill-opacity="0.12" stroke="none"`);
    for (let i = 1; i < parts.length; i++) {
      if (y >= n.h - 2) break;
      body += ln(0, y, w, y, s, Math.min(1.2, +s.strokeWidth || 1));
      y += pad;
      const ls = parts[i].flatMap((l) => DE.wrap(l, w - 16, fs));
      ls.forEach((l) => {
        if (y + lh <= n.h + 2) txt += DE.textAt(l, 8, y + lh / 2, s, 'start');
        y += lh;
      });
      if (!ls.length) y += lh * 0.5;
      y += pad;
    }
    return body + txt;
  }
  const fullEditBox = (n) => ({ x: 0, y: 0, w: n.w, h: n.h, align: 'left' });

  // ======================================================= BASIC / WHITEBOARD
  cat('common', 'Chung – ghi chú & khung');
  cat('basic', 'Hình cơ bản');
  const B = { cat: 'common' };
  const BG = { cat: 'basic' };
  def('basic.sticky', {
    ...B, name: 'Sticky note', w: 160, h: 140, text: 'Ghi chú…',
    style: { fill: '#fef08a', stroke: '#eab308', strokeWidth: 1 },
    render: (n, s, a) => {
      const c = Math.min(18, n.w * 0.15, n.h * 0.15);
      return (
        path(`M0,0 H${f(n.w)} V${f(n.h - c)} L${f(n.w - c)},${f(n.h)} H0 Z`, a() + ' filter="url(#de-shadow)"') +
        path(`M${f(n.w - c)},${f(n.h)} V${f(n.h - c)} H${f(n.w)}`, a({ fill: 'rgba(0,0,0,0.08)' }))
      );
    },
    textBox: inset(10, 10, 10, 10),
  });
  def('basic.text', { ...B, name: 'Văn bản', w: 160, h: 40, thumb: true, text: 'Văn bản', style: { fill: 'none', stroke: 'none' }, render: () => '' });
  def('basic.heading', {
    ...B, name: 'Tiêu đề', w: 200, h: 50, text: 'Tiêu đề', thumb: true, style: { fill: 'none', stroke: 'none', fontSize: 26, fontWeight: 'bold' },
    render: () => '', textBox: (n) => ({ x: 0, y: 0, w: n.w, h: n.h, align: 'left' }),
  });
  def('basic.rect', { ...BG, name: 'Hình chữ nhật', w: 140, h: 80, render: (n, s, a) => rect(n.w, n.h, a()) });
  def('basic.roundrect', { ...BG, name: 'Chữ nhật bo góc', w: 140, h: 80, render: (n, s, a) => rect(n.w, n.h, a(), Math.min(12, n.h / 2, n.w / 2)) });
  def('basic.ellipse', {
    ...BG, name: 'Ellipse', w: 120, h: 80, render: ellipseFull,
    textBox: (n) => ({ x: n.w * 0.15, y: n.h * 0.15, w: n.w * 0.7, h: n.h * 0.7 }),
  });
  def('basic.triangle', {
    ...BG, name: 'Tam giác', w: 120, h: 100,
    render: (n, s, a) => poly([[n.w / 2, 0], [n.w, n.h], [0, n.h]], a()),
    textBox: (n) => ({ x: n.w * 0.2, y: n.h * 0.4, w: n.w * 0.6, h: n.h * 0.55 }),
    ports: (n) => ({ top: { x: n.w / 2, y: 0 }, right: { x: n.w * 0.75, y: n.h / 2 }, bottom: { x: n.w / 2, y: n.h }, left: { x: n.w * 0.25, y: n.h / 2 } }),
  });
  def('basic.cloud', {
    ...B, name: 'Cloud', w: 160, h: 100, text: 'Internet',
    render: (n, s, a) =>
      path(
        'M25,55 C10,55 4,43 14,36 C6,26 18,12 31,18 C36,4 60,2 65,16 C76,6 94,14 89,30 C100,34 98,55 82,55 Z',
        `transform="scale(${f(n.w / 100)},${f(n.h / 60)})" vector-effect="non-scaling-stroke" ` + a()
      ),
    textBox: (n) => ({ x: n.w * 0.2, y: n.h * 0.3, w: n.w * 0.6, h: n.h * 0.6 }),
  });
  def('basic.frame', {
    ...B, name: 'Khung (Frame)', w: 480, h: 320, text: 'Frame', container: true, hollow: true,
    style: { fill: 'none', stroke: '#64748b', fontWeight: 'bold' },
    render: (n, s, a) => {
      const tw = Math.min(n.w, DE.measure(n.text || ' ', s.fontSize, 'bold') + 24);
      const th = Math.min(n.h, s.fontSize + 14);
      return (
        rect(n.w, n.h, a(), 6) +
        path(`M0,6 Q0,0 6,0 H${f(tw)} V${f(th - 6)} Q${f(tw)},${f(th)} ${f(tw - 6)},${f(th)} H0 Z`, `fill="${sc(s)}" fill-opacity="0.12" stroke="none"`)
      );
    },
    textBox: (n) => ({ x: 12, y: 0, w: n.w - 24, h: DE.nodeStyle(n).fontSize + 14, align: 'left' }),
  });

  // ================================================================ FLOWCHART
  cat('flow', 'Flowchart');
  const FL = { cat: 'flow' };
  const skew = (n) => Math.min(n.w * 0.2, n.h * 0.5);
  def('flow.terminator', { ...FL, name: 'Start / End (Terminator)', w: 140, h: 50, text: 'Bắt đầu', render: (n, s, a) => rect(n.w, n.h, a(), Math.min(n.h, n.w) / 2) });
  def('flow.process', { ...FL, name: 'Process', w: 140, h: 70, text: 'Xử lý', render: (n, s, a) => rect(n.w, n.h, a()) });
  def('flow.decision', {
    ...FL, name: 'Decision', w: 140, h: 90, text: 'Điều kiện?', render: (n, s, a) => diamond(n, a),
    textBox: (n) => ({ x: n.w * 0.18, y: n.h * 0.18, w: n.w * 0.64, h: n.h * 0.64 }),
  });
  def('flow.data', {
    ...FL, name: 'Data (Input / Output)', w: 150, h: 70, text: 'Dữ liệu',
    render: (n, s, a) => { const k = skew(n); return poly([[k, 0], [n.w, 0], [n.w - k, n.h], [0, n.h]], a()); },
    textBox: (n) => { const k = skew(n); return { x: k, y: 4, w: n.w - 2 * k, h: n.h - 8 }; },
    ports: (n) => { const k = skew(n); return { top: { x: n.w / 2, y: 0 }, right: { x: n.w - k / 2, y: n.h / 2 }, bottom: { x: n.w / 2, y: n.h }, left: { x: k / 2, y: n.h / 2 } }; },
  });
  def('flow.predefined', {
    ...FL, name: 'Predefined Process', w: 150, h: 70, text: 'Sub-routine',
    render: (n, s, a) => { const k = Math.min(12, n.w * 0.1); return rect(n.w, n.h, a()) + ln(k, 0, k, n.h, s) + ln(n.w - k, 0, n.w - k, n.h, s); },
    textBox: (n) => { const k = Math.min(12, n.w * 0.1); return { x: k + 4, y: 4, w: n.w - 2 * k - 8, h: n.h - 8 }; },
  });
  def('flow.document', {
    ...FL, name: 'Document', w: 140, h: 80, text: 'Tài liệu', render: (n, s, a) => path(docPath(0, 0, n.w, n.h), a()),
    textBox: (n) => ({ x: 6, y: 4, w: n.w - 12, h: n.h * 0.75 }),
    ports: (n) => ({ top: { x: n.w / 2, y: 0 }, right: { x: n.w, y: n.h * 0.42 }, bottom: { x: n.w / 2, y: n.h * 0.85 }, left: { x: 0, y: n.h * 0.42 } }),
  });
  def('flow.multiDocument', {
    ...FL, name: 'Multi-Document', w: 150, h: 90, text: 'Tài liệu',
    render: (n, s, a) => {
      const o = Math.min(8, n.w * 0.06, n.h * 0.08), w = n.w - 2 * o, h = n.h - 2 * o;
      return path(docPath(2 * o, 0, w, h), a()) + path(docPath(o, o, w, h), a()) + path(docPath(0, 2 * o, w, h), a());
    },
    textBox: (n) => { const o = Math.min(8, n.w * 0.06, n.h * 0.08); return { x: 6, y: 2 * o + 4, w: n.w - 2 * o - 12, h: (n.h - 2 * o) * 0.75 }; },
  });
  def('flow.manualInput', {
    ...FL, name: 'Manual Input', w: 140, h: 70, text: 'Nhập liệu',
    render: (n, s, a) => poly([[0, n.h * 0.3], [n.w, 0], [n.w, n.h], [0, n.h]], a()),
    textBox: (n) => ({ x: 6, y: n.h * 0.3, w: n.w - 12, h: n.h * 0.7 - 4 }),
  });
  def('flow.manualOperation', {
    ...FL, name: 'Manual Operation', w: 150, h: 70, text: 'Thao tác tay',
    render: (n, s, a) => { const k = n.w * 0.15; return poly([[0, 0], [n.w, 0], [n.w - k, n.h], [k, n.h]], a()); },
    textBox: (n) => ({ x: n.w * 0.15, y: 4, w: n.w * 0.7, h: n.h - 8 }),
    ports: (n) => ({ top: { x: n.w / 2, y: 0 }, right: { x: n.w * 0.925, y: n.h / 2 }, bottom: { x: n.w / 2, y: n.h }, left: { x: n.w * 0.075, y: n.h / 2 } }),
  });
  def('flow.preparation', {
    ...FL, name: 'Preparation', w: 150, h: 70, text: 'Chuẩn bị',
    render: (n, s, a) => { const k = Math.min(n.w * 0.2, n.h * 0.5); return poly([[k, 0], [n.w - k, 0], [n.w, n.h / 2], [n.w - k, n.h], [k, n.h], [0, n.h / 2]], a()); },
    textBox: (n) => { const k = Math.min(n.w * 0.2, n.h * 0.5); return { x: k, y: 4, w: n.w - 2 * k, h: n.h - 8 }; },
  });
  def('flow.database', {
    ...FL, name: 'Database', w: 110, h: 90, text: 'Database', render: (n, s, a) => cylinder(n, a),
    textBox: (n) => { const r = cylRy(n); return { x: 6, y: 2 * r + 2, w: n.w - 12, h: n.h - 3 * r - 4 }; },
  });
  def('flow.delay', {
    ...FL, name: 'Delay', w: 130, h: 60, text: 'Chờ',
    render: (n, s, a) => { const r = Math.min(n.h / 2, n.w / 2); return path(`M0,0 H${f(n.w - r)} A${f(r)},${f(n.h / 2)} 0 0 1 ${f(n.w - r)},${f(n.h)} H0 Z`, a()); },
  });
  def('flow.display', {
    ...FL, name: 'Display', w: 150, h: 60, text: 'Hiển thị',
    render: (n, s, a) => {
      const k = Math.min(n.w * 0.15, 24);
      return path(`M0,${f(n.h / 2)} L${f(k)},0 H${f(n.w - k)} Q${f(n.w)},0 ${f(n.w)},${f(n.h / 2)} Q${f(n.w)},${f(n.h)} ${f(n.w - k)},${f(n.h)} H${f(k)} Z`, a());
    },
  });
  def('flow.connector', { ...FL, name: 'Connector (On-page)', w: 50, h: 50, text: 'A', keepAspect: true, render: ellipseFull });
  def('flow.offPage', {
    ...FL, name: 'Off-page Connector', w: 60, h: 70, text: '1',
    render: (n, s, a) => poly([[0, 0], [n.w, 0], [n.w, n.h * 0.6], [n.w / 2, n.h], [0, n.h * 0.6]], a()),
    textBox: (n) => ({ x: 4, y: 4, w: n.w - 8, h: n.h * 0.6 }),
  });
  def('flow.comment', {
    ...FL, name: 'Comment / Annotation', w: 150, h: 60, text: 'Chú thích', style: { fill: 'none' },
    render: (n, s, a) => path(`M16,0 H0 V${f(n.h)} H16`, a({ fill: 'none' })),
    textBox: (n) => ({ x: 8, y: 4, w: n.w - 12, h: n.h - 8, align: 'left' }),
  });

  // =================================================================== BPMN
  cat('bpmn', 'BPMN 2.0');
  const EV = { cat: 'bpmn', w: 40, h: 40, text: '', textBox: below, keepAspect: true, minW: 16, minH: 16 };
  const EV_START = { fill: '#f0fdf4', stroke: '#16a34a' };
  const EV_MID = { fill: '#fffbeb', stroke: '#d97706' };
  const EV_END = { fill: '#fef2f2', stroke: '#dc2626' };

  function evBody(n, a, kind) {
    const cx = n.w / 2, cy = n.h / 2, rx = n.w / 2, ry = n.h / 2;
    if (kind === 'start') return ell(cx, cy, rx, ry, a({ sw: 1.5 }));
    if (kind === 'end') return ell(cx, cy, rx - 1.5, ry - 1.5, a({ sw: 3.5 }));
    return ell(cx, cy, rx, ry, a({ sw: 1.3 })) + ell(cx, cy, rx - 3.5, ry - 3.5, a({ fill: 'none', sw: 1.3 }));
  }
  function envelope(cx, cy, w, h, s, filled) {
    const x = cx - w / 2, y = cy - h / 2;
    const bg = filled ? sc(s) : 'none';
    const fg = filled ? (s.fill === 'none' ? '#ffffff' : esc(s.fill)) : sc(s);
    return (
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${bg}" stroke="${sc(s)}" stroke-width="1.2"/>` +
      `<polyline points="${f(x)},${f(y)} ${f(cx)},${f(cy + h * 0.1)} ${f(x + w)},${f(y)}" fill="none" stroke="${fg}" stroke-width="1.2"/>`
    );
  }
  function clock(cx, cy, r, s) {
    let t = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="#ffffff" stroke="${sc(s)}" stroke-width="1.2"/>`;
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6;
      t += ln(cx + Math.cos(ang) * r * 0.78, cy + Math.sin(ang) * r * 0.78, cx + Math.cos(ang) * r * 0.95, cy + Math.sin(ang) * r * 0.95, s, 0.8);
    }
    return t + ln(cx, cy, cx, cy - r * 0.62, s, 1.2) + ln(cx, cy, cx + r * 0.45, cy - r * 0.1, s, 1.2);
  }
  function errorIcon(cx, cy, r, s, filled) {
    const pts = [[-0.55, 0.55], [-0.25, -0.55], [0.12, 0.15], [0.55, -0.55], [0.25, 0.55], [-0.12, -0.15]].map(([x, y]) => [cx + x * r, cy + y * r]);
    return poly(pts, `fill="${filled ? sc(s) : 'none'}" stroke="${sc(s)}" stroke-width="1.2" stroke-linejoin="round"`);
  }
  const evDef = (type, name, style, kind, icon) =>
    def(type, {
      ...EV, name, style,
      render: (n, s, a) => { const { cx, cy, r } = C(n); return evBody(n, a, kind) + (icon ? icon(cx, cy, r, s) : ''); },
    });
  evDef('bpmn.startEvent', 'Start Event', EV_START, 'start');
  evDef('bpmn.startMessage', 'Message Start Event', EV_START, 'start', (cx, cy, r, s) => envelope(cx, cy, r * 0.95, r * 0.65, s, false));
  evDef('bpmn.startTimer', 'Timer Start Event', EV_START, 'start', (cx, cy, r, s) => clock(cx, cy, r * 0.62, s));
  evDef('bpmn.intermediateEvent', 'Intermediate Event', EV_MID, 'mid');
  evDef('bpmn.intermediateMessage', 'Message Catch Event', EV_MID, 'mid', (cx, cy, r, s) => envelope(cx, cy, r * 0.85, r * 0.58, s, false));
  evDef('bpmn.intermediateThrowMessage', 'Message Throw Event', EV_MID, 'mid', (cx, cy, r, s) => envelope(cx, cy, r * 0.85, r * 0.58, s, true));
  evDef('bpmn.intermediateTimer', 'Timer Event', EV_MID, 'mid', (cx, cy, r, s) => clock(cx, cy, r * 0.55, s));
  evDef('bpmn.endEvent', 'End Event', EV_END, 'end');
  evDef('bpmn.endMessage', 'Message End Event', EV_END, 'end', (cx, cy, r, s) => envelope(cx, cy, r * 0.85, r * 0.58, s, true));
  evDef('bpmn.endError', 'Error End Event', EV_END, 'end', (cx, cy, r, s) => errorIcon(cx, cy, r * 0.6, s, true));
  evDef('bpmn.endTerminate', 'Terminate End Event', EV_END, 'end', (cx, cy, r, s) => ell(cx, cy, r * 0.5, r * 0.5, `fill="${sc(s)}" stroke="none"`));

  const TASK = { cat: 'bpmn', w: 130, h: 70, text: 'Task', style: { fill: '#eff6ff', stroke: '#2563eb' }, minW: 40, minH: 30 };
  const taskRect = (n, a, sw) => rect(n.w, n.h, a(sw ? { sw } : undefined), Math.min(10, n.h / 3));
  const ig = (x, y, inner, s) => `<g transform="translate(${x},${y})" fill="none" stroke="${sc(s)}" stroke-width="1.2">${inner}</g>`;
  const ICON = {
    user: (s) => ig(8, 6, '<circle cx="8" cy="5" r="3.5"/><path d="M1.5,16 Q1.5,9.5 8,9.5 Q14.5,9.5 14.5,16 Z"/>', s),
    service: (s) => ig(8, 6, '<circle cx="8" cy="8" r="5.6" stroke-width="2.8" stroke-dasharray="2.2 2.2"/><circle cx="8" cy="8" r="4.2"/><circle cx="8" cy="8" r="1.8"/>', s),
    script: (s) => ig(8, 5, '<path d="M4,1 H15 Q12,5 14,9 Q16,13 13,17 H2 Q5,13 3,9 Q1,5 4,1 Z"/><path d="M5,5 H12 M5.5,9 H12.5 M5,13 H12"/>', s),
    rule: (s) => ig(8, 7, `<rect width="17" height="12"/><rect width="17" height="3.5" fill="${sc(s)}"/><path d="M0,7.7 H17 M5,3.5 V12"/>`, s),
    manual: (s) => ig(7, 7, '<path d="M1,6 H10 M1,6 V12 H13 M4,9 H14 M4,12 H13 M4,3 H11 Q13,3 13,5"/>', s),
    send: (s) => envelope(16, 13, 16, 11, s, true),
    receive: (s) => envelope(16, 13, 16, 11, s, false),
  };
  const iconBox = inset(8, 14, 8, 6);
  def('bpmn.task', { ...TASK, name: 'Task', render: (n, s, a) => taskRect(n, a) });
  def('bpmn.userTask', { ...TASK, name: 'User Task', text: 'User Task', render: (n, s, a) => taskRect(n, a) + ICON.user(s), textBox: iconBox });
  def('bpmn.serviceTask', { ...TASK, name: 'Service Task', text: 'Service Task', render: (n, s, a) => taskRect(n, a) + ICON.service(s), textBox: iconBox });
  def('bpmn.scriptTask', { ...TASK, name: 'Script Task', text: 'Script Task', render: (n, s, a) => taskRect(n, a) + ICON.script(s), textBox: iconBox });
  def('bpmn.businessRuleTask', { ...TASK, name: 'Business Rule Task', text: 'Business Rule', render: (n, s, a) => taskRect(n, a) + ICON.rule(s), textBox: iconBox });
  def('bpmn.manualTask', { ...TASK, name: 'Manual Task', text: 'Manual Task', render: (n, s, a) => taskRect(n, a) + ICON.manual(s), textBox: iconBox });
  def('bpmn.sendTask', { ...TASK, name: 'Send Task', text: 'Send Task', render: (n, s, a) => taskRect(n, a) + ICON.send(s), textBox: iconBox });
  def('bpmn.receiveTask', { ...TASK, name: 'Receive Task', text: 'Receive Task', render: (n, s, a) => taskRect(n, a) + ICON.receive(s), textBox: iconBox });
  def('bpmn.subProcess', {
    ...TASK, name: 'Sub-Process (thu gọn)', text: 'Sub-Process',
    render: (n, s, a) => {
      const x = n.w / 2 - 7, y = n.h - 17;
      return (
        taskRect(n, a) +
        `<rect x="${f(x)}" y="${f(y)}" width="14" height="14" fill="none" stroke="${sc(s)}" stroke-width="1.2"/>` +
        ln(x + 3, y + 7, x + 11, y + 7, s, 1.2) + ln(x + 7, y + 3, x + 7, y + 11, s, 1.2)
      );
    },
    textBox: inset(8, 6, 8, 20),
  });
  def('bpmn.expandedSubProcess', {
    ...TASK, name: 'Sub-Process (mở rộng)', w: 420, h: 220, text: 'Sub-Process', container: true,
    style: { fill: '#f8fbff', stroke: '#2563eb' },
    render: (n, s, a) => taskRect(n, a), textBox: (n) => ({ x: 10, y: 6, w: n.w - 20, h: 22, align: 'left' }),
  });
  def('bpmn.callActivity', { ...TASK, name: 'Call Activity', text: 'Call Activity', render: (n, s, a) => taskRect(n, a, 3.5) });

  const GW = { cat: 'bpmn', w: 50, h: 50, text: '', textBox: below, keepAspect: true, minW: 20, minH: 20, style: { fill: '#fefce8', stroke: '#ca8a04' } };
  def('bpmn.exclusiveGateway', {
    ...GW, name: 'Exclusive Gateway (XOR)',
    render: (n, s, a) => { const { cx, cy, r } = C(n); const k = r * 0.32; return diamond(n, a) + ln(cx - k, cy - k, cx + k, cy + k, s, 3.2) + ln(cx + k, cy - k, cx - k, cy + k, s, 3.2); },
  });
  def('bpmn.parallelGateway', {
    ...GW, name: 'Parallel Gateway (AND)',
    render: (n, s, a) => { const { cx, cy, r } = C(n); const k = r * 0.45; return diamond(n, a) + ln(cx - k, cy, cx + k, cy, s, 3.2) + ln(cx, cy - k, cx, cy + k, s, 3.2); },
  });
  def('bpmn.inclusiveGateway', {
    ...GW, name: 'Inclusive Gateway (OR)',
    render: (n, s, a) => { const { cx, cy, r } = C(n); return diamond(n, a) + ell(cx, cy, r * 0.4, r * 0.4, `fill="none" stroke="${sc(s)}" stroke-width="2.6"`); },
  });
  def('bpmn.eventGateway', {
    ...GW, name: 'Event-based Gateway',
    render: (n, s, a) => {
      const { cx, cy, r } = C(n);
      const pts = [0, 1, 2, 3, 4].map((i) => { const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [cx + Math.cos(t) * r * 0.24, cy + Math.sin(t) * r * 0.24]; });
      const st = `fill="none" stroke="${sc(s)}" stroke-width="1.1"`;
      return diamond(n, a) + ell(cx, cy, r * 0.5, r * 0.5, st) + ell(cx, cy, r * 0.42, r * 0.42, st) + poly(pts, st);
    },
  });
  def('bpmn.complexGateway', {
    ...GW, name: 'Complex Gateway',
    render: (n, s, a) => {
      const { cx, cy, r } = C(n); const k = r * 0.45, d = k * 0.7;
      return diamond(n, a) + ln(cx - k, cy, cx + k, cy, s, 2.6) + ln(cx, cy - k, cx, cy + k, s, 2.6) + ln(cx - d, cy - d, cx + d, cy + d, s, 2.6) + ln(cx + d, cy - d, cx - d, cy + d, s, 2.6);
    },
  });
  def('bpmn.dataObject', {
    cat: 'bpmn', name: 'Data Object', w: 40, h: 52, text: '', textBox: below, style: { fill: '#ffffff' },
    render: (n, s, a) => {
      const c = Math.min(12, n.w * 0.35, n.h * 0.3);
      return path(`M0,0 H${f(n.w - c)} L${f(n.w)},${f(c)} V${f(n.h)} H0 Z`, a()) + path(`M${f(n.w - c)},0 V${f(c)} H${f(n.w)}`, a({ fill: 'none' }));
    },
  });
  def('bpmn.dataStore', { cat: 'bpmn', name: 'Data Store', w: 60, h: 50, text: '', textBox: below, render: (n, s, a) => cylinder(n, a) });
  def('bpmn.message', {
    cat: 'bpmn', name: 'Message', w: 44, h: 30, text: '', textBox: below,
    render: (n, s, a) => rect(n.w, n.h, a()) + `<polyline points="0,0 ${f(n.w / 2)},${f(n.h * 0.55)} ${f(n.w)},0" fill="none" stroke="${sc(s)}" stroke-width="${s.strokeWidth}"/>`,
  });
  const band = (n) => Math.min(30, n.w * 0.15);
  const vtext = (n, s) => {
    const b = band(n);
    return `<g transform="translate(${f(b / 2)},${f(n.h / 2)}) rotate(-90)">${DE.textBlock(n.text, { x: -n.h / 2 + 6, y: -b / 2, w: n.h - 12, h: b }, s)}</g>`;
  };
  const poolRender = (n, s, a) => {
    const b = band(n);
    return rect(n.w, n.h, a()) + `<rect width="${f(b)}" height="${f(n.h)}" fill="${sc(s)}" fill-opacity="0.07"/>` + ln(b, 0, b, n.h, s);
  };
  const poolEdit = (n) => ({ x: 0, y: 0, w: Math.min(n.w, 220), h: Math.min(n.h, 60) });
  def('bpmn.pool', {
    cat: 'bpmn', name: 'Pool', w: 700, h: 240, text: 'Pool', container: true,
    style: { fill: '#ffffff', stroke: '#334155', fontWeight: 'bold' }, render: poolRender, renderText: vtext, editBox: poolEdit,
  });
  def('bpmn.lane', {
    cat: 'bpmn', name: 'Lane', w: 670, h: 120, text: 'Lane', container: true,
    style: { fill: '#ffffff', stroke: '#64748b' }, render: poolRender, renderText: vtext, editBox: poolEdit,
  });
  def('bpmn.annotation', {
    cat: 'bpmn', name: 'Text Annotation', w: 150, h: 60, text: 'Chú thích', style: { fill: 'none' },
    render: (n, s, a) => path(`M16,0 H0 V${f(n.h)} H16`, a({ fill: 'none' })),
    textBox: (n) => ({ x: 8, y: 4, w: n.w - 12, h: n.h - 8, align: 'left' }),
  });
  def('bpmn.group', {
    cat: 'bpmn', name: 'Group', w: 300, h: 200, text: 'Group', container: true, hollow: true,
    style: { fill: 'none', stroke: '#64748b', dash: 'dashdot' },
    render: (n, s, a) => rect(n.w, n.h, a(), 10), textBox: (n) => ({ x: 0, y: 6, w: n.w, h: 22, valign: 'top' }),
  });

  // ============================================== UML – CLASS / COMPONENT
  cat('uml-class', 'UML – Class / Component / Deployment');
  const UCL = { cat: 'uml-class' };
  const CLS = {
    ...UCL, w: 200, h: 130, customText: true, thumb: true, minW: 60, minH: 30,
    style: { fill: '#f0f9ff', stroke: '#0369a1' }, editBox: fullEditBox,
  };
  def('uml.class', { ...CLS, name: 'Class', text: 'ClassName\n--\n- id: int\n- name: String\n--\n+ getName(): String', render: (n, s, a) => compartments(n, s, a) });
  def('uml.abstractClass', { ...CLS, name: 'Abstract Class', text: 'AbstractClass\n--\n# id: UUID\n--\n+ execute(): void', render: (n, s, a) => compartments(n, s, a, { italic: true }) });
  def('uml.interface', { ...CLS, name: 'Interface', h: 100, text: 'IRepository\n--\n+ findAll(): List\n+ save(e): void', render: (n, s, a) => compartments(n, s, a, { stereo: 'interface' }) });
  def('uml.enum', { ...CLS, name: 'Enumeration', w: 160, h: 120, text: 'Status\n--\nACTIVE\nINACTIVE\nDELETED', render: (n, s, a) => compartments(n, s, a, { stereo: 'enumeration' }) });
  def('uml.object', { ...CLS, name: 'Object (Instance)', w: 180, h: 70, text: 'order1 : Order\n--\nstatus = PAID', render: (n, s, a) => compartments(n, s, a, { underline: true }) });
  const pkgTab = (n, s) => ({
    w: Math.min(n.w * 0.7, Math.max(60, DE.measure(String(n.text || '').split('\n')[0], s.fontSize, s.fontWeight) + 24)),
    h: Math.min(n.h / 3, s.fontSize + 12),
  });
  def('uml.package', {
    ...UCL, name: 'Package', w: 260, h: 170, text: 'com.example', container: true, style: { fill: '#fafaf9', stroke: '#57534e' },
    render: (n, s, a) => { const t = pkgTab(n, s); return rect(t.w, t.h, a()) + rect(n.w, n.h - t.h, a(), 0, 0, t.h); },
    textBox: (n) => { const t = pkgTab(n, DE.nodeStyle(n)); return { x: 6, y: 0, w: t.w - 12, h: t.h }; },
  });
  def('uml.component', {
    ...UCL, name: 'Component', w: 180, h: 80, text: '«component»\nOrderService', style: { fill: '#f0f9ff', stroke: '#0369a1' },
    render: (n, s, a) => {
      const x = n.w - 26, y = 8, fl = s.fill === 'none' ? '#ffffff' : esc(s.fill);
      return (
        rect(n.w, n.h, a()) +
        `<g fill="${fl}" stroke="${sc(s)}" stroke-width="1.1"><rect x="${f(x)}" y="${y}" width="16" height="20"/>` +
        `<rect x="${f(x - 4)}" y="${y + 4}" width="8" height="4"/><rect x="${f(x - 4)}" y="${y + 12}" width="8" height="4"/></g>`
      );
    },
    textBox: inset(8, 6, 32, 6),
  });
  def('uml.providedInterface', {
    ...UCL, name: 'Provided Interface', w: 24, h: 24, text: 'IService', textBox: below, keepAspect: true, render: ellipseFull,
  });
  def('uml.requiredInterface', {
    ...UCL, name: 'Required Interface', w: 24, h: 24, text: 'IService', textBox: below, keepAspect: true, style: { fill: 'none' },
    render: (n, s, a) => path(`M${f(n.w)},0 A${f(n.w / 2)},${f(n.h / 2)} 0 0 0 ${f(n.w)},${f(n.h)}`, a({ fill: 'none' })),
  });
  def('uml.port', {
    ...UCL, name: 'Port', w: 14, h: 14, text: '', keepAspect: true, minW: 8, minH: 8, style: { fill: '#ffffff' },
    render: (n, s, a) => rect(n.w, n.h, a()), textBox: (n) => ({ x: n.w + 3, y: -18, w: 110, h: 16, align: 'left' }),
  });
  const nodeDepth = (n) => Math.min(14, n.w * 0.15, n.h * 0.15);
  def('uml.node', {
    ...UCL, name: 'Node (Deployment)', w: 200, h: 120, text: '«device»\nApp Server', container: true, style: { fill: '#f8fafc', stroke: '#334155' },
    render: (n, s, a) => {
      const d = nodeDepth(n);
      return poly([[0, d], [d, 0], [n.w, 0], [n.w - d, d]], a()) + poly([[n.w - d, d], [n.w, 0], [n.w, n.h - d], [n.w - d, n.h]], a()) + rect(n.w - d, n.h - d, a(), 0, 0, d);
    },
    textBox: (n) => { const d = nodeDepth(n); return { x: 6, y: d + 4, w: n.w - d - 12, h: Math.min(n.h - d - 8, 44), valign: 'top' }; },
  });
  def('uml.artifact', {
    ...UCL, name: 'Artifact', w: 160, h: 70, text: '«artifact»\napp.jar', style: { fill: '#ffffff' },
    render: (n, s, a) => {
      const x = n.w - 22, y = 7;
      return rect(n.w, n.h, a()) + ig(x, y, '<path d="M0,0 H8 L12,4 V16 H0 Z"/><path d="M8,0 V4 H12"/>', s);
    },
    textBox: inset(8, 6, 26, 6),
  });
  def('uml.note', {
    ...UCL, name: 'Note / Comment', w: 170, h: 80, text: 'Ghi chú', style: { fill: '#fefce8', stroke: '#a16207' },
    render: (n, s, a) => {
      const c = Math.min(14, n.w * 0.2, n.h * 0.3);
      return path(`M0,0 H${f(n.w - c)} L${f(n.w)},${f(c)} V${f(n.h)} H0 Z`, a()) + path(`M${f(n.w - c)},0 V${f(c)} H${f(n.w)}`, a({ fill: 'none' }));
    },
    textBox: (n) => ({ x: 8, y: 6, w: n.w - 22, h: n.h - 12, align: 'left' }),
  });

  // ======================================================== UML – USE CASE
  cat('uml-usecase', 'UML – Use Case');
  def('uml.actor', {
    cat: 'uml-usecase', name: 'Actor', w: 40, h: 80, text: 'Actor', textBox: below, minW: 16, minH: 30,
    style: { fill: '#ffffff' }, render: (n, s, a) => stick(n.w, n.h, s, a),
  });
  def('uml.useCase', {
    cat: 'uml-usecase', name: 'Use Case', w: 170, h: 70, text: 'Use case', style: { fill: '#f5f3ff', stroke: '#7c3aed' },
    render: ellipseFull, textBox: (n) => ({ x: n.w * 0.12, y: n.h * 0.12, w: n.w * 0.76, h: n.h * 0.76 }),
  });
  def('uml.systemBoundary', {
    cat: 'uml-usecase', name: 'System Boundary', w: 360, h: 420, text: 'Hệ thống', container: true, hollow: true,
    style: { fill: 'none', stroke: '#475569', fontWeight: 'bold' },
    render: (n, s, a) => rect(n.w, n.h, a()), textBox: (n) => ({ x: 0, y: 8, w: n.w, h: 24, valign: 'top' }),
  });

  // ================================================== UML – ACTIVITY / STATE
  cat('uml-behavior', 'UML – Activity / State');
  const BH = { cat: 'uml-behavior' };
  const DARK = { fill: '#1e293b', stroke: '#1e293b' };
  def('uml.initial', { ...BH, name: 'Initial Node', w: 30, h: 30, keepAspect: true, textBox: below, style: DARK, render: ellipseFull });
  def('uml.final', {
    ...BH, name: 'Activity Final', w: 34, h: 34, keepAspect: true, textBox: below, style: { fill: '#ffffff', stroke: '#1e293b' },
    render: (n, s, a) => ell(n.w / 2, n.h / 2, n.w / 2 - 1, n.h / 2 - 1, a({ sw: 1.5 })) + ell(n.w / 2, n.h / 2, n.w / 2 - 6, n.h / 2 - 6, `fill="${sc(s)}" stroke="none"`),
  });
  def('uml.flowFinal', {
    ...BH, name: 'Flow Final', w: 34, h: 34, keepAspect: true, textBox: below, style: { fill: '#ffffff', stroke: '#1e293b' },
    render: (n, s, a) => { const { cx, cy, r } = C(n); const k = r * 0.7071; return ellipseFull(n, s, a) + ln(cx - k, cy - k, cx + k, cy + k, s) + ln(cx + k, cy - k, cx - k, cy + k, s); },
  });
  def('uml.action', {
    ...BH, name: 'Action / Activity', w: 150, h: 60, text: 'Action', style: { fill: '#ecfdf5', stroke: '#059669' },
    render: (n, s, a) => rect(n.w, n.h, a(), Math.min(n.h / 2, 18)),
  });
  def('uml.state', {
    ...BH, name: 'State', w: 160, h: 90, text: 'State\n--\nentry / init()\ndo / run()', customText: true, thumb: true,
    style: { fill: '#ecfeff', stroke: '#0891b2' }, editBox: fullEditBox, render: (n, s, a) => compartments(n, s, a, { rx: 14 }),
  });
  def('uml.decision', { ...BH, name: 'Decision / Merge', w: 44, h: 44, keepAspect: true, textBox: below, style: { fill: '#ffffff' }, render: (n, s, a) => diamond(n, a) });
  def('uml.forkH', { ...BH, name: 'Fork / Join (ngang)', w: 160, h: 8, minH: 4, style: DARK, textBox: below, render: (n, s, a) => rect(n.w, n.h, a(), 2) });
  def('uml.forkV', {
    ...BH, name: 'Fork / Join (dọc)', w: 8, h: 140, minW: 4, style: DARK, render: (n, s, a) => rect(n.w, n.h, a(), 2),
    textBox: (n) => ({ x: n.w + 4, y: 0, w: 120, h: 24, align: 'left', valign: 'top' }),
  });
  def('uml.signalSend', {
    ...BH, name: 'Send Signal', w: 150, h: 50, text: 'Send signal',
    render: (n, s, a) => { const k = Math.min(18, n.w * 0.2); return poly([[0, 0], [n.w - k, 0], [n.w, n.h / 2], [n.w - k, n.h], [0, n.h]], a()); },
    textBox: (n) => ({ x: 6, y: 4, w: n.w - Math.min(18, n.w * 0.2) - 10, h: n.h - 8 }),
  });
  def('uml.signalReceive', {
    ...BH, name: 'Accept Event', w: 150, h: 50, text: 'Accept event',
    render: (n, s, a) => { const k = Math.min(18, n.w * 0.2); return poly([[0, 0], [n.w, 0], [n.w, n.h], [0, n.h], [k, n.h / 2]], a()); },
    textBox: (n) => { const k = Math.min(18, n.w * 0.2); return { x: k + 4, y: 4, w: n.w - k - 10, h: n.h - 8 }; },
  });
  def('uml.timeEvent', {
    ...BH, name: 'Time Event', w: 30, h: 40, textBox: below, style: { fill: '#ffffff' },
    render: (n, s, a) => poly([[0, 0], [n.w, 0], [0, n.h], [n.w, n.h]], a()),
  });

  def('uml.partition', {
    ...BH, name: 'Activity Partition (swimlane)', w: 240, h: 520, text: 'Partition', container: true,
    style: { fill: '#ffffff', stroke: '#64748b', fontWeight: 'bold' },
    render: (n, s, a) => { const hh = Math.min(30, n.h); return rect(n.w, n.h, a()) + `<rect width="${f(n.w)}" height="${f(hh)}" fill="${sc(s)}" fill-opacity="0.07"/>` + ln(0, hh, n.w, hh, s); },
    textBox: (n) => ({ x: 4, y: 0, w: n.w - 8, h: Math.min(30, n.h) }),
  });
  def('uml.objectNode', { ...BH, name: 'Object Node', w: 130, h: 50, text: ':Order\n[đã thanh toán]', style: { fill: '#ffffff' }, render: (n, s, a) => rect(n.w, n.h, a()) });
  def('uml.history', {
    ...BH, name: 'History (H)', w: 30, h: 30, keepAspect: true, textBox: below, style: { fill: '#ffffff', stroke: '#1e293b' },
    render: (n, s, a) => ellipseFull(n, s, a) + DE.textAt('H', n.w / 2, n.h / 2, { ...s, fontSize: Math.min(n.w, n.h) * 0.5 }, 'middle', { weight: 'bold' }),
  });

  // ======================================================== UML – SEQUENCE
  cat('uml-seq', 'UML – Sequence');
  const HH = (n) => Math.min(40, n.h);
  const dashLine = ' stroke-dasharray="6 5"';
  def('uml.lifeline', {
    cat: 'uml-seq', name: 'Lifeline', w: 120, h: 360, text: ':Object', lineAnchor: 'center', minH: 60, minW: 40,
    style: { fill: '#f8fafc', stroke: '#334155' },
    render: (n, s, a) => ln(n.w / 2, HH(n), n.w / 2, n.h, s, 1.2, dashLine) + rect(n.w, HH(n), a()),
    hit: (n) =>
      `<rect class="hit" width="${f(n.w)}" height="${f(HH(n))}" fill="transparent"/>` +
      `<rect class="hit" x="${f(n.w / 2 - 8)}" y="${f(HH(n))}" width="16" height="${f(n.h - HH(n))}" fill="transparent"/>`,
    textBox: (n) => ({ x: 4, y: 0, w: n.w - 8, h: HH(n) }),
  });
  def('uml.actorLifeline', {
    cat: 'uml-seq', name: 'Actor Lifeline', w: 100, h: 360, text: 'Actor', lineAnchor: 'center', minH: 100, minW: 40,
    style: { fill: '#ffffff' },
    render: (n, s, a) => `<g transform="translate(${f(n.w / 2 - 15)},0)">${stick(30, 46, s, a)}</g>` + ln(n.w / 2, 70, n.w / 2, n.h, s, 1.2, dashLine),
    hit: (n) =>
      `<rect class="hit" width="${f(n.w)}" height="70" fill="transparent"/>` +
      `<rect class="hit" x="${f(n.w / 2 - 8)}" y="70" width="16" height="${f(Math.max(0, n.h - 70))}" fill="transparent"/>`,
    textBox: (n) => ({ x: -10, y: 48, w: n.w + 20, h: 20 }),
  });
  def('uml.activation', {
    cat: 'uml-seq', name: 'Activation', w: 16, h: 100, lineAnchor: 'side', minW: 6, minH: 10, style: { fill: '#e2e8f0' },
    render: (n, s, a) => rect(n.w, n.h, a()), textBox: (n) => ({ x: n.w + 4, y: 0, w: 120, h: 20, align: 'left', valign: 'top' }),
  });
  const fragTab = (n, s) => {
    const fs = +s.fontSize || 14;
    const lines = String(n.text || '').split('\n');
    const w = Math.min(n.w, Math.max(50, ...lines.map((l) => DE.measure(l, fs, s.fontWeight))) + 24);
    return { w, h: Math.min(n.h, lines.length * fs * 1.25 + 10) };
  };
  def('uml.fragment', {
    cat: 'uml-seq', name: 'Combined Fragment', w: 380, h: 200, text: 'alt [điều kiện]', container: true, hollow: true,
    style: { fill: 'none', stroke: '#475569' },
    render: (n, s, a) => {
      const t = fragTab(n, s);
      return rect(n.w, n.h, a()) + path(`M0,0 H${f(t.w)} V${f(t.h - 7)} L${f(t.w - 8)},${f(t.h)} H0 Z`, a({ fill: '#ffffff', dash: 'solid' }));
    },
    textBox: (n) => { const t = fragTab(n, DE.nodeStyle(n)); return { x: 6, y: 0, w: t.w - 14, h: t.h, align: 'left' }; },
  });

  // ==================================================================== ERD
  cat('erd', 'ERD – Cơ sở dữ liệu');
  const ER = { cat: 'erd', style: { fill: '#ffffff', stroke: '#0f766e' } };
  def('erd.table', {
    ...ER, name: 'Table (bảng)', w: 220, h: 140, customText: true, thumb: true, minW: 80, minH: 30, editBox: fullEditBox,
    text: 'users\n--\nPK id : bigint\nusername : varchar(50)\nemail : varchar(120)\nFK role_id : int',
    render: (n, s, a) => compartments(n, s, a, { headerFill: true }),
  });
  def('erd.entity', { ...ER, name: 'Entity (Chen)', w: 140, h: 60, text: 'Entity', render: (n, s, a) => rect(n.w, n.h, a()) });
  def('erd.weakEntity', { ...ER, name: 'Weak Entity', w: 140, h: 60, text: 'Weak entity', render: (n, s, a) => rect(n.w, n.h, a()) + rect(n.w - 8, n.h - 8, a({ fill: 'none' }), 0, 4, 4) });
  def('erd.relationship', {
    ...ER, name: 'Relationship', w: 130, h: 70, text: 'has', render: (n, s, a) => diamond(n, a),
    textBox: (n) => ({ x: n.w * 0.18, y: n.h * 0.18, w: n.w * 0.64, h: n.h * 0.64 }),
  });
  def('erd.attribute', { ...ER, name: 'Attribute', w: 120, h: 50, text: 'attribute', render: ellipseFull, textBox: inset(10, 4, 10, 4) });
  def('erd.keyAttribute', {
    ...ER, name: 'Key Attribute', w: 120, h: 50, text: 'id', style: { ...ER.style, textDecoration: 'underline' },
    render: ellipseFull, textBox: inset(10, 4, 10, 4),
  });

  // ========================================================== CONNECTORS
  /** Các kiểu đầu mũi tên hỗ trợ */
  DE.ARROWS = [
    ['none', 'Không'], ['arrow', 'Mũi tên đặc'], ['open', 'Mũi tên mở'], ['triangle', 'Tam giác rỗng (kế thừa)'],
    ['diamond', 'Thoi rỗng (aggregation)'], ['diamondFilled', 'Thoi đặc (composition)'], ['circle', 'Tròn rỗng'], ['circleFilled', 'Tròn đặc'], ['slash', 'Gạch chéo (default flow)'],
    ['erOne', 'ER: một (|)'], ['erOnlyOne', 'ER: một và chỉ một (||)'], ['erMany', 'ER: nhiều (crow foot)'],
    ['erOneMany', 'ER: một hoặc nhiều'], ['erZeroOne', 'ER: không hoặc một'], ['erZeroMany', 'ER: không hoặc nhiều'],
  ];

  /** Kiểu đường nối chuẩn – edge.type trong JSON */
  DE.connectors = {
    'flow.arrow': { group: 'Flowchart', name: 'Mũi tên (flow)', routing: 'orthogonal', style: { endArrow: 'arrow' } },
    'flow.line': { group: 'Flowchart', name: 'Đường thẳng', routing: 'straight', style: { endArrow: 'none' } },
    'flow.curve': { group: 'Flowchart', name: 'Đường cong', routing: 'curved', style: { endArrow: 'arrow' } },
    'bpmn.sequenceFlow': { group: 'BPMN', name: 'Sequence Flow', routing: 'orthogonal', style: { endArrow: 'arrow' } },
    'bpmn.defaultFlow': { group: 'BPMN', name: 'Default Flow', routing: 'orthogonal', style: { endArrow: 'arrow', startArrow: 'slash' } },
    'bpmn.messageFlow': { group: 'BPMN', name: 'Message Flow', routing: 'orthogonal', style: { dash: 'dashed', startArrow: 'circle', endArrow: 'triangle' } },
    'bpmn.association': { group: 'BPMN', name: 'Association', routing: 'straight', style: { dash: 'dotted', endArrow: 'none' } },
    'bpmn.dataAssociation': { group: 'BPMN', name: 'Data Association', routing: 'straight', style: { dash: 'dotted', endArrow: 'open' } },
    'uml.association': { group: 'UML', name: 'Association', routing: 'orthogonal', style: { endArrow: 'none' } },
    'uml.directedAssociation': { group: 'UML', name: 'Directed Association', routing: 'orthogonal', style: { endArrow: 'open' } },
    'uml.generalization': { group: 'UML', name: 'Generalization (kế thừa)', routing: 'orthogonal', style: { endArrow: 'triangle' } },
    'uml.realization': { group: 'UML', name: 'Realization (implements)', routing: 'orthogonal', style: { dash: 'dashed', endArrow: 'triangle' } },
    'uml.dependency': { group: 'UML', name: 'Dependency', routing: 'orthogonal', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.import': { group: 'UML', name: 'Import (package)', routing: 'orthogonal', label: '«import»', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.deploy': { group: 'UML', name: 'Deploy', routing: 'orthogonal', label: '«deploy»', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.manifest': { group: 'UML', name: 'Manifest', routing: 'orthogonal', label: '«manifest»', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.aggregation': { group: 'UML', name: 'Aggregation', routing: 'orthogonal', style: { startArrow: 'diamond', endArrow: 'none' } },
    'uml.composition': { group: 'UML', name: 'Composition', routing: 'orthogonal', style: { startArrow: 'diamondFilled', endArrow: 'none' } },
    'uml.include': { group: 'UML', name: 'Include', routing: 'straight', label: '«include»', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.extend': { group: 'UML', name: 'Extend', routing: 'straight', label: '«extend»', style: { dash: 'dashed', endArrow: 'open' } },
    'uml.transition': { group: 'UML', name: 'Transition / Control Flow', routing: 'orthogonal', style: { endArrow: 'open' } },
    'uml.syncMessage': { group: 'UML Sequence', name: 'Sync Message', routing: 'straight', labelAbove: true, style: { endArrow: 'arrow' } },
    'uml.asyncMessage': { group: 'UML Sequence', name: 'Async Message', routing: 'straight', labelAbove: true, style: { endArrow: 'open' } },
    'uml.returnMessage': { group: 'UML Sequence', name: 'Return Message', routing: 'straight', labelAbove: true, style: { dash: 'dashed', endArrow: 'open' } },
    'erd.oneToOne': { group: 'ERD', name: 'Một – Một (1:1)', routing: 'orthogonal', style: { startArrow: 'erOnlyOne', endArrow: 'erOnlyOne' } },
    'erd.oneToMany': { group: 'ERD', name: 'Một – Nhiều (1:N)', routing: 'orthogonal', style: { startArrow: 'erOnlyOne', endArrow: 'erOneMany' } },
    'erd.zeroToMany': { group: 'ERD', name: 'Một – Không/Nhiều (1:0..N)', routing: 'orthogonal', style: { startArrow: 'erOnlyOne', endArrow: 'erZeroMany' } },
  };

  /** 3 chế độ làm việc – mỗi chế độ chỉ hiển thị các nhóm hình / đường nối của mình */
  DE.MODES = {
    flowchart: { name: 'Flowchart', cats: ['flow', 'basic', 'common'], groups: ['Flowchart'], connector: 'flow.arrow' },
    bpmn: { name: 'BPMN', cats: ['bpmn', 'common'], groups: ['BPMN'], connector: 'bpmn.sequenceFlow' },
    uml: { name: 'UML', cats: ['uml-usecase', 'uml-behavior', 'uml-seq', 'uml-class', 'erd', 'common'], groups: ['UML', 'UML Sequence', 'ERD'], connector: 'uml.association' },
  };

  DE.shapes = S;
  DE.shapeCategories = CATS;
  DE.getShape = (t) => S[t] || S['basic.rect'];
})(window.DE);
