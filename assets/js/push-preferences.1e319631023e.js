
(()=>{'use strict';
const modal=document.getElementById('amaAccountModal');const switches=[...document.querySelectorAll('[data-ama-push-pref]')];
const status=document.getElementById('amaPushStatus');let userId=null,loading=false;
function db(){return window.supabase?.createClient('https://bleixaoiyoxvatsimkrw.supabase.co','sb_publishable_cUhSkP5GpURWVSme6GMVzA_6L3Gl9tm')}
async function load(){if(loading)return;loading=true;try{const c=db();if(!c)return;const {data:{user}}=await c.auth.getUser();if(!user)return;userId=user.id;
const {data,error}=await c.from('push_preferences').select('assignment,planning,completed,reminder').eq('user_id',user.id).maybeSingle();
if(error){status.dataset.prefs='local';return}
status.dataset.prefs='cloud';const local=JSON.parse(localStorage.getItem('ama_push_prefs_'+user.id)||'null');const values=data||local||{};
for(const el of switches)if(typeof values[el.dataset.amaPushPref]==='boolean')el.checked=values[el.dataset.amaPushPref];
}catch(e){console.warn('Préférences push:',e)}finally{loading=false}}
for(const el of switches)el.addEventListener('change',async()=>{const c=db();if(!c)return;const {data:{user}}=await c.auth.getUser();if(!user){el.checked=!el.checked;return}
const prefs=Object.fromEntries(switches.map(x=>[x.dataset.amaPushPref,x.checked]));localStorage.setItem('ama_push_prefs_'+user.id,JSON.stringify(prefs));
const {error}=await c.from('push_preferences').upsert({user_id:user.id,planning:prefs.planning,completed:prefs.completed},{onConflict:'user_id'});
if(error){status.dataset.prefs='local';status.textContent='Préférences enregistrées uniquement sur cet appareil (migration SQL requise).'}
else{status.dataset.prefs='cloud';status.textContent='Préférences enregistrées (alertes importantes : réglage local uniquement).'}
});
new MutationObserver(()=>{if(!modal.hidden){load();if(typeof refreshNotificationButton==='function')refreshNotificationButton()}}).observe(modal,{attributes:true,attributeFilter:['hidden']});
})();
