(function () {
  var form = document.getElementById('booking-form');
  if (!form) return;
  var slots = document.getElementById('time-slots');
  var msg = document.getElementById('booking-msg');
  var pay = document.getElementById('pay-panel');
  var details = document.getElementById('booking-details');
  var dateInput = form.elements.date;
  var serviceInput = form.elements.service;
  var selected = '';
  var unavailable = {};
  var times = [];
  var scriptURL = 'https://script.google.com/macros/s/AKfycbyXt1-6Y1Ma95ZKtQQNAyTO-XSPZySLn9kr2MY4ZSM-GQCApT3VnqAGBV4AOHuLWJfh/exec';

  function emailBooking(booking) {
    var data = new FormData();
    data.append('Name', booking.name);
    data.append('Email', booking.email);
    data.append('Inquiry Type', booking.service);
    data.append('Message', [
      'Booking request',
      'Date: ' + booking.date,
      'Time: ' + booking.time,
      'Phone: ' + (booking.phone || 'Not provided'),
      'Notes: ' + (booking.notes || 'None')
    ].join('\n'));
    return fetch(scriptURL, { method: 'POST', body: data }).then(function (response) {
      if (!response.ok) throw new Error('Booking email request failed.');
    });
  }

  function updateDetailsVisibility() {
    details.hidden = !serviceInput.value || !dateInput.value;
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var today = new Date();
  var max = new Date(today.getTime() + 90 * 864e5);
  dateInput.min = ymd(today);
  dateInput.max = ymd(max);

  function clock(t) {
    var p = t.split(':'), h = +p[0];
    return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' am' : ' pm');
  }
  function say(text, bad) {
    msg.textContent = text || '';
    msg.classList.toggle('is-error', !!bad);
  }

  function renderSlots() {
    var date = dateInput.value;
    selected = '';
    if (!date) { slots.innerHTML = '<p class="time-hint">Pick a date to see available times.</p>'; return; }
    var taken = unavailable[date] || [];
    slots.innerHTML = '';
    times.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'time-slot';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.dataset.time = t;
      b.textContent = clock(t);
      b.disabled = taken.indexOf(t) !== -1;
      slots.appendChild(b);
    });
    if (slots.querySelectorAll('.time-slot:not(:disabled)').length === 0) {
      slots.insertAdjacentHTML('afterbegin', '<p class="time-hint">No times left that day. Please try another date.</p>');
    }
  }

  function loadAvailability() {
    var date = dateInput.value;
    if (!date) return renderSlots();
    slots.innerHTML = '<p class="time-hint">Checking availability…</p>';
    fetch('/api/availability?from=' + date + '&to=' + date)
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) { times = d.times; unavailable = d.unavailable; renderSlots(); })
      .catch(function () { slots.innerHTML = '<p class="time-hint">Couldn’t load times. Please refresh, or use the contact form below.</p>'; });
  }

  serviceInput.addEventListener('change', updateDetailsVisibility);
  dateInput.addEventListener('change', function () {
    updateDetailsVisibility();
    loadAvailability();
  });
  updateDetailsVisibility();
  slots.addEventListener('click', function (e) {
    var b = e.target.closest('.time-slot');
    if (!b || b.disabled) return;
    selected = b.dataset.time;
    slots.querySelectorAll('.time-slot').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
  });

  document.getElementById('booking-add-cart').addEventListener('click', function () {
    if (!serviceInput.value) { return say('Please choose a service to add to your cart.', true); }
    var when = '';
    if (dateInput.value) {
      when = new Date(dateInput.value + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (selected) when += ', ' + clock(selected);
    }
    window.kmCart.addService(serviceInput.value, when);
    say('Added to your cart.');
    window.kmCart.open();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    if (!f.service.value || !f.date.value || !selected || !f.name.value.trim() || !f.email.value.trim()) {
      return say('Please choose a service, date and time, and enter your name and email.', true);
    }
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    say('Sending…');
    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: f.service.value, date: f.date.value, time: selected,
        name: f.name.value, email: f.email.value, phone: f.phone.value, notes: f.notes.value
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (r) {
        if (!r.ok) { say(r.d.error || 'Something went wrong. Please try again.', true); loadAvailability(); return; }
        var when = f.date.value + ' ' + clock(selected);
        var booking = {
          name: f.name.value,
          email: f.email.value,
          service: f.service.options[f.service.selectedIndex].text,
          date: f.date.value,
          time: clock(selected),
          phone: f.phone.value,
          notes: f.notes.value
        };
        form.reset();
        selected = '';
        updateDetailsVisibility();
        renderSlots();
        if (r.d.amount) {
          document.getElementById('pay-amount').textContent = r.d.amount;
          document.getElementById('pay-link').href = 'https://venmo.com/' + encodeURIComponent(r.d.venmo) +
            '?txn=pay&amount=' + r.d.amount + '&note=' + encodeURIComponent('Meet & Greet ' + when);
          pay.hidden = false;
          pay.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          pay.hidden = true;
        }
        return emailBooking(booking).then(function () {
          say(r.d.amount ? 'Thank you! Your time is held while you pay.' : 'Thank you! Your request is in. I’ll confirm by email shortly.');
        }).catch(function (error) {
          console.error(error);
          say('Your booking was saved, but I couldn’t send the email notification. Please email kellynicolemushonga@gmail.com.', true);
        });
      })
      .catch(function () { say('Couldn’t send your request. Please try again.', true); })
      .then(function () { btn.disabled = false; });
  });
})();
