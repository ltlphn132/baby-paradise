/* 宝宝乐园 离线缓存 Service Worker
   策略：打开页面 = 网络优先（1.2 秒内没响应就用本地缓存，所以有网时自动更新到最新版）
        其他资源 = 缓存优先，缓存没有才联网 */
var CACHE = 'bbly-v1';
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(u){
        return c.add(u).catch(function(){}); // 单个资源缺失不影响安装
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function fromCache(req){
  return caches.match(req, {ignoreSearch:true}).then(function(hit){
    return hit || caches.match('./index.html');
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  var isNav = req.mode === 'navigate' || /index\.html$/.test(url.pathname) || url.pathname.slice(-1) === '/';
  if(isNav){
    var netFetch = fetch(req).then(function(resp){
      if(resp && resp.ok){
        var copy = resp.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
      }
      return resp;
    });
    e.waitUntil(netFetch.catch(function(){}));
    var settled = false;
    e.respondWith(new Promise(function(resolve){
      var done = function(v){ if(!settled){ settled = true; resolve(v); } };
      netFetch.then(done, function(){ fromCache(req).then(done); });
      setTimeout(function(){ fromCache(req).then(done); }, 1200);
    }));
  } else {
    e.respondWith(
      caches.match(req, {ignoreSearch:true}).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(resp){
          if(resp.ok){ var copy = resp.clone(); caches.open(CACHE).then(function(c){ c.put(req, copy); }); }
          return resp;
        }).catch(function(){ return caches.match('./index.html'); });
      })
    );
  }
});
