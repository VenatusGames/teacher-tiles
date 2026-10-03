(() => {
  'use strict';
  let serial=0;
  const names={firework:'Firework',ice:'Ice',icecream:'Ice Cream',ants:'Ants'};
  const clamp=x=>Math.max(0,Math.min(1,x));
  function create(stage){
    const id='wonders-'+(++serial),url=name=>`url(#${id}-${name})`;
    const stars=Array.from({length:8},(_,i)=>`<path d="m${139+i%2*29} ${137+Math.floor(i/2)*27} 2-5 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3Z" fill="#ffdf8c" opacity=".85"/>`).join('');
    const pepperoni=[[120,153,14],[185,142,15],[155,195,14],[182,228,12],[147,263,10]].map(([x,y,r])=>`<g><circle cx="${x}" cy="${y}" r="${r}" fill="${url('pepperoni')}" stroke="#ad4b34" stroke-width="1"/><path d="M${x-r*.6} ${y-3}q3-7 10-5" fill="none" stroke="#ef9b60" stroke-width="2" opacity=".7"/><circle cx="${x+4}" cy="${y+4}" r="2" fill="#8f3c2c" opacity=".5"/></g>`).join('');
    const sprinkles=Array.from({length:17},(_,i)=>`<path d="m${112+(i*29%101)} ${128+(i*17%66)} 4 3" stroke="${['#fff1b8','#ac5766','#fff8eb'][i%3]}" stroke-width="2.5" stroke-linecap="round"/>`).join('');
    const waffle=Array.from({length:12},(_,i)=>`<path d="M${85+i*17} 192 225 ${270+i*10}M${235-i*17} 192 95 ${270+i*10}" stroke="#a66a32" stroke-width="2" opacity=".5"/>`).join('');
    stage.innerHTML=`<div class="scene-countdown">00:00</div><svg class="timer-story-svg wonder-art" viewBox="0 0 320 380" role="img" aria-label="Interactive timer">
    <defs>
      <linearGradient id="${id}-red"><stop stop-color="#862a42"/><stop offset=".26" stop-color="#ee7680"/><stop offset=".5" stop-color="#d94d65"/><stop offset="1" stop-color="#892945"/></linearGradient>
      <linearGradient id="${id}-gold"><stop stop-color="#a87d34"/><stop offset=".3" stop-color="#ffe8a2"/><stop offset=".55" stop-color="#e9c574"/><stop offset="1" stop-color="#ad7d37"/></linearGradient>
      <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2fcff" stop-opacity=".94"/><stop offset=".38" stop-color="#a6e7f4" stop-opacity=".78"/><stop offset="1" stop-color="#50a8d1" stop-opacity=".94"/></linearGradient>
      <linearGradient id="${id}-glass-side"><stop stop-color="#8bcfe6" stop-opacity=".8"/><stop offset="1" stop-color="#408ebc" stop-opacity=".9"/></linearGradient>
      <radialGradient id="${id}-water"><stop stop-color="#c9f4fa" stop-opacity=".25"/><stop offset=".7" stop-color="#95d5e9" stop-opacity=".48"/><stop offset="1" stop-color="#56adce" stop-opacity=".64"/></radialGradient>
      <radialGradient id="${id}-scoop" cx=".3" cy=".22" r=".85"><stop stop-color="#fff0e8"/><stop offset=".35" stop-color="#f9c7ca"/><stop offset=".72" stop-color="#e894a9"/><stop offset="1" stop-color="#b9607f"/></radialGradient>
      <linearGradient id="${id}-cone"><stop stop-color="#ad733c"/><stop offset=".3" stop-color="#edc184"/><stop offset=".65" stop-color="#dba15f"/><stop offset="1" stop-color="#a56b34"/></linearGradient>
      <linearGradient id="${id}-crust" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5d7a0"/><stop offset=".45" stop-color="#dca95d"/><stop offset="1" stop-color="#a36531"/></linearGradient>
      <linearGradient id="${id}-cheese" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffeb9e"/><stop offset=".55" stop-color="#f4c568"/><stop offset="1" stop-color="#d68e3d"/></linearGradient>
      <radialGradient id="${id}-pepperoni" cx=".35" cy=".3"><stop stop-color="#e47f52"/><stop offset="1" stop-color="#ac4234"/></radialGradient>
      <radialGradient id="${id}-plate"><stop stop-color="#fffefa"/><stop offset=".78" stop-color="#f3f0e8"/><stop offset=".88" stop-color="#dbd9d0"/><stop offset=".96" stop-color="#fbfaf5"/><stop offset="1" stop-color="#dedbd1"/></radialGradient>
      <clipPath id="${id}-cone-clip"><path d="M105 191Q160 209 215 191L164 327Q160 333 156 327Z"/></clipPath>
      <mask id="${id}-bites"><rect width="320" height="380" fill="white"/><g class="wonder-bites" fill="black"></g></mask>
    </defs>
    <g data-wonder="firework">
      <g fill="#d8c8a3" opacity=".65"><path d="m73 83 2-6 2 6 6 2-6 2-2 6-2-6-6-2ZM240 109l2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><circle cx="216" cy="54" r="2"/><circle cx="72" cy="211" r="1.5"/></g>
      <ellipse cx="160" cy="334" rx="71" ry="9" fill="#3b3449" opacity=".12"/>
      <path class="wonder-fuse-ash" d="M181 275C226 273 218 320 258 321S264 356 215 349S127 365 101 344" fill="none" stroke="#a3967e" stroke-width="3" opacity=".22"/>
      <path class="wonder-fuse" d="M181 275C226 273 218 320 258 321S264 356 215 349S127 365 101 344" fill="none" stroke="#ae8248" stroke-width="4" stroke-linecap="round"/>
      <g class="wonder-firework-body"><path d="M157 262h6v72h-6Z" fill="#ac8452"/><path d="M159 272v57" stroke="#e4c79d" stroke-width="2"/>
      <path d="M128 113h64v157q-32 12-64 0Z" fill="${url('red')}" stroke="#962e46" stroke-width="1.3"/>
      <ellipse cx="160" cy="270" rx="32" ry="7" fill="#9b324b"/>
      <path d="M125 113Q141 78 160 61Q179 78 195 113q-35 15-70 0Z" fill="${url('gold')}" stroke="#b58a49" stroke-width="1.1"/>
      <path d="M139 106Q146 82 158 69" stroke="#fff5c6" stroke-width="3" opacity=".65" fill="none" stroke-linecap="round"/>
      ${stars}<path d="M128 249q32 8 64 0v11q-32 8-64 0Z" fill="${url('gold')}"/>
      <path d="M135 123v113" stroke="#ffc9c6" stroke-width="3" stroke-linecap="round" opacity=".4"/></g>
      <g class="wonder-spark"><circle r="11" fill="#ffc365" opacity=".14"/><circle r="5" fill="#ffc761"/><circle r="2" fill="#fff9d2"/><path d="M-7-5-12-9M7-5 12-9M-8 4-13 7M5 7 8 12" stroke="#edac48" stroke-width="1.5" stroke-linecap="round"/></g>
      <g class="wonder-bursts" fill="none" stroke-linecap="round"></g>
    </g>
    <g data-wonder="ice"><ellipse cx="160" cy="327" rx="80" ry="10" fill="#38526a" opacity=".08"/><ellipse class="wonder-water" cx="160" cy="321" rx="61" ry="13" fill="${url('water')}" stroke="#81c2d7" stroke-opacity=".4"/>
      <g class="wonder-ice-solid"><path d="M80 143 119 106 236 126 208 165Z" fill="#dff8fe" stroke="#9ed8e7" stroke-width="1.5"/><path d="M208 165 236 126 236 276Q235 287 224 295L208 310Z" fill="${url('glass-side')}" stroke="#86bdd6" stroke-width="1.4"/>
      <path d="M80 143Q78 135 92 137L201 158Q211 160 211 172L211 294Q212 310 198 310L95 292Q79 290 79 276Z" fill="${url('glass')}" stroke="#87c8df" stroke-width="1.5"/>
      <path d="m94 155 99 19M91 163v102" stroke="#fff" stroke-width="5" opacity=".78" stroke-linecap="round"/>
      <path d="m96 138 29-21 82 14-25 21Z" fill="#fff" opacity=".4"/>
      <path d="m160 194-18 34 15 20-8 31m-6-51-28 3m43 18 28-17" fill="none" stroke="#effcff" stroke-width="2" opacity=".6"/>
      <ellipse cx="176" cy="270" rx="7" ry="10" fill="#eafbff" opacity=".55"/><ellipse cx="126" cy="189" rx="4" ry="5" fill="#fff" opacity=".6"/>
      <path d="m219 166 8-13v114" fill="none" stroke="#d6f7ff" stroke-width="3" opacity=".5"/></g><g class="wonder-drops" fill="#87cbe2"></g>
    </g>
    <g data-wonder="icecream"><ellipse cx="160" cy="339" rx="72" ry="9" fill="#493941" opacity=".1"/><ellipse class="wonder-cream-pool" cx="160" cy="334" rx="28" ry="7" fill="#e4a7b7" stroke="#ce90a2" stroke-width="1"/>
      <path d="M105 191Q160 209 215 191L164 327Q160 333 156 327Z" fill="${url('cone')}" stroke="#a97743" stroke-width="1.2"/><g clip-path="${url('cone-clip')}">${waffle}</g><path d="M105 191q55 18 110 0" stroke="#f3d5a5" stroke-width="5" fill="none"/>
      <g class="wonder-scoop"><path d="M102 171C90 150 106 115 124 109C127 84 165 85 179 97C207 93 229 125 221 147C241 169 224 195 207 196C197 211 181 201 171 206C154 216 145 204 135 207C119 205 119 194 108 196C89 192 89 177 102 171Z" fill="${url('scoop')}" stroke="#d38fa1" stroke-width="1"/>
      <path d="M116 140q-2-20 18-23m8-13q22-10 38 3" fill="none" stroke="#fff4e9" stroke-width="6" stroke-linecap="round" opacity=".65"/>
      <path d="M105 167q20-9 33 5m37-40q16-8 30 7m-63 44q20-10 37 2" fill="none" stroke="#d88da4" stroke-width="3" opacity=".45"/>${sprinkles}</g>
      <path class="wonder-cream-drip" d="M124 195q7 8 7 17q0 8-6 8q-6 0-5-8Z" fill="#eeb4c2"/><g class="wonder-drops" fill="#eab0bf"></g>
    </g>
    <g data-wonder="ants"><ellipse cx="160" cy="327" rx="107" ry="14" fill="#463d2a" opacity=".1"/><ellipse cx="160" cy="230" rx="109" ry="105" fill="${url('plate')}"/>
      <g mask="${url('bites')}"><path d="M78 119Q158 77 242 116L168 318Q160 329 153 316Z" fill="#cb8743"/><path d="M84 127Q158 90 234 123L162 307Z" fill="#c96a40"/>
      <path d="M89 133Q157 95 229 128L164 301Q158 309 155 292Z" fill="${url('cheese')}"/><path d="M93 134q63-31 131-5" stroke="#ffedaf" stroke-width="3" fill="none"/>
      ${pepperoni}<g fill="#7c9752"><path d="M134 169q-13-17-18-6q1 14 18 6ZM174 181q18-15 9-22q-14 1-9 22ZM163 242q-13-18-20-7q2 15 20 7Z"/></g>
      <g fill="#c48238" opacity=".5"><circle cx="153" cy="142" r="2"/><circle cx="111" cy="144" r="2.2"/><circle cx="198" cy="192" r="2"/><circle cx="138" cy="233" r="1.6"/><circle cx="162" cy="274" r="2"/></g>
      <path d="M79 120Q157 78 240 117" stroke="#9d6536" stroke-width="20" stroke-linecap="round" fill="none"/><path d="M79 116Q157 76 240 113" stroke="${url('crust')}" stroke-width="19" stroke-linecap="round" fill="none"/><path d="M92 111q65-29 132-2" stroke="#ffe5b1" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/></g>
      <g class="wonder-ant-trail"></g><g fill="#d7a458"><circle cx="106" cy="323" r="2"/><circle cx="214" cy="302" r="2.2"/><circle cx="230" cy="326" r="1.5"/></g>
    </g></svg><div class="timer-story-caption"></div>`;
    const svg=stage.querySelector('svg'),find=c=>svg.querySelector('.wonder-'+c),caption=stage.querySelector('.timer-story-caption');
    const fuse=find('fuse'),length=fuse.getTotalLength(),spark=find('spark');
    const ants=Array.from({length:7},(_,i)=>{const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.innerHTML='<g class="ant-legs" fill="none" stroke="#57443a" stroke-width="1.2"><path d="M-3-2-8-8M1-2 2-9M4-1 10-6M-3 2-8 8M1 2 2 9M4 1 10 6"/></g><ellipse cx="-6" cy="0" rx="4.8" ry="3.6" fill="#574238"/><ellipse rx="3" ry="2.8" fill="#79513a"/><circle cx="5" r="3" fill="#574238"/><path d="m7-2 4-3m-4 7 4 3" stroke="#574238" stroke-width="1"/><path class="ant-crumb" d="m9-3 6 2-3 5-4-2Z" fill="#e2aa53"/>';find('ant-trail').append(g);return g});
    const burstLines=Array.from({length:66},()=>{const line=document.createElementNS(svg.namespaceURI,'path');find('bursts').append(line);return line});
    const bitePath=document.createElementNS(svg.namespaceURI,'path');find('bites').append(bitePath);
    const dropGroups=[...svg.querySelectorAll('.wonder-drops')].map(group=>({group,drops:Array.from({length:3},()=>{const drop=document.createElementNS(svg.namespaceURI,'ellipse');group.append(drop);return drop})}));
    let mode='firework' ,state={progress:0,total:0,left:0,running:false},stamp=performance.now(),frame=0,finished=null,visible=true,dead=false,motion=0,lastFrame=0;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const attr=(el,key,value)=>el.setAttribute(key,String(value));
    function draw(now){
      frame=0;if(dead||stage.hidden||!visible)return;
      if(state.running&&!reduced.matches)motion+=Math.min(50,now-(lastFrame||now));lastFrame=now;
      const p=clamp(state.progress+(state.running?(now-stamp)/1000/Math.max(1,state.total):0)),q=1-p,t=motion/1000;
      if(mode==='firework'){
        attr(fuse,'stroke-dasharray',`${length*q} ${length}`);const point=fuse.getPointAtLength(length*q);attr(spark,'transform',`translate(${point.x} ${point.y}) rotate(${t*100})`);spark.style.opacity=state.running&&p<1?'1':'0';
        const done=p>=1||finished!==null,elapsed=finished===null?3:(now-finished)/1000,launch=clamp(elapsed/.6);
        find('firework-body').style.opacity=done?String(1-launch):'1';attr(find('firework-body'),'transform',done&&!reduced.matches?`translate(0 ${-310*launch*launch})`:'');fuse.style.opacity=done?'0':'1';
        const bursts=find('bursts');bursts.style.display=done?'':'none';if(done){
          for(let b=0;b<3;b++){const age=reduced.matches?1:clamp((elapsed-.25-b*.28)/1.8),cx=[157,82,242][b],cy=[138,202,208][b],radius=[87,51,55][b]*Math.sin(age*Math.PI/2);if(age<=0)continue;
            for(let i=0;i<22;i++){const a=i*Math.PI*2/22+b*.25,tail=Math.max(0,radius-12*(1-age)),line=burstLines[b*22+i];attr(line,'d',`M${cx+Math.cos(a)*tail} ${cy+Math.sin(a)*tail+age*age*22}L${cx+Math.cos(a)*radius} ${cy+Math.sin(a)*radius+age*age*22}`);attr(line,'stroke',['#d486aa','#d4a34e','#859dc9'][b]);attr(line,'stroke-width',2.5);attr(line,'opacity',.9-age*.35);}
          }
        }
      }else if(mode==='ice'){
        attr(find('ice-solid'),'transform',`translate(${160*(1-(.75+.25*q))} ${310*(1-q)}) scale(${.75+.25*q} ${q})`);find('ice-solid').style.opacity=String(Math.min(1,q*8));attr(find('water'),'rx',61+p*48);attr(find('water'),'ry',13+p*8);
      }else if(mode==='icecream'){
        attr(find('scoop'),'transform',`translate(${160*(-p*.12)} ${202*p*.82}) scale(${1+p*.12} ${1-p*.82})`);find('scoop').style.opacity=String(Math.min(1,q*8));attr(find('cream-pool'),'rx',28+69*p);attr(find('cream-pool'),'ry',7+8*p);attr(find('cream-drip'),'transform',`translate(0 ${p*28}) scale(1 ${1+p*.8})`);find('cream-drip').style.opacity=p>0&&p<1?'1':'0';
      }else{
        const edge=330-p*251;let bite=p>0?`M0 ${edge}H320V380H0Z`:'';
        if(p>0)for(let i=0;i<12;i++){const x=55+i*20,r=8+(i%3)*2;bite+=`M${x-r} ${edge}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0Z`;}
        attr(bitePath,'d',bite);

        ants.forEach((ant,i)=>{const u=(t*.10+i/ants.length)%1,phase=u<.5?u*2:(1-u)*2,side=i%2?1:-1,x=160+side*(115-phase*85),y=357-phase*(35+p*195);attr(ant,'transform',`translate(${x} ${y}) rotate(${u<.5?-90-side*28:90-side*28})`);attr(ant.querySelector('.ant-legs'),'transform',`skewX(${Math.sin(t*24+i)*10})`);ant.querySelector('.ant-crumb').style.opacity=u>.5&&p>0&&p<1?'1':'0';ant.style.opacity=p>=1?'0':'1'});
      }
      for(const {group,drops} of dropGroups){group.style.opacity=state.running&&p>0&&p<1?'1':'0';if(state.running&&p>0&&p<1)drops.forEach((drop,i)=>{const u=(t*.8+i*.32)%1;attr(drop,'cx',112+i*44);attr(drop,'cy',(mode==='ice'?285:245)+u*70);attr(drop,'rx',2.5);attr(drop,'ry',4);attr(drop,'opacity',Math.sin(u*Math.PI)*.65)});}

      caption.textContent=p>=1?({firework:'Time to celebrate!',ice:'All melted!',icecream:'All melted!',ants:'Every bite is gone!'})[mode]:names[mode];
      if(!reduced.matches&&(state.running||finished!==null&&now-finished<3200))frame=requestAnimationFrame(draw);
    }
    const refresh=()=>{cancelAnimationFrame(frame);draw(performance.now())};
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastFrame=0;refresh()});observer.observe(stage);
    return {setMode(next){mode=names[next]?next:'firework';svg.querySelectorAll('[data-wonder]').forEach(g=>g.style.display=g.dataset.wonder===mode?'':'none');svg.setAttribute('aria-label',names[mode]+' timer');finished=null;refresh()},update(next){if(next.progress<state.progress||next.left>0)finished=null;state=next;stamp=performance.now();lastFrame=stamp;const seconds=Math.max(0,Math.ceil(next.left));stage.querySelector('.scene-countdown').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;refresh()},finish(){finished=performance.now();refresh()},destroy(){dead=true;cancelAnimationFrame(frame);observer.disconnect()}};
  }
  window.TeacherTilesTimerWonders={create};
})();
