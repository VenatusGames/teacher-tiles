"use strict";
const fs=require('node:fs'),vm=require('node:vm');
function mergeFirebaseConfig(committed,injected){
 if(!injected||typeof injected!=='object'||Array.isArray(injected)||!injected.apiKey||!injected.projectId)throw Error('Firebase config needs apiKey and projectId');
 const config={...injected};
 const firebaseDomain=domain=>typeof domain==='string'&&/\.(firebaseapp\.com|web\.app)$/.test(domain);
 // A default SDK config pasted into Actions must not undo an established custom
 // sign-in domain. Never carry a live project's domain into the separate dev project.
 if(committed.projectId===config.projectId&&committed.authDomain&&!firebaseDomain(committed.authDomain)&&(!config.authDomain||firebaseDomain(config.authDomain)))config.authDomain=committed.authDomain;
 return config;
}
function writeFirebaseConfig(file,input){
 const source=fs.readFileSync(file,'utf8');
 if(!/^export const firebaseConfig\s*=/m.test(source))throw Error('Expected a static exported Firebase configuration');
 const context={module:{exports:{}}};
 vm.runInNewContext(source.replace(/^export const firebaseConfig\s*=/m,'module.exports ='),context,{timeout:1000});
 const config=mergeFirebaseConfig(context.module.exports,JSON.parse(input));
 fs.writeFileSync(file,`export const firebaseConfig = ${JSON.stringify(config,null,2)};\n`);
 return config;
}
module.exports={mergeFirebaseConfig,writeFirebaseConfig};
if(require.main===module){if(!process.argv[2])throw Error('Usage: node scripts/write-firebase-config.cjs <firebase-config.js>');writeFirebaseConfig(process.argv[2],fs.readFileSync(0,'utf8'));}
