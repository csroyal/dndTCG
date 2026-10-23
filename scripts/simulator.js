let simulatorContextMenu = document.getElementById("simulatorContextMenu");
let simulatorDeckSelectContainer = document.getElementById("simulatorDeckSelectContainer");
let simulatorDeckSelect = document.getElementById("simulatorDeckSelect");
let simulatorDeckSelectConfirm = document.getElementById("simulatorDeckSelectConfirm");
let simulatorSummonZone = document.getElementById("simulatorSummonZone");
let simulatorReactionZone = document.getElementById("simulatorReactionZone");
let simulatorGraveyard = document.getElementById("simulatorGraveyard");
let simulatorDeck = document.getElementById("simulatorDeck");
let simDeckCountLabel = document.getElementById("simDeckCountLabel");
let simulatorHand = document.getElementById("simulatorHand");
let simulatorBanish = document.getElementById("simulatorBanish");
let simulatorModalContainer = document.getElementById("simulatorModalContainer");
let simulatorModalBody = document.getElementById("simulatorModalBody");
let simulatorModalButton = document.getElementById("simulatorModalButton");
let simulatorTokensModalContainer = document.getElementById("simulatorTokensModalContainer");
let simulatorTokensModalBody = document.getElementById("simulatorTokensModalBody");
let simulatorTokensModalButton = document.getElementById("simulatorTokensModalButton");
let simulatorConditionalModalContainer = document.getElementById("simulatorConditionalModalContainer");
let simulatorConditionalModalBody = document.getElementById("simulatorConditionalModalBody");
let simulatorConditionalModalButton = document.getElementById("simulatorConditionalModalButton");
let conditionalClassSelect = document.getElementById("conditionalClassSelect");
let conditionalTypeSelect = document.getElementById("conditionalTypeSelect");
let conditionalRaritySelect = document.getElementById("conditionalRaritySelect");

let activeSimDeck = [];
let activeHand = [];
let activeGraveyard = [];
let activeSummons = [];
let activeSummonNotes = [];
let activeSummonHP = [];   // current HP per summon, parallel to activeSummons
let activeSummonUsed = []; // names of the 1/S abilities each summon has spent, parallel too
let activeReactions = [];
let activeBanish = [];
let activeTokens = {
    "hand": 0,
    "foot": 0
};

let targetedCard;

// While something is mid-animation (cards in flight between zones) the board isn't saved or undone.
let simBusyUntil = 0;
function simHold(ms) { simBusyUntil = Math.max(simBusyUntil, performance.now() + ms); }

function summonDefaultHp(cardID) { return getObjectById(cards, cardID)?.summonInfo?.hp ?? 0; }

// A summon's state lives in parallel arrays; these keep them in step.
function addSummonState(cardID) {
    activeSummons.push(cardID);
    activeSummonNotes.push('');
    activeSummonHP.push(summonDefaultHp(cardID));
    activeSummonUsed.push([]);
}
function removeSummonState(i) {
    activeSummons.splice(i, 1);
    activeSummonNotes.splice(i, 1);
    activeSummonHP.splice(i, 1);
    activeSummonUsed.splice(i, 1);
}

// Abilities usable once per summon ("1/S." at the start of their text). They reset when the summon leaves play.
function onceAbilities(cardID) {
    const info = getObjectById(cards, cardID)?.summonInfo;
    if (!info) return [];
    return [...(info.traits || []), ...(info.actions || []), ...(info.bonusActions || []), ...(info.reactions || [])]
        .filter(a => /^1\/S\b/.test(a.description || '')).map(a => a.name);
}

document.addEventListener("click", function () {
    simulatorContextMenu.classList.remove("active");
});

document.addEventListener("contextmenu", function (e) {
    const simSection = document.getElementById("simulatorSection");
    if (!simSection.classList.contains("active")) return;

    // Use closest() so clicks on children of context elements (and cards in
    // modal containers outside #simulatorSection) still find the right target.
    const contextEl = e.target.closest('[data-context]');
    const inSection = simSection.contains(e.target);

    if (!inSection && !contextEl) return;

    e.preventDefault();

    if (contextEl) {
        openSimContextMenu(contextEl, e.pageX, e.pageY);
    } else if (inSection) {
        renderSimulatorContextMenu({ dataset: { context: 'simTools' } }, e.pageX, e.pageY);
    }

    return false;
});

// Opens the menu for a card or zone element and fills in the card's name.
function openSimContextMenu(el, x, y, { focusFirst = false } = {}) {
    if (!renderSimulatorContextMenu(el, x, y)) return false;
    if (el.dataset.cardId) {
        const name = getObjectById(cards, el.dataset.cardId)?.name ?? "";
        document.querySelectorAll(".simulator-context-card-name").forEach(span => { span.textContent = name; });
    }
    if (focusFirst) visibleMenuItems()[0]?.focus();
    return true;
}

// Left-click / Enter on a card: open its menu beside the card instead of at the cursor.
function openSimContextMenuBeside(el) {
    const rect = el.getBoundingClientRect();
    const fitsRight = rect.right + 240 < window.innerWidth;
    const x = fitsRight ? rect.right + 8 : rect.left - 8 - (simulatorContextMenu.offsetWidth || 230);
    return openSimContextMenu(el, x, rect.top, { focusFirst: document.activeElement === el });
}

function visibleMenuItems() {
    return Array.from(simulatorContextMenu.querySelectorAll("li")).filter(li => li.closest("ul").style.display !== "none");
}

// Keyboard: arrows move through the menu, Enter/Space picks.
simulatorContextMenu.querySelectorAll("li").forEach(li => {
    li.setAttribute("role", "menuitem");
    li.setAttribute("tabindex", "-1");
});
simulatorContextMenu.addEventListener("keydown", (e) => {
    const items = visibleMenuItems();
    const idx = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
    } else if ((e.key === "Enter" || e.key === " ") && idx !== -1) {
        e.preventDefault();
        items[idx].click();
        simulatorContextMenu.classList.remove("active");
    }
});

function viewTargetedCard() {
    if (targetedCard?.dataset.cardId) openInCardViewModal(targetedCard.dataset.cardId);
}

function renderSimulatorContextMenu(target, x, y) {
    const matchingUl = simulatorContextMenu.querySelector(`ul[data-context="${target.dataset.context}"]`);
    if (!matchingUl) return false;

    targetedCard = target;

    // Show the matching ul, hide all others
    simulatorContextMenu.querySelectorAll("ul").forEach(item => {
        item.style.display = item === matchingUl ? "block" : "none";
    });

    // Read height after determining which ul is shown (element is rendered but transparent)
    const mh = simulatorContextMenu.offsetHeight;
    const mw = simulatorContextMenu.offsetWidth || 220;

    // Clamp so menu never goes off-screen (CSS max-height handles overflow scroll)
    const cx = Math.min(x, window.innerWidth  - mw - 8);
    const cy = Math.min(y, window.innerHeight - mh - 8);

    simulatorContextMenu.style.left   = `${Math.max(4, cx)}px`;
    simulatorContextMenu.style.top    = `${Math.max(4, cy)}px`;
    simulatorContextMenu.style.bottom = 'unset';
    simulatorContextMenu.classList.add("active");
    return true;
}

function buildDeckSelect() {
    simulatorDeckSelect.innerHTML = "";

    for (const d in decks) {
        let deck = decks[d];
        let container = document.createElement("div");
        container.setAttribute("data-deck-id", deck.id);

        let iconImg = document.createElement("img");
        iconImg.classList.add("deck-card-icon");
        iconImg.src = deck.icon ? `./assets/card-art/${deck.icon}.jpg` : "./assets/card-art/back.png";
        iconImg.alt = "";
        if (!deck.icon) iconImg.classList.add("placeholder");

        let meta = document.createElement("div");
        meta.classList.add("deck-meta");

        let nameEl = document.createElement("div");
        nameEl.textContent = deck.name;

        let countEl = document.createElement("div");
        countEl.textContent = `${getCountDeck(deck)} cards`;

        meta.append(nameEl, countEl);
        container.append(iconImg, meta);

        const deckCount = getCountDeck(deck);
        if (deckCount < DECK_LIMIT) {
            container.classList.add('deck-select-incomplete');
            countEl.textContent = `${deckCount} / ${DECK_LIMIT} cards — incomplete`;
            container.onclick = () => showToast(`"${deck.name}" needs ${DECK_LIMIT} cards to play.`, 'error');
        } else {
            container.onclick = () => {
                if (simulatorDeckSelect.querySelector(".selected")) simulatorDeckSelect.querySelector(".selected").classList.remove("selected");
                container.classList.add("selected");
            };
        }

        makeActivatable(container, deck.name);
        simulatorDeckSelect.append(container);
    }

    simulatorDeckSelectContainer.classList.add("active");
}

simulatorDeckSelectConfirm.addEventListener("click", () => {
    let selected = simulatorDeckSelect.querySelector("div.selected");
    if (!selected) return;
    let deck = getObjectById(decks, selected.dataset.deckId);
    simulatorDeckSelectContainer.classList.remove("active");
    buildSimDeck(deck);
});

function buildSimDeck(deck) {
    activeSimDeck = [];
    for (const c in deck.deckList) {
        for (var i = 0; i < deck.deckList[c]; i++) activeSimDeck.push(c);
    }
    shuffleDeck();
    simStarted = true;
    simGameId = generateUID();
    simHold(3400); // the opening hand is dealt after a short pause

    simulatorDeck.classList.remove("empty");

    setTimeout(() => {
        drawCards(5);
    }, 2000);
}

