(() => {
  'use strict';
  const types=new Set(['halloweentimer','pumpkincarving','pumpkinpatch','trickortreat']);
  const faces={
    classic:{name:'Classic',d:'M25 38 37 23 43 40ZM57 40 64 23 76 38ZM46 55 50 48 54 55ZM24 55Q50 78 77 55L69 71 57 77 56 67 46 67 44 77 31 70Z'},
    happy:{name:'Happy',d:'M26 39Q32 20 40 39Q33 31 26 39ZM60 39Q67 20 74 39Q67 31 60 39ZM26 55Q50 66 75 55Q68 82 50 81Q32 80 26 55Z'},
    spooky:{name:'Spooky',d:'M23 29 44 39 29 44ZM77 29 56 39 71 44ZM46 56 50 47 54 56ZM24 64 32 58 40 66 48 58 56 66 64 58 77 64 67 79 60 72 52 81 44 72 36 79Z'},
    surprised:{name:'Surprised',d:'M27 35a8 11 0 1 0 16 0a8 11 0 1 0-16 0M57 35a8 11 0 1 0 16 0a8 11 0 1 0-16 0M39 65a11 15 0 1 0 22 0a11 15 0 1 0-22 0'},
    wink:{name:'Wink',d:'M25 34a8 10 0 1 0 16 0a8 10 0 1 0-16 0M57 35Q67 22 78 36L76 40Q66 32 58 40ZM25 56Q48 71 76 54Q64 80 44 75L44 65 36 62 36 70Z'},
    cat:{name:'Cat',d:'M24 32Q33 25 43 37Q31 45 24 32ZM57 37Q67 25 76 32Q69 45 57 37ZM44 47 56 47 50 53ZM28 57 45 60 50 55 55 60 73 57 64 66 54 67 50 62 46 67 35 66Z'}
  };
  const ghostFaces={
    classic:{name:'Boo',d:'M29 36a6 9 0 1 0 12 0a6 9 0 1 0-12 0M59 36a6 9 0 1 0 12 0a6 9 0 1 0-12 0M42 62a8 11 0 1 0 16 0a8 11 0 1 0-16 0'},
    happy:{name:'Friendly',d:'M27 39Q35 20 43 39L39 41Q35 32 31 41ZM57 39Q65 20 73 39L69 41Q65 32 61 41ZM33 55Q50 64 67 55Q63 75 50 75Q37 75 33 55Z'},
    spooky:{name:'Mischief',d:'M26 29 44 36Q40 49 31 43ZM74 29 56 36Q60 49 69 43ZM32 57Q50 68 68 57Q62 76 50 75Q38 74 32 57Z'},
    surprised:{name:'Surprised',d:'M27 35a8 10 0 1 0 16 0a8 10 0 1 0-16 0M57 35a8 10 0 1 0 16 0a8 10 0 1 0-16 0M40 63a10 13 0 1 0 20 0a10 13 0 1 0-20 0'},
    wink:{name:'Wink',d:'M29 36a6 9 0 1 0 12 0a6 9 0 1 0-12 0M57 36Q65 26 74 36L71 40Q65 34 60 40ZM34 56Q50 67 68 54Q61 77 46 72Q38 69 34 56Z'},
    cat:{name:'Sleepy',d:'M26 33Q35 43 44 33L43 39Q35 48 27 39ZM56 33Q65 43 74 33L73 39Q65 48 57 39ZM44 63a6 5 0 1 0 12 0a6 5 0 1 0-12 0'}
  };
  const ghostPath='M50 7C28 7 15 23 15 44C4 36 1 43 5 52Q8 59 16 63Q17 76 8 84Q7 93 28 88Q34 100 49 88Q60 100 71 87Q91 94 87 82Q83 73 85 63Q96 57 97 47Q97 37 85 44C85 23 72 7 50 7Z';
  const timerPath=m=>m.dataset.tileSkin==='halloweentimer-ghost'?ghostPath:pumpkinPath;
  const svg=(face='classic',ghost=false)=>{const options=ghost?ghostFaces:faces;return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${(options[face]||options.classic).d}"/></svg>`};
  const faceIcon=(face,ghost=false)=>svg(face,ghost).replace('0 0 100 100','18 20 64 64');
  const pumpkinPath='M46 20Q46 12 53 6L60 8Q52 14 53 21C68 12 91 22 94 49C98 76 83 94 67 92Q50 98 34 92C16 96 3 77 6 50C7 25 27 13 46 20Z';
  function timerFace(m,face){
    const visual=m.querySelector('.timer-visual');
    let art=visual.querySelector('.pumpkin-timer-face');
    if(!art){art=document.createElement('div');art.className='pumpkin-timer-face';visual.append(art);}
    art.innerHTML='<div class="pumpkin-face-faint">'+svg(face,m.dataset.tileSkin==='halloweentimer-ghost')+'</div><div class="pumpkin-face-filled">'+svg(face,m.dataset.tileSkin==='halloweentimer-ghost')+'</div>';
  }
  const hasAccess=()=>hasCosmeticSubscription()||(window.TeacherTilesAdminAccess?.developer===true&&window.TeacherTilesSandbox?.subscriptionEnabled===true);
  function requestAccess(){
    let dialog=document.querySelector('.halloween-subscription-dialog');
    if(dialog){dialog.showModal();return}
    dialog=document.createElement('dialog');dialog.className='halloween-subscription-dialog';
    dialog.innerHTML='<svg class="halloween-crown" viewBox="0 0 48 48" aria-hidden="true"><use href="assets/ui/subscriber-crown.svg#crown"/></svg><h2>Subscription Required</h2><p>You need a TeacherTiles subscription to use Halloween tiles.</p><div><button type="button" data-back>Back</button><button type="button" class="primary" data-subscribe>Subscribe</button></div>';
    dialog.setAttribute('aria-label','Halloween Tiles Subscription');document.body.append(dialog);
    dialog.querySelector('[data-back]').onclick=()=>dialog.close();
    dialog.querySelector('[data-subscribe]').onclick=()=>{dialog.close();window.TeacherTilesShop?.openMembership()};
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  function guard(m){
    let locked=false;
    const overlay=document.createElement('button');overlay.type='button';overlay.className='halloween-locked';overlay.innerHTML='<span>Subscription Required</span><small>Subscribe to use this Halloween tile</small>';overlay.onclick=requestAccess;m.append(overlay);
    function refresh(){const next=!hasAccess();overlay.hidden=!next;if(next&&!locked)m._deactivate?.();locked=next;for(const child of m.children)if(child!==overlay&&!child.matches('.module-delete,.module-drag-handle'))child.inert=next;}
    window.addEventListener('teachertiles:accountchange',refresh);window.addEventListener('teachertiles:shopownershipchange',refresh);refresh();
    const cleanup=m._cleanup;m._cleanup=()=>{window.removeEventListener('teachertiles:accountchange',refresh);window.removeEventListener('teachertiles:shopownershipchange',refresh);cleanup?.()};
  }
  let clipSequence=0;
  function prepareCarving(m){
    const surface=m.querySelector('.carving-surface');if(!surface)return;
    const id='pumpkin-carve-clip-'+(++clipSequence),ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),path=document.createElementNS(ns,'path');clip.id=id;
    path.setAttribute('d','M50 26C39 23 31 26 25 29C11 29 7 45 10 66C9 82 19 91 34 89C43 93 54 91 63 90C80 93 92 83 92 66C93 45 86 27 74 27C65 23 58 25 50 26Z');clip.append(path);defs.append(clip);surface.prepend(defs);
    const mask=document.createElementNS(ns,'mask');mask.id=id+'-holes';mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('x','0');mask.setAttribute('y','0');mask.setAttribute('width','100');mask.setAttribute('height','100');
    const white=document.createElementNS(ns,'rect');white.setAttribute('width','100');white.setAttribute('height','100');white.setAttribute('fill','white');const holes=document.createElementNS(ns,'g');holes.classList.add('carving-mask-holes');holes.setAttribute('fill','black');mask.append(white,holes);defs.append(mask);
    surface.querySelector('image').setAttribute('mask','url(#'+mask.id+')');
    const light=document.createElementNS(ns,'radialGradient');light.id=id+'-candle';light.setAttribute('cx','50%');light.setAttribute('cy','78%');light.setAttribute('r','85%');
    for(const [offset,color] of [['0%','#fff6c4'],['45%','#ffcf64'],['100%','#b65315']]){const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);light.append(stop);}if(!matchMedia('(prefers-reduced-motion: reduce)').matches){for(const [attribute,values,duration] of [['cx','50%;47%;52%;49%;54%;50%','3.7s'],['cy','78%;74%;80%;76%;78%','2.9s']]){const drift=document.createElementNS(ns,'animate');drift.setAttribute('attributeName',attribute);drift.setAttribute('values',values);drift.setAttribute('dur',duration);drift.setAttribute('repeatCount','indefinite');light.append(drift);}}defs.append(light);m.style.setProperty('--candle-fill','url(#'+light.id+')');
    const cavity=document.createElementNS(ns,'g');cavity.classList.add('carving-cavity');surface.insertBefore(cavity,surface.querySelector('image'));
    surface.querySelectorAll('.carving-cuts,.carving-trace').forEach(n=>n.setAttribute('clip-path','url(#'+id+')'));
  }
  function renderCuts(m,shapes){
    const ns='http://www.w3.org/2000/svg',holes=m.querySelector('.carving-mask-holes'),cuts=m.querySelector('.carving-cuts');holes.replaceChildren();cuts.replaceChildren();const cavity=m.querySelector('.carving-cavity');cavity.replaceChildren();
    for(const d of shapes){
      const hole=document.createElementNS(ns,'path');hole.setAttribute('d',d);holes.append(hole);cavity.append(hole.cloneNode());
      const group=document.createElementNS(ns,'g'),clip=document.createElementNS(ns,'clipPath'),id='carving-depth-'+(++clipSequence);clip.id=id;clip.append(hole.cloneNode());group.append(clip);
      const surface=document.createElementNS(ns,'g');surface.setAttribute('clip-path','url(#'+id+')');
      for(const [name,offset] of [['carving-cut-shadow','0 1.7'],['carving-cut-rim','0 -.65']]){const edge=document.createElementNS(ns,'path');edge.setAttribute('d',d);edge.setAttribute('transform','translate('+offset+')');edge.setAttribute('class',name);surface.append(edge);}
      group.append(surface);cuts.append(group);
    }
  }
  function preview(m,state,base=document.baseURI){
    if(state.type==='pumpkincarving'){prepareCarving(m);m.querySelector('.carving-surface image').setAttribute('href',new URL('tiles/halloween/assets/pumpkin-4.png',base).href);}
    if(state.type==='halloweentimer'){
      m.querySelectorAll('.shape-clip path,.shape-outline,.shape-highlight').forEach(p=>p.setAttribute('d',timerPath(m)));timerFace(m,state.dataset?.pumpkinFace);m.querySelector('.timer-visual').append(m.querySelector('.timer-readout'));
    }
    if(state.type==='pumpkincarving')renderCuts(m,(Array.isArray(state.special?.cuts)?state.special.cuts:[]).slice(0,100).filter(d=>typeof d==='string'&&d.length<=24000&&/^[MLAZamlz0-9eE.,\s+-]+$/.test(d)));
    if(state.type==='trickortreat')window.TeacherTilesTrickOrTreat?.preview(m,state.special);
    if(state.type==='pumpkinpatch')for(const p of (Array.isArray(state.special?.plants)?state.special.plants:[]).slice(0,24)){
      const bound=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number(v)||fallback));
      const el=document.createElement('div');el.className='patch-plant';el.style.cssText=`left:${bound(p.x,5,95,50)}%;top:${bound(p.y,35,92,60)}%;width:${bound(p.size,8,24,16)}%;--growth:${bound(p.growth,0,1,.1)}`;el.dataset.color=['green','yellow'].includes(p.color)?p.color:'orange';el.dataset.sprite=String(Math.round(bound(p.sprite,1,4,4)));
      const img=document.createElement('img');img.src=new URL('tiles/halloween/assets/pumpkin-'+Math.round(bound(p.sprite,1,4,4))+'.png',base).href;img.alt='Pumpkin';el.append(img);m.querySelector('.patch-pumpkins').append(el);
    }
  }
  window.TeacherTilesHalloween={types,faces,ghostFaces,svg,faceIcon,pumpkinPath,ghostPath,timerPath,timerFace,hasAccess,requestAccess,guard,preview,prepareCarving,renderCuts};
})();
