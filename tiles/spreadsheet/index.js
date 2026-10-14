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
    let rows=12,cols=6,cells={},selected='',rangeAnchor='',extending=false,columnWidths=[],rowHeights=[],formats={},pictures={},spellcheck=false;
    const formatUndo=[],formatRedo=[];let lastEditKey='',lastEditAt=0;const fonts=['Inter','Lexend','Poppins','Nunito','Quicksand','Oswald','Lora','Merriweather','Playfair Display','Caveat','Pacifico','DM Sans','Space Grotesk','Roboto Mono','Calibri'];
    const grid=m.querySelector('.sheet-grid'),formula=m.querySelector('.sheet-formula'),label=m.querySelector('.sheet-cell-name'),status=m.querySelector('.sheet-status');

    function selection(){if(!selected)return [];const a=coords(rangeAnchor||selected),b=coords(selected),keys=[];for(let r=Math.min(a[0],b[0]);r<=Math.max(a[0],b[0]);r++)for(let c=Math.min(a[1],b[1]);c<=Math.max(a[1],b[1]);c++)keys.push(name(r,c));return keys}
    function cleanFormat(f){const v={};if(!f||typeof f!=='object')return v;for(const k of ['bold','italic','underline','strike','wrap'])if(f[k])v[k]=true;if(fonts.includes(f.font))v.font=f.font;if(Number.isFinite(Number(f.size)))v.size=Math.max(10,Math.min(64,Number(f.size)));for(const k of ['color','highlight'])if(/^#[0-9a-f]{6}$/i.test(f[k]||''))v[k]=f[k];if(['left','center','right','justify'].includes(f.align))v.align=f.align;if(['p','h1','h2','h3','blockquote'].includes(f.block))v.block=f.block;return v}
    function paintFormat(input){const f=formats[input.dataset.cell]||{},size=f.size||({h1:28,h2:22,h3:18}[f.block])||12;Object.assign(input.style,{fontFamily:f.font||'inherit',fontSize:size+'px',fontWeight:f.bold||/^h[123]$/.test(f.block)?'700':'400',fontStyle:f.italic||f.block==='blockquote'?'italic':'normal',textDecoration:[f.underline?'underline':'',f.strike?'line-through':''].filter(Boolean).join(' ')||'none',textAlign:f.align||'left',color:f.color||'inherit',backgroundColor:f.highlight||'transparent',whiteSpace:'pre-wrap',paddingTop:pictures[input.dataset.cell]?Math.max(4,(rowHeights[coords(input.dataset.cell)[0]]||29)-27)+'px':'4px'});input.wrap='soft';input.spellcheck=spellcheck;
      let image=input.parentElement.querySelector('.sheet-cell-image');if(pictures[input.dataset.cell]){if(!image){image=document.createElement('img');image.className='sheet-cell-image';image.alt='Cell image';image.tabIndex=0;image.setAttribute('aria-label','Cell image. Press Delete to remove');image.dataset.imageCell=input.dataset.cell;input.before(image)}if(image.src!==pictures[input.dataset.cell])image.src=pictures[input.dataset.cell]}else image?.remove();
    }
    const formatBar=document.createElement('div');formatBar.className='sheet-format-toolbar';formatBar.setAttribute('role','toolbar');formatBar.setAttribute('aria-label','Spreadsheet formatting');m.querySelector('.sheet-toolbar').after(formatBar);
    const fields={};
    function remember(){if(typeof boardChangeSuspended!=='undefined'&&boardChangeSuspended)return;lastEditKey='';formatUndo.push(m._boardGetState());if(formatUndo.length>30)formatUndo.shift();formatRedo.length=0}
    function changed(){refresh();notifyBoardChanged('spreadsheet-format')}
    function apply(key,value){if(!selected)return;remember();for(const ref of selection()){formats[ref]=cleanFormat({...formats[ref],[key]:value});const row=coords(ref)[0],size=formats[ref].size||({h1:28,h2:22,h3:18}[formats[ref].block])||12;rowHeights[row]=Math.max(rowHeights[row]||29,size+16)}render();changed()}
    function selectField(key,label,options){const input=document.createElement('select');input.setAttribute('aria-label',label);input.title=label;for(const [value,name] of options){const option=document.createElement('option');option.value=value;option.textContent=name;input.append(option)}input.onchange=()=>apply(key,key==='size'?Number(input.value):input.value);fields[key]=input;formatBar.append(input)}
    selectField('block','Cell text style',[['p','Body'],['h1','Heading'],['h2','Subheading'],['h3','Section'],['blockquote','Quote']]);selectField('font','Cell font',fonts.map(f=>[f,f]));selectField('size','Cell font size',[10,12,14,16,18,22,28,36,48,64].map(n=>[n,String(n)]));
    function command(label,text,fn,key){const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label);button.title=label;button.textContent=text;if(key){button.dataset.format=key;button.setAttribute('aria-pressed','false')}button.onclick=fn;formatBar.append(button);return button}
    for(const [key,label,text] of [['bold','Bold','B'],['italic','Italic','I'],['underline','Underline','U'],['strike','Strikethrough','S']])command(label,text,()=>apply(key,!(formats[selected]||{})[key]),key);
    for(const [key,label,text,fallback] of [['color','Cell text color','A','#17191d'],['highlight','Cell highlight color','▰','#fff2a8']]){const labelNode=document.createElement('label');labelNode.className='sheet-color-control';labelNode.title=label;labelNode.textContent=text;const input=document.createElement('input');input.type='color';input.value=fallback;input.setAttribute('aria-label',label);input.addEventListener('input',()=>apply(key,input.value));labelNode.append(input);formatBar.append(labelNode);fields[key]=input}
    for(const [align,label,text] of [['left','Align left','≡←'],['center','Align center','≡'],['right','Align right','→≡']]){const b=command(label,text,()=>apply('align',align));b.dataset.align=align;b.setAttribute('aria-pressed','false')}
    for(const [numbered,label,text] of [[false,'Bulleted list','•≡'],[true,'Numbered list','1≡']])command(label,text,()=>{if(!selected)return;remember();for(const ref of selection()){if((cells[ref]||'').startsWith('='))continue;cells[ref]=(cells[ref]||'').split('\n').map((line,i)=>(numbered?(i+1)+'. ':'• ')+line.replace(/^(?:• |\d+\. )/, '')).join('\n');formats[ref]={...formats[ref],wrap:true};rowHeights[coords(ref)[0]]=Math.max(rowHeights[coords(ref)[0]]||29,Math.min(240,cells[ref].split('\n').length*20+10))}render();changed()});
    command('Undo spreadsheet edit','↶',()=>{if(!formatUndo.length)return;formatRedo.push(m._boardGetState());const anchor=selected,start=rangeAnchor;m._boardSetState(formatUndo.pop(),true);selected=anchor?name(Math.min(rows-1,coords(anchor)[0]),Math.min(cols-1,coords(anchor)[1])):'';rangeAnchor=start?name(Math.min(rows-1,coords(start)[0]),Math.min(cols-1,coords(start)[1])):selected;changed()});command('Redo spreadsheet edit','↷',()=>{if(!formatRedo.length)return;formatUndo.push(m._boardGetState());const anchor=selected;m._boardSetState(formatRedo.pop(),true);selected=rangeAnchor=anchor;changed()});command('Clear cell formatting','Tx',()=>{if(!selected)return;remember();for(const ref of selection())delete formats[ref];changed()});
    const notice=document.createElement('span');notice.className='sheet-format-notice';notice.setAttribute('role','status');formatBar.append(notice);
    const upload=document.createElement('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.hidden=true;upload.setAttribute('data-skip-board-save','');formatBar.append(upload);command('Insert cell image','Image',()=>{if(selected)upload.click()});
    upload.onchange=async()=>{const file=upload.files[0],keys=selection();upload.value='';if(!file||!keys.length)return;notice.textContent='';if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10000000){notice.textContent='Choose a PNG, JPG or WebP under 10 MB.';return}try{const bitmap=await createImageBitmap(file);if(!m.isConnected){bitmap.close();return}const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const url=canvas.toDataURL('image/webp',.8);if(url.length>=800000){notice.textContent='Choose a smaller image.';return}remember();for(const ref of keys){pictures[ref]=url;rowHeights[coords(ref)[0]]=Math.max(rowHeights[coords(ref)[0]]||29,110)}render();changed()}catch{notice.textContent='This image could not be opened.'}};
    const spell=command('Cell spellcheck','Spell',()=>{remember();spellcheck=!spellcheck;changed()});spell.dataset.spellcheck='';spell.setAttribute('aria-pressed','false');
    // Share the Rich Text toolbar's actual classes and icon markup.
    formatBar.classList.add('richtext-toolbar');
    const richToolbar=document.getElementById('richtext-template').content.querySelector('.richtext-toolbar');
    const iconMatches={'Undo spreadsheet edit':'Undo text edit','Redo spreadsheet edit':'Redo text edit','Clear cell formatting':'Clear formatting','Insert cell image':'Insert image','Cell spellcheck':'Turn spellcheck off'};
    for(const button of formatBar.querySelectorAll('button')){const label=button.getAttribute('aria-label'),source=[...richToolbar.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===(iconMatches[label]||label));if(source){button.innerHTML=source.innerHTML;button.className=source.className}}
    for(const [key,cls] of [['block','richtext-block'],['font','richtext-font'],['size','richtext-size']])fields[key].classList.add(cls);
    for(const [key,cls] of [['color','richtext-color'],['highlight','richtext-highlight']]){const input=fields[key],label=input.parentElement,source=richToolbar.querySelector('.'+cls);label.classList.add(cls);label.replaceChildren(...[...source.childNodes].map(n=>n.cloneNode(true)),input);input.addEventListener('input',()=>label.querySelector('span').style.background=input.value)}
    const sheetTools=m.querySelector('.sheet-toolbar'),divider=document.createElement('span');divider.className='richtext-toolbar-divider';formatBar.append(divider,...sheetTools.children);sheetTools.remove();
    const exportButton=formatBar.querySelector('.sheet-export');exportButton.innerHTML=richToolbar.querySelector('.richtext-export-button').innerHTML;exportButton.classList.add('richtext-export-button');exportButton.title='Export CSV';exportButton.setAttribute('aria-label','Export CSV');exportButton.querySelector('span').textContent='CSV';
    function syncFormatToolbar(){const f=formats[selected]||{};for(const [key,input] of Object.entries(fields))input.value=f[key]||({block:'p',font:'Inter',size:12,color:'#17191d',highlight:'#fff2a8'}[key]);formatBar.querySelectorAll('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(!!f[b.dataset.format])));formatBar.querySelectorAll('[data-align]').forEach(b=>b.setAttribute('aria-pressed',String((f.align||'left')===b.dataset.align)));spell.setAttribute('aria-pressed',String(spellcheck));for(const key of ['color','highlight'])fields[key].parentElement.querySelector('span').style.background=fields[key].value}
    m.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&!e.altKey&&['z','y'].includes(key)){e.preventDefault();e.stopImmediatePropagation();const anchor=selected,redo=key==='y'||e.shiftKey;formatBar.querySelector('[aria-label="'+(redo?'Redo':'Undo')+' spreadsheet edit"]').click();if(anchor){selected=rangeAnchor=anchor;const field=grid.querySelector('[data-cell="'+anchor+'"]');field?.focus();formula.value=cells[anchor]||''}return}if(['Delete','Backspace'].includes(e.key)){const ref=e.target.dataset.imageCell||(e.target.dataset.cell&&!e.target.value?e.target.dataset.cell:null);if(ref&&pictures[ref]){e.preventDefault();e.stopImmediatePropagation();remember();delete pictures[ref];changed();grid.querySelector('[data-cell="'+ref+'"]')?.focus()}}},true);
    formatBar.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    formatBar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});

    const display=(key,cache=new Map())=>{try{const v=calculate(cells,key,new Set(),cache);return typeof v==='number'?String(Number(v.toPrecision(12))):v}catch(e){return e.message}};
    function fitRows(){for(const row of grid.querySelectorAll('tbody tr')){const fields=[...row.querySelectorAll('textarea')],r=Number(row.querySelector('th').dataset.row);fields.forEach(input=>input.style.height=(rowHeights[r]||29)+'px');const height=Math.min(600,Math.max(rowHeights[r]||29,...fields.map(input=>input.scrollHeight+2)));row.style.height=height+'px';fields.forEach(input=>input.style.height=height+'px')}}
    function refresh(){const cache=new Map(),selectedCells=new Set(selection());grid.querySelectorAll('textarea').forEach(input=>{if(input!==document.activeElement)input.value=display(input.dataset.cell,cache);input.classList.toggle('has-error',String(input.value).startsWith('#'));input.classList.toggle('is-selected',selectedCells.has(input.dataset.cell));paintFormat(input)});fitRows();label.textContent=rangeAnchor&&rangeAnchor!==selected?rangeAnchor+':'+selected:selected;syncFormatToolbar();status.textContent=`${rows} rows × ${cols} columns`}
    function update(key,value){if(!key)return;if(lastEditKey!==key||Date.now()-lastEditAt>700){remember();lastEditKey=key}lastEditAt=Date.now();if(value)cells[key]=String(value).slice(0,2000);else delete cells[key];refresh();notifyBoardChanged('spreadsheet-edit')}
    function render(){
      const table=document.createElement('table');table.setAttribute('aria-label','Spreadsheet cells');const colgroup=document.createElement('colgroup');for(let c=-1;c<cols;c++){const col=document.createElement('col');col.style.width=(c<0?34:columnWidths[c]||96)+'px';colgroup.append(col)}table.append(colgroup);table.style.width=(34+Array.from({length:cols},(_,c)=>columnWidths[c]||96).reduce((a,b)=>a+b,0))+'px';const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(document.createElement('th'));
      for(let c=0;c<cols;c++){const th=document.createElement('th');th.scope='col';th.textContent=String.fromCharCode(65+c);th.dataset.column=c;addResizer(th,'column',c);tr.append(th)}head.append(tr);table.append(head);
      const body=document.createElement('tbody');for(let r=0;r<rows;r++){const row=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=r+1;th.dataset.row=r;row.style.height=(rowHeights[r]||29)+'px';addResizer(th,'row',r);row.append(th);for(let c=0;c<cols;c++){const td=document.createElement('td'),input=document.createElement('textarea');input.rows=1;input.autocomplete='off';input.spellcheck=spellcheck;input.dataset.spellcheckManaged='true';input.dataset.cell=name(r,c);input.style.height=(rowHeights[r]||29)+'px';input.setAttribute('aria-label',name(r,c));td.append(input);row.append(td)}body.append(row)}table.append(body);grid.replaceChildren(table);refresh();
    }

    function addResizer(header,axis,index){
      const handle=document.createElement('button');handle.type='button';handle.className='sheet-resizer sheet-resizer--'+axis;handle.setAttribute('aria-label','Resize '+axis+' '+(axis==='column'?String.fromCharCode(65+index):index+1));
      handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);remember();const start=axis==='column'?e.clientX:e.clientY,scale=m.getBoundingClientRect().width/m.offsetWidth,values=axis==='column'?columnWidths:rowHeights,initial=values[index]||(axis==='column'?96:29);
        const move=event=>{values[index]=Math.round(Math.max(axis==='column'?48:24,Math.min(axis==='column'?600:240,initial+((axis==='column'?event.clientX:event.clientY)-start)/scale)));const table=grid.querySelector('table');if(axis==='column'){table.querySelectorAll('col')[index+1].style.width=values[index]+'px';table.style.width=(34+Array.from({length:cols},(_,c)=>columnWidths[c]||96).reduce((a,b)=>a+b,0))+'px'}else{const row=table.tBodies[0].rows[index];row.style.height=values[index]+'px';row.querySelectorAll('textarea').forEach(input=>input.style.height=values[index]+'px')}};
        const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('lostpointercapture',end);fitRows();notifyBoardChanged('spreadsheet-cell-resize')};handle.addEventListener('pointermove',move);handle.addEventListener('lostpointercapture',end);
      });header.append(handle);
    }
    function restructure(axis,index,remove){
      const count=axis==='row'?rows:cols,limit=axis==='row'?99:26;if(remove?count<=1:count>=limit)return;remember();
      const shift=pos=>{const at=axis==='row'?0:1;if(remove&&pos[at]===index)return null;if(pos[at]>=index)pos[at]+=remove?-1:1;return pos};
      const movedFormats={},movedPictures={};for(const [key,format] of Object.entries(formats)){const pos=shift(coords(key));if(pos)movedFormats[name(...pos)]=format}for(const [key,picture] of Object.entries(pictures)){const pos=shift(coords(key));if(pos)movedPictures[name(...pos)]=picture}formats=movedFormats;pictures=movedPictures;
      const next={};for(const [key,value] of Object.entries(cells)){const pos=shift(coords(key));if(!pos)continue;next[name(...pos)]=value.startsWith('=')?value.replace(/\b([A-Z][1-9]\d?)\b/gi,ref=>{const moved=shift(coords(ref.toUpperCase()));return moved&&moved[0]<99&&moved[1]<26?name(...moved):'#REF!'}):value}
      cells=next;const sizes=axis==='row'?rowHeights:columnWidths;sizes.length=count;sizes.splice(index,remove?1:0,...(remove?[]:[axis==='row'?29:96]));if(axis==='row')rows+=remove?-1:1;else cols+=remove?-1:1;
      const pos=coords(selected||'A1');selected=name(Math.min(pos[0],rows-1),Math.min(pos[1],cols-1));rangeAnchor=selected;formula.value=cells[selected]||'';render();notifyBoardChanged('spreadsheet-structure');
    }
    const menu=document.createElement('div');menu.className='sheet-context-menu';menu.setAttribute('popover','manual');menu.setAttribute('role','menu');document.body.append(menu);
    const closeMenu=()=>{menu.hidePopover();menu.replaceChildren()};
    m.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();const cell=e.target.closest('[data-cell]'),header=e.target.closest('th');if(cell)selected=cell.dataset.cell;let [r,c]=coords(selected||'A1');if(header?.dataset.row!==undefined)r=Number(header.dataset.row);if(header?.dataset.column!==undefined)c=Number(header.dataset.column);refresh();formula.value=cells[selected]||'';closeMenu();(document.fullscreenElement===m?m:document.body).append(menu);
      for(const [title,axis,index,remove] of [['Insert row above','row',r,false],['Insert row below','row',r+1,false],['Delete row','row',r,true],['Insert column left','column',c,false],['Insert column right','column',c+1,false],['Delete column','column',c,true]]){const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('role','menuitem');const count=axis==='row'?rows:cols;button.disabled=remove?count<=1:count>=(axis==='row'?99:26);button.onclick=()=>{restructure(axis,index,remove);closeMenu()};menu.append(button)}
      menu.showPopover();menu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button:not(:disabled)')?.focus();
    });
    const outside=e=>{if(!menu.contains(e.target)){closeMenu();if(!(m.contains(e.target)&&e.target.closest?.('.sheet-grid textarea,.sheet-cell-image,.sheet-formula,.sheet-resizer,.sheet-format-toolbar,.sheet-toolbar'))){selected=rangeAnchor='';formula.value='';if(grid.contains(document.activeElement))document.activeElement.blur();refresh()}}};document.addEventListener('pointerdown',outside,true);menu.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){closeMenu();grid.querySelector('[data-cell="'+selected+'"]')?.focus()}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()}});
    const cleanup=m._cleanup;m._cleanup=()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('pointerdown',rangePointer,true);menu.remove();cleanup?.()};const deactivate=m._deactivate;m._deactivate=()=>{closeMenu();deactivate?.()};
    const rangePointer=e=>{if(grid.contains(e.target)&&e.target.dataset.cell){extending=e.shiftKey;rangeAnchor=extending?(rangeAnchor||selected||e.target.dataset.cell):e.target.dataset.cell}};document.addEventListener('pointerdown',rangePointer,true);
    grid.addEventListener('click',e=>{const th=e.target.closest('th');if(!th||e.target.closest('.sheet-resizer'))return;if(th.dataset.row!==undefined){const r=Number(th.dataset.row);rangeAnchor=name(r,0);selected=name(r,cols-1)}else if(th.dataset.column!==undefined){const c=Number(th.dataset.column);rangeAnchor=name(0,c);selected=name(rows-1,c)}else{rangeAnchor='A1';selected=name(rows-1,cols-1)}formula.value=cells[selected]||'';refresh()});
    grid.addEventListener('focusin',e=>{if(!e.target.dataset.cell)return;selected=e.target.dataset.cell;if(!extending)rangeAnchor=selected;extending=false;e.target.value=cells[selected]||'';formula.value=cells[selected]||'';refresh()});
    grid.addEventListener('input',e=>{if(e.target.dataset.cell){update(e.target.dataset.cell,e.target.value);formula.value=e.target.value}});
    grid.addEventListener('focusout',()=>requestAnimationFrame(refresh));
    grid.addEventListener('keydown',e=>{if(!e.target.dataset.cell)return;if((e.ctrlKey||e.metaKey)&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();const key={b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()];apply(key,!(formats[selected]||{})[key]);grid.querySelector('[data-cell="'+selected+'"]')?.focus();return}const [r,c]=coords(e.target.dataset.cell);if(e.key==='Enter'&&!e.altKey){e.preventDefault();grid.querySelector(`[data-cell="${name(Math.max(0,Math.min(rows-1,r+(e.shiftKey?-1:1))),c)}"]`)?.focus()}});
    grid.addEventListener('paste',e=>{
      const text=e.clipboardData?.getData('text/plain');if(!e.target.dataset.cell||!text||!/[\t\n]/.test(text))return;e.preventDefault();remember();
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
    m._boardGetState=()=>({version:3,rows,cols,cells:{...cells},formats:structuredClone(formats),pictures:{...pictures},spellcheck,columnWidths:Array.from({length:cols},(_,c)=>columnWidths[c]||96),rowHeights:Array.from({length:rows},(_,r)=>rowHeights[r]||29)});
    m._boardSetState=(state,keepHistory=false)=>{lastEditKey='';if(!keepHistory){formatUndo.length=formatRedo.length=0;lastEditKey=''}rows=Math.max(1,Math.min(99,Math.floor(Number(state?.rows)||12)));cols=Math.max(1,Math.min(26,Math.floor(Number(state?.cols)||6)));cells={};for(const [k,v] of Object.entries(state?.cells||{})){const pos=coords(k);if(pos&&pos[0]<rows&&pos[1]<cols)cells[k]=String(v).slice(0,2000)}columnWidths=Array.from({length:cols},(_,i)=>Math.max(48,Math.min(600,Number(state?.columnWidths?.[i])||96)));rowHeights=Array.from({length:rows},(_,i)=>Math.max(24,Math.min(240,Number(state?.rowHeights?.[i])||29)));formats={};for(const [key,value] of Object.entries(state?.formats||{}))if(coords(key)&&coords(key)[0]<rows&&coords(key)[1]<cols)formats[key]=cleanFormat(value);pictures={};for(const [key,value] of Object.entries(state?.pictures||{}))if(coords(key)&&coords(key)[0]<rows&&coords(key)[1]<cols&&typeof value==='string'&&value.length<800000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value))pictures[key]=value;spellcheck=!!state?.spellcheck;selected=rangeAnchor='';formula.value='';render()};
    render();
  }
  window.TeacherTilesSpreadsheet=Object.freeze({setup,calculate});
})();
