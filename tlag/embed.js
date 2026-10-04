// shared by parent index and embedded pages
(function () {
  var inFrame = window.parent !== window;

  // how tall is iframe? (anti scrollbar measures)
  if (inFrame) {
    var post = function () {
      parent.postMessage({ type: 'tlag-embed-height', height: document.body.offsetHeight }, location.origin);
    };
    window.addEventListener('load', post);
    if (window.ResizeObserver) new ResizeObserver(post).observe(document.body);
  } else {
    document.documentElement.classList.add('is-standalone');
  }

  // parent page: resize any iframe marked data-autoheight
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'tlag-embed-height') return;
    document.querySelectorAll('iframe[data-autoheight]').forEach(function (f) {
      if (f.contentWindow === e.source) f.style.height = e.data.height + 'px';
    });
  });

  // gloss page: tabs
  var tabs = document.querySelectorAll('.tabs button');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-selected', on);
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });

  // gloss page: dictionary search + filters
  var list = document.getElementById('entries');
  if (!list) return;
  var items = Array.prototype.slice.call(list.children);
  var q = document.getElementById('q'), pos = document.getElementById('pos'), cat = document.getElementById('cat');
  var count = document.getElementById('count');
  function apply() {
    var term = q.value.trim().toLowerCase(), shown = 0, first = null;
    items.forEach(function (li) {
      var ok = (!term || li.dataset.t.indexOf(term) > -1 || li.dataset.e.indexOf(term) > -1) &&
               (!pos.value || li.dataset.pos === pos.value) &&
               (!cat.value || ('|' + li.dataset.cat + '|').indexOf('|' + cat.value + '|') > -1);
      li.hidden = !ok;
      if (ok) { shown++; if (!first) first = li; }
    });
    count.textContent = shown === items.length ? items.length + ' entries' : shown + ' of ' + items.length + ' entries';
    return first;
  }
  [q, pos, cat].forEach(function (el) { el.addEventListener('input', apply); });

  // deep link from word-of-the-day: gloss/?w=<tlag word> filters to that word
  try {
    var w = new URLSearchParams(location.search).get('w');
    if (w) {
      document.querySelectorAll('.tabs button').forEach(function (b) {
        var on = b.getAttribute('aria-controls') === 'p-dict';
        b.setAttribute('aria-selected', on);
        document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
      });
      q.value = w;
      var hit = apply();
      // prefer the exact word over a mere substring match
      var term = q.value.trim().toLowerCase();
      items.forEach(function (li) {
        if (!li.hidden && li.dataset.t === term) hit = li;
      });
      if (hit) {
        hit.scrollIntoView({ block: 'center' });
        hit.classList.add('entry--flash');
        setTimeout(function () { hit.classList.remove('entry--flash'); }, 2400);
      }
    }
  } catch (err) {
    /* URLSearchParams unsupported: ignore deep link */
  }
})();
