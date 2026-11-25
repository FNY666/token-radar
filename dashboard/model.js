// The radar's model: main.ts fits this, and the page refits it from the figures it
// carries, so the arithmetic is shown rather than trusted.
//   value model   log10(mcap/tvl) ~ log10(tvl), redescending-weight, with a shrunk category
//                 correction, on the 75 protocols whose tokens trade: median error 0.337
//                 log10 dollars, 0.414 held out over 300 five-fold splits.
//   launch model  logistic(age band, TVL band, growth), on the 303 eligible protocols less
//                 the product rows: AUC 0.753, issuers against non-issuers.
//   ranking       implied value = value if it issues x the chance it issues.
(function (global) {
  'use strict';

  var DAY_MS = 86400000;
  var AGE_EDGES = [0, 182, 365, 730, 1460];
  var TVL_EDGES = [0, 1e7, 5e7, 2e8];
  function fit(data) {
    var beta = fitValue(data.cohort);
    var launch = fitLaunch(data.universe, data.as_of);
    var categories = fitCategories(data.cohort, beta);
    var errors = data.cohort.map(function (p) {
      var x = valueRow(p.tvl_usd);
      var cat = categories[p.category || '(none)'];
      if (cat === undefined) cat = categories.__default;
      return Math.abs(Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) - dot(beta, x) - cat);
    });
    if (errors.length === 0) errors.push(0);
    return {
      value_beta: beta,
      launch_beta: launch.beta,
      launch_auc: launch.auc,
      category_log: categories,
      mae_log10: median(errors),
      conditional: function (tvl, growth, category) {
        var acc = dot(beta, valueRow(tvl));
        var cat = categories[category || '(none)'];
        acc += cat === undefined ? categories.__default : cat;
        return Math.round(tvl * Math.pow(10, acc));
      },
      launchP: function (tvl, growth, age) {
        var x = launchRow(tvl, growth, age === null ? 365 : age);
        var z = dot(launch.beta, x);
        var raw = Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-z))));
        return Math.round(raw * 1e6) / 1e6;
      }
    };
  }

  global.RadarModel = { fit: fit, ageDays: ageDays, clampGrowth: clampGrowth };

  function dot(b, x) {
    var s = 0;
    for (var i = 0; i < b.length; i++) s += b[i] * x[i];
    return s;
  }

  // The value fit: a redescending-weight least squares, so outliers cannot drag it -- the weight goes into the normal equations SQUARED.
  function fitValue(rows) {
    var data = rows.map(function (p) {
      return { x: valueRow(p.tvl_usd), y: Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) };
    });
    if (data.length === 0) return new Array(valueRow(1).length).fill(0);
    var k = data[0].x.length;
    var beta = new Array(k).fill(0);
    for (var it = 0; it < 24; it++) {
      var residual = function (i) {
        return data[i].y - dot(beta, data[i].x);
      };
      var scale = 1.4826 * median(data.map(function (_, i) { return Math.abs(residual(i)); }));
      var matrix = [], rhs = new Array(k).fill(0);
      for (var a = 0; a < k; a++) { matrix.push(new Array(k).fill(0)); }
      data.forEach(function (row, i) {
        var r = Math.abs(residual(i));
        var w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
        for (var p = 0; p < k; p++) {
          for (var q = 0; q < k; q++) matrix[p][q] += w * w * row.x[p] * row.x[q];
          rhs[p] += w * w * row.x[p] * row.y;
        }
      });
      for (var d = 0; d < k; d++) matrix[d][d] += 1e-6;
      beta = solve(matrix, rhs);
    }
    return beta;
  }

  function fitLaunch(rows, asOf) {
    // A product row is neither an issuer nor a non-issuer: it stays out of the fit.
    var data = rows.filter(function (p) { return !isTokenProduct(p); }).map(function (p) {
      var age = ageDays(asOf, p.listed_at);
      return { x: launchRow(p.tvl_usd, p.change_7d, age === null ? 365 : age), y: issuedOwn(p) ? 1 : 0 };
    });
    if (data.length === 0) return { beta: new Array(launchRow(1, 0, 365).length).fill(0), auc: 0.5 };
    var k = data[0].x.length;
    var beta = new Array(k).fill(0);
    // The fit runs until the gradient is flat: the design is rank-deficient -- the intercept and the band dummies span the same space -- so a fixed step count catches it mid-crawl.
    for (var it = 0; it < 50000; it++) {
      var gradient = new Array(k).fill(0);
      data.forEach(function (row) {
        var error = row.y - 1 / (1 + Math.exp(-dot(beta, row.x)));
        for (var i = 0; i < k; i++) gradient[i] += error * row.x[i];
      });
      var norm = 0;
      for (var g = 0; g < k; g++) norm += gradient[g] * gradient[g];
      if (Math.sqrt(norm) < 1e-9) break;
      for (var g2 = 0; g2 < k; g2++) beta[g2] += (0.6 * gradient[g2]) / data.length;
    }
    var pos = data.filter(function (r) { return r.y === 1; });
    var neg = data.filter(function (r) { return r.y === 0; });
    var hits = 0;
    pos.forEach(function (p) {
      var zp = dot(beta, p.x);
      neg.forEach(function (n) {
        var zn = dot(beta, n.x);
        hits += zp > zn ? 1 : (zp === zn ? 0.5 : 0);
      });
    });
    return { beta: beta, auc: pos.length && neg.length ? hits / (pos.length * neg.length) : 0.5 };
  }

  // The per-category correction: the category's residual, shrunk toward the mean and winsorized, so a thin category cannot speak for itself.
  function fitCategories(cohort, beta) {
    var byCat = {};
    var all = [];
    cohort.forEach(function (p) {
      var x = valueRow(p.tvl_usd);
      var r = Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) - dot(beta, x);
      all.push(r);
      var key = p.category || '(none)';
      (byCat[key] = byCat[key] || []).push(r);
    });
    var lo = quantile(all, 0.1);
    var hi = quantile(all, 0.9);
    var clip = function (v) { return Math.max(lo, Math.min(hi, v)); };
    var globalResidual = median(all.map(clip));
    var shrinkage = 4;
    var out = {};
    var sizes = {};
    Object.keys(byCat).forEach(function (key) {
      var clipped = byCat[key].map(clip);
      out[key] = (clipped.length * median(clipped) + shrinkage * globalResidual) / (clipped.length + shrinkage);
      sizes[key] = clipped.length;
    });
    out.__default = globalResidual;
    out.__sizes = sizes;
    return out;
  }

  function valueRow(tvl) {
    return [1, Math.log10(Math.max(tvl, 1))];
  }

  function launchRow(tvl, growth, age) {
    var ab = bandOf(AGE_EDGES, age);
    var tb = bandOf(TVL_EDGES, tvl);
    var x = [1];
    for (var i = 0; i < AGE_EDGES.length; i++) x.push(i === ab ? 1 : 0);
    for (var j = 0; j < TVL_EDGES.length; j++) x.push(j === tb ? 1 : 0);
    x.push(clampGrowth(growth) / 10);
    return x;
  }

  function issuedOwn(p) {
    return p.mcap_usd !== null || p.gecko_id !== null;
  }

  // A product of one that issued: a ticker, but no market cap or CoinGecko id of its own.
  function isTokenProduct(p) {
    return p.symbol !== null && !issuedOwn(p);
  }
  function ageDays(asOf, listedAt) {
    if (!listedAt) return null;
    var a = Date.parse(asOf + 'T00:00:00Z');
    var b = Date.parse(listedAt + 'T00:00:00Z');
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.max(0, Math.floor((a - b) / DAY_MS));
  }

  function clampGrowth(g) {
    if (g === null || g === undefined) return 0;
    return Math.max(-60, Math.min(120, g));
  }

  function bandOf(edges, v) {
    for (var i = 0; i < edges.length; i++) {
      if (v < edges[i + 1]) return i;
    }
    return edges.length - 1;
  }

  function median(list) {
    if (!list.length) return 0;
    var s = list.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function quantile(list, q) {
    if (!list.length) return 0;
    var s = list.slice().sort(function (a, b) { return a - b; });
    var at = (s.length - 1) * q;
    var lo = Math.floor(at);
    var hi = Math.ceil(at);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (at - lo);
  }

  function solve(matrix, rhs) {
    var n = rhs.length;
    var m = matrix.map(function (row, i) { return row.concat([rhs[i]]); });
    for (var c = 0; c < n; c++) {
      var pivot = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
      var t = m[c]; m[c] = m[pivot]; m[pivot] = t;
      if (Math.abs(m[c][c]) < 1e-10) continue;
      for (var rr = 0; rr < n; rr++) {
        if (rr === c) continue;
        var f = m[rr][c] / m[c][c];
        for (var k = c; k <= n; k++) m[rr][k] -= f * m[c][k];
      }
    }
    return m.map(function (row, i) { return row[n] / (row[i] || 1); });
  }

})(window);
