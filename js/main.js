// Subtle scroll-reveal + mobile nav — no libraries, ~1 KB
(function () {
  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
          // Must outlast the longest reveal (cascade delay .30s + .7s duration),
          // or 'settled' swaps the transition mid-fade and the item snaps in.
          setTimeout(function () { e.target.classList.add('settled'); }, 1150);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
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
    var last = 0, SPEED = 26;                 // css px per second, pre-scale
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
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

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
        entries.forEach(function (en) { paused = !en.isIntersecting; });
      }, { threshold: 0.35 }).observe(fig);
    } else {
      frame.src = fig.getAttribute('data-src');
      paused = false;
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
})();
