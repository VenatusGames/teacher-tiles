function setupHundredsChart(m){
  const grid=m.querySelector('.hundreds-grid');
  const toggleAll=m.querySelector('.hundreds-toggle-all');
  const highlightButton=m.querySelector('.hundreds-highlight');

  const hidden=new Set();
  let highlight='off';

  const isHighlighted=n=>{
    if(highlight==='5')return n%5===0;
    if(highlight==='10')return n%10===0;
    return false;
  };

  const render=()=>{
    grid.replaceChildren();

    for(let n=1;n<=100;n++){
      const button=document.createElement('button');
      button.type='button';
      button.className='hundreds-cell';
      button.dataset.number=String(n);
      button.setAttribute('aria-label',hidden.has(n)?`Reveal ${n}`:`Hide ${n}`);
      button.classList.toggle('is-hidden',hidden.has(n));
      button.classList.toggle('is-highlighted',isHighlighted(n));

      const span=document.createElement('span');
      span.textContent=String(n);
      button.appendChild(span);

      button.addEventListener('click',()=>{
        if(hidden.has(n))hidden.delete(n);
        else hidden.add(n);

        button.classList.remove('hundreds-cell-pop');
        void button.offsetWidth;
        button.classList.add('hundreds-cell-pop');
        render();
      });

      grid.appendChild(button);
    }

    toggleAll.textContent=hidden.size===100?'Show All':'Hide All';
    highlightButton.textContent=highlight==='off'
      ?'Highlight: Off'
      :highlight==='5'
        ?'Highlight: 5s'
        :'Highlight: 10s';

    m.dataset.highlight=highlight;
  };

  toggleAll.addEventListener('click',()=>{
    if(hidden.size===100)hidden.clear();
    else{
      hidden.clear();
      for(let n=1;n<=100;n++)hidden.add(n);
    }
    render();
  });

  highlightButton.addEventListener('click',()=>{
    highlight=highlight==='off'?'5':highlight==='5'?'10':'off';
    render();
  });

  m.querySelector('.hundreds-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.hundreds-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.hundreds-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({hidden:[...hidden],highlight});
  m._boardSetState=state=>{
    hidden.clear();
    for(const value of Array.isArray(state?.hidden)?state.hidden:[]){
      const n=Number(value);
      if(n>=1&&n<=100)hidden.add(n);
    }
    highlight=['off','5','10'].includes(state?.highlight)?state.highlight:'off';
    render();
  };

  render();
}
