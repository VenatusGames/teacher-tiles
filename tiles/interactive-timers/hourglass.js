/* Decorative sand follows the shared timer; it never drives the countdown. */
(() => {
  'use strict';
  const CX = 150, TOP = 65, NECK = 190, BASE = 315;
  function halfWidth(y) {
    const t = Math.max(0, Math.min(1, Math.abs(y - NECK) / 125));
    return 2.4 + 76 * (t * t * (3 - 2 * t));
  }
  const funnel = x => 8 * Math.exp(-Math.abs(x - CX) / 13);
  const slope = x => .48 * Math.abs(x - CX);
  // Equal-area samples give both chambers the same sand volume, despite their
  // curved walls and different sand surfaces. Height alone would lose sand.
  const upper = [], lower = [];
  for (let y = TOP; y < BASE; y += 1) {
    for (let x = CX - halfWidth(y); x < CX + halfWidth(y); x += 1) {
      (y < NECK ? upper : lower).push(y - (y < NECK ? funnel(x) : slope(x)));
    }
  }
  upper.sort((a,b) => b-a); lower.sort((a,b) => b-a);
  const volume = Math.floor(Math.min(upper.length, lower.length) * .72);
  function level(samples, amount) {
    const index = Math.max(0, Math.min(samples.length - 1, amount));
    const i = Math.floor(index), f = index - i;
    return samples[i] + ((samples[i + 1] ?? samples[i]) - samples[i]) * f;
  }
  function sandLevels(progress) {
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    return { top: level(upper, volume * (1-p)), bottom: level(lower, volume * p), progress: p };
  }
  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let state = { progress: 0, running: false, left: 300, total: 300 };
    let frame = 0, clock = 0, last = 0, visible = true, active = true, disposed = false, updatedAt = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const glass = new Path2D();
    glass.moveTo(CX - halfWidth(TOP), TOP);
    for (let y = TOP; y <= BASE; y++) glass.lineTo(CX - halfWidth(y), y);
    for (let y = BASE; y >= TOP; y--) glass.lineTo(CX + halfWidth(y), y);
    glass.closePath();
    // Cache thousands of irregular grains; each frame only clips the texture.
    const texture = document.createElement('canvas'); texture.width = 600; texture.height = 760;
    const grain = texture.getContext('2d'); grain.scale(2,2);
    const sand = grain.createLinearGradient(70,65,228,315);
    sand.addColorStop(0,'#f3d898'); sand.addColorStop(.35,'#dfb66f'); sand.addColorStop(.72,'#c7974d'); sand.addColorStop(1,'#edca85');
    grain.fillStyle = sand; grain.fillRect(65,60,170,260);
    let seed = 8173;
    const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const colors = ['#fff0c4','#b98841','#e9c47e','#987039','#f8dea3','#d5a45d'];
    for (let i=0; i<19000; i++) {
      const x=67+random()*166, y=63+random()*254, r=.22+random()*.58;
      grain.globalAlpha=.3+random()*.5; grain.fillStyle=colors[i%colors.length];
      grain.fillRect(x,y,r,r*(.65+random()*.8));
    }
    function gradient(x1,y1,x2,y2,stops) {
      const g=ctx.createLinearGradient(x1,y1,x2,y2);
      stops.forEach(([offset,color])=>g.addColorStop(offset,color)); return g;
    }
    function rounded(x,y,w,h,r,fill) {
      ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
    }
    function sandShape(surface, upperChamber) {
      ctx.save(); ctx.clip(glass);
      ctx.beginPath();ctx.rect(60,upperChamber?TOP:NECK,180,125);ctx.clip();ctx.beginPath();
      ctx.moveTo(65,upperChamber ? NECK : BASE);
      for(let x=65;x<=235;x++)ctx.lineTo(x,surface+(upperChamber?funnel(x):slope(x)));
      ctx.lineTo(235,upperChamber?NECK:BASE);ctx.closePath();ctx.clip();
      ctx.drawImage(texture,0,0,300,380);ctx.restore();
      ctx.save();ctx.clip(glass);ctx.beginPath();ctx.rect(60,upperChamber?TOP:NECK,180,125);ctx.clip();ctx.beginPath();
      for(let x=65;x<=235;x++) {
        const y=surface+(upperChamber?funnel(x):slope(x));
        if(x===65)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle='rgba(255,234,183,.75)';ctx.lineWidth=.9;ctx.stroke();ctx.restore();
    }
    function draw() {
      if(disposed || !ctx)return;
      const elapsed=state.running && state.left>0 ? Math.max(0,performance.now()-updatedAt)/1000 : 0;
      const { top,bottom,progress }=sandLevels(state.progress+elapsed/Math.max(1,state.total));
      const w=canvas.width,h=canvas.height;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
      const scale=Math.min(w/300,h/380);
      ctx.setTransform(scale,0,0,scale,(w-300*scale)/2,(h-380*scale)/2);
      // Soft contact shadow and turned walnut frame.
      ctx.save();ctx.translate(150,349);ctx.scale(1,.13);
      const shadow=ctx.createRadialGradient(0,0,12,0,0,115);
      shadow.addColorStop(0,'rgba(30,22,14,.24)');shadow.addColorStop(1,'rgba(30,22,14,0)');
      ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(0,0,115,0,Math.PI*2);ctx.fill();ctx.restore();
      for(const x of [48,240]) {
        rounded(x,51,12,275,5,gradient(x,0,x+12,0,[[0,'#39291f'],[.3,'#936846'],[.49,'#bc9267'],[.67,'#795036'],[1,'#34251e']]));
        for(const y of [64,304])rounded(x-2,y,16,9,2,gradient(0,y,0,y+9,[[0,'#a87e42'],[.4,'#edcc83'],[1,'#78542c']]));
      }
      ctx.fillStyle=gradient(70,0,230,0,[[0,'rgba(142,185,195,.25)'],[.2,'rgba(246,254,255,.08)'],[.6,'rgba(190,220,222,.04)'],[1,'rgba(114,165,180,.26)']]);
      ctx.fill(glass);ctx.strokeStyle='rgba(104,147,157,.55)';ctx.lineWidth=1.8;ctx.stroke(glass);
      if(progress<1)sandShape(top,true);
      if(progress>0)sandShape(bottom,false);
      if(state.running && state.left>0 && progress<1) {
        ctx.save();ctx.clip(glass);
        if(!reduce.matches)for(let i=0;i<24;i++) {
          const t=(clock*.45+i/24)%1, x=CX+(i%2?1:-1)*28*(1-t);
          const y=top+funnel(x)+.5;
          if(y<NECK-2){ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,y,.7,.65);}
        }
        const impact=Math.max(NECK+1,bottom);
        ctx.strokeStyle='rgba(218,174,100,.38)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(CX,NECK-6);ctx.lineTo(CX,impact);ctx.stroke();
        // Ballistic spacing: grains accelerate away from the narrow neck.
        for(let i=0;i<65;i++) {
          const phase=(i/65+clock*1.65)%1, y=NECK-3+(impact-NECK+3)*phase*phase;
          const x=CX+Math.sin(i*41.3+clock*3)*(.65+phase*.65);
          ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,y,.6+(i%3)*.15,1+(i%4)*.28);
        }
        if(progress>.001 && !reduce.matches)for(let i=0;i<18;i++) {
          const t=(clock*1.8+i/18)%1, side=i%2?1:-1;
          const x=CX+side*t*(9+i%7), y=impact+slope(x)-Math.sin(t*Math.PI)*(2+i%4);
          ctx.globalAlpha=1-t;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,y,.8,.8);
        }
        ctx.restore();
      }
      // Reflections remain in front of the grains, tracing the curved glass.
      ctx.save();ctx.clip(glass);
      for(const [start,end] of [[75,171],[210,304]]) {
        ctx.beginPath();
        for(let y=start;y<=end;y++) {
          const x=CX-halfWidth(y)+8;
          if(y===start)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle='rgba(255,255,255,.62)';ctx.lineWidth=3.3;ctx.lineCap='round';ctx.stroke();
      }
      ctx.beginPath();for(let y=77;y<=304;y++) {
        const x=CX+halfWidth(y)-4;if(y===77)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle='rgba(246,255,255,.44)';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
      for(const y of [41,319]) {
        rounded(34,y+2,232,23,9,gradient(0,y,0,y+25,[[0,'#aa7d54'],[.2,'#926444'],[.56,'#603e2b'],[1,'#39281f']]));
        rounded(39,y,222,5,3,gradient(39,0,261,0,[[0,'#785034'],[.4,'#c29b6c'],[1,'#785034']]));
        ctx.save();ctx.beginPath();ctx.roundRect(38,y+6,224,13,5);ctx.clip();
        for(let i=0;i<8;i++) {
          ctx.beginPath();ctx.moveTo(39,y+7+i*1.8);ctx.bezierCurveTo(98,y+3+i*1.8,181,y+14+i,262,y+6+i*1.6);
          ctx.strokeStyle=i%2?'rgba(233,186,129,.13)':'rgba(30,15,8,.18)';ctx.lineWidth=.6;ctx.stroke();
        }
        ctx.restore();
      }
    }
    function animate(now) {
      frame=0;
      if(disposed || !active || !visible || document.hidden)return;
      if(last)clock+=Math.min(.05,(now-last)/1000);last=now;draw();
      if(state.running && state.left>0 && !reduce.matches)frame=requestAnimationFrame(animate);
    }
    function refresh() {
      if(disposed)return;
      if(!active || !visible || document.hidden){cancelAnimationFrame(frame);frame=0;last=0;return;}
      if(!state.running || state.left<=0 || reduce.matches){cancelAnimationFrame(frame);frame=0;last=0;draw();}
      else if(!frame)frame=requestAnimationFrame(animate);
    }
    const resize=new ResizeObserver(entries=>{
      const bounds=entries[0].contentRect,ratio=Math.min(devicePixelRatio||1,2.5);
      if(bounds.width && bounds.height){
        const width=Math.round(bounds.width*ratio),height=Math.round(bounds.height*ratio);
        if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;draw();}
        refresh();
      }
    });resize.observe(canvas);
    const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh();});intersection.observe(canvas);
    document.addEventListener('visibilitychange',refresh);reduce.addEventListener('change',refresh);
    return {
      update(next){if(next.progress<state.progress)clock=0;state=next;updatedAt=performance.now();refresh();},
      setActive(value){active=value;refresh();},
      destroy(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',refresh);reduce.removeEventListener('change',refresh);}
    };
  }
  window.TeacherTilesHourglass=Object.freeze({create,sandLevels});
})();
