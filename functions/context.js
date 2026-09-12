"use strict";

const CONTEXT_VERSION = 2;

function normalizeString(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object" && value.id) return String(value.id);
  return String(value);
}

function accountRef(db, uid) {
  return db.collection("users").doc(uid);
}

function stripeObjectType(object) {
  return object && typeof object === "object" ? normalizeString(object.object) : null;
}

function stripeIds(object) {
  const type = stripeObjectType(object);
  return {
    objectId: normalizeString(object?.id),
    objectType: type,
    customerId: normalizeString(object?.customer),
    subscriptionId: normalizeString(type === "subscription" ? object?.id : object?.subscription),
    checkoutSessionId: normalizeString(type === "checkout.session" ? object?.id : null),
    paymentIntentId: normalizeString(type === "payment_intent" ? object?.id : object?.payment_intent),
    priceId: normalizeString(object?.items?.data?.[0]?.price?.id || object?.price?.id)
  };
}

function normalizeAccount(data = {}) {
  return {
    coinBalance: Number.isSafeInteger(Number(data.coinBalance)) ? Number(data.coinBalance) : 0,
    ownedProductIds: Array.isArray(data.ownedProductIds) ? [...data.ownedProductIds] : [],
    subscriptionStatus: normalizeString(data.subscriptionStatus) || "inactive",
    subscriptionId: normalizeString(data.subscriptionId),
    subscriptionPriceId: normalizeString(data.subscriptionPriceId),
    stripeCustomerId: normalizeString(data.stripeCustomerId),
    subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd || null,
    subscriptionStartedAt: data.subscriptionStartedAt || null,
    subscriptionCancelledAt: data.subscriptionCancelledAt || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function publicAccount(data = {}, projector) {
  return projector ? projector(data) : normalizeAccount(data);
}

async function ensureAccount(db, uid) {
  const ref = accountRef(db, uid);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      transaction.create(ref, {
        coinBalance: 0,
        ownedProductIds: [],
        subscriptionStatus: "inactive",
        subscriptionId: null,
        subscriptionPriceId: null,
        stripeCustomerId: null,
        subscriptionCurrentPeriodEnd: null,
        subscriptionStartedAt: null,
        subscriptionCancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  });
  return ref;
}

async function loadAccount(db, uid, projector) {
  if (!uid) return null;
  const ref = accountRef(db, uid);
  const snapshot = await ref.get();
  return {
    exists: snapshot.exists,
    fetchedAt: new Date(),
    data: snapshot.data() || {},
    normalized: normalizeAccount(snapshot.data() || {}),
    public: projector ? publicAccount(snapshot.data() || {}, projector) : null
  };
}

/**
 * Standard TeacherTiles operation context.
 *
 * Every callable function and webhook should create one context and pass it to
 * downstream handlers. The context contains the current Firebase account
 * snapshot plus all Stripe identifiers/event data available to that operation.
 * It is an in-memory object and is never returned to the client.
 */
async function createContext({
  db,
  uid = null,
  source = "unknown",
  request = null,
  event = null,
  stripeObject = null,
  publicAccount: projector = null,
  ensureUserAccount = false
}) {
  const firebaseUid = normalizeString(
    uid ||
    request?.auth?.uid ||
    stripeObject?.metadata?.firebaseUid ||
    stripeObject?.client_reference_id
  );

  if (firebaseUid && ensureUserAccount) {
    await ensureAccount(db, firebaseUid);
  }

  const account = await loadAccount(db, firebaseUid, projector);
  const metadata = stripeObject?.metadata && typeof stripeObject.metadata === "object"
    ? { ...stripeObject.metadata }
    : {};

  return {
    version: CONTEXT_VERSION,
    createdAt: new Date(),
    source,
    uid: firebaseUid,
    account,
    stripe: {
      eventId: normalizeString(event?.id),
      eventType: normalizeString(event?.type),
      ...stripeIds(stripeObject),
      status: normalizeString(stripeObject?.status),
      paymentStatus: normalizeString(stripeObject?.payment_status),
      metadata
    },
    request: request ? {
      method: normalizeString(request.method),
      path: normalizeString(request.path),
      email: normalizeString(request.auth?.token?.email),
      authType: request.auth ? "firebase" : null
    } : null
  };
}

/** Refreshes the Firebase account portion of a context from Firestore. */
async function refreshContext(context, db, projector) {
  if (!context?.uid) return context;
  return {
    ...context,
    account: await loadAccount(db, context.uid, projector)
  };
}

/**
 * Applies a Firestore account mutation and returns a context containing the
 * post-mutation account snapshot. The mutation receives the standard account
 * reference, so handlers don't need to reconstruct user state themselves.
 */
async function updateContextAccount(context, db, mutation) {
  if (!context?.uid) throw new Error("Cannot update an account without a Firebase UID.");
  const ref = accountRef(db, context.uid);
  await mutation(ref, context.account?.data || {});
  return refreshContext(context, db);
}

/**
 * Resolves a Firebase UID for older Stripe subscription events that predate
 * subscription_data.metadata.firebaseUid.
 */
async function resolveFirebaseUidForStripeObject({ db, stripeObject }) {
  const directUid = normalizeString(
    stripeObject?.metadata?.firebaseUid ||
    stripeObject?.client_reference_id
  );
  if (directUid) return directUid;

  const subscriptionId = normalizeString(
    stripeObject?.object === "subscription" ? stripeObject.id : stripeObject?.subscription
  );
  if (!subscriptionId) return null;

  const snapshot = await db.collection("users")
    .where("subscriptionId", "==", subscriptionId)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

function contextLog(context) {
  return {
    version: context?.version ?? null,
    createdAt: context?.createdAt ?? null,
    source: context?.source ?? null,
    uid: context?.uid ?? null,
    account: context?.account ? {
      exists: context.account.exists ?? false,
      fetchedAt: context.account.fetchedAt ?? null,
      data: context.account.data ?? {},
      normalized: context.account.normalized ?? {},
      public: context.account.public ?? null
    } : null,
    stripe: context?.stripe ?? null,
    request: context?.request ?? null
  };
}

module.exports = {
  CONTEXT_VERSION,
  accountRef,
  contextLog,
  createContext,
  ensureAccount,
  normalizeAccount,
  refreshContext,
  resolveFirebaseUidForStripeObject,
  updateContextAccount
};
