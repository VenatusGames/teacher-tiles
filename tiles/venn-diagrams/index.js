(() => {
  'use strict';

  const MAX_ITEMS=48;
  const ITEM_MAX=72;
  const HEADING_MAX=40;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clean=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

  const REGION_LABELS_2=[
    {value:1,label:'A'},
    {value:3,label:'Both'},
    {value:2,label:'B'}
  ];
  const REGION_LABELS_3=[
    {value:1,label:'A'},
    {value:3,label:'A+B'},
    {value:2,label:'B'},
    {value:5,label:'A+C'},
    {value:7,label:'All'},
    {value:6,label:'B+C'},
    {value:4,label:'C'}
  ];

  function normalizeItems(items,mode='2'){
    const valid=mode==='3'?new Set([1,2,3,4,5,6,7]):new Set([1,2,3]);
    if(!Array.isArray(items))return[];
    return items.slice(0,MAX_ITEMS).map((item,index)=>({
      id:clean(item?.id,48)||`restored-${index+1}`,
      text:clean(item?.text,ITEM_MAX),
      region:valid.has(Number(item?.region))?Number(item.region):1
    })).filter(item=>item.text);
  }

  function setup(m){
    const stage=m.querySelector('.venn-stage');
    const circleA=m.querySelector('.venn-circle--a');
    const circleB=m.querySelector('.venn-circle--b');
    const circleC=m.querySelector('.venn-circle--c');
    const itemLayer=m.querySelector('.venn-items');
    const headings={
      a:m.querySelector('.venn-heading--a'),
      b:m.querySelector('.venn-heading--b'),
      c:m.querySelector('.venn-heading--c')
    };
    const form=m.querySelector('.venn-entry');
    const input=m.querySelector('.venn-input');
    const regionPicker=m.querySelector('.venn-region-picker');
    const clearButton=m.querySelector('.venn-clear');
    const modeButtons=[...m.querySelectorAll('[data-venn-mode]')];

    let mode='2';
    let items=[];
    let serial=0;
    let selectedRegion=1;
    let disposed=false;
    let layoutFrame=0;
    let geometry=null;

    const changed=reason=>notifyBoardChanged(`venn-diagram-${reason}`);

    function headingText(key){
      const fallback=key==='a'?'Set A':key==='b'?'Set B':'Set C';
      return clean(headings[key]?.textContent,HEADING_MAX)||fallback;
    }

    function updateClearState(){
      clearButton.disabled=!items.length;
      input.disabled=items.length>=MAX_ITEMS;
      input.placeholder=items.length>=MAX_ITEMS?'Venn diagram is full':'Add a word or phrase…';
    }

    function regionOptions(){return mode==='3'?REGION_LABELS_3:REGION_LABELS_2}

    function ensureSelectedRegion(){
      const valid=new Set(regionOptions().map(option=>option.value));
      if(!valid.has(selectedRegion))selectedRegion=1;
    }

    function renderRegionPicker(){
      ensureSelectedRegion();
      regionPicker.replaceChildren();
      regionOptions().forEach(option=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='venn-region-button';
        button.dataset.region=String(option.value);
        button.textContent=option.label;
        button.classList.toggle('is-active',option.value===selectedRegion);
        button.setAttribute('aria-pressed',String(option.value===selectedRegion));
        button.addEventListener('click',()=>{
          selectedRegion=option.value;
          renderRegionPicker();
          input.focus({preventScroll:true});
        });
        regionPicker.appendChild(button);
      });
    }

    function stageMetrics(){
      const width=Math.max(1,stage.clientWidth);
      const height=Math.max(1,stage.clientHeight);
      const usableHeight=Math.max(190,height-58);
      const scale=clamp(Math.min(width/650,usableHeight/390),.64,1.75);
      let circles;
      if(mode==='3'){
        const r=Math.min(width*.225,usableHeight*.285);
        circles={
          a:{x:width*.405,y:usableHeight*.405,r},
          b:{x:width*.595,y:usableHeight*.405,r},
          c:{x:width*.5,y:usableHeight*.595,r}
        };
      }else{
        const r=Math.min(width*.255,usableHeight*.34);
        circles={
          a:{x:width*.405,y:usableHeight*.49,r},
          b:{x:width*.595,y:usableHeight*.49,r},
          c:{x:width*.5,y:usableHeight*.62,r}
        };
      }
      return{width,height,usableHeight,scale,circles};
    }

    function setCircleGeometry(element,circle,visible=true){
      element.style.left=`${circle.x-circle.r}px`;
      element.style.top=`${circle.y-circle.r}px`;
      element.style.width=`${circle.r*2}px`;
      element.style.height=`${circle.r*2}px`;
      element.classList.toggle('is-hidden',!visible);
    }

    function setHeadingGeometry(element,x,y,visible=true){
      element.style.left=`${x}px`;
      element.style.top=`${y}px`;
      element.classList.toggle('is-hidden',!visible);
    }

    function applyVisualScale(metrics){
      const itemFont=clamp(13*metrics.scale,10,22);
      const itemPadX=clamp(13*metrics.scale,8,24);
      const itemPadY=clamp(7*metrics.scale,5,14);
      const headingFont=clamp(15*metrics.scale,11,25);
      stage.style.setProperty('--venn-item-font',`${itemFont}px`);
      stage.style.setProperty('--venn-item-pad-x',`${itemPadX}px`);
      stage.style.setProperty('--venn-item-pad-y',`${itemPadY}px`);
      stage.style.setProperty('--venn-heading-font',`${headingFont}px`);
      stage.style.setProperty('--venn-line-size',`${clamp(2*metrics.scale,1.4,3.2)}px`);
    }

    function applyDiagramGeometry(metrics){
      const {a,b,c}=metrics.circles;
      setCircleGeometry(circleA,a,true);
      setCircleGeometry(circleB,b,true);
      setCircleGeometry(circleC,c,mode==='3');
      setHeadingGeometry(headings.a,a.x-a.r*.34,a.y-a.r*.78,true);
      setHeadingGeometry(headings.b,b.x+b.r*.34,b.y-b.r*.78,true);
      setHeadingGeometry(headings.c,c.x,c.y+c.r*.76,mode==='3');
      applyVisualScale(metrics);
    }

    function regionAnchor(region,metrics){
      const {a,b,c}=metrics.circles;
      const mid=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
      if(mode==='2'){
        if(region===1)return{x:a.x-a.r*.36,y:a.y+a.r*.05};
        if(region===2)return{x:b.x+b.r*.36,y:b.y+b.r*.05};
        return{x:(a.x+b.x)/2,y:(a.y+b.y)/2+a.r*.09};
      }
      if(region===1)return{x:a.x-a.r*.3,y:a.y-a.r*.02};
      if(region===2)return{x:b.x+b.r*.3,y:b.y-b.r*.02};
      if(region===4)return{x:c.x,y:c.y+c.r*.34};
      if(region===3){const p=mid(a,b);return{x:p.x,y:p.y-a.r*.08}}
      if(region===5){const p=mid(a,c);return{x:p.x-a.r*.1,y:p.y+a.r*.1}}
      if(region===6){const p=mid(b,c);return{x:p.x+b.r*.1,y:p.y+b.r*.1}}
      return{x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3+a.r*.05};
    }

    function clusterPositions(count,anchor,metrics){
      if(!count)return[];
      const result=[];
      const spacingX=clamp(82*metrics.scale,55,130);
      const spacingY=clamp(38*metrics.scale,28,62);
      const cols=count<=2?1:count<=6?2:count<=12?3:4;
      const rows=Math.ceil(count/cols);
      for(let index=0;index<count;index++){
        const col=index%cols;
        const row=Math.floor(index/cols);
        const colsInRow=Math.min(cols,count-row*cols);
        const xOffset=(col-(colsInRow-1)/2)*spacingX;
        const yOffset=(row-(rows-1)/2)*spacingY;
        const stagger=(row%2&&colsInRow>1?spacingX*.14:0);
        result.push({
          x:clamp(anchor.x+xOffset+stagger,42,metrics.width-42),
          y:clamp(anchor.y+yOffset,42,metrics.usableHeight-28)
        });
      }
      return result;
    }

    function layoutItems(){
      layoutFrame=0;
      if(disposed||!m.isConnected)return;
      geometry=stageMetrics();
      applyDiagramGeometry(geometry);
      const groups=new Map();
      items.forEach(item=>{
        if(!groups.has(item.region))groups.set(item.region,[]);
        groups.get(item.region).push(item);
      });
      groups.forEach((group,region)=>{
        const positions=clusterPositions(group.length,regionAnchor(region,geometry),geometry);
        group.forEach((item,index)=>{
          const point=positions[index];
          if(!point||item.dragging)return;
          item.element.style.left=`${point.x}px`;
          item.element.style.top=`${point.y}px`;
        });
      });
    }

    function scheduleLayout(){
      cancelAnimationFrame(layoutFrame);
      layoutFrame=requestAnimationFrame(layoutItems);
    }

    function pointInCircle(point,circle){return Math.hypot(point.x-circle.x,point.y-circle.y)<=circle.r}

    function regionAtPoint(point){
      const metrics=geometry||stageMetrics();
      let region=0;
      if(pointInCircle(point,metrics.circles.a))region|=1;
      if(pointInCircle(point,metrics.circles.b))region|=2;
      if(mode==='3'&&pointInCircle(point,metrics.circles.c))region|=4;
      const valid=new Set(regionOptions().map(option=>option.value));
      if(valid.has(region))return region;
      let nearest=regionOptions()[0].value;
      let nearestDistance=Infinity;
      regionOptions().forEach(option=>{
        const anchor=regionAnchor(option.value,metrics);
        const distance=Math.hypot(point.x-anchor.x,point.y-anchor.y);
        if(distance<nearestDistance){nearestDistance=distance;nearest=option.value}
      });
      return nearest;
    }

    function pointerToStage(event){
      const rect=stage.getBoundingClientRect();
      const scaleX=rect.width?stage.clientWidth/rect.width:1;
      const scaleY=rect.height?stage.clientHeight/rect.height:1;
      return{
        x:clamp((event.clientX-rect.left)*scaleX,0,stage.clientWidth),
        y:clamp((event.clientY-rect.top)*scaleY,0,stage.clientHeight)
      };
    }

    function removeItem(item){
      if(!item||item.removing)return;
      item.removing=true;
      items=items.filter(candidate=>candidate!==item);
      item.element.classList.add('is-removing');
      updateClearState();
      changed('delete-item');
      scheduleLayout();
      setTimeout(()=>item.element.remove(),220);
    }

    function beginDrag(event,item){
      if(event.button!==0||item.removing)return;
      if(event.target.closest('.venn-item-delete'))return;
      if(event.target.closest('.module-text-edit-active'))return;
      const start=pointerToStage(event);
      const startLeft=parseFloat(item.element.style.left)||start.x;
      const startTop=parseFloat(item.element.style.top)||start.y;
      let moved=false;
      item.element.setPointerCapture?.(event.pointerId);

      const move=moveEvent=>{
        const point=pointerToStage(moveEvent);
        if(!moved&&Math.hypot(moveEvent.clientX-event.clientX,moveEvent.clientY-event.clientY)>4){
          moved=true;
          item.dragging=true;
          item.element.classList.add('is-dragging');
        }
        if(!moved)return;
        item.element.style.left=`${clamp(startLeft+(point.x-start.x),22,stage.clientWidth-22)}px`;
        item.element.style.top=`${clamp(startTop+(point.y-start.y),22,Math.max(22,(geometry||stageMetrics()).usableHeight-12))}px`;
      };

      const end=endEvent=>{
        item.element.removeEventListener('pointermove',move);
        item.element.removeEventListener('pointerup',end);
        item.element.removeEventListener('pointercancel',end);
        try{item.element.releasePointerCapture?.(event.pointerId)}catch{}
        if(!moved)return;
        const point=pointerToStage(endEvent);
        const nextRegion=regionAtPoint(point);
        item.dragging=false;
        item.element.classList.remove('is-dragging');
        if(item.region!==nextRegion){item.region=nextRegion;changed('move-item')}
        scheduleLayout();
      };

      item.element.addEventListener('pointermove',move);
      item.element.addEventListener('pointerup',end);
      item.element.addEventListener('pointercancel',end);
    }

    function createItem(data,{animate=false}={}){
      const text=clean(data?.text,ITEM_MAX);
      if(!text||items.length>=MAX_ITEMS)return null;
      const valid=new Set(regionOptions().map(option=>option.value));
      const item={
        id:clean(data?.id,48)||`venn-${Date.now().toString(36)}-${++serial}`,
        text,
        region:valid.has(Number(data?.region))?Number(data.region):selectedRegion,
        element:null,
        removing:false,
        dragging:false
      };

      const bubble=document.createElement('div');
      bubble.className='venn-item';
      bubble.dataset.vennId=item.id;
      bubble.setAttribute('role','group');
      bubble.setAttribute('aria-label',text);

      const label=document.createElement('span');
      label.className='venn-item-text';
      label.contentEditable='true';
      label.dataset.textEditMode='double';
      label.setAttribute('role','textbox');
      label.setAttribute('aria-label','Venn diagram item. Double-click to edit.');
      label.textContent=text;

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='venn-item-delete';
      remove.setAttribute('aria-label',`Delete ${text}`);
      remove.textContent='×';
      remove.addEventListener('click',event=>{event.stopPropagation();removeItem(item)});

      label.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();label.blur()}
      });
      label.addEventListener('blur',()=>{
        const next=clean(label.textContent,ITEM_MAX)||item.text;
        label.textContent=next;
        if(next!==item.text){
          item.text=next;
          bubble.setAttribute('aria-label',next);
          remove.setAttribute('aria-label',`Delete ${next}`);
          changed('edit-item');
          scheduleLayout();
        }
      });
      bubble.addEventListener('pointerdown',event=>beginDrag(event,item));

      bubble.append(label,remove);
      item.element=bubble;
      itemLayer.appendChild(bubble);
      items.push(item);

      if(animate){
        const metrics=geometry||stageMetrics();
        const anchor=regionAnchor(item.region,metrics);
        bubble.style.left=`${metrics.width/2}px`;
        bubble.style.top=`${Math.min(metrics.usableHeight*.55,anchor.y)}px`;
        bubble.classList.add('is-entering');
        requestAnimationFrame(()=>requestAnimationFrame(()=>bubble.classList.remove('is-entering')));
      }
      updateClearState();
      scheduleLayout();
      return item;
    }

    function clearItems({notify=true,animate=true}={}){
      const old=items;
      items=[];
      old.forEach(item=>{
        if(animate){
          item.element.classList.add('is-removing');
          setTimeout(()=>item.element.remove(),220);
        }else item.element.remove();
      });
      updateClearState();
      scheduleLayout();
      if(notify)changed('clear');
    }

    function mapRegionToTwo(region){
      if(region===1||region===2||region===3)return region;
      if(region===5)return 1;
      if(region===6)return 2;
      return 3;
    }

    function setMode(next,{notify=true}={}){
      next=next==='3'?'3':'2';
      if(next==='2'&&mode==='3')items.forEach(item=>{item.region=mapRegionToTwo(item.region)});
      mode=next;
      m.dataset.vennMode=mode;
      ensureSelectedRegion();
      renderRegionPicker();
      modeButtons.forEach(button=>{
        const active=button.dataset.vennMode===mode;
        button.classList.toggle('is-active',active);
        button.setAttribute('aria-pressed',String(active));
      });
      scheduleLayout();
      if(notify)changed('mode');
    }

    function commitHeading(key){
      const value=headingText(key);
      if(headings[key].textContent!==value)headings[key].textContent=value;
      changed(`heading-${key}`);
    }

    Object.entries(headings).forEach(([key,element])=>{
      element.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();element.blur()}
      });
      element.addEventListener('blur',()=>commitHeading(key));
    });

    form.addEventListener('submit',event=>{
      event.preventDefault();
      const text=clean(input.value,ITEM_MAX);
      if(!text||items.length>=MAX_ITEMS)return;
      createItem({text,region:selectedRegion},{animate:true});
      input.value='';
      changed('add-item');
      input.focus({preventScroll:true});
    });

    clearButton.addEventListener('click',()=>{
      if(!items.length)return;
      clearItems();
      clearButton.blur();
    });

    modeButtons.forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.vennMode)));

    const resizeObserver=new ResizeObserver(scheduleLayout);
    resizeObserver.observe(stage);

    m._boardGetState=()=>({
      mode,
      headings:{a:headingText('a'),b:headingText('b'),c:headingText('c')},
      selectedRegion,
      items:items.map(item=>({id:item.id,text:item.text,region:item.region}))
    });

    m._boardSetState=state=>{
      clearItems({notify:false,animate:false});
      mode=state?.mode==='3'?'3':'2';
      m.dataset.vennMode=mode;
      headings.a.textContent=clean(state?.headings?.a,HEADING_MAX)||'Set A';
      headings.b.textContent=clean(state?.headings?.b,HEADING_MAX)||'Set B';
      headings.c.textContent=clean(state?.headings?.c,HEADING_MAX)||'Set C';
      selectedRegion=Number(state?.selectedRegion)||1;
      ensureSelectedRegion();
      renderRegionPicker();
      modeButtons.forEach(button=>{
        const active=button.dataset.vennMode===mode;
        button.classList.toggle('is-active',active);
        button.setAttribute('aria-pressed',String(active));
      });
      const restored=normalizeItems(state?.items,mode);
      serial=restored.length;
      restored.forEach(item=>createItem(item,{animate:false}));
      updateClearState();
      scheduleLayout();
    };

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      disposed=true;
      cancelAnimationFrame(layoutFrame);
      resizeObserver.disconnect();
      priorCleanup?.();
    };

    renderRegionPicker();
    updateClearState();
    scheduleLayout();
  }

  window.TeacherTilesVennDiagrams=Object.freeze({setup,normalizeItems});
})();
