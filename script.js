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

    summary.addEventListener('click', function (e) {
      if (prefersReduced.matches) return;
      if (typeof content.animate !== 'function') return;
      e.preventDefault();
      if (details.dataset.animating === 'true') return;

      var isOpen = details.open;

      if (isOpen) {
        var startHeight = content.offsetHeight;
        content.style.overflow = 'hidden';
        details.dataset.animating = 'true';
        var anim = content.animate(
          [
            { height: startHeight + 'px', opacity: 1 },
            { height: '0px', opacity: 0 }
          ],
          { duration: 300, easing: 'ease' }
        );
        anim.onfinish = function () {
          details.removeAttribute('open');
          content.style.overflow = '';
          content.style.height = '';
          content.style.opacity = '';
          details.dataset.animating = 'false';
        };
        anim.oncancel = function () {
          details.dataset.animating = 'false';
        };
      } else {
        details.setAttribute('open', '');
        var endHeight = content.scrollHeight;
        content.style.overflow = 'hidden';
        details.dataset.animating = 'true';
        var anim2 = content.animate(
          [
            { height: '0px', opacity: 0 },
            { height: endHeight + 'px', opacity: 1 }
          ],
          { duration: 340, easing: 'ease' }
        );
        anim2.onfinish = function () {
          content.style.overflow = '';
          content.style.height = '';
          content.style.opacity = '';
          details.dataset.animating = 'false';
        };
        anim2.oncancel = function () {
          details.dataset.animating = 'false';
        };
      }
    });
  });
});
