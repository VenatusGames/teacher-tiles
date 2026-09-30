function setupWorldMap(m){
  const states=m.dataset.type==='usstates';
  const tileTitle=bindEditableModuleTitle(m,'.worldmap-title',states?'50 States':'Explore the World');
  const stage=m.querySelector('.worldmap-stage');
  const mapLayer=m.querySelector('.worldmap-map-layer');
  const countries=m.querySelector('.worldmap-countries');
  const legend=m.querySelector('.worldmap-legend');
  const kicker=m.querySelector('.worldmap-kicker');
  const name=m.querySelector('.worldmap-name');
  const hemisphere=m.querySelector('.worldmap-hemisphere');
  const fact=m.querySelector('.worldmap-fact');
  let selected='';
  let selectedCountry='';
  let zoom=1;
  let centerX=500;
  let centerY=260;
  let pendingCountry='';
  let suppressMapClickUntil=0;
  const controller=new AbortController();
  const continentViews={
    'north-america':{x:205,y:145,zoom:1.65},'south-america':{x:300,y:330,zoom:1.75},europe:{x:515,y:145,zoom:2.35},africa:{x:520,y:285,zoom:1.8},asia:{x:710,y:165,zoom:1.5},australia:{x:825,y:350,zoom:2.05},antarctica:{x:500,y:462,zoom:1.55}
  };
  const constrainCenter=()=>{
    const halfWidth=500/zoom;
    const halfHeight=260/zoom;
    centerX=clamp(centerX,halfWidth,1000-halfWidth);
    centerY=clamp(centerY,halfHeight,520-halfHeight);
  };
  const applyZoom=()=>{
    constrainCenter();
    mapLayer.setAttribute('transform',`translate(${500-centerX*zoom} ${260-centerY*zoom}) scale(${zoom})`);
  };
  const selectRegion=(id,{animate=true}={})=>{
    const region=WORLD_MAP_REGIONS.find(item=>item.id===id);
    if(!region)return;
    selected=region.id;
    selectedCountry='';
    countries.querySelectorAll('[data-country-id]').forEach(path=>path.classList.remove('is-selected'));
    legend.querySelectorAll('[data-map-legend]').forEach(button=>button.classList.toggle('is-active',button.dataset.mapLegend===selected));
    kicker.textContent='CONTINENT VIEW';
    name.textContent=region.name;
    hemisphere.textContent=region.hemisphere;
    fact.textContent=region.fact;
    const view=continentViews[id];
    if(view){centerX=view.x;centerY=view.y;zoom=view.zoom;applyZoom()}
    if(animate&&m.querySelector('.worldmap-info')?.animate)m.querySelector('.worldmap-info').animate([{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:230,easing:'ease-out'});
    notifyBoardChanged('world-map-region');
  };
  const selectCountry=(id,countryName,{notify=true}={})=>{
    selectedCountry=String(id||'');
    selected='';
    legend.querySelectorAll('[data-map-legend]').forEach(button=>button.classList.remove('is-active'));
    countries.querySelectorAll('[data-country-id]').forEach(path=>path.classList.toggle('is-selected',path.dataset.countryId===selectedCountry));
    kicker.textContent=states?'STATE':'COUNTRY';
    name.textContent=countryName||'Country';
    hemisphere.textContent=states?'United States of America':'Natural Earth country boundary';
    fact.textContent=states?'Scroll to zoom, drag to explore, or choose another state. Alaska and Hawaii appear as insets.':'Click another country to compare its location, or use a continent button for a closer regional view.';
    if(notify)notifyBoardChanged('world-map-country');
  };
  const project=point=>states?[point[0]*.8+110,point[1]*.8+16]:[(point[0]+180)/360*1000,(90-point[1])/180*480+20];
  const renderTopology=topology=>{
    const scale=topology.transform?.scale||[1,1];
    const translate=topology.transform?.translate||[0,0];
    const decoded=topology.arcs.map(arc=>{
      let x=0,y=0;
      return arc.map(delta=>{x+=delta[0];y+=delta[1];return[x*scale[0]+translate[0],y*scale[1]+translate[1]]});
    });
    const pointsForArc=reference=>{
      const points=decoded[reference<0?~reference:reference]||[];
      return reference<0?[...points].reverse():points;
    };
    const ringPoints=references=>references.flatMap((reference,index)=>{const points=pointsForArc(reference);return index?points.slice(1):points});
    const ringPath=references=>{
      const points=ringPoints(references);
      if(!points.length)return'';
      const projected=points.map(project);
      for(let index=1;index<projected.length;index++){
        while(projected[index][0]-projected[index-1][0]>500)projected[index][0]-=1000;
        while(projected[index-1][0]-projected[index][0]>500)projected[index][0]+=1000;
      }
      return(states?[0]:[-1000,0,1000]).map(offset=>projected.map((point,index)=>`${index?'L':'M'}${(point[0]+offset).toFixed(2)} ${point[1].toFixed(2)}`).join('')+'Z').join('');
    };
    const geometryPath=geometry=>{
      const polygons=geometry.type==='Polygon'?[geometry.arcs]:geometry.type==='MultiPolygon'?geometry.arcs:[];
      return polygons.map(polygon=>polygon.map(ringPath).join('')).join('');
    };
    const svgNs='http://www.w3.org/2000/svg';
    const fragment=document.createDocumentFragment();
    for(const geometry of (states?topology.objects?.states:topology.objects?.countries)?.geometries||[]){
      if(states&&(Number(geometry.id)===11||Number(geometry.id)>56))continue;
      const path=document.createElementNS(svgNs,'path');
      const countryName=geometry.properties?.name||'Country';
      path.setAttribute('d',geometryPath(geometry));
      path.dataset.countryId=String(geometry.id||countryName);
      path.dataset.countryName=countryName;
      path.setAttribute('tabindex','0');
      path.setAttribute('role','button');
      path.setAttribute('aria-label',countryName);
      path.addEventListener('click',()=>{if(performance.now()>=suppressMapClickUntil)selectCountry(path.dataset.countryId,countryName)});
      path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCountry(path.dataset.countryId,countryName)}});
      fragment.appendChild(path);
    }
    countries.replaceChildren(fragment);
    if(states){const select=document.createElement('select');select.setAttribute('aria-label','Choose a state');select.innerHTML='<option value="">Choose a state…</option>';[...countries.children].sort((a,b)=>a.dataset.countryName.localeCompare(b.dataset.countryName)).forEach(path=>select.add(new Option(path.dataset.countryName,path.dataset.countryId)));select.onchange=()=>{const path=[...countries.children].find(p=>p.dataset.countryId===select.value);if(path)selectCountry(select.value,path.dataset.countryName)};legend.replaceChildren(select);}
    if(pendingCountry){
      const path=countries.querySelector(`[data-country-id="${CSS.escape(pendingCountry)}"]`);
      if(path)selectCountry(pendingCountry,path.dataset.countryName,{notify:false});
    }
  };
  (states?[]:WORLD_MAP_REGIONS).forEach(region=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.mapLegend=region.id;
    button.textContent=region.name;
    button.addEventListener('click',()=>selectRegion(region.id));
    legend.appendChild(button);
  });
  m.querySelectorAll('[data-map-zoom]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.mapZoom;
    if(action==='reset'){zoom=1;centerX=500;centerY=260;selected='';legend.querySelectorAll('[data-map-legend]').forEach(item=>item.classList.remove('is-active'))}
    else zoom=clamp(zoom+(action==='in' ? .2 : -.2),1,3.2);
    applyZoom();
    notifyBoardChanged('world-map-zoom');
  }));
  stage?.addEventListener('wheel',event=>{
    if(event.ctrlKey)return;
    event.preventDefault();
    event.stopPropagation();
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const pointerX=clamp((event.clientX-rect.left)/rect.width*1000,0,1000);
    const pointerY=clamp((event.clientY-rect.top)/rect.height*520,0,520);
    const mapX=centerX+(pointerX-500)/zoom;
    const mapY=centerY+(pointerY-260)/zoom;
    const delta=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*rect.height:event.deltaY;
    const next=clamp(Math.round(zoom*Math.exp(-delta*.0017)*20)/20,1,3.2);
    if(Math.abs(next-zoom)<.001)return;
    centerX=clamp(mapX-(pointerX-500)/next,0,1000);
    centerY=clamp(mapY-(pointerY-260)/next,0,520);
    zoom=next;
    applyZoom();
    notifyBoardChanged('world-map-wheel-zoom');
  },{passive:false});
  stage?.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.stopPropagation();
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const pointerId=event.pointerId;
    const startX=event.clientX;
    const startY=event.clientY;
    const startCenterX=centerX;
    const startCenterY=centerY;
    let moved=false;
    const move=moveEvent=>{
      if(moveEvent.pointerId!==pointerId)return;
      const dx=moveEvent.clientX-startX;
      const dy=moveEvent.clientY-startY;
      if(!moved&&Math.hypot(dx,dy)<4)return;
      if(!moved){
        moved=true;
        stage.setPointerCapture?.(pointerId);
      }
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      m.classList.add('is-map-panning');
      centerX=startCenterX-dx/rect.width*1000/zoom;
      centerY=startCenterY-dy/rect.height*520/zoom;
      applyZoom();
    };
    const end=endEvent=>{
      if(endEvent.pointerId!==pointerId)return;
      stage.removeEventListener('pointermove',move);
      stage.removeEventListener('pointerup',end);
      stage.removeEventListener('pointercancel',end);
      m.classList.remove('is-map-panning');
      if(moved){
        suppressMapClickUntil=performance.now()+250;
        notifyBoardChanged('world-map-pan');
      }
    };
    stage.addEventListener('pointermove',move);
    stage.addEventListener('pointerup',end);
    stage.addEventListener('pointercancel',end);
  });
  m.querySelector('.worldmap-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.worldmap-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.worldmap-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  applyZoom();
  name.textContent=states?'Loading states…':'Loading world map…';
  fetch(states?'assets/us-states-albers-10m.json':'assets/world-countries-110m.json',{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('map-data');return response.json()}).then(topology=>{
    renderTopology(topology);
    if(!selected&&!pendingCountry){name.textContent=states?'50 States':'World Map';hemisphere.textContent=states?'United States of America':'Real Natural Earth boundaries';fact.textContent=states?'Click a state to select it. Scroll to zoom and drag to explore. Alaska and Hawaii are shown as insets.':'Click any country, or use a continent button to zoom and learn.'}
  }).catch(error=>{if(error?.name!=='AbortError'){name.textContent='Map unavailable';fact.textContent='The geographic boundary file could not be loaded.'}});
  m._boardGetState=()=>({title:tileTitle.get(),selected,selectedCountry,zoom,centerX,centerY});
  m._boardSetState=state=>{
    tileTitle.set(state?.title);
    zoom=clamp(Number(state?.zoom)||1,1,3.2);
    centerX=Number.isFinite(Number(state?.centerX))?Number(state.centerX):500;
    centerY=Number.isFinite(Number(state?.centerY))?Number(state.centerY):260;
    pendingCountry=String(state?.selectedCountry||'');
    applyZoom();
    if(state?.selected)selectRegion(state.selected,{animate:false});
  };
  const prior=m._cleanup;
  m._cleanup=()=>{prior?.();controller.abort()};
}
