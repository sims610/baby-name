// LittleRoots service worker: lets the app be installed and open without a connection.
// Only same-origin GET requests are handled; the API lives on another origin and is
// never cached, so names, favorites and sign-in always come from the server.

// Bump this to throw away everything cached by older versions.
const CACHE = "littleroots-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function putInCache(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Pages: always try the network so a new deploy shows up right away. Offline, every
  // route gets the cached app shell and React Router takes it from there.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => (url.pathname === "/" ? putInCache("/", response) : response))
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }

  // Built JS/CSS have a content hash in the name, so a cached copy never goes stale.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => putInCache(request, response))),
    );
    return;
  }

  // Images and other files: answer from the cache, refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => cached ?? Response.error());
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      return fresh;
    }),
  );
});

// ---- Push notifications (sent by the API's push.ts, e.g. "It's a match!") ----

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  const { title = "LittleRoots", body = "", url = "/", tag } = message;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/favicon.png",
      data: { url },
    }),
  );
});

// Clicking a notification opens its page, reusing an open LittleRoots window if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  if (target.origin !== self.location.origin) {
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        await open.focus();
        return open.navigate(target.href).catch(() => self.clients.openWindow(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