function createSimulatorCard(cardID, zone = "hand", func = "", hp = null) {
    let card = getObjectById(cards, cardID);
    let el = document.createElement("img");
    el.src = `./assets/card-art/${cardID}.jpg`;
    el.alt = card.name;

    el.setAttribute("data-context", zone);
    el.setAttribute("data-card-id", cardID);
    el.setAttribute("data-card-class", card.class);
    el.setAttribute("data-uid", generateUID());
    el.setAttribute("draggable", "false");

    if (func) {
        el.addEventListener("click", func);
    } else if (simulatorContextMenu.querySelector(`ul[data-context="${zone}"]`)) {
        // Cards with actions open their menu on click; "View" is the menu's first item.
        el.addEventListener("click", (e) => {
            if (el._suppressClick) { el._suppressClick = false; return; }
            e.stopPropagation(); // the document-level click would close the menu straight away
            openSimContextMenuBeside(el);
        });
        makeActivatable(el, `${card.name}: actions`);
        if (zone === "hand") enableHandDrag(el);
    } else {
        el.addEventListener("click", () => { openInCardViewModal(cardID); });
    }

    if (zone === "summonZoneCard") {
        const wrap = document.createElement("div");
        wrap.className = "summon-card-wrap";
        wrap.append(el);

        const defaultHp = card.summonInfo?.hp ?? 0;
        const startHp = hp ?? defaultHp;

        const hpBar = document.createElement("div");
        hpBar.className = "summon-hp-bar";
        hpBar.classList.toggle("hp-danger", startHp <= 0);

        const heart = document.createElement("i");
        heart.className = "bi bi-heart-fill summon-hp-heart";

        const hpVal = document.createElement("span");
        hpVal.className = "summon-hp-val";
        hpVal.textContent = startHp;
        hpVal.title = "Click to edit HP";
        hpVal.onclick = (e) => {
            e.stopPropagation();
            const input = document.createElement("input");
            input.type = "text";
            input.inputMode = "numeric";
            input.className = "summon-hp-input";
            input.value = hpVal.textContent;
            hpVal.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                if (!input.isConnected) return; // blur after Enter already committed
                const before = Number(hpVal.textContent);
                const v = parseInt(input.value, 10);
                const next = isNaN(v) ? before : v;
                hpVal.textContent = next;
                hpBar.classList.toggle("hp-danger", next <= 0);
                input.replaceWith(hpVal);
                const idx = Array.from(simulatorSummonZone.querySelectorAll(".summon-card-wrap")).indexOf(wrap);
                if (idx !== -1) activeSummonHP[idx] = next;
                if (next <= 0 && before > 0) promptSummonDeath(el);
            };
            input.onblur = commit;
            input.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); commit(); } };
        };

        hpBar.append(heart, hpVal);
        wrap.append(hpBar);

        const once = onceAbilities(cardID);
        if (once.length) {
            const strip = document.createElement("div");
            strip.className = "summon-once";
            once.forEach(ability => {
                const pill = document.createElement("button");
                pill.type = "button";
                pill.className = "summon-once-pill";
                pill.innerHTML = `<i class="bi"></i><span>${escapeHTML(ability)}</span>`;
                const idx = () => Array.from(simulatorSummonZone.querySelectorAll(".summon-card-wrap")).indexOf(wrap);
                const render = () => {
                    const used = (activeSummonUsed[idx()] || []).includes(ability);
                    pill.classList.toggle("used", used);
                    pill.setAttribute("aria-pressed", String(used));
                    pill.querySelector("i").className = used ? "bi bi-check-circle-fill" : "bi bi-1-circle";
                    pill.title = used ? `${ability}: used. Click if it wasn't.` : `${ability}: once per summon. Click when you use it.`;
                };
                pill.addEventListener("click", (e) => {
                    e.stopPropagation(); // not the card's action menu
                    const i = idx();
                    if (i === -1) return;
                    const used = activeSummonUsed[i] || (activeSummonUsed[i] = []);
                    if (used.includes(ability)) used.splice(used.indexOf(ability), 1);
                    else used.push(ability);
                    render();
                });
                strip.append(pill);
                requestAnimationFrame(render); // the wrap has to be in the zone to know its index
            });
            wrap.append(strip);
        }
        return wrap;
    }

    return el;
}

function updateGraveyard() {
    simulatorGraveyard.querySelector("img").src = `./assets/card-art/${activeGraveyard[activeGraveyard.length - 1]}.jpg`

    if (activeGraveyard.length) simulatorGraveyard.classList.remove("empty");
    else simulatorGraveyard.classList.add("empty");
}

function buildTokensModal() {
    for (const t in activeTokens) {
        let container = document.createElement("div");
        container.classList.add("token-group");
        
        let minusButton = document.createElement("button");
        minusButton.innerHTML = "-";
        minusButton.onclick = () => {
            if (activeTokens[t] <= 0) return;
            activeTokens[t]--;
            tokenAmt.innerHTML = activeTokens[t];
        }

        let trackerGroup = document.createElement("div");

        let tokenImg = document.createElement("img");
        tokenImg.src = `./assets/token-icons/${t}.png`;

        let tokenNameSpan = document.createElement("span");
        tokenNameSpan.innerHTML = t + " Tokens";

        let tokenAmt = document.createElement("div");
        tokenAmt.className = "token-amt";
        tokenAmt.dataset.token = t;
        tokenAmt.innerHTML = "0";

        trackerGroup.append(tokenImg, tokenNameSpan, tokenAmt);
        
        let plusButton = document.createElement("button");
        plusButton.innerHTML = "+";
        plusButton.onclick = () => {
            activeTokens[t]++;
            tokenAmt.innerHTML = activeTokens[t];
        }

        container.append(minusButton, trackerGroup, plusButton);

        simulatorTokensModalBody.append(container);
    }
}
buildTokensModal();

/* DECK COUNT LABEL */

let deckCountTimeout = null;

simulatorDeck.addEventListener('click', () => {
    if (simulatorDeck.classList.contains('empty')) return;
    if (deckCountTimeout) clearTimeout(deckCountTimeout);
    simDeckCountLabel.textContent = `${activeSimDeck.length} left`;
    simDeckCountLabel.classList.add('show');
    deckCountTimeout = setTimeout(() => {
        simDeckCountLabel.classList.remove('show');
        deckCountTimeout = null;
    }, 2500);
});

/* NEXT TURN */

function nextTurn() {
    const turnEl = document.getElementById('simulatorTurnNum');
    turnEl.textContent = parseInt(turnEl.textContent, 10) + 1;
    setActionState('all', true);
    if (activeSimDeck.length > 0) drawCard();
}

/* RESET / NEW GAME */

function resetSimulator({ openDeckSelect = true } = {}) {
    pendingSummons = 0;
    simStarted = false;
    simGameId = null;
    activeSummonHP = [];
    activeSummonUsed = [];
    activeSimDeck = [];
    activeHand = [];
    activeGraveyard = [];
    activeSummons = [];
    activeSummonNotes = [];
    activeReactions = [];
    _counters = [];
    activeBanish = [];
    for (const t in activeTokens) activeTokens[t] = 0;
    simulatorTokensModalBody.querySelectorAll('.token-amt').forEach(div => div.innerHTML = 0);

    simulatorHand.innerHTML = '';

    Array.from(simulatorSummonZone.children).forEach(el => { if (el.tagName === 'IMG' || el.classList.contains('summon-card-wrap')) el.remove(); });
    document.querySelector('#simulatorSummonZone h3').style.display = 'block';

    Array.from(simulatorReactionZone.children).forEach(el => { if (el.tagName === 'IMG') el.remove(); });
    document.querySelector('#simulatorReactionZone h3').style.display = 'block';

    simulatorDeck.classList.add('empty');
    updateGraveyard();
    setActionState('all', true);
    document.getElementById('simulatorTurnNum').textContent = '1';

    if (deckCountTimeout) { clearTimeout(deckCountTimeout); deckCountTimeout = null; }
    simDeckCountLabel.classList.remove('show');

    _renderCounters();
    if (openDeckSelect) buildDeckSelect();
    else simulatorDeckSelectContainer.classList.remove("active");
}

/* HAND LAYOUT SCALING */

function updateHandLayout() {
    const count = simulatorHand.querySelectorAll('img').length;
    if (count <= 5 || simulatorHand.clientWidth === 0) {
        simulatorHand.style.removeProperty('--hand-card-w');
    } else {
        const gap = 10 * (count - 1);
        const maxW = Math.max(55, Math.floor((simulatorHand.clientWidth - gap) / count));
        simulatorHand.style.setProperty('--hand-card-w', maxW + 'px');
    }
}

new MutationObserver(updateHandLayout).observe(simulatorHand, { childList: true });

/* CONTEXT MENU FUNCTIONS */

let targetCardID;

function setActionState(actionType, actionState) {
    if (actionType === "all" && actionState) {
        document.getElementById(`actionPip`).classList.remove("used");
        document.getElementById(`bonusActionPip`).classList.remove("used");
        document.getElementById(`reactionPip`).classList.remove("used");
    } else {
        actionState ? document.getElementById(`${actionType}Pip`).classList.remove("used") : document.getElementById(`${actionType}Pip`).classList.add("used");
    }
    syncActionPips();
}

/* ACTION PIPS — click a row to mark it used / available */

function syncActionPips() {
    document.querySelectorAll("#simulatorActionTracker .simulator-action-group").forEach(group => {
        const used = group.querySelector(".action-pip").classList.contains("used");
        const label = group.querySelector("h3").textContent.replace(":", "").trim();
        group.setAttribute("aria-pressed", String(used));
        group.title = used ? `${label} used. Click to restore` : `${label} available. Click to mark used`;
    });
}

document.querySelectorAll("#simulatorActionTracker .simulator-action-group").forEach(group => {
    makeActivatable(group);
    group.addEventListener("click", () => {
        group.querySelector(".action-pip").classList.toggle("used");
        syncActionPips();
    });
});
syncActionPips();

/* ZONE MENUS — the ⋯ button opens the same menu as right-clicking the zone */

document.querySelectorAll(".zone-menu-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation(); // don't trigger the zone's own click (e.g. View Graveyard)
        const zoneEl = btn.closest("[data-context]");
        const rect = btn.getBoundingClientRect();
        openSimContextMenu(zoneEl, rect.left, rect.bottom + 6, { focusFirst: e.detail === 0 });
    });
});

function sendTargetedCardToGraveyard() {
    const cardEl = targetedCard;
    const cardID = cardEl.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    const toGraveyard = () => _removeCardFromContext(cardEl, 'down', () => {
        activeGraveyard.push(cardID);
        updateGraveyard();
        showToast(`${name} sent to graveyard.`, 'info');
    });

    // A summon leaving the field dies: it greys out and cracks before it goes.
    const wrap = cardEl.closest('.summon-card-wrap');
    if (!wrap) { toGraveyard(); return; }
    simHold(900);
    wrap.style.pointerEvents = 'none';
    playSound('death');
    playDeathEffect(cardEl);
    wrap.animate([
        { filter: 'none', transform: 'none' },
        { filter: 'grayscale(1) brightness(0.5)', transform: 'translateY(6px) rotate(-4deg)' },
    ], { duration: prefersReducedMotion.matches ? 1 : 560, easing: 'ease-in', fill: 'forwards' });
    setTimeout(toGraveyard, prefersReducedMotion.matches ? 0 : 560);
}

