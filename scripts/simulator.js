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
let activeReactions = [];
let activeBanish = [];
let activeTokens = {
    "hand": 0,
    "foot": 0
};

let targetedCard;

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
        renderSimulatorContextMenu(contextEl, e.pageX, e.pageY);
        if (contextEl.dataset.cardId) {
            document.querySelectorAll(".simulator-context-card-name").forEach(span => {
                span.innerHTML = getObjectById(cards, contextEl.dataset.cardId).name;
            });
        }
    }

    return false;
});

function renderSimulatorContextMenu(target, x, y) {
    const matchingUl = simulatorContextMenu.querySelector(`ul[data-context="${target.dataset.context}"]`);
    if (!matchingUl) return;

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
}

function buildDeckSelect() {
    simulatorDeckSelect.innerHTML = "";

    for (d in decks) {
        let deck = decks[d];
        let container = document.createElement("div");
        container.setAttribute("data-deck-id", deck.id);

        let iconImg = document.createElement("img");
        iconImg.classList.add("deck-card-icon");
        iconImg.src = deck.icon ? `./assets/card-art/${deck.icon}.jpg` : "./assets/card-art/back.png";
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
    for (c in deck.deckList) {
        for (var i = 0; i < deck.deckList[c]; i++) activeSimDeck.push(c);
    }
    shuffleDeck();
    console.log(activeSimDeck);

    simulatorDeck.classList.remove("empty");

    setTimeout(() => {
        drawCards(5);
    }, 2000);
}

function createSimulatorCard(cardID, zone = "hand", func = "") {
    let card = getObjectById(cards, cardID);
    let el = document.createElement("img");
    el.src = `./assets/card-art/${cardID}.jpg`;

    el.setAttribute("data-context", zone);
    el.setAttribute("data-card-id", cardID);
    el.setAttribute("data-card-class", card.class);
    el.setAttribute("data-uid", generateUID());

    if (!func) el.addEventListener("click", () => { openInCardViewModal(cardID); });
    else { el.addEventListener("click", func); }

    if (zone === "summonZoneCard") {
        const wrap = document.createElement("div");
        wrap.className = "summon-card-wrap";
        wrap.append(el);

        const defaultHp = card.summonInfo?.hp ?? 0;

        const hpBar = document.createElement("div");
        hpBar.className = "summon-hp-bar";
        hpBar.classList.toggle("hp-danger", defaultHp <= 0);

        const heart = document.createElement("i");
        heart.className = "bi bi-heart-fill summon-hp-heart";

        const hpVal = document.createElement("span");
        hpVal.className = "summon-hp-val";
        hpVal.textContent = defaultHp;
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
                const v = parseInt(input.value) ?? defaultHp;
                hpVal.textContent = isNaN(v) ? defaultHp : v;
                hpBar.classList.toggle("hp-danger", Number(hpVal.textContent) <= 0);
                input.replaceWith(hpVal);
            };
            input.onblur = commit;
            input.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); commit(); } };
        };

        hpBar.append(heart, hpVal);
        wrap.append(hpBar);
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
    for (t in activeTokens) {
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
        tokenAmt.innerHTML = "0";

        trackerGroup.append(tokenImg, tokenNameSpan, tokenAmt);
        
        let plusButton = document.createElement("button");
        plusButton.innerHTML = "+";
        plusButton.onclick = () => {
            tokenAmt.innerHTML = Number(tokenAmt.innerHTML) + 1;
            activeTokens[t]++;
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

async function nextTurn() {
    const confirmed = await showConfirm('End your turn and draw a card?');
    if (!confirmed) return;
    const turnEl = document.getElementById('simulatorTurnNum');
    turnEl.textContent = parseInt(turnEl.textContent, 10) + 1;
    setActionState('all', true);
    if (activeSimDeck.length > 0) drawCard();
}

/* RESET / NEW GAME */

function resetSimulator() {
    activeSimDeck = [];
    activeHand = [];
    activeGraveyard = [];
    activeSummons = [];
    activeReactions = [];
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

    buildDeckSelect();
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
}

function sendTargetedCardToGraveyard() {
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    _removeCardFromContext(targetedCard, 'down', () => {
        activeGraveyard.push(cardID);
        updateGraveyard();
        showToast(`${name} sent to graveyard.`, 'info');
    });
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
    simulatorModalContainer.querySelector("h2").innerHTML = "Search Graveyard";

    simulatorModalBody.innerHTML = "";

    for (g in activeGraveyard) {
        simulatorModalBody.append(createSimulatorCard(activeGraveyard[g], "", (e) => {
            targetCardID = e.target.dataset.cardId;
            if (document.querySelector(".selected-card")) document.querySelector(".selected-card").classList.remove("selected-card");
            e.target.classList.add("selected-card");
        }));
    }

    simulatorModalButton.innerHTML = "Confirm";

    simulatorModalButton.onclick = () => {
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
    for (g in activeGraveyard) {
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

function drawCard() {
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
    if (!drawAmount) {
        const input = await showInput('Draw how many cards?', '1', '1');
        if (input === null) return;
        drawAmount = parseInt(input, 10);
        if (isNaN(drawAmount) || drawAmount < 1) {
            showToast('Please enter a valid number.', 'error');
            return;
        }
    }
    for (let i = 0; i < drawAmount; i++) {
        setTimeout(drawCard, i * 250);
    }
}

function drawCardFromBottom() {
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
    simulatorModalContainer.querySelector("h2").innerHTML = "Search Deck";

    simulatorModalBody.innerHTML = "";

    for (d in activeSimDeck) {
        simulatorModalBody.append(createSimulatorCard(activeSimDeck[d], "", (e) => {
            targetCardID = e.target.dataset.cardId;
            if (document.querySelector(".selected-card")) document.querySelector(".selected-card").classList.remove("selected-card");
            e.target.classList.add("selected-card");
        }));
    }

    simulatorModalButton.innerHTML = "Confirm";

    simulatorModalButton.onclick = () => {
        activeSimDeck.splice(activeSimDeck.indexOf(targetCardID), 1);
        activeHand.push(targetCardID);
        simulatorHand.append(createSimulatorCard(targetCardID));
        simulatorModalContainer.classList.remove("active");
    }

    simulatorModalContainer.classList.add("active");
}

function banishRandomCard() {
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

    for (b in activeBanish) {
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

function playCard() {
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    targetedCard.remove();

    activeHand.splice(activeHand.indexOf(cardID), 1);

    animatePlayCard(cardID);
    showToast(`${name} played.`, 'success');

    setTimeout(() => {
        if (targetedCard.dataset.cardClass === "Spell" || targetedCard.dataset.cardClass === "Utility") {
            activeGraveyard.push(cardID);
            updateGraveyard();
        } else if (targetedCard.dataset.cardClass === "Summon") {
            activeSummons.push(cardID);
            updateActiveSummons();
        } else if (targetedCard.dataset.cardClass === "Reaction") {
            activeReactions.push(cardID);
            updateActiveReactions();
        }
    }, 1500);
}

function shuffleTargetedCardIntoDeck() {
    const domIdx = Array.from(simulatorHand.children).indexOf(targetedCard);
    const cardID = targetedCard.dataset.cardId;
    const name = getObjectById(cards, cardID)?.name ?? cardID;
    activeSimDeck.push(cardID);
    activeHand.splice(domIdx, 1);
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
    _fadeOut(targetedCard, 185, 'up', () => {
        showToast(`${name} placed on ${direction} of deck.`, 'info');
    });
}

function discardHand() {
    const count = activeHand.length;
    for (const h of activeHand) activeGraveyard.push(h);
    activeHand = [];
    const handEls = Array.from(simulatorHand.children);
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
    handEls.forEach((card, i) => {
        setTimeout(() => {
            card.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
            requestAnimationFrame(() => {
                card.style.transform = 'translateY(-20px) scale(0.8)';
                card.style.opacity = '0';
            });
        }, i * 35);
    });
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
    else if (parent === simulatorSummonZone)   activeSummons.splice(arrIdx, 1);
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

function animatePlayCard(id) {
    let card = document.createElement("div");
    card.classList.add("activating-card");
    card.innerHTML = `<img src='./assets/card-art/${id}.jpg'>`;
    document.body.append(card);

    setTimeout(() => { playSound('activate') }, 525);
    setTimeout(() => { card.remove(); }, 1500);
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
    for (s in activeSummons) {
        console.log(activeSummons[s]);
        let card = getObjectById(cards, activeSummons[s]);
        simulatorSummonZone.append(createSimulatorCard(card.id, "summonZoneCard"));
    }
}

function updateActiveReactions() {
    // console.log(activeReactions);
    for (let el of Array.from(simulatorReactionZone.children)) {
        console.log(el);
        if (el.innerHTML === "Reaction Zone") continue;
        el.remove();
    }
    if (!activeReactions.length) document.querySelector("#simulatorReactionZone h3").style.display = "block";
    else document.querySelector("#simulatorReactionZone h3").style.display = "none";
    for (r in activeReactions) {
        let card = getObjectById(cards, activeReactions[r]);
        simulatorReactionZone.append(createSimulatorCard(card.id, "reactionZoneCard"));
    }
}

function handleRemovingTargetedCard(index) {
    if (targetedCard.parentElement === simulatorSummonZone) {
        activeSummons.splice(index, 1);
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