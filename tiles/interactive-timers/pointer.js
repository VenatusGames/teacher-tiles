(() => {
 'use strict';
 const modules=new Set();let x=-Infinity,y=-Infinity,keyboard=false;
 function update(){
   for(const m of modules){
     const r=m.getBoundingClientRect(),over=x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
     m.classList.toggle('is-pointer-over',over);
     m.classList.toggle('has-keyboard-focus',keyboard&&m.contains(document.activeElement));
     if(!over&&!keyboard){m.classList.remove('is-settings-open');const active=document.activeElement;if(m.contains(active)&&active?.tagName==='BUTTON')active.blur();}
   }
 }
 const move=e=>{x=e.clientX;y=e.clientY;update();};
 const down=e=>{keyboard=false;move(e);};
 const key=e=>{if(e.key==='Tab'){keyboard=true;requestAnimationFrame(update);}};
 const reset=()=>{x=y=-Infinity;update();};
 function listen(on){const action=on?'addEventListener':'removeEventListener';document[action]('pointermove',move);document[action]('pointerdown',down);document[action]('keydown',key);document[action]('focusin',update);document[action]('focusout',update);document[action]('fullscreenchange',reset);window[action]('blur',reset);window[action]('resize',reset);document.documentElement[action]('pointerleave',reset);}
 function attach(m){if(!modules.size)listen(true);modules.add(m);update();const prior=m._cleanup;m._cleanup=()=>{modules.delete(m);if(!modules.size)listen(false);prior?.();};}
 window.TeacherTilesTimerPointer=Object.freeze({attach});
})();
