/* App QLDA KCN Văn Giang – tien-do.js (nạp sau app.js)
   1. Nhập file tiến độ mới (PL2 .xlsx): so sánh với tiến độ đang dùng, chọn thay đổi để áp dụng,
      lưu file vào đúng thư mục "02. Hồ sơ thực hiện dự án\02. Tiến độ triển khai\<ngày>".
   2. Lịch sử phiên bản tiến độ: chụp lại trước/sau mỗi lần cập nhật, so sánh 2 phiên bản, đường cơ sở trên Timeline.
   3. Kiểm tra chéo số liệu trước khi báo cáo (mốc – việc – GPMB – thuê đất – văn bản – đường dẫn file).
   4. Đổi đường dẫn hàng loạt khi sắp xếp lại thư mục (nạp bảng di chuyển CSV). */

const THU_MUC_TIEN_DO = '02. Hồ sơ thực hiện dự án\\02. Tiến độ triển khai';
const khongDau = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function giongNhau(a, b) { // tỉ lệ từ chung (Jaccard) giữa 2 tên việc
  const A = new Set(khongDau(a).split(' ').filter(Boolean)), B = new Set(khongDau(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0; let c = 0; for (const x of A) if (B.has(x)) c++;
  return c / (A.size + B.size - c);
}
const TRUONG_TD = { ten: 'Tên', nhom: 'Nhóm', batDau: 'Bắt đầu', ketThuc: 'Kết thúc', soNgay: 'Số ngày', chuTri: 'Chủ trì', phoiHop: 'Phối hợp', ghiChu: 'Ghi chú', moc: 'Mốc' };
const ghiNhatKyChung = noiDung => { D.nhatKyChung.push({ luc: new Date().toISOString(), noiDung }); if (D.nhatKyChung.length > 500) D.nhatKyChung.splice(0, D.nhatKyChung.length - 500); };

/* ============================== 1. ĐỌC FILE TIẾN ĐỘ ============================== */
function ngayTuO(c) {
  if (c == null || c === '') return '';
  if (typeof c === 'number' && window.XLSX) { const d = XLSX.SSF.parse_date_code(c); return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : ''; }
  const s = String(c).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}
function thongTinTenFile(ten) {
  const g = ten.replace(/\.[^.]+$/, ''); let m, ngay = '';
  if ((m = g.match(/^(20\d\d)\.(\d{1,2})\.(\d{1,2})/))) ngay = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const v = g.match(/\bver\s*(\d+)/i);
  return { ngay: hopLeNgay(ngay) ? ngay : '', ver: v ? +v[1] : null };
}
function docBangTienDo(wb) {
  // Sheet tiến độ: sheet đầu tiên có dòng tiêu đề chứa "TT" và "Công việc".
  let rows = null, h = -1;
  for (const ten of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[ten], { header: 1, raw: true, defval: '' });
    const i = r.findIndex(x => x.some(c => khongDau(c) === 'tt') && x.some(c => khongDau(c).includes('cong viec')));
    if (i >= 0) { rows = r; h = i; break; }
  }
  if (!rows) throw new Error('Không thấy bảng có cột "TT" và "Công việc".');
  const td = rows[h].map(khongDau), cot = (...k) => td.findIndex(t => k.some(x => t.includes(x)));
  const C = { tt: td.indexOf('tt'), ten: cot('cong viec'), bd: cot('bat dau'), kt: cot('ket thuc'), sn: cot('so ngay'), ct: cot('chu tri'), gc: cot('ghi chu'), moc: td.findIndex(t => t === 'moc') };
  if (C.bd < 0 || C.kt < 0) throw new Error('Thiếu cột "Bắt đầu" hoặc "Kết thúc".');
  const nhom = [], viecMoi = [], loi = []; let nhomHT = '';
  let tieuDe = rows.slice(0, h).flat().filter(Boolean).join(' ');
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i], o0 = String(r[0] ?? '').trim(), ten = String(r[C.ten] ?? '').trim();
    const m = o0.match(/^([A-Z])\.\s*(.+)$/);
    if (m && !ten) { nhomHT = m[1]; nhom.push({ ma: m[1], ten: m[2].trim() }); continue; }
    const tt = parseInt(r[C.tt], 10);
    if (!tt || !ten) continue;
    const batDau = ngayTuO(r[C.bd]), ketThuc = ngayTuO(r[C.kt]);
    if (!batDau || !ketThuc) { loi.push(`Dòng ${i + 1} (việc ${tt}): ngày không đọc được.`); continue; }
    const [chuTri, ...ph] = String(r[C.ct] ?? '').split(' / ');
    viecMoi.push({ tt, nhom: nhomHT, ten, batDau, ketThuc, soNgay: khoang(batDau, ketThuc) + 1, soNgayFile: +r[C.sn] || null, chuTri: (chuTri || '').trim(), phoiHop: ph.join(' / ').trim(), ghiChu: String(r[C.gc] ?? '').trim(), moc: C.moc >= 0 ? String(r[C.moc] ?? '').trim() : '' });
    if (ketThuc < batDau) loi.push(`Việc ${tt}: kết thúc trước bắt đầu.`);
    if (+r[C.sn] && +r[C.sn] !== khoang(batDau, ketThuc) + 1) loi.push(`Việc ${tt}: cột "Số ngày" (${r[C.sn]}) khác số ngày tính từ ngày bắt đầu–kết thúc (${khoang(batDau, ketThuc) + 1}). App dùng số ngày tính từ ngày.`);
  }
  // Sheet mốc
  const mocMoi = []; const tenMoc = wb.SheetNames.find(t => khongDau(t).includes('moc'));
  if (tenMoc) for (const r of XLSX.utils.sheet_to_json(wb.Sheets[tenMoc], { header: 1, raw: true, defval: '' })) {
    const id = String(r[0] ?? '').trim(); if (!/^M\d+$/.test(id)) continue;
    mocMoi.push({ id, han: ngayTuO(r[1]), noiDung: String(r[2] ?? '').trim() });
  }
  const mNgay = tieuDe.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(20\d\d)/i);
  return { nhom, viec: viecMoi, moc: mocMoi, loi, ngayTieuDe: mNgay ? `${mNgay[3]}-${pad(mNgay[2])}-${pad(mNgay[1])}` : '' };
}

