"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildBanners}=require('./build-banners.cjs'),{buildSite}=require('./build-site.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tt-banner-test-'));t.after(()=>{if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('tt-banner-test-'))throw Error('Unsafe fixture path');fs.rmSync(dir,{recursive:true,force:true});});return dir;}
test('image index discovers additions, nested folders and spaces, without altering source files',t=>{
 const root=fixture(t),folder=path.join(root,'banners');fs.mkdirSync(path.join(folder,'holidays'),{recursive:true});fs.mkdirSync(path.join(folder,'_private'));
 for(const file of ['Fall Event.png','holidays/winter.svg','_private/hidden.png','README.md','.hidden.jpg'])fs.writeFileSync(path.join(folder,file),'original bytes');
 let list=buildBanners(root);assert.deepEqual(list.map(x=>x.path),['banners/Fall%20Event.png','banners/holidays/winter.svg']);
 fs.writeFileSync(path.join(folder,'new.webp'),'new bytes');list=buildBanners(root);assert.equal(list.length,3);assert.equal(fs.readFileSync(path.join(folder,'Fall Event.png'),'utf8'),'original bytes');assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'index.json'))).images.length,3);
});
test('the dev site build refreshes the banner index automatically',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'sandbox'));fs.mkdirSync(path.join(root,'banners'));fs.writeFileSync(path.join(root,'index.html'),'<html><head></head><body><div id="workspace"></div></body></html>');fs.copyFileSync(path.join(__dirname,'../sandbox/build.cjs'),path.join(root,'sandbox/build.cjs'));fs.writeFileSync(path.join(root,'sandbox/portal.html'),'<div id="portal-access-screen"></div>');fs.writeFileSync(path.join(root,'banners/new.png'),'image');buildSite(root,'dev');assert.equal(JSON.parse(fs.readFileSync(path.join(root,'banners/index.json'))).images[0].path,'banners/new.png');assert(fs.readFileSync(path.join(root,'board.html'),'utf8').includes('id="workspace"'));
});
