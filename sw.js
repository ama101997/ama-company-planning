self.addEventListener('push', event => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch { data = {body: event.data?.text() || ''}; }
  const title = data.title || 'AMA Planning';
  const options = { body: data.body || 'Vous avez une nouvelle notification.', icon: './icon-192.png', badge: './icon-192.png', tag: data.tag || undefined, data: {url: data.url || './'} };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const w of windows){if(w.url.startsWith(self.registration.scope)){await w.focus();if('navigate' in w)await w.navigate(target);return;}}await clients.openWindow(target)})());
});
