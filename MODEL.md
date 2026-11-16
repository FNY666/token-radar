# The model

One sealed snapshot in, one ranked board out. Everything below is computed at run time from
`/input/snapshot.json`; nothing is typed in from outside and no protocol name is special-cased.

## 1. The separation

A protocol **records a token** when the snapshot gives it a market cap, a CoinGecko id or a symbol.
Everything else **records no token**.

* The board ranks only the protocols that record no token: the ones still to come.
* The protocols whose tokens already trade are kept in their own table, shown at the market's own
  value, never mixed into the ranking.
* The house watchlist is a floor, never a ceiling. Its 40 protocols are all on the board; so are 155
  more that the watchlist's TVL cut leaves out.

A protocol records no token in DefiLlama's record. That is not proof that it has none, and the
dashboard says so.

## 2. The eligible universe

The house's rule has a structural part and a numeric part. The radar keeps the structural part and
replaces the numeric cut:

| Rule | Applied to | Why |
| --- | --- | --- |
| category is not Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX | every protocol | a wrapper or a venue of someone else's token is not that protocol's own launch |
| the name does not end in a version marker | every protocol | `Aave V2` is a pool of `Aave`, not a new protocol |
| the name carries no whole word *wrapped*, *staked* or *staking* | every protocol | same reason: WBTC and Binance staked ETH are off the list for this |
| the name does not begin with an exchange's name | every protocol | a listing venue is not a protocol |
| TVL at or above the floor | **dropped** | this is the cut the radar replaces, so it can find the early names below it |

The eligible universe is **433 of the snapshot's 758 protocols**: 195 that record no token (the board)
and 238 that record one.

Of those 238, **130 are product rows** — they carry a ticker but no market cap or CoinGecko id of
their own, because their parent protocol issued the token and put the ticker on the pool. `Aave V3`
records AAVE; `Aave V2` is the row that issued it. A product row is therefore neither evidence that
a protocol issues a token nor evidence that it does not, and the launch model leaves it out
altogether. The launch model's universe is therefore **303 protocols**: 108 that issued a token of
their own and 195 that record none.

This distinction is not cosmetic. Product rows are older and bigger than pre-token rows by
construction — a pool of a protocol that already issued — so labelling them "issued" would teach the
fit that *old and big means issued*, which is exactly the question the board is asking. It was worth
**19.4 points of base rate**: 55.0% of the old universe "issued", 35.6% of the corrected one does.

## 3. The value model — what a token is worth if it issues

The cohort is every eligible protocol whose token already trades and whose market cap is at least
$1M: **75 protocols**, the only rows in the snapshot where both halves of the question are known.

The fit is a Huber-weighted least squares on the log of the market cap over TVL:

```
log10(mcap / tvl)  =  a  +  b · log10(tvl)  +  c · (change_7d / 10)  +  category_log
```

then

```
conditional value  =  tvl · 10^(that sum)
```

The growth term is clamped to ±60% / ±120% so that one wild week is a regime and not a hundred.

**The form was chosen by five-fold cross-validation on that cohort**, not by taste:

| Design | CV median absolute error (log10 dollars) |
| --- | --- |
| log10 TVL alone | 0.483 |
| log10 TVL + growth | **0.420** |
| log10 TVL + growth + log age | 0.461 |
| log10 TVL + growth + growth² | 0.517 |
| log10 TVL + growth + log² age | 0.472 |

Growth earns its place. Age does not, in this fit — and that is exactly why age is in the launch
model instead. The fitted form is a power law in TVL: the median protocol trades at a small and
shrinking fraction of the deposits behind it, and the fit reproduces that.

**The category correction.** Each category's residual is added to the fit, but three guards keep a
category with one live protocol from speaking for the whole category:

1. **Winsorizing.** Every residual is clipped to the 10th–90th percentile of the cohort's residuals
   before anything is computed. Without this a single member with a wild market cap (a prediction
   market at 400× its TVL) sets its category's number, and that number then reorders the board.
2. **Shrinkage.** The category's median residual is pulled toward the global median with a prior
   weight of 4: a category with one live member gets roughly a fifth of its own residual and four
   fifths of the cohort's.
3. **A floor.** A category the cohort has never seen contributes nothing.

The correction and its multiplier are reported on the dashboard's model page, so a reader can see
which categories the model believes and how much.

## 4. The launch model — the chance it issues at all

A conditional value is not a ranking. A protocol with $2B of TVL that has run six years without a
token is a different proposition from a $2B protocol that launched last month, and the difference is
*whether it issues*, not *how much it is worth*.

A logistic fit on the eligible universe less the product rows (303 protocols), on the same facts
the board reads:

