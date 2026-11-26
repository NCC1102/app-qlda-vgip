/* =====================================================================
   Kết nối trực tiếp Google Drive (không cần cài Google Drive trên máy; dùng được trên điện thoại).
   - Đăng nhập bằng Google Identity Services (OAuth trên trình duyệt, không có máy chủ trung gian).
   - Thư mục/file Drive được bọc thành "handle" giống File System Access API (entries, getDirectoryHandle,
     getFileHandle, getFile, createWritable), nên phần còn lại của app dùng chung một cách đọc/ghi.
   - Client ID do người dùng tạo trong Google Cloud Console, lưu ở trình duyệt (không có trong repo).
   ===================================================================== */
const GD_SCOPE = 'https://www.googleapis.com/auth/drive';
const GD_FOLDER = 'application/vnd.google-apps.folder';
const GD_API = 'https://www.googleapis.com/drive/v3/files';
// Client ID mặc định của app QLDA VGIP (không phải mật khẩu: Google chỉ chấp nhận từ https://ncc1102.github.io và tài khoản trong danh sách Test users).
const GD_CLIENT_ID_MAC_DINH = '398259192450-7tigs167ucv4c0n4pmp2s5v1a4fknqmp.apps.googleusercontent.com';
const GD_TEN_THU_MUC = '(1. VGIP) KCN Văn Giang';
const GD = { clientId: LS.lay('gd-client-id', '') || GD_CLIENT_ID_MAC_DINH, token: null, het: 0, tc: null, choToken: null };

function napScript(src) {
  return new Promise((ok, loi) => {
    if ([...document.scripts].some(s => s.src === src)) return ok();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => loi(new Error('không tải được ' + src)); document.head.appendChild(s);
  });
}
// Xin access token (1 giờ). Lần đầu hiện cửa sổ đăng nhập/cấp quyền; các lần sau thường tự đóng ngay.
async function gdLayToken(nhacLai = false) {
  if (!GD.clientId) throw new Error('Chưa nhập Client ID (Cài đặt → Google Drive).');
  await napScript('https://accounts.google.com/gsi/client');
  if (!GD.tc || GD.tc.cid !== GD.clientId) {
    GD.tc = google.accounts.oauth2.initTokenClient({ client_id: GD.clientId, scope: GD_SCOPE, callback: () => { } });
    GD.tc.cid = GD.clientId;
  }
  if (GD.choToken) return GD.choToken;
  GD.choToken = new Promise((ok, loi) => {
    GD.tc.callback = r => { GD.choToken = null; if (r.error) return loi(new Error(r.error_description || r.error)); GD.token = r.access_token; GD.het = Date.now() + (r.expires_in || 3600) * 1000; ok(GD.token); };
    GD.tc.error_callback = e => { GD.choToken = null; loi(new Error(e.message || e.type || 'đăng nhập bị huỷ')); };
    GD.tc.requestAccessToken({ prompt: nhacLai ? 'consent' : '' });
  });
  return GD.choToken;
}
async function gdFetch(url, opt = {}, lan = 0) {
  if (!GD.token || Date.now() > GD.het - 60000) await gdLayToken();
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + GD.token } });
  if (r.status === 401 && lan === 0) { GD.token = null; return gdFetch(url, opt, 1); }
  if ((r.status === 429 || r.status >= 500) && lan < 3) { await new Promise(x => setTimeout(x, 800 * (lan + 1))); return gdFetch(url, opt, lan + 1); }
  if (!r.ok) { let m = r.status + ''; try { m = (await r.json()).error?.message || m; } catch { } throw new Error('Google Drive: ' + m); }
  return r;
}
const gdJson = async (url, opt) => (await gdFetch(url, opt)).json();
const gdQ = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const GD_FIELDS = 'id,name,mimeType,size,modifiedTime,webViewLink';
const GD_CHUNG = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

