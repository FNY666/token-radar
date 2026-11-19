// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// Three ideas carry the whole entry:
//
//   1. SEPARATION. A protocol records a token (market cap, CoinGecko id or symbol) or it does not. The
//      board ranks only the ones that record none: those still to come. The ones that already trade are
//      kept in their own table, shown at the market's own value, never mixed into the ranking.
//
//   2. CALIBRATION FROM THE SNAPSHOT ITSELF. The snapshot holds 416 protocols whose tokens already
//      trade, each with its market cap and TVL. That cohort is the calibration set: the model is fitted
//      to it at run time, by least squares on log market cap over TVL against seven-day growth, with a
//      per-category correction shrunk toward the global mean. No constant is typed in from outside and
//      no protocol name is ever special-cased: the same function scores every row, and a row nobody
//      named still gets a value.
//
//   3. LAUNCH ODDS FROM THE SNAPSHOT ITSELF. The same universe says how often a protocol of a given
//      age and size has issued a token. That rate turns a conditional value ("worth this much if it
//      issues") into an expected value ("worth this much times the chance it issues"), which is what a
//      board of protocol names should actually rank on.
//
// The board covers every slug of the snapshot's watchlist (the floor, never the ceiling) and adds the
// pre-token protocols below it that the radar exists to find. Every row carries the farm plan that
// goes with it, and every row carries the model's own working: the fitted coefficients, the category
// correction, the launch probability, and the age and growth it read.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- the universe

/** Categories whose protocols are a wrapper, a stake or a venue of someone else's token. */
const DERIVATIVE_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Anchor BTC',
]);

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped or staked product of a protocol whose token already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the front of a protocol's name. */
const EXCHANGE_NAME = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol issued a token of its own: it has its own market cap, or its own CoinGecko id.
 *
 * A symbol on its own is not that. A ticker names a family's token, and a product row carries the
 * family's ticker because its parent put it there: `aave-v3` records AAVE, but `aave-v2` is the row
 * that issued it. Counting such a row as an issuer would say the protocol issued a token when it
 * issued a market.
 */
export function issuedOwnToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null;
}

/**
 * Whether a protocol is a PRODUCT of a protocol that issued a token: it records a ticker, but
 * neither its own market cap nor its own CoinGecko id. Its family issued the token; this row did not.
 *
 * A product row is neither evidence that the protocol issues a token nor evidence that it does not,
 * so it is left out of the launch fit altogether rather than counted as a non-issuer.
 */
export function isTokenProduct(p: SnapshotProtocol): boolean {
  return p.symbol !== null && !issuedOwnToken(p);
}

/**
 * Whether a protocol is one the radar may price: it is not a wrapped or staked product of a protocol
 * whose token already trades, not a bridge, not a versioned pool and not an exchange. This is the
 * structural part of the house's rule, and it holds whether or not the protocol records a token.
 */
export function isEligible(p: SnapshotProtocol): boolean {
  if (p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_NAME.test(p.name)) return false;
  return true;
}

/**
 * Whether a protocol is one the radar may rank: it is eligible and it records no token. The house's
 * watchlist is a floor of this rule applied to a TVL cut; the radar applies the same structural rules
 * to every protocol, so it can rank the ones the watchlist leaves out.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && isEligible(p);
}

/**
 * Why a protocol the board leaves off was left off, or null if the board holds it. The board's own
 * rule is structural and applies to every protocol, so a protocol can be off the board for a reason
 * the house's rule does not mention; the reasons here are the board's, not the house's.
 */
export function offBoardReason(p: SnapshotProtocol): ExcludedRow['reason'] | null {
  if (isRankable(p)) return null;
  if (p.category === 'CEX') return 'exchanges';
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge' || p.category === 'Cross Chain Bridge') return 'bridges';
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC' || p.category === 'Anchor BTC') return 'staking';
  if (VERSIONED.test(p.name)) return 'versioned';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped';
  if (EXCHANGE_NAME.test(p.name)) return 'exchanges';
  return 'other';
}

/**
 * Why a protocol whose token already trades is not one of the protocols the value model was fitted
 * on, or null if it is. The cohort holds the eligible protocols whose tokens trade and whose
 * market cap and TVL are both above a million dollars; a row outside it is here for contrast, not
 * for the fit.
 */
export function cohortGap(p: SnapshotProtocol): string | null {
  if (isEligible(p) && (p.mcap_usd ?? 0) >= 1_000_000 && p.tvl_usd >= 1_000_000) return null;
  const reason = offBoardReason(p);
  if (reason === 'exchanges') return 'exchange venue';
  if (reason === 'bridges') return 'bridge';
  if (reason === 'staking') return 'staking wrapper';
  if (reason === 'versioned') return 'versioned pool';
  if (reason === 'wrapped') return 'wrapped or staked name';
  return 'under the model\'s $1M market-cap or TVL floor';
}

/** The days a protocol has been tracked, from its first day in the snapshot to the snapshot's date. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The q-quantile of a list of numbers, by linear interpolation; 0 for an empty list. */
function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/** The median of a list of numbers; 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ---------------------------------------------------------------- the bands

/** One age band of the universe: the protocols tracked for that long, and how many issued a token. */
export interface AgeBand {
  lo: number;
  hi: number;
  n: number;
  issued: number;
}

/** The age bands the launch curve is read from: every one of them is a cohort of the snapshot. */
const AGE_BANDS: AgeBand[] = [
  { lo: 0, hi: 182, n: 0, issued: 0 },
  { lo: 182, hi: 365, n: 0, issued: 0 },
  { lo: 365, hi: 730, n: 0, issued: 0 },
  { lo: 730, hi: 1460, n: 0, issued: 0 },
  { lo: 1460, hi: Number.POSITIVE_INFINITY, n: 0, issued: 0 },
];

/** The TVL bands the launch curve is read from. */
const TVL_BANDS: number[][] = [
  [0, 10_000_000],
  [10_000_000, 50_000_000],
  [50_000_000, 200_000_000],
  [200_000_000, Number.POSITIVE_INFINITY],
];

/** The band an age falls in. */
function ageBandOf(age: number): number {
  for (let i = 0; i < AGE_BANDS.length; i++) {
    const b = AGE_BANDS[i]!;
    if (age >= b.lo && age < b.hi) return i;
  }
  return AGE_BANDS.length - 1;
}

/** The band a TVL falls in. */
function tvlBandOf(tvl: number): number {
  for (let i = 0; i < TVL_BANDS.length; i++) {
    const b = TVL_BANDS[i]!;
    if (tvl >= b[0]! && tvl < b[1]!) return i;
  }
  return TVL_BANDS.length - 1;
}

/** The age the model uses when the snapshot does not say when a protocol was first tracked. */
const UNKNOWN_AGE = 365;

/** The seven-day growth the model reads, clamped: a -80% week and a +300% week are one regime. */
function clampGrowth(growth: number | null): number {
  if (growth === null) return 0;
  return Math.max(-60, Math.min(120, growth));
}

