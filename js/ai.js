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
  // Trả về { text, truncated, notes }
  //
  // effort: '' (mặc định của mô hình) | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  // thinking: true (bật / tự động) | false (tắt nếu mô hình cho phép)
  // Mỗi nhà cung cấp – thậm chí mỗi đời mô hình – nhận tham số này khác nhau, nên mỗi lời gọi
  // có danh sách "phương án" từ đầy đủ tới mặc định: gặp lỗi 400 (mô hình không hiểu tham số)
  // thì lùi sang phương án kế tiếp và ghi chú lại cho người dùng.
  const FALLBACK_NOTE = 'Mô hình không nhận cấu hình effort / thinking đã chọn – đã dùng mặc định của mô hình.';

  async function tryVariants(variants, send) {
    let lastErr;
    for (let i = 0; i < variants.length; i++) {
      try {
        const r = await send(variants[i]);
        if (i > 0) r.notes = [...(r.notes || []), variants[i].note || FALLBACK_NOTE];
        return r;
      } catch (e) {
        lastErr = e;
        if (e.name === 'AbortError' || e.status !== 400 || i === variants.length - 1) throw e;
      }
    }
    throw lastErr;
  }

  const GEMINI_LEVEL = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };
  const GEMINI_BUDGET = { low: 1024, medium: 4096, high: 12288, xhigh: 24576, max: 32768 };
  const OPENAI_EFFORT = { low: ['low'], medium: ['medium'], high: ['high'], xhigh: ['xhigh', 'high'], max: ['xhigh', 'high'] };

  const CHAT = {
    async gemini({ key, model, system, messages, signal, effort, thinking }) {
      // Gemini 3.x: thinkingLevel; Gemini 2.5: thinkingBudget (0 = tắt)
      let cfgs = [null];
      if (thinking === false) cfgs = [{ thinkingLevel: 'minimal' }, { thinkingBudget: 0 }, null];
      else if (effort) cfgs = [{ thinkingLevel: GEMINI_LEVEL[effort] }, { thinkingBudget: GEMINI_BUDGET[effort] }, null];
      const variants = cfgs.map((tc, i) => ({ tc, note: i > 0 && tc ? 'Gemini dùng cách cấu hình thinking của đời mô hình cũ hơn.' : undefined }));
      return tryVariants(variants, async ({ tc }) => {
        const body = {
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        };
        if (tc) body.generationConfig = { thinkingConfig: tc };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        if (data.promptFeedback && data.promptFeedback.blockReason) throw new Error(`Gemini từ chối yêu cầu (${data.promptFeedback.blockReason})`);
        const cand = (data.candidates || [])[0];
        if (!cand) throw new Error('Gemini không trả về kết quả');
        const text = ((cand.content && cand.content.parts) || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
        return { text, truncated: cand.finishReason === 'MAX_TOKENS' };
      });
    },

    async openai({ key, model, system, messages, signal, effort, thinking }) {
      // reasoning_effort cho mô hình suy luận; mô hình thường không nhận -> lùi về mặc định
      let efforts = [null];
      if (thinking === false) efforts = ['none', 'minimal', null];
      else if (effort) efforts = [...OPENAI_EFFORT[effort], null];
      const first = efforts[0];
      return tryVariants(
        efforts.map((re) => ({
          re,
          note: re ? `Mô hình không nhận reasoning_effort "${first}" – đã dùng "${re}".` : undefined,
        })),
        async ({ re }) => {
          const body = { model, messages: [{ role: 'system', content: system }, ...messages] };
          if (re) body.reasoning_effort = re;
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal,
            headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw await httpError(res);
          const data = await res.json();
          const ch = (data.choices || [])[0];
          if (!ch) throw new Error('OpenAI không trả về kết quả');
          if (ch.message && ch.message.refusal) throw new Error('OpenAI từ chối yêu cầu: ' + ch.message.refusal);
          return { text: (ch.message && ch.message.content) || '', truncated: ch.finish_reason === 'length' };
        }
      );
    },

    async anthropic({ key, model, system, messages, signal, effort, thinking }) {
      // Theo tài liệu Claude API:
      //  - Opus 5.5 / Fable / Mythos: thinking luôn bật – gửi "disabled" bị 400 -> không gửi gì
      //  - Sonnet 5.5: tắt bằng { type: "between_tools" }, chỉ hợp lệ khi effort ≤ high
      //  - Opus 5 / Haiku 5.5: "disabled" chỉ hợp lệ khi effort ≤ high
      //  - effort nằm trong output_config.effort
      const cap = DE.ai.thinkingCaps('anthropic', model);
      let th = null, eff = effort || null, clamped = false;
      if (thinking === false && cap.canDisable) {
        th = /sonnet-5-5/.test(model) ? { type: 'between_tools' } : { type: 'disabled' };
        if (cap.offMaxHigh && (eff === 'xhigh' || eff === 'max')) {
          eff = 'high';
          clamped = true;
        }
      } else if (thinking !== false) th = { type: 'adaptive' };
      const variants = [{ th, eff }, { th: null, eff }, { th: null, eff: null }];
      const r = await tryVariants(variants, async (v) => {
        const body = {
          model,
          max_tokens: 16000,
          // skill là phần cố định đầu request -> cache lại, các lượt sau chỉ tính phí đọc cache
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages,
        };
        if (v.th) body.thinking = v.th;
        if (v.eff) body.output_config = { effort: v.eff };
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        if (data.stop_reason === 'refusal') {
          const why = data.stop_details && (data.stop_details.explanation || data.stop_details.category);
          throw new Error('Claude từ chối yêu cầu' + (why ? `: ${why}` : ''));
        }
        const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        return { text, truncated: data.stop_reason === 'max_tokens' };
      });
      if (clamped) r.notes = [...(r.notes || []), 'Khi tắt thinking, mô hình này chỉ nhận effort tối đa "cao" – đã dùng mức cao.'];
      if (thinking === false && !cap.canDisable) r.notes = [...(r.notes || []), cap.note];
      return r;
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

  const EFFORTS = ['', 'low', 'medium', 'high', 'xhigh', 'max'];

  function load() {
    const def = { provider: 'gemini', keys: {}, models: {}, lists: {}, effort: '', thinking: true };
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && typeof c === 'object') {
        return {
          provider: PROVIDERS[c.provider] ? c.provider : 'gemini',
          keys: c.keys || {},
          models: c.models || {},
          lists: c.lists || {}, // danh sách mô hình đã tải từ tài khoản (cho dropdown trên khung chat)
          effort: EFFORTS.includes(c.effort) ? c.effort : '',
          thinking: c.thinking !== false,
        };
      }
    } catch (_) {
      /* cấu hình hỏng -> mặc định */
    }
    return def;
  }

  /**
   * Khả năng tắt thinking theo mô hình (theo tài liệu nhà cung cấp).
   * { canDisable, offMaxHigh (chỉ tắt được khi effort ≤ high), note }
   */
  function thinkingCaps(provider, model = '') {
    if (provider === 'anthropic') {
      if (/claude-(opus-5-5|fable|mythos)/.test(model)) {
        return { canDisable: false, note: 'Mô hình này luôn suy luận (không tắt được thinking) – chọn effort thấp để trả lời nhanh hơn.' };
      }
      return { canDisable: true, offMaxHigh: /claude-(sonnet-5-5|opus-5(?!-)|haiku-5-5)/.test(model) };
    }
    return { canDisable: true };
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
    thinkingCaps,
    EFFORTS,
    /** Cấu hình đang dùng cho chat: { provider, providerName, key, model, effort, thinking } hoặc null nếu chưa đủ */
    active() {
      const c = load();
      const key = c.keys[c.provider], model = c.models[c.provider];
      return key && model ? { provider: c.provider, providerName: PROVIDERS[c.provider].name, key, model, effort: c.effort, thinking: c.thinking } : null;
    },
    /** Tải danh sách mô hình từ tài khoản và ghi nhớ (cho dropdown chọn nhanh trên khung chat) */
    async listModels(provider, key) {
      const list = await PROVIDERS[provider].listModels(key);
      const c = load();
      c.lists[provider] = list.map((m) => ({ id: m.id, label: m.label }));
      save(c);
      return list;
    },
    /** Gửi hội thoại tới mô hình đang chọn. opts: { system, messages, signal } */
    chat(opts) {
      const a = this.active();
      if (!a) throw new Error('Chưa cấu hình API key / mô hình');
      return CHAT[a.provider]({ key: a.key, model: a.model, effort: a.effort, thinking: a.thinking, ...opts });
    },
  };
})(window.DE);
