const assert=require('node:assert/strict');
const {grantSubscriptionCoins}=require('./subscription-rewards');
(async()=>{
 const records=new Map([['users/test',{coinBalance:90,ownedProductIds:['theme-wood']}]]);
 const ref=path=>({path,collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});
 const db={collection:name=>({doc:id=>ref(`${name}/${id}`)}),runTransaction:async fn=>fn({get:async r=>({exists:records.has(r.path),data:()=>records.get(r.path)}),set:(r,data,options)=>records.set(r.path,options?.merge?{...records.get(r.path),...data}:data),create:(r,data)=>{assert(!records.has(r.path));records.set(r.path,data)}})};
 const options={db,prices:{price_member:{}},stripe:{subscriptions:{retrieve:async()=>({id:'sub_1',metadata:{purpose:'teachertiles_subscription'},items:{data:[{price:{id:'price_member'}}]}})}},resolveUid:async()=> 'test',stamp:()=>123};
 const invoice={id:'in_1',status:'paid',billing_reason:'subscription_cycle',parent:{subscription_details:{subscription:'sub_1'}}};
 await grantSubscriptionCoins({...options,invoice});assert.equal(records.get('users/test').coinBalance,590);
 await grantSubscriptionCoins({...options,invoice});assert.equal(records.get('users/test').coinBalance,590,'duplicate invoice must not grant twice');
 await grantSubscriptionCoins({...options,invoice:{...invoice,id:'in_2',billing_reason:'subscription_update'}});assert.equal(records.get('users/test').coinBalance,590,'proration must not earn monthly coins');
 await grantSubscriptionCoins({...options,invoice:{...invoice,id:'in_3',status:'open'}});assert.equal(records.get('users/test').coinBalance,590);
 await grantSubscriptionCoins({...options,invoice:{id:'in_4',status:'paid',billing_reason:'subscription_create',subscription:'sub_1'}});assert.equal(records.get('users/test').coinBalance,1090);
 assert.deepEqual(records.get('users/test').ownedProductIds,['theme-wood']);
 console.log('Subscription rewards: duplicate, unpaid, proration, initial and renewal checks passed.');
})();