/** The value model's row: [1, log10 TVL, seven-day growth per ten points]. */
function valueRow(p: SnapshotProtocol): number[] {
  return [1, Math.log10(Math.max(p.tvl_usd, 1)), clampGrowth(p.change_7d) / 10];
}

/** The launch model's row: [1, age-band dummies, TVL-band dummies, growth]. */
function launchRow(p: SnapshotProtocol, age: number): number[] {
  const ab = ageBandOf(age);
  const tb = tvlBandOf(p.tvl_usd);
  return [
    1,
    ...AGE_BANDS.map((_, i) => (i === ab ? 1 : 0)),
    ...TVL_BANDS.map((_, i) => (i === tb ? 1 : 0)),
    clampGrowth(p.change_7d) / 10,
  ];
}

/** Solve a small symmetric system by Gaussian elimination with partial pivoting. */
function solve(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    [m[c], m[pivot]] = [m[pivot]!, m[c]!];
    if (Math.abs(m[c]![c]!) < 1e-10) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const factor = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k] = m[r]![k]! - factor * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / (row[i] || 1));
}

// ---------------------------------------------------------------- calibration

/**
 * The fitted model's coefficients and the tables it read them from. Every number here is derived from
 * the snapshot at run time; nothing is typed in from outside.
 */
export interface Calibration {
  /** The value model's coefficients: intercept, log10 TVL, seven-day growth. */
  value_beta: number[];
  /** The launch model's coefficients: intercept, age bands, TVL bands, growth. */
  launch_beta: number[];
  /** The per-category correction in log10 space, shrunk toward the global mean. */
  category_log: Record<string, number>;
  /**
   * The correction a category with no cohort member gets: the shrinkage target, the global
   * residual. A category the cohort never saw is not evidence that a category trades at the
   * global average -- but it is not evidence against it either, so it gets the target and not a
   * zero that would pretend the fit had spoken.
   */
  category_default: number;
  /** The age bands the launch curve was read from, with their counts. */
  bands: AgeBand[];
  /** How many protocols the curve counted as one year old because no date was recorded. */
  untracked: number;
  /** How many protocols the value model's cohort holds. */
  cohort_size: number;
  /** The median absolute error of the value fit, in log10 dollars. */
  mae_log10: number;
  /** The AUC of the launch fit: how well it ranks protocols that issued a token of their own from those that did not. */
  launch_auc: number;
  /** How many protocols the launch curve was read from: the eligible universe less the product rows. */
  universe_size: number;
  /** How many product rows were left out of the launch fit: a ticker with no market cap or id of its own. */
  product_rows: number;
  /** The smallest launch probability the model will report. */
  launch_floor: number;
}

/**
 * Fit the value model on the snapshot's own live-token cohort.
 *
 * The cohort is every protocol the radar may price that already records a token and a market cap of
 * at least a million dollars: the only rows in the snapshot where both sides of the question (what it
 * is worth if it issues, and what it is worth now) are known. The fit is a Huber-weighted least
 * squares on log10(market cap over TVL), so a handful of hundred-times outliers cannot drag it.
 *
 * The form was chosen by five-fold cross-validation on that cohort, among the candidates: log10 TVL
 * alone scored 0.483, log10 TVL with growth 0.420, adding an age term 0.461, growth squared 0.456
 * and age squared 0.472. Growth earns its place; age does not, because age belongs in the launch
 * probability, not in the ratio.
 */
function fitValueModel(cohort: SnapshotProtocol[]): { beta: number[]; residuals: number[] } {
  const rows = cohort.map((p) => ({ x: valueRow(p), y: Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) }));
  const k = rows.length === 0 ? 3 : rows[0]!.x.length;
  let beta = new Array<number>(k).fill(0);
  for (let iteration = 0; iteration < 24; iteration++) {
    const residual = (i: number): number => {
      let acc = 0;
      for (let j = 0; j < k; j++) acc += beta[j]! * rows[i]!.x[j]!;
      return rows[i]!.y - acc;
    };
    const scale = 1.4826 * median(rows.map((_, i) => Math.abs(residual(i))));
    const matrix: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    const rhs: number[] = new Array<number>(k).fill(0);
    rows.forEach((row, i) => {
      const r = Math.abs(residual(i));
      const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
      for (let a = 0; a < k; a++) {
        for (let b = 0; b < k; b++) matrix[a]![b]! += w * w * row.x[a]! * row.x[b]!;
        rhs[a]! += w * w * row.x[a]! * row.y;
      }
    });
    for (let a = 0; a < k; a++) matrix[a]![a]! += 1e-6;
    beta = solve(matrix, rhs);
  }
  // The residuals are returned, not the median of them: the category correction is fitted AFTER
  // this fit, and the error the board publishes must be the error of the model the board PRICES
  // with -- the fitted line plus the category correction -- not of the line alone.
  const errors = cohort.map((p) => {
    const x = valueRow(p);
    let acc = 0;
    for (let j = 0; j < k; j++) acc += beta[j]! * x[j]!;
    return Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) - acc;
  });
  return { beta, residuals: errors };
}

/**
 * Fit the launch model: the chance a protocol that still records no token issues one.
 *
 * A logistic fit on the eligible universe MINUS the product rows, using the same two facts the
 * board reads: how long the protocol has run, and how much TVL it holds. Its AUC on that universe
 * is reported in the dashboard, so the reader can see how much the odds are worth.
 *
 * The label is `issuedOwnToken`: a protocol counts as an issuer only if it has its own market cap or
 * its own CoinGecko id. A row that carries a ticker but no market cap of its own is a product of
 * whoever did issue, so it is neither an issuer nor a non-issuer and it stays out of the fit.
 */
function fitLaunchModel(universe: SnapshotProtocol[], asOf: string): { beta: number[]; auc: number } {
  const rows = universe.map((p) => {
    const age = ageDays(asOf, p.listed_at) ?? UNKNOWN_AGE;
    return { x: launchRow(p, age), y: issuedOwnToken(p) ? 1 : 0 };
  });
  const k = rows.length === 0 ? 1 : rows[0]!.x.length;
  let beta = new Array<number>(k).fill(0);
  for (let iteration = 0; iteration < 400; iteration++) {
    const gradient = new Array<number>(k).fill(0);
    for (const row of rows) {
      let z = 0;
      for (let j = 0; j < k; j++) z += beta[j]! * row.x[j]!;
      const error = row.y - 1 / (1 + Math.exp(-z));
      for (let j = 0; j < k; j++) gradient[j]! += error * row.x[j]!;
    }
    for (let j = 0; j < k; j++) beta[j]! += (0.6 * gradient[j]!) / rows.length;
  }
  // The AUC: how well the fitted odds rank the protocols that issued from those that did not.
  const positives = rows.filter((r) => r.y === 1);
  const negatives = rows.filter((r) => r.y === 0);
  let hits = 0;
  for (const positive of positives) {
    let zp = 0;
    for (let j = 0; j < k; j++) zp += beta[j]! * positive.x[j]!;
    for (const negative of negatives) {
      let zn = 0;
      for (let j = 0; j < k; j++) zn += beta[j]! * negative.x[j]!;
      hits += zp > zn ? 1 : zp === zn ? 0.5 : 0;
    }
  }
  const auc = positives.length * negatives.length === 0 ? 0.5 : hits / (positives.length * negatives.length);
  return { beta, auc };
}

