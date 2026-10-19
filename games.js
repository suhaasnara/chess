/* Game boards, drawn on this site instead of embedded from lichess.org.
 *
 * Any element with data-game="<chapter id>" becomes an interactive board for
 * that chapter of the Lichess study "My 60". The moves and my notes come from
 * data/games/<chapter id>.pgn (saved daily from Lichess by
 * .github/workflows/update-games.yml), and the board is Lichess's own
 * open-source viewer (vendor/lpv/), so it looks and works like the Lichess embed
 * but never depends on the visitor reaching lichess.org.
 *
 * Home page tabs: a .game-tab button with data-game switches the board in
 * #game-viewer.
 */
(function () {
  'use strict';
  var STUDY = 'https://lichess.org/study/oAqAo3ZN/';
  var base = new URL('.', document.currentScript.src); // the /chess/ folder
  var VIEWER = new URL('vendor/lpv/lichess-pgn-viewer.min.js?v=2.7.3', base).href;

  var viewerPromise = null;
  function loadViewer() {
    if (!viewerPromise) {
      viewerPromise = import(VIEWER).then(function (m) { return m.default; });
      viewerPromise.catch(function () { viewerPromise = null; }); // allow a retry
    }
    return viewerPromise;
  }

  var pgnCache = {};
  function loadPgn(ch) {
    if (!pgnCache[ch]) {
      pgnCache[ch] = fetch(new URL('data/games/' + ch + '.pgn', base).href)
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });
      pgnCache[ch].catch(function () { delete pgnCache[ch]; });
    }
    return pgnCache[ch];
  }

  function message(box, ch, text) {
    box.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'game-msg';
    p.textContent = text + ' ';
    var a = document.createElement('a');
    a.href = STUDY + ch;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Open this game on Lichess';
    p.appendChild(a);
    box.appendChild(p);
  }

  function render(box) {
    var ch = box.getAttribute('data-game');
    if (!ch) return;
    box.setAttribute('data-rendered', ch);
    box.setAttribute('aria-busy', 'true');
    if (!box.querySelector('.lpv')) message(box, ch, 'Loading the board...');
    Promise.all([loadViewer(), loadPgn(ch)]).then(function (res) {
      if (box.getAttribute('data-game') !== ch) return; // another game was picked meanwhile
      var mount = document.createElement('div');
      box.innerHTML = '';
      box.appendChild(mount);
      res[0](mount, {
        pgn: res[1],
        showMoves: 'auto',
        scrollToMove: false,   // let the mouse wheel scroll the page, not the moves
        keyboardToMove: true,
        menu: { getPgn: { enabled: false } },
        lichess: 'https://lichess.org',
        classes: 'lpv--site'
      });
      box.removeAttribute('aria-busy');
    }).catch(function () {
      if (box.getAttribute('data-game') !== ch) return;
      box.removeAttribute('aria-busy');
      box.removeAttribute('data-rendered');
      message(box, ch, "The board didn't load.");
    });
  }

  // Draw boards only when they come near the screen (and once their tab is shown).
  var boxes = document.querySelectorAll('[data-game]:not(button)');
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && e.target.getAttribute('data-rendered') !== e.target.getAttribute('data-game')) {
        render(e.target);
      }
    });
  }, { rootMargin: '400px 0px' }) : null;
  boxes.forEach(function (b) { io ? io.observe(b) : render(b); });

  // Home page game picker
  var viewer = document.getElementById('game-viewer');
  var tabs = document.querySelectorAll('.game-tab[data-game]');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      if (!viewer) return;
      var ch = btn.getAttribute('data-game');
      viewer.setAttribute('data-game', ch);
      var link = document.getElementById('game-viewer-link');
      if (link) link.href = STUDY + ch;
      render(viewer);
    });
  });

  // Warm up the viewer code early on pages that have a board.
  if (boxes.length) {
    var warm = function () { loadViewer().catch(function () {}); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
    else setTimeout(warm, 1500);
  }
})();
