'use strict';
/* App QLDA KCN Văn Giang – Giai đoạn 1
   Dữ liệu: IndexedDB (đệm) + "00. APP QLDA\du-lieu.json" trong thư mục dự án (OneDrive). */

const PHIEN_BAN_APP = '1.9.0';

/* ============================== tiện ích ============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function homNay() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function ngayTuMs(ms) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const ngayMs = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const hopLeNgay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
function khoang(a, b) { return Math.round((ngayMs(b) - ngayMs(a)) / 864e5); } // b − a (ngày)
function congNgay(s, n) { return new Date(ngayMs(s) + n * 864e5).toISOString().slice(0, 10); }
function fmtNgay(s) { return hopLeNgay(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : ''; }
function fmtSo(n, le = 0) { if (n == null || n === '' || isNaN(n)) return ''; return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: le, maximumFractionDigits: le }); }
const fmtHa = n => (n == null || n === '' ? '—' : fmtSo(n, 2));
const tyDong = n => (n == null ? '—' : fmtSo(n / 1e9, 2) + ' tỷ');
function docSo(s) { if (s == null) return null; s = String(s).trim(); if (!s) return null; s = s.replace(/\s/g, ''); if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, ''); const n = Number(s); return isNaN(n) ? null : n; }
const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const tenNgayFile = (s = homNay()) => s.replace(/-/g, '.');
const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const khop = (chu, tu) => !tu || boDau(chu).includes(boDau(tu));

/* ============================== lưu trữ trình duyệt ============================== */
const KHO = {
  db: null,
  mo() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((ok, loi) => {
      const r = indexedDB.open('qlda-vgip', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; ok(this.db); };
      r.onerror = () => loi(r.error);
    });
  },
  async lay(k) {
    try { const db = await this.mo(); return await new Promise((ok, loi) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => loi(q.error); }); }
    catch (e) { console.warn('IndexedDB', e); return undefined; }
  },
  async dat(k, v) {
    try { const db = await this.mo(); await new Promise((ok, loi) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = ok; tx.onerror = () => loi(tx.error); }); }
    catch (e) { console.warn('IndexedDB', e); }
  },
};
const LS = { lay(k, md) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : md; } catch { return md; } }, dat(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

/* ============================== trạng thái ============================== */
let D = null;          // dữ liệu dự án
let CHI_MUC = null;    // chỉ mục file trong thư mục dự án
const FS = { goc: null, app: null, ketNoi: false, canKetNoiLai: false, lanSuaFile: 0, xungDot: false, lanGhi: null };
const UI = Object.assign({
  view: 'tong-quan', tdMode: 'gantt', zoom: 'thang', locNhom: '', locTT: '', tim: '',
  vbTab: 'so', vbLoai: '', vbChieu: '', vbTT: '', vbTim: '', vbSoDong: 200,
  khoTM: '', khoTim: '', khoChuaSo: true, khoSoDong: 300, nguoiChon: '',
}, LS.lay('qlda-ui', {}));
UI.drawer = null;

const TRANG_THAI = ['Chưa làm', 'Đang làm', 'Chậm TĐ', 'Đã xong'];
const LOP_TT = { 'Đã xong': 'st-xong', 'Đang làm': 'st-lam', 'Chậm TĐ': 'st-cham', 'Chưa làm': 'st-chua' };
const LOAI_VB = ['Quyết định', 'Công văn', 'Tờ trình', 'Báo cáo', 'Thông báo', 'Hợp đồng', 'Biên bản', 'Giấy phép', 'Giấy chứng nhận', 'Bản vẽ', 'Khác'];
const CHIEU_VB = ['Đến', 'Đi', 'Nội bộ'];
const TT_VB = ['Dự thảo', 'Đã trình', 'Đã duyệt/ban hành', 'Đã nhận', 'Đã scan lưu'];
const TT_DOT = ['Chờ CV đề nghị', 'Chờ tờ trình', 'Đã trình', 'Đã chuyển tiền', 'Đang chi trả', 'Đã chi trả xong', 'Đã bàn giao'];
const TT_PHIEU = { 'cho-soan': ['Chờ soạn', 'st-canh'], 'dang-soan': ['Đang soạn', 'st-lam'], 'da-soan': ['Đã soạn', 'st-xong'], 'loi': ['Lỗi', 'st-cham'] };

const MAU = {
  'ttr-chuyen-kinh-phi-bthc': {
    ten: 'Tờ trình chuyển kinh phí BTHT theo QĐ phê duyệt phương án', loai: 'Tờ trình',
    thuMuc: '03. Các văn bản\\03. Tờ trình',
    mauThamKhao: ['03. Các văn bản\\03. Tờ trình\\2026.10.29. Phê duyệt chuyển kinh phí BTHT theo QĐ 4719-QĐ-UBND và CV 230-CV-BQLDA (ver1).docx',
      '03. Các văn bản\\03. Tờ trình\\Trình phê duyệt chi phí GPMB đợt 2 24.8.docx'],
  },
  'bao-cao-tien-do': {
    ten: 'Báo cáo tiến độ dự án gửi Ban Lãnh đạo', loai: 'Báo cáo',
    thuMuc: '02. Hồ sơ thực hiện dự án\\02. Tiến độ triển khai',
    mauThamKhao: ['02. Hồ sơ thực hiện dự án\\02. Tiến độ triển khai\\2026.10.27\\2026.10.27. BC tien do KCN Van Giang ver4.docx'],
  },
  'van-ban-tu-do': {
    ten: 'Văn bản khác theo yêu cầu (tờ trình, công văn…)', loai: 'Tờ trình',
    thuMuc: '03. Các văn bản\\03. Tờ trình', mauThamKhao: [],
  },
};

/* ============================== dữ liệu ============================== */
function chuanHoa(d) {
  d.viec ||= []; d.moc ||= []; d.nhom ||= []; d.vanBan ||= []; d.nguoi ||= []; d.phieu ||= []; d.quyTrinhMau ||= [];
  d.gpmb ||= {}; d.gpmb.dot ||= []; d.gpmb.tongHop ||= {}; d.gpmb.keHoachChiTra ||= []; d.gpmb.lichSu ||= []; d.gpmb.moMa ||= {};
  d.caiDat ||= {}; d.caiDat.thuMucApp ||= '00. APP QLDA'; d.duAn ||= {};
  for (const v of d.viec) { v.phuThuoc ||= []; v.checklist ||= []; v.vanBan ||= []; v.nhatKy ||= []; }
  for (const v of d.vanBan) v.lienKet ||= [];
  d.gpmb.moMa.qd ||= [];
  d.hopDong ||= []; d.banVe ||= [];
  for (const x of d.hopDong) { x.dieuChinh ||= []; x.thanhToan ||= []; x.vbIds ||= []; }
  for (const x of [...d.gpmb.dot, ...d.gpmb.moMa.qd]) { x.dieuChinh ||= []; x.ttrIds ||= []; x.khoanMuc ||= {}; x.cvDeNghi ||= {}; }
  // Quy trình mẫu (Hưng Yên) và đợt thuê đất: dữ liệu cũ chưa có thì lấy từ dữ liệu gốc; quy trình gốc mới hơn thì thay.
  const G = window.DU_LIEU_GOC || {};
  // Gói bổ sung (QĐ mới nhận…): chỉ thêm cái còn thiếu, mỗi gói một lần, không ghi đè số liệu đã sửa tay.
  d.daBoSung ||= [];
  for (const b of G.boSung || []) {
    if (d.daBoSung.includes(b.ma)) continue;
    const them = (ds, nguon, ids) => (ids || []).forEach(id => { const g = (nguon || []).find(x => x.id === id); if (g && !ds.some(x => x.id === id)) ds.push(structuredClone(g)); });
    them(d.vanBan, G.vanBan, b.vanBan); them(d.gpmb.dot, G.gpmb?.dot, b.dot); them(d.gpmb.moMa.qd, G.gpmb?.moMa?.qd, b.moQd); them(d.hopDong, G.hopDong, b.hopDong); them(d.banVe, G.banVe, b.banVe);
    for (const id of b.duongDan || []) { const x = d.vanBan.find(v => v.id === id), g = (G.vanBan || []).find(v => v.id === id); if (x && g && !x.duongDan) { x.duongDan = g.duongDan; x.ghiChu = g.ghiChu; } }
    for (const c of b.dieuChinh || []) {
      const x = d.gpmb.dot.find(v => v.id === c.dotId), g = G.gpmb?.dot?.find(v => v.id === c.dotId)?.dieuChinh?.find(e => e.qdSo === c.qdSo);
      if (x && g && !(x.dieuChinh || []).some(e => e.qdSo === c.qdSo)) { (x.dieuChinh ||= []).push(structuredClone(g)); x.dieuChinh.sort((p, q) => (p.qdNgay || '').localeCompare(q.qdNgay || '')); }
    }
    for (const id of b.khoanMuc || []) { const x = d.gpmb.dot.find(v => v.id === id), g = G.gpmb?.dot?.find(v => v.id === id); if (x && g) { x.khoanMuc ||= {}; for (const [k, v] of Object.entries(g.khoanMuc || {})) if (x.khoanMuc[k] == null) x.khoanMuc[k] = v; } }
    for (const [k, v] of Object.entries(b.moMa || {})) if ((d.gpmb.moMa[k] || 0) < v) d.gpmb.moMa[k] = v;
    for (const c of b.truong || []) { const x = d.gpmb.dot.find(v => v.id === c.dotId); if (x) for (const [k, v] of Object.entries(c.f)) if (x[k] == null) x[k] = v; }
    // Sửa số trong lịch sử GPMB đã ghi sai (chỉ khi còn đúng số sai cũ).
    for (const c of b.lichSu || []) { const x = d.gpmb.lichSu.find(v => v.ngay === c.ngay); if (x) for (const [k, [cu, moi]] of Object.entries(c.f)) if (x[k] === cu) x[k] = moi; }
    d.daBoSung.push(b.ma); (d.nhatKyChung ||= []).push({ luc: new Date().toISOString(), noiDung: 'Bổ sung dữ liệu: ' + (b.ghiChu || b.ma) });
  }
  for (const x of [...d.gpmb.dot, ...d.gpmb.moMa.qd]) { x.dieuChinh ||= []; x.ttrIds ||= []; x.khoanMuc ||= {}; x.cvDeNghi ||= {}; }
  dongBoPheDuyet(d);
  if ((G.phienBanQuyTrinh || 0) > (d.phienBanQuyTrinh || 0)) { d.quyTrinhMau = structuredClone(G.quyTrinhMau || []); d.kiemSoatUuDai = structuredClone(G.kiemSoatUuDai || []); d.phienBanQuyTrinh = G.phienBanQuyTrinh; }
  d.kiemSoatUuDai ||= [];
  if (!d.thueDat && G.thueDat) d.thueDat = structuredClone(G.thueDat);
  d.thueDat ||= {}; d.thueDat.dot ||= [];
  for (const x of d.thueDat.dot) { x.buoc ||= {}; x.mg ||= {}; }
  d.lichSuTienDo ||= []; d.nhatKyChung ||= [];
  return d;
}
const viec = id => D.viec.find(v => v.id === id);
const vb = id => D.vanBan.find(v => v.id === id);
const dot = id => D.gpmb.dot.find(v => v.id === id) || D.gpmb.moMa.qd?.find(v => v.id === id);
const laMo = x => x?.loai === 'mo';
// Số "Phê duyệt phương án" (ha, PA) luôn tính từ các QĐ phê duyệt đang nhập – không nhập tay, tránh lệch với báo cáo cũ.
function dongBoPheDuyet(d) {
  const ds = d.gpmb?.dot || [], th = d.gpmb.tongHop;
  th.pheDuyetHa = Math.round(ds.reduce((s, x) => s + (+x.dienTich || 0), 0) / 100) / 100;
  th.pheDuyetPA = ds.reduce((s, x) => s + (+x.soHo || 0) + (+x.soPATS || 0), 0);
}
const tatCaQD = () => [...D.gpmb.dot, ...(D.gpmb.moMa.qd || [])];
const nguoi = id => D.nguoi.find(v => v.id === id);
const tenNguoi = id => nguoi(id)?.ten || '';
const nhomTen = ma => D.nhom.find(n => n.ma === ma)?.ten || ma;

function trangThai(v) {
  if (v.trangThai === 'Đã xong') return 'Đã xong';
  const t = homNay();
  if (hopLeNgay(v.ketThuc) && v.ketThuc < t) return 'Chậm TĐ';
  if (v.trangThai === 'Chưa làm' && hopLeNgay(v.batDau) && v.batDau < t) return 'Chậm TĐ';
  return v.trangThai === 'Đang làm' ? 'Đang làm' : 'Chưa làm';
}
function pctKeHoach(v) {
  const t = homNay();
  if (!hopLeNgay(v.batDau) || !hopLeNgay(v.ketThuc)) return 0;
  if (t < v.batDau) return 0; if (t >= v.ketThuc) return 100;
  return Math.round((khoang(v.batDau, t) + 1) / (khoang(v.batDau, v.ketThuc) + 1) * 100);
}
const pctThucTe = v => (v.trangThai === 'Đã xong' ? 100 : (+v.pct || 0));
function canhPhuThuoc(v) {
  const loi = [];
  for (const p of v.phuThuoc) {
    const tr = viec(p.id); if (!tr) continue;
    if (p.kieu === 'SS' ? v.batDau < tr.batDau : v.batDau <= tr.ketThuc) loi.push(`Bắt đầu trước khi việc ${tr.tt} ${p.kieu === 'SS' ? 'bắt đầu' : 'xong'} (${fmtNgay(p.kieu === 'SS' ? tr.batDau : tr.ketThuc)})`);
  }
  return loi;
}
function trangThaiMoc(m) {
  const ds = m.viec.map(viec).filter(Boolean);
  const xong = ds.length && ds.every(v => v.trangThai === 'Đã xong');
  const con = khoang(homNay(), m.han);
  if (xong) return ['Đạt', 'st-xong', con];
  if (con < 0) return [`Quá ${-con} ngày`, 'st-cham', con];
  if (con <= 14) return [`Còn ${con} ngày`, 'st-canh', con];
  return [`Còn ${con} ngày`, 'st-lam', con];
}
const tongDot = x => (x.dieuChinh?.length ? x.dieuChinh[x.dieuChinh.length - 1].tongMoi : x.tong);
const hanChiTra = x => (hopLeNgay(x.hieuLuc || x.qdNgay) ? congNgay(x.hieuLuc || x.qdNgay, 30) : '');
const dotXongChiTra = x => ['Đã chi trả xong', 'Đã bàn giao'].includes(x.trangThai);
const dotDaChuyen = x => ['Đã chuyển tiền', 'Đang chi trả', 'Đã chi trả xong', 'Đã bàn giao'].includes(x.trangThai);
// Quá hạn mà Công ty chưa chuyển tiền → rủi ro tiền chậm trả; đã chuyển nhưng chưa xác nhận chi trả xong → cần xác nhận với xã.
const dotQuaHanChuyen = x => !dotDaChuyen(x) && hanChiTra(x) && hanChiTra(x) < homNay();
const dotCanXacNhanChiTra = x => dotDaChuyen(x) && !dotXongChiTra(x) && hanChiTra(x) && hanChiTra(x) < homNay();
// Lịch chi trả dự kiến do xã thông báo (VD 25–27/11/2026): còn ≤ 10 ngày mà chưa chuyển tiền → nhắc chuyển trước ngày chi trả.
const dotChiTraSap = x => !dotDaChuyen(x) && hopLeNgay(x.chiTraTu) && khoang(homNay(), x.chiTraTu) <= 10;
const ngayChiTraDK = x => (hopLeNgay(x.chiTraTu) ? (hopLeNgay(x.chiTraDen) && x.chiTraDen !== x.chiTraTu ? `${fmtNgay(x.chiTraTu).slice(0, 5)}–${fmtNgay(x.chiTraDen)}` : fmtNgay(x.chiTraTu)) : '');
const tenQD = x => `${laMo(x) ? 'QĐ mộ' : 'QĐ'} ${x.qdSo}`;

/* ---------- cho thuê đất & miễn, giảm tiền thuê đất (quy trình Hưng Yên – QĐ 31/2026) ---------- */
const tdDot = id => D.thueDat.dot.find(x => x.id === id);
const mauQT = ma => D.quyTrinhMau.find(q => q.ma === ma)?.buoc || [];
const congNam = (s, n) => (hopLeNgay(s) ? `${+s.slice(0, 4) + n}${s.slice(4)}` : '');
function congThang(s, n) { if (!hopLeNgay(s)) return ''; let y = +s.slice(0, 4), m = +s.slice(5, 7) + n; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${pad(m)}-${s.slice(8)}`; }
function buocTD(x) { return mauQT('thue-dat').filter(b => b.buoc).map(b => ({ ...b, xong: x.buoc[b.buoc]?.xong || '', ghiChu: x.buoc[b.buoc]?.ghiChu || '' })); }
function buocTDHienTai(x) {
  const ds = buocTD(x).filter(b => b.buoc !== 'Bước 4a' || x.hinhThucTra === 'Một lần');
  return { ds, xong: ds.filter(b => b.xong).length, hien: ds.find(b => !b.xong) || null };
}
// Trạng thái từng mục miễn, giảm: xong | ko (không áp dụng) | qua (quá hạn nội bộ, chưa cập nhật) | can-xn (đã nộp hồ sơ thuê đất nhưng chưa xác nhận có mục này) | chua
function mienGiam(x) {
  const t = homNay(), nopHS = x.buoc['Bước 1']?.xong || '', qd = hopLeNgay(x.qdNgay) ? x.qdNgay : '';
  return mauQT('mien-giam').map(m => {
    const r = x.mg[m.ma] || {};
    const han = m.luc === 'nop' ? nopHS : qd ? congNgay(qd, m.hanNgay || 0) : '';
    const tt = r.khongAD ? 'ko' : r.xong ? 'xong' : m.luc === 'nop' && nopHS ? 'can-xn' : han && han < t ? 'qua' : 'chua';
    return { ...m, xong: r.xong || '', ghiChu: r.ghiChu || '', khongAD: !!r.khongAD, han, tt };
  });
}
function tomTatMG(x) {
  const ds = mienGiam(x);
  return { ds, xong: ds.filter(m => m.tt === 'xong' || m.tt === 'ko').length, tong: ds.length, qua: ds.filter(m => m.tt === 'qua'), canXN: ds.filter(m => m.tt === 'can-xn') };
}
// Mốc ưu đãi: miễn XDCB tối đa 03 năm từ ngày QĐ cho thuê đất; tiếp đó miễn theo ngành; kê khai nộp tiền trước khi hết miễn ít nhất 06 tháng.
function mocMien(x) {
  if (!hopLeNgay(x.qdNgay)) return null;
  const xd = congNam(x.qdNgay, D.thueDat.namMienXDCB ?? 3), ud = D.thueDat.namMienUuDai ? congNam(xd, D.thueDat.namMienUuDai) : '';
  return { xd, ud, keKhai: congThang(ud || xd, -6) };
}
const LOP_MG = { xong: 'st-xong', ko: 'st-chua', qua: 'st-cham', 'can-xn': 'st-canh', chua: 'st-chua' };
const NHAN_MG = { xong: 'Đã làm', ko: 'Không áp dụng', qua: 'Quá hạn / chưa cập nhật', 'can-xn': 'Cần xác nhận', chua: 'Chưa đến hạn' };
function canhThueDat() {
  const t = homNay(), kq = [];
  for (const x of D.thueDat.dot) {
    const s = tomTatMG(x), v = viec(x.viecId), mm = mocMien(x);
    if (s.qua.length) kq.push({ x, loai: 'qua', ds: s.qua });
    if (s.canXN.length) kq.push({ x, loai: 'can-xn', ds: s.canXN });
    if (!x.qdNgay && !x.buoc['Bước 1']?.xong && v && v.trangThai !== 'Đã xong' && hopLeNgay(v.batDau) && khoang(t, v.batDau) <= 30) kq.push({ x, loai: 'sap' });
    if (mm && khoang(t, mm.keKhai) <= 90) kq.push({ x, loai: 'ke-khai', mm });
  }
  return kq;
}

function mucTieuChiTra(ngay = homNay()) {
  const ds = [...D.gpmb.lichSu.slice(0, 1).map(x => ({ ngay: x.ngay, ha: x.chiTraHa })), ...D.gpmb.keHoachChiTra].filter(x => hopLeNgay(x.ngay)).sort((a, b) => a.ngay.localeCompare(b.ngay));
  if (!ds.length) return null;
  if (ngay <= ds[0].ngay) return { ha: ds[0].ha, moc: ds[0] };
  for (let i = 1; i < ds.length; i++) {
    if (ngay <= ds[i].ngay) { const a = ds[i - 1], b = ds[i]; const tl = khoang(a.ngay, ngay) / khoang(a.ngay, b.ngay); return { ha: a.ha + (b.ha - a.ha) * tl, moc: b, mocTruoc: a }; }
  }
  return { ha: ds[ds.length - 1].ha, moc: ds[ds.length - 1] };
}
function mocKeHoachDaQua(ngay = homNay()) { return D.gpmb.keHoachChiTra.filter(x => x.ngay <= ngay).pop() || null; }

function thongKe() {
  const t = homNay(); let tong = 0, tt = 0, kh = 0;
  const cham = [], sapHan = [], canXN = [], dangLam = [];
  for (const v of D.viec) {
    const n = v.soNgay || 1; tong += n; tt += n * pctThucTe(v); kh += n * pctKeHoach(v);
    const st = trangThai(v);
    if (st === 'Chậm TĐ') cham.push(v);
    else if (st !== 'Đã xong' && v.ketThuc >= t && khoang(t, v.ketThuc) <= 14) sapHan.push(v);
    if (st === 'Đang làm') dangLam.push(v);
    if (v.canXacNhan) canXN.push(v);
  }
  cham.sort((a, b) => a.ketThuc.localeCompare(b.ketThuc)); sapHan.sort((a, b) => a.ketThuc.localeCompare(b.ketThuc));
  const g = D.gpmb, th = g.tongHop;
  const tongKinhPhi = g.dot.reduce((s, x) => s + (tongDot(x) || 0), 0);
  const tongDtDot = g.dot.reduce((s, x) => s + (+x.dienTich || 0), 0) / 1e4;
  const tongKinhPhiMo = (g.moMa.qd || []).reduce((s, x) => s + (tongDot(x) || 0), 0);
  const dotQuaHan = tatCaQD().filter(dotQuaHanChuyen);
  const dotChoXN = tatCaQD().filter(dotCanXacNhanChiTra);
  const chiTraSap = tatCaQD().filter(dotChiTraSap).sort((a, b) => a.chiTraTu.localeCompare(b.chiTraTu));
  const mocSap = D.moc.filter(m => trangThaiMoc(m)[0] !== 'Đạt').sort((a, b) => a.han.localeCompare(b.han));
  return {
    thucTe: tong ? tt / tong : 0, keHoach: tong ? kh / tong : 0, cham, sapHan, canXN, dangLam,
    tongKinhPhi, tongKinhPhiMo, chiTraSap, tongDtDot, dotQuaHan, dotChoXN, mocSap, mucTieu: mucTieuChiTra(), mocKH: mocKeHoachDaQua(), th,
    phieuCho: D.phieu.filter(p => p.trangThai !== 'da-soan'), tdCanh: canhThueDat(),
    vbThieuFile: D.vanBan.filter(v => !v.tuDong && !v.duongDan),
  };
}

/* ============================== lưu & đồng bộ thư mục ============================== */
let henGhi = null;
function luu() {
  D.capNhat = new Date().toISOString(); D.tuGoc = false;
  KHO.dat('du-lieu', D);
  clearTimeout(henGhi); henGhi = setTimeout(ghiFileDuLieu, 700);
  veDongBo();
}
async function ghiJson(dir, ten, obj) {
  const fh = await dir.getFileHandle(ten, { create: true });
  const w = await fh.createWritable(); await w.write(JSON.stringify(obj, null, 1)); await w.close();
  return (await fh.getFile()).lastModified;
}
async function docJson(dir, ten) {
  try { const f = await (await dir.getFileHandle(ten)).getFile(); return { data: JSON.parse(await f.text()), lastModified: f.lastModified }; }
  catch { return null; }
}
async function ghiFileDuLieu() {
  if (!FS.ketNoi || FS.xungDot) return;
  try {
    const fh = await FS.app.getFileHandle('du-lieu.json', { create: true });
    const f = await fh.getFile();
    if (FS.lanSuaFile && f.size && f.lastModified > FS.lanSuaFile + 1500) {
      FS.xungDot = true; veDongBo();
      thongBao('du-lieu.json trong thư mục vừa bị thay đổi ở nơi khác. Vào Cài đặt để chọn bản giữ lại.', 'loi', 8000);
      return;
    }
    FS.lanSuaFile = await ghiJson(FS.app, 'du-lieu.json', D); FS.lanGhi = new Date();
  } catch (e) { thongBao('Không ghi được du-lieu.json: ' + e.message, 'loi'); }
  veDongBo();
}
async function chonThuMuc() {
  if (!window.showDirectoryPicker) return thongBao('Trình duyệt này không hỗ trợ chọn thư mục. Dùng Edge hoặc Chrome trên máy tính.', 'loi', 6000);
  try { const h = await window.showDirectoryPicker({ id: 'qlda-vgip', mode: 'readwrite' }); await ketNoiThuMuc(h); }
  catch (e) { if (e.name !== 'AbortError') thongBao('Không mở được thư mục: ' + e.message, 'loi'); }
}
async function ketNoiLai() {
  if (FS.driveCho && typeof ketNoiDrive === 'function') return ketNoiDrive(FS.driveCho);
  const h = await KHO.lay('thu-muc'); if (!h) return chonThuMuc();
  try { if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') await ketNoiThuMuc(h); }
  catch (e) { thongBao('Không kết nối lại được: ' + e.message, 'loi'); }
}
async function ketNoiThuMuc(h) {
  FS.goc = h; FS.app = await h.getDirectoryHandle(D.caiDat.thuMucApp, { create: true });
  FS.ketNoi = true; FS.canKetNoiLai = false; FS.xungDot = false;
  if (!h.isDrive) { await KHO.dat('thu-muc', h); await KHO.dat('drive', null); FS.driveCho = null; }
  let dung = false; try { await h.getDirectoryHandle('03. Các văn bản'); dung = true; } catch { }
  if (!dung) thongBao(`Thư mục "${h.name}" không có "03. Các văn bản" — kiểm tra đã chọn đúng thư mục (1. VGIP) KCN Văn Giang chưa.`, 'canh', 8000);
  const f = await docJson(FS.app, 'du-lieu.json');
  if (f?.data?.viec) {
    FS.lanSuaFile = f.lastModified;
    if (D.tuGoc || !D.capNhat || (f.data.capNhat || '') > D.capNhat) {
      D = chuanHoa(f.data); await KHO.dat('du-lieu', D);
      thongBao('Đã tải dữ liệu từ thư mục dự án (cập nhật ' + new Date(D.capNhat || f.lastModified).toLocaleString('vi-VN') + ').');
    } else if (f.data.capNhat !== D.capNhat) { await ghiFileDuLieu(); thongBao('Dữ liệu trên máy mới hơn — đã ghi vào thư mục dự án.'); }
  } else {
    FS.lanSuaFile = await ghiJson(FS.app, 'du-lieu.json', D);
    thongBao(`Đã tạo ${D.caiDat.thuMucApp}\\du-lieu.json trong thư mục dự án.`);
  }
  const cm = await docJson(FS.app, 'chi-muc-ho-so.json');
  if (cm?.data?.files) { CHI_MUC = cm.data; await KHO.dat('chi-muc', CHI_MUC); }
  render();
  if (typeof tuDongQuet === 'function') setTimeout(tuDongQuet, 300);
}
async function taiLaiTuThuMuc() {
  if (!FS.ketNoi) return thongBao('Chưa kết nối thư mục.', 'canh');
  const f = await docJson(FS.app, 'du-lieu.json'); if (!f?.data?.viec) return thongBao('Không đọc được du-lieu.json.', 'loi');
  D = chuanHoa(f.data); FS.lanSuaFile = f.lastModified; FS.xungDot = false; await KHO.dat('du-lieu', D);
  thongBao('Đã tải lại dữ liệu từ thư mục.'); render();
}
async function giuBanMay() { FS.xungDot = false; FS.lanSuaFile = 0; await ghiFileDuLieu(); thongBao('Đã ghi đè du-lieu.json bằng dữ liệu trên máy này.'); render(); }

// Tên file trên Windows/OneDrive có thể ở dạng Unicode tách dấu (NFD, "a" + dấu huyền) trong khi app lưu dạng dựng sẵn (NFC, "à"):
// nhìn giống nhau nhưng không khớp. Mọi so sánh đường dẫn đều chuẩn hoá NFC; khi mở file thì thử tên đúng, sai thì dò theo NFC.
const nfc = s => String(s ?? '').normalize('NFC');
async function conTheoTen(dir, ten, kieu) {
  try { return kieu === 'dir' ? await dir.getDirectoryHandle(ten) : await dir.getFileHandle(ten); }
  catch (e) {
    for await (const [t, h] of dir.entries()) if (nfc(t) === nfc(ten) && h.kind === (kieu === 'dir' ? 'directory' : 'file')) return h;
    throw e;
  }
}
async function layFile(rel) {
  const phan = rel.split('\\').filter(Boolean); let dir = FS.goc;
  for (const p of phan.slice(0, -1)) dir = await conTheoTen(dir, p, 'dir');
  return (await conTheoTen(dir, phan[phan.length - 1], 'file')).getFile();
}
function duongDanDayDu(rel) { return (D.caiDat.duongDanGoc || '').replace(/\\$/, '') + '\\' + rel; }
async function chep(text, tb = 'Đã chép.') {
  try { await navigator.clipboard.writeText(text); thongBao(tb); }
  catch { moModal('Chép thủ công', `<pre class="lenh">${esc(text)}</pre>`, [{ nhan: 'Đóng', act: 'dong-modal' }]); }
}
async function moFile(rel) {
  if (!rel) return thongBao('Văn bản này chưa có file trong thư mục dự án.', 'canh');
  if (FS.ketNoi && FS.goc?.isDrive && typeof moFileDrive === 'function') return moFileDrive(rel);
  const ext = rel.split('.').pop().toLowerCase();
  if (!FS.ketNoi || !['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'htm', 'html', 'svg'].includes(ext)) {
    return chep(duongDanDayDu(rel), 'Đã chép đường dẫn. Nhấn Win+R, dán (Ctrl+V), Enter để mở bằng ứng dụng trên máy.');
  }
  try { const f = await layFile(rel); window.open(URL.createObjectURL(f), '_blank'); }
  catch (e) { thongBao('Không mở được file (có thể đã đổi tên/di chuyển): ' + e.message, 'loi', 6000); }
}

/* ============================== quét thư mục ============================== */
function phanTichTen(ten, thuMuc = '') {
  const goc = ten.replace(/\.[^.]+$/, '');
  let ngay = null, m;
  if ((m = goc.match(/^(20\d\d)\.(\d{1,2})\.(\d{1,2})/))) ngay = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  else if ((m = goc.match(/^(\d\d)\.(\d{1,2})\.(\d{1,2})\./))) ngay = `20${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  else if ((m = goc.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d\d)/))) ngay = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  if (ngay && isNaN(ngayMs(ngay))) ngay = null;
  const mv = goc.match(/\(?\bver\s*(\d+)\)?/i);
  const trich = goc.replace(/^(20\d\d|\d\d)\.\d{1,2}\.\d{1,2}\.?\s*/, '').replace(/\s*\(?\bver\s*\d+\)?/ig, '').replace(/^[\s.\-_]+|[\s.\-_]+$/g, '');
  // Giữ đồng bộ với phan_tich_ten() trong tools/tao-du-lieu-goc.py
  const KY = { 'QĐ': 'Quyết định', CV: 'Công văn', TTr: 'Tờ trình', BC: 'Báo cáo', TB: 'Thông báo', GPMT: 'Giấy phép', 'HĐ': 'Hợp đồng', BB: 'Biên bản' };
  let so = '', ky = '';
  if ((m = trich.match(/(?<![\d.])(\d{1,5})\s*[./]?\s*(QĐ|TTr|TB|CV|BC|GPMT|NQ|GM|HĐ|BB)((?:[\-.][A-ZĐ0-9][A-Za-zĐđ0-9]*)*)/))) { ky = m[2]; so = m[1] + '/' + (m[2] + m[3].replace(/\./g, '-')).replace(/^-+|-+$/g, ''); }
  else if ((m = trich.match(/(?<![\d.])(\d{1,5})\.([A-ZĐ][A-ZĐa-zđ]*(?:-[A-ZĐ][A-Za-zĐđ0-9]*)+)/))) { so = m[1] + '/' + m[2]; ky = m[2].split('-').find(k => KY[k]) || ''; }
  else if ((m = trich.match(/^(QĐ|CV|TB)\s*(\d{2,5})\b/))) { ky = m[1]; so = m[2] + '/' + m[1]; }
  const BANG = [[/\bQĐ|\bQD\b|Quyết định|Quyet dinh/, 'Quyết định'], [/\bTTr\b|Tờ trình|To trinh|^Trình |\bTrình phê/, 'Tờ trình'], [/\bBC\b|Báo cáo|Bao cao/, 'Báo cáo'], [/\bTB\b|Thông báo/, 'Thông báo'], [/(?<![\p{L}\p{N}])HĐ(?![\p{L}\p{N}])|Hợp đồng|Hop dong/u, 'Hợp đồng'], [/\bBB|Biên bản/, 'Biên bản'], [/GCN|Giấy chứng nhận/, 'Giấy chứng nhận'], [/\bCV|Công văn|Cong van|CVĐ/, 'Công văn'], [/\bGP|Giấy phép/, 'Giấy phép'], [/Đề nghị|Đề xuất|De nghi|De xuat/, 'Tờ trình']];
  let loai = KY[ky] || (thuMuc.toLowerCase().includes('tờ trình') ? 'Tờ trình' : '');
  if (!loai) { loai = 'Khác'; for (const [re, l] of BANG) if (re.test(trich)) { loai = l; break; } }
  if (/\.(dwg|dgn)$/i.test(ten)) loai = 'Bản vẽ';
  const tm = thuMuc.toLowerCase();
  const chieu = (tm.includes('cv đến') || /cvđ/i.test(goc)) ? 'Đến' : tm.includes('cv đi') ? 'Đi' : 'Nội bộ';
  return { ngay, ver: mv ? +mv[1] : null, loai, so, chieu, trichYeu: trich, khoa: trich.toLowerCase().replace(/\s+/g, ' ') };
}
async function quetThuMuc() {
  if (!FS.ketNoi) return thongBao('Chưa kết nối thư mục dự án (Cài đặt → Chọn thư mục).', 'canh');
  if (FS.goc?.isDrive && typeof quetDrive === 'function') return quetDrive();
  const files = []; let dem = 0; const tenApp = D.caiDat.thuMucApp;
  thongBao('Đang quét thư mục dự án…');
  async function di(dir, tienTo) {
    for await (const [ten, e] of dir.entries()) {
      if (ten.startsWith('.') || ten.startsWith('~$') || /^(desktop\.ini|thumbs\.db)$/i.test(ten)) continue;
      const p = tienTo ? tienTo + '\\' + ten : ten;
      if (e.kind === 'directory') { if (!tienTo && ten === tenApp) continue; await di(e, p); }
      else {
        const f = await e.getFile(); files.push({ p: nfc(p), kb: Math.round(f.size / 1024), sua: ngayTuMs(f.lastModified) });
        if (++dem % 400 === 0) thongBao(`Đang quét… ${dem} file`, '', 1200);
      }
    }
  }
  try { await di(FS.goc, ''); } catch (e) { return thongBao('Lỗi khi quét: ' + e.message, 'loi'); }
  files.sort((a, b) => a.p.localeCompare(b.p, 'vi'));
  CHI_MUC = { ngayQuet: new Date().toISOString(), goc: FS.goc.name, files };
  await KHO.dat('chi-muc', CHI_MUC);
  try { await ghiJson(FS.app, 'chi-muc-ho-so.json', CHI_MUC); } catch { }
  thongBao(`Đã quét ${files.length.toLocaleString('vi-VN')} file.`); render();
}
function nhapChiMuc() {
  chonFileJson(async obj => {
    if (!Array.isArray(obj.files)) return thongBao('File không phải chỉ mục hồ sơ.', 'loi');
    CHI_MUC = obj; await KHO.dat('chi-muc', CHI_MUC); thongBao(`Đã nạp chỉ mục ${obj.files.length} file.`); render();
  });
}
function chonFileJson(cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = async () => { try { cb(JSON.parse(await i.files[0].text())); } catch (e) { thongBao('File JSON không hợp lệ: ' + e.message, 'loi'); } };
  i.click();
}
function vaoSo(p) {
  if (D.vanBan.some(v => nfc(v.duongDan) === nfc(p))) return thongBao('File đã có trong sổ.', 'canh');
  const ten = p.split('\\').pop(), thuMuc = p.split('\\').slice(0, -1).join('\\');
  const tt = phanTichTen(ten, thuMuc); const f = CHI_MUC?.files.find(x => x.p === p);
  const ext = ten.split('.').pop().toLowerCase();
  const v = { id: uid('vb'), so: tt.so, ngay: tt.ngay || f?.sua || homNay(), loai: tt.loai, chieu: tt.chieu, coQuan: '', trichYeu: tt.trichYeu,
    trangThai: tt.chieu === 'Đến' ? 'Đã nhận' : ext === 'pdf' ? 'Đã scan lưu' : 'Dự thảo', duongDan: p, ver: tt.ver, khoa: tt.khoa, ghiChu: tt.ngay ? '' : 'Ngày lấy theo ngày sửa file.', lienKet: [], tuDong: true };
  D.vanBan.push(v); luu(); thongBao('Đã đưa vào sổ: ' + tt.trichYeu); return v;
}

