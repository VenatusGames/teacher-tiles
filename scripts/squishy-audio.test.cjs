const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--unsafely-treat-insecure-origin-as-secure=http://tiles.test']});try{
const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');window.played=[];window.sounds=[];window.Audio=class extends EventTarget{constructor(src){super();sounds.push(this);Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20})}play(){played.push(this.src);this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}};window.notices=[];window.Notification=class{static permission='granted';constructor(title,options){notices.push({title,...options})}}});
await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);








for(const skin of ['', 'squishy-gel-cube']){
 await page.evaluate(skin=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{subscriptionActive:true}};const p=screenToBoard(650,170);window.cube=createModule('squishy',p.x,p.y,{tileSkin:skin});cube.style.width='500px';cube.style.height='520px';},skin);
 await page.waitForTimeout(600);
 assert.equal(await page.locator('.squishy-module .tile-audio-volume').count(),1);
 const canvas=page.locator('.squishy-canvas'),box=await canvas.boundingBox();
 await page.evaluate(()=>played.length=0);
 await page.mouse.click(box.x+box.width*.52,box.y+box.height*.5);
 assert.deepEqual(await page.evaluate(()=>played),['assets/ui/squishy-press.wav']);
 await canvas.focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>played.length),2);
 await page.evaluate(()=>TeacherTilesTileAudio.set(cube,{enabled:false},{notify:false}));
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>played.length),2);
 assert.equal(await page.evaluate(()=>sounds.filter(s=>s.src==='assets/ui/squishy-press.wav').every(s=>s.paused)),true);
 await page.evaluate(()=>TeacherTilesTileAudio.set(cube,{enabled:true},{notify:false}));await page.keyboard.press('Enter');
 await page.evaluate(()=>cube._deactivate());assert.equal(await page.evaluate(()=>sounds.filter(s=>s.src==='assets/ui/squishy-press.wav').every(s=>s.paused)),true);
 await page.evaluate(()=>{cube._cleanup();cube.remove()});
}
assert.deepEqual(errors,[]);console.log('PASS: both Squishy skins play one squish without UI pop; Enter, mute, audio settings and deactivate cleanup.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
