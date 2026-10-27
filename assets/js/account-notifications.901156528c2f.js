
/* Paramètres de compte : indépendant du moteur des missions. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const menu=$('amaAccountMenu'),modal=$('amaAccountModal'),avatar=$('amaAvatarButton');
 const sup=window.supabase;
 const client=sup?.createClient('https://bleixaoiyoxvatsimkrw.supabase.co','sb_publishable_cUhSkP5GpURWVSme6GMVzA_6L3Gl9tm');
 const status=$('amaAccountStatus');
 function updateProfilePreview(url,name,role){
   const img=$('amaProfilePreviewImg'),fallback=$('amaProfilePreviewFallback');
   if(!img||!fallback)return;
   if(name){$('amaProfilePreviewName').textContent=name;fallback.textContent=name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'AM'}
   if(role)$('amaProfilePreviewRole').textContent=role==='admin'?'Administrateur':'Intervenant';
   if(url){img.src=url;img.hidden=false;fallback.hidden=true}else{img.hidden=true;img.removeAttribute('src');fallback.hidden=false}
 }
 window.amaUpdateProfilePreview=updateProfilePreview;
 function close(){menu.hidden=true;avatar?.setAttribute('aria-expanded','false')}
 async function openSettings(){
   close();if(!client){alert('Supabase indisponible.');return}
   const {data:{user},error}=await client.auth.getUser();if(error||!user){alert('Session expirée.');return}
   const {data:p}=await client.from('profiles').select('full_name,phone,role,avatar_url').eq('id',user.id).maybeSingle();
   $('amaAccountFullName').value=p?.full_name||user.user_metadata?.full_name||'';
   $('amaAccountPhone').value=p?.phone||user.user_metadata?.phone||'';
   $('amaAccountNewEmail').value=user.email||''; $('amaAccountFullName').defaultValue=$('amaAccountFullName').value;
   await window.amaPrivatePhotos.load(p?.avatar_url,client);
   updateProfilePreview(window.amaAvatarSrc?.(p?.avatar_url||'')||'',p?.full_name||user.user_metadata?.full_name||user.email||'Mon profil',p?.role||'intervenant');
   modal.dataset.role=p?.role||'intervenant';
   window.amaPushUpdateRole?.();
   const restricted=modal.dataset.role!=='admin';
   $('amaAccountFullName').readOnly=restricted;
   $('amaAccountNewEmail').readOnly=restricted;
   $('amaAccountFullName').setAttribute('aria-readonly',String(restricted));
   $('amaAccountNewEmail').setAttribute('aria-readonly',String(restricted));
   status.textContent=''; $('amaAccountManagedHint').hidden=!restricted;$('amaAvatarChooser').hidden=true;$('amaMyPhotoMenuAvatar').setAttribute('aria-expanded','false');$('amaAvatarStatus').textContent='';document.querySelectorAll('[data-photo-menu]').forEach(b=>{b.setAttribute('aria-expanded','false');$(b.dataset.photoMenu).hidden=true});modal.hidden=false;
 }
 $('amaOpenSettings').addEventListener('click',openSettings);
 $('amaCloseSettings').addEventListener('click',()=>modal.hidden=true);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
 $('amaMenuLogout').addEventListener('click',()=>{close();$('logoutBtn')?.click()});
 document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!avatar?.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();modal.hidden=true}});
 avatar?.setAttribute('title','Ouvrir mon compte');
 avatar?.setAttribute('aria-label','Ouvrir mon compte');
 async function summary(){
   if(!client||$('app')?.hidden)return;
   const {data:{user}}=await client.auth.getUser();if(!user)return;
   const {data:p}=await client.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
   $('amaAccountName').textContent=p?.full_name||'Mon compte';
   $('amaAccountEmail').textContent=user.email||'';
 }
 const app=$('app');if(app){new MutationObserver(()=>{if(!app.hidden)summary();else{close();modal.hidden=true}}).observe(app,{attributes:true,attributeFilter:['hidden']});if(!app.hidden)summary()}
 $('amaAccountForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!client)return;
   const save=e.target.querySelector('[type=submit]');save.disabled=true;status.textContent='Enregistrement…';
   try{
     const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)throw Error('Session expirée');
     const name=$('amaAccountFullName').value.trim(),phone=$('amaAccountPhone').value.trim(),email=$('amaAccountNewEmail').value.trim();
     if(!name)throw Error('Le nom est obligatoire.');
     const restricted=modal.dataset.role!=='admin';
     if(restricted && (name!==$('amaAccountFullName').defaultValue || email!==user.email))throw Error('Nom et e-mail réservés à l’administrateur.');
     const result=await client.rpc('ama_update_my_contact',{new_full_name:name,new_phone:phone});if(result.error)throw result.error;
     if(!restricted && email!==user.email){const r=await client.auth.updateUser({email});if(r.error)throw r.error;status.textContent='Informations enregistrées. Confirmez le changement d’e-mail via les messages envoyés par Supabase.'}
     else status.textContent='Informations enregistrées.';
     $('amaAccountName').textContent=name;
   }catch(err){status.textContent='Erreur : '+(err.message||err)}
   finally{save.disabled=false}
 });
})();
