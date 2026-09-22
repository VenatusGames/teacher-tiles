(() => {
  'use strict';
  const name=(r,c)=>String.fromCharCode(65+c)+(r+1);
  const coords=ref=>{const m=/^([A-Z])([1-9]\d?)$/.exec(ref);return m?[Number(m[2])-1,m[1].charCodeAt(0)-65]:null};
  function calculate(cells,ref,visiting=new Set(),cache=new Map()){
    if(cache.has(ref))return cache.get(ref);
    if(visiting.size>100)throw Error('#DEPTH!');
    if(visiting.has(ref))throw Error('#CYCLE!');
    const raw=String(cells[ref]??'');if(!raw.startsWith('='))return raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):raw;
    visiting.add(ref);
    try{
      const expr=raw.slice(1).toUpperCase().replace(/\s+/g,'');
      const tokens=expr.match(/(?:\d+(?:\.\d*)?|\.\d+)|[A-Z]+\d*|[+*/^(),:\-]/g)||[];
      if(tokens.join('')!==expr||tokens.length>500)throw Error('#FORMULA!');
      let at=0;
      const numeric=v=>{if(v==='')return 0;if(typeof v!=='number'||!Number.isFinite(v))throw Error('#VALUE!');return v};
      const value=key=>calculate(cells,key,new Set(visiting),cache);
      function atom(){
        const token=tokens[at++];
        if(token==='+'||token==='-')return (token==='-'?-1:1)*atom();
        if(token==='('){const v=expression();if(tokens[at++]!==')')throw Error('#FORMULA!');return v}
        if(/^(?:\d|\.)/.test(token||''))return Number(token);
        if(coords(token||''))return numeric(value(token));
        if(['SUM','AVERAGE','MIN','MAX','COUNT'].includes(token)&&tokens[at++]==='('){
          const args=[];
          while(tokens[at]!==')'){
            if(coords(tokens[at]||'')&&tokens[at+1]===':'){
              const a=coords(tokens[at]),b=coords(tokens[at+2]||'');if(!b)throw Error('#REF!');at+=3;
              for(let r=Math.min(a[0],b[0]);r<=Math.max(a[0],b[0]);r++)for(let c=Math.min(a[1],b[1]);c<=Math.max(a[1],b[1]);c++){const v=value(name(r,c));if(typeof v==='number')args.push(v)}
            }else args.push(expression());
            if(tokens[at]===','){at++;continue}if(tokens[at]!==')')throw Error('#FORMULA!');
          }
          at++;
          if(token==='COUNT')return args.length;
          if(!args.length)return 0;
          if(token==='MIN')return Math.min(...args);if(token==='MAX')return Math.max(...args);
          const sum=args.reduce((a,b)=>a+b,0);return token==='AVERAGE'?sum/args.length:sum;
        }
        throw Error('#FORMULA!');
      }
      function power(){let v=atom();if(tokens[at]==='^'){at++;v=v**power()}return v}
      function term(){let v=power();while(['*','/'].includes(tokens[at])){const op=tokens[at++],n=power();if(op==='/'&&n===0)throw Error('#DIV/0!');v=op==='*'?v*n:v/n}return v}
      function expression(){let v=term();while(['+','-'].includes(tokens[at])){const op=tokens[at++],n=term();v=op==='+'?v+n:v-n}return v}
      const result=expression();if(at!==tokens.length||!Number.isFinite(result))throw Error('#FORMULA!');cache.set(ref,result);return result;
    }finally{visiting.delete(ref)}
  }
  function setup(m){
    let rows=12,cols=6,cells={},selected='A1';
    const grid=m.querySelector('.sheet-grid'),formula=m.querySelector('.sheet-formula'),label=m.querySelector('.sheet-cell-name'),status=m.querySelector('.sheet-status');
    const display=(key,cache=new Map())=>{try{const v=calculate(cells,key,new Set(),cache);return typeof v==='number'?String(Number(v.toPrecision(12))):v}catch(e){return e.message}};
    function refresh(){const cache=new Map();grid.querySelectorAll('input').forEach(input=>{if(input!==document.activeElement)input.value=display(input.dataset.cell,cache);input.classList.toggle('has-error',String(input.value).startsWith('#'));input.classList.toggle('is-selected',input.dataset.cell===selected)});label.textContent=selected;status.textContent=`${rows} rows × ${cols} columns`}
    function update(key,value){if(value)cells[key]=String(value).slice(0,2000);else delete cells[key];refresh();notifyBoardChanged('spreadsheet-edit')}
    function render(){
      const table=document.createElement('table');table.setAttribute('aria-label','Spreadsheet cells');const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(document.createElement('th'));
      for(let c=0;c<cols;c++){const th=document.createElement('th');th.scope='col';th.textContent=String.fromCharCode(65+c);tr.append(th)}head.append(tr);table.append(head);
      const body=document.createElement('tbody');for(let r=0;r<rows;r++){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=r+1;row.append(th);for(let c=0;c<cols;c++){const td=document.createElement('td'),input=document.createElement('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.dataset.cell=name(r,c);input.setAttribute('aria-label',name(r,c));td.append(input);row.append(td)}body.append(row)}table.append(body);grid.replaceChildren(table);refresh();
    }
    grid.addEventListener('focusin',e=>{if(!e.target.dataset.cell)return;selected=e.target.dataset.cell;e.target.value=cells[selected]||'';formula.value=cells[selected]||'';refresh()});
    grid.addEventListener('input',e=>{if(e.target.dataset.cell){update(e.target.dataset.cell,e.target.value);formula.value=e.target.value}});
    grid.addEventListener('focusout',()=>requestAnimationFrame(refresh));
    grid.addEventListener('keydown',e=>{if(!e.target.dataset.cell)return;const [r,c]=coords(e.target.dataset.cell);if(e.key==='Enter'){e.preventDefault();grid.querySelector(`[data-cell="${name(Math.max(0,Math.min(rows-1,r+(e.shiftKey?-1:1))),c)}"]`)?.focus()}});
    grid.addEventListener('paste',e=>{
      const text=e.clipboardData?.getData('text/plain');if(!e.target.dataset.cell||!text||!/[\t\n]/.test(text))return;e.preventDefault();
      const [r,c]=coords(e.target.dataset.cell),data=text.replace(/\r/g,'').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
      rows=Math.min(99,Math.max(rows,r+data.length));cols=Math.min(26,Math.max(cols,c+Math.max(...data.map(line=>line.length))));
      data.slice(0,99-r).forEach((line,ri)=>line.slice(0,26-c).forEach((v,ci)=>{if(v)cells[name(r+ri,c+ci)]=v.slice(0,2000);else delete cells[name(r+ri,c+ci)]}));render();formula.value=cells[selected]||'';notifyBoardChanged('spreadsheet-paste');
      if(data.length+r>99||data.some(line=>line.length+c>26))status.textContent='Pasted up to the limit: 99 rows × 26 columns.';
    });
    formula.addEventListener('input',()=>update(selected,formula.value));formula.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();grid.querySelector(`[data-cell="${selected}"]`)?.focus()}});
    m.querySelector('.sheet-add-row').onclick=()=>{if(rows<99){rows++;render();notifyBoardChanged('spreadsheet-size')}};
    m.querySelector('.sheet-add-col').onclick=()=>{if(cols<26){cols++;render();notifyBoardChanged('spreadsheet-size')}};
    m.querySelector('.sheet-export').onclick=()=>{
      const csv=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{let v=display(name(r,c));if(/^[=+@\-]/.test(v)&&!Number.isFinite(Number(v)))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='spreadsheet.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    grid.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    m._boardGetState=()=>({version:1,rows,cols,cells:{...cells}});
    m._boardSetState=state=>{rows=Math.max(1,Math.min(99,Math.floor(Number(state?.rows)||12)));cols=Math.max(1,Math.min(26,Math.floor(Number(state?.cols)||6)));cells={};for(const [k,v] of Object.entries(state?.cells||{})){const pos=coords(k);if(pos&&pos[0]<rows&&pos[1]<cols)cells[k]=String(v).slice(0,2000)}selected='A1';formula.value=cells.A1||'';render()};
    render();
  }
  window.TeacherTilesSpreadsheet=Object.freeze({setup,calculate});
})();
