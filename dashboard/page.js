// The Token Radar page. One dataset (data.js), one board, one model, no network and no framework.
// It refits the model from the figures it carries (model.js) and checks its numbers against the
// board, so a reader can verify the model rather than take it on trust.

(function () {
 'use strict';

 var D = window.RADAR;
 if (!D) { renderMissingData(); return; }

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

 // The sort: a number, or NaN when the row has none. A row with no value sorts LAST in both
 // directions: a missing 7d change is not the worst growth in the field, it is no growth.
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

// The extreme of a column, read off the rows. Math.max.apply is how a list becomes an
 // argument list; this is the same call, named once.
 function colExtreme(list, key, pick) {
  return Math[pick].apply(null, list.map(function (r) { return r[key]; }));
 }

 function renderTable() {
  var wrap = into('table-wrap');
  var list = sortedRows(visibleRows(), SORTS[state.key] || SORTS.rank, state.dir, byRank);
  renderControlsResult();
  if (list.length === 0) {
   wrap.appendChild(e('div', 'empty', 'No protocol matches these filters. Clear them to see the whole board.'));
   return;
  }
  // The bar's scale is the LARGEST value on screen, not the first row: the first row changes
  // with the sort, so scaling by it made 63 rows draw a bar six times too wide.
  var top = colExtreme(list, 'implied_value_usd', 'max');
  headCtx.sort = state;
  headCtx.redraw = refresh;
  var head = el('thead', null, [
   el('tr', null, [
    sortHeader('rank', '#', false, 1),
    sortHeader('name', 'Protocol', false, -1),
    el('th', { scope: 'col', text: 'Scope' }),
    el('th', { scope: 'col', text: 'Category' }),
    sortHeader('tvl', 'TVL', true, -1),
    sortHeader('growth', '7d', true, -1),
    sortHeader('odds', 'Launch odds', true, -1),
    sortHeader('conditional', 'If issued', true, -1),
    sortHeader('value', 'Implied value', true, -1)
   ])
  ]);
  var body = el('tbody');
  list.forEach(function (r) {
   var share = top > 0 ? Math.max(0.015, r.implied_value_usd / top) : 0;
   var tr = el('tr', rowAttrs(r), [
    e('td', 'rk num', String(r.rank)),
    e('td', 'pname', r.name),
    el('td', null, [
     e('span', 'tag ' + (r.on_watchlist ? 'wl' : 'early'), r.on_watchlist ? 'On the house watchlist' : 'Off the house watchlist')
    ]),
    e('td', 'cat', r.category || 'Uncategorised'),
    e('td', 'right num', money(r.tvl_usd)),
    chg(r),
    h('td','right', [e('span', 'pill', oddsText(launchP(r)))]),
    e('td', 'right cond', money(r.conditional_value_usd)),
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
 function sortHeader(key, label, right, firstDir) {
  var sort = headCtx.sort;
  var redraw = headCtx.redraw;
  var active = sort.key === key;
  function on() {
   if (sort.key === key) sort.dir = -sort.dir;
   else { sort.key = key; sort.dir = firstDir === undefined ? -1 : firstDir; }
   redraw();
  }
  return el('th', {
   class: right ? 'right' : null, scope: 'col',
   'aria-sort': active ? (sort.dir === 1 ? 'ascending' : 'descending') : null
  }, [el('button', { type: 'button', onclick: on }, [
   document.createTextNode(label),
   active ? e('span', 'arrow', sort.dir === 1 ? '▲' : '▼') : null
  ])]);
 }

 // The page refits the model from the figures it carries, with main.ts's procedure, and checks it
 // against the board, saying so if they disagree.
 var MODEL = window.RadarModel ? window.RadarModel.fit(D) : null;

 var FIT = (function () {
  if (!MODEL) return null;
  var exact = 0;
  var worst = 0;
  D.rows.forEach(function (r) {
   var cond = MODEL.conditional(r.tvl_usd, r.change_7d, r.category);
   var odds = MODEL.launchP(r.tvl_usd, r.change_7d, r.age_days);
   var ev = Math.round(cond * odds);
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
  return {
   conditional: cond,
   expected: Math.round(cond * odds),
   log10: log10,
   launch: odds
  };
 }

 function launchP(row) {
  if (!MODEL) return row.launch_probability;
  return MODEL.launchP(row.tvl_usd, row.change_7d, row.age_days);
 }

 // The odds, to two decimals of a percent: enough for the reader's own multiplication to land.
 function oddsText(p) { return (p * 100).toFixed(2) + '%'; }

 // The plan is generated once, by main.ts, and carried in board.json and in the dataset, so the
 // plan a reader reads is the one the board hands in.
 function farmSteps(row) {
  return (row.farm_steps || []).map(function (text) {
   var m = /Cost:\s*(.*?)\.\s*Time:\s*(.*?)\.?\s*$/.exec(text);
   if (!m) return { text: text, cost: '', time: '' };
   return { text: text.slice(0, m.index).trim(), cost: m[1], time: m[2] };
  });
 }

 function openDetail(slug, push, trigger) {
  // Whatever opened the drawer is what the reader comes back to. An opener inside the drawer
  // is about to be destroyed by the drawer's own rebuild, so the board's row is where the
  // reader comes back to.
  var opener = trigger || document.activeElement;
  if (opener && opener !== document.body && opener.focus && !opener.closest('.sheet')) lastFocus = opener;
  var row = rowBySlug(slug);
  if (!row) {
   // A protocol whose token already trades is not on the board: it has no implied value and no
   // farm plan, because its value is the market's own. It opens the same drawer on the market's
   // figures.
   var live = liveBySlug(slug);
   if (live) openLive(live, push);
   return;
  }
  state.selected = slug;
  writeHash(push === false ? 'replace' : 'push');
  drawerPushed = push !== false;
  var calc = recompute(row);
  var odds = launchP(row);
  var host = into('drawer');
  host.hidden = false;

  var kpis = h('div','kpis', [
   kpi('Implied value', moneyExact(row.implied_value_usd), 'gold'),
   kpi('If it issues', moneyExact(row.conditional_value_usd)),
   kpi('Launch odds', oddsText(calc.launch), 'cyan'),
   kpi('TVL', moneyExact(row.tvl_usd))
  ]);

  var deriv = h('div','deriv', [
   line('TVL', moneyExact(row.tvl_usd)),
   line('Fitted log10(mcap / TVL), before the correction', calc.log10.toFixed(5)),
   line('Category correction', (row.category_log >= 0 ? '+' : '') + row.category_log.toFixed(4)),
   line('Value if it issues', moneyExact(calc.conditional)),
   line('Launch odds (recomputed in the page)', oddsText(odds)),
   line('Implied value', moneyExact(calc.expected), true)
  ]);

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
   line('Seven-day TVL change', pct(row.change_7d)),
   line('First tracked', row.age_days === null ? 'not recorded' : age(row.age_days) + ' ago'),
   line('Category', row.category || 'Uncategorised'),
   line('Chains', String((row.chains || []).length)),
   line('Token recorded?', 'none: no cap, no id, no symbol')
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
     onclick: function (e) { openDetail(p.slug, undefined, e.currentTarget); }
    }, [
     e('span', 'pn', p.name),
     e('span', 'pv num', money(p.implied_value_usd)),
     e('span', 'pt num muted', money(p.tvl_usd) + ' TVL')
    ]));
   });
  }

  // The drawer's body: a heading and the block under it, over and over.
  function sect(title, block) { return [h('h4', null, [title]), block]; }
  var sheet = sheetFor(row, row.slug + ' · rank ' + row.rank + ' of ' + D.board_size,
   row.on_watchlist ? 'On the house watchlist' : 'Off the house watchlist — ' + (row.tvl_usd >= D.floor_usd ? 'above' : 'below') + ' the $' + (D.floor_usd / 1e6) + 'M floor',
   row.on_watchlist ? 'wl' : 'early', [kpis]
    .concat(sect('How this row is priced', deriv))
    .concat(sect('The snapshot record it read', record))
    .concat(sect('How to farm it', steps))
    .concat(peerBox ? sect('Others in this category', peerBox) : [])
    .concat([e('div', 'warn', D.copy.drawer_note)]));

  mountSheet(host, sheet, row);
 }

// A token that already trades: no implied value, no farm plan.
 function sheetFor(row, sub, tagText, tagCls, body) {
 var head = h('div','sheet-head', [
 el('div', null, [
 el('h2', { id: 'sheet-title', text: row.name }),
 e('div', 'slug', sub)
 ]),
 el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: '×', onclick: closeDetail })
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
// The dialog names itself, so a screen reader announces the protocol.
 var sheet = el('div', {
 class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', tabindex: '-1'
 }, kids.concat(body));
 return sheet;
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
 kpi('Market cap', moneyExact(row.mcap_usd), 'gold'),
 kpi('TVL', money(row.tvl_usd)),
 kpi('Cap / TVL', row.ratio === null ? '—' : row.ratio.toFixed(2), 'cyan'),
 kpi('7d change', pct(row.change_7d))
 ]);
 var record = h('div','deriv', [
 line('Market cap', moneyExact(row.mcap_usd)),
 line('TVL', money(row.tvl_usd)),
 line('Cap / TVL', row.ratio === null ? 'not recorded' : row.ratio.toFixed(4)),
 line('Seven-day TVL change', pct(row.change_7d)),
 line('Category', row.category || 'Uncategorised'),
 line('Chains', String((row.chains || []).length)),
 line("In the model's calibration cohort", inCohort ? 'yes' : 'no', true)
 ]);
 if (gap) {
 record.appendChild(line('Not in the cohort because', gap));
 }
 var sheet = sheetFor(row, row.slug + ' · already trading', 'Token already trades', 'live', [
 kpis,
 h('h4', null, ["The market's figures"]),
 record,
 e('div', 'warn', inCohort ? D.copy.live_drawer_note : D.copy.live_gap_note + gap + '.')
 ]);
 mountSheet(host, sheet, row);
 }
// The visible rows as a scatter: implied value against launch odds, dot size is TVL.
 function renderPlot() {
 var host = into('plot-wrap');
 var list = visibleRows();
 if (list.length === 0) {
 host.appendChild(e('div', 'plot-empty', 'No protocol matches these filters.'));
 return;
 }
 // The SVG is drawn in CSS pixels, so the viewBox must be the box's own size, or it scales to fit.
 var cs = getComputedStyle(document.querySelector('.plot-wrap'));
 var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
 var W = Math.max(320, Math.round((host.getBoundingClientRect().width || 1000) - padX));
 var H = 150, padL = 54, padR = 16, padT = 22, padB = 30;
 var maxV = colExtreme(list, 'implied_value_usd', 'max');
 var logMin = Math.log10(Math.max(colExtreme(list, 'tvl_usd', 'min'), 1));
 var logMax = Math.log10(Math.max(colExtreme(list, 'tvl_usd', 'max'), 1));
 function xOf(p) { return padL + (p - 0.05) / 0.9 * (W - padL - padR); }
 function yOf(v) { return padT + (1 - Math.log10(Math.max(v, 1)) / Math.log10(maxV)) * (H - padT - padB); }
 function rOf(tvl) {
 if (logMax <= logMin) return 5;
 return 3.5 + (Math.log10(Math.max(tvl, 1)) - logMin) / (logMax - logMin) * 8.5;
 }
 var ns = 'http://www.w3.org/2000/svg';
 var svg = document.createElementNS(ns, 'svg');
 svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
// The viewBox scales UNIFORMLY: a dot is a circle, a label is not stretched.
 svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
 svg.setAttribute('role', 'img');
 svg.setAttribute('aria-label', 'Implied value against launch odds for the filtered rows');
 function add(tag, attrs, text) {
 var n = document.createElementNS(ns, tag);
 Object.keys(attrs).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
 if (text !== undefined) n.textContent = text;
 svg.appendChild(n);
 return n;
 }
 for (var v = 1; v <= maxV; v *= 10) {
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
 add('text', { x: padL - 8, y: H - 4, class: 'axis-title' }, 'Launch odds (chance it issues a token)');
 add('text', { x: 8, y: 11, class: 'axis-title' }, 'Implied value');
// The dots are a picture of the board, and the table below is the board: every row is reachable by keyboard there. So the plot is ONE keyboard stop.
 var dots = [];
 list.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).forEach(function (r) {
 var c = add('circle', {
 cx: xOf(launchP(r)), cy: yOf(r.implied_value_usd), r: rOf(r.tvl_usd),
 class: 'dot' + (r.on_watchlist ? ' wl' : ''), 'data-slug': r.slug,
 tabindex: '-1', role: 'button',
 'aria-label': r.name + ': ' + money(r.implied_value_usd) + ' implied'
 });
 c.addEventListener('click', function () { openDetail(r.slug, undefined, c); });
 c.addEventListener('keydown', function (e) {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, c); }
 });
 var t = document.createElementNS(ns, 'title');
 t.textContent = r.name + ' — ' + money(r.implied_value_usd) + ' implied, ' +
 oddsText(launchP(r)) + ' odds, ' + money(r.tvl_usd) + ' TVL';
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
 h('h3', null, ['The board, plotted']),
 e('span', 'hint', 'Implied value against launch odds · dot size is TVL · click a dot for its detail')
 ]));
