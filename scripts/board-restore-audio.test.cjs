const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage();
    await page.addInitScript(()=>{
      window.testPlays=[];
      HTMLMediaElement.prototype.play=function(){testPlays.push(this.src);return Promise.resolve()};
    });
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      const file=path.join(process.cwd(),decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      return url.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
    });
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(()=>testPlays.filter(src=>src.endsWith('/pop.mp3')).length),1,'one title-screen pop');
    const restored=await page.evaluate(()=>{
      const api=TeacherTilesBoard;
      api.load(api.blank());
      createModule('robothfw',400,200,{record:false});
      const saved=api.capture();
      testPlays.length=0;
      api.load(saved);api.load(api.blank());api.load(saved);
      return testPlays;
    });
    assert.deepEqual(restored,[],'board restoration must not play slider sounds');
    await page.evaluate(()=>{
      const slider=document.createElement('input');slider.type='range';slider.id='audio-test-slider';slider.value='50';
      slider.style.cssText='position:fixed;top:50px;left:50px;z-index:2147483647';document.body.append(slider);slider.focus();
    });
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>testPlays.filter(src=>src.endsWith('/pop.mp3')).length),1,'real keyboard slider changes still play a pop');
    console.log('Single intro pop, silent board restores, and real slider feedback passed.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
