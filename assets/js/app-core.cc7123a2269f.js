
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const client=window.supabase?.createClient('https://bleixaoiyoxvatsimkrw.supabase.co','sb_publishable_cUhSkP5GpURWVSme6GMVzA_6L3Gl9tm');
const uid=()=>crypto.randomUUID();

// M4: aucune donnée métier n'est chargée avant validation server-side.
let amaM4User=null,amaM4Deadline=0,amaM4Sending=false;
let amaM4CooldownTimer=null,amaM4ExpiryTimer=null,amaM4CodeAcceptedAt=0;
const amaM4El=id=>document.getElementById(id);
function amaM4DeviceKey(userId){return 'ama-m4-device:'+userId}
function amaM4StoredDevice(userId){
 try {const raw=localStorage.getItem(amaM4DeviceKey(userId));return raw?JSON.parse(raw):null;}catch{return null}
}
function amaM4Show(show){
 amaM4El('loginForm').hidden=show;amaM4El('amaM4Form').hidden=!show;
 if(show){stopAmaWelcome();amaM4El('loginScreen').classList.remove('hidden');amaM4El('app').hidden=true;amaM4El('amaSessionLoading').hidden=true;amaM4El('amaM4Code').focus();}
}
function amaM4Feedback(message){amaM4El('amaM4Message').textContent=message}
async function amaM4Invoke(action,extra={}){
 if(!client)throw Error('Connexion Supabase indisponible');
 const {data,error}=await client.functions.invoke('ama-m4',{body:{action,...extra}});
 if(error){
  let details=null;try{details=await error.context?.json?.();}catch{}
  const err=new Error(details?.error||'Le service de vérification est indisponible.');
  err.retryAfter=details?.retryAfter||0;err.lockedFor=details?.lockedFor||0;
  err.remaining=details?.remaining;throw err;
 }
 if(!data||typeof data.verified!=='boolean')throw Error('Réponse de sécurité invalide.');
 return data;
}
function amaM4ExpiryUpdate(){
 const help=amaM4El('amaM4ExpiryInfo');
 if(!amaM4CodeAcceptedAt){help.textContent='Le code est valable 4 minutes après sa création.';return;}
 if(Date.now()-amaM4CodeAcceptedAt>=4*60*1000){
  help.textContent='Le code a probablement expiré. Demandez-en un nouveau si nécessaire.';
  if(amaM4ExpiryTimer){clearInterval(amaM4ExpiryTimer);amaM4ExpiryTimer=null;}
 }else{help.textContent='Code valable environ 4 minutes. Un renvoi invalide le précédent.';}
}
function amaM4MarkCodeAccepted(){
 amaM4CodeAcceptedAt=Date.now();
 if(amaM4ExpiryTimer)clearInterval(amaM4ExpiryTimer);
 amaM4ExpiryUpdate();
 amaM4ExpiryTimer=setInterval(amaM4ExpiryUpdate,5000);
}
function amaM4ResetTimers(){
 if(amaM4CooldownTimer)clearTimeout(amaM4CooldownTimer);
 if(amaM4ExpiryTimer)clearInterval(amaM4ExpiryTimer);
 amaM4CooldownTimer=null;amaM4ExpiryTimer=null;amaM4CodeAcceptedAt=0;amaM4Deadline=0;
 amaM4ExpiryUpdate();
 amaM4El('amaM4Resend').disabled=false;
 amaM4El('amaM4Resend').textContent='Renvoyer un code';
}
function amaM4ApplyCooldown(seconds){
 amaM4Deadline=Date.now()+Math.max(0,Number(seconds)||0)*1000;
 if(amaM4CooldownTimer)clearTimeout(amaM4CooldownTimer);
 const b=amaM4El('amaM4Resend');
 const update=()=>{
  const remaining=Math.max(0,Math.ceil((amaM4Deadline-Date.now())/1000));
  b.disabled=remaining>0||amaM4Sending;
  b.textContent=remaining?'Renvoyer dans '+remaining+' s':'Renvoyer un code';
  if(remaining&&amaM4User)amaM4CooldownTimer=setTimeout(update,1000);
  else amaM4CooldownTimer=null;
 };update();
}
async function amaM4Send(isResend=false){
 if(amaM4Sending||!amaM4User)return;
 if(Date.now()<amaM4Deadline)return;
 amaM4Sending=true;amaM4El('amaM4Resend').disabled=true;
 amaM4Feedback('Demande d’envoi en cours…');
 try{
  const response=await amaM4Invoke('send');
  if(response.enabled===true&&response.verified===false&&response.sent===true){
   amaM4El('amaM4Code').value='';
   amaM4ApplyCooldown(response.retryAfter||60);
   amaM4MarkCodeAccepted();
   amaM4Feedback(isResend ? 'Un nouveau code vient d’être envoyé. Le code précédent n’est plus valable.' : 'Un code de vérification vient d’être envoyé à votre adresse e-mail. Il est valable 4 minutes.');
  }else if(response.verified===true){
   amaM4Feedback('La vérification par code n’est plus nécessaire pour ce compte. Cliquez sur « Changer de compte » puis reconnectez-vous.');
   amaM4ResetTimers();
  }else{
   amaM4Feedback('L’envoi du code n’a pas été confirmé. Réessayez dans un instant.');
  }
 }catch(e){
  if(e.retryAfter)amaM4ApplyCooldown(e.retryAfter);
  if(e.lockedFor)amaM4ApplyCooldown(e.lockedFor);
  amaM4Feedback(e.lockedFor?'Trop de tentatives. Réessayez dans 15 minutes.':e.retryAfter?'Attendez avant de demander un autre code.':e.message);
 }finally{
  amaM4Sending=false;
  if(amaM4User&&Date.now()>=amaM4Deadline)amaM4El('amaM4Resend').disabled=false;
 }
}
async function amaM4Gate(user){
 const state=await amaM4Invoke('status',{device:amaM4StoredDevice(user.id)});
 if(state.verified){amaM4User=null;amaM4Show(false);return true;}
 amaM4User=user;
 amaM4ResetTimers();amaM4El('amaM4Code').value='';amaM4Feedback('');amaM4Show(true);
 await amaM4Send(false);
 return false;
}
function amaM4Bind(){
 amaM4El('amaM4Form').addEventListener('submit',async e=>{
  e.preventDefault();if(!amaM4User)return;
  const b=amaM4El('amaM4Verify');const code=amaM4El('amaM4Code').value.replace(/\D/g,'');
  if(!/^\d{6}$/.test(code)){amaM4Feedback('Saisissez les six chiffres du code.');return;}
  b.disabled=true;amaM4Feedback('Vérification en cours…');
  try{
   const result=await amaM4Invoke('verify',{code,rememberDevice:amaM4El('amaM4Remember').checked});
   if(result.device){try{localStorage.setItem(amaM4DeviceKey(amaM4User.id),JSON.stringify(result.device));}catch{}}
   const user=amaM4User;amaM4User=null;amaM4El('amaM4Code').value='';amaM4ResetTimers();
   amaM4Show(false);await startSession(user);showAmaWelcome(session?.name||'',true);
  }catch(err){
   amaM4Feedback(err.lockedFor?'Compte temporairement bloqué pendant 15 minutes.':typeof err.remaining==='number'?`Code invalide. ${err.remaining} tentative(s) restante(s).`:err.message);
  }finally{b.disabled=false;}
 });
 amaM4El('amaM4Code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6)})
 amaM4El('amaM4Resend').onclick=()=>amaM4Send(true);
 amaM4El('amaM4Cancel').onclick=async()=>{
  amaM4User=null;amaM4ResetTimers();amaM4Show(false);amaM4El('loginScreen').classList.remove('hidden');
  await client.auth.signOut({scope:'local'});amaM4El('loginPin').value='';
 };
}

let lastSnapshot={users:[],apartments:[],missions:[]},busy=false;
let amaInvoiceCompany="ama",amaCompanyRows=[],amaCompaniesOwner=null,amaMailBusy=false,amaIssuerRemote=null,amaIssuerRemoteOwner=null,amaBillingConfigured=false,amaBillingOwner=null,apartmentFinances=new Map(),missionFinances=new Map(),orderClients=[],missionNotifications=[],fusionInvites=[],fusionParticipants=[];
const euro=n=>Number(n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
async function loadFinances(){
 if(!session||session.role!=='admin'){amaIssuerRemote=null;amaIssuerRemoteOwner=null;apartmentFinances.clear();missionFinances.clear();return;}
 const [a,m,c]=await Promise.all([client.from('apartment_finances').select('apartment_id,reference_hours,hourly_rate'),client.from('mission_finances').select('mission_id,reference_hours,hourly_rate,revenue'),client.from('order_clients').select('*').order('name')]);
 if(a.error||m.error||c.error)throw (a.error||m.error||c.error);
 orderClients=c.data||[];
 const issuerConfig=await client.from('ama_invoice_companies').select('*').order('id');amaCompanyRows=issuerConfig.error?[]:(issuerConfig.data||[]);amaCompaniesOwner=session.id;amaIssuerRemote=amaCompanyRows.find(c=>c.id===amaInvoiceCompany)?.settings;amaIssuerRemoteOwner=session.id;
 apartmentFinances=new Map((a.data||[]).map(x=>[x.apartment_id,x]));
 missionFinances=new Map((m.data||[]).map(x=>[x.mission_id,x]));
 const overrides=await client.from('ama_mission_billing_overrides').select('mission_id,billed_hours,hourly_rate');amaBillingConfigured=!overrides.error;
 if(!overrides.error)for(const row of overrides.data||[]){const base=missionFinances.get(row.mission_id)||{};missionFinances.set(row.mission_id,{...base,reference_hours:Number(row.billed_hours),hourly_rate:Number(row.hourly_rate),revenue:Math.round(Number(row.billed_hours)*Number(row.hourly_rate)*100)/100,billing_override:true});}
}

const normalizeUser=u=>({id:u.id,name:u.full_name||'Utilisateur',email:u.email||'',role:u.role==='admin'?'admin':'worker',active:u.active!==false});
const normalizeApartment=a=>({id:a.id,name:a.name,address:a.address||'',access:a.access_code||'',beds:a.beds||0,duration:Number(a.duration||0),clientId:a.client_id||null,active:a.active!==false});
const normalizeMission=m=>({id:m.id,date:m.mission_date,workerId:m.intervenant_id,apartmentId:m.apartment_id,hours:Number(m.hours||0),status:m.status||'planned',notes:m.notes||'',createdAt:m.created_at||null,completedAt:m.completed_at||null,completedBy:m.completed_by||null,prolonged:m.prolonged===true,nonEntryComment:m.non_entry_comment||''});
const encodeApartment=a=>({id:a.id,name:a.name,address:a.address||'',access_code:a.access||'',beds:Number(a.beds||0),duration:Number(a.duration||0),client_id:a.clientId||null,active:a.active!==false});
const encodeMission=m=>({id:m.id,mission_date:m.date,intervenant_id:m.workerId,apartment_id:m.apartmentId,hours:Number(m.hours||0),status:m.status,notes:m.notes||'',prolonged:m.prolonged===true});
async function loadFusion(){
 if(!session){fusionInvites=[];fusionParticipants=[];return;}
 const [i,p]=await Promise.all([client.from('mission_fusion_invites').select('*'),client.from('mission_fusion_participants').select('*')]);
 if(i.error||p.error){console.warn('Fusion non configurée dans Supabase',i.error||p.error);fusionInvites=[];fusionParticipants=[];return;}
 fusionInvites=i.data||[];fusionParticipants=p.data||[];
}
function sharedIds(m){const ids=fusionParticipants.filter(p=>p.mission_id===m.id).map(p=>p.user_id);return ids.length?[...new Set([m.workerId,...ids])]:[m.workerId]}
function sharedHours(m){return Number(m.hours||0)/sharedIds(m).length}
function fusionLabel(m){const ids=sharedIds(m);return ids.length>1?`<p style="color:#805600">🤝 Mission partagée : ${esc(ids.map(id=>userById(id)?.name||'Collègue').join(', '))} · ${hours(sharedHours(m))} chacun</p>`:''}
async function reload(){
 if(!client)throw Error('Impossible de charger Supabase. Vérifiez la connexion Internet.');
 const [p,a,m]=await Promise.all([client.rpc('ama_list_profiles'),client.from('apartments').select('*'),client.from('missions').select('*')]);
 for(const r of [p,a,m])if(r.error)throw r.error;
 data={users:p.data.map(normalizeUser),apartments:a.data.map(normalizeApartment),missions:m.data.map(normalizeMission)};
 for(const m of data.missions){m.workerName=data.users.find(u=>u.id===m.workerId)?.name||'';m.apartmentName=data.apartments.find(a=>a.id===m.apartmentId)?.name||'';}
  lastSnapshot=structuredClone(data);
  if(session){await loadNotifications();await loadFusion();}
  if(session?.role==='admin'){await loadFinances();void amaV6Refresh?.(true);}
}
async function persist(){
 if(busy)return;
 busy=true;
 try{
  const old=lastSnapshot;
  for(const [key,table,encode] of [['apartments','apartments',encodeApartment],['missions','missions',encodeMission]]){
   const prior=new Map(old[key].map(x=>[x.id,x]));
   for(const row of data[key]){
    if(JSON.stringify(row)===JSON.stringify(prior.get(row.id)))continue;
    const payload=encode(row);
    const r=prior.has(row.id)?await client.from(table).update(payload).eq('id',row.id):await client.from(table).insert(payload);
    if(r.error)throw r.error;
   }
   for(const row of old[key])if(!data[key].some(x=>x.id===row.id)){
    const r=await client.from(table).delete().eq('id',row.id);
    if(r.error)throw r.error;
   }
  }
  for(const u of data.users){const prior=old.users.find(x=>x.id===u.id);if(prior&&prior.active!==u.active){const r=await client.from('profiles').update({active:u.active}).eq('id',u.id);if(r.error)throw r.error;}}
  await reload();if(session)render();
 }catch(err){alert('Enregistrement refusé : '+err.message+' — rechargement des données.');try{await reload();if(session)render()}catch(e){console.error(e)}}finally{busy=false;}
}

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const monthNow=()=>today().slice(0,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hours=n=>`${Number(n||0).toLocaleString('fr-FR',{maximumFractionDigits:2})} h`;
const dateFr=d=>d?d.split('-').reverse().join('/'):'—';
let data={users:[],apartments:[],missions:[]},session=null,tab='dashboard';
function save(){void persist()}
function userById(id){return data.users.find(u=>u.id===id)}
function activeWorkers(){return data.users.filter(u=>u.role==='worker'&&u.active!==false)}
function activeApartments(){return data.apartments.filter(a=>a.active!==false)}
function selectOptions(items,first='— choisir —',val='id',label='name'){return `<option value="">${esc(first)}</option>`+items.map(x=>`<option value="${esc(x[val])}">${esc(x[label])}</option>`).join('')}
function fillSelects(){
 
 $('#missionWorker').innerHTML=selectOptions(activeWorkers());
 $('#missionApartment').innerHTML=selectOptions(activeApartments().map(a=>({...a,name:`${a.name} · ${hours(a.duration)}`})));
 $('#planningWorkerFilter').innerHTML='<option value="">Tous les intervenants</option>'+activeWorkers().map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
 $('#historyWorker').innerHTML='<option value="">Tous les intervenants</option>'+activeWorkers().map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
}
let amaWelcomeTimers=[];
function stopAmaWelcome(){
 amaWelcomeTimers.forEach(clearTimeout);amaWelcomeTimers=[];
 const layer=document.getElementById('amaWelcomeOverlay');
 if(layer){layer.classList.remove('ama-show','ama-fade');layer.style.display='none';}
}
function showAmaWelcome(fullName,ready=false){
 const layer=document.getElementById('amaWelcomeOverlay'),loading=document.getElementById('amaWelcomeLoading'),success=document.getElementById('amaWelcomeSuccess');
 if(!ready){stopAmaWelcome();layer.setAttribute('role','status');layer.setAttribute('aria-live','polite');layer.setAttribute('aria-label','Connexion et chargement de votre espace');loading.hidden=false;success.hidden=true;layer.style.display='flex';layer.classList.add('ama-show');loading.querySelectorAll('.ama-welcome-arc').forEach(arc=>{arc.classList.remove('ama-run');void arc.getBoundingClientRect();arc.classList.add('ama-run');});return;}
 document.getElementById('amaWelcomeName').textContent='Bienvenue '+(String(fullName||'').trim().split(/\s+/)[0]||'')+' !';
 loading.hidden=true;success.hidden=false;amaWelcomeTimers.push(setTimeout(()=>layer.classList.add('ama-fade'),850));amaWelcomeTimers.push(setTimeout(stopAmaWelcome,1250));
}
let amaLoginBusy=false;
async function login(){
 if(amaLoginBusy)return;
 const email=$('#loginEmail').value.trim().toLowerCase(),password=$('#loginPin').value;
 amaLoginBusy=true;document.getElementById('amaLoginSubmit').disabled=true;$('#loginError').textContent='';showAmaWelcome('',false);
 try{
  if(!client)throw Error('Bibliothèque Supabase indisponible.');
  const r=await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;
   if(await amaM4Gate(r.data.user)){await startSession(r.data.user);showAmaWelcome(session?.name||'',true);}
 }catch(e){stopAmaWelcome();$('#loginError').textContent=e.message||'Connexion impossible.';$('#loginScreen').classList.remove('hidden');$('#app').hidden=true;}
 finally{amaLoginBusy=false;document.getElementById('amaLoginSubmit').disabled=false;}
}
async function startSession(authUser){
 await reload();const u=data.users.find(x=>x.id===authUser.id);
 if(!u||u.active===false){await client.auth.signOut();data={users:[],apartments:[],missions:[]};lastSnapshot=structuredClone(data);throw Error('Votre compte n’a pas de profil actif. Contactez l’administrateur.');}
 session={id:u.id,role:u.role,name:u.name};await loadFusion();if(u.role==='admin')await loadFinances();await loadNotifications();$('#loginError').textContent='';$('#loginPin').value='';$('#loginPin').type='password';document.getElementById('amaLoginEye').setAttribute('aria-pressed','false');document.getElementById('amaLoginEye').setAttribute('aria-label','Afficher le mot de passe');
 $('#loginScreen').classList.add('hidden');$('#app').hidden=false;
 document.body.classList.toggle('ama-worker',u.role!=='admin');document.getElementById('financePanel').hidden=u.role!=='admin';document.getElementById('adminDashboardRevenue').hidden=u.role!=='admin';$('#rolePill').textContent=u.role==='admin'?'Administrateur':'Intervenant';$('#welcomeTitle').textContent=`Bonjour ${u.name} 👋`;
 $('#welcomeText').textContent=u.role==='admin'?'Gérez les plannings, les équipes et les validations.':'Voici vos missions. Après chaque intervention, validez la mission et confirmez les heures.';
 $('#workerReport').classList.remove('hidden');$('#emailHoursReport').classList.toggle('hidden',u.role!=='admin');$('#emailHoursNotice').style.display=u.role==='admin'?'block':'none';$('#reportWorkerWrap').classList.toggle('hidden',u.role!=='admin');
 $('#downloadHoursExcel').classList.toggle('hidden',u.role!=='admin');
 $('#reportTitle').textContent=u.role==='admin'?'Suivi des intervenants':'Mon relevé d’heures';
 $('#reportDescription').textContent=u.role==='admin'?'Heures validées et relevés mensuels.':'Consultez vos heures validées et téléchargez votre relevé PDF.';
   $('#reportMonth').value=monthNow();$('#financeMonth').value=monthNow();$('#dashRevenueMonth').value=monthNow();refreshReportWorkers();
 $('#adminTab').classList.toggle('hidden',u.role!=='admin');$('#invoicesTab').classList.toggle('hidden',u.role!=='admin');$('#createMissionCard').classList.toggle('hidden',u.role!=='admin');
 $('#planningWorkerFilterWrap').classList.toggle('hidden',u.role!=='admin');$('#historyWorkerWrap').classList.toggle('hidden',u.role!=='admin');
 if(u.role==='worker'){$('#planningWorkerFilter').value=u.id;$('#historyWorker').value=u.id}
 amaTabHistory=[];amaManageView='overview';amaWalletHidden=true;document.getElementById('amaWalletEye').innerHTML=AMA_WALLET_EYE_OFF;document.getElementById('amaWalletEye').setAttribute('aria-label','Afficher le montant');document.getElementById('amaWalletEye').setAttribute('aria-pressed','false');render();setTab('dashboard',true);if(u.role==='worker')amaRefreshWallet();
 const reminderUrl=new URL(location.href);
 if(u.role==='worker'&&reminderUrl.searchParams.get('ama_view')==='pending'){
  setTab('planning');$('#planningDate').value='';$('#planningStatusFilter').value='planned';renderPlanning();
  reminderUrl.searchParams.delete('ama_view');history.replaceState(null,'',reminderUrl);
 }

}
// Audit 2026-10-22: discard loaded records, forms, photos and closures on sign-out.
async function logout(){
 const result=await client?.auth.signOut();
 if(result?.error){alert('Déconnexion impossible. Réessayez avant de laisser cet appareil.');return;}
 session=null;amaRRClear();amaClosePdf();stopAmaWelcome();amaClosePhotoMission();
 for(const key of Object.keys(localStorage))if(key.startsWith('ama_invoice_issuer_'))localStorage.removeItem(key);
 document.getElementById('app').hidden=true;
 location.replace(location.protocol==='file:'?location.href.split('#')[0].split('?')[0]:location.origin+location.pathname);
}
function canSee(m){return session.role==='admin'||m.workerId===session.id||sharedIds(m).includes(session.id)}
function getVisibleMissions(){return data.missions.filter(canSee)}
function missionBadge(m){return m.prolonged?'<span class="badge cancelled">↗ Prolongation du séjour</span>':statusBadge(m.status)}
function statusBadge(s){return s==='not_entered'?'<span class="badge ama-non-entry-badge">Non entrés</span>':s==='done'?'<span class="badge done">✓ Réalisée</span>':s==='cancelled'?'<span class="badge cancelled">Annulée</span>':'<span class="badge planned">À réaliser</span>'}
function renderStats(){
 const ms=getVisibleMissions(),todayM=ms.filter(m=>m.date===today()),monthM=ms.filter(m=>m.date?.startsWith(monthNow()));
 $('#statToday').textContent=todayM.length;$('#statPending').textContent=ms.filter(m=>m.status==='planned'&&!m.prolonged).length;
 $('#statDone').textContent=monthM.filter(m=>m.status==='done').length;
 $('#statHours').textContent=hours(monthM.filter(m=>m.status==='done').reduce((s,m)=>s+sharedHours(m),0));
 $('#todayLabel').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function apartmentInfo(m){
 const a=data.apartments.find(x=>x.id===m.apartmentId);
 if(!a)return '';
 const address=String(a.address||'').trim(),access=String(a.access||'').trim(),beds=Number(a.beds||0);
 const ico=(paths)=>`<svg class="ama-inline-icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
 const mapIcon=ico('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>');
 const keyIcon=ico('<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2"/>');
 const bedIcon=ico('<path d="M3 19V6m18 13V6M3 15h18M5 11V8h6v3m2 0V8h6v3"/>');
 const maps=address?`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer" class="ama-map-button">${ico('<path d="m9 18 9-12M10 6h8v8"/>')} Ouvrir l’itinéraire</a>`:'';
 return `<div class="apt-details ama-apt-modern">${address?`<div class="ama-apt-address">${mapIcon}<div><small>ADRESSE DU LOGEMENT</small><p>${esc(address)}</p></div></div>`:''}${maps}<div class="ama-apt-facts">${access?`<div class="ama-apt-fact">${keyIcon}<div><small>Accès</small><strong>${esc(access)}</strong></div></div>`:''}<div class="ama-apt-fact">${bedIcon}<div><small>Couchages</small><strong>${beds}</strong></div></div></div></div>`;
}
function clearApartmentEditor(){
 amaDiscardFormReturn('apartmentForm');
 document.getElementById('apartmentForm').hidden=true;document.querySelector('[data-manage-add="apartmentForm"]')?.setAttribute('aria-expanded','false');
   $('#apartmentForm').reset();$('#apartmentEditId').value='';$('#apartmentDuration').value='1';$('#apartmentReferenceHours').value='1';$('#apartmentHourlyRate').value='0';$('#apartmentBeds').value='0';
 $('#apartmentSaveBtn').textContent='＋ Ajouter le logement';$('#apartmentCancelBtn').classList.add('hidden');
}
function renderPlanning(){window.amaCenterPlanningDate?.();amaV8PaintPlanning();void amaRRQueueLoad();void amaStayLoad();void amaSyncPoll();
 let ms=getVisibleMissions();
 // Respect the selected status, including completed missions for administrators.
 const planningStatus=$('#planningStatusFilter')?.value||'';
 if(planningStatus==='planned')ms=ms.filter(m=>m.status==='planned'&&!m.prolonged);
 if(planningStatus==='done')ms=ms.filter(m=>m.status==='done'&&!m.prolonged);
 const search=document.getElementById('amaV6Search')?.value||'';if(search)ms=ms.filter(m=>amaV6Fold(m.apartmentName).includes(amaV6Fold(search)));
 const d=$('#planningDate').value,w=$('#planningWorkerFilter').value;
 if(d)ms=ms.filter(m=>m.date===d);
 if(session.role==='admin'&&w)ms=ms.filter(m=>sharedIds(m).includes(w));
 ms.sort((a,b)=>{
  // Pour l'intervenant, les missions avec consignes passent en premier.
  if(session.role==='worker'){
    const aPriority=a.status==='planned'&&Boolean(String(a.notes||'').trim());
    const bPriority=b.status==='planned'&&Boolean(String(b.notes||'').trim());
    if(aPriority!==bPriority)return aPriority?-1:1;
  }
  return a.date.localeCompare(b.date)||String(a.workerName).localeCompare(String(b.workerName));
 });
 const opened=new Set([...$('#missionList').querySelectorAll('[data-plan-id][open]')].map(e=>e.dataset.planId));
 $('#missionList').innerHTML=ms.length?ms.map(m=>{
 const isMine=m.workerId===session.id,isParticipant=sharedIds(m).includes(session.id),canValidate=(session.role==='admin'||(session.role==='worker'&&isParticipant))&&m.status==='planned'&&!m.prolonged;
  const workerActions=session.role==='worker'&&isMine&&m.status==='planned'?`<div class="ama-mission-actions"><button class="ama-mini-action ama-prolong-action" data-action="prolong" data-id="${esc(m.id)}" title="${m.prolonged?'Annuler le signalement de prolongation':'Voyageur a prolongé'}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v5m-2.5-2.5h5"/></svg><span>${m.prolonged?'Annuler':'Prolongé'}</span></button>${!m.prolonged?`<button class="ama-mini-action" data-action="reschedule" data-id="${esc(m.id)}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h4"/></svg><span>Reporter</span></button><button class="ama-mini-action" data-action="transfer" data-id="${esc(m.id)}"><svg viewBox="0 0 24 24"><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/></svg><span>Transférer</span></button><button class="ama-mini-action" data-action="fusion" data-id="${esc(m.id)}"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M18 15c2 0 3 2 3 4v1"/></svg><span>Fusionner</span></button><button class="ama-mini-action ama-non-entry-action" data-action="non-entry" data-id="${esc(m.id)}"><svg viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M9 3v18M13 12h2"/></svg><span>Non entrés</span></button>`:''}</div>`:'';
 if(session.role==='worker'){
  const detailAllowed=isParticipant;
  return `<article class="mission ama-mission-card ama-compact-worker ${detailAllowed?'ama-tappable':''}" ${detailAllowed?`data-open-mission="${esc(m.id)}" tabindex="0" role="button" aria-label="Ouvrir la mission ${esc(m.apartmentName||'Logement')}"`:''}>
    <div class="ama-mission-main"><div class="ama-mission-overview"><h4>${esc(m.apartmentName||'Logement')}</h4><span class="ama-mission-overview-badge">${missionBadge(m)}</span></div>
    <div class="ama-mission-meta"><span>📅 ${dateFr(m.date)}</span><span>◷ ${hours(m.status==='not_entered'?0:sharedHours(m))}</span><span>👤 ${esc(m.workerName||userById(m.workerId)?.name||'Intervenant')}</span></div>
    ${m.notes?'<div class="ama-compact-consigne">📌 Consignes à lire</div>':''}${fusionLabel(m)}
    <div class="ama-compact-open">Voir la fiche de mission <span aria-hidden="true">›</span></div></div>
    ${workerActions?`<div class="right ama-compact-actions">${workerActions}</div>`:''}
  </article>`;
 }
 return `<article class="mission ama-mission-card ama-plan-card"><details class="ama-plan-detail" data-plan-id="${esc(m.id)}" ${opened.has(m.id)?'open':''}><summary><span class="ama-plan-heading"><strong>${esc(m.apartmentName||'Logement')}</strong>${missionBadge(m)}</span><span class="ama-mission-meta"><span><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>${dateFr(m.date)}</span><span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>${esc(m.workerName||userById(m.workerId)?.name||'Intervenant')}</span><span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${hours(m.status==='not_entered'&&session.role==='worker'?0:session.role==='worker'?sharedHours(m):m.hours)}${session.role==='worker'&&sharedIds(m).length>1?' (ma part)':''}</span></span>${m.notes?'<span class="ama-plan-note">Consignes à lire</span>':''}<span class="ama-plan-chevron" aria-hidden="true">⌄</span></summary><div class="ama-plan-expanded">${session?.role==='worker'?`<button type="button" class="ama-v6-report-link" data-v6-incident="${esc(m.id)}">Signaler un problème</button>`:''}${fusionLabel(m)}${m.notes?`<div class="mission-note" role="note"><strong>📌 Consignes importantes pour cette mission</strong><div class="note-body">${esc(m.notes)}</div></div>`:''}${m.status==='not_entered'?`<div class="ama-non-entry-note"><strong>Voyageurs non entrés</strong><p>${esc(m.nonEntryComment||'Les voyageurs ne sont pas entrés dans le logement.')}</p><small>Intervenant : 0 h · Référence admin conservée</small></div>`:''}${apartmentInfo(m)}<p class="ama-bill-summary">Facturation client : ${hours(missionFinances.get(m.id)?.reference_hours??apartmentFinances.get(m.apartmentId)?.reference_hours??0)} · ${euro(missionFinances.get(m.id)?.revenue??Number(apartmentFinances.get(m.apartmentId)?.reference_hours||0)*Number(apartmentFinances.get(m.apartmentId)?.hourly_rate||0))}</p>${m.status==='done'?`<p style="color:#15803d">Validée ${m.completedAt?`le ${dateFr(m.completedAt.slice(0,10))}`:''}${m.completedBy?` par ${esc(m.completedBy)}`:''}</p>`:''}${canValidate?`<button type="button" class="primary ama-validate" data-action="complete" data-id="${esc(m.id)}">✓ Valider la mission</button>`:''}</div></details><details class="ama-plan-menu"><summary aria-label="Actions pour ${esc(m.apartmentName||'la mission')}">⋮</summary><div><button type="button" data-action="edit" data-id="${esc(m.id)}">Modifier</button><button type="button" class="danger" data-action="delete" data-id="${esc(m.id)}">Supprimer</button></div></details></article>`;
 }).join(''):'<div class="empty">Aucune mission pour la date, l’intervenant et le statut sélectionnés.</div>';
 $('#planningTitle').textContent=session.role==='admin'?'Missions du jour':'Mon planning';
 document.getElementById('tab-planning').classList.toggle('ama-plan-admin',session.role==='admin');
 const overview=document.getElementById('amaPlanOverview');overview.hidden=session.role!=='admin';overview.textContent=ms.length+' mission(s) · '+hours(ms.filter(m=>!m.prolonged&&m.status!=='cancelled').reduce((n,m)=>n+Number(m.hours||0),0))+' · '+new Set(ms.flatMap(m=>sharedIds(m))).size+' intervenant(s)';
 $('#amaPlanningPageTitle').textContent=session.role==='admin'?'Planning des équipes':'Mon planning';
 $('#amaPlanningPageDesc').textContent=session.role==='admin'?'Organisez et suivez les interventions.':'Consultez et gérez vos missions.';
 if(session.role==='worker'){
  const pending=fusionInvites.filter(i=>i.invitee_id===session.id&&i.status==='pending');
  const box=pending.map(i=>{const m=data.missions.find(m=>m.id===i.mission_id);return `<div class="mission" style="border-color:#e9c35c;background:#fffbeb"><div><strong>🤝 Invitation à partager une mission</strong><p>${esc(m?.apartmentName||'Mission')} · ${m?dateFr(m.date):''} · ${m?hours(m.hours):''}</p><p>Invité par ${esc(userById(i.inviter_id)?.name||'un collègue')}</p></div><div class="right"><button class="primary mini" data-fusion-reply="yes" data-id="${esc(i.id)}">Accepter</button><button class="ghost mini" data-fusion-reply="no" data-id="${esc(i.id)}">Refuser</button></div></div>`}).join('');
  $('#missionList').insertAdjacentHTML('afterbegin',box);
 }

}
let amaHistoryPage=0,amaHistoryFilterKey='';
function renderHistory(){
 if(!session)return;
 const mon=$('#historyMonth').value,w=$('#historyWorker').value,status=$('#historyStatusFilter')?.value||'';
 const key=JSON.stringify([session.id,session.role,mon,w,status]);
 if(key!==amaHistoryFilterKey){amaHistoryPage=0;amaHistoryFilterKey=key;}
 let ms=getVisibleMissions();
 if(status==='prolonged')ms=ms.filter(m=>m.prolonged);
 else if(status)ms=ms.filter(m=>m.status===status&&!m.prolonged);
 if(mon)ms=ms.filter(m=>m.date?.startsWith(mon));
 if(session.role==='admin'&&w)ms=ms.filter(m=>m.workerId===w||sharedIds(m).includes(w));
 ms.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.id).localeCompare(String(b.id)));
 const pageCount=Math.max(1,Math.ceil(ms.length/5));
 amaHistoryPage=Math.max(0,Math.min(amaHistoryPage,pageCount-1));
 const opened=new Set([...$('#historyBody').querySelectorAll('details[open]')].map(el=>el.dataset.missionId));
 const pageMissions=ms.slice(amaHistoryPage*5,amaHistoryPage*5+5);
 let historyDate=null;
 $('#historyBody').innerHTML=ms.length?pageMissions.map(m=>{
  const worker=m.workerName||userById(m.workerId)?.name||'—';
  const duration=m.status==='not_entered'?(session.role==='admin'?`${hours(missionFinances.get(m.id)?.reference_hours??0)} (référence admin)`:'0 h'):hours(m.hours);
  const groupHeading=historyDate!==m.date?`<div class="ama-history-date"><time datetime="${esc(m.date||'')}">${m.date?esc(new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(m.date+'T12:00:00'))):'Date non renseignée'}</time><span>${pageMissions.filter(item=>item.date===m.date).length} mission${pageMissions.filter(item=>item.date===m.date).length>1?'s':''}</span></div>`:'';
  historyDate=m.date;
  return `${groupHeading}<details class="ama-history-item" data-mission-id="${esc(m.id)}" ${opened.has(m.id)?'open':''}><summary><span class="ama-history-main"><strong>${esc(m.apartmentName||'—')}</strong><span>${esc(worker)}</span></span><span class="ama-history-meta"><b>${duration}</b>${missionBadge(m)}</span><span class="ama-history-chevron" aria-hidden="true">⌄</span></summary><div class="ama-history-detail"><strong>Validation</strong><p>${m.completedAt?`${dateFr(m.completedAt.slice(0,10))} · ${esc(m.completedBy||'—')}`:'Aucune validation pour le moment.'}</p>${m.status==='not_entered'?`<p><strong>Commentaire :</strong> ${esc(m.nonEntryComment||'Les voyageurs ne sont pas entrés dans le logement.')}</p>`:''}${session.role==='admin'?`<button type="button" class="danger mini" data-history-delete="${esc(m.id)}">Supprimer la mission</button>`:''}</div></details>`;
 }).join(''):'<p class="empty">Aucune intervention pour cette période.</p>';
 $('#amaHistoryPage').textContent=`Page ${amaHistoryPage+1} / ${pageCount} · ${ms.length} mission${ms.length>1?'s':''}`;
 $('#amaHistoryPrev').disabled=amaHistoryPage===0;
 $('#amaHistoryNext').disabled=amaHistoryPage===pageCount-1;
}
function renderOrderClients(){
 if(session.role!=='admin')return;
 const sel=$('#apartmentClient'),current=sel.value;
 sel.innerHTML='<option value="">Non attribué</option>'+orderClients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 sel.value=orderClients.some(c=>c.id===current)?current:'';
 $('#clientList').innerHTML=orderClients.length?orderClients.map(c=>`<div class="mission"><div><strong>${esc(c.name)}</strong><p>${esc(c.billing_address||'Adresse non renseignée')}</p><p>${esc(c.email||'')}</p></div><div class="right"><button class="soft mini" data-client-edit="${esc(c.id)}">Modifier</button></div></div>`).join(''):'<div class="empty">Aucun donneur d’ordre enregistré.</div>';
}
function renderAdmin(){renderOrderClients();
 $('#workerList').innerHTML=activeWorkers().length?activeWorkers().map(u=>`<div class="mission ama-worker-card" data-worker-card="${esc(u.id)}" role="button" tabindex="0" aria-label="Ouvrir la fiche de ${esc(u.name)}"><div class="ama-worker-card-body"><span class="ama-worker-avatar-fallback" aria-hidden="true">${esc((u.name||'').split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase())}</span><div class="ama-worker-details"><strong>${esc(u.name)}</strong><p>${u.active===false?'Compte désactivé':'● Compte actif'}</p></div></div><span class="ama-worker-chevron" aria-hidden="true">›</span></div>`).join(''):'<div class="empty">Aucun intervenant enregistré.</div>';
 const aptList=activeApartments();$('#amaAptCount').textContent='('+aptList.length+')';
 $('#apartmentList').innerHTML=aptList.length?aptList.map(a=>`<div class="ama-apt-card" data-apt-name="${esc(a.name.toLowerCase())}"><div class="ama-apt-card-head"><strong>⌂ ${esc(a.name)}</strong><small>● Actif</small></div><p class="ama-apt-address">${esc(a.address||'Adresse non renseignée')}</p><div class="ama-apt-metrics"><span><small>Intervenant</small>${hours(a.duration)}</span><span><small>Référence</small>${hours(apartmentFinances.get(a.id)?.reference_hours??a.duration)}</span><span><small>Tarif client</small>${euro(apartmentFinances.get(a.id)?.hourly_rate??0)}/h</span></div><details><summary>Voir les détails et modifier</summary><p>Donneur d’ordre : ${esc(orderClients.find(c=>c.id===a.clientId)?.name||'Non attribué')}</p><p>🛏 ${Number(a.beds||0)} couchage(s)</p>${a.access?`<p>🔑 ${esc(a.access)}</p>`:''}<div class="right"><button class="soft mini" data-action="apt-edit" data-id="${esc(a.id)}">✎ Modifier</button><button class="danger mini" data-action="apt-delete" data-id="${esc(a.id)}">Désactiver</button></div></details></div>`).join(''):'<div class="empty">Aucun logement enregistré.</div>';
}
async function loadNotifications(){
 if(!session){missionNotifications=[];return;}
 const r=await client.from('mission_notifications').select('id,title,message,is_read,created_at').order('created_at',{ascending:false}).limit(100);
 if(r.error)throw r.error;
 const h=await client.from('ama_hidden_notifications').select('notification_id');
 if(h.error)throw h.error;
 const hidden=new Set((h.data||[]).map(x=>x.notification_id));
 missionNotifications=(r.data||[]).filter(n=>!hidden.has(n.id));
 if(session.role==='worker'){
  const owner=session.id;
  const reminders=await client.from('ama_validation_reminders').select('id,title,message,is_read,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(1);
  if(session?.id!==owner)return;
  if(!reminders.error && data.missions.some(m=>m.workerId===owner&&m.status==='planned'&&!m.prolonged&&m.date<=today())){
   missionNotifications=[...(reminders.data||[]).map(n=>({...n,validationReminder:true})),...missionNotifications];
  }
 }

 if(session?.role==='admin'){const owner=session.id;const reminderResult=await client.rpc('ama_admin_notice_list');if(session?.id===owner&&!reminderResult.error)missionNotifications=[...(reminderResult.data||[]).map(n=>({...n,adminReminder:true})),...missionNotifications];}
}
document.addEventListener('click',e=>{if(!e.target.closest('[data-validation-planning]')||session?.role!=='worker')return;setTab('planning');$('#planningDate').value='';$('#planningStatusFilter').value='planned';renderPlanning();});
function renderNotifications(){
 if(session?.role==='admin')amaAdminNoticeRoute();
 const panel=$('#notificationCard');if(!panel)return;
 panel.classList.toggle('hidden',!session);
 if(!session)return;
 const unread=missionNotifications.filter(n=>!n.is_read).length;
 $('#notificationCount').textContent=unread?`(${unread} non lue${unread>1?'s':''})`:'';$('#notificationUnreadText').textContent=unread?`${unread} non lue${unread>1?'s':''}`:'Tout est lu';
 $('#notificationList').innerHTML=missionNotifications.length?missionNotifications.map(n=>{
 if(n.adminReminder)return amaRenderAdminNotice(n);
 const title=String(n.title||'Notification');
 const isDone=!n.validationReminder&&/réalis|termin|valid/i.test(title);
 const isTransfer=/transf|fusion/i.test(title);
 const isWarning=n.validationReminder||/report|prolong|non entr|annul/i.test(title);
 const type=isDone?'done':isTransfer?'team':isWarning?'warning':'info';
 const icon=type==='done'?'<path d="M20 6 9 17l-5-5"/><circle cx="12" cy="12" r="10"/>':type==='team'?'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 9h5m-2.5-2.5V12"/>':type==='warning'?'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>';
 const svg=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
 return `<div class="ama-swipe-shell ama-ios-notification ${n.is_read?'ama-is-read':'ama-is-unread'}" data-notification-id="${esc(n.id)}" data-pref-key="${n.validationReminder?'v':'n'}:${esc(n.id)}"><div class="ama-swipe-content"><span class="ama-ios-icon ama-ios-${type}">${svg}</span><div class="ama-swipe-copy"><div class="ama-ios-title"><strong>${esc(title)}</strong>${n.is_read?'':'<span class="ama-ios-unread-dot" aria-label="Non lue"></span>'}</div><p>${esc(n.message)}</p><small>${new Date(n.created_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</small></div><div class="ama-swipe-tools">${n.is_read?'':`<button class="soft mini" data-notification-read="${esc(n.id)}">Lue</button>`}${n.validationReminder?'<button class="soft mini" data-validation-planning>Voir les missions</button>':`<button class="ama-reveal-delete" data-notification-reveal="${esc(n.id)}" aria-label="Afficher Supprimer">‹</button>`}</div></div>${n.validationReminder?'':`<button class="ama-swipe-delete" data-notification-delete="${esc(n.id)}" aria-label="Supprimer cette notification"><span>♧</span>Supprimer</button>`}</div>`;
 }).join(''):'<div class="empty">Aucune notification pour le moment.</div>';
}
$('#notificationToggle').addEventListener('click',()=>{
 const content=$('#notificationContent');const expanded=content.classList.contains('hidden');
 content.classList.toggle('hidden',!expanded);
 $('#notificationToggle').setAttribute('aria-expanded',String(expanded));
 $('#notificationChevron').textContent=expanded?'⌃':'⌄';
 if(!expanded){amaPullStart=null;amaPullSet(false,'');$('#notificationList').querySelectorAll('.ama-revealed').forEach(row=>row.classList.remove('ama-revealed'));}
});
// Actualisation par geste vertical depuis le haut du panneau de notifications.
// Le glissement horizontal de suppression reste géré séparément.
let amaPullBusy=false,amaPullLast=0,amaPullStart=null;
const amaPullCooldown=3500,amaPullThreshold=65;
const amaPullIndicator=$('#amaPullIndicator'),amaPullText=$('#amaPullText');
function amaPullSet(visible,message,progress=0){
 amaPullIndicator.hidden=!visible;
 if(visible){amaPullText.textContent=message;amaPullIndicator.style.setProperty('--ama-pull-offset',Math.min(26,progress*.28)+'px');}
 else amaPullIndicator.style.removeProperty('--ama-pull-offset');
}
function amaNotifScrollAtTop(){
 const card=$('#notificationCard'),content=$('#notificationContent');
 return card.scrollTop<=2&&content.scrollTop<=2;
}
async function amaPullRefresh(){
 if(amaPullBusy||!session||Date.now()-amaPullLast<amaPullCooldown)return;
 amaPullBusy=true;amaPullLast=Date.now();
 amaPullIndicator.classList.add('ama-pull-loading');
 amaPullSet(true,'Actualisation…',0);
 try{await loadNotifications();renderNotifications();}
 catch(e){console.warn('Actualisation des notifications impossible :',e);amaPullSet(true,'Actualisation impossible',0);}
 finally{
  amaPullBusy=false;
  amaPullIndicator.classList.remove('ama-pull-loading');
  // L'indicateur disparaît sans intervention supplémentaire.
  setTimeout(()=>{if(!amaPullBusy)amaPullSet(false,'');},900);
 }
}
const amaPullTarget=$('#notificationCard');
amaPullTarget.addEventListener('touchstart',e=>{
 if(e.touches.length!==1||!session||$('#notificationContent').classList.contains('hidden')||!amaNotifScrollAtTop()||amaPullBusy){amaPullStart=null;return;}
 const t=e.touches[0];amaPullStart={x:t.clientX,y:t.clientY,distance:0,axis:null};
},{passive:true});
amaPullTarget.addEventListener('touchmove',e=>{
 if(!amaPullStart||e.touches.length!==1)return;
 const t=e.touches[0],dx=t.clientX-amaPullStart.x,dy=t.clientY-amaPullStart.y;
 if(!amaPullStart.axis&&Math.max(Math.abs(dx),Math.abs(dy))>9)amaPullStart.axis=Math.abs(dx)>Math.abs(dy)*1.2?'horizontal':'vertical';
 if(amaPullStart.axis!=='vertical'||dy<=0||!amaNotifScrollAtTop()){amaPullSet(false,'');amaPullStart.distance=0;return;}
 amaPullStart.distance=dy;
 amaPullSet(true,dy>=amaPullThreshold?'Relâchez pour actualiser':'Tirez pour actualiser',dy);
},{passive:true});
amaPullTarget.addEventListener('touchend',()=>{
 if(!amaPullStart)return;
 const trigger=amaPullStart.axis==='vertical'&&amaPullStart.distance>=amaPullThreshold&&amaNotifScrollAtTop();
 amaPullStart=null;
 if(trigger)amaPullRefresh();else if(!amaPullBusy)amaPullSet(false,'');
},{passive:true});
amaPullTarget.addEventListener('touchcancel',()=>{amaPullStart=null;if(!amaPullBusy)amaPullSet(false,'');},{passive:true});
$('#notificationList').addEventListener('click',async e=>{
 const reveal=e.target.closest('[data-notification-reveal]');
 if(reveal){const row=reveal.closest('.ama-swipe-shell');row?.classList.toggle('ama-revealed');return;}
 const del=e.target.closest('[data-notification-delete]');
 if(del&&session){
  const id=del.dataset.notificationDelete;
  const r=await client.rpc('ama_hide_notification',{p_notification_id:id});
  if(r.error)return alert('Suppression impossible : '+r.error.message+' — appliquez la migration SQL.');
  await loadNotifications();renderNotifications();
  const toast=document.getElementById('amaUndoToast');if(toast){toast.hidden=false;toast.querySelector('button').onclick=async()=>{const u=await client.rpc('ama_unhide_notification',{p_notification_id:id});if(u.error)return alert(u.error.message);toast.hidden=true;await loadNotifications();renderNotifications()};clearTimeout(window.amaUndoTimer);window.amaUndoTimer=setTimeout(()=>{toast.hidden=true},6000)}
  return;
 }
 const btn=e.target.closest('[data-notification-read]');if(!btn||!session)return;
 const reminder=missionNotifications.find(n=>n.id===btn.dataset.notificationRead)?.validationReminder;
 const r=await client.from(reminder?'ama_validation_reminders':'mission_notifications').update({is_read:true}).eq('id',btn.dataset.notificationRead);
 if(r.error)return alert(r.error.message);
 await loadNotifications();renderNotifications();
});

function render(){if(session?.role!=='admin')amaRRClear();if(session?.role==='worker')amaRefreshWallet();renderNotifications();refreshReportWorkers();fillSelects();renderStats();renderPlanning();renderHistory();renderDashboard();renderAdminDashboardRevenue();renderWeek();renderInvoiceSummary();if(session.role==='admin'){renderAdmin();renderFinances()}reportTotal();renderHomeSpark()}
function isoWeekMonday(dateStr){
 const d=new Date(dateStr+'T12:00:00');if(Number.isNaN(d.getTime()))return '';
 const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function financeDateMatches(date,period,selected){
 if(!date||!selected)return false;
 if(period==='day')return date===selected;
 if(period==='week')return isoWeekMonday(date)===isoWeekMonday(selected);
 if(period==='year')return date.slice(0,4)===selected;
 return date.startsWith(selected);
}
function setFinanceInputType(inputId,periodId){
 const input=$('#'+inputId),period=$('#'+periodId).value;
 const old=input.value;
 input.type=period==='day'||period==='week'?'date':period==='year'?'number':'month';
 if(period==='year'){input.min='2000';input.max='2100';input.step='1';input.value=old.slice(0,4)||today().slice(0,4)}
 else if(period==='month'){input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step');input.value=old.length>=7?old.slice(0,7):monthNow()}
 else{input.removeAttribute('min');input.removeAttribute('max');input.removeAttribute('step');input.value=old.length===10?old:today()}
}
function amaCompactEuro(amount){const n=Number(amount)||0;return Math.abs(n)>=1000?(n/1000).toLocaleString('fr-FR',{maximumFractionDigits:2})+' k€':euro(n)}

let amaWalletHidden=true;let amaWalletRequest=0;let amaWalletLastAmount=null;
async function amaLoadWorkerPermission(id){
 const label=document.getElementById('amaWorkerEarningsStatus');
 try{const {data,error}=await client.rpc('ama_get_worker_earnings_permission',{p_worker_id:id});if(error)throw error;if(document.getElementById('amaWorkerEditId').value!==id)return;document.getElementById('amaWorkerShowEarnings').checked=Boolean(data);label.textContent='Préférence enregistrée.';}
 catch(e){label.textContent='Préférence momentanément indisponible.';document.getElementById('amaWorkerShowEarnings').disabled=true;}
}
async function amaRefreshWallet(){
 const card=document.getElementById('amaWorkerEarnings');if(!card||!session||session.role!=='worker')return;
 const seq=++amaWalletRequest;card.hidden=true;amaWalletLastAmount=null;
 try{const {data,error}=await client.rpc('ama_my_earnings',{p_month:monthNow()+'-01'});if(error)throw error;if(seq!==amaWalletRequest)return;const row=Array.isArray(data)?data[0]:data;if(!row||!row.allowed)return;amaWalletLastAmount=Number(row.earnings||0);card.hidden=false;document.getElementById('amaWalletAmount').textContent=amaWalletHidden?'•••• €':euro(amaWalletLastAmount);document.getElementById('amaWalletAmount').classList.toggle('ama-wallet-masked',amaWalletHidden);document.getElementById('amaWalletHours').textContent=hours(Number(row.validated_hours||0))+' validées';document.getElementById('amaWalletPeriod').textContent=new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'});}
 catch(e){console.warn('Gains sécurisés indisponibles',e.message);card.hidden=true;}
}
const AMA_WALLET_EYE_OFF='<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c5.2 0 9.2 4.3 10 7-0.4 1.3-1.5 3.1-3.2 4.6"/><path d="M6.1 6.2C3.9 7.7 2.5 10 2 12c.8 2.7 4.8 7 10 7 1.6 0 3.1-.4 4.4-1.1"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/></svg>';
const AMA_WALLET_EYE_ON='<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
document.getElementById('amaWalletEye').addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();amaWalletHidden=!amaWalletHidden;const amount=document.getElementById('amaWalletAmount');if(!amaWalletHidden && amaWalletLastAmount!==null){amount.textContent=euro(amaWalletLastAmount)}else if(amaWalletHidden){amount.textContent='•••• €'}amount.classList.toggle('ama-wallet-masked',amaWalletHidden);const eye=document.getElementById('amaWalletEye');eye.innerHTML=amaWalletHidden?AMA_WALLET_EYE_OFF:AMA_WALLET_EYE_ON;eye.setAttribute('aria-label',amaWalletHidden?'Afficher le montant':'Masquer le montant');eye.setAttribute('aria-pressed',String(!amaWalletHidden));});
document.getElementById('amaWorkerShowEarnings').addEventListener('change',async e=>{if(!session||session.role!=='admin')return;const id=document.getElementById('amaWorkerEditId').value,checked=e.target.checked,status=document.getElementById('amaWorkerEarningsStatus');e.target.disabled=true;try{const {error}=await client.rpc('ama_set_worker_earnings_permission',{p_worker_id:id,p_allowed:checked});if(error)throw error;status.textContent=checked?'Gains autorisés pour cet intervenant.':'Gains masqués pour cet intervenant.';}catch(err){e.target.checked=!checked;status.textContent='Échec de l’enregistrement sécurisé : '+err.message;}finally{e.target.disabled=false;}});
document.getElementById('amaAptToggle').addEventListener('click',()=>{const content=document.getElementById('amaAptContents');content.hidden=!content.hidden;const open=!content.hidden;document.getElementById('amaAptToggle').setAttribute('aria-expanded',String(open));document.getElementById('amaAptToggle').firstChild.textContent=open?'🏠 Masquer les logements ':'🏠 Afficher les logements ';});
document.getElementById('amaAptSearch').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('fr').trim();document.querySelectorAll('#apartmentList [data-apt-name]').forEach(el=>{el.hidden=!el.dataset.aptName.includes(q)});});
document.getElementById('amaFinanceToggle').addEventListener('click',()=>{window.amaShowAllFinances=!window.amaShowAllFinances;renderFinances()});

// Financial computations remain inside the authenticated application closure.
let amaCurveMonth=monthNow(),amaCurveFrame=0,amaCurveSignature='',amaCurveSelectedDay=null;
function amaRevenueDays(month){
 const [year,mon]=month.split('-').map(Number),days=new Date(year,mon,0).getDate();
 const actual=Array(days).fill(0),forecast=Array(days).fill(0),groups=new Map();let missing=0,count=0;
 const now=today();
 for(const m of data.missions){
  if(!m.date?.startsWith(month+'-')||m.prolonged)continue;
  const day=Number(m.date.slice(8,10))-1;if(day<0||day>=days)continue;
  if(['done','not_entered'].includes(m.status)&&m.date<=now){
   const f=missionFinances.get(m.id);if(!f){missing++;continue;}
   const value=Number(f.revenue??Number(f.reference_hours)*Number(f.hourly_rate));
   if(!Number.isFinite(value)){missing++;continue;}
   const cents=Math.round(value*100);actual[day]+=cents;count++;
   const a=data.apartments.find(a=>a.id===m.apartmentId),key=m.apartmentId||'unknown';
   const g=groups.get(key)||{name:m.apartmentName||a?.name||'Logement',count:0,cents:0,hours:0};
   g.count++;g.cents+=cents;g.hours+=Number(f.reference_hours)||0;groups.set(key,g);
  }else if(m.status==='planned'&&m.date>=now){
   const f=missionFinances.get(m.id)||apartmentFinances.get(m.apartmentId);if(!f){missing++;continue;}
   const value=Number(f.revenue??Number(f.reference_hours)*Number(f.hourly_rate));
   if(Number.isFinite(value))forecast[day]+=Math.round(value*100);else missing++;
  }
 }
 return {actual,forecast,days,missing,count,groups:[...groups.values()]};
}
function amaToggleCurveDetail(key,open){
 const panel=document.getElementById('amaCurve'+key+'Panel'),button=document.getElementById('amaCurve'+key+'Toggle');
 const expanded=open??panel.hidden;panel.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.querySelector('span').textContent=expanded?'⌃':'⌄';
}
['Daily','Apartments'].forEach(key=>document.getElementById('amaCurve'+key+'Toggle').onclick=()=>amaToggleCurveDetail(key));
function renderRevenueCurve(force=false){
 const panel=document.getElementById('amaDailyRevenue');if(!panel)return;
 const allowed=session?.role==='admin';panel.hidden=!allowed;
 if(!allowed){cancelAnimationFrame(amaCurveFrame);panel.querySelectorAll('[data-private-value]').forEach(n=>n.textContent='');document.getElementById('amaCurveSvg').innerHTML='';return;}
 const {actual,forecast,days,missing,count,groups}=amaRevenueDays(amaCurveMonth);
 const now=today(),current=now.slice(0,7),past=amaCurveMonth<current,future=amaCurveMonth>current;
 const cutoff=past?days:future?0:Number(now.slice(8,10));
 let sum=0;const cumulative=actual.map(n=>(sum+=n));
 let predicted=0;const projected=actual.map((n,i)=>(predicted+=n+forecast[i]));
 const total=cumulative.at(-1)||0,planned=forecast.reduce((a,b)=>a+b,0);
 const signature=JSON.stringify([amaCurveMonth,actual,forecast,missing,groups]);
 document.getElementById('amaCurveMonth').value=amaCurveMonth;
 document.getElementById('amaCurveState').textContent=past?'Mois terminé':future?'À venir':'En cours';
 document.getElementById('amaCurveCaption').textContent=past?'Total du mois · interventions réalisées':future?'Aucune intervention réalisée':`Cumul au ${dateFr(now)}`;
 document.getElementById('amaCurveStats').textContent=count+' intervention'+(count>1?'s':'')+' réalisée'+(count>1?'s':'')+' valorisée'+(count>1?'s':'');
 document.getElementById('amaCurveToday').textContent=future?'Prévisionnel : '+euro(planned/100):past?'Courbe complète du mois':'Aujourd’hui : '+euro(actual[cutoff-1]/100);
 document.getElementById('amaCurveForecast').textContent=planned?'Prévision de fin de mois : '+euro((total+planned)/100)+' · missions planifiées':'Aucune prévision chiffrée sur les missions restantes.';
 document.getElementById('amaCurveNotice').textContent='CA estimé avant charges et impôts, hors encaissements et prolongations. '+(missing?missing+' mission(s) sans données financières exclue(s). ':'')+'Pointillés : prévisionnel.';
 const dateLabel=d=>dateFr(amaCurveMonth+'-'+String(d).padStart(2,'0'));
 const entries=actual.map((n,i)=>({n,day:i+1})).filter(v=>v.n!==0).reverse();
 document.getElementById('amaCurveDaily').innerHTML=entries.length?entries.map(v=>`<div class="ama-curve-day"><span>${dateLabel(v.day)}</span><strong>${esc(euro(v.n/100))}</strong></div>`).join(''):'<p class="desc">Aucune intervention réalisée valorisée sur ce mois.</p>';
 document.getElementById('amaCurveApartments').innerHTML=groups.length?groups.sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(g=>`<div class="ama-curve-apartment"><div><strong>${esc(g.name)}</strong><small>${g.count} intervention(s) · ${esc(hours(g.hours))} facturables</small></div><strong>${esc(euro(g.cents/100))}</strong></div>`).join('')+`<div class="ama-curve-apartment"><strong>Total du mois</strong><strong>${esc(euro(total/100))}</strong></div>`:'<p class="desc">Aucun appartement avec une intervention réalisée valorisée sur ce mois.</p>';
 const chips=document.getElementById('amaCurveMonths');chips.innerHTML='';const [y,m]=amaCurveMonth.split('-').map(Number);
 for(let offset=-2;offset<=2;offset++){
  const date=new Date(y,m-1+offset,1),key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
  const b=document.createElement('button');b.type='button';b.textContent=date.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});b.className=offset===0?'selected':'';b.setAttribute('aria-pressed',String(offset===0));b.onclick=()=>amaSelectRevenueMonth(key);chips.appendChild(b);
 }
 if(!force&&signature===amaCurveSignature)return;amaCurveSignature=signature;cancelAnimationFrame(amaCurveFrame);
 const W=600,H=260,L=24,R=576,T=72,B=222;
 const max=Math.max(100,...cumulative,...projected),min=Math.min(0,...cumulative,...projected),span=max-min||1;
 const x=d=>L+(R-L)*d/days,yv=n=>B-(n-min)/span*(B-T);
 const points=(values,end,start=0)=>{let path=`M ${x(start)} ${yv(start?values[start-1]:0)}`;for(let i=start;i<end;i++)path+=` L ${x(i+1)} ${yv(values[i])}`;return path;};
 const actualPath=cutoff?points(cumulative,cutoff):'',forecastStart=future?0:cutoff,forecastPath=planned?points(projected,days,forecastStart):'';
 const svg=document.getElementById('amaCurveSvg'),tooltip=document.getElementById('amaCurveTooltip');
 const lastDay=planned?days:Math.max(1,cutoff),selectable=!future||planned>0;
 let selected=Math.max(1,Math.min(lastDay,amaCurveSelectedDay??(future?1:cutoff)));amaCurveSelectedDay=selected;
 svg.innerHTML=`<defs><linearGradient id="amaRevenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#398b7b" stop-opacity=".22"/><stop offset="100%" stop-color="#398b7b" stop-opacity=".02"/></linearGradient></defs>`+
 [0,.5,1].map(p=>`<line x1="${L}" y1="${T+(B-T)*p}" x2="${R}" y2="${T+(B-T)*p}" stroke="#e5edef"/>`).join('')+
 (actualPath?`<path d="${actualPath} L ${x(cutoff)} ${B} L ${L} ${B} Z" fill="url(#amaRevenueFill)"/><path id="amaCurveLine" d="${actualPath}" fill="none" stroke="#398b7b" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`:'')+
 (forecastPath?`<path d="${forecastPath}" fill="none" stroke="#8195a0" stroke-width="2.5" stroke-dasharray="6 6"/>`:'')+
 [1,Math.round(days/2),days].map(d=>`<text x="${x(d)}" y="251" text-anchor="${d===1?'start':d===days?'end':'middle'}" fill="#8195a0" font-size="13">${d}</text>`).join('')+
 (selectable?`<line id="amaCurveGuide" y1="${T}" y2="${B}" stroke="#87b6aa" stroke-dasharray="3 4"/><g id="amaCurveHandle" tabindex="0" role="slider" aria-label="Jour sélectionné sur la courbe" aria-valuemin="1" aria-valuemax="${lastDay}" aria-valuenow="${selected}" aria-orientation="horizontal"><circle r="40" fill="transparent"/><circle r="18" fill="#398b7b" fill-opacity=".12"/><circle class="ama-handle-ring" r="10" fill="#398b7b" stroke="white" stroke-width="3"/></g>`:'');
 svg.setAttribute('aria-label',`Chiffre d’affaires cumulé : ${euro(total/100)}. ${planned?'Prévision : '+euro((total+planned)/100):''}`);
 const handle=document.getElementById('amaCurveHandle'),guide=document.getElementById('amaCurveGuide');
 function showDay(day,showTip=false){
  selected=Math.max(1,Math.min(lastDay,day));amaCurveSelectedDay=selected;
  const isForecast=selected>cutoff;
  const dayAmount=isForecast?forecast[selected-1]:actual[selected-1],cum=isForecast?projected[selected-1]:cumulative[selected-1];
  const label=dateLabel(selected)+' · '+(isForecast?'Prévision du jour':'Jour')+' : '+euro(dayAmount/100)+' · Cumul'+(isForecast?' prévu':'')+' : '+euro(cum/100);
  document.getElementById('amaCurveReadout').textContent=showTip?(future&&!planned?'Aucune prévision chiffrée sur ce mois.':label):'';
  if(!handle){tooltip.hidden=true;return;}
  const px=x(selected),py=yv(cum);handle.setAttribute('transform',`translate(${px} ${py})`);handle.setAttribute('aria-valuenow',String(selected));handle.setAttribute('aria-valuetext',label);
  const ring=handle.querySelector('.ama-handle-ring');ring.setAttribute('fill',isForecast?'#8195a0':'#398b7b');
  guide.setAttribute('x1',String(px));guide.setAttribute('x2',String(px));guide.setAttribute('y1',String(py));
  tooltip.innerHTML=`<strong>${esc(dateLabel(selected))}${isForecast?' · Prévision':''}</strong>${isForecast?'Prévu':'Jour'} : ${esc(euro(dayAmount/100))}<br>Cumul${isForecast?' prévu':''} : ${esc(euro(cum/100))}`;
  const width=svg.getBoundingClientRect().width||300,pct=px/W*100;
  tooltip.style.left=Math.max(90/width*100,Math.min(100-90/width*100,pct))+'%';tooltip.style.top=Math.max(0,py/H*width*H/W-72)+'px';tooltip.hidden=!showTip;
 }
 let pointer=null;showDay(selected,false);svg.onpointerleave=()=>{if(pointer===null){tooltip.hidden=true;document.getElementById('amaCurveReadout').textContent='';}};handle?.addEventListener('blur',()=>tooltip.hidden=true);
 function pointerDay(e){
  const matrix=svg.getScreenCTM?.();let px;
  if(matrix&&svg.createSVGPoint){const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;px=point.matrixTransform(matrix.inverse()).x;}
  else{const rect=svg.getBoundingClientRect();if(!rect.width)return selected;px=(e.clientX-rect.left)*W/rect.width;}
  return Math.round((px-L)/(R-L)*days);
 }
 if(handle){
  handle.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();pointer=e.pointerId;try{handle.setPointerCapture(pointer)}catch(_){}handle.focus({preventScroll:true});showDay(pointerDay(e),true)};
  handle.onpointermove=e=>{if(pointer!==e.pointerId)return;e.preventDefault();showDay(pointerDay(e),true)};
  const release=e=>{if(pointer!==e.pointerId)return;try{handle.releasePointerCapture(pointer)}catch(_){}pointer=null;};handle.onpointerup=release;handle.onpointercancel=release;handle.onlostpointercapture=()=>pointer=null;
  handle.onkeydown=e=>{const map={ArrowLeft:selected-1,ArrowDown:selected-1,ArrowRight:selected+1,ArrowUp:selected+1,Home:1,End:lastDay,PageDown:selected-7,PageUp:selected+7};if(e.key in map){e.preventDefault();showDay(map[e.key],true)}};
  handle.onfocus=()=>showDay(selected,true);
 }
 // Tap anywhere on the graph to select a day; scrolling outside the handle stays natural.
 svg.onpointerup=e=>{if(selectable&&pointer===null&&!e.target.closest('#amaCurveHandle'))showDay(pointerDay(e),true)};
 svg.onpointermove=e=>{if(selectable&&e.pointerType==='mouse'&&pointer===null)showDay(pointerDay(e),true)};
 const amount=document.getElementById('amaCurveAmount'),line=document.getElementById('amaCurveLine');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,visible=tab==='admin'&&!document.getElementById('app').hidden;
 if(line&&visible&&!reduced){const len=line.getTotalLength();line.style.strokeDasharray=len;line.style.strokeDashoffset=len;line.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:1400,easing:'ease-out',fill:'forwards'});}
 if(!visible||reduced){amount.textContent=euro(total/100);return;}
 const start=performance.now();function tick(time){if(session?.role!=='admin')return;const p=Math.min(1,(time-start)/950);amount.textContent=euro(Math.round(total*(1-Math.pow(1-p,3)))/100);if(p<1)amaCurveFrame=requestAnimationFrame(tick);}amaCurveFrame=requestAnimationFrame(tick);
}
function amaSelectRevenueMonth(key){
 amaCurveMonth=key;amaCurveSelectedDay=null;
 for(const [period,date] of [['financePeriod','financeMonth'],['dashRevenuePeriod','dashRevenueMonth']]){document.getElementById(period).value='month';setFinanceInputType(date,period);document.getElementById(date).value=key;}
 if(session?.role==='admin'){renderFinances();renderAdminDashboardRevenue();renderRevenueCurve(true);}
}
function amaShiftRevenueMonth(offset){const [y,m]=amaCurveMonth.split('-').map(Number),d=new Date(y,m-1+offset,1);amaSelectRevenueMonth(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
document.getElementById('amaCurvePrev').onclick=()=>amaShiftRevenueMonth(-1);
document.getElementById('amaCurveNext').onclick=()=>amaShiftRevenueMonth(1);
document.getElementById('amaCurveMonth').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&Number(e.target.value.slice(5))>=1&&Number(e.target.value.slice(5))<=12)amaSelectRevenueMonth(e.target.value)};
let amaCurveLastDay=today();setInterval(()=>{if(session?.role==='admin'&&tab==='admin'&&today()!==amaCurveLastDay){amaCurveLastDay=today();renderRevenueCurve(true)}},30000);

function renderFinances(){
 const select=$('#financeApartment'),prev=select.value;
 select.innerHTML='<option value="">Tous les logements</option>'+data.apartments.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
 if(data.apartments.some(a=>a.id===prev))select.value=prev;
 const period=$('#financePeriod').value,month=$('#financeMonth').value||monthNow(),apartment=select.value;
 const missions=data.missions.filter(m=>financeDateMatches(m.date,period,month)&&['done','not_entered'].includes(m.status)&&!m.prolonged&&(!apartment||m.apartmentId===apartment));
 const groups=new Map();let revenue=0,count=0,missing=0;
 for(const m of missions){
  const f=missionFinances.get(m.id);if(!f){missing++;continue;}
  const g=groups.get(m.apartmentId)||{name:m.apartmentName||'Logement',count:0,hours:0,revenue:0};
  g.count++;g.hours+=Number(f.reference_hours||0);g.revenue+=Number(f.revenue??(Number(f.reference_hours||0)*Number(f.hourly_rate||0)));
  revenue+=Number(f.revenue??(Number(f.reference_hours||0)*Number(f.hourly_rate||0)));count++;groups.set(m.apartmentId,g);
 }
 $('#financeRevenue').textContent=amaCompactEuro(revenue);$('#financeCount').textContent=String(count);
 $('#financeRows').innerHTML=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.count}</td><td>${hours(g.hours)}</td><td><strong>${euro(g.revenue)}</strong></td></tr>`).join('')||'<tr><td colspan="4">Aucune mission réalisée avec données financières pour ce mois.</td></tr>';
 const sorted=[...groups.values()].sort((a,b)=>b.revenue-a.revenue);const maxRevenue=Math.max(1,...sorted.map(g=>g.revenue));
 const chart=document.getElementById('amaFinanceChart'),toggle=document.getElementById('amaFinanceToggle');
 const visible=window.amaShowAllFinances?sorted:sorted.slice(0,5);
 chart.innerHTML=visible.map(g=>`<div class="ama-finance-row"><div class="ama-finance-meta"><strong>${esc(g.name)}</strong><strong>${euro(g.revenue)}</strong></div><div class="ama-finance-track"><div class="ama-finance-fill" style="width:${Math.max(0,Math.min(100,g.revenue/maxRevenue*100))}%"></div></div><small>${g.count} mission(s) · ${hours(g.hours)} facturables</small></div>`).join('')||'<p class="desc">Aucune donnée financière sur cette période.</p>';
 toggle.hidden=sorted.length<=5;toggle.textContent=window.amaShowAllFinances?'Masquer les logements ↑':`Voir tous les logements (${sorted.length}) ↓`;
 $('#financeNotice').textContent=missing?`${missing} mission(s) réalisée(s) sans historique financier : exclue(s) du total. Les missions anciennes ne sont pas valorisées automatiquement.`:'Montants estimés, avant charges et impôts. Les prolongations sont exclues.';
}
$('#financeMonth').addEventListener('change',renderFinances);$('#financePeriod').addEventListener('change',()=>{setFinanceInputType('financeMonth','financePeriod');renderFinances()});
$('#financeApartment').addEventListener('change',renderFinances);
function renderAdminDashboardRevenue(){
 renderRevenueCurve();
 const panel=$('#adminDashboardRevenue');
 if(!session||session.role!=='admin'){panel.classList.add('hidden');return;}
 panel.classList.remove('hidden');
 const period=$('#dashRevenuePeriod').value,month=$('#dashRevenueMonth').value||monthNow();
 const groups=new Map();let total=0,count=0,missing=0;
 for(const m of data.missions){
  if(!financeDateMatches(m.date,period,month)||!['done','not_entered'].includes(m.status)||m.prolonged)continue;
  const f=missionFinances.get(m.id);
  if(!f){missing++;continue;}
  const amount=Number(f.revenue??(Number(f.reference_hours||0)*Number(f.hourly_rate||0)));
  const g=groups.get(m.apartmentId)||{name:m.apartmentName||'Logement',count:0,hours:0,revenue:0};
  g.count++;g.hours+=Number(f.reference_hours||0);g.revenue+=amount;
  groups.set(m.apartmentId,g);total+=amount;count++;
 }
 $('#dashRevenueTotal').textContent=amaCompactEuro(total);
 $('#dashRevenueMissions').textContent=String(count);
 $('#dashRevenueRows').innerHTML=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(g=>`<tr><td>${esc(g.name)}</td><td>${g.count}</td><td>${hours(g.hours)}</td><td><strong>${euro(g.revenue)}</strong></td></tr>`).join('')||'<tr><td colspan="4">Aucune mission réalisée valorisée pour ce mois.</td></tr>';
 $('#dashRevenueNotice').textContent=missing?`${missing} mission(s) sans historique financier non comptabilisée(s).`:'CA estimé avant charges et impôts. Les prolongations sont exclues.';
}
$('#dashRevenueMonth').addEventListener('change',()=>{const v=$('#dashRevenueMonth').value;if(/^\d{4}-\d{2}$/.test(v)&&$('#dashRevenuePeriod').value==='month'){amaCurveMonth=v;amaCurveSelectedDay=null;}renderAdminDashboardRevenue()});$('#dashRevenuePeriod').addEventListener('change',()=>{setFinanceInputType('dashRevenueMonth','dashRevenuePeriod');renderAdminDashboardRevenue()});
function renderDashboard(){
 const upcoming=document.getElementById('dashMissions')?.closest('.dashboard-main');if(upcoming)upcoming.hidden=true;
 if(session?.role==='admin')void amaV6Refresh?.();amaV6PaintHome?.();
 const reminder=document.getElementById('amaWorkerReminder');if(reminder)reminder.hidden=session.role==='admin';

 const ms=getVisibleMissions(),future=ms.filter(m=>m.status==='planned'&&!m.prolonged).sort((a,b)=>{
  if(session.role==='worker'){
   const an=Boolean(String(a.notes||'').trim()),bn=Boolean(String(b.notes||'').trim());
   if(an!==bn)return an?-1:1;
  }
  return a.date.localeCompare(b.date);
 }).slice(0,session.role==='admin'?3:6);
 const nextCard=$('#amaNextMission');
 let amaNextWorkerMission=null;
 if(nextCard){
  nextCard.classList.toggle('hidden',session.role==='admin');
  const next=ms.filter(m=>m.status==='planned'&&!m.prolonged&&m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const detail=$('#amaNextMissionDetail');
  amaNextWorkerMission=next;
  if(nextCard){nextCard.dataset.nextMissionId=next?.id||'';nextCard.classList.toggle('ama-next-clickable',Boolean(next));nextCard.setAttribute('aria-label',next?'Ouvrir la mission '+(next.apartmentName||''): 'Aucune mission à ouvrir');nextCard.tabIndex=next?0:-1;}
  if(detail)detail.innerHTML=next?`<div class="ama-next-name">${esc(next.apartmentName||'Logement')}</div><div class="ama-next-sub">${dateFr(next.date)} · ${hours(sharedHours(next))}</div>${String(next.notes||'').trim()?'<span class="ama-next-note">Consignes à consulter</span>':''}`:'<p class="desc">Aucune mission à venir pour le moment.</p>';
 }
 $('#dashMissions').innerHTML=future.length?'<div class="dash-table"><div class="dash-head"><span>Date</span><span>Logement</span><span>Durée</span><span>Statut</span></div>'+future.map(m=>`<div class="dash-row"><span class="ama-dash-date"><span class="ama-mission-calendar ${m.status==='done'?'ama-calendar-done':'ama-calendar-pending'}" aria-label="${m.status==='done'?'Mission réalisée':'Mission à réaliser'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>${m.status==='done'?'<path d="m8 16 3 3 5-5"/>':'<path d="M12 14v5m-2.5-2.5h5"/>'}</svg></span><span>${dateFr(m.date)}</span></span><span><strong>${esc(m.apartmentName||'Logement')}</strong><small>${esc(m.workerName||'')}</small>${session.role==='worker'&&String(m.notes||'').trim()?`<small class="priority-label">📌 Consignes à lire</small>`:''}</span><span>◷ ${hours(session.role==='worker'?sharedHours(m):m.hours)}</span><span>${statusBadge(m.status)}</span></div>`).join('')+'</div>':'<div class="empty">Aucune intervention à venir. Vous pouvez en programmer depuis « Mon planning ».</div>';
 const month=ms.filter(m=>m.date?.startsWith(monthNow())),done=month.filter(m=>m.status==='done'),pending=month.filter(m=>m.status==='planned'&&!m.prolonged);
 $('#dashHours').textContent=hours(done.reduce((s,m)=>s+sharedHours(m),0));$('#dashSummary').textContent=`${done.length} terminées · ${pending.length} à venir`;
 const progressTotal=done.length+pending.length;const progressPct=progressTotal?Math.round(done.length/progressTotal*100):0;
 $('#dashProgress').style.width=progressPct+'%';const pct=document.getElementById('amaMonthPercent');if(pct)pct.textContent=progressPct+' %';
}
let weekOffset=0;
function localISO(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function weekStart(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)+weekOffset*7);return d}
function renderWeek(){
 if(!session)return;
 const start=weekStart(),end=new Date(start);end.setDate(end.getDate()+6);
 const fmt=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
 $('#weekRange').textContent=`${fmt(start)} – ${fmt(end)}`;
 const ms=getVisibleMissions().filter(m=>m.status!=='cancelled'&&!m.prolonged);
 let planned=0,done=0,doneHours=0;
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const date=localISO(d);const items=ms.filter(m=>m.date===date);const p=items.filter(m=>m.status==='planned'&&!m.prolonged).length;const r=items.filter(m=>m.status==='done');planned+=p;done+=r.length;doneHours+=r.reduce((sum,m)=>sum+Number(m.hours||0),0);return {date,d,p,done:r.length,total:p+r.length}});
 const max=Math.max(1,...days.map(d=>d.total));
 $('#weekMetrics').innerHTML=`<span><strong>${planned+done}</strong> missions</span><span><strong>${planned}</strong> à réaliser</span><span><strong>${done}</strong> réalisées</span><span><strong>${hours(doneHours)}</strong> validées</span>`;
 $('#weekBars').innerHTML=days.map(d=>{const h1=d.p?Math.max(6,Math.round(d.p/max*76)):0,h2=d.done?Math.max(6,Math.round(d.done/max*76)):0;const label=d.d.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');return `<button type="button" class="week-day ${d.date===today()?'is-today':''}" data-week-date="${d.date}" aria-label="Voir les missions du ${dateFr(d.date)}"><span class="wd-label">${label}</span><span class="wd-date">${d.d.getDate()}</span><span class="wd-plot">${h1?`<span class="wd-bar" style="height:${h1}px"></span>`:''}${h2?`<span class="wd-bar done-bar" style="height:${h2}px"></span>`:''}</span><span class="wd-count">${d.total} mission${d.total>1?'s':''}</span></button>`}).join('');
}
function closeMobileMenu(){const n=$('#nav');n.classList.remove('mobile-open');$('#mobileMenuBackdrop').classList.remove('is-open');$('#mobileMenuToggle').setAttribute('aria-expanded','false')}
$('#mobileMenuToggle').addEventListener('click',()=>{const open=$('#nav').classList.toggle('mobile-open');$('#mobileMenuBackdrop').classList.toggle('is-open',open);$('#mobileMenuToggle').setAttribute('aria-expanded',String(open))});
$('#mobileMenuBackdrop').addEventListener('click',closeMobileMenu);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileMenu()});
$('#weekPrev').addEventListener('click',()=>{weekOffset--;renderWeek()});
$('#weekNext').addEventListener('click',()=>{weekOffset++;renderWeek()});
$('#weekCurrent').addEventListener('click',()=>{weekOffset=0;renderWeek()});
$('#weekBars').addEventListener('click',e=>{const day=e.target.closest('[data-week-date]');if(!day)return;$('#planningDate').value=day.dataset.weekDate;renderPlanning();setTab('planning')});
let amaTabHistory=[];
function amaCaptureView(){
 const section=document.getElementById('tab-'+tab),fields={};
 section?.querySelectorAll('input[id],select[id]').forEach(el=>{if(/^(planning|history|report|finance|dashRevenue|amaCurve|amaAptSearch|amaTeamSearch|amaClientSearch)/.test(el.id)&&!['password','file','hidden'].includes(el.type))fields[el.id]=el.value});
 return {tab,x:window.scrollX,y:window.scrollY,fields,manageView:amaManageView,forms:['workerForm','apartmentForm','clientForm'].map(id=>!document.getElementById(id).hidden),curveMonth:amaCurveMonth,curveDay:amaCurveSelectedDay,curvePanels:['Daily','Apartments'].map(k=>!document.getElementById('amaCurve'+k+'Panel').hidden),details:[...(section?.querySelectorAll('details')||[])].map(el=>el.open),scrolls:[...(section?.querySelectorAll('[id]')||[])].filter(el=>el.scrollHeight>el.clientHeight+1).map(el=>({id:el.id,top:el.scrollTop,left:el.scrollLeft})),focus:document.activeElement?.id||''};
}
function amaRestoreScroll(state){requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!session)return;for(const item of state.scrolls||[]){const el=document.getElementById(item.id);if(el){el.scrollTop=item.top;el.scrollLeft=item.left}}if(state.focus){try{document.getElementById(state.focus)?.focus({preventScroll:true})}catch(_){}}window.scrollTo({left:state.x||0,top:state.y||0,behavior:'instant'})}));}
function setTab(t,fromBack=false){
 if(!session)return;
 if((t==='admin'||t==='invoices')&&session.role!=='admin')t='planning';
 if(!fromBack&&(tab!==t||(t==='admin'&&amaManageView!=='overview')))amaTabHistory.push(amaCaptureView());
 closeMobileMenu();tab=t;
 if(t==='dashboard'&&session.role==='worker')amaRefreshWallet();
 document.body.dataset.amaTab=t;$$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
 amaNetworkPaint();['dashboard','planning','history','admin','invoices'].forEach(x=>$('#tab-'+x).classList.toggle('hidden',x!==t));
 document.getElementById('backBtn').disabled=amaTabHistory.length===0;document.getElementById('backBtn').hidden=amaTabHistory.length===0;document.getElementById('amaPageTitle').textContent=({dashboard:'Accueil',planning:'Planning',history:'Historique',admin:'Gestion',invoices:'Factures'})[t]||'';
 if(t==='admin'){amaShowManage(fromBack?amaManageView:'overview',false,false);renderRevenueCurve(true)}amaUpdatePageHeading();
}
function amaGoBack(){
 if(!session)return;
 if(!amaPdfState&&tab==='invoices'&&amaInvoiceStep!=='overview'){amaInvoiceBack();return;}
 if(amaPdfState){amaClosePdf();return;}
 const photo=document.getElementById('amaPhotoModal');if(photo&&!photo.hidden){amaClosePhotoMission();return;}
 const account=document.getElementById('amaAccountModal');if(account&&!account.hidden){account.hidden=true;return;}
 const editor=document.getElementById('amaWorkerEditor');if(editor&&!editor.hidden){document.getElementById('amaWorkerEditorClose').click();return;}
 const state=amaTabHistory.pop();if(!state)return;
 if(typeof state==='string'){setTab(state,true);return;}
 for(const [id,value] of Object.entries(state.fields)){const el=document.getElementById(id);if(el)el.value=value;}
 amaManageView=state.manageView||'overview';amaCurveMonth=state.curveMonth||monthNow();amaCurveSelectedDay=state.curveDay??null;setTab(state.tab,true);for(const [i,id] of ['workerForm','apartmentForm','clientForm'].entries()){document.getElementById(id).hidden=!state.forms?.[i];document.querySelector('[data-manage-add="'+id+'"]')?.setAttribute('aria-expanded',String(!!state.forms?.[i]));}
 renderPlanning();renderHistory();renderAdminDashboardRevenue();if(session.role==='admin')renderFinances();reportTotal();
 const section=document.getElementById('tab-'+tab);[...(section?.querySelectorAll('details')||[])].forEach((el,i)=>el.open=!!state.details[i]);
 for(const [i,key] of ['Daily','Apartments'].entries())amaToggleCurveDetail(key,!!state.curvePanels?.[i]);
 amaRestoreScroll(state);
}


function refreshReportWorkers(){
 const sel=$('#reportWorker'),previous=sel.value;
 const workers=data.users.filter(u=>u.role==='worker');
 sel.innerHTML='<option value="">Sélectionner un intervenant</option>'+workers.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}${u.active===false?' (inactif)':''}</option>`).join('');
 if(workers.some(u=>u.id===previous))sel.value=previous;
}
function reportRows(){
 if(!session)return [];
 const workerId=session.role==='admin'?$('#reportWorker').value:session.id;
 if(!workerId)return [];
 const month=$('#reportMonth').value||monthNow();
 return data.missions.filter(m=>sharedIds(m).includes(workerId)&&m.status==='done'&&String(m.date||'').startsWith(month)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
function reportTotal(){
 if(!session)return;
 const ms=reportRows(),total=ms.reduce((n,m)=>n+sharedHours(m),0);
 document.getElementById('amaReportHours').textContent=hours(total);document.getElementById('amaReportCount').textContent=ms.length;
 $('#reportTotal').textContent=(session.role==='admin'&&!$('#reportWorker').value)?'Choisissez un intervenant pour afficher son relevé.':`${ms.length} intervention(s) validée(s) · ${hours(total)}`;
}
// Modif 1 / Modif 2: navigation and presentation, using the existing protected data.
let amaManageView='overview',amaPdfState=null;
const AMA_UI_PATHS={imports:'M2 3h4v4H2z M10 2h4v4h-4z M18 3h4v4h-4z M9 16h6v6H9z M4 7v4c0 5 5 5 5 5 M20 7v4c0 5-5 5-5 5 M12 6v7 M10 11l2 2 2-2',security:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3 M9 12l2 2 4-4',configure:'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M16 3a2.12 2.12 0 0 1 3 3L10 15l-4 1 1-4 9-9 M14 5l3 3',dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',planning:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M7 14h3 M14 14h3',history:'M3 11a9 9 0 1 1 3 8 M3 3v6h6 M12 7v5l3 2',invoices:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',admin:'M3 5h3 M10 5h11 M3 12h11 M18 12h3 M3 19h3 M10 19h11 M10 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M18 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M10 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0',team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.9',apartments:'M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-8h6v8',clients:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 10h6 M19 7v6',settings:'M4 3h16v18H4z M7 3v7h10V3 M8 21v-7h8v7'};
const amaUiIcon=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${AMA_UI_PATHS[key]||AMA_UI_PATHS.admin}"/></svg>`;
const amaHeadingTargets={};
function amaUpdatePageHeading(){
 const button=document.getElementById('backBtn'),target=amaHeadingTargets[tab];
 if(!button||!target)return;
 target.prepend(button);const nested=tab==='admin'&&amaManageView!=='overview';button.hidden=!session||!nested;button.disabled=button.hidden;
}
function amaShowManage(view='overview',push=true,scroll=true){
 if(session?.role!=='admin')return;
 if(!['overview','team','apartments','clients','settings','imports','maintenance','payments','incidents','security'].includes(view))view='overview';
 if(push&&view!==amaManageView)amaTabHistory.push(amaCaptureView());
 amaManageView=view;if(view!=='maintenance')amaMaintenanceFunctionView=false;if(view==='security')document.dispatchEvent(new Event('ama:security-open'));
 for(const key of ['overview','team','apartments','clients','settings','imports','maintenance','payments','incidents','security'])document.getElementById('amaManage-'+key).hidden=key!==view;
 document.getElementById('amaManageTitle').textContent=({overview:'Gestion',team:'Équipe',apartments:'Logements',clients:'Clients',settings:'Sauvegarde et exports',imports:'Connexions & imports',maintenance:'Maintenance',payments:'Suivi des paiements',incidents:'Signalements',security:'Sécurité'})[view];
 document.getElementById('amaManageHeadingIcon').innerHTML=amaUiIcon(view==='overview'?'admin':view);
 amaUpdatePageHeading();amaV12MaintenanceCards();amaNetworkPaint();if(view==='imports'){void amaRRLoad();void amaStayLoad();void amaV12Recent(amaV12RecentSource);}if(scroll)window.scrollTo({top:0,behavior:'instant'});
}
function amaOpenManageForm(formId,focus=true){
 const form=document.getElementById(formId);if(!form)return;if(form.hidden&&session?.role==='admin'&&tab==='admin')amaTabHistory.push({...amaCaptureView(),formReturn:formId});form.hidden=false;
 const toggle=document.querySelector('[data-manage-add="'+formId+'"]');toggle?.setAttribute('aria-expanded','true');
 if(focus){form.scrollIntoView({behavior:'smooth',block:'nearest'});form.querySelector('input:not([type=hidden]),textarea')?.focus({preventScroll:true});}
}
function amaDiscardFormReturn(formId){const previous=amaTabHistory.at(-1);if(previous?.formReturn===formId&&previous.tab===tab&&previous.manageView===amaManageView)amaTabHistory.pop();}
function amaSetupFinalUI(){
 const admin=document.getElementById('tab-admin');
 const teamCard=document.getElementById('workerForm').closest('.card'),clientCard=document.getElementById('clientForm').closest('.card'),aptCard=document.getElementById('apartmentForm').closest('.card'),backupCard=document.getElementById('backupBtn').closest('.card'),workerEditor=document.getElementById('amaWorkerEditor');
 const heading=document.createElement('div');heading.className='ama-integrated-heading';heading.id='amaManageHeading';heading.innerHTML=`<span class="ama-heading-tile" id="amaManageHeadingIcon">${amaUiIcon('admin')}</span><h2 id="amaManageTitle">Gestion</h2>`;admin.prepend(heading);amaHeadingTargets.admin=heading;
 for(const key of ['overview','team','apartments','clients','settings','imports','maintenance','payments','incidents','security']){const pane=document.createElement('div');pane.id='amaManage-'+key;pane.className='ama-manage-pane';pane.hidden=key!=='overview';admin.appendChild(pane);}
 const overview=document.getElementById('amaManage-overview');overview.appendChild(document.getElementById('amaDailyRevenue'));
 const grid=document.createElement('div');grid.className='ama-management-grid';
 const labels={team:['Équipe','Comptes et accès'],apartments:['Logements','Accès, durées et tarifs'],clients:['Clients','Donneurs d’ordre'],imports:['Connexions & imports','RentalReady · Airbnb · Gîtes de France'],settings:['Sauvegarde et exports','Sauvegarde des données']};
 for(const [key,[name,desc]] of Object.entries(labels)){const b=document.createElement('button');b.type='button';b.className='ama-management-card';b.dataset.manageView=key;b.innerHTML=`<span class="ama-management-icon">${amaUiIcon(key)}</span><span><strong>${name}</strong><small>${desc}</small></span><span class="ama-management-chevron" aria-hidden="true">›</span>`;grid.appendChild(b)}overview.appendChild(grid);
 const add=document.createElement('button');add.type='button';add.id='amaManageAdd';add.className='ama-management-add';add.textContent='+ Ajouter…';add.setAttribute('aria-expanded','false');add.setAttribute('aria-controls','amaManageAddChoices');overview.appendChild(add);
 const addChoices=document.createElement('div');addChoices.id='amaManageAddChoices';addChoices.hidden=true;addChoices.className='ama-management-add-choices';addChoices.innerHTML='<button type="button" data-new-kind="team">Un intervenant</button><button type="button" data-new-kind="apartments">Un logement</button><button type="button" data-new-kind="clients">Un client</button>';overview.appendChild(addChoices);
 add.onclick=()=>{addChoices.hidden=!addChoices.hidden;add.setAttribute('aria-expanded',String(!addChoices.hidden))};
 document.getElementById('amaManage-team').append(teamCard,workerEditor);document.getElementById('amaManage-apartments').append(aptCard);document.getElementById('amaManage-clients').append(clientCard);document.getElementById('amaManage-settings').append(backupCard);
 const searchSpecs=[['workerForm',teamCard,'Intervenants','amaTeamSearch','Rechercher un intervenant…','#workerList .ama-worker-card'],['apartmentForm',aptCard,'Logements','amaAptSearch',null,null],['clientForm',clientCard,'Clients','amaClientSearch','Rechercher un client…','#clientList .mission']];
 for(const [formId,card,title,searchId,placeholder,selector] of searchSpecs){
  const form=document.getElementById(formId);form.hidden=true;
  card.querySelector('h3').textContent=title;
  const desc=card.querySelector('p.desc');if(desc)desc.textContent=({workerForm:'Comptes, coordonnées et autorisations.',apartmentForm:'Informations d’accès, durées et tarifs client.',clientForm:'Coordonnées et informations de facturation.'})[formId];
  const toolbar=document.createElement('div');toolbar.className='ama-management-toolbar';toolbar.innerHTML=`<button type="button" data-manage-add="${formId}" aria-controls="${formId}" aria-expanded="false">+ Ajouter</button>`;
  form.before(toolbar);
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='ghost';dismiss.textContent='Fermer le formulaire';dismiss.onclick=()=>{amaDiscardFormReturn(formId);form.hidden=true;toolbar.querySelector('button').setAttribute('aria-expanded','false')};form.appendChild(dismiss);
  if(placeholder){const input=document.createElement('input');input.type='search';input.id=searchId;input.className='ama-management-search';input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);toolbar.prepend(input);const filter=()=>document.querySelectorAll(selector).forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('fr').includes(input.value.trim().toLocaleLowerCase('fr')));input.oninput=filter;new MutationObserver(filter).observe(document.querySelector(selector.split(' ')[0]),{childList:true});}
 }
 const aptToggle=document.getElementById('amaAptToggle');aptToggle.hidden=true;document.getElementById('amaAptContents').hidden=false;
 backupCard.querySelector('h3').textContent='Sauvegarde et exports';backupCard.querySelector('p.desc').textContent='Téléchargez une copie des données accessibles à votre compte.';const obsolete=backupCard.querySelector('p.muted');if(obsolete)obsolete.textContent='Les données de l’application sont synchronisées avec Supabase. Les exports restent sous votre responsabilité.';
 admin.addEventListener('click',e=>{const view=e.target.closest('[data-manage-view]');if(view){amaShowManage(view.dataset.manageView);return;}const newKind=e.target.closest('[data-new-kind]');if(newKind){amaShowManage(newKind.dataset.newKind);amaOpenManageForm(({team:'workerForm',apartments:'apartmentForm',clients:'clientForm'})[newKind.dataset.newKind]);addChoices.hidden=true;add.setAttribute('aria-expanded','false');return;}const b=e.target.closest('[data-manage-add]');if(b){amaOpenManageForm(b.dataset.manageAdd);return;}if(e.target.closest('[data-client-edit]'))amaOpenManageForm('clientForm',false);if(e.target.closest('[data-action="apt-edit"]'))amaOpenManageForm('apartmentForm',false);},true);
 // Reuse each page's own title and icon. The back button travels with the active heading.
 amaHeadingTargets.planning=document.querySelector('.ama-planning-title');
 for(const [key,title] of [['dashboard',document.getElementById('welcomeTitle')],['history',document.querySelector('#tab-history h3')],['invoices',document.querySelector('#tab-invoices h3')]]){
  const row=document.createElement('div');row.className='ama-integrated-heading';title.before(row);row.innerHTML=key==='dashboard'?'':`<span class="ama-heading-tile">${amaUiIcon(key)}</span>`;row.appendChild(title);amaHeadingTargets[key]=row;
 }
 document.getElementById('amaPageHeading').hidden=true;
 // Hide empty original grid after its cards have moved.
 const oldGrid=admin.querySelector(':scope > .grid');if(oldGrid)oldGrid.hidden=true;
 amaUpdatePageHeading();
}
function amaRevenueComparison(month){
 const current=monthNow(),d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()-1);const previous=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
 if(month>current)return {text:'Comparaison disponible après réalisation',percent:null};
 const limit=month===current?Math.min(Number(today().slice(8)),new Date(d.getFullYear(),d.getMonth()+1,0).getDate()):31;
 const sum=period=>{let cents=0,missing=false;for(const m of data.missions){if(!m.date?.startsWith(period+'-')||m.date>today()||Number(m.date.slice(8))>limit||m.prolonged||!['done','not_entered'].includes(m.status))continue;const f=missionFinances.get(m.id),v=f?Number(f.revenue??Number(f.reference_hours)*Number(f.hourly_rate)):NaN;if(!Number.isFinite(v))missing=true;else cents+=Math.round(v*100);}return {cents,missing};};
 const a=sum(month),b=sum(previous),label=d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 if(a.missing||b.missing)return {text:'Comparaison indisponible : montants manquants',percent:null};
 if(b.cents<=0)return {text:'Pas de comparaison disponible',percent:null};
 const percent=(a.cents-b.cents)/b.cents*100,value=Math.abs(percent).toLocaleString('fr-FR',{maximumFractionDigits:1});return {percent,text:(percent>0?'+':percent<0?'−':'')+value+' % par rapport à '+label+(month===current?' · du 1 au '+limit:'')};
}
function renderHomeComparison(month){
 const el=document.getElementById('amaCaCompare');if(!el)return;
 el.replaceChildren();if(session?.role!=='admin')return;
 const result=amaRevenueComparison(month);el.setAttribute('aria-label',result.text);el.title=result.text;
 if(result.percent===null){el.textContent=result.text;return;}
 const match=result.text.match(/^([+−]?[0-9\s.,]+ %)(.*)$/u);
 if(!match){el.textContent=result.text;return;}
 const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()-1);
 const longMonth=d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),shortMonth=d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
 const percentage=document.createElement('span');percentage.className='ama-ca-percent';percentage.dataset.trend=result.percent<0?'negative':result.percent>0?'positive':'neutral';percentage.textContent=(result.percent<0?'↘ ':'')+match[1];
 const detail=document.createElement('span');detail.className='ama-ca-comparison-text';detail.textContent=match[2].replace(longMonth,shortMonth);
 el.append(percentage,detail);
}

function renderHomeSpark(){
 const svg=document.getElementById('amaHomeSpark');if(!svg)return;
 if(session?.role!=='admin'){svg.innerHTML='';return;}
 const month=document.getElementById('amaCaHomeMonth').value||monthNow();renderHomeComparison(month);const {actual,days}=amaRevenueDays(month);let sum=0;const values=actual.map(n=>(sum+=n));
 const current=today().slice(0,7),end=month<current?days:month===current?Number(today().slice(8)):0;
 const max=Math.max(100,...values),min=Math.min(0,...values),span=max-min||1,x=d=>4+d/days*112,y=n=>44-(n-min)/span*36;
 let path=`M 4 ${y(0)}`;for(let i=0;i<end;i++)path+=` L ${x(i+1)} ${y(values[i])}`;
 svg.innerHTML=`<defs><linearGradient id="amaHomeSparkFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#80E5C5" stop-opacity=".4"/><stop offset="1" stop-color="#80E5C5" stop-opacity="0"/></linearGradient></defs><path d="${path} L ${x(end)} 48 L 4 48 Z" fill="url(#amaHomeSparkFill)"/><path d="${path}" fill="none" stroke="#80E5C5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`+(end?`<circle cx="${x(end)}" cy="${y(values[end-1])}" r="3" fill="#d9fff6"/>`:'');
 document.getElementById('amaCaHomeValue').textContent=amaCompactEuro(sum/100);
 svg.setAttribute('aria-label','Évolution du CA estimé : '+euro(sum/100));
}
window.amaRefreshHomeSpark=renderHomeSpark;

// In-app document preview. Never replace the application or auto-launch printing.
function amaClosePdf(){
 const dialog=document.getElementById('amaPdfPreview');if(!dialog||dialog.hidden)return;
 dialog.hidden=true;document.getElementById('amaPdfFrame').srcdoc='';document.getElementById('app').inert=false;document.body.style.overflow=amaPdfState?.overflow||'';
 const previous=amaPdfState;amaPdfState=null;if(previous){amaRestoreScroll(previous.view);document.getElementById(previous.focus)?.focus({preventScroll:true});}
}
function amaOpenPdf(html,name,kind){
 if(!session)return;
 if(amaPdfState)amaClosePdf();
 const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script,.no-print').forEach(el=>el.remove());const responsive=doc.createElement('style');responsive.textContent='@media screen and (max-width:600px){body{margin:0!important;padding:14px!important;font-size:12px!important}table{table-layout:fixed!important}th,td{padding:8px 4px!important;font-size:11px!important;overflow-wrap:anywhere}.sheet{padding:0!important;min-height:0!important}.meta{display:block!important;min-height:0!important}.issuer{min-height:0!important}.meta-row .lbl{min-width:100px!important}.conditions{margin-top:20px!important}}';doc.head.appendChild(responsive);
 amaPdfState={html:doc.documentElement.outerHTML,name:name.replace(/[^a-zA-Z0-9_.-]/g,'_'),kind,owner:session.id,role:session.role,view:amaCaptureView(),focus:document.activeElement?.id||'',overflow:document.body.style.overflow,blob:null};
 document.getElementById('amaInvoiceMailButton').hidden=kind!=='invoice';
 document.getElementById('amaPdfPreview').classList.toggle('ama-m1-invoice-preview',kind==='invoice');let m1=document.getElementById('amaPdfM1Progress');if(!m1){m1=document.createElement('div');m1.id='amaPdfM1Progress';document.querySelector('#amaPdfPreview .ama-pdf-toolbar').appendChild(m1);}m1.innerHTML=kind==='invoice'?amaM1Steps(2):'';m1.hidden=kind!=='invoice';
 document.getElementById('amaPdfTitle').textContent=kind==='invoice'?'Aperçu de la facture':'Aperçu du relevé d’heures';document.getElementById('amaPdfFeedback').textContent='';
 const frame=document.getElementById('amaPdfFrame');frame.onload=()=>{try{frame.contentDocument.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();amaClosePdf();}})}catch(_){}};frame.srcdoc=amaPdfState.html;
 document.getElementById('amaPdfPreview').hidden=false;document.getElementById('app').inert=true;document.body.style.overflow='hidden';document.getElementById('amaPdfBack').focus();
}
function amaPdfText(el){
 if(!el)return '';const clone=el.cloneNode(true);clone.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));clone.querySelectorAll('p,.detail').forEach(n=>{n.prepend('\n');n.append('\n')});
 return clone.textContent.replace(/[\u202f\u00a0]/g,' ').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/[^\x20-\x7e\u00a0-\u024f\u20ac\n]/g,'').replace(/[ \t]+/g,' ').trim();
}

function amaFinalInvoicePdf(s     , test = false)         {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('normal.ttf', window.AMA_PDF_FONTS.normal);
  doc.addFileToVFS('bold.ttf', window.AMA_PDF_FONTS.bold);
  doc.addFont('normal.ttf', 'AMA', 'normal');
  doc.addFont('bold.ttf', 'AMA', 'bold');
  const blue                           = [49, 90, 114];
  const ink                           = [36, 51, 66];
  const muted                           = [100, 115, 129];
  const left = 16, right = 194, width = 178, bottom = 276;
  const issuer = s.issuer || {};
  const clean = (v         )         => String(v ?? '').replace(/\u00a0|\u202f/g, ' ');
  const money = (cents        )         => clean((Number(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €';
  const hours = (v        )         => clean(v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const day = (v         )         => {
    const raw = clean(v), m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
  };
  const period = (v         )         => {
    const raw = clean(v), m = raw.match(/^(\d{4})-(\d{2})/);
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const month = m ? months[Number(m[2]) - 1] : null;
    return m && month ? `${month} ${m[1]}` : raw;
  };
  function style(size = 9, bold = false, color                           = ink) {
    doc.setFont('AMA', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(...color);
  }
  function block(value         , x        , y        , maxWidth        , size = 9, bold = false, color                           = ink, align                   = 'left')         {
    const content = clean(value); if (!content) return y;
    style(size, bold, color);
    const lines = doc.splitTextToSize(content, maxWidth), step = size * 0.3528 * 1.4;
    for (const line of lines) {
      if (y > bottom) { doc.addPage(); y = 22; style(size, bold, color); }
      doc.text(line, x, y, { align }); y += step;
    }
    return y;
  }
  function ensureSpace(y        , height        )         {
    if (y + height > bottom) { doc.addPage(); return 22; }
    return y;
  }
  let top = 22;
  if (test) { style(10, true, blue); doc.text('TEST — SANS VALEUR COMPTABLE', left, top); top += 12; }

  // Grand logo à gauche du nom et de toutes les coordonnées.
  const logo = issuer.invoiceLogoData;
  const hasLogo = typeof logo === 'string' && logo.length > 0;
  let issuerX = left;
  let issuerWidth = 98;
  let logoProps                                           = null;
  if (hasLogo) {
    if (logo.length > 350000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(logo)) {
      throw Error('Logo de facturation invalide. Importez à nouveau le logo et enregistrez la configuration.');
    }
    try {
      const props = doc.getImageProperties(logo);
      if (!(props.width > 0 && props.height > 0) || props.width > 600 || props.height > 240) throw Error('Dimensions invalides');
      logoProps = { width: props.width, height: props.height };
      issuerX = left + 34;
      issuerWidth = 66;
    } catch (_) {
      throw Error('Logo illisible dans le PDF. Importez à nouveau le logo puis enregistrez.');
    }
  }
  let issuerY = block(issuer.invoiceIssuer, issuerX, top, hasLogo ? issuerWidth : 100, 19, true, blue);
  issuerY += 3;
  issuerY = block(issuer.invoiceIssuerAddress, issuerX, issuerY, issuerWidth, 9, false, muted);
  if (issuer.invoiceSiret) issuerY = block('SIRET : ' + issuer.invoiceSiret, issuerX, issuerY, issuerWidth, 8.5, false, muted);
  issuerY = block(issuer.invoiceIssuerEmail, issuerX, issuerY, issuerWidth, 8.5, false, muted);
  if (issuer.invoiceIssuerPhone) issuerY = block('Tél. : ' + issuer.invoiceIssuerPhone, issuerX, issuerY, issuerWidth, 8.5, false, muted);
  if (logoProps) {
    // Centre le logo dans une colonne de 30 mm, à hauteur du bloc entier.
    const blockTop = top - 19 * 0.3528 * 0.8;
    const blockHeight = Math.max(14, issuerY - 2 - blockTop);
    const ratio = Math.min(30 / logoProps.width, blockHeight / logoProps.height);
    const logoW = logoProps.width * ratio;
    const logoH = logoProps.height * ratio;
    try {
      doc.addImage(logo, 'PNG', left + (30 - logoW) / 2, blockTop + (blockHeight - logoH) / 2, logoW, logoH);
    } catch (_) {
      throw Error('Logo illisible dans le PDF. Importez à nouveau le logo puis enregistrez.');
    }
  }
  let metaY = block('FACTURE', right, top, 70, 13, true, blue, 'right');
  metaY += (21 - 13) * 0.3528 * 1.4 + 3;
  metaY = block(s.number, right, metaY, 70, 11, true, ink, 'right');
  metaY = block('Émise le ' + day(s.date), right, metaY, 70, 8.5, false, muted, 'right');
  metaY = block('Échéance : ' + day(s.due), right, metaY, 70, 8.5, false, muted, 'right');
  let y = ensureSpace(Math.max(issuerY, metaY) + 4, 39);
  doc.setDrawColor(...blue); doc.setLineWidth(0.3); doc.line(left, y, right, y); y += 8;
  let clientY = block('FACTURÉ À', left, y, 100, 8, false, muted) + 2;
  clientY = block(s.client?.name, left, clientY, 100, 11, true);
  clientY = block(s.client?.address, left, clientY, 100, 9, false, muted);
  if (s.client?.siret) clientY = block('SIRET : ' + s.client.siret, left, clientY, 100, 8.5, false, muted);
  let periodY = block('PÉRIODE FACTURÉE', right, y, 68, 8, false, muted, 'right') + 2;
  periodY = block(period(s.period), right, periodY, 68, 11, true, ink, 'right');
  y = Math.max(clientY, periodY) + 5;
                                                                                                                                        
  const groups = new Map               ();
  for (const row of s.rows || []) {
    const name = clean(row.apartment) || 'Prestation';
    let g = groups.get(name);
    if (!g) { g = { name, hours: 0, cents: 0, count: 0, dates: [], rates: new Set        (), unknownRate: false }; groups.set(name, g); }
    const h = Number(row.hours), cents = Number(row.cents);
    g.hours += h; g.cents += cents; g.count++;
    g.dates.push(day(row.date) + (row.status === 'not_entered' ? ' — Non entrés' : ''));
    if (h > 0 && Number.isFinite(cents / h)) g.rates.add(Math.round(cents / h)); else g.unknownRate = true;
  }
  const body = [...groups.values()].map(g => {
    let rate = '—';
    if (!g.unknownRate && g.rates.size === 1) rate = money([...g.rates][0]); else if (g.rates.size > 1) rate = 'Variable';
    return [g.name + '\n' + g.dates.join(' · '), String(g.count), hours(g.hours), rate, money(g.cents)];
  });
  doc.autoTable({
    startY: y, head: [['Désignation', 'Qté', 'Heures', 'Tarif / h', 'Montant HT']], body, theme: 'plain',
    margin: { top: 20, bottom: 24, left, right: 16 },
    styles: { font: 'AMA', fontSize: 8.5, textColor: ink, cellPadding: 3.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: 'bold', cellPadding: 3.5 },
    bodyStyles: { lineColor: [228, 233, 237], lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { cellWidth: 88 }, 1: { cellWidth: 14, halign: 'right' }, 2: { cellWidth: 20, halign: 'right' }, 3: { cellWidth: 26, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' } },
    rowPageBreak: 'avoid',
  });
  y = ensureSpace((doc       ).lastAutoTable.finalY + 10, Number(s.paid_cents) > 0 ? 46 : 40);
  style(9); doc.text('Total HT', 119, y); doc.text(money(s.total_cents), 190, y, { align: 'right' });
  if (Number(s.paid_cents) > 0) { y += 6; doc.text('Déjà payé', 119, y); doc.text(money(s.paid_cents), 190, y, { align: 'right' }); }
  y += 5;
  doc.setFillColor(234, 241, 245); doc.roundedRect(115, y, 79, 14, 1.5, 1.5, 'F');
  style(10, true, blue); doc.text('Montant à payer', 119, y + 8.7); doc.text(money(s.total_cents - Number(s.paid_cents || 0)), 190, y + 8.7, { align: 'right' }); y += 23;
  y = block('TVA non applicable, art. 293 B du CGI.', left, y, width, 8.5, false, muted);
  const iban = clean(issuer.invoiceIban).replace(/\s/g, '').toUpperCase();
  const bic = clean(issuer.invoiceBic).replace(/\s/g, '').toUpperCase();
  y = ensureSpace(y + 9, 35 + (iban ? 6 : 0) + (bic ? 6 : 0));
  doc.setDrawColor(228, 233, 237); doc.setLineWidth(0.25); doc.line(left, y, right, y); y += 8;
  y = block('PAIEMENT PAR VIREMENT', left, y, width, 8, false, muted) + 2;
  y = block('Date limite de paiement : ' + day(s.due), left, y, width, 9, true);
  if (iban) y = block('IBAN : ' + iban.replace(/(.{4})/g, '$1 ').trim(), left, y, width, 8.5, false, muted);
  if (bic) y = block('BIC : ' + bic, left, y, width, 8.5, false, muted);
  y = block('Référence à indiquer : ' + clean(s.number), left, y, width, 8.5, false, muted) + 6;
  const terms = 'Retard de paiement : pénalités selon les conditions contractuelles applicables. Indemnité forfaitaire de 40 € pour frais de recouvrement lorsque la réglementation le prévoit (transactions entre professionnels).';
  style(8, false, muted);
  y = ensureSpace(y, doc.splitTextToSize(terms, width).length * 8 * 0.3528 * 1.4);
  block(terms, left, y, width, 8, false, muted);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setDrawColor(228, 233, 237); doc.setLineWidth(0.25); doc.line(left, 283, right, 283); style(8, false, muted);
    const footer = doc.splitTextToSize(clean(issuer.invoiceIssuer) + ' · ' + clean(s.number), 155);
    doc.text(footer[0] || '', left, 289); doc.text(`${p} / ${pages}`, right, 289, { align: 'right' });
  }
  return doc.output('blob');
}

function amaFinalInvoiceHtml(s){
 const i=s.issuer,money=n=>(n/100).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 const groups=new Map();
 for(const row of s.rows){let g=groups.get(row.apartment);if(!g){g={name:row.apartment,count:0,h:0,cents:0,dates:[],rates:new Set(),unknown:false};groups.set(row.apartment,g)}g.count++;g.h+=row.hours;g.cents+=row.cents;g.dates.push(dateFr(row.date)+(row.status==='not_entered'?' — Non entrés':''));if(row.hours>0)g.rates.add(Math.round(row.cents/row.hours));else g.unknown=true;}
 const body=[...groups.values()].map(g=>'<tr><td>'+esc(g.name)+'<small>'+esc(g.dates.join(' · '))+'</small></td><td>'+g.count+'</td><td>'+esc(g.h.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</td><td>'+esc(!g.unknown&&g.rates.size===1?money([...g.rates][0]):g.rates.size>1?'Variable':'—')+'</td><td>'+esc(money(g.cents))+'</td></tr>').join('');
 const period=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s.period+'T12:00:00Z'));
 const logo=i.invoiceLogoData?'<img class="logo" src="'+esc(i.invoiceLogoData)+'" alt="Logo">':'';
 const text=v=>esc(v||'').replace(/\n/g,'<br>');
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(s.number)}</title><style>
 @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;font:10pt/1.4 Arial,sans-serif;color:#243342;background:#fff}.sheet{max-width:178mm;margin:auto}.header{display:flex;justify-content:space-between;gap:8mm}.company{display:flex;gap:4mm;align-items:center;max-width:100mm}.logo{width:30mm;max-height:40mm;object-fit:contain;flex:none}.company-text{min-width:0;overflow-wrap:anywhere}.name{font-size:19pt;font-weight:bold;color:#315a72;margin:0 0 3mm}.details{font-size:8.5pt;color:#647381}.meta{text-align:right;max-width:70mm;overflow-wrap:anywhere}.title{font-size:13pt;font-weight:bold;color:#315a72;margin:0 0 6mm}.number{font-weight:bold;font-size:11pt}.dates{font-size:8.5pt;color:#647381;margin-top:2mm}.rule{border:0;border-top:.3mm solid #315a72;margin:4mm 0 6mm}.client-row{display:flex;justify-content:space-between;gap:8mm}.client{max-width:100mm;overflow-wrap:anywhere}.period{text-align:right}.label{font-size:8pt;color:#647381;margin-bottom:2mm}.client-name{font-size:11pt;font-weight:bold;margin-bottom:1mm}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:5mm;font-size:8.5pt}thead{display:table-header-group}tr{break-inside:avoid}th{background:#315a72;color:#fff;padding:3.5mm;text-align:right}th:first-child{width:49.4%;text-align:left}td{padding:3.5mm;border-bottom:.2mm solid #e4e9ed;vertical-align:top;text-align:right}td:first-child{text-align:left}small{display:block;font-size:8pt;margin-top:1mm;overflow-wrap:anywhere}.totals{width:79mm;margin:10mm 0 0 auto;break-inside:avoid}.sum{display:flex;justify-content:space-between;gap:3mm;padding:2mm 4mm}.pay{background:#eaf1f5;color:#315a72;font-weight:bold;padding:4mm;border-radius:1.5mm}.tax{font-size:8.5pt;color:#647381;margin-top:6mm}.payment{margin-top:9mm;border-top:.25mm solid #e4e9ed;padding-top:6mm;font-size:8.5pt;break-inside:avoid;overflow-wrap:anywhere}.payment p{margin:1mm 0}.terms{font-size:8pt;color:#647381;margin-top:6mm}.foot{border-top:.25mm solid #e4e9ed;margin-top:12mm;padding-top:3mm;font-size:8pt;color:#647381}
 </style><style id="ama-login-brand-centered">
.ama-login-brand{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;margin-bottom:26px;color:#315a72}
.ama-login-brand .ama-logo{width:78px!important;height:78px!important;max-width:none;object-fit:contain;border-radius:18px!important}
.ama-login-brand strong{font-size:25px;line-height:1.2;font-weight:700}
.ama-login-brand span{font-size:10px;letter-spacing:1.6px;color:#637e88;line-height:1.5}
</style>
<style id="ama-rr-styles">
.ama-rr-toolbar,.ama-rr-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.ama-rr-toolbar{justify-content:flex-start;margin:14px 0}.ama-rr-item{margin-top:16px}.ama-rr-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.ama-rr-actions>.field,.ama-rr-actions>p,.ama-rr-alert{flex-basis:100%}.ama-rr-actions select{width:100%;margin:6px 0 10px}.ama-rr-alert{background:#fff3df;color:#805019;border-radius:10px;padding:12px}.ama-rr details{margin:14px 0}.ama-rr a{overflow-wrap:anywhere}.ama-rr [hidden]{display:none!important}@media(max-width:600px){.ama-rr-actions>button{width:100%}.ama-rr-row h3{overflow-wrap:anywhere}}
</style>
<style id="ama-rr-v4">.ama-rr-console .ama-rr-setting{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid #e1eaed;border-bottom:1px solid #e1eaed;padding:15px 0;margin:12px 0}.ama-rr-setting strong{font-size:14px}.ama-rr-setting small{display:block;color:#7c909a;font-size:12px;margin-top:3px}.ama-rr-console #amaRRAuto{appearance:none;-webkit-appearance:none;position:relative;width:44px!important;height:26px!important;min-height:26px;border:0;background:#bbc8cd;border-radius:20px;flex-shrink:0;cursor:pointer;transition:background .15s}.ama-rr-console #amaRRAuto:before{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 3px #0002;transition:transform .15s}.ama-rr-console #amaRRAuto:checked{background:#438e77}.ama-rr-console #amaRRAuto:checked:before{transform:translateX(18px)}.ama-rr-console #amaRRAuto:focus-visible{outline:2px solid #357d88;outline-offset:3px}.ama-rr-note{font-size:12px!important;color:#6d8792;background:#f2f7f8;border-radius:10px;padding:10px;line-height:1.55}.ama-rr-menu{margin:15px 0;border:1px solid #dde8ec;border-radius:13px;overflow:hidden}.ama-rr-menu button{display:flex;align-items:center;gap:9px;justify-content:space-between;width:100%;border:0!important;border-bottom:1px solid #e6edf0!important;border-radius:0!important;background:white!important;color:#355b6e!important;padding:13px!important;min-height:44px;font-size:13px!important;text-align:left}.ama-rr-menu button:last-child{border-bottom:0!important}.ama-rr-menu span{margin-left:auto;font-size:12px;background:#eaf3ee;border-radius:12px;padding:2px 7px}.ama-rr-openplan{width:100%;font-size:13px!important;min-height:42px!important}.ama-rr-console #amaRRHealth{font-size:12px;color:#4a8770}.ama-rr-console #amaRRInspector{margin-top:20px;padding-top:15px;border-top:1px solid #e1eaed}.ama-rr-modal-open{overflow:hidden!important}.ama-rr-dialog{position:fixed;inset:auto 0 0 0;margin:0 auto;box-sizing:border-box;width:min(680px,100%);max-width:100%;max-height:88dvh;height:auto;overflow-y:auto;overscroll-behavior:contain;border:1px solid #dce7eb;border-bottom:0;border-radius:23px 23px 0 0;padding:0 18px max(16px,env(safe-area-inset-bottom));background:#fff;color:#315667;box-shadow:0 -10px 60px #183b5530;z-index:10020}.ama-rr-dialog::backdrop{background:#18374670;backdrop-filter:blur(2px)}.ama-rr-dialog:not([open]){display:none!important}.ama-rr-sheet-handle{height:22px;display:flex;align-items:center;justify-content:center;touch-action:none}.ama-rr-sheet-handle span{display:block;width:36px;height:4px;background:#b7c8ce;border-radius:4px}.ama-rr-sheet-title h3{font-size:19px;margin:0}.ama-rr-sheet-title small{font-size:12px;color:#78909c}.ama-rr-sheet-title button{min-width:36px;min-height:36px;padding:8px!important;font-size:16px!important;background:#f1f6f7!important}.ama-rr-weeknav{display:flex;align-items:center;gap:8px;margin:15px 0 8px}.ama-rr-weeknav strong{text-align:center;flex:1;font-size:12px}.ama-rr-weeknav button{min-width:36px;min-height:36px;padding:5px!important;font-size:23px!important;background:#f0f6f7!important;color:#315c70!important}.ama-rr-weeksummary{font-size:11px;margin-bottom:12px;gap:6px}.ama-rr-weeksummary button{font-size:11px!important;min-height:32px!important;padding:6px 8px!important;background:#eaf4ef!important;color:#32705d!important}.ama-rr-weeksummary #amaRRWeekAlerts{color:#af4e4e}.ama-rr-dialog .ama-rr-day{text-transform:capitalize;font-size:12px;letter-spacing:.2px;background:#f3f7f8;margin:14px -18px 0;padding:9px 18px;color:#5a7480}.ama-rr-dialog .ama-rr-item{border:0;border-bottom:1px solid #e1eaed;border-radius:0;margin:0;padding:0 5px;background:white}.ama-rr-dialog .ama-rr-participation_cancelled{background:#fff4f3}.ama-rr-dialog .ama-rr-assigned:has(details[open]){background:#f3faf6}.ama-rr-dialog .ama-rr-expanded .primary{width:auto!important}.ama-rr-dialog .ama-rr-toolbar{margin:12px 0}.ama-rr-dialog .ama-rr-empty{padding:25px 0;color:#718792;font-size:13px;line-height:1.7}.ama-rr-dialog .ama-rr-note{margin-top:12px}.ama-rr-dialog #amaRRQueueFeedback:empty{display:none}.ama-rr-dialog #amaRRQueueFeedback{font-size:12px;line-height:1.6}.ama-rr-dialog .ama-rr-weeknav{scroll-margin-top:15px}@media(min-width:760px){.ama-rr-dialog{bottom:20px;max-height:85dvh;border-bottom:1px solid #dce7eb;border-radius:22px;padding-bottom:20px}}@media(prefers-reduced-motion:reduce){.ama-rr-setting input,.ama-rr-setting input:before{transition:none!important}}
</style>
<style>/* Planning compact administrateur ; les fiches intervenants gardent leur fonctionnement. */
#tab-planning.ama-plan-admin .ama-planning-filters{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:end}
#tab-planning.ama-plan-admin .ama-date-navigation{grid-column:1/-1;width:100%;min-width:0}
#tab-planning.ama-plan-admin .ama-planning-filters>.field{width:auto!important;max-width:none!important;min-width:0!important;margin:0}
#tab-planning.ama-plan-admin .ama-planning-filters select{width:100%;min-width:0;min-height:44px;height:44px;font-size:14px;padding:8px 10px}
.ama-plan-overview{font-size:13px;color:#7c929f;margin:12px 0 16px}
#missionList .ama-plan-card{display:block!important;position:relative;padding:0!important;margin:0 0 12px;overflow:visible;background:#fff;border:1px solid #dce8ed;border-radius:18px}
.ama-plan-detail>summary{display:block;list-style:none;cursor:pointer;padding:18px 52px 18px 16px;position:relative;min-height:78px}
.ama-plan-detail>summary::-webkit-details-marker,.ama-plan-menu>summary::-webkit-details-marker{display:none}
.ama-plan-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ama-plan-heading>strong{font-size:17px;line-height:1.3;overflow-wrap:anywhere}
.ama-plan-heading .badge{font-size:11px;white-space:normal;flex-shrink:0;max-width:105px}
.ama-plan-detail .ama-mission-meta{display:flex;gap:10px;flex-wrap:wrap;margin:9px 0 0!important;font-size:12px}
.ama-plan-detail>summary .ama-mission-meta>span:first-child{display:none}
.ama-plan-chevron{position:absolute;right:20px;bottom:14px;font-size:20px;color:#345e70}
.ama-plan-detail[open]>summary .ama-plan-chevron{transform:rotate(180deg)}
.ama-plan-note{display:inline-block;margin-top:9px;font-size:12px;color:#986e1e;background:#fff7e2;border-radius:7px;padding:3px 8px}
.ama-plan-expanded{padding:0 16px 16px;border-top:1px solid #edf2f4}
.ama-plan-expanded .ama-apt-modern{margin:12px 0!important;padding:13px!important;border-radius:14px}
.ama-plan-expanded .ama-apt-address p{font-size:14px!important;line-height:1.45}
.ama-plan-expanded .ama-map-button{padding:8px!important;min-height:36px;margin:10px 0!important;font-size:13px!important}
.ama-plan-expanded .ama-apt-facts{padding-top:10px!important;gap:10px}
.ama-plan-expanded .ama-apt-fact strong{font-size:15px!important}
.ama-plan-expanded .ama-apt-address small,.ama-plan-expanded .ama-apt-fact small{font-size:11px}
.ama-plan-expanded .ama-bill-summary{font-size:12px!important;margin:10px 0}
.ama-plan-expanded .mission-note{margin:12px 0;padding:10px;font-size:13px}
.ama-plan-expanded .ama-validate{width:100%;min-height:44px!important;font-size:14px!important;justify-content:center;margin-top:8px}
.ama-plan-menu{position:absolute;top:12px;right:9px;z-index:2}
.ama-plan-menu>summary{list-style:none;cursor:pointer;color:#668594;width:36px;height:36px;display:grid;place-items:center;font-size:25px;border-radius:9px}
.ama-plan-menu[open]>summary{background:#edf4f6}
.ama-plan-menu>div{position:absolute;right:0;top:38px;background:#fff;border:1px solid #dce8ed;border-radius:12px;padding:6px;box-shadow:0 8px 24px #27495920;min-width:140px}
.ama-plan-menu button{display:block;width:100%;min-height:42px;text-align:left;border:0;background:transparent;color:#345e70;padding:8px 12px;font-size:14px}
.ama-plan-menu button.danger{color:#b94250}
#amaRRInspector{padding:16px!important}
#amaRRInspector .ama-provider-dialog-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0}
#amaRRInspectorView{min-width:0;flex:1}
#amaRRInspector #amaRRInspectorSubtitle{color:#8197a4;font-size:14px}
.ama-stay-cleanup input[type=date]{appearance:none;-webkit-appearance:none;display:block;width:100%;min-width:0;box-sizing:border-box;min-height:44px;border:1px solid #dce8ed;border-radius:12px;background:#f7fafb;color:#345e70;padding:10px;font:inherit;margin:8px 0 14px}
.ama-stay-cleanup button{min-height:44px;border:1px solid #dce8ed;background:#eaf4f1;color:#337f70;border-radius:12px;padding:10px 16px;font:inherit;font-weight:600}
.ama-provider-dialog select{appearance:none;-webkit-appearance:none;min-height:44px;border:1px solid #dce8ed;border-radius:12px;background:#f7fafb;color:#345e70;padding:10px 28px 10px 12px;font:inherit;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%23345e70' stroke-width='2'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
#amaRRInspector .ama-stay-card h4{margin:0 0 10px;font-size:17px}
#amaRRInspector .ama-stay-actions a{display:inline-block;color:#345e70;font-size:13px;margin-top:10px}
@media(max-width:700px){#tab-planning.ama-plan-admin .ama-date-navigation{grid-template-columns:34px minmax(0,1fr) 34px auto!important;gap:6px!important}#tab-planning.ama-plan-admin .ama-date-navigation>label{grid-column:1/-1}#tab-planning.ama-plan-admin .ama-date-navigation button{min-width:0!important;padding:8px!important;font-size:12px!important;min-height:44px!important;height:44px!important}#tab-planning.ama-plan-admin #planningDate{width:100%;min-width:0;font-size:14px;height:44px;min-height:44px;padding:6px}#tab-planning.ama-plan-admin .ama-date-input{min-width:0!important;width:auto!important}.ama-plan-heading{align-items:start}.ama-plan-heading>strong{font-size:16px}.ama-plan-heading .badge{font-size:10px;max-width:95px}#amaRRInspector .ama-provider-dialog-tools{flex-wrap:wrap}#amaRRInspectorView{width:100%;flex-basis:100%}}
</style>
</head><body><div class="sheet"><div class="header"><div class="company">${logo}<div class="company-text"><div class="name">${text(i.invoiceIssuer)}</div><div class="details">${text(i.invoiceIssuerAddress)}<br>SIRET : ${text(i.invoiceSiret)}${i.invoiceIssuerEmail?'<br>'+text(i.invoiceIssuerEmail):''}${i.invoiceIssuerPhone?'<br>Tél. : '+text(i.invoiceIssuerPhone):''}</div></div></div><div class="meta"><div class="title">FACTURE</div><div class="number">${esc(s.number)}</div><div class="dates">Émise le ${esc(dateFr(s.date))}<br>Échéance : ${esc(dateFr(s.due))}</div></div></div><hr class="rule"><div class="client-row"><div class="client"><div class="label">FACTURÉ À</div><div class="client-name">${text(s.client.name)}</div><div class="details">${text(s.client.address)}${s.client.siret?'<br>SIRET : '+text(s.client.siret):''}</div></div><div class="period"><div class="label">PÉRIODE FACTURÉE</div><b>${esc(period)}</b></div></div><table><thead><tr><th>Désignation</th><th>Qté</th><th>Heures</th><th>Tarif / h</th><th>Montant HT</th></tr></thead><tbody>${body}</tbody></table><div class="totals"><div class="sum"><span>Total HT</span><span>${esc(money(s.total_cents))}</span></div>${s.paid_cents?'<div class="sum"><span>Déjà payé</span><span>'+esc(money(s.paid_cents))+'</span></div>':''}<div class="sum pay"><span>Montant à payer</span><span>${esc(money(s.total_cents-s.paid_cents))}</span></div></div><p class="tax">TVA non applicable, art. 293 B du CGI.</p><div class="payment"><div class="label">PAIEMENT PAR VIREMENT</div><p><b>Date limite de paiement : ${esc(dateFr(s.due))}</b></p>${i.invoiceIban?'<p>IBAN : '+esc(i.invoiceIban.replace(/\s/g,'').toUpperCase().replace(/(.{4})/g,'$1 ').trim())+'</p>':''}${i.invoiceBic?'<p>BIC : '+text(i.invoiceBic.toUpperCase())+'</p>':''}<p>Référence à indiquer : ${esc(s.number)}</p></div><p class="terms">Retard de paiement : pénalités selon les conditions contractuelles applicables. Indemnité forfaitaire de 40 € pour frais de recouvrement lorsque la réglementation le prévoit (transactions entre professionnels).</p><div class="foot">${text(i.invoiceIssuer)} · ${esc(s.number)}</div></div>
<style id="ama-orbits-approved">
#amaWelcomeOverlay,#amaSessionLoading{background:#f3f8f8;color:#315a72;font-family:Arial,sans-serif}
#amaSessionLoading{position:fixed;inset:0;z-index:99998;min-height:100vh;min-height:100dvh;box-sizing:border-box}
#amaWelcomeOverlay .ama-welcome-stage,#amaSessionLoading .ama-welcome-stage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;width:100%;max-width:350px;min-height:0;margin:auto;text-align:center}
#amaWelcomeOverlay .ama-welcome-stage[hidden]{display:none!important}
#amaWelcomeLoading .ama-welcome-symbol,#amaSessionLoading .ama-welcome-symbol{width:190px;height:190px;position:relative;display:grid;place-items:center;margin-bottom:26px}
.ama-orbit-ring.ama-welcome-arc{position:absolute;inset:0;border:2px solid transparent;border-top-color:#398b7b;border-right-color:#398b7b;border-radius:50%;transform:rotate(-30deg);transform-origin:center;box-sizing:border-box}
.ama-orbit-ring.ama-welcome-arc-b{inset:12px;border-color:transparent;border-bottom-color:#91c8ae;border-left-color:#91c8ae;transform:rotate(20deg)}
.ama-orbit-icon{width:102px;height:102px;object-fit:contain;border-radius:23px;position:relative;animation:amaOrbitIconArrive 1.2s cubic-bezier(.2,.8,.2,1) both}
.ama-orbit-title{font:700 24px/1.3 Arial,sans-serif;letter-spacing:-.4px;margin:0 0 12px;color:#315a72;animation:amaOrbitTextArrive .9s .15s both}
#amaWelcomeLoading .ama-welcome-subtitle,#amaSessionLoading .ama-welcome-subtitle{font:400 14px/1.6 Arial,sans-serif;color:#718995;margin:0;width:100%}
.ama-orbit-dots{display:flex;gap:6px;margin-top:25px;height:8px}
.ama-orbit-dots b{display:block;width:5px;height:5px;border-radius:50%;background:#398b7b;opacity:.4;animation:amaOrbitDotStep .7s 3 alternate}
.ama-orbit-dots b:nth-child(2){animation-delay:.16s}.ama-orbit-dots b:nth-child(3){animation-delay:.32s}
#amaWelcomeLoading .ama-welcome-arc-a.ama-run,#amaSessionLoading .ama-welcome-arc-a{animation:amaOrbitForward 2.4s cubic-bezier(.22,.65,.35,1) both}
#amaWelcomeLoading .ama-welcome-arc-b.ama-run,#amaSessionLoading .ama-welcome-arc-b{animation:amaOrbitBackward 2.4s cubic-bezier(.22,.65,.35,1) both}
#amaWelcomeSuccess{gap:16px!important}
#amaSessionLoading:has(#amaSessionRetry:not([hidden])) .ama-orbit-title,#amaSessionLoading:has(#amaSessionRetry:not([hidden])) .ama-orbit-dots{display:none}
@keyframes amaOrbitForward{from{transform:rotate(-130deg);opacity:.25}to{transform:rotate(330deg);opacity:1}}
@keyframes amaOrbitBackward{from{transform:rotate(170deg);opacity:.25}to{transform:rotate(-290deg);opacity:1}}
@keyframes amaOrbitIconArrive{from{transform:translateY(8px) scale(.93)}to{transform:translateY(0) scale(1)}}
@keyframes amaOrbitTextArrive{from{transform:translateY(9px);opacity:.4}to{transform:translateY(0);opacity:1}}
@keyframes amaOrbitDotStep{from{transform:translateY(0);opacity:.3}to{transform:translateY(-3px);opacity:1}}
@media(prefers-reduced-motion:reduce){#amaWelcomeOverlay *,#amaSessionLoading *{animation:none!important;transition:none!important}}
</style>
<style>.ama-cut-session{padding:8px 11px;border:1px solid #d5e3e7;border-radius:9px;background:#fff;color:#935047;font-size:12px;white-space:nowrap}.ama-cut-session:disabled{opacity:.55}</style></body></html>`;
}

function amaBuildDocumentPdf(state){
 if(state.kind==='invoice'&&state.invoice?.snapshot)return amaFinalInvoicePdf(state.invoice.snapshot,false);
 if(!window.jspdf?.jsPDF)throw Error('Le module PDF est indisponible. Actualisez l’application.');
 const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});const source=new DOMParser().parseFromString(state.html,'text/html');
 doc.addFileToVFS('ama-normal.ttf',window.AMA_PDF_FONTS.normal);doc.addFileToVFS('ama-bold.ttf',window.AMA_PDF_FONTS.bold);doc.addFont('ama-normal.ttf','AmaSans','normal');doc.addFont('ama-bold.ttf','AmaSans','bold');
 const margin=16,width=178;let y=20;doc.setFont('AmaSans','normal');doc.setTextColor(35,57,67);
 function ensure(height){if(y+height>278){doc.addPage();y=20;}}
 function paragraph(text,size=10,bold=false){if(!text)return;doc.setFont('AmaSans',bold?'bold':'normal');doc.setFontSize(size);const lines=doc.splitTextToSize(text,width);for(const line of lines){ensure(size*.45+2);doc.text(line,margin,y);y+=size*.45+1;}y+=3;}
 if(state.kind==='hours'){
  const rows=[...source.querySelectorAll('tbody tr[data-date]')];
  const body=rows.map(row=>[...row.children].map(amaPdfText));
  const meta=amaPdfText(source.querySelector('.report-meta'));
  const heading=()=>{doc.setTextColor(49,90,114);doc.setFont('AmaSans','bold');doc.setFontSize(13);doc.text('AMA COMPANY',16,18);doc.setFontSize(11);doc.text('RELEVÉ D’HEURES',194,18,{align:'right'});doc.setFont('AmaSans','normal');doc.setFontSize(9);const lines=doc.splitTextToSize(meta,178);doc.text(lines,16,25);const bottom=27+(lines.length-1)*4;doc.setDrawColor(57,139,123);doc.setLineWidth(.35);doc.line(16,bottom,194,bottom);return bottom+4;};
  const start=heading(),seenPages=new Set();
  doc.autoTable({head:[['Date','Appartement','Heures']],body:body.length?body:[[{content:'Aucune intervention validée pour ce mois.',colSpan:3}]],foot:[['TOTAL DU MOIS',source.querySelector('.total')?.dataset.count+' intervention(s)',source.querySelector('.total')?.dataset.hours||'0 h']],showFoot:'lastPage',startY:start,margin:{left:16,right:16,top:start,bottom:18},theme:'plain',styles:{font:'AmaSans',fontSize:9,cellPadding:{top:.7,bottom:.7,left:2,right:2},overflow:'linebreak',textColor:[49,90,114],lineColor:[220,230,233],lineWidth:{bottom:.12}},headStyles:{fillColor:[233,240,243],fontStyle:'bold'},footStyles:{fillColor:[233,240,243],fontStyle:'bold'},columnStyles:{0:{cellWidth:32},1:{cellWidth:122},2:{cellWidth:24,halign:'right'}},rowPageBreak:'avoid',willDrawPage:()=>{heading();},didParseCell:hook=>{if(hook.section==='body'&&hook.column.index===0&&rows[hook.row.index])hook.cell.text=[amaPdfText(rows[hook.row.index].children[0])];},willDrawCell:hook=>{if(hook.section==='body'&&hook.column.index===0&&rows[hook.row.index]){if(!seenPages.has(hook.pageNumber)){seenPages.add(hook.pageNumber);hook.cell.text=[rows[hook.row.index].dataset.date];}}}});
  const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('AmaSans','normal');doc.setFontSize(8);doc.setTextColor(100,120,132);doc.text('Interventions validées',16,287);doc.text('Page '+i+' / '+pages,194,287,{align:'right'});}
  return doc.output('blob');
 }
 if(state.kind==='invoice'){
  const issuer=source.querySelector('.issuer');paragraph(amaPdfText(issuer?.querySelector('b')),15,true);paragraph([...issuer.querySelectorAll('p')].map(amaPdfText).join('\n'),9);
  const logo=issuer?.querySelector('img');if(logo?.src&&/^data:image\/(png|jpeg|webp);base64,/.test(logo.src)){try{const props=doc.getImageProperties(logo.src);const w=Math.min(38,20*props.width/props.height),h=w*props.height/props.width;doc.addImage(logo.src,undefined,194-w,16,w,h);}catch(_){}}
  paragraph('FACTURE',13,true);source.querySelectorAll('.meta .meta-row').forEach(row=>paragraph(amaPdfText(row.querySelector('.lbl'))+' '+amaPdfText(row.querySelector('.val')),9));
 }else{
  paragraph('AMA Company',17,true);paragraph('Relevé mensuel des heures validées',12,true);paragraph(amaPdfText(source.querySelector('body > p')),10);
 }
 const table=source.querySelector('table'),heads=[...(table?.querySelectorAll('thead th')||[])].map(amaPdfText);
 const body=[...(table?.querySelectorAll('tbody tr')||[])].map(tr=>[...tr.children].map(td=>td.colSpan>1?{content:amaPdfText(td),colSpan:td.colSpan}:amaPdfText(td)));
 doc.autoTable({head:[heads],body,startY:y,margin:{left:margin,right:margin,top:18,bottom:22},styles:{font:'AmaSans',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[35,57,67],lineColor:[220,230,233]},headStyles:{fillColor:[49,90,114],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[246,249,249]},columnStyles:state.kind==='invoice'?{0:{cellWidth:88},1:{cellWidth:24,halign:'right'},2:{cellWidth:31,halign:'right'},3:{cellWidth:35,halign:'right'}}:undefined});
 y=doc.lastAutoTable.finalY+9;
 if(state.kind==='invoice'){
  ensure(44);source.querySelectorAll('.total-row').forEach(row=>{const cells=[...row.children].map(amaPdfText);doc.setFont('AmaSans',row.classList.contains('final')?'bold':'normal');doc.setFontSize(row.classList.contains('final')?12:10);doc.text(cells[0]||'',95,y);doc.text(cells[1]||'',194,y,{align:'right'});y+=8;});
  y+=5;paragraph(amaPdfText(source.querySelector('.tax')),8);paragraph('Conditions générales',10,true);source.querySelectorAll('.conditions p').forEach(n=>paragraph(amaPdfText(n),9));
 }else{ensure(24);paragraph(amaPdfText(source.querySelector('.total')),12,true);paragraph(amaPdfText(source.querySelector('.note')),9);}
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('AmaSans','normal');doc.setFontSize(8);doc.setTextColor(100,120,132);doc.text('AMA Company',16,287);doc.text(i+' / '+pages,194,287,{align:'right'});}
 return doc.output('blob');
}
document.getElementById('amaPdfBack').onclick=amaClosePdf;
document.getElementById('amaPdfDownload').onclick=async()=>{
 const state=amaPdfState,status=document.getElementById('amaPdfFeedback');if(!state||session?.id!==state.owner)return;
 const button=document.getElementById('amaPdfDownload');button.disabled=true;status.textContent='Préparation du PDF…';
 try{
  const blob=state.blob||(state.blob=amaBuildDocumentPdf(state));const file=new File([blob],state.name,{type:'application/pdf'});
  const mobileApple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(mobileApple&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:state.name});}
  else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=state.name;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  if(amaPdfState===state)status.textContent='PDF prêt. Vous pouvez revenir à l’application.';
 }catch(e){if(amaPdfState===state)status.textContent=e.name==='AbortError'?'Enregistrement annulé.':('Impossible de préparer le PDF : '+(e.message||e));}finally{button.disabled=false;}
};
document.getElementById('amaPdfPrint').onclick=()=>{if(!amaPdfState)return;try{const frame=document.getElementById('amaPdfFrame');frame.contentWindow.focus();frame.contentWindow.print();}catch(_){document.getElementById('amaPdfFeedback').textContent='Utilisez Télécharger le PDF pour l’enregistrer ou l’imprimer.';}};
document.getElementById('amaPdfPreview').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();amaClosePdf();}if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll('button:not(:disabled),iframe')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});

function saveReportFile(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function excelReport(){
 if(!session||session.role!=='admin')return;
 if(!$('#reportWorker').value){alert('Sélectionnez un intervenant.');return}
 const workerName=userById($('#reportWorker').value)?.name||'Intervenant';
 const ms=reportRows(),month=$('#reportMonth').value||monthNow(),total=ms.reduce((n,m)=>n+sharedHours(m),0);
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const lines=[['AMA Company — Relevé d’heures'],['Intervenant',workerName],['Mois',month],[],['Date','Logement','Heures validées','Statut'],...ms.map(m=>[m.date,m.apartmentName||'',Number(m.hours||0).toLocaleString('fr-FR',{useGrouping:false}),'Réalisée']),[],['TOTAL','',total.toLocaleString('fr-FR',{useGrouping:false})]];
 const csv='\ufeff'+lines.map(r=>r.map(q).join(';')).join('\r\n');
 saveReportFile(new Blob([csv],{type:'text/csv;charset=utf-8;'}),`AMA_Releve_heures_${workerName.replace(/[^a-z0-9-]/gi,"_")}_${month}.csv`);
}
function pdfReport(){
 if(!session)return;
 if(session.role==='admin'&&!$('#reportWorker').value){alert('Sélectionnez un intervenant.');return}
 const workerName=session.role==='admin'?(userById($('#reportWorker').value)?.name||'Intervenant'):session.name;
 const ms=reportRows(),month=$('#reportMonth').value||monthNow(),total=ms.reduce((n,m)=>n+sharedHours(m),0);
 let previousDate='';
 const body=ms.map(m=>{const date=dateFr(m.date),label=m.date===previousDate?'':date;previousDate=m.date;return `<tr data-date="${esc(date)}"><td>${esc(label)}</td><td>${esc(m.apartmentName||'')}</td><td>${esc(hours(sharedHours(m)))}</td></tr>`;}).join('');
 const period=new Date(month+'-01T12:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Relevé d’heures AMA — ${esc(month)}</title><style>@page{size:A4;margin:14mm 16mm 17mm}*{box-sizing:border-box}body{font:9pt Arial,sans-serif;color:#315a72;margin:0;padding:14mm 16mm;background:white}header{border-bottom:1px solid #398b7b;padding-bottom:7px;margin-bottom:10px}.heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{font-size:15pt;font-weight:bold}h1{font-size:12pt;margin:0;white-space:nowrap}.report-meta{margin:7px 0 0;font-size:9pt}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:3px 7px;border-bottom:1px solid #dce6e9;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#e9f0f3}th:first-child{width:18%}th:last-child{width:14%}td:last-child,th:last-child{text-align:right}thead{display:table-header-group}tr{break-inside:avoid}.total{display:flex;justify-content:space-between;gap:8px;background:#e9f0f3;padding:7px;font-weight:bold;margin-top:7px;break-inside:avoid}.note{font-size:8pt;color:#647884;margin-top:15px;text-align:right}@media print{body{padding:0}header{break-after:avoid}}</style><style id="ama-photo-menu-minimal">
/* Photo actions are grouped in the overflow menu. */
.ama-profile-options{flex-basis:44px;align-self:center}
.ama-photo-more{display:flex!important;align-items:center;justify-content:center;gap:4px;width:44px!important;min-width:44px!important;height:44px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;letter-spacing:0;transform:none!important}
.ama-photo-more:hover,.ama-photo-more:active{background:transparent!important;box-shadow:none!important;filter:none}
.ama-photo-more:focus-visible{outline:2px solid #398b7b;outline-offset:2px}
.ama-photo-dot{width:4px;height:4px;border-radius:50%;background:currentColor;display:block;flex:none}
.ama-photo-menu{top:46px;min-width:215px;border-radius:15px;padding:6px;box-shadow:0 10px 28px #24485b16}
.ama-photo-menu button{min-height:44px;padding:12px 11px!important;gap:12px;font-size:13px!important}
.ama-photo-menu .ama-photo-delete{margin-top:3px;border-top:1px solid #edf1f2!important;border-radius:0!important}
#amaAvatarChooser[hidden]{display:none!important}
#amaAvatarStatus:empty{display:none}
#amaAccountModal .ama-profile-preview{overflow:visible}
</style>
<style id="ama-login-brand-centered">
.ama-login-brand{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;margin-bottom:26px;color:#315a72}
.ama-login-brand .ama-logo{width:78px!important;height:78px!important;max-width:none;object-fit:contain;border-radius:18px!important}
.ama-login-brand strong{font-size:25px;line-height:1.2;font-weight:700}
.ama-login-brand span{font-size:10px;letter-spacing:1.6px;color:#637e88;line-height:1.5}
</style>
<style id="ama-rr-styles">
.ama-rr-toolbar,.ama-rr-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.ama-rr-toolbar{justify-content:flex-start;margin:14px 0}.ama-rr-item{margin-top:16px}.ama-rr-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.ama-rr-actions>.field,.ama-rr-actions>p,.ama-rr-alert{flex-basis:100%}.ama-rr-actions select{width:100%;margin:6px 0 10px}.ama-rr-alert{background:#fff3df;color:#805019;border-radius:10px;padding:12px}.ama-rr details{margin:14px 0}.ama-rr a{overflow-wrap:anywhere}.ama-rr [hidden]{display:none!important}@media(max-width:600px){.ama-rr-actions>button{width:100%}.ama-rr-row h3{overflow-wrap:anywhere}}
</style>
<style id="ama-rr-v4">.ama-rr-console .ama-rr-setting{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid #e1eaed;border-bottom:1px solid #e1eaed;padding:15px 0;margin:12px 0}.ama-rr-setting strong{font-size:14px}.ama-rr-setting small{display:block;color:#7c909a;font-size:12px;margin-top:3px}.ama-rr-console #amaRRAuto{appearance:none;-webkit-appearance:none;position:relative;width:44px!important;height:26px!important;min-height:26px;border:0;background:#bbc8cd;border-radius:20px;flex-shrink:0;cursor:pointer;transition:background .15s}.ama-rr-console #amaRRAuto:before{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 3px #0002;transition:transform .15s}.ama-rr-console #amaRRAuto:checked{background:#438e77}.ama-rr-console #amaRRAuto:checked:before{transform:translateX(18px)}.ama-rr-console #amaRRAuto:focus-visible{outline:2px solid #357d88;outline-offset:3px}.ama-rr-note{font-size:12px!important;color:#6d8792;background:#f2f7f8;border-radius:10px;padding:10px;line-height:1.55}.ama-rr-menu{margin:15px 0;border:1px solid #dde8ec;border-radius:13px;overflow:hidden}.ama-rr-menu button{display:flex;align-items:center;gap:9px;justify-content:space-between;width:100%;border:0!important;border-bottom:1px solid #e6edf0!important;border-radius:0!important;background:white!important;color:#355b6e!important;padding:13px!important;min-height:44px;font-size:13px!important;text-align:left}.ama-rr-menu button:last-child{border-bottom:0!important}.ama-rr-menu span{margin-left:auto;font-size:12px;background:#eaf3ee;border-radius:12px;padding:2px 7px}.ama-rr-openplan{width:100%;font-size:13px!important;min-height:42px!important}.ama-rr-console #amaRRHealth{font-size:12px;color:#4a8770}.ama-rr-console #amaRRInspector{margin-top:20px;padding-top:15px;border-top:1px solid #e1eaed}.ama-rr-modal-open{overflow:hidden!important}.ama-rr-dialog{position:fixed;inset:auto 0 0 0;margin:0 auto;box-sizing:border-box;width:min(680px,100%);max-width:100%;max-height:88dvh;height:auto;overflow-y:auto;overscroll-behavior:contain;border:1px solid #dce7eb;border-bottom:0;border-radius:23px 23px 0 0;padding:0 18px max(16px,env(safe-area-inset-bottom));background:#fff;color:#315667;box-shadow:0 -10px 60px #183b5530;z-index:10020}.ama-rr-dialog::backdrop{background:#18374670;backdrop-filter:blur(2px)}.ama-rr-dialog:not([open]){display:none!important}.ama-rr-sheet-handle{height:22px;display:flex;align-items:center;justify-content:center;touch-action:none}.ama-rr-sheet-handle span{display:block;width:36px;height:4px;background:#b7c8ce;border-radius:4px}.ama-rr-sheet-title h3{font-size:19px;margin:0}.ama-rr-sheet-title small{font-size:12px;color:#78909c}.ama-rr-sheet-title button{min-width:36px;min-height:36px;padding:8px!important;font-size:16px!important;background:#f1f6f7!important}.ama-rr-weeknav{display:flex;align-items:center;gap:8px;margin:15px 0 8px}.ama-rr-weeknav strong{text-align:center;flex:1;font-size:12px}.ama-rr-weeknav button{min-width:36px;min-height:36px;padding:5px!important;font-size:23px!important;background:#f0f6f7!important;color:#315c70!important}.ama-rr-weeksummary{font-size:11px;margin-bottom:12px;gap:6px}.ama-rr-weeksummary button{font-size:11px!important;min-height:32px!important;padding:6px 8px!important;background:#eaf4ef!important;color:#32705d!important}.ama-rr-weeksummary #amaRRWeekAlerts{color:#af4e4e}.ama-rr-dialog .ama-rr-day{text-transform:capitalize;font-size:12px;letter-spacing:.2px;background:#f3f7f8;margin:14px -18px 0;padding:9px 18px;color:#5a7480}.ama-rr-dialog .ama-rr-item{border:0;border-bottom:1px solid #e1eaed;border-radius:0;margin:0;padding:0 5px;background:white}.ama-rr-dialog .ama-rr-participation_cancelled{background:#fff4f3}.ama-rr-dialog .ama-rr-assigned:has(details[open]){background:#f3faf6}.ama-rr-dialog .ama-rr-expanded .primary{width:auto!important}.ama-rr-dialog .ama-rr-toolbar{margin:12px 0}.ama-rr-dialog .ama-rr-empty{padding:25px 0;color:#718792;font-size:13px;line-height:1.7}.ama-rr-dialog .ama-rr-note{margin-top:12px}.ama-rr-dialog #amaRRQueueFeedback:empty{display:none}.ama-rr-dialog #amaRRQueueFeedback{font-size:12px;line-height:1.6}.ama-rr-dialog .ama-rr-weeknav{scroll-margin-top:15px}@media(min-width:760px){.ama-rr-dialog{bottom:20px;max-height:85dvh;border-bottom:1px solid #dce7eb;border-radius:22px;padding-bottom:20px}}@media(prefers-reduced-motion:reduce){.ama-rr-setting input,.ama-rr-setting input:before{transition:none!important}}
</style>
<style>/* Planning compact administrateur ; les fiches intervenants gardent leur fonctionnement. */
#tab-planning.ama-plan-admin .ama-planning-filters{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:end}
#tab-planning.ama-plan-admin .ama-date-navigation{grid-column:1/-1;width:100%;min-width:0}
#tab-planning.ama-plan-admin .ama-planning-filters>.field{width:auto!important;max-width:none!important;min-width:0!important;margin:0}
#tab-planning.ama-plan-admin .ama-planning-filters select{width:100%;min-width:0;min-height:44px;height:44px;font-size:14px;padding:8px 10px}
.ama-plan-overview{font-size:13px;color:#7c929f;margin:12px 0 16px}
#missionList .ama-plan-card{display:block!important;position:relative;padding:0!important;margin:0 0 12px;overflow:visible;background:#fff;border:1px solid #dce8ed;border-radius:18px}
.ama-plan-detail>summary{display:block;list-style:none;cursor:pointer;padding:18px 52px 18px 16px;position:relative;min-height:78px}
.ama-plan-detail>summary::-webkit-details-marker,.ama-plan-menu>summary::-webkit-details-marker{display:none}
.ama-plan-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ama-plan-heading>strong{font-size:17px;line-height:1.3;overflow-wrap:anywhere}
.ama-plan-heading .badge{font-size:11px;white-space:normal;flex-shrink:0;max-width:105px}
.ama-plan-detail .ama-mission-meta{display:flex;gap:10px;flex-wrap:wrap;margin:9px 0 0!important;font-size:12px}
.ama-plan-detail>summary .ama-mission-meta>span:first-child{display:none}
.ama-plan-chevron{position:absolute;right:20px;bottom:14px;font-size:20px;color:#345e70}
.ama-plan-detail[open]>summary .ama-plan-chevron{transform:rotate(180deg)}
.ama-plan-note{display:inline-block;margin-top:9px;font-size:12px;color:#986e1e;background:#fff7e2;border-radius:7px;padding:3px 8px}
.ama-plan-expanded{padding:0 16px 16px;border-top:1px solid #edf2f4}
.ama-plan-expanded .ama-apt-modern{margin:12px 0!important;padding:13px!important;border-radius:14px}
.ama-plan-expanded .ama-apt-address p{font-size:14px!important;line-height:1.45}
.ama-plan-expanded .ama-map-button{padding:8px!important;min-height:36px;margin:10px 0!important;font-size:13px!important}
.ama-plan-expanded .ama-apt-facts{padding-top:10px!important;gap:10px}
.ama-plan-expanded .ama-apt-fact strong{font-size:15px!important}
.ama-plan-expanded .ama-apt-address small,.ama-plan-expanded .ama-apt-fact small{font-size:11px}
.ama-plan-expanded .ama-bill-summary{font-size:12px!important;margin:10px 0}
.ama-plan-expanded .mission-note{margin:12px 0;padding:10px;font-size:13px}
.ama-plan-expanded .ama-validate{width:100%;min-height:44px!important;font-size:14px!important;justify-content:center;margin-top:8px}
.ama-plan-menu{position:absolute;top:12px;right:9px;z-index:2}
.ama-plan-menu>summary{list-style:none;cursor:pointer;color:#668594;width:36px;height:36px;display:grid;place-items:center;font-size:25px;border-radius:9px}
.ama-plan-menu[open]>summary{background:#edf4f6}
.ama-plan-menu>div{position:absolute;right:0;top:38px;background:#fff;border:1px solid #dce8ed;border-radius:12px;padding:6px;box-shadow:0 8px 24px #27495920;min-width:140px}
.ama-plan-menu button{display:block;width:100%;min-height:42px;text-align:left;border:0;background:transparent;color:#345e70;padding:8px 12px;font-size:14px}
.ama-plan-menu button.danger{color:#b94250}
#amaRRInspector{padding:16px!important}
#amaRRInspector .ama-provider-dialog-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0}
#amaRRInspectorView{min-width:0;flex:1}
#amaRRInspector #amaRRInspectorSubtitle{color:#8197a4;font-size:14px}
.ama-stay-cleanup input[type=date]{appearance:none;-webkit-appearance:none;display:block;width:100%;min-width:0;box-sizing:border-box;min-height:44px;border:1px solid #dce8ed;border-radius:12px;background:#f7fafb;color:#345e70;padding:10px;font:inherit;margin:8px 0 14px}
.ama-stay-cleanup button{min-height:44px;border:1px solid #dce8ed;background:#eaf4f1;color:#337f70;border-radius:12px;padding:10px 16px;font:inherit;font-weight:600}
.ama-provider-dialog select{appearance:none;-webkit-appearance:none;min-height:44px;border:1px solid #dce8ed;border-radius:12px;background:#f7fafb;color:#345e70;padding:10px 28px 10px 12px;font:inherit;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='m1 1 5 5 5-5' fill='none' stroke='%23345e70' stroke-width='2'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
#amaRRInspector .ama-stay-card h4{margin:0 0 10px;font-size:17px}
#amaRRInspector .ama-stay-actions a{display:inline-block;color:#345e70;font-size:13px;margin-top:10px}
@media(max-width:700px){#tab-planning.ama-plan-admin .ama-date-navigation{grid-template-columns:34px minmax(0,1fr) 34px auto!important;gap:6px!important}#tab-planning.ama-plan-admin .ama-date-navigation>label{grid-column:1/-1}#tab-planning.ama-plan-admin .ama-date-navigation button{min-width:0!important;padding:8px!important;font-size:12px!important;min-height:44px!important;height:44px!important}#tab-planning.ama-plan-admin #planningDate{width:100%;min-width:0;font-size:14px;height:44px;min-height:44px;padding:6px}#tab-planning.ama-plan-admin .ama-date-input{min-width:0!important;width:auto!important}.ama-plan-heading{align-items:start}.ama-plan-heading>strong{font-size:16px}.ama-plan-heading .badge{font-size:10px;max-width:95px}#amaRRInspector .ama-provider-dialog-tools{flex-wrap:wrap}#amaRRInspectorView{width:100%;flex-basis:100%}}
</style>
</head><body><header><div class="heading"><span class="brand">AMA COMPANY</span><h1>RELEVÉ D’HEURES</h1></div><p class="report-meta">Intervenant : ${esc(workerName)} | ${esc(period)}</p></header><table><thead><tr><th>Date</th><th>Appartement</th><th>Heures</th></tr></thead><tbody>${body||'<tr><td colspan="3">Aucune intervention validée pour ce mois.</td></tr>'}</tbody></table><div class="total" data-count="${ms.length}" data-hours="${esc(hours(total))}"><span>TOTAL DU MOIS</span><span>${ms.length} intervention(s)</span><span>${esc(hours(total))}</span></div><p class="note">Interventions validées dans AMA Company</p>


<style id="ama-orbits-approved">
#amaWelcomeOverlay,#amaSessionLoading{background:#f3f8f8;color:#315a72;font-family:Arial,sans-serif}
#amaSessionLoading{position:fixed;inset:0;z-index:99998;min-height:100vh;min-height:100dvh;box-sizing:border-box}
#amaWelcomeOverlay .ama-welcome-stage,#amaSessionLoading .ama-welcome-stage{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;width:100%;max-width:350px;min-height:0;margin:auto;text-align:center}
#amaWelcomeOverlay .ama-welcome-stage[hidden]{display:none!important}
#amaWelcomeLoading .ama-welcome-symbol,#amaSessionLoading .ama-welcome-symbol{width:190px;height:190px;position:relative;display:grid;place-items:center;margin-bottom:26px}
.ama-orbit-ring.ama-welcome-arc{position:absolute;inset:0;border:2px solid transparent;border-top-color:#398b7b;border-right-color:#398b7b;border-radius:50%;transform:rotate(-30deg);transform-origin:center;box-sizing:border-box}
.ama-orbit-ring.ama-welcome-arc-b{inset:12px;border-color:transparent;border-bottom-color:#91c8ae;border-left-color:#91c8ae;transform:rotate(20deg)}
.ama-orbit-icon{width:102px;height:102px;object-fit:contain;border-radius:23px;position:relative;animation:amaOrbitIconArrive 1.2s cubic-bezier(.2,.8,.2,1) both}
.ama-orbit-title{font:700 24px/1.3 Arial,sans-serif;letter-spacing:-.4px;margin:0 0 12px;color:#315a72;animation:amaOrbitTextArrive .9s .15s both}
#amaWelcomeLoading .ama-welcome-subtitle,#amaSessionLoading .ama-welcome-subtitle{font:400 14px/1.6 Arial,sans-serif;color:#718995;margin:0;width:100%}
.ama-orbit-dots{display:flex;gap:6px;margin-top:25px;height:8px}
.ama-orbit-dots b{display:block;width:5px;height:5px;border-radius:50%;background:#398b7b;opacity:.4;animation:amaOrbitDotStep .7s 3 alternate}
.ama-orbit-dots b:nth-child(2){animation-delay:.16s}.ama-orbit-dots b:nth-child(3){animation-delay:.32s}
#amaWelcomeLoading .ama-welcome-arc-a.ama-run,#amaSessionLoading .ama-welcome-arc-a{animation:amaOrbitForward 2.4s cubic-bezier(.22,.65,.35,1) both}
#amaWelcomeLoading .ama-welcome-arc-b.ama-run,#amaSessionLoading .ama-welcome-arc-b{animation:amaOrbitBackward 2.4s cubic-bezier(.22,.65,.35,1) both}
#amaWelcomeSuccess{gap:16px!important}
#amaSessionLoading:has(#amaSessionRetry:not([hidden])) .ama-orbit-title,#amaSessionLoading:has(#amaSessionRetry:not([hidden])) .ama-orbit-dots{display:none}
@keyframes amaOrbitForward{from{transform:rotate(-130deg);opacity:.25}to{transform:rotate(330deg);opacity:1}}
@keyframes amaOrbitBackward{from{transform:rotate(170deg);opacity:.25}to{transform:rotate(-290deg);opacity:1}}
@keyframes amaOrbitIconArrive{from{transform:translateY(8px) scale(.93)}to{transform:translateY(0) scale(1)}}
@keyframes amaOrbitTextArrive{from{transform:translateY(9px);opacity:.4}to{transform:translateY(0);opacity:1}}
@keyframes amaOrbitDotStep{from{transform:translateY(0);opacity:.3}to{transform:translateY(-3px);opacity:1}}
@media(prefers-reduced-motion:reduce){#amaWelcomeOverlay *,#amaSessionLoading *{animation:none!important;transition:none!important}}
</style>
<style>.ama-cut-session{padding:8px 11px;border:1px solid #d5e3e7;border-radius:9px;background:#fff;color:#935047;font-size:12px;white-space:nowrap}.ama-cut-session:disabled{opacity:.55}</style></body></html>`;

 amaOpenPdf(html,`AMA_Releve_heures_${workerName}_${month}.pdf`,'hours');
}
function prepareHoursEmail(){
 if(!session||session.role!=='admin')return;
 const id=$('#reportWorker').value;if(!id)return alert('Sélectionnez un intervenant.');
 const worker=userById(id);if(!worker?.email)return alert('Ajoutez l’adresse e-mail de cet intervenant dans Supabase.');
 const month=$('#reportMonth').value||monthNow();
 const ms=reportRows();const total=ms.reduce((n,m)=>n+sharedHours(m),0);
 const lines=ms.map(m=>`${dateFr(m.date)} — ${m.apartmentName||'Logement'} : ${hours(m.hours)}`);
 const subject=`AMA Company — Relevé d’heures ${month}`;
 const body=`Bonjour ${worker.name},\n\nVoici votre relevé d’heures validées pour ${month} :\n\n${lines.join('\n')||'Aucune intervention validée.'}\n\nTotal : ${hours(total)} (${ms.length} interventions).\n\nCordialement,\nAMA Company`;
 window.location.href='mailto:'+encodeURIComponent(worker.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
$('#emailHoursReport').addEventListener('click',prepareHoursEmail);
$('#downloadHoursExcel').addEventListener('click',excelReport);
$('#downloadHoursPdf').addEventListener('click',pdfReport);
$('#reportMonth').addEventListener('change',reportTotal);
['Prev','Next'].forEach((direction,i)=>document.getElementById('amaReport'+direction).onclick=()=>{const field=$('#reportMonth'),d=new Date((field.value||monthNow())+'-01T12:00:00');d.setMonth(d.getMonth()+(i?1:-1));field.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');field.dispatchEvent(new Event('change',{bubbles:true}));});
$('#reportWorker').addEventListener('change',reportTotal);
$('#backBtn').addEventListener('click',amaGoBack);
$('#refreshBtn').addEventListener('click',async()=>{if(!session)return;const b=$('#refreshBtn');b.disabled=true;try{await reload();render()}catch(e){alert('Actualisation impossible : '+e.message)}finally{b.disabled=false}});
document.getElementById('amaLoginEye').addEventListener('click',()=>{const input=document.getElementById('loginPin'),button=document.getElementById('amaLoginEye'),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Masquer le mot de passe':'Afficher le mot de passe');});
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();login()});$('#logoutBtn').addEventListener('click',logout);
document.querySelector('#tab-dashboard').addEventListener('click',e=>{
 const next=e.target.closest('#amaNextMission');
 if(next&&session?.role==='worker'&&next.dataset.nextMissionId){
  const m=data.missions.find(x=>x.id===next.dataset.nextMissionId);
  if(m){amaOpenPhotoMission(m);return;}
 }
 if(e.target.closest('[data-jump]'))setTab('planning');
});
document.getElementById('amaNextMission').addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&session?.role==='worker'){
  const m=data.missions.find(x=>x.id===e.currentTarget.dataset.nextMissionId);
  if(m){e.preventDefault();amaOpenPhotoMission(m);}
 }
});
function invoiceRows(clientId,month){
 return data.missions.filter(m=>['done','not_entered'].includes(m.status)&&!m.prolonged&&String(m.date).startsWith(month)).map(m=>{
  const apt=data.apartments.find(a=>a.id===m.apartmentId);
  return apt?.clientId===clientId?{m,apt,finance:missionFinances.get(m.id)}:null;
 }).filter(Boolean).sort((a,b)=>a.m.date.localeCompare(b.m.date));
}
function renderInvoiceSummary(){amaRenderInvoiceSummary();}
let amaInvoiceLogoData='',amaInvoiceLogoLoading=false,amaLogoRequest=0;
function amaSetInvoiceLogo(value){
 amaLogoRequest++;
 amaInvoiceLogoLoading=false;
 amaInvoiceLogoData=typeof value==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=350000?value:'';
 $('#invoiceLogoData').value=amaInvoiceLogoData;
 $('#invoiceLogo').value='';
 const preview=$('#invoiceLogoPreview');
 if(amaInvoiceLogoData)preview.src=amaInvoiceLogoData;else preview.removeAttribute('src');
 preview.style.display=amaInvoiceLogoData?'block':'none';
 $('#invoiceLogoRemove').hidden=!amaInvoiceLogoData;
}
$('#invoiceLogoRemove').onclick=()=>amaSetInvoiceLogo('');
$('#invoiceLogo').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5000000){alert('Choisissez une image PNG, JPEG ou WebP de moins de 5 Mo.');e.target.value='';return;}
 const request=++amaLogoRequest,owner=session?.id,company=amaInvoiceCompany;
 amaInvoiceLogoLoading=true;let url='';
 try{
  url=URL.createObjectURL(file);
  const img=new Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw Error('Image illisible.');
  const scale=Math.min(1,600/img.naturalWidth,240/img.naturalHeight);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Conversion du logo indisponible.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const png=canvas.toDataURL('image/png');
  if(png.length>350000)throw Error('Logo trop détaillé. Choisissez une image plus simple.');
  if(request!==amaLogoRequest||owner!==session?.id||company!==amaInvoiceCompany)return;
  amaSetInvoiceLogo(png);
 }catch(error){if(request===amaLogoRequest)alert(error.message||'Impossible de charger le logo.');}
 finally{if(url)URL.revokeObjectURL(url);if(request===amaLogoRequest)amaInvoiceLogoLoading=false;}
});
function printClientInvoice(clientId){
 if(!session||session.role!=='admin')return;
 const c=orderClients.find(x=>x.id===clientId),month=$('#invoiceMonth').value||monthNow(),rows=invoiceRows(clientId,month);
 if(!c||!rows.length)return alert('Aucune prestation facturable pour ce client.');
 if(rows.some(r=>!r.finance||r.finance.revenue===null||r.finance.revenue===undefined))return alert('Renseignez tous les montants des missions dans la partie Finances avant de générer la facture.');
 const number=$('#invoiceNumber').value.trim(),issuer=$('#invoiceIssuer').value.trim(),siret=$('#invoiceSiret').value.trim(),address=$('#invoiceIssuerAddress').value.trim(),due=$('#invoiceDueDate').value,payment=$('#invoicePayment').value.trim();
 const issuerEmail=$('#invoiceIssuerEmail').value.trim(),issuerPhone=$('#invoiceIssuerPhone').value.trim();
 const iban=$('#invoiceIban').value.replace(/\s/g,'').toUpperCase(),bic=$('#invoiceBic').value.replace(/\s/g,'').toUpperCase();
 const paid=Number($('#invoicePaid').value||0);
 if(!number||!issuer||!/^[0-9]{14}$/.test(siret)||!address||!due)return alert('Complétez le numéro, le nom, le SIRET (14 chiffres), l’adresse de l’entreprise et la date limite de paiement.');
 if(!Number.isFinite(paid)||paid<0)return alert('Le montant payé doit être positif.');
 if(!c.billing_address)return alert('Renseignez d’abord l’adresse de facturation de ce client dans Administration.');
 const total=rows.reduce((n,r)=>n+Number(r.finance.revenue),0);
 if(paid>total)return alert('Le montant déjà payé ne peut pas dépasser le total.');
 const fmt=n=>Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const apartmentGroups=new Map();
  for(const r of rows){
    const key=r.apt.id||r.apt.name;
    if(!apartmentGroups.has(key))apartmentGroups.set(key,{name:r.apt.name,items:[],total:0});
    const g=apartmentGroups.get(key);g.items.push(r);g.total+=Number(r.finance.revenue);
  }
  const detail=[...apartmentGroups.values()].map(g=>{
    const dates=g.items.map(r=>(r.m.status==='not_entered'?'Non entrés : ':'')+dateFr(r.m.date)).join(' · ');
    const avg=g.total/g.items.length;
    const uniform=g.items.every(r=>Math.abs(Number(r.finance.revenue)-avg)<.005);
    return `<tr><td><b>${esc(g.name)}</b><div class="detail">${g.items.some(r=>r.m.status==='not_entered')?'Prestations et signalements non entrés':'Prestations de nettoyage'}</div><div class="detail">Dates : ${esc(dates)}</div><div class="detail">Heures facturables : ${esc(hours(g.items.reduce((n,r)=>n+Number(r.finance.reference_hours||0),0)))}</div></td><td class="num">${g.items.length}</td><td class="num">${uniform?esc(fmt(avg))+' €':'Variable'}</td><td class="num"><b>${esc(fmt(g.total))} €</b></td></tr>`;
  }).join('');
 const invoiceDate=dateFr(today());
 const logo=amaInvoiceLogoData&&/^data:image\/(png|jpeg|webp);base64,/.test(amaInvoiceLogoData)?`<img class="logo" alt="Logo de l’entreprise" src="${amaInvoiceLogoData}">`:'';
 const snapshot={issuer:Object.fromEntries(amaIssuerIds.map(id=>[id,$('#'+id).value.trim()])),client:{name:c.name,address:c.billing_address,siret:c.siret||''},number,period:month+'-01',date:today(),due,rows:rows.map(r=>({apartment:r.apt.name,date:r.m.date,hours:Number(r.finance.reference_hours||0),cents:Math.round(Number(r.finance.revenue)*100),status:r.m.status})),total_cents:rows.reduce((sum,r)=>sum+Math.round(Number(r.finance.revenue)*100),0),paid_cents:Math.round(paid*100)};
 const html=amaFinalInvoiceHtml(snapshot);
 amaOpenPdf(html,`${amaInvoiceCompany==='ldclean'?'LD_Clean':'AMA'}_Facture_${number}_${c.name}.pdf`,'invoice');amaPdfState.invoice={clientId,month,number,companyId:amaInvoiceCompany,snapshot};
}
$('#invoiceSummary').addEventListener('click',e=>{const b=e.target.closest('[data-invoice-client]');if(b)amaPrepareInvoice(b.dataset.invoiceClient)});
$('#invoiceMonth').value=monthNow();
$('#invoiceMonth').addEventListener('change',renderInvoiceSummary);
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)});
$('#planningDate').value=today();$('#missionDate').value=today();$('#historyMonth').value=monthNow();
function amaShiftPlanningDate(days){
 const input=$('#planningDate');const current=input.value||today();
 const d=new Date(current+'T12:00:00');if(Number.isNaN(d.getTime()))return;
 d.setDate(d.getDate()+days);input.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');renderPlanning();
}
$('#amaPreviousDay').addEventListener('click',()=>amaShiftPlanningDate(-1));
$('#amaNextDay').addEventListener('click',()=>amaShiftPlanningDate(1));
$('#amaToday').addEventListener('click',()=>{$('#planningDate').value=today();renderPlanning()});
$('#planningDate').addEventListener('change',renderPlanning);$('#planningWorkerFilter').addEventListener('change',renderPlanning);$('#historyBody').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-history-delete]');
 if(!btn||!session||session.role!=='admin')return;
 const mission=data.missions.find(m=>m.id===btn.dataset.historyDelete);
 if(!mission)return alert('Intervention introuvable. Actualisez la page.');
 if(!confirm(`SUPPRESSION DÉFINITIVE\n\n${mission.apartmentName||'Logement'} — ${dateFr(mission.date)}\n${mission.workerName||'Intervenant'}\n\nCette suppression retire également les heures et le chiffre d’affaires associés. Confirmer ?`))return;
 btn.disabled=true;
 try{
  const r=await client.rpc('admin_delete_mission',{p_mission_id:mission.id});
  if(r.error)throw r.error;
  await reload();render();
 }catch(err){alert('Suppression refusée : '+err.message);btn.disabled=false;}
});
$('#historyMonth').addEventListener('change',renderHistory);$('#historyWorker').addEventListener('change',renderHistory);
$('#amaHistoryPrev').onclick=()=>{amaHistoryPage--;renderHistory()};$('#amaHistoryNext').onclick=()=>{amaHistoryPage++;renderHistory()};
$('#missionApartment').addEventListener('change',()=>{const a=data.apartments.find(a=>a.id===$('#missionApartment').value);if(!a)return;const f=apartmentFinances.get(a.id);$('#missionHours').value=a.duration;$('#missionBillHours').value=$('#missionCopyBilling').checked?a.duration:(f?.reference_hours??a.duration);$('#missionBillRate').value=f?.hourly_rate??0;});
$('#missionHours').addEventListener('input',()=>{if($('#missionCopyBilling').checked)$('#missionBillHours').value=$('#missionHours').value});
$('#missionCopyBilling').onchange=()=>{if($('#missionCopyBilling').checked)$('#missionBillHours').value=$('#missionHours').value};
$('#missionForm').addEventListener('submit',async e=>{e.preventDefault();if(session?.role!=='admin')return;
 const u=userById($('#missionWorker').value),a=data.apartments.find(a=>a.id===$('#missionApartment').value);
 if(!u||!a)return alert('Choisissez un intervenant et un logement.');
 if(!amaBillingConfigured)return alert('Installez AMA_Facturation_Missions.sql dans Supabase pour enregistrer les heures facturables.');
 const button=$('#missionForm').querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
 try{await amaV8Guard(a.id,$('#missionDate').value);if(!await amaV6CheckWorkload(u.id,$('#missionDate').value,Number($('#missionHours').value)))return;await amaSaveBilling({id:uid(),hours:Number($('#missionHours').value),bill:Number($('#missionBillHours').value),rate:Number($('#missionBillRate').value),date:$('#missionDate').value,notes:$('#missionNotes').value,create:true,apartment:a.id,worker:u.id,status:'planned'});$('#missionNotes').value='';await reload();render();document.getElementById('amaMissionDialog')?.close();}
 catch(error){alert('Enregistrement refusé : '+error.message)}finally{button.disabled=false}
});
let amaPhotoReturnState=null;
let amaCurrentPhotoMission=null,amaSelectedPhotoFiles=[],amaPhotoUrls=[],amaCameraShots=0;
function amaPhotoWhatsAppText(m){const logement=String(m.apartmentName||"Logement").replace(/\*/g,"");return "*"+logement+"*\nIntervention terminée ✓\nIntervenant(e) : "+(session?.name||m.workerName||"Intervenant")+"\nDate : "+dateFr(m.date);}
function amaPhotoMessage(t){document.getElementById('amaPhotoFeedback').textContent=t;}
function amaPhotoClear(){amaPhotoUrls.forEach(u=>URL.revokeObjectURL(u));amaPhotoUrls=[];amaSelectedPhotoFiles=[];amaCameraShots=0;document.getElementById('amaPhotoFiles').value='';document.getElementById('amaPhotoCamera').value='';amaPhotoRender();}
function amaPhotoRender(){
 const grid=document.getElementById('amaPhotoPreview');grid.innerHTML='';
 amaPhotoUrls.forEach((url,i)=>{const d=document.createElement('div');d.className='ama-photo-tile';const img=document.createElement('img');img.src=url;img.alt='Photo sélectionnée '+(i+1);d.appendChild(img);const remove=document.createElement('button');remove.type='button';remove.className='ama-photo-remove';remove.textContent='×';remove.setAttribute('aria-label','Supprimer la photo '+(i+1));remove.addEventListener('click',()=>amaRemovePhoto(i));d.appendChild(remove);grid.appendChild(d)});
 document.getElementById('amaPhotoCount').textContent=amaSelectedPhotoFiles.length+' photo'+(amaSelectedPhotoFiles.length>1?'s':'')+' sélectionnée'+(amaSelectedPhotoFiles.length>1?'s':'')+' · caméra : 30 photos par session';
 document.getElementById('amaPhotoFinish').disabled=!amaSelectedPhotoFiles.length;document.getElementById('amaPhotoFinish').textContent='✓ Terminer et partager';document.getElementById('amaPhotoWhatsAppNote').hidden=!amaSelectedPhotoFiles.length;
}
function amaRefreshPhotoUrls(){amaPhotoUrls.forEach(u=>URL.revokeObjectURL(u));amaPhotoUrls=amaSelectedPhotoFiles.map(f=>URL.createObjectURL(f));amaPhotoRender();}
function amaRemovePhoto(i){if(i<0||i>=amaSelectedPhotoFiles.length)return;amaSelectedPhotoFiles.splice(i,1);amaRefreshPhotoUrls();amaPhotoMessage('Photo supprimée.');}

function amaOpenPhotoMission(m){
 if(!session||session.role!=='worker'||!sharedIds(m).includes(session.id)||m.status!=='planned'||m.prolonged)return;
 amaPhotoReturnState=amaCaptureView();amaCurrentPhotoMission=m.id;amaPhotoClear();amaPhotoMessage('');document.getElementById('amaPhotoConfirm').hidden=true;
 document.getElementById('amaPhotoApartment').textContent=m.apartmentName||'Logement';document.getElementById('amaPhotoDate').textContent=dateFr(m.date);document.getElementById('amaPhotoHours').textContent=hours(sharedHours(m));
 document.getElementById('amaPhotoApartmentInfo').innerHTML=apartmentInfo(m);
 document.getElementById('amaPhotoNotes').innerHTML=m.notes?'<div class="mission-note"><strong>Consignes de ménage</strong><div class="note-body">'+esc(m.notes)+'</div></div>':'';
 document.getElementById('amaPhotoModal').hidden=false;
}
function amaClosePhotoMission(){amaStopLiveCamera();document.getElementById('amaPhotoModal').hidden=true;amaCurrentPhotoMission=null;amaPhotoClear();if(amaPhotoReturnState){amaRestoreScroll(amaPhotoReturnState);amaPhotoReturnState=null}}
document.getElementById('amaPhotoClose').addEventListener('click',amaClosePhotoMission);
document.getElementById('amaPhotoChoose').addEventListener('click',()=>document.getElementById('amaPhotoFiles').click());
let amaLiveStream=null,amaLiveShots=0,amaLiveBusy=false;
async function amaStartLiveCamera(){
 const panel=document.getElementById('amaLiveCamera'),video=document.getElementById('amaLiveVideo');
 amaLiveShots=0;amaLiveBusy=false;document.getElementById('amaLiveFeedback').textContent='';document.getElementById('amaLiveCounter').textContent='0 / 30 photos';
 if(!navigator.mediaDevices?.getUserMedia){amaPhotoMessage('Caméra intégrée non disponible. Utilisez la galerie ou la caméra classique.');document.getElementById('amaPhotoCamera').click();return;}
 panel.hidden=false;
 try{amaLiveStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}}});video.srcObject=amaLiveStream;await video.play();}
 catch(e){amaStopLiveCamera();amaPhotoMessage('Impossible d’ouvrir la caméra intégrée. Autorisez la caméra dans Safari ou utilisez la galerie.');}
}
function amaStopLiveCamera(){const panel=document.getElementById('amaLiveCamera');if(panel)panel.hidden=true;if(amaLiveStream){amaLiveStream.getTracks().forEach(t=>t.stop());amaLiveStream=null;}const video=document.getElementById('amaLiveVideo');if(video){video.pause();video.srcObject=null;}}
async function amaShootLivePhoto(){
 if(amaLiveBusy||amaLiveShots>=30||!amaLiveStream)return;
 const video=document.getElementById('amaLiveVideo');if(!video.videoWidth){document.getElementById('amaLiveFeedback').textContent='Caméra en cours de démarrage…';return;}
 amaLiveBusy=true;const shoot=document.getElementById('amaLiveShoot');shoot.disabled=true;
 try{const canvas=document.createElement('canvas');const ratio=Math.min(1,3200/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Photo non disponible');
 const f=new File([blob],'ama-menage-'+Date.now()+'-'+(amaLiveShots+1)+'.jpg',{type:'image/jpeg'});amaSelectedPhotoFiles.push(f);amaLiveShots++;amaCameraShots++;amaRefreshPhotoUrls();document.getElementById('amaLiveCounter').textContent=amaLiveShots+' / 30 photos';document.getElementById('amaLiveFeedback').textContent=amaLiveShots===30?'30 photos prises. Appuyez sur Terminer.':'Photo '+amaLiveShots+' ajoutée ✓';
 }catch(e){document.getElementById('amaLiveFeedback').textContent='Impossible de prendre la photo : '+e.message;}
 finally{amaLiveBusy=false;shoot.disabled=amaLiveShots>=30;}
}
document.getElementById('amaPhotoCameraBtn').addEventListener('click',amaStartLiveCamera);
document.getElementById('amaLiveShoot').addEventListener('click',amaShootLivePhoto);
document.getElementById('amaLiveClose').addEventListener('click',amaStopLiveCamera);
document.getElementById('amaLiveDone').addEventListener('click',amaStopLiveCamera);
function amaAddPhotoFiles(input,isCamera){
 const files=Array.from(input.files||[]).filter(f=>f.type.startsWith('image/'));
 input.value='';
 if(!files.length)return;
 if(files.some(f=>f.size>20*1024*1024)){amaPhotoMessage('Chaque photo doit faire moins de 20 Mo.');return;}
 if(isCamera&&files.length>30){amaPhotoMessage('Maximum 30 photos par session.');return;}
 if(isCamera)amaCameraShots+=files.length;
 amaSelectedPhotoFiles.push(...files);
 amaRefreshPhotoUrls();amaPhotoMessage('');
}
document.getElementById('amaPhotoFiles').addEventListener('change',e=>amaAddPhotoFiles(e.target,false));
document.getElementById('amaPhotoCamera').addEventListener('change',e=>amaAddPhotoFiles(e.target,true));
document.getElementById('amaPhotoCopyText').addEventListener('click',async()=>{
 const m=amaPhotoValidMission();if(!m)return;
 const value=amaPhotoWhatsAppText(m);
 try{await navigator.clipboard.writeText(value);amaPhotoMessage('Message copié. Collez-le dans votre groupe WhatsApp après les photos.');}
 catch(err){window.prompt('Copiez ce message pour WhatsApp :',value);}
});
async function amaPhotoComplete(m){
 const btn=document.getElementById('amaPhotoFinish');btn.disabled=true;
 try{
  amaPhotoMessage('Enregistrement de la mission…');
  if(sharedIds(m).length>1){const r=await client.rpc('ama_complete_shared_mission',{p_mission_id:m.id});if(r.error)throw r.error;await reload();}
  else{const r=await client.from('missions').update({status:'done'}).eq('id',m.id).eq('status','planned').select('id');if(r.error)throw r.error;if(!r.data?.length)throw Error('Mission non mise à jour : vérifiez vos autorisations.');await reload();}
  amaClosePhotoMission();render();
 }catch(err){amaPhotoMessage('Impossible de terminer : '+(err?.message||'Erreur inconnue'));}
 finally{btn.disabled=false;}
}
function amaPhotoValidMission(){
 const m=data.missions.find(x=>x.id===amaCurrentPhotoMission);
 if(!m||!session||session.role!=='worker'||!sharedIds(m).includes(session.id)||m.status!=='planned'||m.prolonged){amaPhotoMessage('Cette mission ne peut plus être validée.');return null;}
 return m;
}
document.getElementById('amaPhotoFinish').addEventListener('click',async()=>{
 const m=amaPhotoValidMission();if(!m)return;
 if(!amaSelectedPhotoFiles.length){amaPhotoMessage('Ajoutez au moins une photo pour terminer cette mission.');return;}
 if(!navigator.share||!navigator.canShare||!navigator.canShare({files:amaSelectedPhotoFiles}))return amaPhotoMessage('Ce navigateur ne peut pas partager cette sélection de photos. Essayez un lot plus petit. Vous pouvez aussi copier le message WhatsApp.');
 const btn=document.getElementById('amaPhotoFinish');btn.disabled=true;
 try{
  await navigator.share({files:amaSelectedPhotoFiles,text:amaPhotoWhatsAppText(m)});
  if(!confirm('Avez-vous bien envoyé les photos dans le groupe WhatsApp ?\n\nConfirmer pour valider la mission dans AMA Planning.')){amaPhotoMessage('Mission non validée. Vous pouvez réessayer le partage.');return;}
  await amaPhotoComplete(m);
 }catch(err){if(err?.name==='AbortError')amaPhotoMessage('Partage annulé. La mission n’a pas été validée.');else amaPhotoMessage('Partage impossible : '+(err?.message||'Erreur inconnue'));}
 finally{btn.disabled=false;}
});
document.getElementById('amaPhotoConfirmYes').addEventListener('click',()=>{amaPhotoMessage('Ajoutez au moins une photo et partagez-la avant la validation.');document.getElementById('amaPhotoConfirm').hidden=true;});
document.getElementById('amaPhotoConfirmNo').addEventListener('click',()=>{document.getElementById('amaPhotoConfirm').hidden=true;});
document.getElementById('missionList').addEventListener('click',e=>{
 if(e.target.closest('button, a, input, select'))return;
 const card=e.target.closest('[data-open-mission]');if(!card||session?.role!=='worker')return;
 const m=data.missions.find(x=>x.id===card.dataset.openMission);
 if(m&&sharedIds(m).includes(session.id))amaOpenPhotoMission(m);
});
document.getElementById('missionList').addEventListener('keydown',e=>{
 if(e.key!=='Enter'&&e.key!==' ')return;
 const card=e.target.closest('[data-open-mission]');if(!card||e.target!==card||session?.role!=='worker')return;
 const m=data.missions.find(x=>x.id===card.dataset.openMission);
 if(m&&sharedIds(m).includes(session.id)){e.preventDefault();amaOpenPhotoMission(m);}
});
$('#missionList').addEventListener('click',async e=>{
 const reply=e.target.closest('[data-fusion-reply]');
 if(reply){if(!confirm(reply.dataset.fusionReply==='yes'?'Accepter et partager les heures de cette mission ?':'Refuser cette invitation ?'))return;
  const r=await client.rpc('ama_respond_fusion',{p_invite_id:reply.dataset.id,p_accept:reply.dataset.fusionReply==='yes'});
  if(r.error)return alert('Réponse impossible : '+r.error.message);
  await reload();render();return;
 }
 const b=e.target.closest('[data-action]');if(!b)return;const m=data.missions.find(x=>x.id===b.dataset.id);if(!m)return;
 if(b.dataset.action==='non-entry'&&session.role==='worker'&&m.workerId===session.id&&m.status==='planned'&&!m.prolonged){
  const comment=prompt('Voyageurs non entrés — commentaire à enregistrer dans l’historique :','Les voyageurs ne sont pas entrés dans le logement.');
  if(comment===null)return;
  if(!comment.trim())return alert('Un commentaire est obligatoire.');
  if(!confirm(`Signaler « Voyageurs non entrés » pour ${m.apartmentName} ?\n0 h pour l’intervenant ; heures facturables conservées pour l’administrateur.`))return;
  const r=await client.rpc('ama_report_non_entry',{p_mission_id:m.id,p_comment:comment.trim()});
  if(r.error)return alert('Signalement refusé : '+r.error.message+'\nVérifiez que la migration SQL a bien été appliquée.');
  await reload();render();return;
 }
 if(b.dataset.action==='reschedule'&&session.role==='worker'&&m.workerId===session.id&&m.status==='planned'&&!m.prolonged){
  const next=prompt('Nouvelle date de l’intervention (AAAA-MM-JJ) :',m.date);
  if(next===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(next)||Number.isNaN(new Date(next+'T12:00:00').getTime())||new Date(next+'T12:00:00').toISOString().slice(0,10)!==next)return alert('Date invalide. Format attendu : AAAA-MM-JJ.');
  if(next===m.date)return;
  if(!confirm(`Reporter « ${m.apartmentName} » du ${dateFr(m.date)} au ${dateFr(next)} ?`))return;
  const r=await client.rpc('worker_reschedule_mission',{p_mission_id:m.id,p_new_date:next});
  if(r.error)return alert('Report refusé : '+r.error.message);
  await reload();render();return;
 }
 if(b.dataset.action==='prolong'&&session.role==='worker'&&m.workerId===session.id&&m.status==='planned'){
  const target=!m.prolonged;
  if(!confirm(target?'Signaler que le voyageur a prolongé son séjour ? La mission ne sera pas comptabilisée.':'Annuler le signalement de prolongation ?'))return;
  const r=await client.rpc('worker_manage_mission',{p_mission_id:m.id,p_action:target?'prolong':'unprolong',p_new_worker:null});
  if(r.error)return alert('Action refusée : '+r.error.message);
  await reload();render();return;
 }
 if(b.dataset.action==='fusion'&&session.role==='worker'&&m.workerId===session.id&&m.status==='planned'&&!m.prolonged){
  const ids=sharedIds(m),invited=fusionInvites.filter(i=>i.mission_id===m.id&&i.status==='pending').map(i=>i.invitee_id);
  const colleagues=activeWorkers().filter(u=>!ids.includes(u.id)&&!invited.includes(u.id));
  if(!colleagues.length)return alert('Aucun collègue disponible pour une nouvelle invitation.');
  const answer=prompt('Inviter quel collègue à partager cette mission ?\n'+colleagues.map((u,i)=>`${i+1}. ${u.name}`).join('\n')+'\n\nSaisir le numéro :');
  if(answer===null)return;const target=colleagues[Number(answer)-1];if(!target)return alert('Choix invalide.');
  if(!confirm(`Inviter ${target.name} ? Les heures ne seront partagées qu’après son acceptation.`))return;
  const r=await client.rpc('ama_invite_fusion',{p_mission_id:m.id,p_invitee_id:target.id});
  if(r.error)return alert('Invitation refusée : '+r.error.message);
  await reload();render();alert('Invitation envoyée à '+target.name);return;
 }
 if(b.dataset.action==='transfer'&&session.role==='worker'&&m.workerId===session.id&&m.status==='planned'&&!m.prolonged){
  const colleagues=activeWorkers().filter(u=>u.id!==session.id);
  if(!colleagues.length)return alert('Aucun autre intervenant actif.');
  const answer=prompt('À quel intervenant transmettre la mission ?\n'+colleagues.map((u,i)=>`${i+1}. ${u.name}`).join('\n')+'\n\nSaisir le numéro :');
  if(answer===null)return;
  const idx=Number(answer)-1,target=colleagues[idx];
  if(!Number.isInteger(idx)||!target)return alert('Choix invalide.');
  if(!confirm(`Transférer la mission ${m.apartmentName} à ${target.name} ?`))return;
  const r=await client.rpc('worker_manage_mission',{p_mission_id:m.id,p_action:'transfer',p_new_worker:target.id});
  if(r.error)return alert('Transfert refusé : '+r.error.message);
  await reload();render();return;
 }
 if(b.dataset.action==='details'&&session.role==='worker'&&sharedIds(m).includes(session.id)){amaOpenPhotoMission(m);return;}
 if(b.dataset.action==='complete'&&m.status==='planned'&&!m.prolonged&&(session.role==='admin'||sharedIds(m).includes(session.id))){
  if(!confirm(`Confirmer que la mission « ${m.apartmentName} » est terminée ?`))return;
  if(sharedIds(m).length>1){const r=await client.rpc('ama_complete_shared_mission',{p_mission_id:m.id});if(r.error)return alert('Validation refusée : '+r.error.message);await reload();render();return;}
  m.status='done';m.completedAt=new Date().toISOString();m.completedBy=session.name;save();render();
 }
 if(b.dataset.action==='delete'&&session.role==='admin'&&confirm('Supprimer définitivement cette mission ?')){data.missions=data.missions.filter(x=>x.id!==m.id);save();render()}
 if(b.dataset.action==='edit'&&session.role==='admin')amaOpenBillingEditor(m);
});
$('#workerForm').addEventListener('submit',e=>{e.preventDefault();alert('Pour créer un intervenant : Supabase → Authentication → Users → Add user, puis ajouter son UID dans public.profiles (full_name, role=intervenant, email). Ne stockez jamais de mot de passe dans cette application.');});
$('#apartmentForm').addEventListener('submit',async e=>{
 e.preventDefault();if(session.role!=='admin'||busy)return;
 const id=$('#apartmentEditId').value,name=$('#apartmentName').value.trim(),duration=Number($('#apartmentDuration').value);
 const referenceHours=Number($('#apartmentReferenceHours').value),hourlyRate=Number($('#apartmentHourlyRate').value);
 const address=$('#apartmentAddress').value.trim(),access=$('#apartmentAccess').value.trim(),beds=Number($('#apartmentBeds').value);
 if(!name||![duration,referenceHours,hourlyRate,beds].every(Number.isFinite)||duration<0||referenceHours<0||hourlyRate<0||beds<0||!Number.isInteger(beds))return alert('Vérifiez les durées, le tarif, le nom et le nombre de couchages.');
 if(data.apartments.some(a=>a.id!==id&&a.name.toLowerCase()===name.toLowerCase()&&a.active!==false))return alert('Ce logement existe déjà.');
 const apartmentId=id||uid();
 try{
  const payload={id:apartmentId,name,address,access_code:access,beds,duration,client_id:$('#apartmentClient').value||null,active:true};
  const r=id?await client.from('apartments').update(payload).eq('id',id):await client.from('apartments').insert(payload);
  if(r.error)throw r.error;
  const f=await client.from('apartment_finances').upsert({apartment_id:apartmentId,reference_hours:referenceHours,hourly_rate:hourlyRate},{onConflict:'apartment_id'});
  if(f.error)throw f.error;
  await reload();clearApartmentEditor();render();alert('Logement et paramètres financiers enregistrés.');
 }catch(err){alert('Enregistrement refusé : '+err.message);try{await reload();render()}catch(e){console.error(e)}}
});
function clearClientEditor(){
 amaDiscardFormReturn('clientForm');
 document.getElementById('clientForm').hidden=true;document.querySelector('[data-manage-add="clientForm"]')?.setAttribute('aria-expanded','false');
 $('#clientForm').reset();$('#clientEditId').value='';
 $('#clientSaveBtn').textContent='＋ Ajouter le donneur d’ordre';$('#clientCancelBtn').classList.add('hidden');
}
$('#clientCancelBtn').addEventListener('click',clearClientEditor);
$('#clientList').addEventListener('click',e=>{
 const btn=e.target.closest('[data-client-edit]');if(!btn||session.role!=='admin')return;
 const c=orderClients.find(x=>x.id===btn.dataset.clientEdit);if(!c)return;
 $('#clientEditId').value=c.id;$('#clientName').value=c.name||'';
 $('#clientAddress').value=c.billing_address||'';$('#clientEmail').value=c.email||'';
 $('#clientPhone').value=c.phone||'';$('#clientSiret').value=c.siret||'';
 $('#clientSaveBtn').textContent='✓ Enregistrer les modifications';$('#clientCancelBtn').classList.remove('hidden');
 $('#clientForm').scrollIntoView({behavior:'smooth',block:'center'});
});
$('#clientForm').addEventListener('submit',async e=>{
 e.preventDefault();if(session.role!=='admin')return;
 const id=$('#clientEditId').value;
 const payload={name:$('#clientName').value.trim(),billing_address:$('#clientAddress').value.trim(),
 email:$('#clientEmail').value.trim()||null,phone:$('#clientPhone').value.trim()||null,siret:$('#clientSiret').value.replace(/\s/g,'')||null};
 if(!payload.name)return alert('Nom du donneur d’ordre obligatoire.');
 if(payload.siret&&!/^[0-9]{14}$/.test(payload.siret))return alert('Le SIRET doit contenir 14 chiffres.');
 const r=id?await client.from('order_clients').update(payload).eq('id',id):await client.from('order_clients').insert(payload);
 if(r.error)return alert('Enregistrement refusé : '+r.error.message);
 await reload();clearClientEditor();render();alert('Donneur d’ordre enregistré.');
});
$('#apartmentCancelBtn').addEventListener('click',clearApartmentEditor);
$('#tab-admin').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const u=userById(b.dataset.id),a=data.apartments.find(x=>x.id===b.dataset.id);
 if(b.dataset.action==='pin'&&u){alert('Le mot de passe se modifie via le lien « Mot de passe oublié ? » ou dans Supabase Authentication.');}
 if(b.dataset.action==='worker-delete'&&u&&confirm(`Désactiver le compte de ${u.name} ? Son historique sera conservé.`)){u.active=false;save();render()}
 if(b.dataset.action==='apt-edit'&&a&&session.role==='admin'){
   $('#apartmentEditId').value=a.id;$('#apartmentName').value=a.name||'';$('#apartmentDuration').value=a.duration??1;$('#apartmentReferenceHours').value=apartmentFinances.get(a.id)?.reference_hours??a.duration??0;$('#apartmentHourlyRate').value=apartmentFinances.get(a.id)?.hourly_rate??0;
 $('#apartmentClient').value=a.clientId||'';$('#apartmentAddress').value=a.address||'';$('#apartmentAccess').value=a.access||'';$('#apartmentBeds').value=a.beds||0;
 $('#apartmentSaveBtn').textContent='✓ Enregistrer les modifications';$('#apartmentCancelBtn').classList.remove('hidden');
 $('#apartmentForm').scrollIntoView({behavior:'smooth',block:'center'});$('#apartmentName').focus();
 }
 if(b.dataset.action==='apt-delete'&&a&&confirm(`Désactiver le logement ${a.name} ? Les missions passées seront conservées.`)){a.active=false;save();render()}
});
// Fiche intervenant : accès réservé à l'administrateur connecté.
(function(){
 const list=document.getElementById('workerList'),panel=document.getElementById('amaWorkerEditor');
 if(!list||!panel)return;
 const by=id=>document.getElementById(id);
 let returnState=null;const close=()=>{panel.hidden=true;by('amaWorkerEditStatus').textContent='';if(returnState){amaRestoreScroll(returnState);returnState=null}};
 async function open(id){
   if(!session||session.role!=='admin')return;
   const u=userById(id);if(!u||u.role!=='worker')return;
   returnState=amaCaptureView();by('amaWorkerEditId').value=id;
   by('amaWorkerEditName').value=u.name||'';
   by('amaWorkerEditPhone').value='';
   by('amaWorkerEditEmail').value=u.email||'';
   by('amaWorkerEditStatus').textContent='Chargement des informations…';
   const photoBox=by('amaWorkerEditorPhoto');
   if(photoBox){photoBox.className='ama-worker-avatar-fallback';photoBox.textContent=(u.name||'').split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase()||'👤';const existing=list.querySelector('[data-worker-card="'+CSS.escape(id)+'"] .ama-worker-avatar');if(existing?.src){photoBox.className='ama-worker-avatar-fallback';photoBox.textContent='';const img=document.createElement('img');img.className='ama-worker-avatar';img.alt='Photo de profil';img.src=existing.src;photoBox.appendChild(img)}}
   window.amaM6LoadWorker?.(id);by('amaWorkerShowEarnings').checked=false;by('amaWorkerEarningsStatus').textContent='Chargement de l’autorisation…';amaLoadWorkerPermission(id);panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'nearest'});
   try{
     const {data:row,error}=await client.from('profiles').select('full_name,phone').eq('id',id).single();
     if(error)throw error;
     if(by('amaWorkerEditId').value===id){by('amaWorkerEditName').value=row.full_name||u.name||'';by('amaWorkerEditPhone').value=row.phone||'';by('amaWorkerEditStatus').textContent=''}
   }catch(e){by('amaWorkerEditStatus').textContent='Informations complémentaires indisponibles : '+e.message}
 }
 list.addEventListener('click',e=>{if(e.target.closest('button'))return;const card=e.target.closest('[data-worker-card]');if(card)open(card.dataset.workerCard)});
 list.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-worker-card]')){e.preventDefault();open(e.target.dataset.workerCard)}});
 by('amaWorkerEditorPhotoButton').addEventListener('click',()=>{const id=by('amaWorkerEditId').value;if(!id)return;const row=Array.from(list.querySelectorAll('[data-worker-card]')).find(el=>el.dataset.workerCard===id);const trigger=row?.querySelector('.ama-photo-action');if(trigger)trigger.click();else by('amaWorkerEditStatus').textContent='La fonction photo sera disponible après le chargement du profil.'});
 by('amaWorkerEditorClose').addEventListener('click',close);
 by('amaWorkerCancel').addEventListener('click',close);
 by('amaWorkerReset').addEventListener('click',()=>{by('amaWorkerEditStatus').textContent='Utilisez « Mot de passe oublié ? » sur la page de connexion pour réinitialiser l’accès.'});
 by('amaWorkerEditForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!session||session.role!=='admin')return;
   const id=by('amaWorkerEditId').value,name=by('amaWorkerEditName').value.trim(),phone=by('amaWorkerEditPhone').value.trim(),status=by('amaWorkerEditStatus');
   if(!name)return;
   const btn=e.currentTarget.querySelector('[type=submit]');btn.disabled=true;status.textContent='Enregistrement…';
   try{
     const {error}=await client.from('profiles').update({full_name:name,phone}).eq('id',id);
     if(error)throw error;
     const u=userById(id);if(u)u.name=name;
     status.textContent='Informations enregistrées.';render();
   }catch(err){status.textContent='Enregistrement impossible : '+(err.message||err)}
   finally{btn.disabled=false}
 });
})();
function exportData(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ama-planning-${today()}.json`;a.click();URL.revokeObjectURL(url)}
let amaResetBusy=false;
$('#recoverAdmin').addEventListener('click',()=>{
 $('#loginForm').hidden=true;$('#amaPasswordResetForm').hidden=false;
 $('#loginScreen').classList.add('ama-reset-view');
 $('#resetEmail').value=$('#loginEmail').value||'';$('#amaResetFeedback').textContent='';$('#resetEmail').focus();
});
$('#amaResetBack').addEventListener('click',()=>{
 $('#amaPasswordResetForm').hidden=true;$('#loginForm').hidden=false;
 $('#loginScreen').classList.remove('ama-reset-view');$('#loginEmail').focus();
});
$('#amaPasswordResetForm').addEventListener('submit',async e=>{
 e.preventDefault();if(amaResetBusy||!e.currentTarget.reportValidity())return;
 const email=$('#resetEmail').value.trim(),button=$('#sendReset'),feedback=$('#amaResetFeedback');
 amaResetBusy=true;button.disabled=true;feedback.textContent='Envoi du lien…';
 try{
  if(!client)throw Error('Service indisponible. Réessayez.');
  const r=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(r.error)throw r.error;
  feedback.textContent='Si cette adresse est associée à un compte, vous recevrez un lien de réinitialisation. Vérifiez aussi les courriers indésirables.';
 }catch(_){feedback.textContent='Impossible de confirmer l’envoi. Vérifiez votre connexion et réessayez dans un instant.';}
 finally{amaResetBusy=false;button.disabled=false;}
});
client?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'&&session){session=null;amaRRClear();setTimeout(()=>location.replace(location.protocol==='file:'?location.href.split('#')[0].split('?')[0]:location.origin+location.pathname),0);}if(event==='PASSWORD_RECOVERY')setTimeout(async()=>{
 const pass=prompt('Choisissez votre nouveau mot de passe (au moins 8 caractères) :');
 if(pass===null)return;if(pass.length<8)return alert('Mot de passe trop court.');
 const r=await client.auth.updateUser({password:pass});alert(r.error?r.error.message:'Mot de passe modifié. Vous pouvez vous connecter.');
},100)});
$('#backupBtn').addEventListener('click',exportData);$('#exportBtn').addEventListener('click',exportData);
$('#restoreInput').addEventListener('change',e=>{e.target.value='';alert('Import de sauvegarde désactivé pour éviter d’écraser les données en ligne.');});
$('#resetBtn').addEventListener('click',()=>alert('Effacement global désactivé pour protéger les données Supabase.'));
document.querySelector("#sideLinks").appendChild(document.querySelector("#nav"));
amaSetupFinalUI();
// Dashboard shortcuts preserve role filtering in the existing render functions.
function amaSetupStatShortcuts(){
 const makeFilter=(id,label,container,render)=>{const field=document.createElement('div');field.className='field';field.innerHTML='<label for="'+id+'">Statut</label><select id="'+id+'"><option value="">Tous les statuts</option><option value="'+(id==='planningStatusFilter'?'planned':'done')+'">'+label+'</option></select>';container.appendChild(field);field.querySelector('select').onchange=render;};
 makeFilter('planningStatusFilter','À réaliser',document.querySelector('.ama-planning-filters'),renderPlanning);document.getElementById('planningStatusFilter').value='planned';
 const doneOption=document.createElement('option');doneOption.value='done';doneOption.textContent='Réalisées';document.getElementById('planningStatusFilter').appendChild(doneOption);
 makeFilter('historyStatusFilter','Réalisées',document.querySelector('#tab-history .formgrid'),renderHistory);
 for(const [value,label] of [['planned','À réaliser'],['cancelled','Annulées'],['not_entered','Non entrés'],['prolonged','Prolongations']]){const option=new Option(label,value);$('#historyStatusFilter').add(option);}
 const descriptions=['Ouvrir le planning du jour','Voir toutes les missions à réaliser','Voir les interventions validées du mois','Ouvrir le relevé d’heures du mois'];
 document.querySelectorAll('#stats .ama-stat').forEach((card,i)=>{card.setAttribute('role','link');card.tabIndex=0;card.setAttribute('aria-label',descriptions[i]);const chevron=document.createElement('span');chevron.className='ama-stat-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='›';card.appendChild(chevron);
 const open=()=>{if(!session)return;
 if(i<2){setTab('planning');$('#planningDate').value=i===0?today():'';$('#planningWorkerFilter').value=session.role==='admin'?'':session.id;$('#planningStatusFilter').value='planned';renderPlanning();document.getElementById('tab-planning').scrollIntoView({block:'start'});}
 else{setTab('history');$('#historyMonth').value=monthNow();$('#historyWorker').value=session.role==='admin'?'':session.id;$('#historyStatusFilter').value=i===2?'done':'';renderHistory();if(i===3){$('#reportMonth').value=monthNow();if(session.role==='admin')$('#reportWorker').value='';reportTotal();document.getElementById('workerReport').open=true;document.getElementById('workerReport').scrollIntoView({block:'center'});$('#reportWorkerWrap').classList.contains('hidden')?$('#reportMonth').focus({preventScroll:true}):$('#reportWorker').focus({preventScroll:true});}else document.getElementById('tab-history').scrollIntoView({block:'start'});}
 };card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});
}
amaSetupStatShortcuts();
let amaInvoiceStep='overview',amaInvoiceClient=null,amaInvoiceMailState=null,amaInvoiceMailOwner=null;
const amaIssuerIds=['invoiceIssuer','invoiceSiret','invoiceIssuerAddress','invoiceIssuerEmail','invoiceIssuerPhone','invoicePayment','invoiceIban','invoiceBic','invoiceLogoData'];
function amaIssuerStorage(){return 'ama_invoice_issuer_'+session.id+'_'+amaInvoiceCompany}
function amaInvoiceAccount(){if(!session||session.role!=='admin')return;if(amaBillingOwner===session.id)return;amaBillingOwner=session.id;amaInvoiceCompany='ama';if($('#amaCompanySelect'))$('#amaCompanySelect').value='ama';amaInvoiceStep='overview';amaInvoiceClient=null;amaInvoiceMailState=null;amaMailConfig=null;amaMailReady=false;amaMailOwner=null;amaMailRequest++;$('#amaMailJournal').textContent='';$('#amaMailEvents').textContent='';$('#amaAutoSummaryState').textContent=amaIssuerRemoteOwner===session.id&&amaIssuerRemote?(amaIssuerRemote.enabled?'Activé':'Désactivé'):'À connecter';let saved={};try{saved=JSON.parse(localStorage.getItem(amaIssuerStorage())||'{}')}catch(_){}for(const id of amaIssuerIds)document.getElementById(id).value=(amaCompaniesOwner===session.id?amaCompanyRows.find(c=>c.id===amaInvoiceCompany)?.settings?.issuer?.[id]:undefined)??saved[id]??(id==='invoiceIssuer'?'AMA Company':'');$('#invoiceNumber').value='';$('#invoicePaid').value=0;amaSetInvoiceLogo((amaCompaniesOwner===session.id?amaCompanyRows.find(c=>c.id===amaInvoiceCompany)?.settings?.issuer?.invoiceLogoData:undefined)??saved.invoiceLogoData??'');amaInvoiceShow('overview');}
function amaM1Steps(current){return '<div class="ama-m1-progress" aria-label="Progression de la facture : étape '+(current+1)+' sur 3">'+[0,1,2].map(i=>'<span class="ama-m1-node '+(i<current?'is-done':i===current?'is-active':'is-pending')+'" aria-label="'+['Client','Vérification','PDF'][i]+'">'+(i<current?'✓':i+1)+'</span>').join('')+'</div>'; }
function amaInvoiceShow(step){amaInvoiceStep=step;const issuer=$('#amaInvoiceIssuer');if(issuer){if(['client','review'].includes(step))$('#amaInvoiceFields').insertBefore(issuer,$('#amaInvoiceVerify'));else if(['overview','settings'].includes(step))$('#amaMailIssuerSlot').appendChild(issuer);}$('#amaInvoiceOverview').hidden=step!=='overview';$('#amaInvoiceDraft').hidden=!['client','review'].includes(step);$('#amaInvoiceReview').hidden=step!=='review';$('#amaInvoiceFields').hidden=step==='review';$('#amaInvoiceEmail').hidden=step!=='email';$('#amaInvoiceSettings').hidden=step!=='settings';$('#amaInvoiceSteps').hidden=!['client','review'].includes(step);$('#amaInvoiceBack').hidden=step==='overview';$('#amaInvoiceSteps').innerHTML=amaM1Steps(step==='client'?0:step==='review'?1:2);if(step==='client'){if($('#amaInvoiceDraftMonth'))$('#amaInvoiceDraftMonth').value=$('#invoiceMonth').value||monthNow();amaInvoiceDraftSummary();}const title=$('#amaInvoiceMainTitle');if(title)title.textContent=step==='settings'?'Configuration de facturation':'Factures';const desc=$('#tab-invoices .card .desc');if(desc)desc.textContent=step==='settings'?'Choisissez quand et à qui envoyer vos factures.':'Préparez vos factures par client.';const configure=$('#amaInvoiceConfigure');if(configure)configure.hidden=step!=='overview';const bar=$('#amaCompanyBar');if(bar)bar.hidden=step==='email';if(step==='settings')amaMailLoad();}
function amaInvoiceBack(){if(amaInvoiceStep==='review')amaInvoiceShow('client');else if(amaInvoiceStep==='email'){amaInvoiceShow('review');amaOpenPdf(amaInvoiceMailState.html,amaInvoiceMailState.name,'invoice');amaPdfState.invoice={...amaInvoiceMailState.invoice};}else amaInvoiceShow('overview');}
function amaInvoiceTotals(clientId){const rows=invoiceRows(clientId,$('#invoiceMonth').value||monthNow());return {rows,h:rows.reduce((n,r)=>n+Number(r.finance?.reference_hours||0),0),cents:rows.reduce((n,r)=>n+Math.round(Number(r.finance?.revenue||0)*100),0),missing:rows.filter(r=>!r.finance||r.finance.revenue==null).length};}
function amaRenderInvoiceSummary(){amaV8InvoiceCheck();if(!session||session.role!=='admin')return;amaInvoiceAccount();const groups=orderClients.map(client=>({client,...amaInvoiceTotals(client.id)})).filter(g=>g.rows.length);$('#amaInvoiceTotal').textContent=euro(groups.reduce((n,g)=>n+g.cents,0)/100);$('#amaInvoiceClientCount').textContent=groups.length;$('#invoiceSummary').innerHTML=groups.map(g=>'<article class="ama-invoice-client"><div><strong>'+esc(g.client.name)+'</strong><p>'+g.rows.length+' prestations · '+hours(g.h)+' facturables</p></div><strong>'+euro(g.cents/100)+'</strong>'+(g.missing?'<p class="ama-warning">'+g.missing+' montant(s) à compléter</p>':'')+'<button type="button" data-invoice-client="'+esc(g.client.id)+'">Préparer <span>›</span></button></article>').join('')||'<p class="empty">Aucune prestation facturable pour ce mois.</p>';if(['client','review'].includes(amaInvoiceStep)){amaInvoiceDraftSummary();if(amaInvoiceStep==='review')amaInvoiceReview();}}
function amaPrepareInvoice(id){if(session?.role!=='admin')return;amaInvoiceClient=id;amaInvoiceMailState=null;$('#amaInvoiceDraftMonth').value=$('#invoiceMonth').value||monthNow();const client=orderClients.find(c=>c.id===id);if(!client)return;$('#amaInvoiceClientSelect').innerHTML=orderClients.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');$('#amaInvoiceClientSelect').value=id;$('#amaInvoiceClientAddress').textContent=client.billing_address||'Adresse à renseigner dans Gestion › Clients';$('#amaInvoiceClientEmail').textContent=client.email||'E-mail non renseigné';$('#invoicePaid').value=0;$('#invoiceNumber').value='';amaInvoiceShow('client');$('#amaInvoiceBack').focus();}
function amaInvoiceDraftSummary(){if(!amaInvoiceClient)return;const c=orderClients.find(c=>c.id===amaInvoiceClient),g=amaInvoiceTotals(amaInvoiceClient);$('#amaInvoiceDraftSummary').textContent=(c?.name||'Client')+' · '+($('#invoiceMonth').value||monthNow())+' · '+g.rows.length+' prestations · '+hours(g.h)+' facturables · '+euro(g.cents/100);$('#amaInvoiceClientAddress').textContent=c?.billing_address||'Adresse à renseigner dans Gestion › Clients';$('#amaInvoiceClientEmail').textContent=c?.email||'E-mail non renseigné';}
function amaInvoiceReview(){if(session?.role!=='admin')return;const g=amaInvoiceTotals(amaInvoiceClient),c=orderClients.find(c=>c.id===amaInvoiceClient);if(!c)return;if(!g.rows.length)return alert('Aucune prestation pour ce client et cette période.');const groups=new Map();for(const r of g.rows){const group=groups.get(r.apt.id)||{name:r.apt.name,h:0,cents:0,count:0};group.h+=Number(r.finance?.reference_hours||0);group.cents+=Math.round(Number(r.finance?.revenue||0)*100);group.count++;groups.set(r.apt.id,group)}$('#amaInvoiceReview').innerHTML='<h3>Vérifier les prestations</h3><div class="tablewrap"><table><thead><tr><th>Appartement</th><th>Heures facturables</th><th>Montant</th></tr></thead><tbody>'+[...groups.values()].map(g=>'<tr><td>'+esc(g.name)+'<small>'+g.count+' prestation(s)</small></td><td>'+hours(g.h)+'</td><td>'+euro(g.cents/100)+'</td></tr>').join('')+'</tbody></table></div><p class="ama-invoice-total">Total : '+euro(g.cents/100)+'</p>'+(g.missing?'<p class="ama-warning">Complétez les montants manquants avant la génération.</p>':'')+'<p>Numéro : '+esc($('#invoiceNumber').value||'À renseigner')+' · Échéance : '+esc(dateFr($('#invoiceDueDate').value))+'</p><button type="button" id="amaInvoiceEdit">Modifier les informations</button><button type="button" class="primary" id="amaInvoiceGenerate" '+(g.missing?'disabled':'')+'>Générer l’aperçu PDF</button>';$('#amaInvoiceEdit').onclick=()=>amaInvoiceShow('client');$('#amaInvoiceGenerate').onclick=()=>printClientInvoice(amaInvoiceClient);amaInvoiceShow('review');}
function amaSetupInvoices(){
 const root=$('#tab-invoices'),old=root.querySelector('.card'),title=old.querySelector('h3');title.textContent='Factures';old.querySelector('.desc').textContent='Préparez vos factures par client.';
 const head=document.createElement('div');head.id='amaInvoiceHeader';head.innerHTML='<button type="button" id="amaInvoiceBack" hidden>‹ Retour</button><div id="amaInvoiceSteps" hidden></div>';(title.closest('.ama-integrated-heading')||title).after(head);
 const overview=document.createElement('div');overview.id='amaInvoiceOverview';const monthWrap=$('#invoiceMonth').closest('.field');const monthNav=document.createElement('div');monthNav.className='ama-invoice-month';monthNav.innerHTML='<button type="button" id="amaInvoicePrev" aria-label="Mois précédent">‹</button><div id="amaInvoiceMonthSlot"></div><button type="button" id="amaInvoiceNext" aria-label="Mois suivant">›</button>';overview.appendChild(monthNav);monthNav.querySelector('#amaInvoiceMonthSlot').append(monthWrap);
 const totals=document.createElement('div');totals.className='ama-invoice-metrics';totals.innerHTML='<div><strong id="amaInvoiceTotal">0 €</strong><span>Total des prestations</span></div><div><strong id="amaInvoiceClientCount">0</strong><span>Clients</span></div>';overview.appendChild(totals);
 const settings=document.createElement('details');settings.id='amaInvoiceIssuer';settings.innerHTML='<summary>Informations de mon entreprise</summary><div class="formgrid" id="amaIssuerFields"></div><p class="muted">Coordonnées utilisées pour vos PDF. Enregistrez la configuration pour les synchroniser avec le serveur. Le logo est enregistré pour la société sélectionnée et utilisé pour ses factures. Après modification, enregistrez puis envoyez un test.</p>';overview.appendChild(settings);amaIssuerIds.filter(id=>id!=='invoiceLogoData').concat(['invoiceLogo']).forEach(id=>settings.querySelector('.formgrid').appendChild($('#'+id).closest('.field')));
 const label=document.createElement('h3');label.textContent='Clients à facturer';overview.append(label,$('#invoiceSummary'));const auto=document.createElement('button');auto.type='button';auto.id='amaInvoiceAutoLink';auto.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg><strong>Envoi automatique</strong><span id="amaAutoSummaryState">Configuration</span><span>›</span>';auto.onclick=()=>amaInvoiceShow('settings');overview.insertBefore(auto,label);
 const draft=document.createElement('div');draft.id='amaInvoiceDraft';draft.hidden=true;draft.innerHTML='<p id="amaInvoiceDraftSummary" class="ama-invoice-recap"></p><div id="amaInvoiceFields"><label for="amaInvoiceClientSelect">Client</label><select id="amaInvoiceClientSelect"></select><details><summary>Coordonnées du client</summary><p id="amaInvoiceClientAddress"></p><p id="amaInvoiceClientEmail"></p></details><div class="formgrid" id="amaInvoiceNumberFields"></div><p class="muted">Vérifiez le numéro de facture avant génération.</p><button type="button" id="amaInvoiceVerify" class="primary">Vérifier les prestations</button></div><div id="amaInvoiceReview" hidden></div>';
 ['invoiceNumber','invoiceDueDate','invoicePaid'].forEach(id=>draft.querySelector('#amaInvoiceNumberFields').appendChild($('#'+id).closest('.field')));
 const email=document.createElement('div');email.id='amaInvoiceEmail';email.hidden=true;email.innerHTML='<h3>Envoyer la facture</h3><label for="amaInvoiceTo">Destinataire</label><input type="email" id="amaInvoiceTo" required><label for="amaInvoiceSubject">Objet</label><input id="amaInvoiceSubject"><label for="amaInvoiceMessage">Message</label><textarea id="amaInvoiceMessage" rows="5"></textarea><p id="amaInvoiceAttachment"></p><button type="button" id="amaInvoiceShare" class="primary">Partager le PDF et le message</button><button type="button" id="amaInvoiceMailFallback">Ouvrir ma messagerie</button><p class="muted">Le partage ouvre les applications disponibles, dont Mail. Si vous ouvrez directement votre messagerie, téléchargez le PDF puis joignez-le au message.</p><p id="amaInvoiceMailFeedback" role="status"></p>';
 const later=document.createElement('div');later.id='amaInvoiceSettings';later.hidden=true;later.innerHTML='';
 old.querySelector('.formgrid')?.remove();const obsolete=[...old.children].find(n=>n.tagName==='P'&&n.textContent.startsWith('Numérotation'));obsolete?.remove();old.append(overview,draft,email,later);$('#amaInvoiceBack').onclick=amaInvoiceBack;$('#amaInvoiceVerify').onclick=amaInvoiceReview;$('#amaInvoiceClientSelect').onchange=e=>{amaInvoiceClient=e.target.value;amaInvoiceDraftSummary()};
 for(const [id,offset]of[['amaInvoicePrev',-1],['amaInvoiceNext',1]])$('#'+id).onclick=()=>{const d=new Date(($('#invoiceMonth').value||monthNow())+'-01T12:00:00');d.setMonth(d.getMonth()+offset);$('#invoiceMonth').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderInvoiceSummary()};
 // The month input is shared, and remains visible on every draft step.
 const monthDraft=document.createElement('div');monthDraft.className='field ama-draft-month';monthDraft.innerHTML='<label for="amaInvoiceDraftMonth">Période</label><input type="month" id="amaInvoiceDraftMonth">';$('#amaInvoiceFields').prepend(monthDraft);$('#amaInvoiceClientSelect').previousElementSibling?.classList.add('ama-client-label');$('#amaInvoiceDraftMonth').onchange=e=>{$('#invoiceMonth').value=e.target.value;amaInvoiceDraftSummary()};$('#amaInvoiceClientSelect').addEventListener('focus',()=>$('#amaInvoiceDraftMonth').value=$('#invoiceMonth').value);
 amaIssuerIds.forEach(id=>$('#'+id).addEventListener('change',()=>{if(session?.role!=='admin')return;const values=Object.fromEntries(amaIssuerIds.map(k=>[k,$('#'+k).value]));try{localStorage.setItem(amaIssuerStorage(),JSON.stringify(values))}catch(_){}}));
 const mail=document.createElement('button');mail.type='button';mail.id='amaInvoiceMailButton';mail.hidden=true;mail.textContent='Envoyer par e-mail';$('#amaPdfPreview .ama-pdf-actions').appendChild(mail);mail.onclick=()=>{if(amaPdfState?.kind!=='invoice'||session?.role!=='admin')return;amaInvoiceMailState={...amaPdfState};amaInvoiceMailOwner=session.id;const c=orderClients.find(c=>c.id===amaInvoiceClient);amaClosePdf();setTab('invoices');amaInvoiceShow('email');$('#amaInvoiceTo').value=c?.email||'';$('#amaInvoiceSubject').value='Facture '+amaInvoiceMailState.invoice.number+' · '+amaCompanyName(amaInvoiceMailState.invoice.companyId);$('#amaInvoiceMessage').value='Bonjour,\n\nVeuillez trouver votre facture en pièce jointe.\n\nMerci pour votre confiance.\n'+$('#invoiceIssuer').value;$('#amaInvoiceAttachment').textContent=amaInvoiceMailState.name;$('#amaInvoiceMailFeedback').textContent='';};
 $('#amaInvoiceShare').onclick=async()=>{if(session?.role!=='admin'||session.id!==amaInvoiceMailOwner||!amaInvoiceMailState)return;if(!$('#amaInvoiceTo').checkValidity()||!$('#amaInvoiceTo').value)return $('#amaInvoiceTo').reportValidity();const button=$('#amaInvoiceShare');button.disabled=true;try{const file=new File([amaBuildDocumentPdf(amaInvoiceMailState)],amaInvoiceMailState.name,{type:'application/pdf'});if(!navigator.canShare?.({files:[file]}))throw Error('Partage PDF indisponible ici. Revenez à l’aperçu pour télécharger le PDF, puis utilisez Ouvrir ma messagerie.');await navigator.share({files:[file],title:$('#amaInvoiceSubject').value,text:'Destinataire : '+$('#amaInvoiceTo').value+'\n\n'+$('#amaInvoiceMessage').value});$('#amaInvoiceMailFeedback').textContent='Partage terminé. Vérifiez l’envoi dans votre messagerie.';}catch(e){$('#amaInvoiceMailFeedback').textContent=e.name==='AbortError'?'Partage annulé.':e.message;}finally{button.disabled=false}};
 $('#amaInvoiceMailFallback').onclick=()=>{if(session?.role!=='admin'||session.id!==amaInvoiceMailOwner)return;const to=$('#amaInvoiceTo');if(!to.value||!to.checkValidity())return to.reportValidity();location.href='mailto:'+encodeURIComponent(to.value)+'?subject='+encodeURIComponent($('#amaInvoiceSubject').value)+'&body='+encodeURIComponent($('#amaInvoiceMessage').value);};
}
async function amaSaveBilling(v){if(session?.role!=='admin')throw Error('Accès administrateur requis');if(!Number.isFinite(v.hours)||v.hours<=0||!Number.isFinite(v.bill)||v.bill<0||!Number.isFinite(v.rate)||v.rate<0)throw Error('Heures ou tarif invalides');if(!v.create){const old=data.missions.find(m=>m.id===v.id);if(old&&old.date!==v.date)await amaV8Guard(old.apartmentId,v.date,v.id);}const r=await client.rpc('ama_save_mission_billing',{p_mission_id:v.id,p_worker_hours:v.hours,p_billed_hours:v.bill,p_hourly_rate:v.rate,p_date:v.date,p_notes:v.notes,p_create:!!v.create,p_apartment_id:v.apartment||null,p_worker_id:v.worker||null,p_status:v.status||'planned'});if(r.error)throw r.error;}
function amaOpenBillingEditor(m){if(session?.role!=='admin')return;const f=missionFinances.get(m.id)||apartmentFinances.get(m.apartmentId)||{};const dialog=$('#amaBillingDialog');dialog.dataset.mission=m.id;$('#amaBillWorker').value=m.hours;$('#amaBillClient').value=f.reference_hours??m.hours;$('#amaBillRate').value=f.hourly_rate??0;$('#amaBillDate').value=m.date;$('#amaBillNotes').value=m.notes||'';$('#amaBillCopy').checked=false;$('#amaBillFeedback').textContent=amaBillingConfigured?'':'Installez AMA_Facturation_Missions.sql avant l’enregistrement.';dialog.showModal();}
function amaSetupBilling(){const dialog=document.createElement('dialog');dialog.id='amaBillingDialog';dialog.innerHTML='<form id="amaBillingForm"><h3>Modifier la mission</h3><div class="formgrid"><div class="field"><label for="amaBillWorker">Heures intervenant</label><input id="amaBillWorker" type="number" min=".25" max="1000" step=".25" required></div><div class="field"><label for="amaBillClient">Heures facturables client</label><input id="amaBillClient" type="number" min="0" max="1000" step=".25" required></div><div class="field full"><label><input type="checkbox" id="amaBillCopy"> Appliquer aussi les heures intervenant à la facturation</label></div><div class="field"><label for="amaBillRate">Tarif client (€ / h)</label><input id="amaBillRate" type="number" min="0" max="100000" step=".01" required></div><div class="field"><label for="amaBillDate">Date</label><input id="amaBillDate" type="date" required></div><div class="field full"><label for="amaBillNotes">Consignes</label><textarea id="amaBillNotes" rows="3"></textarea></div></div><p id="amaBillFeedback" role="status"></p><div class="ama-bill-actions"><button type="button" id="amaBillCancel">Annuler</button><button type="submit" class="primary">Enregistrer</button></div></form>';document.body.appendChild(dialog);$('#amaBillCancel').onclick=()=>dialog.close();const copy=()=>{if($('#amaBillCopy').checked)$('#amaBillClient').value=$('#amaBillWorker').value};$('#amaBillWorker').oninput=copy;$('#amaBillCopy').onchange=copy;$('#amaBillingForm').onsubmit=async e=>{e.preventDefault();if(!amaBillingConfigured)return;const b=dialog.querySelector('[type=submit]');if(b.disabled)return;b.disabled=true;try{await amaSaveBilling({id:dialog.dataset.mission,hours:Number($('#amaBillWorker').value),bill:Number($('#amaBillClient').value),rate:Number($('#amaBillRate').value),date:$('#amaBillDate').value,notes:$('#amaBillNotes').value});await reload();render();dialog.close();}catch(error){$('#amaBillFeedback').textContent='Enregistrement refusé : '+error.message}finally{b.disabled=false}};}
let amaMailConfig=null,amaMailReady=false,amaMailScheduler=false,amaMailOwner=null,amaMailRequest=0,amaMailLoading=false;
const amaMailLabels={queued:'En attente',processing:'En cours',accepted:'Pris en charge',failed:'Non envoyé',uncertain:'À vérifier'};
async function amaMailCall(action,extra={}){
 if(session?.role!=='admin')throw Error('Accès administrateur requis');
 const r=await client.functions.invoke('ama-invoice-mail',{body:{action,company_id:amaInvoiceCompany,...extra}});
 if(r.error){let detail='';try{detail=(await r.error.context?.json())?.error||''}catch(_){}throw Error(detail||'Service e-mail indisponible. Consultez le guide de connexion Supabase.');}
 if(r.data?.error)throw Error(r.data.error);return r.data;
}
function amaAutomaticInvoiceMonth(nextRun,now=new Date()){
 const date=nextRun?new Date(nextRun):now;
 if(!Number.isFinite(date.getTime()))return 'Période indisponible';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit'}).formatToParts(date);
 const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
 const previous=new Date(Date.UTC(year,month-2,1));
 const value=new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',month:'long',year:'numeric'}).format(previous);
 return value.charAt(0).toUpperCase()+value.slice(1);
}
async function amaMailLoad(){
 $('#amaAutoInvoiceMonth').value='Vérification…';
 if(session?.role!=='admin')return;
 const owner=session.id,company=amaInvoiceCompany,request=++amaMailRequest;amaMailOwner=owner;amaMailLoading=true;
 $('#amaMailFeedback').textContent='Chargement de la configuration…';$('#amaGmailBox').hidden=false;$('#amaGmailState').textContent='Vérification du service…';$('#amaGmailBox').classList.remove('ama-mail-ready');$('#amaMailServiceSender').textContent='Vérification…';$('#amaMailConnection').hidden=true;$('#amaMailSender').textContent='';
 try{
  const r=await amaMailCall('status');if(session?.id!==owner||company!==amaInvoiceCompany||request!==amaMailRequest)return;
  amaMailReady=!!r.ready;amaMailScheduler=!!r.scheduler_ready;amaMailConfig=r.config;if(Array.isArray(r.companies)){amaCompanyRows=r.companies;amaCompaniesOwner=owner;}amaIssuerRemote=r.config.settings;amaIssuerRemoteOwner=owner;
  const s=r.config.settings;$('#amaAutoDay').value=s.day;$('#amaAutoTime').value=s.time;$('#amaAutoPrefix').value=s.prefix;$('#amaAutoNumber').value=r.config.next_number;$('#amaAutoDue').value=s.due_days;$('#amaAutoMessage').value=s.message;$('#amaAutoEnabled').checked=s.enabled;
  for(const id of amaIssuerIds)$('#'+id).value=s.issuer?.[id]??(id==='invoiceLogoData'?'':$('#'+id).value);
  amaSetInvoiceLogo(s.issuer?.invoiceLogoData??'');
  $('#amaAutoClients').innerHTML=orderClients.map(c=>{const other=amaCompanyRows.find(x=>x.id!==amaInvoiceCompany&&x.settings.client_ids.includes(c.id));return '<label class="ama-auto-client"><input type="checkbox" value="'+esc(c.id)+'" '+(s.client_ids.includes(c.id)?'checked ':'')+(other?'disabled':'')+'><span><strong>'+esc(c.name)+'</strong><small>'+esc(other?'Attribué à '+other.name:(c.email||'E-mail à compléter dans Gestion'))+'</small></span></label>';}).join('')||'<p class="muted">Ajoutez vos clients dans Gestion.</p>';
  $('#amaGmailBox').hidden=false;
  $('#amaGmailState').textContent=r.ready?'Service opérationnel':'Service indisponible';
  $('#amaGmailBox').classList.toggle('ama-mail-ready',!!r.ready);
  // The provider's effective sender is authoritative for each company.
  $('#amaMailServiceSender').textContent=r.sender||s.issuer?.invoiceIssuerEmail||'Adresse non renseignée';
  $('#amaMailConnection').hidden=false;
  $('#amaMailConnection').textContent=!amaMailReady?'Service e-mail à connecter':!amaMailScheduler?'Service e-mail connecté · programmation à installer':'Service e-mail et programmation configurés';
  $('#amaMailSender').textContent='';$('#amaMailSender').hidden=true;
  $('#amaAutoEnabled').disabled=!amaMailReady||!amaMailScheduler;
  $('#amaMailTest').disabled=!amaMailReady;$('#amaMailSave').disabled=false;
  $('#amaAutoSummaryState').textContent=s.enabled?'Activé':'Désactivé';
  $('#amaAutoState').textContent=s.enabled?'Activé':'Désactivé';
  $('#amaAutoNext').textContent=r.config.next_run_at?'Prochain passage : '+new Date(r.config.next_run_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})+' · heure de Paris':'Aucun envoi programmé';
  $('#amaAutoInvoiceMonth').value=amaAutomaticInvoiceMonth(r.config.next_run_at);
  $('#amaAutoInvoiceMonthHint').textContent=r.config.next_run_at?'Période du prochain passage enregistré. Enregistrez pour appliquer un changement de programmation.':'À titre indicatif : mois précédent le mois actuel. Aucun envoi programmé.';
  $('#amaMailFeedback').textContent='';
  const journal=$('#amaMailJournal');journal.replaceChildren();for(const j of r.jobs||[]){if(j.journal_removed)continue;const line=document.createElement('article');line.className='ama-mail-event';const copy=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent=j.number;sub.textContent=(orderClients.find(c=>c.id===j.client_id)?.name||'Client')+' · '+j.period.slice(0,7);copy.append(title,sub);const status=document.createElement('span');status.className='ama-mail-status '+j.status;status.textContent=amaMailLabels[j.status]||j.status;line.append(copy,status,amaInvoiceMenu(j.id,company,'journal'));if(j.error){const err=document.createElement('p');err.textContent=j.error;line.append(err);}journal.append(line);}if(!journal.children.length)journal.textContent='Aucun envoi pour le moment.';

  $('#amaMailEvents').innerHTML=(r.events||[]).map(e=>'<p class="ama-warning">'+esc(orderClients.find(c=>c.id===e.client_id)?.name||'Client')+' · '+esc(e.period?.slice(0,7)||'')+' : '+esc(e.message)+'</p>').join('');
 }catch(e){if(session?.id!==owner||company!==amaInvoiceCompany||request!==amaMailRequest)return;amaMailConfig=null;amaMailReady=false;amaMailScheduler=false;$('#amaGmailState').textContent='État indisponible';$('#amaGmailBox').classList.remove('ama-mail-ready');$('#amaMailServiceSender').textContent='Vérification impossible';$('#amaMailConnection').hidden=false;$('#amaMailConnection').textContent='Service e-mail à vérifier';$('#amaAutoInvoiceMonth').value='Période indisponible';$('#amaMailFeedback').textContent=e.message;$('#amaAutoEnabled').disabled=true;$('#amaMailSave').disabled=true;$('#amaMailTest').disabled=true;}
 finally{if(request===amaMailRequest)amaMailLoading=false;}
}
function amaMailValues(){return {enabled:$('#amaAutoEnabled').checked,day:Number($('#amaAutoDay').value),time:$('#amaAutoTime').value,client_ids:$$('#amaAutoClients input:checked').map(x=>x.value),prefix:$('#amaAutoPrefix').value.trim().toUpperCase(),due_days:Number($('#amaAutoDue').value),issuer:Object.fromEntries(amaIssuerIds.map(id=>[id,$('#'+id).value.trim()])),message:$('#amaAutoMessage').value.trim()};}
async function amaMailSave(e){
 e?.preventDefault();if(!amaMailConfig||amaMailLoading||amaMailBusy||session?.role!=='admin')return;
 if(amaInvoiceLogoLoading){$('#amaMailFeedback').textContent='Le logo est en cours de préparation. Réessayez dans un instant.';return;}
 const form=$('#amaMailForm');if(!form.reportValidity())return;
 const b=$('#amaMailSave'),owner=session.id;b.disabled=true;amaSetMailBusy(true);$('#amaMailFeedback').textContent='Enregistrement…';
 try{
  const s=amaMailValues();if(s.enabled&&(!amaMailReady||!amaMailScheduler))throw Error('Connectez le service et installez la programmation avant activation.');
  const r=await client.rpc('ama_company_save_config',{p_company:amaInvoiceCompany,p_settings:s,p_next_number:Number($('#amaAutoNumber').value),p_revision:amaMailConfig.revision});if(r.error)throw r.error;
  if(session?.id!==owner)return;try{localStorage.setItem(amaIssuerStorage(),JSON.stringify(s.issuer))}catch(_){}
  await amaMailLoad();if(session?.id===owner)$('#amaMailFeedback').textContent=s.enabled?'Configuration enregistrée · envoi automatique activé.':'Configuration enregistrée · envoi automatique désactivé.';
 }catch(error){if(session?.id===owner)$('#amaMailFeedback').textContent=error.message;}finally{if(session?.id===owner)b.disabled=!amaMailConfig;amaSetMailBusy(false);}
}
function amaMailSetup(){
 const settings=$('#amaInvoiceSettings');settings.innerHTML=`<form id="amaMailForm">
 <div class="ama-auto-heading"><span class="ama-auto-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg></span><div><h3>Envoi automatique</h3><p class="muted">Factures du mois précédent · PDF joint</p></div></div>
 <label class="ama-auto-toggle">Activer l’envoi automatique <span><input type="checkbox" role="switch" id="amaAutoEnabled" disabled><i aria-hidden="true"></i></span></label><p id="amaAutoState">Désactivé</p>
 <div id="amaGmailBox" class="ama-gmail-card ama-mail-service" hidden><div class="ama-mail-service-top"><span class="ama-mail-service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/><path d="m16 16 2 2 3-4"/></svg></span><div><h4>Service d’envoi des factures</h4><p id="amaGmailState" role="status">Vérification du service…</p></div></div><div class="ama-mail-service-address"><span>Adresse d’expédition</span><strong id="amaMailServiceSender">Vérification…</strong></div><button type="button" id="amaGmailRefresh" class="ama-mail-check">Actualiser l’état</button></div><p id="amaMailConnection" class="ama-mail-connection">Service e-mail à connecter</p><small id="amaMailSender"></small>
 <div class="ama-auto-grid"><div class="field"><label for="amaAutoDay">Jour du mois</label><input id="amaAutoDay" type="number" min="1" max="28" required value="1"></div><div class="field"><label for="amaAutoTime">Heure</label><input id="amaAutoTime" type="time" required value="09:00"></div></div><p class="muted">Chaque mois · heure de Paris · délai de passage jusqu’à 5 minutes</p><p id="amaAutoNext" class="muted">Aucun envoi programmé</p><div class="field"><label for="amaAutoInvoiceMonth">Mois à facturer</label><input id="amaAutoInvoiceMonth" type="text" readonly aria-describedby="amaAutoInvoiceMonthHint" value="Vérification…"><small id="amaAutoInvoiceMonthHint" class="muted">Mois précédent celui de l’envoi · lecture seule.</small></div>
 <h4>Clients de cette société</h4><p class="muted">Les factures automatiques concernent uniquement ces clients. Pour changer leur société, décochez-les d’abord dans l’autre configuration. Les associations servent uniquement aux envois automatiques. En facturation manuelle, tous les clients restent disponibles avec les deux sociétés.</p><div id="amaAutoClients"></div><p class="muted">Les adresses ou montants incomplets sont exclus et signalés dans le journal. Prolongations exclues.</p>
 <div id="amaMailIssuerSlot"></div>
 <details><summary>Numérotation et paiement</summary><div class="ama-auto-grid"><div class="field"><label for="amaAutoPrefix">Préfixe</label><input id="amaAutoPrefix" pattern="[A-Z0-9-]{1,12}" maxlength="12" value="AMA" required></div><div class="field"><label for="amaAutoNumber">Prochain numéro</label><input id="amaAutoNumber" type="number" min="1" max="999999999" value="1" required></div><div class="field"><label for="amaAutoDue">Délai de paiement (jours)</label><input id="amaAutoDue" type="number" min="1" max="90" value="30" required></div></div><p class="muted">Exemple : AMA-2026-000001. Renseignez le numéro qui suit votre dernière facture. Une facture par société, client et mois. Coordonnées et numéros conservés dans Supabase.</p><p class="muted">Le modèle automatique reprend la franchise en base de TVA actuellement utilisée dans l’application. Vérifiez les mentions et le PDF de test avant activation.</p></details>
 <details><summary>Message de l’e-mail</summary><label for="amaAutoMessage">Message</label><textarea id="amaAutoMessage" rows="6" maxlength="4000" required>Bonjour,\n\nVeuillez trouver votre facture {numero} pour {periode} en pièce jointe.\n\nMerci pour votre confiance.\n{entreprise}</textarea><p class="muted">{numero}, {periode} et {entreprise} sont remplacés automatiquement.</p></details>
 <div class="ama-mail-actions"><button id="amaMailTest" type="button" disabled>Envoyer un test</button><button id="amaMailSave" class="primary" type="submit" disabled>Enregistrer</button></div><p class="muted">Enregistrez avec l’envoi désactivé, envoyez un test à votre propre adresse, puis activez après vérification.</p><p id="amaMailFeedback" role="status"></p></form>
 <details><summary>Journal des envois</summary><p class="muted">« Pris en charge » signifie accepté par le service e-mail. La réception et les rejets sont à vérifier chez le prestataire.</p><div id="amaMailJournal"></div><div id="amaMailEvents"></div></details>`;
 $('#amaMailForm').onsubmit=amaMailSave;$('#amaAutoEnabled').onchange=()=>$('#amaAutoState').textContent=$('#amaAutoEnabled').checked?'Activation à enregistrer':'Désactivé · à enregistrer';
 $('#amaMailTest').onclick=async()=>{
  if(!amaMailConfig||amaMailLoading||amaMailBusy||session?.role!=='admin')return;
  if(amaInvoiceLogoLoading){$('#amaMailFeedback').textContent='Attendez la fin du chargement du logo.';return;}
  const s=amaMailValues(),saved={...amaMailConfig.settings,issuer:{...amaMailConfig.settings.issuer,invoiceLogoData:amaMailConfig.settings.issuer?.invoiceLogoData||''}};
  if(JSON.stringify({...s,enabled:false})!==JSON.stringify({...saved,enabled:false})){// compare without relying on JSON object property order
   const clean=x=>JSON.stringify(Object.keys(x).sort().map(k=>[k,k==='issuer'?Object.keys(x[k]).sort().map(i=>[i,x[k][i]]):x[k]]));
   if(clean({...s,enabled:false})!==clean({...saved,enabled:false})){ $('#amaMailFeedback').textContent='Enregistrez vos modifications avant d’envoyer le test.';return;}
  }
  const b=$('#amaMailTest'),owner=session.id;b.disabled=true;amaSetMailBusy(true);$('#amaMailFeedback').textContent='Envoi du test…';
  try{const r=await amaMailCall('test',{period:document.getElementById('invoiceMonth').value});if(session?.id!==owner)return;await amaMailLoad();$('#amaMailFeedback').textContent='Test pris en charge pour '+r.recipient+'. Vérifiez votre messagerie et le PDF avant activation.';}catch(e){if(session?.id===owner)$('#amaMailFeedback').textContent=e.message;}finally{if(session?.id===owner)b.disabled=!amaMailReady;amaSetMailBusy(false);}
 };
 const send=document.createElement('button');send.id='amaInvoiceSendDirect';send.type='button';send.className='primary';send.textContent='Envoyer par e-mail avec le PDF';$('#amaInvoiceShare').before(send);$('#amaInvoiceShare').classList.remove('primary');
 send.onclick=async()=>{
  if(session?.role!=='admin'||session.id!==amaInvoiceMailOwner||!amaInvoiceMailState)return;
  const to=$('#amaInvoiceTo');if(!to.value||!to.reportValidity())return;
  const state=amaInvoiceMailState,meta=state.invoice;if(!meta)return;
  const owner=session.id;send.disabled=true;$('#amaInvoiceMailFeedback').textContent='Envoi…';
  try{const bytes=new Uint8Array(await amaBuildDocumentPdf(state).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.slice(i,i+16384));
   const result=await amaMailCall('send',{company_id:meta.companyId,client_id:meta.clientId,period:meta.month,number:meta.number,to:to.value.trim(),subject:$('#amaInvoiceSubject').value,message:$('#amaInvoiceMessage').value,pdf:btoa(str),...(meta.snapshot?{payment_tracking:{due_date:meta.snapshot.due,total_cents:Number(meta.snapshot.total_cents),paid_cents:Number(meta.snapshot.paid_cents||0)}}:{})});
   if(session?.id!==owner)return;
   $('#amaInvoiceMailFeedback').textContent=result.status==='accepted'?'Facture et PDF pris en charge par le service e-mail.':result.status==='uncertain'?'Envoi à vérifier dans le journal avant toute nouvelle tentative.':'Facture non envoyée : '+(result.error||'consultez le journal.');
  }catch(e){if(session?.id===owner)$('#amaInvoiceMailFeedback').textContent=e.message;}finally{if(session?.id===owner)send.disabled=false;}
 };
}

function amaCompanyName(id=amaInvoiceCompany){return id==='ldclean'?'LD Clean':'AMA Company'}
function amaClientInCompany(c){const assigned=amaCompanyRows.find(x=>x.settings?.client_ids?.includes(c.id));return assigned?assigned.id===amaInvoiceCompany:amaInvoiceCompany==='ama';}
function amaCompanyFillIssuer(){
 const record=amaCompaniesOwner===session?.id?amaCompanyRows.find(c=>c.id===amaInvoiceCompany):null;let local={};try{local=JSON.parse(localStorage.getItem(amaIssuerStorage())||'{}')}catch(_){}
 for(const id of amaIssuerIds)$('#'+id).value=record?.settings?.issuer?.[id]??local[id]??(id==='invoiceIssuer'?amaCompanyName():id==='invoiceIssuerEmail'?(amaInvoiceCompany==='ama'?'comptabilite@amacompany.fr':'ldclean06@gmail.com'):'');
 amaSetInvoiceLogo(record?.settings?.issuer?.invoiceLogoData??local.invoiceLogoData??'');
}
function amaSetMailBusy(busy){amaMailBusy=busy;const select=$('#amaCompanySelect');if(select)select.disabled=busy;$('#amaMailSave').disabled=busy||!amaMailConfig;$('#amaMailTest').disabled=busy||!amaMailReady;$('#amaGmailRefresh').disabled=busy;}
function amaSetupCompanies(){
 const bar=document.createElement('div');bar.id='amaCompanyBar';bar.className='field';bar.innerHTML='<label for="amaCompanySelect">Société qui facture</label><select id="amaCompanySelect"><option value="ama">AMA Company</option><option value="ldclean">LD Clean</option></select><small id="amaCompanyHint">Coordonnées et numérotation propres à chaque société.</small>';
 $('#amaInvoiceOverview').before(bar);
 $('#amaCompanySelect').onchange=async e=>{
  if(session?.role!=='admin'||amaMailBusy){e.target.value=amaInvoiceCompany;return;}
  const id=e.target.value;if(!['ama','ldclean'].includes(id))return;
  if(amaInvoiceStep==='settings'&&!confirm('Changer de société ? Les modifications non enregistrées seront abandonnées.')){e.target.value=amaInvoiceCompany;return;}
  const settings=amaInvoiceStep==='settings';amaInvoiceCompany=id;amaMailRequest++;amaMailLoading=false;amaMailConfig=null;amaMailReady=false;$('#amaAutoEnabled').checked=false;$('#amaAutoEnabled').disabled=true;$('#amaMailSave').disabled=true;$('#amaMailTest').disabled=true;$('#amaAutoClients').textContent='';$('#amaGmailBox').hidden=false;$('#amaGmailState').textContent='Vérification du service…';$('#amaMailServiceSender').textContent='Vérification…';$('#amaMailSender').textContent='';amaInvoiceClient=null;amaInvoiceMailState=null;$('#invoiceNumber').value='';$('#invoicePaid').value=0;amaCompanyFillIssuer();$('#amaMailJournal').textContent='';$('#amaMailEvents').textContent='';$('#amaAutoSummaryState').textContent=amaCompanyRows.find(c=>c.id===id)?.settings.enabled?'Activé':'Désactivé';
  amaInvoiceShow(settings?'settings':'overview');amaRenderInvoiceSummary();
 };
 $('#amaGmailRefresh').onclick=()=>{if(!amaMailBusy&&session?.role==='admin')amaMailLoad();};

}

let amaPaymentInvoice=null,amaPaymentRequest=null,amaPaymentBusy=false,amaPaymentOffset=0,amaPaymentCompany='ama';
function amaRenderAdminNotice(n){
 return `<div data-pref-key="a:${esc(n.id)}" class="ama-swipe-shell ama-ios-notification ama-admin-notice ${n.is_read?'ama-is-read':'ama-is-unread'}"><div class="ama-swipe-content"><span class="ama-ios-icon ama-ios-warning" aria-hidden="true">!</span><div class="ama-swipe-copy"><div class="ama-ios-title"><strong>${esc(n.title)}</strong>${n.is_read?'':'<span class="ama-ios-unread-dot"></span>'}</div><p>${esc(n.message)}</p><small>${new Date(n.created_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</small><div class="ama-admin-notice-actions"><button type="button" class="soft mini" data-ama-notice-open="${esc(n.id)}">${n.kind==='payment'?'Paiement reçu ?':n.kind==='payment_delivery'?'Vérifier la relance':n.kind==='incident'?'Voir le signalement':n.kind==='absence'?'Voir les absences':'Ouvrir pour affecter'}</button>${n.is_read?'':`<button type="button" class="soft mini" data-ama-notice-read="${esc(n.id)}">Lue</button>`}<button type="button" class="soft mini" data-ama-notice-hide="${esc(n.id)}">Masquer</button></div></div></div></div>`;
}
async function amaNoticeOpen(id){
 if(session?.role!=='admin')return;const n=missionNotifications.find(n=>n.id===id&&n.adminReminder);if(!n)return;
 await client.rpc('ama_admin_notice_action',{p_id:id,p_action:'read'});
 document.getElementById('notificationCard')?.classList.remove('ama-open');
 if(n.kind==='absence'){document.getElementById('amaNewAbsenceDialog').showModal();await amaNewLoad();await loadNotifications();renderNotifications();return;}
 if(n.kind==='incident'){await amaV6IncidentListOpen(n.incident_id);return;}
 if(n.kind==='payment'||n.kind==='payment_delivery'){await amaPaymentOpen(n.invoice_id,n.company_id);return;}
 setTab('planning');
 if(String(n.source).split(',').includes('rr')){amaRRWeekStart=amaRRMonday(amaRRToday());amaRROpenSheet();}
 else {amaStayWeekStart=amaRRMonday(amaRRToday());amaStayOpen(String(n.source).split(',').includes('airbnb')?'airbnb':'gdf','queue');}
 await loadNotifications();renderNotifications();
}
function amaAdminNoticeRoute(){
 if(session?.role!=='admin')return;const url=new URL(location.href),id=url.searchParams.get('ama_notice');if(!id)return;
 url.searchParams.delete('ama_notice');history.replaceState(null,'',url.pathname+url.search+url.hash);
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 const found=missionNotifications.some(n=>n.id===id&&n.adminReminder);if(found)setTimeout(()=>void amaNoticeOpen(id),0);
}
function amaSetupAdminReminderUI(){
 const toggle=document.createElement('button');toggle.type='button';toggle.id='amaPaymentTracking';toggle.className='soft';toggle.textContent='Suivi des paiements';toggle.onclick=()=>void amaPaymentListOpen();document.getElementById('amaInvoiceTopbar').append(toggle);
 const list=document.createElement('dialog');list.id='amaPaymentList';list.className='ama-admin-sheet';list.setAttribute('aria-labelledby','amaPaymentListTitle');
 list.innerHTML='<div class="ama-admin-sheet-head"><h3 id="amaPaymentListTitle">Suivi des paiements</h3><button type="button" data-payment-close aria-label="Fermer">×</button></div><div class="ama-admin-sheet-body"><label>Société<select id="amaPaymentCompany"><option value="ama">AMA Company</option><option value="ldclean">LD Clean</option></select></label><p>Les factures envoyées sont suivies séparément de leur PDF. Une relance nécessite toujours ta réponse Non.</p><p id="amaPaymentListFeedback" role="status"></p><div id="amaPaymentListRows"></div><div class="ama-admin-pager"><button type="button" id="amaPaymentPrev">Précédent</button><button type="button" id="amaPaymentNext">Suivant</button></div></div>';
 document.body.append(list);list.querySelector('[data-payment-close]').onclick=()=>list.close();list.querySelector('select').onchange=e=>{amaPaymentCompany=e.target.value;amaPaymentOffset=0;void amaPaymentListLoad();};
 document.getElementById('amaPaymentPrev').onclick=()=>{amaPaymentOffset=Math.max(0,amaPaymentOffset-20);void amaPaymentListLoad();};document.getElementById('amaPaymentNext').onclick=()=>{amaPaymentOffset+=20;void amaPaymentListLoad();};
 const dialog=document.createElement('dialog');dialog.id='amaPaymentDialog';dialog.className='ama-admin-sheet';dialog.setAttribute('aria-labelledby','amaPaymentTitle');
 dialog.innerHTML='<div class="ama-admin-sheet-head"><h3 id="amaPaymentTitle">Paiement reçu ?</h3><button type="button" data-payment-close aria-label="Fermer">×</button></div><div class="ama-admin-sheet-body"><p id="amaPaymentSummary"></p><p id="amaPaymentRecipient"></p><button type="button" id="amaPaymentReload">Actualiser le suivi</button><p id="amaPaymentFeedback" role="status" aria-live="polite"></p><div id="amaPaymentMetadata" hidden><p>Les anciennes factures manuelles peuvent ne pas avoir d’échéance enregistrée. Recopie les valeurs de la facture envoyée.</p><label>Date limite de paiement<input type="date" id="amaPaymentDue"></label><label>Montant total (€)<input type="number" min="0.01" step="0.01" id="amaPaymentTotal"></label><label>Déjà payé (€)<input type="number" min="0" step="0.01" value="0" id="amaPaymentPaid"></label><button type="button" id="amaPaymentSaveMetadata">Enregistrer le suivi</button></div><details id="amaPaymentText"><summary>Voir ou modifier le texte de relance</summary><label>Objet<input id="amaPaymentSubject" maxlength="200"></label><label>Message<textarea id="amaPaymentMessage" rows="8" maxlength="5000"></textarea></label><p>La relance reprend le PDF original et son destinataire. Modifier ce texte ne déclenche aucun envoi.</p></details><details><summary>Modèle pour les prochaines relances</summary><p>Variables : {numero}, {montant}, {echeance}, {entreprise}</p><label>Objet du modèle<input id="amaPaymentTemplateSubject" maxlength="200"></label><label>Message du modèle<textarea id="amaPaymentTemplateMessage" rows="8" maxlength="5000"></textarea></label><button type="button" id="amaPaymentTemplateSave">Enregistrer le modèle</button></details><div id="amaPaymentJournal"></div></div><div class="ama-payment-buttons"><button type="button" id="amaPaymentYes">Oui, marquer payée</button><button type="button" id="amaPaymentNo">Non, envoyer la relance</button><button type="button" id="amaPaymentLater">Me rappeler demain à 9 h</button></div>';
 document.body.append(dialog);document.getElementById('amaPaymentReload').onclick=()=>{if(!amaPaymentBusy&&dialog.dataset.invoice)void amaPaymentOpen(dialog.dataset.invoice,dialog.dataset.company);};dialog.querySelector('[data-payment-close]').onclick=()=>dialog.close();
 for(const [id,decision] of [['amaPaymentYes','paid'],['amaPaymentNo','unpaid'],['amaPaymentLater','snooze']])document.getElementById(id).onclick=()=>void amaPaymentDecide(decision);
 document.getElementById('amaPaymentSaveMetadata').onclick=async()=>{if(!amaPaymentInvoice||amaPaymentBusy)return;amaPaymentBusy=true;try{await amaMailCall('payment_metadata',{company_id:amaPaymentInvoice.company_id,invoice_id:amaPaymentInvoice.invoice_id,revision:amaPaymentInvoice.revision,due_date:document.getElementById('amaPaymentDue').value,total_cents:Math.round(Number(document.getElementById('amaPaymentTotal').value)*100),paid_cents:Math.round(Number(document.getElementById('amaPaymentPaid').value)*100)});await amaPaymentOpen(amaPaymentInvoice.invoice_id,amaPaymentInvoice.company_id);}catch(e){document.getElementById('amaPaymentFeedback').textContent=e.message;}finally{amaPaymentBusy=false;}};
 document.getElementById('amaPaymentTemplateSave').onclick=async()=>{if(!amaPaymentInvoice||amaPaymentBusy)return;amaPaymentBusy=true;try{await amaMailCall('payment_template_save',{company_id:amaPaymentInvoice.company_id,subject:document.getElementById('amaPaymentTemplateSubject').value,message:document.getElementById('amaPaymentTemplateMessage').value});document.getElementById('amaPaymentFeedback').textContent='Modèle enregistré pour cette société.';}catch(e){document.getElementById('amaPaymentFeedback').textContent=e.message;}finally{amaPaymentBusy=false;}};
 document.getElementById('notificationList').addEventListener('click',async e=>{
  const open=e.target.closest('[data-ama-notice-open]');if(open){void amaNoticeOpen(open.dataset.amaNoticeOpen);return;}
  const read=e.target.closest('[data-ama-notice-read]'),hide=e.target.closest('[data-ama-notice-hide]');if(!read&&!hide||session?.role!=='admin')return;
  const r=await client.rpc('ama_admin_notice_action',{p_id:read?read.dataset.amaNoticeRead:hide.dataset.amaNoticeHide,p_action:read?'read':'hide'});if(r.error){alert(r.error.message);return;}await loadNotifications();renderNotifications();
 });
 const app=document.getElementById('app');new MutationObserver(()=>{if(app.hidden){list.close();dialog.close();amaPaymentInvoice=null;amaPaymentRequest=null;document.getElementById('amaPaymentJournal').replaceChildren();document.getElementById('amaPaymentListRows').replaceChildren();}}).observe(app,{attributes:true,attributeFilter:['hidden']});
 for(const sheet of [list,dialog])sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close();}});
}
async function amaPaymentListOpen(){if(session?.role!=='admin')return;amaPaymentCompany=amaInvoiceCompany||'ama';amaPaymentOffset=0;document.getElementById('amaPaymentCompany').value=amaPaymentCompany;amaV9Open('payments');document.getElementById('amaPaymentList').show();await amaPaymentListLoad();}
async function amaV10PaymentLegacy(){
 if(session?.role!=='admin')return;const owner=session.id,source=amaPaymentCompany;const feedback=document.getElementById('amaPaymentListFeedback');feedback.textContent='Chargement…';
 try{const r=await amaMailCall('payment_status',{company_id:source,offset:amaPaymentOffset});if(session?.id!==owner||amaPaymentCompany!==source)return;feedback.textContent='';const rows=document.getElementById('amaPaymentListRows');rows.classList.add('ama-v18-group');rows.replaceChildren();
  for(const p of r.items||[]){const article=document.createElement('article');article.className='ama-payment-row';const title=document.createElement('strong');title.textContent=p.number+' · '+p.client_name;const info=document.createElement('p');info.textContent=p.payment_status==='paid'?'Payée':p.due_date&&p.total_cents!==null?'Échéance : '+dateFr(p.due_date)+' · solde : '+euro((Number(p.total_cents)-Number(p.paid_cents))/100):'Échéance ou montant à compléter';const b=document.createElement('button');b.type='button';b.textContent='Ouvrir le suivi';b.onclick=()=>void amaPaymentOpen(p.invoice_id,p.company_id);article.append(title,info,b);rows.append(article);}
  if(!rows.children.length)rows.textContent='Aucune facture envoyée à suivre sur cette page.';
  document.getElementById('amaPaymentPrev').disabled=!amaPaymentOffset;document.getElementById('amaPaymentNext').disabled=(r.items||[]).length<20;
 }catch(e){feedback.textContent=e.message;}
}
async function amaPaymentOpen(invoice,company){
 if(session?.role!=='admin')return;const owner=session.id;const dialog=document.getElementById('amaPaymentDialog');dialog.dataset.invoice=invoice;dialog.dataset.company=company;if(!dialog.open)dialog.showModal();document.getElementById('amaPaymentFeedback').textContent='Chargement…';amaPaymentInvoice=null;
 for(const id of ['amaPaymentYes','amaPaymentNo','amaPaymentLater'])document.getElementById(id).disabled=true;
 try{const r=await amaMailCall('payment_detail',{company_id:company,invoice_id:invoice});if(session?.id!==owner)return;amaPaymentInvoice=r.invoice;amaPaymentRequest=crypto.randomUUID();const p=r.invoice;
  document.getElementById('amaPaymentSummary').textContent=r.company+' · Facture '+p.number+' · '+r.client+' · échéance '+(p.due_date?dateFr(p.due_date):'à renseigner')+(p.total_cents!==null?' · solde '+euro(Math.max(0,Number(p.total_cents)-Number(p.paid_cents))/100):'');
  document.getElementById('amaPaymentRecipient').textContent='Destinataire de la facture : '+(r.to||'non renseigné');
  document.getElementById('amaPaymentSubject').value=r.subject;document.getElementById('amaPaymentMessage').value=r.message;document.getElementById('amaPaymentTemplateSubject').value=r.template.subject;document.getElementById('amaPaymentTemplateMessage').value=r.template.message;
  const missing=!p.due_date||p.total_cents===null;document.getElementById('amaPaymentMetadata').hidden=!missing||p.payment_status!=='unpaid';document.getElementById('amaPaymentDue').value=p.due_date||'';document.getElementById('amaPaymentTotal').value=p.total_cents===null?'':Number(p.total_cents)/100;document.getElementById('amaPaymentPaid').value=Number(p.paid_cents)/100;
  const blocked=(r.jobs||[]).some(j=>['queued','processing','uncertain','accepted'].includes(j.status));
  document.getElementById('amaPaymentYes').disabled=p.payment_status==='paid'||(r.jobs||[]).some(j=>j.status==='processing');document.getElementById('amaPaymentLater').disabled=missing||p.payment_status!=='unpaid'||blocked;
  document.getElementById('amaPaymentNo').disabled=missing||blocked||r.recipient_mismatch||p.payment_status!=='unpaid'||p.due_date>=amaRRToday()||Number(p.total_cents)<=Number(p.paid_cents);
  document.getElementById('amaPaymentFeedback').textContent=p.payment_status==='paid'?'Paiement enregistré. Aucune relance ne sera envoyée.':r.recipient_mismatch?'Le destinataire a changé : vérifier la facture avant toute relance.':blocked?'Une relance existe déjà. Consulte son état ci-dessous.':missing?'Complète le suivi à partir de la facture originale.':'Aucun envoi sans ta réponse Non. Si tu ne réponds pas, l’application attend.';
  const journal=document.getElementById('amaPaymentJournal');journal.replaceChildren();for(const j of r.jobs||[]){const line=document.createElement('p');line.textContent='Relance : '+({queued:'en attente',processing:'envoi en cours',accepted:'prise en charge par le service e-mail',failed:'non envoyée',uncertain:'à vérifier avant tout autre envoi',cancelled:'annulée'}[j.status]||j.status)+(j.error?' · '+j.error:'');journal.append(line);}
 }catch(e){document.getElementById('amaPaymentFeedback').textContent=e.message;}
}
async function amaPaymentDecide(decision){
 if(amaPaymentBusy||session?.role!=='admin'||!amaPaymentInvoice)return;amaPaymentBusy=true;const p=amaPaymentInvoice,owner=session.id;
 for(const id of ['amaPaymentYes','amaPaymentNo','amaPaymentLater'])document.getElementById(id).disabled=true;
 document.getElementById('amaPaymentFeedback').textContent=decision==='unpaid'?'Enregistrement de ta réponse et envoi de la relance…':'Enregistrement…';
 try{const r=await amaMailCall('payment_decide',{company_id:p.company_id,invoice_id:p.invoice_id,revision:p.revision,decision,request_id:amaPaymentRequest,subject:document.getElementById('amaPaymentSubject').value,message:document.getElementById('amaPaymentMessage').value});if(session?.id!==owner)return;
  await loadNotifications();renderNotifications();await amaPaymentOpen(p.invoice_id,p.company_id);
  document.getElementById('amaPaymentFeedback').textContent=decision==='paid'?'Paiement enregistré. Les rappels de cette facture sont arrêtés.':decision==='snooze'?'Tu recevras une nouvelle demande demain à partir de 9 h, heure de Paris.':r.status==='accepted'?'Relance et PDF original pris en charge par le service e-mail.':r.status==='uncertain'?'Envoi non confirmé : vérifie le prestataire avant toute nouvelle tentative.':r.status==='failed'?'Relance non envoyée : '+(r.error||'consulte le journal'):'Réponse enregistrée. Consulte le journal pour la confirmation d’envoi.';
 }catch(e){document.getElementById('amaPaymentFeedback').textContent='Résultat à vérifier : '+e.message+' Recharge le suivi avant toute nouvelle tentative.';}
 finally{amaPaymentBusy=false;}
}

// Connexions distinctes, réservées à la session administrateur existante.
const amaProviders={
 airbnb:{name:'Airbnb',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-2 0-3 3-4.4 5.8L3.5 17c-1.7 4 2.8 5 5.4 2.5 2-1.9 6.1-7.5 4.7-9.7-.8-1.2-2.4-1.2-3.2 0-1.4 2.2 2.7 7.8 4.7 9.7 2.6 2.5 7.1 1.5 5.4-2.5l-4.1-8.2C15 6 14 3 12 3Z"/></svg>'},
 gdf:{name:'Gîtes de France',icon:'<img src="./assets/images/gites-de-france.bba32fa24d73.png" alt="" width="40" height="40" class="ama-gdf-approved-icon">'}
};
const amaSyncIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 11.7-3L20 8M4 16l2.8 3A7 7 0 0 0 18.5 16"/></svg>';
let amaStayWeekStart='',amaStaySource='airbnb',amaStayView='queue',amaStayOffset=0,amaStayBusy=false,amaStayGeneration=0,amaSyncTimer=null,amaSyncInFlight=false,amaSyncPolling=false,amaSyncVersion=0;
const amaSyncDone=new Map();let amaSyncJobs=[];
function amaSyncButton(source){return '<button type="button" class="ama-sync" data-sync-source="'+source+'">'+amaSyncIcon+'<span>Synchroniser</span></button>';}
function amaStaySetup(){
 const queue=document.getElementById('amaRRQueue'),pane=document.getElementById('amaManage-imports');if(!queue||document.getElementById('amaStayTile-airbnb'))return;
 queue.classList.add('ama-three-providers');
 const rrCard=pane.querySelector('.ama-rr-console'),rrDetails=document.createElement('details');rrDetails.className='ama-provider';rrDetails.dataset.provider='rr';
 const rrIcon=queue.querySelector('.ama-rr-platform-icon').innerHTML;
 rrDetails.innerHTML='<summary><span class="ama-provider-icon" aria-hidden="true">'+rrIcon+'</span><span><strong>RentalReady</strong><small id="amaProviderHealth-rr">Connexion à vérifier</small></span><span class="ama-provider-chevron" aria-hidden="true">⌄</span></summary>';
 const rrBody=document.createElement('div');rrBody.className='ama-provider-body';rrCard.before(rrDetails);rrBody.append(rrCard);rrDetails.append(rrBody);
 rrDetails.addEventListener('toggle',()=>{if(rrDetails.open&&session?.role==='admin')void amaRRLoad();});
 for(const source of ['airbnb','gdf']){
  const cfg=amaProviders[source],tile=document.createElement('button');tile.id='amaStayTile-'+source;tile.type='button';tile.className='ama-rr-platform-tile';tile.setAttribute('aria-haspopup','dialog');tile.setAttribute('aria-controls','amaStayDialog');tile.setAttribute('aria-expanded','false');
  tile.innerHTML='<span class="ama-rr-platform-icon" aria-hidden="true">'+cfg.icon+'</span><span class="ama-rr-platform-name">'+cfg.name+'</span><span class="ama-rr-platform-count" id="amaStayCount-'+source+'">…</span><span class="ama-rr-platform-caption">À affecter</span>';queue.append(tile);tile.addEventListener('click',()=>amaStayOpen(source,'queue'));
  const d=document.createElement('details');d.className='ama-provider';d.dataset.provider=source;
  d.innerHTML='<summary><span class="ama-provider-icon" aria-hidden="true">'+cfg.icon+'</span><span><strong>'+cfg.name+'</strong><small id="amaProviderHealth-'+source+'">Connexion à vérifier</small></span><span class="ama-provider-chevron" aria-hidden="true">⌄</span></summary><div class="ama-provider-body"><div class="ama-provider-toolbar"><span>Connexion & imports</span>'+amaSyncButton(source)+'</div><p class="ama-provider-contact" id="amaProviderContact-'+source+'">Chargement…</p><label class="ama-provider-setting"><span><strong>Ajout automatique</strong><small>Logements associés uniquement</small></span><input type="checkbox" role="switch" id="amaProviderAuto-'+source+'" aria-label="Ajout automatique '+cfg.name+'"></label><p class="ama-rr-note">Les ménages reconnus arrivent dans Planning → À affecter. Tu choisis ensuite les intervenants.</p><div class="ama-rr-menu"><button type="button" data-stay-view="properties">Logements associés <span id="amaProviderMap-'+source+'">…</span> ›</button><button type="button" data-stay-view="pending">À vérifier / ajouter <span id="amaProviderReview-'+source+'">…</span> ›</button><button type="button" data-stay-view="history">Historique des séjours importés ›</button><button type="button" data-stay-view="past">Ménages passés <span id="amaProviderPast-'+source+'">…</span> ›</button></div><button type="button" class="primary ama-rr-openplan" data-stay-view="queue">Ouvrir le planning '+cfg.name+' →</button><details class="ama-rr-help ama-stay-cleanup"><summary>Filtre et nettoyage</summary><label class="ama-cleanup-check"><input type="checkbox" data-stay-filter> Filtrer les nouveaux séjours déjà passés</label><p>Les séjours futurs et les alertes en cours restent visibles.</p><label>Effacer les imports dont le départ est antérieur au <input type="date" data-stay-cutoff></label><label class="ama-cleanup-check"><input type="checkbox" data-stay-cancelled checked> Inclure les annulations passées</label><button type="button" data-stay-cleanup>Examiner le nettoyage</button><p>Missions, factures et e-mails conservés. Les imports liés à une mission et les annulations à venir sont protégés. Les annulations passées sont incluses si la case est cochée.</p></details><p class="ama-provider-feedback" id="amaProviderFeedback-'+source+'" role="status" aria-live="polite"></p></div>';
  d.querySelector('[data-stay-cutoff]').value=amaRRToday();d.querySelector('[data-stay-cutoff]').max=amaRRToday();
  d.querySelector('[data-stay-filter]').onchange=async e=>{const field=e.target;field.disabled=true;try{await amaStayRpc('ama_stay_set_filter',{p_source:source,p_enabled:field.checked});}catch(err){field.checked=!field.checked;document.getElementById('amaProviderFeedback-'+source).textContent=err.message;}finally{field.disabled=false;}};
  d.querySelector('[data-stay-cleanup]').onclick=()=>void amaStayCleanup(source,d);
  pane.append(d);d.addEventListener('toggle',()=>{if(d.open)void amaStayProviderLoad(source);});
  d.querySelector('[data-sync-source]').onclick=()=>void amaSyncRequest(source);
  d.querySelectorAll('[data-stay-view]').forEach(b=>b.onclick=()=>amaStayOpen(source,b.dataset.stayView));
  d.querySelector('#amaProviderAuto-'+source).onchange=async e=>{const field=e.target;field.disabled=true;try{await amaStayRpc('ama_stay_set_auto',{p_source:source,p_enabled:field.checked});await amaStayLoad();}catch(err){field.checked=!field.checked;document.getElementById('amaProviderFeedback-'+source).textContent=err.message;}finally{field.disabled=false;}};
 }
 const panel=document.createElement('dialog');panel.id='amaStayDialog';panel.className='ama-rr ama-rr-dialog ama-provider-dialog';panel.setAttribute('aria-labelledby','amaStayTitle');
 panel.innerHTML='<div class="ama-rr-sheet-handle" aria-hidden="true"><span></span></div><div class="ama-rr-row ama-rr-sheet-title"><div><h3 id="amaStayTitle"></h3><small id="amaStaySubtitle"></small></div><button type="button" data-stay-close aria-label="Fermer le panneau">✕</button></div><div class="ama-provider-dialog-tools"><select id="amaStayView" aria-label="Vue des imports"><option value="queue">À affecter</option><option value="pending">À vérifier / ajouter</option><option value="properties">Logements associés</option><option value="history">Historique des séjours</option><option value="past">Ménages passés</option></select><span id="amaStaySyncHost"></span></div><div id="amaStayWeekNav" class="ama-rr-weeknav"><button type="button" data-stay-week="prev" aria-label="Semaine précédente">‹</button><strong id="amaStayWeekLabel"></strong><button type="button" data-stay-week="next" aria-label="Semaine suivante">›</button></div><div id="amaStayWeekSummary" class="ama-rr-row ama-rr-weeksummary"><button type="button" data-stay-week="today">Cette semaine</button><span id="amaStayWeekTotal"></span></div><p id="amaStayFeedback" role="status" aria-live="polite"></p><div id="amaStayRows"></div><div class="ama-rr-toolbar"><button type="button" data-stay-prev>Précédent</button><span id="amaStayPages"></span><button type="button" data-stay-next>Suivant</button></div>';
 document.body.append(panel);panel.querySelector('[data-stay-close]').onclick=()=>panel.close();panel.addEventListener('close',()=>{amaStayGeneration++;document.body.classList.remove('ama-provider-modal-open');queue.querySelectorAll('[id^="amaStayTile-"]').forEach(b=>b.setAttribute('aria-expanded','false'));});
 panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close();}});
 panel.querySelectorAll('[data-stay-week]').forEach(b=>b.onclick=()=>{amaStayWeekStart=b.dataset.stayWeek==='today'?amaRRMonday(amaRRToday()):amaRRShift(amaStayWeekStart,b.dataset.stayWeek==='prev'?-7:7);amaStayOffset=0;void amaStayPanelLoad();});
 panel.querySelector('#amaStayView').onchange=e=>{amaStayView=e.target.value;amaStayOffset=0;void amaStayPanelLoad();};
 panel.querySelector('[data-stay-prev]').onclick=()=>{amaStayOffset=Math.max(0,amaStayOffset-20);void amaStayPanelLoad();};panel.querySelector('[data-stay-next]').onclick=()=>{amaStayOffset+=20;void amaStayPanelLoad();};
 let startY=null;const handle=panel.querySelector('.ama-rr-sheet-handle');handle.addEventListener('pointerdown',e=>{startY=e.clientY;handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointerup',e=>{if(startY!==null&&e.clientY-startY>70)panel.close();startY=null;});
 const app=document.getElementById('app');if(app)new MutationObserver(()=>{if(app.hidden){amaStayGeneration++;panel.close();document.getElementById('amaMissionDialog')?.close();panel.querySelector('#amaStayRows').replaceChildren();amaSyncJobs=[];amaSyncDone.clear();clearTimeout(amaSyncTimer);amaSyncTimer=null;}else if(session?.role==='admin'){void amaStayLoad();void amaSyncPoll();}}).observe(app,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='admin'){void amaStayLoad();void amaSyncPoll();}});
}
async function amaStayRpc(fn,args){if(session?.role!=='admin')throw Error('Accès administrateur requis');const r=await client.rpc(fn,args);if(r.error)throw r.error;return r.data;}
async function amaStayProviderLoad(source){
 if(session?.role!=='admin')return;const owner=session.id;
 try{const r=await amaStayRpc('ama_stay_console',{p_source:source,p_view:'queue',p_offset:0});if(session?.id!==owner||session?.role!=='admin')return;
  document.getElementById('amaStayCount-'+source).textContent=r.queue_count;
  const recent=r.last_success&&Date.now()-Date.parse(r.last_success)<(source==='airbnb'?35:10)*60000;
  document.getElementById('amaProviderHealth-'+source).textContent=recent?'● À jour':r.last_success?'● Dernier contact à vérifier':'● En attente de connexion';
  document.getElementById('amaProviderContact-'+source).textContent=r.last_success?'Dernière synchronisation : '+new Date(r.last_success).toLocaleString('fr-FR')+' · '+r.retained_count+' séjour(s) conservé(s).':'Aucune synchronisation reçue.';
  amaV6Health?.(source,r.last_success);document.getElementById('amaProviderAuto-'+source).checked=!!r.auto_enabled;document.querySelector('[data-provider="'+source+'"] [data-stay-filter]').checked=r.filter_past!==false;document.getElementById('amaProviderMap-'+source).textContent=(r.properties||[]).filter(p=>p.apartment_id).length;
  document.getElementById('amaProviderReview-'+source).textContent=Number(r.review_count)+Number(r.error_count);document.getElementById('amaProviderPast-'+source).textContent=r.past_count;
 }catch(e){if(session?.id===owner){amaV6Health?.(source,null,true);document.getElementById('amaStayCount-'+source).textContent='!';document.getElementById('amaProviderFeedback-'+source).textContent='Connexion indisponible : '+e.message;}}
}
async function amaStayLoad(){if(!document.getElementById('amaStayTile-airbnb')||session?.role!=='admin')return;await Promise.all([amaStayProviderLoad('airbnb'),amaStayProviderLoad('gdf')]);}
function amaStayOpen(source,view){
 if(session?.role!=='admin')return;amaStaySource=source;amaStayView=view;amaStayOffset=0;if(!amaStayWeekStart)amaStayWeekStart=amaRRMonday(amaRRToday());
 const p=document.getElementById('amaStayDialog');document.getElementById('amaStayTitle').textContent=amaProviders[source].name;document.getElementById('amaStayView').value=view;
 const host=document.getElementById('amaStaySyncHost');host.innerHTML=amaSyncButton(source);host.querySelector('button').onclick=()=>void amaSyncRequest(source);
 if(!p.open)p.showModal();document.body.classList.add('ama-provider-modal-open');document.getElementById('amaStayTile-'+source).setAttribute('aria-expanded','true');amaSyncPaint();void amaStayPanelLoad();
}
async function amaStayPanelLoad(){
 if(session?.role!=='admin')return;const generation=++amaStayGeneration,owner=session.id,source=amaStaySource,view=amaStayView,panel=document.getElementById('amaStayDialog'),feedback=document.getElementById('amaStayFeedback');feedback.textContent='Chargement…';
 try{const r=await amaStayRpc('ama_stay_console',{p_source:source,p_view:view,p_offset:amaStayOffset,p_start:view==='queue'?amaStayWeekStart:null});if(generation!==amaStayGeneration||session?.id!==owner||!panel.open)return;
  panel.classList.toggle('ama-stay-queue-mode',view==='queue');panel.querySelector('.ama-provider-dialog-tools').hidden=view==='queue';document.getElementById('amaStayWeekSummary').hidden=view!=='queue';
  feedback.textContent='';document.getElementById('amaStayWeekNav').hidden=view!=='queue';document.getElementById('amaStayWeekLabel').textContent=amaStayDateLabel(amaStayWeekStart)+' – '+amaStayDateLabel(amaRRShift(amaStayWeekStart,6));document.getElementById('amaStaySubtitle').textContent=({queue:'Ménages à affecter',pending:'Éléments à vérifier',properties:'Correspondance avec les logements AMA',history:'Dernier état de chaque séjour importé',past:'Départs passés'})[view];
  const rows=document.getElementById('amaStayRows');rows.replaceChildren();
  const cleaner=document.getElementById('amaV9StayClean');if(cleaner)cleaner.hidden=!['past','history'].includes(view);if(view==='properties')for(const prop of r.properties||[]){const card=document.createElement('article');card.className='ama-stay-card';const label=document.createElement('label');label.textContent=prop.label;const select=document.createElement('select');select.add(new Option('Choisir un logement',''));for(const a of activeApartments())select.add(new Option(a.name,a.id));select.value=prop.apartment_id||'';const b=document.createElement('button');b.type='button';b.textContent='Enregistrer l’association';b.onclick=()=>void amaStayMutation(b,'ama_stay_map',{p_code:prop.code,p_apartment:select.value});label.append(select);card.append(label,b);rows.append(card);}
  if(view==='pending')for(const error of r.errors||[]){const card=document.createElement('article');card.className='ama-stay-card';const text=document.createElement('p');text.textContent=new Date(error.received_at).toLocaleDateString('fr-FR')+' · '+error.error;const b=document.createElement('button');b.type='button';b.textContent='Classer après vérification dans Gmail';b.onclick=()=>void amaStayMutation(b,'ama_stay_error_done',{p_key:error.key});card.append(text,b);rows.append(card);}
  if(view!=='properties'){let lastDay='';for(const stay of r.items||[]){if(view==='queue'&&stay.end_date!==lastDay){const heading=document.createElement('h4');heading.className='ama-rr-day';heading.textContent=new Date(stay.end_date+'T12:00:00Z').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short',timeZone:'Europe/Paris'});rows.append(heading);lastDay=stay.end_date;}amaStayRow(rows,stay,view);}}
  document.getElementById('amaStayWeekTotal').textContent=Number(r.total||0)+' ménage(s) · '+Number(r.week_hours||0).toLocaleString('fr-FR')+' h';
  if(!rows.children.length){const empty=document.createElement('p');empty.className='ama-stay-empty';empty.textContent=view==='queue'?'Aucun ménage à affecter ni alerte pour cette semaine. Utilise les flèches pour changer de semaine.':'Aucun élément dans cette vue.';rows.append(empty);}
  const toolbar=panel.querySelector('.ama-rr-toolbar');toolbar.hidden=view==='properties';document.getElementById('amaStayPages').textContent=r.total+' séjour(s) · page '+(1+amaStayOffset/20);panel.querySelector('[data-stay-prev]').disabled=!amaStayOffset;panel.querySelector('[data-stay-next]').disabled=amaStayOffset+20>=r.total;
 }catch(e){if(generation===amaStayGeneration)feedback.textContent='Chargement refusé : '+e.message;}
}
function amaStayRow(rows,s,view){
 const card=document.createElement('article');card.className='ama-stay-card';card.dataset.workApartment=s.apartment_id||'';card.dataset.workDay=s.end_date;card.dataset.workHours=Number(s.duration||0);const title=document.createElement('h4');title.textContent=s.name||s.label||'Logement à vérifier';const dates=document.createElement('p');dates.className='ama-stay-dates';dates.textContent=dateFr(s.start_date)+' → '+dateFr(s.end_date)+' · ménage le '+dateFr(s.end_date);const note=document.createElement('p');note.className='ama-stay-note';note.textContent=s.issue||(s.dismissed?'Classé':s.mission_id?'Mission liée · '+({planned:'À réaliser',done:'Réalisée',cancelled:'Annulée'}[s.mission_status]||s.mission_status||'à vérifier'):{active:s.queued?'À affecter':s.apartment_id?'À ajouter au planning':'Logement non associé',cancelled:'Annulation reçue',missing:'Séjour disparu du calendrier'}[s.state]);card.append(title,dates,note);
 if(s.source==='gdf'&&s.external_references?.length){const ref=document.createElement('small');ref.textContent=s.external_references.filter(x=>!x.startsWith('stay:')).join(' · ');card.append(ref);}
 const actions=document.createElement('div');actions.className='ama-stay-actions';
 const action=(text,fn,kind,worker)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>{if(kind==='cancel_mission'&&!confirm('Annuler la mission planifiée liée à ce séjour ?'))return;if(kind==='link'&&!confirm('Lier ce séjour à la mission déjà présente pour ce logement et ce jour ?'))return;void amaStayMutation(b,fn,{p_id:s.id,p_revision:s.revision,p_action:kind,...(fn==='ama_stay_action'?{p_worker:worker?worker.value:null,v6_apartment:s.apartment_id,v6_date:s.end_date,v6_hours:s.duration}:{})});};actions.append(b);};
 const future=s.end_date>=amaRRToday();
 if(view==='queue'&&s.state==='active'&&!s.issue&&!s.mission_id&&!s.dismissed&&s.apartment_id&&future){const label=document.createElement('label');label.textContent='Intervenant';const select=document.createElement('select');select.add(new Option('Choisir un intervenant',''));for(const w of activeWorkers())select.add(new Option(w.name||'Intervenant',w.id));label.append(select);card.append(label);action('Affecter','ama_stay_action','assign',select);action('Lier à une mission existante','ama_stay_action','link');}
 if(view==='pending'&&s.state==='active'&&!s.issue&&!s.mission_id&&!s.dismissed&&s.apartment_id&&future)action('Ajouter dans À affecter','ama_stay_review','queue');
 if(s.mission_id&&['cancelled','missing'].includes(s.state)&&s.mission_status==='planned'&&future)action('Annuler la mission liée','ama_stay_action','cancel_mission');
 if(s.dismissed&&!s.mission_id&&future)action('Réexaminer','ama_stay_review','restore');else if(!s.dismissed&&(view==='queue'||view==='pending'))action(s.issue||s.state!=='active'?'Classer après vérification':'Ignorer ce séjour','ama_stay_action','dismiss');
 card.append(actions);
 if(view==='queue'){
  card.className='ama-rr-item ama-rr-compact ama-rr-assigned';
  const details=document.createElement('details');details.className='ama-rr-detail';const summary=document.createElement('summary');
  const main=document.createElement('div');main.className='ama-rr-line-main';const name=document.createElement('strong');name.textContent=s.name||s.label||'Logement à vérifier';const pill=document.createElement('span');pill.className='ama-rr-pill';pill.textContent=s.issue?'À vérifier':s.state==='cancelled'?'Annulation reçue':'À affecter';main.append(name,pill);
  const sub=document.createElement('span');sub.className='ama-rr-line-sub';sub.textContent=s.duration?Number(s.duration).toLocaleString('fr-FR')+' h':'Durée à renseigner';summary.append(main,sub);
  const expanded=document.createElement('div');expanded.className='ama-rr-expanded';while(card.firstChild)expanded.append(card.firstChild);expanded.querySelector('h4')?.remove();
  const select=expanded.querySelector('select');const assign=expanded.querySelector('.ama-stay-actions button');
  if(select&&assign){const label=select.parentElement;const line=document.createElement('div');line.className='ama-rr-assignline';select.setAttribute('aria-label','Intervenant');line.append(select,assign);label.replaceWith(line);assign.classList.add('primary');}
  details.append(summary,expanded);card.append(details);
 }
 rows.append(card);
}
async function amaStayMutation(button,fn,args){
 if(amaStayBusy||session?.role!=='admin')return;amaStayBusy=true;button.disabled=true;
 try{if(args.p_action==='assign')await amaV8Guard(args.v6_apartment,args.v6_date);if(args.p_action==='assign'&&!await amaV6CheckWorkload(args.p_worker,args.v6_date,args.v6_hours))return;const {v6_apartment,v6_date,v6_hours,...rpcArgs}=args;await amaStayRpc(fn,rpcArgs);await reload();if(session)render();await amaStayLoad();await amaStayPanelLoad();}
 catch(e){document.getElementById('amaStayFeedback').textContent='Action refusée : '+e.message;}
 finally{amaStayBusy=false;button.disabled=false;}
}
function amaSyncPaint(){amaNetworkPaint();amaV6PaintHealth?.();
 for(const b of document.querySelectorAll('[data-sync-source]')){
  const job=amaSyncJobs.find(j=>j.source===b.dataset.syncSource),state=job?.state||'idle';const busy=state==='requested'||state==='running';b.disabled=busy;b.dataset.syncState=state;b.setAttribute('aria-busy',String(busy));
  const fresh=state==='succeeded'&&Date.now()-Date.parse(job.finished_at)<60000;
  const label=state==='requested'?'Demande envoyée':state==='running'?'Synchronisation…':state==='failed'?'Réessayer':fresh?'À jour':'Synchroniser';
  b.innerHTML=(fresh?'<span class="ama-sync-check" aria-hidden="true">✓</span>':amaSyncIcon)+'<span>'+label+'</span>';
  b.title=state==='requested'?'La demande sera prise en charge par le connecteur Google.':state==='failed'?job.error||'Réessayer':state==='succeeded'?'Collecte confirmée le '+new Date(job.finished_at).toLocaleString('fr-FR'):'Demander une nouvelle collecte';
 }
 for(const job of amaSyncJobs){const line=document.getElementById(job.source==='rr'?'amaRRFeedback':'amaProviderFeedback-'+job.source);if(!line)continue;if(job.state==='requested')line.textContent='Demande transmise · en attente du connecteur Google.';else if(job.state==='running')line.textContent='Le connecteur récupère les nouvelles données…';else if(job.state==='failed')line.textContent=job.error||'Synchronisation non confirmée : réessayer.';}
}
async function amaSyncRequest(source){
 if(session?.role!=='admin'||amaSyncInFlight)return;amaSyncInFlight=true;amaSyncVersion++;const owner=session.id;
 try{const job=await amaStayRpc('ama_sync_request',{p_source:source});if(session?.id!==owner)return;amaSyncJobs=amaSyncJobs.filter(x=>x.source!==source).concat(job);amaSyncPaint();void amaSyncPoll();}
 catch(e){if(session?.id===owner){amaNetworkErrors.set(source,Date.now());amaNetworkPaint();}const target=document.getElementById(source==='rr'?'amaRRFeedback':'amaProviderFeedback-'+source);if(target)target.textContent='Demande refusée : '+e.message;if(document.getElementById('amaStayDialog')?.open&&amaStaySource===source)document.getElementById('amaStayFeedback').textContent='Demande refusée : '+e.message;}
 finally{amaSyncInFlight=false;amaNetworkPaint();}
}
async function amaSyncPoll(){
 if(amaSyncPolling)return;clearTimeout(amaSyncTimer);amaSyncTimer=null;if(session?.role!=='admin')return;amaSyncPolling=true;const owner=session.id,version=amaSyncVersion;
 try{const jobs=await amaStayRpc('ama_sync_status',{});if(session?.id!==owner||session?.role!=='admin'){amaSyncPolling=false;return;}if(version!==amaSyncVersion){amaSyncPolling=false;amaSyncTimer=setTimeout(()=>void amaSyncPoll(),1000);return;}amaSyncJobs=jobs||[];
  for(const j of amaSyncJobs)if(j.state==='succeeded'&&amaSyncDone.get(j.source)!==j.job_id){amaSyncDone.set(j.source,j.job_id);if(j.source==='rr'){await amaRRLoad();await amaRRQueueLoad();}else{await amaStayProviderLoad(j.source);if(document.getElementById('amaStayDialog').open&&amaStaySource===j.source)await amaStayPanelLoad();}}
  amaSyncPaint();
 }catch(e){for(const b of document.querySelectorAll('[data-sync-source][aria-busy="true"]')){b.disabled=false;b.title='État non confirmé : réessayer la lecture';}}
 amaSyncPolling=false;
 if(session?.id===owner&&session?.role==='admin')amaSyncTimer=setTimeout(()=>void amaSyncPoll(),document.hidden?30000:amaSyncJobs.some(j=>['requested','running'].includes(j.state))?4000:30000);
}

function amaStayDateLabel(day){return new Date(day+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'});}
async function amaStayCleanup(source,provider){
 if(amaStayBusy||session?.role!=='admin')return;const button=provider.querySelector('[data-stay-cleanup]'),feedback=document.getElementById('amaProviderFeedback-'+source);
 amaStayBusy=true;button.disabled=true;
 try{
  const args={p_source:source,p_apply:false,p_before:provider.querySelector('[data-stay-cutoff]').value,p_include_cancelled:provider.querySelector('[data-stay-cancelled]').checked};
  const preview=await amaStayRpc('ama_stay_cleanup',args);const count=Number(preview.eligible||0);
  if(!count){feedback.textContent='Aucun import passé éligible. '+Number(preview.preserved||0)+' import(s) protégé(s).';return;}
  feedback.textContent=count+' import(s) passé(s) peuvent être effacés. '+Number(preview.preserved||0)+' import(s) protégé(s).';
  if(!confirm('Effacer '+count+' import(s) '+amaProviders[source].name+' dont le départ est antérieur au '+dateFr(args.p_before)+' ? Les missions, factures et e-mails sont conservés. Les annulations passées cochées sont incluses.'))return;
  const result=await amaStayRpc('ama_stay_cleanup',{...args,p_apply:true});await amaStayProviderLoad(source);await amaV6Refresh(true);if(document.getElementById('amaStayDialog').open&&amaStaySource===source)await amaStayPanelLoad();
  feedback.textContent=Number(result.deleted||0)+' import(s) effacé(s). Références minimales conservées contre la réimportation.';
 }catch(e){feedback.textContent='Nettoyage refusé : '+e.message;}finally{amaStayBusy=false;button.disabled=false;}
}

// RentalReady V2 : imports compacts et réserve admin du planning.
let amaRRPage=0,amaRRView='pending',amaRRRows=[],amaRRTotal=0,amaRRGeneration=0,amaRRBusy=false;
let amaRRSelected=new Set(),amaRRQueuePage=0,amaRRQueueTotal=0,amaRRQueueGeneration=0,amaRRConsoleGeneration=0;
let amaRRWeekStart='',amaRRQueueSnapshot='',amaRRAutoEnabled=false;
function amaRRClear(){
 amaRRGeneration++;amaRRQueueGeneration++;amaRRConsoleGeneration++;amaRRQueueSnapshot='';document.getElementById('amaRRDialog')?.close();document.getElementById('amaRRInspector')?.close();amaRRRows=[];amaRRSelected.clear();amaRRTotal=0;amaRRPage=0;
 document.getElementById('amaRRList')?.replaceChildren();document.getElementById('amaRRQueueList')?.replaceChildren();
 const queue=document.getElementById('amaRRQueue');if(queue){delete queue.dataset.rrSnapshot;queue.hidden=true;const panel=document.getElementById('amaRRQueuePanel');if(panel)panel.hidden=true;queue.querySelector('.ama-rr-platform-tile')?.setAttribute('aria-expanded','false');}
 const feedback=document.getElementById('amaRRFeedback');if(feedback)feedback.textContent='';
}
function amaRRKey(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function amaRRSuggestion(row){
 const key=amaRRKey(String(row.property_name||'').replace(/\s+\d+\s*$/,''));
 const matches=activeApartments().filter(a=>amaRRKey(a.name)===key);
 return matches.length===1?matches[0]:null;
}
function amaRRFeedback(text){const el=document.getElementById('amaRRFeedback');el.textContent=text;el.scrollIntoView({block:'nearest',behavior:'smooth'});}
function amaRRSelection(){
 const n=amaRRSelected.size;document.getElementById('amaRRSelection').textContent=n+' ménage'+(n>1?'s':'')+' sélectionné'+(n>1?'s':'');
 document.getElementById('amaRRBatch').disabled=!n||amaRRBusy;document.getElementById('amaRRBatch').textContent='Ajouter ('+n+')';document.querySelector('.ama-rr-batch').hidden=amaRRView!=='pending'||!n;
 const boxes=[...document.querySelectorAll('#amaRRList [data-rr-check]')];
 const all=document.getElementById('amaRRSelectAll');all.checked=boxes.length>0&&boxes.every(b=>b.checked);all.indeterminate=boxes.some(b=>b.checked)&&!all.checked;
}
function amaRRSetup(){
 const pane=document.getElementById('amaManage-imports');
 pane.innerHTML=`<div class="card ama-rr ama-rr-console"><div class="ama-rr-row"><div><h3>RentalReady</h3><small id="amaRRHealth">Connexion à vérifier</small></div><button type="button" class="ama-sync" data-sync-source="rr" data-rr="refresh">Synchroniser</button></div><p id="amaRRConnection" class="muted"></p><label class="ama-rr-setting"><span><strong>Ajout automatique</strong><small>Logements associés uniquement</small></span><input type="checkbox" role="switch" id="amaRRAuto" aria-label="Ajout automatique des ménages"></label><p class="ama-rr-note">Les ménages reconnus arrivent dans Planning → À affecter. Tu choisis ensuite les intervenants.</p><div class="ama-rr-menu"><button type="button" data-rr="open-properties">Logements associés <span id="amaRRMapCount">…</span> ›</button><button type="button" data-rr="open-pending">À vérifier / ajouter <span id="amaRRReviewCount">…</span> ›</button><button type="button" data-rr="open-history">Historique des imports ›</button><button type="button" data-rr="open-past">Ménages passés <span id="amaRRPastCount">…</span> ›</button></div><button type="button" class="primary ama-rr-openplan" data-rr="open-plan">Ouvrir le planning RentalReady →</button><details class="ama-rr-help ama-stay-cleanup"><summary>Filtre et nettoyage</summary><label class="ama-cleanup-check"><input type="checkbox" checked disabled> Filtrer les nouvelles affectations déjà passées</label><p>Filtre permanent RentalReady. Les missions futures et les alertes en cours restent visibles.</p><label>Effacer les imports dont la date est antérieure au <input type="date" id="amaRRCutoff"></label><label class="ama-cleanup-check"><input type="checkbox" id="amaRRCancelled" checked> Inclure les annulations passées</label><button type="button" data-rr="cleanup">Examiner le nettoyage</button><p>Missions, factures et e-mails conservés. Les imports liés à une mission et les annulations à venir sont protégés. Les annulations passées sont incluses si la case est cochée.</p></details><p id="amaRRFeedback" role="status" aria-live="polite"></p><dialog id="amaRRInspector" class="ama-rr ama-rr-dialog ama-provider-dialog" aria-labelledby="amaRRInspectorTitle"><div class="ama-rr-sheet-handle" aria-hidden="true"><span></span></div><div class="ama-rr-row ama-rr-sheet-title"><div><h3 id="amaRRInspectorTitle">RentalReady</h3><small id="amaRRInspectorSubtitle">Historique des imports</small></div><button type="button" data-rr="close-inspector" aria-label="Fermer">✕</button></div><div class="ama-provider-dialog-tools"><select id="amaRRInspectorView" aria-label="Vue RentalReady"><option value="history">Historique des imports</option><option value="pending">À vérifier / ajouter</option><option value="properties">Logements associés</option><option value="past">Ménages passés</option></select><button type="button" class="ama-sync" data-sync-source="rr" data-rr="refresh">Synchroniser</button></div><div class="ama-rr-tabs" hidden><button type="button" data-rr="pending">À vérifier</button><button type="button" data-rr="history">Historique</button></div><button type="button" data-rr="past" id="amaRRPast" hidden>Ménages passés</button><div id="amaRRSelectToolbar" class="ama-rr-row"><label class="ama-rr-checklabel"><input type="checkbox" id="amaRRSelectAll"> Tout sélectionner</label></div><div id="amaRRList"></div><div class="ama-rr-toolbar"><button type="button" data-rr="prev">Précédent</button><span id="amaRRPageLabel"></span><button type="button" data-rr="next">Suivant</button></div><div class="ama-rr-batch" hidden><div><strong id="amaRRSelection">0 ménage sélectionné</strong><small>Dates des mails · Affectation ensuite</small></div><button type="button" class="primary" data-rr="batch" id="amaRRBatch" disabled>Ajouter au planning</button></div></dialog></div>`;
 document.getElementById('amaRRCutoff').value=amaRRToday();document.getElementById('amaRRCutoff').max=amaRRToday();
 const inspector=document.getElementById('amaRRInspector');inspector.addEventListener('close',()=>document.body.classList.remove('ama-provider-modal-open'));inspector.addEventListener('click',e=>{if(e.target===inspector){const r=inspector.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)inspector.close();}});
 document.getElementById('amaRRInspectorView').onchange=e=>{amaRRView=e.target.value;amaRRPage=0;void amaRRLoad();};
 const planning=document.getElementById('tab-planning');
 const queue=document.createElement('div');queue.id='amaRRQueue';queue.className='ama-rr ama-rr-platforms';queue.hidden=true;
 queue.innerHTML=`<button type="button" class="ama-rr-platform-tile" data-rrq="toggle" aria-expanded="false" aria-controls="amaRRDialog"><span class="ama-rr-platform-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="M1 11A10 10 0 0 1 11 1v10ZM13 1a10 10 0 0 1 10 10H13ZM1 13h10v10H1ZM13 13a10 10 0 0 1 10 10H13Z"/></svg></span><span class="ama-rr-platform-name">RentalReady</span><span class="ama-rr-platform-count" id="amaRRQueueTileCount">…</span><span class="ama-rr-platform-caption">À affecter</span></button>`;
 const dialog=document.createElement('dialog');dialog.id='amaRRDialog';dialog.className='ama-rr ama-rr-dialog';dialog.setAttribute('aria-labelledby','amaRRDialogTitle');
 dialog.innerHTML=`<div class="ama-rr-sheet-handle" aria-hidden="true"><span></span></div><div class="ama-rr-row ama-rr-sheet-title"><div><h3 id="amaRRDialogTitle">RentalReady</h3><small>Ménages à affecter</small></div><button type="button" data-rrq="close" aria-label="Fermer le panneau">✕</button></div><div class="ama-rr-weeknav"><button type="button" data-rrq="week-prev" aria-label="Semaine précédente">‹</button><strong id="amaRRWeekLabel"></strong><button type="button" data-rrq="week-next" aria-label="Semaine suivante">›</button></div><div class="ama-rr-row ama-rr-weeksummary"><button type="button" data-rrq="week-today">Cette semaine</button><span id="amaRRWeekTotal"></span><span id="amaRRWeekAlerts"></span></div><p id="amaRRQueueFeedback" role="status" aria-live="polite"></p><div id="amaRRQueueList"></div><div class="ama-rr-toolbar"><button type="button" data-rrq="prev">Précédent</button><span id="amaRRQueueCount"></span><button type="button" data-rrq="next">Suivant</button></div><p class="ama-rr-note">Heures des logements AMA · Annulations à confirmer séparément.</p>`;
 document.body.append(dialog);
 dialog.addEventListener('close',()=>{document.body.classList.remove('ama-rr-modal-open');queue.querySelector('.ama-rr-platform-tile').setAttribute('aria-expanded','false');});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
 let dragY=null;const handle=dialog.querySelector('.ama-rr-sheet-handle');handle.addEventListener('pointerdown',e=>{dragY=e.clientY;handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointerup',e=>{if(dragY!==null&&e.clientY-dragY>60)dialog.close();dragY=null;});

 planning.querySelector('.ama-planning-heading').after(queue);
 document.getElementById('tab-admin').addEventListener('change',async e=>{
  if(e.target.id==='amaRRAuto'){
   if(session?.role!=='admin'||amaRRBusy){e.target.checked=amaRRAutoEnabled;return;}
   amaRRBusy=true;e.target.disabled=true;
   try{const r=await client.rpc('ama_rr_set_auto',{p_enabled:e.target.checked});if(r.error)throw r.error;await amaRRLoad();void amaRRQueueLoad();amaRRFeedback('Réglage enregistré. '+Number(r.data||0)+' ménage(s) ajouté(s) dans À affecter.');}
   catch(error){e.target.checked=amaRRAutoEnabled;amaRRFeedback('Réglage refusé : '+error.message);}
   finally{amaRRBusy=false;e.target.disabled=false;}return;
  }

  if(e.target.id==='amaRRSelectAll')document.querySelectorAll('#amaRRList [data-rr-check]').forEach(b=>{b.checked=e.target.checked;if(b.checked)amaRRSelected.add(b.dataset.rrCheck);else amaRRSelected.delete(b.dataset.rrCheck);});
  else if(e.target.matches('[data-rr-check]')){if(e.target.checked)amaRRSelected.add(e.target.dataset.rrCheck);else amaRRSelected.delete(e.target.dataset.rrCheck);}
  amaRRSelection();
 });
 document.getElementById('tab-admin').addEventListener('click',async e=>{
  const button=e.target.closest('[data-rr]');if(!button||session?.role!=='admin'||amaRRBusy)return;
  const action=button.dataset.rr;
  if(action==='refresh'){await amaSyncRequest('rr');return;}
  if(action==='open-plan'){setTab('planning');amaRROpenSheet();return;}
  if(action==='close-inspector'){document.getElementById('amaRRInspector').close();return;}
  if(action.startsWith('open-')){amaRRView=action.slice(5);amaRRPage=0;document.getElementById('amaRRInspectorView').value=amaRRView;document.getElementById('amaRRInspector').showModal();document.body.classList.add('ama-provider-modal-open');await amaRRLoad();return;}
  if(action==='cleanup'){
   amaRRBusy=true;button.disabled=true;
   try{const args={p_apply:false,p_before:document.getElementById('amaRRCutoff').value,p_include_cancelled:document.getElementById('amaRRCancelled').checked};const preview=await client.rpc('ama_rr_cleanup_v5',args);if(preview.error)throw preview.error;
    const n=Number(preview.data?.eligible||0);if(!n){amaRRFeedback('Aucun import passé éligible. Les alertes et actions en cours sont conservées.');return;}
    if(!confirm(n+' fiche(s) d’import passé éligibles. Supprimer ces fiches ? Missions AMA, factures et mails Gmail conservés. Les annulations passées cochées sont incluses.'))return;
    const r=await client.rpc('ama_rr_cleanup_v5',{...args,p_apply:true});if(r.error)throw r.error;await amaRRLoad();await amaV6Refresh(true);amaRRFeedback(Number(r.data?.deleted||0)+' fiche(s) d’import passé supprimée(s). Références minimales conservées contre les doublons.');
   }catch(error){amaRRFeedback('Nettoyage refusé : '+error.message);}finally{amaRRBusy=false;button.disabled=false;}return;
  }

  if(['pending','history','past','refresh','prev','next'].includes(action)){
   if(['pending','history','past'].includes(action)){amaRRView=action==='past'&&amaRRView==='past'?'pending':action;amaRRPage=0;}
   if(action==='prev')amaRRPage=Math.max(0,amaRRPage-1);
   if(action==='next'&&(amaRRPage+1)*20<amaRRTotal)amaRRPage++;
   await amaRRLoad();return;
  }
  const card=button.closest('[data-rr-message]');
  const row=card&&amaRRRows.find(x=>x.message_id===card.dataset.rrMessage);
  if(action!=='batch'&&!row)return;
  amaRRBusy=true;button.disabled=true;
  try{
   let message='Import traité.';
   if(action==='batch'){
    const ids=[...amaRRSelected];if(!ids.length)throw Error('Sélectionne au moins un ménage.');
    const r=await client.rpc('ama_rr_queue_add',{p_messages:ids});if(r.error)throw r.error;
    const results=r.data||[],ok=results.filter(x=>x.ok),failed=results.filter(x=>!x.ok);
    message=ok.length+' ménage(s) ajouté(s) dans Planning → À affecter.';
    if(failed.length)message+=' '+failed.length+' refusé(s) : '+failed.map(x=>x.error).join(' · ');
   }else if(action==='restore'){const r=await client.rpc('ama_rr_restore',{p_message:row.message_id});if(r.error)throw r.error;message='Import réactivé.';
   }else if(action==='map'){
    const apartment=card.querySelector('[data-rr-apartment]').value;if(!apartment)throw Error('Choisis le logement AMA correspondant.');
    const r=await client.rpc('ama_rr_map',{p_property:row.external_property_id,p_apartment:apartment});if(r.error)throw r.error;
    message='Association mémorisée pour les prochains mails de ce logement.';
   }else if(action==='queue_cancel'){
    if(!confirm('Confirmer le retrait de ce ménage de la liste À affecter ?'))return;
    const r=await client.rpc('ama_rr_queue_action',{p_external:row.external_mission_id,p_action:'cancel',p_worker:null});if(r.error)throw r.error;
    message='Ménage retiré de la liste À affecter.';
   }else{
    if(action==='cancel'&&!confirm('Confirmer l’annulation de cette mission planifiée ? Son historique sera conservé.'))return;
    const existing=card.querySelector('[data-rr-existing]')?.value||null;
    if((action==='link'||action==='link_cancel')&&!existing)throw Error('Choisis la mission existante.');
    const r=await client.rpc('ama_rr_decide',{p_message:row.message_id,p_action:action,p_worker:null,p_existing:existing});if(r.error)throw r.error;
    if(action==='link_cancel')message='Mission associée. Confirme séparément son annulation si nécessaire.';
    await reload();await loadFinances();render();
   }
   await amaRRLoad();void amaRRQueueLoad();amaRRFeedback(message);
  }catch(error){amaRRFeedback('Action refusée : '+error.message);}
  finally{amaRRBusy=false;if(button.isConnected)button.disabled=false;amaRRSelection();}
 });
 const queueClick=async e=>{
  const button=e.target.closest('[data-rrq]');if(!button||session?.role!=='admin'||amaRRBusy)return;
  const action=button.dataset.rrq;
  if(action==='toggle'){amaRROpenSheet();return;}
  if(action==='close'){dialog.close();return;}
  if(['week-prev','week-next','week-today'].includes(action)){
   amaRRWeekStart=action==='week-today'?amaRRMonday(amaRRToday()):amaRRShift(amaRRWeekStart,action==='week-prev'?-7:7);
   amaRRQueuePage=0;amaRRQueueSnapshot='';await amaRRQueueLoad();return;
  }
  if(['refresh','prev','next'].includes(action)){
   if(action==='prev')amaRRQueuePage=Math.max(0,amaRRQueuePage-1);
   if(action==='next'&&(amaRRQueuePage+1)*20<amaRRQueueTotal)amaRRQueuePage++;
   await amaRRQueueLoad();return;
  }
  const card=button.closest('[data-rr-external]');if(!card)return;
  const feedback=document.getElementById('amaRRQueueFeedback');amaRRBusy=true;button.disabled=true;
  try{
   const worker=card.querySelector('[data-rrq-worker]')?.value||null;
   if(action==='assign'&&!worker)throw Error('Choisis un intervenant.');
   if(action==='assign')await amaV8Guard(card.dataset.workApartment,card.dataset.workDay);if(action==='assign'&&!await amaV6CheckWorkload(worker,card.dataset.workDay,Number(card.dataset.workHours)))return;
   if(action==='remove'&&!confirm('Retirer ce ménage de À affecter et ignorer cet import ? Il ne sera plus ajouté automatiquement.'))return;
   if(action==='cancel'&&!confirm('Confirmer le retrait du ménage annulé de À affecter ?'))return;
   let r;
   if(action==='mission-cancel'||action==='mission-keep'){
    if(action==='mission-cancel'&&!confirm('Confirmer l’annulation de cette mission planifiée ?'))return;
    r=await client.rpc('ama_rr_decide',{p_message:card.dataset.rrMessage,p_action:action==='mission-cancel'?'cancel':'keep',p_worker:null,p_existing:null});
   }else r=await client.rpc('ama_rr_queue_action',{p_external:card.dataset.rrExternal,p_action:action,p_worker:worker});
   if(r.error)throw r.error;
   await reload();await loadFinances();render();await amaRRQueueLoad();
   feedback.textContent=action==='assign'?'Mission affectée au planning.':'Ménage retiré de À affecter.';
  }catch(error){feedback.textContent='Action refusée : '+error.message;}
  finally{amaRRBusy=false;if(button.isConnected)button.disabled=false;}
 };
 queue.addEventListener('click',queueClick);dialog.addEventListener('click',queueClick);
}
async function amaRRLoad(){
 if(session?.role!=='admin')return;
 const generation=++amaRRGeneration,owner=session.id;amaRRSelected.clear();
 const feedback=document.getElementById('amaRRFeedback');feedback.textContent='Chargement…';
 const consoleResult=await client.rpc('ama_rr_console');
 if(generation!==amaRRGeneration||session?.id!==owner||session?.role!=='admin')return;
 if(consoleResult.error){amaV6Health?.('rr',null,true);feedback.textContent='Console indisponible : appliquer le SQL V4 ou vérifier la connexion.';return;}
 const info=consoleResult.data||{};amaRRAutoEnabled=!!info.settings?.auto_enabled;
 document.getElementById('amaRRAuto').checked=amaRRAutoEnabled;
 const contact=info.connection?.last_received_at;
 const recent=contact&&Date.now()-new Date(contact).getTime()<10*60000;
 document.getElementById('amaRRHealth').textContent=recent?'● À jour':'● Dernier contact à vérifier';document.getElementById('amaProviderHealth-rr').textContent=document.getElementById('amaRRHealth').textContent;
 document.getElementById('amaRRConnection').textContent=contact?'Dernière synchronisation : '+new Date(contact).toLocaleString('fr-FR')+' · '+Number(info.retained_count||0)+' fiches conservées.':'Aucun contact du script reçu.';
 amaV6Health?.('rr',contact);document.getElementById('amaRRMapCount').textContent=String(info.mapped_count||0);
 document.getElementById('amaRRReviewCount').textContent=String(info.review_count||0);
 document.getElementById('amaRRPastCount').textContent=String(info.past_count||0);
 feedback.textContent='';
 if(!document.getElementById('amaRRInspector').open)return;
 document.getElementById('amaRRInspectorTitle').textContent='RentalReady';document.getElementById('amaRRInspectorSubtitle').textContent=({pending:'À vérifier / ajouter',history:'Historique',past:'Ménages passés',properties:'Logements associés'})[amaRRView]||'Imports';
 if(amaRRView==='properties'){
  const r=await client.rpc('ama_rr_properties_list',{p_offset:amaRRPage*20});
  if(generation!==amaRRGeneration||session?.id!==owner||session?.role!=='admin')return;
  if(r.error){feedback.textContent='Associations indisponibles : '+r.error.message;return;}
  amaRRRows=(r.data?.items||[]).map(x=>({...x,message_id:'property:'+x.external_property_id}));amaRRTotal=Number(r.data?.total||0);
  document.getElementById('amaRRSelectToolbar').hidden=true;document.querySelector('.ama-rr-batch').hidden=true;
  document.getElementById('amaRRList').innerHTML=amaRRRows.map(x=>`<article class="ama-rr-item" data-rr-message="${esc(x.message_id)}"><details><summary><strong>${esc(x.name)}</strong> · ${esc(x.external_property_id)}</summary><label>Logement AMA</label><select data-rr-apartment aria-label="Logement AMA">${selectOptions(activeApartments())}</select><button type="button" data-rr="map">Mémoriser l’association</button></details></article>`).join('')||'<p>Aucun logement associé.</p>';
  document.querySelectorAll('#amaRRList [data-rr-message]').forEach(card=>{const row=amaRRRows.find(x=>x.message_id===card.dataset.rrMessage);card.querySelector('select').value=row.apartment_id;});
  document.querySelector('[data-rr="prev"]').disabled=amaRRPage===0;document.querySelector('[data-rr="next"]').disabled=(amaRRPage+1)*20>=amaRRTotal;document.getElementById('amaRRPageLabel').textContent=amaRRTotal+' associations · page '+(amaRRPage+1);return;
 }
 const {data:result,error}=await client.rpc('ama_rr_list_v2',{p_offset:amaRRPage*20,p_view:amaRRView});
 if(generation!==amaRRGeneration||session?.id!==owner||session?.role!=='admin')return;
 if(error){document.getElementById('amaRRList').replaceChildren();feedback.textContent='Imports indisponibles : '+error.message;return;}
 feedback.textContent='';const cleaner=document.getElementById('amaV9RRClean');if(cleaner)cleaner.hidden=!['past','history'].includes(amaRRView);amaRRRows=result?.items||[];amaRRTotal=Number(result?.total||0);
 document.getElementById('amaRRPast').textContent='◷ Ménages passés · '+Number(result?.past_count||0)+(amaRRView==='past'?' · Replier ▴':' · Afficher ▾');
 document.querySelectorAll('[data-rr="pending"],[data-rr="history"]').forEach(b=>b.classList.toggle('primary',b.dataset.rr===amaRRView));
 document.querySelector('[data-rr="prev"]').disabled=amaRRPage===0;document.querySelector('[data-rr="next"]').disabled=(amaRRPage+1)*20>=amaRRTotal;
 document.getElementById('amaRRPageLabel').textContent=amaRRTotal?'Page '+(amaRRPage+1)+' · '+amaRRTotal+' imports':'Aucun import';
 document.getElementById('amaRRSelectToolbar').hidden=amaRRView!=='pending';
 document.querySelector('.ama-rr-batch').hidden=amaRRView!=='pending';
 document.getElementById('amaRRList').innerHTML=amaRRRows.map(row=>{
  const apartment=data.apartments.find(a=>a.id===row.apartment_id),suggestion=!apartment?amaRRSuggestion(row):null;
  const date=String(row.local_start||'').slice(0,10);
  const candidates=data.missions.filter(m=>m.apartmentId===row.apartment_id&&m.date===date);
  const title=row.kind==='invalid'?'Mail à vérifier':row.property_name;
  const state=row.kind==='assigned'?'À faire':row.kind==='participation_cancelled'?'Annulation reçue':'À vérifier';
  const decision={ignored:'Ignoré',confirmed:'Ajouté au planning',linked:'Mission associée',cancelled:'Annulation confirmée',kept:'Alerte classée'};
  const link=`<a href="https://mail.google.com/mail/u/0/#all/${encodeURIComponent(row.message_id)}" target="_blank" rel="noopener noreferrer">Voir le mail ↗</a>`;
  if(['history','past'].includes(amaRRView)){const statusText=row.decision?decision[row.decision]:row.kind==='participation_cancelled'?'Annulation reçue':row.queued?'À affecter':row.mission_id?'Mission associée':row.kind==='invalid'?'À vérifier':apartment?'À ajouter au planning':'Logement à vérifier';return `<article class="ama-stay-card" data-rr-message="${esc(row.message_id)}"><h4>${esc(apartment?.name||title||'Logement à vérifier')}</h4><p class="ama-stay-dates">${esc(date?dateFr(date):'Date à vérifier')}${apartment?' · '+esc(hours(apartment.duration)):''}</p><p class="ama-stay-note">${esc(statusText)}</p>${row.error?'<p>'+esc(row.error)+'</p>':''}<small>${esc(row.external_mission_id||'')}</small><div class="ama-stay-actions">${link}${row.decision==='ignored'&&row.kind==='assigned'&&date>=amaRRToday()?'<button type="button" data-rr="restore">Réactiver cet import</button>':''}</div></article>`;}

  const eligible=!row.superseded&&amaRRView==='pending'&&!row.decision&&row.kind==='assigned'&&!row.mission_id&&!row.queued&&apartment&&!candidates.some(m=>m.status!=='cancelled');
  let actions='';
  if(!row.decision&&amaRRView==='pending'){
   if(row.kind!=='invalid')actions+=`<details class="ama-rr-map" ${!apartment?'open':''}><summary>${apartment?'Modifier le logement associé':suggestion?'Logement proposé : '+esc(suggestion.name):'Associer un logement'}</summary><div class="field"><label>Logement AMA</label><select data-rr-apartment aria-label="Logement AMA">${selectOptions(activeApartments())}</select><button type="button" data-rr="map">${suggestion?'Confirmer le logement':'Mémoriser l’association'}</button></div></details>`;
   if(candidates.some(m=>m.status!=='cancelled')&&!row.mission_id)actions+='<p class="ama-rr-alert">Une mission existe à cette date. Associe-la après vérification.</p>';
   if(!row.mission_id&&candidates.length&&apartment&&!row.queued){
    actions+=`<div class="field"><label>Mission déjà saisie</label><select data-rr-existing aria-label="Mission déjà saisie"><option value="">— choisir —</option>${candidates.map(m=>`<option value="${esc(m.id)}">${esc(dateFr(m.date)+' · '+(userById(m.workerId)?.name||'Intervenant')+' · '+m.status)}</option>`).join('')}</select><button type="button" data-rr="${row.kind==='participation_cancelled'?'link_cancel':'link'}">Associer cette mission</button></div>`;
   }
   if(row.kind==='participation_cancelled'){
    actions+='<p class="muted">Participation annulée : vérifie avant de retirer le ménage.</p>';
    if(row.queued)actions+='<button type="button" data-rr="queue_cancel">Retirer de À affecter</button>';
    if(row.mission_id&&row.mission_status==='planned')actions+='<button type="button" data-rr="cancel">Confirmer l’annulation</button>';
    if(!row.queued)actions+='<button type="button" data-rr="keep">Classer l’alerte / conserver</button>';
   }
   if(row.superseded)actions+='<p class="ama-rr-alert">Un mail plus récent a été filtré : vérifier les dates dans Gmail.</p>';if(row.auto_issue)actions+='<p class="ama-rr-alert">'+esc(row.auto_issue)+'</p>';
   if(row.kind==='invalid')actions+='<p class="ama-rr-alert">'+esc(row.error||'Vérifier dans Gmail')+'</p>';
   if(!row.queued)actions+='<button type="button" class="soft mini" data-rr="ignore">Ignorer</button>';
  }
  if(row.decision==='ignored'&&row.kind==='assigned'&&date>=amaRRToday())actions+='<button type="button" data-rr="restore">Réactiver cet import</button>';
  const statusText=row.decision?decision[row.decision]:row.kind==='participation_cancelled'?'Annulation reçue':row.queued?'À affecter':row.kind==='assigned'&&!apartment?'Logement à confirmer':state;
  return `<article class="ama-rr-item ama-rr-${row.kind} ama-rr-compact ${eligible?'ama-rr-selectable':''}" data-rr-message="${esc(row.message_id)}">${eligible?`<input type="checkbox" data-rr-check="${esc(row.message_id)}" aria-label="Sélectionner ${esc(title)}">`:''}<details class="ama-rr-detail"><summary><div class="ama-rr-line-main"><strong>${esc(apartment?.name||title)}</strong><span class="ama-rr-pill">${esc(statusText)}</span></div><span class="ama-rr-line-sub">${esc(date?dateFr(date):'Date à vérifier')}${apartment?' · '+esc(hours(apartment.duration)):''}</span></summary><div class="ama-rr-expanded"><div class="ama-rr-row"><small>${apartment?'✓ Logement associé':suggestion?'Correspondance à confirmer':'Logement à associer'}</small>${link}</div>${actions?'<div class="ama-rr-actions">'+actions+'</div>':''}</div></details></article>`;
 }).join('')||'<p class="muted">Aucun import dans cette vue.</p>';
 document.querySelectorAll('#amaRRList [data-rr-message]').forEach(card=>{const row=amaRRRows.find(x=>x.message_id===card.dataset.rrMessage);const select=card.querySelector('[data-rr-apartment]');if(select)select.value=row?.apartment_id||amaRRSuggestion(row)?.id||'';});
 amaRRSelection();
}
function amaRRToday(){return new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function amaRRShift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function amaRRMonday(day){const d=new Date(day+'T12:00:00Z');return amaRRShift(day,-((d.getUTCDay()+6)%7));}
function amaRROpenSheet(){
 if(session?.role!=='admin')return;
 amaRRWeekStart=amaRRMonday(document.getElementById('planningDate').value||amaRRToday());amaRRQueuePage=0;amaRRQueueSnapshot='';
 const dialog=document.getElementById('amaRRDialog');if(!dialog.open)dialog.showModal();
 document.body.classList.add('ama-rr-modal-open');document.querySelector('.ama-rr-platform-tile').setAttribute('aria-expanded','true');void amaRRQueueLoad();
}
async function amaRRQueueLoad(){
 const pane=document.getElementById('amaRRQueue');if(!pane)return;
 if(session?.role!=='admin'){pane.hidden=true;document.getElementById('amaRRDialog')?.close();document.getElementById('amaRRQueueList').replaceChildren();return;}
 pane.hidden=false;const owner=session.id,generation=++amaRRQueueGeneration;
 if(!amaRRWeekStart)amaRRWeekStart=amaRRMonday(amaRRToday());
 const r=await client.rpc('ama_rr_week',{p_start:amaRRWeekStart,p_offset:amaRRQueuePage*20});
 if(generation!==amaRRQueueGeneration||session?.id!==owner||session?.role!=='admin')return;
 const feedback=document.getElementById('amaRRQueueFeedback');
 if(r.error){document.getElementById('amaRRQueueTileCount').textContent='!';feedback.textContent='Planning RentalReady indisponible : vérifier le SQL V4 et la connexion.';return;}
 const items=r.data?.items||[];amaRRQueueTotal=Number(r.data?.total||0);
 document.getElementById('amaRRQueueTileCount').textContent=String(r.data?.all_queue_count||0);
 const dateLabel=day=>new Date(day+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'});
 document.getElementById('amaRRWeekLabel').textContent=dateLabel(amaRRWeekStart)+' – '+dateLabel(amaRRShift(amaRRWeekStart,6));
 amaV12ScanSuggestions(document.getElementById('amaRRDialog'));document.getElementById('amaRRWeekTotal').textContent=Number(r.data?.task_count||0)+' ménage(s) · '+hours(Number(r.data?.hours||0));
 document.getElementById('amaRRWeekAlerts').textContent=Number(r.data?.alerts||0)?r.data.alerts+' alerte(s)':'';
 document.getElementById('amaRRQueueCount').textContent=amaRRQueueTotal?'Page '+(amaRRQueuePage+1)+' · '+amaRRQueueTotal+' lignes':'';
 const dialog=document.getElementById('amaRRDialog');dialog.querySelector('[data-rrq="prev"]').disabled=amaRRQueuePage===0;dialog.querySelector('[data-rrq="next"]').disabled=(amaRRQueuePage+1)*20>=amaRRQueueTotal;
 const snapshot=JSON.stringify([amaRRWeekStart,amaRRQueuePage,items]);if(amaRRQueueSnapshot===snapshot)return;amaRRQueueSnapshot=snapshot;
 let lastDay='';document.getElementById('amaRRQueueList').innerHTML=items.map(q=>{
  const heading=q.mission_date!==lastDay?'<h4 class="ama-rr-day">'+esc(new Date(q.mission_date+'T12:00:00Z').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short',timeZone:'Europe/Paris'}))+'</h4>':'';lastDay=q.mission_date;
  const cancelled=q.latest_kind==='participation_cancelled';
  let actions='';
  if(q.row_type==='mission_alert')actions='<p class="ama-rr-alert">Participation annulée : vérifier avant de retirer la mission.</p><button type="button" data-rrq="mission-cancel">Confirmer l’annulation</button><button type="button" data-rrq="mission-keep">Conserver / classer</button>';
  else{
   actions=q.needs_review?'<p class="ama-rr-alert">'+(cancelled?'Annulation reçue : confirmer le retrait.':'Date passée, association ou mail modifié : vérifier dans Gestion → Connexions & imports.')+'</p>':`<div class="ama-rr-assignline"><select data-rrq-worker aria-label="Intervenant">${selectOptions(activeWorkers())}</select><button type="button" class="primary" data-rrq="assign">Affecter</button></div>`;
   actions+=`<button type="button" class="soft mini" data-rrq="${cancelled?'cancel':'remove'}">${cancelled?'Confirmer le retrait':'Retirer / ignorer'}</button>`;
  }
  return heading+`<article class="ama-rr-item ama-rr-compact ${cancelled?'ama-rr-participation_cancelled':'ama-rr-assigned'}" data-work-apartment="${esc(q.apartment_id)}" data-work-day="${esc(q.mission_date)}" data-work-hours="${Number(q.duration||0)}" data-rr-external="${esc(q.external_mission_id)}" data-rr-message="${esc(q.latest_message_id||q.message_id)}"><details class="ama-rr-detail"><summary><div class="ama-rr-line-main"><strong>${esc(q.apartment_name)}</strong><span class="ama-rr-pill">${cancelled?'Annulation reçue':q.needs_review?'À vérifier':'À affecter'}</span></div><span class="ama-rr-line-sub">${esc(hours(q.duration))}</span></summary><div class="ama-rr-expanded">${actions}</div></details></article>`;
 }).join('')||'<p class="ama-rr-empty">Aucun ménage à affecter ni alerte pour cette semaine. Utilise les flèches pour changer de semaine.</p>';
}

amaRRSetup();amaStaySetup();

amaSetupInvoices();amaMailSetup();amaSetupBilling();amaSetupCompanies();
const amaInvoiceTitle=$('#tab-invoices .card h3');amaInvoiceTitle.id='amaInvoiceMainTitle';const amaInvoiceTopbar=document.createElement('div');amaInvoiceTopbar.id='amaInvoiceTopbar';amaInvoiceTitle.before(amaInvoiceTopbar);amaInvoiceTopbar.append($('#amaInvoiceBack'),amaInvoiceTitle);$('#amaInvoiceBack').textContent='‹';$('#amaInvoiceBack').setAttribute('aria-label','Retour');const amaConfigure=document.createElement('button');amaConfigure.id='amaInvoiceConfigure';amaConfigure.type='button';amaConfigure.innerHTML=amaUiIcon('configure');amaConfigure.setAttribute('aria-label','Configuration des factures');amaConfigure.title='Configuration des factures';amaConfigure.onclick=()=>amaInvoiceShow('settings');amaInvoiceTopbar.append(amaConfigure);amaSetupAdminReminderUI();

fillSelects();

// Contrôle serveur : ne déconnecter que sur un refus explicite, jamais sur une panne réseau.
let amaAccessCheckBusy=false;
async function amaCheckSessionAccess(){
 if(!session||!client||document.hidden||amaAccessCheckBusy)return;
 const checkedSession=session;amaAccessCheckBusy=true;
 try{
  const result=await client.rpc('ama_m5_session_access_status');
  if(result.error||result.data!==false||session!==checkedSession)return;
  document.getElementById('app').hidden=true;
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  amaClosePdf();stopAmaWelcome();amaClosePhotoMission();
  session=null;amaRRClear();data={users:[],apartments:[],missions:[]};lastSnapshot=structuredClone(data);
  try{await client.auth.signOut({scope:'local'});}catch{}
  location.replace(location.protocol==='file:'?location.href.split('#')[0].split('?')[0]:location.origin+location.pathname);
 }finally{amaAccessCheckBusy=false;}
}
setInterval(()=>{void amaCheckSessionAccess().catch(()=>{});},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void amaCheckSessionAccess().catch(()=>{});});
window.addEventListener('focus',()=>{void amaCheckSessionAccess().catch(()=>{});});

async function amaRestoreSession(){
 const loading=document.getElementById('amaSessionLoading'),retry=document.getElementById('amaSessionRetry');
 loading.hidden=false;retry.hidden=true;document.getElementById('amaSessionLoadingText').textContent='Préparation de votre espace…';
 try{
  if(!client)throw Error('Service de connexion indisponible. Vérifiez votre connexion Internet.');
  const local=await client.auth.getSession();if(local.error)throw local.error;
  if(!local.data.session){$('#loginScreen').classList.remove('hidden');loading.hidden=true;return;}
  const r=await client.auth.getUser();if(r.error)throw r.error;
  if(!r.data.user)throw Error('Session indisponible. Réessayez.');
   if(await amaM4Gate(r.data.user))await startSession(r.data.user);loading.hidden=true;
 }catch(e){
  // A network/data error must not be treated as an explicit sign-out.
  const expired=['refresh_token_not_found','refresh_token_already_used','session_not_found','bad_jwt'].includes(e.code);
  if(expired){loading.hidden=true;$('#loginScreen').classList.remove('hidden');$('#loginError').textContent='Votre session a expiré. Reconnectez-vous.';}
  else{document.getElementById('amaSessionLoadingText').textContent='Impossible d’ouvrir votre espace pour le moment. Vérifiez votre connexion, puis réessayez.';retry.hidden=false;}
 }
}
document.addEventListener('DOMContentLoaded',()=>window.amaInitAdminOptions({isAdmin:()=>session?.role==='admin',icon:amaUiIcon,client}));
// Module V6 initialisé dans la portée privée de l’application, avant restauration de session.
// Améliorations V6 : aucune écriture de mission ni envoi de facture dans les widgets d'accueil.
let amaV6Home=null,amaV6HomeAt=0,amaV6HomeBusy=false,amaV6Owner=null,amaV6IncidentBusy=false,amaV6IncidentId=null,amaV6IncidentMission=null,amaV6IncidentFiles=[],amaV6IncidentPreview=null,amaV6IncidentPage=0;
let amaV6IncidentLoad=0;
let amaV6IncidentSaved=false,amaV6ShareFiles=[],amaV6ShareText='';
const amaV6Contacts=new Map();
const amaV6Fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
const amaV6Labels={damage:'Dégât',linen:'Linge',access:'Accès',other:'Autre'};
async function amaV6Rpc(name,args={}){if(!session)throw Error('Connexion requise');const r=await client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
async function amaV6Refresh(force=false){
 if(session?.role!=='admin'){amaV6Reset();return;}if(amaV6HomeBusy||!force&&Date.now()-amaV6HomeAt<20000)return;
 const owner=session.id;amaV6HomeBusy=true;
 try{const r=await amaV6Rpc('ama_home_actions');if(session?.id!==owner||session?.role!=='admin')return;amaV6Home=r;amaV6Owner=owner;amaV6HomeAt=Date.now();amaV6PaintHome();}
 catch(e){if(session?.id===owner){const error=document.getElementById('amaV6HomeError');if(error){error.hidden=false;error.textContent='Vérification des actions indisponible. Réessayer';}document.getElementById('amaV6Actions')?.setAttribute('hidden','');}}
 finally{amaV6HomeBusy=false;}
}
function amaV6Reset(){amaV6Home=null;amaV6Owner=null;amaV6HomeAt=0;amaV6Contacts.clear();document.getElementById('amaV6Actions')?.setAttribute('hidden','');document.getElementById('amaV6Team')?.setAttribute('hidden','');document.getElementById('amaV6HomeError')?.setAttribute('hidden','');for(const id of ['amaV6ActionRows','amaV6TeamRows'])document.getElementById(id)?.replaceChildren();for(const id of ['amaV6Todo','amaV6IncidentForm','amaV6IncidentList']){const d=document.getElementById(id);d?.close();d?.querySelectorAll('[data-private-content]').forEach(n=>n.replaceChildren());}amaV6IncidentId=null;amaV6IncidentMission=null;amaV6IncidentFiles=[];amaV6IncidentSaved=false;amaV6ShareFiles=[];amaV6ShareText='';if(amaV6IncidentPreview)URL.revokeObjectURL(amaV6IncidentPreview);amaV6IncidentPreview=null;const preview=document.getElementById('amaV6PhotoPreview');if(preview){preview.removeAttribute('src');preview.hidden=true;}const message=document.getElementById('amaV6IncidentMessage');if(message)message.value='';const files=document.getElementById('amaV6IncidentPhoto');if(files)files.value='';}
function amaV6ActionIcon(key){const paths={unassigned:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18 M12 13v5 M9.5 15.5h5',cancellations:'M6 6l12 12 M18 6 6 18',payments:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h4',incidents:'M12 3 2 21h20L12 3Z M12 9v5 M12 17v.1',workload:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>';}
function amaV6PaintHome(){
 const box=document.getElementById('amaV6Actions');if(!box)return;
 if(session?.role!=='admin'||amaV6Owner!==session.id||!amaV6Home){box.hidden=true;return;}
 document.getElementById('amaV6HomeError').hidden=true;
 const rows=document.getElementById('amaV6ActionRows');rows.replaceChildren();
 const add=(key,label,count,description,open)=>{const b=document.createElement('button');b.type='button';b.className='ama-v6-action-row';b.dataset.actionKind=key;b.innerHTML='<span class="ama-v7-action-icon">'+amaV6ActionIcon(key)+'</span><span class="ama-v7-action-copy"><strong>'+esc(label)+'</strong>'+(description?'<small>'+esc(description)+'</small>':'')+'</span><span class="ama-v7-action-count">'+count+'</span><span class="ama-v7-action-chevron" aria-hidden="true">›</span>';b.onclick=open;rows.append(b);};
 for(const [key,single,plural] of [['unassigned','Ménage à affecter','Ménages à affecter'],['cancellations','Annulation à vérifier','Annulations à vérifier'],['incidents','Signalement à traiter','Signalements à traiter'],['payments','Paiement à confirmer','Paiements à confirmer']]){
  const list=amaV6Home[key]||[],count=list.length;if(!count)continue;let description='';if(key==='incidents'){const urgent=list.filter(i=>i.priority==='urgent').length;description=urgent?urgent+' urgent(s) à vérifier':count===1?list[0].apartment_name||'':'';}add(key,count===1?single:plural,count,description,()=>void amaV6TodoOpen(key));
 }
 const day=amaRRToday(),ms=data.missions.filter(m=>m.date===day&&m.status==='planned'&&!m.prolonged);
 for(const w of activeWorkers()){const list=ms.filter(m=>sharedIds(m).includes(w.id)),h=list.reduce((n,m)=>n+sharedHours(m),0);if(h<=8)continue;
  add('workload','Charge à vérifier',hours(h),w.name+' · '+list.length+' mission'+(list.length>1?'s':''),()=>{setTab('planning');document.getElementById('planningDate').value=day;document.getElementById('planningWorkerFilter').value=w.id;document.getElementById('planningStatusFilter').value='';renderPlanning();});
 }
 const paymentRow=rows.querySelector('[data-action-kind=payments]');if(paymentRow)rows.append(paymentRow);box.hidden=!rows.children.length;const total=document.getElementById('amaV7ActionCount');if(total)total.textContent=rows.children.length+' point'+(rows.children.length>1?'s':'')+' à vérifier';const summary=document.getElementById('amaV8ActionSummary');if(summary)summary.textContent=Array.from(rows.children).slice(0,2).map(b=>b.querySelector('strong').textContent).join(' · ');
}

async function amaV6TodoOpen(kind){
 if(session?.role!=='admin')return;if(kind==='incidents'){const items=amaV6Home?.incidents||[];void amaV6IncidentListOpen(items.length===1?items[0].id:null);return;}
 const dialog=document.getElementById('amaV6Todo');dialog.querySelector('h3').textContent=({unassigned:'Ménages à affecter aujourd’hui',cancellations:'Annulations à vérifier',payments:'Paiements à confirmer'})[kind];const body=dialog.querySelector('[data-private-content]');body.replaceChildren();dialog.showModal();
 for(const item of amaV6Home?.[kind]||[]){const card=document.createElement('article');card.className='ama-v6-list-row';const title=document.createElement('strong');title.textContent=item.apartment_name||item.name||item.number||'Logement';card.append(title);const button=document.createElement('button');button.type='button';button.textContent=kind==='payments'?'Ouvrir le suivi':'Ouvrir les imports';button.onclick=()=>{dialog.close();if(kind==='payments'){void amaPaymentOpen(item.invoice_id,item.company_id);return;}const source=String(item.source||'rr').split(',')[0];if(source==='rr'){setTab(kind==='unassigned'?'planning':'admin');if(kind==='unassigned'){document.getElementById('planningDate').value=amaRRToday();amaRROpenSheet();}else{amaShowManage('imports');document.querySelector('[data-rr="open-pending"]')?.click();}}else{setTab(kind==='unassigned'?'planning':'admin');if(kind==='cancellations')amaShowManage('imports');amaStayOpen(source,kind==='unassigned'?'queue':'pending');if(kind==='unassigned'){amaStayWeekStart=amaRRMonday(amaRRToday());void amaStayPanelLoad();}}};card.append(button);body.append(card);}
 if(!body.children.length)body.textContent='Tout est traité.';
}
function amaV6Health(source,last,problem=false){amaV6Contacts.set(source,{last,problem});amaV6PaintHealth();amaNetworkPaint();}
function amaV6PaintHealth(){
 if(session?.role!=='admin')return;
 for(const [source,v] of amaV6Contacts){const line=document.getElementById('amaProviderHealth-'+source);if(!line)continue;const job=amaSyncJobs.find(j=>j.source===source),stamp=Date.parse(v.last||'');const failed=v.problem||job?.state==='failed'&&(!Number.isFinite(stamp)||Date.parse(job.finished_at||job.requested_at)>stamp);const pending=['requested','running'].includes(job?.state);const fresh=Number.isFinite(stamp)&&Date.now()-stamp<(source==='airbnb'?35:10)*60000;
 const label=failed?'À contrôler':pending?'Synchronisation en attente':fresh?'À jour':'À contrôler';line.textContent=(failed||!fresh?'● ':'● ')+label;line.dataset.health=failed?'error':pending||!fresh?'waiting':'ok';line.title=failed?'Collecte non confirmée. Consultez le journal puis réessayez.':v.last?'Dernière synchronisation : '+new Date(v.last).toLocaleString('fr-FR'):'Aucune collecte confirmée';}
}
async function amaV6Workload(worker,date,added,exclude=null){if(!worker||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;const r=await amaV6Rpc('ama_worker_workload',{p_worker:worker,p_day:date,p_exclude:exclude});return {...r,projected:Number(r.hours)+Number(added||0)};}
async function amaV6CheckWorkload(worker,date,added){
 const r=await amaV6Workload(worker,date,added);if(!r)throw Error('Choisissez une date et un intervenant');
 return r.projected<=8||confirm((userById(worker)?.name||'Cet intervenant')+' a déjà '+r.missions+' mission(s) · '+hours(r.hours)+' le '+dateFr(date)+'. Avec cette mission : '+hours(r.projected)+'.\nCette charge dépasse le repère de 8 h. Confirmer l’affectation ?');
}
let amaV6WorkloadGeneration=0;
async function amaV6FormWorkload(){
 if(session?.role!=='admin')return;const generation=++amaV6WorkloadGeneration,owner=session.id,box=document.getElementById('amaV6Workload');if(!box)return;box.hidden=true;
 try{const r=await amaV6Workload(document.getElementById('missionWorker').value,document.getElementById('missionDate').value,document.getElementById('missionHours').value);if(generation!==amaV6WorkloadGeneration||session?.id!==owner||!r)return;box.hidden=false;box.classList.toggle('ama-v6-heavy',r.projected>8);box.textContent=r.missions+' mission(s) déjà prévues · '+hours(r.hours)+' ce jour. Avec cette mission : '+hours(r.projected)+'.'+(r.projected>8?' Charge à vérifier (repère : 8 h).':'');}
 catch(e){if(generation===amaV6WorkloadGeneration){box.hidden=false;box.textContent='Charge indisponible : elle sera revérifiée avant enregistrement.';}}
}
function amaV6IncidentOpen(mission){
 if(!session||!mission||!canSee(mission)||amaV6IncidentBusy)return;const d=document.getElementById('amaV6IncidentForm');amaV6IncidentId=crypto.randomUUID();amaV6IncidentMission=mission.id;amaV6IncidentFiles=[];amaV6IncidentSaved=false;amaV6ShareFiles=[];amaV6ShareText='';if(amaV6IncidentPreview)URL.revokeObjectURL(amaV6IncidentPreview);amaV6IncidentPreview=null;d.querySelector('form').reset();document.getElementById('amaV6IncidentSend').textContent='Enregistrer le signalement';d.querySelectorAll('input,textarea,select').forEach(x=>x.disabled=false);document.getElementById('amaV6IncidentSend').disabled=false;document.getElementById('amaV6IncidentShare').hidden=true;document.getElementById('amaV6IncidentCopy').hidden=true;document.getElementById('amaV6PhotoPreview').hidden=true;document.getElementById('amaV6IncidentFeedback').textContent='';document.getElementById('amaV6IncidentTitle').textContent='Signaler — '+mission.apartmentName;d.showModal();
}
async function amaV6Photo(file){if(!file)return null;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000)throw Error('Choisissez une image JPEG, PNG ou WebP de moins de 20 Mo.');const image=await createImageBitmap(file);try{const ratio=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>4194304)throw Error('Photo trop volumineuse.');return blob;}finally{image.close();}}
async function amaV6IncidentSend(e){
 e.preventDefault();if(!session||amaV6IncidentBusy||amaV6IncidentSaved||!amaV6IncidentMission)return;const owner=session.id,id=amaV6IncidentId,mission=amaV6IncidentMission,feedback=document.getElementById('amaV6IncidentFeedback'),button=document.getElementById('amaV6IncidentSend'),category=document.getElementById('amaV6IncidentCategory').value,message=document.getElementById('amaV6IncidentMessage').value.trim();if(!message)return;
 amaV6IncidentBusy=true;button.disabled=true;document.getElementById('amaV6IncidentForm').querySelectorAll('input,textarea,select').forEach(x=>x.disabled=true);feedback.textContent='Enregistrement…';
 try{const photos=[];for(const file of amaV6IncidentFiles)photos.push(await amaV6Photo(file));if(session?.id!==owner)return;const args={p_id:id,p_mission:mission,p_category:category,p_message:message,p_priority:document.getElementById('amaV8IncidentPriority').value};await amaV6Rpc('ama_incident_submit',args);if(session?.id!==owner)return;
 amaV6IncidentSaved=true;amaV6ShareFiles=photos.map((blob,i)=>new File([blob],'signalement-'+(i+1)+'.jpg',{type:'image/jpeg'}));const m=data.missions.find(x=>x.id===mission),apt=data.apartments.find(x=>x.id===m?.apartmentId);amaV6ShareText='*Signalement — '+(m?.apartmentName||'Logement').replace(/[*_~`]/g,'')+'*\n'+(apt?.address?'Adresse : '+apt.address+'\n':'')+'Date de mission : '+dateFr(m?.date||amaRRToday())+'\nIntervenant : '+(session.name||m?.workerName||'Intervenant')+'\nProblème : '+amaV6Labels[category]+'\n\n'+message;
 feedback.textContent='Signalement enregistré. Vous pouvez maintenant partager les informations et les photos. Choisissez WhatsApp dans le menu de partage.';button.textContent='Enregistré ✓';document.getElementById('amaV6IncidentShare').hidden=false;document.getElementById('amaV6IncidentCopy').hidden=false;void loadNotifications().then(()=>renderNotifications()).catch(()=>{});void amaV6Refresh(true);
 }catch(err){if(session?.id===owner)feedback.textContent='Envoi non confirmé : '+err.message+' Réessayez ici pour éviter un doublon.';}
 finally{amaV6IncidentBusy=false;button.disabled=amaV6IncidentSaved;button.textContent=amaV6IncidentSaved?'Enregistré ✓':'Enregistrer le signalement';}
}
async function amaV10IncidentDetail(id=null,reset=true){
 if(session?.role!=='admin')return;if(reset)amaV6IncidentPage=0;const load=++amaV6IncidentLoad;const owner=session.id,d=document.getElementById('amaV6IncidentList'),body=d.querySelector('[data-private-content]');d.dataset.incident=id||'';body.textContent='Chargement…';amaV9Open('incidents');if(!d.open)d.show();
 try{const r=await amaV6Rpc('ama_incident_feed',{p_id:id,p_offset:amaV6IncidentPage*20,p_filter:document.getElementById('amaV8IncidentFilter').value});if(session?.id!==owner||load!==amaV6IncidentLoad||!d.open||d.dataset.incident!==(id||''))return;body.replaceChildren();for(const row of r.items){const card=document.createElement('article');card.className='ama-v6-list-row';const title=document.createElement('strong');title.textContent=row.apartment_name;const meta=document.createElement('small');meta.textContent='Signalé par '+(row.author_name||'Intervenant')+' · Mission du '+dateFr(row.mission_date)+' · '+(row.status==='resolved'?'Résolu':row.stage==='in_progress'?'En cours':'Signalé')+(row.priority==='urgent'?' · Urgent':'');const category=document.createElement('p');category.className='ama-v7-incident-category';category.textContent='Problème : '+(amaV6Labels[row.category]||'Autre');const text=document.createElement('p');text.className='ama-v7-incident-comment';text.textContent=row.message;const label=document.createElement('small');label.textContent='Commentaire';card.append(title,meta,category,label,text);const mission=data.missions.find(m=>m.id===row.mission_id),apt=data.apartments.find(a=>a.id===mission?.apartmentId);if(apt?.address){const address=document.createElement('small');address.textContent='Adresse : '+apt.address;card.append(address);}const photos=document.createElement('small');photos.textContent='Les photos restent dans WhatsApp si elles y ont été partagées.';card.append(photos);if(Number(row.related_count)>0){const recurrence=document.createElement('small');recurrence.textContent=row.related_count+' autre(s) signalement(s) de même catégorie pour ce nom de logement — à comparer.';card.append(recurrence);}if(row.status==='open'){const progress=document.createElement('button');progress.type='button';progress.textContent=row.stage==='in_progress'?'Revenir à Signalé':'Prendre en charge';progress.onclick=async()=>{progress.disabled=true;try{await amaV6Rpc('ama_incident_triage',{p_id:row.id,p_priority:row.priority||'normal',p_stage:row.stage==='in_progress'?'reported':'in_progress'});await amaV6IncidentListOpen(id,false);}catch(e){progress.disabled=false;alert(e.message);}};card.append(progress);const resolve=document.createElement('button');resolve.type='button';resolve.textContent='Marquer comme traité';resolve.onclick=async()=>{if(!confirm('Classer ce signalement comme traité ?'))return;resolve.disabled=true;try{await amaV6Rpc('ama_incident_triage',{p_id:row.id,p_priority:row.priority||'normal',p_stage:'resolved'});await amaV6IncidentListOpen(id,false);await loadNotifications();renderNotifications();void amaV6Refresh(true);}catch(e){resolve.disabled=false;alert(e.message);}};card.append(resolve);}body.append(card);}if(!body.children.length)body.textContent='Aucun signalement.';d.querySelector('[data-incident-prev]').disabled=amaV6IncidentPage===0;d.querySelector('[data-incident-next]').disabled=(amaV6IncidentPage+1)*20>=r.total;
 }catch(e){if(session?.id===owner)body.textContent='Chargement refusé : '+e.message;}
}
function amaV6Setup(){
 const home=document.getElementById('tab-dashboard');
 const actions=document.createElement('details');actions.id='amaV6Actions';actions.className='card ama-v6-actions';actions.hidden=true;actions.innerHTML='<summary class="ama-v8-action-summary"><span class="ama-v8-summary-icon">'+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6 M12 16v.1"/></svg></span><span><strong id="amaV7ActionCount"></strong><small id="amaV8ActionSummary"></small></span><span class="ama-v8-down" aria-hidden="true">⌄</span></summary><div id="amaV6ActionRows" aria-label="À traiter aujourd’hui"></div>';home.prepend(actions);
 const err=document.createElement('button');err.type='button';err.id='amaV6HomeError';err.hidden=true;err.className='ama-v6-refresh';err.onclick=()=>void amaV6Refresh(true);actions.after(err);

 const filters=document.querySelector('.ama-planning-filters'),search=document.createElement('label');search.className='ama-v6-search';search.innerHTML='<span class="ama-sr-only">Rechercher un logement dans le planning</span><input id="amaV6Search" type="search" placeholder="Rechercher un logement…" autocomplete="off">';filters.before(search);let timer;search.querySelector('input').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>renderPlanning(),180);};
 const workload=document.createElement('p');workload.id='amaV6Workload';workload.className='ama-v6-workload';workload.hidden=true;document.getElementById('missionForm').querySelector('[type=submit]').before(workload);for(const id of ['missionWorker','missionDate','missionHours','missionApartment']){document.getElementById(id).addEventListener('change',()=>void amaV6FormWorkload());}document.getElementById('missionHours').addEventListener('input',()=>void amaV6FormWorkload());
 const make=(id,title,content)=>{const d=document.createElement('dialog');d.id=id;d.className='ama-admin-sheet ama-v6-dialog';d.innerHTML='<div class="ama-admin-sheet-head"><h3>'+title+'</h3><button type="button" data-v6-close aria-label="Fermer">×</button></div>'+content;document.body.append(d);d.querySelector('[data-v6-close]').onclick=()=>{if(!amaV6IncidentBusy)d.close();};d.addEventListener('click',e=>{if(e.target===d&&!amaV6IncidentBusy){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});return d;};
 make('amaV6Todo','À traiter','<div class="ama-admin-sheet-body" data-private-content></div>');
 const form=make('amaV6IncidentForm','Signaler un problème','<form class="ama-admin-sheet-body"><h4 id="amaV6IncidentTitle"></h4><label>Catégorie<select id="amaV6IncidentCategory"><option value="damage">Dégât</option><option value="linen">Linge</option><option value="access">Accès</option><option value="other">Autre</option></select></label><label>Photos (10 maximum, facultatif)<input id="amaV6IncidentPhoto" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><img id="amaV6PhotoPreview" class="ama-v6-incident-photo" alt="Photo sélectionnée" hidden><label>Commentaire<textarea id="amaV6IncidentMessage" required maxlength="2000" rows="4" placeholder="Décrivez le problème…"></textarea></label><p class="muted">L’administrateur sera averti. Ce signalement ne valide pas la mission. Les photos sont partagées sur WhatsApp uniquement, sans stockage dans l’application.</p><p id="amaV6IncidentFeedback" role="status"></p><button type="submit" id="amaV6IncidentSend" class="primary">Enregistrer le signalement</button><button type="button" id="amaV6IncidentShare" class="primary" hidden>Partager sur WhatsApp</button><button type="button" id="amaV6IncidentCopy" class="soft" hidden>Copier le message WhatsApp</button></form>');form.querySelector('form').onsubmit=amaV6IncidentSend;form.addEventListener('cancel',e=>{if(amaV6IncidentBusy)e.preventDefault();});form.addEventListener('close',()=>{if(amaV6IncidentBusy)return;amaV6IncidentFiles=[];amaV6ShareFiles=[];amaV6ShareText='';amaV6IncidentSaved=false;amaV6IncidentMission=null;amaV6IncidentId=null;const input=document.getElementById('amaV6IncidentPhoto');input.value='';if(amaV6IncidentPreview)URL.revokeObjectURL(amaV6IncidentPreview);amaV6IncidentPreview=null;const image=document.getElementById('amaV6PhotoPreview');image.removeAttribute('src');image.hidden=true;});
 const file=document.getElementById('amaV6IncidentPhoto');file.onchange=()=>{const files=Array.from(file.files||[]);if(files.length>10){file.value='';amaV6IncidentFiles=[];document.getElementById('amaV6IncidentFeedback').textContent='Choisissez au maximum 10 photos.';return;}amaV6IncidentFiles=files;if(amaV6IncidentPreview)URL.revokeObjectURL(amaV6IncidentPreview);const img=document.getElementById('amaV6PhotoPreview');img.hidden=!files.length;if(files.length){amaV6IncidentPreview=URL.createObjectURL(files[0]);img.src=amaV6IncidentPreview;}else img.removeAttribute('src');};
 document.getElementById('amaV6IncidentShare').onclick=async()=>{if(!amaV6IncidentSaved||!session)return;const b=document.getElementById('amaV6IncidentShare');const feedback=document.getElementById('amaV6IncidentFeedback');b.disabled=true;try{if(!navigator.share||amaV6ShareFiles.length&&!navigator.canShare?.({files:amaV6ShareFiles}))throw Error('Partage indisponible ici. Copiez le message et utilisez votre galerie pour les photos.');await navigator.share({text:amaV6ShareText,...(amaV6ShareFiles.length?{files:amaV6ShareFiles}:{})});feedback.textContent='Fenêtre de partage fermée. Vérifiez l’envoi dans WhatsApp. Le signalement reste enregistré.';}catch(e){feedback.textContent=e.name==='AbortError'?'Partage annulé. Le signalement reste enregistré.':e.message;}finally{b.disabled=false;}};
 document.getElementById('amaV6IncidentCopy').onclick=async()=>{if(!amaV6IncidentSaved)return;try{await navigator.clipboard.writeText(amaV6ShareText);document.getElementById('amaV6IncidentFeedback').textContent='Message copié pour WhatsApp.';}catch{window.prompt('Copiez le message :',amaV6ShareText);}};
 const list=make('amaV6IncidentList','Signalements','<div class="ama-admin-sheet-body" data-private-content></div><div class="ama-admin-pager"><button type="button" data-incident-prev>Précédent</button><button type="button" data-incident-next>Suivant</button></div>');list.querySelector('[data-incident-prev]').onclick=()=>{amaV6IncidentPage=Math.max(0,amaV6IncidentPage-1);void amaV6IncidentListOpen(list.dataset.incident||null,false);};list.querySelector('[data-incident-next]').onclick=()=>{amaV6IncidentPage++;void amaV6IncidentListOpen(list.dataset.incident||null,false);};list.addEventListener('close',()=>list.querySelector('[data-private-content]').replaceChildren());
 const adminList=document.createElement('button');adminList.type='button';adminList.className='ama-v6-incident-shortcut';adminList.textContent='Signalements terrain ›';adminList.onclick=()=>void amaV6IncidentListOpen();document.getElementById('amaManage-overview').append(adminList);
 const workerButton=document.createElement('button');workerButton.type='button';workerButton.className='ama-photo-btn';workerButton.textContent='Signaler un problème';workerButton.onclick=()=>{const m=data.missions.find(x=>x.id===amaCurrentPhotoMission);if(m)amaV6IncidentOpen(m);};document.getElementById('amaPhotoApartmentInfo').after(workerButton);
 document.addEventListener('change',async e=>{const select=e.target;if(session?.role!=='admin'||!select.matches?.('[data-rrq-worker],.ama-rr-assignline select'))return;const card=select.closest('[data-work-day]');if(!card||!select.value)return;let note=card.querySelector('[data-v6-charge]');if(!note){note=document.createElement('p');note.dataset.v6Charge='';note.className='ama-v6-workload';select.closest('.ama-rr-assignline').after(note);}const worker=select.value,owner=session.id;note.textContent='Vérification de la charge…';try{const r=await amaV6Workload(worker,card.dataset.workDay,card.dataset.workHours);if(!card.isConnected||select.value!==worker||session?.id!==owner)return;note.textContent=r.missions+' mission(s) · '+hours(r.hours)+' ce jour. Avec cette mission : '+hours(r.projected)+'.';note.classList.toggle('ama-v6-heavy',r.projected>8);}catch{if(card.isConnected)note.textContent='Charge indisponible : vérification avant affectation.';}});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-v6-incident]');if(button){e.preventDefault();e.stopPropagation();amaV6IncidentOpen(data.missions.find(m=>m.id===button.dataset.v6Incident));}});
 new MutationObserver(()=>{if(document.getElementById('app').hidden)amaV6Reset();}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.role==='admin')void amaV6Refresh(true);});
}
amaV6Setup();

// Assistance explicable ; aucun envoi ni aucune affectation sans action de l'administrateur.
let amaV8Generation=0,amaV8MaintenanceGeneration=0,amaV8SearchGeneration=0;
const amaV8Icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="10" cy="19" r="2" fill="white"/></svg>';
function amaV8Plan(day,worker=''){document.getElementById('planningDate').value=day||amaRRToday();document.getElementById('planningWorkerFilter').value=worker;document.getElementById('planningStatusFilter').value='';document.getElementById('amaV6Search').value='';setTab('planning');renderPlanning();}
function amaV8LocalConflicts(apartment,day,exclude=null){return data.missions.filter(m=>m.apartmentId===apartment&&m.date===day&&m.id!==exclude&&m.status!=='cancelled'&&!m.prolonged).map(m=>({id:m.id,workers:sharedIds(m).map(id=>userById(id)?.name||'Intervenant').join(', '),status:m.status}));}
async function amaV8Conflicts(apartment,day,exclude=null){const r=await amaV6Rpc('ama_assignment_check',{p_apartment:apartment,p_day:day,p_exclude:exclude});if(!r||!Array.isArray(r.conflicts))throw Error('Installez la mise à jour SQL 07 pour vérifier les affectations.');return r.conflicts;}
function amaV8ConflictText(apartment,day,rows){const name=data.apartments.find(a=>a.id===apartment)?.name||'Ce logement';return name+' est déjà attribué à '+rows.map(x=>x.workers||'un intervenant').join(' / ')+' le '+dateFr(day)+'. Ouvrez la mission existante pour la modifier.';}
async function amaV8Guard(apartment,day,exclude=null){if(!apartment||!day)return;const rows=await amaV8Conflicts(apartment,day,exclude);if(rows.length)throw Error(amaV8ConflictText(apartment,day,rows));}
async function amaV8Hints(apartment,day,duration,host,select){
 if(!host||!select)return;const generation=String(++amaV8Generation),owner=session?.id;host.dataset.generation=generation;host.replaceChildren();if(session?.role!=='admin'||!apartment||!day)return;
 const note=document.createElement('p');note.className='ama-v8-note';note.textContent='Vérification des affectations…';host.append(note);
 try{const [check,suggestions]=await Promise.all([amaV8Conflicts(apartment,day),amaV6Rpc('ama_assignment_suggestions',{p_apartment:apartment,p_day:day,p_hours:Math.max(0,Number(duration)||0)}),amaNewLoad()]);if(session?.id!==owner||!host.isConnected||host.dataset.generation!==generation)return;host.replaceChildren();
 if(check.length){note.textContent=amaV8ConflictText(apartment,day,check);note.classList.add('ama-v8-warning');host.append(note);const b=document.createElement('button');b.type='button';b.className='soft';b.textContent='Voir la mission existante';b.onclick=()=>{for(const id of ['amaMissionDialog','amaStayDialog','amaRRDialog'])document.getElementById(id)?.close();amaV8Plan(day);};host.append(b);return;}
 const absent=amaNewAbsent(select.value,day);if(absent){const warning=document.createElement('p');warning.className='ama-v8-note ama-v8-warning';warning.textContent=(select.selectedOptions[0]?.textContent||'Cet intervenant')+' a déclaré une absence le '+dateFr(day)+'. Choisissez un autre intervenant parmi les suggestions ci-dessous.';host.append(warning);}
 if(!Array.isArray(suggestions))throw Error('Suggestions indisponibles');if(!suggestions.length){note.textContent='Aucun intervenant disponible à proposer pour cette date.';host.append(note);return;}
 const ordered=suggestions.filter(w=>!amaNewAbsent(w.id,day)).sort((a,b)=>(Number(a.projected)>8)-(Number(b.projected)>8)||(Number(b.experience)>0)-(Number(a.experience)>0)||Number(a.hours)-Number(b.hours));
 const panel=document.createElement('section');panel.className='ama-v12-suggest ama-v8-suggestions';const heading=document.createElement('small');heading.className='ama-v12-suggest-title';heading.textContent='Suggestion selon le planning';panel.append(heading);
 const chosen=document.createElement('div');panel.append(chosen);const details=document.createElement('details');details.className='ama-v12-other';const summary=document.createElement('summary');summary.textContent='Autres intervenants';details.append(summary);const alternatives=document.createElement('div');details.append(alternatives);panel.append(details);const caveat=document.createElement('small');caveat.textContent='Disponibilités à confirmer · tu gardes le choix final.';panel.append(caveat);
 function row(w,main){const b=document.createElement('button');b.type='button';b.className='ama-v8-suggestion ama-v12-suggestion'+(Number(w.projected)>8?' ama-v12-heavy':'');b.setAttribute('aria-pressed',String(select.value===w.id));const copy=document.createElement('span'),strong=document.createElement('strong');strong.textContent=w.full_name||'Intervenant';const small=document.createElement('small');small.textContent=Number(w.experience)>0?'Connaît ce logement':'Logement à découvrir';copy.append(strong,small);const load=document.createElement('span');load.className='ama-v12-suggest-load';load.textContent=hours(w.hours)+' → '+hours(w.projected);const label=document.createElement('small');label.textContent=Number(w.projected)>8?'Charge élevée':select.value===w.id?'Sélectionné':'Avec cette mission';load.append(label);b.append(copy,load);b.onclick=()=>{if(session?.id!==owner)return;select.value=w.id;select.dispatchEvent(new Event('change',{bubbles:true}));draw();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)panel.animate([{transform:'translateY(3px)'},{transform:'translateY(0)'}],{duration:200});};return b;}
 function draw(){const current=ordered.find(w=>w.id===select.value)||ordered[0];if(!current){chosen.textContent='Aucun remplaçant disponible à proposer.';alternatives.replaceChildren();details.hidden=true;return;}chosen.replaceChildren(row(current,true));alternatives.replaceChildren(...ordered.filter(w=>w.id!==current.id).map(w=>row(w,false)));details.hidden=ordered.length<2;}
 select.addEventListener('change',()=>{if(host.isConnected)draw();});draw();host.append(panel);
 }catch(e){if(session?.id===owner&&host.dataset.generation===generation){host.replaceChildren();note.textContent='Assistance indisponible. '+e.message;host.append(note);}}
}
function amaV12ScanSuggestions(root){if(session?.role!=='admin'||!root)return;root.querySelectorAll('[data-work-apartment]').forEach(card=>{const detail=card.querySelector('details'),select=card.querySelector('[data-rrq-worker],.ama-rr-assignline select');if(!detail?.open||!select||card.querySelector('[data-v8-hints]'))return;const h=document.createElement('div');h.dataset.v8Hints='';h.className='ama-v8-hints';detail.append(h);void amaV8Hints(card.dataset.workApartment,card.dataset.workDay,card.dataset.workHours,h,select);});}

function amaV8MissionHints(){const host=document.getElementById('amaV8MissionHints');return amaV8Hints(document.getElementById('missionApartment').value,document.getElementById('missionDate').value,document.getElementById('missionHours').value,host,document.getElementById('missionWorker'));}
function amaV8LocalIssues(){const day=amaRRToday(),rows=[];for(const a of activeApartments()){if(!(Number(a.duration)>0))rows.push({label:a.name,detail:'Durée du logement manquante',target:'apartments'});const rate=apartmentFinances.get(a.id);if(!rate||!(Number(rate.hourly_rate)>0))rows.push({label:a.name,detail:'Tarif absent ou nul (à vérifier si volontaire)',target:'apartments'});}for(const m of data.missions){if(m.status==='planned'&&!m.prolonged&&m.date<day)rows.push({label:m.apartmentName,detail:'Mission passée non validée',day:m.date,target:'planning'});}return rows;}
function amaV8GoIssue(row){document.getElementById('amaV8Maintenance')?.close();if(row.target==='planning'){amaV8Plan(row.day);return;}setTab('admin');amaShowManage(row.target||'imports');}
function amaV8Issue(body,row){const b=document.createElement('button');b.type='button';b.className='ama-v8-line';const title=document.createElement('strong');title.textContent=row.label||'Élément à vérifier';const sub=document.createElement('small');sub.textContent=(row.day?dateFr(row.day)+' · ':'')+(row.detail||'À vérifier');b.append(title,sub);b.onclick=()=>row.kind==='import_duplicate'?void amaV8Compare(row):amaV8GoIssue(row);body.append(b);}
function amaV8Group(body,title,items,draw){const details=document.createElement('details');details.className='ama-v8-group';const summary=document.createElement('summary');summary.textContent=title+' · '+items.length;details.append(summary);if(items.length)for(const row of items)draw(details,row);else{const empty=document.createElement('p');empty.textContent='Aucun élément détecté dans ce contrôle.';details.append(empty);}body.append(details);}
async function amaV9MaintenanceLoad(){
 if(session?.role!=='admin')return;const d=document.getElementById('amaV8Maintenance'),body=d.querySelector('[data-private-content]'),owner=session.id,generation=++amaV8MaintenanceGeneration;body.textContent='Vérification en cours…';if(!d.open)d.show();
 try{const r=await amaV6Rpc('ama_maintenance_report');const rr=await client.rpc('ama_rr_console');if(session?.id!==owner||generation!==amaV8MaintenanceGeneration||!d.open)return;if(!r?.anomalies||!Array.isArray(r.connections))throw Error('Installez la mise à jour SQL 07.');body.replaceChildren();const total=Number(r.anomalies.total||0)+(r.rates?.length||0)+(r.delivery?.length||0);const title=document.createElement('p');title.className='ama-v8-note';title.textContent=(total?total+' point(s) de données ou d’envoi affiché(s) à vérifier.':'Aucune anomalie détectée dans les données contrôlées.')+' Vérifié le '+new Date(r.checked_at).toLocaleString('fr-FR')+'. Les connexions sont détaillées ci-dessous.';body.append(title);
 amaV8Group(body,'Connexions & synchronisations',r.connections,(host,row)=>{const contact=amaV6Contacts.get(row.source),last=contact?.last||row.last_success,stamp=Date.parse(last||''),fresh=Number.isFinite(stamp)&&Date.now()-stamp<(row.source==='airbnb'?35:10)*60000,expired=['requested','running'].includes(row.state)&&Date.now()-Date.parse(row.requested_at)>600000;const card=document.createElement('article');card.className='ama-v8-line';const name=document.createElement('strong');name.textContent=({rr:'RentalReady',airbnb:'Airbnb',gdf:'Gîtes de France'})[row.source]||row.source;const text=document.createElement('small');text.textContent=(row.state==='failed'||contact?.problem||expired?'À vérifier':row.state==='running'||row.state==='requested'?'Synchronisation en attente':fresh?'À jour':'Dernier contact à vérifier')+' · '+(last?new Date(last).toLocaleString('fr-FR'):'Aucun succès confirmé');const b=document.createElement('button');b.type='button';b.className='soft';b.textContent='Synchroniser';b.dataset.syncSource=row.source;b.className='ama-sync';b.onclick=async()=>{await amaSyncRequest(row.source);await amaV8Maintenance();};card.append(name,text,b);host.append(card);});
 if(rr.error){const warn=document.createElement('p');warn.className='ama-v8-note ama-v8-warning';warn.textContent='Contrôle RentalReady indisponible : ouvrir la connexion pour vérifier.';body.append(warn);}else if(Number(rr.data?.review_count)>0){const warn=document.createElement('button');warn.type='button';warn.className='ama-v8-line';warn.textContent='RentalReady · '+rr.data.review_count+' élément(s) à vérifier / ajouter';warn.onclick=()=>{d.close();setTab('admin');amaShowManage('imports');document.querySelector('[data-rr="open-pending"]')?.click();};body.append(warn);}const incompleteClients=orderClients.filter(c=>!c.email||!c.billing_address).map(c=>({kind:'client',label:c.name,detail:'Coordonnées de facturation à compléter',target:'clients'}));const anomalies=(r.anomalies.items||[]).concat(incompleteClients);amaV8Group(body,'Doublons & modifications des imports',anomalies.filter(x=>['duplicate','import_duplicate','stay_change','mapping'].includes(x.kind)),amaV8Issue);
 amaV8Group(body,'Données & planning',anomalies.filter(x=>!['duplicate','import_duplicate','stay_change','mapping'].includes(x.kind)).concat(r.rates||[]),amaV8Issue);
 if(Number(r.anomalies.total)>anomalies.length){const limit=document.createElement('small');limit.textContent='Les 80 premières anomalies sont affichées. Corrigez-les puis actualisez pour la suite.';body.append(limit);}
 amaV8Group(body,'Notifications & envois',r.delivery||[],(host,row)=>{const line=document.createElement('p');line.textContent=row.label+' · '+(row.status==='uncertain'?'Envoi non confirmé : vérifier la boîte Envoyés avant tout nouvel envoi.':'Échec enregistré : consulter le suivi.');host.append(line);});

 }catch(e){if(session?.id!==owner||generation!==amaV8MaintenanceGeneration)return;body.replaceChildren();const p=document.createElement('p');p.textContent='Contrôle serveur indisponible. '+e.message;body.append(p);amaV8Group(body,'Vérifications locales (partielles)',amaV8LocalIssues(),amaV8Issue);}
}
function amaV8Search(){if(!session)return;const d=document.getElementById('amaV8Search'),input=d.querySelector('input');d.showModal();input.value='';d.querySelector('[data-private-content]').textContent='Recherchez un logement, une mission ou un client dans les données chargées.';input.focus();}
function amaV8Setup(){
 const make=(id,title)=>{const d=document.createElement('dialog');d.id=id;d.className='ama-admin-sheet ama-v6-dialog ama-v8-dialog';d.innerHTML='<div class="ama-admin-sheet-head"><h3>'+title+'</h3><button type="button" data-close aria-label="Fermer">×</button></div><div class="ama-admin-sheet-body" data-private-content></div>';d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.querySelector('[data-private-content]').replaceChildren();document.body.append(d);return d;};
 make('amaV8Compare','Comparer les sources');const maint=make('amaV8Maintenance','Maintenance & vérifications');const refresh=document.createElement('button');refresh.type='button';refresh.className='soft';refresh.textContent='Actualiser les contrôles';refresh.onclick=()=>void amaV8Maintenance();maint.querySelector('.ama-admin-sheet-head').after(refresh);
 const grid=document.querySelector('.ama-management-grid'),shortcut=document.createElement('button');shortcut.type='button';shortcut.className='ama-management-card';shortcut.id='amaV8MaintenanceButton';shortcut.innerHTML='<span class="ama-management-icon">'+amaV8Icon+'</span><span><strong>Maintenance & vérifications</strong><small>Anomalies et état des connexions</small></span><span aria-hidden="true">›</span>';shortcut.onclick=()=>void amaV8Maintenance();const backup=grid.querySelector('[data-manage-view="settings"]');grid.insertBefore(shortcut,backup);
 const imports=document.createElement('button');imports.type='button';imports.className='ama-v8-import-check soft';imports.textContent='Vérifier les doublons et les modifications';imports.onclick=()=>void amaV8Maintenance();document.getElementById('amaManage-imports').prepend(imports);
 const host=document.createElement('div');host.id='amaV8MissionHints';host.className='ama-v8-hints';document.getElementById('amaV6Workload').before(host);for(const id of ['missionApartment','missionDate','missionHours'])document.getElementById(id).addEventListener('change',()=>void amaV8MissionHints());
 document.getElementById('missionWorker').addEventListener('change',()=>void amaV8MissionHints());
 document.addEventListener('toggle',e=>{const detail=e.target;if(session?.role!=='admin'||!detail.open||!detail.matches?.('.ama-rr-detail'))return;const card=detail.closest('[data-work-apartment]'),select=card?.querySelector('select');if(!card||!select)return;let h=card.querySelector('[data-v8-hints]');if(!h){h=document.createElement('div');h.dataset.v8Hints='';h.className='ama-v8-hints';detail.append(h);}void amaV8Hints(card.dataset.workApartment,card.dataset.workDay,card.dataset.workHours,h,select);},true);
 const filter=document.createElement('label');filter.className='ama-v8-incident-filter';filter.innerHTML='Afficher<select id="amaV8IncidentFilter"><option value="open">À traiter</option><option value="resolved">Résolus</option><option value="all">Tous</option></select>';document.getElementById('amaV6IncidentList').querySelector('[data-private-content]').before(filter);filter.querySelector('select').onchange=()=>void amaV6IncidentListOpen(null,true);
 const priority=document.createElement('label');priority.innerHTML='Priorité<select id="amaV8IncidentPriority"><option value="normal">Courant</option><option value="urgent">Urgent — à vérifier rapidement</option></select>';document.getElementById('amaV6IncidentCategory').closest('label').after(priority);
 const search=make('amaV8Search','Recherche');const input=document.createElement('input');input.type='search';input.placeholder='Logement, mission ou client…';input.setAttribute('aria-label','Rechercher');search.querySelector('[data-private-content]').before(input);input.oninput=()=>{++amaV8SearchGeneration;const body=search.querySelector('[data-private-content]');body.replaceChildren();const term=amaV6Fold(input.value);if(term.length<2){body.textContent='Saisissez au moins deux caractères.';return;}if(session?.role!=='admin')return;let n=0;const add=(label,sub,open)=>{if(n++>=30)return;const b=document.createElement('button');b.type='button';b.className='ama-v8-line';const strong=document.createElement('strong');strong.textContent=label;const small=document.createElement('small');small.textContent=sub;b.append(strong,small);b.onclick=()=>{search.close();open();};body.append(b);};for(const a of activeApartments())if(amaV6Fold(a.name+' '+a.address).includes(term))add(a.name,'Logement',()=>{setTab('admin');amaShowManage('apartments');const field=document.getElementById('amaAptSearch');if(field){field.value=a.name;field.dispatchEvent(new Event('input',{bubbles:true}));}});for(const m of data.missions)if(amaV6Fold(m.apartmentName+' '+m.workerName+' '+m.date).includes(term))add(m.apartmentName,dateFr(m.date)+' · '+m.workerName,()=>amaV8Plan(m.date,m.workerId));for(const c of orderClients)if(amaV6Fold(c.name).includes(term))add(c.name,'Client',()=>{setTab('admin');amaShowManage('clients');});if(!n)body.textContent='Aucun résultat dans les données chargées.';};
 const searchButton=document.createElement('button');searchButton.type='button';searchButton.className='ama-v8-search-button';searchButton.textContent='Rechercher un logement, une mission, un client…';searchButton.onclick=amaV8Search;document.getElementById('amaV6HomeError').after(searchButton);
 const invoice=document.createElement('button');invoice.type='button';invoice.id='amaV8InvoiceCheck';invoice.className='ama-v8-invoice-check soft';invoice.textContent='Vérifier les données avant facturation';invoice.onclick=()=>void amaV8Maintenance();document.getElementById('amaPaymentTracking').before(invoice);
 new MutationObserver(()=>{const hidden=document.getElementById('app').hidden,admin=session?.role==='admin';searchButton.hidden=hidden||!admin;invoice.hidden=hidden||!admin;if(hidden){const alerts=document.getElementById('amaV8PlanningAlerts');if(alerts){alerts.hidden=true;alerts.replaceChildren();}amaV8Generation++;amaV8MaintenanceGeneration++;for(const id of ['amaV8Maintenance','amaV8Search','amaV8Compare']){const d=document.getElementById(id);d.close();d.querySelector('[data-private-content]').replaceChildren();}host.replaceChildren();conflict.hidden=true;input.value='';document.getElementById('amaV6Actions').open=false;}}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});searchButton.hidden=true;invoice.hidden=true;
}
amaV8Setup();
function amaV8PaintPlanning(){
 const section=document.querySelector('.ama-planning-filters');if(!section)return;if(session?.role!=='admin'){const old=document.getElementById('amaV8PlanningAlerts');if(old){old.hidden=true;old.replaceChildren();}return;}let box=document.getElementById('amaV8PlanningAlerts');if(!box){box=document.createElement('details');box.id='amaV8PlanningAlerts';box.className='ama-v8-planning-alerts';section.after(box);}const day=document.getElementById('planningDate').value||amaRRToday(),missions=data.missions.filter(m=>m.date===day&&['planned','done'].includes(m.status)&&!m.prolonged);const rows=[];for(const w of activeWorkers()){const ms=missions.filter(m=>m.status==='planned'&&sharedIds(m).includes(w.id)),n=ms.reduce((t,m)=>t+sharedHours(m),0);if(n>8)rows.push({label:w.name,detail:hours(n)+' prévues · charge à vérifier',day,worker:w.id});}for(const m of missions){if(!(Number(m.hours)>0))rows.push({label:m.apartmentName,detail:'Durée manquante',day});}const keys=new Set();for(const m of missions){if(keys.has(m.apartmentId))continue;const matches=missions.filter(x=>x.apartmentId===m.apartmentId);if(matches.length>1)rows.push({label:m.apartmentName,detail:'Plusieurs missions le même jour : vérifier le doublon',day});keys.add(m.apartmentId);}box.replaceChildren();box.hidden=!rows.length;const summary=document.createElement('summary');summary.textContent=rows.length+' point(s) à vérifier dans le planning';box.append(summary);for(const r of rows){const b=document.createElement('button');b.type='button';b.className='ama-v8-line';b.textContent=r.label+' · '+r.detail;b.onclick=()=>amaV8Plan(r.day,r.worker||'');box.append(b);}
}
async function amaV8Compare(row){
 if(session?.role!=='admin')return;const d=document.getElementById('amaV8Compare'),body=d.querySelector('[data-private-content]'),owner=session.id;body.textContent='Chargement…';d.dataset.context=row.id+':'+row.day;d.showModal();try{const r=await amaV6Rpc('ama_import_compare',{p_apartment:row.id,p_day:row.day});if(session?.id!==owner||!d.open||d.dataset.context!==row.id+':'+row.day)return;body.replaceChildren();const title=document.createElement('p');title.textContent=row.label+' · ménage le '+dateFr(row.day)+'. Même logement et même date ne suffisent pas à confirmer un doublon. Comparez les réservations avant de les lier ou de les ignorer.';body.append(title);for(const item of r.items||[]){const card=document.createElement('article');card.className='ama-v8-line';const strong=document.createElement('strong');strong.textContent=item.source;const sub=document.createElement('small');sub.textContent=(item.start_date?dateFr(item.start_date)+' → ':'')+dateFr(item.end_date)+' · '+item.state+(item.issue?' · '+item.issue:'');card.append(strong,sub);body.append(card);}for(const m of r.missions||[]){const p=document.createElement('p');p.textContent='Mission existante · '+m.workers+' · '+m.status;body.append(p);}const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='Ouvrir les imports pour décider';b.onclick=()=>{d.close();document.getElementById('amaV8Maintenance').close();setTab('admin');amaShowManage('imports');};body.append(b);}catch(e){if(session?.id===owner)body.textContent='Comparaison indisponible : '+e.message;}
}
function amaV8InvoiceCheck(){const b=document.getElementById('amaV8InvoiceCheck');if(!b||session?.role!=='admin')return;const month=document.getElementById('invoiceMonth').value||monthNow(),ms=data.missions.filter(m=>m.date?.startsWith(month)&&['done','not_entered'].includes(m.status)&&!m.prolonged);let count=0;for(const m of ms){const finance=missionFinances.get(m.id)||apartmentFinances.get(m.apartmentId),apt=data.apartments.find(a=>a.id===m.apartmentId),c=orderClients.find(c=>c.id===apt?.clientId);if(!finance||!(Number(finance.hourly_rate)>0)||!c?.email||!c?.billing_address)count++;}b.textContent=count?count+' prestation(s) : vérifier tarif ou coordonnées avant facturation':'Contrôler les données de facturation';}

// Pages de gestion complètes, intégrées à la navigation et à son bouton Retour.
let amaV9HomeScroll=null,amaV9HealthGeneration=0;
const amaV9Tools='M14 5a5 5 0 0 0-6 6L3 16a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-3-3 3-3Z';
function amaV9Open(view){if(session?.role!=='admin')return;setTab('admin');amaShowManage(view);}
async function amaV10MaintenanceLegacy(){if(session?.role!=='admin')return;const owner=session.id,healthGeneration=++amaV9HealthGeneration;amaV9Open('maintenance');await amaV9MaintenanceLoad();if(session?.id!==owner||healthGeneration!==amaV9HealthGeneration)return;amaSyncPaint();const d=document.getElementById('amaV8Maintenance'),body=d.querySelector('[data-private-content]');try{const r=await amaV6Rpc('ama_maintenance_health');if(session?.id!==owner||healthGeneration!==amaV9HealthGeneration||amaManageView!=='maintenance')return;if(!r||!Number.isFinite(Number(r.database_bytes)))throw Error('SQL 08 requis');const card=document.createElement('section');card.className='ama-v9-health';const h=document.createElement('h3');h.textContent='État réel de la base';const text=document.createElement('p');text.textContent=(Number(r.database_bytes)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo · '+r.pending_sync+' synchronisation(s) en attente · '+r.pending_mail+' facture(s) et '+r.pending_reminders+' relance(s) en file.';card.append(h,text);const note=document.createElement('small');note.textContent='Stockage de la base uniquement, distinct du volume de requêtes des journaux.';card.append(note);const details=document.createElement('details');details.innerHTML='<summary>Stockage et entretien des tables</summary>';for(const row of r.tables||[]){const p=document.createElement('p');p.textContent=row.name+' · '+(Number(row.bytes)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo · environ '+row.estimated_rows+' lignes · '+row.estimated_dead_rows+' lignes mortes estimées'+(row.last_autovacuum?' · dernier autovacuum : '+new Date(row.last_autovacuum).toLocaleString('fr-FR'):' · aucun autovacuum enregistré');details.append(p);}card.append(details);body.prepend(card);}catch(e){if(session?.id===owner&&healthGeneration===amaV9HealthGeneration&&amaManageView==='maintenance'){const p=document.createElement('p');p.textContent='Mesures de la base indisponibles : '+e.message;body.prepend(p);}}}
function amaV9FinanceControls(){const body=document.getElementById('amaV9FinanceRows');body.replaceChildren();for(const c of orderClients.filter(c=>!c.email||!c.billing_address)){amaV8Issue(body,{label:c.name,detail:'E-mail ou adresse de facturation à compléter',target:'clients'});}for(const a of activeApartments()){const f=apartmentFinances.get(a.id);if(!f||!(Number(f.hourly_rate)>0))amaV8Issue(body,{label:a.name,detail:'Tarif absent ou nul — à vérifier si volontaire',target:'apartments'});}if(!body.children.length)body.textContent='Aucune coordonnée manquante ni tarif absent ou nul détecté dans les données chargées.';}
async function amaV9CleanupIncident(){if(session?.role!=='admin')return;const status=document.getElementById('amaV9IncidentCleanStatus');try{const preview=await amaV6Rpc('ama_incident_cleanup',{p_apply:false});status.textContent=preview.eligible+' signalement(s) résolu(s) supprimable(s). Les signalements ouverts sont conservés.';if(!preview.eligible||!confirm('Supprimer définitivement les '+preview.eligible+' signalement(s) résolu(s) et leurs rappels ? Les missions sont conservées.'))return;const r=await amaV6Rpc('ama_incident_cleanup',{p_apply:true});status.textContent=r.deleted+' signalement(s) supprimé(s).';await amaV6IncidentListOpen(null,true);await loadNotifications();renderNotifications();await amaV6Refresh(true);}catch(e){status.textContent='Suppression refusée : '+e.message;}}
async function amaV9CleanupImport(source){if(session?.role!=='admin')return;const before=amaRRToday(),rpc=source==='rr'?'ama_rr_cleanup_v5':'ama_stay_cleanup',args={p_apply:false,p_before:before,p_include_cancelled:true,...(source==='rr'?{}:{p_source:source})};const status=document.getElementById(source==='rr'?'amaV9RRCleanStatus':'amaV9StayCleanStatus');try{const preview=await amaV6Rpc(rpc,args);status.textContent=preview.eligible+' import(s) passé(s) supprimable(s). Missions liées et alertes non traitées protégées.';if(!preview.eligible||!confirm('Supprimer '+preview.eligible+' fiche(s) d’import antérieure(s) à aujourd’hui ? Les missions, factures et références anti-réimportation restent conservées.'))return;const r=await amaV6Rpc(rpc,{...args,p_apply:true});status.textContent=r.deleted+' fiche(s) supprimée(s).';if(source==='rr')await amaRRLoad();else await amaStayPanelLoad();await amaV6Refresh(true);}catch(e){status.textContent='Nettoyage refusé : '+e.message;}}
function amaV9Setup(){
 AMA_UI_PATHS.maintenance=amaV9Tools;AMA_UI_PATHS.payments='M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h4';AMA_UI_PATHS.incidents='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v6 M12 16v.1';
 const grid=document.querySelector('.ama-management-grid'),backup=grid.querySelector('[data-manage-view="settings"]');const card=(id,title,desc,fn)=>{const b=document.createElement('button');b.id=id;b.type='button';b.className='ama-management-card';b.innerHTML='<span class="ama-management-icon">'+amaUiIcon(title==='Signalements'?'incidents':'payments')+'</span><span><strong>'+title+'</strong><small>'+desc+'</small></span><span aria-hidden="true">›</span>';b.onclick=fn;grid.insertBefore(b,backup);return b;};
 const old=document.getElementById('amaV8MaintenanceButton');old.querySelector('.ama-management-icon').innerHTML=amaUiIcon('maintenance');old.querySelector('strong').textContent='Maintenance';
 const payment=document.getElementById('amaPaymentTracking');payment.remove();card('amaV9PaymentsCard','Suivi des paiements','Paiements et contrôles de facturation',()=>void amaPaymentListOpen());
 document.querySelector('.ama-v6-incident-shortcut')?.remove();card('amaV9IncidentsCard','Signalements','À traiter et historique résolu',()=>void amaV6IncidentListOpen());
 const sec=document.createElement('button');sec.type='button';sec.className='ama-management-card';sec.innerHTML='<span class="ama-management-icon">'+amaUiIcon('security')+'</span><span><strong>Sécurité</strong><small>Connexions et accès</small></span>';sec.dataset.manageView='security';grid.append(sec,old);backup.hidden=true;
 document.getElementById('amaManageAdd')?.remove();document.getElementById('amaManageAddChoices')?.remove();document.querySelector('.ama-v8-search-button')?.remove();document.getElementById('amaV8InvoiceCheck')?.remove();document.querySelector('.ama-v8-import-check')?.remove();
 for(const [id,view] of [['amaV8Maintenance','maintenance'],['amaPaymentList','payments'],['amaV6IncidentList','incidents']]){const d=document.getElementById(id);d.classList.add('ama-page-dialog');document.getElementById('amaManage-'+view).append(d);d.querySelector('.ama-admin-sheet-head').hidden=true;}
 const finance=document.createElement('details');finance.id='amaV9FinanceControls';finance.className='ama-v8-group';finance.innerHTML='<summary>Contrôles des données de facturation</summary><div id="amaV9FinanceRows"></div>';finance.ontoggle=()=>{if(finance.open)amaV9FinanceControls();};document.getElementById('amaPaymentList').querySelector('.ama-admin-sheet-body').prepend(finance);
 const clean=document.createElement('div');clean.className='ama-v9-clean';clean.innerHTML='<button type="button" class="danger">Effacer l’historique résolu</button><p id="amaV9IncidentCleanStatus" role="status"></p>';clean.querySelector('button').onclick=()=>void amaV9CleanupIncident();document.getElementById('amaV6IncidentList').append(clean);
 const home=document.getElementById('amaHomeProgram');home.removeAttribute('data-ama-tab');home.addEventListener('click',e=>{if(session?.role!=='admin')return;e.preventDefault();e.stopImmediatePropagation();amaV9HomeScroll=window.scrollY;const card=document.getElementById('createMissionCard'),sheet=document.getElementById('amaMissionDialog');card.classList.remove('ama-mission-form-collapsed');if(!sheet.open)sheet.showModal();document.body.classList.add('ama-mission-modal-open');},true);document.addEventListener('close',e=>{if(e.target.id==='amaMissionDialog'&&amaV9HomeScroll!==null){const y=amaV9HomeScroll;amaV9HomeScroll=null;requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));}},true);
}
amaV9Setup();

// A : menu Maintenance. B : onglets Paiements et Signalements.
let amaV10Maintenance=null,amaV10Owner=null,amaV10Section='',amaV10Generation=0,amaV10PaymentFilter='pending',amaV10PayGeneration=0,amaV10IncidentFilter='reported',amaV10IncidentPage=0,amaV10IncidentGeneration=0;
const amaV10Icons={connections:'M5 6h14v12H5z M9 3v3 M15 3v3 M9 18v3 M15 18v3',anomalies:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v6 M12 16v.1',delivery:'M3 10 21 3l-7 18-3-8-8-3Z M11 13 21 3',storage:'M4 6c0-4 16-4 16 0v12c0 4-16 4-16 0V6 M4 6c0 4 16 4 16 0 M4 12c0 4 16 4 16 0'};
const amaV10Svg=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+amaV10Icons[kind]+'"/></svg>';
function amaV10Tabs(host,specs,active,open){host.replaceChildren();for(const [key,label,count] of specs){const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(key===active));b.className=key===active?'active':'';b.textContent=label+(Number.isFinite(Number(count))?' · '+count:'');b.onclick=()=>open(key);host.append(b);}}
async function amaV8Maintenance(){if(session?.role!=='admin')return;const owner=session.id,gen=++amaV10Generation;amaV9Open('maintenance');const body=document.getElementById('amaV8Maintenance').querySelector('[data-private-content]');body.textContent='Vérification…';document.getElementById('amaV8Maintenance').show();const results=await Promise.allSettled([amaV6Rpc('ama_maintenance_report'),amaV6Rpc('ama_maintenance_health'),amaV6Rpc('ama_rr_console')]);if(session?.id!==owner||gen!==amaV10Generation)return;amaV10Owner=owner;amaV10Maintenance={report:results[0].status==='fulfilled'?results[0].value:null,health:results[1].status==='fulfilled'?results[1].value:null,rr:results[2].status==='fulfilled'?results[2].value:null};amaV10PaintMaintenance();}
function amaV10PaintMaintenance(){if(session?.role!=='admin'||amaV10Owner!==session.id)return;amaV12MaintenanceCards();const {report:r,health:h,rr}=amaV10Maintenance,body=document.getElementById('amaV8Maintenance').querySelector('[data-private-content]');body.replaceChildren();const valid=!!r?.anomalies&&Array.isArray(r?.connections);const issueCount=valid?Number(r.anomalies.total||0)+(r.rates?.length||0)+(r.delivery?.length||0):null;
 const intro=document.createElement('p');intro.className='ama-v10-status'+(!valid||issueCount>0?' ama-v10-status-warn':'');intro.textContent=valid?(issueCount?issueCount+' point(s) à vérifier':'Aucune anomalie détectée dans les contrôles effectués')+' · '+new Date(r.checked_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Contrôles indisponibles — réessayez';body.append(intro);
 if(valid&&issueCount>0){intro.setAttribute('role','button');intro.tabIndex=0;intro.setAttribute('aria-label','Voir les points à vérifier');const open=()=>{amaV10Section=Number(r.anomalies.total||0)+(r.rates?.length||0)>0?'anomalies':'delivery';amaV10PaintMaintenance();};intro.onclick=open;intro.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};}
 if(!amaV10Section){const group=document.createElement('div');group.className='ama-v18-group';body.append(group);for(const [key,title,value] of [['connections','Connexions',valid?r.connections.length+' connexions':'Indisponible'],['anomalies','Anomalies',valid?Number(r.anomalies.total||0)+(r.rates?.length||0)+' à vérifier':'Indisponible'],['delivery','Envois',valid?(r.delivery?.length||0)+' à vérifier':'Indisponible'],['storage','Stockage',Number.isFinite(Number(h?.database_bytes))?(Number(h.database_bytes)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo':'Indisponible']]){const b=document.createElement('button');b.type='button';b.className='ama-v10-menu-row';b.innerHTML='<span class="ama-v18-icon">'+amaV10Svg(key)+'</span><span class="ama-v18-label"><strong>'+title+'</strong><small>'+({connections:'RentalReady · Airbnb · Gîtes',anomalies:'Imports et planning',delivery:'Factures et notifications',storage:'Actualisation et anciens imports'})[key]+'</small></span><span class="ama-v18-count">'+esc(value)+'</span><i aria-hidden="true">›</i>';b.onclick=()=>{amaV10Section=key;amaV10PaintMaintenance();};group.append(b);}const backupLink=document.createElement('button');backupLink.type='button';backupLink.className='ama-v10-menu-row';backupLink.innerHTML='<span class="ama-v18-icon">'+amaUiIcon('settings')+'</span><span class="ama-v18-label"><strong>Sauvegarde et exports</strong><small>Copie des données</small></span><i aria-hidden="true">›</i>';backupLink.onclick=()=>amaShowManage('settings');group.append(backupLink);return;}
 const back=document.createElement('button');back.type='button';back.className='soft ama-v10-back';back.textContent='‹ Menu Maintenance';back.onclick=()=>{amaV10Section='';amaV10PaintMaintenance();};body.append(back);const title=document.createElement('h3');title.textContent=({connections:'Connexions & synchronisations',anomalies:'Anomalies à vérifier',delivery:'Notifications & envois',storage:'Stockage de la base'})[amaV10Section];body.append(title);
 if(amaV10Section==='connections'){void amaRRLoad();void amaStayLoad();amaSyncPaint();return;}
 if(amaV10Section==='anomalies'){if(!valid){body.append(document.createTextNode('Diagnostic indisponible.'));return;}const items=(r.anomalies.items||[]).concat(r.rates||[]);for(const row of items)amaV8Issue(body,row);if(!items.length)body.append(document.createTextNode('Aucune anomalie détectée dans les données contrôlées.'));if(Number(r.anomalies.total)>(r.anomalies.items?.length||0)){const p=document.createElement('p');p.textContent='Les premières anomalies sont affichées ; actualisez après correction pour la suite.';body.append(p);}return;}
 if(amaV10Section==='delivery'){if(!valid){body.append(document.createTextNode('Contrôle des envois indisponible.'));return;}const queue=document.createElement('p');queue.textContent=h?.pending_mail!==undefined?h.pending_mail+' facture(s) et '+h.pending_reminders+' relance(s) en attente.':'Files d’envoi indisponibles.';body.append(queue);for(const row of r.delivery||[]){const line=document.createElement('p');line.className='ama-v10-menu-note';line.textContent=row.label+' · '+(row.status==='uncertain'?'Envoi non confirmé : vérifier avant tout renvoi.':'Échec enregistré : consulter le suivi.');body.append(line);}if(!r.delivery?.length)body.append(document.createTextNode('Aucun échec enregistré dans les contrôles effectués.'));return;}
 const help=document.createElement('div');help.className='ama-v17-tools';const refreshApp=document.createElement('button');refreshApp.type='button';refreshApp.textContent='Actualiser l’application';refreshApp.onclick=()=>location.reload();const explain=document.createElement('small');explain.textContent='Recharge les fichiers de l’application sur cet appareil. Le stockage de l’appareil et la connexion restent conservés.';const cleanup=document.createElement('button');cleanup.type='button';cleanup.textContent='Examiner les anciens imports';cleanup.onclick=()=>{amaV10Section='connections';amaV10PaintMaintenance();};const cleanupNote=document.createElement('small');cleanupNote.textContent='Ouvrez une connexion, puis Filtre et nettoyage pour examiner les imports éligibles avant confirmation.';help.append(refreshApp,explain,cleanup,cleanupNote);body.append(help);
 if(!Number.isFinite(Number(h?.database_bytes))){body.append(document.createTextNode('Mesures de stockage indisponibles.'));return;}const total=document.createElement('p');total.textContent=(Number(h.database_bytes)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo utilisés par la base. Ce volume est distinct des requêtes de journaux.';body.append(total);for(const row of h.tables||[]){const line=document.createElement('article');line.className='ama-v10-storage';const name=document.createElement('strong');name.textContent=row.name;const small=document.createElement('small');small.textContent=(Number(row.bytes)/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo · environ '+row.estimated_rows+' lignes · '+row.estimated_dead_rows+' lignes mortes estimées';line.append(name,small);body.append(line);}}
async function amaPaymentListLoad(){if(session?.role!=='admin')return;const owner=session.id,gen=++amaV10PayGeneration,source=amaPaymentCompany,filter=amaV10PaymentFilter,feedback=document.getElementById('amaPaymentListFeedback');feedback.textContent='Chargement…';try{const r=await amaV6Rpc('ama_payment_browse',{p_company:source,p_filter:filter,p_offset:amaPaymentOffset});if(session?.id!==owner||gen!==amaV10PayGeneration)return;if(!r?.stats||!Array.isArray(r.items))throw Error('Installez le SQL 09.');feedback.textContent='';amaV10Tabs(document.getElementById('amaV10PaymentTabs'),[['pending','À encaisser',r.stats.pending],['overdue','En retard',r.stats.overdue],['paid','Payées',r.stats.paid]],filter,key=>{amaV10PaymentFilter=key;amaPaymentOffset=0;void amaPaymentListLoad();});const summary=document.getElementById('amaV10PaymentSummary');summary.textContent=euro(Number(r.stats.pending_cents)/100)+' à encaisser · '+r.stats.overdue+' en retard'+(r.stats.incomplete?' · '+r.stats.incomplete+' suivi(s) à compléter':'');const rows=document.getElementById('amaPaymentListRows');rows.classList.add('ama-v18-group');rows.replaceChildren();for(const p of r.items){const b=document.createElement('button');b.type='button';b.className='ama-v10-invoice';const name=document.createElement('strong');name.textContent=p.client_name;const amount=document.createElement('strong');amount.textContent=p.total_cents===null?'À compléter':euro(Math.max(0,Number(p.total_cents)-Number(p.paid_cents))/100);const sub=document.createElement('small');sub.textContent=p.number+' · '+(p.payment_status==='paid'?'Payée':p.due_date?'Échéance : '+dateFr(p.due_date):'Échéance à compléter');b.append(name,amount,sub);b.onclick=()=>void amaPaymentOpen(p.invoice_id,p.company_id);const line=document.createElement('div');line.className='ama-invoice-row';line.append(b,amaInvoiceMenu(p.invoice_id,p.company_id,'payments'));rows.append(line);}if(!r.items.length)rows.textContent=({pending:'Aucune facture à encaisser.',overdue:'Aucune facture en retard.',paid:'Aucune facture marquée payée.'})[filter];document.getElementById('amaPaymentPrev').disabled=amaPaymentOffset===0;document.getElementById('amaPaymentNext').disabled=amaPaymentOffset+20>=r.total;}catch(e){if(session?.id!==owner||gen!==amaV10PayGeneration)return;feedback.textContent='Suivi indisponible : '+e.message;document.getElementById('amaPaymentListRows').replaceChildren();document.getElementById('amaV10PaymentSummary').textContent='';}}
async function amaV6IncidentListOpen(id=null,reset=true){if(session?.role!=='admin')return;if(id){document.getElementById('amaV6IncidentList').querySelector('[data-private-content]').classList.remove('ama-v18-incident-list');document.getElementById('amaV6IncidentList').querySelector('.ama-v9-clean').hidden=true;document.getElementById('amaV6IncidentList').querySelector('.ama-admin-pager').hidden=true;document.getElementById('amaV10IncidentTabs').hidden=true;document.getElementById('amaV10IncidentBack').hidden=false;await amaV10IncidentDetail(id,reset);return;}document.getElementById('amaV6IncidentList').querySelector('.ama-v9-clean').hidden=amaV10IncidentFilter!=='resolved';document.getElementById('amaV6IncidentList').querySelector('.ama-admin-pager').hidden=false;document.getElementById('amaV10IncidentTabs').hidden=false;document.getElementById('amaV10IncidentBack').hidden=true;amaV9Open('incidents');const d=document.getElementById('amaV6IncidentList');if(!d.open)d.show();if(reset)amaV10IncidentPage=0;const owner=session.id,gen=++amaV10IncidentGeneration,body=d.querySelector('[data-private-content]');body.textContent='Chargement…';try{const r=await amaV6Rpc('ama_incident_browse',{p_filter:amaV10IncidentFilter,p_offset:amaV10IncidentPage*20});if(session?.id!==owner||gen!==amaV10IncidentGeneration)return;if(!r?.stats||!Array.isArray(r.items))throw Error('Installez le SQL 09.');amaV10Tabs(document.getElementById('amaV10IncidentTabs'),[['reported','À traiter',r.stats.reported],['in_progress','En cours',r.stats.in_progress],['resolved','Résolus',r.stats.resolved]],amaV10IncidentFilter,key=>{amaV10IncidentFilter=key;void amaV6IncidentListOpen(null,true);});body.replaceChildren();body.classList.add('ama-v18-incident-list');for(const row of r.items){const b=document.createElement('button');b.type='button';b.className='ama-v10-incident';const name=document.createElement('strong');name.textContent=row.apartment_name;const sub=document.createElement('small');sub.textContent=(row.author_name||'Intervenant')+' · '+dateFr(row.mission_date);const label=document.createElement('span');label.textContent=row.priority==='urgent'&&row.status!=='resolved'?'Urgent':({reported:'À traiter',in_progress:'En cours',resolved:'Résolu'})[row.stage]||'À traiter';label.className=row.priority==='urgent'?'ama-v10-warn':'ama-v10-good';const text=document.createElement('p');text.textContent=(amaV6Labels[row.category]||'Autre')+' · '+row.excerpt;b.append(name,label,sub,text);b.onclick=()=>void amaV6IncidentListOpen(row.id);body.append(b);}if(!r.items.length)body.textContent='Aucun signalement dans cette catégorie.';d.querySelector('[data-incident-prev]').disabled=!amaV10IncidentPage;d.querySelector('[data-incident-next]').disabled=(amaV10IncidentPage+1)*20>=r.total;}catch(e){if(session?.id===owner&&gen===amaV10IncidentGeneration)body.textContent='Signalements indisponibles : '+e.message;}}
function amaV10Setup(){
 const refresh=document.getElementById('amaV8Maintenance').querySelector(':scope>button');if(refresh){refresh.id='amaV10Refresh';refresh.setAttribute('aria-label','Actualiser les contrôles');refresh.title='Actualiser les contrôles';refresh.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5 M4 17v-5h5 M20 12a8 8 0 0 0-14-5 M4 12a8 8 0 0 0 14 5"/></svg>';document.getElementById('amaManageHeading').append(refresh);}
 const payments=document.getElementById('amaPaymentList'),content=payments.querySelector('.ama-admin-sheet-body'),tabs=document.createElement('div');tabs.id='amaV10PaymentTabs';tabs.className='ama-v10-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Statut des paiements');const summary=document.createElement('p');summary.id='amaV10PaymentSummary';summary.className='ama-v10-status';content.prepend(tabs);document.getElementById('amaPaymentListFeedback').before(summary);const controls=document.getElementById('amaV9FinanceControls');content.append(controls);content.querySelectorAll('p').forEach(p=>{if(p.textContent.startsWith('Les factures envoyées'))p.hidden=true;});amaV10Tabs(tabs,[['pending','À encaisser'],['overdue','En retard'],['paid','Payées']],amaV10PaymentFilter,key=>{amaV10PaymentFilter=key;amaPaymentOffset=0;void amaPaymentListLoad();});
 const list=document.getElementById('amaV6IncidentList');list.querySelector('.ama-v8-incident-filter').hidden=true;const itabs=document.createElement('div');itabs.id='amaV10IncidentTabs';itabs.className='ama-v10-tabs';itabs.setAttribute('role','tablist');itabs.setAttribute('aria-label','Statut des signalements');list.querySelector('[data-private-content]').before(itabs);const back=document.createElement('button');back.id='amaV10IncidentBack';back.type='button';back.className='soft ama-v10-back';back.textContent='‹ Liste des signalements';back.hidden=true;back.onclick=()=>void amaV6IncidentListOpen();itabs.before(back);amaV10Tabs(itabs,[['reported','À traiter'],['in_progress','En cours'],['resolved','Résolus']],amaV10IncidentFilter,key=>{amaV10IncidentFilter=key;void amaV6IncidentListOpen();});list.querySelector('[data-incident-prev]').onclick=()=>{amaV10IncidentPage=Math.max(0,amaV10IncidentPage-1);void amaV6IncidentListOpen(null,false);};list.querySelector('[data-incident-next]').onclick=()=>{amaV10IncidentPage++;void amaV6IncidentListOpen(null,false);};
 document.getElementById('amaV8MaintenanceButton').onclick=()=>{amaV10Section='';void amaV8Maintenance();};
 new MutationObserver(()=>{if(document.getElementById('app').hidden){amaV10Generation++;amaV10PayGeneration++;amaV10IncidentGeneration++;amaV10Maintenance=null;amaV10Owner=null;amaV10Section='';amaV10PaymentFilter='pending';amaV10IncidentFilter='reported';document.getElementById('amaV9IncidentCleanStatus').textContent='';document.getElementById('amaV10PaymentSummary').textContent='';}}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});
}
amaV10Setup();

// Vue des connexions : les mouvements représentent l'état connu, pas une collecte permanente.
const amaNetworkErrors=new Map();
function amaNetworkState(source,at=Date.now()){
 const contact=amaV6Contacts.get(source),job=amaSyncJobs.find(j=>j.source===source),stamp=Date.parse(contact?.last||''),jobAt=Date.parse(job?.finished_at||job?.requested_at||''),requested=Date.parse(job?.started_at||job?.requested_at||'');
 const hasContact=Number.isFinite(stamp)&&stamp<=at+300000,delay=(source==='airbnb'?35:10)*60000;
 if(['requested','running'].includes(job?.state)){if(Number.isFinite(requested)&&at-requested>600000)return {state:'late',label:'Délai dépassé',last:hasContact?stamp:null};return {state:'pending',label:job.state==='requested'?'Demandée':'En cours',last:hasContact?stamp:null};}
 const errorAt=amaNetworkErrors.get(source);if(errorAt&&(hasContact&&stamp>errorAt||job?.state==='succeeded'&&Number.isFinite(jobAt)&&jobAt>errorAt))amaNetworkErrors.delete(source);
 if(contact?.problem||amaNetworkErrors.has(source)||job?.state==='failed'&&(!hasContact||!Number.isFinite(jobAt)||jobAt>=stamp))return {state:'error',label:'Erreur',last:hasContact?stamp:null};
 if(!hasContact)return {state:'unknown',label:'À vérifier',last:null};
 return at-stamp<=delay?{state:'ok',label:'À jour',last:stamp}:{state:'late',label:'En retard',last:stamp};
}
function amaNetworkPaint(){const root=document.getElementById('amaConnectionsMap');if(!root)return;const active=session?.role==='admin'&&!document.getElementById('app').hidden&&!document.hidden&&tab==='admin'&&amaManageView==='imports';root.dataset.active=String(active);if(session?.role!=='admin')return;
 for(const source of ['rr','airbnb','gdf']){const state=amaNetworkState(source),node=root.querySelector('[data-network-source="'+source+'"]'),wire=root.querySelector('[data-network-wire="'+source+'"]'),button=root.querySelector('[data-network-sync="'+source+'"]');node.dataset.state=state.state;wire.setAttribute('class','ama-network-wire '+state.state);wire.setAttribute('marker-end','url(#ama-network-arrow-'+state.state+')');button.dataset.state=state.state;button.disabled=state.state==='pending'||amaSyncInFlight;button.setAttribute('aria-busy',String(state.state==='pending'));button.setAttribute('aria-label',(state.state==='pending'?'Synchronisation en attente pour ':'Synchroniser ')+node.dataset.name+' · '+state.label);button.title=state.label+(state.last?' · Dernier contact : '+new Date(state.last).toLocaleString('fr-FR'):' · Aucun contact confirmé')+' · Cliquer pour demander une synchronisation';node.querySelector('small').textContent=state.label;const error=button.querySelector('.ama-network-error');error.hidden=state.state!=='error';}
}
function amaNetworkOpen(source){void amaV12Recent(source);}
function amaNetworkSetup(){const pane=document.getElementById('amaManage-imports');if(!pane||document.getElementById('amaConnectionsMap'))return;const root=document.createElement('section');root.id='amaConnectionsMap';root.className='ama-network-map';root.setAttribute('aria-label','Plateformes connectées à AMA Planning');
 const rr=document.querySelector('#amaRRQueue .ama-rr-platform-icon').innerHTML,icons={rr,airbnb:amaProviders.airbnb.icon,gdf:amaProviders.gdf.icon},names={rr:'RentalReady',airbnb:'Airbnb',gdf:'Gîtes de France'};
 root.innerHTML='<div class="ama-network-grid"><svg class="ama-network-wires" viewBox="0 0 500 350" preserveAspectRatio="none" aria-hidden="true"><defs>'+[['ok','#398b7b'],['late','#c18a35'],['error','#c56b75'],['pending','#698b9d'],['unknown','#a4b4bc']].map(([key,color])=>'<marker id="ama-network-arrow-'+key+'" markerWidth="5" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0 0 5 3 0 6" fill="'+color+'"/></marker>').join('')+'</defs><path data-network-wire="rr" class="ama-network-wire unknown" d="M250 124L250 153"/><path data-network-wire="airbnb" class="ama-network-wire unknown" d="M129 215L187 215"/><path data-network-wire="gdf" class="ama-network-wire unknown" d="M371 215L313 215"/></svg>'+['rr','airbnb','gdf'].map(source=>'<button type="button" class="ama-network-node ama-network-'+source+'" data-network-source="'+source+'" data-name="'+names[source]+'" aria-label="Afficher les derniers imports '+names[source]+'"><span class="ama-network-icon" aria-hidden="true">'+icons[source]+'</span><strong>'+names[source]+'</strong><small>Vérification…</small></button>').join('')+'<button type="button" class="ama-network-hub" data-network-all aria-label="Derniers imports de toutes les sources"><span aria-hidden="true">'+amaUiIcon('planning')+'</span><strong>AMA Planning</strong><small>Toutes les sources</small></button>'+['rr','airbnb','gdf'].map(source=>'<button type="button" class="ama-network-hit ama-network-hit-'+source+'" data-network-sync="'+source+'" aria-label="Synchroniser '+names[source]+'"><span class="ama-network-error" aria-hidden="true" hidden>×</span></button>').join('')+'<div class="ama-network-legend"><span><i></i>À jour</span><span><i></i>Délai dépassé</span><span><i></i>Erreur</span></div></div><p id="amaConnectionsFeedback" class="ama-network-feedback" role="status" aria-live="polite"></p>';
 pane.prepend(root);const inspector=document.getElementById('amaRRInspector');if(inspector)document.getElementById('tab-admin').append(inspector);root.querySelectorAll('[data-network-source]').forEach(b=>b.onclick=()=>amaNetworkOpen(b.dataset.networkSource));root.querySelectorAll('[data-network-sync]').forEach(b=>b.onclick=async()=>{if(session?.role!=='admin'||b.disabled||amaSyncInFlight)return;const owner=session.id,source=b.dataset.networkSync;b.disabled=true;document.getElementById('amaConnectionsFeedback').textContent='Demande de synchronisation '+names[source]+'…';try{await amaSyncRequest(source);if(session?.id!==owner)return;document.getElementById('amaConnectionsFeedback').textContent=amaNetworkState(source).state==='error'?'Demande non confirmée. Ouvrez le menu '+names[source]+' pour consulter le message.':'Demande transmise. L’état sera mis à jour après confirmation du connecteur.';}finally{if(session?.id===owner)amaNetworkPaint();}});
 amaV12MoveProviders();
 new MutationObserver(()=>{if(document.getElementById('app').hidden){amaNetworkErrors.clear();document.querySelectorAll('#amaV12ConnectionMenus>.ama-provider').forEach(d=>d.open=false);root.dataset.active='false';document.getElementById('amaConnectionsFeedback').textContent='';root.querySelectorAll('[data-network-source] small').forEach(n=>n.textContent='Vérification…');}else amaNetworkPaint();}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('visibilitychange',amaNetworkPaint);new MutationObserver(amaNetworkPaint).observe(pane,{attributes:true,attributeFilter:['hidden']});amaNetworkPaint();
}
// Connexions et derniers imports ; accueil fixe sans préférences personnelles.
let amaV12RecentSource='all',amaV12RecentGeneration=0;
function amaV12MoveProviders(){const host=document.createElement('div');host.id='amaV12ConnectionMenus';host.hidden=true;document.getElementById('amaManage-maintenance').append(host);for(const menu of document.querySelectorAll('#amaManage-imports>.ama-provider')){menu.hidden=false;menu.open=false;menu.classList.remove('ama-network-provider-menu');menu.querySelector(':scope>summary').hidden=false;host.append(menu);}}
function amaV12MaintenanceCards(){const host=document.getElementById('amaV12ConnectionMenus');if(!host)return;host.hidden=!(session?.role==='admin'&&amaManageView==='maintenance'&&amaV10Section==='connections');}
async function amaV12Recent(source='all'){
 if(!['rr','airbnb','gdf','all'].includes(source)||session?.role!=='admin')return;const root=document.getElementById('amaConnectionsMap');if(!root)return;amaV12RecentSource=source;const gen=++amaV12RecentGeneration,owner=session.id;let panel=document.getElementById('amaV12Recent');if(!panel){panel=document.createElement('section');panel.id='amaV12Recent';panel.className='ama-v12-recent';root.after(panel);}panel.replaceChildren();const heading=document.createElement('div');heading.className='ama-v12-recent-head';const strong=document.createElement('strong');strong.textContent='Derniers imports · '+({all:'Toutes les sources',rr:'RentalReady',airbnb:'Airbnb',gdf:'Gîtes de France'})[source];const small=document.createElement('small');small.textContent='10 maximum';heading.append(strong,small);const body=document.createElement('div');body.setAttribute('role','status');body.textContent='Chargement…';panel.append(heading,body);
 root.querySelectorAll('[data-network-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.networkSource===source)));root.querySelector('[data-network-all]')?.setAttribute('aria-pressed',String(source==='all'));
 try{const rows=await amaV6Rpc('ama_recent_imports',{p_source:source});if(session?.id!==owner||gen!==amaV12RecentGeneration)return;if(!Array.isArray(rows))throw Error('Réponse des imports invalide');body.replaceChildren();if(!rows.length){body.textContent='Aucun import conservé pour cette source.';return;}const table=document.createElement('table'),head=document.createElement('thead');head.innerHTML='<tr><th>Logement / source</th><th>Ménage</th><th>État</th></tr>';const tbody=document.createElement('tbody');for(const row of rows.slice(0,10)){const tr=document.createElement('tr'),name=document.createElement('td'),meta=document.createElement('small'),day=document.createElement('td'),state=document.createElement('td');name.textContent=row.name||'Logement à vérifier';meta.textContent=({rr:'RentalReady',airbnb:'Airbnb',gdf:'Gîtes de France'})[row.source]||'Import';name.append(meta);day.textContent=row.mission_date?dateFr(row.mission_date):'À vérifier';state.textContent=row.state||'À vérifier';tr.append(name,day,state);tbody.append(tr);}table.append(head,tbody);body.append(table);}catch(e){if(session?.id===owner&&gen===amaV12RecentGeneration){const missing=e.code==='PGRST202'||/could not find.*ama_recent_imports|function.*ama_recent_imports.*does not exist/i.test(e.message||'');body.textContent=missing?'La lecture des derniers imports doit être activée. Installez le correctif SQL 11 fourni avec cette mise à jour.':'Impossible de charger les derniers imports. Vérifiez la connexion puis réessayez.';const retry=document.createElement('button');retry.type='button';retry.className='soft';retry.textContent='Réessayer';retry.onclick=()=>void amaV12Recent(source);body.append(document.createElement('br'),retry);}}
}
function amaV12Setup(){
 const root=document.getElementById('amaConnectionsMap');root.querySelector('[data-network-all]').onclick=()=>void amaV12Recent('all');const feedback=document.getElementById('amaConnectionsFeedback');feedback.textContent='';
 document.addEventListener('pointerdown',e=>{const svg=document.getElementById('amaCurveSvg'),tip=document.getElementById('amaCurveTooltip');if(tip&&svg&&!svg.contains(e.target)){tip.hidden=true;document.getElementById('amaCurveReadout').textContent='';}},true);document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('amaCurveTooltip').hidden=true;document.getElementById('amaCurveReadout').textContent='';}});
 const history=document.querySelector('#tab-history>.card');history?.querySelector('.formgrid')?.classList.add('ama-v12-history-filters');
 const observer=new MutationObserver(()=>{amaV12ScanSuggestions(document.getElementById('amaRRDialog'));});observer.observe(document.getElementById('amaRRDialog'),{subtree:true,childList:true});
 new MutationObserver(()=>{if(document.getElementById('app').hidden){amaV12RecentGeneration++;document.getElementById('amaV12Recent')?.remove();amaV12RecentSource='all';amaV12MaintenanceCards();}}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['hidden']});
}

amaNetworkSetup();
amaV12Setup();

// Absences partagées, alertes explicites et diagnostic local borné.
let amaNewAbsences=[],amaNewOwner=null,amaNewLoading=false;
const amaNewErrors=[];
window.addEventListener('error',()=>{if(amaNewErrors.length<20)amaNewErrors.push(new Date().toLocaleTimeString('fr-FR')+' · Erreur JavaScript détectée');});
window.addEventListener('unhandledrejection',()=>{if(amaNewErrors.length<20)amaNewErrors.push(new Date().toLocaleTimeString('fr-FR')+' · Opération non terminée');});
function amaNewAbsent(worker,day){return amaNewOwner===session?.id&&amaNewAbsences.some(a=>a.worker_id===worker&&a.start_date<=day&&a.end_date>=day);}
async function amaNewLoad(){if(!session||amaNewLoading)return;const owner=session.id;amaNewLoading=true;try{const rows=await amaV6Rpc('ama_absences',{});if(session?.id!==owner)return;if(!Array.isArray(rows))throw Error('Réponse invalide');amaNewOwner=owner;amaNewAbsences=rows;amaNewPaint();}catch{if(session?.id===owner)document.getElementById('amaNewAbsenceStatus').textContent='Absences indisponibles. Installez le SQL 15 ou réessayez.';}finally{amaNewLoading=false;}}
function amaNewPaint(){const host=document.getElementById('amaNewAbsenceRows');host.replaceChildren();if(amaNewOwner!==session?.id)return;for(const a of amaNewAbsences){const p=document.createElement('p');p.textContent=a.full_name+' · '+dateFr(a.start_date)+' → '+dateFr(a.end_date);if(session.role==='worker'){const b=document.createElement('button');b.type='button';b.textContent='Retirer';b.onclick=async()=>{try{await amaV6Rpc('ama_absences',{p_remove:a.id});await amaNewLoad();}catch{document.getElementById('amaNewAbsenceStatus').textContent='Retrait non confirmé. Réessayez.';}};p.append(b);}host.append(p);}if(!host.children.length)host.textContent='Aucune absence à venir.';const alerts=document.getElementById('amaNewPriorities');alerts.replaceChildren();if(session?.role!=='admin')return;const conflicts=data.missions.filter(m=>m.status==='planned'&&sharedIds(m).some(w=>amaNewAbsent(w,m.date)));for(const m of conflicts){const b=document.createElement('button');b.type='button';b.textContent=m.apartmentName+' · '+dateFr(m.date)+' · intervenant absent';b.onclick=()=>amaV8Plan(m.date,m.workerId);alerts.append(b);}alerts.hidden=!conflicts.length;}
const amaNewBaseCheck=amaV6CheckWorkload;
amaV6CheckWorkload=async function(worker,day,added){await amaNewLoad();if(amaNewAbsent(worker,day)&&!confirm('Une absence est déclarée pour cette date. Confirmer malgré tout cette affectation ?'))return false;return amaNewBaseCheck(worker,day,added);};
const amaNewBaseRender=render;
render=function(){amaNewBaseRender();const signed=!!session;document.getElementById('amaNewAbsenceEntry').hidden=!signed;document.getElementById('amaNewAbsenceForm').hidden=session?.role!=='worker';if(amaNewOwner!==session?.id){amaNewAbsences=[];amaNewOwner=null;}amaNewPaint();};
function amaNewSetup(){const d=document.createElement('dialog');d.id='amaNewAbsenceDialog';d.className='ama-admin-sheet';d.innerHTML='<div class="ama-admin-sheet-head"><h3>Mes absences</h3><button type="button" aria-label="Fermer">×</button></div><div class="ama-admin-sheet-body"><form id="amaNewAbsenceForm"><label>Du<input name="start" type="date" required></label><label>Au<input name="end" type="date" required></label><button class="primary">Signaler mon absence</button></form><p id="amaNewAbsenceStatus" role="status"></p><div id="amaNewAbsenceRows"></div></div>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.target,b=form.querySelector('button');b.disabled=true;try{await amaV6Rpc('ama_absences',{p_start:form.start.value,p_end:form.end.value});document.getElementById('amaNewAbsenceStatus').textContent='Absence enregistrée. L’administrateur est averti.';await amaNewLoad();}catch(err){document.getElementById('amaNewAbsenceStatus').textContent='Enregistrement refusé : '+err.message;}finally{b.disabled=false;}};const entry=document.createElement('button');entry.id='amaNewAbsenceEntry';entry.type='button';entry.className='ama-worker-absence-card';entry.innerHTML='<span class="ama-worker-absence-icon" aria-hidden="true">'+amaUiIcon('planning')+'</span><span>Déclarer une absence</span>';entry.hidden=true;entry.onclick=()=>{d.showModal();void amaNewLoad();};document.getElementById('tab-dashboard').prepend(entry);const priorities=document.createElement('section');priorities.id='amaNewPriorities';priorities.className='card';priorities.hidden=true;entry.after(priorities);const basePaint=amaV10PaintMaintenance;amaV10PaintMaintenance=function(){basePaint();const host=document.getElementById('amaV8Maintenance').querySelector('[data-private-content]');const details=document.createElement('details');const s=document.createElement('summary');s.textContent='Fonctionnement sur cet appareil';details.append(s);const p=document.createElement('p');p.textContent=amaNewErrors.length?amaNewErrors.join(' · '):'Aucune erreur JavaScript capturée depuis cette ouverture. Ce contrôle ne garantit pas l’absence de bugs.';details.append(p);host.append(details);};}
amaNewSetup();
const amaNewIncidentSend=amaV6IncidentSend;
amaV6IncidentSend=async function(e){
 e.preventDefault();if(!session||amaV6IncidentBusy)return;
 if(amaV6IncidentSaved){document.getElementById('amaV6IncidentShare').click();return;}
 const m=data.missions.find(x=>x.id===amaV6IncidentMission),message=document.getElementById('amaV6IncidentMessage').value.trim();if(!m||!message)return;
 const files=amaV6IncidentFiles.slice(),text='Signalement — '+m.apartmentName+'\nDate : '+dateFr(m.date)+'\nIntervenant : '+(session.name||m.workerName||'')+'\nProblème : '+amaV6Labels[document.getElementById('amaV6IncidentCategory').value]+'\n'+message;
 const feedback=document.getElementById('amaV6IncidentFeedback');
 if(!navigator.share||files.length&&!navigator.canShare?.({files})){feedback.textContent='Partage de fichiers indisponible sur cet appareil. Enregistrez le signalement puis copiez le texte et joignez les photos depuis votre galerie.';await amaNewIncidentSend(e);return;}
 try{await navigator.share({text,...(files.length?{files}:{})});await amaNewIncidentSend(e);feedback.textContent+=' Le menu de partage a été ouvert ; vérifiez la réception dans WhatsApp.';}catch(err){feedback.textContent=err.name==='AbortError'?'Partage annulé. Vous pouvez réessayer.':'Partage non confirmé. Réessayez.';}
};
document.getElementById('amaV6IncidentForm').querySelector('form').onsubmit=amaV6IncidentSend;
const amaNewIncidentOpen=amaV6IncidentOpen;amaV6IncidentOpen=function(m){amaNewIncidentOpen(m);document.getElementById('amaV6IncidentSend').textContent='Partager le signalement';};


// Chargement limité des absences ; ne conserve pas les données d'un autre compte.
let amaFinalLoadedAt=0,amaFinalPending=null;
amaNewLoad=async function(){if(!session)return false;const owner=session.id;if(amaFinalPending)return amaFinalPending;amaFinalPending=(async()=>{try{const rows=await amaV6Rpc('ama_absences',{});if(session?.id!==owner)return false;if(!Array.isArray(rows))throw Error('Réponse invalide');amaNewOwner=owner;amaNewAbsences=rows;amaFinalLoadedAt=Date.now();amaNewPaint();return true;}catch{if(session?.id===owner)document.getElementById('amaNewAbsenceStatus').textContent='Impossible de vérifier les absences. Réessayez.';return false;}finally{amaFinalPending=null;}})();return amaFinalPending;};
amaV6CheckWorkload=async function(worker,day,added){if(!await amaNewLoad())throw Error('Vérification des absences indisponible. Réessayez avant affectation.');if(amaNewAbsent(worker,day)){await amaV8MissionHints();return false;}return amaNewBaseCheck(worker,day,added);};
const amaFinalRender=render;render=function(){amaFinalRender();if(session&&(amaNewOwner!==session.id||Date.now()-amaFinalLoadedAt>60000))void amaNewLoad();};
const amaFinalHealthSent=new Set();
function amaFinalCapture(code){if(!session||amaFinalHealthSent.has(session.id+code))return;amaFinalHealthSent.add(session.id+code);void amaV6Rpc('ama_app_health',{p_code:code}).catch(()=>{});}
window.addEventListener('error',()=>amaFinalCapture('javascript'));window.addEventListener('unhandledrejection',()=>amaFinalCapture('operation'));
const amaFinalMaintenance=amaV10PaintMaintenance;amaV10PaintMaintenance=function(){amaFinalMaintenance();const owner=session?.id,host=document.getElementById('amaV8Maintenance').querySelector('[data-private-content]');const d=document.createElement('details'),sum=document.createElement('summary'),body=document.createElement('p');sum.textContent='Suivi du fonctionnement · tous les appareils';body.textContent='Ouvrez pour consulter les erreurs capturées.';d.append(sum,body);host.append(d);d.ontoggle=async()=>{if(!d.open||session?.id!==owner)return;body.textContent='Vérification…';try{const rows=await amaV6Rpc('ama_app_health',{});if(session?.id!==owner||!d.isConnected)return;if(!Array.isArray(rows))throw Error();body.textContent=rows.length?rows.map(r=>dateFr(r.event_day)+' · '+(r.code==='javascript'?'Erreur JavaScript':'Opération interrompue')+' · '+r.occurrences+' occurrence(s)').join(' | '):'Aucune erreur capturée sur les 14 derniers jours. Ce suivi ne détecte pas tous les bugs.';}catch{body.textContent='Suivi indisponible. Vérifiez la connexion et le SQL 16.';}};};
// Résumé explicitement limité aux dix imports affichés, sans inventer un bilan de synchronisation.
const amaFinalRecent=amaV12Recent;amaV12Recent=async function(source='all'){await amaFinalRecent(source);const p=document.getElementById('amaV12Recent');if(!p||!p.querySelector('table'))return;const rows=[...p.querySelectorAll('tbody tr')],note=document.createElement('p');note.className='ama-v10-status';note.textContent=rows.length+' import(s) affiché(s) · '+rows.filter(r=>/annul|cancel/i.test(r.lastElementChild.textContent)).length+' annulation(s) · '+rows.filter(r=>/vérifier|missing|invalid/i.test(r.lastElementChild.textContent)).length+' à vérifier. Résumé de cette liste.';p.querySelector('.ama-v12-recent-head').after(note);};

// Une seule entrée dans les points à vérifier ; le bouton de déclaration est réservé à l'intervenant.
function amaAbsenceAlertPaint(){
 const entry=document.getElementById('amaNewAbsenceEntry');if(entry)entry.hidden=session?.role!=='worker';document.body.classList.toggle('ama-worker-session',session?.role!=='admin');
 const separate=document.getElementById('amaNewPriorities');if(separate){separate.hidden=true;separate.replaceChildren();}
 const rows=document.getElementById('amaV6ActionRows'),box=document.getElementById('amaV6Actions');if(!rows||!box)return;
 rows.querySelector('[data-action-kind="absence"]')?.remove();
 if(session?.role==='admin'&&amaNewOwner===session.id&&amaNewAbsences.length){
  const b=document.createElement('button');b.type='button';b.className='ama-v6-action-row';b.dataset.actionKind='absence';
  const icon=document.createElement('span');icon.className='ama-v7-action-icon';icon.innerHTML=amaV6ActionIcon('workload');
  const copy=document.createElement('span');copy.className='ama-v7-action-copy';const title=document.createElement('strong');title.textContent=amaNewAbsences.length===1?'Absence déclarée':'Absences déclarées';const detail=document.createElement('small');detail.textContent=amaNewAbsences.slice(0,2).map(a=>a.full_name+' · '+dateFr(a.start_date)+' → '+dateFr(a.end_date)).join(' · ');copy.append(title,detail);
  const count=document.createElement('span');count.className='ama-v7-action-count';count.textContent=String(amaNewAbsences.length);const arrow=document.createElement('span');arrow.className='ama-v7-action-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';b.append(icon,copy,count,arrow);b.onclick=()=>{document.getElementById('amaNewAbsenceDialog').showModal();void amaNewLoad();};rows.append(b);
 }
 box.hidden=session?.role!=='admin'||!rows.children.length;
 const total=document.getElementById('amaV7ActionCount');if(total)total.textContent=rows.children.length+' point'+(rows.children.length>1?'s':'')+' à vérifier';
 const summary=document.getElementById('amaV8ActionSummary');if(summary)summary.textContent=[...rows.children].slice(0,2).map(b=>b.querySelector('strong')?.textContent||'').join(' · ');
}
const amaAbsenceBaseHome=amaV6PaintHome;amaV6PaintHome=function(){amaAbsenceBaseHome();amaAbsenceAlertPaint();};
const amaAbsenceBasePaint=amaNewPaint;amaNewPaint=function(){amaAbsenceBasePaint();amaAbsenceAlertPaint();};


let amaMaintenanceFunctionView=false;
const amaMaintenanceIntegratedBase=amaV10PaintMaintenance;
amaV10PaintMaintenance=function(){
 amaMaintenanceIntegratedBase();const body=document.getElementById('amaV8Maintenance').querySelector('[data-private-content]');
 const diagnostics=[...body.children].filter(el=>el.tagName==='DETAILS'&&/^(Fonctionnement sur cet appareil|Suivi du fonctionnement)/.test(el.querySelector('summary')?.textContent||''));
 diagnostics.forEach(el=>el.remove());
 if(amaMaintenanceFunctionView){
  body.replaceChildren();const back=document.createElement('button');back.type='button';back.className='soft ama-v10-back';back.textContent='‹ Menu Maintenance';back.onclick=()=>{amaMaintenanceFunctionView=false;amaV10Section='';amaV10PaintMaintenance();};const title=document.createElement('h3');title.textContent='Fonctionnement';const card=document.createElement('section');card.className='card';card.append(...diagnostics);body.append(back,title,card);return;
 }
 if(!amaV10Section){const group=body.querySelector('.ama-v18-group');if(!group)return;const b=document.createElement('button');b.type='button';b.dataset.maintenanceFunction='';b.className='ama-v10-menu-row';b.innerHTML='<span class="ama-v18-icon">'+amaUiIcon('configure')+'</span><span class="ama-v18-label"><strong>Fonctionnement</strong><small>Diagnostic et erreurs de l’application</small></span><i aria-hidden="true">›</i>';b.onclick=()=>{amaMaintenanceFunctionView=true;amaV10PaintMaintenance();};group.append(b);}
};


// Même structure de carte que les pages Clients et Logements.
for(const [view,id,title,description] of [
 ['payments','amaPaymentList','Suivi des paiements','Encaissements, échéances et contrôles de facturation.'],
 ['incidents','amaV6IncidentList','Signalements','Suivez les problèmes signalés et leur traitement.'],
 ['maintenance','amaV8Maintenance','Maintenance','Connexions, contrôles et fonctionnement de l’application.']
]){
 const pane=document.getElementById('amaManage-'+view),dialog=document.getElementById(id);if(!pane||!dialog)continue;
 const card=document.createElement('section');card.className='card ama-unified-page';const heading=document.createElement('h3');heading.textContent=title;const desc=document.createElement('p');desc.className='desc';desc.textContent=description;card.append(heading,desc);pane.prepend(card);card.append(dialog);
}


// Préférences propres à chaque compte, synchronisées sans effacer les missions.
const amaPreferenceBaseLoad=loadNotifications;
loadNotifications=async function(){const owner=session?.id;await amaPreferenceBaseLoad();if(!owner||session?.id!==owner)return;const r=await client.rpc('ama_notification_preferences',{});if(session?.id!==owner)return;if(r.error){document.getElementById('amaNotifFeedback').textContent='Actions de notifications indisponibles : installez le SQL 20.';return;}const prefs=new Map((r.data||[]).map(p=>[p.key,p]));missionNotifications=missionNotifications.filter(n=>!prefs.get(amaNotifKey(n))?.hidden).map(n=>({...n,is_read:n.is_read||prefs.get(amaNotifKey(n))?.is_read}));};
function amaNotifKey(n){return (n.adminReminder?'a':n.validationReminder?'v':'n')+':'+n.id;}
let amaNotifBusy=false;
async function amaNotifAct(keys,action){if(!session||amaNotifBusy||!keys.length)return;const owner=session.id;amaNotifBusy=true;const feedback=document.getElementById('amaNotifFeedback');feedback.textContent='';try{const r=await client.rpc('ama_notification_preferences',{p_keys:keys,p_action:action});if(r.error)throw r.error;if(session?.id!==owner)return;await loadNotifications();if(session?.id===owner)renderNotifications();}catch{if(session?.id===owner)feedback.textContent='Action non enregistrée. Réessayez ; vérifiez que le SQL 20 est installé.';}finally{amaNotifBusy=false;}}
function amaNotifSetup(){
 const tools=document.createElement('details');tools.id='amaNotifMenu';tools.innerHTML='<summary aria-label="Actions des notifications">⋯</summary><div><button type="button" data-notif-bulk="read">✓ Tout marquer comme lu</button><button type="button" data-notif-bulk="hide">Tout supprimer</button></div>';document.querySelector('#notificationCard .section-title').append(tools);
 const feedback=document.createElement('p');feedback.id='amaNotifFeedback';feedback.setAttribute('role','status');document.getElementById('notificationContent').prepend(feedback);
 tools.onclick=e=>{const b=e.target.closest('[data-notif-bulk]');if(!b)return;tools.open=false;void amaNotifAct(missionNotifications.map(amaNotifKey),b.dataset.notifBulk);};
 document.addEventListener('click',e=>{if(!tools.contains(e.target))tools.open=false;});
 const list=document.getElementById('notificationList');let swipe=null,suppressUntil=0;
 list.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
 list.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button!==0||amaNotifBusy)return;const row=e.target.closest('[data-pref-key]');if(row)swipe={id:e.pointerId,row,x:e.clientX,y:e.clientY,dx:0,axis:null};});
 list.addEventListener('pointermove',e=>{if(!swipe||swipe.id!==e.pointerId)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(!swipe.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10)swipe.axis=Math.abs(dx)>Math.abs(dy)*1.4?'x':'y';if(swipe.axis!=='x')return;swipe.dx=Math.min(0,dx);swipe.row.style.transform='translateX('+Math.max(-150,swipe.dx)+'px)';swipe.row.style.opacity=String(1-Math.min(.5,Math.abs(swipe.dx)/300));});
 const end=e=>{if(!swipe||e.pointerId!==swipe.id)return;const state=swipe;swipe=null;state.row.style.transform='';state.row.style.opacity='';if(state.axis==='x'){suppressUntil=Date.now()+400;if(state.dx<=-75)void amaNotifAct([state.row.dataset.prefKey],'hide');}};
 list.addEventListener('pointerup',end);list.addEventListener('pointercancel',e=>{if(swipe){swipe.row.style.transform='';swipe.row.style.opacity='';swipe=null;}});
}
amaNotifSetup();

// Menus discrets de conservation et suppression des factures, réservés à l'admin.
function amaInvoiceMenu(id,company,domain){const menu=document.createElement('details');menu.className='ama-invoice-menu';const title=document.createElement('summary');title.textContent='⋯';title.setAttribute('aria-label','Actions de la facture');menu.append(title);for(const [action,label] of [['open','Ouvrir la facture'],['hide',domain==='payments'?'Supprimer du suivi':'Retirer du journal']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=e=>{e.stopPropagation();menu.open=false;void amaInvoiceAction(action,id,company,domain);};menu.append(b);}return menu;}
let amaInvoiceArchiveBusy=false,amaInvoicePdfUrl=null;
function amaInvoiceArchiveDialog(title){let d=document.getElementById('amaInvoiceArchiveDialog');if(!d){d=document.createElement('dialog');d.id='amaInvoiceArchiveDialog';d.className='ama-admin-sheet';d.innerHTML='<div class="ama-admin-sheet-head"><h3></h3><button type="button" aria-label="Fermer">×</button></div><div class="ama-admin-sheet-body"></div>';d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>{if(amaInvoicePdfUrl)URL.revokeObjectURL(amaInvoicePdfUrl);amaInvoicePdfUrl=null;});document.body.append(d);}d.dataset.request=uid();d.querySelector('h3').textContent=title;d.querySelector('.ama-admin-sheet-body').replaceChildren();if(!d.open)d.showModal();return d;}
async function amaInvoiceAction(action,id,company,domain){if(session?.role!=='admin'||amaInvoiceArchiveBusy)return;const owner=session.id;amaInvoiceArchiveBusy=true;try{
 if(action==='open'){const d=amaInvoiceArchiveDialog('Facture'),body=d.querySelector('.ama-admin-sheet-body'),request=d.dataset.request;body.textContent='Chargement du document…';const r=await amaV6Rpc('ama_invoice_document',{p_id:id,p_company:company});if(session?.id!==owner||!d.open||d.dataset.request!==request)return;body.replaceChildren();d.querySelector('h3').textContent='Facture '+r.number;const info=document.createElement('p');info.textContent=r.client_name||'';body.append(info);if(!r.pdf_base64){body.append(document.createTextNode('Le PDF original n’est pas conservé pour cette facture.'));return;}const bytes=Uint8Array.from(atob(r.pdf_base64),c=>c.charCodeAt(0));if(amaInvoicePdfUrl)URL.revokeObjectURL(amaInvoicePdfUrl);amaInvoicePdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const frame=document.createElement('iframe');frame.title='Aperçu de la facture';frame.src=amaInvoicePdfUrl;frame.className='ama-invoice-preview';body.append(frame);const a=document.createElement('a');a.href=amaInvoicePdfUrl;a.download=String(r.number).replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';a.textContent='Télécharger le PDF';a.className='primary ama-invoice-download';body.append(a);return;}
 if(action==='hide'&&!await amaInvoiceConfirm(domain==='payments'?'Retirer cette facture du suivi ? Elle restera consultable dans les éléments retirés.':'Retirer cette entrée du journal ? La facture et les e-mails déjà envoyés sont conservés.'))return;
 await amaV6Rpc('ama_invoice_archive_action',{p_id:id,p_company:company,p_domain:domain,p_action:action});if(session?.id!==owner)return;await amaPaymentListLoad();if(amaInvoiceCompany===company)await amaMailLoad();if(action==='restore')await amaInvoiceRemoved(company,domain);
 }catch(e){if(session?.id===owner)alert('Action impossible : '+e.message);}finally{amaInvoiceArchiveBusy=false;}}
async function amaInvoiceRemoved(company,domain){if(session?.role!=='admin')return;const owner=session.id,d=amaInvoiceArchiveDialog('Éléments retirés'),body=d.querySelector('.ama-admin-sheet-body'),request=d.dataset.request;body.textContent='Chargement…';try{const r=await amaV6Rpc('ama_invoice_archive_list',{p_company:company,p_domain:domain});if(session?.id!==owner||!d.open||d.dataset.request!==request)return;body.replaceChildren();for(const row of r){const card=document.createElement('article');card.className='ama-invoice-removed';const h=document.createElement('strong');h.textContent=row.number;const p=document.createElement('p');p.textContent=row.client_name||'Client';card.append(h,p);for(const [action,label] of [['open','Ouvrir la facture'],['restore','Restaurer'],['delete','Supprimer définitivement']]){const b=document.createElement('button');b.type='button';b.className=action==='delete'?'danger':'soft';b.textContent=label;b.onclick=()=>action==='delete'?amaInvoiceDeleteForm(row,company,domain):void amaInvoiceAction(action,row.id,company,domain);card.append(b);}body.append(card);}if(!r.length)body.textContent='Aucun élément retiré.';}catch(e){if(session?.id===owner)body.textContent='Liste indisponible : '+e.message;}}
function amaInvoiceDeleteForm(row,company,domain){const d=amaInvoiceArchiveDialog('Supprimer définitivement'),body=d.querySelector('.ama-admin-sheet-body'),form=document.createElement('form'),p=document.createElement('p');p.textContent='La facture '+row.number+', son PDF, son suivi et son historique d’envoi seront effacés de la base. Cette action est irréversible. Les e-mails déjà reçus ne seront pas effacés.';const label=document.createElement('label');label.textContent='Recopiez le numéro de facture pour confirmer';const input=document.createElement('input');input.required=true;input.autocomplete='off';label.append(input);const status=document.createElement('p');status.setAttribute('role','status');const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';cancel.onclick=()=>void amaInvoiceRemoved(company,domain);const del=document.createElement('button');del.type='submit';del.className='danger';del.textContent='Supprimer définitivement';form.append(p,label,status,cancel,del);form.onsubmit=async e=>{e.preventDefault();if(input.value.trim()!==row.number){status.textContent='Le numéro ne correspond pas.';return;}del.disabled=true;try{await amaV6Rpc('ama_invoice_archive_action',{p_id:row.id,p_company:company,p_domain:domain,p_action:'delete',p_number:input.value.trim()});await amaInvoiceRemoved(company,domain);await amaPaymentListLoad();if(amaInvoiceCompany===company)await amaMailLoad();}catch(err){status.textContent='Suppression refusée : '+err.message;}finally{del.disabled=false;}};body.append(form);}
function amaInvoiceArchiveLinks(){for(const [host,domain] of [[document.getElementById('amaPaymentListRows'),'payments'],[document.getElementById('amaMailJournal'),'journal']]){if(!host)continue;let link=host.nextElementSibling;if(link?.dataset?.invoiceRemoved!==domain){link=document.createElement('button');link.type='button';link.dataset.invoiceRemoved=domain;link.className='ama-invoice-archive-link';link.textContent='Éléments retirés ›';host.after(link);}link.onclick=()=>void amaInvoiceRemoved(domain==='payments'?amaPaymentCompany:amaInvoiceCompany,domain);}}
const amaArchiveBaseMailCall=amaMailCall;amaMailCall=async function(action,extra={}){const owner=session?.id,company=extra.company_id||amaInvoiceCompany;const r=await amaArchiveBaseMailCall(action,extra);if(action==='status'&&session?.id===owner){const removed=await amaV6Rpc('ama_invoice_archive_list',{p_company:company,p_domain:'journal'});const ids=new Set(removed.map(x=>x.id));r.jobs=(r.jobs||[]).map(j=>({...j,journal_removed:ids.has(j.id)}));r.events=(r.events||[]).filter(e=>!removed.some(x=>x.client_id===e.client_id&&x.period===e.period));}return r;};
function amaInvoiceConfirm(message,title='Retirer de la liste ?',confirmLabel='Retirer'){return new Promise(resolve=>{const d=document.createElement('dialog');d.className='ama-admin-sheet';d.innerHTML='<div class="ama-admin-sheet-head"><h3>Retirer de la liste ?</h3></div><form class="ama-admin-sheet-body" method="dialog"><p></p><div class="ama-invoice-confirm-actions"><button value="cancel">Annuler</button><button value="ok" class="danger">Retirer</button></div></form>';d.querySelector('p').textContent=message;d.querySelector('h3').textContent=title;d.querySelector('[value="ok"]').textContent=confirmLabel;d.addEventListener('close',()=>{const ok=d.returnValue==='ok';d.remove();resolve(ok);},{once:true});document.body.append(d);d.showModal();});}
document.addEventListener('click',e=>{document.querySelectorAll('.ama-invoice-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});});
const amaArchiveBasePayments=amaPaymentListLoad;amaPaymentListLoad=async function(){await amaArchiveBasePayments();amaInvoiceArchiveLinks();};
const amaArchiveBaseMailLoad=amaMailLoad;amaMailLoad=async function(){await amaArchiveBaseMailLoad();amaInvoiceArchiveLinks();};

// Un composant commun pour le journal des factures et des relevés.
const amaSendViews=[];
function amaSendMoment(v){if(!v)return 'Date non enregistrée';const d=new Date(v);return Number.isNaN(d.getTime())?'Date non enregistrée':d.toLocaleString('fr-FR',{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'});}
function amaSendPeriod(v){if(!v)return 'Période non renseignée';const d=new Date(String(v).slice(0,10)+'T12:00:00Z');return Number.isNaN(d.getTime())?'Période non renseignée':d.toLocaleDateString('fr-FR',{timeZone:'Europe/Paris',month:'long',year:'numeric'});}
function amaSendStatus(v){return ({planned:'Prévu',queued:'En attente',pending:'En attente',processing:'En cours',running:'En cours',accepted:'Pris en charge',sent:'Pris en charge',succeeded:'Pris en charge',success:'Pris en charge',failed:'Échoué',uncertain:'À vérifier',cancelled:'Annulé',skipped:'Non envoyé'})[v]||'État : '+String(v||'inconnu');}
function amaSendCreate(kind,host,summary){const root=document.createElement('details');root.className='ama-send-journal';root.dataset.sendKind=kind;const heading=document.createElement('summary');heading.textContent=summary;const body=document.createElement('div');body.className='ama-send-body';root.append(heading,body);host.append(root);const state={kind,root,body,tab:'upcoming',offset:0,request:0,subject:'',data:null};amaSendViews.push(state);root.ontoggle=()=>{if(root.open)void amaSendLoad(state);else{state.request++;}};return state;}
function amaSendSubject(s){return s.kind==='reports'?document.getElementById('reportWorker').value:amaInvoiceCompany;}
async function amaSendLoad(s){const owner=session?.id,subject=amaSendSubject(s),request=++s.request;if(session?.role!=='admin'){s.root.hidden=true;s.body.replaceChildren();return;}s.root.hidden=false;if(!subject){s.body.textContent='Choisissez un intervenant pour consulter les envois.';return;}if(s.subject!==subject){s.subject=subject;s.offset=0;s.data=null;}s.body.textContent='Chargement des envois…';try{const data=await amaV6Rpc('ama_send_journal',{p_kind:s.kind,p_subject:subject,p_offset:s.offset});if(session?.id!==owner||!s.root.open||request!==s.request||amaSendSubject(s)!==subject)return;if(!Array.isArray(data?.upcoming)||!Array.isArray(data?.history))throw Error();s.data=data;amaSendPaint(s);}catch{if(session?.id===owner&&request===s.request)s.body.textContent='Journal indisponible. Vérifiez la connexion et l’installation du SQL 23.';}}
function amaSendPaint(s){const {body,data}=s;body.replaceChildren();const tabs=document.createElement('div');tabs.className='ama-send-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Envois');for(const [key,title,count] of [['upcoming','À venir',data.upcoming.length],['history','Historique',data.total]]){const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(s.tab===key));b.className=s.tab===key?'active':'';b.textContent=title+' · '+count;b.onclick=()=>{s.tab=key;amaSendPaint(s);};tabs.append(b);}body.append(tabs);const note=document.createElement('p');note.className='ama-send-note';note.textContent=(s.kind==='reports'?'Pour l’intervenant sélectionné. ':'Pour la société sélectionnée. ')+'Dates en heure de Paris.';body.append(note);const refresh=document.createElement('button');refresh.type='button';refresh.className='ama-send-refresh';refresh.textContent='↻ Actualiser';refresh.onclick=()=>void amaSendLoad(s);body.append(refresh);const rows=s.tab==='upcoming'?data.upcoming:data.history;for(const row of rows){const line=document.createElement('article');line.className='ama-send-row';const title=document.createElement('strong');title.textContent=row.number||row.label||'Envoi';const badge=document.createElement('span');badge.className='ama-send-badge '+(['accepted','sent','succeeded','success'].includes(row.status)?'good':['failed','uncertain'].includes(row.status)?'warn':'neutral');badge.textContent=amaSendStatus(row.status);const top=document.createElement('div');top.className='ama-send-row-top';top.append(title,badge);if(s.kind==='invoices'&&row.id&&row.record_type!=='event')top.append(amaInvoiceMenu(row.id,s.subject,'journal'));const sub=document.createElement('p');sub.textContent=(s.kind==='invoices'&&row.number?(row.label+' · '):'')+amaSendPeriod(row.period);const time=document.createElement('small');time.textContent=({planned:'Prévu le ',requested:'Demande enregistrée le ',started:'Traitement commencé le ',finished:'Traitement terminé le ',accepted:'Pris en charge le ',cancelled:'Annulé le '})[row.date_kind]+amaSendMoment(row.date);if(!row.date)time.textContent='Date non enregistrée';line.append(top,sub,time);if(row.record_type==='event'){const error=document.createElement('p');error.className='ama-send-error';error.textContent='Préparation : '+(row.message||'Échec enregistré');line.append(error);}if(s.tab==='upcoming'&&['planned','queued'].includes(row.status)){const cancel=document.createElement('button');cancel.type='button';cancel.className='ama-send-cancel';cancel.textContent='Annuler cet envoi';cancel.onclick=()=>void amaSendCancel(s,row,cancel);line.append(cancel);}if(s.kind==='invoices'&&row.source==='manual'){const origin=document.createElement('small');origin.textContent='Envoi manuel';line.append(origin);}if(row.status==='planned'){const hint=document.createElement('small');hint.className='ama-send-note';hint.textContent='Échéance prévue selon les réglages actuels.';line.append(hint);}body.append(line);}
 if(!rows.length){const empty=document.createElement('p');empty.className='ama-send-empty';empty.textContent=s.tab==='upcoming'?'Aucun envoi à venir enregistré ou prévu.':'Aucun envoi enregistré pour cette sélection.';body.append(empty);}if(s.tab==='history'&&data.total>10){const pager=document.createElement('div');pager.className='ama-send-pager';for(const [delta,label] of [[-10,'Précédent'],[10,'Suivant']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=delta<0?s.offset===0:s.offset+10>=data.total;b.onclick=()=>{s.offset=Math.max(0,s.offset+delta);void amaSendLoad(s);};pager.append(b);}body.append(pager);}const caution=document.createElement('small');caution.className='ama-send-note';caution.textContent='« Pris en charge » signifie accepté par le service e-mail ; la réception n’est pas confirmée.';body.append(caution);if(s.kind==='invoices')amaSendMoveArchive(s);}
let amaSendCancelBusy=false;
async function amaSendCancel(s,row,button){if(session?.role!=='admin'||amaSendCancelBusy)return;const owner=session.id,subject=s.subject;amaSendCancelBusy=true;button.disabled=true;try{const ok=await amaInvoiceConfirm('Annuler uniquement cet envoi pour '+(row.label||'cette sélection')+' — '+amaSendPeriod(row.period)+' ? Les échéances suivantes restent actives.','Annuler cet envoi ?','Confirmer l’annulation');if(!ok||session?.id!==owner)return;await amaV6Rpc('ama_send_cancel',{p_kind:s.kind,p_subject:subject,p_recipient:row.recipient_id,p_period:row.period,p_job:row.id||null,p_expected:row.status==='planned'?row.date:null});if(session?.id!==owner||amaSendSubject(s)!==subject)return;s.tab='history';s.offset=0;await amaSendLoad(s);}catch(e){if(session?.id===owner){const note=document.createElement('p');note.className='ama-send-error';note.setAttribute('role','status');note.textContent='Annulation refusée : '+e.message;s.body.prepend(note);}}finally{amaSendCancelBusy=false;button.disabled=false;}}
function amaSendMoveArchive(s){let link=s.archiveLink;if(!link){link=document.createElement('button');link.type='button';link.dataset.invoiceRemoved='journal';link.className='ama-invoice-archive-link';link.textContent='Éléments retirés ›';s.archiveLink=link;}document.querySelectorAll('[data-invoice-removed="journal"]').forEach(el=>{if(el!==link)el.remove();});link.onclick=()=>void amaInvoiceRemoved(amaSendSubject(s),'journal');s.body.append(link);}

function amaSendSetup(){const worker=amaSendCreate('reports',document.getElementById('workerReport'),'Envois automatiques');worker.root.id='amaReportSendJournal';document.getElementById('reportWorker').addEventListener('change',()=>{worker.request++;worker.data=null;worker.offset=0;worker.body.replaceChildren();if(worker.root.open)void amaSendLoad(worker);});
 const old=document.getElementById('amaMailJournal'),oldDetail=old.closest('details');old.hidden=true;document.getElementById('amaMailEvents').hidden=true;const invoice=amaSendCreate('invoices',oldDetail.parentElement,'Envois automatiques');invoice.root.id='amaInvoiceSendJournal';oldDetail.hidden=true;
 const baseMail=amaMailLoad;amaMailLoad=async function(){await baseMail();amaSendMoveArchive(invoice);if(invoice.root.open)await amaSendLoad(invoice);};
 const baseRender=render;render=function(){baseRender();for(const s of amaSendViews){s.root.hidden=session?.role!=='admin';if(session?.role!=='admin'){s.request++;s.root.open=false;s.subject='';s.data=null;s.body.replaceChildren();}}};
 document.getElementById('amaCompanySelect')?.addEventListener('change',()=>{invoice.request++;invoice.data=null;invoice.offset=0;invoice.body.replaceChildren();if(invoice.root.open)void amaSendLoad(invoice);});
 document.addEventListener('ama:m6-settings-changed',()=>{if(worker.root.open)void amaSendLoad(worker);});for(const s of amaSendViews)s.root.hidden=session?.role!=='admin';
}
amaSendSetup();

amaM4Bind();
document.getElementById('amaSessionRetry').onclick=amaRestoreSession;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',amaRestoreSession,{once:true});else amaRestoreSession();
})();