// The plot is one keyboard stop: focus it and the arrow keys walk the dots.
 var plotBox = el('div', { class: 'plot', tabindex: '0', role: 'group',
 'aria-label': 'The board plotted: implied value against launch odds. Use the arrow keys to walk the rows.' });
 var dotAt = 0;
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
 el('span', null, [el('i', { style: 'background:var(--value)' }), 'On the house watchlist']),
 el('span', null, [el('i', { style: 'background:var(--odds)' }), 'Off the house watchlist'])
 ]));
 }
 function renderModel() {
 var host = into('view-model');
 var c = D.calibration;
// The three cards of the model page: a title, a figure, a paragraph.
 function modelCard(title, big, note) {
 return h('div','card', [t('h3', title), big ? e('div', 'big', big) : null, el('p', { html: note })]);
 }
 var cards = h('div','model-grid', [
 modelCard('Value fit', c.mae_log10.toFixed(3), D.copy.value_fit_note),
 modelCard('Launch odds', c.launch_auc.toFixed(3), D.copy.launch_odds_note),
 modelCard('No name is special', null, D.copy.no_name_special)
 ]);
 host.appendChild(cards);
 host.appendChild(card('The formula', [
 e('div', 'formula', D.copy.formula),
 el('p', { html: D.copy.clamps })
 ]));
 if (FIT) {
 var ok = FIT.exact === FIT.total;
 host.appendChild(card('Refitted in this page', [
 el('div', { class: 'big', style: ok ? '' : 'color:var(--live)' },
 FIT.exact + ' / ' + FIT.total),
 el('p', { html: D.copy.refit_lead +
 (ok
 ? '<strong>All ' + FIT.total + ' rows reproduce exactly</strong>, so the board and the page are the same model.'
 : '<strong>' + (FIT.total - FIT.exact) + ' rows differ</strong>, the largest by ' + (FIT.worst * 100).toFixed(1) + '%, which means the data on this page is stale.') })
 ]));
 }
 var curve = card('How often a protocol issues a token, by how long it has run', [t('p', D.copy.curve_note)]);
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
 t('th','Issued a token'), t('th','Rate')
 ])]),
 el('tbody', null, c.bands.map(function (b) {
 var cells = [b.lo + '–' + (b.hi === null ? '∞' : b.hi) + ' days', String(b.n), String(b.issued),
 b.n ? (b.issued / b.n * 100).toFixed(1) + '%' : '—'];
 return el('tr', null, cells.map(function (c) { return t('td', c); }));
 }))
 ]);
 curve.appendChild(bandsTable);
 host.appendChild(curve);
 var catCard = card('Category corrections', [t('p', D.copy.category_note)]);