/* ============================== 2. SO SÁNH ============================== */
function soSanhTienDo(moi) {
  const conLai = new Set(D.viec.map(v => v.id)), cap = [];
  const ghep = (r, v) => { cap.push([r, v]); conLai.delete(v.id); };
  const chua = [];
  for (const r of moi.viec) { const v = D.viec.find(x => conLai.has(x.id) && khongDau(x.ten) === khongDau(r.ten)); v ? ghep(r, v) : chua.push(r); }
  const them = [];
  for (const r of chua) {
    let tot = null, diem = 0;
    for (const v of D.viec) {
      if (!conLai.has(v.id)) continue;
      const g = giongNhau(r.ten, v.ten) + (v.tt === r.tt ? 0.25 : 0) + (v.nhom === r.nhom ? 0.1 : 0);
      if (g > diem) { diem = g; tot = v; }
    }
    if (tot && diem >= 0.6) ghep(r, tot); else them.push(r);
  }
  const doi = [];
  for (const [r, v] of cap) {
    const truong = Object.keys(TRUONG_TD).filter(f => String(r[f] ?? '') !== String(v[f] ?? '') && !(f === 'nhom' && !r.nhom)).map(f => ({ f, cu: v[f], moi: r[f] }));
    if (truong.length) doi.push({ v, r, truong });
  }
  const bot = D.viec.filter(v => conLai.has(v.id));
  const mocDoi = [];
  for (const m of moi.moc) {
    const c = D.moc.find(x => x.id === m.id);
    if (!c) mocDoi.push({ id: m.id, kieu: 'them', moi: m });
    else if (c.han !== m.han || c.noiDung !== m.noiDung) mocDoi.push({ id: m.id, kieu: 'doi', cu: c, moi: m });
  }
  const nhomDoi = moi.nhom.filter(n => { const c = D.nhom.find(x => x.ma === n.ma); return !c || c.ten !== n.ten; });
  return { them, doi, bot, mocDoi, nhomDoi, giuNguyen: cap.length - doi.length };
}
const giaTriTD = (f, x) => (f === 'batDau' || f === 'ketThuc' ? fmtNgay(x) : x ?? '');
function moTaLech(cu, moi) { if (!hopLeNgay(cu) || !hopLeNgay(moi)) return ''; const n = khoang(cu, moi); return n ? ` <span class="chip ${n > 0 ? 'st-cham' : 'st-xong'}">${n > 0 ? 'lùi' : 'sớm'} ${Math.abs(n)} ngày</span>` : ''; }