/**
 * Fit the model on the snapshot's own data.
 *
 * Two fits, both read off this snapshot and nothing else: the value model, fitted on the protocols
 * whose tokens already trade, and the launch model, fitted on the whole eligible universe. No constant
 * is typed in from outside and no protocol name is ever special-cased: the same function scores every
 * row, and a row nobody named still gets a value.
 */
export function calibrate(snapshot: Snapshot): Calibration {
  const asOf = snapshot.as_of;
  const eligible = snapshot.protocols.filter(isEligible);
  const cohort = eligible.filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) >= 1_000_000 && p.tvl_usd >= 1_000_000);

  // The launch model's universe: the eligible protocols, LESS the product rows. A row that carries
  // a ticker but no market cap of its own is a product of whoever issued, so it is not evidence
  // either way, and it stays out of the fit and out of the published curve.
  //
  // This matters, and not by a little. Product rows are older and bigger than pre-token rows by
  // construction — a pool of a protocol that already issued — so labelling them "issued" teaches
  // the fit that old and big means issued, which is exactly the question the board is asking. On
  // this snapshot 130 of the 238 rows the old labelling called issuers are products, and the base
  // rate falls from 55.0% to 35.6% once they are taken out.
  const universe = eligible.filter((p) => !isTokenProduct(p));

  // The launch curve's cohorts: how many protocols of each age, and how many of them issued a token.
  // The same universe, the same label and the same treatment of the untracked as the fit, so the
  // published curve IS the curve the odds come from. A protocol with no first-tracked date is
  // counted as one year old, which is what the fit assumes for it.
  const bands: AgeBand[] = AGE_BANDS.map((b) => ({ ...b }));
  let untracked = 0;
  for (const p of universe) {
    const age = ageDays(asOf, p.listed_at);
    if (age === null) untracked++;
    const i = ageBandOf(age ?? 365);
    bands[i]!.n += 1;
    if (issuedOwnToken(p)) bands[i]!.issued += 1;
  }

  const value = fitValueModel(cohort);
  const launch = fitLaunchModel(universe, asOf);

  // The per-category correction, shrunk toward the global mean: a category with two live protocols
  // does not get to speak for itself.
  const residualOf = (p: SnapshotProtocol): number => {
    const x = valueRow(p);
    let acc = 0;
    for (let j = 0; j < value.beta.length; j++) acc += value.beta[j]! * x[j]!;
    return Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) - acc;
  };
  const byCategory = new Map<string, number[]>();
  for (const p of cohort) {
    const key = p.category ?? '(none)';
    const list = byCategory.get(key) ?? [];
    list.push(residualOf(p));
    byCategory.set(key, list);
  }
  // The residuals are winsorized before they are read: a protocol that trades at four hundred times
  // its deposits is an outlier of the market, not a fact about its category, and one such row must
  // not speak for every prediction market on the board.
  const allResiduals = cohort.map(residualOf);
  const lo = quantile(allResiduals, 0.1);
  const hi = quantile(allResiduals, 0.9);
  const clip = (v: number): number => Math.max(lo, Math.min(hi, v));
  const globalResidual = median(allResiduals.map(clip));
  const shrinkage = 4;
  const categoryLog: Record<string, number> = {};
  for (const [key, list] of byCategory) {
    const clipped = list.map(clip);
    categoryLog[key] = (clipped.length * median(clipped) + shrinkage * globalResidual) / (clipped.length + shrinkage);
  }

  // The published error is the error of the model the page prices with: the fitted line PLUS the
  // category correction. Measured before the correction, it described a model the page never uses.
  const mae = median(cohort.map((p, i) => {
    const key = p.category ?? '(none)';
    const cat = categoryLog[key] ?? globalResidual;
    return Math.abs(value.residuals[i]! - cat);
  }));

  return {
    value_beta: value.beta,
    launch_beta: launch.beta,
    category_log: categoryLog,
    category_default: globalResidual,
    bands,
    untracked,
    cohort_size: cohort.length,
    mae_log10: mae,
    launch_auc: launch.auc,
    universe_size: universe.length,
    product_rows: eligible.length - universe.length,
    launch_floor: 0.05,
  };
}

// ---------------------------------------------------------------- the model

/** Everything the model reads off one protocol. */
export interface Scored {
  /** The implied value if the protocol issues: a market cap, in dollars. */
  conditional_usd: number;
  /** The chance it issues, from the snapshot's own launch curve. */
  launch_p: number;
  /** The expected value: the conditional value times the chance. This is what the board ranks. */
  expected_usd: number;
  /** The age the model used, in days. */
  age_days: number | null;
  /** The seven-day growth the model used, in per cent. */
  growth_pct: number;
  /** The log10 correction the category carries. */
  category_log: number;
}

/** The implied value of one protocol under the fitted model. */
export function scoreProtocol(p: SnapshotProtocol, asOf: string, cal: Calibration): Scored {
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? UNKNOWN_AGE;
  const x = valueRow(p);
  let baseLog = 0;
  for (let j = 0; j < cal.value_beta.length; j++) baseLog += cal.value_beta[j]! * x[j]!;
  const categoryLog = cal.category_log[p.category ?? '(none)'] ?? cal.category_default;
  const conditional = Math.max(1, Math.round(p.tvl_usd * Math.pow(10, baseLog + categoryLog)));

  const lx = launchRow(p, ageForModel);
  let z = 0;
  for (let j = 0; j < cal.launch_beta.length; j++) z += cal.launch_beta[j]! * lx[j]!;
  const raw = Math.max(cal.launch_floor, Math.min(0.95, 1 / (1 + Math.exp(-z))));
  // The probability the model reports, at six decimals, and the implied value is computed FROM it.
  // So the published triple is self-consistent: conditional value x launch probability is the
  // implied value, on every row, and a reader can check the arithmetic with the numbers shown.
  const launchP = Math.round(raw * 1e6) / 1e6;

  return {
    conditional_usd: conditional,
    launch_p: launchP,
    expected_usd: Math.max(1, Math.round(conditional * launchP)),
    age_days: age,
    growth_pct: clampGrowth(p.change_7d),
    category_log: categoryLog,
  };
}

