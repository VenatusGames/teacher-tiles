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

  let names=[];
  let groupTitles=[];
  let shuffleTimer=0;

  const normalizeName=value=>value.trim().replace(/\s+/g,' ');

  const updateCount=()=>{
    const count=names.length;
    countLabel.textContent=`${count} ${count===1?'name':'names'}`;
    makeBtn.disabled=count<2;
  };

  const renderNameList=()=>{
    requestAnimationFrame(()=>fitNameModuleToRoster(m,names.length,{namesPerRow:5,rowHeight:32,threshold:10}));
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
            m.classList.remove('has-groups');
          }
        }
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
    sizeInput.value=String(targetSize);
    renderGroups(balanceGroups(shuffleNames(names),targetSize),{animate});
  };

  addNameBtn.addEventListener('click',addName);
  nameInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      addName();
    }
  });

  sizeInput.addEventListener('change',()=>{
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(sizeInput.value)||4))));
    if(m.classList.contains('has-groups'))makeGroups(true);
  });

  makeBtn.addEventListener('click',()=>makeGroups(true));

  shuffleBtn.addEventListener('click',()=>{
    if(names.length<2){
      m.classList.remove('has-groups');
      nameInput.focus({preventScroll:true});
      return;
    }
    makeGroups(true);
  });

  editBtn.addEventListener('click',()=>{
    m.classList.remove('has-groups');
    summary.textContent='Edit your class list';
    requestAnimationFrame(()=>nameInput.focus({preventScroll:true}));
  });

  bg.addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  font.addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  textColor.addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  renderNameList();
  updateCount();

  const detachRosterLoader=attachClassRosterLoader(nameInput.closest('.groupmaker-name-entry'),rosterNames=>{
    names=normalizeRosterNames(rosterNames);
    groupTitles=[];
    m.classList.remove('has-groups');
    summary.textContent='Class roster loaded';
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
    sizeInput.value=String(Math.max(2,Math.min(12,Math.round(Number(state.targetSize)||4))));
    renderNameList();
    updateCount();
    if(Array.isArray(state.groups)&&state.groups.length&&names.length>=2)renderGroups(state.groups,{animate:false});
    else m.classList.remove('has-groups');
  };

  const prior=m._cleanup;
  m._cleanup=()=>{
    prior?.();
    detachRosterLoader();
    clearTimeout(shuffleTimer);
  };
}
