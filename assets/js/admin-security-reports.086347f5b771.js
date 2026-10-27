
/* AMA Planning — M5 et M6. Contrôles d'autorisation imposés par les RPC Supabase. */
'use strict';
window.amaInitAdminOptions=({isAdmin,icon,client})=>{
 const by=id=>document.getElementById(id), admin=isAdmin;
 const settingsIcon=()=>icon('configure');
 const formatDate=s=>s?new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(s)):'—';
 const rpc=async(name,args={})=>{
  const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data;
 };
 function dialog(id,title){
  const d=document.createElement('dialog');d.id=id;d.className='ama-admin-dialog';
  d.setAttribute('aria-labelledby',id+'Title');
  d.innerHTML=`<div class="ama-dialog-top"><h2 id="${id}Title">${title}</h2><button type="button" aria-label="Fermer">✕</button></div>`;
  d.querySelector('button').onclick=()=>d.close();document.body.append(d);return d;
 }
 function cell(row,value){const el=document.createElement('td');el.textContent=String(value??'—');row.append(el);}
 const security=document.createElement('section');security.id='amaSecurityDialog';security.className='card ama-security-page';by('amaManage-security').append(security);
 security.insertAdjacentHTML('beforeend',`<p class="ama-login-intro">Consultez les connexions réussies et les tentatives de mot de passe refusées dans un seul historique, classé par date. Les localisations par IP sont approximatives.</p><div class="ama-login-header"><div><h3>Historique des connexions</h3><p id="amaM5ConnectionSummary" class="ama-login-summary" role="status">Chargement de l’historique…</p></div><label class="ama-login-filter-label" for="amaM5ConnectionFilter">Afficher<select id="amaM5ConnectionFilter" aria-label="Filtrer les connexions"><option value="all">Toutes</option><option value="success">Réussies</option><option value="failure">Échouées</option></select></label></div><div class="tablewrap ama-login-table"><table><thead><tr><th>Date</th><th>Utilisateur</th><th>Résultat</th><th>Adresse IP</th><th>Localisation estimée</th><th>Appareil</th><th>Accès</th></tr></thead><tbody id="amaM5ConnectionRows"></tbody></table></div><p class="ama-login-caption">Les échecs proviennent des journaux d’authentification Supabase (synchronisation environ toutes les 10 minutes). L’adresse e-mail ciblée n’étant pas disponible, le compte est indiqué comme « Non identifié ». Un échec ne prouve pas à lui seul une intrusion. Une connexion réussie ne signifie pas que la session est encore ouverte. Couper l’accès vise cette session ; pour bloquer durablement la personne, désactivez son compte.</p>`);
 async function loadSecurity(){
  by('amaM5ConnectionRows').replaceChildren();by('amaM5ConnectionSummary').textContent='Chargement de l’historique…';
  try{
   const connections=await rpc('ama_m5_admin_connections_access');
   // Regroupement visuel uniquement : les RPC existantes restent séparées et sécurisées côté serveur.
   const successRows=(connections||[]).map(c=>({
    when:c.created_at,kind:'success',user:c.full_name||'Utilisateur',connectionId:c.id,revoked:c.access_revoked,current:c.current_session,
    detail:c.method==='device_recognized'?'Appareil reconnu':'Code e-mail vérifié',
    ip:c.ip_address||null,city:c.city,country:c.country,device:c.device_label||null
   }));
   let failureRows=[];
   let failureError=false;
   try{
    const failed=await rpc('ama_m5_admin_failed_auth');
    const list=Array.isArray(failed)?failed:[];
    failureRows=list.map(f=>({
     when:f.occurred_at,kind:'failure',user:'Non identifié',
     detail:'Identifiants invalides',ip:f.ip_address||null,
     city:f.city,country:f.country,device:null
    }));
   }catch(e){failureError=true;}
   const history=[...successRows,...failureRows].sort((a,b)=>(Date.parse(b.when)||0)-(Date.parse(a.when)||0));
   function renderConnectionHistory(){
    const tbody=by('amaM5ConnectionRows');tbody.replaceChildren();
    const mode=by('amaM5ConnectionFilter').value;
    const filtered=mode==='all'?history:history.filter(r=>r.kind===mode);
    for(const r of filtered){
     const tr=document.createElement('tr');
     tr.className=r.kind==='failure'?'ama-login-failure':'ama-login-success';
     cell(tr,formatDate(r.when));cell(tr,r.user);
     const statusCell=document.createElement('td');
     const status=document.createElement('span');
     status.className='ama-login-status '+(r.kind==='failure'?'ama-login-status-failure':'ama-login-status-success');
     status.textContent=r.kind==='failure'?'Échouée':'Réussie';
     const detail=document.createElement('small');detail.className='ama-login-detail';detail.textContent=r.detail;
     statusCell.append(status,detail);tr.append(statusCell);
     cell(tr,r.ip||'Non disponible');
     cell(tr,[r.city,r.country].filter(Boolean).join(', ')||'Non disponible');
     cell(tr,r.device||'Non disponible');
     const actionCell=document.createElement('td');
     if(r.kind==='success'){
      if(r.revoked){actionCell.textContent='Accès coupé';}
      else if(r.current){actionCell.textContent='Session actuelle';}
      else{
       const cut=document.createElement('button');cut.type='button';cut.className='ama-cut-session';cut.textContent='Couper l’accès';
       cut.onclick=async()=>{
        if(!confirm('Couper l’accès de cette session de '+r.user+' ? Les autres sessions restent ouvertes. La reconnaissance associée sera retirée. La personne pourra se reconnecter avec ses identifiants et la vérification requise.'))return;
        cut.disabled=true;
        try{const ok=await rpc('ama_m5_admin_revoke_connection',{p_connection:r.connectionId});if(ok!==true)throw Error('Coupure non confirmée');r.revoked=true;renderConnectionHistory();by('amaM5ConnectionSummary').textContent='Accès coupé pour cette session. Contrôle de l’écran sous environ 15 secondes si l’application est au premier plan.';}
        catch(e){cut.disabled=false;by('amaM5ConnectionSummary').textContent='Coupure non confirmée : '+e.message;}
       };
       actionCell.append(cut);
      }
     }else{actionCell.textContent='—';}
     tr.append(actionCell);
     tbody.append(tr);
    }
    if(!filtered.length){
     const tr=document.createElement('tr'),td=document.createElement('td');
     td.colSpan=7;td.className='ama-login-empty';
     td.textContent=mode==='failure'?'Aucune tentative échouée enregistrée.':mode==='success'?'Aucune connexion réussie enregistrée.':'Aucune connexion enregistrée.';
     tr.append(td);tbody.append(tr);
    }
   }
   const summary=by('amaM5ConnectionSummary');
   summary.textContent=`${successRows.length} réussie(s) · ${failureRows.length} échouée(s)`+(failureError?' · Tentatives échouées momentanément indisponibles':'');
   summary.classList.toggle('ama-login-summary-error',failureError);
   const since=Date.now()-15*60*1000;
   const recentByIp=new Map();
   for(const f of failureRows){
    if(f.ip&&(Date.parse(f.when)||0)>since)recentByIp.set(f.ip,(recentByIp.get(f.ip)||0)+1);
   }
   const suspicious=[...recentByIp.values()].filter(count=>count>=5).length;
   if(suspicious){
    summary.textContent+=` · Attention : au moins 5 échecs récents depuis ${suspicious} adresse(s) IP`;
    summary.classList.add('ama-login-summary-warning');
   }else{summary.classList.remove('ama-login-summary-warning');}
   by('amaM5ConnectionFilter').onchange=renderConnectionHistory;
   renderConnectionHistory();
  }catch(err){const summary=by('amaM5ConnectionSummary');summary.textContent='Historique indisponible : '+err.message;summary.classList.add('ama-login-summary-error');}
 }
 const menuButton=document.createElement('button');menuButton.type='button';menuButton.id='amaOpenSecurity';menuButton.className='ama-account-menu-btn';menuButton.hidden=true;menuButton.innerHTML=icon('security')+' Sécurité';
 // Navigation Sécurité réservée à Gestion ; aucun raccourci dans le profil.
 document.addEventListener('ama:security-open',()=>{if(!admin())return;by('amaAccountMenu').hidden=true;loadSecurity();});

 const report=dialog('amaReportSettings','Envoi des relevés');
 report.insertAdjacentHTML('beforeend',`<p>Personnalisez la date et le message des relevés mensuels.</p><p id="amaM6Status" role="status">Chargement…</p><fieldset id="amaM6Fields" disabled><div class="ama-inline-fields"><div><label for="amaReportSendDay">Jour du mois</label><input id="amaReportSendDay" type="number" min="1" max="28" value="3"></div><div><label for="amaReportSendTime">Heure (Paris)</label><input id="amaReportSendTime" type="time" value="09:00"></div></div><label for="amaReportSubject">Objet de l’e-mail</label><input id="amaReportSubject" maxlength="160" value="Votre relevé d’heures — {mois}"><label for="amaReportMessage">Message</label><textarea id="amaReportMessage" rows="5" maxlength="4000">Bonjour {prenom},\n\nVous trouverez en pièce jointe votre relevé d’heures pour {mois}.\n\nBonne journée,\nAMA Company</textarea><button type="button" id="amaM6Save" class="primary">Enregistrer</button></fieldset>`);
 const reportButton=document.createElement('button');reportButton.id='amaReportSettingsButton';reportButton.type='button';reportButton.className='ama-subtle-settings';reportButton.setAttribute('aria-label','Réglages de l’envoi des relevés');reportButton.innerHTML=settingsIcon();reportButton.hidden=true;
 by('workerReport').querySelector('summary').after(reportButton);
 let reportServiceEnabled=false,reportSettingsLoaded=false;
 async function loadSettings(){
  reportSettingsLoaded=false;
  by('amaM6Fields').disabled=true;by('amaM6Status').textContent='Chargement des réglages…';
  try{const rows=await rpc('ama_m6_get_settings');const s=rows?.[0];if(!s)throw Error('Réglages absents');
   reportServiceEnabled=!!s.enabled;reportSettingsLoaded=true;by('amaReportSendDay').value=s.send_day;
   by('amaReportSendTime').value=s.send_time;by('amaReportSubject').value=s.subject;
   by('amaReportMessage').value=s.message;by('amaM6Fields').disabled=false;
   by('amaM6Status').textContent='';
  }catch(e){by('amaM6Status').textContent='Service de relevés indisponible : '+e.message;}
 }
 reportButton.onclick=()=>{if(!admin())return;report.showModal();loadSettings();};
 by('amaM6Save').onclick=async()=>{
  if(!admin()||!reportSettingsLoaded)return;by('amaM6Save').disabled=true;by('amaM6Status').textContent='Enregistrement…';
  try{await rpc('ama_m6_save_settings',{
   p_day:Number(by('amaReportSendDay').value),p_time:by('amaReportSendTime').value,
   p_subject:by('amaReportSubject').value,p_message:by('amaReportMessage').value,
   p_enabled:reportServiceEnabled
  });by('amaM6Status').textContent='Réglages enregistrés.';
  }catch(e){by('amaM6Status').textContent='Enregistrement refusé : '+e.message;}
  finally{by('amaM6Save').disabled=false;}
 };
 const toggle=document.createElement('div');toggle.className='ama-worker-earnings-setting';
 toggle.innerHTML='<label class="ama-earnings-switch"><input type="checkbox" id="amaWorkerAutoReport" disabled><span>Envoi automatique du relevé d’heures</span></label><p id="amaM6WorkerStatus" role="status">En attente.</p>';
 by('amaWorkerReset').before(toggle);
 window.amaM6LoadWorker=async id=>{
  const input=by('amaWorkerAutoReport'),st=by('amaM6WorkerStatus');
  input.disabled=true;input.checked=false;st.textContent='Chargement…';
  try{const enabled=await rpc('ama_m6_get_worker',{p_worker:id});
   if(by('amaWorkerEditId').value!==id)return;input.checked=!!enabled;input.disabled=false;st.textContent=enabled?'Envoi mensuel individuel activé.':'Envoi mensuel individuel désactivé.';
  }catch(e){st.textContent='Option indisponible : '+e.message;}
 };
 by('amaWorkerAutoReport').addEventListener('change',async e=>{
  const id=by('amaWorkerEditId').value,input=e.currentTarget,st=by('amaM6WorkerStatus');
  if(!admin()||!id)return;input.disabled=true;
  try{await rpc('ama_m6_set_worker',{p_worker:id,p_enabled:input.checked});st.textContent='Préférence enregistrée.';}
  catch(err){input.checked=!input.checked;st.textContent='Enregistrement impossible : '+err.message;}
  finally{input.disabled=false;}
 });
 function updateRole(){const allowed=admin();menuButton.hidden=true;reportButton.hidden=!allowed;toggle.hidden=!allowed;if(!allowed){by('amaM5ConnectionRows').replaceChildren();by('amaM5ConnectionSummary').textContent='';report.close();}}
 const observer=new MutationObserver(updateRole);
 observer.observe(by('app'),{attributes:true,attributeFilter:['hidden']});
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});updateRole();
};

