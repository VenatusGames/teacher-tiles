function setupShapes(m){
  const picker=m.querySelector('.shapes-picker');
  const stage=m.querySelector('.shapes-stage');
  const path=m.querySelector('.shapes-path');
  const visual=m.querySelector('.shapes-visual');
  const title=m.querySelector('.shapes-title');
  const index=m.querySelector('.shapes-index');
  const name=m.querySelector('.shapes-name');
  const sides=m.querySelector('.shapes-sides');
  const vertices=m.querySelector('.shapes-vertices');
  const family=m.querySelector('.shapes-family');
  const fact=m.querySelector('.shapes-fact');
  const svgNs='http://www.w3.org/2000/svg';

  const setShape=(shapeId,{animate=true}={})=>{
    const shape=SHAPES_TILE_DATA.find(item=>item.id===shapeId)||SHAPES_TILE_DATA[0];
    m.dataset.shape=shape.id;
    path.setAttribute('d',shape.path);
    visual.setAttribute('aria-label',shape.name);
    title.textContent=shape.name;
    name.textContent=shape.name;
    index.textContent=`${SHAPES_TILE_DATA.indexOf(shape)+1} / ${SHAPES_TILE_DATA.length}`;
    sides.textContent=shape.sides;
    vertices.textContent=shape.vertices;
    family.textContent=shape.family;
    fact.textContent=shape.fact;
    picker.querySelectorAll('[data-shape-choice]').forEach(button=>{
      const active=button.dataset.shapeChoice===shape.id;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(animate&&stage.animate)stage.animate([
      {opacity:.55,transform:'scale(.94) translateY(4px)'},
      {opacity:1,transform:'scale(1.015) translateY(0)',offset:.72},
      {opacity:1,transform:'scale(1) translateY(0)'}
    ],{duration:330,easing:'cubic-bezier(.2,.85,.25,1)'});
  };

  SHAPES_TILE_DATA.forEach(shape=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='shapes-choice';
    button.dataset.shapeChoice=shape.id;
    button.setAttribute('aria-label',`Show ${shape.name}`);
    const icon=document.createElementNS(svgNs,'svg');
    icon.setAttribute('viewBox','0 0 240 200');
    icon.setAttribute('aria-hidden','true');
    const iconPath=document.createElementNS(svgNs,'path');
    iconPath.setAttribute('d',shape.path);
    icon.appendChild(iconPath);
    const label=document.createElement('span');
    label.textContent=shape.name;
    button.append(icon,label);
    button.addEventListener('click',()=>setShape(shape.id));
    picker.appendChild(button);
  });

  m.querySelector('.shapes-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.shapes-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.shapes-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m.querySelector('.shapes-color').addEventListener('click',()=>cycleData(m,'shapeColor',['blue','green','amber','rose','purple','teal']));

  setShape(m.dataset.shape,{animate:false});
  m._boardGetState=()=>({shape:m.dataset.shape||'circle'});
  m._boardSetState=state=>setShape(state?.shape||m.dataset.shape,{animate:false});
}
