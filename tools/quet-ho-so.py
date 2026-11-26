"""Quét thư mục dự án, tạo chi-muc-ho-so.json cho App QLDA (dùng khi trình duyệt không truy cập được thư mục).

Chạy:  python -I tools/quet-ho-so.py "<thư mục (1. VGIP) KCN Văn Giang>" "<file ra chi-muc-ho-so.json>"
Chỉ đọc tên, dung lượng, ngày sửa file; không mở, không sửa file nào.
"""
import datetime as dt
import json
import os
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
goc, ra = sys.argv[1], sys.argv[2]
BO_QUA = {"desktop.ini", "thumbs.db"}
files = []
for root, dirs, fs in os.walk(goc):
    rel_root = os.path.relpath(root, goc)
    if rel_root == ".":
        dirs[:] = [d for d in dirs if d != "00. APP QLDA" and not d.startswith(".")]
    else:
        dirs[:] = [d for d in dirs if not d.startswith(".")]
    for f in fs:
        if f.startswith(("~$", ".")) or f.lower() in BO_QUA:
            continue
        full = os.path.join(root, f)
        try:
            st = os.stat(full)
        except OSError:
            continue
        files.append({"p": unicodedata.normalize("NFC", os.path.relpath(full, goc)), "kb": round(st.st_size / 1024),
                      "sua": dt.date.fromtimestamp(st.st_mtime).isoformat()})
files.sort(key=lambda x: x["p"].lower())
with open(ra, "w", encoding="utf-8") as fo:
    json.dump({"ngayQuet": dt.datetime.now().isoformat(timespec="seconds"), "goc": os.path.basename(goc.rstrip("\\/")),
               "files": files}, fo, ensure_ascii=False, indent=1)
print("Đã quét", len(files), "file ->", ra)
