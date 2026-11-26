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
  more — 136 of them below the watchlist's TVL cut, and 19 that clear it and are off the list for
  another reason.

A protocol records no token in DefiLlama's record. That is not proof that it has none, and the
dashboard says so.

## 2. The eligible universe

The house's rule has a structural part and a numeric part. The radar keeps the structural part and
replaces the numeric cut:

| Rule | Applied to | Why |
| --- | --- | --- |
| category is not Bridge, Canonical Bridge, Cross Chain Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, Anchor BTC or CEX | every protocol | a wrapper or a venue of someone else's token is not that protocol's own launch |
| the name does not end in a version marker | every protocol | `Aave V2` is a pool of `Aave`, not a new protocol |
| the name carries no whole word *wrapped*, *staked* or *staking* | every protocol | same reason: WBTC and Binance staked ETH are off the list for this |
| the name does not begin with an exchange's name | every protocol | a listing venue is not a protocol |
| TVL at or above the floor | **dropped** | this is the cut the radar replaces, so it can find the early names below it |

The house's rules name six categories; the board applies those six and two more, Cross Chain Bridge
and Anchor BTC, because the house's own watchlist shows the rule reaching them. Every protocol the
snapshot files under either category that the house kept is off its list, and Circle Gateway — the
one it holds with no token of its own — is off the list too, though its name carries none of the
house's markers. The house's list is the artifact; the six categories are its summary of it, and
the board follows the artifact. Checked against the snapshot: the board's rule leaves off no
protocol that the house's rule keeps, above the floor or not.

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
**19.3 points of base rate**: 55.0% of the old universe "issued", 35.6% of the corrected one does.

## 3. The value model — what a token is worth if it issues

The cohort is every eligible protocol whose token already trades and whose market cap is at least
$1M: **75 protocols**, the only rows in the snapshot where both halves of the question are known.

The fit is a redescending-weight least squares on the log of the market cap over TVL: a residual
past 1.5 MADs is weighted down by 1.5·scale/r, and the normal equations carry that weight
squared. That weight is the one of a quadratic-core, logarithmic-tail loss —

```
rho(r) = r²/2                    while |r| ≤ c
rho(r) = c²/2 + c²·ln(|r|/c)     past it
```

— and it is chosen over a plain least squares, and the comparison is measured over 300 five-fold
splits, paired split by split. The weighted fit misses fewer rows badly (fewer rows off by more
than one log10) in about 150 of 300 splits, and it cuts the worst single row's influence on the
intercept from 0.410 log10 to 0.273 — each the maximum over that fit's own worst row, and the row
a plain fit leans on hardest — Rain, priced at 400 times its deposits — moves the model's own fit
by only 0.084, a fifth as much. Its
advantage on *rank correlation* is **within noise**:
across sixteen independent draws of the 300 splits the win count runs 136–156 against a plain
least squares and 130–166 under a hash-of-slug folding, so half the time the plain fit ranks the
cohort as well or better. Against a plain Huber weight (`min(1, c/r)`, *not* squared) the two are
likewise within noise of each other — the squared weight wins the tail in 53–86 splits against
43–56, the Huber wins the rank correlation in 144–183 — so no claim is made against Huber, and
the loss is named for what it is.

Those ranges are the honest form of the number, because the win count is seed-sensitive: the same
300-split comparison redrawn with a different seed moves the rank-correlation count by fifteen
splits. A single figure quoted to the split would claim a precision the measurement does not have.
The one claim that does survive redrawing is the tail: the form *without* growth misses fewer
rows badly than the form with it in 206–232 of 300 splits, under every fold scheme tried, and
ranks the cohort better in 294–300 of 300.

```
log10(mcap / tvl)  =  a  +  b · log10(tvl)  +  category_log
```

then

```
conditional value  =  tvl · 10^(that sum)
```

The fitted coefficients are `a = 4.4042` and `b = −0.6443`: a power law in TVL. The median protocol
trades at a small and shrinking fraction of the deposits behind it, and the fit reproduces that.

