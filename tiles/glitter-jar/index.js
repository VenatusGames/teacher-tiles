(() => {
  'use strict';
  const DURATION=30000;
  function setup(m){
    const button=m.querySelector('.glitter-jar-button'),canvas=button.querySelector('canvas'),caption=m.querySelector('.glitter-jar-caption');
    const ctx=canvas.getContext('2d');
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=300*dpr;canvas.height=380*dpr;ctx.scale(dpr,dpr);

    const jar=new Path2D('M88 68 L212 68 L212 83 C212 101 243 104 245 135 L245 293 Q245 339 202 342 L98 342 Q55 339 55 293 L55 135 C57 104 88 101 88 83 Z');
    const liquid=ctx.createLinearGradient(60,85,228,340);liquid.addColorStop(0,'#c493ef');liquid.addColorStop(.32,'#9964d1');liquid.addColorStop(.65,'#7744b5');liquid.addColorStop(1,'#482878');
    const glow=ctx.createRadialGradient(96,140,5,142,202,164);glow.addColorStop(0,'#eed9ff88');glow.addColorStop(.5,'#b889ed16');glow.addColorStop(1,'#28124e55');
    const glass=ctx.createLinearGradient(55,0,245,0);glass.addColorStop(0,'#ffffff60');glass.addColorStop(.07,'#ffffff05');glass.addColorStop(.85,'#ffffff00');glass.addColorStop(.97,'#27124855');glass.addColorStop(1,'#ffffff70');
    const lid=ctx.createLinearGradient(0,45,0,78);lid.addColorStop(0,'#d7d9de');lid.addColorStop(.18,'#f4f4f6');lid.addColorStop(.38,'#afb1bc');lid.addColorStop(.65,'#d7d8de');lid.addColorStop(1,'#828391');
    const colors=['#ffe8b8','#e3c9ff','#b798ed','#f2d5fa','#ffffff'];
    const particles=Array.from({length:720},()=>({angle:Math.random()*Math.PI*2,radius:8+Math.random()*81,y:100+Math.random()*213,baseX:66+Math.random()*168,baseY:317+Math.random()*20,size:Math.random()<.86?.35+Math.random()*.65:1.2+Math.random()*1.3,speed:.35+Math.random()*.65,color:colors[Math.floor(Math.random()*colors.length)]}));
    let start=0,raf=0,running=false,disposed=false,visible=true;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function draw(progress=1){
      const energy=(1-progress)**2,phase=(1-(1-progress)**3)*(reduced.matches?4:15),lift=1-progress**1.8;
      ctx.clearRect(0,0,300,380);
      ctx.fillStyle='#39275416';ctx.beginPath();ctx.ellipse(150,351,88,8,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.clip(jar);
      ctx.fillStyle='#d9c8ed';ctx.fillRect(50,65,200,280);
      ctx.fillStyle=liquid;ctx.beginPath();ctx.moveTo(50,91);ctx.bezierCurveTo(110,91+energy*Math.sin(phase)*5,190,91-energy*Math.sin(phase)*5,250,91);ctx.lineTo(250,350);ctx.lineTo(50,350);ctx.fill();
      ctx.fillStyle=glow;ctx.fillRect(50,92,200,260);
      // Soft curved currents, without hard bands through the liquid.
      for(let i=0;i<3;i++){
        const y=145+i*62+Math.sin(phase*.4+i)*12*energy;
        const current=ctx.createRadialGradient(115+Math.sin(phase*.25+i)*35,y,0,150,y,100);
        current.addColorStop(0,i%2?'#44217b00':'#e5bdff00');current.addColorStop(.45,i%2?'#44217b16':'#e5bdff25');current.addColorStop(1,'#bb92ed00');
        ctx.globalAlpha=energy;ctx.fillStyle=current;ctx.fillRect(55,93,190,250);
      }
      for(const p of particles){
        const a=p.angle+phase*p.speed,depth=.5+.5*Math.sin(a);
        const x=p.baseX*(1-lift)+(150+Math.cos(a)*p.radius)*lift;
        const y=p.baseY*(1-lift)+(p.y+Math.sin(a)*12*energy)*lift;
        ctx.globalAlpha=(.28+.65*depth)*(.7+.3*energy);ctx.fillStyle=p.color;
        if(p.size<1.1)ctx.fillRect(x,y,p.size,p.size);
        else{const size=p.size*(.65+.35*depth);ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size*.8,y-size*.25);ctx.lineTo(x+size*.6,y+size);ctx.lineTo(x-size,y+size*.4);ctx.closePath();ctx.fill()}
      }
      ctx.globalAlpha=1;ctx.fillStyle=glass;ctx.fillRect(50,65,200,280);
      ctx.strokeStyle='#f5e8ff55';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(150,92,63,3,0,0,Math.PI*2);ctx.stroke();
      const shine=ctx.createLinearGradient(65,0,85,0);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#ffffff40');shine.addColorStop(1,'#ffffff00');ctx.fillStyle=shine;ctx.beginPath();ctx.roundRect(65,133,20,170,10);ctx.fill();
      ctx.strokeStyle='#ffffff65';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(83,115);ctx.bezierCurveTo(66,130,63,147,64,171);ctx.stroke();
      ctx.strokeStyle='#eadfff50';ctx.beginPath();ctx.ellipse(150,330,78,6,0,0,Math.PI);ctx.stroke();ctx.restore();
      ctx.lineWidth=1.5;ctx.strokeStyle='#ae98ce88';ctx.stroke(jar);
      ctx.fillStyle=lid;ctx.beginPath();ctx.roundRect(79,46,142,32,8);ctx.fill();
      ctx.strokeStyle='#6b6a7955';ctx.lineWidth=1;for(const y of [61,67,73]){ctx.beginPath();ctx.moveTo(82,y);ctx.lineTo(218,y);ctx.stroke()}
      ctx.fillStyle='#e5e5e9';ctx.beginPath();ctx.ellipse(150,47,69,5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff99';ctx.stroke();
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