// HP was edited down to 0: offer to send the summon to the graveyard.
async function promptSummonDeath(cardEl) {
    const name = getObjectById(cards, cardEl.dataset.cardId)?.name ?? 'This summon';
    const confirmed = await showConfirm(`<strong>${escapeHTML(name)}</strong> is at 0 HP. Send it to the graveyard?`, { confirmLabel: 'Send to Graveyard' });
    if (!confirmed || !cardEl.isConnected) return;
    targetedCard = cardEl;
    sendTargetedCardToGraveyard();
}

function sendTargetedCardToHand() {
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    _removeCardFromContext(targetedCard, 'vanish', () => {
        activeHand.push(cardID);
        simulatorHand.append(createSimulatorCard(cardID));
        showToast(`${name} returned to hand.`, 'success');
    });
}

function banishTargetedCard() {
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    _removeCardFromContext(targetedCard, 'shrink', () => {
        activeBanish.push(cardID);
        animateBanish();
        showToast(`${name} banished.`, 'info');
    });
}

function activateTargetedCard() {
    const card = targetedCard;
    const cardID = card.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    const arrIdx = Array.from(card.parentNode.children).indexOf(card) - 1;
    activeReactions.splice(arrIdx, 1);
    activeGraveyard.push(cardID);
    animateReactionActivate(card);
    playCardEffect(getObjectById(cards, cardID), card);
    _fadeOut(card, 420, 'fade', () => {
        updateActiveReactions();
        updateGraveyard();
        showToast(`${name} activated.`, 'info');
    });
}

function viewGraveyard() {
    simulatorModalContainer.querySelector("h2").innerHTML = "Graveyard";
    simulatorModalBody.innerHTML = "";

    for (const g in activeGraveyard) {
        simulatorModalBody.append(createSimulatorCard(activeGraveyard[g], "graveyardCard"));
    }

    simulatorModalButton.innerHTML = "Close";
    simulatorModalButton.onclick = () => { simulatorModalContainer.classList.remove("active"); };
    simulatorModalContainer.classList.add("active");
}

function searchGraveyard() {
    targetCardID = null;
    simulatorModalContainer.querySelector("h2").innerHTML = "Search Graveyard";

    simulatorModalBody.innerHTML = "";

    for (const g in activeGraveyard) {
        simulatorModalBody.append(createSimulatorCard(activeGraveyard[g], "", (e) => {
            targetCardID = e.target.dataset.cardId;
            if (document.querySelector(".selected-card")) document.querySelector(".selected-card").classList.remove("selected-card");
            e.target.classList.add("selected-card");
        }));
    }

    simulatorModalButton.innerHTML = "Confirm";

    simulatorModalButton.onclick = () => {
        if (!targetCardID) { showToast('Select a card first.', 'error'); return; }
        const name = getObjectById(cards, targetCardID)?.name ?? targetCardID;
        activeGraveyard.splice(activeGraveyard.indexOf(targetCardID), 1);
        activeHand.push(targetCardID);
        simulatorHand.append(createSimulatorCard(targetCardID));
        simulatorModalContainer.classList.remove("active");
        updateGraveyard();
        showToast(`${name} added to hand.`, 'success');
    }

    simulatorModalContainer.classList.add("active");
}

function shuffleGraveyardIntoDeck() {
    const count = activeGraveyard.length;
    for (const g in activeGraveyard) {
        activeSimDeck.push(activeGraveyard[g]);
    }
    activeGraveyard = [];
    updateGraveyard();
    shuffleDeck();
    showToast(`${count} card${count !== 1 ? 's' : ''} shuffled into deck.`, 'info');
}

function returnRandomCardFromGraveyard() {
    let card = activeGraveyard[getRandomInt(0, activeGraveyard.length - 1)];
    activeGraveyard.splice(activeGraveyard.indexOf(card), 1);
    activeHand.push(card);
    playSound("draw");
    simulatorHand.append(createSimulatorCard(card));
    updateGraveyard();
    const name = getObjectById(cards, card)?.name ?? card;
    showToast(`${name} returned to hand.`, 'success');
}

let conditionalPullFrom;

function openConditionalModal(pullFrom) {
    simulatorConditionalModalContainer.classList.add("active");
    conditionalPullFrom = pullFrom;
}

function closeConditionalModal() {
    simulatorConditionalModalContainer.classList.remove("active");
    conditionalPullFrom = null;
}

function drawCardConditional() {
    let classValue = conditionalClassSelect.value;
    let typeValue = conditionalTypeSelect.value;
    let rarityValue = conditionalRaritySelect.value;
    let optionsArr = [];


    if (conditionalPullFrom === 'graveyard') {
        for (let g in activeGraveyard) {
            let card = getObjectById(cards, activeGraveyard[g]);
            if (((classValue && card.class === classValue) || !classValue) && ((typeValue && card.type === typeValue) || !typeValue) && ((rarityValue && card.rarity === rarityValue) || !rarityValue)) {
                optionsArr.push(activeGraveyard[g]);
            }
        }
    }
    if (conditionalPullFrom === 'deck') {
        for (let d in activeSimDeck) {
            let card = getObjectById(cards, activeSimDeck[d]);
            if (((classValue && card.class === classValue) || !classValue) && ((typeValue && card.type === typeValue) || !typeValue) && ((rarityValue && card.rarity === rarityValue) || !rarityValue)) {
                optionsArr.push(activeSimDeck[d]);
            }
        }
    }

    if (optionsArr.length === 0) {
        showToast('No cards match those conditions.', 'error');
        simulatorConditionalModalContainer.classList.add("active");
        return;
    }

    let card = optionsArr[getRandomInt(0, optionsArr.length - 1)];
    simHold(650);
    console.log(optionsArr, card);
    activeHand.push(card);
    playSound("draw");

    if (conditionalPullFrom === 'graveyard') {
        activeGraveyard.splice(activeGraveyard.indexOf(card), 1);
        updateGraveyard();
        simulatorHand.append(createSimulatorCard(card));
    }
    if (conditionalPullFrom === 'deck') {
        activeSimDeck.splice(activeSimDeck.indexOf(card), 1);
        animateCardDraw();
        setTimeout(() => {
            simulatorHand.append(createSimulatorCard(card));
        }, 500);
    }

    closeConditionalModal();
    return;
}

function deckIsEmpty() {
    if (activeSimDeck.length > 0) return false;
    showToast('Your deck is empty.', 'error');
    return true;
}

function drawCard() {
    if (deckIsEmpty()) return;
    simHold(650);
    let card = activeSimDeck[0];
    activeSimDeck.shift();
    activeHand.push(card);
    animateCardDraw();
    playSound("draw");
    setTimeout(() => {
        simulatorHand.append(createSimulatorCard(card));
    }, 500);
}

async function drawCards(count = 0) {
    let drawAmount = count;
    if (deckIsEmpty()) return;
    if (!drawAmount) {
        const input = await showInput('Draw how many cards?', '1', '1');
        if (input === null) return;
        drawAmount = parseInt(input, 10);
        if (isNaN(drawAmount) || drawAmount < 1) {
            showToast('Please enter a valid number.', 'error');
            return;
        }
    }
    if (drawAmount > activeSimDeck.length) {
        showToast(`Only ${activeSimDeck.length} card${activeSimDeck.length === 1 ? '' : 's'} left to draw.`, 'info');
        drawAmount = activeSimDeck.length;
    }
    for (let i = 0; i < drawAmount; i++) {
        setTimeout(drawCard, i * 250);
    }
}

function drawCardFromBottom() {
    if (deckIsEmpty()) return;
    simHold(650);
    let card = activeSimDeck[activeSimDeck.length - 1];
    activeSimDeck.pop();
    activeHand.push(card);
    animateCardDraw();
    playSound("draw");
    const name = getObjectById(cards, card)?.name ?? card;
    setTimeout(() => {
        simulatorHand.append(createSimulatorCard(card));
        showToast(`Drew ${name}.`, 'success');
    }, 500);
}

function drawRandomCard() {
    if (deckIsEmpty()) return;
    simHold(650);
    let card = activeSimDeck[getRandomInt(0, activeSimDeck.length - 1)];
    activeSimDeck.splice(activeSimDeck.indexOf(card), 1);
    activeHand.push(card);
    animateCardDraw();
    playSound("draw");
    const name = getObjectById(cards, card)?.name ?? card;
    setTimeout(() => {
        simulatorHand.append(createSimulatorCard(card));
        showToast(`Drew ${name}.`, 'success');
    }, 500);
}

function shuffleDeck() {
    activeSimDeck = shuffleArray(activeSimDeck);
    animateDeckShuffle();
    playSound("shuffle");
}

async function revealFromDeck(direction) {
    const input = await showInput(`Reveal how many cards from ${direction} of deck?`, '1', '1');
    if (input === null) return;
    const revealAmount = parseInt(input, 10);
    if (isNaN(revealAmount) || revealAmount < 1) {
        showToast('Please enter a valid number.', 'error');
        return;
    }

    simulatorModalContainer.querySelector('h2').innerHTML = `Reveal from ${direction === 'top' ? 'Top' : 'Bottom'} of Deck`;
    simulatorModalBody.innerHTML = '';

    const count = Math.min(revealAmount, activeSimDeck.length);
    for (let i = 0; i < count; i++) {
        const cardID = direction === 'top'
            ? activeSimDeck[i]
            : activeSimDeck[activeSimDeck.length - 1 - i];
        simulatorModalBody.append(createSimulatorCard(cardID));
    }

    simulatorModalButton.innerHTML = 'Close';
    simulatorModalButton.onclick = () => simulatorModalContainer.classList.remove('active');
    simulatorModalContainer.classList.add('active');
}

