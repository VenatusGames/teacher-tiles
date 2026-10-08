function setupGroupMaker(m){
  const nameInput=m.querySelector('.groupmaker-name-input');
  const addNameBtn=m.querySelector('.groupmaker-add-name');
  const nameList=m.querySelector('.groupmaker-name-list');
  const sizeInput=m.querySelector('.groupmaker-size');
  const makeBtn=m.querySelector('.groupmaker-make');
  const shuffleBtn=m.querySelector('.groupmaker-shuffle');
  const editBtn=m.querySelector('.groupmaker-edit-names');
  const results=m.querySelector('.groupmaker-results');
  const countLabel=m.querySelector('.groupmaker-name-count');
  const summary=m.querySelector('.groupmaker-summary');
  const bg=m.querySelector('.groupmaker-bg');
  const font=m.querySelector('.groupmaker-font');
  const textColor=m.querySelector('.groupmaker-text-color');
  const editor=m.querySelector('.groupmaker-setup');
  const footer=m.querySelector('.groupmaker-footer');
  const actions=m.querySelector('.groupmaker-actions');
  const empty=results.querySelector('.groupmaker-empty');
  const editorHeading=document.createElement('strong');editorHeading.className='groupmaker-editor-heading';editorHeading.textContent='Names';
  editor.prepend(editorHeading);
  const sizeControl=m.querySelector('.groupmaker-size-control');
  sizeControl.querySelector('span').textContent='Students Per Group';
  const sizePanel=document.createElement('div');sizePanel.className='groupmaker-size-panel';sizePanel.hidden=true;sizePanel.append(sizeControl);m.append(sizePanel);
  const sizeButton=document.createElement('button');sizeButton.type='button';sizeButton.className='groupmaker-size-button';sizeButton.setAttribute('aria-expanded','false');
  sizeButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 4v3"/></svg><span class="groupmaker-size-button-label">Students Per Group</span><span class="groupmaker-size-value">4</span>';
  actions.prepend(sizeButton);
  const layout=createGroupMakerLayout(results);
  editor.hidden=true;m.append(editor);
  footer.querySelector('.groupmaker-balance-note')?.remove();
  footer.prepend(actions);
  const listIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>';
  editBtn.innerHTML=listIcon+'<span>Names</span>';editBtn.setAttribute('aria-expanded','false');
  shuffleBtn.classList.remove('primary');makeBtn.classList.remove('primary');
  shuffleBtn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-4m2-4c1.5-2 3-4 5-4h3m-4-4 4 4-4 4"/></svg><span>Shuffle</span>';
  const startButton=document.createElement('button');startButton.type='button';startButton.className='groupmaker-start';startButton.innerHTML=listIcon+'<span>Add Names</span>';empty.append(startButton);
  function closeEditor(){
    if(editor.contains(document.activeElement))document.activeElement.blur();
    editor.hidden=true;editBtn.setAttribute('aria-expanded','false');
  }
  function closeSize(){sizePanel.hidden=true;sizeButton.setAttribute('aria-expanded','false');if(sizePanel.contains(document.activeElement))document.activeElement.blur()}
  function syncSize(){sizeButton.querySelector('.groupmaker-size-value').textContent=sizeInput.value;sizeButton.setAttribute('aria-label',`Students Per Group: ${sizeInput.value}`)}
  sizeButton.addEventListener('click',()=>{const open=sizePanel.hidden;closeSize();closeEditor();if(open){sizePanel.hidden=false;sizeButton.setAttribute('aria-expanded','true');sizeInput.focus({preventScroll:true});sizeInput.select()}});
  sizePanel.addEventListener('keydown',event=>{if(event.key==='Escape'||event.key==='Enter'){event.stopPropagation();if(event.key==='Enter')sizeInput.dispatchEvent(new Event('change'));closeSize();sizeButton.focus({preventScroll:true})}});
  function openEditor(){closeSize();editor.hidden=false;editBtn.setAttribute('aria-expanded','true');nameInput.focus({preventScroll:true})}
  function showEmpty(){results.replaceChildren(empty);m.classList.remove('has-groups');summary.textContent=names.length?`${names.length} names ready`:'Add names to get started'}
  startButton.addEventListener('click',openEditor);
  const outsideEditor=event=>{
    if(!editor.contains(event.target)&&!editBtn.contains(event.target)&&!startButton.contains(event.target))closeEditor();
    if(!sizePanel.contains(event.target)&&!sizeButton.contains(event.target))closeSize();
  };
  const closePopups=()=>{closeEditor();closeSize()};
  document.addEventListener('pointerdown',outsideEditor,true);
  m.addEventListener('pointerleave',closePopups);
  editor.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeEditor();editBtn.focus({preventScroll:true})}});
  for(const scroll of [editor,results])scroll.addEventListener('wheel',event=>{if(!event.ctrlKey)event.stopPropagation()},{passive:true});


  let names=[];
  let groupTitles=[];
  let shuffleTimer=0;

  const normalizeName=value=>value.trim().replace(/\s+/g,' ');

  const updateCount=()=>{
    const count=names.length;
    countLabel.textContent=`${count} ${count===1?'name':'names'}`;
    makeBtn.disabled=count<2;shuffleBtn.disabled=count<2;
    editBtn.querySelector('span').textContent=`Names · ${count}`;
  };

  const renderNameList=()=>{
    nameList.replaceChildren();

    names.forEach((name,index)=>{
      const chip=document.createElement('div');
      chip.className='groupmaker-name-chip';

      const text=document.createElement('span');
      text.textContent=name;

      const remove=document.createElement('button');
      remove.type='button';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${name}`);
      remove.addEventListener('click',()=>{
        names.splice(index,1);
        renderNameList();
        updateCount();
        if(m.classList.contains('has-groups')){
          if(names.length>=2){
            makeGroups(true);
          }else{
            showEmpty();
          }
        }
        notifyBoardChanged('groupmaker-names');
      });

      chip.append(text,remove);
      nameList.appendChild(chip);
    });

    nameList.classList.toggle('is-empty',names.length===0);
  };

  const addName=()=>{
    const value=normalizeName(nameInput.value);
    if(!value)return;

    const exists=names.some(name=>name.toLocaleLowerCase()===value.toLocaleLowerCase());
    if(exists){
      nameInput.select();
      return;
    }

    names.push(value);
    nameInput.value='';
    renderNameList();
    updateCount();
    nameInput.focus({preventScroll:true});
    notifyBoardChanged('groupmaker-names');
  };

  const shuffleNames=list=>{
    const copy=[...list];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  };

  const balanceGroups=(list,targetSize)=>{
    if(!list.length)return [];
    const groupCount=Math.max(1,Math.ceil(list.length/targetSize));
    const groups=Array.from({length:groupCount},()=>[]);
    list.forEach((name,index)=>{
      groups[index%groupCount].push(name);
    });
    return groups;
  };

  const ensureGroupTitles=count=>{
    while(groupTitles.length<count){
      groupTitles.push(`Group ${groupTitles.length+1}`);
    }
    if(groupTitles.length>count){
      groupTitles=groupTitles.slice(0,count);
    }
  };

  const renderGroups=(groups,{animate=false}={})=>{
    ensureGroupTitles(groups.length);
    results.replaceChildren();
    results.classList.toggle('is-shuffling',animate);

    const grid=document.createElement('div');
    grid.className='groupmaker-grid';
    grid.style.setProperty('--group-count',String(groups.length));

    groups.forEach((group,index)=>{
      const card=document.createElement('section');
      card.className='groupmaker-group';
      card.style.setProperty('--group-accent',['#6b9bd2','#8eaf8a','#bc91bb','#d4ab68'][index%4]);
      if(animate)card.style.setProperty('--group-delay',`${index*55}ms`);

      const title=document.createElement('input');
      title.className='groupmaker-group-title-input';
      title.type='text';
      title.maxLength=28;
      title.value=groupTitles[index]||`Group ${index+1}`;
      title.setAttribute('aria-label',`Edit name for group ${index+1}`);
      title.addEventListener('input',()=>{
        groupTitles[index]=title.value;
      });
      title.addEventListener('blur',()=>{
        const fallback=`Group ${index+1}`;
        const value=title.value.trim();
        groupTitles[index]=value||fallback;
        title.value=groupTitles[index];
      });

      const list=document.createElement('ol');
      list.className='groupmaker-group-list';

      group.forEach((name,nameIndex)=>{
        const item=document.createElement('li');
        item.textContent=name;
        if(animate)item.style.setProperty('--name-delay',`${index*55+nameIndex*38}ms`);
        list.appendChild(item);
      });

      card.append(title,list);
      grid.appendChild(card);
    });

    results.appendChild(grid);
    layout.refresh();
    const total=groups.reduce((sum,group)=>sum+group.length,0);
    summary.textContent=`${total} students · ${groups.length} ${groups.length===1?'group':'groups'}`;
    m.classList.add('has-groups');

    if(animate){
      clearTimeout(shuffleTimer);
      shuffleTimer=setTimeout(()=>results.classList.remove('is-shuffling'),750);
    }
  };

  const makeGroups=(animate=true)=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      updateCount();
      return;
    }

    const targetSize=Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4)));
    sizeInput.value=String(targetSize);syncSize();
    renderGroups(balanceGroups(shuffleNames(names),targetSize),{animate});
    notifyBoardChanged('groupmaker-groups');
  };

  addNameBtn.addEventListener('click',addName);
  nameInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  sizeInput.addEventListener('change',()=>{
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4))));syncSize();
    notifyBoardChanged('groupmaker-size');
    if(m.classList.contains('has-groups'))makeGroups(true);
  });

  makeBtn.addEventListener('click',()=>{makeGroups(true);closeEditor()});

  shuffleBtn.addEventListener('click',()=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      nameInput.focus({preventScroll:true});
      return;
    }
    makeGroups(true);closeEditor();
  });

  editBtn.addEventListener('click',()=>{
    if(editor.hidden)openEditor();else closeEditor();
  });

  bg.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  font.addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);layout.refresh()});
  textColor.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  renderNameList();
  updateCount();

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.groupmaker-name-entry'),rosterNames=>{
    names=normalizeRosterNames(rosterNames);
    groupTitles=[];
    showEmpty();
    summary.textContent='Class roster loaded';
    notifyBoardChanged('groupmaker-roster');
    renderNameList();
    updateCount();
  });

  m._boardGetState=()=>({
    names:[...names],
    groupTitles:[...groupTitles],
    targetSize:Number(sizeInput.value)||4,
    groups:[...results.querySelectorAll('.groupmaker-group')].map(card=>
      [...card.querySelectorAll('.groupmaker-group-list li')].map(item=>item.textContent||'')
    )
  });
  m._boardSetState=state=>{
    if(!state)return;
    names=Array.isArray(state.names)?state.names.map(String):[];
    groupTitles=Array.isArray(state.groupTitles)?state.groupTitles.map(String):[];
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(state.targetSize)||4))));syncSize();
    renderNameList();
    updateCount();
    if(Array.isArray(state.groups)&&state.groups.length&&names.length>=2)renderGroups(state.groups,{animate:false});
    else showEmpty();
  };

  const priorDeactivate=m._deactivate;
  m._deactivate=()=>{closePopups();priorDeactivate?.()};
  const prior=m._cleanup;
  m._cleanup=()=>{
    closePopups();layout.cleanup();
    document.removeEventListener('pointerdown',outsideEditor,true);
    m.removeEventListener('pointerleave',closePopups);
    prior?.();
    detachRosterLoader();
    clearTimeout(shuffleTimer);
  };
}
