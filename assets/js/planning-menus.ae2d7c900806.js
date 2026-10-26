
// Un seul menu de mission ouvert ; fermeture par toucher extérieur et Échap.
document.addEventListener('toggle',e=>{const menu=e.target;if(!menu.matches?.('.ama-plan-menu')||!menu.open)return;document.querySelectorAll('.ama-plan-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});},true);
document.addEventListener('click',e=>{document.querySelectorAll('.ama-plan-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ama-plan-menu[open]').forEach(menu=>{menu.open=false;});});
