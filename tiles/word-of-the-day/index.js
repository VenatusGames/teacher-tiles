(() => {
  'use strict';
  function setup(m){
    const daily=window.TeacherTilesDaily,bank=window.TeacherTilesWords;
    let level='all',offset=0,day=daily.dayKey(),live=[],disposed=false;
    const credit=document.createElement('a');credit.className='widget-status';credit.target='_blank';credit.rel='noopener noreferrer';m.querySelector('.daily-content').append(credit);
    const wordsForDay=()=>{const pool=live.length?live:Object.values(bank).flat();return level==='all'?pool:pool.filter(w=>w.level===level);};
    const choice=m.querySelector('.word-level');
    function render(){
      const today=daily.dayKey();if(day!==today){day=today;offset=0;}
      const words=wordsForDay(),item=words[daily.index(words.length,offset)];
      credit.textContent=item.credit||'TeacherTiles classroom definition';if(item.source?.startsWith('https://dictionary.cambridge.org/dictionary/english/'))credit.href=item.source;else credit.removeAttribute('href');
      m.querySelector('.daily-date').textContent=new Date().toLocaleDateString(undefined,{month:'long',day:'numeric'});
      m.querySelector('.daily-word').textContent=item.word;
      m.querySelector('.daily-part').textContent=item.part;
      m.querySelector('.daily-definition').textContent=item.definition;
      m.querySelector('.daily-example').textContent=item.example;
      m.querySelector('.daily-today').disabled=offset===0;
      choice.value=level;
    }
    choice.addEventListener('change',()=>{level=['everyday','challenge'].includes(choice.value)?choice.value:'all';offset=0;render();notifyBoardChanged('daily-word-level');});
    m.querySelector('.daily-next').addEventListener('click',()=>{offset=(offset+1)%wordsForDay().length;render();notifyBoardChanged('daily-word');});
    m.querySelector('.daily-today').addEventListener('click',()=>{offset=0;render();notifyBoardChanged('daily-word');});
    m._boardGetState=()=>({level,offset,day});
    m._boardSetState=s=>{level=['everyday','challenge'].includes(s?.level)?s.level:'all';day=daily.dayKey();offset=s?.day===day&&Number.isInteger(s.offset)?Math.min(1000,Math.max(0,s.offset)):0;render();};
    daily.watch(m,()=>{render();daily.feed().then(data=>{if(disposed)return;live=(data?.words||[]).filter(w=>window.TeacherTilesLive.validWord(w));render();});});
    const prior=m._cleanup;m._cleanup=()=>{disposed=true;prior?.();};
  }
  window.TeacherTilesWordOfTheDay=Object.freeze({setup});
})();