async function rearrangeTopCards() {
    const input = await showInput('Rearrange how many top cards?', '3', '3');
    if (input === null) return;
    const n = parseInt(input, 10);
    if (isNaN(n) || n < 2) { showToast('Enter at least 2.', 'error'); return; }
    const count = Math.min(n, activeSimDeck.length);
    if (count < 2) { showToast('Not enough cards in deck.', 'error'); return; }

    let working = activeSimDeck.slice(0, count);
    let selectedIdx = null;

    simulatorModalContainer.querySelector('h2').textContent = `Rearrange Top ${count} Cards`;
    simulatorModalBody.classList.add('rearrange-body');

    function renderSlots() {
        simulatorModalBody.innerHTML = '';
        const hint = document.createElement('p');
        hint.className = 'rearrange-hint';
        hint.textContent = 'Click a card to select it, then click another to swap positions.';
        simulatorModalBody.append(hint);

        working.forEach((cardID, i) => {
            const slot = document.createElement('div');
            slot.className = 'rearrange-slot';

            const img = document.createElement('img');
            img.src = `./assets/card-art/${cardID}.jpg`;
            img.alt = getObjectById(cards, cardID)?.name ?? '';
            if (selectedIdx === i) img.classList.add('rearrange-selected');

            const lbl = document.createElement('div');
            lbl.className = 'rearrange-label';
            lbl.textContent = i === 0 ? '▲ Top' : `#${i + 1}`;

            slot.append(img, lbl);
            slot.addEventListener('click', () => {
                if (selectedIdx === null) {
                    selectedIdx = i;
                    img.classList.add('rearrange-selected');
                } else if (selectedIdx === i) {
                    selectedIdx = null;
                    img.classList.remove('rearrange-selected');
                } else {
                    [working[selectedIdx], working[i]] = [working[i], working[selectedIdx]];
                    selectedIdx = null;
                    renderSlots();
                }
            });
            simulatorModalBody.append(slot);
        });
    }

    renderSlots();

    simulatorModalButton.textContent = 'Confirm Order';
    simulatorModalButton.onclick = () => {
        for (let i = 0; i < count; i++) activeSimDeck[i] = working[i];
        simulatorModalBody.classList.remove('rearrange-body');
        simulatorModalContainer.classList.remove('active');
        showToast('Top cards rearranged.', 'success');
    };

    simulatorModalContainer.classList.add('active');
}

function searchDeck() {
    if (deckIsEmpty()) return;
    targetCardID = null;
    simulatorModalContainer.querySelector("h2").innerHTML = "Search Deck";

    simulatorModalBody.innerHTML = "";

    for (const d in activeSimDeck) {
        simulatorModalBody.append(createSimulatorCard(activeSimDeck[d], "", (e) => {
            targetCardID = e.target.dataset.cardId;
            if (document.querySelector(".selected-card")) document.querySelector(".selected-card").classList.remove("selected-card");
            e.target.classList.add("selected-card");
        }));
    }

    simulatorModalButton.innerHTML = "Confirm";

    simulatorModalButton.onclick = () => {
        if (!targetCardID) { showToast('Select a card first.', 'error'); return; }
        activeSimDeck.splice(activeSimDeck.indexOf(targetCardID), 1);
        activeHand.push(targetCardID);
        simulatorHand.append(createSimulatorCard(targetCardID));
        simulatorModalContainer.classList.remove("active");
    }

    simulatorModalContainer.classList.add("active");
}

function banishRandomCard() {
    if (deckIsEmpty()) return;
    let card = activeSimDeck[getRandomInt(0, activeSimDeck.length - 1)];
    activeSimDeck.splice(activeSimDeck.indexOf(card), 1);
    activeBanish.push(card);
    animateBanish();
    const name = getObjectById(cards, card)?.name ?? card;
    showToast(`${name} banished.`, 'info');
}

function banishTopCard() {
    if (activeSimDeck.length === 0) { showToast('Deck is empty.', 'error'); return; }
    const cardID = activeSimDeck.shift();
    activeBanish.push(cardID);
    animateBanish();
    showToast(`Top card banished.`, 'info');
}

function discardRandomFromHand() {
    if (activeHand.length === 0) { showToast('Hand is empty.', 'error'); return; }
    const randIdx = Math.floor(Math.random() * activeHand.length);
    const cardID = activeHand.splice(randIdx, 1)[0];
    activeGraveyard.push(cardID);
    const handCards = Array.from(simulatorHand.children);
    if (handCards[randIdx]) {
        _fadeOut(handCards[randIdx], 185, 'down', () => updateGraveyard());
    } else {
        updateGraveyard();
    }
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    showToast(`Discarded: ${name}`, 'info');
}

function returnGraveyardCardToHand() {
    if (!targetedCard) return;
    const cardID = targetedCard.dataset.cardId;
    activeGraveyard.splice(activeGraveyard.indexOf(cardID), 1);
    activeHand.push(cardID);
    simulatorHand.append(createSimulatorCard(cardID));
    simulatorModalContainer.classList.remove('active');
    updateGraveyard();
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    showToast(`${name} returned to hand.`, 'success');
}

function copyGraveyardCardToHand() {
    if (!targetedCard) return;
    const cardID = targetedCard.dataset.cardId;
    activeHand.push(cardID);
    simulatorHand.append(createSimulatorCard(cardID));
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    showToast(`Copied ${name} to hand.`, 'success');
}

function banishGraveyardCard() {
    if (!targetedCard) return;
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    activeGraveyard.splice(activeGraveyard.indexOf(cardID), 1);
    activeBanish.push(cardID);
    simulatorModalContainer.classList.remove('active');
    updateGraveyard();
    animateBanish();
    showToast(`${name} banished.`, 'info');
}

function transformTargetedCard() {
    const card     = targetedCard;
    const parent   = card.parentElement;
    const domIdx   = Array.from(parent.children).indexOf(card);
    const arrIdx   = domIdx - 1;

    simulatorModalContainer.querySelector('h2').textContent = 'Transform Into...';
    simulatorModalBody.innerHTML = '';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'sim-modal-search-wrap';
    const searchEl = document.createElement('input');
    searchEl.type = 'text';
    searchEl.placeholder = 'Search by name or class...';
    searchEl.className = 'sim-modal-search';
    searchWrap.append(searchEl);
    simulatorModalBody.append(searchWrap);

    let selectedTransformID = null;

    cards.filter(c => c.class !== 'Sleeve').forEach(c => {
        const img = createSimulatorCard(c.id, '', e => {
            const prev = simulatorModalBody.querySelector('.selected-card');
            if (prev) prev.classList.remove('selected-card');
            e.target.classList.add('selected-card');
            selectedTransformID = e.target.dataset.cardId;
        });
        simulatorModalBody.append(img);
    });

    searchEl.addEventListener('input', () => {
        const q = searchEl.value.toLowerCase();
        simulatorModalBody.querySelectorAll('img[data-card-id]').forEach(img => {
            const c = getObjectById(cards, img.dataset.cardId);
            const hit = !q || !!(c && (c.name.toLowerCase().includes(q) || (c.class || '').toLowerCase().includes(q)));
            img.style.display = hit ? '' : 'none';
        });
    });

    simulatorModalButton.textContent = 'Transform';
    simulatorModalButton.onclick = () => {
        if (!selectedTransformID) { showToast('Select a card to transform into.', 'error'); return; }
        activeSummons[arrIdx] = selectedTransformID;
        activeSummonHP[arrIdx] = summonDefaultHp(selectedTransformID);
        activeSummonUsed[arrIdx] = [];
        simulatorModalContainer.classList.remove('active');
        updateActiveSummons();
        showToast('Transformed!', 'success');
    };

    simulatorModalContainer.classList.add('active');
    setTimeout(() => searchEl.focus(), 50);
}

function viewBanish() {
    simulatorModalContainer.querySelector("h2").innerHTML = "Banish Zone";

    simulatorModalBody.innerHTML = "";

    for (const b in activeBanish) {
        simulatorModalBody.append(createSimulatorCard(activeBanish[b], "banishCard"));
    }

    simulatorModalButton.innerHTML = "Close";

    simulatorModalButton.onclick = () => {
        simulatorModalContainer.classList.remove("active");
    }

    simulatorModalContainer.classList.add("active");
}

function viewTokens() {
    simulatorTokensModalContainer.classList.add("active");
}

const MAX_ACTIVE_SUMMONS = 3;
let pendingSummons = 0; // summons mid play-animation, not yet in activeSummons

// fromRect: where the card visually starts (its hand slot, or where a drag dropped it)
function playCard(fromRect = null) {
    const cardID = targetedCard.dataset.cardId;
    // read now: targetedCard may point at another card by the time the timeout fires
    const cardClass = targetedCard.dataset.cardClass;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    if (cardClass === "Summon" && activeSummons.length + pendingSummons >= MAX_ACTIVE_SUMMONS) {
        showToast(`Your Summon Zone is full (${MAX_ACTIVE_SUMMONS} max).`, 'error');
        return;
    }
    if (cardClass === "Summon") pendingSummons++;
    fromRect = fromRect ?? targetedCard.getBoundingClientRect();
    targetedCard.remove();

    activeHand.splice(activeHand.indexOf(cardID), 1);

    animatePlayCard(cardID, fromRect, cardClass);
    showToast(`${name} played.`, 'success');

    setTimeout(() => {
        let landed = null;
        if (cardClass === "Spell" || cardClass === "Utility") {
            activeGraveyard.push(cardID);
            updateGraveyard();
        } else if (cardClass === "Summon") {
            pendingSummons = Math.max(0, pendingSummons - 1);
            addSummonState(cardID);
            updateActiveSummons();
            landed = simulatorSummonZone.querySelector('.summon-card-wrap:last-of-type img');
        } else if (cardClass === "Reaction") {
            activeReactions.push(cardID);
            updateActiveReactions();
            landed = simulatorReactionZone.querySelector('img:last-of-type');
        }
        if (cardClass === "Reaction") playReactionSetEffect(landed);
        else playCardEffect(getObjectById(cards, cardID), landed);
    }, 1500);
}

function shuffleTargetedCardIntoDeck() {
    const domIdx = Array.from(simulatorHand.children).indexOf(targetedCard);
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    activeSimDeck.push(cardID);
    activeHand.splice(domIdx, 1);
    simulatorDeck.classList.remove('empty');
    _fadeOut(targetedCard, 185, 'up', () => {
        shuffleDeck();
        showToast(`${name} shuffled into deck.`, 'info');
    });
}

function putTargetedCardOnDeck(direction) {
    const domIdx = Array.from(simulatorHand.children).indexOf(targetedCard);
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    if (direction === "top") activeSimDeck.unshift(cardID);
    else if (direction === "bottom") activeSimDeck.push(cardID);
    activeHand.splice(domIdx, 1);
    simulatorDeck.classList.remove('empty');
    _fadeOut(targetedCard, 185, 'up', () => {
        showToast(`${name} placed on ${direction} of deck.`, 'info');
    });
}