/* ============================== 3. NHẬP FILE ============================== */
function chonFileTienDo() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xls';
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return;
    try {
      thongBao('Đang đọc ' + f.name + '…');
      await napThuVien('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const buf = await f.arrayBuffer();
      const moi = docBangTienDo(XLSX.read(buf, { type: 'array' }));
      if (!moi.viec.length) return thongBao('File không có dòng công việc nào.', 'loi');
      const tt = thongTinTenFile(f.name), ngay = tt.ngay || moi.ngayTieuDe || homNay();
      UI.nhapTD = { file: f, buf, ten: f.name, ngay, ver: tt.ver, moi, ss: soSanhTienDo(moi) };
      veModalNhapTD();
    } catch (e) { thongBao('Không đọc được file tiến độ: ' + e.message, 'loi', 7000); }
  };
  i.click();
}
function tenFileChuan(ten, ngay) { return /^20\d\d\.\d{1,2}\.\d{1,2}/.test(ten) ? ten : `${tenNgayFile(ngay)}. ${ten}`; }
function veModalNhapTD() {
  const n = UI.nhapTD, ss = n.ss, ten = tenFileChuan(n.ten, n.ngay);
  const noiLuu = `${THU_MUC_TIEN_DO}\\${tenNgayFile(n.ngay)}\\${ten}`;
  const o = (loai, i, chon = true) => `<input type="checkbox" data-ap="${loai}" data-i="${i}" ${chon ? 'checked' : ''}>`;
  const bang = (tieuDe, dong) => dong.length ? `<h4 style="margin:12px 0 4px">${tieuDe}</h4><div class="bang-wrap" style="max-height:240px"><table><tbody>${dong.join('')}</tbody></table></div>` : '';
  const html = `<p class="nho">File <b>${esc(n.ten)}</b> · tiến độ ngày <b>${fmtNgay(n.ngay)}</b>${n.ver ? ` · ver${n.ver}` : ''} · ${n.moi.viec.length} việc, ${n.moi.moc.length} mốc.</p>
    <p class="nho">So với tiến độ đang dùng: <b>${ss.doi.length}</b> việc thay đổi · <b>${ss.them.length}</b> việc mới · <b>${ss.bot.length}</b> việc không còn trong file · ${ss.giuNguyen} việc giữ nguyên · ${ss.mocDoi.length} mốc thay đổi.</p>
    ${n.moi.loi.length ? `<div class="canh-hop nho"><b>Lưu ý trong file:</b><br>${n.moi.loi.map(esc).join('<br>')}</div>` : ''}
    ${bang('Việc thay đổi (giữ nguyên trạng thái, % thực hiện, người được giao, checklist, văn bản)', ss.doi.map((d, i) => `<tr><td>${o('doi', i)}</td><td>${d.v.tt}. ${esc(d.v.ten.slice(0, 70))}</td><td class="nho">${d.truong.map(t => `${TRUONG_TD[t.f]}: <s class="muted">${esc(giaTriTD(t.f, t.cu))}</s> → <b>${esc(giaTriTD(t.f, t.moi))}</b>${t.f === 'ketThuc' ? moTaLech(t.cu, t.moi) : ''}`).join('<br>')}</td></tr>`))}
    ${bang('Việc mới', ss.them.map((r, i) => `<tr><td>${o('them', i)}</td><td>${r.tt}. ${esc(r.ten)}</td><td class="nho">Nhóm ${esc(r.nhom)} · ${fmtNgay(r.batDau)} – ${fmtNgay(r.ketThuc)}${r.moc ? ' · ' + esc(r.moc) : ''}</td></tr>`))}
    ${bang('Việc không còn trong file (bỏ chọn để giữ lại trong app)', ss.bot.map((v, i) => `<tr><td>${o('bot', i, false)}</td><td>${v.tt}. ${esc(v.ten)}</td><td class="nho">${esc(trangThai(v))}${v.vanBan.length ? ` · ${v.vanBan.length} văn bản gắn` : ''}${D.thueDat.dot.some(x => x.viecId === v.id) ? ' · đang gắn đợt thuê đất' : ''}</td></tr>`))}
    ${bang('Mốc', ss.mocDoi.map((m, i) => `<tr><td>${o('moc', i)}</td><td><b>${m.id}</b></td><td class="nho">${m.kieu === 'them' ? 'Mốc mới: ' : ''}${m.cu && m.cu.han !== m.moi.han ? `Hạn <s class="muted">${fmtNgay(m.cu.han)}</s> → <b>${fmtNgay(m.moi.han)}</b>${moTaLech(m.cu.han, m.moi.han)}<br>` : m.kieu === 'them' ? `${fmtNgay(m.moi.han)} – ` : ''}${!m.cu || m.cu.noiDung !== m.moi.noiDung ? esc(m.moi.noiDung) : ''}</td></tr>`))}
    <div class="form" style="margin-top:12px">
      <label class="rong"><span><input type="checkbox" id="td-luu-file" ${FS.ketNoi && !n.duongDanCo ? 'checked' : ''} ${FS.ketNoi ? '' : 'disabled'}> ${n.duongDanCo ? `File đã nằm trong thư mục dự án (${esc(n.duongDanCo)}) – không cần lưu thêm bản` : 'Lưu file vào thư mục dự án (chỉ thêm file mới, không ghi đè)'}</span><input id="td-noi-luu" value="${esc(noiLuu)}" ${FS.ketNoi ? '' : 'disabled'}></label>
      <label class="rong"><span><input type="checkbox" id="td-vao-so" checked> Ghi vào sổ văn bản (loại Báo cáo, nội bộ)</span></label>
      <label class="rong">Ghi chú cho lần cập nhật này<input id="td-ghi-chu" placeholder="VD: điều chỉnh theo chỉ đạo họp giao ban 28/11"></label>
    </div>
    ${FS.ketNoi ? '' : '<p class="muted nho">Chưa kết nối thư mục dự án: app không tự lưu file. Hãy chép file vào đường dẫn trên rồi gắn đường dẫn trong sổ văn bản.</p>'}
    <p class="muted nho">App tự lưu một phiên bản tiến độ trước và sau khi áp dụng (xem Tiến độ → Lịch sử).</p>`;
  moModal('Cập nhật tiến độ từ file', html, [{ nhan: 'Huỷ', act: 'dong-modal' }, { nhan: 'Áp dụng thay đổi đã chọn', act: 'td-ap-dung', chinh: true }]);
}
async function luuFileVaoThuMuc(duongDan, buf) {
  const phan = duongDan.split('\\').filter(Boolean); let ten = phan.pop(), dir = FS.goc;
  // Dùng thư mục sẵn có kể cả khi tên khác dạng Unicode (NFC/NFD), tránh tạo thư mục trùng tên nhìn giống nhau.
  for (const p of phan) { try { dir = await conTheoTen(dir, p, 'dir'); } catch { dir = await dir.getDirectoryHandle(p, { create: true }); } }
  const goc = ten.replace(/(\.[^.]+)$/, ''), duoi = (ten.match(/\.[^.]+$/) || [''])[0];
  for (let k = 1; k < 50; k++) {
    try {
      const f = await (await conTheoTen(dir, ten, 'file')).getFile();
      if (f.size === buf.byteLength) return { duongDan: [...phan, ten].join('\\'), daCo: true };
      ten = `${goc} (${k + 1})${duoi}`;
    } catch { break; }
  }
  const w = await (await dir.getFileHandle(ten, { create: true })).createWritable(); await w.write(buf); await w.close();
  return { duongDan: [...phan, ten].join('\\'), daCo: false };
}
async function apDungTienDo() {
  const n = UI.nhapTD; if (!n) return;
  const chon = loai => $$(`#modal [data-ap="${loai}"]`).filter(x => x.checked).map(x => +x.dataset.i);
  const cDoi = chon('doi'), cThem = chon('them'), cBot = chon('bot'), cMoc = chon('moc');
  const luuFile = $('#td-luu-file')?.checked, noiLuu = $('#td-noi-luu')?.value.trim(), vaoSo = $('#td-vao-so')?.checked, ghiChu = $('#td-ghi-chu')?.value.trim() || '';
  if (!cDoi.length && !cThem.length && !cBot.length && !cMoc.length && !luuFile) return thongBao('Chưa chọn thay đổi nào.', 'canh');
  dongModal();
  if (!D.lichSuTienDo.length) luuPhienBan('Tiến độ trước lần nhập file đầu tiên', { tuDong: true, nguon: D.nguon?.tienDo || '' });
  const luc = new Date().toISOString(), ss = n.ss, nk = (v, s) => v.nhatKy.push({ luc, noiDung: s });
  let duongDan = n.duongDanCo || '';
  if (luuFile && FS.ketNoi && noiLuu) {
    try { const kq = await luuFileVaoThuMuc(noiLuu, n.buf); duongDan = kq.duongDan; thongBao(kq.daCo ? 'File đã có trong thư mục, không lưu lại.' : 'Đã lưu ' + duongDan, '', 5000); }
    catch (e) { thongBao('Không lưu được file vào thư mục: ' + e.message, 'loi', 6000); }
  }
  for (const nm of ss.nhomDoi) { const c = D.nhom.find(x => x.ma === nm.ma); if (c) c.ten = nm.ten; else D.nhom.push({ ...nm }); }
  D.nhom.sort((a, b) => a.ma.localeCompare(b.ma));
  for (const i of cDoi) {
    const { v, r, truong } = ss.doi[i];
    for (const t of truong) v[t.f] = r[t.f];
    nk(v, `Cập nhật theo file ${n.ten}: ${truong.map(t => `${TRUONG_TD[t.f]} ${giaTriTD(t.f, t.cu)} → ${giaTriTD(t.f, t.moi)}`).join('; ')}`);
  }
  for (const i of cThem) {
    const r = ss.them[i];
    D.viec.push({ id: uid('v'), tt: r.tt, nhom: r.nhom || D.nhom[0]?.ma || 'A', ten: r.ten, batDau: r.batDau, ketThuc: r.ketThuc, soNgay: r.soNgay, chuTri: r.chuTri, phoiHop: r.phoiHop, ghiChu: r.ghiChu, moc: r.moc, trangThai: 'Chưa làm', pct: 0, giaoCho: '', phuThuoc: [], checklist: [], vanBan: [], nhatKy: [{ luc, noiDung: `Thêm theo file ${n.ten}` }], canXacNhan: false });
  }
  const daBo = [];
  for (const i of cBot) { const v = ss.bot[i]; daBo.push(`${v.tt}. ${v.ten}`); xoaViecLienKet(v); }
  for (const i of cMoc) {
    const m = ss.mocDoi[i], c = D.moc.find(x => x.id === m.id);
    if (c) { c.han = m.moi.han; c.noiDung = m.moi.noiDung; } else D.moc.push({ id: m.id, han: m.moi.han, noiDung: m.moi.noiDung, viec: [] });
  }
  D.moc.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
  D.moc.forEach(m => { m.viec = D.viec.filter(x => x.moc === m.id).map(x => x.id); });
  D.viec.sort((a, b) => a.tt - b.tt);
  let vbId = null;
  if (vaoSo) {
    const p = duongDan || '';
    if (!p || !D.vanBan.some(v => v.duongDan === p)) {
      vbId = uid('vb');
      D.vanBan.push({ id: vbId, so: '', ngay: n.ngay, loai: 'Báo cáo', chieu: 'Nội bộ', coQuan: D.duAn.donVi || '', trichYeu: `Bảng tiến độ dự án${n.ver ? ' ver' + n.ver : ''} (${n.ten})`, trangThai: 'Dự thảo', duongDan: p, ver: n.ver, khoa: khongDau('bang tien do du an'), ghiChu: p ? '' : 'Chưa có file trong thư mục – chép file vào ' + (noiLuu || THU_MUC_TIEN_DO), lienKet: [], tuDong: false });
    }
  }
  D.nguon ||= {}; D.nguon.tienDo = n.ten; D.nguon.ngayTienDo = n.ngay;
  const tom = `${cDoi.length} việc thay đổi, ${cThem.length} việc mới, ${cBot.length} việc bỏ, ${cMoc.length} mốc`;
  luuPhienBan(`Nhập ${n.ten}`, { nguon: n.ten, duongDan, ngayTienDo: n.ngay, ghiChu, vbId, thayDoi: tom, daBo });
  ghiNhatKyChung(`Cập nhật tiến độ từ file ${n.ten}: ${tom}.${daBo.length ? ' Bỏ: ' + daBo.join('; ') + '.' : ''}${ghiChu ? ' Ghi chú: ' + ghiChu : ''}`);
  UI.nhapTD = null; luu(); render();
  thongBao('Đã cập nhật tiến độ: ' + tom + '.', '', 6000);
}
function xoaViecLienKet(v) {
  D.viec = D.viec.filter(x => x !== v);
  D.viec.forEach(x => x.phuThuoc = x.phuThuoc.filter(p => p.id !== v.id));
  D.moc.forEach(m => m.viec = m.viec.filter(i => i !== v.id));
  D.thueDat.dot.forEach(x => { if (x.viecId === v.id) x.viecId = ''; });
  D.vanBan.forEach(b => b.lienKet = b.lienKet.filter(l => !(l.kieu === 'viec' && l.id === v.id)));
}

