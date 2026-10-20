/* Knuckey Rover site: shared behaviour.
   Nothing here hides content. Pages read fully without JS; scripts add the
   scroll story, the charts and the mobile menu. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- mobile nav ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  if (header && toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('open')) {
        header.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---------- scrolly: active step + section progress ---------- */
  var scrollies = [].slice.call(document.querySelectorAll('[data-scrolly]'));
  scrollies.forEach(function (sec) {
    var steps = [].slice.call(sec.querySelectorAll('.step'));
    var stage = sec.querySelector('.scrolly-stage');
    var current = -1;
    function setActive(i) {
      if (i === current) return;
      current = i;
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      var key = steps[i] && steps[i].getAttribute('data-shot');
      if (stage && key) {
        [].slice.call(stage.querySelectorAll('.shot')).forEach(function (sh) {
          var on = sh.getAttribute('data-shot') === key;
          sh.classList.toggle('on', on);
          sh.setAttribute('aria-hidden', on ? 'false' : 'true');
          var v = sh.querySelector('video');
          if (v) { if (on && !reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else if (!on) v.pause(); }
        });
      }
      sec.dispatchEvent(new CustomEvent('scrolly:step', { detail: { index: i, key: key } }));
    }
    function measure() {
      var vh = window.innerHeight || 800;
      var mid = vh * 0.55;
      var best = 0;
      for (var k = 0; k < steps.length; k++) {
        var r = steps[k].getBoundingClientRect();
        if (r.top <= mid) best = k;
      }
      setActive(best);
      var rect = sec.getBoundingClientRect();
      var total = rect.height - vh * 0.5;
      var p = total > 0 ? (mid - rect.top) / total : 0;
      p = Math.max(0, Math.min(1, p));
      sec.dispatchEvent(new CustomEvent('scrolly:progress', { detail: { progress: p, steps: steps.length } }));
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; measure(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    sec._measure = measure;
    setActive(0);
    requestAnimationFrame(measure);
  });

  /* ---------- standalone videos: play only while visible ---------- */
  [].slice.call(document.querySelectorAll('video[data-autoplay]')).forEach(function (v) {
    if (reduce) { v.removeAttribute('autoplay'); v.setAttribute('controls', ''); return; }
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
      });
    }, { threshold: 0.25 }).observe(v);
  });

  /* ---------- chart helpers ---------- */
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  function fmtNum(m) {
    if (m >= 1) return Number.isInteger(m) ? String(m) : (m >= 10 ? m.toFixed(1) : m.toFixed(2).replace(/0$/, ''));
    var mm = Math.round(m * 10000) / 10;
    if (mm >= 100 || Number.isInteger(mm)) return String(Math.round(mm));
    return mm.toFixed(1);
  }
  function fmtLen(m) { return fmtNum(m) + (m >= 1 ? ' m' : ' mm'); }
  function fmtRange(a, b) { return (a < 1) === (b < 1) ? fmtNum(a) + '–' + fmtLen(b) : fmtLen(a) + '–' + fmtLen(b); }
  function logScale(d0, d1, r0, r1) {
    var l0 = Math.log10(d0), l1 = Math.log10(d1);
    return function (v) { return r0 + (Math.log10(Math.max(v, d0)) - l0) / (l1 - l0) * (r1 - r0); };
  }
  function makeTip(container) {
    var tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'status');
    container.appendChild(tip);
    return {
      node: tip,
      show: function (html, x, y) {
        tip.innerHTML = html;
        tip.classList.add('on');
        var cw = container.clientWidth;
        var tw = tip.offsetWidth;
        var left = Math.min(Math.max(0, x - tw / 2), Math.max(0, cw - tw));
        tip.style.left = left + 'px';
        tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
      },
      hide: function () { tip.classList.remove('on'); }
    };
  }
  function bindHit(node, tip, html, cx, cy) {
    node.setAttribute('tabindex', '0');
    var show = function () { tip.show(html, cx, cy); };
    node.addEventListener('mouseenter', show);
    node.addEventListener('focus', show);
    node.addEventListener('mouseleave', tip.hide);
    node.addEventListener('blur', tip.hide);
    node.addEventListener('touchstart', show, { passive: true });
  }
  function onResize(container, draw) {
    var last = 0;
    var run = function () {
      var w = container.clientWidth;
      if (w < 120 || Math.abs(w - last) < 2) return;
      last = w;
      draw(w);
    };
    if ('ResizeObserver' in window) new ResizeObserver(run).observe(container);
    else window.addEventListener('resize', run);
    run();
  }

  /* Horizontal log-scale rows. Each row: label, optional note, points [{v, series}] and/or range [lo, hi].
     Values in metres. A shaded band marks the customer tolerance. */
  function logRows(container, cfg) {
    var tipHost = container;
    var tip = makeTip(tipHost);
    onResize(container, function (W) {
      [].slice.call(container.querySelectorAll('svg')).forEach(function (s) { s.remove(); });
      var padL = 4, padR = 18, rowH = cfg.rowH || 58, top = 26, bottom = 30;
      var H = top + cfg.rows.length * rowH + bottom;
      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': cfg.aria });
      container.insertBefore(svg, tip.node);
      var x = logScale(cfg.domain[0], cfg.domain[1], padL, W - padR);
      var plotTop = top - 6, plotBot = H - bottom + 4;
      // band
      if (cfg.band) {
        el('rect', { x: x(cfg.band[0]), y: plotTop, width: x(cfg.band[1]) - x(cfg.band[0]), height: plotBot - plotTop, class: 'band' }, svg);
        var bl = txt(svg, x(cfg.band[0]) + (x(cfg.band[1]) - x(cfg.band[0])) / 2, plotTop - 6, cfg.bandLabel || '', { class: 'band-label', 'text-anchor': 'middle' });
        if (W < 480 && cfg.bandLabelShort) bl.textContent = cfg.bandLabelShort;
      }
      // grid + ticks
      var g = el('g', { class: 'grid' }, svg);
      cfg.ticks.forEach(function (t) {
        el('line', { x1: x(t), x2: x(t), y1: plotTop, y2: plotBot }, g);
        txt(svg, x(t), H - 8, fmtLen(t), { 'text-anchor': t === cfg.ticks[0] ? 'start' : (t === cfg.ticks[cfg.ticks.length - 1] ? 'end' : 'middle') });
      });
      // rows
      cfg.rows.forEach(function (r, i) {
        var y0 = top + i * rowH;
        var ty = y0 + 16, ly = y0 + 36;
        txt(svg, padL, ty, r.label, { class: 't-strong' });
        if (r.tag && W >= 420) {
          var tt = txt(svg, W - padR, ty, r.tag, { 'text-anchor': 'end' });
          tt.setAttribute('fill', r.series === 'field' ? 'var(--soil-3)' : 'var(--teal)');
        }
        el('line', { x1: padL, x2: W - padR, y1: ly, y2: ly, stroke: 'var(--rule)', 'stroke-width': 1 }, svg);
        var col = r.series === 'field' ? 'var(--c-field)' : 'var(--c-sim)';
        if (r.range) {
          var a = x(r.range[0]), b = x(r.range[1]);
          el('rect', { x: a, y: ly - 4, width: Math.max(2, b - a), height: 8, rx: 4, fill: col, opacity: 0.35 }, svg);
          [a, b].forEach(function (px, j) {
            el('circle', { cx: px, cy: ly, r: 5, fill: col, stroke: 'var(--paper)', 'stroke-width': 2 }, svg);
          });
          var hitR = el('rect', { x: a - 12, y: ly - 14, width: b - a + 24, height: 28, class: 'hit' }, svg);
          hitR.setAttribute('aria-label', r.label + ': ' + fmtLen(r.range[0]) + ' to ' + fmtLen(r.range[1]));
          bindHit(hitR, tip, '<b>' + r.label + '</b><br>' + fmtLen(r.range[0]) + ' to ' + fmtLen(r.range[1]) + (r.note ? '<br>' + r.note : ''), (a + b) / 2, ly);
          var rl = txt(svg, b + 9, ly + 4, fmtRange(r.range[0], r.range[1]), { class: 't-ink' });
          if (b > W - 110) { rl.setAttribute('x', a - 9); rl.setAttribute('text-anchor', 'end'); }
        }
        (r.points || []).forEach(function (p) {
          var px = x(p.v), pc = p.series === 'field' ? 'var(--c-field)' : (p.series === 'alt' ? 'var(--ink-3)' : 'var(--c-sim)');
          el('circle', { cx: px, cy: ly, r: 5.5, fill: pc, stroke: 'var(--paper)', 'stroke-width': 2 }, svg);
          var hit = el('circle', { cx: px, cy: ly, r: 14, class: 'hit' }, svg);
          hit.setAttribute('aria-label', r.label + ': ' + fmtLen(p.v));
          bindHit(hit, tip, '<b>' + (p.name || r.label) + '</b><br>' + fmtLen(p.v) + (p.note || r.note ? '<br>' + (p.note || r.note) : ''), px, ly);
          if (p.label !== false) {
            var right = px < W - 90;
            txt(svg, right ? px + 10 : px - 10, ly - 8, p.text || fmtLen(p.v), { class: 't-ink', 'text-anchor': right ? 'start' : 'end' });
          }
        });
      });
    });
  }

  /* Vertical log-scale columns grouped by test. Values in metres; null = no data. */
  function logColumns(container, cfg) {
    var tip = makeTip(container);
    onResize(container, function (Wc) {
      [].slice.call(container.querySelectorAll('svg')).forEach(function (s) { s.remove(); });
      var W = Math.max(Wc, 560);
      var padL = 60, padR = 10, top = 22, plotH = 250, labelBand = 86, groupBand = 26;
      var H = top + plotH + labelBand + groupBand;
      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': cfg.aria, style: 'min-width:560px' });
      container.insertBefore(svg, tip.node);
      var y = logScale(cfg.domain[0], cfg.domain[1], top + plotH, top);
      var base = top + plotH;
      var n = cfg.items.length;
      var gaps = cfg.items.reduce(function (acc, it, i) { return acc + (i > 0 && it.group !== cfg.items[i - 1].group ? 1 : 0); }, 0);
      var slot = (W - padL - padR) / (n + gaps * 0.8);
      var bw = Math.min(24, slot * 0.62);
      // band
      if (cfg.band) {
        el('rect', { x: padL, y: y(cfg.band[1]), width: W - padL - padR, height: y(cfg.band[0]) - y(cfg.band[1]), class: 'band' }, svg);
        if (cfg.bandLabel) txt(svg, W - padR - 4, y(cfg.band[1]) - 5, cfg.bandLabel, { class: 'band-label', 'text-anchor': 'end' });
      }
      var g = el('g', { class: 'grid' }, svg);
      cfg.ticks.forEach(function (t) {
        el('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t) }, g);
        txt(svg, padL - 8, y(t) + 4, fmtLen(t), { 'text-anchor': 'end' });
      });
      if (cfg.refLine) {
        el('line', { x1: padL, x2: W - padR, y1: y(cfg.refLine.v), y2: y(cfg.refLine.v), stroke: 'var(--ink-2)', 'stroke-width': 1 }, svg);
        txt(svg, padL - 8, y(cfg.refLine.v) + 4, cfg.refLine.label, { class: 't-ink', 'text-anchor': 'end' });
      }
      el('line', { x1: padL, x2: W - padR, y1: base, y2: base, stroke: 'var(--rule-2)', 'stroke-width': 1 }, svg);
      var xpos = padL, groups = {};
      cfg.items.forEach(function (it, i) {
        if (i > 0 && it.group !== cfg.items[i - 1].group) xpos += slot * 0.8;
        var cx = xpos + slot / 2;
        xpos += slot;
        (groups[it.group] = groups[it.group] || []).push(cx);
        var lx = cx, ly = base + 10;
        var lab = txt(svg, lx, ly, it.label, { 'text-anchor': 'end', transform: 'rotate(-55 ' + lx + ' ' + ly + ')' });
        if (it.v == null) {
          txt(svg, cx, base - 8, 'no RTK', { 'text-anchor': 'middle', transform: 'rotate(-90 ' + cx + ' ' + (base - 8) + ')' }).setAttribute('text-anchor', 'start');
          return;
        }
        var yt = y(it.v), h = base - yt, r = Math.min(4, bw / 2, h);
        var col = it.weak ? 'var(--soil-1)' : 'var(--c-field)';
        var d = 'M' + (cx - bw / 2) + ',' + base + 'V' + (yt + r) + 'Q' + (cx - bw / 2) + ',' + yt + ' ' + (cx - bw / 2 + r) + ',' + yt +
          'H' + (cx + bw / 2 - r) + 'Q' + (cx + bw / 2) + ',' + yt + ' ' + (cx + bw / 2) + ',' + (yt + r) + 'V' + base + 'Z';
        el('path', { d: d, fill: col, stroke: it.weak ? 'var(--c-field)' : 'none', 'stroke-width': it.weak ? 1 : 0 }, svg);
        txt(svg, cx, yt - 6, (it.v >= 1 ? it.v.toFixed(2) : it.v.toFixed(3)) + (it.weak ? '*' : ''), { 'text-anchor': 'middle', class: 't-ink', 'font-size': '10' });
        var hit = el('rect', { x: cx - slot / 2, y: top, width: slot, height: plotH, class: 'hit' }, svg);
        hit.setAttribute('aria-label', it.label + ': ' + fmtLen(it.v));
        bindHit(hit, tip, '<b>' + it.group + ' · ' + it.label + '</b><br>RMSE ' + fmtLen(it.v) + (it.weak ? '<br>under 50% of samples RTK fixed' : ''), cx, yt);
      });
      Object.keys(groups).forEach(function (k) {
        var xs = groups[k], a = xs[0] - slot / 2 + 2, b = xs[xs.length - 1] + slot / 2 - 2, gy = H - 10;
        el('line', { x1: a, x2: b, y1: gy - 14, y2: gy - 14, stroke: 'var(--ink-3)', 'stroke-width': 1 }, svg);
        txt(svg, (a + b) / 2, gy, k, { 'text-anchor': 'middle', class: 't-ink' });
      });
    });
  }

  window.KR = { logRows: logRows, logColumns: logColumns, fmtLen: fmtLen, svg: el, text: txt, reduce: reduce };
})();
