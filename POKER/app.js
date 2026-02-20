(function () {
  'use strict';

  // ── Rounds ────────────────────────────────────────────────────────────────
  const ROUNDS = ['Apuesta inicial', 'Flop', 'Turn', 'River'];
  const ROUND_INDEX_MAX = 3;

  // ── Chip types ────────────────────────────────────────────────────────────
  const CHIPS = [
    { v: 1000, c: 'black'  },
    { v: 500,  c: 'purple' },
    { v: 100,  c: 'blue'   },
    { v: 25,   c: 'green'  },
    { v: 5,    c: 'red'    },
    { v: 1,    c: 'white'  },
  ];

  // ── Hand definitions with mini card data ─────────────────────────────────
  // Each card: [value, suit]  suit: ♥ ♦ (red)  ♠ ♣ (black)
  const HANDS = [
    {
      rank: 1, name: 'Escalera Real',
      desc: '10 J Q K A del mismo palo',
      cards: [['10','♥'],['J','♥'],['Q','♥'],['K','♥'],['A','♥']],
    },
    {
      rank: 2, name: 'Escalera de Color',
      desc: '5 seguidas del mismo palo',
      cards: [['7','♠'],['8','♠'],['9','♠'],['10','♠'],['J','♠']],
    },
    {
      rank: 3, name: 'Póker',
      desc: '4 cartas iguales',
      cards: [['K','♠'],['K','♥'],['K','♦'],['K','♣'],['3','♥']],
    },
    {
      rank: 4, name: 'Full',
      desc: 'Trío + Pareja',
      cards: [['A','♥'],['A','♣'],['A','♦'],['7','♠'],['7','♥']],
    },
    {
      rank: 5, name: 'Color',
      desc: '5 cartas del mismo palo',
      cards: [['2','♦'],['5','♦'],['7','♦'],['J','♦'],['K','♦']],
    },
    {
      rank: 6, name: 'Escalera',
      desc: '5 cartas consecutivas',
      cards: [['4','♣'],['5','♥'],['6','♠'],['7','♦'],['8','♣']],
    },
    {
      rank: 7, name: 'Trío',
      desc: '3 cartas iguales',
      cards: [['Q','♣'],['Q','♥'],['Q','♦'],['6','♠'],['2','♥']],
    },
    {
      rank: 8, name: 'Doble Pareja',
      desc: 'Dos parejas distintas',
      cards: [['J','♠'],['J','♥'],['8','♦'],['8','♣'],['3','♥']],
    },
    {
      rank: 9, name: 'Pareja',
      desc: 'Dos cartas iguales',
      cards: [['9','♣'],['9','♦'],['A','♥'],['6','♠'],['2','♣']],
    },
    {
      rank: 10, name: 'Carta Alta',
      desc: 'Ninguna combinación',
      cards: [['K','♥'],['J','♠'],['8','♦'],['5','♣'],['2','♥']],
    },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    initialMoney: 1000,
    blind: 10,
    players: [],
    pot: 0,
    roundIndex: 0,
    currentTurnIndex: 0,
    firstToActThisRound: 0,
    maxBetThisRound: 0,
    hasRaiseThisRound: false,
    lastActorIndex: -1,
    handNumber: 0,
    selectedWinnerIndex: null,
    tieMode: false,
    tiedPlayerIndices: [],
  };

  const $ = id => document.getElementById(id);

  const showScreen = id => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getActivePlayers = () => state.players.filter(p => !p.folded);
  const getActiveCount   = () => getActivePlayers().length;
  const currentPlayer    = () => state.players[state.currentTurnIndex];
  const escapeHtml = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  function nextTurnIndex() {
    let i = (state.currentTurnIndex + 1) % state.players.length;
    while (state.players[i].folded && i !== state.currentTurnIndex)
      i = (i + 1) % state.players.length;
    return i;
  }

  function allBetsMatchedOrFolded() {
    const active = getActivePlayers();
    if (active.length <= 1) return true;
    return active.every(p => p.currentBet >= state.maxBetThisRound || p.balance === 0);
  }

  // ── Chips ──────────────────────────────────────────────────────────────────
  function renderChips(container, amount) {
    if (!container) return;
    container.innerHTML = '';
    if (amount <= 0) return;
    let rem = amount;
    let total = 0;
    for (const chip of CHIPS) {
      const n = Math.min(Math.floor(rem / chip.v), 8);
      rem -= n * chip.v;
      for (let i = 0; i < n && total < 20; i++, total++) {
        const el = document.createElement('div');
        el.className = 'chip ' + chip.c;
        el.title = chip.v;
        container.appendChild(el);
      }
      if (total >= 20) break;
    }
  }

  // ── Hand illustrations ─────────────────────────────────────────────────────
  function buildMiniCard(value, suit) {
    const red = suit === '♥' || suit === '♦';
    const el = document.createElement('div');
    el.className = 'mc ' + (red ? 'red' : 'blk');
    el.innerHTML = `<span class="cv">${value}</span><span class="cs">${suit}</span>`;
    return el;
  }

  function buildHandEntry(hand, compact) {
    const entry = document.createElement('div');
    entry.className = 'hand-entry';

    const rank = document.createElement('span');
    rank.className = 'hand-rank';
    rank.textContent = hand.rank;
    entry.appendChild(rank);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'hand-cards';
    hand.cards.forEach(([v, s]) => cardsWrap.appendChild(buildMiniCard(v, s)));
    entry.appendChild(cardsWrap);

    const info = document.createElement('div');
    info.className = 'hand-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'hand-info-name';
    nameEl.textContent = hand.name;
    info.appendChild(nameEl);
    if (!compact) {
      const descEl = document.createElement('div');
      descEl.className = 'hand-info-desc';
      descEl.textContent = hand.desc;
      info.appendChild(descEl);
    }
    entry.appendChild(info);
    return entry;
  }

  function renderHandsList(containerId, compact) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    HANDS.forEach(h => container.appendChild(buildHandEntry(h, compact)));
  }

  // ── Round dots ──────────────────────────────────────────────────────────────
  function updateRoundDots() {
    for (let i = 0; i <= 3; i++) {
      const dot = $('rdot-' + i);
      if (dot) dot.classList.toggle('active', i <= state.roundIndex);
    }
  }

  // ── Poker table layout ──────────────────────────────────────────────────────
  function getSeatPositions(n) {
    const positions = [];
    // rx/ry are % of wrapper dimensions from center
    // Keep them well inside so cards never clip
    const rx = 43, ry = 40;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      positions.push({
        x: 50 + rx * Math.cos(angle),
        y: 50 + ry * Math.sin(angle),
      });
    }
    return positions;
  }

  function sizeTable() {
    const arena = $('game-arena');
    const wrapper = $('poker-table-wrapper');
    if (!arena || !wrapper) return;

    const aw = arena.clientWidth;
    const ah = arena.clientHeight;

    // Generous padding so top/bottom seats never clip
    const padH = 165;
    const padW = 140;

    const maxW = aw - padW * 2;
    const maxH = ah - padH * 2;

    let tw = Math.min(maxW, maxH * 1.7);
    let th = tw / 1.7;
    if (th > maxH) { th = maxH; tw = th * 1.7; }

    tw = Math.max(tw, 240);
    th = Math.max(th, 140);

    wrapper.style.width  = (tw + padW * 2) + 'px';
    wrapper.style.height = (th + padH * 2) + 'px';

    const table = wrapper.querySelector('.poker-table');
    table.style.width    = tw + 'px';
    table.style.height   = th + 'px';
    table.style.position = 'absolute';
    table.style.left     = padW + 'px';
    table.style.top      = padH + 'px';
  }

  function renderGame() {
    const roundLabel = $('current-round-label');
    if (roundLabel) roundLabel.textContent = ROUNDS[state.roundIndex] || 'Fin';
    const potEl = $('pot-amount');
    if (potEl) potEl.textContent = state.pot;
    renderChips($('pot-chips'), state.pot);
    updateRoundDots();

    const seatsEl = $('players-seats');
    if (!seatsEl) return;
    seatsEl.innerHTML = '';

    const wrapper = $('poker-table-wrapper');
    if (!wrapper) return;
    const ww = wrapper.clientWidth  || 1;
    const wh = wrapper.clientHeight || 1;
    const n  = state.players.length;
    if (n === 0) return;

    const positions = getSeatPositions(n);

    state.players.forEach((p, i) => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      // Positions are in % of wrapper
      seat.style.left = positions[i].x + '%';
      seat.style.top  = positions[i].y + '%';

      const card = document.createElement('div');
      card.className = 'player-card'
        + (i === state.currentTurnIndex && !p.folded ? ' current-turn' : '')
        + (p.folded ? ' folded' : '');

      card.innerHTML =
        `<div class="name">${escapeHtml(p.name)}</div>` +
        `<div class="balance">${p.balance} 🪙</div>` +
        (p.currentBet > 0 ? `<div class="bet">Apuesta: ${p.currentBet}</div>` : '');

      seat.appendChild(card);
      seatsEl.appendChild(seat);
    });
  }

  // ── Turn panel ─────────────────────────────────────────────────────────────
  function updateTurnPanel() {
    const actionBar = $('action-bar');
    const active = getActivePlayers();
    if (active.length <= 1) { actionBar.style.display = 'none'; return; }
    actionBar.style.display = 'flex';

    const p = currentPlayer();
    if (!p || p.folded) { state.currentTurnIndex = nextTurnIndex(); updateTurnPanel(); return; }
    if (p.balance === 0) {
      state.lastActorIndex = state.currentTurnIndex;
      state.currentTurnIndex = nextTurnIndex();
      if (roundComplete()) maybeEndRound();
      renderGame(); updateTurnPanel(); return;
    }

    $('current-player-name').textContent = p.name;
    $('btn-pass').hidden = state.hasRaiseThisRound;
    $('btn-call').hidden = !state.hasRaiseThisRound;

    const toCall = state.maxBetThisRound - p.currentBet;
    if (toCall > 0) {
      $('btn-call').textContent = (p.balance <= toCall && p.balance > 0)
        ? `🟡 Igualar (todo: ${p.balance})`
        : `🟡 Igualar (${toCall})`;
    } else {
      $('btn-call').textContent = '✋ Pasar';
    }
    renderGame();
  }

  // ── Game flow ──────────────────────────────────────────────────────────────
  function startNewHand() {
    state.pot = 0;
    state.roundIndex = 0;
    state.maxBetThisRound = state.blind;
    state.hasRaiseThisRound = false;
    state.lastActorIndex = -1;
    state.players.forEach(p => { p.folded = false; p.currentBet = 0; });
    const active = getActivePlayers();
    if (active.length === 0) return;
    active.forEach(p => {
      const toPay = Math.min(state.blind, p.balance);
      p.currentBet = toPay; p.balance -= toPay;
    });
    state.currentTurnIndex = state.players.findIndex(p => !p.folded);
    if (state.currentTurnIndex < 0) state.currentTurnIndex = 0;
    state.firstToActThisRound = state.currentTurnIndex;
    sizeTable();
    renderGame();
    updateTurnPanel();
  }

  function advanceRound() {
    state.players.forEach(p => { state.pot += p.currentBet; p.currentBet = 0; });
    state.maxBetThisRound = 0;
    state.hasRaiseThisRound = false;
    state.lastActorIndex = -1;
    state.roundIndex++;
  }

  function roundComplete() {
    return state.currentTurnIndex === state.firstToActThisRound;
  }

  function maybeEndRound() {
    if (!allBetsMatchedOrFolded()) return;
    const active = getActiveCount();
    if (active <= 1) {
      state.players.forEach(p => { state.pot += p.currentBet; p.currentBet = 0; });
      finishHand(); return;
    }
    advanceRound();
    if (state.roundIndex > ROUND_INDEX_MAX) { finishHand(); return; }
    const first = state.players.findIndex(p => !p.folded);
    state.currentTurnIndex = first >= 0 ? first : 0;
    state.firstToActThisRound = state.currentTurnIndex;
    renderGame(); updateTurnPanel();
  }

  function finishHand() {
    state.selectedWinnerIndex = null;
    state.tieMode = false;
    state.tiedPlayerIndices = [];
    const potEl = $('end-pot-amount');
    if (potEl) potEl.textContent = state.pot;
    renderChips($('end-pot-chips'), state.pot);
    showScreen('end-screen');
    renderEndScreen();
  }

  function renderEndScreen() {
    const container  = $('winner-buttons');
    const tieSection = $('end-tie-section');
    const winnerLabel = $('end-winner-label');
    const candidates = getActivePlayers();
    const playersToShow = candidates.length > 0 ? candidates : state.players;

    container.innerHTML = '';
    tieSection.innerHTML = '';

    if (state.tieMode) {
      tieSection.hidden = false;
      const p = document.createElement('p');
      p.className = 'end-tie-question';
      p.textContent = '¿Qué jugadores han empatado?';
      tieSection.appendChild(p);
      const list = document.createElement('div');
      list.className = 'end-tie-checkboxes';
      playersToShow.forEach(player => {
        const idx = state.players.indexOf(player);
        const label = document.createElement('label');
        label.className = 'end-tie-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.tiedPlayerIndices.includes(idx);
        cb.dataset.index = idx;
        cb.addEventListener('change', function() { toggleTiedPlayer(Number(this.dataset.index)); });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(player.name));
        list.appendChild(label);
      });
      tieSection.appendChild(list);
      if (state.tiedPlayerIndices.length >= 2) {
        const s = document.createElement('p');
        s.className = 'end-winner-label'; s.style.marginTop = '.5rem';
        s.textContent = 'Empatados: ' + state.tiedPlayerIndices.map(i => state.players[i].name).join(', ');
        tieSection.appendChild(s);
      }
      playersToShow.forEach(p => {
        const idx = state.players.indexOf(p);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = p.name; btn.dataset.index = idx;
        btn.addEventListener('click', function() { selectWinner(Number(this.dataset.index)); });
        container.appendChild(btn);
      });
      const eb = document.createElement('button');
      eb.type = 'button'; eb.className = 'btn-empate active'; eb.textContent = 'Empate';
      eb.addEventListener('click', () => { state.tieMode = false; state.tiedPlayerIndices = []; renderEndScreen(); });
      container.appendChild(eb);
    } else {
      tieSection.hidden = true;
      playersToShow.forEach(p => {
        const idx = state.players.indexOf(p);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = p.name; btn.dataset.index = idx;
        btn.className = state.selectedWinnerIndex === idx ? 'winner-selected' : '';
        btn.addEventListener('click', function() { selectWinner(Number(this.dataset.index)); });
        container.appendChild(btn);
      });
      const eb = document.createElement('button');
      eb.type = 'button'; eb.className = 'btn-empate'; eb.textContent = 'Empate';
      eb.addEventListener('click', () => { state.tieMode = true; state.selectedWinnerIndex = null; state.tiedPlayerIndices = []; renderEndScreen(); });
      container.appendChild(eb);
    }

    if (winnerLabel) {
      if (state.selectedWinnerIndex !== null) {
        winnerLabel.textContent = '🏆 Ganador: ' + state.players[state.selectedWinnerIndex].name;
        winnerLabel.hidden = false;
      } else {
        winnerLabel.hidden = true;
      }
    }
    const nextBtn = $('next-hand-btn');
    const canContinue = state.selectedWinnerIndex !== null || (state.tieMode && state.tiedPlayerIndices.length >= 2);
    if (nextBtn) nextBtn.disabled = !canContinue;
  }

  function toggleTiedPlayer(idx) {
    const i = state.tiedPlayerIndices.indexOf(idx);
    if (i === -1) state.tiedPlayerIndices.push(idx);
    else state.tiedPlayerIndices.splice(i, 1);
    state.tiedPlayerIndices.sort((a, b) => a - b);
    renderEndScreen();
  }

  function selectWinner(idx) {
    state.selectedWinnerIndex = idx;
    state.tieMode = false;
    state.tiedPlayerIndices = [];
    renderEndScreen();
  }

  function confirmWinnerAndNextHand() {
    const isTie = state.tieMode && state.tiedPlayerIndices.length >= 2;
    if (!isTie && state.selectedWinnerIndex === null) return;
    const n = isTie ? state.tiedPlayerIndices.length : 1;
    const base = Math.floor(state.pot / n);
    const rem  = state.pot - base * n;
    if (isTie) {
      state.tiedPlayerIndices.forEach((idx, i) => {
        state.players[idx].balance += base + (i < rem ? 1 : 0);
      });
    } else {
      state.players[state.selectedWinnerIndex].balance += state.pot;
    }
    state.pot = 0;
    state.handNumber++;
    state.selectedWinnerIndex = null;
    state.tieMode = false;
    state.tiedPlayerIndices = [];
    const busted = state.players.filter(p => p.balance <= 0);
    if (state.handNumber >= 1 && busted.length > 0) {
      showRejoinModal();
    } else {
      showScreen('game-screen');
      startNewHand();
    }
  }

  function showRejoinModal() {
    const textEl = $('rejoin-text');
    const busted = state.players.filter(p => p.balance <= 0);
    if (textEl) textEl.textContent = busted.map(p => p.name).join(', ') + ' se han quedado sin fichas. ¿Quieren volver a jugar?';
    $('rejoin-modal').removeAttribute('hidden');
  }

  function closeRejoinAndContinue(yes) {
    $('rejoin-modal').setAttribute('hidden', '');
    if (yes) {
      state.players.forEach(p => { if (p.balance <= 0) p.balance = state.initialMoney; });
    } else {
      state.players = state.players.filter(p => p.balance > 0);
    }
    showScreen('game-screen');
    startNewHand();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function actPass() {
    if (state.hasRaiseThisRound) return;
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    renderGame(); updateTurnPanel();
  }

  function actCall() {
    const p = currentPlayer();
    const toCall = state.maxBetThisRound - p.currentBet;
    const pay = Math.min(toCall, p.balance);
    p.currentBet += pay; p.balance -= pay;
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    renderGame(); updateTurnPanel();
  }

  function actRaise(totalAmount) {
    const p = currentPlayer();
    const toPay = Math.min(Math.max(0, totalAmount - p.currentBet), p.balance);
    if (toPay <= 0) return;
    p.currentBet += toPay; p.balance -= toPay;
    if (p.currentBet > state.maxBetThisRound) {
      state.maxBetThisRound = p.currentBet;
      state.hasRaiseThisRound = true;
    }
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    renderGame(); updateTurnPanel();
  }

  function actFold() {
    const p = currentPlayer();
    p.folded = true;
    if (getActiveCount() <= 1) { maybeEndRound(); return; }
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete() || getActiveCount() <= 1) maybeEndRound();
    renderGame(); updateTurnPanel();
  }

  // ── Raise modal ────────────────────────────────────────────────────────────
  function openRaiseModal() {
    const p = currentPlayer();
    const hint = $('raise-hint');
    if (hint) hint.textContent = `Tu apuesta actual: ${p.currentBet} · Saldo: ${p.balance}`;
    $('raise-amount').value = p.currentBet > 0 ? p.currentBet : '';
    $('raise-modal').hidden = false;
    $('raise-amount').focus();
  }

  function applyQuickBet(add) {
    const input = $('raise-amount');
    const p = currentPlayer();
    const min = p.currentBet + 1;
    const cur = parseInt(input.value, 10) || min;
    input.value = Math.max(min, cur + add);
  }

  function applyAllIn() {
    const p = currentPlayer();
    $('raise-amount').value = p.currentBet + p.balance;
  }

  function confirmRaise() {
    const raw = $('raise-amount').value;
    const total = parseInt(raw, 10);
    const p = currentPlayer();
    if (!total || total <= p.currentBet) return;
    if (total - p.currentBet > p.balance) return;
    $('raise-modal').hidden = true;
    actRaise(total);
  }

  // ── Setup player tag ──────────────────────────────────────────────────────
  function addPlayerTag(name) {
    if (!name || state.players.find(p => p.name === name)) return false;
    const list = $('players-list');
    const tag  = document.createElement('span');
    tag.className = 'player-tag';
    tag.textContent = name;
    const rem = document.createElement('button');
    rem.textContent = '×'; rem.setAttribute('aria-label', 'Quitar');
    rem.addEventListener('click', () => {
      const i = state.players.findIndex(p => p.name === name);
      if (i !== -1) state.players.splice(i, 1);
      tag.remove();
    });
    tag.appendChild(rem);
    list.appendChild(tag);
    state.players.push({ name, balance: state.initialMoney, currentBet: 0, folded: false });
    return true;
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  function setupListeners() {
    // Setup
    $('add-player-btn').addEventListener('click', () => {
      const inp = $('new-player-name');
      if (addPlayerTag(inp.value.trim())) inp.value = '';
    });
    $('new-player-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('add-player-btn').click(); });

    $('start-game-btn').addEventListener('click', () => {
      const initial = parseInt($('initial-money').value, 10);
      const blind   = parseInt($('blind-bet').value, 10);
      const err = $('setup-errors');
      if (!initial || initial < 1) { err.textContent = 'Indica un dinero inicial válido.'; err.hidden = false; return; }
      if (!blind || blind < 1)     { err.textContent = 'Indica una apuesta obligatoria válida.'; err.hidden = false; return; }
      if (state.players.length < 2){ err.textContent = 'Añade al menos 2 jugadores.'; err.hidden = false; return; }
      err.hidden = true;
      state.initialMoney = initial;
      state.blind = blind;
      state.players.forEach(p => { p.balance = initial; p.currentBet = 0; p.folded = false; });
      showScreen('game-screen');
      // sizeTable called inside startNewHand
      startNewHand();
    });

    // Game actions
    $('btn-pass').addEventListener('click', actPass);
    $('btn-call').addEventListener('click', actCall);
    $('btn-fold').addEventListener('click', actFold);
    $('btn-raise').addEventListener('click', openRaiseModal);

    // Raise modal
    $('raise-cancel').addEventListener('click', () => { $('raise-modal').hidden = true; });
    $('raise-confirm').addEventListener('click', confirmRaise);
    $('raise-amount').addEventListener('keydown', e => { if (e.key === 'Enter') confirmRaise(); });
    document.querySelectorAll('.qb[data-add]').forEach(btn => {
      btn.addEventListener('click', () => applyQuickBet(parseInt(btn.dataset.add, 10)));
    });
    document.querySelectorAll('.qb[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => applyQuickBet(-parseInt(btn.dataset.sub, 10)));
    });
    $('btn-allin').addEventListener('click', applyAllIn);

    // Hands overlay
    $('hands-toggle-btn').addEventListener('click', () => {
      const ov = $('hands-overlay');
      ov.hidden = !ov.hidden;
    });
    $('hands-overlay-close').addEventListener('click', () => {
      $('hands-overlay').hidden = true;
    });

    // End screen
    $('next-hand-btn').addEventListener('click', () => {
      const ok = state.selectedWinnerIndex !== null || (state.tieMode && state.tiedPlayerIndices.length >= 2);
      if (!ok) return;
      confirmWinnerAndNextHand();
    });

    $('add-player-between-btn').addEventListener('click', () => {
      $('new-player-between-name').value = '';
      $('add-player-modal').hidden = false;
      $('new-player-between-name').focus();
    });
    $('add-player-between-cancel').addEventListener('click', () => { $('add-player-modal').hidden = true; });
    $('add-player-between-confirm').addEventListener('click', () => {
      const name = ($('new-player-between-name').value || '').trim();
      if (!name) return;
      if (state.players.find(p => p.name === name)) { alert('Ya existe un jugador con ese nombre.'); return; }
      state.players.push({ name, balance: state.initialMoney, currentBet: 0, folded: false });
      $('add-player-modal').hidden = true;
      renderEndScreen();
    });
    $('new-player-between-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('add-player-between-confirm').click(); });

    // Rejoin
    $('rejoin-yes').addEventListener('click', () => closeRejoinAndContinue(true));
    $('rejoin-no').addEventListener('click',  () => closeRejoinAndContinue(false));

    // Resize table when window resizes
    window.addEventListener('resize', () => {
      if (document.getElementById('game-screen').classList.contains('active')) {
        sizeTable(); renderGame();
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Render hands lists on all screens
    renderHandsList('setup-hands-list', false);
    renderHandsList('game-hands-list', true);
    renderHandsList('end-hands-list', true);
    setupListeners();
    showScreen('setup-screen');
  }

  init();
})();
