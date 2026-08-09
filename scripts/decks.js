let decksContainer = document.getElementById("decksContainer");
let deckBuilderContainer = document.getElementById("deckBuilderContainer");
let deckBuilderNameEntry = document.getElementById("deckBuilderNameEntry");
let deckBuilderSaveButton = document.getElementById("deckBuilderSaveButton");
let deckBuilderDeleteButton = document.getElementById("deckBuilderDeleteButton");
let deckBuilderCount = document.getElementById("deckBuilderCount");
let deckBuilderDeckList = document.getElementById("deckBuilderDeckList");
let deckBuilderBinder = document.getElementById("deckBuilderBinder");
let deckBuilderBinderList = document.getElementById("deckBuilderBinderList");
let deckBuilderBinderSearch = document.getElementById("deckBuilderBinderSearch");
let deckBuilderBinderFilter = document.getElementById("deckBuilderBinderFilter");

let activeDeck;
const DECK_LIMIT = 30;
const MAX_COPIES_PER_CARD = 4;
let deckRarityRestrictions = { "Rare": 15, "Legendary": 5, "Mythic": 2 };
const RARITY_ORDER_DECK = ["Mythic", "Legendary", "Rare", "Common"];

function createDeckListCardEl(cardID) {
    let cardEl = createCardEl(getObjectById(cards, cardID), (e) => {
        removeCardFromDeckList(e.target);
    }, false, false, true);
    let hint = document.createElement('div');
    hint.className = 'deck-remove-hint';
    hint.innerHTML = '<i class="bi bi-trash3-fill"></i>';
    cardEl.append(hint);
    return cardEl;
}

function buildDecks() {
    decksContainer.innerHTML = '';
    document.querySelector("#decksSection p").style.display = "none";

    let addNewDeckButton = document.createElement("div");
    addNewDeckButton.innerHTML = `<i class="bi bi-plus-square"></i> Create New Deck`;
    addNewDeckButton.classList.add("add-new-deck");
    addNewDeckButton.onclick = () => {
        activeDeck = {
            "id": generateUID(),
            "name": "New Deck " + (Number(decks.length) + 1),
            "deckList": {},
            "icon": null
        };
        loadDeck(activeDeck);
        decks.push(activeDeck);
        db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
    };
    decksContainer.append(addNewDeckButton);

    decks.forEach(deck => {
        let deckPreview = document.createElement("div");
        deckPreview.classList.add("deck-card-preview");

        let iconImg = document.createElement("img");
        iconImg.classList.add("deck-card-icon");
        iconImg.src = deck.icon ? `./assets/card-art/${deck.icon}.jpg` : "./assets/card-art/back.png";
        if (!deck.icon) iconImg.classList.add("placeholder");

        let nameEl = document.createElement("div");
        nameEl.classList.add("deck-preview-name");
        nameEl.innerHTML = deck.name;

        let countEl = document.createElement("div");
        countEl.classList.add("deck-preview-count");
        countEl.innerHTML = `${getCountDeck(deck)} cards`;

        deckPreview.append(iconImg, nameEl, countEl);
        deckPreview.onclick = () => {
            activeDeck = deck;
            loadDeck(deck);
            sortDeckBuilderBinder();
        };
        decksContainer.append(deckPreview);
    });
}

function loadDeck(deck) {
    decksContainer.style.display = "none";
    deckBuilderContainer.style.display = "flex";
    deckBuilderNameEntry.value = deck.name;
    deckBuilderDeckList.innerHTML = "";
    deckBuilderBinderList.innerHTML = "";

    for (let c in deck.deckList) {
        for (let i = 0; i < deck.deckList[c]; i++) {
            deckBuilderDeckList.append(createDeckListCardEl(c));
        }
    }
    sortDeckBuilderDeckList();

    for (let b in binder) {
        if (getObjectById(cards, b).class === "Sleeve") continue;
        let cardEl = createCardEl(getObjectById(cards, b), (e) => {
            let cardID = e.target.dataset.cardId;
            if (!checkDeckRestrictions(getObjectById(cards, cardID))) return;
            if (e.target.classList.contains("owned")) {
                if (activeDeck.deckList[cardID]) {
                    activeDeck.deckList[cardID] = activeDeck.deckList[cardID] + 1;
                } else {
                    activeDeck.deckList[cardID] = 1;
                }
                let badge = e.target.previousElementSibling;
                badge.innerHTML = Number(badge.innerHTML) - 1;
                if (badge.innerHTML == 0) e.target.classList.remove("owned");
                addToDeckList(cardID);
                sortDeckBuilderDeckList();
            } else {
                showToast("No more copies of this card in your binder.", "error");
            }
        });

        if (deck.deckList[b]) {
            cardEl.querySelector(".badge").innerHTML = Number(cardEl.querySelector(".badge").innerHTML) - deck.deckList[b];
            if (cardEl.querySelector(".badge").innerHTML == 0) cardEl.querySelector(".card").classList.remove("owned");
        }

        // deck count badge (Feature 5)
        let deckBadge = document.createElement('div');
        deckBadge.className = 'deck-count-badge';
        let dCount = deck.deckList[b] || 0;
        deckBadge.textContent = `×${dCount}`;
        deckBadge.style.display = dCount > 0 ? '' : 'none';
        cardEl.append(deckBadge);

        deckBuilderBinderList.append(cardEl);
    }

    updateDeckStats();
    updateDeckIconPreview();
}

