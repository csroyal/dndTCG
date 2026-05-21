let simulatorContextMenu = document.getElementById("simulatorContextMenu");
let simulatorDeckSelectContainer = document.getElementById("simulatorDeckSelectContainer");
let simulatorDeckSelect = document.getElementById("simulatorDeckSelect");
let simulatorDeckSelectConfirm = document.getElementById("simulatorDeckSelectConfirm");
let simulatorSummonZone = document.getElementById("simulatorSummonZone");
let simulatorReactionZone = document.getElementById("simulatorReactionZone");
let simulatorGraveyard = document.getElementById("simulatorGraveyard");
let simulatorDeck = document.getElementById("simulatorDeck");
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
    if (document.getElementById("simulatorSection").classList.contains("active") && document.getElementById("simulatorSection").contains(e.target)) {
        e.preventDefault();

        if (e.target.dataset.context) renderSimulatorContextMenu(e.target, e.pageX, e.pageY);
        if (e.target.dataset.cardId) {
            let contextMenuCardNameSpans = document.querySelectorAll(".simulator-context-card-name");
            contextMenuCardNameSpans.forEach(span => {
                span.innerHTML = getObjectById(cards, e.target.dataset.cardId).name;
            });
        }
        return false;
    }
});

function renderSimulatorContextMenu(target, x, y) {
    targetedCard = target;
    let contextMenuOptions = simulatorContextMenu.querySelectorAll("ul");
    contextMenuOptions.forEach(item => {
        if (item.dataset.context === target.dataset.context) {
            item.style.display = "block";
        } else item.style.display = "none";
    });

    if (y + simulatorContextMenu.clientHeight > window.innerHeight) {
        simulatorContextMenu.style.top = 'unset';
        simulatorContextMenu.style.bottom = `${window.innerHeight - y}px`;
    } else {
        simulatorContextMenu.style.top = `${y}px`;
        simulatorContextMenu.style.bottom = 'unset';
    }
    simulatorContextMenu.style.left = `${x}px`;
    simulatorContextMenu.classList.add("active");
}

function buildDeckSelect() {
    simulatorDeckSelect.innerHTML = "";

    for (d in decks) {
        let container = document.createElement("div");
        container.innerHTML = decks[d].name;
        container.setAttribute("data-deck-id", decks[d].id);

        container.onclick = () => {
            if (simulatorDeckSelect.querySelector(".selected")) simulatorDeckSelect.querySelector(".selected").classList.remove("selected");
            container.classList.add("selected");
        }

        simulatorDeckSelect.append(container);
    }

    simulatorDeckSelectContainer.classList.add("active");
}

simulatorDeckSelectConfirm.addEventListener("click", () => {
    let deck = getObjectById(decks, simulatorDeckSelect.querySelector("div.selected").dataset.deckId);
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
            tokenAmt.innerHTML = Number(tokenAmt.innerHTML) - 1 < 0 ? 0 : Number(tokenAmt.innerHTML) - 1;
            activeTokens[t]--;
        }

        let trackerGroup = document.createElement("div");

        let tokenImg = document.createElement("img");
        tokenImg.src = `./assets/token-icons/${t}.png`;

        let tokenNameSpan = document.createElement("span");
        tokenNameSpan.innerHTML = t + " Tokens";

        let tokenAmt = document.createElement("div");
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
    let index = Array.from(targetedCard.parentNode.children).indexOf(targetedCard) - 1;
    handleRemovingTargetedCard(index);
    if (targetedCard.parentElement === simulatorHand) {
        index++;
    }
    targetedCard.remove();
    activeGraveyard.push(targetedCard.dataset.cardId);
    updateGraveyard();
}

function sendTargetedCardToHand() {
    let index = Array.from(targetedCard.parentNode.children).indexOf(targetedCard) - 1;
    handleRemovingTargetedCard(index);
    targetedCard.remove();
    activeHand.push(targetedCard.dataset.cardId);
    simulatorHand.append(createSimulatorCard(targetedCard.dataset.cardId));
}

function banishTargetedCard() {
    let index = Array.from(targetedCard.parentNode.children).indexOf(targetedCard) - 1;
    handleRemovingTargetedCard(index);
    if (targetedCard.parentElement === simulatorHand) {
        index++;
    }
    targetedCard.remove();
    activeBanish.push(targetedCard.dataset.cardId);
    animateBanish();
}

function activateTargetedCard() {
    // play animation
    sendTargetedCardToGraveyard();
}

function viewGraveyard() {
    simulatorModalContainer.querySelector("h2").innerHTML = "Graveyard";

    simulatorModalBody.innerHTML = "";

    for (g in activeGraveyard) {
        simulatorModalBody.append(createSimulatorCard(activeGraveyard[g]));
    }

    simulatorModalButton.innerHTML = "Close";

    simulatorModalButton.onclick = () => {
        simulatorModalContainer.classList.remove("active");
    }

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
        activeGraveyard.splice(activeGraveyard.indexOf(targetCardID), 1);
        activeHand.push(targetCardID);
        simulatorHand.append(createSimulatorCard(targetCardID));
        simulatorModalContainer.classList.remove("active");
        updateGraveyard();
    }

    simulatorModalContainer.classList.add("active");
}

