// Subtle scroll-reveal + mobile nav — no libraries, ~1 KB
(function () {
  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (e.target.__shown) { io.unobserve(e.target); return; }
          playReveal(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // Anything already on screen was never "revealed" — it was just there.
    // Fading it in is what makes a reload look like it glitches. The sweep
    // runs after the browser has applied hash / restored scroll, otherwise
    // everything still measures as below the fold and gets a fade anyway.
    function showNow(el) {
      if (el.__shown) return;
      el.__shown = true;
      io.unobserve(el);
      el.style.transition = 'none';
      el.classList.add('in', 'settled');
      // Clear any inline hidden state a replay left on the element. Without
      // this an element could end up carrying `in` while still pinned at
      // opacity 0 by that inline style — visible to the code, invisible on
      // screen, which is the worst of both.
      el.style.opacity = '';
      el.style.transform = '';
      void el.offsetHeight;               // flush before restoring transitions
      el.style.transition = '';
    }
    function sweep() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      reveals.forEach(function (el) {
        if (el.__shown) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) showNow(el);
      });
    }

    // Observe first so nothing is missed, then sweep once layout has settled.
    reveals.forEach(function (el) { io.observe(el); });

    // A fixed number of frames isn't enough: iOS restores the scroll position
    // after `load`, so a sweep timed to either one still measures everything as
    // below the fold and the restored view fades in — which is what a refresh
    // looks like glitching. Watch the scroll position instead of guessing at
    // the timing, and re-sweep whenever it moves during the first second.
    var lastY = -1, until = 0, watching = false;
    function watch() {
      if (window.pageYOffset !== lastY) { lastY = window.pageYOffset; sweep(); }
      if (performance.now() < until) requestAnimationFrame(watch);
      else watching = false;
    }
    function startWatch() {
      // Sweep straight away as well: rAF is suspended in a background tab, so
      // the watcher alone would leave a page loaded there fully faded out.
      sweep();
      // And on timers, because the frame loop is throttled or suspended exactly
      // when it is needed most — a slow phone restoring a mid-page scroll. A
      // block that lands on screen after the last sweep would otherwise sit
      // invisible until touched, which is the glitch this whole sweep exists
      // to prevent. Sweeping twice costs nothing: it is guarded per element.
      [120, 300, 600, 1000].forEach(function (t) { setTimeout(sweep, t); });
      until = performance.now() + 1200;
      if (!watching) { watching = true; requestAnimationFrame(watch); }
    }
    startWatch();
    window.addEventListener('load', startWatch);
    // bfcache restores keep their painted state, so they only need a sweep.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) sweep(); else startWatch();
    });

    /* ---- Replay a section's motion when it is navigated to ----
       Reveal normally fires once. Jump to a section you have already scrolled
       past and you arrive at something visibly finished, which reads as the
       link having done nothing. Pressing a link resets that section so its
       motion runs again on arrival. */
    /* One reveal path, used by the observer and by the guard.

       A replayed element is animated explicitly rather than left to the CSS
       transition. Relying on the transition meant depending on the browser
       noticing a change between two style recalculations, and measurement
       showed it firing for transform while silently skipping opacity — so a
       replayed section shifted 26px without ever fading, which is far too
       subtle to read as motion. An explicit animation states both ends
       outright and cannot be optimised away. */
    function playReveal(el) {
      if (el.classList.contains('in')) return;
      var replayed = el.__replay;
      el.__replay = false;
      el.style.transition = '';
      el.style.opacity = '';
      el.style.transform = '';
      el.classList.add('in');
      if (replayed && el.animate) {
        try {
          el.animate(
            [{ opacity: 0, transform: 'translateY(26px)' },
             { opacity: 1, transform: 'none' }],
            { duration: 700, easing: 'ease' }
          );
        } catch (_) {}
      }
      clearTimeout(el.__settle);
      el.__settle = setTimeout(function () { el.classList.add('settled'); }, 1150);
    }
    function revealNow(el) { playReveal(el); }
    function replay(root) {
      // Nothing to replay when motion is turned off, and the hidden state below
      // would fight the reduced-motion rule that keeps `.reveal` visible.
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var list = [];
      if (root.classList && root.classList.contains('reveal')) list.push(root);
      Array.prototype.push.apply(list, root.querySelectorAll('.reveal'));
      if (!list.length) return;
      list.forEach(function (el) {
        clearTimeout(el.__settle);
        el.__shown = false;
        el.__replay = true;
        /* Snap back to hidden, don't fade back. `.reveal` carries the
           transition, so merely removing `in` starts a 0.7s fade-OUT from full
           opacity, and the observer re-adding `in` moments later just reverses
           it — the section never visibly restarts, which is what made pressing
           a link look like it did nothing.

           The hidden state is written inline rather than left to the class:
           reading offsetHeight forces layout, and opacity/transform don't
           affect layout, so the recalculation that would commit them can be
           deferred right past this point. Reading the computed value forces the
           style recalculation itself, which is the part that has to happen. */
        el.style.transition = 'none';
        el.classList.remove('in', 'settled');
        el.style.opacity = '0';
        el.style.transform = 'translateY(26px)';
        /* The transition stays switched off until the reveal clears it. Turning
           it back on here — in the same task that hid the element — meant the
           browser never saw the hidden state as its own step: it collapsed the
           whole thing into "opacity 1 to 0, transitions on" and simply animated
           the fade-out again. Leaving it off holds the element genuinely hidden
           across frames, so the reveal has a real starting point. */
        io.observe(el);
      });
      /* The observer does the revealing — it is what gives the motion its
         timing, firing at 12% visibility so a block animates as you reach it.
         An earlier version of this guard revealed on any pixel of overlap and
         ran immediately, which meant the fade started while the section was
         still a sliver at the edge of the screen and was over before it was in
         front of you: motion technically played, but nothing was seen.

         So this now only catches what the observer misses — and waits until
         the scroll has arrived before looking. Timers, not frames, because rAF
         is suspended in a background tab. */
      function guard() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        list.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
          if (shown > 0 && (shown >= r.height * 0.12 || shown >= vh * 0.25)) revealNow(el);
        });
      }
      [900, 1500, 2200, 3000].forEach(function (t) { setTimeout(guard, t); });
    }
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a || !a.hash || a.hash.length < 2) return;
      // same page only — a link to another document reveals normally on load
      if (a.host !== location.host || a.pathname !== location.pathname) return;
      var target = document.getElementById(a.hash.slice(1));
      if (target) replay(target);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in', 'settled'); });
  }

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    // Tapping a destination should close the menu behind you.
    links.addEventListener('click', function (e) {
      if (!e.target.closest('a')) return;
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    });
  }

  // FAQ — accordion behaviour: opening one closes the rest
  var faq = document.querySelectorAll('.faq details');
  if (faq.length) {
    faq.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        faq.forEach(function (other) { if (other !== d) other.open = false; });
      });
    });
  }

  // Disclosures — package deliverables and process detail, collapsed by default
  var discs = document.querySelectorAll('.dsc-btn');
  discs.forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    panel.removeAttribute('hidden');
    var label = btn.querySelector('.dsc-label');
    btn.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = btn.getAttribute(open ? 'data-less' : 'data-more');
    });
  });

  // Live site preview — the real site in an iframe, rendered at its desktop
  // width and scaled down to fit the window. It is fully interactive: scroll
  // inside it, press its buttons, follow its links. Nothing is moved by
  // script, so there is no per-frame repaint to fight the page's own scroll.
  // Nothing loads until the frame is near the viewport.
  document.querySelectorAll('.site-preview').forEach(function (fig) {
    var frame = fig.querySelector('.sp-frame');
    var stage = fig.querySelector('.sp-stage');
    if (!frame || !stage) return;

    // Two render widths: the desktop layout on wide frames, the site's own
    // mobile layout on narrow ones. Squeezing a 1280px page into a 340px
    // frame renders its type at about 4px — legible to nobody.
    var DESK_W = +fig.getAttribute('data-w') || 1280;
    var MOB_W  = +fig.getAttribute('data-mw') || DESK_W;

    function measure() {
      var pageW = stage.clientWidth < 560 ? MOB_W : DESK_W;
      var scale = stage.clientWidth / pageW;
      frame.style.width  = pageW + 'px';
      frame.style.height = Math.ceil(stage.clientHeight / scale) + 'px';
      frame.style.transform = 'scale(' + scale + ')';
    }
    function load() {
      if (frame.src) return;
      frame.src = fig.getAttribute('data-src');
      measure();
    }

    frame.addEventListener('load', function () { if (frame.src) fig.classList.add('loaded'); });
    if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
    else window.addEventListener('resize', measure);
    measure();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) { if (en.isIntersecting) { load(); obs.disconnect(); } });
      }, { rootMargin: '300px 0px' }).observe(fig);
    } else {
      load();
    }
  });

  // Contact form — AJAX submit with graceful fallback (no JS = normal POST)
  var form = document.querySelector('.cta-form');
  if (form && window.fetch) {
    var status = form.querySelector('.form-status');
    var fail = 'Something went wrong. Please email hello@jordandarby.com.';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button');
      btn.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Sending…';
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (r) {
        if (r.ok) {
          form.classList.add('sent');
          status.textContent = 'Thanks! Your message is on its way — I’ll be in touch soon.';
        } else {
          return r.json().then(function (d) {
            btn.disabled = false;
            status.className = 'form-status error';
            status.textContent = (d && d.errors && d.errors[0] && d.errors[0].message) || fail;
          });
        }
      }).catch(function () {
        btn.disabled = false;
        status.className = 'form-status error';
        status.textContent = fail;
      });
    });
  }

  /* The marquees are decorative and loop forever. Left running they keep the
     compositor busy animating strips that are usually off-screen, which is the
     sort of background work that makes scrolling stutter elsewhere on the page.
     Pause each one whenever it isn't visible. */
  (function marquees() {
    if (!('IntersectionObserver' in window)) return;
    /* Watch the window the strip runs inside, never the strip itself. A track
       is far wider than the screen and the duplicate copies sit off to the
       right waiting their turn — so observing tracks reported those copies as
       "not visible" and paused them where they stood. The first copy would
       scroll away and nothing followed it: the loop appeared to break. The
       container only ever leaves the viewport vertically, which is the actual
       question being asked. */
    var frames = document.querySelectorAll('.hero-strip, .brand-marquee');
    if (!frames.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var tracks = e.target.querySelectorAll('.hero-strip-track, .brand-track');
        Array.prototype.forEach.call(tracks, function (t) {
          t.style.animationPlayState = e.isIntersecting ? '' : 'paused';
        });
      });
    }, { threshold: 0 });
    Array.prototype.forEach.call(frames, function (f) { io.observe(f); });
  })();
})();
