/* =========================================================================
 * Khởi động ứng dụng + tự lưu vào localStorage
 * ========================================================================= */
(function (DE) {
  'use strict';
  const KEY = 'diagram-editor:doc:v1';

  function loadSaved() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return DE.normalizeDoc(JSON.parse(raw)).doc;
    } catch (_) {
      return null;
    }
  }

  const autosave = DE.debounce(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(DE.store.doc));
    } catch (_) {
      /* hết quota / chế độ riêng tư */
    }
  }, 400);

  function start() {
    const initial = loadSaved() || DE.normalizeDoc(DE.templates.flowchart.build()).doc;
    DE.store.load(initial, { history: false });
    DE.editor.init(document.getElementById('stage'));
    DE.ui.init();
    DE.store.onChange(autosave);
    requestAnimationFrame(() => DE.editor.fit());
    // API nhỏ để thao tác qua DevTools console
    window.diagram = {
      get json() {
        return DE.clone(DE.store.doc);
      },
      load: (obj) => DE.store.load(DE.normalizeDoc(obj).doc),
      add: (type, x, y, extra) => {
        const n = DE.createNode(type, x, y, extra);
        DE.store.mutate((doc) => doc.nodes.push(n));
        return n.id;
      },
      connect: (type, source, target, extra) => {
        const e = DE.createEdge(type, source, target, extra);
        DE.store.mutate((doc) => doc.edges.push(e));
        return e.id;
      },
      shapes: () => Object.keys(DE.shapes),
      connectors: () => Object.keys(DE.connectors),
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.DE);