// Every category the board uses, plus the ones the cohort never saw: those take the target.
 var catRows = Object.keys(c.category_log).map(function (k) {
 return { k: k, v: c.category_log[k] };
 }).sort(function (a, b) { return b.v - a.v; });
 var catTable = h('table','cat-table');
 function catRow(k, v) {
 catTable.appendChild(el('tr', null, [
 t('td', k),
 t('td', (v >= 0 ? '+' : '') + v.toFixed(3) + '  (×' + Math.pow(10, v).toFixed(2) + ')')
 ]));
 }
 catRows.forEach(function (r) { catRow(r.k, r.v); });
 var seen = {};
 D.rows.forEach(function (r) { seen[r.category || 'Uncategorised'] = true; });
 var missing = Object.keys(seen).filter(function (k) { return !(k in c.category_log); });    if (missing.length) catRow(missing.length + ' more the cohort never saw', c.category_default);
 catCard.appendChild(catTable);
 host.appendChild(catCard);
// The prose lives in the dataset, where its figures are interpolated from.
 host.appendChild(card('What this is and is not', [
 el('div', { class: 'prose', html: D.copy.is_and_is_not })
 ]));
 }
 function renderLive() {
 var host = into('view-live');
 host.appendChild(el('p', { class: 'live-note', html: D.copy.live_note }));
// The already-trading table sorts on the market's own columns.
 var rows = sortedRows(D.live, LIVE_SORTS[liveSort.key] || LIVE_SORTS.mcap, liveSort.dir, byName);
 headCtx.sort = liveSort;
 headCtx.redraw = renderLive;
 var head = el('thead', null, [
 el('tr', null, [
 sortHeader('name', 'Protocol', false, 1),
 sortHeader('category', 'Category', false, 1),
 sortHeader('mcap', 'Market cap', true, -1),
 sortHeader('tvl', 'TVL', true, -1),
 sortHeader('ratio', 'Cap / TVL', true, -1),
 sortHeader('growth', '7d', true, -1)
 ])
 ]);
 var body = el('tbody');
 rows.forEach(function (r) {
 body.appendChild(el('tr', rowAttrs(r), [
 el('td', null, [
 h('div','pname', [
 document.createTextNode(r.name),
 e('span', 'slug', r.slug)
 ])
 ]),
 e('td', 'cat', r.category || 'Uncategorised'),
 e('td', 'right num', money(r.mcap_usd)),
 e('td', 'right num', money(r.tvl_usd)),
 h('td','right num', [e('span', 'pill live', r.ratio === null ? '—' : r.ratio.toFixed(2))]),
 chg(r)
 ]));
 });
 host.appendChild(h('div','table-wrap', [el('table', null, [head, body])]));
 }
