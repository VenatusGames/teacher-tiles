const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('firebase-auth.js'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.pathname.includes('board-gate'))return r.abort();if(u.pathname.endsWith('/shopManagement'))return r.fulfill({json:{revision:0,products:{},bundles:{},sales:{},banners:{hidden:[],removed:[],custom:[]},serverTime:Date.now()}});if(u.hostname!=='tiles.test')return r.abort();let local=decodeURIComponent(u.pathname.replace(/^\/dev/,'')||'/');if(local==='/board.html')local='/index.html';const f=path.join(root,local);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
await page.goto('https://tiles.test/dev/board.html');await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');window.TeacherTilesAuth={user:null,call:async()=>({})};window.TeacherTilesSandbox={subscriptionEnabled:true};});



await page.evaluate(()=>{localStorage.setItem(classRostersStorageKey(),JSON.stringify([{id:'old-class',name:'Homeroom',logo:'🦉',students:['Alice','Ben'],starChart:{wholeClassStars:8,studentStars:{'student:alice':12}},punchcards:{studentPoints:{'student:alice':3},studentProgress:{'student:alice':4}},racer:{studentWins:{'student:alice':2},positions:{'student:alice':56}},eggHatching:{studentPoints:{'student:alice':7}},flowerPots:{studentPoints:{'student:alice':5}}}]));document.querySelector('#profile-classes-button').click();});

await page.evaluate(()=>{window.savedClasses=[];window.TeacherTilesEncryptedClasses={save:async classes=>savedClasses.push(classes)}});
assert.deepEqual(await page.evaluate(()=>{const c=readClassRosters()[0];return [c.gradeLevel,c.pbisEnabled,c.starChart.studentStars['student:alice']]}),['',true,12]);
const grades=['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12','Higher-Ed'];
assert.deepEqual(await page.evaluate(()=>CLASS_GRADE_LEVELS.map(g=>[g,defaultClassPbisEnabled(g)])),grades.map(g=>[g,g!=='Higher-Ed'&&!(Number(g)>=7)]));
for(const grade of ['Pre-K','6','7','Higher-Ed']){
 await page.getByRole('button',{name:'New Class',exact:true}).click();
 const select=page.getByRole('combobox',{name:'Class grade level',exact:true});
 assert.deepEqual(await select.locator('option').allTextContents(),['Not set',...grades]);
 await select.selectOption(grade);await page.getByRole('textbox',{name:'Class name',exact:true}).fill('Class '+grade);
 await page.getByRole('button',{name:'Create Class',exact:true}).click();
 const card=page.getByRole('button',{name:'Open Class '+grade,exact:true});
 assert.equal(await card.locator('.cs-class-grade').textContent(),Number(grade)?'Grade '+grade:grade);
 const positions=await card.locator('small').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert(positions[1]>positions[0]);
 await card.click();await page.getByRole('button',{name:'Class Settings',exact:true}).click();
 const pbis=page.getByRole('switch',{name:'Enable PBIS',exact:true});assert.equal(await pbis.isChecked(),grade!=='7'&&grade!=='Higher-Ed');
 if(grade==='7')await pbis.check();
 await page.getByRole('button',{name:'Close Class Settings',exact:true}).click();
 await page.getByRole('button',{name:'All Classes',exact:true}).click();
}
await page.getByRole('button',{name:'Open Class 7',exact:true}).hover();await page.getByRole('button',{name:'Edit Class 7',exact:true}).click();
assert.equal(await page.getByRole('combobox',{name:'Class grade level',exact:true}).inputValue(),'7');
await page.getByRole('combobox',{name:'Class grade level',exact:true}).selectOption('9');await page.getByRole('button',{name:'Save Changes',exact:true}).click();
assert.deepEqual(await page.evaluate(()=>{const c=readClassRosters().find(c=>c.name==='Class 7');return [c.gradeLevel,c.pbisEnabled]}),['9',true]);
await page.waitForFunction(()=>savedClasses.at(-1)?.some(c=>c.name==='Class 7'&&c.gradeLevel==='9'&&c.pbisEnabled));
await page.evaluate(()=>{const c=readClassRosters()[0];writeClassStarChart(c.id,{...c.starChart,wholeClassStars:13});flushPbisCloudSave()});
assert.equal(await page.evaluate(()=>readClassRosters().find(c=>c.name==='Class 7').gradeLevel),'9');
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'New Class',exact:true}).click();assert(await page.locator('.cs-form:visible').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.getByRole('button',{name:'Cancel',exact:true}).click();
await page.reload();await page.waitForFunction(()=>window.TeacherTilesPresentations);await page.evaluate(()=>{document.querySelector('#teachertiles-intro')?.remove();document.documentElement.classList.remove('sandbox-access-locked');document.querySelector('#profile-classes-button').click();});
assert.equal(await page.getByRole('button',{name:'Open Class 7',exact:true}).locator('.cs-class-grade').textContent(),'Grade 9');
assert.equal(await page.evaluate(()=>readClassRosters().find(c=>c.name==='Class Higher-Ed').pbisEnabled),false);
assert.deepEqual(errors,[]);console.log('PASS: all grade choices, legacy classes, 6/7 boundary and Higher-Ed PBIS defaults, explicit override preserved, card labels, encrypted-save payload, progress updates, mobile form and reload.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
