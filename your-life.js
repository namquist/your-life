/**
 * Interactive form and chart events / logic.
 */
(function () {
  var birthdayEl = document.getElementById('birthday'),
    unitboxEl = document.getElementById('unitbox'),
    unitText = document.querySelector('.unitbox-label').textContent.toLowerCase(),
    items = document.querySelectorAll('.chart li'),
    itemCount,
    COLOR = 'red';

  // Set listeners
  unitboxEl.addEventListener('change', _handleUnitChange);
  birthdayEl.addEventListener('input', _handleDateChange);
  birthdayEl.addEventListener('change', _handleDateChange);

  // Load default values
  _loadStoredValueOfDOB();

  // Event Handlers
  function _handleUnitChange(e) {
    window.location = '' + e.currentTarget.value + '.html';
  }

  function _handleDateChange(e) {

    // Save date of birth in local storage
    try {
      localStorage.setItem("DOB", JSON.stringify({ date: birthdayEl.value }));
    } catch (err) {}

    if (_dateIsValid()) {
      itemCount = calculateElapsedTime();
      _repaintItems(itemCount);
    } else {
      _repaintItems(0);
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

  function _dateIsValid() {
    return /^\d{4}-\d{2}-\d{2}$/.test(birthdayEl.value) && !isNaN(_getDateOfBirth().getTime());
  }

  function _getDateOfBirth() {
    // Parse the parts ourselves so the date is local midnight, not UTC.
    var p = birthdayEl.value.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function _repaintItems(number) {
    for (var i = 0; i < items.length; i++) {
      if (i < number) {
        items[i].style.backgroundColor = COLOR;
      } else {
        items[i].style.backgroundColor = '';
      }
    }
  }

  function _loadStoredValueOfDOB() {
    var DOB = null;
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
