# ver9 – app 1.7.0 (26/11/2026) – Dùng thật
- **Web và repo chỉ còn khung app:** `du-lieu-goc.js` chỉ giữ nhóm việc và quy trình mẫu Hưng Yên. Không còn QĐ, hợp đồng, văn bản, tiến độ, danh bạ hay số liệu dự án. Dữ liệu dự án chỉ nằm trong `00. APP QLDA\du-lieu.json` trên Google Drive của người dùng.
- Khi chưa kết nối, Tổng quan nhắc "Chưa mở dữ liệu dự án" kèm nút kết nối.
- Các script tạo dữ liệu có số liệu nội bộ (cập nhật QĐ GPMB, GĐ2, quy trình và thuê đất) đã chuyển vào thư mục dự án `00. APP QLDA\cong-cu (tao du lieu goc - noi bo)`.
- Sửa: tab GPMB không lỗi khi chưa có hạn di dời mồ mả.

# ver8 – app 1.6.0 (26/11/2026) – Tự động hoá hồ sơ
- **Tự quét khi kết nối:**
  - Google Drive: app chỉ đọc danh sách thay đổi từ lần trước (Changes API) nên mất vài giây. Thư mục bị đổi tên hoặc di chuyển thì quét lại toàn bộ.
  - Thư mục trên máy: quét lại nếu chỉ mục cũ hơn 6 giờ.
- **Văn bản → Hồ sơ mới:** liệt kê file mới xuất hiện sau lần quét trước, kèm gợi ý xử lý theo thư mục và tên file:
  - vào sổ, gắn QĐ GPMB hoặc QĐ mộ theo số QĐ hay thư mục đợt; QĐ chưa có thì tạo dòng mới; QĐ điều chỉnh thì gắn vào QĐ gốc;
  - gắn hợp đồng theo số HĐ, hoặc thêm hợp đồng mới;
  - gắn đợt thuê đất (`10. Giao đất\Lần N`);
  - file trong `02. Tiến độ triển khai` thì mở "Nhập file tiến độ" ngay từ file trên Drive;
  - ảnh, clip, CAD, file nén, file thuộc bộ bản vẽ thì chỉ ghi nhận.

  Mỗi file có nút "Đồng ý", "Chỉ vào sổ", "Bỏ qua", "Mở", và có nút "Đồng ý tất cả". Tổng quan báo số hồ sơ mới.
