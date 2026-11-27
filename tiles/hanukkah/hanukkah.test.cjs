const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1500,height:950}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      return url.hostname === 'tiles.test' && fs.existsSync(file) && fs.statSync(file).isFile()
        ? route.fulfill({path:file}) : route.abort();
    });
    await page.goto('http://tiles.test/', {waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      document.getElementById('profile-modal').hidden = true;
      window.TeacherTilesAccount = {state:{subscriptionActive:true}};
      let p = screenToBoard(380,180);
      window.dreidel = createModule('dreidel',p.x,p.y);
      p = screenToBoard(950,180);
      window.menorah = createModule('menorah',p.x,p.y);
    });
    assert.equal(await page.locator('.dreidel-face').count(),4);
    assert.deepEqual(await page.locator('.dreidel-face b').allTextContents(),['נ','ג','ה','ש']);
    assert.equal(await page.locator('.menorah-candle').count(),9);
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),0);
    const candle = page.locator('.menorah-candle').nth(0);
    await candle.click();
    assert.equal(await candle.getAttribute('aria-pressed'),'true');
    await candle.click();
    assert.equal(await candle.getAttribute('aria-pressed'),'false');
    await candle.focus(); await page.keyboard.press('Space');
    assert.equal(await candle.getAttribute('aria-pressed'),'true');
    await page.evaluate(() => {
      for (const c of menorah.querySelectorAll('[data-candle]')) if(c.getAttribute('aria-pressed') === 'false') c.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    });
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),9);
    await page.evaluate(() => {
      window.hanukkahSaved = menorah._boardGetState();
      menorah._boardSetState({});
    });
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),0);
    await page.evaluate(() => menorah._boardSetState(hanukkahSaved));
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),9);
    // Check every stopping orientation; rapid repeated clicks cannot restart it.
    for (const result of [0,1,2,3]) {
      await page.evaluate(result => {
        const random = crypto.getRandomValues;
        crypto.getRandomValues = value => {value[0]=result;return value;};
        dreidel.querySelector('.dreidel-spin').click();
        dreidel.querySelector('.dreidel-spin').click();
        crypto.getRandomValues = random;
      },result);
      assert.equal(await page.locator('.dreidel-spin').getAttribute('aria-busy'),'true');
      await page.waitForFunction(() => !dreidel.querySelector('.dreidel-spin').hasAttribute('aria-busy'));
      assert.equal(await page.evaluate(() => dreidel._boardGetState().result),result);
      assert.equal(await page.locator('.dreidel-result').textContent(),['נ · Nun','ג · Gimel','ה · Hei','ש · Shin'][result]);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.dreidel-spin').click();
    assert.equal(await page.locator('.dreidel-spin').getAttribute('aria-busy'),null);
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Tile size changes and true fullscreen keep all candle hit areas on the tile.
    for (const size of [[340,260],[850,600]]) {
      await page.evaluate(([width,height]) => {menorah.style.width=width+'px';menorah.style.height=height+'px';},size);
      assert(await page.locator('.menorah-art').evaluate(svg => {
        const r=svg.getBoundingClientRect(),m=svg.closest('.module').getBoundingClientRect();
        return r.width>200&&r.height>100&&r.left>=m.left&&r.right<=m.right+1&&r.bottom<=m.bottom+1;
      }));
    }
    await page.evaluate(() => menorah.requestFullscreen());
    await page.waitForTimeout(150);
    assert(await page.locator('.menorah-art').evaluate(svg => svg.getBoundingClientRect().width>600));
    await page.evaluate(() => document.exitFullscreen());
    await page.evaluate(() => {menorah.style.width='620px';menorah.style.height='420px';});
    // Round-trip through the real saved-board serializer and restore lifecycle.
    await page.evaluate(() => {
      const saved = serializeBoardModule(menorah);
      menorah._cleanup?.(); menorah.remove();
      menorah = createModule('menorah',0,0,{record:false,boardState:saved});
    });
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),9);
    await page.locator('.menorah-candle').nth(4).click();
    assert.equal(await page.locator('.menorah-candle.is-lit').count(),8);
    await page.locator('.menorah-candle').nth(4).click();
    // Previews use saved result/flames, without active animation or listeners.
    await page.evaluate(async () => {
      const {createBoardPreview} = await import('/boards/preview.js');
      window.hanukkahPreview = createBoardPreview({inlineObjects:[
        {type:'dreidel',transform:{left:0,top:0,width:320,height:380},special:{result:3}},
        {type:'menorah',transform:{left:350,top:0,width:620,height:420},special:{candles:[true,false,false,false,true,false,false,false,true]}}
      ]});
      document.body.append(hanukkahPreview);
    });
    assert.equal(await page.locator('.hanukkah-static-preview .menorah-candle.is-lit').count(),3);
    assert.equal(await page.locator('.hanukkah-static-preview .dreidel-result').textContent(),'ש · Shin');
    await page.evaluate(() => hanukkahPreview.remove());
    assert.equal(await page.locator('#context-menu [data-module="dreidel"][data-coming-soon]').count(),0);
    assert(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('Hannukah Timers'));
    if(process.env.HANUKKAH_SCREENSHOT) await page.screenshot({path:process.env.HANUKKAH_SCREENSHOT});
    assert.deepEqual(errors,[]);
    console.log('Hanukkah tiles: four results, click/keyboard candles, saved state, rapid clicks, reduced motion, scaling, fullscreen and previews passed');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
