function setupProgressBarDrawers(m,{styles,colors,onStyle}){
 const color=m.querySelector('.progress-bar-color'),style=m.querySelector('.progress-bar-style'),controls=m.querySelector('.progress-bar-controls');
 const palette={blue:'#74b4f0',green:'#74c69d',amber:'#e9b44c',rose:'#ed8ba3',purple:'#ac8de3',aqua:'#65ccd1'};
 color.classList.remove('tile-appearance-original');color.removeAttribute('aria-hidden');color.tabIndex=0;
 color.innerHTML='<span class="progress-bar-color-dot"></span>';style.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M9 6v12M15 6v12"/></svg>';
 for(const [button,label]of [[style,'Bar Style'],[color,'Bar Color']]){button.hidden=false;button.classList.add('progress-bar-drawer-toggle');button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-expanded','false');controls.prepend(button);}
 const shelf=document.createElement('div');shelf.className='timer-shape-shelf progress-bar-choice-shelf';shelf.setAttribute('popover','manual');shelf.setAttribute('role','group');shelf.hidden=true;document.body.append(shelf);let anchor=null,frame=0;
 const close=()=>{cancelAnimationFrame(frame);if(shelf.matches(':popover-open'))shelf.hidePopover();shelf.hidden=true;[style,color].forEach(b=>b.setAttribute('aria-expanded','false'));m.classList.remove('has-bar-shelf-open');anchor=null;};
 const position=()=>{if(!m.isConnected)return close();const r=anchor.getBoundingClientRect();shelf.style.left=Math.max(8,Math.min(innerWidth-shelf.offsetWidth-8,r.left+r.width/2-shelf.offsetWidth/2))+'px';shelf.style.top=Math.max(8,Math.min(innerHeight-shelf.offsetHeight-8,r.top-shelf.offsetHeight-8))+'px';frame=requestAnimationFrame(position);};
 function open(button,isColor){if(anchor===button)return close();close();anchor=button;shelf.replaceChildren();shelf.setAttribute('aria-label',isColor?'Bar Color':'Bar Style');
  for(const item of isColor?colors.map(key=>({key,label:key[0].toUpperCase()+key.slice(1)})):styles){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',item.label);b.setAttribute('aria-pressed',String(m.dataset[isColor?'barColor':'barStyle']===item.key));const sample=document.createElement('span');sample.className=isColor?'bar-color-sample':'bar-style-sample';sample.dataset.style=item.key;sample.style.setProperty('--bar-sample-color',palette[isColor?item.key:m.dataset.barColor]||palette.blue);const label=document.createElement('span');label.textContent=item.label;b.append(sample,label);b.onclick=()=>{m.dataset[isColor?'barColor':'barStyle']=item.key;onStyle();notifyBoardChanged(isColor?'progress-bar-color':'progress-bar-style');close();button.focus({preventScroll:true});};shelf.append(b);}
  shelf.hidden=false;shelf.showPopover();button.setAttribute('aria-expanded','true');m.classList.add('has-bar-shelf-open');position();
 }
 style.onclick=()=>open(style,false);color.onclick=()=>open(color,true);
 const outside=e=>{if(!shelf.contains(e.target)&&!style.contains(e.target)&&!color.contains(e.target))close();};
 const escape=e=>{if(e.key==='Escape'&&anchor){const b=anchor;e.stopPropagation();close();b.focus({preventScroll:true});}};
 shelf.addEventListener('pointerdown',e=>e.stopPropagation());document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
 const cleanup=m._cleanup;m._cleanup=()=>{close();shelf.remove();document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);cleanup?.();};
}
