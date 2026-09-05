/* Calendar-day rotation is local, deterministic, and available offline. */
(() => {
  'use strict';
  const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayNumber=(date=new Date())=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const index=(length,offset=0,date=new Date())=>((dayNumber(date)+offset)%length+length)%length;
  function watch(m,render){
    let key='';
    const refresh=()=>{const next=dayKey();if(next!==key){key=next;render(next);}};
    const timer=setInterval(refresh,30000);
    document.addEventListener('visibilitychange',refresh);
    const prior=m._cleanup;m._cleanup=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);prior?.();};
    refresh();
  }
  window.TeacherTilesDaily=Object.freeze({dayKey,dayNumber,index,watch});
})();
