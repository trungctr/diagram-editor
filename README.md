# Diagram Editor – Whiteboard cho thiết kế phần mềm

Trình vẽ diagram dạng whiteboard chạy hoàn toàn trên trình duyệt (HTML + CSS + JavaScript thuần,
không cần build, không phụ thuộc thư viện ngoài). Mọi đối tượng được quản lý bằng **JSON**.

## Chạy

Mở trực tiếp `index.html` bằng Chrome / Edge / Firefox (hỗ trợ cả `file://`).
Hoặc chạy qua web server tĩnh bất kỳ, ví dụ: `npx serve .` hay `python -m http.server`.

## Tính năng

- **3 chế độ (mode)**: Flowchart, BPMN, UML, chọn ở thanh công cụ. Mỗi mode chỉ hiển thị các ký hiệu,
  đường nối và mẫu của mình; nhóm “Chung” (sticky, text, tiêu đề, frame, cloud) có ở mọi mode. Mode được lưu
  trong `meta.mode` của tài liệu, hoặc tự suy ra từ loại hình khi mở file cũ. ERD nằm trong mode UML.
- **Mẫu UML theo ISO/IEC/IEEE 12207** (các quá trình kỹ thuật): Activity nghiệp vụ, Use Case, Domain model,
  Package, Component, Class, Sequence, Communication, State Machine, ERD, Deployment, Activity kiểm thử (CI),
  State Machine yêu cầu thay đổi. Tiêu chuẩn không bắt buộc loại diagram; cách ánh xạ là thông lệ phổ biến.
- **Tab Trợ giúp**: quy ước của mode hiện tại, ý nghĩa từng ký hiệu và từng mũi tên, danh sách mẫu,
  phím tắt; có ô tìm kiếm. Khi chọn một hình hoặc đường nối, bảng Thuộc tính cũng hiện ý nghĩa của nó.
- **Thư viện hình chuẩn** (99 hình): Flowchart, BPMN 2.0, UML (Class, Component,
  Deployment, Use Case, Activity, State, Sequence) và ERD. Bấm để thêm hoặc kéo thả vào canvas.
- **27 kiểu đường nối chuẩn**: Sequence/Message Flow (BPMN), Generalization, Realization, Dependency,
  Aggregation, Composition, Include/Extend, các loại message (UML), crow's foot (ERD)…
  Định tuyến vuông góc, thẳng hoặc cong. Kéo đầu mút để nối lại sang hình khác.
- **Whiteboard**: canvas vô hạn, zoom/pan, lưới và bắt dính lưới, sticky note, chọn nhiều bằng vùng chọn,
  căn chỉnh và dàn đều, nhân bản, copy/paste (dữ liệu JSON, dùng được giữa các tab), undo/redo.
- **Nối nhanh**: rê chuột lên hình, kéo từ chấm xanh. Thả vào hình khác để nối, thả ra vùng trống để
  tạo nhanh một hình mới đã được nối sẵn.
- **Sequence diagram**: message gắn tự do theo trục dọc của lifeline/activation và tự bắt thẳng hàng ngang.
- **Container**: Pool, Lane, Package, Frame, Group… khi kéo sẽ kéo theo các hình nằm bên trong.
- **JSON**: tab *JSON* để xem và sửa toàn bộ tài liệu; bảng *Thuộc tính* có ô JSON riêng cho từng đối tượng.
  Dữ liệu được kiểm tra hợp lệ và báo cảnh báo khi áp dụng.
- **Tải xuống**: 3 nút `JSON` · `SVG` · `PNG` cạnh nhau. JSON là định dạng gốc để mở lại và sửa tiếp;
  SVG/PNG chỉ là ảnh. Ngoài ra diagram tự lưu vào `localStorage`.
- **Nhúng SVG vào Markdown** (nút `Nhúng SVG`): tạo đoạn mã dán thẳng vào file `.md`, không cần file ảnh ngoài.
  - *SVG inline* (khuyên dùng): `<div><svg …>…</svg></div>` trên một dòng (CommonMark coi là khối HTML),
    id duy nhất để nhúng nhiều diagram trong cùng trang, tự co theo bề rộng. Cần trình xem cho phép HTML
    (VS Code preview, Typora, Obsidian, MkDocs, Docusaurus…).
  - *Ảnh PNG nhúng*: `![tên](data:image/png;base64,…)` – Markdown thuần. Không dùng data URI SVG vì
    markdown-it (bộ render của VS Code…) chặn `data:image/svg+xml`.
  - Có thể chỉ nhúng các hình đang chọn. GitHub lọc bỏ cả hai dạng trên – ở GitHub hãy dùng file `.svg` tải xuống.
