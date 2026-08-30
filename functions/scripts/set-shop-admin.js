"use strict";

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const projectId = String(process.env.TEACHERTILES_FIREBASE_PROJECT || "").trim();
const uid = String(process.argv[2] || "").trim();
if (!projectId) {
  console.error("Set TEACHERTILES_FIREBASE_PROJECT to the intended Firebase project ID before granting admin access.");
  process.exitCode = 1;
  return;
}
if (!uid) {
  console.error("Usage: npm run admin:set -- <FIREBASE_UID>");
  process.exitCode = 1;
  return;
}

initializeApp({ credential: applicationDefault(), projectId });

getAuth().getUser(uid).then(user => {
  const claims = user.customClaims || {};
  return getAuth().setCustomUserClaims(uid, { ...claims, shopAdmin: true });
}).then(() => {
  console.log(`Granted shopAdmin access to Firebase user ${uid}. The user must sign out and back in to refresh the claim.`);
}).catch(error => {
  console.error("Could not grant shopAdmin access:", error.message);
  process.exitCode = 1;
});
