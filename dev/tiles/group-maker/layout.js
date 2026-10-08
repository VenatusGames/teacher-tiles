/* Keep every group visible without stretching cards beyond their contents. */
function createGroupMakerLayout(results){
  let frame=0,disposed=false;
  function fit(){
    frame=0;
    if(disposed||!results.isConnected)return;
    const grid=results.querySelector('.groupmaker-grid');if(!grid)return;
    const count=grid.children.length,width=results.clientWidth-4,height=results.clientHeight-4;
    if(!count||width<=0||height<=0)return;
    let best=null;
    // Test column counts against actual wrapped text, rather than estimating names' heights.
    for(let columns=1;columns<=count;columns++){
      const naturalWidth=Math.max(width,columns*150+(columns-1)*8);
      grid.style.width=`${naturalWidth}px`;
      grid.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;
      const naturalHeight=grid.offsetHeight;
      const scale=Math.min(1,width/naturalWidth,height/Math.max(1,naturalHeight));
      const cardWidth=(naturalWidth-(columns-1)*8)/columns*scale;
      const penalty=Math.abs(cardWidth-200);
      if(!best||scale>best.scale+.005||(Math.abs(scale-best.scale)<=.005&&penalty<best.penalty))best={columns,naturalWidth,scale,penalty};
      // More columns cannot improve once width alone makes them smaller than the best fit.
      if(width/((columns+1)*150+columns*8)<best.scale-.005)break;
    }
    grid.style.width=`${best.naturalWidth}px`;
    grid.style.gridTemplateColumns=`repeat(${best.columns},minmax(0,1fr))`;
    grid.style.transform=`scale(${best.scale})`;
    grid.style.left=`${2+(width-best.naturalWidth*best.scale)/2}px`;
  }
  const refresh=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  const observer=new ResizeObserver(refresh);observer.observe(results);
  document.fonts?.ready.then(refresh);
  document.fonts?.addEventListener('loadingdone',refresh);
  return {refresh,cleanup(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.fonts?.removeEventListener('loadingdone',refresh)}};
}
