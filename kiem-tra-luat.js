'use strict';
/* App QLDA – KIỂM TRA LUẬT (1.9.0)
   Cơ sở văn bản pháp luật đọc từ "00. APP QLDA\vbpl-bds.json" (xuất từ Hệ thống VBPL dự án BĐS – không nằm trong repo):
     { loai:'vbpl-bds', trangThai:[[mã, nhãn]], the:[{n, ten}], vanBan:[{id, the, code, status, kind, text, note, remark, chain[], effectiveFrom, expiresAt}],
       moc:[{id, the, ngay, nd}], canCuQuyTrinh:[{id, code, noidung, hieuLuc, trangThai, viec, keys[], link, hetHan, daXuLy}], xacMinh:[{id, stt, nhom, nd, deXuat, tinhTrang}] }
   Quy trình kiểm tra:
     1. Gom mọi căn cứ app đang trích (thư viện bước chuẩn, quy trình mẫu, kiểm soát ưu đãi).
     2. Tách số hiệu (số/năm + loại văn bản; cả dạng liệt kê "NĐ 71, 88/2024") và tên luật không kèm số ("Luật Đất đai").
     3. Đối chiếu với cơ sở VBPL theo số hiệu → trạng thái, ngày hiệu lực, hết hiệu lực, văn bản thay thế.
     4. Xếp mức: hết hiệu lực / sắp thay, cần xử lý / có thời hạn / chưa có hiệu lực / còn hiệu lực / chưa rõ.
   D.kiemTraLuat = { cc: {id: {xong, ngay}}, xm: {id: {xong, ngay}} } – đánh dấu đã xử lý trong app. */

const TEP_VBPL = 'vbpl-bds.json';
let VBPL = null, VBPL_DANG = false, VBPL_LOI = '', _ktlCache = null;
KHO.lay('vbpl').then(x => { if (x?.vanBan && !VBPL) { VBPL = x; _ktlCache = null; } }).catch(() => { });

