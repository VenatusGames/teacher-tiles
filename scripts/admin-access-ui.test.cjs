const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage({viewport:{width:1100,height:800}});
await page.route('**/*',route=>{const url=new URL(route.request().url());const relative=url.pathname.replace(/^\/sandbox\//,'/');const file=path.join(process.cwd(),decodeURIComponent(relative==='/'?'/index.html':relative));return url.hostname==='tiles.test'&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.abort()});
await page.goto('http://tiles.test/sandbox/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
assert(await page.locator('#sandbox-access-gate').isVisible());assert.equal(await page.locator('#workspace').evaluate(e=>e.inert||!!e.closest('[inert]')),true);assert.equal(await page.locator('#sandbox-dev-console-toggle').count(),0);
await page.evaluate(()=>{window.boardKeys=0;document.addEventListener('keydown',()=>boardKeys++);document.body.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}))});assert.equal(await page.evaluate(()=>boardKeys),0);
await page.evaluate(()=>TeacherTilesAdminAccess.update({portalRole:'moderator'},'ordinary@example.com'));assert(await page.locator('#sandbox-access-gate').isVisible());assert.match(await page.locator('#sandbox-access-gate p').innerText(),/does not have admin access/);
// Role verification is covered separately; exercise the gate's rendering after approval.
await page.evaluate(()=>TeacherTilesAdminAccess.update({portalRole:'admin'},'admin@example.com'));await page.waitForTimeout(400);assert.equal(await page.locator('#sandbox-access-gate').isVisible(),false);assert.equal(await page.locator('#workspace').evaluate(e=>e.inert),false);
await page.evaluate(()=>TeacherTilesAdminAccess.update());assert(await page.locator('#sandbox-access-gate').isVisible());
await page.screenshot({path:'C:/Users/Jack/.codex/visualizations/2026/09/21/01a0c154-6a92-74e3-80e0-b301d930cec6/sandbox-admin-lock.png'});
await page.goto('http://tiles.test/',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('#sandbox-access-gate').count(),0);assert.equal(await page.locator('#sandbox-dev-console-toggle').count(),0);
console.log('PASS: sandbox fail-closed gate, keyboard blocking, denied/admin/signout states, production unaffected');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
