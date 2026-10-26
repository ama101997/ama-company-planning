
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const toggle=$('amaPasswordToggle'),panel=$('amaPasswordPanel'),verify=$('amaPasswordVerify'),change=$('amaPasswordChange');
 const old=$('amaPasswordOld'),newer=$('amaPasswordNew'),confirm=$('amaPasswordConfirm'),status=$('amaPasswordStatus'),reveal=$('amaPasswordReveal');
 const verifyButton=$('amaPasswordVerifyButton'),submit=$('amaPasswordSubmit');
 let verified=false,busy=false;
 const SUPABASE_URL='https://bleixaoiyoxvatsimkrw.supabase.co';
 const SUPABASE_KEY='sb_publishable_cUhSkP5GpURWVSme6GMVzA_6L3Gl9tm';
 function reset(){verified=false;old.value='';newer.value='';confirm.value='';reveal.checked=false;old.type=newer.type=confirm.type='password';status.textContent='';verify.hidden=false;change.hidden=true}
 function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');reset()}
 toggle.addEventListener('click',()=>{if(!panel.hidden){close();return}reset();panel.hidden=false;toggle.setAttribute('aria-expanded','true');old.focus()});
 $('amaPasswordCancelVerify').addEventListener('click',close);
 $('amaPasswordCancelChange').addEventListener('click',close);
 reveal.addEventListener('change',()=>{newer.type=confirm.type=reveal.checked?'text':'password'});
 verifyButton.addEventListener('click',async()=>{
  if(busy)return;
  status.textContent='';
  if(!old.value){status.textContent='Saisissez votre mot de passe actuel.';return}
  busy=true;verifyButton.disabled=true;
  try{
   if(!window.supabase?.createClient)throw Error('Supabase indisponible.');
   const primary=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
   const {data:{user},error:userError}=await primary.auth.getUser();
   if(userError||!user?.email)throw Error('Session expirée. Reconnectez-vous.');
   // Client éphémère : la vérification ne remplace pas la session connectée.
   const verifier=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const {data,error}=await verifier.auth.signInWithPassword({email:user.email,password:old.value});
   if(error||data?.user?.id!==user.id)throw Error('Mot de passe actuel incorrect.');
   await verifier.auth.signOut({scope:'local'});
   verified=true;old.value='';verify.hidden=true;change.hidden=false;newer.focus();
  }catch(e){status.textContent=e.message||'Vérification impossible.'}
  finally{busy=false;verifyButton.disabled=false}
 });
 submit.addEventListener('click',async()=>{
  if(busy||!verified)return;
  status.textContent='';
  if(newer.value.length<8){status.textContent='Utilisez au moins 8 caractères.';return}
  if(newer.value!==confirm.value){status.textContent='Les mots de passe ne correspondent pas.';return}
  busy=true;submit.disabled=true;
  try{
   const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
   const {data:{user},error:userError}=await client.auth.getUser();
   if(userError||!user)throw Error('Session expirée. Reconnectez-vous.');
   const {error}=await client.auth.updateUser({password:newer.value});
   if(error)throw error;
   close();
   // Confirmation hors du panneau fermé.
   toggle.querySelector('small').textContent='Mot de passe modifié avec succès';
  }catch(e){status.textContent=e.message||'Impossible de modifier le mot de passe.'}
  finally{busy=false;submit.disabled=false}
 });
})();
