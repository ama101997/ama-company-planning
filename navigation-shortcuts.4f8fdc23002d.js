
/* Raccourcis d'interface : renvoient simplement à l'onglet existant. */
document.getElementById('amaQuickActions')?.addEventListener('click', function(event){
  const button=event.target.closest('[data-ama-tab]');
  if(button) document.querySelector('#nav [data-tab="' + button.dataset.amaTab + '"]')?.click();
});