/* ============================== 4. LỊCH SỬ PHIÊN BẢN ============================== */
function chupTienDo() {
  return {
    viec: D.viec.map(v => ({ id: v.id, tt: v.tt, nhom: v.nhom, ten: v.ten, batDau: v.batDau, ketThuc: v.ketThuc, soNgay: v.soNgay, chuTri: v.chuTri, moc: v.moc, trangThai: v.trangThai, pct: pctThucTe(v) })),
    moc: D.moc.map(m => ({ id: m.id, han: m.han, noiDung: m.noiDung })),
  };
}
function luuPhienBan(ten, meta = {}) {
  const tk = thongKe();
  D.lichSuTienDo.push({ id: uid('pb'), luc: new Date().toISOString(), ten, ...meta, thucTe: Math.round(tk.thucTe), keHoach: Math.round(tk.keHoach), ...chupTienDo() });
}
const phienBan = id => (id === 'hien-tai' ? { id, ten: 'Hiện tại', luc: new Date().toISOString(), ...chupTienDo() } : D.lichSuTienDo.find(p => p.id === id));
function soSanhPhienBan(a, b) {
  const kq = [], mb = new Map(b.viec.map(v => [v.id, v])), ma = new Map(a.viec.map(v => [v.id, v]));
  for (const v of a.viec) {
    const w = mb.get(v.id);
    if (!w) { kq.push({ loai: 'bot', v }); continue; }
    const doi = ['ten', 'batDau', 'ketThuc', 'chuTri', 'moc', 'trangThai', 'pct'].filter(f => String(v[f] ?? '') !== String(w[f] ?? ''));
    if (doi.length) kq.push({ loai: 'doi', v, w, doi, lech: hopLeNgay(v.ketThuc) && hopLeNgay(w.ketThuc) ? khoang(v.ketThuc, w.ketThuc) : 0 });
  }
  for (const w of b.viec) if (!ma.has(w.id)) kq.push({ loai: 'them', w });
  const moc = b.moc.map(m => ({ m, c: a.moc.find(x => x.id === m.id) })).filter(x => !x.c || x.c.han !== x.m.han);
  return { kq, moc };
}
function veLichSuTienDo() {
  const ds = [...D.lichSuTienDo].reverse();
  const opt = (sel) => `<option value="hien-tai" ${sel === 'hien-tai' ? 'selected' : ''}>Hiện tại</option>${ds.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${new Date(p.luc).toLocaleDateString('vi-VN')} – ${esc(p.ten.slice(0, 60))}</option>`).join('')}`;
  UI.pbA ||= ds[0]?.id || 'hien-tai'; UI.pbB ||= 'hien-tai';
  let ssHtml = '';
  const A = phienBan(UI.pbA), B = phienBan(UI.pbB);
  if (A && B && A !== B) {
    const { kq, moc } = soSanhPhienBan(A, B);
    const lui = kq.filter(x => x.loai === 'doi' && x.lech > 0), som = kq.filter(x => x.loai === 'doi' && x.lech < 0);
    ssHtml = `<p class="nho"><b>${kq.length}</b> khác biệt: ${lui.length} việc lùi hạn (tổng ${lui.reduce((s, x) => s + x.lech, 0)} ngày), ${som.length} việc sớm hơn, ${kq.filter(x => x.loai === 'them').length} việc thêm, ${kq.filter(x => x.loai === 'bot').length} việc bỏ, ${moc.length} mốc đổi hạn.</p>
    ${moc.length ? `<p class="nho">${moc.map(x => `<b>${x.m.id}</b>: ${x.c ? `${fmtNgay(x.c.han)} → ${fmtNgay(x.m.han)}${moTaLech(x.c.han, x.m.han)}` : 'mốc mới ' + fmtNgay(x.m.han)}`).join(' · ')}</p>` : ''}
    <div class="bang-wrap" style="max-height:calc(100vh - 360px)"><table><thead><tr><th>TT</th><th>Công việc</th><th>Thay đổi</th></tr></thead><tbody>
    ${kq.sort((x, y) => (y.lech || 0) - (x.lech || 0)).map(x => x.loai === 'them' ? `<tr><td>${x.w.tt}</td><td>${esc(x.w.ten)}</td><td><span class="chip st-lam">thêm</span> ${fmtNgay(x.w.batDau)} – ${fmtNgay(x.w.ketThuc)}</td></tr>`
      : x.loai === 'bot' ? `<tr><td>${x.v.tt}</td><td>${esc(x.v.ten)}</td><td><span class="chip st-chua">bỏ</span></td></tr>`
      : `<tr><td>${x.v.tt}</td><td>${esc(x.w.ten)}</td><td class="nho">${x.doi.map(f => `${{ ten: 'Tên', batDau: 'Bắt đầu', ketThuc: 'Kết thúc', chuTri: 'Chủ trì', moc: 'Mốc', trangThai: 'Trạng thái', pct: '% TH' }[f]}: <s class="muted">${esc(giaTriTD(f, x.v[f]))}</s> → <b>${esc(giaTriTD(f, x.w[f]))}</b>${f === 'ketThuc' ? moTaLech(x.v[f], x.w[f]) : ''}`).join('<br>')}</td></tr>`).join('') || '<tr><td colspan="3" class="rong-tam">Không khác biệt.</td></tr>'}
    </tbody></table></div>`;
  }
  return `<div class="luoi hai" style="align-items:start">
    <div class="the"><div class="cong-cu" style="margin-bottom:6px"><h3 style="margin:0">Các phiên bản tiến độ (${D.lichSuTienDo.length})</h3><span class="gian"></span><button class="nut" data-act="pb-luu">Lưu phiên bản hiện tại</button></div>
      ${ds.length ? `<ul class="ds">${ds.map(p => `<li><span class="fill"><b>${esc(p.ten)}</b><br><span class="muted nho">${new Date(p.luc).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}${p.ngayTienDo ? ' · tiến độ ngày ' + fmtNgay(p.ngayTienDo) : ''} · ${p.viec.length} việc · TH ${p.thucTe ?? '?'}% / KH ${p.keHoach ?? '?'}%${p.thayDoi ? ' · ' + esc(p.thayDoi) : ''}${p.ghiChu ? '<br>' + esc(p.ghiChu) : ''}</span>${p.duongDan ? `<br><a href="#" class="nho" data-act="mo-file" data-p="${esc(p.duongDan)}">${esc(p.duongDan)}</a>` : ''}</span>
        <span style="display:flex;flex-direction:column;gap:4px"><button class="nut nho" data-act="pb-so-sanh" data-id="${p.id}">So với hiện tại</button><button class="nut nho ${UI.tdGoc === p.id ? 'chinh' : ''}" data-act="pb-goc" data-id="${p.id}">${UI.tdGoc === p.id ? 'Đang là đường cơ sở' : 'Làm đường cơ sở'}</button><button class="nut nho xoa" data-act="pb-xoa" data-id="${p.id}">Xoá</button></span></li>`).join('')}</ul>`
      : '<p class="muted nho">Chưa có phiên bản nào. Bấm "Lưu phiên bản hiện tại" để chốt tiến độ làm mốc so sánh, hoặc "Nhập file tiến độ" – app tự lưu trước và sau khi cập nhật.</p>'}
      <h3 style="margin-top:14px">Nhật ký thay đổi chung</h3>${D.nhatKyChung.length ? `<ul class="ds nho">${[...D.nhatKyChung].reverse().slice(0, 40).map(x => `<li><span class="muted" style="width:120px">${new Date(x.luc).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="fill">${esc(x.noiDung)}</span></li>`).join('')}</ul>` : '<p class="muted nho">Chưa có.</p>'}</div>
    <div class="the"><h3>So sánh hai phiên bản</h3><div class="cong-cu"><select class="o" data-loc="pbA" style="max-width:260px">${opt(UI.pbA)}</select><span>→</span><select class="o" data-loc="pbB" style="max-width:260px">${opt(UI.pbB)}</select></div>${ssHtml || '<p class="muted nho">Chọn hai phiên bản khác nhau.</p>'}</div>
  </div>`;
}
function tienDoGoc(id) { // ngày theo đường cơ sở để vẽ trên Timeline
  const p = UI.tdGoc && D.lichSuTienDo.find(x => x.id === UI.tdGoc); if (!p) return null;
  return p.viec.find(v => v.id === id) || null;
}

/* ============================== 5. KIỂM TRA CHÉO SỐ LIỆU ============================== */
function kiemTraSoLieu() {
  const kq = [], them = (muc, mucDo, nd, extra = {}) => kq.push({ muc, mucDo, nd, ...extra });
  const idViec = new Set(D.viec.map(v => v.id)), idVb = new Set(D.vanBan.map(v => v.id));
  // Tiến độ
  const ttTrung = D.viec.map(v => v.tt).filter((t, i, a) => a.indexOf(t) !== i);
  if (ttTrung.length) them('Tiến độ', 'loi', `Số thứ tự việc bị trùng: ${[...new Set(ttTrung)].join(', ')}.`);
  for (const v of D.viec) {
    if (!hopLeNgay(v.batDau) || !hopLeNgay(v.ketThuc)) them('Tiến độ', 'loi', `Việc ${v.tt}: thiếu ngày bắt đầu/kết thúc.`, { act: 'mo-viec', id: v.id });
    else if (v.soNgay !== khoang(v.batDau, v.ketThuc) + 1) them('Tiến độ', 'canh', `Việc ${v.tt}: số ngày ${v.soNgay} khác khoảng ngày (${khoang(v.batDau, v.ketThuc) + 1}).`, { act: 'mo-viec', id: v.id });
    if (v.trangThai === 'Đã xong' && pctThucTe(v) < 100) them('Tiến độ', 'canh', `Việc ${v.tt}: "Đã xong" nhưng % thực hiện ${v.pct}.`, { act: 'mo-viec', id: v.id });
    if (!D.nhom.some(n => n.ma === v.nhom)) them('Tiến độ', 'loi', `Việc ${v.tt}: nhóm "${v.nhom}" không có trong danh mục nhóm.`, { act: 'mo-viec', id: v.id });
    for (const p of v.phuThuoc) if (!idViec.has(p.id)) them('Tiến độ', 'loi', `Việc ${v.tt}: phụ thuộc vào việc đã xoá.`, { act: 'mo-viec', id: v.id });
    if (canhPhuThuoc(v).length) them('Tiến độ', 'canh', `Việc ${v.tt}: ${canhPhuThuoc(v)[0]}.`, { act: 'mo-viec', id: v.id });
    for (const id of v.vanBan) if (!idVb.has(id)) them('Văn bản', 'loi', `Việc ${v.tt}: gắn văn bản không còn trong sổ (${id}).`, { act: 'mo-viec', id: v.id });
  }
  // Mốc – việc
  for (const m of D.moc) {
    const ds = D.viec.filter(v => v.moc === m.id);
    if (!ds.length) { them('Mốc', 'canh', `Mốc ${m.id} không gắn với việc nào.`); continue; }
    const kt = ds.reduce((a, v) => (v.ketThuc > a ? v.ketThuc : a), '');
    if (kt && kt !== m.han) them('Mốc', kt > m.han ? 'loi' : 'canh', `Mốc ${m.id} hạn ${fmtNgay(m.han)} nhưng việc gắn mốc kết thúc ${fmtNgay(kt)}${kt > m.han ? ' – trễ mốc' : ''}.`, { act: 'mo-viec', id: ds.find(v => v.ketThuc === kt).id });
  }
  for (const v of D.viec) if (v.moc && !D.moc.some(m => m.id === v.moc)) them('Mốc', 'loi', `Việc ${v.tt} gắn mốc ${v.moc} không có trong danh sách mốc.`, { act: 'mo-viec', id: v.id });
  // GPMB: kế hoạch chi trả ↔ việc nhóm B "Chi trả lũy kế đạt X ha"
  const kh = D.gpmb.keHoachChiTra;
  for (const v of D.viec.filter(v => /chi tr[aả].*đạt\s+[\d.,]+\s*ha/i.test(v.ten))) {
    const ha = +v.ten.match(/đạt\s+([\d.,]+)\s*ha/i)[1].replace(/\./g, '').replace(',', '.');
    const k = kh.find(x => Math.abs(x.ha - ha) < 0.01);
    if (!k) them('GPMB', 'loi', `Việc ${v.tt} "${v.ten}" không có mốc ${fmtSo(ha, 2)} ha trong kế hoạch chi trả GPMB.`, { act: 'mo-viec', id: v.id });
    else if (k.ngay !== v.ketThuc) them('GPMB', 'loi', `Kế hoạch chi trả ${fmtSo(ha, 2)} ha: biểu đồ GPMB ghi ${fmtNgay(k.ngay)}, bảng tiến độ (việc ${v.tt}) ghi ${fmtNgay(v.ketThuc)}. Báo cáo sẽ lệch.`, { act: 'mo-viec', id: v.id, sua: { kieu: 'kh-chi-tra', ha, ngay: v.ketThuc } });
  }
  const th = D.gpmb.tongHop, chuoi = [['thuHoiHa', 'thông báo thu hồi'], ['congKhaiHa', 'công khai phương án'], ['pheDuyetHa', 'phê duyệt phương án'], ['chiTraHa', 'đã chi trả'], ['banGiaoHa', 'đã bàn giao']];
  if (th.tongHa && th.thuHoiHa > th.tongHa) them('GPMB', 'loi', `Diện tích thông báo thu hồi (${fmtHa(th.thuHoiHa)} ha) lớn hơn tổng diện tích (${fmtHa(th.tongHa)} ha).`);
  for (let i = 1; i < chuoi.length; i++) if ((th[chuoi[i][0]] || 0) > (th[chuoi[i - 1][0]] || 0) + 1e-6) them('GPMB', 'loi', `Số liệu ${chuoi[i][1]} (${fmtHa(th[chuoi[i][0]])} ha) lớn hơn ${chuoi[i - 1][1]} (${fmtHa(th[chuoi[i - 1][0]])} ha).`);
  if (th.ngay && !D.gpmb.lichSu.some(x => x.ngay === th.ngay)) them('GPMB', 'canh', `Số liệu GPMB ngày ${fmtNgay(th.ngay)} chưa bấm "Ghi nhận" – biểu đồ và báo cáo dùng số cũ.`, { view: 'gpmb' });
  if (th.pheDuyetHaBaoCao && Math.abs(th.pheDuyetHaBaoCao - (th.pheDuyetHa || 0)) > 0.05) them('GPMB', 'canh', `Báo cáo GPMB ngày ${fmtNgay(th.ngay)} ghi đã phê duyệt ${fmtHa(th.pheDuyetHaBaoCao)} ha, các QĐ đang có trong app cộng ${fmtHa(th.pheDuyetHa)} ha – còn QĐ phê duyệt chưa thu thập (QĐ là số liệu gốc).`, { view: 'gpmb' });
  if (th.ngay && khoang(th.ngay, homNay()) > 8) them('GPMB', 'canh', `Số liệu GPMB đã ${khoang(th.ngay, homNay())} ngày chưa cập nhật (ngày ${fmtNgay(th.ngay)}).`, { view: 'gpmb' });
  for (const x of tatCaQD()) {
    for (const id of [x.qdId, x.cvDeNghi?.vbId, x.cvdId, ...x.ttrIds].filter(Boolean)) if (!idVb.has(id)) them('Văn bản', 'loi', `${tenQD(x)}: gắn văn bản không còn trong sổ.`, { act: 'mo-dot', id: x.id });
    const q = vb(x.qdId); if (q && q.ngay && x.qdNgay && q.ngay !== x.qdNgay) them('GPMB', 'loi', `${tenQD(x)}: ngày QĐ ${fmtNgay(x.qdNgay)} khác ngày trong sổ văn bản ${fmtNgay(q.ngay)}.`, { act: 'mo-dot', id: x.id });
    const km = Object.values(x.khoanMuc || {}).filter(v => v != null);
    if (km.length && x.tong && Math.abs(km.reduce((s, v) => s + (+v || 0), 0) - x.tong) > 1) them('GPMB', 'loi', `${tenQD(x)}: cộng các khoản mục ${fmtSo(km.reduce((s, v) => s + (+v || 0), 0))} đ khác tổng theo QĐ ${fmtSo(x.tong)} đ.`, { act: 'mo-dot', id: x.id });
    if (x.soTienChuyen && Math.abs(x.soTienChuyen - tongDot(x)) > 1) them('GPMB', 'canh', `${tenQD(x)}: đã chuyển ${fmtSo(x.soTienChuyen)} đ, kinh phí hiện hành ${fmtSo(tongDot(x))} đ (chênh ${fmtSo(x.soTienChuyen - tongDot(x))} đ) – cần đối chiếu, cấn trừ.`, { act: 'mo-dot', id: x.id });
    if (hopLeNgay(x.chiTraTu) && hopLeNgay(hanChiTra(x)) && x.chiTraTu > hanChiTra(x)) them('GPMB', 'canh', `${tenQD(x)}: lịch chi trả ${ngayChiTraDK(x)} sau hạn chi trả 30 ngày (${fmtNgay(hanChiTra(x))}).`, { act: 'mo-dot', id: x.id });
  }
  const soMoQD = (D.gpmb.moMa.qd || []).reduce((s, x) => s + (+x.soMo || 0), 0);
  if (D.gpmb.moMa.qd?.length && soMoQD !== (+D.gpmb.moMa.pheDuyet || 0)) them('GPMB', 'canh', `Mồ mả: cộng số ngôi theo các QĐ phê duyệt (${soMoQD}) khác ô "Phê duyệt" (${D.gpmb.moMa.pheDuyet ?? '—'}).`, { view: 'gpmb' });
  const mm = D.gpmb.moMa, mmc = [['phatHien', 'phát hiện'], ['kiemKe', 'kiểm kê'], ['congKhai', 'công khai'], ['pheDuyet', 'phê duyệt'], ['diDoi', 'đã di dời']];
  for (let i = 1; i < mmc.length; i++) if ((mm[mmc[i][0]] || 0) > (mm[mmc[i - 1][0]] || 0)) them('GPMB', 'loi', `Mồ mả: số ${mmc[i][1]} (${mm[mmc[i][0]]}) lớn hơn số ${mmc[i - 1][1]} (${mm[mmc[i - 1][0]]}).`, { view: 'gpmb' });
  // Thuê đất
  for (const x of D.thueDat.dot) {
    if (x.viecId && !idViec.has(x.viecId)) them('Thuê đất', 'loi', `${x.ten}: gắn việc tiến độ đã xoá.`, { act: 'mo-td', id: x.id });
    const v = viec(x.viecId);
    if (v && x.moc && v.moc && v.moc !== x.moc) them('Thuê đất', 'canh', `${x.ten}: mốc ${x.moc} khác mốc của việc ${v.tt} (${v.moc}).`, { act: 'mo-td', id: x.id });
    if (x.qdVbId) { const q = vb(x.qdVbId); if (!q) them('Thuê đất', 'loi', `${x.ten}: QĐ cho thuê đất không còn trong sổ văn bản.`, { act: 'mo-td', id: x.id }); else if (q.ngay && x.qdNgay && q.ngay !== x.qdNgay) them('Thuê đất', 'loi', `${x.ten}: ngày QĐ ${fmtNgay(x.qdNgay)} khác sổ văn bản ${fmtNgay(q.ngay)}.`, { act: 'mo-td', id: x.id }); }
    if (x.qdNgay && !x.buoc['Bước 3']?.xong) them('Thuê đất', 'canh', `${x.ten}: đã có ngày QĐ nhưng Bước 3 "Ban hành QĐ cho thuê đất" chưa đánh dấu xong.`, { act: 'mo-td', id: x.id });
  }
  if (typeof kiemTraGD2 === 'function') kiemTraGD2(them);
  // Văn bản – đường dẫn file
  if (!CHI_MUC) them('Văn bản', 'canh', 'Chưa quét thư mục dự án nên chưa kiểm tra được đường dẫn file. Cài đặt → Quét hồ sơ (hoặc nạp chi-muc-ho-so.json).', { view: 'cai-dat' });
  else {
    const co = new Set(CHI_MUC.files.map(f => nfc(f.p)));
    const theoTen = new Map(); for (const f of CHI_MUC.files) { const k = nfc(f.p.split('\\').pop()).toLowerCase(); theoTen.set(k, [...(theoTen.get(k) || []), nfc(f.p)]); }
    for (const v of D.vanBan) {
      if (!v.duongDan || co.has(nfc(v.duongDan))) continue;
      const goiY = theoTen.get(nfc(v.duongDan.split('\\').pop()).toLowerCase()) || [];
      them('Văn bản', 'loi', `${v.so || v.trichYeu.slice(0, 50)}: không thấy file "${v.duongDan}".${goiY.length === 1 ? ` Có file cùng tên tại "${goiY[0]}".` : goiY.length > 1 ? ` Có ${goiY.length} file cùng tên.` : ''}`, { act: 'mo-vb', id: v.id, sua: goiY.length === 1 ? { kieu: 'duong-dan', id: v.id, p: goiY[0] } : null });
    }
    for (const q of D.quyTrinhMau) if (q.nguon && !co.has(nfc(q.nguon))) them('Văn bản', 'canh', `Quy trình mẫu "${q.ten}": không thấy file nguồn "${q.nguon}".`);
  }
  // Lịch sử
  if (!D.lichSuTienDo.length) them('Tiến độ', 'canh', 'Chưa có phiên bản tiến độ nào được chốt để so sánh khi báo cáo. Tiến độ → Lịch sử → Lưu phiên bản hiện tại.', { view: 'tien-do', mode: 'lich-su' });
  return kq;
}
function veKiemTra(gon = false) {
  const kq = kiemTraSoLieu(), loi = kq.filter(x => x.mucDo === 'loi'), canh = kq.filter(x => x.mucDo === 'canh');
  const suaDuoc = kq.filter(x => x.sua);
  const muc = [...new Set(kq.map(x => x.muc))];
  return `<div class="the"><div class="cong-cu" style="margin-bottom:6px"><h3 style="margin:0">Kiểm tra số liệu trước khi báo cáo</h3><span class="gian"></span>
      <span class="chip ${loi.length ? 'st-cham' : 'st-xong'}">${loi.length} lỗi</span><span class="chip ${canh.length ? 'st-canh' : 'st-xong'}">${canh.length} cảnh báo</span>
      ${suaDuoc.length ? `<button class="nut" data-act="kt-sua-tat-ca">Sửa tự động ${suaDuoc.length} mục chắc chắn</button>` : ''}</div>
    <p class="muted nho">Đối chiếu: mốc ↔ việc, kế hoạch chi trả GPMB ↔ bảng tiến độ, số liệu GPMB và mồ mả theo thứ tự các bước, QĐ ↔ sổ văn bản, đợt thuê đất ↔ việc/mốc, đường dẫn file ↔ thư mục dự án${CHI_MUC ? ` (quét ${new Date(CHI_MUC.ngayQuet).toLocaleDateString('vi-VN')})` : ''}.</p>
    ${kq.length ? muc.map(m => `<details ${!gon && kq.some(x => x.muc === m && x.mucDo === 'loi') ? 'open' : ''}><summary><b>${m}</b> – ${kq.filter(x => x.muc === m && x.mucDo === 'loi').length} lỗi, ${kq.filter(x => x.muc === m && x.mucDo === 'canh').length} cảnh báo</summary><ul class="ds nho">${kq.filter(x => x.muc === m).map(x => `<li><span class="chip ${x.mucDo === 'loi' ? 'st-cham' : 'st-canh'}">${x.mucDo === 'loi' ? 'Lỗi' : 'Lưu ý'}</span><span class="fill">${esc(x.nd)}</span>${x.sua ? `<button class="nut nho" data-act="kt-sua" data-sua='${esc(JSON.stringify(x.sua))}'>Sửa</button>` : ''}${x.act ? `<button class="nut nho" data-act="${x.act}" data-id="${x.id}">Xem</button>` : x.view ? `<button class="nut nho" data-act="den" data-view="${x.view}">Xem</button>` : ''}</li>`).join('')}</ul></details>`).join('') : '<p style="color:var(--xong)">Không phát hiện sai lệch.</p>'}</div>`;
}
function suaMuc(s) {
  if (s.kieu === 'duong-dan') { const v = vb(s.id); if (v) { ghiNhatKyChung(`Sửa đường dẫn ${v.so || v.trichYeu.slice(0, 40)}: ${v.duongDan} → ${s.p}`); v.duongDan = s.p; } }
  else if (s.kieu === 'kh-chi-tra') { const k = D.gpmb.keHoachChiTra.find(x => Math.abs(x.ha - s.ha) < 0.01); if (k) { ghiNhatKyChung(`Kế hoạch chi trả ${s.ha} ha: ${fmtNgay(k.ngay)} → ${fmtNgay(s.ngay)} (theo bảng tiến độ)`); k.ngay = s.ngay; } }
}
async function xacNhanTruocBaoCao(viec) {
  const loi = kiemTraSoLieu().filter(x => x.mucDo === 'loi');
  if (loi.length && !confirm(`Có ${loi.length} lỗi số liệu (VD: ${loi[0].nd})\n\nBáo cáo có thể sai lệch. Vẫn xuất?`)) { UI.view = 'bao-cao'; render(); return; }
  return viec();
}

/* ============================== 6. ĐỔI ĐƯỜNG DẪN HÀNG LOẠT ============================== */
function doiTienTo(cu, moi, thu = false) {
  cu = cu.replace(/\\+$/, ''); moi = moi.replace(/\\+$/, ''); let n = 0;
  const doi = p => { if (!p || !(p === cu || p.startsWith(cu + '\\'))) return p; n++; return moi + p.slice(cu.length); };
  if (thu) { D.vanBan.forEach(v => doi(v.duongDan)); D.quyTrinhMau.forEach(q => doi(q.nguon)); D.lichSuTienDo.forEach(p => doi(p.duongDan)); return n; }
  D.vanBan.forEach(v => v.duongDan = doi(v.duongDan));
  D.quyTrinhMau.forEach(q => q.nguon = doi(q.nguon));
  D.lichSuTienDo.forEach(p => p.duongDan = doi(p.duongDan));
  D.phieu.forEach(p => { p.thuMucDich = doi(p.thuMucDich); });
  return n;
}
function docCsv(txt) {
  const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; } else if (ch === '\n') { r.push(c.replace(/\r$/, '')); rows.push(r); r = []; c = ''; } else c += ch;
  }
  if (c || r.length) { r.push(c); rows.push(r); }
  return rows;
}
function napBangDiChuyen() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv';
  i.onchange = async () => {
    const rows = docCsv((await i.files[0].text()).replace(/^\uFEFF/, ''));
    const td = rows[0].map(khongDau), cCu = td.findIndex(t => t.includes('duong dan cu')), cMoi = td.findIndex(t => t.includes('duong dan moi')), cDuyet = td.findIndex(t => t.startsWith('duyet'));
    if (cCu < 0 || cMoi < 0) return thongBao('CSV cần cột "Đường dẫn cũ" và "Đường dẫn mới".', 'loi');
    // Đổi thư mục dài trước (tránh đổi cha trước con), chỉ dòng được duyệt "C" (nếu có cột Duyệt).
    const ds = rows.slice(1).filter(r => r[cCu] && r[cMoi] && (cDuyet < 0 || /^c/i.test((r[cDuyet] || '').trim()))).map(r => [r[cCu].trim(), r[cMoi].trim()]).sort((a, b) => b[0].length - a[0].length);
    if (!ds.length) return thongBao('Không có dòng nào được duyệt (cột "Duyệt (C/K)" = C).', 'canh', 6000);
    const dem = ds.map(([a, b]) => [a, b, doiTienTo(a, b, true)]).filter(x => x[2]);
    if (!dem.length) return thongBao(`${ds.length} dòng được duyệt nhưng không có đường dẫn nào trong app bị ảnh hưởng.`, '', 6000);
    if (!confirm(`Đổi đường dẫn trong app theo ${dem.length} dòng của bảng di chuyển:\n${dem.slice(0, 8).map(x => `• ${x[0]} → ${x[1]} (${x[2]} mục)`).join('\n')}${dem.length > 8 ? '\n…' : ''}\n\nChỉ đổi dữ liệu trong app, không di chuyển file. Tiếp tục?`)) return;
    luuPhienBan('Trước khi đổi đường dẫn theo bảng di chuyển', { tuDong: true });
    let tong = 0; for (const [a, b] of dem) tong += doiTienTo(a, b);
    ghiNhatKyChung(`Đổi đường dẫn theo bảng di chuyển (${dem.length} dòng, ${tong} mục).`);
    luu(); render(); thongBao(`Đã đổi ${tong} đường dẫn. Bấm "Quét hồ sơ" để kiểm tra lại.`, '', 6000);
  };
  i.click();
}
function veDoiDuongDan() {
  return `<div class="the"><h3>Đồng bộ đường dẫn khi sắp xếp lại thư mục</h3>
    <p class="nho">App lưu đường dẫn file tính từ thư mục dự án. Sau khi di chuyển/đổi tên thư mục, cập nhật đường dẫn trong app tại đây rồi bấm "Quét hồ sơ" và xem Báo cáo → Kiểm tra số liệu.</p>
    <div class="form"><label class="rong">Đường dẫn cũ (thư mục hoặc file)<input id="ddc-cu" placeholder="VD: 02. Hồ sơ thực hiện dự án\\04. Sau CTĐT"></label>
      <label class="rong">Đường dẫn mới<input id="ddc-moi" placeholder="VD: 02. Hồ sơ thực hiện dự án\\04. Sau Chủ trương đầu tư"></label></div>
    <div class="cong-cu" style="margin-top:8px"><button class="nut" data-act="ddc-doi">Đổi</button><button class="nut" data-act="ddc-bang">Nạp bảng di chuyển (CSV)…</button></div>
    <p class="muted nho">Bảng di chuyển: file "1. Bang di chuyen de xuat.csv" trong thư mục đề xuất; chỉ áp dụng các dòng có cột Duyệt = C.</p></div>`;
}

/* ============================== hành động ============================== */
Object.assign(HD, {
  'td-nhap'() { chonFileTienDo(); },
  'td-ap-dung'() { apDungTienDo(); },
  'pb-luu'() { const t = prompt('Tên phiên bản (VD: Chốt tiến độ báo cáo giao ban 28/11):', `Chốt tiến độ ngày ${fmtNgay(homNay())}`); if (!t) return; luuPhienBan(t.trim()); ghiNhatKyChung('Lưu phiên bản tiến độ: ' + t.trim()); luu(); render(); },
  'pb-xoa'(el) { const p = D.lichSuTienDo.find(x => x.id === el.dataset.id); if (!p || !confirm(`Xoá phiên bản "${p.ten}"?`)) return; D.lichSuTienDo = D.lichSuTienDo.filter(x => x !== p); if (UI.tdGoc === p.id) UI.tdGoc = ''; if (UI.pbA === p.id) UI.pbA = ''; if (UI.pbB === p.id) UI.pbB = ''; luu(); render(); },
  'pb-so-sanh'(el) { UI.pbA = el.dataset.id; UI.pbB = 'hien-tai'; render(); },
  'pb-goc'(el) { UI.tdGoc = UI.tdGoc === el.dataset.id ? '' : el.dataset.id; render(); },
  'kt-sua'(el) { suaMuc(JSON.parse(el.dataset.sua)); luu(); render(); },
  'kt-sua-tat-ca'() { const ds = kiemTraSoLieu().filter(x => x.sua); if (!confirm(`Sửa tự động ${ds.length} mục (đường dẫn file cùng tên duy nhất, kế hoạch chi trả theo bảng tiến độ)?`)) return; ds.forEach(x => suaMuc(x.sua)); luu(); render(); thongBao(`Đã sửa ${ds.length} mục.`); },
  'ddc-doi'() {
    const a = $('#ddc-cu').value.trim(), b = $('#ddc-moi').value.trim(); if (!a || !b) return thongBao('Nhập đường dẫn cũ và mới.', 'canh');
    const n = doiTienTo(a, b, true); if (!n) return thongBao('Không có đường dẫn nào bắt đầu bằng đường dẫn cũ.', 'canh');
    if (!confirm(`Đổi ${n} đường dẫn trong app?\n${a}\n→ ${b}`)) return;
    doiTienTo(a, b); ghiNhatKyChung(`Đổi đường dẫn: ${a} → ${b} (${n} mục)`); luu(); render(); thongBao(`Đã đổi ${n} đường dẫn.`);
  },
  'ddc-bang'() { napBangDiChuyen(); },
});
