const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const backend = process.env.TT_FUNCTIONS_DIR || 'C:/Users/Jack/Desktop/Teacher Tiles/teachertiles-functions-dev/functions';
const codes = require(path.join(backend,'firebase-service/redemption-codes'));
const calls = [], errors = [];
const id = 'a'.repeat(64);
const item = {id,codeHint:'TT-••••-AB',rewardName:'500 TeacherTiles Coins',active:true,status:'active',completedUses:2,maxRedemptions:5,pendingReservations:1,expiresAt:{_seconds:2000000000},label:'Test'};
let failCreate = true;
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.exposeFunction('backendCall',async (name,data)=>{
      calls.push(data); assert.equal(name,'developerCodes');
      if(data.action==='catalog')return {data:codes.getRedemptionCatalog()};
      if(data.action==='list') {
        assert.notEqual(data.rewardType,'all'); assert.notEqual(data.status,'all');
        return {data:{items:[{...item,id:data.cursor?'b'.repeat(64):id}],cursor:data.cursor?null:id}};
      }
      if(data.action==='create') {
        codes.normalizeCreateInput(data);
        if(failCreate){failCreate=false;throw new Error('Temporary connection error');}
        return {data:{code:'TT-ABCD-EFGH',codeId:id,rewardType:data.rewardType,rewardId:data.rewardId}};
      }
      assert.equal(data.codeId,id);
      if(data.action==='detail')return {data:{...item,redemptions:[{id:'user-one',status:'completed',createdAt:{seconds:1800000000}}],reservations:[]}};
      return {data:{}};
    });
    await page.setContent('<main></main>');
    await page.addScriptTag({content:fs.readFileSync(path.resolve(__dirname,'../codes.js'),'utf8').replace('export function','function')});
    await page.evaluate(async()=>{
      window.panel=createCodesPanel(window.backendCall);
      document.querySelector('main').append(panel.element);panel.element.hidden=false;await panel.load();
    });
    assert.equal(Object.hasOwn(calls[0],'rewardType'),false);
    await page.locator('#codes-status').selectOption('all');
    await page.waitForFunction(()=>document.querySelector('#codes-status-text').textContent==='1 code');
    assert.equal(Object.hasOwn(calls.at(-1),'status'),false);
    await page.locator('#codes-more').click();
    await page.getByText('2 codes',{exact:true}).waitFor();
    await page.locator('[data-code-detail]').first().click();
    await page.getByText('user-one',{exact:true}).waitFor();
    await page.locator('[data-codes-detail-close]').click();
    await page.getByRole('button',{name:'Generate Code',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('#codes-create-reward option').length===4);
    assert.match(await page.locator('#codes-create-reward option').first().textContent(),/500/);
    await page.locator('#codes-create-reward').selectOption('coins-1200');
    await page.locator('#codes-create-limit').fill('3');
    await page.getByRole('button',{name:'Generate',exact:true}).click();
    await page.getByText('Temporary connection error',{exact:false}).waitFor();
    await page.evaluate(()=>{const form=document.querySelector('#codes-create-form');form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
    await page.getByText('TT-ABCD-EFGH',{exact:true}).waitFor();
    const creates=calls.filter(c=>c.action==='create');
    assert.equal(creates[1].rewardId,'coins-1200');
    assert.equal(creates.length,2);assert.equal(creates[0].requestId,creates[1].requestId);
    assert.equal(creates[0].maxRedemptions,3);assert.equal(Object.hasOwn(creates[0],'trialDays'),false);
    await page.locator('[data-codes-result-close]').click();
    await page.getByRole('button',{name:'Generate Code',exact:true}).click();
    await page.locator('#codes-create-type').selectOption('cosmetic');
    assert.ok(await page.locator('#codes-create-reward option[value="theme-basic"]').count());
    await page.locator('#codes-create-type').selectOption('membership_trial');
    await page.locator('#codes-create-days').fill('7');
    await page.getByRole('button',{name:'Generate',exact:true}).click();
    await page.locator('#codes-result').waitFor({state:'visible'});
    const trial=calls.filter(c=>c.action==='create').at(-1);
    assert.equal(trial.rewardId,'membership_trial');assert.equal(trial.trialDays,7);
    assert.notEqual(trial.requestId,creates[0].requestId);
    await page.locator('[data-codes-result-close]').click();
    await page.locator('[data-code-toggle]').first().click();
    await page.waitForFunction(()=>document.querySelector('#codes-status-text').textContent==='1 code');
    assert.ok(calls.some(c=>c.action==='set-active'&&c.codeId===id&&c.active===false));
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-code-delete]').first().click();
    await page.waitForTimeout(100);
    assert.ok(calls.some(c=>c.action==='delete'&&c.codeId===id));
    assert.deepEqual(errors,[]);
    console.log('PASS: actual dev reward catalog and create validation, omitted All filters, pagination, detail, safe retry, coin/cosmetic/trial options, disable, delete, and no browser errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
