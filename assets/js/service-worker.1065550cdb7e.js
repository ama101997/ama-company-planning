
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker activé :', registration.scope);
    } catch (error) {
      console.error('Erreur Service Worker :', error);
    }
  });
}
