/* =====================================================================
   GĐ2 – Hợp đồng & thanh toán, Bản vẽ, sinh việc từ quy trình mẫu,
   mẫu tờ trình LCNT / thanh toán HĐ / nghĩa vụ tài chính đất đai,
   nạp gói dữ liệu riêng (.json) – giá trị hợp đồng không đưa lên repo công khai.
   Nạp sau app.js và tien-do.js; dùng chung D, UI, HD, MAU, luu, render…
   ===================================================================== */
const NHOM_HD = ['Tư vấn quy hoạch, khảo sát', 'Tư vấn thiết kế, thẩm tra', 'Tư vấn môi trường, PCCC', 'GPMB, đo đạc', 'Xây lắp, rà phá bom mìn', 'Kiểm toán, pháp lý', 'Truyền thông, sự kiện', 'Văn phòng', 'Khác'];
const TT_HD = ['Chờ ký', 'Đang thực hiện', 'Chờ quyết toán', 'Đã quyết toán', 'Đã thanh lý', 'Hủy'];
const LOAI_TT = ['Tạm ứng', 'Thanh toán', 'Quyết toán'];
const GD_BV = ['Quy hoạch 1/2000', 'Khảo sát', 'BCNCKT – thiết kế cơ sở', 'Thiết kế BVTC', 'PCCC', 'Cảnh quan, kiến trúc', 'Khác'];
const TT_BV = ['Đang lập', 'Nộp thẩm định', 'Đã thẩm định/duyệt', 'Bản cũ'];
const hd = id => D.hopDong.find(x => x.id === id);
const bv = id => D.banVe.find(x => x.id === id);
const giaTriHD = x => (x.dieuChinh?.length ? x.dieuChinh[x.dieuChinh.length - 1].giaTriMoi : x.giaTri);
const daTraHD = x => (x.thanhToan || []).reduce((s, t) => s + (+t.soTien || 0), 0);
const hdHuy = x => x.trangThai === 'Hủy';
const LOP_HD = { 'Chờ ký': 'st-chua', 'Đang thực hiện': 'st-lam', 'Chờ quyết toán': 'st-canh', 'Đã quyết toán': 'st-xong', 'Đã thanh lý': 'st-xong', 'Hủy': 'st-chua' };
UI.hdLoc ||= ''; UI.hdTim ||= '';

/* ---------------------- chuẩn hoá & gói dữ liệu ---------------------- */
function chuanHoaGD2(d) {
  d.hopDong ||= []; d.banVe ||= [];
  for (const x of d.hopDong) { x.dieuChinh ||= []; x.thanhToan ||= []; x.vbIds ||= []; }
  return d;
}
// Gộp một gói dữ liệu (cùng cấu trúc boSung): thêm bản ghi còn thiếu theo id; bản ghi đã có thì chỉ điền ô trống;
// thanh toán/điều chỉnh thêm dòng chưa có. Không ghi đè số đã sửa tay.
function apGoiDuLieu(d, g) {
  chuanHoaGD2(d); const dem = { moi: 0, dien: 0, tt: 0 };
  const rong = v => v == null || v === '';
  for (const [k, ds] of [['hopDong', d.hopDong], ['banVe', d.banVe], ['vanBan', d.vanBan]]) {
    for (const x of g[k] || []) {
      const c = ds.find(y => y.id === x.id);
      if (!c) { ds.push(structuredClone(x)); dem.moi++; continue; }
      for (const [f, v] of Object.entries(x)) {
        if (f === 'thanhToan' || f === 'dieuChinh') {
          c[f] ||= [];
          for (const t of v || []) if (!c[f].some(u => (u.ngay || '') === (t.ngay || '') && +(u.soTien ?? u.giaTriMoi) === +(t.soTien ?? t.giaTriMoi))) { c[f].push(structuredClone(t)); dem.tt++; }
          c[f].sort((a, b) => (a.ngay || '').localeCompare(b.ngay || ''));
        } else if (f === 'vbIds' || f === 'lienKet') { c[f] ||= []; for (const t of v || []) if (!c[f].some(u => JSON.stringify(u) === JSON.stringify(t))) c[f].push(t); }
        else if (rong(c[f]) && !rong(v)) { c[f] = structuredClone(v); dem.dien++; }
      }
    }
  }
  return dem;
}

