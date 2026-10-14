function setupGrapher(m){
  const svg=m.querySelector('.grapher-svg');
  const equationInput=m.querySelector('.grapher-equation');
  const graphButton=m.querySelector('.grapher-graph-equation');
  const pointX=m.querySelector('.grapher-point-x');
  const pointY=m.querySelector('.grapher-point-y');
  const addPointButton=m.querySelector('.grapher-add-point');
  const clearPoints=m.querySelector('.grapher-clear-points');
  const coordinateReadout=m.querySelector('.grapher-coordinate-readout');
  const xminInput=m.querySelector('.grapher-xmin');
  const xmaxInput=m.querySelector('.grapher-xmax');
  const yminInput=m.querySelector('.grapher-ymin');
  const ymaxInput=m.querySelector('.grapher-ymax');
  const applyRange=m.querySelector('.grapher-apply-range');
  const error=m.querySelector('.grapher-error');

  let range={xmin:-10,xmax:10,ymin:-10,ymax:10};
  let points=[];
  let equation='x';

  const W=700,H=480,pad=34;
  const mapX=x=>pad+(x-range.xmin)/(range.xmax-range.xmin)*(W-pad*2);
  const mapY=y=>H-pad-(y-range.ymin)/(range.ymax-range.ymin)*(H-pad*2);
  const unmapX=px=>range.xmin+(px-pad)/(W-pad*2)*(range.xmax-range.xmin);
  const unmapY=py=>range.ymin+(H-pad-py)/(H-pad*2)*(range.ymax-range.ymin);

  const niceStep=span=>{
    const raw=span/10;
    const power=Math.pow(10,Math.floor(Math.log10(raw)));
    const normalized=raw/power;
    const nice=normalized<=1?1:normalized<=2?2:normalized<=5?5:10;
    return nice*power;
  };

  const compileEquation=raw=>{
    let expr=(raw||'').trim().toLowerCase().replace(/^y\s*=\s*/,'').replace(/\^/g,'**');
    if(!expr)throw new Error('Enter an equation.');

    const words=expr.match(/[a-z]+/g)||[];
    const allowed=new Set(['x','sin','cos','tan','sqrt','abs','log','ln','exp','floor','ceil','round','pi','e']);
    if(words.some(word=>!allowed.has(word)))throw new Error('Use x, numbers, + − × ÷, powers, and common functions.');

    if(!/^[0-9a-z+\-*/().,\s*]+$/.test(expr))throw new Error('That equation contains unsupported characters.');

    expr=expr
      .replace(/\bpi\b/g,'Math.PI')
      .replace(/\be\b/g,'Math.E')
      .replace(/\bln\b/g,'Math.log')
      .replace(/\b(sin|cos|tan|sqrt|abs|log|exp|floor|ceil|round)\b/g,'Math.$1');

    const fn=Function('x',`"use strict";return (${expr})`);
    const test=fn(0);
    if(typeof test!=='number')throw new Error('Could not graph that equation.');
    return fn;
  };

  const makeSvg=(tag,attrs={})=>{
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };

  const render=()=>{
    svg.replaceChildren();

    const plot=makeSvg('rect',{x:pad,y:pad,width:W-pad*2,height:H-pad*2,class:'grapher-plot-bg'});
    svg.appendChild(plot);

    const xStep=niceStep(range.xmax-range.xmin);
    const yStep=niceStep(range.ymax-range.ymin);

    const firstX=Math.ceil(range.xmin/xStep)*xStep;
    for(let x=firstX;x<=range.xmax+1e-9;x+=xStep){
      const px=mapX(x);
      const line=makeSvg('line',{x1:px,x2:px,y1:pad,y2:H-pad,class:Math.abs(x)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      const label=makeSvg('text',{x:px,y:Math.min(H-pad+20,Math.max(pad+14,mapY(0)+18)),class:'grapher-axis-label','text-anchor':'middle'});
      label.textContent=Number(x.toFixed(6)).toString();
      svg.appendChild(label);
    }

    const firstY=Math.ceil(range.ymin/yStep)*yStep;
    for(let y=firstY;y<=range.ymax+1e-9;y+=yStep){
      const py=mapY(y);
      const line=makeSvg('line',{x1:pad,x2:W-pad,y1:py,y2:py,class:Math.abs(y)<1e-9?'grapher-axis':'grapher-grid-line'});
      svg.appendChild(line);
      if(Math.abs(y)>1e-9){
        const label=makeSvg('text',{x:Math.min(W-pad-4,Math.max(pad+4,mapX(0)+7)),y:py-5,class:'grapher-axis-label'});
        label.textContent=Number(y.toFixed(6)).toString();
        svg.appendChild(label);
      }
    }

    try{
      const fn=compileEquation(equation);
      let d='';
      let drawing=false;

      for(let px=pad;px<=W-pad;px+=2){
        const x=unmapX(px);
        let y;
        try{y=fn(x)}catch{y=NaN}

        if(Number.isFinite(y)&&y>=range.ymin-(range.ymax-range.ymin)*.2&&y<=range.ymax+(range.ymax-range.ymin)*.2){
          const py=mapY(y);
          d+=`${drawing?'L':'M'}${px.toFixed(2)},${py.toFixed(2)}`;
          drawing=true;
        }else{
          drawing=false;
        }
      }

      if(d){
        const path=makeSvg('path',{d,class:'grapher-function'});
        svg.appendChild(path);
      }
      error.textContent='';
    }catch(err){
      error.textContent=err.message||'Could not graph that equation.';
    }

    points.forEach((point,index)=>{
      const group=makeSvg('g',{class:'grapher-point',tabindex:'0'});
      const circle=makeSvg('circle',{cx:mapX(point.x),cy:mapY(point.y),r:7});
      const label=makeSvg('text',{x:mapX(point.x)+10,y:mapY(point.y)-10});
      label.textContent=`(${Number(point.x.toFixed(2))}, ${Number(point.y.toFixed(2))})`;
      group.append(circle,label);
      group.addEventListener('click',event=>{
        event.stopPropagation();
        points.splice(index,1);
        render();
      });
      svg.appendChild(group);
    });

    svg.setAttribute('aria-label',`Coordinate plane from x ${range.xmin} to ${range.xmax} and y ${range.ymin} to ${range.ymax}.`);
  };

  const addPoint=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(x<range.xmin||x>range.xmax||y<range.ymin||y>range.ymax){
      error.textContent='That point is outside the current graph range.';
      return;
    }
    points.push({x,y});
    coordinateReadout.textContent=`Last point: (${Number(x.toFixed(2))}, ${Number(y.toFixed(2))})`;
    error.textContent='';
    render();
  };

  svg.addEventListener('click',event=>{
    if(event.target.closest?.('.grapher-point'))return;
    const rect=svg.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width*W;
    const py=(event.clientY-rect.top)/rect.height*H;
    if(px<pad||px>W-pad||py<pad||py>H-pad)return;
    addPoint(unmapX(px),unmapY(py));
  });

  addPointButton.addEventListener('click',()=>addPoint(Number(pointX.value),Number(pointY.value)));
  clearPoints.addEventListener('click',()=>{points=[];coordinateReadout.textContent='Click the plane to place points';render();});

  const graphEquation=()=>{
    equation=equationInput.value.trim()||'x';
    render();
  };
  graphButton.addEventListener('click',graphEquation);
  equationInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();graphEquation();}
  });

  applyRange.addEventListener('click',()=>{
    const next={
      xmin:Number(xminInput.value),xmax:Number(xmaxInput.value),
      ymin:Number(yminInput.value),ymax:Number(ymaxInput.value)
    };
    if(!Object.values(next).every(Number.isFinite)||next.xmin>=next.xmax||next.ymin>=next.ymax){
      error.textContent='Use valid minimum and maximum values.';
      return;
    }
    range=next;
    points=points.filter(p=>p.x>=range.xmin&&p.x<=range.xmax&&p.y>=range.ymin&&p.y<=range.ymax);
    error.textContent='';
    render();
  });

  m.querySelector('.grapher-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.grapher-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.grapher-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));

  m._boardGetState=()=>({range:{...range},points:points.map(point=>({...point})),equation});
  m._boardSetState=state=>{
    if(!state)return;
    if(state.range&&['xmin','xmax','ymin','ymax'].every(key=>Number.isFinite(Number(state.range[key])))){
      range={xmin:Number(state.range.xmin),xmax:Number(state.range.xmax),ymin:Number(state.range.ymin),ymax:Number(state.range.ymax)};
      xminInput.value=String(range.xmin);xmaxInput.value=String(range.xmax);yminInput.value=String(range.ymin);ymaxInput.value=String(range.ymax);
    }
    points=Array.isArray(state.points)?state.points.filter(point=>Number.isFinite(Number(point.x))&&Number.isFinite(Number(point.y))).map(point=>({x:Number(point.x),y:Number(point.y)})):[];
    equation=typeof state.equation==='string'?state.equation:'x';
    equationInput.value=equation;
    render();
  };

  render();
}
