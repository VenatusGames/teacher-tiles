"use strict";

const crypto = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const Stripe = require("stripe");
const { COIN_PACKS, COSMETIC_PRODUCTS, SUBSCRIPTION_PRICES } = require("./catalog");
const {
  accountRef,
  contextLog,
  createContext,
  refreshContext,
  resolveFirebaseUidForStripeObject,
  isSubscriptionActive
} = require("./context");


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

function publicAccount(data = {}) {
  const balance = Number(data.coinBalance);
  const owned = Array.isArray(data.ownedProductIds) ? data.ownedProductIds : [];
  return {
    coinBalance: Number.isSafeInteger(balance) ? balance : 0,
    ownedProductIds: [...new Set(owned.filter(id => typeof id === "string" && COSMETIC_PRODUCTS[id]))],
    subscriptionActive: isSubscriptionActive(data)
  };
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

function logFunctionStart(functionName, context) {
  logger.info(`Function ${functionName} started`, {
    functionName,
    context: contextLog(context)
  });
}

function normalizeLogError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
      code: error.code ?? null,
      details: error.details ?? null
    };
  }

  if (error && typeof error === "object") {
    return {
      name: error.name ?? null,
      message: error.message ?? JSON.stringify(error),
      stack: error.stack ?? null,
      code: error.code ?? null,
      details: error.details ?? null
    };
  }

  return {
    name: typeof error,
    message: String(error),
    stack: null,
    code: null,
    details: null
  };
}

function logFunctionSuccess(functionName, context) {
  logger.info(`Function ${functionName} succeeded`, {
    functionName,
    uid: context?.uid || null
  });
}

function logFunctionWarning(functionName, context, error) {
  logger.warn(`Function ${functionName} warning`, {
    functionName,
    uid: context?.uid || null,
    error: normalizeLogError(error)
  });
}

function logFunctionError(functionName, context, error) {
  logger.error(`Function ${functionName} failed`, {
    functionName,
    uid: context?.uid || null,
    error: normalizeLogError(error)
  });
}

function getTransactionTypeFromMetadata(stripeObject) {
  const purpose = stripeObject?.metadata?.purpose;

  if (purpose === "teachertiles_coin_pack") {
    return "coin_checkout";
  }

  if (purpose === "teachertiles_subscription") {
    return "membership_subscription";
  }

  throw new Error("Stripe object is not a recognized TeacherTiles transaction.");
}

exports.getShopAccount = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const context = await createContext({
    db,
    uid,
    source: "getShopAccount",
    request,
    publicAccount,
    ensureUserAccount: true
  });
  logFunctionStart("getShopAccount", context);
  logFunctionSuccess("getShopAccount", context);
  return context.account.public;
});

exports.getSubscriptionStatus = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const context = await createContext({
    db,
    uid,
    source: "getSubscriptionStatus",
    request,
    publicAccount,
    ensureUserAccount: true
  });
  logFunctionStart("getSubscriptionStatus", context);
  const data = context.account?.data || {};

  logFunctionSuccess("getSubscriptionStatus", context);
  return {
    isActive: isSubscriptionActive(data),
    status: data.subscriptionStatus || "inactive",
    subscriptionId: data.subscriptionId || null,
    currentPeriodEnd: data.subscriptionCurrentPeriodEnd ? data.subscriptionCurrentPeriodEnd.toDate?.() : null,
    startedAt: data.subscriptionStartedAt ? data.subscriptionStartedAt.toDate?.() : null,
    cancelledAt: data.subscriptionCancelledAt ? data.subscriptionCancelledAt.toDate?.() : null
  };
});

exports.createCoinCheckoutSession = onCall(
  { region: REGION, secrets: [stripeSecretKey] },
  async request => {
    const uid = requireUser(request);
    const context = await createContext({
      db,
      uid,
      source: "createCoinCheckoutSession",
      transactionType: "coin_checkout",
      request,
      publicAccount,
      ensureUserAccount: true
    });
    logFunctionStart("createCoinCheckoutSession", context);
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
        customer_email: context.request?.email || undefined,
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
      logFunctionSuccess("createCoinCheckoutSession", context);
      return { url: session.url };
    } catch (error) {
      logFunctionError("createCoinCheckoutSession", context, error);
      throw new HttpsError("internal", "Checkout could not be started. Please try again.");
    }
  }
);

