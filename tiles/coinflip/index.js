(()=>{'use strict';
function setup(m){
  const button=m.querySelector('.coinflip-coin'),label=m.querySelector('.coinflip-result');
  button.innerHTML='<span class="coinflip-body" aria-hidden="true"><span class="coinflip-face coinflip-heads"><svg viewBox="0 0 48 48"><use href="assets/ui/subscriber-crown.svg?v=20260926#crown"/></svg></span><span class="coinflip-face coinflip-tails"><img src="assets/shop/shop-logo.png" alt=""></span></span>';
  const body=button.querySelector('.coinflip-body');
  let result='heads',animation=null,running=false;
  function render(){button.dataset.side=result;body.style.transform=`rotateY(${result==='tails'?180:0}deg)`;label.textContent=result==='heads'?'Heads':'Tails';button.setAttribute('aria-label',`${label.textContent}. Flip coin`)}
  function flip(){
    if(running)return;
    const start=result==='tails'?180:0;
    result=(crypto.getRandomValues(new Uint32Array(1))[0]&1)?'tails':'heads';
    notifyBoardChanged('coin-flip');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){render();return}
    running=true;button.setAttribute('aria-busy','true');label.textContent='Flipping…';
    const end=1080+(result==='tails'?180:0);
    animation=body.animate([{transform:`translateY(0) rotateY(${start}deg)`},{transform:`translateY(-24px) rotateY(${start+(end-start)*.45}deg)`,offset:.45},{transform:`translateY(0) rotateY(${end}deg)`}],{duration:1050,easing:'cubic-bezier(.2,.65,.35,1)'});
    animation.onfinish=()=>{running=false;button.removeAttribute('aria-busy');render()};
  }
  button.addEventListener('click',flip);
  m._boardGetState=()=>({result});m._boardSetState=state=>{animation?.cancel();running=false;button.removeAttribute('aria-busy');result=state?.result==='tails'?'tails':'heads';render()};
  const cleanup=m._cleanup;m._cleanup=()=>{animation?.cancel();cleanup?.()};
  const deactivate=m._deactivate;
  m._deactivate=()=>{deactivate?.();animation?.cancel();running=false;button.removeAttribute('aria-busy');render()};render();
}
window.TeacherTilesCoinFlip=Object.freeze({setup});})();
