const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.testSounds=[];
      window.Audio=class extends EventTarget{
        constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20});testSounds.push(this)}
        play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}
      };
    });
    await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
    await page.clock.install();
    await page.addStyleTag({content:"*,*::before,*::after{transition:none!important}"});


    await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();});
    for(const type of ['timer','interactive','meditation','clock','progressbar','youtube','dice','robothfw']){
      await page.evaluate(type=>{TeacherTilesBoard.clear();const m=createModule(type,500,250,{record:false});m.style.left='250px';m.style.top='150px';fitTileDisplaySize(m,1,1);},type);
      const tile=page.locator('.workspace .module');if(!await tile.count())continue;
      await tile.hover();await page.clock.runFor(700);
      const result=await tile.evaluate(m=>{const r=m.getBoundingClientRect();const bad=[...m.querySelectorAll('button,input,select')].filter(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();if(el.closest('[hidden],.tile-settings-floating,.meditation-palette-drawer')||!b.width||!b.height||s.visibility==='hidden'||Number(s.opacity)===0)return false;for(let p=el.parentElement;p&&p!==m;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility==='hidden'||Number(s.opacity)===0)return false;}return b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1;}).map(el=>({name:el.className,text:el.textContent,rect:el.getBoundingClientRect().toJSON(),tile:r.toJSON()}));return{type:m.dataset.type,width:r.width,height:r.height,safe:m._resizeMinimum,scale:tileUniformScale(m),bad};});
      console.log(JSON.stringify(result));assert.equal(result.scale,.85);assert.deepEqual(result.bad,[],type+' controls must fit');
      if(type==='timer'){
        await tile.locator('.timer-start').click();assert(await tile.evaluate(m=>m.classList.contains('is-running')));
        await tile.locator('.timer-reset').click();
        if(process.env.TILE_SCREENSHOT)await page.screenshot({path:process.env.TILE_SCREENSHOT});
      }
      const before=await tile.boundingBox();await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});const after=await page.locator('.workspace .module').boundingBox();assert(Math.abs(before.width-after.width)<1);assert(Math.abs(before.height-after.height)<1);
    }
    assert.deepEqual(errors,[]);console.log('Safe minimum layouts, usable timer controls, modest content fitting and saved geometry passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

