'use strict';
const fs=require('node:fs'),path=require('node:path');

// Run on the temporary deployment copy, before cache-busting assets.
// index.html remains the board source on every branch; the homepage has its own source.
function buildSite(target,branch){
  if(!['main','sandbox','dev'].includes(branch))throw Error('Choose main, sandbox or dev for the site build.');
  const root=path.resolve(target);
  const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
  if(!app.includes('id="workspace"'))throw Error('Expected the board source in index.html. Build from a fresh deployment copy.');
  if(branch==='main'){
    const home=fs.readFileSync(path.join(root,'home-site','index.html'),'utf8');
    if(home.includes('id="workspace"')||!home.includes('home-site/script.js')||!home.includes('href="/board.html"'))throw Error('Missing or invalid TeacherTiles homepage.');
    if(app.includes('sandbox/board-gate.js'))throw Error('Main must use the public board source, not an already-built sandbox board.');
    fs.writeFileSync(path.join(root,'board.html'),app);
    fs.writeFileSync(path.join(root,'index.html'),home);
  }else{
    // Branch identity determines access rules, never the presence of a copied folder.
    require(path.join(root,'sandbox','build.cjs')).buildSandbox(root);
    const board=fs.readFileSync(path.join(root,'board.html'),'utf8');
    const portal=fs.readFileSync(path.join(root,'index.html'),'utf8');
    if(!board.includes('sandbox/board-gate.js')||!portal.includes('id="portal-access-screen"'))throw Error('Expected the protected developer portal and board.');
  }
}
module.exports={buildSite};
if(require.main===module){
  const [target,branch]=process.argv.slice(2);
  if(!target||!branch)throw Error('Usage: node scripts/build-site.cjs <deployment directory> <main|sandbox|dev>');
  buildSite(target,branch);
}