- **Gói dữ liệu Claude:** lệnh `/cap-nhat-qlda` trong Claude Code đọc file mới (kể cả PDF scan) và ghi gói vào `00. APP QLDA\goi-du-lieu\`. App tự phát hiện gói mới và cho xem trước trước khi nạp:
  - bản ghi mới;
  - ô trống sẽ được điền;
  - dòng thanh toán hoặc điều chỉnh mới;
  - chỗ lệch với số đang có: mặc định giữ số cũ, tích để thay.

  Gói khớp theo id, số QĐ, số HĐ, đường dẫn văn bản nên không tạo trùng. App lưu một phiên bản trước khi nạp.
- Nút "Nạp gói dữ liệu (.json)…" dùng chung màn hình xem trước.

# ver7 – app 1.5.0 (26/11/2026) – Kết nối trực tiếp Google Drive
- Cài đặt có khung **Google Drive (kết nối trực tiếp)**: nhập OAuth Client ID và link thư mục dự án, rồi đăng nhập Google. App đọc, ghi thẳng thư mục trên Drive, không cần cài Google Drive trên máy, dùng được trên điện thoại.
- Đọc và ghi dữ liệu, quét hồ sơ, phiếu soạn văn bản, lưu báo cáo, nhập file tiến độ đều chạy trên Drive, theo cùng cách như thư mục trên máy. Quét Drive song song, không tải nội dung file.
- Mở file bằng trình xem của Google Drive. Có phát hiện xung đột khi máy khác sửa du-lieu.json.
- Hướng dẫn tạo Client ID: `HUONG DAN KET NOI GOOGLE DRIVE.md`. Code nằm trong `drive.js`.

# ver6 – app 1.4.0 (23/11/2026) – GĐ2
- **Tab Hợp đồng (gói thầu – hợp đồng – thanh toán):**
  - Danh mục hợp đồng đọc từ `05. Hợp đồng`, `06. Nhà thầu` và các tờ trình.
  - Ghi điều chỉnh giá trị (phụ lục) và từng lần tạm ứng, thanh toán, quyết toán. App tự tính lũy kế, % đã trả, còn lại.
  - Có nút "Soạn tờ trình thanh toán" và "Soạn tờ trình LCNT".
  - **Giá trị và thanh toán là số nội bộ, không có trong repo.** Nạp bằng "Nạp gói dữ liệu (.json)…" từ file gói trong `05. Hợp đồng`. App chỉ thêm dòng thiếu, điền ô trống, không ghi đè.
- **Tab Bản vẽ:** sổ bộ hồ sơ thiết kế, mỗi bộ trỏ tới một thư mục, có trạng thái và căn cứ thẩm định, duyệt. Sau khi quét thư mục, app đếm số file và liệt kê file PDF.
- **Sinh việc từ quy trình mẫu:** mỗi QĐ GPMB và mỗi đợt thuê đất có nút "Sinh việc". Mỗi bước quy trình Hưng Yên thành một việc nối tiếp; bước đã có việc thì bỏ qua.
- **Mẫu tờ trình mới:** thanh toán hợp đồng, lựa chọn nhà thầu, nộp nghĩa vụ tài chính đất đai.
- **Kiểm tra số liệu thêm:** đã trả vượt giá trị HĐ; HĐ hủy còn tạm ứng; đã quyết toán nhưng chưa trả đủ; quá hạn; thiếu giá trị; file hoặc thư mục không còn.
- Excel thêm sheet Hợp đồng, Thanh toán HĐ, Bản vẽ. Code GĐ2 trong `gd2.js`; dữ liệu gốc lập bằng `tools/cap-nhat-gd2.py`.

# ver5 – app 1.3.0 (23/11/2026)
- **Kinh phí di chuyển mộ theo QĐ** (tab GPMB, trong mục Di dời mồ mả):
  - Mỗi QĐ phê duyệt phương án di chuyển mộ là một dòng, gồm: số ngôi, số phương án, bồi thường về mộ, thưởng tiến độ, tổng kinh phí, hạn chi trả 30 ngày và trạng thái chuyển tiền. Bấm vào dòng để sửa. Nút "+ Thêm QĐ mộ" để thêm QĐ.
  - Đã nhập QĐ 4930 và QĐ 5456.
  - Kiểm tra: tổng số ngôi theo các QĐ phải khớp ô "Phê duyệt".
- **QĐ đất mới:**
  - Thêm đợt 4: QĐ 5591 (thôn Vĩnh Bảo – Thượng Tân cũ).
  - Đợt 1 bổ sung các khoản mục theo QĐ 2381 và điều chỉnh theo QĐ 2993.
  - Gắn file QĐ 4690, 4719.
- **Lịch chi trả dự kiến:**
  - Mỗi QĐ có thêm trường "Chi trả dự kiến từ/đến".
  - QĐ có lịch chi trả gần nhau được gom thành khung "Đợt chi trả" và cộng tổng tiền cần chuyển.
  - Khi còn ≤ 10 ngày mà chưa chuyển tiền, app nhắc ở Tổng quan và trong báo cáo Zalo.
- **Tờ trình chuyển kinh phí** (Claude): gộp các QĐ cùng lịch chi trả (cả đất và mộ). Hạn chuyển tiền đề xuất là trước ngày chi trả.
- **Kiểm tra số liệu thêm:**
  - Cộng các khoản mục ≠ tổng QĐ.
  - Số tiền đã chuyển ≠ kinh phí hiện hành (cần cấn trừ).
  - Lịch chi trả rơi sau hạn 30 ngày.
- Excel có thêm sheet "Kinh phí mộ"; sheet GPMB thêm cột "Chi trả dự kiến".
- **Tự bổ sung vào dữ liệu thật:**
  - Dữ liệu gốc có thêm khối `boSung`.
  - Khi mở bằng dữ liệu thật, app tự thêm các QĐ và văn bản còn thiếu, rồi ghi vào nhật ký chung.
  - Mỗi gói chỉ thêm một lần và không ghi đè số đã sửa tay.
- Thư mục `09. GPMB` mới gồm: `00. Quy trình - chung`, `01. Đợt 1`, `02. Đợt 2`, `03. Đợt 3`, `04. Đợt 4`, `05. Di dời mồ mả, nghĩa trang\01. QĐ phê duyệt PA mộ`.
- Công cụ `tools/cap-nhat-qd-gpmb.py`: chỉ ghi số tổng của QĐ, không ghi tên hay số điện thoại trong bảng chi tiết.

# ver4 – app 1.2.0 (23/11/2026)
- **Nhập file tiến độ mới** (Tiến độ → "Nhập file tiến độ…", file PL2 .xlsx):
  - App so sánh với tiến độ đang dùng và liệt kê việc thay đổi (lùi/sớm bao nhiêu ngày), việc mới, việc không còn trong file, mốc đổi hạn. Người dùng tích chọn mục nào thì áp dụng mục đó.
  - Khi áp dụng, app giữ nguyên trạng thái, % thực hiện, người được giao, checklist và văn bản gắn của từng việc. Mỗi việc thay đổi được ghi vào nhật ký của việc đó.
  - File được lưu vào `02. Hồ sơ thực hiện dự án\02. Tiến độ triển khai\<YYYY.MM.DD>\`, thêm ngày vào đầu tên nếu tên file chưa có ngày. App chỉ thêm file mới, không ghi đè file cũ.
  - File được ghi vào sổ văn bản.
- **Lịch sử tiến độ** (Tiến độ → Lịch sử):
  - App tự lưu một phiên bản trước và sau mỗi lần nhập file; người dùng cũng tự lưu được "Chốt tiến độ".
  - So sánh 2 phiên bản bất kỳ: tổng số ngày lùi, mốc đổi hạn, từng việc thay đổi.
  - Chọn một phiên bản làm "đường cơ sở" để Timeline vẽ thêm vạch xám dưới các việc bị đổi ngày.
  - Có nhật ký thay đổi chung, ghi cả thêm và xoá việc.
- **Kiểm tra số liệu trước khi báo cáo** (tab Báo cáo; Tổng quan báo khi có lỗi):
  - Mốc ↔ việc gắn mốc; kế hoạch chi trả GPMB ↔ việc "Chi trả lũy kế đạt X ha".
  - Số liệu GPMB và mồ mả phải theo đúng thứ tự các bước (ví dụ số đã chi trả không lớn hơn số đã phê duyệt).
  - Ngày QĐ ở mục GPMB, thuê đất ↔ ngày trong sổ văn bản; đợt thuê đất ↔ việc và mốc.
  - Văn bản bị xoá mà vẫn còn được gắn; đường dẫn file ↔ thư mục đã quét.
  - Có nút "Sửa" tự động cho các trường hợp chắc chắn: file cùng tên duy nhất, kế hoạch chi trả lệch ngày.
  - Khi xuất Excel/HTML hoặc tạo phiếu báo cáo mà còn lỗi, app hỏi lại trước khi xuất. File Excel có thêm sheet "Kiểm tra số liệu".
- **Đồng bộ đường dẫn khi sắp xếp lại thư mục** (Cài đặt):
  - Đổi tiền tố đường dẫn hàng loạt.
  - Nạp bảng di chuyển CSV, chỉ áp dụng các dòng có Duyệt = C. App tự lưu một phiên bản trước khi đổi.
- **Sửa lỗi Unicode:** tên file trên ổ đĩa có thể ở dạng tách dấu (NFD) trong khi app lưu dạng dựng sẵn (NFC). Trước đây "Mở file" và việc so khớp đường dẫn thất bại dù file vẫn còn. Nay mọi so sánh đều chuẩn hoá, và khi lưu file app không tạo thêm thư mục trùng tên. `tools/quet-ho-so.py` cũng chuẩn hoá theo cách này.
- **Sửa đường dẫn** `04. Sau CTĐT` → `04. Sau Chủ trương đầu tư` (đúng tên thư mục thật).

# ver3 (23/11/2026)
- Nạp quy trình GPMB, cho thuê đất và kiểm soát ưu đãi của tỉnh Hưng Yên (QĐ 31/2026) từ file `2026.10.31. Quy trình GPMB và giao đất KCN-CCN.xlsx` bằng `tools/cap-nhat-quy-trinh.py`. Chỉ lấy thời hạn Hưng Yên.
- Tab GPMB:
  - Thêm mục **Cho thuê đất và miễn, giảm tiền thuê đất theo đợt**: Lần 1 (QĐ 2735), ô XLNT, đợt 2 (60 ha), đợt 3 (130 ha), đợt 4 (203,55 ha).
  - Mỗi đợt theo dõi 13 bước thủ tục cho thuê đất và 13 mục miễn, giảm làm đồng thời: kê mục 9 Đơn Mẫu 01, công văn đề nghị miễn, LPTB, thuế phi nông nghiệp, Phiếu Mẫu 22, khấu trừ tiền BT, đối chiếu thông báo thuế, bàn giao thực địa…
  - Tự tính hết miễn XDCB (QĐ + 3 năm), hết miễn theo ngành (+11 năm) và hạn kê khai (trước 06 tháng).
  - Thêm cột "Bước quy trình GPMB" cho từng QĐ phê duyệt phương án.
  - Thêm phần xem quy trình mẫu và 14 mục kiểm soát ưu đãi.
- Tổng quan báo đỏ khi một đợt đã có QĐ cho thuê đất mà mục miễn, giảm quá hạn nội bộ hoặc chưa cập nhật. Báo vàng khi một đợt sắp lập hồ sơ xin thuê đất.
- Xuất Excel có thêm sheet "Thuê đất - miễn giảm"; tin nhắn Zalo có thêm dòng 7.
- Dữ liệu đang dùng (`du-lieu.json`) tự được bổ sung phần thuê đất và quy trình mới khi mở app. Số liệu cũ không mất.

# ver2 (23/11/2026)
- Sửa lỗi lớp phủ hộp thoại che toàn màn hình (nền tối, không bấm được).
- Thêm nút đổi giao diện Sáng/Tối, mặc định Sáng.
- Trang chính luôn lấy bản mới nhất khi mở (không giữ bản cũ).
- Danh bạ có người đề nghị; "Tôi là" chọn sẵn.
- tao-du-lieu-goc.py: chỉ cần --goc (PL2 ver3 và nơi ghi mặc định).

# App QLDA KCN Văn Giang – ver1 (22/11/2026)

## Có trong bản này
- Tổng quan: cần xử lý, 10 mốc, việc chậm, GPMB lũy kế so kế hoạch 60/95/130/203,55 ha.
- Tiến độ: 55 việc từ PL2 ver3; Timeline (Gantt), Bảng, Kanban; phụ thuộc, checklist, văn bản gắn kèm, nhật ký.
- GPMB: QĐ 2381, 3085 (điều chỉnh 4690), 4719; khoản mục, hạn chi trả (hiệu lực + 30 ngày), mồ mả; soạn tờ trình chuyển kinh phí.
- Văn bản: sổ đăng ký 181 văn bản, kho hồ sơ (quét cả thư mục dự án, tìm không dấu), phiếu soạn.
- Giao việc theo người/đơn vị; Báo cáo: Zalo, Excel 4 sheet, HTML xem trên điện thoại, sao lưu JSON.
- Dữ liệu lưu `00. APP QLDA\du-lieu.json` trong OneDrive; báo xung đột khi máy khác sửa.
- Skill `/to-trinh-vgip`: soạn tờ trình từ phiếu, đọc bản scan, kiểm hiệu lực + soát mâu thuẫn, xuất bản nháp + bản sạch, ghi kết quả vào phiếu.

## Đã chạy thử
- Toàn bộ màn hình, lưu/tải lại, khổ điện thoại, luồng phiếu trong thư mục mô phỏng.
- Soạn thật TTr QĐ 4719 (22/11/2026): số liệu khớp QĐ 4719, CV 230; bản sạch chỉ khác TTr 29/10 ở ngày, thời gian chuyển, người đề nghị.

## Chưa làm (GĐ3)
- Nhiều người dùng, nhập liệu trên điện thoại, tự theo dõi thư mục CV đến.
