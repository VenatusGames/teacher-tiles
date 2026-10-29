/* Only the hovered shop scene runs; drawer artwork is deliberately still. */
(()=>{
  const shop=document.getElementById('shop-modal'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const themes=new Set(['underwater-ocean','rainy-window','outer-space','frosted-window',
    ...TeacherTilesNatureScenes.themes,...TeacherTilesHalloweenScenes.themes,...TeacherTilesAutumnScenes.themes]);
  let current=null,frame=0,timer=0;
  function stop(){cancelAnimationFrame(frame);clearTimeout(timer);frame=timer=0;current?.canvas.remove();current=null;}
  function scene(host){
    const name=host.dataset.autumnScene||[...host.classList].find(c=>c.startsWith('animated-theme-shop--'))?.replace('animated-theme-shop--','');
    return name==='underwater'?'underwater-ocean':name;
  }
  function available(host){return host.isConnected&&!document.hidden&&!motion.matches&&!host.closest('[hidden]')&&shop.getAttribute('aria-hidden')!=='true'&&host.matches(':hover');}
  async function start(host){
    const theme=scene(host);if(!themes.has(theme)||!available(host))return;
    if(current?.host===host)return;stop();
    const canvas=document.createElement('canvas');canvas.className='shop-theme-preview-canvas';canvas.setAttribute('aria-hidden','true');
    const entry={host,canvas},renderer=TeacherTilesThemePreview.create(canvas);current=entry;
    await renderer.prepare(theme);if(current!==entry||!available(host)){if(current===entry)stop();return;}
    host.append(canvas);let last=0,time=0;
    const tick=now=>{
      if(current!==entry)return;
      if(!available(host)){stop();return;}
      if(host.closest('.is-browse-scrolling')){last=now;frame=requestAnimationFrame(tick);return;}
      if(!last||now-last>=33){time+=last?Math.min((now-last)/1000,.06):0;last=now;renderer.render(theme,host.clientWidth,host.clientHeight,time);}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
  }
  shop.addEventListener('pointerover',event=>{
    const host=event.target.closest('.shop-product__preview');
    if(!host||host.contains(event.relatedTarget)||!themes.has(scene(host)))return;
    stop();timer=setTimeout(()=>start(host),100);
  });
  shop.addEventListener('pointerout',event=>{
    const host=event.target.closest('.shop-product__preview');
    if(host&&!host.contains(event.relatedTarget))stop();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
  motion.addEventListener('change',stop);
  new MutationObserver(()=>{if(shop.hidden||shop.getAttribute('aria-hidden')==='true')stop()}).observe(shop,{attributes:true,attributeFilter:['hidden','aria-hidden']});
})();
