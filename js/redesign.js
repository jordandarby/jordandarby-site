// Redesign extras: work-grid category filters + lightbox
(function () {
  // Category filter
  var filters = document.querySelector('.work-filters');
  var items = [].slice.call(document.querySelectorAll('.grid a[data-cat]'));
  if (filters && items.length) {
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var f = btn.getAttribute('data-filter');
      filters.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
      items.forEach(function (a) {
        a.classList.toggle('hide', f !== 'all' && a.getAttribute('data-cat') !== f);
      });
    });
  }

  // Lightbox for work images
  var box = document.querySelector('.lightbox');
  if (box) {
    var img = box.querySelector('img');
    var cap = box.querySelector('.lb-cap');
    var open = function (src, title, cat, note) {
      img.src = src;
      cap.innerHTML = '';
      if (title) {
        cap.appendChild(document.createTextNode(title + (cat ? ' · ' + cat : '')));
        if (note) {
          var em = document.createElement('em');
          em.textContent = ' · ' + note;
          cap.appendChild(em);
        }
      }
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
    };
    var close = function () {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      img.src = '';
    };
    document.querySelectorAll('.grid a[href$=".webp"], .hero-showcase a[href$=".webp"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        open(a.getAttribute('href'), a.getAttribute('data-title'), a.getAttribute('data-cat'), a.getAttribute('data-note'));
      });
    });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) close();
    });
  }
})();
