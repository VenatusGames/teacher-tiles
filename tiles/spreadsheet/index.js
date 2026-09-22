(() => {
  'use strict';
  const name=(r,c)=>String.fromCharCode(65+c)+(r+1);
  const coords=ref=>{const m=/^([A-Z])([1-9]\d?)$/.exec(ref);return m?[Number(m[2])-1,m[1].charCodeAt(0)-65]:null};
  function calculate(cells,ref,visiting=new Set(),cache=new Map()){
    if(cache.has(ref))return cache.get(ref);
    if(visiting.size>100)throw Error('#DEPTH!');
    if(visiting.has(ref))throw Error('#CYCLE!');
    const raw=String(cells[ref]??'');if(!raw.startsWith('='))return raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):raw;
    if(raw.includes('#REF!'))throw Error('#REF!');
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
    let rows=12,cols=6,cells={},selected='',columnWidths=[],rowHeights=[];
    const grid=m.querySelector('.sheet-grid'),formula=m.querySelector('.sheet-formula'),label=m.querySelector('.sheet-cell-name'),status=m.querySelector('.sheet-status');
    const display=(key,cache=new Map())=>{try{const v=calculate(cells,key,new Set(),cache);return typeof v==='number'?String(Number(v.toPrecision(12))):v}catch(e){return e.message}};
    function refresh(){const cache=new Map();grid.querySelectorAll('input').forEach(input=>{if(input!==document.activeElement)input.value=display(input.dataset.cell,cache);input.classList.toggle('has-error',String(input.value).startsWith('#'));input.classList.toggle('is-selected',input.dataset.cell===selected)});label.textContent=selected;status.textContent=`${rows} rows × ${cols} columns`}
    function update(key,value){if(!key)return;if(value)cells[key]=String(value).slice(0,2000);else delete cells[key];refresh();notifyBoardChanged('spreadsheet-edit')}
    function render(){
      const table=document.createElement('table');table.setAttribute('aria-label','Spreadsheet cells');const colgroup=document.createElement('colgroup');for(let c=-1;c<cols;c++){const col=document.createElement('col');col.style.width=(c<0?34:columnWidths[c]||96)+'px';colgroup.append(col)}table.append(colgroup);table.style.width=(34+Array.from({length:cols},(_,c)=>columnWidths[c]||96).reduce((a,b)=>a+b,0))+'px';const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(document.createElement('th'));
      for(let c=0;c<cols;c++){const th=document.createElement('th');th.scope='col';th.textContent=String.fromCharCode(65+c);th.dataset.column=c;addResizer(th,'column',c);tr.append(th)}head.append(tr);table.append(head);
      const body=document.createElement('tbody');for(let r=0;r<rows;r++){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=r+1;th.dataset.row=r;row.style.height=(rowHeights[r]||29)+'px';addResizer(th,'row',r);row.append(th);for(let c=0;c<cols;c++){const td=document.createElement('td'),input=document.createElement('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.dataset.cell=name(r,c);input.style.height=(rowHeights[r]||29)+'px';input.setAttribute('aria-label',name(r,c));td.append(input);row.append(td)}body.append(row)}table.append(body);grid.replaceChildren(table);refresh();
    }

    function addResizer(header,axis,index){
      const handle=document.createElement('button');handle.type='button';handle.className='sheet-resizer sheet-resizer--'+axis;handle.setAttribute('aria-label','Resize '+axis+' '+(axis==='column'?String.fromCharCode(65+index):index+1));
      handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);const start=axis==='column'?e.clientX:e.clientY,scale=m.getBoundingClientRect().width/m.offsetWidth,values=axis==='column'?columnWidths:rowHeights,initial=values[index]||(axis==='column'?96:29);
        const move=event=>{values[index]=Math.round(Math.max(axis==='column'?48:24,Math.min(axis==='column'?600:240,initial+((axis==='column'?event.clientX:event.clientY)-start)/scale)));const table=grid.querySelector('table');if(axis==='column'){table.querySelectorAll('col')[index+1].style.width=values[index]+'px';table.style.width=(34+Array.from({length:cols},(_,c)=>columnWidths[c]||96).reduce((a,b)=>a+b,0))+'px'}else{const row=table.tBodies[0].rows[index];row.style.height=values[index]+'px';row.querySelectorAll('input').forEach(input=>input.style.height=values[index]+'px')}};
        const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('lostpointercapture',end);notifyBoardChanged('spreadsheet-cell-resize')};handle.addEventListener('pointermove',move);handle.addEventListener('lostpointercapture',end);
      });header.append(handle);
    }
    function restructure(axis,index,remove){
      const count=axis==='row'?rows:cols,limit=axis==='row'?99:26;if(remove?count<=1:count>=limit)return;
      const shift=pos=>{const at=axis==='row'?0:1;if(remove&&pos[at]===index)return null;if(pos[at]>=index)pos[at]+=remove?-1:1;return pos};
      const next={};for(const [key,value] of Object.entries(cells)){const pos=shift(coords(key));if(!pos)continue;next[name(...pos)]=value.startsWith('=')?value.replace(/\b([A-Z][1-9]\d?)\b/gi,ref=>{const moved=shift(coords(ref.toUpperCase()));return moved&&moved[0]<99&&moved[1]<26?name(...moved):'#REF!'}):value}
      cells=next;const sizes=axis==='row'?rowHeights:columnWidths;sizes.length=count;sizes.splice(index,remove?1:0,...(remove?[]:[axis==='row'?29:96]));if(axis==='row')rows+=remove?-1:1;else cols+=remove?-1:1;
      const pos=coords(selected||'A1');selected=name(Math.min(pos[0],rows-1),Math.min(pos[1],cols-1));formula.value=cells[selected]||'';render();notifyBoardChanged('spreadsheet-structure');
    }
    const menu=document.createElement('div');menu.className='sheet-context-menu';menu.setAttribute('popover','manual');menu.setAttribute('role','menu');document.body.append(menu);
    const closeMenu=()=>{menu.hidePopover();menu.replaceChildren()};
    m.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();const cell=e.target.closest('[data-cell]'),header=e.target.closest('th');if(cell)selected=cell.dataset.cell;let [r,c]=coords(selected);if(header?.dataset.row!==undefined)r=Number(header.dataset.row);if(header?.dataset.column!==undefined)c=Number(header.dataset.column);refresh();formula.value=cells[selected]||'';closeMenu();(document.fullscreenElement===m?m:document.body).append(menu);
      for(const [title,axis,index,remove] of [['Insert row above','row',r,false],['Insert row below','row',r+1,false],['Delete row','row',r,true],['Insert column left','column',c,false],['Insert column right','column',c+1,false],['Delete column','column',c,true]]){const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('role','menuitem');const count=axis==='row'?rows:cols;button.disabled=remove?count<=1:count>=(axis==='row'?99:26);button.onclick=()=>{restructure(axis,index,remove);closeMenu()};menu.append(button)}
      menu.showPopover();menu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button:not(:disabled)')?.focus();
    });
    const outside=e=>{if(!menu.contains(e.target)){closeMenu();if(!(m.contains(e.target)&&e.target.closest?.('.sheet-grid input,.sheet-formula,.sheet-resizer'))){selected='';formula.value='';if(grid.contains(document.activeElement))document.activeElement.blur();refresh()}}};document.addEventListener('pointerdown',outside,true);menu.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){closeMenu();grid.querySelector('[data-cell="'+selected+'"]')?.focus()}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}});
    const cleanup=m._cleanup;m._cleanup=()=>{document.removeEventListener('pointerdown',outside,true);menu.remove();cleanup?.()};const deactivate=m._deactivate;m._deactivate=()=>{closeMenu();deactivate?.()};
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
    m.querySelector('.sheet-add-row').onclick=()=>{restructure('row',rows,false)};
    m.querySelector('.sheet-add-col').onclick=()=>{restructure('column',cols,false)};
    m.querySelector('.sheet-export').onclick=()=>{
      const csv=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{let v=display(name(r,c));if(/^[=+@\-]/.test(v)&&!Number.isFinite(Number(v)))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='spreadsheet.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    grid.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    m._boardGetState=()=>({version:2,rows,cols,cells:{...cells},columnWidths:Array.from({length:cols},(_,c)=>columnWidths[c]||96),rowHeights:Array.from({length:rows},(_,r)=>rowHeights[r]||29)});
    m._boardSetState=state=>{rows=Math.max(1,Math.min(99,Math.floor(Number(state?.rows)||12)));cols=Math.max(1,Math.min(26,Math.floor(Number(state?.cols)||6)));cells={};for(const [k,v] of Object.entries(state?.cells||{})){const pos=coords(k);if(pos&&pos[0]<rows&&pos[1]<cols)cells[k]=String(v).slice(0,2000)}columnWidths=Array.from({length:cols},(_,i)=>Math.max(48,Math.min(600,Number(state?.columnWidths?.[i])||96)));rowHeights=Array.from({length:rows},(_,i)=>Math.max(24,Math.min(240,Number(state?.rowHeights?.[i])||29)));selected='';formula.value='';render()};
    render();
  }
  window.TeacherTilesSpreadsheet=Object.freeze({setup,calculate});
})();
