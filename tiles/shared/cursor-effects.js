(()=>{'use strict';
  let layer,swing,swingAnimation;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function stopSwing(){swingAnimation?.cancel();swingAnimation=null;swing?.remove();swing=null;document.documentElement.classList.remove('is-pickaxe-swinging')}
  function clear(){stopSwing();for(const node of layer?.children||[])for(const animation of node.getAnimations())animation.cancel();layer?.replaceChildren()}
  function swingPickaxe(event,id){
    stopSwing();
    swing=document.createElement('img');swing.className='pickaxe-click-swing';swing.alt='';
    swing.src=new URL(`assets/cursors/runtime/${id}-normal.png?v=20260928-unified`,document.baseURI).href;
    Object.assign(swing.style,{left:`${event.clientX-2}px`,top:`${event.clientY-18}px`});
    (document.fullscreenElement||document.body).append(swing);
    document.documentElement.classList.add('is-pickaxe-swinging');
    const animation=swing.animate([{transform:'rotate(0deg)'},{transform:'rotate(14deg)',offset:.35},{transform:'rotate(-5deg)',offset:.65},{transform:'rotate(0deg)'}],{duration:180,easing:'ease-out'});
    swingAnimation=animation;animation.finished.then(()=>{if(swingAnimation===animation)stopSwing()}).catch(()=>{});
  }
  document.addEventListener('pointermove',event=>{if(swing)Object.assign(swing.style,{left:`${event.clientX-2}px`,top:`${event.clientY-18}px`})},{passive:true});
  window.addEventListener('blur',clear);
  function burst(event,kind){
    const id=document.body.dataset.appCursor||'';
    if(!id.startsWith('pickaxe-')||reduced.matches||document.hidden||event.pointerType==='touch')return;
    swingPickaxe(event,id);
    if(!layer){layer=document.createElement('div');layer.className='cursor-particles';layer.setAttribute('aria-hidden','true');document.body.append(layer)}
    const color=window.TeacherTilesCursorPacks?.find(pack=>pack.id==='pickaxe')?.cursors.find(cursor=>cursor.id===id)?.color||'#efc35f';
    const count=kind==='double'?18:kind==='right'?12:kind==='middle'?6:8;
    while(layer.childElementCount+count>72){const oldest=layer.firstElementChild;for(const animation of oldest.getAnimations())animation.cancel();oldest.remove()}
    for(let i=0;i<count;i++){
      const spark=document.createElement('i');spark.className=`cursor-particle cursor-particle--${kind}`;
      const angle=kind==='left'?Math.PI+(i/(count-1))*Math.PI:2*Math.PI*i/count;
      const distance=(kind==='double'?42:kind==='right'?30:22)+Math.random()*14;
      const size=kind==='middle'?8:kind==='right'?3:3+Math.random()*3;
      Object.assign(spark.style,{left:`${event.clientX}px`,top:`${event.clientY}px`,width:`${size}px`,height:`${size}px`,color,background:kind==='middle'?'transparent':i%3===0?'#af8150':color});
      layer.append(spark);
      const animation=spark.animate([
        {transform:'translate(-50%,-50%) scale(.6)',opacity:1},
        {transform:`translate(calc(-50% + ${Math.cos(angle)*distance}px),calc(-50% + ${Math.sin(angle)*distance+(kind==='left'?18:0)}px)) rotate(${90+i*37}deg) scale(.2)`,opacity:0}
      ],{duration:kind==='double'?520:380,easing:'cubic-bezier(.1,.6,.3,1)'});
      animation.finished.catch(()=>{}).finally(()=>spark.remove());
    }
  }
  document.addEventListener('pointerdown',event=>{if(event.button<=2)burst(event,event.button===2?'right':event.button===1?'middle':'left')},{capture:true,passive:true});
  document.addEventListener('dblclick',event=>burst(event,'double'),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
  window.addEventListener('teachertiles:cursorchange',clear);
  reduced.addEventListener('change',clear);
})();