function discardHand() {
    const count = activeHand.length;
    for (const h of activeHand) activeGraveyard.push(h);
    activeHand = [];
    const handEls = Array.from(simulatorHand.children);
    simHold(320 + handEls.length * 35);
    handEls.forEach((card, i) => {
        setTimeout(() => {
            card.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
            requestAnimationFrame(() => {
                card.style.transform = 'translateY(20px) scale(0.8)';
                card.style.opacity = '0';
            });
        }, i * 35);
    });
    setTimeout(() => {
        simulatorHand.innerHTML = '';
        updateGraveyard();
        showToast(`Discarded ${count} card${count !== 1 ? 's' : ''}.`, 'info');
    }, 220 + handEls.length * 35);
}

function shuffleHandIntoDeck() {
    const count = activeHand.length;
    for (const h of activeHand) activeSimDeck.push(h);
    activeHand = [];
    const handEls = Array.from(simulatorHand.children);
    simHold(320 + handEls.length * 35);
    handEls.forEach((card, i) => {
        setTimeout(() => {
            card.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
            requestAnimationFrame(() => {
                card.style.transform = 'translateY(-20px) scale(0.8)';
                card.style.opacity = '0';
            });
        }, i * 35);
    });
    if (count) simulatorDeck.classList.remove('empty');
    setTimeout(() => {
        simulatorHand.innerHTML = '';
        shuffleDeck();
        showToast(`${count} card${count !== 1 ? 's' : ''} shuffled into deck.`, 'info');
    }, 220 + handEls.length * 35);
}

/* HELPERS */

function _fadeOut(el, ms, direction, cb) {
    const transforms = {
        down:   'translateY(22px) scale(0.82)',
        up:     'translateY(-22px) scale(0.82)',
        vanish: 'scale(0.55) rotate(-8deg)',
        shrink: 'scale(0.08) rotate(90deg)',
        fade:   'scale(1)',
    };
    simHold(ms + 80);
    el.style.transition = `transform ${ms}ms ease, opacity ${ms}ms ease`;
    requestAnimationFrame(() => {
        el.style.transform = transforms[direction] ?? transforms.vanish;
        el.style.opacity = '0';
    });
    setTimeout(() => { el.remove(); if (cb) cb(); }, ms + 25);
}

function _removeCardFromContext(card, direction, cb) {
    const wrap = card.parentElement?.classList.contains('summon-card-wrap') ? card.parentElement : null;
    const el = wrap ?? card;
    const parent = el.parentElement;
    const domIdx = Array.from(parent.children).indexOf(el);
    const arrIdx = (parent === simulatorHand) ? domIdx : domIdx - 1;
    if (parent === simulatorHand)             activeHand.splice(arrIdx, 1);
    else if (parent === simulatorSummonZone) removeSummonState(arrIdx);
    else if (parent === simulatorReactionZone) activeReactions.splice(arrIdx, 1);
    _fadeOut(el, 185, direction, () => {
        if (parent === simulatorSummonZone)   updateActiveSummons();
        if (parent === simulatorReactionZone) updateActiveReactions();
        if (cb) cb();
    });
}

function animateCardDraw() {
    let tempCard = document.createElement("img");
    tempCard.src = './assets/card-art/back.png';
    tempCard.classList.add("simulator-deck-card", "simulator-deck-card-temp", "card-draw");
    simulatorDeck.append(tempCard);

    setTimeout(() => {
        document.querySelectorAll(".simulator-deck-card-temp").forEach(temp => {
            temp.remove();
        });
    }, 1000);
}

function animateDeckShuffle() {
    document.querySelector(".simulator-deck-card").classList.add("card-shuffle");
    for (var i = 0; i < 4; i++) {
        let tempCard = document.createElement("img");
        tempCard.src = './assets/card-art/back.png';
        tempCard.style.animationDelay = (Math.random() * (((i + 1) * 250) - (i * 250)) + (i * 250)) + "ms";
        tempCard.classList.add("simulator-deck-card", "simulator-deck-card-temp", "card-shuffle");
        simulatorDeck.append(tempCard);
    }

    setTimeout(() => {
        document.querySelectorAll(".simulator-deck-card-temp").forEach(temp => {
            temp.remove();
        });
        document.querySelector(".simulator-deck-card").classList.remove("card-shuffle");
    }, 2600);
}

const summonNotesModal     = document.getElementById('summonNotesModalContainer');
const summonNotesTextarea  = document.getElementById('summonNotesTextarea');
const summonNotesTitle     = document.getElementById('summonNotesModalTitle');
document.getElementById('summonNotesModalClose').onclick = () => {
    if (summonNotesModal._idx !== undefined) activeSummonNotes[summonNotesModal._idx] = summonNotesTextarea.value;
    summonNotesModal.classList.remove('active');
};

function openSummonNotes() {
    const card = targetedCard;
    const wrap = card.parentElement;
    const domIdx = Array.from(simulatorSummonZone.children).indexOf(wrap);
    const arrIdx = domIdx - 1;
    const name = getObjectById(cards, card.dataset.cardId)?.name ?? card.dataset.cardId;
    summonNotesTitle.textContent = `Notes — ${name}`;
    summonNotesTextarea.value = activeSummonNotes[arrIdx] ?? '';
    summonNotesModal._idx = arrIdx;
    summonNotesModal.classList.add('active');
    setTimeout(() => summonNotesTextarea.focus(), 50);
}

/* ============================================================
   SIM TOOLS — DICE, COIN, COUNTERS
============================================================ */

// --- Dice Roller ---
let _selectedDie = 20;
let _diceRolling = false;

document.getElementById('diceRollerClose').onclick = () => document.getElementById('diceRollerModal').classList.remove('active');

function openDiceRoller() {
    document.getElementById('diceRollerModal').classList.add('active');
}

function setDie(sides) {
    _selectedDie = sides;
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.classList.toggle('dice-btn-active', btn.textContent === `d${sides}`);
    });
}

function rollDice() {
    if (_diceRolling) return;
    const count = Math.min(Math.max(parseInt(document.getElementById('diceCount').value) || 1, 1), 20);
    const resultEl = document.getElementById('diceResult');
    _diceRolling = true;
    resultEl.className = 'dice-result dice-rolling';

    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * _selectedDie) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);

    let tick = 0;
    const interval = setInterval(() => {
        const fake = Math.floor(Math.random() * _selectedDie * count) + count;
        resultEl.textContent = fake;
        tick++;
    }, 55);

    setTimeout(() => {
        clearInterval(interval);
        _diceRolling = false;

        let extraClass = '';
        let label = '';
        if (count === 1 && _selectedDie === 20) {
            if (rolls[0] === 1)  { extraClass = 'dice-nat1';  label = 'Critical Failure!'; }
            if (rolls[0] === 20) { extraClass = 'dice-nat20'; label = 'Natural 20!'; }
        }

        const breakdown = count > 1 ? `<div class="dice-breakdown">${rolls.join(' + ')} =</div>` : '';
        resultEl.className = `dice-result dice-reveal ${extraClass}`;
        resultEl.innerHTML = `${breakdown}<span class="dice-total">${total}</span>${label ? `<div class="dice-label">${label}</div>` : ''}`;
    }, 660);
}

// --- Coin Flip ---
function flipCoin() {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const overlay = document.createElement('div');
    overlay.className = 'coin-flip-overlay';
    const coin = document.createElement('div');
    coin.className = 'coin-flip-coin';
    overlay.append(coin);
    document.body.append(overlay);

    setTimeout(() => {
        coin.classList.add('coin-reveal');
        coin.textContent = result;
    }, 950);

    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.35s ease';
        setTimeout(() => overlay.remove(), 380);
    }, 1700);
}

// --- Counters ---
let _counters = [];

document.getElementById('counterModalClose').onclick = () => document.getElementById('counterModal').classList.remove('active');
document.getElementById('counterNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') addCounter(); });

function openCounterModal() {
    _renderCounters();
    document.getElementById('counterModal').classList.add('active');
}

function _renderCounters() {
    const list = document.getElementById('counterList');
    if (_counters.length === 0) {
        list.innerHTML = '<p class="counter-empty">No counters yet.</p>';
        return;
    }
    list.innerHTML = '';
    _counters.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'counter-row';
        row.innerHTML = `
            <span class="counter-name">${c.name}</span>
            <button class="counter-btn" onclick="_changeCounter(${i},-1)">−</button>
            <span class="counter-val" id="cval${i}">${c.value}</span>
            <button class="counter-btn" onclick="_changeCounter(${i},1)">+</button>
            <button class="counter-remove" onclick="_removeCounter(${i})"><i class="bi bi-x"></i></button>
        `;
        list.append(row);
    });
}

function addCounter() {
    const input = document.getElementById('counterNameInput');
    const name = input.value.trim() || 'Counter';
    _counters.push({ name, value: 0 });
    input.value = '';
    _renderCounters();
}

function _changeCounter(i, delta) {
    _counters[i].value += delta;
    const el = document.getElementById(`cval${i}`);
    if (el) el.textContent = _counters[i].value;
}

function _removeCounter(i) {
    _counters.splice(i, 1);
    _renderCounters();
}

function animateReactionActivate(el) {
    playSound('activate');
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const flash = document.createElement('div');
    flash.className = 'reaction-activate-flash';
    flash.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const ring = document.createElement('div');
            ring.className = 'reaction-activate-ring';
            ring.style.left = cx + 'px';
            ring.style.top = cy + 'px';
            ring.style.animationDuration = (460 + i * 110) + 'ms';
            document.body.appendChild(ring);
            setTimeout(() => ring.remove(), 560 + i * 110);
        }, i * 85);
    }
}

const PLAY_DURATION = 1500; // keep in step with playCard's hand-off timeout
const PLAY_GLOW = { Summon: '255,140,90', Spell: '110,230,160', Reaction: '110,170,255', Utility: '220,225,240' };

