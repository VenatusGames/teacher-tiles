(() => {
  'use strict';
  const limit=999,values=[1,10,100];
  function art(value){
    const columns=value===1?1:10,rows=value===100?10:1,w=columns*14,h=rows*14,d=6;
    let grid='';for(let x=14;x<w;x+=14)grid+=`M${x} 6v${h}`;
    for(let y=14;y<h;y+=14)grid+=`M0 ${y+6}h${w}`;
    const top=Array.from({length:columns-1},(_,i)=>`M${(i+1)*14} 6l6-6`).join('');
    const side=Array.from({length:rows-1},(_,i)=>`M${w} ${(i+1)*14+6}l6-6`).join('');
    return `<svg viewBox="-1 -1 ${w+d+2} ${h+d+2}" role="img" aria-label="${value===1?'One cube':value===10?'Ten stick':'Hundred block'}"><path d="M0 6 6 0h${w}l-6 6Z" fill="#35c8e8"/><path d="M${w} 6l6-6v${h}l-6 6Z" fill="#0787b0"/><path d="M0 6h${w}v${h}H0Z" fill="#10afd6"/><path d="${grid}" stroke="#078eb9" stroke-width=".8"/><path d="${top}${side}" stroke="#128faf" stroke-width=".65"/><path d="M.7 7h${w-1}M.7 7v${h-1}" fill="none" stroke="#8aeeff" stroke-opacity=".7"/><path d="M0 6 6 0h${w}v${h}l-6 6H0Z" fill="none" stroke="#067fa5" stroke-width=".65"/></svg>`;
  }
  const dimensions=(value,scale=1)=>({w:(value===1?22:148)*scale,h:(value===100?148:22)*scale});
  function normalize(raw){return {pieces:(Array.isArray(raw?.pieces)?raw.pieces:[]).slice(0,120).filter(p=>p&&values.includes(Number(p.value))).map((p,i)=>({id:i+1,value:Number(p.value),scale:p.scale===.7?.7:1,x:Math.max(0,Math.min(640-dimensions(Number(p.value),p.scale===.7?.7:1).w,Number(p.x)||0)),y:Math.max(0,Math.min(340-dimensions(Number(p.value),p.scale===.7?.7:1).h,Number(p.y)||0))}))}}
  function render(m,state){
    const area=m.querySelector('.tens-workspace');area.replaceChildren();
    const pieces=normalize(state).pieces;
    for(const p of pieces){const el=document.createElement('button'),size=dimensions(p.value,p.scale);el.type='button';el.className='tens-piece';el.dataset.piece=p.id;el.style.cssText=`left:${p.x}px;top:${p.y}px;width:${size.w}px;height:${size.h}px`;el.setAttribute('aria-label',`${p.value} block. Drag to move; arrow keys to adjust; Delete to remove.`);el.innerHTML=art(p.value);area.append(el)}
    m.querySelector('.tens-total').textContent=pieces.reduce((n,p)=>n+p.value,0).toLocaleString();
    m.querySelector('.tens-empty').hidden=pieces.length>0;
  }
  function setupBlock(m){
    let value=values.includes(Number(m.dataset.blockValue))?Number(m.dataset.blockValue):1;
    m.dataset.blockValue=value;m.querySelector('.tens-block-art').innerHTML=art(value);
    m._boardGetState=()=>({value});m._boardSetState=s=>{if(values.includes(Number(s?.value))){value=Number(s.value);m.dataset.blockValue=s.value;m.querySelector('.tens-block-art').innerHTML=art(Number(s.value))}};
  }
  function setup(m){
    let pieces=[],nextId=0,selected=0,drag=null;
    const stage=m.querySelector('.tens-stage'),area=m.querySelector('.tens-workspace'),form=m.querySelector('.tens-number-form'),input=form.elements.number;
    const notify=()=>notifyBoardChanged('tens-sticks');
    function fit(){const scale=Math.min(stage.clientWidth/640,stage.clientHeight/340);area.style.transform=`translate(-50%,-50%) scale(${scale})`;}
    const point=e=>{const r=area.getBoundingClientRect();return {x:(e.clientX-r.left)*640/r.width,y:(e.clientY-r.top)*340/r.height}};
    const clampPiece=p=>{const size=dimensions(p.value,p.scale);p.x=Math.max(0,Math.min(640-size.w,p.x));p.y=Math.max(0,Math.min(340-size.h,p.y))};
    function refresh(){render(m,{pieces});m.querySelector('.tens-remove').disabled=!pieces.some(p=>p.id===selected);area.querySelectorAll('.tens-piece').forEach((el,i)=>{el.dataset.piece=pieces[i].id;el.classList.toggle('is-selected',pieces[i].id===selected)});fit()}
    function add(value){if(pieces.length>=120)return;const p={id:++nextId,value,x:18+(pieces.length%4)*156,y:18+(Math.floor(pieces.length/4)%2)*162};clampPiece(p);pieces.push(p);selected=p.id;refresh();notify()}
    m.querySelectorAll('[data-tens-add]').forEach(button=>{button.innerHTML=art(Number(button.dataset.tensAdd))+`<span>${button.dataset.tensAdd}</span>`;button.addEventListener('click',()=>add(Number(button.dataset.tensAdd)))});
    form.addEventListener('submit',e=>{
      e.preventDefault();if(!form.reportValidity())return;const number=Number(input.value);if(!Number.isInteger(number)||number<0||number>limit)return;
      pieces=[];selected=0;let remainder=number;const scale=number>=500?.7:1,cols=scale===1?4:5;
      // Hundreds occupy two tidy rows; rods and units have their own lanes.
      for(const value of [100,10,1]){const count=Math.floor(remainder/value);remainder%=value;for(let i=0;i<count;i++){
        const x=value===100?12+(i%cols)*(scale===1?156:120):value===10?12+(i%3)*160:508+(i%4)*28;
        const y=value===100?10+Math.floor(i/cols)*112:value===10?246+Math.floor(i/3)*28:246+Math.floor(i/4)*28;
        pieces.push({id:++nextId,value,scale,x,y});
      }}
      refresh();notify();input.blur();
    });
    const remove=()=>{if(!selected)return;pieces=pieces.filter(p=>p.id!==selected);selected=0;refresh();notify()};
    m.querySelector('.tens-remove').addEventListener('click',remove);
    m.querySelector('.tens-clear').addEventListener('click',()=>{pieces=[];selected=0;refresh();notify()});
    area.addEventListener('pointerdown',e=>{
      const el=e.target.closest('.tens-piece');if(!el||e.button!==0)return;e.preventDefault();e.stopPropagation();
      const p=pieces.find(p=>p.id===Number(el.dataset.piece));selected=p.id;m.querySelector('.tens-remove').disabled=false;area.querySelectorAll('.tens-piece').forEach(n=>n.classList.toggle('is-selected',n===el));
      const at=point(e);drag={p,el,dx:at.x-p.x,dy:at.y-p.y,moved:false};area.setPointerCapture(e.pointerId);el.focus({preventScroll:true});
    });
    area.addEventListener('pointermove',e=>{if(!drag)return;e.stopPropagation();const at=point(e);drag.p.x=at.x-drag.dx;drag.p.y=at.y-drag.dy;drag.moved=true;drag.el.style.left=drag.p.x+'px';drag.el.style.top=drag.p.y+'px'});
    function stop(e){if(!drag)return;const current=drag;drag=null;try{area.releasePointerCapture(e.pointerId)}catch{}
      const r=stage.getBoundingClientRect(),outside=e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;
      if(e.type!=='pointercancel'&&current.moved&&outside){
        const pos=screenToBoard(e.clientX,e.clientY),tile=createModule('tensblock',pos.x,pos.y,{record:false,boardState:{dataset:{blockValue:String(current.p.value)}}});
        if(tile){pieces=pieces.filter(p=>p.id!==current.p.id);recordHistory({type:'add',elements:[tile]});}
      }else clampPiece(current.p);
      refresh();notify();
    }
    area.addEventListener('pointerup',stop);area.addEventListener('pointercancel',stop);
    area.addEventListener('keydown',e=>{const el=e.target.closest('.tens-piece'),p=pieces.find(p=>p.id===Number(el?.dataset.piece));if(!p)return;selected=p.id;
      if(['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();remove();return}
      const delta={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}[e.key];if(!delta)return;e.preventDefault();e.stopPropagation();p.x+=delta[0];p.y+=delta[1];clampPiece(p);el.style.left=p.x+'px';el.style.top=p.y+'px';notify();
    });
    m.querySelectorAll('.tile-bg,.tile-font,.tile-text').forEach(b=>b.addEventListener('click',()=>{if(b.classList.contains('tile-bg'))cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']);else if(b.classList.contains('tile-font'))cycleData(m,'font',FONT_OPTIONS);else cycleData(m,'text',['dark','soft','blue','rose','white','cream'])}));
    const ro=new ResizeObserver(fit);ro.observe(stage);
    m._boardGetState=()=>({pieces:pieces.map(p=>({...p}))});m._boardSetState=s=>{pieces=normalize(s).pieces;pieces.forEach(clampPiece);nextId=pieces.length;refresh()};
    const cleanup=m._cleanup;m._cleanup=()=>{ro.disconnect();drag=null;cleanup?.()};refresh();
  }
  window.TeacherTilesTensSticks={setup,setupBlock,render,art};
})();