function shuffleGraveyardIntoDeck() {
    for (g in activeGraveyard) {
        activeSimDeck.push(activeGraveyard[g]);
    }
    activeGraveyard = [];
    updateGraveyard();
    shuffleDeck();
}

function returnRandomCardFromGraveyard() {
    let card = activeGraveyard[getRandomInt(0, activeGraveyard.length - 1)];
    activeGraveyard.splice(activeGraveyard.indexOf(card), 1);
    activeHand.push(card);
    playSound("draw");
    simulatorHand.append(createSimulatorCard(card));
    updateGraveyard();
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
        alert("No possible cards with these conditions.");
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

function drawCards(count = 0) {
    let drawAmount = count ? count : prompt(`Draw how many cards?`);
    for (var i = 0; i < drawAmount; i++) {
        setTimeout(drawCard, i * 250);
    }
}

function drawCardFromBottom() {
    let card = activeSimDeck[activeSimDeck.length - 1];
    activeSimDeck.pop();
    activeHand.push(card);
    animateCardDraw();
    playSound("draw");
    setTimeout(() => {
        simulatorHand.append(createSimulatorCard(card));
    }, 500);
}

function drawRandomCard() {
    let card = activeSimDeck[getRandomInt(0, activeSimDeck.length - 1)];
    activeSimDeck.splice(activeSimDeck.indexOf(card), 1);
    activeHand.push(card);
    animateCardDraw();
    playSound("draw");
    setTimeout(() => {
        simulatorHand.append(createSimulatorCard(card));
    }, 500);
}

function shuffleDeck() {
    activeSimDeck = shuffleArray(activeSimDeck);
    animateDeckShuffle();
    playSound("shuffle");
}

function revealFromDeck(direction) {
    let revealAmount = prompt(`Reveal how many cards from ${direction} of deck?`);
    if (!isNumeric(revealAmount)) {
        alert("Entry is not a numeric value.");
        return;
    }
    let str = "";
    for (var i = 0; i < revealAmount; i++) {
        if (direction === "top") {
            str += activeSimDeck[i] + " ";
        } else if (direction === "bottom") {
            str += activeSimDeck[activeSimDeck.length - 1 - i] + " ";
        }
    }
    alert(str);
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
}

function viewBanish() {
    simulatorModalContainer.querySelector("h2").innerHTML = "Banish Zone";

    simulatorModalBody.innerHTML = "";

    for (b in activeBanish) {
        simulatorModalBody.append(createSimulatorCard(activeBanish[b]));
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
    console.log(targetedCard);
    targetedCard.remove();

    activeHand.splice(activeHand.indexOf(targetedCard.dataset.cardId), 1);

    animatePlayCard(targetedCard.dataset.cardId);

    setTimeout(() => {
        if (targetedCard.dataset.cardClass === "Spell" || targetedCard.dataset.cardClass === "Utility") {
            activeGraveyard.push(targetedCard.dataset.cardId);
            updateGraveyard();
        } else if (targetedCard.dataset.cardClass === "Summon") {
            activeSummons.push(targetedCard.dataset.cardId);
            updateActiveSummons();
        } else if (targetedCard.dataset.cardClass === "Reaction") {
            activeReactions.push(targetedCard.dataset.cardId);
            updateActiveReactions();
        }
    }, 1500);
}

function shuffleTargetedCardIntoDeck() {
    let index = Array.from(targetedCard.parentNode.children).indexOf(targetedCard);
    activeSimDeck.push(targetedCard.dataset.cardId);
    activeHand.splice(index, 1);
    targetedCard.remove();
    shuffleDeck();
}

function putTargetedCardOnDeck(direction) {
    let index = Array.from(targetedCard.parentNode.children).indexOf(targetedCard);
    if (direction === "top") {
        activeSimDeck.unshift(targetedCard.dataset.cardId);
    } else if (direction === "bottom") {
        activeSimDeck.push(targetedCard.dataset.cardId);
    }
    activeHand.splice(index, 1);
    targetedCard.remove();
}

function discardHand() {
    for (h in activeHand) {
        activeGraveyard.push(activeHand[h]);
    }
    activeHand = [];
    simulatorHand.innerHTML = "";
    updateGraveyard();
}

function shuffleHandIntoDeck() {
    for (h in activeHand) {
        activeSimDeck.push(activeHand[h]);
    }
    activeHand = [];
    simulatorHand.innerHTML = "";
    shuffleDeck();
}

/* HELPERS */

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
    }, 2000);
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

    setTimeout(() => {
        simulatorBanish.classList.remove("banish-anim");
        simulatorBanish.querySelector("h3").style.opacity = "1";
    }, 1000);
}

function updateActiveSummons() {
    // console.log(activeSummons);
    for (el of Array.from(simulatorSummonZone.children)) {
        console.log(el);
        if (el.tagName !== "IMG") continue;
        el.remove();
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
    if (e.target.id === "simulatorModalContainer") simulatorModalContainer.classList.remove("active");
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