/* Núcleo comum: armazenamento no PDA, migração dos registros antigos, progresso, backup.
   Usado pela tela inicial (index.html) e pela preventiva (preventiva.html). */
(function(){
'use strict';
const DB_NOME='P76Preventivas', DB_VERSAO=1;
// Bancos das versões anteriores do app (somente leitura — nunca são apagados)
const LEGADO_PAGA_CDT='PreventivasTelecomP76Offline', LEGADO_IP66='P76IP66Preventivas';
const conexoes={};

function abrirNovo(){
  if(!conexoes[DB_NOME])conexoes[DB_NOME]=new Promise((ok,falha)=>{
    if(!('indexedDB' in window))return falha(Error('IndexedDB indisponível neste navegador'));
    const q=indexedDB.open(DB_NOME,DB_VERSAO);
    q.onupgradeneeded=()=>{for(const s of ['registros','originais'])if(!q.result.objectStoreNames.contains(s))q.result.createObjectStore(s)};
    q.onsuccess=()=>ok(q.result);
    q.onerror=()=>falha(q.error||Error('Falha ao abrir o armazenamento'));
    q.onblocked=()=>falha(Error('Armazenamento bloqueado por outra aba aberta'));
  }).catch(e=>{delete conexoes[DB_NOME];throw e});
  return conexoes[DB_NOME];
}
// Abre um banco antigo SEM criá-lo caso não exista.
function abrirExistente(nome){
  if(!conexoes[nome])conexoes[nome]=new Promise(ok=>{
    if(!('indexedDB' in window))return ok(null);
    let q;try{q=indexedDB.open(nome)}catch(e){return ok(null)}
    q.onupgradeneeded=()=>{try{q.transaction.abort()}catch(e){}};
    q.onsuccess=()=>ok(q.result);
    q.onerror=()=>ok(null);
    q.onblocked=()=>ok(null);
  });
  return conexoes[nome];
}
function ler(db,store,chave){
  return new Promise(ok=>{
    if(!db||!db.objectStoreNames.contains(store))return ok(null);
    try{const q=db.transaction(store,'readonly').objectStore(store).get(chave);q.onsuccess=()=>ok(q.result??null);q.onerror=()=>ok(null)}catch(e){ok(null)}
  });
}
function gravar(db,store,chave,valor){
  return new Promise((ok,falha)=>{
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(valor,chave);
    tx.oncomplete=()=>ok();tx.onerror=()=>falha(tx.error||Error('Falha na gravação'));
    tx.onabort=()=>falha(tx.error||Error('Armazenamento cheio ou gravação interrompida'));
  });
}
function apagar(db,store,chave){
  return new Promise(ok=>{try{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(chave);tx.oncomplete=()=>ok();tx.onerror=()=>ok();tx.onabort=()=>ok()}catch(e){ok()}});
}

/* ---------- Catálogo ---------- */
const P=window.P76;
function om(tag){return P.oms.find(o=>o.tag===tag)||null}
function roteiro(o){return P.roteiros[o.roteiro]}

/* ---------- Registro ---------- */
function novoRegistro(o){
  const r=roteiro(o),h=o.historico;
  return {versao:1,tag:o.tag,om:o.om,name:'',company:'',hours:'',date:'',location:'',outcome:'',deviation:'',nextPhoto:1,
    items:r.itens.map(()=>({status:'',obs:'',photos:[]})),
    power:h?h.potencia.map(()=>({measured:'',status:''})):[],
    isolation:h?h.isolacao.map(()=>({measured:'',unit:'MΩ',status:''})):[],
    instrumentPower:'',instrumentIso:'',atualizado:null,
    tagItems:o.tagsEquipamentos?Object.fromEntries(o.tagsEquipamentos.map(tag=>[tag,r.itens.map(()=>({status:'',obs:'',photos:[]}))])):null};
}
// Garante que um registro (novo, migrado ou restaurado) tem todos os campos esperados.
function normalizar(o,r){
  const base=novoRegistro(o);
  if(!r||!Array.isArray(r.items)||r.items.length!==base.items.length)return null;
  for(const k of ['name','company','hours','date','location','outcome','deviation','instrumentPower','instrumentIso'])base[k]=String(r[k]??'');
  base.items=r.items.map(it=>({status:['ES','EC','NE'].includes(it.status)?it.status:'',obs:String(it.obs??''),photos:(it.photos||[]).filter(p=>p&&p.preview)}));
  if(o.tagsEquipamentos){
    for(const tag of o.tagsEquipamentos){
      const antigo=Array.isArray(r.tagItems?.[tag])?r.tagItems[tag]:[];
      base.tagItems[tag]=base.tagItems[tag].map((v,i)=>{
        const it=antigo[i];
        return it?{status:['ES','EC','NE'].includes(it.status)?it.status:'',obs:String(it.obs??''),photos:(it.photos||[]).filter(p=>p&&p.preview)}:v;
      });
    }
  }
  if(Array.isArray(r.power)&&r.power.length===base.power.length)base.power=r.power.map(x=>({measured:String(x.measured??''),status:x.status||''}));
  if(Array.isArray(r.isolation)&&r.isolation.length===base.isolation.length)base.isolation=r.isolation.map(x=>({measured:String(x.measured??''),unit:x.unit||'MΩ',status:x.status||''}));
  let max=0;base.items.forEach(it=>it.photos.forEach(p=>max=Math.max(max,Number(p.seq)||0)));
  base.items.forEach(it=>it.photos.forEach(p=>{if(!p.seq)p.seq=++max}));
  if(base.tagItems){for(const items of Object.values(base.tagItems)){
    items.forEach(it=>it.photos.forEach(p=>max=Math.max(max,Number(p.seq)||0)));
    items.forEach(it=>it.photos.forEach(p=>{if(!p.seq)p.seq=++max}));
  }}
  base.nextPhoto=Math.max(Number(r.nextPhoto)||1,max+1);
  base.atualizado=r.atualizado||null;
  return base;
}

/* ---------- Conversão dos formatos antigos ---------- */
function fotoAntigaPagaCdt(p){
  return {seq:Number(p.sequence??p.seq)||0,name:p.name||'foto.jpg',mime:p.mime||p.type||'image/jpeg',preview:p.data,
    orig:p.originalKey?{db:LEGADO_PAGA_CDT,store:'originals',key:p.originalKey}:null};
}
function deAntigoPagaCdt(r){
  if(!r)return null;
  return {...r,items:(r.items||[]).map(it=>({status:it.status,obs:it.obs,photos:(it.photos||[]).map(fotoAntigaPagaCdt)}))};
}
function deAntigoIp66(r){
  if(!r)return null;
  return {...r,nextPhoto:r.seq,items:(r.items||[]).map(it=>({status:it.status,obs:it.obs,photos:(it.photos||[]).map(p=>({
    seq:p.seq,name:p.name||'foto.jpg',mime:'image/jpeg',preview:p.preview,orig:p.key?{db:LEGADO_IP66,store:'originals',key:p.key}:null}))}))};
}
function lerLocalStorage(chave){try{const t=localStorage.getItem(chave);return t?JSON.parse(t):null}catch(e){return null}}

async function buscarLegado(o){
  if(o.roteiro==='A3280-1A'){
    const lado=o.tag.endsWith('B')?'B':'A',chave='telecom-p76-paga-cdi-v2';
    const v=await ler(await abrirExistente(LEGADO_PAGA_CDT),'records',chave)||lerLocalStorage(chave);
    return v&&v[lado]?deAntigoPagaCdt(v[lado]):null;
  }
  if(o.roteiro==='A3309-1A'){
    const chave='p76-telefonia-cdt-v1';
    return deAntigoPagaCdt(await ler(await abrirExistente(LEGADO_PAGA_CDT),'records',chave)||lerLocalStorage(chave));
  }
  if(o.roteiro==='A3281-1A'){
    return deAntigoIp66(await ler(await abrirExistente(LEGADO_IP66),'records','p76-ip66-'+o.tag));
  }
  return null;
}

/* ---------- API de registros ---------- */
async function carregar(tag){
  const o=om(tag);if(!o)throw Error('TAG não encontrada no catálogo: '+tag);
  const db=await abrirNovo();
  const atual=normalizar(o,await ler(db,'registros',tag));
  if(atual)return {registro:atual,origem:'pda'};
  const antigo=normalizar(o,await buscarLegado(o));
  if(antigo&&iniciada(antigo)){antigo.migradoEm=new Date().toISOString();await gravar(db,'registros',tag,antigo);return {registro:antigo,origem:'migrado'}}
  const novo=novoRegistro(o);novo.date=hoje();return {registro:novo,origem:'novo'};
}
async function salvar(reg){
  reg.atualizado=new Date().toISOString();
  await gravar(await abrirNovo(),'registros',reg.tag,structuredClone(reg));
}
async function guardarOriginal(chave,blob){await gravar(await abrirNovo(),'originais',chave,blob);return {db:DB_NOME,store:'originais',key:chave}}
async function apagarOriginal(orig){if(orig&&orig.db===DB_NOME)await apagar(await abrirNovo(),'originais',orig.key)}
function dataUrlParaBlob(url){const [cab,b64]=url.split(','),bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return new Blob([out],{type:(cab.match(/data:([^;]+)/)||[])[1]||'image/jpeg'})}
// Retorna a foto original se ainda estiver no PDA; senão, a cópia otimizada.
async function blobDaFoto(p){
  if(p.orig){const db=p.orig.db===DB_NOME?await abrirNovo():await abrirExistente(p.orig.db);const b=await ler(db,p.orig.store,p.orig.key);if(b)return b}
  return dataUrlParaBlob(p.preview);
}

/* ---------- Progresso ---------- */
function iniciada(r){const itens=r.tagItems?Object.values(r.tagItems).flat():r.items;return itens.some(it=>it.status||it.obs||it.photos.length)||!!(r.name||r.company||r.hours||r.outcome)}
function progresso(r){
  const itens=r.tagItems?Object.values(r.tagItems).flat():r.items;
  const total=itens.length,feitos=itens.filter(it=>it.status).length;
  const pend=itens.filter(it=>(it.status==='EC'||it.status==='NE')&&!it.obs.trim()).length;
  let situacao='nova';
  if(r.outcome==='CONCLUÍDA')situacao='ok';
  else if(r.outcome==='NÃO CONCLUÍDA'||r.outcome==='NÃO EXECUTADA')situacao='nc';
  else if(iniciada(r))situacao='and';
  return {total,feitos,pend,situacao};
}
const ROTULO={nova:'Não iniciada',and:'Em andamento',ok:'Concluída',nc:'Não concluída'};

/* ---------- Arquivos ---------- */
function hoje(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function baixar(blob,nome){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nome;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function nomeFoto(tag,p){const ext=((p.name||'').match(/\.([a-z0-9]+)$/i)||[])[1]||(p.mime||'').split('/')[1]||'jpg';return tag.replace(/[^A-Za-z0-9_-]/g,'_')+'_'+p.seq+'.'+ext.replace(/[^a-z0-9]/gi,'').toLowerCase()}
function zip(arquivos){
  const enc=new TextEncoder,partes=[],central=[];let off=0;
  const w=(v,o,n,k)=>{for(let i=0;i<k;i++)v.setUint8(o+i,(n>>>(8*i))&255)};
  const crc=a=>{let c=0xffffffff;for(const x of a){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0};
  for(const f of arquivos){const n=enc.encode(f.name),b=f.bytes,h=crc(b),lh=new Uint8Array(30+n.length),lv=new DataView(lh.buffer);
    w(lv,0,0x04034b50,4);w(lv,4,20,2);w(lv,6,0x0800,2);w(lv,14,h,4);w(lv,18,b.length,4);w(lv,22,b.length,4);w(lv,26,n.length,2);lh.set(n,30);partes.push(lh,b);
    const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);w(cv,0,0x02014b50,4);w(cv,4,20,2);w(cv,6,20,2);w(cv,8,0x0800,2);w(cv,16,h,4);w(cv,20,b.length,4);w(cv,24,b.length,4);w(cv,28,n.length,2);w(cv,42,off,4);ch.set(n,46);central.push(ch);off+=lh.length+b.length}
  const fim=new Uint8Array(22),ev=new DataView(fim.buffer);w(ev,0,0x06054b50,4);w(ev,8,arquivos.length,2);w(ev,10,arquivos.length,2);w(ev,12,central.reduce((a,x)=>a+x.length,0),4);w(ev,16,off,4);
  return new Blob([...partes,...central,fim],{type:'application/zip'});
}

/* ---------- Backup / restauração (aceita também os backups das versões antigas) ---------- */
function montarBackup(registros,semFotos){
  const regs={};for(const r of registros){const c=structuredClone(r);if(semFotos)c.items.forEach(it=>it.photos=[]);regs[r.tag]=c}
  return new Blob([JSON.stringify({app:'Preventivas-Telecom-P76',versao:1,criado:new Date().toISOString(),semFotos:!!semFotos,registros:regs})],{type:'application/json'});
}
function lerBackup(json){
  const saida={};
  if(json&&json.registros){for(const [tag,r] of Object.entries(json.registros)){const o=om(tag);const n=o&&normalizar(o,r);if(n)saida[tag]=n}}
  else if(json&&json.db&&(json.db.A||json.db.B)){ // backup antigo PAGA Ex (duas caixas)
    for(const lado of ['A','B']){const tag='CDI-5510505'+lado,o=om(tag);const n=o&&json.db[lado]&&normalizar(o,deAntigoPagaCdt(json.db[lado]));if(n)saida[tag]=n}}
  else if(json&&json.record){const o=om('CDT-5510504');const n=normalizar(o,deAntigoPagaCdt(json.record));if(n)saida[o.tag]=n} // antigo CDT
  else if(json&&json.tag&&json.data){const o=om(json.tag);const n=o&&normalizar(o,deAntigoIp66(json.data));if(n)saida[json.tag]=n} // antigo IP66
  return saida;
}

function registrarSW(){if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{})}
async function pedirPersistencia(){try{await navigator.storage?.persist?.()}catch(e){}}

window.Nucleo={om,roteiro,novoRegistro,normalizar,carregar,salvar,guardarOriginal,apagarOriginal,blobDaFoto,progresso,iniciada,ROTULO,
  hoje,baixar,nomeFoto,zip,montarBackup,lerBackup,registrarSW,pedirPersistencia};
})();