// Rise from the hand to centre stage, flare on activation, then glide to the card's destination.
function animatePlayCard(id, fromRect, cardClass) {
    const overlay = document.createElement('div');
    overlay.className = 'activating-card';
    const glowRGB = PLAY_GLOW[cardClass] || '255,255,255';
    overlay.style.setProperty('--play-glow', glowRGB);
    overlay.innerHTML = `
        <div class="activating-card-backdrop"></div>
        <div class="activating-card-stage">
            <div class="activating-card-burst"></div>
            <img src="./assets/card-art/${id}.jpg" alt="">
            <div class="activating-card-sheen"></div>
        </div>`;
    document.body.append(overlay);
    setTimeout(() => { playSound('activate'); }, 525);
    setTimeout(() => { overlay.remove(); }, PLAY_DURATION + 30);

    const backdrop = overlay.querySelector('.activating-card-backdrop');
    const stage = overlay.querySelector('.activating-card-stage');
    const img = stage.querySelector('img');
    if (prefersReducedMotion.matches) {
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: PLAY_DURATION });
        stage.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: PLAY_DURATION, fill: 'forwards' });
        return;
    }

    // Express a viewport rect as a transform of the centred stage.
    const home = stage.getBoundingClientRect();
    const toRect = (r) => {
        const dx = r.left + r.width / 2 - (home.left + home.width / 2);
        const dy = r.top + r.height / 2 - (home.top + home.height / 2);
        return `translate(${dx}px, ${dy}px) scale(${r.width / home.width})`;
    };
    const start = fromRect && fromRect.width ? toRect(fromRect) : 'translate(0px, 60px) scale(0.8)';

    const destEl = cardClass === 'Summon' ? simulatorSummonZone
                 : cardClass === 'Reaction' ? simulatorReactionZone
                 : simulatorGraveyard;
    const d = destEl.getBoundingClientRect();
    const destH = Math.min(d.height * 0.82, d.width * 0.9 * (508 / 362));
    const destW = destH * (362 / 508);
    const finish = toRect({ left: d.left + (d.width - destW) / 2, top: d.top + (d.height - destH) / 2, width: destW, height: destH });

    const P = 'perspective(1100px)';
    stage.animate([
        { transform: `${P} ${start} rotateY(-38deg)`,                      offset: 0,    easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
        { transform: `${P} translate(0px, 0px) scale(1.05) rotateY(7deg)`,   offset: 0.24, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
        { transform: `${P} translate(0px, -4px) scale(1) rotateY(0deg)`,     offset: 0.34, easing: 'ease-in-out' },
        { transform: `${P} translate(0px, -12px) scale(1.02) rotateY(0deg)`, offset: 0.62, easing: 'cubic-bezier(0.55, 0, 0.35, 1)' },
        { transform: `${P} ${finish} rotateY(0deg)`,                         offset: 1 },
    ], { duration: PLAY_DURATION, fill: 'forwards' });

    // Glow builds into the activation beat (~525ms), then settles as the card leaves.
    const glow = (blur, a, white) =>
        `drop-shadow(0 0 ${blur}px rgba(${glowRGB},${a})) drop-shadow(0 0 ${Math.round(blur / 3)}px rgba(255,255,255,${white}))`;
    img.animate([
        { filter: glow(0, 0, 0),        opacity: 1, offset: 0 },
        { filter: glow(6, 0.35, 0.15),  opacity: 1, offset: 0.24 },
        { filter: glow(34, 0.95, 0.85), opacity: 1, offset: 0.36 },
        { filter: glow(22, 0.7, 0.45),  opacity: 1, offset: 0.6 },
        { filter: glow(8, 0.35, 0.1),   opacity: 1, offset: 0.82 },
        { filter: glow(0, 0, 0),        opacity: 0, offset: 1 },
    ], { duration: PLAY_DURATION, easing: 'ease-in-out', fill: 'forwards' });

    stage.querySelector('.activating-card-sheen').animate([
        { backgroundPosition: '130% 0', opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, offset: 0.75 },
        { backgroundPosition: '-30% 0', opacity: 0 },
    ], { duration: 560, delay: 430, easing: 'ease-in-out', fill: 'both' });

    stage.querySelector('.activating-card-burst').animate([
        { transform: 'scale(0.35)', opacity: 0 },
        { transform: 'scale(1)',    opacity: 0.9, offset: 0.3 },
        { transform: 'scale(1.5)',  opacity: 0 },
    ], { duration: 900, delay: 400, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' });

    backdrop.animate([
        { opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.65 },
        { opacity: 0 },
    ], { duration: PLAY_DURATION, easing: 'ease-in-out', fill: 'forwards' });
}

function animateBanish() {
    playSound('banish');
    simulatorBanish.classList.add("banish-anim");
    simulatorBanish.querySelector("h3").style.opacity = "0";

    const rect = simulatorBanish.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const ring = document.createElement('div');
            ring.className = 'banish-shockwave';
            ring.style.left = cx + 'px';
            ring.style.top = cy + 'px';
            ring.style.animationDuration = (520 + i * 140) + 'ms';
            document.body.appendChild(ring);
            setTimeout(() => ring.remove(), 540 + i * 140);
        }, i * 110);
    }

    const COLORS = ['#b060ff', '#7030e0', '#e080ff', '#ffffff', '#5020c0'];
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'banish-particle';
        const angle = (i / 12) * 360;
        const dist = 65 + Math.random() * 55;
        p.style.setProperty('--dx', (Math.cos(angle * Math.PI / 180) * dist) + 'px');
        p.style.setProperty('--dy', (Math.sin(angle * Math.PI / 180) * dist) + 'px');
        p.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
        p.style.setProperty('--color', COLORS[i % COLORS.length]);
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        p.style.animationDuration = (480 + Math.random() * 280) + 'ms';
        p.style.animationDelay = (Math.random() * 60) + 'ms';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 900);
    }

    setTimeout(() => {
        simulatorBanish.classList.remove("banish-anim");
        simulatorBanish.querySelector("h3").style.opacity = "1";
    }, 1000);
}

function updateActiveSummons() {
    // console.log(activeSummons);
    for (const el of Array.from(simulatorSummonZone.children)) {
        if (el.tagName === 'IMG' || el.classList.contains('summon-card-wrap')) el.remove();
    }
    if (!activeSummons.length) document.querySelector("#simulatorSummonZone h3").style.display = "block";
    else document.querySelector("#simulatorSummonZone h3").style.display = "none";
    activeSummons.forEach((id, i) => {
        simulatorSummonZone.append(createSimulatorCard(id, "summonZoneCard", "", activeSummonHP[i] ?? summonDefaultHp(id)));
    });
}

function updateActiveReactions() {
    // console.log(activeReactions);
    for (let el of Array.from(simulatorReactionZone.children)) {
        if (el.tagName === "H3") continue;
        el.remove();
    }
    if (!activeReactions.length) document.querySelector("#simulatorReactionZone h3").style.display = "block";
    else document.querySelector("#simulatorReactionZone h3").style.display = "none";
    for (const r in activeReactions) {
        let card = getObjectById(cards, activeReactions[r]);
        simulatorReactionZone.append(createSimulatorCard(card.id, "reactionZoneCard"));
    }
}

function handleRemovingTargetedCard(index) {
    if (targetedCard.parentElement === simulatorSummonZone) {
        removeSummonState(index);
        updateActiveSummons();
    }
    if (targetedCard.parentElement === simulatorReactionZone) {
        activeReactions.splice(index, 1);
        updateActiveReactions();
    }
    if (targetedCard.parentElement === simulatorHand) {
        activeHand.splice(index, 1);
    }
}

simulatorModalContainer.addEventListener("click", (e) => {
    if (e.target.id === "simulatorModalContainer") {
        simulatorModalContainer.classList.remove("active");
        simulatorModalBody.classList.remove('rearrange-body');
    }
});

simulatorTokensModalContainer.addEventListener("click", (e) => {
    if (e.target.id === "simulatorTokensModalContainer") simulatorTokensModalContainer.classList.remove("active");
});

simulatorConditionalModalContainer.addEventListener("click", (e) => {
    if (e.target.id === "simulatorConditionalModalContainer") closeConditionalModal();
});

simulatorTokensModalButton.onclick = () => {
    simulatorTokensModalContainer.classList.remove("active");
}
/* ============================================================
   DRAG & DROP — hand cards onto the board (pointer events, so touch works)
============================================================ */

const SIM_DRAG_THRESHOLD = 6;
let simDrag = null;

function enableHandDrag(el) {
    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const rect = el.getBoundingClientRect();
        simDrag = {
            el, active: false, hover: null,
            startX: e.clientX, startY: e.clientY,
            offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
            width: rect.width,
        };
        try { el.setPointerCapture(e.pointerId); } catch { /* still works without capture */ }
    });
    el.addEventListener("pointermove", (e) => {
        if (!simDrag || simDrag.el !== el) return;
        if (!simDrag.active) {
            if (Math.hypot(e.clientX - simDrag.startX, e.clientY - simDrag.startY) < SIM_DRAG_THRESHOLD) return;
            startSimDrag();
        }
        moveSimDrag(e);
    });
    el.addEventListener("pointerup", (e) => {
        if (!simDrag || simDrag.el !== el) return;
        finishSimDrag(e);
    });
    el.addEventListener("pointercancel", () => {
        if (simDrag && simDrag.el === el) endSimDrag();
    });
}

function startSimDrag() {
    simDrag.active = true;
    window.__simDragActive = true; // tells the long-press helper to stand down
    simulatorContextMenu.classList.remove("active");
    const ghost = simDrag.el.cloneNode();
    ghost.className = "sim-drag-ghost";
    ghost.removeAttribute("data-context");
    ghost.style.width = `${simDrag.width}px`;
    document.body.append(ghost);
    simDrag.ghost = ghost;
    simDrag.el.classList.add("sim-dragging");
    document.body.classList.add("sim-drag-active");
}

function moveSimDrag(e) {
    const dx = e.clientX - simDrag.startX;
    const tilt = Math.max(-12, Math.min(12, dx * 0.04));
    simDrag.ghost.style.transform =
        `translate(${e.clientX - simDrag.offsetX}px, ${e.clientY - simDrag.offsetY}px) rotate(${tilt}deg) scale(1.04)`;

    const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-drop]") ?? null;
    if (zone !== simDrag.hover) {
        simDrag.hover?.classList.remove("drop-hover");
        zone?.classList.add("drop-hover");
        simDrag.hover = zone;
    }
}

function finishSimDrag() {
    const { el, active, hover } = simDrag;
    const dropRect = simDrag.ghost?.getBoundingClientRect() ?? null; // the play animation starts from the drop point
    endSimDrag();
    if (!active) return; // a plain click — the click handler opens the menu
    el._suppressClick = true;
    if (!hover) return;

    targetedCard = el;
    switch (hover.dataset.drop) {
        case "play":      playCard(dropRect); break;
        case "graveyard": sendTargetedCardToGraveyard(); break;
        case "deck":      putTargetedCardOnDeck("top"); break;
        case "banish":    banishTargetedCard(); break;
    }
}

