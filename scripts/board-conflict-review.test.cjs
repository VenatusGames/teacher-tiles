const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('teacherTilesSandboxCoinsEnabled','true');
      window.testSounds=[];
      window.Audio=class extends EventTarget{
        constructor(src){super();Object.assign(this,{src,paused:true,volume:1,currentTime:0,duration:20});testSounds.push(this)}
        play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}load(){}removeAttribute(){}cloneNode(){return new Audio(this.src)}
      };
    });
    await page.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));return u.hostname==='tiles.test'&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
    await page.route('**/firebase-auth.js?*',route=>{
      const source=fs.readFileSync('firebase-auth.js','utf8').replace('initializeFirebaseAuth();',`window.seedConflictReview=async()=>{
        currentUser={uid:'conflict-test'};db={};activeBoardId='';
        const remote={name:'Morning board',schemaVersion:1,theme:'light',frames:[{id:'f',name:'Cloud frame'}],preferences:{},calendarEvents:[],inlineObjects:[{id:'a',type:'text',x:100,y:100,width:220,height:180,special:{text:'Cloud lesson'}}],storageFormat:'inline-v2',revision:2,contentHash:'cloud',stateChunkCount:0,stateChunkHashes:[]};
        firestoreSdk={doc:(_, ...parts)=>({id:parts.at(-1)}),getDocFromServer:async()=>({id:'one',exists:()=>true,data:()=>remote}),serverTimestamp:()=>100,deleteField:()=>null,runTransaction:async(_,callback)=>callback({get:async()=>({exists:()=>true,data:()=>remote}),set:(_,data)=>Object.assign(remote,data),delete:()=>{}})};
        boardList=[normalizeBoardMetadata({id:'one',data:()=>remote})];boardList[0].revision=1;boardList[0].cloudContentHash='old';
        await cacheSnapshotLocally('one',{theme:'light',frames:[{id:'f',name:'Local frame'}],objects:[{id:'a',type:'text',x:200,y:200,width:220,height:180,special:{text:'Local lesson'}}]},{dirty:true});
        await preserveConflictingBoard('one');modal.hidden=true;boardsView.hidden=false;document.body.classList.add('boards-screen-open');renderBoards();
      };`);
      return route.fulfill({body:source,contentType:'text/javascript'});
    });
    await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);


    await page.evaluate(()=>window.seedConflictReview());
    assert.equal(await page.locator('.board-card').count(),1);await page.locator('.board-card__conflict').click();
    await page.locator('.board-conflict-merge button').waitFor();assert.equal(await page.locator('.board-conflict-versions .board-card__preview').count(),2);
    assert((await page.locator('.board-conflict-frames').allTextContents()).includes('Local frame'));
    await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/board-conflict-review.png'});
    await page.locator('.board-conflict-close').click();assert.equal(await page.locator('.board-card__conflict').count(),1);
    await page.locator('.board-card__conflict').click();await page.locator('.board-conflict-merge button').click();await page.locator('.board-conflict-review').waitFor({state:'detached'});
    assert.equal(await page.locator('.board-card').count(),1);assert.equal(await page.locator('.board-card__conflict').count(),0);assert.deepEqual(errors,[]);console.log('Conflict badge, previews, review later and merge UI passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
