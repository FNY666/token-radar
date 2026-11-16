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

  function sortedRows(list) {
    var key = SORTS[state.sort] || SORTS.rank;
    return list.slice().sort(function (a, b) {
      var ka = key(a);
      var kb = key(b);
      if (ka < kb) return -state.dir;
      if (ka > kb) return state.dir;
      return a.rank - b.rank;
    });
  }

  var SORTS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    growth: function (r) { return r.change_7d === null ? -999 : r.change_7d; },
    value: function (r) { return r.implied_value_usd; },
    conditional: function (r) { return r.conditional_value_usd; },
    odds: function (r) { return launchP(r); },
    age: function (r) { return r.age_days === null ? 999999 : r.age_days; }
  };

  function renderTable() {
    var wrap = clear(document.getElementById('table-wrap'));
    var list = sortedRows(visibleRows());
    renderControlsResult();
    if (list.length === 0) {
      wrap.appendChild(el('div', { class: 'empty', text: 'No protocol matches these filters. Clear them to see the whole board.' }));
      return;
    }
    // The bar's scale is the LARGEST value among the rows on screen, not the first row: the first
    // row changes with the sort, so scaling by it made 63 of the rows draw a bar six times wider
    // than the track whenever the board was sorted by anything but value.
    var top = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; }));
    var head = el('thead', null, [
      el('tr', null, [
        sortHeader('rank', '#'),
        sortHeader('name', 'Protocol'),
        el('th', { scope: 'col', text: 'Scope' }),
        el('th', { scope: 'col', text: 'Category' }),
        sortHeader('tvl', 'TVL', true),
        sortHeader('growth', '7d', true),
        sortHeader('odds', 'Launch odds', true),
        sortHeader('conditional', 'If issued', true),
        sortHeader('value', 'Implied value', true)
      ])
    ]);
    var body = el('tbody');
    list.forEach(function (r) {
      var share = top > 0 ? Math.max(0.015, r.implied_value_usd / top) : 0;
      var tr = el('tr', rowAttrs(r), [
        el('td', { class: 'rk num', text: String(r.rank) }),
        el('td', { class: 'pname', text: r.name }),
        el('td', null, [
          el('span', { class: 'tag ' + (r.on_watchlist ? 'wl' : 'early'), text: r.on_watchlist ? 'On the house watchlist' : 'Off the house watchlist' })
        ]),
        el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
        el('td', { class: 'right num', text: money(r.tvl_usd) }),
        chg(r),
        h('td','right', [el('span', { class: 'pill', text: oddsText(launchP(r)) })]),
        el('td', { class: 'right cond', text: money(r.conditional_value_usd) }),
        h('td','right', [
          el('div', { class: 'val', text: money(r.implied_value_usd) }),
          h('div','bar-cell', [
            h('div','bar-track', [el('div', { class: 'bar-fill', style: 'width:' + (share * 100).toFixed(1) + '%' })])
          ])
        ])
      ]);
      body.appendChild(tr);
    });
    wrap.appendChild(el('table', null, [head, body]));
  }

  function sortHeader(key, label, right) {
    var active = state.sort === key;
    // The sorted column says so to a screen reader as well as to the eye: the arrow glyph alone
    // is not an announcement.
    return el('th', {
      class: right ? 'right' : null, scope: 'col',
      'aria-sort': active ? (state.dir === 1 ? 'ascending' : 'descending') : null
    }, [
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
          refresh();
        }
      }, [
        document.createTextNode(label),
        active ? el('span', { class: 'arrow', text: state.dir === 1 ? '▲' : '▼' }) : null
      ])
    ]);
  }

  function renderControls() {
    var host = clear(document.getElementById('controls'));
    var search = el('input', {
      class: 'q', type: 'search', placeholder: 'Search a protocol, a category, a chain…',
      value: state.q, 'aria-label': 'Search protocols',
      oninput: function () { state.q = search.value; writeHash(); renderControlsResult(); renderTable(); renderPlot(); }
    });
    function filter(label, all, list, chosen, set) {
      var box = el('select', {
        'aria-label': 'Filter by ' + label,
        onchange: function () { set(box.value); refresh(); }
      }, [el('option', { value: 'all', text: all })].concat(list.map(function (v) {
        return el('option', { value: v, text: v, selected: v === chosen ? 'selected' : null });
      })));
      return box;
    }
    var cat = filter('category', 'All categories', categories(), state.category, function (v) { state.category = v; });
    var chain = filter('chain', 'All chains', chains(), state.chain, function (v) { state.chain = v; });
    var scope = el('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.scope === 'watchlist' ? 'true' : 'false',
      text: 'Watchlist only',
      onclick: function () {
        state.scope = state.scope === 'watchlist' ? 'all' : 'watchlist';
        refresh();
      }
    });
    var early = el('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.scope === 'early' ? 'true' : 'false',
      text: 'Off list only',
      onclick: function () {
        state.scope = state.scope === 'early' ? 'all' : 'early';
        refresh();
      }
    });
    var result = el('span', { class: 'result', id: 'result-count' });
    var reset = el('button', {
      class: 'ghost', type: 'button', text: 'Clear filters',
      onclick: function () {
        state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all';
        refresh();
      }
    });
    host.appendChild(t('label','Search'));
    host.appendChild(search);
    host.appendChild(t('label','Category'));
    host.appendChild(cat);
    host.appendChild(t('label','Chain'));
    host.appendChild(chain);
    host.appendChild(scope);
    host.appendChild(early);
    host.appendChild(h('span','spacer'));
    host.appendChild(result);
    host.appendChild(reset);
    renderControlsResult();
  }

  function renderControlsResult() {
    var node = document.getElementById('result-count');
    if (!node) return;
    var n = visibleRows().length;
    node.textContent = n + ' of ' + D.board_size + ' rows';
  }

  function categories() {
    var seen = {};
    D.rows.forEach(function (r) { seen[r.category || 'Other'] = true; });
    return Object.keys(seen).sort();
  }

  function chains() {
    var seen = {};
    D.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  // The page refits the model from the figures it carries, with main.ts's procedure, and checks its
  // numbers against the board. It says so if they disagree.
  var MODEL = window.RadarModel ? window.RadarModel.fit(D) : null;

  var FIT = (function () {
    if (!MODEL) return null;
    var exact = 0;
    var within1 = 0;
    var worst = 0;
    D.rows.forEach(function (r) {
      var cond = MODEL.conditional(r.tvl_usd, r.change_7d, r.category);
      var odds = MODEL.launchP(r.tvl_usd, r.change_7d, r.age_days);
      var ev = Math.round(cond * odds);
      if (ev === r.implied_value_usd) exact++;
      if (Math.abs(ev - r.implied_value_usd) <= Math.max(1, r.implied_value_usd * 0.01)) within1++;
      var gap = r.implied_value_usd > 0 ? Math.abs(ev - r.implied_value_usd) / r.implied_value_usd : 0;
      if (gap > worst) worst = gap;
    });
    return { exact: exact, within1: within1, worst: worst, total: D.rows.length };
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

  // The odds, to one decimal of a percent: the same figure everywhere.
  function oddsText(p) { return (p * 100).toFixed(1) + '%'; }

  // The plan is generated once, by main.ts, and carried in board.json and in the dataset the page
  // reads, so the plan a reader reads is the plan the board hands in.
  function farmSteps(row) {
    return (row.farm_steps || []).map(function (text) {
      var cost = '';
      var time = '';
      var m = /Cost:\s*(.*?)\.\s*Time:\s*(.*?)\.?\s*$/.exec(text);
      if (m) { cost = m[1]; time = m[2]; }
      var act = m ? text.slice(0, m.index).trim() : text;
      return { text: act, cost: cost, time: time };
    });
  }

  function openDetail(slug, push, trigger) {
    // Whatever opened the drawer is what the reader comes back to when it closes.
    var opener = trigger || document.activeElement;
    if (opener && opener !== document.body && opener.focus) lastFocus = opener;
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
    writeHash(push !== false);
    var calc = recompute(row);
    var odds = launchP(row);
    var host = clear(document.getElementById('drawer'));
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
      h('div','line total', [el('span', null, ['Implied value']), el('span', { text: moneyExact(calc.expected) })])
    ]);

    var steps = h('ol','steps');
    farmSteps(row).forEach(function (s) {
      steps.appendChild(el('li', null, [
        el('div', { class: 'act', text: s.text }),
        h('div','meta', [
          el('span', { class: 'cost', text: 'Cost: ' + s.cost }),
          el('span', { text: '  ·  Time: ' + s.time })
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
          el('span', { class: 'pn', text: p.name }),
          el('span', { class: 'pv num', text: money(p.implied_value_usd) }),
          el('span', { class: 'pt num muted', text: money(p.tvl_usd) + ' TVL' })
        ]));
      });
    }

    var sheet = sheetFor(row, row.slug + ' · rank ' + row.rank + ' of ' + D.board_size,
      row.on_watchlist ? 'On the house watchlist' : (row.tvl_usd >= D.floor_usd ? 'Not on the house watchlist — above the ' + FLOOR + ' floor' : 'Not on the house watchlist — below the ' + FLOOR + ' floor'),
      row.on_watchlist ? 'wl' : 'early', [
      kpis,
      h('h4', null, ['How this row is priced']),
      deriv,
      h('h4', null, ['The snapshot record it read']),
      record,
      h('h4', null, ['How to farm it']),
      steps,
      peerBox ? h('h4', null, ['Others in this category']) : null,
      peerBox,
      el('div', { class: 'warn', text: D.copy.drawer_note })
    ]);

    host.appendChild(sheet);
    wireDrawer(host, sheet);
  }

  // The drawer for a protocol whose token already trades: no implied value, no farm plan -- its value is the market's own.
  function sheetFor(row, sub, tagText, tagCls, body) {
    var head = h('div','sheet-head', [
      el('div', null, [
        el('h2', { id: 'sheet-title', text: row.name }),
        el('div', { class: 'slug', text: sub })
      ]),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: '×', onclick: closeDetail })
    ]);
    var chips = h('div','chips', [
      el('span', { class: 'tag ' + tagCls, text: tagText }),
      el('span', { class: 'chip-static', text: row.category || 'Uncategorised' })
    ]);
    var kids = [head, chips];
    if ((row.chains || []).length) {
      kids.push(h('div','chips', (row.chains || []).slice(0, 8).map(function (c) {
        return el('span', { class: 'chip-static', text: c });
      })));
    }
  // The dialog names itself, so a screen reader announces the protocol's name.
    var sheet = el('div', {
      class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', tabindex: '-1'
    }, kids.concat(body));
    return sheet;
  }

  function openLive(row, push) {
    state.selected = row.slug;
    writeHash(push !== false);
    var host = clear(document.getElementById('drawer'));
    host.hidden = false;
    var inCohort = COHORT[row.slug] === true;
    var gap = row.not_in_cohort || null;

    var kpis = h('div','kpis', [
      kpi('Market cap', moneyExact(row.mcap_usd), 'gold'),
      kpi('TVL', moneyExact(row.tvl_usd)),
      kpi('Cap / TVL', row.ratio === null ? '—' : row.ratio.toFixed(2), 'cyan'),
      kpi('7d change', pct(row.change_7d))
    ]);

    var record = h('div','deriv', [
      line('Market cap', moneyExact(row.mcap_usd)),
      line('TVL', moneyExact(row.tvl_usd)),
      line('Cap / TVL', row.ratio === null ? 'not recorded' : row.ratio.toFixed(4)),
      line('Seven-day TVL change', pct(row.change_7d)),
      line('Category', row.category || 'Uncategorised'),
      line('Chains', String((row.chains || []).length)),
      h('div','line total', [el('span', null, ["In the model's calibration cohort"]), el('span', { text: inCohort ? 'yes' : 'no' })])
    ]);
    if (gap) {
      record.appendChild(h('div','line', [el('span', null, ['Not in the cohort because']), el('span', { text: gap })]));
    }

    var sheet = sheetFor(row, row.slug + ' · already trading', 'Token already trades', 'live', [
      kpis,
      h('h4', null, ["The market's figures"]),
      record,
      el('div', { class: 'warn', text: inCohort ? D.copy.live_drawer_note : D.copy.live_gap_note + gap + '.' })
    ]);

    host.appendChild(sheet);
    wireDrawer(host, sheet);
  }

  // The visible rows as a scatter: implied value against launch odds, dot size is TVL.
  function renderPlot() {
    var host = clear(document.getElementById('plot-wrap'));
    var list = visibleRows();
    if (list.length === 0) {
      host.appendChild(el('div', { class: 'plot-empty', text: 'No protocol matches these filters.' }));
      return;
    }
  // The plot is drawn in PIXELS: one SVG user unit is one CSS pixel, so dots stay round.
    var box = document.querySelector('.plot-wrap');
    var cs = box ? getComputedStyle(box) : null;
    var padX = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : 32;
    var W = Math.max(320, Math.round((host.getBoundingClientRect().width || 1000) - padX));
    var H = 150;
    var padL = 54;
    var padR = 16;
    var padT = 10;
    var padB = 30;
    var values = list.map(function (r) { return r.implied_value_usd; });
    var maxV = Math.max.apply(null, values);
    var maxTvl = Math.max.apply(null, list.map(function (r) { return r.tvl_usd; }));
    var minTvl = Math.min.apply(null, list.map(function (r) { return r.tvl_usd; }));
    var logMin = Math.log10(Math.max(minTvl, 1));
    var logMax = Math.log10(Math.max(maxTvl, 1));

    function xOf(p) { return padL + (p - 0.05) / 0.9 * (W - padL - padR); }
    function yOf(v) { return padT + (1 - Math.log10(Math.max(v, 1)) / Math.log10(maxV)) * (H - padT - padB); }
    function rOf(tvl) {
      if (logMax <= logMin) return 5;
      var t = (Math.log10(Math.max(tvl, 1)) - logMin) / (logMax - logMin);
      return 3.5 + t * 8.5;
    }

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  // The viewBox is scaled UNIFORMLY, so a dot is a circle and an axis label is not stretched.
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
    add('text', { x: padL, y: H - 4, class: 'axis-title' }, 'Launch odds (chance it issues a token)');
    add('text', { x: 8, y: padT + 4, class: 'axis-title' }, 'Implied value');

    list.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).forEach(function (r) {
      var c = add('circle', {
        cx: xOf(launchP(r)), cy: yOf(r.implied_value_usd), r: rOf(r.tvl_usd),
        class: 'dot' + (r.on_watchlist ? ' wl' : ''), 'data-slug': r.slug,
        tabindex: '0', role: 'button', 'aria-label': r.name + ': ' + money(r.implied_value_usd) + ' implied'
      });
      c.addEventListener('click', function () { openDetail(r.slug, undefined, c); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, c); }
      });
      var t = document.createElementNS(ns, 'title');
      t.textContent = r.name + ' — ' + money(r.implied_value_usd) + ' implied, ' +
        oddsText(launchP(r)) + ' odds, ' + money(r.tvl_usd) + ' TVL';
      c.appendChild(t);
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
      el('span', { class: 'hint', text: 'Implied value against launch odds · dot size is TVL · click a dot for its detail' })
    ]));
    var plotBox = h('div','plot');
    plotBox.appendChild(svg);
    host.appendChild(plotBox);
    host.appendChild(h('div','plot-legend', [
      el('span', null, [el('i', { style: 'background:var(--value)' }), 'On the house watchlist']),
      el('span', null, [el('i', { style: 'background:var(--odds)' }), 'Off the house watchlist'])
    ]));
  }

  // The three views are a tab set, and the pattern is completed: a tablist, named panels, Left/Right between tabs.
  function renderTabs() {
    var host = clear(document.getElementById('tabs'));
    host.setAttribute('role', 'tablist');
    var tabs = [
      { key: 'board', label: 'Pre-token board', count: D.board_size },
      { key: 'live', label: 'Already trading', count: D.live_size },
      { key: 'model', label: 'The model', count: null }
    ];
    tabs.forEach(function (t, i) {
      var id = 'tab-' + t.key;
      host.appendChild(el('button', {
        class: 'tab', type: 'button', role: 'tab', id: id, 'data-view': t.key,
        'aria-selected': state.view === t.key ? 'true' : 'false',
        'aria-controls': 'view-' + t.key,
        tabindex: state.view === t.key ? '0' : '-1',
        onclick: function () { state.view = t.key; writeHash(); render(); },
        onkeydown: function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          state.view = next.key; writeHash(); render();
          var moved = document.getElementById('tab-' + next.key);
          if (moved) moved.focus();
        }
      }, [
        document.createTextNode(t.label),
        t.count !== null ? el('span', { class: 'count', text: String(t.count) }) : null
      ]));
    });
  }

  // The hero states what the tab under it shows, so the headline is never the opposite of the table beside it.
  function renderHero() {
    var host = clear(document.getElementById('hero'));
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
    var host = clear(document.getElementById('bar-meta'));
    var facts = [
      ['snapshot', D.as_of],
      ['universe', D.universe_size + ' protocols'],
      ['watchlist', D.watchlist_size + ' covered'],
      ['board', D.board_size + ' rows'],
      ['model', D.model_version]
    ];
    facts.forEach(function (f) {
      host.appendChild(el('div', null, [el('dt', { text: f[0] }), el('dd', { text: f[1] })]));
    });
    sizeBar();
  }

  function renderNote() {
    var host = document.getElementById('note');
    if (!host) return;
    clear(host);
    host.hidden = !notes.length;
    if (notes.length) host.appendChild(el('div', { class: 'warn note', text: notes.join(' ') }));
  }

  // The bar's height depends on how its facts wrap, so the sticky offset is set from its MEASURED height.
  function sizeBar() {
    var bar = document.querySelector('.bar');
    if (bar) document.documentElement.style.setProperty('--bar-h', Math.round(bar.getBoundingClientRect().height) + 'px');
  }

  function renderLive() {
    var host = clear(document.getElementById('view-live'));
    host.appendChild(el('p', { class: 'live-note', html: D.copy.live_note }));
    var head = el('thead', null, [
      el('tr', null, [
        el('th', { scope: 'col', text: 'Protocol' }),
        el('th', { scope: 'col', text: 'Category' }),
        el('th', { class: 'right', scope: 'col', text: 'Market cap' }),
        el('th', { class: 'right', scope: 'col', text: 'TVL' }),
        el('th', { class: 'right', scope: 'col', text: 'Cap / TVL' }),
        el('th', { class: 'right', scope: 'col', text: '7d' })
      ])
    ]);
    var body = el('tbody');
    D.live.forEach(function (r) {
      body.appendChild(el('tr', rowAttrs(r), [
        el('td', null, [
          h('div','pname', [
            document.createTextNode(r.name),
            el('span', { class: 'slug', text: r.slug })
          ])
        ]),
        el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
        el('td', { class: 'right num', text: money(r.mcap_usd) }),
        el('td', { class: 'right num', text: money(r.tvl_usd) }),
        h('td','right num', [el('span', { class: 'pill live', text: r.ratio === null ? '—' : r.ratio.toFixed(2) })]),
        chg(r)
      ]));
    });
    host.appendChild(h('div','table-wrap', [el('table', null, [head, body])]));
  }

  function renderModel() {
    var host = clear(document.getElementById('view-model'));
    var c = D.calibration;

    var cards = h('div','model-grid', [
      h('div','card', [
        t('h3','Value fit'),
        el('div', { class: 'big', text: c.mae_log10.toFixed(3) }),
        el('p', { text: D.copy.value_fit_note })
      ]),
      h('div','card', [
        t('h3','Launch odds'),
        el('div', { class: 'big', text: c.launch_auc.toFixed(3) }),
        t('p', D.copy.launch_odds_note),
      ]),
      h('div','card', [
        t('h3','No name is special'),
        el('p', { html: D.copy.no_name_special })
      ])
    ]);
    host.appendChild(cards);

    host.appendChild(card('The formula', [
      el('div', { class: 'formula', text: D.copy.formula }),
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

    var curve = card('How often a protocol issues a token, by how long it has run', [
      t('p', D.copy.curve_note),
    ]);
    var curveBox = h('div','curve');
    c.bands.forEach(function (b) {
      var rate = b.n ? b.issued / b.n : 0;
      curveBox.appendChild(h('div','curve-row', [
        el('span', { class: 'lbl', text: (b.lo / 365.25).toFixed(1) + 'y – ' + (b.hi === null ? '∞' : (b.hi / 365.25).toFixed(1) + 'y') }),
        h('span','track', [el('span', { class: 'fill', style: 'width:' + (rate * 100).toFixed(1) + '%' })]),
        el('span', { class: 'v', text: Math.round(rate * 100) + '%' })
      ]));
    });
    curve.appendChild(curveBox);
    var bandsTable = h('table','bands', [
      el('thead', null, [el('tr', null, [
        t('th','Cohort'), t('th','Protocols'),
        t('th','Issued a token'), t('th','Rate')
      ])]),
      el('tbody', null, c.bands.map(function (b) {
        return el('tr', null, [
          el('td', { text: b.lo + '–' + (b.hi === null ? '∞' : b.hi) + ' days' }),
          el('td', { text: String(b.n) }),
          el('td', { text: String(b.issued) }),
          el('td', { text: b.n ? (b.issued / b.n * 100).toFixed(1) + '%' : '—' })
        ]);
      }))
    ]);
    curve.appendChild(bandsTable);
    host.appendChild(curve);

    var catCard = card('Category corrections', [
      t('p', D.copy.category_note),
    ]);
    var catRows = Object.keys(c.category_log).map(function (k) {
      return { k: k, v: c.category_log[k] };
    }).sort(function (a, b) { return b.v - a.v; });
    var catTable = h('table','cat-table');
    catRows.forEach(function (r) {
      catTable.appendChild(el('tr', null, [
        el('td', { text: r.k }),
        el('td', { text: (r.v >= 0 ? '+' : '') + r.v.toFixed(3) + '  (×' + Math.pow(10, r.v).toFixed(2) + ')' })
      ]));
    });
    catCard.appendChild(catTable);
    host.appendChild(catCard);

  // The prose lives in the dataset, where the figures it names are interpolated from.
    host.appendChild(card('What this is and is not', [
      el('div', { class: 'prose', html: D.copy.is_and_is_not })
    ]));
  }

  // The drawer's wiring: the backdrop click, Escape, and the focus. The backdrop is registered once, the keydown handler is named.
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
    host.hidden = true;
    clear(host);
    document.removeEventListener('keydown', escClose);
    document.removeEventListener('keydown', trapFocus);
    state.selected = null;
    writeHash();
  // The reader goes back to whatever opened the drawer.
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function escClose(e) {
    if (e.key === 'Escape') closeDetail();
  }

  // Focus containment for the modal drawer: Tab and Shift+Tab cycle inside it, not out into the page behind.
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

  // The rows of both tables are keyboard-reachable and open the drawer; the trigger is passed so the focus can go back.
  function rowAttrs(r) {
    return {
      class: 'row', tabindex: '0',
      onclick: function (e) { openDetail(r.slug, undefined, e.currentTarget); },
      onkeydown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug, undefined, e.currentTarget); }
      }
    };
  }

  // The element that opened the drawer.
  var lastFocus = null;

  function money(n) {
    if (n === null || n === undefined) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }

  function moneyExact(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function chg(r) {
    return el('td', { class: 'right num ' + (r.change_7d === null ? 'muted' : r.change_7d >= 0 ? 'up' : 'down'), text: pct(r.change_7d) });
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

  function line(label, value) {
    return h('div','line', [el('span', { text: label }), el('span', { text: value })]);
  }

  function kpi(label, value, tone) {
    return h('div','kpi', [
      el('div', { class: 'k', text: label }),
      el('div', { class: 'v' + (tone ? ' ' + tone : ''), text: value })
    ]);
  }

  function card(title, children) {
    return h('div','card stack', [
      el('h3', { text: title })
    ].concat(children));
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  var VIEWS = ['board', 'live', 'model'];
  var state = { view: 'board', q: '', category: 'all', chain: 'all', scope: 'all', sort: 'rank', dir: 1, selected: null };
  // The house's TVL floor, as the page names it.
  var FLOOR = '$' + (D.floor_usd / 1e6) + 'M';


  // What a link asked for that the board does not have.
  var notes = [];

  // The board changed: write the state to the URL, then redraw it -- the controls too, so a chip shows its pressed state.
  function refresh() { writeHash(); renderControls(); renderTable(); renderPlot(); }

  // A hash that will not decode is a broken link, not a name: reported, not guessed at.
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
    if (!SORTS[state.sort]) state.sort = 'rank';
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

  function writeHash(push) {
    var parts = [];
    Object.keys(HASH_DEFAULT).forEach(function (k) {
      var v = state[HASH[k]];
      if (v !== null && v !== HASH_DEFAULT[k]) parts.push(k + '=' + encodeURIComponent(v));
    });
    if (state.dir !== 1) parts.push('dir=' + (state.dir === 1 ? 'asc' : 'desc'));
    var next = parts.length ? '#' + parts.join('&') : '';
    if (next === location.hash) return;
    var url = next || location.pathname + location.search;
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }

  function rowBySlug(slug) {
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) return D.rows[i];
    return null;
  }

  function liveBySlug(slug) {
    for (var i = 0; i < D.live.length; i++) if (D.live[i].slug === slug) return D.live[i];
    return null;
  }

  // The cohort the model was fitted on, as a lookup.
  var COHORT = {};

  // Without the dataset there is no board, but there is a page to read: say what is missing.
  function renderMissingData() {
    var main = document.getElementById('board');
    if (!main) return;
    main.appendChild(h('section','card prose missing', [
      h('h1', null, ['This page has no board yet']),
      t('p','The board arrives in a file called data.js, written beside this page when the radar runs. It is not there.'),
      el('p', { class: 'muted', text: 'Run the entry (node main.ts) and open the dashboard it writes: the board, the protocol details and the farm plans are all in that file.' })
    ]));
    var bar = document.getElementById('bar-meta');
    if (bar) clear(bar);
  }

  function render() {
    renderMeta();
    renderHero();
    renderTabs();
    renderNote();
    document.getElementById('view-board').hidden = state.view !== 'board';
    document.getElementById('view-live').hidden = state.view !== 'live';
    document.getElementById('view-model').hidden = state.view !== 'model';
    if (state.view === 'board') { renderControls(); renderTable(); renderPlot(); }
    if (state.view === 'live') renderLive();
    if (state.view === 'model') renderModel();
    if (state.selected) {
      var host = document.getElementById('drawer');
      if (host.hidden) openDetail(state.selected, false);
    } else {
      var drawer = document.getElementById('drawer');
      if (!drawer.hidden) { drawer.hidden = true; clear(drawer); document.removeEventListener('keydown', escClose); document.removeEventListener('keydown', trapFocus); }
    }
  }

  // The hash is read again whenever it changes, so a deep link works and Back closes the drawer.
  function onHashChange() {
    readHash();
    writeHash();
    render();
  }

  // The hash is a wish, not a command: every name in it is checked against the page's own lists.
  var HASH = { p: 'selected', q: 'q', cat: 'category', chain: 'chain', scope: 'scope', view: 'view', sort: 'sort' };
  var HASH_DEFAULT = { p: '', q: '', cat: 'all', chain: 'all', scope: 'all', view: 'board', sort: 'rank' };
  D.cohort.forEach(function (c) { COHORT[c.slug] = true; });

  readHash();
  writeHash();
  render();
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('resize', sizeBar);
})();