function addToDeckList(cardID) {
    deckBuilderDeckList.append(createDeckListCardEl(cardID));
    updateDeckCountBadge(cardID);
    updateDeckStats();
    saveActiveDeck();
}

async function removeCardFromDeckList(el) {
    const cardName = getObjectById(cards, el.dataset.cardId).name;
    const confirmed = await showConfirm(`Remove <strong>${cardName}</strong> from ${activeDeck.name}?`);
    if (!confirmed) return;

    let binderCard = deckBuilderBinderList.querySelector(`.card-wrapper:has(img[data-card-id="${el.dataset.cardId}"])`);
    if (binderCard) {
        binderCard.querySelector(".badge").innerHTML = Number(binderCard.querySelector(".badge").innerHTML) + 1;
        binderCard.querySelector(".card").classList.add("owned");
    }

    if (activeDeck.deckList[el.dataset.cardId] > 1) {
        activeDeck.deckList[el.dataset.cardId] -= 1;
    } else {
        delete activeDeck.deckList[el.dataset.cardId];
    }

    if (activeDeck.icon === el.dataset.cardId && !activeDeck.deckList[el.dataset.cardId]) {
        delete activeDeck.icon;
        updateDeckIconPreview();
    }

    el.parentElement.remove();
    updateDeckCountBadge(el.dataset.cardId);
    updateDeckStats();
    saveActiveDeck();
}

function updateDeckCountBadge(cardID) {
    let bCard = deckBuilderBinderList.querySelector(`.card-wrapper:has(img[data-card-id="${cardID}"])`);
    if (!bCard) return;
    let badge = bCard.querySelector('.deck-count-badge');
    if (!badge) return;
    let count = activeDeck.deckList[cardID] || 0;
    badge.textContent = `×${count}`;
    badge.style.display = count > 0 ? '' : 'none';
}

function updateDeckStats() {
    const total = getCountActiveDeck();
    deckBuilderCount.textContent = total;

    // Progress bar
    const fill = document.getElementById('deckProgressFill');
    if (fill) {
        const pct = (total / DECK_LIMIT) * 100;
        fill.style.width = pct + '%';
        fill.className = 'deck-progress-fill' +
            (total >= DECK_LIMIT ? ' complete' : pct >= 80 ? ' near' : '');
    }

    // Restriction meters for slot-limited rarities
    let statsEl = document.getElementById('deckBuilderRarityStats');
    if (!statsEl) return;

    let counts = { Rare: 0, Legendary: 0, Mythic: 0 };
    for (let c in activeDeck.deckList) {
        let card = getObjectById(cards, c);
        if (card && counts[card.rarity] !== undefined) counts[card.rarity] += activeDeck.deckList[c];
    }

    statsEl.innerHTML = ['Rare', 'Legendary', 'Mythic'].map(r => {
        const used = counts[r];
        const max  = deckRarityRestrictions[r];
        const cls  = used >= max ? ' full' : used / max >= 0.75 ? ' near' : '';
        return `<span class="deck-rarity-pip rarity-${r.toLowerCase()}${cls}">${used}/${max} ${r}</span>`;
    }).join('');
}

function updateDeckIconPreview() {
    let preview = document.getElementById("deckBuilderIconPreview");
    if (!preview) return;
    preview.innerHTML = "";
    preview.style.cursor = "default";
    preview.onclick = null;

    if (activeDeck && activeDeck.icon) {
        let img = document.createElement("img");
        img.src = `./assets/card-art/${activeDeck.icon}.jpg`;
        preview.append(img);
        preview.style.cursor = "pointer";
        preview.title = "Click to remove deck icon";
        preview.onclick = () => {
            delete activeDeck.icon;
            updateDeckIconPreview();
            saveActiveDeck();
        };
    } else {
        preview.innerHTML = "<span>Select an icon</span>";
        preview.title = "";
    }
    refreshDeckIconSelection();
}

function setDeckIcon(cardId) {
    if (!activeDeck) return;
    activeDeck.icon = cardId;
    updateDeckIconPreview();
    saveActiveDeck();
}

function isDeckIconSelected(cardId) {
    return activeDeck && activeDeck.icon === cardId;
}

function refreshDeckIconSelection() {
    let buttons = deckBuilderDeckList.querySelectorAll(".deck-icon-select-button");
    buttons.forEach(btn => {
        let cardId = btn.parentElement.querySelector("img.card").dataset.cardId;
        btn.classList.toggle("selected", activeDeck && activeDeck.icon === cardId);
    });
}

