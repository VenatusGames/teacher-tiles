(() => {
  'use strict';
  const DURATION=30000;
  function setup(m){
    const button=m.querySelector('.glitter-jar-button'),canvas=button.querySelector('canvas'),caption=m.querySelector('.glitter-jar-caption');
    const ctx=canvas.getContext('2d');
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=300*dpr;canvas.height=380*dpr;ctx.scale(dpr,dpr);
    const jar=new Path2D('M96 67 L204 67 L204 81 C204 99 233 102 237 126 L237 306 Q237 337 207 337 L93 337 Q63 337 63 306 L63 126 C67 102 96 99 96 81 Z');
    const glass=ctx.createLinearGradient(63,0,237,0);glass.addColorStop(0,'#d8cbff99');glass.addColorStop(.14,'#ffffff88');glass.addColorStop(.38,'#ffffff0a');glass.addColorStop(.83,'#cbb5ff22');glass.addColorStop(1,'#8e77c466');
    const liquid=ctx.createLinearGradient(0,112,0,337);liquid.addColorStop(0,'#b781e8');liquid.addColorStop(.4,'#8651c3');liquid.addColorStop(1,'#432876');
    const lid=ctx.createLinearGradient(0,40,0,72);lid.addColorStop(0,'#e5d4f3');lid.addColorStop(.3,'#c2a7d8');lid.addColorStop(1,'#806096');
    const colors=['#fff3c2','#f5dcff','#c6a0ff','#e7b4f8','#ffffff'];
    const particles=Array.from({length:180},()=>({angle:Math.random()*Math.PI*2,radius:10+Math.random()*65,y:132+Math.random()*166,baseX:76+Math.random()*148,baseY:320+Math.random()*10,size:.8+Math.random()*1.6,speed:.6+Math.random(),color:colors[Math.floor(Math.random()*colors.length)]}));
    let start=0,raf=0,running=false,disposed=false,visible=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function draw(progress=1){
      const energy=(1-progress)**2,phase=(1-(1-progress)**3)*(reduced.matches?5:22);
      ctx.clearRect(0,0,300,380);
      ctx.fillStyle='#39275412';ctx.beginPath();ctx.ellipse(150,350,84,9,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.clip(jar);ctx.fillStyle=glass;ctx.fillRect(60,65,180,275);
      ctx.fillStyle=liquid;ctx.beginPath();ctx.moveTo(60,122);ctx.bezierCurveTo(105,122+energy*Math.sin(phase)*9,190,122-energy*Math.sin(phase)*9,240,122);ctx.lineTo(240,340);ctx.lineTo(60,340);ctx.closePath();ctx.fill();
      // Broad translucent currents give the purple liquid depth without blur filters.
      ctx.save();ctx.beginPath();ctx.rect(64,128,172,210);ctx.clip();
      for(let i=0;i<4;i++){
        ctx.save();ctx.translate(150,166+i*40);ctx.rotate(Math.sin(phase*.5+i)*energy*.7);
        ctx.fillStyle=i%2?'#d8a7fa':'#542782';ctx.globalAlpha=.06+energy*.14;
        ctx.beginPath();ctx.ellipse(Math.sin(phase+i)*energy*20,0,106,12+energy*14,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      ctx.restore();
      for(const p of particles){
        const a=p.angle+phase*p.speed,w=Math.sqrt(energy);
        const x=p.baseX*(1-w)+(150+Math.cos(a)*p.radius)*w;
        const y=p.baseY*(1-w)+(p.y+Math.sin(a)*24*energy)*w;
        ctx.globalAlpha=.45+.5*(.5+.5*Math.sin(a*2));ctx.fillStyle=p.color;
        ctx.beginPath();ctx.moveTo(x,y-p.size*1.6);ctx.lineTo(x+p.size,y);ctx.lineTo(x,y+p.size*1.6);ctx.lineTo(x-p.size,y);ctx.closePath();ctx.fill();
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='#efd9ff45';ctx.beginPath();ctx.ellipse(150,122,85,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffffff35';ctx.beginPath();ctx.roundRect(75,126,9,170,5);ctx.fill();ctx.fillStyle='#ffffff18';ctx.beginPath();ctx.roundRect(91,113,4,102,2);ctx.fill();
      ctx.restore();
      ctx.lineWidth=2;ctx.strokeStyle='#b7a3d9aa';ctx.stroke(jar);
      ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(95,99);ctx.bezierCurveTo(77,106,69,115,69,132);ctx.stroke();
      ctx.fillStyle=lid;ctx.beginPath();ctx.roundRect(87,44,126,28,8);ctx.fill();
      ctx.strokeStyle='#71548c50';ctx.lineWidth=1;for(let x=95;x<210;x+=7){ctx.beginPath();ctx.moveTo(x,51);ctx.lineTo(x,65);ctx.stroke()}
      ctx.fillStyle='#f4eafb';ctx.beginPath();ctx.ellipse(150,45,60,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e5cff580';ctx.beginPath();ctx.roundRect(93,75,114,5,2);ctx.fill();
    }
    function rest(){cancelAnimationFrame(raf);raf=0;running=false;m.classList.remove('is-swirling');button.setAttribute('aria-label','Stir the glitter jar');caption.textContent='Click the jar. Let your thoughts settle.';draw(1)}
    function frame(now){
      raf=0;if(disposed||!running||!visible||document.hidden)return;
      if(!m.isConnected){rest();return}
      const progress=Math.min(1,(now-start)/DURATION);draw(progress);
      if(progress>=1){rest();return}raf=requestAnimationFrame(frame);
    }
    function stir(){
      if(disposed)return;cancelAnimationFrame(raf);start=performance.now();running=true;
      m.classList.add('is-swirling');button.setAttribute('aria-label','Stir the glitter jar again');caption.textContent='Watch the glitter gently settle…';draw(0);raf=requestAnimationFrame(frame);
    }
    function resume(){if(running&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(frame)}
    button.addEventListener('click',stir);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(raf);raf=0}else resume()});observer.observe(m);
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else resume()};document.addEventListener('visibilitychange',visibility);
    // A saved board always opens calm; animation is transient, never an autosave loop.
    m._boardGetState=()=>({version:1});m._boardSetState=()=>rest();
    const priorDeactivate=m._deactivate;m._deactivate=()=>{rest();priorDeactivate?.()};
    const priorCleanup=m._cleanup;m._cleanup=()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);button.removeEventListener('click',stir);priorCleanup?.()};
    rest();
  }
  window.TeacherTilesGlitterJar=Object.freeze({setup});
})();
