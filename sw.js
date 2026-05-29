const CACHE_NAME = 'fastmo-studio-cache-v1';

// 最初にキャッシュ（先取り）しておくファイルの一覧
// ※Wasmファイルや主要なJS、CSSの名前が分かっている場合はここに追加してください
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './app.js',
    './lang/en.json'
    './lang/ja.json'
    './dist/sonic.js',
    './dist/sonic.wasm'
];

// ① インストール時：必須ファイルをキャッシュに登録
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] 主要アセットを事前キャッシュ中...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    // 新しいWorkerがすぐ有効になるようにする
    self.skipWaiting();
});

// ② 有効化時：古いバージョンのキャッシュがあれば削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] 古いキャッシュを削除:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ③ フェッチ時：Stale-While-Revalidate 戦略
// 「手元にあるキャッシュを即座に返してアプリを瞬時に起動しつつ、
//  裏でネットワークから最新版を取ってきて次の起動のためにキャッシュを更新する」
self.addEventListener('fetch', (event) => {
    // ローカルサーバー（http）や外部通信のGETリクエストのみを対象にする
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                // 裏側で最新版をネットワークから取得するタスクを走らせる（非同期）
                const fetchedResponse = fetch(event.request).then((networkResponse) => {
                    // 正常なレスポンスが返ってきたら、キャッシュを最新版に更新
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // オフラインなどでネットワークが死んでいてもエラーにせずスルー
                });

                // キャッシュがあればそれを最優先で即返し（爆速起動）、なければネットワークの結果を待つ
                return cachedResponse || fetchedResponse;
            });
        })
    );
});

