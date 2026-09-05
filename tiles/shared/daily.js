/* Calendar-day rotation is local, deterministic, and available offline. */
(() => {
  'use strict';
  const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayNumber=(date=new Date())=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const index=(length,offset=0,date=new Date())=>((dayNumber(date)+offset)%length+length)%length;
  function watch(m,render){
    let key='',lastRefresh=0;
    const refresh=()=>{const next=dayKey();if(next!==key||Date.now()-lastRefresh>3600000){key=next;lastRefresh=Date.now();render(next);}};
    const timer=setInterval(refresh,30000);
    document.addEventListener('visibilitychange',refresh);
    const prior=m._cleanup;m._cleanup=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);prior?.();};
    refresh();
  }
  let pending;
  async function feed(){
    let cached;try{cached=JSON.parse(localStorage.getItem('tt-daily-learning-v1'));}catch{}
    if(cached?.day===new Date().toISOString().slice(0,10))return cached;
    if(!pending)pending=fetch('https://us-central1-teachertiles-6739b.cloudfunctions.net/dailyLearning',{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('feed');return r.json();}).then(data=>{
      if(!Array.isArray(data.words)||!Array.isArray(data.quotes))throw Error('feed');
      try{localStorage.setItem('tt-daily-learning-v1',JSON.stringify(data));}catch{}return data;
    }).catch(()=>cached||null);
    const result=await pending;setTimeout(()=>{pending=null;},60000);return result;
  }
  window.TeacherTilesDaily=Object.freeze({dayKey,dayNumber,index,watch,feed});
})();
