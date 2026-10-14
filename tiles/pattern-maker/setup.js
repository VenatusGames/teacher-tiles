function setupPatternMaker(m){
  const board=m.querySelector('.pattern-maker-board');
  const palette=m.querySelector('.pattern-maker-palette');
  const typeSelect=m.querySelector('.pattern-maker-type');
  const lengthSelect=m.querySelector('.pattern-maker-length');
  const applyButton=m.querySelector('.pattern-maker-apply');
  const addRowButton=m.querySelector('.pattern-maker-add-row');
  const clearButton=m.querySelector('.pattern-maker-clear');
  const colors=[
    {id:'red',label:'Red',value:'#ef4b45'},{id:'orange',label:'Orange',value:'#f58a3c'},
    {id:'yellow',label:'Yellow',value:'#f2cf45'},{id:'green',label:'Green',value:'#32a875'},
    {id:'blue',label:'Blue',value:'#3978cf'},{id:'purple',label:'Purple',value:'#8b5bc7'},
    {id:'pink',label:'Pink',value:'#e96f9e'},{id:'teal',label:'Teal',value:'#2aa8ad'}
  ];
  const patterns={ab:[0,1],aab:[0,0,1],abb:[0,1,1],abc:[0,1,2],abbc:[0,1,1,2]};
  let length=12;
  let rows=[Array(length).fill(''),Array(length).fill('')];
  let selectedColor='red';
  let painting=false;

  const colorById=id=>colors.find(color=>color.id===id);
  const normalizeRows=input=>{
    const source=Array.isArray(input)&&input.length?input.slice(0,4):[[]];
    return source.map(row=>Array.from({length},(_,index)=>colorById(row?.[index])?row[index]:''));
  };
  const notify=reason=>notifyBoardChanged(`pattern-maker-${reason}`);

  const paint=(rowIndex,cellIndex)=>{
    if(!rows[rowIndex]||cellIndex<0||cellIndex>=length)return;
    rows[rowIndex][cellIndex]=selectedColor;
    const cell=board.querySelector(`[data-pattern-row="${rowIndex}"][data-pattern-cell="${cellIndex}"]`);
    if(cell){cell.dataset.color=selectedColor;cell.style.setProperty('--pattern-cell-color',colorById(selectedColor)?.value||'transparent')}
  };

  const renderBoard=()=>{
    board.replaceChildren();
    rows.forEach((row,rowIndex)=>{
      const line=document.createElement('div');
      line.className='pattern-maker-row';
      const label=document.createElement('span');
      label.className='pattern-maker-row-label';
      label.textContent=`${rowIndex+1}`;
      const cells=document.createElement('div');
      cells.className='pattern-maker-cells';
      cells.style.gridTemplateColumns=`repeat(${length},minmax(18px,1fr))`;
      row.forEach((colorId,cellIndex)=>{
        const cell=document.createElement('button');
        cell.type='button';
        cell.className='pattern-maker-cell';
        cell.dataset.patternRow=String(rowIndex);
        cell.dataset.patternCell=String(cellIndex);
        cell.dataset.color=colorId;
        cell.style.setProperty('--pattern-cell-color',colorById(colorId)?.value||'transparent');
        cell.setAttribute('aria-label',`Row ${rowIndex+1}, square ${cellIndex+1}${colorId?`, ${colorById(colorId)?.label}`:''}`);
        cell.addEventListener('click',()=>{paint(rowIndex,cellIndex);notify('paint')});
        cell.addEventListener('contextmenu',event=>{
          event.preventDefault();event.stopPropagation();rows[rowIndex][cellIndex]='';renderBoard();notify('erase');
        });
        cells.appendChild(cell);
      });
      const remove=document.createElement('button');
      remove.type='button';
      remove.className='pattern-maker-remove-row';
      remove.textContent='×';
      remove.title='Remove row';
      remove.setAttribute('aria-label',`Remove pattern row ${rowIndex+1}`);
      remove.disabled=rows.length<=1;
      remove.addEventListener('click',()=>{if(rows.length<=1)return;rows.splice(rowIndex,1);renderBoard();notify('row')});
      line.append(label,cells,remove);
      board.appendChild(line);
    });
    addRowButton.disabled=rows.length>=4;
  };

  colors.forEach(color=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='pattern-maker-color';
    button.dataset.patternColor=color.id;
    button.style.setProperty('--pattern-swatch',color.value);
    button.title=color.label;
    button.setAttribute('aria-label',`Use ${color.label}`);
    button.addEventListener('click',()=>{
      selectedColor=color.id;
      palette.querySelectorAll('.pattern-maker-color').forEach(item=>item.classList.toggle('is-selected',item===button));
      notify('color');
    });
    palette.appendChild(button);
  });
  palette.querySelector('[data-pattern-color="red"]')?.classList.add('is-selected');

  board.addEventListener('pointerdown',event=>{
    const cell=event.target.closest('.pattern-maker-cell');
    if(!cell||event.button!==0)return;
    event.preventDefault();event.stopPropagation();painting=true;
    paint(Number(cell.dataset.patternRow),Number(cell.dataset.patternCell));
    try{board.setPointerCapture(event.pointerId)}catch{}
  });
  board.addEventListener('pointermove',event=>{
    if(!painting)return;
    const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest('.pattern-maker-cell');
    if(cell&&board.contains(cell))paint(Number(cell.dataset.patternRow),Number(cell.dataset.patternCell));
  });
  const stopPainting=event=>{
    if(!painting)return;
    painting=false;
    try{board.releasePointerCapture(event.pointerId)}catch{}
    notify('paint');
  };
  board.addEventListener('pointerup',stopPainting);
  board.addEventListener('pointercancel',stopPainting);

  const applyPattern=()=>{
    const sequence=patterns[typeSelect.value];
    if(!sequence)return;
    const start=Math.max(0,colors.findIndex(color=>color.id===selectedColor));
    const patternColors=[colors[start],colors[(start+1)%colors.length],colors[(start+2)%colors.length]];
    rows=rows.map(()=>Array.from({length},(_,index)=>patternColors[sequence[index%sequence.length]].id));
    renderBoard();notify('preset');
  };
  applyButton.addEventListener('click',applyPattern);
  typeSelect.addEventListener('change',()=>{applyButton.disabled=typeSelect.value==='free';notify('type')});
  lengthSelect.addEventListener('change',()=>{
    length=[8,12,16,20].includes(Number(lengthSelect.value))?Number(lengthSelect.value):12;
    rows=normalizeRows(rows);renderBoard();notify('length');
  });
  addRowButton.addEventListener('click',()=>{if(rows.length<4){rows.push(Array(length).fill(''));renderBoard();notify('row')}});
  clearButton.addEventListener('click',()=>{rows=rows.map(()=>Array(length).fill(''));renderBoard();notify('clear')});
  m.querySelector('.pattern-maker-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.pattern-maker-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.pattern-maker-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({length,rows:rows.map(row=>[...row]),selectedColor,patternType:typeSelect.value});
  m._boardSetState=state=>{
    if(!state)return;
    length=[8,12,16,20].includes(Number(state.length))?Number(state.length):12;
    lengthSelect.value=String(length);
    selectedColor=colorById(state.selectedColor)?state.selectedColor:'red';
    typeSelect.value=state.patternType in patterns||state.patternType==='free'?state.patternType:'free';
    applyButton.disabled=typeSelect.value==='free';
    rows=normalizeRows(state.rows);
    palette.querySelectorAll('.pattern-maker-color').forEach(item=>item.classList.toggle('is-selected',item.dataset.patternColor===selectedColor));
    renderBoard();
  };
  applyButton.disabled=true;
  renderBoard();
}
