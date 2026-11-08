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
    // ---------------------------------------------------- có gói miễn phí (API kiểu OpenAI, cho phép CORS)
    openrouter: {
      name: 'OpenRouter',
      group: 'free',
      compat: true,
      base: 'https://openrouter.ai/api/v1',
      keyUrl: 'https://openrouter.ai/keys',
      keyHint: 'sk-or-…',
      listNeedsKey: false,
      note: 'Có mô hình miễn phí (🆓, đuôi “:free”); “openrouter/free” tự chọn một mô hình miễn phí. Key miễn phí, giới hạn số lượt mỗi ngày.',
      headers: () => ({ 'HTTP-Referer': /^https?:/.test(location.origin) ? location.origin : 'https://diagrams.trungctr.com', 'X-Title': 'Diagram Editor' }),
      suggested: ['openrouter/free', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'],
      async listModels(key, base) {
        const res = await net(this, base, `${base}/models`, {});
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        const isFree = (m) => m.id === 'openrouter/free' || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
        return (data.data || [])
          .filter((m) => {
            const a = m.architecture || {};
            return (!a.output_modalities || a.output_modalities.includes('text')) && !(a.output_modalities || []).includes('audio');
          })
          .map((m) => ({ id: m.id, label: m.name || m.id, free: isFree(m), created: m.created || 0, ctx: m.context_length || 0 }))
          // “openrouter/free” đầu tiên, rồi mô hình miễn phí (ngữ cảnh dài trước – thường là mô hình lớn hơn), rồi mô hình trả phí mới nhất
          .sort((a, b) => (b.id === 'openrouter/free') - (a.id === 'openrouter/free') || b.free - a.free || (a.free ? b.ctx - a.ctx : b.created - a.created))
          .map(({ id, label, free }) => ({ id, label: (free ? '🆓 ' : '') + label, free }));
      },
    },
    groq: {
      name: 'Groq',
      group: 'free',
      compat: true,
      base: 'https://api.groq.com/openai/v1',
      keyUrl: 'https://console.groq.com/keys',
      keyHint: 'gsk_…',
      note: 'Gói miễn phí (giới hạn lượt / phút và lượt / ngày), trả lời rất nhanh.',
      suggested: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
      exclude: /(whisper|tts|guard|playai|orpheus|distil|compound)/i,
    },
    cerebras: {
      name: 'Cerebras',
      group: 'free',
      compat: true,
      base: 'https://api.cerebras.ai/v1',
      keyUrl: 'https://cloud.cerebras.ai/',
      keyHint: 'csk-…',
      note: 'Gói miễn phí (giới hạn token mỗi ngày), trả lời rất nhanh.',
      suggested: ['gpt-oss-120b'],
    },
    mistral: {
      name: 'Mistral AI',
      group: 'free',
      compat: true,
      base: 'https://api.mistral.ai/v1',
      keyUrl: 'https://console.mistral.ai/api-keys',
      keyHint: '',
      note: 'Gói “Experiment” miễn phí (cần xác minh số điện thoại), giới hạn lượt.',
      suggested: ['mistral-medium-latest', 'mistral-small-latest', 'mistral-large-latest'],
      exclude: /(embed|ocr|moderation|voxtral|transcribe)/i,
      keep: (m) => !m.capabilities || m.capabilities.completion_chat !== false,
    },
    huggingface: {
      name: 'Hugging Face',
      group: 'free',
      compat: true,
      base: 'https://router.huggingface.co/v1',
      keyUrl: 'https://huggingface.co/settings/tokens',
      keyHint: 'hf_…',
      listNeedsKey: false,
      note: 'Tài khoản miễn phí có một ít credit mỗi tháng cho Inference Providers (token cần quyền “Make calls to Inference Providers”).',
      suggested: ['openai/gpt-oss-120b', 'deepseek-ai/DeepSeek-V4.1-Flash', 'Qwen/Qwen3.8-27B'],
    },
    // ---------------------------------------------------- chạy trên máy (miễn phí, dữ liệu không rời máy)
    ollama: {
      name: 'Ollama (chạy trên máy)',
      short: 'Ollama',
      group: 'local',
      local: true,
      native: 'ollama',
      keyOptional: true,
      baseEditable: true,
      base: 'http://localhost:11434',
      keyUrl: 'https://ollama.com/download',
      keyLinkText: 'Tải Ollama ↗',
      keyHint: 'không cần',
      note: 'Miễn phí, chạy ngay trên máy bạn – dữ liệu không rời máy. Cần máy đủ mạnh (nên có GPU).',
      setup: (origin) =>
        '1. Cài Ollama và tải một mô hình, vd: ollama pull gpt-oss:20b (hoặc qwen3:8b, gemma3:12b).\n' +
        '2. Cho phép trang này gọi Ollama – đặt biến môi trường rồi thoát hẳn và mở lại Ollama:\n' +
        `   Windows: setx OLLAMA_ORIGINS "${origin}"\n` +
        `   macOS:   launchctl setenv OLLAMA_ORIGINS "${origin}"\n` +
        `   Linux:   thêm Environment="OLLAMA_ORIGINS=${origin}" vào dịch vụ ollama (systemctl edit ollama)\n` +
        '3. Trình duyệt có thể hỏi quyền truy cập thiết bị trong mạng cục bộ – chọn Cho phép.\n' +
        'App tự đặt cửa sổ ngữ cảnh (num_ctx) đủ dài cho skill (~10k token).',
      suggested: [],
      async listModels(key, base) {
        const res = await net(this, base, `${base}/api/tags`, {});
        if (!res.ok) throw await httpError(res);
        const data = await res.json();
        return (data.models || [])
          .filter((m) => !/embed/i.test(m.name))
          .map((m) => ({ id: m.name, label: m.size ? `${m.name} (${(m.size / 1e9).toFixed(1)} GB)` : m.name }));
      },
    },
    lmstudio: {
      name: 'LM Studio (chạy trên máy)',
      short: 'LM Studio',
      group: 'local',
      local: true,
      compat: true,
      keyOptional: true,
      baseEditable: true,
      base: 'http://localhost:1234/v1',
      keyUrl: 'https://lmstudio.ai',
      keyLinkText: 'Tải LM Studio ↗',
      keyHint: 'không cần',
      note: 'Miễn phí, chạy ngay trên máy bạn – dữ liệu không rời máy.',
      setup: () =>
        '1. Trong LM Studio tải một mô hình; khi nạp mô hình đặt Context Length ≥ 16384 (skill dài ~10k token, để mặc định 4096 sẽ bị cắt).\n' +
        '2. Tab Developer → Settings → bật “Enable CORS” → Start Server (cổng 1234).\n' +
        '3. Trình duyệt có thể hỏi quyền truy cập thiết bị trong mạng cục bộ – chọn Cho phép.',
      suggested: [],
      exclude: /embed/i,
    },
    // ---------------------------------------------------- khác
    custom: {
      name: 'Tuỳ chỉnh (API kiểu OpenAI)',
      short: 'Tuỳ chỉnh',
      group: 'other',
      compat: true,
      keyOptional: true,
      baseEditable: true,
      base: '',
      keyUrl: '',
      keyHint: 'nếu máy chủ yêu cầu',
      note: 'Máy chủ bất kỳ có API kiểu OpenAI (…/v1/chat/completions và …/v1/models): vLLM, llama.cpp server, Jan, LocalAI, LiteLLM, DeepSeek, Together… Máy chủ phải cho phép CORS.',
      suggested: [],
    },
  };
  PROVIDERS.gemini.group = 'free';
  PROVIDERS.gemini.note = 'Gói miễn phí của Google AI Studio (giới hạn lượt / phút và lượt / ngày).';
  PROVIDERS.openai.group = 'paid';
  PROVIDERS.openai.compat = true;
  PROVIDERS.openai.base = 'https://api.openai.com/v1';
  PROVIDERS.openai.offChain = ['none', 'minimal', null];
  PROVIDERS.anthropic.group = 'paid';
  Object.entries(PROVIDERS).forEach(([k, p]) => {
    p.id = k;
    if (!p.short) p.short = { gemini: 'Gemini', anthropic: 'Claude' }[k] || p.name;
  });
  const GROUPS = [
    ['free', 'Có gói miễn phí'],
    ['local', 'Chạy trên máy – miễn phí'],
    ['paid', 'Trả phí'],
    ['other', 'Khác'],
  ];

  /** fetch có thông báo lỗi kết nối dễ hiểu cho máy chủ chạy trên máy */
  async function net(P, base, url, opts) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      if (e.name === 'AbortError' || !P || (!P.local && !P.baseEditable)) throw e;
      throw new Error(
        `Không kết nối được ${P.short} tại ${base || '(chưa nhập địa chỉ)'} – kiểm tra ${P.short} đang chạy` +
          (P.local ? ' và đã cho phép trang này gọi tới (xem hướng dẫn trong Cài đặt AI).' : ', địa chỉ đúng và máy chủ cho phép CORS.')
      );
    }
  }

  /** Danh sách mô hình chung cho API kiểu OpenAI: GET {base}/models */
  async function compatModels(P, key, base) {
    const res = await net(P, base, `${base}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || data.models || [];
    return list
      .map((m) => (typeof m === 'string' ? { id: m } : m))
      .filter((m) => m && m.id && (!P.exclude || !P.exclude.test(m.id)) && (!P.keep || P.keep(m)))
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((m) => ({ id: m.id, label: m.name && m.name !== m.id ? m.name : m.id }));
  }

  /** Bỏ phần suy luận mà một số mô hình mở (DeepSeek-R1, Qwen…) chèn thẳng vào nội dung */
  const stripThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();

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

    /** OpenAI và mọi API kiểu OpenAI (OpenRouter, Groq, Cerebras, Mistral, Hugging Face, LM Studio, tuỳ chỉnh) */
    async compat({ P, key, model, base, system, messages, signal, effort, thinking }) {
      // reasoning_effort cho mô hình suy luận; mô hình thường không nhận -> lùi về mặc định
      let efforts = [null];
      if (thinking === false) efforts = P.offChain || ['none', null];
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
          const headers = Object.assign({ 'content-type': 'application/json' }, key ? { Authorization: `Bearer ${key}` } : {}, P.headers ? P.headers() : {});
          const res = await net(P, base, `${base}/chat/completions`, { method: 'POST', signal, headers, body: JSON.stringify(body) });
          if (!res.ok) throw await httpError(res);
          const data = await res.json();
          if (data.error) throw new Error(`${P.short}: ${(data.error && (data.error.message || data.error)) || 'lỗi không rõ'}`);
          const ch = (data.choices || [])[0];
          if (!ch) throw new Error(`${P.short} không trả về kết quả`);
          if (ch.message && ch.message.refusal) throw new Error(`${P.short} từ chối yêu cầu: ` + ch.message.refusal);
          return { text: stripThink(ch.message && ch.message.content), truncated: ch.finish_reason === 'length' };
        }
      );
    },

    /** Ollama: API gốc /api/chat để tự đặt num_ctx (mặc định của Ollama quá ngắn, sẽ cắt mất skill) */
    async ollama({ P, model, base, system, messages, signal, effort, thinking }) {
      const all = [{ role: 'system', content: system }, ...messages];
      const chars = all.reduce((s, m) => s + m.content.length, 0);
      let ctx = 8192;
      while (ctx < chars / 3.2 + 4096 && ctx < 65536) ctx *= 2; // ~10k token skill + diagram + câu trả lời
      let thinks = [undefined];
      if (thinking === false) thinks = [false, undefined];
      else if (effort) thinks = [{ low: 'low', medium: 'medium' }[effort] || 'high', true, undefined];
      return tryVariants(
        thinks.map((t, i) => ({ t, note: i > 0 ? 'Mô hình không hỗ trợ cấu hình thinking đã chọn – đã dùng mặc định.' : undefined })),
        async ({ t }) => {
          const body = { model, messages: all, stream: false, options: { num_ctx: ctx } };
          if (t !== undefined) body.think = t;
          const res = await net(P, base, `${base}/api/chat`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) throw await httpError(res);
          const data = await res.json();
          if (data.error) throw new Error('Ollama: ' + data.error);
          return { text: stripThink(data.message && data.message.content), truncated: data.done_reason === 'length' };
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
      detail = (typeof j.error === 'string' ? j.error : j.error && (j.error.message || j.error.type)) || j.message || j.detail || '';
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
    const def = { provider: 'gemini', keys: {}, models: {}, lists: {}, bases: {}, effort: '', thinking: true };
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && typeof c === 'object') {
        return {
          provider: PROVIDERS[c.provider] ? c.provider : 'gemini',
          keys: c.keys || {},
          models: c.models || {},
          lists: c.lists || {}, // danh sách mô hình đã tải từ tài khoản (cho dropdown trên khung chat)
          bases: c.bases || {}, // địa chỉ máy chủ (Ollama, LM Studio, tuỳ chỉnh)
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

  /** Địa chỉ máy chủ của nhà cung cấp (đã chuẩn hoá: bỏ “/” cuối; Ollama bỏ “/v1”) */
  function baseOf(provider, c = load(), override) {
    const P = PROVIDERS[provider];
    let b = String(override != null ? override : (P.baseEditable && c.bases[provider]) || P.base || '').trim().replace(/\/+$/, '');
    if (P.native === 'ollama') b = b.replace(/\/v1$/, '');
    return b;
  }
  /** Nhà cung cấp đã đủ thông tin để chat chưa (key nếu bắt buộc, địa chỉ nếu cần) */
  function isConfigured(provider, c = load()) {
    const P = PROVIDERS[provider];
    return !!P && !!(c.keys[provider] || P.keyOptional) && (!P.baseEditable || !!baseOf(provider, c));
  }

  DE.ai = {
    PROVIDERS,
    GROUPS,
    mask,
    load,
    save,
    thinkingCaps,
    baseOf,
    isConfigured,
    EFFORTS,
    /** Cấu hình đang dùng cho chat: { provider, providerName, key, model, base, effort, thinking } hoặc null nếu chưa đủ */
    active() {
      const c = load();
      const P = PROVIDERS[c.provider], key = c.keys[c.provider] || '', model = c.models[c.provider];
      if (!model || !isConfigured(c.provider, c)) return null;
      return { provider: c.provider, providerName: P.name, key, model, base: baseOf(c.provider, c), effort: c.effort, thinking: c.thinking };
    },
    /** Tải danh sách mô hình (từ tài khoản / máy chủ) và ghi nhớ cho dropdown chọn nhanh trên khung chat */
    async listModels(provider, key, base) {
      const P = PROVIDERS[provider];
      const b = baseOf(provider, load(), base);
      const list = P.listModels ? await P.listModels.call(P, key, b) : await compatModels(P, key, b);
      const c = load();
      c.lists[provider] = list.map((m) => ({ id: m.id, label: m.label, ...(m.free ? { free: true } : {}) }));
      save(c);
      return list;
    },
    /** Gửi hội thoại tới mô hình đang chọn. opts: { system, messages, signal } */
    chat(opts) {
      const a = this.active();
      if (!a) throw new Error('Chưa cấu hình nhà cung cấp / mô hình');
      const P = PROVIDERS[a.provider];
      const fn = P.native === 'ollama' ? CHAT.ollama : P.compat ? CHAT.compat : CHAT[a.provider];
      return fn({ P, key: a.key, model: a.model, base: a.base, effort: a.effort, thinking: a.thinking, ...opts });
    },
  };
})(window.DE);
