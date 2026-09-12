# TeacherTiles Cloud Function Context

`context.js` defines the standard internal object passed between TeacherTiles Cloud Functions, webhook entry points, and downstream handlers.

## Shape

```text
context
├── version
├── createdAt
├── source
├── uid
├── account
│   ├── ref
│   ├── exists
│   ├── fetchedAt
│   ├── data              # raw Firestore user document snapshot
│   ├── normalized        # common account fields with safe defaults
│   └── public            # client-safe projected account data
├── stripe
│   ├── eventId
│   ├── eventType
│   ├── objectId
│   ├── objectType
│   ├── customerId
│   ├── subscriptionId
│   ├── checkoutSessionId
│   ├── paymentIntentId
│   ├── priceId
│   ├── status
│   ├── paymentStatus
│   └── metadata
└── request
    ├── method
    ├── path
    ├── email
    └── authType
```

## Rules

1. Create one context at the entry point of every callable function and webhook.
2. Pass the context into downstream handlers instead of repeatedly resolving the UID or account document.
3. Treat `context.account.data` as the raw Firestore snapshot and `context.account.normalized` as the common, safely-defaulted account state.
4. After a handler mutates the user account, call `refreshContext()` and pass the returned context to subsequent handlers.
5. Treat Stripe event data as the source of truth for Stripe fields in the current webhook. The Firebase account is refreshed from Firestore when the context is created and after account mutations.
6. Never return the internal context directly to a client. Return only the appropriate public projection.
7. Add new shared account fields to `normalizeAccount()` so every function gets the same field and default behavior.
8. Add new shared Stripe identifiers to `stripeIds()` so every Stripe-triggered operation gets them automatically.

## Example

```js
let context = await createContext({
  db,
  uid,
  source: "someFunction",
  request,
  publicAccount,
  ensureUserAccount: true
});

context = await someHandler(context, input);
```

Webhook handlers follow the same pattern, except the context is created from the verified Stripe event:

```js
let context = await createContext({
  db,
  uid: resolvedUid,
  source: "stripeWebhook",
  event,
  stripeObject: event.data.object,
  publicAccount
});

context = await someHandler(context, event.data.object);
```
