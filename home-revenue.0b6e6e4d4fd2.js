
(function(){
 const mini=document.getElementById('amaCaHomeMini'), picker=document.getElementById('amaCaHomeMonth');
 const source=document.getElementById('financeRevenue'), oldMonth=document.getElementById('financeMonth');
 const period=document.getElementById('financePeriod'), apartment=document.getElementById('financeApartment');
 if(!mini||!picker||!source||!oldMonth)return;
 function populate(){const d=new Date(),year=d.getFullYear(),m=d.getMonth();const current=oldMonth.value||`${year}-${String(m+1).padStart(2,'0')}`;
  picker.innerHTML='';for(let i=0;i<24;i++){const date=new Date(year,m-i,1),value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const opt=document.createElement('option');opt.value=value;opt.textContent=date.toLocaleDateString('fr-FR',{month:'short',year:'numeric'});picker.appendChild(opt)}
  if(!Array.from(picker.options).some(o=>o.value===current)){const opt=document.createElement('option');opt.value=current;opt.textContent=current;picker.add(opt,0)}picker.value=current;
 }
 function update(){const isAdmin=!document.body.classList.contains('ama-worker')&&!document.getElementById('app')?.hidden;mini.hidden=!isAdmin;if(!isAdmin)return;
  const val=source.textContent.trim();document.getElementById('amaCaHomeValue').textContent=val||'0 €';window.amaRefreshHomeSpark?.();
 }
 populate();picker.addEventListener('change',()=>{oldMonth.value=picker.value;if(period)period.value='month';if(apartment)apartment.value='';oldMonth.dispatchEvent(new Event('change',{bubbles:true}));update()});
 document.getElementById('amaCaHomeDetails').addEventListener('click',()=>{
  const detailMonth=document.getElementById('dashRevenueMonth'),detailPeriod=document.getElementById('dashRevenuePeriod');
  if(detailMonth){detailMonth.value=picker.value;detailMonth.dispatchEvent(new Event('change',{bubbles:true}))}
  if(detailPeriod){detailPeriod.value='month';detailPeriod.dispatchEvent(new Event('change',{bubbles:true}))}
  document.querySelector('#nav [data-tab="admin"]')?.click();
  requestAnimationFrame(()=>document.getElementById('amaDailyRevenue')?.scrollIntoView({behavior:'smooth',block:'start'}));
 });
 new MutationObserver(update).observe(source,{childList:true,characterData:true,subtree:true});
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});
 const app=document.getElementById('app');if(app)new MutationObserver(update).observe(app,{attributes:true,attributeFilter:['hidden']});
 document.addEventListener('click',()=>setTimeout(update,0));
 setTimeout(update,400);
})();
