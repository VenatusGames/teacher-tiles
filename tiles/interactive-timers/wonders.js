(() => {
  'use strict';
  let serial=0;
  const names={firework:'Firework',ice:'Ice',icecream:'Ice Cream',ants:'Ants'};
  const clamp=x=>Math.max(0,Math.min(1,x));
  function create(stage){
    const id='wonders-'+(++serial),url=name=>`url(#${id}-${name})`;
    const stars=Array.from({length:8},(_,i)=>`<path d="m${139+i%2*29} ${137+Math.floor(i/2)*27} 2-5 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3Z" fill="#ffdf8c" opacity=".85"/>`).join('');
    const pepperoni=[[120,153,14],[185,142,15],[155,195,14],[182,228,12],[147,263,10]].map(([x,y,r])=>`<g><circle cx="${x}" cy="${y}" r="${r}" fill="${url('pepperoni')}" stroke="#ad4b34" stroke-width="1"/><path d="M${x-r*.6} ${y-3}q3-7 10-5" fill="none" stroke="#ef9b60" stroke-width="2" opacity=".7"/><circle cx="${x+4}" cy="${y+4}" r="2" fill="#8f3c2c" opacity=".5"/></g>`).join('');
    const sprinkles=Array.from({length:32},(_,i)=>`<circle cx="${112+(i*23%97)}" cy="${126+(i*19%61)}" r="${.6+(i%3)*.3}" fill="${i%2?'#b8627c':'#fff6eb'}" opacity=".32"/>`).join('');
    const waffle=Array.from({length:19},(_,i)=>`<path d="M${-65+i*19} 182l155 160M${-65+i*19} 182l-155 160" stroke="#986531" stroke-width="1.8" opacity=".46"/><path d="M${-62+i*19} 182l155 160M${-62+i*19} 182l-155 160" stroke="#ffe1ad" stroke-width="1" opacity=".6"/>`).join('');
    stage.innerHTML=`<div class="scene-countdown">00:00</div><svg class="timer-story-svg wonder-art" viewBox="0 0 320 380" role="img" aria-label="Interactive timer">
    <defs>
      <linearGradient id="${id}-red"><stop stop-color="#862a42"/><stop offset=".26" stop-color="#ee7680"/><stop offset=".5" stop-color="#d94d65"/><stop offset="1" stop-color="#892945"/></linearGradient>
      <linearGradient id="${id}-gold"><stop stop-color="#a87d34"/><stop offset=".3" stop-color="#ffe8a2"/><stop offset=".55" stop-color="#e9c574"/><stop offset="1" stop-color="#ad7d37"/></linearGradient>
      <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4fcff" stop-opacity=".78"/><stop offset=".48" stop-color="#c1eaf4" stop-opacity=".52"/><stop offset="1" stop-color="#7bb8d5" stop-opacity=".8"/></linearGradient>
      <linearGradient id="${id}-glass-side"><stop stop-color="#91c7db" stop-opacity=".55"/><stop offset="1" stop-color="#6aa3c1" stop-opacity=".8"/></linearGradient>
      <radialGradient id="${id}-water"><stop stop-color="#d8f1f8" stop-opacity=".12"/><stop offset=".82" stop-color="#abd4e3" stop-opacity=".3"/><stop offset="1" stop-color="#8abacf" stop-opacity=".4"/></radialGradient>
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
      <ellipse class="wonder-ground-shadow" cx="160" cy="342" rx="59" ry="6" fill="#3b3449" opacity=".10"/>
      <path class="wonder-fuse-ash" d="M181 275C226 273 218 320 258 321S264 356 215 349S127 365 101 344" fill="none" stroke="#a3967e" stroke-width="3" opacity=".22"/>
      <path class="wonder-fuse" d="M181 275C226 273 218 320 258 321S264 356 215 349S127 365 101 344" fill="none" stroke="#ae8248" stroke-width="4" stroke-linecap="round"/>
      <g class="wonder-firework-body"><path d="M157 262h6v72h-6Z" fill="#ac8452"/><path d="M159 272v57" stroke="#e4c79d" stroke-width="2"/>
      <path d="M128 113h64v157q-32 12-64 0Z" fill="${url('red')}" stroke="#962e46" stroke-width="1.3"/>

      <path d="M125 113Q141 78 160 61Q179 78 195 113q-35 15-70 0Z" fill="${url('gold')}" stroke="#b58a49" stroke-width="1.1"/>
      <path d="M139 106Q146 82 158 69" stroke="#fff5c6" stroke-width="3" opacity=".65" fill="none" stroke-linecap="round"/>
      ${stars}<path d="M128 249q32 8 64 0v11q-32 8-64 0Z" fill="${url('gold')}"/>
      <path d="M135 123v113" stroke="#ffc9c6" stroke-width="3" stroke-linecap="round" opacity=".4"/></g>
      <g class="wonder-spark"><circle r="11" fill="#ffc365" opacity=".14"/><circle r="5" fill="#ffc761"/><circle r="2" fill="#fff9d2"/><path d="M-7-5-12-9M7-5 12-9M-8 4-13 7M5 7 8 12" stroke="#edac48" stroke-width="1.5" stroke-linecap="round"/></g>
      <g class="wonder-bursts" fill="none" stroke-linecap="round"></g>
    </g>
    <g data-wonder="ice"><ellipse cx="160" cy="315" rx="80" ry="10" fill="#38526a" opacity=".08"/><ellipse class="wonder-water" cx="160" cy="310" rx="61" ry="13" fill="${url('water')}" stroke="#81c2d7" stroke-opacity=".4"/>
      <g class="wonder-ice-solid">
      <path d="M83 158Q82 150 91 143L123 115Q130 109 140 112L235 139Q243 141 243 153L241 262Q241 271 232 279L205 307Q198 314 187 310L94 284Q83 281 83 269Z" fill="${url('glass')}" stroke="#a0c8d8" stroke-width="1.2"/>
      <path d="M204 183 235 153Q239 150 238 161L236 258Q236 268 230 274L204 301Q199 306 199 297V193Q199 188 204 183Z" fill="${url('glass-side')}"/>
      <path d="M92 150 129 119Q133 116 140 118L229 144Q237 146 231 151L199 181Q195 185 187 182L93 156Q87 154 92 150Z" fill="#effbff" opacity=".85"/>
      <path d="M94 171Q94 163 103 166L179 187Q187 189 187 199V286Q187 295 179 292L102 270Q95 268 95 261Z" fill="#fff" opacity=".16"/>
      <path d="m96 164 87 25M94 176v80" stroke="#fff" stroke-width="4" opacity=".73" stroke-linecap="round"/>
      <path d="M204 196v90M230 163v91" stroke="#e9f9ff" stroke-width="2.5" opacity=".38" stroke-linecap="round"/>
      <path d="m110 147 25-21 69 20-23 24Z" fill="#fff" opacity=".36"/>
      <path d="M127 188q-10 28 16 45q-14 22 6 43M210 204q20 7 13 32" stroke="#fff" stroke-width="7" opacity=".12" fill="none"/>
      <ellipse cx="157" cy="241" rx="4.5" ry="6" fill="#ecfaff" opacity=".67"/><ellipse cx="133" cy="254" rx="2" ry="3" fill="#ecfaff" opacity=".6"/>
      <path d="m99 279 85 25q10 4 16-2l31-29" stroke="#e5faff" stroke-width="3" opacity=".65" fill="none"/>
      </g><g class="wonder-drops" fill="#87cbe2"></g>
    </g>
    <g data-wonder="icecream"><ellipse cx="160" cy="339" rx="72" ry="9" fill="#493941" opacity=".1"/><ellipse class="wonder-cream-pool" cx="160" cy="334" rx="28" ry="7" fill="#e4a7b7" stroke="#ce90a2" stroke-width="1"/>
      <path d="M105 191Q160 209 215 191L164 327Q160 333 156 327Z" fill="${url('cone')}" stroke="#a97743" stroke-width="1.2"/><g clip-path="${url('cone-clip')}">${waffle}</g><path d="M105 191q55 18 110 0" stroke="#f3d5a5" stroke-width="5" fill="none"/>
      <g class="wonder-scoop"><path d="M102 182C99 165 101 137 113 121C126 102 143 98 159 99C180 96 201 110 213 127C224 145 226 166 218 184C218 194 209 200 201 196C190 203 180 197 174 201C165 204 156 197 149 201C139 204 133 197 126 199C116 199 115 192 108 193Q101 193 102 182Z" fill="${url('scoop')}" stroke="#d49caa" stroke-width=".9"/>
      <path d="M114 145C120 123 139 113 156 115M173 111q17 4 28 20" stroke="#fff7ee" stroke-width="4.5" stroke-linecap="round" opacity=".65" fill="none"/>
      <path d="M107 169q27-18 54-6t56-8M117 185q29-15 55-5t39-3" stroke="#c77a93" stroke-width="2.5" stroke-linecap="round" opacity=".23" fill="none"/>
      <path d="M124 143q19-14 43-8" stroke="#fff1e7" stroke-width="3" stroke-linecap="round" opacity=".43" fill="none"/>${sprinkles}</g>
      <g class="wonder-cream-drip" fill="#eab3c0" stroke="#d99aab" stroke-width=".7"><path class="cream-run-a"/><path class="cream-run-b"/></g><g class="wonder-drops" fill="#eab0bf"></g>
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
    const biteSites=[];
    for(let row=0;row<17;row++){
      const y=322-row*14,half=Math.min(88,Math.sqrt(Math.max(0,y-86)/.0045),Math.max(0,(325-y)*.41)+4);
      const sites=[];for(let x=160-half;x<=160+half+1;x+=14)sites.push({x,y,r:11.5+(row%3)*.4});
      if(row%2)sites.reverse();biteSites.push(...sites);
    }
    const bites=biteSites.map(site=>{const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',site.x);circle.setAttribute('cy',site.y);circle.setAttribute('r','0');find('bites').append(circle);return circle});
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
        const size=Math.pow(q,.5);attr(find('ice-solid'),'transform',`translate(${160*(1-size)} ${310*(1-size)}) scale(${size})`);find('ice-solid').style.opacity=String(Math.min(1,q*15));attr(find('water'),'rx',40+p*66);attr(find('water'),'ry',8+p*12);
      }else if(mode==='icecream'){
        const size=Math.pow(q,.57),wide=.6+.4*size;
        attr(find('scoop'),'transform',`translate(${160*(1-wide)} ${198*(1-size)}) scale(${wide} ${size})`);find('scoop').style.opacity=String(Math.min(1,q*14));
        attr(find('cream-pool'),'rx',12+77*p);attr(find('cream-pool'),'ry',3+11*p);find('cream-pool').style.opacity=String(.1+p*.9);
        const flow=Math.sin(Math.PI*p),a=199+flow*89,b=197+flow*54;
        attr(svg.querySelector('.cream-run-a'),'d',`M123 191Q130 201 ${131+(a-199)*.26} ${a-7}Q${135+(a-199)*.26} ${a+5} ${130+(a-199)*.26} ${a+5}Q${125+(a-199)*.26} ${a+4} ${126+(a-199)*.26} ${a-7}L117 191Z`);
        attr(svg.querySelector('.cream-run-b'),'d',`M184 192Q180 205 182 ${b-6}Q182 ${b+7} 176 ${b+6}Q170 ${b+6} 172 ${b-6}L175 192Z`);
        find('cream-drip').style.opacity=String(Math.min(1,p*12,q*12));

      }else{
        const eaten=p*biteSites.length,index=Math.min(biteSites.length-1,Math.floor(eaten)),fraction=eaten-index;
        bites.forEach((bite,i)=>attr(bite,'r',i<index||p>=1?biteSites[i].r:i===index?biteSites[i].r*clamp((fraction-.2)/.45):0));
        ants.forEach((ant,i)=>{
          const active=i===index%ants.length,site=biteSites[Math.max(0,index-((index-i+ants.length)%ants.length))],side=i%2?1:-1;
          const home={x:38+i*40,y:355+(i%2)*9},dx=site.x-home.x,dy=site.y-home.y,len=Math.hypot(dx,dy)||1;
          const phase=active?(fraction<.2?fraction/.2:fraction>.7?(1-fraction)/.3:1):clamp(1-((index-i+ants.length)%ants.length)/3);
          const x=home.x+(dx-dx/len*9)*phase,y=home.y+(dy-dy/len*9)*phase,returning=!active||fraction>.7;
          attr(ant,'transform',`translate(${x} ${y}) rotate(${Math.atan2(returning?-dy:dy,returning?-dx:dx)*180/Math.PI})`);
          attr(ant.querySelector('.ant-legs'),'transform',`skewX(${Math.sin(t*24+i)*10})`);ant.querySelector('.ant-crumb').style.opacity=returning&&p>0?'1':'0';ant.style.opacity=p>=1?'0':'1';
        });

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
