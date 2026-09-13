"use strict";
// Signed invoice.paid events award coins once per invoice, never on prorations.
async function grantSubscriptionCoins({invoice,stripe,db,prices,resolveUid,stamp}){
  if(invoice.status!=="paid"||!["subscription_create","subscription_cycle"].includes(invoice.billing_reason))return false;
  const raw=invoice.parent?.subscription_details?.subscription||invoice.subscription;
  const id=typeof raw==="string"?raw:raw?.id;if(!id)return false;
  const subscription=await stripe.subscriptions.retrieve(id);
  if(subscription.metadata?.purpose!=="teachertiles_subscription"||!subscription.items?.data?.some(item=>prices[item.price?.id]))return false;
  const uid=await resolveUid(subscription);if(!uid)throw new Error("Subscription invoice has no linked account");
  const user=db.collection("users").doc(uid),grant=db.collection("stripeSubscriptionCoinGrants").doc(invoice.id);
  await db.runTransaction(async tx=>{const [existing,account]=await Promise.all([tx.get(grant),tx.get(user)]);if(existing.exists)return;
    const balance=Number(account.data()?.coinBalance)||0;
    tx.set(user,{coinBalance:balance+500,updatedAt:stamp()},{merge:true});
    tx.create(grant,{uid,subscriptionId:id,invoiceId:invoice.id,coins:500,grantedAt:stamp()});
    tx.set(user.collection("coinTransactions").doc(invoice.id),{type:"subscription_reward",amount:500,invoiceId:invoice.id,createdAt:stamp()});
  });return true;
}
module.exports={grantSubscriptionCoins};
