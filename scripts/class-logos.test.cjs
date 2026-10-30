const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('firebase-auth.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.pathname.includes('board-gate'))return r.abort();if(u.pathname.endsWith('/shopManagement'))return r.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});if(u.hostname!=='tiles.test')return r.abort();let local=decodeURIComponent(u.pathname.replace(/^\/dev/,'')||'/');if(local==='/board.html')local='/index.html';const f=path.join(root,local);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
await page.goto('https://tiles.test/dev/board.html');await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');window.TeacherTilesAuth={user:null,call:async()=>({})};window.TeacherTilesSandbox={subscriptionEnabled:true};});



await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'old-class',name:'Homeroom',logo:'🦉',students:['Alice','Ben'],starChart:{wholeClassStars:8,studentStars:{'student:alice':12}},punchcards:{studentPoints:{'student:alice':3},studentProgress:{'student:alice':4}},racer:{studentWins:{'student:alice':2},positions:{'student:alice':56}},eggHatching:{studentPoints:{'student:alice':7}},flowerPots:{studentPoints:{'student:alice':5}}}]));document.querySelector('#profile-classes-button').click();});


assert.equal(await page.locator('.pres-brand>.profile-tool-beta').textContent(),'BETA');
assert.equal(await page.locator('#profile-organizations-title>.profile-tool-beta').textContent(),'BETA');
await page.getByRole('button',{name:'Open Homeroom',exact:true}).click();
assert(await page.getByRole('button',{name:'Assessment Coming soon',exact:true}).isDisabled());
assert(await page.getByRole('button',{name:'ClassConnect Coming soon',exact:true}).isDisabled());
assert.deepEqual(await page.locator('.cs-class-modules>button').allTextContents(),['AssessmentComing soon','ClassConnectComing soon','PBIS']);
const photo=await page.screenshot({clip:{x:0,y:0,width:512,height:512}});
await page.getByRole('button',{name:'Edit Class',exact:true}).click();
await page.getByRole('textbox',{name:'Class name',exact:true}).fill('Owls');
await page.locator('input[aria-label="Upload class image"]').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:photo});
await page.waitForFunction(()=>document.querySelector('.cs-form-preview img')?.naturalWidth===256);
await page.getByRole('button',{name:'Save Changes',exact:true}).click();
assert.equal(await page.locator('.cs-class-info h2').textContent(),'Owls');assert(await page.locator('.cs-class-info img').isVisible());
const saved=await page.evaluate(()=>readClassRosters()[0]);assert(saved.logoImage.startsWith('data:image/webp;base64,'));assert(saved.logoImage.length<=48000);assert.deepEqual(saved.students,['Alice','Ben']);assert.equal(saved.starChart.studentStars['student:alice'],12);
await page.getByRole('button',{name:'View whole-class PBIS rewards',exact:true}).click();assert(await page.locator('.cs-detail-hero img').isVisible());await page.getByRole('button',{name:'Close Whole-Class Rewards',exact:true}).click();
await page.screenshot({path:process.env.TEMP+'/tt-class-header-desktop.png'});
await page.setViewportSize({width:390,height:844});assert(await page.locator('.cs-content').evaluate(e=>e.scrollWidth<=e.clientWidth));assert(await page.locator('.cs-class-header').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:process.env.TEMP+'/tt-class-header-mobile.png'});
await page.getByRole('button',{name:'All Classes',exact:true}).click();assert(await page.getByRole('button',{name:'Open Owls',exact:true}).locator('img').isVisible());
await page.reload();await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');document.querySelector('#profile-classes-button').click();});
assert.equal(await page.evaluate(()=>readClassRosters()[0].logoImage),saved.logoImage);
await page.getByRole('button',{name:'Open Owls',exact:true}).click();await page.getByRole('button',{name:'Edit Class',exact:true}).click();await page.getByRole('button',{name:'Use 🚀',exact:true}).click();await page.getByRole('button',{name:'Save Changes',exact:true}).click();assert.equal(await page.evaluate(()=>readClassRosters()[0].logoImage),'');assert.equal(await page.locator('.cs-class-info>.cs-avatar').textContent(),'🚀');
await page.getByRole('button',{name:'All Classes',exact:true}).click();await page.getByRole('button',{name:'New Class',exact:true}).click();await page.getByRole('textbox',{name:'Class name',exact:true}).fill('New Photo Class');await page.locator('input[aria-label="Upload class image"]').setInputFiles({name:'logo.png',mimeType:'image/png',buffer:photo});await page.waitForFunction(()=>document.querySelector('.cs-form-preview img')?.naturalWidth===256);await page.getByRole('button',{name:'Create Class',exact:true}).click();assert(await page.getByRole('button',{name:'Open New Photo Class',exact:true}).locator('img').isVisible());
assert.deepEqual(errors,[]);console.log('PASS: class header buttons and editing, class image create/update/emoji replacement, 256px image persistence, PBIS preservation, mobile bounds and shared BETA badges.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
