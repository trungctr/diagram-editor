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

  async function httpError(res) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.error && (j.error.message || j.error.type)) || j.message || '';
    } catch (_) {
      /* không có body JSON */
    }
    const e = new Error(
      res.status === 400 || res.status === 401 || res.status === 403
        ? 'API key không hợp lệ hoặc không có quyền truy cập' + (detail ? ` (${detail})` : '')
        : `Lỗi ${res.status}` + (detail ? `: ${detail}` : '')
    );
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
  };
})(window.DE);
