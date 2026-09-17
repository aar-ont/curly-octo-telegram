# 03 — Build plan

## Scoping rule

Every feature request you receive will be a request to become an inventory
management system. Refuse all of them until you have fifty paying merchants.
The incumbents are full suites; your entire advantage is being the small cheap
one that does four things well.

The four things:

1. Rebuild supplier data that Stocky would not export
2. Create and send purchase orders
3. Tell them what to reorder, from actual sales velocity
4. Chase suppliers for confirmations and ETAs — this is the part that earns the subscription

## Stack

Use the boring default; it is boring because it works and because Shopify's own
docs assume it.

- **Shopify CLI** app scaffold — handles OAuth, session tokens, webhook
  registration, and the embedded-app plumbing you should not hand-roll
- **Remix + Polaris + App Bridge** — the app renders inside Shopify admin, and
  Polaris makes it look native for free, which matters more than you think for
  trust at your price point
- **Postgres** (Supabase or Neon free tier to start)
- **Admin GraphQL API** for all Shopify reads and writes
- **Claude API** for document parsing and email drafting
- **Postmark or Resend** for outbound PO email, with inbound parsing on a
  per-PO reply address — this is the mechanism the follow-up agent runs on

## Data model

Small on purpose:

```
Shop          shopify_domain, access_token, plan, installed_at
Supplier      shop_id, name, email, phone, address, lead_time_days, notes
SupplierItem  supplier_id, variant_id, supplier_sku, unit_cost, moq
PurchaseOrder shop_id, supplier_id, status, expected_at, reply_token, totals
POLine        po_id, variant_id, qty_ordered, qty_received, unit_cost
POEvent       po_id, kind, payload, created_at   -- every agent action, appended
```

`POEvent` is append-only and holds every inbound email, parse result, and drafted
reply. When a merchant asks "why does it say this arrives Thursday," you need to
be able to answer. Do not let the agent mutate state without leaving a record.

## Phase 1 — the wedge (target: 10 days)

**Supplier reconstruction.** Merchant uploads whatever they have: Stocky CSV
exports, PO PDFs, supplier emails, a messy spreadsheet. You extract structured
`Supplier` and `SupplierItem` records with Claude, match them against Shopify
variants by SKU with fuzzy fallback on title, and show a review screen.

Build notes that will save you a week:

- **Always show a review step.** Never write extracted data straight to the
  database. The merchant must see every row and correct it. This is also what
  makes a wrong extraction a non-event instead of a support ticket.
- **Match confidence should be visible.** Exact SKU match, fuzzy match, and no
  match are three different colours, and the merchant resolves the last two.
- **Keep the source file and the extraction.** When something is wrong you need
  to see what the model saw.
- Run extraction per-document, not per-batch. A merchant with 200 PO PDFs should
  see progress, and one malformed file should not fail the other 199.

Ship this alone if you have to. It is the reason they install.

## Phase 2 — the recurring product (target: 10 days)

**Purchase orders.** Create a PO, add lines from supplier catalogue or from
reorder suggestions, generate a PDF, email it to the supplier from a per-PO reply
address. Track draft → sent → confirmed → partially received → received.

**Receiving.** One screen, scan or type quantities, write back to Shopify with
`inventoryAdjustQuantities`. Handle partial receipts, because they are the
normal case and half the competing apps handle them badly.

**Reorder suggestions.** Pull sales over a trailing window from the Admin API,
compute velocity per variant, project days-of-cover against current inventory
levels, flag anything that runs out inside the supplier's `lead_time_days`.

Resist forecasting. Merchants say they want it; what they buy is a correct list
of what is about to run out. Simple velocity with a visible formula beats a black
box they cannot sanity-check, especially from an unknown developer.

## Phase 3 — the agent (target: 7 days)

This is what makes it a $49/mo product rather than a $19/mo utility, and it is
the piece Shopify will not build natively.

When a supplier replies to a PO email, the reply lands on the per-PO address. The
agent:

1. Parses the reply for confirmation, ETA, backorder, substitution, price change
2. Updates the PO and appends a `POEvent`
3. Escalates to the merchant when something needs a decision (price changed,
   item discontinued, ETA slipped past a threshold)
4. Drafts the chase email when a PO goes quiet past its expected date

**Draft, do not send, for the first hundred merchants.** The agent writes, the
merchant clicks send. An agent that emails a merchant's supplier unsupervised and
gets it wrong damages a relationship they spent years building, and you will
never get that customer back. Autonomy is something you earn with a track record
you do not have yet.

## What not to build

Demand forecasting with seasonality. Multi-warehouse allocation. Accounting
integration. Barcode label printing. Anything for merchants above roughly $5M
GMV. Every one of these is a real need, served by someone else, and a month you
do not have.

## Shopify review gate

Budget one to two weeks of calendar time, and read the requirements *before* you
build, not after:

- Mandatory GDPR webhooks (`customers/data_request`, `customers/redact`,
  `shop/redact`) — apps get rejected for these constantly
- `app/uninstalled` webhook, and actually delete the data
- Session token auth, no cookies
- Billing through the Shopify Billing API (`appSubscriptionCreate`), not Stripe —
  see `05-constraints.md` for why this is convenient for you specifically
- A privacy policy at a real URL
- Listing assets: icon, screenshots, a demo store the reviewer can actually use

Create the Partner account and start a throwaway app on **day one** of the build,
not at the end. The first submission always finds something.
