const CACHE_NAME = "dylan-story-v11"; // Bump version
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
  "/styles/main.css",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error("Gagal caching aset awal:", err);
      });
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

  if (!url.protocol.startsWith("http")) return;

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
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/index.html").then((response) => {
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});

// === PUSH NOTIFICATION HANDLER ===
self.addEventListener("push", (event) => {
  let data = {
    title: "Dylan Story",
    options: { body: "Cerita baru menanti!" },
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: "Dylan Story", options: { body: event.data.text() } };
    }
  }

  const options = {
    body: data.options?.body || data.body || "Cek aplikasi sekarang",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: "/#/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// === WAJIB ADA: CLICK NOTIFICATION ===
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/#/dashboard");
      }
    })
  );
});
