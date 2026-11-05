/* =========================================================================
 * Diagram mẫu theo từng chế độ.
 * UML: nhóm theo các quá trình kỹ thuật (Technical processes) của
 * ISO/IEC/IEEE 12207 – mỗi quá trình gợi ý các loại diagram thường dùng
 * để tạo ra sản phẩm thông tin (information item) của quá trình đó.
 * ========================================================================= */
(function (DE) {
  'use strict';

  function N(id, type, x, y, w, h, text, style) {
    const d = DE.getShape(type);
    return { id, type, x, y, w: w ?? d.w, h: h ?? d.h, text: text ?? d.text ?? '', style: style || {} };
  }
  function L(id, type, source, target, o) {
    return Object.assign({ id, type, source, target, label: (DE.connectors[type] || {}).label || '' }, o);
  }
  const doc = (name, mode, nodes, edges) => ({ version: 1, meta: { name, mode }, nodes, edges });

  DE.emptyDoc = (mode = 'flowchart') => doc('Untitled', mode, [], []);

  const P = {
    biz: 'Phân tích nghiệp vụ / sứ mệnh (Business or mission analysis)',
    stake: 'Xác định nhu cầu & yêu cầu bên liên quan (Stakeholder needs & requirements definition)',
    req: 'Xác định yêu cầu hệ thống / phần mềm (System / Software requirements definition)',
    arch: 'Xác định kiến trúc (Architecture definition)',
    design: 'Xác định thiết kế (Design definition)',
    integ: 'Hiện thực, Tích hợp & Chuyển giao (Implementation, Integration, Transition)',
    verif: 'Kiểm định & Xác nhận (Verification, Validation)',
    maint: 'Vận hành & Bảo trì (Operation, Maintenance)',
  };
  DE.UML_PROCESSES = P;

  DE.templates = {
    // ================================================================ FLOWCHART
    flowchart: {
      mode: 'flowchart', name: 'Xử lý đơn hàng',
      desc: 'Lưu đồ cơ bản: bắt đầu, nhập liệu, rẽ nhánh, xử lý, lưu CSDL, kết thúc.',
      build: () =>
        doc('Quy trình xử lý đơn hàng', 'flowchart',
          [
            N('note', 'basic.sticky', 40, 40, 230, 160, 'Ví dụ Flowchart\n• Nhấn đúp để sửa chữ\n• Kéo từ chấm xanh để nối\n• Kéo hình từ thư viện bên trái\n• Tab Trợ giúp: ý nghĩa ký hiệu'),
            N('start', 'flow.terminator', 330, 40, 140, 50, 'Bắt đầu'),
            N('input', 'flow.data', 320, 130, 160, 60, 'Nhận đơn hàng'),
            N('check', 'flow.decision', 330, 230, 140, 90, 'Còn hàng?'),
            N('pay', 'flow.process', 320, 370, 160, 60, 'Xác nhận & thanh toán'),
            N('notify', 'flow.process', 560, 245, 160, 60, 'Thông báo hết hàng'),
            N('db', 'flow.database', 340, 470, 120, 80, 'Lưu CSDL'),
            N('end', 'flow.terminator', 330, 600, 140, 50, 'Kết thúc'),
          ],
          [
            L('e1', 'flow.arrow', 'start', 'input'),
            L('e2', 'flow.arrow', 'input', 'check'),
            L('e3', 'flow.arrow', 'check', 'pay', { label: 'Có' }),
            L('e4', 'flow.arrow', 'check', 'notify', { label: 'Không', sourcePort: 'right' }),
            L('e5', 'flow.arrow', 'pay', 'db'),
            L('e6', 'flow.arrow', 'db', 'end'),
            L('e7', 'flow.arrow', 'notify', 'end', { sourcePort: 'bottom', targetPort: 'right' }),
          ]),
    },
    flowLogin: {
      mode: 'flowchart', name: 'Thuật toán đăng nhập (vòng lặp)',
      desc: 'Lưu đồ thuật toán có vòng lặp và bộ đếm: khoá tài khoản sau 3 lần nhập sai.',
      build: () =>
        doc('Thuật toán đăng nhập', 'flowchart',
          [
            N('start', 'flow.terminator', 330, 30, 140, 50, 'Bắt đầu'),
            N('init', 'flow.preparation', 320, 110, 160, 50, 'n = 0'),
            N('in', 'flow.manualInput', 320, 190, 160, 60, 'Nhập user / pass'),
            N('chk', 'flow.process', 320, 280, 160, 60, 'Kiểm tra thông tin'),
            N('d1', 'flow.decision', 330, 370, 140, 90, 'Đúng?'),
            N('ok', 'flow.process', 320, 500, 160, 60, 'Tạo phiên đăng nhập'),
            N('end', 'flow.terminator', 330, 610, 140, 50, 'Kết thúc'),
            N('cnt', 'flow.process', 560, 385, 160, 60, 'n = n + 1'),
            N('d2', 'flow.decision', 570, 480, 140, 90, 'n ≥ 3?'),
            N('lock', 'flow.process', 560, 605, 160, 60, 'Khoá tài khoản'),
          ],
          [
            L('a', 'flow.arrow', 'start', 'init'),
            L('b', 'flow.arrow', 'init', 'in'),
            L('c', 'flow.arrow', 'in', 'chk'),
            L('d', 'flow.arrow', 'chk', 'd1'),
            L('e', 'flow.arrow', 'd1', 'ok', { label: 'Đúng' }),
            L('f', 'flow.arrow', 'd1', 'cnt', { label: 'Sai', sourcePort: 'right' }),
            L('g', 'flow.arrow', 'cnt', 'd2'),
            L('h', 'flow.arrow', 'd2', 'in', { label: 'Không', sourcePort: 'right', targetPort: 'right' }),
            L('i', 'flow.arrow', 'd2', 'lock', { label: 'Có', sourcePort: 'bottom' }),
            L('j', 'flow.arrow', 'ok', 'end'),
            L('k', 'flow.arrow', 'lock', 'end', { targetPort: 'right' }),
          ]),
    },

    // ===================================================================== BPMN
    bpmn: {
      mode: 'bpmn', name: 'Đặt hàng online (Pool & Lane)',
      desc: 'Quy trình trong một Pool chia 2 Lane, có User/Service/Send Task và Exclusive Gateway.',
      build: () =>
        doc('Quy trình đặt hàng (BPMN)', 'bpmn',
          [
            N('pool', 'bpmn.pool', 40, 40, 920, 380, 'Cửa hàng online'),
            N('lane1', 'bpmn.lane', 70, 40, 890, 190, 'Khách hàng'),
            N('lane2', 'bpmn.lane', 70, 230, 890, 190, 'Hệ thống'),
            N('s', 'bpmn.startEvent', 120, 115, 40, 40, 'Bắt đầu'),
            N('t1', 'bpmn.userTask', 210, 100, 130, 70, 'Chọn sản phẩm'),
            N('t2', 'bpmn.userTask', 390, 100, 130, 70, 'Đặt hàng'),
            N('t3', 'bpmn.serviceTask', 390, 290, 130, 70, 'Kiểm tra tồn kho'),
            N('g', 'bpmn.exclusiveGateway', 580, 300, 50, 50, 'Đủ hàng?'),
            N('t4', 'bpmn.serviceTask', 690, 290, 130, 70, 'Tạo hóa đơn'),
            N('t5', 'bpmn.sendTask', 540, 100, 130, 70, 'Báo hết hàng'),
            N('end1', 'bpmn.endEvent', 870, 305, 40, 40, 'Hoàn tất'),
            N('end2', 'bpmn.endError', 870, 115, 40, 40, 'Hủy đơn'),
          ],
          [
            L('f1', 'bpmn.sequenceFlow', 's', 't1'),
            L('f2', 'bpmn.sequenceFlow', 't1', 't2'),
            L('f3', 'bpmn.sequenceFlow', 't2', 't3'),
            L('f4', 'bpmn.sequenceFlow', 't3', 'g'),
            L('f5', 'bpmn.sequenceFlow', 'g', 't4', { label: 'Có' }),
            L('f6', 'bpmn.sequenceFlow', 'g', 't5', { label: 'Không' }),
            L('f7', 'bpmn.sequenceFlow', 't4', 'end1'),
            L('f8', 'bpmn.sequenceFlow', 't5', 'end2'),
          ]),
    },
    bpmnCollab: {
      mode: 'bpmn', name: 'Collaboration – 2 Pool & Message Flow',
      desc: 'Hai bên tham gia (2 Pool) giao tiếp bằng Message Flow; có Data Store và Data Association.',
      build: () =>
        doc('Collaboration: Khách hàng – Cửa hàng', 'bpmn',
          [
            N('p1', 'bpmn.pool', 40, 40, 820, 170, 'Khách hàng'),
            N('p2', 'bpmn.pool', 40, 270, 820, 230, 'Cửa hàng'),
            N('s1', 'bpmn.startEvent', 110, 105, 40, 40, 'Cần mua hàng'),
            N('t1', 'bpmn.sendTask', 200, 90, 130, 70, 'Gửi đơn hàng'),
            N('t2', 'bpmn.receiveTask', 520, 90, 130, 70, 'Nhận xác nhận'),
            N('e1', 'bpmn.endEvent', 730, 105, 40, 40, 'Đã đặt hàng'),
            N('s2', 'bpmn.startMessage', 245, 335, 40, 40, 'Nhận đơn'),
            N('t3', 'bpmn.task', 340, 320, 130, 70, 'Xử lý đơn'),
            N('t4', 'bpmn.sendTask', 520, 320, 130, 70, 'Gửi xác nhận'),
            N('e2', 'bpmn.endEvent', 730, 335, 40, 40, 'Hoàn tất'),
            N('ds', 'bpmn.dataStore', 375, 415, 60, 50, 'CSDL đơn hàng'),
          ],
          [
            L('a', 'bpmn.sequenceFlow', 's1', 't1'),
            L('b', 'bpmn.sequenceFlow', 't1', 't2'),
            L('c', 'bpmn.sequenceFlow', 't2', 'e1'),
            L('d', 'bpmn.sequenceFlow', 's2', 't3'),
            L('e', 'bpmn.sequenceFlow', 't3', 't4'),
            L('f', 'bpmn.sequenceFlow', 't4', 'e2'),
            L('m1', 'bpmn.messageFlow', 't1', 's2', { label: 'Đơn hàng', sourcePort: 'bottom', targetPort: 'top' }),
            L('m2', 'bpmn.messageFlow', 't4', 't2', { label: 'Xác nhận', sourcePort: 'top', targetPort: 'bottom' }),
            L('da', 'bpmn.dataAssociation', 't3', 'ds', { sourcePort: 'bottom', targetPort: 'top' }),
          ]),
    },

    // ====================================================== UML (ISO/IEC/IEEE 12207)
    umlActivityBiz: {
      mode: 'uml', group: P.biz, name: 'Activity diagram – quy trình nghiệp vụ',
      desc: 'Mô tả quy trình nghiệp vụ hiện tại/mong muốn với swimlane theo bộ phận, để hiểu vấn đề và cơ hội trước khi xác định yêu cầu.',
      build: () =>
        doc('Activity: Quy trình bán hàng', 'uml',
          [
            N('p1', 'uml.partition', 40, 40, 240, 520, 'Khách hàng'),
            N('p2', 'uml.partition', 280, 40, 240, 520, 'Bộ phận bán hàng'),
            N('p3', 'uml.partition', 520, 40, 240, 520, 'Kho'),
            N('i', 'uml.initial', 145, 90, 30, 30),
            N('a1', 'uml.action', 85, 150, 150, 50, 'Gửi đơn đặt hàng'),
            N('a2', 'uml.action', 325, 150, 150, 50, 'Tiếp nhận đơn'),
            N('d', 'uml.decision', 378, 240, 44, 44, ''),
            N('a4', 'uml.action', 565, 237, 150, 50, 'Xuất kho'),
            N('a5', 'uml.action', 565, 330, 150, 50, 'Giao hàng'),
            N('a6', 'uml.action', 85, 330, 150, 50, 'Nhận hàng'),
            N('a3', 'uml.action', 325, 400, 150, 50, 'Thông báo từ chối'),
            N('f', 'uml.final', 143, 430, 34, 34),
            N('ff', 'uml.flowFinal', 383, 490, 34, 34),
          ],
          [
            L('e1', 'uml.transition', 'i', 'a1'),
            L('e2', 'uml.transition', 'a1', 'a2'),
            L('e3', 'uml.transition', 'a2', 'd'),
            L('e4', 'uml.transition', 'd', 'a4', { label: '[hợp lệ]' }),
            L('e5', 'uml.transition', 'd', 'a3', { label: '[không hợp lệ]', labelPos: 0.3 }),
            L('e6', 'uml.transition', 'a4', 'a5'),
            L('e7', 'uml.transition', 'a5', 'a6'),
            L('e8', 'uml.transition', 'a6', 'f'),
            L('e9', 'uml.transition', 'a3', 'ff'),
          ]),
    },
    useCase: {
      mode: 'uml', group: P.stake, name: 'Use Case diagram',
      desc: 'Xác định các bên liên quan (actor) và nhu cầu của họ đối với hệ thống (use case), phạm vi hệ thống.',
      build: () =>
        doc('Use case: Hệ thống bán hàng', 'uml',
          [
            N('sys', 'uml.systemBoundary', 220, 40, 320, 420, 'Hệ thống bán hàng'),
            N('a1', 'uml.actor', 80, 190, 40, 80, 'Khách hàng'),
            N('a2', 'uml.actor', 640, 190, 40, 80, 'Quản trị viên'),
            N('uc1', 'uml.useCase', 295, 90, 170, 60, 'Đăng nhập'),
            N('uc2', 'uml.useCase', 295, 190, 170, 60, 'Đặt hàng'),
            N('uc3', 'uml.useCase', 295, 290, 170, 60, 'Thanh toán'),
            N('uc4', 'uml.useCase', 295, 380, 170, 60, 'Quản lý sản phẩm'),
          ],
          [
            L('a', 'uml.association', 'a1', 'uc2', { routing: 'straight' }),
            L('b', 'uml.association', 'a1', 'uc3', { routing: 'straight' }),
            L('c', 'uml.association', 'a2', 'uc1', { routing: 'straight' }),
            L('d', 'uml.association', 'a2', 'uc4', { routing: 'straight' }),
            L('i1', 'uml.include', 'uc2', 'uc1'),
            L('i2', 'uml.include', 'uc2', 'uc3'),
          ]),
    },
    umlDomain: {
      mode: 'uml', group: P.req, name: 'Domain model (Class diagram khái niệm)',
      desc: 'Các khái niệm nghiệp vụ và quan hệ, bội số – làm từ vựng chung cho đặc tả yêu cầu (chưa có thao tác).',
      build: () =>
        doc('Domain model: Bán hàng', 'uml',
          [
            N('kh', 'uml.class', 40, 60, 180, 110, 'Khách hàng\n--\nmã KH\nhọ tên\nemail'),
            N('dh', 'uml.class', 340, 60, 180, 110, 'Đơn hàng\n--\nsố đơn\nngày đặt\ntrạng thái'),
            N('tt', 'uml.class', 640, 60, 180, 110, 'Thanh toán\n--\nsố tiền\nphương thức\nthời điểm'),
            N('ddh', 'uml.class', 340, 260, 180, 90, 'Dòng đơn hàng\n--\nsố lượng\nđơn giá'),
            N('sp', 'uml.class', 640, 250, 180, 110, 'Sản phẩm\n--\nmã SP\ntên\ngiá'),
            N('note', 'uml.note', 40, 260, 220, 80, 'Domain model: chỉ có khái niệm & thuộc tính nghiệp vụ, chưa có thao tác.'),
          ],
          [
            L('r1', 'uml.association', 'kh', 'dh', { label: 'đặt  1 — 0..*' }),
            L('r2', 'uml.association', 'dh', 'tt', { label: '1 — 0..1' }),
            L('r3', 'uml.composition', 'dh', 'ddh', { label: '1..*' }),
            L('r4', 'uml.association', 'ddh', 'sp', { label: '0..* — 1' }),
          ]),
    },
    umlPackage: {
      mode: 'uml', group: P.arch, name: 'Package diagram – kiến trúc phân lớp',
      desc: 'Phân rã hệ thống thành các package/tầng và quy tắc phụ thuộc giữa chúng (layered / clean architecture).',
      build: () =>
        doc('Package: Kiến trúc phân lớp', 'uml',
          [
            N('ui', 'uml.package', 220, 40, 260, 130, 'presentation'),
            N('app', 'uml.package', 220, 240, 260, 130, 'application'),
            N('dom', 'uml.package', 220, 440, 260, 130, 'domain'),
            N('inf', 'uml.package', 600, 440, 260, 130, 'infrastructure'),
            N('c1', 'uml.class', 270, 90, 160, 50, 'OrderController'),
            N('c2', 'uml.class', 270, 290, 160, 50, 'OrderService'),
            N('c3', 'uml.class', 270, 490, 160, 50, 'Order'),
            N('c4', 'uml.class', 640, 490, 180, 50, 'OrderRepositoryImpl'),
            N('note', 'uml.note', 600, 60, 240, 90, 'Quy tắc: tầng trên chỉ phụ thuộc tầng dưới; infrastructure phụ thuộc domain (Dependency Inversion).'),
          ],
          [
            L('i1', 'uml.import', 'ui', 'app'),
            L('i2', 'uml.import', 'app', 'dom'),
            L('i3', 'uml.import', 'inf', 'dom'),
          ]),
    },
    umlComponent: {
      mode: 'uml', group: P.arch, name: 'Component diagram',
      desc: 'Các thành phần chính của hệ thống, interface cung cấp / yêu cầu và phụ thuộc giữa chúng.',
      build: () =>
        doc('Component: Hệ thống bán hàng', 'uml',
          [
            N('web', 'uml.component', 40, 120, 180, 80, '«component»\nWeb Frontend'),
            N('ifc', 'uml.providedInterface', 298, 148, 24, 24, 'IOrderAPI'),
            N('api', 'uml.component', 360, 120, 180, 80, '«component»\nOrder Service'),
            N('db', 'uml.component', 680, 120, 180, 80, '«datastore»\nOrder DB'),
            N('pay', 'uml.component', 360, 300, 180, 80, '«component»\nPayment Service'),
            N('gw', 'basic.cloud', 680, 290, 160, 100, 'Cổng thanh toán'),
          ],
          [
            L('a', 'uml.dependency', 'web', 'ifc', { label: '«use»' }),
            L('b', 'uml.association', 'api', 'ifc'),
            L('c', 'uml.dependency', 'api', 'db', { label: 'SQL' }),
            L('d', 'uml.dependency', 'api', 'pay', { label: '«use»' }),
            L('e', 'uml.dependency', 'pay', 'gw', { label: 'HTTPS' }),
          ]),
    },
    umlClass: {
      mode: 'uml', group: P.design, name: 'Class diagram thiết kế',
      desc: 'Thiết kế chi tiết lớp: thuộc tính, thao tác, kế thừa, hiện thực interface, composition.',
      build: () =>
        doc('Class: Đơn hàng', 'uml',
          [
            N('base', 'uml.abstractClass', 40, 40, 220, 110, 'BaseEntity\n--\n# id: UUID\n# createdAt: Date\n--\n+ getId(): UUID'),
            N('repoI', 'uml.interface', 380, 40, 240, 100, 'IRepository<T>\n--\n+ findById(id: UUID): T\n+ save(entity: T): void'),
            N('order', 'uml.class', 40, 230, 220, 150, 'Order\n--\n- items: List<OrderItem>\n- status: OrderStatus\n--\n+ addItem(item: OrderItem)\n+ total(): Money'),
            N('repo', 'uml.class', 380, 230, 240, 130, 'OrderRepository\n--\n- db: DataSource\n--\n+ findById(id: UUID): Order\n+ save(o: Order): void'),
            N('item', 'uml.class', 40, 470, 220, 100, 'OrderItem\n--\n- quantity: int\n- price: Money'),
            N('status', 'uml.enum', 380, 450, 180, 120, 'OrderStatus\n--\nNEW\nPAID\nSHIPPED'),
            N('note', 'uml.note', 700, 40, 200, 90, 'Dùng dòng "--" trong nội dung để chia các ngăn của class.'),
          ],
          [
            L('r1', 'uml.generalization', 'order', 'base'),
            L('r2', 'uml.realization', 'repo', 'repoI'),
            L('r3', 'uml.composition', 'order', 'item', { label: '1..*' }),
            L('r5', 'uml.directedAssociation', 'order', 'status', { sourcePort: 'right', targetPort: 'left' }),
          ]),
    },
    sequence: {
      mode: 'uml', group: P.design, name: 'Sequence diagram',
      desc: 'Trình tự message giữa các đối tượng theo thời gian cho một kịch bản (đăng nhập).',
      build: () =>
        doc('Sequence: Đăng nhập', 'uml',
          [
            N('u', 'uml.actorLifeline', 40, 40, 100, 400, 'Người dùng'),
            N('web', 'uml.lifeline', 220, 40, 130, 400, ':WebApp'),
            N('api', 'uml.lifeline', 420, 40, 130, 400, ':AuthAPI'),
            N('db', 'uml.lifeline', 620, 40, 130, 400, ':Database'),
            N('act', 'uml.activation', 477, 170, 16, 150, ''),
          ],
          [
            L('m1', 'uml.syncMessage', 'u', 'web', { label: '1: đăng nhập(user, pass)', sourceAnchor: 0.25, targetAnchor: 0.25 }),
            L('m2', 'uml.syncMessage', 'web', 'act', { label: '2: POST /login', sourceAnchor: 0.35, targetAnchor: 0.0667 }),
            L('m3', 'uml.syncMessage', 'act', 'db', { label: '3: SELECT user', sourceAnchor: 0.3333, targetAnchor: 0.45 }),
            L('m4', 'uml.returnMessage', 'db', 'act', { label: '4: user', sourceAnchor: 0.55, targetAnchor: 0.6 }),
            L('m5', 'uml.returnMessage', 'act', 'web', { label: '5: JWT token', sourceAnchor: 0.8667, targetAnchor: 0.65 }),
            L('m6', 'uml.returnMessage', 'web', 'u', { label: '6: chuyển trang chủ', sourceAnchor: 0.75, targetAnchor: 0.75 }),
          ]),
    },
    umlComm: {
      mode: 'uml', group: P.design, name: 'Communication diagram',
      desc: 'Tương tác giữa các đối tượng nhấn mạnh liên kết; message được đánh số thứ tự 1, 1.1, 1.1.1…',
      build: () =>
        doc('Communication: Đặt hàng', 'uml',
          [
            N('u', 'uml.actor', 40, 165, 40, 80, 'Khách hàng'),
            N('ctrl', 'uml.object', 200, 180, 180, 50, ':OrderController'),
            N('svc', 'uml.object', 500, 180, 180, 50, ':OrderService'),
            N('repo', 'uml.object', 800, 180, 180, 50, ':OrderRepository'),
            N('pay', 'uml.object', 500, 360, 180, 50, ':PaymentGateway'),
          ],
          [
            L('l1', 'uml.association', 'u', 'ctrl', { routing: 'straight', label: '1: đặtHàng() →' }),
            L('l2', 'uml.association', 'ctrl', 'svc', { routing: 'straight', label: '1.1: tạoĐơn(dto) →' }),
            L('l3', 'uml.association', 'svc', 'repo', { routing: 'straight', label: '1.1.1: lưu(order) →' }),
            L('l4', 'uml.association', 'svc', 'pay', { routing: 'straight', label: '1.1.2: thanhToán(amount) ↓' }),
          ]),
    },
    umlState: {
      mode: 'uml', group: P.design, name: 'State Machine – vòng đời đơn hàng',
      desc: 'Các trạng thái của đối tượng Đơn hàng và sự kiện/điều kiện chuyển trạng thái.',
      build: () =>
        doc('State machine: Đơn hàng', 'uml',
          [
            N('i', 'uml.initial', 60, 135, 30, 30),
            N('s1', 'uml.state', 140, 110, 150, 80, 'Mới\n--\nentry / ghi nhận'),
            N('s2', 'uml.state', 380, 110, 150, 80, 'Đã thanh toán'),
            N('s3', 'uml.state', 620, 110, 150, 80, 'Đang giao'),
            N('s4', 'uml.state', 620, 290, 150, 80, 'Hoàn tất'),
            N('s5', 'uml.state', 140, 290, 150, 80, 'Đã huỷ'),
            N('f', 'uml.final', 438, 420, 34, 34),
          ],
          [
            L('t0', 'uml.transition', 'i', 's1'),
            L('t1', 'uml.transition', 's1', 's2', { label: 'thanhToán() [hợp lệ]' }),
            L('t2', 'uml.transition', 's2', 's3', { label: 'giaoHàng()' }),
            L('t3', 'uml.transition', 's3', 's4', { label: 'xácNhận()' }),
            L('t4', 'uml.transition', 's1', 's5', { label: 'huỷ()' }),
            L('t5', 'uml.transition', 's2', 's5', { label: 'huỷ() / hoànTiền', sourcePort: 'bottom', targetPort: 'right' }),
            L('t6', 'uml.transition', 's4', 'f'),
            L('t7', 'uml.transition', 's5', 'f', { sourcePort: 'bottom' }),
          ]),
    },
    erdData: {
      mode: 'uml', group: P.design, name: 'ERD – thiết kế dữ liệu',
      desc: 'Thiết kế CSDL quan hệ: bảng, khoá chính/khoá ngoại và quan hệ 1-N (ký pháp crow\'s foot).',
      build: () =>
        doc('ERD: Bán hàng', 'uml',
          [
            N('users', 'erd.table', 40, 60, 220, 120, 'users\n--\nPK id : bigint\nemail : varchar(120)\nname : varchar(80)'),
            N('orders', 'erd.table', 360, 60, 220, 140, 'orders\n--\nPK id : bigint\nFK user_id : bigint\nstatus : varchar(20)\ncreated_at : timestamp'),
            N('items', 'erd.table', 360, 280, 220, 120, 'order_items\n--\nPK id : bigint\nFK order_id : bigint\nFK product_id : bigint\nquantity : int'),
            N('products', 'erd.table', 680, 280, 220, 120, 'products\n--\nPK id : bigint\nname : varchar(120)\nprice : decimal(12,2)'),
          ],
          [
            L('r1', 'erd.oneToMany', 'users', 'orders'),
            L('r2', 'erd.oneToMany', 'orders', 'items'),
            L('r3', 'erd.oneToMany', 'products', 'items'),
          ]),
    },
    umlDeploy: {
      mode: 'uml', group: P.integ, name: 'Deployment diagram',
      desc: 'Cấu hình triển khai: node phần cứng / môi trường thực thi, artifact được triển khai và đường truyền thông.',
      build: () =>
        doc('Deployment: Hệ thống bán hàng', 'uml',
          [
            N('client', 'uml.node', 40, 110, 190, 110, '«device»\nTrình duyệt người dùng'),
            N('srv', 'uml.node', 340, 60, 300, 220, '«execution environment»\nApp Server (Docker)'),
            N('jar', 'uml.artifact', 380, 160, 200, 60, '«artifact»\norder-service.jar'),
            N('dbs', 'uml.node', 760, 60, 220, 220, '«device»\nDB Server'),
            N('sch', 'uml.artifact', 790, 160, 160, 60, '«schema»\norders_db'),
          ],
          [
            L('c1', 'uml.association', 'client', 'srv', { label: 'HTTPS' }),
            L('c2', 'uml.association', 'srv', 'dbs', { label: 'TCP / 5432' }),
          ]),
    },
    umlActivityTest: {
      mode: 'uml', group: P.verif, name: 'Activity diagram – quy trình kiểm thử (CI)',
      desc: 'Luồng kiểm định: build, unit test, chạy song song integration test và phân tích tĩnh (fork/join), báo cáo kết quả.',
      build: () =>
        doc('Activity: Kiểm định trong CI', 'uml',
          [
            N('i', 'uml.initial', 205, 40, 30, 30),
            N('a1', 'uml.action', 145, 100, 150, 50, 'Commit mã nguồn'),
            N('a2', 'uml.action', 145, 190, 150, 50, 'Build & Unit test'),
            N('d1', 'uml.decision', 198, 270, 44, 44, ''),
            N('fk', 'uml.forkH', 140, 350, 160, 8),
            N('a3', 'uml.action', 40, 400, 150, 50, 'Integration test'),
            N('a4', 'uml.action', 250, 400, 150, 50, 'Phân tích tĩnh'),
            N('jn', 'uml.forkH', 140, 490, 160, 8),
            N('a5', 'uml.action', 145, 540, 150, 50, 'Báo cáo kiểm định'),
            N('f', 'uml.final', 203, 620, 34, 34),
            N('a6', 'uml.action', 400, 267, 150, 50, 'Sửa lỗi'),
          ],
          [
            L('e1', 'uml.transition', 'i', 'a1'),
            L('e2', 'uml.transition', 'a1', 'a2'),
            L('e3', 'uml.transition', 'a2', 'd1'),
            L('e4', 'uml.transition', 'd1', 'fk', { label: '[đạt]' }),
            L('e5', 'uml.transition', 'd1', 'a6', { label: '[lỗi]', sourcePort: 'right' }),
            L('e6', 'uml.transition', 'a6', 'a1', { sourcePort: 'top', targetPort: 'right' }),
            L('e7', 'uml.transition', 'fk', 'a3'),
            L('e8', 'uml.transition', 'fk', 'a4'),
            L('e9', 'uml.transition', 'a3', 'jn'),
            L('e10', 'uml.transition', 'a4', 'jn'),
            L('e11', 'uml.transition', 'jn', 'a5'),
            L('e12', 'uml.transition', 'a5', 'f'),
          ]),
    },
    umlStateCR: {
      mode: 'uml', group: P.maint, name: 'State Machine – yêu cầu thay đổi',
      desc: 'Vòng đời của một yêu cầu thay đổi / sửa lỗi trong bảo trì: phân tích tác động, phê duyệt, thực hiện, kiểm thử hồi quy.',
      build: () =>
        doc('State machine: Change Request', 'uml',
          [
            N('i', 'uml.initial', 40, 130, 30, 30),
            N('s1', 'uml.state', 110, 115, 150, 60, 'Đã ghi nhận'),
            N('s2', 'uml.state', 360, 115, 150, 60, 'Phân tích tác động'),
            N('s3', 'uml.state', 610, 115, 150, 60, 'Đang thực hiện'),
            N('s4', 'uml.state', 860, 115, 150, 60, 'Kiểm thử hồi quy'),
            N('s5', 'uml.state', 860, 280, 150, 60, 'Đã đóng'),
            N('s6', 'uml.state', 360, 280, 150, 60, 'Bị từ chối'),
            N('f', 'uml.final', 668, 293, 34, 34),
          ],
          [
            L('t0', 'uml.transition', 'i', 's1'),
            L('t1', 'uml.transition', 's1', 's2', { label: 'phânTích()' }),
            L('t2', 'uml.transition', 's2', 's3', { label: '[được duyệt]' }),
            L('t3', 'uml.transition', 's2', 's6', { label: '[từ chối]' }),
            L('t4', 'uml.transition', 's3', 's4', { label: 'hoànThành()' }),
            L('t5', 'uml.transition', 's4', 's3', { label: '[lỗi hồi quy]', sourcePort: 'top', targetPort: 'top' }),
            L('t6', 'uml.transition', 's4', 's5', { label: '[đạt]' }),
            L('t7', 'uml.transition', 's5', 'f'),
            L('t8', 'uml.transition', 's6', 'f'),
          ]),
    },
  };
})(window.DE);
