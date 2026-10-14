(()=>{
const modes={morning:[['attendance',36,100],['visualschedule',924,100],['timer',1332,40],['clock',1332,568]],lesson:[['abc',40,40],['writinglines',550,40],['progressbar',40,690],['visualdirections',1150,40]],mindfulness:[['fishtank',40,40],['sleepymonster',670,40],['butterflygarden',1300,40],['chime',40,560],['transitionbell',1300,435]],planningboard:[['calendar',40,40],['sticky',690,40],['todo',690,380],['reminders',1120,40]],planning:[['lessonplannertile',28,28]],stars:[['starchart',16,16]],meter:[['classmeter',28,28]]};
const layouts={morning:[1742,838],lesson:[1950,960],mindfulness:[1820,950],planningboard:[1590,850],planning:[706,696],stars:[712,592],meter:[476,666]};
const key=new URLSearchParams(location.search).get('mode')||'morning';const selected=modes[key]?key:'morning';let actualSize=false;let wasCompact=null;let dimensions=layouts[selected];
for(const child of document.body.children){if(!['SCRIPT','STYLE','LINK','TEMPLATE'].includes(child.tagName)&&child.id!=='workspace')child.classList.add('demo-chrome')}
// Demo-only: no skin picker is registered, including on duplicated tiles.
window.TeacherTilesSkins.setup=()=>{};
document.querySelectorAll('#workspace>.module').forEach(m=>{m._cleanup?.();m.remove()});
for(const [type,x,y] of modes[selected]){
 const m=createModule(type,1000,1000,{record:false});m.style.left=x+'px';m.style.top=y+'px';m.querySelectorAll('[data-native-src]').forEach(image=>image.src=image.dataset.nativeSrc);
 if(type==='attendance')m._boardSetState({className:'Our Class',students:['Alex','Avery','Charlie','Jordan','Morgan','Riley','Sam','Taylor'],assignments:{Alex:'present',Avery:'present',Charlie:'present',Jordan:'present',Morgan:'present',Riley:'present',Sam:'default',Taylor:'present'}});
 if(type==='starchart'||type==='classmeter')m._boardSetState({classId:'demo-class',showAllStudents:true});
 if(type==='sticky')m.querySelector('.sticky-editor').innerHTML='<strong>This Week</strong><p>Explore habitats.</p><p>Read, observe, and share what we notice.</p>';
 if(type==='todo'){m.querySelector('.todo-title').value='Lesson Prep';m._boardSetState({rows:[{text:'Choose a read-aloud',checked:true},{text:'Gather materials',checked:false},{text:'Prepare group activities',checked:false},{text:'Review tomorrow’s plan',checked:false}]})}
 if(type==='reminders'){m._boardSetState({items:[{id:'demo-materials',text:'Set out science materials',dueAt:Date.now()+3600000,inbox:false,popup:true,desktop:false},{id:'demo-plan',text:'Review tomorrow’s lesson',dueAt:Date.now()+7200000,inbox:false,popup:true,desktop:false}]});const desktop=m.querySelector('[name="desktop"]');desktop.disabled=true;desktop.closest('label').hidden=true;}
 if(type==='timer')m._boardTimerSetState({total:600,left:420,running:false,finished:false});
 if(type==='abc')m._boardSetState({...m._boardGetState(),current:'A',mode:'uppercase'});
 if(type==='writinglines'){m.querySelector('.writinglines-toggle-type').click();m.querySelectorAll('.writinglines-entry').forEach((el,i)=>{el.textContent=['Aa Bb Cc','We learn together.',''][i]||'';el.dispatchEvent(new Event('input',{bubbles:true}))});document.activeElement?.blur()}
 if(type==='progressbar')m._boardSetState({title:'Reading Time',initializedAt:Date.now()-600000,targetAt:Date.now()+900000,running:true,orientation:'horizontal',barStyle:'glass'});
 if(type==='visualdirections')m._boardSetState({mode:'numbers',layout:'horizontal',cards:[{title:'Cut',image:'tiles/visual-directions/assets/58.png'},{title:'Write',image:'tiles/visual-directions/assets/59.png'},{title:'Use Your Computer',image:'tiles/visual-directions/assets/65.png'}]});
 if(type==='fishtank')m._boardSetState({mode:'ambient',fish:[0,1,3,5,6,8]});
 if(type==='sleepymonster')m._boardSetState({mode:'ambient',state:'sleep-back',x:.5,cycleSleepSeconds:65});
 if(type==='butterflygarden')m._boardSetState({mode:'ambient',ambientRun:120,flowers:Array.from({length:12},(_,i)=>({assetIndex:i%6,x:.1+(i%6)*.15,base:.03+(i%3)*.04,scale:.7+(i%3)*.1,growth:1}))});
}
function fit(){const compact=innerWidth<640&&['morning','lesson','mindfulness','planningboard'].includes(selected);if(compact!==wasCompact){wasCompact=compact;if(compact){let y=40;const width=Math.max(...[...workspace.querySelectorAll('.module')].map(m=>m.offsetWidth))+80;for(const [type] of modes[selected]){const m=workspace.querySelector(`[data-type="${type}"]`);m.style.left=(width-m.offsetWidth)/2+'px';m.style.top=y+'px';y+=(type==='visualschedule'?520:m.offsetHeight)+40}dimensions=[width,y]}else{dimensions=layouts[selected];for(const [type,x,y] of modes[selected]){const m=workspace.querySelector(`[data-type="${type}"]`);m.style.left=x+'px';m.style.top=y+'px'}}}const [width,height]=dimensions;if(compact)parent.postMessage({type:'demo-height',height:Math.ceil(height*Math.min(innerWidth/width,1))},'*');boardCamera.scale=actualSize?1:Math.min(innerWidth/width,innerHeight/height,1);boardCamera.x=0;boardCamera.y=0;applyBoardCamera()}
fit();window.addEventListener('resize',fit);
window.addEventListener('message',event=>{if(event.source!==parent)return;if(event.data?.type==='demo-zoom'){actualSize=event.data.actual;fit()}});
// Allow normal page scrolling through the embedded board; Ctrl+wheel keeps native board zoom.
document.addEventListener('wheel',event=>{if(event.ctrlKey)return;const scrollable=event.target.closest('.lessonplanner-list,.visualschedule-items');if(scrollable&&scrollable.scrollHeight>scrollable.clientHeight)return;event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'demo-scroll',delta:event.deltaY},'*')},{capture:true,passive:false});
// Keep the demo focused on its sample tiles. No app navigation or external links.
document.addEventListener('contextmenu',event=>{if(!event.target.closest('.module')){event.preventDefault();event.stopImmediatePropagation()}},true);
document.body.classList.add('demo-ready');parent.postMessage({type:'demo-ready',mode:selected},'*');
})();

