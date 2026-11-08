/* =========================================================================
 * Giọng nói cho khung Chat AI
 *  - Nhận dạng: Web Speech API của trình duyệt (nhanh, không phải tải gì) hoặc
 *    Moonshine chạy offline ngay trong trình duyệt (transformers.js + Silero VAD,
 *    tải ~45 MB một lần, âm thanh không rời máy).
 *  - Lệnh giọng nói: câu ngắn khớp nguyên câu (“hoàn tác”, “vừa màn hình”…) chạy ngay, không gọi AI.
 *  - Phản hồi bằng giọng nói (speechSynthesis): “Em nghe rồi, anh chờ em tí nhé…”.
 *  - Rảnh tay: nghe → gửi → đọc kết quả → nghe tiếp.
 * Không phụ thuộc DOM ngoài khung chat; phần gắn với app truyền vào qua DE.voice.init(hooks).
 * ========================================================================= */
(function () {
  'use strict';
  const DE = window.DE;
  const V = (DE.voice = {});
  const KEY = 'diagram-editor:voice';

  // ------------------------------------------------------------- cấu hình
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
  const ASR_MODELS = { vi: 'bh4/moonshine-tiny-vi-ONNX', en: 'onnx-community/moonshine-tiny-ONNX' };
  const VAD_MODEL = 'onnx-community/silero-vad';
  const SILENCE_MS = 1200; // im lặng bao lâu thì coi như nói xong
  const NO_SPEECH_MS = 8000; // không nghe thấy gì sau ngần này thì dừng
  const HANDSFREE_IDLE_MS = 90000; // rảnh tay: im lặng quá lâu thì tự tắt
  const DEFAULTS = { engine: 'auto', lang: 'vi-VN', commands: true, speak: true, persona: 'em-anh', voice: '' };
  V.ENGINES = {
    auto: 'Tự động (khuyên dùng)',
    web: 'Trình duyệt – Web Speech API',
    local: 'Offline – Moonshine (~45 MB)',
  };
  V.LANGS = { 'vi-VN': 'Tiếng Việt', 'en-US': 'English' };
  V.PERSONAS = { 'em-anh': 'Em – anh', 'em-chi': 'Em – chị', 'toi-ban': 'Tôi – bạn', 'minh-ban': 'Mình – bạn' };

  V.load = function () {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || '{}');
      return Object.assign({}, DEFAULTS, c && typeof c === 'object' ? c : {});
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  };
  V.save = function (c) {
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
      return true;
    } catch (_) {
      return false;
    }
  };
  const cfg = () => V.load();
  const lang2 = () => (cfg().lang || 'vi-VN').slice(0, 2);

  // =================================================== LỆNH GIỌNG NÓI (thuần, test được)
  /** Chuẩn hoá: chữ thường, bỏ dấu, đ→d, bỏ dấu câu */
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9%\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  V.norm = norm;

  // từ đệm ở đầu / cuối câu bị bỏ qua: “hoàn tác đi”, “giúp em vừa màn hình nhé”
  const FILLERS = new Set('hay giup toi minh em anh chi ban cho di nhe nha nhá oi voi ngay please hey ok okay nao a vay'.split(' '));
  function core(s) {
    return variants(s).pop();
  }
  /** Các biến thể của câu: nguyên câu, rồi bỏ dần từ đệm ở đầu / cuối (“chế độ tối” không bị cắt “tối” = “tôi”) */
  function variants(s) {
    const t = norm(s).split(' ').filter(Boolean);
    let a = 0, b = t.length;
    const out = [t.join(' ')];
    while (b - a > 1 && FILLERS.has(t[a])) out.push(t.slice(++a, b).join(' '));
    while (b - a > 1 && FILLERS.has(t[b - 1])) out.push(t.slice(a, --b).join(' '));
    return out;
  }

  /** Danh sách lệnh. say: các câu nói (hiển thị trong trợ giúp); ack: [vi, en] */
  V.COMMANDS = [
    { id: 'undo', label: 'Hoàn tác', say: ['hoàn tác', 'quay lại', 'undo'], ack: ['Đã hoàn tác.', 'Undone.'] },
    { id: 'redo', label: 'Làm lại', say: ['làm lại', 'redo'], ack: ['Đã làm lại.', 'Redone.'] },
    { id: 'fit', label: 'Vừa màn hình', say: ['vừa màn hình', 'vừa khung', 'xem toàn bộ', 'toàn cảnh', 'fit'], ack: ['Đây, toàn bộ diagram.', 'Here is the whole diagram.'] },
    { id: 'zoom-in', label: 'Phóng to', say: ['phóng to', 'zoom in'], ack: ['Đã phóng to.', 'Zoomed in.'] },
    { id: 'zoom-out', label: 'Thu nhỏ', say: ['thu nhỏ', 'zoom out'], ack: ['Đã thu nhỏ.', 'Zoomed out.'] },
    { id: 'zoom-reset', label: 'Về 100%', say: ['kích thước thật', 'tỉ lệ gốc', 'một trăm phần trăm', '100%'], ack: ['Đã về một trăm phần trăm.', 'Back to 100 percent.'] },
    { id: 'select-all', label: 'Chọn tất cả', say: ['chọn tất cả', 'select all'], ack: ['Đã chọn tất cả.', 'Selected everything.'] },
    { id: 'deselect', label: 'Bỏ chọn', say: ['bỏ chọn', 'deselect'], ack: ['Đã bỏ chọn.', 'Selection cleared.'] },
    { id: 'delete', label: 'Xoá mục đang chọn', say: ['xoá', 'xoá mục chọn', 'xoá cái này', 'delete'], ack: ['Đã xoá.', 'Deleted.'] },
    { id: 'duplicate', label: 'Nhân bản', say: ['nhân bản', 'duplicate'], ack: ['Đã nhân bản.', 'Duplicated.'] },
    { id: 'grid', label: 'Bật / tắt lưới', say: ['bật lưới', 'tắt lưới', 'lưới'], ack: ['Xong.', 'Done.'] },
    { id: 'dark', label: 'Giao diện tối', say: ['chế độ tối', 'giao diện tối', 'dark mode'], ack: ['Đã chuyển sang giao diện tối.', 'Dark mode on.'] },
    { id: 'light', label: 'Giao diện sáng', say: ['chế độ sáng', 'giao diện sáng', 'light mode'], ack: ['Đã chuyển sang giao diện sáng.', 'Light mode on.'] },
    { id: 'save', label: 'Tải file JSON', say: ['tải json', 'lưu json', 'lưu file', 'lưu'], ack: ['Đã tải file JSON.', 'JSON downloaded.'] },
    { id: 'export-png', label: 'Tải ảnh PNG', say: ['tải png', 'xuất png', 'tải ảnh'], ack: ['Đang xuất ảnh PNG.', 'Exporting PNG.'] },
    { id: 'export-svg', label: 'Tải ảnh SVG', say: ['tải svg', 'xuất svg'], ack: ['Đã tải ảnh SVG.', 'SVG downloaded.'] },
    { id: 'embed', label: 'Nhúng SVG', say: ['nhúng svg', 'embed svg'], ack: ['Đây là mã nhúng.', 'Here is the embed code.'] },
    { id: 'new', label: 'Tài liệu mới', say: ['tài liệu mới', 'trang mới', 'tạo mới'], ack: ['Đã tạo tài liệu mới.', 'New document.'] },
    { id: 'mode', label: 'Chuyển chế độ', say: ['chuyển sang flowchart', 'chuyển sang BPMN', 'chuyển sang UML'], ack: ['Xong.', 'Done.'] },
    { id: 'help', label: 'Mở trợ giúp', say: ['trợ giúp', 'hướng dẫn', 'help'], ack: ['Trợ giúp ở bảng bên phải.', 'Help is on the right panel.'] },
    { id: 'new-chat', label: 'Cuộc trò chuyện mới', say: ['cuộc trò chuyện mới', 'trò chuyện mới', 'xoá hội thoại'], ack: ['Đã bắt đầu cuộc trò chuyện mới.', 'Started a new conversation.'] },
    { id: 'handsfree-on', label: 'Bật rảnh tay', say: ['rảnh tay', 'bật rảnh tay', 'nghe liên tục'], ack: ['', ''] },
    { id: 'handsfree-off', label: 'Tắt rảnh tay', say: ['tắt rảnh tay', 'tắt mic', 'dừng nghe', 'thôi nghe'], ack: ['', ''] },
    { id: 'stop', label: 'Dừng yêu cầu AI', say: ['dừng', 'dừng lại', 'thôi', 'huỷ', 'stop'], ack: ['Đã dừng.', 'Stopped.'] },
    { id: 'voice-settings', label: 'Cài đặt giọng nói', say: ['cài đặt giọng nói', 'voice settings'], ack: ['', ''] },
  ];
  const CMD_INDEX = new Map();
  for (const c of V.COMMANDS) if (c.id !== 'mode') for (const s of c.say) CMD_INDEX.set(norm(s), c.id);
  ['xoa di', 'zoom to', 'phong to len', 'thu nho lai', 'luu lai', 'quay lai di', 'hoan tac lai'].forEach((s, i) =>
    CMD_INDEX.set(s, ['delete', 'zoom-in', 'zoom-in', 'zoom-out', 'save', 'undo', 'undo'][i])
  );
  const MODE_WORDS = { flowchart: 'flowchart', luudo: 'flowchart', bpmn: 'bpmn', bepeemen: 'bpmn', bepemen: 'bpmn', uml: 'uml', uemeo: 'uml', uemlo: 'uml', uemen: 'uml' };
  const MODE_RE = /^(chuyensang|chuyenqua|chuyen|sang|chedo|qua|mode|switchto)(.+?)(mode|chedo)?$/;

  /** Khớp câu nói với lệnh. Trả về { id, arg } hoặc null (→ gửi cho AI) */
  V.matchCommand = function (text) {
    const vs = variants(text);
    if (!vs[0] || vs[vs.length - 1].split(' ').length > 6) return null;
    for (const s of vs) {
      const id = CMD_INDEX.get(s);
      if (id === 'grid') return { id, arg: s.startsWith('bat') ? true : s.startsWith('tat') ? false : null };
      if (id) return { id };
      const m = s.replace(/ /g, '').match(MODE_RE);
      if (m && MODE_WORDS[m[2]]) return { id: 'mode', arg: MODE_WORDS[m[2]] };
    }
    return null;
  };

  const YES = new Set(['dong y', 'co', 'ok', 'oke', 'okay', 'u', 'uh', 'um', 'duoc', 'xac nhan', 'yes', 'chac chan', 'dung roi', 'chac', 'lam di', 'tiep tuc', 'dong y xoa', 'co chac', 'yeah', 'sure', 'confirm']);
  const NO = new Set(['khong', 'huy', 'thoi', 'no', 'cancel', 'khong dong y', 'dung', 'dung lai', 'khong can', 'bo qua', 'khong chac', 'nope', 'stop']);
  /** “đồng ý” → true, “huỷ” → false, không rõ → null */
  V.matchYesNo = function (text) {
    const vs = variants(text);
    if (vs.some((v) => YES.has(v))) return true;
    if (vs.some((v) => NO.has(v))) return false;
    const s = vs[vs.length - 1], w = s.split(' ')[0];
    if (w === 'khong' || w === 'huy' || w === 'thoi') return false;
    if (YES.has(w) && s.split(' ').length <= 3) return true;
    return null;
  };

  // ============================================================ LỜI PHẢN HỒI
  const PH = {
    vi: {
      ack: ['{Me} nghe rồi, {you} chờ {me} tí nhé.', 'Rõ rồi, {me} làm ngay đây.', 'Ok {you}, đợi {me} một chút nhé.', 'Đã nghe, {me} đang làm đây.', 'Để {me} lo, {you} chờ tí nha.'],
      done: ['Xong rồi, {you} xem thử nhé.', '{Me} vẽ xong rồi đó.', 'Đã xong, {you} xem có ưng không nhé.'],
      undoTip: ' Không ưng thì nói hoàn tác nhé.',
      replied: '{Me} trả lời trong khung chat rồi, {you} xem nhé.',
      error: 'Ối, có lỗi rồi. {You} xem thông báo giúp {me} nhé.',
      nokey: '{You} cần thêm API key trước đã nhé.',
      busy: '{Me} đang làm yêu cầu trước, {you} chờ tí nhé.',
      aborted: 'Đã dừng.',
      cancelled: 'Đã huỷ áp dụng.',
      confirm: '{You} chắc chứ? Nói đồng ý hoặc huỷ nhé.',
      confirmAgain: 'Nói đồng ý hoặc huỷ nhé.',
      yes: 'Ok, xong.',
      no: 'Đã huỷ.',
      nothingSelected: '{You} chưa chọn gì để xoá.',
      nothingToUndo: 'Không còn gì để hoàn tác.',
      nothingToRedo: 'Không còn gì để làm lại.',
      idle: 'Không có gì đang chạy.',
      hfOn: 'Đã bật rảnh tay, {you} cứ nói nhé.',
      hfOff: 'Đã tắt rảnh tay.',
      hfIdle: 'Lâu quá không nghe thấy gì, {me} tắt rảnh tay nhé.',
      test: 'Xin chào, {me} sẽ đọc phản hồi bằng giọng này.',
    },
    en: {
      ack: ['Got it, give me a sec.', 'On it!', 'Okay, working on it.', 'Sure, one moment.'],
      done: ['Done, take a look.', 'All set.', 'Finished, have a look.'],
      undoTip: ' Say undo if you don’t like it.',
      replied: 'I answered in the chat box.',
      error: 'Oops, something went wrong. Please check the message.',
      nokey: 'Please add an API key first.',
      busy: 'Still working on the previous request.',
      aborted: 'Stopped.',
      cancelled: 'Cancelled.',
      confirm: 'Are you sure? Say yes or cancel.',
      confirmAgain: 'Say yes or cancel.',
      yes: 'Okay, done.',
      no: 'Cancelled.',
      nothingSelected: 'Nothing is selected.',
      nothingToUndo: 'Nothing to undo.',
      nothingToRedo: 'Nothing to redo.',
      idle: 'Nothing is running.',
      hfOn: 'Hands-free is on, go ahead.',
      hfOff: 'Hands-free is off.',
      hfIdle: 'I haven’t heard anything for a while, turning hands-free off.',
      test: 'Hello, I will speak feedback with this voice.',
    },
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function phrase(key) {
    const L = PH[lang2()] || PH.vi;
    let p = L[key];
    if (Array.isArray(p)) p = p[Math.floor(Math.random() * p.length)];
    const [me, you] = (V.PERSONAS[cfg().persona] ? cfg().persona : 'em-anh').split('-').map((w) => ({ chi: 'chị', toi: 'tôi', ban: 'bạn', minh: 'mình' })[w] || w);
    return cap(String(p || '').replace(/\{me\}/g, me).replace(/\{you\}/g, you).replace(/\{Me\}/g, cap(me)).replace(/\{You\}/g, cap(you)));
  }
  V.phrase = phrase;

  // ============================================================ ĐỌC (TTS)
  const synth = window.speechSynthesis || null;
  V.ttsSupported = !!synth;
  V.voicesFor = function (lang) {
    if (!synth) return [];
    const want = (lang || cfg().lang).slice(0, 2).toLowerCase();
    let list = [];
    try {
      list = synth.getVoices();
    } catch (_) {
      /* ignore */
    }
    return list
      .filter((v) => (v.lang || '').replace('_', '-').toLowerCase().startsWith(want))
      .sort((a, b) => /natural|online|neural/i.test(b.name) - /natural|online|neural/i.test(a.name));
  };
  function pickVoice() {
    const list = V.voicesFor();
    const c = cfg();
    return list.find((v) => v.voiceURI === c.voice) || list[0] || null;
  }
  let showVisual = (t) => DE.ui && DE.ui.toast('🗣 ' + t, 'info');
  V.stopSpeaking = () => {
    try {
      synth && synth.cancel();
    } catch (_) {
      /* ignore */
    }
  };
  /** Đọc một câu. Promise xong khi đọc xong (hoặc hết thời gian chờ). Máy không có giọng hợp ngôn ngữ → hiện chữ */
  V.speak = function (text, { force = false } = {}) {
    return new Promise((resolve) => {
      if (!text) return resolve();
      if (!force && !cfg().speak) return resolve();
      const voice = pickVoice();
      if (!synth || !voice) {
        showVisual(text);
        return resolve();
      }
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 1.05;
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve();
      };
      const t = setTimeout(fin, 2500 + text.length * 110);
      u.onend = fin;
      u.onerror = fin;
      try {
        synth.speak(u);
      } catch (_) {
        fin();
      }
    });
  };
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', () => V.onVoices && V.onVoices());

  // =================================================== NHẬN DẠNG: WEB SPEECH API
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  V.webSupported = !!SR;
  const onDevice = {}; // lang -> true nếu trình duyệt có gói nhận dạng ngay trên máy (Chrome 139+)
  async function probeOnDevice(lang) {
    if (lang in onDevice || !SR || typeof SR.available !== 'function') return;
    onDevice[lang] = false;
    try {
      onDevice[lang] = (await SR.available({ langs: [lang], processLocally: true })) === 'available';
    } catch (_) {
      /* API cũ / chưa hỗ trợ */
    }
  }

  function webListen(lang, h, ctrl) {
    return new Promise((resolve, reject) => {
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      if (onDevice[lang]) {
        try {
          rec.processLocally = true;
        } catch (_) {
          /* ignore */
        }
      }
      let finalText = '', interim = '', err = null, heard = false, aborted = false, silenceT = 0;
      const stop = () => {
        try {
          rec.stop();
        } catch (_) {
          /* ignore */
        }
      };
      const noSpeechT = setTimeout(() => !heard && stop(), NO_SPEECH_MS);
      rec.onresult = (e) => {
        if (aborted) return; // kết quả đến trễ sau khi đã huỷ
        heard = true;
        finalText = '';
        interim = '';
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        h.onInterim((finalText + interim).replace(/\s+/g, ' ').trim(), !!interim);
        clearTimeout(silenceT);
        silenceT = setTimeout(stop, SILENCE_MS);
      };
      rec.onspeechstart = () => {
        heard = true;
        h.onSpeech && h.onSpeech();
      };
      rec.onerror = (e) => (err = e.error);
      rec.onend = () => {
        clearTimeout(silenceT);
        clearTimeout(noSpeechT);
        if (aborted) return resolve(null);
        if (err && err !== 'no-speech' && err !== 'aborted') return reject(Object.assign(new Error(err), { code: err }));
        resolve((finalText + interim).replace(/\s+/g, ' ').trim());
      };
      ctrl.stop = stop;
      ctrl.abort = () => {
        aborted = true;
        try {
          rec.abort();
        } catch (_) {
          resolve(null);
        }
      };
      try {
        rec.start();
      } catch (e) {
        reject(Object.assign(e, { code: 'start-failed' }));
      }
    });
  }

  // ============================================ NHẬN DẠNG OFFLINE: MOONSHINE + SILERO VAD
  // Chạy trong Web Worker (module, tạo từ Blob) để không làm đơ giao diện khi nhận dạng.
  const WORKER_SRC = `
import { AutoModel, pipeline, Tensor, env } from '${TF_URL}';
env.allowLocalModels = false;
const SR = 16000, FRAME = 512, ON = 0.5, OFF = 0.35, PRE = 6, MAX_FRAMES = Math.round(25 * SR / FRAME), MIN_SPEECH = 8;
let vad = null, asr = null, asrId = '', srT = null, state = null;
let sid = 0, active = false, rec = false, buf = [], pre = [], sil = 0, speech = 0, rest = new Float32Array(0), minSil = 38;
let chain = Promise.resolve();
const cat = (arr) => { let n = 0; for (const a of arr) n += a.length; const o = new Float32Array(n); let i = 0; for (const a of arr) { o.set(a, i); i += a.length; } return o; };
const reset = () => { state = new Tensor('float32', new Float32Array(256), [2, 1, 128]); rec = false; buf = []; pre = []; sil = 0; speech = 0; rest = new Float32Array(0); };
self.onmessage = (e) => { const m = e.data; if (m.type === 'abort') { active = false; } chain = chain.then(() => handle(m)).catch((err) => self.postMessage({ type: 'error', message: String((err && err.message) || err) })); };
async function handle(m) {
  if (m.type === 'load') {
    const progress_callback = (p) => self.postMessage({ type: 'progress', p: { status: p.status, file: p.file, loaded: p.loaded, total: p.total } });
    if (!vad) vad = await AutoModel.from_pretrained(m.vad, { config: { model_type: 'custom' }, dtype: 'fp32', progress_callback });
    if (asrId !== m.asr) { asr = await pipeline('automatic-speech-recognition', m.asr, { dtype: 'q8', device: 'wasm', progress_callback }); asrId = m.asr; }
    srT = new Tensor('int64', BigInt64Array.from([16000n]), []);
    reset();
    self.postMessage({ type: 'ready' });
  } else if (m.type === 'start') { reset(); sid = m.sid; minSil = Math.max(8, Math.round(m.silenceMs / 32)); active = true; }
  else if (m.type === 'abort') { active = false; reset(); }
  else if (m.type === 'stop') { if (active && rec && speech >= MIN_SPEECH) await finish(); else { active = false; reset(); self.postMessage({ type: 'text', sid, text: '' }); } }
  else if (m.type === 'audio' && active) {
    const data = cat([rest, m.pcm]);
    let i = 0;
    for (; i + FRAME <= data.length && active; i += FRAME) await step(data.slice(i, i + FRAME));
    rest = active ? data.slice(i) : new Float32Array(0);
  }
}
async function step(f) {
  const out = await vad({ input: new Tensor('float32', f, [1, FRAME]), sr: srT, state });
  state = out.stateN;
  const p = out.output.data[0];
  if (!rec) {
    pre.push(f); if (pre.length > PRE) pre.shift();
    if (p >= ON) { rec = true; buf = pre; pre = []; sil = 0; speech = 1; self.postMessage({ type: 'speech', sid }); }
    return;
  }
  buf.push(f);
  if (p < OFF) sil++; else { sil = 0; speech++; }
  if (sil >= minSil || buf.length >= MAX_FRAMES) await finish();
}
async function finish() {
  const frames = buf.slice(0, buf.length - Math.max(0, sil - 5));
  const enough = speech >= MIN_SPEECH;
  rec = false; buf = []; sil = 0; speech = 0;
  if (!enough) { self.postMessage({ type: 'discard', sid }); return; }
  active = false;
  self.postMessage({ type: 'transcribing', sid });
  const audio = cat(frames);
  const r = await asr(audio, { max_new_tokens: Math.ceil(audio.length / SR * 13) + 10 });
  self.postMessage({ type: 'text', sid, text: String((r && r.text) || '').trim() });
}
`;
  const WORKLET_SRC = `
class DEMic extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) { for (let i = 0; i < ch.length; i++) { this.b[this.n++] = ch[i]; if (this.n === this.b.length) { this.port.postMessage(this.b.slice(0)); this.n = 0; } } }
    return true;
  }
}
registerProcessor('de-mic', DEMic);
`;
  const local = { worker: null, ready: '', loading: null, onmsg: null, sid: 0 };
  V.localSupported = typeof Worker !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof WebAssembly !== 'undefined';

  function ensureWorker() {
    if (local.worker) return local.worker;
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    local.worker = new Worker(url, { type: 'module' });
    local.worker.onmessage = (e) => local.onmsg && local.onmsg(e.data);
    local.worker.onerror = (e) => local.onmsg && local.onmsg({ type: 'error', message: e.message || 'Không chạy được bộ nhận dạng offline' });
    return local.worker;
  }

  /** Mô hình offline đã nằm trong bộ nhớ đệm của trình duyệt chưa */
  V.localCached = async function (lang) {
    const id = ASR_MODELS[(lang || cfg().lang).slice(0, 2)] || ASR_MODELS.vi;
    try {
      for (const name of await caches.keys()) {
        const c = await caches.open(name);
        if ((await c.keys()).some((r) => r.url.includes(id))) return true;
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  };

  /** Tải (hoặc nạp từ cache) mô hình offline. onProgress(0..1) */
  V.loadLocal = function (onProgress) {
    const id = ASR_MODELS[lang2()] || ASR_MODELS.vi;
    if (local.ready === id) return Promise.resolve(true);
    if (local.loading) return local.loading;
    const files = {};
    local.loading = new Promise((resolve, reject) => {
      let w;
      try {
        w = ensureWorker();
      } catch (e) {
        return reject(e);
      }
      local.onmsg = (m) => {
        if (m.type === 'progress' && m.p && m.p.file && m.p.total) {
          files[m.p.file] = [m.p.loaded || 0, m.p.total];
          const all = Object.values(files);
          onProgress && onProgress(all.reduce((s, f) => s + f[0], 0) / all.reduce((s, f) => s + f[1], 0));
        } else if (m.type === 'ready') {
          local.ready = id;
          resolve(true);
        } else if (m.type === 'error') reject(new Error(m.message));
      };
      w.postMessage({ type: 'load', asr: id, vad: VAD_MODEL });
    }).finally(() => {
      local.loading = null;
      local.onmsg = null;
    });
    return local.loading;
  };

  /** Bộ hạ tần số mẫu (trung bình theo cửa sổ) → 16 kHz, giữ trạng thái giữa các khối */
  function makeResampler(inRate) {
    const ratio = inRate / 16000;
    let carry = new Float32Array(0), pos = 0;
    return (input) => {
      const data = new Float32Array(carry.length + input.length);
      data.set(carry);
      data.set(input, carry.length);
      const out = [];
      while (pos + ratio <= data.length) {
        const a = Math.floor(pos), b = Math.max(a + 1, Math.floor(pos + ratio));
        let s = 0;
        for (let i = a; i < b; i++) s += data[i];
        out.push(s / (b - a));
        pos += ratio;
      }
      const keep = Math.floor(pos);
      carry = data.slice(keep);
      pos -= keep;
      return Float32Array.from(out);
    };
  }

  async function openMic(onPcm, onLevel) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const AC = window.AudioContext || window.webkitAudioContext;
    // Ưu tiên để trình duyệt tự hạ tần số mẫu xuống 16 kHz (chất lượng tốt hơn); Firefox không cho nối
    // micro vào AudioContext khác tần số → dùng tần số mặc định + bộ hạ tần số tự viết.
    let ctx, src;
    try {
      ctx = new AC({ sampleRate: 16000 });
      src = ctx.createMediaStreamSource(stream);
    } catch (_) {
      if (ctx) ctx.close().catch(() => {});
      ctx = new AC();
      src = ctx.createMediaStreamSource(stream);
    }
    try {
      await ctx.resume();
    } catch (_) {
      /* ignore */
    }
    const rs = makeResampler(ctx.sampleRate);
    const handle = (x) => {
      let e = 0;
      for (let i = 0; i < x.length; i += 4) e += x[i] * x[i];
      onLevel && onLevel(Math.min(1, Math.sqrt(e / (x.length / 4)) * 8));
      const y = rs(x);
      if (y.length) onPcm(y);
    };
    let node;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, 'de-mic');
      node.port.onmessage = (e) => handle(e.data);
    } catch (_) {
      node = ctx.createScriptProcessor(2048, 1, 1); // trình duyệt / ngữ cảnh không có AudioWorklet
      node.onaudioprocess = (e) => handle(e.inputBuffer.getChannelData(0).slice(0));
    }
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    let closed = false;
    return {
      close() {
        if (closed) return;
        closed = true;
        try {
          src.disconnect();
          node.disconnect();
        } catch (_) {
          /* ignore */
        }
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      },
    };
  }

  function localListen(h, ctrl) {
    return new Promise((resolve, reject) => {
      const w = local.worker;
      const sid = ++local.sid;
      let mic = null, settled = false, heard = false, noSpeechT = 0;
      const done = (v, err) => {
        if (settled) return;
        settled = true;
        clearTimeout(noSpeechT);
        if (mic) mic.close();
        local.onmsg = null;
        err ? reject(err) : resolve(v);
      };
      local.onmsg = (m) => {
        if (m.sid != null && m.sid !== sid) return; // thông báo trễ của lần nghe trước
        if (m.type === 'speech') {
          heard = true;
          h.onSpeech && h.onSpeech();
        } else if (m.type === 'transcribing') {
          if (mic) mic.close();
          h.onStatus && h.onStatus('transcribing');
        } else if (m.type === 'text') done(m.text);
        else if (m.type === 'error') done(null, new Error(m.message));
      };
      ctrl.stop = () => {
        if (mic) mic.close();
        w.postMessage({ type: 'stop' });
      };
      ctrl.abort = () => {
        w.postMessage({ type: 'abort' });
        done(null);
      };
      w.postMessage({ type: 'start', sid, silenceMs: SILENCE_MS });
      openMic((pcm) => !settled && w.postMessage({ type: 'audio', pcm }, [pcm.buffer]), h.onLevel)
        .then((m) => {
          if (settled) return m.close();
          mic = m;
          noSpeechT = setTimeout(() => {
            if (heard) return;
            w.postMessage({ type: 'abort' });
            done('');
          }, NO_SPEECH_MS);
        })
        .catch((e) => {
          w.postMessage({ type: 'abort' });
          done(null, Object.assign(e, { code: e.name === 'NotAllowedError' ? 'not-allowed' : e.name === 'NotFoundError' ? 'audio-capture' : 'mic' }));
        });
    });
  }

  // ================================================================ ĐIỀU KHIỂN
  let H = null; // hooks từ ui.js
  let session = null; // { ctrl, kind }
  let handsFree = false, hfLastHeard = 0, opDepth = 0, confirmAsked = false, confirmTries = 0, undoTipSaid = false, draft = null;
  const $ = (q) => document.querySelector(q);

  V.isListening = () => !!session;
  V.isHandsFree = () => handsFree;

  function setMic(state, title) {
    const b = $('#ai-mic');
    if (!b) return;
    b.classList.remove('listening', 'loading', 'processing');
    if (state) b.classList.add(state);
    b.setAttribute('aria-pressed', String(state === 'listening'));
    b.title = title || (state === 'listening' ? 'Đang nghe – bấm để dừng (Ctrl+M) · Esc để huỷ' : 'Nói với AI (Ctrl+M) · chuột phải: cài đặt giọng nói');
    if (state !== 'listening') b.style.removeProperty('--lvl');
  }
  function setStatus(text, kind = '') {
    const el = $('#ai-voice');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.className = 'ai-voice' + (kind ? ' ' + kind : '');
    $('#ai-voice-text').textContent = text;
  }
  function idleStatus() {
    setMic('');
    setStatus(handsFree ? 'Rảnh tay đang bật – cứ nói, app tự nghe (Ctrl+Shift+M để tắt)' : '', handsFree ? 'hf' : '');
  }
  function renderHF() {
    const b = $('#ai-handsfree');
    if (!b) return;
    b.setAttribute('aria-pressed', String(handsFree));
    b.classList.toggle('on', handsFree);
    b.title = handsFree ? 'Rảnh tay đang bật – bấm để tắt (Ctrl+Shift+M)' : 'Rảnh tay: nói liên tục, AI đáp bằng giọng nói (Ctrl+Shift+M)';
  }

  const ta = () => $('#ai-prompt');
  function setPrompt(text, interim) {
    const t = ta();
    if (!t) return;
    t.value = text;
    t.classList.toggle('interim', !!interim);
    t.dispatchEvent(new Event('input'));
  }
  function restoreDraft() {
    if (draft != null) setPrompt(draft, false);
    draft = null;
  }

  async function resolveEngine() {
    const c = cfg();
    let e = c.engine;
    if (e === 'auto') e = V.webSupported ? 'web' : 'local';
    if (e === 'web' && !V.webSupported) {
      H.toast('Trình duyệt này không có Web Speech API – dùng bộ nhận dạng offline', 'info');
      e = 'local';
    }
    if (e === 'web') {
      await probeOnDevice(c.lang);
      return 'web';
    }
    if (!V.localSupported) {
      H.toast('Trình duyệt này không hỗ trợ nhận dạng giọng nói (thiếu micro / Web Worker / WebAssembly)', 'error');
      return null;
    }
    if (local.ready === (ASR_MODELS[lang2()] || ASR_MODELS.vi)) return 'local';
    if (!(await V.localCached())) {
      const ok = await H.confirm({
        title: 'Tải bộ nhận dạng giọng nói offline?',
        message:
          (V.webSupported ? '' : 'Trình duyệt này không có nhận dạng giọng nói sẵn. ') +
          'Có thể tải mô hình Moonshine (khoảng 45 MB, chỉ tải một lần) để nhận dạng ngay trên máy – âm thanh không rời khỏi máy của bạn.\n\nMô hình tải từ Hugging Face và jsDelivr.',
        ok: 'Tải về',
        cancel: 'Để sau',
      });
      if (!ok) return null;
    }
    setMic('loading', 'Đang tải mô hình giọng nói…');
    setStatus('Đang chuẩn bị bộ nhận dạng offline…', 'load');
    try {
      await V.loadLocal((p) => setStatus(`Đang tải mô hình giọng nói… ${Math.round(p * 100)}%`, 'load'));
    } catch (err) {
      idleStatus();
      H.toast('Không tải được bộ nhận dạng offline: ' + err.message, 'error');
      return null;
    }
    return 'local';
  }

  const ERR = {
    'not-allowed': 'Trình duyệt chưa cho phép dùng micro – bấm biểu tượng 🔒 / micro trên thanh địa chỉ để cho phép.',
    'service-not-allowed': 'Trình duyệt không cho dùng dịch vụ nhận dạng giọng nói. Thử chọn bộ nhận dạng Offline trong Cài đặt giọng nói (chuột phải vào nút micro).',
    'audio-capture': 'Không tìm thấy micro trên máy.',
    network: 'Không kết nối được dịch vụ nhận dạng của trình duyệt (cần mạng). Có thể chuyển sang bộ nhận dạng Offline trong Cài đặt giọng nói (chuột phải vào nút micro).',
    'language-not-supported': 'Trình duyệt không nhận dạng được ngôn ngữ này. Thử bộ nhận dạng Offline trong Cài đặt giọng nói.',
  };

  /** Bắt đầu nghe. kind: 'prompt' (gửi AI / lệnh) | 'confirm' (trả lời hộp xác nhận) */
  async function listen(kind = 'prompt') {
    if (session || !H) return;
    const box = $('#ai-chat');
    if (box && box.hidden && $('#ai-chat-pill')) $('#ai-chat-pill').click(); // khung chat đang thu nhỏ → mở ra
    session = { ctrl: {}, kind, pending: true };
    const engine = await resolveEngine();
    if (!engine || !session) {
      session = null;
      if (handsFree) setHandsFree(false, true);
      return idleStatus();
    }
    V.stopSpeaking();
    const ctrl = session.ctrl;
    session.pending = false;
    if (kind === 'prompt') draft = ta() ? ta().value : '';
    setMic('listening');
    setStatus(kind === 'confirm' ? 'Đang nghe: nói “đồng ý” hoặc “huỷ”…' : handsFree ? 'Rảnh tay · đang nghe… (Esc: tạm dừng)' : 'Đang nghe… nói xong app tự gửi · Esc để huỷ', 'rec');
    const handlers = {
      onInterim: (t, interim) => {
        if (kind === 'prompt') setPrompt(t, interim);
        else setStatus('Nghe được: ' + t, 'rec');
      },
      onSpeech: () => (hfLastHeard = Date.now()),
      onLevel: (l) => {
        const b = $('#ai-mic');
        b && b.style.setProperty('--lvl', l.toFixed(2));
      },
      onStatus: (s) => {
        if (s === 'transcribing') {
          setMic('processing', 'Đang nhận dạng…');
          setStatus('Đang nhận dạng…', 'load');
        }
      },
    };
    let text;
    try {
      text = engine === 'web' ? await webListen(cfg().lang, handlers, ctrl) : await localListen(handlers, ctrl);
    } catch (e) {
      session = null;
      restoreDraft();
      idleStatus();
      const msg = ERR[e.code] || 'Lỗi nhận dạng giọng nói: ' + (e.message || e.code);
      H.toast(msg, 'error');
      if (handsFree) setHandsFree(false, true);
      return;
    }
    session = null;
    const t = ta();
    t && t.classList.remove('interim');
    if (text == null) {
      // huỷ (Esc / bấm dừng)
      restoreDraft();
      return idleStatus();
    }
    if (!text) {
      restoreDraft();
      idleStatus();
      if (kind === 'confirm') return confirmRetry();
      if (handsFree) {
        if (Date.now() - hfLastHeard > HANDSFREE_IDLE_MS) {
          setHandsFree(false, true);
          return V.speak(phrase('hfIdle'));
        }
        return setTimeout(() => handsFree && listen('prompt'), 150);
      }
      return H.toast('Không nghe thấy gì – thử nói lại gần micro hơn', 'info');
    }
    hfLastHeard = Date.now();
    idleStatus();
    await handleUtterance(text, kind);
  }

  async function handleUtterance(text, kind) {
    if (kind === 'confirm') return handleConfirm(text);
    if (cfg().commands) {
      const cmd = V.matchCommand(text);
      if (cmd) {
        restoreDraft();
        await runVoiceOp(() => runCommand(cmd));
        return next();
      }
    }
    // câu còn lại → prompt cho AI, gửi ngay
    draft = null;
    setPrompt(text, false);
    if (H.busy()) {
      await V.speak(phrase('busy'));
      return next();
    }
    if (!H.hasKey()) {
      V.speak(phrase('nokey'));
      H.send(text); // mở form API key như khi bấm Gửi
      if (handsFree) setHandsFree(false, true);
      return;
    }
    V.speak(phrase('ack')); // phản hồi ngay khi gửi
    const out = await runVoiceOp(() => H.send(text));
    await V.speak(outcomePhrase(out));
    next();
  }

  function outcomePhrase(out) {
    if (!out) return '';
    switch (out.status) {
      case 'applied': {
        let p = phrase('done');
        if (!undoTipSaid) {
          p += phrase('undoTip');
          undoTipSaid = true;
        }
        return p;
      }
      case 'text': {
        const plain = String(out.text || '')
          .replace(/```[\s\S]*?```/g, ' ')
          .replace(/[*_#>`|]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return plain && plain.length <= 240 ? plain : phrase('replied');
      }
      case 'aborted':
        return phrase('aborted');
      case 'cancelled':
        return confirmAsked ? '' : phrase('cancelled');
      case 'error':
        return phrase('error');
      default:
        return '';
    }
  }

  function next() {
    if (handsFree) setTimeout(() => handsFree && !session && listen('prompt'), 250);
  }

  // ------- hộp xác nhận xuất hiện trong lúc chạy thao tác bằng giọng nói → hỏi & nghe “đồng ý / huỷ”
  let confirmObs = null;
  async function runVoiceOp(fn) {
    opDepth++;
    confirmAsked = false;
    if (!confirmObs) {
      confirmObs = new MutationObserver(() => {
        if (opDepth > 0 && !confirmAsked && document.querySelector('.confirm-backdrop')) {
          confirmAsked = true;
          confirmTries = 0;
          V.speak(phrase('confirm')).then(() => document.querySelector('.confirm-backdrop') && listen('confirm'));
        }
      });
      confirmObs.observe(document.body, { childList: true });
    }
    try {
      return await fn();
    } finally {
      opDepth--;
    }
  }
  function handleConfirm(text) {
    const back = document.querySelector('.confirm-backdrop');
    if (!back) return;
    const yn = V.matchYesNo(text);
    if (yn === true) {
      V.speak(phrase('yes'));
      back.querySelector('[data-r="ok"]').click();
    } else if (yn === false) {
      V.speak(phrase('no'));
      back.querySelector('[data-r="cancel"]').click();
    } else confirmRetry();
  }
  function confirmRetry() {
    if (!document.querySelector('.confirm-backdrop')) return;
    if (++confirmTries >= 2) return H.toast('Hãy bấm nút trên hộp thoại để trả lời', 'info');
    V.speak(phrase('confirmAgain')).then(() => document.querySelector('.confirm-backdrop') && listen('confirm'));
  }

  async function runCommand(cmd) {
    const L = lang2() === 'en' ? 1 : 0;
    const def = V.COMMANDS.find((c) => c.id === cmd.id);
    let say = def ? def.ack[L] : '';
    switch (cmd.id) {
      case 'undo':
        if (!H.canUndo()) say = phrase('nothingToUndo');
        else H.action('undo');
        break;
      case 'redo':
        if (!H.canRedo()) say = phrase('nothingToRedo');
        else H.action('redo');
        break;
      case 'delete':
        if (!H.selectionCount()) say = phrase('nothingSelected');
        else H.action('delete');
        break;
      case 'select-all':
        H.selectAll();
        break;
      case 'deselect':
        H.deselect();
        break;
      case 'grid':
        H.grid(cmd.arg);
        break;
      case 'dark':
      case 'light':
        H.theme(cmd.id);
        break;
      case 'help':
        H.help();
        break;
      case 'new-chat':
        H.chatReset();
        break;
      case 'handsfree-on':
        if (!handsFree) setHandsFree(true);
        return;
      case 'handsfree-off':
        setHandsFree(false);
        return;
      case 'stop':
        if (H.busy()) H.abortChat();
        else if (handsFree) {
          setHandsFree(false);
          return;
        } else say = phrase('idle');
        break;
      case 'voice-settings':
        V.settingsDialog();
        return;
      case 'mode':
        await H.requestMode(cmd.arg);
        if (confirmAsked) return; // đã trả lời qua hộp xác nhận
        break;
      case 'new':
        await H.action('new');
        if (confirmAsked) return;
        break;
      default:
        await H.action(cmd.id);
    }
    H.toast('🎙 ' + (def ? def.label : cmd.id), 'ok');
    await V.speak(say);
  }

  function setHandsFree(on, quiet) {
    handsFree = !!on;
    renderHF();
    if (handsFree) {
      hfLastHeard = Date.now();
      idleStatus();
      const go = () => handsFree && !session && listen('prompt');
      quiet ? go() : V.speak(phrase('hfOn')).then(go);
    } else {
      if (session && session.ctrl.abort) session.ctrl.abort();
      idleStatus();
      if (!quiet) V.speak(phrase('hfOff'));
    }
  }

  /** Nút micro / Ctrl+M: đang nghe thì dừng (lấy phần đã nói), chưa nghe thì bắt đầu */
  V.toggle = function () {
    if (session) {
      if (session.pending) return;
      if (handsFree) return setHandsFree(false, true);
      return session.ctrl.stop && session.ctrl.stop();
    }
    listen('prompt');
  };
  V.cancel = function () {
    if (session && session.pending) session = null; // đang chuẩn bị (tải mô hình / hỏi) → bỏ
    else if (session && session.ctrl.abort) session.ctrl.abort();
    if (handsFree) setHandsFree(false, true);
  };
  V.toggleHandsFree = () => setHandsFree(!handsFree);

  // ================================================================ CÀI ĐẶT
  V.settingsDialog = function () {
    const c = cfg();
    const esc = DE.esc;
    const opts = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const cmdRows = V.COMMANDS.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.say.map((s) => '“' + esc(s) + '”').join(', ')}</td></tr>`).join('');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      `<div class="modal ai-modal voice-modal" role="dialog" aria-modal="true" aria-labelledby="voice-title">` +
      `<h3 id="voice-title">Cài đặt giọng nói</h3>` +
      `<label class="f"><span>Bộ nhận dạng</span><select id="v-engine">${opts(V.ENGINES, c.engine)}</select></label>` +
      `<div id="v-engine-info" class="msg v-info"></div>` +
      `<label class="f"><span>Ngôn ngữ</span><select id="v-lang">${opts(V.LANGS, c.lang)}</select></label>` +
      `<label class="chk"><input type="checkbox" id="v-commands"${c.commands ? ' checked' : ''}> Lệnh giọng nói (câu ngắn như “hoàn tác”, “vừa màn hình” chạy ngay, không gửi AI)</label>` +
      `<details class="v-cmds"><summary>Danh sách lệnh</summary><table class="keys">${cmdRows}</table></details>` +
      `<label class="chk"><input type="checkbox" id="v-speak"${c.speak ? ' checked' : ''}> Phản hồi bằng giọng nói (“${esc(phrase('ack'))}”)</label>` +
      `<div class="v-row"><label class="f"><span>Xưng hô</span><select id="v-persona">${opts(V.PERSONAS, c.persona)}</select></label>` +
      `<label class="f"><span>Giọng đọc</span><select id="v-voice"></select></label>` +
      `<button type="button" class="btn" data-r="test" title="Nghe thử">▶ Nghe thử</button></div>` +
      `<div id="v-voice-info" class="msg"></div>` +
      `<p class="hint">Phím tắt: <b>Ctrl+M</b> nói một câu · <b>Ctrl+Shift+M</b> bật / tắt rảnh tay · <b>Esc</b> huỷ khi đang nghe.</p>` +
      `<div class="modal-actions"><button class="btn" data-r="cancel">Huỷ</button><button class="btn primary" data-r="apply">Áp dụng</button></div></div>`;
    const q = (s) => back.querySelector(s);
    const draftCfg = () => ({
      engine: q('#v-engine').value,
      lang: q('#v-lang').value,
      commands: q('#v-commands').checked,
      speak: q('#v-speak').checked,
      persona: q('#v-persona').value,
      voice: q('#v-voice').value,
    });
    async function renderEngineInfo() {
      const e = q('#v-engine').value, lang = q('#v-lang').value;
      const lines = [];
      lines.push(V.webSupported ? '✓ Trình duyệt có Web Speech API – nhanh, chữ hiện ngay khi nói (Chrome / Edge gửi âm thanh tới máy chủ nhận dạng của hãng, cần mạng).' : '✗ Trình duyệt này không có Web Speech API (vd. Firefox) – dùng bộ nhận dạng offline.');
      const cached = await V.localCached(lang);
      lines.push(
        (cached ? '✓ Mô hình offline đã tải' : '○ Mô hình offline chưa tải (~45 MB, tải khi dùng lần đầu)') +
          ' – Moonshine chạy ngay trên máy, âm thanh không rời khỏi máy.'
      );
      if (e === 'auto') lines.push('→ Tự động: dùng ' + (V.webSupported ? 'Web Speech API.' : 'bộ nhận dạng offline.'));
      q('#v-engine-info').textContent = lines.join('\n');
    }
    function renderVoices() {
      const lang = q('#v-lang').value, sel = q('#v-voice'), list = V.voicesFor(lang);
      const cur = cfg().voice;
      sel.innerHTML = list.length
        ? list.map((v) => `<option value="${esc(v.voiceURI)}"${v.voiceURI === cur ? ' selected' : ''}>${esc(v.name)}</option>`).join('')
        : '<option value="">(máy chưa có giọng phù hợp)</option>';
      const info = q('#v-voice-info');
      if (!V.ttsSupported) info.textContent = 'Trình duyệt không hỗ trợ đọc thành tiếng – phản hồi sẽ hiện thành chữ.';
      else if (!list.length)
        info.textContent =
          lang === 'vi-VN'
            ? 'Máy chưa có giọng đọc tiếng Việt – phản hồi sẽ hiện thành chữ. Cài thêm: Windows → Cài đặt → Thời gian & ngôn ngữ → Giọng nói → Thêm giọng → Tiếng Việt; hoặc mở app bằng Microsoft Edge (có sẵn giọng HoaiMy / NamMinh).'
            : 'No voice for this language – feedback will be shown as text.';
      else info.textContent = '';
    }
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      V.onVoices = null;
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
      if (e.target.id === 'v-lang') {
        renderVoices();
        renderEngineInfo();
      } else if (e.target.id === 'v-engine') renderEngineInfo();
    });
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if ((b && b.dataset.r === 'cancel') || e.target === back) return close();
      if (!b) return;
      if (b.dataset.r === 'test') {
        const keep = cfg();
        V.save(Object.assign({}, keep, draftCfg()));
        V.stopSpeaking();
        V.speak(phrase('test'), { force: true });
        V.save(keep);
      } else if (b.dataset.r === 'apply') {
        V.save(Object.assign(cfg(), draftCfg()));
        close();
        H && H.toast('Đã lưu cài đặt giọng nói', 'ok');
      }
    });
    V.onVoices = renderVoices;
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(back);
    renderVoices();
    renderEngineInfo();
    q('#v-engine').focus();
  };

  // ================================================================== INIT
  V.init = function (hooks) {
    H = hooks;
    showVisual = (t) => H.toast('🗣 ' + t, 'info');
    setMic('');
    renderHF();
    const mic = $('#ai-mic');
    if (mic) {
      if (!V.webSupported && !V.localSupported) {
        mic.disabled = true;
        mic.title = 'Trình duyệt này không hỗ trợ nhập bằng giọng nói';
      }
      mic.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        V.settingsDialog();
      });
    }
    // Ctrl+M / Ctrl+Shift+M / Esc – bắt ở pha capture để dùng được cả khi đang gõ trong ô chat
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && (session || handsFree) && !document.querySelector('.modal-backdrop')) {
          e.preventDefault();
          e.stopPropagation();
          return V.cancel();
        }
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.code !== 'KeyM') return;
        const modal = document.querySelector('.modal-backdrop');
        if (modal && !modal.classList.contains('confirm-backdrop')) return; // form cài đặt đang mở
        e.preventDefault();
        e.stopPropagation();
        if (modal) return listen('confirm');
        if (e.shiftKey) V.toggleHandsFree();
        else V.toggle();
      },
      true
    );
  };
})();