- **PWA**: cài như ứng dụng (nút “Cài đặt ứng dụng” ở thanh trạng thái, hoặc biểu tượng cài trên thanh địa chỉ),
  chạy offline nhờ service worker (`sw.js`, network-first), mở file `.json` trực tiếp từ hệ điều hành khi đã cài
  (`file_handlers`). Icon trong `icons/` (SVG gốc + PNG 192/512, maskable, apple-touch-icon).
  Khi phát hành bản mới có thêm/bớt file, cập nhật `PRECACHE` và tăng `VERSION` trong `sw.js`.
- **Chat AI** *(đang phát triển – mới có giao diện)*: khung chat nổi ở góc dưới phải canvas với nút API key,
  Copy context, nhập giọng nói và gửi (`Ctrl+Enter`); có thể thu nhỏ thành nút “Chat AI”.
- **Thu gọn panel**: nút ‹ › ở mép trái / phải canvas (hoặc `Ctrl+B` cho thư viện, `Ctrl+Alt+B` cho bảng thuộc
  tính) để có thêm chỗ vẽ trên màn hình nhỏ. Mặc định hiện cả hai; lựa chọn được ghi nhớ, diagram đứng yên khi
  panel co giãn.
- **Chế độ tối** (nút mặt trăng / mặt trời): chỉ làm tối giao diện; nền whiteboard không đen mà chỉ giảm độ
  trắng cho đỡ chói, các hình giữ nguyên màu, file xuất ra vẫn nền trắng. Mặc định theo hệ điều hành, lựa chọn
  được ghi nhớ.
- **SEO / AI SEO**: meta description, Open Graph, Twitter Card (ảnh `og-image.png` 1200×630), JSON-LD
  (`WebApplication`), `canonical`, `<noscript>` mô tả, `robots.txt`, `sitemap.xml`, `llms.txt` (mô tả ứng
  dụng và định dạng JSON cho các hệ thống AI). Trang chính thức: <https://diagrams.trungctr.com/>
- **Xác nhận trước khi thay diagram**: Tài liệu mới, chuyển mode (xoá diagram hiện tại và bắt đầu tài liệu
  mới của mode đó) và mở mẫu đều hỏi lại, có nút “Tải JSON rồi tiếp tục”. Không hỏi khi diagram đang trống.
  Vẫn hoàn tác được bằng `Ctrl+Z`.
- **Áp dụng JSON (tab JSON)**: giá trị không hợp lệ được đưa về fallback, node/edge không hiểu được (type lạ,
  edge trỏ tới node không tồn tại…) bị xoá. Trước khi áp dụng sẽ hiện bảng liệt kê từng mục sẽ xoá/sửa để
  người dùng xác nhận hoặc huỷ. JSON sai cú pháp thì báo lỗi, không áp dụng.
- **Mở file**: chỉ nhận file `.json` đúng định dạng ở mục *Cấu trúc JSON*. File sai định dạng (thiếu
  `nodes`/`edges`, `type` không có trong thư viện, edge trỏ tới node không tồn tại, id trùng…) bị từ chối
  kèm danh sách lỗi cụ thể.

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

## Cấu trúc JSON

```json
{
  "version": 1,
  "meta": { "name": "Quy trình xử lý đơn hàng" },
  "nodes": [
    { "id": "start", "type": "flow.terminator", "x": 330, "y": 40, "w": 140, "h": 50,
      "text": "Bắt đầu", "style": {} },
    { "id": "check", "type": "flow.decision", "x": 330, "y": 230, "w": 140, "h": 90,
      "text": "Còn hàng?", "style": { "fill": "#fef3c7", "stroke": "#d97706" } }
  ],
  "edges": [
    { "id": "e1", "type": "flow.arrow", "source": "start", "target": "check", "label": "" },
    { "id": "e2", "type": "uml.generalization", "source": "order", "target": "base",
      "sourcePort": "top", "targetPort": "bottom", "routing": "orthogonal" }
  ]
}
```

### Node

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Định danh duy nhất (chuỗi) |
| `type` | Loại hình, ví dụ `flow.process`, `bpmn.userTask`, `uml.class` (xem danh sách bên dưới) |
| `x`, `y`, `w`, `h` | Vị trí góc trên trái và kích thước |
| `text` | Nội dung. Với `uml.class`, `uml.state`, `erd.table`…, dùng một dòng `--` để chia ngăn |
| `style` | Ghi đè style: `fill`, `stroke`, `strokeWidth`, `dash` (`solid`/`dashed`/`dotted`/`dashdot`), `textColor`, `fontSize`, `fontWeight`, `fontStyle`, `align` |

