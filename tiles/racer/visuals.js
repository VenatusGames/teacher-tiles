// Shared hill-course artwork and racer layout for live tiles and saved previews.
(function(){
  function visual(name,classId){
    if(typeof studentProfileVisual==='function')return studentProfileVisual(name,classId);
    let hash=0;for(const c of `${classId}:${name}`)hash=(hash*31+c.codePointAt(0))>>>0;
    return{hue:hash%360,initials:name.trim().slice(0,1).toLocaleUpperCase()};
  }
  function layout(container){
    const tracks=[...container.querySelectorAll('.racer-track')];if(!tracks.length)return;
    const hostWidth=container.parentElement?.clientWidth||parseFloat(container.closest('.module')?.style.width)||680;
    const height=container.clientHeight||440,maxCount=Math.max(...tracks.map(t=>t.querySelectorAll('.racer-standee').length));
    // Exceptionally large rosters can scroll across the hills rather than leave the tile bounds.
    const width=Math.max(hostWidth,maxCount*40+34);
    container.style.minWidth=width>hostWidth?width+'px':'0';
    const large=hostWidth>=1000;
    const token=Math.max(32,Math.min(large?94:64,(width-34)/Math.max(1,maxCount)-8));
    const avatar=Math.max(20,Math.min(large?58:40,token-12,height/tracks.length*.68-36));
    container.style.setProperty('--racer-token-width',token+'px');container.style.setProperty('--racer-avatar-size',avatar+'px');
    tracks.forEach(track=>{
      const nodes=[...track.querySelectorAll('.racer-standee')],edge=token/2+10,room=width-2*edge;
      const spacing=token+7,cluster=Math.min(room*.5,Math.max(0,nodes.length-1)*spacing),travel=room-cluster;
      const positions=nodes.map((node,i)=>({node,x:edge+(nodes.length>1?i*cluster/(nodes.length-1):0)+travel*Number(node.dataset.progress||0)})).sort((a,b)=>a.x-b.x);
      // Keep cards separate when students catch one another, without changing saved distance.
      for(let i=1;i<positions.length;i++)positions[i].x=Math.max(positions[i].x,positions[i-1].x+spacing);
      if(positions.length){positions.at(-1).x=Math.min(width-edge,positions.at(-1).x);for(let i=positions.length-2;i>=0;i--)positions[i].x=Math.min(positions[i].x,positions[i+1].x-spacing);}
      positions.forEach(({node,x})=>{const t=x/width;node.style.left=`${t*100}%`;node.style.top=`${84.375-62.5*t*(1-t)}%`;});
    });
  }
  function render(container,roster,progress={},keyFor=name=>'student:'+name.trim().toLowerCase()){
    const names=roster.students||[],count=names.length<=9?3:4;
    const previous=new Map([...container.querySelectorAll('.racer-standee')].map(n=>[n.dataset.student,n]));
    if(container.querySelectorAll('.racer-track').length!==count){
      container.replaceChildren();
      for(let i=0;i<count;i++){
        const track=document.createElement('div');track.className='racer-track';track.style.setProperty('--hill-index',i);
        track.innerHTML='<svg class="racer-hill-art" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true"><path class="racer-hill-ground" d="M0 135Q500 35 1000 135V160H0Z"/><path class="racer-hill-edge" d="M0 135Q500 35 1000 135"/><path class="racer-hill-path" d="M0 135Q500 35 1000 135"/><path class="racer-hill-dashes" d="M0 135Q500 35 1000 135"/></svg><span class="racer-track-flag" aria-hidden="true"></span>';
        container.append(track);
      }
    }
    container.style.setProperty('--racer-tracks',count);
    const tracks=[...container.querySelectorAll('.racer-track')],wanted=new Set(names);
    for(const [name,node] of previous)if(!wanted.has(name))node.remove();
    names.forEach((name,index)=>{
      const key=keyFor(name),percent=Math.max(0,Math.min(100,Number(progress.positions?.[key])||0));
      let node=previous.get(name);
      if(!node){
        node=document.createElement('button');node.type='button';node.className='racer-standee is-ready';node.dataset.student=name;
        node.innerHTML='<span class="racer-character"><span class="racer-student-avatar" aria-hidden="true"></span><strong class="racer-rider-name"></strong></span><span class="racer-stick" aria-hidden="true"></span><span class="racer-winner-mark" aria-hidden="true">★</span>';
        node.querySelector('.racer-rider-name').textContent=name;
      }
      const track=tracks[index%count];if(node.parentElement!==track)track.append(node);
      const profile=roster.studentProfiles?.[key],v=visual(name,roster.id||'');
      const image=profile?.image||'',symbol=profile?.emoji||v.initials;
      node.style.setProperty('--avatar-hue',String(v.hue));
      if(node._profileImage!==image||node._profileSymbol!==symbol){
        const avatar=node.querySelector('.racer-student-avatar');avatar.replaceChildren();
        if(image){const img=document.createElement('img');img.src=image;img.alt='';img.decoding='async';avatar.append(img)}else avatar.textContent=symbol;
        node._profileImage=image;node._profileSymbol=symbol;
      }
      node.dataset.progress=String(percent/100);
      const wins=progress.studentWins?.[key]||0,finished=Boolean(progress.finished?.[key]);
      node.classList.toggle('is-finished',finished);
      node.title=`${name} • ${Math.round(percent)}% • ${wins} Race ${wins===1?'Win':'Wins'}`;
      node.setAttribute('aria-label',`Select ${name}, ${Math.round(percent)}% complete, ${wins} Race ${wins===1?'Win':'Wins'}`);
    });
    container.querySelector('.racer-empty')?.remove();
    if(!names.length){const empty=document.createElement('p');empty.className='racer-empty';empty.textContent='Add students to this class to start the race';container.append(empty)}
    layout(container);
  }
  window.TeacherTilesRacerVisuals={render,layout};
})();
