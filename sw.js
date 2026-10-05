const CACHE_NAME='hls-pwa-v264-appearance-colors';
const CORE=[
  './',
  './index.html',
  './app.html',
  './assets/css/landing.css?v=263',
  './assets/js/landing.js?v=263',
  './assets/css/save-load.css',
  './assets/css/workspace.css',
  './assets/js/number-stepper.js',
  './assets/js/save-load.js',
  './assets/js/team-scroller.js',
  './assets/css/core.css',
  './assets/css/mobile.css',
  './assets/css/tournament-courts.css',
  './assets/css/court-preview.css',
  './assets/css/court-editor.css',
  './assets/js/mobile-menu.js',
  './assets/js/pwa-install.js',
  './assets/js/interaction-guards.js',
  './assets/js/standalone-sample-01.js',
  './assets/js/standalone-sample-02.js',
  './assets/js/standalone-sample-03.js',
  './assets/js/standalone-sample-04.js',
  './assets/js/standalone-sample-05.js',
  './assets/js/standalone-sample-06.js',
  './assets/js/standalone-sample-07.js',
  './assets/js/standalone-sample-08.js',
  './assets/js/app.js',
  './assets/js/generation-prototype.js',
  './assets/js/player-generation-skills.js',
  './assets/js/team-generator.js',
  './data/generation-prototype.json',
  './data/team-generation-blueprints.json',
  './data/generation-appearance.json',
  './data/generation-skills.json',
  './data/league-defaults.json',
  './assets/js/award-editor.js',
  './assets/css/award-editor.css',
  './assets/images/trophies/championship.png',
  './assets/images/trophies/natty.png',
  './assets/images/trophies/mvp.png',
  './assets/images/trophies/fmvp.png',
  './assets/images/trophies/dpoy.png',
  './assets/images/trophies/roty.png',
  './assets/images/trophies/6moty.png',
  './assets/images/trophies/mip.png',
  './assets/images/trophies/poty.png',
  './assets/images/trophies/mop.png',
  './assets/images/trophies/asmvp.png',
  './assets/images/trophies/all_star.png',
  './assets/images/trophies/trophy.png',
  './assets/js/court-preview.js',
  './assets/js/tournament-courts.js',
  './assets/js/roster-manager.js',
  './assets/js/referee-editor.js',
  './assets/js/announcer-editor.js',
  './assets/js/coach-editor.js',
  './assets/images/players/suit-idle.png',
  './data/referee-defaults.json',
  './assets/images/players/referee-idle.png',
  './assets/css/roster-manager.css',
  './assets/js/star-rating.js',
  './assets/css/star-rating.css',
  './assets/js/team-logo.js',
  './assets/css/team-logo.css',
  './assets/js/player-preview.js',
  './assets/images/players/head.png',
  './assets/images/players/eye-white.png',
  './assets/images/players/eye-color.png',
  './assets/images/players/brow-color.png',
  './assets/images/players/unibrow-color.png',
  './assets/images/players/idle.png',
  './assets/images/players/hair.png',
  './assets/images/players/facial-hair.png',
  './assets/images/players/head-accessories.png',
  './assets/images/players/team-letters.png',
  './data/player-blueprint.json',
  './manifest.webmanifest',
  './assets/images/icons/favicon.png',
  './assets/images/branding/hls_logo.png',
  './assets/images/icons/icon-192.png',
  './assets/images/icons/icon-512.png',
  './assets/images/icons/icon-maskable-512.png',
  './assets/images/icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  // Installers are large downloads, not offline application resources.
  if(url.pathname.endsWith('.msi'))return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match(url.pathname.endsWith('/app.html')?'./app.html':'./index.html')))
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(request).then(cached=>{
        const network=fetch(request).then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          }
          return response;
        }).catch(()=>cached);
        return cached||network;
      })
    );
    return;
  }

  if(url.hostname==='raw.githubusercontent.com'){
    event.respondWith(
      caches.match(request).then(cached=>{
        // Preview images may be opaque; the color picker needs a CORS-readable response.
        const compatible=cached&&(cached.type!=='opaque'||request.mode==='no-cors');
        if(compatible&&request.cache!=='reload'&&request.cache!=='no-store')return cached;
        return fetch(request).then(response=>{
          if(request.cache!=='no-store'&&(response.ok||response.type==='opaque')){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          }
          return response;
        });
      })
    );
  }
});