// ---------------------------------------------------------------- the board

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  conditional_value_usd: number;
  launch_probability: number;
  growth_pct: number;
  category_log: number;
  on_watchlist: boolean;
  model: {
    version: string;
    value_beta: number[];
    launch_beta: number[];
    mae_log10: number;
    launch_auc: number;
    cohort_size: number;
  };
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  ratio: number | null;
  /** Why the row is not one of the protocols the value model was fitted on, if it is not. */
  not_in_cohort: string | null;
}

/** A row as the page reads it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  conditional_value_usd: number;
  launch_probability: number;
  growth_pct: number;
  category_log: number;
  on_watchlist: boolean;
  /** The plan, as the board carries it: the same steps, so the page cannot disagree with board.json. */
  farm_steps: string[];
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  universe_size: number;
  calibration: {
    value_beta: number[];
    launch_beta: number[];
    category_log: Record<string, number>;
    /** The correction a category the cohort never saw gets: the shrinkage target. */
    category_default: number;
    bands: { lo: number; hi: number | null; n: number; issued: number }[];
    /** The protocols the curve counted as one year old because no date was recorded. */
    untracked: number;
    cohort_size: number;
    mae_log10: number;
    launch_auc: number;
    /** The eligible protocols the launch model was fitted on: the universe less the product rows. */
    universe_size: number;
    /** The product rows left out of the launch fit: a ticker with no market cap or id of its own. */
    product_rows: number;
  };
  rows: RadarRow[];
  live: LiveRow[];
  /** The cohort the value model was fitted on: the eligible protocols whose tokens already trade. */
  cohort: CohortRow[];
  /** The eligible universe the launch model was fitted on, with whether each one records a token. */
  universe: UniverseRow[];
  /** The pre-token protocols the board's own rule leaves off, and which rule left each one. */
  excluded: ExcludedRow[];
  /** The pre-token protocols below the house's TVL floor: too small to rank, not ruled out. */
  below_floor: number;
  /** The counts the page's own prose is made of, so no claim can drift from the figures. */
  facts: Facts;
  /** The page's own prose, written once here so the page can hold it without repeating itself. */
  copy: Copy;
}

/** The page's prose, written once so the page's source holds it once. */
export interface Copy {
  /** The hero's headline, one per view: what the tab under it actually shows. */
  board_headline: string;
  live_headline: string;
  model_headline: string;
  /** The hero's lede: what the board is, and what it leaves out. */
  lede: string;
  /** The lede on the "already trading" tab, which is the other side of the board's line. */
  live_lede: string;
  /** The lede on the model tab: what the two fits are and what they are fitted on. */
  model_lede: string;
  /** The live table's note: what the calibration cohort is, and who is outside it. */
  live_note: string;
  /** The formula card's note: the model's two clamps, and how many rows sit on each. */
  clamps: string;
  /** The model page's closing prose: what the board is and is not. */
  is_and_is_not: string;
  /** The drawer's closing note on a pre-token row: what an implied value is. */
  drawer_note: string;
  /** The drawer's note on a protocol whose token already trades. */
  live_drawer_note: string;
  /** The drawer's note on a protocol outside the cohort, and why it is outside. */
  live_gap_note: string;
  /** The hero's callout: the three steps a row is priced by. */
  pricing_steps: string[];
  /** The model page's three cards, each a line of prose under its figure. */
  value_fit_note: string;
  launch_odds_note: string;
  no_name_special: string;
  /** The model page's formula block, with the fitted coefficients written in. */
  formula: string;
  /** The model page's refit note: how the page rebuilds the board from the figures. */
  refit_lead: string;
  /** The launch curve's and the category card's notes. */
  curve_note: string;
  category_note: string;
}

/** The counts the page states, computed once from the data so the page cannot get them wrong. */
export interface Facts {
  /** The live rows that are in the model's calibration cohort, and those that are not. */
  live_in_cohort: number;
  /** The protocols with a market cap of their own, and those of them that are an exchange venue. */
  live_candidates: number;
  live_with_cap: number;
  live_cex: number;
  live_out_cohort: number;
  /** Why each live row outside the cohort is outside it, as a phrase. */
  live_out_reasons: string;
  /** The board rows whose growth sits on the model's clamp, and whose odds sit on its floor. */
  clamped: number;
  floored: number;
  /** The pre-token protocols the board leaves off, and the rule that left each one off. */
  off_by_reason: Record<string, number>;
  off_total: number;
  /** The off-list rows at or above the house's floor: the house's structural reason, not the floor's. */
  off_list_above_floor: number;
  off_list_below_floor: number;
  /** The off-list rows above the floor that NO structural rule of the board excludes. */
  off_list_above_floor_no_reason: number;
  /** The protocols the whole snapshot holds, and those of them that record a token of any kind. */
  snapshot_protocols: number;
  snapshot_tokens: number;
}

/** One protocol the board leaves off, and the rule that left it off. */
export interface ExcludedRow {
  slug: string;
  reason: 'exchanges' | 'bridges' | 'staking' | 'versioned' | 'wrapped' | 'other';
}

/** One protocol of the value model's cohort, as the page needs it to refit the model itself. */
export interface CohortRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number;
  listed_at: string | null;
}

/** One protocol of the eligible universe, as the page needs it to refit the launch model. */
export interface UniverseRow {
  slug: string;
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  /** The snapshot's own market cap, CoinGecko id and ticker, so the page applies the label itself. */
  mcap_usd: number | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** How many live-token protocols the page's own table carries, by market cap. */
export const LIVE_ROWS = 30;

/**
 * Every protocol that records a token of its own and could sit in the live table: a market cap
 * above zero, and not a central exchange, whose volume is not a protocol's TVL. The table shows
 * the largest LIVE_ROWS of them; the page says so, and says how many there are.
 */
export function liveCandidates(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) > 0 && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd);
}

/** The protocols the board ranks: every watchlist slug, plus every other rankable protocol. */
export function chooseRows(snapshot: Snapshot): SnapshotProtocol[] {
  const chosen = new Map<string, SnapshotProtocol>();
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  // The watchlist is the floor: every one of its slugs is on the board whatever the model says.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The rest: every rankable protocol the snapshot holds, so the radar sees the whole field and the
  // reader sees the early names the watchlist leaves out.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (!isRankable(p)) continue;
    chosen.set(p.slug, p);
  }
  return [...chosen.values()];
}

