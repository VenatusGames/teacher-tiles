# Animated theme products

Register these in the separate Firebase shop's authoritative product catalog used by `purchaseCosmetic`:

| Product ID | Display name | Coin price | Included theme IDs |
| --- | --- | ---: | --- |
| `theme-underwater` | Underwater | 450 | `underwater-ocean` (dark), `underwater-ocean-light` |
| `theme-rainy-window` | Rainy Window | 450 | `rainy-window` (dark), `rainy-window-light` |

Each pack contains two UI variants of the same animated backdrop: light and dark. Existing theme IDs retain the dark appearance so saved boards remain compatible. Both use the existing theme ownership and subscription access rules. Purchases spend coins through the existing `TeacherTilesAccount.purchase(productId)` call; no new Stripe product or real-money cosmetic checkout is needed.

This repository contains the client, not the Firebase function's product catalog. Adding these entries to the client does not register them on the server. Use the backend's existing product schema and deployment process, then verify a coin purchase grants the matching product ID in `ownedProductIds` and deducts 450 coins exactly once.
