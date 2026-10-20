/* The P-Middle West paddock near Winchelsea, drawn from the geometry in the final report
   (Section 5.3 and 5.5): the grower's John Deere AB line runs 762.1 m on a bearing of
   278.28 deg; 960.1 m across it gives 81 passes at 12 m spacing; each pass is trimmed by a
   36 m headland at both ends (690.1 m working length); passes alternate direction with a
   12 m step at the headland, 162 waypoints in all. The route replay is proportional to
   distance: the simulated run covered 56.9 km in 8.47 h. */
(function () {
  'use strict';
  var root = document.querySelector('[data-paddock]');
  if (!root) return;
  var sec = root.closest('[data-scrolly]');
  var canvas = root.querySelector('canvas');
  var box = root.querySelector('.paddock-canvas') || root;
  var hud = root.querySelector('.hud');
  var ctx = canvas.getContext('2d');
  var reduce = window.KR && window.KR.reduce;

  var DEG = Math.PI / 180;
  var L = 762.1, WIDTH = 960.1, HEAD = 36, SP = 12, NPASS = 81;
  var BRG = 278.28 * DEG;
  var u = [Math.sin(BRG), Math.cos(BRG)];            // along the AB line, A -> B (west-north-west)
  var v = [Math.cos(BRG) * 1, -Math.sin(BRG) * 1];   // across the field (north-north-east)
  function P(s, d) { return [s * u[0] + d * v[0], s * u[1] + d * v[1]]; }

  // route: start at pass 1's start, alternate direction, 12 m headland steps
  var route = [], cum = [0];
  for (var i = 0; i < NPASS; i++) {
    var d = i * SP;
    var west = i % 2 === 0;
    var a = P(west ? HEAD : L - HEAD, d), b = P(west ? L - HEAD : HEAD, d);
    if (i === 0) route.push({ p: a, pass: 0, kind: 'start' });
    else route.push({ p: a, pass: i, kind: 'head' });
    route.push({ p: b, pass: i, kind: 'end' });
  }
  for (var k = 1; k < route.length; k++) {
    var dx = route[k].p[0] - route[k - 1].p[0], dy = route[k].p[1] - route[k - 1].p[1];
    cum.push(cum[k - 1] + Math.hypot(dx, dy));
  }
  var TOTAL = cum[cum.length - 1];

  var corners = [P(0, 0), P(L, 0), P(L, WIDTH), P(0, WIDTH)];
  var minE = Math.min.apply(null, corners.map(function (c) { return c[0]; }));
  var maxE = Math.max.apply(null, corners.map(function (c) { return c[0]; }));
  var minN = Math.min.apply(null, corners.map(function (c) { return c[1]; }));
  var maxN = Math.max.apply(null, corners.map(function (c) { return c[1]; }));

  var css = getComputedStyle(document.documentElement);
  function tok(n, f) { return (css.getPropertyValue(n) || f).trim(); }
  var C = {
    field: tok('--paper', '#F6F3EC'), head: tok('--soil-1', '#E4D7BF'), edge: tok('--ink-3', '#575B56'),
    pass: 'rgba(58,63,59,0.5)', ab: tok('--teal', '#00666F'), trail: tok('--c-sim', '#008C9C'),
    swath: 'rgba(0,140,156,0.20)', ink: tok('--ink', '#1C1F1D'), mute: tok('--ink-3', '#575B56'), paper: tok('--paper', '#F6F3EC')
  };

  var W = 0, H = 0, dpr = 1, sc = 1, ox = 0, oy = 0, progress = reduce ? 1 : 0;
  function X(p) { return ox + (p[0] - minE) * sc; }
  function Y(p) { return oy + (maxN - p[1]) * sc; }

  function resize() {
    var r = box.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    var m = Math.max(28, Math.min(W, H) * 0.08);
    sc = Math.min((W - 2 * m) / (maxE - minE), (H - 2 * m - 24) / (maxN - minN));
    ox = (W - (maxE - minE) * sc) / 2;
    oy = (H - (maxN - minN) * sc) / 2 + 6;
    draw();
  }

  function line(a, b, color, w) {
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b));
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  }
  function poly(pts, fill, stroke) {
    ctx.beginPath();
    pts.forEach(function (p, j) { if (j) ctx.lineTo(X(p), Y(p)); else ctx.moveTo(X(p), Y(p)); });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function label(s, x, y, align, color, size) {
    ctx.font = '500 ' + (size || 11) + 'px Archivo, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color || C.mute; ctx.fillText(s, x, y);
  }
  function along(dist) {
    var lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= dist) lo = mid; else hi = mid; }
    var seg = cum[hi] - cum[lo] || 1, t = Math.min(1, Math.max(0, (dist - cum[lo]) / seg));
    var a = route[lo].p, b = route[hi].p;
    return { i: lo, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var s = progress * 4, phase = Math.min(3, Math.floor(s)), t = Math.min(1, s - phase);
    if (progress >= 1) { phase = 3; t = 1; }

    // field + headlands
    poly(corners, C.field, C.edge);
    poly([P(0, 0), P(HEAD, 0), P(HEAD, WIDTH), P(0, WIDTH)], C.head);
    poly([P(L - HEAD, 0), P(L, 0), P(L, WIDTH), P(L - HEAD, WIDTH)], C.head);
    poly(corners, null, C.edge);

    // passes
    var shown = phase === 0 ? 0 : phase === 1 ? NPASS * ease(t) : NPASS;
    for (var i = 0; i < Math.ceil(shown); i++) {
      var frac = Math.min(1, shown - i);
      var west = i % 2 === 0, d = i * SP;
      var s0 = west ? HEAD : L - HEAD, s1 = west ? L - HEAD : HEAD;
      line(P(s0, d), P(s0 + (s1 - s0) * frac, d), C.pass, 0.8);
    }

    // route replay + swath coverage
    var dist = phase < 2 ? 0 : phase === 2 ? TOTAL * t : TOTAL;
    if (dist > 0) {
      ctx.lineCap = 'butt';
      var pos = along(dist);
      for (var k = 1; k <= pos.i + 1 && k < route.length; k++) {
        if (route[k].kind !== 'end') continue;
        var a = route[k - 1].p, b = k <= pos.i ? route[k].p : pos.p;
        if (k > pos.i + 1) break;
        line(a, b, C.swath, SP * sc);
      }
      ctx.beginPath(); ctx.moveTo(X(route[0].p), Y(route[0].p));
      for (var j = 1; j <= pos.i; j++) ctx.lineTo(X(route[j].p), Y(route[j].p));
      ctx.lineTo(X(pos.p), Y(pos.p));
      ctx.strokeStyle = C.trail; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
      if (phase === 2) {
        ctx.beginPath(); ctx.arc(X(pos.p), Y(pos.p), 5.5, 0, Math.PI * 2);
        ctx.fillStyle = C.ink; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.paper; ctx.stroke();
      }
    }

    // AB line, drawn last so it stays on top
    var A = P(0, 0), B = P(L, 0);
    line(A, B, C.ab, 2.5);
    [[A, 'A'], [B, 'B']].forEach(function (q) {
      ctx.beginPath(); ctx.arc(X(q[0]), Y(q[0]), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = C.ab; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.paper; ctx.stroke();
    });
    label('A', X(A) + 10, Y(A) + 2, 'left', C.ink, 12);
    label('B', X(B) - 10, Y(B) + 2, 'right', C.ink, 12);
    var mid = P(L / 2, 0);
    label('AB line · 762.1 m · 278.28°', X(mid), Y(mid) + 16, 'center', C.ab, W < 420 ? 10 : 11);

    // north arrow + scale bar
    var nx = W - 22, ny = 26;
    ctx.beginPath(); ctx.moveTo(nx, ny - 12); ctx.lineTo(nx - 5, ny + 4); ctx.lineTo(nx, ny); ctx.lineTo(nx + 5, ny + 4); ctx.closePath();
    ctx.fillStyle = C.ink; ctx.fill();
    label('N', nx, ny + 15, 'center', C.ink, 11);
    var sbx = Math.max(10, ox - 6), sby = H - 14, sbw = 200 * sc;
    ctx.beginPath(); ctx.moveTo(sbx, sby - 4); ctx.lineTo(sbx, sby); ctx.lineTo(sbx + sbw, sby); ctx.lineTo(sbx + sbw, sby - 4);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
    label('200 m', sbx + sbw + 8, sby - 2, 'left', C.mute, 10.5);
    if (phase >= 1 && W > 380) {
      var hp = P(L - HEAD / 2, WIDTH);
      label('36 m headland', X(hp) + 8, Y(hp) - 10, 'left', C.mute, 10.5);
    }

    updateHud(phase, t, dist);
  }

  function hm(h) { var m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' m'; }
  var lastHud = '';
  function updateHud(phase, t, dist) {
    if (!hud) return;
    var html;
    if (phase === 0) html = 'P-Middle West, near Winchelsea<br><b>73.17 ha</b> · AB line <b>762.1 m</b>';
    else if (phase === 1) html = 'Tramlines <b>' + Math.max(1, Math.round(NPASS * ease(t))) + ' / 81</b><br>12 m apart · <b>690.1 m</b> each';
    else if (phase === 2) {
      var pass = Math.min(81, Math.floor(along(dist).i / 2) + 1);
      html = 'Simulated run · pass <b>' + pass + ' / 81</b><br><b>' + (56.9 * dist / TOTAL).toFixed(1) + '</b> of 56.9 km · <b>' + hm(8.47 * dist / TOTAL) + '</b>';
    } else html = 'Simulated run complete<br><b>162 / 162</b> waypoints · <b>99.95%</b> covered';
    if (html !== lastHud) { hud.innerHTML = html; lastHud = html; }
  }

  if (sec && !reduce) {
    sec.addEventListener('scrolly:progress', function (e) {
      var p = e.detail.progress;
      if (Math.abs(p - progress) < 0.0005) return;
      progress = p;
      draw();
    });
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(box);
  else window.addEventListener('resize', resize);
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
