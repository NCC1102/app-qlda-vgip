# Kết nối App QLDA với Google Drive (dùng được trên điện thoại)

Từ bản 1.5.0, app đọc và ghi thẳng thư mục dự án trên Google Drive, không cần cài Google Drive trên máy. Chỉ cần tạo **một lần** một mã OAuth Client ID (miễn phí) trong Google Cloud Console.

## A. Tạo Client ID (làm một lần, khoảng 10 phút)
1. Vào https://console.cloud.google.com bằng tài khoản Google đang chứa thư mục dự án, rồi tạo project mới (VD: `QLDA VGIP`).
2. Vào **APIs & Services → Library**, tìm **Google Drive API** và bấm **Enable**.
3. Vào **Google Auth Platform** (hoặc **OAuth consent screen**):
   - **Branding:** tên ứng dụng `QLDA VGIP`, email hỗ trợ là email của anh/chị.
   - **Audience:** chọn **External** (nếu công ty dùng Google Workspace thì chọn **Internal** để khỏi giới hạn test user). Giữ trạng thái **Testing**, rồi bấm **Add users** và thêm email của từng người sẽ dùng app (tối đa 100 người).
   - **Data access:** bấm **Add or remove scopes** và thêm `https://www.googleapis.com/auth/drive`.
4. Vào **Clients → Create client**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** thêm `https://ncc1102.github.io` (không có đường dẫn phía sau).
   - Không cần Redirect URI. Bấm **Create**.
5. Chép **Client ID** (dạng `1234…-abc….apps.googleusercontent.com`). Client ID không phải mật khẩu, nhưng không cần đưa lên chỗ công khai.

## B. Kết nối trong app (mỗi máy, mỗi điện thoại)
1. Mở https://ncc1102.github.io/app-qlda-vgip/ và vào **Cài đặt**, khung **Google Drive (kết nối trực tiếp)**.
2. **Client ID** đã điền sẵn (`398259192450-…apps.googleusercontent.com`), chỉ cần nhập khi muốn dùng Client ID khác.
3. Ô **Link thư mục dự án** có thể để trống: app tự tìm thư mục **(1. VGIP) KCN Văn Giang** trên Drive của tài khoản đăng nhập. Nếu có nhiều thư mục cùng tên, mở đúng thư mục trên drive.google.com, chép link (dạng `https://drive.google.com/drive/folders/…`) và dán vào.
4. Bấm **Đăng nhập Google và kết nối**, rồi chọn tài khoản Google.
   - Nếu Google báo *"Google hasn't verified this app"*: bấm **Advanced → Go to QLDA VGIP (unsafe)**. Đây là app nội bộ đang ở chế độ Testing nên Google hiện cảnh báo này.
   - Bấm **Continue/Allow** để cấp quyền xem và sửa file Drive.
5. Lần đầu, app tạo `00. APP QLDA\du-lieu.json` trong thư mục dự án. Nếu đã có dữ liệu thật thì chép thư mục `00. APP QLDA` vào trước.
6. Bấm **Quét hồ sơ** để lập chỉ mục file (khoảng 4.000 file, mất chừng 1–2 phút).

## C. Dùng hằng ngày
- Mỗi lần mở app, bấm nút **"○ Bấm để kết nối lại thư mục"** ở góc trên (hoặc Cài đặt → Kết nối lại). Google cấp quyền theo phiên 1 giờ và tự gia hạn khi đang dùng.
- **Mở file:** app mở bằng trình xem của Google Drive (xem được PDF, Word, Excel, ảnh, cả trên điện thoại).
- **Nhiều người dùng:** chia sẻ thư mục dự án (quyền Editor) cho từng người và thêm họ vào **Test users** (bước A.3). Nếu hai người cùng sửa, app báo *"File du-lieu.json đã bị thay đổi ở nơi khác"* để chọn bản giữ lại.
- Ở chế độ Testing, Google có thể hỏi lại quyền khoảng 7 ngày một lần. Đây là bình thường.
- **Ngắt kết nối:** Cài đặt → **Ngắt Google Drive**. Dữ liệu trên Drive giữ nguyên.

## D. Cách cũ vẫn dùng được
Trên máy tính có cài Google Drive for desktop: Cài đặt → **Chọn thư mục dự án…**, chọn `G:\My Drive\…\(1. VGIP) KCN Văn Giang`. Hai cách dùng chung một file `00. APP QLDA\du-lieu.json`.

## E. Tự động cập nhật khi thêm hồ sơ (từ bản 1.6.0)
1. **Thêm file lên Drive** vào đúng thư mục và đặt tên theo mẫu `YYYY.MM.DD. Số hiệu. Trích yếu`, ví dụ `2026.11.25. QĐ 5590-QĐ-UBND. Điều chỉnh QĐ 5591.pdf`.
2. **Mở app và kết nối.** App tự kiểm tra thay đổi trên Drive. Tổng quan sẽ báo "Hồ sơ mới: N file chờ xử lý".
3. **Văn bản → Hồ sơ mới:** xem gợi ý của từng file, rồi chạm **Đồng ý** hoặc **Đồng ý tất cả gợi ý**. Ví dụ gợi ý: vào sổ và gắn QĐ, hợp đồng, đợt thuê đất; tạo dòng QĐ hoặc hợp đồng mới; nhập file tiến độ.
4. **Số liệu bên trong văn bản** (kinh phí QĐ, giá trị và thanh toán hợp đồng, quyết toán, % tiến độ…):
   - Trên máy tính có Claude Code, gõ `/cap-nhat-qlda`. Claude đọc các file mới, kể cả bản scan, rồi lập gói dữ liệu trong `00. APP QLDA\goi-du-lieu\`.
   - Trong app, gói hiện ở đầu mục **Hồ sơ mới**. Chạm **Xem và nạp**, kiểm tra chỗ lệch (mặc định giữ số đang có) rồi chọn **Nạp gói**.
   - Muốn chạy tự động mỗi sáng: trong Claude (ứng dụng máy tính), tạo **Scheduled task** chạy lệnh `/cap-nhat-qlda` lúc 7:30 hằng ngày.
   - **Cài lệnh trên máy tính khác:** chép file `claude/cap-nhat-qlda.md` trong repo vào thư mục `%USERPROFILE%\.claude\commands\` của máy đó.
