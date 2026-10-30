const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage(),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());requests.push(u.pathname+u.search);if(u.hostname!=='tiles.test')return r.abort();
  if(u.pathname==='/fixture')return r.fulfill({contentType:'text/html',body:'<button id="count"></button><div id="list"></div>'});
  if(u.pathname==='/firebase-auth-version-fixture.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync('firebase-auth.js','utf8').split("import {createSubscriberCoinNotice}")[0]});
  const f=path.join(process.cwd(),decodeURIComponent(u.pathname));return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});
 });
 await page.goto('https://tiles.test/fixture');await page.clock.install();
 await page.evaluate(async()=>{
  const {createAnnouncementNotifications}=await import('/support/announcements.js?v=live-test');window.uid='alice';window.counts={subscribe:0,unsubscribe:0,receipts:0,list:0,read:0};window.callbacks=[];window.receipts={one:1};
  window.item={id:'one',title:'Update',message:'Fresh announcement',revision:1,createdAt:Date.now(),expiresAt:Date.now()+86400000};
  window.inbox=createAnnouncementNotifications(async(_name,input)=>{counts[input.action]++;if(input.action==='read'){if(window.delayReadRevision===input.revision)return new Promise(resolve=>window.finishDelayedRead=resolve);return {read:true}}return {items:[{...item,read:false}],serverTime:Date.now()}},()=>uid,()=>{document.querySelector('#count').textContent=inbox.count;const list=document.querySelector('#list');list.replaceChildren();inbox.render(list)},{subscribe(next,error){counts.subscribe++;callbacks.push({next,error});return ()=>counts.unsubscribe++},async readReceipts(){counts.receipts++;return receipts}});
  await Promise.all(Array.from({length:8},()=>inbox.refresh()));callbacks.at(-1).next({items:{one:item}});
 });
 await page.waitForFunction(()=>inbox.size===1);assert.equal(await page.evaluate(()=>inbox.count),0);
 assert.deepEqual(await page.evaluate(()=>counts),{subscribe:1,unsubscribe:0,receipts:1,list:0,read:0});
 await page.clock.fastForward(1800000);await page.evaluate(async()=>{for(let i=0;i<6;i++){await inbox.refresh(true);window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'))}});
 assert.deepEqual(await page.evaluate(()=>counts),{subscribe:1,unsubscribe:0,receipts:1,list:0,read:0});
 await page.evaluate(()=>{item={...item,revision:2,message:'Edited now'};callbacks.at(-1).next({items:{one:item}})});assert.equal(await page.evaluate(()=>inbox.count),1);
 await page.getByRole('button',{name:'View announcement'}).click();await page.waitForFunction(()=>inbox.count===0);await page.getByRole('button',{name:'Close announcement'}).click();
 assert.equal(await page.evaluate(()=>counts.read),1);assert.equal(await page.evaluate(()=>counts.receipts),1);
 await page.evaluate(()=>{callbacks.at(-1).next({items:{one:item}})});assert.equal(await page.evaluate(()=>inbox.count),0);
 // An older acknowledgement finishing late must not undo a newer read revision.
 await page.evaluate(()=>{delayReadRevision=3;item={...item,revision:3};callbacks.at(-1).next({items:{one:item}})});
 await page.getByRole('button',{name:'View announcement'}).click();await page.getByRole('button',{name:'Close announcement'}).click();
 await page.evaluate(()=>{item={...item,revision:4};callbacks.at(-1).next({items:{one:item}})});
 await page.getByRole('button',{name:'View announcement'}).click();await page.waitForFunction(()=>inbox.count===0);await page.getByRole('button',{name:'Close announcement'}).click();
 await page.evaluate(async()=>{finishDelayedRead({read:true});await Promise.resolve();callbacks.at(-1).next({items:{one:item}})});assert.equal(await page.evaluate(()=>inbox.count),0);
 // Authentication changes detach the stream and reject old callbacks.
 await page.evaluate(async()=>{window.old=callbacks.at(-1);uid='bob';inbox.reset();receipts={};await inbox.refresh();old.next({items:{stale:{...item,id:'stale'}}});callbacks.at(-1).next({items:{one:item}})});
 await page.waitForFunction(()=>inbox.count===1);assert.equal(await page.evaluate(()=>inbox.size),1);assert.equal(await page.evaluate(()=>counts.unsubscribe),1);
 // Rollout failure uses a bounded fallback, then recovers on reconnect without cache clearing.
 await page.evaluate(async()=>{callbacks.at(-1).error(Error('permission denied'));await inbox.refresh();await inbox.refresh()});
 assert.equal(await page.evaluate(()=>counts.list),1);
 await page.clock.fastForward(61000);await page.evaluate(async()=>{await inbox.refresh();callbacks.at(-1).next({items:{one:{...item,revision:3}}})});
 assert.equal(await page.evaluate(()=>counts.subscribe),3);assert.equal(await page.evaluate(()=>counts.receipts),2);
 await page.evaluate(()=>{uid=null;inbox.reset()});assert.equal(await page.evaluate(()=>inbox.count),0);
 // A failed receipt read retries promptly; notifications are still delivered in the meantime.
 await page.evaluate(async()=>{uid='carol';receipts={one:3};let fail=true;const {createAnnouncementNotifications}=await import('/support/announcements.js?v=live-test');window.retry=createAnnouncementNotifications(async()=>{throw Error('unexpected callable')},()=>uid,()=>{},{subscribe(next){window.pushRetry=next;return ()=>{}},async readReceipts(){window.retryReads=(window.retryReads||0)+1;if(fail){fail=false;throw Error('offline')}return receipts}});await retry.refresh();pushRetry({items:{one:{...item,revision:3}}})});
 await page.waitForFunction(()=>retry.size===1);assert.equal(await page.evaluate(()=>retry.count),1);await page.clock.fastForward(16000);await page.waitForFunction(()=>retry.count===0);assert.equal(await page.evaluate(()=>retryReads),2);
 await page.evaluate(()=>{uid=null;retry.reset()});
 // Each deployed entry version also versions its announcement import.
 await page.evaluate(()=>import('/firebase-auth-version-fixture.js?v=release-a'));
 await page.evaluate(()=>import('/firebase-auth-version-fixture.js?v=release-b'));
 assert(requests.includes('/support/announcements.js?v=release-a'));assert(requests.includes('/support/announcements.js?v=release-b'));
 assert.deepEqual(errors,[]);console.log('PASS: immediate live updates, 30 idle minutes with zero polling calls/writes, one receipt read, revision unread state, account isolation, fallback/reconnect, receipt retry, deployment-version propagation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
