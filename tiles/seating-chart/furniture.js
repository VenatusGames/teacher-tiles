(() => {
  'use strict';
  const catalog={
    desk:{name:'Student Desk',fill:'#efd4a5',stroke:'#b29467',shape:'<rect x="3" y="3" width="94" height="58" rx="7"/>'},
    teacher:{name:'Teacher Desk',size:[19,11],fill:'#bcded1',stroke:'#719e8d',shape:'<rect x="3" y="3" width="94" height="58" rx="7"/><path d="M68 4v56M74 24h16M74 42h16" fill="none"/>'},
    large:{name:'Large Table',size:[26,15],fill:'#d3b995',stroke:'#a48a68',shape:'<rect x="3" y="3" width="94" height="58" rx="12"/>'},
    table:{name:'Round Table',size:[17,20],fill:'#c4dbef',stroke:'#87a9c7',shape:'<ellipse cx="50" cy="32" rx="47" ry="29"/>'},
    square:{name:'Square Table',size:[15,18],fill:'#ddd0ec',stroke:'#a898ba',shape:'<rect x="3" y="3" width="94" height="58" rx="8"/>'},
    crescent:{name:'Crescent Table',size:[26,20],fill:'#c4dbef',stroke:'#87a9c7',shape:'<path d="M10 7C-8 30 8 61 50 61S108 30 90 7Q83 0 76 7Q70 13 76 23C84 43 16 43 24 23Q30 13 24 7Q17 0 10 7Z"/>'},
    trapezoid:{name:'Trapezoid Table',size:[21,14],fill:'#ead0bd',stroke:'#ba9781',shape:'<path d="M27 3H73Q78 3 80 8L97 54Q99 61 92 61H8Q1 61 3 54L20 8Q22 3 27 3Z"/>'}
  };
  const art=kind=>{const item=catalog[kind]||catalog.desk;return `<svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true" fill="${item.fill}" stroke="${item.stroke}" stroke-width="2" stroke-linejoin="round">${item.shape}</svg>`};
  function bounds(item,size,room){
    const [w,h]=size,turned=item.angle%180!==0;
    const width=turned?h*room.height/room.width:w,height=turned?w*room.width/room.height:h;
    return {x:item.x+(w-width)/2,y:item.y+(h-height)/2,w:width,h:height};
  }
  function contain(item,size,room){
    const b=bounds(item,size,room);
    return {...item,x:item.x+Math.max(0,Math.min(100-b.w,b.x))-b.x,y:item.y+Math.max(10,Math.min(100-b.h,b.y))-b.y};
  }
  // Compare physical edges, including quarter turns and rectangular room sizes.
  function snap(item,others,sizeOf,room,disabled=false){
    let placed=contain(item,sizeOf(item.kind),room);if(disabled)return {item:placed,guides:[]};
    const b=bounds(placed,sizeOf(placed.kind),room),tx=9/room.width*100,ty=9/room.height*100;
    let bestX=null,bestY=null;
    const choose=(best,delta,at,threshold)=>Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta))?{delta,at}:best;
    for(const other of others){
      if(other.id===item.id)continue;
      const t=bounds(other,sizeOf(other.kind),room);
      if(b.y<=t.y+t.h+ty&&b.y+b.h>=t.y-ty){
        for(const [delta,at] of [[t.x-b.x-b.w,t.x],[t.x+t.w-b.x,t.x+t.w],[t.x-b.x,t.x],[t.x+t.w-b.x-b.w,t.x+t.w],[t.x+t.w/2-b.x-b.w/2,t.x+t.w/2]])bestX=choose(bestX,delta,at,tx);
      }
      if(b.x<=t.x+t.w+tx&&b.x+b.w>=t.x-tx){
        for(const [delta,at] of [[t.y-b.y-b.h,t.y],[t.y+t.h-b.y,t.y+t.h],[t.y-b.y,t.y],[t.y+t.h-b.y-b.h,t.y+t.h],[t.y+t.h/2-b.y-b.h/2,t.y+t.h/2]])bestY=choose(bestY,delta,at,ty);
      }
    }
    placed.x+=bestX?.delta||0;placed.y+=bestY?.delta||0;
    const safe=contain(placed,sizeOf(placed.kind),room),guides=[];
    if(bestX&&Math.abs(safe.x-placed.x)<.001)guides.push({axis:'x',at:bestX.at});
    if(bestY&&Math.abs(safe.y-placed.y)<.001)guides.push({axis:'y',at:bestY.at});
    return {item:safe,guides};
  }
  function drawer(m,{room,add,preview,clearPreview}){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='seating-furniture-toggle tile-action';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Furniture');toggle.title='Furniture';
    toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 9h18v5H3zM5 14v7m14-7v7M8 9V3h8v6"/></svg><span>Furniture</span>';
    m.querySelector('.pbis-footer-actions').prepend(toggle);
    const panel=document.createElement('aside');panel.className='seating-furniture-drawer';panel.hidden=true;panel.dataset.skipBoardSave='';panel.setAttribute('aria-label','Furniture');
    panel.innerHTML='<header><strong>Furniture</strong><button type="button" class="custom-icon seating-furniture-close" aria-label="Close Furniture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><p>Drag into your classroom, or click to add</p><div class="seating-furniture-list"></div><small>Edges snap together as you arrange. Hold Alt to move freely.</small>';
    m.append(panel);
    const life=new AbortController(),options={signal:life.signal};let cancel=null,suppressClick=false;
    function open(value){panel.hidden=!value;if(value)panel.querySelector('.seating-furniture-list').scrollTop=0;toggle.setAttribute('aria-expanded',String(value));m.classList.toggle('is-furniture-open',value)}
    toggle.addEventListener('click',()=>open(panel.hidden),options);
    panel.querySelector('.seating-furniture-close').addEventListener('click',()=>{open(false);toggle.focus({preventScroll:true})},options);
    panel.addEventListener('wheel',e=>e.stopPropagation(),{...options,passive:true});
    panel.addEventListener('pointerdown',e=>e.stopPropagation(),options);
    for(const [kind,item] of Object.entries(catalog)){
      const button=document.createElement('button');button.type='button';button.className='seating-furniture-option';button.dataset.kind=kind;button.innerHTML=art(kind)+`<span>${item.name}</span>`;
      panel.querySelector('.seating-furniture-list').append(button);
      button.addEventListener('click',e=>{if(suppressClick&&e.detail>0){suppressClick=false;return}suppressClick=false;open(false);const r=room.getBoundingClientRect();add(kind,{clientX:r.x+r.width/2,clientY:r.y+r.height/2,autoPlace:true});toggle.focus({preventScroll:true})},options);
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();cancel?.();suppressClick=false;
        const start={x:e.clientX,y:e.clientY},drag=new AbortController();let moved=false;
        button.setPointerCapture(e.pointerId);
        cancel=()=>{drag.abort();clearPreview();m.classList.remove('is-seating-dragging');cancel=null};
        document.addEventListener('pointermove',event=>{
          if(event.pointerId!==e.pointerId)return;
          if(!moved&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)return;
          moved=true;open(false);m.classList.add('is-seating-dragging');preview(kind,event);
        },{signal:drag.signal,capture:true});
        document.addEventListener('pointerup',event=>{
          if(event.pointerId!==e.pointerId)return;
          suppressClick=moved;if(moved)add(kind,event);cancel?.();
        },{signal:drag.signal,capture:true});
        document.addEventListener('pointercancel',()=>{suppressClick=true;cancel?.()},{signal:drag.signal,capture:true});
      },options);
    }
    document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!toggle.contains(e.target))open(false)},{...options,capture:true});
    m.addEventListener('keydown',e=>{if(e.key==='Escape'){cancel?.();open(false)}},options);
    return {close(){cancel?.();open(false)},cleanup(){cancel?.();life.abort();panel.remove();toggle.remove()}};
  }
  window.TeacherTilesSeatingFurniture=Object.freeze({catalog,art,bounds,contain,snap,drawer});
})();
