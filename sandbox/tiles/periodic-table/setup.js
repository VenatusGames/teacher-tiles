function setupPeriodicTable(m){
  const grid=m.querySelector('.periodic-grid');
  const legend=m.querySelector('.periodic-legend');
  const detail=m.querySelector('.periodic-detail');
  const closeButton=m.querySelector('.periodic-detail-close');
  const symbolEl=m.querySelector('.periodic-detail-symbol');
  const numberEl=m.querySelector('.periodic-detail-number');
  const nameEl=m.querySelector('.periodic-detail-name');
  const categoryEl=m.querySelector('.periodic-detail-category');
  const facts=m.querySelector('.periodic-detail-facts');

  const categoryOrder=[
    'Alkali metal','Alkaline earth metal','Transition metal','Post-transition metal',
    'Metalloid','Reactive nonmetal','Halogen','Noble gas','Lanthanide','Actinide'
  ];

  const openElement=element=>{
    symbolEl.textContent=element.symbol;
    symbolEl.dataset.category=element.categoryKey;
    numberEl.textContent=`Atomic number ${element.n}`;
    nameEl.textContent=element.name;
    categoryEl.textContent=element.category;

    const group=element.group===null?'f-block':`Group ${element.group}`;
    facts.replaceChildren();

    [
      ['Atomic mass',element.mass],
      ['Period',String(element.period)],
      ['Group',group],
      ['Block',`${element.block}-block`]
    ].forEach(([label,value])=>{
      const item=document.createElement('div');
      const small=document.createElement('span');
      small.textContent=label;
      const strong=document.createElement('strong');
      strong.textContent=value;
      item.append(small,strong);
      facts.appendChild(item);
    });

    detail.hidden=false;
    detail.classList.remove('periodic-detail-pop');
    void detail.offsetWidth;
    detail.classList.add('periodic-detail-pop');
  };

  PERIODIC_ELEMENTS.forEach(element=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='periodic-element';
    button.dataset.category=element.categoryKey;
    button.style.gridRow=String(element.row);
    button.style.gridColumn=String(element.col);
    button.setAttribute('aria-label',`${element.name}, atomic number ${element.n}`);

    const number=document.createElement('span');
    number.className='periodic-element-number';
    number.textContent=String(element.n);

    const symbol=document.createElement('strong');
    symbol.textContent=element.symbol;

    const name=document.createElement('span');
    name.className='periodic-element-name';
    name.textContent=element.name;

    button.append(number,symbol,name);
    button.addEventListener('click',()=>openElement(element));
    grid.appendChild(button);
  });

  categoryOrder.forEach(category=>{
    const sample=PERIODIC_ELEMENTS.find(element=>element.category===category);
    if(!sample)return;

    const item=document.createElement('span');
    item.className='periodic-legend-item';

    const swatch=document.createElement('i');
    swatch.dataset.category=sample.categoryKey;

    const text=document.createElement('span');
    text.textContent=category;

    item.append(swatch,text);
    legend.appendChild(item);
  });

  closeButton.addEventListener('click',()=>{detail.hidden=true;});
  detail.addEventListener('keydown',event=>{
    if(event.key==='Escape')detail.hidden=true;
  });

  m.querySelector('.periodic-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.periodic-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
}