// File "lười": chỉ tải nội dung khi cần (quét thư mục chỉ đọc tên, kích thước, ngày sửa).
class GDLazyFile {
  constructor(m) { this.name = m.name; this.size = +m.size || 0; this.lastModified = Date.parse(m.modifiedTime) || 0; this.type = m.mimeType || ''; this._id = m.id; }
  async blob() { return (await gdFetch(`${GD_API}/${this._id}?alt=media&supportsAllDrives=true`)).blob(); }
  async text() { return (await this.blob()).text(); }
  async arrayBuffer() { return (await this.blob()).arrayBuffer(); }
}
class GDFile {
  constructor(m) { this.kind = 'file'; this.isDrive = true; this.m = m; this.name = m.name; this.id = m.id; }
  async getFile() { return new GDLazyFile(this.m); }
  async createWritable() {
    const phan = [], self = this;
    return {
      async write(d) { phan.push(d); },
      async close() {
        const m = await gdJson(`https://www.googleapis.com/upload/drive/v3/files/${self.id}?uploadType=media&fields=${GD_FIELDS}&supportsAllDrives=true`, { method: 'PATCH', body: new Blob(phan) });
        self.m = m;
      },
    };
  }
  get link() { return this.m.webViewLink || `https://drive.google.com/file/d/${this.id}/view`; }
}
class GDDir {
  constructor(id, name) { this.kind = 'directory'; this.isDrive = true; this.id = id; this.name = name; }
  async *entries() {
    let tk = '';
    do {
      const q = encodeURIComponent(`'${this.id}' in parents and trashed=false`);
      const r = await gdJson(`${GD_API}?q=${q}&fields=nextPageToken,files(${GD_FIELDS})&pageSize=1000&${GD_CHUNG}${tk ? '&pageToken=' + tk : ''}`);
      for (const f of r.files || []) yield [f.name, f.mimeType === GD_FOLDER ? new GDDir(f.id, f.name) : new GDFile(f)];
      tk = r.nextPageToken || '';
    } while (tk);
  }
  async _tim(ten, laThuMuc) {
    const q = encodeURIComponent(`'${this.id}' in parents and trashed=false and name='${gdQ(ten)}' and mimeType${laThuMuc ? '=' : '!='}'${GD_FOLDER}'`);
    const r = await gdJson(`${GD_API}?q=${q}&fields=files(${GD_FIELDS})&pageSize=10&${GD_CHUNG}`);
    return r.files?.[0] || null;
  }
  async getDirectoryHandle(ten, { create = false } = {}) {
    const f = await this._tim(ten, true); if (f) return new GDDir(f.id, f.name);
    if (!create) throw new DOMException(`Không thấy thư mục "${ten}"`, 'NotFoundError');
    const m = await gdJson(`${GD_API}?fields=${GD_FIELDS}&supportsAllDrives=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ten, mimeType: GD_FOLDER, parents: [this.id] }) });
    return new GDDir(m.id, m.name);
  }
  async getFileHandle(ten, { create = false } = {}) {
    const f = await this._tim(ten, false); if (f) return new GDFile(f);
    if (!create) throw new DOMException(`Không thấy file "${ten}"`, 'NotFoundError');
    const m = await gdJson(`${GD_API}?fields=${GD_FIELDS}&supportsAllDrives=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: ten, parents: [this.id] }) });
    return new GDFile(m);
  }
  async queryPermission() { return GD.token && Date.now() < GD.het ? 'granted' : 'prompt'; }
  async requestPermission() { await gdLayToken(); return 'granted'; }
}

// Lấy ID thư mục từ link Drive (…/folders/<id>, ?id=<id>) hoặc ID dán trực tiếp.
function gdIdTuLink(s) {
  s = String(s || '').trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : '';
}
async function ketNoiDrive(info) {
  GD.choToken = null;
  try {
    if (!GD.token || Date.now() > GD.het - 60000) await gdLayToken();
    const m = await gdJson(`${GD_API}/${info.id}?fields=id,name,mimeType&supportsAllDrives=true`);
    if (m.mimeType !== GD_FOLDER) return thongBao('Link này không phải thư mục Google Drive.', 'loi');
    await KHO.dat('drive', { id: m.id, name: m.name }); await KHO.dat('thu-muc', null);
    await ketNoiThuMuc(new GDDir(m.id, m.name));
    thongBao(`Đã kết nối Google Drive: ${m.name}. Bấm "Quét hồ sơ" để lập chỉ mục file.`, '', 6000);
  } catch (e) { thongBao('Không kết nối được Google Drive: ' + e.message, 'loi', 8000); FS.canKetNoiLai = !!(await KHO.lay('drive')); veDongBo(); }
}

