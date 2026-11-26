# CLAUDE.md – App QLDA KCN Văn Giang

Hướng dẫn cho Claude Code khi làm việc với repo này. Trả lời người dùng bằng **tiếng Việt**.

## App là gì
App web (vanilla JS, không build) quản lý dự án KCN Văn Giang – GĐ1: tiến độ, GPMB (QĐ phê duyệt PA, kinh phí, mộ), thuê đất và miễn giảm, hợp đồng – thanh toán, bản vẽ, văn bản, hồ sơ mới, báo cáo.
- Web: https://ncc1102.github.io/app-qlda-vgip/ (GitHub Pages, nhánh `main`, repo **công khai**).
- Một người dùng (chủ repo), dùng trên máy tính và điện thoại.
- **Dữ liệu dự án KHÔNG nằm trong repo.** Dữ liệu thật ở thư mục Google Drive của người dùng: `G:\My Drive\0. DỰ ÁN TRIMICO GROUP\(1. VGIP) KCN Văn Giang\00. APP QLDA\du-lieu.json`. Bối cảnh dự án và việc đang dở: xem `00. APP QLDA\CLAUDE - boi canh du an.md` trên Drive.

## Tệp
| Tệp | Nội dung |
|---|---|
| `index.html` | Khung trang, thanh chức năng; nạp script theo thứ tự `du-lieu-goc.js → app.js → tien-do.js → gd2.js → drive.js → hoso-moi.js` |
| `du-lieu-goc.js` | `window.DU_LIEU_GOC`: **khung trống** (nhóm việc A–H, quy trình mẫu Hưng Yên `quyTrinhMau`, `kiemSoatUuDai`). Không đưa số liệu dự án vào đây |
| `app.js` | Lõi: `D` (dữ liệu), `UI`, `FS` (thư mục), `KHO` (IndexedDB), `LS`, `chuanHoa()`, `luu()` (lưu trình duyệt và ghi `du-lieu.json` sau 700 ms), `render()` (bảng `VE` theo tab), `suaTruong()`, `HD` (xử lý `data-act`), `MAU` (mẫu tờ trình), `taoPhieu()`, GPMB (`tongDot`, `hanChiTra`, `tatCaQD`, `laMo`, `dongBoPheDuyet`), thuê đất và miễn giảm, Tổng quan, Báo cáo (Zalo, Excel, HTML), `quetThuMuc`, `vaoSo`, `moFile` |
| `tien-do.js` | Nhập file tiến độ PL2 (.xlsx), lịch sử phiên bản, `kiemTraSoLieu()` (kiểm tra chéo), nạp bảng di chuyển đường dẫn |
| `gd2.js` | Tab Hợp đồng (`D.hopDong`: giá trị, `dieuChinh`, `thanhToan`), tab Bản vẽ (`D.banVe`), sinh việc từ quy trình mẫu, mẫu tờ trình thanh toán/LCNT/NVTC, `window.SUA_THEM` (sửa trường kiểu mới) |
| `drive.js` | Kết nối trực tiếp Google Drive: OAuth (Google Identity Services, Client ID mặc định trong `GD_CLIENT_ID_MAC_DINH`), lớp `GDDir`/`GDFile` mô phỏng File System Access API, `quetDrive()` (lưu `thuMuc`, `mocDoi`), `moFileDrive()` |
| `hoso-moi.js` | Tự quét khi kết nối (Drive: Changes API – `quetTangDrive`), mục **Văn bản → Hồ sơ mới** (`hoSoMoi`, `goiYHoSo`, `xuLyHoSo`), nhận **gói dữ liệu** từ `00. APP QLDA\goi-du-lieu\*.json` (`xuLyGoi`: khớp theo id/số QĐ/số HĐ/đường dẫn; điền ô trống; thêm dòng; báo lệch; `gpmbTongHop`, `moMaTongHop` theo ngày), báo cáo GPMB tuần (`THU_MUC_BC_GPMB`) |
| `sw.js` | Service worker (`BAN`, danh sách `TEP`) |
| `claude/cap-nhat-qlda.md` | Bản sao lệnh Claude `/cap-nhat-qlda` (bản dùng thật ở `%USERPROFILE%\.claude\commands\`). Mô tả **cấu trúc gói dữ liệu** |
| `tools/quet-ho-so.py` | Quét thư mục hồ sơ (NFC) |
| `GHI CHU PHIEN BAN.md`, `HUONG DAN KET NOI GOOGLE DRIVE.md`, `README.md` | Ghi chú phiên bản, hướng dẫn người dùng |

## Mô hình dữ liệu (D)
`duAn, caiDat{duongDanGoc, toiLa, thuMucApp='00. APP QLDA'}, nhom[], viec[] (id, tt, nhom, ten, batDau, ketThuc, pct, trangThai, phuThuoc, checklist, vanBan, nhatKy), moc[], vanBan[] (id, so, ngay, loai, chieu, coQuan, trichYeu, trangThai, duongDan tương đối, lienKet[{kieu:'dot'|'viec'|'hd'|'td', id}]), gpmb{dot[], tongHop{ngay, tongHa, thuHoiHa, congKhaiHa, pheDuyetHa(TỰ TÍNH từ QĐ), pheDuyetPA, chiTraHa, soHoChiTra, banGiaoHa, pheDuyetHaBaoCao, nguon}, keHoachChiTra[], lichSu[], moMa{…, qd[] (loai:'mo')}}, thueDat{dot[] (buoc, mg)}, hopDong[], banVe[], phieu[], lichSuTienDo[], nhatKyChung[], daBoSung[] (mã gói đã nạp), hoSoBoQua[]`.
- QĐ đất: `id, qdSo, qdNgay, hieuLuc, soHo, soPATS, dienTich (m²), khoanMuc{dat,taiSan,hoTro,thuong}, tong, dieuChinh[{qdSo,qdNgay,tongMoi}], chiTraTu/chiTraDen, ngayChuyenTien, soTienChuyen, trangThai (TT_DOT)`.
- Đường dẫn file luôn **tương đối** từ thư mục dự án, ngăn cách `\`, so sánh sau khi chuẩn hoá **NFC** (`nfc()`); tên trên đĩa có thể ở dạng NFD.

## Quy tắc bắt buộc
1. **Repo công khai:** không đưa số tiền, danh mục QĐ hay HĐ, tên người, số tài khoản, dữ liệu dự án vào repo. Ví dụ trong tài liệu dùng số 0. Dữ liệu và script có số liệu nội bộ để trên Drive (`00. APP QLDA\cong-cu (tao du lieu goc - noi bo)`).
2. **Hỏi người dùng trước khi `git push`** (hệ thống có thể chặn push lên repo công khai). Commit: `git -c user.name=NCC1102 -c user.email=NCC1102@users.noreply.github.com commit`, dòng cuối `Co-Authored-By: Claude …`. Không commit `.claude/`.
3. **Mỗi lần sửa app:** tăng `PHIEN_BAN_APP` (app.js), `?v=` (index.html), `BAN` (sw.js); ghi `GHI CHU PHIEN BAN.md`; `node --check` mọi file .js; chạy thử bằng `python -m http.server 8765 --bind 127.0.0.1` và trình duyệt (Drive giả lập bằng cách ghi đè `window.fetch` khi cần); đợi Pages build (`gh api repos/NCC1102/app-qlda-vgip/pages/builds/latest`).
4. **Không sửa thẳng `du-lieu.json`** trừ khi người dùng đồng ý. Khi sửa: sao lưu trước, ghi `nhatKyChung`, cập nhật `capNhat`, ghi bằng LF. Cách ưu tiên là lập **gói dữ liệu** để người dùng xem trước và nạp trong app.
5. **QĐ của cơ quan nhà nước là số liệu gốc.** Báo cáo nội bộ hoặc báo cáo xã lệch với QĐ thì theo QĐ và nêu lệch.
6. **Không xoá hồ sơ:** bản trùng chuyển vào `98. Chờ xoá…`, bản cũ vào `99. Bản cũ`; di chuyển có nhật ký CSV và script hoàn tác.
7. Khi chèn code bằng Python/heredoc, cẩn thận ký tự `\` (đã nhiều lần gây chuỗi `\0`); ưu tiên công cụ Edit.
