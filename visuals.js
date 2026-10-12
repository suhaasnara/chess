/* Data-driven visuals: "Road to 2200" (Final Push) and the opening map
   (Opening Study). Plain SVG, no libraries. Styles: .rd-* and .om-* rules. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const toTime = d => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
  const fmtDate = d => { const [y, m, day] = d.split('-').map(Number); return MONTHS[m - 1] + ' ' + day + ', ' + y; };
  const observe = (node, fn) => {
    if ('ResizeObserver' in window) new ResizeObserver(fn).observe(node);
    else window.addEventListener('resize', fn);
  };

  /* ── ROAD TO 2200 ── */
  const road = document.getElementById('road-chart');
  if (road) {
    const plot = road.querySelector('.rd-plot');
    const tip = road.querySelector('.rd-tip');
    const keyList = road.querySelector('.rd-key');
    const FROM = '2024-05-01', TO = '2025-10-31';
    // Story beats from Chapter 3. Dates match US Chess events.
    const BEATS = [
      { d: '2024-07-13', t: 'Peak: 2146', pos: 'above' },
      { d: '2024-10-12', t: 'Penn Fall Swiss: the slide starts', pos: 'below' },
      { d: '2025-01-20', t: 'Liberty Bell: low of 2084', pos: 'below' },
      { d: '2025-05-18', t: 'Shaking off the rust', pos: 'above', anchor: 'end' },
      { d: '2025-06-29', t: 'Philly Open, +22', pos: 'below', anchor: 'start' },
      { d: '2025-08-23', t: 'Denver, +22', pos: 'below', anchor: 'start' },
      { d: '2025-10-18', t: 'National Master: 2203', pos: 'above', anchor: 'end' }
    ];
    let rows = [], geom = null;

    const render = () => {
      const W = plot.clientWidth;
      if (!rows.length || W < 50) return;
      const narrow = W < 600;
      const H = narrow ? 260 : 330;
      const m = { t: narrow ? 20 : 44, r: narrow ? 12 : 24, b: 28, l: 42 };
      plot.innerHTML = '';
      const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
        'aria-label': 'Line chart of my regular rating from May 2024 to October 2025: a peak of 2146, a slide to 2084, then a climb to 2203 and the National Master title.' }, plot);
      const t0 = toTime(FROM), t1 = toTime(TO);
      const x = t => m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r);
      const yMin = 2050, yMax = 2250;
      const y = v => m.t + (yMax - v) / (yMax - yMin) * (H - m.t - m.b);

      const g = el('g', {}, svg);
      for (let v = yMin; v <= yMax; v += 50) {
        el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'rd-grid' }, g);
        el('text', { x: m.l - 8, y: y(v) + 4, class: 'rd-axis', 'text-anchor': 'end' }, g).textContent = v;
      }
      el('line', { x1: m.l, x2: W - m.r, y1: y(2200), y2: y(2200), class: 'rd-nm' }, g);
      el('text', { x: m.l + 6, y: y(2200) - 6, class: 'rd-nm-label' }, g).textContent = 'National Master (2200)';
      // Months: every 3 (desktop) or 6 (phone)
      for (let yr = 2024; yr <= 2025; yr++) for (let mo = 0; mo < 12; mo += (narrow ? 6 : 3)) {
        const tt = Date.UTC(yr, mo, 1); if (tt < t0 || tt > t1) continue;
        const tx = x(tt);
        el('line', { x1: tx, x2: tx, y1: H - m.b, y2: H - m.b + 4, class: 'rd-tick' }, g);
        el('text', { x: tx, y: H - m.b + 18, class: 'rd-axis', 'text-anchor': 'middle' }, g).textContent = MONTHS[mo] + ' ' + String(yr).slice(2);
      }
      el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'rd-baseline' }, g);

      // Area + line
      const pts = rows.map(r => [x(toTime(r.d)), y(r.r)]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
      const defs = el('defs', {}, svg);
      const grad = el('linearGradient', { id: 'rdFill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': '#2563b8', 'stop-opacity': 0.16 }, grad);
      el('stop', { offset: '100%', 'stop-color': '#2563b8', 'stop-opacity': 0 }, grad);
      el('path', { d: line + `L${pts[pts.length - 1][0].toFixed(1)},${H - m.b}L${pts[0][0].toFixed(1)},${H - m.b}Z`, fill: 'url(#rdFill)' }, svg);
      el('path', { d: line, class: 'rd-line' }, svg);

      // Story beats
      const bg = el('g', {}, svg);
      BEATS.forEach((b, k) => {
        const i = rows.map(r => r.d).lastIndexOf(b.d);
        if (i < 0) return;
        const cx = x(toTime(b.d)), cy = y(rows[i].r);
        el('circle', { cx, cy, r: narrow ? 7 : 4.5, class: 'rd-beat' }, bg);
        if (narrow) {
          el('text', { x: cx, y: cy + 3.5, class: 'rd-beat-num', 'text-anchor': 'middle' }, bg).textContent = k + 1;
        } else {
          const up = b.pos === 'above';
          const ly = up ? cy - 14 : cy + 22;
          el('line', { x1: cx, x2: cx, y1: up ? cy - 6 : cy + 6, y2: up ? cy - 11 : cy + 11, class: 'rd-leader' }, bg);
          const anchor = b.anchor || (cx > W - 150 ? 'end' : cx < m.l + 90 ? 'start' : 'middle');
          el('text', { x: anchor === 'end' ? cx + 6 : anchor === 'start' ? cx - 6 : cx, y: ly, class: 'rd-beat-label', 'text-anchor': anchor }, bg).textContent = b.t;
        }
      });

      // Hover
      const cross = el('line', { y1: m.t, y2: H - m.b, class: 'rd-cross', visibility: 'hidden' }, svg);
      const dot = el('circle', { r: 5, class: 'rd-hot', visibility: 'hidden' }, svg);
      const hit = el('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' }, svg);
      const show = i => {
        const r = rows[i], cx = x(toTime(r.d)), cy = y(r.r);
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
        const d = r.prev == null ? '' : (r.r - r.prev > 0 ? '+' : r.r - r.prev < 0 ? '−' : '±') + Math.abs(r.r - r.prev);
        tip.innerHTML = `<div class="rc-tip-date">${fmtDate(r.d)}</div><div class="rc-tip-event">${r.e} <span>(${r.s})</span></div><div class="rc-tip-row"><span class="rc-sw rc-reg"></span>Regular<b>${r.r}</b><span class="rc-tip-d">${d}</span></div>`;
        tip.hidden = false;
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = cx + 14; if (left + tw > W - 4) left = cx - tw - 14; left = Math.max(4, left);
        let top = cy - th - 12; if (top < 0) top = Math.min(cy + 14, H - th - m.b);
        tip.style.left = left + 'px'; tip.style.top = (top + plot.offsetTop) + 'px';
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
      const pick = cX => {
        const px = cX - svg.getBoundingClientRect().left;
        let best = 0, bd = Infinity;
        rows.forEach((r, i) => { const dd = Math.abs(x(toTime(r.d)) - px); if (dd < bd) { bd = dd; best = i; } });
        return best;
      };
      hit.addEventListener('pointermove', e => show(pick(e.clientX)));
      hit.addEventListener('pointerdown', e => show(pick(e.clientX)));
      hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
      geom = { show };
      if (keyList) keyList.hidden = !narrow;
    };

    fetch(road.dataset.src || 'data/uscf-history.json')
      .then(r => r.json())
      .then(j => {
        let prev = null;
        j.rows.forEach(r => {
          if (r.r == null) return;
          if (r.d >= FROM && r.d <= TO) rows.push(Object.assign({}, r, { prev }));
          prev = r.r;
        });
        if (keyList) keyList.innerHTML = BEATS.map((b, k) => `<li><span class="rc-num">${k + 1}</span>${b.t}</li>`).join('');
        render();
        observe(plot, render);
      })
      .catch(() => { road.hidden = true; });
  }

  /* ── OPENING MAP ── */
  const map = document.getElementById('opening-map');
  if (map) {
    // x: 0 = closed, 1 = open. y: 0 = positional, 1 = sharp. Rough placements.
    const OPENINGS = [
      { n: "King's Indian", x: 0.16, y: 0.86 },
      { n: 'French', x: 0.22, y: 0.52 },
      { n: 'London System', x: 0.1, y: 0.1 },
      { n: "Queen's Gambit Declined", x: 0.33, y: 0.2, mine: true },
      { n: 'Nimzo-Indian', x: 0.43, y: 0.44, mine: true },
      { n: 'Catalan', x: 0.56, y: 0.12 },
      { n: 'Caro-Kann', x: 0.3, y: 0.34 },
      { n: 'Ruy Lopez', x: 0.6, y: 0.34 },
      { n: 'Italian', x: 0.76, y: 0.24 },
      { n: 'Najdorf Sicilian', x: 0.66, y: 0.86 },
      { n: 'Grünfeld', x: 0.84, y: 0.66 },
      { n: 'Smith-Morra Gambit', x: 0.88, y: 0.93 }
    ];
    const area = map.querySelector('.om-area');
    OPENINGS.forEach(o => {
      const d = document.createElement('div');
      d.className = 'om-pt' + (o.mine ? ' om-mine' : '') + (o.x > 0.7 ? ' om-left' : '');
      d.style.left = (o.x * 100) + '%';
      d.style.bottom = (o.y * 100) + '%';
      d.innerHTML = '<span class="om-dot"></span><span class="om-name">' + o.n + '</span>';
      area.appendChild(d);
    });
  }
})();
