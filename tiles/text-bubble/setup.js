function setupTextBubble(m){
  const text=m.querySelector('.textbubble-text');m.querySelector('.textbubble-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));m.querySelector('.textbubble-font').addEventListener('click',()=>{cycleData(m,'font',FONT_OPTIONS);requestAnimationFrame(()=>text.dispatchEvent(new Event('input')))});m.querySelector('.textbubble-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));const cleanup=fitTextBubbleText(text,m);m._cleanup=cleanup
}

// Fit actual content in local layout coordinates, independent of board zoom and skin.
function fitTextBubbleText(text,m){
  let frame=0,disposed=false;
  const fit=()=>{
    frame=0;
    if(disposed||!m.isConnected||!text.clientWidth||!text.clientHeight)return;
    let low=8,high=800;
    for(let i=0;i<16;i++){
      const size=(low+high)/2;
      m.style.setProperty('--bubble-size',size+'px');
      if(text.scrollHeight<=text.clientHeight&&text.scrollWidth<=text.clientWidth)low=size;
      else high=size;
    }
    m.style.setProperty('--bubble-size',Math.max(8,low*.97)+'px');
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  const observer=new ResizeObserver(schedule);observer.observe(m);observer.observe(text);
  const contentObserver=new MutationObserver(schedule);contentObserver.observe(text,{childList:true,subtree:true,characterData:true,attributes:true});
  text.addEventListener('input',schedule);document.fonts?.addEventListener('loadingdone',schedule);schedule();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();contentObserver.disconnect();text.removeEventListener('input',schedule);document.fonts?.removeEventListener('loadingdone',schedule)};
}
