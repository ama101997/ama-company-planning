
(function(){
 const btn=document.getElementById('amaHomeProgram');
 if(!btn)return;
 btn.addEventListener('click',()=>{
  // The existing quick-actions listener switches to Planning first.
  requestAnimationFrame(()=>{
   const open=document.getElementById('amaOpenMissionForm');
   const card=document.getElementById('createMissionCard');
   if(card&&card.classList.contains('ama-mission-form-collapsed'))open?.click();
   setTimeout(()=>card?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  });
 });
})();
