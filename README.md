# Diagram Editor – Whiteboard cho thiết kế phần mềm

Trình vẽ diagram dạng whiteboard chạy hoàn toàn trên trình duyệt: **Flowchart, BPMN 2.0, UML 2.5 và ERD**.
HTML + CSS + JavaScript thuần, không cần build, không phụ thuộc thư viện ngoài. Mọi đối tượng được quản lý
bằng **JSON**, và có **Chat AI** – gõ hoặc **nói** – để mô tả bằng lời rồi để AI vẽ giúp.

**Dùng ngay:** <https://diagrams.trungctr.com/> (cài được như ứng dụng, chạy cả khi offline).

## Mục lục

- [Chạy trên máy](#chạy-trên-máy)
- [Tính năng](#tính-năng)
- [Chat AI](#chat-ai)
- [Giọng nói](#giọng-nói)
- [Phím tắt](#phím-tắt)
- [Cấu trúc JSON](#cấu-trúc-json)
- [Cấu trúc mã nguồn](#cấu-trúc-mã-nguồn)
- [Triển khai](#triển-khai)

## Chạy trên máy

Mở trực tiếp `index.html` bằng Chrome / Edge / Firefox (hỗ trợ cả `file://`). Hoặc chạy qua web server tĩnh
bất kỳ, ví dụ `npx serve .` hay `python -m http.server`. Cần chạy qua `http(s)://` thì PWA (cài đặt, offline)
mới hoạt động.

## Tính năng

### Diagram

- **3 chế độ**: Flowchart, BPMN, UML – chọn ở thanh công cụ. Mỗi chế độ chỉ hiện ký hiệu, đường nối và mẫu
  của mình; nhóm “Chung” (sticky, text, tiêu đề, frame, cloud) có ở mọi chế độ. ERD nằm trong chế độ UML.
  Chế độ lưu trong `meta.mode` của tài liệu (hoặc tự suy ra khi mở file cũ). Chuyển chế độ = bắt đầu tài liệu
  mới (có hỏi xác nhận).
- **99 ký hiệu chuẩn** và **27 kiểu đường nối** (Sequence / Message Flow, Generalization, Realization,
  Dependency, Aggregation, Composition, Include / Extend, các loại message, crow's foot…). Định tuyến vuông góc,
  thẳng hoặc cong; kéo đầu mút để nối lại sang hình khác.
- **Mẫu diagram**: Flowchart, BPMN, và 13 mẫu UML nhóm theo các quá trình kỹ thuật của ISO/IEC/IEEE 12207
  (Activity nghiệp vụ, Use Case, Domain model, Package, Component, Class, Sequence, Communication, State
  Machine, ERD, Deployment, Activity kiểm thử CI, State Machine yêu cầu thay đổi). Tiêu chuẩn không bắt buộc
  loại diagram – cách ánh xạ là thông lệ phổ biến.
- **Tab Trợ giúp**: quy ước của chế độ hiện tại, ý nghĩa từng ký hiệu và mũi tên, danh sách mẫu, phím tắt, có
  tìm kiếm. Chọn một hình / đường nối thì bảng Thuộc tính cũng hiện ý nghĩa của nó.

### Whiteboard

- Canvas vô hạn, zoom / pan, lưới và bắt dính lưới, chọn nhiều bằng vùng chọn, căn chỉnh và dàn đều, nhân bản,
  copy / paste (dữ liệu JSON, dùng được giữa các tab), undo / redo.
- **Nối nhanh**: rê chuột lên hình, kéo từ chấm xanh; thả ra vùng trống để tạo nhanh một hình đã nối sẵn.
- **Sequence diagram**: message gắn tự do theo trục dọc lifeline / activation, tự bắt thẳng hàng ngang.
- **Container** (Pool, Lane, Package, Frame, Group…): kéo container sẽ kéo theo các hình bên trong.
- **Thu gọn panel**: nút ‹ › ở mép canvas hoặc `Ctrl+B` / `Ctrl+Alt+B`; diagram đứng yên khi panel co giãn.
- **Chế độ tối**: chỉ làm tối giao diện, whiteboard chỉ dịu bớt độ trắng (không đen), hình giữ nguyên màu.

### JSON, mở và lưu

- **Tab JSON**: xem / sửa toàn bộ tài liệu. Khi bấm **Áp dụng**: giá trị không hợp lệ được đưa về fallback,
  node / edge không hiểu được bị xoá – kèm bảng liệt kê để xác nhận hoặc huỷ trước khi thực thi. Nhận cả câu
  trả lời dán nguyên từ AI (có lời dẫn và khối ```` ```json ````).
- **Mở file**: chỉ nhận `.json` đúng định dạng; file sai bị từ chối kèm danh sách lỗi cụ thể.
- **Tải xuống**: `JSON` (định dạng gốc, mở lại để sửa tiếp) · `SVG` · `PNG`. Diagram cũng tự lưu vào trình duyệt.
- **Xác nhận trước khi thay diagram** (Tài liệu mới, chuyển chế độ, mở mẫu) – có nút “Tải JSON rồi tiếp tục”;
  vẫn hoàn tác được bằng `Ctrl+Z`.

### Nhúng vào Markdown

Nút **Nhúng SVG** tạo đoạn mã dán thẳng vào file `.md`, không cần file ảnh ngoài:

- **SVG inline** (khuyên dùng): `<div><svg …>…</svg></div>` trên một dòng (CommonMark coi là khối HTML), id duy
  nhất để nhúng nhiều diagram trong một trang, tự co theo bề rộng. Cần trình xem cho phép HTML (VS Code
  preview, Typora, Obsidian, MkDocs, Docusaurus…).
- **Ảnh PNG nhúng**: `![tên](data:image/png;base64,…)` – Markdown thuần (markdown-it chặn data URI SVG nên dùng PNG).
- Có thể chỉ nhúng các hình đang chọn. GitHub lọc bỏ cả hai dạng – ở GitHub hãy dùng file `.svg` tải xuống.

### PWA

Cài như ứng dụng (nút “Cài đặt ứng dụng” ở thanh trạng thái hoặc biểu tượng cài trên thanh địa chỉ), chạy
offline nhờ service worker (network-first), mở file `.json` trực tiếp từ hệ điều hành khi đã cài.

## Chat AI

Khung chat nổi ở góc dưới phải canvas (thu nhỏ được thành nút “Chat AI”). Mô tả diagram bằng lời, AI trả về
JSON và app **áp dụng ngay**.

```text
[ Claude ● ] [ Copy context ] [ mô hình ▾ ] [ Effort: … ▾ ] [ 💡 Thinking: bật ]      Lượt 2  ↻  —
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Hỏi AI về diagram này…                                            🎤  🎧  [ Gửi Ctrl ↵ ] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cài đặt

Bấm chip **API key** (hoặc chọn “⚙ Đổi nhà cung cấp…” trong dropdown mô hình):

1. Chọn nhà cung cấp: **Google Gemini**, **OpenAI** hoặc **Anthropic Claude** (có link “Lấy API key ↗”).
2. Dán API key – luôn hiển thị dạng che bớt, ví dụ `AIza••••••WXYZ`; key đã lưu có nút Đổi / Xoá.
3. Chọn mô hình – danh sách **tải trực tiếp từ tài khoản** bằng key (đúng quyền của tài khoản), có gợi ý
   dự phòng và “Khác…” để tự nhập tên.
4. **Áp dụng**.

> 🔒 Key chỉ lưu trong `localStorage` của trình duyệt này (riêng cho từng nhà cung cấp) và chỉ được gửi thẳng
> tới nhà cung cấp đã chọn – không qua máy chủ trung gian. Không nên lưu key trên máy dùng chung.

### Chọn nhanh trên khung chat

- **Mô hình**: đổi nhanh trong danh sách đã tải từ tài khoản.
- **Effort**: mặc định · thấp · trung bình · cao · rất cao · tối đa – cao hơn thì kỹ hơn nhưng chậm và tốn token hơn.
- **Thinking**: bật / tắt suy luận trước khi trả lời. Mô hình không tắt được thì nút hiện “Thinking: luôn bật”.

Mỗi nhà cung cấp nhận tham số khác nhau; app chuyển đổi như sau:

| Nhà cung cấp | Effort | Tắt thinking |
| --- | --- | --- |
| Anthropic Claude | `output_config.effort` (`low` … `max`); thinking bật = `{ type: "adaptive" }` | Opus 5.5 / Fable / Mythos: **không tắt được** (nút khoá). Sonnet 5.5: `{ type: "between_tools" }`. Opus 5 / Haiku 5.5: `{ type: "disabled" }`. Ba mô hình này khi tắt thinking chỉ nhận effort tối đa `high` – app tự hạ và báo. |
| OpenAI | `reasoning_effort` (`low` / `medium` / `high`; rất cao / tối đa → `xhigh`, lùi về `high` nếu không hỗ trợ) | `reasoning_effort: "none"`, lùi về `"minimal"` |
| Google Gemini | `thinkingConfig.thinkingLevel` (Gemini 3.x), lùi về `thinkingBudget` (Gemini 2.5) | `thinkingLevel: "minimal"`, lùi về `thinkingBudget: 0` |

Nếu mô hình trả lỗi 400 vì không hiểu tham số, app tự thử phương án kế tiếp (cuối cùng là mặc định của mô hình)
và **ghi chú rõ** trong khung chat cấu hình nào đã thực sự được dùng.

### Gửi prompt

1. Gõ yêu cầu, bấm **Gửi** hoặc `Ctrl+Enter` (vd: *“Vẽ quy trình đăng ký tài khoản bằng BPMN có 2 lane”*).
2. Trong lúc chờ: trạng thái vui (“Vibing…”, “Hooking…”, “Cooking…”, “Nối mũi tên…”) xoay liên tục, đếm giây;
   nút Gửi thành **Dừng** để huỷ.
3. JSON trả về được đưa vào tab JSON và **áp dụng ngay** (vẫn qua bước kiểm tra hợp lệ).
4. App báo xong và nhắc **hoàn tác bằng nút ↶ (nhấp nháy) hoặc `Ctrl+Z`**. Câu trả lời dạng chữ (khi hỏi về
   diagram) và lỗi (key sai, hết hạn mức, mô hình không tồn tại…) hiện ngay trong khung chat.

### Skill chỉ đặt một lần

- API của các nhà cung cấp không lưu hội thoại giữa các lần gọi, nên mỗi request vẫn phải có hướng dẫn. App đặt
  **skill ở system instruction một lần cho cả cuộc trò chuyện** – không chép vào từng tin nhắn – và bật cache
  prompt (Claude: `cache_control`; OpenAI / Gemini tự cache phần đầu giống nhau) để không bị tính phí lại đầy đủ.
- Skill gồm cả 3 chế độ, nên đổi loại diagram giữa chừng vẫn giữ nguyên cuộc trò chuyện.
- Lịch sử chỉ giữ lời người dùng + phần giải thích của AI (bỏ khối JSON); **diagram hiện tại gửi kèm lượt mới
  nhất** nên AI luôn sửa đúng bản đang mở, kể cả khi bạn vừa chỉnh tay. Nút ↻ để bắt đầu cuộc trò chuyện mới.

### Copy context (dùng với AI bên ngoài)

Nút **Copy context** sinh một **skill prompt** để dán vào Gemini, ChatGPT, Claude… (không cần API key):
danh sách type kèm kích thước và ý nghĩa, quy tắc hợp lệ, quy tắc bố cục từng chế độ, ví dụ mẫu; tuỳ chọn chỉ
chế độ hiện tại hoặc cả 3, kèm diagram hiện tại để AI sửa tiếp. Sao chép hoặc tải `.md`. Dán skill + yêu cầu
vào AI, rồi dán câu trả lời vào tab JSON → **Áp dụng**. Nội dung sinh từ thư viện hình nên luôn khớp phiên bản app.

## Giọng nói

Bấm 🎤 trong khung chat hoặc nhấn **`Ctrl+M`** rồi nói – **nói xong app tự gửi**, không cần bấm thêm. Muốn sửa
câu chữ trước khi gửi thì cứ gõ phím như bình thường.

```text
 🎤 / Ctrl+M ──► Đang nghe (chữ hiện dần trong ô chat) ──► im lặng 1,2 giây
                                                              │
         ┌────────────────────────────────────────────────────┴───────────────┐
   câu khớp một LỆNH NGẮN                                         câu còn lại = PROMPT
   (“hoàn tác”, “vừa màn hình”…)                                           │
         │                                                 🔊 “Em nghe rồi, anh chờ em tí nhé.”
   chạy ngay, không gọi AI                                  gửi AI → áp dụng JSON
   🔊 “Đã hoàn tác.”                                        🔊 “Xong rồi, anh xem thử nhé.”
```

- **Phản hồi bằng giọng nói ngay khi gửi**: “Em nghe rồi, anh chờ em tí nhé”, “Rõ rồi, em làm ngay đây”… (đổi
  câu ngẫu nhiên); xong thì báo “Xong rồi, anh xem thử nhé” (lần đầu nhắc thêm “Không ưng thì nói hoàn tác nhé”).
  AI trả lời bằng chữ ngắn thì đọc luôn câu trả lời. Xưng hô chọn được: em – anh, em – chị, tôi – bạn, mình – bạn.
- **Lệnh giọng nói**: câu ngắn khớp *nguyên câu* chạy ngay, không gọi AI – hoàn tác, làm lại, vừa màn hình,
  phóng to / thu nhỏ, chọn tất cả, xoá, nhân bản, bật / tắt lưới, chế độ tối / sáng, tải JSON / PNG / SVG, nhúng
  SVG, tài liệu mới, chuyển sang Flowchart / BPMN / UML, trợ giúp, cuộc trò chuyện mới, dừng… Bỏ qua từ đệm
  (“hoàn tác **đi**”, “**giúp em** vừa màn hình **nhé**”). Câu dài hơn (“xoá node đăng nhập”) được gửi cho AI.
  Danh sách đầy đủ ở tab Trợ giúp và trong Cài đặt giọng nói.
- **Xác nhận bằng giọng nói**: khi app hỏi lại (tài liệu mới, chuyển chế độ, JSON cần sửa…) thì đọc câu hỏi và
  nghe “**đồng ý**” / “**huỷ**”.
- **Rảnh tay** (🎧 hoặc `Ctrl+Shift+M`): nghe → gửi → đọc kết quả → nghe tiếp. Nói “tắt rảnh tay”, nhấn `Esc`,
  hoặc im lặng 90 giây thì tự tắt.
- `Esc` khi đang nghe: huỷ, trả lại nội dung đang gõ dở trong ô chat.

### Bộ nhận dạng

Chuột phải vào 🎤 (hoặc nút “🎙 Giọng nói…” trong Cài đặt AI) để chọn:

| Bộ nhận dạng | Tải về | Đặc điểm |
| --- | --- | --- |
| **Web Speech API** (mặc định khi trình duyệt có) | 0 MB | Chữ hiện ngay trong lúc nói. Chrome / Edge gửi âm thanh tới máy chủ nhận dạng của hãng (cần mạng); Chrome 139+ có gói nhận dạng ngay trên máy thì app tự dùng. Firefox không có. |
| **Offline – Moonshine** | ~45 MB, một lần | [`moonshine-tiny-vi`](https://huggingface.co/bh4/moonshine-tiny-vi-ONNX) (tiếng Việt) / `moonshine-tiny` (English) + Silero VAD chạy bằng [transformers.js](https://huggingface.co/docs/transformers.js) trong Web Worker (giao diện không bị đơ). Âm thanh không rời máy; chữ hiện sau khi nói xong (~1–2 giây). Tải từ Hugging Face / jsDelivr khi dùng lần đầu, sau đó nằm trong cache của trình duyệt. |

“Tự động” chọn Web Speech nếu có, không thì hỏi tải bộ offline.

### Giọng đọc

Dùng `speechSynthesis` của trình duyệt. Máy chưa có giọng tiếng Việt thì phản hồi hiện thành chữ; cài thêm ở
Windows → Cài đặt → Thời gian & ngôn ngữ → Giọng nói → Thêm giọng → Tiếng Việt, hoặc mở app bằng Microsoft Edge
(có sẵn giọng HoaiMy / NamMinh). Chọn giọng và “Nghe thử” trong Cài đặt giọng nói.

## Phím tắt

| Thao tác | Phím |
| --- | --- |
| Chọn / Kéo canvas / Vẽ đường nối | `V` / `H` (hoặc giữ `Space`) / `C` |
| Sửa chữ | Nhấn đúp, `Enter`, `F2` – lưu bằng `Ctrl+Enter`, huỷ bằng `Esc` |
| Thêm text tự do | Nhấn đúp vào vùng trống |
| Hoàn tác / Làm lại | `Ctrl+Z` / `Ctrl+Y` (hoặc `Ctrl+Shift+Z`) |
| Copy / Cắt / Dán / Nhân bản | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` / `Ctrl+D` (hoặc `Alt` + kéo) |
| Xoá | `Delete` / `Backspace` |
| Zoom | `Ctrl` + cuộn chuột, `Ctrl +` / `Ctrl −`, `Ctrl+0`; vừa màn hình: `Shift+1` |
| Dịch chuyển | Phím mũi tên (`Shift`: theo bước lưới) |
| Thứ tự lớp | `Ctrl+]` lên trên cùng, `Ctrl+[` xuống dưới cùng |
| Lưu / Mở | `Ctrl+S` / `Ctrl+O` |
| Thu gọn / mở panel | `Ctrl+B` (thư viện) / `Ctrl+Alt+B` (thuộc tính) |
| Gửi prompt cho AI | `Ctrl+Enter` trong ô chat |
| Nói với AI | `Ctrl+M` (nói xong tự gửi) · `Ctrl+Shift+M` rảnh tay · `Esc` huỷ khi đang nghe |

## Cấu trúc JSON

```json
{
  "version": 1,
  "meta": { "name": "Quy trình xử lý đơn hàng", "mode": "flowchart" },
  "nodes": [
    { "id": "start", "type": "flow.terminator", "x": 330, "y": 40, "w": 140, "h": 50,
      "text": "Bắt đầu", "style": {} },
    { "id": "check", "type": "flow.decision", "x": 330, "y": 230, "w": 140, "h": 90,
      "text": "Còn hàng?", "style": { "fill": "#fef3c7", "stroke": "#d97706" } }
  ],
  "edges": [
    { "id": "e1", "type": "flow.arrow", "source": "start", "target": "check", "label": "" }
  ]
}
```

### Node

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Định danh duy nhất (chuỗi, không trùng với node / edge khác) |
| `type` | Loại hình, ví dụ `flow.process`, `bpmn.userTask`, `uml.class` (xem danh sách bên dưới) |
| `x`, `y`, `w`, `h` | Vị trí góc trên trái và kích thước (số, `w`/`h` > 0) |
| `text` | Nội dung. Với `uml.class`, `uml.state`, `erd.table`…, dùng một dòng `--` để chia ngăn |
| `style` | Ghi đè style: `fill`, `stroke`, `strokeWidth`, `dash` (`solid`/`dashed`/`dotted`/`dashdot`), `textColor`, `fontSize`, `fontWeight`, `fontStyle`, `align` |

Có thể thêm trường tuỳ ý (ví dụ `"data": {...}`); editor giữ nguyên các trường này.

### Edge

| Trường | Ý nghĩa |
| --- | --- |
| `id`, `type` | Định danh và kiểu đường nối, ví dụ `bpmn.messageFlow`, `uml.composition` |
| `source`, `target` | `id` của node nguồn / đích |
| `sourcePort`, `targetPort` | `top` / `right` / `bottom` / `left`; bỏ trống để tự chọn |
| `sourceAnchor`, `targetAnchor` | 0..1 – vị trí dọc trên lifeline / activation (sequence diagram) |
| `routing` | `orthogonal` / `straight` / `curved` (mặc định theo kiểu đường nối) |
| `label`, `labelPos` | Nhãn và vị trí nhãn dọc theo đường (0..1) |
| `style` | `stroke`, `strokeWidth`, `dash`, `startArrow`, `endArrow`, `fontSize`, `textColor` |

Các kiểu mũi tên: `none`, `arrow`, `open`, `triangle`, `diamond`, `diamondFilled`, `circle`, `circleFilled`,
`slash`, `erOne`, `erOnlyOne`, `erMany`, `erOneMany`, `erZeroOne`, `erZeroMany`.

### Danh sách type

Gõ trong DevTools console: `diagram.shapes()` và `diagram.connectors()`. Tên đầy đủ có tiền tố nhóm, ví dụ
`bpmn.userTask`, `uml.class`.

- **basic**: `sticky`, `text`, `heading`, `rect`, `roundrect`, `ellipse`, `triangle`, `cloud`, `frame`
- **flow**: `terminator`, `process`, `decision`, `data`, `predefined`, `document`, `multiDocument`, `manualInput`,
  `manualOperation`, `preparation`, `database`, `delay`, `display`, `connector`, `offPage`, `comment`
- **bpmn**: `startEvent`, `startMessage`, `startTimer`, `intermediateEvent`, `intermediateMessage`,
  `intermediateThrowMessage`, `intermediateTimer`, `endEvent`, `endMessage`, `endError`, `endTerminate`,
  `task`, `userTask`, `serviceTask`, `scriptTask`, `businessRuleTask`, `manualTask`, `sendTask`, `receiveTask`,
  `subProcess`, `expandedSubProcess`, `callActivity`, `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`,
  `eventGateway`, `complexGateway`, `dataObject`, `dataStore`, `message`, `pool`, `lane`, `annotation`, `group`
- **uml**: `class`, `abstractClass`, `interface`, `enum`, `object`, `package`, `component`, `providedInterface`,
  `requiredInterface`, `port`, `node`, `artifact`, `note`, `actor`, `useCase`, `systemBoundary`, `initial`,
  `final`, `flowFinal`, `action`, `state`, `decision`, `forkH`, `forkV`, `signalSend`, `signalReceive`,
  `timeEvent`, `partition`, `objectNode`, `history`, `lifeline`, `actorLifeline`, `activation`, `fragment`
- **erd**: `table`, `entity`, `weakEntity`, `relationship`, `attribute`, `keyAttribute`

### API trong console

```js
diagram.json                                  // bản sao JSON hiện tại
diagram.load({ nodes: [...], edges: [...] })  // nạp tài liệu
const a = diagram.add('uml.class', 100, 100, { text: 'User\n--\n- id: int' })
const b = diagram.add('uml.class', 400, 100, { text: 'Admin' })
diagram.connect('uml.generalization', b, a)
```

## Cấu trúc mã nguồn

```text
index.html             giao diện chính (+ meta SEO, JSON-LD, manifest)
css/styles.css         giao diện, chế độ sáng / tối
js/util.js             tiện ích, đo & ngắt dòng chữ
js/shapes.js           thư viện hình + kiểu đường nối + DE.MODES   ← thêm hình mới ở đây
js/render.js           vẽ SVG, định tuyến đường nối, mũi tên
js/store.js            mô hình JSON, chuẩn hoá / kiểm tra hợp lệ, undo / redo
js/templates.js        diagram mẫu (UML nhóm theo quá trình ISO/IEC/IEEE 12207)
js/help.js             nội dung trợ giúp: ý nghĩa ký hiệu, đường nối, quy ước từng chế độ
js/skill.js            sinh skill prompt cho AI (từ thư viện hình)
js/ai.js               cấu hình AI, tải danh sách mô hình, gọi chat (Gemini / OpenAI / Claude)
js/voice.js            giọng nói: Web Speech / Moonshine offline, lệnh giọng nói, đọc phản hồi, rảnh tay
js/export.js           xuất SVG / PNG, nhúng Markdown
js/editor.js           tương tác canvas (chọn, kéo, resize, nối, phím tắt)
js/ui.js               toolbar, thư viện, bảng thuộc tính, tab JSON, trợ giúp, khung chat AI
js/main.js             khởi động, tự lưu, PWA
sw.js                  service worker (offline)
manifest.webmanifest   cấu hình PWA
icons/                 icon SVG gốc + PNG (192 / 512, maskable, apple-touch-icon)
llms.txt, robots.txt, sitemap.xml, og-image.png   SEO / AI SEO
```

### Thêm một hình mới

Trong `js/shapes.js`:

```js
def('flow.myShape', {
  cat: 'flow', name: 'My Shape', w: 140, h: 70, text: 'Nội dung',
  style: { fill: '#ecfeff', stroke: '#0891b2' },
  render: (n, s, a) => rect(n.w, n.h, a(), 8),   // SVG trong toạ độ cục bộ 0..w, 0..h
});
```

Nhóm `cat` quyết định hình thuộc chế độ nào (xem `DE.MODES` cuối `shapes.js`). Thêm mô tả vào `DE.HELP.shapes`
trong `js/help.js` để hình xuất hiện trong tab Trợ giúp – skill prompt cho AI sẽ tự có hình mới.

## Triển khai

Trang chạy trên **GitHub Pages** (Deploy from a branch: `main`, thư mục `/`) với domain riêng
`diagrams.trungctr.com`:

- File `CNAME` trong repo lưu custom domain của GitHub Pages – **không xoá**.
- DNS (Cloudflare): bản ghi `CNAME diagrams → trungctr.github.io`, chế độ **DNS only**; bật **Enforce HTTPS**
  trong Settings → Pages.
- Khi phát hành bản mới có thêm / bớt file: cập nhật `PRECACHE` và tăng `VERSION` trong `sw.js`; cập nhật
  `<lastmod>` trong `sitemap.xml` khi nội dung trang thay đổi.
