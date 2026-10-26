
(function(){
 const report=document.getElementById('workerReport'),history=document.getElementById('tab-history');
 if(report&&history){history.append(report);report.classList.add('ama-independent-followup');}
 const payment=document.getElementById('amaPaymentTracking'),topbar=document.getElementById('amaInvoiceTopbar');
 if(payment&&topbar){const card=topbar.closest('.card');payment.classList.add('ama-independent-followup');payment.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5m-5 4h3"/></svg><span class="ama-followup-name">Suivi des paiements</span><span aria-hidden="true">›</span>';if(card)card.after(payment);}
 const input=document.getElementById('planningDate');if(input){const wrap=input.parentElement;wrap.classList.add('ama-centered-date');const label=document.createElement('span');label.id='amaCenteredPlanningDate';label.setAttribute('aria-hidden','true');wrap.append(label);window.amaCenterPlanningDate=function(){label.textContent=/^\d{4}-\d{2}-\d{2}$/.test(input.value)?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(input.value+'T12:00:00Z')):'Toutes les dates';};input.addEventListener('input',window.amaCenterPlanningDate);input.addEventListener('change',window.amaCenterPlanningDate);wrap.addEventListener('click',()=>{try{input.showPicker?.();}catch{}});window.amaCenterPlanningDate();}
})();
