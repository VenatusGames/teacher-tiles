# Animated theme products

Register these in the separate Firebase shop's authoritative product catalog used by `purchaseCosmetic`:

| Product ID | Display name | Coin price | Included theme ID |
| --- | --- | ---: | --- |
| `theme-underwater` | Underwater | 450 | `underwater-ocean` |
| `theme-rainy-window` | Rainy Window | 450 | `rainy-window` |

Each pack contains one animated theme. Both use the existing theme ownership and subscription access rules. Purchases spend coins through the existing `TeacherTilesAccount.purchase(productId)` call; no new Stripe product or real-money cosmetic checkout is needed.

This repository contains the client, not the Firebase function's product catalog. Adding these entries to the client does not register them on the server. Use the backend's existing product schema and deployment process, then verify a coin purchase grants the matching product ID in `ownedProductIds` and deducts 450 coins exactly once.
