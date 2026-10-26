const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('firebase-auth.js','utf8');
async function verify(isDistrict){
 const events=[],context={organizationBusy:false,currentUser:{uid:'new',email:'new@example.com',displayName:'New'},db:{},organizationFeedback:{},organizationInvites:[{id:'invite'}],organizationIndexLoadedAt:123,organizationMemberships:[],
  normalizeOrganizationEmail:value=>value,organizationMemberDocument:(org,uid)=>org+'_'+uid,organizationInviteDocument:id=>id,
  setOrganizationFeedback(){},renderNotificationInbox(){},renderOrganizationInvitations(){},console,
  firestoreSdk:{serverTimestamp:()=>123,writeBatch:()=>({set(ref,data){assert.equal(data.role,'Member');assert.equal(data.joinedAt,123);events.push('member');},delete(){events.push('invite');},async commit(){events.push('commit');}})},
  async loadOrganizationIndex(){assert(events.includes('commit'));context.organizationMemberships=[{id:'district',isDistrict}];events.push('index');},
  async refreshShopAccount(){assert(events.includes('index'));await new Promise(resolve=>setTimeout(resolve,10));events.push('premium');}
 };
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function acceptOrganizationInvite('),source.indexOf('async function declineOrganizationInvite(')),context);
 await context.acceptOrganizationInvite({id:'invite',organizationId:'district',organizationName:'School'});
 assert.deepEqual(events,isDistrict?['member','invite','commit','index','premium']:['member','invite','commit','index']);assert.equal(context.organizationBusy,false);assert.equal(context.organizationInvites.length,0);
}
(async()=>{await verify(true);await verify(false);console.log('PASS: joining a District refreshes Premium after membership commit before finishing; regular joins add no account reads.');})().catch(error=>{console.error(error);process.exitCode=1;});