// Quét Drive song song (mỗi thư mục một lệnh liệt kê, tối đa 6 lệnh cùng lúc). Không tải nội dung file.
async function quetDrive() {
  const files = [], tenApp = D.caiDat.thuMucApp, hang = [[FS.goc, '']], thuMuc = { [FS.goc.id]: '' }; let dangChay = 0, loi = null;
  thongBao('Đang quét Google Drive…');
  // Mốc thay đổi của Drive lấy TRƯỚC khi quét: lần sau chỉ cần hỏi các thay đổi từ mốc này (quét tăng dần).
  let mocDoi = ''; try { mocDoi = (await gdJson('https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true')).startPageToken || ''; } catch { }
  await new Promise(xong => {
    const chay = () => {
      if (loi || (!hang.length && !dangChay)) return xong();
      while (dangChay < 6 && hang.length) {
        const [dir, tienTo] = hang.shift(); dangChay++;
        (async () => {
          for await (const [ten, e] of dir.entries()) {
            if (ten.startsWith('.') || ten.startsWith('~$') || /^(desktop\.ini|thumbs\.db)$/i.test(ten)) continue;
            const p = tienTo ? tienTo + '\\' + ten : ten;
            if (e.kind === 'directory') { if (!(tienTo === '' && ten === tenApp)) { hang.push([e, p]); thuMuc[e.id] = nfc(p); } }
            else { files.push({ p: nfc(p), kb: Math.round((+e.m.size || 0) / 1024), sua: ngayTuMs(Date.parse(e.m.modifiedTime) || 0), id: e.id }); if (files.length % 500 === 0) thongBao(`Đang quét… ${files.length} file`, '', 1200); }
          }
        })().catch(e => { loi = e; }).finally(() => { dangChay--; chay(); });
      }
    };
    chay();
  });
  if (loi) return thongBao('Lỗi khi quét Google Drive: ' + loi.message, 'loi', 8000);
  files.sort((a, b) => a.p.localeCompare(b.p, 'vi'));
  CHI_MUC = { ngayQuet: new Date().toISOString(), goc: FS.goc.name, gocId: FS.goc.id, nguon: 'google-drive', files, thuMuc, mocDoi };
  await KHO.dat('chi-muc', CHI_MUC);
  try { await ghiJson(FS.app, 'chi-muc-ho-so.json', CHI_MUC); } catch { }
  thongBao(`Đã quét ${files.length.toLocaleString('vi-VN')} file trên Google Drive.`); render();
}
// Mở file trên Drive: dùng trình xem của Google (xem được PDF, Word, Excel, ảnh… cả trên điện thoại).
async function moFileDrive(rel) {
  const w = window.open('', '_blank');
  try {
    const id = CHI_MUC?.files?.find(f => nfc(f.p) === nfc(rel))?.id;
    let link = id ? `https://drive.google.com/file/d/${id}/view` : '';
    if (!link) {
      const phan = rel.split('\\').filter(Boolean); let dir = FS.goc;
      for (const p of phan.slice(0, -1)) dir = await conTheoTen(dir, p, 'dir');
      link = (await conTheoTen(dir, phan[phan.length - 1], 'file')).link;
    }
    if (w) w.location = link; else window.open(link, '_blank');
  } catch (e) { if (w) w.close(); thongBao('Không mở được file trên Drive (có thể đã đổi tên/di chuyển): ' + e.message, 'loi', 6000); }
}

