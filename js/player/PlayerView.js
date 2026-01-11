class PlayerView {
  constructor(maxWords = 6) {
    this.maxWords = maxWords;
    this.elements = this.cacheElements();
    this.initializeVisibility();
    this._joinData = { selectedColor: null };
    this._editData = { selectedAura: null };
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
      countdownOverlay: getElement('countdown-overlay'),
      countdownNumber: getElement('countdown-number'),
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
    safeHideElement(this.elements.countdownOverlay);
  }

  bindAddWord(handler) {
    this.elements.btnAddWord.addEventListener('click', () => handler());
  }

  bindKeyPressInInput(handler) {
    this.elements.currentWordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handler();
    });
  }

  bindInputEvent(handler) {
    this.elements.currentWordInput.addEventListener('input', (e) => {
      e.target.value = sanitizeInputValue(e.target.value);
      handler();
    });
  }

  bindSubmit(handler) {
    this.elements.btnSubmit.addEventListener('click', () => handler());
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

    setTimeout(() => {
      this.attachJoinScreenListeners();
      this.initializeAuraSelector();
    }, 50);
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

    return container;
  }

  initializeAuraSelector() {
    const auraSelector = document.querySelector('#modal-aura-selector');
    if (!auraSelector) return;

    const availableAuras = auraModuleInstance.generateRandomAuras();
    const randomAura = availableAuras[Math.floor(Math.random() * availableAuras.length)];

    this._joinData.selectedColor = randomAura.hex;

    auraModuleInstance.renderAuraSelectors(
      auraSelector,
      availableAuras,
      randomAura.hex,
      (aura) => {
        this._joinData.selectedColor = aura.hex;
      }
    );
  }

  attachJoinScreenListeners() {
    const codeInput = document.querySelector('#modal-join-code');
    const nameInput = document.querySelector('#modal-join-name');

    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        e.target.value = sanitizeInputValue(e.target.value);
      });

      codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') nameInput.focus();
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        e.target.value = sanitizeInputValue(e.target.value);
      });

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
      auraModuleInstance.applyColorGradient(playerColor);
    }

    ModalSystem_Instance.close(1);
    safeShowElement(this.elements.gameScreen);

    this.elements.headerCode.textContent = gameCode;
    this.elements.playerNameDisplay.textContent = playerName;
  }

  setRoundInfo(round, total) {
    this.elements.headerRound.textContent = `Ronda ${round}/${total}`;
  }

  setPlayerScore(score) {
    this.elements.playerScore.textContent = score + ' pts';
  }

  updateTimer(remaining, totalDuration) {
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
    this.elements.headerTimer.textContent = '⏳ 00:00';
    this.elements.headerTimer.style.opacity = '1';
  }

  showWaitingState() {
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeShowElement(this.elements.waitingMessage);
    this.elements.waitingMessage.textContent = 'El anfitrión iniciará la ronda pronto';
    safeHideElement(this.elements.wordsInputSection);
    safeHideElement(this.elements.resultsSection);
    safeHideElement(this.elements.countdownOverlay);
    this.clearTimer();
  }

  showPlayingState(currentWord, category, hasPlayerAnswers, isReady) {
    safeHideElement(this.elements.resultsSection);
    safeHideElement(this.elements.waitingMessage);

    this.elements.currentWord.classList.remove('hidden');
    this.elements.wordsInputSection.classList.remove('hidden');

    this.elements.currentWord.textContent = currentWord || '???';
    safeShowElement(this.elements.currentWord);

    if (category) {
      this.elements.categoryLabel.textContent = `Categoría: ${category}`;
      safeShowElement(this.elements.categoryLabel);
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

    this.elements.currentWordInput.disabled = isAtMax;
    this.elements.currentWordInput.placeholder = isAtMax
      ? `Máximo ${this.maxWords} palabras`
      : 'Ingresa una palabra...';

    this.elements.btnAddWord.disabled = false;

    this.elements.btnSubmit.disabled = false;
    this.updateFinishButtonText(hasAnswers);

    safeHideElement(this.elements.waitingMessage);
    safeShowElement(this.elements.wordsInputSection);

    this.elements.wordsListContainer.classList.remove('read-only');
  }

  setReadOnlyMode() {
    this.elements.currentWordInput.disabled = true;
    this.elements.currentWordInput.placeholder = '✅ Terminaste';
    this.elements.btnAddWord.disabled = false;
    this.elements.btnSubmit.disabled = false;
    this.elements.btnSubmit.textContent = '👏 LISTO';

    this.elements.waitingMessage.textContent = 'Esperando a los demás jugadores...';
    safeShowElement(this.elements.waitingMessage);

    this.elements.wordsListContainer.classList.add('read-only');
  }

  updateWordChips(words) {
    this.elements.wordCount.textContent = words.length;

    if (words.length > 0) {
      this.elements.wordsListContainer.classList.remove('hidden');
      safeShowElement(this.elements.wordsListContainer);

      this.elements.wordsList.innerHTML = words.map((word, idx) => `
        <div class="word-item" onclick="playerManager.removeWord(${idx})">
          <span class="word-text">${sanitizeText(word)}</span>
          <span class="word-delete">✍️</span>
        </div>
      `).join('');
    } else {
      safeHideElement(this.elements.wordsListContainer);
    }
  }

  getInputValue() {
    return this.elements.currentWordInput.value;
  }

  setInputValue(value) {
    this.elements.currentWordInput.value = sanitizeInputValue(value);
  }

  clearInput() {
    this.elements.currentWordInput.value = '';
  }

  focusInput() {
    this.elements.currentWordInput.focus();
  }

  updateFinishButtonText(wordCount) {
    if (wordCount === this.maxWords) {
      this.elements.btnSubmit.textContent = '✍️ ENVÍAR';
    } else {
      this.elements.btnSubmit.textContent = '✍️ PASO';
    }
  }

  showRoundResults(resultData) {
    safeHideElement(this.elements.wordsInputSection);
    safeHideElement(this.elements.currentWord);
    safeHideElement(this.elements.categoryLabel);
    safeHideElement(this.elements.waitingMessage);
    safeHideElement(this.elements.countdownOverlay);
    this.clearTimer();

    const hasResults = resultData && 
      ((Array.isArray(resultData) && resultData.length > 0) || 
       (typeof resultData === 'object' && !Array.isArray(resultData) && Object.keys(resultData).length > 0));

    if (!hasResults) {
      this.elements.resultsSection.innerHTML = '<div class="waiting-message">❌ No enviaste palabras esta ronda</div>';
      safeShowElement(this.elements.resultsSection);
      return;
    }

    let html = '<div class="results-title">📈 Tus Resultados</div>';
    let roundScore = 0;

    if (Array.isArray(resultData)) {
      for (const match of resultData) {
        const icon = match.matched ? '✅' : '❌';
        const word = sanitizeText(match.word);
        let resultHtml = `<div class="result-item ${match.matched ? 'match' : 'no-match')}">`;
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
    } else {
      Object.entries(resultData).forEach(([word, result]) => {
        const hasMatch = result.count > 1;
        const icon = hasMatch ? '✅' : '❌';
        const points = result.points || 0;
        html += `
          <div class="result-item ${hasMatch ? 'match' : 'no-match'}">
            <div class="result-word">${icon} ${sanitizeText(word)}</div>
            <div class="result-points">+${points} puntos</div>
            ${hasMatch ? `<div class="result-players">Coincidió con: ${(result.matched_with || []).join(', ')}</div>` : ''}
          </div>
        `;
        roundScore += points;
      });
      html += `<div class="total-score">Total ronda: ${roundScore} pts</div>`;
    }

    this.elements.resultsSection.innerHTML = html;
    safeShowElement(this.elements.resultsSection);
  }

  showFinalResults() {
    this.elements.waitingMessage.textContent = '🎉 ¡Juego terminado!';
    safeShowElement(this.elements.waitingMessage);
  }

  showCountdownOverlay() {
    safeShowElement(this.elements.countdownOverlay);
  }

  hideCountdownOverlay() {
    safeHideElement(this.elements.countdownOverlay);
  }

  updateCountdownNumber(seconds) {
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

    setTimeout(() => {
      this.attachEditNameListeners();
      this.initializeEditAuraSelector(currentColor);
    }, 50);
  }

  buildEditNameContent(currentName, currentColor) {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="input-group">
        <label class="input-label" for="modal-edit-name">Nuevo Nombre</label>
        <input type="text" id="modal-edit-name" class="input-field" maxlength="20" autocomplete="off" value="${sanitizeText(currentName)}">
      </div>
      <div class="input-group" style="margin-top: 15px;">
        <label class="input-label">✨ Tu Aura</label>
        <div class="aura-selector" id="modal-edit-aura"></div>
      </div>
    `;

    return container;
  }

  attachEditNameListeners() {
    const nameInput = document.querySelector('#modal-edit-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        e.target.value = sanitizeInputValue(e.target.value);
      });
    }
  }

  initializeEditAuraSelector(currentColor) {
    const auraSelector = document.querySelector('#modal-edit-aura');
    if (!auraSelector) return;

    this._editData.selectedAura = currentColor;

    auraModuleInstance.renderAuraSelectorsEdit(
      auraSelector,
      currentColor,
      (aura) => {
        this._editData.selectedAura = aura.hex;
      }
    );
  }

  getSelectedEditAura() {
    return this._editData?.selectedAura || null;
  }
}

console.log('%c✅ PlayerView.js', 'color: #00aa00; font-weight: bold');
