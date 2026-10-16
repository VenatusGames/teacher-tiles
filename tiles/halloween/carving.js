(() => {
 'use strict';
 function setup(m){
  TeacherTilesHalloween.prepareCarving(m);
  const svg=m.querySelector('.carving-surface'),cuts=svg.querySelector('.carving-cuts'),preview=svg.querySelector('.carving-trace'),tool=m.querySelector('.carving-tool'),undo=m.querySelector('.carving-undo');
  let shapes=[],points=[],pointer=null;
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return [Math.max(18,Math.min(82,p.x)),Math.max(29,Math.min(86,p.y))]};
  const path=pts=>pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')+'Z';
  function geometry(a,b){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);if(tool.value==='triangle')return `M${x+w/2} ${y}L${x+w} ${y+h}L${x} ${y+h}Z`;if(tool.value==='circle')return `M${x} ${y+h/2}a${w/2} ${h/2} 0 1 0 ${w} 0a${w/2} ${h/2} 0 1 0 ${-w} 0Z`;return path(points);}
  function paint(){TeacherTilesHalloween.renderCuts(m,shapes);undo.disabled=!shapes.length;}
  const cancel=()=>{pointer=null;points=[];preview.setAttribute('d','')};
  svg.addEventListener('pointerdown',e=>{if(e.button!==0||!TeacherTilesHalloween.hasAccess())return;e.stopPropagation();e.preventDefault();pointer=e.pointerId;points=[point(e)];svg.setPointerCapture(pointer)});
  svg.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;e.stopPropagation();const p=point(e);if(points.length<600)points.push(p);preview.setAttribute('d',geometry(points[0],p))});
  svg.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;e.stopPropagation();const p=point(e),a=points[0];if(points.length>2&&Math.hypot(p[0]-a[0],p[1]-a[1])>.8||tool.value==='freehand'&&points.length>8){if(shapes.length<100){shapes.push(geometry(a,p));paint(true);const chip=document.createElementNS('http://www.w3.org/2000/svg','path');chip.setAttribute('d',shapes[shapes.length-1]);chip.classList.add('carving-chip');svg.append(chip);chip.addEventListener('animationend',()=>chip.remove(),{once:true});setTimeout(()=>chip.remove(),550);notifyBoardChanged('pumpkin-carving')}}cancel()});
  svg.addEventListener('pointercancel',cancel);svg.addEventListener('lostpointercapture',cancel);
  undo.onclick=()=>{shapes.pop();paint();notifyBoardChanged('pumpkin-carving')};
  m.querySelector('.carving-clear').onclick=()=>{shapes=[];paint();notifyBoardChanged('pumpkin-carving')};
  m.querySelector('.carving-light').onclick=e=>{const on=m.dataset.pumpkinLit!=='true';m.dataset.pumpkinLit=String(on);e.currentTarget.setAttribute('aria-pressed',String(on));notifyBoardChanged('pumpkin-light')};
  m._boardGetState=()=>({cuts:[...shapes]});m._boardSetState=s=>{shapes=(Array.isArray(s?.cuts)?s.cuts:[]).filter(d=>typeof d==='string'&&d.length<=24000&&/^[MLAZamlz0-9eE.,\s+-]+$/.test(d)).slice(0,100);paint();m.querySelector('.carving-light').setAttribute('aria-pressed',String(m.dataset.pumpkinLit==='true'))};
  const previousDeactivate=m._deactivate;m._deactivate=()=>{cancel();previousDeactivate?.()};paint();
 }
 window.TeacherTilesPumpkinCarving={setup};
})();
