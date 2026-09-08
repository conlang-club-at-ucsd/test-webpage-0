document.addEventListener('DOMContentLoaded', function () {
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
});
