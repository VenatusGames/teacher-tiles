const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
  try{
    const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
    let songRequests=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      const file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(url.pathname.includes('/christmas-carols/assets/'))songRequests++;
      if(url.hostname==='tiles.test'&&/\.(mp3|ogg)$/.test(file)&&fs.existsSync(file)){
        const contentType=file.endsWith('.ogg')?'audio/ogg':'audio/mpeg';
        const bytes=fs.readFileSync(file),range=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
        if(range){const start=Number(range[1]),end=Math.min(bytes.length-1,range[2]?Number(range[2]):bytes.length-1);return route.fulfill({status:206,contentType,headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)})}
        return route.fulfill({contentType,headers:{'Accept-Ranges':'bytes'},body:bytes});
      }
      return url.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort();
    });
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
    await page.evaluate(()=>{
      document.getElementById('profile-modal').hidden=true;
      window.TeacherTilesAccount={state:{subscriptionActive:true}};
      boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();
      window.carol=createModule('christmascarols',600,160);carol.style.left='350px';carol.style.top='200px';
    });
    const tile=page.locator('.christmas-carols-module'),audio=tile.locator('audio'),credits=tile.locator('.carol-credits:not(.carol-library)'),library=tile.locator('.carol-library');
    assert.equal(await tile.count(),1);
    assert.equal(await tile.locator('.boombox-title').textContent(),'We Wish You a Merry Christmas');
    assert.equal(songRequests,0,'Song is not downloaded before playback');
    await tile.locator('.carol-info').click();assert(await credits.evaluate(el=>el.open));
    assert((await credits.textContent()).includes('Kevin MacLeod'));
    assert.equal(await credits.locator('a[href="https://creativecommons.org/licenses/by/4.0/"]').count(),1);
    if(process.env.CAROLS_SCREENSHOT)await credits.screenshot({path:process.env.CAROLS_SCREENSHOT.replace('.png','-credits.png')});
    await page.keyboard.press('Escape');assert.equal(await credits.evaluate(el=>el.open),false);
    await tile.locator('.boombox-play').click();
    await page.waitForFunction(()=>{const a=carol.querySelector('audio');return !a.paused&&a.currentTime>.1&&a.duration>130});
    assert(songRequests>0);assert.equal(await audio.evaluate(el=>el.loop),true);
    await tile.locator('.boombox-play').click();assert(await audio.evaluate(el=>el.paused));
    assert.equal(await tile.locator('.boombox-play').getAttribute('aria-label'),'Play Carol');
    await tile.locator('.boombox-skip').click();await page.waitForFunction(()=>carol.querySelector('audio').currentTime>=15);
    await tile.locator('.boombox-volume').fill('32');
    assert.equal(await tile.locator('.boombox-volume-value').textContent(),'32%');
    await page.evaluate(()=>{const saved=serializeBoardModule(carol);carol._cleanup();carol.remove();carol=createModule('christmascarols',0,0,{record:false,boardState:saved});});
    assert.equal(await tile.locator('.boombox-volume').inputValue(),'32');assert(await audio.evaluate(el=>el.paused));
    await tile.locator('.boombox-play').click();await page.waitForFunction(()=>carol.querySelector('audio').currentTime>=15);
    await tile.locator('.boombox-next').click();assert.equal(await tile.locator('.boombox-title').textContent(),'Jingle Bells');
    await tile.locator('.boombox-prev').click();await page.waitForFunction(()=>carol.querySelector('audio').currentTime<2&&!carol.querySelector('audio').paused);
    await tile.locator('.boombox-play').click();
    for(const [w,h] of [[360,195],[650,320]]){
      await tile.evaluate((el,[w,h])=>{el.style.width=w+'px';el.style.height=h+'px'},[w,h]);
      await page.waitForTimeout(250);
      assert(await tile.evaluate(el=>{const tile=el.getBoundingClientRect();return [...el.querySelectorAll('.boombox-view--compact button,.boombox-title,.boombox-volume-row')].every(node=>{const r=node.getBoundingClientRect();return r.left>=tile.left&&r.right<=tile.right&&r.top>=tile.top&&r.bottom<=tile.bottom&&node.scrollWidth<=node.clientWidth+2})}), 'Player controls and title fit the tile');
    }
    await page.evaluate(()=>carol.requestFullscreen());await tile.locator('.carol-info').click();assert(await credits.evaluate(el=>el.open));await credits.locator('.carol-credits-close').click();await page.evaluate(()=>document.exitFullscreen());
    await tile.evaluate(el=>{el.style.width='450px';el.style.height='210px'});
    if(process.env.CAROLS_SCREENSHOT)await tile.screenshot({path:process.env.CAROLS_SCREENSHOT});
    await page.evaluate(async()=>{const {createBoardPreview}=await import('/boards/preview.js');window.preview=createBoardPreview({inlineObjects:[serializeBoardModule(carol)]});document.body.append(preview)});
    assert.equal(await page.locator('.board-card__preview .christmas-carols-module .boombox-title').textContent(),'We Wish You a Merry Christmas');await page.evaluate(()=>preview.remove());
    await tile.locator('.boombox-play').click();await page.waitForFunction(()=>!carol.querySelector('audio').paused);await page.evaluate(()=>carol._deactivate());assert(await audio.evaluate(el=>el.paused));
    await page.evaluate(()=>{window.TeacherTilesAccount={state:{subscriptionActive:false}};window.dispatchEvent(new Event('teachertiles:accountchange'))});
    assert.equal(await tile.locator('.halloween-locked').isVisible(),true);assert(await audio.evaluate(el=>el.paused));
    await page.evaluate(()=>{carol._cleanup();carol.remove();window.scape=createModule('boombox',500,100)});
    assert.equal(await page.locator('.soundscapes-module .boombox-view--compact .boombox-title').textContent(),'Relaxing Rain');await page.locator('.boombox-view--compact .boombox-next').click();assert.equal(await page.locator('.boombox-view--compact .boombox-title').textContent(),'Thunderstorm');
    await page.evaluate(()=>{scape._cleanup();scape.remove();window.TeacherTilesAccount={state:{subscriptionActive:true}};carol=createModule('christmascarols',600,160);carol.style.left='350px';carol.style.top='200px'});
    await tile.locator('.carol-choose').click();
    assert.equal(await library.locator('.carol-song').count(),12);
    assert(await library.locator('h2').isVisible());
    assert(await library.evaluate(el=>{const bounds=el.getBoundingClientRect(),heading=el.querySelector('h2').getBoundingClientRect(),close=el.querySelector('.carol-credits-close').getBoundingClientRect();return heading.top>=bounds.top&&close.top>=bounds.top&&close.bottom<=bounds.bottom}),'Library heading and close button stay visible after scrolling');
    assert.equal(await library.locator('[aria-pressed="true"]').count(),1);
    if(process.env.CAROLS_SCREENSHOT)await library.screenshot({path:process.env.CAROLS_SCREENSHOT.replace('.png','-songs.png')});
    await page.mouse.click(10,10);assert.equal(await library.evaluate(el=>el.open),false);
    const tracks=await page.evaluate(()=>TeacherTilesCarolTracks);
    for(let i=0;i<tracks.length;i++){
      const track=tracks[i];
      await tile.locator('.carol-choose').click();
      await library.getByRole('button',{name:track.title+' '+track.artist,exact:false}).filter({has:page.getByText(track.title,{exact:true})}).click();
      assert.equal(await tile.locator('.boombox-title').textContent(),track.title);
      assert.equal(await tile.evaluate(el=>el._boardGetState().track),i);
      await tile.locator('.carol-info').click();
      assert((await credits.textContent()).includes(track.credit));
      assert.equal(await credits.locator('a').first().getAttribute('href'),track.licenseUrl);
      await page.keyboard.press('Escape');
      await tile.locator('.boombox-play').click();
      await page.waitForFunction(()=>{const a=carol.querySelector('audio');return !a.paused&&a.currentTime>0&&a.duration>30});
      assert.equal(await tile.locator('.carol-error').isVisible(),false);
      console.log('Decoded and played: '+track.title);
      await tile.locator('.boombox-play').click();
    }
    await page.evaluate(()=>{const saved=serializeBoardModule(carol);carol._cleanup();carol.remove();carol=createModule('christmascarols',0,0,{record:false,boardState:saved});});
    assert.equal(await tile.locator('.boombox-title').textContent(),'Waltz of the Flowers');
    await page.evaluate(async()=>{const {createBoardPreview}=await import('/boards/preview.js');window.preview=createBoardPreview({inlineObjects:[serializeBoardModule(carol)]});document.body.append(preview)});
    assert.equal(await page.locator('.board-card__preview .christmas-carols-module .boombox-title').textContent(),'Waltz of the Flowers');await page.evaluate(()=>preview.remove());
    // Restoring a paused track then selecting a different one must not seek the new song.
    await page.evaluate(()=>carol._boardSetState({track:0,volume:40,currentTime:42}));
    const requestsBefore=songRequests;
    await tile.locator('.boombox-next').click();assert.equal(songRequests,requestsBefore,'Changing paused tracks stays lazy');
    await tile.locator('.boombox-play').click();await page.waitForFunction(()=>!carol.querySelector('audio').paused&&carol.querySelector('audio').currentTime>0);
    assert(await audio.evaluate(el=>el.currentTime<3));
    await page.evaluate(()=>carol._cleanup());
    assert.deepEqual(errors,[]);
    console.log('Christmas Carols actual MP3 playback, lazy loading, credits, volume, track selection, all 12 recordings, saved state, scaling, fullscreen, previews, subscription lock and Soundscapes regression checks passed');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
