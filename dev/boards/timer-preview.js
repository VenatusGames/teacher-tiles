const shapePaths={
  circle:'M50 4 A46 46 0 1 1 49.999 4 Z',
  triangle:'M50 5 L96 92 L4 92 Z',
  square:'M8 8 H92 V92 H8 Z',
  diamond:'M50 4 L96 50 L50 96 L4 50 Z',
  pentagon:'M50 4 L93.8 35.8 L77.1 87.2 H22.9 L6.2 35.8 Z',
  hexagon:'M25 6 H75 L96 50 L75 94 H25 L4 50 Z',
  star:'M50 4 L61.4 36.2 L95.5 36.9 L68.4 57.7 L78.2 90.4 L50 71 L21.8 90.4 L31.6 57.7 L4.5 36.9 L38.6 36.2 Z',
  heart:'M50 91 C42 82 10 63 7 35 C5 16 18 6 33 6 C42 6 48 11 50 18 C52 11 58 6 67 6 C82 6 95 16 93 35 C90 63 58 82 50 91 Z'
};
let serial=0;
export function renderTimerPreview(module,state){
 const progress=0,text='00:00',timer={total:0,left:0,progress:0,running:false};
 if(state.type==='timer'){
  const path=shapePaths[state.dataset?.timerShape||state.dataset?.shape]||shapePaths.circle,id='preview-timer-clip-'+(++serial);module.querySelectorAll('.shape-clip path,.shape-outline,.shape-highlight').forEach(n=>n.setAttribute('d',path));const clip=module.querySelector('.shape-clip');if(clip)clip.id=id;module.querySelector('.shape-foreign')?.setAttribute('clip-path','url(#'+id+')');const fill=module.querySelector('.shape-fill');fill?.style.setProperty('--progress',progress*360+'deg');module.style.setProperty('--timer-progress-ratio',String(progress));const visual=module.querySelector('.timer-visual');visual?.style.setProperty('--timer-visual-size',Math.max(50,Math.min(Number(state.transform?.width)||320,(Number(state.transform?.height)||240)-70)-25)+'px');
  if(state.dataset?.tileSkin==='timer-liquid'&&fill){const liquid=document.createElement('div');liquid.className='timer-liquid-fill';liquid.innerHTML='<svg class="timer-liquid-wave" viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M0 6 Q25 0 50 6 T100 6 T150 6 T200 6 V12 H0Z"/></svg>';fill.append(liquid);}
  module.querySelectorAll('.timer-remaining').forEach(n=>n.textContent=text);
 }else{
  const mode=state.special?.mode||state.dataset?.interactiveMode||'hourglass';module.dataset.interactiveMode=mode;for(const name of ['hourglass','candle','rocket','sunflower']){const stage=module.querySelector('.'+name+'-stage');if(stage)stage.hidden=name!==mode;}
  if(state.dataset?.tileSkin==='interactive-wonders'){
    module.querySelectorAll('.hourglass-stage,.candle-stage,.rocket-stage,.sunflower-stage').forEach(stage=>stage.hidden=true);
    const stage=document.createElement('div');stage.className='timer-story-stage wonder-stage';module.querySelector('.sunflower-stage').after(stage);
    const art=window.TeacherTilesTimerWonders.create(stage);art.setMode(['firework','ice','icecream','ants'].includes(mode)?mode:'firework');art.update(timer);art.destroy();
  }
  if(mode==='hourglass'){const canvas=module.querySelector('.hourglass-canvas');if(canvas){const art=window.TeacherTilesHourglass.create(canvas);art.update(timer);art.destroy();}}
  if(mode==='rocket'||mode==='sunflower'){const art=window.TeacherTilesGardenRocket.create(module.querySelector('.rocket-stage'),module.querySelector('.sunflower-stage'));art.setMode(mode);art.update(timer);art.destroy();}
  module.querySelector('.candle-scene')?.style.setProperty('--candle-height',Math.max(8,78-70*progress)+'%');module.querySelectorAll('.hourglass-countdown,.candle-countdown,.scene-countdown').forEach(n=>n.textContent=text);
 }
}