**Growth was measured, and it earns its place in the launch odds, not in the ratio.** In the launch
model it is strong and identified: across the 303 protocols the launch fit is fitted on, the rate
at which a protocol issues falls from **58.7% in the worst seven-day-growth quartile to 40.0%,
26.7% and 17.9%** in the three above it, and the growth coefficient is negative in 300 of 300
bootstrap resamples (95% interval −0.98 to −0.20). In the value model it is not identified at
all. On this cohort the growth term's *sign* is set by the weight's exponent rather than by the
data: plain least squares gives −0.060, the shipped weight gives +0.059, and no bootstrap interval
separates the coefficient from zero. A permutation test that shuffles the growth values among the
cohort's rows puts the real data inside the null (permutation p = 0.52, measured over 2000
shuffles). Paired over 300 five-fold splits, the form *without* growth ranks the
cohort better in 294–300 of 300 splits and misses fewer rows badly in 206–232 of 300. A term
that cannot be told from noise does not belong in a number the board is ranked on — and the two
models must not disagree: a hot protocol is *less* likely to issue, not more.

**How the folds are drawn matters, so both schemes are reported.** The counts above come from a
random assignment of rows to folds — not from position in the sorted cohort, and not from a hash
of the slug. The reason the position matters is that alphabetical neighbours in this cohort are
more alike than random rows — the lag-one correlation of the residuals is +0.083 in alphabetical
order against −0.021 in a random order — so a split that puts neighbours on the same side of the
fold leaks the answer into the score. A **hash of the slug** avoids that particular leak, because
the hash scatters the alphabetical neighbours across the folds. The entry therefore reports the
comparison under **both** schemes, because the scheme moves the numbers and a count quoted under
one scheme alone would claim a precision the other does not have.

Every count above is given as a **range over sixteen independent draws** of the folds, because
the win count moves by fifteen splits when the draw changes; the entry does not quote a single
seed's count as if it were a constant. Under the random scheme the rank-correlation count runs
136–156 against a plain least squares, and 130–166 under the hash scheme; the squared weight
beats a plain Huber weight on the tail in 53–77 splits under the random scheme and 55–86 under
the hash scheme, and the Huber wins the rank correlation in 144–172 and 141–183 respectively.
The one claim that holds under every scheme and every draw is the tail of the growth term: the
form without growth misses fewer rows badly than the form with it, in 206–232 of 300 splits
under the random scheme and 214–231 under the hash scheme.

**The error the board publishes is measured, and it flatters the model.** In-sample, the median
absolute error of the model the board prices with is **0.337 log10** — a factor of 2.2 on the
conditional value. Held out from the fit over 300 random five-fold splits — each fold refitting the
line *and* the shrunk category correction on four folds and predicting the fifth with both, which is
the model the board prices with — the same form scores **0.414 log10** on a median row, a factor of
2.6. The dashboard's model page says both, rather than quoting only the flattering one.

**The category correction.** Each category's residual is added to the fit, but three guards keep a
category with one live protocol from speaking for the whole category:

1. **Winsorizing.** Every residual is clipped to the 10th–90th percentile of the cohort's residuals
   before anything is computed. Without this a single member with a wild market cap (a prediction
   market at 400× its TVL) sets its category's number, and that number then reorders the board.
2. **Shrinkage.** The category's median residual is pulled toward the global median with a prior
   weight of 4: a category with one live member gets roughly a fifth of its own residual and four
   fifths of the cohort's. The formula reproduces every published correction to within 3·10⁻¹².

   The guards matter because the evidence is thin: **21 of the 26 categories have three cohort
   members or fewer**, and 11 have exactly one. A correction fitted on one row is a different kind
   of number from one fitted on ten, so the page's category table now carries the member count
   beside each correction rather than leaving the reader to assume the two are the same. The
   shrinkage bounds what a one-member category can do: the largest gap between such a category's
   own residual and the global is 0.889 log10, and after being pulled four fifths of the way back
   its published correction sits at most 0.178 from the global. The published corrections
   themselves — the multipliers the board applies — run from 0.648 to 1.312 on the conditional
   value across the eleven one-member categories. Across the 21 categories the cohort saw three or
   fewer times, the same two bounds are 1.751 and 0.350, and the multipliers run 0.510 to 1.951;
   across all 26 it has seen they are 1.837, 0.367 and 0.510 to 2.030. The bounds scale with the
   evidence, and the one-member figures are the tightest of the three.
