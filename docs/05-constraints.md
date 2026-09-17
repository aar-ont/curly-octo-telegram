# 05 — Operating constraints

Practical blockers specific to building this solo, in school, under 18. Handle
these in week one; discovering them after your first sale is demoralising and
avoidable.

## Payments and accounts

**Shopify Partner account.** Must be created in an adult's name — a parent or
guardian. They are the legal account holder; you operate everything. Payouts go
to a bank account in the account holder's name.

**Billing runs through Shopify, not Stripe.** This is a genuine advantage of
choosing the marketplace route. Merchants are charged on their Shopify invoice
via the Billing API, Shopify remits to the Partner account, and you never
integrate a payment processor or handle a card. Shopify takes a revenue share;
at your scale the first $1M/yr is on favourable terms — check the current Partner
terms yourself rather than trusting this sentence, since they change.

**If you later need Stripe directly:** a standard account can be created at 13+,
but a legal guardian must be added as account owner before you can accept charges
or receive payouts. They will need name, date of birth, last four of SSN, address,
and consent to the terms. This is Stripe's documented path, not a workaround.

**Do not misrepresent your age in any terms of service.** Equally, you never need
to volunteer it commercially. A merchant clicking install has no idea who you are
and no reason to care. Both of those things are true at once.

## Time

You have roughly 15–20 focused hours a week during term. Consequences:

- **Async-only distribution.** Community threads and app store search work at
  11pm. Anything requiring a business-hours phone call does not, which is
  precisely why this niche was chosen over the four in `01-niche.md`.
- **Support has an SLA you can actually keep.** Promise next-business-day email
  and hit it. Do not offer live chat you cannot staff — a missed chat is worse
  than no chat.
- **Shopify app review is calendar time, not work time.** Submit early; it runs
  in the background while you do other things. Same for anything with a queue.

## The thing that will actually kill this

Not the code. You can build this, and so can a hundred other people — that is
exactly why the analysis in `01-niche.md` matters more than the implementation.

The failure mode is spending eight weeks building a beautiful inventory suite for
nobody, because building is comfortable and replying to strangers in a forum is
not. If you are spending more than a third of your time in an editor, you are
working on the easy problem.

Distribution, retention, and pricing are the hard parts of every idea on the list.
They stay hard no matter how good the app is.

## Sources

- [Age requirement to create a Stripe account — Stripe Support](https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account)
- [Age requirement to create an account (Connect) — Stripe Support](https://support.stripe.com/embedded-connect/questions/age-requirement-to-create-an-account)
