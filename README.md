# App QLDA KCN Văn Giang

App web quản lý tiến độ, hồ sơ, GPMB, thuê đất, hợp đồng, bản vẽ và tờ trình cho Dự án KCN Văn Giang – Giai đoạn 1.

**Web:** https://ncc1102.github.io/app-qlda-vgip/

> Repo và web chỉ chứa **khung app** và quy trình mẫu (tỉnh Hưng Yên). **Dữ liệu dự án không có trên GitHub.** Toàn bộ QĐ, hợp đồng, văn bản, tiến độ, danh bạ nằm trong thư mục dự án trên Google Drive của người dùng, tại `00. APP QLDA\du-lieu.json`. Chỉ tài khoản Google có quyền với thư mục đó mới mở được.

## Dùng
1. Mở web → **Cài đặt → Google Drive** → **Đăng nhập Google và kết nối**. App tự tìm thư mục "(1. VGIP) KCN Văn Giang". Xem `HUONG DAN KET NOI GOOGLE DRIVE.md`.
2. Trên máy tính có Google Drive for desktop, có thể dùng **Chọn thư mục dự án…** (`G:\My Drive\…`).
3. Điện thoại: mở cùng địa chỉ web trong Chrome hoặc Safari rồi đăng nhập Google.

## Chức năng
- **Tổng quan**: việc cần xử lý, mốc, việc chậm, GPMB lũy kế, lịch chi trả, hồ sơ mới.
- **Tiến độ**: Timeline, Bảng, Kanban, lịch sử phiên bản; nhập file PL2 (.xlsx).
- **GPMB**: QĐ phê duyệt phương án và kinh phí, điều chỉnh, hạn chi trả, kinh phí di chuyển mộ; thuê đất và miễn, giảm tiền thuê đất.
- **Hợp đồng**: giá trị, phụ lục, tạm ứng, thanh toán, quyết toán. **Bản vẽ**: sổ bộ hồ sơ thiết kế.
- **Văn bản**: sổ đăng ký, kho hồ sơ, **hồ sơ mới** (tự phát hiện file mới trên Drive, gợi ý xử lý), phiếu soạn tờ trình.
- **Báo cáo**: Zalo, Excel, HTML, kiểm tra số liệu chéo.

## Claude Code
- `/to-trinh-vgip <phiếu>`: soạn tờ trình từ phiếu app tạo trong `00. APP QLDA\yeu-cau-soan\`.
- `/cap-nhat-qlda`: đọc hồ sơ mới (kể cả bản scan), lập gói dữ liệu trong `00. APP QLDA\goi-du-lieu\` để app xem trước rồi nạp. Bản sao lệnh: `claude/cap-nhat-qlda.md`.
- Các script tạo, cập nhật dữ liệu có số liệu nội bộ nằm trong thư mục dự án (`00. APP QLDA\cong-cu (tao du lieu goc - noi bo)`), không đưa lên repo.

Không dùng thư viện build. SheetJS (cdnjs) chỉ tải khi xuất hoặc nhập Excel; Google Identity Services tải khi đăng nhập Drive.
