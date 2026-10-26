
(()=>{'use strict';
 const origin='https://bleixaoiyoxvatsimkrw.supabase.co';
 const prefix='/storage/v1/object/public/profile-photos/';
 const cache=new Map(),pending=new Map();let epoch=0;
 function path(reference){try{const u=new URL(reference);if(u.origin!==origin||u.username||u.password||u.search||u.hash||!u.pathname.startsWith(prefix))return null;const p=u.pathname.slice(prefix.length);return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+$/.test(p)?p:null;}catch(_){return null;}}
 async function load(reference,client){
  const p=path(reference);if(!p)return '';
  if(cache.has(reference))return cache.get(reference);
  if(pending.has(reference))return pending.get(reference);
  const generation=epoch;
  const task=(async()=>{try{
   const {data,error}=await client.storage.from('profile-photos').download(p);
   if(error||!data||generation!==epoch)return '';
   if(!['image/jpeg','image/png','image/webp'].includes(data.type)||data.size>3145728)return '';
   const local=URL.createObjectURL(data);cache.set(reference,local);return local;
  }catch(_){return '';}})();
  pending.set(reference,task);try{return await task;}finally{if(pending.get(reference)===task)pending.delete(reference);}
 }
 function clear(){epoch++;for(const local of cache.values())URL.revokeObjectURL(local);cache.clear();pending.clear();}
 window.amaPrivatePhotos={load,resolve:reference=>cache.get(reference)||'',clear};
 window.addEventListener('pagehide',clear);
})();
