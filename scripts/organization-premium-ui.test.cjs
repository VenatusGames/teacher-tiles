const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE);
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.cwd();
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='tiles.test')return r.abort();if(u.pathname==='/fixture')return r.fulfill({contentType:'text/html',body:fs.readFileSync('sandbox/portal.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')});const file=path.join(root,decodeURIComponent(u.pathname));return fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});});
 await page.goto('https://tiles.test/fixture');
 await page.evaluate(async()=>{
  document.querySelector('#portal-access-screen').hidden=true;document.querySelector('.portal-shell').hidden=false;document.querySelector('.portal-shell').inert=false;document.querySelector('#portal-home').hidden=false;
  const {createInsights}=await import('/sandbox/insights.js');window.calls=0;const now=Date.now();window.insights=createInsights(async()=>{calls++;return {data:{asOf:now,total:20,online:5,active24Hours:10,subscribers:2,paidSubscribers:2,trialSubscribers:3,orgSubscribers:4,history:[{at:now-86400000,online:2,paidSubscribers:1,trialSubscribers:2},{at:now,online:5,paidSubscribers:2,trialSubscribers:3,orgSubscribers:4}]}}});await insights.load();
 });
 await page.locator('.insight-subscribers [data-membership-kind=org]').click();
 assert.equal(await page.locator('[data-stat=subscribers]').textContent(),'4');assert.equal(await page.locator('.trend-orgSubscribers .trend-summary strong').textContent(),'4');
 assert.equal(await page.locator('.trend-orgSubscribers .trend-mark').count(),1,'Legacy snapshots must not turn into zero Org observations');
 assert.equal(await page.locator('[data-membership-kind=org][aria-pressed=true]').count(),3);
 await page.waitForTimeout(700);await page.screenshot({path:process.env.TEMP+'/org-subscriptions-overview.png'});
 await page.locator('.trend-orgSubscribers [data-membership-kind=trials]').click();assert.equal(await page.locator('[data-stat=subscribers]').textContent(),'3');
 await page.locator('.insight-subscribers [data-membership-kind=paid]').click();assert.equal(await page.locator('[data-stat=subscribers]').textContent(),'2');assert.equal(await page.evaluate(()=>calls),1);
 await page.setViewportSize({width:390,height:844});await page.locator('.insight-subscribers [data-membership-kind=org]').click();assert(await page.locator('.insight-subscribers').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:process.env.TEMP+'/org-subscriptions-mobile.png'});
 // Exercise the real shop render functions, including their entitlement cache.
 await page.setContent('<div class="shop-membership-card"><h3>Premium Subscription</h3><div class="shop-membership-price"></div><div class="shop-membership-card__foot"></div><button id="shop-subscribe-preview"></button></div><article data-shop-product="theme"><h3>Theme</h3></article>');
 const shop=fs.readFileSync('shop/ui.js','utf8');await page.addScriptTag({content:fs.readFileSync('shop/cosmetic-services.js','utf8')+`
 window.TeacherTilesAccount={state:{ready:true,signedIn:true,ownedProductIds:[],subscriptionActive:false,subscriptionOverride:true,districtPremium:true}};
 const accountState=()=>TeacherTilesAccount.state,products=[document.querySelector('article')],membershipCard=document.querySelector('.shop-membership-card'),membershipTitle=membershipCard.querySelector('h3'),membershipDefaultTitle=membershipTitle.textContent,subscribePreview=document.querySelector('button');let membershipCheckoutBusy=false;
 `+shop.slice(shop.indexOf('  const productDisplayState='),shop.indexOf('  function syncShop()'))+'syncMembership();syncProducts();'});
 assert.equal(await page.locator('.shop-membership-card h3').textContent(),'Subscription Active (Through Organization!)');assert.equal(await page.locator('.subscription-access-crown').getAttribute('title'),'Unlocked via Organization Seat');assert(await page.locator('button').isHidden());
 await page.evaluate(()=>{TeacherTilesAccount.state.districtPremium=false;syncMembership();syncProducts();});assert.equal(await page.locator('.subscription-access-crown').getAttribute('title'),'Unlocked via subscription');assert.equal(await page.locator('h3').first().textContent(),'Subscription Active!');
 await page.evaluate(()=>{TeacherTilesAccount.state.ownedProductIds=['theme'];syncProducts();});assert.equal(await page.locator('.subscription-access-crown').count(),0);
 await page.evaluate(()=>{TeacherTilesAccount.state.subscriptionOverride=false;syncMembership();});assert.equal(await page.locator('h3').first().textContent(),'Premium Subscription');assert(await page.locator('button').isVisible());
 // Exercise the actual organization loader with out-of-order memberships.
 const auth=fs.readFileSync('firebase-auth.js','utf8');await page.addScriptTag({content:`
 let currentUser={uid:'me'},db={},organizationMemberships=[],organizationIndexLoadedAt=0,organizationIndexPromise=null;const ORGANIZATION_CACHE_TTL=300000;
 const rows=[{id:'a',name:'A regular'},{id:'z',name:'Z District',isDistrict:true},{id:'b',name:'B District',isDistrict:true},{id:'c',name:'C regular'}];
 const organizationDocument=id=>id,renderOrganizationList=()=>{},firestoreSdk={collection:()=>null,where:()=>null,query:()=>null,getDocs:async()=>({docs:rows.map(r=>({data:()=>({organizationId:r.id})}))}),getDoc:async id=>({id,exists:()=>true,data:()=>rows.find(r=>r.id===id)})};
 `+auth.slice(auth.indexOf('async function loadOrganizationIndex('),auth.indexOf('function setOrganizationEditorOpen('))});
 assert.deepEqual(await page.evaluate(async()=>(await loadOrganizationIndex()).map(o=>o.name)),['B District','Z District','A regular','C regular']);assert.deepEqual(errors,[]);
 console.log('PASS: Org tabs/counts/trends and mobile layout, no tab reads, organization shop/crown source changes, owned cosmetics, District ordering.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
