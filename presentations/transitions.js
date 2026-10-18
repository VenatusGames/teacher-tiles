/* One animation renderer for editor playback, board players, and shop previews. */
(()=>{'use strict';
const definitions=window.TeacherTilesPresentationCatalog.transitions,active=new WeakMap();
const get=id=>definitions.find(t=>t.id===id)||definitions[0];
function cancel(host){active.get(host)?.();}
function animate(host,transition,draw,direction=1){
 cancel(host);const t=get(transition?.id);
 if(t.id==='none'||matchMedia('(prefers-reduced-motion: reduce)').matches||!host.childElementCount){draw();return;}
 const parent=host.parentElement,old=host.cloneNode(true);old.removeAttribute('id');old.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));old.setAttribute('aria-hidden','true');old.inert=true;
 Object.assign(old.style,{position:'absolute',left:host.offsetLeft+'px',top:host.offsetTop+'px',width:host.offsetWidth+'px',height:host.offsetHeight+'px',margin:'0',pointerEvents:'none',zIndex:'2',transform:'none'});
 old.classList.add('pres-transition-outgoing');draw();parent.append(old);
 const d=direction<0?-1:1,origin=host.style.transformOrigin,frames={
  fade:[{opacity:0},{opacity:1}],slide:[{transform:`translateX(${d*100}%)`},{transform:'none'}],push:[{transform:`translateX(${d*100}%)`},{transform:'none'}],
  wipe:[{clipPath:`inset(0 ${d>0?'100% 0 0':'0 0 100%'})`},{clipPath:'inset(0 0 0 0)'}],
  zoom:[{transform:'scale(.65)',opacity:0},{transform:'none',opacity:1}],flip:[{transform:`perspective(1200px) rotateY(${d*90}deg)`,opacity:0},{transform:'perspective(1200px) rotateY(0deg)',opacity:1}],
  iris:[{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(75% at 50% 50%)'}],curtain:[{clipPath:'inset(0 50% 0 50%)'},{clipPath:'inset(0 0 0 0)'}],
  diagonal:[{clipPath:'polygon(0 0,0 0,0 0)'},{clipPath:'polygon(0 0,200% 0,0 200%)'}],
  rise:[{transform:'translateY(100%)',opacity:.5},{transform:'none',opacity:1}],spin:[{transform:`scale(.3) rotate(${d*-90}deg)`,opacity:0},{transform:'none',opacity:1}],
  blur:[{filter:'blur(16px)',opacity:0},{filter:'blur(0px)',opacity:1}],bounce:[{transform:`translateX(${d*100}%)`,offset:0},{transform:`translateX(${d*-4}%)`,offset:.72},{transform:`translateX(${d*1.5}%)`,offset:.88},{transform:'none',offset:1}],
  fold:[{transform:'perspective(1200px) rotateY(-90deg)',opacity:.3},{transform:'perspective(1200px) rotateY(0deg)',opacity:1}]
 };
 // The outgoing slide stays below the incoming slide; both are clipped by the viewport.
 old.style.zIndex='0';const z=host.style.zIndex;host.style.zIndex='1';if(t.id==='fold')host.style.transformOrigin='left center';
 const options={duration:Math.max(250,Math.min(2000,Number(transition.duration)||650)),easing:'cubic-bezier(.22,.7,.2,1)',fill:'both'};
 const outgoing=old.animate(t.id==='push'?[{transform:'none'},{transform:`translateX(${-d*100}%)`}]:[{opacity:1},{opacity:t.id==='fade'||t.id==='blur'?0:1}],options);
 const incoming=host.animate(frames[t.id],options);
 const cleanup=()=>{outgoing.cancel();incoming.cancel();old.remove();host.style.zIndex=z;host.style.transformOrigin=origin;active.delete(host);};active.set(host,cleanup);incoming.finished.then(()=>{if(active.get(host)===cleanup)cleanup();},()=>{});
}
function preview(id){
 const box=document.createElement('div');box.className='pres-transition-preview';box.dataset.transitionPreview=id;box.setAttribute('aria-hidden','true');
 const stage=document.createElement('div');stage.className='pres-transition-preview-slide';box.append(stage);let alternate=false;
 const draw=()=>{stage.innerHTML='<span class="pres-transition-preview-dot"></span><i></i><i></i>';stage.style.background=alternate?'#e5ddf8':'#dcebf9';stage.style.color=alternate?'#9d85cb':'#7a9fc6';};draw();
 box.play=()=>{alternate=!alternate;animate(stage,{id,duration:850},draw);};return box;
}
window.TeacherTilesPresentationTransitions=Object.freeze({all:definitions,catalog:definitions.filter(t=>t.productId),get,animate,cancel,preview});
})();