function endSimDrag() {
    if (!simDrag) return;
    simDrag.ghost?.remove();
    simDrag.hover?.classList.remove("drop-hover");
    simDrag.el.classList.remove("sim-dragging");
    document.body.classList.remove("sim-drag-active");
    simDrag = null;
    setTimeout(() => { window.__simDragActive = false; }, 0);
}

/* ============================================================
   SAVE + UNDO
   The whole board is a small JSON snapshot. A ticker watches it: once a change has settled
   (unchanged for one tick, nothing in flight) it is saved for this profile and the previous
   settled snapshot goes onto the undo stack. Animated multi-step actions (draw 5, discard
   hand...) therefore undo as one step.
============================================================ */

const SIM_SAVE_PREFIX = 'DND_TCG_SIM_STATE:';
const SIM_UNDO_LIMIT = 40;
const SIM_TICK_MS = 350;
let simStarted = false;
let simUndoStack = [];
let simLastSettled = null;
let simPrevTick = null;
const simUndoButton = document.getElementById('simUndoButton');

function simSaveKey() { return currentProfile ? SIM_SAVE_PREFIX + toKebabCase(currentProfile) : null; }

function serializeSim() {
    return JSON.stringify({
        v: 1, started: simStarted, game: simGameId,
        deck: activeSimDeck, hand: activeHand, graveyard: activeGraveyard, banish: activeBanish,
        summons: activeSummons, notes: activeSummonNotes, hp: activeSummonHP, once: activeSummonUsed, reactions: activeReactions,
        tokens: activeTokens, counters: _counters,
        turn: parseInt(document.getElementById('simulatorTurnNum').textContent, 10) || 1,
        used: ['action', 'bonusAction', 'reaction'].filter(k => document.getElementById(`${k}Pip`).classList.contains('used')),
    });
}

function simIsBusy() {
    return !cards || pendingSummons > 0 || !!document.querySelector('.activating-card') || performance.now() < simBusyUntil;
}

function applySimState(state) {
    const known = (ids) => (ids || []).filter(id => getObjectById(cards, id)); // skip cards removed from cards.json
    simStarted = !!state.started;
    simGameId = state.game || (simStarted ? generateUID() : null);
    activeSimDeck = known(state.deck);
    activeHand = known(state.hand);
    activeGraveyard = known(state.graveyard);
    activeBanish = known(state.banish);
    activeReactions = known(state.reactions);
    activeSummons = []; activeSummonNotes = []; activeSummonHP = []; activeSummonUsed = [];
    (state.summons || []).forEach((id, i) => {
        if (!getObjectById(cards, id)) return;
        activeSummons.push(id);
        activeSummonNotes.push(state.notes?.[i] ?? '');
        activeSummonHP.push(state.hp?.[i] ?? summonDefaultHp(id));
        activeSummonUsed.push([...(state.once?.[i] || [])]);
    });
    for (const t in activeTokens) activeTokens[t] = state.tokens?.[t] || 0;
    simulatorTokensModalBody.querySelectorAll('.token-amt').forEach(el => { el.innerHTML = activeTokens[el.dataset.token] || 0; });
    _counters = (state.counters || []).map(c => ({ name: c.name, value: c.value }));
    _renderCounters();

    document.getElementById('simulatorTurnNum').textContent = state.turn || 1;
    setActionState('all', true);
    (state.used || []).forEach(k => document.getElementById(`${k}Pip`)?.classList.add('used'));
    syncActionPips();

    simulatorHand.innerHTML = '';
    activeHand.forEach(id => simulatorHand.append(createSimulatorCard(id)));
    updateActiveSummons();
    updateActiveReactions();
    updateGraveyard();
    simulatorDeck.classList.toggle('empty', !simStarted);
    simulatorContextMenu.classList.remove('active');
    if (simStarted) simulatorDeckSelectContainer.classList.remove('active');
}

function saveSim(snapshot) {
    const key = simSaveKey();
    if (!key) return;
    try {
        localStorage.setItem(key, snapshot);
        localStorage.setItem(key + ':at', String(Date.now()));
    } catch { /* storage full or blocked: keep playing */ }
    scheduleBattleMirror(snapshot);
}

function markSimSettled() {
    simLastSettled = simPrevTick = serializeSim();
    updateUndoButton();
}

function updateUndoButton() {
    if (!simUndoButton) return;
    simUndoButton.disabled = simUndoStack.length === 0;
    simUndoButton.title = simUndoStack.length ? `Undo (${simUndoStack.length} step${simUndoStack.length === 1 ? '' : 's'}) · Ctrl+Z` : 'Nothing to undo';
}

setInterval(() => {
    if (!currentProfile || !cards) return;
    const snap = serializeSim();
    if (snap !== simPrevTick) { simPrevTick = snap; return; } // still changing
    if (snap === simLastSettled || simIsBusy()) return;
    if (simDropUndo) {
        simUndoStack = [];
        simDropUndo = false;
    } else if (simLastSettled !== null) {
        simUndoStack.push(simLastSettled);
        if (simUndoStack.length > SIM_UNDO_LIMIT) simUndoStack.shift();
    }
    simLastSettled = snap;
    saveSim(snap);
    updateUndoButton();
}, SIM_TICK_MS);

// Catch anything that changed in the last moments before the tab closes.
window.addEventListener('pagehide', () => {
    if (currentProfile && cards && !simIsBusy()) saveSim(serializeSim());
});

function undoSim() {
    if (simIsBusy()) { showToast('Hang on, cards are still moving.', 'info'); return; }
    if (simDropUndo) { showToast("Your DM's changes can't be undone.", 'info'); return; }
    // a change that hasn't settled yet counts as the latest step
    const current = serializeSim();
    if (current !== simLastSettled && simLastSettled !== null) simUndoStack.push(simLastSettled);
    const prev = simUndoStack.pop();
    if (!prev) { showToast('Nothing to undo.', 'info'); return; }
    applySimState(JSON.parse(prev));
    simLastSettled = simPrevTick = prev;
    saveSim(prev);
    updateUndoButton();
    showToast('Undid the last action.', 'info');
}

document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
    if (!document.getElementById('simulatorSection').classList.contains('active')) return;
    if (e.target.closest('input, textarea, [contenteditable]') || document.querySelector('.confirm-overlay, .modal-container.active')) return;
    e.preventDefault();
    undoSim();
});

// On login: pick up the saved game for this profile, or start fresh with the deck picker.
function restoreOrStartSimulator(remote = null) {
    simUndoStack = [];
    simDropUndo = false;
    let saved = null, localAt = 0;
    try {
        saved = JSON.parse(localStorage.getItem(simSaveKey()) || 'null');
        localAt = Number(localStorage.getItem(simSaveKey() + ':at')) || 0;
    } catch { saved = null; }
    if (remote?.state && (remote.updatedAt || 0) > localAt + 1000) {
        try { saved = JSON.parse(remote.state); } catch { /* keep the local copy */ }
    }
    if (saved && saved.started) {
        applySimState(saved);
        showToast('Picked up your last simulator game.', 'info');
    } else {
        resetSimulator();
    }
    markSimSettled();
}

/* ============================================================
   SPECTATING
   Every settled board is mirrored to the profile (`battle`), so admins can watch it in the
   Spectate tab. Admins don't edit the board directly: they queue commands in `battleCommands`,
   and this client applies them (with the usual animations), reports the outcome in `battleLog`,
   and removes them. That keeps this client the only writer of the board.
============================================================ */

let simGameId = null;
let simDropUndo = false;          // set after a DM change; the next settle clears the undo history
let battleLog = [];               // outcomes of DM commands, newest last (shown to spectators)
const BATTLE_LOG_LIMIT = 12;
const battleCmdQueue = [];
const battleCmdSeen = new Set();
let battleCmdTimer = null;

let battleMirrorTimer = null, battleMirrorPending = null, battleMirrorLast = null;

function scheduleBattleMirror(snapshot) {
    battleMirrorPending = snapshot;
    if (battleMirrorTimer || !currentProfile) return;
    const profile = currentProfile;
    battleMirrorTimer = setTimeout(() => {
        battleMirrorTimer = null;
        const snap = battleMirrorPending;
        if (snap === battleMirrorLast || currentProfile !== profile) return;
        battleMirrorLast = snap;
        let started = false;
        try { started = !!JSON.parse(snap).started; } catch { /* ignore */ }
        profileDoc(profile).update({ battle: { state: snap, started, game: simGameId, updatedAt: Date.now() } })
            .catch(err => console.warn('battle mirror failed', err));
    }, 600);
}

function simVisible() {
    return document.getElementById('simulatorSection').classList.contains('active') && document.visibilityState === 'visible';
}

// brief purple pulse on a card the DM just touched
function dmTouch(el) {
    if (!el) return;
    el.classList.remove('dm-touched');
    void el.offsetWidth;
    el.classList.add('dm-touched');
    setTimeout(() => el.classList.remove('dm-touched'), 1700);
}

function queueBattleCommands(list) {
    let added = false;
    for (const cmd of list || []) {
        if (!cmd?.id || battleCmdSeen.has(cmd.id)) continue;
        battleCmdSeen.add(cmd.id);
        battleCmdQueue.push(cmd);
        added = true;
    }
    if (added) processBattleCommands();
}

function clearBattleCommands() {
    battleCmdQueue.length = 0;
    battleCmdSeen.clear();
    clearTimeout(battleCmdTimer);
    battleLog = [];
    battleMirrorLast = null;
}

function processBattleCommands() {
    clearTimeout(battleCmdTimer);
    if (!battleCmdQueue.length || !currentProfile) return;
    // wait for a quiet board (and the player's own pop-ups) before stepping in
    if (!cards || simIsBusy() || document.querySelector('.confirm-overlay')) {
        battleCmdTimer = setTimeout(processBattleCommands, 400);
        return;
    }
    const cmd = battleCmdQueue.shift();
    const by = cmd.by || 'Your DM';
    let result;
    if (!simStarted || (cmd.game && cmd.game !== simGameId)) {
        result = { ok: false, quiet: true, log: 'Skipped: that game had already ended' };
    } else {
        try { result = applyBattleCommand(cmd); }
        catch (err) { console.warn('DM command failed', err); result = { ok: false, log: 'Failed unexpectedly' }; }
    }
    if (result.ok) {
        simDropUndo = true;
        showToast(`${by} ${result.text}`, 'dm');
        if (cmd.message) showToast(`${by}: "${cmd.message}"`, 'dm');
    } else if (!result.quiet && result.text) {
        showToast(`${by} tried to step in, but ${result.text}`, 'info');
    }

    battleLog = [...battleLog, { id: cmd.id, at: Date.now(), by: cmd.by || '', ok: !!result.ok, text: result.log }].slice(-BATTLE_LOG_LIMIT);
    profileDoc(currentProfile).update({
        battleCommands: firebase.firestore.FieldValue.arrayRemove(cmd),
        battleLog,
    }).catch(err => console.warn("couldn't clear the DM command", err));

    battleCmdTimer = setTimeout(processBattleCommands, result.ok ? 700 : 50);
}