function veCaiDatDrive() {
  const dangDrive = FS.goc?.isDrive;
  return `<div class="the"><h3>Google Drive (kết nối trực tiếp – dùng được trên điện thoại)</h3>
    <p class="nho">${dangDrive ? `<span class="chip st-xong">Đang dùng Google Drive</span> <b>${esc(FS.goc.name)}</b>` : FS.driveCho ? `<span class="chip st-canh">Cần đăng nhập lại</span> ${esc(FS.driveCho.name)}` : 'Không cần cài Google Drive trên máy. Đăng nhập Google ngay trong app, app đọc/ghi thẳng thư mục dự án trên Drive.'}</p>
    <div class="form">
      <label class="rong">OAuth Client ID (tạo một lần trong Google Cloud Console – xem hướng dẫn)<input id="gd-cid" value="${esc(GD.clientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com"></label>
      <label class="rong">Link thư mục dự án trên Google Drive (để trống: app tự tìm thư mục "${esc(GD_TEN_THU_MUC)}")<input id="gd-link" value="${esc(LS.lay('gd-link', ''))}" placeholder="https://drive.google.com/drive/folders/…"></label>
    </div>
    <div class="cong-cu" style="margin-top:8px"><button class="nut chinh" data-act="gd-ket-noi">${dangDrive ? 'Kết nối lại' : 'Đăng nhập Google và kết nối'}</button>${dangDrive ? '<button class="nut" data-act="quet">Quét hồ sơ</button><button class="nut" data-act="gd-ngat">Ngắt Google Drive</button>' : ''}</div>
    <p class="muted nho">Mở thư mục <b>(1. VGIP) KCN Văn Giang</b> trên drive.google.com, chép link trên thanh địa chỉ dán vào ô trên. App chỉ lưu dữ liệu vào thư mục con <b>${esc(D.caiDat.thuMucApp)}</b> và thêm file mới khi bạn chọn; không sửa, không xoá hồ sơ khác. Mỗi lần mở app cần bấm "Kết nối lại" (Google cấp quyền theo phiên 1 giờ, tự gia hạn khi đang dùng).</p></div>`;
}

Object.assign(HD, {
  async 'gd-ket-noi'() {
    GD.choToken = null; // lần bấm trước bị chặn cửa sổ/huỷ thì không chờ mãi
    const cid = ($('#gd-cid')?.value || GD.clientId).trim(), link = ($('#gd-link')?.value || LS.lay('gd-link', '')).trim();
    if (!/\.apps\.googleusercontent\.com$/.test(cid)) return thongBao('Client ID chưa đúng (dạng …apps.googleusercontent.com).', 'canh', 6000);
    GD.clientId = cid; if (cid !== GD_CLIENT_ID_MAC_DINH) LS.dat('gd-client-id', cid); if (link) LS.dat('gd-link', link);
    let id = gdIdTuLink(link) || FS.driveCho?.id;
    if (!id) {
      // Chưa dán link: tìm thư mục dự án theo tên trên Drive của tài khoản đăng nhập.
      try {
        if (!GD.token || Date.now() > GD.het - 60000) await gdLayToken();
        const q = encodeURIComponent(`name='${gdQ(GD_TEN_THU_MUC)}' and mimeType='${GD_FOLDER}' and trashed=false`);
        const ds = (await gdJson(`${GD_API}?q=${q}&fields=files(id,name,modifiedTime)&pageSize=10&${GD_CHUNG}`)).files || [];
        if (!ds.length) return thongBao(`Không tìm thấy thư mục "${GD_TEN_THU_MUC}" trên Drive của tài khoản này. Dán link thư mục vào ô trên.`, 'canh', 8000);
        if (ds.length > 1) thongBao(`Có ${ds.length} thư mục cùng tên – dùng thư mục sửa gần nhất. Muốn chọn thư mục khác thì dán link.`, 'canh', 8000);
        ds.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '')); id = ds[0].id;
        LS.dat('gd-link', `https://drive.google.com/drive/folders/${id}`);
      } catch (e) { return thongBao('Không tìm được thư mục trên Drive: ' + e.message, 'loi', 8000); }
    }
    await ketNoiDrive({ id });
  },
  async 'gd-ngat'() {
    if (!confirm('Ngắt kết nối Google Drive trên trình duyệt này? (Dữ liệu trên Drive giữ nguyên.)')) return;
    try { if (GD.token) google.accounts.oauth2.revoke(GD.token, () => { }); } catch { }
    GD.token = null; await KHO.dat('drive', null); FS.goc = FS.app = null; FS.ketNoi = false; FS.canKetNoiLai = false; FS.driveCho = null; render();
  },
});

// Tải sẵn thư viện đăng nhập Google và khởi tạo bộ xin quyền ngay khi mở app: khi người dùng chạm nút,
// cửa sổ đăng nhập mở ngay trong cùng thao tác (Safari/iPhone chặn cửa sổ mở chậm sau khi chạm).
(async () => {
  try {
    await napScript('https://accounts.google.com/gsi/client');
    if (GD.clientId && !GD.tc) { GD.tc = google.accounts.oauth2.initTokenClient({ client_id: GD.clientId, scope: GD_SCOPE, callback: () => { } }); GD.tc.cid = GD.clientId; }
  } catch { }
})();