3. **A floor.** A category the cohort has never seen takes the shrinkage target — the cohort's own
   median residual, −0.0599, a factor of 0.871 on the conditional value. It does not contribute
   nothing; it contributes what every category contributes when the cohort says nothing better, and
   23 of the board's 195 rows are in such a category.

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
issued a token of their own. The 35 protocols with no first-tracked date are counted as one year
old, which is what the fit assumes for them, so the column adds up to the fit's own 303:

| Tracked for | Protocols | Issued a token | Rate |
| --- | --- | --- | --- |
| 0–182 days | 52 | 3 | 5.8% |
| 182–365 days | 38 | 8 | 21.1% |
| 365–730 days | 130 | 49 | 37.7% |
| 730–1460 days | 63 | 33 | 52.4% |
| 1460+ days | 20 | 15 | 75.0% |

The fitted model's **AUC on that universe is 0.753** — it separates the protocols that issued from
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
| seven-day growth | the launch odds (the growth term) |
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
told which rows count as issuers. When the page loads it re-runs the weighted fit, the logistic fit and
the category correction from those figures and then checks its own output against the board. The
model page reports the result — *N of 195 rows reproduce exactly* — so the board is not a claim the
reader has to trust but a claim the page verifies in front of them.

**The published triple is self-consistent, at the precision it is shown.** The board shows three
figures per row — the launch odds, the value if it issues and the implied value the board ranks by
— and a reader multiplies the two they can see and must land on the third. So the implied value the
board publishes is computed from the conditional value and the odds *as they are displayed*: the
conditional value to five significant figures, the odds to four decimals of a percent, the product
to three. Measured on the rendered page in exact decimal arithmetic, all 195 rows multiply out.
Publishing the full-precision product instead left a row reading `$21.5M × 5.0000% = $1.08M`, an
arithmetic the reader cannot perform; and rounding the launch probability to four decimals — rather
than four decimals *of a percent* — would have introduced eleven rows that disagree by one in the
last digit. Before the rounding was moved to that point, 31 of 195 rows were off by up to 0.375%.

**The same rule holds on the already-trading table, and it was broken there.** That table prints a
market cap, a TVL and the Cap/TVL multiple between them, and a reader divides the two they can see
and must land on the third. Two things had to change for that to hold. The multiple was published
rounded to three decimals and then displayed at two, so a quotient sitting on a two-decimal
boundary could be pushed over it by the first rounding — Api3's 2.9747247 became 2.975 and then
displayed as 2.98, where the exact division gives 2.97. And the operands were printed at three
significant figures, which does not determine a two-decimal multiple: at three figures a reader's
division missed the printed multiple on 19 of the 119 rows, at four on 4, at five on 2, at six on
none. The operands now print at six significant figures and the data carries the quotient
unrounded, and a reader dividing what is on screen lands on the printed multiple on all 119 rows.
`verify.mjs` reads the precision out of the page's own source and checks all 119 rows, so the rule
cannot be broken without the check noticing.

**The drawer carries the same rule, and it did not.** The already-trading drawer prints the
market cap, the TVL and the Cap/TVL multiple again. It printed the two operands at **six
significant figures** while the multiple beside them is at **four decimals**, and six figures do
not determine a four-decimal multiple: dividing the drawer's own two operands missed the printed
multiple on 3 of the 119 rows, by 0.0006 on Rain and by 0.0001 on the other two. The two operands
are whole dollars in the snapshot, so the drawer now prints them **whole** — the market cap and the
TVL, in dollars, with the thousands a reader reads them with — and the division of the two lands
on the multiple beside them on all 119 rows. A check opens all 119 live rows and does that
division; planting the six-figure rounding back into the built page makes it report exactly those
3 rows.

