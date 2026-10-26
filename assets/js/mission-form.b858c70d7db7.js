
(function(){
 const btn=document.getElementById('amaOpenMissionForm'),card=document.getElementById('createMissionCard');if(!btn||!card)return;
 const sheet=document.createElement('dialog');sheet.id='amaMissionDialog';sheet.setAttribute('aria-labelledby','amaMissionTitle');
 sheet.innerHTML='<div class="ama-rr-sheet-handle" aria-hidden="true"><span></span></div><div class="ama-mission-sheet-head"><h3 id="amaMissionTitle">Nouvelle mission</h3><button type="button" aria-label="Fermer le formulaire">×</button></div>';
 sheet.append(card);document.body.append(sheet);btn.setAttribute('aria-controls','amaMissionDialog');btn.setAttribute('aria-haspopup','dialog');
 function close(){sheet.close();}
 btn.addEventListener('click',()=>{
  if(document.getElementById('app')?.hidden||document.body.classList.contains('ama-worker'))return;
  card.classList.remove('ama-mission-form-collapsed');if(!sheet.open)sheet.showModal();btn.setAttribute('aria-expanded','true');document.body.classList.add('ama-mission-modal-open');sheet.scrollTop=0;
 });
 sheet.querySelector('.ama-mission-sheet-head button').addEventListener('click',close);
 sheet.addEventListener('close',()=>{card.classList.add('ama-mission-form-collapsed');btn.setAttribute('aria-expanded','false');document.body.classList.remove('ama-mission-modal-open');if(!document.getElementById('app')?.hidden)btn.focus();});
 sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 let y=null;const handle=sheet.querySelector('.ama-rr-sheet-handle');handle.addEventListener('pointerdown',e=>{y=e.clientY;handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointerup',e=>{if(y!==null&&e.clientY-y>70)close();y=null;});
 const app=document.getElementById('app');if(app)new MutationObserver(()=>{if(app.hidden||document.body.classList.contains('ama-worker'))close();}).observe(app,{attributes:true,attributeFilter:['hidden']});
 const nav=document.getElementById('nav');if(nav)nav.addEventListener('click',()=>{if(sheet.open)close();});
})();

