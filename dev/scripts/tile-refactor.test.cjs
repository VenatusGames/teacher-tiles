const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const linked=[...html.matchAll(/<script src="([^"?]+)(?:\?[^"\s]*)?"><\/script>/g)].map(m=>m[1]).filter(source=>!/^https?:/.test(source));
 const sources=linked.slice(0,linked.indexOf('app.js')+1);
 assert(sources.length>60,'Extracted scripts must be linked into the app');
 assert.equal(new Set(sources).size,sources.length,'Load each extracted script once');
 assert.equal(sources.at(-1),'app.js','Load shared declarations before the bootstrap');
 for(const source of sources)new vm.Script(fs.readFileSync(path.join(root,source),'utf8'),{filename:source});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){return Promise.resolve()}pause(){}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}}});
  await page.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort()});
  await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});
  const results=await page.evaluate(()=>{
   document.getElementById('profile-modal').hidden=true;
   const types=[...new Set([...document.querySelectorAll('.context-menu__item[data-module]')].map(e=>e.dataset.module))];
   return types.map(type=>{
    let tile,restored;try{
     tile=createModule(type,200,200,{record:false});if(!tile)throw Error('Setup did not create a tile');
     const state=serializeBoardModule(tile);tile._cleanup?.();tile.remove();tile=null;
     restored=restoreTeacherTilesBoardObject(state);if(!restored)throw Error('Saved tile did not restore');
     const saved=serializeBoardModule(restored);
     if(saved.type!==type)throw Error('Type changed on restore');
     if(JSON.stringify(Object.keys(saved.special||{}).sort())!==JSON.stringify(Object.keys(state.special||{}).sort()))throw Error('Saved-state contract changed');
     return {type};
    }catch(error){return {type,error:error.message}}finally{for(const m of [tile,restored]){m?._cleanup?.();m?.remove()}}
   });
  });
  assert(results.length>=108);assert.deepEqual(results.filter(r=>r.error),[]);assert.deepEqual(errors,[]);
  console.log(`Passed: ${results.length} tile types created, serialized, restored, and cleaned up; extracted scripts parse and load once.`);
 }finally{await browser.close()}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
