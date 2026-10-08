(() => {
  'use strict';
  const art='tiles/popsicle-sticks/assets/gumball-machine.svg';
  const colors=['#d64c69','#437ed1','#8a5fbd','#21977d','#cb7738','#ad549e'];
  function create(m,{preview=false}={}){
    const stage=m.querySelector('.popsicle-sticks-stage'),cup=m.querySelector('.popsicle-sticks-cup'),host=m.querySelector('.popsicle-sticks-drawn');
    const scene=document.createElement('div');scene.className='gumball-scene';scene.setAttribute('aria-hidden','true');
    scene.innerHTML=`<img class="gumball-machine-art" src="${art}" alt="" draggable="false"><span class="gumball-crank"><i></i></span>`;stage.prepend(scene);
    stage.setAttribute('aria-label','Gumball Machine name picker');cup.setAttribute('aria-label','Dispense a student gumball');cup.title='Dispense a Gumball';
    m.querySelector('.popsicle-sticks-title').textContent='Gumball Machine';
    m.querySelector('.popsicle-sticks-import>p').textContent='Load a class, then click the machine to dispense a student’s name.';
    m.querySelector('.popsicle-sticks-import__mark').innerHTML=`<img src="${art}" alt="" draggable="false">`;
    m.querySelector('.popsicle-sticks-change-class').textContent='Change Class';
    let lastId='',initial=true;
    function fitName(){
      const ball=host.querySelector('.gumball-result'),name=ball?.querySelector('.gumball-result-name');if(!name||!ball.clientWidth)return;
      let size=Math.min(26,ball.clientWidth*.19);name.style.overflowWrap='normal';
      name.style.fontSize=size+'px';
      while(size>10&&(name.scrollWidth>name.clientWidth+1||name.offsetHeight>ball.clientHeight*.64)){size-=.5;name.style.fontSize=size+'px'}
      name.style.overflowWrap='anywhere';
    }
    const resize=preview?null:new ResizeObserver(fitName);resize?.observe(host);
    function render(active,available,{animate=true}={}){
      cup.disabled=!!active||available===0;scene.classList.toggle('is-empty',available===0&&!active);
      m.classList.toggle('has-drawn-stick',!!active);
      if(!active){lastId='';host.replaceChildren();host.hidden=true;m.classList.remove('is-dispensing');initial=false;return;}
      host.hidden=false;
      if(lastId===active.id&&host.firstElementChild)return;
      const ball=document.createElement('div');ball.className='gumball-result';
      let hash=0;for(const c of active.name)hash=(hash*31+c.charCodeAt(0))>>>0;
      ball.style.setProperty('--gumball-color',colors[hash%colors.length]);
      const name=document.createElement('span');name.className='gumball-result-name';name.textContent=active.name;ball.append(name);
      if(active.name.length>22)ball.classList.add('has-long-name');
      host.replaceChildren(ball);lastId=active.id;
      m.classList.remove('is-dispensing');
      if(animate&&!initial){void m.offsetWidth;m.classList.add('is-dispensing')}
      initial=false;fitName();
    }
    return {render,destroy(){resize?.disconnect()}};
  }
  function preview(m,state={}){
    const renderer=create(m,{preview:true}),active=(state.sticks||[]).find(s=>s.id===state.drawnId),available=(state.sticks||[]).filter(s=>s.state!=='removed').length;
    m.querySelector('.popsicle-sticks-import').hidden=true;m.querySelector('.popsicle-sticks-dashboard').hidden=false;
    m.querySelector('.popsicle-sticks-class-name').textContent=state.className||'Class';renderer.render(active,available,{animate:false});
  }
  window.TeacherTilesGumball={create,preview};
})();
