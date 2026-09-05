(() => {
  'use strict';
  function setup(m){
    const daily=window.TeacherTilesDaily,quotes=window.TeacherTilesQuotes;
    let offset=0,day=daily.dayKey(),live=[],disposed=false;
    const collection=()=>live.length?[...live,...quotes]:quotes;
    function render(){
      const today=daily.dayKey();if(day!==today){day=today;offset=0;}
      const bank=collection(),item=bank[live.length?offset%bank.length:daily.index(bank.length,offset)];
      m.querySelector('.daily-date').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric'});
      m.querySelector('.daily-quote').textContent=item.text;
      m.querySelector('.quote-author').textContent=item.author;
      const source=m.querySelector('.quote-source');source.textContent=item.work;source.href=item.source;
      m.querySelector('.quote-prompt').textContent=item.prompt;
      m.querySelector('.daily-today').disabled=offset===0;
    }
    m.querySelector('.daily-next').addEventListener('click',()=>{offset=(offset+1)%collection().length;render();notifyBoardChanged('daily-quote');});
    m.querySelector('.daily-today').addEventListener('click',()=>{offset=0;render();notifyBoardChanged('daily-quote');});
    m._boardGetState=()=>({offset,day});
    m._boardSetState=s=>{day=daily.dayKey();offset=s?.day===day&&Number.isInteger(s.offset)?Math.min(1000,Math.max(0,s.offset)):0;render();};
    daily.watch(m,()=>{render();daily.feed().then(data=>{if(disposed)return;live=(data?.quotes||[]).filter(q=>typeof q.text==='string'&&typeof q.author==='string'&&q.source==='https://zenquotes.io/');render();});});
    const prior=m._cleanup;m._cleanup=()=>{disposed=true;prior?.();};
  }
  window.TeacherTilesQuoteOfTheDay=Object.freeze({setup});
})();
