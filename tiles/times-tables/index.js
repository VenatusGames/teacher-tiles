(() => {
  'use strict';
  const bound=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.round(Number(v)))):fallback;
  function normalize(s){
    const families=[...new Set((Array.isArray(s?.families)?s.families:[2,5,10]).filter(n=>Number.isInteger(n)&&n>=0&&n<=12))].sort((a,b)=>a-b);
    const start=bound(s?.start,1,0,20),end=Math.max(start,bound(s?.end,12,0,20));
    return {families,start,end,chartMode:!!s?.chartMode,practice:!!s?.practice,revealed:(Array.isArray(s?.revealed)?s.revealed:[]).filter(key=>typeof key==='string'&&/^\d{1,2}:\d{1,2}$/.test(key)).slice(0,273)};
  }
  function renderChart(grid){
    grid.classList.add('is-chart-mode');grid.replaceChildren();
    const table=document.createElement('table');table.className='times-chart';table.setAttribute('aria-label','Multiplication chart from 0 to 12');
    const head=table.createTHead().insertRow(),corner=document.createElement('th');corner.textContent='×';corner.setAttribute('aria-label','Multiply');head.append(corner);
    for(let x=0;x<=12;x++){const cell=document.createElement('th');cell.scope='col';cell.textContent=String(x);head.append(cell);}
    const body=table.createTBody();
    for(let y=0;y<=12;y++){
      const row=body.insertRow(),label=document.createElement('th');label.scope='row';label.textContent=String(y);row.append(label);
      for(let x=0;x<=12;x++){const cell=row.insertCell();cell.textContent=String(x*y);cell.setAttribute('aria-label',`${y} times ${x} equals ${y*x}`);}
    }
    grid.append(table);
  }
  function setup(m){
    let state=normalize(),revealed=new Set();
    const grid=m.querySelector('.times-grid'),picker=m.querySelector('.times-families'),from=m.querySelector('.times-from'),to=m.querySelector('.times-to'),chartToggle=m.querySelector('.times-chart-toggle');
    const changed=()=>notifyBoardChanged('times-tables');
    for(let n=0;n<=12;n++){
      const button=document.createElement('button');button.type='button';button.className='times-family';button.textContent=String(n);button.setAttribute('aria-label',`${n} times table`);button.dataset.family=String(n);
      button.addEventListener('click',()=>{state.families=state.families.includes(n)?state.families.filter(x=>x!==n):[...state.families,n].sort((a,b)=>a-b);revealed.clear();render();changed();});picker.append(button);
    }
    function render(){
      from.value=state.start;to.value=state.end;
      m.querySelector('.times-practice-legacy').checked=state.practice;
      chartToggle.setAttribute('aria-checked',String(state.chartMode));
      m.querySelector('.times-family-settings').hidden=state.chartMode;
      m.classList.toggle('is-chart-mode',state.chartMode);grid.classList.toggle('is-chart-mode',state.chartMode);
      for(const button of m.querySelectorAll('.times-reveal,.times-hide'))button.hidden=state.chartMode;
      picker.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(state.families.includes(Number(b.dataset.family)))));
      grid.replaceChildren();
      if(state.chartMode){renderChart(grid);m.querySelector('.times-summary').textContent='0–12 Multiplication Chart';return;}
      if(!state.families.length){const empty=document.createElement('div');empty.className='widget-empty';empty.textContent='Choose a fact family in settings to start practicing.';grid.append(empty);}
      state.families.forEach(family=>{
        const group=document.createElement('section');group.className='times-family-card';
        const heading=document.createElement('h3');heading.textContent=`${family}×`;group.append(heading);
        for(let multiplier=state.start;multiplier<=state.end;multiplier++){
          const key=`${family}:${multiplier}`,answer=family*multiplier,shown=!state.practice||revealed.has(key);
          const row=document.createElement('button');row.type='button';row.className='times-fact';
          const fact=document.createElement('span');fact.textContent=`${family} × ${multiplier}`;
          const result=document.createElement('strong');result.textContent=shown?`= ${answer}`:'= ?';row.append(fact,result);
          row.setAttribute('aria-label',`${family} times ${multiplier}${shown?` equals ${answer}`:'. Reveal answer'}`);row.setAttribute('aria-pressed',String(shown));
          row.addEventListener('click',()=>{if(!state.practice)return;if(revealed.has(key))revealed.delete(key);else revealed.add(key);render();changed();grid.querySelector(`[data-fact="${key}"]`)?.focus({preventScroll:true});});row.dataset.fact=key;group.append(row);
        }
        grid.append(group);
      });
      m.querySelector('.times-summary').textContent=`${state.families.length} ${state.families.length===1?'family':'families'} · ×${state.start}–${state.end}${state.practice?' · Tap a fact to reveal':''}`;
      m.querySelector('.times-reveal').disabled=!state.practice||!state.families.length;
      m.querySelector('.times-hide').disabled=!state.families.length;
    }
    const range=()=>{if(from.value===''||to.value==='')return;state={...state,...normalize({...state,start:from.value,end:to.value})};revealed.clear();render();changed();};
    for(const field of [from,to]){field.addEventListener('input',range);field.addEventListener('change',range);}
    chartToggle.addEventListener('click',()=>{state.chartMode=!state.chartMode;render();changed();});
    m.querySelector('.times-reveal').addEventListener('click',()=>{for(const f of state.families)for(let n=state.start;n<=state.end;n++)revealed.add(`${f}:${n}`);render();changed();});
    m.querySelector('.times-hide').addEventListener('click',()=>{state.practice=true;revealed.clear();render();changed();});
    m._boardGetState=()=>({...state,revealed:[...revealed]});
    m._boardSetState=s=>{state=normalize(s);revealed=new Set(state.revealed);render();};render();
  }
  window.TeacherTilesTimesTables=Object.freeze({setup,normalize,renderChart});
})();
