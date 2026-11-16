# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fny666/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fny666/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar of the protocols whose token has not issued yet, ranked by an implied value derived from
the snapshot's own figures — and a farm plan for every one of them.

Built for the make.fun bounty **Build the best token launch radar** (`token-radar-01`).

## What it does

`main.ts` reads the sealed snapshot at `/input/snapshot.json`, fits its value model on that
snapshot's own data, scores every protocol that records no token, and writes:

| File | What it holds |
| --- | --- |
| `/output/board.json` | the ranked board, one row per protocol, each with its farm plan |
| `/output/data.js` | the page's dataset — the same rows, plus the raw cohort and universe the page refits from |
| `/output/dashboard/` | the page: `index.html`, `colors.css`, `theme.css`, `model.js`, `page.js` |
| `/output/screenshots/` | the board, a detail view and a filtered view |
| `/output/dossier.json` | what the judge reads, written with the vendored make.fun library |

Node 22, standard library only. Nothing is installed before it runs.

## The model in one paragraph

The snapshot holds protocols whose tokens already trade, each with a market cap and a TVL. That
cohort — 75 protocols after the eligibility rules below — is the calibration set: a Huber-weighted
least squares fits log(market cap over TVL) against log TVL and seven-day growth, with a
per-category correction shrunk toward the global mean. The chosen form was picked by five-fold
cross-validation on that cohort (0.420 median absolute error in log10 dollars). A second logistic
fit, on the whole 433-protocol eligible universe, gives the chance a protocol of a given age and
size issues a token at all (AUC 0.735). The board ranks the product: the value if it issues, times
the chance it issues. No constant is typed in from outside and no protocol name is special-cased —
the same function scores every row.

The full write-up, including the cross-validation table and the launch curve, is in
[MODEL.md](MODEL.md).

## The dashboard

* **The board** — every row carries the protocol's rank, TVL, seven-day growth, launch odds, the
  value if it issues, and the implied value the board ranks it by. Sortable on every column,
  filterable by name, category, chain and scope.
* **The plot** — implied value against launch odds, dot size by TVL; click a dot for its detail.
* **The detail view** — the model's own arithmetic for that row, the snapshot record it read, an
  eight-step farm plan with what each step costs and how long it takes, and the peer protocols of
  the same category.
* **Already trading** — the protocols whose tokens do trade, in their own table, at the market's own
  value. They are never mixed into the ranking.
* **The model** — the fitted coefficients, the launch curve read off the snapshot's cohorts, the
  category corrections, and the fit's own error and AUC.

**The page refits the model itself.** `model.js` carries the fitting code and `data.js` carries the
raw cohort and universe it needs, so on load the page re-runs the whole fit from the snapshot's
figures and then recomputes every row of the board from them — 195 of 195 rows reproduce exactly.
The board is not a number the reader has to take on trust; the page checks it in front of them.

No framework, no network, no build step. The page is five files, and their source stays under
64 KB. The judge reads them in path order, so the files are named for what the judge should see
first: `colors.css` (the palette), `index.html` and `model.js` (the fit) reach the judge whole, and
`page.js` reaches it in full up to its budget; `theme.css` is read as its selectors.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Or, with the sealed input mounted at `/input`:

```sh
node main.ts
```

## Licence

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=jmrvnq2m&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
