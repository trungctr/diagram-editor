/* =========================================================================
 * Render: node/edge -> SVG, định tuyến đường nối (orthogonal / straight /
 * curved), đầu mũi tên, tính bounding box.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc, f } = DE;

  DE.DEFAULT_STYLE = {
    fill: '#ffffff', stroke: '#334155', strokeWidth: 1.5, dash: 'solid',
    textColor: '#0f172a', fontSize: 14, fontWeight: 'normal', fontStyle: 'normal',
  };
  DE.EDGE_DEFAULT = {
    stroke: '#475569', strokeWidth: 1.5, dash: 'solid', startArrow: 'none', endArrow: 'arrow',
    fontSize: 12, textColor: '#0f172a',
  };
  DE.DASH = { solid: '', dashed: '8 5', dotted: '2 4', dashdot: '10 4 2 4' };

  DE.nodeStyle = (n) => Object.assign({}, DE.DEFAULT_STYLE, DE.getShape(n.type).style, n.style);
  DE.edgeStyle = (e) => Object.assign({}, DE.EDGE_DEFAULT, (DE.connectors[e.type] || {}).style, e.style);
  DE.edgeRouting = (e) => e.routing || (DE.connectors[e.type] || {}).routing || 'orthogonal';

  const dashArray = (dash) => (Object.prototype.hasOwnProperty.call(DE.DASH, dash) ? DE.DASH[dash] : dash || '');

  DE.attrs = function (s, o = {}) {
    const fill = o.fill ?? s.fill, stroke = o.stroke ?? s.stroke, sw = o.sw ?? s.strokeWidth, dash = o.dash ?? s.dash;
    const da = dashArray(dash);
    return (
      `fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width="${+sw || 0}"` +
      (da ? ` stroke-dasharray="${esc(da)}"` : '') +
      (dash === 'dotted' ? ' stroke-linecap="round"' : '')
    );
  };

  DE.svgDefs = () =>
    '<filter id="de-shadow" x="-10%" y="-10%" width="130%" height="140%">' +
    '<feDropShadow dx="1.5" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.18"/></filter>';

  // ===================================================================== NODE
  DE.textBox = (n) => {
    const d = DE.getShape(n.type);
    return d.textBox ? Object.assign({}, d.textBox(n)) : { x: 6, y: 4, w: n.w - 12, h: n.h - 8 };
  };

  DE.renderNode = function (n) {
    const d = DE.getShape(n.type);
    const s = DE.nodeStyle(n);
    const a = (o) => DE.attrs(s, o);
    const w = f(n.w), h = f(n.h);
    const hit = d.hit
      ? d.hit(n)
      : d.hollow
        ? `<rect class="hit" width="${w}" height="${h}" fill="none" stroke="transparent" stroke-width="10"/>`
        : `<rect class="hit" width="${w}" height="${h}" fill="transparent"/>`;
    let body = '';
    try {
      body = d.render(n, s, a);
    } catch (err) {
      console.error('Render lỗi', n, err);
      body = `<rect width="${w}" height="${h}" fill="#fee2e2" stroke="#dc2626"/>`;
    }
    let text = '';
    if (!d.customText) {
      if (d.renderText) text = d.renderText(n, s);
      else {
        const box = DE.textBox(n);
        if (n.style && n.style.align) box.align = n.style.align;
        text = DE.textBlock(n.text, box, s);
      }
    }
    return `<g class="node" data-kind="node" data-id="${esc(n.id)}" transform="translate(${f(n.x)},${f(n.y)})">${hit}${body}${text}</g>`;
  };

  // ============================================================ PORTS / ENDS
  const DIRS = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };
  DE.PORTS = ['top', 'right', 'bottom', 'left'];
  DE.DIRS = DIRS;

  DE.portPoint = function (n, side) {
    const d = DE.getShape(n.type);
    let p = d.ports ? d.ports(n)[side] : null;
    if (!p) {
      p = side === 'top' ? { x: n.w / 2, y: 0 } : side === 'right' ? { x: n.w, y: n.h / 2 } : side === 'bottom' ? { x: n.w / 2, y: n.h } : { x: 0, y: n.h / 2 };
    }
    return { x: n.x + p.x, y: n.y + p.y, dir: DIRS[side], side };
  };

  const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

  function autoSide(n, ref) {
    const c = center(n);
    const dx = ref.x - c.x, dy = ref.y - c.y;
    if (Math.abs(dx) / (n.w || 1) > Math.abs(dy) / (n.h || 1)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'bottom' : 'top';
  }

  /** Điểm tham chiếu của một đầu nối (để đầu kia chọn hướng) */
  DE.refPoint = function (n, anchor) {
    const d = DE.getShape(n.type);
    if (d.lineAnchor && anchor != null) return { x: n.x + n.w / 2, y: n.y + anchor * n.h };
    return center(n);
  };

  /** Toạ độ + hướng của một đầu nối trên node */
  DE.resolveEnd = function (n, port, anchor, ref) {
    const d = DE.getShape(n.type);
    if (d.lineAnchor && anchor != null) {
      const y = n.y + anchor * n.h, cx = n.x + n.w / 2;
      const right = ref.x >= cx;
      const x = d.lineAnchor === 'side' ? (right ? n.x + n.w : n.x) : cx;
      return { x, y, dir: right ? [1, 0] : [-1, 0], side: right ? 'right' : 'left' };
    }
    const side = port && DIRS[port] ? port : autoSide(n, ref);
    return DE.portPoint(n, side);
  };

  // ================================================================ ROUTING
  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
      out.push(p);
    }
    for (let i = out.length - 2; i >= 1; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 0.5) out.splice(i, 1);
    }
    return out;
  }

  function ortho(p1, p2) {
    const G = 24;
    const d1 = p1.dir, d2 = p2.dir;
    const s = { x: p1.x + d1[0] * G, y: p1.y + d1[1] * G };
    const t = { x: p2.x + d2[0] * G, y: p2.y + d2[1] * G };
    const mid = [];
    const h1 = d1[0] !== 0, h2 = d2[0] !== 0;
    if (h1 && h2) {
      if (d1[0] === -d2[0] && (t.x - s.x) * d1[0] >= 0) {
        const mx = (s.x + t.x) / 2;
        mid.push({ x: mx, y: s.y }, { x: mx, y: t.y });
      } else if (d1[0] === d2[0]) {
        const x = d1[0] > 0 ? Math.max(s.x, t.x) : Math.min(s.x, t.x);
        mid.push({ x, y: s.y }, { x, y: t.y });
      } else {
        const my = (s.y + t.y) / 2;
        mid.push({ x: s.x, y: my }, { x: t.x, y: my });
      }
    } else if (!h1 && !h2) {
      if (d1[1] === -d2[1] && (t.y - s.y) * d1[1] >= 0) {
        const my = (s.y + t.y) / 2;
        mid.push({ x: s.x, y: my }, { x: t.x, y: my });
      } else if (d1[1] === d2[1]) {
        const y = d1[1] > 0 ? Math.max(s.y, t.y) : Math.min(s.y, t.y);
        mid.push({ x: s.x, y }, { x: t.x, y });
      } else {
        const mx = (s.x + t.x) / 2;
        mid.push({ x: mx, y: s.y }, { x: mx, y: t.y });
      }
    } else if (h1) {
      if ((t.x - s.x) * d1[0] >= 0 && (s.y - t.y) * d2[1] >= 0) mid.push({ x: t.x, y: s.y });
      else mid.push({ x: s.x, y: t.y });
    } else {
      if ((t.y - s.y) * d1[1] >= 0 && (s.x - t.x) * d2[0] >= 0) mid.push({ x: s.x, y: t.y });
      else mid.push({ x: t.x, y: s.y });
    }
    return simplify([p1, s, ...mid, t, p2]);
  }

  /** Hình học của một edge: { pts, curve? } */
  DE.edgeGeom = function (e, nodes) {
    const sn = nodes.get(e.source), tn = nodes.get(e.target);
    if (!sn || !tn) return null;
    const routing = DE.edgeRouting(e);
    if (sn === tn && e.sourceAnchor == null) {
      const p1 = DE.portPoint(sn, DIRS[e.sourcePort] ? e.sourcePort : 'right');
      const p2 = DE.portPoint(sn, DIRS[e.targetPort] ? e.targetPort : 'top');
      if (p1.side === 'right' && p2.side === 'top') {
        const m = 30;
        return { pts: [p1, { x: p1.x + m, y: p1.y }, { x: p1.x + m, y: p2.y - m }, { x: p2.x, y: p2.y - m }, p2] };
      }
      return { pts: ortho(p1, p2) };
    }
    const p1 = DE.resolveEnd(sn, e.sourcePort, e.sourceAnchor, DE.refPoint(tn, e.targetAnchor));
    const p2 = DE.resolveEnd(tn, e.targetPort, e.targetAnchor, DE.refPoint(sn, e.sourceAnchor));
    if (routing === 'straight') return { pts: [p1, p2] };
    if (routing === 'curved') {
      const L = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4);
      return {
        pts: [p1, p2],
        curve: [p1, { x: p1.x + p1.dir[0] * L, y: p1.y + p1.dir[1] * L }, { x: p2.x + p2.dir[0] * L, y: p2.y + p2.dir[1] * L }, p2],
      };
    }
    return { pts: ortho(p1, p2) };
  };

  // ============================================================= PATH UTILS
  const pt = (p) => `${f(p.x)},${f(p.y)}`;

  DE.polyPath = function (P, r = 0) {
    if (P.length < 3 || !r) return 'M' + P.map(pt).join(' L');
    let d = 'M' + pt(P[0]);
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      if (rr < 0.5) {
        d += ' L' + pt(b);
        continue;
      }
      const q1 = { x: b.x + ((a.x - b.x) / l1) * rr, y: b.y + ((a.y - b.y) / l1) * rr };
      const q2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
      d += ` L${pt(q1)} Q${pt(b)} ${pt(q2)}`;
    }
    return d + ' L' + pt(P[P.length - 1]);
  };

  DE.geomPath = (g) =>
    g.curve ? `M${pt(g.curve[0])} C${pt(g.curve[1])} ${pt(g.curve[2])} ${pt(g.curve[3])}` : DE.polyPath(g.pts, 0);

  DE.bezierAt = function (c, t) {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return { x: k[0] * c[0].x + k[1] * c[1].x + k[2] * c[2].x + k[3] * c[3].x, y: k[0] * c[0].y + k[1] * c[1].y + k[2] * c[2].y + k[3] * c[3].y };
  };

  DE.pointAlong = function (pts, t) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let target = total * t;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (target <= l || i === pts.length - 1) {
        const k = l ? Math.min(1, target / l) : 0;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, horizontal: Math.abs(b.y - a.y) < Math.abs(b.x - a.x) };
      }
      target -= l;
    }
    return { x: pts[0].x, y: pts[0].y, horizontal: true };
  };

  DE.labelPoint = (e, g) => {
    const t = DE.clamp(e.labelPos ?? 0.5, 0, 1);
    return g.curve ? DE.bezierAt(g.curve, t) : DE.pointAlong(g.pts, t);
  };

  function toward(a, b, d) {
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 0.01) return a;
    const k = Math.min(d, l * 0.95) / l;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  // ================================================================ ARROWS
  /**
   * Vẽ đầu mũi tên tại `tip`, hướng từ `from` đến `tip`.
   * Trả về { svg, back } – back = khoảng cần rút ngắn đường để không đè lên mũi tên.
   */
  DE.arrowHead = function (type, tip, from, sw, col, fallbackDir, bg = '#ffffff') {
    if (!type || type === 'none') return { svg: '', back: 0 };
    let ux = tip.x - from.x, uy = tip.y - from.y;
    let L = Math.hypot(ux, uy);
    if (L < 0.01 && fallbackDir) {
      ux = -fallbackDir[0];
      uy = -fallbackDir[1];
      L = 1;
    }
    if (L < 0.01) return { svg: '', back: 0 };
    ux /= L;
    uy /= L;
    const nx = -uy, ny = ux;
    const k = 9 + sw * 1.6;
    const P = (d, o) => ({ x: tip.x - ux * d + nx * o, y: tip.y - uy * d + ny * o });
    const S = (...ps) => ps.map(pt).join(' ');
    const st = `stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;
    const line = (a, b) => `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" ${st}/>`;
    const circle = (c, r, fill) => `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(r)}" fill="${fill}" ${st}/>`;
    const crow = () => line(P(k * 1.2, 0), P(0, k * 0.65)) + line(P(k * 1.2, 0), P(0, -k * 0.65));
    const bar = (d) => line(P(d, k * 0.6), P(d, -k * 0.6));
    switch (type) {
      case 'arrow':
        return { svg: `<polygon points="${S(P(0, 0), P(k, k * 0.42), P(k, -k * 0.42))}" fill="${col}" ${st}/>`, back: k * 0.85 };
      case 'open':
        return { svg: `<polyline points="${S(P(k, k * 0.5), P(0, 0), P(k, -k * 0.5))}" fill="none" ${st}/>`, back: 0 };
      case 'triangle': {
        const d = k * 1.25;
        return { svg: `<polygon points="${S(P(0, 0), P(d, d * 0.5), P(d, -d * 0.5))}" fill="${bg}" ${st}/>`, back: d };
      }
      case 'diamond':
      case 'diamondFilled': {
        const d = k * 1.05;
        return {
          svg: `<polygon points="${S(P(0, 0), P(d, d * 0.45), P(2 * d, 0), P(d, -d * 0.45))}" fill="${type === 'diamond' ? bg : col}" ${st}/>`,
          back: 2 * d,
        };
      }
      case 'circle':
      case 'circleFilled': {
        const r = k * 0.42;
        return { svg: circle(P(r, 0), r, type === 'circle' ? bg : col), back: 2 * r };
      }
      case 'slash':
        return { svg: line(P(k * 1.6, k * 0.55), P(k * 0.9, -k * 0.55)), back: 0 };
      case 'erOne':
        return { svg: bar(k * 0.9), back: 0 };
      case 'erOnlyOne':
        return { svg: bar(k * 0.7) + bar(k * 1.2), back: 0 };
      case 'erMany':
        return { svg: crow(), back: 0 };
      case 'erOneMany':
        return { svg: crow() + bar(k * 1.6), back: 0 };
      case 'erZeroOne': {
        const r = k * 0.38;
        return { svg: bar(k * 0.7) + circle(P(k * 1.3 + r, 0), r, bg), back: 0 };
      }
      case 'erZeroMany': {
        const r = k * 0.38;
        return { svg: crow() + circle(P(k * 1.3 + r, 0), r, bg), back: 0 };
      }
      default:
        return { svg: '', back: 0 };
    }
  };

  // ================================================================== EDGE
  DE.renderEdge = function (e, nodes) {
    const g = DE.edgeGeom(e, nodes);
    if (!g) return '';
    const s = DE.edgeStyle(e);
    const sw = +s.strokeWidth || 1.5;
    const col = esc(s.stroke);
    const P = (g.curve || g.pts).map((p) => ({ x: p.x, y: p.y }));
    const n = P.length;
    const first = g.pts[0], last = g.pts[g.pts.length - 1];
    const A1 = DE.arrowHead(s.startArrow, P[0], P[1], sw, col, first.dir);
    const A2 = DE.arrowHead(s.endArrow, P[n - 1], P[n - 2], sw, col, last.dir);
    if (A1.back) P[0] = toward(P[0], P[1], A1.back);
    if (A2.back) P[n - 1] = toward(P[n - 1], P[n - 2], A2.back);
    const routing = DE.edgeRouting(e);
    const d = g.curve ? `M${pt(P[0])} C${pt(P[1])} ${pt(P[2])} ${pt(P[3])}` : DE.polyPath(P, routing === 'orthogonal' ? 6 : 0);
    const da = dashArray(s.dash);
    let out = `<g class="edge" data-kind="edge" data-id="${esc(e.id)}">`;
    out += `<path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(12, sw + 10)}"/>`;
    out +=
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"` +
      (da ? ` stroke-dasharray="${esc(da)}"` : '') +
      (s.dash === 'dotted' ? ' stroke-linecap="round"' : '') +
      '/>';
    out += A1.svg + A2.svg;
    if (e.label) out += edgeLabel(e, g, s);
    return out + '</g>';
  };

  function edgeLabel(e, g, s) {
    const p = DE.labelPoint(e, g);
    const fs = +s.fontSize || 12, lh = fs * 1.25;
    const lines = String(e.label).split('\n');
    const w = Math.max(...lines.map((l) => DE.measure(l, fs))) + 10;
    const h = lines.length * lh + 4;
    let cy = p.y;
    const c = DE.connectors[e.type];
    if (c && c.labelAbove && p.horizontal !== false) cy = p.y - h / 2 - 3;
    let out = `<rect x="${f(p.x - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="3" fill="#ffffff" fill-opacity="0.9"/>`;
    lines.forEach((l, i) => {
      out += DE.textAt(l, p.x, cy - h / 2 + 2 + i * lh + lh / 2, { fontSize: fs, textColor: s.textColor }, 'middle');
    });
    return out;
  }

  // ================================================================ BOUNDS
  DE.docBounds = function (doc) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    const add = (x, y, w = 0, h = 0) => {
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x + w);
      y2 = Math.max(y2, y + h);
    };
    const nodes = new Map(doc.nodes.map((n) => [n.id, n]));
    for (const n of doc.nodes) {
      add(n.x, n.y, n.w, n.h);
      if (n.text) {
        const b = DE.textBox(n);
        if (b.y >= n.h || b.x < 0 || b.x + b.w > n.w) {
          const lines = DE.wrap(n.text, b.w, DE.nodeStyle(n).fontSize);
          const tw = Math.min(b.w, Math.max(...lines.map((l) => DE.measure(l, DE.nodeStyle(n).fontSize))) + 4);
          const th = lines.length * DE.nodeStyle(n).fontSize * 1.25;
          add(n.x + b.x + (b.w - tw) / 2, n.y + b.y, tw, th);
        }
      }
    }
    for (const e of doc.edges) {
      const g = DE.edgeGeom(e, nodes);
      if (!g) continue;
      (g.curve || g.pts).forEach((p) => add(p.x, p.y));
      if (e.label) {
        const p = DE.labelPoint(e, g);
        add(p.x - 60, p.y - 20, 120, 40);
      }
    }
    if (!isFinite(x1)) return null;
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
})(window.DE);
