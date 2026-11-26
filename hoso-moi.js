/* =====================================================================
   Tự động hoá hồ sơ (bước 1–3):
   1. Tự quét khi kết nối: Google Drive chỉ hỏi phần thay đổi (Changes API); thư mục trên máy quét lại nếu chỉ mục cũ hơn 6 giờ.
   2. "Hồ sơ mới chờ xử lý": file mới xuất hiện sau lần quét trước → app gợi ý xử lý theo thư mục/tên file
      (vào sổ + gắn QĐ GPMB/mộ, hợp đồng, đợt thuê đất; nhập file tiến độ; ghi nhận bản vẽ/ảnh) – người dùng chạm Đồng ý.
   3. Gói dữ liệu do Claude lập (00. APP QLDA\goi-du-lieu\*.json): app tự phát hiện, xem trước thay đổi và các chỗ lệch, rồi nạp.
   ===================================================================== */
const THU_MUC_GOI = 'goi-du-lieu';
const DUOI_MEDIA = /\.(jpe?g|png|gif|heic|webp|mp4|mov|avi|mp3|wav|psd|psb|ai|svg|ttf|otf|woff2?|zip|rar|7z|las|tif|tiff|kmz|kml|bak|dst|log|lnk|url|ini|cfg)$/i;
UI.hsChon ||= null;

/* ------------------------------ 1. quét ------------------------------ */
// Đánh dấu file mới so với chỉ mục trước: f.them = thời điểm phát hiện. Lần quét đầu tiên không đánh dấu (tránh 4.000 file "mới").
function danhDauMoi(cu, moi) {
  if (!moi?.files) return;
  const truoc = new Map((cu?.files || []).map(f => [nfc(f.p), f]));
  const luc = new Date().toISOString();
  for (const f of moi.files) { const c = truoc.get(nfc(f.p)) || (f.id && cu?.files?.find(x => x.id === f.id)); f.them = c ? (c.them || '') : (cu?.files ? luc : ''); }
}
async function luuChiMuc() {
  await KHO.dat('chi-muc', CHI_MUC);
  try { await ghiJson(FS.app, 'chi-muc-ho-so.json', CHI_MUC); } catch { }
}
// Bọc hàm quét gốc (thư mục trên máy và Drive quét toàn bộ) để đánh dấu file mới.
const quetThuMucGoc = quetThuMuc;
quetThuMuc = async function () { const cu = CHI_MUC; await quetThuMucGoc(); if (CHI_MUC && CHI_MUC !== cu) { danhDauMoi(cu, CHI_MUC); await luuChiMuc(); render(); } };

