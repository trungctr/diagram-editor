/* =========================================================================
 * UI: toolbar, thư viện hình (palette), bảng thuộc tính, JSON editor,
 * status bar, mở/lưu/xuất file.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const { esc } = DE;
  const store = DE.store, E = DE.editor;
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const UI = (DE.ui = {});

  // ================================================================= ICONS
  const ICONS = {
    new: 'M6 3h9l4 4v14H6zM15 3v4h4M12 11v6M9 14h6',
    open: 'M3 7V5h6l2 2h10v12H3zM3 9h18',
    save: 'M5 3h11l3 3v15H5zM8 3v5h8V3M8 14h8v7H8z',
    undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
    redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
    pointer: 'M5 3l6 17 2.5-7.5L21 10z',
    hand: 'M8 12V5.5a1.5 1.5 0 013 0V11M11 10.5v-6a1.5 1.5 0 013 0V11M14 10.5V6a1.5 1.5 0 013 0v8a7 7 0 01-7 7h-.5a6 6 0 01-5-2.7L2.6 15a1.5 1.5 0 012.4-1.8L8 16',
    connect: 'M5 19L17 7M12 7h5v5M5 19a2 2 0 100-.01',
    duplicate: 'M8 8h12v12H8zM16 8V4H4v12h4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    front: 'M9 9h11v11H9zM5 15H4V4h11v1',
    back: 'M4 4h11v11H4zM19 9h1v11H9v-1',
    zoomIn: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4M8 11h6M11 8v6',
    zoomOut: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4M8 11h6',
    fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    grid: 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
    magnet: 'M6 4h4v7a2 2 0 004 0V4h4v7a6 6 0 01-12 0zM6 8h4M14 8h4',
    help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01',
    moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
    sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  };

  // ================================================================== THEME
  const THEME_KEY = 'diagram-editor:theme';
  const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  UI.setTheme = function (t, persist = true) {
    document.documentElement.dataset.theme = t;
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch (_) {
        /* ignore */
      }
    }
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
      btn.title = t === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối (whiteboard chỉ dịu bớt, không đen)';
    }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = t === 'dark' ? '#161b22' : '#ffffff';
  };
  // ================================================================= PANELS
  const PANEL_KEY = 'diagram-editor:panels';
  const PANELS = {
    left: { cls: 'left-collapsed', el: '#palette', btn: '#toggle-left', show: 'Mở thư viện hình (Ctrl+B)', hide: 'Thu gọn thư viện hình (Ctrl+B)' },
    right: { cls: 'right-collapsed', el: '#inspector', btn: '#toggle-right', show: 'Mở bảng thuộc tính (Ctrl+Alt+B)', hide: 'Thu gọn bảng thuộc tính (Ctrl+Alt+B)' },
  };
  const panelState = { left: false, right: false }; // true = đang thu gọn

  function applyPanel(side) {
    const p = PANELS[side], collapsed = panelState[side];
    $('#app').classList.toggle(p.cls, collapsed);
    const el = $(p.el);
    el.inert = collapsed; // không cho Tab / trình đọc màn hình đi vào panel đang ẩn
    el.setAttribute('aria-hidden', String(collapsed));
    const btn = $(p.btn);
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? p.show : p.hide;
  }

  /** Thu gọn / mở panel. side: 'left' | 'right'; collapsed: true/false (bỏ trống = đảo trạng thái) */
  UI.togglePanel = function (side, collapsed) {
    if (!PANELS[side]) return;
    E.commitText && E.commitText();
    panelState[side] = collapsed === undefined ? !panelState[side] : !!collapsed;
    applyPanel(side);
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify(panelState));
    } catch (_) {
      /* ignore */
    }
  };

  function initPanels() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_KEY) || 'null');
      if (saved) Object.assign(panelState, { left: !!saved.left, right: !!saved.right });
    } catch (_) {
      /* mặc định: cả hai panel đều hiện */
    }
    const app = $('#app');
    app.classList.add('no-anim'); // áp trạng thái đã lưu ngay, không chạy hiệu ứng lúc mở trang
    applyPanel('left');
    applyPanel('right');
    requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('no-anim')));
    $('#toggle-left').addEventListener('click', (e) => {
      UI.togglePanel('left');
      e.currentTarget.blur();
    });
    $('#toggle-right').addEventListener('click', (e) => {
      UI.togglePanel('right');
      e.currentTarget.blur();
    });
    // Panel trái co giãn làm mép trái canvas dịch chuyển -> bù lại để diagram đứng yên trên màn hình
    const stage = $('#stage');
    let lastLeft = stage.getBoundingClientRect().left;
    new ResizeObserver(() => {
      const left = stage.getBoundingClientRect().left;
      if (left !== lastLeft) E.panBy(lastLeft - left);
      lastLeft = left;
    }).observe(stage);
  }

  // ================================================================ CHAT AI
  // Hiện mới có giao diện. Phần kết nối AI sẽ gắn vào các hàm CHAT_ACTIONS bên dưới.
  const CHAT_KEY = 'diagram-editor:chat-min';
  const CHAT_ACTIONS = {
    apikey: () => UI.toast('Thêm API key: tính năng đang được phát triển', 'info'),
    context: () => skillDialog(),
    mic: () => UI.toast('Nhập bằng giọng nói: tính năng đang được phát triển', 'info'),
    send: (text) => UI.toast(`Chat AI đang được phát triển – chưa gửi được: “${text.slice(0, 60)}${text.length > 60 ? '…' : ''}”`, 'info'),
  };

  /** Sao chép văn bản vào clipboard (có phương án dự phòng). Trả về true nếu thành công */
  async function copyText(text, fallbackEl) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      if (!fallbackEl) return false;
      fallbackEl.focus();
      fallbackEl.select();
      try {
        return document.execCommand('copy');
      } catch (__) {
        return false;
      }
    }
  }

  // ---------------------------------------------------- skill prompt cho AI
  let skillScope = 'mode';
  function skillDialog() {
    const hasDoc = !docIsEmpty();
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      `<div class="modal embed-modal skill-modal" role="dialog" aria-modal="true" aria-labelledby="skill-title">` +
      `<h3 id="skill-title">Skill prompt cho AI</h3>` +
      `<p class="modal-msg">Đoạn prompt này dạy AI (Gemini, ChatGPT, Claude…) định dạng JSON của Diagram Editor.</p>` +
      `<ol class="skill-steps">` +
      `<li>Sao chép skill rồi dán vào ô chat của AI, viết yêu cầu của bạn ngay sau đó (vd: <i>“Vẽ quy trình đăng ký tài khoản bằng BPMN”</i>).</li>` +
      `<li>Sao chép khối <code>json</code> AI trả về.</li>` +
      `<li>Mở tab <b>JSON</b> bên phải → dán → bấm <b>Áp dụng</b> (dán cả câu trả lời có <code>\`\`\`json</code> cũng được).</li>` +
      `</ol>` +
      `<div class="embed-opts">` +
      `<label class="embed-opt"><input type="radio" name="skill-scope" value="mode"${skillScope === 'mode' ? ' checked' : ''}>` +
      `<div><b>Chỉ chế độ ${esc(modeDef().name)}</b><span>Ngắn gọn, AI tập trung đúng loại diagram bạn đang vẽ.</span></div></label>` +
      `<label class="embed-opt"><input type="radio" name="skill-scope" value="all"${skillScope === 'all' ? ' checked' : ''}>` +
      `<div><b>Cả 3 chế độ</b><span>Flowchart, BPMN và UML/ERD – dài hơn, dùng khi chưa biết sẽ vẽ loại nào.</span></div></label>` +
      `</div>` +
      (hasDoc ? `<label class="chk embed-sel"><input type="checkbox" id="skill-doc"> Kèm diagram hiện tại (${store.doc.nodes.length} hình, ${store.doc.edges.length} đường nối) để AI chỉnh sửa tiếp</label>` : '') +
      `<textarea class="code embed-code skill-code" readonly spellcheck="false" aria-label="Nội dung skill prompt"></textarea>` +
      `<div class="embed-info msg"></div>` +
      `<div class="modal-actions"><button class="btn" data-r="close">Đóng</button><button class="btn" data-r="download">Tải file .md</button><button class="btn primary" data-r="copy">Sao chép skill</button></div></div>`;
    const ta = back.querySelector('.skill-code');
    const info = back.querySelector('.embed-info');
    const copyBtn = back.querySelector('[data-r="copy"]');
    const build = () =>
      DE.buildSkillPrompt({
        modes: skillScope === 'all' ? Object.keys(DE.MODES) : [mode],
        doc: back.querySelector('#skill-doc')?.checked ? store.doc : null,
      });
    const update = () => {
      ta.value = build();
      const chars = ta.value.length;
      info.textContent = `${(new Blob([ta.value]).size / 1024).toFixed(1)} KB · khoảng ${Math.round(chars / 3.5).toLocaleString('vi-VN')} token`;
    };
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    back.addEventListener('change', (e) => {
      if (e.target.name === 'skill-scope') skillScope = e.target.value;
      update();
    });
    back.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-r]');
      if ((b && b.dataset.r === 'close') || e.target === back) return close();
      if (!b) return;
      if (b.dataset.r === 'download') {
        DE.download(`diagram-editor-skill-${skillScope === 'all' ? 'all' : mode}.md`, new Blob([ta.value], { type: 'text/markdown' }));
        UI.toast('Đã tải file skill (.md) – mở file, sao chép nội dung và dán vào AI khi cần', 'ok');
      } else if (b.dataset.r === 'copy') {
        if (await copyText(ta.value, ta)) {
          copyBtn.textContent = 'Đã sao chép ✓';
          setTimeout(() => (copyBtn.textContent = 'Sao chép skill'), 1600);
          UI.toast('Đã sao chép skill – dán vào ô chat của AI rồi viết yêu cầu ngay sau đó', 'ok');
        } else UI.toast('Trình duyệt chặn clipboard – hãy chọn nội dung và nhấn Ctrl+C', 'warn');
      }
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    update();
    copyBtn.focus();
  }

  function initChat() {
    const box = $('#ai-chat'), pill = $('#ai-chat-pill'), ta = $('#ai-prompt'), send = $('[data-chat="send"]', box);
    const autosize = () => {
      ta.style.height = 'auto';
      // ô trống: trả về chiều cao 1 dòng (không để placeholder dài làm ô cao lên)
      ta.style.height = ta.value ? Math.min(ta.scrollHeight, 160) + 'px' : '';
      send.disabled = !ta.value.trim();
    };
    const doSend = () => {
      const text = ta.value.trim();
      if (!text) return;
      CHAT_ACTIONS.send(text);
    };
    const setMin = (min) => {
      box.hidden = min;
      pill.hidden = !min;
      try {
        localStorage.setItem(CHAT_KEY, min ? '1' : '0');
      } catch (_) {
        /* ignore */
      }
    };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doSend();
      } else if (e.key === 'Escape') ta.blur();
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chat]');
      if (!b) return;
      const act = b.dataset.chat;
      if (act === 'send') doSend();
      else if (act === 'minimize') setMin(true);
      else CHAT_ACTIONS[act] && CHAT_ACTIONS[act]();
    });
    pill.addEventListener('click', () => {
      setMin(false);
      ta.focus();
    });
    let min = false;
    try {
      min = localStorage.getItem(CHAT_KEY) === '1';
    } catch (_) {
      /* mặc định: hiện khung chat */
    }
    setMin(min);
    autosize();
  }

  function initTheme() {
    UI.setTheme(currentTheme(), false);
    // theo hệ điều hành nếu người dùng chưa tự chọn
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', (e) => {
        let saved = null;
        try {
          saved = localStorage.getItem(THEME_KEY);
        } catch (_) {
          /* ignore */
        }
        if (!saved) UI.setTheme(e.matches ? 'dark' : 'light', false);
      });
    }
  }
  const icon = (name, size = 18) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ''}"/></svg>`;

  // ================================================================== TOAST
  let toastT = 0;
  UI.toast = (msg, type = 'info') => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast-' + type;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.hidden = true), type === 'error' ? 9000 : 2600);
  };

  // ================================================================= DIALOG
  /**
   * Hộp thoại xác nhận. Trả về Promise: true (đồng ý), false (huỷ) hoặc 'alt' (nút phụ).
   * sections: [{ title, kind: 'remove' | 'fix', items: [chuỗi] }]
   */
  UI.confirm = function ({ title, message = '', sections = [], ok = 'Đồng ý', cancel = 'Huỷ', alt = null, danger = false }) {
    return new Promise((resolve) => {
      const MAX = 80;
      const secHtml = sections
        .filter((s) => s.items && s.items.length)
        .map(
          (s) =>
            `<div class="modal-sec ${s.kind || ''}"><h4>${esc(s.title)} <span class="count">${s.items.length}</span></h4><ul>` +
            s.items.slice(0, MAX).map((i) => `<li>${esc(i)}</li>`).join('') +
            (s.items.length > MAX ? `<li class="more">… và ${s.items.length - MAX} mục khác</li>` : '') +
            '</ul></div>'
        )
        .join('');
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML =
        `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">` +
        `<h3 id="modal-title">${esc(title)}</h3>` +
        (message ? `<p class="modal-msg">${esc(message)}</p>` : '') +
        (secHtml ? `<div class="modal-body">${secHtml}</div>` : '') +
        `<div class="modal-actions"><button class="btn" data-r="cancel">${esc(cancel)}</button>` +
        (alt ? `<button class="btn" data-r="alt">${esc(alt)}</button>` : '') +
        `<button class="btn ${danger ? 'danger' : 'primary'}" data-r="ok">${esc(ok)}</button></div></div>`;
      const prev = document.activeElement;
      const close = (r) => {
        window.removeEventListener('keydown', onKey, true);
        back.remove();
        try {
          if (prev && prev.focus && prev !== document.body) prev.focus();
        } catch (_) {
          /* ignore */
        }
        resolve(r === 'ok' ? true : r === 'alt' ? 'alt' : false);
      };
      const onKey = (e) => {
        e.stopPropagation(); // không để phím tắt của editor chạy khi đang mở hộp thoại
        if (e.key === 'Escape') {
          e.preventDefault();
          close('cancel');
        }
      };
      back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) close(b.dataset.r);
        else if (e.target === back) close('cancel');
      });
      window.addEventListener('keydown', onKey, true);
      document.body.appendChild(back);
      back.querySelector(danger ? '[data-r="cancel"]' : '[data-r="ok"]').focus();
    });
  };

  // ========================================================= EMBED MARKDOWN
  let embedFormat = 'inline';
  function embedDialog() {
    if (docIsEmpty()) return UI.toast('Diagram đang trống – chưa có gì để nhúng', 'warn');
    const selNodes = E.selectedNodes();
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      `<div class="modal embed-modal" role="dialog" aria-modal="true" aria-labelledby="embed-title">` +
      `<h3 id="embed-title">Nhúng diagram vào Markdown</h3>` +
      `<p class="modal-msg">Sao chép đoạn mã dưới đây và dán thẳng vào file .md – diagram nằm ngay trong văn bản, không cần file ảnh bên ngoài.</p>` +
      `<div class="embed-opts">` +
      `<label class="embed-opt"><input type="radio" name="emb-fmt" value="inline"${embedFormat === 'inline' ? ' checked' : ''}>` +
      `<div><b>SVG inline</b> (khuyên dùng) <code>&lt;div&gt;&lt;svg…&gt;&lt;/div&gt;</code><span>Vector – nét sắc ở mọi mức zoom, nhẹ, chữ trong diagram chọn & tìm kiếm được. Cần trình xem Markdown cho phép HTML (VS Code preview, Typora, Obsidian, MkDocs, Docusaurus…).</span></div></label>` +
      `<label class="embed-opt"><input type="radio" name="emb-fmt" value="png"${embedFormat === 'png' ? ' checked' : ''}>` +
      `<div><b>Ảnh PNG nhúng</b> <code>![…](data:image/png;base64,…)</code><span>Cú pháp ảnh Markdown thuần, dùng khi trình xem không cho phép HTML. Ảnh bitmap nên kém sắc khi phóng to, file nặng hơn.</span></div></label>` +
      `</div>` +
      (selNodes.length ? `<label class="chk embed-sel"><input type="checkbox" id="emb-sel"> Chỉ nhúng ${selNodes.length} hình đang chọn (và các đường nối giữa chúng)</label>` : '') +
      `<div class="embed-preview"><img alt="Xem trước diagram"></div>` +
      `<textarea class="code embed-code" readonly spellcheck="false" aria-label="Mã nhúng"></textarea>` +
      `<div class="embed-info msg"></div>` +
      `<p class="hint embed-note">Lưu ý: GitHub và một số nền tảng lọc bỏ SVG inline và ảnh data URI vì lý do bảo mật. Với các nơi đó, hãy dùng nút Tải xuống SVG và tham chiếu file bằng đường dẫn.</p>` +
      `<div class="modal-actions"><button class="btn" data-r="close">Đóng</button><button class="btn primary" data-r="copy">Sao chép mã</button></div></div>`;

    const ta = back.querySelector('.embed-code');
    const img = back.querySelector('.embed-preview img');
    const info = back.querySelector('.embed-info');
    const copyBtn = back.querySelector('[data-r="copy"]');
    const subDoc = () => {
      const only = back.querySelector('#emb-sel')?.checked;
      if (!only) return store.doc;
      const ids = new Set(selNodes.map((n) => n.id));
      return { ...store.doc, nodes: store.doc.nodes.filter((n) => ids.has(n.id)), edges: store.doc.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
    };
    let seq = 0;
    const update = async () => {
      const my = ++seq;
      const d = subDoc();
      img.src = DE.svgDataURI(d);
      copyBtn.disabled = true;
      ta.value = embedFormat === 'png' ? 'Đang tạo ảnh PNG…' : '';
      let code;
      try {
        code = await DE.markdownEmbed(d, embedFormat);
      } catch (e) {
        if (my === seq) ta.value = 'Lỗi: ' + e.message;
        return;
      }
      if (my !== seq) return; // đã có lần cập nhật mới hơn
      copyBtn.disabled = false;
      ta.value = code;
      const kb = new Blob([code]).size / 1024;
      const m = DE.exportSVG(d).match(/width="(\d+)" height="(\d+)"/);
      info.textContent = `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB · ${m ? m[1] + ' × ' + m[2] + ' px' : ''} · ${d.nodes.length} hình, ${d.edges.length} đường nối` +
        (kb > 500 ? ' – khá lớn, một số trình soạn thảo có thể chậm' : '');
      info.className = 'embed-info msg' + (kb > 500 ? ' warn' : '');
    };
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      back.remove();
    };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const copy = async () => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(ta.value);
        ok = true;
      } catch (_) {
        ta.focus();
        ta.select();
        try {
          ok = document.execCommand('copy');
        } catch (__) {
          ok = false;
        }
      }
      if (ok) {
        copyBtn.textContent = 'Đã sao chép ✓';
        setTimeout(() => (copyBtn.textContent = 'Sao chép mã'), 1600);
        UI.toast('Đã sao chép – dán vào file .md (nên để một dòng trống trước và sau đoạn mã)', 'ok');
      } else UI.toast('Trình duyệt chặn clipboard – hãy chọn đoạn mã và nhấn Ctrl+C', 'warn');
    };
    back.addEventListener('change', (e) => {
      if (e.target.name === 'emb-fmt') embedFormat = e.target.value;
      update();
    });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b && b.dataset.r === 'copy') copy();
      else if ((b && b.dataset.r === 'close') || e.target === back) close();
    });
    ta.addEventListener('focus', () => ta.select());
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    update();
    copyBtn.focus();
  }

  const docIsEmpty = () => !store.doc.nodes.length && !store.doc.edges.length;
  const docSummary = () => `"${store.doc.meta?.name || 'Untitled'}" (${store.doc.nodes.length} hình, ${store.doc.edges.length} đường nối)`;

  /** Hỏi trước khi thay thế diagram hiện tại. Trả về false | true | 'alt' (tải JSON trước) */
  function confirmReplace(title, message, ok) {
    if (docIsEmpty()) return Promise.resolve(true);
    return UI.confirm({
      title,
      message: message + '\n\nNếu lỡ tay, bạn vẫn có thể hoàn tác bằng Ctrl+Z.',
      ok,
      alt: 'Tải JSON rồi tiếp tục',
      cancel: 'Huỷ',
      danger: true,
    }).then((r) => {
      if (r === 'alt') UI.saveJSON();
      return !!r;
    });
  }

  // =================================================================== INIT
  UI.init = function () {
    $$('[data-icon]').forEach((el) => {
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    });
    initTheme();
    initPanels();
    initChat();
    initToolbar();
    initPalette();
    initInspector();
    initJson();
    initHelp();
    setMode(inferMode(store.doc), { silent: true });
    store.onChange(onDocChange);
    E.on('selection', scheduleProps);
    E.on('view', updateZoom);
    E.on('tool', updateTool);
    E.on('pointer', (p) => ($('#st-pos').textContent = `x: ${Math.round(p.x)}  y: ${Math.round(p.y)}`));
    updateTool();
    updateZoom();
    updateToggles();
    onDocChange({});
    renderProps();
  };

  // ================================================================== MODES
  let mode = 'flowchart';
  const modeDef = () => DE.MODES[mode];
  UI.getMode = () => mode;
  const modeConnectors = () => Object.entries(DE.connectors).filter(([, c]) => modeDef().groups.includes(c.group));
  const modeCats = () => modeDef().cats.map((id) => DE.shapeCategories.find((c) => c.id === id)).filter(Boolean);

  /** Chế độ của tài liệu: meta.mode, hoặc suy ra từ loại hình chiếm đa số */
  function inferMode(doc) {
    if (doc.meta && DE.MODES[doc.meta.mode]) return doc.meta.mode;
    const score = { flowchart: 0, bpmn: 0, uml: 0 };
    for (const n of doc.nodes) {
      const c = DE.getShape(n.type).cat;
      for (const [m, d] of Object.entries(DE.MODES)) if (c !== 'common' && d.cats.includes(c)) score[m]++;
    }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : mode;
  }

  function setMode(m, { silent = false } = {}) {
    if (!DE.MODES[m]) return;
    const changed = m !== mode;
    mode = m;
    if (store.doc.meta && store.doc.meta.mode !== m) {
      store.doc.meta.mode = m; // không ghi lịch sử undo
      if (!silent) store.touch();
    }
    $$('#mode-switch [data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    document.body.dataset.mode = m;
    renderPalette();
    fillConnectorSelect();
    fillTemplateSelect();
    if (!modeConnectors().some(([k]) => k === E.connector)) setConnector(modeDef().connector, false);
    renderHelp();
    scheduleProps();
    if (changed && !silent) UI.toast(`Chế độ ${modeDef().name}: thư viện chỉ hiển thị các ký hiệu ${modeDef().name}`, 'info');
  }
  UI.setMode = setMode;

  /** Người dùng bấm nút chuyển mode: hỏi rồi xoá diagram hiện tại */
  async function requestMode(m) {
    if (m === mode || !DE.MODES[m]) return;
    const name = DE.MODES[m].name;
    const ok = await confirmReplace(
      `Chuyển sang chế độ ${name}?`,
      `Khi chuyển chế độ, diagram hiện tại ${docSummary()} sẽ bị xoá và bắt đầu một tài liệu ${name} mới (giống nút Tài liệu mới).`,
      `Xoá & chuyển sang ${name}`
    );
    if (!ok) return;
    if (docIsEmpty()) return setMode(m);
    store.load(DE.emptyDoc(m));
    E.setSelection([]);
    E.fit();
    UI.toast(`Đã chuyển sang chế độ ${name} với tài liệu mới`, 'info');
  }

  async function loadTemplate(key) {
    const t = DE.templates[key];
    if (!t) return;
    const ok = await confirmReplace(`Mở mẫu "${t.name}"?`, `Diagram hiện tại ${docSummary()} sẽ bị thay thế bằng mẫu này.`, 'Thay bằng mẫu');
    if (!ok) return;
    const doc = DE.normalizeDoc(t.build()).doc;
    doc.meta.mode = t.mode;
    store.load(doc);
    E.setSelection([]);
    E.fit();
    UI.toast(`Đã mở mẫu "${t.name}" (Ctrl+Z để quay lại)`, 'ok');
  }

  function fillTemplateSelect() {
    const ts = $('#template-select');
    const list = Object.entries(DE.templates).filter(([, t]) => t.mode === mode);
    const groups = new Map();
    list.forEach(([k, t]) => {
      const g = t.group || 'Mẫu ' + modeDef().name;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push([k, t]);
    });
    ts.innerHTML =
      '<option value="">Mẫu diagram…</option>' +
      [...groups]
        .map(([g, items]) => `<optgroup label="${esc(g)}">${items.map(([k, t]) => `<option value="${k}">${esc(t.name)}</option>`).join('')}</optgroup>`)
        .join('');
  }

  function fillConnectorSelect() {
    const cs = $('#connector-select');
    const groups = {};
    modeConnectors().forEach(([k, c]) => (groups[c.group] = groups[c.group] || []).push([k, c]));
    cs.innerHTML = Object.entries(groups)
      .map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, c]) => `<option value="${k}">${esc(c.name)}</option>`).join('')}</optgroup>`)
      .join('');
    cs.value = E.connector;
  }

  // ================================================================ TOOLBAR
  const ACTIONS = {
    new: async () => {
      const ok = await confirmReplace('Tạo tài liệu mới?', `Diagram hiện tại ${docSummary()} sẽ bị xoá.`, 'Xoá & tạo mới');
      if (!ok) return;
      store.load(DE.emptyDoc(mode));
      E.setSelection([]);
      E.fit();
    },
    open: () => UI.openFile(),
    save: () => UI.saveJSON(),
    'export-svg': () => {
      DE.download(fileBase() + '.svg', new Blob([DE.exportSVG(store.doc)], { type: 'image/svg+xml' }));
      UI.toast('Đã tải ảnh SVG', 'ok');
    },
    'export-png': () =>
      DE.exportPNG(store.doc)
        .then((blob) => {
          DE.download(fileBase() + '.png', blob);
          UI.toast('Đã xuất PNG', 'ok');
        })
        .catch((e) => UI.toast(e.message, 'error')),
    embed: () => embedDialog(),
    theme: () => UI.setTheme(currentTheme() === 'dark' ? 'light' : 'dark'),
    undo: () => store.undo(),
    redo: () => store.redo(),
    delete: () => E.deleteSelection(),
    duplicate: () => E.duplicate(),
    front: () => E.bringToFront(),
    back: () => E.sendToBack(),
    'zoom-in': () => E.zoomBy(1.2),
    'zoom-out': () => E.zoomBy(1 / 1.2),
    'zoom-reset': () => E.zoomTo(1),
    fit: () => E.fit(),
  };

  function initToolbar() {
    $('#toolbar').addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.action && ACTIONS[b.dataset.action]) ACTIONS[b.dataset.action]();
      else if (b.dataset.tool) E.setTool(b.dataset.tool);
      else if (b.dataset.mode) requestMode(b.dataset.mode);
      else if (b.dataset.toggle) {
        if (b.dataset.toggle === 'grid') E.showGrid = !E.showGrid;
        if (b.dataset.toggle === 'snap') E.snap = !E.snap;
        updateToggles();
        E.invalidate(false);
      }
      b.blur();
    });

    // mẫu
    const ts = $('#template-select');
    ts.addEventListener('change', () => {
      const key = ts.value;
      ts.value = '';
      ts.blur();
      loadTemplate(key);
    });

    // kiểu đường nối mặc định
    const cs = $('#connector-select');
    cs.addEventListener('change', () => {
      setConnector(cs.value, false);
      cs.blur();
    });

    // file
    $('#file-input').addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (file) UI.openDiagramFile(file);
    });
  }

  /** Mở một File diagram (.json) – dùng cho nút Mở và khi mở file từ hệ điều hành (PWA) */
  UI.openDiagramFile = async function (file) {
    {
      const fail = (title, errors) => {
        const MAX = 8;
        const list = errors.slice(0, MAX).map((e) => '• ' + e).join('\n') + (errors.length > MAX ? `\n… và ${errors.length - MAX} lỗi khác` : '');
        UI.toast(`Không mở được "${file.name}": ${title}\n${list}`, 'error');
        console.warn('[Diagram Editor] File không hợp lệ:', file.name, errors);
      };
      if (!/\.json$/i.test(file.name)) return fail('chỉ nhận file .json của Diagram Editor.', []);
      let raw;
      try {
        raw = JSON.parse(await file.text());
      } catch (e) {
        return fail('nội dung không phải JSON hợp lệ.', [e.message]);
      }
      const errors = DE.validateDocStrict(raw);
      if (errors.length) return fail(`không đúng định dạng diagram (${errors.length} lỗi).`, errors);
      const { doc } = DE.normalizeDoc(raw);
      if (!raw.meta || !raw.meta.name) doc.meta.name = file.name.replace(/\.json$/i, '');
      store.load(doc);
      E.setSelection([]);
      E.fit();
      UI.toast(`Đã mở "${file.name}"`, 'ok');
    }
  };

  function fileBase() {
    return (store.doc.meta?.name || 'diagram').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'diagram';
  }
  UI.saveJSON = () => {
    DE.download(fileBase() + '.json', new Blob([JSON.stringify(store.doc, null, 2)], { type: 'application/json' }));
    UI.toast('Đã lưu file JSON', 'ok');
  };
  UI.openFile = () => $('#file-input').click();

  function setConnector(key, applyToSelection) {
    if (!DE.connectors[key]) return;
    E.connector = key;
    $('#connector-select').value = key;
    $$('.conn-item').forEach((b) => b.classList.toggle('active', b.dataset.conn === key));
    const edges = E.selectedEdges();
    if (applyToSelection && edges.length) E.setEdgeType(edges.map((e) => e.id), key);
  }

  function updateTool() {
    $$('#toolbar [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === E.tool));
  }
  function updateToggles() {
    $('[data-toggle="grid"]').classList.toggle('active', E.showGrid);
    $('[data-toggle="snap"]').classList.toggle('active', E.snap);
  }
  function updateZoom() {
    $('#zoom-label').textContent = Math.round(E.view.z * 100) + '%';
  }
  function updateUndo() {
    $('[data-action="undo"]').disabled = !store.canUndo();
    $('[data-action="redo"]').disabled = !store.canRedo();
  }

  // ================================================================ PALETTE
  function thumb(d) {
    const n = { id: 't', type: d.type, x: 0, y: 0, w: d.w, h: d.h, text: d.thumb ? d.text : '', style: {} };
    const pad = Math.max(d.w, d.h) * 0.06 + 2;
    // nhãn nằm dưới hình (event, gateway…) không vẽ trong thumbnail
    return `<svg viewBox="${-pad} ${-pad} ${d.w + 2 * pad} ${d.h + 2 * pad}" preserveAspectRatio="xMidYMid meet">${DE.renderNode(n)}</svg>`;
  }

  function connPreview(c) {
    const s = Object.assign({}, DE.EDGE_DEFAULT, c.style);
    const col = '#334155';
    const a = { x: 6, y: 9 }, b = { x: 58, y: 9 };
    const A1 = DE.arrowHead(s.startArrow, a, b, 1.2, col);
    const A2 = DE.arrowHead(s.endArrow, b, a, 1.2, col);
    const x1 = a.x + A1.back, x2 = b.x - A2.back;
    const da = DE.DASH[s.dash] || '';
    return (
      `<svg viewBox="0 0 64 18" width="64" height="18"><line x1="${x1}" y1="9" x2="${x2}" y2="9" stroke="${col}" stroke-width="1.2"${da ? ` stroke-dasharray="${da}"` : ''}/>` +
      A1.svg + A2.svg + '</svg>'
    );
  }

  let collapsed = { connectors: true };
  try {
    const saved = localStorage.getItem('diagram-editor:palette');
    if (saved) collapsed = JSON.parse(saved) || collapsed;
  } catch (_) {
    /* dùng mặc định */
  }

  function renderPalette() {
    const list = $('#palette-list');
    let html = `<div class="pal-mode">Thư viện <b>${esc(modeDef().name)}</b></div>`;
    // các nhóm hình của chế độ hiện tại
    for (const c of modeCats()) {
      const items = Object.values(DE.shapes).filter((d) => d.cat === c.id);
      html += `<section class="pal-sec${collapsed[c.id] ? ' collapsed' : ''}" data-sec="${c.id}"><h3>${esc(c.name)}</h3><div class="pal-grid">`;
      html += items
        .map((d) => `<button class="pal-item" draggable="true" data-type="${d.type}" data-search="${esc((d.name + ' ' + d.type + ' ' + c.name).toLowerCase())}" title="${esc(d.name)} – ${d.type}\n${esc(DE.HELP.shapes[d.type] || '')}\n\nBấm để thêm, hoặc kéo thả vào canvas">${thumb(d)}<span>${esc(d.name)}</span></button>`)
        .join('');
      html += '</div></section>';
    }
    // đường nối của chế độ
    const groups = {};
    modeConnectors().forEach(([k, c]) => (groups[c.group] = groups[c.group] || []).push([k, c]));
    html += `<section class="pal-sec${collapsed.connectors ? ' collapsed' : ''}" data-sec="connectors"><h3>Đường nối (Connector)</h3><div class="conn-list">`;
    for (const [g, items] of Object.entries(groups)) {
      html += `<div class="conn-group">${esc(g)}</div>`;
      html += items
        .map(([k, c]) => `<button class="conn-item${k === E.connector ? ' active' : ''}" data-conn="${k}" data-search="${esc((c.name + ' ' + k + ' ' + g).toLowerCase())}" title="${esc(c.name)} – ${k}\n${esc(DE.HELP.connectors[k] || '')}\n\nBấm: chọn làm mặc định (và áp dụng cho đường nối đang chọn)">${connPreview(c)}<span>${esc(c.name)}</span></button>`)
        .join('');
    }
    html += '</div></section>';
    list.innerHTML = html;
    applyPaletteSearch();
  }

  function applyPaletteSearch() {
    const q = $('#palette-search').value.trim().toLowerCase();
    $$('.pal-sec').forEach((sec) => {
      let any = false;
      $$('[data-search]', sec).forEach((el) => {
        const ok = !q || el.dataset.search.includes(q);
        el.hidden = !ok;
        any = any || ok;
      });
      $$('.conn-group', sec).forEach((g) => (g.hidden = !!q));
      sec.hidden = !any;
      sec.classList.toggle('searching', !!q);
    });
  }

  function initPalette() {
    const list = $('#palette-list');
    list.addEventListener('click', (ev) => {
      const h = ev.target.closest('h3');
      if (h) {
        const sec = h.parentElement;
        sec.classList.toggle('collapsed');
        collapsed[sec.dataset.sec] = sec.classList.contains('collapsed');
        try {
          localStorage.setItem('diagram-editor:palette', JSON.stringify(collapsed));
        } catch (_) {
          /* ignore */
        }
        return;
      }
      const item = ev.target.closest('.pal-item');
      if (item) {
        E.addNode(item.dataset.type);
        item.blur();
        return;
      }
      const conn = ev.target.closest('.conn-item');
      if (conn) {
        setConnector(conn.dataset.conn, true);
        conn.blur();
      }
    });
    list.addEventListener('dragstart', (ev) => {
      const item = ev.target.closest('.pal-item');
      if (!item) return;
      ev.dataTransfer.setData('application/x-diagram-shape', item.dataset.type);
      ev.dataTransfer.effectAllowed = 'copy';
    });
    $('#palette-search').addEventListener('input', applyPaletteSearch);
  }

  // =================================================================== HELP
  function initHelp() {
    const tab = $('#tab-help');
    tab.addEventListener('input', (ev) => {
      if (ev.target.id !== 'help-search') return;
      const q = ev.target.value.trim().toLowerCase();
      $$('.help-sec', tab).forEach((sec) => {
        const items = $$('[data-search]', sec);
        if (!items.length) {
          sec.hidden = !!q;
          return;
        }
        let any = false;
        items.forEach((el) => {
          const ok = !q || el.dataset.search.includes(q);
          el.hidden = !ok;
          any = any || ok;
        });
        sec.hidden = !any;
      });
    });
    tab.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-tpl]');
      if (t) return loadTemplate(t.dataset.tpl);
      const add = ev.target.closest('[data-add]');
      if (add) E.addNode(add.dataset.add);
    });
  }

  function renderHelp() {
    const H = DE.HELP, mh = H.modes[mode];
    let h = `<div class="help-search"><input type="search" id="help-search" placeholder="Tìm ký hiệu, ý nghĩa…" autocomplete="off"></div><div class="help-body">`;
    h += `<section class="help-sec"><h3>${esc(mh.title)}</h3><p>${esc(mh.intro)}</p>`;
    if (mh.rules && mh.rules.length) h += `<h5>Quy ước chính</h5><ul>${mh.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
    h += '</section>';

    // mẫu diagram
    const tpls = Object.entries(DE.templates).filter(([, t]) => t.mode === mode);
    if (tpls.length) {
      h += `<section class="help-sec"><h3>${mode === 'uml' ? 'Diagram theo quá trình ISO/IEC/IEEE 12207' : 'Mẫu diagram'}</h3>`;
      if (mode === 'uml')
        h += `<p class="hint">Nhóm theo các quá trình kỹ thuật (Technical processes) của ISO/IEC/IEEE 12207:2017. Nếu tổ chức của bạn áp dụng ấn bản mới hơn, hãy đối chiếu lại tên quá trình. Tiêu chuẩn không bắt buộc loại diagram – đây là cách dùng phổ biến để tạo ra sản phẩm thông tin của từng quá trình.</p>`;
      let lastGroup = null;
      for (const [k, t] of tpls) {
        if (t.group && t.group !== lastGroup) {
          h += `<h5>${esc(t.group)}</h5>`;
          lastGroup = t.group;
        }
        h += `<div class="tpl-item" data-search="${esc((t.name + ' ' + (t.group || '') + ' ' + t.desc).toLowerCase())}"><div><b>${esc(t.name)}</b><p>${esc(t.desc || '')}</p></div><button class="btn" data-tpl="${k}">Mở mẫu</button></div>`;
      }
      h += '</section>';
    }

    // ký hiệu
    for (const c of modeCats()) {
      const items = Object.values(DE.shapes).filter((d) => d.cat === c.id);
      h += `<section class="help-sec"><h3>${esc(c.name)}</h3>`;
      h += items
        .map((d) => {
          const desc = H.shapes[d.type] || '';
          return `<div class="help-item" data-search="${esc((d.name + ' ' + d.type + ' ' + desc).toLowerCase())}"><button class="help-thumb" data-add="${d.type}" title="Bấm để thêm vào canvas">${thumb(d)}</button><div><b>${esc(d.name)}</b> <code>${d.type}</code><p>${esc(desc)}</p></div></div>`;
        })
        .join('');
      h += '</section>';
    }

    // đường nối
    h += `<section class="help-sec"><h3>Đường nối / mũi tên</h3>`;
    h += modeConnectors()
      .map(([k, c]) => {
        const desc = H.connectors[k] || '';
        return `<div class="help-item conn" data-search="${esc((c.name + ' ' + k + ' ' + desc).toLowerCase())}"><div class="help-thumb">${connPreview(c)}</div><div><b>${esc(c.name)}</b> <code>${k}</code><p>${esc(desc)}</p></div></div>`;
      })
      .join('');
    h += '</section>';

    // phím tắt
    h += `<section class="help-sec"><h3>Thao tác & phím tắt</h3><table class="keys">` +
      [
        ['Chế độ', 'Nút Flowchart / BPMN / UML trên thanh công cụ – mỗi chế độ chỉ hiện ký hiệu của mình'],
        ['Thêm hình', 'Bấm hoặc kéo từ thư viện bên trái (hoặc bấm hình trong trang trợ giúp này)'],
        ['Nối hai hình', 'Rê chuột lên hình → kéo từ chấm xanh. Thả ra vùng trống để tạo nhanh hình mới'],
        ['Sửa chữ', 'Nhấn đúp / Enter / F2 (Ctrl+Enter để lưu, Esc để huỷ)'],
        ['Thêm text tự do', 'Nhấn đúp vào vùng trống'],
        ['Chọn nhiều', 'Shift + bấm, hoặc kéo vùng chọn'],
        ['Di chuyển canvas', 'Space + kéo, chuột giữa, cuộn chuột'],
        ['Zoom', 'Ctrl + cuộn chuột, Ctrl + / Ctrl −, Ctrl+0'],
        ['Nhân bản', 'Ctrl+D, hoặc Alt + kéo'],
        ['Copy / Paste', 'Ctrl+C / Ctrl+V (dữ liệu JSON)'],
        ['Hoàn tác', 'Ctrl+Z / Ctrl+Y'],
        ['Công cụ', 'V: chọn · H: kéo canvas · C: nối'],
        ['Thứ tự lớp', 'Ctrl+] lên trên cùng · Ctrl+[ xuống dưới cùng'],
        ['Dịch chuyển', 'Phím mũi tên (Shift: theo lưới)'],
        ['Vừa màn hình', 'Shift+1'],
        ['Thu gọn / mở panel', 'Nút ‹ › ở mép trái / phải canvas, hoặc Ctrl+B (thư viện) · Ctrl+Alt+B (thuộc tính)'],
      ]
        .map(([a, b]) => `<tr data-search="${esc((a + ' ' + b).toLowerCase())}"><td>${a}</td><td>${b}</td></tr>`)
        .join('') +
      `</table></section>`;
    h += '</div>';
    const q = $('#help-search') ? $('#help-search').value : '';
    $('#help').innerHTML = h;
    if (q) {
      $('#help-search').value = q;
      $('#help-search').dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ============================================================== INSPECTOR
  let activeTab = 'props';
  function activateTab(tab) {
    activeTab = tab;
    $$('#inspector .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('#tab-props').hidden = tab !== 'props';
    $('#tab-json').hidden = tab !== 'json';
    $('#tab-help').hidden = tab !== 'help';
    if (tab === 'json') refreshJson(false);
  }
  UI.activateTab = activateTab;

  function initInspector() {
    $('#inspector .tabs').addEventListener('click', (ev) => {
      const t = ev.target.closest('.tab');
      if (t) activateTab(t.dataset.tab);
    });
    const props = $('#props');
    props.addEventListener('input', onPropInput);
    props.addEventListener('click', onPropClick);
  }

  // ---- form helpers
  const field = (label, inner, cls = '') => `<label class="f ${cls}"><span>${label}</span>${inner}</label>`;
  const numIn = (label, f, v, min) => field(label, `<input type="number" data-f="${f}" value="${esc(Math.round(v * 100) / 100)}"${min != null ? ` data-min="${min}"` : ''} step="1">`);
  const selectIn = (f, v, opts) =>
    `<select data-f="${f}">${opts.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  const toHex = (c) => {
    if (typeof c !== 'string') return '#ffffff';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('').toLowerCase();
    const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (m) return '#' + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, '0')).join('');
    return '#ffffff';
  };
  function colorIn(label, f, v) {
    const none = v === 'none' || v === 'transparent';
    return (
      `<div class="f"><span>${label}</span><div class="color-row">` +
      `<input type="color" data-f="${f}" value="${toHex(v)}"${none ? ' disabled' : ''}>` +
      `<label class="chk"><input type="checkbox" data-none="${f}"${none ? ' checked' : ''}> không</label></div></div>`
    );
  }
  const DASH_OPTS = [['solid', 'Liền'], ['dashed', 'Gạch'], ['dotted', 'Chấm'], ['dashdot', 'Gạch chấm']];
  const PORT_OPTS = [['auto', 'Tự động'], ['top', 'Trên'], ['right', 'Phải'], ['bottom', 'Dưới'], ['left', 'Trái']];

  let target = { kind: 'doc', ids: [] };
  let propsRaf = 0;
  function scheduleProps() {
    if (!propsRaf) {
      propsRaf = requestAnimationFrame(() => {
        propsRaf = 0;
        renderProps();
      });
    }
  }

  function renderProps() {
    const doc = store.doc;
    const nodes = E.selectedNodes(), edges = E.selectedEdges();
    let html = '';
    if (!nodes.length && !edges.length) {
      target = { kind: 'doc', ids: [] };
      html = docForm(doc);
    } else if (edges.length && !nodes.length) {
      target = { kind: 'edge', ids: edges.map((e) => e.id) };
      html = edgeForm(edges);
    } else {
      target = { kind: 'node', ids: nodes.map((n) => n.id) };
      html = (edges.length ? `<p class="hint">Đã chọn ${nodes.length} hình và ${edges.length} đường nối – bảng dưới áp dụng cho các hình.</p>` : '') + nodeForm(nodes);
    }
    $('#props').innerHTML = html;
    $('#st-sel').textContent = nodes.length + edges.length ? `Đang chọn: ${nodes.length} hình, ${edges.length} đường nối` : '';
  }

  function docForm(doc) {
    return (
      `<div class="ptitle">Tài liệu</div>` +
      field('Tên diagram', `<input type="text" data-f="meta.name" value="${esc(doc.meta?.name || '')}">`) +
      `<div class="stats"><b>${doc.nodes.length}</b> hình · <b>${doc.edges.length}</b> đường nối · chế độ <b>${esc(modeDef().name)}</b></div>` +
      `<p class="hint">${esc(DE.HELP.modes[mode].intro)}</p>` +
      `<div class="btn-row"><button class="btn" data-act="open-help">Xem ý nghĩa ký hiệu & phím tắt (tab Trợ giúp)</button></div>`
    );
  }

  function typeOptions(current) {
    let h = '';
    for (const c of modeCats()) {
      h += `<optgroup label="${esc(c.name)}">`;
      for (const d of Object.values(DE.shapes)) if (d.cat === c.id) h += `<option value="${d.type}"${d.type === current ? ' selected' : ''}>${esc(d.name)}</option>`;
      h += '</optgroup>';
    }
    const cd = DE.shapes[current];
    if (!cd) h += `<option value="${esc(current)}" selected>${esc(current)} (không rõ)</option>`;
    else if (!modeDef().cats.includes(cd.cat)) h += `<optgroup label="Khác chế độ"><option value="${cd.type}" selected>${esc(cd.name)}</option></optgroup>`;
    return h;
  }

  function nodeForm(nodes) {
    const n = nodes[0];
    const single = nodes.length === 1;
    const d = DE.getShape(n.type);
    const s = DE.nodeStyle(n);
    let h = '';
    if (single) {
      h += `<div class="ptitle">${esc(d.name)} <code>${esc(n.type)}</code></div>`;
      if (DE.HELP.shapes[n.type]) h += `<p class="desc">${esc(DE.HELP.shapes[n.type])}</p>`;
      h += field('Loại hình', `<select data-f="type">${typeOptions(n.type)}</select>`);
      h += field('Nội dung', `<textarea data-f="text" rows="${Math.min(10, Math.max(2, String(n.text || '').split('\n').length + 1))}">${esc(n.text || '')}</textarea>`);
      if (d.customText) h += `<p class="hint">Dùng một dòng <code>--</code> để phân tách các ngăn (compartment).</p>`;
      h += `<div class="grid4">${numIn('X', 'x', n.x)}${numIn('Y', 'y', n.y)}${numIn('W', 'w', n.w, 2)}${numIn('H', 'h', n.h, 2)}</div>`;
    } else {
      h += `<div class="ptitle">${nodes.length} hình được chọn</div>`;
      h += `<h4>Căn chỉnh</h4><div class="btn-row">` +
        [['left', 'Trái'], ['hcenter', 'Giữa ngang'], ['right', 'Phải'], ['top', 'Trên'], ['vmiddle', 'Giữa dọc'], ['bottom', 'Dưới'], ['dh', 'Dàn đều ngang'], ['dv', 'Dàn đều dọc'], ['samew', 'Cùng rộng'], ['sameh', 'Cùng cao']]
          .map(([k, l]) => `<button class="btn" data-act="align" data-v="${k}">${l}</button>`)
          .join('') +
        `</div>`;
    }
    h += `<h4>Hình</h4>`;
    h += `<div class="grid2">${colorIn('Màu nền', 'style.fill', s.fill)}${colorIn('Màu viền', 'style.stroke', s.stroke)}</div>`;
    h += `<div class="grid2">${field('Độ dày viền', `<input type="number" data-f="style.strokeWidth" value="${esc(s.strokeWidth)}" min="0" step="0.5" data-min="0">`)}${field('Kiểu nét', selectIn('style.dash', s.dash, DASH_OPTS))}</div>`;
    h += `<h4>Chữ</h4>`;
    h += `<div class="grid2">${colorIn('Màu chữ', 'style.textColor', s.textColor)}${field('Cỡ chữ', `<input type="number" data-f="style.fontSize" value="${esc(s.fontSize)}" min="6" step="1" data-min="6">`)}</div>`;
    h += `<div class="grid2">${field('Căn lề', selectIn('style.align', (n.style && n.style.align) || '', [['', 'Mặc định'], ['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]))}` +
      `<div class="f"><span>Kiểu</span><div class="color-row"><label class="chk"><input type="checkbox" data-f="style.fontWeight" data-on="bold" data-off="normal"${s.fontWeight === 'bold' ? ' checked' : ''}> <b>Đậm</b></label>` +
      `<label class="chk"><input type="checkbox" data-f="style.fontStyle" data-on="italic" data-off="normal"${s.fontStyle === 'italic' ? ' checked' : ''}> <i>Nghiêng</i></label></div></div></div>`;
    h += `<div class="btn-row"><button class="btn" data-act="reset-style">Đặt lại style mặc định</button><button class="btn" data-act="front">Lên trên</button><button class="btn" data-act="back">Xuống dưới</button></div>`;
    if (single) h += objJsonBlock(n);
    return h;
  }

  function edgeForm(edges) {
    const e = edges[0];
    const single = edges.length === 1;
    const s = DE.edgeStyle(e);
    const c = DE.connectors[e.type];
    let h = single
      ? `<div class="ptitle">${esc(c ? c.name : 'Đường nối')} <code>${esc(e.type)}</code></div>`
      : `<div class="ptitle">${edges.length} đường nối được chọn</div>`;
    if (single && DE.HELP.connectors[e.type]) h += `<p class="desc">${esc(DE.HELP.connectors[e.type])}</p>`;
    const groups = {};
    const conns = modeConnectors();
    if (c && !conns.some(([k]) => k === e.type)) conns.push([e.type, c]);
    conns.forEach(([k, cc]) => (groups[cc.group] = groups[cc.group] || []).push([k, cc]));
    h += field(
      'Kiểu đường nối',
      `<select data-f="type">${Object.entries(groups)
        .map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([k, cc]) => `<option value="${k}"${k === e.type ? ' selected' : ''}>${esc(cc.name)}</option>`).join('')}</optgroup>`)
        .join('')}${c ? '' : `<option selected>${esc(e.type)}</option>`}</select>`
    );
    if (single) {
      h += field('Nhãn', `<textarea data-f="label" rows="2">${esc(e.label || '')}</textarea>`);
      h += field('Vị trí nhãn', `<input type="range" data-f="labelPos" min="0" max="1" step="0.05" value="${e.labelPos ?? 0.5}">`);
    }
    h += field('Định tuyến', selectIn('routing', DE.edgeRouting(e), [['orthogonal', 'Vuông góc (orthogonal)'], ['straight', 'Thẳng'], ['curved', 'Cong']]));
    h += `<h4>Mũi tên</h4><div class="grid2">${field('Đầu (source)', selectIn('style.startArrow', s.startArrow, DE.ARROWS))}${field('Cuối (target)', selectIn('style.endArrow', s.endArrow, DE.ARROWS))}</div>`;
    if (single) {
      h += `<div class="grid2">${field('Cổng nguồn', selectIn('sourcePort', e.sourceAnchor != null ? 'auto' : e.sourcePort || 'auto', PORT_OPTS))}${field('Cổng đích', selectIn('targetPort', e.targetAnchor != null ? 'auto' : e.targetPort || 'auto', PORT_OPTS))}</div>`;
    }
    h += `<h4>Nét</h4><div class="grid2">${colorIn('Màu', 'style.stroke', s.stroke)}${field('Độ dày', `<input type="number" data-f="style.strokeWidth" value="${esc(s.strokeWidth)}" min="0.5" step="0.5" data-min="0.5">`)}</div>`;
    h += `<div class="grid2">${field('Kiểu nét', selectIn('style.dash', s.dash, DASH_OPTS))}${field('Cỡ chữ nhãn', `<input type="number" data-f="style.fontSize" value="${esc(s.fontSize)}" min="6" data-min="6">`)}</div>`;
    h += `<div class="btn-row"><button class="btn" data-act="reverse">⇄ Đảo chiều</button><button class="btn" data-act="reset-style">Đặt lại style</button></div>`;
    if (single) h += objJsonBlock(e);
    return h;
  }

  function objJsonBlock(o) {
    return (
      `<h4>JSON của đối tượng</h4><textarea id="obj-json" class="code" rows="12" spellcheck="false">${esc(JSON.stringify(o, null, 2))}</textarea>` +
      `<div class="btn-row"><button class="btn primary" data-act="obj-apply">Áp dụng JSON</button><span id="obj-msg" class="msg"></span></div>`
    );
  }

  function setPath(o, path, v) {
    const ks = path.split('.');
    let cur = o;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!cur[ks[i]] || typeof cur[ks[i]] !== 'object') cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    const k = ks[ks.length - 1];
    if (v === undefined || (v === '' && path !== 'text' && path !== 'label')) delete cur[k];
    else cur[k] = v;
  }

  function applyField(path, value) {
    const ids = new Set(target.ids);
    const key = 'prop:' + path + ':' + target.ids.join(',');
    if (target.kind === 'doc') {
      store.mutate((doc) => setPath(doc, path, value), key);
      return;
    }
    if (target.kind === 'edge' && path === 'type') {
      E.setEdgeType([...ids], value);
      renderProps();
      return;
    }
    store.mutate((doc) => {
      const list = target.kind === 'edge' ? doc.edges : doc.nodes;
      for (const o of list) {
        if (!ids.has(o.id)) continue;
        setPath(o, path, value);
        if (target.kind === 'edge' && (path === 'sourcePort' || path === 'targetPort')) delete o[path.replace('Port', 'Anchor')];
      }
    }, key);
    if (path === 'type') renderProps();
  }

  function onPropInput(ev) {
    const el = ev.target;
    if (el.dataset.none) {
      const c = $(`input[type=color][data-f="${el.dataset.none}"]`, $('#props'));
      if (c) c.disabled = el.checked;
      applyField(el.dataset.none, el.checked ? 'none' : c ? c.value : '#ffffff');
      return;
    }
    const path = el.dataset.f;
    if (!path) return;
    let v;
    if (el.type === 'checkbox') v = el.checked ? el.dataset.on : el.dataset.off;
    else if (el.type === 'number' || el.type === 'range') {
      v = parseFloat(el.value);
      if (!isFinite(v)) return;
      if (el.dataset.min != null) v = Math.max(+el.dataset.min, v);
    } else v = el.value;
    if ((path === 'sourcePort' || path === 'targetPort') && v === 'auto') v = undefined;
    applyField(path, v);
  }

  function onPropClick(ev) {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'align') E.align(b.dataset.v);
    else if (act === 'front') E.bringToFront();
    else if (act === 'back') E.sendToBack();
    else if (act === 'reverse') E.reverseEdges(target.ids);
    else if (act === 'reset-style') {
      const ids = new Set(target.ids);
      store.mutate((doc) => {
        (target.kind === 'edge' ? doc.edges : doc.nodes).forEach((o) => {
          if (!ids.has(o.id)) return;
          if (target.kind === 'edge') {
            delete o.style;
            delete o.routing;
          } else o.style = {};
        });
      });
      renderProps();
    } else if (act === 'obj-apply') applyObjJson();
    else if (act === 'open-help') activateTab('help');
  }

  function applyObjJson() {
    const msg = $('#obj-msg');
    const id = target.ids[0];
    let o;
    try {
      o = JSON.parse($('#obj-json').value);
      if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('phải là một object');
    } catch (e) {
      msg.textContent = 'JSON lỗi: ' + e.message;
      msg.className = 'msg err';
      return;
    }
    try {
      if (target.kind === 'node') {
        const { doc: nd, warnings } = DE.normalizeDoc({ nodes: [{ ...o, id }], edges: [] });
        if (!nd.nodes.length) throw new Error(warnings.join('; ') || 'node không hợp lệ');
        store.mutate((doc) => {
          const i = doc.nodes.findIndex((x) => x.id === id);
          if (i >= 0) doc.nodes[i] = nd.nodes[0];
        });
        if (warnings.length) UI.toast(warnings.join('\n'), 'warn');
      } else if (target.kind === 'edge') {
        const { doc: nd, warnings } = DE.normalizeDoc({ nodes: store.doc.nodes, edges: [{ ...o, id }] });
        if (!nd.edges.length) throw new Error(warnings.join('; ') || 'edge không hợp lệ');
        store.mutate((doc) => {
          const i = doc.edges.findIndex((x) => x.id === id);
          if (i >= 0) doc.edges[i] = nd.edges[0];
        });
      }
      renderProps();
      UI.toast('Đã áp dụng JSON của đối tượng', 'ok');
    } catch (e) {
      msg.textContent = e.message;
      msg.className = 'msg err';
    }
  }

  // =================================================================== JSON
  let jsonDirty = false;
  function initJson() {
    const ta = $('#json-text');
    ta.addEventListener('input', () => {
      jsonDirty = true;
      showJsonMsg('Đã chỉnh sửa – bấm "Áp dụng" để cập nhật diagram', 'warn');
    });
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Tab') {
        ev.preventDefault();
        const s = ta.selectionStart;
        ta.setRangeText('  ', s, ta.selectionEnd, 'end');
        jsonDirty = true;
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        applyJson();
      }
    });
    $('#tab-json').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-json]');
      if (!b) return;
      const a = b.dataset.json;
      if (a === 'apply') applyJson();
      else if (a === 'reload') {
        jsonDirty = false;
        refreshJson(true);
        showJsonMsg('Đã tải lại từ diagram', 'ok');
      } else if (a === 'format') {
        try {
          ta.value = JSON.stringify(JSON.parse(ta.value), null, 2);
          showJsonMsg('Đã định dạng', 'ok');
        } catch (e) {
          showJsonMsg('JSON lỗi: ' + e.message, 'err');
        }
      } else if (a === 'copy') {
        navigator.clipboard
          ?.writeText(ta.value)
          .then(() => showJsonMsg('Đã sao chép vào clipboard', 'ok'))
          .catch(() => showJsonMsg('Trình duyệt không cho phép sao chép', 'err'));
      }
    });
  }
  function showJsonMsg(t, type) {
    const m = $('#json-msg');
    m.textContent = t;
    m.className = 'msg ' + (type || '');
  }
  function refreshJson(force) {
    if (activeTab !== 'json' && !force) return;
    if (jsonDirty && !force) return;
    const ta = $('#json-text');
    const scroll = ta.scrollTop;
    ta.value = JSON.stringify(store.doc, null, 2);
    ta.scrollTop = scroll;
    jsonDirty = false;
  }
  const scheduleJson = DE.debounce(() => refreshJson(false), 250);

  /**
   * Parse JSON "dễ dãi": nhận cả câu trả lời dán nguyên từ AI – lấy nội dung khối ```json … ```,
   * hoặc đoạn từ dấu { đầu tiên tới } cuối cùng.
   */
  function parseLooseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) {
        try {
          return JSON.parse(fence[1]);
        } catch (_) {
          /* thử cách tiếp theo */
        }
      }
      const a = text.indexOf('{'), b = text.lastIndexOf('}');
      if (a >= 0 && b > a) {
        try {
          return JSON.parse(text.slice(a, b + 1));
        } catch (_) {
          /* báo lỗi gốc */
        }
      }
      throw err;
    }
  }

  let applying = false;
  async function applyJson() {
    if (applying) return;
    let raw, res;
    try {
      raw = parseLooseJSON($('#json-text').value);
    } catch (e) {
      return showJsonMsg('JSON sai cú pháp – chưa áp dụng gì.\n' + e.message, 'err');
    }
    try {
      res = DE.normalizeDoc(raw);
    } catch (e) {
      return showJsonMsg('Không áp dụng được: ' + e.message, 'err');
    }
    const { doc, removed, fixed } = res;
    if (removed.length || fixed.length) {
      applying = true;
      const ok = await UI.confirm({
        title: 'Áp dụng JSON với các thay đổi sau?',
        message:
          `JSON có ${removed.length} đối tượng không hiểu được và ${fixed.length} giá trị không hợp lệ. ` +
          `Nếu tiếp tục, editor sẽ tự động xử lý như dưới đây (diagram sau khi áp dụng: ${doc.nodes.length} hình, ${doc.edges.length} đường nối).`,
        sections: [
          { title: 'Sẽ bị XOÁ (không hiểu được)', kind: 'remove', items: removed },
          { title: 'Sẽ đưa về giá trị mặc định (fallback)', kind: 'fix', items: fixed },
        ],
        ok: 'Áp dụng',
        cancel: 'Huỷ – quay lại sửa JSON',
      });
      applying = false;
      if (!ok) return showJsonMsg('Đã huỷ – diagram chưa thay đổi. Sửa JSON rồi bấm "Áp dụng" lại.', 'warn');
    }
    jsonDirty = false;
    store.load(doc);
    const notes = [removed.length ? `đã xoá ${removed.length} đối tượng` : '', fixed.length ? `đã sửa ${fixed.length} giá trị` : ''].filter(Boolean).join(', ');
    showJsonMsg(`Đã áp dụng ✓ (${doc.nodes.length} hình, ${doc.edges.length} đường nối)${notes ? ' – ' + notes : ''}. Ctrl+Z để hoàn tác.`, notes ? 'warn' : 'ok');
    refreshJson(true);
  }

  // ============================================================ DOC CHANGE
  function onDocChange(info) {
    if (info && ['load', 'undo', 'redo'].includes(info.type)) {
      const m = inferMode(store.doc);
      if (m !== mode) setMode(m, { silent: true });
      else if (store.doc.meta && !store.doc.meta.mode) store.doc.meta.mode = m;
    }
    updateUndo();
    const d = store.doc;
    $('#st-count').textContent = `${d.nodes.length} hình · ${d.edges.length} đường nối`;
    document.title = (d.meta?.name ? d.meta.name + ' – ' : '') + 'Diagram Editor (BPMN, UML, Flowchart)';
    if (!$('#props').contains(document.activeElement)) scheduleProps();
    scheduleJson();
  }
})(window.DE);
