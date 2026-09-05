(() => {
  'use strict';
  const dots={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  function value(){const n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(n[0]>=4294967292);return n[0]%6+1;}
  function layout(width,height,count){
    const gap=Math.max(6,Math.min(24,Math.min(width,height)*.06));
    let best={cols:1,rows:count,size:0,gap};
    for(let cols=1;cols<=count;cols++){
      const rows=Math.ceil(count/cols),size=Math.max(0,Math.min((width-gap*(cols-1))/cols,(height-gap*(rows-1))/rows));
      if(size>best.size)best={cols,rows,size,gap};
    }
    return best;
  }
  function setup(m){
    const faces=m.querySelector('.dice-faces'),result=m.querySelector('.dice-result'),add=m.querySelector('.dice-add'),remove=m.querySelector('.dice-remove');
    let values=[1],timeout=0;
    function fit(width=faces.clientWidth,height=faces.clientHeight){
      const grid=layout(width,height,values.length);
      faces.style.setProperty('--die-size',`${grid.size}px`);faces.style.setProperty('--dice-gap',`${grid.gap}px`);
      faces.style.gridTemplateColumns=`repeat(${grid.cols},var(--die-size))`;
      faces.style.gridTemplateRows=`repeat(${grid.rows},var(--die-size))`;
    }
    function render(){
      faces.replaceChildren();faces.dataset.count=String(values.length);
      values.forEach((v,i)=>{const die=document.createElement('button');die.type='button';die.className='dice-face';die.setAttribute('aria-label',`Die ${i+1}: ${v}. Roll dice`);die.style.setProperty('--die-delay',`${i*35}ms`);
        for(let p=0;p<9;p++){const dot=document.createElement('i');dot.className=dots[v].includes(p)?'pip':'pip is-empty';dot.setAttribute('aria-hidden','true');die.append(dot);}
        die.addEventListener('click',roll);faces.append(die);
      });
      result.textContent=values.length>1?`${values.join(' + ')} = ${values.reduce((a,b)=>a+b,0)}`:`Rolled ${values[0]}`;
      add.disabled=values.length>=4;remove.disabled=values.length<=1;
      fit();
    }
    function roll(){
      clearTimeout(timeout);m.classList.remove('dice-rolling');values=values.map(value);render();
      void faces.offsetWidth;m.classList.add('dice-rolling');
      result.textContent='Rolling…';timeout=setTimeout(()=>{m.classList.remove('dice-rolling');render();},650);
      notifyBoardChanged('dice-roll');
    }
    m.querySelector('.dice-roll').addEventListener('click',roll);
    add.addEventListener('click',()=>{if(values.length<4){values.push(1);render();notifyBoardChanged('dice-count');}});
    remove.addEventListener('click',()=>{if(values.length>1){values.pop();render();notifyBoardChanged('dice-count');}});
    m._boardGetState=()=>({values:[...values]});
    m._boardSetState=s=>{clearTimeout(timeout);m.classList.remove('dice-rolling');values=(Array.isArray(s?.values)?s.values:[1]).slice(0,4).map(v=>Number.isInteger(v)&&v>=1&&v<=6?v:1);if(!values.length)values=[1];render();};
    const resize=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;fit(width,height);});resize.observe(faces);
    const prior=m._cleanup;m._cleanup=()=>{clearTimeout(timeout);resize.disconnect();prior?.();};render();
  }
  window.TeacherTilesDice=Object.freeze({setup,value,layout});
})();
