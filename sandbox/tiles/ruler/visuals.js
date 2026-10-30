(()=>{'use strict';
const config=unit=>unit==='cm'?{max:30,divisions:10}:{max:12,divisions:8};
function formatValue(unit,value){
 if(unit==='cm')return Number((Math.round(value*10)/10).toFixed(1))+' cm';
 const eighths=Math.round(value*8),whole=Math.floor(eighths/8),remainder=eighths%8;
 if(!remainder)return whole+' in';
 const divisor=remainder%4===0?4:remainder%2===0?2:1;
 return (whole?whole+' ':'')+(remainder/divisor)+'/'+(8/divisor)+' in';
}
function drawScale(m,unit){
 const face=m.querySelector('.ruler-face'),stage=m.querySelector('.ruler-stage'),svg=m.querySelector('.ruler-svg');
      const {max,divisions}=config(unit);
      const total=max*divisions;

      const width=Math.max(320,Math.round(face.clientWidth||stage.clientWidth||760));
      const height=Math.max(82,Math.round(face.clientHeight||98));
      const baseline=height;
      const labelY=Math.max(17,Math.round(height*.22));

      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.replaceChildren();

      const make=(tag,attrs={})=>{
        const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
        Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
        return el;
      };

      const cmLabelEvery=width<590?5:width<820?2:1;

      for(let step=0;step<=total;step++){
        const x=step/total*width;
        const fraction=step/divisions;
        const isMajor=step%divisions===0;

        let tickHeight;
        if(unit==='in'){
          const eighth=step%8;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :eighth===4
              ?Math.round(height*.40)
              :eighth%2===0
                ?Math.round(height*.30)
                :Math.round(height*.22);
        }else{
          const tenth=step%10;
          tickHeight=isMajor
            ?Math.round(height*.55)
            :tenth===5
              ?Math.round(height*.38)
              :Math.round(height*.23);
        }

        svg.appendChild(make('line',{
          x1:x,
          x2:x,
          y1:baseline-tickHeight,
          y2:baseline,
          class:isMajor?'ruler-tick ruler-tick--major':'ruler-tick'
        }));

        const showLabel=isMajor&&(
          unit==='in'||
          Math.round(fraction)%cmLabelEvery===0
        );

        if(showLabel){
          const label=make('text',{
            x,
            y:labelY,
            'text-anchor':step===0?'start':step===total?'end':'middle',
            class:'ruler-scale-label'
          });
          label.textContent=String(Math.round(fraction));
          svg.appendChild(label);
        }
      }
}
function preview(m,state={}){
 m.classList.add('ruler-preview');const unit=state.unit==='cm'?'cm':'in',max=config(unit).max;
 const a=Number.isFinite(Number(state.a))?Math.max(0,Math.min(1,Number(state.a))):0,b=Number.isFinite(Number(state.b))?Math.max(0,Math.min(1,Number(state.b))):1;
 m.dataset.rulerUnit=unit;
 m.querySelector('.ruler-measurement').textContent=formatValue(unit,Math.abs(b-a)*max);
 for(const [which,value]of [['a',a],['b',b]]){m.querySelector('[data-ruler-handle="'+which+'"]').style.setProperty('--ruler-position',value*100+'%');m.querySelector('.ruler-'+which+'-value').textContent=formatValue(unit,value*max);}
 requestAnimationFrame(()=>{if(m.isConnected)drawScale(m,unit)});
}
window.TeacherTilesRulerVisuals=Object.freeze({drawScale,formatValue,preview});
})();
