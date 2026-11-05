/* =========================================================================
 * Store: tài liệu JSON + lịch sử undo/redo + chuẩn hoá/kiểm tra dữ liệu.
 *
 * Cấu trúc tài liệu:
 * {
 *   "version": 1,
 *   "meta":  { "name": "..." },
 *   "nodes": [ { id, type, x, y, w, h, text, style:{...} }, ... ],
 *   "edges": [ { id, type, source, target, label, sourcePort?, targetPort?,
 *                sourceAnchor?, targetAnchor?, routing?, labelPos?, style:{...} } ]
 * }
 * ========================================================================= */
(function (DE) {
  'use strict';

  const num = (v, d) => {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) return +v;
    return d;
  };
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

  /**
   * Chuẩn hoá JSON "dễ dãi":
   *  - giá trị không hợp lệ / thiếu  -> đưa về giá trị fallback   (ghi vào `fixed`)
   *  - node / edge không hiểu được   -> bị xoá                    (ghi vào `removed`)
   * Chỉ throw Error khi không thể hiểu cấu trúc gốc (không phải object, nodes/edges không phải mảng).
   * Trả về { doc, removed, fixed, warnings } – warnings = removed + fixed.
   */
  DE.normalizeDoc = function (raw) {
    const removed = [], fixed = [];
    if (!isObj(raw)) throw new Error('Gốc JSON phải là object dạng { "nodes": [], "edges": [] }');
    if (raw.nodes != null && !Array.isArray(raw.nodes)) throw new Error('"nodes" phải là mảng');
    if (raw.edges != null && !Array.isArray(raw.edges)) throw new Error('"edges" phải là mảng');
    const show = (v) => (v === undefined ? 'thiếu' : JSON.stringify(v));
    const label = (o, i, kind) => `${kind}[${i}]${isObj(o) && o.id != null && o.id !== '' ? ` (id "${o.id}")` : ''}`;

    if (raw.version !== undefined && raw.version !== 1) fixed.push(`"version" = ${show(raw.version)} → 1`);
    if (raw.meta !== undefined && !isObj(raw.meta)) fixed.push(`"meta" không phải object → {}`);
    const meta = isObj(raw.meta) ? { ...raw.meta } : {};
    if (typeof meta.name !== 'string') {
      if (meta.name !== undefined) fixed.push(`"meta.name" = ${show(meta.name)} → "Untitled"`);
      meta.name = 'Untitled';
    }
    if (meta.mode !== undefined && !DE.MODES[meta.mode]) {
      fixed.push(`"meta.mode" = ${show(meta.mode)} không hợp lệ → tự suy ra từ các hình`);
      delete meta.mode;
    }
    if (raw.nodes == null) fixed.push('Thiếu "nodes" → []');
    if (raw.edges == null) fixed.push('Thiếu "edges" → []');
    const doc = { version: 1, meta, nodes: [], edges: [] };

    // ---------------------------------------------------------------- nodes
    const ids = new Set();
    (raw.nodes || []).forEach((n, i) => {
      const at = label(n, i, 'nodes');
      if (!isObj(n)) return removed.push(`${at}: không phải object`);
      if (typeof n.type !== 'string' || !DE.shapes[n.type]) return removed.push(`${at}: type ${show(n.type)} không có trong thư viện`);
      const d = DE.shapes[n.type];
      let id = n.id != null && n.id !== '' ? String(n.id) : '';
      if (!id || ids.has(id)) {
        const nid = DE.uid('n');
        fixed.push(`${at}: id ${id ? `"${id}" bị trùng` : 'thiếu'} → "${nid}"`);
        id = nid;
      }
      ids.add(id);
      const pos = (k, fb) => {
        const v = num(n[k], NaN);
        if (isFinite(v)) {
          if (typeof n[k] !== 'number') fixed.push(`${at}: "${k}" = ${show(n[k])} → ${v}`);
          return v;
        }
        fixed.push(`${at}: "${k}" = ${show(n[k])} → ${fb}`);
        return fb;
      };
      const size = (k, fb) => {
        const v = num(n[k], NaN);
        if (isFinite(v) && v > 0) {
          if (typeof n[k] !== 'number') fixed.push(`${at}: "${k}" = ${show(n[k])} → ${v}`);
          return Math.max(2, v);
        }
        fixed.push(`${at}: "${k}" = ${show(n[k])} → ${fb} (mặc định)`);
        return fb;
      };
      let text = '';
      if (typeof n.text === 'string') text = n.text;
      else if (n.text != null) {
        text = typeof n.text === 'object' ? JSON.stringify(n.text) : String(n.text);
        fixed.push(`${at}: "text" không phải chuỗi → ${JSON.stringify(text)}`);
      }
      if (n.style !== undefined && !isObj(n.style)) fixed.push(`${at}: "style" không phải object → {}`);
      doc.nodes.push({
        ...n,
        id,
        type: n.type,
        x: pos('x', 0),
        y: pos('y', 0),
        w: size('w', d.w),
        h: size('h', d.h),
        text,
        style: isObj(n.style) ? { ...n.style } : {},
      });
    });

    // ---------------------------------------------------------------- edges
    const eids = new Set();
    (raw.edges || []).forEach((e, i) => {
      const at = label(e, i, 'edges');
      if (!isObj(e)) return removed.push(`${at}: không phải object`);
      if (typeof e.type !== 'string' || !DE.connectors[e.type]) return removed.push(`${at}: type ${show(e.type)} không phải kiểu đường nối hợp lệ`);
      const s = e.source != null ? String(e.source) : '';
      const t = e.target != null ? String(e.target) : '';
      if (!ids.has(s) || !ids.has(t)) {
        const miss = [!ids.has(s) ? `source ${show(e.source)}` : '', !ids.has(t) ? `target ${show(e.target)}` : ''].filter(Boolean).join(', ');
        return removed.push(`${at}: ${miss} không trỏ tới node nào (hoặc node đó đã bị xoá)`);
      }
      let id = e.id != null && e.id !== '' ? String(e.id) : '';
      if (!id || eids.has(id) || ids.has(id)) {
        const nid = DE.uid('e');
        fixed.push(`${at}: id ${id ? `"${id}" bị trùng` : 'thiếu'} → "${nid}"`);
        id = nid;
      }
      eids.add(id);
      const out = { ...e, id, source: s, target: t };
      if (typeof e.label === 'string') out.label = e.label;
      else {
        if (e.label != null) fixed.push(`${at}: "label" không phải chuỗi → ${JSON.stringify(String(e.label))}`);
        out.label = e.label == null ? '' : String(e.label);
      }
      if (e.style !== undefined && !isObj(e.style)) {
        fixed.push(`${at}: "style" không phải object → bỏ (dùng style mặc định)`);
        delete out.style;
      } else if (isObj(e.style)) out.style = { ...e.style };
      ['sourceAnchor', 'targetAnchor', 'labelPos'].forEach((k) => {
        if (out[k] == null) return delete out[k];
        const v = num(out[k], NaN);
        if (!isFinite(v)) {
          fixed.push(`${at}: "${k}" = ${show(e[k])} → bỏ (tự động)`);
          delete out[k];
        } else if (v < 0 || v > 1 || typeof e[k] !== 'number') {
          const c = DE.clamp(v, 0, 1);
          fixed.push(`${at}: "${k}" = ${show(e[k])} → ${c}`);
          out[k] = c;
        }
      });
      ['sourcePort', 'targetPort'].forEach((k) => {
        if (out[k] != null && !DE.DIRS[out[k]]) {
          fixed.push(`${at}: "${k}" = ${show(e[k])} → tự động`);
          delete out[k];
        }
      });
      if (out.routing != null && !['orthogonal', 'straight', 'curved'].includes(out.routing)) {
        fixed.push(`${at}: "routing" = ${show(e.routing)} → mặc định của kiểu đường nối`);
        delete out.routing;
      }
      doc.edges.push(out);
    });
    return { doc, removed, fixed, warnings: [...removed, ...fixed] };
  };

  /**
   * Kiểm tra NGHIÊM NGẶT định dạng file diagram (dùng khi mở file).
   * Trả về mảng lỗi; mảng rỗng = hợp lệ.
   */
  DE.validateDocStrict = function (raw) {
    const errs = [];
    const isNum = (v) => typeof v === 'number' && isFinite(v);
    const isId = (v) => typeof v === 'string' && v.trim() !== '';
    if (!isObj(raw)) return ['Gốc của file phải là một object JSON { "version", "meta", "nodes", "edges" }.'];
    if (raw.version !== undefined && raw.version !== 1) errs.push(`"version" phải là 1 (đang là ${JSON.stringify(raw.version)}).`);
    if (raw.meta !== undefined && !isObj(raw.meta)) errs.push('"meta" phải là object.');
    if (isObj(raw.meta) && raw.meta.mode !== undefined && !DE.MODES[raw.meta.mode]) errs.push(`"meta.mode" không hợp lệ: ${JSON.stringify(raw.meta.mode)} (chỉ nhận ${Object.keys(DE.MODES).join(', ')}).`);
    if (!Array.isArray(raw.nodes)) errs.push('Thiếu mảng "nodes".');
    if (!Array.isArray(raw.edges)) errs.push('Thiếu mảng "edges".');
    if (errs.length) return errs;

    const ids = new Set(), nodeIds = new Set();
    raw.nodes.forEach((n, i) => {
      const at = `nodes[${i}]`;
      if (!isObj(n)) return errs.push(`${at}: phải là object.`);
      if (!isId(n.id)) errs.push(`${at}: "id" phải là chuỗi không rỗng.`);
      else if (ids.has(n.id)) errs.push(`${at}: id "${n.id}" bị trùng.`);
      else {
        ids.add(n.id);
        nodeIds.add(n.id);
      }
      if (typeof n.type !== 'string' || !DE.shapes[n.type]) errs.push(`${at}: type ${JSON.stringify(n.type)} không có trong thư viện.`);
      ['x', 'y', 'w', 'h'].forEach((k) => {
        if (!isNum(n[k])) errs.push(`${at}: "${k}" phải là số.`);
      });
      if (isNum(n.w) && n.w <= 0) errs.push(`${at}: "w" phải > 0.`);
      if (isNum(n.h) && n.h <= 0) errs.push(`${at}: "h" phải > 0.`);
      if (n.text !== undefined && typeof n.text !== 'string') errs.push(`${at}: "text" phải là chuỗi.`);
      if (n.style !== undefined && !isObj(n.style)) errs.push(`${at}: "style" phải là object.`);
    });
    raw.edges.forEach((e, i) => {
      const at = `edges[${i}]`;
      if (!isObj(e)) return errs.push(`${at}: phải là object.`);
      if (!isId(e.id)) errs.push(`${at}: "id" phải là chuỗi không rỗng.`);
      else if (ids.has(e.id)) errs.push(`${at}: id "${e.id}" bị trùng.`);
      else ids.add(e.id);
      if (typeof e.type !== 'string' || !DE.connectors[e.type]) errs.push(`${at}: type ${JSON.stringify(e.type)} không phải kiểu đường nối hợp lệ.`);
      ['source', 'target'].forEach((k) => {
        if (!nodeIds.has(e[k])) errs.push(`${at}: "${k}" = ${JSON.stringify(e[k])} không trỏ tới node nào.`);
      });
      ['sourcePort', 'targetPort'].forEach((k) => {
        if (e[k] !== undefined && !DE.DIRS[e[k]]) errs.push(`${at}: "${k}" chỉ nhận top / right / bottom / left.`);
      });
      ['sourceAnchor', 'targetAnchor', 'labelPos'].forEach((k) => {
        if (e[k] !== undefined && !(isNum(e[k]) && e[k] >= 0 && e[k] <= 1)) errs.push(`${at}: "${k}" phải là số trong khoảng 0..1.`);
      });
      if (e.routing !== undefined && !['orthogonal', 'straight', 'curved'].includes(e.routing)) errs.push(`${at}: "routing" chỉ nhận orthogonal / straight / curved.`);
      if (e.label !== undefined && typeof e.label !== 'string') errs.push(`${at}: "label" phải là chuỗi.`);
      if (e.style !== undefined && !isObj(e.style)) errs.push(`${at}: "style" phải là object.`);
    });
    return errs;
  };

  DE.createNode = (type, x, y, extra) => {
    const d = DE.getShape(type);
    return Object.assign({ id: DE.uid('n'), type, x: Math.round(x), y: Math.round(y), w: d.w, h: d.h, text: d.text || '', style: {} }, extra);
  };

  DE.createEdge = (type, source, target, extra) => {
    const c = DE.connectors[type] || {};
    return Object.assign({ id: DE.uid('e'), type, source, target, label: c.label || '' }, extra);
  };

  // ================================================================== STORE
  const store = (DE.store = {
    doc: { version: 1, meta: { name: 'Untitled' }, nodes: [], edges: [] },
    version: 0,
    undoStack: [],
    redoStack: [],
    _ls: [],
    _pending: null,
    _lastKey: null,
    _lastTime: 0,
  });
  const MAX_HISTORY = 300;

  store.onChange = (cb) => store._ls.push(cb);
  function emit(type) {
    store.version++;
    for (const cb of store._ls) cb({ type });
  }
  function pushUndo(snap) {
    store.undoStack.push(snap);
    if (store.undoStack.length > MAX_HISTORY) store.undoStack.shift();
    store.redoStack.length = 0;
  }

  /** Nạp tài liệu mới. history=true: có thể hoàn tác về tài liệu cũ */
  store.load = (doc, { history = true } = {}) => {
    if (history && store.doc) pushUndo(JSON.stringify(store.doc));
    if (!history) {
      store.undoStack.length = 0;
      store.redoStack.length = 0;
    }
    store.doc = doc;
    store._lastKey = null;
    emit('load');
  };

  /**
   * Thay đổi tài liệu có ghi lịch sử.
   * mergeKey: các thay đổi liên tiếp cùng key trong 1.5s được gộp thành 1 bước undo.
   */
  store.mutate = (fn, mergeKey) => {
    const before = JSON.stringify(store.doc);
    fn(store.doc);
    if (before === JSON.stringify(store.doc)) return false;
    const now = Date.now();
    const merge = mergeKey && mergeKey === store._lastKey && now - store._lastTime < 1500;
    if (!merge) pushUndo(before);
    else store.redoStack.length = 0;
    store._lastKey = mergeKey || null;
    store._lastTime = now;
    emit('mutate');
    return true;
  };

  /** Dùng cho thao tác kéo: begin() lưu snapshot, touch() cập nhật live, end() ghi lịch sử */
  store.begin = () => {
    store._pending = JSON.stringify(store.doc);
  };
  store.touch = () => emit('live');
  store.end = () => {
    if (store._pending == null) return;
    const before = store._pending;
    store._pending = null;
    if (before !== JSON.stringify(store.doc)) {
      pushUndo(before);
      store._lastKey = null;
      emit('commit');
    }
  };

  store.undo = () => {
    if (!store.undoStack.length) return;
    store.redoStack.push(JSON.stringify(store.doc));
    store.doc = JSON.parse(store.undoStack.pop());
    store._lastKey = null;
    emit('undo');
  };
  store.redo = () => {
    if (!store.redoStack.length) return;
    store.undoStack.push(JSON.stringify(store.doc));
    store.doc = JSON.parse(store.redoStack.pop());
    store._lastKey = null;
    emit('redo');
  };
  store.canUndo = () => store.undoStack.length > 0;
  store.canRedo = () => store.redoStack.length > 0;
})(window.DE);
