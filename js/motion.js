/* motion.js — intro sequence, testimonial expand, pricing carousel,
   scroll progress + condensed nav. No libraries. */
(function () {
  var root = document.documentElement;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Intro sequence ---------- */
  (function intro() {
    var el = document.getElementById('intro');
    if (!el) return;

    // The head guard already decided whether this plays (once per session,
    // never for reduced-motion). Respect that decision rather than re-deriving it.
    if (!root.classList.contains('intro-armed')) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.classList.add('leaving');
      root.classList.remove('intro-armed');
      root.classList.add('intro-done');
      // remove from the DOM after the exit transition
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1000);
    }

    var timer = setTimeout(finish, 2750);

    var skip = el.querySelector('.intro-skip');
    if (skip) skip.addEventListener('click', function () { clearTimeout(timer); finish(); });
    el.addEventListener('click', function (e) {
      if (e.target === skip) return;
      clearTimeout(timer); finish();
    });
    document.addEventListener('keydown', function (e) {
      if (!finished && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
        clearTimeout(timer); finish();
      }
    });
    // Safety net: if anything above throws, never trap the visitor.
    window.addEventListener('load', function () { setTimeout(finish, 3200); });
  })();

  /* ---------- 2. Testimonials ---------- */
  (function testimonials() {
    var toggles = document.querySelectorAll('.t-toggle');
    if (!toggles.length) return;
    Array.prototype.forEach.call(toggles, function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      panel.removeAttribute('hidden');     // CSS collapses it from here
      var label = btn.querySelector('.t-toggle-label');
      btn.addEventListener('click', function () {
        var open = panel.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (label) label.textContent = open ? 'Show less' : 'Read the full recommendation';
      });
    });
  })();

  /* ---------- 3. Pricing carousel (mobile) ---------- */
  (function pricing() {
    var track = document.querySelector('.pkgs');
    if (!track) return;
    var cards = [].slice.call(track.querySelectorAll('.pkg'));
    if (cards.length < 2) return;

    var hint = document.querySelector('.pkg-hint');
    var dots = document.querySelector('.pkg-dots');

    if (dots) {
      cards.forEach(function (card, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Go to package ' + (i + 1));
        if (i === 0) b.className = 'active';
        b.addEventListener('click', function () {
          track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: calm ? 'auto' : 'smooth' });
        });
        dots.appendChild(b);
      });
    }

    // Baseline is set after the initial programmatic scroll, so positioning
    // the carousel on the featured card doesn't count as a user swipe.
    var hinted = false, baseline = 0;
    function sync() {
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      cards.forEach(function (c, i) {
        var d = Math.abs((c.offsetLeft - track.offsetLeft) + c.offsetWidth / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (dots) {
        Array.prototype.forEach.call(dots.children, function (b, i) {
          b.classList.toggle('active', i === best);
        });
      }
      if (!hinted && hint && Math.abs(track.scrollLeft - baseline) > 24) {
        hinted = true; hint.classList.add('hide');
      }
    }

    var raf;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; sync(); });
    }, { passive: true });

    // Start on the featured card so the recommended package leads.
    var featured = track.querySelector('.pkg.featured');
    if (featured && window.matchMedia('(max-width: 760px)').matches) {
      track.scrollLeft = featured.offsetLeft - track.offsetLeft
        - (track.clientWidth - featured.offsetWidth) / 2;
    }
    baseline = track.scrollLeft;
    sync();

    // Re-baseline on resize/orientation change so the hint logic stays honest.
    window.addEventListener('resize', function () {
      if (!hinted) baseline = track.scrollLeft;
    }, { passive: true });
  })();

  /* ---------- 4. Scroll progress + condensed nav ---------- */
  (function scrollFx() {
    if (calm) return;
    var bar = document.querySelector('.scroll-bar');
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      }
      root.classList.toggle('nav-condensed', y > 80);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  })();
})();
