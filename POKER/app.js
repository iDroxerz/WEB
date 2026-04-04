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

  // ── Hand definitions ──────────────────────────────────────────────────────
  const HANDS = [
    { rank: 1,  name: 'Escalera Real',    desc: '10 J Q K A del mismo palo',   cards: [['10','♥'],['J','♥'],['Q','♥'],['K','♥'],['A','♥']] },
    { rank: 2,  name: 'Escalera de Color',desc: '5 seguidas del mismo palo',    cards: [['7','♠'],['8','♠'],['9','♠'],['10','♠'],['J','♠']] },
    { rank: 3,  name: 'Póker',            desc: '4 cartas iguales',             cards: [['K','♠'],['K','♥'],['K','♦'],['K','♣'],['3','♥']] },
    { rank: 4,  name: 'Full',             desc: 'Trío + Pareja',                cards: [['A','♥'],['A','♣'],['A','♦'],['7','♠'],['7','♥']] },
    { rank: 5,  name: 'Color',            desc: '5 cartas del mismo palo',      cards: [['2','♦'],['5','♦'],['7','♦'],['J','♦'],['K','♦']] },
    { rank: 6,  name: 'Escalera',         desc: '5 cartas consecutivas',        cards: [['4','♣'],['5','♥'],['6','♠'],['7','♦'],['8','♣']] },
    { rank: 7,  name: 'Trío',             desc: '3 cartas iguales',             cards: [['Q','♣'],['Q','♥'],['Q','♦'],['6','♠'],['2','♥']] },
    { rank: 8,  name: 'Doble Pareja',     desc: 'Dos parejas distintas',        cards: [['J','♠'],['J','♥'],['8','♦'],['8','♣'],['3','♥']] },
    { rank: 9,  name: 'Pareja',           desc: 'Dos cartas iguales',           cards: [['9','♣'],['9','♦'],['A','♥'],['6','♠'],['2','♣']] },
    { rank: 10, name: 'Carta Alta',       desc: 'Ninguna combinación',          cards: [['K','♥'],['J','♠'],['8','♦'],['5','♣'],['2','♥']] },
  ];

  // ── Sound engine (Web Audio API) ──────────────────────────────────────────
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, type, duration, vol = 0.18, attack = 0.005) {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.1);
    } catch(e) {}
  }

  function playNoise(duration, vol = 0.08) {
    try {
      const ctx = getAudioCtx();
      const bufLen = ctx.sampleRate * duration;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.5;
      src.buffer = buf;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.start(); src.stop(ctx.currentTime + duration);
    } catch(e) {}
  }

  const SFX = {
    chip:     () => { playNoise(0.06, 0.12); playTone(900, 'sine', 0.07, 0.1); },
    chipBig:  () => { playNoise(0.1, 0.18); playTone(700, 'sine', 0.12, 0.15); setTimeout(() => playNoise(0.05, 0.1), 60); },
    fold:     () => { playTone(300, 'triangle', 0.18, 0.12); playTone(220, 'triangle', 0.22, 0.08); },
    pass:     () => { playTone(520, 'sine', 0.1, 0.09); },
    newRound: () => { [440,550,660].forEach((f,i) => setTimeout(() => playTone(f,'sine',0.15,0.13), i*70)); },
    win:      () => { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,'sine',0.22,0.16), i*90)); },
    deal:     () => { playNoise(0.04, 0.1); playTone(1100, 'sine', 0.05, 0.07); },
  };

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
    dealerIndex: 0,
    selectedWinnerIndex: null,
    tieMode: false,
    tiedPlayerIndices: [],
    theme: 'dark',
  };

  const $ = id => document.getElementById(id);
  const escapeHtml = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  const showScreen = id => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id); if (el) el.classList.add('active');
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    [$('theme-toggle'), $('theme-toggle-setup')].forEach(btn => {
      if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
  }
  function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getActivePlayers = () => state.players.filter(p => !p.folded);
  const getActiveCount   = () => getActivePlayers().length;
  const currentPlayer    = () => state.players[state.currentTurnIndex];

  function nextTurnIndex() {
    let i = (state.currentTurnIndex + 1) % state.players.length;
    while (state.players[i].folded && i !== state.currentTurnIndex)
      i = (i + 1) % state.players.length;
    return i;
  }

  function nextActiveFrom(from) {
    let i = (from + 1) % state.players.length;
    for (let n = 0; n < state.players.length; n++) {
      if (!state.players[i].folded) return i;
      i = (i + 1) % state.players.length;
    }
    return from;
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
    for (const chip of CHIPS) {
      const n = Math.floor(rem / chip.v);
      if (n <= 0) continue;
      // Limit visible chips for better performance/visuals
      const visibleN = Math.min(n, 7);
      rem -= n * chip.v;

      const stack = document.createElement('div');
      stack.className = 'chip-stack';
      for (let i = 0; i < visibleN; i++) {
        const el = document.createElement('div');
        el.className = 'chip ' + chip.c;
        el.style.bottom = (i * 2.5) + 'px';
        el.style.zIndex = i;
        // Formato para valores grandes (1000 -> 1k)
        const valTxt = chip.v >= 1000 ? (chip.v / 1000) + 'k' : chip.v;
        el.innerHTML = `<span class="chip-v">${valTxt}</span>`;
        stack.appendChild(el);
      }
      container.appendChild(stack);
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
    rank.className = 'hand-rank'; rank.textContent = hand.rank;
    entry.appendChild(rank);
    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'hand-cards';
    hand.cards.forEach(([v, s]) => cardsWrap.appendChild(buildMiniCard(v, s)));
    entry.appendChild(cardsWrap);
    const info = document.createElement('div');
    info.className = 'hand-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'hand-info-name'; nameEl.textContent = hand.name;
    info.appendChild(nameEl);
    if (!compact) {
      const descEl = document.createElement('div');
      descEl.className = 'hand-info-desc'; descEl.textContent = hand.desc;
      info.appendChild(descEl);
    }
    entry.appendChild(info);
    return entry;
  }

  function renderHandsList(containerId, compact) {
    const container = $(containerId); if (!container) return;
    container.innerHTML = '';
    HANDS.forEach(h => container.appendChild(buildHandEntry(h, compact)));
  }

  // ── Round dots ─────────────────────────────────────────────────────────────
  function updateRoundDots() {
    for (let i = 0; i <= 3; i++) {
      const dot = $('rdot-' + i);
      if (dot) dot.classList.toggle('active', i <= state.roundIndex);
    }
  }

  // ── Poker table layout ─────────────────────────────────────────────────────
  function getSeatPositions(n) {
    const positions = [];
    const rx = 43, ry = 40;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i / n) - Math.PI / 2;
      positions.push({ x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) });
    }
    return positions;
  }

  function sizeTable() {
    const arena = $('game-arena'), wrapper = $('poker-table-wrapper');
    if (!arena || !wrapper) return;
    const aw = arena.clientWidth, ah = arena.clientHeight;
    const padH = 165, padW = 140;
    const maxW = aw - padW * 2, maxH = ah - padH * 2;
    let tw = Math.min(maxW, maxH * 1.7), th = tw / 1.7;
    if (th > maxH) { th = maxH; tw = th * 1.7; }
    tw = Math.max(tw, 240); th = Math.max(th, 140);
    wrapper.style.width  = (tw + padW * 2) + 'px';
    wrapper.style.height = (th + padH * 2) + 'px';
    const table = wrapper.querySelector('.poker-table');
    table.style.width = tw + 'px'; table.style.height = th + 'px';
    table.style.position = 'absolute';
    table.style.left = padW + 'px'; table.style.top = padH + 'px';
  }

  // ── Render game ────────────────────────────────────────────────────────────
  function renderGame() {
    const roundLabel = $('current-round-label');
    if (roundLabel) roundLabel.textContent = ROUNDS[state.roundIndex] || 'Fin';
    const potEl = $('pot-amount');
    if (potEl) potEl.textContent = state.pot;
    renderChips($('pot-chips'), state.pot);
    updateRoundDots();

    const seatsEl = $('players-seats');
    if (!seatsEl) return;
    const wrapper = $('poker-table-wrapper');
    if (!wrapper) return;
    const n = state.players.length;
    if (n === 0) return;

    const positions = getSeatPositions(n);
    const existing = seatsEl.querySelectorAll('.player-seat');
    if (existing.length !== n) seatsEl.innerHTML = '';

    const sbIdx = nextActiveFrom(state.dealerIndex);
    const bbIdx = nextActiveFrom(sbIdx);

    state.players.forEach((p, i) => {
      let seat = seatsEl.children[i];
      if (!seat) {
        seat = document.createElement('div');
        seat.className = 'player-seat';
        seatsEl.appendChild(seat);
      }
      seat.style.left = positions[i].x + '%';
      seat.style.top  = positions[i].y + '%';

      const badges = [];
      if (i === state.dealerIndex) badges.push('<span class="badge badge-d" title="Dealer">D</span>');
      if (i === sbIdx)             badges.push('<span class="badge badge-sb" title="Ciega pequeña">SB</span>');
      if (i === bbIdx)             badges.push('<span class="badge badge-bb" title="Ciega grande">BB</span>');

      let card = seat.querySelector('.player-card');
      if (!card) { card = document.createElement('div'); seat.appendChild(card); }

      card.className = 'player-card'
        + (i === state.currentTurnIndex && !p.folded ? ' current-turn' : '')
        + (p.folded ? ' folded' : '');

      card.innerHTML =
        `<div class="name">${escapeHtml(p.name)}${badges.join('')}</div>` +
        `<div class="balance">${p.balance} 🪙</div>` +
        `<div class="player-bet-wrap">` +
          (p.currentBet > 0 ? `<div class="bet">Apuesta: ${p.currentBet}</div><div class="player-chips-container"></div>` : '') +
        `</div>`;

      if (p.currentBet > 0) {
        const chipContainer = card.querySelector('.player-chips-container');
        renderChips(chipContainer, p.currentBet);
      }
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

    // Rotate dealer to next active player
    state.dealerIndex = nextActiveFrom(state.dealerIndex);

    const sbIdx = nextActiveFrom(state.dealerIndex);
    const bbIdx = nextActiveFrom(sbIdx);

    // Everyone pays blind
    active.forEach(p => {
      const toPay = Math.min(state.blind, p.balance);
      p.currentBet = toPay; p.balance -= toPay;
    });

    // First to act: UTG (after BB)
    const utg = nextActiveFrom(bbIdx);
    state.currentTurnIndex  = utg;
    state.firstToActThisRound = utg;

    // Deal animation
    const seats = () => document.querySelectorAll('.player-seat');
    sizeTable(); renderGame();
    setTimeout(() => {
      seats().forEach((seat, i) => {
        if (state.players[i]?.folded) return;
        const card = seat.querySelector('.player-card');
        if (!card) return;
        setTimeout(() => {
          card.classList.add('deal-anim');
          SFX.deal();
          setTimeout(() => card.classList.remove('deal-anim'), 500);
        }, i * 90);
      });
    }, 50);

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
    const first = state.players[state.firstToActThisRound];
    if (first && !first.folded) {
      return state.currentTurnIndex === state.firstToActThisRound;
    }
    const active = getActivePlayers();
    if (active.length <= 1) return true;
    let lastBeforeFirst = state.firstToActThisRound;
    for (let step = 1; step < state.players.length; step++) {
      const candidate = (state.firstToActThisRound - step + state.players.length) % state.players.length;
      if (!state.players[candidate].folded) { lastBeforeFirst = candidate; break; }
    }
    return state.lastActorIndex === lastBeforeFirst;
  }

  function maybeEndRound() {
    if (!allBetsMatchedOrFolded()) return;
    const active = getActiveCount();
    if (active <= 1) {
      state.players.forEach(p => { state.pot += p.currentBet; p.currentBet = 0; });
      finishHand(); return;
    }
    advanceRound();
    SFX.newRound();
    if (state.roundIndex > ROUND_INDEX_MAX) { finishHand(); return; }

    // Post-flop: first to act is first active after dealer
    const first = nextActiveFrom(state.dealerIndex);
    state.currentTurnIndex    = first;
    state.firstToActThisRound = first;

    // Pulse the pot on round change
    const potEl = $('pot-amount');
    if (potEl) { potEl.classList.add('pot-pulse'); setTimeout(() => potEl.classList.remove('pot-pulse'), 600); }

    renderGame(); updateTurnPanel();
  }

  function finishHand() {
    SFX.win();
    state.selectedWinnerIndex = null;
    state.tieMode = false;
    state.tiedPlayerIndices = [];
    const potEl = $('end-pot-amount');
    if (potEl) potEl.textContent = state.pot;
    renderChips($('end-pot-chips'), state.pot);
    showScreen('end-screen');
    renderEndScreen();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function animateAction(type) {
    const seats = document.querySelectorAll('.player-seat');
    const seat  = seats[state.currentTurnIndex];
    if (!seat) return;
    const card = seat.querySelector('.player-card');
    if (!card) return;
    card.classList.add('action-flash', 'action-' + type);
    setTimeout(() => card.classList.remove('action-flash', 'action-' + type), 500);
  }

  function actPass() {
    if (state.hasRaiseThisRound) return;
    SFX.pass(); animateAction('pass');
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    else { renderGame(); updateTurnPanel(); }
  }

  function actCall() {
    const p = currentPlayer();
    const toCall = state.maxBetThisRound - p.currentBet;
    const pay = Math.min(toCall, p.balance);
    p.currentBet += pay; p.balance -= pay;
    SFX.chip(); animateAction('call');
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    else { renderGame(); updateTurnPanel(); }
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
    SFX.chipBig(); animateAction('raise');
    state.lastActorIndex = state.currentTurnIndex;
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete()) maybeEndRound();
    else { renderGame(); updateTurnPanel(); }
  }

  function actFold() {
    SFX.fold(); animateAction('fold');
    const p = currentPlayer();
    p.folded = true;
    if (getActiveCount() <= 1) { maybeEndRound(); return; }
    state.currentTurnIndex = nextTurnIndex();
    if (roundComplete() || getActiveCount() <= 1) maybeEndRound();
    else { renderGame(); updateTurnPanel(); }
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
    const total = parseInt($('raise-amount').value, 10);
    const p = currentPlayer();
    if (!total || total <= p.currentBet) return;
    if (total - p.currentBet > p.balance) return;
    $('raise-modal').hidden = true;
    actRaise(total);
  }

  // ── End screen ─────────────────────────────────────────────────────────────
  function renderEndScreen() {
    const container   = $('winner-buttons');
    const tieSection  = $('end-tie-section');
    const winnerLabel = $('end-winner-label');
    const candidates  = getActivePlayers();
    const playersToShow = candidates.length > 0 ? candidates : state.players;

    container.innerHTML = ''; tieSection.innerHTML = '';

    if (state.tieMode) {
      tieSection.hidden = false;
      const lbl = document.createElement('p');
      lbl.className = 'end-tie-question'; lbl.textContent = '¿Qué jugadores han empatado?';
      tieSection.appendChild(lbl);
      const list = document.createElement('div');
      list.className = 'end-tie-checkboxes';
      playersToShow.forEach(player => {
        const idx = state.players.indexOf(player);
        const label = document.createElement('label');
        label.className = 'end-tie-option';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = state.tiedPlayerIndices.includes(idx); cb.dataset.index = idx;
        cb.addEventListener('change', function() { toggleTiedPlayer(Number(this.dataset.index)); });
        label.appendChild(cb); label.appendChild(document.createTextNode(player.name));
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
      } else winnerLabel.hidden = true;
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
      state.tiedPlayerIndices.forEach((idx, i) => { state.players[idx].balance += base + (i < rem ? 1 : 0); });
    } else {
      state.players[state.selectedWinnerIndex].balance += state.pot;
    }
    state.pot = 0;
    state.handNumber++;
    state.selectedWinnerIndex = null; state.tieMode = false; state.tiedPlayerIndices = [];
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

  // ── Setup player tag ──────────────────────────────────────────────────────
  function addPlayerTag(name) {
    if (!name || state.players.find(p => p.name === name)) return false;
    const list = $('players-list');
    const tag = document.createElement('span');
    tag.className = 'player-tag'; tag.textContent = name;
    const rem = document.createElement('button');
    rem.textContent = '×'; rem.setAttribute('aria-label', 'Quitar');
    rem.addEventListener('click', () => {
      const i = state.players.findIndex(p => p.name === name);
      if (i !== -1) state.players.splice(i, 1);
      tag.remove();
    });
    tag.appendChild(rem); list.appendChild(tag);
    state.players.push({ name, balance: state.initialMoney, currentBet: 0, folded: false });
    return true;
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  function setupListeners() {
    $('theme-toggle-setup').addEventListener('click', toggleTheme);
    $('theme-toggle').addEventListener('click', toggleTheme);

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
      if (!blind   || blind   < 1) { err.textContent = 'Indica una apuesta obligatoria válida.'; err.hidden = false; return; }
      if (state.players.length < 2){ err.textContent = 'Añade al menos 2 jugadores.'; err.hidden = false; return; }
      err.hidden = true;
      state.initialMoney = initial; state.blind = blind;
      state.dealerIndex = 0; state.handNumber = 0;
      state.players.forEach(p => { p.balance = initial; p.currentBet = 0; p.folded = false; });
      showScreen('game-screen');
      startNewHand();
    });

    $('btn-pass').addEventListener('click', actPass);
    $('btn-call').addEventListener('click', actCall);
    $('btn-fold').addEventListener('click', actFold);
    $('btn-raise').addEventListener('click', openRaiseModal);

    $('raise-cancel').addEventListener('click', () => { $('raise-modal').hidden = true; });
    $('raise-confirm').addEventListener('click', confirmRaise);
    $('raise-amount').addEventListener('keydown', e => { if (e.key === 'Enter') confirmRaise(); });
    document.querySelectorAll('.qb[data-add]').forEach(btn =>
      btn.addEventListener('click', () => applyQuickBet(parseInt(btn.dataset.add, 10))));
    document.querySelectorAll('.qb[data-sub]').forEach(btn =>
      btn.addEventListener('click', () => applyQuickBet(-parseInt(btn.dataset.sub, 10))));
    $('btn-allin').addEventListener('click', applyAllIn);

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

    $('rejoin-yes').addEventListener('click', () => closeRejoinAndContinue(true));
    $('rejoin-no').addEventListener('click',  () => closeRejoinAndContinue(false));

    window.addEventListener('resize', () => {
      if (document.getElementById('game-screen').classList.contains('active')) {
        sizeTable(); renderGame();
      }
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    applyTheme('dark');
    renderHandsList('setup-hands-list', false);
    renderHandsList('game-hands-list', true);
    renderHandsList('end-hands-list', true);
    setupListeners();
    showScreen('setup-screen');
  }

  init();
})();