async function napVBPL(baoTin) {
  if (!FS.ketNoi) { if (baoTin) thongBao('Chưa kết nối thư mục dự án.', 'canh'); return; }
  VBPL_DANG = true;
  try {
    const f = await FS.app.getFileHandle(TEP_VBPL);
    const data = JSON.parse(await (await f.getFile()).text());
    if (data?.loai !== 'vbpl-bds' || !Array.isArray(data.vanBan)) throw new Error('file không đúng cấu trúc');
    VBPL = data; VBPL._daDoc = true; VBPL_LOI = ''; _ktlCache = null; await KHO.dat('vbpl', data);
    if (baoTin) thongBao(`Đã nạp cơ sở VBPL: ${data.vanBan.length} mục văn bản.`);
  } catch (e) { VBPL_LOI = e?.name === 'NotFoundError' ? 'chua-co' : (e?.message || String(e)); if (baoTin) thongBao('Không đọc được cơ sở VBPL: ' + (VBPL_LOI === 'chua-co' ? 'chưa có file' : VBPL_LOI), 'loi'); }
  VBPL_DANG = false;
}
function damBaoVBPL() {
  if (VBPL_DANG || !FS.ketNoi || VBPL?._daDoc || VBPL_LOI) return;
  napVBPL(false).then(() => render());
}
const KTL = () => { D.kiemTraLuat ||= {}; D.kiemTraLuat.cc ||= {}; D.kiemTraLuat.xm ||= {}; return D.kiemTraLuat; };
const boDauKtl = s => nfc(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/* ---------------------------- TÁCH SỐ HIỆU ---------------------------- */
// Loại: QH (luật, nghị quyết QH), ND, NQ, TT, QD, '' (không rõ).
function loaiTuHauTo(h) {
  if (!h) return '';
  const u = h.toUpperCase();
  if (/QH\d*/.test(u)) return 'QH';
  if (/NĐ-CP|ND-CP/.test(u)) return 'ND';
  if (/^\/?NQ/.test(u)) return 'NQ';
  if (/^\/?TT/.test(u)) return 'TT';
  if (/^\/?(QĐ|QD)/.test(u)) return 'QD';
  return '';
}
function loaiTuTuKhoa(k) {
  if (!k) return '';
  if (/^Luật/i.test(k)) return 'QH';
  if (/^(Nghị định|NĐ)$/i.test(k)) return 'ND';
  if (/^(Nghị quyết|NQ)$/i.test(k)) return 'NQ';
  if (/^(Thông tư|TT)$/i.test(k)) return 'TT';
  if (/^(Quyết định|QĐ)$/i.test(k)) return 'QD';
  return '';
}
const hopLoai = (a, b) => !a || !b || a === b || (a === 'QH' && b === 'NQ') || (a === 'NQ' && b === 'QH');
// Trả về [{so, nam, loai, khoa:'so/nam', raw}]
function tachSoHieu(text) {
  const s = nfc(text), kq = [], re = /(?<![\d/])(\d{1,4})\/(\d{4})(\/[A-Za-zĐđ0-9-]+)?(?![\d/])/g;
  let m;
  while ((m = re.exec(s))) {
    const truoc = s.slice(Math.max(0, m.index - 40), m.index);
    // từ khoá phải đứng sát (chỉ cách bởi tên luật hoặc danh sách số)
    const sat = /(?<![\p{L}])(Luật|Nghị định|NĐ|Nghị quyết|NQ|Thông tư|TT|Quyết định|QĐ)(?![\p{L}])([^.;:\n()]{0,32})$/u.exec(truoc);
    const loai = loaiTuHauTo(m[3]) || (sat ? loaiTuTuKhoa(sat[1]) : '');
    if (!m[3] && !sat) continue; // "tháng 10/2026", "Kỳ họp 10/2026"… không phải số hiệu
    const nam = +m[2]; if (nam < 1990 || nam > 2100) continue;
    const ds = [m[1]];
    // liệt kê: "NĐ 71, 88, 101/2024" hoặc "Luật 43, 47 và 58/2024"
    const lk = /((?:\d{1,4}\s*(?:,|·|và)\s*)+)$/.exec(truoc);
    if (lk) for (const x of lk[1].match(/\d{1,4}/g)) ds.push(x);
    for (const so of ds) kq.push({ so: String(+so), nam: m[2], loai, khoa: `${+so}/${m[2]}`, raw: m[0] });
  }
  return kq;
}

/* ----------------------------- CHỈ MỤC VBPL ----------------------------- */
const LOAI_KIND = { 'Luật': 'QH', 'NQ': 'NQ', 'NĐ': 'ND', 'TT': 'TT', 'QĐ': 'QD' };
function chiMucVBPL() {
  if (_ktlCache?.vb === VBPL) return _ktlCache;
  const theoSo = new Map(), theoTen = new Map();
  for (const it of VBPL?.vanBan || []) {
    const loaiIt = LOAI_KIND[it.kind] || '';
    // Mục "TT 01/2021 → TT 46/2026": chỉ số đầu là văn bản đang xét (số sau mũi tên là văn bản thay thế).
    const truocMuiTen = String(it.code).split('→')[0];
    for (const x of tachSoHieu(truocMuiTen).concat(tachSoHieuTho(truocMuiTen, it.kind))) {
      const l = x.loai || loaiIt; const k = x.khoa;
      if (!theoSo.has(k)) theoSo.set(k, []);
      if (!theoSo.get(k).some(y => y.it === it)) theoSo.get(k).push({ it, loai: l });
    }
    const t = /^(Luật [^\d(]+?)\s+\d{1,4}\/\d{4}/u.exec(nfc(it.code));
    if (t) { const ten = boDauKtl(t[1]).trim(); if (!theoTen.has(ten)) theoTen.set(ten, []); theoTen.get(ten).push(it); }
  }
  const ccTheoSo = new Map();
  for (const c of VBPL?.canCuQuyTrinh || []) for (const x of tachSoHieu(c.code).concat(tachSoHieuTho(c.code, ''))) { if (!ccTheoSo.has(x.khoa)) ccTheoSo.set(x.khoa, []); if (!ccTheoSo.get(x.khoa).includes(c)) ccTheoSo.get(x.khoa).push(c); }
  _ktlCache = { vb: VBPL, theoSo, theoTen, ccTheoSo, kq: null };
  return _ktlCache;
}
// Mã VBPL thường bỏ hậu tố ("NĐ 49/2026", "TT 32 · 33 · 34/2026") – chấp nhận khi đứng đầu chuỗi mã.
function tachSoHieuTho(code, kind) {
  const s = nfc(code), m = /^(?:Luật|NĐ|NQ|TT|QĐ|QCVN|CV)?[^\d]{0,30}?((?:\d{1,4}\s*(?:,|·|và)\s*)*\d{1,4})\/(\d{4})(?![\d/])/u.exec(s);
  if (!m) return [];
  return m[1].match(/\d{1,4}/g).map(so => ({ so: String(+so), nam: m[2], loai: LOAI_KIND[kind] || '', khoa: `${+so}/${m[2]}` }));
}

/* ---------------------------- ĐÁNH GIÁ ---------------------------- */
const MUC_KTL = {
  het: ['Hết hiệu lực / bãi bỏ', 'st-cham', 1],
  thay: ['Sắp thay thế / cần xử lý', 'st-canh', 2],
  thoihan: ['Có thời hạn – sắp hết', 'st-canh', 3],
  theodoi: ['Đang theo dõi thay đổi', 'st-canh', 4],
  chuaHL: ['Chưa có hiệu lực', 'st-lam', 5],
  chuaRo: ['Trạng thái dự kiến', 'st-chua', 6],
  khongCo: ['Chưa có trong cơ sở VBPL', 'st-chua', 7],
  ok: ['Còn hiệu lực', 'st-xong', 8],
};
function danhGiaVanBan(items, ccs) {
  const t = homNay(), st = new Set(items.map(x => x.status));
  const het = items.map(x => x.expiresAt).filter(hopLeNgay).sort()[0] || '';
  const tu = items.map(x => x.effectiveFrom).filter(hopLeNgay).sort().pop() || '';
  const ccMo = ccs.filter(c => !(KTL().cc[c.id]?.xong ?? c.daXuLy));
  let muc;
  if (!items.length && !ccs.length) muc = 'khongCo';
  else if (st.has('Bỏ') || (het && het < t)) muc = 'het';
  else if (st.has('Thay') || st.has('Cần XL')) muc = 'thay';
  else if (st.has('Tạm thời') || (het && khoang(t, het) <= 180) || ccs.some(c => hopLeNgay(c.hetHan) && khoang(t, c.hetHan) <= 180)) muc = 'thoihan';
  else if (ccMo.some(c => c.trangThai === 'sap')) muc = 'theodoi';
  else if (tu && tu > t) muc = 'chuaHL';
  else if (items.length && [...st].every(s => s === 'DK*' || s === 'KH')) muc = 'chuaRo';
  else muc = 'ok';
  return { muc, st: [...st], het, tu, ccMo };
}
// Tra một trích dẫn → {khoa, nhan, items, ccs, ...đánh giá}
function traTrichDan(x) {
  const cm = chiMucVBPL();
  const items = (cm.theoSo.get(x.khoa) || []).filter(y => hopLoai(x.loai, y.loai)).map(y => y.it);
  const ccs = cm.ccTheoSo.get(x.khoa) || [];
  const tot = c => /^(Luật|NĐ|NQ|TT|QĐ|Nghị)/u.test(c) && !/→|·|,|^(Cập nhật|NĐ thay|TT thay)/u.test(c);
  const nhan = ccs.map(c => c.code).find(tot) || items.map(i => i.code).find(tot) || `${{ QH: 'Luật/NQ', ND: 'NĐ', NQ: 'NQ', TT: 'TT', QD: 'QĐ' }[x.loai] || 'VB'} ${x.raw.split('/').slice(0, 3).join('/')}`;
  return { khoa: x.khoa + '|' + (x.loai || ''), nhan, items, ccs, ...danhGiaVanBan(items, ccs) };
}
// Tên luật không kèm số: "Luật Đất đai Điều 94" → mục "Luật Đất đai 31/2024/QH15"
function traTenLuat(text) {
  const cm = chiMucVBPL(), s = boDauKtl(text), kq = [];
  for (const [ten, its] of cm.theoTen) {
    const i = s.indexOf(ten); if (i < 0) continue;
    const sau = s.slice(i + ten.length, i + ten.length + 14);
    if (/^\s*(so\s*)?\d{1,4}\/\d{4}/.test(sau)) continue; // đã có số hiệu – tách ở bước số
    const khoa = tachSoHieuTho(its[0].code, its[0].kind)[0]?.khoa;
    const ccs = khoa ? cm.ccTheoSo.get(khoa) || [] : [];
    const all = khoa ? (cm.theoSo.get(khoa) || []).map(y => y.it) : its;
    kq.push({ khoa: (khoa || ten) + '|QH', nhan: its[0].code, items: all, ccs, ...danhGiaVanBan(all, ccs) });
  }
  return kq;
}
function danhGiaCanCu(text) {
  if (!VBPL || !text) return [];
  const m = new Map();
  for (const x of tachSoHieu(text)) { const r = traTrichDan(x); if (!m.has(r.khoa)) m.set(r.khoa, r); }
  for (const r of traTenLuat(text)) if (!m.has(r.khoa)) m.set(r.khoa, r);
  return [...m.values()];
}
// Nguồn căn cứ trong app
function nguonCanCu() {
  const ds = [];
  for (const b of (typeof TV !== 'undefined' && TV?.buoc) || []) if (b.canCu) ds.push({ nhan: `Thư viện ${b.ma} – ${b.ten}`, text: b.canCu, view: 'toan-bo' });
  for (const q of D.quyTrinhMau || []) for (const b of q.buoc || []) if (b.canCu) ds.push({ nhan: `${q.ten}: ${b.buoc ? b.buoc + ' – ' : ''}${b.ten}`, text: b.canCu, view: 'gpmb' });
  for (const u of D.kiemSoatUuDai || []) if (u.canCu) ds.push({ nhan: `Kiểm soát ưu đãi ${u.stt}. ${u.quyen}`, text: u.canCu, view: 'gpmb' });
  return ds;
}
function ketQuaKiemTra() {
  const cm = chiMucVBPL();
  const khoaNguon = (typeof TV !== 'undefined' && TV ? TV.buoc.length : 0) + '|' + (D.quyTrinhMau || []).length + '|' + JSON.stringify(KTL().cc);
  if (cm.kq?.khoaNguon === khoaNguon && cm.kq.ngay === homNay()) return cm.kq;
  const vb = new Map();
  for (const n of nguonCanCu()) for (const r of danhGiaCanCu(n.text)) {
    if (!vb.has(r.khoa)) vb.set(r.khoa, { ...r, nguon: [] });
    vb.get(r.khoa).nguon.push(n);
  }
  const ds = [...vb.values()].sort((a, b) => MUC_KTL[a.muc][2] - MUC_KTL[b.muc][2] || b.nguon.length - a.nguon.length);
  cm.kq = { khoaNguon, ngay: homNay(), ds };
  return cm.kq;
}
// Chip cảnh báo cạnh một đoạn căn cứ (chỉ hiện văn bản có vấn đề)
function ktlChip(text) {
  if (!VBPL) return '';
  const ds = danhGiaCanCu(text).filter(r => !['ok', 'chuaRo', 'khongCo'].includes(r.muc));
  return ds.length ? ' ' + ds.map(r => `<a href="#" class="chip ${MUC_KTL[r.muc][1]}" data-act="ktl-mo" data-q="${esc(r.nhan)}" title="${esc(MUC_KTL[r.muc][0])}">⚖ ${esc(r.nhan.slice(0, 40))}: ${esc(MUC_KTL[r.muc][0])}</a>`).join(' ') : '';
}
window.ktlChip = ktlChip;

/* ------------------------------ GIAO DIỆN ------------------------------ */
const nhanTT = s => (VBPL?.trangThai || []).find(x => x[0] === s)?.[1] || s;
const tenThe = n => VBPL?.the.find(x => x.n === n)?.ten || n;
function chipTT(s) { const lop = { HL: 'st-xong', 'Đã XL': 'st-xong', 'Mới': 'st-lam', 'Sửa': 'st-lam', HD: 'st-lam', 'Thay': 'st-canh', 'Cần XL': 'st-canh', 'Tạm thời': 'st-canh', 'Bỏ': 'st-cham' }[s] || 'st-chua'; return `<span class="chip ${lop}" title="${esc(nhanTT(s))}">${esc(s)}</span>`; }
function veMucVanBan(it) {
  return `<div class="the-vb" style="display:block"><b>${esc(it.code)}</b> ${chipTT(it.status)} <span class="muted nho">Thẻ ${esc(it.the)} · ${esc(tenThe(it.the))}${it.group ? ' · ' + esc(it.group) : ''}</span>
    ${it.text ? `<br><span class="nho">${esc(it.text)}</span>` : ''}
    ${it.effectiveFrom || it.expiresAt ? `<br><span class="nho muted">${it.effectiveFrom ? 'Hiệu lực ' + fmtNgay(it.effectiveFrom) : ''}${it.effectiveFrom && it.expiresAt ? ' · ' : ''}${it.expiresAt ? 'Hết hiệu lực ' + fmtNgay(it.expiresAt) : ''}</span>` : ''}
    ${it.note ? `<br><span class="nho muted">${esc(it.note)}</span>` : ''}
    ${(it.chain || []).map(c => `<br><span class="nho">↳ ${esc(c)}</span>`).join('')}
    ${it.remark ? `<br><span class="nho" style="color:var(--canh)">▸ ${esc(it.remark)}</span>` : ''}</div>`;
}
function veKiemTraLuat() {
  damBaoVBPL(); if (typeof damBaoThuVien === 'function') damBaoThuVien();
  if (!VBPL) return `<h2>Kiểm tra luật</h2><div class="canh-hop">${!FS.ketNoi ? 'Kết nối thư mục dự án (Cài đặt → Google Drive) để nạp cơ sở văn bản pháp luật.'
    : VBPL_DANG ? 'Đang đọc cơ sở văn bản…' : VBPL_LOI === 'chua-co' ? `Chưa có file <code>${esc(D.caiDat.thuMucApp)}\\${TEP_VBPL}</code>. Nhờ Claude xuất từ Hệ thống VBPL dự án BĐS rồi bấm Nạp lại.`
    : `Không đọc được: ${esc(VBPL_LOI)}`} <button class="nut nho" data-act="ktl-nap">Nạp lại</button></div>`;
  const tab = UI.ktlTab || 'can-cu', kq = ketQuaKiemTra().ds;
  const dem = k => kq.filter(r => r.muc === k).length;
  const ccMo = VBPL.canCuQuyTrinh.filter(c => !(KTL().cc[c.id]?.xong ?? c.daXuLy));
  const xmMo = VBPL.xacMinh.filter(x => !KTL().xm[x.id]?.xong && !/^Đã xác minh|^Còn hiệu lực/i.test(x.tinhTrang));
  const sap = mocSapToi();
  const tabs = [['can-cu', `Căn cứ đang dùng (${kq.length})`], ['quy-trinh', `Căn cứ quy trình (${ccMo.length}/${VBPL.canCuQuyTrinh.length})`], ['xac-minh', `Cần xác minh (${xmMo.length})`], ['moc', `Mốc sắp tới (${sap.length})`], ['tra-cuu', 'Tra cứu']];
  const than = tab === 'quy-trinh' ? veCanCuQuyTrinh() : tab === 'xac-minh' ? veXacMinh() : tab === 'moc' ? veMocSap(sap) : tab === 'tra-cuu' ? veTraCuuVBPL() : veCanCuDangDung(kq);
  return `<h2>Kiểm tra luật</h2>
  <p class="muted nho">Đối chiếu căn cứ pháp lý app đang trích (thư viện bước chuẩn, quy trình mẫu GPMB – thuê đất – miễn giảm, kiểm soát ưu đãi) với cơ sở văn bản pháp luật: ${VBPL.vanBan.length} mục, ${VBPL.the.length} thẻ chuyên đề. Xuất ngày ${fmtNgay(VBPL.ngayXuat)}${khoang(VBPL.ngayXuat, homNay()) > (VBPL.chuKyRaSoat || 30) ? ` – <b style="color:var(--canh)">đã quá ${VBPL.chuKyRaSoat || 30} ngày, nên rà soát và xuất lại</b>` : ''}. Trạng thái "DK*" là suy luận; đối chiếu văn bản chính thức trước khi áp dụng.</p>
  <div class="luoi kpi">
    <div class="the"><span>Hết hiệu lực / bãi bỏ</span><b style="color:var(--cham)">${dem('het')}</b><span>văn bản đang được trích</span></div>
    <div class="the"><span>Sắp thay thế / cần xử lý</span><b style="color:var(--canh)">${dem('thay') + dem('thoihan') + dem('theodoi')}</b><span>gồm ${dem('thoihan')} có thời hạn, ${dem('theodoi')} đang theo dõi</span></div>
    <div class="the"><span>Chưa rõ / chưa có trong cơ sở</span><b>${dem('chuaRo') + dem('khongCo')}</b><span>cần tra cứu thêm</span></div>
    <div class="the"><span>Căn cứ quy trình chưa xử lý</span><b>${ccMo.length}</b><span>${xmMo.length} điểm cần xác minh</span></div>
  </div>
  <div class="cong-cu"><div class="nhom-nut ktl-tabs">${tabs.map(([k, n]) => `<button data-act="ktl-tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><span class="gian"></span><button class="nut nho" data-act="ktl-nap">Nạp lại cơ sở VBPL</button></div>
  ${than}`;
}
function veCanCuDangDung(kq) {
  const chiLoi = UI.ktlChiLoi !== false;
  const ds = chiLoi ? kq.filter(r => r.muc !== 'ok') : kq;
  return `<div class="cong-cu"><label class="nho"><input type="checkbox" data-loc="ktlChiLoi" ${chiLoi ? 'checked' : ''}> Chỉ hiện văn bản cần xem (${kq.filter(r => r.muc !== 'ok').length}/${kq.length})</label></div>
  ${ds.map(r => `<div class="the" style="margin-bottom:8px"><div class="cong-cu" style="margin:0"><b style="flex:1;min-width:0">${esc(r.nhan)}</b><span class="chip ${MUC_KTL[r.muc][1]}">${MUC_KTL[r.muc][0]}</span>${r.st.map(chipTT).join(' ')}</div>
    ${r.het || r.tu ? `<p class="nho muted" style="margin:4px 0">${r.tu ? 'Hiệu lực ' + fmtNgay(r.tu) : ''}${r.tu && r.het ? ' · ' : ''}${r.het ? 'Hết hiệu lực ' + fmtNgay(r.het) : ''}</p>` : ''}
    ${r.ccMo.map(c => `<p class="nho" style="margin:4px 0"><b>Việc cần làm (quy trình):</b> ${esc(c.viec)}</p>`).join('')}
    ${[...new Set(r.items.flatMap(i => [...(i.chain || []), i.remark].filter(Boolean)))].slice(0, 4).map(c => `<p class="nho" style="margin:2px 0">↳ ${esc(c)}</p>`).join('')}
    ${r.muc === 'khongCo' ? '<p class="nho muted" style="margin:4px 0">Chưa có trong cơ sở VBPL. Tra cứu trên Thư viện pháp luật / vbpl.vn rồi bổ sung vào Hệ thống VBPL.</p>' : ''}
    <details><summary class="nho">Trích ở ${r.nguon.length} chỗ trong app${r.items.length ? ` · ${r.items.length} mục trong cơ sở VBPL` : ''}</summary>
      <ul class="ds nho">${r.nguon.map(n => `<li><a href="#" data-act="den" data-view="${n.view}">${esc(n.nhan)}</a></li>`).join('')}</ul>${r.items.map(veMucVanBan).join('')}</details></div>`).join('') || '<p class="muted">Không có căn cứ nào cần xem.</p>'}`;
}
function veCanCuQuyTrinh() {
  const nhanTTcc = { hl: ['Đang hiệu lực', 'st-xong'], sap: ['Sắp thay đổi', 'st-canh'], thoihan: ['Có thời hạn', 'st-canh'] };
  return `<p class="muted nho">Danh mục căn cứ của quy trình GPMB, giao đất, cho thuê đất KCN – CCN (Hưng Yên, Hà Nội) và việc phải làm khi văn bản thay đổi. Đánh dấu "Đã xử lý" khi đã cập nhật quy trình trong app.</p>
  ${VBPL.canCuQuyTrinh.map(c => { const xong = KTL().cc[c.id]?.xong ?? c.daXuLy, [n, l] = nhanTTcc[c.trangThai] || [c.trangThai, 'st-chua']; return `<div class="the" style="margin-bottom:8px;${xong ? 'opacity:.7' : ''}">
    <div class="cong-cu" style="margin:0"><b style="flex:1;min-width:0">${esc(c.code)}</b><span class="chip ${l}">${n}</span>${c.hetHan ? `<span class="chip st-canh">Hết ${fmtNgay(c.hetHan)}</span>` : ''}
      <label class="nho"><input type="checkbox" data-sua="ktl-cc" data-id="${esc(c.id)}" data-f="xong" ${xong ? 'checked' : ''}> Đã xử lý</label></div>
    <p class="nho" style="margin:4px 0">${esc(c.noidung)}</p><p class="nho muted" style="margin:2px 0">Hiệu lực: ${esc(c.hieuLuc)}</p>
    ${c.viec ? `<p class="nho" style="margin:4px 0"><b>Việc cần làm:</b> ${esc(c.viec)}</p>` : ''}
    ${c.link ? `<a class="nho" href="${esc(c.link)}" target="_blank" rel="noopener">Mở văn bản ↗</a>` : ''}</div>`; }).join('')}`;
}
function veXacMinh() {
  return `<p class="muted nho">Các điểm phải xác minh trước khi áp dụng quy trình (theo bảng "Điểm cần xác minh" của Hệ thống VBPL).</p>
  <div style="overflow-x:auto"><table class="bang nho"><thead><tr><th>#</th><th>Nhóm</th><th>Nội dung</th><th>Đề xuất xử lý</th><th>Tình trạng</th><th>Xong</th></tr></thead><tbody>
  ${VBPL.xacMinh.map(x => `<tr style="${KTL().xm[x.id]?.xong ? 'opacity:.6' : ''}"><td>${x.stt}</td><td>${esc(x.nhom)}</td><td>${esc(x.nd)}</td><td>${esc(x.deXuat)}</td><td>${esc(x.tinhTrang)}${KTL().xm[x.id]?.ngay ? `<br><span class="muted">App: xong ${fmtNgay(KTL().xm[x.id].ngay)}</span>` : ''}</td>
    <td><input type="checkbox" data-sua="ktl-xm" data-id="${esc(x.id)}" data-f="xong" ${KTL().xm[x.id]?.xong ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>`;
}
function mocSapToi() {
  const t = homNay(), den = congNgay(t, 120), tu = congNgay(t, -7), ds = [];
  for (const m of VBPL.moc) if (m.ngay >= tu && m.ngay <= den) ds.push({ ngay: m.ngay, nd: m.nd, the: m.the, loai: 'Mốc' });
  for (const it of VBPL.vanBan) {
    if (hopLeNgay(it.effectiveFrom) && it.effectiveFrom >= tu && it.effectiveFrom <= den) ds.push({ ngay: it.effectiveFrom, nd: `${it.code} có hiệu lực – ${it.text || ''}`, the: it.the, loai: 'Hiệu lực' });
    if (hopLeNgay(it.expiresAt) && it.expiresAt >= tu && it.expiresAt <= den) ds.push({ ngay: it.expiresAt, nd: `${it.code} hết hiệu lực – ${it.text || ''}`, the: it.the, loai: 'Hết hiệu lực' });
  }
  for (const c of VBPL.canCuQuyTrinh) if (hopLeNgay(c.hetHan) && c.hetHan >= tu && c.hetHan <= den) ds.push({ ngay: c.hetHan, nd: `${c.code} hết thời hạn áp dụng`, the: 'QT', loai: 'Hết hiệu lực' });
  const da = new Set(); return ds.sort((a, b) => a.ngay.localeCompare(b.ngay)).filter(x => { const k = x.ngay + x.nd; if (da.has(k)) return false; da.add(k); return true; });
}
function veMocSap(ds) {
  const t = homNay();
  return `<p class="muted nho">Mốc lập pháp, ngày văn bản có hoặc hết hiệu lực trong 120 ngày tới (và 7 ngày vừa qua).</p>
  <ul class="ds">${ds.map(x => `<li><span style="width:86px" class="${x.ngay < t ? 'muted' : ''}">${fmtNgay(x.ngay)}</span><span class="chip ${x.loai === 'Hết hiệu lực' ? 'st-cham' : x.loai === 'Hiệu lực' ? 'st-lam' : 'st-chua'}">${x.loai}</span><span class="fill nho">${esc(x.nd)}<br><span class="muted">${x.the === 'QT' ? 'Căn cứ quy trình' : 'Thẻ ' + esc(x.the) + ' · ' + esc(tenThe(x.the))}</span></span></li>`).join('') || '<li class="muted">Không có.</li>'}</ul>`;
}
function veTraCuuVBPL() {
  const VIET_TAT = [[/\bnghi dinh\b/g, 'nd'], [/\bthong tu\b/g, 'tt'], [/\bquyet dinh\b/g, 'qd'], [/\bnghi quyet\b/g, 'nq'], [/\bso\b/g, '']];
  const q = VIET_TAT.reduce((s, [r, v]) => s.replace(r, v), boDauKtl(UI.ktlTim || '')).trim(), loc = it => (!UI.ktlTT || it.status === UI.ktlTT) && (!UI.ktlLoai || it.kind === UI.ktlLoai) && (!UI.ktlThe || it.the === UI.ktlThe);
  // số hiệu: bỏ hậu tố (31/2021/nd-cp → 31/2021) vì cơ sở thường ghi tắt; bỏ ngoặc
  const tu = q.replace(/(\d{1,4}\/\d{4})\/[a-z0-9-]+/g, '$1').replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  const khop = arr => { const s = VIET_TAT.reduce((a, [r, v]) => a.replace(r, v), boDauKtl(arr.filter(Boolean).join(' '))); return tu.every(w => s.includes(w)); };
  const ds = VBPL.vanBan.filter(it => loc(it) && (!tu.length || khop([it.code, it.text, it.note, it.remark, it.group, it.groupSub, ...(it.chain || [])])));
  const cc = tu.length && !UI.ktlTT && !UI.ktlLoai && !UI.ktlThe ? VBPL.canCuQuyTrinh.filter(c => khop([c.code, c.noidung, c.hieuLuc, c.viec])) : [];
  const loai = [...new Set(VBPL.vanBan.map(x => x.kind))];
  return `<div class="cong-cu"><input class="o" type="search" placeholder="Số hiệu hoặc nội dung (gõ không dấu được)…" value="${esc(UI.ktlTim || '')}" data-loc="ktlTim" style="flex:1;min-width:200px">
    <select class="o" data-loc="ktlTT"><option value="">Mọi trạng thái</option>${VBPL.trangThai.map(([k, n]) => `<option value="${esc(k)}" ${UI.ktlTT === k ? 'selected' : ''}>${esc(k)} – ${esc(n)}</option>`).join('')}</select>
    <select class="o" data-loc="ktlLoai"><option value="">Mọi loại</option>${loai.map(k => `<option ${UI.ktlLoai === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
    <select class="o" data-loc="ktlThe"><option value="">Mọi thẻ</option>${VBPL.the.map(x => `<option value="${x.n}" ${UI.ktlThe === x.n ? 'selected' : ''}>${x.n}. ${esc(x.ten)}</option>`).join('')}</select></div>
  ${cc.length ? `<p class="nho"><b>Căn cứ quy trình GPMB – giao đất (${cc.length})</b></p>${cc.map(c => `<div class="the-vb" style="display:block"><b>${esc(c.code)}</b> <span class="muted nho">${esc(c.hieuLuc)}</span><br><span class="nho">${esc(c.noidung)}</span>${c.viec ? `<br><span class="nho" style="color:var(--canh)">▸ ${esc(c.viec)}</span>` : ''}${c.link ? `<br><a class="nho" href="${esc(c.link)}" target="_blank" rel="noopener">Mở văn bản ↗</a>` : ''}</div>`).join('')}` : ''}
  <p class="muted nho">${ds.length} mục trong cơ sở VBPL${ds.length > 100 ? ' – hiện 100 mục đầu, gõ thêm từ khoá để thu hẹp' : ''}.</p>
  ${ds.slice(0, 100).map(veMucVanBan).join('')}`;
}

window.SUA_THEM ||= {};
Object.assign(window.SUA_THEM, {
  'ktl-cc'(el, id, f, gt) { KTL().cc[id] = { xong: !!gt, ngay: homNay() }; ghiNhatKyChung(`Kiểm tra luật: căn cứ quy trình ${id} – ${gt ? 'đã xử lý' : 'chưa xử lý'}`); },
  'ktl-xm'(el, id, f, gt) { if (gt) KTL().xm[id] = { xong: true, ngay: homNay() }; else delete KTL().xm[id]; },
});
(window.VE_THEM ||= {})['kiem-tra-luat'] = veKiemTraLuat;

/* ---------------------- TỔNG QUAN + KIỂM TRA SỐ LIỆU ---------------------- */
const _veTongQuanKTL = veTongQuan;
veTongQuan = function () {
  const h = _veTongQuanKTL(); damBaoVBPL();
  if (!VBPL) return h;
  const kq = ketQuaKiemTra().ds, het = kq.filter(r => r.muc === 'het'), thay = kq.filter(r => ['thay', 'thoihan'].includes(r.muc));
  if (!het.length && !thay.length) return h;
  const the = `<div class="canh-hop"><b>Kiểm tra luật:</b> ${het.length ? `<b style="color:var(--cham)">${het.length} căn cứ đã hết hiệu lực/bãi bỏ</b> (${het.slice(0, 3).map(r => esc(r.nhan)).join('; ')})` : ''}${het.length && thay.length ? '; ' : ''}${thay.length ? `${thay.length} căn cứ sắp bị thay thế, cần xử lý hoặc có thời hạn` : ''} đang được trích trong quy trình của app. <a href="#" data-act="den" data-view="kiem-tra-luat">Xem</a>.</div>`;
  const i = h.indexOf('</h2>');
  return i < 0 ? the + h : h.slice(0, i + 5) + the + h.slice(i + 5);
};
const _kiemTraKTL = kiemTraSoLieu;
kiemTraSoLieu = function () {
  const kq = _kiemTraKTL();
  if (VBPL) for (const r of ketQuaKiemTra().ds) if (r.muc === 'het' || r.muc === 'thay')
    kq.push({ muc: 'Pháp lý', mucDo: r.muc === 'het' ? 'loi' : 'canh', nd: `${r.nhan}: ${MUC_KTL[r.muc][0].toLowerCase()} – đang trích ở ${r.nguon.length} chỗ (VD: ${r.nguon[0].nhan.slice(0, 60)}).` });
  return kq;
};

Object.assign(HD, {
  'ktl-nap'() { VBPL_LOI = ''; if (VBPL) VBPL._daDoc = false; napVBPL(true).then(() => render()); },
  'ktl-tab'(el) { UI.ktlTab = el.dataset.v; render(); },
  'ktl-mo'(el) { UI.view = 'kiem-tra-luat'; UI.ktlTab = 'tra-cuu'; UI.ktlTim = el.dataset.q.replace(/[()]/g, ' '); UI.drawer = null; render(); },
});