// The controls are built once, then only their state changes: rebuilding them took the reader's focus with it.
 var CTL = {};
 function buildControls() {
 var host = into('controls');
 CTL.search = el('input', {
 class: 'q', type: 'search', placeholder: 'Search a protocol, a category, a chain…',
 'aria-label': 'Search protocols',
 oninput: function () { state.q = CTL.search.value; writeHash('refine'); renderControlsResult(); renderTabs(); renderTable(); renderPlot(); }
 });
 function filter(label, all, list, set) {
 var box = el('select', {
 'aria-label': 'Filter by ' + label,
 onchange: function () { set(box.value); refresh(); }
 }, [el('option', { value: 'all', text: all })].concat(list.map(function (v) {
 return el('option', { value: v, text: v });
 })));
 return box;
 }
 CTL.cat = filter('category', 'All categories', categories(), function (v) { state.category = v; });
 CTL.chain = filter('chain', 'All chains', chains(), function (v) { state.chain = v; });
 [['Search', CTL.search], ['Category', CTL.cat], ['Chain', CTL.chain]].forEach(function (pair) {
 host.appendChild(t('label', pair[0]));
 host.appendChild(pair[1]);
 });
 CTL.chips = [];
 [['Watchlist only', 'watchlist'], ['Off list only', 'early']].forEach(function (pair) {
 var chip = el('button', {
 class: 'chip', type: 'button', 'aria-pressed': 'false', text: pair[0],
 onclick: function () { state.scope = state.scope === pair[1] ? 'all' : pair[1]; refresh(); }
 });
 CTL.chips.push([chip, pair[1]]);
 host.appendChild(chip);
 });
 host.appendChild(h('span','spacer'));
 host.appendChild(el('span', { class: 'result', id: 'result-count' }));
 host.appendChild(el('button', {
 class: 'ghost', type: 'button', text: 'Clear filters',
 onclick: function () {
 state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all';
 refresh();
 }
 }));
 }
