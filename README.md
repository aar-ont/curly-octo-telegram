# Stocky Gap — product plan

A build plan for a solo developer shipping a Shopify app into the gap left by
Shopify sunsetting Stocky on 31 August 2026.

## The decision in one paragraph

Shopify killed Stocky — its free purchase-order and inventory app bundled with
POS Pro — on 31 August 2026. The APIs went dark on 1 September. Supplier records
could not be exported at all, so every affected merchant has to rebuild that data
by hand. Shopify's native purchase orders do not cover everything Stocky did, and
the third-party alternatives are $100–300/mo inventory suites aimed at bigger
operations. That leaves a specific, currently-stranded buyer: the small retailer
who used a free, simple tool and now faces an expensive, complicated one. Build
the cheap simple replacement, and enter through the one job nobody else will do
for them — reconstructing the supplier data Shopify would not let them export.

## Why this one

| Test | Result |
|---|---|
| Buyer already pays a human for this | Yes — POs and supplier chasing are manual or VA work |
| Pain is revenue-linked | Yes — stockouts are lost sales, overstock is trapped cash |
| Demand exists without being created | Yes — a forced migration, deadline already passed |
| Reachable without sales calls | Yes — app store search plus public community threads |
| Buildable solo in weeks | Yes, if scoped to the wedge and not to a full IMS |
| Survives being 16 | Yes — no PHI, no contracts, no liability, no phone |

## Read in this order

1. [`docs/01-niche.md`](docs/01-niche.md) — the evidence, and what was rejected
2. [`docs/02-validation.md`](docs/02-validation.md) — **seven days of no code, do this first**
3. [`docs/03-build-plan.md`](docs/03-build-plan.md) — MVP scope and architecture
4. [`docs/04-pricing-launch.md`](docs/04-pricing-launch.md) — pricing and the two demand waves
5. [`docs/05-constraints.md`](docs/05-constraints.md) — Partner account, payouts, time budget
6. [`docs/06-costs.md`](docs/06-costs.md) — what it costs to start (about $31)

## The code

A Shopify Remix app scaffold with the domain logic built and tested:

```
app/lib/matching     variant matching — exact SKU, loose SKU, then title
app/lib/reorder      sales velocity, days of cover, MOQ-aware suggestions
app/lib/po           PO state machine and supplier-reply policy
app/lib/extraction   Claude structured extraction + batch path
app/lib/shopify      paginated catalogue and sales reads
app/routes           embedded admin UI (import, reorder, webhooks)
```

```bash
npm install
npx prisma generate && npx prisma migrate dev   # local SQLite
npm test          # 59 tests
npm run typecheck
npm run build
```

The logic modules are pure and tested without a store or an API key, which is
deliberate: those are the parts that decide what a merchant sees, so they are
the parts that need to be arguable. `npm run dev` requires the Partner account
and app credentials from `docs/05-constraints.md`.

## The honest summary

This is a timing play, not a decade-long company. The acute scramble runs through
roughly Q1 2027. That is a feature given the goal is revenue soon, but do not
mistake it for a durable moat — see the risk register in `docs/01-niche.md`.

Plan written 17 September 2026. Every factual claim is sourced; check the dates
before acting on this, because the whole thesis is date-dependent.
