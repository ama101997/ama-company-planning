
/* AMA : surcouche ergonomique. Le moteur existant reste inchangé. */
(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const bell=byId('amaBell'),panel=byId('notificationCard'),badge=byId('amaBellBadge'),count=byId('notificationCount');
 if(bell&&panel){
  panel.classList.add('ama-popover');document.body.appendChild(panel);
  const toggle=()=>{const opening=!panel.classList.contains('ama-open');panel.classList.toggle('ama-open',opening);if(opening&&byId('notificationContent')?.classList.contains('hidden'))byId('notificationToggle')?.click()};
  bell.addEventListener('click',toggle);
  document.addEventListener('click',e=>{if(!panel.contains(e.target)&&!bell.contains(e.target))panel.classList.remove('ama-open')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.classList.remove('ama-open')});
  if(count){const sync=()=>{const n=Number((count.textContent||'').match(/\d+/)?.[0]||0);badge.textContent=n>9?'9+':String(n);badge.classList.toggle('hidden',n===0);bell.setAttribute('aria-label',n?`${n} notifications non lues`:'Notifications')};new MutationObserver(sync).observe(count,{childList:true,characterData:true,subtree:true});sync()}
 }
 // Dessins vectoriels autonomes : aucune librairie externe ni changement des handlers.
 const paths={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',planning:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3"/>',history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 3"/>',invoices:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',admin:'<circle cx="10" cy="8" r="4"/><path d="M3 21v-2a7 7 0 0 1 14 0v2M19 8v6M16 11h6"/>'};
 document.querySelectorAll('#nav button[data-tab]').forEach(b=>{const path=paths[b.dataset.tab];if(!path||b.querySelector('svg'))return;const label=b.textContent.trim();b.textContent='';b.insertAdjacentHTML('afterbegin',`<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`);b.appendChild(document.createTextNode(label))});
 const ico=(path)=>`<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
 const refresh=byId('refreshBtn'),logout=byId('logoutBtn');
 if(refresh)refresh.innerHTML=ico('<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 13-3l2 2M4 16l2 2a8 8 0 0 0 13-3"/>')+'<span class="ama-top-label">Actualiser</span>';
 if(logout)logout.innerHTML=ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>')+'<span class="ama-top-label">Déconnexion</span>';
 // L'affichage du panneau app est déjà piloté par la connexion ; le CSS respecte son attribut hidden.
 // Photos de profil : Supabase Storage + profils (migration SQL fournie dans l'archive).
 const AMA_AVATAR_STYLES=[
  ['#ddeeea','#347c70','person'],['#e4ebf5','#557a9a','person'],
  ['#f4e7db','#a17b57','smile'],['#eee7f5','#806a9b','person'],
  ['#e3efe6','#64886c','person'],['#f2e7e9','#b47e89','smile']
 ];
 function amaAvatarSrc(url){
  const m=/^ama-avatar:\/\/([1-6])$/.exec(url||'');
  if(!m){
    return window.amaPrivatePhotos.resolve(url);
   }
  const [bg,fg,kind]=AMA_AVATAR_STYLES[Number(m[1])-1];
  const shape=kind==='smile'?'<circle cx="32" cy="32" r="17"/><path d="M25 36q7 8 14 0M26 28h.1M38 28h.1"/>':'<circle cx="32" cy="26" r="10"/><path d="M14 53c1-12 9-17 18-17s17 5 18 17"/>';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
 }
 window.amaAvatarSrc=amaAvatarSrc;
 const avatarButton=byId('amaAvatarButton'),avatarInput=byId('amaAvatarInput'),avatarImg=byId('amaAvatarImg'),initials=byId('amaAvatarInitials');
 let selectedProfile=null;let pictureUrls=new Map();
 // Réutiliser la session Supabase déjà présente dans l'application, sans nouvelle connexion.
 async function clientForAvatar(){
   const sup=window.supabase;if(!sup?.createClient)return null;
   // Le client partagé par l'application n'est pas exporté. Le jeton public se lit uniquement dans la configuration existante.
   const scripts=Array.from(document.scripts).map(s=>s.textContent||'').join('');
   const m=scripts.match(/createClient\(\s*['"]https:\/\/bleixaoiyoxvatsimkrw\.supabase\.co['"]\s*,\s*['"]([^'"]+)['"]/);
   if(!m)return null;
   return sup.createClient('https://bleixaoiyoxvatsimkrw.supabase.co',m[1]);
 }
 let photoClientPromise;
 function photoClient(){return photoClientPromise||(photoClientPromise=clientForAvatar())}
 async function refreshAvatar(){
  if(byId('app')?.hidden)return;
  const client=await photoClient();if(!client)return;
  const {data:{user}}=await client.auth.getUser();if(!user)return;
  const {data:rows,error}=await client.from('profiles').select('id,full_name,avatar_url').eq('id',user.id).limit(1);
  if(error)return;
  const p=rows?.[0];if(!p)return;
  await window.amaPrivatePhotos.load(p.avatar_url,client);
  initials.textContent=(p.full_name||user.email||'AM').split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  byId('amaRemoveMyPhoto').hidden=!p.avatar_url;
 if(p.avatar_url){avatarImg.src=amaAvatarSrc(p.avatar_url);avatarImg.classList.remove('hidden')}else{avatarImg.classList.add('hidden');avatarImg.removeAttribute('src')}
  window.amaUpdateProfilePreview?.(p.avatar_url?amaAvatarSrc(p.avatar_url):'',p.full_name||user.email||'Mon profil');
 }
 avatarButton?.addEventListener('click',()=>{selectedProfile=null;const menu=document.getElementById('amaAccountMenu');if(menu){menu.hidden=!menu.hidden;avatarButton.setAttribute('aria-expanded',String(!menu.hidden));}});
 const avatarGallery=byId('amaAvatarGallery'),avatarStatus=byId('amaAvatarStatus');
 if(avatarGallery){
  AMA_AVATAR_STYLES.forEach((style,i)=>{
   const button=document.createElement('button');button.type='button';button.className='ama-avatar-choice';
   button.setAttribute('aria-label','Avatar '+(i+1));button.setAttribute('aria-pressed','false');
   button.style.background=style[0];
   const image=document.createElement('img');image.alt='';image.src=amaAvatarSrc('ama-avatar://'+(i+1));
   image.style.cssText='width:100%;height:100%;display:block;border-radius:50%';
   button.appendChild(image);
   button.addEventListener('click',async()=>{
    const priorSrc=document.getElementById('amaProfilePreviewImg')?.getAttribute('src')||'';
    window.amaUpdateProfilePreview?.(amaAvatarSrc('ama-avatar://'+(i+1)));
    button.disabled=true;avatarStatus.textContent='Enregistrement de l’avatar…';
    try{
     const c=await photoClient();if(!c)throw Error('Supabase indisponible');
     const {data:{user},error}=await c.auth.getUser();if(error||!user)throw Error('Session expirée');
     const result=await c.rpc('ama_set_profile_avatar',{target_user_id:user.id,avatar_public_url:'ama-avatar://'+(i+1)});
     if(result.error)throw result.error;
     avatarGallery.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
     avatarStatus.textContent='Avatar enregistré.';byId('amaAvatarChooser').hidden=true;byId('amaMyPhotoMenuAvatar').setAttribute('aria-expanded','false');
     await refreshAvatar();
    }catch(e){window.amaUpdateProfilePreview?.(priorSrc);avatarStatus.textContent='Erreur : '+(e.message||e)+'. Exécutez la migration avatars dans Supabase.'}
    finally{button.disabled=false}
   });
   avatarGallery.appendChild(button);
  });
 }
 avatarInput?.addEventListener('change',async()=>{
  const file=avatarInput.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){alert('Choisissez une image JPG, PNG ou WebP de 3 Mo maximum.');avatarInput.value='';return}
  const priorPhoto=document.getElementById('amaProfilePreviewImg')?.getAttribute('src')||'';
  const ownPhoto=!selectedProfile;
  const previewObject=ownPhoto?URL.createObjectURL(file):null;
  if(previewObject)window.amaUpdateProfilePreview?.(previewObject);
  avatarButton.disabled=true;
  try{
   const client=await photoClient();if(!client)throw Error('Connexion Supabase indisponible.');
   const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)throw Error('Connectez-vous pour modifier une photo.');
   const target=selectedProfile||user.id;
   const path=target+'/profil-'+Date.now()+'.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
   const upload=await client.storage.from('profile-photos').upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;
   const {data:url}=client.storage.from('profile-photos').getPublicUrl(path);
   const updated=await client.rpc('ama_set_profile_avatar',{target_user_id:target,avatar_public_url:url.publicUrl});
   if(updated.error)throw updated.error;
   await window.amaPrivatePhotos.load(url.publicUrl,client);
   pictureUrls.set(target,url.publicUrl);
   if(target===user.id)await refreshAvatar();else updateWorkerPictures();
  }catch(e){if(ownPhoto)window.amaUpdateProfilePreview?.(priorPhoto);alert('Photo non enregistrée : '+(e.message||e)+'\nVérifiez la configuration SQL du dossier.')}finally{if(previewObject)URL.revokeObjectURL(previewObject);avatarButton.disabled=false;avatarInput.value='';selectedProfile=null}
 });

 async function removeProfilePhoto(target,button,status){
  button.disabled=true;status.textContent='Suppression de la photo…';
  try{
   const c=await photoClient();if(!c)throw Error('Connexion indisponible');
   const {data:{user},error}=await c.auth.getUser();if(error||!user)throw Error('Session expirée');
   const id=target||user.id;
   const result=await c.rpc('ama_set_profile_avatar',{target_user_id:id,avatar_public_url:null});
   if(result.error)throw result.error;
   pictureUrls.delete(id);button.hidden=true;
   if(id===user.id){await refreshAvatar();avatarGallery?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));}
   else{updateWorkerPictures();const box=byId('amaWorkerEditorPhoto');box.className='ama-worker-avatar-fallback';box.textContent=(byId('amaWorkerEditName').value||'').split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();}
   status.textContent='Photo supprimée. Les initiales sont affichées.';
  }catch(e){status.textContent='Suppression impossible : '+(e.message||e);}
  finally{button.disabled=false;}
 }

 function closePhotoMenus(){document.querySelectorAll('[data-photo-menu]').forEach(b=>{b.setAttribute('aria-expanded','false');byId(b.dataset.photoMenu).hidden=true})}
 document.querySelectorAll('[data-photo-menu]').forEach(button=>{
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const menu=byId(button.dataset.photoMenu),open=menu.hidden;closePhotoMenus();menu.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('button:not([hidden])')?.focus()});
 });
 document.addEventListener('click',e=>{if(!e.target.closest('.ama-profile-options'))closePhotoMenus()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){const active=document.querySelector('[data-photo-menu][aria-expanded="true"]');if(active){e.stopImmediatePropagation();closePhotoMenus();active.focus()}}},true);
 byId('amaMyPhotoMenuChange').onclick=()=>{closePhotoMenus();byId('amaAvatarChooser').hidden=true;byId('amaMyPhotoMenuAvatar').setAttribute('aria-expanded','false');selectedProfile=null;avatarInput.click()};
 byId('amaMyPhotoMenuAvatar').onclick=()=>{closePhotoMenus();const chooser=byId('amaAvatarChooser');chooser.hidden=!chooser.hidden;byId('amaMyPhotoMenuAvatar').setAttribute('aria-expanded',String(!chooser.hidden));if(!chooser.hidden)chooser.querySelector('button')?.focus()};
 byId('amaWorkerEditorPhotoButton').addEventListener('click',closePhotoMenus);
 const removeMine=byId('amaRemoveMyPhoto'),removeWorker=byId('amaRemoveWorkerPhoto');
 removeMine?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closePhotoMenus();byId('amaAvatarChooser').hidden=true;byId('amaMyPhotoMenuAvatar').setAttribute('aria-expanded','false');removeProfilePhoto(null,removeMine,byId('amaAvatarStatus'))});
 removeWorker?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closePhotoMenus();const target=byId('amaWorkerEditId').value;if(target)removeProfilePhoto(target,removeWorker,byId('amaWorkerEditStatus'))});
 const editorPhoto=byId('amaWorkerEditorPhoto');
 if(editorPhoto)new MutationObserver(()=>{removeWorker.hidden=!editorPhoto.querySelector('img')}).observe(editorPhoto,{childList:true,subtree:true});
 const profilePreview=byId('amaProfilePreviewImg');
 if(profilePreview)new MutationObserver(()=>{removeMine.hidden=profilePreview.hidden||!profilePreview.getAttribute('src')}).observe(profilePreview,{attributes:true,attributeFilter:['hidden','src']});

 const workerList=byId('workerList');let busy=false;
 async function fetchWorkerPictures(){if(byId('app')?.hidden||!workerList)return;const c=await photoClient();if(!c)return;const {data,error}=await c.from('profiles').select('id,avatar_url');if(!error){await Promise.all((data||[]).map(p=>window.amaPrivatePhotos.load(p.avatar_url,c)));pictureUrls=new Map((data||[]).filter(p=>p.avatar_url).map(p=>[p.id,p.avatar_url]));updateWorkerPictures()}}
 function updateWorkerPictures(){if(!workerList||busy)return;busy=true;try{workerList.querySelectorAll('.ama-worker-card').forEach(row=>{const id=row.dataset.workerCard;if(!id)return;const body=row.querySelector('.ama-worker-card-body');if(!body)return;let avatar=body.querySelector('.ama-worker-avatar,.ama-worker-avatar-fallback');const url=pictureUrls.get(id);if(url){if(!avatar||avatar.tagName!=='IMG'){const img=document.createElement('img');img.className='ama-worker-avatar';img.alt='Photo de profil';avatar?.replaceWith(img);avatar=img}const resolved=amaAvatarSrc(url);if(avatar.getAttribute('src')!==resolved)avatar.src=resolved}else if(avatar?.tagName==='IMG'){const fallback=document.createElement('span');fallback.className='ama-worker-avatar-fallback';fallback.textContent=(row.querySelector('strong')?.textContent||'').split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase();avatar.replaceWith(fallback)}if(!row.querySelector('.ama-photo-action')){const action=document.createElement('button');action.type='button';action.className='ama-photo-action';action.hidden=true;action.setAttribute('aria-hidden','true');action.tabIndex=-1;action.addEventListener('click',()=>{selectedProfile=id;avatarInput.click()});row.append(action)}})}finally{busy=false}}
 if(workerList)new MutationObserver(()=>updateWorkerPictures()).observe(workerList,{childList:true,subtree:false});
 // Déclenché à la connexion, sans altérer les fonctions internes de session.
 const app=byId('app');if(app){new MutationObserver(()=>{if(!app.hidden){refreshAvatar().catch(()=>{});fetchWorkerPictures().catch(()=>{})}else{window.amaPrivatePhotos.clear();pictureUrls.clear();panel?.classList.remove('ama-open');avatarImg?.classList.add('hidden')}}).observe(app,{attributes:true,attributeFilter:['hidden']})}
 if(app&&!app.hidden){refreshAvatar();fetchWorkerPictures()}
})();
