(() => {
  'use strict';

  const MAX_NODES=18;
  const CENTER_MAX=64;
  const NODE_MAX=72;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clean=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

  function normalizeNodes(items){
    if(!Array.isArray(items))return[];
    return items.slice(0,MAX_NODES).map((item,index)=>({
      id:clean(item?.id,48)||`restored-${index+1}`,
      text:clean(item?.text,NODE_MAX)
    })).filter(item=>item.text);
  }

  function setup(m){
    const stage=m.querySelector('.wordweb-stage');
    const center=m.querySelector('.wordweb-center');
    const nodeLayer=m.querySelector('.wordweb-nodes');
    const connectorLayer=m.querySelector('.wordweb-connectors');
    const form=m.querySelector('.wordweb-entry');
    const input=m.querySelector('.wordweb-input');

    let nodes=[];
    let serial=0;
    let disposed=false;
    let resizeFrame=0;

    const changed=reason=>notifyBoardChanged(`word-web-${reason}`);

    function centerText(){
      return clean(center.textContent,CENTER_MAX)||'Main Idea';
    }

    function updateInputState(){
      input.disabled=nodes.length>=MAX_NODES;
      input.placeholder=nodes.length>=MAX_NODES?'Word web is full':'Add a connected word…';
    }

    function getLayout(){
      const width=Math.max(1,stage.clientWidth);
      const height=Math.max(1,stage.clientHeight);
      const inputReserve=clamp(height*.17,54,72);
      const usableHeight=Math.max(170,height-inputReserve);
      const cx=width/2;
      const cy=clamp(usableHeight*.52,88,usableHeight-78);
      const outerRx=Math.max(108,Math.min(width*.38,width/2-72));
      const outerRy=Math.max(72,Math.min(usableHeight*.37,usableHeight/2-58));
      const innerRx=Math.max(88,outerRx*.58);
      const innerRy=Math.max(60,outerRy*.57);
      return{width,height,cx,cy,outerRx,outerRy,innerRx,innerRy};
    }

    function positionsFor(count,layout){
      if(!count)return[];
      const result=[];
      const makeRing=(amount,startIndex,rx,ry,phase)=>{
        for(let i=0;i<amount;i++){
          const angle=phase+(Math.PI*2*i/amount);
          result[startIndex+i]={
            x:layout.cx+Math.cos(angle)*rx,
            y:layout.cy+Math.sin(angle)*ry
          };
        }
      };
      if(count<=10){
        const phase=-Math.PI/2+(count%2===0?Math.PI/count:0);
        makeRing(count,0,layout.outerRx,layout.outerRy,phase);
      }else{
        const outerCount=Math.ceil(count*.62);
        const innerCount=count-outerCount;
        makeRing(outerCount,0,layout.outerRx,layout.outerRy,-Math.PI/2+(outerCount%2===0?Math.PI/outerCount:0));
        makeRing(innerCount,outerCount,layout.innerRx,layout.innerRy,-Math.PI/2+Math.PI/Math.max(2,innerCount));
      }
      return result;
    }

    function placeConnector(connector,layout,position){
      const dx=position.x-layout.cx;
      const dy=position.y-layout.cy;
      const distance=Math.hypot(dx,dy);
      connector.style.left=`${layout.cx}px`;
      connector.style.top=`${layout.cy}px`;
      connector.style.width=`${distance}px`;
      connector.style.transform=`translateY(-50%) rotate(${Math.atan2(dy,dx)}rad)`;
    }

    function layoutWeb(){
      resizeFrame=0;
      if(disposed||!m.isConnected)return;
      const layout=getLayout();
      const positions=positionsFor(nodes.length,layout);
      center.style.left=`${layout.cx}px`;
      center.style.top=`${layout.cy}px`;
      nodes.forEach((item,index)=>{
        const position=positions[index];
        if(!position)return;
        item.element.style.left=`${position.x}px`;
        item.element.style.top=`${position.y}px`;
        placeConnector(item.connector,layout,position);
      });
    }

    function scheduleLayout(){
      cancelAnimationFrame(resizeFrame);
      resizeFrame=requestAnimationFrame(layoutWeb);
    }

    function removeNode(item){
      if(!item||item.removing)return;
      item.removing=true;
      nodes=nodes.filter(candidate=>candidate!==item);
      item.element.classList.add('is-removing');
      item.connector.classList.add('is-removing');
      changed('delete');
      updateInputState();
      scheduleLayout();
      setTimeout(()=>{
        item.element.remove();
        item.connector.remove();
      },220);
    }

    function createNode(data,{animate=false}={}){
      const item={id:data.id||`word-${Date.now().toString(36)}-${++serial}`,text:clean(data.text,NODE_MAX),element:null,connector:null,removing:false};
      if(!item.text)return null;

      const connector=document.createElement('div');
      connector.className='wordweb-connector';
      connector.setAttribute('aria-hidden','true');

      const bubble=document.createElement('div');
      bubble.className='wordweb-node';
      bubble.dataset.tone=String(nodes.length%6);
      bubble.dataset.wordwebId=item.id;
      bubble.setAttribute('role','group');
      bubble.setAttribute('aria-label',item.text);

      const label=document.createElement('span');
      label.className='wordweb-node-text';
      label.textContent=item.text;

      const remove=document.createElement('button');
      remove.type='button';
      remove.className='wordweb-node-delete';
      remove.textContent='×';
      remove.setAttribute('aria-label',`Delete ${item.text}`);
      remove.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        removeNode(item);
      });

      bubble.append(label,remove);
      item.element=bubble;
      item.connector=connector;
      connectorLayer.append(connector);
      nodeLayer.append(bubble);
      nodes.push(item);

      if(animate){
        const layout=getLayout();
        bubble.classList.add('is-entering');
        connector.classList.add('is-entering');
        bubble.style.left=`${layout.cx}px`;
        bubble.style.top=`${layout.cy}px`;
        connector.style.left=`${layout.cx}px`;
        connector.style.top=`${layout.cy}px`;
        connector.style.width='0px';
        connector.style.transform='translateY(-50%) rotate(-90deg)';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          bubble.classList.remove('is-entering');
          connector.classList.remove('is-entering');
          layoutWeb();
        }));
      }
      return item;
    }

    function clearNodes(){
      for(const item of nodes){item.element.remove();item.connector.remove();}
      nodes=[];
    }

    function addFromInput(){
      const text=clean(input.value,NODE_MAX);
      if(!text||nodes.length>=MAX_NODES){
        if(!text)input.focus({preventScroll:true});
        return;
      }
      createNode({text},{animate:true});
      input.value='';
      updateInputState();
      changed('add');
      input.focus({preventScroll:true});
    }

    form.addEventListener('submit',event=>{
      event.preventDefault();
      addFromInput();
    });

    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        input.value='';
        input.blur();
        event.stopPropagation();
      }
    });

    center.addEventListener('input',()=>{
      const raw=String(center.textContent??'');
      if(raw.length>CENTER_MAX){
        center.textContent=raw.slice(0,CENTER_MAX);
        const selection=getSelection();
        if(selection){
          const range=document.createRange();
          range.selectNodeContents(center);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      changed('center');
    });

    center.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        center.blur();
      }
    });

    center.addEventListener('blur',()=>{
      const text=centerText();
      if(center.textContent!==text)center.textContent=text;
      changed('center');
    });

    const resizeObserver=new ResizeObserver(scheduleLayout);
    resizeObserver.observe(stage);

    m._boardGetState=()=>({
      center:centerText(),
      nodes:nodes.map(item=>({id:item.id,text:item.text}))
    });

    m._boardSetState=state=>{
      clearNodes();
      center.textContent=clean(state?.center,CENTER_MAX)||'Main Idea';
      const restored=normalizeNodes(state?.nodes);
      serial=restored.length;
      restored.forEach(item=>createNode(item,{animate:false}));
      updateInputState();
      scheduleLayout();
    };

    const priorCleanup=m._cleanup;
    m._cleanup=()=>{
      disposed=true;
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      priorCleanup?.();
    };

    updateInputState();
    scheduleLayout();
  }

  window.TeacherTilesWordWeb=Object.freeze({setup,normalizeNodes});
})();
