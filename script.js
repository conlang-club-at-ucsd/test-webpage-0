// canonical layout lives on the main site; subdomains fetch it cross-origin.
// GitHub Pages serves `Access-Control-Allow-Origin: *`, so this works on a
// completely static setup with no server config. local copy is fallback only.
var LAYOUT_URLS = [
  'https://conlangatucsd.com/partials/layout.html',
  '/partials/layout.html'
];

// i hate regex (normalizes /about, about, or about/ (this is an example))
function normalizePath(path) {
  return path.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
}

function loadIncludes() {
  var slots = document.querySelectorAll('[data-include]');
  if (!slots.length) return Promise.resolve();

  function tryFetch(i) {
    if (i >= LAYOUT_URLS.length) {
      throw new Error('all layout URLs failed: ' + LAYOUT_URLS.join(', '));
    }
    return fetch(LAYOUT_URLS[i], { mode: 'cors' })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        return res.text();
      })
      .then(function (html) {
        return { html: html, url: LAYOUT_URLS[i] };
      })
      .catch(function (err) {
        if (i + 1 < LAYOUT_URLS.length) return tryFetch(i + 1);
        throw err;
      });
  }

  return tryFetch(0)
    .then(function (result) {
      var html = result.html;
      var usedUrl = result.url;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      slots.forEach(function (slot) {
        var name = slot.getAttribute('data-include');
        var tpl = doc.getElementById(name);
        if (!tpl) {
          console.warn('[includes] No <template id="' + name + '"> in ' + usedUrl);
          return;
        }
        slot.replaceWith(document.importNode(tpl.content, true));
      });

      // highlights the nav link that's currently selected.
      // only same-origin links are considered, so subdomains using the
      // canonical main-site layout correctly get no highlight.
      var here = normalizePath(location.pathname);
      document.querySelectorAll('.nav-links a[href]').forEach(function (a) {
        var url;
        try {
          url = new URL(a.getAttribute('href'), location.href);
        } catch (err) {
          return;
        }
        if (url.origin !== location.origin) return;
        if (normalizePath(url.pathname) === here) {
          a.setAttribute('aria-current', 'page');
        }
      });
    })
    .catch(function (err) {
      console.error('[includes] Could not load ' + LAYOUT_URLS.join(' or ') + ':', err,);
    });
}

function initSite() {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  var faqs = document.querySelectorAll('.faq-item');
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  faqs.forEach(function (details) {
    var summary = details.querySelector('summary');
    var content = details.querySelector('.faq-answer');
    if (!summary || !content) return;

    var currentAnim = null;

    function cleanup() {
      content.style.overflow = '';
      content.style.height = '';
      content.style.opacity = '';
      content.style.paddingTop = '';
      content.style.paddingBottom = '';
      content.style.borderTopWidth = '';
      details.dataset.animating = 'false';
      currentAnim = null;
    }

    summary.addEventListener('click', function (e) {
      if (prefersReduced.matches) return;
      if (typeof content.animate !== 'function') return;
      e.preventDefault();

      if (currentAnim) {
        try { currentAnim.cancel(); } catch (err) {}
      }

      var isOpen = details.open;
      var cs = window.getComputedStyle(content);
      var padTop = cs.paddingTop;
      var padBottom = cs.paddingBottom;
      var borderTop = cs.borderTopWidth;

      details.dataset.animating = 'true';

      if (isOpen) {
        var startHeight = content.offsetHeight;
        content.style.overflow = 'hidden';
        content.style.height = startHeight + 'px';
        void content.offsetHeight;

        currentAnim = content.animate(
          [
            { height: startHeight + 'px', opacity: 1, paddingTop: padTop, paddingBottom: padBottom, borderTopWidth: borderTop },
            { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' }
          ],
          { duration: 280, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
        );
        currentAnim.onfinish = function () {
          try { currentAnim.commitStyles(); } catch (err) {}
          try { currentAnim.cancel(); } catch (err) {}
          details.removeAttribute('open');
          cleanup();
        };
        currentAnim.oncancel = function () {
          try { currentAnim.commitStyles(); } catch (err) {}
          cleanup();
        };
      } else {
        details.setAttribute('open', '');
        var endHeight = content.offsetHeight;
        content.style.overflow = 'hidden';
        content.style.height = '0px';
        content.style.opacity = '0';
        content.style.paddingTop = '0px';
        content.style.paddingBottom = '0px';
        content.style.borderTopWidth = '0px';
        void content.offsetHeight;

        currentAnim = content.animate(
          [
            { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' },
            { height: endHeight + 'px', opacity: 1, paddingTop: padTop, paddingBottom: padBottom, borderTopWidth: borderTop }
          ],
          { duration: 320, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' }
        );
        currentAnim.onfinish = function () {
          try { currentAnim.commitStyles(); } catch (err) {}
          try { currentAnim.cancel(); } catch (err) {}
          cleanup();
        };
        currentAnim.oncancel = function () {
          try { currentAnim.commitStyles(); } catch (err) {}
          cleanup();
        };
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // initSite must run even if the header/footer fetch fails, so the page
  // still gets the year, mobile toggle (when header loaded), and FAQ animation.
  // when fetch fails, the static fallback markup inside [data-include] stays.
  try {
    loadIncludes().then(initSite, initSite);
  } catch (err) {
    console.error('[includes] Unexpected error:', err);
    initSite();
  }
});
