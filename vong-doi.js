'use strict';
/* App QLDA – TOÀN BỘ DỰ ÁN (vòng đời các bước) + DỜI DÂY CHUYỀN + ĐƯỜNG GĂNG (1.8.0)
   - Thư viện công việc chuẩn đọc từ "00. APP QLDA\thu-vien-cong-viec.json" trên thư mục dự án (không nằm trong repo).
     Cấu trúc: { loai:'thu-vien-cong-viec', giaiDoan:[...], buoc:[{ma, stt, ten, chuTri, phoiHop, coQuan, soNgay, giaiDoan, nhom, canCu}], goiYThuMuc:{nhom: đường dẫn} }
   - Trạng thái từng bước: theo việc tiến độ đã gắn (viec.idcv = mã bước), nếu chưa gắn thì theo D.vongDoi.buoc[ma].tt.
   - D.vongDoi = { buoc: {ma: {tt, ngay}}, thuMuc: {nhom: đường dẫn tương đối} }. */

const TEP_THU_VIEN = 'thu-vien-cong-viec.json';
const TT_BUOC = ['Chưa làm', 'Đang làm', 'Đã xong', 'Không áp dụng'];
let TV = null, TV_DANG = false, TV_LOI = '';
KHO.lay('thu-vien').then(x => { if (x?.buoc && !TV) TV = x; }).catch(() => { });

async function napThuVienCV(baoTin) {
  if (!FS.ketNoi) { if (baoTin) thongBao('Chưa kết nối thư mục dự án.', 'canh'); return; }
  TV_DANG = true;
  try {
    const f = await FS.app.getFileHandle(TEP_THU_VIEN);
    const data = JSON.parse(await (await f.getFile()).text());
    if (data?.loai !== 'thu-vien-cong-viec' || !Array.isArray(data.buoc)) throw new Error('file không đúng cấu trúc thư viện');
    TV = data; TV_LOI = ''; await KHO.dat('thu-vien', data);
    if (baoTin) thongBao(`Đã nạp thư viện: ${data.buoc.length} bước chuẩn.`);
  } catch (e) { TV_LOI = e?.name === 'NotFoundError' ? 'chua-co' : (e?.message || String(e)); if (baoTin) thongBao('Không đọc được thư viện: ' + (TV_LOI === 'chua-co' ? 'chưa có file' : TV_LOI), 'loi'); }
  TV_DANG = false;
}
function damBaoThuVien() {
  if (TV_DANG || !FS.ketNoi || (TV && TV._daDoc) || TV_LOI) return;
  napThuVienCV(false).then(() => { if (TV) TV._daDoc = true; render(); });
}
const VD = () => { D.vongDoi ||= {}; D.vongDoi.buoc ||= {}; D.vongDoi.thuMuc ||= {}; return D.vongDoi; };
const buocTV = ma => TV?.buoc.find(b => b.ma === ma);
const viecCuaBuoc = ma => D.viec.filter(v => v.idcv === ma);
function ttBuoc(b) {
  const ds = viecCuaBuoc(b.ma);
  if (ds.length) {
    const st = ds.map(trangThai);
    if (st.every(s => s === 'Đã xong')) return 'Đã xong';
    if (st.includes('Chậm TĐ')) return 'Chậm TĐ';
    return st.some(s => s !== 'Chưa làm') ? 'Đang làm' : 'Chưa làm';
  }
  return VD().buoc[b.ma]?.tt || 'Chưa làm';
}
const LOP_BUOC = { ...LOP_TT, 'Không áp dụng': 'st-chua' };
function ttNhom(ds) {
  const st = ds.map(ttBuoc).filter(s => s !== 'Không áp dụng');
  if (!st.length) return 'Không áp dụng';
  if (st.every(s => s === 'Đã xong')) return 'Đã xong';
  if (st.includes('Chậm TĐ')) return 'Chậm TĐ';
  return st.some(s => s !== 'Chưa làm') ? 'Đang làm' : 'Chưa làm';
}
function demGiaiDoan(ds) {
  const st = ds.map(ttBuoc), ad = st.filter(s => s !== 'Không áp dụng');
  return { tong: ds.length, apDung: ad.length, xong: ad.filter(s => s === 'Đã xong').length, kad: st.length - ad.length, pct: ad.length ? Math.round(ad.filter(s => s === 'Đã xong').length / ad.length * 100) : 100 };
}
function nhomTheoGD() {
  const kq = new Map();
  for (const g of TV?.giaiDoan || []) kq.set(g, new Map());
  for (const b of [...(TV?.buoc || [])].sort((a, c) => a.stt - c.stt)) {
    if (!kq.has(b.giaiDoan)) kq.set(b.giaiDoan, new Map());
    const m = kq.get(b.giaiDoan); if (!m.has(b.nhom)) m.set(b.nhom, []); m.get(b.nhom).push(b);
  }
  return kq;
}
const thuMucNhom = n => VD().thuMuc[n] ?? TV?.goiYThuMuc?.[n] ?? '';
function fileTrong(duong) {
  if (!duong || !CHI_MUC?.files) return null;
  const goc = nfc(duong).replace(/\\+$/, '') + '\\';
  return CHI_MUC.files.filter(f => nfc(f.p).startsWith(goc) && !/\\9[89]\. /.test(nfc(f.p).slice(goc.length - 1)));
}
// Tiến độ theo nhóm việc của dự án (A–H): % theo thời lượng.
function tienDoNhomViec(ma) {
  const ds = D.viec.filter(v => v.nhom === ma && hopLeNgay(v.batDau) && hopLeNgay(v.ketThuc));
  const w = v => Math.max(1, khoang(v.batDau, v.ketThuc) + 1), tw = ds.reduce((s, v) => s + w(v), 0) || 1;
  return {
    ds, xong: ds.filter(v => trangThai(v) === 'Đã xong').length, cham: ds.filter(v => trangThai(v) === 'Chậm TĐ').length,
    thucTe: Math.round(ds.reduce((s, v) => s + w(v) * pctThucTe(v), 0) / tw), keHoach: Math.round(ds.reduce((s, v) => s + w(v) * pctKeHoach(v), 0) / tw),
    bd: ds.reduce((a, v) => !a || v.batDau < a ? v.batDau : a, ''), kt: ds.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, ''),
  };
}

