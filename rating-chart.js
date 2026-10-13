/* US Chess rating history chart (My Journey → Rating History).
   Data: data/uscf-history.json, a snapshot of every rated section from
   ratings.uschess.org. To refresh, replace that file; nothing here changes. */
(function () {
  const root = document.getElementById('rating-chart');
  if (!root) return;

  const SERIES = [
    { key: 'r', name: 'Regular', cls: 'rc-reg' },
    { key: 'q', name: 'Quick', cls: 'rc-quick' },
    { key: 'b', name: 'Blitz', cls: 'rc-blitz' }
  ];
  const GAP_YEARS = 2;          // break the line across longer pauses
  const NS = 'http://www.w3.org/2000/svg';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const svgWrap = root.querySelector('.rc-plot');
  const tip = root.querySelector('.rc-tip');
  const chips = root.querySelectorAll('.rc-chip');
  const moments = document.getElementById('rating-moments');
  const tableBody = document.getElementById('rating-table-body');

  let data = null, rows = [], visible = { r: true, q: false, b: false };
  let geom = null, activeIdx = null;

  const toTime = d => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
  const fmtDate = d => { const [y, m, day] = d.split('-').map(Number); return MONTHS[m - 1] + ' ' + day + ', ' + y; };
  const fmtMonth = d => { const [y, m] = d.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // Previous rating in the same system, for "+22" style changes
  const prevOf = (i, key) => { for (let j = i - 1; j >= 0; j--) if (rows[j][key] != null) return rows[j][key]; return null; };
  const delta = (i, key) => {
    const p = prevOf(i, key), v = rows[i][key];
    if (p == null || v == null) return '';
    const d = v - p;
    return d === 0 ? '±0' : (d > 0 ? '+' + d : '-' + Math.abs(d));
  };

  function render() {
    const W = svgWrap.clientWidth;
    if (!data || W < 50) return;
    const narrow = W < 560;
    const H = narrow ? 300 : 380;
    const m = { t: 18, r: narrow ? 14 : 22, b: 30, l: 42 };
    svgWrap.innerHTML = '';
    const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': 'Line chart of Suhaas Narayanan\'s US Chess ratings from 2009 to 2026. A full table of results follows the chart.' }, svgWrap);
    svg.setAttribute('tabindex', '0');

    // Time scale with one compressed break across the long pause (2019-2023),
    // so the comeback years get real width. The break is drawn and labeled.
    const t0 = toTime('2009-08-01'), t1 = toTime('2026-08-01');
    let A1 = null, B0 = null;
    for (let i = 1; i < rows.length; i++) {
      const a = toTime(rows[i - 1].d), b = toTime(rows[i].d);
      if ((b - a) / 3.156e10 > GAP_YEARS) { A1 = a + 5.2e9; B0 = b - 5.2e9; break; }
    }
    const P = W - m.l - m.r;
    let x;
    if (A1) {
      const G = Math.max(44, P * 0.07), live = P - G;
      const w1 = live * (A1 - t0) / ((A1 - t0) + (t1 - B0));
      x = t => t <= A1 ? m.l + (t - t0) / (A1 - t0) * w1
        : t >= B0 ? m.l + w1 + G + (t - B0) / (t1 - B0) * (live - w1)
        : m.l + w1 + (t - A1) / (B0 - A1) * G;
    } else x = t => m.l + (t - t0) / (t1 - t0) * P;
    let lo = 2300;
    SERIES.forEach(s => { if (visible[s.key]) rows.forEach(r => { if (r[s.key] != null) lo = Math.min(lo, r[s.key]); }); });
    const yMin = Math.floor((lo - 40) / 200) * 200, yMax = 2300;
    const y = v => m.t + (yMax - v) / (yMax - yMin) * (H - m.t - m.b);

    // Pause band (no rated games)
    const g = el('g', {}, svg);
    let gapX = null;
    for (let i = 1; i < rows.length; i++) {
      const a = toTime(rows[i - 1].d), b = toTime(rows[i].d);
      if ((b - a) / 3.156e10 > GAP_YEARS) {
        const xa = x(A1), xb = x(B0), cx = (xa + xb) / 2;
        el('rect', { x: xa, y: m.t, width: xb - xa, height: H - m.t - m.b, class: 'rc-gap' }, g);
        const labels = narrow ? ['No', 'rated', 'games', rows[i - 1].d.slice(0, 4) + '-' + rows[i].d.slice(2, 4)]
                              : ['No rated', 'games', rows[i - 1].d.slice(0, 4) + '-' + rows[i].d.slice(0, 4)];
        labels.forEach((t, k) => {
          const tn = el('text', { x: cx, y: y(yMin) - 22 - (labels.length - 1 - k) * 14, class: 'rc-gap-label', 'text-anchor': 'middle' }, g);
          tn.textContent = t;
        });
        gapX = [xa, xb];
      }
    }

    // Grid and y labels
    for (let v = yMin; v <= 2200; v += 200) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'rc-grid' }, g);
      const tl = el('text', { x: m.l - 8, y: y(v) + 4, class: 'rc-axis', 'text-anchor': 'end' }, g);
      tl.textContent = v;
    }
    // National Master line
    el('line', { x1: m.l, x2: W - m.r, y1: y(2200), y2: y(2200), class: 'rc-nm' }, g);
    const nm = el('text', { x: m.l + 6, y: y(2200) - 6, class: 'rc-nm-label' }, g);
    nm.textContent = 'National Master (2200)';

    // X axis years
    const years = narrow ? [2010, 2014, 2018, 2024, 2026] : [2010, 2012, 2014, 2016, 2018, 2023, 2024, 2025, 2026];
    for (const yr of years) {
      const tt = Date.UTC(yr, 0, 1);
      if (A1 && tt > A1 && tt < B0) continue;
      const tx = x(tt);
      el('line', { x1: tx, x2: tx, y1: H - m.b, y2: H - m.b + 4, class: 'rc-tick' }, g);
      const tl = el('text', { x: tx, y: H - m.b + 18, class: 'rc-axis', 'text-anchor': 'middle' }, g);
      tl.textContent = yr;
    }
    if (gapX) {
      el('line', { x1: m.l, x2: gapX[0], y1: H - m.b, y2: H - m.b, class: 'rc-baseline' }, g);
      el('line', { x1: gapX[1], x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'rc-baseline' }, g);
      gapX.forEach(gx => el('path', { d: `M${gx - 3},${H - m.b + 5} L${gx + 3},${H - m.b - 5}`, class: 'rc-break' }, g));
    } else el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'rc-baseline' }, g);

    // Series lines (drawn back to front so Regular sits on top)
    [...SERIES].reverse().forEach(s => {
      if (!visible[s.key]) return;
      let d = '', last = null;
      rows.forEach(r => {
        if (r[s.key] == null) return;
        const t = toTime(r.d);
        const brk = last == null || (t - last) / 3.156e10 > GAP_YEARS;
        d += (brk ? 'M' : 'L') + x(t).toFixed(1) + ',' + y(r[s.key]).toFixed(1);
        last = t;
      });
      el('path', { d, class: 'rc-line ' + s.cls }, svg);
      if (s.key !== 'r') rows.forEach(r => {
        if (r[s.key] != null) el('circle', { cx: x(toTime(r.d)), cy: y(r[s.key]), r: 2.5, class: 'rc-dot ' + s.cls }, svg);
      });
    });

    // Milestones on the Regular line
    const mg = el('g', {}, svg);
    if (visible.r) data.milestones.forEach((ms, k) => {
      const i = rows.findIndex((r, j) => r.d === ms.d && r.r != null && !rows.slice(j + 1).some(z => z.d === ms.d && z.r != null));
      const cx = x(toTime(ms.d)), cy = y(rows[i].r);
      const mk = el('g', { class: 'rc-ms', 'data-i': i }, mg);
      if (narrow) el('circle', { cx, cy, r: 4.5, class: 'rc-ms-dot' }, mk);
      else {
        el('circle', { cx, cy, r: 9, class: 'rc-ms-dot' }, mk);
        const tn = el('text', { x: cx, y: cy + 3.5, class: 'rc-ms-num', 'text-anchor': 'middle' }, mk);
        tn.textContent = k + 1;
      }
    });

    // Hover layer
    const cross = el('line', { y1: m.t, y2: H - m.b, class: 'rc-cross', visibility: 'hidden' }, svg);
    const hot = el('g', {}, svg);
    const hit = el('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' }, svg);

    geom = { x, y, W, H, m, cross, hot, svg };
    const pick = clientX => {
      const bx = svg.getBoundingClientRect().left;
      const px = clientX - bx;
      let best = null, bd = Infinity;
      rows.forEach((r, i) => {
        if (!SERIES.some(s => visible[s.key] && r[s.key] != null)) return;
        const dd = Math.abs(x(toTime(r.d)) - px);
        if (dd < bd) { bd = dd; best = i; }
      });
      return bd < 40 ? best : null;
    };
    hit.addEventListener('pointermove', e => { const i = pick(e.clientX); i == null ? hide() : show(i); });
    hit.addEventListener('pointerdown', e => { const i = pick(e.clientX); i == null ? hide() : show(i); });
    hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('keydown', e => {
      const vis = rows.map((r, i) => SERIES.some(s => visible[s.key] && r[s.key] != null) ? i : -1).filter(i => i >= 0);
      let p = vis.indexOf(activeIdx);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        p = p < 0 ? vis.length - 1 : Math.max(0, Math.min(vis.length - 1, p + (e.key === 'ArrowRight' ? 1 : -1)));
        show(vis[p]); e.preventDefault();
      } else if (e.key === 'Escape') hide();
    });
    svg.addEventListener('blur', hide);
    if (activeIdx != null) show(activeIdx);
  }

  function show(i) {
    if (!geom) return;
    activeIdx = i;
    const r = rows[i], { x, y, W, cross, hot, m } = geom;
    const cx = x(toTime(r.d));
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    hot.innerHTML = '';
    let topY = Infinity;
    const lines = [];
    SERIES.forEach(s => {
      if (!visible[s.key] || r[s.key] == null) return;
      el('circle', { cx, cy: y(r[s.key]), r: 5, class: 'rc-hot ' + s.cls }, hot);
      topY = Math.min(topY, y(r[s.key]));
      const dl = delta(i, s.key);
      lines.push(`<div class="rc-tip-row"><span class="rc-sw ${s.cls}"></span>${s.name}<b>${r[s.key]}</b>${dl ? `<span class="rc-tip-d">${dl}</span>` : '<span class="rc-tip-d">first</span>'}</div>`);
    });
    const ms = data.milestones.findIndex(z => z.d === r.d);
    tip.innerHTML = `<div class="rc-tip-date">${fmtDate(r.d)}</div><div class="rc-tip-event">${r.e}${r.s ? ' <span>(' + r.s + ')</span>' : ''}</div>${lines.join('')}${ms >= 0 && visible.r ? `<div class="rc-tip-ms">${ms + 1}. ${data.milestones[ms].label}</div>` : ''}`;
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = cx + 14; if (left + tw > W - 4) left = cx - tw - 14; left = Math.max(4, left);
    let top = topY - th - 12; if (top < 0) top = Math.min(topY + 14, geom.H - th - m.b);
    tip.style.left = left + 'px'; tip.style.top = (top + svgWrap.offsetTop) + 'px';
  }
  function hide() {
    activeIdx = null;
    if (!geom) return;
    geom.cross.setAttribute('visibility', 'hidden');
    geom.hot.innerHTML = '';
    tip.hidden = true;
  }

  function buildExtras() {
    // Key moments list
    if (moments) moments.innerHTML = data.milestones.map((ms, k) => {
      const i = rows.findIndex((r, j) => r.d === ms.d && r.r != null && !rows.slice(j + 1).some(z => z.d === ms.d && z.r != null));
      const r = rows[i], dl = delta(i, 'r');
      return `<li><button type="button" data-i="${i}"><span class="rc-num">${k + 1}</span><span class="rc-m-text"><strong>${ms.label}</strong> <span class="rc-m-meta">${fmtMonth(r.d)} · ${r.e} · ${r.r}${dl && k > 0 ? ' (' + dl + ')' : ''}</span></span></button></li>`;
    }).join('');
    moments && moments.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      if (!visible.r) { visible.r = true; syncChips(); render(); }
      show(+b.dataset.i);
      svgWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    // Full table, newest first
    if (tableBody) tableBody.innerHTML = rows.map((r, i) => i).reverse().map(i => {
      const r = rows[i];
      const c = k => r[k] == null ? '<td class="rc-na">-</td>' : `<td>${r[k]}<span class="rc-td-d">${delta(i, k) || ''}</span></td>`;
      return `<tr><td class="rc-nowrap">${r.d}</td><td>${r.e}</td><td>${r.s}</td>${c('r')}${c('q')}${c('b')}</tr>`;
    }).join('');
    const cnt = document.getElementById('rating-table-count');
    if (cnt) cnt.textContent = rows.length;
  }

  function syncChips() {
    chips.forEach(c => c.setAttribute('aria-pressed', String(!!visible[c.dataset.key])));
  }
  chips.forEach(c => c.addEventListener('click', () => {
    const k = c.dataset.key;
    if (visible[k] && Object.values(visible).filter(Boolean).length === 1) return; // keep at least one
    visible[k] = !visible[k];
    syncChips(); render();
  }));

  fetch(root.dataset.src || 'data/uscf-history.json')
    .then(r => r.json())
    .then(j => {
      data = j; rows = j.rows;
      buildExtras(); syncChips(); render();
      if ('ResizeObserver' in window) new ResizeObserver(() => render()).observe(svgWrap);
      else window.addEventListener('resize', render);
    })
    .catch(() => { svgWrap.innerHTML = '<p class="rc-error">The rating chart couldn\'t load. See my full history on <a href="https://ratings.uschess.org/player/14290675">US Chess</a>.</p>'; });
})();
