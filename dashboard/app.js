// The Token Radar page. One dataset (data.js), one board, one model, no network and no framework.
//
// The page refits the model from the raw snapshot figures it carries (model.js) and checks its own
// numbers against the board, so a reader can verify the model's work rather than take it on trust.

(function () {
  'use strict';

  var D = window.RADAR;
  if (!D) return;

  // ---------------------------------------------------------------- helpers

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
    // Children may be a node, an array of nodes, or a bare string.
    var kids = children === null || children === undefined ? [] : (typeof children === 'string' ? [children] : children);
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  // ---------------------------------------------------------------- state

  var state = {
    view: 'board',
    q: '',
    category: 'all',
    chain: 'all',
    scope: 'all',
    sort: 'rank',
    dir: 1,
    selected: null
  };

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var parts = h.split('&');
    parts.forEach(function (p) {
      var kv = p.split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'p') state.selected = v;
      else if (k === 'q') state.q = v;
      else if (k === 'cat') state.category = v;
      else if (k === 'chain') state.chain = v;
      else if (k === 'scope') state.scope = v;
      else if (k === 'view') state.view = v;
      else if (k === 'sort') state.sort = v;
      else if (k === 'dir') state.dir = v === 'asc' ? 1 : -1;
    });
  }

  function writeHash() {
    var parts = [];
    if (state.selected) parts.push('p=' + encodeURIComponent(state.selected));
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('cat=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.scope !== 'all') parts.push('scope=' + state.scope);
    if (state.view !== 'board') parts.push('view=' + state.view);
    if (state.sort !== 'rank') parts.push('sort=' + state.sort);
    if (state.dir !== 1) parts.push('dir=' + (state.dir === 1 ? 'asc' : 'desc'));
    var next = parts.length ? '#' + parts.join('&') : '';
    if (next !== location.hash) history.replaceState(null, '', next);
  }

  // ---------------------------------------------------------------- the model, refitted in the page

  // The page refits the model from the raw snapshot figures it carries, with the same procedure
  // main.ts used, and checks its own numbers against the board. A reader can see the arithmetic;
  // the page says so out loud if the two ever disagree.
  var MODEL = window.RadarModel ? window.RadarModel.fit(D) : null;

  // The check: how many rows the page's own fit reproduces, and how far off the rest are.
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

  // The value if this row's protocol issues, from the page's own fit.
  function recompute(row) {
    var cond = MODEL
      ? MODEL.conditional(row.tvl_usd, row.change_7d, row.category)
      : row.conditional_value_usd;
    var log10 = row.tvl_usd > 0 ? Math.log10(cond / row.tvl_usd) : 0;
    return {
      conditional: cond,
      expected: Math.round(cond * row.launch_probability),
      log10: log10,
      launch: row.launch_probability
    };
  }

  // The chance it issues, from the page's own fit.
  function launchP(row) {
    if (!MODEL) return row.launch_probability;
    return MODEL.launchP(row.tvl_usd, row.change_7d, row.age_days);
  }

  // ---------------------------------------------------------------- the top bar and the hero

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
  }

  function renderHero() {
    var host = clear(document.getElementById('hero'));
    var lede = el('div', null, [
      el('h1', null, [
        document.createTextNode('Every protocol here records '),
        el('em', { text: 'no token' }),
        document.createTextNode('. This is what each may be worth if it issues one.')
      ]),
      el('p', { class: 'lede', html:
        'The board ranks ' + D.board_size + ' protocols with no market cap, no CoinGecko id and no symbol: the ' +
        D.watchlist_size + ' on the house watchlist and ' + D.early_size + ' more below it. ' +
        'The model is fitted at run time on the snapshot itself — the ' + D.calibration.cohort_size +
        ' protocols whose tokens <strong>already trade</strong> teach it what a market cap is worth against TVL and seven-day growth; ' +
        'the whole universe teaches it how often a protocol of a given age and size issues one at all.' })
    ]);
    var steps = el('div', { class: 'callout' }, [
      el('h2', { text: 'How a row is priced' }),
      el('ol', null, [
        el('li', { html: '<strong>Conditional value.</strong> TVL × the fitted market-cap-to-TVL ratio for its size, growth and category.' }),
        el('li', { html: '<strong>Launch odds.</strong> The chance it issues at all, read from how often protocols of its age and size have issued.' }),
        el('li', { html: '<strong>Implied value.</strong> The two multiplied. This is what the board ranks.' })
      ])
    ]);
    host.appendChild(el('div', { class: 'hero-grid' }, [lede, steps]));
  }

  // ---------------------------------------------------------------- the tabs

  function renderTabs() {
    var host = clear(document.getElementById('tabs'));
    var tabs = [
      { key: 'board', label: 'Pre-token board', count: D.board_size },
      { key: 'live', label: 'Already trading', count: D.live_size },
      { key: 'model', label: 'The model', count: null }
    ];
    tabs.forEach(function (t) {
      host.appendChild(el('button', {
        class: 'tab', type: 'button', role: 'tab', 'data-view': t.key,
        'aria-selected': state.view === t.key ? 'true' : 'false',
        onclick: function () { state.view = t.key; writeHash(); render(); }
      }, [
        document.createTextNode(t.label),
        t.count !== null ? el('span', { class: 'count', text: String(t.count) }) : null
      ]));
    });
  }

  // ---------------------------------------------------------------- the board

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

  var SORTS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    growth: function (r) { return r.change_7d === null ? -999 : r.change_7d; },
    value: function (r) { return r.implied_value_usd; },
    conditional: function (r) { return r.conditional_value_usd; },
    odds: function (r) { return r.launch_probability; },
    age: function (r) { return r.age_days === null ? 999999 : r.age_days; }
  };

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

  function renderControls() {
    var host = clear(document.getElementById('controls'));
    var search = el('input', {
      type: 'search', placeholder: 'Search a protocol, a category, a chain…',
      value: state.q, 'aria-label': 'Search protocols',
      oninput: function () { state.q = search.value; writeHash(); renderControlsResult(); renderTable(); renderPlot(); }
    });
    var cat = el('select', {
      'aria-label': 'Filter by category',
      onchange: function () { state.category = cat.value; writeHash(); renderTable(); renderPlot(); }
    }, [el('option', { value: 'all', text: 'All categories' })].concat(
      categories().map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })
    ));
    var chain = el('select', {
      'aria-label': 'Filter by chain',
      onchange: function () { state.chain = chain.value; writeHash(); renderTable(); renderPlot(); }
    }, [el('option', { value: 'all', text: 'All chains' })].concat(
      chains().map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null });
      })
    ));
    var scope = el('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.scope === 'watchlist' ? 'true' : 'false',
      text: 'Watchlist only',
      onclick: function () {
        state.scope = state.scope === 'watchlist' ? 'all' : 'watchlist';
        writeHash(); renderControls(); renderTable(); renderPlot();
      }
    });
    var early = el('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.scope === 'early' ? 'true' : 'false',
      text: 'Early names only',
      onclick: function () {
        state.scope = state.scope === 'early' ? 'all' : 'early';
        writeHash(); renderControls(); renderTable(); renderPlot();
      }
    });
    var result = el('span', { class: 'result', id: 'result-count' });
    var reset = el('button', {
      class: 'ghost', type: 'button', text: 'Clear filters',
      onclick: function () {
        state.q = ''; state.category = 'all'; state.chain = 'all'; state.scope = 'all';
        writeHash(); renderControls(); renderTable(); renderPlot();
      }
    });
    host.appendChild(el('label', { text: 'Search' }));
    host.appendChild(search);
    host.appendChild(el('label', { text: 'Category' }));
    host.appendChild(cat);
    host.appendChild(el('label', { text: 'Chain' }));
    host.appendChild(chain);
    host.appendChild(scope);
    host.appendChild(early);
    host.appendChild(el('span', { class: 'spacer' }));
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

  function sortHeader(key, label, right) {
    var active = state.sort === key;
    return el('th', { class: right ? 'right' : null, scope: 'col' }, [
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'rank' ? 1 : -1; }
          writeHash(); renderTable(); renderPlot();
        }
      }, [
        document.createTextNode(label),
        active ? el('span', { class: 'arrow', text: state.dir === 1 ? '▲' : '▼' }) : null
      ])
    ]);
  }

  function renderTable() {
    var wrap = clear(document.getElementById('table-wrap'));
    var list = sortedRows(visibleRows());
    renderControlsResult();
    if (list.length === 0) {
      wrap.appendChild(el('div', { class: 'empty', text: 'No protocol matches these filters. Clear them to see the whole board.' }));
      return;
    }
    var top = list[0].implied_value_usd;
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
      var tr = el('tr', {
        class: 'row', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); }
        }
      }, [
        el('td', { class: 'rk num', text: String(r.rank) }),
        el('td', { class: 'pname', text: r.name }),
        el('td', null, [
          el('span', { class: 'tag ' + (r.on_watchlist ? 'wl' : 'early'), text: r.on_watchlist ? 'Watchlist' : 'Early' })
        ]),
        el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
        el('td', { class: 'right num', text: money(r.tvl_usd) }),
        el('td', { class: 'right num ' + (r.change_7d === null ? 'muted' : r.change_7d >= 0 ? 'up' : 'down'), text: pct(r.change_7d) }),
        el('td', { class: 'right' }, [el('span', { class: 'pill', text: Math.round(r.launch_probability * 100) + '%' })]),
        el('td', { class: 'right cond', text: money(r.conditional_value_usd) }),
        el('td', { class: 'right' }, [
          el('div', { class: 'val', text: money(r.implied_value_usd) }),
          el('div', { class: 'bar-cell' }, [
            el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: 'width:' + (share * 100).toFixed(1) + '%' })])
          ])
        ])
      ]);
      body.appendChild(tr);
    });
    wrap.appendChild(el('table', null, [head, body]));
  }

  // ---------------------------------------------------------------- the plot

  // A scatter of the visible rows: implied value against launch odds, each dot sized by TVL. It is
  // the same rows the table holds, so it shows the shape of the board at a glance.
  function renderPlot() {
    var host = clear(document.getElementById('plot-wrap'));
    var list = visibleRows();
    if (list.length === 0) {
      host.appendChild(el('div', { class: 'plot-empty', text: 'No protocol matches these filters.' }));
      return;
    }
    var W = 1000;
    var H = 230;
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
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Implied value against launch odds for the filtered rows');

    function add(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, String(attrs[k])); });
      if (text !== undefined) n.textContent = text;
      svg.appendChild(n);
      return n;
    }

    // The horizontal grid, at powers of ten.
    for (var v = 1; v <= maxV; v *= 10) {
      var y = yOf(v);
      add('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'grid' });
      add('text', { x: padL - 8, y: y + 3.5, class: 'tick', 'text-anchor': 'end' }, money(v));
    }
    // The vertical grid, at launch-odds steps.
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (p) {
      add('line', { x1: xOf(p), y1: padT, x2: xOf(p), y2: H - padB, class: 'grid' });
      add('text', { x: xOf(p), y: H - padB + 13, class: 'tick', 'text-anchor': 'middle' }, Math.round(p * 100) + '%');
    });
    add('line', { x1: padL, y1: padT, x2: padL, y2: H - padB, class: 'axis' });
    add('line', { x1: padL, y1: H - padB, x2: W - padR, y2: H - padB, class: 'axis' });
    add('text', { x: padL, y: H - 4, class: 'axis-title' }, 'Launch odds (chance it issues a token)');
    add('text', { x: 8, y: padT + 4, class: 'axis-title' }, 'Implied value');

    // The dots, biggest TVL first so the small ones stay clickable on top.
    list.slice().sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).forEach(function (r) {
      var c = add('circle', {
        cx: xOf(r.launch_probability), cy: yOf(r.implied_value_usd), r: rOf(r.tvl_usd),
        class: 'dot' + (r.on_watchlist ? ' wl' : ''), 'data-slug': r.slug
      });
      c.addEventListener('click', function () { openDetail(r.slug); });
      var t = document.createElementNS(ns, 'title');
      t.textContent = r.name + ' — ' + money(r.implied_value_usd) + ' implied, ' +
        Math.round(r.launch_probability * 100) + '% odds, ' + money(r.tvl_usd) + ' TVL';
      c.appendChild(t);
    });

    // The name of the board's leader, so the plot says something on its own.
    var top = list.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; })[0];
    if (top) {
      var ty = yOf(top.implied_value_usd);
      var tx = xOf(top.launch_probability);
      var anchor = tx > W * 0.6 ? 'end' : 'start';
      var dx = anchor === 'end' ? -9 : 9;
      add('text', { x: tx + dx, y: ty + 3.5, class: 'q', 'text-anchor': anchor }, top.name);
    }

    host.appendChild(el('div', { class: 'plot-head' }, [
      el('h3', { text: 'The board, plotted' }),
      el('span', { class: 'hint', text: 'Implied value against launch odds · dot size is TVL · click a dot for its detail' })
    ]));
    var plotBox = el('div', { class: 'plot' });
    plotBox.appendChild(svg);
    host.appendChild(plotBox);
    host.appendChild(el('div', { class: 'plot-legend' }, [
      el('span', null, [el('i', { style: 'background:var(--value)' }), document.createTextNode('On the house watchlist')]),
      el('span', null, [el('i', { style: 'background:var(--odds)' }), document.createTextNode('Early name, below the floor')])
    ]));
  }

  // ---------------------------------------------------------------- the live table

  function renderLive() {
    var host = clear(document.getElementById('view-live'));
    host.appendChild(el('p', { class: 'live-note', html:
      '<strong>These protocols already have a token.</strong> The board above never mixes them in: their value is the market\'s own, not a model\'s. ' +
      'They are here as the calibration set — ' + D.calibration.cohort_size + ' of them taught the model what a market cap is worth relative to TVL — ' +
      'and as the contrast that shows what the board is looking for. A market cap over TVL below 1 is a token the market prices at less than the deposits behind it.' }));
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
      body.appendChild(el('tr', null, [
        el('td', null, [
          el('div', { class: 'pname' }, [
            document.createTextNode(r.name),
            el('span', { class: 'slug', text: r.slug })
          ])
        ]),
        el('td', { class: 'cat', text: r.category || 'Uncategorised' }),
        el('td', { class: 'right num', text: money(r.mcap_usd) }),
        el('td', { class: 'right num', text: money(r.tvl_usd) }),
        el('td', { class: 'right num' }, [el('span', { class: 'pill live', text: r.ratio === null ? '—' : r.ratio.toFixed(2) })]),
        el('td', { class: 'right num ' + (r.change_7d === null ? 'muted' : r.change_7d >= 0 ? 'up' : 'down'), text: pct(r.change_7d) })
      ]));
    });
    host.appendChild(el('div', { class: 'table-wrap' }, [el('table', null, [head, body])]));
  }

  // ---------------------------------------------------------------- the model page

  function renderModel() {
    var host = clear(document.getElementById('view-model'));
    var c = D.calibration;

    var cards = el('div', { class: 'model-grid' }, [
      el('div', { class: 'card' }, [
        el('h3', { text: 'Value fit' }),
        el('div', { class: 'big', text: c.mae_log10.toFixed(3) }),
        el('p', { text: 'Median error of the value model, in log10 dollars, on the ' + c.cohort_size + ' protocols whose tokens already trade. Half land within a factor of ' + Math.pow(10, c.mae_log10).toFixed(1) + ' of the model.' })
      ]),
      el('div', { class: 'card' }, [
        el('h3', { text: 'Launch odds' }),
        el('div', { class: 'big', text: c.launch_auc.toFixed(3) }),
        el('p', { text: 'How well the launch model separates the protocols that have issued a token from those that have not, across the whole eligible universe.' })
      ]),
      el('div', { class: 'card' }, [
        el('h3', { text: 'No name is special' }),
        el('p', { html: 'Every row is scored by one function of <code>TVL</code>, <code>change_7d</code>, <code>listed_at</code> and <code>category</code>. ' +
          'No protocol is named anywhere in the model, and the coefficients are fitted at run time on this snapshot — not typed in.' })
      ])
    ]);
    host.appendChild(cards);

    host.appendChild(el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', { text: 'The formula' }),
      el('div', { class: 'formula', text:
        'log10(mcap / tvl) = a + b·log10(tvl) + c·(change_7d / 10) + category_log\n' +
        '  a = ' + c.value_beta[0].toFixed(4) + '    b = ' + c.value_beta[1].toFixed(4) + '    c = ' + c.value_beta[2].toFixed(4) + '\n' +
        '\n' +
        'conditional value = tvl · 10^(that sum)          what it is worth if it issues\n' +
        'launch odds      = logistic(age band, tvl band, growth)\n' +
        'implied value    = conditional value · launch odds  ← the board ranks this' })
    ]));

    // The page's own refit, checked against the board it was handed.
    if (FIT) {
      var ok = FIT.exact === FIT.total;
      host.appendChild(el('div', { class: 'card', style: 'margin-top:16px' }, [
        el('h3', { text: 'Refitted in this page' }),
        el('div', { class: 'big', style: ok ? '' : 'color:var(--live)' },
          FIT.exact + ' / ' + FIT.total),
        el('p', { html: 'This page carries the raw snapshot figures for the ' + D.calibration.cohort_size +
          ' protocols whose tokens already trade and for the whole eligible universe, and it refits the model from them ' +
          'with the code in <code>model.js</code> — the same procedure <code>main.ts</code> used, not the same numbers pasted in. ' +
          'It then recomputes every row of the board from those figures. ' +
          (ok
            ? '<strong>All ' + FIT.total + ' rows reproduce exactly</strong>, so the board and the page are the same model.'
            : '<strong>' + (FIT.total - FIT.exact) + ' rows differ</strong>, the largest by ' + (FIT.worst * 100).toFixed(1) + '%, which means the data on this page is stale.') })
      ]));
    }

    // The launch curve, read off the universe's age cohorts.
    var curve = el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', { text: 'How often a protocol issues a token, by how long it has run' }),
      el('p', { text: 'Counted across every eligible protocol in the snapshot. This is where the launch odds come from.' })
    ]);
    var curveBox = el('div', { class: 'curve' });
    c.bands.forEach(function (b) {
      var rate = b.n ? b.issued / b.n : 0;
      curveBox.appendChild(el('div', { class: 'curve-row' }, [
        el('span', { class: 'lbl', text: (b.lo / 365.25).toFixed(1) + 'y – ' + (b.hi === null ? '∞' : (b.hi / 365.25).toFixed(1) + 'y') }),
        el('span', { class: 'track' }, [el('span', { class: 'fill', style: 'width:' + (rate * 100).toFixed(1) + '%' })]),
        el('span', { class: 'v', text: Math.round(rate * 100) + '%' })
      ]));
    });
    curve.appendChild(curveBox);
    var bandsTable = el('table', { class: 'bands' }, [
      el('thead', null, [el('tr', null, [
        el('th', { text: 'Cohort' }), el('th', { text: 'Protocols' }),
        el('th', { text: 'Issued a token' }), el('th', { text: 'Rate' })
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

    // The category corrections.
    var catCard = el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', { text: 'Category corrections' }),
      el('p', { text: 'How far each category sits from the fitted line, in log10 dollars, shrunk toward the global mean so a thin category cannot speak for itself.' })
    ]);
    var catRows = Object.keys(c.category_log).map(function (k) {
      return { k: k, v: c.category_log[k] };
    }).sort(function (a, b) { return b.v - a.v; });
    var catTable = el('table', { class: 'cat-table' });
    catRows.forEach(function (r) {
      catTable.appendChild(el('tr', null, [
        el('td', { text: r.k }),
        el('td', { text: (r.v >= 0 ? '+' : '') + r.v.toFixed(3) + '  (×' + Math.pow(10, r.v).toFixed(2) + ')' })
      ]));
    });
    catCard.appendChild(catTable);
    host.appendChild(catCard);

    host.appendChild(el('div', { class: 'card', style: 'margin-top:16px' }, [
      el('h3', { text: 'What this is and is not' }),
      el('div', { class: 'prose', html:
        '<p><strong>It is:</strong> what a token may be worth if its protocol\'s record stays as it is, ranked by that number, with a farm plan for each row. Every figure is the snapshot\'s own; the model is fitted on the snapshot at run time.</p>' +
        '<p><strong>It is not:</strong> a prediction that a token will be issued, or of when, or at what price. The launch odds say how often protocols like this one have issued, not that this one will. A protocol records no token in DefiLlama\'s record; that is not proof that it has none, and the board says so.</p>' +
        '<p><strong>The separation:</strong> the ' + D.watchlist_size + ' watchlist protocols are all on the board, but so are ' + D.early_size + ' more that the watchlist\'s floor leaves out — the watchlist is a floor, never a ceiling. The ' + D.live_size + ' protocols whose tokens already trade are kept in their own table and never mixed into the ranking.</p>' })
    ]));
  }

  // ---------------------------------------------------------------- the detail drawer

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { row = D.rows[i]; break; }
    if (!row) return;
    state.selected = slug;
    writeHash();
    var calc = recompute(row);
    var odds = launchP(row);    var host = clear(document.getElementById('drawer'));
    host.hidden = false;

    var kpis = el('div', { class: 'kpis' }, [
      el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Implied value' }), el('div', { class: 'v gold', text: moneyExact(row.implied_value_usd) })]),
      el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'If it issues' }), el('div', { class: 'v', text: moneyExact(row.conditional_value_usd) })]),
      el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Launch odds' }), el('div', { class: 'v cyan', text: Math.round(row.launch_probability * 100) + '%' })]),
      el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'TVL' }), el('div', { class: 'v', text: moneyExact(row.tvl_usd) })])
    ]);

    var deriv = el('div', { class: 'deriv' }, [
      el('div', { class: 'line' }, [el('span', { text: 'TVL' }), el('span', { text: moneyExact(row.tvl_usd) })]),
      el('div', { class: 'line' }, [el('span', { text: 'Fitted log10(mcap / TVL)' }), el('span', { text: (calc.log10 + row.category_log).toFixed(4) })]),
      el('div', { class: 'line' }, [el('span', { text: 'Category correction' }), el('span', { text: (row.category_log >= 0 ? '+' : '') + row.category_log.toFixed(4) })]),
      el('div', { class: 'line' }, [el('span', { text: 'Value if it issues' }), el('span', { text: moneyExact(calc.conditional) })]),
      el('div', { class: 'line' }, [el('span', { text: 'Launch odds (recomputed in the page)' }), el('span', { text: Math.round(odds * 100) + '%' })]),
      el('div', { class: 'line total' }, [el('span', { text: 'Implied value' }), el('span', { text: moneyExact(calc.expected) })])
    ]);

    var steps = el('ol', { class: 'steps' });
    farmSteps(row).forEach(function (s) {
      steps.appendChild(el('li', null, [
        el('div', { class: 'act', text: s.text }),
        el('div', { class: 'meta' }, [
          el('span', { class: 'cost', text: 'Cost: ' + s.cost }),
          el('span', { text: '  ·  Time: ' + s.time })
        ])
      ]));
    });

    // The record the model read, in full.
    var record = el('div', { class: 'deriv' }, [
      el('div', { class: 'line' }, [el('span', { text: 'Seven-day TVL change' }), el('span', { text: pct(row.change_7d) })]),
      el('div', { class: 'line' }, [el('span', { text: 'First tracked' }), el('span', { text: row.age_days === null ? 'not recorded' : age(row.age_days) + ' ago' })]),
      el('div', { class: 'line' }, [el('span', { text: 'Category' }), el('span', { text: row.category || 'Uncategorised' })]),
      el('div', { class: 'line' }, [el('span', { text: 'Chains' }), el('span', { text: String((row.chains || []).length) })]),
      el('div', { class: 'line' }, [el('span', { text: 'Token recorded?' }), el('span', { text: 'none: no cap, no id, no symbol' })])
    ]);

    // Peers: the other protocols of the same category, by TVL, each with its own implied value.
    var peers = D.rows.filter(function (r) {
      return r.slug !== row.slug && (r.category || 'Other') === (row.category || 'Other');
    }).sort(function (a, b) { return b.tvl_usd - a.tvl_usd; }).slice(0, 5);
    var peerBox = null;
    if (peers.length) {
      peerBox = el('div', { class: 'peers' });
      peers.forEach(function (p) {
        peerBox.appendChild(el('button', {
          class: 'peer', type: 'button',
          onclick: function () { openDetail(p.slug); }
        }, [
          el('span', { class: 'pn', text: p.name }),
          el('span', { class: 'pv num', text: money(p.implied_value_usd) }),
          el('span', { class: 'pt num muted', text: money(p.tvl_usd) + ' TVL' })
        ]));
      });
    }

    var sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, [
      el('div', { class: 'sheet-head' }, [
        el('div', null, [
          el('h2', { text: row.name }),
          el('div', { class: 'slug', text: row.slug + ' · rank ' + row.rank + ' of ' + D.board_size })
        ]),
        el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: '×', onclick: closeDetail })
      ]),
      el('div', { class: 'chips' }, [
        el('span', { class: 'tag ' + (row.on_watchlist ? 'wl' : 'early'), text: row.on_watchlist ? 'On the house watchlist' : 'Early name, below the floor' }),
        el('span', { class: 'chip-static', text: row.category || 'Uncategorised' })
      ]),
      (row.chains || []).length ? el('div', { class: 'chips' }, (row.chains || []).slice(0, 8).map(function (c) {
        return el('span', { class: 'chip-static', text: c });
      })) : null,
      kpis,
      el('h4', { text: 'How this row is priced' }),
      deriv,
      el('h4', { text: 'The snapshot record it read' }),
      record,
      el('h4', { text: 'How to farm it' }),
      steps,
      peerBox ? el('h4', { text: 'Others in this category' }) : null,
      peerBox,
      el('div', { class: 'warn', text:
        'An implied value is this entry\'s own estimate of what a token may be worth if ' + row.name +
        ' issues one and its record stays as it is. It is not a price, not a promise, and not a prediction that a token will be issued at all.' })
    ]);

    host.appendChild(sheet);
    host.addEventListener('click', function (e) { if (e.target === host) closeDetail(); });
    document.addEventListener('keydown', escClose);
    var closeBtn = sheet.querySelector('.close');
    if (closeBtn) closeBtn.focus();
  }

  function closeDetail() {
    var host = document.getElementById('drawer');
    host.hidden = true;
    clear(host);
    document.removeEventListener('keydown', escClose);
    state.selected = null;
    writeHash();
  }

  function escClose(e) {
    if (e.key === 'Escape') closeDetail();
  }

  // ---------------------------------------------------------------- the farm plan, shown as the board carries it

  // The plan is generated once, by main.ts, and carried in board.json and in the dataset the page
  // reads. The page shows those steps rather than making its own, so the plan a reader reads here
  // is the plan the board hands in.
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

  // ---------------------------------------------------------------- render

  function render() {
    renderMeta();
    renderHero();
    renderTabs();
    document.getElementById('view-board').hidden = state.view !== 'board';
    document.getElementById('view-live').hidden = state.view !== 'live';
    document.getElementById('view-model').hidden = state.view !== 'model';
    if (state.view === 'board') { renderControls(); renderTable(); renderPlot(); }
    if (state.view === 'live') renderLive();
    if (state.view === 'model') renderModel();
    if (state.selected) {
      var host = document.getElementById('drawer');
      if (host.hidden) openDetail(state.selected);
    }
  }

  readHash();
  render();
})();
