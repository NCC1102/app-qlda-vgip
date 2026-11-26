---
# Bản sao lệnh Claude Code. Cài: chép file này vào %USERPROFILE%\.claude\commands\cap-nhat-qlda.md
description: Đọc hồ sơ mới trong thư mục dự án KCN Văn Giang (Google Drive) và lập gói dữ liệu cho App QLDA (giá trị HĐ, kinh phí QĐ, thanh toán, quyết toán, tiến độ…)
argument-hint: "[đường dẫn thư mục dự án] [--tu YYYY-MM-DD] [--file <đường dẫn tương đối>…]"
---

# /cap-nhat-qlda – Claude đọc hồ sơ mới, lập gói dữ liệu cho App QLDA

Mục tiêu: rút **số liệu nằm trong văn bản** (app không tự đọc được) từ các file mới hoặc vừa sửa trong thư mục dự án. Kết quả là một **gói dữ liệu JSON** để người dùng xem trước rồi bấm "Nạp gói" trong app. **Không sửa `du-lieu.json`, không sửa, không di chuyển hồ sơ.**

Tham số: `$ARGUMENTS`
- Thư mục dự án mặc định: `G:\My Drive\0. DỰ ÁN TRIMICO GROUP\(1. VGIP) KCN Văn Giang`. Nếu không thấy thì hỏi người dùng.
- `--tu YYYY-MM-DD`: chỉ đọc file sửa từ ngày này. `--file …`: chỉ đọc các file được nêu.

## 1. Xác định file cần đọc
1. Đọc `00. APP QLDA\du-lieu.json` (dữ liệu app hiện tại) để biết id và số đang có: `gpmb.dot`, `gpmb.moMa.qd`, `hopDong`, `thueDat.dot`, `viec`, `vanBan` (đường dẫn đã vào sổ).
2. Đọc trạng thái `00. APP QLDA\goi-du-lieu\_trang-thai.json`, gồm `{ "lanChayCuoi": ISO, "daDoc": { "<đường dẫn tương đối>": "<ngày sửa ISO>" } }`. Nếu chưa có thì coi lần chạy cuối là 7 ngày trước.
3. Duyệt thư mục dự án bằng Python (`os.walk`, chạy `python -I`, so sánh tên đã chuẩn hoá NFC). Bỏ qua: `00. APP QLDA`, `98. Chờ xoá…`, `99. Bản cũ`, `00. Đề xuất sắp xếp…`; ảnh, video, CAD, file nén. Chọn các file `.pdf .docx .doc .xlsx .xls` **mới hoặc sửa sau lần đọc trước**.
4. Chỉ giữ các loại chứa số liệu cần theo dõi:
   - QĐ phê duyệt, điều chỉnh phương án BTHT (đất, mộ);
   - hợp đồng, phụ lục, thanh lý;
   - tờ trình hoặc giấy đề nghị tạm ứng, thanh toán, quyết toán; biên bản nghiệm thu, quyết toán;
   - QĐ cho thuê đất, thông báo nộp tiền của Thuế;
   - QĐ, thông báo miễn giảm;
   - công văn có lịch chi trả, hạn nộp; báo cáo tiến độ.

   Liệt kê danh sách cho người dùng trước khi đọc nếu có trên 30 file.

## 2. Đọc từng file
- **PDF có chữ:** dùng `pdftotext -layout`. **PDF scan:** dùng `pymupdf` để chuyển trang sang ảnh (dpi 90–110, lưu vào thư mục tạm scratchpad) rồi đọc ảnh. Đọc trang có "Điều 1", bảng tổng hợp, "Giá trị hợp đồng", "Tổng cộng". Không cần đọc hết bảng chi tiết từng hộ.
- **Word:** dùng `python-docx` (đoạn và bảng). **Excel:** dùng `openpyxl`, `pandas`.
- Số liệu lấy **nguyên văn trong văn bản**. QĐ hoặc văn bản cơ quan nhà nước là gốc; báo cáo nội bộ lệch với QĐ thì theo QĐ và ghi chú.
- **Không ghi** họ tên, số điện thoại, CCCD, số tài khoản ngân hàng của cá nhân hoặc hộ dân. Chỉ ghi số tổng.

