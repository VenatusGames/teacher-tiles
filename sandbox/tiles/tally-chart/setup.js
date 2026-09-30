function setupTallyChart(m){
  const list=m.querySelector('.tally-chart-rows');
  const empty=m.querySelector('.tally-chart-empty');
  const totalNode=m.querySelector('.tally-chart-total strong');
  const sortButton=m.querySelector('.tally-chart-sort');
  const addButton=m.querySelector('.tally-chart-add');
  const resetButton=m.querySelector('.tally-chart-reset');
  const viewButtons=[...m.querySelectorAll('[data-tally-view]')];
  let view='tallies',sort='added';
  let rows=[
    {label:'Option A',count:3,color:TABLE_MAKER_COLORS[0]},
    {label:'Option B',count:5,color:TABLE_MAKER_COLORS[1]},
    {label:'Option C',count:2,color:TABLE_MAKER_COLORS[3]}
  ];
  const normalizeRows=value=>(Array.isArray(value)?value:[]).slice(0,16).map((row,index)=>({label:String(row?.label||`Category ${index+1}`).slice(0,28),count:Math.max(0,Math.min(999,Math.round(Number(row?.count)||0))),color:/^#[0-9a-f]{6}$/i.test(String(row?.color||''))?String(row.color):TABLE_MAKER_COLORS[index%TABLE_MAKER_COLORS.length]}));
  const renderTallies=(target,count)=>{
    target.replaceChildren();
    if(!count){const hint=document.createElement('small');hint.textContent='Click to tally';target.appendChild(hint);return}
    for(let remaining=count;remaining>0;remaining-=5){
      const amount=Math.min(5,remaining),group=document.createElement('span');group.className=`tally-mark-group${amount===5?' is-five':''}`;
      for(let index=0;index<Math.min(4,amount);index++)group.appendChild(document.createElement('i'));
      if(amount===5)group.appendChild(document.createElement('b'));
      target.appendChild(group);
    }
  };
  const updateTotal=()=>{totalNode.textContent=rows.reduce((sum,row)=>sum+row.count,0).toLocaleString()};
  const renderRows=({animate=true}={})=>{
    list.replaceChildren();empty.hidden=rows.length>0;list.hidden=rows.length===0;updateTotal();addButton.disabled=rows.length>=16;addButton.textContent=rows.length>=16?'16 category limit':'+ Add Category';resetButton.disabled=!rows.some(row=>row.count>0);
    const ordered=rows.map((row,index)=>({row,index}));if(sort==='highest')ordered.sort((a,b)=>b.row.count-a.row.count||a.index-b.index);
    const max=Math.max(1,...rows.map(row=>row.count));
    ordered.forEach(({row,index},visualIndex)=>{
      const item=document.createElement('div');item.className=`tally-chart-row${animate?'':' is-count-update'}`;item.style.setProperty('--tally-color',row.color);item.style.setProperty('--tally-delay',`${visualIndex*35}ms`);
      const category=document.createElement('div');category.className='tally-chart-category';
      const color=document.createElement('input');color.type='color';color.value=row.color;color.setAttribute('aria-label',`Color for ${row.label}`);
      const label=document.createElement('input');label.type='text';label.maxLength=28;label.value=row.label;label.setAttribute('aria-label',`Tally category ${index+1}`);
      category.append(color,label);
      let display;
      if(view==='bars'){
        display=document.createElement('div');display.className='tally-chart-bar';display.innerHTML='<span></span>';display.querySelector('span').style.width=`${(row.count/max)*100}%`;
      }else{
        display=document.createElement('button');display.type='button';display.className='tally-chart-marks';display.setAttribute('aria-label',`Add one tally to ${row.label}`);renderTallies(display,row.count);
        display.addEventListener('click',()=>adjust(index,1));
      }
      const count=document.createElement('strong');count.className='tally-chart-count';count.textContent=String(row.count);
      const actions=document.createElement('div');actions.className='tally-chart-row-actions';
      const minus=document.createElement('button');minus.type='button';minus.textContent='−';minus.disabled=row.count===0;minus.setAttribute('aria-label',`Remove one tally from ${row.label}`);
      const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label',`Add one tally to ${row.label}`);
      const remove=document.createElement('button');remove.type='button';remove.className='tally-chart-remove';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${row.label}`);
      minus.addEventListener('click',()=>adjust(index,-1));plus.addEventListener('click',()=>adjust(index,1));remove.addEventListener('click',()=>{rows.splice(index,1);renderRows();notifyBoardChanged('tally-remove-category')});
      color.addEventListener('input',()=>{row.color=color.value;item.style.setProperty('--tally-color',row.color);notifyBoardChanged('tally-color')});
      label.addEventListener('input',()=>{row.label=label.value.slice(0,28)});
      actions.append(minus,plus,remove);item.append(category,display,count,actions);list.appendChild(item);
    });
  };
  const adjust=(index,amount)=>{const row=rows[index];if(!row)return;row.count=Math.max(0,Math.min(999,row.count+amount));renderRows({animate:false});notifyBoardChanged('tally-count')};
  list.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  viewButtons.forEach(button=>button.addEventListener('click',()=>{view=button.dataset.tallyView==='bars'?'bars':'tallies';m.dataset.tallyView=view;viewButtons.forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderRows();notifyBoardChanged('tally-view')}));
  sortButton.addEventListener('click',()=>{sort=sort==='added'?'highest':'added';m.dataset.tallySort=sort;sortButton.lastChild.textContent=sort==='highest'?' Highest First':' Added Order';sortButton.classList.toggle('is-active',sort==='highest');sortButton.setAttribute('aria-pressed',String(sort==='highest'));renderRows();notifyBoardChanged('tally-sort')});
  addButton.addEventListener('click',()=>{
    if(rows.length>=16)return;rows.push({label:`Category ${rows.length+1}`,count:0,color:TABLE_MAKER_COLORS[rows.length%TABLE_MAKER_COLORS.length]});sort='added';m.dataset.tallySort=sort;sortButton.lastChild.textContent=' Added Order';sortButton.classList.remove('is-active');renderRows();notifyBoardChanged('tally-add-category');
    requestAnimationFrame(()=>{const field=list.lastElementChild?.querySelector('.tally-chart-category input[type="text"]');if(field){enterModuleTextEdit(field);field.select()}});
  });
  resetButton.addEventListener('click',()=>{rows.forEach(row=>row.count=0);renderRows({animate:false});notifyBoardChanged('tally-reset')});
  m.querySelector('.tally-chart-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.tally-chart-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.tally-chart-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m._boardGetState=()=>({view,sort,rows:rows.map(row=>({...row}))});
  m._boardSetState=state=>{rows=normalizeRows(state?.rows);view=state?.view==='bars'?'bars':'tallies';sort=state?.sort==='highest'?'highest':'added';m.dataset.tallyView=view;m.dataset.tallySort=sort;viewButtons.forEach(button=>{const active=button.dataset.tallyView===view;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});sortButton.lastChild.textContent=sort==='highest'?' Highest First':' Added Order';sortButton.classList.toggle('is-active',sort==='highest');sortButton.setAttribute('aria-pressed',String(sort==='highest'));renderRows()};
  viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tallyView===view)));sortButton.setAttribute('aria-pressed','false');renderRows();
}
