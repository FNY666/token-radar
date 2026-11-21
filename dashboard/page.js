
(function () {
 'use strict';

 var D = window.RADAR;
 if (!D) { renderMissingData(); return; }

 var L = D.copy.labels;

 function visibleRows() {
  var q = state.q.trim().toLowerCase();
  return D.rows.filter(function (r) {
   if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
   if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) === -1) return false;
   if (state.scope === 'watchlist' && !r.on_watchlist) return false;
   if (state.scope === 'early' && r.on_watchlist) return false;
   if (!q) return true;
   return (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase().indexOf(q) !== -1;
  });
 }

 function sortedRows(list, key, dir, tie) {
  return list.slice().sort(function (a, b) {
   var ka = key(a);
   var kb = key(b);
   if (ka !== ka) return kb !== kb ? tie(a, b) : 1;
   if (kb !== kb) return -1;
   if (ka < kb) return -dir;
   if (ka > kb) return dir;
   return tie(a, b);
  });
 }

 var SORTS = {
  rank: function (r) { return r.rank; },
  name: function (r) { return r.name.toLowerCase(); },
  tvl: function (r) { return r.tvl_usd; },
  growth: function (r) { return typeof r.change_7d !== 'number' ? NaN : r.change_7d; },
  value: function (r) { return r.implied_value_usd; },
  conditional: function (r) { return r.conditional_value_usd; },
  odds: function (r) { return launchP(r); }
 };

 function byRank(a, b) { return a.rank - b.rank; }
function byName(a, b) { return a.name < b.name ? -1 : 1; }

 function colExtreme(list, key, pick) {
  return Math[pick].apply(null, list.map(function (r) { return r[key]; }));
 }

 function renderTable() {
  var wrap = into('table-wrap');
  var list = sortedRows(visibleRows(), SORTS[state.key] || SORTS.rank, state.dir, byRank);
  renderControlsResult();
  if (list.length === 0) {
   wrap.appendChild(e('div', 'empty', L.empty_board));
   return;
  }
  var top = colExtreme(list, 'implied_value_usd', 'max');
  headCtx.sort = state;
  headCtx.redraw = refresh;
  var head = el('thead', null, [
   el('tr', null, [
    // The rank column shows "#", but a screen reader reads the header's text, so the button
    // carries the name and the glyph is only its visible half.
    sortHeader('rank', '#', false, 1, L.rank),
    sortHeader('name', 'Protocol', false, -1),
    el('th', { scope: 'col', text: 'Scope' }),
    el('th', { scope: 'col', text: 'Category' }),
    sortHeader('tvl', 'TVL', true, -1),
    sortHeader('growth', '7d', true, -1),
    sortHeader('odds', L.odds, true, -1),
    sortHeader('conditional', L.conditional, true, -1),
    sortHeader('value', L.implied, true, -1)
   ])
  ]);
  var body = el('tbody');
  list.forEach(function (r) {
   var share = top > 0 ? Math.max(0.015, r.implied_value_usd / top) : 0;
   var tr = el('tr', rowAttrs(r), [
    e('td', 'rk num', String(r.rank)),
    e('td', 'pname', r.name),
    el('td', null, [
     e('span', 'tag ' + (r.on_watchlist ? 'wl' : 'early'), r.on_watchlist ? L.on_watchlist : L.off_watchlist)
    ]),
    e('td', 'cat', r.category || 'Uncategorised'),
    e('td', 'right num', money(r.tvl_usd)),
    chg(r),
    h('td','right', [e('span', 'pill', oddsText(launchP(r)))]),
    e('td', 'right cond', money(r.conditional_value_usd, 5)),
    h('td','right', [
     e('div', 'val', money(r.implied_value_usd)),
     h('div','bar-cell', [
      h('div','bar-track', [el('div', { class: 'bar-fill', style: 'width:' + (share * 100).toFixed(1) + '%' })])
     ])
    ])
   ]);
   body.appendChild(tr);
  });
  wrap.appendChild(el('table', null, [head, body]));
 }
 function sortHeader(key, label, right, firstDir, name) {
  var sort = headCtx.sort;
  var redraw = headCtx.redraw;
  var active = sort.key === key;
  function on() {
   if (sort.key === key) sort.dir = -sort.dir;
   else { sort.key = key; sort.dir = firstDir === undefined ? -1 : firstDir; }
   if (sort === liveSort) { state.liveKey = sort.key; state.liveDir = sort.dir; }
   else { state.key = sort.key; state.dir = sort.dir; }
   var was = focusedColumn();
   writeHash('refine');
   redraw();
   restoreColumnFocus(was);
  }
  return el('th', {
   class: right ? 'right' : null, scope: 'col',
   'aria-sort': active ? (sort.dir === 1 ? 'ascending' : 'descending') : null
  }, [el('button', { type: 'button', onclick: on, 'data-col': key, 'aria-label': name || null }, [
   document.createTextNode(label),
   // `aria-sort` on the header says the direction, so the arrow is hidden from the tree.
   active ? el('span', { class: 'arrow', 'aria-hidden': 'true', text: sort.dir === 1 ? '▲' : '▼' }) : null
  ])]);
 }
 function focusedColumn() {
  var el = document.activeElement;
  return el && el.getAttribute && el.getAttribute('data-col');
 }
 function restoreColumnFocus(key) {
  if (!key) return;
  var next = document.querySelector('thead th button[data-col="' + key + '"]');
  if (next) next.focus();
 }

 var MODEL = window.RadarModel ? window.RadarModel.fit(D) : null;

 // The page refits the model and recomputes every row from its own figures. The three displayed
 // figures are each shown to a fixed precision and the implied value is computed from the other
 // two at that precision, so the check is made the same way: does the row's arithmetic hold to
 // the last digit the reader can see?
 function sigRound(n, sig) {
  if (!isFinite(n) || n === 0) return n;
  var a = Math.abs(n);
  var scale = a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
  var mant = n / scale;
  var factor = Math.pow(10, sig - 1 - Math.floor(Math.log10(Math.abs(mant))));
  return Math.round(mant * factor) / factor * scale;
 }
 var FIT = (function () {
  if (!MODEL) return null;
  var exact = 0;
  var worst = 0;
  D.rows.forEach(function (r) {
   var cond = MODEL.conditional(r.tvl_usd, r.change_7d, r.category);
   var odds = MODEL.launchP(r.tvl_usd, r.change_7d, r.age_days);
   // the row's own triple, at the precision the board shows it
   var ev = Math.max(1, Math.round(sigRound(sigRound(cond, 5) * Math.round(odds * 1e6) / 1e6, 3)));
   if (ev === r.implied_value_usd) exact++;
   var gap = r.implied_value_usd > 0 ? Math.abs(ev - r.implied_value_usd) / r.implied_value_usd : 0;
   if (gap > worst) worst = gap;
  });
  return { exact: exact, worst: worst, total: D.rows.length };
 })();

 function recompute(row) {
  var cond = MODEL
   ? MODEL.conditional(row.tvl_usd, row.change_7d, row.category)
   : row.conditional_value_usd;
  var log10 = row.tvl_usd > 0 ? Math.log10(cond / row.tvl_usd) - row.category_log : 0;
  var odds = launchP(row);
  // the implied value, computed the way the board computes it: from the conditional value and
  // the odds at the precision they are shown, so the ledger lands on the board's figure
  var shown = sigRound(sigRound(cond, 5) * Math.round(odds * 1e6) / 1e6, 3);
  return {
   conditional: cond,
   expected: Math.max(1, Math.round(shown)),
   log10: log10,
   mult: Math.pow(10, log10),
   launch: odds
  };
 }

 function launchP(row) {
  if (!MODEL) return row.launch_probability;
  return MODEL.launchP(row.tvl_usd, row.change_7d, row.age_days);
 }

 function oddsText(p) { return (p * 100).toFixed(4) + '%'; }

 function farmSteps(row) {
  return (row.farm_steps || []).map(function (text) {
   var m = /Cost:\s*(.*?)\.\s*Time:\s*(.*?)\.?\s*$/.exec(text);
   if (!m) return { text: text, cost: '', time: '' };
   return { text: text.slice(0, m.index).trim(), cost: m[1], time: m[2] };
  });
 }

 function openDetail(slug, push, trigger) {
  var opener = trigger || document.activeElement;
  if (opener && opener !== document.body && opener.focus && !opener.closest('.sheet')) lastFocus = opener;
  var row = rowBySlug(slug);
  if (!row) {
   var live = liveBySlug(slug);
   if (live) openLive(live, push);
   return;
  }
  state.selected = slug;
  var mode = push === 'same' ? 'replace' : (push === false ? 'replace' : 'push');
  writeHash(mode);
  if (push !== 'same') drawerPushed = push !== false;
  var calc = recompute(row);
  var odds = launchP(row);
  var host = into('drawer');
  host.hidden = false;

  var kpis = h('div','kpis', [
   kpi(L.implied, moneyExact(row.implied_value_usd), 'gold'),
   kpi('If it issues', moneyExact(row.conditional_value_usd)),
   kpi(L.odds, oddsText(calc.launch), 'cyan'),
   kpi('TVL', moneyExact(row.tvl_usd))
  ]);
  var deriv = h('div','deriv', [
   line('TVL', moneyExact(row.tvl_usd)),
   line(L.fitted_multiplier, calc.mult.toPrecision(9)),
   line(L.category_correction, '×' + Math.pow(10, row.category_log).toPrecision(9)),
   // How many cohort members the correction rests on.
   line(L.category_evidence, categoryEvidence(row)),
   line(L.value_if_issues, moneyExact(calc.conditional)),
   line(L.odds_recomputed, oddsText(odds)),
   line(L.implied, moneyExact(calc.expected), true)
  ]);

  // The correction's evidence: how many cohort members it rests on.
  function categoryEvidence(r) {
   var n = (D.calibration.category_sizes || {})[r.category];
   if (n === undefined) return 'the cohort never saw this category';
   if (n === 1) return 'fitted on 1 cohort member';
   return 'fitted on ' + n + ' cohort members';
  }

  var steps = h('ol','steps');
  farmSteps(row).forEach(function (s) {
   steps.appendChild(el('li', null, [
    e('div', 'act', s.text),
    h('div','meta', [
     e('span', 'cost', 'Cost: ' + s.cost),
     t('span', '  ·  Time: ' + s.time)
    ])
   ]));
  });

  var record = h('div','deriv', [
   line(L.seven_day, pct(row.change_7d)),
   line(L.first_tracked, row.age_days === null ? L.not_recorded : age(row.age_days) + L.ago),
   line('Category', row.category || 'Uncategorised'),
   line('Chains', String((row.chains || []).length)),
   line(L.token_recorded, L.token_none)
  ]);

  var peers = D.rows.filter(function (r) {
   return r.slug !== row.slug && (r.category || 'Other') === (row.category || 'Other');
  }).sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).slice(0, 5);
  var peerBox = null;
  if (peers.length) {
   peerBox = h('div','peers');
   peers.forEach(function (p) {
    peerBox.appendChild(el('button', {
     class: 'peer', type: 'button',
     onclick: function (e) { openDetail(p.slug, 'same', e.currentTarget); }
    }, [
     e('span', 'pn', p.name),
     e('span', 'pv num', money(p.implied_value_usd)),
     e('span', 'pt num muted', money(p.tvl_usd) + ' TVL')
    ]));
   });
  }

  function sect(title, block) { return [h('h3', null, [title]), block]; }
  var sheet = sheetFor(row, row.slug + ' · rank ' + row.rank + ' of ' + D.board_size,
   (row.on_watchlist ? L.on_watchlist : L.off_watchlist) + ' — ' + (row.tvl_usd >= D.floor_usd ? 'above' : 'below') + ' the $' + (D.floor_usd / 1e6) + 'M floor',
   row.on_watchlist ? 'wl' : 'early', [kpis]
    .concat(sect(L.how_priced, deriv))
    .concat(sect(L.snapshot_record, record))
    .concat(sect(L.how_to_farm, steps))
    .concat(peerBox ? sect(L.others_here, peerBox) : [])
    .concat([e('div', 'warn', D.copy.drawer_note)]));

  mountSheet(host, sheet, row);
 }

 function sheetFor(row, sub, tagText, tagCls, body) {
 var head = h('div','sheet-head', [
 el('div', null, [
 el('h2', { id: 'sheet-title', text: row.name }),
 e('div', 'slug', sub)
 ]),
 el('button', { class: 'close', type: 'button', 'aria-label': L.close, text: '×', onclick: closeDetail })
 ]);
 var chips = h('div','chips', [
 e('span', 'tag ' + tagCls, tagText),
 e('span', 'chip-static', row.category || 'Uncategorised')
 ]);
 var kids = [head, chips];
 if ((row.chains || []).length) {
 kids.push(h('div','chips', (row.chains || []).slice(0, 8).map(function (c) {
 return e('span', 'chip-static', c);
 })));
 }
 var sheet = el('div', {
 class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', tabindex: '-1'
 }, kids.concat(body));
 return sheet;
 }
 function renderModel() {
 var host = into('view-model');
 var c = D.calibration;
 function modelCard(title, big, note) {
 return h('div','card', [t('h3', title), big ? e('div', 'big', big) : null, el('p', { html: note })]);
 }
 var cards = h('div','model-grid', [
 modelCard(L.value_fit, c.mae_log10.toFixed(3), D.copy.value_fit_note),
 modelCard(L.launch_odds, c.launch_auc.toFixed(3), D.copy.launch_odds_note),
 modelCard(L.no_name_special, null, D.copy.no_name_special)
 ]);
 host.appendChild(cards);
 host.appendChild(card(L.formula, [
 e('div', 'formula', D.copy.formula),
 el('p', { html: D.copy.clamps })
 ]));
 if (FIT) {
 var ok = FIT.exact === FIT.total;
 host.appendChild(card(L.refitted, [
 el('div', { class: 'big', style: ok ? '' : 'color:var(--live)' },
 FIT.exact + ' / ' + FIT.total),
 el('p', { html: D.copy.refit_lead +
 (ok
 ? '<strong>All ' + FIT.total + ' rows reproduce exactly</strong>, so the board and the page are the same model.'
 : '<strong>' + (FIT.total - FIT.exact) + ' rows differ</strong>, the largest by ' + (FIT.worst * 100).toFixed(1) + '%, which means the data on this page is stale.') })
 ]));
 }
 var curve = card(L.curve_title, [t('p', D.copy.curve_note)]);
 var curveBox = h('div','curve');
 c.bands.forEach(function (b) {
 var rate = b.n ? b.issued / b.n : 0;
 curveBox.appendChild(h('div','curve-row', [
 e('span', 'lbl', (b.lo / 365.25).toFixed(1) + 'y – ' + (b.hi === null ? '∞' : (b.hi / 365.25).toFixed(1) + 'y')),
 h('span','track', [el('span', { class: 'fill', style: 'width:' + (rate * 100).toFixed(1) + '%' })]),
 e('span', 'v', Math.round(rate * 100) + '%')
 ]));
 });
 curve.appendChild(curveBox);
 var bandsTable = h('table','bands', [
 el('thead', null, [el('tr', null, [
 t('th','Cohort'), t('th','Protocols'),
 t('th',L.curve_issued), t('th','Rate')
 ])]),
 el('tbody', null, c.bands.map(function (b) {
 var cells = [b.lo + '–' + (b.hi === null ? '∞' : b.hi) + ' days', String(b.n), String(b.issued),
 b.n ? (b.issued / b.n * 100).toFixed(1) + '%' : '—'];
 return el('tr', null, cells.map(function (c) { return t('td', c); }));
 }))
 ]);
 curve.appendChild(bandsTable);
 host.appendChild(curve);
 var catCard = card(L.category_corrections, [t('p', D.copy.category_note)]);
 var catRows = Object.keys(c.category_log).map(function (k) {
 return { k: k, v: c.category_log[k], n: (c.category_sizes || {})[k] };
 }).sort(function (a, b) { return b.v - a.v; });
 // The three columns are named in a header row, not only in the prose above it.
 var catTable = h('table','cat-table', [
 el('thead', null, [el('tr', null, [
 t('th','Category'), t('th',L.category_correction), t('th',L.category_evidence)
 ])]),
 el('tbody')
 ]);
 function catRow(k, v, n) {
 catTable.lastChild.appendChild(el('tr', null, [
 t('td', k),
 t('td', (v >= 0 ? '+' : '') + v.toFixed(5) + '  (×' + Math.pow(10, v).toFixed(3) + ')'),
 // How many cohort members the correction rests on: one row and ten are different numbers.
 e('td', 'num', n === undefined ? '—' : String(n))
 ]));
 }
 catRows.forEach(function (r) { catRow(r.k, r.v, r.n); });
 var seen = {};
 D.rows.forEach(function (r) { seen[r.category || 'Uncategorised'] = true; });
 var missing = Object.keys(seen).filter(function (k) { return !(k in c.category_log); });
 if (missing.length) catRow(missing.length + ' more categories the cohort never saw', c.category_default, 0);
 catCard.appendChild(catTable);
 host.appendChild(catCard);
 host.appendChild(card(L.is_and_is_not, [
 el('div', { class: 'prose', html: D.copy.is_and_is_not })
 ]));
 }
 function openLive(row, push) {
 state.selected = row.slug;
 writeHash(push === false ? 'replace' : 'push');
 drawerPushed = push !== false;
 var host = into('drawer');
 host.hidden = false;
 var inCohort = COHORT[row.slug] === true;
 var gap = row.not_in_cohort || null;
 var kpis = h('div','kpis', [
 kpi(L.market_cap, moneyExact(row.mcap_usd), 'gold'),
 kpi('TVL', moneyExact(row.tvl_usd)),
 kpi(L.cap_over_tvl, row.ratio === null ? '—' : row.ratio.toFixed(2), 'cyan'),
 kpi('7d change', pct(row.change_7d))
 ]);
 var record = h('div','deriv', [
 line(L.market_cap, moneyExact(row.mcap_usd)),
 line('TVL', moneyExact(row.tvl_usd)),
 line(L.cap_over_tvl, row.ratio === null ? L.not_recorded : row.ratio.toFixed(4)),
 line(L.seven_day, pct(row.change_7d)),
 line('Category', row.category || 'Uncategorised'),
 line('Chains', String((row.chains || []).length)),
 line(L.in_cohort, inCohort ? 'yes' : 'no', true)
 ]);
 if (gap) {
 record.appendChild(line(L.not_in_cohort, gap));
 }
 var sheet = sheetFor(row, row.slug + ' · already trading', L.already_trades, 'live', [
 kpis,
 h('h3', null, [L.market_figures]),
 record,
 e('div', 'warn', inCohort ? D.copy.live_drawer_note : D.copy.live_gap_note + gap + '.')
 ]);
 mountSheet(host, sheet, row);
 }