## 3. Lập gói dữ liệu
Ghi file `00. APP QLDA\goi-du-lieu\YYYY.MM.DD HHMM. Goi cap nhat.json` (UTF-8, `ensure_ascii=False`, `indent=1`):
```json
{
 "ma": "claude-YYYY.MM.DD-HHMM",
 "ghiChu": "Tóm tắt 1 dòng: đọc N file – QĐ …, HĐ …",
 "taoLuc": "ISO",
 "nguon": [{"duongDan": "đường dẫn tương đối", "noiDung": "đã lấy gì"}],
 "baoCao": "Ghi chú cho người duyệt: chỗ chưa chắc, chỗ lệch với app, việc cần làm (VD chuyển tiền trước ngày …)",
 "vanBan":  [{"so": "5591/QĐ-UBND", "ngay": "2026-11-12", "loai": "Quyết định", "chieu": "Đến", "coQuan": "...", "trichYeu": "...", "trangThai": "Đã nhận", "duongDan": "02. Hồ sơ thực hiện dự án\\09. GPMB\\04. Đợt 4\\....pdf", "lienKet": [{"kieu": "dot", "id": "dot4"}]}],
 "gpmbDot": [{"id": "dot4", "qdSo": "...", "qdNgay": "YYYY-MM-DD", "hieuLuc": "...", "soHo": 0, "soPATS": 0, "dienTich": 0, "khuVuc": "...", "khoanMuc": {"dat": 0, "taiSan": 0, "hoTro": 0, "thuong": 0}, "tong": 0,
              "dieuChinh": [{"qdSo": "...", "qdNgay": "...", "tongMoi": 0, "ghiChu": "..."}], "chiTraTu": "", "chiTraDen": "", "ngayChuyenTien": "", "soTienChuyen": null, "trangThai": "..."}],
 "moQd":    [{"id": "mo2", "qdSo": "...", "qdNgay": "...", "soMo": 0, "soHo": 0, "khoanMuc": {"boiThuong": 0, "thuong": 0}, "tong": 0}],
 "hopDong": [{"id": "hd-27nt", "giaTri": 0, "dieuChinh": [{"so": "PL 01", "ngay": "...", "giaTriMoi": 0, "ghiChu": "..."}],
              "thanhToan": [{"loai": "Tạm ứng|Thanh toán|Quyết toán", "ngay": "YYYY-MM-DD", "soTien": 0, "ghiChu": "theo TTr/UNC số …"}], "trangThai": "...", "ghiChuTien": "..."}],
 "thueDat": [{"id": "td1", "qdSo": "...", "qdNgay": "...", "dienTichM2": 0}],
 "viec":    [{"id": "v12", "pct": 80, "trangThai": "Đang làm", "ghiChu": "theo BC ngày …"}]
}
```
Quy tắc:
- **Bản ghi đã có trong app:** dùng đúng `id` trong `du-lieu.json` và chỉ ghi các trường đọc được từ văn bản. App chỉ điền ô trống. Chỗ khác với số đang có, app hiện ra để người dùng tích chọn, không tự ghi đè.
- **QĐ hoặc hợp đồng mới chưa có trong app:** đặt id dễ nhận, ví dụ `dot-qd5712`, `mo-qd5800`, `hd-28-2026`, và điền đủ trường như mẫu (gồm `ten`, `trangThai`). Hợp đồng mới phải có `so`, `ngay`, `doiTac`, `noiDung`, `nhom` (một trong: Tư vấn quy hoạch, khảo sát / Tư vấn thiết kế, thẩm tra / Tư vấn môi trường, PCCC / GPMB, đo đạc / Xây lắp, rà phá bom mìn / Kiểm toán, pháp lý / Truyền thông, sự kiện / Văn phòng / Khác).
- **`thanhToan`:** chỉ ghi khoản **đã chuyển tiền** (có UNC, giấy báo nợ, xác nhận). Khoản mới đề nghị hoặc phê duyệt thì ghi vào `ghiChuTien`, `baoCao`.
- **`vanBan`:** khoá là `duongDan`. File đã vào sổ thì chỉ thêm `lienKet` nếu thiếu.
- Mỗi gói phải có `ma` mới. Không lặp lại khoản đã nạp ở gói trước: kiểm tra `daBoSung` và số đang có trong `du-lieu.json`.

## 4. Kết thúc
1. Cập nhật `_trang-thai.json`, gồm `lanChayCuoi` và `daDoc` cho các file đã đọc (kể cả file không có số liệu).
2. Báo cáo ngắn bằng tiếng Việt: đã đọc bao nhiêu file; số liệu chính (bảng); chỗ lệch với app; tên file gói.
3. Nhắc người dùng: mở App QLDA → kết nối thư mục → **Văn bản → Hồ sơ mới** (hoặc thông báo ở Tổng quan) → **Xem và nạp**.
4. Nếu không có file mới thì không tạo gói, chỉ báo "không có hồ sơ mới".
