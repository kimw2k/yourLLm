"use strict";

const PREFIX =
  "music-dial-shell:" + encodeURIComponent(self.registration.scope) + ":";

const CACHE = PREFIX + "v1";

const FILES = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg"
].map(path => new URL(path, self.registration.scope).href);

const INDEX = FILES[0];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  // 기존 창이 사용 중이면 새 버전은 대기합니다.
  // 기존 창을 모두 닫고 다시 열면 새 서비스 워커가 활성화됩니다.
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith(PREFIX) && name !== CACHE)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  if (url.origin !== scope.origin) return;

  const isAppPage =
    url.pathname === scope.pathname ||
    url.pathname === new URL(INDEX).pathname;

  if (request.mode === "navigate" && isAppPage) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE);
          await cache.put(INDEX, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(INDEX)) ||
          new Response("오프라인 앱 화면을 준비하지 못했습니다.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  if (FILES.includes(url.href)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      return cached || fetch(request);
    })());
  }
});