// The controls' state follows the board's: a filter that says one thing and filters another is a lie.
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
// The three views are a tab set: a tablist, named panels, Left/Right between tabs. Built once; only their state and counts change.
 var TAB_KEYS = ['board', 'live', 'model'];
 var TAB_LABELS = { board: 'Pre-token board', live: 'Already trading', model: 'The model' };
 function buildTabs() {
 var host = into('tabs');
 host.setAttribute('role', 'tablist');
 TAB_KEYS.forEach(function (key, i) {
 host.appendChild(el('button', {
 class: 'tab', type: 'button', role: 'tab', id: 'tab-' + key, 'data-view': key,
 'aria-controls': 'view-' + key,
 onclick: function () { state.view = key; writeHash('push'); render(); },
 onkeydown: function (e) {
 if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
 e.preventDefault();
 var next = TAB_KEYS[(i + (e.key === 'ArrowRight' ? 1 : TAB_KEYS.length - 1)) % TAB_KEYS.length];
 state.view = next; writeHash('push'); render();
 var moved = document.getElementById('tab-' + next);
 if (moved) moved.focus();
 }
 }, [
 document.createTextNode(TAB_LABELS[key]),
 key === 'model' ? null : e('span', 'count', '0')
 ]));
 });
 }
// The counts are what the reader sees now, so a badge never contradicts the table.
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
// The hero states what the tab under it shows, so it never contradicts the table.
 function renderHero() {
 var host = into('hero');
 var view = state.view;
 var headline = view === 'live' ? D.copy.live_headline : view === 'model' ? D.copy.model_headline : D.copy.board_headline;
 var ledeText = view === 'live' ? D.copy.live_lede : view === 'model' ? D.copy.model_lede : D.copy.board_lede;
 var lede = el('div', null, [
 el('h1', null, [headline]),
 el('p', { class: 'lede', html: ledeText })
 ]);
 var steps = h('div','callout', [
 t('h2','How a row is priced'),
 el('ol', null, D.copy.pricing_steps.map(function (s) { return el('li', { html: s }); }))
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
// The bar's height depends on how its facts wrap, so the sticky offset is measured.
 function sizeBar() {
 var bar = document.querySelector('.bar');
 if (bar) document.documentElement.style.setProperty('--bar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
 }
// A sheet goes into the drawer and remembers which protocol it shows, so Back and the URL agree.
 function mountSheet(host, sheet, row) {
 sheet.setAttribute('data-slug', row.slug);
 host.appendChild(sheet);
 wireDrawer(host, sheet);
 }
// The drawer's wiring: backdrop click, Escape, focus.
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
 // A drawer the page opened has an entry of its own, so closing it goes BACK to it. One arrived on by link has none: its URL is rewritten in place.
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
 // Come back to where the reader was, if it is still on the page; else the row that was open.
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
// Focus containment: Tab cycles inside the drawer, not the page behind.
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
// The rows are keyboard-reachable; the trigger is passed so focus returns.
 function rowAttrs(r) {
 return {
 class: 'row', tabindex: '0', 'data-slug': r.slug,
 onclick: function (e) { openDetail(r.slug, undefined, e.currentTarget); },
 onkeydown: function (e) {
 if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, e.currentTarget); }
 }
 };
 }
 var lastFocus = null;
// Money to three significant figures, so the odds and the conditional value multiply to the implied value.
 function money(n) {
 if (n === null || n === undefined) return '—';
 var a = Math.abs(n);
 if (a >= 1e9) return '$' + (n / 1e9).toPrecision(3) + 'B';
 if (a >= 1e6) return '$' + (n / 1e6).toPrecision(3) + 'M';
 if (a >= 1e3) return '$' + (n / 1e3).toPrecision(3) + 'K';
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
// The commonest element on the page: a tag, a class, some text.
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
// The element a view is drawn into: found and emptied in one call.
 function into(id) {
 return clear(document.getElementById(id));
 }
 function clear(node) {
 while (node.firstChild) node.removeChild(node.firstChild);
 return node;
 }
 var VIEWS = ['board', 'live', 'model'];
 var state = { view: 'board', q: '', category: 'all', chain: 'all', scope: 'all', key: 'rank', dir: 1, selected: null };
// What a link asked for that the board does not have.
 var notes = [];
// The board changed: write the state to the URL, then redraw.
 function refresh() { writeHash('refine'); updateControls(); renderTabs(); renderTable(); renderPlot(); }
// A hash that will not decode is a broken link, not a name.
 function dec(s) {
 try { return decodeURIComponent(s); } catch (e) { return null; }
 }
 function readHash() {
 notes = [];
 Object.keys(HASH_DEFAULT).forEach(function (k) { state[HASH[k]] = HASH_DEFAULT[k]; });
 state.dir = 1;
 var h = (location.hash || '').replace(/^#/, '');
 h.split('&').forEach(function (p) {
 var i = p.indexOf('=');
 var k = dec(i < 0 ? p : p.slice(0, i));
 var v = dec(i < 0 ? '' : p.slice(i + 1));
 if (k === null || v === null) { notes.push('That link is broken: its text is not a valid escape sequence.'); return; }
 if (k === 'dir') state.dir = v === 'asc' ? 1 : -1;
 else if (HASH[k] && v !== 'null') state[HASH[k]] = v;
 });
 if (VIEWS.indexOf(state.view) === -1) {
 notes.push('No view named "' + state.view + '". Showing the pre-token board.');
 state.view = 'board';
 }
 if (state.category !== 'all' && categories().indexOf(state.category) === -1) {
 notes.push('No category named "' + state.category + '". Showing every category.');
 state.category = 'all';
 }
 if (state.chain !== 'all' && chains().indexOf(state.chain) === -1) {
 notes.push('No chain named "' + state.chain + '". Showing every chain.');
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
 return D.live[i].name + ' already trades: it is on the "Already trading" tab, not on this board.';
 }
 }
 for (var j = 0; j < D.universe.length; j++) {
 var u = D.universe[j];
 if (u.slug === slug && (u.mcap_usd !== null || u.gecko_id !== null)) {
 return 'That protocol already trades a token, so it is not on this board.';
 }
 }
 return 'No protocol with that name is on this board.';
 }
 // The entry the reader is on is one the page pushed, or the one they arrived on. A pushed entry is the page's own, so it may be rewritten in place. The one they ARRIVED on is theirs: rewriting it would make Back leave the page.
 var pushed = false;
 // The drawer is on an entry of its own when the page opened it.
 var drawerPushed = false;
 // How a change reaches the URL. 'push' is a new place -- a view, a drawer -- so Back comes back to the board. 'refine' is a change to the place the reader is on, so it rewrites that entry. 'replace' adds no entry.
 function writeHash(mode) {
 var parts = [];
 Object.keys(HASH_DEFAULT).forEach(function (k) {
 var v = state[HASH[k]];
 if (v !== null && v !== HASH_DEFAULT[k]) parts.push(k + '=' + encodeURIComponent(v));
 });
 if (state.dir !== 1) parts.push('dir=' + (state.dir === 1 ? 'asc' : 'desc'));
 var next = parts.length ? '#' + parts.join('&') : '';
 if (next === location.hash) return;
 var url = next || location.pathname + location.search;
 if (mode === 'push') {
 history.pushState(null, '', url);
 pushed = true;
 } else if (mode === 'refine' && pushed) {
 history.replaceState(null, '', url);
 } else if (mode === 'refine') {
 // The first refinement of the arrival entry gets an entry of its own, so Back undoes the filter instead of leaving the page.
 history.pushState(null, '', url);
 pushed = true;
 } else {
 history.replaceState(null, '', url);
 }
 }
 function rowBySlug(slug) { return bySlug(D.rows, slug); }
 function liveBySlug(slug) { return bySlug(D.live, slug); }
 var COHORT = {};
// Without the dataset there is no board, but there is a page to read.
 function renderMissingData() {
 var main = document.getElementById('board');
 if (!main) return;
 main.appendChild(h('section','card prose missing', [
 h('h1', null, ['This page has no board yet']),
 t('p','The board arrives in a file called data.js, written beside this page when the radar runs. It is not there.'),
 e('p', 'muted', 'Run the entry (node main.ts) and open the dashboard it writes: the board, the protocol details and the farm plans are all in that file.')
 ]));
 var bar = document.getElementById('bar-meta');
 if (bar) clear(bar);
 }
 function render() {
 renderMeta();
 renderHero();
 renderTabs();
 renderNote();
// One loop over the three views, so a fourth is a word.
 VIEWS.forEach(function (v) {
 document.getElementById('view-' + v).hidden = state.view !== v;
 });
 if (state.view === 'board') { updateControls(); renderTable(); renderPlot(); }
 if (state.view === 'live') renderLive();
 if (state.view === 'model') renderModel();
 var drawer = document.getElementById('drawer');
 if (state.selected) {
// The drawer follows the URL: Back must show THAT protocol.
 var shown = drawer.querySelector('.sheet');
 if (drawer.hidden || !shown || shown.getAttribute('data-slug') !== state.selected) {
 openDetail(state.selected, false);
 }
 } else if (!drawer.hidden) {
 // Back closed the drawer: the reader came from somewhere, and Back takes them back to it.
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
// The hash is read whenever it changes: a deep link works, Back closes the drawer.
 function onHashChange() {
 // The reader's own navigation: the entry is theirs, so it is not rewritten.
 pushed = false;
 readHash();
 writeHash('replace');
 render();
 }
// The already-trading table sorts on the market's own columns.
 var LIVE_SORTS = {
 name: function (r) { return r.name.toLowerCase(); },
 category: function (r) { return (r.category || '').toLowerCase(); },
 mcap: function (r) { return r.mcap_usd; },
 tvl: function (r) { return r.tvl_usd; },
 ratio: function (r) { return typeof r.ratio !== 'number' ? NaN : r.ratio; },
 growth: function (r) { return typeof r.change_7d !== 'number' ? NaN : r.change_7d; }
 };
 var liveSort = { key: 'mcap', dir: -1 };
// One header serves both tables: it is given the sort state it drives and the redraw to make on a click.
 var headCtx = { sort: null, redraw: null };
// The lists the filters offer.
 function listOf(get) {
 var seen = {};
 D.rows.forEach(function (r) { get(r).forEach(function (v) { seen[v] = true; }); });
 return Object.keys(seen).sort();
 }
// A row of the board, or of the trading table, by slug.
 function bySlug(list, slug) {
 for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
 return null;
 }
// The hash is a wish, not a command: every name is checked against the lists.
 var HASH = { p: 'selected', q: 'q', cat: 'category', chain: 'chain', scope: 'scope', view: 'view', sort: 'key' };
 var HASH_DEFAULT = { p: '', q: '', cat: 'all', chain: 'all', scope: 'all', view: 'board', sort: 'rank' };
 D.cohort.forEach(function (c) { COHORT[c.slug] = true; });
 readHash();
 writeHash('replace');
 buildControls();
 updateControls();
 buildTabs();
 render();
 window.addEventListener('hashchange', onHashChange);
 window.addEventListener('resize', sizeBar);
})();

