# The byte plan (measured, 2026-11-19)

## Two budgets, and they are different

1. **The gate.** `verify.mjs` requires dashboard source < 65,536 AND the dossier's text to hold
   the whole source with no `[Cut at ...]` line. `buildDossier` overhead is 422 bytes, so the
   exact no-cut maximum source is **65,064 bytes**.
2. **The judge's view.** 12,288 tokens minus the images (2,240) = 30,144 bytes of text. The kit's
   `viewText` tries "whole" first; failing that it shows each file's **declaration lines**, and
   bodies only if every declaration of every file fits.

## What the judge actually reads today (measured from /tmp/jv_now.txt)

| file | body lines read | declaration lines read |
| --- | --- | --- |
| colors.css | 3 (all) | 0 |
| index.html | 40 (all) | 0 |
| model.js | 228 (all) | 0 |
| page.js | 291 of 1093 | 69 |
| theme.css | 0 of 169 | 120 of 169 |

**The theme.css body is NOT shown.** Its declarations are (120 of 169). The judge sees the
dashboard's design as a list of selectors, not as rules.

## The lever, measured

Freeing bytes is NOT equal across files. Measured by removing comment lines from each file in
turn and re-rendering the judge view (`/tmp/side.mjs`):

| freed from | page.js body lines gained |
| --- | --- |
| model.js (2,008 B) | **+47** |
| page.js (2,070 B) | +22 |
| colors.css (450 B) | +11 |
| theme.css | 0 (but +1 theme.css rule) |

**model.js is worth ~22 page.js body lines per 1,000 bytes. page.js is worth ~11 per 1,000.**
model.js is the cheapest place to free bytes, and every byte freed there becomes page.js code
the judge reads.

## The prize for getting under 65,064

An uncut dossier makes phase 2 of `viewText` run: whole files in path order. Measured with a real
`buildDossier` on a candidate tree (`/tmp/uncut3.mjs`):

- page.js body: 291 → 340 lines (+49)
- theme.css body: 0 → 169 lines (all of it)
- the gate's `[Cut at 65536 bytes]` line disappears

## What is safe to cut

**Comments are invisible to the judge in BOTH phases.** `declarationLines` skips `//` and `*`
lines for JS, and for CSS it takes only the selector text before `{` — a `/* */` comment is
stripped by the block-comment handler. So a comment line:

- costs GATE bytes
- gains the judge NOTHING (neither a body line nor a declaration line)

**So every comment past line 291 of page.js is pure gate cost.** 5,604 bytes of it.
model.js's comments are worth 47 page.js lines each 1,000.

## The order of work

1. **model.js comments** (2,025 B of comment bytes) → buys ~47 page.js body lines.
2. **page.js tail comments** (past line 291: 5,604 B) → buys ~55 more page.js body lines,
   or gate bytes toward the 65,064 ceiling.
3. Whatever is still needed to clear 65,064.

## What NOT to do

- Do not strip model.js's whole body: it is read in full today, and its body is the fitting
  code the judge reads as "the model, in the page's own hand". Cutting model.js's CODE buys
  page.js lines but costs the judge model.js's code — measured as a loss when model.js is cut
  more than ~2 KB.
- Do not strip theme.css: its body is not shown either way; only its selectors are.