function applyBattleCommand(cmd) {
    const seen = simVisible();
    const name = (id) => getObjectById(cards, id)?.name ?? id;
    const done = (text, log) => ({ ok: true, text, log });
    const fail = (text, log) => ({ ok: false, text, log: log || `Failed: ${text}` });
    // the board may have shifted since the DM looked: trust the index only if the card still matches
    const find = (arr) => arr[cmd.index] === cmd.cardId ? cmd.index : arr.indexOf(cmd.cardId);
    const summonImg = (i) => simulatorSummonZone.querySelectorAll('.summon-card-wrap img')[i];

    switch (cmd.type) {
        case 'add': {
            const card = getObjectById(cards, cmd.cardId);
            if (!card) return fail('that card no longer exists.');
            const n = card.name;
            switch (cmd.to) {
                case 'hand':
                    activeHand.push(card.id);
                    simulatorHand.append(createSimulatorCard(card.id));
                    if (seen) dmTouch(simulatorHand.lastElementChild);
                    return done(`put ${n} into your hand.`, `Added ${n} to hand`);
                case 'deckTop':
                    activeSimDeck.unshift(card.id);
                    return done(`put ${n} on top of your deck.`, `Put ${n} on top of the deck`);
                case 'deckBottom':
                    activeSimDeck.push(card.id);
                    return done(`put ${n} on the bottom of your deck.`, `Put ${n} on the bottom of the deck`);
                case 'deckShuffle':
                    activeSimDeck.push(card.id);
                    shuffleDeck();
                    return done(`shuffled ${n} into your deck.`, `Shuffled ${n} into the deck`);
                case 'graveyard':
                    activeGraveyard.push(card.id);
                    updateGraveyard();
                    return done(`put ${n} in your graveyard.`, `Put ${n} in the graveyard`);
                case 'banish':
                    activeBanish.push(card.id);
                    if (seen) animateBanish();
                    return done(`banished ${n}.`, `Banished ${n}`);
                case 'summon':
                    if (card.class !== 'Summon') return fail(`${n} isn't a Summon.`);
                    if (activeSummons.length + pendingSummons >= MAX_ACTIVE_SUMMONS) return fail(`your Summon Zone is full.`, `Summon Zone full; ${n} not summoned`);
                    addSummonState(card.id);
                    updateActiveSummons();
                    if (seen) { const el = summonImg(activeSummons.length - 1); dmTouch(el?.parentElement); playCardEffect(card, el); }
                    return done(`summoned ${n} onto your field.`, `Summoned ${n}`);
                case 'reaction':
                    if (card.class !== 'Reaction') return fail(`${n} isn't a Reaction.`);
                    activeReactions.push(card.id);
                    updateActiveReactions();
                    if (seen) playReactionSetEffect(simulatorReactionZone.querySelector('img:last-of-type'));
                    return done(`set ${n} in your Reaction Zone.`, `Set ${n} as a Reaction`);
            }
            return fail('that destination is unknown.');
        }

        case 'summon': {
            const i = find(activeSummons);
            if (i < 0) return fail('that summon had already left the field.', 'Summon was already gone');
            const id = activeSummons[i], n = name(id);
            switch (cmd.action) {
                case 'kill':
                    if (seen && summonImg(i)) { targetedCard = summonImg(i); sendTargetedCardToGraveyard(); }
                    else { removeSummonState(i); activeGraveyard.push(id); updateActiveSummons(); updateGraveyard(); }
                    return done(`slew your ${n}.`, `Killed ${n}`);
                case 'hp': case 'heal': {
                    const hp = cmd.action === 'heal' ? summonDefaultHp(id) : Math.round(Number(cmd.hp) || 0);
                    activeSummonHP[i] = hp;
                    updateActiveSummons();
                    if (seen) dmTouch(summonImg(i)?.parentElement);
                    if (seen && hp <= 0) promptSummonDeath(summonImg(i));
                    return done(cmd.action === 'heal' ? `healed your ${n} to full.` : `set your ${n} to ${hp} HP.`,
                        cmd.action === 'heal' ? `Healed ${n} to ${hp} HP` : `Set ${n} to ${hp} HP`);
                }
                case 'toHand':
                    removeSummonState(i);
                    activeHand.push(id);
                    simulatorHand.append(createSimulatorCard(id));
                    updateActiveSummons();
                    if (seen) dmTouch(simulatorHand.lastElementChild);
                    return done(`returned your ${n} to your hand.`, `Returned ${n} to hand`);
                case 'banish':
                    removeSummonState(i);
                    activeBanish.push(id);
                    updateActiveSummons();
                    if (seen) animateBanish();
                    return done(`banished your ${n}.`, `Banished ${n}`);
            }
            return fail('that action is unknown.');
        }

        case 'reaction': {
            const i = find(activeReactions);
            if (i < 0) return fail('that Reaction had already left the field.', 'Reaction was already gone');
            const id = activeReactions[i], n = name(id);
            activeReactions.splice(i, 1);
            updateActiveReactions();
            if (cmd.action === 'toHand') { activeHand.push(id); simulatorHand.append(createSimulatorCard(id)); if (seen) dmTouch(simulatorHand.lastElementChild); return done(`returned your ${n} to your hand.`, `Returned ${n} to hand`); }
            if (cmd.action === 'banish') { activeBanish.push(id); if (seen) animateBanish(); return done(`banished your ${n}.`, `Banished ${n}`); }
            activeGraveyard.push(id);
            updateGraveyard();
            return done(`destroyed your ${n}.`, `Destroyed ${n}`);
        }

        case 'hand': {
            const i = find(activeHand);
            if (i < 0) return fail('that card had already left your hand.', 'Card was no longer in hand');
            const id = activeHand[i], n = name(id);
            const el = simulatorHand.children[i];
            activeHand.splice(i, 1);
            if (el) { if (seen) _fadeOut(el, 220, cmd.action === 'discard' ? 'down' : 'up'); else el.remove(); }
            switch (cmd.action) {
                case 'discard': activeGraveyard.push(id); updateGraveyard(); return done(`made you discard ${n}.`, `Discarded ${n}`);
                case 'banish': activeBanish.push(id); if (seen) animateBanish(); return done(`banished ${n} from your hand.`, `Banished ${n} from hand`);
                case 'deckTop': activeSimDeck.unshift(id); return done(`put ${n} back on top of your deck.`, `Put ${n} on top of the deck`);
                default: activeSimDeck.push(id); shuffleDeck(); return done(`shuffled ${n} from your hand into your deck.`, `Shuffled ${n} into the deck`);
            }
        }

        case 'graveyard': {
            const i = find(activeGraveyard);
            if (i < 0) return fail('that card had already left your graveyard.', 'Card was no longer in the graveyard');
            const id = activeGraveyard[i], n = name(id);
            activeGraveyard.splice(i, 1);
            updateGraveyard();
            if (cmd.action === 'toHand') { activeHand.push(id); simulatorHand.append(createSimulatorCard(id)); if (seen) dmTouch(simulatorHand.lastElementChild); return done(`returned ${n} from your graveyard to your hand.`, `Returned ${n} to hand`); }
            if (cmd.action === 'banish') { activeBanish.push(id); if (seen) animateBanish(); return done(`banished ${n} from your graveyard.`, `Banished ${n} from the graveyard`); }
            activeSimDeck.push(id);
            shuffleDeck();
            return done(`shuffled ${n} from your graveyard into your deck.`, `Shuffled ${n} into the deck`);
        }

        case 'deck': {
            const n = Math.max(1, Math.min(20, Math.round(Number(cmd.n) || 1)));
            if (!activeSimDeck.length) return fail('your deck is empty.', 'Deck was empty');
            if (cmd.action === 'shuffle') { shuffleDeck(); return done('shuffled your deck.', 'Shuffled the deck'); }
            const count = Math.min(n, activeSimDeck.length);
            if (cmd.action === 'mill') {
                activeGraveyard.push(...activeSimDeck.splice(0, count));
                updateGraveyard();
                return done(`sent the top ${count === 1 ? 'card' : `${count} cards`} of your deck to the graveyard.`, `Milled ${count}`);
            }
            for (let k = 0; k < count; k++) setTimeout(drawCard, k * 250);
            return done(`made you draw ${count === 1 ? 'a card' : `${count} cards`}.`, `Drew ${count}`);
        }

        case 'actions': {
            const labels = { action: 'Action', bonusAction: 'Bonus Action', reaction: 'Reaction' };
            if (cmd.action === 'restore') { setActionState('all', true); return done('restored all your actions.', 'Restored all actions'); }
            if (!labels[cmd.which]) return fail('that action is unknown.');
            setActionState(cmd.which, cmd.action !== 'spend');
            return done(`${cmd.action === 'spend' ? 'used up' : 'restored'} your ${labels[cmd.which]}.`, `${cmd.action === 'spend' ? 'Spent' : 'Restored'} ${labels[cmd.which]}`);
        }

        case 'tokens': {
            if (!(cmd.token in activeTokens)) return fail('that token type is unknown.');
            const d = Math.round(Number(cmd.delta) || 0);
            activeTokens[cmd.token] = Math.max(0, activeTokens[cmd.token] + d);
            simulatorTokensModalBody.querySelectorAll('.token-amt').forEach(el => { if (el.dataset.token === cmd.token) el.innerHTML = activeTokens[cmd.token]; });
            return done(`${d >= 0 ? 'gave you' : 'took'} ${Math.abs(d)} ${cmd.token} token${Math.abs(d) === 1 ? '' : 's'}.`, `${d >= 0 ? '+' : '−'}${Math.abs(d)} ${cmd.token} token${Math.abs(d) === 1 ? '' : 's'}`);
        }

        case 'turn':
            nextTurn();
            return done('ended your turn.', 'Ended the turn');
    }
    return fail('that command is unknown.');
}
