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


    await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();window.TeacherTilesSandbox={subscriptionEnabled:true};const m=createModule('timer',500,250,{record:false,tileSkin:'timer-liquid'});m.style.left='250px';m.style.top='150px';m._boardTimerSetState({total:10,left:10,running:false});});
    const tile=page.locator('.workspace .module'),liquid=page.locator('.timer-liquid-fill');
    assert.notEqual(await tile.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Liquid Fill has a tile background');
    assert.equal(await tile.getAttribute('data-tile-skin'),'timer-liquid');assert.equal(await liquid.evaluate(el=>el.style.height),'0%');
    await tile.hover();await tile.locator('.timer-start').click();await page.clock.runFor(5000);
    const frameA=await liquid.evaluate(el=>parseFloat(el.style.height));await page.clock.runFor(16);const frameB=await liquid.evaluate(el=>parseFloat(el.style.height));assert(frameB>frameA,'liquid progresses between timer ticks');
    const wave=await page.locator('.timer-liquid-wave').evaluate(el=>({top:parseFloat(getComputedStyle(el).top),height:parseFloat(getComputedStyle(el).height)}));assert.equal(wave.top,-11);assert.equal(wave.height,12,'wave overlaps body without exposing a straight top edge');
    let level=await liquid.evaluate(el=>parseFloat(el.style.height));assert(level>48&&level<52);
    assert.equal(await page.locator('.timer-liquid-wave').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
    await tile.locator('.timer-start').click();level=await liquid.evaluate(el=>parseFloat(el.style.height));await page.clock.runFor(1500);assert.equal(await liquid.evaluate(el=>parseFloat(el.style.height)),level);assert.equal(await page.locator('.timer-liquid-wave').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
    const clip=await page.evaluate(()=>{const m=workspace.querySelector('.module'),field=m.querySelector('.timer-shape-select');field.value='heart';field.dispatchEvent(new Event('change'));return m.querySelector('.shape-foreign').getAttribute('clip-path');});assert(clip.startsWith('url(#shape-clip-'));
    await page.evaluate(()=>{const saved=TeacherTilesBoard.capture();TeacherTilesBoard.load(saved);});assert.equal(await tile.getAttribute('data-tile-skin'),'timer-liquid');assert.equal(await tile.getAttribute('data-timer-shape'),'heart');
    await tile.hover();await tile.locator('.tile-skins-toggle').click();
    const names=await page.locator('.tile-skins-choice>strong').allTextContents();assert.deepEqual(names,['Default','No Background','Solid','Liquid Fill']);
    assert.equal(await page.locator('.shop-product[data-shop-product="tile-skin-timer-solid"]').count(),1);assert.equal(await page.locator('.shop-product[data-shop-product="tile-skin-timer-liquid"]').count(),1);
    await page.locator('.tile-skins-choice').filter({has:page.locator('strong',{hasText:/^Solid$/})}).click();assert.equal(await tile.getAttribute('data-tile-skin'),'timer-solid');
    assert.equal(await liquid.evaluate(el=>getComputedStyle(el).display),'none');
    assert.notEqual(await tile.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Solid has a tile background');
    await page.evaluate(()=>workspace.querySelector('.module')._boardTimerSetState({total:10,left:10,running:false}));
    assert.equal(await tile.evaluate(el=>el.style.getPropertyValue('--timer-progress-ratio')),'0.000000','Solid starts empty');
    assert((await tile.locator('.shape-fill').evaluate(el=>getComputedStyle(el).backgroundColor)).includes('rgb(220, 231, 244)'),'Solid uses the empty color for the unfilled area');
    const surface=await tile.locator('.shape-fill').evaluate(el=>({gradient:getComputedStyle(el,'::before').backgroundImage,mask:getComputedStyle(el,'::before').maskImage}));assert(surface.gradient.includes('99, 173, 246'),'original rich blue material is the fill');assert(surface.mask.includes('conic-gradient'),'elapsed time reveals the material');
    await page.evaluate(()=>{TeacherTilesBoard.clear();for(const [i,skin] of ['timer-freestanding','timer-solid','timer-liquid'].entries()){const m=createModule('timer',400,200,{record:false,tileSkin:skin});m.style.left=(120+i*420)+'px';m.style.top='200px';m._boardTimerSetState({total:300,left:skin==='timer-freestanding'?300:150,running:false});}});
    await page.mouse.move(1450,900);await page.clock.runFor(700);
    assert((await page.locator('[data-tile-skin="timer-solid"] .shape-fill').evaluate(el=>getComputedStyle(el,'::before').maskImage)).includes('180deg'),'Solid visibly reveals half the material at half time');
    if(process.env.TILE_SCREENSHOT)await page.screenshot({path:process.env.TILE_SCREENSHOT});
    await page.evaluate(()=>{const m=workspace.querySelector('[data-tile-skin="timer-liquid"]');m._boardTimerSetState({total:10,left:1,running:true});});await page.clock.runFor(1200);
    assert.equal(await page.locator('[data-tile-skin="timer-liquid"] .timer-liquid-fill').evaluate(el=>el.style.height),'100%');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('[data-tile-skin="timer-liquid"] .timer-liquid-wave').evaluate(el=>getComputedStyle(el).animationName),'none');
    for(const skin of ['timer-freestanding','timer-solid','timer-liquid']){
      const m=page.locator('[data-tile-skin="'+skin+'"]');await m.evaluate(el=>fitTileDisplaySize(el,1,1));await m.hover();await page.clock.runFor(700);
      const outside=await m.evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.timer-controls button,.timer-controls input')].filter(b=>{const s=getComputedStyle(b),q=b.getBoundingClientRect();return q.width&&q.height&&s.visibility!=='hidden'&&Number(s.opacity)>0&&(q.left<r.left-1||q.right>r.right+1||q.bottom>r.bottom+1||q.top<r.top-1);}).map(b=>b.className);});assert.deepEqual(outside,[],skin+' controls remain within the minimum-size tile');
    }
    assert.deepEqual(errors,[]);console.log('Timer skin catalog/drawer, liquid progress/pause/completion, shape clipping, restore and reduced motion passed.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
