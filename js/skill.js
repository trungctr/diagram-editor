/* =========================================================================
 * "Skill prompt" cho AI bên ngoài (Gemini, ChatGPT, Claude…).
 * Người dùng dán đoạn này vào ô chat trước yêu cầu của họ, AI sẽ hiểu định dạng
 * JSON của Diagram Editor và trả về diagram hợp lệ.
 * Nội dung được SINH TỪ THƯ VIỆN HÌNH (DE.shapes, DE.connectors, DE.HELP) nên luôn
 * khớp với phiên bản app đang chạy.
 * ========================================================================= */
(function (DE) {
  'use strict';

  const APP_URL = 'https://diagrams.trungctr.com/';

  // ------------------------------------------------- ví dụ hợp lệ cho từng mode
  // (được kiểm tra bằng DE.validateDocStrict trong test)
  DE.SKILL_EXAMPLES = {
    flowchart: {
      version: 1,
      meta: { name: 'Kiểm tra đăng nhập', mode: 'flowchart' },
      nodes: [
        { id: 'start', type: 'flow.terminator', x: 330, y: 40, w: 140, h: 50, text: 'Bắt đầu', style: {} },
        { id: 'input', type: 'flow.data', x: 320, y: 130, w: 160, h: 60, text: 'Nhập user / pass', style: {} },
        { id: 'check', type: 'flow.decision', x: 330, y: 230, w: 140, h: 90, text: 'Hợp lệ?', style: {} },
        { id: 'ok', type: 'flow.process', x: 320, y: 370, w: 160, h: 70, text: 'Tạo phiên đăng nhập', style: {} },
        { id: 'err', type: 'flow.process', x: 560, y: 240, w: 160, h: 70, text: 'Báo lỗi', style: {} },
        { id: 'end', type: 'flow.terminator', x: 330, y: 490, w: 140, h: 50, text: 'Kết thúc', style: {} },
      ],
      edges: [
        { id: 'e1', type: 'flow.arrow', source: 'start', target: 'input', label: '' },
        { id: 'e2', type: 'flow.arrow', source: 'input', target: 'check', label: '' },
        { id: 'e3', type: 'flow.arrow', source: 'check', target: 'ok', label: 'Có' },
        { id: 'e4', type: 'flow.arrow', source: 'check', target: 'err', label: 'Không', sourcePort: 'right', targetPort: 'left' },
        { id: 'e5', type: 'flow.arrow', source: 'err', target: 'input', label: 'Thử lại', sourcePort: 'top', targetPort: 'right' },
        { id: 'e6', type: 'flow.arrow', source: 'ok', target: 'end', label: '' },
      ],
    },
    bpmn: {
      version: 1,
      meta: { name: 'Xử lý đơn hàng', mode: 'bpmn' },
      nodes: [
        { id: 'pool', type: 'bpmn.pool', x: 40, y: 40, w: 760, h: 320, text: 'Cửa hàng', style: {} },
        { id: 'lane1', type: 'bpmn.lane', x: 70, y: 40, w: 730, h: 160, text: 'Khách hàng', style: {} },
        { id: 'lane2', type: 'bpmn.lane', x: 70, y: 200, w: 730, h: 160, text: 'Hệ thống', style: {} },
        { id: 's', type: 'bpmn.startEvent', x: 120, y: 100, w: 40, h: 40, text: 'Bắt đầu', style: {} },
        { id: 't1', type: 'bpmn.userTask', x: 210, y: 85, w: 130, h: 70, text: 'Đặt hàng', style: {} },
        { id: 't2', type: 'bpmn.serviceTask', x: 210, y: 245, w: 130, h: 70, text: 'Kiểm tra tồn kho', style: {} },
        { id: 'g', type: 'bpmn.exclusiveGateway', x: 400, y: 255, w: 50, h: 50, text: 'Đủ hàng?', style: {} },
        { id: 't3', type: 'bpmn.serviceTask', x: 510, y: 245, w: 130, h: 70, text: 'Tạo hoá đơn', style: {} },
        { id: 't4', type: 'bpmn.sendTask', x: 360, y: 85, w: 130, h: 70, text: 'Báo hết hàng', style: {} },
        { id: 'e1', type: 'bpmn.endEvent', x: 720, y: 260, w: 40, h: 40, text: 'Hoàn tất', style: {} },
        { id: 'e2', type: 'bpmn.endEvent', x: 720, y: 100, w: 40, h: 40, text: 'Huỷ', style: {} },
      ],
      edges: [
        { id: 'f1', type: 'bpmn.sequenceFlow', source: 's', target: 't1', label: '' },
        { id: 'f2', type: 'bpmn.sequenceFlow', source: 't1', target: 't2', label: '' },
        { id: 'f3', type: 'bpmn.sequenceFlow', source: 't2', target: 'g', label: '' },
        { id: 'f4', type: 'bpmn.sequenceFlow', source: 'g', target: 't3', label: 'Có' },
        { id: 'f5', type: 'bpmn.sequenceFlow', source: 'g', target: 't4', label: 'Không' },
        { id: 'f6', type: 'bpmn.sequenceFlow', source: 't3', target: 'e1', label: '' },
        { id: 'f7', type: 'bpmn.sequenceFlow', source: 't4', target: 'e2', label: '' },
      ],
    },
    uml: {
      version: 1,
      meta: { name: 'Class: Đơn hàng', mode: 'uml' },
      nodes: [
        { id: 'base', type: 'uml.abstractClass', x: 40, y: 40, w: 220, h: 110, text: 'BaseEntity\n--\n# id: UUID\n--\n+ getId(): UUID', style: {} },
        { id: 'repoI', type: 'uml.interface', x: 360, y: 40, w: 240, h: 100, text: 'IOrderRepository\n--\n+ save(o: Order): void', style: {} },
        { id: 'order', type: 'uml.class', x: 40, y: 230, w: 220, h: 140, text: 'Order\n--\n- items: List<OrderItem>\n- status: OrderStatus\n--\n+ total(): Money', style: {} },
        { id: 'repo', type: 'uml.class', x: 360, y: 230, w: 240, h: 100, text: 'OrderRepository\n--\n- db: DataSource\n--\n+ save(o: Order): void', style: {} },
        { id: 'item', type: 'uml.class', x: 40, y: 460, w: 220, h: 100, text: 'OrderItem\n--\n- quantity: int\n- price: Money', style: {} },
      ],
      edges: [
        { id: 'r1', type: 'uml.generalization', source: 'order', target: 'base', label: '' },
        { id: 'r2', type: 'uml.realization', source: 'repo', target: 'repoI', label: '' },
        { id: 'r3', type: 'uml.composition', source: 'order', target: 'item', label: '1..*' },
        { id: 'r4', type: 'uml.dependency', source: 'repo', target: 'order', label: '«use»' },
      ],
    },
  };

  // ------------------------------------------------------- quy tắc theo mode
  const MODE_RULES = {
    flowchart: [
      'Bố cục từ trên xuống: `flow.terminator` "Bắt đầu" ở trên cùng, "Kết thúc" ở dưới cùng; các bước nối bằng `flow.arrow`.',
      '`flow.decision` phải có ít nhất 2 cạnh đi ra, mỗi cạnh có `label` điều kiện ("Có"/"Không", "Đúng"/"Sai"…). Nhánh chính đi xuống, nhánh phụ đi sang phải (`sourcePort: "right"`).',
      'Vòng lặp: cạnh quay ngược về bước trước, dùng `sourcePort`/`targetPort` để đường đi vòng ra ngoài (vd. từ "right"/"top" về "right").',
      'Dùng `flow.data` cho nhập/xuất, `flow.database` cho lưu trữ, `flow.predefined` cho gọi chương trình con.',
    ],
    bpmn: [
      'Mỗi quy trình có `bpmn.startEvent` (hoặc start có icon) và ít nhất một end event. Event 40×40, gateway 50×50; tên của event/gateway đặt trong `text` (app tự vẽ nhãn bên dưới hình).',
      'Pool & Lane: đặt `bpmn.pool` TRƯỚC, rồi các `bpmn.lane` ngay sau trong mảng nodes (chúng là container, phải nằm phía sau). Lane nằm trong pool: `lane.x = pool.x + 30`, `lane.w = pool.w - 30`, các lane xếp chồng theo chiều dọc phủ kín chiều cao pool. Mọi task/event/gateway phải nằm trọn trong lane tương ứng.',
      '`bpmn.sequenceFlow` chỉ nối các phần tử trong CÙNG một pool. Giữa 2 pool khác nhau dùng `bpmn.messageFlow`.',
      'Gateway tách nhánh: ghi `label` điều kiện trên mỗi cạnh ra. Dùng cặp gateway cùng loại để tách và hợp nhánh (XOR: `bpmn.exclusiveGateway`, AND: `bpmn.parallelGateway`, OR: `bpmn.inclusiveGateway`).',
      'Đặt tên task dạng "Động từ + danh từ" (vd: "Kiểm tra tồn kho"). Chọn đúng loại task: người làm trên phần mềm → `bpmn.userTask`, hệ thống tự động → `bpmn.serviceTask`, gửi/nhận message → `bpmn.sendTask`/`bpmn.receiveTask`.',
      'Data Object / Data Store nối với task bằng `bpmn.dataAssociation`; chú thích dùng `bpmn.annotation` + `bpmn.association`.',
    ],
    uml: [
      'Class / Interface / Enum / State / Object / ERD table: dùng một dòng chỉ chứa `--` trong `text` để chia ngăn. Ví dụ class: `"Order\\n--\\n- id: UUID\\n- status: Status\\n--\\n+ total(): Money"`. Ký hiệu phạm vi: `+` public, `-` private, `#` protected, `~` package. KHÔNG tự viết «interface»/«enumeration» – app tự thêm theo type.',
      'Chiều cao class ≈ 30 + 18 × (tổng số dòng thuộc tính + thao tác) + 12 × (số ngăn − 1); rộng 200–260.',
      'Quan hệ: kế thừa `uml.generalization` (source = lớp CON, target = lớp CHA); hiện thực `uml.realization` (source = lớp, target = interface); `uml.composition`/`uml.aggregation` có source = TỔNG THỂ (whole), target = thành phần; `uml.dependency` source phụ thuộc target. Bội số ghi trong `label` (vd "1..*").',
      'Use case: `uml.systemBoundary` đặt TRƯỚC trong nodes; `uml.useCase` nằm trong boundary, `uml.actor` nằm ngoài; actor nối use case bằng `uml.association` với `"routing": "straight"`; `uml.include`/`uml.extend` giữa các use case.',
      'Activity: `uml.initial` → `uml.action` … → `uml.final`; rẽ nhánh bằng `uml.decision` với label dạng "[điều kiện]"; song song bằng `uml.forkH`; chia trách nhiệm bằng `uml.partition` (container, đặt trước, xếp cạnh nhau theo chiều ngang, cùng y và h). Cạnh dùng `uml.transition`.',
      'State machine: `uml.initial` → các `uml.state` → `uml.final`; cạnh `uml.transition` với label "sựKiện [guard] / hànhĐộng".',
      'Sequence: các `uml.lifeline` / `uml.actorLifeline` cùng y (vd 40), cùng h (đủ dài cho mọi message, vd 400), cách nhau ~200px theo x. Message là edge `uml.syncMessage` / `uml.asyncMessage` / `uml.returnMessage` với `sourceAnchor` và `targetAnchor` = vị trí dọc (0..1) tính theo chiều cao lifeline, cùng một giá trị để message nằm ngang, tăng dần cho các message sau (vd 0.2, 0.3, 0.4…). `uml.activation` (w 16) đặt tại `x = lifeline.x + lifeline.w/2 - 8`; message nối vào activation thì anchor tính theo chiều cao activation. Đánh số label: "1: login()", "2: …".',
      'Component / Deployment: `uml.component`, `uml.node` (container – đặt trước các `uml.artifact` nằm trong nó), nối bằng `uml.dependency` (label «use») hoặc `uml.association` (đường truyền thông, label giao thức).',
      'ERD: `erd.table` với text "tên_bảng\\n--\\nPK id : bigint\\nFK user_id : bigint\\n…"; quan hệ `erd.oneToMany` (source = bảng phía 1, target = bảng phía nhiều), `erd.oneToOne`, `erd.zeroToMany`.',
    ],
  };

  const fmtSize = (d) => `${d.w}×${d.h}`;

  function shapeList(mode) {
    const m = DE.MODES[mode];
    let out = '';
    for (const cid of m.cats) {
      const c = DE.shapeCategories.find((x) => x.id === cid);
      if (!c) continue;
      out += `\n#### ${c.name}\n`;
      for (const d of Object.values(DE.shapes)) {
        if (d.cat !== cid) continue;
        const flags = [d.container ? 'container – đặt trước các hình bên trong' : '', d.lineAnchor ? 'dùng sourceAnchor/targetAnchor' : '']
          .filter(Boolean)
          .join('; ');
        out += `- \`${d.type}\` (${fmtSize(d)}) – ${DE.HELP.shapes[d.type] || d.name}${flags ? ` [${flags}]` : ''}\n`;
      }
    }
    return out;
  }

  function connectorList(mode) {
    const m = DE.MODES[mode];
    let out = '';
    for (const [k, c] of Object.entries(DE.connectors)) {
      if (!m.groups.includes(c.group)) continue;
      const s = Object.assign({ startArrow: 'none', endArrow: 'arrow', dash: 'solid' }, c.style);
      const look = [s.dash !== 'solid' ? `nét ${s.dash}` : '', s.startArrow !== 'none' ? `đầu: ${s.startArrow}` : '', `cuối: ${s.endArrow}`, `routing mặc định: ${c.routing}`]
        .filter(Boolean)
        .join(', ');
      out += `- \`${k}\` – ${DE.HELP.connectors[k] || c.name} (${look}${c.label ? `, label mặc định "${c.label}"` : ''})\n`;
    }
    return out;
  }

  /**
   * Sinh skill prompt.
   * opts: { modes: ['flowchart'|'bpmn'|'uml', …], doc?: tài liệu hiện tại (kèm để AI sửa tiếp) }
   */
  DE.buildSkillPrompt = function (opts = {}) {
    const modes = (opts.modes && opts.modes.length ? opts.modes : Object.keys(DE.MODES)).filter((m) => DE.MODES[m]);
    const modeNames = modes.map((m) => DE.MODES[m].name).join(', ');
    const L = [];
    L.push('# SKILL: Tạo diagram JSON cho "Diagram Editor"');
    L.push('');
    L.push(`Bạn là trợ lý tạo diagram cho ứng dụng **Diagram Editor** (${APP_URL}) – công cụ vẽ ${modeNames}. Khi người dùng mô tả một quy trình, hệ thống hoặc thiết kế, hãy tạo **một tài liệu JSON** đúng định dạng dưới đây. Người dùng sẽ dán JSON vào tab **JSON** của app rồi bấm **Áp dụng** (hoặc lưu thành file \`.json\` rồi bấm **Mở**).`);
    L.push('');
    L.push('## Cách trả lời');
    L.push('1. Trả về đúng **một** khối ```json … ``` chứa TOÀN BỘ tài liệu. JSON phải hợp lệ tuyệt đối: không comment, không dấu phẩy thừa, chuỗi dùng nháy kép, xuống dòng trong chuỗi viết là `\\n`.');
    L.push('2. Sau khối JSON, có thể giải thích ngắn gọn (tối đa 3 câu) bằng ngôn ngữ người dùng đang dùng. Nội dung chữ trong diagram cũng dùng ngôn ngữ đó.');
    L.push('3. Nếu người dùng gửi kèm JSON hiện có và yêu cầu chỉnh sửa: trả lại TOÀN BỘ tài liệu sau khi sửa, giữ nguyên `id` của các phần tử không thay đổi.');
    L.push('4. Nếu yêu cầu mơ hồ, tự chọn cách hợp lý nhất theo chuẩn ký hiệu rồi tạo luôn, không hỏi lại. Nếu tin nhắn CHỈ có skill này mà chưa có yêu cầu, hãy trả lời ngắn: "Đã sẵn sàng – hãy mô tả diagram bạn cần." và chờ.');
    L.push('');
    L.push('## Cấu trúc tài liệu');
    L.push('```json');
    L.push(`{ "version": 1, "meta": { "name": "Tên diagram", "mode": "${modes.length === 1 ? modes[0] : modes.join(' | ')}" }, "nodes": [ … ], "edges": [ … ] }`);
    L.push('```');
    L.push('');
    L.push('### Node (hình)');
    L.push('| Trường | Bắt buộc | Ý nghĩa |');
    L.push('| --- | --- | --- |');
    L.push('| `id` | có | chuỗi duy nhất trong toàn tài liệu (nodes và edges dùng chung không gian id), vd "start", "t1" |');
    L.push('| `type` | có | một trong các type liệt kê ở mục "Danh sách node" |');
    L.push('| `x`, `y` | có | số – toạ độ góc trên-trái (px), trục y hướng xuống |');
    L.push('| `w`, `h` | có | số > 0 – kích thước; mặc định của từng type ghi trong ngoặc (w×h) |');
    L.push('| `text` | nên có | nội dung hiển thị; xuống dòng bằng `\\n` |');
    L.push('| `style` | tuỳ chọn | `{}` hoặc ghi đè: `fill`, `stroke` (màu #rrggbb hoặc "none"), `strokeWidth`, `dash` ("solid" \\| "dashed" \\| "dotted" \\| "dashdot"), `textColor`, `fontSize`, `fontWeight` ("normal" \\| "bold"), `fontStyle` ("normal" \\| "italic"), `align` ("left" \\| "center" \\| "right") |');
    L.push('');
    L.push('### Edge (đường nối)');
    L.push('| Trường | Bắt buộc | Ý nghĩa |');
    L.push('| --- | --- | --- |');
    L.push('| `id` | có | chuỗi duy nhất |');
    L.push('| `type` | có | một trong các type ở mục "Danh sách edge" |');
    L.push('| `source`, `target` | có | `id` của node nguồn / đích (phải tồn tại) |');
    L.push('| `label` | nên có | nhãn trên đường, `""` nếu không có |');
    L.push('| `sourcePort`, `targetPort` | tuỳ chọn | "top" \\| "right" \\| "bottom" \\| "left"; bỏ trống để app tự chọn cạnh gần nhất (khuyến nghị) |');
    L.push('| `sourceAnchor`, `targetAnchor` | tuỳ chọn | số 0..1 – vị trí dọc trên lifeline/activation (chỉ dùng cho sequence diagram) |');
    L.push('| `routing` | tuỳ chọn | "orthogonal" (vuông góc) \\| "straight" (thẳng) \\| "curved" (cong); bỏ trống = mặc định của type |');
    L.push('| `labelPos` | tuỳ chọn | số 0..1 – vị trí nhãn dọc theo đường (mặc định 0.5) |');
    L.push('| `style` | tuỳ chọn | `stroke`, `strokeWidth`, `dash`, `startArrow`, `endArrow`, `fontSize`, `textColor` – thường KHÔNG cần, type đã quy định ký hiệu chuẩn |');
    L.push('');
    L.push('## Quy tắc bắt buộc (app sẽ từ chối file sai)');
    L.push('- `version` = 1; `meta.mode` là một trong: ' + Object.keys(DE.MODES).map((m) => `"${m}"`).join(', ') + '.');
    L.push('- Có đủ hai mảng `nodes` và `edges` (được phép rỗng).');
    L.push('- Mọi `id` là chuỗi không rỗng và không trùng nhau (kể cả giữa node và edge).');
    L.push('- `type` phải nằm trong danh sách bên dưới – không tự đặt type mới.');
    L.push('- `x`, `y`, `w`, `h` là số (không phải chuỗi); `w`, `h` > 0.');
    L.push('- `source`/`target` của edge phải trỏ tới `id` node có thật.');
    L.push('');
    L.push('## Quy tắc bố cục (để diagram dễ đọc)');
    L.push('- Dùng toạ độ là bội số của 10; bắt đầu từ khoảng (40, 40). Khoảng cách giữa các hình 60–100px; không để hình chồng lên nhau (trừ hình nằm trong container).');
    L.push('- Hình container (pool, lane, partition, package, frame, boundary, fragment…) phải đứng TRƯỚC các hình nằm bên trong nó trong mảng `nodes` và bao trọn chúng.');
    L.push('- Căn các hình cùng hàng theo tâm (cùng `y + h/2`) hoặc cùng cột (cùng `x + w/2`) để đường nối thẳng.');
    L.push('- Thường để app tự chọn port; chỉ chỉ định `sourcePort`/`targetPort` khi cần đường đi vòng hoặc tách nhánh.');
    for (const m of modes) {
      L.push('');
      L.push(`### Quy tắc riêng – ${DE.MODES[m].name}`);
      MODE_RULES[m].forEach((r) => L.push('- ' + r));
    }
    L.push('');
    L.push('## Danh sách node (type – kích thước mặc định w×h – ý nghĩa)');
    for (const m of modes) {
      L.push('');
      L.push(`### Chế độ ${DE.MODES[m].name}`);
      L.push(shapeList(m).trim());
    }
    L.push('');
    L.push('## Danh sách edge (type – ý nghĩa – ký hiệu)');
    for (const m of modes) {
      L.push('');
      L.push(`### Chế độ ${DE.MODES[m].name}`);
      L.push(connectorList(m).trim());
    }
    for (const m of modes) {
      L.push('');
      L.push(`## Ví dụ hợp lệ – ${DE.MODES[m].name}`);
      L.push('```json');
      L.push(JSON.stringify(DE.SKILL_EXAMPLES[m], null, 1));
      L.push('```');
    }
    if (opts.doc && opts.doc.nodes && opts.doc.nodes.length) {
      L.push('');
      L.push('## Diagram hiện tại của người dùng');
      L.push('Đây là tài liệu đang mở trong app. Nếu người dùng yêu cầu sửa/bổ sung, hãy dựa trên tài liệu này và trả lại toàn bộ tài liệu đã sửa (giữ id cũ).');
      L.push('```json');
      L.push(JSON.stringify(opts.doc));
      L.push('```');
    }
    L.push('');
    L.push('---');
    L.push('Hết skill. Yêu cầu của người dùng (nếu có) nằm ngay sau đây.');
    return L.join('\n');
  };
})(window.DE);