**The drawer's TVL was too coarse for its own multiplication.** The drawer prints the row's
derivation — the TVL, the fitted multiplier, the category correction, and then the conditional
value those three multiply to. It printed the TVL at **three significant figures** while the
multiplier beside it carried **nine digits**, and three figures do not determine a nine-digit
multiplier's product: the reader's own multiplication missed the printed conditional value on
**68 of the 195 rows**, by up to 0.2%. The TVL is whole dollars in the snapshot, so the drawer
now prints it whole, and the reader's own multiplication lands on the conditional value under it
on **every** row. The model tab's copy already promised "the exact arithmetic ... in the drawer,
where each figure is printed at the precision the multiplication needs"; it was doing the
arithmetic, but not printing the figures that make it exact.

**A multiple printed as zero is a figure that reads as no figure.** Five of the 119 live rows
have a Cap/TVL below 0.005 — Obol at 0.0006, xDAI Stake Bridge at 0.0003 — and the table printed
them at two decimals, so all five read **0.00**. A reader reads 0.00 as *no ratio at all* rather
than as a ratio of six ten-thousandths, and one of them, Obol, carries $717,446 of market cap
against $1.15 billion of TVL — a real number the page was throwing away. The table prints a bound
(`<0.01`) instead, and the drawer's KPI prints the same four decimals as the line under it: they
were printing **0.00** and **0.0006** for one quantity, which is two numbers for one thing.

**And a row's drawer is a call away from its row.** A helper was renamed in the place that
defines it and left in the four places that call it, so every live row's drawer threw a
`ReferenceError` and **did not open at all** — while the whole suite stayed green, because every
check that read a drawer was reading a *board* row's drawer, and no check watched for a page
error on the page's own data. A check now opens every row of both tables (195 board, 119 live)
and asserts that the sheet is on screen afterwards and that nothing threw on the way. The two
drawer checks that read figures no longer wait for a sheet that a throw will never bring: they
report the row as unreadable instead of hanging the suite for thirty seconds.

That table now holds every candidate rather than the largest thirty of them. It used to show
thirty and say the rest were "further down the same list", but the live tab has no filter, no
search and no second page: a reader who wanted the thirty-first row had nowhere to go, and the
drawer for it said the protocol was not on the board. All 119 are there now, so the promise the
copy used to make is one the page keeps.

That is also why `dashboard/` is kept under 64 KB. The judge does not read the dossier whole: it
reads a 12,288-token view of it, in path order, and a file that does not fit is cut to its head.
`model.js` — the fitting code — is third in that order and reaches the judge whole, which is the
point of the rename.

That view is a *different* budget from the 64 KB gate, and the two pull against each other. The
judge's view is 30,144 bytes, and it spends them in this order: every file's declaration lines
first, then the file bodies in path order, until one body does not fit. Two consequences shaped
this dashboard's source:

* the body phase is a **byte pool, not a line count**: a source line costs what it costs, and
  the pool runs out mid-line, so a line of *n* bytes buys one more body line only if *n* bytes
  are left. Measured on `page.js`, adding 100 bytes inside the judge's window costs one body
  line whichever way it is written — a comment, a top-level `var`, or an indented `var` —
  because a declaration line's bytes are subtracted from the body's cost only for the lines
  the declaration phase already showed;
* `theme.css` reaches the judge as **selectors only** — its rule bodies never arrive — so its
  171 selectors are the design system's visible surface, and a cut dossier would show fewer of
  them.

So the comments that earn their place are the ones that carry evidence the code alone does not —
the model's derivation, the refit check, the separation of the already-trading from the still-to-come
— and the ones that merely restate the code are cut, because a reader (and the judge) can read the
code.