/* ============================== phiếu yêu cầu soạn ============================== */
function canCuTuVb(id, vai) {
  const v = vb(id); if (!v) return null;
  return { vai, so: v.so, ngay: v.ngay, coQuan: v.coQuan, trichYeu: v.trichYeu, duongDan: v.duongDan || '', ghiChu: v.ghiChu || '' };
}
function tenFileMoi(noiDung, duoi) {
  const goc = `${tenNgayFile()}. ${noiDung}`; let n = 1;
  const daCo = new Set(D.phieu.map(p => p.tenFileGoiY));
  while (daCo.has(`${goc} (ver${n}).${duoi}`)) n++;
  return `${goc} (ver${n}).${duoi}`;
}
async function taoPhieu({ mau, tieuDe, noiDungNgan, doiTuong = null, duLieu = {}, canCu = [], yeuCauThem = '', thuMuc = null }) {
  const m = MAU[mau]; const id = uid('phieu');
  const tenDocx = tenFileMoi(noiDungNgan, 'docx');
  const tenJson = tenDocx.replace(/\.docx$/, '.json');
  const phieu = {
    loai: 'phieu-yeu-cau-soan', phienBan: 1, id, ngayTao: new Date().toISOString(), mau, tenMau: m.ten, loaiVanBan: m.loai, tieuDe,
    tenFileGoiY: tenDocx, thuMucDich: thuMuc || m.thuMuc, duongDanGoc: D.caiDat.duongDanGoc,
    duAn: D.duAn, nguoiDeNghi: D.caiDat.toiLa ? tenNguoi(D.caiDat.toiLa) : '',
    doiTuong, duLieu, canCu: canCu.filter(Boolean), mauThamKhao: m.mauThamKhao, yeuCauThem,
    trangThai: 'cho-soan', ketQua: null,
  };
  let noiLuu = '';
  if (FS.ketNoi) {
    try { const dir = await FS.app.getDirectoryHandle('yeu-cau-soan', { create: true }); await ghiJson(dir, tenJson, phieu); noiLuu = `${D.caiDat.thuMucApp}\\yeu-cau-soan\\${tenJson}`; }
    catch (e) { thongBao('Không ghi được phiếu vào thư mục: ' + e.message, 'loi'); }
  }
  if (!noiLuu) taiVe(tenJson, JSON.stringify(phieu, null, 1), 'application/json');
  D.phieu.push({ id, file: tenJson, tenFileGoiY: tenDocx, mau, tieuDe, ngayTao: phieu.ngayTao, trangThai: 'cho-soan', doiTuong, noiLuu });
  luu();
  const lenh = noiLuu ? `/to-trinh-vgip "${duongDanDayDu(noiLuu)}"` : `/to-trinh-vgip "<đường dẫn file ${tenJson} vừa tải về>"`;
  try { await navigator.clipboard.writeText(lenh); } catch { }
  moModal('Đã tạo phiếu yêu cầu soạn', `
    <p><b>${esc(tieuDe)}</b><br><span class="muted">${esc(m.ten)}</span></p>
    <p>${noiLuu ? `Phiếu đã lưu tại <code>${esc(noiLuu)}</code>.` : 'Chưa kết nối thư mục nên phiếu đã được tải về máy.'} Lệnh đã chép sẵn — dán vào Claude Code:</p>
    <pre class="lenh">${esc(lenh)}</pre>
    <p class="muted nho">Claude đọc phiếu, văn bản căn cứ và mẫu, soạn bản nháp + bản sạch vào <code>${esc(phieu.thuMucDich)}</code>, rồi ghi kết quả vào phiếu. Sau đó vào Văn bản → Phiếu soạn → "Cập nhật kết quả".</p>`,
    [{ nhan: 'Chép lại lệnh', act: 'chep', data: lenh }, { nhan: 'Đóng', act: 'dong-modal', chinh: true }]);
  render();
}
async function capNhatKetQuaPhieu() {
  if (!FS.ketNoi) return thongBao('Cần kết nối thư mục dự án để đọc kết quả.', 'canh');
  let dir; try { dir = await FS.app.getDirectoryHandle('yeu-cau-soan'); } catch { return thongBao('Chưa có thư mục yeu-cau-soan.', 'canh'); }
  let doc = 0, moi = 0;
  for await (const [ten, e] of dir.entries()) {
    if (e.kind !== 'file' || !ten.endsWith('.json')) continue;
    let obj; try { obj = JSON.parse(await (await e.getFile()).text()); } catch { continue; }
    const p = D.phieu.find(x => x.id === obj.id); if (!p) continue;
    doc++; p.trangThai = obj.trangThai || p.trangThai; p.ketQua = obj.ketQua || null;
    if (p.trangThai === 'da-soan' && p.ketQua && !p.daNhan) {
      for (const [k, nhan] of [['banSach', 'bản sạch'], ['banNhap', 'bản nháp']]) {
        const duong = p.ketQua[k]; if (!duong || D.vanBan.some(v => nfc(v.duongDan) === nfc(duong))) continue;
        const tt = phanTichTen(duong.split('\\').pop(), duong);
        const v = { id: uid('vb'), so: '', ngay: tt.ngay || homNay(), loai: MAU[p.mau]?.loai || 'Tờ trình', chieu: 'Nội bộ', coQuan: D.duAn.donVi || '',
          trichYeu: `${p.tieuDe} (${nhan})`, trangThai: 'Dự thảo', duongDan: duong, ver: tt.ver, khoa: tt.khoa, ghiChu: 'Claude soạn từ phiếu ' + p.file, lienKet: p.doiTuong ? [p.doiTuong] : [], tuDong: false };
        D.vanBan.push(v); moi++;
        if (p.doiTuong?.kieu === 'dot') dot(p.doiTuong.id)?.ttrIds.push(v.id);
        if (p.doiTuong?.kieu === 'hd') D.hopDong.find(h => h.id === p.doiTuong.id)?.vbIds.push(v.id);
        if (p.doiTuong?.kieu === 'viec') viec(p.doiTuong.id)?.vanBan.push(v.id);
      }
      p.daNhan = true;
    }
  }
  luu(); render();
  thongBao(`Đã đọc ${doc} phiếu; thêm ${moi} văn bản mới vào sổ.`);
}
function phieuDot(id) {
  const x = dot(id); if (!x) return;
  const soNgan = x.qdSo.replace(/\//g, '-');
  const canCu = [canCuTuVb(x.qdId, 'Quyết định phê duyệt phương án BTHT'), ...x.dieuChinh.map(d => canCuTuVb(d.qdId, 'Quyết định điều chỉnh')),
    x.cvDeNghi?.vbId ? canCuTuVb(x.cvDeNghi.vbId, 'Công văn đề nghị chuyển kinh phí') : null, x.cvdId ? canCuTuVb(x.cvdId, 'Phiếu trình văn bản đến') : null];
  // Các QĐ cùng lịch chi trả (VD QĐ 5591 đất + QĐ 5456 mộ chi trả 25–27/11) → gợi ý gộp một tờ trình.
  const cungLich = x.chiTraTu ? tatCaQD().filter(d => d.id !== id && d.chiTraTu === x.chiTraTu && !dotDaChuyen(d)) : [];
  const tong = tongDot(x);
  taoPhieu({
    mau: 'ttr-chuyen-kinh-phi-bthc', tieuDe: `Tờ trình phê duyệt chuyển kinh phí BTHT theo ${tenQD(x)}${cungLich.length ? ' và ' + cungLich.map(tenQD).join(', ') : ''}`,
    noiDungNgan: `Phê duyệt chuyển kinh phí BTHT theo QĐ ${soNgan}${cungLich.length ? ' và ' + cungLich.map(d => d.qdSo.replace(/\//g, '-')).join(', ') : ''}`, doiTuong: { kieu: 'dot', id },
    duLieu: { dot: x, loai: laMo(x) ? 'Bồi thường, hỗ trợ di chuyển mộ' : 'Bồi thường, hỗ trợ đất và tài sản', tongDeNghi: tong, hanChiTra: hanChiTra(x), chiTraDuKien: ngayChiTraDK(x),
      hanChuyenTienDeXuat: hopLeNgay(x.chiTraTu) ? congNgay(x.chiTraTu, -1) : hopLeNgay(hanChiTra(x)) ? congNgay(hanChiTra(x), -6) : '',
      cungLichChiTra: cungLich.map(d => ({ loai: laMo(d) ? 'Di chuyển mộ' : 'Đất, tài sản', ten: d.ten, qdSo: d.qdSo, qdNgay: d.qdNgay, khoanMuc: d.khoanMuc, tong: tongDot(d) })),
      tongCungLich: cungLich.length ? tong + cungLich.reduce((s, d) => s + (tongDot(d) || 0), 0) : null,
      dotLienQuan: tatCaQD().filter(d => d.id !== id).map(d => ({ loai: laMo(d) ? 'Di chuyển mộ' : 'Đất, tài sản', ten: d.ten, qdSo: d.qdSo, tong: tongDot(d), trangThai: d.trangThai, dieuChinh: d.dieuChinh, ghiChu: d.ghiChu })) },
    canCu,
  });
}
function phieuBaoCao() {
  const tk = thongKe();
  taoPhieu({
    mau: 'bao-cao-tien-do', tieuDe: `Báo cáo tiến độ Dự án KCN Văn Giang đến ngày ${fmtNgay(homNay())}`,
    noiDungNgan: 'BC tiến độ KCN Văn Giang',
    duLieu: {
      ngaySoLieu: homNay(), tienDoThucTe: Math.round(tk.thucTe), tienDoKeHoach: Math.round(tk.keHoach),
      moc: D.moc.map(m => ({ ...m, trangThai: trangThaiMoc(m)[0] })),
      viecCham: tk.cham.map(v => ({ tt: v.tt, ten: v.ten, ketThuc: v.ketThuc, chuTri: v.chuTri, ghiChu: v.ghiChu })),
      viecSapHan: tk.sapHan.map(v => ({ tt: v.tt, ten: v.ten, ketThuc: v.ketThuc })),
      gpmb: { tongHop: D.gpmb.tongHop, mucTieuDenNay: tk.mucTieu, dot: tatCaQD().map(d => ({ loai: laMo(d) ? 'Di chuyển mộ' : 'Đất, tài sản', ten: d.ten, qdSo: d.qdSo, qdNgay: d.qdNgay, tong: tongDot(d), khoanMuc: d.khoanMuc, trangThai: d.trangThai, hanChiTra: hanChiTra(d), chiTraDuKien: ngayChiTraDK(d) })), moMa: D.gpmb.moMa },
      zalo: taoZalo(),
    },
    yeuCauThem: 'Cập nhật Báo cáo tiến độ theo cấu trúc BC 27/10/2026 ver4 (I. Đánh giá chung; II. Tình hình thực hiện; III. Các mốc; IV. Đề xuất; V. Kiến nghị) và số liệu trong phiếu.',
  });
}
function phieuTuDo(doiTuong = null, vbIds = []) {
  const ds = vbIds.map(id => vb(id)).filter(Boolean);
  moModal('Phiếu soạn văn bản theo yêu cầu', `
    <div class="form">
      <label class="rong">Tiêu đề / trích yếu<input id="pt-td" placeholder="VD: Tờ trình phê duyệt chủ trương, kế hoạch LCNT gói thầu …"></label>
      <label>Loại<select id="pt-loai"><option>Tờ trình</option><option>Công văn</option><option>Báo cáo</option></select></label>
      <label>Lưu vào<select id="pt-tm"><option value="03. Các văn bản\\03. Tờ trình">03. Tờ trình</option><option value="03. Các văn bản\\01. CV đi\\1. file mềm">01. CV đi (file mềm)</option><option value="02. Hồ sơ thực hiện dự án\\06. Báo cáo">06. Báo cáo</option></select></label>
      <label class="rong">Yêu cầu cho Claude<textarea id="pt-yc" placeholder="Nội dung chính, số liệu, người nhận, mẫu muốn theo…"></textarea></label>
      <label class="rong">Văn bản căn cứ (đánh mã hoặc số hiệu, chọn từ danh sách)<input id="pt-them" list="dl-vb" placeholder="Gõ để tìm…"></label>
    </div>
    <div id="pt-ds" class="muc">${ds.map(v => theVb(v, 'pt-bo')).join('') || '<p class="muted nho">Chưa chọn văn bản căn cứ.</p>'}</div>`,
    [{ nhan: 'Huỷ', act: 'dong-modal' }, { nhan: 'Tạo phiếu', act: 'pt-tao', chinh: true }]);
  UI.ptVb = ds.map(v => v.id); UI.ptDoiTuong = doiTuong; capNhatDatalist();
}

/* ============================== báo cáo ============================== */
function taoZalo() {
  const tk = thongKe(), t = homNay(), th = D.gpmb.tongHop;
  const lech = Math.round(tk.keHoach - tk.thucTe);
  const moc = tk.mocSap[0];
  const dong = [`KCN VĂN GIANG – BÁO CÁO NHANH ${fmtNgay(t)}`];
  const ketLuan = [];
  ketLuan.push(lech > 3 ? `tiến độ chung chậm ${lech}% so kế hoạch` : 'tiến độ chung bám kế hoạch');
  if (tk.mocKH && th.chiTraHa < tk.mocKH.ha) ketLuan.push(`GPMB chưa đạt mốc ${fmtSo(tk.mocKH.ha, 0)} ha (hạn ${fmtNgay(tk.mocKH.ngay)})`);
  if (tk.dotQuaHan.length) ketLuan.push(`${tk.dotQuaHan.map(tenQD).join(', ')} đã quá hạn chi trả nhưng chưa ghi nhận chuyển tiền`);
  if (tk.chiTraSap.length) ketLuan.push(`cần chuyển ${tyDong(tk.chiTraSap.reduce((s, x) => s + (tongDot(x) || 0), 0))} trước đợt chi trả ${ngayChiTraDK(tk.chiTraSap[0])} (${tk.chiTraSap.map(tenQD).join(', ')})`);
  dong.push('Kết luận: ' + ketLuan.join('; ') + '.');
  dong.push(`1. Tiến độ chung: thực hiện ${Math.round(tk.thucTe)}%, kế hoạch ${Math.round(tk.keHoach)}%; ${tk.cham.length} việc chậm, ${tk.sapHan.length} việc đến hạn trong 14 ngày.`);
  if (moc) { const [nhan] = trangThaiMoc(moc); dong.push(`2. Mốc gần nhất: ${moc.id} (${fmtNgay(moc.han)}) ${moc.noiDung} – ${nhan.toLowerCase()}.`); }
  dong.push(`3. GPMB (số liệu ${fmtNgay(th.ngay)}): chi trả ${fmtHa(th.chiTraHa)}/${fmtHa(th.tongHa)} ha; bàn giao thực địa ${fmtHa(th.banGiaoHa)} ha${tk.mocKH ? `; mục tiêu ${fmtSo(tk.mocKH.ha, 0)} ha đến ${fmtNgay(tk.mocKH.ngay)} còn thiếu ${fmtHa(Math.max(0, tk.mocKH.ha - th.chiTraHa))} ha` : ''}.`);
  if (tk.dotQuaHan.length || tk.dotChoXN.length || tk.chiTraSap.length) dong.push(`4. Kinh phí BTHT: ${[...tk.chiTraSap.map(x => `${tenQD(x)} (${fmtSo(tongDot(x))} đ) dự kiến chi trả ${ngayChiTraDK(x)}, chưa ghi nhận chuyển tiền`), ...tk.dotQuaHan.map(x => `${tenQD(x)} quá hạn chi trả ${fmtNgay(hanChiTra(x))}, chưa ghi nhận chuyển tiền`), ...tk.dotChoXN.map(x => `${tenQD(x)} đã chuyển tiền, chờ xã xác nhận chi trả xong`)].join('; ')}.`);
  if (tk.cham.length) dong.push(`5. Việc chậm cần chỉ đạo: ${tk.cham.slice(0, 3).map(v => `${v.ten} (hạn ${fmtNgay(v.ketThuc)})`).join('; ')}${tk.cham.length > 3 ? `; và ${tk.cham.length - 3} việc khác` : ''}.`);
  const mm = D.gpmb.moMa; if (mm.duKien) dong.push(`6. Mồ mả: phê duyệt ${mm.pheDuyet}/khoảng ${mm.duKien} ngôi${mm.qd?.length ? ` (${mm.qd.length} QĐ, kinh phí ${fmtSo(tk.tongKinhPhiMo)} đ)` : ''}; hạn di dời ${fmtNgay(mm.hanDiDoi)}${hopLeNgay(mm.hanDiDoi) ? ` (còn ${khoang(t, mm.hanDiDoi)} ngày)` : ''}.`);
  const tdQua = tk.tdCanh.filter(c => c.loai === 'qua');
  if (tdQua.length) dong.push(`7. Miễn, giảm tiền thuê đất: ${tdQua.map(c => `${c.x.ten}${c.x.qdSo ? ' (QĐ ' + c.x.qdSo + ')' : ''} còn ${c.ds.length} mục chưa cập nhật`).join('; ')} – cần làm ngay để không mất thời gian được miễn.`);
  return dong.join('\n');
}
function taiVe(ten, noiDung, kieu) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(noiDung instanceof Blob ? noiDung : new Blob([noiDung], { type: kieu + ';charset=utf-8' }));
  a.download = ten; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function luuBaoCao(ten, du, kieu) {
  if (FS.ketNoi) {
    try {
      const dir = await FS.app.getDirectoryHandle('bao-cao', { create: true });
      const w = await (await dir.getFileHandle(ten, { create: true })).createWritable(); await w.write(du); await w.close();
      thongBao(`Đã lưu ${D.caiDat.thuMucApp}\\bao-cao\\${ten}`); return;
    } catch (e) { thongBao('Không ghi vào thư mục, tải về máy: ' + e.message, 'canh'); }
  }
  taiVe(ten, du instanceof Blob ? du : new Blob([du], { type: kieu }), kieu);
}
function napThuVien(src) {
  return new Promise((ok, loi) => { if (window.XLSX) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => loi(new Error('không tải được thư viện')); document.head.appendChild(s); });
}
async function xuatExcel() {
  const hang = [['TT', 'Công việc', 'Bắt đầu', 'Kết thúc', 'Số ngày', 'Chủ trì', 'Phối hợp', 'Giao cho', 'Trạng thái', '% thực hiện', '% kế hoạch', 'Mốc', 'Ghi chú']];
  for (const n of D.nhom) {
    hang.push([`${n.ma}. ${n.ten}`]);
    for (const v of D.viec.filter(v => v.nhom === n.ma)) hang.push([v.tt, v.ten, v.batDau, v.ketThuc, v.soNgay, v.chuTri, v.phoiHop, tenNguoi(v.giaoCho), trangThai(v), pctThucTe(v), pctKeHoach(v), v.moc, v.ghiChu]);
  }
  const ten = `${tenNgayFile()}. Tien do KCN Van Giang (xuat tu app)`;
  try {
    await napThuVien('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.utils.book_new();
    const tdHang = hang.map((r, i) => i === 0 ? r : r.map((c, j) => (j === 2 || j === 3) && hopLeNgay(c) ? new Date(c + 'T00:00:00') : c));
    const ws = XLSX.utils.aoa_to_sheet([['BẢNG TIẾN ĐỘ DỰ ÁN KCN VĂN GIANG – GIAI ĐOẠN 1'], [`Cập nhật đến ngày ${fmtNgay(homNay())}`], [], ...tdHang], { cellDates: true, dateNF: 'dd/mm/yyyy' });
    ws['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 11 }, { wch: 11 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 11 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Tiến độ');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Mốc', 'Thời hạn', 'Nội dung', 'Trạng thái'], ...D.moc.map(m => [m.id, fmtNgay(m.han), m.noiDung, trangThaiMoc(m)[0]])]), 'Mốc chính');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Đợt', 'QĐ phê duyệt', 'Ngày QĐ', 'Số hộ', 'Diện tích (m²)', 'Kinh phí hiện hành (đ)', 'Hạn chi trả', 'Chi trả dự kiến', 'Trạng thái', 'Ghi chú'], ...D.gpmb.dot.map(x => [x.ten, x.qdSo, fmtNgay(x.qdNgay), x.soHo, x.dienTich, tongDot(x), fmtNgay(hanChiTra(x)), ngayChiTraDK(x), x.trangThai, x.ghiChu])]), 'GPMB');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Đợt', 'QĐ phê duyệt', 'Ngày QĐ', 'Số ngôi', 'Số PA', 'Bồi thường về mộ (đ)', 'Thưởng tiến độ (đ)', 'Tổng kinh phí (đ)', 'Hạn chi trả', 'Chi trả dự kiến', 'Ngày chuyển tiền', 'Trạng thái', 'Ghi chú'],
      ...D.gpmb.moMa.qd.map(x => [x.ten, x.qdSo, fmtNgay(x.qdNgay), x.soMo, x.soHo, x.khoanMuc?.boiThuong, x.khoanMuc?.thuong, tongDot(x), fmtNgay(hanChiTra(x)), ngayChiTraDK(x), fmtNgay(x.ngayChuyenTien), x.trangThai, x.ghiChu])]), 'Kinh phí mộ');
    if (typeof sheetGD2 === 'function') sheetGD2(wb);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Đợt thuê đất', 'Diện tích (m²)', 'QĐ cho thuê đất', 'Ngày QĐ', 'Bước thủ tục', 'Mục miễn, giảm', 'Trạng thái', 'Hạn nội bộ', 'Ngày đã làm', 'Ghi chú'],
      ...D.thueDat.dot.flatMap(x => { const b = buocTDHienTai(x); return mienGiam(x).map((m, i) => [i ? '' : x.ten, i ? '' : x.dienTichM2, i ? '' : x.qdSo, i ? '' : fmtNgay(x.qdNgay), i ? '' : `${b.xong}/${b.ds.length}${b.hien ? ' – đang ' + b.hien.buoc : ''}`, m.ten, NHAN_MG[m.tt], fmtNgay(m.han), fmtNgay(m.xong), m.ghiChu]); })]), 'Thuê đất - miễn giảm');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nhóm', 'Mức', 'Nội dung'], ...kiemTraSoLieu().map(x => [x.muc, x.mucDo === 'loi' ? 'Lỗi' : 'Lưu ý', x.nd])]), 'Kiểm tra số liệu');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ngày', 'Số/ký hiệu', 'Loại', 'Chiều', 'Cơ quan', 'Trích yếu', 'Trạng thái', 'Đường dẫn'], ...D.vanBan.map(v => [fmtNgay(v.ngay), v.so, v.loai, v.chieu, v.coQuan, v.trichYeu, v.trangThai, v.duongDan])]), 'Văn bản');
    await luuBaoCao(ten + '.xlsx', new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (e) {
    const csv = '﻿' + hang.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    await luuBaoCao(ten + '.csv', csv, 'text/csv');
    thongBao('Không tải được thư viện Excel (mất mạng?) — đã xuất CSV mở được bằng Excel.', 'canh', 6000);
  }
}
function xuatHtmlXem() {
  const tk = thongKe(), th = D.gpmb.tongHop, t = homNay();
  const st = s => `<span style="padding:1px 7px;border-radius:9px;font-size:12px;background:${{ 'Đã xong': '#e3f3ea', 'Đang làm': '#e5eef8', 'Chậm TĐ': '#fbe6e6', 'Chưa làm': '#eef0f3' }[s]};color:${{ 'Đã xong': '#2e8b57', 'Đang làm': '#2f6aa3', 'Chậm TĐ': '#c62828', 'Chưa làm': '#6b7785' }[s]}">${s}</span>`;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Báo cáo nhanh KCN Văn Giang ${fmtNgay(t)}</title>
<style>body{font-family:"Times New Roman",serif;margin:0;padding:16px;color:#1d2733;background:#fff;font-size:15px}h1{font-size:19px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 8px;color:#1f4e79}.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.k div{border:1px solid #dde3ea;border-radius:8px;padding:8px}.k b{display:block;font-size:20px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #e5e9ee;padding:5px;text-align:left;vertical-align:top}th{background:#f1f4f8}.g{color:#5b6876;font-size:13px}pre{white-space:pre-wrap;font-family:inherit;background:#f4f6f9;padding:10px;border-radius:6px}</style></head><body>
<h1>Dự án KCN Văn Giang – Giai đoạn 1</h1><div class="g">Báo cáo nhanh, dữ liệu đến ngày ${fmtNgay(t)} (xuất từ App QLDA).</div>
<h2>Tin nhắn tóm tắt</h2><pre>${esc(taoZalo())}</pre>
<div class="k"><div>Tiến độ thực hiện<b>${Math.round(tk.thucTe)}%</b><span class="g">Kế hoạch ${Math.round(tk.keHoach)}%</span></div><div>Việc chậm<b>${tk.cham.length}</b></div><div>GPMB đã chi trả<b>${fmtHa(th.chiTraHa)} ha</b><span class="g">/ ${fmtHa(th.tongHa)} ha</span></div><div>Kinh phí BTHT theo QĐ<b>${tyDong(tk.tongKinhPhi)}</b></div></div>
<h2>Mốc chính</h2><table><tr><th>Mốc</th><th>Hạn</th><th>Nội dung</th><th>Tình trạng</th></tr>${D.moc.map(m => `<tr><td>${m.id}</td><td>${fmtNgay(m.han)}</td><td>${esc(m.noiDung)}</td><td>${trangThaiMoc(m)[0]}</td></tr>`).join('')}</table>
<h2>GPMB theo quyết định phê duyệt phương án</h2><table><tr><th>Đợt</th><th>QĐ</th><th>Diện tích (m²)</th><th>Kinh phí (đ)</th><th>Hạn chi trả</th><th>Trạng thái</th></tr>${D.gpmb.dot.map(x => `<tr><td>${esc(x.ten)}</td><td>${esc(x.qdSo)} ngày ${fmtNgay(x.qdNgay)}</td><td>${fmtSo(x.dienTich, 1)}</td><td>${fmtSo(tongDot(x))}</td><td>${fmtNgay(hanChiTra(x))}</td><td>${esc(x.trangThai)}</td></tr>`).join('')}</table>
<h2>Bảng tiến độ</h2><table><tr><th>TT</th><th>Công việc</th><th>Thời gian</th><th>Chủ trì</th><th>Tình trạng</th></tr>${D.nhom.map(n => `<tr><th colspan="5">${n.ma}. ${esc(n.ten)}</th></tr>` + D.viec.filter(v => v.nhom === n.ma).map(v => `<tr><td>${v.tt}</td><td>${esc(v.ten)}${v.moc ? ` <b style="color:#c62828">${v.moc}</b>` : ''}</td><td>${fmtNgay(v.batDau)} – ${fmtNgay(v.ketThuc)}</td><td>${esc(v.chuTri)}</td><td>${st(trangThai(v))} ${pctThucTe(v)}%</td></tr>`).join('')).join('')}</table>
</body></html>`;
  luuBaoCao(`${tenNgayFile()}. Bao cao nhanh KCN Van Giang.html`, html, 'text/html');
}

/* ============================== khung hiển thị ============================== */
function thongBao(msg, kieu = '', ms = 3500) {
  const d = document.createElement('div'); d.textContent = msg; if (kieu) d.className = kieu;
  $('#toast').appendChild(d); setTimeout(() => d.remove(), ms);
}
function moModal(tieuDe, html, nut = []) {
  const m = $('#modal');
  m.innerHTML = `<div class="hop" role="dialog" aria-modal="true" aria-label="${esc(tieuDe)}"><h3>${esc(tieuDe)}</h3>${html}<div class="chan">${nut.map(n => `<button class="nut ${n.chinh ? 'chinh' : ''}" data-act="${n.act}" ${n.data ? `data-data="${esc(n.data)}"` : ''}>${esc(n.nhan)}</button>`).join('')}</div></div>`;
  m.hidden = false;
}
function dongModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function veDongBo() {
  const b = $('#dong-bo'); if (!b) return;
  if (FS.xungDot) { b.className = 'dong-bo warn'; b.textContent = '⚠ Xung đột dữ liệu'; }
  else if (FS.ketNoi) { b.className = 'dong-bo ok'; b.textContent = '● Đã nối thư mục' + (FS.lanGhi ? ' · lưu ' + FS.lanGhi.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''); }
  else if (FS.canKetNoiLai) { b.className = 'dong-bo warn'; b.textContent = '○ Bấm để kết nối lại thư mục'; }
  else { b.className = 'dong-bo warn'; b.textContent = '○ Chỉ lưu trên trình duyệt'; }
}
function capNhatDatalist() {
  $('#dl-vb').innerHTML = D.vanBan.map(v => `<option value="${esc(v.id)}">${esc([v.so, fmtNgay(v.ngay), v.trichYeu].filter(Boolean).join(' – '))}</option>`).join('');
}
function theVb(v, actBo, idCha = '') {
  return `<div class="the-vb"><span class="chip">${esc(v.loai)}</span><span class="fill" title="${esc(v.trichYeu)}">${esc([v.so, fmtNgay(v.ngay), v.trichYeu].filter(Boolean).join(' · '))}</span>
    <button class="nut nho" data-act="mo-file" data-p="${esc(v.duongDan)}" ${v.duongDan ? '' : 'disabled title="Chưa có file"'}>Mở</button>
    ${actBo ? `<button class="nut nho xoa" data-act="${actBo}" data-id="${esc(v.id)}" data-cha="${esc(idCha)}" title="Bỏ liên kết">✕</button>` : ''}</div>`;
}

/* --- giữ tiêu điểm & vị trí cuộn khi vẽ lại --- */
const khoaPhanTu = el => el && el.dataset ? [el.dataset.sua, el.dataset.id, el.dataset.f, el.dataset.loc, el.dataset.k].join('|') : '';
function render() {
  const ae = document.activeElement, khoa = khoaPhanTu(ae), selS = ae?.selectionStart;
  const cuon = {}; $$('[data-cuon]').forEach(e => cuon[e.dataset.cuon] = [e.scrollLeft, e.scrollTop]);
  const winY = window.scrollY;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === UI.view));
  $('#ten-du-an').textContent = D.duAn.ten || '';
  const VE = { 'tong-quan': veTongQuan, 'tien-do': veTienDo, gpmb: veGpmb, 'hop-dong': veHopDong, 'ban-ve': veBanVe, 'van-ban': veVanBan, 'giao-viec': veGiaoViec, 'bao-cao': veBaoCao, 'cai-dat': veCaiDat, ...(window.VE_THEM || {}) };
  $('#view').innerHTML = (VE[UI.view] || veTongQuan)();
  veDrawer(); veDongBo(); capNhatDatalist();
  $$('[data-cuon]').forEach(e => { const c = cuon[e.dataset.cuon]; if (c) { e.scrollLeft = c[0]; e.scrollTop = c[1]; } else if (e.dataset.cuonDen) e.scrollLeft = +e.dataset.cuonDen; });
  window.scrollTo(0, winY);
  if (khoa && khoa !== '||||') {
    const moi = $$('[data-sua],[data-loc]').find(e => khoaPhanTu(e) === khoa);
    if (moi) { moi.focus(); try { if (selS != null && moi.setSelectionRange) moi.setSelectionRange(selS, selS); } catch { } }
  }
  LS.dat('qlda-ui', { view: UI.view, tdMode: UI.tdMode, zoom: UI.zoom, locNhom: UI.locNhom, vbTab: UI.vbTab, khoChuaSo: UI.khoChuaSo, nguoiChon: UI.nguoiChon, tdGoc: UI.tdGoc || '' });
}

/* ============================== TỔNG QUAN ============================== */
function veTongQuan() {
  const tk = thongKe(), th = tk.th, mt = tk.mucTieu;
  const canh = [];
  if (!FS.ketNoi && D.tuGoc && !D.viec.length) canh.push(`<b>Chưa mở dữ liệu dự án.</b> Dữ liệu chỉ nằm trong thư mục dự án trên Google Drive của bạn. ${FS.canKetNoiLai ? '<a href="#" data-act="ket-noi-lai">Kết nối lại</a>' : '<a href="#" data-act="den" data-view="cai-dat">Cài đặt → Google Drive → Đăng nhập và kết nối</a>'}.`);
  if (tk.chiTraSap.length) canh.push(`<b style="color:var(--cham)">Lịch chi trả ${esc(ngayChiTraDK(tk.chiTraSap[0]))}</b>: cần chuyển <b>${fmtSo(tk.chiTraSap.reduce((s, x) => s + (tongDot(x) || 0), 0))} đ</b> trước ngày chi trả – ${tk.chiTraSap.map(x => `<a href="#" data-act="mo-dot" data-id="${x.id}">${esc(tenQD(x))}</a> ${fmtSo(tongDot(x))} đ (${esc(x.trangThai)})`).join('; ')}. Trình duyệt tờ trình, chuyển tiền rồi cập nhật ngày chuyển.`);
  if (tk.dotQuaHan.length) canh.push(`Quá hạn chi trả (30 ngày từ hiệu lực QĐ) mà chưa ghi nhận chuyển tiền: ${tk.dotQuaHan.map(x => `<a href="#" data-act="mo-dot" data-id="${x.id}">${esc(tenQD(x))}</a> – hạn ${fmtNgay(hanChiTra(x))}, trạng thái "${esc(x.trangThai)}"`).join('; ')}. Cập nhật ngày chuyển tiền hoặc báo cáo rủi ro tiền chậm trả.`);
  if (tk.dotChoXN.length) canh.push(`Đã chuyển tiền, quá hạn chi trả nhưng chưa xác nhận xã chi trả xong: ${tk.dotChoXN.map(x => `<a href="#" data-act="mo-dot" data-id="${x.id}">${esc(tenQD(x))}</a>`).join(', ')}.`);
  for (const c of tk.tdCanh) {
    const ten = `<a href="#" data-act="mo-td" data-id="${c.x.id}">Thuê đất ${esc(c.x.ten)}</a>`;
    if (c.loai === 'qua') canh.push(`<b style="color:var(--cham)">Miễn, giảm tiền thuê đất</b> – ${ten}${c.x.qdSo ? ` (QĐ ${esc(c.x.qdSo)} ngày ${fmtNgay(c.x.qdNgay)})` : ''}: ${c.ds.length} mục quá hạn hoặc chưa cập nhật (${c.ds.map(m => esc(m.ten.split(' (')[0].split(' –')[0])).join('; ')}). Chậm làm thủ tục thì không được miễn cho khoảng thời gian chậm, Thuế có thể thu đủ và tính tiền chậm nộp.`);
    else if (c.loai === 'can-xn') canh.push(`${ten}: đã nộp hồ sơ xin thuê đất – xác nhận hồ sơ đã có ${c.ds.length} mục miễn, giảm (${c.ds.map(m => esc(m.ten.split(' (')[0])).join('; ')}).`);
    else if (c.loai === 'sap') canh.push(`${ten} đang đến kỳ lập hồ sơ xin thuê đất: kê ngay mục 9 Đơn Mẫu 01, nộp giấy tờ chứng minh miễn, giảm và tách diện tích hạ tầng dùng chung trong cùng bộ hồ sơ.`);
    else if (c.loai === 'ke-khai') canh.push(`${ten}: kê khai nộp tiền thuê đất trước ${fmtNgay(c.mm.keKhai)} (06 tháng trước khi hết thời gian miễn ${fmtNgay(c.mm.ud || c.mm.xd)}).`);
  }
  const ktLoi = kiemTraSoLieu().filter(x => x.mucDo === 'loi');
  if (ktLoi.length) canh.push(`<b>Kiểm tra số liệu:</b> ${ktLoi.length} lỗi có thể làm báo cáo sai lệch (VD: ${esc(ktLoi[0].nd)}). <a href="#" data-act="den" data-view="bao-cao">Xem và sửa</a>.`);
  if (tk.canXN.length) canh.push(`${tk.canXN.length} việc đã qua ngày kết thúc theo kế hoạch nhưng chưa được cập nhật kết quả. <a href="#" data-act="loc-xac-nhan">Xem và xác nhận</a>.`);
  if (CHI_MUC?.files && typeof THU_MUC_BC_GPMB !== 'undefined') { const t0 = new Date(), thu = t0.getDay(), dauTuan = new Date(t0 - ((thu + 6) % 7) * 864e5).toISOString().slice(0, 10); const coBC = CHI_MUC.files.some(f => nfc(f.p).startsWith(nfc(THU_MUC_BC_GPMB) + '\\') && (f.sua || '') >= dauTuan); if (!coBC && (thu === 4 || thu === 5 || thu === 6)) canh.push(`<b>Báo cáo GPMB tuần:</b> chưa có file mới trong <code>06. Báo cáo\\06. Báo cáo GPMB</code> tuần này (cập nhật thứ 5).`); }
  if (typeof hoSoMoi === 'function') { const nHs = hoSoMoi().length, nGoi = UI.goiCho?.length || 0; if (nHs || nGoi) canh.push(`<b>Hồ sơ mới:</b> ${nHs ? `${nHs} file mới trên thư mục dự án chờ xử lý` : ''}${nHs && nGoi ? '; ' : ''}${nGoi ? `${nGoi} gói dữ liệu Claude chờ nạp` : ''}. <a href="#" data-act="den" data-view="van-ban" data-tab="moi">Xem và xử lý</a>.`); }
  if (tk.vbThieuFile.length) canh.push(`${tk.vbThieuFile.length} văn bản căn cứ quan trọng chưa có file trong thư mục dự án (${tk.vbThieuFile.map(v => esc(v.so)).join(', ')}).`);
  return `
  <h2>Tổng quan · ${fmtNgay(homNay())}</h2>
  ${canh.length ? `<div class="canh-hop"><b>Cần xử lý</b><ul style="margin:6px 0 0 18px;padding:0">${canh.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
  <div class="luoi kpi">
    <div class="the"><span>Tiến độ chung (theo thời lượng)</span><b>${Math.round(tk.thucTe)}%</b><span>Kế hoạch đến nay ${Math.round(tk.keHoach)}%</span>
      <div class="thanh"><i style="width:${tk.thucTe}%"></i><i class="kh" style="width:${tk.keHoach}%"></i></div></div>
    <div class="the"><span>Việc chậm tiến độ</span><b style="color:var(--cham)">${tk.cham.length}</b><span>${tk.sapHan.length} việc đến hạn trong 14 ngày</span></div>
    <div class="the"><span>GPMB đã chi trả (${fmtNgay(th.ngay)})</span><b>${fmtHa(th.chiTraHa)} ha</b><span>/ ${fmtHa(th.tongHa)} ha · mục tiêu đến nay ${mt ? fmtHa(mt.ha) : '—'} ha</span>
      <div class="thanh"><i style="width:${th.chiTraHa / th.tongHa * 100}%"></i>${mt ? `<i class="kh" style="width:${mt.ha / th.tongHa * 100}%"></i>` : ''}</div></div>
    <div class="the"><span>Kinh phí BTHT theo QĐ phê duyệt</span><b>${tyDong(tk.tongKinhPhi)}</b><span>${D.gpmb.dot.length} QĐ đất · ${fmtHa(tk.tongDtDot)} ha${D.gpmb.moMa.qd.length ? ` · di chuyển mộ ${tyDong(tk.tongKinhPhiMo)} (${D.gpmb.moMa.qd.length} QĐ)` : ''}</span></div>
    <div class="the"><span>Phiếu soạn văn bản đang chờ</span><b>${tk.phieuCho.length}</b><span><a href="#" data-act="den" data-view="van-ban" data-tab="phieu">Xem phiếu</a></span></div>
  </div>
  <div class="luoi hai">
    <div class="the"><h3>Mốc chính</h3><ul class="ds">${D.moc.map(m => { const [nhan, lop] = trangThaiMoc(m); return `<li><b style="width:34px">${m.id}</b><span class="muted" style="width:82px">${fmtNgay(m.han)}</span><span class="fill">${esc(m.noiDung)}</span><span class="chip ${lop}">${nhan}</span></li>`; }).join('')}</ul></div>
    <div class="the"><h3>Việc chậm tiến độ (${tk.cham.length})</h3>${dsViec(tk.cham.slice(0, 12), true)}${tk.cham.length > 12 ? `<p class="muted nho">… và ${tk.cham.length - 12} việc khác — xem tab Tiến độ.</p>` : ''}
      <h3 style="margin-top:16px">Đến hạn trong 14 ngày (${tk.sapHan.length})</h3>${dsViec(tk.sapHan, false)}</div>
  </div>`;
}
function dsViec(ds, hienQua) {
  if (!ds.length) return '<p class="muted nho">Không có.</p>';
  const t = homNay();
  return `<ul class="ds">${ds.map(v => { const k = khoang(t, v.ketThuc); return `<li class="click" data-act="mo-viec" data-id="${v.id}" style="cursor:pointer"><span class="muted" style="width:26px">${v.tt}</span><span class="fill">${esc(v.ten)}<br><span class="muted nho">${esc(v.chuTri)}${v.giaoCho ? ' · giao ' + esc(tenNguoi(v.giaoCho)) : ''}${v.canXacNhan ? ' · <span class="canh-pt">chưa xác nhận</span>' : ''}</span></span><span class="chip ${k < 0 ? 'st-cham' : 'st-canh'}">${hienQua && k < 0 ? `quá ${-k} ngày` : `hạn ${fmtNgay(v.ketThuc)}`}</span></li>`; }).join('')}</ul>`;
}

/* ============================== TIẾN ĐỘ ============================== */
function viecLoc() {
  return D.viec.filter(v => (!UI.locNhom || v.nhom === UI.locNhom) && (!UI.locTT || (UI.locTT === 'xac-nhan' ? v.canXacNhan : trangThai(v) === UI.locTT)) && (khop(v.ten + ' ' + v.chuTri + ' ' + v.phoiHop + ' ' + tenNguoi(v.giaoCho), UI.tim)));
}
function veTienDo() {
  const ds = viecLoc();
  const thanh = `<div class="cong-cu">
    <div class="nhom-nut">${[['gantt', 'Timeline'], ['bang', 'Bảng dữ liệu'], ['kanban', 'Kanban'], ['lich-su', `Lịch sử (${D.lichSuTienDo.length})`]].map(([k, n]) => `<button data-act="td-mode" data-v="${k}" class="${UI.tdMode === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <select class="o" data-loc="locNhom"><option value="">Tất cả nhóm việc</option>${D.nhom.map(n => `<option value="${n.ma}" ${UI.locNhom === n.ma ? 'selected' : ''}>${n.ma}. ${esc(n.ten)}</option>`).join('')}</select>
    <select class="o" data-loc="locTT"><option value="">Mọi trạng thái</option>${TRANG_THAI.map(s => `<option ${UI.locTT === s ? 'selected' : ''}>${s}</option>`).join('')}<option value="xac-nhan" ${UI.locTT === 'xac-nhan' ? 'selected' : ''}>Cần xác nhận</option></select>
    <input class="o" type="search" placeholder="Tìm việc, chủ trì, người…" value="${esc(UI.tim)}" data-loc="tim">
    ${UI.tdMode === 'gantt' ? `<div class="nhom-nut">${[['tuan', 'Tuần'], ['thang', 'Tháng'], ['quy', 'Quý']].map(([k, n]) => `<button data-act="zoom" data-v="${k}" class="${UI.zoom === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
    ${UI.tdMode === 'gantt' && D.lichSuTienDo.length ? `<select class="o" data-loc="tdGoc" title="Vẽ thêm đường cơ sở (tiến độ đã chốt) dưới mỗi thanh để thấy việc lùi/sớm"><option value="">Không so đường cơ sở</option>${[...D.lichSuTienDo].reverse().map(p => `<option value="${p.id}" ${UI.tdGoc === p.id ? 'selected' : ''}>Cơ sở: ${new Date(p.luc).toLocaleDateString('vi-VN')} – ${esc(p.ten.slice(0, 40))}</option>`).join('')}</select>` : ''}
    <span class="gian"></span><span class="muted nho">${ds.length}/${D.viec.length} việc</span>
    <button class="nut" data-act="td-nhap" title="Nhập bảng tiến độ PL2 (.xlsx) mới: so sánh, chọn thay đổi, lưu file vào thư mục Tiến độ triển khai">Nhập file tiến độ…</button>
    <button class="nut chinh" data-act="them-viec">+ Thêm việc</button></div>`;
  if (UI.tdMode === 'lich-su') return thanh + veLichSuTienDo();
  if (UI.tdMode === 'bang') return thanh + veBangViec(ds);
  if (UI.tdMode === 'kanban') return thanh + veKanban(ds);
  return thanh + veGantt(ds);
}
function veGantt(ds) {
  const px = { tuan: 12, thang: 3.2, quy: 1.3 }[UI.zoom] || 3.2;
  const tatCa = D.viec.filter(v => hopLeNgay(v.batDau) && hopLeNgay(v.ketThuc));
  if (!tatCa.length) return '<div class="rong-tam">Chưa có việc.</div>';
  let bd = tatCa.reduce((a, v) => v.batDau < a ? v.batDau : a, tatCa[0].batDau);
  let kt = tatCa.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, tatCa[0].ketThuc);
  bd = bd.slice(0, 8) + '01';
  { const y = +kt.slice(0, 4), m = +kt.slice(5, 7); kt = congNgay(`${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`, -1); }
  const W = Math.ceil((khoang(bd, kt) + 1) * px), x = s => khoang(bd, s) * px;
  let thang = '', nam = '';
  for (let y = +bd.slice(0, 4), m = +bd.slice(5, 7); `${y}-${pad(m)}-01` <= kt; m === 12 ? (y++, m = 1) : m++) {
    const s = `${y}-${pad(m)}-01`, e = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    thang += `<div class="g-m" style="left:${x(s)}px;width:${x(e) - x(s)}px">${UI.zoom === 'quy' ? m : 'T' + m}</div>`;
  }
  for (let y = +bd.slice(0, 4); `${y}-01-01` <= kt; y++) {
    const s = `${y}-01-01` < bd ? bd : `${y}-01-01`, e = `${y + 1}-01-01` > kt ? congNgay(kt, 1) : `${y + 1}-01-01`;
    nam += `<div class="g-y" style="left:${x(s)}px;width:${x(e) - x(s)}px">Năm ${y}</div>`;
  }
  const t = homNay();
  const homNayX = t >= bd && t <= kt ? x(t) : null;
  let hang = '';
  for (const n of D.nhom) {
    const dsN = ds.filter(v => v.nhom === n.ma); if (!dsN.length) continue;
    const s = dsN.reduce((a, v) => v.batDau < a ? v.batDau : a, dsN[0].batDau), e = dsN.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, dsN[0].ketThuc);
    hang += `<div class="g-row g-nhom"><div class="g-l">${n.ma}. ${esc(n.ten)}</div><div class="g-t" style="width:${W}px"><div class="bar tong" style="left:${x(s)}px;width:${Math.max(3, x(e) - x(s) + px)}px"></div></div></div>`;
    for (const v of dsN) {
      const st = trangThai(v), lop = LOP_TT[st], pt = pctThucTe(v), w = Math.max(4, (khoang(v.batDau, v.ketThuc) + 1) * px);
      const canh = canhPhuThuoc(v).length;
      const tip = `${v.tt}. ${v.ten}\n${fmtNgay(v.batDau)} – ${fmtNgay(v.ketThuc)} (${v.soNgay} ngày)\n${st} · ${pt}% (kế hoạch ${pctKeHoach(v)}%)\nChủ trì: ${v.chuTri}${v.giaoCho ? '\nGiao: ' + tenNguoi(v.giaoCho) : ''}`;
      hang += `<div class="g-row" data-act="mo-viec" data-id="${v.id}" title="${esc(tip)}">
        <div class="g-l"><span class="tt">${v.tt}</span><span class="ten">${esc(v.ten)}</span>${canh ? '<span class="canh-pt" title="Vướng phụ thuộc">⚠</span>' : ''}${v.canXacNhan ? '<span class="canh-pt" title="Cần xác nhận kết quả">?</span>' : ''}<span class="chip ${lop}">${st}</span></div>
        <div class="g-t" style="width:${W}px">${(() => { const g = tienDoGoc(v.id); if (!g || !hopLeNgay(g.batDau) || !hopLeNgay(g.ketThuc) || (g.batDau === v.batDau && g.ketThuc === v.ketThuc)) return ''; const l = khoang(g.ketThuc, v.ketThuc); return `<div class="bar-goc" style="left:${x(g.batDau)}px;width:${Math.max(4, (khoang(g.batDau, g.ketThuc) + 1) * px)}px" title="Đường cơ sở: ${fmtNgay(g.batDau)} – ${fmtNgay(g.ketThuc)}${l ? ` (${l > 0 ? 'lùi' : 'sớm'} ${Math.abs(l)} ngày)` : ''}"></div>`; })()}<div class="bar ${lop}" style="left:${x(v.batDau)}px;width:${w}px"><i style="width:${pt}%"></i>${w > 34 ? `<span>${pt}%</span>` : ''}</div>
        ${v.moc ? `<div class="kc" style="left:${x(v.ketThuc) + px}px"></div><span class="kc-nhan" style="left:${x(v.ketThuc) + px}px">${v.moc}</span>` : ''}</div></div>`;
    }
  }
  const den = homNayX != null ? Math.max(0, homNayX - 200) : 0;
  return `<div class="g-wrap" data-cuon="gantt-${UI.zoom}" data-cuon-den="${den}"><div class="g-body">
    <div class="g-row g-head"><div class="g-l">Công việc</div><div class="g-t" style="width:${W}px;height:44px">${nam}${thang}</div></div>
    ${hang || '<div class="rong-tam">Không có việc khớp bộ lọc.</div>'}
    ${homNayX != null ? `<div class="hom-nay" style="left:calc(var(--gl) + ${homNayX}px)" title="Hôm nay ${fmtNgay(t)}"></div>` : ''}
  </div></div>
  <p class="muted nho">Thanh màu: thời gian kế hoạch, phần đậm là % đã thực hiện. Hình thoi đỏ: mốc chính. Đường đứt đỏ: hôm nay. ⚠: vướng phụ thuộc; ?: cần xác nhận kết quả.${UI.tdGoc ? ' Vạch xám dưới thanh: đường cơ sở đã chốt (chỉ hiện ở việc có thay đổi ngày).' : ''}</p>`;
}
function veBangViec(ds) {
  const opNguoi = id => `<option value="">—</option>${D.nguoi.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.ten)}</option>`).join('')}`;
  let rows = '';
  for (const n of D.nhom) {
    const dsN = ds.filter(v => v.nhom === n.ma); if (!dsN.length) continue;
    rows += `<tr class="nhom"><td colspan="11">${n.ma}. ${esc(n.ten)}</td></tr>`;
    for (const v of dsN) {
      const st = trangThai(v);
      rows += `<tr>
        <td class="muted">${v.tt}</td>
        <td style="min-width:280px"><a href="#" data-act="mo-viec" data-id="${v.id}">${esc(v.ten)}</a>${v.canXacNhan ? ' <span class="canh-pt" title="Cần xác nhận">?</span>' : ''}</td>
        <td><input type="date" data-sua="viec" data-id="${v.id}" data-f="batDau" value="${v.batDau}"></td>
        <td><input type="date" data-sua="viec" data-id="${v.id}" data-f="ketThuc" value="${v.ketThuc}"></td>
        <td style="width:70px"><input type="number" min="1" data-sua="viec" data-id="${v.id}" data-f="soNgay" value="${v.soNgay}"></td>
        <td><select data-sua="viec" data-id="${v.id}" data-f="trangThai">${['Chưa làm', 'Đang làm', 'Đã xong'].map(s => `<option ${v.trangThai === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${st === 'Chậm TĐ' ? '<span class="chip st-cham">Chậm TĐ</span>' : ''}</td>
        <td style="width:70px"><input type="number" min="0" max="100" step="5" data-sua="viec" data-id="${v.id}" data-f="pct" value="${pctThucTe(v)}"></td>
        <td class="muted so">${pctKeHoach(v)}%</td>
        <td class="nho">${esc(v.chuTri)}${v.phoiHop ? `<br><span class="muted">${esc(v.phoiHop)}</span>` : ''}</td>
        <td><select data-sua="viec" data-id="${v.id}" data-f="giaoCho">${opNguoi(v.giaoCho)}</select></td>
        <td>${v.moc ? `<b style="color:var(--cham)">${v.moc}</b>` : ''}</td></tr>`;
    }
  }
  return `<div class="bang-wrap" data-cuon="bang-viec" style="max-height:calc(100vh - 190px)"><table>
    <thead><tr><th>TT</th><th>Công việc</th><th>Bắt đầu</th><th>Kết thúc</th><th>Số ngày</th><th>Trạng thái</th><th>% TH</th><th>% KH</th><th>Chủ trì / phối hợp</th><th>Giao cho</th><th>Mốc</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="11" class="rong-tam">Không có việc khớp bộ lọc.</td></tr>'}</tbody></table></div>`;
}
function veKanban(ds) {
  return `<div class="kanban">${TRANG_THAI.map(s => {
    const c = ds.filter(v => trangThai(v) === s);
    return `<div class="cot" data-cot="${s}"><h3><span class="chip ${LOP_TT[s]}">${s}</span><span class="muted">${c.length}</span></h3>
      ${c.slice(0, 80).map(v => `<div class="card" draggable="true" data-keo="${v.id}" data-act="mo-viec" data-id="${v.id}"><div class="ten">${v.tt}. ${esc(v.ten)}</div><div class="muted nho">${fmtNgay(v.batDau)} – ${fmtNgay(v.ketThuc)} · ${pctThucTe(v)}%${v.moc ? ` · <b style="color:var(--cham)">${v.moc}</b>` : ''}<br>${esc(v.giaoCho ? tenNguoi(v.giaoCho) : v.chuTri)}</div></div>`).join('')}
      ${c.length > 80 ? `<p class="muted nho">… ${c.length - 80} việc khác</p>` : ''}</div>`;
  }).join('')}</div><p class="muted nho">Kéo thẻ sang cột khác để đổi trạng thái. "Chậm TĐ" do app tự tính khi quá hạn chưa xong.</p>`;
}

/* ============================== GPMB ============================== */
function veGpmb() {
  const g = D.gpmb, th = g.tongHop, mm = g.moMa, tk = thongKe(), t = homNay();
  const o = (f, v, le = 2) => `<input class="o so" style="width:110px" data-sua="tongHop" data-f="${f}" value="${fmtSo(v, le)}">`;
  const om = (f, v) => `<input class="o so" style="width:80px" data-sua="moMa" data-f="${f}" value="${v ?? ''}">`;
  return `
  <h2>Bồi thường, giải phóng mặt bằng</h2>
  <div class="luoi hai">
    <div class="the"><h3>Số liệu tổng hợp <span class="muted nho">ngày <input class="o" type="date" data-sua="tongHop" data-f="ngay" value="${th.ngay || ''}"></span></h3>
      <table><tbody>
        <tr><td>Thông báo thu hồi, kiểm kê</td><td class="so">${o('thuHoiHa', th.thuHoiHa)} / ${o('tongHa', th.tongHa)} ha</td></tr>
        <tr><td>Công khai phương án</td><td class="so">${o('congKhaiHa', th.congKhaiHa)} ha</td></tr>
        <tr><td>Phê duyệt phương án<br><span class="muted nho">tự tính từ ${g.dot.length} QĐ phê duyệt bên dưới</span></td><td class="so"><b>${fmtHa(th.pheDuyetHa)}</b> ha · <b>${fmtSo(th.pheDuyetPA)}</b> PA${th.pheDuyetHaBaoCao && Math.abs(th.pheDuyetHaBaoCao - (th.pheDuyetHa || 0)) > 0.05 ? `<br><span class="nho" style="color:var(--canh)">báo cáo tuần ghi ${fmtHa(th.pheDuyetHaBaoCao)} ha – còn QĐ chưa thu thập</span>` : ''}</td></tr>
        <tr><td><b>Đã chi trả</b></td><td class="so">${o('chiTraHa', th.chiTraHa)} ha (${fmtSo(th.chiTraHa / th.tongHa * 100, 1)}%)${th.soHoChiTra ? ` · ${fmtSo(th.soHoChiTra)} hộ` : ''}</td></tr>
        <tr><td>Đã bàn giao thực địa</td><td class="so">${o('banGiaoHa', th.banGiaoHa)} ha</td></tr>
      </tbody></table>
      <p class="muted nho">Nguồn: ${esc(th.nguon || '')}. Sửa số liệu rồi bấm "Ghi nhận" để lưu vào lịch sử và biểu đồ.</p>
      <button class="nut" data-act="ghi-nhan-gpmb">Ghi nhận số liệu ngày ${fmtNgay(th.ngay)}</button></div>
    <div class="the"><h3>Chi trả lũy kế: kế hoạch và thực tế</h3>${bieuDoChiTra()}
      <p class="nho">${tk.mucTieu ? `Mục tiêu nội suy đến ${fmtNgay(t)}: <b>${fmtHa(tk.mucTieu.ha)} ha</b>. ` : ''}${tk.mocKH ? `Mốc kế hoạch đã qua: <b>${fmtSo(tk.mocKH.ha, 0)} ha</b> (${fmtNgay(tk.mocKH.ngay)}) — ${th.chiTraHa >= tk.mocKH.ha ? '<span style="color:var(--xong)">đạt</span>' : `<span style="color:var(--cham)">thiếu ${fmtHa(tk.mocKH.ha - th.chiTraHa)} ha</span>`}.` : ''}</p></div>
  </div>
  <div class="the" style="margin-top:12px"><div class="cong-cu" style="margin-bottom:6px"><h3 style="margin:0">Quyết định phê duyệt phương án và kinh phí</h3><span class="gian"></span><button class="nut chinh" data-act="them-dot">+ Thêm QĐ phê duyệt</button></div>
    <div class="bang-wrap" style="border:0"><table><thead><tr><th>Đợt / khu vực</th><th>QĐ phê duyệt</th><th class="so">Số hộ</th><th class="so">Diện tích (m²)</th><th class="so">Kinh phí hiện hành (đ)</th><th>Bước quy trình GPMB</th><th>CV đề nghị</th><th>Hạn chi trả</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${g.dot.map(x => { const han = hanChiTra(x), qua = dotQuaHanChuyen(x), xn = dotCanXacNhanChiTra(x); return `<tr class="click" data-act="mo-dot" data-id="${x.id}">
      <td>${esc(x.ten)}</td><td>${esc(x.qdSo)}<br><span class="muted nho">${fmtNgay(x.qdNgay)}${x.dieuChinh.length ? ` · đ/c ${x.dieuChinh.map(d => esc(d.qdSo)).join(', ')}` : ''}</span></td>
      <td class="so">${fmtSo(x.soHo)}</td><td class="so">${fmtSo(x.dienTich, 1)}</td><td class="so"><b>${fmtSo(tongDot(x))}</b>${x.dieuChinh.length ? `<br><span class="muted nho">ban đầu ${fmtSo(x.tong)}</span>` : ''}</td>
      <td class="nho">${x.buocQT ? `<b>${esc(x.buocQT)}</b><br><span class="muted">${esc(mauQT('gpmb').find(b => b.buoc === x.buocQT)?.ten || '')}</span>` : '<span class="muted">—</span>'}</td>
      <td class="nho">${esc(x.cvDeNghi?.so || '—')}</td><td>${fmtNgay(han)}${x.chiTraTu ? `<br><span class="chip ${dotChiTraSap(x) ? 'st-canh' : 'st-lam'}" title="Lịch chi trả dự kiến">chi trả ${esc(ngayChiTraDK(x))}</span>` : ''}${qua ? '<br><span class="chip st-cham">quá hạn, chưa chuyển</span>' : xn ? '<br><span class="chip st-canh">cần xác nhận chi trả</span>' : ''}</td>
      <td><span class="chip ${dotXongChiTra(x) ? 'st-xong' : qua ? 'st-cham' : xn ? 'st-canh' : 'st-lam'}">${esc(x.trangThai)}</span></td>
      <td><button class="nut nho" data-act="phieu-dot" data-id="${x.id}" title="Tạo phiếu để Claude soạn tờ trình">Soạn tờ trình</button></td></tr>`; }).join('')}
    <tr><td colspan="3"><b>Cộng</b></td><td class="so"><b>${fmtSo(g.dot.reduce((s, x) => s + (+x.dienTich || 0), 0), 1)}</b></td><td class="so"><b>${fmtSo(tk.tongKinhPhi)}</b></td><td colspan="5" class="muted nho">= ${fmtHa(tk.tongDtDot)} ha · ${fmtSo(g.dot.reduce((s, x) => s + (+x.soHo || 0), 0))} hộ, ${fmtSo(th.pheDuyetPA)} PA (dùng làm số "Phê duyệt phương án")</td></tr>
    </tbody></table></div>
    <p class="muted nho">Hạn chi trả tính 30 ngày kể từ ngày hiệu lực QĐ phê duyệt phương án (như cách tính tại tờ trình 29/10/2026). Kiểm lại theo nội dung từng quyết định.</p></div>
  <div class="the" style="margin-top:12px"><h3>Di dời mồ mả <span class="muted nho">số liệu ngày <input class="o" type="date" data-sua="moMa" data-f="ngay" value="${mm.ngay || ''}"></span></h3>
    <div class="cong-cu">Phát hiện ${om('phatHien', mm.phatHien)} Kiểm kê ${om('kiemKe', mm.kiemKe)} Công khai PA ${om('congKhai', mm.congKhai)} Phê duyệt ${om('pheDuyet', mm.pheDuyet)} Đã di dời ${om('diDoi', mm.diDoi)} Dự kiến tổng ${om('duKien', mm.duKien)} ngôi</div>
    <p class="nho">Hạn di dời toàn bộ: <b>${fmtNgay(mm.hanDiDoi) || 'chưa đặt'}</b>${hopLeNgay(mm.hanDiDoi) ? ` (trước Tết Đinh Mùi) — còn ${khoang(t, mm.hanDiDoi)} ngày` : ''}; đã di dời ${mm.diDoi || 0}/${mm.duKien || '?'} ngôi.</p>
    ${veKinhPhiMo()}</div>
  ${tk.chiTraSap.length ? veDotChiTra(tk.chiTraSap) : ''}
  ${veThueDat()}
  ${veQuyTrinhMau()}`;
}
// Kinh phí bồi thường, hỗ trợ di chuyển mộ theo từng QĐ phê duyệt phương án (cùng logic hạn 30 ngày như QĐ đất).
function veKinhPhiMo() {
  const ds = D.gpmb.moMa.qd, mm = D.gpmb.moMa;
  const cong = k => ds.reduce((s, x) => s + (+x[k] || 0), 0), congKm = k => ds.reduce((s, x) => s + (+x.khoanMuc?.[k] || 0), 0);
  const tongMo = ds.reduce((s, x) => s + (tongDot(x) || 0), 0), soMo = cong('soMo');
  return `<div class="cong-cu" style="margin:12px 0 6px"><h3 style="margin:0">Kinh phí bồi thường, hỗ trợ di chuyển mộ theo QĐ</h3><span class="gian"></span><button class="nut chinh" data-act="them-mo-qd">+ Thêm QĐ mộ</button></div>
    <div class="bang-wrap" style="border:0"><table><thead><tr><th>Đợt</th><th>QĐ phê duyệt</th><th class="so">Số ngôi</th><th class="so">Số PA</th><th class="so">Bồi thường về mộ (đ)</th><th class="so">Thưởng tiến độ (đ)</th><th class="so">Tổng kinh phí (đ)</th><th>Hạn chi trả</th><th>Trạng thái</th></tr></thead><tbody>
    ${ds.map(x => { const qua = dotQuaHanChuyen(x), xn = dotCanXacNhanChiTra(x); return `<tr class="click" data-act="mo-dot" data-id="${x.id}">
      <td>${esc(x.ten)}</td><td>${esc(x.qdSo)}<br><span class="muted nho">${fmtNgay(x.qdNgay)}</span></td>
      <td class="so">${fmtSo(x.soMo)}</td><td class="so">${fmtSo(x.soHo)}</td><td class="so">${fmtSo(x.khoanMuc?.boiThuong)}</td><td class="so">${fmtSo(x.khoanMuc?.thuong)}</td>
      <td class="so"><b>${fmtSo(tongDot(x))}</b>${x.dieuChinh.length ? `<br><span class="muted nho">ban đầu ${fmtSo(x.tong)}</span>` : ''}</td>
      <td>${fmtNgay(hanChiTra(x))}${x.chiTraTu ? `<br><span class="chip ${dotChiTraSap(x) ? 'st-canh' : 'st-lam'}">chi trả ${esc(ngayChiTraDK(x))}</span>` : ''}${qua ? '<br><span class="chip st-cham">quá hạn, chưa chuyển</span>' : xn ? '<br><span class="chip st-canh">cần xác nhận chi trả</span>' : ''}</td>
      <td><span class="chip ${dotXongChiTra(x) ? 'st-xong' : qua ? 'st-cham' : xn ? 'st-canh' : 'st-lam'}">${esc(x.trangThai)}</span>${x.ngayChuyenTien ? `<br><span class="muted nho">chuyển ${fmtNgay(x.ngayChuyenTien)}</span>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="9" class="rong-tam">Chưa có QĐ phê duyệt phương án di chuyển mộ.</td></tr>'}
    ${ds.length ? `<tr><td colspan="2"><b>Cộng</b></td><td class="so"><b>${fmtSo(soMo)}</b></td><td class="so"><b>${fmtSo(cong('soHo'))}</b></td><td class="so"><b>${fmtSo(congKm('boiThuong'))}</b></td><td class="so"><b>${fmtSo(congKm('thuong'))}</b></td><td class="so"><b>${fmtSo(tongMo)}</b></td>
      <td colspan="2" class="nho">${soMo !== (+mm.pheDuyet || 0) ? `<span style="color:var(--canh)">Số ngôi theo QĐ (${soMo}) khác ô "Phê duyệt" (${mm.pheDuyet ?? '—'})</span>` : '<span class="muted">khớp số ngôi đã phê duyệt</span>'}</td></tr>` : ''}
    </tbody></table></div>
    <p class="muted nho">Tổng kinh phí BTHT (đất, tài sản + di chuyển mộ): <b>${fmtSo(thongKe().tongKinhPhi + tongMo)} đ</b>. Hạn chi trả 30 ngày kể từ ngày phê duyệt phương án (Điều 1, Điều 2 các QĐ). Bảng chi tiết từng mộ xem trong file QĐ.</p>`;
}
// Đợt chi trả sắp tới: gom các QĐ (đất + mộ) có lịch chi trả gần, chưa chuyển tiền → tổng tiền cần chuyển.
function veDotChiTra(ds) {
  const tong = ds.reduce((s, x) => s + (tongDot(x) || 0), 0), dau = ds[0];
  return `<div class="the canh-hop" style="margin-top:12px"><h3 style="margin:0 0 6px">Đợt chi trả ${esc(ngayChiTraDK(dau))} – cần chuyển ${fmtSo(tong)} đ trước ${fmtNgay(dau.chiTraTu)} (còn ${khoang(homNay(), dau.chiTraTu)} ngày)</h3>
    <table><tbody>${ds.map(x => `<tr class="click" data-act="mo-dot" data-id="${x.id}"><td>${esc(tenQD(x))} ngày ${fmtNgay(x.qdNgay)}</td><td>${esc(x.ten)}</td><td class="so"><b>${fmtSo(tongDot(x))}</b></td><td>${esc(x.trangThai)}</td><td class="nho">${x.cvdId && vb(x.cvdId) ? esc(vb(x.cvdId).so) : ''}</td></tr>`).join('')}
    <tr><td colspan="2"><b>Cộng cần chuyển</b></td><td class="so"><b>${fmtSo(tong)}</b></td><td colspan="2"></td></tr></tbody></table>
    <p class="nho" style="margin:6px 0 0">Việc cần làm: tổng hợp, trình Chủ tịch duyệt (tờ trình chuyển kinh phí) → chuyển tiền vào tài khoản Ban QLDA xã → cập nhật "Ngày chuyển tiền", "Số tiền đã chuyển" trong từng QĐ. <button class="nut nho" data-act="phieu-dot" data-id="${ds[0].id}">Soạn tờ trình (Claude)</button></p></div>`;
}
function veThueDat() {
  const ds = D.thueDat.dot;
  return `<div class="the" style="margin-top:12px"><div class="cong-cu" style="margin-bottom:6px"><h3 style="margin:0">Cho thuê đất và miễn, giảm tiền thuê đất theo đợt</h3><span class="gian"></span><button class="nut chinh" data-act="them-td">+ Thêm đợt thuê đất</button></div>
    ${D.thueDat.ghiChu ? `<p class="nho canh-hop">${esc(D.thueDat.ghiChu)}</p>` : ''}
    <div class="bang-wrap" style="border:0"><table><thead><tr><th>Đợt</th><th class="so">Diện tích (m²)</th><th>Thủ tục cho thuê đất</th><th>QĐ cho thuê đất</th><th>Miễn, giảm tiền thuê đất</th><th>Hết miễn XDCB / theo ngành</th><th>Việc</th></tr></thead><tbody>
    ${ds.map(x => {
      const b = buocTDHienTai(x), s = tomTatMG(x), mm = mocMien(x), v = viec(x.viecId);
      const lop = s.qua.length ? 'st-cham' : s.canXN.length ? 'st-canh' : s.xong === s.tong ? 'st-xong' : 'st-chua';
      return `<tr class="click" data-act="mo-td" data-id="${x.id}">
        <td><b>${esc(x.ten)}</b>${x.moc ? ` <b style="color:var(--cham)">${esc(x.moc)}</b>` : ''}</td>
        <td class="so">${fmtSo(x.dienTichM2, 1)}</td>
        <td class="nho">${b.xong}/${b.ds.length} bước${b.hien ? `<br><span class="muted">đang: ${esc(b.hien.buoc)} – ${esc(b.hien.ten)}</span>` : '<br><span style="color:var(--xong)">hoàn thành</span>'}</td>
        <td class="nho">${x.qdSo ? `${esc(x.qdSo)}<br><span class="muted">${fmtNgay(x.qdNgay)}</span>` : '<span class="muted">chưa có</span>'}</td>
        <td><span class="chip ${lop}">${s.xong}/${s.tong} mục</span>${s.qua.length ? `<br><span class="nho" style="color:var(--cham)">${s.qua.length} quá hạn/chưa cập nhật</span>` : ''}${s.canXN.length ? `<br><span class="nho" style="color:var(--canh)">${s.canXN.length} cần xác nhận</span>` : ''}</td>
        <td class="nho">${mm ? `${fmtNgay(mm.xd)}${mm.ud ? ` / ${fmtNgay(mm.ud)}` : ''}<br><span class="muted">kê khai trước ${fmtNgay(mm.keKhai)}</span>` : '<span class="muted">tính từ ngày QĐ</span>'}</td>
        <td class="nho">${v ? `${v.tt}. ${esc(v.ten.slice(0, 40))}` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="rong-tam">Chưa có đợt thuê đất.</td></tr>'}
    </tbody></table></div>
    <p class="muted nho">Hạn các mục miễn, giảm là mục tiêu nội bộ tính từ ngày QĐ cho thuê đất (các mục kê trong hồ sơ tính theo ngày nộp hồ sơ – Bước 1), để không bị chậm. Miễn XDCB tối đa ${D.thueDat.namMienXDCB ?? 3} năm từ ngày QĐ cho thuê đất (NĐ 103/2024 Điều 39); miễn theo ngành ${D.thueDat.namMienUuDai ?? '?'} năm tiếp theo (cần xác minh nguyên văn NĐ 96/2026, NĐ 103/2024).</p></div>`;
}
function veQuyTrinhMau() {
  const gp = mauQT('gpmb'), ud = D.kiemSoatUuDai || [];
  if (!gp.length && !ud.length) return '';
  return `<div class="the" style="margin-top:12px"><h3>Quy trình mẫu – tỉnh Hưng Yên (QĐ 31/2026/QĐ-UBND)</h3>
    <details><summary><b>Thu hồi đất, bồi thường, hỗ trợ, TĐC</b> – ${gp.length} bước (đường găng thực tế khoảng 7–9 tháng)</summary>
      <div class="bang-wrap" style="border:0"><table><thead><tr><th>Bước</th><th>Tên bước</th><th>Đơn vị thực hiện</th><th>Thời hạn (Hưng Yên)</th><th class="so">Dự kiến (ngày)</th><th>Quyền DN / rủi ro</th></tr></thead><tbody>
      ${gp.map(b => `<tr><td>${esc(b.buoc)}</td><td><b>${esc(b.ten)}</b><br><span class="muted nho" style="white-space:pre-line">${esc(b.noiDung)}</span></td><td class="nho">${esc(b.chuTri)}</td><td class="nho">${esc(b.han)}</td><td class="so">${esc(b.ngayKH)}</td><td class="nho" style="white-space:pre-line">${esc(b.quyen || '')}</td></tr>`).join('')}
      </tbody></table></div></details>
    <details style="margin-top:8px"><summary><b>Kiểm soát quyền ưu đãi tiền thuê đất</b> – ${ud.length} mục (tránh mất quyền, tránh truy thu)</summary>
      <div class="bang-wrap" style="border:0"><table><thead><tr><th>TT</th><th>Quyền / ưu đãi</th><th>Việc phải làm</th><th>Thời điểm – hạn chót</th><th>Hậu quả nếu bỏ lỡ</th><th>Bộ phận</th></tr></thead><tbody>
      ${ud.map(u => `<tr><td>${u.stt}</td><td><b>${esc(u.quyen)}</b>${u.kiemChung ? `<br><span class="chip st-canh">${esc(u.kiemChung)}</span>` : ''}</td><td class="nho" style="white-space:pre-line">${esc(u.viecPhaiLam)}</td><td class="nho">${esc(u.thoiDiem)}</td><td class="nho">${esc(u.hauQua)}</td><td class="nho">${esc(u.boPhan)}</td></tr>`).join('')}
      </tbody></table></div></details></div>`;
}
function bieuDoChiTra() {
  const g = D.gpmb, kh = [...g.lichSu.slice(0, 1).map(x => ({ ngay: x.ngay, ha: x.chiTraHa })), ...g.keHoachChiTra], tt = g.lichSu.map(x => ({ ngay: x.ngay, ha: x.chiTraHa }));
  const tat = [...kh, ...tt].filter(p => hopLeNgay(p.ngay)); if (!tat.length) return '';
  const bd = tat.reduce((a, p) => p.ngay < a ? p.ngay : a, tat[0].ngay), kt = tat.reduce((a, p) => p.ngay > a ? p.ngay : a, tat[0].ngay);
  const Wv = 560, Hv = 200, L = 40, R = 10, T = 10, B = 26, tong = g.tongHop.tongHa || 210;
  const X = s => L + khoang(bd, s) / Math.max(1, khoang(bd, kt)) * (Wv - L - R), Y = h => T + (1 - h / tong) * (Hv - T - B);
  const duong = ds => ds.map((p, i) => `${i ? 'L' : 'M'}${X(p.ngay).toFixed(1)},${Y(p.ha).toFixed(1)}`).join(' ');
  const t = homNay();
  const luoiY = [0, 50, 100, 150, 200].filter(h => h <= tong).map(h => `<line x1="${L}" x2="${Wv - R}" y1="${Y(h)}" y2="${Y(h)}" stroke="var(--vien2)"/><text x="${L - 6}" y="${Y(h) + 4}" text-anchor="end">${h}</text>`).join('');
  return `<svg viewBox="0 0 ${Wv} ${Hv}" style="width:100%;height:auto" role="img" aria-label="Biểu đồ chi trả lũy kế">
    ${luoiY}
    <path d="${duong(kh)}" fill="none" stroke="var(--chua)" stroke-width="2" stroke-dasharray="5 4"/>
    ${kh.map(p => `<circle cx="${X(p.ngay)}" cy="${Y(p.ha)}" r="3" fill="var(--chua)"/><text x="${X(p.ngay)}" y="${Y(p.ha) - 7}" text-anchor="middle">${fmtSo(p.ha, p.ha % 1 ? 2 : 0)}</text>`).join('')}
    <path d="${duong(tt)}" fill="none" stroke="var(--chinh2)" stroke-width="2.5"/>
    ${tt.map(p => `<circle cx="${X(p.ngay)}" cy="${Y(p.ha)}" r="4" fill="var(--chinh2)"/>`).join('')}
    ${t >= bd && t <= kt ? `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${Hv - B}" stroke="var(--cham)" stroke-dasharray="3 3"/>` : ''}
    <text x="${L}" y="${Hv - 8}">${fmtNgay(bd)}</text><text x="${Wv - R}" y="${Hv - 8}" text-anchor="end">${fmtNgay(kt)}</text>
  </svg><div class="nho muted">— — kế hoạch (ha) &nbsp; <span style="color:var(--chinh2)">——</span> thực tế đã ghi nhận &nbsp; <span style="color:var(--cham)">┆</span> hôm nay</div>`;
}

/* ============================== VĂN BẢN ============================== */
function veVanBan() {
  const tabs = `<div class="cong-cu"><div class="nhom-nut">${[['so', `Sổ đăng ký (${D.vanBan.length})`], ['moi', `Hồ sơ mới (${typeof hoSoMoi === 'function' ? hoSoMoi().length + (UI.goiCho?.length || 0) : 0})`], ['kho', `Kho hồ sơ${CHI_MUC ? ` (${CHI_MUC.files.length.toLocaleString('vi-VN')})` : ''}`], ['phieu', `Phiếu soạn (${D.phieu.length})`]].map(([k, n]) => `<button data-act="vb-tab" data-v="${k}" class="${UI.vbTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><span class="gian"></span>`;
  if (UI.vbTab === 'kho') return tabs + '</div>' + veKho();
  if (UI.vbTab === 'moi' && typeof veHoSoMoi === 'function') return tabs + '</div>' + veHoSoMoi();
  if (UI.vbTab === 'phieu') return tabs + `<button class="nut" data-act="cap-nhat-phieu">Cập nhật kết quả từ thư mục</button><button class="nut chinh" data-act="phieu-tu-do">+ Phiếu soạn văn bản</button></div>` + vePhieu();
  const ds = D.vanBan.filter(v => (!UI.vbLoai || v.loai === UI.vbLoai) && (!UI.vbChieu || v.chieu === UI.vbChieu) && (!UI.vbTT || v.trangThai === UI.vbTT) && khop([v.so, v.trichYeu, v.coQuan, v.duongDan].join(' '), UI.vbTim))
    .sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
  const nhomVer = {}; D.vanBan.forEach(v => { if (v.khoa) (nhomVer[v.khoa] ||= []).push(v); });
  return tabs + `<button class="nut chinh" data-act="them-vb">+ Thêm văn bản</button></div>
  <div class="cong-cu">
    <select class="o" data-loc="vbLoai"><option value="">Mọi loại</option>${LOAI_VB.map(s => `<option ${UI.vbLoai === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select class="o" data-loc="vbChieu"><option value="">Đến/Đi/Nội bộ</option>${CHIEU_VB.map(s => `<option ${UI.vbChieu === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select class="o" data-loc="vbTT"><option value="">Mọi trạng thái</option>${TT_VB.map(s => `<option ${UI.vbTT === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <input class="o" type="search" placeholder="Tìm số hiệu, trích yếu, cơ quan…" value="${esc(UI.vbTim)}" data-loc="vbTim" style="min-width:260px">
    <span class="muted nho">${ds.length} văn bản</span></div>
  <div class="bang-wrap" data-cuon="bang-vb" style="max-height:calc(100vh - 230px)"><table><thead><tr><th>Ngày</th><th>Số/ký hiệu</th><th>Loại</th><th>Chiều</th><th>Trích yếu</th><th>Trạng thái</th><th>Liên kết</th><th>File</th></tr></thead><tbody>
  ${ds.slice(0, UI.vbSoDong).map(v => { const ver = v.khoa && nhomVer[v.khoa]?.length > 1 ? nhomVer[v.khoa].length : 0; return `<tr class="click" data-act="mo-vb" data-id="${v.id}">
    <td class="nho" style="white-space:nowrap">${fmtNgay(v.ngay)}</td><td class="nho">${esc(v.so)}</td><td class="nho">${esc(v.loai)}</td><td class="nho">${esc(v.chieu)}</td>
    <td>${esc(v.trichYeu)}${v.ver ? ` <span class="chip">ver${v.ver}</span>` : ''}${ver ? ` <span class="chip st-lam" title="Có ${ver} phiên bản cùng nội dung">${ver} bản</span>` : ''}${v.coQuan ? `<br><span class="muted nho">${esc(v.coQuan)}</span>` : ''}</td>
    <td><span class="chip ${v.trangThai === 'Dự thảo' ? 'st-canh' : v.trangThai === 'Đã trình' ? 'st-lam' : 'st-xong'}">${esc(v.trangThai)}</span></td>
    <td class="nho">${v.lienKet.map(l => l.kieu === 'dot' ? esc(dot(l.id)?.qdSo || '') : l.kieu === 'viec' ? 'Việc ' + (viec(l.id)?.tt ?? '') : '').join(', ')}</td>
    <td>${v.duongDan ? `<button class="nut nho" data-act="mo-file" data-p="${esc(v.duongDan)}">Mở</button>` : '<span class="chip st-canh" title="' + esc(v.ghiChu) + '">thiếu file</span>'}</td></tr>`; }).join('')}
  </tbody></table>${ds.length > UI.vbSoDong ? `<p style="text-align:center"><button class="nut" data-act="vb-them-dong">Hiện thêm (${ds.length - UI.vbSoDong} còn lại)</button></p>` : ''}</div>`;
}
function veKho() {
  if (!CHI_MUC) return `<div class="the rong-tam"><p>Chưa có chỉ mục hồ sơ. Kết nối thư mục dự án rồi bấm "Quét thư mục" để app liệt kê toàn bộ file (không di chuyển, không sửa file).</p>
    <button class="nut chinh" data-act="quet" ${FS.ketNoi ? '' : 'disabled'}>Quét thư mục</button> <button class="nut" data-act="nhap-chi-muc">Nạp file chỉ mục (.json)</button>
    ${FS.ketNoi ? '' : '<p class="nho">Chưa kết nối thư mục — vào <a href="#" data-act="den" data-view="cai-dat">Cài đặt</a>.</p>'}</div>`;
  const daSo = new Set(D.vanBan.map(v => nfc(v.duongDan)));
  const thuMuc = [...new Set(CHI_MUC.files.map(f => f.p.split('\\').slice(0, 2).join('\\')).filter(p => p.includes('\\')))].sort((a, b) => a.localeCompare(b, 'vi'));
  const ds = CHI_MUC.files.filter(f => (!UI.khoTM || f.p.startsWith(UI.khoTM + '\\')) && (!UI.khoChuaSo || !daSo.has(nfc(f.p))) && khop(f.p, UI.khoTim));
  return `<div class="cong-cu">
    <select class="o" data-loc="khoTM" style="max-width:360px"><option value="">Toàn bộ thư mục</option>${thuMuc.map(t => `<option ${UI.khoTM === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    <input class="o" type="search" placeholder="Tìm tên file, thư mục…" value="${esc(UI.khoTim)}" data-loc="khoTim" style="min-width:260px">
    <label class="nho"><input type="checkbox" data-loc="khoChuaSo" ${UI.khoChuaSo ? 'checked' : ''}> Chỉ file chưa vào sổ</label>
    <span class="gian"></span><span class="muted nho">${ds.length.toLocaleString('vi-VN')} file · quét ${new Date(CHI_MUC.ngayQuet).toLocaleString('vi-VN')}</span>
    <button class="nut" data-act="quet" ${FS.ketNoi ? '' : 'disabled'}>Quét lại</button></div>
  <div class="bang-wrap" data-cuon="bang-kho" style="max-height:calc(100vh - 230px)"><table><thead><tr><th>File</th><th>Sửa</th><th class="so">KB</th><th></th></tr></thead><tbody>
  ${ds.slice(0, UI.khoSoDong).map(f => { const pp = f.p.split('\\'); return `<tr><td><b>${esc(pp.pop())}</b><br><span class="muted nho">${esc(pp.join(' › '))}</span></td><td class="nho">${fmtNgay(f.sua)}</td><td class="so nho">${fmtSo(f.kb)}</td>
    <td style="white-space:nowrap"><button class="nut nho" data-act="mo-file" data-p="${esc(f.p)}">Mở</button> ${daSo.has(nfc(f.p)) ? '<span class="chip st-xong">trong sổ</span>' : `<button class="nut nho" data-act="vao-so" data-p="${esc(f.p)}">Vào sổ</button>`}</td></tr>`; }).join('')}
  </tbody></table>${ds.length > UI.khoSoDong ? `<p style="text-align:center"><button class="nut" data-act="kho-them-dong">Hiện thêm (${(ds.length - UI.khoSoDong).toLocaleString('vi-VN')} còn lại)</button></p>` : ''}</div>`;
}
function vePhieu() {
  if (!D.phieu.length) return `<div class="the rong-tam"><p>Chưa có phiếu nào. Tạo phiếu từ tab GPMB ("Soạn tờ trình"), từ một việc, từ Báo cáo, hoặc nút "+ Phiếu soạn văn bản".</p></div>`;
  return `<div class="bang-wrap"><table><thead><tr><th>Ngày tạo</th><th>Nội dung</th><th>Mẫu</th><th>Trạng thái</th><th>Kết quả</th><th></th></tr></thead><tbody>
  ${[...D.phieu].reverse().map(p => { const [n, l] = TT_PHIEU[p.trangThai] || [p.trangThai, '']; const kq = p.ketQua; return `<tr>
    <td class="nho">${new Date(p.ngayTao).toLocaleString('vi-VN')}</td><td>${esc(p.tieuDe)}<br><span class="muted nho">${esc(p.file)}</span></td><td class="nho">${esc(MAU[p.mau]?.ten || p.mau)}</td>
    <td><span class="chip ${l}">${n}</span></td>
    <td class="nho">${kq ? `${kq.banSach ? `<button class="nut nho" data-act="mo-file" data-p="${esc(kq.banSach)}">Bản sạch</button> ` : ''}${kq.banNhap ? `<button class="nut nho" data-act="mo-file" data-p="${esc(kq.banNhap)}">Bản nháp</button>` : ''}${kq.diemConMo?.length ? `<br><span class="canh-pt">${kq.diemConMo.length} điểm còn mở</span>` : ''}${kq.zalo ? `<br><button class="nut nho" data-act="chep" data-data="${esc(kq.zalo)}">Chép tin Zalo</button>` : ''}` : '—'}</td>
    <td><button class="nut nho" data-act="chep-lenh-phieu" data-id="${p.id}">Chép lệnh</button></td></tr>`; }).join('')}
  </tbody></table></div><p class="muted nho">Lệnh dán vào Claude Code: <code>/to-trinh-vgip "&lt;đường dẫn phiếu&gt;"</code>. Claude ghi kết quả vào chính file phiếu; bấm "Cập nhật kết quả từ thư mục" để đưa văn bản vừa soạn vào sổ.</p>`;
}

/* ============================== GIAO VIỆC ============================== */
function veGiaoViec() {
  const mo = D.viec.filter(v => trangThai(v) !== 'Đã xong');
  const theoNguoi = D.nguoi.map(p => ({ p, ds: mo.filter(v => v.giaoCho === p.id) }));
  const donVi = [...new Set(mo.filter(v => !v.giaoCho).map(v => v.chuTri))].sort((a, b) => a.localeCompare(b, 'vi')).map(d => ({ d, ds: mo.filter(v => !v.giaoCho && v.chuTri === d) }));
  const chon = UI.nguoiChon || (D.caiDat.toiLa ? 'p:' + D.caiDat.toiLa : '');
  let dsChon = [], tieuDe = 'Chọn người hoặc đơn vị bên trái';
  if (chon.startsWith('p:')) { const p = nguoi(chon.slice(2)); dsChon = mo.filter(v => v.giaoCho === chon.slice(2)); tieuDe = p ? `${p.ten} – ${p.chucDanh}, ${p.donVi}` : ''; }
  else if (chon.startsWith('d:')) { dsChon = mo.filter(v => !v.giaoCho && v.chuTri === chon.slice(2)); tieuDe = `${chon.slice(2)} (chủ trì, chưa giao người cụ thể)`; }
  dsChon.sort((a, b) => a.ketThuc.localeCompare(b.ketThuc));
  const opNguoi = id => `<option value="">— chưa giao —</option>${D.nguoi.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.ten)} (${esc(p.donVi)})</option>`).join('')}`;
  return `<h2>Giao việc</h2><div class="luoi" style="grid-template-columns:minmax(260px,340px) 1fr">
  <div class="the" style="max-height:calc(100vh - 160px);overflow:auto">
    <h3>Người được giao</h3><ul class="ds">${theoNguoi.filter(x => x.ds.length || x.p.id === D.caiDat.toiLa).map(x => `<li class="click" data-act="chon-nguoi" data-v="p:${x.p.id}" style="cursor:pointer;${chon === 'p:' + x.p.id ? 'font-weight:600' : ''}"><span class="fill">${esc(x.p.ten)}${x.p.id === D.caiDat.toiLa ? ' (tôi)' : ''}<br><span class="muted nho">${esc(x.p.donVi)}</span></span><span class="chip">${x.ds.length}</span></li>`).join('') || '<li class="muted nho">Chưa giao việc cho ai.</li>'}</ul>
    <h3 style="margin-top:14px">Đơn vị chủ trì (chưa giao người)</h3><ul class="ds">${donVi.map(x => `<li class="click" data-act="chon-nguoi" data-v="d:${esc(x.d)}" style="cursor:pointer;${chon === 'd:' + x.d ? 'font-weight:600' : ''}"><span class="fill">${esc(x.d)}</span><span class="chip">${x.ds.length}</span></li>`).join('')}</ul></div>
  <div><div class="the"><h3>${esc(tieuDe)}</h3>
    ${dsChon.length ? `<table><thead><tr><th>TT</th><th>Việc</th><th>Hạn</th><th>Tình trạng</th><th>Giao cho</th></tr></thead><tbody>${dsChon.map(v => { const k = khoang(homNay(), v.ketThuc), st = trangThai(v); return `<tr><td class="muted">${v.tt}</td><td><a href="#" data-act="mo-viec" data-id="${v.id}">${esc(v.ten)}</a></td><td class="nho" style="white-space:nowrap">${fmtNgay(v.ketThuc)}<br><span class="${k < 0 ? 'canh-pt' : 'muted'}">${k < 0 ? `quá ${-k} ngày` : `còn ${k} ngày`}</span></td><td><span class="chip ${LOP_TT[st]}">${st}</span> ${pctThucTe(v)}%</td><td><select class="o" data-sua="viec" data-id="${v.id}" data-f="giaoCho">${opNguoi(v.giaoCho)}</select></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Không có việc đang mở.</p>'}</div>
    <div class="the" style="margin-top:12px"><div class="cong-cu" style="margin-bottom:6px"><h3 style="margin:0">Danh bạ (${D.nguoi.length})</h3><span class="gian"></span><button class="nut" data-act="them-nguoi">+ Thêm người</button></div>
      <div class="bang-wrap" style="max-height:340px;border:0"><table><thead><tr><th>Họ tên</th><th>Chức danh</th><th>Đơn vị</th><th>Điện thoại</th><th></th></tr></thead><tbody>
      ${D.nguoi.map(p => `<tr>${['ten', 'chucDanh', 'donVi', 'dienThoai'].map(f => `<td><input data-sua="nguoi" data-id="${p.id}" data-f="${f}" value="${esc(p[f])}"></td>`).join('')}<td><button class="nut nho xoa" data-act="xoa-nguoi" data-id="${p.id}" title="Xoá">✕</button></td></tr>`).join('')}
      </tbody></table></div></div></div></div>`;
}

/* ============================== BÁO CÁO ============================== */
function veBaoCao() {
  return `<h2>Báo cáo</h2>${veKiemTra()}<div class="luoi hai" style="margin-top:12px">
  <div class="the"><h3>Tin nhắn Zalo gửi lãnh đạo</h3><p class="muted nho">Văn bản thuần, kết luận trước. Có thể sửa trước khi chép.</p>
    <textarea class="o zalo" id="zalo">${esc(taoZalo())}</textarea>
    <div class="cong-cu" style="margin-top:8px"><button class="nut chinh" data-act="chep-zalo">Chép tin nhắn</button><button class="nut" data-act="den" data-view="bao-cao">Tạo lại</button></div></div>
  <div class="the"><h3>Xuất file</h3><ul class="ds">
    <li><span class="fill"><b>Bảng tiến độ Excel</b><br><span class="muted nho">Các sheet: Tiến độ, Mốc chính, GPMB, Kinh phí mộ, Thuê đất - miễn giảm, Văn bản, Kiểm tra số liệu. Lưu vào ${esc(D.caiDat.thuMucApp)}\\bao-cao (hoặc tải về).</span></span><button class="nut" data-act="xuat-excel">Xuất Excel</button></li>
    <li><span class="fill"><b>Báo cáo tiến độ Word (Claude soạn)</b><br><span class="muted nho">Tạo phiếu kèm toàn bộ số liệu hiện tại; Claude soạn theo mẫu BC 27/10/2026 ver4, thể thức NĐ 30.</span></span><button class="nut" data-act="phieu-bao-cao">Tạo phiếu</button></li>
    <li><span class="fill"><b>Bản xem trên điện thoại (HTML)</b><br><span class="muted nho">Một file chỉ đọc; lưu vào OneDrive rồi chia sẻ link cho lãnh đạo.</span></span><button class="nut" data-act="xuat-html">Xuất HTML</button></li>
    <li><span class="fill"><b>Sao lưu toàn bộ dữ liệu (JSON)</b><br><span class="muted nho">Dùng khi chuyển máy hoặc trình duyệt không nối được thư mục.</span></span><button class="nut" data-act="sao-luu">Sao lưu</button></li>
    <li><span class="fill"><b>Khôi phục từ file JSON</b></span><button class="nut" data-act="khoi-phuc">Khôi phục</button></li>
  </ul></div></div>`;
}

/* ============================== CÀI ĐẶT ============================== */
function veCaiDat() {
  const ho = !!window.showDirectoryPicker;
  return `<h2>Cài đặt</h2><div class="luoi hai">
  <div class="the"><h3>Thư mục dự án (OneDrive / Google Drive trên máy)</h3>
    <p>${FS.ketNoi ? `<span class="chip st-xong">Đã kết nối</span> <b>${esc(FS.goc.name)}</b><br><span class="muted nho">Dữ liệu lưu tại ${esc(D.caiDat.thuMucApp)}\\du-lieu.json${FS.lanGhi ? ', lần ghi cuối ' + FS.lanGhi.toLocaleString('vi-VN') : ''}.</span>` : FS.canKetNoiLai ? '<span class="chip st-canh">Cần cấp lại quyền</span> Trình duyệt yêu cầu xác nhận lại sau mỗi lần mở.' : '<span class="chip st-canh">Chưa kết nối</span> Dữ liệu chỉ nằm trong trình duyệt này.'}</p>
    ${FS.xungDot ? `<div class="canh-hop">File du-lieu.json đã bị thay đổi ở nơi khác (máy khác qua OneDrive?). Chọn bản giữ lại:<div class="cong-cu" style="margin:8px 0 0"><button class="nut" data-act="tai-lai">Dùng bản trong thư mục</button><button class="nut xoa" data-act="giu-ban-may">Ghi đè bằng bản trên máy này</button></div></div>` : ''}
    <div class="cong-cu">${FS.canKetNoiLai ? '<button class="nut chinh" data-act="ket-noi-lai">Kết nối lại</button>' : ''}<button class="nut ${FS.ketNoi || FS.canKetNoiLai ? '' : 'chinh'}" data-act="chon-thu-muc" ${ho ? '' : 'disabled'}>Chọn thư mục dự án…</button>${FS.ketNoi ? '<button class="nut" data-act="tai-lai">Tải lại từ thư mục</button><button class="nut" data-act="quet">Quét hồ sơ</button>' : ''}</div>
    ${ho ? '' : '<p class="canh-pt nho">Trình duyệt này không hỗ trợ truy cập thư mục. Dùng Microsoft Edge hoặc Google Chrome trên máy tính.</p>'}
    <p class="muted nho">Chọn đúng thư mục <b>(1. VGIP) KCN Văn Giang</b> trong OneDrive. App ghi dữ liệu vào thư mục con <b>${esc(D.caiDat.thuMucApp)}</b>. Ngoài ra chỉ <b>thêm file mới</b> khi bạn chọn (file tiến độ nhập vào thư mục Tiến độ triển khai); không ghi đè, không sửa, không di chuyển hồ sơ khác.</p>
    <div class="form"><label class="rong">Đường dẫn đầy đủ của thư mục dự án (để chép đường dẫn, lệnh cho Claude)<input data-sua="caiDat" data-f="duongDanGoc" value="${esc(D.caiDat.duongDanGoc)}"></label></div></div>
  ${typeof veCaiDatDrive === 'function' ? veCaiDatDrive() : ''}
  <div class="the"><h3>Người dùng và đơn vị</h3><div class="form">
    <label>Tôi là<select data-sua="caiDat" data-f="toiLa"><option value="">—</option>${D.nguoi.map(p => `<option value="${p.id}" ${p.id === D.caiDat.toiLa ? 'selected' : ''}>${esc(p.ten)}</option>`).join('')}</select></label>
    <label>Đơn vị lập văn bản<input data-sua="duAn" data-f="donVi" value="${esc(D.duAn.donVi)}"></label>
    <label class="rong">Tên dự án<input data-sua="duAn" data-f="ten" value="${esc(D.duAn.ten)}"></label>
    <label class="rong">Công ty<input data-sua="duAn" data-f="congTy" value="${esc(D.duAn.congTy)}"></label></div>
    <p class="muted nho">Chưa có tên mình trong danh sách? Thêm ở tab Giao việc → Danh bạ.</p></div>
  <div class="the"><h3>Dữ liệu</h3><p class="nho">Nguồn ban đầu: ${esc(D.nguon?.tienDo || '')} (tạo ${esc(D.nguon?.taoLuc || '')}). Cập nhật lần cuối: ${D.capNhat ? new Date(D.capNhat).toLocaleString('vi-VN') : 'chưa sửa'}.</p>
    <p class="nho">${D.viec.length} việc · ${D.moc.length} mốc · ${D.vanBan.length} văn bản · ${D.gpmb.dot.length} QĐ phê duyệt PA · ${D.nguoi.length} người · ${D.phieu.length} phiếu.</p>
    <button class="nut xoa" data-act="khoi-phuc-goc">Khôi phục dữ liệu gốc trên trình duyệt</button>
    <p class="muted nho">App QLDA phiên bản ${PHIEN_BAN_APP}.</p></div>
  ${typeof veNapGoi === 'function' ? veNapGoi() : ''}
  ${veDoiDuongDan()}</div>`;
}

/* ============================== NGĂN KÉO CHI TIẾT ============================== */
function veDrawer() {
  const dr = $('#drawer'); const d = UI.drawer;
  if (!d) { dr.hidden = true; dr.innerHTML = ''; return; }
  const html = d.kieu === 'viec' ? drawerViec(d.id) : d.kieu === 'dot' ? drawerDot(d.id) : d.kieu === 'vb' ? drawerVb(d.id) : d.kieu === 'td' ? drawerTd(d.id) : d.kieu === 'hd' ? drawerHd(d.id) : d.kieu === 'bv' ? drawerBv(d.id) : '';
  if (!html) { UI.drawer = null; dr.hidden = true; return; }
  dr.innerHTML = html; dr.hidden = false;
}
function drawerViec(id) {
  const v = viec(id); if (!v) return '';
  const st = trangThai(v), canh = canhPhuThuoc(v);
  const s = (f, nhan, html, rong) => `<label class="${rong ? 'rong' : ''}">${nhan}${html}</label>`;
  const inp = (f, kieu = 'text', ve = 0) => `<input type="${kieu}" data-sua="viec" data-id="${id}" data-f="${f}" data-ve="${ve}" value="${esc(v[f] ?? '')}">`;
  return `<div class="dau"><div><span class="muted nho">Việc ${v.tt} · ${esc(nhomTen(v.nhom))}</span><h3 style="margin:2px 0 0">${esc(v.ten)}</h3></div><button class="nut" data-act="dong-drawer" aria-label="Đóng">✕</button></div>
  <p><span class="chip ${LOP_TT[st]}">${st}</span> <span class="muted nho">Thực hiện ${pctThucTe(v)}% · kế hoạch ${pctKeHoach(v)}%</span>${v.canXacNhan ? ` <button class="nut nho" data-act="xac-nhan" data-id="${id}">Đánh dấu đã rà soát</button>` : ''}</p>
  ${canh.length ? `<div class="canh-hop nho">${canh.map(esc).join('<br>')} <button class="nut nho" data-act="doi-phu-thuoc" data-id="${id}">Dời theo phụ thuộc</button></div>` : ''}
  ${D.thueDat.dot.filter(x => x.viecId === id).map(x => `<p><button class="nut" data-act="mo-td" data-id="${x.id}">Theo dõi thủ tục thuê đất và miễn, giảm: ${esc(x.ten)}</button></p>`).join('')}
  <div class="form">
    ${s('ten', 'Tên công việc', inp('ten', 'text', 1), true)}
    ${s('nhom', 'Nhóm', `<select data-sua="viec" data-id="${id}" data-f="nhom" data-ve="1">${D.nhom.map(n => `<option value="${n.ma}" ${n.ma === v.nhom ? 'selected' : ''}>${n.ma}. ${esc(n.ten)}</option>`).join('')}</select>`)}
    ${s('moc', 'Mốc', `<select data-sua="viec" data-id="${id}" data-f="moc"><option value="">—</option>${D.moc.map(m => `<option ${m.id === v.moc ? 'selected' : ''}>${m.id}</option>`).join('')}</select>`)}
    ${s('batDau', 'Bắt đầu', inp('batDau', 'date', 1))}${s('ketThuc', 'Kết thúc', inp('ketThuc', 'date', 1))}
    ${s('soNgay', 'Số ngày (lịch)', inp('soNgay', 'number', 1))}
    ${s('trangThai', 'Trạng thái', `<select data-sua="viec" data-id="${id}" data-f="trangThai" data-ve="1">${['Chưa làm', 'Đang làm', 'Đã xong'].map(x => `<option ${x === v.trangThai ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
    ${s('pct', '% thực hiện', `<input type="number" min="0" max="100" step="5" data-sua="viec" data-id="${id}" data-f="pct" data-ve="1" value="${pctThucTe(v)}">`)}
    ${s('giaoCho', 'Giao cho', `<select data-sua="viec" data-id="${id}" data-f="giaoCho"><option value="">—</option>${D.nguoi.map(p => `<option value="${p.id}" ${p.id === v.giaoCho ? 'selected' : ''}>${esc(p.ten)}</option>`).join('')}</select>`)}
    ${s('chuTri', 'Chủ trì', inp('chuTri'))}${s('phoiHop', 'Phối hợp', inp('phoiHop'))}
    ${s('ghiChu', 'Ghi chú', `<textarea data-sua="viec" data-id="${id}" data-f="ghiChu">${esc(v.ghiChu)}</textarea>`, true)}
  </div>
  <div class="muc"><h3>Phụ thuộc</h3>${v.phuThuoc.map((p, i) => { const tr = viec(p.id); return `<div class="the-vb"><span class="fill">${p.kieu === 'SS' ? 'Gối đầu sau' : 'Xong mới làm sau'} việc ${tr?.tt}. ${esc(tr?.ten || '')}</span><button class="nut nho xoa" data-act="bo-phu-thuoc" data-id="${id}" data-i="${i}">✕</button></div>`; }).join('') || '<p class="muted nho">Không có.</p>'}
    <div class="cong-cu"><select class="o" id="pt-viec" style="flex:1;min-width:0">${D.viec.filter(x => x.id !== id).map(x => `<option value="${x.id}">${x.tt}. ${esc(x.ten.slice(0, 60))}</option>`).join('')}</select><select class="o" id="pt-kieu"><option value="FS">Xong mới làm</option><option value="SS">Gối đầu</option></select><button class="nut" data-act="them-phu-thuoc" data-id="${id}">Thêm</button></div></div>
  <div class="muc"><h3>Checklist hồ sơ cần có</h3>${v.checklist.map((c, i) => `<div class="the-vb"><input type="checkbox" data-act="tick" data-id="${id}" data-i="${i}" ${c.xong ? 'checked' : ''}><span class="fill" style="${c.xong ? 'text-decoration:line-through;color:var(--phu)' : ''}">${esc(c.ten)}</span><button class="nut nho xoa" data-act="bo-check" data-id="${id}" data-i="${i}">✕</button></div>`).join('') || '<p class="muted nho">Chưa có mục nào.</p>'}
    <div class="cong-cu"><input class="o" id="check-moi" placeholder="VD: QĐ thu hồi đất, biên bản bàn giao…" style="flex:1"><button class="nut" data-act="them-check" data-id="${id}">Thêm</button></div></div>
  <div class="muc"><h3>Văn bản liên quan</h3>${v.vanBan.map(vid => vb(vid)).filter(Boolean).map(x => theVb(x, 'bo-vb-viec', id)).join('') || '<p class="muted nho">Chưa gắn văn bản.</p>'}
    <div class="cong-cu"><input class="o" id="vb-gan" list="dl-vb" placeholder="Gõ số hiệu hoặc trích yếu để tìm…" style="flex:1"><button class="nut" data-act="gan-vb-viec" data-id="${id}">Gắn</button></div>
    <button class="nut" data-act="phieu-viec" data-id="${id}">Soạn văn bản cho việc này (Claude)</button></div>
  <div class="muc"><h3>Nhật ký</h3>${v.nhatKy.length ? `<ul class="ds nho">${[...v.nhatKy].reverse().slice(0, 30).map(n => `<li><span class="muted" style="width:120px">${new Date(n.luc).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="fill">${esc(n.noiDung)}</span></li>`).join('')}</ul>` : '<p class="muted nho">Chưa có thay đổi.</p>'}</div>
  <div class="muc"><button class="nut xoa" data-act="xoa-viec" data-id="${id}">Xoá việc</button></div>`;
}
function drawerDot(id) {
  const x = dot(id); if (!x) return '';
  const inp = (f, kieu = 'text', gt = x[f], extra = '') => `<input type="${kieu}" data-sua="dot" data-id="${id}" data-f="${f}" value="${esc(gt ?? '')}" ${extra}>`;
  const so = (f, gt, le = 0) => `<input class="so" data-sua="dot" data-id="${id}" data-f="${f}" value="${fmtSo(gt, le)}">`;
  const mo = laMo(x), km = x.khoanMuc, tongKm = Object.values(km).reduce((s, v) => s + (+v || 0), 0);
  const ds = [x.qdId, ...x.dieuChinh.map(d => d.qdId), x.cvDeNghi?.vbId, x.cvdId, ...x.ttrIds].filter(Boolean).map(vb).filter(Boolean);
  return `<div class="dau"><div><span class="muted nho">${mo ? 'Quyết định phê duyệt phương án bồi thường, hỗ trợ di chuyển mộ' : 'Quyết định phê duyệt phương án BTHT'}</span><h3 style="margin:2px 0 0">${esc(x.ten)}</h3></div><button class="nut" data-act="dong-drawer">✕</button></div>
  <p class="nho">Hạn chi trả (30 ngày từ hiệu lực): <b>${fmtNgay(hanChiTra(x)) || '—'}</b>${x.chiTraTu ? ` · Lịch chi trả dự kiến: <b>${esc(ngayChiTraDK(x))}</b>` : ''} · Kinh phí hiện hành: <b>${fmtSo(tongDot(x))} đ</b></p>
  <div class="form">
    <label class="rong">Tên đợt / khu vực${inp('ten')}</label>
    <label>Số QĐ${inp('qdSo')}</label><label>Ngày QĐ${inp('qdNgay', 'date')}</label>
    <label>Ngày hiệu lực${inp('hieuLuc', 'date')}</label><label>Cơ quan ban hành${inp('coQuan')}</label>
    ${mo ? `<label>Số ngôi mộ${so('soMo', x.soMo)}</label><label>Số phương án${so('soHo', x.soHo)}</label>
    <label>Bồi thường, hỗ trợ về mộ (đ)${so('km.boiThuong', km.boiThuong)}</label><label>Thưởng tiến độ (đ)${so('km.thuong', km.thuong)}</label>`
    : `<label>Số hộ / phương án (đất và tài sản)${so('soHo', x.soHo)}</label><label>Phương án riêng về tài sản${so('soPATS', x.soPATS)}</label>
    <label>Diện tích (m²)${so('dienTich', x.dienTich, 1)}</label><label></label>
    <label class="rong">Khu vực / thôn<textarea data-sua="dot" data-id="${id}" data-f="khuVuc">${esc(x.khuVuc)}</textarea></label>
    <label>Bồi thường về đất (đ)${so('km.dat', km.dat)}</label><label>Bồi thường, hỗ trợ tài sản (đ)${so('km.taiSan', km.taiSan)}</label>
    <label>Các khoản hỗ trợ (đ)${so('km.hoTro', km.hoTro)}</label><label>Thưởng tiến độ (đ)${so('km.thuong', km.thuong)}</label>`}
    <label>Tổng theo QĐ (đ)${so('tong', x.tong)}</label><label>Cộng khoản mục<input disabled class="so" value="${fmtSo(tongKm)}${tongKm && x.tong && tongKm !== x.tong ? ' ≠ tổng!' : ''}"></label>
    <label>Chi trả dự kiến – từ ngày${inp('chiTraTu', 'date')}</label><label>đến ngày${inp('chiTraDen', 'date')}</label>
    <label>CV đề nghị chuyển tiền – số${inp('cv.so', 'text', x.cvDeNghi.so)}</label><label>CV – ngày${inp('cv.ngay', 'date', x.cvDeNghi.ngay)}</label>
    <label>Ngày chuyển tiền${inp('ngayChuyenTien', 'date')}</label><label>Số tiền đã chuyển (đ)${so('soTienChuyen', x.soTienChuyen)}</label>
    ${mo ? `<label>Số ngôi đã di dời${so('daDiDoi', x.daDiDoi)}</label><label></label>` : `<label>Diện tích đã chi trả (ha)${so('daChiTraHa', x.daChiTraHa, 2)}</label><label>Đã bàn giao (ha)${so('banGiaoHa', x.banGiaoHa, 2)}</label>`}
    <label class="rong">Trạng thái<select data-sua="dot" data-id="${id}" data-f="trangThai">${TT_DOT.map(s => `<option ${s === x.trangThai ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="rong">Bước quy trình GPMB (Hưng Yên) đã đạt<select data-sua="dot" data-id="${id}" data-f="buocQT"><option value="">—</option>${mauQT('gpmb').map(b => `<option value="${esc(b.buoc)}" ${b.buoc === x.buocQT ? 'selected' : ''}>${esc(b.buoc)} – ${esc(b.ten)}</option>`).join('')}</select></label>
    <label class="rong">Ghi chú<textarea data-sua="dot" data-id="${id}" data-f="ghiChu">${esc(x.ghiChu)}</textarea></label>
  </div>
  <div class="muc"><h3>Điều chỉnh</h3>${x.dieuChinh.map((d, i) => `<div class="the-vb"><span class="fill">QĐ ${esc(d.qdSo)} ngày ${fmtNgay(d.qdNgay)} → <b>${fmtSo(d.tongMoi)} đ</b><br><span class="muted nho">${esc(d.ghiChu)}</span></span><button class="nut nho xoa" data-act="bo-dieu-chinh" data-id="${id}" data-i="${i}">✕</button></div>`).join('') || '<p class="muted nho">Chưa có.</p>'}
    <div class="form"><label>Số QĐ điều chỉnh<input id="dc-so"></label><label>Ngày<input id="dc-ngay" type="date"></label><label>Tổng kinh phí mới (đ)<input id="dc-tong" class="so"></label><label>Lý do<input id="dc-gc"></label></div>
    <button class="nut" style="margin-top:8px" data-act="them-dieu-chinh" data-id="${id}">Thêm điều chỉnh</button></div>
  <div class="muc"><h3>Văn bản</h3>${ds.map(v => theVb(v, '')).join('') || '<p class="muted nho">Chưa có.</p>'}
    <button class="nut chinh" data-act="phieu-dot" data-id="${id}">Soạn tờ trình chuyển kinh phí (Claude)</button></div>
  ${!mo && typeof veSinhViec === 'function' ? veSinhViec('gpmb', 'GPMB ' + x.ten.split(' – ')[0]) : ''}
  <div class="muc"><button class="nut xoa" data-act="xoa-dot" data-id="${id}">Xoá QĐ này</button></div>`;
}
function drawerTd(id) {
  const x = tdDot(id); if (!x) return '';
  const inp = (f, kieu = 'text', gt = x[f]) => `<input type="${kieu}" data-sua="td" data-id="${id}" data-f="${f}" value="${esc(gt ?? '')}">`;
  const s = tomTatMG(x), b = buocTDHienTai(x), mm = mocMien(x), qd = vb(x.qdVbId);
  const mg = s.ds.map(m => `<div class="the-vb nhieu-dong">
      <span class="chip ${LOP_MG[m.tt]}" style="min-width:96px;text-align:center">${NHAN_MG[m.tt]}</span>
      <span class="fill"><b>${esc(m.ten)}</b><br><span class="muted nho">${m.luc === 'nop' ? 'Kê, nộp cùng hồ sơ xin thuê đất (Bước 1)' : `Sau QĐ cho thuê đất · hạn nội bộ ${m.han ? fmtNgay(m.han) : `QĐ + ${m.hanNgay} ngày`}`} · ${esc(m.buoc)}</span>
        <details><summary class="nho">Hậu quả nếu bỏ lỡ · căn cứ</summary><p class="nho" style="margin:4px 0">${esc(m.hauQua)}</p><p class="muted nho" style="margin:0">${esc(m.canCu)}</p></details>
        <input class="o nho" style="width:100%;margin-top:4px" placeholder="Số văn bản, ngày nộp, ghi chú…" data-sua="td-mg" data-id="${id}" data-f="${m.ma}" data-k="ghiChu" value="${esc(m.ghiChu)}"></span>
      <span style="display:flex;flex-direction:column;gap:4px"><label class="nho">Ngày đã làm<input type="date" data-sua="td-mg" data-id="${id}" data-f="${m.ma}" data-k="xong" value="${m.xong}"></label>
        <label class="nho"><input type="checkbox" data-sua="td-mg" data-id="${id}" data-f="${m.ma}" data-k="khongAD" ${m.khongAD ? 'checked' : ''}> Không áp dụng</label></span></div>`).join('');
  const qt = mauQT('thue-dat').map(p => {
    if (p.phan) return `<p style="margin:12px 0 4px"><b>${esc(p.phan)}</b></p>`;
    const r = x.buoc[p.buoc] || {}, chiMotLan = p.buoc === 'Bước 4a';
    return `<div class="the-vb nhieu-dong" style="${chiMotLan && x.hinhThucTra !== 'Một lần' ? ';opacity:.55' : ''}">
      <span class="chip ${r.xong ? 'st-xong' : b.hien?.buoc === p.buoc ? 'st-lam' : 'st-chua'}" style="min-width:64px;text-align:center">${esc(p.buoc)}</span>
      <span class="fill"><b>${esc(p.ten)}</b><br><span class="muted nho">${esc(p.chuTri)} · hạn HY: ${esc(p.han)} · dự kiến ${esc(p.ngayKH)} ngày LV${p.phongBan ? ' · ' + esc(p.phongBan) : ''}</span>
        <details><summary class="nho">Nội dung, quyền DN / rủi ro</summary><p class="nho" style="white-space:pre-line;margin:4px 0">${esc(p.noiDung)}</p>${p.sanPham ? `<p class="nho" style="margin:0"><b>Kết quả:</b> ${esc(p.sanPham)}</p>` : ''}${p.quyen ? `<p class="nho" style="white-space:pre-line;margin:4px 0;color:var(--canh)">${esc(p.quyen)}</p>` : ''}<p class="muted nho" style="white-space:pre-line;margin:0">${esc(p.canCu)}</p></details>
        <input class="o nho" style="width:100%;margin-top:4px" placeholder="Ghi chú, số văn bản…" data-sua="td-buoc" data-id="${id}" data-f="${esc(p.buoc)}" data-k="ghiChu" value="${esc(r.ghiChu || '')}"></span>
      <label class="nho">Ngày hoàn thành<input type="date" data-sua="td-buoc" data-id="${id}" data-f="${esc(p.buoc)}" data-k="xong" value="${r.xong || ''}"></label></div>`;
  }).join('');
  return `<div class="dau"><div><span class="muted nho">Cho thuê đất · quy trình Hưng Yên (QĐ 31/2026)</span><h3 style="margin:2px 0 0">${esc(x.ten)}</h3></div><button class="nut" data-act="dong-drawer">✕</button></div>
  <p class="nho">Thủ tục: <b>${b.xong}/${b.ds.length}</b> bước${b.hien ? ` · đang ${esc(b.hien.buoc)} – ${esc(b.hien.ten)}` : ' · hoàn thành'} · Miễn, giảm: <b>${s.xong}/${s.tong}</b> mục</p>
  ${mm ? `<p class="nho canh-hop">Hết miễn XDCB: <b>${fmtNgay(mm.xd)}</b>${mm.ud ? ` · hết miễn theo ngành: <b>${fmtNgay(mm.ud)}</b>` : ''} · phải kê khai nộp tiền thuê trước <b>${fmtNgay(mm.keKhai)}</b>. Thời gian chậm bàn giao đất vẫn bị trừ vào thời gian miễn XDCB.</p>` : '<p class="nho canh-hop">Chưa có QĐ cho thuê đất. Kê nhu cầu miễn (mục 9 Đơn Mẫu 01), nộp giấy tờ chứng minh và hồ sơ đề nghị giảm ngay trong hồ sơ xin thuê đất.</p>'}
  <div class="form">
    <label class="rong">Tên đợt${inp('ten')}</label>
    <label>Diện tích (m²)<input class="so" data-sua="td" data-id="${id}" data-f="dienTichM2" value="${fmtSo(x.dienTichM2, 1)}"></label>
    <label>Hình thức trả tiền<select data-sua="td" data-id="${id}" data-f="hinhThucTra">${['Hằng năm', 'Một lần'].map(o => `<option ${o === x.hinhThucTra ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    <label>Số QĐ cho thuê đất${inp('qdSo')}</label><label>Ngày QĐ${inp('qdNgay', 'date')}</label>
    <label>Ngày bàn giao thực địa${inp('banGiaoNgay', 'date')}</label>
    <label>Mốc${`<select data-sua="td" data-id="${id}" data-f="moc"><option value="">—</option>${D.moc.map(m => `<option ${m.id === x.moc ? 'selected' : ''}>${m.id}</option>`).join('')}</select>`}</label>
    <label class="rong">Việc tiến độ liên quan<select data-sua="td" data-id="${id}" data-f="viecId"><option value="">—</option>${D.viec.map(v => `<option value="${v.id}" ${v.id === x.viecId ? 'selected' : ''}>${v.tt}. ${esc(v.ten.slice(0, 70))}</option>`).join('')}</select></label>
    <label class="rong">Ghi chú<textarea data-sua="td" data-id="${id}" data-f="ghiChu">${esc(x.ghiChu)}</textarea></label>
  </div>
  ${qd ? `<div class="muc"><h3>Quyết định cho thuê đất</h3>${theVb(qd, '')}</div>` : ''}
  <div class="muc"><h3>Miễn, giảm tiền thuê đất – làm đồng thời với thủ tục thuê đất</h3>${mg || '<p class="muted nho">Chưa có danh mục (chạy tools/cap-nhat-quy-trinh.py).</p>'}</div>
  <div class="muc"><h3>Thủ tục cho thuê đất</h3>${qt}</div>
  <div class="muc"><button class="nut" data-act="phieu-nvtc" data-id="${id}">Soạn tờ trình nộp nghĩa vụ tài chính đất đai (Claude)</button></div>
  ${typeof veSinhViec === 'function' ? veSinhViec('thue-dat', 'Thuê đất ' + x.ten.split(' – ')[0]) : ''}
  <div class="muc"><button class="nut xoa" data-act="xoa-td" data-id="${id}">Xoá đợt này</button></div>`;
}
function drawerVb(id) {
  const v = vb(id); if (!v) return '';
  const inp = (f, kieu = 'text') => `<input type="${kieu}" data-sua="vb" data-id="${id}" data-f="${f}" value="${esc(v[f] ?? '')}">`;
  const sel = (f, ds) => `<select data-sua="vb" data-id="${id}" data-f="${f}">${ds.map(s => `<option ${s === v[f] ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  const cungBan = v.khoa ? D.vanBan.filter(x => x.khoa === v.khoa && x.id !== id) : [];
  const lien = [...v.lienKet.map(l => l.kieu === 'dot' ? `<a href="#" data-act="mo-dot" data-id="${l.id}">QĐ ${esc(dot(l.id)?.qdSo || '')}</a>` : l.kieu === 'viec' ? `<a href="#" data-act="mo-viec" data-id="${l.id}">Việc ${viec(l.id)?.tt}. ${esc(viec(l.id)?.ten || '')}</a>` : ''),
    ...D.viec.filter(x => x.vanBan.includes(id) && !v.lienKet.some(l => l.kieu === 'viec' && l.id === x.id)).map(x => `<a href="#" data-act="mo-viec" data-id="${x.id}">Việc ${x.tt}. ${esc(x.ten)}</a>`)];
  return `<div class="dau"><div><span class="muted nho">${esc(v.loai)} · ${esc(v.chieu)}</span><h3 style="margin:2px 0 0">${esc(v.so || v.trichYeu)}</h3></div><button class="nut" data-act="dong-drawer">✕</button></div>
  ${v.tuDong ? `<p class="nho canh-hop">Thông tin được đoán từ tên file — kiểm tra lại số hiệu, loại, trạng thái. <button class="nut nho" data-act="vb-da-ra-soat" data-id="${id}">Đã kiểm tra</button></p>` : ''}
  <div class="form">
    <label>Số / ký hiệu${inp('so')}</label><label>Ngày${inp('ngay', 'date')}</label>
    <label>Loại${sel('loai', LOAI_VB)}</label><label>Chiều${sel('chieu', CHIEU_VB)}</label>
    <label class="rong">Cơ quan ban hành / nơi gửi${inp('coQuan')}</label>
    <label class="rong">Trích yếu<textarea data-sua="vb" data-id="${id}" data-f="trichYeu">${esc(v.trichYeu)}</textarea></label>
    <label>Trạng thái${sel('trangThai', TT_VB)}</label><label>Phiên bản (ver)${inp('ver', 'number')}</label>
    <label class="rong">Đường dẫn file (tính từ thư mục dự án)${inp('duongDan')}</label>
    <label class="rong">Ghi chú<textarea data-sua="vb" data-id="${id}" data-f="ghiChu">${esc(v.ghiChu)}</textarea></label>
  </div>
  <div class="cong-cu" style="margin-top:10px"><button class="nut" data-act="mo-file" data-p="${esc(v.duongDan)}" ${v.duongDan ? '' : 'disabled'}>Mở file</button><button class="nut" data-act="chep" data-data="${esc(v.duongDan ? duongDanDayDu(v.duongDan) : '')}" ${v.duongDan ? '' : 'disabled'}>Chép đường dẫn</button><button class="nut" data-act="phieu-tu-vb" data-id="${id}">Soạn văn bản từ văn bản này</button></div>
  <div class="muc"><h3>Liên kết</h3>${lien.length ? lien.join('<br>') : '<p class="muted nho">Chưa gắn với việc/đợt nào. Gắn từ màn hình chi tiết việc.</p>'}</div>
  ${cungBan.length ? `<div class="muc"><h3>Các phiên bản cùng nội dung</h3>${cungBan.sort((a, b) => (a.ver || 0) - (b.ver || 0)).map(x => `<div class="the-vb"><span class="chip">${x.ver ? 'ver' + x.ver : '—'}</span><a class="fill" href="#" data-act="mo-vb" data-id="${x.id}">${esc(x.duongDan)}</a></div>`).join('')}</div>` : ''}
  <div class="muc"><button class="nut xoa" data-act="xoa-vb" data-id="${id}">Xoá khỏi sổ</button> <span class="muted nho">(không xoá file)</span></div>`;
}

/* ============================== sửa dữ liệu ============================== */
const NHAN_TRUONG = { batDau: 'Bắt đầu', ketThuc: 'Kết thúc', soNgay: 'Số ngày', trangThai: 'Trạng thái', pct: '% thực hiện', giaoCho: 'Giao cho', ten: 'Tên', moc: 'Mốc', nhom: 'Nhóm', chuTri: 'Chủ trì', phoiHop: 'Phối hợp', ghiChu: 'Ghi chú' };
function suaTruong(el) {
  const { sua, id, f } = el.dataset; let gt = el.type === 'checkbox' ? el.checked : el.value;
  if (sua === 'viec') {
    const v = viec(id); if (!v) return;
    const cu = f === 'giaoCho' ? tenNguoi(v[f]) : v[f];
    if (f === 'batDau' || f === 'ketThuc') {
      if (!hopLeNgay(gt)) return thongBao('Ngày không hợp lệ.', 'loi');
      v[f] = gt; if (v.ketThuc < v.batDau) { if (f === 'batDau') v.ketThuc = gt; else v.batDau = gt; }
      v.soNgay = khoang(v.batDau, v.ketThuc) + 1;
    } else if (f === 'soNgay') { const n = Math.max(1, parseInt(gt, 10) || 1); v.soNgay = n; v.ketThuc = congNgay(v.batDau, n - 1); }
    else if (f === 'pct') { const n = Math.min(100, Math.max(0, +gt || 0)); v.pct = n; if (n === 100) v.trangThai = 'Đã xong'; else { if (v.trangThai === 'Đã xong') v.trangThai = 'Đang làm'; if (n > 0 && v.trangThai === 'Chưa làm') v.trangThai = 'Đang làm'; } v.canXacNhan = false; }
    else if (f === 'trangThai') { v.trangThai = gt; if (gt === 'Đã xong') v.pct = 100; else if (v.pct === 100) v.pct = 90; v.canXacNhan = false; }
    else v[f] = gt;
    const moi = f === 'giaoCho' ? tenNguoi(v[f]) : v[f];
    if (String(cu ?? '') !== String(moi ?? '') && f !== 'ghiChu') v.nhatKy.push({ luc: new Date().toISOString(), noiDung: `${NHAN_TRUONG[f] || f}: ${f.match(/batDau|ketThuc/) ? fmtNgay(cu) : cu ?? ''} → ${f.match(/batDau|ketThuc/) ? fmtNgay(moi) : moi}` });
    if (f === 'moc') D.moc.forEach(m => { m.viec = D.viec.filter(x => x.moc === m.id).map(x => x.id); });
  } else if (sua === 'dot') {
    const x = dot(id); if (!x) return;
    if (f.startsWith('km.')) x.khoanMuc[f.slice(3)] = docSo(gt);
    else if (f.startsWith('cv.')) x.cvDeNghi[f.slice(3)] = gt;
    else if (['soHo', 'soPATS', 'soMo', 'daDiDoi', 'dienTich', 'tong', 'soTienChuyen', 'daChiTraHa', 'banGiaoHa'].includes(f)) x[f] = docSo(gt);
    else x[f] = gt;
  } else if (sua === 'vb') {
    const v = vb(id); if (!v) return;
    v[f] = f === 'ver' ? (gt ? +gt : null) : gt;
  } else if (sua === 'td') {
    const x = tdDot(id); if (!x) return;
    x[f] = f === 'dienTichM2' ? docSo(gt) : gt;
  } else if (sua === 'td-mg' || sua === 'td-buoc') {
    const x = tdDot(id); if (!x) return;
    const kho = sua === 'td-mg' ? x.mg : x.buoc, k = el.dataset.k;
    kho[f] ||= {}; kho[f][k] = gt;
    if (k === 'xong' && f === 'Bước 3' && gt && !x.qdNgay) x.qdNgay = gt;
  } else if (window.SUA_THEM?.[sua]) { window.SUA_THEM[sua](el, id, f, gt); } else if (sua === 'tongHop') { D.gpmb.tongHop[f] = f === 'ngay' ? gt : docSo(gt); }
  else if (sua === 'moMa') { D.gpmb.moMa[f] = f === 'ngay' ? gt : docSo(gt); }
  else if (sua === 'nguoi') { const p = nguoi(id); if (p) p[f] = gt; }
  else if (sua === 'caiDat') D.caiDat[f] = gt;
  else if (sua === 'duAn') D.duAn[f] = gt;
  dongBoPheDuyet(D);
  luu();
  setTimeout(render, 0);
}

/* ============================== hành động ============================== */
function veGiaoDien() {
  const toi = document.documentElement.dataset.theme === 'dark';
  const b = $('#giao-dien'); if (b) b.textContent = toi ? '☀ Sáng' : '◐ Tối';
}
const HD = {
  'giao-dien'() {
    const moi = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = moi;
    try { localStorage.setItem('qlda-giao-dien', moi); } catch { }
    veGiaoDien();
  },
  den(el) { UI.view = el.dataset.view; if (el.dataset.tab) UI.vbTab = el.dataset.tab; UI.drawer = null; location.hash = UI.view; render(); window.scrollTo(0, 0); },
  'td-mode'(el) { UI.tdMode = el.dataset.v; render(); },
  zoom(el) { UI.zoom = el.dataset.v; render(); },
  'vb-tab'(el) { UI.vbTab = el.dataset.v; render(); },
  'vb-them-dong'() { UI.vbSoDong += 300; render(); },
  'kho-them-dong'() { UI.khoSoDong += 500; render(); },
  'loc-xac-nhan'() { UI.view = 'tien-do'; UI.tdMode = 'bang'; UI.locTT = 'xac-nhan'; UI.locNhom = ''; UI.tim = ''; render(); },
  'mo-viec'(el) { UI.drawer = { kieu: 'viec', id: el.dataset.id }; veDrawer(); },
  'mo-dot'(el) { UI.drawer = { kieu: 'dot', id: el.dataset.id }; veDrawer(); },
  'mo-vb'(el) { UI.drawer = { kieu: 'vb', id: el.dataset.id }; veDrawer(); },
  'mo-td'(el) { UI.drawer = { kieu: 'td', id: el.dataset.id }; veDrawer(); },
  'them-td'() {
    const x = { id: uid('td'), ten: `Đợt thuê đất ${D.thueDat.dot.length + 1}`, viecId: '', moc: '', dienTichM2: null, qdSo: '', qdNgay: '', qdVbId: null, banGiaoNgay: '', hinhThucTra: 'Hằng năm', ghiChu: '', buoc: {}, mg: {} };
    D.thueDat.dot.push(x); luu(); UI.drawer = { kieu: 'td', id: x.id }; render();
  },
  'xoa-td'(el) { const x = tdDot(el.dataset.id); if (!x || !confirm(`Xoá "${x.ten}"?`)) return; D.thueDat.dot = D.thueDat.dot.filter(d => d !== x); UI.drawer = null; luu(); render(); },
  'dong-drawer'() { UI.drawer = null; veDrawer(); },
  'dong-modal'() { dongModal(); },
  'mo-file'(el) { moFile(el.dataset.p); },
  chep(el) { if (el.dataset.data) chep(el.dataset.data); },
  'chep-zalo'() { chep($('#zalo').value, 'Đã chép tin nhắn — dán vào Zalo.'); },
  'chep-lenh-phieu'(el) { const p = D.phieu.find(x => x.id === el.dataset.id); if (p) chep(p.noiLuu ? `/to-trinh-vgip "${duongDanDayDu(p.noiLuu)}"` : `/to-trinh-vgip "<đường dẫn ${p.file}>"`, 'Đã chép lệnh — dán vào Claude Code.'); },
  'chon-thu-muc'() { chonThuMuc(); }, 'ket-noi-lai'() { ketNoiLai(); }, 'tai-lai'() { taiLaiTuThuMuc(); }, 'giu-ban-may'() { giuBanMay(); },
  quet() { quetThuMuc(); }, 'nhap-chi-muc'() { nhapChiMuc(); },
  'vao-so'(el) { vaoSo(el.dataset.p); render(); },
  'xuat-excel'() { xacNhanTruocBaoCao(xuatExcel); }, 'xuat-html'() { xacNhanTruocBaoCao(xuatHtmlXem); },
  'sao-luu'() { taiVe(`${tenNgayFile()}. Sao luu du lieu QLDA KCN Van Giang.json`, JSON.stringify(D, null, 1), 'application/json'); },
  'khoi-phuc'() { chonFileJson(obj => { if (!obj.viec) return thongBao('File không phải dữ liệu App QLDA.', 'loi'); if (!confirm('Thay toàn bộ dữ liệu hiện tại bằng file này?')) return; D = chuanHoa(obj); luu(); render(); thongBao('Đã khôi phục dữ liệu.'); }); },
  'khoi-phuc-goc'() { if (!confirm('Xoá dữ liệu trên trình duyệt và nạp lại dữ liệu gốc? (File du-lieu.json trong thư mục không bị xoá; khi kết nối lại, bản trong thư mục sẽ được dùng.)')) return; D = chuanHoa(structuredClone(window.DU_LIEU_GOC)); KHO.dat('du-lieu', D); FS.ketNoi = false; FS.canKetNoiLai = true; render(); },
  'cap-nhat-phieu'() { capNhatKetQuaPhieu(); },
  'phieu-dot'(el) { phieuDot(el.dataset.id); },
  'phieu-bao-cao'() { xacNhanTruocBaoCao(phieuBaoCao); },
  'phieu-tu-do'() { phieuTuDo(); },
  'phieu-viec'(el) { const v = viec(el.dataset.id); phieuTuDo({ kieu: 'viec', id: v.id }, v.vanBan); setTimeout(() => { const i = $('#pt-td'); if (i) i.value = v.ten; }, 0); },
  'phieu-tu-vb'(el) { phieuTuDo(null, [el.dataset.id]); },
  'pt-bo'(el) { UI.ptVb = UI.ptVb.filter(x => x !== el.dataset.id); el.closest('.the-vb').remove(); },
  'pt-tao'() {
    const td = $('#pt-td').value.trim(); if (!td) return thongBao('Nhập tiêu đề văn bản.', 'canh');
    const loai = $('#pt-loai').value, tm = $('#pt-tm').value, yc = $('#pt-yc').value.trim();
    dongModal();
    taoPhieu({ mau: 'van-ban-tu-do', tieuDe: `${loai}: ${td}`, noiDungNgan: (loai === 'Tờ trình' ? 'TTr ' : loai === 'Công văn' ? 'CV ' : 'BC ') + td.slice(0, 80).replace(/[\\/:*?"<>|]/g, '-'),
      doiTuong: UI.ptDoiTuong, duLieu: { loaiVanBan: loai, viec: UI.ptDoiTuong?.kieu === 'viec' ? viec(UI.ptDoiTuong.id) : null }, canCu: UI.ptVb.map(id => canCuTuVb(id, 'Văn bản căn cứ')), yeuCauThem: yc, thuMuc: tm });
  },
  'them-viec'() {
    const nhom = UI.locNhom || D.nhom[D.nhom.length - 1]?.ma || 'A', tt = Math.max(0, ...D.viec.map(v => v.tt)) + 1, t = homNay();
    const v = { id: uid('v'), tt, nhom, ten: 'Việc mới', batDau: t, ketThuc: congNgay(t, 6), soNgay: 7, chuTri: '', phoiHop: '', ghiChu: '', moc: '', trangThai: 'Chưa làm', pct: 0, giaoCho: '', phuThuoc: [], checklist: [], vanBan: [], nhatKy: [{ luc: new Date().toISOString(), noiDung: 'Tạo việc' }], canXacNhan: false };
    D.viec.push(v); ghiNhatKyChung(`Thêm việc ${tt} (nhóm ${nhom})`); luu(); UI.drawer = { kieu: 'viec', id: v.id }; render();
  },
  'xoa-viec'(el) { const v = viec(el.dataset.id); if (!v || !confirm(`Xoá việc "${v.ten}"?`)) return; xoaViecLienKet(v); ghiNhatKyChung(`Xoá việc ${v.tt}. ${v.ten} (${fmtNgay(v.batDau)} – ${fmtNgay(v.ketThuc)}, ${trangThai(v)})`); UI.drawer = null; luu(); render(); },
  'xac-nhan'(el) { const v = viec(el.dataset.id); v.canXacNhan = false; v.nhatKy.push({ luc: new Date().toISOString(), noiDung: 'Đã rà soát kết quả' }); luu(); render(); },
  'them-phu-thuoc'(el) { const v = viec(el.dataset.id), pid = $('#pt-viec').value, kieu = $('#pt-kieu').value; if (v.phuThuoc.some(p => p.id === pid)) return; v.phuThuoc.push({ id: pid, kieu }); luu(); render(); },
  'bo-phu-thuoc'(el) { viec(el.dataset.id).phuThuoc.splice(+el.dataset.i, 1); luu(); render(); },
  'doi-phu-thuoc'(el) {
    const v = viec(el.dataset.id); let moi = v.batDau;
    for (const p of v.phuThuoc) { const tr = viec(p.id); if (!tr) continue; const can = p.kieu === 'SS' ? tr.batDau : congNgay(tr.ketThuc, 1); if (can > moi) moi = can; }
    if (moi !== v.batDau) { const n = v.soNgay; v.nhatKy.push({ luc: new Date().toISOString(), noiDung: `Dời theo phụ thuộc: bắt đầu ${fmtNgay(v.batDau)} → ${fmtNgay(moi)}` }); v.batDau = moi; v.ketThuc = congNgay(moi, n - 1); luu(); render(); }
  },
  tick(el) { const c = viec(el.dataset.id).checklist[+el.dataset.i]; c.xong = el.checked; luu(); render(); },
  'them-check'(el) { const t = $('#check-moi').value.trim(); if (!t) return; viec(el.dataset.id).checklist.push({ ten: t, xong: false }); luu(); render(); setTimeout(() => $('#check-moi')?.focus(), 0); },
  'bo-check'(el) { viec(el.dataset.id).checklist.splice(+el.dataset.i, 1); luu(); render(); },
  'gan-vb-viec'(el) {
    const id = $('#vb-gan').value.trim(); const x = vb(id) || D.vanBan.find(v => v.so && v.so === id);
    if (!x) return thongBao('Không tìm thấy văn bản. Chọn từ danh sách gợi ý.', 'canh');
    const v = viec(el.dataset.id); if (!v.vanBan.includes(x.id)) v.vanBan.push(x.id); luu(); render();
  },
  'bo-vb-viec'(el) { const v = viec(el.dataset.cha); v.vanBan = v.vanBan.filter(i => i !== el.dataset.id); luu(); render(); },
  'them-dot'() {
    const x = { id: uid('dot'), ten: 'QĐ phê duyệt mới', qdId: null, qdSo: '', qdNgay: '', hieuLuc: '', coQuan: 'Chủ tịch UBND xã Nghĩa Trụ', soHo: null, dienTich: null, khuVuc: '', khoanMuc: { dat: null, taiSan: null, hoTro: null, thuong: null }, tong: null, dieuChinh: [], cvDeNghi: { so: '', ngay: '', vbId: null }, ttrIds: [], ngayChuyenTien: '', soTienChuyen: null, daChiTraHa: null, banGiaoHa: null, trangThai: 'Chờ CV đề nghị', ghiChu: '' };
    D.gpmb.dot.push(x); luu(); UI.drawer = { kieu: 'dot', id: x.id }; render();
  },
  'them-mo-qd'() {
    const x = { id: uid('mo'), loai: 'mo', ten: 'QĐ phê duyệt PA di chuyển mộ mới', qdId: null, qdSo: '', qdNgay: '', hieuLuc: '', coQuan: 'Chủ tịch UBND xã Nghĩa Trụ', soMo: null, soHo: null, khoanMuc: { boiThuong: null, thuong: null }, tong: null, dieuChinh: [], cvDeNghi: { so: '', ngay: '', vbId: null }, ttrIds: [], ngayChuyenTien: '', soTienChuyen: null, daDiDoi: null, chiTraTu: '', chiTraDen: '', trangThai: 'Chờ CV đề nghị', ghiChu: '' };
    D.gpmb.moMa.qd.push(x); luu(); UI.drawer = { kieu: 'dot', id: x.id }; render();
  },
  'xoa-dot'(el) { const x = dot(el.dataset.id); if (!x || !confirm(`Xoá "${x.ten}"?`)) return; D.gpmb.dot = D.gpmb.dot.filter(d => d !== x); D.gpmb.moMa.qd = D.gpmb.moMa.qd.filter(d => d !== x); UI.drawer = null; luu(); render(); },
  'them-dieu-chinh'(el) {
    const so = $('#dc-so').value.trim(), tong = docSo($('#dc-tong').value); if (!so || tong == null) return thongBao('Nhập số QĐ và tổng kinh phí mới.', 'canh');
    dot(el.dataset.id).dieuChinh.push({ qdId: null, qdSo: so, qdNgay: $('#dc-ngay').value, tongMoi: tong, ghiChu: $('#dc-gc').value.trim() }); luu(); render();
  },
  'bo-dieu-chinh'(el) { dot(el.dataset.id).dieuChinh.splice(+el.dataset.i, 1); luu(); render(); },
  'ghi-nhan-gpmb'() {
    const th = D.gpmb.tongHop, ls = D.gpmb.lichSu; const cu = ls.find(x => x.ngay === th.ngay);
    const ban = { ngay: th.ngay, chiTraHa: th.chiTraHa, banGiaoHa: th.banGiaoHa, pheDuyetHa: th.pheDuyetHa };
    if (cu) Object.assign(cu, ban); else ls.push(ban); ls.sort((a, b) => a.ngay.localeCompare(b.ngay)); luu(); render(); thongBao('Đã ghi nhận số liệu GPMB ngày ' + fmtNgay(th.ngay));
  },
  'them-vb'() { const v = { id: uid('vb'), so: '', ngay: homNay(), loai: 'Công văn', chieu: 'Đến', coQuan: '', trichYeu: '', trangThai: 'Đã nhận', duongDan: '', ver: null, khoa: '', ghiChu: '', lienKet: [], tuDong: false }; D.vanBan.push(v); luu(); UI.drawer = { kieu: 'vb', id: v.id }; render(); },
  'xoa-vb'(el) { const v = vb(el.dataset.id); if (!v || !confirm('Xoá văn bản khỏi sổ? File trong thư mục giữ nguyên.')) return; D.vanBan = D.vanBan.filter(x => x !== v); D.viec.forEach(x => x.vanBan = x.vanBan.filter(i => i !== v.id)); D.gpmb.dot.forEach(x => x.ttrIds = x.ttrIds.filter(i => i !== v.id)); UI.drawer = null; luu(); render(); },
  'vb-da-ra-soat'(el) { vb(el.dataset.id).tuDong = false; luu(); render(); },
  'chon-nguoi'(el) { UI.nguoiChon = el.dataset.v; render(); },
  'them-nguoi'() { D.nguoi.push({ id: uid('p'), ten: 'Người mới', chucDanh: '', donVi: '', dienThoai: '' }); luu(); render(); },
  'xoa-nguoi'(el) { const p = nguoi(el.dataset.id); if (!p || !confirm(`Xoá ${p.ten} khỏi danh bạ?`)) return; D.nguoi = D.nguoi.filter(x => x !== p); D.viec.forEach(v => { if (v.giaoCho === p.id) v.giaoCho = ''; }); luu(); render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
  const oNhap = e.target.closest('input, select, textarea, label');
  if (oNhap && oNhap !== el && el.contains(oNhap)) return;
  const fn = HD[el.dataset.act]; if (fn) fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.sua) return suaTruong(el);
  if (el.dataset.loc) { UI[el.dataset.loc] = el.type === 'checkbox' ? el.checked : el.value; UI.vbSoDong = 200; UI.khoSoDong = 300; render(); }
  if (el.id === 'pt-them') { const x = vb(el.value.trim()); if (x && !UI.ptVb.includes(x.id)) { UI.ptVb.push(x.id); const box = $('#pt-ds'); if (box.querySelector('p')) box.innerHTML = ''; box.insertAdjacentHTML('beforeend', theVb(x, 'pt-bo')); } el.value = ''; }
});
let henTim = null;
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset.loc || el.type !== 'search') return;
  clearTimeout(henTim); henTim = setTimeout(() => { UI[el.dataset.loc] = el.value; UI.vbSoDong = 200; UI.khoSoDong = 300; render(); }, 250);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) dongModal(); else if (UI.drawer) { UI.drawer = null; veDrawer(); } }
  if (e.key === 'Enter' && e.target.id === 'check-moi') HD['them-check']($('[data-act="them-check"]'));
});
/* kéo thả Kanban */
document.addEventListener('dragstart', e => { const c = e.target.closest?.('[data-keo]'); if (c) e.dataTransfer.setData('text/plain', c.dataset.keo); });
document.addEventListener('dragover', e => { const c = e.target.closest?.('[data-cot]'); if (c) { e.preventDefault(); $$('.cot').forEach(x => x.classList.toggle('keo', x === c)); } });
document.addEventListener('drop', e => {
  const c = e.target.closest?.('[data-cot]'); if (!c) return; e.preventDefault(); $$('.cot').forEach(x => x.classList.remove('keo'));
  const v = viec(e.dataTransfer.getData('text/plain')); if (!v) return;
  let moi = c.dataset.cot; if (moi === 'Chậm TĐ') { moi = 'Đang làm'; thongBao('"Chậm TĐ" do app tự tính theo hạn — đã đặt "Đang làm".', 'canh'); }
  const cu = v.trangThai; v.trangThai = moi; if (moi === 'Đã xong') v.pct = 100; else if (v.pct === 100) v.pct = 90; v.canXacNhan = false;
  if (cu !== moi) v.nhatKy.push({ luc: new Date().toISOString(), noiDung: `Trạng thái: ${cu} → ${moi}` });
  luu(); render();
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== UI.view && $(`#nav [data-view="${h}"]`)) { UI.view = h; UI.drawer = null; render(); } });

/* ============================== khởi động ============================== */
(async function khoiDong() {
  if (!window.DU_LIEU_GOC) { document.body.innerHTML = '<p style="padding:20px">Thiếu file du-lieu-goc.js.</p>'; return; }
  const luuMay = await KHO.lay('du-lieu');
  D = chuanHoa(luuMay && luuMay.viec ? luuMay : structuredClone(window.DU_LIEU_GOC));
  CHI_MUC = (await KHO.lay('chi-muc')) || null;
  const h = location.hash.slice(1); if (h && $(`#nav [data-view="${h}"]`)) UI.view = h;
  render();
  const tm = await KHO.lay('thu-muc');
  if (tm && tm.queryPermission) {
    try { if ((await tm.queryPermission({ mode: 'readwrite' })) === 'granted') await ketNoiThuMuc(tm); else { FS.canKetNoiLai = true; veDongBo(); if (UI.view === 'cai-dat') render(); } }
    catch { FS.canKetNoiLai = true; veDongBo(); }
  }
  const dv = await KHO.lay('drive');
  if (dv && !FS.ketNoi) { FS.driveCho = dv; FS.canKetNoiLai = true; veDongBo(); if (UI.view === 'cai-dat') render(); }
  veGiaoDien();
  $('#dong-bo').addEventListener('click', e => { if (FS.canKetNoiLai) { e.stopPropagation(); ketNoiLai(); } }, true);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
