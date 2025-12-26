const CACHE_NAME = "dylan-story-v19"; // Saya naikkan versi agar cache lama terhapus
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // === PERBAIKAN PENTING: ABAIKAN CHROME EXTENSION ===
  // Kode ini mencegah error "Request scheme 'chrome-extension' is unsupported"
  // yang membuat CSS kamu hilang.
  if (!url.protocol.startsWith("http")) return;

  // 1. STRATEGI UNTUK API (Network First)
  if (url.origin.includes("story-api.dicoding.dev")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. STRATEGI UNTUK GAMBAR LUAR (Stale While Revalidate)
  if (request.destination === "image" || url.origin.includes("unsplash.com")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {});
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. STRATEGI NAVIGASI (Halaman HTML - Agar Offline Jalan)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("./index.html").then((response) => {
          return response || caches.match("./") || caches.match("index.html");
        });
      })
    );
    return;
  }

  // 4. STRATEGI DEFAULT (Aset CSS/JS/Font) - Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// PUSH NOTIFICATION HANDLER
self.addEventListener("push", (event) => {
  let data = { title: "Dylan Story", options: { body: "Cek cerita baru!" } };
  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || data.title;
      data.options = Object.assign(data.options || {}, payload.options);
    } catch (e) {
      data.options.body = event.data.text();
    }
  }

  // Pastikan icon menggunakan path relative yang benar
  data.options.icon = "./icon-192.png";
  data.options.badge = "./icon-192.png";

  event.waitUntil(self.registration.showNotification(data.title, data.options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let client of clientList) {
        if (client.url.includes("/#/dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/#/dashboard");
    })
  );
});
