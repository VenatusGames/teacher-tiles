const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.Audio=class extends EventTarget{constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:1})}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}}});
  await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
  await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
  await page.evaluate(()=>{document.getElementById('profile-modal').hidden=true;window.TeacherTilesAccount={state:{subscriptionActive:true}};boardCamera.x=0;boardCamera.y=0;boardCamera.scale=1;applyBoardCamera();window.advent=createModule('adventcalendar',600,130);advent.style.left='100px';advent.style.top='100px';window.effects=0;const old=TeacherTilesTileEffects;window.TeacherTilesTileEffects={...old,launch(...args){effects++;return old.launch(...args)}};});
  const tile=page.locator('.advent-module'),doors=tile.locator('.advent-cabinet>.advent-grid>.advent-door'),editor=tile.locator('.advent-editor');
  assert.equal(await tile.locator('.advent-cabinet>.advent-heading').textContent(),'Advent Calendar');assert.equal(await doors.count(),24);
  assert(await doors.evaluateAll(nodes=>new Set(nodes.map(n=>{const r=n.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})).size>1));
  await doors.first().click();assert.equal(await editor.evaluate(el=>el.open),true);
  await editor.locator('[name="prizeTitle"]').fill('Cozy Reading Day');
  await editor.locator('[name="prizeText"]').fill('Bring a favorite book and enjoy ten extra minutes of reading.');
  await editor.locator('[name="calendarTheme"]').selectOption('evergreen');
  await editor.locator('[name="drawerStyle"]').selectOption('ribbons');
  await editor.locator('[name="prizeLayout"]').selectOption('spotlight');
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.fillStyle='#c9e7dc';x.fillRect(0,0,300,300);x.fillStyle='#33705d';x.fillRect(65,55,170,190);x.fillStyle='#fff1c9';x.fillRect(85,75,130,150);return c.toDataURL('image/png').split(',')[1];});
  await editor.locator('[name="prizeImage"]').setInputFiles({name:'book.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.waitForFunction(()=>!document.querySelector('.advent-editor [type="submit"]').disabled);
  await editor.locator('[data-edit-day="1"]').click();await editor.locator('[name="prizeTitle"]').fill('Class Drawing Time');
  await editor.locator('[data-edit-day="0"]').click();assert.equal(await editor.locator('[name="prizeTitle"]').inputValue(),'Cozy Reading Day');
  await editor.locator('[type="submit"]').click();assert.equal(await editor.evaluate(el=>el.open),false);
  assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].title),'Cozy Reading Day');assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].color),'');
  assert((await page.evaluate(()=>advent._boardGetState().cards[0].image)).startsWith('data:image/'));
  await tile.locator('.advent-cabinet [data-day="0"]').click();await page.waitForTimeout(650);
  assert.equal(await tile.locator('.advent-prize h3').textContent(),'Cozy Reading Day');assert.equal(await page.evaluate(()=>effects),1);
  assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].opened),true);
  if(process.env.ADVENT_SCREENSHOT)await tile.screenshot({path:process.env.ADVENT_SCREENSHOT.replace('.png','-prize.png')});
  await tile.locator('.advent-reveal-close').click();await tile.locator('.advent-cabinet [data-day="0"]').click();await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>effects),1);await tile.locator('.advent-reveal-close').click();
  await tile.hover();await tile.locator('.tile-settings-toggle').click();
  await tile.locator('[aria-label="Days in Calendar"]').fill('12');await tile.locator('[aria-label="Days in Calendar"]').press('Tab');assert.equal(await doors.count(),12);
  await tile.locator('[aria-label="Days in Calendar"]').fill('30');await tile.locator('[aria-label="Days in Calendar"]').press('Tab');assert.equal(await doors.count(),24);
  await page.mouse.click(1400,900);
  await page.evaluate(()=>{const saved=serializeBoardModule(advent);advent._cleanup();advent.remove();advent=createModule('adventcalendar',600,130,{record:false,boardState:saved});});
  assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].opened),true);assert.equal(await page.evaluate(()=>advent._boardGetState().cards[1].title),'Class Drawing Time');
  await tile.hover();await tile.locator('.advent-edit').click();assert.equal(await editor.locator('[name="prizeTitle"]').inputValue(),'Cozy Reading Day');
  await editor.locator('[name="prizeTitle"]').fill('Unsaved change');await editor.locator('[data-advent-close]').last().click();assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].title),'Cozy Reading Day');
  await tile.hover();await tile.locator('.advent-edit').click();await editor.locator('.advent-reset').click();await editor.locator('.advent-reset').click();await editor.locator('[type="submit"]').click();assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].opened),false);
  for(const size of [[360,420],[800,800]]){
   await tile.evaluate((el,[w,h])=>{el.style.width=w+'px';el.style.height=h+'px'},size);await page.waitForTimeout(350);
   assert(await doors.evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect(),g=n.parentElement.getBoundingClientRect();return r.width>20&&r.height>20&&r.left>=g.left-1&&r.right<=g.right+1&&r.top>=g.top-1&&r.bottom<=g.bottom+1})));
  }
  await page.evaluate(()=>advent.requestFullscreen());await page.waitForTimeout(200);await tile.hover();await tile.locator('.advent-edit').click();assert.equal(await editor.evaluate(el=>el.open),true);await editor.locator('[data-advent-close]').last().click();await page.evaluate(()=>document.exitFullscreen());
  await page.evaluate(async()=>{const {createBoardPreview}=await import('/boards/preview.js');window.preview=createBoardPreview({inlineObjects:[serializeBoardModule(advent)]});document.body.append(preview);});
  assert.equal(await page.locator('.board-card__preview .advent-cabinet .advent-door').count(),24);await page.evaluate(()=>preview.remove());
  await page.emulateMedia({reducedMotion:'reduce'});await tile.locator('.advent-cabinet [data-day="1"]').click();await page.waitForTimeout(100);assert.equal(await tile.locator('.advent-prize h3').textContent(),'Class Drawing Time');await tile.locator('.advent-reset-day').click();
  assert.equal(await page.evaluate(()=>advent._boardGetState().cards[1].opened),false);
  assert.equal(await page.evaluate(()=>advent._boardGetState().cards[1].title),'Class Drawing Time');
  const before=await page.evaluate(()=>effects);await tile.locator('.advent-cabinet [data-day="1"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>effects),before+1);await tile.locator('.advent-reveal-close').click();
  await tile.hover();await tile.locator('.advent-reset-all').click();assert(await page.evaluate(()=>advent._boardGetState().cards.every(card=>!card.opened)));assert.equal(await page.evaluate(()=>advent._boardGetState().cards[0].title),'Cozy Reading Day');
  await tile.evaluate(el=>{el.style.width='560px';el.style.height='630px';el.style.left='100px';el.style.top='100px'});await page.mouse.move(1400,900);await page.waitForTimeout(500);
  if(process.env.ADVENT_SCREENSHOT){await tile.screenshot({path:process.env.ADVENT_SCREENSHOT});await tile.hover();await tile.locator('.advent-edit').click();await editor.screenshot({path:process.env.ADVENT_SCREENSHOT.replace('.png','-editor.png')});}
  assert.deepEqual(errors,[]);console.log('Advent editor, images, 24 drawers, day limits, effects, replay, save/restore, reset, previews, scaling, fullscreen and reduced motion passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