// Quét tăng dần trên Drive: đọc danh sách thay đổi từ mốc lần trước. Thư mục bị đổi tên/di chuyển/xoá → quét toàn bộ.
async function quetTangDrive() {
  const cm = CHI_MUC;
  if (!cm?.mocDoi || !cm.thuMuc || cm.gocId !== FS.goc.id) return quetThuMuc();
  const thuMuc = { ...cm.thuMuc }, files = new Map(cm.files.map(f => [f.id || f.p, { ...f }])), luc = new Date().toISOString();
  let tk = cm.mocDoi, moi = 0, bo = 0, sua = 0, quetLai = false, mocMoi = '';
  const tenApp = D.caiDat.thuMucApp;
  try {
    while (tk) {
      const r = await gdJson(`https://www.googleapis.com/drive/v3/changes?pageToken=${encodeURIComponent(tk)}&pageSize=1000&includeRemoved=true&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,size,modifiedTime,trashed))`);
      const ds = (r.changes || []).sort((a, b) => (b.file?.mimeType === GD_FOLDER) - (a.file?.mimeType === GD_FOLDER)); // thư mục trước
      for (const c of ds) {
        const f = c.file, id = c.fileId, xoa = c.removed || f?.trashed, cha = f?.parents?.[0];
        if (f?.mimeType === GD_FOLDER || (xoa && id in thuMuc)) {
          if (id in thuMuc) { const p = thuMuc[id]; if (xoa || !(cha in thuMuc) || nfc(thuMuc[cha] ? thuMuc[cha] + '\\' + f.name : f.name) !== p) quetLai = true; }
          else if (!xoa && cha in thuMuc && !(thuMuc[cha] === '' && f.name === tenApp)) thuMuc[id] = nfc(thuMuc[cha] ? thuMuc[cha] + '\\' + f.name : f.name);
          continue;
        }
        if (xoa) { if (files.delete(id)) bo++; continue; }
        if (!(cha in thuMuc) || (thuMuc[cha] === '' && false)) { if (files.delete(id)) bo++; continue; }
        if (f.name.startsWith('~$') || /^(desktop\.ini|thumbs\.db)$/i.test(f.name)) continue;
        const p = nfc(thuMuc[cha] ? thuMuc[cha] + '\\' + f.name : f.name), cu = files.get(id);
        const ban = { p, kb: Math.round((+f.size || 0) / 1024), sua: ngayTuMs(Date.parse(f.modifiedTime) || 0), id, them: cu ? (cu.p === p ? cu.them || '' : luc) : luc };
        if (cu) sua++; else moi++;
        files.set(id, ban);
      }
      if (quetLai) break;
      tk = r.nextPageToken || ''; if (r.newStartPageToken) mocMoi = r.newStartPageToken;
    }
  } catch (e) { thongBao('Không đọc được thay đổi trên Drive, quét lại toàn bộ: ' + e.message, 'canh', 5000); return quetThuMuc(); }
  if (quetLai) { thongBao('Có thư mục đổi tên/di chuyển – quét lại toàn bộ.', '', 3000); return quetThuMuc(); }
  CHI_MUC = { ...cm, ngayQuet: luc, files: [...files.values()].sort((a, b) => a.p.localeCompare(b.p, 'vi')), thuMuc, mocDoi: mocMoi || cm.mocDoi };
  await luuChiMuc();
  if (moi || bo) thongBao(`Drive: ${moi} file mới, ${bo} file bỏ/xoá, ${sua} file sửa.`, '', 5000);
  return { moi, bo, sua };
}
// Gọi sau mỗi lần kết nối thư mục (máy hoặc Drive).
async function tuDongQuet() {
  if (!FS.ketNoi) return;
  try {
    if (FS.goc?.isDrive) await quetTangDrive();
    else if (!CHI_MUC || Date.now() - Date.parse(CHI_MUC.ngayQuet || 0) > 6 * 3600e3) await quetThuMuc();
    await timGoiDuLieu();
  } catch (e) { thongBao('Tự quét hồ sơ lỗi: ' + e.message, 'canh', 5000); }
  render();
}

