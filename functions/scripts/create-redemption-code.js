"use strict";

const crypto = require("node:crypto");
const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { COIN_PACKS } = require("../catalog");

const projectId = String(process.env.TEACHERTILES_FIREBASE_PROJECT || "").trim();
const packId = process.argv[2];
const pack = COIN_PACKS[packId];
if (!projectId) {
  console.error("Set TEACHERTILES_FIREBASE_PROJECT to the intended Firebase project ID before generating codes.");
  process.exitCode = 1;
  return;
}
if (!pack) {
  console.error(`Usage: npm run code:create -- <${Object.keys(COIN_PACKS).join("|")}>`);
  process.exitCode = 1;
  return;
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bytes = crypto.randomBytes(12);
const body = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
const code = `TT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
const normalized = code.replace(/[^A-Z0-9]/g, "");
const hash = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");

initializeApp({ credential: applicationDefault(), projectId });

getFirestore().collection("redemptionCodes").doc(hash).create({
  packId,
  coins: pack.coins,
  active: true,
  redeemedBy: null,
  redeemedAt: null,
  createdBy: "trusted-admin-script",
  createdAt: Timestamp.now()
}).then(() => {
  console.log(`Created one-time ${pack.coins.toLocaleString()} coin code: ${code}`);
}).catch(error => {
  console.error("Could not create the redemption code:", error.message);
  process.exitCode = 1;
});
