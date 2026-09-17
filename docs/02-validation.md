# 02 — Validation: seven days, no code

Do not open an editor until this is done. The build is the easy part and you
already know you can do it; what you do not yet know is whether these merchants
will pay, and which of the gaps hurts most. A week spent here is the cheapest
week in the whole plan.

## Why this niche is unusually cheap to validate

Your prospects have already publicly identified themselves. They are posting in
Shopify community threads, by name, describing their problem in their own words,
with their store attached. You do not need a lead list, cold email, or ads. You
need to read and reply.

This also fits your constraints exactly: it is asynchronous text, doable at
11pm, and nothing about it requires a phone call or an adult.

## Day 1–2: read

Work through these threads end to end and take notes in
`research/threads.md` (create it — it is gitignored scratch, or commit it, your
call):

- [Native POs need to match Stocky — here are the gaps](https://community.shopify.com/t/native-pos-need-to-match-stocky-before-august-2026-sunset-here-are-the-gaps/615718)
- [Stocky Sunset — Why doesn't Shopify Native PO have the same functionality?](https://community.shopify.com/t/stocky-sunset-why-doesnt-shopify-native-po-have-the-same-functionality/638123)
- [Stocky shuts down in August. What are you actually moving to?](https://community.shopify.com/t/stocky-shuts-down-in-august-what-are-you-actually-moving-to-for-reorder-pos/637085)
- [Stocky App Going Away after August 31 2026](https://community.shopify.com/t/stocky-app-going-away-after-august-31-2026/587292)
- [Replacement to Stocky?](https://community.shopify.com/t/replacement-to-stocky/587141)

For every complaint, record: the specific workflow that broke, the merchant's
store size if visible, and whether they named a replacement they tried. You are
looking for the complaint that repeats most and is smallest to build.

Then install the three closest competitors and read their **one and two star**
reviews on the app store. Free list of what is broken in products people are
already paying for.

## Day 3–4: the ten replies

Reply publicly in those threads — not with a pitch, with help. Answer the
question they actually asked, including when the answer is "native POs can do
this, here's how." Then, at the end:

> I'm building a simple replacement focused on the supplier data Stocky wouldn't
> let you export. If that's your problem too, I'll rebuild your supplier list
> from your old POs for free this week so you can see whether it's any good.

Ten of these. Public replies, not DMs — DMs from an unknown account read as spam,
a helpful public reply reads as a person.

## Day 5–7: do the work by hand

For everyone who says yes, **do the supplier reconstruction manually.** Open their
old PO exports, use Claude in a chat window to parse them, hand back a clean CSV
of suppliers, product mappings, and costs.

This is the most valuable part of the week and the part most builders skip. Doing
it by hand tells you the real shape of the data — how filthy the exports are,
which fields are missing, what merchants actually check first when they open the
result. You cannot learn that from a spec, and every hour here removes a week of
rework later.

## The go / no-go gate

| Signal | Meaning |
|---|---|
| 3+ merchants send you their data | Build it. Real pain, real urgency. |
| 1–2 send data, several engage | Build a narrower version; keep validating in parallel. |
| Replies but nobody sends data | The pain is real but not acute. Do not build yet — ask what would be. |
| No replies at all | Wrong niche or wrong threads. Stop. Reassess before spending a month. |

Nobody sending you data after ten helpful public replies is information, not
failure. It costs you a week to learn it instead of a quarter.

## The question to ask everyone who says yes

> What did you end up doing on 1 September?

Their answer tells you who your real competitor is. If the answer is "a
spreadsheet," your competitor is inertia and your job is easy. If it is "we moved
to Prediko," you need to know why they chose it and whether they are happy. If it
is "we're still broken," you have found your first paying customer.
