'use strict';
const fs=require('node:fs'),path=require('node:path');
function buildSandbox(target){
  const root=path.resolve(target);
  const dev=path.join(root,'sandbox');
  const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
  if(!app.includes('id="workspace"'))throw Error('Expected the board app before constructing the sandbox site.');
  const guarded=app.replace('<head>','<head>\n  <script src="sandbox/board-gate.js?v=20261012-subscription-preview"></script>');
  fs.writeFileSync(path.join(root,'board.html'),guarded);
  fs.copyFileSync(path.join(dev,'portal.html'),path.join(root,'index.html'));
}
module.exports={buildSandbox};
if(require.main===module){if(!process.argv[2])throw Error('Provide the sandbox deployment directory.');buildSandbox(process.argv[2]);}
