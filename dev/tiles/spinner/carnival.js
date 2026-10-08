(()=>{
  const ns='http://www.w3.org/2000/svg';
  function create(m){
    const layer=document.createElement('div');layer.className='spinner-carnival-lights';layer.setAttribute('aria-hidden','true');
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 560 560');layer.append(svg);m.querySelector('.spinner-wheel-wrap').append(layer);
    let visible=false;
    const syncVisibility=()=>layer.classList.toggle('is-lit',visible&&!document.hidden);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncVisibility()});observer.observe(m);
    document.addEventListener('visibilitychange',syncVisibility);
    function setNames(count){
      svg.replaceChildren();if(!count)return;
      const arc=2*Math.PI/count,perSegment=Math.max(1,Math.floor(arc*249/30));
      const radius=Math.min(5.3,arc*249*.22);
      const circle=(parent,x,y,r,attributes)=>{const el=document.createElementNS(ns,'circle');for(const [key,value] of Object.entries({cx:x,cy:y,r,...attributes}))el.setAttribute(key,String(value));parent.append(el)};
      for(let segment=0;segment<count;segment++){
        const group=document.createElementNS(ns,'g');group.dataset.segment=String(segment);svg.append(group);
        for(let i=0;i<perSegment;i++){
          const angle=-Math.PI/2+arc*(segment+(i+.5)/perSegment),x=280+249*Math.cos(angle),y=280+249*Math.sin(angle);
          const bulb=document.createElementNS(ns,'g');bulb.style.setProperty('--bulb-delay',`${-((segment*perSegment+i)%8)*.3}s`);group.append(bulb);
          circle(bulb,x,y,radius*2.5,{class:'spinner-carnival-bulb-glow'});
          circle(bulb,x,y,radius+1.8,{fill:'#845229',stroke:'#ffe3a1','stroke-width':1});
          circle(bulb,x,y,radius,{fill:'#e8b75b'});
          circle(bulb,x,y,radius,{class:'spinner-carnival-bulb-light'});
          circle(bulb,x-radius*.25,y-radius*.3,radius*.28,{fill:'#fffdf0',opacity:.9});
        }
      }
    }
    return {setNames,rotate:rotation=>{svg.style.transform=`rotate(${rotation}rad)`},cleanup:()=>{observer.disconnect();document.removeEventListener('visibilitychange',syncVisibility);layer.remove()}};
  }
  window.TeacherTilesCarnivalSpinner={create};
})();
