// Shared hill-course artwork and racer layout for live tiles and saved previews.
(function(){
  function visual(name,classId){
    if(typeof studentProfileVisual==='function')return studentProfileVisual(name,classId);
    let hash=0;for(const c of `${classId}:${name}`)hash=(hash*31+c.codePointAt(0))>>>0;
    return{hue:hash%360,initials:name.trim().slice(0,1).toLocaleUpperCase()};
  }
  function layout(container){
    const tracks=[...container.querySelectorAll('.racer-track')];if(!tracks.length)return;
    const width=container.parentElement?.clientWidth||parseFloat(container.closest('.module')?.style.width)||680;
    const height=container.clientHeight||440;
    container.style.minWidth='0';
    const large=width>=1000;
    const token=large?94:64;
    const avatar=Math.max(20,Math.min(large?58:40,token-12,height/tracks.length*.68-36));
    container.style.setProperty('--racer-token-width',token+'px');container.style.setProperty('--racer-avatar-size',avatar+'px');
    tracks.forEach(track=>{
      const nodes=[...track.querySelectorAll('.racer-standee')],edge=token/2+26,room=width-2*edge;
      // Keep progress anchored to the course; fan nearby standees without changing distance.
      const ordered=nodes.map(node=>({node,x:edge+room*Number(node.dataset.progress||0)})).sort((a,b)=>a.x-b.x),groups=[];
      for(const item of ordered){const group=groups[groups.length-1];if(group&&item.x-group[group.length-1].x<token*.55)group.push(item);else groups.push([item]);}
      for(const group of groups)group.forEach(({node,x},i)=>{
        const fan=group.length>1?(i/(group.length-1)-.5)*2:0,t=x/width;
        node.style.left=`${t*100}%`;node.style.top=`${84.375-62.5*t*(1-t)}%`;
        node.style.setProperty('--racer-fan-angle',`${fan*12}deg`);
        node.style.setProperty('--racer-fan-offset',`${fan*10}px`);
      });
    });
  }
  function render(container,roster,progress={},keyFor=name=>'student:'+name.trim().toLowerCase()){
    const names=roster.students||[],count=names.length<=9?3:4;
    const previous=new Map([...container.querySelectorAll('.racer-standee')].map(n=>[n.dataset.student,n]));
    if(container.querySelectorAll('.racer-track').length!==count){
      container.replaceChildren();
      const scene=document.createElementNS('http://www.w3.org/2000/svg','svg');scene.classList.add('racer-course-art');scene.setAttribute('viewBox','0 0 1000 600');scene.setAttribute('preserveAspectRatio','none');scene.setAttribute('aria-hidden','true');
      const colors=['#e0eac3','#d0e2ad','#bdd69b','#a9c88a'];
      scene.innerHTML=Array.from({length:count},(_,i)=>{const h=600/count,y=i*h+135/160*h,control=i*h+35/160*h,curve=`M0 ${y}Q500 ${control} 1000 ${y}`;return `<path fill="${colors[i]}" d="${curve}V600H0Z"/><path class="racer-hill-edge" d="${curve}"/><path class="racer-hill-path" d="${curve}"/><path class="racer-hill-dashes" d="${curve}"/>`;}).join('');
      container.append(scene);
      for(let i=0;i<count;i++){
        const track=document.createElement('div');track.className='racer-track';track.style.setProperty('--hill-index',i);
        track.innerHTML='<span class="racer-track-flag" aria-hidden="true"></span>';
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
