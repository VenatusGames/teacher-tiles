(() => {
  'use strict';

  const MAX_NODES=60;
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
    const clearButton=m.querySelector('.wordweb-clear');
    const backgroundButton=m.querySelector('.tile-bg');
    const fontButton=m.querySelector('.tile-font');
    const textButton=m.querySelector('.tile-text');

    let nodes=[];
    let serial=0;
    let disposed=false;
    let resizeFrame=0;
    let connectorFollowFrame=0;
    let connectorFollowUntil=0;

    const changed=reason=>notifyBoardChanged(`word-web-${reason}`);
    const BACKGROUNDS=['white','cream','blue','pink','green','lavender','charcoal'];
    const FONTS=['inter','poppins','nunito','quicksand','oswald','lora','merriweather','playfair','caveat','phantom'];
    const TEXT_COLORS=['dark','soft','blue','rose','white'];

    function cycleStyle(key,values){
      const current=m.dataset[key]||values[0];
      const index=values.indexOf(current);
      m.dataset[key]=values[(index+1+values.length)%values.length];
      changed(`style-${key}`);
      if(key==='font')scheduleLayout();
    }

    function centerText(){
      return clean(center.textContent,CENTER_MAX)||'Main Idea';
    }

    function updateInputState(){
      input.disabled=nodes.length>=MAX_NODES;
      input.placeholder=nodes.length>=MAX_NODES?'Word web is full':'Add a connected word…';
      if(clearButton)clearButton.disabled=!nodes.length;
    }

    function getLayout(){
      const width=Math.max(1,stage.clientWidth);
      const height=Math.max(1,stage.clientHeight);
      const inputReserve=clamp(height*.15,48,78);
      const usableHeight=Math.max(170,height-inputReserve);
      const cx=width/2;
      const cy=clamp(usableHeight*.5,76,usableHeight-66);

      // Scale the visual language with the tile itself. As a web gets very dense,
      // connected bubbles gently compact so larger webs remain readable.
      const tileScale=clamp(Math.min(width/596,usableHeight/372),.66,1.8);
      const densityScale=clamp(1-Math.max(0,nodes.length-16)*.0095,.6,1);
      const nodeScale=tileScale*densityScale;
      const centerSize=clamp(144*tileScale,94,248);
      const nodeMinWidth=clamp(86*nodeScale,48,152);
      const nodeMaxWidth=clamp(154*nodeScale,76,270);
      const nodeMinHeight=clamp(46*nodeScale,28,82);
      const nodeFont=clamp(15*nodeScale,10,27);
      const nodePadX=clamp(17*nodeScale,8,30);
      const nodePadY=clamp(10*nodeScale,5,18);
      const centerFont=clamp(27*tileScale,17,46);
      const centerPad=clamp(18*tileScale,11,32);
      const lineSize=clamp(2*tileScale,1.4,3.4);

      stage.style.setProperty('--wordweb-center-size',`${centerSize}px`);
      stage.style.setProperty('--wordweb-center-font',`${centerFont}px`);
      stage.style.setProperty('--wordweb-center-pad',`${centerPad}px`);
      stage.style.setProperty('--wordweb-node-min-width',`${nodeMinWidth}px`);
      stage.style.setProperty('--wordweb-node-max-width',`${nodeMaxWidth}px`);
      stage.style.setProperty('--wordweb-node-min-height',`${nodeMinHeight}px`);
      stage.style.setProperty('--wordweb-node-font',`${nodeFont}px`);
      stage.style.setProperty('--wordweb-node-pad-x',`${nodePadX}px`);
      stage.style.setProperty('--wordweb-node-pad-y',`${nodePadY}px`);
      stage.style.setProperty('--wordweb-line-size',`${lineSize}px`);

      const outerRx=Math.max(58,width/2-nodeMaxWidth*.5-12);
      const outerRy=Math.max(48,usableHeight/2-nodeMinHeight*.58-13);
      const innerRx=Math.min(outerRx,centerSize*.5+nodeMaxWidth*.48+12);
      const innerRy=Math.min(outerRy,centerSize*.46+nodeMinHeight*.62+10);
      return{width,height,cx,cy,outerRx,outerRy,innerRx,innerRy,centerSize,nodeMinHeight,nodeMaxWidth};
    }

    function distributeAcrossRings(count,ringCount){
      const weights=Array.from({length:ringCount},(_,index)=>index+1);
      const weightTotal=weights.reduce((sum,value)=>sum+value,0);
      const counts=weights.map(weight=>Math.floor(count*weight/weightTotal));
      let assigned=counts.reduce((sum,value)=>sum+value,0);
      for(let index=ringCount-1;assigned<count;index=(index-1+ringCount)%ringCount){
        counts[index]+=1;
        assigned+=1;
      }
      return counts;
    }

    function positionsFor(count,layout){
      if(!count)return[];
      const result=[];
      const ringCount=count<=10?1:count<=22?2:count<=38?3:count<=52?4:5;
      const ringCounts=distributeAcrossRings(count,ringCount);
      let cursor=0;
      ringCounts.forEach((amount,ringIndex)=>{
        if(!amount)return;
        const t=ringCount===1?1:ringIndex/(ringCount-1);
        const rx=ringCount===1?layout.outerRx:layout.innerRx+(layout.outerRx-layout.innerRx)*t;
        const ry=ringCount===1?layout.outerRy:layout.innerRy+(layout.outerRy-layout.innerRy)*t;
        const phase=-Math.PI/2+(ringIndex%2?Math.PI/Math.max(2,amount):0)+(amount%2===0?Math.PI/Math.max(2,amount):0);
        for(let i=0;i<amount;i++){
          const angle=phase+(Math.PI*2*i/amount);
          result[cursor++]=xY(layout,rx,ry,angle);
        }
      });
      return result;
    }

    function xY(layout,rx,ry,angle){
      return{x:layout.cx+Math.cos(angle)*rx,y:layout.cy+Math.sin(angle)*ry};
    }

    function placeConnector(connector,origin,position){
      const dx=position.x-origin.x;
      const dy=position.y-origin.y;
      const distance=Math.hypot(dx,dy);
      connector.style.left=`${origin.x}px`;
      connector.style.top=`${origin.y}px`;
      connector.style.width=`${distance}px`;
      connector.style.setProperty('--wordweb-angle',`${Math.atan2(dy,dx)}rad`);
    }

    function elementCenterWithinStage(element,stageRect){
      const rect=element.getBoundingClientRect();
      // getBoundingClientRect() is in rendered/screen pixels, while connector
      // left/top/width are written in the stage's local CSS pixels. Convert the
      // rendered point back into local stage coordinates so board zoom and tile
      // scaling cannot pull the connector away from its bubble.
      const scaleX=stageRect.width>0?stage.clientWidth/stageRect.width:1;
      const scaleY=stageRect.height>0?stage.clientHeight/stageRect.height:1;
      return{
        x:(rect.left+rect.width/2-stageRect.left)*scaleX,
        y:(rect.top+rect.height/2-stageRect.top)*scaleY
      };
    }

    function syncConnectorsToRenderedBubbles(){
      if(disposed||!m.isConnected)return;
      const stageRect=stage.getBoundingClientRect();
      if(stageRect.width<=0||stageRect.height<=0)return;
      const origin=elementCenterWithinStage(center,stageRect);
      nodes.forEach(item=>{
        if(!item?.element?.isConnected||!item?.connector?.isConnected)return;
        placeConnector(item.connector,origin,elementCenterWithinStage(item.element,stageRect));
      });
    }

    function followConnectors(duration=760){
      cancelAnimationFrame(connectorFollowFrame);
      connectorFollowUntil=performance.now()+duration;
      const follow=now=>{
        connectorFollowFrame=0;
        if(disposed||!m.isConnected)return;
        syncConnectorsToRenderedBubbles();
        if(now<connectorFollowUntil)connectorFollowFrame=requestAnimationFrame(follow);
      };
      syncConnectorsToRenderedBubbles();
      connectorFollowFrame=requestAnimationFrame(follow);
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
      });
      followConnectors();
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
        bubble.style.left=`${layout.cx}px`;
        bubble.style.top=`${layout.cy}px`;
        connector.style.left=`${layout.cx}px`;
        connector.style.top=`${layout.cy}px`;
        connector.style.width='0px';
        connector.style.setProperty('--wordweb-angle','-1.5708rad');

        // The new bubble begins at the center. As it floats outward, the connector
        // follows its rendered center every frame, so the line literally grows out
        // from the center and remains attached throughout the entire reflow.
        void bubble.offsetWidth;
        requestAnimationFrame(()=>{
          bubble.classList.remove('is-entering');
          layoutWeb();
        });
      }
      return item;
    }

    function clearNodes(){
      for(const item of nodes){item.element.remove();item.connector.remove();}
      nodes=[];
      updateInputState();
    }

    function clearConnectedWords(){
      if(!nodes.length)return;
      const departing=nodes;
      nodes=[];
      input.value='';
      departing.forEach(item=>{
        item.removing=true;
        item.element.classList.add('is-removing');
        item.connector.classList.add('is-removing');
      });
      changed('clear');
      updateInputState();
      clearButton?.blur();
      setTimeout(()=>departing.forEach(item=>{item.element.remove();item.connector.remove();}),220);
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

    clearButton?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      clearConnectedWords();
    });

    backgroundButton?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      cycleStyle('bg',BACKGROUNDS);
    });
    fontButton?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      cycleStyle('font',FONTS);
    });
    textButton?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      cycleStyle('text',TEXT_COLORS);
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
      cancelAnimationFrame(connectorFollowFrame);
      resizeObserver.disconnect();
      priorCleanup?.();
    };

    updateInputState();
    scheduleLayout();
  }

  window.TeacherTilesWordWeb=Object.freeze({setup,normalizeNodes});
})();