Có thể thêm trường tuỳ ý (ví dụ `"data": {...}`); editor giữ nguyên các trường này.

### Edge

| Trường | Ý nghĩa |
| --- | --- |
| `id`, `type` | Định danh và kiểu đường nối, ví dụ `bpmn.messageFlow`, `uml.composition` |
| `source`, `target` | `id` của node nguồn / đích |
| `sourcePort`, `targetPort` | `top` / `right` / `bottom` / `left`; bỏ trống để tự chọn |
| `sourceAnchor`, `targetAnchor` | 0..1 – vị trí dọc trên lifeline/activation (sequence diagram) |
| `routing` | `orthogonal` / `straight` / `curved` (mặc định theo kiểu đường nối) |
| `label`, `labelPos` | Nhãn và vị trí nhãn dọc theo đường (0..1) |
| `style` | `stroke`, `strokeWidth`, `dash`, `startArrow`, `endArrow`, `fontSize`, `textColor` |

Các kiểu mũi tên: `none`, `arrow`, `open`, `triangle`, `diamond`, `diamondFilled`, `circle`, `circleFilled`,
`slash`, `erOne`, `erOnlyOne`, `erMany`, `erOneMany`, `erZeroOne`, `erZeroMany`.

### Danh sách type

Gõ trong DevTools console: `diagram.shapes()` và `diagram.connectors()`.

- **basic**: `sticky`, `text`, `heading`, `rect`, `roundrect`, `ellipse`, `triangle`, `cloud`, `frame`
- **flow**: `terminator`, `process`, `decision`, `data`, `predefined`, `document`, `multiDocument`, `manualInput`,
  `manualOperation`, `preparation`, `database`, `delay`, `display`, `connector`, `offPage`, `comment`
- **bpmn**: `startEvent`, `startMessage`, `startTimer`, `intermediateEvent`, `intermediateMessage`,
  `intermediateThrowMessage`, `intermediateTimer`, `endEvent`, `endMessage`, `endError`, `endTerminate`,
  `task`, `userTask`, `serviceTask`, `scriptTask`, `businessRuleTask`, `manualTask`, `sendTask`, `receiveTask`,
  `subProcess`, `expandedSubProcess`, `callActivity`, `exclusiveGateway`, `parallelGateway`, `inclusiveGateway`,
  `eventGateway`, `complexGateway`, `dataObject`, `dataStore`, `message`, `pool`, `lane`, `annotation`, `group`
- **uml**: `class`, `abstractClass`, `interface`, `enum`, `object`, `package`, `component`, `providedInterface`,
  `node`, `artifact`, `note`, `actor`, `useCase`, `systemBoundary`, `initial`, `final`, `flowFinal`, `action`,
  `state`, `decision`, `forkH`, `forkV`, `signalSend`, `signalReceive`, `timeEvent`, `lifeline`, `actorLifeline`,
  `activation`, `fragment`
- **erd**: `table`, `entity`, `weakEntity`, `relationship`, `attribute`, `keyAttribute`

(Tên đầy đủ có tiền tố nhóm, ví dụ `bpmn.userTask`, `uml.class`.)

## API trong console

```js
diagram.json                                  // bản sao JSON hiện tại
diagram.load({ nodes: [...], edges: [...] })  // nạp tài liệu
const a = diagram.add('uml.class', 100, 100, { text: 'User\n--\n- id: int' })
const b = diagram.add('uml.class', 400, 100, { text: 'Admin' })
diagram.connect('uml.generalization', b, a)
```

## Cấu trúc mã nguồn

```text
index.html          giao diện chính
css/styles.css      giao diện
js/util.js          tiện ích, đo & ngắt dòng chữ
js/shapes.js        thư viện hình + kiểu đường nối  ← thêm hình mới ở đây
js/render.js        vẽ SVG, định tuyến đường nối, mũi tên
js/store.js         mô hình JSON, kiểm tra hợp lệ, undo/redo
js/templates.js     diagram mẫu (theo mode; UML nhóm theo quá trình ISO/IEC/IEEE 12207)
js/help.js          nội dung trợ giúp: ý nghĩa ký hiệu, đường nối, quy ước từng mode
js/export.js        xuất ảnh SVG / PNG
js/editor.js        tương tác canvas (chọn, kéo, resize, nối, phím tắt)
js/ui.js            toolbar, thư viện, bảng thuộc tính, tab JSON
js/main.js          khởi động, tự lưu
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

Nhóm `cat` quyết định hình thuộc mode nào (xem `DE.MODES` cuối `shapes.js`). Thêm mô tả cho hình mới vào
`DE.HELP.shapes` trong `js/help.js` để nó xuất hiện trong tab Trợ giúp.
