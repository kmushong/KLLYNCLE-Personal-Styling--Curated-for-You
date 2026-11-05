(function () {
  var form = document.getElementById('booking-form');
  if (!form) return;
  var slots = document.getElementById('time-slots');
  var msg = document.getElementById('booking-msg');
  var dateInput = form.elements.date;
  var serviceInput = form.elements.service;
  var selected = '';
  var unavailable = {};
  var times = [];

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
      .catch(function () { slots.innerHTML = '<p class="time-hint">Couldn’t load times. Please refresh, or email kellynicolemushonga@gmail.com to book.</p>'; });
  }

  dateInput.addEventListener('change', loadAvailability);
  slots.addEventListener('click', function (e) {
    var b = e.target.closest('.time-slot');
    if (!b || b.disabled) return;
    selected = b.dataset.time;
    slots.querySelectorAll('.time-slot').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
  });

  // Requesting a session adds it to the cart; contact details are collected there.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!serviceInput.value || !dateInput.value || !selected) {
      return say('Please choose a service, a date and a time.', true);
    }
    var label = new Date(dateInput.value + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + clock(selected);
    window.kmCart.addService(serviceInput.value, label, { date: dateInput.value, time: selected });
    form.reset();
    renderSlots();
    say('');
    window.kmCart.open();
  });
})();
