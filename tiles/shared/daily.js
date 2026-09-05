/* Calendar-day rotation is local, deterministic, and available offline. */
(() => {
  'use strict';
  const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayNumber=(date=new Date())=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const index=(length,offset=0,date=new Date())=>((dayNumber(date)+offset)%length+length)%length;
  function watch(m,render){
    let key='',lastRefresh=0;
    const refresh=()=>{const next=dayKey();if(next!==key||Date.now()-lastRefresh>60000){key=next;lastRefresh=Date.now();render(next);}};
    const timer=setInterval(refresh,30000);
    document.addEventListener('visibilitychange',refresh);
    const prior=m._cleanup;m._cleanup=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);prior?.();};
    refresh();
  }

  let pending,retryAfter=0;
  async function feed(){
    let cached;try{cached=JSON.parse(localStorage.getItem('tt-daily-learning-v5'));}catch{}
    const today=dayKey();
    if(cached?.day===today&&cached.wordsDay===today&&cached.quotesDay===today)return cached;
    if(Date.now()<retryAfter&&!pending)return cached||null;
    if(!pending)pending=(async()=>{
      const result=await Promise.allSettled([window.TeacherTilesLive.words(),window.TeacherTilesLive.quotes()]);
      const freshWords=result[0].status==='fulfilled',freshQuotes=result[1].status==='fulfilled';
      let words=freshWords?result[0].value:(cached?.words||[]);
      if(freshWords){const pivot=index(words.length);words=[...words.slice(pivot),...words.slice(0,pivot)];}
      let quotes=freshQuotes?result[1].value:(cached?.quotes||[]);
      if(freshQuotes){const pivot=index(quotes.length);quotes=[...quotes.slice(pivot),...quotes.slice(0,pivot)];}
      const data={day:today,wordsDay:freshWords?today:cached?.wordsDay,quotesDay:freshQuotes?today:cached?.quotesDay,words,quotes};
      try{localStorage.setItem('tt-daily-learning-v5',JSON.stringify(data));}catch{}
      retryAfter=Date.now()+60000;return data;
    })().finally(()=>{pending=null;});
    return pending;
  }
  window.TeacherTilesDaily=Object.freeze({dayKey,dayNumber,index,watch,feed});
})();