/* ------------------------------ HỢP ĐỒNG ------------------------------ */
function veHopDong() {
  const ds = D.hopDong.filter(x => (!UI.hdLoc || x.nhom === UI.hdLoc) && khop([x.so, x.doiTac, x.noiDung, x.ghiChu].join(' '), UI.hdTim))
    .sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
  const conHieuLuc = D.hopDong.filter(x => !hdHuy(x));
  const tong = conHieuLuc.reduce((s, x) => s + (+giaTriHD(x) || 0), 0), tra = conHieuLuc.reduce((s, x) => s + daTraHD(x), 0);
  const thieu = conHieuLuc.filter(x => giaTriHD(x) == null);
  return `<h2>Gói thầu – Hợp đồng – Thanh toán</h2>
  <div class="luoi kpi">
    <div class="the"><span>Hợp đồng đang theo dõi</span><b>${conHieuLuc.length}</b><span>${D.hopDong.length - conHieuLuc.length} hợp đồng đã hủy</span></div>
    <div class="the"><span>Tổng giá trị hiện hành (đã nhập)</span><b>${tyDong(tong)}</b><span>${thieu.length ? `<span style="color:var(--canh)">${thieu.length} HĐ chưa nhập giá trị</span>` : 'đủ giá trị'}</span></div>
    <div class="the"><span>Đã tạm ứng, thanh toán</span><b>${tyDong(tra)}</b><span>${tong ? fmtSo(tra / tong * 100, 1) + '% giá trị đã nhập' : ''}</span>
      <div class="thanh"><i style="width:${tong ? Math.min(100, tra / tong * 100) : 0}%"></i></div></div>
    <div class="the"><span>Còn phải trả</span><b>${tyDong(tong - tra)}</b><span>theo các HĐ đã có giá trị</span></div>
  </div>
  <div class="cong-cu">
    <select class="o" data-loc="hdLoc"><option value="">Mọi nhóm</option>${NHOM_HD.map(s => `<option ${UI.hdLoc === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <input class="o" type="search" placeholder="Tìm số HĐ, đối tác, nội dung…" value="${esc(UI.hdTim)}" data-loc="hdTim" style="min-width:240px">
    <span class="gian"></span><span class="muted nho">${ds.length} hợp đồng</span>
    <button class="nut" data-act="phieu-lcnt" title="Tạo phiếu để Claude soạn tờ trình chủ trương, kế hoạch / kết quả lựa chọn nhà thầu">Soạn tờ trình LCNT</button>
    <button class="nut" data-act="nap-goi">Nạp gói dữ liệu (.json)…</button>
    <button class="nut chinh" data-act="them-hd">+ Thêm hợp đồng</button></div>
  <div class="bang-wrap" data-cuon="bang-hd"><table><thead><tr><th>Số HĐ / ngày</th><th>Đối tác</th><th>Nội dung</th><th>Nhóm</th><th class="so">Giá trị hiện hành (đ)</th><th class="so">Đã trả (đ)</th><th class="so">Còn lại (đ)</th><th>Trạng thái</th><th>File</th></tr></thead><tbody>
  ${ds.map(x => { const g = giaTriHD(x), t = daTraHD(x), vuot = g != null && t > g + 1; return `<tr class="click" data-act="mo-hd" data-id="${x.id}">
    <td class="nho"><b>${esc(x.so || '—')}</b><br><span class="muted">${fmtNgay(x.ngay)}</span></td><td>${esc(x.doiTac)}</td><td class="nho">${esc(x.noiDung)}</td><td class="nho">${esc(x.nhom)}</td>
    <td class="so">${g != null ? fmtSo(g) : '<span class="chip st-canh">chưa nhập</span>'}${x.dieuChinh.length ? `<br><span class="muted nho">đ/c ${x.dieuChinh.length} lần</span>` : ''}</td>
    <td class="so">${t ? fmtSo(t) : '—'}${g ? `<br><span class="muted nho">${fmtSo(t / g * 100, 1)}%</span>` : ''}${vuot ? '<br><span class="chip st-cham">vượt giá trị</span>' : ''}</td>
    <td class="so">${g != null ? fmtSo(g - t) : ''}</td>
    <td><span class="chip ${LOP_HD[x.trangThai] || ''}">${esc(x.trangThai)}</span></td>
    <td>${x.duongDan ? `<button class="nut nho" data-act="mo-file" data-p="${esc(x.duongDan)}">Mở</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="9" class="rong-tam">Chưa có hợp đồng.</td></tr>'}
  </tbody></table></div>
  <p class="muted nho">Giá trị hợp đồng và các lần thanh toán là số liệu nội bộ: nhập trực tiếp, hoặc nạp file gói dữ liệu đặt trong thư mục dự án. Bản web công khai không chứa các số này. "Đã trả" gồm tạm ứng và các lần thanh toán (số tiền thực chuyển).</p>`;
}
function drawerHd(id) {
  const x = hd(id); if (!x) return '';
  const inp = (f, kieu = 'text', gt = x[f]) => `<input type="${kieu}" data-sua="hd" data-id="${id}" data-f="${f}" value="${esc(gt ?? '')}">`;
  const so = (f, gt) => `<input class="so" data-sua="hd" data-id="${id}" data-f="${f}" value="${fmtSo(gt)}">`;
  const sel = (f, ds) => `<select data-sua="hd" data-id="${id}" data-f="${f}">${ds.map(s => `<option ${s === x[f] ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  const g = giaTriHD(x), t = daTraHD(x);
  let luyKe = 0;
  return `<div class="dau"><div><span class="muted nho">Hợp đồng</span><h3 style="margin:2px 0 0">${esc(x.so || 'Hợp đồng mới')} – ${esc(x.doiTac)}</h3></div><button class="nut" data-act="dong-drawer">✕</button></div>
  ${x.ghiChuTien ? `<p class="nho canh-hop">${esc(x.ghiChuTien)}</p>` : ''}
  <p class="nho">Giá trị hiện hành: <b>${g != null ? fmtSo(g) + ' đ' : 'chưa nhập'}</b> · Đã trả: <b>${fmtSo(t) || 0} đ</b>${g ? ` (${fmtSo(t / g * 100, 1)}%) · Còn lại: <b>${fmtSo(g - t)} đ</b>` : ''}</p>
  <div class="form">
    <label>Số hợp đồng${inp('so')}</label><label>Ngày ký${inp('ngay', 'date')}</label>
    <label class="rong">Đối tác (nhà thầu)${inp('doiTac')}</label>
    <label class="rong">Nội dung / gói thầu<textarea data-sua="hd" data-id="${id}" data-f="noiDung">${esc(x.noiDung)}</textarea></label>
    <label>Nhóm${sel('nhom', NHOM_HD)}</label><label>Trạng thái${sel('trangThai', TT_HD)}</label>
    <label>Giá trị ký (gồm VAT, đ)${so('giaTri', x.giaTri)}</label><label>Hạn hoàn thành${inp('hanHoanThanh', 'date')}</label>
    <label class="rong">File hợp đồng (đường dẫn trong thư mục dự án)${inp('duongDan')}</label>
    <label class="rong">Ghi chú<textarea data-sua="hd" data-id="${id}" data-f="ghiChu">${esc(x.ghiChu)}</textarea></label>
  </div>
  <div class="muc"><h3>Điều chỉnh giá trị (phụ lục)</h3>${x.dieuChinh.map((d, i) => `<div class="the-vb"><span class="fill">${esc(d.so)} ngày ${fmtNgay(d.ngay)} → <b>${fmtSo(d.giaTriMoi)} đ</b><br><span class="muted nho">${esc(d.ghiChu || '')}</span></span><button class="nut nho xoa" data-act="hd-bo-dc" data-id="${id}" data-i="${i}">✕</button></div>`).join('') || '<p class="muted nho">Chưa có.</p>'}
    <div class="form"><label>Số phụ lục<input id="hdc-so"></label><label>Ngày<input id="hdc-ngay" type="date"></label><label>Giá trị mới (gồm VAT)<input id="hdc-gt" class="so"></label><label>Nội dung<input id="hdc-gc"></label></div>
    <button class="nut" style="margin-top:8px" data-act="hd-them-dc" data-id="${id}">Thêm điều chỉnh</button></div>
  <div class="muc"><h3>Tạm ứng, thanh toán, quyết toán</h3>
    ${x.thanhToan.length ? `<table><thead><tr><th>Lần</th><th>Ngày</th><th class="so">Số tiền (đ)</th><th class="so">Lũy kế</th><th></th></tr></thead><tbody>${x.thanhToan.map((p, i) => { luyKe += +p.soTien || 0; return `<tr><td class="nho">${esc(p.loai)}${p.ghiChu ? `<br><span class="muted">${esc(p.ghiChu)}</span>` : ''}</td><td class="nho">${fmtNgay(p.ngay)}</td><td class="so">${fmtSo(p.soTien)}</td><td class="so">${fmtSo(luyKe)}${g ? `<br><span class="muted nho">${fmtSo(luyKe / g * 100, 1)}%</span>` : ''}</td><td><button class="nut nho xoa" data-act="hd-bo-tt" data-id="${id}" data-i="${i}">✕</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted nho">Chưa có lần thanh toán nào.</p>'}
    <div class="form"><label>Loại<select id="htt-loai">${LOAI_TT.map(s => `<option>${s}</option>`).join('')}</select></label><label>Ngày chuyển<input id="htt-ngay" type="date"></label><label>Số tiền thực chuyển (đ)<input id="htt-tien" class="so"></label><label>Ghi chú (tờ trình, hóa đơn…)<input id="htt-gc"></label></div>
    <button class="nut" style="margin-top:8px" data-act="hd-them-tt" data-id="${id}">Thêm lần thanh toán</button></div>
  <div class="muc"><h3>Văn bản liên quan</h3>${x.vbIds.map(vb).filter(Boolean).map(v => theVb(v, 'hd-bo-vb', id)).join('') || '<p class="muted nho">Chưa có.</p>'}
    <div class="cong-cu"><input class="o" list="dl-vb" id="hd-vb" placeholder="Gõ số hoặc trích yếu văn bản…" style="flex:1"><button class="nut" data-act="hd-gan-vb" data-id="${id}">Gắn</button></div>
    <div class="cong-cu"><button class="nut chinh" data-act="phieu-tt-hd" data-id="${id}">Soạn tờ trình thanh toán (Claude)</button><button class="nut" data-act="phieu-lcnt" data-id="${id}">Soạn tờ trình LCNT (Claude)</button></div></div>
  <div class="muc"><button class="nut xoa" data-act="xoa-hd" data-id="${id}">Xoá hợp đồng này</button></div>`;
}

/* ------------------------------- BẢN VẼ ------------------------------- */
function fileTrongThuMuc(p) {
  if (!CHI_MUC || !p) return null; const k = nfc(p).toLowerCase() + '\\';
  return CHI_MUC.files.filter(f => nfc(f.p).toLowerCase().startsWith(k));
}
function veBanVe() {
  const nhom = GD_BV.map(g => [g, D.banVe.filter(x => x.giaiDoan === g)]).filter(([, ds]) => ds.length);
  return `<h2>Sổ bản vẽ, hồ sơ thiết kế</h2>
  <div class="cong-cu"><span class="muted nho">${D.banVe.length} bộ hồ sơ · mỗi bộ trỏ tới một thư mục trong hồ sơ dự án (giữ nguyên khi chuyển lên cloud)</span><span class="gian"></span>
    ${CHI_MUC ? '' : '<span class="chip st-canh">Chưa quét thư mục – chưa đếm được số file</span>'}<button class="nut chinh" data-act="them-bv">+ Thêm bộ bản vẽ</button></div>
  ${nhom.map(([g, ds]) => `<div class="the" style="margin-top:12px"><h3>${esc(g)}</h3><div class="bang-wrap" style="border:0"><table><thead><tr><th>Bộ hồ sơ</th><th>Đơn vị lập</th><th>Ngày</th><th>Trạng thái</th><th>Căn cứ duyệt / thẩm định</th><th class="so">Số file</th></tr></thead><tbody>
    ${ds.map(x => { const fs = fileTrongThuMuc(x.duongDan), cc = vb(x.vbId); return `<tr class="click" data-act="mo-bv" data-id="${x.id}">
      <td><b>${esc(x.ten)}</b><br><span class="muted nho">${esc(x.duongDan)}</span></td><td class="nho">${esc(x.donVi || '')}</td><td class="nho">${fmtNgay(x.ngay)}</td>
      <td><span class="chip ${x.trangThai === 'Đã thẩm định/duyệt' ? 'st-xong' : x.trangThai === 'Bản cũ' ? 'st-chua' : x.trangThai === 'Nộp thẩm định' ? 'st-canh' : 'st-lam'}">${esc(x.trangThai)}</span></td>
      <td class="nho">${cc ? esc([cc.so, fmtNgay(cc.ngay)].filter(Boolean).join(' ')) : esc(x.canCu || '')}</td>
      <td class="so">${fs ? (fs.length ? fmtSo(fs.length) : '<span class="chip st-cham">không thấy</span>') : '—'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`).join('') || '<div class="the rong-tam">Chưa có bộ bản vẽ nào.</div>'}`;
}
function drawerBv(id) {
  const x = bv(id); if (!x) return '';
  const inp = (f, kieu = 'text') => `<input type="${kieu}" data-sua="bv" data-id="${id}" data-f="${f}" value="${esc(x[f] ?? '')}">`;
  const sel = (f, ds) => `<select data-sua="bv" data-id="${id}" data-f="${f}">${ds.map(s => `<option ${s === x[f] ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  const fs = fileTrongThuMuc(x.duongDan) || [];
  const chinh = fs.filter(f => /\.(pdf)$/i.test(f.p)).slice(0, 40);
  return `<div class="dau"><div><span class="muted nho">Bộ bản vẽ / hồ sơ thiết kế</span><h3 style="margin:2px 0 0">${esc(x.ten)}</h3></div><button class="nut" data-act="dong-drawer">✕</button></div>
  <div class="form">
    <label class="rong">Tên bộ hồ sơ${inp('ten')}</label>
    <label>Giai đoạn${sel('giaiDoan', GD_BV)}</label><label>Trạng thái${sel('trangThai', TT_BV)}</label>
    <label>Đơn vị lập${inp('donVi')}</label><label>Ngày (nộp / chốt)${inp('ngay', 'date')}</label>
    <label class="rong">Thư mục trong hồ sơ dự án${inp('duongDan')}</label>
    <label class="rong">Căn cứ duyệt / thẩm định (ghi chú)${inp('canCu')}</label>
    <label class="rong">Ghi chú<textarea data-sua="bv" data-id="${id}" data-f="ghiChu">${esc(x.ghiChu)}</textarea></label>
  </div>
  <div class="muc"><div class="cong-cu"><button class="nut" data-act="chep-duong-dan" data-p="${esc(x.duongDan)}">Chép đường dẫn thư mục</button></div>
    ${vb(x.vbId) ? theVb(vb(x.vbId), '') : ''}
    ${CHI_MUC ? `<p class="nho">${fs.length} file trong thư mục${chinh.length ? `; ${chinh.length} file PDF:` : '.'}</p>${chinh.map(f => `<div class="the-vb"><span class="fill nho">${esc(f.p.slice(nfc(x.duongDan).length + 1))}</span><button class="nut nho" data-act="mo-file" data-p="${esc(f.p)}">Mở</button></div>`).join('')}` : '<p class="muted nho">Quét thư mục (Cài đặt → Quét hồ sơ) để xem danh sách file.</p>'}</div>
  <div class="muc"><button class="nut xoa" data-act="xoa-bv" data-id="${id}">Xoá khỏi sổ (không xoá file)</button></div>`;
}

/* ------------------------ SINH VIỆC TỪ QUY TRÌNH ------------------------ */
function veSinhViec(ma, tienTo) {
  const q = D.quyTrinhMau.find(x => x.ma === ma); if (!q) return '';
  const n = q.buoc.filter(b => b.buoc).length;
  return `<div class="muc"><h3>Sinh việc theo quy trình mẫu</h3>
    <p class="nho muted">${esc(q.ten)} – ${n} bước. Mỗi bước thành một việc trong tab Tiến độ, nối tiếp nhau theo số ngày dự kiến của quy trình; bước đã có việc cùng tên thì bỏ qua.</p>
    <div class="form"><label>Bắt đầu từ ngày<input id="sv-ngay" type="date" value="${homNay()}"></label>
      <label>Nhóm việc<select id="sv-nhom">${D.nhom.map(g => `<option value="${g.ma}" ${g.ma === (ma === 'gpmb' ? 'B' : 'D') ? 'selected' : ''}>${g.ma}. ${esc(g.ten)}</option>`).join('')}</select></label>
      <label class="rong">Tiền tố tên việc<input id="sv-tien-to" value="${esc(tienTo)}"></label></div>
    <button class="nut" style="margin-top:8px" data-act="sinh-viec-qt" data-ma="${ma}">Sinh việc</button></div>`;
}
function sinhViecQT(ma, batDau, nhom, tienTo) {
  const q = D.quyTrinhMau.find(x => x.ma === ma); if (!q || !hopLeNgay(batDau)) return 0;
  let ngay = batDau, truoc = null, tt = Math.max(0, ...D.viec.map(v => v.tt)), soMoi = 0;
  const daCo = new Set(D.viec.map(v => nfc(v.ten)));
  for (const b of q.buoc.filter(b => b.buoc)) {
    const soNgay = Math.max(1, parseInt(b.ngayKH, 10) || 1);
    const ten = `${tienTo}: ${b.buoc} – ${b.ten}`;
    const ketThuc = congNgay(ngay, soNgay - 1);
    if (!daCo.has(nfc(ten))) {
      const v = { id: uid('v'), tt: ++tt, nhom, ten, batDau: ngay, ketThuc, soNgay, chuTri: b.chuTri || '', phoiHop: '', ghiChu: `Sinh từ quy trình mẫu "${q.ten}". Thời hạn: ${b.han || '—'}`.slice(0, 500),
        moc: '', trangThai: 'Chưa làm', pct: 0, giaoCho: '', phuThuoc: truoc ? [{ id: truoc, kieu: 'FS' }] : [], checklist: [], vanBan: [], nhatKy: [{ luc: new Date().toISOString(), noiDung: 'Sinh từ quy trình mẫu' }], canXacNhan: false };
      D.viec.push(v); truoc = v.id; soMoi++;
    } else truoc = D.viec.find(v => nfc(v.ten) === nfc(ten))?.id || truoc;
    ngay = congNgay(ketThuc, 1);
  }
  if (soMoi) ghiNhatKyChung(`Sinh ${soMoi} việc từ quy trình mẫu "${q.ten}" (${tienTo})`);
  return soMoi;
}

/* --------------------------- PHIẾU TỜ TRÌNH --------------------------- */
Object.assign(MAU, {
  'ttr-thanh-toan-hd': {
    ten: 'Tờ trình tạm ứng / thanh toán / quyết toán hợp đồng', loai: 'Tờ trình', thuMuc: '03. Các văn bản\\03. Tờ trình',
    mauThamKhao: ['03. Các văn bản\\03. Tờ trình\\2026.09.25. Thanh toán lần 1 và ký bổ sung phụ lục 01 HĐ 27-NT-2026-HĐTV-LD (ver5).docx',
      '03. Các văn bản\\03. Tờ trình\\2026.09.28. Đề nghị thanh toán đợt 1 HĐ tư vấn GPMT KCN Văn Giang (ver1).docx'],
  },
  'ttr-lcnt': {
    ten: 'Tờ trình chủ trương, kế hoạch và kết quả lựa chọn nhà thầu', loai: 'Tờ trình', thuMuc: '03. Các văn bản\\03. Tờ trình',
    mauThamKhao: ['06. Nhà thầu\\Nhà thầu trích đo GPMB\\Hồ sơ hoàn thiện trích đo 21.10\\A. Lựa chọn nhà thầu\\2026.10.21. 1. TTr chủ trương, kế hoạch gói thầu trích đo (ver2).docx',
      '06. Nhà thầu\\Nhà thầu trích đo GPMB\\Hồ sơ hoàn thiện trích đo 21.10\\A. Lựa chọn nhà thầu\\2026.10.21. 6. TTr phê duyệt kết quả chỉ định thầu gói thầu trích đo (ver2).docx',
      '03. Các văn bản\\03. Tờ trình\\2026.10.28. TTr bổ sung hồ sơ LCNT ký lại HĐ và điều chỉnh hóa đơn gói thầu trích đo ver1.docx'],
  },
  'ttr-nvtc-dat': {
    ten: 'Tờ trình nộp nghĩa vụ tài chính đất đai (tiền thuê đất, tiền bảo vệ đất lúa, lệ phí trước bạ)', loai: 'Tờ trình', thuMuc: '03. Các văn bản\\03. Tờ trình',
    mauThamKhao: ['03. Các văn bản\\03. Tờ trình\\2026.10.22. Đề xuất nộp nghĩa vụ tài chính đất đai KCN Văn Giang GĐ1 (ver1).docx'],
  },
});
const soNganHD = x => (x.so || 'HĐ mới').replace(/[\\/:*?"<>|]/g, '-');
function phieuThanhToanHd(id) {
  const x = hd(id); if (!x) return;
  const g = giaTriHD(x), t = daTraHD(x);
  taoPhieu({ mau: 'ttr-thanh-toan-hd', tieuDe: `Tờ trình thanh toán hợp đồng ${x.so} – ${x.doiTac}`, noiDungNgan: `TTr thanh toán HĐ ${soNganHD(x)}`, doiTuong: { kieu: 'hd', id },
    duLieu: { hopDong: x, giaTriHienHanh: g, daThanhToanLuyKe: t, conLai: g != null ? g - t : null, tyLeDaTra: g ? Math.round(t / g * 1000) / 10 : null },
    canCu: x.vbIds.map(i => canCuTuVb(i, 'Văn bản liên quan hợp đồng')),
    yeuCauThem: 'Lập bảng: giá trị HĐ (sau điều chỉnh), đã tạm ứng/thanh toán lũy kế, đề nghị lần này, khấu trừ tạm ứng, còn lại. Đối chiếu điều khoản thanh toán của HĐ và hồ sơ nghiệm thu, hóa đơn.' });
}
function phieuLcnt(id) {
  const x = id ? hd(id) : null;
  taoPhieu({ mau: 'ttr-lcnt', tieuDe: `Tờ trình lựa chọn nhà thầu${x ? ' – ' + x.noiDung : ''}`, noiDungNgan: `TTr LCNT ${x ? (x.noiDung || '').slice(0, 60).replace(/[\\/:*?"<>|]/g, '-') : 'goi thau'}`, doiTuong: x ? { kieu: 'hd', id } : null,
    duLieu: { hopDong: x, cacHopDongCungNhom: x ? D.hopDong.filter(h => h.nhom === x.nhom && h.id !== x.id).map(h => ({ so: h.so, doiTac: h.doiTac, noiDung: h.noiDung, trangThai: h.trangThai })) : [] },
    canCu: x ? x.vbIds.map(i => canCuTuVb(i, 'Văn bản liên quan')) : [],
    yeuCauThem: 'Xác định hình thức lựa chọn nhà thầu (chỉ định thầu rút gọn / chào hàng cạnh tranh…), giá gói thầu, nguồn vốn, thời gian thực hiện; kèm danh mục hồ sơ pháp lý gói thầu theo mẫu bộ hồ sơ trích đo 21/10/2026.' });
}
function phieuNvtc(tdId) {
  const x = tdDot(tdId); if (!x) return;
  taoPhieu({ mau: 'ttr-nvtc-dat', tieuDe: `Tờ trình nộp nghĩa vụ tài chính đất đai – ${x.ten}`, noiDungNgan: `De xuat nop NVTC dat dai ${x.ten}`.slice(0, 80).replace(/[\\/:*?"<>|]/g, '-'), doiTuong: { kieu: 'td', id: tdId },
    duLieu: { dotThueDat: x, mienGiam: tomTatMG(x).ds.map(m => ({ ten: m.ten, trangThai: NHAN_MG[m.tt], han: m.han, xong: m.xong })), mocMien: mocMien(x) },
    canCu: [x.qdVbId ? canCuTuVb(x.qdVbId, 'QĐ cho thuê đất') : null],
    yeuCauThem: 'Lập bảng từng khoản (tiền thuê đất, tiền bảo vệ phát triển đất trồng lúa, lệ phí trước bạ): số thông báo Thuế, diện tích, số phải nộp, số được miễn/giảm, số còn nộp, hạn nộp; nêu rõ khoản đã đề nghị miễn mà Thuế vẫn thông báo thu.' });
}

/* ------------------------------ KIỂM TRA ------------------------------ */
function kiemTraGD2(them) {
  const idVb = new Set(D.vanBan.map(v => v.id));
  for (const x of D.hopDong) {
    const g = giaTriHD(x), t = daTraHD(x), ten = `HĐ ${x.so || '(chưa có số)'} – ${x.doiTac}`;
    if (hdHuy(x)) { if (t) them('Hợp đồng', 'canh', `${ten}: đã hủy nhưng còn ${fmtSo(t)} đ tạm ứng/thanh toán – cần thu hồi hoặc bù trừ.`, { act: 'mo-hd', id: x.id }); continue; }
    if (g != null && t > g + 1) them('Hợp đồng', 'loi', `${ten}: đã trả ${fmtSo(t)} đ vượt giá trị hiện hành ${fmtSo(g)} đ.`, { act: 'mo-hd', id: x.id });
    if (g == null && x.trangThai !== 'Chờ ký') them('Hợp đồng', 'canh', `${ten}: chưa nhập giá trị hợp đồng.`, { act: 'mo-hd', id: x.id });
    if (['Đã quyết toán', 'Đã thanh lý'].includes(x.trangThai) && g != null && Math.abs(g - t) > 1) them('Hợp đồng', 'canh', `${ten}: trạng thái "${x.trangThai}" nhưng đã trả ${fmtSo(t)}/${fmtSo(g)} đ.`, { act: 'mo-hd', id: x.id });
    if (x.hanHoanThanh && x.hanHoanThanh < homNay() && x.trangThai === 'Đang thực hiện') them('Hợp đồng', 'canh', `${ten}: quá hạn hoàn thành ${fmtNgay(x.hanHoanThanh)} – cần phụ lục gia hạn hoặc nghiệm thu.`, { act: 'mo-hd', id: x.id });
    for (const i of x.vbIds) if (!idVb.has(i)) them('Hợp đồng', 'loi', `${ten}: gắn văn bản không còn trong sổ.`, { act: 'mo-hd', id: x.id });
  }
  if (CHI_MUC) for (const x of D.banVe) { const fs = fileTrongThuMuc(x.duongDan); if (fs && !fs.length) them('Bản vẽ', 'canh', `Bộ "${x.ten}": không thấy thư mục ${x.duongDan}.`, { act: 'mo-bv', id: x.id }); }
  for (const x of D.hopDong) if (x.duongDan && CHI_MUC && !CHI_MUC.files.some(f => nfc(f.p) === nfc(x.duongDan))) them('Hợp đồng', 'canh', `HĐ ${x.so}: không thấy file ${x.duongDan}.`, { act: 'mo-hd', id: x.id });
}
function sheetGD2(wb) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Số HĐ', 'Ngày ký', 'Đối tác', 'Nội dung', 'Nhóm', 'Giá trị hiện hành (đ)', 'Đã trả lũy kế (đ)', 'Còn lại (đ)', 'Trạng thái', 'Hạn hoàn thành', 'File', 'Ghi chú'],
    ...D.hopDong.map(x => { const g = giaTriHD(x), t = daTraHD(x); return [x.so, fmtNgay(x.ngay), x.doiTac, x.noiDung, x.nhom, g, t, g != null ? g - t : null, x.trangThai, fmtNgay(x.hanHoanThanh), x.duongDan, x.ghiChu]; })]), 'Hợp đồng');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Số HĐ', 'Đối tác', 'Loại', 'Ngày', 'Số tiền (đ)', 'Ghi chú'],
    ...D.hopDong.flatMap(x => x.thanhToan.map(p => [x.so, x.doiTac, p.loai, fmtNgay(p.ngay), p.soTien, p.ghiChu]))]), 'Thanh toán HĐ');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Giai đoạn', 'Bộ hồ sơ', 'Đơn vị lập', 'Ngày', 'Trạng thái', 'Căn cứ', 'Thư mục'],
    ...D.banVe.map(x => [x.giaiDoan, x.ten, x.donVi, fmtNgay(x.ngay), x.trangThai, x.canCu || vb(x.vbId)?.so || '', x.duongDan])]), 'Bản vẽ');
}
function veNapGoi() {
  return `<div class="the"><h3>Gói dữ liệu bổ sung (.json)</h3>
    <p class="nho">Nạp file gói dữ liệu (VD giá trị, thanh toán hợp đồng) đặt trong thư mục dự án. App chỉ thêm bản ghi còn thiếu và điền ô đang trống, không ghi đè số đã sửa. Đã nạp: ${(D.daBoSung || []).length} gói.</p>
    <button class="nut" data-act="nap-goi">Nạp gói dữ liệu…</button></div>`;
}

/* ------------------------------ SỬA & NÚT ------------------------------ */
window.SUA_THEM = {
  hd(el, id, f, gt) {
    const x = hd(id); if (!x) return;
    x[f] = f === 'giaTri' ? docSo(gt) : gt;
  },
  bv(el, id, f, gt) { const x = bv(id); if (x) x[f] = gt; },
};
Object.assign(HD, {
  'mo-hd'(el) { UI.drawer = { kieu: 'hd', id: el.dataset.id }; veDrawer(); },
  'mo-bv'(el) { UI.drawer = { kieu: 'bv', id: el.dataset.id }; veDrawer(); },
  'them-hd'() {
    const x = { id: uid('hd'), so: '', ngay: '', doiTac: 'Đối tác mới', noiDung: '', nhom: 'Khác', giaTri: null, dieuChinh: [], thanhToan: [], trangThai: 'Chờ ký', hanHoanThanh: '', duongDan: '', vbIds: [], ghiChu: '' };
    D.hopDong.push(x); luu(); UI.drawer = { kieu: 'hd', id: x.id }; render();
  },
  'xoa-hd'(el) { const x = hd(el.dataset.id); if (!x || !confirm(`Xoá hợp đồng "${x.so} – ${x.doiTac}" khỏi app? (Không xoá file)`)) return; D.hopDong = D.hopDong.filter(h => h !== x); ghiNhatKyChung(`Xoá hợp đồng ${x.so} – ${x.doiTac}`); UI.drawer = null; luu(); render(); },
  'hd-them-tt'(el) {
    const x = hd(el.dataset.id), tien = docSo($('#htt-tien').value), ngay = $('#htt-ngay').value;
    if (tien == null || !hopLeNgay(ngay)) return thongBao('Nhập ngày và số tiền.', 'canh');
    x.thanhToan.push({ loai: $('#htt-loai').value, ngay, soTien: tien, ghiChu: $('#htt-gc').value.trim() }); x.thanhToan.sort((a, b) => a.ngay.localeCompare(b.ngay));
    ghiNhatKyChung(`HĐ ${x.so}: ghi nhận ${$('#htt-loai').value.toLowerCase()} ${fmtSo(tien)} đ ngày ${fmtNgay(ngay)}`); luu(); render();
  },
  'hd-bo-tt'(el) { const x = hd(el.dataset.id); if (!confirm('Bỏ lần thanh toán này?')) return; x.thanhToan.splice(+el.dataset.i, 1); luu(); render(); },
  'hd-them-dc'(el) {
    const x = hd(el.dataset.id), gt = docSo($('#hdc-gt').value); if (gt == null) return thongBao('Nhập giá trị mới.', 'canh');
    x.dieuChinh.push({ so: $('#hdc-so').value.trim(), ngay: $('#hdc-ngay').value, giaTriMoi: gt, ghiChu: $('#hdc-gc').value.trim() }); luu(); render();
  },
  'hd-bo-dc'(el) { hd(el.dataset.id).dieuChinh.splice(+el.dataset.i, 1); luu(); render(); },
  'hd-gan-vb'(el) {
    const s = $('#hd-vb').value.trim(), x = s && (vb(s) || D.vanBan.find(v => khop([v.so, fmtNgay(v.ngay), v.trichYeu].filter(Boolean).join(' · '), s)));
    if (!x) return thongBao('Không tìm thấy văn bản. Chọn từ danh sách gợi ý.', 'canh');
    const h = hd(el.dataset.id); if (!h.vbIds.includes(x.id)) h.vbIds.push(x.id); luu(); render();
  },
  'hd-bo-vb'(el) { const h = hd(el.dataset.cha); h.vbIds = h.vbIds.filter(i => i !== el.dataset.id); luu(); render(); },
  'phieu-tt-hd'(el) { phieuThanhToanHd(el.dataset.id); },
  'phieu-lcnt'(el) { phieuLcnt(el.dataset.id); },
  'phieu-nvtc'(el) { phieuNvtc(el.dataset.id); },
  'them-bv'() {
    const x = { id: uid('bv'), ten: 'Bộ bản vẽ mới', giaiDoan: 'Khác', trangThai: 'Đang lập', donVi: '', ngay: '', duongDan: '', canCu: '', vbId: null, ghiChu: '' };
    D.banVe.push(x); luu(); UI.drawer = { kieu: 'bv', id: x.id }; render();
  },
  'xoa-bv'(el) { const x = bv(el.dataset.id); if (!x || !confirm(`Bỏ "${x.ten}" khỏi sổ bản vẽ? (Không xoá file)`)) return; D.banVe = D.banVe.filter(b => b !== x); UI.drawer = null; luu(); render(); },
  'chep-duong-dan'(el) { chep(duongDanDayDu(el.dataset.p), 'Đã chép đường dẫn thư mục.'); },
  'sinh-viec-qt'(el) {
    const n = sinhViecQT(el.dataset.ma, $('#sv-ngay').value, $('#sv-nhom').value, $('#sv-tien-to').value.trim() || 'Quy trình');
    if (!n) return thongBao('Không có việc mới (các bước đã có việc cùng tên, hoặc ngày không hợp lệ).', 'canh');
    luu(); render(); thongBao(`Đã sinh ${n} việc trong tab Tiến độ.`);
  },
  'nap-goi'() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      try {
        const g = JSON.parse(await inp.files[0].text());
        if (!g.ma) return thongBao('File không phải gói dữ liệu của app (thiếu "ma").', 'loi');
        if ((D.daBoSung || []).includes(g.ma) && !confirm(`Gói "${g.ma}" đã nạp trước đây. Nạp lại (chỉ điền ô trống, thêm dòng thiếu)?`)) return;
        if (typeof luuPhienBan === 'function') try { luuPhienBan(`Trước khi nạp gói ${g.ma}`); } catch { }
        const dem = apGoiDuLieu(D, g);
        D.daBoSung ||= []; if (!D.daBoSung.includes(g.ma)) D.daBoSung.push(g.ma);
        ghiNhatKyChung(`Nạp gói dữ liệu ${g.ma}: ${dem.moi} bản ghi mới, ${dem.dien} ô được điền, ${dem.tt} dòng thanh toán/điều chỉnh`);
        luu(); render(); thongBao(`Đã nạp gói ${g.ma}: ${dem.moi} mới, ${dem.dien} ô điền, ${dem.tt} dòng thanh toán.`, '', 6000);
      } catch (e) { thongBao('Không đọc được file: ' + e.message, 'loi'); }
    };
    inp.click();
  },
});
