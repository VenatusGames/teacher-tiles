const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage();await page.setContent('<canvas id="board" width="1600" height="1000"></canvas><canvas id="preview" width="300" height="180"></canvas>');
 // Inspect simulation state only in this fixture; the application exposes only rendering.
 const source=fs.readFileSync('tiles/shared/rainy-window-scene.js','utf8').replace(' window.TeacherTilesRainyWindowScene=',' window.__rainTest={panes,step};window.TeacherTilesRainyWindowScene=');await page.addScriptTag({content:source});
 const result=await page.evaluate(()=>{
   const g=document.querySelector('#board').getContext('2d'),pg=document.querySelector('#preview').getContext('2d'),scene=TeacherTilesRainyWindowScene;
   scene.paint(g,1600,1000);scene.draw(g,1600,1000,'rainy-window',0);scene.draw(pg,300,180,'rainy-window',0);
   const state=__rainTest.panes.get(g),preview=__rainTest.panes.get(pg),originalPreview=JSON.stringify(preview.drops);
   const make=(y,r,speed,wait)=>({x:500,y,r,visibleR:r,kind:'slow',speed,wait,age:1,life:Infinity,wander:0,trail:0,dead:false});
   state.drops=[make(100,7,1000,0),make(130,5,0,Infinity)];state.spawn=-100;__rainTest.step(state,.05);
   const merged=state.drops.filter(d=>d.kind!=='residue');const swept=merged.length===1&&merged[0].r>7;
   state.drops=[make(100,9,0,18)];state.spawn=-100;for(let i=0;i<300;i++)__rainTest.step(state,1/30);
   const clings=state.drops[0].y===100;
   for(let i=0;i<300;i++)__rainTest.step(state,1/30);const releases=state.drops[0].y>100;
   const isolated=originalPreview===JSON.stringify(preview.drops);
   scene.draw(g,1600,1000,'rainy-window',-1);const rebuilt=__rainTest.panes.get(g)!==state;
   for(let i=0;i<600;i++){scene.paint(g,1600,1000);scene.draw(g,1600,1000,'rainy-window',i/30)}
   const live=__rainTest.panes.get(g),bounded=live.tracks.length<=900&&live.drops.filter(d=>d.kind==='residue').length<=160;
   return {swept,clings,releases,isolated,rebuilt,bounded};
 });for(const [name,value]of Object.entries(result))assert(value,name);console.log('PASS swept droplet merging, long cling then release, isolated preview state, rewind and bounded residue');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
