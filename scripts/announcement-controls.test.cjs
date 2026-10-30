const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());requests.push(u.pathname+u.search);if(u.hostname!=='tiles.test')return r.abort();
  if(u.pathname==='/fixture')return r.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/support/announcements.css"><button id="count"></button><div id="list" style="max-width:390px"></div>'});
  if(u.pathname==='/firebase-auth-version-fixture.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync('firebase-auth.js','utf8').split("import {createSubscriberCoinNotice}")[0]});
  const f=path.join(process.cwd(),decodeURIComponent(u.pathname));return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});
 });
 await page.goto('https://tiles.test/fixture');await page.clock.install();
 await page.evaluate(async()=>{
  const {createAnnouncementNotifications}=await import('/support/announcements.js?v=live-test');window.uid='alice';window.counts={subscribe:0,unsubscribe:0,receipts:0,list:0,read:0};window.callbacks=[];window.receipts={};
  window.item={id:'one',title:'Update',message:'Fresh announcement',revision:1,createdAt:Date.now(),expiresAt:Date.now()+86400000};
  window.inbox=createAnnouncementNotifications(async(_name,input)=>{counts[input.action]++;if(input.action==='read'){if(window.failRead)throw Error('offline');if(window.delayReadRevision===input.revision)return new Promise(resolve=>window.finishDelayedRead=resolve);return {read:true}}return {items:[{...item,read:false}],serverTime:Date.now()}},()=>uid,()=>{document.querySelector('#count').textContent=inbox.count;const list=document.querySelector('#list');list.replaceChildren();inbox.render(list)},{subscribe(next,error){counts.subscribe++;callbacks.push({next,error});return ()=>counts.unsubscribe++},async readReceipts(){counts.receipts++;return receipts}});
  await Promise.all(Array.from({length:8},()=>inbox.refresh()));callbacks.at(-1).next({items:{one:item}});
 });

 await page.waitForFunction(()=>inbox.size===1);
 assert.equal(await page.locator('.announcement-time span').textContent(),'24h');
 await page.clock.fastForward(3601000);
 assert.equal(await page.locator('.announcement-time span').textContent(),'23h');
 assert.deepEqual(await page.evaluate(()=>counts),{subscribe:1,unsubscribe:0,receipts:1,list:0,read:0});
 await page.evaluate(()=>failRead=true);await page.getByRole('button',{name:'Mark as Read',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.announcement-read-status').textContent.includes('Could not save'));
 assert.equal(await page.evaluate(()=>inbox.count),1);assert(await page.getByRole('button',{name:'Mark as Read',exact:true}).isEnabled());
 await page.evaluate(()=>failRead=false);await page.getByRole('button',{name:'Mark as Read',exact:true}).click();
 await page.waitForFunction(()=>inbox.count===0);assert(await page.getByRole('button',{name:'Read',exact:true}).isDisabled());assert.equal(await page.locator('.announcement-reader').count(),0);
 assert.equal(await page.evaluate(()=>counts.read),2);
 await page.getByRole('button',{name:'View announcement',exact:true}).click();await page.getByRole('button',{name:'Close announcement',exact:true}).click();assert.equal(await page.evaluate(()=>counts.read),2);
 await page.evaluate(()=>{item={...item,revision:2,title:'A new announcement with a longer title for teachers',expiresAt:Date.now()+1800000};callbacks.at(-1).next({items:{one:item}})});
 assert.equal(await page.evaluate(()=>inbox.count),1);assert.equal(await page.locator('.announcement-time span').textContent(),'1h');
 await page.setViewportSize({width:390,height:844});assert(await page.locator('.announcement-card').evaluate(e=>e.scrollWidth<=e.clientWidth));
 await page.screenshot({path:require('os').tmpdir()+'/announcement-countdown.png'});
 await page.clock.fastForward(1800100);assert.equal(await page.locator('.announcement-card').count(),0);assert.equal(await page.evaluate(()=>counts.read),2);assert.equal(await page.evaluate(()=>counts.list),0);
 assert.deepEqual(errors,[]);console.log('PASS: direct Mark as Read, retry, no duplicate acknowledgement, new revision unread, local hourly countdown, zero additional reads/writes, expiry and mobile layout.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
