// Subtle scroll-reveal + mobile nav — no libraries, ~1 KB
(function () {
  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (e.target.__shown) { io.unobserve(e.target); return; }
          e.target.classList.add('in');
          io.unobserve(e.target);
          // Must outlast the longest reveal (cascade delay .30s + .7s duration),
          // or 'settled' swaps the transition mid-fade and the item snaps in.
          // Held on the element so a replay can cancel a pending one — left
          // running it would land mid-replay and cut that animation short.
          clearTimeout(e.target.__settle);
          e.target.__settle = setTimeout(function () {
            e.target.classList.add('settled');
          }, 1150);
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
    function revealNow(el) {
      if (el.classList.contains('in')) return;
      el.classList.add('in');
      clearTimeout(el.__settle);
      el.__settle = setTimeout(function () { el.classList.add('settled'); }, 1150);
    }
    function replay(root) {
      var list = [];
      if (root.classList && root.classList.contains('reveal')) list.push(root);
      Array.prototype.push.apply(list, root.querySelectorAll('.reveal'));
      if (!list.length) return;
      list.forEach(function (el) {
        clearTimeout(el.__settle);
        el.__shown = false;
        el.classList.remove('in', 'settled');
        io.observe(el);
      });
      /* The observer covers whatever scrolls in. This guard covers the rest: a
         block already on screen, or a tall one whose 12% threshold the arrival
         never trips. Without it a replayed section could sit invisible, which
         is far worse than the finished state being replaced.
         Timers as well as frames, deliberately: rAF is suspended in a
         background tab, and a guard that only ran on frames would leave the
         section blank there — the same trap the load sweep fell into. */
      function pass() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        list.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0) revealNow(el);
        });
      }
      pass();
      [120, 350, 700, 1200, 1600].forEach(function (t) { setTimeout(pass, t); });
      var until = performance.now() + 1600;
      (function frame() {
        pass();
        if (performance.now() < until) requestAnimationFrame(frame);
      })();
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

    var scale = 1, travel = 0, offset = 0, dir = 1, paused = true, dragging = false;

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

    // Drift: down, then back up, so it never snaps.
    var last = 0, running = 0, SPEED = 26;                 // css px per second, pre-scale
    function tick(now) {
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!paused && !dragging && !still && travel > 0) {
        offset += dir * SPEED * dt;
        if (offset >= travel) { offset = travel; dir = -1; }
        else if (offset <= 0) { offset = 0; dir = 1; }
        paint();
      }
      running = requestAnimationFrame(tick);
    }
    function start() { if (!running) { last = 0; running = requestAnimationFrame(tick); } }
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
    var tracks = document.querySelectorAll('.hero-strip-track, .brand-track');
    if (!tracks.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.style.animationPlayState = e.isIntersecting ? '' : 'paused';
      });
    }, { threshold: 0 });
    Array.prototype.forEach.call(tracks, function (t) { io.observe(t); });
  })();
})();
