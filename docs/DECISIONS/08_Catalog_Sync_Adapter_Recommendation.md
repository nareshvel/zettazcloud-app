# Catalog Sync — Adapter Strategy & Recommendation

The foundation is built and platform-agnostic: `sales_channels`,
`channel_product_links`, a `channel_sync_queue` outbox, and a normalized
JSON/CSV feed at `/api/catalog/feed`. What's missing is a **concrete adapter**
that drains the queue and pushes to a real storefront.

## Recommendation, in short

**Ship the CSV feed now. Build one adapter — Shopify — only when a paying tenant
asks. Do not build three.**

Reasoning:

1. **No tenant is blocked today.** The CSV feed already covers the common case:
   export, upload to the storefront, done. Shopify, WooCommerce, Etsy, Amazon and
   Google Shopping all accept product CSV import. That's a working answer for a
   store that wants an online catalogue this week.
2. **Adapters are ongoing liabilities, not one-off features.** Each one means
   OAuth, token refresh, rate limits, webhook signature verification, per-platform
   product/variant models, and breakage every time the vendor bumps their API.
   Writing three speculatively means maintaining three integrations with zero
   users.
3. **The expensive part is already done.** The outbox pattern means adding an
   adapter later touches nothing else — no schema change, no route change, no
   change to how products are saved.

## Phasing

**Phase 1 — now (done): feed-only.**
Channels of `platform = 'feed'`. Merchant exports CSV and uploads manually. Zero
credentials, zero maintenance.

**Phase 2 — first real request: one adapter, Shopify first.**
Shopify is the right first target: largest small-retail share, the cleanest REST
+ GraphQL Admin API, a sane product/variant model, and proper webhooks for
inventory sync back. Concretely:

- `backend/services/adapters/shopifyAdapter.js` implementing a small contract:
  `upsertProduct(product, link)`, `deleteProduct(link)`, `updateStock(link, qty)`.
- A worker (cron or a queue consumer) that polls
  `channel_sync_queue WHERE status='queued'`, calls the adapter, then posts back
  to `POST /api/catalog/queue/:id/complete` — the endpoint already exists and
  records `external_id` on success.
- Store the access token in a secret manager and put only its **reference** in
  `sales_channels.credentials_ref` (the column is already designed for this;
  tokens must never sit in the database).

**Phase 3 — only if demand justifies it.** WooCommerce (REST API + consumer
key/secret) is the natural second. Add a third only against real revenue.

## The adapter contract (write this once)

```js
// backend/services/adapters/<platform>Adapter.js
module.exports = {
  name: 'shopify',
  async testConnection(channel) { /* -> { ok, message } */ },
  async upsertProduct(channel, product, link) { /* -> { externalId } */ },
  async deleteProduct(channel, link) { /* -> { ok } */ },
  async updateStock(channel, link, quantity) { /* -> { ok } */ },
};
```

A registry maps `sales_channels.platform` → adapter. The worker stays
platform-unaware, so adding WooCommerce is a new file plus one registry line.

## Decisions to make before Phase 2

- **Direction.** Push-only (Zettaz is the master), or two-way with orders and
  stock flowing back? Two-way is significantly more work and raises the question
  of who wins on a stock conflict. Recommend **push-only first**.
- **Variants.** Zettaz products are flat; Shopify has variants. Options: one
  Shopify product per Zettaz product (simplest), or group by an attribute such as
  size/colour. Recommend **flat 1:1** initially.
- **Serialized pieces.** A unique jewelry piece is quantity-1 and disappears when
  sold. Decide whether pieces publish individually or only the parent product does.
- **Images.** The feed exposes a relative `/uploads/...` path; a remote platform
  needs an absolute, publicly reachable URL. This needs a public base URL (and is
  another argument for object storage — see `storageService`).

## Interim guidance for merchants

Until an adapter exists, in **Sales Channels**: create a channel with platform
"CSV / feed only", click **Export feed**, and import that file into the
storefront. The sync queue still records intent, so when an adapter is added the
backlog can be replayed.
