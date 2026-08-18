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

  // Live site preview — the iframe renders the whole page at desktop width and
  // drifts vertically inside a fixed window. Drag to scrub, hover to pause.
  // Nothing loads until the frame is near the viewport.
  document.querySelectorAll('.site-preview').forEach(function (fig) {
    var frame = fig.querySelector('.sp-frame');
    var stage = fig.querySelector('.sp-stage');
    var veil  = fig.querySelector('.sp-veil');
    if (!frame || !stage) return;

    // Two render sizes: the desktop layout on wide frames, the site's own
    // mobile layout on narrow ones. Squeezing a 1280px page into a 340px
    // frame renders its type at about 4px — legible to nobody.
    var DESK = { w: +fig.getAttribute('data-w') || 1280, h: +fig.getAttribute('data-h') || 3000 };
    var MOB  = { w: +fig.getAttribute('data-mw') || DESK.w, h: +fig.getAttribute('data-mh') || DESK.h };
    var PAGE_W = DESK.w, PAGE_H = DESK.h;
    var still  = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var scale = 1, travel = 0, offset = 0, paused = true, dragging = false;

    function measure() {
      var page = stage.clientWidth < 560 ? MOB : DESK;
      PAGE_W = page.w; PAGE_H = page.h;
      scale = stage.clientWidth / PAGE_W;
      frame.style.width  = PAGE_W + 'px';
      frame.style.height = PAGE_H + 'px';
      // how far the render can move before its bottom edge reaches the window
      travel = Math.max(0, PAGE_H - stage.clientHeight / scale);
      if (offset > travel) offset = travel;
      paint();
    }
    function paint() {
      frame.style.transform = 'scale(' + scale + ') translateY(' + (-offset) + 'px)';
    }

    /* Drift: down once, then rest at the bottom. It used to turn around and
       climb back up on a loop, which made the panel look like a screensaver
       and never let the reader see the foot of the page settle. Reaching the
       end is the end — dragging still works from there. */
    var last = 0, running = 0, drifted = false, SPEED = 26;   // css px/sec, pre-scale
    function tick(now) {
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!paused && !dragging && !still && travel > 0 && !drifted) {
        offset += SPEED * dt;
        if (offset >= travel) { offset = travel; drifted = true; }
        paint();
      }
      if (drifted) { running = 0; return; }        // stop asking for frames
      running = requestAnimationFrame(tick);
    }
    function start() { if (!running && !drifted) { last = 0; running = requestAnimationFrame(tick); } }
    function stop() { if (running) { cancelAnimationFrame(running); running = 0; } }

    // Scroll the preview under the cursor / finger. At either end the gesture
    // is handed back to the page, so the frame never traps the reader.
    function atEdge(delta) {
      return (delta < 0 && offset <= 0.5) || (delta > 0 && offset >= travel - 0.5);
    }
    function nudge(deltaPx) {
      var next = Math.min(travel, Math.max(0, offset + deltaPx / scale));
      var moved = next !== offset;
      offset = next; if (moved) paint();
      return moved;
    }

    stage.addEventListener('wheel', function (e) {
      if (travel <= 0) return;
      if (atEdge(e.deltaY)) return;          // let the page take over
      e.preventDefault();
      nudge(e.deltaY);
    }, { passive: false });

    // Touch: same idea, but we only claim the gesture while there is travel
    // left in the direction being dragged.
    var startY = 0, startOffset = 0, claimed = false;
    veil.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY; startOffset = offset; claimed = false;
      dragging = true; stage.classList.add('dragging');
    }, { passive: true });

    veil.addEventListener('touchmove', function (e) {
      if (!dragging || travel <= 0) return;
      var dy = startY - e.touches[0].clientY;      // finger up = scroll down
      if (!claimed && atEdge(dy)) return;          // page keeps the gesture
      claimed = true;
      e.preventDefault();
      offset = Math.min(travel, Math.max(0, startOffset + dy / scale));
      paint();
    }, { passive: false });

    function endTouch() { dragging = false; claimed = false; stage.classList.remove('dragging'); }
    veil.addEventListener('touchend', endTouch);
    veil.addEventListener('touchcancel', endTouch);

    // Mouse drag still works on desktop.
    function down(e) {
      dragging = true; stage.classList.add('dragging');
      startY = e.clientY; startOffset = offset;
      if (veil.setPointerCapture && e.pointerId != null) { try { veil.setPointerCapture(e.pointerId); } catch (err) {} }
    }
    function move(e) {
      if (!dragging || e.pointerType === 'touch') return;
      offset = Math.min(travel, Math.max(0, startOffset - (e.clientY - startY) / scale));
      paint();
    }
    function up() { dragging = false; stage.classList.remove('dragging'); }
    veil.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') down(e); });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    stage.addEventListener('mouseenter', function () { paused = true; });
    stage.addEventListener('mouseleave', function () { paused = false; });

    frame.addEventListener('load', function () { if (frame.src) fig.classList.add('loaded'); });

    if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
    else window.addEventListener('resize', measure);
    measure();

    // Two observers, deliberately: load a little early so the frame is ready,
    // but only start drifting once the section is genuinely on screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !frame.src) {
            frame.src = fig.getAttribute('data-src');
            measure();
            obs.disconnect();
          }
        });
      }, { rootMargin: '300px 0px' }).observe(fig);

      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          paused = !en.isIntersecting;
          if (paused) stop(); else start();
        });
      }, { threshold: 0.35 }).observe(fig);
    } else {
      frame.src = fig.getAttribute('data-src');
      paused = false; start();
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
