# TeacherTiles Stripe coin-store setup

The sandbox code is wired for Firebase Authentication, Cloud Functions, Firestore, and Stripe-hosted Checkout. Stripe secret values must stay in Firebase Secret Manager and must never be added to browser code, GitHub, or a support message.

> **Do not deploy the sandbox branch to `teachertiles-6739b`.** A Git branch does not isolate Firebase. Functions, Firestore rules, balances, and redemption codes are project-wide resources, so sandbox testing needs its own Firebase project.

## 1. Firebase prerequisites

Create or select a separate Firebase project for sandbox testing (for example, `teachertiles-sandbox`), enable Google Authentication and Firestore there, and put that project's public web configuration into `firebase-auth.js` on the sandbox branch. Cloud Functions and outbound calls to Stripe require that sandbox Firebase project to be on the Blaze plan. As a safety measure, the shop backend refuses payment calls whenever `sandbox.md` is present and the web configuration still points to the production project.

Install Node.js 22 and the Firebase CLI on the trusted computer used for deployment, then sign in and explicitly select the sandbox project:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
```

Install the function dependencies from the repository root:

```powershell
cd functions
npm install
cd ..
```

## 2. Start with Stripe test mode

In Stripe, turn on **Test mode**, open **Developers → API keys**, and copy the test secret key. Store it through the Firebase prompt; do not put it in a file:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY
```

Paste the `sk_test_...` value only into that private prompt. Deploy the callable functions and Firestore rules:

```powershell
firebase deploy --only functions,firestore:rules
```

The rules keep balances, purchases, grants, and redemption codes server-only while preserving each signed-in user's access to their own boards.

## 3. Register the Stripe webhook

In Stripe test mode, open **Workbench → Webhooks**, create a webhook endpoint, and use:

```text
https://us-central1-YOUR_SANDBOX_PROJECT_ID.cloudfunctions.net/stripeWebhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Reveal that endpoint's signing secret, then store its `whsec_...` value through Firebase:

```powershell
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase deploy --only functions:stripeWebhook
```

The webhook verifies Stripe's signature and the exact server-side pack price. A Checkout Session can grant its coins only once, even if Stripe retries delivery.

## 4. Test before going live

Sign into the sandbox site, open the Shop, select a coin bundle, and complete test Checkout with Stripe's test card `4242 4242 4242 4242`, any future expiry date, any three-digit CVC, and any postal code. Confirm:

- Stripe shows the Checkout payment as successful.
- The signed-in TeacherTiles balance increases once.
- Refreshing or using another browser with the same account shows the same balance.
- Buying a cosmetic deducts its server price and unlocks that pack.
- A second click on an owned pack does not charge coins again.
- Retrying the same webhook event does not grant the coins again.

## 5. Generate one-time coin codes

Available pack IDs are `coins-500`, `coins-1200`, `coins-2600`, and `coins-7000`.

On a trusted admin computer with Google Application Default Credentials for the Firebase project:

```powershell
gcloud auth application-default login
$env:TEACHERTILES_FIREBASE_PROJECT = "YOUR_SANDBOX_PROJECT_ID"
cd functions
npm run code:create -- coins-1200
```

The command prints the code once. Firestore stores only its SHA-256 hash, and the generated code can be redeemed by exactly one signed-in account.

There is also a protected `generateCoinCode` callable ready for a future admin screen. To grant a trusted Firebase UID access to it:

```powershell
cd functions
npm run admin:set -- FIREBASE_UID_HERE
```

That user must sign out and back in after the claim is added. Never grant `shopAdmin` to a normal customer account.

## 6. Go live later

After all sandbox/test-mode checks pass:

1. Complete Stripe account activation and business details.
2. Decide how sales tax for virtual goods applies where TeacherTiles sells; configure Stripe Tax if appropriate.
3. Repeat the key and webhook steps in Stripe live mode using the live `sk_live_...` key and the live endpoint's separate `whsec_...` secret.
4. Merge the tested code into the live branch.
5. Run a small real purchase and verify the webhook, balance, and Stripe payout record.

Refund behavior is intentionally not automated yet. Until a clear coin-refund policy is chosen, process refunds and balance adjustments through a trusted admin workflow so already-spent coins cannot create an inconsistent account.

## Stored data

- `users/{uid}`: coin balance and owned product IDs
- `users/{uid}/cosmeticPurchases/{productId}`: purchase audit record
- `users/{uid}/coinTransactions/{transactionId}`: Stripe/code coin audit record
- `stripeCoinGrants/{checkoutSessionId}`: idempotency record preventing double grants
- `redemptionCodes/{sha256}`: one-time code state; plaintext codes are not stored

The browser never receives Stripe secret keys, redemption-code records, or write access to balances and ownership.
