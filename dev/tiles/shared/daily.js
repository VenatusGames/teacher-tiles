/* Calendar-day rotation is local, deterministic, and available offline. */
(() => {
  'use strict';
  const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayNumber=(date=new Date())=>Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  const index=(length,offset=0,date=new Date())=>((dayNumber(date)+offset)%length+length)%length;
  // Sort by a stable, salted hash instead of the editorial/alphabetical file order.
  // This is a permutation: every entry still appears once before the cycle repeats.
  function mixed(entries,salt='classroom-v2'){
    const hash=id=>{let h=2166136261;for(const char of salt+id){h=Math.imul(h^char.charCodeAt(0),16777619);}return h>>>0;};
    return [...entries].sort((a,b)=>hash(a.id)-hash(b.id)||a.id.localeCompare(b.id));
  }
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
    let cached;try{cached=JSON.parse(localStorage.getItem('tt-daily-learning-reviewed-v2'));}catch{}
    if(cached&&typeof cached==='object'){cached.words=(Array.isArray(cached.words)?cached.words:[]).filter(window.TeacherTilesLive.validWord);cached.quotes=(Array.isArray(cached.quotes)?cached.quotes:[]).filter(window.TeacherTilesLive.validQuote);}else cached=null;
    if(cached){
      // A previously cached subset must never shorten the full-year rotation.
      cached.words=[...new Map(cached.words.map(item=>[item.id,item])).values()];
      cached.quotes=[...new Map(cached.quotes.map(item=>[item.id,item])).values()];
      if(new Set(cached.words.map(item=>item.id)).size!==Object.values(window.TeacherTilesWords).flat().length)cached.words=[];
      if(new Set(cached.quotes.map(item=>item.id)).size!==window.TeacherTilesQuotes.length)cached.quotes=[];
    }
    const today=dayKey();
    if(cached?.day===today&&cached.wordsDay===today&&cached.quotesDay===today&&cached.words.length&&cached.quotes.length)return cached;
    if(Date.now()<retryAfter&&!pending)return cached||null;
    if(!pending)pending=(async()=>{
      const result=await Promise.allSettled([window.TeacherTilesLive.words(),window.TeacherTilesLive.quotes()]);
      const freshWords=result[0].status==='fulfilled',freshQuotes=result[1].status==='fulfilled';
      let words=freshWords?result[0].value:(cached?.words||[]);
      let quotes=freshQuotes?result[1].value:(cached?.quotes||[]);
      const data={day:today,wordsDay:freshWords?today:cached?.wordsDay,quotesDay:freshQuotes?today:cached?.quotesDay,words,quotes};
      try{localStorage.setItem('tt-daily-learning-reviewed-v2',JSON.stringify(data));}catch{}
      retryAfter=Date.now()+60000;return data;
    })().finally(()=>{pending=null;});
    return pending;
  }
  window.TeacherTilesDaily=Object.freeze({dayKey,dayNumber,index,mixed,watch,feed});
})();
