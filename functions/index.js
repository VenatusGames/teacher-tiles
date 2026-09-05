"use strict";

const crypto = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const Stripe = require("stripe");
const { COIN_PACKS, COSMETIC_PRODUCTS } = require("./catalog");

initializeApp();

const db = getFirestore();
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const REGION = "us-central1";

function requireUser(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in to use the TeacherTiles shop.");
  }
  return request.auth.uid;
}

function accountRef(uid) {
  return db.collection("users").doc(uid);
}

function publicAccount(data = {}) {
  const balance = Number(data.coinBalance);
  const owned = Array.isArray(data.ownedProductIds) ? data.ownedProductIds : [];
  return {
    coinBalance: Number.isSafeInteger(balance) ? balance : 0,
    ownedProductIds: [...new Set(owned.filter(id => typeof id === "string" && COSMETIC_PRODUCTS[id]))]
  };
}

async function ensureAccount(uid) {
  const ref = accountRef(uid);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      transaction.create(ref, {
        coinBalance: 0,
        ownedProductIds: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });
  return ref.get();
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(value) {
  return crypto.createHash("sha256").update(normalizeCode(value), "utf8").digest("hex");
}

function generateReadableCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  const body = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
  return `TT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

function validatedReturnUrl(value) {
  let url;
  try {
    url = new URL(String(value || "https://teachertiles.com/"));
  } catch {
    throw new HttpsError("invalid-argument", "The checkout return page is invalid.");
  }

  const productionOrigins = new Set(["https://teachertiles.com", "https://www.teachertiles.com"]);
  const localHost = ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
  if (!productionOrigins.has(url.origin) && !localHost) {
    throw new HttpsError("permission-denied", "That checkout return page is not allowed.");
  }

  url.username = "";
  url.password = "";
  url.hash = "";
  url.searchParams.delete("tt_checkout");
  return url;
}

function stripeClient() {
  return new Stripe(stripeSecretKey.value());
}

exports.getShopAccount = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  return publicAccount((await ensureAccount(uid)).data());
});

exports.createCoinCheckoutSession = onCall(
  { region: REGION, secrets: [stripeSecretKey] },
  async request => {
    const uid = requireUser(request);
    const packId = String(request.data?.packId || "");
    const pack = COIN_PACKS[packId];
    if (!pack) throw new HttpsError("invalid-argument", "Choose a valid coin pack.");

    const returnUrl = validatedReturnUrl(request.data?.returnUrl);
    const successUrl = new URL(returnUrl.href);
    const cancelUrl = new URL(returnUrl.href);
    successUrl.searchParams.set("tt_checkout", "success");
    cancelUrl.searchParams.set("tt_checkout", "cancelled");

    try {
      const session = await stripeClient().checkout.sessions.create({
        mode: "payment",
        client_reference_id: uid,
        customer_email: request.auth.token.email || undefined,
        success_url: successUrl.href,
        cancel_url: cancelUrl.href,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.unitAmount,
            product_data: {
              name: pack.name,
              description: "Virtual coins for cosmetic items inside TeacherTiles",
              tax_code: "txcd_10000000"
            }
          }
        }],
        metadata: {
          purpose: "teachertiles_coin_pack",
          firebaseUid: uid,
          coinPackId: packId
        },
        payment_intent_data: {
          metadata: {
            purpose: "teachertiles_coin_pack",
            firebaseUid: uid,
            coinPackId: packId
          }
        }
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return { url: session.url };
    } catch (error) {
      logger.error("Could not create Stripe Checkout Session", { uid, packId, error });
      throw new HttpsError("internal", "Checkout could not be started. Please try again.");
    }
  }
);

async function fulfillCoinCheckout(session, eventId) {
  if (session.metadata?.purpose !== "teachertiles_coin_pack") return;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;

  const uid = String(session.metadata?.firebaseUid || session.client_reference_id || "");
  const packId = String(session.metadata?.coinPackId || "");
  const pack = COIN_PACKS[packId];
  if (!uid || !pack) throw new Error("Checkout Session has invalid TeacherTiles metadata.");
  if (session.currency !== "usd" || session.amount_total !== pack.unitAmount) {
    throw new Error("Checkout Session total does not match the TeacherTiles coin catalog.");
  }

  const grantRef = db.collection("stripeCoinGrants").doc(session.id);
  const userRef = accountRef(uid);
  const transactionRef = userRef.collection("coinTransactions").doc(session.id);

  await db.runTransaction(async transaction => {
    const [grantSnapshot, userSnapshot] = await Promise.all([
      transaction.get(grantRef),
      transaction.get(userRef)
    ]);
    if (grantSnapshot.exists) return;

    const current = publicAccount(userSnapshot.data());
    transaction.set(userRef, {
      coinBalance: current.coinBalance + pack.coins,
      ownedProductIds: current.ownedProductIds,
      createdAt: userSnapshot.exists ? (userSnapshot.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(grantRef, {
      uid,
      packId,
      coins: pack.coins,
      amountPaid: pack.unitAmount,
      currency: "usd",
      stripeEventId: eventId,
      paymentIntentId: session.payment_intent || null,
      grantedAt: FieldValue.serverTimestamp()
    });
    transaction.set(transactionRef, {
      type: "stripe_purchase",
      amount: pack.coins,
      packId,
      stripeCheckoutSessionId: session.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });
}

exports.stripeWebhook = onRequest(
  { region: REGION, secrets: [stripeSecretKey, stripeWebhookSecret], cors: false },
  async (request, response) => {
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).send("Method Not Allowed");
      return;
    }

    let event;
    try {
      const signature = request.headers["stripe-signature"];
      if (!signature) throw new Error("Missing Stripe-Signature header.");
      event = stripeClient().webhooks.constructEvent(request.rawBody, signature, stripeWebhookSecret.value());
    } catch (error) {
      logger.warn("Stripe webhook signature verification failed", { message: error.message });
      response.status(400).send("Invalid webhook signature");
      return;
    }

    try {
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
        await fulfillCoinCheckout(event.data.object, event.id);
      }
      response.status(200).json({ received: true });
    } catch (error) {
      logger.error("Stripe webhook fulfillment failed", { eventId: event.id, type: event.type, error });
      response.status(500).send("Webhook fulfillment failed");
    }
  }
);

exports.purchaseCosmetic = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const productId = String(request.data?.productId || "");
  const product = COSMETIC_PRODUCTS[productId];
  if (!product) throw new HttpsError("invalid-argument", "Choose a valid cosmetic pack.");

  const userRef = accountRef(uid);
  const purchaseRef = userRef.collection("cosmeticPurchases").doc(productId);
  let alreadyOwned = false;

  await db.runTransaction(async transaction => {
    const [userSnapshot, purchaseSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(purchaseRef)
    ]);
    const account = publicAccount(userSnapshot.data());
    const listedOwned = account.ownedProductIds.includes(productId);
    if (purchaseSnapshot.exists || listedOwned) {
      alreadyOwned = true;
      if (purchaseSnapshot.exists && !listedOwned) {
        transaction.set(userRef, {
          ownedProductIds: [...account.ownedProductIds, productId],
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return;
    }
    if (account.coinBalance < product.price) {
      throw new HttpsError("failed-precondition", "You do not have enough coins for this pack.", {
        balance: account.coinBalance,
        price: product.price,
        shortfall: product.price - account.coinBalance
      });
    }

    transaction.set(userRef, {
      coinBalance: account.coinBalance - product.price,
      ownedProductIds: [...account.ownedProductIds, productId],
      createdAt: userSnapshot.exists ? (userSnapshot.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.create(purchaseRef, {
      productId,
      productName: product.name,
      price: product.price,
      purchasedAt: FieldValue.serverTimestamp()
    });
  });

  return { ...publicAccount((await userRef.get()).data()), alreadyOwned };
});

exports.redeemCoinCode = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const normalized = normalizeCode(request.data?.code);
  if (normalized.length < 8 || normalized.length > 32) {
    throw new HttpsError("invalid-argument", "Enter a valid TeacherTiles code.");
  }

  const codeRef = db.collection("redemptionCodes").doc(hashCode(normalized));
  const userRef = accountRef(uid);
  let grantedCoins = 0;

  await db.runTransaction(async transaction => {
    const [codeSnapshot, userSnapshot] = await Promise.all([
      transaction.get(codeRef),
      transaction.get(userRef)
    ]);
    if (!codeSnapshot.exists) throw new HttpsError("not-found", "That code is not valid.");
    const code = codeSnapshot.data();
    if (code.active === false) throw new HttpsError("failed-precondition", "That code is no longer active.");
    if (code.redeemedAt || code.redeemedBy) throw new HttpsError("already-exists", "That code has already been used.");

    const pack = COIN_PACKS[code.packId];
    if (!pack || code.coins !== pack.coins) throw new HttpsError("failed-precondition", "That code is not configured correctly.");
    grantedCoins = pack.coins;
    const account = publicAccount(userSnapshot.data());

    transaction.set(userRef, {
      coinBalance: account.coinBalance + pack.coins,
      ownedProductIds: account.ownedProductIds,
      createdAt: userSnapshot.exists ? (userSnapshot.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(codeRef, { redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp() });
    transaction.set(userRef.collection("coinTransactions").doc(`code-${codeSnapshot.id}`), {
      type: "redemption_code",
      amount: pack.coins,
      packId: code.packId,
      codeHash: codeSnapshot.id,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ...publicAccount((await userRef.get()).data()), grantedCoins };
});

// Ready for a future admin screen; unavailable without an admin custom claim.
exports.generateCoinCode = onCall({ region: REGION }, async request => {
  requireUser(request);
  if (request.auth.token.shopAdmin !== true && request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Shop administrator access is required.");
  }

  const packId = String(request.data?.packId || "");
  const pack = COIN_PACKS[packId];
  if (!pack) throw new HttpsError("invalid-argument", "Choose a valid coin pack.");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReadableCode();
    const ref = db.collection("redemptionCodes").doc(hashCode(code));
    try {
      await ref.create({
        packId,
        coins: pack.coins,
        active: true,
        redeemedBy: null,
        redeemedAt: null,
        createdBy: request.auth.uid,
        createdAt: Timestamp.now()
      });
      return { code, packId, coins: pack.coins };
    } catch (error) {
      if (error.code !== 6 && error.code !== "already-exists") throw error;
    }
  }
  throw new HttpsError("internal", "A unique code could not be generated. Try again.");
});