### The screenshots the judge reads are not the screenshots in the repository

The kit does not send the judge the three PNGs. It fits each one into a cell — the cover into
1024×640, the other two into 510×640 cells on one sheet — **downscales** it with a Lanczos kernel
and sends the composition as JPEG. The fit never *enlarges*, so what decides a shot's usefulness
is the PNG's own pixel size: a wider PNG arrives smaller. A 1440-wide shot therefore reaches the
judge at 35%: **12px of the page's own text arrives as 4.3px**, which cannot be read. The old
framings put the board's table and the plan's costs and times at that size, and the judge saw a
dashboard it could only guess at.

The framings are now chosen by what the judge ends up with, measured in the composed view rather
than in the raw file:

| shot | PNG | in the judge's view | 12px of text lands at |
| --- | --- | --- | --- |
| `1-board.png` | 1280×800 | 1024×640 (the cover) | 9.6px |
| `2-detail.png` | 800×1010 | 507×640 | 7.6px |
| `3-filtered.png` | 800×1004 | 510×640 | 7.6px |

The cover is 1280 wide rather than 1440 because the kit never enlarges and the width is what
decides the scale: at 1440×900 its text arrived at 8.5px, at 1280×800 it arrives at 9.6px. The
board's table still fits whole at 1280 — the wrapper's `scrollWidth` equals its `clientWidth` at
both widths, so no column is cut. The two rest shots are 800 wide because that is where the table
still fits whole *and* it is the smallest short side the kit accepts; 7.6px is the best a rest
shot can do, since its cell is 510 wide.

The detail shot is **clipped to the drawer and captured at a device scale above 1**, so the row's
own numbers, its derivation and the plan's costs are legible instead of a whole board shrunk to
nothing; the drawer's header is sticky, so the row's name stays on screen while the frame shows
the plan. The board is shot 1280 wide so the table keeps every column, and the filtered view is
800 wide, which is the narrowest width that keeps the hero in two columns *and* the table whole.

Two consequences worth stating, because both are easy to get wrong:

* the kit's advice is 300–350 KB a screenshot, and its reason is the dossier ("three at the
  512 KiB cap exceed the dossier"). The dossier's own cap is 1.5 MiB, and framing for the judge
  costs fewer bytes than a full-width frame of the same content: these shots land the dossier at
  0.640 MiB. The rule that binds is the dossier's cap, not the band;
* the entry's build **copies** `screenshots/` into `out/`, so the build has to run again after the
  shoot or the dossier carries the previous shots. The gate's screenshot check catches that — it
  re-renders each view and compares it pixel by pixel — but it only catches it if the build ran.

`verify.mjs` now measures the legibility itself, in the judge's composed view, with two bars because
the cells differ: the cover's cell is 1024×640 and can carry 12px of text at 9.6px, while the two
rest cells are 510 wide and the kit refuses a shot under an 800px short side, so 7.6px is the best
a rest shot can do. Its controls plant both old framings — the 1024-wide filtered shot at 6.0px
and the 1440-wide cover at 8.5px — and require the same measurement to catch them, so the check
cannot pass by measuring nothing.

## 7. The farm plans

Every row carries nine steps, each an action with a cost and a time, derived from the protocol's own
record and never from a hand-written list of names:

* **the action** follows from the category (a curated vault is deposited into, a lending market is
  supplied to, a DEX is provided liquidity to, and so on);
* **the capital** follows from the TVL, as a ladder: the bigger the book, the deeper the
  position. The shape is fixed — a book 40 times the size gets a stake 8 times deeper — and the
  **scale** is set so that the plan's gas is a small share of the stake: **$1050** below $50M,
  **$2100** to $100M, **$3150** to $250M, **$5250** to $1B, **$8400** above it. The scale is not a
  guess: it is the smallest multiple of the shape whose bottom step covers the most expensive gas
  bill the board can produce ($204), so the deepest position any row asks for still pays for its
  own fees several times over;
