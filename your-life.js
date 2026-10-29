/**
 * Interactive form and chart events / logic.
 */
(function () {
  var birthdayEl = document.getElementById('birthday'),
    unitText = document.querySelector('.unit.is-active').textContent.trim().toLowerCase(),
    charts = document.querySelectorAll('.chart'),
    // Address options, used by a display that renders the page on its own:
    //   ?dob=1995-08-15   fills in the birthday
    //   ?epaper=1         black on white, no controls, sized for a panel
    //   ?scale=calendar   show only the calendar grid (or scale=felt)
    PARAMS = _readParams(),
    EPAPER = PARAMS.epaper === '1',
    COLOR = '#000',
    // Felt time: a year counts for its share of the life lived so far (Paul Janet's
    // rule), so felt age grows with the log of real age. The count starts at the age
    // clear memory usually begins and ends at the lifespan the charts assume.
    FELT_START_AGE = 6,
    LIFESPAN = 90,
    // Rows per chart and how often to label them with an age down the side.
    ROWS = { years: 9, months: 30, weeks: 90 },
    TICK_EVERY = { years: 1, months: 5, weeks: 5 };

  _addAgeTicks();

  if (EPAPER) {
    document.body.classList.add('epaper');
    if (PARAMS.scale === 'calendar' || PARAMS.scale === 'felt') {
      document.body.classList.add('scale-' + PARAMS.scale);
    }
  }

  // Set listeners
  birthdayEl.addEventListener('input', _handleDateChange);
  birthdayEl.addEventListener('change', _handleDateChange);

  // Load default values
  _loadStoredValueOfDOB();

  // Event Handlers
  function _handleDateChange(e) {

    // Save date of birth in local storage
    try {
      localStorage.setItem("DOB", JSON.stringify({ date: birthdayEl.value }));
    } catch (err) {}

    var valid = _dateIsValid(), elapsed = valid ? calculateElapsedTime() : 0, i, items;
    for (i = 0; i < charts.length; i++) {
      items = charts[i].querySelectorAll('li');
      if (!valid) {
        _repaintItems(items, 0);
      } else if (charts[i].getAttribute('data-scale') === 'felt') {
        _repaintItems(items, calculateFeltCount(items.length));
      } else {
        _repaintItems(items, elapsed);
      }
    }
  }

  function calculateElapsedTime() {
    var currentDate = new Date(),
      dateOfBirth = _getDateOfBirth(),
      diff = currentDate.getTime() - dateOfBirth.getTime(),
      elapsedTime;

    switch (unitText) {
      case 'weeks':
        // Measuring weeks is tricky since our chart shows 52 weeks per year (for simplicity)
        // when the actual number of weeks per year is 52.143. Attempting to calculate weeks
        // with a diffing strategy will result in build-up over time. Instead, we'll add up
        // 52 per elapsed full year, and only diff the weeks on the current partial year.
        var elapsedYears = (new Date(diff).getUTCFullYear() - 1970);
        var isThisYearsBirthdayPassed = (currentDate.getTime() > new Date(currentDate.getUTCFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate()).getTime());
        var birthdayYearOffset = isThisYearsBirthdayPassed ? 0 : 1;
        var dateOfLastBirthday = new Date(currentDate.getUTCFullYear() - birthdayYearOffset, dateOfBirth.getMonth(), dateOfBirth.getDate());
        var elapsedDaysSinceLastBirthday = Math.floor((currentDate.getTime() - dateOfLastBirthday.getTime()) / (1000 * 60 * 60 * 24));
        var elapsedWeeks = (elapsedYears * 52) + Math.floor(elapsedDaysSinceLastBirthday / 7);
        elapsedTime = elapsedWeeks;
        break;
      case 'months':
        // Months are tricky, being variable length, so I opted for the average number
        // of days in a month as a close-enough approximation (30.4375). This can make
        // the chart look off by a day when you're right on the month threshold, but
        // it's otherwise fairly accurate over long periods of time.
        elapsedTime = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4375));
        break;
      case 'years':
        // We can represent our millisecond diff as a year and subtract 1970 to
        // end up with an accurate elapsed time. To see why, consider the following:
        //
        //   1. JavaScript's Date timestamp represents milliseconds since 1970. Thus,
        //      new Date(0).toUTCString() → 'Thu, 01 Jan 1970 00:00:00 GMT'
        //   2. Picture the diff between today and tomorrow. It's a small number. A
        //      newly created date with that number would result in January 2 1970.
        //   3. Thus, subtracting 1970 from that date gives us elapsed time. We use
        //      UTC because otherwise we'd need to offset "1970" by our timezone.
        //
        // See more details here: https://stackoverflow.com/a/24181701/1154642
        elapsedTime = (new Date(diff).getUTCFullYear() - 1970);
        break;
    }

    return elapsedTime;
  }

  function calculateFeltCount(totalCells) {
    var ageInYears = (new Date().getTime() - _getDateOfBirth().getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    var feltShare = ageInYears <= FELT_START_AGE ? 0 :
      Math.min(1, Math.log(ageInYears / FELT_START_AGE) / Math.log(LIFESPAN / FELT_START_AGE));
    return Math.floor(feltShare * totalCells);
  }

  function _dateIsValid() {
    return /^\d{4}-\d{2}-\d{2}$/.test(birthdayEl.value) && !isNaN(_getDateOfBirth().getTime());
  }

  function _getDateOfBirth() {
    // Parse the parts ourselves so the date is local midnight, not UTC.
    var p = birthdayEl.value.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function _repaintItems(items, number) {
    for (var i = 0; i < items.length; i++) {
      if (i < number) {
        items[i].style.backgroundColor = COLOR;
      } else {
        items[i].style.backgroundColor = '';
      }
    }
  }

  function _addAgeTicks() {
    var rows = ROWS[unitText], every = TICK_EVERY[unitText], i, chart, felt, box, span, r, age;
    if (!rows) { return; }
    for (i = 0; i < charts.length; i++) {
      chart = charts[i];
      felt = chart.getAttribute('data-scale') === 'felt';
      box = document.createElement('div');
      box.className = 'ticks';
      for (r = 0; r <= rows; r += (r + every > rows && r < rows) ? rows - r : every) {
        // Calendar rows are evenly spaced in age; felt rows follow the log rule.
        age = felt ? FELT_START_AGE * Math.pow(LIFESPAN / FELT_START_AGE, r / rows) : r * LIFESPAN / rows;
        span = document.createElement('span');
        span.style.top = (r / rows * 100) + '%';
        span.textContent = age < 10 ? String(Math.round(age * 10) / 10) : String(Math.round(age));
        box.appendChild(span);
      }
      chart.insertBefore(box, chart.firstChild);
    }
  }

  function _readParams() {
    var out = {}, pairs = (window.location.search || '').replace(/^\?/, '').split('&'), i, kv;
    for (i = 0; i < pairs.length; i++) {
      kv = pairs[i].split('=');
      if (kv[0]) { out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }
    }
    return out;
  }

  function _loadStoredValueOfDOB() {
    var DOB = null;

    // A birthday in the address wins over the saved one.
    if (/^\d{4}-\d{2}-\d{2}$/.test(PARAMS.dob || '')) {
      birthdayEl.value = PARAMS.dob;
      _handleDateChange();
      return;
    }
    try {
      DOB = JSON.parse(localStorage.getItem('DOB'));
    } catch (err) {}

    if (!DOB) {
      return;
    }

    if (DOB.date) {
      birthdayEl.value = DOB.date;
    } else if (DOB.year && DOB.month >= 0 && DOB.day > 0) {
      // A value saved by the old three-field form.
      birthdayEl.value = DOB.year + '-' + _pad(+DOB.month + 1) + '-' + _pad(DOB.day);
    }
    _handleDateChange();
  }

  function _pad(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }
})();