// The visible rows as a scatter: value against odds, dot size is TVL.
 function renderPlot() {
 var host = into('plot-wrap');
 var list = visibleRows();
 if (list.length === 0) {
 host.appendChild(e('div', 'plot-empty', L.empty_filters));
 return;
 }
// The SVG is in CSS pixels, so the viewBox is the box's own size.
 var cs = getComputedStyle(document.querySelector('.plot-wrap'));
 var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
 var W = Math.max(320, Math.round((host.getBoundingClientRect().width || 1000) - padX));
 var H = 150, padL = 54, padR = 16, padT = 22, padB = 30;
 var maxV = colExtreme(list, 'implied_value_usd', 'max');
 // The scale's top is the next power of ten, so the grid lines are even and the labels cannot
 // overlap.
 var scaleTop = 1; while (scaleTop < maxV) scaleTop *= 10;
 var logMin = Math.log10(Math.max(colExtreme(list, 'tvl_usd', 'min'), 1));
 var logMax = Math.log10(Math.max(colExtreme(list, 'tvl_usd', 'max'), 1));
 function xOf(p) { return padL + (p - 0.05) / 0.9 * (W - padL - padR); }
 function yOf(v) { return padT + (1 - Math.log10(Math.max(v, 1)) / Math.log10(scaleTop)) * (H - padT - padB); }
  function rOf(tvl) {
 if (logMax <= logMin) return 5;
 return 3.5 + (Math.log10(Math.max(tvl, 1)) - logMin) / (logMax - logMin) * 8.5;
 }
 var ns = 'http://www.w3.org/2000/svg';
 var svg = document.createElementNS(ns, 'svg');
 svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
// The viewBox scales UNIFORMLY: a dot is a circle, a label is not.
 svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
// Each dot is a control, so the SVG is a GROUP: an image holding buttons is a contradiction
// no screen reader can resolve.
 svg.setAttribute('role', 'group');
 function add(tag, attrs, text) {
 var n = document.createElementNS(ns, tag);
 Object.keys(attrs).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
 if (text !== undefined) n.textContent = text;
 svg.appendChild(n);
 return n;
 }
 for (var v = 1; v <= scaleTop; v *= 10) {
 var y = yOf(v);
 add('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'grid' });
 add('text', { x: padL - 8, y: y + 3.5, class: 'tick', 'text-anchor': 'end' }, money(v));
 }
 [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (p) {
 add('line', { x1: xOf(p), y1: padT, x2: xOf(p), y2: H - padB, class: 'grid' });
 add('text', { x: xOf(p), y: H - padB + 13, class: 'tick', 'text-anchor': 'middle' }, Math.round(p * 100) + '%');
 });
 add('line', { x1: padL, y1: padT, x2: padL, y2: H - padB, class: 'axis' });
 add('line', { x1: padL, y1: H - padB, x2: W - padR, y2: H - padB, class: 'axis' });
 add('text', { x: padL - 8, y: H - 4, class: 'axis-title' }, L.odds_axis);
 add('text', { x: 8, y: 11, class: 'axis-title' }, L.implied);
 var dots = [];
 list.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).forEach(function (r) {
 // One description for both the tooltip a sighted reader sees and the name a screen reader
 // reads: `aria-label` overrides the title, so writing them separately is how they drift.
 var dl = r.name + ': ' + money(r.implied_value_usd) + ' implied, ' +
 oddsText(launchP(r)) + ' odds, ' + money(r.tvl_usd) + ' TVL, ' +
 (r.on_watchlist ? 'on' : 'off') + ' the house watchlist';
 var c = add('circle', {
 cx: xOf(launchP(r)), cy: yOf(r.implied_value_usd), r: rOf(r.tvl_usd),
 class: 'dot' + (r.on_watchlist ? ' wl' : ''), 'data-slug': r.slug,
 tabindex: '-1', role: 'button',
 'aria-label': dl
 });
 c.addEventListener('click', function () { openDetail(r.slug, undefined, c); });
 c.addEventListener('keydown', function (e) {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, c); }
 });
 var t = document.createElementNS(ns, 'title');
 t.textContent = dl;
 c.appendChild(t);
 dots.push(c);
 });
 var top = list.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; })[0];
 if (top) {
 var ty = yOf(top.implied_value_usd);
 var tx = xOf(launchP(top));
 var anchor = tx > W * 0.6 ? 'end' : 'start';
 var dx = anchor === 'end' ? -9 : 9;
 add('text', { x: tx + dx, y: ty + 3.5, class: 'q', 'text-anchor': anchor }, top.name);
 }
 host.appendChild(h('div','plot-head', [
 h('h3', null, [L.plot_title]),
 e('span', 'hint', L.plot_hint)
 ]));
 var plotBox = el('div', { class: 'plot', tabindex: '0', role: 'group',
 'aria-label': 'The board plotted: implied value against launch odds. Use the arrow keys to walk the ' + dots.length + ' rows.' });
 var dotAt = -1;
 plotBox.addEventListener('keydown', function (e) {
 var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
 if (!step) return;
 e.preventDefault();
 dotAt = (dotAt + step + dots.length) % dots.length;
 var d = dots[dotAt];
 d.focus();
 });
 plotBox.appendChild(svg);
 host.appendChild(plotBox);
 host.appendChild(h('div','plot-legend', [
 el('span', null, [el('i', { style: 'background:var(--value)' }), L.on_watchlist]),
 el('span', null, [el('i', { style: 'background:var(--odds)' }), L.off_watchlist])
 ]));
 }
 function renderLive() {
 var host = into('view-live');
 host.appendChild(el('p', { class: 'live-note', html: D.copy.live_note }));
 var rows = sortedRows(D.live, LIVE_SORTS[state.liveKey] || LIVE_SORTS.mcap, state.liveDir, byName);
 liveSort.key = state.liveKey;
 liveSort.dir = state.liveDir;
 headCtx.sort = liveSort;
 headCtx.redraw = renderLive;
 var head = el('thead', null, [
 el('tr', null, [
 sortHeader('name', 'Protocol', false, 1),
 sortHeader('category', 'Category', false, 1),
 sortHeader('mcap', L.market_cap, true, -1),
 sortHeader('tvl', 'TVL', true, -1),
 sortHeader('ratio', L.cap_over_tvl, true, -1),
 sortHeader('growth', '7d', true, -1)
 ])
 ]);
 var body = el('tbody');
 rows.forEach(function (r) {
 body.appendChild(el('tr', rowAttrs(r), [
 el('td', null, [
 h('div','pname', [
 document.createTextNode(r.name),
 // The slug is a second line on screen and a second word to a reader: without the space the
 // cell reads "Rainrain".
 e('span', 'slug', ' ' + r.slug)
 ])
 ]),
 e('td', 'cat', r.category || 'Uncategorised'),
 // The market cap and the TVL print at SIX significant figures, not the board's three: a
 // two-decimal multiple is not determined by a three-figure figure (a reader's division missed
 // the printed multiple on 13 of the 30 rows at three figures, 2 at five, none at six).
 e('td', 'right num', money(r.mcap_usd, 6)),
 e('td', 'right num', money(r.tvl_usd, 6)),
 h('td','right num', [e('span', 'pill live', r.ratio === null ? '—' : r.ratio.toFixed(2))]),
 chg(r)
 ]));
 });
 host.appendChild(h('div','table-wrap', [el('table', null, [head, body])]));
 }
 var CTL = {};
 function buildControls() {
 var host = into('controls');
 CTL.search = el('input', {
 class: 'q', type: 'search', placeholder: L.search_placeholder,
 'aria-label': L.search_label,
 // The name is what a form posts and what a password manager keys on; a search box with no
 // name is a box no browser can restore and no AT can name.
 name: 'q', autocomplete: 'off', spellcheck: false,
 oninput: function () { state.q = CTL.search.value; writeHash('refine'); renderControlsResult(); renderTabs(); renderTable(); renderPlot(); }
 });
 function filter(label, all, list, set) {
 var box = el('select', {
 'aria-label': L.filter_by + label,
 onchange: function () { set(box.value); refresh(); }
 }, [el('option', { value: 'all', text: all })].concat(list.map(function (v) {
 return el('option', { value: v, text: v });
 })));
 return box;
 }
 CTL.cat = filter('category', L.all_categories, categories(), function (v) { state.category = v; });
 CTL.chain = filter('chain', L.all_chains, chains(), function (v) { state.chain = v; });
 [['Search', CTL.search], ['Category', CTL.cat], ['Chain', CTL.chain]].forEach(function (pair, i) {
 var id = 'ctl-' + i;
 pair[1].setAttribute('id', id);
 host.appendChild(el('label', { 'for': id, text: pair[0] }));
 host.appendChild(pair[1]);
 });
 CTL.chips = [];
 [[L.watchlist_only, 'watchlist'], [L.off_list_only, 'early']].forEach(function (pair) {
 var chip = el('button', {
 class: 'chip', type: 'button', 'aria-pressed': 'false', text: pair[0],
 onclick: function () { state.scope = state.scope === pair[1] ? 'all' : pair[1]; refresh(); }
 });
 CTL.chips.push([chip, pair[1]]);
 host.appendChild(chip);
 });
 host.appendChild(h('span','spacer'));
 // The row count is the one thing a screen-reader user cannot see change as they type.
 host.appendChild(el('span', { class: 'result', id: 'result-count', role: 'status' }));
 host.appendChild(el('button', {
 class: 'ghost', type: 'button', text: L.clear_filters,
 onclick: function () {
 state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all';
 refresh();
 }
 }));
 }
 function updateControls() {
 if (!CTL.cat) return;
 CTL.search.value = state.q;
 CTL.cat.value = state.category;
 CTL.chain.value = state.chain;
 CTL.chips.forEach(function (pair) {
 pair[0].setAttribute('aria-pressed', state.scope === pair[1] ? 'true' : 'false');
 });
 }
 function renderControlsResult() {
 var node = document.getElementById('result-count');
 if (!node) return;
 var n = visibleRows().length;
 node.textContent = n + ' of ' + D.board_size + ' rows';
 }
 function categories() { return listOf(function (r) { return [r.category || 'Other']; }); }
 function chains() { return listOf(function (r) { return r.chains || []; }); }
 var TAB_KEYS = ['board', 'live', 'model'];
 var TAB_LABELS = { board: L.tab_board, live: L.tab_live, model: L.tab_model };
 function buildTabs() {
 var host = into('tabs');
 host.setAttribute('role', 'tablist');
 TAB_KEYS.forEach(function (key, i) {
 host.appendChild(el('button', {
 class: 'tab', type: 'button', role: 'tab', id: 'tab-' + key, 'data-view': key,
 'aria-controls': 'view-' + key,
 onclick: function () { state.view = key; writeHash('push'); render(); },
 onkeydown: function (e) {
 if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
 e.preventDefault();
  var next = e.key === 'Home' ? TAB_KEYS[0]
   : e.key === 'End' ? TAB_KEYS[TAB_KEYS.length - 1]
   : TAB_KEYS[(i + (e.key === 'ArrowRight' ? 1 : TAB_KEYS.length - 1)) % TAB_KEYS.length];
 notes = []; state.view = next; writeHash('push'); render();
 var moved = document.getElementById('tab-' + next);
 if (moved) moved.focus();
 }
 }, [
 // The space is in the label, not the badge: without it the tab's name is "Pre-token board195".
 document.createTextNode(TAB_LABELS[key] + (key === 'model' ? '' : ' ')),
 key === 'model' ? null : e('span', 'count', '0')
 ]));
 });
 }
 function renderTabs() {
 var counts = { board: visibleRows().length, live: D.live.length, model: null };
 TAB_KEYS.forEach(function (key) {
 var tab = document.getElementById('tab-' + key);
 if (!tab) return;
 var on = state.view === key;
 tab.setAttribute('aria-selected', on ? 'true' : 'false');
 tab.setAttribute('tabindex', on ? '0' : '-1');
 var badge = tab.querySelector('.count');
 if (badge && counts[key] !== null) badge.textContent = String(counts[key]);
 });
 }
 function renderHero() {
 var host = into('hero');
 var view = state.view;
 var headline = view === 'live' ? D.copy.live_headline : view === 'model' ? D.copy.model_headline : D.copy.board_headline;
 var ledeText = view === 'live' ? D.copy.live_lede : view === 'model' ? D.copy.model_lede : D.copy.board_lede;
 var lede = el('div', null, [
 el('h1', null, [headline]),
 el('p', { class: 'lede', html: ledeText })
 ]);
 // the callout explains the table under it, and each view has its own table
 var pc = D.copy['pricing_' + view] || D.copy.pricing_board;
 var steps = h('div','callout', [
 t('h2',pc.head),
 el('ol', null, pc.steps.map(function (s) { return el('li', { html: s }); }))
 ]);
 host.appendChild(h('div','hero-grid', [lede, steps]));
 }
 function renderMeta() {
 var host = into('bar-meta');
 var facts = [
 ['snapshot', D.as_of],
 ['universe', D.universe_size + ' protocols'],
 ['watchlist', D.watchlist_size + ' covered'],
 ['board', D.board_size + ' rows'],
 ['model', D.model_version]
 ];
 facts.forEach(function (f) {
 host.appendChild(el('div', null, [t('dt', f[0]), t('dd', f[1])]));
 });
 sizeBar();
 }
 function renderNote() {
 var host = document.getElementById('note');
 if (!host) return;
 clear(host);
 host.hidden = !notes.length;
 if (notes.length) host.appendChild(e('div', 'warn note', notes.join(' ')));
 }
 function sizeBar() {
 var bar = document.querySelector('.bar');
 if (bar) document.documentElement.style.setProperty('--bar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
 }
 function mountSheet(host, sheet, row) {
 sheet.setAttribute('data-slug', row.slug);
 host.appendChild(sheet);
 wireDrawer(host, sheet);
 }
 function wireDrawer(host, sheet) {
 if (!host.dataset.wired) {
 host.dataset.wired = '1';
 host.addEventListener('click', function (e) { if (e.target === host) closeDetail(); });
 }
 document.addEventListener('keydown', escClose);
 document.addEventListener('keydown', trapFocus);
 var closeBtn = sheet.querySelector('.close');
 if (closeBtn) closeBtn.focus();
 }
 function closeDetail() {
 var host = document.getElementById('drawer');
 if (drawerPushed) {
 drawerPushed = false;
 state.selected = null;
 history.back();
 return;
 }
 host.hidden = true;
 clear(host);
 document.removeEventListener('keydown', escClose);
 document.removeEventListener('keydown', trapFocus);
 var was = state.selected;
 state.selected = null;
 writeHash('replace');
 if (lastFocus && document.contains(lastFocus)) {
 lastFocus.focus();
 } else if (was) {
 var back = document.querySelector('tr[data-slug="' + was + '"]');
 if (back) back.focus();
 }
 lastFocus = null;
 }
 function escClose(e) {
 if (e.key === 'Escape') closeDetail();
 }
 function trapFocus(e) {
 if (e.key !== 'Tab') return;
 var sheet = document.querySelector('.sheet');
 if (!sheet) return;
 var items = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
 if (items.length === 0) return;
 var first = items[0];
 var last = items[items.length - 1];
 if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
 else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
 else if (!sheet.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
 }
 function rowAttrs(r) {
 return {
 class: 'row', tabindex: '0', 'data-slug': r.slug,
 // The board's row is ranked by implied value; the live table's by market cap. One helper
 // serves both, so the name follows the figure the table shows.
 'aria-label': r.name + ', ' + money(r.implied_value_usd === undefined ? r.mcap_usd : r.implied_value_usd) +
 (r.implied_value_usd === undefined ? ' market cap' : ' implied'),
 onclick: function (e) { openDetail(r.slug, undefined, e.currentTarget); },
 onkeydown: function (e) {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, e.currentTarget); }
 }
 };
 }
 var lastFocus = null;
 function money(n, sig) {
 if (n === null || n === undefined) return '—';
 var a = Math.abs(n);
 var s = sig || 3;
 if (a >= 1e9) return '$' + (n / 1e9).toPrecision(s) + 'B';
 if (a >= 1e6) return '$' + (n / 1e6).toPrecision(s) + 'M';
 if (a >= 1e3) return '$' + (n / 1e3).toPrecision(s) + 'K';
 return '$' + Math.round(n);
 }
 function moneyExact(n) {
 if (n === null || n === undefined) return '—';
 return '$' + Math.round(n).toLocaleString('en-US');
 }
 function chg(r) {
 return e('td', 'right num ' + (r.change_7d === null ? 'muted' : r.change_7d >= 0 ? 'up' : 'down'), pct(r.change_7d));
 }
 function pct(n, digits) {
 if (n === null || n === undefined) return '—';
 return (n >= 0 ? '+' : '') + n.toFixed(digits === undefined ? 1 : digits) + '%';
 }
 function age(days) {
 if (days === null || days === undefined) return 'unknown';
 if (days < 60) return days + 'd';
 if (days < 730) return Math.round(days / 30.44) + 'mo';
 return (days / 365.25).toFixed(1) + 'y';
 }
 function h(tag, cls, children) {
 return el(tag, { class: cls }, children);
 }
 function t(tag, text) {
 return el(tag, { text: text });
 }
 function e(tag, cls, text) {
 return el(tag, { class: cls, text: text });
 }
 function el(tag, attrs, children) {
 var node = document.createElement(tag);
 if (attrs) {
 Object.keys(attrs).forEach(function (k) {
 var v = attrs[k];
 if (v === null || v === undefined || v === false) return;
 if (k === 'text') node.textContent = v;
 else if (k === 'html') node.innerHTML = v;
 else if (k === 'class') node.className = v;
 else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
 else node.setAttribute(k, v === true ? '' : String(v));
 });
 }
 var kids = children === null || children === undefined ? [] : (typeof children === 'string' ? [children] : children);
 kids.forEach(function (c) {
 if (c === null || c === undefined || c === false) return;
 node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
 });
 return node;
 }
 function line(label, value, total) {
 return h('div', total ? 'line total' : 'line', [t('span', label), t('span', value)]);
 }
 function kpi(label, value, tone) {
 return h('div','kpi', [
 e('div', 'k', label),
 e('div', 'v' + (tone ? ' ' + tone : ''), value)
 ]);
 }
 function card(title, children) {
 return h('div','card stack', [
 t('h3', title)
 ].concat(children));
 }
 function into(id) {
 return clear(document.getElementById(id));
 }
 function clear(node) {
 while (node.firstChild) node.removeChild(node.firstChild);
 return node;
 }
 var VIEWS = ['board', 'live', 'model'];
 var state = { view: 'board', q: '', category: 'all', chain: 'all', scope: 'all', key: 'rank', dir: 1, liveKey: 'mcap', liveDir: -1, selected: null };
 var notes = [];
 function refresh() {
  notes = [];
  writeHash('refine'); updateControls(); renderTabs(); renderTable(); renderPlot(); renderNote();
 }
 function dec(s) {
 try { return decodeURIComponent(s); } catch (e) { return null; }
 }
 function readHash() {
 notes = [];
 Object.keys(HASH_DEFAULT).forEach(function (k) { state[HASH[k]] = HASH_DEFAULT[k]; });
 state.dir = 1;
 state.liveDir = -1;
 var h = (location.hash || '').replace(/^#/, '');
 h.split('&').forEach(function (p) {
 var i = p.indexOf('=');
 var k = dec(i < 0 ? p : p.slice(0, i));
 var v = dec(i < 0 ? '' : p.slice(i + 1));
 if (k === null || v === null) { notes.push(L.broken_escape); return; }
 if (k === 'dir') state.dir = v === 'asc' ? 1 : -1;
 else if (k === 'ldir') state.liveDir = v === 'asc' ? 1 : -1;
 else if (HASH[k] && v !== 'null') state[HASH[k]] = v;
 });
 if (VIEWS.indexOf(state.view) === -1) {
 notes.push(L.no_view + state.view + '". Showing the pre-token board.');
 state.view = 'board';
 }
 if (state.category !== 'all' && categories().indexOf(state.category) === -1) {
 notes.push(L.no_category + state.category + '". Showing every category.');
 state.category = 'all';
 }
 if (state.chain !== 'all' && chains().indexOf(state.chain) === -1) {
 notes.push(L.no_chain + state.chain + '". Showing every chain.');
 state.chain = 'all';
 }
 if (['all', 'watchlist', 'early'].indexOf(state.scope) === -1) state.scope = 'all';
 if (!SORTS[state.key]) state.key = 'rank';
 if (state.selected) {
 var row = rowBySlug(state.selected);
 if (row) state.selected = row.slug;
 else if (liveBySlug(state.selected)) { /* already trading: the drawer shows the market's figures */ }
 else { notes.push(missingProtocol(state.selected)); state.selected = null; }
 }
 }
 function missingProtocol(slug) {
 for (var i = 0; i < D.live.length; i++) {
 if (D.live[i].slug === slug) {
 return D.live[i].name + L.live_not_here;
 }
 }
 for (var j = 0; j < D.universe.length; j++) {
 var u = D.universe[j];
 if (u.slug === slug && (u.mcap_usd !== null || u.gecko_id !== null)) {
 return L.live_not_here_short;
 }
 }
 return L.no_such_protocol;
 }
 var pushed = false;
 var drawerPushed = false;
 function writeHash(mode) {
 var parts = [];
 Object.keys(HASH_DEFAULT).forEach(function (k) {
 var v = state[HASH[k]];
 if (v !== null && v !== HASH_DEFAULT[k]) parts.push(k + '=' + encodeURIComponent(v));
 });
 if (state.dir !== 1) parts.push('dir=' + (state.dir === 1 ? 'asc' : 'desc'));
 if (state.liveDir !== -1) parts.push('ldir=' + (state.liveDir === 1 ? 'asc' : 'desc'));
 var next = parts.length ? '#' + parts.join('&') : '';
 if (next === location.hash) return;
 var url = next || location.pathname + location.search;
 if (mode === 'push') {
 history.pushState(null, '', url);
 pushed = true;
 } else if (mode === 'refine' && pushed) {
 history.replaceState(null, '', url);
 } else if (mode === 'refine') {
 history.pushState(null, '', url);
 pushed = true;
 } else {
 history.replaceState(null, '', url);
 }
 }
 function rowBySlug(slug) { return bySlug(D.rows, slug); }
 function liveBySlug(slug) { return bySlug(D.live, slug); }
 var COHORT = {};
 function renderMissingData() {
 var main = document.getElementById('board');
 if (!main) return;
 main.appendChild(h('section','card prose missing', [
 h('h1', null, [L.no_board_title]),
 t('p',L.no_board_body),
 e('p', 'muted', L.no_board_hint)
 ]));
 var bar = document.getElementById('bar-meta');
 if (bar) clear(bar);
 }
 function render() {
 renderMeta();
 renderHero();
 renderTabs();
 renderNote();
 VIEWS.forEach(function (v) {
 document.getElementById('view-' + v).hidden = state.view !== v;
 });
 if (state.view === 'board') { updateControls(); renderTable(); renderPlot(); }
 if (state.view === 'live') renderLive();
 if (state.view === 'model') renderModel();
 var drawer = document.getElementById('drawer');
 if (state.selected) {
 var shown = drawer.querySelector('.sheet');
 if (drawer.hidden || !shown || shown.getAttribute('data-slug') !== state.selected) {
 openDetail(state.selected, false);
 }
 } else if (!drawer.hidden) {
 var was = drawer.querySelector('.sheet');
 var back = was && was.getAttribute('data-slug');
 drawer.hidden = true;
 clear(drawer);
 document.removeEventListener('keydown', escClose);
 document.removeEventListener('keydown', trapFocus);
 var row = back && document.querySelector('tr[data-slug="' + back + '"]');
 if (row) row.focus();
 }
 }
 function onHashChange() {
 pushed = false;
 readHash();
 writeHash('replace');
 render();
 }
 var LIVE_SORTS = {
 name: function (r) { return r.name.toLowerCase(); },
 category: function (r) { return (r.category || '').toLowerCase(); },
 mcap: function (r) { return r.mcap_usd; },
 tvl: function (r) { return r.tvl_usd; },
 ratio: function (r) { return typeof r.ratio !== 'number' ? NaN : r.ratio; },
 growth: function (r) { return typeof r.change_7d !== 'number' ? NaN : r.change_7d; }
 };
 var liveSort = { key: 'mcap', dir: -1 };
 var headCtx = { sort: null, redraw: null };
 function listOf(get) {
 var seen = {};
 D.rows.forEach(function (r) { get(r).forEach(function (v) { seen[v] = true; }); });
 return Object.keys(seen).sort();
 }
 function bySlug(list, slug) {
 for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
 return null;
 }
 var HASH = { p: 'selected', q: 'q', cat: 'category', chain: 'chain', scope: 'scope', view: 'view', sort: 'key', lsort: 'liveKey' };
 var HASH_DEFAULT = { p: '', q: '', cat: 'all', chain: 'all', scope: 'all', view: 'board', sort: 'rank', lsort: 'mcap' };
 D.cohort.forEach(function (c) { COHORT[c.slug] = true; });
 readHash();
 writeHash('replace');
 buildControls();
 updateControls();
 buildTabs();
 render();
 var skip = document.querySelector('a.skip');
 if (skip) {
  skip.addEventListener('click', function (e) {
   e.preventDefault();
   var main = document.getElementById('board');
   if (main) main.focus();
   else location.hash = 'board';
  });
 }
 window.addEventListener('hashchange', onHashChange);
 var resizeTimer = null;
 window.addEventListener('resize', function () {
  sizeBar();
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
   resizeTimer = null;
   if (state.view === 'board') renderPlot();
  }, 120);
 });
})();