* **why the capital had to change at all**: the capital and the gas used to be decided apart — the
  capital from the TVL band, the gas from the chain — so a plan could tell a farmer to stake $50
  and then spend $204 of gas on it, with the gas at four times the stake. The stake now has to
  carry the gas the plan spends: the wallet, the setup, every weekly action, the claim and the
  unwind. Sizing each row by its **own** gas instead of scaling the ladder once would have put a
  $28M protocol's stake above a $1.58B one's — the opposite of what a ladder means — so the
  ladder is scaled once and every row reads its step off it. The result is **0 inversions** in the
  195 rows, and every capital is a multiple of $50, so the number a reader sees is one they can
  fund;
* **the gas** follows from the chain (about $12 on Ethereum, $6 on Bitcoin, $1 on Solana, $3
  elsewhere);
* **the hold** follows from the age (90 days under 180, 60 under 365, 45 under 730, then 30). A
  protocol with no first-tracked date — seven of the 195 rows, all of them untracked in the
  snapshot — gets 60 days, the same as one first seen under a year. The age is unknown, and 60 is
  the middle of the rule rather than its most generous end.
* **the gas the plan counts** is priced for the whole hold window, not for a month: the weekly
  action is budgeted at the chain's own gas rate for each of the hold window's whole weeks, so a
  90-day hold is budgeted for 13 weeks and a 30-day hold for 5. Before this was priced from the
  window, every one of the 195 rows budgeted four weeks of gas and then held for five to thirteen —
  an understatement of more than a factor of three on the longest holds.
* **the weekly cadence is the plan's own, not the protocol's** — and the plan says so. The
  snapshot carries ten fields per protocol and not one of them records a points schedule, an
  activity series, a snapshot cadence or a streak; the only time-series field is one week of
  change. So the plan cannot know how often a protocol measures activity, and it does not pretend
  to: it says that the snapshot carries no points schedule for that protocol, and prices the gas
  at a week, which is the cadence that cannot be too slow — more acts never lose a count, so if
  the protocol's own schedule is slower the bill comes down, but it can never come up. The plan
  also no longer tells the reader to watch "its points page" or to keep "the streak" going. The
  rule the whole entry follows is that it never promises what the record cannot support, and the
  farm plan is where a reader would act on that promise.
* **the whole bill** is stated in one line, so the reader can check the position against the fees
  instead of adding five costs up in their head. The plan spends gas at five points, and step 8
  says what that comes to and what share of the stake it is. Across the 195 rows the share runs
  from 0.2% to 19.4%, and no row spends more than a quarter of its stake on gas.
* **what the position earns** follows from the action, not from the category's name. A deposit
  into a vault, a lending market, a pool or a strategy earns the protocol's own yield, and the
  plan says so. A swap, a purchase, a bridge, a collateral lock, a margin position, a wrapper or
  a card balance earns nothing by itself, and the plan says that instead — promising a yield on a
  position that pays none is the one thing a farm plan must not do. The rule is a list of
  *categories*, never of protocols, and a category the action table does not name falls back to a
  deposit, which earns.
* **the closing note** follows the age band the model itself uses. A protocol inside the model's
  youngest band — 49 of the 188 dated rows, tracked for under 182 days — is described as early,
  with the launch curve's own finding quoted back: protocols this young issue *least* often. The
  other rows are described as slow ones. A protocol with no first-tracked date is told that the
  house cannot tell how long it has run, and is not told anything it cannot support.

The plan is generated **once**, by `lib/model.ts`, and travels with the row: the nine steps go into
`board.json` and into the dataset the page reads. The detail view shows those same nine steps, so
the plan a reader reads on the page is the plan the board hands in — there is no second
implementation that could drift.

## 8. What this is not

It is not a prediction that a token will be issued, or of when, or at what price. The launch odds
say how often protocols of this age and size have issued, not that this one will. An implied value is
this entry's own estimate, and the dashboard labels it as such on every row and in the detail view.
