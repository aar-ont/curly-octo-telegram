# 01 — Niche selection

## The event

| Date | What happened |
|---|---|
| 2 Feb 2026 | Stocky delisted from the Shopify App Store |
| Jul 2025 | Inventory transfers and min/max forecasting already removed |
| 31 Aug 2026 | Stocky no longer available |
| 1 Sep 2026 | Stocky APIs stopped working; integrations built on them broke |
| Mar 2027 | Extension deadline for a limited set of merchants (see below) |

Shopify granted a limited extension to March 2027, but only to stores still
actively using Stocky stock counts or the Stocky Purchase Orders API. Everyone
else was cut off on 31 August.

## Why this leaves a gap

**1. Supplier data could not be exported.** This is the single most important
fact in this document. Merchants can export some things and not others, and
supplier records fall entirely in the "not others" bucket. Every affected
merchant has to recreate vendor relationships manually, from old PO PDFs,
email threads, and spreadsheets. That is unstructured-text-to-structured-data
work, which is the thing an LLM is genuinely good at, and it is a task with a
clear finish line rather than an open-ended promise.

**2. Native Shopify POs do not match Stocky.** The Shopify community has threads
titled, verbatim, "Native POs need to match Stocky before August 2026 sunset —
here are the gaps" and "Stocky Sunset - Why doesn't Shopify Native PO have the
same functionality?". Merchants are documenting the gaps for you, in public,
with their names attached.

**3. The alternatives are priced for someone else.** Inventory Planner, Prediko,
StockTrim, Qoblex, Sumtracker, inFlow, Ordoro — all real products, all full
inventory suites, all aimed at merchants with more complexity and more budget.
The displaced Stocky user was on a *free* tool bundled with POS Pro. Asking them
to jump from $0 to $200/mo is asking them to change category, not vendor.

**4. The timing is hostile to the merchant and therefore good for you.** The
cutoff landed six weeks before pre-holiday stock planning, which is when POs
matter most to a retailer. Urgency is not something you have to manufacture.

## The wedge

Do not build an inventory management system. You will lose that fight and it will
take a year.

Build the thing that gets a stranded merchant operational again this week:

> **Supplier reconstruction.** They upload old Stocky PO exports, PDFs, and
> supplier emails. The app parses them into structured supplier records, product
> to supplier mappings, and cost history. Fifteen minutes instead of a weekend
> of retyping.

Then keep them, because once their supplier data lives in your app, moving it
again is the exact pain they just went through. That is the switching cost, and
you acquire it on day one rather than earning it over years.

The recurring product that sits on top of the wedge is deliberately small:
purchase orders, reorder suggestions from sales velocity, receiving, and a
supplier follow-up agent. Nothing else. Scope discipline is the whole strategy.

## What was rejected, and why

| Candidate | Why not |
|---|---|
| Claim denials for medical practices | PHI requires a signed BAA; a minor cannot be reliably bound by contract, so no billing company's counsel will sign |
| EU AI Act compliance tooling | Selling regulatory assurance carries liability that needs an adult entity behind it |
| Freight exception handling | Brokers buy on live phone calls during school hours |
| RFQ-to-quote for distributors | Real business, but the first five customers come from calls you cannot take |
| AI voice receptionist for trades | Avoca reached a $1B valuation on this in April 2026; it is a funded-incumbent category now |
| General AI customer support | Saturated. Gorgias, Tidio, Zendesk, and a hundred wrappers |

## Risk register

**The window closes.** Acute demand fades through Q1 2027. Mitigation: accept it.
This is a cash-and-reputation vehicle matched to a "revenue soon" goal. Decide in
March 2027 whether what you have learned justifies a second act.

**Shopify closes the native gaps itself.** Genuinely likely — they are actively
building here, and there is an open community thread asking for a native Purchase
Orders API endpoint. Mitigation: own the layer Shopify will not build, which is
outbound supplier communication and chasing. Platforms build data models; they do
not chase your vendors by email.

**Incumbents own the "Stocky alternative" search results.** Every alternative
listed above is running migration content marketing right now. Mitigation: do not
fight for that keyword. Win in the community threads, where a founder who replies
personally beats a content team, and in app store search, where "simple" and
"cheap" are positions nobody above you wants to take.

**You are 17 days late.** Others saw this too. Mitigation: the extension cohort
runs to March 2027 and the holiday freeze suppresses everyone's launch anyway —
see the two-wave analysis in `04-pricing-launch.md`. Late is survivable. Slow is
not.

## Sources

- [Migrating from Stocky to Shopify inventory management — Shopify Help Center](https://help.shopify.com/en/manual/products/inventory/transitioning-from-stocky)
- [Native POs need to match Stocky before August 2026 sunset — here are the gaps](https://community.shopify.com/t/native-pos-need-to-match-stocky-before-august-2026-sunset-here-are-the-gaps/615718)
- [Stocky Sunset — Why doesn't Shopify Native PO have the same functionality?](https://community.shopify.com/t/stocky-sunset-why-doesnt-shopify-native-po-have-the-same-functionality/638123)
- [Stocky shuts down in August. What are you actually moving to for reorder/POs?](https://community.shopify.com/t/stocky-shuts-down-in-august-what-are-you-actually-moving-to-for-reorder-pos/637085)
- [API endpoint coming soon for Purchase Orders, with Stocky sunset?](https://community.shopify.com/t/api-endpoint-coming-soon-for-purchase-orders-with-stocky-sunset/587136)
- [Stocky Shutdown 2026 — How & Where to Migrate — Prediko](https://www.prediko.io/stocky-sunsetting)
- [Stocky Shopify App Sunsetting — inFlow](https://www.inflowinventory.com/blog/stocky-shopify-app-sunsetting/)
- [6 Best Stocky Alternatives in 2026 — StockTrim](https://www.stocktrim.com/blog/6-best-stocky-alternatives-in-2026-what-should-shopify-merchants-switch-to)
