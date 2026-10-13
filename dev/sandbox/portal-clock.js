// Read the device's local time; no server calls or stored timestamps are needed.
(()=>{
  const clock=document.getElementById('portal-clock');
  if(!clock)return;
  const date=clock.querySelector('.portal-clock-date'),time=clock.querySelector('.portal-clock-time');
  function update(){
    const now=new Date();
    date.textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
    time.textContent=now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',second:'2-digit'});
    clock.dateTime=now.toISOString();
    clock.title=`Local Time · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  }
  update();
  setInterval(()=>{if(!document.hidden)update();},1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  window.addEventListener('pageshow',update);
})();