function sortDeckBuilderBinder() {
    const container = document.querySelector("#deckBuilderBinderList");
    const rarityRank = { "Mythic": 0, "Legendary": 1, "Rare": 2, "Common": 3 };
    Array.from(container.querySelectorAll('.card-wrapper'))
        .sort((a, b) => {
            const cardA = getObjectById(cards, a.querySelector('img').dataset.cardId);
            const cardB = getObjectById(cards, b.querySelector('img').dataset.cardId);
            const rDiff = (rarityRank[cardA?.rarity] ?? 4) - (rarityRank[cardB?.rarity] ?? 4);
            if (rDiff !== 0) return rDiff;
            return (cardA?.name || '').localeCompare(cardB?.name || '');
        })
        .forEach(card => container.appendChild(card));
}

function sortDeckBuilderDeckList() {
    const container = document.querySelector("#deckBuilderDeckList");
    Array.from(container.querySelectorAll('.card-wrapper'))
        .sort((a, b) => {
            const idA = parseInt(a.querySelector('img').dataset.cardId, 10);
            const idB = parseInt(b.querySelector('img').dataset.cardId, 10);
            return idA - idB;
        })
        .forEach(card => container.appendChild(card));
}

function checkDeckRestrictions(card) {
    if (getCountActiveDeck() + 1 > DECK_LIMIT) {
        showToast(`Decks are limited to ${DECK_LIMIT} cards.`, "error");
        return false;
    }
    if (card.rarity === "Mythic" || card.rarity === "Legendary") {
        if (activeDeck.deckList[card.id]) {
            showToast(`Only 1 copy of ${card.name} allowed per deck.`, "error");
            return false;
        }
        if (getRarityCountFromDeckList(card.rarity) + 1 > deckRarityRestrictions[card.rarity]) {
            showToast(`Max ${deckRarityRestrictions[card.rarity]} ${card.rarity} cards per deck.`, "error");
            return false;
        }
    }
    if ((card.rarity === "Rare" || card.rarity === "Common") && (activeDeck.deckList[card.id] || 0) >= MAX_COPIES_PER_CARD) {
        showToast(`Max ${MAX_COPIES_PER_CARD} copies of any card per deck.`, "error");
        return false;
    }
    if (card.rarity === "Rare" && getRarityCountFromDeckList("Rare") + 1 > deckRarityRestrictions["Rare"]) {
        showToast(`Max ${deckRarityRestrictions["Rare"]} Rare cards per deck.`, "error");
        return false;
    }
    return true;
}

function getRarityCountFromDeckList(rarity) {
    let count = 0;
    for (let c in activeDeck.deckList) {
        let card = getObjectById(cards, c);
        if (card.rarity === rarity) count += activeDeck.deckList[c];
    }
    return count;
}

let deckNameSaveTimer = null;
deckBuilderNameEntry.addEventListener("input", () => {
    activeDeck.name = deckBuilderNameEntry.value;
    clearTimeout(deckNameSaveTimer);
    deckNameSaveTimer = setTimeout(() => saveActiveDeck(), 500);
});
deckBuilderNameEntry.addEventListener("blur", () => {
    if (activeDeck) { clearTimeout(deckNameSaveTimer); saveActiveDeck(); }
});

deckBuilderBackButton.addEventListener("click", () => {
    buildDecks();
    decksContainer.style.display = "";
    deckBuilderContainer.style.display = "none";
});

deckBuilderDeleteButton.addEventListener("click", async () => {
    const confirmed = await showConfirm(`Delete <strong>${activeDeck.name}</strong>? This cannot be undone.`);
    if (!confirmed) return;

    decks = decks.filter(d => d.id !== activeDeck.id);
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
    buildDecks();
    decksContainer.style.display = "";
    deckBuilderContainer.style.display = "none";
    showToast(`"${activeDeck.name}" deleted.`, "success");
});

deckBuilderBinderSearch.addEventListener("input", () => {
    let searchInput = deckBuilderBinderSearch.value.toLowerCase();
    document.querySelectorAll("#deckBuilderBinderList .card").forEach(card => {
        card.parentElement.style.display =
            (card.dataset.name.includes(searchInput) || !searchInput) ? "" : "none";
    });
});

deckBuilderBinderFilter.addEventListener("change", () => {
    let filter = deckBuilderBinderFilter.value;
    document.querySelectorAll("#deckBuilderBinderList .card").forEach(card => {
        card.parentElement.style.display =
            (card.dataset.cardClass === filter || !filter) ? "" : "none";
    });
});

function saveActiveDeck() {
    if (!activeDeck || !currentProfile) return;
    for (let d in decks) {
        if (decks[d].id === activeDeck.id) {
            decks[d] = activeDeck;
            break;
        }
    }
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
}

function getCountActiveDeck() {
    let count = 0;
    for (let c in activeDeck.deckList) count += activeDeck.deckList[c];
    return count;
}

function getCountDeck(deck) {
    let count = 0;
    for (let c in deck.deckList) count += deck.deckList[c];
    return count;
}

function deleteAllDecks() {
    decks = [];
    db.collection("profiles").doc(toKebabCase(currentProfile)).update({ decks: decks });
}
