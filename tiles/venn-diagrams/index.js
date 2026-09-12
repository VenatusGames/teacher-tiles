(() => {
  'use strict';

  const MAX_ITEMS=48;
  const ITEM_MAX=72;
  const HEADING_MAX=40;
  const TITLE_MAX=60;
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
    const title=m.querySelector('.venn-title');
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

    function titleText(){return clean(title?.textContent,TITLE_MAX)||'Venn Diagram'}

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

    function membershipArea(bit){
      let area=0;
      items.forEach(item=>{
        if(!(item.region&bit)||!item.element)return;
        const width=Math.max(52,item.element.offsetWidth||72);
        const height=Math.max(28,item.element.offsetHeight||32);
        area+=(width+10)*(height+8);
      });
      return area;
    }

    function applyVisualScale(metrics){
      const density=clamp(1-Math.max(0,items.length-12)*.012,.7,1);
      const itemFont=clamp(13*metrics.scale*density,9.5,22);
      const itemPadX=clamp(13*metrics.scale*density,7,24);
      const itemPadY=clamp(7*metrics.scale*density,4.5,14);
      const headingFont=clamp(15*metrics.scale,11,25);
      const titleFont=clamp(19*metrics.scale,15,27);
      stage.style.setProperty('--venn-item-font',`${itemFont}px`);
      stage.style.setProperty('--venn-item-pad-x',`${itemPadX}px`);
      stage.style.setProperty('--venn-item-pad-y',`${itemPadY}px`);
      stage.style.setProperty('--venn-heading-font',`${headingFont}px`);
      m.style.setProperty('--venn-title-font',`${titleFont}px`);
      stage.style.setProperty('--venn-line-size',`${clamp(2*metrics.scale,1.4,3.2)}px`);
    }

    function stageMetrics(){
      const width=Math.max(1,stage.clientWidth);
      const height=Math.max(1,stage.clientHeight);
      const scale=clamp(Math.min(width/650,height/365),.62,1.75);
      const pre={width,height,scale};
      applyVisualScale(pre);

      const areaA=membershipArea(1);
      const areaB=membershipArea(2);
      const areaC=mode==='3'?membershipArea(4):0;
      const maxArea=Math.max(areaA,areaB,areaC,0);
      const areaNeed=Math.sqrt(maxArea/(Math.PI*.42))+28*scale;
      let circles;

      if(mode==='3'){
        const base=Math.min(width*.205,height*.285);
        const maxRadius=Math.max(base,Math.min((width-42)/3.18,(height-50)/3.02));
        const r=clamp(Math.max(base,areaNeed),base,maxRadius);
        const dx=r*.575;
        const dy=r*.48;
        const centerY=height*.505;
        circles={
          a:{x:width/2-dx,y:centerY-dy,r},
          b:{x:width/2+dx,y:centerY-dy,r},
          c:{x:width/2,y:centerY+dy*.94,r}
        };
      }else{
        const base=Math.min(width*.235,height*.34);
        const maxRadius=Math.max(base,Math.min((width-44)/3.22,(height-36)/2.08));
        const r=clamp(Math.max(base,areaNeed),base,maxRadius);
        const distance=r*1.23;
        circles={
          a:{x:width/2-distance/2,y:height*.52,r},
          b:{x:width/2+distance/2,y:height*.52,r},
          c:{x:width/2,y:height*.62,r}
        };
      }
      return{width,height,scale,circles};
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

    function applyDiagramGeometry(metrics){
      const {a,b,c}=metrics.circles;
      setCircleGeometry(circleA,a,true);
      setCircleGeometry(circleB,b,true);
      setCircleGeometry(circleC,c,mode==='3');
      const gap=clamp(17*metrics.scale,12,28);
      setHeadingGeometry(headings.a,a.x,a.y-a.r-gap,true);
      setHeadingGeometry(headings.b,b.x,b.y-b.r-gap,true);
      setHeadingGeometry(headings.c,c.x,c.y+c.r+gap,mode==='3');
      applyVisualScale(metrics);
    }

    function regionAnchor(region,metrics){
      const {a,b,c}=metrics.circles;
      const mid=(p,q)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});
      if(mode==='2'){
        if(region===1)return{x:a.x-a.r*.38,y:a.y+a.r*.03};
        if(region===2)return{x:b.x+b.r*.38,y:b.y+b.r*.03};
        return{x:(a.x+b.x)/2,y:(a.y+b.y)/2+a.r*.02};
      }
      if(region===1)return{x:a.x-a.r*.34,y:a.y-a.r*.06};
      if(region===2)return{x:b.x+b.r*.34,y:b.y-b.r*.06};
      if(region===4)return{x:c.x,y:c.y+c.r*.34};
      if(region===3){const p=mid(a,b);return{x:p.x,y:p.y-a.r*.18}}
      if(region===5){const p=mid(a,c);return{x:p.x-a.r*.13,y:p.y+a.r*.1}}
      if(region===6){const p=mid(b,c);return{x:p.x+b.r*.13,y:p.y+a.r*.1}}
      return{x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3+a.r*.04};
    }

    function exactRegionAtPoint(point,metrics){
      let region=0;
      const inside=circle=>Math.hypot(point.x-circle.x,point.y-circle.y)<=circle.r;
      if(inside(metrics.circles.a))region|=1;
      if(inside(metrics.circles.b))region|=2;
      if(mode==='3'&&inside(metrics.circles.c))region|=4;
      return region;
    }

    function candidatePoints(region,metrics){
      const anchor=regionAnchor(region,metrics);
      const step=clamp(12*metrics.scale,8,18);
      const points=[];
      for(let y=14;y<=metrics.height-14;y+=step){
        for(let x=14;x<=metrics.width-14;x+=step){
          const point={x,y};
          if(exactRegionAtPoint(point,metrics)!==region)continue;
          const distance=Math.hypot(x-anchor.x,y-anchor.y);
          points.push({x,y,score:distance+Math.abs(y-anchor.y)*.08});
        }
      }
      points.sort((a,b)=>a.score-b.score);
      return points;
    }

    function boxesOverlap(a,b,gap){
      return !(a.right+gap<=b.left||a.left>=b.right+gap||a.bottom+gap<=b.top||a.top>=b.bottom+gap);
    }

    function boxFor(point,item){
      const width=Math.max(44,item.element?.offsetWidth||72);
      const height=Math.max(26,item.element?.offsetHeight||32);
      return{
        left:point.x-width/2,
        right:point.x+width/2,
        top:point.y-height/2,
        bottom:point.y+height/2,
        width,
        height
      };
    }

    function pointFits(point,item,metrics,placed){
      const box=boxFor(point,item);
      const edge=6;
      if(box.left<edge||box.right>metrics.width-edge||box.top<edge||box.bottom>metrics.height-edge)return false;
      const gap=clamp(7*metrics.scale,5,12);
      return !placed.some(other=>boxesOverlap(box,other.box,gap));
    }

    function fallbackPoint(item,region,metrics,placed){
      const candidates=candidatePoints(region,metrics);
      let best=null;
      let bestPenalty=Infinity;
      candidates.forEach(point=>{
        const box=boxFor(point,item);
        if(box.left<4||box.right>metrics.width-4||box.top<4||box.bottom>metrics.height-4)return;
        let penalty=0;
        placed.forEach(other=>{
          const overlapX=Math.max(0,Math.min(box.right,other.box.right)-Math.max(box.left,other.box.left));
          const overlapY=Math.max(0,Math.min(box.bottom,other.box.bottom)-Math.max(box.top,other.box.top));
          penalty+=overlapX*overlapY;
        });
        if(penalty<bestPenalty){bestPenalty=penalty;best=point}
      });
      return best||regionAnchor(region,metrics);
    }

    function calculatePlacements(metrics){
      const placed=[];
      const groups=new Map();
      items.forEach(item=>{
        if(!groups.has(item.region))groups.set(item.region,[]);
        groups.get(item.region).push(item);
      });
      const regions=[...groups.keys()].sort((a,b)=>{
        const bits=n=>((n&1)?1:0)+((n&2)?1:0)+((n&4)?1:0);
        return bits(b)-bits(a)||(groups.get(b).length-groups.get(a).length);
      });
      const cache=new Map();
      regions.forEach(region=>{
        const candidates=cache.get(region)||candidatePoints(region,metrics);
        cache.set(region,candidates);
        groups.get(region).forEach(item=>{
          let point=candidates.find(candidate=>pointFits(candidate,item,metrics,placed));
          if(!point)point=fallbackPoint(item,region,metrics,placed);
          const box=boxFor(point,item);
          placed.push({item,point,box});
        });
      });
      return placed;
    }

    function layoutItems(){
      layoutFrame=0;
      if(disposed||!m.isConnected)return;
      geometry=stageMetrics();
      applyDiagramGeometry(geometry);
      const placements=calculatePlacements(geometry);
      placements.forEach(({item,point})=>{
        if(item.dragging)return;
        item.element.style.left=`${point.x}px`;
        item.element.style.top=`${point.y}px`;
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
      event.preventDefault();
      event.stopPropagation();
      const start=pointerToStage(event);
      const startLeft=parseFloat(item.element.style.left)||start.x;
      const startTop=parseFloat(item.element.style.top)||start.y;
      let moved=false;
      item.element.setPointerCapture?.(event.pointerId);

      const move=moveEvent=>{
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const point=pointerToStage(moveEvent);
        if(!moved&&Math.hypot(moveEvent.clientX-event.clientX,moveEvent.clientY-event.clientY)>4){
          moved=true;
          item.dragging=true;
          item.element.classList.add('is-dragging');
        }
        if(!moved)return;
        const halfW=Math.max(22,item.element.offsetWidth/2);
        const halfH=Math.max(16,item.element.offsetHeight/2);
        item.element.style.left=`${clamp(startLeft+(point.x-start.x),halfW+4,stage.clientWidth-halfW-4)}px`;
        item.element.style.top=`${clamp(startTop+(point.y-start.y),halfH+4,stage.clientHeight-halfH-4)}px`;
      };

      const end=endEvent=>{
        endEvent.preventDefault();
        endEvent.stopPropagation();
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
      remove.addEventListener('pointerdown',event=>event.stopPropagation());
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
        bubble.style.top=`${Math.min(metrics.height*.55,anchor.y)}px`;
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

    function commitTitle(){
      const value=titleText();
      if(title.textContent!==value)title.textContent=value;
      changed('title');
    }

    title.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();title.blur()}
    });
    title.addEventListener('blur',commitTitle);

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
      title:titleText(),
      mode,
      headings:{a:headingText('a'),b:headingText('b'),c:headingText('c')},
      selectedRegion,
      items:items.map(item=>({id:item.id,text:item.text,region:item.region}))
    });

    m._boardSetState=state=>{
      clearItems({notify:false,animate:false});
      title.textContent=clean(state?.title,TITLE_MAX)||'Venn Diagram';
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
