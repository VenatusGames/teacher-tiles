/* Rocket and sunflower visuals share the existing timer's time and persistence. */
(() => {
  'use strict';
  let serial=0;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
  function growth(progress,total=300) {
    const elapsed=clamp(progress)*total, dropDuration=Math.min(1.1,total*.08);
    const seed=clamp(elapsed/dropDuration);
    const p=clamp((elapsed-dropDuration)/Math.max(.01,total-dropDuration));
    return {seed,stem:ease(p/.72),leaves:ease((p-.12)/.53),bud:ease((p-.53)/.2),bloom:ease((p-.73)/.27),
      label:seed<1?'Planting the seed':p<.13?'Germination':p<.35?'First leaves':p<.63?'Growing tall':p<.8?'A flower bud':p<1?'Opening toward the sun':'In full bloom'};
  }
  function create(rocketStage,plantStage) {
    const id=`tt-scene-${++serial}`;
    rocketStage.innerHTML=`<div class="scene-countdown">05:00</div><svg class="timer-story-svg rocket-scene" viewBox="0 0 320 380" role="img" aria-label="Rocket with a burning fuse">
      <defs>
        <linearGradient id="${id}-body"><stop stop-color="#a7c5ce"/><stop offset=".26" stop-color="#fcffff"/><stop offset=".6" stop-color="#e6f2f1"/><stop offset="1" stop-color="#86a7b5"/></linearGradient>
        <linearGradient id="${id}-red"><stop stop-color="#9f2c3d"/><stop offset=".42" stop-color="#f47467"/><stop offset="1" stop-color="#c33a48"/></linearGradient>
        <radialGradient id="${id}-window" cx=".35" cy=".25"><stop stop-color="#bdf9ff"/><stop offset=".45" stop-color="#439bc3"/><stop offset="1" stop-color="#173e69"/></radialGradient>
        <linearGradient id="${id}-flame" x2="0" y2="1"><stop stop-color="#fffad5"/><stop offset=".4" stop-color="#ffca5b"/><stop offset="1" stop-color="#f06e43" stop-opacity="0"/></linearGradient>
      </defs>
      <g class="rocket-stars" fill="#b7bdcc" opacity=".6"><path d="m60 88 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z"/><path d="m253 146 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z"/><circle cx="244" cy="65" r="2"/><circle cx="77" cy="191" r="1.5"/><circle cx="221" cy="222" r="1.5"/></g>
      <ellipse cx="160" cy="333" rx="71" ry="8" fill="#3f4763" opacity=".12"/>
      <path d="M109 321h102l10 8H99Z" fill="#7b8292"/><path d="M112 325h96" stroke="#cbd3dc" stroke-width="2"/>
      <path class="rocket-fuse-ash" d="M160 297C161 339 237 301 260 331S78 374 59 329" fill="none" stroke="#777066" stroke-width="3" opacity=".23"/>
      <path class="rocket-fuse" d="M160 297C161 339 237 301 260 331S78 374 59 329" fill="none" stroke="#b88344" stroke-width="4" stroke-linecap="round"/>
      <g class="rocket-spark"><circle r="9" fill="#ffc65c" opacity=".2"/><circle r="3.5" fill="#ffb63e"/><circle r="1.8" fill="#fffbd9"/><g stroke="#ffb63e" stroke-linecap="round"><path d="M-6-5-10-9M6-5 10-9M-7 3-12 5M4 6 6 11"/></g></g>
      <g class="rocket-smoke" fill="#b7c3d0" opacity="0"><ellipse cx="135" cy="318" rx="26" ry="12"/><ellipse cx="182" cy="319" rx="30" ry="14"/><ellipse cx="106" cy="325" rx="20" ry="9"/><ellipse cx="218" cy="326" rx="24" ry="10"/></g>
      <g class="rocket-ship">
        <path class="rocket-exhaust" d="M148 293Q131 322 160 363Q188 322 172 293Z" fill="url(#${id}-flame)" opacity="0"/>
        <path d="M135 239Q110 251 111 301L141 283ZM185 239Q210 251 209 301L179 283Z" fill="url(#${id}-red)" stroke="#9b3949" stroke-width="1.3"/>
        <path d="M137 279h46l-5 18h-36Z" fill="#536275"/><path d="M143 288h34" stroke="#aab7c6" stroke-width="3"/>
        <path d="M160 101C127 137 128 170 129 231L137 282H183L191 231C192 170 193 137 160 101Z" fill="url(#${id}-body)" stroke="#819aaa" stroke-width="1.3"/>
        <path d="M160 101Q136 126 131 155Q160 164 189 155Q184 126 160 101Z" fill="url(#${id}-red)"/>
        <path d="M134 254h52l-3 20h-46Z" fill="url(#${id}-red)"/>
        <circle cx="160" cy="194" r="23" fill="#d4b679" stroke="#93784c" stroke-width="1.5"/><circle cx="160" cy="194" r="17.5" fill="url(#${id}-window)" stroke="#f5da9f" stroke-width="2"/>
        <path d="M151 184Q157 178 165 181" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
        <path d="M139 169Q135 202 142 242" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".65"/>
        <path d="m160 245-6 38 6 18 6-18Z" fill="url(#${id}-red)"/>
      </g>
    </svg><div class="timer-story-caption">Ready for ignition</div>`;
    const petals=Array.from({length:20},(_,i)=>`<path d="M0-8C-15-18-12-43 0-52C12-43 15-18 0-8Z" transform="rotate(${i*18})" fill="url(#${id}-petal)" stroke="#dea02c" stroke-width=".6"/>`).join('');
    const seeds=Array.from({length:110},(_,i)=>{const a=i*2.399963,r=1.7*Math.sqrt(i);return `<circle cx="${(Math.cos(a)*r).toFixed(2)}" cy="${(Math.sin(a)*r).toFixed(2)}" r=".9" fill="${i%3?'#754829':'#c68b42'}"/>`;}).join('');
    plantStage.innerHTML=`<div class="scene-countdown">05:00</div><svg class="timer-story-svg plant-scene" viewBox="0 0 320 380" role="img" aria-label="A seed growing into a sunflower">
      <defs>
        <linearGradient id="${id}-pot"><stop stop-color="#9d513c"/><stop offset=".28" stop-color="#dd9971"/><stop offset=".6" stop-color="#c47b55"/><stop offset="1" stop-color="#944b37"/></linearGradient>
        <linearGradient id="${id}-leaf" x2="1" y2="1"><stop stop-color="#a2c85d"/><stop offset=".4" stop-color="#5f9e4d"/><stop offset="1" stop-color="#2e6842"/></linearGradient>
        <linearGradient id="${id}-petal" x2="0" y2="1"><stop stop-color="#ffe492"/><stop offset=".42" stop-color="#f9c943"/><stop offset="1" stop-color="#e39d23"/></linearGradient>
        <radialGradient id="${id}-heart"><stop stop-color="#9a6335"/><stop offset=".8" stop-color="#674027"/><stop offset="1" stop-color="#493421"/></radialGradient>
      </defs>
      <ellipse cx="160" cy="349" rx="64" ry="8" fill="#655141" opacity=".13"/>
      <path d="M113 290h94l-13 55q-34 11-68 0Z" fill="url(#${id}-pot)" stroke="#92533c" stroke-width="1"/>
      <path d="M127 310l7 28" stroke="#f6c79b" opacity=".3" stroke-width="3" stroke-linecap="round"/>
      <path d="M110 283h100v15q-50 13-100 0Z" fill="url(#${id}-pot)"/>
      <ellipse cx="160" cy="283" rx="50" ry="12" fill="#e7ab80"/>
      <ellipse cx="160" cy="283" rx="43" ry="8.5" fill="#574137"/>
      <g fill="#ac8160" opacity=".65">${Array.from({length:30},(_,i)=>`<circle cx="${122+(i*17%76)}" cy="${280+(i*7%8)}" r="${.6+i%3*.25}"/>`).join('')}</g>
      <path class="plant-stem" fill="none" stroke="#508345" stroke-width="5" stroke-linecap="round"/>
      <g class="plant-leaf left"><path d="M0 0C-28 5-59-11-56-39C-30-42-5-23 0 0Z" fill="url(#${id}-leaf)"/><path d="M-2-2-45-30" stroke="#c1d580" stroke-width="1" opacity=".65"/></g>
      <g class="plant-leaf right"><path d="M0 0C28 5 59-11 56-39C30-42 5-23 0 0Z" fill="url(#${id}-leaf)"/><path d="M2-2 45-30" stroke="#c1d580" stroke-width="1" opacity=".65"/></g>
      <g class="plant-leaf young"><path d="M0 0Q-28-4-27-26Q-4-23 0 0Z" fill="url(#${id}-leaf)"/></g>
      <g class="plant-head"><g class="plant-bud"><path d="M0 13C-29-8-11-29 0-34C11-29 29-8 0 13Z" fill="url(#${id}-leaf)"/><path d="M0 11V-26" stroke="#b6cf75" stroke-width="1"/></g><g class="plant-bloom">${petals}<circle r="20" fill="url(#${id}-heart)" stroke="#c18b35" stroke-width="2"/>${seeds}</g></g>
      <g class="plant-seed"><path d="M0-11C-9-5-7 9 0 13C7 9 9-5 0-11Z" fill="#554035" stroke="#342d27" stroke-width="1"/><path d="M-1-7 1 8" stroke="#c6ae82" stroke-width="2" stroke-linecap="round"/></g>
    </svg><div class="timer-story-caption">A little seed, ready to grow</div>`;
    const q=(root,selector)=>root.querySelector(selector);
    const fuse=q(rocketStage,'.rocket-fuse'),spark=q(rocketStage,'.rocket-spark'),ship=q(rocketStage,'.rocket-ship');
    const length=fuse.getTotalLength(),smoke=q(rocketStage,'.rocket-smoke'),exhaust=q(rocketStage,'.rocket-exhaust');
    const seed=q(plantStage,'.plant-seed'),stem=q(plantStage,'.plant-stem'),head=q(plantStage,'.plant-head');
    const left=q(plantStage,'.left'),right=q(plantStage,'.right'),young=q(plantStage,'.young');
    const bud=q(plantStage,'.plant-bud'),bloom=q(plantStage,'.plant-bloom');
    const rocketCaption=q(rocketStage,'.timer-story-caption'),plantCaption=q(plantStage,'.timer-story-caption');
    let state={progress:0,total:300,left:300,running:false},mode='hourglass',stamp=performance.now(),frame=0,launchAt=null,disposed=false,visible=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function draw(now) {
      const delta=state.running?Math.max(0,now-stamp)/1000:0,p=clamp(state.progress+delta/Math.max(1,state.total));
      if(mode==='rocket') {
        const remaining=length*(1-p),point=fuse.getPointAtLength(remaining);
        fuse.setAttribute('stroke-dasharray',`${remaining} ${length+1}`);
        spark.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${reduced.matches?0:now*.15})`);
        spark.style.opacity=state.running&&p<1?'1':'0';
        const launch=launchAt!==null ? clamp((now-launchAt)/2200) : p>=1?1:0;
        const travel=reduced.matches?(launch>0?1:0):launch;
        ship.setAttribute('transform',`translate(${travel*32} ${-travel*travel*470}) rotate(${travel*8} 160 280)`);
        exhaust.style.opacity=launch>0&&launch<1?'1':'0';
        smoke.style.opacity=launch>0?String(.65*(1-launch)): '0';
        smoke.setAttribute('transform',`translate(${-launch*80} ${-launch*16}) scale(${1+launch*.5} 1)`);
        rocketCaption.textContent=p>=1?'Lift-off! Mission complete.':state.running?'The fuse is burning…':p>0?'Ignition paused':'Ready for ignition';
      } else if(mode==='sunflower') {
        plantStage.dataset.idle=String(p===0 && !state.running);
        const g=growth(p,state.total),h=166*g.stem,tip=280-h;
        seed.setAttribute('transform',`translate(160 ${224+Math.pow(g.seed,2)*60}) rotate(${g.seed*32}) scale(${1-g.seed*.25})`);
        seed.style.opacity=g.seed>=1?'0':'1';
        stem.setAttribute('d',`M160 284C${160-13*g.stem} ${280-h*.32} ${160+10*g.stem} ${280-h*.72} 160 ${tip}`);
        stem.style.opacity=g.seed>=1?'1':'0';
        left.setAttribute('transform',`translate(157 ${280-h*.44}) scale(${g.leaves})`);
        right.setAttribute('transform',`translate(160 ${280-h*.64}) scale(${g.leaves*.87})`);
        young.setAttribute('transform',`translate(160 ${280-h*.82}) scale(${ease((p-.32)/.36)*.7})`);
        head.setAttribute('transform',`translate(160 ${tip})`);
        bud.setAttribute('transform',`scale(${g.bud*(1-g.bloom*.7)})`);bud.style.opacity=String(1-g.bloom);
        bloom.setAttribute('transform',`scale(${g.bloom}) rotate(${-12*(1-g.bloom)})`);
        plantCaption.textContent=p===0?'A little seed, ready to grow':g.label;
      }
    }
    function loop(now) {
      frame=0;if(disposed||document.hidden||!visible)return;
      draw(now);
      if(!reduced.matches && (state.running&&state.left>0 || mode==='rocket'&&launchAt!==null&&now-launchAt<2200)) frame=requestAnimationFrame(loop);
    }
    function refresh() {
      cancelAnimationFrame(frame);frame=0;
      if(disposed||document.hidden||!visible||!['rocket','sunflower'].includes(mode))return;
      draw(performance.now());
      if(!reduced.matches)frame=requestAnimationFrame(loop);
    }
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.target.hidden)visible=entry.isIntersecting;refresh();});
    observer.observe(rocketStage);observer.observe(plantStage);
    document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
    return {
      update(next){if(next.progress<state.progress || next.left>0)launchAt=null;state=next;stamp=performance.now();refresh();},
      setMode(next){mode=next;visible=true;refresh();},
      finish(){launchAt=performance.now();refresh();},
      destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',refresh);reduced.removeEventListener('change',refresh);}
    };
  }
  window.TeacherTilesGardenRocket=Object.freeze({create,growth});
})();
