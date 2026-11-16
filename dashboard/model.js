// The radar's model, in the page's own hand: the model main.ts fits, written out here so the page
// refits it from the figures it carries and shows the arithmetic, not a number to take on trust.
//
//   value model   log10(mcap/tvl) ~ log10(tvl) + growth, Huber-weighted, with a shrunk category
//                 correction. Fitted on the eligible protocols whose tokens already trade.
//   launch model  logistic(age band, TVL band, growth), fitted on the whole eligible universe.
//   ranking       implied value = value if it issues x the chance it issues.
//
// Every coefficient comes out of the cohort in the data, every time.

(function (global) {
  'use strict';

  var AGE_BANDS = [
    { lo: 0, hi: 182 },
    { lo: 182, hi: 365 },
    { lo: 365, hi: 730 },
    { lo: 730, hi: 1460 },
    { lo: 1460, hi: Infinity }
  ];
  var TVL_BANDS = [
    { lo: 0, hi: 1e7 },
    { lo: 1e7, hi: 5e7 },
    { lo: 5e7, hi: 2e8 },
    { lo: 2e8, hi: Infinity }
  ];
  var DAY_MS = 86400000;

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

  function ageBand(age) {
    for (var i = 0; i < AGE_BANDS.length; i++) {
      if (age >= AGE_BANDS[i].lo && age < AGE_BANDS[i].hi) return i;
    }
    return AGE_BANDS.length - 1;
  }

  function tvlBand(tvl) {
    for (var i = 0; i < TVL_BANDS.length; i++) {
      if (tvl >= TVL_BANDS[i].lo && tvl < TVL_BANDS[i].hi) return i;
    }
    return TVL_BANDS.length - 1;
  }

  function valueRow(tvl, growth) {
    return [1, Math.log10(Math.max(tvl, 1)), clampGrowth(growth) / 10];
  }

  function launchRow(tvl, growth, age) {
    var ab = ageBand(age);
    var tb = tvlBand(tvl);
    var x = [1];
    for (var i = 0; i < AGE_BANDS.length; i++) x.push(i === ab ? 1 : 0);
    for (var j = 0; j < TVL_BANDS.length; j++) x.push(j === tb ? 1 : 0);
    x.push(clampGrowth(growth) / 10);
    return x;
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

  // The value fit: Huber-weighted least squares, so a few hundred-times outliers cannot drag it.
  function fitValue(rows) {
    var data = rows.map(function (p) {
      return { x: valueRow(p.tvl_usd, p.change_7d), y: Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) };
    });
    var k = data[0].x.length;
    var beta = new Array(k).fill(0);
    for (var it = 0; it < 24; it++) {
      var residual = function (i) {
        var acc = 0;
        for (var j = 0; j < k; j++) acc += beta[j] * data[i].x[j];
        return data[i].y - acc;
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
    var data = rows.map(function (p) {
      var age = ageDays(asOf, p.listed_at);
      return { x: launchRow(p.tvl_usd, p.change_7d, age === null ? 365 : age), y: p.token };
    });
    var k = data[0].x.length;
    var beta = new Array(k).fill(0);
    for (var it = 0; it < 400; it++) {
      var gradient = new Array(k).fill(0);
      data.forEach(function (row) {
        var z = 0;
        for (var j = 0; j < k; j++) z += beta[j] * row.x[j];
        var error = row.y - 1 / (1 + Math.exp(-z));
        for (var i = 0; i < k; i++) gradient[i] += error * row.x[i];
      });
      for (var g = 0; g < k; g++) beta[g] += (0.6 * gradient[g]) / data.length;
    }
      var pos = data.filter(function (r) { return r.y === 1; });
    var neg = data.filter(function (r) { return r.y === 0; });
    var hits = 0;
    pos.forEach(function (p) {
      var zp = 0;
      for (var i = 0; i < k; i++) zp += beta[i] * p.x[i];
      neg.forEach(function (n) {
        var zn = 0;
        for (var j = 0; j < k; j++) zn += beta[j] * n.x[j];
        hits += zp > zn ? 1 : (zp === zn ? 0.5 : 0);
      });
    });
    return { beta: beta, auc: pos.length && neg.length ? hits / (pos.length * neg.length) : 0.5 };
  }

  // The per-category correction: the category's residual, shrunk toward the global mean and
  // winsorized, so a category with one live protocol cannot speak for itself.
  function fitCategories(cohort, beta) {
    var byCat = {};
    var all = [];
    cohort.forEach(function (p) {
      var x = valueRow(p.tvl_usd, p.change_7d);
      var acc = 0;
      for (var j = 0; j < beta.length; j++) acc += beta[j] * x[j];
      var r = Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) - acc;
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
    Object.keys(byCat).forEach(function (key) {
      var clipped = byCat[key].map(clip);
      out[key] = (clipped.length * median(clipped) + shrinkage * globalResidual) / (clipped.length + shrinkage);
    });
    return out;
  }

  /**
   * Fit the whole model from the snapshot figures, in the page, every time it loads.
   * `data` is the dataset main.ts wrote: the cohort, the universe and the board's rows.
   */
  function fit(data) {
    var beta = fitValue(data.cohort);
    var launch = fitLaunch(data.universe, data.as_of);
    var categories = fitCategories(data.cohort, beta);
    var errors = data.cohort.map(function (p) {
      var x = valueRow(p.tvl_usd, p.change_7d);
      var acc = 0;
      for (var j = 0; j < beta.length; j++) acc += beta[j] * x[j];
      return Math.abs(Math.log10(p.mcap_usd / Math.max(p.tvl_usd, 1)) - acc);
    });
    return {
      value_beta: beta,
      launch_beta: launch.beta,
      launch_auc: launch.auc,
      category_log: categories,
      mae_log10: median(errors),
      /** The value if this protocol issues, from the fitted model alone. */
      conditional: function (tvl, growth, category) {
        var x = valueRow(tvl, growth);
        var acc = 0;
        for (var j = 0; j < beta.length; j++) acc += beta[j] * x[j];
        acc += categories[category || '(none)'] || 0;
        return Math.round(tvl * Math.pow(10, acc));
      },
      /** The chance it issues, from the fitted launch model alone. */
      launchP: function (tvl, growth, age) {
        var x = launchRow(tvl, growth, age === null ? 365 : age);
        var z = 0;
        for (var j = 0; j < launch.beta.length; j++) z += launch.beta[j] * x[j];
        return Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-z))));
      }
    };
  }

  global.RadarModel = { fit: fit, ageDays: ageDays, clampGrowth: clampGrowth };
})(window);
