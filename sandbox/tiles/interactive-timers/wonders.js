(() => {
  const names={firework:'Firework',ice:'Ice',icecream:'Ice Cream',ants:'Ants'};
  function create(stage){
    stage.innerHTML='<div class="scene-countdown">00:00</div><canvas class="wonder-canvas" aria-hidden="true"></canvas><div class="timer-story-caption"></div>';
    const canvas=stage.querySelector('canvas'),ctx=canvas.getContext('2d'),caption=stage.querySelector('.timer-story-caption');
    let mode='firework',state={progress:0,total:0,left:0,running:false},stamp=performance.now(),frame=0,finished=0,visible=true,dead=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const ellipse=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);ctx.fill()};
    const line=(points,color,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke()};
    function paint(now){
      frame=0;if(dead||stage.hidden||!visible)return;
      const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
      const ratio=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);const scale=Math.min(w/320,h/260);ctx.translate((w-320*scale)/2,(h-260*scale)/2);ctx.scale(scale,scale);
      const p=Math.min(1,Math.max(0,state.progress+(state.running?(now-stamp)/1000/Math.max(1,state.total):0))),q=1-p,t=reduced.matches?0:now/1000;
      ellipse(160,228,104,12,'#33415512');
      if(mode==='firework'){
        const burst=finished?Math.min(1,(now-finished)/1800):(p>=1?1:0);
        if(!finished&&p<1){
          ctx.fillStyle='#7867c8';ctx.beginPath();ctx.roundRect(133,94,54,108,8);ctx.fill();
          ctx.save();ctx.beginPath();ctx.rect(133,94,54,108);ctx.clip();for(let i=0;i<4;i++)line([[127,117+i*28],[192,91+i*28]],'#d8c9fb',12);ctx.restore();
          ctx.fillStyle='#ee7898';ctx.beginPath();ctx.moveTo(128,94);ctx.lineTo(160,51);ctx.lineTo(192,94);ctx.closePath();ctx.fill();line([[160,202],[160,225]],'#ab815e',6);
          line([[185,176],[222,189],[246,213]],'#9c7850',4);
          const x=246-61*p,y=213-37*p;line([[185,176],[x,y]],'#e6c590',3);
          if(state.running){ellipse(x,y,7+2*Math.sin(t*20),7,'#ffb72e');for(let i=0;i<6;i++){const a=t*4+i;line([[x+Math.cos(a)*10,y+Math.sin(a)*10],[x+Math.cos(a)*17,y+Math.sin(a)*17]],'#f4a640',2)}}
        }else{
          for(let i=0;i<36;i++){const a=i*Math.PI*2/36,r=22+burst*98,x=160+Math.cos(a)*r,y=122+Math.sin(a)*r+burst*burst*20;ctx.globalAlpha=Math.max(.2,1-burst*.75);line([[x-Math.cos(a)*14,y-Math.sin(a)*14],[x,y]],['#e57ba1','#a18ae0','#f5bf50','#62c9b7'][i%4],3);ellipse(x,y,2,2,'#fff')};ctx.globalAlpha=1;
        }
      }else if(mode==='ice'||mode==='icecream'){
        const cream=mode==='icecream';ellipse(160,219,30+78*p,5+12*p,cream?'#f3aecaba':'#8bd9ee80');
        if(cream){ctx.fillStyle='#dca269';ctx.beginPath();ctx.moveTo(121,128);ctx.lineTo(199,128);ctx.lineTo(160,219);ctx.closePath();ctx.fill();for(let i=0;i<5;i++)line([[129+i*10,143],[161+i*5,198-i*14]],'#b98148',2)}
        if(q>.005){ctx.save();ctx.translate(160,cream?134:216);ctx.scale(.6+.4*q,q);ctx.translate(-160,cream?-134:-216);
          if(cream){ellipse(160,111,53,47,'#f49dbd');ellipse(125,137,18,13,'#f49dbd');ellipse(160,141,22,13,'#f49dbd');ellipse(196,137,18,13,'#f49dbd');ellipse(145,90,20,10,'#ffcde1');for(let i=0;i<12;i++){const x=124+(i*29%73),y=92+(i*17%40);line([[x,y],[x+4,y+3]],['#fff4d2','#bd69b5','#8b645f'][i%3],3)}}
          else{const g=ctx.createLinearGradient(100,70,224,214);g.addColorStop(0,'#d5f7ff');g.addColorStop(1,'#60b9dd');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(96,69,128,147,25);ctx.fill();ctx.strokeStyle='#8bd4e9';ctx.lineWidth=3;ctx.stroke();line([[114,118],[114,92],[142,86]],'#f5fdff',7);ctx.fillStyle='#ffffff45';ctx.beginPath();ctx.roundRect(172,93,32,101,14);ctx.fill();line([[136,159],[150,146],[165,170]],'#e2faff99',3)}
          ctx.restore();
        }
        if(state.running&&p<1)for(let i=0;i<3;i++){const fall=(t*.55+i*.31)%1;ellipse(118+i*41,151+fall*61,3,5,cream?'#f19bbb':'#83d1e8')}
      }else{
        ellipse(160,154,92,67,'#f1ece1');ellipse(160,153,81,57,'#fffaf0');
        ctx.save();ctx.beginPath();ctx.rect(0,57,320,159*q);ctx.clip();ctx.fillStyle='#f6cb68';ctx.beginPath();ctx.moveTo(90,76);ctx.quadraticCurveTo(159,45,230,76);ctx.lineTo(160,218);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(92,75);ctx.quadraticCurveTo(160,44,228,75);ctx.strokeStyle='#c68b4e';ctx.lineWidth=16;ctx.lineCap='round';ctx.stroke();for(const [x,y]of [[128,100],[184,93],[154,128],[173,156],[149,179]]){ellipse(x,y,11,10,'#ce6758');ellipse(x-3,y-3,3,2,'#ef9980')}ctx.restore();
        for(let i=0;i<7;i++){const travel=(t*.16+i/7)%1,x=30+travel*260,y=234-19*Math.sin(travel*Math.PI);ctx.save();ctx.translate(x,y);ctx.rotate(-.15);for(let j=0;j<3;j++){const k=Math.sin(t*18+i+j)*2;line([[-4+j*4,0],[-8+j*5,-7-k]],'#64544b',1.3);line([[-4+j*4,0],[-8+j*5,7+k]],'#64544b',1.3)}ellipse(-7,0,5,3.8,'#54473e');ellipse(0,0,3,3,'#54473e');ellipse(6,0,3.5,3.5,'#54473e');line([[8,-2],[12,-5]],'#54473e',1);if(p>0&&p<1)ellipse(11,1,4,3,'#efbf61');ctx.restore()}
      }
      caption.textContent=finished||p>=1?({firework:'Time to celebrate!',ice:'All melted!',icecream:'All melted!',ants:'Every bite is gone!'})[mode]:names[mode];
      if(!reduced.matches&&(state.running||finished&&now-finished<2000))frame=requestAnimationFrame(paint);
    }
    const refresh=()=>{cancelAnimationFrame(frame);paint(performance.now())};
    const observer=new ResizeObserver(refresh);observer.observe(canvas);
    const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh()});visibility.observe(stage);
    return {setMode(next){mode=next;finished=0;refresh()},update(next){if(next.progress<state.progress||next.left>0)finished=0;state=next;stamp=performance.now();stage.querySelector('.scene-countdown').textContent=`${String(Math.floor(Math.max(0,Math.ceil(next.left))/60)).padStart(2,'0')}:${String(Math.max(0,Math.ceil(next.left))%60).padStart(2,'0')}`;refresh()},finish(){finished=performance.now();refresh()},destroy(){dead=true;cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect()}};
  }
  window.TeacherTilesTimerWonders={create};
})();
