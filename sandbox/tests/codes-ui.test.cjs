const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Jack/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const backend = process.env.TT_FUNCTIONS_DIR || 'C:/Users/Jack/Desktop/Teacher Tiles/teachertiles-functions-dev/functions';
const codes = require(path.join(backend,'firebase-service/redemption-codes'));

// Shop parity prevents backend omissions from silently hiding valid rewards.
const vm = require('node:vm');
const app = fs.readFileSync(path.resolve(__dirname,'../../app.js'),'utf8');
const shop = fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const skins = vm.runInNewContext(app.slice(app.indexOf('const TILE_SKIN_CATALOG='),app.indexOf('const CURSOR_COLOR_PACK_PRODUCT_ID='))+';TILE_SKIN_CATALOG');
const stickers = vm.runInNewContext(app.slice(app.indexOf('const stickerCatalogItems='),app.indexOf('const COLLECTION_PACK_PRODUCTS='))+';ADDITIONAL_STICKER_PACKS');
const products = new Map();
for(const match of shop.matchAll(/<article\b([^>]*)>/g)) {
  const id=match[1].match(/data-shop-product="([^"]+)"/)?.[1],price=match[1].match(/data-shop-price="(\d+)"/)?.[1];
  if(id && price)products.set(id,Number(price));
}
for(const pack of stickers)products.set(pack.productId,pack.price);
const rewards = new Map(codes.getRedemptionCatalog().cosmetics.map(item=>[item.rewardId,item]));
for(const skin of skins)assert.ok(products.has(skin.productId),'Skin not present in shop: '+skin.productId);
for(const [id,price] of products) {
  assert.ok(rewards.has(id),'Shop cosmetic missing from rewards: '+id);
  assert.equal(rewards.get(id).coinPrice,price,'Shop price mismatch: '+id);
  codes.normalizeCreateInput({requestId:'catalog-check',rewardType:'cosmetic',rewardId:id,maxRedemptions:1});
}

const calls = [], errors = [];
const id = 'a'.repeat(64);
const item = {id,code:'TT-ABCD-EFAB',codeHint:'TT-••••-AB',rewardName:'500 TeacherTiles Coins',active:true,status:'active',completedUses:2,maxRedemptions:5,pendingReservations:1,expiresAt:{_seconds:2000000000},label:'Test'};
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
    await page.addInitScript(()=>{});
    await page.setContent('<body class="developer-portal"><main></main></body>');
    await page.addStyleTag({content:fs.readFileSync(path.resolve(__dirname,'../portal.css'),'utf8')});
    await page.addStyleTag({content:fs.readFileSync(path.resolve(__dirname,'../portal-appearance.css'),'utf8')});
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
    assert.equal(await page.locator('#codes-detail h2').textContent(),item.code);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedCode=text;}}}));
    await page.locator('[data-code-copy]').click();
    assert.equal(await page.evaluate(()=>window.copiedCode),item.code);
    await page.locator('[data-codes-detail-close]').click();
    await page.getByRole('button',{name:'Generate Code',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('#codes-reward-options button').length===4);
    assert.match(await page.locator('#codes-reward-options button').first().textContent(),/500/);
    assert.equal(await page.getByRole('button',{name:'Generate',exact:true}).isDisabled(),true);
    await page.getByRole('searchbox',{name:'Search Rewards'}).fill('1200');
    await page.locator('[data-reward-id="coins-1200"]').click();
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
    await page.waitForFunction(()=>document.querySelectorAll('#codes-reward-options button').length>4);
    // Every backend cosmetic is selectable, with parity against the actual shop.
    for(const item of codes.getRedemptionCatalog().cosmetics) assert.equal(await page.locator(`[data-reward-id="${item.rewardId}"]`).count(),1,item.rewardId);
    const search=page.getByRole('searchbox',{name:'Search Rewards'});
    for(const [query,id] of [['Neon Timer','tile-skin-timer-neon'],['Liquid Fill','tile-skin-timer-liquid']]){await search.fill(query);assert.equal(await page.locator('#codes-reward-options button').count(),1);await page.locator('[data-reward-id="'+id+'"]').click();assert.equal(await page.locator('#codes-create-reward').inputValue(),id);}
    await search.fill('neon lava');
    assert.equal(await page.locator('#codes-reward-options button').count(),1);
    await page.locator('[data-reward-id="tile-skin-lavalamp-neon"]').click();
    assert.equal(await page.locator('#codes-create-reward').inputValue(),'tile-skin-lavalamp-neon');
    await search.fill('does not exist');
    await page.getByText('No matching rewards. Try another search.').waitFor();
    assert.match(await page.locator('#codes-selected-reward').textContent(),/Neon/);
    await search.fill('theme');
    await page.screenshot({path:process.env.TT_CODES_SCREENSHOT || path.join(require('os').tmpdir(),'tt-codes-reward-search.png')});
    const picker=await page.locator('#codes-reward-options').boundingBox();assert.ok(picker.height<=155);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.querySelector('#codes-create').getBoundingClientRect().right<=innerWidth));
    await page.setViewportSize({width:1280,height:720});
    const firstTheme=page.locator('#codes-reward-options button').first();await firstTheme.focus();await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#codes-reward-options button').nth(1).getAttribute('aria-checked'),'true');
    await page.getByRole('button',{name:'Generate',exact:true}).click();
    await page.locator('#codes-result').waitFor({state:'visible'});
    assert.equal(calls.filter(c=>c.action==='create').at(-1).rewardType,'cosmetic');
    await page.locator('[data-codes-result-close]').click();
    await page.getByRole('button',{name:'Generate Code',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#codes-create-type').disabled);
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
    assert.ok(calls.filter(c=>c.action==='catalog').length>=3,'Catalog refreshes for each new code dialog');
    assert.deepEqual(errors,[]);
    console.log('Verified '+products.size+' cosmetics, including '+skins.length+' skins, against the shop.');
    console.log('PASS: actual dev reward catalog and create validation, omitted All filters, pagination, detail, safe retry, all shop cosmetics and full-code copying, coin/cosmetic/trial generation, reward search, keyboard selection, bounded list, catalog refresh, disable, delete, and no browser errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
