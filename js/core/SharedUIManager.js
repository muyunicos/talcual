class SharedUIManager {
  static getSharedElements() {
    return {
      headerTimer: getElement('header-timer'),
      countdownOverlay: getElement('countdown-overlay'),
      countdownNumber: getElement('countdown-number')
    };
  }

  static updateTimerDisplay(element, remaining, totalDuration) {
    if (remaining === null || remaining === undefined) {
      element.textContent = '⏳ --:--';
      element.style.opacity = '1';
      return;
    }

    if (remaining < 0) {
      remaining = 0;
    }

    element.style.opacity = '1';
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    element.textContent = `⏳ ${timeStr}`;
  }

  static clearTimerDisplay(element) {
    element.textContent = '⏳ 00:00';
    element.style.opacity = '1';
  }

  static updateCountdownNumber(element, seconds) {
    if (seconds > 3) {
      element.textContent = '¿Preparado?';
    } else if (seconds > 0) {
      element.textContent = seconds.toString();
    } else {
      element.textContent = '';
    }
  }

  static showCountdownOverlay(element) {
    safeShowElement(element);
  }

  static hideCountdownOverlay(element) {
    safeHideElement(element);
  }
}

console.log('%c✅ SharedUIManager.js', 'color: #00aa00; font-weight: bold');