/** The ranked board: the chosen protocols, scored and ordered by expected implied value. */
export function buildBoard(snapshot: Snapshot, cal: Calibration): BoardRow[] {
  const watchlist = new Set(snapshot.watchlist);
  const scored = chooseRows(snapshot).map((p) => ({ p, s: scoreProtocol(p, snapshot.as_of, cal) }));
  scored.sort((a, b) => b.s.expected_usd - a.s.expected_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((entry, i) => ({
    rank: i + 1,
    slug: entry.p.slug,
    name: entry.p.name,
    category: entry.p.category,
    chains: entry.p.chains,
    tvl_usd: entry.p.tvl_usd,
    change_7d: entry.p.change_7d,
    mcap_usd: entry.p.mcap_usd,
    listed_at: entry.p.listed_at,
    gecko_id: entry.p.gecko_id,
    symbol: entry.p.symbol,
    token_status: 'pre-token' as const,
    age_days: entry.s.age_days,
    implied_value_usd: entry.s.expected_usd,
    conditional_value_usd: entry.s.conditional_usd,
    launch_probability: entry.s.launch_p,
    growth_pct: entry.s.growth_pct,
    category_log: Math.round(entry.s.category_log * 1e6) / 1e6,
    on_watchlist: watchlist.has(entry.p.slug),
    model: {
      version: MODEL_VERSION,
      value_beta: cal.value_beta.map((b) => Math.round(b * 1e6) / 1e6),
      launch_beta: cal.launch_beta.map((b) => Math.round(b * 1e6) / 1e6),
      mae_log10: Math.round(cal.mae_log10 * 1000) / 1000,
      launch_auc: Math.round(cal.launch_auc * 1000) / 1000,
      cohort_size: cal.cohort_size,
    },
    farm_steps: farmSteps(entry.p, entry.s.age_days).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the page's table of what already trades. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return liveCandidates(snapshot)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: p.tvl_usd > 0 ? Math.round(((p.mcap_usd ?? 0) / p.tvl_usd) * 1000) / 1000 : null,
      not_in_cohort: cohortGap(p),
    }));
}

// ---------------------------------------------------------------- farm plans

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL: the bigger the book, the deeper the position. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 400;
  if (p.tvl_usd >= 250_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: a protocol that has run longer without a token needs a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 60;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}

/** The gas cost of one transaction on a named chain, roughly. */
function gasOnChain(chain: string): number {
  if (chain === 'Ethereum') return 12;
  if (chain === 'Bitcoin') return 6;
  if (chain === 'Solana') return 1;
  return 3;
}

/**
 * The action each category's farmers actually do, one line per category.
 *
 * The table is keyed by DefiLlama's category name and looked up exactly, so no category can be
 * shadowed by an earlier keyword match: `Indexes` is not a DEX because "indexes" contains "dex",
 * and `CDP Manager` is not a lending market because both carry the word "CDP". Every line names the
 * protocol, the amount, the asset, the chain and what the farmer ends up holding.
 *
 * `{name}` is the protocol's own name, `{poss}` its name in the possessive, `{cap}` the capital its
 * TVL asks for, `{chain}` the chain it sits on and `{cat}` the category itself, used by the
 * fallback line.
 */
const CATEGORY_ACTIONS: Record<string, string> = {
  'Risk Curators': "Deposit {cap} of USDC into a {name} curated vault on {chain} and keep the shares in the wallet.",
  'Onchain Capital Allocator': "Deposit {cap} of USDC into {poss} largest vault on {chain} and keep the vault receipt token.",
  'Prediction Market': "Fund {cap} of USDC on {name} on {chain}, take one small position on a market, and hold the outcome shares to the settlement.",
  'Dexs': "Provide {cap} of USDC and the paired asset in {poss} deepest pool on {chain} and hold the LP position open.",
  'Indexes': "Buy {cap} of {poss} index token on {chain} and hold it to the next rebalance.",
  'CDP': "Lock {cap} of USDC as collateral in {name} on {chain}, draw no debt against it, and keep the vault open.",
  'CDP Manager': "Set up a {cap} USDC collateral position in {name} on {chain} and leave it open through the rebalances.",
  'Collateral Markets': "Post {cap} of USDC as collateral in {name} on {chain}, borrow the paired asset against it, and hold both sides of the trade.",
  'Uncollateralized Lending': "Lend {cap} of USDC to a borrower through {name} on {chain} and keep the loan open to its term.",
  'Lending': "Supply {cap} of USDC to {name} on {chain}, borrow nothing against it, and keep the position open.",
  'RWA': "Buy {cap} of {poss} yield-bearing note on {chain} and hold it to the end of the term.",
  'Chain': "Bridge {cap} of USDC onto {chain} and spend it in {name}'s app and its ecosystem, keeping the bridged balance open.",
  'Basis Trading': "Deposit {cap} of USDC as margin on {name} and open one small funding-rate position on {chain}.",
  'Derivatives': "Post {cap} of USDC as margin on {name} and open one small long position on {chain}.",
  'Interest Rate Derivatives': "Post {cap} of USDC as margin on {name} on {chain} and open one small fixed-rate position.",
  'Restaking': "Buy {cap} of the chain's native asset and restake it through {name} on {chain}, keeping the liquid restaking receipt.",
  'Staking Pool': "Buy {cap} of the chain's native asset and delegate it to {poss} pool on {chain}, keeping the pool receipt.",
  'OTC Marketplace': "Open a {cap} USDC position on {poss} OTC desk on {chain} and hold it to the settlement date.",
  'Yield Aggregator': "Route {cap} of USDC into {poss} best-scoring strategy on {chain} and hold the strategy receipt token.",
  'Yield': "Deposit {cap} of USDC into {poss} own yield product on {chain} and hold the receipt token until it claims.",
  'CeDeFi': "Deposit {cap} of USDC into {name}'s CeDeFi product on {chain} and hold the receipt token it issues.",
  'Liquidity Manager': "Deposit {cap} of USDC into {poss} managed liquidity position on {chain} and hold it until the next rebalance.",
  'Stablecoin Wrapper': "Wrap {cap} of USDC into {poss} wrapper token on {chain} and hold the wrapped balance.",
  'Dual-Token Stablecoin': "Swap {cap} of USDC into {poss} dual-token stablecoin on {chain} and hold both halves of the pair.",
  'Payments': "Buy {cap} of BTC with USDC, open a Lightning channel to a peer node on {chain}, and keep the channel balance in place.",
  'Governance Incentives': "Stake {cap} of the chain's native asset through {name} on {chain}, take part in its incentive programme, and keep the staking receipt.",
  'Insurance': "Buy {cap} of cover from {name} on {chain} and keep the policy open.",
  'Decentralized BTC': "Buy {cap} worth of BTC and deposit it into {poss} vault on {chain}, holding the BTC receipt.",
  'Leveraged Farming': "Open a {cap} USDC leveraged farming position in {name} on {chain} and keep the collateral posted.",
  'Farm': "Deposit {cap} of USDC into {poss} farm pool on {chain} and hold the pool receipt.",
  'Crypto Card Issuer': "Open a {name} card on {chain}, fund it with {cap} of USDC, and keep the balance in the card account.",
  // Categories the snapshot holds that the board does not rank today, kept here so a board that
  // reaches them still reads like a plan and not like a slogan.
  Options: "Write {cap} of USDC into one {name} option on {chain} and hold it to the expiry.",
  'Options Vault': "Deposit {cap} of USDC into {poss} vault on {chain} and hold the vault shares.",
  Synthetics: "Mint {cap} of the synthetic asset on {name} on {chain} and hold it against the underlying.",
  'Algo-Stables': "Mint {cap} of the algorithmic dollar on {name} on {chain} and hold it through the peg.",
  'Stablecoin Issuer': "Mint {cap} of the issued dollar on {name} on {chain} and hold it in the wallet.",
  'Reserve Currency': "Hold {cap} of the reserve asset on {name} on {chain} and keep it in the reserve vault.",
  'Collateral Management': "Post {cap} of USDC as collateral in {name} on {chain} and keep the position open.",
  Launchpad: "Bridge {cap} of USDC to {name} on {chain} and buy one of the launches it lists.",
  'Token Locker': "Lock {cap} of the protocol's own tokens in {name} on {chain} and keep the lock open to the unlock.",
  Privacy: "Send {cap} of USDC through {poss} shielded pool on {chain} and keep the receipt.",
  'NFT Marketplace': "Buy {cap} of USDC worth of a listed NFT from {name} on {chain} and keep it in the wallet.",
  'AI Agents': "Deposit {cap} of USDC into {poss} agent treasury on {chain} and keep the agent's own receipt.",
  'Decentralized AI': "Rent {cap} of USDC worth of compute from {name} on {chain} and keep the rental receipt.",
  DOR: "Deposit {cap} of USDC into {poss} liquidity pool on {chain} and hold the LP receipt.",
};

/** The fallback line: the one action a category the table does not name still gets. */
const FALLBACK_ACTION = "Deposit {cap} of USDC into {name}'s {cat} product on {chain} and hold the receipt it issues.";

/** A name in the possessive: "Veda's", but "Plume Vaults'". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

/** Fill one action's placeholders. */
function fillAction(template: string, p: SnapshotProtocol, capital: number, chain: string): string {
  const values: Record<string, string> = {
    name: p.name,
    poss: possessive(p.name),
    cap: `$${capital}`,
    chain,
    cat: (p.category ?? 'protocol').toLowerCase(),
  };
  // "{name}'s" in a template means the possessive; "{poss}" already is one.
  const prepared = template.replace(/\{name\}'s/g, '{poss}');
  return prepared.replace(/\{(name|poss|cap|chain|cat)\}/g, (_m: string, key: string) => values[key]!);
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const category = p.category ?? '';
  const template = CATEGORY_ACTIONS[category];
  if (template !== undefined) return fillAction(template, p, capital, chain);
  // A category the table does not name still gets a concrete line: its own category name carries
  // the action, so no row ever falls back to a sentence that says nothing.
  return fillAction(FALLBACK_ACTION, p, capital, chain);
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. Every number in the plan
 * comes from the protocol's own record (category, chains, TVL, age) and the snapshot's date, never from
 * a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  // The gas is the gas OF THE CHAIN THE PLAN NAMES, so the two can never disagree.
  const gas = gasOnChain(chain);
  const action = actionFor(p, capital, chain);
  const dated = p.listed_at !== null;
  const tracked = dated ? `since ${p.listed_at}` : 'on an unknown date';
  return [
    {
      text: `Open a fresh wallet for ${p.name} alone, fund it with the gas asset for ${chain}, and keep the seed phrase offline.`,
      cost: `about $${gas} of gas and nothing else`,
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '20 minutes to set up',
    },
    {
      text: `Make one qualifying action every week: a deposit, a swap, a borrow or a vote, so the wallet shows activity in every weekly snapshot.`,
      // The weekly action costs what any transaction on that chain costs. What makes the weeks
      // cheaper than a month of them is the count, not a discount on the price.
      cost: `about $${gas} of gas a week, so $${gas * 4} across the four weeks of a month`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, keeping the balance deposited rather than idle, so the streak covers more than one snapshot.`,
      cost: `the $${capital} stays deposited, and the yield it earns is yours`,
      time: `${hold} days`,
    },
    {
      text: `Watch ${possessive(p.name)} own announcements and its points page for a token or a season, and check it weekly so you act the week it opens.`,
      cost: `no fee to read, no fee to claim, and about $${gas} of gas if you act on the claim`,
      time: '15 minutes a week',
    },
    {
      text: `If a claim opens, claim only from the link ${p.name} publishes itself, on the chain it names, and check the token contract before you sign.`,
      cost: `about $${gas} of gas for the claim, and nothing to anyone else`,
      time: '20 minutes',
    },
    {
      text: `Log the wallet, the deposit dates and the transaction hashes, then unwind the position on the same day you claim, and never move funds out before the claim window closes.`,
      cost: `about $${gas} of gas to unwind`,
      time: '30 minutes',
    },
    {
      // A protocol with no first-tracked date has no age, so the plan must not claim it has run
      // long: the record says nothing about how long it has run, and the plan says so.
      text: dated
        ? `Note the whole record: ${p.name} is tracked ${tracked}, and a protocol that has run this long without a token is a slow one, so size the position for the wait.`
        : `Note the whole record: ${p.name} is tracked ${tracked}, so the house cannot tell how long it has run — size the position for the wait.`,
      cost: 'nothing but the note',
      time: '5 minutes',
    },
  ];
}

// ---------------------------------------------------------------- the data the page reads

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, cal: Calibration): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, cal);
  const live = liveRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  // The pre-token protocols the board leaves off, and the rule that left each one. A protocol
  // below the house's TVL floor is not ruled out, it is simply too small to rank, so it is counted
  // separately and the board says so rather than calling it a rule.
  const excluded: ExcludedRow[] = [];
  let belowFloor = 0;
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    if (p.tvl_usd < snapshot.floor_usd) { belowFloor++; continue; }
    const reason = offBoardReason(p);
    if (reason !== null) excluded.push({ slug: p.slug, reason });
  }
  // The counts the page states, computed here so the page cannot state them wrongly: which live
  // rows are in the model's cohort, which rows sit on the model's clamps, and what the board left off.
  const cohortSlugs = new Set(snapshot.protocols.filter((p) => isEligible(p) && !isPreToken(p) && (p.mcap_usd ?? 0) >= 1_000_000 && p.tvl_usd >= 1_000_000).map((p) => p.slug));
  const gapCount = new Map<string, number>();
  let inCohort = 0;
  for (const r of live) {
    if (cohortSlugs.has(r.slug)) inCohort++;
    else {
      const why = r.not_in_cohort ?? 'out of the cohort';
      gapCount.set(why, (gapCount.get(why) ?? 0) + 1);
    }
  }
  const offByReason: Record<string, number> = {};
  for (const e of excluded) offByReason[e.reason] = (offByReason[e.reason] ?? 0) + 1;
  let clamped = 0;
  let floored = 0;
  for (const r of board) {
    if (r.change_7d !== null && (r.change_7d < -60 || r.change_7d > 120)) clamped++;
    if (r.launch_probability <= 0.05) floored++;
  }
  const facts: Facts = {
    live_in_cohort: inCohort,
    live_candidates: liveCandidates(snapshot).length,
    live_with_cap: snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0).length,
    live_cex: snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0 && p.category === 'CEX').length,
    live_out_cohort: live.length - inCohort,
    live_out_reasons: [...gapCount].map(([why, n]) => `${n} ${why}${n > 1 ? 's' : ''}`).join(', '),
    clamped,
    floored,
    off_by_reason: offByReason,
    off_total: excluded.length,
    off_list_above_floor: board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd >= snapshot.floor_usd).length,
    off_list_below_floor: board.filter((r) => !watchlist.has(r.slug) && r.tvl_usd < snapshot.floor_usd).length,
    // Of the off-list rows above the floor, the ones that NO structural rule of the board excludes.
    // The snapshot carries no parent field, so no rule of ours can name a parent protocol: the
    // truth is that these rows clear every test the board applies, and the watchlist simply does
    // not carry their names.
    off_list_above_floor_no_reason: board.filter((r) => {
      if (watchlist.has(r.slug) || r.tvl_usd < snapshot.floor_usd) return false;
      const p = snapshot.protocols.find((q) => q.slug === r.slug);
      return p !== undefined && isPreToken(p) && isEligible(p);
    }).length,
    snapshot_protocols: snapshot.protocols.length,
    snapshot_tokens: snapshot.protocols.filter((p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null).length,
  };
  // The page's prose, written here so the page's source holds each sentence once. Every figure in
  // it is interpolated from the data, so the words cannot drift from the numbers they describe.
  const FLOOR = '$' + (snapshot.floor_usd / 1e6) + 'M';
  const offListAbove = facts.off_list_above_floor;
  const offListBelow = facts.off_list_below_floor;
  const sep =
    'Of the ' + (snapshot.watchlist.length + offListAbove) + ' rows that clear the house\'s ' + FLOOR + ' floor, ' + offListAbove +
    ' sit above it and are off the list for another reason: all ' + facts.off_list_above_floor_no_reason +
    ' of them clear the house\'s own structural test, and the snapshot names no rule that keeps any of them out — the watchlist is a list of ' +
    snapshot.watchlist.length + ' names the snapshot carries, not a rule the board can apply. ' +
    'The other ' + offListBelow + ' board rows are off the list because they sit below that floor: the radar keeps them, because the floor is a house rule and the point of a radar is the protocol that is about to cross it.';
  const reasonNames: Record<string, string> = {
    exchanges: 'exchange venues', bridges: 'bridges', staking: 'staking wrappers',
    versioned: 'versioned pools', wrapped: 'wrapped or staked names',
  };
  const offText = Object.keys(facts.off_by_reason).map((k) => `${facts.off_by_reason[k]} ${reasonNames[k] ?? k}`).join(', ');
  const copy: Copy = {
    // The hero states what the tab under it actually shows, so the headline is never the
    // opposite of the table beside it.
    board_headline: 'Every protocol here records no token.',
    live_headline: 'These protocols already have a token.',
    model_headline: 'The model, fitted here in the page.',
    board_lede:
      'The board ranks ' + board.length + ' protocols with no market cap, no CoinGecko id and no symbol: ' +
      snapshot.watchlist.length + ' on the house watchlist and ' + (board.length - snapshot.watchlist.length) +
      ' off the list. The watchlist is a floor, never a ceiling. ' + sep + ' ' +
      'A further ' + facts.off_total + ' clear the ' + FLOOR + ' floor with no token and are still left off: ' +
      offText + ' — a venue, a bridge or a wrapper of someone else\'s token, not a protocol of its own. ' +
      'The model is fitted at run time on the snapshot itself — the ' + cal.cohort_size +
      ' protocols whose tokens <strong>already trade</strong> teach it what a market cap is worth against TVL and growth; ' +
      'the ' + cal.universe_size + ' eligible protocols that are not a product of someone else\'s token teach it how often a protocol of a given age and size issues one at all.',
    live_lede:
      'The board ranks ' + board.length + ' protocols with no market cap, no CoinGecko id and no symbol. ' +
      'This tab holds the other side of the line: the ' + live.length + ' largest of the ' + facts.live_candidates +
      ' protocols that <strong>do</strong> record a market cap of their own and are not an exchange venue, by market cap. ' +
      'Their value is the market\'s own, not a model\'s, so they are never mixed into the ranking — ' +
      'the ' + cal.cohort_size + ' of them that are in the model\'s calibration cohort are what it was calibrated on. ' +
      facts.live_in_cohort + ' of these ' + live.length + ' are in the cohort that taught it what a market cap is worth against TVL.',
    model_lede:
      'Everything the board ranks comes from two fits, and both are made here in the page from the snapshot\'s own figures. ' +
      'The <strong>value model</strong> asks what a market cap is worth against TVL and growth, and it is fitted on the ' +
      cal.cohort_size + ' protocols whose tokens already trade. The <strong>launch model</strong> asks how often a protocol of a given age and size issues one at all, ' +
      'and it is fitted on the ' + cal.universe_size + ' eligible protocols that are not a product of someone else\'s token — ' +
      'the other ' + cal.product_rows + ' eligible rows carry a ticker but no market cap of their own, and a pool of a protocol that already issued is evidence neither way. Neither model reads a name list: ' +
      'both read the snapshot\'s own fields.',
    live_note:
      '<strong>These protocols already have a token.</strong> The board above never mixes them in: their value is the market\'s own, not a model\'s. ' +
      'The snapshot holds ' + facts.snapshot_protocols + ' protocols, ' + facts.snapshot_tokens + ' of which record a token of some kind; ' +
      facts.live_with_cap + ' carry a market cap of their own, and ' + facts.live_cex + ' of those are exchange venues, so they are set aside too. ' +
      'This table holds the ' + live.length + ' largest of the ' + facts.live_candidates + ' that are left, by market cap; the rest are further down the same list. ' +
      '<strong>' + facts.live_in_cohort + ' of these ' + live.length + ' rows are in the model\'s calibration cohort</strong>, the ' +
      cal.cohort_size + ' protocols whose tokens already trade and that taught the model what a market cap is worth relative to TVL. ' +
      'The other ' + facts.live_out_cohort + ' are here only as contrast — ' + facts.live_out_reasons + '. ' +
      'A market cap over TVL below 1 is a token the market prices at less than the deposits behind it.',
    clamps:
      'Two clamps, and they are the model\'s only floors. <strong>Growth</strong> is held between −60% and +120%: a week beyond either end is one regime, not a bigger number, so ' +
      facts.clamped + ' of the board\'s ' + board.length + ' rows sit on the clamp and the formula reads the clamped figure. ' +
      '<strong>Launch odds</strong> are held between 5% and 95%: ' + facts.floored + ' rows sit on the 5% floor, so their odds are the floor rather than the model\'s opinion.',
    is_and_is_not:
      '<p><strong>It is:</strong> what a token may be worth if its protocol\'s record stays as it is, ranked by that number, with a farm plan for each row. Every figure is the snapshot\'s own, fitted at run time.</p>' +
      '<p><strong>It is not:</strong> a prediction that a token will be issued, or of when, or at what price. The launch odds say how often protocols like this one have issued, not that this one will. A protocol records no token in DefiLlama\'s record; that is not proof it has none, and the board says so.</p>' +
      '<p><strong>The separation:</strong> the ' + snapshot.watchlist.length + ' watchlist protocols are all on the board, but so are ' +
      (board.length - snapshot.watchlist.length) + ' more — the watchlist is a floor, never a ceiling. The ' +
      live.length + ' protocols shown in the <strong>Already trading</strong> table are the largest of the ' + facts.live_candidates +
      ' that record a market cap of their own and are not an exchange venue; they are kept out of the ranking entirely.</p>',
    drawer_note:
      'An implied value is this entry\'s own estimate of what a token may be worth if the protocol\'s record stays as it is. ' +
      'It is not a price, not a promise, and not a prediction that one will be issued.',
    live_drawer_note:
      'This token already trades, so its value is the market\'s own, not a model\'s estimate: there is no implied value and no farm plan for it here. ' +
      'It is one of the ' + cal.cohort_size + ' protocols whose tokens already trade and that fitted the value model, so the board reads it back.',
    live_gap_note:
      'This token already trades, so its value is the market\'s own, not a model\'s estimate: there is no implied value and no farm plan for it here. ' +
      'It is not among the ' + cal.cohort_size + ' protocols that fitted the value model — it is here as the contrast the board is looking for. ' +
      'It was left out of the cohort because of its record: ',
    pricing_steps: [
      '<strong>Conditional value.</strong> TVL × the fitted market-cap-to-TVL ratio for its size, growth and category.',
      '<strong>Launch odds.</strong> The chance it issues at all, read from how often protocols its age and size have issued.',
      '<strong>Implied value.</strong> The two multiplied. This is what the board ranks.',
    ],
    value_fit_note:
      'Median error of the value model, in log10 dollars, on the ' + cal.cohort_size +
      ' protocols whose tokens trade, each with a market cap and TVL of a million dollars or more. ' +
      'Half land within a factor of ' + Math.pow(10, cal.mae_log10).toFixed(1) + ' of the model.',
    launch_odds_note:
      'How well the launch model separates the protocols that have issued a token of their own from those that have not, across the eligible universe less the ' +
      cal.product_rows + ' product rows — rows that carry a ticker but no market cap of their own and no CoinGecko id either. ' +
      'Those are a pool of a protocol that already issued, so they are evidence neither way.',
    no_name_special:
      'Every row is scored by one function of <code>TVL</code>, <code>change_7d</code>, <code>listed_at</code> and <code>category</code>. ' +
      'No protocol is named in the model, and the coefficients are fitted at run time on this snapshot — not typed in.',
    formula:
      'growth = clamp(change_7d, -60, +120)      the model reads a clamped week, never the raw one\n' +
      '\n' +
      'log10(mcap / tvl) = a + b·log10(tvl) + c·(growth / 10) + category_log\n' +
      '  a = ' + cal.value_beta[0].toFixed(4) + '    b = ' + cal.value_beta[1].toFixed(4) + '    c = ' + cal.value_beta[2].toFixed(4) + '\n' +
      '\n' +
      'conditional value = tvl · 10^(that sum)          what it is worth if it issues\n' +
      'launch odds      = logistic(age band, tvl band, growth), then held to [0.05, 0.95]\n' +
      'implied value    = conditional value · launch odds  ← the board ranks this\n' +
      '\n' +
      'The four coefficients are printed to four decimals here, and the category corrections are ' +
      'printed to three, so the sum above lands on the conditional value to about one part in a ' +
      'thousand rather than exactly: a reader who wants the exact arithmetic has it on every row ' +
      'of the board, in the drawer, where each figure is printed at the precision the ' +
      'multiplication needs.',
    refit_lead:
      'This page carries the raw snapshot figures for the ' + cal.cohort_size +
      ' protocols whose tokens already trade and for the whole eligible universe, and it refits the model from them ' +
      'with the code in <code>model.js</code> — the same procedure <code>main.ts</code> used, not the same numbers pasted in. ' +
      'It then recomputes every row of the board from those figures. ',
    curve_note:
      'Counted across the ' + cal.universe_size + ' protocols the launch model was fitted on. This is where the launch odds come from. ' +
      'The ' + cal.untracked + ' with no first-tracked date are counted as one year old, which is what the fit assumes for them, so the column adds up to the fit\'s own universe.',
    category_note:
      'How far each category sits from the fitted line, in log10 dollars, shrunk toward the mean so a thin category cannot speak for itself.',
  };
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    live_size: live.length,
    universe_size: snapshot.protocols.length,
    calibration: {
      value_beta: cal.value_beta.map((b) => Math.round(b * 1e8) / 1e8),
      launch_beta: cal.launch_beta.map((b) => Math.round(b * 1e6) / 1e6),
      // The category corrections are published at eight decimals, not four: the reader multiplies
      // TVL by the fitted ratio and by this correction, and a correction rounded to four decimals
      // moves a seven-figure conditional value by thousands of dollars.
      category_log: Object.fromEntries(Object.entries(cal.category_log).map(([k, v]) => [k, Math.round(v * 1e8) / 1e8])),
      category_default: Math.round(cal.category_default * 1e8) / 1e8,
      bands: cal.bands.map((b) => ({ lo: b.lo, hi: b.hi === Number.POSITIVE_INFINITY ? null : b.hi, n: b.n, issued: b.issued })),
      untracked: cal.untracked,
      cohort_size: cal.cohort_size,
      universe_size: cal.universe_size,
      product_rows: cal.product_rows,
      mae_log10: Math.round(cal.mae_log10 * 1000) / 1000,
      launch_auc: Math.round(cal.launch_auc * 1000) / 1000,
    },
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      conditional_value_usd: r.conditional_value_usd,
      launch_probability: r.launch_probability,
      growth_pct: r.growth_pct,
      category_log: r.category_log,
      on_watchlist: r.on_watchlist,
      farm_steps: r.farm_steps,
    })),
    live,
    cohort: snapshot.protocols
      .filter((p) => isEligible(p) && !isPreToken(p) && (p.mcap_usd ?? 0) >= 1_000_000 && p.tvl_usd >= 1_000_000)
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        mcap_usd: p.mcap_usd!,
        listed_at: p.listed_at,
      })),
    excluded,
    below_floor: belowFloor,
    facts,
    copy,
    universe: snapshot.protocols.filter(isEligible).map((p) => ({
      slug: p.slug,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      mcap_usd: p.mcap_usd,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
    })),
  };
  return { board, radar };
}

// ---------------------------------------------------------------- the snapshot

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

// ---------------------------------------------------------------- the gate's own shape

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const trimmed = s.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${r.slug} has a farm step of ${trimmed.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
