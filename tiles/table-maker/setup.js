function setupTableMaker(m){
  const EDITOR_WIDTH=248;
  const EDITOR_HEIGHT=120;
  const COMPACT_WIDTH=520;
  const COMPACT_HEIGHT=450;
  const chart=m.querySelector('.table-maker-chart');
  const legend=m.querySelector('.table-maker-legend');
  const empty=m.querySelector('.table-maker-empty');
  const editor=m.querySelector('.table-maker-editor');
  const dataRows=m.querySelector('.table-maker-data-rows');
  const dataToggle=m.querySelector('.table-maker-data-toggle');
  const dataCount=dataToggle.querySelector('b');
  const addRowButton=m.querySelector('.table-maker-add-row');
  const totalNode=m.querySelector('.table-maker-summary strong');
  const status=m.querySelector('.table-maker-status');
  const typeButtons=[...m.querySelectorAll('[data-chart-type]')];
  let chartType='bar';
  let editorOpen=true;
  let expandedWidth=null;
  let expandedHeight=null;
  let resizeTimer=0;
  let rows=[
    {label:'Reading',value:18,color:TABLE_MAKER_COLORS[0]},
    {label:'Math',value:24,color:TABLE_MAKER_COLORS[1]},
    {label:'Science',value:14,color:TABLE_MAKER_COLORS[2]},
    {label:'Writing',value:20,color:TABLE_MAKER_COLORS[3]}
  ];

  const normalizeRows=value=>(Array.isArray(value)?value:[]).slice(0,12).map((row,index)=>({
    label:String(row?.label||`Category ${index+1}`).slice(0,28),
    value:Math.max(0,Math.min(999999,Number(row?.value)||0)),
    color:/^#[0-9a-f]{6}$/i.test(String(row?.color||''))?String(row.color):TABLE_MAKER_COLORS[index%TABLE_MAKER_COLORS.length]
  }));
  const displayLabel=value=>String(value||'Untitled').trim().slice(0,12)||'Untitled';
  const animateEditorSize=(targetWidth,targetHeight)=>{
    const width=Math.max(COMPACT_WIDTH,Math.round(Number(targetWidth)||m.offsetWidth));
    const height=Math.max(COMPACT_HEIGHT,Math.round(Number(targetHeight)||m.offsetHeight));
    if(Math.abs(m.offsetWidth-width)<1&&Math.abs(m.offsetHeight-height)<1)return;
    m.classList.remove('is-editor-resizing');
    void m.offsetWidth;
    m.classList.add('is-editor-resizing');
    m.style.width=`${width}px`;
    m.style.height=`${height}px`;
    m.style.left=`${clamp(m.offsetLeft,0,Math.max(0,BOARD_WIDTH-width))}px`;
    m.style.top=`${clamp(m.offsetTop,0,Math.max(0,BOARD_HEIGHT-height))}px`;
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>m.classList.remove('is-editor-resizing'),260);
  };
  const setEditorOpen=(open,{resize=false}={})=>{
    const next=Boolean(open);
    if(resize){
      const current=m.offsetWidth;
      const currentHeight=m.offsetHeight;
      if(next){
        const target=Math.max(Number(expandedWidth)||0,current);
        const targetHeight=Math.max(Number(expandedHeight)||0,currentHeight);
        expandedWidth=target;
        expandedHeight=targetHeight;
        animateEditorSize(target,targetHeight);
      }else{
        expandedWidth=current;
        expandedHeight=currentHeight;
        animateEditorSize(Math.max(COMPACT_WIDTH,current-EDITOR_WIDTH),Math.max(COMPACT_HEIGHT,currentHeight-EDITOR_HEIGHT));
      }
    }
    editorOpen=next;
    m.dataset.editorOpen=String(editorOpen);
    editor.hidden=!editorOpen;
    dataToggle.classList.toggle('is-active',editorOpen);
    dataToggle.setAttribute('aria-expanded',String(editorOpen));
    dataToggle.querySelector('span').textContent=editorOpen?'Hide Data':'Edit Data';
  };
  const addAxis=(maxValue,{left=54,right=22,top=22,bottom=53,width=600,height=340}={})=>{
    const plotWidth=width-left-right,plotHeight=height-top-bottom;
    for(let tick=0;tick<=4;tick++){
      const ratio=tick/4,y=top+plotHeight-(plotHeight*ratio);
      chart.appendChild(makeChartSvgNode('line',{x1:left,y1:y,x2:width-right,y2:y,class:'table-maker-grid-line'}));
      chart.appendChild(makeChartSvgNode('text',{x:left-10,y:y+4,'text-anchor':'end',class:'table-maker-axis-label'},Math.round(maxValue*ratio*100)/100));
    }
    chart.appendChild(makeChartSvgNode('line',{x1:left,y1:top,x2:left,y2:height-bottom,class:'table-maker-axis-line'}));
    chart.appendChild(makeChartSvgNode('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,class:'table-maker-axis-line'}));
    return{left,right,top,bottom,width,height,plotWidth,plotHeight};
  };
  const renderLegend=activeRows=>{
    legend.replaceChildren();
    activeRows.forEach(row=>{
      const item=document.createElement('span');
      item.innerHTML='<i></i><b></b>';
      item.querySelector('i').style.background=row.color;
      item.querySelector('b').textContent=row.label||'Untitled';
      legend.appendChild(item);
    });
  };
  const renderChart=()=>{
    chart.replaceChildren();
    const activeRows=rows.filter(row=>row.value>0);
    const total=rows.reduce((sum,row)=>sum+row.value,0);
    totalNode.textContent=Number.isInteger(total)?total.toLocaleString():total.toLocaleString(undefined,{maximumFractionDigits:2});
    dataCount.textContent=String(rows.length);
    status.textContent=`${rows.length} ${rows.length===1?'category':'categories'} · ${chartType==='donut'?'donut':chartType} chart`;
    empty.hidden=activeRows.length>0;
    chart.hidden=activeRows.length===0;
    renderLegend(activeRows);
    if(!activeRows.length)return;
    chart.setAttribute('aria-label',`${chartType} chart with ${activeRows.length} categories and total ${total}`);
    if(chartType==='bar'||chartType==='line'){
      const maxValue=chartNiceMaximum(Math.max(...activeRows.map(row=>row.value)));
      const frame=addAxis(maxValue);
      if(chartType==='bar'){
        const slot=frame.plotWidth/activeRows.length;
        const barWidth=Math.min(76,Math.max(16,slot*.62));
        activeRows.forEach((row,index)=>{
          const height=Math.max(2,(row.value/maxValue)*frame.plotHeight);
          const x=frame.left+slot*index+(slot-barWidth)/2,y=frame.top+frame.plotHeight-height;
          const group=makeChartSvgNode('g',{class:'table-maker-bar-group'});
          group.style.setProperty('--chart-delay',`${index*45}ms`);
          const rect=makeChartSvgNode('rect',{x,y,width:barWidth,height,rx:Math.min(9,barWidth/4),fill:row.color,class:'table-maker-bar'});
          const value=makeChartSvgNode('text',{x:x+barWidth/2,y:y-8,'text-anchor':'middle',class:'table-maker-value-label'},Number(row.value).toLocaleString());
          const label=makeChartSvgNode('text',{x:x+barWidth/2,y:frame.height-28,'text-anchor':'middle',class:'table-maker-x-label'},displayLabel(row.label));
          group.append(rect,value,label);chart.appendChild(group);
        });
      }else{
        const slot=activeRows.length===1?0:frame.plotWidth/(activeRows.length-1);
        const points=activeRows.map((row,index)=>({row,x:activeRows.length===1?frame.left+frame.plotWidth/2:frame.left+slot*index,y:frame.top+frame.plotHeight-(row.value/maxValue)*frame.plotHeight}));
        const linePath=points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
        const areaPath=`M${points[0].x} ${frame.height-frame.bottom} ${points.map(point=>`L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} L${points.at(-1).x} ${frame.height-frame.bottom} Z`;
        const area=makeChartSvgNode('path',{d:areaPath,fill:points[0].row.color,class:'table-maker-line-area'});
        const line=makeChartSvgNode('path',{d:linePath,fill:'none',stroke:points[0].row.color,class:'table-maker-line'});
        chart.append(area,line);
        points.forEach((point,index)=>{
          const dot=makeChartSvgNode('circle',{cx:point.x,cy:point.y,r:6,fill:point.row.color,class:'table-maker-point'});dot.style.setProperty('--chart-delay',`${index*55}ms`);
          chart.append(dot,makeChartSvgNode('text',{x:point.x,y:point.y-12,'text-anchor':'middle',class:'table-maker-value-label'},Number(point.row.value).toLocaleString()),makeChartSvgNode('text',{x:point.x,y:frame.height-28,'text-anchor':'middle',class:'table-maker-x-label'},displayLabel(point.row.label)));
        });
      }
      return;
    }
    const cx=300,cy=165,r=124;
    let angle=-Math.PI/2;
    activeRows.forEach((row,index)=>{
      const share=row.value/total;
      const next=angle+share*Math.PI*2;
      if(chartType==='donut'){
        const inner=75;
        if(share>.9999){
          const circle=makeChartSvgNode('circle',{cx,cy,r,fill:row.color,class:'table-maker-donut-segment'});
          circle.style.setProperty('--chart-delay',`${index*55}ms`);chart.appendChild(circle);
        }else{
          const outerStartX=cx+r*Math.cos(angle),outerStartY=cy+r*Math.sin(angle),outerEndX=cx+r*Math.cos(next),outerEndY=cy+r*Math.sin(next);
          const innerStartX=cx+inner*Math.cos(angle),innerStartY=cy+inner*Math.sin(angle),innerEndX=cx+inner*Math.cos(next),innerEndY=cy+inner*Math.sin(next);
          const path=makeChartSvgNode('path',{d:`M${outerStartX} ${outerStartY} A${r} ${r} 0 ${share>.5?1:0} 1 ${outerEndX} ${outerEndY} L${innerEndX} ${innerEndY} A${inner} ${inner} 0 ${share>.5?1:0} 0 ${innerStartX} ${innerStartY} Z`,fill:row.color,class:'table-maker-donut-segment'});
          path.style.setProperty('--chart-delay',`${index*55}ms`);chart.appendChild(path);
        }
      }else if(share>.9999){
        chart.appendChild(makeChartSvgNode('circle',{cx,cy,r,fill:row.color,class:'table-maker-pie-slice'}));
      }else{
        const startX=cx+r*Math.cos(angle),startY=cy+r*Math.sin(angle),endX=cx+r*Math.cos(next),endY=cy+r*Math.sin(next);
        const path=makeChartSvgNode('path',{d:`M${cx} ${cy} L${startX} ${startY} A${r} ${r} 0 ${share>.5?1:0} 1 ${endX} ${endY} Z`,fill:row.color,class:'table-maker-pie-slice'});
        path.style.setProperty('--chart-delay',`${index*55}ms`);chart.appendChild(path);
      }
      angle=next;
    });
    if(chartType==='donut'){
      chart.append(makeChartSvgNode('circle',{cx,cy,r:76,class:'table-maker-donut-hole'}),makeChartSvgNode('text',{x:cx,y:cy-3,'text-anchor':'middle',class:'table-maker-donut-total'},Number(total).toLocaleString()),makeChartSvgNode('text',{x:cx,y:cy+22,'text-anchor':'middle',class:'table-maker-donut-caption'},'TOTAL'));
    }
  };
  const renderEditor=()=>{
    dataRows.replaceChildren();
    rows.forEach((row,index)=>{
      const item=document.createElement('div');item.className='table-maker-data-row';
      const color=document.createElement('input');color.type='color';color.value=row.color;color.setAttribute('aria-label',`Color for ${row.label}`);
      const label=document.createElement('input');label.type='text';label.maxLength=28;label.value=row.label;label.placeholder=`Category ${index+1}`;label.setAttribute('aria-label',`Label for row ${index+1}`);
      const value=document.createElement('input');value.type='number';value.min='0';value.max='999999';value.step='any';value.value=String(row.value);value.setAttribute('aria-label',`Value for ${row.label}`);
      const remove=document.createElement('button');remove.type='button';remove.className='table-maker-remove-row';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${row.label}`);
      color.addEventListener('input',()=>{row.color=color.value;renderChart();notifyBoardChanged('table-maker-color')});
      label.addEventListener('input',()=>{row.label=label.value.slice(0,28);renderChart()});
      value.addEventListener('input',()=>{row.value=Math.max(0,Math.min(999999,Number(value.value)||0));renderChart()});
      remove.addEventListener('click',()=>{rows.splice(index,1);renderEditor();renderChart();notifyBoardChanged('table-maker-remove-row')});
      item.append(color,label,value,remove);dataRows.appendChild(item);
    });
    addRowButton.disabled=rows.length>=12;
    addRowButton.textContent=rows.length>=12?'12 row limit':'+ Add Data Row';
  };
  typeButtons.forEach(button=>button.addEventListener('click',()=>{
    chartType=['bar','line','pie','donut'].includes(button.dataset.chartType)?button.dataset.chartType:'bar';
    m.dataset.chartType=chartType;typeButtons.forEach(item=>{const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active))});renderChart();notifyBoardChanged('table-maker-type');
  }));
  dataToggle.addEventListener('click',()=>{setEditorOpen(!editorOpen,{resize:true});notifyBoardChanged('table-maker-editor')});
  m.querySelector('.table-maker-editor-close').addEventListener('click',()=>{setEditorOpen(false,{resize:true});notifyBoardChanged('table-maker-editor')});
  dataRows.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  addRowButton.addEventListener('click',()=>{
    if(rows.length>=12)return;
    rows.push({label:`Category ${rows.length+1}`,value:10,color:TABLE_MAKER_COLORS[rows.length%TABLE_MAKER_COLORS.length]});renderEditor();renderChart();notifyBoardChanged('table-maker-add-row');
    requestAnimationFrame(()=>{const field=dataRows.lastElementChild?.querySelector('input[type="text"]');if(field){enterModuleTextEdit(field);field.select()}});
  });
  m.querySelector('.table-maker-bg').addEventListener('click',()=>cycleData(m,'bg',['white','cream','blue','pink','green','lavender','charcoal']));
  m.querySelector('.table-maker-font').addEventListener('click',()=>cycleData(m,'font',FONT_OPTIONS));
  m.querySelector('.table-maker-text-color').addEventListener('click',()=>cycleData(m,'text',['dark','soft','blue','rose','white','cream']));
  m._boardGetState=()=>({chartType,editorOpen,expandedWidth:Math.round(Number(expandedWidth)||m.offsetWidth),expandedHeight:Math.round(Number(expandedHeight)||m.offsetHeight),rows:rows.map(row=>({...row}))});
  m._boardSetState=state=>{
    rows=normalizeRows(state?.rows);if(!rows.length&&Array.isArray(state?.rows))rows=[];
    chartType=['bar','line','pie','donut'].includes(state?.chartType)?state.chartType:'bar';
    expandedWidth=Number.isFinite(Number(state?.expandedWidth))?Math.max(COMPACT_WIDTH,Number(state.expandedWidth)):null;
    expandedHeight=Number.isFinite(Number(state?.expandedHeight))?Math.max(COMPACT_HEIGHT,Number(state.expandedHeight)):null;
    editorOpen=state?.editorOpen!==false;typeButtons.forEach(button=>{const active=button.dataset.chartType===chartType;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))});m.dataset.chartType=chartType;setEditorOpen(editorOpen);renderEditor();renderChart();
    if(!editorOpen&&(!expandedWidth||!expandedHeight))requestAnimationFrame(()=>{if(!editorOpen&&m.isConnected){expandedWidth=expandedWidth||m.offsetWidth;expandedHeight=expandedHeight||m.offsetHeight;animateEditorSize(Math.max(COMPACT_WIDTH,expandedWidth-EDITOR_WIDTH),Math.max(COMPACT_HEIGHT,expandedHeight-EDITOR_HEIGHT))}});
  };
  const previousCleanup=m._cleanup;
  m._cleanup=()=>{clearTimeout(resizeTimer);previousCleanup?.()};
  expandedWidth=m.offsetWidth;expandedHeight=m.offsetHeight;typeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartType===chartType)));setEditorOpen(true);renderEditor();renderChart();
}