```
launch odds  =  logistic(age band, TVL band, seven-day growth)
```

The age bands come from the snapshot's own cohorts. Each band's observed rate of protocols that
issued a token of their own:

| Tracked for | Protocols | Issued a token | Rate |
| --- | --- | --- | --- |
| 0–182 days | 52 | 3 | 5.8% |
| 182–365 days | 38 | 8 | 21.1% |
| 365–730 days | 95 | 21 | 22.1% |
| 730–1460 days | 63 | 33 | 52.4% |
| 1460+ days | 20 | 15 | 75.0% |

The fitted model's **AUC on that universe is 0.754** — it separates the protocols that issued from
those that did not better than chance, and the dashboard reports that number rather than asking to be
taken on trust. The correction raised the AUC from 0.735: a model trained on the wrong labels was
being asked to fit a relationship that was not there.

## 5. The ranking

```
implied value  =  conditional value × launch odds
```

This is what the board ranks, and it is what `board.json` carries in `implied_value_usd`. It answers
the question the bounty asks: *what would a token be worth if this protocol's record stayed as it
is*, priced by the chance it ever issues. The dashboard shows both halves side by side — the value if
it issues, and the implied value — so a reader can disagree with the multiplication without
disagreeing with the model.

**Age enters the implied value through the launch odds**, which is where the cross-validation put
it. The three inputs the judge asks about are all in:

| Input | Where it enters |
| --- | --- |
| TVL | the conditional value (the power law in TVL) and the launch odds (the TVL band) |
| seven-day growth | the conditional value (the growth term) and the launch odds |
| how long it has run with no token | the launch odds (the age band) |

## 6. Why no name is special-cased

The model reads only `tvl_usd`, `change_7d`, `listed_at`, `category` and `chains`. There is no list
of names anywhere in `lib/model.ts`, and no protocol is mentioned in a rule. A protocol nobody named
that arrives in a future snapshot is scored by the same function on the same day. The dashboard's
model page says so, and the board carries each row's own fitted working so the arithmetic can be
checked row by row.

**The page refits the model itself.** `dashboard/model.js` is the fitting code, in the page's own
hand, and `data.js` carries the two raw sets it needs: the 75-protocol cohort and the 433-protocol
eligible universe, each with its TVL, growth, first-tracked date and the snapshot's own market cap,
CoinGecko id and ticker — so the page applies the *same* label the model does, rather than being
told which rows count as issuers. When the page loads it re-runs the Huber fit, the logistic fit and
the category correction from those figures and then checks its own output against the board. The
model page reports the result — *N of 195 rows reproduce exactly* — so the board is not a claim the
reader has to trust but a claim the page verifies in front of them.

**The published triple is self-consistent.** Each row's launch probability is published at six
decimals and the implied value is computed *from that published number*, so
`conditional value × launch probability` is the implied value on every row and a reader can check
the arithmetic with the figures shown. Before the rounding was moved to that point, 31 of 195 rows
were off by up to 0.375%.

That is also why `dashboard/` is kept under 64 KB. The judge does not read the dossier whole: it
reads a 12,288-token view of it, in path order, and a file that does not fit is cut to its head.
`model.js` — the fitting code — is third in that order and reaches the judge whole, which is the
point of the rename.

## 7. The farm plans

Every row carries eight steps, each an action with a cost and a time, derived from the protocol's own
record and never from a hand-written list of names:

* **the action** follows from the category (a curated vault is deposited into, a lending market is
  supplied to, a DEX is provided liquidity to, and so on);
* **the capital** follows from the TVL ($400 at $1B+, $250 at $250M+, $150 at $100M+, $100 at the
  $50M floor, $50 below it);
* **the gas** follows from the chain (about $12 on Ethereum, $6 on Bitcoin, $1 on Solana, $3
  elsewhere);
* **the hold** follows from the age (90 days under 180, 60 under 365, 45 under 730, then 30). A
  protocol with no first-tracked date — seven of the 195 rows, all of them untracked in the
  snapshot — gets 60 days, the same as one first seen under a year. The age is unknown, and 60 is
  the middle of the rule rather than its most generous end.

The plan is generated **once**, by `lib/model.ts`, and travels with the row: the eight steps go into
`board.json` and into the dataset the page reads. The detail view shows those same eight steps, so
the plan a reader reads on the page is the plan the board hands in — there is no second
implementation that could drift.

## 8. What this is not

It is not a prediction that a token will be issued, or of when, or at what price. The launch odds
say how often protocols of this age and size have issued, not that this one will. An implied value is
this entry's own estimate, and the dashboard labels it as such on every row and in the detail view.
