(()=>{'use strict';
function setup(m){
  const button=m.querySelector('.coinflip-coin'),label=m.querySelector('.coinflip-result');
  let result='heads',animation=null,running=false;
  function render(){button.dataset.side=result;label.textContent=result==='heads'?'Heads':'Tails';button.setAttribute('aria-label',`${label.textContent}. Flip coin`)}
  function flip(){
    if(running)return;
    result=(crypto.getRandomValues(new Uint32Array(1))[0]&1)?'tails':'heads';
    notifyBoardChanged('coin-flip');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){render();return}
    running=true;button.setAttribute('aria-busy','true');label.textContent='Flipping…';
    animation=button.animate([{transform:'translateY(0) rotateY(0deg)'},{transform:'translateY(-22px) rotateY(540deg)',offset:.45},{transform:'translateY(0) rotateY(1080deg)'}],{duration:850,easing:'cubic-bezier(.2,.65,.35,1)'});
    animation.onfinish=()=>{running=false;button.removeAttribute('aria-busy');render()};
  }
  button.addEventListener('click',flip);
  m._boardGetState=()=>({result});m._boardSetState=state=>{result=state?.result==='tails'?'tails':'heads';render()};
  const cleanup=m._cleanup;m._cleanup=()=>{animation?.cancel();cleanup?.()};
  const deactivate=m._deactivate;
  m._deactivate=()=>{deactivate?.();animation?.cancel();running=false;button.removeAttribute('aria-busy');render()};render();
}
window.TeacherTilesCoinFlip=Object.freeze({setup});})();
