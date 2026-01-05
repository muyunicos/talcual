class PlayerView {
  constructor(maxWords = 6) {
    this.maxWords = maxWords;
    this.elements = this.cacheElements();
    this.initializeVisibility();
  }

  cacheElements() {
    const elements = {
      gameScreen: getElement('game-screen'),
      headerRound: getElement('header-round'),
      headerTimer: getElement('header-timer'),
      headerCode: getElement('header-code'),
      playerScore: getElement('player-score'),
      categoryLabel: getElement('category-label'),
      currentWord: getElement('current-word'),
      waitingMessage: getElement('waiting-message'),
      wordsInputSection: getElement('words-input-section'),
      currentWordInput: getElement('current-word-input'),
      btnAddWord: getElement('btn-add-word'),
      wordsListContainer: getElement('words-list-container'),
      wordsList: getElement('words-list'),
      wordCount: getElement('word-count'),
      maxWordsDisplay: getElement('max-words'),
      btnSubmit: getElement('btn-submit'),
      resultsSection: getElement('results-section'),
      countdownOverlay: document.getElementById('countdown-overlay'),
      countdownNumber: document.getElementById('countdown-number'),
      playerNameDisplay: getElement('player-name-display')
    };

    if (elements.maxWordsDisplay) {
      elements.maxWordsDisplay.textContent = this.maxWords;
    }

    if (elements.headerTimer) {
      elements.headerTimer.textContent = '⏳ 00:00';
    }

    return elements;
  }

  initializeVisibility() {
    if (this.elements.countdownOverlay) {
      safeHideElement(this.elements.countdownOverlay);
    }
  }

  bindAddWord(handler) {
    if (this.elements.btnAddWord) {
      this.elements.btnAddWord.addEventListener('click', () => handler());
    }
  }

  bindKeyPressInInput(handler) {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handler();
      });
    }
  }

  bindInputEvent(handler) {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.addEventListener('input', () => handler());
    }
  }

  bindSubmit(handler) {
    if (this.elements.btnSubmit) {
      this.elements.btnSubmit.addEventListener('click', () => handler());
    }
  }

  showJoinScreen() {
    const content = this.buildJoinContent();
    const htmlString = content.innerHTML;

    ModalSystem_Instance.show(
      1,
      htmlString,
      [
        [
          () => {
            const codeInput = document.querySelector('#modal-join-code');
            const nameInput = document.querySelector('#modal-join-name');
            if (this._joinCallback) {
              this._joinCallback(codeInput.value, nameInput.value);
            }
          },
          '¡A Jugar!',
          'btn-modal-primary'
        ]
      ]
    );

    this.attachJoinScreenListeners();
  }

  buildJoinContent() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="input-group">
        <label class="input-label" for="modal-join-code">Código de Sala</label>
        <input type="text" id="modal-join-code" class="input-field" 
               placeholder="Ej: CASA" maxlength="6" autocomplete="off">
      </div>
      <div class="input-group">
        <label class="input-label" for="modal-join-name">Tu Nombre</label>
        <input type="text" id="modal-join-name" class="input-field" 
               placeholder="" maxlength="20" autocomplete="on">
      </div>
      <div class="input-group">
        <label class="input-label">✨ Elige tu Aura</label>
        <div class="aura-selector" id="modal-aura-selector"></div>
      </div>
    `;

    const auraSelector = container.querySelector('#modal-aura-selector');
    const availableAuras = generateRandomAuras();
    const randomAura = availableAuras[Math.floor(Math.random() * availableAuras.length)];

    let selectedColor = randomAura.hex;
    renderAuraSelectors(
      auraSelector,
      availableAuras,
      randomAura.hex,
      (aura) => {
        selectedColor = aura.hex;
      }
    );

    this._joinData = { selectedColor };

    return container;
  }

  attachJoinScreenListeners() {
    const codeInput = document.querySelector('#modal-join-code');
    const nameInput = document.querySelector('#modal-join-name');

    if (codeInput) {
      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') nameInput.focus();
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && this._joinCallback) {
          const codeInputValue = document.querySelector('#modal-join-code');
          this._joinCallback(codeInputValue.value, nameInput.value);
        }
      });
    }
  }

  bindJoinGame(callback) {
    this._joinCallback = callback;
  }

  getSelectedAuraColor() {
    return this._joinData?.selectedColor || null;
  }

  showGameScreen(playerName, gameCode, playerColor) {
    if (playerColor) {
      applyColorGradient(playerColor);
    }

    ModalSystem_Instance.close(1);
    safeShowElement(this.elements.gameScreen);

    if (this.elements.headerCode) this.elements.headerCode.textContent = gameCode;
    if (this.elements.playerNameDisplay) this.elements.playerNameDisplay.textContent = playerName;
  }

  setRoundInfo(round, total) {
    if (this.elements.headerRound) {
      this.elements.headerRound.textContent = `Ronda ${round}/${total}`;
    }
  }

  setPlayerScore(score) {
    if (this.elements.playerScore) {
      this.elements.playerScore.textContent = score + ' pts';
    }
  }

  updateTimer(remaining, totalDuration) {
    if (!this.elements.headerTimer) return;

    if (remaining === null || remaining === undefined) {
      this.elements.headerTimer.textContent = '⏳ --:--';
      this.elements.headerTimer.style.opacity = '1';
      return;
    }

    if (remaining > totalDuration) {
      this.elements.headerTimer.style.opacity = '0';
      return;
    }

    this.elements.headerTimer.style.opacity = '1';

    if (remaining < 0) {
      remaining = 0;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    this.elements.headerTimer.textContent = `⏳ ${timeStr}`;
  }

  clearTimer() {
    if (this.elements.headerTimer) {
      this.elements.headerTimer.textContent = '⏳ 00:00';
      this.elements.headerTimer.style.opacity = '1';
    }
  }

  showWaitingState() {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeShowElement(this.elements.waitingMessage);
    if (this.elements.waitingMessage) {
      this.elements.waitingMessage.textContent = 'El anfitrión iniciará la ronda pronto';
    }
    safeHideElement(this.elements.wordsInputSection);
    safeHideElement(this.elements.resultsSection);
    safeHideElement(this.elements.countdownOverlay);
    this.clearTimer();
  }

  showPlayingState(currentWord, category, hasPlayerAnswers, isReady) {
    safeHideElement(this.elements.resultsSection);
    safeHideElement(this.elements.waitingMessage);

    if (this.elements.currentWord) this.elements.currentWord.classList.remove('hidden');
    if (this.elements.wordsInputSection) this.elements.wordsInputSection.classList.remove('hidden');

    if (this.elements.currentWord) {
      this.elements.currentWord.textContent = currentWord || '???';
      safeShowElement(this.elements.currentWord);
    }

    if (category) {
      if (this.elements.categoryLabel) {
        this.elements.categoryLabel.textContent = `Categoría: ${category}`;
        safeShowElement(this.elements.categoryLabel);
      }
    } else {
      safeHideElement(this.elements.categoryLabel);
    }

    if (isReady) {
      this.setReadOnlyMode();
    } else {
      this.setEditableMode(hasPlayerAnswers);
    }
  }

  setEditableMode(hasAnswers) {
    const isAtMax = hasAnswers >= this.maxWords;

    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.disabled = isAtMax;
      this.elements.currentWordInput.placeholder = isAtMax
        ? `Máximo ${this.maxWords} palabras`
        : 'Ingresa una palabra...';
    }

    if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;

    if (this.elements.btnSubmit) {
      this.elements.btnSubmit.disabled = false;
      this.updateFinishButtonText(hasAnswers);
    }

    safeHideElement(this.elements.waitingMessage);
    safeShowElement(this.elements.wordsInputSection);

    if (this.elements.wordsListContainer) {
      this.elements.wordsListContainer.classList.remove('read-only');
    }
  }

  setReadOnlyMode() {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.disabled = true;
      this.elements.currentWordInput.placeholder = '✅ Terminaste';
    }
    if (this.elements.btnAddWord) this.elements.btnAddWord.disabled = false;
    if (this.elements.btnSubmit) {
      this.elements.btnSubmit.disabled = false;
      this.elements.btnSubmit.textContent = '👏 LISTO';
    }

    if (this.elements.waitingMessage) {
      this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
      safeShowElement(this.elements.waitingMessage);
    }

    if (this.elements.wordsListContainer) {
      this.elements.wordsListContainer.classList.add('read-only');
    }
  }

  updateWordChips(words) {
    if (this.elements.wordCount) {
      this.elements.wordCount.textContent = words.length;
    }

    if (words.length > 0) {
      if (this.elements.wordsListContainer) this.elements.wordsListContainer.classList.remove('hidden');
      safeShowElement(this.elements.wordsListContainer);

      if (this.elements.wordsList) {
        this.elements.wordsList.innerHTML = words.map((word, idx) => `
          <div class="word-item" onclick="playerManager.removeWord(${idx})">
            <span class="word-text">${sanitizeText(word)}</span>
            <span class="word-delete">✍️</span>
          </div>
        `).join('');
      }
    } else {
      safeHideElement(this.elements.wordsListContainer);
    }
  }

  getInputValue() {
    return this.elements.currentWordInput ? this.elements.currentWordInput.value.trim() : '';
  }

  setInputValue(value) {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.value = value;
    }
  }

  clearInput() {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.value = '';
    }
  }

  focusInput() {
    if (this.elements.currentWordInput) {
      this.elements.currentWordInput.focus();
    }
  }

  updateFinishButtonText(wordCount) {
    if (!this.elements.btnSubmit) return;
    if (wordCount === this.maxWords) {
      this.elements.btnSubmit.textContent = '✍️ ENVÍAR';
    } else {
      this.elements.btnSubmit.textContent = '✍️ PASO';
    }
  }

  showRoundResults(matches, allPlayers, playerScore) {
    safeHideElement(this.elements.wordsInputSection);
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.waitingMessage);
    safeHideElement(this.elements.countdownOverlay);
    this.clearTimer();

    if (!matches || matches.length === 0) {
      if (this.elements.resultsSection) {
        this.elements.resultsSection.innerHTML = '<div class="waiting-message">❌ No enviaste palabras esta ronda</div>';
      }
      safeShowElement(this.elements.resultsSection);
      return;
    }

    let html = '<div class="results-title">📊 Tus Resultados</div>';

    for (const match of matches) {
      const icon = match.matched ? '✅' : '❌';
      const word = sanitizeText(match.word);
      let resultHtml = `<div class="result-item ${match.matched ? 'match' : 'no-match'}">`;
      resultHtml += `<div class="result-word">${icon} ${word}</div>`;

      if (match.matched && match.matchedPlayers && match.matchedPlayers.length > 0) {
        const playerNames = match.matchedPlayers.map(name => sanitizeText(name)).join(', ');
        resultHtml += `<div class="result-players">Coincidió con: ${playerNames}</div>`;
      } else if (!match.matched) {
        resultHtml += `<div class="result-players">Sin coincidencias</div>`;
      }

      resultHtml += '</div>';
      html += resultHtml;
    }

    if (this.elements.resultsSection) {
      this.elements.resultsSection.innerHTML = html;
    }

    safeShowElement(this.elements.resultsSection);
  }

  showResults(myResults, myAnswers, isReady) {
    safeHideElement(this.elements.wordsInputSection);
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.waitingMessage);
    safeHideElement(this.elements.countdownOverlay);
    this.clearTimer();

    if (!myResults || Object.keys(myResults).length === 0) {
      const sentAnswers = myAnswers && Array.isArray(myAnswers) && myAnswers.length > 0;
      if (!sentAnswers) {
        if (this.elements.resultsSection) {
          this.elements.resultsSection.innerHTML = '<div class="waiting-message">❌ No enviaste palabras esta ronda</div>';
        }
      } else {
        if (this.elements.resultsSection) {
          this.elements.resultsSection.innerHTML = '<div class="waiting-message">⏳ Esperando resultados...</div>';
        }
      }
    } else {
      let html = '<div class="results-title">📊 Tus Resultados</div>';
      let roundScore = 0;

      Object.entries(myResults).forEach(([word, result]) => {
        const hasMatch = result.count > 1;
        const icon = hasMatch ? '✅' : '❌';
        html += `
          <div class="result-item ${hasMatch ? 'match' : 'no-match'}">
            <div class="result-word">${icon} ${sanitizeText(word)}</div>
            <div class="result-points">+${result.points} puntos</div>
            ${hasMatch ? `<div class="result-players">Coincidió con: ${(result.matched_with || []).join(', ')}</div>` : ''}
          </div>
        `;
        roundScore += result.points;
      });

      html += `<div class="total-score">Total ronda: ${roundScore} pts</div>`;

      if (this.elements.resultsSection) {
        this.elements.resultsSection.innerHTML = html;
      }
    }

    safeShowElement(this.elements.resultsSection);
  }

  showFinalResults() {
    if (this.elements.waitingMessage) {
      this.elements.waitingMessage.textContent = '🎉 ¡Juego terminado!';
      safeShowElement(this.elements.waitingMessage);
    }
  }

  showCountdownOverlay() {
    if (this.elements.countdownOverlay) {
      safeShowElement(this.elements.countdownOverlay);
    } else {
      debug('⚠️ [PlayerView] countdownOverlay element not found, skipping show', null, 'warn');
    }
  }

  hideCountdownOverlay() {
    if (this.elements.countdownOverlay) {
      safeHideElement(this.elements.countdownOverlay);
    }
  }

  updateCountdownNumber(seconds) {
    if (!this.elements.countdownNumber) {
      debug('⚠️ [PlayerView] countdownNumber element not found, skipping update', null, 'warn');
      return;
    }

    if (seconds > 3) {
      this.elements.countdownNumber.textContent = '¿Preparado?';
    } else if (seconds > 0) {
      this.elements.countdownNumber.textContent = seconds.toString();
    } else {
      this.elements.countdownNumber.textContent = '';
    }
  }

  showEditNameModal(currentName, currentColor, onSave) {
    const content = this.buildEditNameContent(currentName, currentColor);
    const htmlString = content.innerHTML;

    ModalSystem_Instance.show(
      2,
      htmlString,
      [
        [
          () => ModalSystem_Instance.close(2),
          'Cancelar',
          'btn'
        ],
        [
          () => {
            const nameInput = document.querySelector('#modal-edit-name');
            const selectedAura = this.getSelectedEditAura();
            onSave(nameInput.value, selectedAura);
            ModalSystem_Instance.close(2);
          },
          'Guardar',
          'btn-modal-primary'
        ]
      ]
    );
  }

  buildEditNameContent(currentName, currentColor) {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="input-group">
        <label class="input-label" for="modal-edit-name">Nuevo Nombre</label>
        <input type="text" id="modal-edit-name" class="input-field" maxlength="20" autocomplete="off">
      </div>
      <div class="input-group" style="margin-top: 15px;">
        <label class="input-label">✨ Tu Aura</label>
        <div class="aura-selector" id="modal-edit-aura"></div>
      </div>
    `;

    const nameInput = container.querySelector('#modal-edit-name');
    const auraSelector = container.querySelector('#modal-edit-aura');

    nameInput.value = currentName;

    let selectedAura = currentColor;
    renderAuraSelectorsEdit(
      auraSelector,
      currentColor,
      (aura) => {
        selectedAura = aura.hex;
      }
    );

    this._editData = { selectedAura };

    return container;
  }

  getSelectedEditAura() {
    return this._editData?.selectedAura || null;
  }
}

console.log('%c✅ PlayerView.js', 'color: #00aa00; font-weight: bold');