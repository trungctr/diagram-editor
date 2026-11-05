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
    initPWA();
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

  // ================================================================== PWA
  function initPWA() {
    // Service worker (chỉ chạy trên http/https, không chạy khi mở bằng file://)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[Diagram Editor] Không đăng ký được service worker:', e));
    }

    // Mở file .json từ hệ điều hành (file_handlers trong manifest – app đã cài)
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (params) => {
        if (!params.files || !params.files.length) return;
        const file = await params.files[0].getFile();
        DE.ui.openDiagramFile(file);
      });
    }

    // Nút "Cài đặt ứng dụng" – chỉ hiện khi trình duyệt cho phép cài
    const btn = document.getElementById('install-btn');
    let deferred = null;
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      if (btn && !standalone()) btn.hidden = false;
    });
    btn &&
      btn.addEventListener('click', async () => {
        if (!deferred) return;
        btn.hidden = true;
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => null);
        deferred = null;
        if (choice && choice.outcome !== 'accepted') btn.hidden = false;
      });
    window.addEventListener('appinstalled', () => {
      if (btn) btn.hidden = true;
      DE.ui.toast('Đã cài đặt Diagram Editor – có thể mở từ màn hình chính / menu ứng dụng', 'ok');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.DE);