exports.createSubscriptionCheckoutSession = onCall(
  { region: REGION, secrets: [stripeSecretKey] },
  async request => {
    const uid = requireUser(request);
    const context = await createContext({
      db,
      uid,
      source: "createSubscriptionCheckoutSession",
      transactionType: "membership_subscription",
      request,
      publicAccount,
      ensureUserAccount: true
    });
    logFunctionStart("createSubscriptionCheckoutSession", context);
    const priceId = String(request.data?.priceId || "");
    const price = SUBSCRIPTION_PRICES[priceId];
    if (!price) throw new HttpsError("invalid-argument", "Choose a valid subscription plan.");

    const returnUrl = validatedReturnUrl(request.data?.returnUrl);
    const successUrl = new URL(returnUrl.href);
    const cancelUrl = new URL(returnUrl.href);
    successUrl.searchParams.set("tt_checkout", "success");
    cancelUrl.searchParams.set("tt_checkout", "cancelled");

    try {
      const subscriptionMetadata = {
        purpose: "teachertiles_subscription",
        firebaseUid: uid,
        priceId: priceId
      };

      const session = await stripeClient().checkout.sessions.create({
        mode: "subscription",
        client_reference_id: uid,
        customer_email: context.request?.email || undefined,
        success_url: successUrl.href,
        cancel_url: cancelUrl.href,
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        metadata: subscriptionMetadata,
        subscription_data: {
          metadata: subscriptionMetadata
        }
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      logFunctionSuccess("createSubscriptionCheckoutSession", context);
      return { url: session.url };
    } catch (error) {
      logFunctionError("createSubscriptionCheckoutSession", context, error);
      throw new HttpsError("internal", "Subscription checkout could not be started. Please try again.");
    }
  }
);

async function fulfillCoinCheckout(context, session, eventId) {
  if (session.metadata?.purpose !== "teachertiles_coin_pack") return context;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return context;

  const uid = String(context.uid || "");
  const packId = String(session.metadata?.coinPackId || "");
  const pack = COIN_PACKS[packId];
  if (!uid || !pack) throw new Error("Checkout Session has invalid TeacherTiles metadata.");
  if (session.currency !== "usd" || session.amount_subtotal !== pack.unitAmount) {
    throw new Error("Checkout Session total does not match the TeacherTiles coin catalog.");
  }

  const grantRef = db.collection("stripeCoinGrants").doc(session.id);
  const userRef = accountRef(db, uid);
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
      amountPaid: session.amount_total,
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

  return refreshContext(context, db, publicAccount);
}

async function handleSubscriptionCreated(context, subscription) {
  logFunctionStart("handleSubscriptionCreated", context);
  const uid = context.uid;
  if (!uid) {
    logFunctionError("handleSubscriptionCreated", context, new Error("Subscription created without Firebase UID."));
    return context;
  }

  const userRef = accountRef(db, uid);
  await userRef.set({
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionPriceId: subscription.items.data[0]?.price?.id || null,
    stripeCustomerId: subscription.customer || null,
    subscriptionStartedAt: new Date(subscription.created * 1000),
    subscriptionCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const refreshedContext = await refreshContext(context, db, publicAccount);
  logFunctionSuccess("handleSubscriptionCreated", refreshedContext);
  return refreshedContext;
}

async function handleSubscriptionUpdated(context, subscription) {
  logFunctionStart("handleSubscriptionUpdated", context);
  const uid = context.uid;
  if (!uid) {
    logFunctionError("handleSubscriptionUpdated", context, new Error("Subscription updated without Firebase UID."));
    return context;
  }

  const userRef = accountRef(db, uid);
  await userRef.set({
    subscriptionStatus: subscription.status,
    subscriptionPriceId: subscription.items.data[0]?.price?.id || null,
    stripeCustomerId: subscription.customer || null,
    subscriptionCurrentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const refreshedContext = await refreshContext(context, db, publicAccount);
  logFunctionSuccess("handleSubscriptionUpdated", refreshedContext);
  return refreshedContext;
}

async function handleSubscriptionCancelled(context, subscription) {
  logFunctionStart("handleSubscriptionCancelled", context);
  const uid = context.uid;
  if (!uid) {
    logFunctionError("handleSubscriptionCancelled", context, new Error("Subscription cancelled without Firebase UID."));
    return context;
  }

  const userRef = accountRef(db, uid);
  await userRef.set({
    subscriptionStatus: "cancelled",
    subscriptionCancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const refreshedContext = await refreshContext(context, db, publicAccount);
  logFunctionSuccess("handleSubscriptionCancelled", refreshedContext);
  return refreshedContext;
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
      logFunctionError("stripeWebhook", null, error);
      response.status(400).send("Invalid webhook signature");
      return;
    }

    let context = null;
    try {
      const stripeObject = event.data.object;
      const resolvedUid = await resolveFirebaseUidForStripeObject({
        db,
        stripeObject
      });
      const transactionType = getTransactionTypeFromMetadata(stripeObject);

      context = await createContext({
        db,
        uid: resolvedUid,
        source: "stripeWebhook",
        transactionType,
        event,
        stripeObject,
        publicAccount
      });

      // The Stripe event is the source of truth for Stripe fields. The Firebase
      // account is refreshed immediately before the handler runs.
      if (context.uid) {
        context = await refreshContext(context, db, publicAccount);
      }

      logFunctionStart("stripeWebhook", context);

      // Reject Stripe events we do not explicitly support.
      if (
        event.type !== "checkout.session.completed" &&
        event.type !== "checkout.session.async_payment_succeeded" &&
        event.type !== "customer.subscription.created" &&
        event.type !== "customer.subscription.updated" &&
        event.type !== "customer.subscription.deleted"
      ) {
        throw new Error(`Unsupported Stripe event type: ${event.type}`);
      }

      // Subscription events must come from a subscription transaction.
      if (
        event.type.startsWith("customer.subscription.") &&
        context.transactionType !== "membership_subscription"
      ) {
        throw new Error(
          `Subscription event has invalid transaction type: ${context.transactionType}`
        );
      }

      if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
        throw new Error(`Unsuccessful checkout event type: ${event.type}`);
      }

      // Successful checkout events.
      if (context.transactionType === "coin_checkout") {
        context = await fulfillCoinCheckout(context, stripeObject, event.id);
      } else if (event.type === "customer.subscription.created") {
        context = await handleSubscriptionCreated(context, stripeObject);
      } else if (event.type === "customer.subscription.updated") {
        context = await handleSubscriptionUpdated(context, stripeObject);
      } else if (event.type === "customer.subscription.deleted") {
        context = await handleSubscriptionCancelled(context, stripeObject);
      }

      logFunctionSuccess("stripeWebhook", context);
      response.status(200).json({ received: true });
    } catch (error) {
      logFunctionError("stripeWebhook", context, error);
      response.status(500).send("Webhook fulfillment failed");
    }
  }
);

exports.purchaseCosmetic = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const context = await createContext({
    db,
    uid,
    source: "purchaseCosmetic",
    request,
    publicAccount,
    ensureUserAccount: true
  });
  logFunctionStart("purchaseCosmetic", context);
  const productId = String(request.data?.productId || "");
  const product = COSMETIC_PRODUCTS[productId];
  if (!product) throw new HttpsError("invalid-argument", "Choose a valid cosmetic pack.");

  const userRef = accountRef(db, context.uid);
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

  const refreshedContext = await refreshContext(context, db, publicAccount);
  logFunctionSuccess("purchaseCosmetic", refreshedContext);
  return { ...refreshedContext.account.public, alreadyOwned };
});

exports.redeemCoinCode = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const context = await createContext({
    db,
    uid,
    source: "redeemCoinCode",
    request,
    publicAccount,
    ensureUserAccount: true
  });
  logFunctionStart("redeemCoinCode", context);
  const normalized = normalizeCode(request.data?.code);
  if (normalized.length < 8 || normalized.length > 32) {
    throw new HttpsError("invalid-argument", "Enter a valid TeacherTiles code.");
  }

  const codeRef = db.collection("redemptionCodes").doc(hashCode(normalized));
  const userRef = accountRef(db, context.uid);
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

  const refreshedContext = await refreshContext(context, db, publicAccount);
  logFunctionSuccess("redeemCoinCode", refreshedContext);
  return { ...refreshedContext.account.public, grantedCoins };
});

// Ready for a future admin screen; unavailable without an admin custom claim.
exports.generateCoinCode = onCall({ region: REGION }, async request => {
  const uid = requireUser(request);
  const context = await createContext({
    db,
    uid,
    source: "generateCoinCode",
    request,
    publicAccount,
    ensureUserAccount: true
  });
  logFunctionStart("generateCoinCode", context);
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
        createdBy: context.uid,
        createdAt: Timestamp.now()
      });
      logFunctionSuccess("generateCoinCode", context);
      return { code, packId, coins: pack.coins };
    } catch (error) {
      if (error.code !== 6 && error.code !== "already-exists") throw error;
    }
  }
  throw new HttpsError("internal", "A unique code could not be generated. Try again.");
});

exports.createBillingPortalSession = onCall(
  { region: REGION, secrets: [stripeSecretKey] },
  async request => {
    const uid = requireUser(request);
    const context = await createContext({
      db,
      uid,
      source: "createBillingPortalSession",
      request,
      publicAccount,
      ensureUserAccount: true
    });
    logFunctionStart("createBillingPortalSession", context);
    const returnUrl = validatedReturnUrl(request.data?.returnUrl);

    try {
      const userData = context.account?.data || {};

      if (!userData.subscriptionId) {
        throw new HttpsError("failed-precondition", "No active subscription found.");
      }

      // Get the customer ID from Stripe by looking up the subscription
      const subscription = await stripeClient().subscriptions.retrieve(userData.subscriptionId);
      const customerId = subscription.customer;

      // Create a billing portal session
      const portalSession = await stripeClient().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl.href
      });

      if (!portalSession.url) throw new Error("Stripe did not return a portal URL.");
      logFunctionSuccess("createBillingPortalSession", context);
      return { url: portalSession.url };
    } catch (error) {
      logFunctionError("createBillingPortalSession", context, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Could not open billing portal. Please try again.");
    }
  }
);