/* ------------------------------ GIAO DIỆN ------------------------------ */
function veToanBo() {
  damBaoThuVien();
  const gd = nhomTheoGD(), an = !!UI.vdAn;
  let dau = '';
  if (!TV) dau = `<div class="canh-hop">${!FS.ketNoi ? 'Kết nối thư mục dự án (Cài đặt → Google Drive) để nạp thư viện các bước chuẩn.'
    : TV_DANG ? 'Đang đọc thư viện…' : TV_LOI === 'chua-co' ? `Chưa có file <code>${esc(D.caiDat.thuMucApp)}\\${TEP_THU_VIEN}</code> (thư viện công việc chuẩn). Nhờ Claude tạo file này rồi bấm Nạp lại.`
    : `Không đọc được thư viện: ${esc(TV_LOI)}`} <button class="nut nho" data-act="vd-nap">Nạp lại</button></div>`;
  const the = [...gd].map(([g, m]) => { const ds = [...m.values()].flat(), k = demGiaiDoan(ds); return `<div class="the"><span>${esc(g)}</span><b>${k.pct}%</b><span>${k.xong}/${k.apDung} bước xong${k.kad ? ` · ${k.kad} không áp dụng` : ''}</span><div class="thanh"><i style="width:${k.pct}%"></i></div></div>`; }).join('');
  const phan = [...gd].map(([g, m]) => {
    const ds = [...m.values()].flat(), k = demGiaiDoan(ds);
    const nhom = [...m].map(([n, bs]) => veNhomThuTuc(n, bs, an)).filter(Boolean).join('');
    return `<details class="vd-gd" ${k.pct < 100 ? 'open' : ''}><summary><b>${esc(g)}</b> <span class="muted nho">${m.size} nhóm thủ tục · ${k.xong}/${k.apDung} bước xong</span></summary>${nhom || '<p class="muted nho">Đã ẩn hết (đã xong hoặc không áp dụng).</p>'}</details>`;
  }).join('');
  const nv = D.nhom.map(n => {
    const t = tienDoNhomViec(n.ma); if (!t.ds.length) return '';
    return `<li class="click" data-act="vd-loc-nhom" data-v="${n.ma}" style="cursor:pointer"><b style="width:22px">${n.ma}</b><span class="fill">${esc(n.ten)}<br><span class="muted nho">${t.ds.length} việc · ${t.xong} xong${t.cham ? ` · <span style="color:var(--cham)">${t.cham} chậm</span>` : ''} · ${fmtNgay(t.bd)} – ${fmtNgay(t.kt)}</span>
      <div class="thanh"><i style="width:${t.thucTe}%"></i><i class="kh" style="width:${t.keHoach}%"></i></div></span><span class="chip ${t.thucTe >= t.keHoach ? 'st-xong' : 'st-cham'}">${t.thucTe}% / KH ${t.keHoach}%</span></li>`;
  }).join('');
  return `<h2>Toàn bộ dự án – các bước</h2>
  <p class="muted nho">Theo dõi từ chủ trương đầu tư, quy hoạch, đất đai, pháp lý xây dựng đến triển khai thi công và vận hành. Phần thủ tục lấy theo thư viện công việc chuẩn${TV?.buoc ? ` (${TV.buoc.length} bước)` : ''}; mỗi bước gắn với việc trong tab Tiến độ, hoặc tự đánh dấu trạng thái khi đã làm xong từ trước.</p>
  ${dau}
  ${TV ? `<div class="luoi kpi">${the}</div>` : ''}
  <div class="the" style="margin-bottom:12px"><h3>Triển khai thực hiện theo nhóm việc (tab Tiến độ)</h3><ul class="ds">${nv || '<li class="muted">Chưa có việc.</li>'}</ul><p class="muted nho">Thanh: % thực hiện theo thời lượng; vạch đỏ: kế hoạch đến hôm nay. Bấm một nhóm để mở Tiến độ đã lọc.</p></div>
  ${TV ? `<div class="cong-cu"><label class="nho"><input type="checkbox" data-loc="vdAn" ${an ? 'checked' : ''}> Ẩn nhóm đã xong / không áp dụng</label><span class="gian"></span><button class="nut nho" data-act="vd-nap">Nạp lại thư viện</button></div>${phan}` : ''}`;
}
function veNhomThuTuc(n, bs, an) {
  const st = ttNhom(bs); if (an && (st === 'Đã xong' || st === 'Không áp dụng')) return '';
  const tong = bs.reduce((s, b) => s + (b.soNgay || 0), 0), tm = thuMucNhom(n), fs = fileTrong(tm);
  const k = encodeURIComponent(n), mo = UI.vdMo === n, form = UI.vdForm === n;
  const conLai = bs.filter(b => !viecCuaBuoc(b.ma).length && !['Đã xong', 'Không áp dụng'].includes(ttBuoc(b)));
  const goiY = fs?.length && st === 'Chưa làm' ? `<p class="nho" style="color:var(--canh,#b26b00)">Thư mục hồ sơ đã có ${fs.length} file nhưng các bước còn "Chưa làm" – nếu đã xong từ trước, bấm "Đã xong cả nhóm".</p>` : '';
  const hang = bs.map(b => {
    const ds = viecCuaBuoc(b.ma), s = ttBuoc(b);
    const ttHtml = ds.length ? ds.map(v => `<a href="#" class="chip ${LOP_TT[trangThai(v)]}" data-act="mo-viec" data-id="${v.id}" title="${esc(v.ten)}">Việc ${v.tt} · ${trangThai(v)}</a> <button class="nut nho xoa" data-act="vd-bo-gan" data-id="${v.id}" title="Bỏ gắn">✕</button>`).join(' ')
      : `<select class="o nho" data-sua="vd" data-id="${esc(b.ma)}" data-f="tt">${TT_BUOC.map(x => `<option ${x === s ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    return `<tr><td class="nho muted">${esc(b.ma)}</td><td>${esc(b.ten)}${b.canCu ? `<br><span class="muted nho">${esc(b.canCu).replace(/\n/g, '; ')}</span>${window.ktlChip ? ktlChip(b.canCu) : ''}` : ''}</td>
      <td class="nho">${esc(b.chuTri)}${b.phoiHop && b.phoiHop !== b.chuTri ? ` / ${esc(b.phoiHop)}` : ''}</td><td class="nho">${esc(b.coQuan)}</td><td class="nho" style="text-align:right">${b.soNgay}</td>
      <td>${ttHtml}</td><td>${ds.length ? '' : `<select class="o nho" data-act-doi="vd-gan" data-ma="${esc(b.ma)}"><option value="">Gắn việc…</option>${goiYViec(b).map(v => `<option value="${v.id}">${v.tt}. ${esc(v.ten.slice(0, 50))}</option>`).join('')}</select>`}</td></tr>`;
  }).join('');
  return `<div class="the vd-nhom">
    <div class="cong-cu" style="margin:0"><b class="fill" style="flex:1;min-width:0">${esc(n)}</b><span class="chip ${LOP_BUOC[st]}">${st}</span>
      <span class="muted nho">${bs.length} bước · ~${tong} ngày${fs ? ` · ${fs.length} file hồ sơ` : ''}</span>
      <button class="nut nho" data-act="vd-mo" data-k="${k}">${mo ? 'Thu gọn' : 'Chi tiết'}</button></div>
    ${goiY}
    ${mo ? `<div style="overflow-x:auto"><table class="bang nho"><thead><tr><th>Mã</th><th>Công việc · căn cứ</th><th>Chủ trì / phối hợp</th><th>Cơ quan</th><th>Ngày</th><th>Trạng thái</th><th></th></tr></thead><tbody>${hang}</tbody></table></div>
    <div class="form" style="margin-top:8px"><label class="rong">Thư mục hồ sơ (tương đối từ thư mục dự án)<input data-sua="vdtm" data-id="${esc(n)}" data-f="p" value="${esc(tm)}" placeholder="VD: 02. Hồ sơ thực hiện dự án\\..."></label></div>
    ${fs?.length ? `<details><summary class="nho">${fs.length} file trong thư mục</summary>${fs.slice(0, 40).map(f => `<div class="the-vb"><span class="fill nho">${esc(nfc(f.p).slice(nfc(tm).length + 1))}</span><button class="nut nho" data-act="mo-file" data-p="${esc(f.p)}">Mở</button></div>`).join('')}${fs.length > 40 ? `<p class="muted nho">… và ${fs.length - 40} file khác.</p>` : ''}</details>` : ''}
    <div class="cong-cu"><button class="nut nho" data-act="vd-nhom-tt" data-k="${k}" data-v="Đã xong">Đã xong cả nhóm</button><button class="nut nho" data-act="vd-nhom-tt" data-k="${k}" data-v="Không áp dụng">Không áp dụng</button><button class="nut nho" data-act="vd-nhom-tt" data-k="${k}" data-v="Chưa làm">Đặt lại</button>
      ${conLai.length ? `<button class="nut nho chinh" data-act="vd-form" data-k="${k}">Đưa ${conLai.length} bước vào tiến độ…</button>` : ''}</div>
    ${form ? `<div class="form"><label>Bắt đầu từ ngày<input id="vd-ngay" type="date" value="${homNay()}"></label>
      <label>Nhóm việc<select id="vd-nhomviec">${D.nhom.map(g => `<option value="${g.ma}">${g.ma}. ${esc(g.ten)}</option>`).join('')}</select></label>
      <label class="rong nho muted">Tạo ${conLai.length} việc nối tiếp nhau (xong mới làm) theo số ngày chuẩn; ghi chủ trì, cơ quan và căn cứ vào việc. Bước đã gắn việc, đã xong hoặc không áp dụng thì bỏ qua.</label></div>
      <div class="cong-cu"><button class="nut chinh" data-act="vd-tao" data-k="${k}">Tạo việc</button><button class="nut" data-act="vd-form" data-k="">Huỷ</button></div>` : ''}` : ''}
  </div>`;
}
// Gợi ý việc có sẵn để gắn: xếp theo số từ trùng với tên bước.
function goiYViec(b) {
  const pho = new Set('lập hồ sơ các và của cho với theo trình phê duyệt thẩm định tra đơn vị lựa chọn tư vấn báo cáo lần hoàn thiện tổng hợp ý kiến'.split(' '));
  const tu = s => new Set(nfc(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !pho.has(w)));
  const a = tu(b.ten), n = tu(b.nhom);
  return D.viec.filter(v => !v.idcv).map(v => { const t = tu(v.ten); let d = 0; for (const w of new Set([...a, ...n])) if (t.has(w)) d += a.has(w) ? 2 : 1; return [d, v]; })
    .sort((x, y) => y[0] - x[0] || x[1].tt - y[1].tt).slice(0, 25).map(x => x[1]);
}
function taoViecTuNhom(n, batDau, nhomViec) {
  const bs = nhomTheoGDPhang().filter(b => b.nhom === n && !viecCuaBuoc(b.ma).length && !['Đã xong', 'Không áp dụng'].includes(ttBuoc(b)));
  if (!bs.length || !hopLeNgay(batDau)) return 0;
  let ngay = batDau, truoc = null, tt = Math.max(0, ...D.viec.map(v => v.tt));
  const luc = new Date().toISOString();
  for (const b of bs) {
    const soNgay = Math.max(1, b.soNgay || 1), ketThuc = congNgay(ngay, soNgay - 1);
    const v = { id: uid('v'), tt: ++tt, nhom: nhomViec, ten: b.ten, batDau: ngay, ketThuc, soNgay, chuTri: b.chuTri || '', phoiHop: [b.phoiHop !== b.chuTri ? b.phoiHop : '', b.coQuan].filter(Boolean).join(', '),
      ghiChu: [`Thủ tục chuẩn ${b.ma} – ${b.nhom}`, b.coQuan ? `Cơ quan: ${b.coQuan}` : '', b.canCu ? `Căn cứ: ${b.canCu.replace(/\n/g, '; ')}` : ''].filter(Boolean).join('. '),
      moc: '', trangThai: 'Chưa làm', pct: 0, giaoCho: '', idcv: b.ma, phuThuoc: truoc ? [{ id: truoc, kieu: 'FS' }] : [], checklist: [], vanBan: [], nhatKy: [{ luc, noiDung: `Tạo từ thư viện bước chuẩn (${b.ma})` }], canXacNhan: false };
    D.viec.push(v); truoc = v.id; ngay = congNgay(ketThuc, 1);
  }
  ghiNhatKyChung(`Đưa ${bs.length} bước "${n}" vào tiến độ từ ${fmtNgay(batDau)}`);
  return bs.length;
}
const nhomTheoGDPhang = () => [...(TV?.buoc || [])].sort((a, c) => a.stt - c.stt);

(window.VE_THEM ||= {})['toan-bo'] = veToanBo;
window.SUA_THEM ||= {};
Object.assign(window.SUA_THEM, {
  vd(el, ma, f, gt) { const x = VD().buoc; if (gt === 'Chưa làm') delete x[ma]; else x[ma] = { tt: gt, ngay: homNay() }; },
  vdtm(el, n, f, gt) { const t = gt.trim().replace(/^[\\/]+|[\\/]+$/g, '').replace(/\//g, '\\'); if (!t || t === (TV?.goiYThuMuc?.[n] || '')) delete VD().thuMuc[n]; else VD().thuMuc[n] = t; },
});
// select "Gắn việc…" dùng data-act-doi (đổi giá trị) để không vướng sự kiện click
document.addEventListener('change', e => {
  const el = e.target; if (el.dataset?.actDoi !== 'vd-gan' || !el.value) return;
  const v = viec(el.value), b = buocTV(el.dataset.ma); if (!v || !b) return;
  v.idcv = b.ma; v.nhatKy.push({ luc: new Date().toISOString(), noiDung: `Gắn với thủ tục chuẩn ${b.ma} – ${b.ten}` });
  luu(); render();
});

/* ------------------------- DỜI DÂY CHUYỀN (xem trước) ------------------------- */
function viecNoiSau() {
  const m = new Map();
  for (const v of D.viec) for (const p of v.phuThuoc || []) { if (!m.has(p.id)) m.set(p.id, []); m.get(p.id).push({ s: v.id, kieu: p.kieu || 'FS' }); }
  return m;
}
function tinhDoiChuyen(id) {
  const sau = viecNoiSau(), moi = new Map(), vuong = [];
  const lay = v => moi.get(v.id) || { bd: v.batDau, kt: v.ketThuc };
  const q = [id]; let vong = 0;
  while (q.length && vong++ < 20000) {
    const t = viec(q.shift()); if (!t) continue; const T = lay(t);
    for (const { s, kieu } of sau.get(t.id) || []) {
      const sv = viec(s); if (!sv || !hopLeNgay(sv.batDau)) continue;
      const S = lay(sv), can = kieu === 'SS' ? T.bd : congNgay(T.kt, 1);
      if (S.bd >= can) continue;
      if (trangThai(sv) === 'Đã xong') { vuong.push(`Việc ${sv.tt}. ${sv.ten} đã xong nhưng bắt đầu trước khi việc ${t.tt} ${kieu === 'SS' ? 'bắt đầu' : 'xong'} – kiểm tra lại ngày thực tế.`); continue; }
      moi.set(s, { bd: can, kt: congNgay(can, khoang(S.bd, S.kt)) }); q.push(s);
    }
  }
  const ds = [...moi].map(([i, x]) => { const v = viec(i); return { id: i, tt: v.tt, ten: v.ten, bdCu: v.batDau, ktCu: v.ketThuc, bd: x.bd, kt: x.kt, lui: khoang(v.ketThuc, x.kt) }; }).sort((a, b) => a.tt - b.tt);
  const ktMoi = v => moi.get(v.id)?.kt || v.ketThuc;
  const moc = D.moc.map(m => {
    const vs = (m.viec || []).map(viec).filter(Boolean); if (!vs.length || !vs.some(v => moi.has(v.id)) || !hopLeNgay(m.han)) return null;
    const kt = vs.reduce((a, v) => ktMoi(v) > a ? ktMoi(v) : a, ''), ktCu = vs.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, '');
    return kt > m.han && kt > ktCu ? { id: m.id, han: m.han, kt, tre: khoang(m.han, kt), treCu: Math.max(0, khoang(m.han, ktCu)) } : null;
  }).filter(Boolean);
  const hop = D.viec.filter(v => hopLeNgay(v.ketThuc)), cuoiCu = hop.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, ''), cuoiMoi = hop.reduce((a, v) => ktMoi(v) > a ? ktMoi(v) : a, '');
  return { goc: id, ds, vuong, moc, cuoiCu, cuoiMoi };
}
const _suaTruongVD = suaTruong;
suaTruong = function (el) {
  const { sua, id, f } = el.dataset;
  _suaTruongVD(el);
  if (sua === 'viec' && /^(batDau|ketThuc|soNgay)$/.test(f)) { const pv = tinhDoiChuyen(id); UI.doiChuyen = pv.ds.length || pv.vuong.length ? pv : null; }
};
function veDoiChuyen(pv) {
  if (!pv) return '';
  return `<div class="canh-hop nho"><b>Dời dây chuyền – xem trước</b>
    ${pv.ds.length ? `<p style="margin:4px 0">Ngày mới của việc này làm <b>${pv.ds.length} việc nối sau</b> bị vướng. Nếu áp dụng sẽ dời:</p>
      <ul style="margin:0 0 6px 18px;padding:0">${pv.ds.slice(0, 30).map(x => `<li>${x.tt}. ${esc(x.ten.slice(0, 60))}: ${fmtNgay(x.bdCu)}–${fmtNgay(x.ktCu)} → <b>${fmtNgay(x.bd)}–${fmtNgay(x.kt)}</b> (lùi ${x.lui} ngày)</li>`).join('')}${pv.ds.length > 30 ? `<li>… và ${pv.ds.length - 30} việc khác</li>` : ''}</ul>` : ''}
    ${pv.moc.map(m => `<div style="color:var(--cham)">Mốc ${esc(m.id)} hạn ${fmtNgay(m.han)}: ${m.treCu ? `đang trễ ${m.treCu} ngày, sẽ trễ ${m.tre} ngày` : `sẽ trễ ${m.tre} ngày`} (xong ${fmtNgay(m.kt)}).</div>`).join('')}
    ${pv.cuoiMoi > pv.cuoiCu ? `<div>Ngày hoàn thành toàn bộ tiến độ: ${fmtNgay(pv.cuoiCu)} → <b>${fmtNgay(pv.cuoiMoi)}</b>.</div>` : ''}
    ${pv.vuong.map(t => `<div>${esc(t)}</div>`).join('')}
    <div class="cong-cu" style="margin-top:6px">${pv.ds.length ? `<button class="nut nho chinh" data-act="vd-doi-ap">Áp dụng dời ${pv.ds.length} việc</button>` : ''}<button class="nut nho" data-act="vd-doi-bo">Để nguyên</button></div></div>`;
}

/* ------------------------------- ĐƯỜNG GĂNG ------------------------------- */
// Lùi từ ngày kết thúc muộn nhất: hạn muộn nhất (LF) của mỗi việc theo các việc nối sau; dự trữ = LF − ngày kết thúc kế hoạch.
function tinhDuongGang() {
  const ds = D.viec.filter(v => hopLeNgay(v.batDau) && hopLeNgay(v.ketThuc));
  if (!ds.length) return { duTru: new Map(), gang: new Set(), soLienKet: 0 };
  const cuoi = ds.reduce((a, v) => v.ketThuc > a ? v.ketThuc : a, ds[0].ketThuc);
  const sau = viecNoiSau(), lf = new Map(), dang = new Set();
  const dai = v => Math.max(1, khoang(v.batDau, v.ketThuc) + 1);
  const tinh = v => {
    if (lf.has(v.id)) return lf.get(v.id);
    if (dang.has(v.id)) return cuoi; dang.add(v.id);
    let r = cuoi;
    for (const { s, kieu } of sau.get(v.id) || []) {
      const sv = viec(s); if (!sv || !hopLeNgay(sv.batDau) || !hopLeNgay(sv.ketThuc)) continue;
      const lsS = congNgay(tinh(sv), -(dai(sv) - 1));
      const c = kieu === 'SS' ? congNgay(lsS, dai(v) - 1) : congNgay(lsS, -1);
      if (c < r) r = c;
    }
    dang.delete(v.id); lf.set(v.id, r); return r;
  };
  const duTru = new Map(), gang = new Set();
  for (const v of ds) { const d = khoang(v.ketThuc, tinh(v)); duTru.set(v.id, d); if (d <= 0 && trangThai(v) !== 'Đã xong') gang.add(v.id); }
  return { duTru, gang, soLienKet: D.viec.reduce((s, v) => s + (v.phuThuoc?.length || 0), 0) };
}
const _veGanttVD = veGantt;
veGantt = function (ds) {
  let html = _veGanttVD(ds);
  const bat = !!UI.duongGang;
  const cg = bat ? tinhDuongGang() : null;
  if (cg) for (const id of cg.gang) html = html.split(`class="g-row" data-act="mo-viec" data-id="${id}"`).join(`class="g-row g-gang" data-act="mo-viec" data-id="${id}"`);
  const nut = `<div class="cong-cu nho" style="margin:0 0 6px"><button class="nut nho ${bat ? 'chinh' : ''}" data-act="td-gang" title="Tô các việc quyết định ngày hoàn thành (dự trữ 0 ngày)">${bat ? '✓ ' : ''}Đường găng</button>
    ${cg ? `<span class="muted">${cg.gang.size} việc trên đường găng (viền đỏ).${cg.soLienKet ? ` Tính theo ${cg.soLienKet} liên kết phụ thuộc.` : ' Chưa có liên kết phụ thuộc nên chỉ gồm việc kết thúc muộn nhất – nối phụ thuộc trong từng việc (hoặc khi đưa thủ tục chuẩn vào tiến độ) để có kết quả đúng.'}</span>` : ''}</div>`;
  return nut + html;
};

/* --------------------------- KHUNG VIỆC (drawer) --------------------------- */
const _drawerViecVD = drawerViec;
drawerViec = function (id) {
  const h = _drawerViecVD(id); if (!h) return h;
  const v = viec(id), b = v.idcv ? buocTV(v.idcv) : null;
  const sau = (viecNoiSau().get(id) || []).map(x => viec(x.s)).filter(Boolean);
  const cg = sau.length || v.phuThuoc.length ? tinhDuongGang() : null, dt = cg?.duTru.get(id);
  let them = UI.doiChuyen?.goc === id ? veDoiChuyen(UI.doiChuyen) : '';
  if (v.idcv) them += `<div class="the-vb nho" style="display:block"><b>Thủ tục chuẩn ${esc(v.idcv)}</b>${b ? ` – ${esc(b.nhom)} (${esc(b.giaiDoan)})<br>Chủ trì ${esc(b.chuTri)}${b.phoiHop && b.phoiHop !== b.chuTri ? `, phối hợp ${esc(b.phoiHop)}` : ''}${b.coQuan ? ` · Cơ quan: ${esc(b.coQuan)}` : ''} · chuẩn ${b.soNgay} ngày${b.canCu ? `<br>Căn cứ: ${esc(b.canCu).replace(/\n/g, '; ')}${window.ktlChip ? ktlChip(b.canCu) : ''}` : ''}` : TV ? ' <span style="color:var(--cham)">(mã không có trong thư viện)</span>' : ''}
    <br><a href="#" data-act="den" data-view="toan-bo">Xem trong Toàn bộ dự án</a> · <a href="#" data-act="vd-bo-gan" data-id="${id}">Bỏ gắn</a></div>`;
  if (sau.length || dt != null && v.phuThuoc.length) them += `<p class="nho muted">${sau.length ? `Việc nối sau: ${sau.map(x => `<a href="#" data-act="mo-viec" data-id="${x.id}">${x.tt}</a>`).join(', ')}. ` : ''}${dt != null ? `Dự trữ ${dt} ngày${dt <= 0 && trangThai(v) !== 'Đã xong' ? ' – <b style="color:var(--cham)">nằm trên đường găng</b>' : ''}.` : ''} ${sau.length ? `<a href="#" data-act="vd-doi-xem" data-id="${id}">Kiểm tra dời dây chuyền</a>` : ''}</p>`;
  return them ? h.replace('<div class="form">', them + '<div class="form">') : h;
};

/* ------------------------- TỔNG QUAN + KIỂM TRA ------------------------- */
const _veTongQuanVD = veTongQuan;
veTongQuan = function () {
  const h = _veTongQuanVD(); damBaoThuVien();
  if (!TV) return h;
  const gd = nhomTheoGD();
  const the = `<div class="the" style="margin-bottom:12px"><h3>Toàn bộ dự án – thủ tục theo giai đoạn <a class="nho" href="#" data-act="den" data-view="toan-bo">Xem chi tiết</a></h3>
    <div class="luoi kpi" style="margin:0">${[...gd].map(([g, m]) => { const k = demGiaiDoan([...m.values()].flat()); const dang = [...m].filter(([, bs]) => ['Đang làm', 'Chậm TĐ'].includes(ttNhom(bs))).map(([n]) => n); return `<div><span class="nho">${esc(g)}</span> <b>${k.pct}%</b><div class="thanh"><i style="width:${k.pct}%"></i></div><span class="muted nho">${k.xong}/${k.apDung} bước${dang.length ? ` · đang: ${esc(dang.slice(0, 2).join(', '))}${dang.length > 2 ? '…' : ''}` : ''}</span></div>`; }).join('')}</div></div>`;
  const i = h.indexOf('<div class="luoi hai">');
  return i < 0 ? h + the : h.slice(0, i) + the + h.slice(i);
};
const _kiemTraVD = kiemTraSoLieu;
kiemTraSoLieu = function () {
  const kq = _kiemTraVD();
  if (TV) for (const v of D.viec) if (v.idcv && !buocTV(v.idcv)) kq.push({ muc: 'Toàn bộ dự án', mucDo: 'canh', nd: `Việc ${v.tt}: mã thủ tục ${v.idcv} không có trong thư viện.`, act: 'mo-viec', id: v.id });
  const cg = tinhDuongGang();
  if (cg.soLienKet) for (const id of cg.gang) { const v = viec(id); if (trangThai(v) === 'Chậm TĐ') kq.push({ muc: 'Tiến độ', mucDo: 'loi', nd: `Việc ${v.tt}. ${v.ten} nằm trên đường găng và đang chậm – mỗi ngày chậm làm lùi ngày hoàn thành.`, act: 'mo-viec', id }); }
  return kq;
};

Object.assign(HD, {
  'vd-nap'() { TV_LOI = ''; napThuVienCV(true).then(() => { if (TV) TV._daDoc = true; render(); }); },
  'vd-mo'(el) { const n = decodeURIComponent(el.dataset.k); UI.vdMo = UI.vdMo === n ? null : n; UI.vdForm = null; render(); },
  'vd-form'(el) { UI.vdForm = el.dataset.k ? decodeURIComponent(el.dataset.k) : null; render(); },
  'vd-nhom-tt'(el) {
    const n = decodeURIComponent(el.dataset.k), tt = el.dataset.v, x = VD().buoc;
    const bs = nhomTheoGDPhang().filter(b => b.nhom === n && !viecCuaBuoc(b.ma).length);
    for (const b of bs) { if (tt === 'Chưa làm') delete x[b.ma]; else x[b.ma] = { tt, ngay: homNay() }; }
    ghiNhatKyChung(`Toàn bộ dự án: "${n}" – ${bs.length} bước đặt "${tt}"`); luu(); render();
  },
  'vd-tao'(el) {
    const n = decodeURIComponent(el.dataset.k), so = taoViecTuNhom(n, $('#vd-ngay').value, $('#vd-nhomviec').value);
    if (!so) return thongBao('Không có bước nào để tạo (hoặc ngày không hợp lệ).', 'canh');
    UI.vdForm = null; luu(); render(); thongBao(`Đã tạo ${so} việc trong tab Tiến độ.`);
  },
  'vd-bo-gan'(el) { const v = viec(el.dataset.id); if (!v) return; v.nhatKy.push({ luc: new Date().toISOString(), noiDung: `Bỏ gắn thủ tục chuẩn ${v.idcv}` }); delete v.idcv; luu(); render(); },
  'vd-loc-nhom'(el) { UI.locNhom = el.dataset.v; UI.view = 'tien-do'; render(); },
  'td-gang'() { UI.duongGang = !UI.duongGang; render(); },
  'vd-doi-xem'(el) { const pv = tinhDoiChuyen(el.dataset.id); UI.doiChuyen = pv; if (!pv.ds.length && !pv.vuong.length) { UI.doiChuyen = null; thongBao('Các việc nối sau không bị vướng.'); } veDrawer(); },
  'vd-doi-bo'() { UI.doiChuyen = null; veDrawer(); },
  'vd-doi-ap'() {
    const pv = UI.doiChuyen; if (!pv) return;
    const luc = new Date().toISOString(), goc = viec(pv.goc);
    for (const x of pv.ds) { const v = viec(x.id); if (!v) continue; v.nhatKy.push({ luc, noiDung: `Dời dây chuyền theo việc ${goc?.tt}: ${fmtNgay(v.batDau)}–${fmtNgay(v.ketThuc)} → ${fmtNgay(x.bd)}–${fmtNgay(x.kt)}` }); v.batDau = x.bd; v.ketThuc = x.kt; v.soNgay = khoang(x.bd, x.kt) + 1; }
    ghiNhatKyChung(`Dời dây chuyền ${pv.ds.length} việc nối sau việc ${goc?.tt}. ${goc?.ten || ''}`);
    UI.doiChuyen = null; luu(); render(); thongBao(`Đã dời ${pv.ds.length} việc.`);
  },
});