/* ------------------------- 2. hồ sơ mới & gợi ý ------------------------- */
const soQD = ten => { const m = ten.match(/(?:QĐ|QD)[\s._-]*(\d{3,5})|(\d{3,5})[\s./_-]*(?:QĐ|QD)\b/i); return m ? (m[1] || m[2]) : ''; };
const chuanSoHD = s => khongDau(s).replace(/\s+/g, '');
function hoSoMoi() {
  if (!CHI_MUC?.files) return [];
  const daSo = new Set(D.vanBan.map(v => nfc(v.duongDan))), boQua = new Set((D.hoSoBoQua || []).map(nfc));
  return CHI_MUC.files.filter(f => f.them && !daSo.has(nfc(f.p)) && !boQua.has(nfc(f.p))).sort((a, b) => (b.them || '').localeCompare(a.them || '') || a.p.localeCompare(b.p, 'vi'));
}
// Gợi ý xử lý cho một file mới. kieu: 'tien-do' | 'ghi-nhan' | 'vao-so'; lien: liên kết gắn vào sau khi vào sổ.
function goiYHoSo(f) {
  const p = nfc(f.p), ten = p.split('\\').pop(), tm = p.split('\\').slice(0, -1).join('\\'), tt = phanTichTen(ten, tm);
  if (p.startsWith(nfc(THU_MUC_TIEN_DO) + '\\') && /\.xlsx?$/i.test(ten)) return { kieu: 'tien-do', nhan: 'Nhập file tiến độ', chiTiet: 'So sánh với tiến độ đang dùng, chọn thay đổi để áp dụng (lưu lịch sử).' };
  const bvBo = D.banVe.find(b => b.duongDan && p.startsWith(nfc(b.duongDan) + '\\'));
  if (bvBo) return { kieu: 'ghi-nhan', nhan: 'Ghi nhận vào bộ bản vẽ', chiTiet: `Thuộc bộ "${bvBo.ten}" (số file tự cập nhật, không cần vào sổ).` };
  if (DUOI_MEDIA.test(ten)) return { kieu: 'ghi-nhan', nhan: 'Ghi nhận (ảnh, clip, file nén, CAD…)', chiTiet: 'Không đưa vào sổ văn bản.' };
  const lien = [], ghi = []; let taoMoi = null;
  // GPMB: thư mục đợt, QĐ mộ, số QĐ trong tên
  const so = soQD(ten), qdKhop = so ? tatCaQD().find(x => (x.qdSo || '').startsWith(so + '/')) : null;
  const mDot = p.match(/09\. GPMB\\0(\d)\. Đợt (\d)/);
  if (qdKhop) { lien.push({ kieu: 'dot', id: qdKhop.id }); ghi.push(`gắn ${tenQD(qdKhop)}`); }
  else if (mDot && D.gpmb.dot.find(d => d.id === 'dot' + mDot[2])) { lien.push({ kieu: 'dot', id: 'dot' + mDot[2] }); ghi.push(`gắn Đợt ${mDot[2]}`); }
  // Công văn/tờ trình nhắc "đợt N" về kinh phí, chi trả GPMB → gắn đợt đó
  const mDotTen = !lien.length && /(kinh phí|chi trả|BTHT|bồi thường|GPMB)/i.test(ten) && ten.match(/đợt\s*(\d)/i);
  if (mDotTen && D.gpmb.dot.find(d => d.id === 'dot' + mDotTen[1])) { lien.push({ kieu: 'dot', id: 'dot' + mDotTen[1] }); ghi.push(`gắn Đợt ${mDotTen[1]}`); }
  const laDieuChinh = /điều chỉnh|sửa đổi|đính chính/i.test(ten);
  if (so && !qdKhop && /09\. GPMB/.test(p) && tt.loai === 'Quyết định') {
    if (laDieuChinh && lien.length) ghi.push('QĐ điều chỉnh – nhập tổng kinh phí mới ở mục "Điều chỉnh" của QĐ gốc (hoặc để Claude đọc, lập gói)');
    else { taoMoi = { kieu: /mồ mả|mộ/i.test(p) ? 'mo' : 'dot', so, ngay: tt.ngay }; ghi.push(`QĐ ${so} chưa có trong app – tạo dòng QĐ mới`); }
  }
  // Hợp đồng
  if (/^0[56]\. (Hợp đồng|Nhà thầu)\\/.test(p)) {
    const k = chuanSoHD(ten + ' ' + tm), h = D.hopDong.find(x => x.so && chuanSoHD(x.so).length >= 4 && k.includes(chuanSoHD(x.so).replace(/hd.*$/, '').slice(0, 12)));
    if (h) { lien.push({ kieu: 'hd', id: h.id }); ghi.push(`gắn HĐ ${h.so}`); }
    else if (/^05\. Hợp đồng/.test(p) && /\.pdf$/i.test(ten) && /(HĐ|HD|hợp đồng|hop dong)/i.test(ten)) { taoMoi = { kieu: 'hd', ten }; ghi.push('hợp đồng chưa có trong danh mục – thêm hợp đồng'); }
  }
  // Thuê đất: 10. Giao đất\Lần N
  const mLan = p.match(/10\. Giao đất\\Lần (\d+)/i);
  if (mLan && D.thueDat.dot[+mLan[1] - 1]) { const t = D.thueDat.dot[+mLan[1] - 1]; lien.push({ kieu: 'td', id: t.id }); ghi.push(`gắn thuê đất ${t.ten.split(' – ')[0]}`); }
  return { kieu: 'vao-so', lien, taoMoi, nhan: 'Vào sổ' + (ghi.length ? ' + ' + ghi.join(', ') : ''), chiTiet: `${tt.loai}${tt.so ? ' ' + tt.so : ''} · ${tt.chieu}${tt.ngay ? ' · ' + fmtNgay(tt.ngay) : ''} · ${tt.trichYeu}` };
}
async function xuLyHoSo(p, dungGoiY = true) {
  const f = CHI_MUC.files.find(x => nfc(x.p) === nfc(p)); if (!f) return;
  const g = dungGoiY ? goiYHoSo(f) : { kieu: 'vao-so', lien: [] };
  if (g.kieu === 'ghi-nhan') { (D.hoSoBoQua ||= []).push(f.p); return 'ghi-nhan'; }
  if (g.kieu === 'tien-do') {
    try { const file = await layFile(f.p); await nhapTienDoTuFile(file, f.p); } catch (e) { thongBao('Không đọc được file tiến độ: ' + e.message, 'loi', 6000); }
    return 'tien-do';
  }
  const v = vaoSo(f.p); if (!v) return;
  for (const l of g.lien || []) {
    v.lienKet.push(l);
    if (l.kieu === 'hd') { const h = D.hopDong.find(x => x.id === l.id); if (h && !h.vbIds.includes(v.id)) h.vbIds.push(v.id); if (h && !h.duongDan && /\.pdf$/i.test(f.p) && /(HĐ|HD|hợp đồng)/i.test(f.p)) h.duongDan = f.p; }
    if (l.kieu === 'dot') { const x = dot(l.id); if (x && !x.qdId && v.loai === 'Quyết định') { x.qdId = v.id; } }
    if (l.kieu === 'td') { const t = tdDot(l.id); if (t && !t.qdVbId && v.loai === 'Quyết định' && /cho thuê đất|giao đất/i.test(v.trichYeu)) t.qdVbId = v.id; }
  }
  if (g.taoMoi?.kieu === 'dot' || g.taoMoi?.kieu === 'mo') {
    const mo = g.taoMoi.kieu === 'mo', x = { id: uid(mo ? 'mo' : 'dot'), ...(mo ? { loai: 'mo', soMo: null, khoanMuc: { boiThuong: null, thuong: null } } : { dienTich: null, khuVuc: '', khoanMuc: { dat: null, taiSan: null, hoTro: null, thuong: null }, daChiTraHa: null, banGiaoHa: null }),
      ten: `QĐ ${g.taoMoi.so} – ${v.trichYeu}`.slice(0, 120), qdId: v.id, qdSo: v.so || g.taoMoi.so + '/QĐ-UBND', qdNgay: v.ngay, hieuLuc: v.ngay, coQuan: 'Chủ tịch UBND xã Nghĩa Trụ', soHo: null, tong: null, dieuChinh: [], cvDeNghi: { so: '', ngay: '', vbId: null }, ttrIds: [], ngayChuyenTien: '', soTienChuyen: null, trangThai: 'Chờ CV đề nghị', chiTraTu: '', chiTraDen: '', ghiChu: 'Tạo từ hồ sơ mới – cần nhập số liệu theo QĐ (hoặc nhờ Claude đọc QĐ, lập gói dữ liệu).' };
    (mo ? D.gpmb.moMa.qd : D.gpmb.dot).push(x); v.lienKet.push({ kieu: 'dot', id: x.id }); UI.hsMoSau = { kieu: 'dot', id: x.id };
  } else if (g.taoMoi?.kieu === 'hd') {
    const h = { id: uid('hd'), so: v.so || '', ngay: v.ngay || '', doiTac: '(cần nhập)', noiDung: v.trichYeu, nhom: 'Khác', giaTri: null, dieuChinh: [], thanhToan: [], trangThai: 'Đang thực hiện', hanHoanThanh: '', duongDan: f.p, vbIds: [v.id], ghiChu: 'Tạo từ hồ sơ mới.' };
    D.hopDong.push(h); v.lienKet.push({ kieu: 'hd', id: h.id }); UI.hsMoSau = { kieu: 'hd', id: h.id };
  }
  return 'vao-so';
}
// Nhập tiến độ từ file đã có trong thư mục dự án (máy hoặc Drive): dùng chung luồng "Nhập file tiến độ".
async function nhapTienDoTuFile(file, duongDan) {
  thongBao('Đang đọc ' + file.name + '…');
  await napThuVien('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const buf = await file.arrayBuffer();
  const moi = docBangTienDo(XLSX.read(buf, { type: 'array' }));
  if (!moi.viec.length) return thongBao('File không có dòng công việc nào.', 'loi');
  const tt = thongTinTenFile(file.name), ngay = tt.ngay || moi.ngayTieuDe || homNay();
  UI.nhapTD = { file, buf, ten: file.name, ngay, ver: tt.ver, moi, ss: soSanhTienDo(moi), duongDanCo: duongDan };
  veModalNhapTD();
}
function veHoSoMoi() {
  const ds = hoSoMoi(), goi = UI.goiCho || [];
  const goiHtml = goi.length ? `<div class="canh-hop" style="margin-bottom:12px"><b>Gói dữ liệu mới từ Claude (${goi.length})</b>${goi.map((g, i) => `<div class="the-vb nhieu-dong"><span class="fill"><b>${esc(g.data.ghiChu || g.ten)}</b><br><span class="muted nho">${esc(g.ten)} · ${g.data.taoLuc ? fmtNgay(String(g.data.taoLuc).slice(0, 10)) : ''}</span></span><button class="nut chinh nho" data-act="goi-xem" data-i="${i}">Xem và nạp</button></div>`).join('')}</div>` : '';
  if (!CHI_MUC) return goiHtml + `<div class="the rong-tam">Chưa có chỉ mục hồ sơ – kết nối thư mục dự án (Cài đặt) để app tự quét.</div>`;
  return goiHtml + `<div class="cong-cu"><span class="muted nho">${ds.length} hồ sơ mới từ lần quét trước · quét lúc ${new Date(CHI_MUC.ngayQuet).toLocaleString('vi-VN')}</span><span class="gian"></span>
    <button class="nut" data-act="hs-quet" ${FS.ketNoi ? '' : 'disabled'}>Kiểm tra hồ sơ mới</button>${ds.length ? '<button class="nut chinh" data-act="hs-dong-y-het">Đồng ý tất cả gợi ý</button>' : ''}</div>
  <div class="bang-wrap" data-cuon="bang-hs" style="max-height:calc(100vh - 260px)"><table><thead><tr><th>File mới</th><th>Gợi ý xử lý</th><th></th></tr></thead><tbody>
  ${ds.slice(0, 300).map(f => { const g = goiYHoSo(f), ten = f.p.split('\\').pop(); return `<tr>
    <td><b>${esc(ten)}</b><br><span class="muted nho">${esc(f.p.slice(0, -ten.length - 1))} · ${fmtNgay(f.sua)} · ${fmtSo(f.kb)} KB</span></td>
    <td class="nho"><b>${esc(g.nhan)}</b><br><span class="muted">${esc(g.chiTiet)}</span></td>
    <td style="white-space:nowrap"><button class="nut nho chinh" data-act="hs-dong-y" data-p="${esc(f.p)}">Đồng ý</button> <button class="nut nho" data-act="mo-file" data-p="${esc(f.p)}">Mở</button>
      ${g.kieu === 'vao-so' && (g.lien.length || g.taoMoi) ? `<button class="nut nho" data-act="hs-vao-so" data-p="${esc(f.p)}" title="Chỉ vào sổ, không gắn/tạo">Chỉ vào sổ</button>` : ''} <button class="nut nho" data-act="hs-bo-qua" data-p="${esc(f.p)}">Bỏ qua</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="rong-tam">Không có hồ sơ mới. App tự kiểm tra mỗi lần kết nối thư mục.</td></tr>'}
  </tbody></table></div>
  <p class="muted nho">App tự phát hiện file mới mỗi lần kết nối thư mục (Google Drive: chỉ đọc phần thay đổi). Gợi ý dựa vào thư mục và tên file theo mẫu "YYYY.MM.DD. Số hiệu. Trích yếu". Số liệu bên trong văn bản (giá trị, kinh phí, thanh toán…) do Claude đọc và lập gói dữ liệu: lệnh <code>/cap-nhat-qlda</code> trong Claude Code.</p>`;
}

/* ---------------------- 3. gói dữ liệu từ Claude ---------------------- */
async function timGoiDuLieu() {
  UI.goiCho = [];
  if (!FS.ketNoi) return;
  let dir; try { dir = await FS.app.getDirectoryHandle(THU_MUC_GOI); } catch { return; }
  const da = new Set(D.daBoSung || []);
  for await (const [ten, e] of dir.entries()) {
    if (e.kind !== 'file' || !/\.json$/i.test(ten)) continue;
    try { const data = JSON.parse(await (await e.getFile()).text()); if (data.ma && !da.has(data.ma)) UI.goiCho.push({ ten, data }); } catch { }
  }
  UI.goiCho.sort((a, b) => a.ten.localeCompare(b.ten));
}
// Các mảng dữ liệu một gói có thể bổ sung; khoá khớp: id (văn bản: id hoặc đường dẫn).
const NHOM_GOI = {
  vanBan: ['Văn bản', d => d.vanBan, x => x.trichYeu || x.so],
  gpmbDot: ['QĐ GPMB (đất)', d => d.gpmb.dot, x => x.qdSo || x.ten],
  moQd: ['QĐ di chuyển mộ', d => d.gpmb.moMa.qd, x => x.qdSo || x.ten],
  hopDong: ['Hợp đồng', d => d.hopDong, x => `${x.so} – ${x.doiTac}`],
  banVe: ['Bản vẽ', d => d.banVe, x => x.ten],
  thueDat: ['Đợt thuê đất', d => d.thueDat.dot, x => x.ten],
  viec: ['Việc (tiến độ)', d => d.viec, x => `${x.tt}. ${x.ten}`],
};
const MANG_NOI = new Set(['thanhToan', 'dieuChinh', 'vbIds', 'lienKet', 'ttrIds', 'checklist', 'vanBan', 'nhatKy']);
// Phân tích (khi apDung=false) hoặc áp dụng một gói. chonLech: tập "nhóm|id|trường" được phép ghi đè.
function xuLyGoi(d, g, apDung, chonLech = new Set()) {
  const kq = { moi: [], dien: 0, them: 0, lech: [] };
  const rong = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  for (const [k, [nhan, lay, tenCua]] of Object.entries(NHOM_GOI)) {
    const ds = lay(d);
    for (const x of g[k] || []) {
      // Khớp theo id; nếu không có: văn bản theo đường dẫn, QĐ theo số QĐ, hợp đồng theo số HĐ (tránh tạo trùng dòng đã tạo tay/từ "Hồ sơ mới").
      const soDau = s => (String(s || '').match(/^\s*(\d{2,6})/) || [])[1] || '';
      const c = ds.find(y => x.id && y.id === x.id)
        || (k === 'vanBan' && x.duongDan ? ds.find(y => nfc(y.duongDan) === nfc(x.duongDan)) : null)
        || ((k === 'gpmbDot' || k === 'moQd') && soDau(x.qdSo) ? ds.find(y => soDau(y.qdSo) === soDau(x.qdSo)) : null)
        || (k === 'hopDong' && x.so && chuanSoHD(x.so).length >= 4 ? ds.find(y => y.so && chuanSoHD(y.so) === chuanSoHD(x.so)) : null);
      if (!c) {
        kq.moi.push(`${nhan}: ${tenCua(x)}`);
        if (apDung) { const ban = structuredClone(x); ban.id ||= uid(k === 'vanBan' ? 'vb' : k); if (k === 'moQd') ban.loai = 'mo'; if (k === 'vanBan') { ban.lienKet ||= []; ban.tuDong = false; } ds.push(ban); }
        continue;
      }
      for (const [f, v] of Object.entries(x)) {
        if (f === 'id') continue;
        if (MANG_NOI.has(f) && Array.isArray(v)) {
          c[f] ||= [];
          for (const t of v) {
            const trung = c[f].some(u => typeof t !== 'object' ? u === t : (JSON.stringify(u) === JSON.stringify(t) || ((t.so && u.so === t.so) || (t.ngay && u.ngay === t.ngay && +(u.soTien ?? u.giaTriMoi) === +(t.soTien ?? t.giaTriMoi)))));
            if (!trung) { kq.them++; if (apDung) c[f].push(structuredClone(t)); }
          }
          if (apDung && (f === 'thanhToan' || f === 'dieuChinh')) c[f].sort((a, b) => (a.ngay || '').localeCompare(b.ngay || ''));
          continue;
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          // Đối tượng con (VD khoanMuc): so từng khoá – khoá trống thì điền, khác số thì báo lệch.
          c[f] = c[f] && typeof c[f] === 'object' ? c[f] : (apDung ? {} : {});
          for (const [sk, sv] of Object.entries(v)) {
            if (rong(sv) || JSON.stringify(c[f][sk]) === JSON.stringify(sv)) continue;
            if (rong(c[f][sk])) { kq.dien++; if (apDung) c[f][sk] = structuredClone(sv); continue; }
            const khoa = `${k}|${c.id}|${f}.${sk}`;
            kq.lech.push({ khoa, nhan: `${nhan}: ${tenCua(c)}`, f: `${f}.${sk}`, cu: c[f][sk], moi: sv });
            if (apDung && chonLech.has(khoa)) c[f][sk] = structuredClone(sv);
          }
          continue;
        }
        if (rong(v) || JSON.stringify(c[f]) === JSON.stringify(v)) continue;
        if (rong(c[f])) { kq.dien++; if (apDung) c[f] = structuredClone(v); continue; }
        const khoa = `${k}|${c.id}|${f}`;
        kq.lech.push({ khoa, nhan: `${nhan}: ${tenCua(c)}`, f, cu: c[f], moi: v });
        if (apDung && chonLech.has(khoa)) c[f] = structuredClone(v);
      }
    }
  }
  return kq;
}
const hienGT = v => (v == null ? '—' : typeof v === 'number' ? fmtSo(v) : typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : /^\d{4}-\d\d-\d\d$/.test(v) ? fmtNgay(v) : String(v).slice(0, 80));
function xemGoi(i) {
  const g = UI.goiCho[i] || UI.goiTay; if (!g) return;
  UI.goiDangXem = g;
  const kq = xuLyGoi(structuredClone(D), g.data, false);
  moModal(`Gói dữ liệu: ${g.data.ghiChu || g.ten}`, `
    <p class="nho">${esc(g.ten)}${g.data.taoLuc ? ' · lập ' + esc(new Date(g.data.taoLuc).toLocaleString('vi-VN')) : ''}</p>
    ${(g.data.nguon || []).length ? `<details><summary class="nho">Nguồn Claude đã đọc (${g.data.nguon.length} file)</summary><ul class="nho">${g.data.nguon.map(n => `<li>${esc(n.duongDan || n)}${n.noiDung ? ' – ' + esc(n.noiDung) : ''}</li>`).join('')}</ul></details>` : ''}
    <p><b>${kq.moi.length}</b> bản ghi mới · <b>${kq.dien}</b> ô đang trống sẽ được điền · <b>${kq.them}</b> dòng thanh toán/điều chỉnh/liên kết mới · <b>${kq.lech.length}</b> chỗ lệch với số đang có</p>
    ${kq.moi.length ? `<details open><summary class="nho">Bản ghi mới</summary><ul class="nho">${kq.moi.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>` : ''}
    ${kq.lech.length ? `<h4 style="margin:10px 0 4px">Chỗ lệch – mặc định giữ số đang có; tích để thay bằng số trong gói</h4><div class="bang-wrap" style="max-height:260px"><table><thead><tr><th></th><th>Bản ghi</th><th>Trường</th><th>Đang có</th><th>Trong gói</th></tr></thead><tbody>
      ${kq.lech.map(l => `<tr><td><input type="checkbox" data-lech="${esc(l.khoa)}"></td><td class="nho">${esc(l.nhan)}</td><td class="nho">${esc(l.f)}</td><td class="nho">${esc(hienGT(l.cu))}</td><td class="nho"><b>${esc(hienGT(l.moi))}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${g.data.baoCao ? `<details><summary class="nho">Ghi chú của Claude</summary><div class="nho" style="white-space:pre-line">${esc(g.data.baoCao)}</div></details>` : ''}`,
    [{ nhan: 'Để sau', act: 'dong-modal' }, { nhan: 'Bỏ qua gói này', act: 'goi-bo' }, { nhan: 'Nạp gói', act: 'goi-nap', chinh: true }]);
}
function napGoiDangXem() {
  const g = UI.goiDangXem; if (!g) return;
  const chon = new Set($$('#modal [data-lech]').filter(x => x.checked).map(x => x.dataset.lech));
  try { luuPhienBan(`Trước khi nạp gói ${g.data.ma}`, { tuDong: true }); } catch { }
  const kq = xuLyGoi(D, g.data, true, chon);
  D = chuanHoa(D);
  D.daBoSung ||= []; if (!D.daBoSung.includes(g.data.ma)) D.daBoSung.push(g.data.ma);
  ghiNhatKyChung(`Nạp gói ${g.data.ma}: ${kq.moi.length} bản ghi mới, ${kq.dien} ô điền, ${kq.them} dòng mới, ${chon.size}/${kq.lech.length} chỗ lệch thay bằng số trong gói`);
  UI.goiCho = (UI.goiCho || []).filter(x => x !== g); UI.goiDangXem = null;
  dongModal(); luu(); render();
  thongBao(`Đã nạp gói: ${kq.moi.length} mới, ${kq.dien} ô điền, ${kq.them} dòng mới${kq.lech.length ? `, ${chon.size}/${kq.lech.length} chỗ lệch đã thay` : ''}.`, '', 7000);
}

/* ------------------------------ nút & nối ------------------------------ */
Object.assign(HD, {
  async 'hs-quet'() { if (FS.goc?.isDrive) await quetTangDrive(); else await quetThuMuc(); await timGoiDuLieu(); render(); },
  async 'hs-dong-y'(el) {
    const kq = await xuLyHoSo(el.dataset.p, true); if (kq !== 'tien-do') { luu(); render(); }
    if (UI.hsMoSau) { UI.drawer = UI.hsMoSau; UI.hsMoSau = null; veDrawer(); }
  },
  'hs-vao-so'(el) { xuLyHoSo(el.dataset.p, false); luu(); render(); },
  'hs-bo-qua'(el) { (D.hoSoBoQua ||= []).push(el.dataset.p); luu(); render(); },
  async 'hs-dong-y-het'() {
    const ds = hoSoMoi().filter(f => goiYHoSo(f).kieu !== 'tien-do');
    if (!confirm(`Áp dụng gợi ý cho ${ds.length} file? (File tiến độ cần xem riêng nên không tính.)`)) return;
    for (const f of ds) await xuLyHoSo(f.p, true);
    UI.hsMoSau = null; luu(); render(); thongBao(`Đã xử lý ${ds.length} hồ sơ mới.`);
  },
  'goi-xem'(el) { xemGoi(+el.dataset.i); },
  'goi-nap'() { napGoiDangXem(); },
  'goi-bo'() {
    const g = UI.goiDangXem; if (!g || !confirm('Bỏ qua gói này (không nạp, không hỏi lại)?')) return;
    D.daBoSung ||= []; D.daBoSung.push(g.data.ma); ghiNhatKyChung(`Bỏ qua gói ${g.data.ma}`);
    UI.goiCho = (UI.goiCho || []).filter(x => x !== g); dongModal(); luu(); render();
  },
  // Nút "Nạp gói dữ liệu (.json)…" (tab Hợp đồng, Cài đặt) dùng chung màn hình xem trước.
  'nap-goi'() {
    chonFileJson(data => {
      if (!data.ma) return thongBao('File không phải gói dữ liệu của app (thiếu "ma").', 'loi');
      UI.goiTay = { ten: data.ma + '.json', data }; UI.goiCho = (UI.goiCho || []).filter(x => x.data.ma !== data.ma); xemGoi(-1);
    });
  },
});
