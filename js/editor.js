/* =========================================================================
 * Editor: canvas whiteboard – pan/zoom, chọn, kéo, resize, nối, sửa chữ,
 * copy/paste, phím tắt.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const store = DE.store;
  const E = (DE.editor = {});
  const { f, clamp, esc } = DE;

  const view = { x: 0, y: 0, z: 1 };
  const sel = new Set();
  Object.assign(E, { view, sel, snap: true, grid: 10, showGrid: true, connector: 'flow.arrow', tool: 'select' });

  let stage, svg, vp, scene, overlay, textEd;
  let hover = null; // { id, p }
  let drag = null;
  let editing = null;
  let spaceDown = false;
  let lastDown = { t: 0, x: 0, y: 0 };
  let sceneDirty = true, raf = 0, cascade = 0;
  let clipboard = null, pasteN = 0;

  const L = { selection: [], view: [], pointer: [], tool: [] };
  E.on = (ev, cb) => L[ev].push(cb);
  const emit = (ev, d) => L[ev].forEach((cb) => cb(d));

  // --------------------------------------------------------------- helpers
  let nmCache = null, nmVer = -1;
  function nm() {
    if (!nmCache || nmVer !== store.version) {
      nmCache = new Map(store.doc.nodes.map((n) => [n.id, n]));
      nmVer = store.version;
    }
    return nmCache;
  }
  E.nodeMap = nm;
  const edgeById = (id) => store.doc.edges.find((e) => e.id === id);
  const snapV = (v) => (E.snap ? Math.round(v / E.grid) * E.grid : Math.round(v));
  const within = (n, p, m = 0) => p.x >= n.x - m && p.x <= n.x + n.w + m && p.y >= n.y - m && p.y <= n.y + n.h + m;
  const isTyping = () => {
    if (document.querySelector('.modal-backdrop')) return true; // đang mở hộp thoại
    const a = document.activeElement;
    return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
  };

  function toWorld(ev) {
    const r = svg.getBoundingClientRect();
    return { x: (ev.clientX - r.left - view.x) / view.z, y: (ev.clientY - r.top - view.y) / view.z };
  }

  /** Node trên cùng tại điểm p (bỏ qua vùng rỗng của hình hollow) */
  function nodeAt(p, m = 0, exclude = null) {
    const nodes = store.doc.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.id === exclude || !within(n, p, m)) continue;
      if (DE.getShape(n.type).hollow) {
        const b = 10 / view.z + m;
        const near = p.x <= n.x + b || p.x >= n.x + n.w - b || p.y <= n.y + Math.max(b, 30) || p.y >= n.y + n.h - b;
        if (!near) continue;
      }
      return n;
    }
    return null;
  }

  function insertNode(doc, n) {
    if (DE.getShape(n.type).container) {
      let i = 0;
      while (i < doc.nodes.length && DE.getShape(doc.nodes[i].type).container) i++;
      doc.nodes.splice(i, 0, n);
    } else doc.nodes.push(n);
  }

  // ------------------------------------------------------------- selection
  function selChanged() {
    invalidate(false);
    emit('selection');
  }
  E.setSelection = (ids) => {
    sel.clear();
    ids.forEach((id) => sel.add(id));
    selChanged();
  };
  E.selectedNodes = () => store.doc.nodes.filter((n) => sel.has(n.id));
  E.selectedEdges = () => store.doc.edges.filter((e) => sel.has(e.id));
  function toggleSel(id) {
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    selChanged();
  }
  function pruneSelection() {
    let changed = false;
    const alive = new Set([...store.doc.nodes.map((n) => n.id), ...store.doc.edges.map((e) => e.id)]);
    for (const id of [...sel]) if (!alive.has(id)) { sel.delete(id); changed = true; }
    if (changed) emit('selection');
  }

  // ================================================================== INIT
  E.init = function (stageEl) {
    stage = stageEl;
    svg = stage.querySelector('#canvas');
    textEd = stage.querySelector('#text-editor');
    svg.innerHTML = `<defs>${DE.svgDefs()}</defs><g id="vp"><g id="scene"></g><g id="overlay"></g></g>`;
    vp = svg.querySelector('#vp');
    scene = svg.querySelector('#scene');
    overlay = svg.querySelector('#overlay');

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('pointerleave', () => {
      if (!drag && hover) {
        hover = null;
        invalidate(false);
      }
    });
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', (e) => e.preventDefault());
    svg.addEventListener('mousedown', (e) => e.preventDefault()); // không bôi đen / không đổi focus

    // kéo-thả từ thư viện hình
    stage.addEventListener('dragover', (e) => {
      if ([...e.dataTransfer.types].includes('application/x-diagram-shape')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    stage.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('application/x-diagram-shape');
      if (!type) return;
      e.preventDefault();
      E.addNode(type, toWorld(e));
    });

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        spaceDown = false;
        updateCursor();
      }
    });
    window.addEventListener('blur', () => {
      spaceDown = false;
      updateCursor();
    });
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);

    textEd.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelText();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitText();
      }
    });
    textEd.addEventListener('blur', () => commitText());

    store.onChange(() => {
      pruneSelection();
      invalidate(true);
    });
    E.setTool('select');
    invalidate(true);
  };

  // ================================================================ RENDER
  function invalidate(sceneToo = true) {
    if (sceneToo) sceneDirty = true;
    if (!raf) raf = requestAnimationFrame(render);
  }
  E.invalidate = invalidate;

  function render() {
    raf = 0;
    vp.setAttribute('transform', `translate(${f(view.x)} ${f(view.y)}) scale(${view.z})`);
    if (sceneDirty) {
      const doc = store.doc;
      const map = nm();
      scene.innerHTML = doc.nodes.map(DE.renderNode).join('') + doc.edges.map((e) => DE.renderEdge(e, map)).join('');
      sceneDirty = false;
    }
    overlay.innerHTML = renderOverlay();
    updateGrid();
  }

  function updateGrid() {
    stage.classList.toggle('no-grid', !E.showGrid);
    let g = E.grid * view.z;
    while (g < 8) g *= 5;
    stage.style.backgroundSize = `${g}px ${g}px`;
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
  }

  const HANDLES = {
    nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
  };

  function portMarkers(n, p, active) {
    const z = view.z, r = 5 / z, off = 14 / z;
    const d = DE.getShape(n.type);
    if (d.lineAnchor) {
      const fy = clamp((p.y - n.y) / n.h, 0, 1);
      const y = n.y + fy * n.h, x = n.x + n.w / 2;
      return `<circle class="port${active === 'anchor' ? ' active' : ''}" data-port="anchor" data-node="${esc(n.id)}" data-anchor="${fy.toFixed(4)}" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" stroke-width="${f(1.5 / z)}"/>`;
    }
    return DE.PORTS.map((side) => {
      const pp = DE.portPoint(n, side);
      const cx = pp.x + pp.dir[0] * off, cy = pp.y + pp.dir[1] * off;
      return (
        `<line class="port-stem" x1="${f(pp.x)}" y1="${f(pp.y)}" x2="${f(cx)}" y2="${f(cy)}" stroke-width="${f(1 / z)}"/>` +
        `<circle class="port${active === side ? ' active' : ''}" data-port="${side}" data-node="${esc(n.id)}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" stroke-width="${f(1.5 / z)}"/>`
      );
    }).join('');
  }

  function renderOverlay() {
    const z = view.z, out = [];
    const doc = store.doc, map = nm();
    // các edge đang chọn
    for (const e of doc.edges) {
      if (!sel.has(e.id)) continue;
      const g = DE.edgeGeom(e, map);
      if (!g) continue;
      out.push(`<path class="sel-edge" d="${DE.geomPath(g)}" stroke-width="${f(6 / z)}"/>`);
      const P = g.pts, a = P[0], b = P[P.length - 1];
      const r = 6 / z;
      out.push(`<circle class="end-handle" data-end="source" data-edge="${esc(e.id)}" cx="${f(a.x)}" cy="${f(a.y)}" r="${f(r)}" stroke-width="${f(1.5 / z)}"/>`);
      out.push(`<circle class="end-handle" data-end="target" data-edge="${esc(e.id)}" cx="${f(b.x)}" cy="${f(b.y)}" r="${f(r)}" stroke-width="${f(1.5 / z)}"/>`);
    }
    // các node đang chọn
    const sn = doc.nodes.filter((n) => sel.has(n.id));
    const moving = drag && drag.type === 'move' && drag.moved;
    for (const n of sn) {
      const m = 3 / z;
      out.push(`<rect class="sel-box" x="${f(n.x - m)}" y="${f(n.y - m)}" width="${f(n.w + 2 * m)}" height="${f(n.h + 2 * m)}" stroke-width="${f(1.5 / z)}" stroke-dasharray="${f(5 / z)} ${f(3 / z)}"/>`);
    }
    if (sn.length === 1 && !moving) {
      const n = sn[0], hs = 8 / z;
      for (const [dir, [fx, fy]] of Object.entries(HANDLES)) {
        const x = n.x + n.w * fx - hs / 2, y = n.y + n.h * fy - hs / 2;
        out.push(`<rect class="handle h-${dir}" data-handle="${dir}" x="${f(x)}" y="${f(y)}" width="${f(hs)}" height="${f(hs)}" rx="${f(1.5 / z)}" stroke-width="${f(1.2 / z)}"/>`);
      }
    }
    if (sn.length > 1) {
      const b = bbox(sn), m = 8 / z;
      out.push(`<rect class="sel-group" x="${f(b.x - m)}" y="${f(b.y - m)}" width="${f(b.w + 2 * m)}" height="${f(b.h + 2 * m)}" stroke-width="${f(1 / z)}"/>`);
    }
    // điểm nối khi hover
    if (!drag && hover && E.tool !== 'hand' && !spaceDown) {
      const n = map.get(hover.id);
      if (n) out.push(portMarkers(n, hover.p));
    }
    // xem trước khi nối / nối lại
    if (drag && (drag.type === 'connect' || drag.type === 'reconnect')) {
      const tn = drag.target ? map.get(drag.target) : null;
      if (tn) {
        const m = 4 / z;
        out.push(`<rect class="target-box" x="${f(tn.x - m)}" y="${f(tn.y - m)}" width="${f(tn.w + 2 * m)}" height="${f(tn.h + 2 * m)}" stroke-width="${f(2 / z)}"/>`);
        out.push(portMarkers(tn, drag.p, drag.port));
      }
      const temp = tempEdge();
      if (temp && tn) out.push(`<g class="preview">${DE.renderEdge(temp, map)}</g>`);
      else {
        const a = previewStart();
        if (a) out.push(`<path class="preview-line" d="M${f(a.x)},${f(a.y)} L${f(drag.p.x)},${f(drag.p.y)}" stroke-width="${f(1.5 / z)}" stroke-dasharray="${f(6 / z)} ${f(4 / z)}"/>`);
      }
    }
    if (drag && drag.type === 'marquee') {
      const r = rectOf(drag.a, drag.b);
      out.push(`<rect class="marquee" x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" stroke-width="${f(1 / z)}"/>`);
    }
    return out.join('');
  }

  function bbox(nodes) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of nodes) {
      x1 = Math.min(x1, n.x);
      y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + n.w);
      y2 = Math.max(y2, n.y + n.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  /** Edge tạm để xem trước khi đang nối */
  function tempEdge() {
    if (drag.type === 'connect') {
      if (!drag.target) return null;
      const e = { id: '__preview', type: E.connector, source: drag.from, target: drag.target, label: '' };
      if (drag.fromAnchor != null) e.sourceAnchor = drag.fromAnchor;
      else if (DE.DIRS[drag.fromPort]) e.sourcePort = drag.fromPort;
      if (drag.anchor != null) e.targetAnchor = drag.anchor;
      else if (DE.DIRS[drag.port]) e.targetPort = drag.port;
      return e;
    }
    const orig = edgeById(drag.edge);
    if (!orig || !drag.target) return null;
    const e = DE.clone(orig);
    e.id = '__preview';
    e.label = '';
    applyEnd(e, drag.end, drag.target, drag.port, drag.anchor);
    return e;
  }
  function previewStart() {
    const map = nm();
    if (drag.type === 'connect') {
      const n = map.get(drag.from);
      if (!n) return null;
      return DE.resolveEnd(n, drag.fromPort, drag.fromAnchor, drag.p);
    }
    const e = edgeById(drag.edge);
    const g = e && DE.edgeGeom(e, map);
    if (!g) return null;
    return drag.end === 'source' ? g.pts[g.pts.length - 1] : g.pts[0];
  }
  function applyEnd(e, end, nodeId, port, anchor) {
    e[end] = nodeId;
    delete e[end + 'Port'];
    delete e[end + 'Anchor'];
    if (anchor != null) e[end + 'Anchor'] = +(+anchor).toFixed(4);
    else if (DE.DIRS[port]) e[end + 'Port'] = port;
  }

  // ============================================================== POINTER
  function onDown(ev) {
    if (editing) commitText();
    if (isTyping()) document.activeElement.blur();
    const p = toWorld(ev);
    const now = performance.now();
    const dbl = ev.button === 0 && now - lastDown.t < 400 && Math.hypot(ev.clientX - lastDown.x, ev.clientY - lastDown.y) < 6;
    lastDown = { t: dbl ? 0 : now, x: ev.clientX, y: ev.clientY };
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch (_) {
      /* ignore */
    }

    if (ev.button === 1 || (ev.button === 0 && (spaceDown || E.tool === 'hand'))) {
      drag = { type: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y };
      updateCursor();
      return;
    }
    if (ev.button !== 0) return;

    const t = ev.target.closest('[data-handle],[data-port],[data-end],[data-kind]');
    const kind = !t ? null : t.dataset.handle ? 'handle' : t.dataset.port ? 'port' : t.dataset.end ? 'end' : t.dataset.kind;

    if (dbl) {
      drag = null;
      if (kind === 'node' || kind === 'edge') E.editText(t.dataset.id);
      else if (!kind) startNewText(p);
      return;
    }

    if (kind === 'handle') {
      const n = E.selectedNodes()[0];
      if (!n) return;
      drag = { type: 'resize', id: n.id, dir: t.dataset.handle, o: { x: n.x, y: n.y, w: n.w, h: n.h }, s: p };
      store.begin();
      return;
    }
    if (kind === 'port') {
      startConnect(t.dataset.node, t.dataset.port, t.dataset.port === 'anchor' ? +t.dataset.anchor : null, p);
      return;
    }
    if (kind === 'end') {
      drag = { type: 'reconnect', edge: t.dataset.edge, end: t.dataset.end, p, target: null, port: 'auto', anchor: null };
      invalidate(false);
      return;
    }
    if (kind === 'edge') {
      const id = t.dataset.id;
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) toggleSel(id);
      else if (!sel.has(id)) E.setSelection([id]);
      return;
    }
    if (kind === 'node') {
      const id = t.dataset.id;
      if (E.tool === 'connect') {
        const n = nm().get(id);
        const la = DE.getShape(n.type).lineAnchor;
        startConnect(id, la ? 'anchor' : 'auto', la ? clamp((p.y - n.y) / n.h, 0, 1) : null, p);
        return;
      }
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        toggleSel(id);
        if (!sel.has(id)) return;
      } else if (!sel.has(id)) E.setSelection([id]);
      startMove(p, ev.altKey);
      return;
    }
    // nền trống -> vùng chọn
    if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey) && sel.size) {
      sel.clear();
      selChanged();
    }
    drag = { type: 'marquee', a: p, b: p, base: new Set(sel) };
  }

  function startConnect(id, port, anchor, p) {
    if (!nm().get(id)) return;
    drag = { type: 'connect', from: id, fromPort: port || 'auto', fromAnchor: anchor != null && isFinite(anchor) ? anchor : null, p, target: null, port: 'auto', anchor: null, s: p };
    hover = null;
    invalidate(false);
  }

  function startMove(p, duplicate) {
    if (duplicate) {
      const frag = fragment();
      if (frag) insertFragment(frag, 0);
    }
    const map = nm();
    const ids = new Set(E.selectedNodes().map((n) => n.id));
    if (!ids.size) return;
    // kéo theo các hình nằm trong container
    const nodes = store.doc.nodes;
    for (const id of [...ids]) {
      const c = map.get(id);
      if (!DE.getShape(c.type).container) continue;
      const ci = nodes.indexOf(c);
      nodes.forEach((n, i) => {
        if (i > ci && !ids.has(n.id) && n.x >= c.x && n.y >= c.y && n.x + n.w <= c.x + c.w && n.y + n.h <= c.y + c.h) ids.add(n.id);
      });
    }
    const orig = new Map([...ids].map((id) => [id, { x: map.get(id).x, y: map.get(id).y }]));
    drag = { type: 'move', s: p, orig, moved: false, lead: E.selectedNodes()[0].id };
    store.begin();
  }

  function onMove(ev) {
    const p = toWorld(ev);
    emit('pointer', p);
    if (!drag) {
      updateHover(p);
      return;
    }
    const map = nm();
    switch (drag.type) {
      case 'pan':
        view.x = drag.vx + ev.clientX - drag.sx;
        view.y = drag.vy + ev.clientY - drag.sy;
        invalidate(false);
        emit('view');
        break;
      case 'move': {
        let dx = p.x - drag.s.x, dy = p.y - drag.s.y;
        if (!drag.moved && Math.hypot(dx, dy) * view.z < 3) return;
        drag.moved = true;
        if (ev.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        const o = drag.orig.get(drag.lead);
        dx = snapV(o.x + dx) - o.x;
        dy = snapV(o.y + dy) - o.y;
        for (const [id, oo] of drag.orig) {
          const n = map.get(id);
          if (n) {
            n.x = oo.x + dx;
            n.y = oo.y + dy;
          }
        }
        store.touch();
        break;
      }
      case 'resize':
        doResize(p, ev.shiftKey);
        store.touch();
        break;
      case 'connect':
      case 'reconnect': {
        drag.p = p;
        const n = nodeAt(p, 6 / view.z, drag.type === 'connect' ? drag.from : null);
        drag.target = n ? n.id : null;
        drag.port = 'auto';
        drag.anchor = null;
        if (n) {
          if (DE.getShape(n.type).lineAnchor) {
            drag.anchor = clamp((p.y - n.y) / n.h, 0, 1);
            drag.port = 'anchor';
            // bắt thẳng hàng ngang với đầu kia (sequence message)
            const otherY = otherEndY();
            if (otherY != null && Math.abs(otherY - (n.y + drag.anchor * n.h)) < 10 / view.z) drag.anchor = clamp((otherY - n.y) / n.h, 0, 1);
          } else {
            let best = null, bd = 18 / view.z;
            for (const side of DE.PORTS) {
              const pp = DE.portPoint(n, side);
              const ox = pp.x + pp.dir[0] * (14 / view.z), oy = pp.y + pp.dir[1] * (14 / view.z);
              const dd = Math.min(Math.hypot(p.x - pp.x, p.y - pp.y), Math.hypot(p.x - ox, p.y - oy));
              if (dd < bd) {
                bd = dd;
                best = side;
              }
            }
            if (best) drag.port = best;
          }
        }
        invalidate(false);
        break;
      }
      case 'marquee':
        drag.b = p;
        updateMarquee();
        break;
    }
  }

  function otherEndY() {
    const map = nm();
    if (drag.type === 'connect') {
      const n = map.get(drag.from);
      return n && drag.fromAnchor != null ? n.y + drag.fromAnchor * n.h : null;
    }
    const e = edgeById(drag.edge);
    if (!e) return null;
    const otherEnd = drag.end === 'source' ? 'target' : 'source';
    const n = map.get(e[otherEnd]);
    const a = e[otherEnd + 'Anchor'];
    return n && a != null ? n.y + a * n.h : null;
  }

  function onUp(ev) {
    try {
      svg.releasePointerCapture(ev.pointerId);
    } catch (_) {
      /* ignore */
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    switch (d.type) {
      case 'move':
      case 'resize':
        store.end();
        break;
      case 'connect':
        finishConnect(d);
        break;
      case 'reconnect':
        if (d.target) {
          store.mutate((doc) => {
            const e = doc.edges.find((x) => x.id === d.edge);
            if (e) applyEnd(e, d.end, d.target, d.port, d.anchor);
          });
        }
        break;
    }
    updateCursor();
    invalidate(false);
  }

  function quickType(d) {
    if (d.cat === 'flow') return d.type === 'flow.decision' || d.keepAspect ? 'flow.process' : d.type;
    if (d.cat === 'bpmn') return d.type.includes('Event') || d.type.includes('Gateway') || d.type.startsWith('bpmn.data') ? 'bpmn.task' : d.type;
    if (d.cat === 'uml-behavior') return d.type === 'uml.state' ? d.type : 'uml.action';
    if (d.cat === 'uml-usecase') return 'uml.useCase';
    return d.type;
  }

  function finishConnect(d) {
    const map = nm();
    const src = map.get(d.from);
    if (!src) return;
    const type = DE.connectors[E.connector] ? E.connector : 'flow.arrow';
    let targetId = d.target, newNode = null;
    if (!targetId) {
      // thả ra vùng trống -> tạo nhanh một hình mới và nối tới nó
      const sd = DE.getShape(src.type);
      const far = !within(src, d.p, 40 / view.z);
      if (!far || sd.container || sd.lineAnchor) return;
      const nt = quickType(sd);
      const nd = DE.getShape(nt);
      const w = nt === src.type ? src.w : nd.w, h = nt === src.type ? src.h : nd.h;
      newNode = DE.createNode(nt, snapV(d.p.x - w / 2), snapV(d.p.y - h / 2), { w, h, text: nd.text || '' });
      targetId = newNode.id;
    }
    const e = DE.createEdge(type, d.from, targetId);
    if (d.fromAnchor != null) e.sourceAnchor = +d.fromAnchor.toFixed(4);
    else if (DE.DIRS[d.fromPort]) e.sourcePort = d.fromPort;
    if (d.anchor != null) e.targetAnchor = +d.anchor.toFixed(4);
    else if (DE.DIRS[d.port]) e.targetPort = d.port;
    store.mutate((doc) => {
      if (newNode) insertNode(doc, newNode);
      doc.edges.push(e);
    });
    E.setSelection(newNode ? [newNode.id] : [e.id]);
  }

  function doResize(p, shift) {
    const n = nm().get(drag.id);
    if (!n) return;
    const o = drag.o, dir = drag.dir;
    const d = DE.getShape(n.type);
    const minW = d.minW || 10, minH = d.minH || 6;
    const dx = p.x - drag.s.x, dy = p.y - drag.s.y;
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    if (dir.includes('w')) x1 = snapV(o.x + dx);
    if (dir.includes('e')) x2 = snapV(o.x + o.w + dx);
    if (dir.includes('n')) y1 = snapV(o.y + dy);
    if (dir.includes('s')) y2 = snapV(o.y + o.h + dy);
    if (x2 - x1 < minW) {
      if (dir.includes('w')) x1 = x2 - minW;
      else x2 = x1 + minW;
    }
    if (y2 - y1 < minH) {
      if (dir.includes('n')) y1 = y2 - minH;
      else y2 = y1 + minH;
    }
    const keep = !!d.keepAspect !== !!shift;
    if (keep && dir.length === 2) {
      const r = o.w / o.h;
      let w = x2 - x1, h = y2 - y1;
      if (w / h > r) w = h * r;
      else h = w / r;
      if (dir.includes('w')) x1 = x2 - w;
      else x2 = x1 + w;
      if (dir.includes('n')) y1 = y2 - h;
      else y2 = y1 + h;
    }
    n.x = Math.round(x1);
    n.y = Math.round(y1);
    n.w = Math.round(x2 - x1);
    n.h = Math.round(y2 - y1);
  }

  function updateHover(p) {
    if (E.tool === 'hand' || spaceDown) {
      if (hover) {
        hover = null;
        invalidate(false);
      }
      return;
    }
    let n = nodeAt(p, 0);
    if (!n && hover) {
      const h = nm().get(hover.id);
      if (h && within(h, p, 24 / view.z)) n = h;
    }
    if (!n) n = nodeAt(p, 6 / view.z);
    const id = n ? n.id : null;
    const la = n && DE.getShape(n.type).lineAnchor;
    if (id !== (hover && hover.id) || la) {
      hover = id ? { id, p } : null;
      invalidate(false);
    }
  }

  function updateMarquee() {
    const r = rectOf(drag.a, drag.b);
    sel.clear();
    drag.base.forEach((id) => sel.add(id));
    if (r.w * view.z > 2 || r.h * view.z > 2) {
      for (const n of store.doc.nodes) {
        if (n.x >= r.x && n.y >= r.y && n.x + n.w <= r.x + r.w && n.y + n.h <= r.y + r.h) sel.add(n.id);
      }
      for (const e of store.doc.edges) if (sel.has(e.source) && sel.has(e.target)) sel.add(e.id);
    }
    selChanged();
  }

  function updateCursor() {
    stage.classList.toggle('space-pan', spaceDown);
    stage.classList.toggle('panning', !!drag && drag.type === 'pan');
  }

  // ================================================================ ZOOM
  function onWheel(ev) {
    ev.preventDefault();
    if (editing) commitText();
    if (ev.ctrlKey || ev.metaKey) {
      const r = svg.getBoundingClientRect();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0018)));
    } else {
      const k = ev.deltaMode === 1 ? 20 : 1;
      if (ev.shiftKey && !ev.deltaX) view.x -= ev.deltaY * k;
      else {
        view.x -= ev.deltaX * k;
        view.y -= ev.deltaY * k;
      }
      invalidate(false);
      emit('view');
    }
  }
  function zoomAt(sx, sy, factor) {
    const z = clamp(view.z * factor, 0.1, 4);
    const wx = (sx - view.x) / view.z, wy = (sy - view.y) / view.z;
    view.x = sx - wx * z;
    view.y = sy - wy * z;
    view.z = z;
    invalidate(false);
    emit('view');
  }
  E.zoomBy = (k) => {
    const r = svg.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, k);
  };
  E.zoomTo = (z) => E.zoomBy(z / view.z);
  E.fit = () => {
    const r = svg.getBoundingClientRect();
    const b = DE.docBounds(store.doc);
    if (!b || !r.width) {
      view.x = r.width / 2 || 0;
      view.y = r.height / 2 || 0;
      view.z = 1;
    } else {
      const pad = 48;
      const z = clamp(Math.min((r.width - 2 * pad) / Math.max(b.w, 1), (r.height - 2 * pad) / Math.max(b.h, 1)), 0.1, 1.25);
      view.z = z;
      view.x = (r.width - b.w * z) / 2 - b.x * z;
      view.y = (r.height - b.h * z) / 2 - b.y * z;
    }
    invalidate(false);
    emit('view');
  };

  // ============================================================== ACTIONS
  E.setTool = (t) => {
    E.tool = t;
    stage.classList.remove('tool-select', 'tool-hand', 'tool-connect');
    stage.classList.add('tool-' + t);
    hover = null;
    invalidate(false);
    emit('tool', t);
  };

  E.addNode = (type, at) => {
    const d = DE.shapes[type];
    if (!d) return;
    if (!at) {
      const r = svg.getBoundingClientRect();
      const off = (cascade++ % 8) * 20;
      at = { x: (r.width / 2 - view.x) / view.z + off, y: (r.height / 2 - view.y) / view.z + off };
    }
    const n = DE.createNode(type, snapV(at.x - d.w / 2), snapV(at.y - d.h / 2));
    store.mutate((doc) => insertNode(doc, n));
    E.setSelection([n.id]);
  };

  E.deleteSelection = () => {
    if (!sel.size) return;
    store.mutate((doc) => {
      doc.nodes = doc.nodes.filter((n) => !sel.has(n.id));
      const alive = new Set(doc.nodes.map((n) => n.id));
      doc.edges = doc.edges.filter((e) => !sel.has(e.id) && alive.has(e.source) && alive.has(e.target));
    });
    sel.clear();
    selChanged();
  };

  E.selectAll = () => E.setSelection([...store.doc.nodes.map((n) => n.id), ...store.doc.edges.map((e) => e.id)]);

  function fragment() {
    const nodes = E.selectedNodes();
    if (!nodes.length) return null;
    const ids = new Set(nodes.map((n) => n.id));
    const edges = store.doc.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return DE.clone({ nodes, edges });
  }

  function insertFragment(frag, off) {
    const map = new Map();
    const nodes = [], edges = [];
    (frag.nodes || []).forEach((n) => {
      if (!n || typeof n !== 'object') return;
      const c = DE.clone(n);
      c.id = DE.uid('n');
      map.set(String(n.id), c.id);
      c.x = (+c.x || 0) + off;
      c.y = (+c.y || 0) + off;
      nodes.push(c);
    });
    (frag.edges || []).forEach((e) => {
      const s = map.get(String(e.source)), t = map.get(String(e.target));
      if (!s || !t) return;
      const c = DE.clone(e);
      c.id = DE.uid('e');
      c.source = s;
      c.target = t;
      edges.push(c);
    });
    if (!nodes.length) return false;
    const norm = DE.normalizeDoc({ nodes, edges }).doc;
    store.mutate((doc) => {
      norm.nodes.forEach((n) => insertNode(doc, n));
      doc.edges.push(...norm.edges);
    });
    E.setSelection([...norm.nodes, ...norm.edges].map((o) => o.id));
    return true;
  }
  E.insertFragment = insertFragment;

  E.copy = () => {
    const frag = fragment();
    if (!frag) return false;
    clipboard = frag;
    pasteN = 0;
    return frag;
  };
  E.paste = () => {
    if (!clipboard) return;
    pasteN++;
    insertFragment(clipboard, 20 * pasteN);
  };
  E.duplicate = () => {
    const frag = fragment();
    if (frag) insertFragment(frag, 20);
  };

  function onCopy(ev) {
    if (isTyping() || editing) return;
    const frag = E.copy();
    if (!frag) return;
    ev.clipboardData.setData('text/plain', JSON.stringify(frag, null, 2));
    ev.preventDefault();
  }
  function onCut(ev) {
    if (isTyping() || editing) return;
    onCopy(ev);
    if (clipboard) E.deleteSelection();
  }
  function onPaste(ev) {
    if (isTyping() || editing) return;
    const text = ev.clipboardData ? ev.clipboardData.getData('text/plain') : '';
    ev.preventDefault();
    let frag = null;
    try {
      const o = JSON.parse(text);
      if (o && Array.isArray(o.nodes)) frag = o;
    } catch (_) {
      /* không phải JSON */
    }
    if (frag) {
      pasteN++;
      insertFragment(frag, 20 * pasteN);
    } else if (text && text.trim()) {
      // dán văn bản thường -> tạo sticky note
      const r = svg.getBoundingClientRect();
      const at = { x: (r.width / 2 - view.x) / view.z, y: (r.height / 2 - view.y) / view.z };
      const n = DE.createNode('basic.sticky', snapV(at.x - 80), snapV(at.y - 70), { text: text.trim().slice(0, 2000) });
      store.mutate((doc) => insertNode(doc, n));
      E.setSelection([n.id]);
    } else E.paste();
  }

  E.bringToFront = () =>
    store.mutate((doc) => {
      doc.nodes = doc.nodes.filter((n) => !sel.has(n.id)).concat(doc.nodes.filter((n) => sel.has(n.id)));
      doc.edges = doc.edges.filter((e) => !sel.has(e.id)).concat(doc.edges.filter((e) => sel.has(e.id)));
    });
  E.sendToBack = () =>
    store.mutate((doc) => {
      doc.nodes = doc.nodes.filter((n) => sel.has(n.id)).concat(doc.nodes.filter((n) => !sel.has(n.id)));
      doc.edges = doc.edges.filter((e) => sel.has(e.id)).concat(doc.edges.filter((e) => !sel.has(e.id)));
    });

  E.align = (mode) => {
    const ns = E.selectedNodes();
    if (ns.length < 2) return;
    const b = bbox(ns);
    store.mutate((doc) => {
      const list = doc.nodes.filter((n) => sel.has(n.id));
      if (mode === 'dh' || mode === 'dv') {
        if (list.length < 3) return;
        const hz = mode === 'dh';
        list.sort((p, q) => (hz ? p.x - q.x : p.y - q.y));
        const sum = list.reduce((s, n) => s + (hz ? n.w : n.h), 0);
        const gap = ((hz ? b.w : b.h) - sum) / (list.length - 1);
        let cur = hz ? b.x : b.y;
        for (const n of list) {
          if (hz) n.x = Math.round(cur);
          else n.y = Math.round(cur);
          cur += (hz ? n.w : n.h) + gap;
        }
        return;
      }
      for (const n of list) {
        if (mode === 'left') n.x = b.x;
        else if (mode === 'hcenter') n.x = Math.round(b.x + b.w / 2 - n.w / 2);
        else if (mode === 'right') n.x = b.x + b.w - n.w;
        else if (mode === 'top') n.y = b.y;
        else if (mode === 'vmiddle') n.y = Math.round(b.y + b.h / 2 - n.h / 2);
        else if (mode === 'bottom') n.y = b.y + b.h - n.h;
        else if (mode === 'samew') n.w = list[0].w;
        else if (mode === 'sameh') n.h = list[0].h;
      }
    });
  };

  E.setEdgeType = (ids, type) => {
    const set = new Set(ids);
    store.mutate((doc) =>
      doc.edges.forEach((e) => {
        if (!set.has(e.id)) return;
        const old = DE.connectors[e.type];
        if (!e.label || (old && e.label === old.label)) e.label = (DE.connectors[type] || {}).label || '';
        e.type = type;
        delete e.routing;
        if (e.style) {
          delete e.style.startArrow;
          delete e.style.endArrow;
          delete e.style.dash;
        }
      })
    );
  };

  E.reverseEdges = (ids) => {
    const set = new Set(ids);
    store.mutate((doc) =>
      doc.edges.forEach((e) => {
        if (!set.has(e.id)) return;
        [e.source, e.target] = [e.target, e.source];
        const sp = e.sourcePort, tp = e.targetPort, sa = e.sourceAnchor, ta = e.targetAnchor;
        ['sourcePort', 'targetPort', 'sourceAnchor', 'targetAnchor'].forEach((k) => delete e[k]);
        if (tp) e.sourcePort = tp;
        if (sp) e.targetPort = sp;
        if (ta != null) e.sourceAnchor = ta;
        if (sa != null) e.targetAnchor = sa;
      })
    );
  };

  function nudge(dx, dy) {
    const ids = E.selectedNodes().map((n) => n.id);
    if (!ids.length) return;
    store.mutate((doc) => {
      for (const n of doc.nodes) {
        if (ids.includes(n.id)) {
          n.x += dx;
          n.y += dy;
        }
      }
    }, 'nudge');
  }

  // =========================================================== TEXT EDIT
  E.editText = function (id) {
    const map = nm();
    const n = map.get(id);
    if (n) {
      const d = DE.getShape(n.type);
      const s = DE.nodeStyle(n);
      const box = d.editBox ? d.editBox(n) : DE.textBox(n);
      const align = (n.style && n.style.align) || box.align || 'center';
      openEditor({ kind: 'node', id }, n.x + box.x, n.y + box.y, box.w, box.h, s, align, n.text || '');
      return;
    }
    const e = edgeById(id);
    if (e) {
      const g = DE.edgeGeom(e, map);
      if (!g) return;
      const p = DE.labelPoint(e, g);
      openEditor({ kind: 'edge', id }, p.x - 90, p.y - 18, 180, 36, DE.edgeStyle(e), 'center', e.label || '');
    }
  };

  function startNewText(p) {
    const s = DE.nodeStyle({ type: 'basic.text', style: {} });
    openEditor({ kind: 'new', x: p.x, y: p.y }, p.x - 80, p.y - 18, 160, 36, s, 'center', '');
  }

  function openEditor(target, x, y, w, h, s, align, value) {
    editing = target;
    const z = view.z;
    const fs = (+s.fontSize || 14) * z;
    const W = Math.max(w * z, 90), H = Math.max(h * z, fs * 2.4);
    Object.assign(textEd.style, {
      left: `${view.x + x * z + (w * z - W) / 2}px`,
      top: `${view.y + y * z}px`,
      width: `${W}px`,
      height: `${H}px`,
      fontSize: `${fs}px`,
      textAlign: align,
      color: s.textColor || '#0f172a',
      fontWeight: s.fontWeight || 'normal',
    });
    textEd.value = value;
    textEd.hidden = false;
    setTimeout(() => {
      if (editing !== target) return;
      textEd.focus();
      textEd.select();
    }, 0);
  }

  function commitText() {
    if (!editing) return;
    const ed = editing;
    editing = null;
    const v = textEd.value;
    textEd.hidden = true;
    if (ed.kind === 'node') {
      store.mutate((doc) => {
        const n = doc.nodes.find((x) => x.id === ed.id);
        if (n) n.text = v;
      });
    } else if (ed.kind === 'edge') {
      store.mutate((doc) => {
        const e = doc.edges.find((x) => x.id === ed.id);
        if (e) e.label = v;
      });
    } else if (ed.kind === 'new' && v.trim()) {
      const s = DE.nodeStyle({ type: 'basic.text', style: {} });
      const lines = v.split('\n');
      const w = clamp(Math.max(...lines.map((l) => DE.measure(l, s.fontSize))) + 24, 60, 480);
      const h = Math.ceil(DE.wrap(v, w - 12, s.fontSize).length * s.fontSize * 1.25 + 16);
      const n = DE.createNode('basic.text', snapV(ed.x - w / 2), snapV(ed.y - h / 2), { w: Math.round(w), h, text: v });
      store.mutate((doc) => insertNode(doc, n));
      E.setSelection([n.id]);
    }
  }
  function cancelText() {
    editing = null;
    textEd.hidden = true;
  }
  E.commitText = commitText;

  // ============================================================= KEYBOARD
  function onKey(ev) {
    if (isTyping()) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key;
    if (k === ' ') {
      if (!spaceDown) {
        spaceDown = true;
        hover = null;
        updateCursor();
        invalidate(false);
      }
      ev.preventDefault();
      return;
    }
    if (mod) {
      switch (k.toLowerCase()) {
        case 'z':
          if (ev.shiftKey) store.redo();
          else store.undo();
          break;
        case 'y':
          store.redo();
          break;
        case 'a':
          E.selectAll();
          break;
        case 'd':
          E.duplicate();
          break;
        case 's':
          DE.ui && DE.ui.saveJSON();
          break;
        case 'o':
          DE.ui && DE.ui.openFile();
          break;
        case '=':
        case '+':
          E.zoomBy(1.2);
          break;
        case '-':
          E.zoomBy(1 / 1.2);
          break;
        case '0':
          E.zoomTo(1);
          break;
        case ']':
          E.bringToFront();
          break;
        case '[':
          E.sendToBack();
          break;
        default:
          return; // Ctrl+C / X / V do sự kiện clipboard xử lý
      }
      ev.preventDefault();
      return;
    }
    const step = ev.shiftKey ? E.grid : 1;
    switch (k) {
      case 'Delete':
      case 'Backspace':
        E.deleteSelection();
        break;
      case 'Escape':
        if (drag) {
          if (drag.type === 'move' || drag.type === 'resize') {
            store.end();
            store.undo();
          }
          drag = null;
          invalidate(false);
        } else if (sel.size) E.setSelection([]);
        E.setTool('select');
        break;
      case 'v':
      case 'V':
        E.setTool('select');
        break;
      case 'h':
      case 'H':
        E.setTool('hand');
        break;
      case 'c':
      case 'C':
        E.setTool('connect');
        break;
      case 'Enter':
      case 'F2':
        if (sel.size === 1) E.editText([...sel][0]);
        break;
      case 'ArrowLeft':
        nudge(-step, 0);
        break;
      case 'ArrowRight':
        nudge(step, 0);
        break;
      case 'ArrowUp':
        nudge(0, -step);
        break;
      case 'ArrowDown':
        nudge(0, step);
        break;
      case '!':
        E.fit();
        break;
      default:
        return;
    }
    ev.preventDefault();
  }
})(window.DE);
