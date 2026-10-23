const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('firebase-auth.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.pathname.includes('board-gate'))return r.abort();if(u.pathname.endsWith('/shopManagement'))return r.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});if(u.hostname!=='tiles.test')return r.abort();let local=decodeURIComponent(u.pathname.replace(/^\/dev/,'')||'/');if(local==='/board.html')local='/index.html';const f=path.join(root,local);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
await page.goto('https://tiles.test/dev/board.html');await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');window.TeacherTilesAuth={user:null,call:async()=>({})};window.TeacherTilesSandbox={subscriptionEnabled:true};});



await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'old-class',name:'Homeroom',logo:'🦉',students:['Alice','Ben'],starChart:{wholeClassStars:8,studentStars:{'student:alice':12}},punchcards:{studentPoints:{'student:alice':3},studentProgress:{'student:alice':4}},racer:{studentWins:{'student:alice':2},positions:{'student:alice':56}},eggHatching:{studentPoints:{'student:alice':7}},flowerPots:{studentPoints:{'student:alice':5}}}]));document.querySelector('#profile-classes-button').click();});

const edit=page.getByRole('button',{name:'Edit Homeroom',exact:true});
await page.mouse.move(1400,900);await page.locator('.cs-search input').focus();await page.waitForTimeout(200);
assert.equal(await edit.evaluate(e=>getComputedStyle(e).opacity),'0');
await page.getByRole('button',{name:'Open Homeroom',exact:true}).hover();await page.waitForTimeout(200);
assert.equal(await edit.evaluate(e=>getComputedStyle(e).opacity),'1');
assert(await edit.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.right<b.right&&a.top<b.top+20}));
await page.getByRole('button',{name:'Open Homeroom',exact:true}).click();
await page.getByRole('button',{name:"Open Alice's student profile",exact:true}).click();await page.getByRole('button',{name:'PBIS View rewards',exact:true}).click();
async function adjust(label,action,quantity){
 await page.getByRole('button',{name:`${action} ${label}`,exact:true}).click();
 await page.getByRole('spinbutton',{name:'Amount',exact:true}).fill(String(quantity));
 await page.locator('.cs-form button[type=submit]').click();
}
async function exercise(){
 const labels=await page.locator('.cs-stat h4').allTextContents();
 assert.equal(await page.locator('.cs-stat-icon>svg').count(),labels.length);
 for(const label of labels){
  const stat=page.locator('.cs-stat').filter({has:page.getByRole('heading',{name:label,exact:true})});
  const original=Number(await stat.locator('.cs-stat-value').textContent());
  await adjust(label,'Add',3);assert.equal(Number(await stat.locator('.cs-stat-value').textContent()),original+3);
  await adjust(label,'Redeem',2);assert.equal(Number(await stat.locator('.cs-stat-value').textContent()),original+1);
  await adjust(label,'Redeem',original+2);assert.match(await page.locator('.cs-form .cs-error').textContent(),/available to redeem/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await adjust(label,'Redeem',1);assert.equal(Number(await stat.locator('.cs-stat-value').textContent()),original);
 }
}
await exercise();
assert.equal(await page.evaluate(()=>readClassRosters()[0].punchcards.studentProgress['student:alice']),4);
assert.equal(await page.evaluate(()=>readClassRosters()[0].racer.positions['student:alice']),56);
// A balance changed by another tile while the dialog is open must not be overwritten.
await page.getByRole('button',{name:'Add Stars',exact:true}).click();
await page.evaluate(()=>writeClassStarChart('old-class',{...readClassRosters()[0].starChart,studentStars:{'student:alice':20}}));
await page.getByRole('spinbutton',{name:'Amount',exact:true}).fill('2');await page.locator('.cs-form button[type=submit]').click();
assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alice']),22);
await adjust('Stars','Add',9999);assert.match(await page.locator('.cs-form .cs-error').textContent(),/cannot exceed/);await page.getByRole('button',{name:'Cancel',exact:true}).click();
await page.screenshot({path:process.env.TEMP+'/tt-class-rewards-desktop.png'});
await page.setViewportSize({width:390,height:844});
assert(await page.locator('.cs-detail').evaluate(e=>e.scrollWidth<=e.clientWidth));
assert(await page.locator('.cs-stat-actions').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth)));
await page.screenshot({path:process.env.TEMP+'/tt-class-rewards-mobile.png'});
await page.getByRole('button',{name:'Close Student Profile',exact:true}).click();
await page.getByRole('button',{name:'View whole-class PBIS rewards',exact:true}).click();await exercise();
page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset Stars',exact:true}).click();
assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.wholeClassStars),0);
assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alice']),22);
assert(await page.getByRole('button',{name:'Redeem Stars',exact:true}).isDisabled());
await page.reload();await page.waitForFunction(()=>window.TeacherTilesPresentations);
assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.studentStars['student:alice']),22);
assert.equal(await page.evaluate(()=>readClassRosters()[0].starChart.wholeClassStars),0);
assert.deepEqual(errors,[]);console.log('PASS: hover class edit, monochrome icons, all student and whole-class reward counters, add/redeem/reset, overdraft/overflow validation, latest balance, progress preservation, persistence and mobile bounds.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
