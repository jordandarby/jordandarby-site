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

    var PAGE_W = +fig.getAttribute('data-w') || 1280;
    var PAGE_H = +fig.getAttribute('data-h') || 3000;
    var still  = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var scale = 1, travel = 0, offset = 0, dir = 1, paused = true, dragging = false;

    function measure() {
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

    // Drag to scrub
    var startY = 0, startOffset = 0;
    function down(e) {
      dragging = true; stage.classList.add('dragging');
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      startOffset = offset;
      if (veil.setPointerCapture && e.pointerId != null) { try { veil.setPointerCapture(e.pointerId); } catch (err) {} }
    }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      offset = Math.min(travel, Math.max(0, startOffset - (y - startY) / scale));
      paint();
    }
    function up() { dragging = false; stage.classList.remove('dragging'); }

    veil.addEventListener('pointerdown', down);
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
