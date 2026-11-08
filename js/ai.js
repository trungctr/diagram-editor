/* =========================================================================
 * Cấu hình AI: nhà cung cấp, API key, mô hình.
 * - Lưu trong localStorage của trình duyệt này; key chỉ gửi trực tiếp tới nhà
 *   cung cấp đã chọn (không qua máy chủ trung gian).
 * - Danh sách mô hình lấy trực tiếp từ API của nhà cung cấp bằng key của người
 *   dùng (luôn mới nhất, đúng quyền của tài khoản); SUGGESTED chỉ là gợi ý khi
 *   chưa tải được.
 * ========================================================================= */
(function (DE) {
  'use strict';
  const KEY = 'diagram-editor:ai';

  const PROVIDERS = {
    gemini: {
      name: 'Google Gemini',
      keyUrl: 'https://aistudio.google.com/apikey',
      keyHint: 'AIza…',
      suggested: ['gemini-3.5-flash', 'gemini-3.1-pro-preview'],
      async listModels(key) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`);
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        return (data.models || [])
          .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name))
          .filter((m) => !/(embedding|tts|image|live|native-audio|aqa)/i.test(m.name))
          .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }));
      },
    },
    openai: {
      name: 'OpenAI',
      keyUrl: 'https://platform.openai.com/api-keys',
      keyHint: 'sk-…',
      suggested: ['gpt-5.5', 'gpt-5.4-mini'],
      async listModels(key) {
        const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        return (data.data || [])
          .filter((m) => /^(gpt-|o\d|chatgpt)/i.test(m.id) && !/(embed|whisper|tts|dall-e|audio|realtime|image|moderation|transcribe|search|instruct)/i.test(m.id))
          .sort((a, b) => (b.created || 0) - (a.created || 0))
          .map((m) => ({ id: m.id, label: m.id }));
      },
    },
    anthropic: {
      name: 'Anthropic Claude',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyHint: 'sk-ant-…',
      suggested: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
      async listModels(key) {
        const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        });
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        return (data.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
      },
    },
  };

  // ------------------------------------------------------------ gọi chat
  // messages: [{ role: 'user' | 'assistant', content: string }]
  // system: skill prompt – đặt ở system instruction (một lần cho cả hội thoại),
  //         KHÔNG chép vào từng tin nhắn; bật cache để không bị tính phí lại đầy đủ.
  // Trả về { text, truncated }
  const CHAT = {
    async gemini({ key, model, system, messages, signal }) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        }),
      });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      if (data.promptFeedback && data.promptFeedback.blockReason) throw new Error(`Gemini từ chối yêu cầu (${data.promptFeedback.blockReason})`);
      const cand = (data.candidates || [])[0];
      if (!cand) throw new Error('Gemini không trả về kết quả');
      const text = ((cand.content && cand.content.parts) || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
      return { text, truncated: cand.finishReason === 'MAX_TOKENS' };
    },
    async openai({ key, model, system, messages, signal }) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages] }),
      });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      const ch = (data.choices || [])[0];
      if (!ch) throw new Error('OpenAI không trả về kết quả');
      if (ch.message && ch.message.refusal) throw new Error('OpenAI từ chối yêu cầu: ' + ch.message.refusal);
      return { text: (ch.message && ch.message.content) || '', truncated: ch.finish_reason === 'length' };
    },
    async anthropic({ key, model, system, messages, signal }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 16000,
          // skill là phần cố định đầu request -> cache lại, các lượt sau chỉ tính phí đọc cache
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages,
        }),
      });
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      if (data.stop_reason === 'refusal') {
        const why = data.stop_details && (data.stop_details.explanation || data.stop_details.category);
        throw new Error('Claude từ chối yêu cầu' + (why ? `: ${why}` : ''));
      }
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { text, truncated: data.stop_reason === 'max_tokens' };
    },
  };

  async function httpError(res) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && (j.error.message || j.error.type)) || j.message || '';
    } catch (_) {
      /* không có body JSON */
    }
    const msg =
      res.status === 401 || res.status === 403
        ? 'API key không hợp lệ hoặc không có quyền truy cập'
        : res.status === 404
          ? 'Không tìm thấy mô hình (kiểm tra lại tên mô hình trong Cài đặt AI)'
          : res.status === 429
            ? 'Vượt giới hạn tốc độ / hạn mức của tài khoản – thử lại sau ít phút'
            : res.status >= 500
              ? 'Máy chủ của nhà cung cấp đang lỗi hoặc quá tải – thử lại sau'
              : `Lỗi ${res.status}`;
    const e = new Error(msg + (detail ? ` (${detail})` : ''));
    e.status = res.status;
    return e;
  }

  /** Che bớt API key: chỉ hiện 4 ký tự đầu và 4 ký tự cuối */
  const mask = (k) => {
    if (!k) return '';
    if (k.length <= 12) return '•'.repeat(8);
    return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
  };

  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && typeof c === 'object') return { provider: PROVIDERS[c.provider] ? c.provider : 'gemini', keys: c.keys || {}, models: c.models || {} };
    } catch (_) {
      /* cấu hình hỏng -> mặc định */
    }
    return { provider: 'gemini', keys: {}, models: {} };
  }
  function save(cfg) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
      return true;
    } catch (_) {
      return false;
    }
  }

  DE.ai = {
    PROVIDERS,
    mask,
    load,
    save,
    /** Cấu hình đang dùng cho chat: { provider, providerName, key, model } hoặc null nếu chưa đủ */
    active() {
      const c = load();
      const key = c.keys[c.provider], model = c.models[c.provider];
      return key && model ? { provider: c.provider, providerName: PROVIDERS[c.provider].name, key, model } : null;
    },
    listModels: (provider, key) => PROVIDERS[provider].listModels(key),
    /** Gửi hội thoại tới mô hình đang chọn. opts: { system, messages, signal } */
    chat(opts) {
      const a = this.active();
      if (!a) throw new Error('Chưa cấu hình API key / mô hình');
      return CHAT[a.provider]({ key: a.key, model: a.model, ...opts });
    },
  };
})(window.DE);
