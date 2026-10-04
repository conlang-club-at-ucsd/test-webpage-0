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
    var term = q.value.trim().toLowerCase(), shown = 0;
    items.forEach(function (li) {
      var ok = (!term || li.dataset.t.indexOf(term) > -1 || li.dataset.e.indexOf(term) > -1) &&
               (!pos.value || li.dataset.pos === pos.value) &&
               (!cat.value || ('|' + li.dataset.cat + '|').indexOf('|' + cat.value + '|') > -1);
      li.hidden = !ok;
      if (ok) shown++;
    });
    count.textContent = shown === items.length ? items.length + ' entries' : shown + ' of ' + items.length + ' entries';
  }
  [q, pos, cat].forEach(function (el) { el.addEventListener('input', apply); });
})();
