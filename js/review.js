// Review form: the link carries who is writing, the client types the review
// and ticks permission. Our own field notes, AJAX send with a thank-you in
// place of the form. Same pattern as the contact form in main.js; without JS
// the form still posts normally.
(function () {
  var form = document.querySelector('.review-form');
  if (!form) return;

  // Name, business and project come from the link (?name=&business=&project=).
  // The name and business boxes only show when the link did not fill them, so
  // a client who arrives through Jordan's link sees the review box and the tick.
  var fromLink = false;
  try {
    var params = new URLSearchParams(window.location.search);
    ['name', 'business', 'project'].forEach(function (key) {
      var v = (params.get(key) || '').trim();
      var f = form.elements[key];
      if (!v || !f || f.value) return;
      if (v.length > 120) v = v.slice(0, 120);
      f.value = v;
    });
    fromLink = !!(form.elements.name.value && form.elements.business.value);
  } catch (_) {}
  if (fromLink) form.classList.add('from-link');

  var alertIcon = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6" stroke="#182946" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.4" fill="#182946"/></svg>';

  // The review box grows with what's typed (native where supported).
  var msg = form.querySelector('textarea');
  if (msg && !(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'))) {
    var grow = function () { msg.style.height = 'auto'; msg.style.height = msg.scrollHeight + 'px'; };
    msg.addEventListener('input', grow);
    grow();
  }

  if (!window.fetch) return;

  var status = form.querySelector('.form-status');
  var fail = 'Something went wrong. Please try again, or message me on LinkedIn.';
  var btn = form.querySelector('button[type="submit"]');
  var btnHTML = btn.innerHTML;
  var sentHTML = 'Sent!<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var pending = false;
  form.noValidate = true;

  var notes = {
    name: 'Please add your name',
    business: 'Please add your business',
    review: 'Please write a few words',
    permission: 'Please tick this so I can share your words'
  };

  // Each check: the element that shows the note, the input to focus, and the problem.
  var textFields = [].slice.call(form.querySelectorAll('.field input, .field textarea'));
  var consent = form.querySelector('input[name="permission"]');
  var checks = [];
  textFields.forEach(function (f) {
    checks.push({
      key: f.name, holder: f.closest('.field'), focus: f, inputs: [f],
      problem: function () { return f.value.trim() ? '' : notes[f.name]; }
    });
  });
  checks.push({
    key: 'permission', holder: form.querySelector('.consent-wrap'), focus: consent, inputs: [consent],
    problem: function () { return consent.checked ? '' : notes.permission; }
  });

  var showError = function (c, text) {
    var note = c.holder.querySelector('.field-error');
    if (!text) {
      c.holder.classList.remove('has-error');
      c.inputs.forEach(function (i) { i.removeAttribute('aria-invalid'); });
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement('span');
      note.className = 'field-error';
      note.id = 'err-' + c.key;
      c.holder.appendChild(note);
    }
    note.innerHTML = alertIcon + '<span></span>';
    note.lastChild.textContent = text;
    c.holder.classList.add('has-error');
    c.inputs.forEach(function (i) {
      i.setAttribute('aria-invalid', 'true');
      i.setAttribute('aria-describedby', note.id);
    });
  };

  // A note clears as soon as the field is fixed.
  checks.forEach(function (c) {
    c.inputs.forEach(function (i) {
      var clear = function () { if (c.holder.classList.contains('has-error') && !c.problem()) showError(c, ''); };
      i.addEventListener('input', clear);
      i.addEventListener('change', clear);
    });
  });

  var allInputs = [].slice.call(form.querySelectorAll('input, textarea'));
  var lock = function (on) {
    form.classList.toggle('is-locked', on);
    allInputs.forEach(function (i) {
      if (i.type === 'checkbox') i.disabled = on;
      else i.readOnly = on;
    });
  };

  var restore = function (text) {
    pending = false;
    lock(false);
    btn.disabled = false;
    btn.classList.remove('is-sent');
    btn.innerHTML = btnHTML;
    status.className = 'form-status error';
    status.innerHTML = alertIcon + '<span></span>';
    status.lastChild.textContent = text || fail;
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (pending) return;
    var first = null;
    checks.forEach(function (c) {
      var p = c.problem();
      showError(c, p);
      if (p && !first) first = c.focus;
    });
    if (first) {
      status.className = 'form-status';
      status.textContent = '';
      first.focus();
      return;
    }

    var name = form.elements.name.value.trim();
    var business = form.elements.business.value.trim();
    form.elements._subject.value = 'Review from ' + name + ', ' + business;
    // FormData is read before the fields lock, since disabled inputs are not sent.
    var data = new FormData(form);

    pending = true;
    btn.disabled = true;
    btn.classList.add('is-sent');
    btn.innerHTML = sentHTML;
    lock(true);
    status.className = 'form-status sr-only';
    status.textContent = 'Sending your review.';

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    }).then(function (r) {
      if (r.ok) {
        pending = false;
        var firstName = name.split(/\s+/)[0];
        status.className = 'form-status';
        status.textContent = 'Thank you, ' + firstName + '! Your review is in. I may be in touch to say thanks properly.';
        form.classList.add('sent');
        if (status.scrollIntoView) status.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        return r.json().then(function (d) {
          var e0 = d && d.errors && d.errors[0];
          var c = e0 && e0.field && checks.filter(function (x) { return x.key === e0.field; })[0];
          if (c) {
            restore('');
            status.className = 'form-status';
            status.textContent = '';
            showError(c, e0.message || 'Please check this.');
            c.focus.focus();
          } else {
            restore(e0 && e0.message);
          }
        }, function () { restore(); });
      }
    }).catch(function () { restore(); });
  });
})();
