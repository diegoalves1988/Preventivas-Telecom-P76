/* Mantém o app abrindo sem internet. Sempre tenta a versão mais nova da rede primeiro;
   sem rede, usa a última cópia guardada no PDA. */
const CACHE='p76-preventivas-v3';
const ARQUIVOS=['./','index.html','preventiva.html','estilo.css','nucleo.js','dados.js','paga.html','ip66-paga.html','cdt.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('p76-preventivas-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true})));
});