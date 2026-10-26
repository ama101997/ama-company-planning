
const VAPID_PUBLIC_KEY =
  'BPCkk_p81UPXu2xo_ZIhw5q40n7J5LIJw3rPHapsGTej5MaAKw2z_f_JXWU-5M3ZV_O87bVioJpa-LkC5CDdAKY';

function vapidToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);

  return Uint8Array.from(rawData, char => char.charCodeAt(0));
}

const notificationButton = document.getElementById('amaPushEnable');
const legacyNotificationButton = document.getElementById('activer-notifications');
if (legacyNotificationButton) legacyNotificationButton.style.display = 'none';

// Le bouton n'apparaît que si cet appareil n'est pas encore abonné.
const amaPushHelpToggle=document.getElementById('amaPushHelpToggle');
const amaPushHelp=document.getElementById('amaPushHelp');
const amaPushHelpSteps=document.getElementById('amaPushHelpSteps');
const amaPushGuides={
 ios:['Ouvrez AMA Planning dans Safari.','Touchez Partager, puis « Sur l’écran d’accueil » et Ajouter.','Ouvrez AMA Planning depuis son icône sur l’écran d’accueil.','Touchez « Activer » et autorisez les notifications.'],
 android:['Ouvrez AMA Planning dans Chrome.','Installez l’application depuis le menu Chrome si nécessaire.','Touchez « Activer » et autorisez les notifications.','En cas de refus, vérifiez les autorisations dans les réglages Android.']
};
function amaPushShowGuide(platform){
 amaPushHelpSteps.replaceChildren(...amaPushGuides[platform].map(step=>{const li=document.createElement('li');li.textContent=step;return li}));
 document.querySelectorAll('[data-ama-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.amaPlatform===platform)));
}
amaPushShowGuide('ios');
document.querySelectorAll('[data-ama-platform]').forEach(b=>b.addEventListener('click',()=>amaPushShowGuide(b.dataset.amaPlatform)));
amaPushHelpToggle.addEventListener('click',()=>{amaPushHelp.hidden=!amaPushHelp.hidden;amaPushHelpToggle.setAttribute('aria-expanded',String(!amaPushHelp.hidden))});
document.getElementById('amaPushHelpClose').addEventListener('click',()=>{amaPushHelp.hidden=true;amaPushHelpToggle.setAttribute('aria-expanded','false')});
function amaPushUpdateRole(){
 const isAdmin=document.getElementById('amaAccountModal')?.dataset.role==='admin';
 document.getElementById('amaPushAdminChoices').hidden=!isAdmin;document.getElementById('amaValidationReminderInfo').hidden=isAdmin;
 refreshNotificationButton();
}
window.amaPushUpdateRole=amaPushUpdateRole;
async function refreshNotificationButton(){
 const title=document.getElementById('amaPushDeviceTitle');
 const status=document.getElementById('amaPushStatus');
 const check=document.getElementById('amaPushActiveCheck');
 const render=(active,available,description='')=>{
   title.textContent=active?'Notifications activées':'Notifications désactivées';
   status.textContent=description;
   notificationButton.hidden=active||!available;
   notificationButton.disabled=false;
   notificationButton.textContent='Activer';
   check.hidden=!active;
   amaPushHelpToggle.hidden=active;
   if(active){amaPushHelp.hidden=true;amaPushHelpToggle.setAttribute('aria-expanded','false')}
 };
 try{
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(isIOS&&!standalone){render(false,false,'Ouvrez l’application depuis l’écran d’accueil');return}
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
    render(false,false,'Notifications non disponibles sur ce navigateur');return;
  }
  if(Notification.permission==='denied'){render(false,false,'Autorisation refusée : consultez l’aide');return}
  if(Notification.permission==='granted'){
   const registration=await navigator.serviceWorker.ready;
   if(await registration.pushManager.getSubscription()){render(true,false);return}
   render(false,true,'Abonnement à terminer');return;
  }
  render(false,true);
 }catch(e){console.warn('Notifications :',e);render(false,false,'État indisponible')}
}
window.addEventListener('load', refreshNotificationButton);
window.addEventListener('pageshow', refreshNotificationButton);
document.getElementById('amaOpenSettings')?.addEventListener('click',()=>setTimeout(refreshNotificationButton,80));

notificationButton.addEventListener('click', async () => {
    try {
      if (!('Notification' in window) ||
          !('serviceWorker' in navigator) ||
          !('PushManager' in window)) {
        alert('Notifications push non disponibles sur ce navigateur.');
        return;
      }

      const pushClient = window.supabase?.createClient(
        'https://bleixaoiyoxvatsimkrw.supabase.co',
        'sb_publishable_cUhSkP5GpURWVSme6GMVzA_6L3Gl9tm'
      );
      if (!pushClient) throw new Error('Bibliothèque Supabase indisponible. Actualisez la page.');

      const { data: { user }, error: authError } =
        await pushClient.auth.getUser();

      if (authError || !user) {
        alert('Connecte-toi à ton compte avant d’activer les notifications.');
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert('Autorisation des notifications refusée.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const json = subscription.toJSON();

      const { error } = await pushClient
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth
        }, {
          onConflict: 'endpoint'
        });

      if (error) throw error;
      const modal=document.getElementById('amaAccountModal');
      if(modal?.dataset.role!=='admin'){
        const prefs={assignment:true,planning:true,completed:false,reminder:true};
        localStorage.setItem('ama_push_prefs_'+user.id,JSON.stringify(prefs));
        const {error:prefError}=await pushClient.from('push_preferences').upsert({user_id:user.id,...prefs},{onConflict:'user_id'});
        if(prefError) console.warn('Préférences intervenant non synchronisées :',prefError);
      }
      await refreshNotificationButton();

    } catch (error) {
      console.error('Erreur abonnement push :', error);
      alert('Erreur : ' + error.message);
    }
  });
