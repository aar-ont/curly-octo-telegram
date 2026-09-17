# 06 — What it costs to start

Short answer: **£0 for the validation week, about $30–35 to get a paid app live,
and after that the only cost that scales is Claude API usage.**

You do not need money to start earning money here. You need a parent's card for
three small things, and one of them is refundable in the sense that you only pay
it if you decide to ship.

## One-time

| Item | Cost | Needed when |
|---|---|---|
| Shopify Partner account | **Free** | Day one |
| Development stores | **Free**, unlimited | Day one |
| App Store distribution registration | **$19 one-time** | Before you submit for review |
| Domain (app URL + privacy policy URL) | **~$12/yr** | Before you submit for review |

That is the whole barrier to entry: **$19 plus a domain.** No $99/yr developer
program, no incorporation, no accountant.

## Recurring

| Item | Free tier | When you outgrow it |
|---|---|---|
| Hosting (Vercel / Fly / Railway) | Generous free tier | Not for a long time |
| Postgres (Neon / Supabase) | Free tier | Not for a long time |
| Outbound email (Resend) | 3,000 emails/mo free, 100/day | $20/mo at 50k |
| **Inbound** email parsing (Postmark) | Not on the free plan | **~$16.50/mo, Pro tier** |

One trap worth knowing now: **Resend does not do inbound parsing.** The
follow-up agent in Phase 3 is built on reading supplier replies, so when that
ships you need Postmark Pro (~$16.50/mo) or equivalent. Outbound-only phases run
free. Budget that as the moment the app starts costing real money monthly.

## Claude API — the only cost that scales

Priced per token: Opus 5 is $5 per million input, $25 per million output. What
that means in practice for this app:

A merchant migration of ~50 purchase orders, averaging 2 pages each, is roughly
250k input tokens and maybe 20k output tokens — **on the order of $1.50–2.00 per
migrating merchant**, once, at full price.

Three levers, in the order you should reach for them:

1. **Batch API — 50% off.** A merchant dumping their archive is not waiting on
   the screen; they expect to come back to it. `submitExtractionBatch()` in
   `app/lib/extraction/extract.ts` already does this. Halves the number above.
2. **Prompt caching.** The extraction system prompt is identical on every call.
   Cached reads are ~10% of input cost.
3. **Effort.** `extractSupplierData()` takes an `effort` option. Lowering it
   trades thoroughness for spend. Measure on real merchant documents before
   turning it down — a cheap extraction that the merchant has to correct by hand
   destroys the one thing the product is selling.

At $49/mo per merchant against ~$2 one-time extraction plus pennies of ongoing
reply parsing, the unit economics are not close. This is not a business where
API cost is the thing to worry about.

## What you actually need a parent for

Three things, all one-time setup:

1. **Shopify Partner account** in their name — they are the legal account
   holder, you operate everything.
2. **A card** for the $19 registration, the domain, and the Anthropic API.
3. **A bank account** for payouts, since Shopify remits to the account holder.

Billing runs through Shopify's Billing API, so you never integrate Stripe and
never touch a card number. See `05-constraints.md`.

## The honest sequencing

**Spend nothing until the validation gate in `02-validation.md` passes.** Week
one is ten forum replies and manual extraction you can do in a Claude chat
window — that costs you time and nothing else. If three merchants send you their
data, spend the $31. If they don't, you have lost a week instead of a month and
a hosting bill.

## Sources

- [Revenue share for Shopify App Store developers — shopify.dev](https://shopify.dev/docs/apps/launch/distribution/revenue-share)
- [How Partners earn on Shopify — Shopify Help Center](https://help.shopify.com/en/partners/partner-program/how-to-earn)
- [Shopify App Revenue Share 2026: 0% to $1M, Then 15%](https://weekonelabs.com/blog/shopify-app-revenue-benchmarks-2026/)
- [Postmark pricing 2026: plans, overage, vs Resend / SendGrid](https://klymentiev.com/blog/postmark-pricing)
- [11 Free Email APIs Compared: send limits, inbound, retention (2026)](https://www.agentmail.to/blog/free-email-api-for-developers)
