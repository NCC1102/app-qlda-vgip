// Bộ nhớ đệm để app mở được khi mất mạng (chỉ hoạt động khi chạy qua http://localhost).
const BAN = 'qlda-vgip-v18';
const TEP = ['./', './index.html', './app.js', './tien-do.js', './gd2.js', './drive.js', './hoso-moi.js', './style.css', './du-lieu-goc.js', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(BAN).then(c => c.addAll(TEP))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== BAN).map(k => caches.delete(k))))); self.clients.claim(); });
// Ưu tiên mạng (luôn lấy bản mới nhất), mất mạng thì dùng bản đệm.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Trang chính cũng hỏi lại máy chủ mỗi lần mở (GitHub Pages để đệm 10 phút).
  const req = e.request.mode === 'navigate' ? fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(new Request(e.request, { cache: 'no-cache' }));
  e.respondWith(req.then(r => { const c = r.clone(); caches.open(BAN).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
